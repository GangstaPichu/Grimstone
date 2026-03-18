// ======= VERSION DISPLAY =======
document.addEventListener('DOMContentLoaded', () => {
  const tv = document.getElementById('title-version');
  if(tv) tv.textContent = `v${GAME_VERSION}`;
});

// ======= CANVAS SETUP & UI SCALING =======
let uiScale       = parseFloat(localStorage.getItem('grimstone_ui_scale') || '1');
let showMinimap   = localStorage.getItem('grimstone_show_minimap')   !== '0';
let weatherOn     = localStorage.getItem('grimstone_weather_on')     !== '0';
let brighterNights= localStorage.getItem('grimstone_brighter_nights')=== '1';

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
  // Also scale the options overlay content (it lives outside #game-container)
  // zoom (unlike transform:scale) changes the element's layout size so the
  // flex-centred overlay actually reflects the new size.
  const optWrap = document.querySelector('#options-overlay .options-wrap');
  if(optWrap) optWrap.style.zoom = uiScale;
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
  // UI scale slider now lives in the options panel
  const slider = document.getElementById('ui-scale-slider');
  const label  = document.getElementById('ui-scale-label');
  if(slider) {
    slider.value = Math.round(uiScale * 100);
    if(label) label.textContent = slider.value + '%';
    applyUIScale(uiScale);
    slider.addEventListener('input', () => {
      const s = parseInt(slider.value) / 100;
      if(label) label.textContent = slider.value + '%';
      applyUIScale(s);
    });
  }
  function stepScale(delta) {
    if(!slider) return;
    const next = Math.min(130, Math.max(60, parseInt(slider.value) + delta));
    slider.value = next;
    if(label) label.textContent = next + '%';
    applyUIScale(next / 100);
  }
  const minusBtn = document.getElementById('opt-scale-minus');
  const plusBtn  = document.getElementById('opt-scale-plus');
  if(minusBtn) minusBtn.addEventListener('click', () => stepScale(-5));
  if(plusBtn)  plusBtn.addEventListener('click',  () => stepScale(+5));
}

// ======= OPTIONS PANEL =======
function toggleOptionsPanel() {
  const overlay = document.getElementById('options-overlay');
  if(!overlay) return;
  overlay.classList.toggle('show');
}

