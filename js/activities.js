// ======= ACTIVITIES =======
let combatEnemy = null;
let _combatPlayerTurn = false;

function startActivity(name, duration, onComplete){
  if(currentActivity) return;
  currentActivity=name;
  const bar=document.getElementById('activity-bar');
  const fill=document.getElementById('activity-progress-fill');
  const actName=document.getElementById('activity-name');
  bar.classList.add('show');
  actName.textContent=name.toUpperCase()+'...';
  fill.style.width='0%';
  let start=Date.now();

  // Mid-activity sound ticks
  const sfxInterval = name==='Mining' ? 900 : name==='Woodcutting' ? 1100 : name==='Fishing' ? 2200 : 0;
  let lastSfxTime = 0;

  function tick(){
    const now = Date.now();
    const pct=Math.min(100,(now-start)/duration*100);
    fill.style.width=pct+'%';

    // Fire mid-activity sound at intervals
    if(sfxInterval > 0 && now - lastSfxTime > sfxInterval && pct < 95) {
      lastSfxTime = now;
      if(name==='Mining')      SFX.mine();
      else if(name==='Woodcutting') SFX.chop();
      else if(name==='Fishing')     SFX.fish();
    }

    if(pct>=100){
      clearInterval(activityTimer);
      activityTimer=null;
      currentActivity=null;
      bar.classList.remove('show');
      fill.style.width='0%';
      onComplete();
    }
  }
  activityTimer=setInterval(tick,50);
}
function cancelActivity(){
  if(activityTimer){clearInterval(activityTimer);activityTimer=null;}
  currentActivity=null;
  document.getElementById('activity-bar').classList.remove('show');
  // Close combat panel if open
  if(combatEnemy !== null) {
    document.getElementById('combat-panel').classList.remove('show');
    combatEnemy = null;
    _combatPlayerTurn = false;
  }
}

// ======= MINING =======
function startMine(x,y,oreId,skill,xpAmt,duration){
  if(currentActivity){log('Already busy.','bad');return;}
  const p=state.players[state.activePlayer];
  const reqLvl={copper_ore:1,coal:20,iron_ore:15,gold_ore:40,mithril_ore:55}[oreId]||1;
  if(p.skills[skill].lvl<reqLvl){log(`Need level ${reqLvl} Mining.`,'bad');return;}
  log(`You start mining...`,'');
  flashTile(x,y);
  SFX.mine();
  startActivity('Mining',duration,()=>{
    SFX.mine();
    damagedTiles[`${x},${y}`]=0;
    addToInventory(oreId);
    buildInventory(); buildEquipPanel(); giveXP(skill,xpAmt);
    log(`You mine some ${ITEMS[oreId].name}.`,'good');
  });
}

// ======= WOODCUTTING =======
function startChop(x,y,logId,skill,xpAmt,duration){
  if(currentActivity){log('Already busy.','bad');return;}
  log(`You swing your axe...`,'');
  flashTile(x,y);
  SFX.chop();
  startActivity('Woodcutting',duration,()=>{
    SFX.chop();
    damagedTiles[`${x},${y}`]=0;
    addToInventory(logId);
    buildInventory(); buildEquipPanel(); giveXP(skill,xpAmt);
    log(`You chop some ${ITEMS[logId].name}.`,'good');
  });
}

// ======= FISHING SYSTEM =======
// Fish table: {id, name, icon, minLvl, tackle, zones, xp, healHp, rarity, weight}
const FISH_TABLE = [
  {id:'raw_shrimp',    name:'Shrimp',        icon:'🦐', minLvl:1,  tackle:['bait'],            zones:[0,1,2,3], xp:10,  healHp:3,  rarity:1.0,  weight:0.2},
  {id:'raw_trout',     name:'Trout',         icon:'🐟', minLvl:5,  tackle:['bait','fly'],       zones:[0,1,2,3], xp:50,  healHp:7,  rarity:0.75, weight:0.4},
  {id:'raw_salmon',    name:'Salmon',        icon:'🐠', minLvl:10, tackle:['fly'],              zones:[0,1,2,3], xp:70,  healHp:9,  rarity:0.65, weight:0.5},
  {id:'raw_pike',      name:'Pike',          icon:'🐡', minLvl:15, tackle:['bait','fly'],       zones:[1,2,3],   xp:90,  healHp:11, rarity:0.55, weight:0.6},
  {id:'raw_tuna',      name:'Tuna',          icon:'🐟', minLvl:20, tackle:['harpoon'],          zones:[2,3],     xp:115, healHp:14, rarity:0.45, weight:0.8},
  {id:'raw_swordfish', name:'Swordfish',     icon:'🐟', minLvl:35, tackle:['harpoon'],          zones:[2,3],     xp:155, healHp:18, rarity:0.30, weight:1.0},
  {id:'raw_shark',     name:'Shark',         icon:'🦈', minLvl:50, tackle:['harpoon'],          zones:[3],       xp:220, healHp:25, rarity:0.15, weight:1.5},
  {id:'raw_leviathan', name:'Leviathan Eel', icon:'🐍', minLvl:60, tackle:['harpoon'],          zones:[3],       xp:300, healHp:30, rarity:0.08, weight:2.0},
];

const COOKED = {
  raw_shrimp:'cooked_shrimp', raw_trout:'cooked_trout', raw_salmon:'cooked_salmon',
  raw_pike:'cooked_pike', raw_tuna:'cooked_tuna', raw_swordfish:'cooked_swordfish',
  raw_shark:'cooked_shark', raw_leviathan:'cooked_leviathan',
};

// Extend ITEMS with fish
Object.assign(ITEMS, {
  raw_shrimp:      {name:'Raw Shrimp',        icon:'🦐', color:'#d4a080'},
  raw_pike:        {name:'Raw Pike',           icon:'🐡', color:'#4a7a5a'},
  raw_tuna:        {name:'Raw Tuna',           icon:'🐟', color:'#3a5a8a'},
  raw_swordfish:   {name:'Raw Swordfish',      icon:'🐟', color:'#2a4a6a'},
  raw_shark:       {name:'Raw Shark',          icon:'🦈', color:'#3a4a5a'},
  raw_leviathan:   {name:'Raw Leviathan Eel',  icon:'🐍', color:'#1a3a2a'},
  cooked_shrimp:   {name:'Cooked Shrimp',      icon:'🍤', color:'#d47a40'},
  cooked_trout:    {name:'Cooked Trout',        icon:'🍗', color:'#8a6a2a'},
  cooked_salmon:   {name:'Cooked Salmon',       icon:'🍖', color:'#9a5a1a'},
  cooked_pike:     {name:'Cooked Pike',         icon:'🍗', color:'#7a6a3a'},
  cooked_tuna:     {name:'Cooked Tuna',         icon:'🍗', color:'#5a5a7a'},
  cooked_swordfish:{name:'Cooked Swordfish',    icon:'🍗', color:'#4a5a7a'},
  cooked_shark:    {name:'Cooked Shark',        icon:'🍗', color:'#5a6a7a'},
  cooked_leviathan:{name:'Cooked Leviathan',    icon:'🍗', color:'#3a5a4a'},
  bait:            {name:'Fishing Bait',        icon:'🪱', color:'#7a5a3a'},
  fly_lure:        {name:'Fly Lure',            icon:'🪰', color:'#5a3a8a'},
  harpoon:         {name:'Harpoon',             icon:'🔱', color:'#6a8a9a'},
});

function getItemActions(id){
  const item = ITEMS[id];
  if(!item) return [];

  // ── Rune cast actions ────────────────────────────────────────────────
  if(item.type === 'rune') {
    return [{
      icon: item.icon,
      label: `Cast ${item.name}`,
      action: (si) => castRune(si, id),
    }];
  }

  // ── Raw / cooked fish ────────────────────────────────────────────────
  const fish = FISH_TABLE.find(f=>f.id===id);
  if(fish) return [{icon:'🍽', label:`Eat Raw (heal ${fish.healHp} HP)`, action:(si)=>eatFood(si,fish.healHp)}];
  const cookedFish = Object.values(COOKED);
  if(cookedFish.includes(id)){
    const rawId = Object.keys(COOKED).find(k=>COOKED[k]===id);
    const f = FISH_TABLE.find(f=>f.id===rawId);
    const hp = f ? Math.floor(f.healHp*1.4) : 12;
    return [{icon:'🍽', label:`Eat (heal ${hp} HP)`, action:(si)=>eatFood(si,hp)}];
  }

  // ── Milk Bucket — drink milk, keep the bucket ─────────────────────────
  if(id === 'milk_bucket') {
    return [{icon:'🥛', label:`Drink Milk (heal ${item.healAmt} HP)`, action:(si)=>drinkMilk(si)}];
  }
  // ── Water Bucket — refreshing, keeps bucket ───────────────────────────
  if(id === 'water_bucket') {
    return [{icon:'💧', label:'Drink Water (refreshing)', action:(si)=>drinkWater(si)}];
  }

  // ── Generic food (healAmt > 0) ────────────────────────────────────────
  if(item.type === 'food' && item.healAmt > 0) {
    return [{icon:'🍽', label:`Eat (heal ${item.healAmt} HP)`, action:(si)=>eatFood(si,item.healAmt)}];
  }

  // ── Homestead Sigil ──────────────────────────────────────────────────
  if(id === 'home_sigil') {
    return [{icon:'🏡', label:'Teleport to Homestead', action:(si)=>{
      if(!questFlags.homestead_rewarded) questFlags.homestead_rewarded = true;
      log('The sigil pulses with warm light. You feel the homestead calling...', 'gold');
      enterInterior(makeHomeMap, 'YOUR HOMESTEAD');
    }}];
  }

  return [];
}

function eatFood(slotIdx, hp) {
  const p = state.players[state.activePlayer];
  if(p.hp >= p.maxHp) { log('You are already at full health.', 'bad'); return; }
  const item = p.inventory[slotIdx];
  if(!item) return;
  const it = ITEMS[item.id];
  const actual = Math.min(hp, p.maxHp - p.hp);
  p.hp = Math.min(p.maxHp, p.hp + hp);
  item.qty--;
  if(item.qty <= 0) p.inventory[slotIdx] = null;
  buildInventory(); updateHUD();
  log(`You eat the ${it.name}. Restored ${actual} HP.`, 'good');
  SFX.eat && SFX.eat();
}

function drinkMilk(slotIdx) {
  const p = state.players[state.activePlayer];
  if(p.hp >= p.maxHp) { log('You are already at full health.', 'bad'); return; }
  const item = p.inventory[slotIdx];
  if(!item) return;
  const hp = ITEMS.milk_bucket.healAmt;
  const actual = Math.min(hp, p.maxHp - p.hp);
  p.hp = Math.min(p.maxHp, p.hp + hp);
  // Replace milk_bucket with wooden_bucket in the same slot
  item.qty--;
  if(item.qty <= 0) p.inventory[slotIdx] = null;
  addToInventory('wooden_bucket');
  buildInventory(); updateHUD();
  log(`You drink the milk. Restored ${actual} HP. (You keep the bucket.)`, 'good');
  SFX.eat && SFX.eat();
}

function drinkWater(slotIdx) {
  const p = state.players[state.activePlayer];
  const item = p.inventory[slotIdx];
  if(!item) return;
  item.qty--;
  if(item.qty <= 0) p.inventory[slotIdx] = null;
  addToInventory('wooden_bucket');
  buildInventory(); updateHUD();
  log('You drink the cool well water. Refreshing.', 'good');
}

function grindWheat() {
  if(countInInventory('wheat') < 1) { log('You need wheat to grind at the windmill.', 'bad'); return; }
  removeFromInventory('wheat', 1);
  addToInventory('flour');
  buildInventory();
  giveXP('Farming', 5);
  log('The millstone grinds the wheat into fine flour. (+5 Farming xp)', 'good');
}

function churnButter() {
  if(countInInventory('milk_bucket') < 1) { log('You need a Milk Bucket to churn butter.', 'bad'); return; }
  removeFromInventory('milk_bucket', 1);
  addToInventory('butter');
  addToInventory('wooden_bucket');
  buildInventory();
  giveXP('Farming', 6);
  log('You churn the milk into rich butter — and keep the bucket. (+6 Farming xp)', 'good');
}

