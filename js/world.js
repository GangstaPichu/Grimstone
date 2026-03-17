// ======= DAY / NIGHT CYCLE =======
// gameTime: 0.0 = midnight, 0.2 = dawn, 0.5 = noon, 0.8 = dusk, 1.0 = midnight
// Boundaries: Night [0.0–0.133] & [0.867–1.0]  Dawn [0.133–0.2]  Day [0.2–0.8]  Dusk [0.8–0.867]
// One full day = DAY_DURATION_MS milliseconds of real time
const DAY_DURATION_MS = 15 * 60 * 1000; // 15 real minutes = 1 game day (day≈9min, night≈4min)
let gameTime = 0.22; // start just after dawn
let gameDay  = 1;    // current in-game day (starts on Day 1)
let lastFrameTime = 0;
let isSleeping = false;

// Seven-day Ashenveil week cycle
const DAY_NAMES = [
  'Stonedawn', // 1
  'Ironmark',  // 2
  'Ashveil',   // 3
  'Grimtide',  // 4 — the mystery night
  'Emberfell', // 5
  'Duskholm',  // 6
  'Moonwatch', // 7
];
function getDayName(d) { return DAY_NAMES[(d - 1) % 7]; }

function tickDayNight(now) {
  if(lastFrameTime === 0) { lastFrameTime = now; return; }
  if(isSleeping) return; // time is fast-forwarded by sleep function
  const dt = (now - lastFrameTime) / DAY_DURATION_MS;
  lastFrameTime = now;
  const prev = gameTime;
  gameTime = (gameTime + dt) % 1.0;
  // Detect midnight rollover (prev was near 1.0, now wrapped to near 0)
  if(prev > 0.95 && gameTime < 0.05) {
    gameDay++;
    tickMysteryNpc();
  }
  // Also tick mystery NPC every frame for spawn/despawn window checks
  tickMysteryNpc();
}

// Returns 0 (full day) → 1 (full night) based on gameTime
function getNightAlpha() {
  // Dawn: 0.133–0.2, Day: 0.2–0.8, Dusk: 0.8–0.867, Night: 0.867–1.0 and 0.0–0.133
  const t = gameTime;
  if(t >= 0.2 && t <= 0.8)  return 0;                             // full day
  if(t > 0.8 && t <= 0.867) return (t - 0.8) / 0.067;            // dusk fade in
  if(t > 0.867 || t <= 0.133) return 1;                           // full night
  if(t > 0.133 && t < 0.2)  return 1 - (t - 0.133) / 0.067;     // dawn fade out
  return 0;
}

function getTimeLabel() {
  const hours = Math.floor(gameTime * 24);
  const mins  = Math.floor((gameTime * 24 * 60) % 60);
  const ampm  = hours >= 12 ? 'PM' : 'AM';
  const h12   = hours % 12 || 12;
  return `${h12}:${String(mins).padStart(2,'0')} ${ampm}`;
}

function getPeriodLabel() {
  const t = gameTime;
  if(t >= 0.133 && t < 0.2)  return '🌅 Dawn';
  if(t >= 0.2   && t < 0.8)  return '☀️ Day';
  if(t >= 0.8   && t < 0.867) return '🌇 Dusk';
  return '🌙 Night';
}

// Fast-forward time to next morning with a fade
// Sleep only allowed from dusk (0.8) through night until dawn (0.2)
function sleepUntilMorning() {
  if(isSleeping) return;
  const t = gameTime;
  if(t >= 0.2 && t < 0.8) {
    log("It's the middle of the day — you're not tired yet. Come back at dusk.", 'bad');
    return;
  }
  isSleeping = true;
  const flash = document.getElementById('zone-flash');
  flash.style.transition = 'opacity 0.8s';
  flash.style.background = '#050608';
  flash.style.opacity = '1';
  setTimeout(() => {
    gameTime = 0.22; // just after dawn
    gameDay++;
    log("You sleep soundly... and wake refreshed at dawn.", 'gold');
    // Restore HP
    const p = state.players[state.activePlayer];
    p.hp = p.maxHp;
    updateHUD();
    if(activeSaveSlot != null) saveGame(activeSaveSlot);
    flash.style.transition = 'opacity 1.2s';
    flash.style.opacity = '0';
    setTimeout(() => {
      flash.style.background = '';
      isSleeping = false;
    }, 1300);
  }, 900);
}
let gameMode = null; // 'solo' or 'coop'
let currentTool = null;
let activityTimer = null;
let currentActivity = null;
let levelupTimer = null;

const SKILL_XP_TABLE = [0,83,174,276,388,512,650,801,969,1154,1358,1584,1833,2107,2411,2746,3115,3523,3973,4470,5018,5624,6291,7028,7842,8740,9730,10824,12031,13363];

const state = {
  players: [
    {
      name: 'Wanderer',
      hp: 30, maxHp: 30,
      gold: 0,
      skills: {
        Mining:    {lvl:1,xp:0},
        Smithing:  {lvl:1,xp:0},
        Woodcutting:{lvl:1,xp:0},
        Crafting:  {lvl:1,xp:0},
        Fishing:   {lvl:1,xp:0},
        Cooking:   {lvl:1,xp:0},
        Farming:   {lvl:1,xp:0},
        Attack:    {lvl:1,xp:0},
        Defence:   {lvl:1,xp:0},
        Strength:  {lvl:1,xp:0},
        Hitpoints: {lvl:10,xp:1154},
      },
      inventory: Array(28).fill(null),
    }
  ],
  activePlayer: 0,
  // Homestead farm plots — keyed "x,y": {state:'tilled'|'planted', cropItem, cropTile, plantedAt, growTime}
  farmPlots: {},
  // Homestead upgrade tiers (0 = default, 1–4 = purchased upgrades)
  homePlotTier: 0,
  homeHouseTier: 0,
  // Blueprints learned (array of item IDs)
  homeBlueprintsLearned: [],
  // Furniture placed in the cabin [{tile, x, y}]
  homeFurniture: [],
};

// Ground bags — items dropped by the player. Cleared on zone/map change.
// Each entry: { id:Number, x:Number, y:Number, items:[{id,qty}] }
let groundBags = [];
let _groundBagId = 0;


// ======= ITEM ICON SPRITE GENERATOR =======
function makeIcon(drawFn) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  drawFn(x);
  return c.toDataURL();
}

