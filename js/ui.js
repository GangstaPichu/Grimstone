// ======= VERSION DISPLAY =======
document.addEventListener('DOMContentLoaded', () => {
  const tv = document.getElementById('title-version');
  if(tv) tv.textContent = `v${GAME_VERSION}`;
});

// ======= CANVAS SETUP & UI SCALING =======
let uiScale = parseFloat(localStorage.getItem('grimstone_ui_scale') || '1');

function applyUIScale(scale) {
  uiScale = Math.min(1.3, Math.max(0.6, scale));
  const container = document.getElementById('game-container');
  if(!container) return;
  container.style.transform = `scale(${uiScale})`;
  // When scaled down, the container needs to fill viewport without scrollbars
  // We size the container as if it were full 100vw/100vh, then scale it
  container.style.width  = (100 / uiScale) + 'vw';
  container.style.height = (100 / uiScale) + 'vh';
  container.style.transformOrigin = 'top left';
  resizeCanvas();
  localStorage.setItem('grimstone_ui_scale', uiScale);
}

function resizeCanvas(){
  const cont = document.getElementById('map-container');
  if(!cont) return;
  const r = cont.getBoundingClientRect();
  // getBoundingClientRect returns scaled coords — divide by uiScale to get true pixels
  canvas.width  = Math.round(r.width  / uiScale);
  canvas.height = Math.round(r.height / uiScale);
}

function initPanelToggles() {
  // ── Skills panel (left side) ────────────────────────────────────
  const skillsPanel     = document.getElementById('skills-panel');
  const skillsToggleBtn = document.getElementById('skills-toggle-btn');
  const skillsExpandBtn = document.getElementById('skills-expand-btn');

  function applySkillsState(collapsed) {
    skillsPanel.classList.toggle('collapsed', collapsed);
    // ◀ = visible (click to collapse left), ▶ = collapsed (click to expand right)
    skillsToggleBtn.textContent = collapsed ? '▶' : '◀';
    localStorage.setItem('grimstone_skills_collapsed', collapsed ? '1' : '0');
  }
  function toggleSkills() {
    const nowCollapsed = !skillsPanel.classList.contains('collapsed');
    applySkillsState(nowCollapsed);
    setTimeout(() => applyUIScale(uiScale), 230);
  }
  skillsToggleBtn.addEventListener('click', toggleSkills);
  skillsExpandBtn.addEventListener('click', toggleSkills);
  applySkillsState(localStorage.getItem('grimstone_skills_collapsed') === '1');

  // ── Right panels (right side) ───────────────────────────────────
  const rightPanels  = document.getElementById('right-panels');
  const invToggleBtn = document.getElementById('inv-toggle-btn');
  const invExpandBtn = document.getElementById('inv-expand-btn');

  function applyInvState(collapsed) {
    rightPanels.classList.toggle('collapsed', collapsed);
    // ▶ = visible (click to collapse right), ◀ = collapsed (click to expand left)
    invToggleBtn.textContent = collapsed ? '◀' : '▶';
    localStorage.setItem('grimstone_inv_collapsed', collapsed ? '1' : '0');
  }
  function toggleInv() {
    const nowCollapsed = !rightPanels.classList.contains('collapsed');
    applyInvState(nowCollapsed);
    setTimeout(() => applyUIScale(uiScale), 230);
  }
  invToggleBtn.addEventListener('click', toggleInv);
  invExpandBtn.addEventListener('click', toggleInv);
  applyInvState(localStorage.getItem('grimstone_inv_collapsed') === '1');
}