// ── Rune casting ────────────────────────────────────────────────────────
function castRune(slotIdx, runeId) {
  const p = state.players[state.activePlayer];
  const rune = ITEMS[runeId];
  if(!rune) return;

  const magicLvl = p.skills.Magic ? p.skills.Magic.lvl : 1;
  if(magicLvl < rune.magicReqLvl) {
    log(`You need level ${rune.magicReqLvl} Magic to cast ${rune.name}.`, 'bad');
    return;
  }

  // Consume the rune
  removeFromInventory(runeId, 1);
  buildInventory();

  // Staff of Aldermast amplifies magic by 25%
  const bonuses = getEquipBonuses(p);
  const staffAmp = bonuses.magicBonus >= 5 ? 1.25 : 1.0;

  if(rune.isHeal) {
    // Heal rune
    const healAmt = Math.floor((rune.healMin + Math.random()*(rune.healMax - rune.healMin)) * staffAmp);
    const actual = Math.min(healAmt, p.maxHp - p.hp);
    p.hp = Math.min(p.maxHp, p.hp + healAmt);
    giveXP('Magic', rune.xp);
    updateHUD(); buildInventory();
    log(`✨ ${rune.name}: You restore ${actual} HP. (+${rune.xp} Magic xp)`, 'good');
    SFX.rune && SFX.rune();
    return;
  }

  if(rune.isShield) {
    magicShieldExpiry = Date.now() + 30000;
    giveXP('Magic', rune.xp);
    log(`🛡 ${rune.name}: Defence +8 for 30 seconds. (+${rune.xp} Magic xp)`, 'good');
    SFX.rune && SFX.rune();
    return;
  }

  // Offensive rune — needs a target enemy
  const combatEnemies = enemies.filter(e => e.state === 'attack' || e.state === 'chase');
  if(!combatEnemies.length) {
    // Out of combat — find nearest enemy to zap
    const nearby = enemies.filter(e => e.state !== 'dead' && dist(e.x,e.y,playerPos.x,playerPos.y) <= 4);
    if(!nearby.length) {
      log(`No enemy in range to cast ${rune.name}. Move closer to a foe.`, 'bad');
      // Rune is already consumed — refund it
      addToInventory(runeId); buildInventory();
      return;
    }
    combatEnemies.push(...nearby);
  }
  const target = combatEnemies[0];
  const dmg = Math.floor((rune.dmgMin + Math.random()*(rune.dmgMax - rune.dmgMin + 1)) * staffAmp) + Math.floor(magicLvl * 0.3);
  target.hp -= dmg;
  target.flashTimer = 1;
  giveXP('Magic', rune.xp);
  SFX.hit && SFX.hit();
  log(`✨ ${rune.name}: You strike the ${target.def.name} for ${dmg} damage! (+${rune.xp} Magic xp)`, 'good');

  if(rune.effect === 'slow' && target.moveSpeed) {
    const origSpeed = target.moveSpeed;
    target.moveSpeed = Math.max(0.5, origSpeed * 0.5);
    setTimeout(()=>{ if(target.state !== 'dead') target.moveSpeed = origSpeed; }, 4000);
    log(`❄ The ${target.def.name} is slowed!`, '');
  }

  if(target.hp <= 0) {
    target.state = 'dead'; target.hp = 0;
    giveXP('Attack', Math.floor(target.def.xp * 0.5));
    giveXP('Magic', Math.floor(target.def.xp * 0.5));
    p.gold += target.def.gold;
    updateHUD();
    log(`✓ Defeated the ${target.def.name}! +${target.def.gold}g`, 'gold');
    addToInventory('bones');
    const isDungeon = currentMap && currentMap.isInterior;
    if(!isDungeon) {
      const respawnMs = (300 + Math.random()*300) * 1000;
      setTimeout(()=>respawnEnemy(target), respawnMs);
    }
    buildInventory(); buildEquipPanel();
  }
}

// Fishing spot state (tracks depletion per tile)
const fishingSpots = {}; // key: "x,y" => {depleted:bool, timer:null, fish:[{...}]}

function getFishingSpot(x,y){
  const key=`${x},${y}`;
  if(!fishingSpots[key]){
    fishingSpots[key]={depleted:false,replenishTimer:null};
  }
  return fishingSpots[key];
}

function openFishingMenu(tx,ty,tacklePref){
  // Already have tackle?
  const p=state.players[state.activePlayer];
  const tackleItems={bait:'bait',fly:'fly_lure',harpoon:'harpoon'};
  const tackleNeeded=tackleItems[tacklePref];
  if(countInInventory(tackleNeeded)<1){
    log(`You need ${ITEMS[tackleNeeded].name} to fish like this. Buy some at a shop.`,'bad');
    return;
  }
  startFish(tx,ty,tacklePref);
}

// Active fishing minigame state
let fishingState = null;
let fishingCanvas = null;
let fishingAnimFrame = null;

function startFish(tx,ty,tackle){
  if(currentActivity){log('Already busy.','bad');return;}
  const p=state.players[state.activePlayer];
  const spot=getFishingSpot(tx,ty);
  if(spot.depleted){log('This spot is fished out. Wait for it to recover.','bad');return;}

  currentActivity='Fishing';
  const lvl=p.skills.Fishing.lvl;

  // Pick a fish based on level, tackle, zone, rarity
  const eligible=FISH_TABLE.filter(f=>
    f.minLvl<=lvl && f.tackle.includes(tackle) && f.zones.includes(zoneIndex)
  );
  if(eligible.length===0){
    currentActivity=null;
    log('No fish available here with this tackle.','bad');
    return;
  }
  // Weighted random
  const totalWeight=eligible.reduce((a,f)=>a+f.rarity*(1+lvl*0.01),0);
  let roll=Math.random()*totalWeight;
  let chosenFish=eligible[0];
  for(const f of eligible){
    roll-=f.rarity*(1+lvl*0.01);
    if(roll<=0){chosenFish=f;break;}
  }

  log(`You cast your line with ${ITEMS[tackle==='bait'?'bait':tackle==='fly'?'fly_lure':'harpoon'].name}...`,'');
  showFishingMinigame(tx,ty,chosenFish,tackle,lvl);
}

function showFishingMinigame(tx,ty,fish,tackle,lvl){
  // Build overlay
  const existing=document.getElementById('fishing-overlay');
  if(existing)existing.remove();

  const overlay=document.createElement('div');
  overlay.id='fishing-overlay';
  overlay.style.cssText=`position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;pointer-events:none;`;

  const panel=document.createElement('div');
  panel.style.cssText=`
    background:rgba(8,10,14,0.97);border:1px solid var(--gold-dim);
    padding:20px;width:320px;pointer-events:all;
    box-shadow:0 0 40px rgba(0,0,0,0.9),0 0 20px rgba(200,146,42,0.1);
    display:flex;flex-direction:column;gap:12px;
  `;
  panel.innerHTML=`
    <div style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:3px;color:var(--gold-dim);text-align:center;">🎣 FISHING</div>
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="font-size:36px;">${fish.icon}</span>
      <div>
        <div style="font-family:'Cinzel',serif;font-size:13px;color:var(--gold-bright);">Something is biting...</div>
        <div style="font-size:12px;color:var(--text-dim);">Min level: ${fish.minLvl} &nbsp;·&nbsp; ${tackle} fishing</div>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text-dim);font-style:italic;text-align:center;" id="fish-status">Waiting for a bite...</div>
    <canvas id="fish-minigame" width="280" height="60" style="display:block;margin:0 auto;background:#050810;border:1px solid var(--border);"></canvas>
    <div style="display:flex;gap:8px;align-items:center;">
      <div style="flex:1;background:#0a0c10;border:1px solid var(--border);height:10px;">
        <div id="fish-tension-bar" style="height:100%;width:50%;background:linear-gradient(90deg,#2d9448,#c8922a);transition:width 0.1s;"></div>
      </div>
      <span style="font-family:'Cinzel',serif;font-size:10px;color:var(--text-dim);letter-spacing:1px;">TENSION</span>
    </div>
    <div style="display:flex;gap:8px;">
      <button id="fish-reel-btn" style="flex:1;background:linear-gradient(180deg,#1a2a10,#0e1a08);border:1px solid var(--green);
        color:var(--green-bright);font-family:'Cinzel',serif;font-size:11px;letter-spacing:2px;padding:10px;cursor:pointer;">
        🎣 REEL IN
      </button>
      <button onclick="cancelFishing()" style="background:transparent;border:1px solid var(--border);
        color:var(--text-dim);font-family:'Cinzel',serif;font-size:9px;letter-spacing:1px;padding:10px 12px;cursor:pointer;">
        STOP
      </button>
    </div>
  `;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Minigame logic
  const mgCanvas=document.getElementById('fish-minigame');
  const mgCtx=mgCanvas.getContext('2d');
  const reelBtn=document.getElementById('fish-reel-btn');
  const statusEl=document.getElementById('fish-status');
  const tensionBar=document.getElementById('fish-tension-bar');

  let phase='waiting'; // waiting | biting | reeling | done
  let tension=50;      // 0-100 — snap if >90, lose if <10 while biting
  let catchZoneX=100;  // moving target zone
  let catchZoneDir=1;
  let indicatorX=140;
  let indicatorDir=1.5+Math.random()*1.5;
  let biteTimer=null;
  let frameId=null;
  let reeling=false;
  let waitTime=2000+Math.random()*3000+(fish.minLvl*40);

  // Schedule bite
  biteTimer=setTimeout(()=>{
    if(phase!=='waiting')return;
    phase='biting';
    statusEl.textContent='A fish is biting! Reel in!';
    statusEl.style.color='var(--gold-bright)';
    // Bite timeout: if you don't start reeling fast, it escapes
    biteTimer=setTimeout(()=>{
      if(phase==='biting'){
        phase='done';
        statusEl.textContent='The fish got away!';
        statusEl.style.color='var(--red-bright)';
        closeFishingMinigame();
        log('The fish slipped off the hook.','bad');
        currentActivity=null;
      }
    },4000);
  },waitTime);

  // Minigame draw loop
  function drawMG(){
    mgCtx.clearRect(0,0,280,60);
    // Water bg
    mgCtx.fillStyle='#050a12';
    mgCtx.fillRect(0,0,280,60);
    // Wave lines
    mgCtx.strokeStyle='rgba(30,80,140,0.3)'; mgCtx.lineWidth=1;
    for(let i=0;i<4;i++){
      mgCtx.beginPath();
      for(let x=0;x<280;x++){
        const y=30+Math.sin((x*0.04)+(Date.now()*0.002)+(i*1.5))*6+i*4;
        if(x===0)mgCtx.moveTo(x,y); else mgCtx.lineTo(x,y);
      }
      mgCtx.stroke();
    }

    if(phase==='biting'||phase==='reeling'){
      // Catch zone (green area to keep indicator in)
      const zoneW=60-Math.max(0,(tension-60)*0.8);
      mgCtx.fillStyle='rgba(45,148,72,0.25)';
      mgCtx.fillRect(catchZoneX,5,zoneW,50);
      mgCtx.strokeStyle='rgba(45,148,72,0.6)'; mgCtx.lineWidth=1;
      mgCtx.strokeRect(catchZoneX,5,zoneW,50);

      // Indicator
      const inZone=indicatorX>=catchZoneX&&indicatorX<=(catchZoneX+zoneW);
      const indColor=inZone?'#e8b84b':'#c43030';
      mgCtx.fillStyle=indColor;
      mgCtx.beginPath();
      mgCtx.moveTo(indicatorX,8); mgCtx.lineTo(indicatorX+8,52); mgCtx.lineTo(indicatorX-8,52);
      mgCtx.closePath(); mgCtx.fill();

      // Fish icon near indicator
      mgCtx.font='14px serif'; mgCtx.textAlign='center';
      mgCtx.fillText(fish.icon, indicatorX, 35);

      // Tension coloring
      const tColor=tension>75?'#c43030':tension>45?'#c8922a':'#2d9448';
      tensionBar.style.background=`linear-gradient(90deg,#2d9448,${tColor})`;
      tensionBar.style.width=tension+'%';
    } else {
      tensionBar.style.width='50%';
    }

    frameId=requestAnimationFrame(drawMG);
  }
  frameId=requestAnimationFrame(drawMG);

  // Physics update
  let lastPhysics=Date.now();
  function physicsTick(){
    if(phase==='done')return;
    const now=Date.now(), dt=(now-lastPhysics)/1000;
    lastPhysics=now;

    if(phase==='biting'||phase==='reeling'){
      // Move catch zone
      catchZoneX+=catchZoneDir*(30+fish.weight*15)*dt;
      if(catchZoneX<0){catchZoneX=0;catchZoneDir=Math.abs(catchZoneDir);}
      if(catchZoneX>210){catchZoneX=210;catchZoneDir=-Math.abs(catchZoneDir);}

      // Move indicator — faster for harder fish
      indicatorX+=indicatorDir*(50+fish.weight*20)*dt;
      if(indicatorX<5){indicatorX=5;indicatorDir=Math.abs(indicatorDir)+Math.random()*0.5-0.25;}
      if(indicatorX>275){indicatorX=275;indicatorDir=-(Math.abs(indicatorDir)+Math.random()*0.5-0.25);}

      const inZone=indicatorX>=catchZoneX&&indicatorX<=(catchZoneX+60);

      if(phase==='reeling'){
        if(reeling&&inZone){
          tension=Math.max(0,tension-18*dt);
        } else if(reeling&&!inZone){
          tension=Math.min(100,tension+30*dt);
        } else {
          tension=Math.min(100,tension+12*dt);
        }
        // Snap line!
        if(tension>=98){
          phase='done';
          statusEl.textContent='Line snapped! Too much tension!';
          statusEl.style.color='var(--red-bright)';
          closeFishingMinigame();
          log('Your line snapped — the fish escaped!','bad');
          currentActivity=null;
          return;
        }
        // Caught!
        if(tension<=2){
          phase='done';
          catchFish(tx,ty,fish);
          closeFishingMinigame();
          return;
        }
      }
    }
    if(phase!=='done') setTimeout(physicsTick,16);
  }
  setTimeout(physicsTick,16);

  // Reel button: hold = reel
  reelBtn.addEventListener('mousedown',()=>{
    if(phase==='biting'){phase='reeling'; statusEl.textContent='Reeling in — keep the indicator in the zone!'; statusEl.style.color='var(--text-bright)';}
    reeling=true;
  });
  reelBtn.addEventListener('mouseup',()=>{reeling=false;});
  reelBtn.addEventListener('mouseleave',()=>{reeling=false;});
  reelBtn.addEventListener('touchstart',e=>{e.preventDefault();reeling=true;if(phase==='biting')phase='reeling';});
  reelBtn.addEventListener('touchend',()=>{reeling=false;});

  fishingState={biteTimer,frameId,overlay,phase:()=>phase,setDone:()=>{phase='done';}};
}

