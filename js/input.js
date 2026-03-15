// ======= CANVAS EVENTS =======
canvas.addEventListener('mousemove',e=>{
  const r=canvas.getBoundingClientRect();
  const sx=e.clientX-r.left, sy=e.clientY-r.top;
  const {x:tx,y:ty}=screenToTile(sx,sy);
  const map=currentMap;
  if(!map||tx<0||tx>=map.W||ty<0||ty>=map.H){hoverTile={x:-1,y:-1};
    document.getElementById('action-tooltip').classList.remove('show'); return;}
  hoverTile={x:tx,y:ty};
  const tip=document.getElementById('action-tooltip');
  // Check NPC first
  const npc=getNpcAt(tx,ty);
  if(npc){
    if(npc.isMystery) {
      tip.textContent='❓ A hooded figure — Click to approach';
      tip.style.left=(sx+12)+'px'; tip.style.top=(sy-30)+'px';
      tip.classList.add('show'); return;
    }
    const hasTrade = NPC_DIALOGUE[npc.typeId]?.hasTrade;
    tip.textContent=`💬 ${npc.def.name} — ${hasTrade ? 'Click to talk / Trade' : 'Click to talk'}`;
    tip.style.left=(sx+12)+'px'; tip.style.top=(sy-30)+'px';
    tip.classList.add('show'); return;
  }
  // Check enemy first
  const en=getEnemyAt(tx,ty);
  if(en){
    tip.textContent=`⚔ Attack ${en.def.name} (HP: ${en.hp}/${en.maxHp})`;
    tip.style.left=(sx+12)+'px'; tip.style.top=(sy-30)+'px';
    tip.classList.add('show'); return;
  }
  const t=map.tiles[ty][tx];
  const label=getTileLabel(t,tx,ty);
  if(label){
    tip.textContent=label;
    tip.style.left=(sx+12)+'px';
    tip.style.top=(sy-30)+'px';
    tip.classList.add('show');
  } else {
    tip.classList.remove('show');
  }
});
canvas.addEventListener('mouseleave',()=>{
  hoverTile={x:-1,y:-1};
  document.getElementById('action-tooltip').classList.remove('show');
});
canvas.addEventListener('click',e=>{
  const r=canvas.getBoundingClientRect();
  const {x:tx,y:ty}=screenToTile(e.clientX-r.left, e.clientY-r.top);
  if(!currentMap||tx<0||tx>=currentMap.W||ty<0||ty>=currentMap.H)return;
  // Left-click NPC = walk to and talk
  const npc=getNpcAt(tx,ty);
  if(npc){
    if(npc.isMystery) { walkThenDo(tx,ty,()=>openMysteryDialogue()); return; }
    if(npc.def.isAnimal) { playerPath=[]; walkThenDo(tx,ty,()=>{}); return; }
    walkThenDo(tx,ty,()=>openDialogue(npc)); return;
  }
  // Left-click enemy = walk and attack
  const en=getEnemyAt(tx,ty);
  if(en){ walkToAttackEnemy(en); return; }
  playerPath=[];
  pendingAction=null;
  movePlayerToward(tx,ty);
});
canvas.addEventListener('contextmenu',e=>{
  e.preventDefault();
  const r=canvas.getBoundingClientRect();
  const {x:tx,y:ty}=screenToTile(e.clientX-r.left, e.clientY-r.top);
  const map=currentMap;
  if(!map||tx<0||tx>=map.W||ty<0||ty>=map.H) return;
  // NPC right-click menu
  const npc=getNpcAt(tx,ty);
  if(npc){
    if(npc.isMystery){ showMysteryCtxMenu(e,tx,ty); return; }
    showNpcCtxMenu(e,npc); return;
  }
  // Enemy right-click menu
  const en=getEnemyAt(tx,ty);
  if(en){ showEnemyCtxMenu(e,en); return; }
  showTileCtxMenu(e,tx,ty,map.tiles[ty][tx]);
});

