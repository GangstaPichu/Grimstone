#pragma once

#include "TileGrid.h"
#include "TileKindRegistry.h"

#include <filesystem>

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
