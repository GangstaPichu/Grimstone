// ========== CHARACTER CREATION DATA ==========
const CLASSES = [
  {
    id:'warrior', name:'Warrior', icon:'⚔',
    color:'#c43030', glow:'rgba(196,48,48,0.3)',
    lore:'A battle-hardened fighter who charges into the fray. Masters of brute force and iron defence.',
    bonus:{Attack:5, Strength:5, Defence:3, Hitpoints:3},
    gear:['bronze_bar'],
    startEquip:{weapon:'bronze_sword', body:'leather_body'},
    hairStyle:1,
  },
  {
    id:'ranger', name:'Ranger', icon:'🏹',
    color:'#2d9448', glow:'rgba(45,148,72,0.3)',
    lore:'A wanderer of the wilds who hunts from the shadows. Swift and deadly, masters of the hunt.',
    bonus:{Attack:3, Woodcutting:5, Fishing:3, Hitpoints:2},
    gear:['normal_log','raw_fish'],
    startEquip:{weapon:'bone_dagger', body:'leather_body'},
    hairStyle:2,
  },
  {
    id:'miner', name:'Prospector', icon:'⛏',
    color:'#8b5a2b', glow:'rgba(139,90,43,0.3)',
    lore:'A hardy digger who knows every vein of ore in the rock. Wealth waits beneath the stone.',
    bonus:{Mining:5, Smithing:5, Hitpoints:2},
    gear:['copper_ore','copper_ore','iron_ore'],
    startEquip:{weapon:'wooden_club', shield:'wooden_shield'},
    hairStyle:0,
  },
  {
    id:'rogue', name:'Shadowblade', icon:'🗡',
    color:'#6430a0', glow:'rgba(100,48,160,0.3)',
    lore:'A creature of darkness, lurking in fog and silence. They strike once — and it is enough.',
    bonus:{Attack:4, Strength:4, Crafting:4, Hitpoints:2},
    gear:['goblin_hide','coins'],
    hairStyle:3,
  },
  {
    id:'cook', name:'Alchemist', icon:'🧪',
    color:'#2d9494', glow:'rgba(45,148,148,0.3)',
    lore:'Part chef, part herbalist. Transforms raw ingredients into life-saving concoctions.',
    bonus:{Cooking:6, Fishing:4, Hitpoints:5},
    gear:['raw_fish','raw_salmon'],
    hairStyle:0,
  },
  {
    id:'farmhand', name:'Farmhand', icon:'🌾',
    color:'#7a9a2a', glow:'rgba(122,154,42,0.3)',
    lore:'Raised on the land, calloused hands and a strong back. Knows the soil, the seasons, and which plants will kill you.',
    bonus:{Farming:8, Cooking:3, Hitpoints:4},
    gear:['cooked_chicken','cooked_pork'],
    startEquip:{weapon:'wooden_club'},
    hairStyle:0,
  },
  {
    id:'mage', name:'Arcane Mage', icon:'🔮',
    color:'#a060e0', glow:'rgba(160,96,224,0.3)',
    lore:'You came to the arcane through study, obsession, or accident. Either way, the runes answered — and now they always will.',
    bonus:{Magic:8, Crafting:3, Hitpoints:2},
    gear:['rune_fire','rune_fire','rune_heal'],
    startEquip:{},
    hairStyle:1,
  },
];

const ORIGINS = [
  {id:'valley',    name:'Valley Born',      desc:'+5 Fishing, gentle start',          bonus:{Fishing:5}},
  {id:'highlands', name:'Highlander',       desc:'+5 Mining, +2 Strength',            bonus:{Mining:5, Strength:2}},
  {id:'exile',     name:'Exiled Noble',     desc:'+30 starting gold, +2 Crafting',    bonus:{Crafting:2}, gold:30},
  {id:'orphan',    name:'Street Orphan',    desc:'+5 Crafting, +2 Attack',            bonus:{Crafting:5, Attack:2}},
  {id:'soldier',   name:'Veteran',          desc:'+3 Attack & Defence',               bonus:{Attack:3, Defence:3}},
  {id:'herbalist', name:'Hedge Witch',      desc:'+4 Farming, +4 Cooking',            bonus:{Farming:4, Cooking:4}},
  {id:'pilgrim',   name:'Wandering Pilgrim',desc:'+3 Woodcutting, +3 Fishing',        bonus:{Woodcutting:3, Fishing:3}},
  {id:'cursed',    name:'Cursed Bloodline', desc:'+6 Hitpoints, starts in darkness',  bonus:{Hitpoints:6, Attack:1}},
  {id:'arcane',    name:'Arcane Touched',   desc:'+8 Magic, +2 Crafting',             bonus:{Magic:8, Crafting:2}},
];

