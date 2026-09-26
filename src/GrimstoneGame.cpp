#include "GrimstoneGame.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <functional>
#include <initializer_list>
#include <random>
#include <utility>
#include <vector>

namespace {

// Small helper to cut the boilerplate of ~90 mostly-identical registerKind()
// calls down to one line each -- same positional field order TinyTown's own
// {"wall", "Fence", color, -1, solid, shape, autotile} call uses
// (TileKindDesc's own field order, TileKindRegistry.h), just factored out
// since this palette is far larger than TinyTown's five kinds.
TileKindId reg(TileKindRegistry& registry, const char* id, const char* displayName, const glm::vec3& color,
               bool solid = false, SpriteShape shape = SpriteShape::Rect, bool autotile = false) {
    return registry.registerKind({id, displayName, color, -1, solid, shape, autotile});
}

} // namespace

// TODO: fill in Grimstone's own registrations as each system is ported from
// the three.js version (see PORTING_PLAN.md at the repo root for the
// system-by-system mapping and status). Until then this is a deliberately
// empty, still-valid Static Game Module -- it compiles, links, and loads
// cleanly (as either a compiled-in module or, via GrimstonePlugin.cpp, a
// runtime plugin); it just has no tile kinds/levels of its own to show yet.
void registerGrimstoneGame(const std::filesystem::path& /*assetDir*/) {
    registerGrimstoneTileKinds(TileKindRegistry::instance());
}

// Transcribed one kind per entry in js/world.js's `const T = {...}` object
// (lines 508-620 as of this writing), in the same order that file declares
// them, so a future diff against a newer three.js source can walk both side
// by side. See GrimstoneGame.h's own doc comment for the solid/color
// conventions.
void registerGrimstoneTileKinds(TileKindRegistry& registry) {
    // ---- Base terrain ----
    reg(registry, "grass", "Grass", glm::vec3(0.25f, 0.60f, 0.25f));
    reg(registry, "dirt", "Dirt", glm::vec3(0.55f, 0.42f, 0.28f));
    reg(registry, "stone_floor", "Stone Floor", glm::vec3(0.55f, 0.55f, 0.58f));
    {
        // Animated, matching TinyTown's own water kind exactly in spirit
        // (TinyTownGame.cpp) -- a slow two-tone ripple, solid (blocks
        // walking/mining like every other body of water in the JS source).
        TileKindDesc water;
        water.id = "water";
        water.displayName = "Water";
        water.color = glm::vec3(0.20f, 0.42f, 0.75f);
        water.solid = true;
        water.animated = true;
        water.animationFrames = {glm::vec3(0.20f, 0.42f, 0.75f), glm::vec3(0.24f, 0.50f, 0.84f)};
        water.animationFrameSeconds = 0.6f;
        registry.registerKind(water);
    }
    reg(registry, "dark_grass", "Dark Grass", glm::vec3(0.15f, 0.35f, 0.15f));

    // ---- Resource nodes (mineable ore) -- solid, matching js/input.js's own
    // SOLID_TILES set exactly (T.COPPER/IRON/GOLD_ORE/MITHRIL/COAL are all
    // listed there -- the player stands adjacent and mines, doesn't walk
    // through the node) ----
    reg(registry, "copper_ore_node", "Copper Ore", glm::vec3(0.72f, 0.45f, 0.20f), true, SpriteShape::Circle);
    reg(registry, "iron_ore_node", "Iron Ore", glm::vec3(0.55f, 0.55f, 0.60f), true, SpriteShape::Circle);
    reg(registry, "gold_ore_node", "Gold Ore", glm::vec3(0.78f, 0.60f, 0.16f), true, SpriteShape::Circle);
    reg(registry, "mithril_ore_node", "Mithril Ore", glm::vec3(0.35f, 0.55f, 0.75f), true, SpriteShape::Circle);
    reg(registry, "coal_node", "Coal", glm::vec3(0.15f, 0.15f, 0.15f), true, SpriteShape::Circle);

    // ---- Trees (all solid -- the JS blocks movement through every tree
    // kind) ----
    reg(registry, "oak_tree", "Oak Tree", glm::vec3(0.20f, 0.45f, 0.16f), true, SpriteShape::Circle);
    reg(registry, "willow_tree", "Willow Tree", glm::vec3(0.22f, 0.42f, 0.24f), true, SpriteShape::Circle);
    reg(registry, "normal_tree", "Tree", glm::vec3(0.12f, 0.38f, 0.14f), true, SpriteShape::Circle);

    // ---- Fishing spots -- walkable, interacted with, not blocking ----
    reg(registry, "fishing_spot", "Fishing Spot", glm::vec3(0.20f, 0.45f, 0.65f), false, SpriteShape::Circle);
    reg(registry, "fishing_spot_2", "Fishing Spot (Deep)", glm::vec3(0.15f, 0.35f, 0.60f), false,
        SpriteShape::Circle);

    // ---- Enemy spawn tiles -- non-solid; the JS converts these to moving
    // entities on load rather than leaving them as static blocking tiles ----
    reg(registry, "goblin_spawn", "Goblin", glm::vec3(0.35f, 0.55f, 0.25f), false, SpriteShape::Triangle);
    reg(registry, "skeleton_spawn", "Skeleton", glm::vec3(0.80f, 0.80f, 0.75f), false, SpriteShape::Triangle);
    reg(registry, "wolf_spawn", "Wolf", glm::vec3(0.45f, 0.42f, 0.40f), false, SpriteShape::Triangle);

    // ---- Structures ----
    reg(registry, "smelter", "Smelter", glm::vec3(0.35f, 0.30f, 0.28f), true);
    reg(registry, "cooking_fire", "Cooking Fire", glm::vec3(0.75f, 0.35f, 0.12f), true);
    reg(registry, "shop", "Shop", glm::vec3(0.60f, 0.45f, 0.25f), true);

    reg(registry, "wall", "Wall", glm::vec3(0.45f, 0.45f, 0.48f), true, SpriteShape::Rect, true);
    reg(registry, "dungeon_floor", "Dungeon Floor", glm::vec3(0.30f, 0.28f, 0.30f));

    // ---- Zone transitions (walkable -- the JS triggers a zone swap on
    // step, never blocks the player from reaching them) ----
    reg(registry, "exit", "Exit Portal", glm::vec3(0.65f, 0.35f, 0.85f));
    reg(registry, "exit_return", "Return Portal", glm::vec3(0.55f, 0.30f, 0.75f));

    // ---- Town tiles ----
    reg(registry, "cobble", "Cobblestone", glm::vec3(0.55f, 0.53f, 0.50f));
    reg(registry, "inn", "Inn (legacy)", glm::vec3(0.55f, 0.35f, 0.20f), true);
    reg(registry, "blacksmith", "Blacksmith (legacy)", glm::vec3(0.40f, 0.38f, 0.40f), true);
    reg(registry, "town_well", "Town Well", glm::vec3(0.45f, 0.45f, 0.55f), true, SpriteShape::Circle);
    reg(registry, "lamppost", "Lamppost", glm::vec3(0.35f, 0.32f, 0.20f), true);

    // ---- NPC spawn markers -- palette placeholders; Ashenveil itself
    // authors these as TileMarkers (kind="npc_spawn"), not painted tiles,
    // but the full T palette still registers a kind per JS constant ----
    reg(registry, "npc_guard", "Guard NPC", glm::vec3(0.35f, 0.35f, 0.55f), false, SpriteShape::Triangle);
    reg(registry, "npc_merchant", "Merchant NPC", glm::vec3(0.65f, 0.50f, 0.20f), false, SpriteShape::Triangle);
    reg(registry, "npc_villager", "Villager NPC", glm::vec3(0.70f, 0.55f, 0.45f), false, SpriteShape::Triangle);
    reg(registry, "npc_innkeeper", "Innkeeper NPC", glm::vec3(0.60f, 0.40f, 0.30f), false, SpriteShape::Triangle);

    // ---- Interior transitions (walkable) ----
    reg(registry, "inn_door", "Inn Door", glm::vec3(0.50f, 0.35f, 0.20f));
    reg(registry, "exit_interior", "Exit Interior", glm::vec3(0.55f, 0.50f, 0.45f));

    // ---- Furniture ----
    reg(registry, "table", "Table", glm::vec3(0.45f, 0.32f, 0.18f), true);
    reg(registry, "barrel", "Barrel", glm::vec3(0.42f, 0.30f, 0.16f), true);

    // ---- Decorations ----
    reg(registry, "bed", "Bed", glm::vec3(0.55f, 0.25f, 0.30f), true);
    reg(registry, "bookshelf", "Bookshelf", glm::vec3(0.35f, 0.24f, 0.14f), true);
    reg(registry, "candle", "Candle Stand", glm::vec3(0.85f, 0.75f, 0.40f), true); // js SOLID_TILES
    reg(registry, "chest", "Chest", glm::vec3(0.55f, 0.40f, 0.15f), true);
    reg(registry, "notice_board", "Notice Board", glm::vec3(0.45f, 0.35f, 0.22f), true);

    // ---- Crafting ----
    reg(registry, "workbench", "Workbench", glm::vec3(0.40f, 0.28f, 0.16f), true);

    // ---- Town structures & decorations ----
    reg(registry, "grave", "Gravestone", glm::vec3(0.45f, 0.45f, 0.48f), true);
    reg(registry, "fence", "Fence", glm::vec3(0.40f, 0.32f, 0.20f), true, SpriteShape::Rect, true);
    reg(registry, "house_a", "House (Variant A)", glm::vec3(0.55f, 0.35f, 0.20f), true);
    reg(registry, "house_b", "House (Variant B)", glm::vec3(0.30f, 0.35f, 0.55f), true);
    reg(registry, "house_c", "House (Variant C)", glm::vec3(0.25f, 0.22f, 0.28f), true);
    reg(registry, "flower", "Flower", glm::vec3(0.85f, 0.35f, 0.55f));
    reg(registry, "sign", "Sign", glm::vec3(0.45f, 0.35f, 0.20f), true);
    reg(registry, "bush", "Bush", glm::vec3(0.20f, 0.42f, 0.18f), true, SpriteShape::Circle);

    // ---- The Forsaken Chapel ----
    reg(registry, "chapel_portal", "Chapel Portal", glm::vec3(0.55f, 0.20f, 0.65f));
    reg(registry, "cultist", "Cultist", glm::vec3(0.30f, 0.15f, 0.35f), false, SpriteShape::Triangle);
    reg(registry, "altar", "Altar", glm::vec3(0.35f, 0.30f, 0.35f), true);
    reg(registry, "pillar", "Pillar", glm::vec3(0.40f, 0.40f, 0.45f), true);
    reg(registry, "chapel_rune", "Chapel Rune", glm::vec3(0.55f, 0.30f, 0.70f));

    // ---- Dungeons ----
    reg(registry, "zombie", "Zombie", glm::vec3(0.35f, 0.45f, 0.30f), false, SpriteShape::Triangle);
    reg(registry, "dungeon_stair_down", "Stairs Down", glm::vec3(0.25f, 0.22f, 0.25f));
    reg(registry, "dungeon_stair_up", "Stairs Up", glm::vec3(0.30f, 0.28f, 0.30f));
    reg(registry, "dungeon_door", "Dungeon Door", glm::vec3(0.30f, 0.25f, 0.20f));
    reg(registry, "dungeon_torch", "Dungeon Torch", glm::vec3(0.90f, 0.55f, 0.15f));
    reg(registry, "crypt_stair", "Crypt Stair", glm::vec3(0.22f, 0.20f, 0.24f));
    reg(registry, "shadow_walker", "Shadow Walker", glm::vec3(0.15f, 0.12f, 0.20f), false, SpriteShape::Triangle);
    reg(registry, "forest_portal", "Forest Portal", glm::vec3(0.25f, 0.45f, 0.30f));

    // ---- Wizard tower area ----
    reg(registry, "wizard_door", "Wizard Door", glm::vec3(0.35f, 0.25f, 0.55f));
    reg(registry, "npc_wizard", "Wizard NPC", glm::vec3(0.45f, 0.30f, 0.65f), false, SpriteShape::Triangle);
    reg(registry, "arcane_circle", "Arcane Circle", glm::vec3(0.45f, 0.35f, 0.75f));
    reg(registry, "telescope", "Telescope", glm::vec3(0.35f, 0.35f, 0.40f), false);
    reg(registry, "potion_rack", "Potion Rack", glm::vec3(0.35f, 0.45f, 0.35f), false);
    reg(registry, "spell_tome", "Spell Tome", glm::vec3(0.55f, 0.35f, 0.65f));
    // TELESCOPE/POTION_RACK/CRYSTAL_BALL/CAULDRON/STONE_RUBBLE/CRACKED_WALL
    // read as though they should block movement by name, but none of them
    // appear in js/input.js's own SOLID_TILES set -- the actual three.js
    // game lets the player walk through all six. Matched here exactly
    // rather than guessed from the name, per this file's own solid-marking
    // convention (GrimstoneGame.h).
    reg(registry, "crystal_ball", "Crystal Ball", glm::vec3(0.55f, 0.65f, 0.85f), false, SpriteShape::Circle);
    reg(registry, "cauldron", "Cauldron", glm::vec3(0.20f, 0.20f, 0.22f), false);
    reg(registry, "stone_rubble", "Stone Rubble", glm::vec3(0.40f, 0.38f, 0.36f), false);
    reg(registry, "cracked_wall", "Cracked Wall", glm::vec3(0.40f, 0.40f, 0.42f), false);

    // ---- Farm zone ----
    reg(registry, "farm_portal", "Farm Portal", glm::vec3(0.55f, 0.65f, 0.25f));
    reg(registry, "hay_bale", "Hay Bale", glm::vec3(0.75f, 0.65f, 0.25f), true);
    reg(registry, "fence_post", "Fence Post", glm::vec3(0.45f, 0.35f, 0.20f), true);
    reg(registry, "water_trough", "Water Trough", glm::vec3(0.40f, 0.45f, 0.55f), true);
    reg(registry, "scarecrow", "Scarecrow", glm::vec3(0.55f, 0.42f, 0.20f), true);
    reg(registry, "crop_wheat", "Wheat Crop", glm::vec3(0.75f, 0.65f, 0.25f), true); // js SOLID_TILES (walk-adjacent to harvest)
    reg(registry, "crop_turnip", "Turnip Crop", glm::vec3(0.55f, 0.35f, 0.35f), true);
    reg(registry, "windmill", "Windmill", glm::vec3(0.65f, 0.55f, 0.45f), true);
    reg(registry, "npc_farmer", "Farmer NPC", glm::vec3(0.55f, 0.42f, 0.25f), false, SpriteShape::Triangle);
    reg(registry, "animal_chicken", "Chicken", glm::vec3(0.85f, 0.80f, 0.70f), false, SpriteShape::Circle);
    reg(registry, "animal_pig", "Pig", glm::vec3(0.85f, 0.60f, 0.60f), false, SpriteShape::Circle);
    reg(registry, "animal_cow", "Cow", glm::vec3(0.80f, 0.75f, 0.70f), false, SpriteShape::Circle);

    // ---- Building tiles -- each is one piece of a composed building.
    // Roof row (solid -- not walkable, purely the building's top silhouette)
    reg(registry, "roof_l", "Roof (Left)", glm::vec3(0.45f, 0.25f, 0.20f), true);
    reg(registry, "roof_m", "Roof (Middle)", glm::vec3(0.50f, 0.28f, 0.22f), true);
    reg(registry, "roof_r", "Roof (Right)", glm::vec3(0.45f, 0.25f, 0.20f), true);
    reg(registry, "roof_chimney", "Roof (Chimney)", glm::vec3(0.40f, 0.22f, 0.18f), true);
    // Front face row (solid -- BWALL_DOOR is a bump-to-enter trigger in the
    // JS, still solid/blocking like the rest of the wall it's set into)
    reg(registry, "bwall_door", "Wall (Door)", glm::vec3(0.55f, 0.42f, 0.28f), true);
    reg(registry, "bwall_win", "Wall (Window)", glm::vec3(0.60f, 0.50f, 0.30f), true);
    reg(registry, "bwall_forge", "Wall (Forge)", glm::vec3(0.75f, 0.35f, 0.15f), true);
    reg(registry, "bwall_awning", "Wall (Awning)", glm::vec3(0.60f, 0.45f, 0.30f), true);
    reg(registry, "bwall_plain", "Wall (Plain)", glm::vec3(0.55f, 0.50f, 0.48f), true);
    // Side / back walls
    reg(registry, "bwall_side", "Wall (Side)", glm::vec3(0.50f, 0.47f, 0.45f), true);
    reg(registry, "dock_plank", "Dock Plank", glm::vec3(0.55f, 0.42f, 0.28f));

    // ---- Interior house furniture ----
    reg(registry, "small_table", "Small Table", glm::vec3(0.45f, 0.32f, 0.18f), true);
    reg(registry, "wardrobe", "Wardrobe", glm::vec3(0.35f, 0.24f, 0.16f), true);
    reg(registry, "fireplace", "Fireplace", glm::vec3(0.55f, 0.25f, 0.15f), true);
    reg(registry, "plant", "Plant", glm::vec3(0.25f, 0.45f, 0.20f), true); // js SOLID_TILES ("decorative but solid")

    // ---- Homestead farming (walkable soil/crop states) ----
    reg(registry, "tilled_soil", "Tilled Soil", glm::vec3(0.35f, 0.25f, 0.15f));
    reg(registry, "seedling", "Seedling", glm::vec3(0.35f, 0.55f, 0.25f));
    reg(registry, "crop_growing", "Growing Crop", glm::vec3(0.45f, 0.60f, 0.25f));
    reg(registry, "home_wheat", "Wheat (Homestead)", glm::vec3(0.75f, 0.65f, 0.25f), true); // js SOLID_TILES
    reg(registry, "home_turnip", "Turnip (Homestead)", glm::vec3(0.55f, 0.35f, 0.35f), true);
    reg(registry, "home_carrot", "Carrot (Homestead)", glm::vec3(0.85f, 0.45f, 0.20f), true);
    reg(registry, "home_potato", "Potato (Homestead)", glm::vec3(0.65f, 0.50f, 0.30f), true);
    reg(registry, "home_onion", "Onion (Homestead)", glm::vec3(0.70f, 0.40f, 0.55f), true);

    // ---- Farm processing ----
    reg(registry, "butter_churn", "Butter Churn", glm::vec3(0.55f, 0.45f, 0.30f), true);

    // ---- Caravan zone portal ----
    reg(registry, "caravan_portal", "Caravan Portal", glm::vec3(0.55f, 0.45f, 0.20f));

    // ---- Crafting ----
    reg(registry, "anvil", "Anvil", glm::vec3(0.30f, 0.30f, 0.32f), true);

    // ---- Ashgrove Hollow ----
    reg(registry, "ash_grass", "Ash Grass", glm::vec3(0.75f, 0.72f, 0.62f));
    reg(registry, "ash_tree", "Ash Tree", glm::vec3(0.65f, 0.62f, 0.55f), true, SpriteShape::Circle);

    // ---- Forsaken Library (chapel basement) ----
    reg(registry, "library_stair_down", "Library Stairs Down", glm::vec3(0.28f, 0.25f, 0.30f));
    reg(registry, "library_stair_up", "Library Stairs Up", glm::vec3(0.30f, 0.28f, 0.32f));
    reg(registry, "blood_trail", "Blood Trail", glm::vec3(0.45f, 0.10f, 0.10f));
    reg(registry, "dead_skeleton_decor", "Dead Skeleton", glm::vec3(0.75f, 0.72f, 0.62f));

    // ---- Directional bookshelves (4 variants for pseudo-3D depth) ----
    reg(registry, "bookshelf_n", "Bookshelf (North)", glm::vec3(0.35f, 0.24f, 0.14f), true);
    reg(registry, "bookshelf_e", "Bookshelf (East)", glm::vec3(0.35f, 0.24f, 0.14f), true);
    reg(registry, "bookshelf_w", "Bookshelf (West)", glm::vec3(0.35f, 0.24f, 0.14f), true);

    // ---- The Hidden Vault ----
    reg(registry, "secret_bookshelf", "Secret Bookshelf", glm::vec3(0.30f, 0.35f, 0.25f), true);
    reg(registry, "mossy_floor", "Mossy Floor", glm::vec3(0.25f, 0.35f, 0.22f));
    reg(registry, "spider_web", "Spider Web", glm::vec3(0.75f, 0.75f, 0.75f));
    reg(registry, "book_pile", "Book Pile", glm::vec3(0.45f, 0.35f, 0.22f));
    reg(registry, "vase", "Vase", glm::vec3(0.40f, 0.38f, 0.35f), false); // not in js SOLID_TILES -- walkable
    reg(registry, "secret_exit", "Secret Exit", glm::vec3(0.30f, 0.28f, 0.26f));
}

namespace {
constexpr int kMapW = 60;
constexpr int kMapH = 36;

// Mirrors the JS's own placeDecor(tiles, floor, y, x, decorTile): paints
// `decorKind` onto the overlay layer at (x, y) -- the floor layer is left
// exactly as it already is (this C++ version paints floor terrain FIRST,
// top to bottom matching makeAshenveil()'s own structure section, then
// calls this only in the "placed via placeDecor" pass afterward, so
// "record what's underneath" is already true by construction -- there's no
// separate floor[y][x] = tiles[y][x] snapshot step needed the way the JS's
// single-array-then-copy approach needs one).
void placeDecor(TileGrid& grid, int y, int x, TileKindId decorKind) { grid.setOverlay(x, y, decorKind); }
} // namespace

