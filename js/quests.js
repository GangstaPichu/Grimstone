// ======= QUEST REGISTRY =======
// Each quest: { id, icon, title, giver, desc, detail, reward, rewardFn,
//               isVisible(qf), isComplete(qf) }
const QUESTS = [
  {
    id: 'the_hooded_figure',
    icon: '🗝',
    title: 'The Hooded Figure',
    giver: 'Unknown — found by investigation',
    desc: 'A cloaked figure has been seen at the south docks on Grimtide near midnight. Nobody knows who — or what — they are.',
    detail: 'Rumours point to the docks on Grimtide, just before midnight. Corporal Vayne has logged the incident. Others have left notes. Find the figure and learn what they want.',
    reward: 'The Ashen Key',
    rewardFn: null, // given by mystery NPC directly
    isVisible: (qf) => qf.clue_noticeboard_town || qf.clue_guard_logbook || qf.clue_noticeboard_inn || qf.clue_inn_journal || qf.clue_chest_note || qf.mystery_met || qf.clue_chapel_rune || qf.clue_chapel_altar,
    isComplete: (qf) => qf.mystery_key_given,
  },
  {
    id: 'miras_locket',
    icon: '📿',
    title: "Mira's Lost Locket",
    giver: 'Mira — The Tarnished Flagon',
    desc: 'Mira has lost a silver locket somewhere near the docks. She\'s been searching for days and is offering a reward for its return.',
    detail: 'Mira mentioned losing a silver locket near the south docks. It might still be there, or someone may have picked it up. Ask around — Rowan keeps odd hours near the waterfront.',
    reward: '15 gold + Mira\'s thanks',
    rewardFn: null, // reward given directly in npcs.js when returned to Mira
    isVisible: (qf) => true, // always visible — heard from Mira or town rumour
    isComplete: (qf) => qf.miras_locket_done || false,
  },
  {
    id: 'the_ashen_seal',
    icon: '🔴',
    title: 'The Ashen Seal',
    giver: 'Aldermast — The Aetheric Spire',
    desc: 'The wizard Aldermast believes the Cultist Catacombs hold a ritual seal that could be used to rebind whatever they were trying to summon. He needs you to bring it back.',
    detail: 'Aldermast has tasked you with retrieving the Ashen Seal from the Cultist Catacombs beneath the Forsaken Chapel. He warns it will be heavily guarded — and that you should not touch the altar.',
    reward: 'Ring of Warding',
    rewardFn: (p) => { addToInventory('ring_of_warding'); buildInventory(); buildEquipPanel(); },
    isVisible: (qf) => qf.ashen_seal_accepted,
    isComplete: (qf) => qf.ashen_seal_returned,
  },
  {
    id: 'the_starless_constellation',
    icon: '⭐',
    title: 'The Starless Constellation',
    giver: 'Aldermast — The Aetheric Spire',
    desc: 'Aldermast has been tracking the Shadow Walker surges through the night sky — but four of the key stars have gone dark. He believes Void Shards fell with them, scattered across the most dangerous corners of the realm.',
    detail: 'Find four Void Shards hidden in dungeon chests across the realm. Aldermast says they will feel cold and wrong — you will know them when you see them. Only a warrior seasoned enough to survive the depths will stand a chance.',
    reward: 'Amulet of Stars',
    rewardFn: (p) => { addToInventory('amulet_of_stars'); buildInventory(); buildEquipPanel(); },
    isVisible: (qf) => qf.constellation_accepted,
    isComplete: (qf) => qf.constellation_done,
  },
  {
    id: 'missing_caravan',
    icon: '🪙',
    title: 'The Missing Caravan',
    giver: 'Oswin — The Tarnished Flagon',
    desc: 'Oswin has been waiting three days for a caravan from the west that never arrived. Something may have happened on the road.',
    detail: 'Oswin\'s caravan was due three days ago from the western pass. The road through the Ashen Moor has been dangerous lately. Someone should investigate — or at least bring back word of what happened.',
    reward: '25 gold',
    rewardFn: (p) => { bankAddCoins(p, 25); },
    isVisible: (qf) => true,
    isComplete: (qf) => qf.missing_caravan_done || false,
  },
  {
    id: 'a_place_to_call_home',
    icon: '🏡',
    title: 'A Place to Call Home',
    giver: 'Old Bertram — Greenfield Pastures',
    desc: 'Old Bertram, a retired farmer at Greenfield Pastures, wants to pass on his homestead sigil. Bring him three wheat to prove you know how to grow something.',
    detail: 'Find Old Bertram outside the barn at Greenfield Pastures. He\'ll give you the Homestead Sigil if you bring him three stalks of wheat. Wheat grows wild in the fields, or you can plant wheat seeds and harvest them.',
    reward: 'Homestead Sigil — teleports you to your personal homestead',
    rewardFn: null,
    isVisible: (qf) => qf.bertram_met,
    isComplete: (qf) => qf.homestead_rewarded,
  },
  {
    id: 'the_fractured_grimoire',
    icon: '📜',
    title: 'The Fractured Grimoire',
    giver: 'Aldermast — Aetheric Spire',
    desc: 'Aldermast\'s ancient grimoire was torn apart by cultists during the siege. Three fragments are scattered across the dungeons.',
    detail: 'Search chests in the Ashwood Crypts, Iron Depths, and Cultist Catacombs for the three torn pages. Return all three to Aldermast to restore his life\'s work — and unlock the secrets of the Void Rune.',
    reward: 'Staff of Aldermast + Void Rune recipe',
    rewardFn: null,
    isVisible: (qf) => qf.grimoire_accepted,
    isComplete: (qf) => qf.grimoire_done,
  },
  {
    id: 'old_bones_new_debts',
    icon: '📋',
    title: 'Old Bones, New Debts',
    giver: 'Old Bertram — Greenfield Pastures',
    desc: "Bertram's grandson has been handed a debt notice by Dorin the Trader. The numbers don't add up. Someone needs to take a closer look at Dorin's books.",
    detail: "Old Bertram suspects the debt his grandson owes Dorin is fabricated. Dorin's Trading Post closes at night — but Bertram says Dorin has a habit of leaving the back unlocked. Slip in after dark, find the ledger, and bring proof to Corporal Vayne or Guard Edwyn.",
    reward: 'Homestead Extension Deed + Bertram discount on seeds',
    rewardFn: null, // handled in guard dialogue
    isVisible: (qf) => qf.homestead_rewarded && !qf.old_bones_done,
    isComplete: (qf) => qf.old_bones_done || false,
  },
];