const ICON = (() => {
  function sword(col, hilCol) { return makeIcon(x => {
    x.strokeStyle = col; x.lineWidth = 2.5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(25,4); x.lineTo(7,22); x.stroke();
    x.strokeStyle = hilCol+'88'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(24,5); x.lineTo(8,21); x.stroke();
    x.strokeStyle = '#c8922a'; x.lineWidth = 3; x.lineCap = 'square';
    x.beginPath(); x.moveTo(5,17); x.lineTo(13,25); x.stroke();
    x.strokeStyle = '#5a3010'; x.lineWidth = 2.5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(9,23); x.lineTo(4,28); x.stroke();
    x.fillStyle = '#c8922a';
    x.beginPath(); x.arc(3,29,2.5,0,Math.PI*2); x.fill();
  });}
  function dagger(col) { return makeIcon(x => {
    x.strokeStyle = col; x.lineWidth = 2; x.lineCap = 'round';
    x.beginPath(); x.moveTo(22,5); x.lineTo(10,22); x.stroke();
    x.strokeStyle = '#c8922a'; x.lineWidth = 2.5; x.lineCap = 'square';
    x.beginPath(); x.moveTo(7,20); x.lineTo(13,26); x.stroke();
    x.strokeStyle = '#5a3010'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(10,23); x.lineTo(6,28); x.stroke();
    x.fillStyle='#ffffff99'; x.beginPath(); x.arc(22,5,1.5,0,Math.PI*2); x.fill();
  });}
  function axe(col) { return makeIcon(x => {
    x.strokeStyle='#6a3a10'; x.lineWidth=3; x.lineCap='round';
    x.beginPath(); x.moveTo(22,22); x.lineTo(8,29); x.stroke();
    x.fillStyle=col;
    x.beginPath(); x.moveTo(14,5); x.lineTo(24,9); x.lineTo(22,20); x.lineTo(10,18); x.closePath(); x.fill();
    x.strokeStyle='#ffffff55'; x.lineWidth=1.2;
    x.beginPath(); x.moveTo(14,5); x.lineTo(24,9); x.stroke();
  });}
  function club(col) { return makeIcon(x => {
    x.strokeStyle='#6a3a10'; x.lineWidth=3; x.lineCap='round';
    x.beginPath(); x.moveTo(22,25); x.lineTo(9,29); x.stroke();
    x.fillStyle=col;
    x.beginPath(); x.arc(18,14,7,0,Math.PI*2); x.fill();
    x.fillStyle='#00000055'; x.beginPath(); x.arc(20,12,3,0,Math.PI*2); x.fill();
    x.fillStyle='#ffffff44'; x.beginPath(); x.arc(15,16,2,0,Math.PI*2); x.fill();
  });}
  function shieldShape(col, rimCol) { return makeIcon(x => {
    x.fillStyle=rimCol;
    x.beginPath(); x.moveTo(16,29); x.lineTo(4,9); x.lineTo(4,5); x.lineTo(28,5); x.lineTo(28,9); x.closePath(); x.fill();
    x.fillStyle=col;
    x.beginPath(); x.moveTo(16,27); x.lineTo(6,10); x.lineTo(6,7); x.lineTo(26,7); x.lineTo(26,10); x.closePath(); x.fill();
    x.fillStyle=rimCol; x.beginPath(); x.arc(16,15,3,0,Math.PI*2); x.fill();
    x.fillStyle='#ffffff22'; x.beginPath(); x.moveTo(8,8); x.lineTo(14,8); x.lineTo(8,15); x.closePath(); x.fill();
  });}
  function woodShield() { return makeIcon(x => {
    x.fillStyle='#7a4820';
    x.beginPath(); x.moveTo(16,29); x.lineTo(4,9); x.lineTo(4,5); x.lineTo(28,5); x.lineTo(28,9); x.closePath(); x.fill();
    x.fillStyle='#5a3010';
    x.beginPath(); x.moveTo(16,27); x.lineTo(6,10); x.lineTo(6,7); x.lineTo(26,7); x.lineTo(26,10); x.closePath(); x.fill();
    x.strokeStyle='#3a2008'; x.lineWidth=0.8;
    [9,13,17,21].forEach(y=>{x.beginPath();x.moveTo(7,y);x.lineTo(25,y);x.stroke();});
    x.strokeStyle='#c8922a'; x.lineWidth=1.5;
    x.beginPath(); x.moveTo(16,29); x.lineTo(4,9); x.lineTo(4,5); x.lineTo(28,5); x.lineTo(28,9); x.closePath(); x.stroke();
  });}
  function helm(col, rimCol) { return makeIcon(x => {
    x.fillStyle=col;
    x.beginPath(); x.arc(16,14,10,Math.PI,0); x.lineTo(26,22); x.lineTo(6,22); x.closePath(); x.fill();
    x.fillRect(5,18,6,9); x.fillRect(21,18,6,9);
    x.strokeStyle=rimCol; x.lineWidth=1.5;
    x.strokeRect(5,18,6,9); x.strokeRect(21,18,6,9);
    x.beginPath(); x.moveTo(5,22); x.lineTo(27,22); x.stroke();
    x.fillStyle='#00000088'; x.fillRect(8,17,16,4);
    x.fillStyle='#ffffff33'; x.beginPath(); x.arc(11,11,4,Math.PI*1.1,Math.PI*1.7); x.stroke();
  });}
  function coif() { return makeIcon(x => {
    x.fillStyle='#7a5030';
    x.beginPath(); x.arc(16,14,10,Math.PI,0); x.lineTo(26,22); x.lineTo(6,22); x.closePath(); x.fill();
    x.fillStyle='#5a3818';
    x.beginPath(); x.moveTo(6,22); x.lineTo(26,22); x.lineTo(23,29); x.lineTo(9,29); x.closePath(); x.fill();
    x.strokeStyle='#3a2010'; x.lineWidth=0.8; x.setLineDash([2,2]);
    x.beginPath(); x.moveTo(16,4); x.lineTo(16,22); x.stroke();
    x.setLineDash([]);
  });}
  function bodyArmour(col, rimCol, plate) { return makeIcon(x => {
    x.fillStyle=col;
    x.beginPath(); x.moveTo(7,6); x.lineTo(25,6); x.lineTo(28,11); x.lineTo(28,27); x.lineTo(20,29); x.lineTo(12,29); x.lineTo(4,27); x.lineTo(4,11); x.closePath(); x.fill();
    x.fillStyle=rimCol; x.fillRect(3,6,9,5); x.fillRect(20,6,9,5);
    x.strokeStyle=rimCol; x.lineWidth=1.5;
    x.beginPath(); x.moveTo(16,6); x.lineTo(16,29); x.stroke();
    if(plate) { [12,17,22].forEach(y=>{x.beginPath();x.moveTo(4,y);x.lineTo(28,y);x.stroke();}); }
    x.fillStyle='#ffffff18'; x.beginPath(); x.moveTo(7,6); x.lineTo(14,6); x.lineTo(7,16); x.closePath(); x.fill();
  });}
  function robe() { return makeIcon(x => {
    x.fillStyle='#2a1a3a';
    x.beginPath(); x.moveTo(7,4); x.lineTo(25,4); x.lineTo(28,12); x.lineTo(28,29); x.lineTo(4,29); x.lineTo(4,12); x.closePath(); x.fill();
    x.fillStyle='#1a0828';
    x.beginPath(); x.moveTo(4,12); x.lineTo(4,29); x.lineTo(16,29); x.closePath(); x.fill();
    x.strokeStyle='#8a3aaa'; x.lineWidth=1.5;
    x.beginPath(); x.moveTo(16,11); x.lineTo(12,19); x.lineTo(20,19); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(16,11); x.lineTo(16,22); x.stroke();
  });}
  function greaves(col, rimCol) { return makeIcon(x => {
    [[4,15],[17,28]].forEach(([x1,x2])=>{
      x.fillStyle=col;
      x.beginPath(); x.moveTo(x1,3); x.lineTo(x2,3); x.lineTo(x2+1,16); x.lineTo(x2-1,29); x.lineTo(x1+1,29); x.lineTo(x1-1,16); x.closePath(); x.fill();
      x.strokeStyle=rimCol; x.lineWidth=1;
      x.stroke();
      x.fillStyle=rimCol; x.beginPath(); x.arc((x1+x2)/2,16,3.5,0,Math.PI*2); x.fill();
      x.fillStyle='#ffffff22'; x.fillRect(x1+1,4,5,9);
    });
  });}
  function leatherLegs() { return makeIcon(x => {
    x.fillStyle='#7a5030';
    x.beginPath(); x.moveTo(6,3); x.lineTo(26,3); x.lineTo(25,16); x.lineTo(20,29); x.lineTo(12,29); x.lineTo(7,16); x.closePath(); x.fill();
    x.strokeStyle='#3a2010'; x.lineWidth=1; x.setLineDash([2,2]);
    x.beginPath(); x.moveTo(16,3); x.lineTo(16,18); x.stroke();
    x.setLineDash([]);
    x.strokeStyle='#3a2010'; x.lineWidth=0.8;
    x.beginPath(); x.moveTo(7,16); x.lineTo(25,16); x.stroke();
    x.fillStyle='#5a3818'; x.fillRect(10,3,12,4);
  });}
  function arrows(col) { return makeIcon(x => {
    [[8,16,24]].forEach(()=>{
      [8,16,24].forEach((ax,i)=>{
        x.strokeStyle='#8b5a2b'; x.lineWidth=1.5; x.lineCap='round';
        x.beginPath(); x.moveTo(ax,26); x.lineTo(ax,8); x.stroke();
        x.fillStyle=col;
        x.beginPath(); x.moveTo(ax,4); x.lineTo(ax-3,10); x.lineTo(ax+3,10); x.closePath(); x.fill();
        x.strokeStyle='#c84820'; x.lineWidth=1.2;
        x.beginPath(); x.moveTo(ax-3,24); x.lineTo(ax,20); x.lineTo(ax+3,24); x.stroke();
      });
    });
    x.strokeStyle='#8a6a40'; x.lineWidth=2;
    x.beginPath(); x.moveTo(5,18); x.lineTo(27,18); x.stroke();
  });}
  function bones() { return makeIcon(x => {
    x.strokeStyle='#c8c0a8'; x.lineWidth=2.5; x.lineCap='round';
    x.beginPath(); x.moveTo(8,7); x.lineTo(24,25); x.stroke();
    [[8,7],[24,25]].forEach(([cx,cy])=>{
      x.fillStyle='#c8c0a8';
      x.beginPath(); x.arc(cx,cy,3.5,0,Math.PI*2); x.fill();
      const ox=cx<16?-3:3, oy=cy<16?-3:3;
      x.beginPath(); x.arc(cx+ox,cy+oy,2,0,Math.PI*2); x.fill();
    });
  });}
  function hide() { return makeIcon(x => {
    x.fillStyle='#5a3818';
    x.beginPath(); x.moveTo(16,3); x.bezierCurveTo(4,3,3,12,3,18); x.bezierCurveTo(3,26,10,29,16,29);
    x.bezierCurveTo(22,29,29,26,29,18); x.bezierCurveTo(29,12,28,3,16,3); x.fill();
    x.fillStyle='#3a2010';
    [[10,12,2],[20,10,1.5],[14,20,2.5],[22,18,1.5]].forEach(([cx,cy,r])=>{
      x.beginPath(); x.arc(cx,cy,r,0,Math.PI*2); x.fill();
    });
    x.fillStyle='#ffffff1a'; x.beginPath(); x.ellipse(12,10,4,3,-0.4,0,Math.PI*2); x.fill();
  });}

  return {
    wooden_club:   club('#8b5a2b'),
    bronze_sword:  sword('#cd7f32','#e8c060'),
    iron_sword:    sword('#909098','#c0c0d0'),
    steel_sword:   sword('#b8c0d0','#e8f0ff'),
    mithril_sword: sword('#6090d0','#a0d0ff'),
    war_axe:       axe('#909098'),
    bone_dagger:   dagger('#c8c0a8'),
    wooden_shield: woodShield(),
    bronze_shield: shieldShape('#9a5020','#cd7f32'),
    iron_shield:   shieldShape('#505058','#909098'),
    kite_shield:   shieldShape('#7080a0','#b0b8c8'),
    leather_coif:  coif(),
    bronze_helm:   helm('#cd7f32','#a06020'),
    iron_helm:     helm('#707078','#505058'),
    steel_helm:    helm('#a0a8b8','#606878'),
    leather_body:  bodyArmour('#7a5030','#5a3818',false),
    bronze_plate:  bodyArmour('#cd7f32','#a06020',true),
    iron_plate:    bodyArmour('#707078','#505058',true),
    steel_plate:   bodyArmour('#a0a8b8','#606878',true),
    mithril_plate: bodyArmour('#6090d0','#4070a0',true),
    cultist_robe:  robe(),
    leather_legs:  leatherLegs(),
    bronze_legs:   greaves('#cd7f32','#a06020'),
    iron_legs:     greaves('#707078','#505058'),
    steel_legs:    greaves('#a0a8b8','#606878'),
    bronze_arrows: arrows('#cd7f32'),
    iron_arrows:   arrows('#909098'),
    bones:         bones(),
    goblin_hide:   hide(),
  };
})();