function showNpcCtxMenu(e, npc) {
  const tx=Math.round(npc.x), ty=Math.round(npc.y);

  // Animals get a Catch action instead of Talk
  if(npc.def.isAnimal) {
    const animalType = npc.typeId === T.ANIMAL_CHICKEN ? 'chicken'
                     : npc.typeId === T.ANIMAL_PIG     ? 'pig'
                     : 'cow';
    const animalIcon = npc.typeId === T.ANIMAL_CHICKEN ? '🐔'
                     : npc.typeId === T.ANIMAL_PIG     ? '🐷'
                     : '🐄';
    ctxMenu.innerHTML=`<div class="ctx-title">${animalIcon} ${npc.def.name}</div>`;
    const catchBtn=document.createElement('div');
    catchBtn.className='ctx-item';
    catchBtn.innerHTML=`<span class="ctx-icon">${animalIcon}</span>Catch`;
    catchBtn.onclick=()=>{ hideCtxMenu(); walkThenDo(tx,ty,()=>catchAnimal(tx,ty,animalType)); };
    ctxMenu.appendChild(catchBtn);
    const _r1=document.getElementById('map-container').getBoundingClientRect();
    ctxMenu.style.left=(_r1.left+_r1.width/2-70)+'px';
    ctxMenu.style.top=(_r1.top+_r1.height/2-60)+'px';
    ctxMenu.style.display='block';
    return;
  }

  ctxMenu.innerHTML=`<div class="ctx-title">💬 ${npc.def.name}</div>`;
  const talk=document.createElement('div');
  talk.className='ctx-item';
  talk.innerHTML='<span class="ctx-icon">💬</span>Talk';
  talk.onclick=()=>{ hideCtxMenu(); walkThenDo(tx,ty,()=>openDialogue(npc)); };
  ctxMenu.appendChild(talk);
  if(NPC_DIALOGUE[npc.typeId]?.hasTrade) {
    const trade=document.createElement('div');
    trade.className='ctx-item';
    const isInnkeeper = npc.typeId === T.NPC_INNKEEPER;
    trade.innerHTML=`<span class="ctx-icon">${isInnkeeper ? '🍺' : '🛒'}</span>${isInnkeeper ? 'See Menu' : 'Trade'}`;
    trade.onclick=()=>{
      hideCtxMenu();
      walkThenDo(tx,ty,()=>{ isInnkeeper ? openInnkeeperShop() : openMerchantShop(); });
    };
    ctxMenu.appendChild(trade);
  }
  ctxMenu.style.left=e.clientX+'px'; ctxMenu.style.top=e.clientY+'px';
  ctxMenu.classList.add('show');
}

function showMysteryCtxMenu(e, tx, ty) {
  ctxMenu.innerHTML=`<div class="ctx-title">❓ Hooded Figure</div>`;
  const approach=document.createElement('div');
  approach.className='ctx-item';
  approach.innerHTML='<span class="ctx-icon">👁</span>Approach';
  approach.onclick=()=>{ hideCtxMenu(); walkThenDo(tx,ty,()=>openMysteryDialogue()); };
  ctxMenu.appendChild(approach);
  ctxMenu.style.left=e.clientX+'px'; ctxMenu.style.top=e.clientY+'px';
  ctxMenu.classList.add('show');
}

function walkToAttackEnemy(en) {
  if(currentActivity){log('Already busy.','bad');return;}
  const tx=Math.round(en.x), ty=Math.round(en.y);
  movePlayerToward(tx, ty, ()=>startCombatEntity(en));
}

function showEnemyCtxMenu(e, en) {
  ctxMenu.innerHTML=`<div class="ctx-title">⚔ ${en.def.name}</div>`;
  const hp=document.createElement('div');
  hp.style.cssText='padding:5px 12px;font-size:11px;color:var(--text-dim);font-family:Cinzel,serif;border-bottom:1px solid var(--border);';
  hp.textContent=`HP: ${en.hp} / ${en.maxHp}`;
  ctxMenu.appendChild(hp);
  const atk=document.createElement('div');
  atk.className='ctx-item';
  atk.innerHTML='<span class="ctx-icon">⚔</span>Attack';
  atk.onclick=()=>{hideCtxMenu();walkToAttackEnemy(en);};
  ctxMenu.appendChild(atk);
  ctxMenu.style.left=e.clientX+'px'; ctxMenu.style.top=e.clientY+'px';
  ctxMenu.classList.add('show');
}