// Transcribed from `function makeAshenveil()` in js/zones.js (lines
// 817-1213 as of this writing). js/zones.js continues past line 1213 into
// makeGreenfieldMap() (line 1216) and the other procedurally-generated
// zones -- NOT ported here, see PORTING_PLAN.md and GrimstoneGame.h's own
// doc comment on this function.
TileGrid buildAshenveilLevel(const TileKindRegistry& registry) {
    TileGrid grid(kMapW, kMapH, 1.0f);

    const TileKindId grass = registry.idFromName("grass");
    const TileKindId dirt = registry.idFromName("dirt");
    const TileKindId stoneFloor = registry.idFromName("stone_floor");
    const TileKindId water = registry.idFromName("water");
    const TileKindId darkGrass = registry.idFromName("dark_grass");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId cobble = registry.idFromName("cobble");
    const TileKindId roofL = registry.idFromName("roof_l");
    const TileKindId roofM = registry.idFromName("roof_m");
    const TileKindId roofR = registry.idFromName("roof_r");
    const TileKindId roofChimney = registry.idFromName("roof_chimney");
    const TileKindId bwallDoor = registry.idFromName("bwall_door");
    const TileKindId bwallWin = registry.idFromName("bwall_win");
    const TileKindId bwallForge = registry.idFromName("bwall_forge");
    const TileKindId bwallPlain = registry.idFromName("bwall_plain");
    const TileKindId bwallSide = registry.idFromName("bwall_side");
    const TileKindId dockPlank = registry.idFromName("dock_plank");
    const TileKindId fishingSpot = registry.idFromName("fishing_spot");
    const TileKindId normalTree = registry.idFromName("normal_tree");
    const TileKindId oakTree = registry.idFromName("oak_tree");
    const TileKindId townWell = registry.idFromName("town_well");
    const TileKindId barrel = registry.idFromName("barrel");
    const TileKindId lamppost = registry.idFromName("lamppost");
    const TileKindId sign = registry.idFromName("sign");
    const TileKindId noticeBoard = registry.idFromName("notice_board");
    const TileKindId chest = registry.idFromName("chest");
    const TileKindId candle = registry.idFromName("candle");
    const TileKindId chapelPortal = registry.idFromName("chapel_portal");
    const TileKindId fence = registry.idFromName("fence");
    const TileKindId grave = registry.idFromName("grave");
    const TileKindId flower = registry.idFromName("flower");
    const TileKindId bush = registry.idFromName("bush");
    const TileKindId exit = registry.idFromName("exit");
    const TileKindId forestPortal = registry.idFromName("forest_portal");
    const TileKindId farmPortal = registry.idFromName("farm_portal");

    const int W = kMapW, H = kMapH;

    // Fill the whole grid with grass first (the JS's own
    // `Array.from(...).fill(T.GRASS)` initial state for both `tiles` and
    // `floor`) -- a fresh TileGrid's floor layer already reads
    // kInvalidTileKind everywhere, so this is an explicit fill rather than
    // relying on an implicit default matching GRASS.
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, grass);

    // Stone border walls
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) grid.setFloor(x, y, wall);

    // ---- COBBLESTONE TOWN SQUARE (center-left area) ----
    for (int y = 10; y <= 22; ++y)
        for (int x = 8; x <= 28; ++x) grid.setFloor(x, y, cobble);

    // ---- MAIN ROAD: horizontal spine east to EXIT ----
    for (int x = 1; x < W - 1; ++x) {
        const TileKindId cur = grid.floorAt(x, 16);
        if (cur == grass || cur == cobble) grid.setFloor(x, 16, dirt);
    }
    // Re-cobble the town square road section
    for (int x = 8; x <= 28; ++x) grid.setFloor(x, 16, cobble);

    // ---- NORTH ROAD from top wall down to square ----
    for (int y = 1; y <= 10; ++y) grid.setFloor(18, y, dirt);

    // ---- SOUTH ROAD from square to bottom wall ----
    for (int y = 22; y < H - 1; ++y) grid.setFloor(18, y, dirt);

    // ---- INN / TAVERN -- "The Tarnished Flagon" (north-west of square) ----
    for (int fy = 5; fy <= 9; ++fy)
        for (int fx = 5; fx <= 11; ++fx) grid.setFloor(fx, fy, stoneFloor);
    grid.setFloor(6, 5, roofL);
    grid.setFloor(7, 5, roofM);
    grid.setFloor(8, 5, roofChimney);
    grid.setFloor(9, 5, roofM);
    grid.setFloor(10, 5, roofR);
    grid.setFloor(6, 6, bwallSide);
    grid.setFloor(7, 6, bwallWin);
    grid.setFloor(8, 6, bwallWin);
    grid.setFloor(9, 6, bwallWin);
    grid.setFloor(10, 6, bwallSide);
    grid.setFloor(6, 7, bwallSide);
    grid.setFloor(7, 7, bwallWin);
    grid.setFloor(8, 7, bwallWin);
    grid.setFloor(9, 7, bwallWin);
    grid.setFloor(10, 7, bwallSide);
    // Front face row (y=8) -- BWALL_DOOR at col 8 IS the teleporter
    grid.setFloor(6, 8, bwallPlain);
    grid.setFloor(7, 8, bwallWin);
    grid.setFloor(8, 8, bwallDoor);
    grid.setFloor(9, 8, bwallWin);
    grid.setFloor(10, 8, bwallPlain);

    // ---- BLACKSMITH -- "The Ashen Forge" (4 wide x 3 tall) ----
    for (int fy = 5; fy <= 8; ++fy)
        for (int fx = 22; fx <= 27; ++fx) grid.setFloor(fx, fy, stoneFloor);
    grid.setFloor(23, 5, roofL);
    grid.setFloor(24, 5, roofChimney);
    grid.setFloor(25, 5, roofChimney);
    grid.setFloor(26, 5, roofR);
    grid.setFloor(23, 6, bwallForge);
    grid.setFloor(24, 6, bwallForge);
    grid.setFloor(25, 6, bwallForge);
    grid.setFloor(26, 6, bwallSide);
    grid.setFloor(23, 7, bwallForge);
    grid.setFloor(24, 7, bwallDoor);
    grid.setFloor(25, 7, bwallPlain);
    grid.setFloor(26, 7, bwallForge);

    // ---- DORIN'S TRADING POST (6 wide x 4 tall) ----
    for (int fy = 18; fy <= 21; ++fy)
        for (int fx = 12; fx <= 17; ++fx) grid.setFloor(fx, fy, stoneFloor);
    grid.setFloor(12, 18, roofL);
    grid.setFloor(13, 18, roofM);
    grid.setFloor(14, 18, roofM);
    grid.setFloor(15, 18, roofM);
    grid.setFloor(16, 18, roofM);
    grid.setFloor(17, 18, roofR);
    grid.setFloor(12, 19, bwallSide);
    grid.setFloor(13, 19, bwallWin);
    grid.setFloor(14, 19, bwallWin);
    grid.setFloor(15, 19, bwallWin);
    grid.setFloor(16, 19, bwallWin);
    grid.setFloor(17, 19, bwallSide);
    grid.setFloor(12, 20, bwallPlain);
    grid.setFloor(13, 20, bwallWin);
    grid.setFloor(14, 20, bwallWin);
    grid.setFloor(15, 20, bwallDoor);
    grid.setFloor(16, 20, bwallWin);
    grid.setFloor(17, 20, bwallPlain);

    // ---- GRIMSTONE SAVINGS BANK (5 wide x 4 tall) ----
    for (int fy = 5; fy <= 9; ++fy)
        for (int fx = 12; fx <= 16; ++fx) grid.setFloor(fx, fy, stoneFloor);
    grid.setFloor(12, 5, roofL);
    grid.setFloor(13, 5, roofM);
    grid.setFloor(14, 5, roofChimney);
    grid.setFloor(15, 5, roofM);
    grid.setFloor(16, 5, roofR);
    grid.setFloor(12, 6, bwallSide);
    grid.setFloor(13, 6, bwallWin);
    grid.setFloor(14, 6, bwallWin);
    grid.setFloor(15, 6, bwallWin);
    grid.setFloor(16, 6, bwallSide);
    grid.setFloor(12, 7, bwallSide);
    grid.setFloor(13, 7, bwallWin);
    grid.setFloor(14, 7, bwallWin);
    grid.setFloor(15, 7, bwallWin);
    grid.setFloor(16, 7, bwallSide);
    grid.setFloor(12, 8, bwallPlain);
    grid.setFloor(13, 8, bwallWin);
    grid.setFloor(14, 8, bwallDoor);
    grid.setFloor(15, 8, bwallWin);
    grid.setFloor(16, 8, bwallPlain);
    // y=9 stone floor already set -- serves as approach tile

    // Town well / lampposts placed later, via placeDecor() after floor is
    // fully authored (matching the JS's own comment + snapshot ordering).

    // ---- DOCKS / WATER (south-east corner) ----
    for (int y = 27; y <= H - 2; ++y)
        for (int x = 35; x <= W - 2; ++x) grid.setFloor(x, y, water);
    for (int y = 24; y <= 26; ++y)
        for (int x = 37; x <= W - 2; ++x) grid.setFloor(x, y, water);
    for (int x = 35; x <= W - 2; ++x) grid.setFloor(x, 23, water);
    // Dock boardwalk: 3 rows x 9 cols
    for (int x = 28; x <= 36; ++x) {
        grid.setFloor(x, 24, dockPlank);
        grid.setFloor(x, 25, dockPlank);
        grid.setFloor(x, 26, dockPlank);
    }
    // Fishing spots on south row of pier
    grid.setFloor(34, 26, fishingSpot);
    grid.setFloor(36, 26, fishingSpot);
    // Cobble connector: road x=30 south to dock approach row y=23
    for (int y = 17; y <= 23; ++y)
        if (grid.floorAt(30, y) != cobble) grid.setFloor(30, y, cobble);
    // Dock approach row at y=23, x=28..30
    for (int x = 28; x <= 30; ++x) grid.setFloor(x, 23, cobble);

    // ---- TREES / NATURE around town edges ----
    {
        const int nwCluster[][2] = {{2, 2}, {2, 3}, {3, 2}, {3, 4}, {2, 30}, {3, 31}, {26, 4}, {27, 3},
                                     {28, 5}, {27, 6}, {24, 8}, {25, 9}, {26, 10}};
        for (const auto& yx : nwCluster) {
            const int y = yx[0], x = yx[1];
            if (x > 0 && x < W - 1 && y > 0 && y < H - 1) grid.setFloor(x, y, normalTree);
        }
        const int neOaks[][2] = {{4, 36}, {4, 37}, {4, 43}, {4, 44}, {5, 43}, {4, 50},
                                  {4, 51}, {5, 50}, {22, 4}, {23, 5}, {22, 6}, {21, 4}};
        for (const auto& yx : neOaks) {
            const int y = yx[0], x = yx[1];
            if (x > 0 && x < W - 1 && y > 0 && y < H - 1) grid.setFloor(x, y, oakTree);
        }
    }

    // ---- PATHS connecting buildings to main road ----
    for (int y = 10; y <= 16; ++y) grid.setFloor(8, y, cobble); // Inn to road
    for (int y = 8; y <= 16; ++y) grid.setFloor(24, y, cobble); // Blacksmith to road
    grid.setFloor(15, 17, cobble);                              // Trading Post path

    // ---- NORTH GATE AREA ----
    for (int y = 1; y <= 4; ++y) grid.setFloor(18, y, dirt);
    grid.setFloor(17, 1, wall);
    grid.setFloor(19, 1, wall);
    // Chapel portal placed post-snapshot via placeDecor below.

    // ---- RESIDENTIAL DISTRICT (north strip, east of blacksmith) ----
    // placeHouse: 3 wide x 2 tall -- roofL/roofChimney/roofR over
    // bwallWin/bwallDoor/bwallWin, exactly mirroring the JS's own
    // placeHouse(ty, tx) local function.
    auto placeHouse = [&](int ty, int tx) {
        grid.setFloor(tx + 0, ty + 0, roofL);
        grid.setFloor(tx + 1, ty + 0, roofChimney);
        grid.setFloor(tx + 2, ty + 0, roofR);
        grid.setFloor(tx + 0, ty + 1, bwallWin);
        grid.setFloor(tx + 1, ty + 1, bwallDoor);
        grid.setFloor(tx + 2, ty + 1, bwallWin);
    };

    placeHouse(2, 32); // Mira's house
    placeHouse(2, 39); // Aldric's house
    placeHouse(2, 46); // Residence
    placeHouse(2, 53); // Residence

    // North lane road connecting houses to main east road
    for (int x = 31; x <= W - 2; ++x)
        if (grid.floorAt(x, 8) == grass) grid.setFloor(x, 8, dirt);
    // Dirt paths from each house door (y=3) down to north lane (y=8)
    for (int doorX : {33, 40, 47, 54}) {
        for (int py = 4; py <= 7; ++py)
            if (grid.floorAt(doorX, py) == grass) grid.setFloor(doorX, py, dirt);
    }
    for (int y = 9; y <= 15; ++y)
        if (grid.floorAt(35, y) == grass) grid.setFloor(35, y, dirt);
    for (int y = 9; y <= 15; ++y)
        if (grid.floorAt(42, y) == grass) grid.setFloor(42, y, dirt);
    for (int y = 9; y <= 15; ++y)
        if (grid.floorAt(49, y) == grass) grid.setFloor(49, y, dirt);
    for (int y = 9; y <= 15; ++y)
        if (grid.floorAt(56, y) == grass) grid.setFloor(56, y, dirt);

    // ---- SOUTH-WEST RESIDENTIAL (Elspeth & Rowan) ----
    placeHouse(26, 2);  // Elspeth's house
    placeHouse(26, 10); // Rowan's house

    // South lane
    for (int x = 3; x <= 18; ++x) {
        const TileKindId cur = grid.floorAt(x, 30);
        if (cur == grass || cur == dirt) grid.setFloor(x, 30, dirt);
    }
    // Dirt paths from SW house doors (y=27) down to south lane (y=30)
    for (int doorX : {3, 11}) {
        for (int py = 28; py <= 29; ++py)
            if (grid.floorAt(doorX, py) == grass) grid.setFloor(doorX, py, dirt);
    }

    // ---- CEMETERY structure (fences placed post-snapshot via placeDecor) ----
    for (int y = 2; y <= 8; ++y)
        for (int x = 45; x <= 56; ++x) grid.setFloor(x, y, darkGrass);
    for (int y = 9; y <= 15; ++y)
        if (grid.floorAt(51, y) == grass || grid.floorAt(51, y) == dirt) grid.setFloor(51, y, dirt);

    // ---- EXIT portal -- placed via placeDecor after floor snapshot ----
    const int exitY = 16;
    for (int dx = 1; dx <= 4; ++dx)
        if (W - 1 - dx > 0) grid.setFloor(W - 1 - dx, exitY, dirt);

    // ---- Floor layer is now fully authored -- matches the JS's own
    // "snapshot floor layer before placing decorations" step, since every
    // setOverlay() call from here on paints ON TOP of (not over) the floor
    // values set above. ----

    // Town well (centre of square)
    placeDecor(grid, 15, 18, townWell);
    // 7 dock barrels
    placeDecor(grid, 24, 28, barrel);
    placeDecor(grid, 25, 28, barrel);
    placeDecor(grid, 24, 30, barrel);
    placeDecor(grid, 25, 30, barrel);
    placeDecor(grid, 24, 32, barrel);
    placeDecor(grid, 25, 32, barrel);
    placeDecor(grid, 24, 33, barrel);

    // ---- LAMPPOSTS ----
    for (const auto& yx : {std::pair{3, 17}, std::pair{3, 19}, std::pair{7, 17}, std::pair{7, 19}})
        placeDecor(grid, yx.first, yx.second, lamppost);
    for (const auto& yx : {std::pair{10, 7}, std::pair{13, 7}}) placeDecor(grid, yx.first, yx.second, lamppost);
    for (const auto& yx : {std::pair{10, 25}, std::pair{13, 25}}) placeDecor(grid, yx.first, yx.second, lamppost);
    for (const auto& yx :
         {std::pair{10, 9}, std::pair{10, 27}, std::pair{22, 9}, std::pair{22, 27}})
        placeDecor(grid, yx.first, yx.second, lamppost);
    for (const auto& yx : {std::pair{15, 38}, std::pair{15, 44}, std::pair{15, 53}, std::pair{15, 57},
                            std::pair{17, 38}, std::pair{17, 44}, std::pair{17, 53}, std::pair{17, 57}}) {
        if (yx.second > 0 && yx.second < W - 1) placeDecor(grid, yx.first, yx.second, lamppost);
    }
    for (const auto& yx : {std::pair{7, 34}, std::pair{7, 41}, std::pair{7, 48}, std::pair{7, 55}})
        placeDecor(grid, yx.first, yx.second, lamppost);
    for (const auto& yx : {std::pair{12, 36}, std::pair{12, 43}, std::pair{12, 50}, std::pair{12, 57}}) {
        if (yx.second < W - 1) placeDecor(grid, yx.first, yx.second, lamppost);
    }
    for (const auto& yx : {std::pair{31, 3}, std::pair{31, 13}, std::pair{31, 17}})
        placeDecor(grid, yx.first, yx.second, lamppost);
    for (const auto& yx : {std::pair{24, 3}, std::pair{24, 11}}) placeDecor(grid, yx.first, yx.second, lamppost);

    // ---- SIGNS ----
    placeDecor(grid, 7, 31, sign);
    placeDecor(grid, 22, 19, sign);

    // NPC spawn markers converted to TileMarkers below, not painted tiles
    // (see this function's own doc comment) -- the JS's own tiles[y][x] =
    // T.NPC_* assignments are intentionally NOT transcribed as setOverlay()
    // calls here.

    // ---- Town decorations ----
    placeDecor(grid, 22, 20, noticeBoard);
    placeDecor(grid, 10, 29, chest);
    placeDecor(grid, 10, 30, chest);
    placeDecor(grid, 10, 6, candle);
    placeDecor(grid, 10, 10, candle);
    placeDecor(grid, 9, 23, barrel); // outside blacksmith

    // ---- CHAPEL PORTAL (north gate, top of north road) ----
    placeDecor(grid, 1, 18, chapelPortal);
    placeDecor(grid, 4, 17, sign); // warning sign south of the portal

    // Residential lane chests
    placeDecor(grid, 6, 37, chest);
    placeDecor(grid, 6, 44, chest);

    // ---- Cemetery fences and decorations ----
    for (int x = 44; x <= 57; ++x) placeDecor(grid, 1, x, fence); // North fence row
    for (int x = 44; x <= 57; ++x) {                              // South fence row, gaps at gate/connectors
        if (x == 52 || x == 53) continue;
        if (x == 49 || x == 51 || x == 56) continue;
        placeDecor(grid, 9, x, fence);
    }
    for (int y = 2; y <= 7; ++y) placeDecor(grid, y, 44, fence); // West fence
    for (int y = 2; y <= 7; ++y) placeDecor(grid, y, 57, fence); // East fence
    placeDecor(grid, 9, 52, sign);                                // Cemetery sign at gate
    {
        const int graves[][2] = {{3, 46}, {3, 49}, {3, 52}, {3, 55}, {5, 46}, {5, 49},
                                  {5, 52}, {5, 55}, {7, 47}, {7, 51}, {7, 54}};
        for (const auto& gyx : graves) {
            const int gy = gyx[0], gx = gyx[1];
            if (gx >= 45 && gx <= 56) placeDecor(grid, gy, gx, grave);
        }
    }

    // ---- FLOWERS ----
    auto flowerIfGrass = [&](const std::initializer_list<std::pair<int, int>>& cells) {
        for (const auto& fyx : cells)
            if (grid.floorAt(fyx.second, fyx.first) == grass) placeDecor(grid, fyx.first, fyx.second, flower);
    };
    flowerIfGrass({{11, 6}, {12, 6}, {14, 6}, {15, 6}});
    flowerIfGrass({{11, 27}, {12, 27}, {14, 27}, {15, 27}, {11, 28}, {14, 28}});
    flowerIfGrass({{11, 29}, {13, 29}, {15, 29}, {17, 29}, {20, 29}, {11, 7}, {17, 7}, {20, 7}});
    flowerIfGrass({{2, 16}, {4, 16}, {5, 16}, {6, 16}, {2, 20}, {4, 20}, {5, 20}, {6, 20}});
    flowerIfGrass({{6, 38}, {6, 40}, {6, 45}, {6, 52}, {7, 38}, {7, 40}, {7, 45}, {7, 52}});
    flowerIfGrass({{18, 37}, {19, 37}, {18, 40}, {19, 40}, {18, 44}, {19, 44}, {18, 47}, {19, 47}, {18, 53}, {19, 53}});
    flowerIfGrass({{25, 2}, {25, 8}, {25, 16}, {31, 2}, {31, 8}, {31, 16}, {32, 8}, {33, 4}, {33, 12}});
    {
        const int cemeterySurround[][2] = {{2, 58}, {4, 58}, {6, 58}, {2, 43}, {4, 43}, {6, 43}};
        for (const auto& fyx : cemeterySurround) {
            const int fy = fyx[0], fx = fyx[1];
            if (fy > 0 && fy < H - 1 && fx > 0 && fx < W - 1 && grid.floorAt(fx, fy) == grass)
                placeDecor(grid, fy, fx, flower);
        }
    }
    flowerIfGrass({{4, 5}, {4, 6}, {5, 5}, {6, 5}});

    // ---- BUSHES ----
    auto bushIfGrass = [&](const std::initializer_list<std::pair<int, int>>& cells) {
        for (const auto& byx : cells)
            if (grid.floorAt(byx.second, byx.first) == grass) placeDecor(grid, byx.first, byx.second, bush);
    };
    bushIfGrass({{2, 14}, {2, 16}, {2, 20}, {2, 22}, {2, 26}, {2, 29}});
    bushIfGrass({{5, 4}, {6, 4}, {7, 4}, {8, 4}});
    bushIfGrass({{5, 29}, {6, 29}, {7, 29}});
    for (const auto& byx : {std::pair{23, 9}, std::pair{23, 10}, std::pair{23, 11}}) {
        const TileKindId cur = grid.floorAt(byx.second, byx.first);
        if (cur == cobble || cur == grass) placeDecor(grid, byx.first, byx.second, bush);
    }
    bushIfGrass({{22, 29}, {22, 30}, {22, 31}});
    bushIfGrass({{25, 7}, {25, 9}, {25, 14}, {25, 15}, {30, 2}, {30, 8}, {30, 14}});
    {
        const int northLaneBushes[][2] = {{1, 31}, {1, 38}, {1, 45}, {1, 52}};
        for (const auto& byx : northLaneBushes) {
            const int by = byx[0], bx = byx[1];
            if (by > 0 && bx > 0 && bx < W - 1 && grid.floorAt(bx, by) == grass) placeDecor(grid, by, bx, bush);
        }
    }
    {
        const int cemeteryCorners[][2] = {{1, 43}, {1, 58}, {9, 43}};
        for (const auto& byx : cemeteryCorners) {
            const int by = byx[0], bx = byx[1];
            if (by > 0 && bx > 0 && bx < W - 1 && grid.floorAt(bx, by) == grass) placeDecor(grid, by, bx, bush);
        }
    }
    bushIfGrass({{17, 29}, {18, 29}, {19, 29}});

    // Place EXIT (east -> Ashwood Vale)
    placeDecor(grid, exitY, W - 1, exit);

    // ---- SOUTH PORTAL -- path leads into the Whisperwood ----
    const int southPortalX = 18;
    grid.setFloor(southPortalX, H - 1, grass); // break wall
    grid.setFloor(southPortalX - 1, H - 1, grass);
    grid.setFloor(southPortalX + 1, H - 1, grass);
    for (int y = 22; y < H - 1; ++y) {
        const TileKindId cur = grid.floorAt(southPortalX, y);
        if (cur != water && cur != wall) grid.setFloor(southPortalX, y, dirt);
    }
    placeDecor(grid, H - 1, southPortalX, forestPortal);

    // ---- WEST PORTAL -- path leads to Greenfield Pastures ----
    const int westPortalY = 16;
    grid.setFloor(0, westPortalY, grass);
    grid.setFloor(0, westPortalY - 1, grass);
    grid.setFloor(0, westPortalY + 1, grass);
    for (int x = 1; x < 8; ++x) {
        const TileKindId cur = grid.floorAt(x, westPortalY);
        if (cur != wall && cur != water) grid.setFloor(x, westPortalY, dirt);
    }
    placeDecor(grid, westPortalY, 0, farmPortal);

    // ---- Portals as TileMarkers -- documents the zone-graph wiring for a
    // future pass even though the destination zones aren't ported yet (see
    // PORTING_PLAN.md and this function's own doc comment). ----
    auto addPortalMarker = [&](const char* name, float px, float py, const char* targetZone) {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = name;
        marker.position = glm::vec2(px + 0.5f, py + 0.5f);
        marker.properties["targetZone"] = targetZone;
        grid.markers.push_back(marker);
    };
    addPortalMarker("Exit -> Ashwood Vale", static_cast<float>(W - 1), static_cast<float>(exitY), "ashwood_vale");
    addPortalMarker("Chapel Portal", 18.0f, 1.0f, "forsaken_chapel");
    addPortalMarker("Forest Portal -> Whisperwood", static_cast<float>(southPortalX), static_cast<float>(H - 1),
                     "whisperwood");
    addPortalMarker("Farm Portal -> Greenfield Pastures", 0.0f, static_cast<float>(westPortalY),
                     "greenfield_pastures");

    // ---- NPC spawn points as TileMarkers (kind="npc_spawn") -- a marker
    // records "an NPC belongs here"; the JS's own schedule/dialogue data
    // (js/npcs.js) isn't ported in this pass, see GrimstoneGame.h. ----
    auto addNpcMarker = [&](const char* name, float px, float py) {
        TileMarker marker;
        marker.kind = "npc_spawn";
        marker.name = name;
        marker.position = glm::vec2(px + 0.5f, py + 0.5f);
        marker.properties["name"] = name;
        grid.markers.push_back(marker);
    };
    addNpcMarker("guard", 10.0f, 11.0f);
    addNpcMarker("guard", 26.0f, 11.0f);
    addNpcMarker("guard", 30.0f, 16.0f); // Edwyn -- south road / docks patrol
    addNpcMarker("Mira", 35.0f, 6.0f);
    addNpcMarker("Aldric", 42.0f, 6.0f);
    addNpcMarker("Elspeth", 4.0f, 32.0f);
    addNpcMarker("Rowan", 12.0f, 32.0f);

    // ---- Player spawn -- town square center near the well, on the main
    // road/square intersection (well sits at x=18,y=15; the road runs
    // through y=16) ----
    grid.markers.push_back({"player_spawn", glm::vec2(18.5f, 16.5f), "Player Spawn"});

    return grid;
}

// ======= PROCEDURAL ZONE GENERATOR =======
// Transcribed from js/world.js's makePRNG/makeNoise/makeFractalNoise/
// smoothTerrain/placeCluster/carvePath/ZONE_CONFIGS (lines 670-816),
// js/quests.js's makeZoneMap()/findOpenArea() (lines 582-780), and
// js/zones.js's placeDungeonEntrance() (lines 1756-1772) -- see
// GrimstoneGame.h's own doc comment on buildProceduralZone() for how this
// differs in kind from buildAshenveilLevel() above.
namespace {

// A plain [0,1) float in the JS's own range/shape, not a bit-for-bit
// reproduction -- see GrimstoneGame.h's own doc comment on why that's
// deliberate. uint32_t's defined wraparound-on-overflow reproduces the
// JS's `|0`/Math.imul int32-truncation semantics closely enough for a
// procedural generator.
//
// JS (js/world.js, lines 670-677):
//   seed |= 0; seed = seed + 0x6D2B79F5 | 0;
//   let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
//   t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
//   return ((t ^ t >>> 14) >>> 0) / 4294967296;
// `+` binds tighter than `^` in JS, so line 3 is `t = (t + imul(...)) ^ t`
// -- the parenthesization below is a deliberate translation of that
// precedence, not a simplification.
class ProceduralPrng {
public:
    explicit ProceduralPrng(uint32_t seed) : m_seed(seed) {}

    double next() {
        m_seed += 0x6D2B79F5u;
        uint32_t t = (m_seed ^ (m_seed >> 15)) * (m_seed | 1u);
        const uint32_t u = (t ^ (t >> 7)) * (t | 61u);
        t = (t + u) ^ t;
        return static_cast<double>(t ^ (t >> 14)) / 4294967296.0;
    }

private:
    uint32_t m_seed;
};

constexpr double kPi = 3.14159265358979323846;

// Value noise -- js/world.js's makeNoise(), lines 680-696. Builds one
// coarse 12x8 (GW x GH) low-res random grid at construction time (mirroring
// the JS's own per-call closure over a freshly-drawn grid), then samples it
// anywhere in [0,W) x [0,H) tile coordinates via cosine-eased bilinear
// interpolation.
class ValueNoise2D {
public:
    ValueNoise2D(uint32_t seed, int W, int H) : m_W(W), m_H(H) {
        ProceduralPrng rng(seed);
        m_grid.assign(kGH + 1, std::vector<double>(kGW + 1));
        for (int y = 0; y <= kGH; ++y)
            for (int x = 0; x <= kGW; ++x) m_grid[y][x] = rng.next();
    }

