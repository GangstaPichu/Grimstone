#pragma once

#include "TileGrid.h"
#include "TileKindRegistry.h"

#include <filesystem>
#include <string>

// Grimstone's single registration entry point -- the "Static Game Module"
// model this scaffold follows (see games/tinytown/src/TinyTownGame.h in the
// engine submodule for the worked example this mirrors). Fills in this
// project's own tile kinds/starting content so app startup is one line,
// registerGrimstoneGame(assetDir), instead of registrations that could be
// called out of order.
//
// `assetDir` is where this project's runtime assets live (typically the
// executable's own directory).
void registerGrimstoneGame(const std::filesystem::path& assetDir);

// Registers Grimstone's full tile-kind palette -- the ~90-entry `const T =
// {...}` object in the three.js source's `js/world.js` (see PORTING_PLAN.md
// for the file-by-file mapping), transcribed one kind per JS constant.
// Mirrors registerTinyTownTileKinds() (games/tinytown/src/TinyTownGame.h)
// in shape: called once at startup, idempotent by string id (see
// TileKindRegistry::registerKind()'s own doc comment). Colors are cosmetic
// placeholders -- there is no real Grimstone tileset art yet, same
// "flat-color-first" spirit TinyTown's own palette already uses -- picked
// by judgement (grass=green, water=blue+animated, stone/walls=gray,
// wood/roofs=brown, etc.), not sourced from the original canvas renderer's
// draw calls. `solid` is set for anything the three.js game's own collision
// treats as unwalkable: walls, building front/side wall faces (BWALL_*),
// trees, water, fences, and decor furniture (chests/tables/beds/etc, cross-
// checked against `DECOR_TILES` and the three.js input/collision code) --
// portals, floor decals, crops and small non-blocking decor are left
// non-solid.
void registerGrimstoneTileKinds(TileKindRegistry& registry);

// The Ashenveil starting town -- the one hand-crafted (non-procedural) zone
// in the three.js source, transcribed from `function makeAshenveil()` in
// `js/zones.js` (lines 817-1213 as of this writing; `js/zones.js` continues
// past that point into `makeGreenfieldMap()` and the other procedurally-
// generated zones, which are NOT ported by this function -- see
// PORTING_PLAN.md). Mirrors buildTinyTownLevel() (TinyTownGame.h) in shape:
// grid size, registry.idFromName() lookups cached in local consts, then
// grid.setFloor()/setOverlay() calls mirroring the JS's own nested loops.
//
// Layering: the JS keeps two same-shaped arrays, `tiles` (what's solid/
// rendered) and `floor` (a snapshot of what was underneath before
// `placeDecor()` overwrote a cell with a decoration -- see placeDecor() in
// world.js). That maps directly onto this engine's own two-layer TileGrid
// (TileGrid.h's own doc comment: a fresh grid always has exactly "Floor"
// and "Overlay" layers) -- floor tiles (terrain, cobble, building walls/
// roofs, which the JS never routes through placeDecor) go on layer 0 via
// setFloor(); decorations (from DECOR_TILES, placed via placeDecor() in the
// JS) go on layer 1 via setOverlay(), reproducing the exact same "final
// visible tile" the JS's own `tiles` array ends up holding either way.
//
// Not yet wired into the plugin's ABI -- 2D plugins ship levels as
// exported level.json/tileset.json (authored/exported via BEditor), not a
// "provide initial level" hook, so this function's own callers are: (a) a
// future local dev-only main.cpp (mirrors games/tinytown/src/
// TinyTownMain.cpp) that calls this directly for iteration, or (b) running
// this once through a real engine build to export ashenveil-level.json/
// ashenveil-tileset.json for the packaged game. See PORTING_PLAN.md.
TileGrid buildAshenveilLevel(const TileKindRegistry& registry);