function getTileLabel(t, tx, ty){
  const labels={
    [T.COPPER]:'⛏ Mine Copper Ore',
    [T.IRON]:'⛏ Mine Iron Ore',
    [T.GOLD_ORE]:'⛏ Mine Gold Ore',
    [T.MITHRIL]:'⛏ Mine Mithril Ore',
    [T.COAL]:'⛏ Mine Coal',
    [T.NORMAL_TREE]:'🪓 Chop Tree',
    [T.OAK]:'🪓 Chop Oak',
    [T.WILLOW]:'🪓 Chop Willow',
    [T.FISHING]:'🎣 Fish here',
    [T.FISHING2]:'🎣 Fish here',
    [T.GOBLIN]:'⚔ Attack Goblin',
    [T.SKELETON]:'⚔ Attack Skeleton',
    [T.WOLF]:'⚔ Attack Wolf',
    [T.SMELTER]:'🔥 Use Smelter',
    [T.COOKING_FIRE]:'🍖 Cook Food',
    [T.SHOP]:'🏪 Open Shop',
    [T.EXIT]:'➤ Enter Next Zone',
    [T.EXIT_RETURN]:'◀ Return to Previous Zone',
    [T.INN]:'🍺 The Tarnished Flagon (Inn)',
    [T.INN_DOOR]:'🚪 Enter The Tarnished Flagon',
    [T.EXIT_INTERIOR]:'🚪 Leave — Return Outside',
    [T.TABLE]:'🪵 Wooden Table',
    [T.BARREL]:'🛢 Oak Barrel',
    [T.BED]:'🛏 Straw Bed',
    [T.BOOKSHELF]:'📚 Bookshelf',
    [T.CANDLE]:'🕯 Candle',
    [T.CHEST]:'📦 Wooden Chest',
    [T.NOTICE_BOARD]:'📜 Notice Board',
    [T.BLACKSMITH]:'⚒ Grimward\'s Smithy',
    [T.TOWN_WELL]:'💧 Town Well',
    [T.LAMPPOST]:'🕯 Lamppost',
    [T.WORKBENCH]:'🪵 Woodworking Bench',
    [T.GRAVE]:'🪦 Gravestone',
    [T.FENCE]:'🪵 Wooden Fence',
    [T.HOUSE_A]:'🏠 Residence',
    [T.HOUSE_B]:'🏠 Residence',
    [T.HOUSE_C]:'🏠 Residence',
    [T.FLOWER]:'❀ Wildflowers',
    [T.SIGN]:'⚑ Signpost',
    [T.BUSH]:'🌿 Shrub',
    [T.CHAPEL_PORTAL]:'⛪ The Forsaken Chapel — Enter',
    [T.ALTAR]:'🕯 Desecrated Altar',
    [T.PILLAR]:'🪨 Crumbling Pillar',
    [T.CHAPEL_RUNE]:'🔮 Carved Rune',
    // Farm
    [T.FARM_PORTAL]:'🌾 Portal to Greenfield Pastures',
    [T.HAY_BALE]:'🌾 Hay Bale',
    [T.FENCE_POST]:'🪵 Fence Post',
    [T.WATER_TROUGH]:'💧 Water Trough',
    [T.SCARECROW]:'🎃 Scarecrow',
    [T.CROP_WHEAT]:'🌾 Wheat — Harvest',
    [T.CROP_TURNIP]:'🥕 Turnip — Harvest',
    [T.WINDMILL]:'⚙️ Windmill',
    [T.ANIMAL_CHICKEN]:'🐔 Chicken',
    [T.ANIMAL_PIG]:'🐷 Pig',
    [T.ANIMAL_COW]:'🐄 Cow',
    [T.NPC_FARMER]:'💬 Farmer',
  };
  // Position-aware overrides for tiles that have different meanings by location
  if(t === T.BWALL_DOOR && currentMap && currentMap.name === 'ASHENVEIL' && tx !== undefined) {
    const lx = tx, ly = ty;
    if(lx===8 && ly===8) return '🚪 The Tarnished Flagon — Enter';
    const HOUSE_LABELS = {
      "3,33":"🚪 Mira's House",  "3,40":"🚪 Aldric's House",
      "3,47":"🚪 Residence",        "3,54":"🚪 Residence",
      "27,3":"🚪 Elspeth's House", "27,11":"🚪 Rowan's House",
      "7,24":"🚪 The Ashen Forge — Enter",
    };
    return HOUSE_LABELS[`${ly},${lx}`] || '';
  }
  if(t === T.BWALL_DOOR) return '';
  return labels[t]||'';
}