    double sample(double x, double y) const {
        const double gx = (x / m_W) * kGW, gy = (y / m_H) * kGH;
        const int x0 = static_cast<int>(std::floor(gx)), y0 = static_cast<int>(std::floor(gy));
        const int x1 = std::min(x0 + 1, kGW), y1 = std::min(y0 + 1, kGH);
        const double fx = gx - x0, fy = gy - y0;
        const double top = interp(m_grid[y0][x0], m_grid[y0][x1], fx);
        const double bottom = interp(m_grid[y1][x0], m_grid[y1][x1], fx);
        return interp(top, bottom, fy);
    }

private:
    static constexpr int kGW = 12, kGH = 8;
    static double interp(double a, double b, double t) {
        const double f = (1.0 - std::cos(t * kPi)) * 0.5;
        return a * (1.0 - f) + b * f;
    }
    int m_W, m_H;
    std::vector<std::vector<double>> m_grid;
};

// Multi-octave fractal noise -- js/world.js's makeFractalNoise(), lines
// 699-706. Each octave is its own ValueNoise2D seeded `seed + i*1337`,
// matching the JS's own per-layer reseed exactly.
class FractalNoise2D {
public:
    FractalNoise2D(uint32_t seed, int W, int H, int octaves) {
        m_layers.reserve(static_cast<size_t>(octaves));
        for (int i = 0; i < octaves; ++i)
            m_layers.emplace_back(seed + static_cast<uint32_t>(i) * 1337u, W, H);
    }

    double sample(double x, double y) const {
        double v = 0.0, amp = 1.0, total = 0.0;
        for (const auto& layer : m_layers) {
            v += layer.sample(x, y) * amp;
            total += amp;
            amp *= 0.5;
        }
        return v / total;
    }

private:
    std::vector<ValueNoise2D> m_layers;
};

// Cellular-automata smoothing for water blobs -- js/world.js's
// smoothTerrain(), lines 709-720. Preserves a deliberate JS quirk rather
// than fixing it: an isolated `targetTile` cell that erodes falls back to
// `grassFallback` UNCONDITIONALLY (the JS hardcodes T.GRASS on line 716,
// not the caller's own biome base tile), so a biome whose baseTile isn't
// grass (Iron Peaks/Cursed Marshes/Obsidian Depths, all stone/dark-grass/
// dungeon-floor) can end up with a stray grass patch where isolated water
// eroded. This is a faithful port of the generator the three.js game
// actually runs, not a cleanup of it.
void smoothTerrain(std::vector<std::vector<TileKindId>>& tiles, int W, int H, TileKindId targetTile,
                    TileKindId grassFallback, int passes) {
    for (int p = 0; p < passes; ++p) {
        std::vector<std::vector<TileKindId>> next = tiles;
        for (int y = 1; y < H - 1; ++y) {
            for (int x = 1; x < W - 1; ++x) {
                int count = 0;
                for (int dy = -1; dy <= 1; ++dy)
                    for (int dx = -1; dx <= 1; ++dx)
                        if (tiles[y + dy][x + dx] == targetTile) ++count;
                if (count >= 5) next[y][x] = targetTile;
                else if (count <= 2 && tiles[y][x] == targetTile) next[y][x] = grassFallback;
            }
        }
        tiles = std::move(next);
    }
}

// Scatters a cluster of `tile` around (cx, cy) -- js/world.js's
// placeCluster(), lines 723-737.
void placeCluster(std::vector<std::vector<TileKindId>>& tiles, int W, int H, double cx, double cy,
                   TileKindId tile, int count, double radius, ProceduralPrng& rng, TileKindId wallTile,
                   TileKindId waterTile, bool avoidSolid = true) {
    int placed = 0, attempts = 0;
    while (placed < count && attempts < 200) {
        ++attempts;
        const double angle = rng.next() * 2.0 * kPi;
        const double r = rng.next() * radius;
        const int x = static_cast<int>(std::lround(cx + std::cos(angle) * r));
        const int y = static_cast<int>(std::lround(cy + std::sin(angle) * r));
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
        const TileKindId cur = tiles[y][x];
        if (avoidSolid && (cur == wallTile || cur == waterTile)) continue;
        if (cur == tile) continue;
        tiles[y][x] = tile;
        ++placed;
    }
}

// Carves a winding random-walk path between two points -- js/world.js's
// carvePath(), lines 740-756.
void carvePath(std::vector<std::vector<TileKindId>>& tiles, int W, int H, int x0, int y0, int x1, int y1,
               ProceduralPrng& rng, TileKindId pathTile, TileKindId wallTile, TileKindId waterTile) {
    int cx = x0, cy = y0;
    const int steps = std::abs(x1 - x0) + std::abs(y1 - y0) + 20;
    for (int i = 0; i < steps && (cx != x1 || cy != y1); ++i) {
        if (cx >= 1 && cx < W - 1 && cy >= 1 && cy < H - 1) {
            if (tiles[cy][cx] != wallTile && tiles[cy][cx] != waterTile) tiles[cy][cx] = pathTile;
        }
        // Step toward target with some jitter -- the JS's own short-circuit
        // (rng() only drawn a second time when the first roll is < 0.2)
        // matters for the RNG stream, so the ternary chain below preserves
        // it exactly rather than always drawing both.
        const int jx = (rng.next() < 0.2 ? (rng.next() < 0.5 ? -1 : 1) : 0);
        const int jy = (rng.next() < 0.2 ? (rng.next() < 0.5 ? -1 : 1) : 0);
        const int dx = x1 - cx, dy = y1 - cy;
        if (std::abs(dx) > std::abs(dy)) cx += (dx > 0 ? 1 : -1) + jx;
        else cy += (dy > 0 ? 1 : -1) + jy;
        cx = std::max(1, std::min(W - 2, cx));
        cy = std::max(1, std::min(H - 2, cy));
    }
}

struct GridPos {
    int x = 0;
    int y = 0;
};

// Spiral search for a 2x2-ish open area -- js/quests.js's findOpenArea(),
// lines 765-780. Always returns a usable position: the JS itself falls
// back to the grid center when nothing is found within `radius`, so this
// never needs an "empty" sentinel the way placeDungeonEntrance() below
// does.
GridPos findOpenArea(const std::vector<std::vector<TileKindId>>& tiles, int W, int H, int cx, int cy,
                      ProceduralPrng& rng, const std::array<TileKindId, 5>& openKinds, int radius = 10) {
    for (int r = 1; r < radius; ++r) {
        for (int attempts = 0; attempts < 16; ++attempts) {
            const double angle = rng.next() * 2.0 * kPi;
            const int x = static_cast<int>(std::lround(cx + std::cos(angle) * r));
            const int y = static_cast<int>(std::lround(cy + std::sin(angle) * r));
            if (x < 2 || x >= W - 3 || y < 2 || y >= H - 2) continue;
            for (TileKindId kind : openKinds)
                if (tiles[y][x] == kind) return {x, y};
        }
    }
    return {W / 2, H / 2};
}

struct StairSpot {
    int x = -1;
    int y = -1;
    bool found = false;
};

// Finds a clear floor spot away from exits/facilities and paints the
// dungeon stair tile directly -- js/zones.js's placeDungeonEntrance(),
// lines 1756-1772. Checks T.GRASS/T.DARK_GRASS/T.DIRT specifically (not
// cfg.baseTile/altTile), matching the JS exactly -- for a biome whose base
// isn't one of those three (Iron Peaks/Obsidian Depths), this mostly finds
// a spot on a dirt path/spine rather than open terrain, same as the JS.
StairSpot placeDungeonEntrance(std::vector<std::vector<TileKindId>>& tiles, int W, int H, ProceduralPrng& rng,
                                TileKindId stairTile, TileKindId grassTile, TileKindId darkGrassTile,
                                TileKindId dirtTile, TileKindId exitTile, TileKindId exitReturnTile,
                                TileKindId smelterTile, TileKindId shopTile) {
    for (int att = 0; att < 200; ++att) {
        const int x = 8 + static_cast<int>(rng.next() * (W - 16));
        const int y = 8 + static_cast<int>(rng.next() * (H - 16));
        if (tiles[y][x] != grassTile && tiles[y][x] != darkGrassTile && tiles[y][x] != dirtTile) continue;
        bool clear = true;
        for (int dy = -2; dy <= 2 && clear; ++dy) {
            for (int dx = -2; dx <= 2 && clear; ++dx) {
                const int ty = y + dy, tx = x + dx;
                if (ty < 0 || ty >= H || tx < 0 || tx >= W) continue; // JS's `?.` optional read: out of range matches nothing
                const TileKindId t = tiles[ty][tx];
                if (t == exitTile || t == exitReturnTile || t == smelterTile || t == shopTile) clear = false;
            }
        }
        if (clear) {
            tiles[y][x] = stairTile;
            return {x, y, true};
        }
    }
    return {};
}

struct OreCfg {
    TileKindId tile;
    int count;
};
struct TreeCfg {
    TileKindId tile;
    int count;
};
struct EnemyCfg {
    TileKindId tile;
    int count;
};

// One biome's generation parameters -- js/world.js's ZONE_CONFIGS, lines
// 759-816. `req` (a Mining-level gate on an ore, gameplay-only) is
// deliberately not transcribed -- terrain generation is this pass's whole
// scope, see GrimstoneGame.h's own doc comment.
struct ZoneGenConfig {
    const char* slug;
    TileKindId baseTile;
    TileKindId altTile;
    TileKindId borderTile;
    double waterChance;
    std::vector<OreCfg> ores;
    std::vector<TreeCfg> trees;
    std::vector<EnemyCfg> enemies;
    int fishSpots;
    bool hasShop;
    int pathCount;
    double altBiomeChance;
};

} // namespace

// Ports js/quests.js's makeZoneMap(z) (lines 582-763) for z=1..4 (the 4
// ZONE_CONFIGS biomes) plus placeDungeonEntrance() (js/zones.js, lines
// 1756-1772) for z=1,2 -- see GrimstoneGame.h's own doc comment for the
// zoneIndex/seed contract and the design calls made here:
//
// Layering: everything the JS paints into `tiles` BEFORE its own floor
// snapshot (`const floor = tiles.map(row => [...row])`, line 754) --
// terrain, alt-biome patches, water, fishing spots, ore/tree clusters,
// enemy spawns, the smelter/cooking-fire facility, the shop, the carved
// paths/spine, and BOTH portals -- ends up baked into the JS's own floor
// array too, since nothing restores an underlying tile the way
// placeDecor() does for any of those. Per this file's own Floor/Overlay
// convention (buildAshenveilLevel()'s doc comment), that whole set goes on
// this TileGrid's Floor layer via setFloor(). Only the dungeon stair --
// placed by a SEPARATE call AFTER that snapshot, so the JS's own floor
// array still holds the original grass/dark-grass/dirt underneath it --
// becomes an Overlay paint instead, exactly mirroring how buildAshenveilLevel()
// splits its own floor-snapshot-then-placeDecor() sequence.
//
// Markers: EXIT/EXIT_RETURN get a "portal" TileMarker with a
// "targetZone" property (same convention buildAshenveilLevel() already
// uses for its own portals) IN ADDITION to the painted Floor tile -- the
// JS has no marker concept at all, so the tile alone is what the JS itself
// relies on for a zone transition, but this port adds the marker too so a
// future host-level trigger has something structured to read, matching
// this codebase's own established pattern rather than inventing a new one.
// The dungeon stair gets a "dungeon_stair_down" marker; a "player_spawn"
// marker sits at the cleared west entry point (see the force-clear-spawn-
// area section below).
TileGrid buildProceduralZone(const TileKindRegistry& registry, int zoneIndex, uint32_t seed) {
    const TileKindId grass = registry.idFromName("grass");
    const TileKindId dirt = registry.idFromName("dirt");
    const TileKindId stoneFloor = registry.idFromName("stone_floor");
    const TileKindId water = registry.idFromName("water");
    const TileKindId darkGrass = registry.idFromName("dark_grass");
    const TileKindId dungeonFloor = registry.idFromName("dungeon_floor");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId copper = registry.idFromName("copper_ore_node");
    const TileKindId iron = registry.idFromName("iron_ore_node");
    const TileKindId gold = registry.idFromName("gold_ore_node");
    const TileKindId mithril = registry.idFromName("mithril_ore_node");
    const TileKindId coal = registry.idFromName("coal_node");
    const TileKindId oak = registry.idFromName("oak_tree");
    const TileKindId willow = registry.idFromName("willow_tree");
    const TileKindId normalTree = registry.idFromName("normal_tree");
    const TileKindId fishing = registry.idFromName("fishing_spot");
    const TileKindId fishing2 = registry.idFromName("fishing_spot_2");
    const TileKindId goblin = registry.idFromName("goblin_spawn");
    const TileKindId skeleton = registry.idFromName("skeleton_spawn");
    const TileKindId wolf = registry.idFromName("wolf_spawn");
    const TileKindId smelter = registry.idFromName("smelter");
    const TileKindId cookingFire = registry.idFromName("cooking_fire");
    const TileKindId shop = registry.idFromName("shop");
    const TileKindId exit = registry.idFromName("exit");
    const TileKindId exitReturn = registry.idFromName("exit_return");
    const TileKindId dungeonStairDown = registry.idFromName("dungeon_stair_down");
    // Only used by the enemy-placement PORTAL_TILES exclusion check below.
    const TileKindId chapelPortal = registry.idFromName("chapel_portal");
    const TileKindId innDoor = registry.idFromName("inn_door");
    const TileKindId dungeonStairUp = registry.idFromName("dungeon_stair_up");
    const TileKindId cryptStair = registry.idFromName("crypt_stair");

    // ---- ZONE_CONFIGS -- js/world.js lines 759-816 ----
    const ZoneGenConfig kZoneConfigs[] = {
        { // zoneIndex 1: The Ashen Moor -- grassy moorland
            "ashen_moor", grass, darkGrass, stoneFloor, 0.18,
            {{copper, 14}},
            {{normalTree, 18}, {oak, 10}},
            {{goblin, 8}},
            4, true, 3, 0.25,
        },
        { // zoneIndex 2: The Iron Peaks -- rocky highland
            "iron_peaks", stoneFloor, dirt, wall, 0.08,
            {{iron, 16}, {coal, 12}, {gold, 12}},
            {{willow, 8}, {oak, 6}},
            {{skeleton, 9}, {wolf, 6}},
            2, true, 2, 0.3,
        },
        { // zoneIndex 3: The Cursed Marshes -- wet dark land
            "cursed_marshes", darkGrass, grass, wall, 0.30,
            {{mithril, 14}, {iron, 10}, {coal, 8}},
            {{willow, 20}, {normalTree, 6}},
            {{skeleton, 10}, {goblin, 8}, {wolf, 5}},
            6, false, 2, 0.15,
        },
        { // zoneIndex 4: The Obsidian Depths -- dark dungeon
            "obsidian_depths", dungeonFloor, stoneFloor, wall, 0.10,
            {{mithril, 10}, {gold, 8}, {coal, 10}},
            {},
            {{skeleton, 14}, {wolf, 8}},
            3, false, 1, 0.2,
        },
    };
    constexpr int kZoneConfigCount = 4;
    const int cfgIndex = (zoneIndex >= 1 && zoneIndex <= kZoneConfigCount) ? zoneIndex - 1 : 0;
    const ZoneGenConfig& cfg = kZoneConfigs[cfgIndex];

    const int W = kMapW, H = kMapH;
    const uint32_t zoneSeed = seed + static_cast<uint32_t>(zoneIndex) * 7919u;
    ProceduralPrng rng(zoneSeed);

    // ---- Fill base + hard border -- js/quests.js lines 592-597 ----
    std::vector<std::vector<TileKindId>> tiles(H, std::vector<TileKindId>(W, cfg.baseTile));
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) tiles[y][x] = cfg.borderTile;

    // ---- Alt-biome patches via fractal noise -- lines 599-603 ----
    FractalNoise2D biomeNoise(zoneSeed + 111u, W, H, 3);
    for (int y = 1; y < H - 1; ++y)
        for (int x = 1; x < W - 1; ++x)
            if (biomeNoise.sample(x, y) > (1.0 - cfg.altBiomeChance)) tiles[y][x] = cfg.altTile;

    // ---- Water via noise + cellular-automata smoothing -- lines 605-623 ----
    FractalNoise2D waterNoise(zoneSeed + 333u, W, H, 4);
    const double waterThreshold = 1.0 - cfg.waterChance;
    for (int y = 2; y < H - 2; ++y)
        for (int x = 2; x < W - 2; ++x)
            if (waterNoise.sample(x, y) > waterThreshold && tiles[y][x] != cfg.borderTile) tiles[y][x] = water;
    smoothTerrain(tiles, W, H, water, grass, 3);
    for (int y = 1; y < H - 1; ++y) {
        for (int x = 1; x < W - 1; ++x) {
            if (tiles[y][x] != water) continue;
            int adj = 0;
            for (int dy = -1; dy <= 1; ++dy)
                for (int dx = -1; dx <= 1; ++dx)
                    if (tiles[y + dy][x + dx] == water) ++adj;
            if (adj <= 1) tiles[y][x] = cfg.baseTile;
        }
    }

    // ---- Fishing spots on water edges -- lines 625-640 ----
    int fishPlaced = 0;
    for (int y = 2; y < H - 2 && fishPlaced < cfg.fishSpots; ++y) {
        for (int x = 2; x < W - 2 && fishPlaced < cfg.fishSpots; ++x) {
            if (tiles[y][x] != water) continue;
            bool hasLand = false;
            for (const auto& d : {std::pair{-1, 0}, std::pair{1, 0}, std::pair{0, -1}, std::pair{0, 1}}) {
                const TileKindId t = tiles[y + d.first][x + d.second];
                if (t != water && t != wall) { hasLand = true; break; }
            }
            if (hasLand && rng.next() < 0.12) {
                tiles[y][x] = (zoneIndex >= 2) ? fishing2 : fishing;
                ++fishPlaced;
            }
        }
    }

    // ---- Ore clusters, in rough thirds of the map -- lines 642-653 ----
    for (const OreCfg& ore : cfg.ores) {
        const int cx = static_cast<int>(std::floor(W * 0.15 + rng.next() * (W * 0.7)));
        const int cy = static_cast<int>(std::floor(H * 0.15 + rng.next() * (H * 0.7)));
        placeCluster(tiles, W, H, cx, cy, ore.tile, ore.count, 4.0 + rng.next() * 3.0, rng, wall, water);
        if (ore.count > 8) {
            const int cx2 = static_cast<int>(std::floor(W * 0.2 + rng.next() * (W * 0.6)));
            const int cy2 = static_cast<int>(std::floor(H * 0.2 + rng.next() * (H * 0.6)));
            placeCluster(tiles, W, H, cx2, cy2, ore.tile, static_cast<int>(std::floor(ore.count * 0.6)),
                         3.0 + rng.next() * 2.0, rng, wall, water);
        }
    }

    // ---- Trees -- lines 655-663 ----
    for (const TreeCfg& tree : cfg.trees) {
        const int numClusters = static_cast<int>(std::ceil(tree.count / 5.0));
        for (int c = 0; c < numClusters; ++c) {
            const int cx = static_cast<int>(std::floor(2 + rng.next() * (W - 4)));
            const int cy = static_cast<int>(std::floor(2 + rng.next() * (H - 4)));
            placeCluster(tiles, W, H, cx, cy, tree.tile,
                         static_cast<int>(std::ceil(static_cast<double>(tree.count) / numClusters)),
                         3.0 + rng.next() * 4.0, rng, wall, water);
        }
    }

    // ---- Enemy spawns, avoiding resources/water/portals -- lines 665-691.
    // The PORTAL_TILES exclusion is ported faithfully even though it's dead
    // code for this generator: at this point in generation order none of
    // EXIT/EXIT_RETURN/the dungeon stairs have been painted yet (they're
    // all placed later, below), so this check never actually excludes
    // anything here, exactly as in the JS. ----
    const auto isPortalTile = [&](TileKindId t) {
        return t == exit || t == exitReturn || t == chapelPortal || t == innDoor || t == dungeonStairDown ||
               t == dungeonStairUp || t == cryptStair;
    };
    constexpr int kPortalClear = 7;
    for (const EnemyCfg& en : cfg.enemies) {
        int placed = 0, attempts = 0;
        while (placed < en.count && attempts < 500) {
            ++attempts;
            const int x = static_cast<int>(std::floor(2 + rng.next() * (W - 4)));
            const int y = static_cast<int>(std::floor(2 + rng.next() * (H - 4)));
            if (tiles[y][x] != cfg.baseTile && tiles[y][x] != cfg.altTile) continue;
            bool tooClose = false;
            for (const auto& d : {std::pair{-2, 0}, std::pair{2, 0}, std::pair{0, -2}, std::pair{0, 2}}) {
                const int ny = y + d.first, nx = x + d.second;
                if (ny >= 0 && ny < H && nx >= 0 && nx < W && tiles[ny][nx] == en.tile) { tooClose = true; break; }
            }
            if (tooClose) continue;
            bool nearPortal = false;
            for (int dy = -kPortalClear; dy <= kPortalClear && !nearPortal; ++dy)
                for (int dx = -kPortalClear; dx <= kPortalClear && !nearPortal; ++dx) {
                    const int ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < H && nx >= 0 && nx < W && isPortalTile(tiles[ny][nx])) nearPortal = true;
                }
            if (!nearPortal) { tiles[y][x] = en.tile; ++placed; }
        }
    }

    // ---- Facility: smelter + cooking fire -- lines 693-699. findOpenArea()
    // always returns a usable position (falls back to grid center), so
    // this placement is unconditional, matching the JS's own always-truthy
    // `if(facilityZone)`. ----
    const std::array<TileKindId, 5> openKinds = {grass, stoneFloor, darkGrass, dungeonFloor, dirt};
    const GridPos facilitySpot = findOpenArea(tiles, W, H, W / 2, H / 2, rng, openKinds);
    tiles[facilitySpot.y][facilitySpot.x] = smelter;
    if (facilitySpot.x + 1 < W - 1) tiles[facilitySpot.y][facilitySpot.x + 1] = cookingFire;

    // ---- Shop in corner -- lines 701-705 ----
    if (cfg.hasShop) tiles[2][W - 3] = shop;

    // ---- Dirt paths connecting key points -- lines 707-715 ----
    std::vector<std::pair<int, int>> pathPoints = {{W / 2, H / 2},
                                                     {facilitySpot.x, facilitySpot.y},
                                                     {4, 4},
                                                     {W - 4, H - 4},
                                                     {4, H - 4},
                                                     {W - 4, 4}};
    for (int p = 0; p < cfg.pathCount; ++p) {
        const auto& a = pathPoints[p % pathPoints.size()];
        const auto& b = pathPoints[(p + 1) % pathPoints.size()];
        carvePath(tiles, W, H, a.first, a.second, b.first, b.second, rng, dirt, wall, water);
    }

    // ---- Horizontal spine road -- lines 716-721 ----
    const int exitY = H / 2;
    for (int x = 2; x < W - 1; ++x)
        if (tiles[exitY][x] == cfg.baseTile || tiles[exitY][x] == cfg.altTile || tiles[exitY][x] == cfg.borderTile)
            tiles[exitY][x] = dirt;

    // ---- EXIT portal at the east edge, unless this is the last zone --
    // lines 722-733. `zoneIndex < kZoneConfigCount` mirrors the JS's own
    // `zoneIndex < ZONES.length - 1` (ZONES has 5 entries -- Ashenveil plus
    // these 4 -- so ZONES.length-1 == kZoneConfigCount == 4). ----
    const bool isLastZone = (zoneIndex >= kZoneConfigCount);
    if (!isLastZone) {
        tiles[exitY][W - 1] = exit;
        for (int dx = 1; dx <= 3; ++dx) {
            const int ex = W - 1 - dx;
            if (ex >= 1 && tiles[exitY][ex] != exit) tiles[exitY][ex] = dirt;
        }
    } else {
        tiles[exitY][W - 1] = dirt;
    }

    // ---- EXIT_RETURN portal at the west edge, always present -- lines
    // 735-741 ----
    tiles[exitY][0] = exitReturn;
    for (int dx = 1; dx <= 3; ++dx)
        if (tiles[exitY][dx] != exitReturn) tiles[exitY][dx] = dirt;

    // ---- Force-clear spawn area around (5, exitY) -- lines 743-751.
    // SOLID_TILES_GEN (js/quests.js lines 555-564) is a hardcoded numeric-
    // id set covering every tile kind ANY of the game's generators can
    // paint; only the subset that can actually appear in THIS generator's
    // own output is relevant here (ores/trees/the facility/the shop --
    // enemy-spawn tiles are deliberately NOT included, matching
    // registerGrimstoneTileKinds()'s own convention that they aren't
    // blocking). ----
    const std::array<TileKindId, 11> solidGenTiles = {copper,     iron,        gold,   mithril, coal, oak,
                                                        willow,     normalTree,  smelter, cookingFire, shop};
    const auto isSolidGen = [&](TileKindId t) {
        for (TileKindId s : solidGenTiles)
            if (t == s) return true;
        return false;
    };
    for (int dy = -2; dy <= 2; ++dy) {
        for (int dx = -2; dx <= 2; ++dx) {
            const int x = 5 + dx, y = exitY + dy;
            if (x >= 1 && x < W - 1 && y >= 1 && y < H - 1) {
                const TileKindId t = tiles[y][x];
                if (t == water || t == wall || isSolidGen(t)) tiles[y][x] = cfg.baseTile;
            }
        }
    }

    // ---- Floor layer is now fully authored -- js's own
    // `floor = tiles.map(row=>[...row])` snapshot (line 754). See this
    // function's own doc comment for why everything above this point goes
    // on Floor and only the dungeon stair below becomes an Overlay. ----
    TileGrid grid(W, H, 1.0f);
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, tiles[y][x]);

    // ---- Dungeon entrance -- zones 1-2 only (js/quests.js lines 756-760),
    // placed AFTER the floor snapshot above, so (matching the JS) the
    // floor tile underneath is left untouched -- ported as an Overlay
    // paint + a "dungeon_stair_down" TileMarker, per this function's own
    // doc comment. ----
    if (zoneIndex == 1 || zoneIndex == 2) {
        const StairSpot stair = placeDungeonEntrance(tiles, W, H, rng, dungeonStairDown, grass, darkGrass, dirt,
                                                       exit, exitReturn, smelter, shop);
        if (stair.found) {
            grid.setOverlay(stair.x, stair.y, dungeonStairDown);
            TileMarker marker;
            marker.kind = "dungeon_stair_down";
            marker.name = "Dungeon Entrance";
            marker.position = glm::vec2(stair.x + 0.5f, stair.y + 0.5f);
            grid.markers.push_back(marker);
        }
    }

    // ---- Portals as TileMarkers, in addition to the painted Floor tiles
    // above -- same "paint + marker" convention buildAshenveilLevel()
    // already uses for its own portals (see that function's own doc
    // comment). Zone-name slugs match this function's own header comment.
    // ----
    static constexpr const char* kZoneSlugs[kZoneConfigCount] = {"ashen_moor", "iron_peaks", "cursed_marshes",
                                                                   "obsidian_depths"};
    auto addPortalMarker = [&](const char* name, float px, float py, const char* targetZone) {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = name;
        marker.position = glm::vec2(px + 0.5f, py + 0.5f);
        marker.properties["targetZone"] = targetZone;
        grid.markers.push_back(marker);
    };
    if (!isLastZone) {
        // Next zone's slug: kZoneSlugs is 0-indexed by (zoneIndex+1)-1, i.e. kZoneSlugs[zoneIndex].
        addPortalMarker("Exit", static_cast<float>(W - 1), static_cast<float>(exitY), kZoneSlugs[zoneIndex]);
    }
    // Previous zone's slug: zoneIndex 1 returns to Ashenveil (zone 0, which
    // has no ZONE_CONFIGS entry of its own); otherwise kZoneSlugs[zoneIndex-2].
    const char* returnTarget = (zoneIndex == 1) ? "ashenveil" : kZoneSlugs[zoneIndex - 2];
    addPortalMarker("Return", 0.0f, static_cast<float>(exitY), returnTarget);

    // ---- Player spawn -- inside the force-cleared area above ----
    grid.markers.push_back(
        {"player_spawn", glm::vec2(5.5f, static_cast<float>(exitY) + 0.5f), "Player Spawn"});

    return grid;
}