// Called once at game start — patches canvas data-URL icons into ITEMS
function patchItemIcons() {
  for(const [id, dataUrl] of Object.entries(ICON)) {
    if(ITEMS[id]) ITEMS[id].icon = `<img src="${dataUrl}" class="item-sprite">`;
  }
}

const ITEMS = {
  copper_ore:   {name:'Copper Ore',   icon:'🪨', color:'#8b5a2b'},
  iron_ore:     {name:'Iron Ore',     icon:'⬛', color:'#5a5a6a'},
  gold_ore:     {name:'Gold Ore',     icon:'🟡', color:'#c8922a'},
  mithril_ore:  {name:'Mithril Ore',  icon:'🔷', color:'#4a6a9a'},
  coal:         {name:'Coal',         icon:'⬤', color:'#2a2a2a'},
  normal_log:   {name:'Normal Log',   icon:'🪵', color:'#5a3a1a'},
  oak_log:      {name:'Oak Log',      icon:'🪵', color:'#7a4a20'},
  willow_log:   {name:'Willow Log',   icon:'🍃', color:'#3a5a2a'},
  raw_fish:     {name:'Raw Trout',    icon:'🐟', color:'#2a6a8a'},
  raw_salmon:   {name:'Raw Salmon',   icon:'🐠', color:'#8a4a2a'},
  cooked_fish:  {name:'Cooked Trout', icon:'🍗', color:'#8a6a2a'},
  cooked_salmon:{name:'Cooked Salmon',icon:'🍖', color:'#9a5a1a'},
  bronze_bar:   {name:'Bronze Bar',   icon:'🟫', color:'#8b5a2b'},
  iron_bar:     {name:'Iron Bar',     icon:'🔩', color:'#5a5a6a'},
  steel_bar:    {name:'Steel Bar',    icon:'🔩', color:'#9a9aaa'},
  mithril_bar:  {name:'Mithril Bar',  icon:'🔷', color:'#5a7aaa'},
  gold_bar:     {name:'Gold Bar',     icon:'🟨', color:'#c8922a'},
  plank:        {name:'Plank',        icon:'📋', color:'#7a5a3a'},
  bones:        {name:'Bones',        icon:'🦴', color:'#c8c0a8'},
  goblin_hide:  {name:'Goblin Hide',  icon:'🐾', color:'#5a3a1a'},
  sword:        {name:'Short Sword',  icon:'⚔', color:'#8a8a9a'},
  coins:        {name:'Coins',        icon:'💰', color:'#c8922a'},
  wooden_club:  {name:'Wooden Club',  icon:'🪃', color:'#7a4a1a'},
  wooden_shield:{name:'Wooden Shield',icon:'🛡',  color:'#5a3a0a'},
  torch:        {name:'Torch',        icon:'🔦', color:'#c8722a'},
  bowstring:    {name:'Bowstring',    icon:'🪢', color:'#8a7050'},
  oak_plank:    {name:'Oak Plank',    icon:'🟫', color:'#9a6030'},
  // Innkeeper — Ales & Brews
  pale_ale:       {name:"Pale Ale",         icon:'🍺', color:'#c8a040'},
  dark_stout:     {name:"Dark Stout",        icon:'🍺', color:'#2a1a08'},
  ashenveil_mead: {name:"Ashenveil Mead",    icon:'🍯', color:'#c8820a'},
  witchwood_brew: {name:"Witchwood Brew",    icon:'🍵', color:'#2a4a1a'},
  ironpeak_lager: {name:"Ironpeak Lager",    icon:'🍺', color:'#a07820'},
  // Innkeeper — Food
  inn_stew:       {name:"Hearty Stew",       icon:'🥣', color:'#7a4a18'},
  roast_leg:      {name:"Roasted Leg",       icon:'🍖', color:'#8a4a18'},
  ash_bread:      {name:"Ashenveil Bread",   icon:'🍞', color:'#c8a060'},
  smoked_fish:    {name:"Smoked Fish",       icon:'🐟', color:'#5a3a28'},
  mushroom_pie:   {name:"Mushroom Pie",      icon:'🥧', color:'#6a4a20'},
  // Quest items
  ashen_key:      {name:'The Ashen Key',     icon:'🗝',  color:'#8a7050'},

  // ── Equipment ──
  // Weapons (slot:'weapon')
  wooden_club:    {name:'Wooden Club',    icon:'🪃', color:'#7a4a1a', slot:'weapon', attackBonus:1,  strBonus:0},
  bronze_sword:   {name:'Bronze Sword',   icon:'🗡',  color:'#8b5a2b', slot:'weapon', attackBonus:3,  strBonus:1},
  iron_sword:     {name:'Iron Sword',     icon:'⚔',  color:'#7a7a8a', slot:'weapon', attackBonus:6,  strBonus:2},
  steel_sword:    {name:'Steel Sword',    icon:'⚔',  color:'#9a9aaa', slot:'weapon', attackBonus:10, strBonus:4},
  mithril_sword:  {name:'Mithril Sword',  icon:'⚔',  color:'#5a7aaa', slot:'weapon', attackBonus:15, strBonus:6},
  war_axe:        {name:'War Axe',        icon:'🪓', color:'#8a6a4a', slot:'weapon', attackBonus:8,  strBonus:5},
  bone_dagger:    {name:'Bone Dagger',    icon:'🗡',  color:'#c8c0a8', slot:'weapon', attackBonus:2,  strBonus:0},
  old_staff:      {name:'Old Staff',      icon:'🪄',  color:'#8a6a3a', slot:'weapon', attackBonus:1,  strBonus:0, magicBonus:2, desc:'A battered mage\'s staff. The magic in it is faint but present.'},
  crude_bow:      {name:'Crude Bow',      icon:'🏹',  color:'#7a5a2a', slot:'weapon', attackBonus:2,  strBonus:0, desc:'A rough-hewn bow lashed together with cord. Better than bare fists.'},

  // Shields (slot:'shield')
  wooden_shield:  {name:'Wooden Shield',  icon:'🪵',  color:'#5a3a0a', slot:'shield', defBonus:1},
  bronze_shield:  {name:'Bronze Shield',  icon:'🛡',  color:'#8b5a2b', slot:'shield', defBonus:3},
  iron_shield:    {name:'Iron Shield',    icon:'🛡',  color:'#7a7a8a', slot:'shield', defBonus:6},
  kite_shield:    {name:'Kite Shield',    icon:'🛡',  color:'#9a9aaa', slot:'shield', defBonus:9},

  // Head armour (slot:'head')
  leather_coif:   {name:'Leather Coif',   icon:'🎓', color:'#6a4a2a', slot:'head',   defBonus:1},
  bronze_helm:    {name:'Bronze Helm',    icon:'⛑',  color:'#8b5a2b', slot:'head',   defBonus:2},
  iron_helm:      {name:'Iron Helm',      icon:'⛑',  color:'#7a7a8a', slot:'head',   defBonus:4},
  steel_helm:     {name:'Steel Helm',     icon:'⛑',  color:'#9a9aaa', slot:'head',   defBonus:6},

  // Body armour (slot:'body')
  leather_body:   {name:'Leather Vest',   icon:'🧥', color:'#6a4a2a', slot:'body',   defBonus:2},
  bronze_plate:   {name:'Bronze Plate',   icon:'🦺', color:'#8b5a2b', slot:'body',   defBonus:5},
  iron_plate:     {name:'Iron Plate',     icon:'🦺', color:'#7a7a8a', slot:'body',   defBonus:9},
  steel_plate:    {name:'Steel Plate',    icon:'🦺', color:'#9a9aaa', slot:'body',   defBonus:14},
  mithril_plate:  {name:'Mithril Plate',  icon:'🦺', color:'#5a7aaa', slot:'body',   defBonus:20},
  cultist_robe:   {name:'Cultist Robe',   icon:'👘', color:'#2a1a3a', slot:'body',   defBonus:3},

  // Legs armour (slot:'legs')
  leather_legs:   {name:'Leather Legs',   icon:'👖', color:'#6a4a2a', slot:'legs',   defBonus:1},
  bronze_legs:    {name:'Bronze Greaves', icon:'🟫', color:'#8b5a2b', slot:'legs',   defBonus:3},
  iron_legs:      {name:'Iron Greaves',   icon:'⬛', color:'#7a7a8a', slot:'legs',   defBonus:6},
  steel_legs:     {name:'Steel Greaves',  icon:'🔩', color:'#9a9aaa', slot:'legs',   defBonus:9},

  // Ammo (slot:'ammo')
  bronze_arrows:  {name:'Bronze Arrows',  icon:'🏹', color:'#8b5a2b', slot:'ammo',   attackBonus:2},
  iron_arrows:    {name:'Iron Arrows',    icon:'🏹', color:'#7a7a8a', slot:'ammo',   attackBonus:4},

  // Buckets
  wooden_bucket:  {name:'Wooden Bucket',  icon:'🪣', type:'tool', desc:'An empty wooden bucket. Use it on a cow to get milk, or on a well for water.'},
  milk_bucket:    {name:'Milk Bucket',    icon:'🥛', type:'food', healAmt:8, keepOnDrink:'wooden_bucket', desc:'Fresh milk straight from the cow. Drink to restore 8 HP — you\'ll keep the bucket.'},
  water_bucket:   {name:'Water Bucket',   icon:'💧', type:'tool', desc:'A bucket of well water. Useful for boiling things.'},

  // === Farm ingredients ===
  raw_chicken: {name:'Raw Chicken',  icon:'🍗', type:'food', healAmt:0, desc:'Raw chicken meat. Needs cooking.'},
  raw_pork:    {name:'Raw Pork',     icon:'🥩', type:'food', healAmt:0, desc:'Raw pork. Smells gamey. Needs cooking.'},
  raw_beef:    {name:'Raw Beef',     icon:'🥩', type:'food', healAmt:0, desc:'A cut of raw beef. Needs a fire.'},
  cooked_chicken:{name:'Cooked Chicken',icon:'🍗',type:'food',healAmt:8,  desc:'Juicy roasted chicken. Restores 8 HP.'},
  cooked_pork: {name:'Cooked Pork',  icon:'🍖', type:'food', healAmt:10, desc:'Spit-roasted pork. Restores 10 HP.'},
  cooked_beef: {name:'Cooked Beef',  icon:'🥩', type:'food', healAmt:14, desc:'Hearty beef steak. Restores 14 HP.'},
  wheat:       {name:'Wheat',        icon:'🌾', type:'material', desc:'A bundle of harvested wheat.'},
  turnip:      {name:'Turnip',       icon:'🥕', type:'food', healAmt:3, desc:'A firm turnip. Not exciting, but filling. Restores 3 HP.'},
  egg:         {name:'Egg',          icon:'🥚', type:'food', healAmt:2, desc:'A fresh egg from the farm. Restores 2 HP.'},
  hard_boiled_egg:{name:'Hard Boiled Egg',icon:'🍳',type:'food', healAmt:8, desc:'A perfectly boiled egg. Simple and filling. Restores 8 HP.'},
  flour:       {name:'Flour',        icon:'🌾', type:'material', desc:'Finely ground wheat flour. Useful for baking.'},
  butter:      {name:'Butter',       icon:'🧈', type:'food', healAmt:5, desc:'Freshly churned butter. Rich and creamy. Restores 5 HP.'},
  carrot:      {name:'Carrot',       icon:'🥕', type:'food', healAmt:5, desc:'A freshly pulled carrot. Crisp and sweet. Restores 5 HP.'},
  potato:      {name:'Potato',       icon:'🥔', type:'food', healAmt:7, desc:'A hearty potato. Plain but filling. Restores 7 HP.'},
  onion:       {name:'Onion',        icon:'🧅', type:'food', healAmt:2, desc:'A pungent onion. Not the best alone. Restores 2 HP.'},
  // Homestead quest + tools
  home_sigil:  {name:'Homestead Sigil', icon:'🏡', type:'special', desc:'A magical sigil from Old Bertram. Use it to teleport to your personal homestead at any time.'},
  hoe:         {name:"Farmer's Hoe",    icon:'⚒',  type:'tool',    desc:'Used to till soil at your homestead. Right-click a grass tile while there to prepare it for planting.'},
  // Crop seeds
  wheat_seed:  {name:'Wheat Seeds',  icon:'🌱', type:'seed', cropItem:'wheat',  cropTile:196, growTime:5*60*1000, desc:'Plant in tilled homestead soil. Grows into wheat in ~5 minutes.'},
  turnip_seed: {name:'Turnip Seeds', icon:'🌱', type:'seed', cropItem:'turnip', cropTile:197, growTime:4*60*1000, desc:'Plant in tilled homestead soil. Grows into turnips in ~4 minutes.'},
  carrot_seed: {name:'Carrot Seeds', icon:'🌱', type:'seed', cropItem:'carrot', cropTile:198, growTime:6*60*1000, desc:'Plant in tilled homestead soil. Grows into carrots in ~6 minutes.'},
  potato_seed: {name:'Potato Seeds', icon:'🌱', type:'seed', cropItem:'potato', cropTile:199, growTime:8*60*1000, desc:'Plant in tilled homestead soil. Grows into potatoes in ~8 minutes.'},
  onion_seed:  {name:'Onion Seeds',  icon:'🌱', type:'seed', cropItem:'onion',  cropTile:200, growTime:5*60*1000, desc:'Plant in tilled homestead soil. Grows into onions in ~5 minutes.'},
  // === Quest reward items ===
  ashen_seal:      {name:'Ashen Seal',      icon:'🔴', type:'quest',  desc:'A ritual seal from the Cultist Catacombs. Aldermast will want this.'},
  caravan_manifest:{name:'Caravan Manifest',icon:'📋', type:'quest',  desc:'A shipping manifest from Oswin\'s missing caravan. Proof of what happened on the western pass.'},
  miras_locket:    {name:"Mira's Locket",  icon:'📿', type:'quest',  desc:'A delicate silver locket on a fine chain. Initials are engraved on the back. Return it to Mira.'},
  ring_of_warding: {name:'Ring of Warding', icon:'💍', type:'equip',  slot:'shield', attackBonus:0, strBonus:0, defBonus:6,  desc:'A silver ring etched with warding runes. Reduces damage taken.'},
  void_shard:        {name:'Void Shard',            icon:'🔷', type:'quest', desc:'A fragment of crystallised void-energy. Cold to the touch. One of four.'},
  amulet_of_stars:   {name:'Amulet of Stars',       icon:'⭐', type:'equip', slot:'ammo', attackBonus:5, strBonus:3, defBonus:3, desc:'An amulet Aldermast forged from four Void Shards. Hums faintly.'},
  forged_contract:   {name:'Forged Debt Contract',  icon:'📋', type:'quest', desc:'A falsified ledger page — debt amounts altered in a different hand. Evidence of fraud.'},
  homestead_deed:    {name:'Homestead Extension Deed', icon:'📜', type:'quest', desc:'A land deed granting expanded farmland on your homestead. Additional soil plots await.'},

  // ── Homestead Blueprints ────────────────────────────────────────────
  blueprint_fireplace: {name:'Blueprint: Fireplace',     icon:'📜', type:'blueprint', buildTile:191, buildCost:{copper_ore:6,coal:3,normal_log:3},  desc:'A detailed schematic for a stone fireplace. Study it to learn the construction, then build inside your cabin.'},
  blueprint_workbench: {name:'Blueprint: Workbench',     icon:'📜', type:'blueprint', buildTile:130, buildCost:{oak_log:6,iron_bar:3},               desc:'Plans for a sturdy crafting workbench. Study it to learn the construction, then build inside your cabin.'},
  blueprint_bookshelf: {name:'Blueprint: Bookshelf',     icon:'📜', type:'blueprint', buildTile:121, buildCost:{oak_log:5,iron_bar:2},               desc:"A carpenter's schematic for a wall-mounted bookshelf. Build inside your cabin."},
  blueprint_chest:     {name:'Blueprint: Storage Chest', icon:'📜', type:'blueprint', buildTile:123, buildCost:{normal_log:4,iron_bar:2},             desc:'Instructions for a sturdy lockable chest. Build inside your cabin.'},
  blueprint_candle:    {name:'Blueprint: Candle Stand',  icon:'📜', type:'blueprint', buildTile:122, buildCost:{normal_log:2,copper_ore:2},           desc:'A simple wooden candle stand to brighten your cabin. Build inside your cabin.'},

  // ── RUNES (consumable magic) ───────────────────────────────────────────
  rune_fire:    {name:'Fire Rune',    icon:'🔴', type:'rune', color:'#e04010', desc:'Cast to hurl a bolt of fire. Deals 8–15 damage. Gives Magic XP.',       magicReqLvl:1,  dmgMin:8,  dmgMax:15, xp:8  },
  rune_ice:     {name:'Ice Rune',     icon:'🔵', type:'rune', color:'#4090e0', desc:'Cast to launch a shard of ice. Deals 12–20 damage, slows the enemy.',    magicReqLvl:10, dmgMin:12, dmgMax:20, xp:14, effect:'slow' },
  rune_earth:   {name:'Earth Rune',   icon:'🟤', type:'rune', color:'#8a6020', desc:'A burst of stone shards. Deals 18–30 damage.',                           magicReqLvl:20, dmgMin:18, dmgMax:30, xp:22 },
  rune_void:    {name:'Void Rune',    icon:'🟣', type:'rune', color:'#8020c0', desc:'Channels raw void energy. Deals 30–50 damage.',                          magicReqLvl:35, dmgMin:30, dmgMax:50, xp:40 },
  rune_heal:    {name:'Heal Rune',    icon:'💚', type:'rune', color:'#40c040', desc:'Restore 20–35 HP. Can be used in or out of combat.',                     magicReqLvl:15, healMin:20, healMax:35, xp:18, isHeal:true },
  rune_shield:  {name:'Shield Rune',  icon:'🛡', type:'rune', color:'#4060c0', desc:'Temporarily increases defence by 8 for 30 seconds.',                     magicReqLvl:25, xp:20, isShield:true },

  // ── RUNE CRAFTING MATERIALS ───────────────────────────────────────────
  arcane_dust:    {name:'Arcane Dust',    icon:'✨', type:'material', color:'#c0a0ff', desc:'Ground from coal and copper ore. The base of all rune crafting.'},
  void_essence:   {name:'Void Essence',   icon:'💜', type:'material', color:'#8020c0', desc:'Distilled from Void Shards. Required for advanced runes.'},

  // ── POTIONS (consumable brewed items) ────────────────────────────────
  potion_heal:         {name:'Healing Draught',      icon:'🧪', type:'potion', color:'#40c040', healAmt:30, desc:'A bubbling green draught. Restores 30 HP when consumed.'},
  potion_heal_greater: {name:'Greater Healing',       icon:'🧪', type:'potion', color:'#20e060', healAmt:50, desc:'A potent restorative. Restores 50 HP when consumed.'},
  potion_power:        {name:'Power Draught',         icon:'🧪', type:'potion', color:'#e04010', tempBonus:{attack:5}, tempDuration:90000, desc:'Increases Attack by 5 for 90 seconds.'},
  potion_iron_skin:    {name:'Iron Skin Draught',     icon:'🧪', type:'potion', color:'#7a7a9a', tempBonus:{defence:6}, tempDuration:90000, desc:'Increases Defence by 6 for 90 seconds.'},
  potion_strength:     {name:'Strength Draught',      icon:'🧪', type:'potion', color:'#c08020', tempBonus:{strength:5}, tempDuration:90000, desc:'Increases Strength by 5 for 90 seconds.'},
  potion_shadow:       {name:'Shadow Brew',           icon:'🧪', type:'potion', color:'#602080', tempBonus:{defence:8}, tempDuration:45000, desc:'Shadows fortify you. Increases Defence by 8 for 45 seconds.'},

  // ── TOME FRAGMENTS (quest items) ──────────────────────────────────────
  tome_fragment_1:{name:'Grimoire Fragment I',   icon:'📜', type:'quest', color:'#c0a060', desc:'A torn page from Aldermast\'s grimoire. Covered in arcane diagrams.'},
  tome_fragment_2:{name:'Grimoire Fragment II',  icon:'📜', type:'quest', color:'#c0a060', desc:'A charred leaf from an ancient spellbook. The ink still glows faintly.'},
  tome_fragment_3:{name:'Grimoire Fragment III', icon:'📜', type:'quest', color:'#c0a060', desc:'The final fragment. You can feel power vibrating in the parchment.'},

  // ── ALDERMAST\'S STAFF (quest reward) ─────────────────────────────────
  staff_of_aldermast:{name:'Staff of Aldermast', icon:'🔮', type:'equip', slot:'weapon', color:'#a060e0',
    attackBonus:8, strBonus:0, defBonus:2, magicBonus:5,
    desc:'A wizard\'s staff etched with aetheric runes. Amplifies all magic damage by 25%.'},
};

