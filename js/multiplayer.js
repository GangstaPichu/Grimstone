// ======= PeerJS CO-OP ENGINE =======
// Star topology: host is the center; guests connect only to the host.
// The host relays a world-state snapshot to all guests every sync cycle.
// Up to 4 players (1 host + 3 guests).
// Sessions can be started or ended at any time without leaving the game.

const MAX_PLAYERS = 4;

// Distinct visual colors for remote player slots (P2, P3, P4)
const REMOTE_COLORS = [
  { body:'#1a2a4a', ring:'#4a8aaa' },  // P2 — cyan
  { body:'#1a2a1a', ring:'#4a8a4a' },  // P3 — green
  { body:'#2a1a08', ring:'#c8822a' },  // P4 — amber
];

// Live remote player map.  peerId → { id, name, pos, real, hp, maxHp, appearance, moving, colorIdx }
// Declared as a plain object so render.js can iterate it without importing anything.
const remotePlayers = new Map();

let coopPeer       = null;   // local Peer instance (PeerJS)
let coopRole       = null;   // 'host' | 'guest' | null
let coopRoomCode   = null;   // 4-letter code
let coopHostConn   = null;   // (guest only) DataConnection to the host
let coopGuestConns = new Map(); // (host only) peerId → DataConnection
let _coopSyncTimer = null;
let _sessionPanelVisible = false;

function isOnline() { return coopRole !== null; }

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for(let i=0;i<4;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}

function _nextColorIdx() {
  const used = new Set([...remotePlayers.values()].map(p=>p.colorIdx));
  for(let i=0;i<3;i++) if(!used.has(i)) return i;
  return 0;
}

function _myState() {
  const p = state.players[0];
  return {
    type:'state',
    name: p.name,
    pos:  { x:playerPos.x, y:playerPos.y },
    hp:   p.hp, maxHp: p.maxHp,
    appearance: p.appearance||{},
    zone: zoneIndex,
    interior: interiorStack.length,
  };
}

function _applyRemoteState(id, data) {
  let rp = remotePlayers.get(id);
  if(!rp) {
    rp = {
      id, name:'Adventurer',
      pos:{x:6,y:5}, real:{x:6,y:5},
      hp:30, maxHp:30, appearance:{},
      moving:false, colorIdx:_nextColorIdx(),
    };
    remotePlayers.set(id, rp);
    const joinName = data.name || 'Adventurer';
    _chatSystemMsg(`${joinName} joined the session.`);
  }
  if(data.pos) {
    rp.moving = (rp.pos.x !== data.pos.x || rp.pos.y !== data.pos.y);
    rp.pos    = data.pos;
  }
  if(data.name)        rp.name       = data.name;
  if(data.hp    != null) rp.hp       = data.hp;
  if(data.maxHp != null) rp.maxHp    = data.maxHp;
  if(data.appearance)  rp.appearance = data.appearance;
  if(data.zone     != null) rp.zone     = data.zone;
  if(data.interior != null) rp.interior = data.interior;
}

function _removeRemotePlayer(id) {
  const rp = remotePlayers.get(id);
  if(rp) { log(`${rp.name} left the session.`, 'info'); _chatSystemMsg(`${rp.name} left the session.`); remotePlayers.delete(id); }
  updateOnlineHUD();
  updateSessionPanel();
}

// ── HOST ─────────────────────────────────────────────────────────────────────

function startHostSession(callback) {
  if(coopRole) { log('Already in a session.', 'bad'); return; }
  const code = makeRoomCode();
  coopPeer = new Peer(code);

  coopPeer.on('open', id => {
    coopRole     = 'host';
    coopRoomCode = id;
    log(`✦ Session started. Code: ${id}`, 'gold');
    _startSyncLoop();
    updateOnlineHUD();
    updateSessionPanel();
    if(callback) callback(id);
  });

  coopPeer.on('connection', conn => {
    if(coopGuestConns.size >= MAX_PLAYERS - 1) { conn.close(); return; }
    conn.on('open', () => {
      coopGuestConns.set(conn.peer, conn);
      conn.on('data',  data => _onHostReceive(conn.peer, data));
      conn.on('close', () => {
        _removeRemotePlayer(conn.peer);
        coopGuestConns.delete(conn.peer);
        updateSessionPanel();
      });
      // Welcome the guest with the current world snapshot
      _sendWorldToConn(conn);
      updateSessionPanel();
    });
  });

  coopPeer.on('error', err => log(`Co-op error: ${err.type}`, 'bad'));
}

