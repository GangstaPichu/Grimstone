#include "GrimstoneRuntime.h"

#include "GrimstoneGame.h"
#include "TileGrid.h"
#include "TileKindRegistry.h"

#include <cctype>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <filesystem>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

// ======= SKILLS/XP =======
// Transcribed from js/world.js's SKILL_XP_TABLE (line 103) and js/ui.js's
// xpForLevel() (line 610) / js/activities.js's giveXP() (line 1914).
enum class GrimstoneSkill {
    Mining,
    Smithing,
    Woodcutting,
    Crafting,
    Fishing,
    Cooking,
    Farming,
    Attack,
    Defence,
    Strength,
    Hitpoints,
    Count,
};
constexpr int kSkillCount = static_cast<int>(GrimstoneSkill::Count);

// String literals -- static storage duration, so a pointer into one of
// these is safe to hand to a BeFlagUpdate/etc. without any lifetime
// concern, unlike a std::string's own c_str() (which would dangle the
// moment the temporary is destroyed).
constexpr const char* kSkillXpFlagKeys[kSkillCount] = {
    "skill_xp_mining",     "skill_xp_smithing", "skill_xp_woodcutting", "skill_xp_crafting",
    "skill_xp_fishing",    "skill_xp_cooking",  "skill_xp_farming",     "skill_xp_attack",
    "skill_xp_defence",    "skill_xp_strength", "skill_xp_hitpoints",
};
// Mirrors js/world.js's own state.players[0].skills default -- every skill
// starts at level 1 (xp 0) except Hitpoints, which starts at level 10
// (xp 1154, SKILL_XP_TABLE[9]).
constexpr double kSkillDefaultXp[kSkillCount] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1154};

// js/world.js line 103 -- levels 1-30; js/ui.js's xpForLevel() (line
// 610-614) extrapolates past the table linearly by the table's own last
// step, which the C++ xpForLevel() below reproduces exactly.
constexpr double kSkillXpTable[] = {0,    83,   174,  276,  388,  512,  650,   801,   969,   1154,  1358,  1584,
                                     1833, 2107, 2411, 2746, 3115, 3523, 3973,  4470,  5018,  5624,  6291,  7028,
                                     7842, 8740, 9730, 10824, 12031, 13363};
constexpr int kSkillXpTableSize = sizeof(kSkillXpTable) / sizeof(kSkillXpTable[0]);

double xpForLevel(int lvl) {
    if (lvl <= 1) return 0.0;
    if (lvl - 1 < kSkillXpTableSize) return kSkillXpTable[lvl - 1];
    return kSkillXpTable[kSkillXpTableSize - 1] * (lvl - kSkillXpTableSize + 1);
}

// Mirrors giveXP()'s own level-up while-loop (js/activities.js line 1920):
// walk levels upward while accumulated xp already covers the next level,
// capped at 99 (the JS's own hard skill cap).
int levelForXp(double xp) {
    int lvl = 1;
    while (lvl < 99 && xp >= xpForLevel(lvl + 1)) ++lvl;
    return lvl;
}

double readFlag(const BeTileGridFrame* frame, const char* key, double defaultValue) {
    for (int i = 0; i < frame->flagCount; ++i)
        if (std::strcmp(key, frame->flags[i].key) == 0) return frame->flags[i].value;
    return defaultValue;
}

// String-store twin of readFlag() above (BeTileGridFrame::strings,
// TileGridStringStore.h) -- returns nullptr (not "", which would be
// indistinguishable from a real empty stored value) when `key` was never
// set. Used by zonetransition::resumeActiveZoneFromSaveIfNeeded() below to
// read back the active zone id a previous session's requestZoneSwap()
// wrote via queueStringSet().
const char* readString(const BeTileGridFrame* frame, const char* key) {
    for (int i = 0; i < frame->stringCount; ++i)
        if (std::strcmp(key, frame->strings[i].key) == 0) return frame->strings[i].value;
    return nullptr;
}

double readSkillXp(const BeTileGridFrame* frame, GrimstoneSkill skill) {
    const int idx = static_cast<int>(skill);
    return readFlag(frame, kSkillXpFlagKeys[idx], kSkillDefaultXp[idx]);
}

int readSkillLevel(const BeTileGridFrame* frame, GrimstoneSkill skill) { return levelForXp(readSkillXp(frame, skill)); }

// ======= Per-frame write-back scratch buffers =======
// Every `requested*Updates` array in BeTileGridFrame only needs to stay
// valid until onTileGridUpdate returns (same lifetime rule as every other
// write-back field in GameModuleApi.h) -- a function-local static reused
// every frame (cleared at the top of updateGrimstoneRuntime(), below)
// avoids a fresh heap allocation every single frame without any actual
// lifetime risk, since the host reads/copies these before this call
// returns and never retains the pointers.
std::vector<BeFlagUpdate>& flagUpdateBuffer() {
    static std::vector<BeFlagUpdate> buf;
    return buf;
}
std::vector<BeItemDelta>& itemUpdateBuffer() {
    static std::vector<BeItemDelta> buf;
    return buf;
}
// Milestone <2d-save-slots> investigation (PORTING_PLAN.md's js/save-load.js
// row): the host's string store (TileGridStringStore.h) persists through a
// save/resume exactly like the flag store already does (TileGridSaveGame.h's
// stringStates), so it's the natural place for the one piece of this
// plugin's own in-memory state that used to be lost across a process
// restart -- see zonetransition::resumeActiveZoneFromSaveIfNeeded() below.
std::vector<BeStringUpdate>& stringUpdateBuffer() {
    static std::vector<BeStringUpdate> buf;
    return buf;
}
void queueStringSet(const char* key, const char* value) {
    BeStringUpdate update;
    update.key = key;
    update.value = value;
    stringUpdateBuffer().push_back(update);
}

void queueXpGrant(GrimstoneSkill skill, double amount) {
    BeFlagUpdate update;
    update.key = kSkillXpFlagKeys[static_cast<int>(skill)];
    update.value = amount;
    update.mode = 1; // INCREMENT (BeFlagUpdate::mode, GameModuleApi.h)
    flagUpdateBuffer().push_back(update);
}

void queueItemGrant(const char* itemId, int count) {
    BeItemDelta delta;
    delta.itemId = itemId;
    delta.count = count; // positive = add, negative = remove (BeItemDelta's own doc comment)
    itemUpdateBuffer().push_back(delta);
}

// Forward-declared here (defined below, near the other Aldermast/bank
// dialogue write-back helpers) so the day/night + weather section --
// which sits earlier in the file, right after zone transitions -- can
// use it too instead of duplicating a second "SET a flag" helper.
void queueFlagSet(const char* key, double value);

// ======= More per-frame write-back scratch buffers (Fishing/Cooking/
// Smithing/Farming) =======
// Same lifetime rule as flagUpdateBuffer()/itemUpdateBuffer() above.
std::vector<BeTileCellEdit>& tileEditBuffer() {
    static std::vector<BeTileCellEdit> buf;
    return buf;
}
std::vector<BeTimerRequest>& timerStartBuffer() {
    static std::vector<BeTimerRequest> buf;
    return buf;
}
std::vector<BeHitboxRequest>& hitboxBuffer() {
    static std::vector<BeHitboxRequest> buf;
    return buf;
}
void queueTileEdit(int layerIndex, int cellX, int cellY, const char* kindId) {
    BeTileCellEdit edit;
    edit.layerIndex = layerIndex;
    edit.cellX = cellX;
    edit.cellY = cellY;
    edit.kindId = kindId;
    tileEditBuffer().push_back(edit);
}
void queueTimerStart(const char* key, double seconds) {
    BeTimerRequest req;
    req.key = key;
    req.seconds = seconds;
    timerStartBuffer().push_back(req);
}
void queueHitbox(float centerX, float centerY, int shape, float sizeX, float sizeY, const char* weaponName) {
    BeHitboxRequest req;
    req.centerX = centerX;
    req.centerY = centerY;
    req.shape = shape;
    req.sizeX = sizeX;
    req.sizeY = sizeY;
    req.weaponName = weaponName;
    hitboxBuffer().push_back(req);
}

// Farming's per-cell flag/timer keys are built at runtime ("farmplot_grow_
// 12_7", ...), unlike every OTHER key in this file (all static string
// literals, safe to hand a BeFlagUpdate/BeTimerRequest directly). A
// std::deque never invalidates an existing element's address when
// something is pushed onto the back (unlike std::vector, which can
// reallocate), so interning a dynamically-built key's string here keeps
// its c_str() pointer valid for the rest of this frame -- exactly as long
// as requestedFlagUpdates/requestedTimerStarts need it to be.
std::deque<std::string>& stringScratch() {
    static std::deque<std::string> buf;
    return buf;
}
const char* internString(std::string s) {
    stringScratch().push_back(std::move(s));
    return stringScratch().back().c_str();
}

// ======= Inventory read helpers =======
// frame->inventory is a read-only per-frame snapshot of the host's fixed-
// length TileGridInventory (BeInventorySlot's own doc comment) -- mirrors
// js/activities.js's own countInInventory()/hasItem() helpers, just reading
// the host's array instead of a JS state.players[0].inventory array.
int countInInventory(const BeTileGridFrame* frame, const char* itemId) {
    int total = 0;
    for (int i = 0; i < frame->inventoryCount; ++i) {
        if (frame->inventory[i].itemId != nullptr && frame->inventory[i].itemId[0] != '\0' &&
            std::strcmp(frame->inventory[i].itemId, itemId) == 0) {
            total += frame->inventory[i].count;
        }
    }
    return total;
}

// Checks the player's own cell plus its 4 orthogonal neighbors (the same
// "no facing direction" adjacency rule handleMiningAndWoodcutting() already
// establishes below) for a tile whose kind id is one of `kindIds`, on
// EITHER layer -- Floor (0) or Overlay (1). Both layers are checked because
// this port's own facility placements aren't consistent about which one
// they paint onto: buildProceduralZone() paints e.g. "smelter"/
// "cooking_fire" straight onto the Floor layer's `tiles` array before its
// own floor snapshot, while buildHomeCabinInterior()/buildBlacksmithInterior()
// place the very same tile kinds via grid.setOverlay() instead. Returns the
// matching cell's own coordinates and matched kind id via the (optional)
// out-parameters, so a caller that needs to know WHICH cell (farming) or
// WHICH kind matched (harvesting, to look up which crop it is) can.
bool findAdjacentTileOfKind(BeTileGridFrame* frame, const char* const* kindIds, int kindIdCount,
                             int* outCellX, int* outCellY, const char** outMatchedKindId) {
    if (frame->queryTileKindId == nullptr || frame->worldToCell == nullptr) return false;

    int px, py;
    frame->worldToCell(frame->playerWorldX, frame->playerWorldY, &px, &py);

    constexpr int kDx[] = {0, 0, 0, -1, 1};
    constexpr int kDy[] = {0, -1, 1, 0, 0};

    for (int dir = 0; dir < 5; ++dir) {
        const int cx = px + kDx[dir];
        const int cy = py + kDy[dir];
        for (int layer = 0; layer < 2; ++layer) {
            const char* kindId = frame->queryTileKindId(layer, cx, cy);
            if (kindId == nullptr || kindId[0] == '\0') continue;
            for (int i = 0; i < kindIdCount; ++i) {
                if (std::strcmp(kindId, kindIds[i]) != 0) continue;
                if (outCellX != nullptr) *outCellX = cx;
                if (outCellY != nullptr) *outCellY = cy;
                if (outMatchedKindId != nullptr) *outMatchedKindId = kindIds[i];
                return true;
            }
        }
    }
    return false;
}

// ======= Hitpoints <-> playerMaxHealth sync =======
// js/activities.js's giveXP() (line 1926): a Hitpoints level-up sets
// `p.maxHp = sk.lvl*3` and heals 5 (clamped to the new max). The host's
// own playerHealth/playerMaxHealth (v15->v16 ABI) starts both at 100 for a
// fresh game, with no level concept of its own -- this keeps the two
// systems in sync every frame without assuming which one moved first.
void syncHitpointsMaxHealth(BeTileGridFrame* frame) {
    const int hpLevel = readSkillLevel(frame, GrimstoneSkill::Hitpoints);
    const float targetMax = static_cast<float>(hpLevel) * 3.0f;
    // Only fire when it actually needs to change -- requestedSetMaxHealth
    // fires whenever set > 0, and re-asserting the SAME value every frame
    // is harmless but pointless; comparing first also means a plugin that
    // deliberately raised playerMaxHealth by some other means this exact
    // frame isn't immediately stomped back (not a case that exists yet,
    // but the cheap comparison costs nothing and avoids relying on that).
    if (frame->playerMaxHealth != targetMax) frame->requestedSetMaxHealth = targetMax;
}

// ======= Mining + Woodcutting =======
// Transcribed from js/activities.js's startMine()/startChop() (lines
// 62-92) and js/input.js's own per-tile action wiring (lines 474-481),
// which is where the real level requirements/XP amounts/item ids live --
// startMine/startChop themselves take those as parameters, so input.js's
// call sites are the actual source of truth, not a guess.
//
// Simplification versus the JS: the JS runs a multi-second progress-bar
// timer (startActivity(), line 10) before granting the item/XP. This
// engine's 2D host has no plugin-drawable progress-bar HUD primitive yet
// (BeTileGridFrame's UI surface is a toast + the dialog-stack template,
// neither of which is a progress bar) -- ported as an instant grant on
// the frame `interactPressed` lands next to the resource, with a toast
// standing in for the "you mine/chop some X" log line. A timed variant is
// straightforward to add once a progress-bar HUD primitive exists (or by
// using the host-ticked timer store, TileGridTimerStore.h, to gate a
// second interact press) -- noted in PORTING_PLAN.md as a follow-up, not
// silently dropped.
struct MinableResource {
    const char* tileKindId;    // registerGrimstoneTileKinds()'s own id (GrimstoneGame.cpp)
    const char* itemId;        // js/input.js's own item id (matches ITEMS[] in the JS source)
    GrimstoneSkill skill;
    int requiredLevel;         // js/activities.js startMine()'s own reqLvl map (line 65); 1 = no real gate
    double xpAmount;
    const char* toastVerb;     // "mine" or "chop", matching the JS's own log line
};

constexpr MinableResource kMinableResources[] = {
    {"copper_ore_node", "copper_ore", GrimstoneSkill::Mining, 1, 10.0, "mine"},
    {"iron_ore_node", "iron_ore", GrimstoneSkill::Mining, 15, 35.0, "mine"},
    {"gold_ore_node", "gold_ore", GrimstoneSkill::Mining, 40, 65.0, "mine"},
    {"mithril_ore_node", "mithril_ore", GrimstoneSkill::Mining, 55, 80.0, "mine"},
    {"coal_node", "coal", GrimstoneSkill::Mining, 20, 30.0, "mine"},
    {"normal_tree", "normal_log", GrimstoneSkill::Woodcutting, 1, 25.0, "chop"},
    {"oak_tree", "oak_log", GrimstoneSkill::Woodcutting, 1, 37.5, "chop"},
    {"willow_tree", "willow_log", GrimstoneSkill::Woodcutting, 1, 67.5, "chop"},
};
constexpr int kMinableResourceCount = sizeof(kMinableResources) / sizeof(kMinableResources[0]);

// One static toast buffer, reused per frame (same lifetime rule as the
// write-back vectors above: valid only until onTileGridUpdate returns,
// which is exactly how long requestedToastText needs to live).
std::string& toastScratch() {
    static std::string buf;
    return buf;
}

void handleMiningAndWoodcutting(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    if (frame->queryTileKindId == nullptr || frame->worldToCell == nullptr) return;

    int px, py;
    frame->worldToCell(frame->playerWorldX, frame->playerWorldY, &px, &py);

    // Check the player's own cell plus its 4 orthogonal neighbors -- there
    // is no "facing direction" in this ABI (BeTileGridFrame has no facing
    // field), so this checks everywhere immediately adjacent rather than
    // guessing a direction, same "player must be right next to it" spirit
    // the JS's own click-to-interact model has (a right-click context menu
    // action only ever fires on a tile the player has already walked to).
    constexpr int kDx[] = {0, 0, 0, -1, 1};
    constexpr int kDy[] = {0, -1, 1, 0, 0};

    for (int dir = 0; dir < 5; ++dir) {
        const int cx = px + kDx[dir];
        const int cy = py + kDy[dir];
        // Resources are painted on the Floor layer (0) by every
        // buildXLevel()/buildProceduralZone() function in GrimstoneGame.cpp
        // (see e.g. registerGrimstoneTileKinds()'s own "Resource nodes"
        // section) -- Overlay (1) never holds an ore/tree kind.
        const char* kindId = frame->queryTileKindId(0, cx, cy);
        if (kindId == nullptr || kindId[0] == '\0') continue;

        for (int i = 0; i < kMinableResourceCount; ++i) {
            const MinableResource& res = kMinableResources[i];
            if (std::strcmp(kindId, res.tileKindId) != 0) continue;

            const int level = readSkillLevel(frame, res.skill);
            if (level < res.requiredLevel) {
                toastScratch() = std::string("Need level ") + std::to_string(res.requiredLevel) + ".";
                frame->requestedToastText = toastScratch().c_str();
                return;
            }

            queueItemGrant(res.itemId, 1);
            queueXpGrant(res.skill, res.xpAmount);
            toastScratch() = std::string("You ") + res.toastVerb + " some " + res.itemId + ".";
            frame->requestedToastText = toastScratch().c_str();
            return; // one resource per interact press, matching the JS's own single-activity-at-a-time rule
        }
    }
}

// ======= Combat (simplified real-time interaction, NOT the JS's turn-based
// battle menu) =======
// js/activities.js's real combat is a full turn-based modal battle-menu
// system (executeCombatMove(), ~line 1293, and the whole panel around it,
// ~lines 1109-1790): move buttons with damage multipliers/multi-hit/buffs/
// debuffs/miss chance/magic-scaling, turn order, flee, etc. This engine's
// own combat primitives (BeHitboxRequest/BeAgentState::health,
// GameModuleApi.h's "combat framework v20->v21" section) are built for a
// REAL-TIME action-combat model instead -- a hitbox fired at a moment of the
// caller's choosing, resolved against a named WeaponDef's FIXED damage, no
// menu, no turns, no per-swing damage override. Building the full turn-based
// menu system is explicitly OUT OF SCOPE for this pass (a much larger,
// separate body of work -- an entire modal dialog-stack UI with move
// buttons, buff/debuff tracking, turn sequencing); what follows is a real,
// working SIMPLIFIED real-time stand-in instead: one BeHitboxRequest per
// interact press against the nearest living enemy agent, using the JS's own
// basic-attack (Punch, dmgMult:1.0) damage formula.
//
// **Real gap, found while wiring this up, not a simplification this port can
// paper over**: NOTHING in this port currently spawns a live TileAgentSpawn
// for ANY enemy kind -- grep GrimstoneGame.cpp for "agentSpawns"/
// "TileAgentSpawn" and there are zero hits. Every goblin/skeleton/wolf/
// zombie/cultist placed by every buildXLevel()/buildProceduralZone()
// function so far is a purely decorative painted TILE
// (registerGrimstoneTileKinds()'s own enemy-kind entries), matching
// PORTING_PLAN.md's own repeated "painted tiles only, no markers" note on
// every zone that places one. That means frame->agents is currently EMPTY
// (agentCount == 0) in every ported zone today -- there is no live agent
// anywhere in this port with a health/maxHealth for a hitbox to resolve
// against yet. This code is written against the real, intended mechanism
// (BeHitboxRequest resolved host-side against frame->agents by kind) so it
// works the moment a FUTURE pass authors these enemy placements as real
// TileAgentSpawn entries -- swapping dozens of painted-tile placements
// across every zone for host-owned agents is its own separate, larger
// authoring task, out of scope here. It is UNVERIFIED against a live agent
// in this sandbox for exactly that reason (no engine build exists here
// either), and this comment says so rather than claiming otherwise.
//
// **Judgement call on how damage is applied**: BeHitboxRequest can only name
// a WeaponDef with a FIXED damage value (WeaponDef.h's own doc comment: "no
// per-attack runtime concept... a weapon's active frames are the caller's
// own responsibility"), and GameModuleApi.h has no direct agent-health
// write-back at all -- searched the whole header (grep for
// "requestedHealthDelta", which exists ONLY for the PLAYER's own health, and
// for any agent-health-shaped write-back) and BeAgentState::health's own doc
// comment is explicit that a hit is applied only by "the host resolving a
// requestedHitboxes hit." Hitbox resolution against a named weapon is
// therefore the ONLY way an agent's health changes -- there is no second,
// more-precise option to pick between. This resolves the two choices
// GrimstoneRuntime's own task framing offered in favor of (a): a small SET
// of discrete weapon tiers (content/weapons.json, see below), each a
// candidate fixed damage value, with the closest tier to the JS's own
// computed roll fired each swing. This is real, deliberate quantization, not
// a faithful per-swing roll -- e.g. a computed roll of 24 snaps to whichever
// authored tier is nearest (21 or 28), same as any other "pick the closest
// bucket" approximation.
constexpr const char* kEnemyAgentKinds[] = {"goblin_spawn", "skeleton_spawn", "wolf_spawn", "zombie"};
constexpr int kEnemyAgentKindCount = sizeof(kEnemyAgentKinds) / sizeof(kEnemyAgentKinds[0]);

// ~1.5 tiles (TileGrid::tileSize defaults to 1.0 world unit) -- the "player
// must be standing right next to it" adjacency spirit
// handleMiningAndWoodcutting() already uses, generalized to a plain radius
// since there's no facing direction in this ABI.
constexpr float kMeleeRangeWorldUnits = 1.5f;

// content/weapons.json's own real, hand-authored entries (its own header
// comment documents the exact WeaponDef.h/WeaponDef.cpp schema this was
// verified against) -- `damage` here MUST match that file's own "damage"
// field for each `weaponName`, since this table is what PICKS which one to
// fire, not a duplicate source of truth for the number itself.
struct CombatWeaponTier {
    const char* weaponName;
    double damage;
};
constexpr CombatWeaponTier kCombatWeaponTiers[] = {
    {"grimstone_fists_t1", 3.0},   {"grimstone_fists_t2", 6.0},    {"grimstone_fists_t3", 10.0},
    {"grimstone_fists_t4", 15.0},  {"grimstone_fists_t5", 21.0},   {"grimstone_fists_t6", 28.0},
    {"grimstone_fists_t7", 37.0},  {"grimstone_fists_t8", 48.0},   {"grimstone_fists_t9", 62.0},
    {"grimstone_fists_t10", 80.0}, {"grimstone_fists_t11", 100.0}, {"grimstone_fists_t12", 125.0},
};
constexpr int kCombatWeaponTierCount = sizeof(kCombatWeaponTiers) / sizeof(kCombatWeaponTiers[0]);

// js/activities.js's own ENEMY_DEFS (line 741) -- xp values only. Gold isn't
// granted here: no gold/economy flag or item exists anywhere in this port
// yet (checked -- no "gold" item id appears anywhere in GrimstoneRuntime.cpp/
// GrimstoneGame.cpp), a real gap this function doesn't invent a workaround
// for. hp/minDmg/maxDmg/aggroRange/speed/patrolRadius are irrelevant here:
// the HOST owns HP itself (BeAgentState::health/maxHealth), and this port
// has no per-species aggro/patrol AI wired up either (js/npcs.js's own
// PORTING_PLAN.md row: "Not started").
struct EnemyDef {
    const char* kind; // registerGrimstoneTileKinds()'s own tile-kind id
    const char* displayName;
    double xp; // matches ENEMY_DEFS[...].xp exactly
};
constexpr EnemyDef kEnemyDefs[] = {
    {"goblin_spawn", "Goblin", 12.0},
    {"skeleton_spawn", "Skeleton", 18.0},
    {"wolf_spawn", "Wolf", 15.0},
    {"zombie", "Zombie", 20.0},
};
constexpr int kEnemyDefCount = sizeof(kEnemyDefs) / sizeof(kEnemyDefs[0]);

const EnemyDef* findEnemyDef(const char* kind) {
    if (kind == nullptr) return nullptr;
    for (int i = 0; i < kEnemyDefCount; ++i)
        if (std::strcmp(kind, kEnemyDefs[i].kind) == 0) return &kEnemyDefs[i];
    return nullptr;
}