// The 4 procedurally-generated overworld biomes -- transcribed from
// `makeZoneMap(z)` (js/quests.js, lines 582-763 as of this writing) plus its
// supporting generator functions in js/world.js (`makePRNG`/`makeNoise`/
// `makeFractalNoise`/`smoothTerrain`/`placeCluster`/`carvePath`, lines
// 670-756, and the `ZONE_CONFIGS` table, lines 759-816) and
// `placeDungeonEntrance()` (js/zones.js, lines 1756-1772). This is a
// DIFFERENT kind of port than buildAshenveilLevel() above: that function
// transcribes one fixed, hand-authored layout; this one transcribes an
// ALGORITHM -- the same seeded value-noise + cellular-automata + cluster/
// path-carving generator the three.js game runs live, every time a player
// steps through a portal into one of these zones.
//
// `zoneIndex` is 1-4, matching the JS's own zone index `z` (NOT the
// ZONE_CONFIGS array index, which is `z-1`): 1 = The Ashen Moor, 2 = The
// Iron Peaks, 3 = The Cursed Marshes, 4 = The Obsidian Depths. zoneIndex 0
// (Ashenveil) is NOT handled here -- see buildAshenveilLevel() above.
// `seed` is the JS's own `worldSeed` (a per-playthrough world seed chosen
// once at new-game time, NOT a per-zone value) -- this function derives the
// per-zone seed internally exactly as the JS does (`worldSeed + z*7919`).
//
// Grid size is MAP_W=60, MAP_H=36 (js/world.js), the same as
// buildAshenveilLevel(). See GrimstoneGame.cpp's own doc comment on this
// function for the PRNG/noise porting notes and the judgement calls made
// on layering (Floor vs. Overlay) and on what became TileMarkers.
TileGrid buildProceduralZone(const TileKindRegistry& registry, int zoneIndex, uint32_t seed);

// Stormcrag Reach -- the first of the 5 remaining hand-authored zones (see
// buildProceduralZone()'s own doc comment above and PORTING_PLAN.md for the
// category split), transcribed from `function makeStormcragMap()` in
// `js/zones.js` (lines 251-380 as of this writing). `js/zones.js` continues
// past line 380 into `makeWizardTowerInterior()` (line 383 -- the Aetheric
// Spire's interior, entered via this zone's own WIZARD_DOOR marker below;
// NOT ported by this function) and then into `makeWhisperwoodMap()` (line
// 484) and the rest of the still-unported hand-authored zones -- see
// PORTING_PLAN.md for the queue.
//
// A rocky mountain zone south of the Whisperwood: lush forest fades into
// bare stone as elevation rises southward, with the Aetheric Spire (the
// Wizard Tower) standing at the map's southern end. Like
// buildAshenveilLevel() this is a fixed, hand-authored layout -- NOT part
// of buildProceduralZone()'s ZONE_CONFIGS/makeZoneMap() machinery -- but it
// leans on the SAME seeded-noise primitives that function already ports
// (this file's own ProceduralPrng/FractalNoise2D, transcribing js/world.js's
// makePRNG()/makeFractalNoise()) to carve its elevation bands and its
// winding path, reused here rather than re-derived since they're the
// identical JS functions either way.
//
// Grid size is 60x50 (js/zones.js's own W/H locals for this zone), NOT the
// 60x36 MAP_W/MAP_H the other two functions above share -- Stormcrag Reach
// authors its own dimensions.
//
// Seed: the JS calls `makePRNG(worldSeed + 77742)`/`makeFractalNoise(
// worldSeed + N, ...)` against the per-playthrough `worldSeed` global,
// which isn't threaded through this port at all yet (unlike
// buildProceduralZone(), which takes it as an explicit `seed` parameter --
// this function's signature deliberately stays `(registry)` only, matching
// buildAshenveilLevel()'s own no-seed shape, since neither hand-authored
// zone function takes one today). See GrimstoneGame.cpp's own doc comment
// on this function for the placeholder-seed judgement call that follows
// from that gap, and PORTING_PLAN.md for the real fix (threading a real
// per-playthrough seed through every zone builder that needs one).
TileGrid buildStormcragLevel(const TileKindRegistry& registry);