// ======= PATHFINDING + SMOOTH MOVEMENT =======
let playerReal = {x:5,y:6};
let playerPath = [];
let playerMoving = false;
const MOVE_SPEED = 5.5; // tiles/sec
let pendingAction = null;
let walkAnim = null;

const SOLID_TILES = new Set([
  T.WALL, T.WATER,
  T.COPPER, T.IRON, T.GOLD_ORE, T.MITHRIL, T.COAL,
  T.NORMAL_TREE, T.OAK, T.WILLOW,
  T.SMELTER, T.COOKING_FIRE, T.SHOP, T.WORKBENCH,
  T.INN, T.BLACKSMITH, T.TOWN_WELL, T.LAMPPOST,
  T.TABLE, T.BARREL,
  T.BED, T.BOOKSHELF, T.CANDLE, T.CHEST, T.NOTICE_BOARD,
  T.GRAVE, T.FENCE, T.HOUSE_A, T.HOUSE_B, T.HOUSE_C, T.SIGN, T.BUSH,
  T.ALTAR, T.PILLAR,
  // Building tiles — all solid (player can't walk through walls/roofs)
  T.ROOF_L, T.ROOF_M, T.ROOF_R, T.ROOF_CHIMNEY,
  T.BWALL_DOOR, T.BWALL_WIN, T.BWALL_FORGE, T.BWALL_AWNING, T.BWALL_PLAIN, T.BWALL_SIDE,
  // Farm structures (solid)
  T.HAY_BALE, T.FENCE_POST, T.WATER_TROUGH, T.SCARECROW, T.WINDMILL,
  // Crops are solid (walk-adjacent to harvest)
  T.CROP_WHEAT, T.CROP_TURNIP,
  // Interior house furniture — solid
  T.SMALL_TABLE, T.WARDROBE, T.FIREPLACE,
  // PLANT is decorative but solid (potted plant)
  T.PLANT,
  // CHAPEL_PORTAL and CHAPEL_RUNE are walkable (trigger or floor decor)
  // INN_DOOR and EXIT_INTERIOR are walkable — stepping on them triggers teleport
  // FARM_PORTAL, ANIMAL_CHICKEN, ANIMAL_PIG, ANIMAL_COW are walkable (step-on triggers)
]);

function isSolid(tx,ty){
  if(!currentMap)return true;
  if(tx<0||tx>=currentMap.W||ty<0||ty>=currentMap.H)return true;
  return SOLID_TILES.has(currentMap.tiles[ty][tx]);
}