// Fires one BeHitboxRequest against the nearest living enemy agent within
// melee range -- one attack per interact press, matching every other
// activity's own "one grant per press" rule.
void handleCombatAttack(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    if (frame->agents == nullptr) return;

    int targetIdx = -1;
    float bestDistSq = kMeleeRangeWorldUnits * kMeleeRangeWorldUnits;
    for (int i = 0; i < frame->agentCount; ++i) {
        const BeAgentState& agent = frame->agents[i];
        if (agent.health <= 0.0f) continue; // dead agents stay in the array (index-stable), never a target
        if (findEnemyDef(agent.kind) == nullptr) continue;
        const float dx = agent.worldX - frame->playerWorldX;
        const float dy = agent.worldY - frame->playerWorldY;
        const float distSq = dx * dx + dy * dy;
        if (distSq <= bestDistSq) {
            bestDistSq = distSq;
            targetIdx = i;
        }
    }
    if (targetIdx < 0) return;

    // js/activities.js's own executeCombatMove() basic-attack formula
    // (Punch, dmgMult:1.0, line ~1355): floor(random()*(strLvl*2+4))+1,
    // plus floor((attackBonus+tempAtk+extraAtk)/3) -- the latter is always 0
    // here since no equipment-bonus/temp-buff system exists anywhere in this
    // port yet (the same "no equipment bonus tracking" gap every other
    // activity in this file already has, not a new one introduced here).
    // frame->randomUint32 (v27->v28 ABI) draws from the SAME seeded stream
    // handleFishing() already uses, in place of the JS's Math.random().
    const int strLevel = readSkillLevel(frame, GrimstoneSkill::Strength);
    double roll;
    if (frame->randomUint32 != nullptr) {
        constexpr double kUint32Max = 4294967295.0;
        const double unit = static_cast<double>(frame->randomUint32()) / kUint32Max;
        roll = std::floor(unit * static_cast<double>(strLevel * 2 + 4)) + 1.0;
    } else {
        roll = static_cast<double>(strLevel) + 2.5; // deterministic fallback: the roll's own mean
    }

    const CombatWeaponTier* chosen = &kCombatWeaponTiers[0];
    double bestDiff = std::fabs(kCombatWeaponTiers[0].damage - roll);
    for (int i = 1; i < kCombatWeaponTierCount; ++i) {
        const double diff = std::fabs(kCombatWeaponTiers[i].damage - roll);
        if (diff < bestDiff) {
            bestDiff = diff;
            chosen = &kCombatWeaponTiers[i];
        }
    }

    queueHitbox(frame->playerWorldX, frame->playerWorldY, /*shape=*/1, kMeleeRangeWorldUnits, 0.0f,
                chosen->weaponName);

    const EnemyDef* def = findEnemyDef(frame->agents[targetIdx].kind);
    toastScratch() = std::string("You strike at the ") + (def != nullptr ? def->displayName : "enemy") + ".";
    frame->requestedToastText = toastScratch().c_str();
}

// Runs every frame (not gated on interactPressed) -- detects the
// health <= 0 transition the host's own hitbox resolution produces on some
// LATER frame than the one that fired it (BeAgentState::health is a
// snapshot from BEFORE this frame's own resolution, so a kill can never be
// observed on the same frame the hitbox that caused it was requested), and
// grants the JS's own _combatVictory() xp split exactly once per agent
// (Attack/Strength get the full xp, Defence half, Hitpoints a third,
// js/activities.js lines 1762-1766) -- gated on a per-agent-index flag,
// since BeAgentState's own doc comment guarantees agent slots are
// index-stable and never shrink. Same "gate on a real transition, not every
// frame" discipline handleFarmGrowthTick() already establishes for its own
// stage-repaint.
void handleCombatDeathRewards(BeTileGridFrame* frame) {
    if (frame->agents == nullptr) return;
    for (int i = 0; i < frame->agentCount; ++i) {
        const BeAgentState& agent = frame->agents[i];
        if (agent.health > 0.0f) continue;
        const EnemyDef* def = findEnemyDef(agent.kind);
        if (def == nullptr) continue;

        const std::string rewardedKey = "combat_rewarded_agent_" + std::to_string(i);
        if (readFlag(frame, rewardedKey.c_str(), 0.0) != 0.0) continue; // already rewarded this death

        queueXpGrant(GrimstoneSkill::Attack, def->xp);
        queueXpGrant(GrimstoneSkill::Strength, def->xp);
        queueXpGrant(GrimstoneSkill::Defence, std::floor(def->xp * 0.5));
        queueXpGrant(GrimstoneSkill::Hitpoints, std::floor(def->xp * 0.33));
        queueItemGrant("bones", 1); // js's own addToInventory('bones'), always granted on a kill

        BeFlagUpdate rewardedFlag;
        rewardedFlag.key = internString(rewardedKey);
        rewardedFlag.value = 1.0;
        rewardedFlag.mode = 0; // SET
        flagUpdateBuffer().push_back(rewardedFlag);

        toastScratch() = std::string("You have defeated the ") + def->displayName + "!";
        frame->requestedToastText = toastScratch().c_str();
    }
}

// ======= Zone transitions =======
//
// Closes the real, documented gap GrimstoneRuntime.cpp's own dev-console
// "tp" command used to describe: every zone in GrimstoneGame.h/.cpp is its
// own in-process buildXLevel()/buildXInterior() C++ function, and
// BeTileGridFrame::requestedLevelPath (GameModuleApi.h, Milestone 252) is
// the engine's real "swap the active level" primitive -- but it is
// resolved by the HOST exactly the way `--level`/loadOrBuildLevel() already
// resolve it (TileGridHostRunner.cpp: `loadTileGrid(path, tileKinds)`,
// checked directly, not guessed), i.e. a FILE ON DISK in loadTileGrid()'s
// own JSON schema. There is no ABI hook for "here is a TileGrid I already
// built in memory, make it the active one" -- only a path.
//
// So the real, honest mechanism (not a workaround; TileGrid.h ships exactly
// this pair for exactly this purpose) is: build the destination zone's
// TileGrid in-process (unchanged, existing buildXLevel() functions),
// saveTileGrid() it out to a file in loadTileGrid()'s own schema under this
// plugin's asset directory, then point requestedLevelPath at that file --
// the host loads it back via the identical loadTileGrid() call a `--level`
// swap already uses. Every zone is regenerated into that file fresh on
// every transition into it (deterministic given the same seed -- see
// kPlaceholderWorldSeed below -- so this is not lossy), not pre-exported
// once at build time, so no new build step or content/*.json asset is
// needed for this to work.
//
// The SECOND real ABI gap this closes: BeTileMarker (the per-frame ABI
// struct handed to the plugin every frame) carries only `kind`/`worldX`/
// `worldY` -- TileMarker::properties (where every portal's own
// "targetZone" string lives) does NOT cross the ABI boundary at all
// (confirmed by reading BeTileMarker's full field list, GameModuleApi.h --
// the same gap playerNearAldermast()'s own doc comment above already
// documents and works around by position). So a portal can't be resolved
// from frame->markers alone. The fix here is the same position-based
// workaround, generalized: this file keeps its OWN cached copy of each
// zone's real, C++-side TileGrid (which DOES still have `properties` --
// it's the plugin's own in-process object, never round-tripped through the
// ABI) built by the exact same buildXLevel() call the host's own loaded
// grid came from, and matches the player's live ABI position against THAT
// cached grid's own marker positions/properties. Since this plugin is the
// only thing that ever requests a zone swap, its own idea of "which zone
// is active" is always exactly right the same frame it requests the swap
// (see activeZoneId() below) -- a real, complete fix for "no active-zone
// read field exists on the ABI", not a guess.
//
// Real, honestly-documented gap this does NOT close: `activeZoneId()`
// below defaults to "ashenveil" at process start, assuming the host's own
// initial `--level` is Ashenveil's own exported level.json (there is no
// ABI field to confirm this, or any other zone, is what actually loaded
// before this plugin's first frame) -- if a packaged build is ever
// launched with a different starting `--level` THIS PLUGIN NEVER ITSELF
// SAVED, portal detection in that starting zone will silently look at the
// wrong marker set until the first real transition corrects it. A future
// pass adding a real "confirm which level actually loaded" ABI field (the
// same gap handleFishing()'s own doc comment below names from the read
// side) would close this for good; there is no way to close it from the
// plugin side alone.
//
// UPDATE (save/load investigation, PORTING_PLAN.md's js/save-load.js row):
// the ONE case above that IS closeable from the plugin side alone -- the
// host resuming THIS plugin's own prior save (TileGridSaveGame.h's
// "continue where I left off," the default with no `--level` argument at
// all) -- now is closed, via resumeActiveZoneFromSaveIfNeeded() below and
// requestZoneSwap()'s own kActiveZoneStringKey write. The paragraph above
// remains true and unchanged for the OTHER case it names (an explicit,
// non-Ashenveil `--level` argument on a fresh launch); that one still has
// no ABI field to detect at all.
namespace zonetransition {

// There is still no persisted per-playthrough world seed anywhere in this
// port (buildStormcragLevel()'s own doc comment names the same gap) -- so
// every procedurally-seeded zone this plugin ever (re)builds uses this one
// fixed placeholder, matching that function's own judgement call. A future
// pass threading a real per-playthrough seed through (see PORTING_PLAN.md)
// should replace this constant with that seed everywhere it's read below.
constexpr uint32_t kPlaceholderWorldSeed = 1;

// How close (world units) the player must be to a "portal" TileMarker's own
// position for stepping onto it to fire a transition -- half a tile plus a
// little slack, the same "step onto it" spirit js/zones.js's own tile-based
// EXIT/PORTAL handlers use, ported to this engine's continuous world
// coordinates. Deliberately proximity-only, NOT gated on interactPressed --
// every portal in this port is a floor decal the JS always fires by
// walking over, never an interact prompt.
constexpr float kPortalTriggerRadiusWorld = 0.65f;

// Suppresses re-triggering a transition for this many frames right after
// one fires -- guards against the destination zone's own player_spawn
// marker happening to land within kPortalTriggerRadiusWorld of one of ITS
// portals (checked: none currently do, but a future zone easily could) and
// bouncing straight back. ~0.5s at a typical frame rate.
constexpr int kPostTransitionCooldownFrames = 30;

std::filesystem::path& assetDir() {
    static std::filesystem::path dir;
    return dir;
}

std::string& activeZoneIdRef() {
    static std::string zone = "ashenveil"; // see this section's own doc comment above
    return zone;
}

int& cooldownFrames() {
    static int frames = 0;
    return frames;
}

// Scratch buffer for frame->requestedLevelPath -- same "static buffer,
// valid across this one call, re-set every time it's needed" convention
// toastScratch()/stringScratch() etc. already use elsewhere in this file.
std::string& levelPathScratch() {
    static std::string path;
    return path;
}

std::unordered_map<std::string, TileGrid>& zoneCache() {
    static std::unordered_map<std::string, TileGrid> cache;
    return cache;
}

// Builds (if not already cached) and returns the real, C++-side TileGrid
// for `slug`, or nullptr if `slug` isn't in zoneSlugToTileGrid()'s own
// table (GrimstoneGame.h/.cpp) at all.
const TileGrid* cachedZone(const std::string& slug) {
    auto& cache = zoneCache();
    const auto it = cache.find(slug);
    if (it != cache.end()) return &it->second;
    TileGrid built;
    if (!zoneSlugToTileGrid(TileKindRegistry::instance(), slug, kPlaceholderWorldSeed, built)) return nullptr;
    return &cache.emplace(slug, std::move(built)).first->second;
}

// Save/resume investigation (PORTING_PLAN.md's js/save-load.js row): the
// key requestZoneSwap() below writes activeZoneIdRef() to, via the host's
// generic string store (BeStringUpdate/TileGridStringStore.h) -- persisted
// through a save/resume exactly like flagStates/inventoryItems already are
// (TileGridSaveGame.h's stringStates), with zero new save-file format.
constexpr const char* kActiveZoneStringKey = "active_zone_id";

bool& resumedActiveZoneFromSave() {
    static bool resumed = false;
    return resumed;
}

// Restores activeZoneIdRef() from a resumed save's string store, exactly
// once, on this plugin's first frame -- called from handleZoneTransition()
// below before anything else reads activeZoneIdRef(). This closes the
// RESUME half of this section's own doc comment above ("activeZoneId()
// below defaults to 'ashenveil' at process start"): the common real case
// of the host resuming THIS plugin's own prior save (TileGridSaveGame.h's
// "continue where I left off," on by default with no `--level` argument)
// now restores the actual last-active zone instead of silently assuming
// Ashenveil. The OTHER case that same doc comment names -- a packaged
// build launched with an explicit, non-Ashenveil `--level` this plugin
// never itself saved -- has no ABI field to detect at all (still true,
// unchanged by this) and is NOT what this closes: a saved string with an
// unrecognized/empty value (no prior save, or one written by an older
// build with no such key) leaves activeZoneIdRef() at its "ashenveil"
// default, the same as before this existed.
void resumeActiveZoneFromSaveIfNeeded(const BeTileGridFrame* frame) {
    if (resumedActiveZoneFromSave()) return;
    resumedActiveZoneFromSave() = true;
    const char* saved = readString(frame, kActiveZoneStringKey);
    if (saved == nullptr || saved[0] == '\0') return;
    const std::string savedZone = saved;
    if (cachedZone(savedZone) != nullptr) activeZoneIdRef() = savedZone;
}

// The first "player_spawn" marker in `grid`, or a small fallback near the
// origin (documented, not silently wrong) if a destination zone somehow
// has none -- every buildXLevel()/buildXInterior() function in
// GrimstoneGame.cpp places exactly one, but this is a real fallback rather
// than an out-of-bounds read if that ever isn't true.
glm::vec2 zoneSpawnPosition(const TileGrid& grid) {
    for (const TileMarker& m : grid.markers) {
        if (m.kind == "player_spawn") return m.position;
    }
    return glm::vec2(1.5f, 1.5f);
}

// The real mechanism, shared by both callers below (a portal the player
// stepped on, and the dev console's "tp"): build/cache the destination
// zone, save it to a real file in loadTileGrid()'s own schema, and point
// requestedLevelPath/requestedWarp at it -- see this section's own doc
// comment for why a file on disk is the real, non-optional shape this
// takes. Returns false (and toasts why) on a genuinely unknown slug or a
// file-write failure; true on success.
bool requestZoneSwap(BeTileGridFrame* frame, const std::string& targetZone) {
    const TileGrid* dest = cachedZone(targetZone);
    if (dest == nullptr) {
        toastScratch() = "No such zone: '" + targetZone + "'.";
        frame->requestedToastText = toastScratch().c_str();
        return false;
    }

    const std::filesystem::path outPath = assetDir() / "generated-zones" / (targetZone + "-level.json");
    try {
        std::filesystem::create_directories(outPath.parent_path());
        saveTileGrid(*dest, TileKindRegistry::instance(), outPath);
    } catch (const std::exception& e) {
        toastScratch() = std::string("Zone swap failed: ") + e.what();
        frame->requestedToastText = toastScratch().c_str();
        return false;
    }

    const glm::vec2 spawn = zoneSpawnPosition(*dest);
    levelPathScratch() = outPath.string();
    frame->requestedLevelPath = levelPathScratch().c_str();
    frame->requestedWarp = 1;
    frame->requestedWarpX = spawn.x;
    frame->requestedWarpY = spawn.y;

    activeZoneIdRef() = targetZone;
    // Persist it too -- see kActiveZoneStringKey's own doc comment above.
    // activeZoneIdRef() (not the `targetZone` parameter) is the value
    // handed to queueStringSet(), since it's the function-static string
    // whose storage genuinely outlives this frame -- the same lifetime
    // reasoning every other queue*() helper in this file already relies on
    // for its own arguments.
    queueStringSet(kActiveZoneStringKey, activeZoneIdRef().c_str());
    cooldownFrames() = kPostTransitionCooldownFrames;
    return true;
}

} // namespace zonetransition

// Read by handleFishing()'s FISH_TABLE zone-gating and tillTile()'s
// homestead-only check below -- both used to treat every zone as eligible/
// matching because no such read existed anywhere on the ABI (their own doc
// comments named this exact gap). Real and complete, per this section's
// own doc comment above: this plugin is the only thing that ever requests
// a zone swap, so it always knows the destination the same frame it
// requests it.
const std::string& activeZoneId() { return zonetransition::activeZoneIdRef(); }