let questBoardTab = 'active';
let questBoardSelected = null;

function openQuestBoard() {
  questBoardSelected = null;
  questBoardTab = 'active';
  document.getElementById('quest-detail').classList.remove('show');
  document.getElementById('quest-detail').textContent = '';
  document.getElementById('quest-close').onclick  = closeQuestBoard;
  document.getElementById('quest-close2').onclick = closeQuestBoard;
  renderQuestBoard();
  document.getElementById('quest-panel').classList.add('show');
  if(!questFlags.clue_noticeboard_town) {
    questFlags.clue_noticeboard_town = true;
  }
}

function closeQuestBoard() {
  document.getElementById('quest-panel').classList.remove('show');
}

function switchQuestTab(tab) {
  questBoardTab = tab;
  questBoardSelected = null;
  document.getElementById('quest-detail').classList.remove('show');
  ['active','complete','all'].forEach(t => {
    document.getElementById('qtab-'+t).classList.toggle('active', t===tab);
  });
  renderQuestBoard();
}

function renderQuestBoard() {
  const list = document.getElementById('quest-list');
  list.innerHTML = '';
  const visibleQuests = QUESTS.filter(q => q.isVisible(questFlags));
  let filtered;
  if(questBoardTab === 'active')   filtered = visibleQuests.filter(q => !q.isComplete(questFlags));
  else if(questBoardTab === 'complete') filtered = visibleQuests.filter(q => q.isComplete(questFlags));
  else filtered = visibleQuests;

  if(filtered.length === 0) {
    list.innerHTML = '<div class="shop-empty">No entries found.</div>';
    return;
  }

  filtered.forEach(q => {
    const complete = q.isComplete(questFlags);
    const card = document.createElement('div');
    card.className = 'quest-card' + (questBoardSelected === q.id ? ' selected' : '');
    const statusLabel = complete ? 'COMPLETE' : 'ACTIVE';
    const statusClass = complete ? 'complete' : 'active';
    card.innerHTML = `
      <div class="quest-card-top">
        <div class="quest-card-icon">${q.icon}</div>
        <div class="quest-card-name">${q.title}</div>
        <div class="quest-status-pip ${statusClass}">${statusLabel}</div>
      </div>
      <div class="quest-card-desc">${q.desc}</div>
      <div class="quest-card-footer">
        <div class="quest-card-giver">📌 ${q.giver}</div>
        <div class="quest-card-reward">⚜ ${q.reward}</div>
      </div>`;
    card.onclick = () => {
      questBoardSelected = q.id;
      const detail = document.getElementById('quest-detail');
      detail.textContent = q.detail;
      detail.classList.add('show');
      // re-render to update selected highlight
      renderQuestBoard();
      detail.scrollIntoView({behavior:'smooth', block:'nearest'});
    };
    list.appendChild(card);
  });
}

let npcs = [];