// ======= STORMCRAG REACH =======
// Transcribed from `function makeStormcragMap()` in js/zones.js (lines
// 251-380 as of this writing) -- see GrimstoneGame.h's own doc comment on
// buildStormcragLevel() for how this differs from buildAshenveilLevel()
// (which has no randomness at all) and from buildProceduralZone() (which
// generates a whole biome from a small config table); this one is a fixed
// hand-authored layout that happens to lean on the same noise primitives.
//
// Placeholder seed: js/world.js's `worldSeed` (a per-playthrough value
// chosen once at new-game time) isn't threaded through this port yet --
// buildAshenveilLevel() never needed one (no randomness), and
// buildProceduralZone() takes it as an explicit parameter since its own
// caller already has to pick a per-zone seed anyway. This function's own
// signature was specified to stay `(registry)`-only (see GrimstoneGame.h),
// so a fixed constant stands in for `worldSeed` below -- purely a
// placeholder judgement call, not a real per-playthrough seed. Once a real
// seed concept lands on this side (see PORTING_PLAN.md), thread it through
// here the same way buildProceduralZone() already takes one, rather than
// leaving this the one hand-authored zone whose noise never varies.
constexpr uint32_t kStormcragPlaceholderWorldSeed = 1u;

// Layering follows buildProceduralZone()'s own convention (its doc
// comment above), not buildAshenveilLevel()'s: everything the JS bakes
// into `tiles` BEFORE its own floor snapshot (`// Snapshot floor`, JS
// lines 325-326) -- the elevation bands, the water pools, the winding
// path, the clearing, and the scattered rubble -- goes on this TileGrid's
// Floor layer via a local `tiles` vector exactly like buildProceduralZone()
// builds one, then snapshotted into the grid at that point. Everything
// AFTER the snapshot follows the JS's own per-site choice: the tower ring
// and the door's floor-clearing gap set BOTH `tiles` AND `floor` in the JS
// (lines 336-341, 348-349) -- a genuine floor-terrain change, not decor --
// so those become Floor writes here too; the north portal, the tower's
// cracked walls, the ore nodes, and the shadow walkers set `tiles` ONLY
// post-snapshot (decor sitting on top of whatever floor is already there),
// so those become Overlay paints via setOverlay(), the same "final visible
// tile differs from the floor snapshot" test buildAshenveilLevel()'s own
// placeDecor()-vs-direct-assignment split already uses.
//
// Post-snapshot occupancy checks (the ore/shadow-walker placement loops)
// read grid.floorAt() rather than reconstructing the JS's own post-snapshot
// `tiles` array: every post-snapshot Overlay paint placed before those
// loops run (the portal, the tower ring's cracked walls, the door) sits
// inside this function's own nearTower/nearPortal/nearPortalOrDoor
// exclusion radii, so floorAt() alone gives the identical accept/reject
// result the JS's own `tiles[y][x]` check would -- documented here rather
// than silently relied on, since it stops being true if a future edit
// moves those exclusion radii.
TileGrid buildStormcragLevel(const TileKindRegistry& registry) {
    const TileKindId darkGrass = registry.idFromName("dark_grass");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId stoneFloor = registry.idFromName("stone_floor");
    const TileKindId dirt = registry.idFromName("dirt");
    const TileKindId water = registry.idFromName("water");
    const TileKindId normalTree = registry.idFromName("normal_tree");
    const TileKindId oakTree = registry.idFromName("oak_tree");
    const TileKindId forestPortal = registry.idFromName("forest_portal");
    const TileKindId crackedWall = registry.idFromName("cracked_wall");
    const TileKindId wizardDoor = registry.idFromName("wizard_door");
    const TileKindId goldOre = registry.idFromName("gold_ore_node");
    const TileKindId mithrilOre = registry.idFromName("mithril_ore_node");
    const TileKindId stoneRubble = registry.idFromName("stone_rubble");
    const TileKindId shadowWalker = registry.idFromName("shadow_walker");

    const int W = 60, H = 50; // js/zones.js's own W/H locals for this zone
    ProceduralPrng rng(kStormcragPlaceholderWorldSeed + 77742u);

    // ---- Init to dark grass + hard border -- JS lines 252-259 ----
    std::vector<std::vector<TileKindId>> tiles(H, std::vector<TileKindId>(W, darkGrass));
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) tiles[y][x] = wall;

    // ---- Elevation bands: forest (north) fading into bare stone (south)
    // -- JS lines 261-281 ----
    FractalNoise2D elevNoise(kStormcragPlaceholderWorldSeed + 55521u, W, H, 4);
    FractalNoise2D rockNoise(kStormcragPlaceholderWorldSeed + 33318u, W, H, 3);
    for (int y = 1; y < H - 1; ++y) {
        const double elevation = static_cast<double>(y) / (H - 1);
        for (int x = 1; x < W - 1; ++x) {
            const double n = elevNoise.sample(x, y);
            const double rocky = elevation * 0.7 + n * 0.3;
            if (rocky > 0.72) {
                tiles[y][x] = (rockNoise.sample(x, y) > 0.5) ? stoneFloor : wall; // bare rock / boulders
            } else if (rocky > 0.5) {
                tiles[y][x] = dirt; // transitional scree
            } else if (rocky > 0.35) {
                tiles[y][x] = darkGrass; // sparse scrub
            } else {
                tiles[y][x] = (n > 0.55) ? normalTree : (n > 0.42 ? oakTree : darkGrass); // forest
            }
        }
    }

    // ---- Smooth water pools, northern third only -- JS lines 283-286 ----
    FractalNoise2D waterNoise(kStormcragPlaceholderWorldSeed + 11198u, W, H, 3);
    for (int y = 2; y < static_cast<int>(H * 0.35); ++y)
        for (int x = 2; x < W - 2; ++x)
            if (waterNoise.sample(x, y) > 0.80 && tiles[y][x] == darkGrass) tiles[y][x] = water;

    // ---- Guaranteed-connected winding path from the north portal (x=18)
    // to the tower (x=30): wind south while drifting toward towerX, then a
    // straight connector -- JS lines 288-310 ----
    const int towerX = 30, towerY = H - 8;
    const int startX = 18;
    int cx = startX;
    for (int y = 1; y < towerY - 4; ++y) {
        const int bias = (cx < towerX) ? 1 : (cx > towerX ? -1 : 0);
        const int drift = static_cast<int>(std::floor(rng.next() * 3.0)) - 1 + ((rng.next() < 0.4) ? bias : 0);
        cx = std::max(4, std::min(W - 5, cx + drift));
        for (int dx = -1; dx <= 1; ++dx) {
            const int nx = cx + dx;
            if (nx > 0 && nx < W - 1) tiles[y][nx] = dirt;
        }
    }
    const int connY = towerY - 4;
    const int step = (cx < towerX) ? 1 : -1;
    for (int x = cx; x != towerX; x += step) {
        if (x > 0 && x < W - 1) {
            tiles[connY][x] = dirt;
            tiles[connY - 1][x] = dirt;
        }
    }
    for (int y = connY; y < towerY + 2; ++y)
        if (y > 0 && y < H - 1) tiles[y][towerX] = dirt;

    // ---- Wide clearing south of the tower approach -- JS lines 312-316 ----
    for (int dy = -5; dy <= 4; ++dy)
        for (int dx = -8; dx <= 8; ++dx) {
            const int ny = towerY + dy, nx = towerX + dx;
            if (ny > 0 && ny < H - 1 && nx > 0 && nx < W - 1) tiles[ny][nx] = stoneFloor;
        }

    // ---- Scatter rubble around the clearing -- JS lines 318-323 ----
    for (int att = 0; att < 40; ++att) {
        const int rx = towerX - 10 + static_cast<int>(std::floor(rng.next() * 20.0));
        const int ry = towerY - 8 + static_cast<int>(std::floor(rng.next() * 12.0));
        if (ry > 0 && ry < H - 1 && rx > 0 && rx < W - 1 && tiles[ry][rx] == stoneFloor) tiles[ry][rx] = stoneRubble;
    }

    // ---- Floor layer is now fully authored -- JS's own "Snapshot floor"
    // (lines 325-326). See this function's own doc comment above for the
    // Floor-vs-Overlay split on everything from here on. ----
    TileGrid grid(W, H, 1.0f);
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, tiles[y][x]);

    // ---- North return portal at x=18 (aligned with the Whisperwood's own
    // south exit) -- JS lines 328-330. `tiles[0][startX]=DARK_GRASS`
    // overrides the hard-border WALL for this one cell before the portal
    // decor paints on top -- setFloor() first, matching that override,
    // then setOverlay() for the portal itself. ----
    grid.setFloor(startX, 0, darkGrass);
    grid.setOverlay(startX, 0, forestPortal);

    // ---- Tower: rough 9x9 ring of walls around a stone-floor interior --
    // JS lines 332-342. Sets BOTH tiles and floor in the JS (a genuine
    // floor-terrain change, not decor) -- setFloor(), not setOverlay(). ----
    const int tw = 9, th = 9;
    const int tx = towerX - tw / 2, ty = towerY - th + 2;
    for (int dy = 0; dy < th; ++dy) {
        for (int dx = 0; dx < tw; ++dx) {
            const int ny = ty + dy, nx = tx + dx;
            if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue;
            const bool isEdge = (dy == 0 || dy == th - 1 || dx == 0 || dx == tw - 1);
            grid.setFloor(nx, ny, isEdge ? wall : stoneFloor);
        }
    }
    // Cracked exterior walls -- JS lines 344-346. Sets `tiles` only (the
    // ring above already set `floor` to WALL at these same cells) --
    // decor over that wall, so setOverlay().
    for (const auto& yx : {std::pair{ty, tx + 2}, std::pair{ty, tx + 6}, std::pair{ty + 2, tx},
                           std::pair{ty + 6, tx}, std::pair{ty + 2, tx + tw - 1}, std::pair{ty + 6, tx + tw - 1}}) {
        const int ny = yx.first, nx = yx.second;
        if (ny > 0 && ny < H - 1 && nx > 0 && nx < W - 1) grid.setOverlay(nx, ny, crackedWall);
    }
    // Tower door -- south face, clears the ring's wall gap -- JS lines
    // 347-350. Sets BOTH tiles and floor to STONE_FLOOR (clearing the
    // gap -- a real floor change) before placeDecor() paints WIZARD_DOOR
    // on top -- setFloor() then setOverlay(), same split
    // buildAshenveilLevel()'s own building-door tiles already use.
    const int doorX = tx + tw / 2, doorY = ty + th - 1;
    grid.setFloor(doorX, doorY, stoneFloor);
    grid.setOverlay(doorX, doorY, wizardDoor);

    // ---- Gold + mithril ore scattered in the rocky mid/south terrain --
    // JS lines 352-368. Sets `tiles` only post-snapshot -- Overlay (see
    // this function's own doc comment on the floorAt() occupancy check
    // below). ----
    struct OreScatter {
        TileKindId tile;
        int count;
        double minYFrac;
    };
    const OreScatter oreTypes[] = {
        {goldOre, 10, 0.35},
        {mithrilOre, 8, 0.55},
    };
    for (const OreScatter& ore : oreTypes) {
        const int minY = static_cast<int>(std::floor(H * ore.minYFrac));
        int placed = 0;
        for (int att = 0; att < 400 && placed < ore.count; ++att) {
            const int ox = 3 + static_cast<int>(std::floor(rng.next() * (W - 6)));
            const int oy = minY + static_cast<int>(std::floor(rng.next() * (H - minY - 8)));
            const TileKindId cur = grid.floorAt(ox, oy);
            if (cur == stoneFloor || cur == dirt || cur == darkGrass) {
                // Keep away from the tower and the north portal.
                const bool nearTower = std::abs(ox - towerX) < 12 && std::abs(oy - towerY) < 12;
                const bool nearPortal = oy < 6;
                if (!nearTower && !nearPortal) {
                    grid.setOverlay(ox, oy, ore.tile);
                    ++placed;
                }
            }
        }
    }

    // ---- Shadow walkers scattered in the rocky mid-section -- JS lines
    // 370-377 ----
    int swPlaced = 0;
    for (int att = 0; att < 300 && swPlaced < 8; ++att) {
        const int ex = 4 + static_cast<int>(std::floor(rng.next() * (W - 8)));
        const int ey =
            static_cast<int>(std::floor(H * 0.25)) + static_cast<int>(std::floor(rng.next() * std::floor(H * 0.5)));
        const TileKindId cur = grid.floorAt(ex, ey);
        if (cur != darkGrass && cur != dirt && cur != stoneFloor) continue;
        const bool nearPortalOrDoor =
            (std::abs(ex - 18) < 8 && ey < 8) || (std::abs(ex - towerX) < 10 && std::abs(ey - towerY) < 10);
        if (!nearPortalOrDoor) {
            grid.setOverlay(ex, ey, shadowWalker);
            ++swPlaced;
        }
    }

    // ---- Portals as TileMarkers, in addition to the painted tiles above
    // -- same "paint + marker" convention buildAshenveilLevel() and
    // buildProceduralZone() both already use for their own portals. ----
    auto addPortalMarker = [&](const char* name, float px, float py, const char* targetZone) {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = name;
        marker.position = glm::vec2(px + 0.5f, py + 0.5f);
        marker.properties["targetZone"] = targetZone;
        grid.markers.push_back(marker);
    };
    addPortalMarker("Forest Portal -> Whisperwood", static_cast<float>(startX), 0.0f, "whisperwood");
    // The Wizard Tower's own interior (js/zones.js's makeWizardTowerInterior(),
    // NOT ported by this function -- see this function's own header
    // doc comment) is entered via `enterInterior()` in the JS, the same
    // mechanism as buildAshenveilLevel()'s CHAPEL_PORTAL -- a "portal"
    // marker here documents that wiring for a future pass, matching
    // buildAshenveilLevel()'s own chapel_portal precedent of authoring a
    // marker toward a not-yet-ported destination.
    addPortalMarker("Wizard Tower Door", static_cast<float>(doorX), static_cast<float>(doorY), "aetheric_spire");

    // ---- NPC spawn markers -- js/zones.js's own makeStormcragMap() has
    // none of its own (no named NPCs, only the shadow-walker enemy tiles
    // scattered above); nothing to add here, matching this function's own
    // doc comment on what the JS actually authors. ----

    // ---- Player spawn -- js's own returned entryX:18, entryY:2 (the
    // arrival point coming from the Whisperwood's own south portal). ----
    grid.markers.push_back({"player_spawn", glm::vec2(18.5f, 2.5f), "Player Spawn"});

    return grid;
}

// ======= WIZARD TOWER INTERIOR (THE AETHERIC SPIRE) =======
// Transcribed from `function makeWizardTowerInterior()` in js/zones.js
// (lines 383-479 as of this writing) -- see GrimstoneGame.h's own doc
// comment on buildWizardTowerInterior() for the zone-graph wiring.
//
// Grid size is 22x26 (js/zones.js's own W/H locals for this zone). No
// PRNG/noise at all -- a fixed hand-authored layout, like
// buildAshenveilLevel().
//
// Layering generalizes buildStormcragLevel()'s own convention (its doc
// comment above): every raw `tiles[y][x] = X` assignment in the JS (not via
// placeDecor()) becomes a Floor write here, baked into a local `tiles`
// vector snapshotted into the grid in one pass exactly like
// buildStormcragLevel()/buildProceduralZone() already do; every
// placeDecor() call becomes an Overlay write. TWO placeDecor() calls in
// this function are the interesting case: the EXIT_INTERIOR gap (JS line
// 406) and the 4 cracked-wall cells (JS lines 409-411) both happen BEFORE
// the JS's own "Snapshot floor" line (424-425) -- so the JS's bulk
// snapshot loop copies their ALREADY-decorated `tiles` value into `floor`
// too, meaning floor and tiles end up IDENTICAL for those cells, unlike
// every other placeDecor() call in this function (which all happen after
// that line, so floor keeps the real "underneath" value). That's the same
// "genuine floor change" case buildStormcragLevel()'s own tower-door
// pattern documents, so both are ported as direct Floor writes (baked into
// the local `tiles` vector pre-snapshot) rather than Overlay, to match.
TileGrid buildWizardTowerInterior(const TileKindRegistry& registry) {
    const TileKindId stoneFloor = registry.idFromName("stone_floor");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId exitInterior = registry.idFromName("exit_interior");
    const TileKindId crackedWall = registry.idFromName("cracked_wall");
    const TileKindId cauldron = registry.idFromName("cauldron");
    const TileKindId candle = registry.idFromName("candle");
    const TileKindId barrel = registry.idFromName("barrel");
    const TileKindId stoneRubble = registry.idFromName("stone_rubble");
    const TileKindId bookshelf = registry.idFromName("bookshelf");
    const TileKindId spellTome = registry.idFromName("spell_tome");
    const TileKindId potionRack = registry.idFromName("potion_rack");
    const TileKindId table = registry.idFromName("table");
    const TileKindId arcaneCircle = registry.idFromName("arcane_circle");
    const TileKindId crystalBall = registry.idFromName("crystal_ball");
    const TileKindId telescope = registry.idFromName("telescope");

    const int W = 22, H = 26; // js/zones.js's own W/H locals for this zone
    const int mid = W / 2;    // JS's own Math.floor(W/2), used throughout

    // ---- Fill stone floor, wall border with chamfered corners -- JS lines
    // 384-397 ----
    std::vector<std::vector<TileKindId>> tiles(H, std::vector<TileKindId>(W, stoneFloor));
    for (int y = 0; y < H; ++y) {
        for (int x = 0; x < W; ++x) {
            const bool edge = (y == 0 || y == H - 1 || x == 0 || x == W - 1);
            const bool corner = (y < 2 || y > H - 3) && (x < 2 || x > W - 3);
            tiles[y][x] = (edge || corner) ? wall : stoneFloor;
        }
    }
    for (const auto& yx : {std::pair{0, 0}, std::pair{0, 1}, std::pair{1, 0}, std::pair{0, W - 1},
                            std::pair{0, W - 2}, std::pair{1, W - 1}, std::pair{H - 1, 0}, std::pair{H - 1, 1},
                            std::pair{H - 2, 0}, std::pair{H - 1, W - 1}, std::pair{H - 1, W - 2},
                            std::pair{H - 2, W - 1}})
        tiles[yx.first][yx.second] = wall;

    // ---- Entry vestibule, south -- JS lines 399-402 ----
    tiles[H - 2][mid - 1] = stoneFloor;
    tiles[H - 2][mid] = stoneFloor;
    tiles[H - 2][mid + 1] = stoneFloor;

    // ---- Exit gap at south wall center -- JS lines 404-406. See this
    // function's own doc comment above: this is one of the two placeDecor()
    // calls that lands BEFORE the bulk snapshot, so it becomes Floor. ----
    tiles[H - 1][mid] = exitInterior;

    // ---- Cracked walls for atmosphere -- JS lines 408-411. Also before the
    // snapshot -- Floor, not Overlay (see doc comment above). ----
    for (const auto& yx : {std::pair{2, 3}, std::pair{2, W - 4}, std::pair{H / 2, 2}, std::pair{H / 2, W - 3}})
        if (tiles[yx.first][yx.second] == wall) tiles[yx.first][yx.second] = crackedWall;

    // ---- Floor-level dividers with arch gaps -- JS lines 413-422 ----
    const int groundDividerY = H - 8;
    for (int x = 3; x < W - 3; ++x) tiles[groundDividerY][x] = wall;
    tiles[groundDividerY][mid - 1] = stoneFloor;
    tiles[groundDividerY][mid] = stoneFloor;
    tiles[groundDividerY][mid + 1] = stoneFloor;

    const int midDividerY = static_cast<int>(std::floor(H * 0.45));
    for (int x = 3; x < W - 3; ++x) tiles[midDividerY][x] = wall;
    tiles[midDividerY][mid] = stoneFloor;

    // ---- Floor layer is now fully authored -- JS's own "Snapshot floor
    // before decorations" (lines 424-425). ----
    TileGrid grid(W, H, 1.0f);
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, tiles[y][x]);

    // ---- GROUND FLOOR (south section) -- entry / cauldron room -- JS lines
    // 427-440 ----
    const int gf = H - 7; // top row of ground floor
    placeDecor(grid, gf + 1, 3, cauldron);
    placeDecor(grid, gf + 1, 4, candle);
    placeDecor(grid, gf + 1, W - 4, barrel);
    placeDecor(grid, gf + 2, W - 4, barrel);
    placeDecor(grid, H - 4, mid - 3, candle);
    placeDecor(grid, H - 4, mid + 3, candle);
    placeDecor(grid, gf + 3, 3, stoneRubble);
    placeDecor(grid, gf + 3, W - 4, stoneRubble);

    // ---- MID FLOOR (middle section) -- study / library -- JS lines 442-458 ----
    const int mfTop = midDividerY + 1;
    const int mfBot = H - 9;
    const int mfMid = (mfTop + mfBot) / 2;
    for (int x = 3; x <= 6; ++x) placeDecor(grid, mfTop + 1, x, bookshelf);
    for (int x = W - 7; x <= W - 4; ++x) placeDecor(grid, mfTop + 1, x, bookshelf);
    placeDecor(grid, mfTop + 2, mid, spellTome);
    placeDecor(grid, mfMid, W - 3, potionRack);
    placeDecor(grid, mfMid + 1, W - 3, potionRack);
    placeDecor(grid, mfTop + 3, mid - 2, table);
    placeDecor(grid, mfTop + 3, mid + 2, table);
    placeDecor(grid, mfTop + 3, mid - 3, candle);
    placeDecor(grid, mfTop + 3, mid + 3, candle);

    // ---- TOP FLOOR (north section) -- observatory / wizard's sanctum -- JS
    // lines 460-476 ----
    const int tf = midDividerY - 1;
    const int cRow = tf / 2 + 1;
    placeDecor(grid, cRow, mid, arcaneCircle);
    placeDecor(grid, cRow - 2, mid, crystalBall);
    placeDecor(grid, 2, W - 5, telescope);
    for (int x = 4; x <= 8; ++x) placeDecor(grid, 2, x, bookshelf);
    for (const auto& dyx : {std::pair{-2, -2}, std::pair{-2, 2}, std::pair{2, -2}, std::pair{2, 2}})
        placeDecor(grid, cRow + dyx.first, mid + dyx.second, candle);

    // ---- Wizard NPC -- JS's own `tiles[cRow-1][mid+2]=T.NPC_WIZARD` direct
    // tile assignment (JS line 476) becomes a TileMarker (kind="npc_spawn")
    // instead, the same convention buildAshenveilLevel() already
    // established for every named NPC in this file. ----
    {
        TileMarker marker;
        marker.kind = "npc_spawn";
        marker.name = "Wizard";
        marker.position = glm::vec2(static_cast<float>(mid + 2) + 0.5f, static_cast<float>(cRow - 1) + 0.5f);
        marker.properties["name"] = "Wizard";
        grid.markers.push_back(marker);
    }

    // ---- Exit portal back to Stormcrag Reach -- interiors re-enter their
    // parent zone rather than a forward-only graph (see this function's own
    // doc comment in GrimstoneGame.h). ----
    {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = "Exit -> Stormcrag Reach";
        marker.position = glm::vec2(static_cast<float>(mid) + 0.5f, static_cast<float>(H - 1) + 0.5f);
        marker.properties["targetZone"] = "stormcrag_reach";
        grid.markers.push_back(marker);
    }

    // ---- Player spawn -- js's own returned entryX:Math.floor(W/2),
    // entryY:H-3 ----
    grid.markers.push_back(
        {"player_spawn", glm::vec2(static_cast<float>(mid) + 0.5f, static_cast<float>(H - 3) + 0.5f), "Player Spawn"});

    return grid;
}

