@echo off
cd /d "%~dp0"
set BE_DATA_DIR=data
set BE_GAME_PLUGIN=libgrimstone_game.dll
TileGridHost.exe --level "level.json" --tileset "tileset.json"
