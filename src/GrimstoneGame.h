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