function spawnNpcsFromMap() {
  npcs = [];
  if(!currentMap) return;
  const {tiles, W, H} = currentMap;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    const t = tiles[y][x];
    if(!NPC_DEFS[t]) continue;
    // Clone def so we don't mutate the shared object
    const def = Object.assign({}, NPC_DEFS[t]);
    // Apply named NPC override if this position has one
    const isFarm  = currentMap && currentMap.name === 'GREENFIELD PASTURES';
    const isForge = currentMap && currentMap.name === 'THE ASHEN FORGE';
    const isBank  = currentMap && currentMap.name === 'GRIMSTONE SAVINGS BANK';
    const isShop  = currentMap && currentMap.name === "DORIN'S TRADING POST";
    const prefix  = currentMap.isInterior && currentMap.name && currentMap.name.includes('FLAGON') ? 'inn:'
                  : isForge ? 'forge:'
                  : isFarm  ? 'farm:'
                  : isBank  ? 'bank:'
                  : isShop  ? 'shop:' : '';
    const key = `${prefix}${y},${x}`;
    const named = NAMED_NPCS[key];
    if(named) {
      def.name   = named.title || named.name;
      def.letter = named.letter;
      def.col    = named.col;
    }
    // House positions for named Ashenveil villagers
    const VILLAGER_HOUSES = {
      'Mira':    {dx:33,dy:4},
      'Aldric':  {dx:40,dy:4},
      'Elspeth': {dx:3, dy:28},
      'Rowan':   {dx:11,dy:28},
    };
    // NPCs that occasionally visit the inn (approach tile y=9,x=8)
    const INN_GOERS = new Set(['Vayne','Dorin','Aldric','Elspeth']);
    const npcName = named ? named.name : null;
    const housePos = npcName ? VILLAGER_HOUSES[npcName] : null;
    const isInnGoer = npcName ? INN_GOERS.has(npcName) : false;
    npcs.push({
      def,
      typeId: t,
      npcName,
      gender:  named ? named.gender : null,
      x, y, homeX:x, homeY:y,
      rx:x, ry:y,
      patrolX:x, patrolY:y,
      patrolTimer: Math.random()*4,
      moveTimer: 0,
      pauseTimer: 0,
      // House-going
      houseX: housePos ? housePos.dx : null,
      houseY: housePos ? housePos.dy : null,
      inHouse: false,
      houseTimer: 30 + Math.random()*60,
      // Inn-going
      isInnGoer,
      atInn: false,
      innTimer: 45 + Math.random()*90, // first inn check in 45-135s
    });
    tiles[y][x] = T.COBBLE;
  }
}

function npcCanMove(tx, ty) {
  if(!currentMap) return false;
  const {tiles,W,H} = currentMap;
  if(tx<1||tx>=W-1||ty<1||ty>=H-1) return false;
  const t = tiles[ty][tx];
  if(SOLID_TILES.has(t)||t===T.WATER||t===T.WALL) return false;
  // NPCs must never step onto door/portal tiles — they'd vanish or get stuck
  if(t===T.INN_DOOR||t===T.EXIT_INTERIOR||t===T.EXIT||t===T.EXIT_RETURN||t===T.CHAPEL_PORTAL) return false;
  // Don't overlap player or other NPCs
  if(playerPos.x===tx&&playerPos.y===ty) return false;
  if(npcs.some(n=>Math.round(n.x)===tx&&Math.round(n.y)===ty)) return false;
  return true;
}