// TILE TYPES
const T = {
  GRASS:0, DIRT:1, STONE_FLOOR:2, WATER:3, DARK_GRASS:4,
  COPPER:10, IRON:11, GOLD_ORE:12, MITHRIL:13, COAL:14,
  OAK:20, WILLOW:21, NORMAL_TREE:22,
  FISHING:30, FISHING2:31,
  GOBLIN:40, SKELETON:41, WOLF:42,
  SMELTER:50, COOKING_FIRE:51, SHOP:52,
  WALL:60, DUNGEON_FLOOR:61,
  EXIT:70,
  EXIT_RETURN:71,  // portal back to previous zone (left edge of zones 1+)
  // Town tiles
  COBBLE:80, INN:81, BLACKSMITH:82, TOWN_WELL:83, LAMPPOST:84,
  // NPC spawn markers (converted to entities on load)
  NPC_GUARD:90, NPC_MERCHANT:91, NPC_VILLAGER:92, NPC_INNKEEPER:93,
  // Interior transitions
  INN_DOOR:100,   // walkable — triggers enter-inn
  EXIT_INTERIOR:101, // walkable — exit back to parent map
  // Furniture
  TABLE:110, BARREL:111,
  // Decorations
  BED:120, BOOKSHELF:121, CANDLE:122, CHEST:123, NOTICE_BOARD:124,
  // Crafting
  WORKBENCH:130,
  // Town structures & decorations
  GRAVE:131, FENCE:132, HOUSE_A:133, HOUSE_B:134, HOUSE_C:135, FLOWER:136, SIGN:137, BUSH:138,
  // The Forsaken Chapel
  CHAPEL_PORTAL:139, CULTIST:140, ALTAR:141, PILLAR:142, CHAPEL_RUNE:143,
  // Dungeons
  ZOMBIE:144, DUNGEON_STAIR_DOWN:145, DUNGEON_STAIR_UP:146,
  DUNGEON_DOOR:147, DUNGEON_TORCH:148, CRYPT_STAIR:149,
  SHADOW_WALKER:150,
  FOREST_PORTAL:151,
  // Wizard tower area
  WIZARD_DOOR:152,
  NPC_WIZARD:153,
  // New wizard tower decorations
  ARCANE_CIRCLE:154,
  TELESCOPE:155,
  POTION_RACK:156,
  SPELL_TOME:157,
  CRYSTAL_BALL:158,
  CAULDRON:159,
  STONE_RUBBLE:160,
  CRACKED_WALL:161,
  // Farm zone
  FARM_PORTAL:  162,
  HAY_BALE:     163,
  FENCE_POST:   164,
  WATER_TROUGH: 165,
  SCARECROW:    166,
  CROP_WHEAT:   167,
  CROP_TURNIP:  168,
  WINDMILL:     169,
  NPC_FARMER:   170,
  ANIMAL_CHICKEN:171,
  ANIMAL_PIG:   172,
  ANIMAL_COW:   173,
  // ── Building tiles — each tile is one piece of a composed building ──────
  // Roof row (top of building — drawn with angled top face + eave)
  ROOF_L:       174,  // left end of roof
  ROOF_M:       175,  // middle roof (peak ridge)
  ROOF_R:       176,  // right end of roof
  ROOF_CHIMNEY: 177,  // roof section with chimney
  // Front face row (bottom of building — full height wall face)
  BWALL_DOOR:   178,  // front wall — arched doorway centred
  BWALL_WIN:    179,  // front wall — window (generic warm glow)
  BWALL_FORGE:  180,  // front wall — glowing forge window (blacksmith)
  BWALL_AWNING: 181,  // front wall — awning + display window (shop)
  BWALL_PLAIN:  182,  // front wall — plain stone face
  // Side / back walls (plain stone, no face detail)
  BWALL_SIDE:   183,  // side or back wall tile
  DOCK_PLANK:   188,  // wooden dock board
  // Interior house furniture (used in makeHouseInterior + drawTile)
  SMALL_TABLE:  189,
  WARDROBE:     190,
  FIREPLACE:    191,
  PLANT:        192,
  // Homestead farming
  TILLED_SOIL:  193,
  SEEDLING:     194,
  CROP_GROWING: 195,
  HOME_WHEAT:   196,
  HOME_TURNIP:  197,
  HOME_CARROT:  198,
  HOME_POTATO:  199,
  HOME_ONION:   200,
  // Farm processing
  BUTTER_CHURN: 201,
  // Caravan zone portal (farm west wall)
  CARAVAN_PORTAL: 202,
};