function _onHostReceive(guestId, data) {
  if(data.type === 'state') {
    _applyRemoteState(guestId, data);
    // Relay a fresh world snapshot to all OTHER guests
    const snapshot = _buildWorldSnapshot();
    for(const [id, conn] of coopGuestConns) {
      if(id !== guestId && conn.open) conn.send(snapshot);
    }
    updateOnlineHUD();
  } else if(data.type === 'bag_add') {
    _applyBagAdd(data.bag);
    // Relay to all other guests
    for(const [id, conn] of coopGuestConns) {
      if(id !== guestId && conn.open) conn.send(data);
    }
  } else if(data.type === 'bag_remove') {
    _applyBagRemove(data.bagX, data.bagY);
    for(const [id, conn] of coopGuestConns) {
      if(id !== guestId && conn.open) conn.send(data);
    }
  } else if(data.type === 'chat') {
    _appendChatMsg(data.name, data.text);
    // Relay to all other guests
    for(const [id, conn] of coopGuestConns) {
      if(id !== guestId && conn.open) conn.send(data);
    }
  } else if(data.type === 'leave') {
    _removeRemotePlayer(guestId);
    coopGuestConns.delete(guestId);
  }
}

function _buildWorldSnapshot() {
  const p = state.players[0];
  const players = [
    { id:'host', name:p.name, pos:{x:playerPos.x,y:playerPos.y}, hp:p.hp, maxHp:p.maxHp,
      appearance:p.appearance||{}, zone:zoneIndex, interior:interiorStack.length },
    ...[...remotePlayers.values()].map(rp => ({
      id:rp.id, name:rp.name, pos:rp.pos, hp:rp.hp, maxHp:rp.maxHp, appearance:rp.appearance,
      zone:rp.zone, interior:rp.interior,
    })),
  ];
  // Include current ground bags so joining guests get the full picture.
  // gameTime/gameDay keep all players on the same day-night cycle so music themes stay in sync.
  return { type:'world', players, bags: groundBags, gameTime, gameDay };
}

// ── BAG SYNC ──────────────────────────────────────────────────────────────────
// Bags are synced via events (bag_add / bag_remove) rather than every-tick state.
// The host is authoritative; guests send events up, host relays to other guests.
// The world snapshot carries the full bag list for new joiners.

function _applyBagAdd(bag) {
  const existing = groundBags.find(b => b.x === bag.x && b.y === bag.y);
  if(existing) {
    for(const item of bag.items) {
      const stack = existing.items.find(s => s.id === item.id);
      if(stack) stack.qty += item.qty;
      else existing.items.push({id:item.id, qty:item.qty});
    }
  } else {
    groundBags.push({id: _groundBagId++, x: bag.x, y: bag.y, items: bag.items.map(i=>({...i}))});
  }
}

function _applyBagRemove(bx, by) {
  const idx = groundBags.findIndex(b => b.x === bx && b.y === by);
  if(idx >= 0) groundBags.splice(idx, 1);
}

// Called from input.js after any bag change
function broadcastBagEvent(msg) {
  if(!coopRole) return;
  if(coopRole === 'guest') {
    if(coopHostConn && coopHostConn.open) coopHostConn.send(msg);
  } else if(coopRole === 'host') {
    for(const conn of coopGuestConns.values()) if(conn.open) conn.send(msg);
  }
}

function _sendWorldToConn(conn) {
  if(conn.open) conn.send(_buildWorldSnapshot());
}

// ── GUEST ─────────────────────────────────────────────────────────────────────