// The Aetheric Spire's interior -- the Wizard Tower, transcribed from
// `function makeWizardTowerInterior()` in `js/zones.js` (lines 383-479 as
// of this writing). Entered via Stormcrag Reach's own WIZARD_DOOR marker
// (buildStormcragLevel()'s "Wizard Tower Door" portal, targetZone
// "aetheric_spire"); this function's own south exit returns to Stormcrag
// Reach (targetZone "stormcrag_reach") -- interiors re-enter their parent
// zone, not a forward-only graph, the same convention Ashenveil's
// CHAPEL_PORTAL implies for its own not-yet-ported destination.
//
// Grid size is 22x26 (js/zones.js's own W/H locals for this zone) -- a
// fixed, hand-authored layout with no PRNG/noise at all, unlike
// buildStormcragLevel() or buildProceduralZone(). See GrimstoneGame.cpp's
// own doc comment on this function for the Floor/Overlay judgement call on
// the handful of cells the JS decorates BEFORE its own floor snapshot.
TileGrid buildWizardTowerInterior(const TileKindRegistry& registry);

// The Whisperwood -- a dark, dense forest connecting Ashenveil (north) to
// Stormcrag Reach (south), transcribed from `function makeWhisperwoodMap()`
// in `js/zones.js` (lines 484-667 as of this writing). `js/zones.js`
// continues past line 667 into `updateShadowWalker()`/`drawShadowWalker()`
// (gameplay/rendering, not terrain) and then `harvestCrop()` and the rest of
// the farm-interaction helpers -- NOT ported here.
//
// Grid size is 80x60 (js/zones.js's own W/H locals for this zone), the
// largest hand-authored zone in this file so far. Like buildAshenveilLevel()
// and buildStormcragLevel(), this is a fixed layout (given a seed) rather
// than a live-generated biome -- but leans on the same seeded-noise
// primitives (this file's own FractalNoise2D) for its tree/water coverage,
// plus a full BFS connectivity pass (the JS's own flood-fill + nearest-
// reached-tile corridor carving) to guarantee every passable tile is
// actually reachable from the main path, a step neither buildStormcragLevel()
// nor buildProceduralZone() needed. See GrimstoneGame.cpp's own doc comment
// on this function for the Floor/Overlay judgement call: unlike every prior
// zone builder here, terrain-shaping writes that the JS happens to place
// AFTER its own "Snapshot floor" line (the guaranteed-connect approach-dirt
// clearing near the south exit) are still classified as Floor here, not
// Overlay, because they're genuine terrain, not decor -- only the actual
// placeDecor() calls (portal decor, graves, candles) become Overlay.
//
// North portal targets "ashenveil" (matching Ashenveil's own south
// FOREST_PORTAL, which already targets "whisperwood"); south portal targets
// "stormcrag_reach" (matching Stormcrag Reach's own north FOREST_PORTAL,
// which already targets "whisperwood").
TileGrid buildWhisperwoodLevel(const TileKindRegistry& registry);