// ======= Day/Night cycle + Weather =======
// Transcribed from js/world.js's day/night tracking (lines 1-96) and
// js/effects.js's Weather module (lines 608-888). Both are pure
// HOST-side-flag state, following this file's own "everything
// persistent is a flag" convention (syncHitpointsMaxHealth()'s doc
// comment, updateStockMarket()'s own real-time accumulator) -- there is
// no persistent-state struct anywhere else in this plugin, and this
// doesn't add one either.
namespace daynight {

// js/world.js line 5: "DAY_DURATION_MS = 15*60*1000" -- 15 REAL minutes
// per in-game day. BeTileGridFrame::dt is real seconds (not ms), so this
// is that same constant in seconds, matching tickDayNight()'s own
// `dt = (now - lastFrameTime) / DAY_DURATION_MS` division exactly, just
// with frame->dt standing in for a wall-clock delta the same way
// updateStockMarket()'s own doc comment already establishes for a 2D
// plugin with no wall-clock of its own.
constexpr double kDayDurationSeconds = 15.0 * 60.0;
// js/world.js line 6: `let gameTime = 0.22; // start just after dawn`.
constexpr double kDefaultGameTime = 0.22;
constexpr double kDefaultGameDay = 1.0;

constexpr const char* kTimeFlag = "daynight_game_time";
constexpr const char* kDayFlag = "daynight_game_day";

// js/activities.js's startFish() (lines 457-459) -- the ONLY place in
// the JS that actually classifies a gameTime value as day/night for
// gameplay purposes (getPeriodLabel()'s own dawn/dusk boundaries, lines
// 58-64, are a display-only distinction fishing never reads). Both
// windows deliberately leave a "neither" band (0.2-0.25, 0.75-0.8,
// matching dawn/dusk in the JS's own comment) where a fish that
// requires EITHER 'day' or 'night' bites at neither -- a real JS quirk
// (checked, not smoothed over): timeOfDay:'day'/'night' fish already
// have a real minLvl/rarity gate too, so this narrow non-biting window
// is exactly as intentional there as it is here.
bool isNight(double t) { return t > 0.8 || t < 0.2; }
bool isDay(double t) { return t >= 0.25 && t <= 0.75; }

double currentGameTime(const BeTileGridFrame* frame) { return readFlag(frame, kTimeFlag, kDefaultGameTime); }
double currentGameDay(const BeTileGridFrame* frame) { return readFlag(frame, kDayFlag, kDefaultGameDay); }

// js/world.js's tickDayNight() (lines 23-37): advance gameTime by
// dt/DAY_DURATION_MS, wrapping at 1.0, and bump gameDay on a midnight
// rollover (prev near 1.0, new value wrapped back near 0.0). Sleep's own
// fast-forward (sleepUntilMorning(), lines 68-96) isn't ported --
// there's no sleep/bed-interact activity anywhere else in this port
// either (checked: no "sleep"/isSleeping-shaped flag exists), so the
// clock always advances at the plain real-time rate, never
// fast-forwarded.
void updateDayNightCycle(BeTileGridFrame* frame) {
    const double prev = currentGameTime(frame);
    double day = currentGameDay(frame);

    double next = prev + static_cast<double>(frame->dt) / kDayDurationSeconds;
    next = next - std::floor(next); // wrap to [0,1), matching JS's `% 1.0`

    if (prev > 0.95 && next < 0.05) day += 1.0;

    queueFlagSet(kTimeFlag, next);
    queueFlagSet(kDayFlag, day);
}

// ======= Weather =======
// js/effects.js's Weather module constants (line 611).
enum WeatherKind { kClear = 0, kRain = 1, kHeavyRain = 2, kFog = 3, kSnow = 4, kSnowstorm = 5 };

constexpr const char* kCurrentFlag = "weather_current";
constexpr const char* kTargetFlag = "weather_target";
constexpr const char* kAlphaFlag = "weather_alpha";
constexpr const char* kLastDayFlag = "weather_last_day";

// js/effects.js's own seededRand() (lines 625-631) -- a plain xorshift32.
// JS's `s >> 7` is a SIGNED 32-bit right shift (every JS bitwise op
// ToInt32-converts its operand first) while `<<`/the final `>>> 0` are
// unsigned -- reproduced bit-for-bit via an explicit int32_t reinterpret
// for exactly that one operation, everything else in uint32_t.
double seededRand(uint32_t seed) {
    uint32_t s = seed;
    s = s ^ (s << 13);
    const int32_t signedS = static_cast<int32_t>(s);
    s = static_cast<uint32_t>(signedS ^ (signedS >> 7));
    s = s ^ (s << 17);
    return static_cast<double>(s) / 4294967295.0;
}

// There is still no persisted per-playthrough world seed anywhere in
// this port (zonetransition::kPlaceholderWorldSeed's own doc comment
// names the same gap) -- reusing that exact constant here, rather than
// inventing a second placeholder, matches js's own `worldSeed` global
// this formula reads (js/effects.js line 634).
constexpr uint32_t kPlaceholderWorldSeed = zonetransition::kPlaceholderWorldSeed;

// js/effects.js's own isIndoor test inside Weather.tick() (lines 681-683):
// `currentMap.isInterior && (zoneName.includes('CRYPT') ||
// zoneName.includes('CATACOMB') || zoneName.includes('INN') ||
// zoneName.includes('IRON DEPTHS'))`. This engine's 2D TileGrid has no
// `isInterior` field at all (checked TileGrid.h -- no such member), so
// there is no ABI-level way to ask "is the CURRENT zone an interior."
// The real, judgement-call substitute: the exact zone slugs this port's
// own zoneSlugToTileGrid() (GrimstoneGame.cpp) builds as a fully-interior
// space -- forsaken_library/hidden_vault/cultist_catacombs (dungeon-shaped,
// matching js's own CRYPT/CATACOMB keyword test) plus forsaken_chapel,
// which buildForsakenChapelLevel()'s own doc comment says the JS flags
// `isInterior:true` even though it "reads as outdoor" -- the one
// explicit exception this file's own comments already document, so it's
// used here rather than re-guessed.
bool isIndoorZone(const std::string& slug) {
    return slug == "forsaken_library" || slug == "hidden_vault" || slug == "cultist_catacombs" ||
           slug == "forsaken_chapel";
}

// js/effects.js's pickWeatherForDay() (lines 633-663), transcribed
// branch-for-branch. The JS keys this off `currentMap.name` (a display
// string, e.g. "STORMCRAG REACH") -- this port's own activeZoneId()
// only ever returns a SLUG ("stormcrag_reach"), so each JS zone-name
// branch below is matched by the slug this port's own
// zoneSlugToTileGrid() builds for that same zone (checked directly
// against GrimstoneGame.cpp's own kZoneSlugs/zoneSlugToTileGrid(), not
// guessed from the name alone). js's own `r2` local (line 636) is
// computed but never actually read anywhere in pickWeatherForDay() --
// confirmed by reading the whole function -- so it's dropped here
// rather than reproducing dead code.
int pickWeatherForDay(double day, const std::string& zoneSlug) {
    const uint32_t seed = kPlaceholderWorldSeed * 31u + static_cast<uint32_t>(day) * 1337u;
    const double r = seededRand(seed);

    if (zoneSlug == "stormcrag_reach" || zoneSlug == "aetheric_spire") {
        if (r < 0.25) return kSnowstorm;
        if (r < 0.55) return kSnow;
        if (r < 0.70) return kHeavyRain;
        return kClear;
    }
    if (zoneSlug == "whisperwood") {
        if (r < 0.30) return kFog;
        if (r < 0.50) return kRain;
        if (r < 0.60) return kHeavyRain;
        return kClear;
    }
    if (zoneSlug == "cursed_marshes" || zoneSlug == "obsidian_depths") {
        if (r < 0.20) return kFog;
        if (r < 0.45) return kHeavyRain;
        if (r < 0.60) return kRain;
        return kClear;
    }
    // Default zones (ashenveil, ashen_moor, iron_peaks, greenfield_pastures,
    // ashgrove_hollow, western_pass, homestead, and any dungeon-ish slug
    // not already caught by isIndoorZone() above) -- js's own comment,
    // "Ashenveil, Ashwood Vale, Iron Peaks, dungeons".
    if (r < 0.18) return kHeavyRain;
    if (r < 0.40) return kRain;
    return kClear;
}

// js/effects.js's Weather.tick() (lines 678-702): recompute the target
// once per in-game DAY (or on a zone change, via weather_last_day being
// reset to -1 below), then blend `weatherAlpha` toward it by a fixed
// +0.008 every tick -- js's own tick() runs once per requestAnimationFrame,
// exactly like updateGrimstoneRuntime() runs once per engine frame, so
// this increments once per call with no dt scaling, matching the JS's
// own per-RENDER-FRAME (not per-real-second) blend rate exactly.
void updateWeather(BeTileGridFrame* frame) {
    const double day = currentGameDay(frame);
    const std::string& zoneSlug = activeZoneId();
    const bool isIndoor = isIndoorZone(zoneSlug);

    double current = readFlag(frame, kCurrentFlag, static_cast<double>(kClear));
    double target = readFlag(frame, kTargetFlag, static_cast<double>(kClear));
    double alpha = readFlag(frame, kAlphaFlag, 0.0);
    const double lastDay = readFlag(frame, kLastDayFlag, -1.0);

    if (day != lastDay) {
        target = isIndoor ? static_cast<double>(kClear) : static_cast<double>(pickWeatherForDay(day, zoneSlug));
        alpha = 0.0;
    }

    if (current != target) {
        alpha += 0.008;
        if (alpha >= 1.0) {
            current = target;
            alpha = 1.0;
        }
    } else {
        alpha = 1.0;
    }

    if (isIndoor) {
        current = kClear;
        alpha = 0.0;
    }

    queueFlagSet(kCurrentFlag, current);
    queueFlagSet(kTargetFlag, target);
    queueFlagSet(kAlphaFlag, alpha);
    queueFlagSet(kLastDayFlag, day);
}

int currentWeather(const BeTileGridFrame* frame) {
    return static_cast<int>(readFlag(frame, kCurrentFlag, static_cast<double>(kClear)));
}

// js/effects.js's Weather.forceChange() (lines 868-871) -- called on a
// zone transition so the newly-entered zone's own weather is
// (re)computed against ITS zone name/isIndoor state on the very next
// updateWeather() call, instead of waiting for the next in-game day.
void forceChange() { queueFlagSet(kLastDayFlag, -1.0); }

// ======= Weather particle bursts =======
// GameModuleApi.h's requestedParticleEffect/X/Y (v9, widened v18->v19
// with requestedParticleDirX/Y/Scale/ColorR/G/B/A) fires exactly ONE
// particle burst per onTileGridUpdate() call it's set on -- confirmed by
// reading TileGridHostRunner.cpp's own onTileGridUpdate consumer (grep
// for "requestedParticleEffect"): each call that fires it constructs a
// brand-new ParticleEmitterInstance from content/particle-effects.json's
// named recipe (BeTileGridFrame's own doc comment, "GameModuleApi.h") and
// appends it to the host's particleBursts list, which is exactly the
// mechanism js/effects.js's Weather.draw() approximates continuously
// with a persistent, host-owned particle pool. There is NO persistent
// "ambient weather density" primitive on this ABI (checked: no
// requestedAmbientParticle/requestedWeatherDensity field of any shape
// exists) -- so continuous-looking weather is hand-driven here by firing
// one fresh burst EVERY frame the weather is active, each one scattered
// around the player's own position (the only camera-relative point this
// ABI's read side exposes -- see handleZoneTransition()'s own doc
// comment on the missing viewport-bounds read for the matching gap on
// that side) with content/particle-effects.json's own Box emission shape
// spreading each burst across a wide band so consecutive bursts overlap
// into a continuous-reading effect rather than visible discrete puffs.
constexpr const char* kRainEffect = "grimstone_rain";
constexpr const char* kHeavyRainEffect = "grimstone_heavy_rain";
constexpr const char* kSnowEffect = "grimstone_snow";
constexpr const char* kSnowstormEffect = "grimstone_snowstorm";
constexpr const char* kFogEffect = "grimstone_fog";

const char* effectNameForWeather(int weather) {
    switch (weather) {
        case kRain:
            return kRainEffect;
        case kHeavyRain:
            return kHeavyRainEffect;
        case kFog:
            return kFogEffect;
        case kSnow:
            return kSnowEffect;
        case kSnowstorm:
            return kSnowstormEffect;
        default:
            return nullptr;
    }
}

void fireWeatherParticles(BeTileGridFrame* frame) {
    const int weather = currentWeather(frame);
    const char* effectName = effectNameForWeather(weather);
    if (effectName == nullptr) return; // kClear, or isIndoorZone() already forced kClear this frame

    // Spread bursts around the player rather than always at the exact
    // same point -- frame->randomUint32 (the same seeded stream every
    // other weighted roll in this file already draws from) stands in
    // for js/effects.js's own Math.random()-seeded particle scatter.
    // ~6 world units either side of the player, well past this file's
    // own kMeleeRangeWorldUnits/kPortalTriggerRadiusWorld small radii --
    // there is no viewport-bounds read on this ABI to size this exactly
    // to "what's on screen" (see this namespace's own top-of-section
    // doc comment), so this is a documented approximation, not a
    // measured one.
    constexpr float kScatterRadius = 6.0f;
    float offsetX = 0.0f;
    float offsetY = -4.0f; // bias upward/"north" so a fresh burst has room to fall/drift into view
    if (frame->randomUint32 != nullptr) {
        constexpr double kUint32Max = 4294967295.0;
        const double unitX = static_cast<double>(frame->randomUint32()) / kUint32Max;
        const double unitY = static_cast<double>(frame->randomUint32()) / kUint32Max;
        offsetX = static_cast<float>((unitX - 0.5) * 2.0 * kScatterRadius);
        offsetY = static_cast<float>(-3.0 - unitY * 3.0);
    }

    frame->requestedParticleEffect = effectName;
    frame->requestedParticleX = frame->playerWorldX + offsetX;
    frame->requestedParticleY = frame->playerWorldY + offsetY;
}

// ======= Color grade (day/night + weather tint) =======
// GameModuleApi.h v36 -> v37 (item N4-GRADE) added a real per-frame
// scene-lighting write field -- BeTileGridFrame::hasRequestedGradeTemperature/
// requestedGradeTemperature, hasRequestedGradeTint/requestedGradeTint,
// hasRequestedGradeSaturation/requestedGradeSaturation (see that struct's
// own doc comment). Before this, updateDayNightCycle()/updateWeather()
// tracked real day/night + weather state but had nowhere on the ABI to
// actually tint the rendered scene with it -- PORTING_PLAN.md's own
// js/world.js row named exactly this gap. This closes it by driving the
// three new fields FROM the day/night flag state above, every frame.
//
// js/render.js's own night treatment (lines ~2735-2754, "Day/Night
// lighting with proper light source cutouts") is a screen-space alpha
// overlay: a `rgba(5,8,28, nightAlpha*0.82)` fill blended over the whole
// canvas (then punched with light-source cutouts, which this pass does
// not attempt to reproduce -- see the doc comment below). `nightAlpha`
// is js/world.js's own getNightAlpha() (lines 38-45): 0 across the whole
// day window (0.2-0.8), a SMOOTH linear fade across dusk (0.8-0.867) and
// dawn (0.133-0.2), and 1 through full night -- transcribed here as
// nightAlpha(), rather than reusing daynight::isNight()/isDay() (whose
// own doc comment already explains those two functions encode
// activities.js's fishing gate, a DIFFERENT, deliberately-narrower pair
// of boundaries with a "neither" band -- the wrong boundaries for a
// smoothly-blended visual tint).
//
// (5,8,28) has no meaningful red/green split (5 vs 8) but is heavily
// blue-dominant -- i.e. "cooler" in exactly the sense this ABI's own
// `temperature` knob (-1 cool/blue, +1 warm/orange) describes, so
// nightAlpha drives `temperature` negative. There is no ABI knob for
// "blend toward an arbitrary flat color" (see GameModuleApi.h's own
// v36->v37 comment: three knobs -- temperature/tint/saturation -- not a
// LUT or a lift/gamma/gain corrector), so the alpha-overlay's darkening
// itself is NOT reproduced here -- only its color cast is. `tint`
// (-1 green/+1 magenta) is left at a small, fixed negative (green) lean,
// since G(8) is slightly above R(5) in the source color; the effect is
// minor next to the dominant blue shift. `saturation` is pulled down
// moderately at night (real night vision reads as less saturated,
// scotopic-vision desaturation being the closest real-world analogue to
// "dark blue overlay" a pure color-balance knob can express).
//
// Weather (fog specifically, per this item's own scope note) adds a
// small additional desaturation on top -- js/effects.js's own fog
// treatment is a separate screen-space haze layer this ABI has no
// equivalent primitive for either, so (matching the day/night tint
// above) only a modest color-grade approximation is attempted, not a
// reproduction of the haze itself.
constexpr double kNightTemperature = -0.55;
constexpr double kNightTint = -0.08;
constexpr double kNightSaturationDrop = 0.30;
constexpr double kFogSaturationDrop = 0.15;

// js/world.js's getNightAlpha() (lines 38-45), transcribed exactly --
// see this section's own doc comment above for why isNight()/isDay()
// (this file's OTHER day/night boundary pair, for fishing) aren't reused.
double nightAlpha(double t) {
    if (t >= 0.2 && t <= 0.8) return 0.0;                          // full day
    if (t > 0.8 && t <= 0.867) return (t - 0.8) / 0.067;           // dusk fade in
    if (t > 0.867 || t <= 0.133) return 1.0;                       // full night
    if (t > 0.133 && t < 0.2) return 1.0 - (t - 0.133) / 0.067;    // dawn fade out
    return 0.0;
}

void updateColorGrade(BeTileGridFrame* frame) {
    const double alpha = nightAlpha(currentGameTime(frame));

    double saturation = 1.0 - kNightSaturationDrop * alpha;
    if (currentWeather(frame) == kFog) saturation -= kFogSaturationDrop;
    saturation = std::fmax(0.0, std::fmin(1.0, saturation));

    frame->hasRequestedGradeTemperature = 1;
    frame->requestedGradeTemperature = static_cast<float>(kNightTemperature * alpha);
    frame->hasRequestedGradeTint = 1;
    frame->requestedGradeTint = static_cast<float>(kNightTint * alpha);
    frame->hasRequestedGradeSaturation = 1;
    frame->requestedGradeSaturation = static_cast<float>(saturation);
}

} // namespace daynight

// Walks the player's own live ABI position against the CURRENT zone's real
// (cached, C++-side) portal markers every frame, and fires a real
// requestedLevelPath swap the moment one matches -- see the
// "======= Zone transitions =======" section's own doc comment above for
// the full mechanism.
void handleZoneTransition(BeTileGridFrame* frame) {
    using namespace zonetransition;

    resumeActiveZoneFromSaveIfNeeded(frame); // first frame only -- see its own doc comment above

    if (cooldownFrames() > 0) {
        --cooldownFrames();
        return;
    }

    const TileGrid* current = cachedZone(activeZoneIdRef());
    if (current == nullptr) return; // activeZoneIdRef() itself is always a known slug; defensive only

    const float px = frame->playerWorldX;
    const float py = frame->playerWorldY;
    for (const TileMarker& m : current->markers) {
        if (m.kind != "portal") continue;
        const float dx = px - m.position.x;
        const float dy = py - m.position.y;
        if (dx * dx + dy * dy > kPortalTriggerRadiusWorld * kPortalTriggerRadiusWorld) continue;

        const std::string targetZone = m.properties.value("targetZone", std::string());
        if (targetZone.empty()) continue; // a portal authored with no targetZone yet -- nothing to do

        if (requestZoneSwap(frame, targetZone)) {
            toastScratch() = m.name.empty() ? ("Entering " + targetZone + "...") : (m.name + "...");
            frame->requestedToastText = toastScratch().c_str();
            // js/effects.js's Weather.forceChange() is called on every
            // zone entry (js/zones.js's own enterZone()) so the new
            // zone's weather is recomputed against ITS OWN name/isIndoor
            // state right away rather than carrying over whatever the
            // PREVIOUS zone happened to be showing until the next
            // in-game day rolls over.
            daynight::forceChange();
        }
        return; // at most one transition per frame
    }
}

// ======= Fishing =======
// Transcribed from js/activities.js's FISH_TABLE (lines 99-139) and
// startFish()/catchFish() (lines 447-500, 700-717), and js/input.js's own
// tackle-menu wiring (lines 482-486, openFishingMenu() at
// js/activities.js line 430).
//
// `timeOfDay`/`weather` columns USED to be a real, documented gap ("no
// day/night or weather state is tracked anywhere in this port," treating
// every fish as always in season) -- CLOSED now that the
// "======= Day/Night cycle + Weather =======" section above tracks both
// as real host-flag state. `timeOfDay` transcribes js's own
// 'day'/'night'/unset-means-any column (js/activities.js lines 111-138)
// via daynight::isDay()/isNight() on the SAME gameTime flag the cycle
// above advances; `weatherMask` transcribes js's own `weather:[...]`
// array (same lines) as a bitmask over daynight::WeatherKind, 0 meaning
// "no weather key in the JS, i.e. any weather" -- matching
// `!f.weather || f.weather.includes(currentWeatherType)`'s own OR-with-
// unset shape (js/activities.js line 471) exactly. Everything else --
// minLvl, tackle, zones, xp, rarity -- is real, transcribed from the
// JS's own numbers, unchanged from before.
//
// FISH_TABLE's own `zones` column USED to be a second real gap (there was
// no way to read which zone/level is currently active from
// BeTileGridFrame) -- closed now that activeZoneId() (see the
// "======= Zone transitions =======" section above) gives this plugin a
// real answer. `zones` transcribes js/activities.js's own array 1:1 as a
// bitmask, where bit i is js's own full `zoneIndex` i (0=Ashenveil,
// 1=Ashwood Vale/this port's "ashen_moor", 2=Iron Peaks/"iron_peaks",
// 3=Cursed Marshes/"cursed_marshes" -- matching `f.zones.includes(zoneIndex)`,
// js/activities.js line 466, and js/quests.js's own "z=1->Ashwood Vale"
// comment). Zone 4 (Obsidian Depths/"obsidian_depths") never appears in
// ANY fish's own `zones` array in the JS source (checked) -- a real JS
// quirk (that biome has no fish at all), preserved rather than "fixed".
enum FishTackle {
    kTackleBait = 1 << 0,
    kTackleFly = 1 << 1,
    kTackleHarpoon = 1 << 2,
};

enum FishZone {
    kZoneAshenveil = 1 << 0,
    kZoneAshenMoor = 1 << 1,   // js zoneIndex 1, "Ashwood Vale"
    kZoneIronPeaks = 1 << 2,   // js zoneIndex 2
    kZoneCursedMarshes = 1 << 3, // js zoneIndex 3
    kZoneAllFour = kZoneAshenveil | kZoneAshenMoor | kZoneIronPeaks | kZoneCursedMarshes,
};

// js's own `timeOfDay` column values (js/activities.js's own doc comment,
// line 96: "'any'|'day'|'night' (default 'any')").
enum FishTimeOfDay { kFishTimeAny = 0, kFishTimeDay = 1, kFishTimeNight = 2 };

struct FishEntry {
    const char* rawItemId;
    const char* cookedItemId; // js/activities.js's own COOKED map (line 141)
    int minLevel;
    int tackleMask;
    int zoneMask; // FishZone bits -- js/activities.js FISH_TABLE's own "zones" column
    double xp;
    double rarity;
    int timeOfDay = kFishTimeAny;    // js's own `timeOfDay` column
    int weatherMask = 0;             // bitmask over daynight::WeatherKind; 0 = js's own unset "any weather"
};

constexpr FishEntry kFishTable[] = {
    // Standard fish (any time, any weather) -- js/activities.js lines 101-108
    {"raw_shrimp", "cooked_shrimp", 1, kTackleBait, kZoneAllFour, 10.0, 1.0},
    {"raw_trout", "cooked_trout", 5, kTackleBait | kTackleFly, kZoneAllFour, 50.0, 0.75},
    {"raw_salmon", "cooked_salmon", 10, kTackleFly, kZoneAllFour, 70.0, 0.65},
    {"raw_pike", "cooked_pike", 15, kTackleBait | kTackleFly, kZoneAshenMoor | kZoneIronPeaks | kZoneCursedMarshes,
     90.0, 0.55},
    {"raw_tuna", "cooked_tuna", 20, kTackleHarpoon, kZoneIronPeaks | kZoneCursedMarshes, 115.0, 0.45},
    {"raw_swordfish", "cooked_swordfish", 35, kTackleHarpoon, kZoneIronPeaks | kZoneCursedMarshes, 155.0, 0.30},
    {"raw_shark", "cooked_shark", 50, kTackleHarpoon, kZoneCursedMarshes, 220.0, 0.15},
    {"raw_leviathan", "cooked_leviathan", 60, kTackleHarpoon, kZoneCursedMarshes, 300.0, 0.08},
    // Day-only fish -- lines 111-114. weather:[0] / weather:[0,1] ->
    // W_CLEAR / W_CLEAR|W_RAIN, matching this file's own header comment's
    // W_* bit values.
    {"raw_sunscale", "cooked_sunscale", 5, kTackleBait | kTackleFly, kZoneAshenveil | kZoneAshenMoor | kZoneIronPeaks,
     45.0, 0.70, kFishTimeDay, 1 << daynight::kClear},
    {"raw_gilded_carp", "cooked_gilded_carp", 22, kTackleFly, kZoneAllFour, 100.0, 0.40, kFishTimeDay,
     (1 << daynight::kClear) | (1 << daynight::kRain)},
    // Night-only fish -- lines 117-122
    {"raw_moonshadow", "cooked_moonshadow", 25, kTackleFly, kZoneAshenMoor | kZoneIronPeaks | kZoneCursedMarshes,
     130.0, 0.35, kFishTimeNight, (1 << daynight::kClear) | (1 << daynight::kFog)},
    {"raw_ghostfin", "cooked_ghostfin", 40, kTackleBait, kZoneIronPeaks | kZoneCursedMarshes, 175.0, 0.20,
     kFishTimeNight, (1 << daynight::kClear) | (1 << daynight::kRain) | (1 << daynight::kHeavyRain)},
    {"raw_shadowcrawler", "cooked_shadowcrawler", 55, kTackleHarpoon, kZoneCursedMarshes, 260.0, 0.10, kFishTimeNight},
    // Rain fish -- lines 125-130
    {"raw_stormcatch", "cooked_stormcatch", 18, kTackleBait | kTackleFly,
     kZoneAshenveil | kZoneAshenMoor | kZoneIronPeaks, 95.0, 0.45, kFishTimeAny,
     (1 << daynight::kRain) | (1 << daynight::kHeavyRain)},
    {"raw_raindrop_dace", "cooked_raindrop_dace", 8, kTackleBait, kZoneAllFour, 60.0, 0.65, kFishTimeAny,
     (1 << daynight::kRain) | (1 << daynight::kHeavyRain)},
    {"raw_torrent_fin", "cooked_torrent_fin", 45, kTackleHarpoon, kZoneIronPeaks | kZoneCursedMarshes, 195.0, 0.18,
     kFishTimeAny, 1 << daynight::kHeavyRain},
    // Fog fish -- lines 133-138
    {"raw_mistwalker", "cooked_mistwalker", 12, kTackleFly, kZoneAshenveil | kZoneAshenMoor | kZoneIronPeaks, 80.0,
     0.50, kFishTimeAny, 1 << daynight::kFog},
    {"raw_phantom_crab", "cooked_phantom_crab", 30, kTackleBait, kZoneAshenMoor | kZoneIronPeaks | kZoneCursedMarshes,
     145.0, 0.28, kFishTimeAny, 1 << daynight::kFog},
    {"raw_veilfish", "cooked_veilfish", 50, kTackleHarpoon | kTackleFly, kZoneCursedMarshes, 240.0, 0.12,
     kFishTimeNight, 1 << daynight::kFog},
};
constexpr int kFishTableSize = sizeof(kFishTable) / sizeof(kFishTable[0]);

// activeZoneId() -> FishZone bit, or 0 for a zone with no fish at all
// (Obsidian Depths, every interior/dungeon) -- see this section's own doc
// comment above.
int currentFishZoneMask() {
    const std::string& zone = activeZoneId();
    if (zone == "ashenveil") return kZoneAshenveil;
    if (zone == "ashen_moor") return kZoneAshenMoor;
    if (zone == "iron_peaks") return kZoneIronPeaks;
    if (zone == "cursed_marshes") return kZoneCursedMarshes;
    return 0;
}

const char* const kFishingSpotKinds[] = {"fishing_spot", "fishing_spot_2"};

void handleFishing(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    if (!findAdjacentTileOfKind(frame, kFishingSpotKinds, 2, nullptr, nullptr, nullptr)) return;

    // Tackle: the JS shows a 3-option context menu (Fish (Bait)/(Fly)/
    // (Harpoon), js/input.js lines 482-486), each gated on carrying that
    // tackle ITEM (openFishingMenu(), js/activities.js line 430 -- checked,
    // never consumed). No menu primitive exists here, so this checks all
    // three in the JS's own menu order and fishes with the first one
    // actually in the player's inventory.
    int tackleMask = 0;
    if (countInInventory(frame, "bait") > 0)
        tackleMask = kTackleBait;
    else if (countInInventory(frame, "fly_lure") > 0)
        tackleMask = kTackleFly;
    else if (countInInventory(frame, "harpoon") > 0)
        tackleMask = kTackleHarpoon;
    if (tackleMask == 0) {
        toastScratch() = "You need bait, a fly lure, or a harpoon to fish here.";
        frame->requestedToastText = toastScratch().c_str();
        return;
    }

    const int fishLevel = readSkillLevel(frame, GrimstoneSkill::Fishing);
    const int zoneMask = currentFishZoneMask();
    // js/activities.js's startFish() own time-of-day classification
    // (lines 457-459) -- reused via daynight::isNight()/isDay() rather
    // than reimplemented, and the SAME gameTime flag
    // daynight::updateDayNightCycle() advances every frame above.
    const double gameTime = daynight::currentGameTime(frame);
    const bool isNight = daynight::isNight(gameTime);
    const bool isDay = daynight::isDay(gameTime);
    const int weatherNow = daynight::currentWeather(frame);

    // Eligible = level + tackle + zone + time-of-day + weather -- both
    // gaps this function's own doc comment above used to name are now
    // real.
    int eligibleIdx[kFishTableSize];
    int eligibleCount = 0;
    double totalWeight = 0.0;
    for (int i = 0; i < kFishTableSize; ++i) {
        const FishEntry& f = kFishTable[i];
        if (fishLevel < f.minLevel) continue;
        if ((f.tackleMask & tackleMask) == 0) continue;
        if ((f.zoneMask & zoneMask) == 0) continue;
        if (f.timeOfDay == kFishTimeNight && !isNight) continue;
        if (f.timeOfDay == kFishTimeDay && !isDay) continue;
        if (f.weatherMask != 0 && ((f.weatherMask >> weatherNow) & 1) == 0) continue;
        eligibleIdx[eligibleCount++] = i;
        totalWeight += f.rarity * (1.0 + fishLevel * 0.01); // js startFish() line 489
    }
    if (eligibleCount == 0) {
        toastScratch() = "Nothing is biting here with that tackle.";
        frame->requestedToastText = toastScratch().c_str();
        return;
    }

    // Weighted random pick -- js/activities.js's own startFish() (lines
    // 489-495): roll a uniform value over totalWeight, walk the eligible
    // list subtracting each entry's own weight. frame->randomUint32 (v27->
    // v28 ABI) draws from the SAME seeded stream game.lua's own be.random()
    // would, in place of the JS's Math.random() -- not std::rand().
    double roll = totalWeight;
    if (frame->randomUint32 != nullptr) {
        constexpr double kUint32Max = 4294967295.0;
        const double unit = static_cast<double>(frame->randomUint32()) / kUint32Max;
        roll = unit * totalWeight;
    }
    int chosen = eligibleIdx[0];
    for (int k = 0; k < eligibleCount; ++k) {
        const FishEntry& f = kFishTable[eligibleIdx[k]];
        roll -= f.rarity * (1.0 + fishLevel * 0.01);
        if (roll <= 0.0) {
            chosen = eligibleIdx[k];
            break;
        }
    }

    const FishEntry& caught = kFishTable[chosen];
    queueItemGrant(caught.rawItemId, 1);
    queueXpGrant(GrimstoneSkill::Fishing, caught.xp);
    toastScratch() = std::string("You catch a ") + caught.rawItemId + ".";
    frame->requestedToastText = toastScratch().c_str();
    // Deliberate simplification, same spirit as
    // handleMiningAndWoodcutting()'s own doc comment above: the JS runs a
    // full reel-in minigame (a tension bar, a moving catch zone, a bite
    // timeout) plus a 25% chance to temporarily deplete the fishing spot
    // (catchFish(), js/activities.js lines 700-717) before granting
    // anything. Neither the minigame UI nor a per-spot depletion timer
    // exist here, so a qualifying interact press grants the catch directly
    // -- a timed/depletion variant is a straightforward follow-up via the
    // host's own timer store, noted here rather than silently dropped.
}