function findPath(sx,sy,tx,ty){
  if(sx===tx&&sy===ty)return[];
  const W=currentMap.W,H=currentMap.H;
  const visited=new Uint8Array(W*H);
  const parent=new Int16Array(W*H).fill(-1);
  const queue=[];
  const start=sy*W+sx;
  visited[start]=1;
  queue.push(start);
  const dirs=[[-1,0],[1,0],[0,-1],[0,1]];
  let found=false;
  outer: while(queue.length){
    const cur=queue.shift();
    const cx=cur%W,cy=Math.floor(cur/W);
    if(cx===tx&&cy===ty){found=true;break;}
    for(const[dx,dy]of dirs){
      const nx=cx+dx,ny=cy+dy;
      if(nx<0||nx>=W||ny<0||ny>=H)continue;
      const ni=ny*W+nx;
      if(visited[ni])continue;
      visited[ni]=1;
      parent[ni]=cur;
      if(nx===tx&&ny===ty){found=true;break outer;}
      if(!isSolid(nx,ny))queue.push(ni);
    }
  }
  if(!found)return null;
  const path=[];
  let node=ty*W+tx;
  while(parent[node]!==-1){
    path.unshift({x:node%W,y:Math.floor(node/W)});
    node=parent[node];
  }
  // If dest solid, stop one step before
  if(isSolid(tx,ty)&&path.length>0)path.pop();
  return path;
}

function movePlayerToward(tx,ty,onArrive){
  if(currentActivity)return;
  const path=findPath(playerPos.x,playerPos.y,tx,ty);
  if(!path||path.length===0){
    if(onArrive)onArrive();
    return;
  }
  playerPath=path;
  pendingAction=onArrive||null;
  if(!playerMoving)stepPlayerPath();
}

function stepPlayerPath(){
  if(playerPath.length===0){
    playerMoving=false;
    if(pendingAction){pendingAction();pendingAction=null;return;}
    checkZoneExit();
    return;
  }
  playerMoving=true;
  const next=playerPath.shift();
  animatePlayerStep(playerPos.x,playerPos.y,next.x,next.y,()=>{
    playerPos={x:next.x,y:next.y};
    playerReal={x:next.x,y:next.y};
    checkZoneExit();
    stepPlayerPath();
  });
}

function animatePlayerStep(fromX,fromY,toX,toY,onDone){
  if(walkAnim){cancelAnimationFrame(walkAnim);walkAnim=null;}
  const startTime=performance.now();
  const duration=1000/MOVE_SPEED;
  function frame(now){
    const t=Math.min(1,(now-startTime)/duration);
    const ease=t<0.5?2*t*t:-1+(4-2*t)*t;
    playerReal.x=fromX+(toX-fromX)*ease;
    playerReal.y=fromY+(toY-fromY)*ease;
    if(t<1){walkAnim=requestAnimationFrame(frame);}
    else{walkAnim=null;onDone();}
  }
  walkAnim=requestAnimationFrame(frame);
}

// ======= CONTEXT MENUS =======
const ctxMenu=document.getElementById('ctx-menu');

function showTileCtxMenu(e,tx,ty,t){
  ctxMenu.innerHTML='';
  const title=document.createElement('div');
  title.className='ctx-title';
  title.textContent=getTileLabel(t, tx, ty)||'Tile Options';
  ctxMenu.appendChild(title);

  const actions=getTileActions(t);
  actions.forEach(a=>{
    const d=document.createElement('div');
    d.className='ctx-item'+(a.danger?' danger':'');
    d.innerHTML=`<span class="ctx-icon">${a.icon}</span>${a.label}`;
    d.onclick=()=>{
      hideCtxMenu();
      a.action(tx,ty,t);
    };
    ctxMenu.appendChild(d);
  });

  const {clientX:cx,clientY:cy}=e;
  ctxMenu.style.left=cx+'px'; ctxMenu.style.top=cy+'px';
  ctxMenu.classList.add('show');
}

