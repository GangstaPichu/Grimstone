// Standalone throwaway driver for producing a real, packaged Grimstone
// build via the engine's own BEditor "Build Game" mechanism
// (buildTileGridGamePluginPackage(), TileGridBuildGame.h) with NO GUI/file
// dialog involved.
//
// Why this exists: buildTileGridGamePluginPackage() is only ever called
// from GUI-dialog-driven code today (EditorServices.cpp's
// buildTileGridGameWithPlugin(), which uses tinyfd_openFileDialog()/
// tinyfd_selectFolderDialog()) -- there is no headless/--script hook for
// it. This program builds a real TileGrid + TileKindRegistry for
// Grimstone's own starting zone (the hand-authored "ashenveil" town,
// GrimstoneGame.cpp's zoneSlugToTileGrid()) by linking Grimstone's own
// content-registration source (GrimstoneGame.cpp) directly against the
// engine's REAL TileGrid/TileKindRegistry/TileGridBuildGame code -- not the
// Game SDK's generated header subset a compiled plugin builds against --
// and calls buildTileGridGamePluginPackage() itself, exactly the way
// EditorServices.cpp's GUI handler does.
//
// Usage:
//   grimstone_build_driver <engineBuildsDir> <platform: linux|windows>
//                           <pluginPath> <outputDir>
//
// engineBuildsDir is BEditor/engine-builds/ (populated by
// tools/update-engine-builds.sh) -- buildTileGridGamePluginPackage() reads
// <engineBuildsDir>/<platform>/tilegridhost/ for the neutral TileGridHost
// host binary to bundle.

#include "BuildGame.h"           // BuildPlatform, buildPlatformDirName
#include "TileGridBuildGame.h"   // buildTileGridGamePluginPackage()
#include "TileGrid.h"
#include "TileKindRegistry.h"

#include "GrimstoneGame.h"       // Grimstone's own real content registration

#include <cstdio>
#include <filesystem>
#include <string>

int main(int argc, char** argv) {
    if (argc != 5) {
        std::fprintf(stderr,
            "usage: %s <engineBuildsDir> <linux|windows> <pluginPath> <outputDir>\n",
            argv[0]);
        return 2;
    }

    const std::filesystem::path engineBuildsDir = argv[1];
    const std::string platformArg = argv[2];
    const std::filesystem::path pluginPath = argv[3];
    const std::filesystem::path outputDir = argv[4];

    BuildPlatform platform;
    if (platformArg == "linux") {
        platform = BuildPlatform::Linux;
    } else if (platformArg == "windows") {
        platform = BuildPlatform::Windows;
    } else {
        std::fprintf(stderr, "unknown platform \"%s\" (expected linux|windows)\n", platformArg.c_str());
        return 2;
    }

    // Real Grimstone content: register the full tile-kind palette, then
    // build the hand-authored starting town ("ashenveil", GrimstoneGame.cpp's
    // own zoneSlugToTileGrid() -- the same real registry+grid the plugin
    // itself builds at runtime via registerGrimstoneGame()/its zone-swap
    // machinery, not a placeholder/empty grid).
    TileKindRegistry registry;
    registerGrimstoneTileKinds(registry);

    TileGrid grid;
    const uint32_t seed = 1u;
    if (!zoneSlugToTileGrid(registry, "ashenveil", seed, grid)) {
        std::fprintf(stderr, "zoneSlugToTileGrid(\"ashenveil\") failed -- no grid to package\n");
        return 1;
    }

    std::printf("Built Grimstone's real Ashenveil starting-town grid: %dx%d tiles, %zu tile kinds registered.\n",
                grid.width, grid.height, registry.all().size());

    std::string error;
    if (!buildTileGridGamePluginPackage(engineBuildsDir, platform, pluginPath, grid, registry, outputDir, error)) {
        std::fprintf(stderr, "buildTileGridGamePluginPackage failed: %s\n", error.c_str());
        return 1;
    }

    std::printf("Packaged Grimstone (%s) to \"%s\"\n", platformArg.c_str(), outputDir.string().c_str());
    return 0;
}