// ======= THE WHISPERWOOD =======
// Transcribed from `function makeWhisperwoodMap()` in js/zones.js (lines
// 484-667 as of this writing) -- see GrimstoneGame.h's own doc comment on
// buildWhisperwoodLevel() for the zone-graph wiring and the Floor/Overlay
// judgement call this function makes differently from every other zone
// builder in this file.
//
// Placeholder seed: same judgement call as buildStormcragLevel() (see its
// own doc comment) -- js/world.js's `worldSeed` isn't threaded through this
// port yet, so a fixed constant stands in.
constexpr uint32_t kWhisperwoodPlaceholderWorldSeed = 1u;

namespace {

// Connectivity BFS: js/zones.js's own correction loop (lines 585-618)
// re-scans its ENTIRE queue from index 0 every time it carves a corridor to
// an unreached cell, even though everything before the newly-added tail was
// already fully drained on a prior pass (every one of ITS neighbors is
// already either reached or impassable, so re-visiting it is a guaranteed
// no-op). This helper keeps `qi` persistent across calls instead of
// resetting it, which reaches the exact same fixed point `reached` array
// -- the only thing anything downstream (grave/shadow-walker placement)
// actually reads -- for far less redundant work. Not a behavior change,
// just skipping work the JS itself always determined was a no-op.
void whisperwoodBfsDrain(std::vector<std::vector<TileKindId>>& tiles, std::vector<std::vector<bool>>& reached,
                          std::vector<std::pair<int, int>>& queue, size_t& qi, int W, int H,
                          const std::function<bool(TileKindId)>& passable) {
    const auto tryReach = [&](int ny, int nx) {
        if (ny < 1 || ny > H - 2 || nx < 1 || nx > W - 2) return;
        if (reached[ny][nx]) return;
        if (passable(tiles[ny][nx])) {
            reached[ny][nx] = true;
            queue.emplace_back(ny, nx);
        }
    };
    while (qi < queue.size()) {
        const auto [cy, cx] = queue[qi++];
        tryReach(cy - 1, cx);
        tryReach(cy + 1, cx);
        tryReach(cy, cx - 1);
        tryReach(cy, cx + 1);
    }
}

} // namespace

// Layering: unlike every other zone builder in this file, terrain-shaping
// writes are classified as Floor here REGARDLESS of whether the JS happens
// to place them before or after its own "Snapshot floor" line (lines
// 620-621) -- specifically the guaranteed-connect approach-dirt clearing
// near the south exit (JS lines 521-522, 633-634), which is genuine path
// terrain that the JS just happens to code after that line, not decor. All
// of it (noise-driven tree/water coverage, the winding main path, the
// branch side-paths, the connectivity-correction corridors, AND those two
// approach-dirt clearings) is baked into one local `tiles` vector and
// snapshotted into the grid's Floor layer in a single pass, the same shape
// buildStormcragLevel()/buildProceduralZone() already use. Only the actual
// placeDecor() calls -- both portals' decor tile, the scattered graves and
// their candles -- become Overlay writes, using grid.floorAt() for their
// occupancy checks the same way buildStormcragLevel()'s own doc comment
// documents (safe here too: every candidate cell those scatter loops touch
// falls outside the two approach-dirt/portal regions, so floorAt() already
// reflects the same value the JS's own post-snapshot `tiles` array would).
TileGrid buildWhisperwoodLevel(const TileKindRegistry& registry) {
    const TileKindId darkGrass = registry.idFromName("dark_grass");
    const TileKindId grass = registry.idFromName("grass");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId water = registry.idFromName("water");
    const TileKindId dirt = registry.idFromName("dirt");
    const TileKindId normalTree = registry.idFromName("normal_tree");
    const TileKindId oakTree = registry.idFromName("oak_tree");
    const TileKindId grave = registry.idFromName("grave");
    const TileKindId candle = registry.idFromName("candle");
    const TileKindId shadowWalker = registry.idFromName("shadow_walker");
    const TileKindId forestPortal = registry.idFromName("forest_portal");
    const TileKindId exit = registry.idFromName("exit");

    const int W = 80, H = 60; // js/zones.js's own W/H locals for this zone
    ProceduralPrng rng(kWhisperwoodPlaceholderWorldSeed + 88881u);

    // ---- Init to dark grass + hard border -- JS lines 486-492 ----
    std::vector<std::vector<TileKindId>> tiles(H, std::vector<TileKindId>(W, darkGrass));
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) tiles[y][x] = wall;

    // ---- Dense tree coverage via fractal noise -- JS lines 494-500 ----
    FractalNoise2D treeNoise(kWhisperwoodPlaceholderWorldSeed + 22211u, W, H, 4);
    for (int y = 1; y < H - 1; ++y) {
        for (int x = 1; x < W - 1; ++x) {
            const double n = treeNoise.sample(x, y);
            if (n > 0.45) tiles[y][x] = normalTree;
            else if (n > 0.30) tiles[y][x] = oakTree;
        }
    }

    // ---- A few small water pools -- JS lines 502-506 ----
    FractalNoise2D waterNoise(kWhisperwoodPlaceholderWorldSeed + 44433u, W, H, 3);
    for (int y = 2; y < H - 2; ++y)
        for (int x = 2; x < W - 2; ++x)
            if (waterNoise.sample(x, y) > 0.78 && tiles[y][x] != wall) tiles[y][x] = water;
    smoothTerrain(tiles, W, H, water, grass, 2);

    // ---- Main winding dirt path from north entry south -- JS lines
    // 508-519 ----
    const int pathX = 18;
    const int southExitX = pathX;
    std::vector<int> mainPathXByRow; // index i == cx at y == i+1
    int cx = pathX;
    for (int y = 1; y < H - 1; ++y) {
        const int bias = (cx < southExitX) ? 1 : (cx > southExitX ? -1 : 0);
        const double driftRoll = rng.next();
        const double biasRoll = rng.next(); // always drawn, unlike carvePath's jitter -- see JS line 515
        const int drift = static_cast<int>(std::floor(driftRoll * 3.0)) - 1 + ((biasRoll < 0.3) ? bias : 0);
        cx = std::max(4, std::min(W - 5, cx + drift));
        for (int dx = -1; dx <= 1; ++dx)
            if (tiles[y][cx + dx] != wall) tiles[y][cx + dx] = dirt;
        mainPathXByRow.push_back(cx);
    }

    // ---- Guarantee last few rows connect straight to south exit -- JS
    // lines 521-522 ----
    for (int y = H - 5; y < H - 1; ++y)
        if (tiles[y][southExitX] != wall) tiles[y][southExitX] = dirt;

    // ---- Wider clearing around north entry -- JS lines 524-528 ----
    for (int dy = 0; dy < 5; ++dy)
        for (int dx = -3; dx <= 3; ++dx) {
            const int ny = 1 + dy, nx = pathX + dx;
            if (nx > 0 && nx < W - 1) tiles[ny][nx] = darkGrass;
        }

    // ---- Branching side paths -- JS lines 530-566 ----
    const int branchCount = 3 + static_cast<int>(std::floor(rng.next() * 2.0));
    std::vector<int> usedRows;
    int branchesMade = 0;
    for (int att = 0; att < 100 && branchesMade < branchCount; ++att) {
        const int rowY = 10 + static_cast<int>(std::floor(rng.next() * (H - 22)));
        bool tooClose = false;
        for (int r : usedRows)
            if (std::abs(r - rowY) < 10) { tooClose = true; break; }
        if (tooClose) continue;
        const int originX = (rowY - 1 >= 0 && rowY - 1 < static_cast<int>(mainPathXByRow.size()))
                                 ? mainPathXByRow[rowY - 1]
                                 : pathX;
        const int dir = (rng.next() < 0.5) ? 1 : -1;
        const int len = 9 + static_cast<int>(std::floor(rng.next() * 9.0));

        int bx = originX, by = rowY;
        bool blocked = false;
        for (int i = 0; i < len; ++i) {
            bx = std::max(3, std::min(W - 4, bx + dir));
            if (rng.next() < 0.2) by = std::max(3, std::min(H - 4, by + ((rng.next() < 0.5) ? 1 : -1)));
            if (tiles[by][bx] == wall) { blocked = true; break; }
            tiles[by][bx] = dirt;
            // Occasionally widen path by 1 tile -- JS lines 550-554
            if (rng.next() < 0.35) {
                const int wy = std::max(1, std::min(H - 2, by + ((rng.next() < 0.5) ? 1 : -1)));
                if (tiles[wy][bx] != wall) tiles[wy][bx] = darkGrass;
            }
        }
        if (blocked) continue;

        // Terminal clearing (4x4 open area) -- JS lines 558-563
        for (int dy = -2; dy <= 2; ++dy)
            for (int dx = -2; dx <= 2; ++dx) {
                const int cy = by + dy, cc = bx + dx;
                if (cy > 0 && cy < H - 1 && cc > 0 && cc < W - 1 && tiles[cy][cc] != wall) tiles[cy][cc] = darkGrass;
            }
        usedRows.push_back(rowY);
        ++branchesMade;
    }

    // ---- Connectivity flood-fill: ensure every passable tile is reachable
    // -- JS lines 568-618. See whisperwoodBfsDrain()'s own doc comment
    // above for the one deliberate deviation (persistent queue index). ----
    const std::function<bool(TileKindId)> passable = [&](TileKindId t) {
        return t == darkGrass || t == dirt || t == grave || t == candle || t == water || t == shadowWalker;
    };
    std::vector<std::vector<bool>> reached(H, std::vector<bool>(W, false));
    std::vector<std::pair<int, int>> queue;
    size_t qi = 0;
    for (int y = 1; y < H - 1; ++y)
        for (int x = 1; x < W - 1; ++x)
            if (tiles[y][x] == dirt) {
                reached[y][x] = true;
                queue.emplace_back(y, x);
            }
    whisperwoodBfsDrain(tiles, reached, queue, qi, W, H, passable);

    for (int pass = 0; pass < 6; ++pass) {
        for (int y = 2; y < H - 2; ++y) {
            for (int x = 2; x < W - 2; ++x) {
                if (reached[y][x] || !passable(tiles[y][x])) continue;
                int bestD = 9999, bry = -1, brx = -1;
                for (int sy = 1; sy < H - 1; ++sy) {
                    for (int sx = 1; sx < W - 1; ++sx) {
                        if (!reached[sy][sx]) continue;
                        const int d = std::abs(sy - y) + std::abs(sx - x);
                        if (d < bestD) { bestD = d; bry = sy; brx = sx; }
                    }
                }
                if (bry == -1) continue;
                const int stepX = (x < brx) ? 1 : -1, stepY = (y < bry) ? 1 : -1;
                int carveX = x;
                while (carveX != brx) {
                    if (tiles[y][carveX] == normalTree || tiles[y][carveX] == oakTree) tiles[y][carveX] = darkGrass;
                    if (!reached[y][carveX] && passable(tiles[y][carveX])) {
                        reached[y][carveX] = true;
                        queue.emplace_back(y, carveX);
                    }
                    carveX += stepX;
                }
                int carveY = y;
                while (carveY != bry) {
                    if (tiles[carveY][brx] == normalTree || tiles[carveY][brx] == oakTree)
                        tiles[carveY][brx] = darkGrass;
                    if (!reached[carveY][brx] && passable(tiles[carveY][brx])) {
                        reached[carveY][brx] = true;
                        queue.emplace_back(carveY, brx);
                    }
                    carveY += stepY;
                }
                whisperwoodBfsDrain(tiles, reached, queue, qi, W, H, passable);
            }
        }
    }

    // ---- Guaranteed-connect approach-dirt clearing near the south exit --
    // JS lines 633-634. Genuine path terrain, not decor -- Floor, baked in
    // here even though the JS itself codes it after its own floor snapshot
    // (see this function's own doc comment above). ----
    for (int dy = 1; dy <= 5; ++dy)
        if (tiles[H - 1 - dy][southExitX] != wall) tiles[H - 1 - dy][southExitX] = dirt;

    // ---- North/south portal cells: dark-grass floor + portal decor on top
    // -- JS lines 626-632, same "setFloor then setOverlay" pattern
    // buildStormcragLevel()'s own north portal already uses. Baked into the
    // local `tiles` vector as dark grass here (the Floor half); the actual
    // portal decor tiles are painted via setOverlay() below, after the
    // snapshot. ----
    tiles[0][pathX] = darkGrass;
    tiles[H - 1][southExitX] = darkGrass;

    // ---- Floor layer is now fully authored -- see this function's own doc
    // comment above for why this snapshot point differs from every other
    // zone builder in this file. ----
    TileGrid grid(W, H, 1.0f);
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, tiles[y][x]);

    // ---- North return portal (back to Ashenveil) -- JS lines 626-628 ----
    grid.setOverlay(pathX, 0, forestPortal);

    // ---- South exit portal (leads onward to Stormcrag Reach) -- JS lines
    // 630-632 ----
    grid.setOverlay(southExitX, H - 1, exit);

    // ---- Scatter ancient graves and candles -- JS lines 636-644 ----
    for (int att = 0; att < 50; ++att) {
        const int gx = 3 + static_cast<int>(std::floor(rng.next() * (W - 6)));
        const int gy = 6 + static_cast<int>(std::floor(rng.next() * (H - 12)));
        if (grid.floorAt(gx, gy) == darkGrass && reached[gy][gx]) {
            grid.setOverlay(gx, gy, grave);
            if (rng.next() < 0.5 && grid.floorAt(gx + 1, gy) == darkGrass) grid.setOverlay(gx + 1, gy, candle);
        }
    }

    // ---- Shadow Walkers: reachable tile, adjacent to a tree, 7-tile
    // Chebyshev exclusion from portals -- JS lines 646-663 ----
    const std::pair<int, int> portalPositions[] = {{pathX, 0}, {southExitX, H - 1}};
    int swPlaced = 0;
    for (int att = 0; att < 600 && swPlaced < 18; ++att) {
        const int ex = 3 + static_cast<int>(std::floor(rng.next() * (W - 6)));
        const int ey = 4 + static_cast<int>(std::floor(rng.next() * (H - 8)));
        if (!reached[ey][ex]) continue;
        const TileKindId cur = grid.floorAt(ex, ey);
        if (cur != darkGrass && cur != dirt) continue;
        bool nearTree = false;
        for (const auto& d : {std::pair{-1, 0}, std::pair{1, 0}, std::pair{0, -1}, std::pair{0, 1},
                               std::pair{-1, -1}, std::pair{-1, 1}, std::pair{1, -1}, std::pair{1, 1}}) {
            const int ty = ey + d.first, tx = ex + d.second;
            if (ty < 0 || ty >= H || tx < 0 || tx >= W) continue;
            const TileKindId t = grid.floorAt(tx, ty);
            if (t == normalTree || t == oakTree) { nearTree = true; break; }
        }
        bool tooClose = false;
        for (const auto& p : portalPositions)
            if (std::abs(ex - p.first) <= 7 && std::abs(ey - p.second) <= 7) { tooClose = true; break; }
        if (nearTree && !tooClose) {
            grid.setOverlay(ex, ey, shadowWalker);
            ++swPlaced;
        }
    }

    // ---- Portals as TileMarkers, in addition to the painted tiles above --
    // same "paint + marker" convention every other zone builder in this
    // file already uses. ----
    auto addPortalMarker = [&](const char* name, float px, float py, const char* targetZone) {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = name;
        marker.position = glm::vec2(px + 0.5f, py + 0.5f);
        marker.properties["targetZone"] = targetZone;
        grid.markers.push_back(marker);
    };
    addPortalMarker("Forest Portal -> Ashenveil", static_cast<float>(pathX), 0.0f, "ashenveil");
    addPortalMarker("Exit -> Stormcrag Reach", static_cast<float>(southExitX), static_cast<float>(H - 1),
                     "stormcrag_reach");

    // ---- NPC spawn markers -- js/zones.js's own makeWhisperwoodMap() has
    // none of its own (only the shadow-walker enemy tiles scattered above);
    // nothing to add here, matching this file's own doc-comment convention
    // for zones with no named NPCs (buildStormcragLevel()). ----

    // ---- Player spawn -- js's own returned entryX:pathX, entryY:2 (the
    // arrival point coming from Ashenveil's own south FOREST_PORTAL). ----
    grid.markers.push_back({"player_spawn", glm::vec2(static_cast<float>(pathX) + 0.5f, 2.5f), "Player Spawn"});

    return grid;
}

// ======= GREENFIELD PASTURES =======
// Transcribed from `function makeGreenfieldMap()` in js/zones.js (lines
// 1216-1344 as of this writing). js/zones.js continues past line 1344 into
// makeHouseInterior() and the rest of the still-unported interior/other-zone
// functions -- NOT ported here, see PORTING_PLAN.md.
namespace {

// Stands in for a raw JS `tiles[y][x]` read (the MERGED view a decor tile on
// top of its floor produces) wherever makeGreenfieldMap() branches on the
// CURRENT tile -- every one of this zone's own `===T.GRASS` guards, before
// painting a crop/flower/tree. Cross-checked against every pd()/setFloor()
// call this function makes: no guarded cell is ever painted by an earlier
// call in this zone (unlike buildWhisperwoodLevel()'s scatter loops, which
// really do need to read back earlier placements), so in practice this
// currently always agrees with a plain floorAt() read here -- but it's the
// technically-correct translation of the JS's own semantics rather than one
// that happens to work by coincidence of this zone's specific layout, so a
// future edit to this function that DOES paint over an earlier guarded cell
// stays correct without needing to notice and switch helpers.
// Safe to read Overlay-then-Floor here because this zone builder always
// setFloor()s a cell's terrain before any later placeDecor() call that
// might read it back, exactly mirroring the JS's own call order.
TileKindId currentAt(const TileGrid& grid, int x, int y) {
    const TileKindId overlay = grid.overlayAt(x, y);
    return overlay != kInvalidTileKind ? overlay : grid.floorAt(x, y);
}

} // namespace