function catchFish(tx,ty,fish){
  const p=state.players[state.activePlayer];
  addToInventory(fish.id);
  buildInventory(); buildEquipPanel(); giveXP('Fishing',fish.xp);
  log(`✓ You caught a ${fish.name}! (+${fish.xp} XP)`,'good');

  // Chance to deplete spot
  const spot=getFishingSpot(tx,ty);
  if(Math.random()<0.25){
    spot.depleted=true;
    log('The fishing spot looks depleted. It will recover soon.','info');
    spot.replenishTimer=setTimeout(()=>{
      spot.depleted=false;
      log('A fishing spot has replenished.','info');
    },30000+Math.random()*30000);
  }
  currentActivity=null;
}

function closeFishingMinigame(){
  if(fishingState){
    if(fishingState.biteTimer)clearTimeout(fishingState.biteTimer);
    if(fishingState.frameId)cancelAnimationFrame(fishingState.frameId);
    fishingState.setDone();
  }
  const ov=document.getElementById('fishing-overlay');
  if(ov)ov.remove();
  fishingState=null;
}

function cancelFishing(){
  closeFishingMinigame();
  currentActivity=null;
  log('You stop fishing.','');
}

// ======= ENEMY ENTITY SYSTEM =======
// Enemies are no longer stored as tile values — they're live objects.
// The map tiles T.GOBLIN / T.SKELETON / T.WOLF are used only during world gen
// to mark spawn positions, then immediately converted to entities.

const ENEMY_DEFS = {
  [T.GOBLIN]:   { name:'Goblin',   letter:'G', bg:'#1a3a0e', col:'#4a8a24', minDmg:3,  maxDmg:8,  hp:18,  xp:12, gold:8,  aggroRange:5, speed:1.8, patrolRadius:4 },
  [T.SKELETON]: { name:'Skeleton', letter:'S', bg:'#2a2418', col:'#8a7a60', minDmg:5,  maxDmg:12, hp:28,  xp:18, gold:14, aggroRange:6, speed:1.4, patrolRadius:3 },
  [T.WOLF]:     { name:'Wolf',     letter:'W', bg:'#1a1820', col:'#6a6870', minDmg:4,  maxDmg:10, hp:22,  xp:15, gold:10, aggroRange:7, speed:2.4, patrolRadius:5 },
  [T.CULTIST]:  { name:'Cultist',  letter:'C', bg:'#1a0a1e', col:'#8a3aaa', minDmg:6,  maxDmg:14, hp:32,  xp:22, gold:18, aggroRange:7, speed:1.6, patrolRadius:5 },
  [T.ZOMBIE]:   { name:'Zombie',   letter:'Z', bg:'#1a2a10', col:'#4a7a3a', minDmg:4,  maxDmg:11, hp:35,  xp:20, gold:12, aggroRange:4, speed:0.9, patrolRadius:3, moveSpeed:0.9 },
  [T.SHADOW_WALKER]: { name:'Shadow Walker', letter:'Ŝ', bg:'#08080f', col:'#4a3a6a', minDmg:5, maxDmg:13, hp:30, xp:22, gold:15, aggroRange:5, speed:1.5, patrolRadius:2, isShadowWalker:true },
};

let enemies = []; // active enemy entities
let enemyIdCounter = 0;

// ---- CHAPEL CULTIST NIGHT SPAWN ----
// Cultists only appear in the chapel after dusk (getNightAlpha > 0.5).
// They despawn at dawn and are replaced by an empty, eerie chapel.

const CULTIST_SPAWNS = [
  // [y, x] positions inside the chapel map
  [9,13],[13,26],[17,14],[20,28],  // nave patrol
  [11,4],[12,39],                  // transept guards
  [5,14],[5,27],                   // altar guards
];

let _chapelCultistsActive = false; // tracks whether cultists are currently spawned

function spawnChapelCultists() {
  if(!currentMap || currentMap.name !== 'THE FORSAKEN CHAPEL') return;
  // Remove any existing cultists first (avoid doubling)
  enemies = enemies.filter(e => e.def !== ENEMY_DEFS[T.CULTIST]);
  const def = ENEMY_DEFS[T.CULTIST];
  CULTIST_SPAWNS.forEach(([sy, sx]) => {
    // Only spawn if tile is walkable stone floor
    const t = currentMap.tiles[sy]?.[sx];
    if(t === T.STONE_FLOOR || t === T.DUNGEON_FLOOR || t === T.COBBLE) {
      enemies.push({
        id: enemyIdCounter++, type: T.CULTIST, def,
        x:sx, y:sy, homeX:sx, homeY:sy,
        rx:sx, ry:sy,
        hp:def.hp, maxHp:def.hp,
        state:'patrol',
        patrolX:sx, patrolY:sy, patrolTimer:Math.random()*3,
        moveTimer:0, moveSpeed:def.speed,
        attackTimer:0, flashTimer:0, engaged:false,
      });
    }
  });
  _chapelCultistsActive = true;
}

function despawnChapelCultists() {
  enemies = enemies.filter(e => e.def !== ENEMY_DEFS[T.CULTIST]);
  _chapelCultistsActive = false;
}

function tickChapelCultists() {
  if(!currentMap || currentMap.name !== 'THE FORSAKEN CHAPEL') {
    // Left the chapel — reset tracker
    if(_chapelCultistsActive) { _chapelCultistsActive = false; }
    return;
  }
  const isNight = getNightAlpha() > 0.5;
  if(isNight && !_chapelCultistsActive) {
    spawnChapelCultists();
    log('Shadows move between the pillars. You are no longer alone.','bad');
  } else if(!isNight && _chapelCultistsActive) {
    despawnChapelCultists();
    log('With the coming of dawn, the figures dissolve into nothing.','info');
  }
}

function spawnEnemiesFromMap() {
  enemies = [];
  if(!currentMap) return;
  const {tiles, W, H} = currentMap;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    const t = tiles[y][x];
    if(ENEMY_DEFS[t]) {
      const def = ENEMY_DEFS[t];
      enemies.push({
        id: enemyIdCounter++,
        type: t,
        def,
        // tile-space position (can be fractional during movement)
        x: x, y: y,
        // home position for patrol
        homeX: x, homeY: y,
        // smooth render position
        rx: x, ry: y,
        hp: def.hp, maxHp: def.hp,
        state: 'patrol',   // patrol | chase | attack | dead
        // patrol target
        patrolX: x, patrolY: y,
        patrolTimer: Math.random()*3,
        // movement
        moveTimer: 0,
        moveSpeed: def.speed,
        // attack
        attackTimer: 0,
        // flash on hit
        flashTimer: 0,
        // engaged player (for combat tracking)
        engaged: false,
      });
      // Remove from static tile map
      tiles[y][x] = T.GRASS;
    }
  }
}

// Tile passable check for enemy movement
const ENEMY_SOLID = new Set([
  T.WALL, T.WATER,
  T.COPPER, T.IRON, T.GOLD_ORE, T.MITHRIL, T.COAL,
  T.NORMAL_TREE, T.OAK, T.WILLOW,
  T.SMELTER, T.COOKING_FIRE, T.SHOP,
  T.INN_DOOR, T.EXIT_INTERIOR, T.EXIT, T.EXIT_RETURN, T.CHAPEL_PORTAL,
]);
function enemyCanMove(tx, ty) {
  if(!currentMap) return false;
  const {tiles,W,H} = currentMap;
  if(tx<1||tx>=W-1||ty<1||ty>=H-1) return false;
  if(ENEMY_SOLID.has(tiles[ty][tx])) return false;
  // Don't stack on another enemy
  if(enemies.some(e=> Math.round(e.x)===tx && Math.round(e.y)===ty && e.state!=='dead')) return false;
  return true;
}

function dist(ax,ay,bx,by){ return Math.sqrt((ax-bx)**2+(ay-by)**2); }

// Simple one-step move toward target for enemies (no full BFS, just greedy step)
function enemyStepToward(e, tx, ty) {
  const dx = tx - e.x, dy = ty - e.y;
  if(Math.abs(dx)<0.1 && Math.abs(dy)<0.1) return;
  // Try horizontal and vertical steps
  const steps = [];
  if(Math.abs(dx)>=Math.abs(dy)) {
    steps.push([Math.sign(dx),0],[0,Math.sign(dy)],[Math.sign(dx),Math.sign(dy)]);
  } else {
    steps.push([0,Math.sign(dy)],[Math.sign(dx),0],[Math.sign(dx),Math.sign(dy)]);
  }
  for(const [sx,sy] of steps) {
    if(sx===0&&sy===0) continue;
    const nx=Math.round(e.x)+sx, ny=Math.round(e.y)+sy;
    if(enemyCanMove(nx,ny)) {
      e.x = nx; e.y = ny;
      return;
    }
  }
}

// Returns true if (x, y) is within 5 Chebyshev tiles of any portal in the current map.
// Used to keep Whisperwood enemies away from portal entrances.
function _enemyInPortalZone(x, y) {
  if(!currentMap || !currentMap.portalPositions) return false;
  return currentMap.portalPositions.some(([px,py]) =>
    Math.abs(x-px) <= 5 && Math.abs(y-py) <= 5
  );
}