function initScaleSlider() {
  const slider = document.getElementById('ui-scale-slider');
  const label  = document.getElementById('ui-scale-label');
  if(!slider) return;
  slider.value = Math.round(uiScale * 100);
  label.textContent = slider.value + '%';
  applyUIScale(uiScale);
  slider.addEventListener('input', () => {
    const s = parseInt(slider.value) / 100;
    label.textContent = slider.value + '%';
    applyUIScale(s);
  });

  function stepScale(delta) {
    const next = Math.min(130, Math.max(60, parseInt(slider.value) + delta));
    slider.value = next;
    label.textContent = next + '%';
    applyUIScale(next / 100);
  }
  const minusBtn = document.getElementById('ui-scale-minus');
  const plusBtn  = document.getElementById('ui-scale-plus');
  if(minusBtn) minusBtn.addEventListener('click', () => stepScale(-5));
  if(plusBtn)  plusBtn.addEventListener('click',  () => stepScale(+5));

  // SFX volume slider
  const sfxSlider = document.getElementById('sfx-vol-slider');
  if(sfxSlider) {
    const saved = parseFloat(localStorage.getItem('grimstone_sfx_vol') ?? '0.6');
    sfxSlider.value = Math.round(saved * 100);
    SFX.setVol(saved);
    sfxSlider.addEventListener('input', () => {
      const v = parseInt(sfxSlider.value) / 100;
      SFX.setVol(v);
      localStorage.setItem('grimstone_sfx_vol', v);
    });
  }
}

// ======= START GAME =======
function startGame(mode) {
  gameMode = mode;
  document.getElementById('game-container').style.display='flex';
  if(mode==='coop'){
    document.getElementById('co-op-indicator').style.display='block';
    document.getElementById('p2-hud').style.display='flex';
    // P2 was already created in beginAdventure — just ensure slot exists as fallback
    if(state.players.length<2){
      state.players.push({
        name:'Champion', hp:30, maxHp:30, gold:0,
        skills: JSON.parse(JSON.stringify(state.players[0].skills)),
        inventory: Array(28).fill(null),
        appearance:{ skinIdx:1, hairColorIdx:2, hairStyleIdx:1, classId:'warrior' },
      });
    }
  }
  setTimeout(()=>{
    applyUIScale(uiScale);
    currentMap = makeZoneMap(zoneIndex);
    spawnEnemiesFromMap();
    spawnNpcsFromMap();
    const spawn = findSafeSpawn(5, Math.floor(MAP_H/2));
    playerPos = {x:spawn.x, y:spawn.y};
    playerReal = {x:spawn.x, y:spawn.y};
    // P2 spawns one tile to the right of P1
    p2Pos = {x:spawn.x+1, y:spawn.y};
    p2Real = {x:spawn.x+1, y:spawn.y};
    camera.x = Math.max(0, playerPos.x*TILE - canvas.width/2);
    camera.y = Math.max(0, playerPos.y*TILE - canvas.height/2);
    patchItemIcons();
    buildSkillsPanel();
    buildInventory();
    buildEquipPanel();
    wireInvContextMenu();
    updateHUD();
    updateP2HUD();
    document.getElementById('zone-name').textContent=ZONES[zoneIndex];
    const p=state.players[0];
    const p2=state.players[1];
    log(`Welcome to Ashenveil, ${p.name}. Find the eastern road to begin your journey.`,'gold');
    if(mode==='coop') log(`${p2?.name||'Player 2'} joins the adventure!`,'gold');
    log('Right-click on resources, buildings or enemies to interact.','info');
    Music.init();
    SFX.init();
    Weather.initParticles();
    Fireflies.init();
    startAutoSave();
    startHomeGrowthTick();
    // Show Co-Op session button for all game modes (can start/join at any time)
    const sbw = document.getElementById('session-btn-wrap');
    if(sbw) sbw.style.display = 'flex';
    if(mode==='coop') {
      document.getElementById('p2-hud').style.display='flex';
    }
    initScaleSlider(); initPanelToggles();
    const hv = document.getElementById('hud-version');
    if(hv) hv.textContent = `v${GAME_VERSION}`;
    gameLoop();
    window.addEventListener('resize',()=>{ applyUIScale(uiScale); Weather.initParticles(); });
  },100);
}