// A hand-authored farming zone (windmill, barn, farmhouse, wheat/turnip
// fields, a fenced animal pasture) reached from Ashenveil's own west
// FARM_PORTAL ("greenfield_pastures") -- Old Bertram's own homestead quest
// line ("A Place to Call Home"/"A Farmer's Ledger", js/quests.js) is set
// here, per this file's own header doc comment on buildGreenfieldLevel().
// Grid size is 70x44 (js/zones.js's own W/H locals for this zone). Like
// buildAshenveilLevel(), a fixed hand-authored layout with no PRNG/noise at
// all -- built by direct sequential grid authoring (setFloor()/placeDecor()
// calls in JS call order) rather than the local-vector-then-snapshot shape
// buildStormcragLevel()/buildWhisperwoodLevel() use, since (see below) this
// zone's own JS has no bulk floor-snapshot line for a local vector to mirror
// in the first place.
//
// Layering: unlike every OTHER zone builder in this file, the JS's own
// `floor` array here is NEVER snapshotted in bulk -- there is no
// `const floor = tiles.map(row => [...row])` line anywhere in
// makeGreenfieldMap(). Every floor value it ever holds comes from
// placeDecor()'s own per-call `floor[y][x] = tiles[y][x]` (js/world.js),
// recording whatever `tiles[y][x]` held at THAT exact call, in call order --
// so this port reads the JS the same way buildAshenveilLevel() already does
// (a zone with no snapshot line at all, just direct progressive authoring):
// every direct `tiles[y][x] = X` assignment (terrain -- border walls, the
// lane/branch dirt, building floors/walls/doors, crop-row soil paths) becomes
// a Floor write via setFloor(); every `pd(y,x,tile)` call (the JS's own local
// placeDecor() wrapper -- furnishings, crops, fences, animals, portals)
// becomes an Overlay write via this file's own placeDecor(grid,...) helper
// (buildAshenveilLevel()'s own, reused here), in the SAME relative order the
// JS calls them, so a floor write always lands before any later decor paint
// that might read it back -- see currentAt()'s own doc comment above.
//
// NPCs: js/zones.js's own `namedNpcs` array gives exact positions for all
// three of this zone's NPCs (Greta, Aldous, Bertram) -- and two of them,
// Greta (35, laneY-2) and Aldous (25, 9), sit at the EXACT same cells the
// JS's own `pd(laneY-2,35,T.NPC_FARMER)`/`pd(9,25,T.NPC_FARMER)` calls paint,
// confirming those two painted tiles ARE Greta and Aldous rather than
// separate anonymous farmers. Per this file's own "NPC spawn tiles become
// TileMarkers, not painted overlay tiles" convention (buildAshenveilLevel()'s
// own doc comment), this port uses `namedNpcs` directly for all three and
// does NOT also transcribe the two NPC_FARMER paints -- doing both would
// double-marker the same two cells. Old Bertram (7, 17) has no painted tile
// at all in the JS -- only a `namedNpcs` entry -- matching the quest text's
// own "find him outside the barn" (the barn's own footprint ends at y=15,
// door at y=15 x=10-11; Bertram sits just south-east of it).
//
// Portals: the east FARM_PORTAL returns to Ashenveil -- targetZone
// "ashenveil", matching Ashenveil's own west FARM_PORTAL, which already
// targets "greenfield_pastures" (buildAshenveilLevel()). The west
// CARAVAN_PORTAL targets "ashgrove_hollow" -- ground truth from
// js/activities.js's own T.CARAVAN_PORTAL step-on handler (lines 2839-2848),
// which enters `makeAshgroveHollowMap()` when stepping through this exact
// portal, NOT `makeCaravanZoneMap()`/"THE WESTERN PASS" directly. (Corrected
// from an earlier pass's "western_pass" guess, made before Ashgrove Hollow's
// own zones.js section had been read -- see PORTING_PLAN.md.) It's Ashgrove
// Hollow's OWN west CARAVAN_PORTAL, one zone further out, that actually
// leads to "THE WESTERN PASS" -- see buildAshgroveHollowLevel() below, which
// keeps this port's established "snake_case the destination zone's real
// `name`" convention (buildAshenveilLevel()'s own CHAPEL_PORTAL ->
// "forsaken_chapel" for "THE FORSAKEN CHAPEL" is the precedent) for that
// still-not-yet-ported destination.
TileGrid buildGreenfieldLevel(const TileKindRegistry& registry) {
    const TileKindId grass = registry.idFromName("grass");
    const TileKindId dirt = registry.idFromName("dirt");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId stoneFloor = registry.idFromName("stone_floor");
    const TileKindId normalTree = registry.idFromName("normal_tree");
    const TileKindId bed = registry.idFromName("bed");
    const TileKindId table = registry.idFromName("table");
    const TileKindId barrel = registry.idFromName("barrel");
    const TileKindId bookshelf = registry.idFromName("bookshelf");
    const TileKindId cookingFire = registry.idFromName("cooking_fire");
    const TileKindId candle = registry.idFromName("candle");
    const TileKindId hayBale = registry.idFromName("hay_bale");
    const TileKindId waterTrough = registry.idFromName("water_trough");
    const TileKindId animalCow = registry.idFromName("animal_cow");
    const TileKindId animalChicken = registry.idFromName("animal_chicken");
    const TileKindId animalPig = registry.idFromName("animal_pig");
    const TileKindId butterChurn = registry.idFromName("butter_churn");
    const TileKindId windmill = registry.idFromName("windmill");
    const TileKindId cropWheat = registry.idFromName("crop_wheat");
    const TileKindId cropTurnip = registry.idFromName("crop_turnip");
    const TileKindId fence = registry.idFromName("fence");
    const TileKindId fencePost = registry.idFromName("fence_post");
    const TileKindId scarecrow = registry.idFromName("scarecrow");
    const TileKindId townWell = registry.idFromName("town_well");
    const TileKindId flower = registry.idFromName("flower");
    const TileKindId farmPortal = registry.idFromName("farm_portal");
    const TileKindId caravanPortal = registry.idFromName("caravan_portal");

    const int W = 70, H = 44; // js/zones.js's own W/H locals for this zone
    TileGrid grid(W, H, 1.0f);

    // ---- Init to grass -- JS lines 1218-1219 (both `tiles` and `floor`
    // start as an all-GRASS fill; see this function's own doc comment above
    // for why there's no separate snapshot step to mirror). ----
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, grass);

    // ---- Border walls -- JS lines 1224-1225 ----
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) grid.setFloor(x, y, wall);

    // ---- MAIN DIRT LANE + north-south branch -- JS lines 1227-1231 ----
    const int laneY = 22;
    for (int x = 1; x < W - 1; ++x) grid.setFloor(x, laneY, dirt);
    for (int y = 1; y < H - 1; ++y) grid.setFloor(35, y, dirt);

    // ---- FARMHOUSE (east side, x=50-61, y=6-13) -- JS lines 1233-1245 ----
    for (int y = 6; y <= 13; ++y)
        for (int x = 50; x <= 61; ++x) grid.setFloor(x, y, stoneFloor);
    for (int x = 50; x <= 61; ++x) {
        grid.setFloor(x, 6, wall);
        grid.setFloor(x, 13, wall);
    }
    for (int y = 6; y <= 13; ++y) {
        grid.setFloor(50, y, wall);
        grid.setFloor(61, y, wall);
    }
    grid.setFloor(55, 13, stoneFloor); // door
    grid.setFloor(56, 13, stoneFloor);
    placeDecor(grid, 8, 52, bed);
    placeDecor(grid, 8, 54, table);
    placeDecor(grid, 8, 57, barrel);
    placeDecor(grid, 10, 52, bookshelf);
    placeDecor(grid, 10, 59, cookingFire);
    placeDecor(grid, 7, 58, candle);
    placeDecor(grid, 7, 52, candle);
    for (int y = 14; y <= laneY; ++y) grid.setFloor(55, y, dirt); // path to door

    // ---- BARN (west side, x=5-18, y=6-15) -- JS lines 1247-1259 ----
    for (int y = 6; y <= 15; ++y)
        for (int x = 5; x <= 18; ++x) grid.setFloor(x, y, stoneFloor);
    for (int x = 5; x <= 18; ++x) {
        grid.setFloor(x, 6, wall);
        grid.setFloor(x, 15, wall);
    }
    for (int y = 6; y <= 15; ++y) {
        grid.setFloor(5, y, wall);
        grid.setFloor(18, y, wall);
    }
    grid.setFloor(10, 15, stoneFloor); // barn door
    grid.setFloor(11, 15, stoneFloor);
    placeDecor(grid, 8, 7, hayBale);
    placeDecor(grid, 8, 9, hayBale);
    placeDecor(grid, 8, 14, hayBale);
    placeDecor(grid, 8, 16, hayBale);
    placeDecor(grid, 12, 7, waterTrough);
    placeDecor(grid, 12, 13, waterTrough);
    placeDecor(grid, 10, 7, animalCow);
    placeDecor(grid, 10, 14, animalChicken);
    placeDecor(grid, 13, 10, barrel);
    placeDecor(grid, 9, 16, candle);
    placeDecor(grid, 9, 7, candle);
    placeDecor(grid, 12, 16, butterChurn); // south-east corner of barn
    for (int y = 16; y <= laneY; ++y) grid.setFloor(11, y, dirt); // path barn->lane

    // ---- WINDMILL (north-centre, x=32-38, y=5-10) -- JS lines 1261-1267 ----
    for (int y = 5; y <= 10; ++y)
        for (int x = 32; x <= 38; ++x) grid.setFloor(x, y, stoneFloor);
    for (int x = 32; x <= 38; ++x) {
        grid.setFloor(x, 5, wall);
        grid.setFloor(x, 10, wall);
    }
    for (int y = 5; y <= 10; ++y) {
        grid.setFloor(32, y, wall);
        grid.setFloor(38, y, wall);
    }
    grid.setFloor(34, 10, stoneFloor); // door (on lane branch)
    grid.setFloor(35, 10, stoneFloor);
    placeDecor(grid, 7, 35, windmill);

    // ---- WHEAT FIELDS (north of lane, x=20-28, y=2-18) -- JS lines
    // 1269-1280. Row crops with soil paths between. ----
    for (int row = 0; row < 4; ++row) {
        const int fy = 3 + row * 4;
        for (int x = 20; x <= 28; ++x) placeDecor(grid, fy, x, cropWheat);
        for (int x = 20; x <= 28; ++x) placeDecor(grid, fy + 1, x, cropWheat);
    }
    for (int row = 0; row < 3; ++row) {
        const int py = 5 + row * 4;
        for (int x = 20; x <= 28; ++x)
            if (currentAt(grid, x, py) == grass) grid.setFloor(x, py, dirt);
    }

    // ---- TURNIP PATCH (south of lane, x=5-25, y=26-36) -- JS lines
    // 1282-1289 ----
    for (int ry = 26; ry <= 36; ry += 3) {
        for (int x = 5; x <= 25; x += 2)
            if (currentAt(grid, x, ry) == grass) placeDecor(grid, ry, x, cropTurnip);
        if (ry + 1 <= 36)
            for (int x = 5; x <= 25; ++x)
                if (currentAt(grid, x, ry + 1) == grass) grid.setFloor(x, ry + 1, dirt);
    }

    // ---- ANIMAL PASTURE (south-east, fenced, x=42-66, y=26-40) -- JS lines
    // 1291-1303. Continuous fence rails top/bottom (unconditional pd(), no
    // grass guard -- the pasture's own x range starts at 42, clear of the
    // north-south dirt branch at x=35, so this never actually overwrites
    // it), posts on side columns, a 2-tile gate gap at x=53,54. ----
    for (int x = 42; x <= 66; ++x)
        if (x != 53 && x != 54) placeDecor(grid, 26, x, fence);
    for (int x = 42; x <= 66; ++x) placeDecor(grid, 40, x, fence);
    for (int y = 27; y <= 39; ++y) {
        placeDecor(grid, y, 42, fencePost);
        placeDecor(grid, y, 66, fencePost);
    }
    placeDecor(grid, 30, 48, animalPig);
    placeDecor(grid, 34, 55, animalCow);
    placeDecor(grid, 28, 60, animalChicken);
    placeDecor(grid, 37, 50, animalPig);
    placeDecor(grid, 32, 63, animalChicken);
    placeDecor(grid, 33, 46, waterTrough);

    // ---- SCARECROWS dotted through fields -- JS line 1306 ----
    placeDecor(grid, 7, 22, scarecrow);
    placeDecor(grid, 14, 25, scarecrow);
    placeDecor(grid, 29, 15, scarecrow);

    // ---- WELL near farmhouse -- JS line 1309 ----
    placeDecor(grid, 17, 55, townWell);

    // ---- FLOWERS & SCATTER -- JS lines 1312-1313 ----
    for (const auto& fyx : {std::pair{3, 30}, std::pair{3, 40}, std::pair{20, 3}, std::pair{20, 40},
                            std::pair{38, 5}, std::pair{38, 25}, std::pair{40, 35}, std::pair{41, 20}}) {
        const int fy = fyx.first, fx = fyx.second;
        if (currentAt(grid, fx, fy) == grass) placeDecor(grid, fy, fx, flower);
    }

    // ---- Trees lining north and east borders -- JS lines 1316-1317 ----
    for (int x = 2; x <= 68; x += 5)
        if (currentAt(grid, x, 1) == grass) grid.setFloor(x, 1, normalTree);
    for (int y = 2; y <= 40; y += 4)
        if (currentAt(grid, 68, y) == grass) grid.setFloor(68, y, normalTree);

    // ---- FARMER NPCs -- JS lines 1320-1321: `pd(laneY-2,35,T.NPC_FARMER)`
    // and `pd(9,25,T.NPC_FARMER)` are NOT transcribed as painted overlay
    // tiles here -- see this function's own doc comment above for why (they
    // are Greta and Aldous, added as TileMarkers below instead). ----

    // ---- FARM PORTAL (east wall, y=laneY) -> back to Ashenveil -- JS lines
    // 1323-1327 ----
    grid.setFloor(W - 1, laneY, grass);
    grid.setFloor(W - 1, laneY - 1, grass);
    grid.setFloor(W - 1, laneY + 1, grass);
    placeDecor(grid, laneY, W - 1, farmPortal);

    // ---- CARAVAN PORTAL (west wall, y=laneY) -> The Western Pass -- JS
    // lines 1329-1333 ----
    grid.setFloor(0, laneY, grass);
    grid.setFloor(0, laneY - 1, grass);
    grid.setFloor(0, laneY + 1, grass);
    placeDecor(grid, laneY, 0, caravanPortal);

    // ---- Portals as TileMarkers, in addition to the painted tiles above --
    // same "paint + marker" convention every other zone builder in this file
    // already uses. ----
    auto addPortalMarker = [&](const char* name, float px, float py, const char* targetZone) {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = name;
        marker.position = glm::vec2(px + 0.5f, py + 0.5f);
        marker.properties["targetZone"] = targetZone;
        grid.markers.push_back(marker);
    };
    addPortalMarker("Farm Portal -> Ashenveil", static_cast<float>(W - 1), static_cast<float>(laneY), "ashenveil");
    // Fixed portal-graph bug: this used to target "western_pass" directly,
    // guessed before Ashgrove Hollow had been read -- js/activities.js's own
    // T.CARAVAN_PORTAL step-on handler (lines 2839-2848) shows Greenfield's
    // west portal actually leads to ASHGROVE HOLLOW first (`enterInterior(
    // makeAshgroveHollowMap, ...)` when NOT already inside Ashgrove Hollow);
    // it's Ashgrove Hollow's OWN west CARAVAN_PORTAL that continues on to
    // The Western Pass (see buildAshgroveHollowLevel() below). See
    // PORTING_PLAN.md for this fix's own history note.
    addPortalMarker("Caravan Portal -> Ashgrove Hollow", 0.0f, static_cast<float>(laneY), "ashgrove_hollow");

    // ---- NPC spawn markers (kind="npc_spawn") -- js/zones.js's own
    // `namedNpcs` array (JS lines 1336-1340), used directly per this
    // function's own doc comment above. ----
    auto addNpcMarker = [&](const char* name, float px, float py) {
        TileMarker marker;
        marker.kind = "npc_spawn";
        marker.name = name;
        marker.position = glm::vec2(px + 0.5f, py + 0.5f);
        marker.properties["name"] = name;
        grid.markers.push_back(marker);
    };
    addNpcMarker("Greta", 35.0f, static_cast<float>(laneY - 2)); // near crossroads
    addNpcMarker("Aldous", 25.0f, 9.0f);                          // in the wheat fields
    addNpcMarker("Bertram", 7.0f, 17.0f); // Old Bertram, outside the barn -- homestead quest giver

    // ---- Player spawn -- js's own returned entryX:W-2, entryY:laneY (the
    // arrival point coming from Ashenveil's own west FARM_PORTAL). ----
    grid.markers.push_back(
        {"player_spawn", glm::vec2(static_cast<float>(W - 2) + 0.5f, static_cast<float>(laneY) + 0.5f), "Player Spawn"});

    return grid;
}

namespace {

// Shared by every interior builder below -- adds a "portal" TileMarker back
// to Ashenveil (same shape as buildAshenveilLevel()'s own addPortalMarker(),
// just always targeting "ashenveil" since every one of these interiors
// exits to that one zone).
void addExitPortalMarker(TileGrid& grid, float px, float py) {
    TileMarker marker;
    marker.kind = "portal";
    marker.name = "Exit -> Ashenveil";
    marker.position = glm::vec2(px + 0.5f, py + 0.5f);
    marker.properties["targetZone"] = "ashenveil";
    grid.markers.push_back(marker);
}

// Shared npc_spawn helper, same shape as buildAshenveilLevel()'s own
// addNpcMarker().
void addNpcSpawnMarker(TileGrid& grid, const char* name, float px, float py) {
    TileMarker marker;
    marker.kind = "npc_spawn";
    marker.name = name;
    marker.position = glm::vec2(px + 0.5f, py + 0.5f);
    marker.properties["name"] = name;
    grid.markers.push_back(marker);
}

} // namespace

// Transcribed from `function makeHouseInterior(residentName)` (js/zones.js,
// lines 1348-1401). See GrimstoneGame.h's own doc comment for which
// Ashenveil residents this is used for and why no resident npc_spawn
// marker is added.
TileGrid buildHouseInterior(const TileKindRegistry& registry, const std::string& residentName) {
    constexpr int W = 14, H = 11;
    TileGrid grid(W, H, 1.0f);

    const TileKindId stoneFloor = registry.idFromName("stone_floor");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId fireplace = registry.idFromName("fireplace");
    const TileKindId smallTable = registry.idFromName("small_table");
    const TileKindId bookshelf = registry.idFromName("bookshelf");
    const TileKindId barrel = registry.idFromName("barrel");
    const TileKindId plant = registry.idFromName("plant");
    const TileKindId candle = registry.idFromName("candle");
    const TileKindId bed = registry.idFromName("bed");
    const TileKindId wardrobe = registry.idFromName("wardrobe");
    const TileKindId chest = registry.idFromName("chest");
    const TileKindId cookingFire = registry.idFromName("cooking_fire");
    const TileKindId workbench = registry.idFromName("workbench");
    const TileKindId noticeBoard = registry.idFromName("notice_board");
    const TileKindId exitInterior = registry.idFromName("exit_interior");

    // Whole grid starts stone floor (the JS's own `Array.from(...).fill(T.STONE_FLOOR)`
    // for both `tiles` and `floor`).
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, stoneFloor);

    // Outer walls
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) grid.setFloor(x, y, wall);

    // Dividing wall -- bedroom vs living area (vertical), with a doorway gap
    for (int y = 1; y <= H - 2; ++y) grid.setFloor(7, y, wall);
    grid.setFloor(7, 4, stoneFloor);
    grid.setFloor(7, 5, stoneFloor);

    // ---- Floor layer is now fully authored (matches the JS's own floor
    // snapshot before placeDecor() calls). ----

    // ---- Living area (left, x=1..6) ----
    grid.setOverlay(2, 2, fireplace);
    grid.setOverlay(2, 4, smallTable);
    grid.setOverlay(3, 4, smallTable);
    grid.setOverlay(5, 2, bookshelf);
    grid.setOverlay(2, 6, barrel);
    grid.setOverlay(5, 7, plant);
    grid.setOverlay(1, 1, candle);
    grid.setOverlay(6, 1, candle);

    // ---- Bedroom (right, x=8..12) ----
    grid.setOverlay(9, 2, bed);
    grid.setOverlay(10, 2, bed);
    grid.setOverlay(12, 4, wardrobe);
    grid.setOverlay(9, 6, chest);
    grid.setOverlay(8, 1, candle);
    grid.setOverlay(12, 1, candle);
    grid.setOverlay(11, 7, plant);

    // Resident-specific flourish -- matches the JS's own if/else chain
    // exactly; any other resident name (e.g. "Residence") gets none of
    // these, just the shared furniture above.
    if (residentName == "Mira") {
        grid.setOverlay(4, 6, chest); // her locket might be here...
        grid.setOverlay(5, 3, candle);
    } else if (residentName == "Aldric") {
        grid.setOverlay(3, 3, bookshelf);
        grid.setOverlay(5, 6, workbench);
    } else if (residentName == "Elspeth") {
        grid.setOverlay(4, 6, cookingFire);
        grid.setOverlay(5, 3, plant);
    } else if (residentName == "Rowan") {
        grid.setOverlay(5, 6, barrel);
        grid.setOverlay(3, 3, noticeBoard);
    }

    // Exit door in south wall, centre
    grid.setOverlay(6, H - 1, exitInterior);
    addExitPortalMarker(grid, 6.0f, static_cast<float>(H - 1));

    // Player spawn -- matches the JS's own `entryX:6, entryY:H-2`, one
    // tile north of the exit door.
    grid.markers.push_back({"player_spawn", glm::vec2(6.5f, static_cast<float>(H - 2) + 0.5f), "Player Spawn"});

    return grid;
}

// Transcribed from `function makeBlacksmithInterior()` (js/zones.js, lines
// 1404-1448).
TileGrid buildBlacksmithInterior(const TileKindRegistry& registry) {
    constexpr int W = 16, H = 12;
    TileGrid grid(W, H, 1.0f);

    const TileKindId stoneFloor = registry.idFromName("stone_floor");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId smelter = registry.idFromName("smelter");
    const TileKindId cookingFire = registry.idFromName("cooking_fire");
    const TileKindId candle = registry.idFromName("candle");
    const TileKindId barrel = registry.idFromName("barrel");
    const TileKindId chest = registry.idFromName("chest");
    const TileKindId anvil = registry.idFromName("anvil");
    const TileKindId bookshelf = registry.idFromName("bookshelf");
    const TileKindId plant = registry.idFromName("plant");
    const TileKindId exitInterior = registry.idFromName("exit_interior");

    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, stoneFloor);

    // Outer walls
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) grid.setFloor(x, y, wall);

    // Dividing wall -- forge area (left) vs workshop (right), doorway gap
    for (int y = 1; y <= H - 2; ++y) grid.setFloor(8, y, wall);
    grid.setFloor(8, 5, stoneFloor);
    grid.setFloor(8, 6, stoneFloor);

    // ---- Forge side (left, x=1..7) ----
    grid.setOverlay(2, 2, smelter);
    grid.setOverlay(5, 2, smelter);
    grid.setOverlay(2, 4, cookingFire); // secondary fire pit
    grid.setOverlay(1, 1, candle);
    grid.setOverlay(6, 1, candle);
    grid.setOverlay(6, 6, barrel);
    grid.setOverlay(6, 7, barrel); // fuel barrels
    grid.setOverlay(2, 8, chest); // ore chest
    grid.setOverlay(5, 9, barrel);

    // ---- Workshop side (right, x=9..14) ----
    grid.setOverlay(10, 2, anvil);
    grid.setOverlay(12, 2, anvil);
    grid.setOverlay(10, 4, bookshelf); // smithing reference texts
    grid.setOverlay(13, 4, candle);
    grid.setOverlay(10, 7, chest); // finished goods chest
    grid.setOverlay(12, 7, barrel);
    grid.setOverlay(13, 9, plant); // surprisingly, one green thing
    grid.setOverlay(14, 1, candle);

    // Grimward the blacksmith (NAMED_NPCS's own 'forge:5,11' entry names the
    // JS's own tiles[5][11]=T.NPC_GUARD placeholder tile "Grimward" -- ported
    // directly as a named npc_spawn marker rather than a placeholder tile).
    addNpcSpawnMarker(grid, "Grimward", 11.0f, 5.0f);

    // Exit door
    grid.setOverlay(7, H - 1, exitInterior);
    addExitPortalMarker(grid, 7.0f, static_cast<float>(H - 1));

    // Player spawn -- matches the JS's own `entryX:7, entryY:H-2`.
    grid.markers.push_back({"player_spawn", glm::vec2(7.5f, static_cast<float>(H - 2) + 0.5f), "Player Spawn"});

    return grid;
}

// Transcribed from `function makeInnInterior()` (js/zones.js, lines
// 1451-1508) -- "The Tarnished Flagon". See GrimstoneGame.h's own doc
// comment for why the player_spawn marker here does NOT sit at the exit
// door (the JS's own makeInnInterior() returns no entryX/entryY).
TileGrid buildInnInterior(const TileKindRegistry& registry) {
    constexpr int W = 20, H = 16;
    TileGrid grid(W, H, 1.0f);

    const TileKindId stoneFloor = registry.idFromName("stone_floor");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId bed = registry.idFromName("bed");
    const TileKindId chest = registry.idFromName("chest");
    const TileKindId candle = registry.idFromName("candle");
    const TileKindId barrel = registry.idFromName("barrel");
    const TileKindId bookshelf = registry.idFromName("bookshelf");
    const TileKindId cookingFire = registry.idFromName("cooking_fire");
    const TileKindId table = registry.idFromName("table");
    const TileKindId noticeBoard = registry.idFromName("notice_board");
    const TileKindId exitInterior = registry.idFromName("exit_interior");

    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, stoneFloor);

    // Outer walls
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) grid.setFloor(x, y, wall);

    // Dividing wall (common room vs lodging), doorway gap at x=9
    for (int x = 1; x <= 18; ++x) grid.setFloor(x, 6, wall);
    grid.setFloor(9, 6, stoneFloor);

    // Room divider
    for (int y = 1; y <= 5; ++y) grid.setFloor(10, y, wall);

    // Bar counter
    for (int y = 8; y <= 13; ++y) grid.setFloor(15, y, wall);
    grid.setFloor(14, 7, wall);
    grid.setFloor(15, 7, wall);
    grid.setFloor(16, 7, wall);
    grid.setFloor(14, 14, wall);
    grid.setFloor(15, 14, wall);
    grid.setFloor(15, 11, stoneFloor); // bar opening

    // ---- Floor layer is now fully authored ----

    // Beds
    grid.setOverlay(3, 2, bed);
    grid.setOverlay(4, 2, bed);
    grid.setOverlay(13, 2, bed);
    grid.setOverlay(14, 2, bed);
    // Chests
    grid.setOverlay(3, 4, chest);
    grid.setOverlay(13, 4, chest);
    // Room candles
    grid.setOverlay(2, 1, candle);
    grid.setOverlay(8, 1, candle);
    grid.setOverlay(12, 1, candle);
    grid.setOverlay(18, 1, candle);
    // Bar barrels
    grid.setOverlay(2, 7, barrel);
    grid.setOverlay(3, 7, barrel);
    grid.setOverlay(17, 7, barrel);
    grid.setOverlay(18, 7, barrel);
    // Bookshelves
    grid.setOverlay(1, 10, bookshelf);
    grid.setOverlay(1, 11, bookshelf);
    // Fireplace
    grid.setOverlay(1, 12, cookingFire);
    // Tables
    grid.setOverlay(4, 9, table);
    grid.setOverlay(5, 9, table);
    grid.setOverlay(9, 9, table);
    grid.setOverlay(10, 9, table);
    grid.setOverlay(4, 12, table);
    grid.setOverlay(5, 12, table);
    // Candles on tables
    grid.setOverlay(4, 8, candle);
    grid.setOverlay(9, 8, candle);
    // Notice board
    grid.setOverlay(11, 13, noticeBoard);
    // Exit door
    grid.setOverlay(9, H - 1, exitInterior);
    addExitPortalMarker(grid, 9.0f, static_cast<float>(H - 1));

    // Bram the innkeeper (NAMED_NPCS's own 'inn:10,17' entry) and two seated
    // patrons, Oswin ('inn:9,6') and Thessaly ('inn:12,7').
    addNpcSpawnMarker(grid, "Bram", 17.0f, 10.0f);
    addNpcSpawnMarker(grid, "Oswin", 6.0f, 9.0f);
    addNpcSpawnMarker(grid, "Thessaly", 7.0f, 12.0f);

    // Player spawn -- the JS's own makeInnInterior() has no entryX/entryY,
    // so entering falls back to enterInterior()'s own default:
    // (Math.floor(W/2), H-3) = (10, 13).
    grid.markers.push_back({"player_spawn", glm::vec2(10.5f, 13.5f), "Player Spawn"});

    return grid;
}

// Transcribed from `function makeShopInterior()` (js/zones.js, lines
// 2126-2173) -- Dorin's Trading Post. See GrimstoneGame.h's own doc comment
// for why Dorin is always placed here (day/night + quest flags not ported).
TileGrid buildShopInterior(const TileKindRegistry& registry) {
    constexpr int W = 14, H = 8;
    TileGrid grid(W, H, 1.0f);

    const TileKindId stoneFloor = registry.idFromName("stone_floor");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId bookshelf = registry.idFromName("bookshelf");
    const TileKindId barrel = registry.idFromName("barrel");
    const TileKindId candle = registry.idFromName("candle");
    const TileKindId grass = registry.idFromName("grass");
    const TileKindId exitInterior = registry.idFromName("exit_interior");

    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, stoneFloor);

    // Outer walls
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) grid.setFloor(x, y, wall);

    // Counter row -- solid barrier separating Dorin's side from customer
    // floor, gap at x=6 for standing-adjacent interaction
    for (int x = 1; x <= W - 2; ++x)
        if (x != 6) grid.setFloor(x, 3, wall);

    // ---- Floor layer is now fully authored ----

    // ---- Behind-counter (Dorin's side, y=1..2) ----
    grid.setOverlay(1, 1, bookshelf);
    grid.setOverlay(2, 1, bookshelf); // shelves on west wall
    grid.setOverlay(11, 1, bookshelf);
    grid.setOverlay(12, 1, bookshelf); // shelves on east wall
    grid.setOverlay(1, 2, barrel);
    grid.setOverlay(2, 2, barrel); // stock barrels west
    grid.setOverlay(11, 2, barrel);
    grid.setOverlay(12, 2, barrel); // stock barrels east
    grid.setOverlay(5, 1, candle);
    grid.setOverlay(8, 1, candle); // candles on back wall

    // Dorin behind the counter -- always present (see this function's own
    // header-comment note on day/night + quest flags not being ported).
    addNpcSpawnMarker(grid, "Dorin", 6.0f, 2.0f);

    // ---- Customer floor (y=4..6) ----
    grid.setOverlay(2, 5, barrel);
    grid.setOverlay(12, 5, barrel); // display barrels flanking
    grid.setOverlay(1, 4, candle);
    grid.setOverlay(12, 4, candle); // entrance candles

    // Exit -- south wall centre
    grid.setFloor(6, H - 1, grass); // break wall
    grid.setOverlay(6, H - 1, exitInterior);
    addExitPortalMarker(grid, 6.0f, static_cast<float>(H - 1));

    // Player spawn -- matches the JS's own `entryX:6, entryY:5`.
    grid.markers.push_back({"player_spawn", glm::vec2(6.5f, 5.5f), "Player Spawn"});

    return grid;
}