let lastNpcTick = 0;
function tickNpcs(now) {
  if(!currentMap||!npcs.length) return;
  const dt = Math.min(0.1,(now-lastNpcTick)/1000);
  lastNpcTick = now;

  // Check if any UI that locks NPCs is open
  const dialogueOpen = document.getElementById('dialogue-panel').classList.contains('show');
  const shopOpen     = document.getElementById('shop-panel').classList.contains('show');

  for(const n of npcs) {
    // Always run smooth render lerp so there's no snapping
    n.rx += (n.x-n.rx)*Math.min(1,dt*10);
    n.ry += (n.y-n.ry)*Math.min(1,dt*10);

    // Freeze the NPC being talked to, or all NPCs while shop is open
    if(shopOpen) continue;
    if(dialogueOpen && n === dialogueNpc) continue;

    // Idle pause
    if(n.pauseTimer>0){ n.pauseTimer-=dt; continue; }

    // House-going behaviour for named villagers with assigned houses
    if(n.houseX !== null && n.houseY !== null && currentMap && currentMap.name === 'ASHENVEIL') {
      n.houseTimer -= dt;
      if(n.houseTimer <= 0) {
        n.houseTimer = 60 + Math.random()*120; // next check in 1-3 min
        const night = getNightAlpha() > 0.5;
        const goHome = night ? Math.random() < 0.75 : Math.random() < 0.15; // much more likely at night
        if(goHome && !n.inHouse) {
          // Walk toward house door approach tile
          n.patrolX = n.houseX;
          n.patrolY = n.houseY;
          n.patrolTimer = 20; // hold this target for a while
          // When they arrive at their door approach tile, "disappear" into house
          const dx = Math.abs(Math.round(n.x) - n.houseX);
          const dy = Math.abs(Math.round(n.y) - n.houseY);
          if(dx <= 1 && dy <= 1) {
            n.inHouse = true;
            n.houseTimer = (night ? 180 : 60) + Math.random()*120; // stay home a while
          }
        } else if(n.inHouse) {
          // Come back out after timer
          n.inHouse = false;
          n.patrolX = n.homeX; n.patrolY = n.homeY;
          n.patrolTimer = 5;
        }
      }
      // While inHouse, hide NPC (skip render by teleporting off-screen temporarily)
      if(n.inHouse) {
        n.x = -999; n.y = -999; n.rx = -999; n.ry = -999;
        continue;
      }
    }

    // Inn-going behaviour for designated NPCs
    if(n.isInnGoer && currentMap && currentMap.name === 'ASHENVEIL' && !n.inHouse) {
      n.innTimer -= dt;
      if(n.innTimer <= 0) {
        n.innTimer = 90 + Math.random()*180; // check every 1.5-4.5 min
        const evening = getNightAlpha() > 0.2; // goes to inn as night falls or evening
        const goInn = evening ? Math.random() < 0.45 : Math.random() < 0.10;
        if(goInn && !n.atInn) {
          // Walk toward inn approach tile (y=9, x=8)
          n.patrolX = 8;
          n.patrolY = 9;
          n.patrolTimer = 25;
          // If they're close enough, disappear inside
          if(Math.abs(Math.round(n.x)-8)<=1 && Math.abs(Math.round(n.y)-9)<=1) {
            n.atInn = true;
            n.innTimer = 120 + Math.random()*240; // stay at inn 2-6 min
            const innLogs = {
              'Vayne':   'Corporal Vayne heads into the Tarnished Flagon for a drink.',
              'Dorin':   'Dorin slips into the inn — probably drumming up trade.',
              'Aldric':  'Aldric ducks into the inn, rubbing his bad leg.',
              'Elspeth': "Elspeth heads to the inn. She looks like she needs a rest.",
            };
            if(innLogs[n.npcName]) setTimeout(()=>log(innLogs[n.npcName],'neutral'),400);
          }
        } else if(n.atInn) {
          n.atInn = false;
          n.patrolX = n.homeX; n.patrolY = n.homeY;
          n.patrolTimer = 5;
        }
      }
      if(n.atInn) {
        n.x = -999; n.y = -999; n.rx = -999; n.ry = -999;
        continue;
      }
    }

    // Pick new patrol target — clamped strictly within patrolRadius of home
    n.patrolTimer-=dt;
    if(n.patrolTimer<=0){
      const angle=Math.random()*Math.PI*2;
      const r=Math.random()*n.def.patrolRadius;
      n.patrolX=Math.round(n.homeX+Math.cos(angle)*r);
      n.patrolY=Math.round(n.homeY+Math.sin(angle)*r);
      // Hard-clamp: never let target exceed patrolRadius from home
      const ddx=n.patrolX-n.homeX, ddy=n.patrolY-n.homeY;
      const dist=Math.sqrt(ddx*ddx+ddy*ddy);
      if(dist>n.def.patrolRadius){
        n.patrolX=Math.round(n.homeX+ddx/dist*n.def.patrolRadius);
        n.patrolY=Math.round(n.homeY+ddy/dist*n.def.patrolRadius);
      }
      n.patrolTimer=3+Math.random()*5;
      n.pauseTimer=0.5+Math.random()*1.5; // pause before moving
    }

    // Move toward patrol target
    const dx=n.patrolX-n.x, dy=n.patrolY-n.y;
    if(Math.abs(dx)<0.5&&Math.abs(dy)<0.5) continue;

    n.moveTimer-=dt;
    if(n.moveTimer<=0){
      // Try to step toward target
      const steps=Math.abs(dx)>=Math.abs(dy)
        ? [[Math.sign(dx),0],[0,Math.sign(dy)]]
        : [[0,Math.sign(dy)],[Math.sign(dx),0]];
      for(const[sx,sy] of steps){
        const nx=Math.round(n.x)+sx, ny=Math.round(n.y)+sy;
        if(npcCanMove(nx,ny)){ n.x=nx; n.y=ny; break; }
      }
      n.moveTimer=1/n.def.speed*(0.8+Math.random()*0.4);
    }
  }
}

