// ======= DEV CONSOLE =======
// Toggle with ` (tilde/backtick). Commands are processed by runDevCommand().
// Only available in-game (currentMap must exist).

(function() {
  // ── Build DOM ──────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'dev-console';
  overlay.style.cssText = [
    'display:none',
    'position:fixed',
    'bottom:0','left:0','right:0',
    'z-index:9990',
    'background:rgba(5,8,5,0.93)',
    'border-top:2px solid #3a6a18',
    'font-family:monospace',
    'font-size:13px',
    'color:#a0ff70',
    'padding:0',
    'box-shadow:0 -4px 24px rgba(0,0,0,0.7)',
  ].join(';');

  overlay.innerHTML = `
    <div id="dev-log" style="height:140px;overflow-y:auto;padding:8px 12px 4px;line-height:1.6;"></div>
    <div style="display:flex;align-items:center;border-top:1px solid #2a4a12;padding:4px 8px;gap:6px;">
      <span style="color:#4a8a20;user-select:none;">></span>
      <input id="dev-input" type="text" autocomplete="off" spellcheck="false"
        style="flex:1;background:transparent;border:none;outline:none;color:#c8ff90;font-family:monospace;font-size:13px;caret-color:#6aff30;">
      <span id="dev-version-tag" style="color:#3a5a18;font-size:10px;letter-spacing:1px;"></span>
    </div>`;
  document.body.appendChild(overlay);

  const logEl   = document.getElementById('dev-log');
  const inputEl = document.getElementById('dev-input');
  const verTag  = document.getElementById('dev-version-tag');
  if(typeof GAME_VERSION !== 'undefined') verTag.textContent = `v${GAME_VERSION}`;

  let history = [], histIdx = -1;
  let open = false;

  // ── Print to console log ───────────────────────────────────────────────────
  function devPrint(msg, color = '#a0ff70') {
    const line = document.createElement('div');
    line.style.color = color;
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function devEcho(cmd) {
    const line = document.createElement('div');
    line.innerHTML = `<span style="color:#4a8a20">></span> <span style="color:#e0ffe0">${escHtml(cmd)}</span>`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Toggle open/close ──────────────────────────────────────────────────────
  function toggleConsole() {
    if(!currentMap) return; // only while in-game
    open = !open;
    overlay.style.display = open ? 'block' : 'none';
    if(open) {
      inputEl.value = '';
      inputEl.focus();
    }
  }

  // ── Command processor ──────────────────────────────────────────────────────
  function runDevCommand(raw) {
    const parts = raw.trim().split(/\s+/);
    const cmd   = (parts[0] || '').toLowerCase();
    const args  = parts.slice(1);

    switch(cmd) {
      case '':
        return;

      // ── help ──────────────────────────────────────────────────────────────
      case 'help':
        devPrint('Commands:', '#6aaa30');
        devPrint('  give <item_id> [qty]   — add item to inventory');
        devPrint('  give sigil             — add Homestead Sigil');
        devPrint('  gold <amount>          — set gold');
        devPrint('  addgold <amount>       — add gold');
        devPrint('  heal                   — restore full HP');
        devPrint('  tp <zone_index>        — teleport to zone (0–4)');
        devPrint('  setskill <skill> <lvl> — set a skill level');
        devPrint('  xp <skill> <amount>    — add XP to a skill');
        devPrint('  flag <name> [value]    — get/set a quest flag');
        devPrint('  clearinv               — empty inventory');
        devPrint('  version                — show game version');
        devPrint('  clear                  — clear this console');
        break;

      // ── give ──────────────────────────────────────────────────────────────
      case 'give': {
        const alias = { sigil:'home_sigil', wheat:'wheat', seed:'wheat_seed' };
        const itemId = alias[args[0]] || args[0];
        const qty    = Math.max(1, parseInt(args[1]) || 1);
        if(!itemId) { devPrint('Usage: give <item_id> [qty]', '#ff8870'); break; }
        if(typeof ITEMS === 'undefined' || !ITEMS[itemId]) {
          devPrint(`Unknown item: ${itemId}`, '#ff8870'); break;
        }
        if(typeof addToInventory === 'function') {
          addToInventory(itemId, qty);
          if(typeof buildInventory === 'function') buildInventory();
          devPrint(`+ ${qty}x ${ITEMS[itemId].name}`, '#70ff90');
        }
        break;
      }

      // ── gold ──────────────────────────────────────────────────────────────
      case 'gold': {
        const amt = parseInt(args[0]);
        if(isNaN(amt)) { devPrint('Usage: gold <amount>', '#ff8870'); break; }
        const p = state.players[state.activePlayer || 0];
        p.gold = Math.max(0, amt);
        if(typeof updateHUD === 'function') updateHUD();
        devPrint(`Gold set to ${p.gold}`, '#ffd070');
        break;
      }

      case 'addgold': {
        const amt = parseInt(args[0]);
        if(isNaN(amt)) { devPrint('Usage: addgold <amount>', '#ff8870'); break; }
        const p = state.players[state.activePlayer || 0];
        p.gold = Math.max(0, p.gold + amt);
        if(typeof updateHUD === 'function') updateHUD();
        devPrint(`Gold: ${p.gold} (${amt >= 0 ? '+' : ''}${amt})`, '#ffd070');
        break;
      }

      // ── heal ──────────────────────────────────────────────────────────────
      case 'heal': {
        const p = state.players[state.activePlayer || 0];
        p.hp = p.maxHp;
        if(typeof updateHUD === 'function') updateHUD();
        devPrint(`HP restored to ${p.maxHp}`, '#70ff90');
        break;
      }

      // ── tp ────────────────────────────────────────────────────────────────
      case 'tp': {
        const idx = parseInt(args[0]);
        if(isNaN(idx) || idx < 0 || idx > 4) {
          devPrint('Usage: tp <0–4>  (0=Ashenveil, 1=Vale, 2=Peaks, 3=Marshes, 4=Depths)', '#ff8870'); break;
        }
        if(typeof zoneIndex !== 'undefined') {
          zoneIndex = idx;
          if(typeof makeZoneMap === 'function') currentMap = makeZoneMap(zoneIndex);
          if(typeof spawnEnemiesFromMap === 'function') spawnEnemiesFromMap();
          if(typeof spawnNpcsFromMap === 'function') spawnNpcsFromMap();
          if(typeof findSafeSpawn === 'function') {
            const sp = findSafeSpawn(5, Math.floor(currentMap.H / 2));
            playerPos = {x:sp.x, y:sp.y};
            playerReal = {x:sp.x, y:sp.y};
          }
          const zoneNames = ['Ashenveil','Ashen Moor','Iron Peaks','Cursed Marshes','Obsidian Depths'];
          if(typeof updateHUD === 'function') updateHUD();
          document.getElementById('zone-name').textContent = (zoneNames[idx]||'').toUpperCase();
          devPrint(`Teleported to zone ${idx}: ${zoneNames[idx] || '?'}`, '#70d0ff');
        }
        break;
      }

      // ── setskill ──────────────────────────────────────────────────────────
      case 'setskill': {
        const skillName = args[0] ? args[0].charAt(0).toUpperCase() + args[0].slice(1).toLowerCase() : '';
        const lvl = Math.min(99, Math.max(1, parseInt(args[1]) || 1));
        const p = state.players[state.activePlayer || 0];
        if(!skillName || !p.skills[skillName]) {
          devPrint(`Unknown skill. Valid: ${Object.keys(p.skills).join(', ')}`, '#ff8870'); break;
        }
        p.skills[skillName].lvl = lvl;
        if(skillName === 'Hitpoints') { p.maxHp = 10 + (lvl - 1) * 2; p.hp = Math.min(p.hp, p.maxHp); }
        if(typeof updateHUD === 'function') updateHUD();
        devPrint(`${skillName} set to level ${lvl}`, '#70ff90');
        break;
      }

      // ── xp ────────────────────────────────────────────────────────────────
      case 'xp': {
        const skillName = args[0] ? args[0].charAt(0).toUpperCase() + args[0].slice(1).toLowerCase() : '';
        const amount = parseInt(args[1]) || 0;
        const p = state.players[state.activePlayer || 0];
        if(!skillName || !p.skills[skillName]) {
          devPrint(`Unknown skill. Valid: ${Object.keys(p.skills).join(', ')}`, '#ff8870'); break;
        }
        if(typeof gainXP === 'function') {
          gainXP(skillName, amount);
          devPrint(`+${amount} XP → ${skillName}`, '#70ff90');
        } else {
          p.skills[skillName].xp += amount;
          devPrint(`+${amount} XP → ${skillName} (HUD not updated, gainXP unavailable)`, '#ffd070');
        }
        break;
      }

      // ── flag ──────────────────────────────────────────────────────────────
      case 'flag': {
        const name = args[0];
        if(!name) { devPrint('Usage: flag <name> [value]', '#ff8870'); break; }
        if(args[1] === undefined) {
          devPrint(`questFlags.${name} = ${JSON.stringify(questFlags[name])}`, '#d0d0ff');
        } else {
          const val = args[1] === 'true' ? true : args[1] === 'false' ? false : args[1] === 'null' ? null : args[1];
          questFlags[name] = val;
          devPrint(`questFlags.${name} = ${JSON.stringify(val)}`, '#70ff90');
        }
        break;
      }

      // ── clearinv ──────────────────────────────────────────────────────────
      case 'clearinv': {
        const p = state.players[state.activePlayer || 0];
        p.inventory = Array(28).fill(null);
        if(typeof buildInventory === 'function') buildInventory();
        devPrint('Inventory cleared.', '#ffd070');
        break;
      }

      // ── version ───────────────────────────────────────────────────────────
      case 'version':
        devPrint(`Grimstone v${typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?'}`, '#a0d0ff');
        break;

      // ── clear ─────────────────────────────────────────────────────────────
      case 'clear':
        logEl.innerHTML = '';
        break;

      default:
        devPrint(`Unknown command: ${cmd}. Type 'help' for a list.`, '#ff8870');
    }
  }

  // ── Input events ───────────────────────────────────────────────────────────
  inputEl.addEventListener('keydown', e => {
    e.stopPropagation(); // don't let game handle keypresses inside console

    if(e.key === 'Enter') {
      const raw = inputEl.value;
      if(raw.trim()) {
        history.unshift(raw);
        if(history.length > 50) history.pop();
        histIdx = -1;
        devEcho(raw);
        runDevCommand(raw);
      }
      inputEl.value = '';
      return;
    }
    if(e.key === 'Escape' || e.key === '`') {
      e.preventDefault();
      toggleConsole();
      return;
    }
    if(e.key === 'ArrowUp') {
      e.preventDefault();
      histIdx = Math.min(histIdx + 1, history.length - 1);
      inputEl.value = history[histIdx] || '';
      return;
    }
    if(e.key === 'ArrowDown') {
      e.preventDefault();
      histIdx = Math.max(histIdx - 1, -1);
      inputEl.value = histIdx < 0 ? '' : history[histIdx];
      return;
    }
  });

  // ── Global tilde toggle ────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if(e.key === '`' && document.activeElement !== inputEl) {
      e.preventDefault();
      toggleConsole();
    }
  });

  devPrint("Grimstone Dev Console — type 'help' for commands.", '#4a8a20');
})();