let lastEnemyTick = 0;
function tickEnemies(now) {
  if(!currentMap || !enemies.length) return;
  const dt = Math.min(0.1, (now - lastEnemyTick)/1000);
  lastEnemyTick = now;

  const px = playerPos.x, py = playerPos.y;

  for(const e of enemies) {
    if(e.state==='dead') continue;

    // Shadow Walker special AI — adjusts behaviour based on time of day
    if(e.def.isShadowWalker) updateShadowWalker(e, dt);

    // Smooth render position lerp
    e.rx += (e.x - e.rx) * Math.min(1, dt * 12);
    e.ry += (e.y - e.ry) * Math.min(1, dt * 12);

    // Flash decay
    if(e.flashTimer>0) e.flashTimer = Math.max(0, e.flashTimer - dt*3);

    const dPlayer = dist(e.x, e.y, px, py);

    // ---- STATE MACHINE ----
    // Ignore player if they recently fled (3-minute cooldown)
    const isIgnoring = e.ignoreUntil && Date.now() < e.ignoreUntil;

    if(e.state==='patrol') {
      // Aggro check — skip if currently ignoring this player
      if(!isIgnoring && dPlayer <= e.def.aggroRange) {
        e.state = 'chase';
        continue;
      }
      // Patrol: wander near home
      e.patrolTimer -= dt;
      if(e.patrolTimer <= 0) {
        // Pick new patrol target near home
        const angle = Math.random()*Math.PI*2;
        const r = 1 + Math.random()*e.def.patrolRadius;
        let ptx = Math.round(e.homeX + Math.cos(angle)*r);
        let pty = Math.round(e.homeY + Math.sin(angle)*r);
        // If target lands in portal exclusion zone, flip to opposite side of home
        if(_enemyInPortalZone(ptx, pty)) {
          ptx = Math.round(e.homeX - Math.cos(angle)*r);
          pty = Math.round(e.homeY - Math.sin(angle)*r);
        }
        e.patrolX = ptx;
        e.patrolY = pty;
        e.patrolTimer = 2 + Math.random()*4;
      }
      e.moveTimer -= dt;
      if(e.moveTimer <= 0) {
        const dPat = dist(e.x,e.y,e.patrolX,e.patrolY);
        // If enemy has drifted into the portal zone, step back toward home
        if(_enemyInPortalZone(Math.round(e.x), Math.round(e.y))) {
          enemyStepToward(e, e.homeX, e.homeY);
        } else if(dPat > 0.5) {
          enemyStepToward(e, e.patrolX, e.patrolY);
        }
        e.moveTimer = 1/e.moveSpeed * (0.8+Math.random()*0.4);
      }

    } else if(e.state==='chase') {
      // Drop chase if: ignoring, too far, enemy entered portal zone, or player is in portal zone
      // (portals act as safe zones — enemies won't follow the player through them)
      const enemyInZone = _enemyInPortalZone(Math.round(e.x), Math.round(e.y));
      const playerInZone = _enemyInPortalZone(Math.round(px), Math.round(py));
      if(isIgnoring || dPlayer > e.def.aggroRange * 1.8 || enemyInZone || playerInZone) {
        e.state = 'patrol';
        e.patrolTimer = 1;
        continue;
      }
      // Adjacent = attack
      if(dPlayer <= 1.5) {
        e.state = 'attack';
        continue;
      }
      // Move toward player
      e.moveTimer -= dt;
      if(e.moveTimer <= 0) {
        enemyStepToward(e, px, py);
        e.moveTimer = 1/e.moveSpeed * (0.7+Math.random()*0.3);
      }

    } else if(e.state==='attack') {
      // If player walks away or retreats to portal zone, drop back to chase
      if(dPlayer > 2 || _enemyInPortalZone(Math.round(px), Math.round(py))) { e.state='chase'; continue; }

      e.attackTimer -= dt;
      if(e.attackTimer <= 0) {
        // Auto-initiate combat if player isn't already in one
        if(!currentActivity) {
          const def = e.def;
          triggerEnemyAttack(e);
        }
        e.attackTimer = 1.2 + Math.random()*0.4;
      }
    }
  }
}

// When an enemy enters attack range, it pulls the player into combat
function triggerEnemyAttack(e) {
  if(currentActivity) return;
  const def = e.def;
  // Bump the player slightly (visual only) and start combat against this specific entity
  startCombatEntity(e);
}

// ======= TURN-BASED COMBAT =======
function startCombatEntity(e) {
  if(currentActivity) return;
  if(e.state==='dead') return;
  currentActivity = 'Combat';
  combatEnemy = e;
  _combatPlayerTurn = false;

  const portrait = document.getElementById('combat-enemy-portrait');
  portrait.textContent = e.def.letter;
  portrait.style.color = e.def.col;
  portrait.style.borderColor = e.def.col;
  document.getElementById('combat-enemy-name').textContent = e.def.name.toUpperCase();
  document.getElementById('combat-log').innerHTML = '';
  document.getElementById('combat-status').textContent = '';
  _updateCombatPanel();
  _addCombatLog(`You face the ${e.def.name}. What will you do?`);
  document.getElementById('combat-panel').classList.add('show');
  log(`⚔ You engage the ${e.def.name}!`, 'bad');

  // Show flee % on button based on Attack level vs enemy speed
  const p = state.players[state.activePlayer];
  const attackBonus = Math.min(0.4, (p.skills.Attack.lvl - 1) / 98 * 0.4);
  const speedPenalty = Math.max(0, (e.def.speed - 1.5) * 0.08);
  const fleePct = Math.round(Math.min(0.9, Math.max(0.15, 0.3 + attackBonus - speedPenalty)) * 100);
  document.getElementById('btn-combat-flee').textContent = `↩ Flee (${fleePct}%)`;

  _setCombatButtons(false);
  setTimeout(() => { _combatPlayerTurn = true; _setCombatButtons(true); }, 500);
}

function _updateCombatPanel() {
  const p = state.players[state.activePlayer];
  const e = combatEnemy;
  const ePct = Math.max(0, e.hp / e.maxHp);
  const eBar = document.getElementById('combat-enemy-hp-bar');
  eBar.style.width = (ePct * 100) + '%';
  eBar.style.background = ePct > 0.5 ? '#2d9448' : ePct > 0.25 ? '#c8922a' : '#c43030';
  document.getElementById('combat-enemy-hp-text').textContent = `${Math.max(0,e.hp)} / ${e.maxHp}`;
  const pPct = Math.max(0, p.hp / p.maxHp);
  const pBar = document.getElementById('combat-player-hp-bar');
  pBar.style.width = (pPct * 100) + '%';
  pBar.style.background = pPct > 0.5 ? '#2d9448' : pPct > 0.25 ? '#c8922a' : '#c43030';
  document.getElementById('combat-player-hp-text').textContent = `${Math.max(0,p.hp)} / ${p.maxHp}`;
}

