#include "GrimstoneGame.h"

#include <initializer_list>
#include <utility>

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