// ======= Cooking =======
// Transcribed from js/activities.js's openCooker() (lines 2396-2452).
void handleCooking(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    const char* const kCookingFireKinds[] = {"cooking_fire"};
    if (!findAdjacentTileOfKind(frame, kCookingFireKinds, 1, nullptr, nullptr, nullptr)) return;

    const int cookLevel = readSkillLevel(frame, GrimstoneSkill::Cooking);

    // Fish recipes: openCooker() builds these FROM FISH_TABLE directly
    // (Math.floor(f.xp*1.2) xp, Math.max(1, f.minLvl-2) reqLvl) rather than
    // a second hand-authored table -- this reproduces that exactly off the
    // SAME kFishTable above instead of duplicating fish data a second time.
    // Deliberate simplification versus the JS's own menu (which lists every
    // craftable recipe at once): this cooks the FIRST fish (kFishTable's own
    // order) the player is both carrying and level-qualified to cook, one
    // per interact press -- matching handleMiningAndWoodcutting()'s own
    // "one grant per press" rule.
    for (int i = 0; i < kFishTableSize; ++i) {
        const FishEntry& f = kFishTable[i];
        if (countInInventory(frame, f.rawItemId) < 1) continue;
        const int reqLvl = (f.minLevel - 2 > 1) ? (f.minLevel - 2) : 1;
        if (cookLevel < reqLvl) continue;
        const double cookXp = std::floor(f.xp * 1.2);
        queueItemGrant(f.rawItemId, -1);
        queueItemGrant(f.cookedItemId, 1);
        queueXpGrant(GrimstoneSkill::Cooking, cookXp);
        toastScratch() = std::string("You cook a ") + f.cookedItemId + ".";
        frame->requestedToastText = toastScratch().c_str();
        return;
    }

    // Meat/egg recipes -- js/activities.js's own hand-authored meatRecipes
    // array (lines 2413-2419). CookRecipe supports up to 2 required
    // ingredients (Hard Boiled Egg needs egg + water_bucket) and an optional
    // "extraReturn" item (the emptied water_bucket comes back as a
    // wooden_bucket).
    struct CookRecipe {
        const char* input1;
        int qty1;
        const char* input2; // "" if unused
        int qty2;
        const char* output;
        double xp;
        int reqLvl;
        const char* extraReturnItemId; // "" if none
    };
    constexpr CookRecipe kMeatCookRecipes[] = {
        {"raw_chicken", 1, "", 0, "cooked_chicken", 12.0, 1, ""},
        {"raw_pork", 1, "", 0, "cooked_pork", 16.0, 5, ""},
        {"raw_beef", 1, "", 0, "cooked_beef", 22.0, 10, ""},
        {"egg", 1, "water_bucket", 1, "hard_boiled_egg", 10.0, 1, "wooden_bucket"},
    };
    constexpr int kMeatCookRecipeCount = sizeof(kMeatCookRecipes) / sizeof(kMeatCookRecipes[0]);

    for (int i = 0; i < kMeatCookRecipeCount; ++i) {
        const CookRecipe& r = kMeatCookRecipes[i];
        if (countInInventory(frame, r.input1) < r.qty1) continue;
        if (r.input2[0] != '\0' && countInInventory(frame, r.input2) < r.qty2) continue;
        if (cookLevel < r.reqLvl) continue;
        queueItemGrant(r.input1, -r.qty1);
        if (r.input2[0] != '\0') queueItemGrant(r.input2, -r.qty2);
        queueItemGrant(r.output, 1);
        if (r.extraReturnItemId[0] != '\0') queueItemGrant(r.extraReturnItemId, 1);
        queueXpGrant(GrimstoneSkill::Cooking, r.xp);
        toastScratch() = std::string("You cook a ") + r.output + ".";
        frame->requestedToastText = toastScratch().c_str();
        return;
    }

    toastScratch() = "You have nothing to cook here.";
    frame->requestedToastText = toastScratch().c_str();
}

// ======= Smithing: Smelting (ore -> bar) =======
// Transcribed from js/activities.js's openSmelter() (lines 2349-2395).
// Deliberate simplification versus the JS's own menu: this smelts the
// FIRST recipe (table order below, lowest tier first) whose ingredients
// and level are both satisfied, one per interact press -- same "one grant
// per press, no recipe-picker UI" rule handleCooking() above already
// applies.
struct SmeltRecipe {
    const char* input1;
    int qty1;
    const char* input2; // "" if unused
    int qty2;
    const char* output;
    double xp;
    int reqLvl;
};
constexpr SmeltRecipe kSmeltRecipes[] = {
    {"copper_ore", 1, "", 0, "bronze_bar", 6.2, 1},
    {"iron_ore", 1, "coal", 1, "iron_bar", 12.5, 15},
    {"iron_bar", 1, "coal", 3, "steel_bar", 35.0, 30},
    {"gold_ore", 1, "coal", 2, "gold_bar", 22.5, 40},
    {"mithril_ore", 1, "coal", 4, "mithril_bar", 50.0, 55},
};
constexpr int kSmeltRecipeCount = sizeof(kSmeltRecipes) / sizeof(kSmeltRecipes[0]);

void handleSmelting(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    const char* const kSmelterKinds[] = {"smelter"};
    if (!findAdjacentTileOfKind(frame, kSmelterKinds, 1, nullptr, nullptr, nullptr)) return;

    const int smithLevel = readSkillLevel(frame, GrimstoneSkill::Smithing);
    for (int i = 0; i < kSmeltRecipeCount; ++i) {
        const SmeltRecipe& r = kSmeltRecipes[i];
        if (countInInventory(frame, r.input1) < r.qty1) continue;
        if (r.input2[0] != '\0' && countInInventory(frame, r.input2) < r.qty2) continue;
        if (smithLevel < r.reqLvl) continue;
        queueItemGrant(r.input1, -r.qty1);
        if (r.input2[0] != '\0') queueItemGrant(r.input2, -r.qty2);
        queueItemGrant(r.output, 1);
        queueXpGrant(GrimstoneSkill::Smithing, r.xp);
        toastScratch() = std::string("You smelt a ") + r.output + ".";
        frame->requestedToastText = toastScratch().c_str();
        return;
    }
    toastScratch() = "You don't have the materials to smelt anything here.";
    frame->requestedToastText = toastScratch().c_str();
}

// ======= Smithing: Forging (bars -> equipment) =======
// Transcribed from js/activities.js's openAnvil() (lines 2515-2590) --
// same "first satisfied recipe in table order, one per press" rule as
// handleSmelting() above. `outputQty` carries the JS's own arrows-craft-in-
// stacks-of-20 special case (line 2576: `r.output.endsWith('_arrows') ?
// 20 : 1`).
struct ForgeRecipe {
    const char* input1;
    int qty1;
    const char* input2; // "" if unused
    int qty2;
    const char* output;
    int outputQty;
    double xp;
    int reqLvl;
};
constexpr ForgeRecipe kForgeRecipes[] = {
    // Weapons
    {"bronze_bar", 2, "", 0, "bronze_sword", 1, 25.0, 1},
    {"bones", 4, "", 0, "bone_dagger", 1, 15.0, 5},
    {"bronze_bar", 3, "", 0, "war_axe", 1, 35.0, 10},
    {"iron_bar", 2, "", 0, "iron_sword", 1, 60.0, 20},
    {"steel_bar", 2, "", 0, "steel_sword", 1, 100.0, 40},
    {"mithril_bar", 2, "", 0, "mithril_sword", 1, 160.0, 60},
    // Shields
    {"bronze_bar", 2, "", 0, "bronze_shield", 1, 24.0, 5},
    {"iron_bar", 2, "", 0, "iron_shield", 1, 55.0, 22},
    {"steel_bar", 3, "", 0, "kite_shield", 1, 90.0, 45},
    // Helmets
    {"bronze_bar", 2, "", 0, "bronze_helm", 1, 22.0, 3},
    {"iron_bar", 2, "", 0, "iron_helm", 1, 50.0, 18},
    {"steel_bar", 2, "", 0, "steel_helm", 1, 85.0, 35},
    // Body armour
    {"bronze_bar", 4, "", 0, "bronze_plate", 1, 40.0, 6},
    {"iron_bar", 4, "", 0, "iron_plate", 1, 80.0, 24},
    {"steel_bar", 4, "", 0, "steel_plate", 1, 130.0, 42},
    {"mithril_bar", 4, "", 0, "mithril_plate", 1, 200.0, 62},
    // Legs
    {"bronze_bar", 3, "", 0, "bronze_legs", 1, 32.0, 4},
    {"iron_bar", 3, "", 0, "iron_legs", 1, 65.0, 20},
    {"steel_bar", 3, "", 0, "steel_legs", 1, 105.0, 38},
    // Ammo (crafted x20 per the JS's own special case, see above)
    {"bronze_bar", 1, "oak_log", 1, "bronze_arrows", 20, 18.0, 1},
    {"iron_bar", 1, "oak_log", 1, "iron_arrows", 20, 32.0, 16},
};
constexpr int kForgeRecipeCount = sizeof(kForgeRecipes) / sizeof(kForgeRecipes[0]);

void handleForging(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    const char* const kAnvilKinds[] = {"anvil"};
    if (!findAdjacentTileOfKind(frame, kAnvilKinds, 1, nullptr, nullptr, nullptr)) return;

    const int smithLevel = readSkillLevel(frame, GrimstoneSkill::Smithing);
    for (int i = 0; i < kForgeRecipeCount; ++i) {
        const ForgeRecipe& r = kForgeRecipes[i];
        if (countInInventory(frame, r.input1) < r.qty1) continue;
        if (r.input2[0] != '\0' && countInInventory(frame, r.input2) < r.qty2) continue;
        if (smithLevel < r.reqLvl) continue;
        queueItemGrant(r.input1, -r.qty1);
        if (r.input2[0] != '\0') queueItemGrant(r.input2, -r.qty2);
        queueItemGrant(r.output, r.outputQty);
        queueXpGrant(GrimstoneSkill::Smithing, r.xp);
        toastScratch() = std::string("You forge a ") + r.output + ".";
        frame->requestedToastText = toastScratch().c_str();
        return;
    }
    toastScratch() = "You don't have the materials to forge anything here.";
    frame->requestedToastText = toastScratch().c_str();
}

// ======= Farming =======
// Transcribed from js/activities.js's tillTile()/plantSeed()/
// harvestHomeCrop() (lines 2048-2110) and js/zones.js's own farm-plot
// growth-stage derivation (makeHomeMap()'s saved-plot restore, lines
// 2576-2597, and startHomeGrowthTick(), lines 2644-2662) plus js/world.js's
// own seed ITEMS entries (lines 453-457) for the real per-crop grow times.
//
// Unlike mining/woodcutting/fishing/cooking/smithing, farming is
// STATEFUL OVER TIME (a plot progresses tilled -> seedling -> (halfway)
// growing -> grown across real minutes, not on a single interact press),
// which is exactly what BeTileGridFrame::timers/requestedTimerStarts (v25
// -> v26 ABI, TileGridTimerStore.h) exists for -- this file's first use of
// it. Each planted plot gets its own host-ticked timer keyed
// "farmplot_grow_<cellX>_<cellY>", started for the seed's own growTime in
// SECONDS (the JS's own ITEMS[...].growTime is milliseconds, converted
// once in kSeedTable below). Since there is no plugin-owned persistent
// struct anywhere in this file (every other system reads host flags
// per-frame and keeps no state of its own), the total grow time, WHICH
// seed was planted, and the plot's own last-painted stage are each kept as
// their own flag ("farmplot_growtime_<cell>"/"farmplot_crop_<cell>"/
// "farmplot_stage_<cell>") so a stage change only repaints the tile when
// the DERIVED stage (from timer.remainingSeconds vs growTime) actually
// differs from the last one painted -- not every single frame.
struct SeedEntry {
    const char* seedItemId;
    const char* cropItemId;
    const char* cropTileKindId; // registerGrimstoneTileKinds(), GrimstoneGame.cpp
    double growTimeSeconds;     // js/world.js's own ITEMS[...].growTime / 1000
};
constexpr SeedEntry kSeedTable[] = {
    {"wheat_seed", "wheat", "home_wheat", 5.0 * 60.0},
    {"turnip_seed", "turnip", "home_turnip", 4.0 * 60.0},
    {"carrot_seed", "carrot", "home_carrot", 6.0 * 60.0},
    {"potato_seed", "potato", "home_potato", 8.0 * 60.0},
    {"onion_seed", "onion", "home_onion", 5.0 * 60.0},
};
constexpr int kSeedTableCount = sizeof(kSeedTable) / sizeof(kSeedTable[0]);

constexpr double kFarmStageTilled = 0.0;
constexpr double kFarmStageSeedling = 1.0;
constexpr double kFarmStageGrowing = 2.0;
constexpr double kFarmStageGrown = 3.0;

std::string farmCellKey(int cellX, int cellY) {
    return std::to_string(cellX) + "_" + std::to_string(cellY);
}

void handleTilling(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    // js's own tillTile() (line 2055): currentMap.name === 'YOUR HOMESTEAD'.
    // Real fix, not a simplification any more -- activeZoneId() (see the
    // "======= Zone transitions =======" section above) is a real read of
    // which zone this plugin last swapped into, closing the gap this
    // comment used to document (no current-zone/level-name read existed on
    // BeTileGridFrame at all).
    if (activeZoneId() != "homestead") return;
    int cx, cy;
    const char* const kDirtKinds[] = {"dirt"};
    if (!findAdjacentTileOfKind(frame, kDirtKinds, 1, &cx, &cy, nullptr)) return;

    // js's own tillTile() (line 2050): requires a "hoe" in inventory.
    if (countInInventory(frame, "hoe") < 1) {
        toastScratch() = "You need a Farmer's Hoe to till the soil.";
        frame->requestedToastText = toastScratch().c_str();
        return;
    }
    queueTileEdit(0, cx, cy, "tilled_soil");
    queueXpGrant(GrimstoneSkill::Farming, 3.0);
    toastScratch() = "You till the soil, preparing it for planting.";
    frame->requestedToastText = toastScratch().c_str();
}

void handlePlanting(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    int cx, cy;
    const char* const kTilledSoilKinds[] = {"tilled_soil"};
    if (!findAdjacentTileOfKind(frame, kTilledSoilKinds, 1, &cx, &cy, nullptr)) return;

    // js's own plantSeed() (line 2076): "find any seed in inventory" --
    // just uses the first one found. Mirrored here as "first seed id in
    // kSeedTable's own order the player is carrying at least one of."
    int seedIdx = -1;
    for (int i = 0; i < kSeedTableCount; ++i) {
        if (countInInventory(frame, kSeedTable[i].seedItemId) > 0) {
            seedIdx = i;
            break;
        }
    }
    if (seedIdx < 0) {
        toastScratch() = "You have no seeds to plant.";
        frame->requestedToastText = toastScratch().c_str();
        return;
    }

    const SeedEntry& seed = kSeedTable[seedIdx];
    const std::string cellKey = farmCellKey(cx, cy);

    queueItemGrant(seed.seedItemId, -1);
    queueTileEdit(0, cx, cy, "seedling");
    queueTimerStart(internString("farmplot_grow_" + cellKey), seed.growTimeSeconds);

    BeFlagUpdate growTimeFlag;
    growTimeFlag.key = internString("farmplot_growtime_" + cellKey);
    growTimeFlag.value = seed.growTimeSeconds;
    growTimeFlag.mode = 0; // SET
    flagUpdateBuffer().push_back(growTimeFlag);

    BeFlagUpdate cropFlag;
    cropFlag.key = internString("farmplot_crop_" + cellKey);
    cropFlag.value = static_cast<double>(seedIdx);
    cropFlag.mode = 0;
    flagUpdateBuffer().push_back(cropFlag);

    BeFlagUpdate stageFlag;
    stageFlag.key = internString("farmplot_stage_" + cellKey);
    stageFlag.value = kFarmStageSeedling;
    stageFlag.mode = 0;
    flagUpdateBuffer().push_back(stageFlag);

    queueXpGrant(GrimstoneSkill::Farming, 5.0);
    toastScratch() = std::string("You plant ") + seed.cropItemId + " seeds in the tilled soil.";
    frame->requestedToastText = toastScratch().c_str();
}

// Runs every frame (not gated on interactPressed): derives each active
// plot's own growth stage from its timer's remainingSeconds vs its stored
// growTime, and repaints the tile ONLY when that derived stage differs
// from the last one this system painted (the "farmplot_stage_<cell>"
// flag) -- mirrors js/zones.js's own startHomeGrowthTick() (lines
// 2644-2662) and the saved-plot restore's own two-threshold derivation
// (growTime/2 -> "growing", growTime -> fully grown, lines 2586-2592).
void handleFarmGrowthTick(BeTileGridFrame* frame) {
    static const std::string kGrowKeyPrefix = "farmplot_grow_";

    for (int i = 0; i < frame->timerCount; ++i) {
        const BeTimerState& timer = frame->timers[i];
        if (timer.key == nullptr) continue;
        const std::string key(timer.key);
        if (key.rfind(kGrowKeyPrefix, 0) != 0) continue; // not one of ours

        const std::string cellPart = key.substr(kGrowKeyPrefix.size());
        const size_t sep = cellPart.find('_');
        if (sep == std::string::npos) continue;
        const int cx = std::atoi(cellPart.substr(0, sep).c_str());
        const int cy = std::atoi(cellPart.substr(sep + 1).c_str());
        const std::string cellKey = farmCellKey(cx, cy);

        const double growTime = readFlag(frame, ("farmplot_growtime_" + cellKey).c_str(), 0.0);
        if (growTime <= 0.0) continue;
        const double elapsed = growTime - timer.remainingSeconds;

        double desiredStage = kFarmStageSeedling;
        if (elapsed >= growTime)
            desiredStage = kFarmStageGrown;
        else if (elapsed >= growTime * 0.5)
            desiredStage = kFarmStageGrowing;

        const double storedStage = readFlag(frame, ("farmplot_stage_" + cellKey).c_str(), kFarmStageSeedling);
        if (storedStage == desiredStage) continue;

        if (desiredStage == kFarmStageGrowing) {
            queueTileEdit(0, cx, cy, "crop_growing");
        } else if (desiredStage == kFarmStageGrown) {
            const int seedIdx = static_cast<int>(readFlag(frame, ("farmplot_crop_" + cellKey).c_str(), -1.0));
            if (seedIdx >= 0 && seedIdx < kSeedTableCount) {
                queueTileEdit(0, cx, cy, kSeedTable[seedIdx].cropTileKindId);
            }
        }

        BeFlagUpdate stageUpdate;
        stageUpdate.key = internString("farmplot_stage_" + cellKey);
        stageUpdate.value = desiredStage;
        stageUpdate.mode = 0;
        flagUpdateBuffer().push_back(stageUpdate);
    }
}

void handleHarvesting(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    int cx, cy;
    const char* matchedKind = nullptr;
    const char* const kHomeCropKinds[] = {"home_wheat", "home_turnip", "home_carrot", "home_potato",
                                           "home_onion"};
    if (!findAdjacentTileOfKind(frame, kHomeCropKinds, 5, &cx, &cy, &matchedKind)) return;

    int seedIdx = -1;
    for (int i = 0; i < kSeedTableCount; ++i) {
        if (std::strcmp(matchedKind, kSeedTable[i].cropTileKindId) == 0) {
            seedIdx = i;
            break;
        }
    }
    if (seedIdx < 0) return; // shouldn't happen -- every kHomeCropKinds entry has a kSeedTable match
    const SeedEntry& seed = kSeedTable[seedIdx];

    // js's own harvestHomeCrop() (line 2100): grants the crop item, +15
    // Farming xp, and resets the plot straight back to tilled soil (ready
    // to replant) rather than back to bare dirt.
    queueItemGrant(seed.cropItemId, 1);
    queueXpGrant(GrimstoneSkill::Farming, 15.0);
    queueTileEdit(0, cx, cy, "tilled_soil");

    BeFlagUpdate stageUpdate;
    stageUpdate.key = internString("farmplot_stage_" + farmCellKey(cx, cy));
    stageUpdate.value = kFarmStageTilled;
    stageUpdate.mode = 0;
    flagUpdateBuffer().push_back(stageUpdate);

    toastScratch() = std::string("You harvest some ") + seed.cropItemId + ".";
    frame->requestedToastText = toastScratch().c_str();
}

// ======= Aldermast's quest chain: "The Ashen Seal" / "The Void Shards" =======
// Transcribed from js/zones.js's openWizardDialogue()/openWizardConstellationOffer()
// (lines 6-246). A real, working proof-of-concept for the quest/dialogue
// system, not a full port of the whole wizard conversation tree -- see this
// function group's own doc comments below and PORTING_PLAN.md's own
// js/quests.js row for exactly which JS branches are covered vs. deferred.
//
// State: every JS `questFlags.X` boolean this pass touches becomes a host
// flag (same "1.0/0.0 for true/false" convention skill XP already uses in
// this file). `void_shards_found` is transcribed as a NUMBER (0-4), not a
// boolean, matching the JS's own `questFlags.void_shards_found || 0` usage
// (js/zones.js line 114) -- nothing in THIS port increments it yet, since no
// dungeon-chest-loot system exists anywhere in this file/GrimstoneGame.cpp
// (checked: no "chest"/"loot" handling anywhere in this file) to be the
// source of truth for "the player found a shard." That's a real, separate
// gap (same shape as handleFishing()'s own documented zone-read gap above),
// not something this quest-chain pass invents a workaround for -- the flag
// exists and is read/displayed correctly the moment something else sets it.
//
// Aldermast's own real Grimstone location: js/npcs.js line 670-673 calls
// openWizardDialogue() for T.NPC_WIZARD, and js/zones.js line 476 places
// that tile ONLY inside makeWizardTowerInterior() (the "AETHERIC SPIRE"
// interior reached from Stormcrag Reach) -- NOT Ashenveil. This port's own
// buildWizardTowerInterior() (GrimstoneGame.cpp) already authors this as an
// "npc_spawn" TileMarker rather than a painted tile (the same convention
// buildAshenveilLevel() uses for every named NPC), at a fixed, known world
// position this file hardcodes below.

// js's own three-skill combat average (js/zones.js line 39/216:
// `Math.floor((Attack+Defence+Strength)/3)`), reused for the Void Shards
// offer's own level gate (openWizardConstellationOffer(), line 230).
int aldermastCombatAvg(const BeTileGridFrame* frame) {
    const int atk = readSkillLevel(frame, GrimstoneSkill::Attack);
    const int def = readSkillLevel(frame, GrimstoneSkill::Defence);
    const int str = readSkillLevel(frame, GrimstoneSkill::Strength);
    return (atk + def + str) / 3;
}

// **Real, documented gap**: BeTileMarker (GameModuleApi.h) exposes only
// `kind`/`worldX`/`worldY` -- no name/id survives from TileMarker::name or
// TileMarker::properties across the ABI boundary. So this can't ask "is
// this npc_spawn marker actually Aldermast" by name the way the JS's own
// dialogue dispatch (keyed off which NPC tile the player clicked) can --
// there are several OTHER "npc_spawn" markers in this port (guards/Mira/
// Aldric in Ashenveil, Greta/Aldous/Bertram in Greenfield, GrimstoneGame.cpp
// addNpcMarker()/addNpcSpawnMarker() call sites), each in ITS OWN separate
// level. This matches on the EXACT world position
// buildWizardTowerInterior() places its own marker at (W=22, H=26, mid=11,
// midDividerY=floor(26*0.45)=11, tf=10, cRow=6 -> marker at
// (mid+2+0.5, cRow-1+0.5) = (13.5, 5.5), GrimstoneGame.cpp) -- correct as
// long as no other zone's own npc_spawn marker happens to land on that
// exact float coordinate (checked every add*NpcMarker() call site in
// GrimstoneGame.cpp; none do). A real, position-based workaround for a real
// ABI gap, not a guess -- same "real gap, found while wiring this up, not a
// simplification this port can paper over" spirit as handleCombatAttack()'s
// own doc comment above.
constexpr float kAldermastMarkerWorldX = 13.5f;
constexpr float kAldermastMarkerWorldY = 5.5f;
constexpr float kAldermastInteractRadius = 1.5f; // same adjacency spirit as kMeleeRangeWorldUnits