function startGameFromSave(savedPos) {
  document.getElementById('game-container').style.display='flex';
  if(gameMode==='coop') document.getElementById('co-op-indicator').style.display='block';
  setTimeout(()=>{
    applyUIScale(uiScale);
    currentMap = makeZoneMap(zoneIndex);
    spawnEnemiesFromMap();
    spawnNpcsFromMap();
    // Try to use saved position, fallback to safe spawn
    const sp = savedPos || findSafeSpawn(5, Math.floor(MAP_H/2));
    const spawn = findSafeSpawn(sp.x, sp.y);
    playerPos = {x:spawn.x, y:spawn.y};
    playerReal = {x:spawn.x, y:spawn.y};
    camera.x = Math.max(0, playerPos.x*TILE - canvas.width/2);
    camera.y = Math.max(0, playerPos.y*TILE - canvas.height/2);
    patchItemIcons();
    buildSkillsPanel();
    buildInventory();
    buildEquipPanel();
    wireInvContextMenu();
    updateHUD();
    document.getElementById('zone-name').textContent=ZONES[zoneIndex];
    const p=state.players[0];
    log(`Welcome back, ${p.name}. You are in ${ZONES[zoneIndex]}.`,'gold');
    Music.init();
    SFX.init();
    Weather.initParticles();
    Fireflies.init();
    startAutoSave();
    startHomeGrowthTick();
    const sbw2 = document.getElementById('session-btn-wrap');
    if(sbw2) sbw2.style.display = 'flex';
    initScaleSlider(); initPanelToggles();
    const hv2 = document.getElementById('hud-version');
    if(hv2) hv2.textContent = `v${GAME_VERSION}`;
    gameLoop();
    window.addEventListener('resize',()=>{ applyUIScale(uiScale); Weather.initParticles(); });
  },100);
}

// ======= HUD =======
const _hudCache = { name:'', cb:-1, gold:-1, hp:-1, maxHp:-1 };
function updateHUD(){
  const p = state.players[state.activePlayer];
  const atk=p.skills.Attack.lvl, def=p.skills.Defence.lvl, str=p.skills.Strength.lvl, hpLvl=p.skills.Hitpoints.lvl;
  const cb = Math.floor((atk+def+str+hpLvl)/4);
  // Only touch DOM when values actually change
  if(p.name !== _hudCache.name){ document.getElementById('player-name-hud').textContent=p.name; _hudCache.name=p.name; }
  if(cb    !== _hudCache.cb)   { document.getElementById('combat-lvl-hud').textContent=cb;      _hudCache.cb=cb; }
  if(p.gold !== _hudCache.gold){ document.getElementById('gold-hud').textContent=p.gold;        _hudCache.gold=p.gold; }
  if(p.hp !== _hudCache.hp || p.maxHp !== _hudCache.maxHp){
    document.getElementById('hp-bar-fill').style.width=(p.hp/p.maxHp*100)+'%';
    document.getElementById('hp-text').textContent=p.hp+'/'+p.maxHp;
    _hudCache.hp=p.hp; _hudCache.maxHp=p.maxHp;
  }
}

function updateP2HUD() {
  // Only for local split-screen coop
  if(gameMode !== 'coop' || state.players.length < 2) return;
  const p2 = state.players[1];
  document.getElementById('p2-name-hud').textContent = p2.name;
  document.getElementById('p2-hp-bar-fill').style.width = (p2.hp / p2.maxHp * 100) + '%';
  document.getElementById('p2-hp-text').textContent = p2.hp + '/' + p2.maxHp;
  document.getElementById('p2-hud').style.display = 'flex';
}

// ======= SKILLS PANEL =======