function getTileActions(t){
  if(t===T.COPPER)    return [{icon:'⛏',label:'Mine Copper',   action:(x,y)=>walkThenDo(x,y,()=>startMine(x,y,'copper_ore','Mining',10,1800))}];
  if(t===T.IRON)      return [{icon:'⛏',label:'Mine Iron',     action:(x,y)=>walkThenDo(x,y,()=>startMine(x,y,'iron_ore','Mining',35,2400))}];
  if(t===T.GOLD_ORE)  return [{icon:'⛏',label:'Mine Gold',     action:(x,y)=>walkThenDo(x,y,()=>startMine(x,y,'gold_ore','Mining',65,3200))}];
  if(t===T.MITHRIL)   return [{icon:'⛏',label:'Mine Mithril',  action:(x,y)=>walkThenDo(x,y,()=>startMine(x,y,'mithril_ore','Mining',80,4000))}];
  if(t===T.COAL)      return [{icon:'⛏',label:'Mine Coal',     action:(x,y)=>walkThenDo(x,y,()=>startMine(x,y,'coal','Mining',30,2200))}];
  if(t===T.NORMAL_TREE)return [{icon:'🪓',label:'Chop Tree',   action:(x,y)=>walkThenDo(x,y,()=>startChop(x,y,'normal_log','Woodcutting',25,1800))}];
  if(t===T.OAK)       return [{icon:'🪓',label:'Chop Oak',     action:(x,y)=>walkThenDo(x,y,()=>startChop(x,y,'oak_log','Woodcutting',37.5,2500))}];
  if(t===T.WILLOW)    return [{icon:'🪓',label:'Chop Willow',  action:(x,y)=>walkThenDo(x,y,()=>startChop(x,y,'willow_log','Woodcutting',67.5,3200))}];
  if(t===T.FISHING||t===T.FISHING2) return [
    {icon:'🎣',label:'Fish (Bait)',     action:(x,y)=>walkThenDo(x,y,()=>openFishingMenu(x,y,'bait'))},
    {icon:'🪝',label:'Fish (Fly)',      action:(x,y)=>walkThenDo(x,y,()=>openFishingMenu(x,y,'fly'))},
    {icon:'🗡',label:'Fish (Harpoon)', action:(x,y)=>walkThenDo(x,y,()=>openFishingMenu(x,y,'harpoon'))},
  ];
  if(t===T.SMELTER)       return [{icon:'🔥',label:'Smelt Bars',        action:(x,y)=>walkThenDo(x,y,()=>openSmelter())}];
  if(t===T.COOKING_FIRE)  return [{icon:'🍖',label:'Cook Food',          action:(x,y)=>walkThenDo(x,y,()=>openCooker())}];
  if(t===T.SHOP)          return [{icon:'🏪',label:'Visit Shop',         action:(x,y)=>walkThenDo(x,y,()=>openShop())}];
  if(t===T.WORKBENCH)     return [{icon:'🪵',label:'Craft Woodwork',     action:(x,y)=>walkThenDo(x,y,()=>openWorkbench())}];
  if(t===T.BED)           return [{icon:'🛏',label:'Sleep',        action:(x,y)=>walkThenDo(x,y,()=>sleepUntilMorning())}];
  if(t===T.EXIT)          return [{icon:'➤', label:'Next Zone',   action:(x,y)=>walkThenDo(x,y,()=>doZoneTransition(1))}];
  if(t===T.EXIT_RETURN)   return [{icon:'◀', label:'Previous Zone',action:(x,y)=>walkThenDo(x,y,()=>doZoneTransition(-1))}];
  if(t===T.NOTICE_BOARD)  return [{icon:'📜',label:'Read Notice Board', action:(x,y)=>walkThenDo(x,y,()=>readNoticeBoard(x,y))}];
  if(t===T.BOOKSHELF)     return [{icon:'📚',label:'Browse Books',      action:(x,y)=>walkThenDo(x,y,()=>readBookshelf(x,y))}];
  if(t===T.CHEST)         return [{icon:'📦',label:'Search Chest',      action:(x,y)=>walkThenDo(x,y,()=>searchChest(x,y))}];
  if(t===T.INN_DOOR)      return [{icon:'🚪',label:'Enter Inn',         action:(x,y)=>movePlayerToward(x,y)}];
  if(t===T.BWALL_DOOR) {
    if(currentMap && currentMap.name==='ASHENVEIL') {
      // Inn door
      if(x===8 && y===8) return [{icon:'🚪',label:'Enter The Tarnished Flagon', action:()=>movePlayerToward(8,9)}];
      // House doors — approach tile is y+1
      const HOUSE_ACTIONS = {
        '3,33':{label:"Enter Mira's House"},   '3,40':{label:"Enter Aldric's House"},
        '3,47':{label:'Enter Residence'},       '3,54':{label:'Enter Residence'},
        '27,3':{label:"Enter Elspeth's House"}, '27,11':{label:"Enter Rowan's House"},
        '7,24':{label:'Enter The Ashen Forge'},
      };
      const ha = HOUSE_ACTIONS[`${y},${x}`];
      if(ha) return [{icon:'🚪',label:ha.label, action:()=>movePlayerToward(x, y+1)}];
    }
    return [];
  }
  if(t===T.EXIT_INTERIOR) return [{icon:'🚪',label:'Leave',             action:(x,y)=>movePlayerToward(x,y)}];
  if(t===T.CHAPEL_PORTAL) return [{icon:'⛪',label:'Enter the Forsaken Chapel', action:(x,y)=>movePlayerToward(x,y)}];
  if(t===T.ALTAR)         return [{icon:'🕯',label:'Examine Altar',     action:(x,y)=>walkThenDo(x,y,()=>examineAltar(x,y))}];
  if(t===T.CHAPEL_RUNE)   return [{icon:'🔮',label:'Read Rune',         action:(x,y)=>walkThenDo(x,y,()=>readChapelRune(x,y))}];
  if(t===T.WIZARD_DOOR) {
    return [{icon:'🚪', label:'Enter the tower', action:(x,y)=>movePlayerToward(x,y)}];
  }
  if(t===T.FOREST_PORTAL) {
    const inWood = currentMap && currentMap.name==='THE WHISPERWOOD';
    return [{icon:'🌲', label: inWood ? 'Leave the Whisperwood' : 'Enter the Whisperwood', action:(x,y)=>movePlayerToward(x,y)}];
  }
  if(t===T.CRYSTAL_BALL) return [{icon:'🔮',label:'Gaze into the crystal',action:(x,y)=>walkThenDo(x,y,()=>{
    const visions=['The crystal shows a swirling void... and two pale eyes staring back.',
      'You glimpse a crumbling city beneath a red sky. It feels familiar, but you have never been there.',
      'A figure in shadow raises one hand. The image shatters like glass.',
      'The mists clear to reveal a door, sealed with seven locks. You do not have the keys.'];
    log('🔮 '+visions[Math.floor(Math.random()*visions.length)],'neutral');
  })}];
  if(t===T.SPELL_TOME) return [
    {icon:'✨',label:'Craft Runes', action:(x,y)=>walkThenDo(x,y,()=>{
      if(!questFlags.magic_intro_seen) {
        log('📖 The tome pulses with arcane light. You sense the instructions within — recipes for shaping raw magic into runes.','gold');
        questFlags.magic_intro_seen = true;
      }
      openRuneCrafter();
    })},
    {icon:'📖',label:'Read the tome', action:(x,y)=>walkThenDo(x,y,()=>{
      const pages=['The script is indecipherable — but somehow you understand: \"Do not speak the final syllable.\"',
        'Page after page of star charts, each constellation crossed out in red ink.',
        'A recipe. The ingredients include \"3 drops of moonlit silence\" and \"the memory of fire.\"',
        'The last page reads only: ALDERMAST KNOWS.',
        'A margin note: \"Arcane Dust — coal for the spark, copper ore for the vessel.\"',
        'A diagram shows a Fire Rune forming from two measures of Arcane Dust. The heat is annotated as \"moderate. Do not inhale.\"'];
      log('📖 '+pages[Math.floor(Math.random()*pages.length)],'neutral');
    })}
  ];
  if(t===T.DUNGEON_STAIR_DOWN) return [{icon:'⬇',label:'Descend into dungeon', action:(x,y)=>movePlayerToward(x,y)}];
  if(t===T.DUNGEON_STAIR_UP)   return [{icon:'⬆',label:'Climb back up',        action:(x,y)=>movePlayerToward(x,y)}];
  if(t===T.CRYPT_STAIR)        return [{icon:'⬇',label:'Descend into catacombs',action:(x,y)=>movePlayerToward(x,y)}];
  if(t===T.GRAVE) {
    const inChapel = currentMap && currentMap.name==='THE FORSAKEN CHAPEL';
    if(inChapel && !questFlags.crypt_stair_revealed)
      return [{icon:'⚰',label:'Examine Tomb', action:(x,y)=>walkThenDo(x,y,()=>revealCryptStair())}];
  }
  // Farm portal
  if(t===T.FARM_PORTAL) {
    const onFarm = currentMap && currentMap.name==='GREENFIELD PASTURES';
    return [{icon:'🌾', label: onFarm ? 'Return to Ashenveil' : 'Enter Greenfield Pastures', action:(x,y)=>movePlayerToward(x,y)}];
  }
  // Crop harvesting
  if(t===T.CROP_WHEAT)   return [{icon:'🌾',label:'Harvest Wheat',  action:(x,y)=>walkThenDo(x,y,()=>harvestCrop(x,y,'wheat',   'Farming? No skill — just labor.',4))}];
  if(t===T.CROP_TURNIP)  return [{icon:'🥕',label:'Harvest Turnip', action:(x,y)=>walkThenDo(x,y,()=>harvestCrop(x,y,'turnip',  'You pull the turnip from the earth.',3))}];
  // Animal interactions
  if(t===T.ANIMAL_CHICKEN) return [{icon:'🐔',label:'Catch Chicken', action:(x,y)=>walkThenDo(x,y,()=>catchAnimal(x,y,'chicken'))}];
  if(t===T.ANIMAL_PIG)     return [{icon:'🐷',label:'Catch Pig',     action:(x,y)=>walkThenDo(x,y,()=>catchAnimal(x,y,'pig'))}];
  if(t===T.ANIMAL_COW)     return [{icon:'🐄',label:'Approach Cow',  action:(x,y)=>walkThenDo(x,y,()=>catchAnimal(x,y,'cow'))}];
  return [];
}