const SKIN_TONES = ['#f4c99a','#d4a070','#a06840','#7a4828','#4a2c18','#f0d0b0'];
const HAIR_COLORS = ['#1a1008','#3a2010','#6a4020','#9a7040','#c8a060','#c0c0c0','#e0e0ff','#c03030'];
const HAIR_STYLES = ['Short','Long','Braided','Shaved'];

let charCreate = {
  mode: 'solo',
  name: '',
  classId: 'warrior',
  originId: 'valley',
  skinIdx: 0,
  hairColorIdx: 0,
  hairStyleIdx: 0,
};

function goToCharCreate(mode){
  charCreate.mode = mode;
  // If no slot was pre-selected (via empty slot click), find first empty
  if(pendingSaveSlot == null && mode !== 'online-host' && mode !== 'online-guest') {
    for(let i = 0; i < MAX_SAVES; i++) {
      if(!getSaveMeta(i)) { pendingSaveSlot = i; break; }
    }
    if(pendingSaveSlot == null) pendingSaveSlot = 0;
  }
  document.getElementById('title-screen').style.display='none';
  document.getElementById('online-lobby').style.display='none';
  document.getElementById('char-create-screen').style.display='block';
  if(mode==='coop') document.getElementById('char-mode-label').textContent='CO-OP REALM';
  else if(mode==='online-host') document.getElementById('char-mode-label').textContent='ONLINE CO-OP — HOST';
  else if(mode==='online-guest') document.getElementById('char-mode-label').textContent='ONLINE CO-OP — GUEST';
  else document.getElementById('char-mode-label').textContent='SOLO JOURNEY';
  buildCharCreateUI();
}
function backToTitle(){
  document.getElementById('char-create-screen').style.display='none';
  document.getElementById('title-screen').style.display='flex';
  pendingSaveSlot = null;
  renderSaveSlots();
}

