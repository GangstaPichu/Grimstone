#include "GrimstoneGame.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <initializer_list>
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
