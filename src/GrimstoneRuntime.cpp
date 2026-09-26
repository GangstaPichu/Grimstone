#include "GrimstoneRuntime.h"

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
