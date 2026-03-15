// =====================================================================
// ONLINE CO-OP ENGINE — Firebase REST API (no SDK, pure fetch + SSE)
// DB URL: https://grimmy-c4671-default-rtdb.firebaseio.com/
// rooms/{code}/host   — {name, pos, appearance, hp, maxHp}
// rooms/{code}/guest  — same
// rooms/{code}/started — true when host fires start
// =====================================================================

const FB_BASE = 'https://grimmy-c4671-default-rtdb.firebaseio.com';

// Firebase REST supports CORS natively — no proxy needed.
// Key: omit Content-Type header to avoid preflight OPTIONS request.
// Firebase accepts plain body for PUT/PATCH.

async function fbGet(path) {
  try {
    const r = await fetch(FB_BASE + '/' + path + '.json?t=' + Date.now());
    if(!r.ok) { console.error('fbGet failed:', r.status); return null; }
    const text = await r.text();
    if(!text || text === 'null') return null;
    return JSON.parse(text);
  } catch(e) { console.error('fbGet error:', e); return null; }
}
async function fbSet(path, data) {
  try {
    const r = await fetch(FB_BASE + '/' + path + '.json', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if(!r.ok) console.error('fbSet failed:', r.status, await r.text());
    else console.log('fbSet OK:', path);
  } catch(e) { console.error('fbSet error:', e); }
}
async function fbUpdate(path, data) {
  try {
    await fetch(FB_BASE + '/' + path + '.json', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  } catch(e) { console.error('fbUpdate error:', e); }
}
async function fbDelete(path) {
  try {
    await fetch(FB_BASE + '/' + path + '.json', { method: 'DELETE' });
  } catch(e) {}
}

function fbListen(path, callback) {
  let last = undefined;
  let stopped = false;
  async function poll() {
    if(stopped) return;
    const data = await fbGet(path);
    const key = JSON.stringify(data);
    if(key !== last) { last = key; callback(data); }
    if(!stopped) setTimeout(poll, 500);
  }
  poll();
  return () => { stopped = true; };
}

// ── Online session state ──
let onlineRole    = null;   // 'host' | 'guest' | null
let onlineRoom    = null;   // 4-letter code
let onlineReady   = false;
let _syncTimer    = null;
let _stopListeners = [];    // array of close() fns

let remotePos        = {x:6, y:5};
let remoteAppearance = {skinIdx:1, hairColorIdx:2, hairStyleIdx:1, classId:'warrior'};
let remoteName       = 'Wanderer';
let remoteHp         = 30;
let remoteMaxHp      = 30;
let remoteZone       = 0;
let remoteInterior   = 0;

// ── UI helpers ──
function openCoopMenu() {
  document.getElementById('title-screen').style.display='none';
  document.getElementById('coop-menu').style.display='flex';
}
function closeCoopMenu() {
  // Just hide the coop menu — callers decide what to show next
  document.getElementById('coop-menu').style.display='none';
}
function backFromCoopMenu() {
  document.getElementById('coop-menu').style.display='none';
  document.getElementById('title-screen').style.display='flex';
}
function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for(let i=0;i<4;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}

function lobbySetTab(tab) {
  document.getElementById('tab-host').classList.toggle('active', tab==='host');
  document.getElementById('tab-join').classList.toggle('active', tab==='join');
  document.getElementById('lobby-host-panel').style.display = tab==='host' ? '' : 'none';
  document.getElementById('lobby-join-panel').style.display = tab==='join'  ? '' : 'none';
}
function openOnlineLobby() {
  closeCoopMenu();
  onlineRoom = null; onlineRole = null; onlineReady = false;
  document.getElementById('online-lobby').style.display='flex';
  lobbySetTab('host');
  // Reset to initial state
  document.getElementById('lobby-code-display').textContent = '····';
  document.getElementById('slot-p1-name').textContent = '—';
  document.getElementById('slot-p1').classList.remove('filled');
  document.getElementById('slot-p2-name').textContent = 'Waiting...';
  document.getElementById('slot-p2').classList.remove('filled');
  document.getElementById('lobby-host-status').textContent = 'Create your character to generate a room code.';
  document.getElementById('lobby-host-status').className = 'lobby-status waiting';
  document.getElementById('lobby-start-btn').disabled = false;
  document.getElementById('lobby-start-btn').textContent = '⚔ Create Character & Host';
  document.getElementById('lobby-start-btn').style.display = '';
  document.getElementById('lobby-start-btn').onclick = () => goToCharCreate('online-host');
}
function closeOnlineLobby() {
  // Stop any active listeners/polling
  _stopListeners.forEach(fn=>fn()); _stopListeners=[];
  if(_syncTimer) { clearTimeout(_syncTimer); _syncTimer=null; }
  // Clean up Firebase room if host
  if(onlineRoom && onlineRole==='host') fbDelete('rooms/'+onlineRoom);
  onlineRoom=null; onlineRole=null; onlineReady=false;
  document.getElementById('online-lobby').style.display='none';
  openCoopMenu();
}

function resetHostPanel() {
  document.getElementById('lobby-code-display').textContent = '····';
  document.getElementById('slot-p1-name').textContent = '—';
  document.getElementById('slot-p2-name').textContent = 'Waiting...';
  document.getElementById('slot-p2').classList.remove('filled');
  document.getElementById('slot-p1').classList.remove('filled');
  document.getElementById('lobby-host-status').textContent = 'Create your character to generate a room code.';
  document.getElementById('lobby-host-status').className = 'lobby-status waiting';
  document.getElementById('lobby-start-btn').disabled = false;
  document.getElementById('lobby-start-btn').textContent = '⚔ Create Character & Host';
  document.getElementById('lobby-start-btn').style.display = '';
  document.getElementById('lobby-start-btn').onclick = () => goToCharCreate('online-host');
}

function afterHostCharCreate() {
  const p = state.players[0];
  const code = makeRoomCode();
  onlineRoom = code;
  onlineRole = 'host';
  onlineReady = false;

  document.getElementById('char-create-screen').style.display = 'none';
  document.getElementById('online-lobby').style.display = 'flex';

  // Force host tab visible without triggering any resets
  document.getElementById('tab-host').classList.add('active');
  document.getElementById('tab-join').classList.remove('active');
  document.getElementById('lobby-host-panel').style.display = '';
  document.getElementById('lobby-join-panel').style.display = 'none';

  // Set all fields directly — no helper calls that might overwrite
  document.getElementById('lobby-code-display').textContent = code;
  document.getElementById('slot-p1-name').textContent = p.name;
  document.getElementById('slot-p1').classList.add('filled');
  document.getElementById('slot-p2-name').textContent = 'Waiting...';
  document.getElementById('slot-p2').classList.remove('filled');
  document.getElementById('lobby-host-status').textContent = '⏳ Creating room...';
  document.getElementById('lobby-host-status').className = 'lobby-status waiting';
  document.getElementById('lobby-start-btn').disabled = true;
  document.getElementById('lobby-start-btn').textContent = 'Waiting for Player 2...';
  document.getElementById('lobby-start-btn').onclick = onlineLobbyStart;

  fbSet('rooms/'+code, {
    host: { name:p.name, pos:{x:6,y:5}, appearance:p.appearance||{}, hp:p.hp, maxHp:p.maxHp },
    started: false,
    created: Date.now()
  }).then(async () => {
    const check = await fbGet('rooms/'+code);
    if(!check) {
      document.getElementById('lobby-host-status').textContent = '✖ Room creation failed. Check console (F12).';
      document.getElementById('lobby-host-status').className = 'lobby-status error';
      return;
    }
    document.getElementById('lobby-host-status').textContent = '✦ Room ready — share code: '+code;
    document.getElementById('lobby-host-status').className = 'lobby-status connected';

    // Poll for guest
    const stopGuest = fbListen('rooms/'+code+'/guest', data => {
      console.log('guest poll callback:', JSON.stringify(data));
      document.getElementById('lobby-host-status').textContent = '🔍 Poll: '+(data ? data.name||'no name' : 'null');
      if(data && data.name) {
        remoteName       = data.name;
        remoteAppearance = data.appearance || remoteAppearance;
        remoteHp         = data.hp   || 30;
        remoteMaxHp      = data.maxHp || 30;
        onlineReady = true;
        document.getElementById('slot-p2-name').textContent = data.name;
        document.getElementById('slot-p2').classList.add('filled');
        document.getElementById('lobby-host-status').textContent = '✦ '+data.name+' joined! Press Start.';
        document.getElementById('lobby-host-status').className = 'lobby-status connected';
        document.getElementById('lobby-start-btn').disabled = false;
        document.getElementById('lobby-start-btn').textContent = 'Start Adventure ⚔';
      }
    });
    _stopListeners.push(stopGuest);
  });
}

function lobbyJoinRoom() {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  if(code.length!==4){ setJoinStatus('Enter a 4-letter code.','error'); return; }
  setJoinStatus('Looking up room...','waiting');
  fbGet('rooms/'+code).then(room => {
    if(!room){ setJoinStatus('Room not found. Check the code.','error'); return; }
    if(room.guest){ setJoinStatus('Room is full.','error'); return; }
    onlineRoom = code;
    onlineRole = 'guest';
    remoteName       = (room.host && room.host.name)       ? room.host.name       : 'Host';
    remoteAppearance = (room.host && room.host.appearance)  ? room.host.appearance : remoteAppearance;
    remoteHp         = (room.host && room.host.hp)          ? room.host.hp         : 30;
    remoteMaxHp      = (room.host && room.host.maxHp)       ? room.host.maxHp      : 30;
    setJoinStatus('✦ Room found — create your character to join!','connected');
    setTimeout(() => goToCharCreate('online-guest'), 800);
  }).catch(e => { setJoinStatus('Connection error: '+e.message,'error'); });
}
function setJoinStatus(msg, cls) {
  const el = document.getElementById('lobby-join-status');
  el.textContent = msg; el.className = 'lobby-status '+cls;
}

function afterGuestCharCreate() {
  document.getElementById('char-create-screen').style.display = 'none';
  document.getElementById('online-lobby').style.display = 'flex';
  const p = state.players[0];

  // Switch to host-panel layout to show both players
  document.getElementById('lobby-join-panel').style.display = 'none';
  document.getElementById('lobby-host-panel').style.display = '';
  document.getElementById('lobby-code-display').textContent = onlineRoom;
  document.getElementById('slot-p1-name').textContent = remoteName+' (Host)';
  document.getElementById('slot-p1').classList.add('filled');
  document.getElementById('slot-p2-name').textContent = p.name+' (You)';
  document.getElementById('slot-p2').classList.add('filled');
  document.getElementById('lobby-host-status').textContent = '⏳ Joining room...';
  document.getElementById('lobby-host-status').className = 'lobby-status waiting';
  document.getElementById('lobby-start-btn').style.display = 'none';

  fbSet('rooms/'+onlineRoom+'/guest', {
    name:p.name, pos:{x:7,y:5},
    appearance:p.appearance||{}, hp:p.hp, maxHp:p.maxHp
  }).then(() => {
    document.getElementById('lobby-host-status').textContent = '✦ Joined! Waiting for host to start...';
    document.getElementById('lobby-host-status').className = 'lobby-status connected';

    const stopStarted = fbListen('rooms/'+onlineRoom+'/started', data => {
      if(data === true) {
        _stopListeners.forEach(fn=>fn()); _stopListeners=[];
        document.getElementById('online-lobby').style.display = 'none';
        beginOnlineGame('guest');
      }
    });
    _stopListeners.push(stopStarted);
  }).catch(() => {
    document.getElementById('lobby-host-status').textContent = '✖ Failed to join. Try again.';
    document.getElementById('lobby-host-status').className = 'lobby-status error';
  });
}

// ── START ONLINE GAME ──
function onlineLobbyStart() {
  if(!onlineReady) return;
  fbSet('rooms/'+onlineRoom+'/started', true);
  _stopListeners.forEach(fn=>fn()); _stopListeners=[];
  document.getElementById('online-lobby').style.display='none';
  beginOnlineGame('host');
}
function beginOnlineGame(role) {
  gameMode = 'online-'+role;
  document.getElementById('game-container').style.display='flex';
  document.getElementById('p2-hud').style.display='flex';
  if(state.players.length < 2) {
    state.players.push({
      name:remoteName, hp:remoteHp, maxHp:remoteMaxHp, gold:0,
      skills: JSON.parse(JSON.stringify(state.players[0].skills)),
      inventory: Array(28).fill(null),
      appearance: remoteAppearance
    });
  } else {
    state.players[1].name=remoteName; state.players[1].hp=remoteHp;
    state.players[1].maxHp=remoteMaxHp; state.players[1].appearance=remoteAppearance;
  }
  setTimeout(()=>{
    applyUIScale(uiScale);
    currentMap = makeZoneMap(0);
    spawnEnemiesFromMap(); spawnNpcsFromMap();
    const spawn = findSafeSpawn(5, Math.floor(MAP_H/2));
    playerPos = {x:spawn.x, y:spawn.y};
    playerReal = {x:spawn.x, y:spawn.y};
    p2Pos  = {x:spawn.x+1, y:spawn.y};
    p2Real = {x:spawn.x+1, y:spawn.y};
    camera.x = Math.max(0, playerPos.x*TILE - canvas.width/2);
    camera.y = Math.max(0, playerPos.y*TILE - canvas.height/2);
    patchItemIcons(); buildSkillsPanel(); buildInventory(); buildEquipPanel(); wireInvContextMenu(); updateHUD(); updateP2HUD();
    document.getElementById('zone-name').textContent = ZONES[0];
    const p = state.players[0];
    log(`Welcome, ${p.name}. You adventure alongside ${remoteName}.`,'gold');
    log('WASD/Arrows to move · Right-click to interact','info');
    Music.init(); SFX.init(); startAutoSave(); initScaleSlider(); initPanelToggles(); gameLoop();
    window.addEventListener('resize',()=>{ applyUIScale(uiScale); });
    startOnlineSync();
  }, 100);
}

// ── SYNC ENGINE — push every 100ms, listen via SSE ──
let _lastSyncPush = 0;
function startOnlineSync() {
  const myRole    = onlineRole;
  const theirRole = myRole==='host' ? 'guest' : 'host';

  // Listen to remote player
  const stopRemote = fbListen('rooms/'+onlineRoom+'/'+theirRole, data => {
    if(!data) return;
    if(data.pos) { p2Pos={x:data.pos.x,y:data.pos.y}; }
    if(data.name)        { remoteName=data.name; state.players[1].name=data.name; }
    if(data.appearance)  { remoteAppearance=data.appearance; state.players[1].appearance=data.appearance; }
    if(data.hp!=null)    state.players[1].hp=data.hp;
    if(data.maxHp!=null) state.players[1].maxHp=data.maxHp;
    if(data.zone!=null)  remoteZone=data.zone;
    if(data.interior!=null) remoteInterior=data.interior;
  });
  _stopListeners.push(stopRemote);

  // Push local state on interval
  function pushLoop() {
    const p = state.players[0];
    fbUpdate('rooms/'+onlineRoom+'/'+myRole, {
      name:p.name, pos:{x:playerPos.x,y:playerPos.y},
      appearance:p.appearance||{}, hp:p.hp, maxHp:p.maxHp,
      zone: zoneIndex, interior: interiorStack.length
    });
    _syncTimer = setTimeout(pushLoop, 50);
  }
  pushLoop();

  // Clean up on page close
  window.addEventListener('beforeunload', ()=>{
    if(_syncTimer) clearTimeout(_syncTimer);
    if(myRole==='host') fbDelete('rooms/'+onlineRoom);
    else fbDelete('rooms/'+onlineRoom+'/guest');
  });
}

function isOnline() { return gameMode==='online-host' || gameMode==='online-guest'; }

function showOnlineBadge() {
  if(document.getElementById('online-badge-hud')) return;
  const badge = document.createElement('span');
  badge.id = 'online-badge-hud';
  badge.className = 'online-badge';
  badge.innerHTML = '<span class="ping-dot"></span>ONLINE';
  document.querySelector('.bar-wrap').appendChild(badge);
}

