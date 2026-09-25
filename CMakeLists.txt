cmake_minimum_required(VERSION 3.20)
project(GrimstoneGame VERSION 0.1.0 LANGUAGES CXX)

# Builds this project's game module as a Milestone-238 runtime plugin --
# GrimstonePlugin.cpp's beGameModuleV1() -- against the engine's Game SDK
# (Milestone 243), a generated subset of the engine's own public headers
# (engine/tools/update-game-sdk.sh in the engine submodule), NOT that repo's
# full private source. Engine symbols this plugin calls (TileGrid,
# TileKindRegistry, ...) are left undefined here and resolved against the
# HOST binary (TileGridHost) at load time (see GameModuleLoader.h's own doc
# comment) -- so this CMakeLists.txt never needs to link, or even see, the
# engine's own executable target.
#
# Unlike a game scaffolded inside the engine repo's own games/<slug>/ (which
# sits next to BEditor/game-sdk/ as a sibling directory), this project lives
# in its OWN repo with the engine attached as a git submodule at engine/ --
# so the SDK path below points into that submodule instead of "../../".

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(glm REQUIRED)
find_package(nlohmann_json 3.9 REQUIRED)

# Where the Game SDK's include/ lives -- set BE_GAME_SDK_DIR yourself (a CLI
# -D flag or an env var of the same name) to override. Default assumes the
# engine submodule at engine/ has had engine/tools/update-game-sdk.sh run
# inside engine/BEditor/ at least once (see engine/BEditor/CLAUDE.md's
# "Building a game from scratch" section).
if(NOT DEFINED BE_GAME_SDK_DIR)
  if(DEFINED ENV{BE_GAME_SDK_DIR})
    set(BE_GAME_SDK_DIR "$ENV{BE_GAME_SDK_DIR}")
  else()
    set(BE_GAME_SDK_DIR "${CMAKE_CURRENT_SOURCE_DIR}/engine/BEditor/game-sdk")
  endif()
endif()
if(NOT EXISTS "${BE_GAME_SDK_DIR}/include")
  message(FATAL_ERROR "BE_GAME_SDK_DIR (\"${BE_GAME_SDK_DIR}\") has no include/ -- "
    "pass -DBE_GAME_SDK_DIR=/path/to/game-sdk, or run engine/tools/update-game-sdk.sh "
    "from inside engine/BEditor/ first (after building the engine itself).")
endif()

add_library(grimstone_game SHARED
  src/GrimstonePlugin.cpp
  src/GrimstoneGame.cpp
)
target_include_directories(grimstone_game PRIVATE "${BE_GAME_SDK_DIR}/include" src)
target_link_libraries(grimstone_game PRIVATE glm::glm nlohmann_json::nlohmann_json)

# Windows PE linking needs the host's import library to resolve the engine
# symbols this plugin calls but doesn't define (see the Game SDK's own
# README.md for why -- ELF/.so needs no such thing).
if(WIN32)
  set(BE_GAME_SDK_WIN_IMPLIB "${BE_GAME_SDK_DIR}/lib/windows/libBackrooms.dll.a")
  if(EXISTS "${BE_GAME_SDK_WIN_IMPLIB}")
    target_link_libraries(grimstone_game PRIVATE "${BE_GAME_SDK_WIN_IMPLIB}")
  else()
    message(WARNING "No Windows import library at \"${BE_GAME_SDK_WIN_IMPLIB}\" -- "
      "linking grimstone_game.dll will likely fail to resolve engine symbols.")
  endif()
endif()