function drawNpcs() {
  const allNpcs = mysteryNpc ? [...npcs, mysteryNpc] : npcs;
  for(const n of allNpcs) {
    const px=n.rx*TILE, py=n.ry*TILE;
    const cx=px+TILE/2, cy=py+TILE/2;
    ctx2.save();
    if(n.isMystery) {
      const flicker = 0.7 + 0.15 * Math.sin(Date.now() * 0.003);
      if(n.isMarket) {
        // Hooded Trader — cloaked with amber/gold trim and coin glint
        const tradeFlicker = 0.75 + 0.12 * Math.sin(Date.now() * 0.004);
        // Cloak body
        ctx2.fillStyle=`rgba(18,10,5,${tradeFlicker})`;
        ctx2.beginPath(); ctx2.arc(cx,cy,TILE*.32,0,Math.PI*2); ctx2.fill();
        ctx2.strokeStyle=`rgba(180,130,30,${tradeFlicker})`; ctx2.lineWidth=1.8; ctx2.stroke();
        // Hood
        ctx2.fillStyle=`rgba(10,5,0,0.8)`;
        ctx2.beginPath(); ctx2.arc(cx,cy-3,TILE*.18,0,Math.PI*2); ctx2.fill();
        // Amber eyes (less menacing than red)
        const eyeGlow = 0.55 + 0.25*Math.sin(Date.now()*0.006);
        ctx2.fillStyle=`rgba(200,140,20,${eyeGlow})`;
        ctx2.beginPath(); ctx2.arc(cx-4,cy-2,2,0,Math.PI*2); ctx2.fill();
        ctx2.beginPath(); ctx2.arc(cx+4,cy-2,2,0,Math.PI*2); ctx2.fill();
        // Gold coin glint accent
        const glint = 0.4 + 0.4*Math.abs(Math.sin(Date.now()*0.002));
        ctx2.fillStyle=`rgba(220,170,40,${glint})`;
        ctx2.beginPath(); ctx2.arc(cx+8,cy+6,2.5,0,Math.PI*2); ctx2.fill();
        // Letter H
        ctx2.fillStyle=`rgba(200,150,40,${tradeFlicker})`;
        ctx2.font='bold 10px Cinzel,serif';
        ctx2.textAlign='center'; ctx2.textBaseline='middle';
        ctx2.fillText('H',cx,cy+4);
      } else {
      // Hooded figure — dark cloaked silhouette with eerie flicker
      // Shroud / cloak
      ctx2.fillStyle=`rgba(15,8,8,${flicker})`;
      ctx2.beginPath(); ctx2.arc(cx,cy,TILE*.32,0,Math.PI*2); ctx2.fill();
      ctx2.strokeStyle=`rgba(90,60,40,${flicker})`; ctx2.lineWidth=1.5; ctx2.stroke();
      // Hood shadow
      ctx2.fillStyle=`rgba(0,0,0,0.7)`;
      ctx2.beginPath(); ctx2.arc(cx,cy-3,TILE*.18,0,Math.PI*2); ctx2.fill();
      // Glowing eyes
      const eyeGlow = 0.6 + 0.3*Math.sin(Date.now()*0.007);
      ctx2.fillStyle=`rgba(200,80,30,${eyeGlow})`;
      ctx2.beginPath(); ctx2.arc(cx-4,cy-2,2,0,Math.PI*2); ctx2.fill();
      ctx2.beginPath(); ctx2.arc(cx+4,cy-2,2,0,Math.PI*2); ctx2.fill();
      // Question mark
      ctx2.fillStyle=`rgba(138,112,96,${flicker})`;
      ctx2.font='bold 10px Cinzel,serif';
      ctx2.textAlign='center'; ctx2.textBaseline='middle';
      ctx2.fillText('?',cx,cy+4);
      }
    } else if(n.def.isAnimal) {
      // ── Animal pixel-art rendering ──────────────────────────────
      const bob = Math.sin(Date.now() * 0.002 + n.x * 1.3) * 1.2;
      if(n.typeId === T.ANIMAL_CHICKEN) {
        // Body
        ctx2.fillStyle='#f0e8c0';
        ctx2.beginPath(); ctx2.ellipse(cx, cy+2+bob, 7, 6, 0, 0, Math.PI*2); ctx2.fill();
        // Head
        ctx2.fillStyle='#f5f0d0';
        ctx2.beginPath(); ctx2.ellipse(cx+5, cy-4+bob, 5, 4, 0.3, 0, Math.PI*2); ctx2.fill();
        // Beak
        ctx2.fillStyle='#e08820';
        ctx2.beginPath(); ctx2.moveTo(cx+9, cy-4+bob); ctx2.lineTo(cx+12, cy-3+bob); ctx2.lineTo(cx+9, cy-2+bob); ctx2.fill();
        // Comb
        ctx2.fillStyle='#d03030';
        ctx2.beginPath(); ctx2.ellipse(cx+5, cy-8+bob, 2, 3, 0, 0, Math.PI*2); ctx2.fill();
        // Eye
        ctx2.fillStyle='#1a1a1a';
        ctx2.beginPath(); ctx2.arc(cx+7, cy-5+bob, 1.2, 0, Math.PI*2); ctx2.fill();
        // Wings hint
        ctx2.fillStyle='rgba(200,190,160,0.7)';
        ctx2.beginPath(); ctx2.ellipse(cx-2, cy+2+bob, 5, 3, -0.3, 0, Math.PI*2); ctx2.fill();
        // Legs
        ctx2.strokeStyle='#e09030'; ctx2.lineWidth=1.5;
        ctx2.beginPath(); ctx2.moveTo(cx-2, cy+7+bob); ctx2.lineTo(cx-2, cy+13); ctx2.stroke();
        ctx2.beginPath(); ctx2.moveTo(cx+2, cy+7+bob); ctx2.lineTo(cx+2, cy+13); ctx2.stroke();
      } else if(n.typeId === T.ANIMAL_PIG) {
        // Body
        ctx2.fillStyle='#f0a8b0';
        ctx2.beginPath(); ctx2.ellipse(cx, cy+2+bob, 10, 8, 0, 0, Math.PI*2); ctx2.fill();
        // Head
        ctx2.fillStyle='#f8b8c0';
        ctx2.beginPath(); ctx2.ellipse(cx+8, cy-1+bob, 7, 6, 0.2, 0, Math.PI*2); ctx2.fill();
        // Snout
        ctx2.fillStyle='#e89090';
        ctx2.beginPath(); ctx2.ellipse(cx+14, cy+1+bob, 4, 3, 0, 0, Math.PI*2); ctx2.fill();
        ctx2.fillStyle='#c06060'; // nostrils
        ctx2.beginPath(); ctx2.arc(cx+13, cy+bob, 1, 0, Math.PI*2); ctx2.fill();
        ctx2.beginPath(); ctx2.arc(cx+15, cy+bob, 1, 0, Math.PI*2); ctx2.fill();
        // Eye
        ctx2.fillStyle='#1a1a1a';
        ctx2.beginPath(); ctx2.arc(cx+10, cy-2+bob, 1.5, 0, Math.PI*2); ctx2.fill();
        // Ear
        ctx2.fillStyle='#e090a0';
        ctx2.beginPath(); ctx2.ellipse(cx+8, cy-7+bob, 3, 4, -0.3, 0, Math.PI*2); ctx2.fill();
        // Curly tail
        ctx2.strokeStyle='#e090a0'; ctx2.lineWidth=1.5;
        ctx2.beginPath(); ctx2.arc(cx-9, cy+bob, 3, 0, Math.PI*1.5); ctx2.stroke();
        // Legs
        ctx2.fillStyle='#e090a0';
        [[-6,7],[-2,7],[2,7],[6,7]].forEach(([lx,ly])=>{
          ctx2.fillRect(cx+lx-1.5, cy+ly+bob, 3, 6);
        });
      } else if(n.typeId === T.ANIMAL_COW) {
        // Body — large
        ctx2.fillStyle='#e8e0d0';
        ctx2.beginPath(); ctx2.ellipse(cx-2, cy+2+bob, 13, 9, 0, 0, Math.PI*2); ctx2.fill();
        // Brown patches
        ctx2.fillStyle='#8b5e3c';
        ctx2.beginPath(); ctx2.ellipse(cx+4, cy+bob, 5, 4, 0.5, 0, Math.PI*2); ctx2.fill();
        ctx2.beginPath(); ctx2.ellipse(cx-7, cy+4+bob, 4, 3, -0.3, 0, Math.PI*2); ctx2.fill();
        // Head
        ctx2.fillStyle='#ede5d5';
        ctx2.beginPath(); ctx2.ellipse(cx+11, cy-1+bob, 7, 6, 0.1, 0, Math.PI*2); ctx2.fill();
        // Muzzle
        ctx2.fillStyle='#d4b898';
        ctx2.beginPath(); ctx2.ellipse(cx+16, cy+2+bob, 4, 3, 0, 0, Math.PI*2); ctx2.fill();
        ctx2.fillStyle='#b08060'; // nostrils
        ctx2.beginPath(); ctx2.arc(cx+15, cy+1+bob, 1, 0, Math.PI*2); ctx2.fill();
        ctx2.beginPath(); ctx2.arc(cx+17, cy+1+bob, 1, 0, Math.PI*2); ctx2.fill();
        // Eye
        ctx2.fillStyle='#1a1a1a';
        ctx2.beginPath(); ctx2.arc(cx+12, cy-2+bob, 1.8, 0, Math.PI*2); ctx2.fill();
        // Horns
        ctx2.strokeStyle='#c8a050'; ctx2.lineWidth=2;
        ctx2.beginPath(); ctx2.moveTo(cx+9, cy-6+bob); ctx2.quadraticCurveTo(cx+8, cy-12+bob, cx+12, cy-10+bob); ctx2.stroke();
        // Ears
        ctx2.fillStyle='#e0d0b8';
        ctx2.beginPath(); ctx2.ellipse(cx+9, cy-6+bob, 3, 4, -0.6, 0, Math.PI*2); ctx2.fill();
        // Legs
        ctx2.fillStyle='#ddd5c5';
        [[-8,8],[-4,8],[2,8],[6,8]].forEach(([lx,ly])=>{
          ctx2.fillRect(cx+lx-2, cy+ly+bob, 4, 8);
          ctx2.fillStyle='#8b5e3c'; ctx2.fillRect(cx+lx-2, cy+ly+bob+6, 4, 2); // hooves
          ctx2.fillStyle='#ddd5c5';
        });
        // Udder
        ctx2.fillStyle='#f0c0c0';
        ctx2.beginPath(); ctx2.ellipse(cx-1, cy+11+bob, 5, 3, 0, 0, Math.PI*2); ctx2.fill();
      }
      // Shadow under all animals
      ctx2.fillStyle='rgba(0,0,0,0.18)';
      ctx2.beginPath(); ctx2.ellipse(cx, cy+TILE*.38, TILE*.28, TILE*.08, 0, 0, Math.PI*2); ctx2.fill();
    } else {
      // Shadow
      ctx2.fillStyle='rgba(0,0,0,0.3)';
      ctx2.beginPath(); ctx2.ellipse(cx,cy+TILE*.33,TILE*.2,TILE*.08,0,0,Math.PI*2); ctx2.fill();
      // Body — slightly smaller than enemies, friendlier tone
      ctx2.fillStyle=n.def.bg;
      ctx2.beginPath(); ctx2.arc(cx,cy,TILE*.28,0,Math.PI*2); ctx2.fill();
      ctx2.strokeStyle=n.def.col; ctx2.lineWidth=1.5; ctx2.stroke();
      // Letter
      ctx2.fillStyle=n.def.col;
      ctx2.font='bold 11px Cinzel,serif';
      ctx2.textAlign='center'; ctx2.textBaseline='middle';
      ctx2.fillText(n.def.letter,cx,cy);
    }
    ctx2.restore();
  }
}