// Set of tile IDs that are decorations drawn over a floor layer
const DECOR_TILES = new Set([
  T.TABLE, T.BARREL, T.BED, T.BOOKSHELF, T.CANDLE, T.CHEST, T.NOTICE_BOARD,
  T.DUNGEON_TORCH,
  T.LAMPPOST, T.TOWN_WELL, T.INN, T.BLACKSMITH, T.SMELTER, T.COOKING_FIRE,
  T.SHOP, T.FISHING, T.FISHING2, T.INN_DOOR, T.EXIT_INTERIOR, T.EXIT, T.EXIT_RETURN,
  T.WORKBENCH,
  T.SMALL_TABLE, T.WARDROBE, T.FIREPLACE, T.PLANT,
  T.GRAVE, T.FENCE, T.HOUSE_A, T.HOUSE_B, T.HOUSE_C, T.FLOWER, T.SIGN, T.BUSH,
  T.CHAPEL_PORTAL, T.ALTAR, T.PILLAR, T.CHAPEL_RUNE, T.FOREST_PORTAL,
  T.WIZARD_DOOR, T.ARCANE_CIRCLE, T.TELESCOPE, T.POTION_RACK,
  T.SPELL_TOME, T.CRYSTAL_BALL, T.CAULDRON, T.STONE_RUBBLE, T.CRACKED_WALL,
  // Farm decorations & portals
  T.FARM_PORTAL, T.HAY_BALE, T.FENCE_POST, T.WATER_TROUGH,
  T.SCARECROW, T.CROP_WHEAT, T.CROP_TURNIP, T.WINDMILL,
  T.NPC_FARMER,
  // Animals — NPC system handles their visual; tile slot just holds floor
  T.ANIMAL_CHICKEN, T.ANIMAL_PIG, T.ANIMAL_COW,
  // Homestead farming tiles
  T.TILLED_SOIL, T.SEEDLING, T.CROP_GROWING,
  T.HOME_WHEAT, T.HOME_TURNIP, T.HOME_CARROT, T.HOME_POTATO, T.HOME_ONION,
  // Farm processing
  T.BUTTER_CHURN,
  // Caravan portal — walkable (step-on trigger)
  T.CARAVAN_PORTAL,
]);

