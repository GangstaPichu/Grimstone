// ========== SAVE / LOAD SYSTEM ==========
// Increment CURRENT_SAVE_VERSION when the save format changes.
// Add a migration function below so older saves auto-upgrade.
const CURRENT_SAVE_VERSION = 2;
const MAX_SAVES = 5;

// ── Save Migrations ──────────────────────────────────────────────────────────
// Each key is the save version being migrated FROM.
// Functions receive the raw save object and return the upgraded object.
const SAVE_MIGRATIONS = {
  // v1 → v2: add farmPlots, questFlags, player appearance (added in 0.4.0)
  1: data => {
    if(!data.questFlags) data.questFlags = {};
    if(!data.farmPlots)  data.farmPlots  = {};
    if(!data.gameMode)   data.gameMode   = 'solo';
    if(!data.worldSeed)  data.worldSeed  = Math.floor(Math.random()*99999);
    data.players.forEach(p => {
      if(!p.appearance) p.appearance = { skinIdx:0, hairColorIdx:0, hairStyleIdx:0, classId:'warrior' };
    });
    return data;
  },
  // Future migrations:
  // 2: data => { ...; return data; },
};

function migrateSave(data) {
  // Support both old 'version' key and new 'saveVersion' key
  let v = data.saveVersion || data.version || 1;
  while(v < CURRENT_SAVE_VERSION) {
    if(SAVE_MIGRATIONS[v]) {
      data = SAVE_MIGRATIONS[v](data);
      console.log(`[Save] Migrated v${v} → v${v+1}`);
    }
    v++;
  }
  data.saveVersion = CURRENT_SAVE_VERSION;
  return data;
}
// ─────────────────────────────────────────────────────────────────────────────
const SAVE_PREFIX = 'grimstone_save_';
let activeSaveSlot = null; // which slot this session is using
let autoSaveTimer = null;
let sessionPlaytime = 0;   // seconds played this session
let playtimeTimer = null;

function getSaveKey(slot) { return SAVE_PREFIX + slot; }

function buildSaveData() {
  const p = state.players[0];
  // If inside an interior, save the exterior position/zone from the bottom of the stack
  const exteriorFrame = (interiorStack && interiorStack.length > 0) ? interiorStack[0] : null;
  const savePos       = exteriorFrame ? exteriorFrame.pos  : { x: playerPos.x, y: playerPos.y };
  const saveZone      = exteriorFrame ? exteriorFrame.zoneIndex : zoneIndex;
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    slot: activeSaveSlot,
    name: p.name,
    gameMode,
    zoneIndex: saveZone,
    gameTime,
    gameDay,
    worldSeed,
    playerPos: { x: savePos.x, y: savePos.y },
    players: state.players.map(pl => ({
      name: pl.name,
      hp: pl.hp,
      maxHp: pl.maxHp,
      gold: pl.gold,
      skills: JSON.parse(JSON.stringify(pl.skills)),
      inventory: JSON.parse(JSON.stringify(pl.inventory)),
      equipment: JSON.parse(JSON.stringify(pl.equipment || {})),
      appearance: JSON.parse(JSON.stringify(pl.appearance || {})),
    })),
    playtime: (getSaveMeta(activeSaveSlot)?.playtime || 0) + sessionPlaytime,
    savedAt: Date.now(),
    questFlags: JSON.parse(JSON.stringify(questFlags)),
    farmPlots:  JSON.parse(JSON.stringify(state.farmPlots || {})),
  };
}