bool playerNearAldermast(const BeTileGridFrame* frame) {
    bool markerPresent = false;
    for (int i = 0; i < frame->markerCount; ++i) {
        const BeTileMarker& m = frame->markers[i];
        if (m.kind == nullptr || std::strcmp(m.kind, "npc_spawn") != 0) continue;
        if (std::fabs(m.worldX - kAldermastMarkerWorldX) > 0.01f) continue;
        if (std::fabs(m.worldY - kAldermastMarkerWorldY) > 0.01f) continue;
        markerPresent = true;
        break;
    }
    if (!markerPresent) return false; // not currently in the Wizard Tower interior at all

    const float dx = frame->playerWorldX - kAldermastMarkerWorldX;
    const float dy = frame->playerWorldY - kAldermastMarkerWorldY;
    return (dx * dx + dy * dy) <= kAldermastInteractRadius * kAldermastInteractRadius;
}

void queueFlagSet(const char* key, double value) {
    BeFlagUpdate update;
    update.key = key;
    update.value = value;
    update.mode = 0; // SET
    flagUpdateBuffer().push_back(update);
}

// ======= Objectives (Part 2) =======
// Drained into frame->requestedObjectiveUpdates at the end of
// updateGrimstoneRuntime(), same array-write-back shape every other system
// in this file already uses for its own scratch buffer.
std::vector<BeObjectiveState>& objectiveUpdateBuffer() {
    static std::vector<BeObjectiveState> buf;
    return buf;
}
void queueObjectiveUpdate(const char* id, const std::string& text, bool complete) {
    BeObjectiveState obj;
    obj.id = id;
    obj.text = internString(text);
    obj.complete = complete ? 1 : 0;
    objectiveUpdateBuffer().push_back(obj);
}

// Live text-override scratch (Part 3's own "requestedDialogueTextOverride-
// style live state" hook) -- separate from toastScratch() above since a
// frame that both toasts AND has an active Aldermast dialogue node open
// would otherwise stomp one buffer with the other.
std::string& dialogueOverrideScratch() {
    static std::string buf;
    return buf;
}

// Updates the "ashen_seal"/"void_shards" TileGridObjectiveLog entries only
// when the DERIVED stage/count actually changed since the last frame this
// function updated them -- same "gate on a real transition, not every
// frame" discipline handleFarmGrowthTick() already establishes above,
// tracked via its own small set of "aldermast_obj_*" flags (same store,
// just used as this function's own scratch instead of player-visible
// state -- no different from farming's "farmplot_stage_<cell>" flags).
void updateAldermastObjectives(BeTileGridFrame* frame) {
    const bool accepted = readFlag(frame, "ashen_seal_accepted", 0.0) != 0.0;
    const bool found = readFlag(frame, "ashen_seal_found", 0.0) != 0.0;
    const bool returned = readFlag(frame, "ashen_seal_returned", 0.0) != 0.0;

    int sealStage = 0; // 0 = not tracked yet (quest not accepted)
    if (returned) sealStage = 3;
    else if (found) sealStage = 2;
    else if (accepted) sealStage = 1;

    if (sealStage != 0) {
        const double storedStage = readFlag(frame, "aldermast_obj_seal_stage", -1.0);
        if (static_cast<double>(sealStage) != storedStage) {
            if (sealStage == 1) {
                queueObjectiveUpdate("ashen_seal", "Retrieve the Ashen Seal from the Catacombs", false);
            } else if (sealStage == 2) {
                queueObjectiveUpdate("ashen_seal", "Return the Seal to Aldermast", false);
            } else {
                queueObjectiveUpdate("ashen_seal", "The Ashen Seal has been returned to Aldermast.", true);
            }
            queueFlagSet("aldermast_obj_seal_stage", static_cast<double>(sealStage));
        }
    }

    const bool constellationAccepted = readFlag(frame, "constellation_accepted", 0.0) != 0.0;
    if (constellationAccepted) {
        const bool done = readFlag(frame, "constellation_done", 0.0) != 0.0;
        const int found4 = done ? 4 : static_cast<int>(readFlag(frame, "void_shards_found", 0.0));
        const double storedCount = readFlag(frame, "aldermast_obj_void_count", -1.0);
        const double storedDone = readFlag(frame, "aldermast_obj_void_done", 0.0);
        const bool doneChanged = (done ? 1.0 : 0.0) != storedDone;
        if (static_cast<double>(found4) != storedCount || doneChanged) {
            if (done) {
                queueObjectiveUpdate("void_shards", "The Void Shards have been returned to Aldermast.", true);
            } else {
                queueObjectiveUpdate("void_shards", "Find the Void Shards (" + std::to_string(found4) + "/4)", false);
            }
            queueFlagSet("aldermast_obj_void_count", static_cast<double>(found4));
            queueFlagSet("aldermast_obj_void_done", done ? 1.0 : 0.0);
        }
    }
}

// ======= Dialogue start (Part 4 wiring) =======
// On interactPressed near Aldermast's own marker, with no dialog already
// showing (activeDialogLayoutName check -- the v24->v25 DIALOGLAYER field,
// covers ANY dialog source, not just tree-driven ones), pushes exactly the
// tree that matches the JS's own top-level if-chain in openWizardDialogue()/
// openWizardConstellationOffer() for the player's CURRENT quest state.
// Real, hand-authored branch coverage vs. deferred, per PORTING_PLAN.md:
// covered -- the initial offer (3 choices), the accepted-not-found
// reminder, the found-it hand-in (grants ring_of_warding), the found-but-
// lost-it fallback, the Void Shards offer (both the undertrained refusal
// and the real accept/not-yet offer), and a minimal in-progress reminder.
// Deferred -- the constellation_done Grimoire hand-off and beyond (JS lines
// 130-184), the always-available lore options and post-Grimoire idle chat
// (JS lines 186-208), and the void_shards_found==4-but-not-yet-handed-in
// "I'm gathering them" branch (JS lines 118-145) -- once constellation_done
// is set this file has nothing further to offer and simply doesn't open a
// dialogue at all, rather than silently mis-routing into an unauthored
// state.
void startAldermastDialogue(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    if (frame->activeDialogLayoutName != nullptr && frame->activeDialogLayoutName[0] != '\0') return;
    if (!playerNearAldermast(frame)) return;

    if (readFlag(frame, "aldermast_met", 0.0) == 0.0) {
        queueFlagSet("aldermast_met", 1.0);
        toastScratch() = "You have met Aldermast, the Aetheric Wizard.";
        frame->requestedToastText = toastScratch().c_str();
    }

    const bool sealAccepted = readFlag(frame, "ashen_seal_accepted", 0.0) != 0.0;
    const bool sealFound = readFlag(frame, "ashen_seal_found", 0.0) != 0.0;
    const bool sealReturned = readFlag(frame, "ashen_seal_returned", 0.0) != 0.0;
    const bool constellationAccepted = readFlag(frame, "constellation_accepted", 0.0) != 0.0;
    const bool constellationDone = readFlag(frame, "constellation_done", 0.0) != 0.0;

    if (!sealAccepted) {
        frame->requestedPushDialog = "dialogue:aldermast_seal_offer";
    } else if (!sealFound) {
        frame->requestedPushDialog = "dialogue:aldermast_seal_reminder";
    } else if (!sealReturned) {
        frame->requestedPushDialog =
            (countInInventory(frame, "ashen_seal") > 0) ? "dialogue:aldermast_seal_handin" : "dialogue:aldermast_seal_missing";
    } else if (!constellationAccepted) {
        frame->requestedPushDialog =
            (aldermastCombatAvg(frame) < 30) ? "dialogue:aldermast_void_offer_undertrained" : "dialogue:aldermast_void_offer";
    } else if (!constellationDone) {
        frame->requestedPushDialog = "dialogue:aldermast_void_progress";
    }
    // constellation_done: deferred (see this function's own doc comment) --
    // deliberately opens nothing rather than guessing at an unauthored node.
}

// ======= Dialogue choice side effects the action vocabulary can't express
// (Part 3's own "belongs in GrimstoneRuntime.cpp" split) =======
// tileTriggerActionKinds() (TileGrid.h) has no "set_flag"/"remove_item"
// action -- give_item can only ADD (TileGridHostRunner.cpp's own
// fireTriggerAction() calls inventory.addItem() directly for it), and
// nothing in the vocabulary can touch the flag store at all. Accepting a
// quest and handing in the Ashen Seal (removing it, marking the quest
// returned) therefore has to be real GrimstoneRuntime.cpp logic, reacting
// to the SAME (tree, node, clickedUiActionId) triple TileGridHostRunner.cpp
// itself uses to resolve a click.
//
// **Ordering subtlety this had to be written around**: by the time a
// plugin's onTileGridUpdate() runs, activeDialogueTreeName/NodeId already
// reflect the NODE THE CLICK JUST ADVANCED TO, not the node the choice was
// clicked FROM (TileGridHostRunner.cpp resolves the click -- firing the
// choice's own `action` and advancing `activeDialogueNode` -- BEFORE
// copying either field into the plugin frame). So this can't gate on "the
// player clicked choice 0 while node X was showing" directly; instead it
// gates on ARRIVING at a specific destination node while clickedUiActionId
// is non-empty this exact frame (a real click just landed one, as opposed
// to sitting on that node an idle frame later, when clickedUiActionId is
// "" again) -- which is why every choice below routes to its OWN named
// node instead of ending the conversation directly.
void applyAldermastDialogueSideEffects(BeTileGridFrame* frame) {
    if (frame->activeDialogueTreeName == nullptr || frame->activeDialogueTreeName[0] == '\0') return;
    if (frame->clickedUiActionId == nullptr || frame->clickedUiActionId[0] == '\0') return;
    if (frame->activeDialogueNodeId == nullptr) return;

    if (std::strcmp(frame->activeDialogueTreeName, "aldermast_seal_offer") == 0 &&
        std::strcmp(frame->activeDialogueNodeId, "accepted_confirm") == 0) {
        if (readFlag(frame, "ashen_seal_accepted", 0.0) == 0.0) queueFlagSet("ashen_seal_accepted", 1.0);
    } else if (std::strcmp(frame->activeDialogueTreeName, "aldermast_seal_handin") == 0 &&
               std::strcmp(frame->activeDialogueNodeId, "handin_thanks") == 0) {
        if (readFlag(frame, "ashen_seal_returned", 0.0) == 0.0) {
            queueItemGrant("ashen_seal", -1); // the seal itself is consumed on hand-in, same as the JS's removeFromInventory()
            queueFlagSet("ashen_seal_returned", 1.0);
        }
    } else if (std::strcmp(frame->activeDialogueTreeName, "aldermast_void_offer") == 0 &&
               std::strcmp(frame->activeDialogueNodeId, "accepted") == 0) {
        if (readFlag(frame, "constellation_accepted", 0.0) == 0.0) queueFlagSet("constellation_accepted", 1.0);
    }
}

// ======= Live dialogue text overrides (Part 3, the requestedDialogueTextOverride
// mechanism) =======
// Two of the authored nodes above are deliberately static placeholders in
// the JSON -- the live NUMBER each one needs (the player's own combat
// average, the running Void Shards count) is plugin-computed state the
// engine has no business knowing about (DialogueTree.h's own doc comment:
// "the engine has no business knowing what a game's live values even
// ARE"), so this overrides the rendered body text every frame the matching
// node is showing, exactly the mechanism that field exists for.
void overrideAldermastLiveDialogueText(BeTileGridFrame* frame) {
    if (frame->activeDialogueTreeName == nullptr || frame->activeDialogueTreeName[0] == '\0') return;

    if (std::strcmp(frame->activeDialogueTreeName, "aldermast_void_offer_undertrained") == 0) {
        dialogueOverrideScratch() = "Four Void Shards, scattered across the deepest dungeon chambers. The things "
                                     "guarding them are not goblins. You need seasoned combat skills -- an average "
                                     "of level 30 across Attack, Defence, and Strength -- before I'd send you in. "
                                     "You are currently at " +
                                     std::to_string(aldermastCombatAvg(frame)) + ". Come back when you're ready.";
        frame->requestedDialogueTextOverride = dialogueOverrideScratch().c_str();
    } else if (std::strcmp(frame->activeDialogueTreeName, "aldermast_void_progress") == 0) {
        const int found = static_cast<int>(readFlag(frame, "void_shards_found", 0.0));
        dialogueOverrideScratch() = "You have found " + std::to_string(found) +
                                     " of the four Void Shards. Search the deepest chests in every dungeon -- the "
                                     "Ashwood Crypts, the Iron Depths, and the Cultist Catacombs. The shards are "
                                     "drawn to darkness.";
        frame->requestedDialogueTextOverride = dialogueOverrideScratch().c_str();
    }
}

// ======= The Grimstone Savings Bank (js/bank.js) =======
// Transcribed from js/bank.js's STOCKS/BOND_TIERS/ensureBankState()/
// updateStockPrices()/checkBondMaturity() plus renderMarketTab()'s own
// buy/sell handlers and renderBondsTab()'s own bond-purchase handler
// (lines 6-49, 160-230, 233-310) -- read in full before writing any of
// this, per this pass's own task framing.
//
// **Real, deliberate simplification, documented as such (same spirit as
// handleMiningAndWoodcutting()'s own progress-bar note above)**: the JS's
// own bank panel is a hand-typed-quantity UI (`qtyInput`/`amtInput`, a free-
// form number field) -- no such text-entry primitive exists on a
// DialogueTree choice (DialogueChoice.h: a fixed label + an optional fixed
// action/actionParam, nothing reads a live player-typed number), and
// PORTING_PLAN.md's own js/quests.js row already documents that no
// DialogueTemplate UILayout exists in content/ yet either, so there is no
// UI primitive here beyond the SAME requestedPushDialog/DialogueTree
// mechanism the Aldermast quest-chain pass above just established. This
// ports the bank as a real, working dialogue-tree hookup on Willa's own
// npc_spawn marker (buildBankInterior(), GrimstoneGame.cpp) instead: FIXED
// quantities -- 1 share per buy/sell click, a fixed 100g/200g/400g stake
// per bond tier -- rather than the JS's arbitrary typed amount. A future
// pass with a real number-entry UI primitive could restore free-form
// amounts without changing anything below except the fixed constants.
//
// **Judgement call, not in the JS at all**: js/bank.js keeps a player's
// "gold" (in hand) separate from "p.bank.gold" (the vault) -- deposit/
// withdraw between the two, with stock/bond purchases spending ONLY
// vault gold. This port has no existing gold/wallet concept anywhere yet
// (checked, same as handleCombatDeathRewards()'s own doc comment above),
// so rather than inventing a second parallel "vault" flag with no
// deposit/withdraw UI to move money between the two (which would just
// strand the player's gold in whichever bucket it landed in), this ports
// a SINGLE wallet flag ("player_gold") that stock/bond purchases spend
// and payouts credit directly -- the vault/in-hand split collapses to
// one number, documented here as the reason rather than silently
// dropped.
constexpr const char* kPlayerGoldFlag = "player_gold";

struct BankStock {
    const char* id;          // js/bank.js's own STOCKS key
    const char* displayName; // js/bank.js's own STOCKS[id].name
    double basePrice;        // js/bank.js's own STOCKS[id].basePrice
    const char* priceFlagKey;
    const char* heldFlagKey;
};
constexpr BankStock kBankStocks[] = {
    {"grimco", "Grimco Mining Co.", 12.0, "stock_price_grimco", "stock_held_grimco"},
    {"ironvale", "Ironvale Smelters", 25.0, "stock_price_ironvale", "stock_held_ironvale"},
    {"ashgold", "Ashenveil Gold Trust", 45.0, "stock_price_ashgold", "stock_held_ashgold"},
    {"verdant", "Verdant Farms Ltd.", 8.0, "stock_price_verdant", "stock_held_verdant"},
};
constexpr int kBankStockCount = sizeof(kBankStocks) / sizeof(kBankStocks[0]);

const BankStock* findBankStock(const char* id) {
    for (int i = 0; i < kBankStockCount; ++i)
        if (std::strcmp(kBankStocks[i].id, id) == 0) return &kBankStocks[i];
    return nullptr;
}

// js/bank.js's own updateStockPrices() (lines 33-49): a 30-REAL-second
// random walk, +/-13%, clamped to [0.4x, 2.5x] of each stock's own
// basePrice. There is no wall-clock available to a 2D plugin
// (BeTileGridFrame only offers a per-frame `dt`), so the 30-second
// interval is accumulated in its own flag ("stock_market_elapsed",
// incremented by frame->dt every frame, same "own the accumulator as a
// flag since this file keeps no persistent struct of its own" discipline
// handleFarmGrowthTick()'s own doc comment already establishes) and reset
// + rerolled once it crosses 30.0 -- mirrors the JS's own
// `now - state.stockMarket.lastUpdate < 30000` gate exactly, just in
// accumulated-dt seconds instead of Date.now() milliseconds.
// frame->randomUint32 (the SAME seeded stream every other weighted-roll
// system in this file already draws from) stands in for the JS's own
// Math.random(), matching handleFishing()/handleCombatAttack()'s own
// convention.
constexpr double kStockMarketTickSeconds = 30.0;

void updateStockMarket(BeTileGridFrame* frame) {
    const double elapsed = readFlag(frame, "stock_market_elapsed", 0.0) + static_cast<double>(frame->dt);
    if (elapsed < kStockMarketTickSeconds) {
        queueFlagSet("stock_market_elapsed", elapsed);
        return;
    }

    queueFlagSet("stock_market_elapsed", 0.0);
    for (int i = 0; i < kBankStockCount; ++i) {
        const BankStock& stock = kBankStocks[i];
        const double current = readFlag(frame, stock.priceFlagKey, stock.basePrice);

        double unit = 0.5; // deterministic fallback, same convention as handleCombatAttack() above
        if (frame->randomUint32 != nullptr) {
            constexpr double kUint32Max = 4294967295.0;
            unit = static_cast<double>(frame->randomUint32()) / kUint32Max;
        }
        const double factor = 0.88 + unit * 0.26; // js's own "+/-13% random walk"

        const double lowClamp = std::round(stock.basePrice * 0.4);
        const double highClamp = std::round(stock.basePrice * 2.5);
        double next = std::round(current * factor);
        if (next < lowClamp) next = lowClamp;
        if (next > highClamp) next = highClamp;
        queueFlagSet(stock.priceFlagKey, next);
    }
}

// js/bank.js's own BOND_TIERS (lines 14-18) -- durations/rates transcribed
// exactly (5/15/30 real minutes, +10%/+25%/+50% return). `fixedAmount` is
// this port's own judgement call, replacing the JS's free-form typed
// amount (see this section's own top-of-file doc comment) -- chosen to
// scale with the tier the same way the JS's own numbers imply a bigger
// commitment for a longer lockup, without inventing an amount-entry UI.
struct BankBondTier {
    const char* id;   // used to build this bond instance's own unique timer key
    const char* displayName;
    double durationSeconds;
    double rate;
    double fixedAmount;
};
constexpr BankBondTier kBankBondTiers[] = {
    {"short", "Short Bond", 5.0 * 60.0, 0.10, 100.0},
    {"medium", "Medium Bond", 15.0 * 60.0, 0.25, 200.0},
    {"long", "Long Bond", 30.0 * 60.0, 0.50, 400.0},
};
constexpr int kBankBondTierCount = sizeof(kBankBondTiers) / sizeof(kBankBondTiers[0]);

// js/bank.js's own checkBondMaturity() (lines 52-67): pays out
// floor(amount * (1 + rate)) once a bond's matureAt passes. Here that's
// the host timer's own "just expired" transition (BeTimerState::
// remainingSeconds <= 0.0 for exactly one frame, GameModuleApi.h's own
// v25->v26 doc comment) on any "bond_<tier>_<n>" timer -- <tier> is
// parsed back out of the key to look up that tier's own fixedAmount/rate
// (both are the SAME fixed constants used to start the timer, not
// per-instance state, since this port's own bonds carry no free-form
// amount to remember -- see kBankBondTiers's own doc comment above).
// Multiple simultaneous bonds of the same tier get distinct keys via
// "bond_counter" (a plain incrementing flag), matching this pass's own
// task framing.
void handleBondMaturity(BeTileGridFrame* frame) {
    for (int i = 0; i < frame->timerCount; ++i) {
        const BeTimerState& timer = frame->timers[i];
        if (timer.key == nullptr) continue;
        if (timer.remainingSeconds > 0.0) continue; // not the "just expired" frame

        const std::string key(timer.key);
        const BankBondTier* tier = nullptr;
        for (int t = 0; t < kBankBondTierCount; ++t) {
            const std::string prefix = std::string("bond_") + kBankBondTiers[t].id + "_";
            if (key.rfind(prefix, 0) == 0) {
                tier = &kBankBondTiers[t];
                break;
            }
        }
        if (tier == nullptr) continue; // not one of ours

        const double payout = std::floor(tier->fixedAmount * (1.0 + tier->rate));
        BeFlagUpdate goldUpdate;
        goldUpdate.key = kPlayerGoldFlag;
        goldUpdate.value = payout;
        goldUpdate.mode = 1; // INCREMENT
        flagUpdateBuffer().push_back(goldUpdate);

        toastScratch() = std::string("Your ") + tier->displayName + " has matured! You received " +
                          std::to_string(static_cast<int>(payout)) + "g.";
        frame->requestedToastText = toastScratch().c_str();
    }
}

// **Real, documented gap, same shape as playerNearAldermast()'s own doc
// comment above**: BeTileMarker has no name/id crossing the ABI, so this
// matches Willa's OWN npc_spawn marker by the exact world position
// buildBankInterior() places it at -- addNpcSpawnMarker(grid, "Willa",
// 6.0f, 3.0f) offsets both coordinates by +0.5 (GrimstoneGame.cpp's own
// addNpcSpawnMarker()), landing at (6.5, 3.5). Checked against every
// other addNpcSpawnMarker()/marker.position call site in
// GrimstoneGame.cpp; none other lands on this exact float pair.
constexpr float kWillaMarkerWorldX = 6.5f;
constexpr float kWillaMarkerWorldY = 3.5f;
constexpr float kWillaInteractRadius = 1.5f; // same adjacency spirit as kAldermastInteractRadius

bool playerNearWilla(const BeTileGridFrame* frame) {
    bool markerPresent = false;
    for (int i = 0; i < frame->markerCount; ++i) {
        const BeTileMarker& m = frame->markers[i];
        if (m.kind == nullptr || std::strcmp(m.kind, "npc_spawn") != 0) continue;
        if (std::fabs(m.worldX - kWillaMarkerWorldX) > 0.01f) continue;
        if (std::fabs(m.worldY - kWillaMarkerWorldY) > 0.01f) continue;
        markerPresent = true;
        break;
    }
    if (!markerPresent) return false; // not currently in the Bank interior at all

    const float dx = frame->playerWorldX - kWillaMarkerWorldX;
    const float dy = frame->playerWorldY - kWillaMarkerWorldY;
    return (dx * dx + dy * dy) <= kWillaInteractRadius * kWillaInteractRadius;
}

void startBankDialogue(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    if (frame->activeDialogLayoutName != nullptr && frame->activeDialogLayoutName[0] != '\0') return;
    if (!playerNearWilla(frame)) return;
    frame->requestedPushDialog = "dialogue:willa_bank";
}