// Place a decoration tile and record the floor underneath in the floor layer
function placeDecor(tiles, floor, y, x, decorTile) {
  if(!floor[y]) return;
  floor[y][x] = tiles[y][x]; // record current floor
  tiles[y][x] = decorTile;
}

// ======= PROCEDURAL WORLD GENERATION =======
// Map is now 60×36 tiles with camera scrolling
const MAP_W = 60, MAP_H = 36;
let worldSeed = Math.floor(Math.random() * 99999);

// Seeded pseudo-random number generator (mulberry32)
function makePRNG(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Value noise — smooth interpolated random field
function makeNoise(seed, W, H) {
  const rng = makePRNG(seed);
  // Low-res grid
  const GW = 12, GH = 8;
  const grid = Array.from({length:GH+1}, () => Array.from({length:GW+1}, () => rng()));
  // Smooth interpolation (cosine)
  function interp(a, b, t) { const f = (1 - Math.cos(t * Math.PI)) * 0.5; return a*(1-f) + b*f; }
  return function(x, y) {
    const gx = (x / W) * GW, gy = (y / H) * GH;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(x0+1, GW), y1 = Math.min(y0+1, GH);
    const fx = gx - x0, fy = gy - y0;
    const top    = interp(grid[y0][x0], grid[y0][x1], fx);
    const bottom = interp(grid[y1][x0], grid[y1][x1], fx);
    return interp(top, bottom, fy);
  };
}

// Multi-octave fractal noise
function makeFractalNoise(seed, W, H, octaves=4) {
  const layers = Array.from({length:octaves}, (_, i) => makeNoise(seed + i*1337, W, H));
  return function(x, y) {
    let v=0, amp=1, total=0;
    for(let i=0;i<octaves;i++){ v += layers[i](x,y)*amp; total+=amp; amp*=0.5; }
    return v / total;
  };
}

// Cellular automata smoothing (for water blobs)
function smoothTerrain(tiles, W, H, targetTile, passes=2) {
  for(let p=0;p<passes;p++){
    const next = tiles.map(r=>[...r]);
    for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){
      let count=0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(tiles[y+dy][x+dx]===targetTile) count++;
      if(count>=5) next[y][x]=targetTile;
      else if(count<=2 && tiles[y][x]===targetTile) next[y][x]=T.GRASS;
    }
    for(let y=0;y<H;y++) for(let x=0;x<W;x++) tiles[y][x]=next[y][x];
  }
}