// Transcribed from `function makeBankInterior()` (js/zones.js, lines
// 2306-2354) -- Grimstone Savings Bank.
TileGrid buildBankInterior(const TileKindRegistry& registry) {
    constexpr int W = 14, H = 10;
    TileGrid grid(W, H, 1.0f);

    const TileKindId stoneFloor = registry.idFromName("stone_floor");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId barrel = registry.idFromName("barrel");
    const TileKindId chest = registry.idFromName("chest");
    const TileKindId candle = registry.idFromName("candle");
    const TileKindId table = registry.idFromName("table");
    const TileKindId bookshelf = registry.idFromName("bookshelf");
    const TileKindId exitInterior = registry.idFromName("exit_interior");

    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, stoneFloor);

    // Outer walls
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) grid.setFloor(x, y, wall);

    // Teller counter row -- solid barrier with a window opening at x=6
    for (int x = 1; x <= 12; ++x)
        if (x != 6) grid.setFloor(x, 4, wall);

    // ---- Floor layer is now fully authored ----

    // Vault storage (upper-left behind counter)
    grid.setOverlay(1, 1, barrel);
    grid.setOverlay(2, 1, barrel);
    grid.setOverlay(1, 2, chest);
    grid.setOverlay(2, 2, chest);
    grid.setOverlay(10, 1, barrel);
    grid.setOverlay(11, 1, chest);

    // Atmosphere candles
    grid.setOverlay(5, 1, candle);
    grid.setOverlay(8, 1, candle);
    grid.setOverlay(3, 3, candle);
    grid.setOverlay(9, 3, candle);
    grid.setOverlay(1, 7, candle);
    grid.setOverlay(12, 7, candle);

    // Waiting-area tables
    grid.setOverlay(3, 6, table);
    grid.setOverlay(4, 6, table);
    grid.setOverlay(9, 6, table);
    grid.setOverlay(10, 6, table);

    // Bookshelf (regulations, account ledgers)
    grid.setOverlay(12, 2, bookshelf);
    grid.setOverlay(12, 3, bookshelf);

    // Willa the bank teller (NAMED_NPCS's own 'bank:3,6' entry).
    addNpcSpawnMarker(grid, "Willa", 6.0f, 3.0f);

    // Exit door at bottom centre
    grid.setOverlay(6, H - 1, exitInterior);
    addExitPortalMarker(grid, 6.0f, static_cast<float>(H - 1));

    // Player spawn -- matches the JS's own `entryX:6, entryY:7`.
    grid.markers.push_back({"player_spawn", glm::vec2(6.5f, 7.5f), "Player Spawn"});

    return grid;
}

// ======= DUNGEON GENERATOR =======
// Transcribed from js/zones.js's makeDungeonMap() (lines 1513-1664) plus its
// three named callers makeAshenDungeon()/makeIronPeaksDungeon()/
// makeCultistCatacombs() (lines 1666-1691) -- see GrimstoneGame.h's own doc
// comment on buildDungeonMap()/DungeonGenConfig for the config/seed contract
// and the exitTargetZone/no-forward-stair judgement calls.
namespace {

struct DungeonRoom {
    int x = 0, y = 0, w = 0, h = 0, cx = 0, cy = 0;
};

// Fisher-Yates driven by this file's own ProceduralPrng stream -- NOT a
// port of the JS's own `.sort(()=>rng()-0.5)` idiom (js/zones.js uses this
// same "shuffle via a random comparator" trick three times in
// makeDungeonMap(): the room-connection order and the chest-room pick).
// That idiom's actual output depends on the host JS engine's own sort
// algorithm (V8's TimSort), which has no C++ equivalent to reproduce bit-
// for-bit; a real Fisher-Yates draws from the identical rng stream and
// gives the same "uniformly shuffled" shape the JS was going for, the
// same spirit as this file's own ProceduralPrng doc comment on not
// needing bit-for-bit parity with the JS's noise.
template <typename T>
void shuffleWithRng(std::vector<T>& v, ProceduralPrng& rng) {
    for (size_t i = v.size(); i > 1; --i) {
        const size_t j = static_cast<size_t>(std::floor(rng.next() * static_cast<double>(i)));
        std::swap(v[i - 1], v[j]);
    }
}

} // namespace