// ======= Dialogue side effects the action vocabulary can't express (bank
// half) ======= Same "belongs in GrimstoneRuntime.cpp, not the DialogueChoice
// action vocabulary" reasoning applyAldermastDialogueSideEffects() already
// documents above, including the same ordering subtlety: activeDialogueNodeId
// already reflects the destination the click just advanced TO by the time
// this runs, so every stock/bond choice above routes to its own named result
// node rather than acting on the node the choice was clicked FROM.
//
// **Accepted, one-frame-stale display, same category as
// handleCombatDeathRewards()'s own "detected on a later frame" doc comment
// above**: the result text for a JUST-clicked buy/sell/bond choice is
// computed INLINE from the pre-transaction flags this same function reads
// (so the message it writes to requestedDialogueTextOverride this frame is
// accurate for the click that just landed), but a flag this function queues
// via requestedFlagUpdates (e.g. the new gold total) isn't visible via
// frame->flags until the FOLLOWING frame -- so an idle frame sitting on the
// same result node before the player clicks "All right." recomputes its own
// status text from flags that, for exactly one frame, still show the
// pre-transaction numbers. The dialogue box is on screen for far longer than
// one frame before a human reacts, so this is imperceptible in practice, and
// it is the same category of one-frame lag this file already accepts
// elsewhere rather than a new kind of bug.
void applyBankStockSideEffect(BeTileGridFrame* frame, const BankStock& stock, bool isBuy) {
    const double gold = readFlag(frame, kPlayerGoldFlag, 0.0);
    const double price = readFlag(frame, stock.priceFlagKey, stock.basePrice);
    const double held = readFlag(frame, stock.heldFlagKey, 0.0);

    if (isBuy) {
        if (gold < price) {
            dialogueOverrideScratch() =
                std::string("You don't have enough gold in hand to buy a share of ") + stock.displayName + " (" +
                std::to_string(static_cast<int>(price)) + "g).";
        } else {
            BeFlagUpdate goldUpdate;
            goldUpdate.key = kPlayerGoldFlag;
            goldUpdate.value = -price;
            goldUpdate.mode = 1; // INCREMENT
            flagUpdateBuffer().push_back(goldUpdate);
            queueFlagSet(stock.heldFlagKey, held + 1.0); // SET: this file's own read-modify-write flag idiom
            dialogueOverrideScratch() = std::string("Bought 1 share of ") + stock.displayName + " for " +
                                         std::to_string(static_cast<int>(price)) + "g. You now own " +
                                         std::to_string(static_cast<int>(held) + 1) + ".";
        }
    } else {
        if (held < 1.0) {
            dialogueOverrideScratch() = std::string("You don't own any shares of ") + stock.displayName + " to sell.";
        } else {
            BeFlagUpdate goldUpdate;
            goldUpdate.key = kPlayerGoldFlag;
            goldUpdate.value = price;
            goldUpdate.mode = 1; // INCREMENT
            flagUpdateBuffer().push_back(goldUpdate);
            queueFlagSet(stock.heldFlagKey, held - 1.0);
            dialogueOverrideScratch() = std::string("Sold 1 share of ") + stock.displayName + " for " +
                                         std::to_string(static_cast<int>(price)) + "g. You now own " +
                                         std::to_string(static_cast<int>(held) - 1) + ".";
        }
    }
    frame->requestedDialogueTextOverride = dialogueOverrideScratch().c_str();
}

void applyBankBondSideEffect(BeTileGridFrame* frame, const BankBondTier& tier) {
    const double gold = readFlag(frame, kPlayerGoldFlag, 0.0);
    if (gold < tier.fixedAmount) {
        dialogueOverrideScratch() = std::string("You don't have enough gold in hand to lock in a ") +
                                     tier.displayName + " (" + std::to_string(static_cast<int>(tier.fixedAmount)) +
                                     "g).";
        frame->requestedDialogueTextOverride = dialogueOverrideScratch().c_str();
        return;
    }

    BeFlagUpdate goldUpdate;
    goldUpdate.key = kPlayerGoldFlag;
    goldUpdate.value = -tier.fixedAmount;
    goldUpdate.mode = 1; // INCREMENT
    flagUpdateBuffer().push_back(goldUpdate);

    const double counter = readFlag(frame, "bond_counter", 0.0);
    queueFlagSet("bond_counter", counter + 1.0);
    const std::string timerKey =
        std::string("bond_") + tier.id + "_" + std::to_string(static_cast<long long>(counter));
    queueTimerStart(internString(timerKey), tier.durationSeconds);

    const double payout = std::floor(tier.fixedAmount * (1.0 + tier.rate));
    dialogueOverrideScratch() = std::string("Locked ") + std::to_string(static_cast<int>(tier.fixedAmount)) +
                                 "g into a " + tier.displayName + ". Matures in " +
                                 std::to_string(static_cast<int>(tier.durationSeconds / 60.0)) +
                                 " min -- you'll receive " + std::to_string(static_cast<int>(payout)) + "g.";
    frame->requestedDialogueTextOverride = dialogueOverrideScratch().c_str();
}

void applyBankDialogueSideEffects(BeTileGridFrame* frame) {
    if (frame->activeDialogueTreeName == nullptr || std::strcmp(frame->activeDialogueTreeName, "willa_bank") != 0)
        return;
    if (frame->clickedUiActionId == nullptr || frame->clickedUiActionId[0] == '\0') return;
    if (frame->activeDialogueNodeId == nullptr) return;

    const std::string node(frame->activeDialogueNodeId);
    for (int i = 0; i < kBankStockCount; ++i) {
        const BankStock& stock = kBankStocks[i];
        if (node == std::string(stock.id) + "_buy_result") {
            applyBankStockSideEffect(frame, stock, /*isBuy=*/true);
            return;
        }
        if (node == std::string(stock.id) + "_sell_result") {
            applyBankStockSideEffect(frame, stock, /*isBuy=*/false);
            return;
        }
    }
    for (int i = 0; i < kBankBondTierCount; ++i) {
        const BankBondTier& tier = kBankBondTiers[i];
        if (node == std::string("bond_") + tier.id + "_result") {
            applyBankBondSideEffect(frame, tier);
            return;
        }
    }
}

// ======= Live dialogue text for the bank's own read-only menu nodes =======
// Separate from applyBankDialogueSideEffects() above on purpose: the
// "market"/"<stock>_menu"/"bonds" nodes never fire a side effect (browsing
// costs nothing), so their own live prices/holdings/gold are read straight
// from frame->flags with none of the same-frame staleness the result nodes
// above have to work around -- same split
// applyAldermastDialogueSideEffects()/overrideAldermastLiveDialogueText()
// already establish.
void overrideBankMenuLiveDialogueText(BeTileGridFrame* frame) {
    if (frame->activeDialogueTreeName == nullptr || std::strcmp(frame->activeDialogueTreeName, "willa_bank") != 0)
        return;
    if (frame->activeDialogueNodeId == nullptr) return;
    // Don't stomp a same-frame transaction message applyBankDialogueSideEffects()
    // above may have just written -- only fill in text for the browse-only nodes.
    if (frame->clickedUiActionId != nullptr && frame->clickedUiActionId[0] != '\0') return;

    const std::string node(frame->activeDialogueNodeId);
    const double gold = readFlag(frame, kPlayerGoldFlag, 0.0);

    if (node == "market") {
        std::string text = "Gold in hand: " + std::to_string(static_cast<int>(gold)) + "g.\n";
        for (int i = 0; i < kBankStockCount; ++i) {
            const BankStock& stock = kBankStocks[i];
            const double price = readFlag(frame, stock.priceFlagKey, stock.basePrice);
            text += std::string(stock.displayName) + ": " + std::to_string(static_cast<int>(price)) + "g/share\n";
        }
        dialogueOverrideScratch() = text;
        frame->requestedDialogueTextOverride = dialogueOverrideScratch().c_str();
        return;
    }

    for (int i = 0; i < kBankStockCount; ++i) {
        const BankStock& stock = kBankStocks[i];
        if (node != std::string(stock.id) + "_menu") continue;
        const double price = readFlag(frame, stock.priceFlagKey, stock.basePrice);
        const double held = readFlag(frame, stock.heldFlagKey, 0.0);
        dialogueOverrideScratch() = std::string(stock.displayName) + " is trading at " +
                                     std::to_string(static_cast<int>(price)) + "g/share. You own " +
                                     std::to_string(static_cast<int>(held)) + " (worth " +
                                     std::to_string(static_cast<int>(held * price)) + "g). Gold in hand: " +
                                     std::to_string(static_cast<int>(gold)) + "g.";
        frame->requestedDialogueTextOverride = dialogueOverrideScratch().c_str();
        return;
    }

    if (node == "bonds") {
        dialogueOverrideScratch() =
            std::string("Gold in hand: ") + std::to_string(static_cast<int>(gold)) +
            "g. Bonds lock a fixed sum away and return it with interest -- Short: 100g -> 110g in 5 min; "
            "Medium: 200g -> 250g in 15 min; Long: 400g -> 600g in 30 min.";
        frame->requestedDialogueTextOverride = dialogueOverrideScratch().c_str();
    }
}

// ======= The five inert `npc_spawn` proof-of-concept NPCs (Grimward,
// Bram, Oswin, Thessaly, Dorin) =======
// Transcribed from js/npcs.js in full (NPC_DIALOGUE/NAMED_NPCS/
// VILLAGER_RUMOURS/getDynamicGreet()/openDialogue()'s own nameLines table)
// plus js/zones.js's NAMED_NPCS-position table (lines 2468-2495) that
// assigns each of these a real name, and INNKEEPER_SHOP_CONFIG/
// MERCHANT_SHOP_CONFIG (this file, lines 918-1113) for the two who carry
// `hasTrade: true`. Same exact shape as playerNearAldermast()/
// startAldermastDialogue()/applyAldermastDialogueSideEffects() and
// playerNearWilla()/startBankDialogue()/applyBankDialogueSideEffects()
// above: BeTileMarker has no name/id crossing the ABI (same doc comment),
// so each NPC is matched by the EXACT world position its own
// addNpcSpawnMarker() call in GrimstoneGame.cpp places it at (+0.5/+0.5
// offset, that helper's own doc comment) -- checked against every other
// addNpcSpawnMarker() call site; none of the five below collide with each
// other, with Aldermast (13.5, 5.5), or with Willa (6.5, 3.5).
//
// **What's real vs. deferred, per NPC (see PORTING_PLAN.md's own
// js/npcs.js row for the fuller writeup)**:
// - **Grimward** (forge:5,11 in the JS): the JS NEVER gives him real
//   authored dialogue -- his `tiles[5][11] = T.NPC_GUARD` placement
//   (js/zones.js line 1441, "re-using guard tile for now, named below") means
//   `openDialogue()` would actually show him the GUARD typeId's "Halt!
//   State your business" pool, a placeholder-tile artifact, not authored
//   Grimward content. That pool is deliberately NOT ported (porting a
//   town guard's lines as a blacksmith's own dialogue would be inventing
//   content, not porting it). What IS real and ported: his
//   VILLAGER_RUMOURS line and the generic name-fallback blurb
//   `openDialogue()`'s own `nameLines[npc.npcName] || "${npc.npcName}. A
//   resident of Ashenveil."` produces for him (he has no `nameLines` entry).
//   No `hasTrade` anywhere for him in the JS -- no smithing/trade content
//   to port, so none is added here.
// - **Bram** (innkeeper, `hasTrade: true`): his 4 real topic lines, his
//   `nameLines.Bram` blurb, and a curated 3-of-10 subset of
//   INNKEEPER_SHOP_CONFIG.buyStock (pale_ale/ashenveil_mead/inn_stew) --
//   the remaining 7 real menu items are a real, deliberately deferred cut
//   (documented, not silently dropped) to keep this pass's own dialogue-
//   tree size manageable; every item actually offered is real JS content,
//   not invented. His dynamic, quest-aware greeting (ashen_seal_returned)
//   is ported since that flag is real, already-ported state
//   (updateAldermastObjectives() above); his OTHER dynamic branches
//   (mystery_key_given, weather/Grimtide) are deferred -- the mystery quest
//   chain was never ported to this file (checked: no "mystery_" flag
//   anywhere in this file) and weather/time-of-day gating on a greeting is
//   real but lower-value scope this pass didn't reach.
// - **Oswin**/**Thessaly** (villagers, no `hasTrade`): their real rumour
//   line, `nameLines` blurb, and the 2 generic NPC_VILLAGER topic lines.
//   Oswin's one dynamic (ashen_seal_returned) branch is ported for the
//   same reason Bram's is; Thessaly's OWN dynamic branches all key off the
//   unported mystery quest chain (mystery_met/mystery_key_given) or
//   Grimtide-night time-of-day, so none of them are reachable here --
//   deferred, not faked.
// - **Dorin** (merchant, `hasTrade: true`, inside his own Trading Post
//   interior): his 2 real topic lines, `nameLines.Dorin` blurb, dynamic
//   ashen_seal_returned greeting, and a curated 3-buy/3-sell subset of
//   MERCHANT_SHOP_CONFIG's buyStock/sellAccepts (60+ real entries total)
//   -- same "curated, documented, real items only" cut as Bram's, and for
//   the same reason (DialogueChoice.h's own `kMaxDialogueChoices = 4` --
//   the full catalog would need many more paginated menu screens than this
//   pass's own scope covers). Dorin's own "Old Bones, New Debts" quest
//   (js/npcs.js lines 499-535, 686-734 -- a forged-ledger side quest
//   reached by sneaking into his shop after dark, hinging on Bertram AND
//   Vayne/Edwyn, neither of whose OWN quest-giving dialogue exists in this
//   file) is a real, substantially bigger gap than a dialogue tree -- a
//   whole second quest-giver's dialogue plus a night-only stealth/break-in
//   mechanic this port has no primitive for -- and is explicitly deferred,
//   not attempted here.
//
// **NPC "schedules" (movement between named locations by time of day):
// checked, and there simply is none to port.** grep for "schedule" across
// every js/*.js file (js/activities.js's own scheduleKeyMove()/
// scheduleP2KeyMove() are unrelated input-repeat helpers) turns up nothing
// NPC-related, and every one of the five NAMED_NPCS entries above is a
// single static `"zone:y,x"` position, never touched again after
// spawnNpcsFromMap() places it -- none of them ever moves in the JS at
// all. So unlike the "real primitive exists, just needs exposing" shape
// this repo's own NEUTRAL-lens standing instruction usually looks for,
// there is no JS behavior here to approximate with TileAgentSpawn's own
// waypoint-route primitive (TileAgentSim.h) -- building NPC movement these
// five never had would be inventing content, not porting it, so nothing
// route/waypoint-based is added for any of them.
constexpr float kNpcInteractRadius = 1.5f; // same adjacency spirit as kAldermastInteractRadius/kWillaInteractRadius

bool playerNearMarkerAt(const BeTileGridFrame* frame, float markerX, float markerY) {
    bool markerPresent = false;
    for (int i = 0; i < frame->markerCount; ++i) {
        const BeTileMarker& m = frame->markers[i];
        if (m.kind == nullptr || std::strcmp(m.kind, "npc_spawn") != 0) continue;
        if (std::fabs(m.worldX - markerX) > 0.01f) continue;
        if (std::fabs(m.worldY - markerY) > 0.01f) continue;
        markerPresent = true;
        break;
    }
    if (!markerPresent) return false; // not currently in that interior/zone at all

    const float dx = frame->playerWorldX - markerX;
    const float dy = frame->playerWorldY - markerY;
    return (dx * dx + dy * dy) <= kNpcInteractRadius * kNpcInteractRadius;
}

// ---- Grimward (forge:5,11 -> addNpcSpawnMarker(grid, "Grimward", 11.0f, 5.0f)) ----
constexpr float kGrimwardMarkerWorldX = 11.5f;
constexpr float kGrimwardMarkerWorldY = 5.5f;
bool playerNearGrimward(const BeTileGridFrame* frame) { return playerNearMarkerAt(frame, kGrimwardMarkerWorldX, kGrimwardMarkerWorldY); }
void startGrimwardDialogue(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    if (frame->activeDialogLayoutName != nullptr && frame->activeDialogLayoutName[0] != '\0') return;
    if (!playerNearGrimward(frame)) return;
    frame->requestedPushDialog = "dialogue:grimward_greeting";
}

// ---- Bram (inn:10,17 -> addNpcSpawnMarker(grid, "Bram", 17.0f, 10.0f)) ----
constexpr float kBramMarkerWorldX = 17.5f;
constexpr float kBramMarkerWorldY = 10.5f;
bool playerNearBram(const BeTileGridFrame* frame) { return playerNearMarkerAt(frame, kBramMarkerWorldX, kBramMarkerWorldY); }
void startBramDialogue(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    if (frame->activeDialogLayoutName != nullptr && frame->activeDialogLayoutName[0] != '\0') return;
    if (!playerNearBram(frame)) return;
    frame->requestedPushDialog = "dialogue:bram_greeting";
}
// Dynamic greeting override (js/npcs.js getDynamicGreet(), the `name ===
// 'Bram'` branch, line 200-213) -- only the ashen_seal_returned line, per
// this section's own doc comment on what's real vs. deferred. Same
// "browse-only node, gate on no click this exact frame" split
// overrideBankMenuLiveDialogueText() already establishes.
void overrideBramLiveDialogueText(BeTileGridFrame* frame) {
    if (frame->activeDialogueTreeName == nullptr || std::strcmp(frame->activeDialogueTreeName, "bram_greeting") != 0) return;
    if (frame->activeDialogueNodeId == nullptr || std::strcmp(frame->activeDialogueNodeId, "greet") != 0) return;
    if (frame->clickedUiActionId != nullptr && frame->clickedUiActionId[0] != '\0') return;
    if (readFlag(frame, "ashen_seal_returned", 0.0) != 0.0) {
        frame->requestedDialogueTextOverride =
            "You're the one who went into the catacombs. I heard. Drink's on me tonight -- just this once. "
            "Bram Hollowtap. Sit down.";
    }
}

// ---- Oswin (inn:9,6 -> addNpcSpawnMarker(grid, "Oswin", 6.0f, 9.0f)) ----
constexpr float kOswinMarkerWorldX = 6.5f;
constexpr float kOswinMarkerWorldY = 9.5f;
bool playerNearOswin(const BeTileGridFrame* frame) { return playerNearMarkerAt(frame, kOswinMarkerWorldX, kOswinMarkerWorldY); }
void startOswinDialogue(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    if (frame->activeDialogLayoutName != nullptr && frame->activeDialogLayoutName[0] != '\0') return;
    if (!playerNearOswin(frame)) return;
    frame->requestedPushDialog = "dialogue:oswin_greeting";
}
// js/npcs.js getDynamicGreet(), the `name === 'Oswin'` branch, line 226-234.
void overrideOswinLiveDialogueText(BeTileGridFrame* frame) {
    if (frame->activeDialogueTreeName == nullptr || std::strcmp(frame->activeDialogueTreeName, "oswin_greeting") != 0) return;
    if (frame->activeDialogueNodeId == nullptr || std::strcmp(frame->activeDialogueNodeId, "greet") != 0) return;
    if (frame->clickedUiActionId != nullptr && frame->clickedUiActionId[0] != '\0') return;
    if (readFlag(frame, "ashen_seal_returned", 0.0) != 0.0) {
        frame->requestedDialogueTextOverride =
            "Ashenveil's full of heroes all of a sudden. Oswin -- I'm still waiting on that caravan, but at least "
            "the company's interesting.";
    }
}

// ---- Thessaly (inn:12,7 -> addNpcSpawnMarker(grid, "Thessaly", 7.0f, 12.0f)) ----
constexpr float kThessalyMarkerWorldX = 7.5f;
constexpr float kThessalyMarkerWorldY = 12.5f;
bool playerNearThessaly(const BeTileGridFrame* frame) { return playerNearMarkerAt(frame, kThessalyMarkerWorldX, kThessalyMarkerWorldY); }
void startThessalyDialogue(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    if (frame->activeDialogLayoutName != nullptr && frame->activeDialogLayoutName[0] != '\0') return;
    if (!playerNearThessaly(frame)) return;
    frame->requestedPushDialog = "dialogue:thessaly_greeting";
}
// No live override for Thessaly -- every one of her OWN dynamic branches
// (js/npcs.js lines 236-246) keys off mystery_met/mystery_key_given (the
// unported mystery quest chain) or Grimtide-night time-of-day; see this
// section's own doc comment above.

// ---- Dorin (shop:2,6 -> addNpcSpawnMarker(grid, "Dorin", 6.0f, 2.0f)) ----
constexpr float kDorinMarkerWorldX = 6.5f;
constexpr float kDorinMarkerWorldY = 2.5f;
bool playerNearDorin(const BeTileGridFrame* frame) { return playerNearMarkerAt(frame, kDorinMarkerWorldX, kDorinMarkerWorldY); }
void startDorinDialogue(BeTileGridFrame* frame, bool forced = false) {
    if (!forced && !frame->interactPressed) return;
    if (frame->activeDialogLayoutName != nullptr && frame->activeDialogLayoutName[0] != '\0') return;
    if (!playerNearDorin(frame)) return;
    frame->requestedPushDialog = "dialogue:dorin_greeting";
}
// js/npcs.js getDynamicGreet(), the `name === 'Dorin'` branch, line 303-315
// (ashen_seal_returned only -- same real-vs-deferred split as Bram's).
void overrideDorinLiveDialogueText(BeTileGridFrame* frame) {
    if (frame->activeDialogueTreeName == nullptr || std::strcmp(frame->activeDialogueTreeName, "dorin_greeting") != 0) return;
    if (frame->activeDialogueNodeId == nullptr || std::strcmp(frame->activeDialogueNodeId, "greet") != 0) return;
    if (frame->clickedUiActionId != nullptr && frame->clickedUiActionId[0] != '\0') return;
    if (readFlag(frame, "ashen_seal_returned", 0.0) != 0.0) {
        frame->requestedDialogueTextOverride =
            "Word from the south road -- a catacomb got cleared out. That was you? Dorin. Forty years trading "
            "these roads. First time I've heard that done.";
    }
}

// ---- Shared buy/sell side-effect helper for Bram/Dorin's curated menus --
// same gold-check/grant/text-override shape applyBankStockSideEffect()
// already establishes above, generalized to a plain (itemId, displayName,
// price) triple since neither NPC's menu needs a held-share count. ----
struct NpcShopItem {
    const char* id;
    const char* displayName;
    double price;
};

void applyNpcBuySideEffect(BeTileGridFrame* frame, const NpcShopItem& item) {
    const double gold = readFlag(frame, kPlayerGoldFlag, 0.0);
    if (gold < item.price) {
        dialogueOverrideScratch() = std::string("You don't have enough gold in hand for the ") + item.displayName +
                                     " (" + std::to_string(static_cast<int>(item.price)) + "g).";
    } else {
        BeFlagUpdate goldUpdate;
        goldUpdate.key = kPlayerGoldFlag;
        goldUpdate.value = -item.price;
        goldUpdate.mode = 1; // INCREMENT
        flagUpdateBuffer().push_back(goldUpdate);
        queueItemGrant(item.id, 1);
        dialogueOverrideScratch() =
            std::string("Bought the ") + item.displayName + " for " + std::to_string(static_cast<int>(item.price)) + "g.";
    }
    frame->requestedDialogueTextOverride = dialogueOverrideScratch().c_str();
}

void applyNpcSellSideEffect(BeTileGridFrame* frame, const NpcShopItem& item) {
    if (countInInventory(frame, item.id) < 1) {
        dialogueOverrideScratch() = std::string("You don't have a ") + item.displayName + " to sell.";
    } else {
        queueItemGrant(item.id, -1);
        BeFlagUpdate goldUpdate;
        goldUpdate.key = kPlayerGoldFlag;
        goldUpdate.value = item.price;
        goldUpdate.mode = 1; // INCREMENT
        flagUpdateBuffer().push_back(goldUpdate);
        dialogueOverrideScratch() =
            std::string("Sold the ") + item.displayName + " for " + std::to_string(static_cast<int>(item.price)) + "g.";
    }
    frame->requestedDialogueTextOverride = dialogueOverrideScratch().c_str();
}

// Bram's curated 3-of-10 INNKEEPER_SHOP_CONFIG.buyStock subset (js/npcs.js
// lines 1092-1113).
constexpr NpcShopItem kBramShopItems[] = {
    {"pale_ale", "Pale Ale", 4.0},
    {"ashenveil_mead", "Ashenveil Mead", 10.0},
    {"inn_stew", "Inn Stew", 8.0},
};
constexpr int kBramShopItemCount = sizeof(kBramShopItems) / sizeof(kBramShopItems[0]);

void applyBramDialogueSideEffects(BeTileGridFrame* frame) {
    if (frame->activeDialogueTreeName == nullptr || std::strcmp(frame->activeDialogueTreeName, "bram_greeting") != 0)
        return;
    if (frame->clickedUiActionId == nullptr || frame->clickedUiActionId[0] == '\0') return;
    if (frame->activeDialogueNodeId == nullptr) return;
    const std::string node(frame->activeDialogueNodeId);
    for (int i = 0; i < kBramShopItemCount; ++i) {
        if (node == std::string(kBramShopItems[i].id) + "_buy_result") {
            applyNpcBuySideEffect(frame, kBramShopItems[i]);
            return;
        }
    }
}