// Place a cluster of tiles around a center, avoiding walls/water
function placeCluster(tiles, W, H, cx, cy, tile, count, radius, rng, avoidSolid=true) {
  let placed=0, attempts=0;
  while(placed<count && attempts<200) {
    attempts++;
    const angle = rng()*Math.PI*2, r = rng()*radius;
    const x = Math.round(cx + Math.cos(angle)*r);
    const y = Math.round(cy + Math.sin(angle)*r);
    if(x<1||x>=W-1||y<1||y>=H-1) continue;
    const cur = tiles[y][x];
    if(avoidSolid && (cur===T.WALL||cur===T.WATER)) continue;
    if(cur===tile) continue;
    tiles[y][x]=tile;
    placed++;
  }
}

// Carve a winding dirt path between two points
function carvePath(tiles, W, H, x0,y0, x1,y1, rng, pathTile=T.DIRT) {
  let cx=x0, cy=y0;
  const steps = Math.abs(x1-x0)+Math.abs(y1-y0)+20;
  for(let i=0;i<steps && (cx!==x1||cy!==y1);i++){
    if(cx>=1&&cx<W-1&&cy>=1&&cy<H-1){
      if(tiles[cy][cx]!==T.WALL&&tiles[cy][cx]!==T.WATER) tiles[cy][cx]=pathTile;
    }
    // Step toward target with some jitter
    const jx = (rng()<0.2 ? (rng()<0.5?-1:1) : 0);
    const jy = (rng()<0.2 ? (rng()<0.5?-1:1) : 0);
    const dx = x1-cx, dy = y1-cy;
    if(Math.abs(dx)>Math.abs(dy)) cx += (dx>0?1:-1) + jx;
    else cy += (dy>0?1:-1) + jy;
    cx=Math.max(1,Math.min(W-2,cx));
    cy=Math.max(1,Math.min(H-2,cy));
  }
}