// Greenfield Pastures -- a hand-authored farming zone (windmill, barn,
// farmhouse, wheat/turnip fields, a fenced animal pasture) reached from
// Ashenveil's own west FARM_PORTAL, transcribed from
// `function makeGreenfieldMap()` in `js/zones.js` (lines 1216-1344 as of
// this writing). `js/zones.js` continues past line 1344 into
// makeHouseInterior() and the rest of the still-unported interior/other-
// zone functions -- NOT ported here, see PORTING_PLAN.md. Old Bertram's own
// homestead quest line ("A Place to Call Home"/"A Farmer's Ledger",
// js/quests.js) is set here -- Bertram is one of this zone's own
// `namedNpcs`, ported as an npc_spawn TileMarker like the other two
// (Greta/Aldous). See GrimstoneGame.cpp's own doc comment on this function
// for the Floor/Overlay judgement call (this zone's JS has no bulk
// floor-snapshot line at all, unlike every procedurally-shaped zone builder
// above) and the NPC/portal-slug derivations.
//
// Grid size is 70x44 (js/zones.js's own W/H locals for this zone) -- a
// fixed, hand-authored layout with no PRNG/noise at all, like
// buildAshenveilLevel() and buildWizardTowerInterior().
//
// East FARM_PORTAL targets "ashenveil" (matching Ashenveil's own west
// FARM_PORTAL, which already targets "greenfield_pastures"); west
// CARAVAN_PORTAL targets "western_pass" (js/zones.js's own
// makeCaravanZoneMap(), returned name "THE WESTERN PASS" -- NOT ported by
// this function, same "portal toward a not-yet-ported destination"
// convention Ashenveil's own CHAPEL_PORTAL already establishes).
TileGrid buildGreenfieldLevel(const TileKindRegistry& registry);

// ---- Ashenveil building interiors --------------------------------------
//
// Five small interiors, each entered by stepping on the matching BWALL_DOOR
// tile in buildAshenveilLevel() (see that function's own door placements)
// and exited back to the same spot in Ashenveil via a "portal" TileMarker
// targeting "ashenveil" -- the same targetZone-slug convention every other
// portal in buildAshenveilLevel() already uses. Transcribed from the
// "HOUSE INTERIOR MAPS" section of js/zones.js; each function's own doc
// comment below cites its exact JS line range.
//
// Unlike buildAshenveilLevel() (not yet wired into the plugin ABI -- see
// that function's own doc comment), these are ordinary standalone
// TileGrid builders with the same caller story: a future dev-only main.cpp,
// or a one-time BEditor export pass.

// Mirrors `function makeHouseInterior(residentName)` (js/zones.js, lines
// 1348-1401): a small generic two-room house (living area + bedroom) used
// for all 6 of Ashenveil's residential houses -- Mira, Aldric, the two
// unnamed "Residence" houses at (2,46)/(2,53), Elspeth, and Rowan (see
// buildAshenveilLevel()'s own placeHouse() calls and NPC markers). The JS
// itself places no NPC/resident tile inside the house -- residents stay
// outdoors (Ashenveil's own npc_spawn markers) -- so this function adds no
// npc_spawn marker either, just `residentName`-specific furniture flourish
// exactly matching the JS's own if/else chain (Mira/Aldric/Elspeth/Rowan;
// any other name, e.g. "Residence", gets the shared furniture only).
TileGrid buildHouseInterior(const TileKindRegistry& registry, const std::string& residentName);

// Mirrors `function makeBlacksmithInterior()` (js/zones.js, lines
// 1404-1448) -- Grimward's forge (west half) and workshop (east half),
// split by a dividing wall with a doorway gap. Grimward himself is an
// npc_spawn marker (the JS places T.NPC_GUARD as a placeholder tile at
// tiles[5][11] with its own comment "re-using guard tile for now, named
// below" -- NAMED_NPCS's own 'forge:5,11' entry, js/zones.js, is where the
// real name "Grimward" comes from).
TileGrid buildBlacksmithInterior(const TileKindRegistry& registry);

// Mirrors `function makeInnInterior()` (js/zones.js, lines 1451-1508) --
// "The Tarnished Flagon": a common room (tables, bar, fireplace) south of
// a small lodging wing (two bed alcoves), split by a dividing wall with a
// doorway gap. Bram the innkeeper and two seated patrons (Oswin, Thessaly
// -- NAMED_NPCS's own 'inn:10,17'/'inn:9,6'/'inn:12,7' entries, js/
// zones.js) are npc_spawn markers. Unlike every other interior here, the
// JS's own makeInnInterior() returns no entryX/entryY -- entering falls
// back to enterInterior()'s own default (Math.floor(W/2), H-3), so the
// player_spawn marker below sits at that exact fallback position rather
// than at the exit door.
TileGrid buildInnInterior(const TileKindRegistry& registry);