function buildCharCreateUI(){
  // Skin swatches
  const skinEl = document.getElementById('skin-swatches');
  skinEl.innerHTML='';
  SKIN_TONES.forEach((c,i)=>{
    const s=document.createElement('div');
    s.style.cssText=`width:20px;height:20px;background:${c};cursor:pointer;border:2px solid ${i===charCreate.skinIdx?'var(--gold-bright)':'transparent'};transition:border-color 0.15s;`;
    s.onclick=()=>{ charCreate.skinIdx=i; buildCharCreateUI(); };
    skinEl.appendChild(s);
  });

  // Hair color swatches
  const hairEl = document.getElementById('hair-swatches');
  hairEl.innerHTML='';
  HAIR_COLORS.forEach((c,i)=>{
    const s=document.createElement('div');
    s.style.cssText=`width:20px;height:20px;background:${c};cursor:pointer;border:2px solid ${i===charCreate.hairColorIdx?'var(--gold-bright)':'transparent'};transition:border-color 0.15s;`;
    s.onclick=()=>{ charCreate.hairColorIdx=i; buildCharCreateUI(); };
    hairEl.appendChild(s);
  });

  // Hair style buttons
  const styleEl = document.getElementById('hair-style-btns');
  styleEl.innerHTML='';
  HAIR_STYLES.forEach((name,i)=>{
    const b=document.createElement('button');
    b.textContent=name;
    b.style.cssText=`background:${i===charCreate.hairStyleIdx?'rgba(200,146,42,0.15)':'transparent'};
      border:1px solid ${i===charCreate.hairStyleIdx?'var(--gold)':'var(--border)'};
      color:${i===charCreate.hairStyleIdx?'var(--gold-bright)':'var(--text-dim)'};
      font-family:'Cinzel',serif;font-size:9px;padding:3px 6px;cursor:pointer;letter-spacing:1px;`;
    b.onclick=()=>{ charCreate.hairStyleIdx=i; buildCharCreateUI(); };
    styleEl.appendChild(b);
  });

  // Classes
  const classList = document.getElementById('class-list');
  classList.innerHTML='';
  CLASSES.forEach(cl=>{
    const d=document.createElement('div');
    const active=charCreate.classId===cl.id;
    d.style.cssText=`display:flex;align-items:center;gap:10px;padding:9px 10px;cursor:pointer;
      border:1px solid ${active?cl.color:'var(--border)'};
      background:${active?`rgba(${hexToRgb(cl.color)},0.12)`:'transparent'};
      transition:all 0.15s;`;
    d.innerHTML=`<span style="font-size:20px;min-width:24px;text-align:center;">${cl.icon}</span>
      <div>
        <div style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;color:${active?cl.color:'var(--text-bright)'};">${cl.name}</div>
        <div style="font-size:11px;color:var(--text-dim);">${Object.entries(cl.bonus).map(([k,v])=>`+${v} ${k}`).join(', ')}</div>
      </div>`;
    d.onmouseenter=()=>{ if(!active) d.style.borderColor='var(--border-bright)'; };
    d.onmouseleave=()=>{ if(!active) d.style.borderColor='var(--border)'; };
    d.onclick=()=>{ charCreate.classId=cl.id; buildCharCreateUI(); };
    classList.appendChild(d);
  });

  // Origins
  const originList = document.getElementById('origin-list');
  originList.innerHTML='';
  ORIGINS.forEach(or=>{
    const d=document.createElement('div');
    const active=charCreate.originId===or.id;
    d.style.cssText=`display:flex;align-items:flex-start;gap:8px;padding:7px 8px;cursor:pointer;
      border:1px solid ${active?'var(--gold)':'var(--border)'};
      background:${active?'rgba(200,146,42,0.08)':'transparent'};transition:all 0.15s;`;
    d.innerHTML=`<div style="width:8px;height:8px;border-radius:50%;background:${active?'var(--gold)':'var(--border)'};margin-top:4px;flex-shrink:0;"></div>
      <div>
        <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:1px;color:${active?'var(--gold-bright)':'var(--text-bright)'};">${or.name}</div>
        <div style="font-size:11px;color:var(--text-dim);">${or.desc}</div>
      </div>`;
    d.onclick=()=>{ charCreate.originId=or.id; buildCharCreateUI(); };
    originList.appendChild(d);
  });

  // Stats preview — auto-derived from GAME_DEFAULT_SKILLS so it always matches actual game skills
  const cl = CLASSES.find(c=>c.id===charCreate.classId);
  const or = ORIGINS.find(o=>o.id===charCreate.originId);

  // Auto-builds from master skill list — add new skill to GAME_DEFAULT_SKILLS and it appears here too
  const BASE_SKILLS = Object.fromEntries(
    Object.entries(GAME_DEFAULT_SKILLS).map(([k,v]) => [k, v.lvl])
  );

  // Colour per skill — unknown skills fall back gracefully
  const STAT_COLORS = {
    Mining:'#a0622a', Smithing:'#8a8a9a', Woodcutting:'#4a7a24', Crafting:'#9a6a2a',
    Fishing:'#2a6a8a', Cooking:'#c87830', Farming:'#7a9a2a', Magic:'#a060e0',
    Attack:'#c43030', Defence:'#2d6494', Strength:'#8b2020', Hitpoints:'#c43030',
  };
  const skillColorFor = (k) => STAT_COLORS[k] || '#b0a898';

  const bonuses = {};
  if(cl) Object.entries(cl.bonus).forEach(([k,v]) => bonuses[k] = (bonuses[k]||0)+v);
  if(or) Object.entries(or.bonus||{}).forEach(([k,v]) => bonuses[k] = (bonuses[k]||0)+v);

  // Merge all skills that appear in base OR in any bonus (future-proof)
  const allSkills = new Set([...Object.keys(BASE_SKILLS), ...Object.keys(bonuses)]);

  const statEl = document.getElementById('stat-preview');
  statEl.innerHTML = '';
  allSkills.forEach(k => {
    const base = BASE_SKILLS[k] ?? 1;
    const bonus = bonuses[k] || 0;
    const total = base + bonus;
    const col = skillColorFor(k);
    const bonusStr = bonus > 0
      ? `<span style="color:#e8b84b;font-size:10px;margin-left:3px;">+${bonus}</span>`
      : '';
    statEl.innerHTML += `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(42,47,58,0.4);">
      <span style="font-family:'Cinzel',serif;font-size:10px;color:var(--text-dim);letter-spacing:1px;">${k}</span>
      <span style="display:flex;align-items:center;gap:2px;">
        <span style="font-family:'Cinzel',serif;font-size:12px;font-weight:600;color:${col};">${total}</span>${bonusStr}
      </span>
    </div>`;
  });

  // Lore
  document.getElementById('class-lore').textContent = cl ? cl.lore : 'Select a path...';

  // Gear
  const gearEl=document.getElementById('gear-preview');
  gearEl.innerHTML='';
  if(cl) cl.gear.forEach(itemId=>{
    const it=ITEMS[itemId];
    if(it) gearEl.innerHTML+=`<div style="background:var(--bg-mid);border:1px solid var(--border);padding:4px 6px;font-size:18px;title='${it.name}'" title="${it.name}">${it.icon}</div>`;
  });
  if(or && or.gold){
    gearEl.innerHTML+=`<div style="background:var(--bg-mid);border:1px solid var(--border);padding:4px 6px;font-size:12px;font-family:'Cinzel',serif;color:var(--gold);">+${or.gold}g</div>`;
  }

  // Draw avatar
  drawAvatar();
}