function getNpcAt(tx,ty){
  const m = getMysteryNpcAt(tx,ty);
  if(m) return m;
  return npcs.find(n=>Math.round(n.x)===tx&&Math.round(n.y)===ty);
}

// Tiles that block spawn placement (used during world gen before runtime SOLID_TILES is defined)
const SOLID_TILES_GEN = new Set([
  10,11,12,13,14,  // ores: copper,iron,gold,mithril,coal
  20,21,22,        // trees: oak,willow,normal
  50,51,52,        // buildings: smelter,fire,shop
  60,              // wall
  81,82,83,84,     // town: inn,blacksmith,well,lamppost
  110,111,         // furniture: table,barrel
  120,121,122,123,124, // decorations: bed,bookshelf,candle,chest,noticeboard
  130,             // workbench
]);

// Find nearest walkable non-water tile to a preferred position
function findSafeSpawn(preferX, preferY) {
  const {tiles, W, H} = currentMap;
  // Spiral outward from preferred position
  for(let r=0; r<12; r++) {
    for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++) {
      if(Math.abs(dx)!==r && Math.abs(dy)!==r) continue; // only shell
      const x=preferX+dx, y=preferY+dy;
      if(x<1||x>=W-1||y<1||y>=H-1) continue;
      const t=tiles[y][x];
      if(t!==T.WATER && !SOLID_TILES_GEN.has(t) && t!==T.WALL) return {x,y};
    }
  }
  return {x:preferX, y:preferY}; // fallback
}