// Mirrors `function makeShopInterior()` (js/zones.js, lines 2126-2173) --
// Dorin's Trading Post: a small counter-and-stockroom layout, Dorin
// himself behind the counter. The JS conditionally hides Dorin at night
// during the "Old Bones" quest and swaps in a hidden chest instead
// (`dorinAbsent`/`questFlags.old_bones_*`) -- day/night and quest flags
// aren't ported yet (see PORTING_PLAN.md), so this always places Dorin,
// matching the JS's own default (daytime, quest not accepted) state.
TileGrid buildShopInterior(const TileKindRegistry& registry);

// Mirrors `function makeBankInterior()` (js/zones.js, lines 2306-2354) --
// Grimstone Savings Bank: a teller counter with a window gap, vault
// storage and a waiting area. Willa the teller (NAMED_NPCS's own
// 'bank:3,6' entry, js/zones.js) is an npc_spawn marker.
TileGrid buildBankInterior(const TileKindRegistry& registry);

// ---- Procedural dungeon generator (BSP rooms + corridors) -------------
//
// Mirrors `function makeDungeonMap(config)` (js/zones.js, lines 1513-1664)
// plus its three named callers `makeAshenDungeon()`/`makeIronPeaksDungeon()`/
// `makeCultistCatacombs()` (lines 1666-1691) -- js/zones.js continues past
// line 1691 into `drawDungeonStair()` (rendering, not terrain), NOT ported
// here. A real BSP room generator, distinct from both buildAshenveilLevel()'s
// hand-authored layout and buildProceduralZone()'s noise-based biomes:
// `tryPlaceRoom()` recursively splits the map (depth capped at 6) into
// either a leaf room or two children, rooms get capped to `maxRooms`,
// shuffled and connected pairwise by L-shaped corridors, then decorated
// with torches, a stair-up back to the parent zone, a stair-down/crypt-
// stair dead end, 1-3 chests, and a scattering of enemy-spawn tiles kept
// clear of every stair by a radius-5 exclusion. See GrimstoneGame.cpp's
// own doc comment on buildDungeonMap() for the tiles/floor -> Floor/
// Overlay translation and the room-shuffle judgement call.
//
// DungeonGenConfig mirrors the JS object literal's own fields one at a
// time, with two deliberate differences from a literal transcription:
// `seed` is its own function parameter (matching buildProceduralZone()'s
// own `seed` argument) rather than a config field, and `enemies` holds
// already-resolved TileKindIds -- the JS's own lowercase 'skeleton'/
// 'zombie' strings, resolved once by each caller below via
// registry.idFromName() -- rather than strings, since a TileKindId is
// this port's natural currency everywhere else in this file. `minRooms`
// is carried over for parity with the JS config shape even though
// makeDungeonMap() itself never reads it (a real dead field in the JS
// source, not a porting gap -- grep js/zones.js's own function body).
//
// `exitTargetZone` is this port's own addition, with no JS equivalent:
// the JS's own T.DUNGEON_STAIR_UP tile just calls the generic
// `exitInterior()` (pop whatever's on the "current interior" stack)
// rather than naming a zone, since the three.js game tracks that via a
// runtime stack this engine's own portal TileMarkers don't have -- every
// caller below supplies the one parent zone slug that stair actually
// needs to target. The exit room's own DUNGEON_STAIR_DOWN/CRYPT_STAIR
// tile does NOT get a matching portal marker: in the JS, stepping on it
// re-enters T.DUNGEON_STAIR_DOWN's handler, which (re)generates a
// dungeon of the SAME type from the SAME deterministic seed formula
// (`worldSeed + zoneIndex*31337`) -- i.e. it loops back to an identical
// layout rather than reaching anywhere new, a quirk of the JS's stack-
// based interior system rather than a meaningful forward link. This port
// leaves that tile as decor (Overlay paint only), matching the torches/
// chests around it, rather than manufacturing a destination the original
// game never actually gave it.
struct DungeonGenConfig {
    int W = 60, H = 40;
    const char* name = "DUNGEON";
    int minRooms = 8, maxRooms = 14;
    std::vector<TileKindId> enemies; // resolved skeleton_spawn/zombie ids
    bool hasCryptStair = false;
    const char* exitTargetZone = "ashenveil"; // stair-up portal target
};
TileGrid buildDungeonMap(const TileKindRegistry& registry, const DungeonGenConfig& config, uint32_t seed);