function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

function drawAvatar(){
  const c=document.getElementById('avatar-canvas');
  const ctx=c.getContext('2d');
  const W=160,H=200;
  ctx.clearRect(0,0,W,H);

  const skin=SKIN_TONES[charCreate.skinIdx];
  const hair=HAIR_COLORS[charCreate.hairColorIdx];
  const cl=CLASSES.find(c=>c.id===charCreate.classId)||CLASSES[0];
  const style=charCreate.hairStyleIdx;

  // Background ambiance
  const grad=ctx.createRadialGradient(W/2,H*.6,10,W/2,H*.6,90);
  grad.addColorStop(0,`rgba(${hexToRgb(cl.color)},0.12)`);
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);

  // Ground shadow
  ctx.fillStyle='rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(W/2,H*.88,30,8,0,0,Math.PI*2); ctx.fill();

  // Legs
  ctx.fillStyle=cl.id==='rogue'?'#1a1020':cl.id==='ranger'?'#1a2a10':'#1a1a2a';
  ctx.fillRect(W/2-18,H*.62,14,H*.22);
  ctx.fillRect(W/2+4,H*.62,14,H*.22);

  // Boots
  ctx.fillStyle='#2a1a10';
  ctx.fillRect(W/2-20,H*.8,16,H*.08);
  ctx.fillRect(W/2+4,H*.8,16,H*.08);

  // Body / armor
  const armorColor = cl.id==='warrior'?'#3a2a1a':cl.id==='ranger'?'#1a3a14':cl.id==='rogue'?'#1a1028':cl.id==='miner'?'#2a2018':'#1a2a2a';
  ctx.fillStyle=armorColor;
  ctx.beginPath();
  ctx.moveTo(W/2-22,H*.62);
  ctx.lineTo(W/2-18,H*.30);
  ctx.lineTo(W/2+18,H*.30);
  ctx.lineTo(W/2+22,H*.62);
  ctx.closePath(); ctx.fill();

  // Armor detail / trim
  ctx.strokeStyle=cl.color; ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(W/2-22,H*.62);
  ctx.lineTo(W/2-18,H*.30);
  ctx.lineTo(W/2+18,H*.30);
  ctx.lineTo(W/2+22,H*.62);
  ctx.closePath(); ctx.stroke();

  // Belt
  ctx.fillStyle='#3a2a10';
  ctx.fillRect(W/2-22,H*.58,44,6);

  // Arms
  ctx.fillStyle=skin;
  ctx.fillRect(W/2-30,H*.32,10,H*.28);
  ctx.fillRect(W/2+20,H*.32,10,H*.28);

  // Gloves
  ctx.fillStyle=armorColor;
  ctx.fillRect(W/2-32,H*.54,12,H*.10);
  ctx.fillRect(W/2+20,H*.54,12,H*.10);

  // Neck
  ctx.fillStyle=skin;
  ctx.fillRect(W/2-6,H*.26,12,H*.06);

  // Head
  ctx.fillStyle=skin;
  ctx.beginPath(); ctx.ellipse(W/2,H*.20,18,20,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=`rgba(0,0,0,0.3)`; ctx.lineWidth=1; ctx.stroke();

  // Eyes
  ctx.fillStyle='#1a1008';
  ctx.beginPath(); ctx.ellipse(W/2-6,H*.18,2.5,2,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W/2+6,H*.18,2.5,2,0,0,Math.PI*2); ctx.fill();
  // Eye shine
  ctx.fillStyle='rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(W/2-5,H*.175,1,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(W/2+7,H*.175,1,0,Math.PI*2); ctx.fill();

  // Mouth
  ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(W/2,H*.22,4,0.2,Math.PI-.2); ctx.stroke();

  // Hair
  ctx.fillStyle=hair;
  if(style===0){ // Short
    ctx.beginPath(); ctx.ellipse(W/2,H*.12,18,12,0,Math.PI,0); ctx.fill();
    ctx.fillRect(W/2-18,H*.08,5,14); ctx.fillRect(W/2+13,H*.08,5,14);
  } else if(style===1){ // Long
    ctx.beginPath(); ctx.ellipse(W/2,H*.12,18,12,0,Math.PI,0); ctx.fill();
    ctx.fillRect(W/2-18,H*.08,6,H*.30);
    ctx.fillRect(W/2+12,H*.08,6,H*.30);
    ctx.beginPath(); ctx.moveTo(W/2-18,H*.38); ctx.quadraticCurveTo(W/2-22,H*.45,W/2-16,H*.48); ctx.lineTo(W/2-18,H*.45); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W/2+18,H*.38); ctx.quadraticCurveTo(W/2+22,H*.45,W/2+16,H*.48); ctx.lineTo(W/2+18,H*.45); ctx.fill();
  } else if(style===2){ // Braided
    ctx.beginPath(); ctx.ellipse(W/2,H*.12,18,12,0,Math.PI,0); ctx.fill();
    // Braid
    for(let i=0;i<8;i++){
      ctx.beginPath(); ctx.ellipse(W/2+2,H*.25+i*10,4,5,0.3,0,Math.PI*2);
      ctx.fillStyle=i%2===0?hair:`rgba(${hexToRgb(hair)},0.7)`; ctx.fill();
    }
  } else { // Shaved
    ctx.beginPath(); ctx.ellipse(W/2,H*.13,18,10,0,Math.PI,0);
    ctx.fillStyle=`rgba(${hexToRgb(hair)},0.4)`; ctx.fill();
  }

  // Weapon
  ctx.save();
  ctx.translate(W/2-38,H*.30);
  if(cl.icon==='⚔'){ // Sword
    ctx.fillStyle='#8a8a9a'; ctx.fillRect(-2,0,4,44); // blade
    ctx.fillStyle='#8b5a2b'; ctx.fillRect(-8,-4,16,6); // guard
    ctx.fillStyle='#5a3a1a'; ctx.fillRect(-2,44,4,14); // handle
    ctx.fillStyle=cl.color; ctx.strokeStyle=cl.color; ctx.lineWidth=0.5;
    ctx.strokeRect(-2,0,4,44);
  } else if(cl.icon==='🏹'){ // Bow
    ctx.strokeStyle='#5a3a1a'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,30,28,-Math.PI*.7,Math.PI*.7); ctx.stroke();
    ctx.strokeStyle='#9a8a6a'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-18,4); ctx.lineTo(-18,56); ctx.stroke();
  } else if(cl.icon==='⛏'){ // Pickaxe
    ctx.fillStyle='#5a5a6a'; ctx.fillRect(-2,0,4,30);
    ctx.save(); ctx.translate(0,0); ctx.rotate(-0.5);
    ctx.fillStyle='#8a8a9a'; ctx.fillRect(-10,-4,20,8);
    ctx.restore();
  } else if(cl.icon==='🗡'){ // Dagger
    ctx.fillStyle='#9a9aaa'; ctx.fillRect(-2,0,4,24);
    ctx.fillStyle='#8b5a2b'; ctx.fillRect(-5,22,10,4);
    ctx.fillStyle='#4a2a18'; ctx.fillRect(-2,26,4,12);
  } else { // Flask
    ctx.fillStyle='#1a3a3a'; ctx.beginPath(); ctx.ellipse(0,20,8,12,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(45,148,148,0.6)'; ctx.beginPath(); ctx.ellipse(0,20,6,10,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3a3a4a'; ctx.fillRect(-3,6,6,8);
  }
  ctx.restore();

  // Class icon badge
  ctx.fillStyle='rgba(10,12,16,0.8)';
  ctx.beginPath(); ctx.arc(W-22,22,14,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=cl.color; ctx.lineWidth=1.5; ctx.stroke();
  ctx.font='16px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(cl.icon,W-22,22);

  // Name tag
  const name = document.getElementById('char-name-input')?.value || '???';
  ctx.fillStyle='rgba(10,12,16,0.85)';
  ctx.fillRect(0,H-28,W,28);
  ctx.strokeStyle=cl.color; ctx.lineWidth=1;
  ctx.strokeRect(0,H-28,W,28);
  ctx.font='bold 13px Cinzel, serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=cl.color;
  ctx.fillText(name||'???',W/2,H-14);
}

function updateCharPreview(){ drawAvatar(); }

const RANDOM_NAMES=[
  // Classic dark fantasy
  'Aldric','Morrigan','Serath','Vex','Grimholt','Aelara','Thorne','Kestral','Vorn','Sable',
  'Edric','Nyx','Dunmoor','Ashveil','Corvus','Isolde','Rynn','Blackmere','Fenrath','Duskwood',
  // Gritty & weathered
  'Crag','Wulfric','Brae','Torven','Elspeth','Hadden','Mira','Oskar','Seren','Brom',
  'Callum','Vesper','Aldous','Neve','Cinder','Gareth','Lorn','Idris','Petra','Holt',
  // Mystical / arcane-flavoured
  'Zephyra','Sorin','Calix','Ondine','Raziel','Thessaly','Vael','Crestia','Mordecai','Lyris',
  'Azreth','Solvaine','Tavian','Wraith','Elessar','Nyxara','Dorian','Sylveth','Caedmon','Frostborn',
  // Short & punchy
  'Dax','Rue','Finn','Skye','Ashe','Cael','Brix','Tane','Oryn','Wren',
  'Kade','Zev','Brynn','Luca','Flint','Vale','Rhys','Sloane','Corvin','Ember',
];
function rollRandomName(){
  const n=RANDOM_NAMES[Math.floor(Math.random()*RANDOM_NAMES.length)];
  document.getElementById('char-name-input').value=n;
  charCreate.name=n;
  drawAvatar();
}

function beginAdventure(){
  const nameVal = document.getElementById('char-name-input').value.trim();
  if(!nameVal){ 
    document.getElementById('char-name-input').style.borderColor='var(--red-bright)';
    setTimeout(()=>document.getElementById('char-name-input').style.borderColor='var(--border-bright)',1200);
    return;
  }
  charCreate.name = nameVal;

  // Apply class + origin bonuses to current player being created
  const isP2 = charCreate._creatingP2 === true;
  const cl = CLASSES.find(c=>c.id===charCreate.classId);
  const or = ORIGINS.find(o=>o.id===charCreate.originId);
  const p = state.players[isP2 ? 1 : 0];
  p.name = charCreate.name;

  if(cl){
    Object.entries(cl.bonus).forEach(([k,v])=>{
      if(!p.skills[k]) p.skills[k] = {lvl:1, xp:0};  // init new skills if missing
      p.skills[k].lvl = Math.max(1, (p.skills[k].lvl||1) + v);
    });
    cl.gear.forEach(itemId=>{ const slot=p.inventory.indexOf(null); if(slot>=0) p.inventory[slot]={id:itemId,qty:1}; });
    if(cl.startEquip) {
      if(!p.equipment) p.equipment = {weapon:null,shield:null,head:null,body:null,legs:null,ammo:null};
      Object.entries(cl.startEquip).forEach(([slot,itemId])=>{ p.equipment[slot]=itemId; });
    }
  }
  if(or){
    Object.entries(or.bonus||{}).forEach(([k,v])=>{
      if(!p.skills[k]) p.skills[k] = {lvl:1, xp:0};
      p.skills[k].lvl = Math.max(1, (p.skills[k].lvl||1) + v);
    });
    if(or.gold) p.gold+=or.gold;
  }
  p.maxHp = p.skills.Hitpoints.lvl * 3;
  p.hp = p.maxHp;
  p.appearance = {
    skinIdx: charCreate.skinIdx,
    hairColorIdx: charCreate.hairColorIdx,
    hairStyleIdx: charCreate.hairStyleIdx,
    classId: charCreate.classId,
  };

  // Co-op: after P1 create, go straight to P2 create
  if(charCreate.mode === 'coop' && !isP2) {
    charCreate._creatingP2 = true;
    // Add P2 slot if not there yet
    if(state.players.length < 2) {
      state.players.push({
        name:'Champion', hp:30, maxHp:30, gold:0,
        skills: JSON.parse(JSON.stringify(state.players[0].skills)),
        inventory: Array(28).fill(null),
        equipment: {weapon:null, shield:null, head:null, body:null, legs:null, ammo:null},
        appearance:{ skinIdx:1, hairColorIdx:2, hairStyleIdx:1, classId:'warrior' },
      });
    } else {
      // Reset P2 skills for fresh create
      state.players[1].skills = JSON.parse(JSON.stringify(state.players[0].skills));
      Object.values(state.players[1].skills).forEach(s=>{s.lvl=1;s.xp=0;});
    }
    // Reset char create state for P2
    charCreate.name=''; charCreate.classId='warrior'; charCreate.originId='valley';
    charCreate.skinIdx=1; charCreate.hairColorIdx=2; charCreate.hairStyleIdx=1;
    document.getElementById('char-name-input').value='';
    document.getElementById('char-mode-label').textContent='PLAYER 2 — CO-OP REALM';
    document.getElementById('char-name-input').placeholder='Player 2 name...';
    updateCharPreview();
    return; // stay on char create screen for P2
  }

  // Online co-op: route to lobby after char create (no local P2 needed)
  if(charCreate.mode === 'online-host') {
    document.getElementById('char-create-screen').style.display='none';
    afterHostCharCreate();
    return;
  }
  if(charCreate.mode === 'online-guest') {
    document.getElementById('char-create-screen').style.display='none';
    afterGuestCharCreate();
    return;
  }

  // Done — start game
  charCreate._creatingP2 = false;
  document.getElementById('char-create-screen').style.display='none';

  // Assign save slot
  activeSaveSlot = pendingSaveSlot;
  if(activeSaveSlot == null) {
    for(let i = 0; i < MAX_SAVES; i++) {
      if(!getSaveMeta(i)) { activeSaveSlot = i; break; }
    }
    if(activeSaveSlot == null) activeSaveSlot = 0;
  }
  pendingSaveSlot = null;

  startGame(charCreate.mode);
}

