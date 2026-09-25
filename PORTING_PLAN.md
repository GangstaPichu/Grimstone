# Grimstone C++ port -- plan and status

Grimstone started as a browser-based (three.js/canvas) dark-fantasy RPG,
`js/*.js` in this repo's `main` branch (see `README.md` there for full
feature list -- current three.js version is v0.7.0). This branch starts a
C++ port built as a 2D TileGrid plugin on top of the LiminalEngine/BEditor
engine (attached here as the `engine/` git submodule, pointing at
`GangstaPichu/Backrooms`). See `engine/BEditor/CLAUDE.md`'s "Building a game
from scratch" section for the underlying plugin model this project follows
(`TileGridHost` + `game-sdk/`, Milestone 246+).

**Status.** `src/GrimstoneGame.{h,cpp}` and `src/GrimstonePlugin.cpp` are a
buildable Game SDK plugin (mirrors `engine/games/tinytown/src/`).
`registerGrimstoneTileKinds()` registers the full ~90-entry (128 including
every `T` constant) tile-kind palette from `js/world.js`'s `const T = {...}`,
and `buildAshenveilLevel()` transcribes the one hand-authored zone
(`js/zones.js`'s `makeAshenveil()`) into a real `TileGrid` -- see the table
below for both rows. Every other zone/system is still not ported.
Build with:

```
cd engine/BEditor && ../tools/update-game-sdk.sh   # after building the engine once
cd ../.. && cmake -B build && cmake --build build
```

## System-by-system mapping

| JS file (three.js version) | What it does | C++ engine primitive to port onto | Status |
|---|---|---|---|
| `js/world.js` | Zone graph, portals, world map, day/night, weather; also the ~90-entry `const T = {...}` tile-kind palette | `TileGrid` per zone + `requestedLevelPath` zone swap (v4 ABI) for portals; `TileGrid::sunColor/sunIntensity` (v11) can drive day/night tinting; **no weather primitive exists yet**. Tile-kind palette: `TileKindDesc` via `TileKindRegistry` | **Tile-kind palette: done** (`registerGrimstoneTileKinds()`, `src/GrimstoneGame.cpp` -- all 128 `T` constants registered, colors/solid/shape per `js/input.js`'s own `SOLID_TILES` set). Zone graph/day-night/weather: Not started |
| `js/zones.js` | Per-zone tile/entity layout for all 7 zones | Author each zone as a `TileGrid` in BEditor (TILES tab), painted tile kinds + `TileMarker`s for portals | **Ashenveil (the one hand-authored zone): done** (`buildAshenveilLevel()`, `src/GrimstoneGame.cpp`, transcribed from `makeAshenveil()`, `js/zones.js` lines 817-1213). The other 6 zones (Ashwood Vale, Whisperwood, Greenfield Pastures, the Iron Peaks/Cursed Marshes/Obsidian Depths procedural biomes, etc.) are all **procedurally generated in JS** via `makeZoneMap()`/`ZONE_CONFIGS` (see `js/world.js`'s `ZONE_CONFIGS` array) rather than hand-authored like Ashenveil -- porting them is a separate follow-up (likely a C++ port of the noise/cellular-automata generator, not a second `buildXLevel()` transcription). Not started. |
| `js/character.js` | Character creation, classes/origins, appearance, skills (Combat/Gathering/Crafting), XP | Host has no skills/XP primitive -- plugin-owned state via `game.lua`/`onTileGridUpdate`, persisted through `saveState`/`loadState` (v5 ABI) | Not started |
| `js/activities.js` | Mining/woodcutting/fishing/cooking/smithing/farming action loops | Plugin-owned per-frame logic (`onTileGridUpdate`), tile edits via `requestedTileEdits` (v4) for stateful tiles (crops) | Not started |
| `js/npcs.js` | NPC definitions, dialogue, schedules, enemy stats | `TileAgentSpawn` (host-owned wander/chase/flee, v6 gives freeze control) for movement; `DialogueTree`/`push_dialog` (v255/DialogueScriptCommands) for conversations; combat framework (`WeaponDef`, `attack_hitbox`) for enemy fights | Not started |
| `js/quests.js` | Quest chains, notice board, flags | `TileGridObjectiveLog` (v14 ABI, `requestedSetObjective*`) + `TileGridFlagStore` (FLAGS/LUABIND, `be.set_flag`/`be.increment_flag`) | Not started |
| `js/effects.js`, `js/particles.js` | Visual effects, weather particles | `ParticleEffect` library (Effects tab) + `requestedParticleEffect` (v9 ABI) | Not started |
| `js/render.js` | Custom canvas renderer, sprites, tile drawing | Replaced entirely by the engine's own Vulkan 2D renderer (`bakeTileGrid`, `SpriteMesh`, `BePluginSprite` for plugin-owned entities, v10 textured sprites) | N/A -- engine-native |
| `js/input.js` | Keyboard/mouse handling, right-click context menu | Engine's own input (WASD/E built in); a context menu (examine/attack/trade on right-click) has no existing UI primitive -- would need a `UILayout` dialog authored per-interaction | Not started |
| `js/ui.js` | HUD, panels, battle UI, world map overlay | `UILayout`/`UILayoutStack` (dialog stack, v7 ABI) for panels; inventory HUD (v8) and hotbar (v15) are already host-built | Not started |
| `js/bank.js` | Bank storage UI + persistence | Plugin-owned inventory-like store; the host's `TileGridInventory` is a single fixed 8-slot player inventory, not a bank -- would need its own plugin-side data structure, persisted via `saveState`/`loadState` | Not started |
| `js/save-load.js` | 5 save slots, autosave, migration | Host already has save-game persistence (`TileGridSaveGame.h`, v5 ABI) for grid/inventory/flags/strings; slots + migration are plugin/launcher-level concerns on top of that | Not started |
| `js/multiplayer.js` | PeerJS P2P co-op (4 players) + local split-screen | **No 2D multiplayer/networking primitive exists in the engine at all** (`requestedLevelPath`'s own doc comment explicitly calls out "multiplayer zone sync... entirely the plugin's own responsibility") | **Real engine gap -- see below** |
| `js/devconsole.js` | In-game dev console (give/gold/heal/tp/setskill/xp/flag) | No engine equivalent for a 2D host; could be built as a `game.lua` script reading a `TextInput` via `be.get_text_input()`, dispatching to `be.*` calls | Not started |
| `js/version.js` | Version/changelog display | Cosmetic, trivial once a UI panel exists | Not started |

## Things to relay to the editor/engine session

Per the standing instruction for this session (Grimstone game-side work
only, editor/engine changes relayed back): these are gaps found while
mapping Grimstone's own systems onto the current plugin ABI (`v16` as of
this writing, `engine/LiminalEngine/src/GameModuleApi.h`), not things this
branch can build itself:

1. **No 2D multiplayer/networking primitive at all.** Grimstone's up-to-4-
   player P2P co-op + local split-screen (`js/multiplayer.js`) has nothing
   to build on -- `TileGridHostRunner.cpp` is single-player only, and
   `requestedLevelPath`'s own doc comment says zone sync across players is
   explicitly unsupported. This is the single biggest blocker to a full
   port and almost certainly needs engine-side design work, not a plugin-
   side workaround.
2. **No weather system.** Grimstone's zones have rain/fog/snow/storms
   affecting visibility/atmosphere (`js/world.js`). `TileGrid::sunColor/
   sunIntensity` (custom scene light, v11) can approximate lighting-based
   weather but there's no particle-density/visibility/fog primitive beyond
   hand-driving `ParticleEffect` bursts per frame.
3. **No local split-screen / second local viewport.** Independent of the
   networking gap above -- `Camera2D`/the render loop assume exactly one
   local player view.
4. **No generic "bank"/secondary-inventory-with-own-UI primitive.** The
   host's `TileGridInventory` (v8 ABI) is a single fixed 8-slot player
   inventory; a bank needs its own storage concept (or the inventory system
   would need a "which container" parameter added).

Everything else in the table above already has a real engine primitive to
port onto -- those are plugin-side work for this branch, not editor asks.