// ======= SKILL INFO DESCRIPTIONS =======
const SKILL_INFO = {
  Mining: {
    icon: '⛏',
    desc: 'Allows you to mine ore from rock nodes across the world.',
    benefits: [
      [1,  'Can mine Copper ore.'],
      [15, 'Can mine Iron ore.'],
      [30, 'Can mine Coal.'],
      [40, 'Can mine Gold ore.'],
      [55, 'Can mine Mithril ore.'],
    ],
  },
  Smithing: {
    icon: '🔨',
    desc: 'Lets you smelt ores into bars and forge equipment at a smithy.',
    benefits: [
      [1,  'Can smelt Copper bars.'],
      [15, 'Can smelt Iron bars.'],
      [30, 'Can smelt Steel bars.'],
      [50, 'Can smelt Mithril bars.'],
    ],
  },
  Woodcutting: {
    icon: '🪓',
    desc: 'Lets you chop trees to gather logs for fuel and crafting.',
    benefits: [
      [1,  'Can chop Normal trees.'],
      [20, 'Can chop Oak trees.'],
      [35, 'Can chop Willow trees.'],
    ],
  },
  Crafting: {
    icon: '🪡',
    desc: 'Used to fashion hides and materials into armour and tools.',
    benefits: [
      [1,  'Can craft basic leather armour.'],
      [20, 'Can craft reinforced leather gear.'],
      [40, 'Unlocks advanced crafting recipes.'],
    ],
  },
  Fishing: {
    icon: '🎣',
    desc: 'Lets you catch fish from rivers and docks to cook and eat.',
    benefits: [
      [1,  'Can fish at any fishing spot.'],
      [20, 'Increased catch rate.'],
      [40, 'Can catch rarer fish varieties.'],
    ],
  },
  Cooking: {
    icon: '🍖',
    desc: 'Lets you cook raw food over a fire to restore health when eaten.',
    benefits: [
      [1,  'Can cook basic food. Some food burns.'],
      [20, 'Rarely burn food. Better healing.'],
      [40, 'Never burn food. Full healing bonus.'],
    ],
  },
  Farming: {
    icon: '🌾',
    desc: 'Governs harvesting crops and gathering produce from farm animals.',
    benefits: [
      [1,  'Can harvest wheat and turnips. Catch chickens and pigs.'],
      [20, 'Animals less likely to evade. Crops yield more.'],
      [40, 'Master farmer. Full yield, animals rarely flee.'],
    ],
  },
  Attack: {
    icon: '⚔',
    desc: 'Improves your accuracy in combat, making hits land more reliably.',
    benefits: [
      [1,  'Base accuracy in combat.'],
      [10, 'Can equip Bronze weapons.'],
      [20, 'Can equip Iron weapons.'],
      [30, 'Can equip Steel weapons.'],
      [50, 'Can equip Mithril weapons.'],
    ],
  },
  Defence: {
    icon: '🛡',
    desc: 'Reduces damage taken from enemies. Higher levels absorb more hits.',
    benefits: [
      [1,  'Base damage reduction.'],
      [10, 'Can equip Bronze armour.'],
      [20, 'Can equip Iron armour.'],
      [30, 'Can equip Steel armour.'],
      [50, 'Can equip Mithril armour.'],
    ],
  },
  Strength: {
    icon: '💪',
    desc: 'Increases the maximum damage you deal with melee attacks.',
    benefits: [
      [1,  'Base melee damage.'],
      [10, '+2 max hit bonus.'],
      [20, '+4 max hit bonus.'],
      [30, '+6 max hit bonus. Enemies notice you.'],
      [50, '+10 max hit bonus.'],
    ],
  },
  Hitpoints: {
    icon: '❤',
    desc: 'Your total health. Increases your maximum HP as it levels up.',
    benefits: [
      [1,  'Base HP pool (10 HP).'],
      [10, 'HP increases to 20.'],
      [20, 'HP increases to 30.'],
      [30, 'HP increases to 40.'],
      [40, 'HP increases to 50.'],
      [50, 'HP increases to 60.'],
    ],
  },
};

function buildSkillsPanel(){
  const p = state.players[state.activePlayer];
  const list = document.getElementById('skills-list');
  list.innerHTML='';
  Object.entries(p.skills).forEach(([name,sk])=>{
    const d=document.createElement('div');
    d.className='skill-entry'; d.id='skill-'+name;
    const needed=xpForLevel(sk.lvl+1)-xpForLevel(sk.lvl);
    const progress=((sk.xp-xpForLevel(sk.lvl))/(needed))*100;
    d.innerHTML=`<div class="skill-name"><span>${name}</span><span class="skill-lvl">${sk.lvl}</span></div>
      <div class="skill-xp-bar"><div class="skill-xp-fill" style="width:${Math.min(100,progress)}%"></div></div>`;
    d.addEventListener('click', ()=>showSkillTooltip(name, d));
    list.appendChild(d);
  });

  // Close tooltip when clicking outside skills panel
  if(!list._skillTipWired) {
    list._skillTipWired = true;
    document.addEventListener('click', e=>{
      if(!e.target.closest('#skills-panel')) hideSkillTooltip();
    });
  }
}

