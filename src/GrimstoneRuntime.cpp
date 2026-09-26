#include "GrimstoneRuntime.h"

#include <cctype>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <string>
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

void handleMiningAndWoodcutting(BeTileGridFrame* frame) {
    if (!frame->interactPressed) return;
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
void handleCombatAttack(BeTileGridFrame* frame) {
    if (!frame->interactPressed) return;
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

// ======= Fishing =======
// Transcribed from js/activities.js's FISH_TABLE (lines 99-139) and
// startFish()/catchFish() (lines 447-500, 700-717), and js/input.js's own
// tackle-menu wiring (lines 482-486, openFishingMenu() at
// js/activities.js line 430).
//
// Two REAL, documented gaps versus the JS, not simplifications this port
// can paper over:
//   1. FISH_TABLE's own `zones` column (which of the 4 ZONE_CONFIGS biome
//      indices a fish can appear in) is NOT applied here. There is no way
//      to read which zone/level is currently active from BeTileGridFrame
//      -- requestedLevelPath (GameModuleApi.h) is WRITE-ONLY (it REQUESTS a
//      zone swap; nothing on the frame reports the zone the plugin is
//      CURRENTLY in), and no zoneIndex/currentLevelPath/zoneName read field
//      exists anywhere on the struct. Every fish in the table below is
//      treated as available in every zone. This is the "real gap" this
//      port's own PORTING_PLAN.md now records rather than guesses around.
//   2. `timeOfDay`/`weather` columns are likewise omitted -- per
//      PORTING_PLAN.md, no day/night or weather state is tracked anywhere
//      in this port yet, so every fish is treated as always in season
//      (the JS's own `timeOfDay:'any'`/no `weather` key default, applied
//      unconditionally rather than selectively).
// Everything else -- minLvl, tackle, xp, rarity -- is real, transcribed
// from the JS's own numbers.
enum FishTackle {
    kTackleBait = 1 << 0,
    kTackleFly = 1 << 1,
    kTackleHarpoon = 1 << 2,
};

struct FishEntry {
    const char* rawItemId;
    const char* cookedItemId; // js/activities.js's own COOKED map (line 141)
    int minLevel;
    int tackleMask;
    double xp;
    double rarity;
};

constexpr FishEntry kFishTable[] = {
    // Standard fish (any time, any weather) -- js/activities.js lines 101-108
    {"raw_shrimp", "cooked_shrimp", 1, kTackleBait, 10.0, 1.0},
    {"raw_trout", "cooked_trout", 5, kTackleBait | kTackleFly, 50.0, 0.75},
    {"raw_salmon", "cooked_salmon", 10, kTackleFly, 70.0, 0.65},
    {"raw_pike", "cooked_pike", 15, kTackleBait | kTackleFly, 90.0, 0.55},
    {"raw_tuna", "cooked_tuna", 20, kTackleHarpoon, 115.0, 0.45},
    {"raw_swordfish", "cooked_swordfish", 35, kTackleHarpoon, 155.0, 0.30},
    {"raw_shark", "cooked_shark", 50, kTackleHarpoon, 220.0, 0.15},
    {"raw_leviathan", "cooked_leviathan", 60, kTackleHarpoon, 300.0, 0.08},
    // Day-only fish -- lines 111-114 (timeOfDay/weather gap, see above)
    {"raw_sunscale", "cooked_sunscale", 5, kTackleBait | kTackleFly, 45.0, 0.70},
    {"raw_gilded_carp", "cooked_gilded_carp", 22, kTackleFly, 100.0, 0.40},
    // Night-only fish -- lines 117-122
    {"raw_moonshadow", "cooked_moonshadow", 25, kTackleFly, 130.0, 0.35},
    {"raw_ghostfin", "cooked_ghostfin", 40, kTackleBait, 175.0, 0.20},
    {"raw_shadowcrawler", "cooked_shadowcrawler", 55, kTackleHarpoon, 260.0, 0.10},
    // Rain fish -- lines 125-130
    {"raw_stormcatch", "cooked_stormcatch", 18, kTackleBait | kTackleFly, 95.0, 0.45},
    {"raw_raindrop_dace", "cooked_raindrop_dace", 8, kTackleBait, 60.0, 0.65},
    {"raw_torrent_fin", "cooked_torrent_fin", 45, kTackleHarpoon, 195.0, 0.18},
    // Fog fish -- lines 133-138
    {"raw_mistwalker", "cooked_mistwalker", 12, kTackleFly, 80.0, 0.50},
    {"raw_phantom_crab", "cooked_phantom_crab", 30, kTackleBait, 145.0, 0.28},
    {"raw_veilfish", "cooked_veilfish", 50, kTackleHarpoon | kTackleFly, 240.0, 0.12},
};
constexpr int kFishTableSize = sizeof(kFishTable) / sizeof(kFishTable[0]);

const char* const kFishingSpotKinds[] = {"fishing_spot", "fishing_spot_2"};

void handleFishing(BeTileGridFrame* frame) {
    if (!frame->interactPressed) return;
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

    // Eligible = level + tackle only -- see this function's own doc comment
    // for the zone/time-of-day/weather gap.
    int eligibleIdx[kFishTableSize];
    int eligibleCount = 0;
    double totalWeight = 0.0;
    for (int i = 0; i < kFishTableSize; ++i) {
        const FishEntry& f = kFishTable[i];
        if (fishLevel < f.minLevel) continue;
        if ((f.tackleMask & tackleMask) == 0) continue;
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
void handleCooking(BeTileGridFrame* frame) {
    if (!frame->interactPressed) return;
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

void handleSmelting(BeTileGridFrame* frame) {
    if (!frame->interactPressed) return;
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

void handleForging(BeTileGridFrame* frame) {
    if (!frame->interactPressed) return;
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

void handleTilling(BeTileGridFrame* frame) {
    if (!frame->interactPressed) return;
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
    // Deliberate simplification: the JS also gates this to
    // currentMap.name === 'YOUR HOMESTEAD' (tillTile() line 2055) -- same
    // real gap handleFishing() documents above (no current-zone/level-name
    // read exists on BeTileGridFrame), so this tills ANY registered "dirt"
    // tile the player is adjacent to, wherever that happens to be.
}

void handlePlanting(BeTileGridFrame* frame) {
    if (!frame->interactPressed) return;
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

void handleHarvesting(BeTileGridFrame* frame) {
    if (!frame->interactPressed) return;
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
void startAldermastDialogue(BeTileGridFrame* frame) {
    if (!frame->interactPressed) return;
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

void startBankDialogue(BeTileGridFrame* frame) {
    if (!frame->interactPressed) return;
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
// **The real, load-bearing gap, same shape as this file's other "found
// while wiring this up" notes**: PORTING_PLAN.md's own js/quests.js row
// already documents that no `DialogueTemplate` UILayout has been authored
// anywhere in `content/` yet, so `requestedPushDialog("dialogue:...")` has
// nowhere to actually draw a speaker/body/choices. The dev console needs
// its OWN UILayout for the exact same reason and has the exact same gap:
// no UILayout named `kDevConsoleLayoutName` ("DevConsoleTemplate") exists
// anywhere in this repo's content, and Grimstone doesn't author ANY
// UILayout at all yet (checked: no `hudLayoutName`/UILayout content
// anywhere in GrimstoneGame.h/.cpp) -- so there is currently no HUD
// screen, dialog screen, or otherwise, that this port draws through this
// engine's UILayout system at all. Pushing `kDevConsoleLayoutName` onto
// the dialog stack is real (`TileGridHostRunner.cpp`'s `pushDialogOrTree()`
// unconditionally does `dialogStack.push(name)` for any non-"dialogue:"
// name, confirmed by reading it, not guessed), and it correctly reports
// back via `activeDialogLayoutName`/suppresses movement exactly like any
// other pushed dialog -- but with no UILayout of that name authored, the
// screen has nothing to draw and the player sees nothing (the same "opens
// a screen with nothing on it" behavior an unauthored `DialogueTemplate`
// push would already have). This is NOT faked around here: rather than
// inventing a fallback rendering path this ABI doesn't offer (there is no
// primitive for a plugin to draw its own text/log surface beyond a single
// toast line -- checked, `requestedSprites` is world-space shapes only, no
// text), this ships the REAL toggle/open/close plumbing plus a REAL,
// fully working command parser/dispatcher below, verified against every
// helper it reuses (queueXpGrant/queueItemGrant/kPlayerGoldFlag/
// requestedHealthDelta), and documents exactly what a future UILayout-
// authoring pass needs to actually put it on screen:
//   - A UILayout named exactly `kDevConsoleLayoutName` ("DevConsoleTemplate").
//   - One TextInput element with id exactly `kDevConsoleInputElementId`
//     ("dev_console_input") -- its live typed value shows up in
//     `frame->activeTextInputs` (BeUiTextInputState) the moment the player
//     focuses it, per that struct's own doc comment.
//   - One submit button (or Enter-bound element) with actionId exactly
//     `kDevConsoleSubmitActionId` ("dev_console_submit") -- `handleDevConsole()`
//     below reacts to it showing up in `frame->clickedUiActionId` the SAME
//     way every other dialog-side-effect handler in this file already does.
//   - Optionally a Label to show `requestedToastText`'s own last result as
//     a persistent line instead of a fading toast -- not required for the
//     command dispatch below to work, since every command already reports
//     its result via the SAME toast mechanism handleMiningAndWoodcutting()/
//     etc. already use for lack of a richer UI surface, matching this
//     file's own established fallback for "no progress-bar/log HUD exists
//     yet" gaps.
// Once that layout exists, everything below needs no source change at all
// to start actually working end to end.
constexpr const char* kDevConsoleLayoutName = "DevConsoleTemplate";
constexpr const char* kDevConsoleInputElementId = "dev_console_input";
constexpr const char* kDevConsoleSubmitActionId = "dev_console_submit";
constexpr const char* kDevConsoleToggleKey = "L"; // + LeftControl -- see this section's own doc comment

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
                         "clearinv | version | clear");
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
        // **Real, documented gap, not faked**: js's own tp (lines 147-168)
        // swaps `zoneIndex`/rebuilds `currentMap` in-process because the JS
        // keeps every zone as one big in-memory generator. This port's
        // zones are each their own `buildXLevel()` C++ function
        // (GrimstoneGame.h/.cpp) with NO exported per-zone level JSON file
        // and no slug/index -> file-path table anywhere in this repo
        // (checked: no requestedLevelPath call site exists anywhere in
        // this port yet, and no content/*.json zone export exists either)
        // -- the same "zone content exists, zone-SWITCHING plumbing does
        // not" gap handleFishing()'s own doc comment above already
        // documents from the read side (no way to tell which zone is
        // active). `requestedLevelPath` (GameModuleApi.h v4) is the real,
        // working primitive that WOULD drive this the moment that mapping
        // exists; this command validates its argument for real and says
        // exactly what's missing rather than swapping to a path that was
        // never verified to exist.
        static const char* const kZoneNames[] = {"Ashenveil", "Ashen Moor", "Iron Peaks", "Cursed Marshes",
                                                   "Obsidian Depths"};
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
        devConsoleToast(frame, std::string("tp is not wired up yet: no exported level file/zone-index table "
                                            "exists in this port for '") +
                                    kZoneNames[idx] + "' -- see PORTING_PLAN.md's devconsole.js row.");
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
        // js's own GAME_VERSION global (line 228) has no equivalent
        // anywhere in this C++ port (checked -- no version constant exists
        // in src/ or project.json) -- reports a fixed identifying string
        // instead of a number that doesn't exist here, rather than
        // inventing a version scheme this port doesn't otherwise have.
        devConsoleToast(frame, "Grimstone (LiminalEngine/BEditor 2D port)");
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

void updateGrimstoneRuntime(BeTileGridFrame* frame) {
    if (frame == nullptr) return;

    flagUpdateBuffer().clear();
    itemUpdateBuffer().clear();
    tileEditBuffer().clear();
    timerStartBuffer().clear();
    hitboxBuffer().clear();
    objectiveUpdateBuffer().clear();
    stringScratch().clear();

    syncHitpointsMaxHealth(frame);
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
    handleDevConsole(frame);

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
}