TileGrid buildDungeonMap(const TileKindRegistry& registry, const DungeonGenConfig& config, uint32_t seed) {
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId dungeonFloor = registry.idFromName("dungeon_floor");
    const TileKindId dungeonTorch = registry.idFromName("dungeon_torch");
    const TileKindId dungeonStairUp = registry.idFromName("dungeon_stair_up");
    const TileKindId dungeonStairDown = registry.idFromName("dungeon_stair_down");
    const TileKindId cryptStair = registry.idFromName("crypt_stair");
    const TileKindId chest = registry.idFromName("chest");
    const TileKindId skeletonSpawn = registry.idFromName("skeleton_spawn");

    const int W = config.W, H = config.H;
    ProceduralPrng rng(seed);

    // The JS's own `tiles` array -- what's actually rendered/solid.
    std::vector<std::vector<TileKindId>> tiles(H, std::vector<TileKindId>(W, wall));

    // ---- BSP room generation -- js/zones.js lines 1523-1550 ----
    std::vector<DungeonRoom> rooms;
    std::function<void(int, int, int, int, int)> tryPlaceRoom = [&](int x1, int y1, int x2, int y2, int depth) {
        const int rw = x2 - x1, rh = y2 - y1;
        if (rw < 8 || rh < 8 || depth > 6) return;
        const bool makeRoom = depth >= 3 || rng.next() < 0.35;
        if (makeRoom) {
            const int rx = x1 + 1 + static_cast<int>(std::floor(rng.next() * std::max(1, rw - 8)));
            const int ry = y1 + 1 + static_cast<int>(std::floor(rng.next() * std::max(1, rh - 8)));
            const int rw2 = 5 + static_cast<int>(std::floor(rng.next() * std::min(8, rw - rx + x1 - 2)));
            const int rh2 = 4 + static_cast<int>(std::floor(rng.next() * std::min(6, rh - ry + y1 - 2)));
            if (rx + rw2 < x2 - 1 && ry + rh2 < y2 - 1) {
                DungeonRoom r;
                r.x = rx;
                r.y = ry;
                r.w = rw2;
                r.h = rh2;
                r.cx = static_cast<int>(std::floor(rx + rw2 / 2.0));
                r.cy = static_cast<int>(std::floor(ry + rh2 / 2.0));
                rooms.push_back(r);
            }
            return;
        }
        if (rw > rh) {
            const int mid = x1 + 4 + static_cast<int>(std::floor(rng.next() * (rw - 8)));
            tryPlaceRoom(x1, y1, mid, y2, depth + 1);
            tryPlaceRoom(mid, y1, x2, y2, depth + 1);
        } else {
            const int mid = y1 + 4 + static_cast<int>(std::floor(rng.next() * (rh - 8)));
            tryPlaceRoom(x1, y1, x2, mid, depth + 1);
            tryPlaceRoom(x1, mid, x2, y2, depth + 1);
        }
    };
    tryPlaceRoom(1, 1, W - 1, H - 1, 0);

    // Cap to maxRooms -- js/zones.js line 1552.
    while (rooms.size() > static_cast<size_t>(config.maxRooms)) {
        const size_t idx = static_cast<size_t>(std::floor(rng.next() * static_cast<double>(rooms.size())));
        rooms.erase(rooms.begin() + static_cast<long>(idx));
    }
    // Fallback -- a few rooms placed manually if the BSP pass came up short
    // (js/zones.js lines 1553-1555). This ADDS to whatever's already
    // there, exactly like the JS's own rooms.push(...), not a replacement.
    if (rooms.size() < 2) {
        rooms.push_back({3, 3, 8, 6, 7, 6});
        rooms.push_back({20, 5, 7, 6, 23, 8});
        rooms.push_back({40, 10, 9, 7, 44, 13});
    }

    // Carve rooms into tiles -- js/zones.js lines 1557-1561.
    for (const DungeonRoom& r : rooms) {
        for (int y = r.y; y < r.y + r.h; ++y) {
            for (int x = r.x; x < r.x + r.w; ++x) {
                if (x >= 0 && x < W && y >= 0 && y < H) tiles[y][x] = dungeonFloor;
            }
        }
    }

    // Connect rooms with L-shaped corridors -- js/zones.js lines 1563-1573.
    // See shuffleWithRng()'s own doc comment for why this uses a real
    // Fisher-Yates on the same rng stream in place of the JS's own
    // `.sort(()=>rng()-0.5)`.
    std::vector<DungeonRoom> shuffled = rooms;
    shuffleWithRng(shuffled, rng);
    for (size_t i = 0; i + 1 < shuffled.size(); ++i) {
        const DungeonRoom& a = shuffled[i];
        const DungeonRoom& b = shuffled[i + 1];
        const int midX = (rng.next() < 0.5) ? a.cx : b.cx;
        if (a.cy >= 0 && a.cy < H)
            for (int x = std::min(a.cx, midX); x <= std::max(a.cx, midX); ++x)
                if (x >= 0 && x < W) tiles[a.cy][x] = dungeonFloor;
        if (midX >= 0 && midX < W)
            for (int y = std::min(a.cy, b.cy); y <= std::max(a.cy, b.cy); ++y)
                if (y >= 0 && y < H) tiles[y][midX] = dungeonFloor;
        if (b.cy >= 0 && b.cy < H)
            for (int x = std::min(midX, b.cx); x <= std::max(midX, b.cx); ++x)
                if (x >= 0 && x < W) tiles[b.cy][x] = dungeonFloor;
    }

    // Snapshot floor -- js/zones.js line 1577. floorArr is the JS's own
    // `floor` array: the walkable terrain answer, as opposed to `tiles`,
    // which is what's actually rendered (and gains torches/stairs/chests/
    // enemies below).
    std::vector<std::vector<TileKindId>> floorArr = tiles;

    // ---- Place features -- js/zones.js lines 1580-1651 ----

    // Torches on walls near rooms.
    for (const DungeonRoom& r : rooms) {
        const int pts[4][2] = {{r.y - 1, r.x + 1},
                                {r.y - 1, r.x + r.w - 2},
                                {r.y + r.h, r.x + 1},
                                {r.y + r.h, r.x + r.w - 2}};
        for (const auto& p : pts) {
            const int ty = p[0], tx = p[1];
            if (ty >= 0 && ty < H && tx >= 0 && tx < W && tiles[ty][tx] == wall) {
                floorArr[ty][tx] = dungeonFloor;
                tiles[ty][tx] = dungeonTorch;
            }
        }
    }

    // Stair up (entrance) in the first room -- clears the whole room first.
    const DungeonRoom& entryRoom = rooms.front();
    for (int y = entryRoom.y; y < entryRoom.y + entryRoom.h; ++y)
        for (int x = entryRoom.x; x < entryRoom.x + entryRoom.w; ++x)
            if (x >= 0 && x < W && y >= 0 && y < H) tiles[y][x] = dungeonFloor;

    const int stairUpX = entryRoom.cx, stairUpY = entryRoom.cy;
    if (stairUpX >= 0 && stairUpX < W && stairUpY >= 0 && stairUpY < H) {
        tiles[stairUpY][stairUpX] = dungeonStairUp;
        floorArr[stairUpY][stairUpX] = dungeonFloor;
    }

    // Spawn point: one tile south of the stair, guaranteed floor.
    const int spawnX = stairUpX, spawnY = stairUpY + 1;
    if (spawnX >= 0 && spawnX < W && spawnY >= 0 && spawnY < H) {
        tiles[spawnY][spawnX] = dungeonFloor;
        floorArr[spawnY][spawnX] = dungeonFloor;
    }

    // Also clear the last room fully for the exit stair.
    const DungeonRoom& exitRoom = rooms.back();
    for (int y = exitRoom.y; y < exitRoom.y + exitRoom.h; ++y)
        for (int x = exitRoom.x; x < exitRoom.x + exitRoom.w; ++x)
            if (x >= 0 && x < W && y >= 0 && y < H) tiles[y][x] = dungeonFloor;

    // Stair down / crypt stair in the last room -- see GrimstoneGame.h's
    // own doc comment on DungeonGenConfig for why this does NOT get a
    // matching portal TileMarker.
    const TileKindId stairTile = config.hasCryptStair ? cryptStair : dungeonStairDown;
    if (exitRoom.cx >= 0 && exitRoom.cx < W && exitRoom.cy >= 0 && exitRoom.cy < H) {
        tiles[exitRoom.cy][exitRoom.cx] = stairTile;
        floorArr[exitRoom.cy][exitRoom.cx] = dungeonFloor;
    }

    // Chests in 1-3 middle rooms.
    if (rooms.size() > 2) {
        std::vector<DungeonRoom> middle(rooms.begin() + 1, rooms.end() - 1);
        shuffleWithRng(middle, rng);
        const size_t chestCount = std::min<size_t>(3, middle.size());
        for (size_t i = 0; i < chestCount; ++i) {
            const DungeonRoom& r = middle[i];
            const int cx = r.x + 1 + static_cast<int>(std::floor(rng.next() * (r.w - 2)));
            const int cy = r.y + 1 + static_cast<int>(std::floor(rng.next() * (r.h - 2)));
            if (cx >= 0 && cx < W && cy >= 0 && cy < H && tiles[cy][cx] == dungeonFloor) {
                tiles[cy][cx] = chest;
                floorArr[cy][cx] = dungeonFloor;
            }
        }
    }

    // Enemies -- skeletons/zombies (or whatever config.enemies resolves to)
    // scattered across middle rooms, kept clear of every stair by a
    // radius-5 exclusion.
    const std::array<TileKindId, 3> stairTiles = {dungeonStairUp, dungeonStairDown, cryptStair};
    constexpr int kStairClear = 5;
    if (rooms.size() > 2) {
        std::vector<DungeonRoom> middle(rooms.begin() + 1, rooms.end() - 1);
        for (const DungeonRoom& r : middle) {
            const int count = 1 + static_cast<int>(std::floor(rng.next() * 3));
            for (int n = 0; n < count; ++n) {
                for (int att = 0; att < 20; ++att) {
                    const int ex = r.x + 1 + static_cast<int>(std::floor(rng.next() * (r.w - 2)));
                    const int ey = r.y + 1 + static_cast<int>(std::floor(rng.next() * (r.h - 2)));
                    if (ex < 0 || ex >= W || ey < 0 || ey >= H || tiles[ey][ex] != dungeonFloor) continue;
                    bool nearStair = false;
                    for (int dy = -kStairClear; dy <= kStairClear && !nearStair; ++dy) {
                        for (int dx = -kStairClear; dx <= kStairClear && !nearStair; ++dx) {
                            const int ny = ey + dy, nx = ex + dx;
                            if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue;
                            for (TileKindId st : stairTiles) {
                                if (tiles[ny][nx] == st) {
                                    nearStair = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (!nearStair) {
                        const TileKindId eType =
                            config.enemies.empty()
                                ? skeletonSpawn
                                : config.enemies[static_cast<size_t>(
                                      std::floor(rng.next() * static_cast<double>(config.enemies.size())))];
                        tiles[ey][ex] = eType;
                        break;
                    }
                }
            }
        }
    }

    // ---- Translate the JS's own two-array tiles/floor split onto this
    // engine's Floor/Overlay layers, the same convention this file's other
    // zone builders' own doc comments describe: floorArr is the walkable
    // terrain, tiles is what's actually rendered -- wherever they differ,
    // that's decor sitting on top, ported as an Overlay paint. ----
    TileGrid grid(W, H, 1.0f);
    for (int y = 0; y < H; ++y) {
        for (int x = 0; x < W; ++x) {
            grid.setFloor(x, y, floorArr[y][x]);
            if (tiles[y][x] != floorArr[y][x]) grid.setOverlay(x, y, tiles[y][x]);
        }
    }

    // Stair-up TileMarker -- the one meaningful, reachable portal back to
    // the parent zone (see GrimstoneGame.h's own doc comment on
    // DungeonGenConfig::exitTargetZone for why this needs an explicit
    // target the JS itself never names).
    if (stairUpX >= 0 && stairUpX < W && stairUpY >= 0 && stairUpY < H) {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = "Stairs Up";
        marker.position = glm::vec2(static_cast<float>(stairUpX) + 0.5f, static_cast<float>(stairUpY) + 0.5f);
        marker.properties["targetZone"] = config.exitTargetZone;
        grid.markers.push_back(marker);
    }

    grid.markers.push_back({"player_spawn",
                             glm::vec2(static_cast<float>(spawnX) + 0.5f, static_cast<float>(spawnY) + 0.5f),
                             "Player Spawn"});

    return grid;
}

// ---- Ashen Moor dungeon -------------------------------------------------
// Mirrors `function makeAshenDungeon(seed)` (js/zones.js, lines 1667-1673).
TileGrid buildAshenDungeon(const TileKindRegistry& registry, uint32_t seed) {
    DungeonGenConfig config;
    config.W = 56;
    config.H = 38;
    config.name = "THE ASHEN CRYPTS";
    config.minRooms = 8;
    config.maxRooms = 12;
    config.enemies = {registry.idFromName("skeleton_spawn"), registry.idFromName("zombie")};
    config.hasCryptStair = false;
    config.exitTargetZone = "ashen_moor";
    return buildDungeonMap(registry, config, seed);
}

// ---- Iron Peaks dungeon -------------------------------------------------
// Mirrors `function makeIronPeaksDungeon(seed)` (js/zones.js, lines
// 1675-1681).
TileGrid buildIronPeaksDungeon(const TileKindRegistry& registry, uint32_t seed) {
    DungeonGenConfig config;
    config.W = 60;
    config.H = 42;
    config.name = "THE IRON DEPTHS";
    config.minRooms = 10;
    config.maxRooms = 14;
    config.enemies = {registry.idFromName("skeleton_spawn"), registry.idFromName("zombie"),
                       registry.idFromName("skeleton_spawn")};
    config.hasCryptStair = false;
    config.exitTargetZone = "iron_peaks";
    return buildDungeonMap(registry, config, seed);
}

// ---- Cultist Catacombs (under the not-yet-ported Forsaken Chapel) ------
// Mirrors `function makeCultistCatacombs(seed)` (js/zones.js, lines
// 1683-1690) -- the JS's own `seed: seed||12345` falsy-fallback becomes
// `seed == 0 ? 12345 : seed`, uint32_t's closest equivalent.
TileGrid buildCultistCatacombs(const TileKindRegistry& registry, uint32_t seed) {
    DungeonGenConfig config;
    config.W = 52;
    config.H = 36;
    config.name = "THE CULTIST CATACOMBS";
    config.minRooms = 9;
    config.maxRooms = 13;
    config.enemies = {registry.idFromName("zombie"), registry.idFromName("skeleton_spawn"),
                       registry.idFromName("zombie")};
    config.hasCryptStair = false;
    config.exitTargetZone = "forsaken_chapel";
    return buildDungeonMap(registry, config, seed == 0 ? 12345u : seed);
}

// ======= THE FORSAKEN CHAPEL =======
// Transcribed from `function makeChapelMap()` in js/zones.js (lines
// 1805-1906 as of this writing) -- reached via buildAshenveilLevel()'s own
// north CHAPEL_PORTAL (targetZone "forsaken_chapel", the slug this
// function's own return portal below targets right back at). js/zones.js
// continues past line 1906 into revealCryptStair()/the chapel rune-text
// tables/readChapelRune()/examineAltar() (gameplay/dialogue, not terrain,
// see this function's own doc comment on the crypt-stair judgement call
// below) and then makeChapelLibrary() (line 1986, see buildChapelLibrary()
// below) -- neither ported here.
//
// The JS itself flags this zone `isInterior:true` despite being the
// "outdoor" building the player walks into from Ashenveil's town square --
// same "portal-entered building" shape as every Ashenveil interior this
// file already ports, just larger and containing its own further portals.
//
// Cultists (T.CULTIST): the JS only spawns them at night via
// spawnChapelCultists()/CULTIST_SPAWNS (js/activities.js, lines 757-788),
// toggled by checkZoneExit()'s own atNight check on entry and despawned at
// dawn -- day/night state isn't tracked by this port yet (see
// PORTING_PLAN.md, the same gap buildShopInterior()'s own doc comment
// already calls out for Dorin's day/night hiding). This function paints
// all 8 CULTIST_SPAWNS positions directly as Overlay tiles, matching this
// port's "enemy spawn = painted tile kind" convention elsewhere
// (buildDungeonMap()'s skeleton/zombie scatter, buildWhisperwoodLevel()'s/
// buildStormcragLevel()'s shadow-walker placements) -- i.e. always-present
// rather than night-only, the same "pick the default/always-on state"
// judgement buildShopInterior() already made for Dorin.
//
// Hidden tomb -> Cultist Catacombs: the JS hides T.CRYPT_STAIR beneath a
// plain T.GRAVE tile in the west transept, revealed only by interacting
// with it (revealCryptStair(), js/zones.js lines 1911-1918 -- gameplay
// logic this port doesn't implement, see PORTING_PLAN.md). Since
// buildCultistCatacombs() now exists, and its own doc comment
// (GrimstoneGame.h) explicitly calls for "a 'crypt_stair' marker the
// Chapel's own builder would place once ported", this function paints the
// ALREADY-REVEALED T.CRYPT_STAIR tile directly (skipping the hidden-GRAVE
// intermediate state -- the same "port the structure, not the reveal
// gameplay" scope this port's own secret-bookshelf/hidden-vault case below
// also uses) and adds a "portal" TileMarker there targeting
// "cultist_catacombs" -- this port's own new slug for entering
// buildCultistCatacombs(), snake_casing its own returned name ("THE
// CULTIST CATACOMBS"), the same convention buildGreenfieldLevel()'s own
// doc comment already documents for "forsaken_chapel"/"western_pass".
//
// Library staircase: T.LIBRARY_STAIR_DOWN in the east apse leads to
// buildChapelLibrary() below (targetZone "forsaken_library", this port's
// own slug for "THE FORSAKEN LIBRARY", same snake_case convention).
//
// Grid size is 44x32 (js/zones.js's own W/H locals for this zone).
TileGrid buildChapelLevel(const TileKindRegistry& registry) {
    const TileKindId dungeonFloor = registry.idFromName("dungeon_floor");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId stoneFloor = registry.idFromName("stone_floor");
    const TileKindId pillar = registry.idFromName("pillar");
    const TileKindId chapelRune = registry.idFromName("chapel_rune");
    const TileKindId altar = registry.idFromName("altar");
    const TileKindId bookshelfE = registry.idFromName("bookshelf_e");
    const TileKindId bookshelfW = registry.idFromName("bookshelf_w");
    const TileKindId chest = registry.idFromName("chest");
    const TileKindId candle = registry.idFromName("candle");
    const TileKindId barrel = registry.idFromName("barrel");
    const TileKindId cryptStair = registry.idFromName("crypt_stair");
    const TileKindId exitInterior = registry.idFromName("exit_interior");
    const TileKindId libraryStairDown = registry.idFromName("library_stair_down");
    const TileKindId cultist = registry.idFromName("cultist");

    const int W = 44, H = 32; // js/zones.js's own W/H locals for this zone

    // ---- Base fill + outer walls -- JS lines 1806-1812 ----
    std::vector<std::vector<TileKindId>> tiles(H, std::vector<TileKindId>(W, dungeonFloor));
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) tiles[y][x] = wall;

    // ---- NAVE (main hall, centre) -- JS lines 1814-1816 ----
    for (int y = 2; y <= 22; ++y)
        for (int x = 8; x <= 35; ++x) tiles[y][x] = stoneFloor;

    // ---- TRANSEPTS (side wings) -- JS lines 1818-1822 ----
    for (int y = 8; y <= 16; ++y)
        for (int x = 2; x <= 8; ++x) tiles[y][x] = stoneFloor;
    for (int y = 8; y <= 16; ++y)
        for (int x = 35; x <= 42; ++x) tiles[y][x] = stoneFloor;

    // ---- APSE / SANCTUARY (north end behind altar) -- JS lines 1824-1825 ----
    for (int y = 2; y <= 7; ++y)
        for (int x = 12; x <= 31; ++x) tiles[y][x] = stoneFloor;

    // ---- WALLS around nave perimeter -- JS lines 1827-1840 ----
    for (int x = 8; x <= 35; ++x) tiles[2][x] = wall;
    for (int y = 2; y <= 22; ++y) {
        tiles[y][8] = wall;
        tiles[y][35] = wall;
    }
    tiles[22][8] = wall;
    tiles[22][35] = wall;
    for (int y = 8; y <= 16; ++y) {
        tiles[y][2] = wall;
        tiles[y][42] = wall;
    }
    for (int x = 2; x <= 8; ++x) {
        tiles[8][x] = wall;
        tiles[16][x] = wall;
    }
    for (int x = 35; x <= 42; ++x) {
        tiles[8][x] = wall;
        tiles[16][x] = wall;
    }
    tiles[11][8] = stoneFloor;
    tiles[12][8] = stoneFloor;
    tiles[11][35] = stoneFloor;
    tiles[12][35] = stoneFloor;
    for (int x = 8; x <= 35; ++x) tiles[7][x] = wall;
    tiles[7][19] = stoneFloor;
    tiles[7][20] = stoneFloor;

    // ---- COLUMNS down the nave -- JS lines 1842-1847 ----
    for (const auto& yx : {std::pair{5, 11}, std::pair{5, 17}, std::pair{5, 23}, std::pair{5, 29},
                            std::pair{10, 11}, std::pair{10, 17}, std::pair{10, 23}, std::pair{10, 29},
                            std::pair{15, 11}, std::pair{15, 17}, std::pair{15, 23}, std::pair{15, 29},
                            std::pair{20, 11}, std::pair{20, 17}, std::pair{20, 23}, std::pair{20, 29}})
        tiles[yx.first][yx.second] = pillar;

    // ---- SOUTH PORCH / ENTRANCE -- JS lines 1849-1856 ----
    for (int y = 22; y <= 28; ++y)
        for (int x = 16; x <= 27; ++x) tiles[y][x] = stoneFloor;
    for (int x = 16; x <= 27; ++x) tiles[28][x] = wall;
    for (int y = 22; y <= 28; ++y) {
        tiles[y][16] = wall;
        tiles[y][27] = wall;
    }
    tiles[28][21] = stoneFloor;
    tiles[28][22] = stoneFloor;
    for (int x = 16; x <= 27; ++x)
        if (x < 20 || x > 23) tiles[22][x] = wall;

    // ---- FLOOR RUNES (carved into nave floor) -- JS lines 1858-1862. Before
    // the floor snapshot below, same as buildWhisperwoodLevel()'s own
    // terrain-vs-decor judgement -- genuine floor carving, not placeDecor()
    // furniture, so these stay Floor. ----
    for (const auto& yx : {std::pair{9, 21}, std::pair{12, 21}, std::pair{15, 21}, std::pair{18, 21},
                            std::pair{21, 21}, std::pair{9, 22}, std::pair{12, 22}, std::pair{15, 22},
                            std::pair{18, 22}})
        tiles[yx.first][yx.second] = chapelRune;

    // ---- Floor layer is now fully authored -- JS's own "SNAPSHOT FLOOR"
    // (lines 1864-1865). ----
    TileGrid grid(W, H, 1.0f);
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, tiles[y][x]);

    // ---- ALTAR (north apse, centred) -- JS line 1868 ----
    placeDecor(grid, 4, 21, altar);

    // ---- LORE OBJECTS -- bookshelves, chests, candles, barrels -- JS lines
    // 1870-1888 ----
    placeDecor(grid, 10, 3, bookshelfE);
    placeDecor(grid, 13, 3, bookshelfE);
    placeDecor(grid, 10, 41, bookshelfW);
    placeDecor(grid, 13, 41, bookshelfW);
    placeDecor(grid, 3, 10, chest);
    placeDecor(grid, 3, 33, chest);
    for (const auto& yx : {std::pair{4, 13}, std::pair{4, 16}, std::pair{4, 27}, std::pair{4, 30},
                            std::pair{8, 10}, std::pair{8, 33}, std::pair{21, 10}, std::pair{21, 33}})
        placeDecor(grid, yx.first, yx.second, candle);
    placeDecor(grid, 25, 18, barrel);
    placeDecor(grid, 25, 25, barrel);
    placeDecor(grid, 26, 18, barrel);

    // ---- HIDDEN TOMB (west transept) -- JS lines 1890-1893. See this
    // function's own doc comment above for the "paint the already-revealed
    // crypt stair" judgement call in place of the JS's hidden-GRAVE +
    // interact-to-reveal mechanic. ----
    placeDecor(grid, 14, 6, cryptStair);
    placeDecor(grid, 13, 5, candle); // candle hint, kept from the JS

    // ---- EXIT (south porch door back to Ashenveil) -- JS line 1896 ----
    placeDecor(grid, 28, 21, exitInterior);
    addExitPortalMarker(grid, 21.0f, 28.0f);

    // ---- LIBRARY STAIRCASE (east apse) -- JS lines 1898-1903 ----
    placeDecor(grid, 5, 25, libraryStairDown);
    {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = "Library Stair -> The Forsaken Library";
        marker.position = glm::vec2(25.5f, 5.5f);
        marker.properties["targetZone"] = "forsaken_library";
        grid.markers.push_back(marker);
    }

    // ---- Crypt-stair portal -- see this function's own doc comment above. ----
    {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = "Crypt Stair -> The Cultist Catacombs";
        marker.position = glm::vec2(6.5f, 14.5f);
        marker.properties["targetZone"] = "cultist_catacombs";
        grid.markers.push_back(marker);
    }

    // ---- Cultists (T.CULTIST) -- js/activities.js's own CULTIST_SPAWNS (8
    // positions), always painted rather than night-only -- see this
    // function's own doc comment above. ----
    for (const auto& yx : {std::pair{9, 13}, std::pair{13, 26}, std::pair{17, 14}, std::pair{20, 28},
                            std::pair{11, 4}, std::pair{12, 39}, std::pair{5, 14}, std::pair{5, 27}})
        grid.setOverlay(yx.second, yx.first, cultist);

    // ---- Player spawn -- makeChapelMap() returns no entryX/entryY, so
    // entering falls back to enterInterior()'s own default
    // (Math.floor(W/2), H-3) = (22, 29), the same fallback
    // buildInnInterior()'s own doc comment already documents for that
    // zone. ----
    grid.markers.push_back({"player_spawn", glm::vec2(22.5f, 29.5f), "Player Spawn"});

    return grid;
}

// ======= THE FORSAKEN LIBRARY =======
// Transcribed from `function makeChapelLibrary()` in js/zones.js (lines
// 1986-2062 as of this writing) -- reached via buildChapelLevel()'s own
// east-apse LIBRARY_STAIR_DOWN (targetZone "forsaken_library"); this
// function's own return stair-up below targets right back at
// "forsaken_chapel", the same "interiors re-enter their parent zone"
// convention buildWizardTowerInterior()'s own doc comment already
// establishes. js/zones.js continues past line 2062 into
// makeSecretLibrary() (line 2068, see buildSecretLibrary() below, reached
// via this function's own SECRET_BOOKSHELF) -- not ported here.
//
// Layering: the JS snapshots floor immediately after the border walls (JS
// lines 1995-1997), BEFORE any bookshelf/rune/blood-trail/skeleton/
// furniture write -- most of those are direct `tiles[y][x] = ...`
// assignments rather than named placeDecor() calls, but since they all
// land AFTER that snapshot they're still genuine decor sitting over a
// DUNGEON_FLOOR base, the same "when relative to the floor snapshot, not
// which JS function was called" rule buildWizardTowerInterior()'s own doc
// comment already establishes -- so every one of them is ported as an
// Overlay write here.
//
// The scattered rune/blood-trail/dead-skeleton coordinates below each
// carry the JS's own `if(tiles[ry][rx] === T.DUNGEON_FLOOR)` guard --
// never actually false for the coordinates the JS chose (none collide
// with a bookshelf stack column), so this port skips re-checking it.
//
// Grid size is 36x24 (js/zones.js's own W/H locals for this zone).
TileGrid buildChapelLibrary(const TileKindRegistry& registry) {
    const TileKindId dungeonFloor = registry.idFromName("dungeon_floor");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId bookshelf = registry.idFromName("bookshelf");
    const TileKindId secretBookshelf = registry.idFromName("secret_bookshelf");
    const TileKindId bookshelfE = registry.idFromName("bookshelf_e");
    const TileKindId bookshelfW = registry.idFromName("bookshelf_w");
    const TileKindId chapelRune = registry.idFromName("chapel_rune");
    const TileKindId bloodTrail = registry.idFromName("blood_trail");
    const TileKindId deadSkeleton = registry.idFromName("dead_skeleton_decor");
    const TileKindId table = registry.idFromName("table");
    const TileKindId candle = registry.idFromName("candle");
    const TileKindId libraryStairUp = registry.idFromName("library_stair_up");

    const int W = 36, H = 24; // js/zones.js's own W/H locals for this zone

    // ---- Base fill + outer walls, then snapshot -- JS lines 1988-1997 ----
    TileGrid grid(W, H, 1.0f);
    for (int y = 0; y < H; ++y) {
        for (int x = 0; x < W; ++x) {
            const bool edge = (y == 0 || y == H - 1 || x == 0 || x == W - 1);
            grid.setFloor(x, y, edge ? wall : dungeonFloor);
        }
    }

    // ---- North wall of bookshelves -- JS lines 1999-2003 -- one secret
    // bookshelf overrides the run 2 tiles west of centre, exactly matching
    // the JS's own "loop, then override" order. ----
    for (int x = 1; x <= W - 2; ++x) placeDecor(grid, 1, x, bookshelf);
    placeDecor(grid, 1, 15, secretBookshelf);

    // ---- Side bookshelf walls -- JS lines 2005-2011 ----
    for (int y = 2; y <= 15; ++y) {
        placeDecor(grid, y, 1, bookshelfE);
        placeDecor(grid, y, W - 2, bookshelfW);
    }

    // ---- Interior bookshelf stacks, 2 tiles wide -- JS lines 2013-2022 ----
    constexpr int kStacks[] = {5, 11, 17, 23, 29};
    for (int sx : kStacks) {
        for (int y = 2; y <= 14; ++y) {
            placeDecor(grid, y, sx, bookshelfW);
            placeDecor(grid, y, sx + 1, bookshelfE);
        }
    }

    // ---- Purple floor runes in the aisles -- JS lines 2024-2027 ----
    for (const auto& yx : {std::pair{4, 3}, std::pair{8, 9}, std::pair{5, 15}, std::pair{11, 21},
                            std::pair{7, 27}, std::pair{3, 9}, std::pair{10, 15}, std::pair{6, 21}})
        placeDecor(grid, yx.first, yx.second, chapelRune);

    // ---- Blood trails -- JS lines 2029-2032 ----
    for (const auto& yx : {std::pair{7, 3}, std::pair{8, 3}, std::pair{6, 9}, std::pair{7, 9},
                            std::pair{11, 14}, std::pair{12, 14}, std::pair{9, 20}, std::pair{10, 20}})
        placeDecor(grid, yx.first, yx.second, bloodTrail);

    // ---- Dead skeletons -- JS lines 2034-2037 ----
    for (const auto& yx : {std::pair{16, 3}, std::pair{17, 22}, std::pair{14, 14}})
        placeDecor(grid, yx.first, yx.second, deadSkeleton);

    // ---- Reading area: study tables + candles -- JS lines 2039-2045 ----
    placeDecor(grid, 18, 14, table);
    placeDecor(grid, 18, 15, table);
    placeDecor(grid, 19, 14, table);
    placeDecor(grid, 19, 15, table);
    placeDecor(grid, 17, 14, candle);
    placeDecor(grid, 17, 16, candle);

    // ---- Loose candles at aisle ends -- JS lines 2047-2050 ----
    for (const auto& yx : {std::pair{15, 3}, std::pair{15, 9}, std::pair{15, 21}, std::pair{15, 27}})
        placeDecor(grid, yx.first, yx.second, candle);

    // ---- Staircase UP (returns to the chapel) -- JS lines 2052-2054 ----
    placeDecor(grid, 21, 17, libraryStairUp);
    {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = "Stairs Up -> The Forsaken Chapel";
        marker.position = glm::vec2(17.5f, 21.5f);
        marker.properties["targetZone"] = "forsaken_chapel";
        grid.markers.push_back(marker);
    }

    // ---- Secret passage -- see this function's own doc comment above and
    // buildSecretLibrary()'s doc comment below: the JS only turns the
    // SECRET_BOOKSHELF at (1,15) into a walkable T.SECRET_EXIT once the
    // player interacts with it (activateSecretBookshelf(), js/zones.js
    // lines 2884-2895 -- gameplay logic not ported here, see
    // PORTING_PLAN.md). This port instead links the terrain directly: a
    // "portal" TileMarker at the same tile, targeting "hidden_vault" (this
    // port's own slug for buildSecretLibrary()'s "THE HIDDEN VAULT", same
    // snake_case convention as every other targetZone here). ----
    {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = "Secret Bookshelf -> The Hidden Vault";
        marker.position = glm::vec2(15.5f, 1.5f);
        marker.properties["targetZone"] = "hidden_vault";
        grid.markers.push_back(marker);
    }

    // ---- Player spawn -- js's own returned entryX:17, entryY:20 (one tile
    // north of the stair, spawning just inside the reading room). ----
    grid.markers.push_back({"player_spawn", glm::vec2(17.5f, 20.5f), "Player Spawn"});

    return grid;
}

// ======= THE HIDDEN VAULT =======
// Transcribed from `function makeSecretLibrary()` in js/zones.js (lines
// 2068-2119 as of this writing) -- reached via buildChapelLibrary()'s own
// SECRET_BOOKSHELF (targetZone "hidden_vault", see that function's own doc
// comment); this function's own SECRET_EXIT below targets right back at
// "forsaken_library". js/zones.js continues past line 2119 into the
// interior-stack bookkeeping (`interiorStack`, gameplay state, not
// terrain) -- not ported here.
//
// Unlike every other interior in this file, the JS fills BOTH `tiles` and
// `floor` with T.MOSSY_FLOOR (not T.DUNGEON_FLOOR/T.STONE_FLOOR) and
// snapshots immediately after the border walls (JS lines 2070-2078),
// before any decor -- so, same as buildChapelLibrary() above, every
// spider-web/skeleton/chest/book-pile/vase/exit write below is Overlay
// over a MOSSY_FLOOR base. The JS's own `pd()` local helper (JS line 2080)
// is the same conditional-placeDecor idiom buildChapelLibrary() already
// documents (never actually false here either), so this port calls
// placeDecor() directly without re-checking it.
//
// Grid size is 22x16 (js/zones.js's own W/H locals for this zone).
TileGrid buildSecretLibrary(const TileKindRegistry& registry) {
    const TileKindId mossyFloor = registry.idFromName("mossy_floor");
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId spiderWeb = registry.idFromName("spider_web");
    const TileKindId deadSkeleton = registry.idFromName("dead_skeleton_decor");
    const TileKindId chest = registry.idFromName("chest");
    const TileKindId bookPile = registry.idFromName("book_pile");
    const TileKindId vase = registry.idFromName("vase");
    const TileKindId secretExit = registry.idFromName("secret_exit");

    const int W = 22, H = 16; // js/zones.js's own W/H locals for this zone

    // ---- Base fill (mossy floor) + outer walls, then snapshot -- JS lines
    // 2070-2078 ----
    TileGrid grid(W, H, 1.0f);
    for (int y = 0; y < H; ++y) {
        for (int x = 0; x < W; ++x) {
            const bool edge = (y == 0 || y == H - 1 || x == 0 || x == W - 1);
            grid.setFloor(x, y, edge ? wall : mossyFloor);
        }
    }

    // ---- Spider webs -- corners and alcoves -- JS lines 2082-2086 ----
    placeDecor(grid, 1, 1, spiderWeb);
    placeDecor(grid, 1, 20, spiderWeb);
    placeDecor(grid, 14, 1, spiderWeb);
    placeDecor(grid, 14, 20, spiderWeb);
    placeDecor(grid, 1, 10, spiderWeb);
    placeDecor(grid, 7, 1, spiderWeb);
    placeDecor(grid, 7, 20, spiderWeb);

    // ---- Dead skeletons -- JS lines 2088-2091 ----
    placeDecor(grid, 3, 5, deadSkeleton);
    placeDecor(grid, 8, 16, deadSkeleton);
    placeDecor(grid, 12, 9, deadSkeleton);

    // ---- Chests -- JS lines 2093-2095 ----
    placeDecor(grid, 2, 3, chest);
    placeDecor(grid, 2, 18, chest);

    // ---- Book piles -- JS lines 2097-2101 ----
    placeDecor(grid, 5, 8, bookPile);
    placeDecor(grid, 9, 14, bookPile);
    placeDecor(grid, 12, 5, bookPile);
    placeDecor(grid, 6, 19, bookPile);

    // ---- Vases / urns -- JS lines 2103-2107 ----
    placeDecor(grid, 4, 2, vase);
    placeDecor(grid, 10, 20, vase);
    placeDecor(grid, 13, 13, vase);
    placeDecor(grid, 3, 11, vase);

    // ---- Crawlspace exit -- JS lines 2109-2111 ----
    placeDecor(grid, 2, 11, secretExit);
    {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = "Crawlspace -> The Forsaken Library";
        marker.position = glm::vec2(11.5f, 2.5f);
        marker.properties["targetZone"] = "forsaken_library";
        grid.markers.push_back(marker);
    }

    // ---- Player spawn -- js's own returned entryX:11, entryY:4 (just
    // south of the crawlspace exit). ----
    grid.markers.push_back({"player_spawn", glm::vec2(11.5f, 4.5f), "Player Spawn"});

    return grid;
}

// ---- Ashgrove Hollow ----------------------------------------------------
//
// A pale ash-tree grove reached from Greenfield Pastures' own west
// CARAVAN_PORTAL, transcribed from `function makeAshgroveHollowMap()` (js/
// zones.js, lines 2176-2242 as of this writing) -- one of the two remaining
// hand-authored zones this port's own PORTING_PLAN.md queue names (the
// Homestead is the other). js/zones.js continues past line 2242 into
// makeCaravanZoneMap() ("THE WESTERN PASS") -- NOT ported here.
//
// Grid size is 62x36 (js/zones.js's own W/H locals for this zone): a wide,
// mostly-open grove split by a 3-tile-wide east-west dirt road (rows
// pathY-1..pathY+1, pathY=17), with two tree groves -- north (rows 1-13) and
// south (rows 22-34) -- clear of a 3-row buffer either side of the road.
//
// Tree placement: NOT this file's own FractalNoise2D/ValueNoise2D (that
// machinery backs buildProceduralZone()/buildStormcragLevel()/
// buildWhisperwoodLevel() instead) -- this zone's JS uses a completely
// different, one-off deterministic hash: `Math.abs(Math.sin(x*127.1+
// y*311.7)*43758.5453) % 1`, a classic cheap "hash a 2D coordinate into
// [0,1)" trick with no seed/RNG state at all, just x/y themselves. Ported
// verbatim below (ashHash()) rather than reusing ValueNoise2D, since it is
// in fact a different algorithm, not a variant of the existing one.
//
// Wolves are the interesting case: unlike every other zone builder in this
// file (all seeded via ProceduralPrng for determinism), the JS's own wolf
// placement here calls plain `Math.random()` -- genuinely non-deterministic,
// re-rolling wolf positions on every single visit to this zone, a real JS
// quirk rather than an oversight this port should "fix". Preserved via
// std::mt19937 seeded from std::random_device (this file's own first use of
// either), not this file's own seeded ProceduralPrng, so repeated calls to
// this function produce different wolf layouts each time exactly as the JS
// does. `wolfCount` is 5-10 (5 + a 0-5 roll); each candidate cell must still
// read as ash grass AND sit more than 3 rows from the road (`pathY`), up to
// 600 attempts, matching the JS's own placement loop precisely.
//
// Layering: like buildAshenveilLevel()/buildGreenfieldLevel(), there's a
// direct-authoring-then-snapshot shape here, not a bulk floor-array-then-
// overlay split -- border walls, the dirt road, the ash trees AND the
// wolves are all direct `tiles[y][x] = X` writes made BEFORE the JS's own
// "Floor snapshot (before portals)" line, so all four become Floor writes
// here (setFloor()), exactly like buildAshenveilLevel()'s own trees/paths.
// Only the two portals, painted via `pd()` AFTER that snapshot line, become
// Overlay writes (placeDecor()).
//
// Portals: east FARM_PORTAL targets "greenfield_pastures" -- ground truth
// from js/activities.js's own T.FARM_PORTAL handler (lines 2827-2838): when
// currentMap.name is 'ASHGROVE HOLLOW', stepping on FARM_PORTAL calls
// exitInterior() (return to the parent zone), and the ONLY zone that enters
// Ashgrove Hollow via a portal step (see buildGreenfieldLevel()'s own fixed
// CARAVAN_PORTAL doc comment above) is Greenfield Pastures -- so this is the
// "return to Greenfield" side of that same two-way link, matching
// Greenfield's own east FARM_PORTAL, which targets "ashenveil" (a
// DIFFERENT zone -- Greenfield has two distinct portals of its own, its own
// east FARM_PORTAL back to Ashenveil and its own west CARAVAN_PORTAL onward
// to here; this zone's FARM_PORTAL is its own third, unrelated portal
// keyword reused for "the portal back to whichever zone brought you here",
// same reuse convention Ashenveil's/Greenfield's own FARM_PORTAL pair
// already establishes). West CARAVAN_PORTAL targets "western_pass" (js/
// zones.js's own makeCaravanZoneMap(), NOT ported by this function) -- the
// same "portal toward a not-yet-ported destination" convention Ashenveil's
// own CHAPEL_PORTAL and Greenfield's own (now-corrected) CARAVAN_PORTAL
// already establish.
TileGrid buildAshgroveHollowLevel(const TileKindRegistry& registry) {
    const TileKindId wall = registry.idFromName("wall");
    const TileKindId dirt = registry.idFromName("dirt");
    const TileKindId ashGrass = registry.idFromName("ash_grass");
    const TileKindId ashTree = registry.idFromName("ash_tree");
    const TileKindId wolfSpawn = registry.idFromName("wolf_spawn");
    const TileKindId farmPortal = registry.idFromName("farm_portal");
    const TileKindId caravanPortal = registry.idFromName("caravan_portal");

    const int W = 62, H = 36; // js/zones.js's own W/H locals for this zone
    const int pathY = 17;     // centre tile of the 3-wide east-west road

    TileGrid grid(W, H, 1.0f);

    // ---- Fill everything with pale ash grass -- JS lines 2180-2182 ----
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x) grid.setFloor(x, y, ashGrass);

    // ---- Border walls -- JS lines 2187-2188 ----
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            if (y == 0 || y == H - 1 || x == 0 || x == W - 1) grid.setFloor(x, y, wall);

    // ---- Dirt path east-west, 3 tiles wide -- JS lines 2191-2195 ----
    for (int x = 1; x < W - 1; ++x) {
        grid.setFloor(x, pathY - 1, dirt);
        grid.setFloor(x, pathY, dirt);
        grid.setFloor(x, pathY + 1, dirt);
    }

    // ---- Ash tree groves -- deterministic pattern via a one-off sin-hash,
    // NOT this file's own ValueNoise2D/FractalNoise2D -- see this function's
    // own doc comment above. JS lines 2197-2211: northern grove rows 1-13,
    // southern grove rows 22 to H-2, a 3-row buffer (rows 14-21) around the
    // dirt path left untouched by construction (neither loop's y range
    // reaches it). ----
    auto ashHash = [](int x, int y) {
        const double v = std::sin(static_cast<double>(x) * 127.1 + static_cast<double>(y) * 311.7) * 43758.5453;
        return std::fmod(std::abs(v), 1.0);
    };
    for (int y = 1; y < 14; ++y)
        for (int x = 1; x < W - 1; ++x)
            if (ashHash(x, y) < 0.28) grid.setFloor(x, y, ashTree);
    for (int y = 22; y < H - 1; ++y)
        for (int x = 1; x < W - 1; ++x)
            if (ashHash(x, y) < 0.28) grid.setFloor(x, y, ashTree);

    // ---- Wolves -- 5-10 per visit, placed with genuine non-deterministic
    // randomness (std::random_device-seeded std::mt19937), NOT this file's
    // own seeded ProceduralPrng -- see this function's own doc comment above
    // for why that's a deliberate JS quirk this port preserves rather than
    // "fixes" into determinism. JS lines 2214-2224. ----
    std::random_device rd;
    std::mt19937 wolfRng(rd());
    std::uniform_int_distribution<int> countRoll(0, 5);
    std::uniform_int_distribution<int> xRoll(0, W - 3);
    std::uniform_int_distribution<int> yRoll(0, H - 3);
    const int wolfCount = 5 + countRoll(wolfRng);
    int placed = 0, attempts = 0;
    while (placed < wolfCount && attempts < 600) {
        const int wx = 1 + xRoll(wolfRng);
        const int wy = 1 + yRoll(wolfRng);
        if (grid.floorAt(wx, wy) == ashGrass && std::abs(wy - pathY) > 3) {
            grid.setFloor(wx, wy, wolfSpawn);
            ++placed;
        }
        ++attempts;
    }

    // ---- Floor layer is now fully authored (matches the JS's own "Floor
    // snapshot (before portals)" line, JS line 2227) -- everything from here
    // on paints ON TOP via Overlay, per this file's own placeDecor(). ----

    // ---- East wall portal -> Greenfield Pastures (FARM_PORTAL) -- JS lines
    // 2230-2233 ----
    grid.setFloor(W - 1, pathY - 1, ashGrass);
    grid.setFloor(W - 1, pathY, ashGrass);
    grid.setFloor(W - 1, pathY + 1, ashGrass);
    placeDecor(grid, pathY, W - 1, farmPortal);

    // ---- West wall portal -> The Western Pass (CARAVAN_PORTAL) -- JS lines
    // 2236-2239 ----
    grid.setFloor(0, pathY - 1, ashGrass);
    grid.setFloor(0, pathY, ashGrass);
    grid.setFloor(0, pathY + 1, ashGrass);
    placeDecor(grid, pathY, 0, caravanPortal);

    // ---- Portals as TileMarkers -- same "paint + marker" convention every
    // other zone builder in this file already uses. ----
    auto addPortalMarker = [&](const char* name, float px, float py, const char* targetZone) {
        TileMarker marker;
        marker.kind = "portal";
        marker.name = name;
        marker.position = glm::vec2(px + 0.5f, py + 0.5f);
        marker.properties["targetZone"] = targetZone;
        grid.markers.push_back(marker);
    };
    addPortalMarker("Farm Portal -> Greenfield Pastures", static_cast<float>(W - 1), static_cast<float>(pathY),
                     "greenfield_pastures");
    // "THE WESTERN PASS" (js/zones.js's makeCaravanZoneMap(), NOT ported by
    // this function) -- see this function's own header doc comment for the
    // "western_pass" slug's derivation.
    addPortalMarker("Caravan Portal -> The Western Pass", 0.0f, static_cast<float>(pathY), "western_pass");

    // ---- Player spawn -- js's own returned entryX:W-2, entryY:pathY (the
    // arrival point coming from Greenfield's own west CARAVAN_PORTAL). ----
    grid.markers.push_back(
        {"player_spawn", glm::vec2(static_cast<float>(W - 2) + 0.5f, static_cast<float>(pathY) + 0.5f), "Player Spawn"});

    return grid;
}