// Walk adjacent to a tile, then execute action
function walkThenDo(tx,ty,action){
  if(currentActivity){log('Finish what you are doing first.','bad');return;}
  movePlayerToward(tx,ty,action);
}

// Find an enemy entity at (or near) a tile coordinate
function getEnemyAt(tx,ty) {
  return enemies.find(e=> e.state!=='dead' && Math.round(e.x)===tx && Math.round(e.y)===ty);
}

let _ctxMenuOpen = false;
function showInvCtxMenu(e, slotIdx){
  if(_ctxMenuOpen) return;
  _ctxMenuOpen = true;
  const p=state.players[state.activePlayer];
  const item=p.inventory[slotIdx];
  if(!item){ _ctxMenuOpen=false; return; }
  const it=ITEMS[item.id];
  ctxMenu.innerHTML=`<div class="ctx-title">${it.icon} ${it.name}</div>`;
  const actions=getItemActions(item.id);
  actions.forEach(a=>{
    const d=document.createElement('div');
    d.className='ctx-item'+(a.danger?' danger':'');
    d.innerHTML=`<span class="ctx-icon">${a.icon}</span>${a.label}`;
    d.onclick=()=>{ hideCtxMenu(); a.action(slotIdx); };
    ctxMenu.appendChild(d);
  });
  const dd=document.createElement('div');
  dd.className='ctx-item danger';
  dd.innerHTML='<span class="ctx-icon">🗑</span>Drop';
  dd.onclick=()=>{ hideCtxMenu(); p.inventory[slotIdx]=null; buildInventory(); buildEquipPanel(); log(`Dropped ${it.name}.`); };
  ctxMenu.appendChild(dd);
  ctxMenu.style.left=e.clientX+'px';
  ctxMenu.style.top=e.clientY+'px';
  ctxMenu.classList.add('show');
}
function hideCtxMenu(){
  ctxMenu.classList.remove('show');
  _ctxMenuOpen = false;
}
document.addEventListener('click',()=>hideCtxMenu());