// The Ashen Moor's own dungeon, "The Ashen Crypts" -- reached via
// buildProceduralZone()'s own zoneIndex==1 "dungeon_stair_down" marker
// (see that function's own doc comment; placeDungeonEntrance() places it,
// but it currently carries no targetZone -- wiring that marker to this
// function is left for a future pass, see PORTING_PLAN.md). Mirrors
// `function makeAshenDungeon(seed)` (js/zones.js, lines 1667-1673). Its
// own stair-up TileMarker targets "ashen_moor" (buildProceduralZone()'s
// own zoneIndex==1 slug).
TileGrid buildAshenDungeon(const TileKindRegistry& registry, uint32_t seed);

// The Iron Peaks' own dungeon, "The Iron Depths" -- reached via
// buildProceduralZone()'s own zoneIndex==2 "dungeon_stair_down" marker,
// same caveat as buildAshenDungeon() above. Mirrors
// `function makeIronPeaksDungeon(seed)` (js/zones.js, lines 1675-1681).
// Its own stair-up TileMarker targets "iron_peaks" (buildProceduralZone()'s
// own zoneIndex==2 slug).
TileGrid buildIronPeaksDungeon(const TileKindRegistry& registry, uint32_t seed);

// The Cultist Catacombs, under the not-yet-ported Forsaken Chapel --
// mirrors `function makeCultistCatacombs(seed)` (js/zones.js, lines
// 1683-1690), reached via a "crypt_stair" marker the Chapel's own builder
// would place once ported (the JS's own T.CRYPT_STAIR handler, not the
// dungeon's own hasCryptStair option, which this dungeon leaves false).
// Its own stair-up TileMarker targets "forsaken_chapel" -- the same
// "portal toward a not-yet-ported destination" convention Ashenveil's
// own CHAPEL_PORTAL and Greenfield's own CARAVAN_PORTAL already establish.
// The JS's own `seed: seed||12345` fallback (used when the caller's own
// seed is falsy) is ported as `seed == 0 ? 12345 : seed`, uint32_t's
// closest equivalent to JS's falsy-number check.
TileGrid buildCultistCatacombs(const TileKindRegistry& registry, uint32_t seed);

// ---- The Forsaken Chapel (and its own library/vault) -------------------
//
// The last of the 5 remaining hand-authored zones this port's own
// PORTING_PLAN.md queue names (Stormcrag Reach/the Aetheric Spire/the
// Whisperwood/Greenfield Pastures came before it) -- reached via
// buildAshenveilLevel()'s own north CHAPEL_PORTAL (targetZone
// "forsaken_chapel"). Transcribed from `function makeChapelMap()` (js/
// zones.js, lines 1805-1906 as of this writing): a cross-shaped stone
// chapel (nave, west/east transepts, north apse/sanctuary, south porch),
// with cultist enemies (always painted, see GrimstoneGame.cpp's own doc
// comment on this function for the day/night judgement call), a hidden
// tomb leading to buildCultistCatacombs() (targetZone
// "cultist_catacombs", this port's own new slug -- see that same doc
// comment for the "paint the already-revealed crypt stair" judgement
// call), and a library staircase leading to buildChapelLibrary() below
// (targetZone "forsaken_library"). Its own south porch door returns to
// Ashenveil (targetZone "ashenveil").
//
// Grid size is 44x32 (js/zones.js's own W/H locals for this zone).
TileGrid buildChapelLevel(const TileKindRegistry& registry);