function showSkillTooltip(name, entryEl) {
  const p = state.players[state.activePlayer];
  const sk = p.skills[name];
  const info = SKILL_INFO[name];
  const tip = document.getElementById('skill-tooltip');
  if(!info) return;

  // Toggle off if same skill clicked again
  if(tip._current === name && tip.style.display !== 'none') {
    hideSkillTooltip();
    document.querySelectorAll('.skill-entry').forEach(e=>e.classList.remove('active'));
    return;
  }
  tip._current = name;

  // Find next milestone
  const nextMilestone = info.benefits.find(([lvl])=>lvl > sk.lvl);

  let milestonesHtml = '';
  info.benefits.forEach(([lvl, text]) => {
    const unlocked = sk.lvl >= lvl;
    const isNext = nextMilestone && lvl === nextMilestone[0];
    const cls = isNext ? 'next' : (unlocked ? 'unlocked' : 'locked');
    const prefix = unlocked ? '✓' : (isNext ? '▶' : '·');
    milestonesHtml += `<div class="stt-milestone ${cls}">
      <span class="stt-lvl">Lv ${lvl}</span>
      <span>${prefix} ${text}</span>
    </div>`;
  });

  const xpToNext = xpForLevel(sk.lvl+1) - sk.xp;

  tip.innerHTML = `
    <div class="stt-header">
      <span>${info.icon}</span>
      <span>${name}</span>
      <span style="margin-left:auto;font-size:11px;opacity:0.6">Lv ${sk.lvl}</span>
    </div>
    <div class="stt-desc">${info.desc}</div>
    <div style="font-size:11px;color:#6a8a50;margin-bottom:8px;">
      ${sk.lvl < 99 ? `${xpToNext.toLocaleString()} xp to level ${sk.lvl+1}` : 'Max level reached!'}
    </div>
    <div class="stt-milestones">${milestonesHtml}</div>`;

  // Position tooltip to the right of the skills panel, aligned with clicked entry
  const panelRect  = document.getElementById('skills-panel').getBoundingClientRect();
  const entryRect  = entryEl.getBoundingClientRect();
  const viewH      = window.innerHeight;

  tip.style.display = 'block';

  // Horizontal: just to the right of the panel
  tip.style.left = (panelRect.right + 6) + 'px';

  // Vertical: align top with clicked entry, but clamp so it doesn't go off-screen
  const tipH   = tip.offsetHeight || 320;
  let topPos   = entryRect.top;
  if(topPos + tipH > viewH - 8) topPos = viewH - tipH - 8;
  if(topPos < 8) topPos = 8;
  tip.style.top = topPos + 'px';

  document.querySelectorAll('.skill-entry').forEach(e=>e.classList.remove('active'));
  entryEl.classList.add('active');
}

function hideSkillTooltip() {
  const tip = document.getElementById('skill-tooltip');
  if(tip) { tip.style.display='none'; tip._current=null; }
}
function updateSkillDisplay(skillName){
  const p = state.players[state.activePlayer];
  const sk = p.skills[skillName];
  const el=document.getElementById('skill-'+skillName);
  if(!el)return;
  const needed=xpForLevel(sk.lvl+1)-xpForLevel(sk.lvl);
  const progress=((sk.xp-xpForLevel(sk.lvl))/(needed))*100;
  el.querySelector('.skill-lvl').textContent=sk.lvl;
  el.querySelector('.skill-xp-fill').style.width=Math.min(100,progress)+'%';
}
function xpForLevel(lvl){
  if(lvl<=1)return 0;
  if(lvl-1<SKILL_XP_TABLE.length) return SKILL_XP_TABLE[lvl-1];
  return SKILL_XP_TABLE[SKILL_XP_TABLE.length-1]*(lvl-SKILL_XP_TABLE.length+1);
}

// ======= EQUIPMENT =======
const EQUIP_SLOTS = [
  {key:'weapon', label:'Weapon',  empty:'—'},
  {key:'shield', label:'Shield',  empty:'—'},
  {key:'head',   label:'Head',    empty:'—'},
  {key:'body',   label:'Body',    empty:'—'},
  {key:'legs',   label:'Legs',    empty:'—'},
  {key:'ammo',   label:'Ammo',    empty:'—'},
];

function getEquipment(p) {
  if(!p.equipment) p.equipment = {weapon:null,shield:null,head:null,body:null,legs:null,ammo:null};
  return p.equipment;
}