// Dorin's curated 3-buy/3-sell MERCHANT_SHOP_CONFIG subset (js/npcs.js
// lines 947-1024) -- buy prices from buyStock, sell prices from
// sellAccepts (both real entries, not invented).
constexpr NpcShopItem kDorinBuyItems[] = {
    {"bronze_sword", "Bronze Sword", 40.0},
    {"cooked_salmon", "Cooked Salmon", 20.0},
    {"hoe", "Hoe", 35.0},
};
constexpr int kDorinBuyItemCount = sizeof(kDorinBuyItems) / sizeof(kDorinBuyItems[0]);
constexpr NpcShopItem kDorinSellItems[] = {
    {"goblin_hide", "Goblin Hide", 8.0},
    {"iron_ore", "Iron Ore", 7.0},
    {"oak_log", "Oak Log", 6.0},
};
constexpr int kDorinSellItemCount = sizeof(kDorinSellItems) / sizeof(kDorinSellItems[0]);

void applyDorinDialogueSideEffects(BeTileGridFrame* frame) {
    if (frame->activeDialogueTreeName == nullptr || std::strcmp(frame->activeDialogueTreeName, "dorin_greeting") != 0)
        return;
    if (frame->clickedUiActionId == nullptr || frame->clickedUiActionId[0] == '\0') return;
    if (frame->activeDialogueNodeId == nullptr) return;
    const std::string node(frame->activeDialogueNodeId);
    for (int i = 0; i < kDorinBuyItemCount; ++i) {
        if (node == std::string(kDorinBuyItems[i].id) + "_buy_result") {
            applyNpcBuySideEffect(frame, kDorinBuyItems[i]);
            return;
        }
    }
    for (int i = 0; i < kDorinSellItemCount; ++i) {
        if (node == std::string(kDorinSellItems[i].id) + "_sell_result") {
            applyNpcSellSideEffect(frame, kDorinSellItems[i]);
            return;
        }
    }
}

// ======= Right-click context menu (js/input.js) =======
// PORTING_PLAN.md's own js/input.js row previously said this was
// "structurally impossible" -- true against the ABI at the time (a full
// grep of GameModuleApi.h found zero mouse/click fields at all). Item
// N6-MOUSE2D (v38->v39) closed that specific gap by adding
// BeTileGridFrame::mouseX/mouseY (float, normalized [0,1] SCREEN position,
// top-left origin, Y-down -- the exact convention the host's own internal
// HUD hit-testing already uses) and mouseRightPressed (int, edge-detected
// exactly like interactPressed -- nonzero only the single frame the button
// was first pressed). Both read directly from that field's own doc
// comment in GameModuleApi.h, not guessed.
//
// **What the bump does NOT close, checked rather than assumed**: there is
// still no way to turn mouseX/mouseY into a WORLD position. Grepped the
// whole header again for "camera"/"zoom"/"viewport"/"screenWidth" -- the
// 2D host's Camera2D exists (TileGridHostRunner.cpp reads real cursor
// state every frame for its own HUD hit-testing) but its position/zoom/
// viewport size never crosses the ABI boundary at all; every camera field
// on this struct is write-only "juice" (shake/zoom-punch/pan), nothing a
// plugin can read back. worldToCell takes a WORLD position, and there is
// no primitive anywhere that projects a normalized screen point into one.
// So a true cursor-precise "what's under the pointer" picker -- the thing
// js/input.js's own contextmenu handler actually does -- is still not
// buildable against this ABI version, bump or no bump.
//
// **What IS built instead**: right-click opens a small choice menu over
// whatever is already adjacent to the PLAYER -- the exact same
// "adjacency, not facing/pointing" interaction model this whole file
// already uses for interactPressed (handleMiningAndWoodcutting()'s own
// doc comment). It reuses the JS's own real priority order (NPC -> enemy
// -> a real tile action; ground-bag pickup is the JS's own FIRST branch
// and is skipped -- no groundBags-equivalent state exists anywhere in this
// file, grepped, zero hits, unchanged since PORTING_PLAN.md's own prior
// investigation), and every menu choice fires the exact SAME handler
// direct interact already calls -- each relevant handle*()/start*Dialogue()
// function above now takes an additional `forced` parameter (default
// false) that bypasses its own `!frame->interactPressed` gate while
// leaving every other real gate (level/zone/inventory/adjacency check)
// untouched -- matching walkThenDo()'s own "every menu action just calls
// the real handler" shape exactly, not a second copy of any grant logic.
//
// **No separate "Trade" entry, even for Bram/Dorin (both `hasTrade:
// true`)** -- a real ABI limit, not scope discipline. requestedPushDialog's
// own "dialogue:<name>" convention (TileGridHostRunner.cpp's
// pushDialogOrTree()) always starts a tree at its OWN startNodeId; there
// is no way to jump straight to an interior node like Dorin's own
// "dorin_trade_menu". A second top-level choice that could only ever land
// on the identical "greet" node "Talk" already opens would be a fake
// choice, not a real one -- Dorin's/Bram's own "Let's trade"/"What's on
// the menu?" line is already one click past "Talk" either way, so the
// menu's own action label just says so ("Talk to Dorin (trade
// available)") instead of pretending to offer two destinations that are
// actually one.
//
// **A menu choice can go stale**: the player is free to walk away while
// the menu is showing (nothing pins them in place), so the forced handler
// re-checks adjacency itself and can legitimately find nothing there any
// more -- it just silently does nothing that frame, the same as an
// ordinary interactPressed press thrown at empty air would.
enum class RightClickAction {
    None,
    TalkAldermast,
    TalkWilla,
    TalkGrimward,
    TalkBram,
    TalkOswin,
    TalkThessaly,
    TalkDorin,
    Attack,
    MineOrChop,
    Fish,
    Cook,
    Smelt,
    Forge,
    Till,
    Harvest,
};

constexpr const char* kRightClickMenuLayoutName = "RightClickMenu";
constexpr const char* kRightClickActionElementId = "rcm_action";
constexpr const char* kRightClickCancelActionId = "rcm_cancel";

RightClickAction& pendingRightClickAction() {
    static RightClickAction action = RightClickAction::None;
    return action;
}
std::string& rightClickActionLabel() {
    static std::string label;
    return label;
}
std::vector<BeUiElementOverride>& uiOverrideBuffer() {
    static std::vector<BeUiElementOverride> buf;
    return buf;
}

bool rightClickMenuOpen(const BeTileGridFrame* frame) {
    return frame->activeDialogLayoutName != nullptr &&
           std::strcmp(frame->activeDialogLayoutName, kRightClickMenuLayoutName) == 0;
}

// Read-only mirror of handleCombatAttack()'s own nearest-living-enemy scan
// (same kMeleeRangeWorldUnits/findEnemyDef()) -- no side effects, purely
// "is there a real target," so building the menu never fires a hitbox.
bool nearestLivingEnemyInRange(const BeTileGridFrame* frame) {
    if (frame->agents == nullptr) return false;
    for (int i = 0; i < frame->agentCount; ++i) {
        const BeAgentState& agent = frame->agents[i];
        if (agent.health <= 0.0f) continue;
        if (findEnemyDef(agent.kind) == nullptr) continue;
        const float dx = agent.worldX - frame->playerWorldX;
        const float dy = agent.worldY - frame->playerWorldY;
        if (dx * dx + dy * dy <= kMeleeRangeWorldUnits * kMeleeRangeWorldUnits) return true;
    }
    return false;
}

// Read-only mirror of handleMiningAndWoodcutting()'s own player-cell-plus-4-
// neighbors, layer-0-only scan -- returns the first matching MinableResource
// so the menu can show its real verb ("Mine"/"Chop"), or nullptr.
const MinableResource* findAdjacentMinableResource(BeTileGridFrame* frame) {
    if (frame->queryTileKindId == nullptr || frame->worldToCell == nullptr) return nullptr;
    int px, py;
    frame->worldToCell(frame->playerWorldX, frame->playerWorldY, &px, &py);
    constexpr int kDx[] = {0, 0, 0, -1, 1};
    constexpr int kDy[] = {0, -1, 1, 0, 0};
    for (int dir = 0; dir < 5; ++dir) {
        const char* kindId = frame->queryTileKindId(0, px + kDx[dir], py + kDy[dir]);
        if (kindId == nullptr || kindId[0] == '\0') continue;
        for (int i = 0; i < kMinableResourceCount; ++i) {
            if (std::strcmp(kindId, kMinableResources[i].tileKindId) == 0) return &kMinableResources[i];
        }
    }
    return nullptr;
}

// ---- Tile-kind-id lists for the remaining tile actions, mirroring each
// handler's own local array (handleFishing()'s kFishingSpotKinds is
// already file-scope and reused directly below; handleCooking()/
// handleSmelting()/handleForging()/handleTilling()/handleHarvesting()'s
// own kCookingFireKinds/kSmelterKinds/kAnvilKinds/kDirtKinds/kHomeCropKinds
// are each local to their own function, so the literal is duplicated here
// rather than touching five existing functions for a cosmetic hoist only
// this read-only resolver needs). ----
constexpr const char* const kRcmCookingFireKinds[] = {"cooking_fire"};
constexpr const char* const kRcmSmelterKinds[] = {"smelter"};
constexpr const char* const kRcmAnvilKinds[] = {"anvil"};
constexpr const char* const kRcmDirtKinds[] = {"dirt"};
constexpr const char* const kRcmHomeCropKinds[] = {"home_wheat", "home_turnip", "home_carrot", "home_potato",
                                                     "home_onion"};

// The real resolver: js/input.js's own priority order (ground bag -> NPC ->
// enemy -> mystery NPC -> getTileActions(tile)), minus the ground-bag
// branch (nothing to resolve it against, see this section's own doc
// comment) and the mystery-NPC branch (js/npcs.js's own mystery quest
// chain was never ported, same PORTING_PLAN.md finding startThessalyDialogue()
// already cites). Returns RightClickAction::None (and an empty label) when
// nothing real is adjacent.
RightClickAction resolveRightClickAction(BeTileGridFrame* frame, std::string* outLabel) {
    if (playerNearAldermast(frame)) {
        *outLabel = "Talk to Aldermast";
        return RightClickAction::TalkAldermast;
    }
    if (playerNearWilla(frame)) {
        *outLabel = "Talk to Willa";
        return RightClickAction::TalkWilla;
    }
    if (playerNearGrimward(frame)) {
        *outLabel = "Talk to Grimward";
        return RightClickAction::TalkGrimward;
    }
    if (playerNearBram(frame)) {
        *outLabel = "Talk to Bram (trade available)";
        return RightClickAction::TalkBram;
    }
    if (playerNearOswin(frame)) {
        *outLabel = "Talk to Oswin";
        return RightClickAction::TalkOswin;
    }
    if (playerNearThessaly(frame)) {
        *outLabel = "Talk to Thessaly";
        return RightClickAction::TalkThessaly;
    }
    if (playerNearDorin(frame)) {
        *outLabel = "Talk to Dorin (trade available)";
        return RightClickAction::TalkDorin;
    }
    if (nearestLivingEnemyInRange(frame)) {
        *outLabel = "Attack";
        return RightClickAction::Attack;
    }
    if (const MinableResource* res = findAdjacentMinableResource(frame)) {
        *outLabel = std::string(1, static_cast<char>(std::toupper(static_cast<unsigned char>(res->toastVerb[0])))) +
                    (res->toastVerb + 1);
        return RightClickAction::MineOrChop;
    }
    if (findAdjacentTileOfKind(frame, kFishingSpotKinds, 2, nullptr, nullptr, nullptr)) {
        *outLabel = "Fish";
        return RightClickAction::Fish;
    }
    if (findAdjacentTileOfKind(frame, kRcmCookingFireKinds, 1, nullptr, nullptr, nullptr)) {
        *outLabel = "Cook";
        return RightClickAction::Cook;
    }
    if (findAdjacentTileOfKind(frame, kRcmSmelterKinds, 1, nullptr, nullptr, nullptr)) {
        *outLabel = "Smelt";
        return RightClickAction::Smelt;
    }
    if (findAdjacentTileOfKind(frame, kRcmAnvilKinds, 1, nullptr, nullptr, nullptr)) {
        *outLabel = "Forge";
        return RightClickAction::Forge;
    }
    if (activeZoneId() == "homestead" && findAdjacentTileOfKind(frame, kRcmDirtKinds, 1, nullptr, nullptr, nullptr)) {
        *outLabel = "Till the soil";
        return RightClickAction::Till;
    }
    if (findAdjacentTileOfKind(frame, kRcmHomeCropKinds, 5, nullptr, nullptr, nullptr)) {
        *outLabel = "Harvest";
        return RightClickAction::Harvest;
    }
    return RightClickAction::None;
}

// Fires the SAME handler direct interact already calls for the chosen
// action, with `forced = true` so it runs regardless of this frame's
// interactPressed state -- see this section's own doc comment above for
// why this is not a second copy of any grant/dialogue logic.
void executeRightClickAction(BeTileGridFrame* frame, RightClickAction action) {
    switch (action) {
        case RightClickAction::TalkAldermast: startAldermastDialogue(frame, /*forced=*/true); return;
        case RightClickAction::TalkWilla: startBankDialogue(frame, /*forced=*/true); return;
        case RightClickAction::TalkGrimward: startGrimwardDialogue(frame, /*forced=*/true); return;
        case RightClickAction::TalkBram: startBramDialogue(frame, /*forced=*/true); return;
        case RightClickAction::TalkOswin: startOswinDialogue(frame, /*forced=*/true); return;
        case RightClickAction::TalkThessaly: startThessalyDialogue(frame, /*forced=*/true); return;
        case RightClickAction::TalkDorin: startDorinDialogue(frame, /*forced=*/true); return;
        case RightClickAction::Attack: handleCombatAttack(frame, /*forced=*/true); return;
        case RightClickAction::MineOrChop: handleMiningAndWoodcutting(frame, /*forced=*/true); return;
        case RightClickAction::Fish: handleFishing(frame, /*forced=*/true); return;
        case RightClickAction::Cook: handleCooking(frame, /*forced=*/true); return;
        case RightClickAction::Smelt: handleSmelting(frame, /*forced=*/true); return;
        case RightClickAction::Forge: handleForging(frame, /*forced=*/true); return;
        case RightClickAction::Till: handleTilling(frame, /*forced=*/true); return;
        case RightClickAction::Harvest: handleHarvesting(frame, /*forced=*/true); return;
        case RightClickAction::None: return;
    }
}

// Wiring: on the right-click edge, resolve+open (or toast "nothing to do"
// and open nothing); while open, keep the action label live and react to
// a real click on either choice. Guarded on activeDialogLayoutName being
// empty before opening -- same "don't steal focus from anything already
// on the dialog stack" convention every start*Dialogue()/
// handleDevConsoleToggle() above already uses.
void handleRightClickMenu(BeTileGridFrame* frame) {
    if (rightClickMenuOpen(frame)) {
        uiOverrideBuffer().clear();
        BeUiElementOverride ov{};
        ov.elementId = kRightClickActionElementId;
        ov.text = rightClickActionLabel().c_str();
        uiOverrideBuffer().push_back(ov);
        frame->requestedUiElementOverrides = uiOverrideBuffer().data();
        frame->requestedUiElementOverrideCount = static_cast<int>(uiOverrideBuffer().size());

        if (frame->clickedUiActionId != nullptr && frame->clickedUiActionId[0] != '\0') {
            if (std::strcmp(frame->clickedUiActionId, kRightClickActionElementId) == 0) {
                frame->requestedPopDialog = 1;
                executeRightClickAction(frame, pendingRightClickAction());
                pendingRightClickAction() = RightClickAction::None;
            } else if (std::strcmp(frame->clickedUiActionId, kRightClickCancelActionId) == 0) {
                frame->requestedPopDialog = 1;
                pendingRightClickAction() = RightClickAction::None;
            }
        }
        return;
    }

    if (!frame->mouseRightPressed) return;
    if (frame->activeDialogLayoutName != nullptr && frame->activeDialogLayoutName[0] != '\0') return;

    std::string label;
    const RightClickAction action = resolveRightClickAction(frame, &label);
    if (action == RightClickAction::None) {
        toastScratch() = "Nothing to do here.";
        frame->requestedToastText = toastScratch().c_str();
        return;
    }

    pendingRightClickAction() = action;
    rightClickActionLabel() = label;
    frame->requestedPushDialog = kRightClickMenuLayoutName;
}

// ======= Player HUD (js/ui.js's updateHUD(), item N4-UIWRITE) =======
// PORTING_PLAN.md's own js/ui.js row named this exact gap: js/ui.js's
// updateHUD() (line 342) keeps a persistent gold-hud/combat-lvl-hud display
// live every frame with no dialogue/menu open at all, and before item
// N4-UIWRITE there was no way for a plugin to write a live value onto a
// UILayout element outside dialogue's hardcoded speaker/body/choice
// bindings -- the health bar (already real/host-drawn per that
// investigation) was the one exception, since it never went through
// UILayoutOverrides at all. This closes the gold+combat-level half with the
// SAME BeUiElementOverride mechanism handleRightClickMenu() above already
// established, appended into the identical uiOverrideBuffer() rather than a
// second buffer -- see that function's own doc comment and
// GameModuleApi.h's BeUiElementOverride doc comment for why several entries
// (each touching a different elementId) coexist in one array with no
// conflict.
//
// **Coexistence with handleRightClickMenu() specifically**: that function
// calls uiOverrideBuffer().clear() itself, but only on the branch where the
// right-click menu is already open -- so this function must run AFTER
// handleRightClickMenu() in updateGrimstoneRuntime()'s dispatch (it does,
// see that function's own call order) and must APPEND rather than clear, or
// a frame with the menu open would have its rcm_action override wiped by
// this function's own entries instead of gaining them. Re-deriving
// frame->requestedUiElementOverrides/Count from the buffer's OWN current
// data()/size() (rather than trusting whatever handleRightClickMenu() set)
// is required too: appending to a std::vector can reallocate, which would
// leave frame->requestedUiElementOverrides dangling if it still pointed at
// the pre-append buffer.
//
// **Scope, first pass**: gold (kPlayerGoldFlag, the bank system's own flag)
// plus one derived "Combat Lv" summary line, mirroring js/ui.js's own real
// `cb = Math.floor((atk+def+str+hpLvl)/4)` formula exactly (updateHUD(),
// line 345) rather than inventing a new "active skill" concept this port
// has no other use for -- js/ui.js's own production HUD already treats
// combat level as ITS summary line, not a per-skill XP readout, so this
// reuses that same real precedent instead of guessing at a new one. The
// full per-skill XP-bar list (js/ui.js's separate, toggleable skills-panel,
// updateSkillDisplay() etc.) is a substantially larger, separately-scoped
// UI surface and is explicitly left for a future pass.
int playerHudCombatLevel(const BeTileGridFrame* frame) {
    const int atk = readSkillLevel(frame, GrimstoneSkill::Attack);
    const int def = readSkillLevel(frame, GrimstoneSkill::Defence);
    const int str = readSkillLevel(frame, GrimstoneSkill::Strength);
    const int hpLvl = readSkillLevel(frame, GrimstoneSkill::Hitpoints);
    return (atk + def + str + hpLvl) / 4;
}

constexpr const char* kHudGoldElementId = "hud_gold_text";
constexpr const char* kHudCombatElementId = "hud_combat_text";

std::string& hudGoldTextScratch() {
    static std::string text;
    return text;
}
std::string& hudCombatTextScratch() {
    static std::string text;
    return text;
}

void updatePlayerHud(BeTileGridFrame* frame) {
    const double gold = readFlag(frame, kPlayerGoldFlag, 0.0);
    hudGoldTextScratch() = "Gold: " + std::to_string(static_cast<int>(gold));
    hudCombatTextScratch() = "Combat Lv " + std::to_string(playerHudCombatLevel(frame));

    BeUiElementOverride goldOv{};
    goldOv.elementId = kHudGoldElementId;
    goldOv.text = hudGoldTextScratch().c_str();
    uiOverrideBuffer().push_back(goldOv);

    BeUiElementOverride combatOv{};
    combatOv.elementId = kHudCombatElementId;
    combatOv.text = hudCombatTextScratch().c_str();
    uiOverrideBuffer().push_back(combatOv);

    // Re-derive from the buffer's own current state rather than
    // incrementing whatever handleRightClickMenu() already set -- see this
    // section's own doc comment above for why (a push_back may reallocate).
    frame->requestedUiElementOverrides = uiOverrideBuffer().data();
    frame->requestedUiElementOverrideCount = static_cast<int>(uiOverrideBuffer().size());
}

// ======= Dev Console (js/devconsole.js) =======
// Transcribed from js/devconsole.js's runDevCommand() switch (lines 78-238)
// and its toggle/close wiring (toggleConsole()/the two keydown listeners,
// lines 62-70, 242-282). Read in full before writing any of this, per this
// pass's own task framing.
//
// **Gate, mirroring the JS's own (real, not invented)**: js/devconsole.js's
// toggleConsole() (line 63) has exactly ONE gate -- `if(!currentMap) return;`,
// i.e. "only while a game is actually loaded." It is NOT a dev-only/debug-
// build flag; the JS ships this exact command console reachable by any
// player who knows to press backtick, in production, with no further
// authorization check anywhere in the file (checked: no `DEBUG`/`isDev`/
// role check anywhere in devconsole.js). Mirrored as-is rather than
// invented-more-strict here: `updateGrimstoneRuntime()` only ever runs
// while a TileGrid is actually loaded and live (there is no "no game
// loaded" state it runs during), so that gate is automatically satisfied
// every time this file runs at all, and the one thing worth gating on for
// real is not stealing focus from another dialog already open (Aldermast's/
// Willa's own conversations, or anything else on the stack) -- the same
// `activeDialogLayoutName`-empty guard startAldermastDialogue()/
// startBankDialogue() already use above.
//
// **Toggle key, a REAL, documented substitution, not a guess**: the JS
// toggles on the backtick/tilde key (`e.key === '\`'`, lines 257, 278).
// This engine's custom-input surface (`BeTileGridFrame::keysDown`,
// ScriptInputKeys.h) is a deliberately small FIXED 44-key table -- A-Z,
// 0-9, the four arrows, Space, LeftShift, LeftControl, Escape -- with no
// backtick/grave/tilde key anywhere in it (checked the real table, not
// assumed from the header comment alone). There is therefore no way to
// reproduce the JS's exact keybind through this ABI at all; LeftControl+L
// is substituted here (documented, not silently different) as the closest
// available "modifier + letter, not used by movement/interact" combo.
// Escape, unlike backtick, genuinely IS in the fixed table, so the JS's
// OWN secondary close-key (`e.key === 'Escape' || e.key === '\`'`, same
// line 257) is reproduced exactly for closing, even though opening can't
// use the same key the JS does.
//
// **The real, load-bearing gap this section used to document is now
// CLOSED, schema-side**: a hand-authored `content/ui-layouts.json` (new,
// this pass) now carries both `kDialogueTemplateLayoutName`
// ("DialogueTemplate" -- a speaker Label id `dlg_speaker`, a body Label id
// `dlg_body`, and `kMaxDialogueChoices` (4) interactive choice Labels ids
// `dlg_choice_0`..`dlg_choice_3` with matching `actionId`s, exactly the
// element-id/actionId convention `TileGridHostRunner.cpp`'s own
// `UILayoutOverrides` dialogue-tree binding reads -- confirmed by reading
// that binding code, not guessed) and `kDevConsoleLayoutName`
// ("DevConsoleTemplate" -- a TextInput id exactly `kDevConsoleInputElementId`
// plus an interactive Label id/actionId exactly `kDevConsoleSubmitActionId`,
// below). Both layouts are verified against `UILayout.h`'s real struct
// fields AND its real serializer (`UILayout.cpp`'s `parseElement()`/
// `elementToJson()`/`parseLayout()`), not guessed from a header comment
// alone -- same discipline `content/weapons.json`/`content/dialogue-trees.json`
// already established for this port's other hand-authored content.
// **What's still open, same shape as every other hand-authored content
// file in this port**: `content/ui-layouts.json` has no packaging/copy-to-
// `<BE_DATA_DIR>` step of its own -- checked, and there ISN'T one for
// `content/weapons.json`/`content/dialogue-trees.json` either (this
// project's own `CMakeLists.txt` builds only the plugin `.so`, no content-
// copy step exists anywhere in this repo), so this is not a gap specific
// to UI content, it's this port's existing, already-documented convention:
// a file at `<BE_DATA_DIR>/ui-layouts.json` is what `uiLayoutLibrary()`
// (UILayout.h) actually reads at runtime (confirmed: `libraryPath()` in
// `UILayout.cpp` resolves to `userDataDir() / "ui-layouts.json"`), so this
// new file still needs to be copied there (or wired into a packaging step)
// before a running engine actually loads it -- not yet done, and, with no
// engine build existing in this sandbox, NOT verified against a real
// running engine, only against the real C++ schema/serializer read in full
// above. Once it's in place, the toggle/open/close plumbing plus the REAL,
// fully working command parser/dispatcher below need no further source
// change to start actually rendering end to end -- verified against every
// helper it reuses (queueXpGrant/queueItemGrant/kPlayerGoldFlag/
// requestedHealthDelta).
constexpr const char* kDevConsoleLayoutName = "DevConsoleTemplate";
constexpr const char* kDevConsoleInputElementId = "dev_console_input";
constexpr const char* kDevConsoleSubmitActionId = "dev_console_submit";
constexpr const char* kDevConsoleToggleKey = "L"; // + LeftControl -- see this section's own doc comment