function joinSession(roomCode, onSuccess, onFail) {
  if(coopRole) { log('Already in a session.', 'bad'); return; }
  coopPeer = new Peer(); // random ID for guest
  coopPeer.on('open', () => {
    const conn = coopPeer.connect(roomCode);
    coopHostConn = conn;

    conn.on('open', () => {
      coopRole     = 'guest';
      coopRoomCode = roomCode;
      log(`✦ Joined session: ${roomCode}`, 'gold');
      _startSyncLoop();
      updateOnlineHUD();
      updateSessionPanel();
      if(onSuccess) onSuccess();
    });

    conn.on('data', data => {
      if(data.type === 'world') {
        const myId = coopPeer.id;
        for(const pd of data.players) {
          if(pd.id !== myId) _applyRemoteState(pd.id, pd);
        }
        // Sync bag list from host (authoritative)
        if(data.bags) {
          groundBags.length = 0;
          for(const b of data.bags) _applyBagAdd(b);
        }
        // Sync day/night cycle from host so music themes stay identical
        if(data.gameTime != null) gameTime = data.gameTime;
        if(data.gameDay  != null) gameDay  = data.gameDay;
        updateOnlineHUD();
      } else if(data.type === 'bag_add') {
        _applyBagAdd(data.bag);
      } else if(data.type === 'bag_remove') {
        _applyBagRemove(data.bagX, data.bagY);
      } else if(data.type === 'chat') {
        _appendChatMsg(data.name, data.text);
      } else if(data.type === 'end') {
        log('The host ended the session.', 'info');
        endSession(true);
      }
    });

    conn.on('close', () => { log('Lost connection to host.', 'bad'); endSession(true); });
    conn.on('error', err => log(`Connection error: ${err.type}`, 'bad'));
  });

  coopPeer.on('error', err => {
    log(`Could not connect: ${err.type}`, 'bad');
    if(coopPeer) { coopPeer.destroy(); coopPeer=null; }
    if(onFail) onFail(err);
  });
}

// ── SYNC LOOP ─────────────────────────────────────────────────────────────────

function _startSyncLoop() {
  if(_coopSyncTimer) return;
  function push() {
    if(!coopRole) return;
    if(coopRole === 'guest') {
      if(coopHostConn && coopHostConn.open) coopHostConn.send(_myState());
    } else if(coopRole === 'host') {
      const snapshot = _buildWorldSnapshot();
      for(const conn of coopGuestConns.values()) if(conn.open) conn.send(snapshot);
    }
    _coopSyncTimer = setTimeout(push, 50); // ~20 fps
  }
  push();
}

// ── END / LEAVE ───────────────────────────────────────────────────────────────

function endSession(silent=false) {
  if(!coopRole) return;
  if(_coopSyncTimer) { clearTimeout(_coopSyncTimer); _coopSyncTimer=null; }
  if(coopRole === 'host') {
    for(const conn of coopGuestConns.values()) {
      if(conn.open) conn.send({type:'end'});
      conn.close();
    }
    coopGuestConns.clear();
  } else if(coopRole === 'guest') {
    if(coopHostConn && coopHostConn.open) {
      coopHostConn.send({type:'leave'});
      coopHostConn.close();
    }
    coopHostConn = null;
  }
  if(coopPeer) { coopPeer.destroy(); coopPeer=null; }
  remotePlayers.clear();
  coopRole=null; coopRoomCode=null;
  if(!silent) log('Co-op session ended.', 'info');
  updateOnlineHUD();
  updateSessionPanel();
}

window.addEventListener('beforeunload', ()=> endSession(true));

// ── IN-GAME SESSION PANEL ─────────────────────────────────────────────────────

function toggleSessionPanel() {
  _sessionPanelVisible = !_sessionPanelVisible;
  document.getElementById('session-panel').style.display = _sessionPanelVisible ? 'block' : 'none';
  if(_sessionPanelVisible) updateSessionPanel();
}