function getSaveMeta(slot) {
  try {
    const raw = localStorage.getItem(getSaveKey(slot));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveGame(slot) {
  if(slot == null) return;
  try {
    const data = buildSaveData();
    data.slot = slot;
    localStorage.setItem(getSaveKey(slot), JSON.stringify(data));
    sessionPlaytime = 0; // reset session counter after save
    flashSaveIndicator();
  } catch(e) { console.warn('Save failed:', e); }
}

function loadGame(slot) {
  try {
    let data = getSaveMeta(slot);
    if(!data) return false;
    data = migrateSave(data);

    // Restore game state
    activeSaveSlot = slot;
    gameMode = data.gameMode || 'solo';
    zoneIndex = data.zoneIndex || 0;
    gameTime  = data.gameTime ?? 0.22;
    gameDay   = data.gameDay  || 1;
    worldSeed = data.worldSeed || Math.floor(Math.random()*99999);
    if(data.questFlags) Object.assign(questFlags, data.questFlags);
    if(data.farmPlots)  state.farmPlots = JSON.parse(JSON.stringify(data.farmPlots));

    // Restore players
    const DEFAULT_SKILLS = GAME_DEFAULT_SKILLS;
    state.players.length = 0;
    data.players.forEach(pd => {
      // Migrate: fill in any skills added after this save was created
      const skills = JSON.parse(JSON.stringify(pd.skills));
      Object.entries(DEFAULT_SKILLS).forEach(([k,v]) => {
        if(!skills[k]) skills[k] = JSON.parse(JSON.stringify(v));
      });
      state.players.push({
        name: pd.name,
        hp: pd.hp,
        maxHp: pd.maxHp,
        gold: pd.gold,
        skills,
        inventory: JSON.parse(JSON.stringify(pd.inventory)),
        equipment: JSON.parse(JSON.stringify(pd.equipment || {weapon:null,shield:null,head:null,body:null,legs:null,ammo:null})),
        appearance: JSON.parse(JSON.stringify(pd.appearance || {})),
      });
    });
    state.activePlayer = 0;

    // Launch game
    document.getElementById('title-screen').style.display = 'none';
    startGameFromSave(data.playerPos);
    return true;
  } catch(e) {
    console.warn('Load failed:', e);
    return false;
  }
}

function deleteSave(slot) {
  localStorage.removeItem(getSaveKey(slot));
  renderSaveSlots();
}

// Restore player state from a save slot WITHOUT launching the game.
// Used for online play so the player can bring their existing character.
// Returns true on success.
function loadSaveForOnline(slot) {
  try {
    let data = getSaveMeta(slot);
    if(!data) return false;
    data = migrateSave(data);
    activeSaveSlot = slot;
    const DEFAULT_SKILLS = GAME_DEFAULT_SKILLS;
    state.players.length = 0;
    data.players.forEach(pd => {
      const skills = JSON.parse(JSON.stringify(pd.skills));
      Object.entries(DEFAULT_SKILLS).forEach(([k,v]) => {
        if(!skills[k]) skills[k] = JSON.parse(JSON.stringify(v));
      });
      state.players.push({
        name: pd.name,
        hp: pd.hp,
        maxHp: pd.maxHp,
        gold: pd.gold,
        skills,
        inventory: JSON.parse(JSON.stringify(pd.inventory)),
        equipment: JSON.parse(JSON.stringify(pd.equipment || {weapon:null,shield:null,head:null,body:null,legs:null,ammo:null})),
        appearance: JSON.parse(JSON.stringify(pd.appearance || {})),
      });
    });
    state.activePlayer = 0;
    if(data.questFlags) Object.assign(questFlags, data.questFlags);
    if(data.farmPlots)  state.farmPlots = JSON.parse(JSON.stringify(data.farmPlots));
    return true;
  } catch(e) {
    console.warn('loadSaveForOnline failed:', e);
    return false;
  }
}

function flashSaveIndicator() {
  const el = document.getElementById('save-indicator');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

function startAutoSave() {
  if(autoSaveTimer) clearInterval(autoSaveTimer);
  if(playtimeTimer)  clearInterval(playtimeTimer);
  sessionPlaytime = 0;
  playtimeTimer = setInterval(() => { sessionPlaytime += 5; }, 5000);
  autoSaveTimer = setInterval(() => {
    if(activeSaveSlot != null && currentMap) saveGame(activeSaveSlot);
  }, 30000); // every 30 seconds
}

function stopAutoSave() {
  if(autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null; }
  if(playtimeTimer)  { clearInterval(playtimeTimer); playtimeTimer = null; }
}

// Save on tab close / navigation (solo only — multiplayer has its own handler)
window.addEventListener('beforeunload', () => {
  if(activeSaveSlot != null && currentMap && gameMode !== 'coop') {
    saveGame(activeSaveSlot);
  }
});
// Mobile browsers often skip beforeunload; visibilitychange fires reliably
window.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden' && activeSaveSlot != null && currentMap && gameMode !== 'coop') {
    saveGame(activeSaveSlot);
  }
});

function formatPlaytime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if(h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric' })
       + ' ' + d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
}

function getCombatLevel(skills) {
  const a = skills.Attack?.lvl||1, d = skills.Defence?.lvl||1,
        s = skills.Strength?.lvl||1, h = skills.Hitpoints?.lvl||1;
  return Math.floor((a+d+s+h)/4);
}