// Magic shield: active defence boost from Shield Rune (expires by timestamp)
let magicShieldExpiry = 0;

function getEquipBonuses(p) {
  const eq = getEquipment(p);
  let attackBonus=0, strBonus=0, defBonus=0, magicBonus=0;
  for(const slot of Object.values(eq)) {
    if(!slot) continue;
    const it = ITEMS[slot];
    if(!it) continue;
    attackBonus += it.attackBonus||0;
    strBonus    += it.strBonus||0;
    defBonus    += it.defBonus||0;
    magicBonus  += it.magicBonus||0;
  }
  // Magic shield rune active?
  if(magicShieldExpiry > Date.now()) defBonus += 8;
  return {attackBonus, strBonus, defBonus, magicBonus};
}

function buildEquipPanel() {
  const p = state.players[state.activePlayer];
  const eq = getEquipment(p);
  const container = document.getElementById('equip-slots');
  if(!container) return;
  container.innerHTML = '';
  const bonuses = getEquipBonuses(p);

  EQUIP_SLOTS.forEach(({key, label, empty}) => {
    const itemId = eq[key];
    const it = itemId ? ITEMS[itemId] : null;
    const div = document.createElement('div');
    div.className = 'equip-slot' + (itemId ? ' filled' : '');
    div.title = it ? it.name : label+' (empty)';
    div.innerHTML = `
      <span class="equip-slot-label">${label}</span>
      <span class="equip-slot-icon">${it ? (it.icon.startsWith('<img') ? it.icon.replace('item-sprite','equip-slot-sprite') : it.icon) : empty}</span>
      ${it ? `<span class="equip-slot-name">${it.name.split(' ').slice(-1)[0]}</span>` : ''}
      ${it && (it.attackBonus||it.strBonus||it.defBonus) ? `<span class="equip-slot-stat">${
        it.attackBonus ? `+${it.attackBonus}atk` : it.defBonus ? `+${it.defBonus}def` : `+${it.strBonus}str`
      }</span>` : ''}
    `;
    if(itemId) {
      div.addEventListener('click', () => unequipItem(key));
      div.title = `${it.name} — click to unequip`;
    }
    container.appendChild(div);
  });

  // Show total bonuses in panel header
  const header = document.querySelector('#equip-panel .panel-header');
  if(header) {
    const parts = [];
    if(bonuses.attackBonus) parts.push(`+${bonuses.attackBonus} Atk`);
    if(bonuses.strBonus)    parts.push(`+${bonuses.strBonus} Str`);
    if(bonuses.defBonus)    parts.push(`+${bonuses.defBonus} Def`);
    header.textContent = 'Equipment' + (parts.length ? '  (' + parts.join(', ') + ')' : '');
  }
}

function equipItem(slotIdx) {
  const p = state.players[state.activePlayer];
  const eq = getEquipment(p);
  const invItem = p.inventory[slotIdx];
  if(!invItem) return;
  const it = ITEMS[invItem.id];
  if(!it || !it.slot) { log(`Can't equip ${it ? it.name : 'that'}.`, 'bad'); return; }
  const slot = it.slot;

  // If something already equipped in that slot, swap it to inventory
  if(eq[slot]) {
    const old = eq[slot];
    p.inventory[slotIdx] = {id:old, qty:1};
    log(`Unequipped ${ITEMS[old].name}.`);
  } else {
    p.inventory[slotIdx] = null;
  }
  eq[slot] = invItem.id;
  SFX.equip();
  log(`Equipped ${it.name}. ${it.attackBonus?`(+${it.attackBonus} Attack)`:it.defBonus?`(+${it.defBonus} Defence)`:``}`, 'good');
  buildInventory();
  buildEquipPanel();
}

function unequipItem(slot) {
  const p = state.players[state.activePlayer];
  const eq = getEquipment(p);
  const itemId = eq[slot];
  if(!itemId) return;
  if(addToInventory(itemId, 1)) {
    eq[slot] = null;
    log(`Unequipped ${ITEMS[itemId].name}.`);
    buildInventory(); buildEquipPanel();
  } else {
    log('Inventory full — can\'t unequip.', 'bad');
  }
}