function initOptionsPanel() {
  initScaleSlider();

  // ── SFX Volume ──────────────────────────────────────────
  const sfxSlider = document.getElementById('opt-sfx-vol');
  const sfxLabel  = document.getElementById('opt-sfx-vol-label');
  if(sfxSlider) {
    const saved = parseFloat(localStorage.getItem('grimstone_sfx_vol') ?? '0.6');
    sfxSlider.value = Math.round(saved * 100);
    if(sfxLabel) sfxLabel.textContent = sfxSlider.value + '%';
    SFX.setVol(saved);
    sfxSlider.addEventListener('input', () => {
      const v = parseInt(sfxSlider.value) / 100;
      if(sfxLabel) sfxLabel.textContent = sfxSlider.value + '%';
      SFX.setVol(v);
      localStorage.setItem('grimstone_sfx_vol', v);
    });
  }

  // ── Music Volume ────────────────────────────────────────
  const musicVolSlider = document.getElementById('opt-music-vol');
  const musicVolLabel  = document.getElementById('opt-music-vol-label');
  if(musicVolSlider) {
    const savedVol = parseInt(localStorage.getItem('grimstone_music_vol') ?? '35');
    musicVolSlider.value = savedVol;
    if(musicVolLabel) musicVolLabel.textContent = savedVol + '%';
    musicVolSlider.addEventListener('input', () => {
      const v = parseInt(musicVolSlider.value);
      if(musicVolLabel) musicVolLabel.textContent = v + '%';
      setMusicVolume(v);
      localStorage.setItem('grimstone_music_vol', v);
    });
  }

  // ── Music On/Off ────────────────────────────────────────
  const musicBtn = document.getElementById('opt-music-enabled');
  if(musicBtn) {
    const savedEnabled = localStorage.getItem('grimstone_music_enabled') !== '0';
    _setToggle(musicBtn, savedEnabled);
    musicBtn.addEventListener('click', () => {
      toggleMusic();
      const nowOn = Music.enabled;
      _setToggle(musicBtn, nowOn);
      localStorage.setItem('grimstone_music_enabled', nowOn ? '1' : '0');
    });
  }

  // ── Minimap ─────────────────────────────────────────────
  const minimapBtn = document.getElementById('opt-minimap');
  if(minimapBtn) {
    _setToggle(minimapBtn, showMinimap);
    minimapBtn.addEventListener('click', () => {
      showMinimap = !showMinimap;
      _setToggle(minimapBtn, showMinimap);
      localStorage.setItem('grimstone_show_minimap', showMinimap ? '1' : '0');
    });
  }

  // ── Weather Effects ─────────────────────────────────────
  const weatherBtn = document.getElementById('opt-weather');
  if(weatherBtn) {
    _setToggle(weatherBtn, weatherOn);
    weatherBtn.addEventListener('click', () => {
      weatherOn = !weatherOn;
      _setToggle(weatherBtn, weatherOn);
      localStorage.setItem('grimstone_weather_on', weatherOn ? '1' : '0');
      Weather.setEnabled(weatherOn);
    });
  }

  // ── Autosave On/Off ─────────────────────────────────────
  const autosaveBtn = document.getElementById('opt-autosave');
  const intervalRow = document.getElementById('opt-autosave-interval-row');
  if(autosaveBtn) {
    const savedAutosave = localStorage.getItem('grimstone_autosave_enabled') !== '0';
    _setToggle(autosaveBtn, savedAutosave);
    if(intervalRow) intervalRow.style.opacity = savedAutosave ? '1' : '0.4';
    autosaveBtn.addEventListener('click', () => {
      const nowOn = localStorage.getItem('grimstone_autosave_enabled') !== '0';
      const next  = !nowOn;
      _setToggle(autosaveBtn, next);
      localStorage.setItem('grimstone_autosave_enabled', next ? '1' : '0');
      if(intervalRow) intervalRow.style.opacity = next ? '1' : '0.4';
      startAutoSave();
    });
  }

  // ── Autosave Interval ───────────────────────────────────
  const savedInterval = localStorage.getItem('grimstone_autosave_interval') || '30000';
  document.querySelectorAll('#opt-autosave-interval-row .options-choice').forEach(btn => {
    if(btn.dataset.val === savedInterval) btn.classList.add('active');
    else btn.classList.remove('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('#opt-autosave-interval-row .options-choice')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      localStorage.setItem('grimstone_autosave_interval', btn.dataset.val);
      startAutoSave();
    });
  });

  // ── Brighter Nights ─────────────────────────────────────
  const brighterBtn = document.getElementById('opt-brighter-nights');
  if(brighterBtn) {
    _setToggle(brighterBtn, brighterNights);
    brighterBtn.addEventListener('click', () => {
      brighterNights = !brighterNights;
      _setToggle(brighterBtn, brighterNights);
      localStorage.setItem('grimstone_brighter_nights', brighterNights ? '1' : '0');
    });
  }
}