function renderSaveSlots() {
  const container = document.getElementById('save-slots');
  if(!container) return;
  container.innerHTML = '';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:Cinzel,serif;font-size:9px;letter-spacing:3px;color:var(--text-dim);text-align:center;margin-bottom:4px;';
  hdr.textContent = '— SAVED JOURNEYS —';
  container.appendChild(hdr);

  for(let slot = 0; slot < MAX_SAVES; slot++) {
    const meta = getSaveMeta(slot);
    const div = document.createElement('div');
    div.className = 'save-slot' + (meta ? '' : ' empty');

    const num = document.createElement('div');
    num.className = 'save-slot-num';
    num.textContent = slot + 1;
    div.appendChild(num);

    if(meta) {
      const info = document.createElement('div');
      info.className = 'save-slot-info';
      const cl = getCombatLevel(meta.players[0].skills);
      const zone = (meta.zoneIndex != null) ? ['Ashenveil','Ashwood Vale','Iron Peaks','Cursed Marshes','Obsidian Depths'][meta.zoneIndex] : 'Ashenveil';
      const pt = formatPlaytime(meta.playtime || 0);
      const saved = formatDate(meta.savedAt);
      info.innerHTML = `<div class="save-slot-name">${meta.name}${meta.gameMode === 'coop' ? ' ⚔⚔' : ''}</div>
        <div class="save-slot-meta">Lvl ${cl} · ${zone} · ${pt} played · ${saved}</div>`;
      div.appendChild(info);

      const del = document.createElement('button');
      del.className = 'save-slot-del';
      del.textContent = '✕';
      del.title = 'Delete save';
      del.onclick = (e) => {
        e.stopPropagation();
        if(confirm(`Delete save for "${meta.name}"?`)) deleteSave(slot);
      };
      div.appendChild(del);

      div.onclick = () => loadGame(slot);
    } else {
      const empty = document.createElement('div');
      empty.className = 'save-slot-empty-label';
      empty.textContent = '— EMPTY SLOT —';
      div.appendChild(empty);

      // Clicking empty slot goes to char create and assigns this slot
      div.onclick = () => {
        pendingSaveSlot = slot;
        goToCharCreate('solo');
      };
    }

    container.appendChild(div);
  }
}

// Track which slot was clicked for new game
let pendingSaveSlot = null;

// Called from title screen — render slots each time
function showTitleScreen() {
  document.getElementById('title-screen').style.display = 'flex';
  renderSaveSlots();
  // Check for newer version on GitHub in the background
  if(typeof checkForUpdate === 'function') {
    checkForUpdate().then(latest => { if(latest) showUpdateBanner(latest); });
  }
}

// Render save slots when title screen loads initially
renderSaveSlots();

const TILE = 40;
const ZONES = ['ASHENVEIL','THE ASHWOOD VALE','THE IRON PEAKS','THE CURSED MARSHES','THE OBSIDIAN DEPTHS'];
let zoneIndex = 0;
let lastPortalZone = 0; // zone index of last portal stepped through

// ── Persistent offscreen canvases (avoids per-frame allocation) ──────────
const nightCanvas = document.createElement('canvas');
const nightCtx    = nightCanvas.getContext('2d');
const minimapCanvas = document.createElement('canvas');
const minimapCtx    = minimapCanvas.getContext('2d');
minimapCanvas.width  = 120;
minimapCanvas.height = 120;
let minimapDirty = true;   // set true whenever map changesr map changes
let _lastNightW  = 0, _lastNightH = 0; // track when night canvas needs resize

// Single timestamp captured once per rendered frame — used throughout drawTile
let frameNow = 0;
// Precomputed sin lookup for GRASS tile texture (purely positional, never changes)
// 128×128 tiles × 4 = 65536 entries — built once at game start
const _grassSin = new Float32Array(128 * 128 * 4);
(()=>{ for(let y=0;y<128;y++) for(let x=0;x<128;x++){
  const gi=(y*128+x)*4;
  for(let i=0;i<4;i++) _grassSin[gi+i]=Math.sin(x*7+y*3+i);
}})();
// Water animation time, updated at 10fps to avoid per-tile Math.sin every frame
let _waterT = 0;
let _waterLastUpdate = 0;

// ── Master skill list — add new skills here and they auto-appear everywhere ─
const GAME_DEFAULT_SKILLS = {
  Mining:{lvl:1,xp:0}, Smithing:{lvl:1,xp:0}, Woodcutting:{lvl:1,xp:0},
  Crafting:{lvl:1,xp:0}, Fishing:{lvl:1,xp:0}, Cooking:{lvl:1,xp:0},
  Farming:{lvl:1,xp:0}, Magic:{lvl:1,xp:0},
  Attack:{lvl:1,xp:0}, Defence:{lvl:1,xp:0},
  Strength:{lvl:1,xp:0}, Hitpoints:{lvl:10,xp:1154},
};

// ── Dirt tile pre-computed hash lookup (avoids Math.sin per tile per frame) ─
// Built on demand when map dims change. Stores 16 hash values per tile.
let _dirtCache = null;
let _dirtCacheW = 0, _dirtCacheH = 0;
function getDirtCache(W, H) {
  if(_dirtCache && _dirtCacheW === W && _dirtCacheH === H) return _dirtCache;
  _dirtCacheW = W; _dirtCacheH = H;
  _dirtCache = new Float32Array(W * H * 16);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) {
    const base = (y * W + x) * 16;
    for(let n = 0; n < 16; n++) {
      let v = Math.sin(x * 127.1 + y * 311.7 + n * 74.3) * 43758.5453;
      _dirtCache[base + n] = v - Math.floor(v);
    }
  }
  return _dirtCache;
}
function dr2(cache, base, n) { return cache[base + n]; }