// ======= INVENTORY =======
function buildInventory(){
  const p = state.players[state.activePlayer];
  const grid = document.getElementById('inv-grid');
  grid.innerHTML='';
  let count=0;
  p.inventory.forEach((item,i)=>{
    const slot=document.createElement('div');
    slot.className='inv-slot'+(item?' has-item':'');
    slot.dataset.slot=i;
    if(item){
      const it=ITEMS[item.id];
      slot.innerHTML=`<span class="item-icon">${it.icon}</span><span class="item-name">${it.name.length>10?it.name.split(' ')[0]:it.name}</span>${item.qty>1?`<span class="item-count">${item.qty}</span>`:''}`;
      count++;
    }
    grid.appendChild(slot);
  });
  document.getElementById('inv-count').textContent=count;
}

// Delegated listeners — wired once in wireInvContextMenu()
function wireInvContextMenu() {
  const grid = document.getElementById('inv-grid');
  if(!grid || grid._ctxWired) return;
  grid._ctxWired = true;

  // LEFT CLICK — show action menu
  grid.addEventListener('click', e => {
    const slot = e.target.closest('.inv-slot');
    if(!slot) return;
    const i = parseInt(slot.dataset.slot);
    const p = state.players[state.activePlayer];
    if(p && p.inventory[i]) showInvCtxMenu(e, i);
  });

  // RIGHT CLICK — instant equip if gear, otherwise show menu
  grid.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    const slot = e.target.closest('.inv-slot');
    if(!slot) return;
    const i = parseInt(slot.dataset.slot);
    const p = state.players[state.activePlayer];
    if(!p || !p.inventory[i]) return;
    const it = ITEMS[p.inventory[i].id];
    if(it && it.slot) {
      // Gear — equip instantly, no menu
      equipItem(i);
    } else {
      // Non-gear — show action menu
      showInvCtxMenu(e, i);
    }
  });
}
function addToInventory(itemId, qty=1){
  const p = state.players[state.activePlayer];
  // Try stack
  for(let i=0;i<28;i++){
    if(p.inventory[i]&&p.inventory[i].id===itemId){
      p.inventory[i].qty+=qty;
      return true;
    }
  }
  // Empty slot
  for(let i=0;i<28;i++){
    if(!p.inventory[i]){
      p.inventory[i]={id:itemId,qty};
      return true;
    }
  }
  log('Inventory full!','bad');
  return false;
}
function countInInventory(itemId){
  const p = state.players[state.activePlayer];
  let c=0;
  p.inventory.forEach(s=>{ if(s&&s.id===itemId)c+=s.qty; });
  return c;
}
function removeFromInventory(itemId, qty=1){
  const p = state.players[state.activePlayer];
  for(let i=0;i<28;i++){
    if(p.inventory[i]&&p.inventory[i].id===itemId){
      p.inventory[i].qty-=qty;
      if(p.inventory[i].qty<=0) p.inventory[i]=null;
      return true;
    }
  }
  return false;
}

// ======= LOG =======
function log(msg, type=''){
  const el=document.getElementById('log-messages');
  const d=document.createElement('div');
  d.className='log-msg '+type;
  d.textContent=msg;
  el.appendChild(d);
  while(el.children.length>80) el.removeChild(el.firstChild);
  el.scrollTop=el.scrollHeight;
}

// ======= WORLD MAP =======
const WORLD_ZONES = [
  {
    id: ['STORMCRAG REACH'],
    label: 'Stormcrag Reach', sub: 'Mountain Keep',
    x:265, y:25, w:170, h:58, color:'#2e3a47', border:'#607898',
  },
  {
    id: ['FORSAKEN CHAPEL','THE FORSAKEN CHAPEL'],
    label: 'Forsaken Chapel', sub: 'Cursed Grounds',
    x:265, y:128, w:170, h:58, color:'#271630', border:'#7040a0',
  },
  {
    id: ['GREENFIELD','GREENFIELD PASTURES'],
    label: 'Greenfield', sub: 'Pastures & Farm',
    x:55,  y:228, w:158, h:58, color:'#182e14', border:'#3a8c30',
  },
  {
    id: ['ASHENVEIL'],
    label: 'Ashenveil', sub: 'Starting Town',
    x:258, y:228, w:184, h:58, color:'#2e1e0e', border:'#c8921a', isMain:true,
  },
  {
    id: ['WHISPERWOOD','THE WHISPERWOOD'],
    label: 'The Whisperwood', sub: 'Ancient Forest',
    x:487, y:228, w:158, h:58, color:'#0e1e0e', border:'#407830',
  },
  {
    id: ['ASHWOOD','IRON PEAKS','IRON DEPTHS','CATACOMBS','CRYPTS','DUNGEON','VALE'],
    label: 'Dungeon Depths', sub: 'Perilous Below',
    x:258, y:378, w:184, h:58, color:'#111116', border:'#505060',
  },
  {
    id: ['YOUR HOMESTEAD'],
    label: 'Your Homestead', sub: 'Personal Plot',
    x:487, y:378, w:158, h:58, color:'#1a2e10', border:'#6aaa30',
  },
];

