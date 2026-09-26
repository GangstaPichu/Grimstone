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
`buildAshenveilLevel()` transcribes the one hand-authored zone
(`js/zones.js`'s `makeAshenveil()`) into a real `TileGrid`, and
`buildProceduralZone()` ports the OTHER kind of zone content this game
has -- the seeded noise/cellular-automata/cluster-and-path-carving
generator behind the 4 `ZONE_CONFIGS` biomes (The Ashen Moor/Iron Peaks/
Cursed Marshes/Obsidian Depths), transcribed from `js/quests.js`'s
`makeZoneMap()` plus its supporting generator functions in `js/world.js`
and `placeDungeonEntrance()` in `js/zones.js` -- see the table below for
all three rows. `buildStormcragLevel()` was the first of the remaining hand-authored
zones to get its own transcription: Stormcrag Reach, from
`makeStormcragMap()` (`js/zones.js` lines 251-380). `buildWizardTowerInterior()`
and `buildWhisperwoodLevel()` came next: the Aetheric Spire's interior
(from `makeWizardTowerInterior()`, `js/zones.js` lines 383-479, entered via
Stormcrag Reach's own WIZARD_DOOR marker) and the Whisperwood (from
`makeWhisperwoodMap()`, `js/zones.js` lines 484-667, connecting Ashenveil's
south FOREST_PORTAL to Stormcrag Reach's own north FOREST_PORTAL).
`buildGreenfieldLevel()` ports Greenfield Pastures (from
`makeGreenfieldMap()`, `js/zones.js` lines 1216-1344) -- the hand-authored
farming zone west of Ashenveil, home to Old Bertram's own homestead quest
line. `buildHouseInterior()`/`buildBlacksmithInterior()`/`buildInnInterior()`/
`buildShopInterior()`/`buildBankInterior()` port Ashenveil's 5 building
interiors (from `makeHouseInterior()`/`makeBlacksmithInterior()`/
`makeInnInterior()`/`makeShopInterior()`/`makeBankInterior()`,
`js/zones.js` lines 1348-2354) -- each entered/exited via Ashenveil's own
door tiles. `buildDungeonMap()` ports the parameterized dungeon generator (from
`makeDungeonMap()`, `js/zones.js` lines 1513-1664) -- a real BSP room
generator, a third and distinct kind of generation alongside
`buildAshenveilLevel()`'s hand-authored layout and `buildProceduralZone()`'s
noise-based biomes -- plus its three named callers `buildAshenDungeon()`/
`buildIronPeaksDungeon()`/`buildCultistCatacombs()` (from
`makeAshenDungeon()`/`makeIronPeaksDungeon()`/`makeCultistCatacombs()`,
`js/zones.js` lines 1666-1691). `buildChapelLevel()`/`buildChapelLibrary()`/
`buildSecretLibrary()` port the Forsaken Chapel and its own library/vault
(from `makeChapelMap()`/`makeChapelLibrary()`/`makeSecretLibrary()`,
`js/zones.js` lines 1805-2119) -- reached via Ashenveil's own north
CHAPEL_PORTAL, with a working stair down to `buildCultistCatacombs()` (this
port's own new "cultist_catacombs" slug) and a secret-bookshelf passage to
the Hidden Vault, both linked as portal markers in place of the JS's own
interact-to-reveal gameplay (not ported yet). Every other zone/system is
still not ported, and that includes a SEPARATE, still-open category: the
remaining hand-authored zones (Ashgrove Hollow, the Caravan Zone, the
Homestead), each its own function in `js/zones.js` that would need its own
transcription the same way the zones above were done -- NOT covered by
`buildProceduralZone()` (the 4 `ZONE_CONFIGS` biomes) or by
`buildDungeonMap()` (the dungeon generator). Build with:

```
cd engine/BEditor && ../tools/update-game-sdk.sh   # after building the engine once
cd ../.. && cmake -B build && cmake --build build
```

## System-by-system mapping

| JS file (three.js version) | What it does | C++ engine primitive to port onto | Status |
|---|---|---|---|
| `js/world.js` | Zone graph, portals, world map, day/night, weather; also the ~90-entry `const T = {...}` tile-kind palette | `TileGrid` per zone + `requestedLevelPath` zone swap (v4 ABI) for portals; `TileGrid::sunColor/sunIntensity` (v11) can drive day/night tinting; **no weather primitive exists yet**. Tile-kind palette: `TileKindDesc` via `TileKindRegistry` | **Tile-kind palette: done** (`registerGrimstoneTileKinds()`, `src/GrimstoneGame.cpp` -- all 128 `T` constants registered, colors/solid/shape per `js/input.js`'s own `SOLID_TILES` set). Zone graph/day-night/weather: Not started |
| `js/zones.js` | Per-zone tile/entity layout for all 7 zones | Author each zone as a `TileGrid` in BEditor (TILES tab), painted tile kinds + `TileMarker`s for portals | **Ashenveil (the one hand-authored zone): done** (`buildAshenveilLevel()`, `src/GrimstoneGame.cpp`, transcribed from `makeAshenveil()`, `js/zones.js` lines 817-1213). **The 4 `ZONE_CONFIGS` procedural biomes (The Ashen Moor/Iron Peaks/Cursed Marshes/Obsidian Depths): done** (`buildProceduralZone()`, `src/GrimstoneGame.cpp`, transcribed from `makeZoneMap()`, `js/quests.js` lines 582-763, plus `js/world.js`'s `makePRNG`/`makeNoise`/`makeFractalNoise`/`smoothTerrain`/`placeCluster`/`carvePath`/`ZONE_CONFIGS`, lines 670-816, and `js/zones.js`'s `placeDungeonEntrance()`, lines 1756-1772) -- a port of the GENERATOR itself (seeded value noise + cellular-automata water smoothing + rejection-sampled cluster/path placement), not a fixed transcription, since the three.js game runs this live on every zone entry rather than loading a hand-placed layout. **Stormcrag Reach: done** (`buildStormcragLevel()`, `src/GrimstoneGame.cpp`, transcribed from `makeStormcragMap()`, `js/zones.js` lines 251-380) -- a rocky mountain zone south of the Whisperwood, hand-authored like Ashenveil but leaning on the same seeded-noise primitives `buildProceduralZone()` already ports for its elevation bands and winding path; its own `WIZARD_DOOR` marker points at `makeWizardTowerInterior()`, now ported (see next). **The Aetheric Spire (Wizard Tower interior): done** (`buildWizardTowerInterior()`, `src/GrimstoneGame.cpp`, transcribed from `makeWizardTowerInterior()`, `js/zones.js` lines 383-479) -- entered via Stormcrag Reach's own WIZARD_DOOR ("aetheric_spire"), with its own exit portal returning to Stormcrag Reach ("stormcrag_reach"), the same "interiors re-enter their parent zone" convention this port now establishes. **The Whisperwood: done** (`buildWhisperwoodLevel()`, `src/GrimstoneGame.cpp`, transcribed from `makeWhisperwoodMap()`, `js/zones.js` lines 484-667) -- the dark forest connecting Ashenveil's south FOREST_PORTAL ("whisperwood") to Stormcrag Reach's own north FOREST_PORTAL ("whisperwood"), the largest hand-authored zone so far (80x60) and the first to need a full BFS connectivity pass (guaranteeing every passable tile the JS's own noise/branch-path generation produces is actually reachable) on top of the seeded-noise primitives the prior two zones already lean on. **Greenfield Pastures: done** (`buildGreenfieldLevel()`, `src/GrimstoneGame.cpp`, transcribed from `makeGreenfieldMap()`, `js/zones.js` lines 1216-1344) -- a hand-authored farming zone (windmill, barn, farmhouse, wheat/turnip fields, a fenced animal pasture) reached from Ashenveil's own west FARM_PORTAL ("greenfield_pastures"), whose own east FARM_PORTAL targets "ashenveil" in return; home to Old Bertram's own homestead quest line, ported as one of this zone's three `namedNpcs` TileMarkers (Greta/Aldous/Bertram). Its west CARAVAN_PORTAL targets "western_pass" (`makeCaravanZoneMap()`'s own "THE WESTERN PASS", not yet ported), the same "portal toward a not-yet-ported destination" convention Ashenveil's own CHAPEL_PORTAL already established. **Ashenveil's 5 building interiors: done** (`buildHouseInterior()`/`buildBlacksmithInterior()`/`buildInnInterior()`/`buildShopInterior()`/`buildBankInterior()`, `src/GrimstoneGame.cpp`, transcribed from `makeHouseInterior()`/`makeBlacksmithInterior()`/`makeInnInterior()` (`js/zones.js` lines 1348-1508), `makeShopInterior()` (lines 2126-2173), and `makeBankInterior()` (lines 2306-2354)) -- each entered via Ashenveil's own BWALL_DOOR tiles and exited back via a "portal" TileMarker targeting "ashenveil"; the interior-only NPCs (Grimward, Bram/Oswin/Thessaly, Dorin, Willa) are `npc_spawn` markers, while `buildHouseInterior()`'s generic house adds no resident marker (the JS keeps residents outdoors). **The parameterized dungeon generator: done** (`buildDungeonMap()`, `src/GrimstoneGame.cpp`, transcribed from `makeDungeonMap()`, `js/zones.js` lines 1513-1664, plus its three named callers `buildAshenDungeon()`/`buildIronPeaksDungeon()`/`buildCultistCatacombs()`, transcribed from `makeAshenDungeon()`/`makeIronPeaksDungeon()`/`makeCultistCatacombs()`, lines 1666-1691) -- a real BSP room generator (recursive `tryPlaceRoom()` split, room-count capping, room-shuffling + L-shaped corridor carving, enemy placement, torches, chests), a THIRD distinct kind of generation alongside `buildAshenveilLevel()`'s hand-authored layout and `buildProceduralZone()`'s noise-based biomes. Each dungeon's own stair-up TileMarker (a "portal" targeting its own parent zone slug -- "ashen_moor"/"iron_peaks"/"forsaken_chapel") is this port's own addition: the JS's own T.DUNGEON_STAIR_UP tile just calls a generic `exitInterior()` (pop a runtime "current interior" stack) with no zone name at all, since this engine's own portal TileMarkers have no such stack to pop. The exit room's own stair-down/crypt-stair tile deliberately gets NO portal marker -- in the JS it loops back into a freshly (but deterministically, same seed) regenerated dungeon of the same type rather than reaching anywhere new, so this port leaves it as decor only (see `GrimstoneGame.h`'s own doc comment on `DungeonGenConfig`). Not yet wired up: `buildProceduralZone()`'s own zoneIndex 1-2 "dungeon_stair_down" markers (placed by its ported `placeDungeonEntrance()`) don't yet carry a `targetZone` pointing at these two dungeons, and the Forsaken Chapel (not yet ported) is what would place the "crypt_stair" marker reaching `buildCultistCatacombs()` -- both left for a future pass. **The Forsaken Chapel (and its own library/vault): done** (`buildChapelLevel()`/`buildChapelLibrary()`/`buildSecretLibrary()`, `src/GrimstoneGame.cpp`, transcribed from `makeChapelMap()`/`makeChapelLibrary()`/`makeSecretLibrary()`, `js/zones.js` lines 1805-2119) -- a cross-shaped stone chapel (nave, transepts, apse, south porch) reached via Ashenveil's own north CHAPEL_PORTAL ("forsaken_chapel"), with cultist enemies (always painted rather than night-only, since day/night state isn't tracked yet -- the same judgement call `buildShopInterior()` already made for Dorin), a hidden tomb, an underground library, and a secret vault behind the library's own bookshelf. Two of this zone's own connections needed new judgement calls of their own: the hidden crypt stair (JS: a plain GRAVE tile that only becomes T.CRYPT_STAIR after an interact-to-reveal script, `revealCryptStair()`) is painted here in its already-revealed form and wired with a "portal" marker straight to `buildCultistCatacombs()` (this port's own new "cultist_catacombs" slug, completing the "portal toward a not-yet-ported destination" precedent Ashenveil's own CHAPEL_PORTAL and that dungeon's own doc comment both called out); the secret bookshelf (JS: solid decor that only turns into a walkable T.SECRET_EXIT after `activateSecretBookshelf()`) is likewise linked directly via a "portal" marker to the Hidden Vault ("hidden_vault" slug) rather than modelling the reveal gameplay, which isn't ported yet. Ashgrove Hollow, the Caravan Zone and the Homestead are each their OWN still-unported hand-authored function in `js/zones.js`, the same kind of work done above -- a separate, still entirely **Not started** category of work, distinct from (and not advanced by) the procedural-generator or dungeon-generator ports above. |
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