// Zone configs — each zone has a biome personality
const ZONE_CONFIGS = [
  { // 0: Ashwood Vale — grassy vale
    name: 'THE ASHWOOD VALE',
    baseTile: T.GRASS,
    altTile: T.DARK_GRASS,
    borderTile: T.STONE_FLOOR,
    waterChance: 0.18,
    ores: [{tile:T.COPPER, count:14, req:1}],
    trees: [{tile:T.NORMAL_TREE,count:18},{tile:T.OAK,count:10}],
    enemies: [{tile:T.GOBLIN,count:8}],
    fishSpots: 4,
    hasShop: true,
    pathCount: 3,
    altBiomeChance: 0.25,
  },
  { // 1: Iron Peaks — rocky highland
    name: 'THE IRON PEAKS',
    baseTile: T.STONE_FLOOR,
    altTile: T.DIRT,
    borderTile: T.WALL,
    waterChance: 0.08,
    ores: [{tile:T.IRON,count:16,req:15},{tile:T.COAL,count:12,req:20},{tile:T.GOLD_ORE,count:12,req:40}],
    trees: [{tile:T.WILLOW,count:8},{tile:T.OAK,count:6}],
    enemies: [{tile:T.SKELETON,count:9},{tile:T.WOLF,count:6}],
    fishSpots: 2,
    hasShop: true,
    pathCount: 2,
    altBiomeChance: 0.3,
  },
  { // 2: Cursed Marshes — wet dark land
    name: 'THE CURSED MARSHES',
    baseTile: T.DARK_GRASS,
    altTile: T.GRASS,
    borderTile: T.WALL,
    waterChance: 0.30,
    ores: [{tile:T.MITHRIL,count:14,req:55},{tile:T.IRON,count:10,req:15},{tile:T.COAL,count:8,req:20}],
    trees: [{tile:T.WILLOW,count:20},{tile:T.NORMAL_TREE,count:6}],
    enemies: [{tile:T.SKELETON,count:10},{tile:T.GOBLIN,count:8},{tile:T.WOLF,count:5}],
    fishSpots: 6,
    hasShop: false,
    pathCount: 2,
    altBiomeChance: 0.15,
  },
  { // 3: Obsidian Depths — dark dungeon
    name: 'THE OBSIDIAN DEPTHS',
    baseTile: T.DUNGEON_FLOOR,
    altTile: T.STONE_FLOOR,
    borderTile: T.WALL,
    waterChance: 0.10,
    ores: [{tile:T.MITHRIL,count:10,req:55},{tile:T.GOLD_ORE,count:8,req:40},{tile:T.COAL,count:10,req:20}],
    trees: [],
    enemies: [{tile:T.SKELETON,count:14},{tile:T.WOLF,count:8}],
    fishSpots: 3,
    hasShop: false,
    pathCount: 1,
    altBiomeChance: 0.2,
  },
];