// Path connections between zone centres [x1,y1, x2,y2]
const MAP_PATHS = [
  [350, 83,  350, 128],   // Stormcrag → Chapel
  [350, 186, 350, 228],   // Chapel → Ashenveil
  [213, 257, 258, 257],   // Greenfield → Ashenveil
  [442, 257, 487, 257],   // Ashenveil → Whisperwood
  [350, 286, 350, 378],   // Ashenveil → Dungeons
  [442, 407, 487, 407],   // Ashenveil → Homestead (via sigil)
];

function drawWorldMap() {
  const canvas = document.getElementById('world-map-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Background
  ctx.fillStyle = '#060810';
  ctx.fillRect(0, 0, W, H);

  // Faint grid texture
  ctx.strokeStyle = 'rgba(90,70,30,0.12)';
  ctx.lineWidth = 1;
  for(let x = 0; x < W; x += 22) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y = 0; y < H; y += 22) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  const curName = (currentMap && currentMap.name) ? currentMap.name.toUpperCase() : '';

  // Paths
  ctx.strokeStyle = 'rgba(180,140,50,0.45)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  MAP_PATHS.forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Zones
  WORLD_ZONES.forEach(zone => {
    const active = zone.id.some(id => curName.includes(id) || id.includes(curName));

    // Fill
    ctx.fillStyle = zone.color;
    if(active) {
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 18;
    }
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = active ? '#ffd700' : zone.border;
    ctx.lineWidth = active ? 2.5 : 1.5;
    ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);

    // Zone name
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#ffd700' : '#c8a870';
    ctx.font = `${active ? 'bold ' : ''}13px Cinzel, serif`;
    ctx.fillText(zone.label, zone.x + zone.w / 2, zone.y + zone.h / 2 + 1);

    // Sub-label
    ctx.fillStyle = active ? 'rgba(255,215,0,0.7)' : 'rgba(160,130,80,0.6)';
    ctx.font = '10px Cinzel, serif';
    ctx.fillText(zone.sub, zone.x + zone.w / 2, zone.y + zone.h / 2 + 17);

    // Player marker
    if(active) {
      ctx.fillStyle = '#ffd700';
      ctx.font = '13px serif';
      ctx.fillText('▲ YOU ARE HERE', zone.x + zone.w / 2, zone.y + zone.h / 2 - 13);
    }
  });

  // Interior zones note at bottom
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(160,130,80,0.5)';
  ctx.font = '10px Cinzel, serif';
  ctx.fillText('Interiors: The Tarnished Flagon · Grimward\'s Smithy · Wizard Tower · Dungeon Floors', W / 2, H - 12);
}

function toggleWorldMap() {
  const overlay = document.getElementById('world-map-overlay');
  if(!overlay) return;
  const isOpen = overlay.classList.contains('show');
  if(isOpen) {
    overlay.classList.remove('show');
  } else {
    drawWorldMap();
    overlay.classList.add('show');
  }
}

// ======= TOOL MODE =======
function setMode(m){
  currentTool=m;
  ['mine','chop','fish','combat'].forEach(t=>document.getElementById('btn-'+t).classList.remove('active'));
  document.getElementById('btn-'+m).classList.add('active');
  const names={'mine':'Mining Mode','chop':'Woodcutting Mode','fish':'Fishing Mode','combat':'Combat Mode'};
  log(names[m]+' activated.','info');
}

