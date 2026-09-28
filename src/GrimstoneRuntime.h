#pragma once

#include "GameModuleApi.h"

#include <filesystem>

// Called once from GrimstonePlugin.cpp's registerRuntime() hook, alongside
// registerGrimstoneGame(assetDir) -- gives the zone-transition machinery in
// GrimstoneRuntime.cpp (see handleZoneTransition()'s own doc comment) a
// writable directory to save a freshly-built destination zone's TileGrid to
// before pointing BeTileGridFrame::requestedLevelPath at it. Safe to call
// with an empty path (falls back to the current working directory).
void setGrimstoneRuntimeAssetDir(const std::filesystem::path& assetDir);

// Grimstone's per-frame gameplay runtime -- the entry point
// GrimstonePlugin.cpp's onTileGridUpdate hook calls every frame. This is the
// FIRST slice of the "port the actual gameplay logic" phase (see
// PORTING_PLAN.md): the zone-geometry campaign ported static TileGrid
// content (buildXLevel() functions in GrimstoneGame.h/.cpp); this file is
// the live per-frame systems that react to player input against that
// content -- skills/XP, activities, eventually combat/quests/dialogue.
//
// Design choice: EVERY piece of persistent gameplay state (skill XP, quest
// flags, the current active zone id, etc.) is stored in the HOST's own
// generic flag/string stores (BeTileGridFrame::flags / requestedFlagUpdates,
// TileGridFlagStore.h; BeTileGridFrame::strings / requestedStringUpdates,
// TileGridStringStore.h) rather than a plugin-owned saveState()/loadState()
// blob. The host already persists both stores through a save/resume (see
// GameModuleApi.h's own SAVESYNC/SAVESYNC-STRINGS workstream notes) --
// reusing them means Grimstone's own gameplay state gets save/load for
// free, with no hand-rolled serialization of our own to get wrong. The JS
// source's own `questFlags`/`state.skills` maps onto the flag store almost
// directly: a JS `questFlags.ashen_seal_accepted = true` becomes a flag
// `"ashen_seal_accepted"` set to 1.0, and a JS `p.skills.Mining.xp` becomes
// a flag `"skill_xp_mining"`. See PORTING_PLAN.md's own js/save-load.js row
// for the fuller writeup of what this means for save slots/autosave/
// migration, and GrimstoneRuntime.cpp's own `kActiveZoneStringKey` for the
// one piece of this plugin's in-memory state (which zone is active) that
// used to be silently lost across a process restart until it moved into
// the string store too.
void updateGrimstoneRuntime(BeTileGridFrame* frame);
