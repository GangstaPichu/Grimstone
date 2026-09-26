#pragma once

#include "GameModuleApi.h"

// Grimstone's per-frame gameplay runtime -- the entry point
// GrimstonePlugin.cpp's onTileGridUpdate hook calls every frame. This is the
// FIRST slice of the "port the actual gameplay logic" phase (see
// PORTING_PLAN.md): the zone-geometry campaign ported static TileGrid
// content (buildXLevel() functions in GrimstoneGame.h/.cpp); this file is
// the live per-frame systems that react to player input against that
// content -- skills/XP, activities, eventually combat/quests/dialogue.
//
// Design choice: EVERY piece of persistent gameplay state (skill XP, quest
// flags, etc.) is stored in the HOST's own generic flag store
// (BeTileGridFrame::flags / requestedFlagUpdates, TileGridFlagStore.h)
// rather than a plugin-owned saveState()/loadState() blob. The host already
// persists the flag store through a save/resume (see GameModuleApi.h's own
// SAVESYNC workstream note) -- reusing it means Grimstone's own gameplay
// state gets save/load for free, with no hand-rolled serialization of our
// own to get wrong. The JS source's own `questFlags`/`state.skills` maps
// onto this store almost directly: a JS `questFlags.ashen_seal_accepted =
// true` becomes a flag `"ashen_seal_accepted"` set to 1.0, and a JS
// `p.skills.Mining.xp` becomes a flag `"skill_xp_mining"`.
void updateGrimstoneRuntime(BeTileGridFrame* frame);