function _addCombatLog(msg, cls='') {
  const logEl = document.getElementById('combat-log');
  const line = document.createElement('div');
  line.className = 'combat-log-line' + (cls ? ' ' + cls : '');
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function _setCombatButtons(enabled) {
  document.getElementById('btn-combat-attack').disabled = !enabled;
  document.getElementById('btn-combat-flee').disabled = !enabled;
}

function _closeCombatPanel() {
  document.getElementById('combat-panel').classList.remove('show');
  currentActivity = null;
  combatEnemy = null;
  _combatPlayerTurn = false;
}

function combatPlayerAttack() {
  if(!_combatPlayerTurn || !combatEnemy) return;
  _combatPlayerTurn = false;
  _setCombatButtons(false);

  const p = state.players[state.activePlayer];
  const e = combatEnemy;
  const bonuses = getEquipBonuses(p);
  const dmg = Math.floor(Math.random() * ((p.skills.Strength.lvl + bonuses.strBonus) * 2 + 4)) + 1 + Math.floor(bonuses.attackBonus / 3);
  e.hp -= dmg;
  e.flashTimer = 0.6;
  SFX.hit();
  _addCombatLog(`You strike the ${e.def.name} for ${dmg} damage.`, 'combat-log-hit');
  log(`You hit the ${e.def.name} for ${dmg}.`, '');
  _updateCombatPanel();

  if(e.hp <= 0) { _combatVictory(); return; }

  document.getElementById('combat-status').textContent = `${e.def.name} prepares to strike...`;
  setTimeout(_combatEnemyTurn, 800 + Math.random() * 300);
}

function _combatEnemyTurn() {
  const p = state.players[state.activePlayer];
  const e = combatEnemy;
  if(!e || e.state === 'dead') return;

  document.getElementById('combat-status').textContent = '';
  const defBonus = Math.max(0, p.skills.Defence.lvl - 3) + getEquipBonuses(p).defBonus;
  const rawDmg = Math.floor(Math.random() * (e.def.maxDmg - e.def.minDmg + 1)) + e.def.minDmg;
  const actualDmg = Math.max(0, rawDmg - defBonus);

  if(actualDmg > 0) {
    p.hp = Math.max(0, p.hp - actualDmg);
    SFX.hit();
    _addCombatLog(`The ${e.def.name} strikes you for ${actualDmg} damage.`, 'combat-log-bad');
    log(`The ${e.def.name} hits you for ${actualDmg}.`, 'bad');
  } else {
    _addCombatLog(`The ${e.def.name}'s attack glances off your armour.`, 'combat-log-dim');
  }

  _updateCombatPanel();
  updateHUD();

  if(p.hp <= 0) { _combatDefeat(); return; }

  _combatPlayerTurn = true;
  _setCombatButtons(true);
}

function combatFlee() {
  if(!_combatPlayerTurn || !combatEnemy) return;
  _combatPlayerTurn = false;
  _setCombatButtons(false);

  const p = state.players[state.activePlayer];
  const e = combatEnemy;
  // Attack level gives up to +40% flee chance (scales from lvl 1 to 99)
  const attackBonus = Math.min(0.4, (p.skills.Attack.lvl - 1) / 98 * 0.4);
  const speedPenalty = Math.max(0, (e.def.speed - 1.5) * 0.08);
  const fleeChance = Math.min(0.9, Math.max(0.15, 0.3 + attackBonus - speedPenalty));
  const pct = Math.round(fleeChance * 100);

  if(Math.random() < fleeChance) {
    _addCombatLog(`You create an opening and escape! (${pct}% chance)`, 'combat-log-dim');
    log(`You fled from the ${e.def.name}.`, 'info');
    // Enemy ignores player for 3 minutes
    e.ignoreUntil = Date.now() + 3 * 60 * 1000;
    e.state = 'patrol';
    e.patrolTimer = 2;
    setTimeout(_closeCombatPanel, 1000);
  } else {
    _addCombatLog(`You couldn't escape! (${pct}% chance) The ${e.def.name} blocks your path.`, 'combat-log-bad');
    document.getElementById('combat-status').textContent = `${e.def.name} attacks as you try to flee...`;
    setTimeout(_combatEnemyTurn, 900);
  }
}

function _combatVictory() {
  const p = state.players[state.activePlayer];
  const e = combatEnemy;
  e.state = 'dead';
  e.hp = 0;
  giveXP('Attack', e.def.xp);
  giveXP('Strength', e.def.xp);
  giveXP('Defence', Math.floor(e.def.xp * 0.5));
  giveXP('Hitpoints', Math.floor(e.def.xp * 0.33));
  p.gold += e.def.gold;
  updateHUD();
  _addCombatLog(`Victory! The ${e.def.name} falls. +${e.def.gold}g`, 'combat-log-gold');
  log(`✓ Defeated the ${e.def.name}! +${e.def.gold}g`, 'gold');
  addToInventory('bones');
  if(Math.random() < 0.3) addToInventory('goblin_hide');
  buildInventory(); buildEquipPanel();
  const isDungeon = currentMap && currentMap.isInterior;
  if(!isDungeon) {
    const respawnMs = (300 + Math.random() * 300) * 1000;
    setTimeout(() => respawnEnemy(e), respawnMs);
  }
  setTimeout(_closeCombatPanel, 1600);
}

function _combatDefeat() {
  _addCombatLog('You have been slain...', 'combat-log-bad');
  log('You have been slain...', 'bad');
  setTimeout(() => { _closeCombatPanel(); respawn(); }, 1500);
}

function respawnEnemy(e) {
  if(!currentMap) return;
  e.hp = e.def.hp;
  e.state = 'patrol';
  e.x = e.homeX; e.y = e.homeY;
  e.rx = e.homeX; e.ry = e.homeY;
  e.flashTimer = 0;
  e.patrolTimer = Math.random()*3;
}

// Draw all live enemies (called from renderMap, inside camera transform)
function drawEnemies() {
  for(const e of enemies) {
    if(e.state==='dead') continue;
    const px = e.rx*TILE, py = e.ry*TILE;
    const cx = px+TILE/2, cy = py+TILE/2;
    const def = e.def;
    const flash = e.flashTimer;

    ctx2.save();

    // Shadow
    ctx2.fillStyle='rgba(0,0,0,0.35)';
    ctx2.beginPath(); ctx2.ellipse(cx,cy+TILE*.33,TILE*.22,TILE*.09,0,0,Math.PI*2); ctx2.fill();

    // Body
    ctx2.fillStyle = def.bg;
    ctx2.beginPath(); ctx2.arc(cx, cy, TILE*.33, 0, Math.PI*2); ctx2.fill();
    ctx2.strokeStyle = flash>0 ? `rgba(255,80,80,${flash})` : def.col;
    ctx2.lineWidth = 1.8;
    ctx2.stroke();

    // Flash overlay
    if(flash>0) {
      ctx2.fillStyle=`rgba(255,60,60,${flash*0.45})`;
      ctx2.beginPath(); ctx2.arc(cx,cy,TILE*.33,0,Math.PI*2); ctx2.fill();
    }

    // Letter
    ctx2.fillStyle = def.col;
    ctx2.font = 'bold 13px Cinzel,serif';
    ctx2.textAlign='center'; ctx2.textBaseline='middle';
    ctx2.fillText(def.letter, cx, cy);

    // Aggro indicator when chasing
    if(e.state==='chase'||e.state==='attack') {
      ctx2.fillStyle='#c43030';
      ctx2.font='10px serif';
      ctx2.fillText('!', cx+TILE*.22, cy-TILE*.28);
    }

    // HP bar (only show when damaged)
    if(e.hp < e.maxHp) {
      const barW=TILE-6, barH=4;
      const bx=px+3, by=py+2;
      ctx2.fillStyle='rgba(0,0,0,0.6)'; ctx2.fillRect(bx,by,barW,barH);
      const pct=e.hp/e.maxHp;
      ctx2.fillStyle=pct>0.5?'#2d9448':pct>0.25?'#c8922a':'#c43030';
      ctx2.fillRect(bx,by,Math.round(barW*pct),barH);
    }

    ctx2.restore();
  }
}

// Update getTileActions to work with entity system (no tile-based enemies remain)
// We handle enemy clicks by checking proximity to entities instead

function respawn(){
  const p=state.players[state.activePlayer];
  p.hp=Math.floor(p.maxHp/2);
  p.gold=Math.floor(p.gold*.8);
  playerPath=[]; playerMoving=false;
  if(currentActivity) cancelActivity();

  // Return to the zone of the last portal stepped through
  const targetZone = lastPortalZone ?? 0;
  if(zoneIndex !== targetZone || (currentMap && currentMap.isInterior)){
    // Need to travel back to that zone
    zoneIndex = targetZone;
    minimapDirty = true; _dirtCache = null;
    currentMap = makeZoneMap(zoneIndex);
    spawnEnemiesFromMap();
    spawnNpcsFromMap();
    Weather.forceChange();
    Music.onZoneChange();
    document.getElementById('zone-name').textContent = ZONES[zoneIndex];
  }

  // Spawn near the entry portal of that zone.
  // Maps with a named entryX/entryY (e.g. Whisperwood — portal at top centre, not col 0)
  // use that directly; regular world-map zones scan column 0 for EXIT_RETURN/FOREST_PORTAL.
  const tiles = currentMap.tiles;
  const H2 = currentMap.H;
  let spawnX = 2, spawnY;
  if(currentMap.entryX != null && currentMap.entryY != null) {
    spawnX = currentMap.entryX;
    spawnY = currentMap.entryY;
  } else {
    spawnY = Math.floor(H2/2);
    for(let y=0;y<H2;y++){
      if(tiles[y][0]===T.EXIT_RETURN||tiles[y][0]===T.FOREST_PORTAL){
        spawnY=y; break;
      }
    }
  }
  const spawn = findSafeSpawn(spawnX, spawnY);
  playerPos = {x:spawn.x, y:spawn.y};
  playerReal = {x:spawn.x, y:spawn.y};
  camera.x = Math.max(0, spawn.x*TILE - canvas.width/2);
  camera.y = Math.max(0, spawn.y*TILE - canvas.height/2);
  damagedTiles = {};
  updateHUD();
  log('You have been slain. You wake at the last portal you crossed, some gold lost.','bad');
}

function removeTile(x,y){
  if(currentMap) currentMap.tiles[y][x]=T.GRASS;
}

function flashTile(x,y){
  damagedTiles[`${x},${y}`]=3;
  setTimeout(()=>{damagedTiles[`${x},${y}`]=0;},300);
}

// ======= XP SYSTEM =======
function giveXP(skillName,amount){
  const p=state.players[state.activePlayer];
  const sk=p.skills[skillName];
  if(!sk)return;
  sk.xp+=amount;
  const oldLvl=sk.lvl;
  while(sk.lvl<99 && sk.xp>=xpForLevel(sk.lvl+1)){
    sk.lvl++;
  }
  updateSkillDisplay(skillName);
  if(sk.lvl>oldLvl){
    showLevelUp(skillName,sk.lvl);
    if(skillName==='Hitpoints'){ p.maxHp=sk.lvl*3; p.hp=Math.min(p.hp+5,p.maxHp); }
    updateHUD();
  }
}

function showLevelUp(skill,lvl){
  SFX.levelUp();
  const popup=document.getElementById('levelup-popup');
  document.getElementById('lvlup-skill-name').textContent=skill;
  document.getElementById('lvlup-level-num').textContent=lvl;
  popup.classList.add('show');
  log(`⬡ LEVEL UP! ${skill} is now level ${lvl}!`,'lvl');
  if(levelupTimer) clearTimeout(levelupTimer);
  levelupTimer=setTimeout(()=>popup.classList.remove('show'),2500);
}

// ======= SMELTER ==========
// ======= CLUE READING — NOTICE BOARDS, BOOKSHELVES, CHESTS =======

function showReadPanel(title, lines, flagKey) {
  // Mark clue as found
  const MYSTERY_CLUE_FLAGS = ['clue_noticeboard_inn','clue_inn_journal','clue_guard_logbook','clue_chest_note','clue_chapel_rune','clue_chapel_altar'];
  if(flagKey && !questFlags[flagKey]) {
    questFlags[flagKey] = true;
    if(MYSTERY_CLUE_FLAGS.includes(flagKey)) {
      const found = MYSTERY_CLUE_FLAGS.filter(k => questFlags[k]).length;
      const total = MYSTERY_CLUE_FLAGS.length;
      setTimeout(()=>log(`✦ Clue found (${found}/${total}) — something stirs at the docks...`,'gold'),400);
    }
  }

  // Reuse the dialogue panel as a read panel
  const panel    = document.getElementById('dialogue-panel');
  const portrait = document.getElementById('dialogue-portrait');
  const nameEl   = document.getElementById('dialogue-npc-name');
  const textEl   = document.getElementById('dialogue-text');
  const optEl    = document.getElementById('dialogue-options');

  portrait.textContent       = lines[0].icon || '📜';
  portrait.style.background  = '#1a1208';
  portrait.style.color       = '#c8a060';
  portrait.style.borderColor = '#8a6030';
  portrait.style.fontSize    = '20px';
  nameEl.textContent = title.toUpperCase();

  let pageIndex = 0;
  function showPage(i) {
    textEl.textContent = lines[i].text;
    optEl.innerHTML = '';
    if(lines.length > 1) {
      if(i < lines.length - 1) {
        const next = document.createElement('div');
        next.className = 'dlg-option';
        next.textContent = '▸ Continue reading...';
        next.onclick = () => showPage(i + 1);
        optEl.appendChild(next);
      }
      if(i > 0) {
        const prev = document.createElement('div');
        prev.className = 'dlg-option';
        prev.textContent = '▸ Back';
        prev.onclick = () => showPage(i - 1);
        optEl.appendChild(prev);
      }
    }
  }
  showPage(0);

  document.getElementById('dialogue-close').onclick = closeDialogue;
  dialogueNpc = null;
  panel.classList.add('show');
}

function readNoticeBoard(x, y) {
  const isInn = (currentMap && currentMap.isInterior);
  if(isInn) {
    // Inn notice board — flavour pins only
    showReadPanel("The Tarnished Flagon — Notice Board", [
      { icon:'📜', text: '"LOST: one silver locket, last seen near the docks. Reward offered.\n— Mira, Room 2"' },
      { icon:'📜', text: '"REMINDER: The well water is not for bathing. — Management"' },
      { icon:'📜', text: '"TO WHOEVER TOOK MY JOURNAL PAGE: I know it was you. Grimtide marks the cycle. The water watches at the eleventh hour. Return what is mine.\n— Unsigned"' },
      { icon:'📜', text: '"WANTED: anyone with experience in the Cursed Marshes. Paying well. Ask for Thessaly.\n[Someone has scrawled \'Don\'t.\' underneath in red chalk.]"' },
    ], 'clue_noticeboard_inn');
  } else {
    // Town square notice board — quest board
    openQuestBoard();
  }
}

function readBookshelf(x, y) {
  const isInn = (currentMap && currentMap.isInterior && currentMap.name === 'THE TARNISHED FLAGON');
  const isChapel = (currentMap && currentMap.isInterior && currentMap.name === 'THE FORSAKEN CHAPEL');
  if(isInn) {
    showReadPanel("Bookshelf — The Tarnished Flagon", [
      { icon:'📚', text: '"The Wanderer\'s Atlas, Vol. II — Pages 1–40 concern the eastern trade routes. Someone has left a pressed flower at page 33."' },
      { icon:'📚', text: '"A slim unmarked journal, spine cracked.\n\nStonedawn: Arrived in Ashenveil. The contact was not at the meeting point.\nIronmark:  Waited all evening. Nothing.\nGrimtide:  They came. Not as I expected. The docks, just before midnight. They said only: \'Come back when you have the means.\' They gave no name. They wore no lantern.\n\n[The rest of the pages are torn out.]"' },
      { icon:'📚', text: '"Common Remedies of the Ashwood — a herbalist\'s guide. Handwritten annotations in the margins: \'III. Water. Night.\' The words are circled three times."' },
    ], 'clue_inn_journal');
  } else if(isChapel) {
    // Randomise which of two chapel shelves — left transept vs right
    const isLeft = x < 22;
    if(isLeft) {
      showReadPanel("Heretical Texts — West Transept", [
        { icon:'📚', text: '"The Rites of the Sunken Order — a cracked leather volume. The first chapter is titled \'On the Nature of the Veil\' and describes a ritual requiring \'that which the tide cannot touch\' — performed only on the seventh night of a cycle."' },
        { icon:'📚', text: '"A loose sheaf of parchment, hand-copied: \'The key is not fashioned of iron. It is forged of intent. The Ashen Key is given, not taken.\' Underlined twice."' },
        { icon:'📚', text: '"Sermon notes — mostly burned. One legible line: \'The figure does not speak for itself. It speaks for what is below.\'"' },
      ], 'clue_chapel_rune');
    } else {
      showReadPanel("Heretical Texts — East Transept", [
        { icon:'📚', text: '"A census of Ashenveil from decades past. Every seventh entry has been circled in dark ink — always the same family name, now illegible where it has been scratched out."' },
        { icon:'📚', text: '"Doctrine of the Cycle — handwritten, dense script: \'Grimtide is the aperture. What enters does not leave unchanged. What leaves does not return whole.\'"' },
        { icon:'📚', text: '"A note tucked inside a liturgy book: \'If anyone finds this — the Guard Captain knows more than he says. Look at what he wrote on the Grimtide before last.\'"' },
      ], 'clue_chapel_rune');
    }
  } else {
    showReadPanel("Bookshelf", [
      { icon:'📚', text: '"A collection of histories. Most are water-damaged beyond reading. One spine reads: \'On the Sealing of the Depths.\' The interior pages have been carefully removed."' },
    ], null);
  }
}

// ======= HOMESTEAD FARMING =======
function tillTile(x, y) {
  const p = state.players[state.activePlayer];
  const hasHoe = p.inventory.some(s => s && s.id === 'hoe');
  if(!hasHoe) {
    log("You need a Farmer's Hoe to till the soil. Buy one from Dorin the Merchant.", 'bad');
    return;
  }
  if(!currentMap || currentMap.name !== 'YOUR HOMESTEAD') {
    log('You can only till soil at your homestead.', 'bad');
    return;
  }
  const t = currentMap.tiles[y][x];
  if(t !== T.DIRT) {
    log('That tile cannot be tilled.', 'bad');
    return;
  }
  currentMap.tiles[y][x] = T.TILLED_SOIL;
  currentMap.floor[y][x]  = T.DIRT;
  state.farmPlots[`${x},${y}`] = { state:'tilled' };
  minimapDirty = true;
  log('You till the soil, preparing it for planting.', 'good');
  giveXP('Farming', 3);
}

function plantSeed(x, y) {
  if(!currentMap || currentMap.name !== 'YOUR HOMESTEAD') return;
  const p = state.players[state.activePlayer];
  // Find any seed in inventory
  const seedSlot = p.inventory.findIndex(s => s && ITEMS[s.id] && ITEMS[s.id].type === 'seed');
  if(seedSlot === -1) {
    log('You have no seeds to plant. Buy some from Dorin the Merchant.', 'bad');
    return;
  }
  // If more than one seed type, open a small picker — for now just use the first found
  const seedItem = p.inventory[seedSlot];
  const seedDef  = ITEMS[seedItem.id];
  currentMap.tiles[y][x] = T.SEEDLING;
  state.farmPlots[`${x},${y}`] = {
    state: 'planted',
    cropItem:  seedDef.cropItem,
    cropTile:  seedDef.cropTile,
    plantedAt: Date.now(),
    growTime:  seedDef.growTime,
  };
  minimapDirty = true;
  seedItem.qty--;
  if(seedItem.qty <= 0) p.inventory[seedSlot] = null;
  buildInventory();
  log(`You plant ${seedDef.name} in the tilled soil.`, 'good');
  giveXP('Farming', 5);
}

function harvestHomeCrop(x, y, cropItem, msg) {
  if(!currentMap || currentMap.name !== 'YOUR HOMESTEAD') return;
  const it = ITEMS[cropItem];
  addToInventory(cropItem);
  buildInventory(); updateHUD();
  currentMap.tiles[y][x] = T.TILLED_SOIL;
  state.farmPlots[`${x},${y}`] = { state:'tilled' };
  minimapDirty = true;
  log(`${msg} You receive 1 ${it ? it.name : cropItem}.`, 'good');
  giveXP('Farming', 15);
}

function searchChest(x, y) {
  // Only the chest near the blacksmith has the mystery quest note
  const isSpecialChest = (zoneIndex === 0 && !currentMap?.isInterior && x >= 28 && x <= 31 && y >= 9 && y <= 11);
  if(isSpecialChest) {
    showReadPanel("Weathered Chest", [
      { icon:'📦', text: '"The chest is mostly empty — a few copper coins, a broken belt buckle.\n\nAt the bottom, folded small, is a scrap of parchment:"' },
      { icon:'📦', text: '"To the next fool who opens this:\n\nI found what they buried. I shouldn\'t have looked. The figure at the docks will show you the way — but only on Grimtide. Wait until the eleventh bell, before the first.\n\nI\'m leaving Ashenveil before dawn.\n\n— K"' },
    ], 'clue_chest_note');
  } else if(currentMap?.name === 'THE ABANDONED ROAD' && !questFlags.caravan_manifest_found && x===9 && y===5) {
    // Quest chest — caravan manifest
    SFX.chest();
    const p = state.players[state.activePlayer];
    addToInventory('caravan_manifest');
    questFlags.caravan_manifest_found = true;
    questFlags.missing_caravan_done = true;
    bankAddCoins(p, 25);
    buildInventory(); updateHUD();
    log('📋 You wrench open a battered crate. Inside is a crumpled manifest stamped with Oswin\'s seal.','gold');
    setTimeout(()=>log('✦ Quest complete: The Missing Caravan! You received 25g.','gold'),600);
    currentMap.tiles[y][x] = currentMap.floor[y][x] || T.DIRT;
  } else {
    // Dungeon chest — better loot
    const inDungeon = currentMap && currentMap.isInterior &&
      (currentMap.name==='THE ASHWOOD CRYPTS'||currentMap.name==='THE IRON DEPTHS'||currentMap.name==='THE CULTIST CATACOMBS'||currentMap.name==='AETHERIC SPIRE');
    if(inDungeon) {
      const dungRng = ()=>Math.random();
      const numItems = 1+Math.floor(Math.random()*3);
      const gold = 10+Math.floor(Math.random()*40);
      log(`⚰ You pry open the ancient chest...`,'gold');
      SFX.chest();

      // === Quest item injections ===
      // Ashen Seal: one guaranteed chest in the Cultist Catacombs once quest accepted
      if(currentMap.name==='THE CULTIST CATACOMBS' &&
         questFlags.ashen_seal_accepted && !questFlags.ashen_seal_found &&
         Math.random() < 0.6) {
        addToInventory('ashen_seal');
        questFlags.ashen_seal_found = true;
        log('🔴 You find the Ashen Seal — it pulses with cold red light.','gold');
        setTimeout(()=>log('✦ Quest updated: The Ashen Seal — return to Aldermast.','gold'),600);
      }

      // Void Shards: one per dungeon, once constellation quest accepted, max 4 total
      const shardDungeons = ['THE ASHWOOD CRYPTS','THE IRON DEPTHS','THE CULTIST CATACOMBS','AETHERIC SPIRE'];
      const shardsFound = questFlags.void_shards_found || 0;
      if(questFlags.constellation_accepted && !questFlags.constellation_done &&
         shardsFound < 4 && shardDungeons.includes(currentMap.name) &&
         !currentMap._voidShardGiven && Math.random() < 0.45) {
        addToInventory('void_shard');
        currentMap._voidShardGiven = true; // one per dungeon visit
        questFlags.void_shards_found = shardsFound + 1;
        log(`🔷 A Void Shard tumbles out — ice-cold to the touch. (${questFlags.void_shards_found}/4 found)`,'gold');
        if(questFlags.void_shards_found >= 4)
          setTimeout(()=>log('✦ Quest updated: All four shards found — return to Aldermast!','gold'),600);
        else
          setTimeout(()=>log(`✦ Quest updated: The Starless Constellation — ${questFlags.void_shards_found}/4 shards.`,'gold'),600);
        buildInventory();
      }

      // Tome Fragments: scattered across all dungeons once grimoire quest is accepted
      const fragDungeons = ['THE ASHWOOD CRYPTS','THE IRON DEPTHS','THE CULTIST CATACOMBS'];
      const fragsFound = questFlags.tome_fragments_found || 0;
      if(questFlags.grimoire_accepted && !questFlags.grimoire_done &&
         fragsFound < 3 && fragDungeons.includes(currentMap.name) &&
         !currentMap._tomeFragGiven && Math.random() < 0.55) {
        const fragId = ['tome_fragment_1','tome_fragment_2','tome_fragment_3'][fragsFound];
        addToInventory(fragId);
        currentMap._tomeFragGiven = true;
        questFlags.tome_fragments_found = fragsFound + 1;
        log(`📜 A torn page glows faintly in the chest — a fragment of the Grimoire. (${questFlags.tome_fragments_found}/3)`,'gold');
        if(questFlags.tome_fragments_found >= 3)
          setTimeout(()=>log('✦ Quest updated: All fragments found — return to Aldermast!','gold'),600);
        else
          setTimeout(()=>log(`✦ Quest updated: The Fractured Grimoire — ${questFlags.tome_fragments_found}/3 fragments.`,'gold'),600);
        buildInventory();
      }

      for(let i=0;i<numItems;i++){
        const loot = rollDungeonLoot(dungRng);
        if(loot==='coins') { state.players[state.activePlayer].gold+=gold; log(`  + ${gold} gold coins!`,'gold'); }
        else { addToInventory(loot); log(`  + ${ITEMS[loot]?ITEMS[loot].icon:''} ${ITEMS[loot]?.name||loot}`,'good'); }
      }
      buildInventory(); buildEquipPanel(); updateHUD();
      // Remove chest tile after searching
      currentMap.tiles[y][x] = currentMap.floor[y][x]||T.DUNGEON_FLOOR;
    } else {
      // Generic chest — minor loot flavour
      const roll = Math.random();
      if(roll < 0.25) {
        addToInventory('coins', Math.floor(Math.random()*8)+2);
        log('You find a few loose coins in the chest.','gold');
      } else {
        log('The chest is empty.','');
      }
    }
  }
}

function openSmelter(){
  const p = state.players[state.activePlayer];
  // Full smelting recipes — coal required as fuel for iron+
  const recipes = [
    { name:'Bronze Bar',  requires:[{id:'copper_ore',qty:1}],                      output:'bronze_bar',  xp:6.2,  skill:'Smithing', reqLvl:1  },
    { name:'Iron Bar',    requires:[{id:'iron_ore',  qty:1},{id:'coal',qty:1}],     output:'iron_bar',    xp:12.5, skill:'Smithing', reqLvl:15 },
    { name:'Gold Bar',    requires:[{id:'gold_ore',  qty:1},{id:'coal',qty:2}],     output:'gold_bar',    xp:22.5, skill:'Smithing', reqLvl:40 },
    { name:'Mithril Bar', requires:[{id:'mithril_ore',qty:1},{id:'coal',qty:4}],   output:'mithril_bar', xp:50,   skill:'Smithing', reqLvl:55 },
  ];

  const smithLvl = p.skills.Smithing.lvl;

  // Build custom panel so we can show locked recipes greyed out
  const ctxMenu = document.getElementById('ctx-menu');
  ctxMenu.innerHTML = `<div class="ctx-title">⚒ Smelter — Forge Bars</div>`;

  let anyShown = false;
  recipes.forEach(r => {
    const hasIngredients = r.requires.every(req => countInInventory(req.id) >= req.qty);
    const meetsLevel    = smithLvl >= r.reqLvl;
    const canSmelt      = hasIngredients && meetsLevel;
    const d = document.createElement('div');
    d.className = 'ctx-item' + (canSmelt ? '' : ' danger');
    const reqs = r.requires.map(req=>`${req.qty}x ${ITEMS[req.id]?.name||req.id}`).join(' + ');
    const lockNote = !meetsLevel ? ` <span style="color:#a04040;font-size:10px">[Lv ${r.reqLvl} Smithing]</span>` : '';
    d.innerHTML = `<span class="ctx-icon">${ITEMS[r.output]?.icon||'⬜'}</span>${r.name} <span style="font-size:11px;color:var(--text-dim);margin-left:4px">(${reqs})</span>${lockNote}`;
    d.onclick = () => {
      hideCtxMenu();
      if(!meetsLevel){ log(`Need level ${r.reqLvl} Smithing to smelt ${r.name}.`,'bad'); return; }
      if(!hasIngredients){ log(`You don't have the materials for ${r.name}.`,'bad'); return; }
      r.requires.forEach(req => removeFromInventory(req.id, req.qty));
      addToInventory(r.output);
      giveXP(r.skill, r.xp);
      buildInventory(); buildEquipPanel(); updateHUD();
      log(`You smelt a ${ITEMS[r.output].name}.`, 'good');
    };
    ctxMenu.appendChild(d);
    anyShown = true;
  });

  if(!anyShown) { log('No smelting recipes available.','bad'); return; }
  const _r2=document.getElementById('map-container').getBoundingClientRect();
  ctxMenu.style.left=(_r2.left+_r2.width/2-70)+'px';
  ctxMenu.style.top=(_r2.top+_r2.height/2-60)+'px';
  ctxMenu.style.display='block';
}
function openCooker(){
  const p = state.players[state.activePlayer];
  const cookLvl = p.skills.Cooking.lvl;

  const fishRecipes = FISH_TABLE.map(f => {
    const cookedId = COOKED[f.id] || ('cooked_' + f.id.replace('raw_',''));
    return {
      name: `Cook ${f.name}`,
      requires: [{id:f.id, qty:1}],
      output: cookedId,
      xp: Math.floor(f.xp * 1.2),
      skill: 'Cooking',
      reqLvl: Math.max(1, f.minLvl - 2),
      healHp: f.healHp || 5,
    };
  }).filter(r => ITEMS[r.output]);

  const meatRecipes = [
    { name:'Cook Chicken',    requires:[{id:'raw_chicken',  qty:1}],                         output:'cooked_chicken',  xp:12, skill:'Cooking', reqLvl:1,  healHp:6  },
    { name:'Cook Pork',       requires:[{id:'raw_pork',     qty:1}],                         output:'cooked_pork',     xp:16, skill:'Cooking', reqLvl:5,  healHp:9  },
    { name:'Cook Beef',       requires:[{id:'raw_beef',     qty:1}],                         output:'cooked_beef',     xp:22, skill:'Cooking', reqLvl:10, healHp:14 },
    { name:'Hard Boiled Egg', requires:[{id:'egg',qty:1},{id:'water_bucket',qty:1}],         output:'hard_boiled_egg', xp:10, skill:'Cooking', reqLvl:1,  healHp:8,
      extraReturn:{id:'wooden_bucket', qty:1} },
  ];

  const allRecipes = [...fishRecipes, ...meatRecipes];
  const ctxMenu = document.getElementById('ctx-menu');
  ctxMenu.innerHTML = `<div class="ctx-title">🍲 Hearth — Cook Food</div>`;

  allRecipes.forEach(r => {
    const hasIngredients = r.requires.every(req => countInInventory(req.id) >= req.qty);
    const meetsLevel     = cookLvl >= r.reqLvl;
    const canCook        = hasIngredients && meetsLevel;
    const d = document.createElement('div');
    d.className = 'ctx-item' + (canCook ? '' : ' danger');
    const lockNote = !meetsLevel ? ` <span style="color:#a04040;font-size:10px">[Lv ${r.reqLvl}]</span>` : '';
    const healNote = `<span style="color:#4a8a40;font-size:10px;margin-left:4px">+${r.healHp}hp</span>`;
    d.innerHTML = `<span class="ctx-icon">${ITEMS[r.output]?.icon||'🍗'}</span>${r.name}${lockNote}${healNote}`;
    d.onclick = () => {
      hideCtxMenu();
      if(!meetsLevel){ log(`Need level ${r.reqLvl} Cooking.`,'bad'); return; }
      if(!hasIngredients){ log(`You don't have the ingredients to ${r.name.toLowerCase()}.`,'bad'); return; }
      r.requires.forEach(req => removeFromInventory(req.id, req.qty));
      addToInventory(r.output);
      if(r.extraReturn) addToInventory(r.extraReturn.id);
      giveXP(r.skill, r.xp);
      buildInventory(); buildEquipPanel(); updateHUD();
      log(`You cook a ${ITEMS[r.output].name}. (+${r.xp} Cooking xp)`, 'good');
    };
    ctxMenu.appendChild(d);
  });

  const _r3=document.getElementById('map-container').getBoundingClientRect();
  ctxMenu.style.left=(_r3.left+_r3.width/2-70)+'px';
  ctxMenu.style.top=(_r3.top+_r3.height/2-60)+'px';
  ctxMenu.style.display='block';
}
function openWorkbench(){
  const recipes=[
    { name:'Plank',          output:'plank',         requires:[{id:'normal_log',qty:2}],             xp:5,   skill:'Crafting', time:1500 },
    { name:'Oak Plank',      output:'oak_plank',      requires:[{id:'oak_log',qty:2}],                xp:10,  skill:'Crafting', time:1800 },
    { name:'Wooden Club',    output:'wooden_club',    requires:[{id:'normal_log',qty:2}],             xp:15,  skill:'Crafting', time:2000 },
    { name:'Wooden Shield',  output:'wooden_shield',  requires:[{id:'normal_log',qty:3}],             xp:25,  skill:'Crafting', time:2500 },
    { name:'Torch',          output:'torch',          requires:[{id:'normal_log',qty:1},{id:'coal',qty:1}],  xp:12, skill:'Crafting', time:1500 },
    { name:'Bowstring',      output:'bowstring',      requires:[{id:'willow_log',qty:1}],             xp:20,  skill:'Crafting', time:2000 },
  ];
  showCraftMenu('Woodworking Bench',recipes,'🪵');
}

function openRuneCrafter() {
  const p = state.players[state.activePlayer];
  const magicLvl = p.skills.Magic ? p.skills.Magic.lvl : 1;

  // All rune recipes — arcane_dust is the base material (coal + copper ore)
  const RUNE_RECIPES = [
    { output:'arcane_dust',  name:'Arcane Dust',   requires:[{id:'coal',qty:1},{id:'copper_ore',qty:1}],                          xp:4,  skill:'Magic', reqLvl:1,  time:1200 },
    { output:'rune_fire',    name:'Fire Rune',      requires:[{id:'arcane_dust',qty:2}],                                           xp:10, skill:'Magic', reqLvl:1,  time:1500 },
    { output:'rune_ice',     name:'Ice Rune',       requires:[{id:'arcane_dust',qty:2},{id:'coal',qty:1}],                         xp:16, skill:'Magic', reqLvl:10, time:1800 },
    { output:'rune_earth',   name:'Earth Rune',     requires:[{id:'arcane_dust',qty:3},{id:'iron_ore',qty:1}],                     xp:24, skill:'Magic', reqLvl:20, time:2000 },
    { output:'rune_heal',    name:'Heal Rune',      requires:[{id:'arcane_dust',qty:2},{id:'gold_ore',qty:1}],                     xp:20, skill:'Magic', reqLvl:15, time:2000 },
    { output:'rune_shield',  name:'Shield Rune',    requires:[{id:'arcane_dust',qty:3},{id:'iron_ore',qty:1},{id:'coal',qty:1}],   xp:26, skill:'Magic', reqLvl:25, time:2200 },
    { output:'rune_void',    name:'Void Rune',      requires:[{id:'arcane_dust',qty:4},{id:'void_essence',qty:1}],                 xp:50, skill:'Magic', reqLvl:35, time:2800 },
    { output:'void_essence', name:'Void Essence',   requires:[{id:'void_shard',qty:1}],                                            xp:30, skill:'Magic', reqLvl:30, time:1500 },
  ];

  const ctxMenu = document.getElementById('ctx-menu');
  ctxMenu.innerHTML = `<div class="ctx-title">✦ Arcane Tome — Craft Runes</div>
    <div style="font-size:10px;color:var(--text-dim);padding:2px 6px 6px;border-bottom:1px solid rgba(255,255,255,0.06);">Magic Level: <span style="color:#a060e0;font-weight:600;">${magicLvl}</span></div>`;

  RUNE_RECIPES.forEach(r => {
    const hasIngredients = r.requires.every(req => countInInventory(req.id) >= req.qty);
    const meetsLevel     = magicLvl >= r.reqLvl;
    const canCraft       = hasIngredients && meetsLevel;
    const d = document.createElement('div');
    d.className = 'ctx-item' + (canCraft ? '' : ' danger');
    const reqs = r.requires.map(req=>`${req.qty}x ${ITEMS[req.id]?.name||req.id}`).join(' + ');
    const lockNote = !meetsLevel ? ` <span style="color:#a04040;font-size:10px">[Lv ${r.reqLvl} Magic]</span>` : '';
    d.innerHTML = `<span class="ctx-icon">${ITEMS[r.output]?.icon||'✨'}</span>${r.name} <span style="font-size:10px;color:var(--text-dim);margin-left:3px">(${reqs})</span>${lockNote}`;
    d.onclick = () => {
      hideCtxMenu();
      if(!meetsLevel) { log(`Need level ${r.reqLvl} Magic to craft ${r.name}.`,'bad'); return; }
      if(!hasIngredients) { log(`Missing materials for ${r.name}.`,'bad'); return; }
      startActivity(r.name, r.time, () => {
        r.requires.forEach(req => removeFromInventory(req.id, req.qty));
        addToInventory(r.output);
        giveXP(r.skill, r.xp);
        buildInventory(); buildEquipPanel(); updateHUD();
        log(`✨ You craft a ${ITEMS[r.output].name}. (+${r.xp} Magic xp)`, 'good');
      });
    };
    ctxMenu.appendChild(d);
  });

  const _r = document.getElementById('map-container').getBoundingClientRect();
  ctxMenu.style.left = (_r.left + _r.width/2 - 70) + 'px';
  ctxMenu.style.top  = (_r.top  + _r.height/2 - 60) + 'px';
  ctxMenu.style.display = 'block';
}

function showCraftMenu(title,recipes,icon){
  ctxMenu.innerHTML=`<div class="ctx-title">${icon} ${title}</div>`;
  recipes.forEach(r=>{
    const canCraft=r.requires.every(req=>countInInventory(req.id)>=req.qty);
    const d=document.createElement('div');
    d.className='ctx-item'+(canCraft?'':' danger');
    const reqs=r.requires.map(req=>`${req.qty}x ${ITEMS[req.id].name}`).join(', ');
    d.innerHTML=`<span class="ctx-icon">${ITEMS[r.output].icon}</span>${r.name} <span style="font-size:11px;color:var(--text-dim);margin-left:4px">(${reqs})</span>`;
    d.onclick=()=>{
      if(!canCraft){log('Missing materials.','bad');hideCtxMenu();return;}
      hideCtxMenu();
      r.requires.forEach(req=>removeFromInventory(req.id,req.qty));
      startActivity(r.name, r.time||2000, ()=>{
        addToInventory(r.output);
        buildInventory(); buildEquipPanel(); giveXP(r.skill,r.xp);
        log(`You craft a ${ITEMS[r.output].name}.`,'good');
      });
    };
    ctxMenu.appendChild(d);
  });
  const container=document.getElementById('map-container');
  const rect=container.getBoundingClientRect();
  ctxMenu.style.left=(rect.left+rect.width/2-70)+'px';
  ctxMenu.style.top=(rect.top+rect.height/2-60)+'px';
  ctxMenu.classList.add('show');
}

function openShop(){
  const items=[
    {name:'Buy Sword',output:'sword',cost:50},
    {name:'Buy Bait (x10)',output:'bait',cost:5,qty:10},
    {name:'Buy Fly Lure (x5)',output:'fly_lure',cost:10,qty:5},
    {name:'Buy Harpoon',output:'harpoon',cost:30,qty:1},
    {name:'Sell Bones (5g ea)',sell:'bones',price:5},
    {name:'Sell Bronze Bar (20g)',sell:'bronze_bar',price:20},
    {name:'Sell Iron Bar (30g)',sell:'iron_bar',price:30},
    {name:'Sell Gold Bar (50g)',sell:'gold_bar',price:50},
  ];
  ctxMenu.innerHTML=`<div class="ctx-title">🏪 Shop</div>`;
  const p=state.players[state.activePlayer];
  items.forEach(item=>{
    const d=document.createElement('div');
    d.className='ctx-item';
    if(item.sell){
      const qty=countInInventory(item.sell);
      d.innerHTML=`<span class="ctx-icon">💰</span>${item.name} (have ${qty})`;
      d.onclick=()=>{
        if(qty>0){removeFromInventory(item.sell);p.gold+=item.price;updateHUD();log(`Sold for ${item.price}g.`,'gold');}
        else{log('Nothing to sell.','bad');}
        hideCtxMenu();
      };
    } else {
      d.innerHTML=`<span class="ctx-icon">${ITEMS[item.output].icon}</span>${item.name} (${item.cost}g)`;
      d.onclick=()=>{
        if(p.gold>=item.cost){
          p.gold-=item.cost;
          addToInventory(item.output, item.qty||1);
          updateHUD();
          log(`Bought ${ITEMS[item.output].name}${item.qty>1?' x'+item.qty:''}.`,'gold');
        } else{log('Not enough gold.','bad');}
        hideCtxMenu();
      };
    }
    ctxMenu.appendChild(d);
  });
  const container=document.getElementById('map-container');
  const rect=container.getBoundingClientRect();
  ctxMenu.style.left=(rect.left+100)+'px';
  ctxMenu.style.top=(rect.top+100)+'px';
  ctxMenu.classList.add('show');
}

// ======= ZONE EXIT CHECK =======
function checkZoneExit() {
  if(!currentMap) return;
  const t = currentMap.tiles[playerPos.y]?.[playerPos.x];
  if(t === T.EXIT) {
    if(currentMap && currentMap.name === 'THE WHISPERWOOD') {
      // South exit of Whisperwood → Stormcrag Reach
      enterInterior(makeStormcragMap, 'Stormcrag Reach');
      setTimeout(()=>log('🏔 The trees thin. Cold wind bites down from the peaks above.','neutral'),700);
    } else if(currentMap && currentMap.name === 'STORMCRAG REACH') {
      // South exit of Stormcrag → Ashwood Vale (zone 1)
      exitInterior();
      setTimeout(()=>doZoneTransition(1), 800);
    } else {
      doZoneTransition(1);
    }
  } else if(t === T.EXIT_RETURN) {
    doZoneTransition(-1);
  // House door entry — check if tile directly north is a house BWALL_DOOR
  } else if(t === T.STONE_FLOOR || t === T.COBBLE || t === T.DIRT || t === T.GRASS) {
    const northTile = currentMap.tiles[playerPos.y-1]?.[playerPos.x];
    if(northTile === T.BWALL_DOOR && currentMap.name === 'ASHENVEIL') {
      const HOUSE_DOORS = {
        '9,8':   {fn:()=>makeInnInterior(),            name:"The Tarnished Flagon", log:"The heavy door swings open. Warmth and the smell of ale greet you."},
        '4,33':  {fn:()=>makeHouseInterior('Mira'),    name:"Mira's House",    log:"You enter Mira's modest home. The hearth still glows faintly."},
        '4,40':  {fn:()=>makeHouseInterior('Aldric'),  name:"Aldric's House",  log:"Aldric's home. Books and odd tools clutter every surface."},
        '4,47':  {fn:()=>makeHouseInterior('Residence'),name:"A Residence",    log:"An ordinary townhouse. Quiet and lived-in."},
        '4,54':  {fn:()=>makeHouseInterior('Residence'),name:"A Residence",    log:"The door creaks open. Smells of dried herbs."},
        '28,3':  {fn:()=>makeHouseInterior('Elspeth'), name:"Elspeth's House", log:"Elspeth's home. Herbs hang drying from the rafters."},
        '28,11': {fn:()=>makeHouseInterior('Rowan'),   name:"Rowan's House",   log:"Rowan's house. A lantern flickers on the table."},
        '8,24':  {fn:()=>makeBlacksmithInterior(),     name:"The Ashen Forge", log:"Heat and the smell of iron hit you as you step inside the forge."},
        '9,14':  {fn:()=>makeBankInterior(),            name:"GRIMSTONE SAVINGS BANK", log:"The door swings open. It smells of polished wood and old coin."},
      };
      const key = `${playerPos.y},${playerPos.x}`;
      const hd = HOUSE_DOORS[key];
      if(hd) {
        SFX.door();
        enterInterior(hd.fn, hd.name);
        setTimeout(()=>log(hd.log,'neutral'),600);
      }
    }
    if(northTile === T.BWALL_DOOR && currentMap.name === 'YOUR HOMESTEAD') {
      if(playerPos.x === 3 && playerPos.y === 4) {
        SFX.door();
        enterInterior(makeHomeCabinInterior, 'YOUR CABIN');
        setTimeout(()=>log('You step inside your cabin. Cosy and quiet.','neutral'),600);
      }
    }
  } else if(t === T.CHAPEL_PORTAL) {
    enterInterior(makeChapelMap, 'The Forsaken Chapel');
    questFlags.chapel_visited = true;
    const atNight = getNightAlpha() > 0.5;
    setTimeout(()=>{
      log('The air reeks of incense and rot. Chanting echoes from within.','bad');
      if(atNight) {
        spawnChapelCultists();
        setTimeout(()=>log('Hooded figures move between the pillars, performing their rites.','bad'),800);
      } else {
        log('The chapel is empty — for now.','info');
      }
    },600);
  } else if(t === T.FOREST_PORTAL) {
    if(currentMap && currentMap.name === 'THE WHISPERWOOD') {
      // Inside Whisperwood north portal → back to Ashenveil
      exitInterior();
    } else if(currentMap && currentMap.name === 'STORMCRAG REACH') {
      // Stormcrag north portal → back to Whisperwood
      exitInterior();
    } else {
      // Ashenveil south portal → enter Whisperwood
      enterInterior(makeWhisperwoodMap, 'The Whisperwood');
      setTimeout(()=>log('🌲 The trees close in around you. Something watches from the shadows.','bad'),600);
    }
  } else if(t === T.FARM_PORTAL) {
    if(currentMap && currentMap.name === 'GREENFIELD PASTURES') {
      exitInterior();
      setTimeout(()=>log('You pass back through the shimmering portal onto the Ashenveil road.','info'),500);
    } else {
      enterInterior(makeGreenfieldMap, 'Greenfield Pastures');
      setTimeout(()=>log('🌾 The smell of cut grass and livestock drifts through the portal. The Greenfield Pastures stretch before you.','good'),600);
    }
  } else if(t === T.CARAVAN_PORTAL) {
    enterInterior(makeCaravanZoneMap, 'THE ABANDONED ROAD');
    setTimeout(()=>log('🛤 The air turns cold. Tyre ruts and broken crates line the road ahead. Something went wrong here.','bad'),600);
  } else if(t === T.DUNGEON_STAIR_DOWN) {
    // Enter zone-specific dungeon
    let dungeonFn;
    if(zoneIndex===1) dungeonFn = ()=>makeAshwoodDungeon(worldSeed+zoneIndex*31337);
    else if(zoneIndex===2) dungeonFn = ()=>makeIronPeaksDungeon(worldSeed+zoneIndex*31337);
    else dungeonFn = ()=>makeAshwoodDungeon(worldSeed+zoneIndex*31337);
    enterInterior(dungeonFn, 'Dungeon');
    setTimeout(()=>log('⚰ The air is cold and reeks of death. Proceed with caution.','bad'),600);
  } else if(t === T.DUNGEON_STAIR_UP) {
    exitInterior();
  } else if(t === T.WIZARD_DOOR) {
    enterInterior(makeWizardTowerInterior, 'The Aetheric Spire');
    setTimeout(()=>log("🔮 The ancient door groans open. The air smells of ozone and old parchment.",'neutral'),600);
  } else if(t === T.CRYPT_STAIR) {
    const cataSeed = worldSeed+99991;
    enterInterior(()=>makeCultistCatacombs(cataSeed), 'The Cultist Catacombs');
    setTimeout(()=>log('⚰ Ancient steps descend into the catacombs. Something stirs below.','bad'),600);
  } else if(t === T.EXIT_INTERIOR) {
    exitInterior();
  }
}

let zoneTransitioning = false;
function doZoneTransition(dir = 1) {
  if(zoneTransitioning) return;
  SFX.portal();
  const newIndex = zoneIndex + dir;
  // Block: can't go before zone 0 or past the last zone
  if(newIndex < 0) { log("There is nowhere to go back to.", 'bad'); return; }
  if(newIndex >= ZONES.length) { log("The portal crackles — but there is nothing beyond.", 'bad'); return; }

  zoneTransitioning = true;
  if(currentActivity) cancelActivity();
  cancelFishing();
  playerPath=[]; playerMoving=false;
  zoneIndex = newIndex;
  minimapDirty = true; _dirtCache = null;
  Weather.forceChange();
  Music.onZoneChange();
  const flash=document.getElementById('zone-flash');
  flash.style.transition='opacity 0.4s';
  flash.style.opacity='1';
  setTimeout(()=>{
    currentMap=makeZoneMap(zoneIndex);
    spawnEnemiesFromMap();
    spawnNpcsFromMap();
    // Find the actual exit portal row in the new map (may differ between zones)
    // EXIT is at x:W-1, EXIT_RETURN at x:0 — scan for their Y position
    const newTiles = currentMap.tiles;
    const newW = currentMap.W, newH = currentMap.H;
    let exitY = Math.floor(newH / 2); // fallback
    if(dir > 0) {
      // Came in from left — find EXIT_RETURN at x:0
      for(let y=0; y<newH; y++) if(newTiles[y][0]===T.EXIT_RETURN){ exitY=y; break; }
    } else {
      // Came in from right — find EXIT at x:W-1
      for(let y=0; y<newH; y++) if(newTiles[y][newW-1]===T.EXIT){ exitY=y; break; }
    }
    const spawnX = dir > 0 ? 1 : newW - 2;
    // Prefer exact spot; only spiral if that tile is somehow blocked
    const spawn = findSafeSpawn(spawnX, exitY);
    playerPos={x:spawn.x, y:spawn.y};
    playerReal={x:spawn.x, y:spawn.y};
    camera.x = Math.max(0, spawn.x*TILE - canvas.width/2);
    camera.y = Math.max(0, spawn.y*TILE - canvas.height/2);
    damagedTiles={};
    document.getElementById('zone-name').textContent=ZONES[zoneIndex];
    const arrow = dir > 0 ? '→' : '←';
    log(`${arrow} You step through the portal into ${ZONES[zoneIndex]}.`,'gold');
    lastPortalZone = zoneIndex; // remember this portal for respawn
    if(activeSaveSlot != null) saveGame(activeSaveSlot);
    flash.style.opacity='0';
    setTimeout(()=>{ zoneTransitioning=false; }, 500);
  },420);
}

// ======= KEYBOARD — rate-limited held movement =======
const keysHeld = new Set();
const KEY_MOVE_INTERVAL = 160; // ms between steps when held (≈6.25 tiles/sec max)
let keyMoveTimer = null;
let lastKeyStep = 0;

const KEY_DIRS = {
  ArrowUp:{y:-1},ArrowDown:{y:1},ArrowLeft:{x:-1},ArrowRight:{x:1},
  w:{y:-1},s:{y:1},a:{x:-1},d:{x:1},
};
const P2_KEY_DIRS = {
  i:{y:-1}, k:{y:1}, j:{x:-1}, l:{x:1},
  I:{y:-1}, K:{y:1}, J:{x:-1}, L:{x:1},
};

// P2 key state
const p2KeysHeld = new Set();
let p2KeyMoveTimer = null;
let p2LastKeyStep = 0;

function tryP2KeyMove() {
  if(!currentMap || gameMode !== 'coop') return;
  let mv = null;
  for(const k of [...p2KeysHeld].reverse()) {
    if(P2_KEY_DIRS[k]){ mv=P2_KEY_DIRS[k]; break; }
  }
  if(!mv) return;
  const nx = p2Pos.x + (mv.x||0);
  const ny = p2Pos.y + (mv.y||0);
  if(nx>=0&&nx<currentMap.W&&ny>=0&&ny<currentMap.H){
    const t = currentMap.tiles[ny][nx];
    // P2 uses same walkability rules as P1 (portals trigger if stepped on)
    if(!isSolid(nx,ny)||t===T.EXIT||t===T.EXIT_RETURN||t===T.INN_DOOR||t===T.EXIT_INTERIOR||t===T.CHAPEL_PORTAL||t===T.DUNGEON_STAIR_DOWN||t===T.DUNGEON_STAIR_UP||t===T.CRYPT_STAIR||t===T.FOREST_PORTAL||t===T.WIZARD_DOOR){
      p2Pos  = {x:nx, y:ny};
      p2Real = {x:nx, y:ny};
      p2Moving = true;
      setTimeout(()=>{ p2Moving=false; },150);
    }
  }
}

function scheduleP2KeyMove() {
  if(p2KeyMoveTimer) return;
  const now = Date.now();
  const delay = Math.max(0, KEY_MOVE_INTERVAL - (now - p2LastKeyStep));
  p2KeyMoveTimer = setTimeout(()=>{
    p2KeyMoveTimer = null;
    if(p2KeysHeld.size===0) return;
    p2LastKeyStep = Date.now();
    tryP2KeyMove();
    if([...p2KeysHeld].some(k=>P2_KEY_DIRS[k])) scheduleP2KeyMove();
  }, delay);
}

function tryKeyMove() {
  if(!currentMap || currentActivity) return;
  // Find the most recently pressed direction still held
  let mv = null;
  for(const k of [...keysHeld].reverse()) {
    if(KEY_DIRS[k]){ mv=KEY_DIRS[k]; break; }
  }
  if(!mv) return;

  // Cancel any click-based pathfinding
  if(playerPath.length>0){ playerPath=[]; pendingAction=null; playerMoving=false; if(walkAnim){cancelAnimationFrame(walkAnim);walkAnim=null;} }

  const nx = playerPos.x+(mv.x||0);
  const ny = playerPos.y+(mv.y||0);
  if(nx>=0&&nx<currentMap.W&&ny>=0&&ny<currentMap.H){
    const t = currentMap.tiles[ny][nx];
    if(!isSolid(nx,ny)||t===T.EXIT||t===T.EXIT_RETURN||t===T.INN_DOOR||t===T.EXIT_INTERIOR||t===T.CHAPEL_PORTAL||t===T.DUNGEON_STAIR_DOWN||t===T.DUNGEON_STAIR_UP||t===T.CRYPT_STAIR||t===T.FOREST_PORTAL){
      playerPos={x:nx,y:ny};
      playerReal={x:nx,y:ny};
      checkZoneExit();
    }
  }
}

function scheduleKeyMove() {
  if(keyMoveTimer) return;
  const now = Date.now();
  const delay = Math.max(0, KEY_MOVE_INTERVAL - (now - lastKeyStep));
  keyMoveTimer = setTimeout(()=>{
    keyMoveTimer = null;
    if(keysHeld.size===0) return;
    lastKeyStep = Date.now();
    tryKeyMove();
    if([...keysHeld].some(k=>KEY_DIRS[k])) scheduleKeyMove();
  }, delay);
}

document.addEventListener('keydown',e=>{
  if(!currentMap) return;
  if(KEY_DIRS[e.key]){
    e.preventDefault();
    const wasEmpty = keysHeld.size===0;
    keysHeld.add(e.key);
    if(wasEmpty){
      lastKeyStep = Date.now() - KEY_MOVE_INTERVAL;
      scheduleKeyMove();
    }
  }
  if(P2_KEY_DIRS[e.key] && gameMode==='coop'){
    e.preventDefault();
    const wasEmpty = p2KeysHeld.size===0;
    p2KeysHeld.add(e.key);
    if(wasEmpty){
      p2LastKeyStep = Date.now() - KEY_MOVE_INTERVAL;
      scheduleP2KeyMove();
    }
  }
  if(e.key==='m' || e.key==='M'){
    toggleWorldMap(); return;
  }
  if(e.key==='Escape'){
    const mapOverlay = document.getElementById('world-map-overlay');
    if(mapOverlay && mapOverlay.classList.contains('show')){ mapOverlay.classList.remove('show'); return; }
    if(document.getElementById('dialogue-panel').classList.contains('show')){ closeDialogue(); return; }
    if(document.getElementById('shop-panel').classList.contains('show')){ closeMerchantShop(); return; }
    cancelActivity();
    cancelFishing();
    playerPath=[]; pendingAction=null; playerMoving=false;
  }
});

document.addEventListener('keyup',e=>{
  keysHeld.delete(e.key);
  if(![...keysHeld].some(k=>KEY_DIRS[k])){
    if(keyMoveTimer){ clearTimeout(keyMoveTimer); keyMoveTimer=null; }
  }
  p2KeysHeld.delete(e.key);
  if(![...p2KeysHeld].some(k=>P2_KEY_DIRS[k])){
    if(p2KeyMoveTimer){ clearTimeout(p2KeyMoveTimer); p2KeyMoveTimer=null; }
  }
});