// The Forsaken Library -- an underground library beneath the chapel apse,
// transcribed from `function makeChapelLibrary()` (js/zones.js, lines
// 1986-2062 as of this writing). Reached via buildChapelLevel()'s own
// LIBRARY_STAIR_DOWN (targetZone "forsaken_library"); its own stair up
// returns to the chapel (targetZone "forsaken_chapel") -- interiors
// re-enter their parent zone, the same convention
// buildWizardTowerInterior() already establishes. Its own hidden
// SECRET_BOOKSHELF leads to buildSecretLibrary() below (targetZone
// "hidden_vault", see GrimstoneGame.cpp's own doc comment on this function
// for the reveal-mechanic judgement call the port makes there).
//
// Grid size is 36x24 (js/zones.js's own W/H locals for this zone).
TileGrid buildChapelLibrary(const TileKindRegistry& registry);

// The Hidden Vault -- a cramped, forgotten chamber behind the library's
// secret bookshelf, transcribed from `function makeSecretLibrary()` (js/
// zones.js, lines 2068-2119 as of this writing). Reached via
// buildChapelLibrary()'s own SECRET_BOOKSHELF (targetZone "hidden_vault");
// its own SECRET_EXIT crawlspace returns to the library (targetZone
// "forsaken_library"). Unlike every other interior in this file the JS
// fills this zone with T.MOSSY_FLOOR rather than T.DUNGEON_FLOOR/
// T.STONE_FLOOR -- see GrimstoneGame.cpp's own doc comment on this
// function for that and the shared reveal-mechanic judgement call (this
// port links the secret passage directly via a portal marker rather than
// modelling the JS's own interact-to-reveal gameplay state, which isn't
// ported yet -- see PORTING_PLAN.md).
//
// Grid size is 22x16 (js/zones.js's own W/H locals for this zone).
TileGrid buildSecretLibrary(const TileKindRegistry& registry);

// ---- Ashgrove Hollow -----------------------------------------------------
//
// A pale ash-tree grove reached from Greenfield Pastures' own west
// CARAVAN_PORTAL (targetZone "ashgrove_hollow" -- see buildGreenfieldLevel()'s
// own doc comment above for that portal's fixed-bug history), transcribed
// from `function makeAshgroveHollowMap()` (js/zones.js, lines 2176-2242 as
// of this writing) -- one of the two remaining hand-authored zones (the
// Homestead is the other) this port's own PORTING_PLAN.md queue still names
// as Not started.
//
// Grid size is 62x36 (js/zones.js's own W/H locals for this zone) -- a wide
// open grove split by a 3-tile-wide east-west dirt road, with two ash-tree
// groves (north/south) placed via a one-off deterministic sin-hash that is
// NOT this file's own ValueNoise2D/FractalNoise2D, and wolves scattered via
// genuinely non-deterministic randomness (std::random_device-seeded
// std::mt19937, NOT this file's own seeded ProceduralPrng) -- a real JS
// quirk (plain `Math.random()`, unlike every other zone's seeded PRNG use)
// preserved deliberately rather than "fixed" into determinism. See
// GrimstoneGame.cpp's own doc comment on this function for both algorithms
// and the Floor/Overlay judgement call.
//
// East FARM_PORTAL targets "greenfield_pastures" (the return trip back to
// Greenfield Pastures, the only zone that ever enters here); west
// CARAVAN_PORTAL targets "western_pass" (js/zones.js's own
// makeCaravanZoneMap(), NOT ported by this function), the same "portal
// toward a not-yet-ported destination" convention this file already
// establishes.
TileGrid buildAshgroveHollowLevel(const TileKindRegistry& registry);
