#pragma once

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