function _setToggle(btn, on) {
  btn.textContent = on ? 'On' : 'Off';
  btn.classList.toggle('active', on);
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
    Spiders.init();
    startAutoSave();
    startHomeGrowthTick();
    // Show Co-Op session button for all game modes (can start/join at any time)
    const sbw = document.getElementById('session-btn-wrap');
    if(sbw) sbw.style.display = 'flex';
    if(mode==='coop') {
      document.getElementById('p2-hud').style.display='flex';
    }
    initOptionsPanel(); initPanelToggles();
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
    Spiders.init();
    startAutoSave();
    startHomeGrowthTick();
    const sbw2 = document.getElementById('session-btn-wrap');
    if(sbw2) sbw2.style.display = 'flex';
    initOptionsPanel(); initPanelToggles();
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
  const bonuses = getEquipBonuses(p);
  // Which skills visually gain from equipment bonus
  const SKILL_BONUS_MAP = { Strength: bonuses.strBonus, Defence: bonuses.defBonus, Magic: bonuses.magicBonus };
  Object.entries(p.skills).forEach(([name,sk])=>{
    const d=document.createElement('div');
    d.className='skill-entry'; d.id='skill-'+name;
    const needed=xpForLevel(sk.lvl+1)-xpForLevel(sk.lvl);
    const progress=((sk.xp-xpForLevel(sk.lvl))/(needed))*100;
    const bonus = SKILL_BONUS_MAP[name] || 0;
    const bonusHtml = bonus > 0 ? `<span class="skill-equip-bonus">+${bonus}</span>` : '';
    d.innerHTML=`<div class="skill-name"><span>${name}</span><span class="skill-lvl">${sk.lvl}${bonusHtml}</span></div>
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

  // Build equipment bonus line for relevant skills
  const bonuses = getEquipBonuses(p);
  const equipParts = [];
  if(name === 'Strength') {
    if(bonuses.strBonus)    equipParts.push(`+${bonuses.strBonus} Str (damage range)`);
    if(bonuses.attackBonus) equipParts.push(`+${bonuses.attackBonus} Atk (flat damage)`);
  }
  if(name === 'Defence'  && bonuses.defBonus)    equipParts.push(`+${bonuses.defBonus} Def (damage reduction)`);
  if(name === 'Magic'    && bonuses.magicBonus)  equipParts.push(`+${bonuses.magicBonus} Mag (rune ×1.25 when ≥5)`);
  const equipBonusHtml = equipParts.length
    ? `<div class="stt-equip-bonus">⚔ Equipment: ${equipParts.join(' · ')}</div>`
    : '';

  tip.innerHTML = `
    <div class="stt-header">
      <span>${info.icon}</span>
      <span>${name}</span>
      <span style="margin-left:auto;font-size:11px;opacity:0.6">Lv ${sk.lvl}</span>
    </div>
    <div class="stt-desc">${info.desc}</div>
    ${equipBonusHtml}
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
  const bonuses = getEquipBonuses(p);
  const SKILL_BONUS_MAP = { Strength: bonuses.strBonus, Defence: bonuses.defBonus, Magic: bonuses.magicBonus };
  const bonus = SKILL_BONUS_MAP[skillName] || 0;
  const lvlEl = el.querySelector('.skill-lvl');
  lvlEl.innerHTML = bonus > 0 ? `${sk.lvl}<span class="skill-equip-bonus">+${bonus}</span>` : sk.lvl;
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
// Virtual coordinate space: WM_VW × WM_VH.  Canvas is 700 × 560.
// Only horizontal panning (no Y pan — content fits in 560px height).
//
// Zone cards: 200×85px, 40px gaps.
// Main row center-x of Ashenveil = 980.  Chapel/Whisperwood/Stormcrag
// all share that center-x.
//
//                              [✝ Forsaken Chapel]
//                                       |
//  [🪨 WestPass]-[🌫 Ashgrove]-[⚘ Greenfield]-[⚔ Ashenveil]-[🌿 Ashen Moor]-[⛏ IronPeaks]
//                                       |
//                                [❧ Whisperwood]
//                                       |
//                         [⛰ Stormcrag]   [⌂ Homestead]

const WM_VW     = 1800;   // virtual canvas width
const WM_VH     = 560;    // virtual canvas height (== canvas pixel height)
const WM_PAN_MAX = 900;   // max horizontal pan (virtual px)
const WM_CW     = 700;    // visible canvas width

// Row 1 at y=155, h=85.  x: WP=160, Ashgrove=400, Greenfield=640,
// Ashenveil=880 (center_x=980), AshenMoor=1120, IronPeaks=1360.
const WORLD_ZONES = [
  {
    id: ['FORSAKEN CHAPEL','THE FORSAKEN CHAPEL','CULTIST CATACOMBS'],
    label: 'Forsaken Chapel', sub: 'Cursed Grounds', icon: '✝',
    x:875, y:28, w:210, h:82, color:'#271630', border:'#7040a0',
  },
  {
    id: ['WESTERN PASS','THE WESTERN PASS'],
    label: 'Western Pass', sub: 'Caravan Road', icon: '🪨',
    x:160, y:155, w:200, h:85, color:'#1a1a10', border:'#706040',
  },
  {
    id: ['ASHGROVE HOLLOW'],
    label: 'Ashgrove Hollow', sub: 'Ash Tree Grove', icon: '🌫',
    x:400, y:155, w:200, h:85, color:'#1c1c10', border:'#686850',
  },
  {
    id: ['GREENFIELD','GREENFIELD PASTURES'],
    label: 'Greenfield', sub: 'Pastures & Farm', icon: '⚘',
    x:640, y:155, w:200, h:85, color:'#182e14', border:'#3a8c30',
  },
  {
    id: ['ASHENVEIL'],
    label: 'Ashenveil', sub: 'Starting Town', icon: '⚔',
    x:880, y:155, w:200, h:85, color:'#2e1e0e', border:'#c8921a', isMain:true,
  },
  {
    id: ['ASHEN MOOR','THE ASHEN MOOR','ASHEN CRYPTS'],
    label: 'Ashen Moor', sub: 'Grassy Moorland', icon: '🌿',
    x:1120, y:155, w:200, h:85, color:'#1a2010', border:'#607840',
  },
  {
    id: ['IRON PEAKS','THE IRON PEAKS','IRON DEPTHS'],
    label: 'Iron Peaks', sub: 'Rocky Heights', icon: '⛏',
    x:1360, y:155, w:200, h:85, color:'#1e1e26', border:'#607070',
  },
  {
    id: ['WHISPERWOOD','THE WHISPERWOOD'],
    label: 'The Whisperwood', sub: 'Ancient Forest', icon: '❧',
    x:880, y:310, w:200, h:85, color:'#0e1e0e', border:'#407830',
  },
  {
    id: ['STORMCRAG REACH'],
    label: 'Stormcrag Reach', sub: 'Mountain Keep', icon: '⛰',
    x:880, y:455, w:200, h:85, color:'#2e3a47', border:'#607898',
  },
  {
    id: ['YOUR HOMESTEAD'],
    label: 'Your Homestead', sub: 'Personal Plot', icon: '⌂',
    x:1120, y:455, w:200, h:85, color:'#1a2e10', border:'#6aaa30',
  },
];

// [x1,y1, x2,y2] in virtual coords.  Row-1 vertical centre y = 155+42 = 197.
const MAP_PATHS = [
  [ 980, 110,  980, 155],   // Chapel bottom → Ashenveil top
  [ 360, 197,  400, 197],   // Western Pass → Ashgrove Hollow
  [ 600, 197,  640, 197],   // Ashgrove Hollow → Greenfield
  [ 840, 197,  880, 197],   // Greenfield → Ashenveil
  [1080, 197, 1120, 197],   // Ashenveil → Ashen Moor
  [1320, 197, 1360, 197],   // Ashen Moor → Iron Peaks
  [ 980, 240,  980, 310],   // Ashenveil bottom → Whisperwood top
  [ 980, 395,  980, 455],   // Whisperwood bottom → Stormcrag top
];

let _wmAnimFrame = null;
let _wmStartTime = null;
let _wmPanX      = 0;     // horizontal pan offset (virtual px)
let _wmDrag      = null;  // {startClientX, startPan} during a drag
let _wmHandlers  = null;  // stored listeners for cleanup

function _wmCenterPan(vx) {
  return Math.max(0, Math.min(WM_PAN_MAX, vx - WM_CW / 2));
}

function drawWorldMap(timestamp) {
  const canvas = document.getElementById('world-map-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  if(_wmStartTime === null) _wmStartTime = timestamp || performance.now();
  const t = ((timestamp || performance.now()) - _wmStartTime) / 1000;

  // Background
  ctx.fillStyle = '#060810';
  ctx.fillRect(0, 0, W, H);

  // Faint tiling grid drawn in screen-space so it scrolls with pan
  ctx.strokeStyle = 'rgba(90,70,30,0.10)';
  ctx.lineWidth = 1;
  const gOff = _wmPanX % 32;
  for(let x = -gOff; x < W + 32; x += 32) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  const curName = (currentMap && currentMap.name) ? currentMap.name.toUpperCase() : '';

  // ---- Everything below is drawn in virtual (panned) space ----
  ctx.save();
  ctx.translate(-_wmPanX, 0);

  // Connecting paths
  ctx.strokeStyle = 'rgba(180,140,50,0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 7]);
  MAP_PATHS.forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Zone cards
  WORLD_ZONES.forEach(zone => {
    const active = zone.id.some(id => curName.includes(id) || id.includes(curName));
    const cx = zone.x + zone.w / 2;
    const cy = zone.y + zone.h / 2;

    // Pulse rings on active zone
    if(active) {
      for(let i = 0; i < 3; i++) {
        const phase = ((t * 1.4 + i * 0.7) % 2.1) / 2.1;
        ctx.save();
        ctx.globalAlpha = (1 - phase) * 0.5;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2.5 - phase * 1.5;
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.ellipse(cx, cy, zone.w/2 + phase*44, zone.h/2 + phase*30, 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Fill
    ctx.fillStyle = zone.color;
    if(active) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 22; }
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = active ? '#ffd700' : zone.border;
    ctx.lineWidth   = active ? 2.5 : 1.5;
    ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);

    // Icon (top-left)
    ctx.textAlign = 'left';
    ctx.font = '17px serif';
    ctx.globalAlpha = active ? 1 : 0.65;
    ctx.fillStyle   = active ? '#ffd700' : zone.border;
    if(active) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8; }
    ctx.fillText(zone.icon, zone.x + 8, zone.y + 24);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    // Zone name
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#ffd700' : '#c8a870';
    ctx.font      = `${active ? 'bold ' : ''}14px Cinzel, serif`;
    ctx.fillText(zone.label, cx, cy + 5);

    // Sub-label
    ctx.fillStyle = active ? 'rgba(255,215,0,0.72)' : 'rgba(160,130,80,0.62)';
    ctx.font      = '11px Cinzel, serif';
    ctx.fillText(zone.sub, cx, cy + 22);

    // "YOU ARE HERE" pulse
    if(active) {
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3.2);
      ctx.fillStyle   = '#ffd700';
      ctx.font        = 'bold 11px Cinzel, serif';
      ctx.fillText('▲ YOU ARE HERE', cx, cy - 18);
      ctx.globalAlpha = 1;
    }
  });

  ctx.restore(); // end panned drawing

  // ---- Screen-space chrome ----

  // Edge fade + arrow when more content is off-screen
  if(_wmPanX > 10) {
    const gL = ctx.createLinearGradient(0,0,60,0);
    gL.addColorStop(0,'rgba(6,8,16,0.8)'); gL.addColorStop(1,'rgba(6,8,16,0)');
    ctx.fillStyle = gL; ctx.fillRect(0,0,60,H);
    ctx.fillStyle = 'rgba(200,160,60,0.7)';
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('‹', 22, H/2 + 8);
  }
  if(_wmPanX < WM_PAN_MAX - 10) {
    const gR = ctx.createLinearGradient(W,0,W-60,0);
    gR.addColorStop(0,'rgba(6,8,16,0.8)'); gR.addColorStop(1,'rgba(6,8,16,0)');
    ctx.fillStyle = gR; ctx.fillRect(W-60,0,60,H);
    ctx.fillStyle = 'rgba(200,160,60,0.7)';
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('›', W-22, H/2 + 8);
  }

  // Scroll-position bar
  const prog  = WM_PAN_MAX > 0 ? _wmPanX / WM_PAN_MAX : 0;
  const bx = 60, bw = W - 120, bh = 3;
  ctx.fillStyle = 'rgba(180,140,50,0.15)';
  ctx.fillRect(bx, H - 10, bw, bh);
  ctx.fillStyle = 'rgba(200,160,60,0.6)';
  ctx.fillRect(bx + prog * (bw - 44), H - 10, 44, bh);

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(160,130,80,0.4)';
  ctx.font = '10px Cinzel, serif';
  ctx.fillText('Interiors: The Tarnished Flagon · Grimward\'s Smithy · Wizard Tower · Dungeon Floors', W/2, H - 20);
}

function _wmLoop(ts) {
  drawWorldMap(ts);
  _wmAnimFrame = requestAnimationFrame(_wmLoop);
}

// Drag uses clientX on document so dragging off the canvas still works.
function _wmAttachDrag(canvas) {
  let docMove, docUp;

  function onDown(e) {
    _wmDrag = { startClientX: e.clientX, startPan: _wmPanX };
    canvas.style.cursor = 'grabbing';
    document.addEventListener('mousemove', docMove);
    document.addEventListener('mouseup',   docUp);
  }
  docMove = function(e) {
    if(!_wmDrag) return;
    const dx = _wmDrag.startClientX - e.clientX;
    _wmPanX = Math.max(0, Math.min(WM_PAN_MAX, _wmDrag.startPan + dx));
  };
  docUp = function() {
    _wmDrag = null;
    canvas.style.cursor = 'grab';
    document.removeEventListener('mousemove', docMove);
    document.removeEventListener('mouseup',   docUp);
  };
  function onWheel(e) {
    e.preventDefault();
    _wmPanX = Math.max(0, Math.min(WM_PAN_MAX, _wmPanX + (e.deltaX || e.deltaY) * 0.5));
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('wheel', onWheel, {passive:false});
  canvas.style.cursor = 'grab';
  _wmHandlers = {onDown, docMove, docUp, onWheel};
}

function _wmDetachDrag(canvas) {
  if(!_wmHandlers) return;
  const {onDown, docMove, docUp, onWheel} = _wmHandlers;
  canvas.removeEventListener('mousedown', onDown);
  canvas.removeEventListener('wheel',     onWheel);
  document.removeEventListener('mousemove', docMove);
  document.removeEventListener('mouseup',   docUp);
  canvas.style.cursor = '';
  _wmHandlers = null;
}

function toggleWorldMap() {
  const overlay = document.getElementById('world-map-overlay');
  if(!overlay) return;
  const canvas = document.getElementById('world-map-canvas');
  const isOpen = overlay.classList.contains('show');
  if(isOpen) {
    overlay.classList.remove('show');
    if(_wmAnimFrame) { cancelAnimationFrame(_wmAnimFrame); _wmAnimFrame = null; }
    _wmStartTime = null;
    if(canvas) _wmDetachDrag(canvas);
  } else {
    // Pan to centre the player's current zone (fallback: Ashenveil)
    const curName = (currentMap && currentMap.name) ? currentMap.name.toUpperCase() : '';
    let target = WORLD_ZONES.find(z => z.id.some(id => curName.includes(id) || id.includes(curName)));
    if(!target) target = WORLD_ZONES.find(z => z.id.includes('ASHENVEIL'));
    if(target) _wmPanX = _wmCenterPan(target.x + target.w / 2);
    overlay.classList.add('show');
    _wmStartTime = null;
    _wmAnimFrame = requestAnimationFrame(_wmLoop);
    if(canvas) _wmAttachDrag(canvas);
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

