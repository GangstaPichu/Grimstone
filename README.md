# Grimstone

A browser-based dark fantasy RPG set in the cursed world of Ashenveil. Explore dangerous zones, master skills, fight enemies in turn-based combat, tend your homestead, and uncover the mysteries of the Ashen Seal — alone or with up to 4 players.

**Current version: v0.7.0**

---

## Playing the Game

Open `index.html` in any modern browser. No server or install required. The game works fully offline after the first load via a Service Worker.

---

## Features

### Character Creation
Choose from 6 classes and a starting origin that shape your early stats:

| Class | Playstyle |
|---|---|
| Warrior | Melee combat specialist |
| Ranger | Ranged and evasion focused |
| Prospector | Mining and smithing expert |
| Shadowblade | Rogue — high damage, low defence |
| Alchemist | Cooking and potion crafting |
| Farmhand | Farming and resource gathering |

Customise your character's appearance (skin tone, hair colour, hair style) before entering the world.

### Skills
Gain XP and level up through gameplay — there are no manual skill trees, just doing things makes you better at them.

- **Combat** — Attack, Strength, Defence, Hitpoints
- **Gathering** — Mining, Woodcutting, Fishing
- **Crafting** — Cooking, Smithing, Farming

### Turn-Based Combat
When you engage an enemy, a battle panel opens and you choose your actions each round:

- **Attack** — Strike the enemy. Damage scales with Strength and equipped weapon.
- **Flee** — Attempt to escape. Success chance is based on your **Attack level** (up to ~70% at level 99) minus a penalty for fast enemies. The exact percentage is shown on the button before you commit.

On a successful flee, the enemy ignores you for **3 minutes** and returns to patrol — it won't aggro even if you walk right past it.

Enemies respawn in the overworld after 5–10 minutes. Dungeon enemies stay dead until you re-enter.

### World & Zones
The world is connected via portals and the world map (`M` key).

| Zone | Description |
|---|---|
| Ashenveil | Starting town — merchants, NPCs, notice board |
| Greenfield Pastures | Farming land, animals, the homestead sigil |
| The Whisperwood | Dense ancient forest |
| Stormcrag Reach | Mountain keep, tougher enemies |
| The Forsaken Chapel | Cultists spawn here at night |
| Dungeon Depths | Procedurally generated floors, boss loot |
| Your Homestead | Personal farm plot with an upgradeable cabin |

### Day/Night Cycle & Weather
- 10 real minutes = 1 in-game day, 7-day week
- Dynamic weather: rain, fog, snow, storms — affects visibility and atmosphere
- Night brings out stronger enemies (Cultists in the Chapel, Shadow Walkers)

### Homestead
Unlock your personal plot through Old Bertram's quest line. Grow crops, tend animals, and furnish your cabin.

**Homestead Upgrades** — after receiving the sigil, talk to Bertram to purchase upgrades:

- **Farm Plot Tiers (4)** — each upgrade expands the farmable soil area. Costs scale from 200g + oak logs up to 2,000g + oak logs, iron bars, and coal.
- **Cabin Tiers (4)** — each upgrade grows the cabin interior (from 9×7 up to 17×12 tiles). Costs scale from 300g + materials up to 3,000g.

**Blueprint Furniture System** — find blueprints in dungeon chests and craft furniture inside your cabin:

| Blueprint | Materials |
|---|---|
| Fireplace | 6 copper ore + 3 coal + 3 logs |
| Workbench | 6 oak logs + 3 iron bars |
| Bookshelf | 5 oak logs + 2 iron bars |
| Storage Chest | 4 logs + 2 iron bars |
| Candle Stand | 2 logs + 2 copper ore |

Right-click a blueprint in your inventory to study it (consumes the item). Then enter your cabin and right-click any empty floor tile to place learned furniture. Furniture persists across sessions.

### Quests
Pick up contracts and bounties from the Ashenveil Notice Board. Multiple quest chains are available, including the main arc around **The Ashen Seal** and a mystery NPC storyline.

### Multiplayer
- **Online co-op** — Host a session and share your room code. Up to 4 players via P2P (PeerJS).
- **Local split-screen** — 2 players on one keyboard. Player 2 uses `I/J/K/L` to move.
- Sessions can be started and stopped in-game without leaving your current zone.

### Saves
Five save slots with autosave. Save data persists in `localStorage`. Saves are forward-compatible across versions via a migration system.

---

## Controls

| Input | Action |
|---|---|
| Left-click | Move / interact / attack |
| Right-click | Context menu (examine, attack, trade) |
| `M` | Toggle world map |
| `Escape` | Close panels |
| `` ` `` | Dev console |
| `I/J/K/L` | Player 2 movement (local co-op) |

---

## Dev Console

Press `` ` `` to open the dev console. Available commands:

```
give <item>          Add item to inventory
gold <amount>        Add gold
heal                 Restore full HP
tp <zone>            Teleport to zone
setskill <skill> <level>
xp <skill> <amount>
flag <key> <value>   Set a quest flag
```

---

## Changelog

| Version | Changes |
|---|---|
| 0.7.0 | Homestead upgrades: 4 farm plot tiers + 4 cabin tiers from Bertram; blueprint furniture system (find in dungeon chests, study, craft inside cabin) |
| 0.6.4 | Homestead cabin interior with movable bed; door now enterable |
| 0.6.3 | Homestead sigil usable without quest flag |
| 0.6.2 | Ground bag drop/pickup system |
| 0.6.1 | Dev console |
| 0.6.0 | Save migration system; Service Worker offline support + auto-update banner |
| 0.5.0 | PeerJS P2P co-op (up to 4 players) |
| 0.4.0 | Homestead feature: Old Bertram quest, farming, crop rendering |
| 0.3.0 | World map, dungeon loot, inn sleep restriction |
| 0.2.0 | Codebase split into organised file structure |
| 0.1.0 | Initial release |