function updateSessionPanel() {
  const panel = document.getElementById('session-panel-content');
  if(!panel) return;

  // Also update the HUD button label
  const btnWrap = document.getElementById('session-btn-wrap');
  const btnLabel = document.getElementById('session-btn-label');
  if(btnWrap) btnWrap.style.display = 'flex';
  _updateChatBtnVisibility();
  if(btnLabel) {
    if(coopRole === 'host')  btnLabel.textContent = `Host · ${remotePlayers.size} joined`;
    else if(coopRole === 'guest') btnLabel.textContent = 'Online';
    else btnLabel.textContent = 'Co-Op';
  }

  if(!_sessionPanelVisible) return;

  let html = '';

  if(!coopRole) {
    // Not in a session — offer start or join
    html = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button class="lobby-btn" onclick="toggleSessionPanel();startHostSessionInGame();" style="font-size:11px;padding:7px 0;">⚔ Host a Session</button>
        <div style="font-size:10px;color:var(--text-dim);text-align:center;">— or —</div>
        <input id="sp-join-input" class="lobby-input" maxlength="4" placeholder="Room Code"
               oninput="this.value=this.value.toUpperCase().replace(/[^A-Z]/g,'')"
               onkeydown="if(event.key==='Enter')joinSessionInGame()"
               style="text-align:center;font-size:14px;letter-spacing:4px;">
        <button class="lobby-btn" onclick="joinSessionInGame()" style="font-size:11px;padding:7px 0;">🌐 Join Session</button>
        <div id="sp-status" style="font-size:10px;color:var(--text-dim);text-align:center;min-height:14px;"></div>
      </div>`;
  } else if(coopRole === 'host') {
    const code = coopRoomCode || '—';
    const players = [...remotePlayers.values()];
    const pRows = players.map(rp => {
      const col = REMOTE_COLORS[rp.colorIdx]?.ring || '#aaa';
      return `<div style="font-size:11px;color:${col};padding:2px 0;">⚔ ${rp.name} <span style="color:var(--text-dim);font-size:10px;">${rp.hp}/${rp.maxHp} HP</span></div>`;
    }).join('');
    html = `
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px;">Room Code</div>
      <div style="font-size:22px;letter-spacing:6px;color:var(--gold);text-align:center;margin-bottom:8px;">${code}</div>
      <div style="font-size:10px;color:var(--text-dim);">Connected (${players.length}/3)</div>
      <div style="margin:6px 0 10px;">${pRows || '<div style="font-size:10px;color:var(--text-dim);">Waiting for players...</div>'}</div>
      <button class="lobby-btn" onclick="endSession()" style="font-size:11px;padding:7px 0;background:rgba(120,30,30,0.4);border-color:#8a3a3a;">✕ End Session</button>`;
  } else {
    // guest
    const players = [...remotePlayers.values()];
    const pRows = players.map(rp => {
      const col = REMOTE_COLORS[rp.colorIdx]?.ring || '#aaa';
      return `<div style="font-size:11px;color:${col};padding:2px 0;">⚔ ${rp.name} <span style="color:var(--text-dim);font-size:10px;">${rp.hp}/${rp.maxHp} HP</span></div>`;
    }).join('');
    html = `
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px;">Session: <span style="color:var(--gold);letter-spacing:2px;">${coopRoomCode}</span></div>
      <div style="margin:6px 0 10px;">${pRows || '<div style="font-size:10px;color:var(--text-dim);">Connecting...</div>'}</div>
      <button class="lobby-btn" onclick="endSession()" style="font-size:11px;padding:7px 0;background:rgba(120,30,30,0.4);border-color:#8a3a3a;">← Leave Session</button>`;
  }

  panel.innerHTML = html;
}

// Called when "Host a Session" is clicked from in-game panel
function startHostSessionInGame() {
  const btnWrap = document.getElementById('session-btn-wrap');
  if(btnWrap) btnWrap.style.display = 'flex';
  startHostSession(() => {
    _sessionPanelVisible = true;
    document.getElementById('session-panel').style.display = 'block';
    updateSessionPanel();
  });
}

// Called when "Join Session" is clicked from in-game panel
function joinSessionInGame() {
  const input = document.getElementById('sp-join-input');
  const code  = input ? input.value.trim().toUpperCase() : '';
  const status = document.getElementById('sp-status');
  if(code.length !== 4) { if(status) status.textContent='Enter a 4-letter code.'; return; }
  if(status) status.textContent = 'Connecting...';
  joinSession(code,
    () => { if(status) status.textContent=''; },
    (err) => { if(status) status.textContent=`Failed: ${err.type}`; }
  );
}

// ── LOBBY (title-screen flow) ─────────────────────────────────────────────────

function openCoopMenu() {
  document.getElementById('title-screen').style.display='none';
  document.getElementById('coop-menu').style.display='flex';
}
function closeCoopMenu() {
  document.getElementById('coop-menu').style.display='none';
}
function backFromCoopMenu() {
  document.getElementById('coop-menu').style.display='none';
  document.getElementById('title-screen').style.display='flex';
}

function lobbySetTab(tab) {
  document.getElementById('tab-host').classList.toggle('active', tab==='host');
  document.getElementById('tab-join').classList.toggle('active', tab==='join');
  document.getElementById('lobby-host-panel').style.display = tab==='host' ? '' : 'none';
  document.getElementById('lobby-join-panel').style.display = tab==='join'  ? '' : 'none';
}

function openOnlineLobby() {
  closeCoopMenu();
  // Reset state
  endSession(true);
  document.getElementById('online-lobby').style.display='flex';
  lobbySetTab('host');
  _resetLobbyUI();
}

function _resetLobbyUI() {
  document.getElementById('lobby-code-display').textContent = '—';
  document.getElementById('slot-p1-name').textContent = '—';
  document.getElementById('slot-p1').classList.remove('filled');
  ['p2','p3','p4'].forEach(id => {
    document.getElementById(`slot-${id}-name`).textContent = 'Waiting...';
    document.getElementById(`slot-${id}`).classList.remove('filled');
  });
  document.getElementById('lobby-host-status').textContent = 'Create your character to generate a room code.';
  document.getElementById('lobby-host-status').className = 'lobby-status waiting';
  const btn = document.getElementById('lobby-start-btn');
  btn.textContent = '⚔ Create Character & Host';
  btn.onclick = () => goToCharCreate('online-host');
}

function closeOnlineLobby() {
  endSession(true);
  document.getElementById('online-lobby').style.display='none';
  openCoopMenu();
}

// Called after character creation for the online host
function afterHostCharCreate() {
  const p = state.players[0];
  document.getElementById('char-create-screen').style.display='none';
  document.getElementById('online-lobby').style.display='flex';
  lobbySetTab('host');
  document.getElementById('slot-p1-name').textContent = p.name;
  document.getElementById('slot-p1').classList.add('filled');
  document.getElementById('lobby-host-status').textContent = '⏳ Setting up room...';
  document.getElementById('lobby-host-status').className = 'lobby-status waiting';
  const btn = document.getElementById('lobby-start-btn');
  btn.textContent = 'Waiting for players...';
  btn.onclick = onlineLobbyStart;

  startHostSession(code => {
    document.getElementById('lobby-code-display').textContent = code;
    document.getElementById('lobby-host-status').textContent = `✦ Room ready — share code: ${code}`;
    document.getElementById('lobby-host-status').className = 'lobby-status connected';
    btn.textContent = 'Start Adventure ⚔ (or wait for more)';
    btn.disabled = false;

    // Poll remotePlayers to update lobby slots
    const slotIds = ['p2','p3','p4'];
    function updateLobbySlots() {
      if(document.getElementById('online-lobby').style.display === 'none') return;
      const guests = [...remotePlayers.values()];
      slotIds.forEach((sid, i) => {
        const guest = guests[i];
        const el = document.getElementById(`slot-${sid}`);
        const nameEl = document.getElementById(`slot-${sid}-name`);
        if(guest) {
          el.classList.add('filled');
          nameEl.textContent = guest.name;
        } else {
          el.classList.remove('filled');
          nameEl.textContent = 'Waiting...';
        }
      });
      if(remotePlayers.size > 0) {
        document.getElementById('lobby-host-status').textContent =
          `✦ ${remotePlayers.size} player(s) joined. Start when ready!`;
        document.getElementById('lobby-host-status').className = 'lobby-status connected';
      }
      setTimeout(updateLobbySlots, 300);
    }
    updateLobbySlots();
  });
}

function onlineLobbyStart() {
  if(!coopRole) return;
  document.getElementById('online-lobby').style.display='none';
  beginOnlineGame();
}

function lobbyJoinRoom() {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  if(code.length!==4) { setJoinStatus('Enter a 4-letter code.','error'); return; }
  setJoinStatus('Connecting...','waiting');
  joinSession(code,
    () => {
      setJoinStatus('✦ Connected! Creating character...','connected');
      setTimeout(() => goToCharCreate('online-guest'), 600);
    },
    (err) => setJoinStatus(`Could not connect: ${err.type}`, 'error')
  );
}

function setJoinStatus(msg, cls) {
  const el = document.getElementById('lobby-join-status');
  if(el) { el.textContent=msg; el.className='lobby-status '+cls; }
}

// Called after character creation for a guest joining via lobby
function afterGuestCharCreate() {
  document.getElementById('char-create-screen').style.display='none';
  document.getElementById('online-lobby').style.display='flex';
  const p = state.players[0];
  lobbySetTab('host'); // reuse host panel layout
  document.getElementById('lobby-code-display').textContent = coopRoomCode;
  document.getElementById('slot-p1-name').textContent = '(Host)';
  document.getElementById('slot-p1').classList.add('filled');
  document.getElementById('slot-p2-name').textContent = p.name+' (You)';
  document.getElementById('slot-p2').classList.add('filled');
  document.getElementById('lobby-host-status').textContent = '✦ Joined! Waiting for host to start...';
  document.getElementById('lobby-host-status').className = 'lobby-status connected';
  document.getElementById('lobby-start-btn').style.display='none';

  // Host will send 'world' once game starts (guest sees it via data handler).
  // If the host navigates away or calls beginOnlineGame separately,
  // we start when a special 'start' message arrives.
  // For simplicity, the host calls onlineLobbyStart which hides the lobby on their side;
  // guests need a signal — we re-use the world sync.  Guest auto-starts after first world msg.
  if(coopHostConn) {
    const _origHandler = coopHostConn._dc ? coopHostConn._dc.onmessage : null;
    // Watch for host starting (first 'world' message means game is live)
    let _started = false;
    const _prevOnData = coopHostConn._events?.data?.[0];
    coopHostConn.on('data', function guestStartWatcher(data) {
      if(_started) return;
      if(data.type === 'world' || data.type === 'start') {
        _started = true;
        document.getElementById('online-lobby').style.display='none';
        beginOnlineGame();
      }
    });
  }
}

// ── BEGIN ONLINE GAME ─────────────────────────────────────────────────────────

function beginOnlineGame() {
  gameMode = 'online-' + coopRole;
  document.getElementById('game-container').style.display = 'flex';

  setTimeout(()=>{
    applyUIScale(uiScale);
    currentMap = makeZoneMap(0);
    spawnEnemiesFromMap(); spawnNpcsFromMap();
    const spawn = findSafeSpawn(5, Math.floor(MAP_H/2));
    playerPos = {x:spawn.x, y:spawn.y};
    playerReal= {x:spawn.x, y:spawn.y};
    camera.x  = Math.max(0, playerPos.x*TILE - canvas.width/2);
    camera.y  = Math.max(0, playerPos.y*TILE - canvas.height/2);
    patchItemIcons(); buildSkillsPanel(); buildInventory(); buildEquipPanel();
    wireInvContextMenu(); updateHUD();
    document.getElementById('zone-name').textContent = ZONES[0];
    const p = state.players[0];
    log(`Welcome, ${p.name}. You adventure online.`, 'gold');
    log('Right-click to interact · M for world map', 'info');
    Music.init(); SFX.init(); startAutoSave(); startHomeGrowthTick();
    initScaleSlider(); initPanelToggles(); gameLoop();
    window.addEventListener('resize',()=>{ applyUIScale(uiScale); Weather.initParticles(); });
    updateOnlineHUD();
    updateSessionPanel();
    // Show session button
    const btnWrap = document.getElementById('session-btn-wrap');
    if(btnWrap) btnWrap.style.display='flex';
  }, 100);
}

// ── ONLINE HUD (remote player bars) ──────────────────────────────────────────

function updateOnlineHUD() {
  const container = document.getElementById('rp-huds');
  if(!container) return;
  if(!isOnline() || remotePlayers.size === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  container.style.display = 'flex';
  container.innerHTML = '';
  for(const rp of remotePlayers.values()) {
    const col = REMOTE_COLORS[rp.colorIdx] || REMOTE_COLORS[0];
    const pct = rp.maxHp > 0 ? Math.round(rp.hp / rp.maxHp * 100) : 0;
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:5px;padding:0 8px;border-left:1px solid var(--border)';
    el.innerHTML = `
      <span style="font-family:'Cinzel',serif;font-size:9px;color:${col.ring};letter-spacing:0.5px;">
        ⚔ ${rp.name.substring(0,10)}
      </span>
      <div class="mini-bar hp-bar" style="width:60px">
        <div class="mini-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${col.body},${col.ring})"></div>
      </div>
      <span style="font-size:10px;color:var(--text-dim);">${rp.hp}/${rp.maxHp}</span>`;
    container.appendChild(el);
  }
  updateSessionPanel();
}

function showOnlineBadge() {
  if(document.getElementById('online-badge-hud')) return;
  const badge = document.createElement('span');
  badge.id = 'online-badge-hud';
  badge.className = 'online-badge';
  badge.innerHTML = '<span class="ping-dot"></span>ONLINE';
  const bw = document.querySelector('.bar-wrap');
  if(bw) bw.appendChild(badge);
}

// ── CHAT ─────────────────────────────────────────────────────────────────────

let _chatUnread = 0;
let _chatOpen   = false;

function broadcastChat(text) {
  if(!coopRole || !text.trim()) return;
  const name = state.players[0].name || 'Adventurer';
  const msg = { type:'chat', name, text: text.trim() };
  _appendChatMsg(name, text.trim()); // show locally immediately
  if(coopRole === 'guest') {
    if(coopHostConn && coopHostConn.open) coopHostConn.send(msg);
  } else if(coopRole === 'host') {
    for(const conn of coopGuestConns.values()) if(conn.open) conn.send(msg);
  }
}

function _appendChatMsg(name, text) {
  const box = document.getElementById('chat-messages');
  if(!box) return;
  const row = document.createElement('div');
  row.className = 'chat-msg';
  row.innerHTML = `<span class="chat-name">${_escHtml(name)}</span>: ${_escHtml(text)}`;
  box.appendChild(row);
  // Keep a max of 100 messages
  while(box.children.length > 100) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;

  if(!_chatOpen) {
    _chatUnread++;
    const badge = document.getElementById('chat-badge');
    if(badge) { badge.style.display = 'block'; badge.textContent = _chatUnread > 9 ? '9+' : _chatUnread; }
  }
}

function _chatSystemMsg(text) {
  const box = document.getElementById('chat-messages');
  if(!box) return;
  const row = document.createElement('div');
  row.className = 'chat-msg chat-system';
  row.textContent = text;
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function _escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function toggleChatPanel() {
  const panel = document.getElementById('chat-panel');
  if(!panel) return;
  _chatOpen = !_chatOpen;
  panel.classList.toggle('open', _chatOpen);
  if(_chatOpen) {
    _chatUnread = 0;
    const badge = document.getElementById('chat-badge');
    if(badge) badge.style.display = 'none';
    const inp = document.getElementById('chat-input');
    if(inp) inp.focus();
    const box = document.getElementById('chat-messages');
    if(box) box.scrollTop = box.scrollHeight;
  }
}

function sendChatMessage() {
  const inp = document.getElementById('chat-input');
  if(!inp || !inp.value.trim()) return;
  broadcastChat(inp.value.trim());
  inp.value = '';
}

function chatInsertEmoji(emoji) {
  const inp = document.getElementById('chat-input');
  if(!inp) return;
  const pos = inp.selectionStart ?? inp.value.length;
  inp.value = inp.value.slice(0, pos) + emoji + inp.value.slice(pos);
  inp.selectionStart = inp.selectionEnd = pos + emoji.length;
  inp.focus();
}

// Show/hide the chat button alongside the session button
function _updateChatBtnVisibility() {
  const wrap = document.getElementById('chat-btn-wrap');
  if(wrap) wrap.style.display = isOnline() ? 'flex' : 'none';
}
// Patch endSession to also close chat and clear state
const _origEndSession = endSession;
// Note: endSession is already defined above; hook visibility updates into updateSessionPanel instead