function makeZoneMap(z) {
  groundBags = []; // clear dropped bags when changing zones
  if(z===0) return makeAshenveil();
  // Existing zones shifted: z=1→Ashwood Vale, z=2→Iron Peaks, etc.
  const W=MAP_W, H=MAP_H;
  const cfg = ZONE_CONFIGS[z-1] || ZONE_CONFIGS[0];
  const seed = worldSeed + z * 7919;
  const rng = makePRNG(seed);

  // Fill base
  const tiles = Array.from({length:H}, () => Array(W).fill(cfg.baseTile));

  // Hard border
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    if(y===0||y===H-1||x===0||x===W-1) tiles[y][x]=cfg.borderTile;
  }

  // Alt-biome patches using fractal noise
  const biomeNoise = makeFractalNoise(seed+111, W, H, 3);
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++) {
    if(biomeNoise(x,y) > (1-cfg.altBiomeChance)) tiles[y][x]=cfg.altTile;
  }

  // Water generation using noise + cellular automata
  const waterNoise = makeFractalNoise(seed+333, W, H, 4);
  const waterThreshold = 1 - cfg.waterChance;
  // Seed water
  for(let y=2;y<H-2;y++) for(let x=2;x<W-2;x++) {
    if(waterNoise(x,y) > waterThreshold && tiles[y][x]!==cfg.borderTile) {
      tiles[y][x] = T.WATER;
    }
  }
  // Smooth into blobs
  smoothTerrain(tiles, W, H, T.WATER, 3);
  // Remove tiny isolated water cells
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++) {
    if(tiles[y][x]===T.WATER) {
      let adj=0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(tiles[y+dy][x+dx]===T.WATER) adj++;
      if(adj<=1) tiles[y][x]=cfg.baseTile;
    }
  }

  // Place fishing spots on water edges
  let fishPlaced=0;
  for(let y=2;y<H-2&&fishPlaced<cfg.fishSpots;y++) for(let x=2;x<W-2&&fishPlaced<cfg.fishSpots;x++) {
    if(tiles[y][x]!==T.WATER) continue;
    // Check for land adjacency
    const dirs=[[-1,0],[1,0],[0,-1],[0,1]];
    let hasLand=false;
    for(const[dy,dx] of dirs) {
      const t=tiles[y+dy][x+dx];
      if(t!==T.WATER&&t!==T.WALL) { hasLand=true; break; }
    }
    if(hasLand && rng()<0.12) {
      tiles[y][x] = z>=2 ? T.FISHING2 : T.FISHING;
      fishPlaced++;
    }
  }

  // Place ore clusters — in rough thirds of the map (left/mid/right)
  cfg.ores.forEach((ore, i) => {
    const cx = Math.floor(W*0.15 + rng()*(W*0.7));
    const cy = Math.floor(H*0.15 + rng()*(H*0.7));
    placeCluster(tiles, W, H, cx, cy, ore.tile, ore.count, 4+rng()*3, rng, true);
    // Secondary cluster for variety
    if(ore.count>8) {
      const cx2 = Math.floor(W*0.2 + rng()*(W*0.6));
      const cy2 = Math.floor(H*0.2 + rng()*(H*0.6));
      placeCluster(tiles, W, H, cx2, cy2, ore.tile, Math.floor(ore.count*0.6), 3+rng()*2, rng, true);
    }
  });

  // Place trees
  cfg.trees.forEach(tree => {
    const numClusters = Math.ceil(tree.count/5);
    for(let c=0;c<numClusters;c++) {
      const cx = Math.floor(2+rng()*(W-4));
      const cy = Math.floor(2+rng()*(H-4));
      placeCluster(tiles, W, H, cx, cy, tree.tile, Math.ceil(tree.count/numClusters), 3+rng()*4, rng, true);
    }
  });

  // Place enemies — scattered across map avoiding resources, water, and portals
  const PORTAL_TILES = new Set([T.EXIT, T.EXIT_RETURN, T.CHAPEL_PORTAL, T.INN_DOOR,
    T.DUNGEON_STAIR_DOWN, T.DUNGEON_STAIR_UP, T.CRYPT_STAIR]);
  const PORTAL_CLEAR = 7;
  cfg.enemies.forEach(en => {
    let placed=0, attempts=0;
    while(placed<en.count && attempts<500) {
      attempts++;
      const x=Math.floor(2+rng()*(W-4)), y=Math.floor(2+rng()*(H-4));
      if(tiles[y][x]!==cfg.baseTile && tiles[y][x]!==cfg.altTile) continue;
      // Don't crowd same enemy type
      let tooClose=false;
      for(const [dy,dx] of [[-2,0],[2,0],[0,-2],[0,2]]) {
        const ny=y+dy,nx=x+dx;
        if(ny>=0&&ny<H&&nx>=0&&nx<W&&tiles[ny][nx]===en.tile){tooClose=true;break;}
      }
      if(tooClose) continue;
      // Don't spawn near portals/exits/entrances
      let nearPortal=false;
      for(let dy=-PORTAL_CLEAR; dy<=PORTAL_CLEAR&&!nearPortal; dy++)
        for(let dx=-PORTAL_CLEAR; dx<=PORTAL_CLEAR&&!nearPortal; dx++) {
          const ny=y+dy, nx=x+dx;
          if(ny>=0&&ny<H&&nx>=0&&nx<W&&PORTAL_TILES.has(tiles[ny][nx])) nearPortal=true;
        }
      if(!nearPortal) { tiles[y][x]=en.tile; placed++; }
    }
  });

  // Find open center area for facilities (smelter, fire)
  const facilityZone = findOpenArea(tiles, W, H, Math.floor(W/2), Math.floor(H/2), rng);
  if(facilityZone) {
    const [fx,fy] = facilityZone;
    tiles[fy][fx] = T.SMELTER;
    if(fx+1<W-1) tiles[fy][fx+1] = T.COOKING_FIRE;
  }

  // Shop in corner area
  if(cfg.hasShop) {
    const sx = W-3, sy = 2;
    tiles[sy][sx] = T.SHOP;
  }

  // Dirt paths connecting key points
  const pathPoints = [[Math.floor(W/2),Math.floor(H/2)]];
  if(facilityZone) pathPoints.push(facilityZone);
  pathPoints.push([4,4],[W-4,H-4],[4,H-4],[W-4,4]);
  for(let p=0;p<cfg.pathCount;p++) {
    const a=pathPoints[p%pathPoints.length];
    const b=pathPoints[(p+1)%pathPoints.length];
    carvePath(tiles,W,H,a[0],a[1],b[0],b[1],rng);
  }
  // Horizontal spine path — runs from spawn (left) to EXIT (right edge)
  const exitY = Math.floor(H/2);
  for(let x=2;x<W-1;x++) {
    if(tiles[exitY][x]===cfg.baseTile||tiles[exitY][x]===cfg.altTile||tiles[exitY][x]===cfg.borderTile)
      tiles[exitY][x]=T.DIRT;
  }
  // EXIT portal at the right edge, on the spine
  // Only if there's a next zone
  if(zoneIndex < ZONES.length - 1) {
    tiles[exitY][W-1] = T.EXIT;
    for(let dx=1;dx<=3;dx++) {
      const ex=W-1-dx, ey=exitY;
      if(ex>=1 && tiles[ey][ex]!==T.EXIT) tiles[ey][ex]=T.DIRT;
    }
  } else {
    // Final zone — no forward exit, just clear the edge
    tiles[exitY][W-1] = T.DIRT;
  }

  // EXIT_RETURN portal at the left edge (always present on zones 1+)
  tiles[exitY][0] = T.EXIT_RETURN;
  // Clear approach path to return portal
  for(let dx=1;dx<=3;dx++) {
    const ex=dx, ey=exitY;
    if(tiles[ey][ex]!==T.EXIT_RETURN) tiles[ey][ex]=T.DIRT;
  }

  // Ensure clear spawn area around (5, spineY) — forcibly remove water/solids
  const spineY = exitY;
  for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) {
    const x=5+dx, y=spineY+dy;
    if(x>=1&&x<W-1&&y>=1&&y<H-1) {
      const t=tiles[y][x];
      if(t===T.WATER||t===T.WALL||SOLID_TILES_GEN.has(t)) tiles[y][x]=cfg.baseTile;
    }
  }

  // Build floor layer (copy of tiles before any decoration overlays would be placed)
  const floor = tiles.map(row => [...row]);

  // ---- DUNGEON ENTRANCE ----
  // Zone 1 (Ashwood Vale) and Zone 2 (Iron Peaks) get a dungeon stair
  if(z===1 || z===2) {
    placeDungeonEntrance(tiles, W, H, rng, T.DUNGEON_STAIR_DOWN);
  }

  return {tiles, floor, W, H};
}

function findOpenArea(tiles, W, H, cx, cy, rng, radius=10) {
  // Spiral search from center for a 2x2 open area
  for(let r=1;r<radius;r++) {
    for(let attempts=0;attempts<16;attempts++) {
      const angle = rng()*Math.PI*2;
      const x = Math.round(cx + Math.cos(angle)*r);
      const y = Math.round(cy + Math.sin(angle)*r);
      if(x<2||x>=W-3||y<2||y>=H-2) continue;
      if(tiles[y][x]===T.GRASS||tiles[y][x]===T.STONE_FLOOR||
         tiles[y][x]===T.DARK_GRASS||tiles[y][x]===T.DUNGEON_FLOOR||tiles[y][x]===T.DIRT) {
        return [x,y];
      }
    }
  }
  return [Math.floor(W/2), Math.floor(H/2)];
}