// Transcribed verbatim from js/version.js's own `GAME_VERSION` global and
// its changelog comment block (lines 1-19) -- the only version constant
// that exists anywhere in the reference JS. This port previously had NO
// equivalent constant anywhere in src/ or project.json (the `version`
// command below reported a fixed placeholder string instead); this is
// that constant, finally given a real home. js/version.js's own update-
// checker/Service-Worker-banner machinery (checkForUpdate()/
// showUpdateBanner()/applyUpdate(), lines 21-71) has no analog here and
// isn't ported -- there is no engine-side "fetch a raw file from GitHub
// and compare semver" primitive, and, per this item's own task framing
// (a small, `version`-command-only pass), inventing one for a cosmetic
// "new version available" banner is real over-scope, not this pass's job.
constexpr const char* kGameVersion = "0.6.4";

// One entry per js/version.js changelog line (its own comment block,
// lines 8-18), oldest last exactly as the JS lists them. A judgement
// call, not a default: this could instead be its own DialogueTemplate
// node (content/ui-layouts.json already has the schema, per this
// section's own doc comment above) with one choice per changelog entry,
// but that's a real multi-node dialogue tree built for what is, at
// bottom, still just a version string with some history attached --
// exactly the "don't over-build a dialogue tree for a version number"
// case this pass's own task framing calls out. A single toast, the same
// surface every other dev-console command already reports through, is
// the right size for this: see the "version"/"versionlog" commands below.
constexpr const char* kVersionChangelog[] = {
    "0.6.4 -- Homestead cabin interior with movable bed; door now enterable",
    "0.6.3 -- Homestead sigil usable without quest flag (auto-grants on use)",
    "0.6.2 -- Ground bags: dropped items appear as bags; right-click to pick up",
    "0.6.1 -- Dev console (` key): give/gold/heal/tp/setskill/xp/flag commands",
    "0.6.0 -- Save migration system; Service Worker offline support + auto-update banner",
    "0.5.0 -- PeerJS P2P co-op (up to 4 players), in-game session start/stop",
    "0.4.0 -- Homestead feature: Old Bertram quest, farming, crop rendering",
    "0.3.0 -- World map (M key), crop respawn, dungeon loot, inn sleep restriction",
    "0.2.0 -- Monolithic HTML split into organised file structure; bug fixes",
    "0.1.0 -- Initial release",
};
constexpr int kVersionChangelogCount = sizeof(kVersionChangelog) / sizeof(kVersionChangelog[0]);

bool isKeyDown(const BeTileGridFrame* frame, const char* name) {
    if (frame->keysDown == nullptr) return false;
    for (int i = 0; i < frame->keysDownCount; ++i)
        if (frame->keysDown[i] != nullptr && std::strcmp(frame->keysDown[i], name) == 0) return true;
    return false;
}

bool devConsoleOpen(const BeTileGridFrame* frame) {
    return frame->activeDialogLayoutName != nullptr && std::strcmp(frame->activeDialogLayoutName, kDevConsoleLayoutName) == 0;
}

// Edge-detects the LeftControl+L combo (own flag, same "own the
// accumulator/last-state as a flag since this file keeps no persistent
// struct of its own" discipline handleFarmGrowthTick() already
// establishes) so holding the combo down doesn't reopen/reclose the
// console every single frame.
void handleDevConsoleToggle(BeTileGridFrame* frame) {
    const bool comboDown = isKeyDown(frame, "LeftControl") && isKeyDown(frame, kDevConsoleToggleKey);
    const bool wasDown = readFlag(frame, "dev_console_toggle_key_was_down", 0.0) != 0.0;
    queueFlagSet("dev_console_toggle_key_was_down", comboDown ? 1.0 : 0.0);

    if (comboDown && !wasDown) {
        if (devConsoleOpen(frame)) {
            frame->requestedPopDialog = 1;
        } else if (frame->activeDialogLayoutName == nullptr || frame->activeDialogLayoutName[0] == '\0') {
            // Don't steal focus from Aldermast/Willa/anything else already
            // on the dialog stack -- same guard startAldermastDialogue()/
            // startBankDialogue() already use above.
            frame->requestedPushDialog = kDevConsoleLayoutName;
        }
        return;
    }

    // Mirrors the JS's own dual close-key (`Escape` OR backtick, line 257)
    // -- Escape genuinely is in the fixed keysDown table, unlike backtick.
    if (devConsoleOpen(frame) && isKeyDown(frame, "Escape")) {
        frame->requestedPopDialog = 1;
    }
}

const char* findTextInputValue(const BeTileGridFrame* frame, const char* elementId) {
    if (frame->activeTextInputs == nullptr) return nullptr;
    for (int i = 0; i < frame->activeTextInputCount; ++i) {
        const BeUiTextInputState& ti = frame->activeTextInputs[i];
        if (ti.elementId != nullptr && std::strcmp(ti.elementId, elementId) == 0) return ti.text;
    }
    return nullptr;
}

std::string devConsoleToLower(std::string s) {
    for (char& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    return s;
}

// Mirrors runDevCommand()'s own `raw.trim().split(/\s+/)` (line 74).
std::vector<std::string> devConsoleSplitWhitespace(const std::string& s) {
    std::vector<std::string> parts;
    size_t i = 0;
    while (i < s.size()) {
        while (i < s.size() && std::isspace(static_cast<unsigned char>(s[i]))) ++i;
        const size_t start = i;
        while (i < s.size() && !std::isspace(static_cast<unsigned char>(s[i]))) ++i;
        if (i > start) parts.push_back(s.substr(start, i - start));
    }
    return parts;
}

// Same display-name order as kSkillXpFlagKeys/GrimstoneSkill above --
// case-insensitively matched, mirroring the JS's own
// `charAt(0).toUpperCase()+slice(1).toLowerCase()` capitalization dance
// (setskill/xp, lines 172, 187) with a plain case-fold instead (this port
// has no `p.skills` object whose exact-cased keys need matching, just this
// file's own fixed enum).
constexpr const char* kSkillDisplayNames[kSkillCount] = {
    "Mining", "Smithing", "Woodcutting", "Crafting", "Fishing", "Cooking", "Farming",
    "Attack", "Defence", "Strength", "Hitpoints",
};

bool findSkillByName(const std::string& name, GrimstoneSkill* outSkill) {
    const std::string lower = devConsoleToLower(name);
    for (int i = 0; i < kSkillCount; ++i) {
        if (devConsoleToLower(kSkillDisplayNames[i]) == lower) {
            *outSkill = static_cast<GrimstoneSkill>(i);
            return true;
        }
    }
    return false;
}

void devConsoleToast(BeTileGridFrame* frame, const std::string& text) {
    toastScratch() = text;
    frame->requestedToastText = toastScratch().c_str();
}

// The parser/dispatcher itself -- js/devconsole.js's own switch(cmd), lines
// 78-238, one case at a time. Every command reports its result via a toast
// (this section's own doc comment explains why: no richer on-screen log
// surface exists yet) instead of devPrint()'s scrolling log pane.
void runDevConsoleCommand(BeTileGridFrame* frame, const std::string& raw) {
    const std::vector<std::string> parts = devConsoleSplitWhitespace(raw);
    if (parts.empty()) return; // mirrors the JS's own `case '': return;`

    const std::string cmd = devConsoleToLower(parts[0]);
    const std::vector<std::string> args(parts.begin() + 1, parts.end());

    if (cmd == "help") {
        devConsoleToast(frame,
                         "give <item> [qty] | gold <amt> | addgold <amt> | heal | tp <0-4> | "
                         "setskill <skill> <lvl> | xp <skill> <amt> | flag <name> [value] | "
                         "clearinv | version | versionlog | clear");
        return;
    }

    if (cmd == "give") {
        if (args.empty()) {
            devConsoleToast(frame, "Usage: give <item_id> [qty]");
            return;
        }
        // js's own alias map (line 101): sigil->home_sigil, seed->wheat_seed;
        // wheat->wheat is an identity no-op in the JS, nothing to remap here.
        std::string itemId = args[0];
        if (itemId == "sigil") itemId = "home_sigil";
        else if (itemId == "seed") itemId = "wheat_seed";
        int qty = 1;
        if (args.size() > 1) {
            qty = std::atoi(args[1].c_str());
            if (qty < 1) qty = 1;
        }
        // No item-registry validation exists anywhere in this port to
        // mirror the JS's own `if(!ITEMS[itemId])` check against (this
        // whole file already grants arbitrary plugin-authored item id
        // strings with no such registry, e.g. handleCombatDeathRewards()'s
        // own unconditional `queueItemGrant("bones", 1)` above) -- an
        // unknown id here is granted exactly like every other activity's
        // grants already are, real behavior, not a gap this command
        // introduces on its own.
        queueItemGrant(internString(itemId), qty);
        devConsoleToast(frame, "+ " + std::to_string(qty) + "x " + itemId);
        return;
    }

    if (cmd == "gold" || cmd == "addgold") {
        if (args.empty()) {
            devConsoleToast(frame, "Usage: " + cmd + " <amount>");
            return;
        }
        char* parseEnd = nullptr;
        const long amt = std::strtol(args[0].c_str(), &parseEnd, 10);
        if (parseEnd == args[0].c_str()) {
            devConsoleToast(frame, "Usage: " + cmd + " <amount>");
            return;
        }
        const double current = readFlag(frame, kPlayerGoldFlag, 0.0);
        double newGold = (cmd == "gold") ? static_cast<double>(amt) : current + static_cast<double>(amt);
        if (newGold < 0.0) newGold = 0.0; // js's own `Math.max(0, ...)`, both commands (lines 121, 131)
        queueFlagSet(kPlayerGoldFlag, newGold);
        if (cmd == "gold") {
            devConsoleToast(frame, "Gold set to " + std::to_string(static_cast<long long>(newGold)));
        } else {
            devConsoleToast(frame, "Gold: " + std::to_string(static_cast<long long>(newGold)) + " (" +
                                        (amt >= 0 ? "+" : "") + std::to_string(amt) + ")");
        }
        return;
    }

    if (cmd == "heal") {
        // js's own `p.hp = p.maxHp` (line 140) -- the host's own
        // requestedHealthDelta is a signed DELTA, not an absolute set
        // (GameModuleApi.h's v15->v16 doc comment), so this heals exactly
        // the gap to full rather than overshooting (already clamped to
        // [0, playerMaxHealth] host-side regardless).
        const float delta = frame->playerMaxHealth - frame->playerHealth;
        if (delta > 0.0f) frame->requestedHealthDelta = delta;
        devConsoleToast(frame, "HP restored to " + std::to_string(static_cast<int>(frame->playerMaxHealth)));
        return;
    }

    if (cmd == "tp") {
        // Real zone swap, using the exact same mechanism a portal
        // TileMarker fires (see the "======= Zone transitions ======="
        // section's own doc comment above) -- this used to be a
        // documented, unfixed gap (js's own tp, lines 147-168, swaps
        // `zoneIndex` in-process; this port had no slug/index -> file-path
        // table anywhere), closed by zoneSlugToTileGrid()
        // (GrimstoneGame.h/.cpp) + zonetransition::requestZoneSwap() above.
        static const char* const kZoneNames[] = {"Ashenveil", "Ashen Moor", "Iron Peaks", "Cursed Marshes",
                                                   "Obsidian Depths"};
        static const char* const kZoneSlugs[] = {"ashenveil", "ashen_moor", "iron_peaks", "cursed_marshes",
                                                   "obsidian_depths"};
        if (args.empty()) {
            devConsoleToast(frame, "Usage: tp <0-4>  (0=Ashenveil, 1=Ashen Moor, 2=Iron Peaks, "
                                    "3=Cursed Marshes, 4=Obsidian Depths)");
            return;
        }
        const int idx = std::atoi(args[0].c_str());
        if (idx < 0 || idx > 4) {
            devConsoleToast(frame, "Usage: tp <0-4>  (0=Ashenveil, 1=Ashen Moor, 2=Iron Peaks, "
                                    "3=Cursed Marshes, 4=Obsidian Depths)");
            return;
        }
        if (zonetransition::requestZoneSwap(frame, kZoneSlugs[idx])) {
            devConsoleToast(frame, std::string("Teleporting to ") + kZoneNames[idx] + "...");
            daynight::forceChange(); // same "recompute weather for the new zone right away" as a real portal
        }
        return;
    }

    if (cmd == "setskill") {
        if (args.size() < 2) {
            devConsoleToast(frame, "Usage: setskill <skill> <lvl>");
            return;
        }
        GrimstoneSkill skill;
        if (!findSkillByName(args[0], &skill)) {
            std::string list;
            for (int i = 0; i < kSkillCount; ++i) list += (i > 0 ? ", " : "") + std::string(kSkillDisplayNames[i]);
            devConsoleToast(frame, "Unknown skill. Valid: " + list);
            return;
        }
        int lvl = std::atoi(args[1].c_str());
        if (lvl < 1) lvl = 1;
        if (lvl > 99) lvl = 99;
        // Sets the skill's XP flag to exactly the threshold for `lvl`
        // (SET, not INCREMENT) -- levelForXp() then reports `lvl` exactly,
        // mirroring the JS's own direct `p.skills[skillName].lvl = lvl`
        // (line 178) as closely as a level-derived-from-xp store allows;
        // syncHitpointsMaxHealth() picks up a Hitpoints change on the very
        // next frame with no separate call needed here.
        queueFlagSet(kSkillXpFlagKeys[static_cast<int>(skill)], xpForLevel(lvl));
        devConsoleToast(frame, std::string(kSkillDisplayNames[static_cast<int>(skill)]) + " set to level " +
                                    std::to_string(lvl));
        return;
    }

    if (cmd == "xp") {
        if (args.size() < 2) {
            devConsoleToast(frame, "Usage: xp <skill> <amount>");
            return;
        }
        GrimstoneSkill skill;
        if (!findSkillByName(args[0], &skill)) {
            std::string list;
            for (int i = 0; i < kSkillCount; ++i) list += (i > 0 ? ", " : "") + std::string(kSkillDisplayNames[i]);
            devConsoleToast(frame, "Unknown skill. Valid: " + list);
            return;
        }
        const double amount = std::atof(args[1].c_str());
        // Reuses the SAME queueXpGrant() helper every combat/activity
        // system in this file already grants XP through, per this pass's
        // own task framing -- not a second, hand-rolled xp write.
        queueXpGrant(skill, amount);
        devConsoleToast(frame, "+" + std::to_string(static_cast<long long>(amount)) + " XP -> " +
                                    kSkillDisplayNames[static_cast<int>(skill)]);
        return;
    }

    if (cmd == "flag") {
        if (args.empty()) {
            devConsoleToast(frame, "Usage: flag <name> [value]");
            return;
        }
        const std::string& name = args[0];
        if (args.size() < 2) {
            // js's own questFlags.X reads back `undefined` for a never-set
            // flag (line 208) -- this store has no such third state (a
            // missing key and one explicitly set to 0 are indistinguishable
            // via readFlag()'s own default-value contract), a real, minor
            // deviation documented here rather than silently matched.
            const double v = readFlag(frame, name.c_str(), 0.0);
            devConsoleToast(frame, name + " = " + std::to_string(v));
        } else {
            // js's own true/false/null literal parsing (line 210) -- this
            // store is numeric-double only (TileGridFlagStore.h), so
            // "null" has no analog and is treated as an ordinary (failing
            // to parse as a number) string, landing at 0.0 via atof()'s
            // own "no valid conversion" contract, same as any other
            // non-numeric token typed here.
            double val;
            if (args[1] == "true") val = 1.0;
            else if (args[1] == "false") val = 0.0;
            else val = std::atof(args[1].c_str());
            queueFlagSet(internString(name), val);
            devConsoleToast(frame, name + " = " + std::to_string(val));
        }
        return;
    }

    if (cmd == "clearinv") {
        // No single "empty the whole inventory" primitive exists
        // (TileGridInventory.h) -- removes every occupied slot's own
        // count via the SAME BeItemDelta array every other grant/consume
        // in this file already drains through, one entry per slot.
        for (int i = 0; i < frame->inventoryCount; ++i) {
            const BeInventorySlot& slot = frame->inventory[i];
            if (slot.itemId != nullptr && slot.itemId[0] != '\0' && slot.count > 0) queueItemGrant(slot.itemId, -slot.count);
        }
        devConsoleToast(frame, "Inventory cleared.");
        return;
    }

    if (cmd == "version") {
        // js's own GAME_VERSION global (js/version.js line 19) DOES have a
        // real equivalent now (kGameVersion above, transcribed from that
        // same file) -- reports the real transcribed version instead of
        // the fixed placeholder string this used to report, plus the
        // single most recent changelog line (kVersionChangelog[0], same
        // "newest first" order js/version.js's own comment block uses) so
        // this single toast still carries "what changed most recently"
        // without dumping the whole history js's own version.js has no
        // in-game display for either (that lives in a source comment
        // there, not any on-screen UI) -- see "versionlog" below for the
        // full list.
        devConsoleToast(frame, "Grimstone v" + std::string(kGameVersion) +
                                    " (LiminalEngine/BEditor 2D port) -- " + kVersionChangelog[0]);
        return;
    }

    if (cmd == "versionlog") {
        // The full js/version.js changelog (kVersionChangelog above), one
        // toast, newest first -- same "one long piped string" shape this
        // file's own "help" command above already uses for a multi-item
        // report, rather than a new UI surface (see kVersionChangelog's
        // own doc comment on why this isn't a DialogueTemplate node).
        std::string log = "Grimstone changelog: ";
        for (int i = 0; i < kVersionChangelogCount; ++i) {
            if (i > 0) log += " | ";
            log += kVersionChangelog[i];
        }
        devConsoleToast(frame, log);
        return;
    }

    if (cmd == "clear") {
        // No-op: there is no on-screen scrollback log for this to clear
        // (see this section's own top-of-file doc comment on the missing
        // DevConsoleTemplate UILayout) -- js's own `clear` (line 232-234)
        // empties `logEl.innerHTML`, which has no analog here yet.
        return;
    }

    devConsoleToast(frame, "Unknown command: " + cmd + ". Type 'help' for a list.");
}

// Wiring (Part 4, same split every other dialog system in this file uses):
// toggle open/close every frame, then react to a real submit click the
// moment the (currently unauthored, see this section's own doc comment)
// DevConsoleTemplate layout's own submit button fires one.
void handleDevConsole(BeTileGridFrame* frame) {
    handleDevConsoleToggle(frame);

    if (!devConsoleOpen(frame)) return;
    if (frame->clickedUiActionId == nullptr || frame->clickedUiActionId[0] == '\0') return;
    if (std::strcmp(frame->clickedUiActionId, kDevConsoleSubmitActionId) != 0) return;

    const char* typed = findTextInputValue(frame, kDevConsoleInputElementId);
    if (typed == nullptr) return;
    runDevConsoleCommand(frame, typed);
}

} // namespace

void setGrimstoneRuntimeAssetDir(const std::filesystem::path& assetDir) { zonetransition::assetDir() = assetDir; }

void updateGrimstoneRuntime(BeTileGridFrame* frame) {
    if (frame == nullptr) return;

    flagUpdateBuffer().clear();
    itemUpdateBuffer().clear();
    tileEditBuffer().clear();
    timerStartBuffer().clear();
    hitboxBuffer().clear();
    objectiveUpdateBuffer().clear();
    stringUpdateBuffer().clear();
    stringScratch().clear();
    uiOverrideBuffer().clear();

    syncHitpointsMaxHealth(frame);
    handleZoneTransition(frame); // before every other system -- see its own doc comment above
    daynight::updateDayNightCycle(frame); // per-frame, not gated on interactPressed
    daynight::updateWeather(frame);       // per-frame, not gated on interactPressed -- reads activeZoneId(), so after handleZoneTransition()
    daynight::fireWeatherParticles(frame); // per-frame, not gated on interactPressed
    daynight::updateColorGrade(frame);     // per-frame, not gated on interactPressed -- reads currentGameTime()/currentWeather(), so after the two calls above
    handleMiningAndWoodcutting(frame);
    handleCombatAttack(frame);
    handleCombatDeathRewards(frame); // per-frame, not gated on interactPressed
    handleFishing(frame);
    handleCooking(frame);
    handleSmelting(frame);
    handleForging(frame);
    handleFarmGrowthTick(frame); // per-frame, not gated on interactPressed
    handleTilling(frame);
    handlePlanting(frame);
    handleHarvesting(frame);
    updateAldermastObjectives(frame);  // per-frame, not gated on interactPressed
    startAldermastDialogue(frame);
    applyAldermastDialogueSideEffects(frame);
    overrideAldermastLiveDialogueText(frame);
    updateStockMarket(frame);   // per-frame, not gated on interactPressed
    handleBondMaturity(frame);  // per-frame, not gated on interactPressed
    startBankDialogue(frame);
    applyBankDialogueSideEffects(frame);
    overrideBankMenuLiveDialogueText(frame);
    startGrimwardDialogue(frame);
    startBramDialogue(frame);
    applyBramDialogueSideEffects(frame);
    overrideBramLiveDialogueText(frame);
    startOswinDialogue(frame);
    overrideOswinLiveDialogueText(frame);
    startThessalyDialogue(frame);
    startDorinDialogue(frame);
    applyDorinDialogueSideEffects(frame);
    overrideDorinLiveDialogueText(frame);
    handleRightClickMenu(frame);
    handleDevConsole(frame);
    updatePlayerHud(frame); // after handleRightClickMenu() -- see that function's own coexistence note above

    // Drain the scratch buffers into the frame's own write-back arrays --
    // done last so every system above had a chance to queue into them
    // first. Left empty (the common case, most frames), these are exactly
    // the same "0 count" no-op every other array write-back in this ABI
    // already documents.
    if (!flagUpdateBuffer().empty()) {
        frame->requestedFlagUpdates = flagUpdateBuffer().data();
        frame->requestedFlagUpdateCount = static_cast<int>(flagUpdateBuffer().size());
    }
    if (!itemUpdateBuffer().empty()) {
        frame->requestedItemUpdates = itemUpdateBuffer().data();
        frame->requestedItemUpdateCount = static_cast<int>(itemUpdateBuffer().size());
    }
    if (!tileEditBuffer().empty()) {
        frame->requestedTileEdits = tileEditBuffer().data();
        frame->requestedTileEditCount = static_cast<int>(tileEditBuffer().size());
    }
    if (!timerStartBuffer().empty()) {
        frame->requestedTimerStarts = timerStartBuffer().data();
        frame->requestedTimerStartCount = static_cast<int>(timerStartBuffer().size());
    }
    if (!hitboxBuffer().empty()) {
        frame->requestedHitboxes = hitboxBuffer().data();
        frame->requestedHitboxCount = static_cast<int>(hitboxBuffer().size());
    }
    if (!objectiveUpdateBuffer().empty()) {
        frame->requestedObjectiveUpdates = objectiveUpdateBuffer().data();
        frame->requestedObjectiveUpdateCount = static_cast<int>(objectiveUpdateBuffer().size());
    }
    if (!stringUpdateBuffer().empty()) {
        frame->requestedStringUpdates = stringUpdateBuffer().data();
        frame->requestedStringUpdateCount = static_cast<int>(stringUpdateBuffer().size());
    }
}
