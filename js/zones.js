// ======= ASHENVEIL — Hand-crafted starting town =======



// ======= ALDERMAST QUEST DIALOGUE =======
function openWizardDialogue(npc) {
  const p = state.players[state.activePlayer];
  const panel    = document.getElementById('dialogue-panel');
  const portrait = document.getElementById('dialogue-portrait');
  const nameEl   = document.getElementById('dialogue-npc-name');
  const textEl   = document.getElementById('dialogue-text');
  const optionsEl= document.getElementById('dialogue-options');

  portrait.textContent  = '✦';
  portrait.style.background  = '#0d0820';
  portrait.style.color       = '#a060e0';
  portrait.style.borderColor = '#a060e0';
  nameEl.textContent = 'ALDERMAST';

  // Mark first meeting
  if(!questFlags.aldermast_met) {
    questFlags.aldermast_met = true;
    setTimeout(()=>log('✦ You have met Aldermast, the Aetheric Wizard.','gold'),400);
  }

  optionsEl.innerHTML = '';

  function say(text) { textEl.textContent = text; }
  function opt(label, fn) {
    const b = document.createElement('div');
    b.className = 'dlg-option';
    b.textContent = label;
    b.onclick = fn;
    optionsEl.appendChild(b);
  }
  function close() { document.getElementById('dialogue-close').click(); }

  // Helper — average combat level
  const combatAvg = Math.floor((p.skills.Attack.lvl + p.skills.Defence.lvl + p.skills.Strength.lvl) / 3);

  // ---- QUEST 1: The Ashen Seal ----
  if(!questFlags.ashen_seal_accepted) {
    say("Hmm. You actually made it up here. Good. I have been watching the Catacombs from the crystal ball — the cultists have a ritual seal down there. If they complete the binding, whatever they have caged beneath that altar walks free. I need you to bring me the Ashen Seal before that happens.");
    opt("I'll retrieve it.", () => {
      questFlags.ashen_seal_accepted = true;
      say("Good. The seal is deep in the Catacombs — past the first hall, held in a chest the cultists guard jealously. You'll know it by the red glow. Do not attempt to use it yourself. Bring it directly to me.");
      log('✦ Quest accepted: The Ashen Seal','gold');
      optionsEl.innerHTML = '';
      opt('Understood.', close);
    });
    opt("Tell me more about the seal.", () => {
      say("A ritual binder — carved from the same stone as the altar itself. The cultists use it to anchor a summoning. Without the seal the ritual collapses. With it in the wrong hands... well. That is why I need it here, not there.");
    });
    opt("Not right now.", close);
    panel.classList.add('show');
    return;
  }

  if(questFlags.ashen_seal_accepted && !questFlags.ashen_seal_found) {
    say("The Ashen Seal is still in the Catacombs. Find it — it's guarded deep in the dungeon. Look for a chest with a red glow. Don't dawdle.");
    opt("I'm working on it.", close);
    opt("What does it look like again?", () => {
      say("Red. Glowing. About the size of your fist. You will feel the wrongness of it before you see it. The cultists keep it behind their inner sanctum — clear the hall and search the chests.");
    });
    panel.classList.add('show');
    return;
  }

  if(questFlags.ashen_seal_found && !questFlags.ashen_seal_returned) {
    // Check if player actually has it
    const hasSeal = countInInventory('ashen_seal') > 0;
    if(hasSeal) {
      say("You have it. I can feel it from here. Hand it over — quickly, please, before it starts responding to the tower's aetheric field.");
      opt("Here, take it.", () => {
        removeFromInventory('ashen_seal', 1);
        questFlags.ashen_seal_returned = true;
        addToInventory('ring_of_warding');
        buildInventory(); buildEquipPanel(); updateHUD();
        say("Excellent. I'll seal it in the null-vault tonight. As for your reward — this ring has been in my collection for two centuries. The warding runes are my own design. It will serve you better than it does a shelf.");
        log('✦ Quest complete: The Ashen Seal! Received Ring of Warding.','gold');
        optionsEl.innerHTML = '';
        opt('Thank you, Aldermast.', () => {
          // Check if constellation quest is now available
          if(!questFlags.constellation_accepted) {
            say("One more thing — since you've proven yourself. Look up at the sky tonight. Count the stars in the Void Constellation. Four are missing. I believe their shards fell somewhere in the depths of this realm. Find them, and I can build something remarkable.");
            opt('Tell me more.', () => openWizardConstellationOffer(npc));
            opt('Perhaps later.', close);
          } else {
            close();
          }
        });
      });
      opt("Actually, can I hold onto it?", () => {
        say("No. Absolutely not. Bring it here immediately.");
      });
    } else {
      say("Where is the seal? You found it — I could sense it briefly in the crystal — but now I cannot. Did you lose it? Check your belongings carefully.");
      opt("I'll find it again.", close);
    }
    panel.classList.add('show');
    return;
  }

  // ---- POST QUEST 1 / QUEST 2 OFFER ----
  if(questFlags.ashen_seal_returned && !questFlags.constellation_accepted) {
    say("The seal is secured. You've done well. Now — about those missing stars. The Void Constellation has four dark points where there should be light. I believe Void Shards fell into the deepest dungeon chambers across the realm. Bring me all four.");
    opt('Tell me more about the Void Shards.', () => openWizardConstellationOffer(npc));
    opt('Not yet.', close);
    panel.classList.add('show');
    return;
  }

  if(questFlags.constellation_accepted && !questFlags.constellation_done) {
    const found = questFlags.void_shards_found || 0;
    if(found < 4) {
      say(`You have found ${found} of the four Void Shards. Search the deepest chests in every dungeon — the Ashwood Crypts, the Iron Depths, and the Cultist Catacombs. The shards are drawn to darkness.`);
      opt("I'll keep searching.", close);
    } else {
      say("Four shards. I can feel them from here — the constellation hums again. Bring them to me. All four, now.");
      const hasAll = countInInventory('void_shard') >= 4;
      if(hasAll) {
        opt("Here are all four shards.", () => {
          removeFromInventory('void_shard', 4);
          questFlags.constellation_done = true;
          addToInventory('amulet_of_stars');
          buildInventory(); buildEquipPanel(); updateHUD();
          say("Perfect. Watch — yes, there. The four stars are lit again. The Amulet of Stars is yours. I cannot explain what it will do in detail without three hours and a chalkboard. Wear it. You will understand.");
          log('✦ Quest complete: The Starless Constellation! Received Amulet of Stars.','gold');
          optionsEl.innerHTML = '';
          opt('Remarkable.', () => {
            say("Now — while you are here. My Grimoire. The original one — three hundred years of research. The cultists stole it during the siege and tore it into three fragments before I could stop them. The pages are scattered across the dungeons. I need them back. All three.");
            opt("I'll find them.", () => {
              questFlags.grimoire_accepted = true;
              log('✦ Quest accepted: The Fractured Grimoire','gold');
              say("Good. The fragments will be in chests — they are distinctive, you'll know them. The pages glow faintly even after all this time. Find all three and I'll teach you the Void Rune — and give you something else besides.");
              optionsEl.innerHTML = '';
              opt('I will return.', close);
            });
            opt('Perhaps later.', close);
          });
        });
      } else {
        opt("I'm gathering them.", close);
      }
    }
    panel.classList.add('show');
    return;
  }

  // ---- QUEST 3: The Fractured Grimoire ----
  if(questFlags.grimoire_accepted && !questFlags.grimoire_done) {
    const frags = questFlags.tome_fragments_found || 0;
    if(frags < 3) {
      say(`You have found ${frags} of the three Grimoire Fragments. Search dungeon chests across the Ashwood Crypts, Iron Depths, and Cultist Catacombs. The pages still carry a faint aetheric signature — they glow.`);
      opt("I'll keep looking.", close);
      opt("What's in the Grimoire?", () => {
        say("Everything. Three centuries of arcane theory, forty-seven original rune designs, the complete history of the Void Constellation event. And my chicken pie recipe, but that is confidential.");
      });
    } else {
      const has1 = countInInventory('tome_fragment_1') > 0;
      const has2 = countInInventory('tome_fragment_2') > 0;
      const has3 = countInInventory('tome_fragment_3') > 0;
      if(has1 && has2 && has3) {
        say("All three fragments. I can feel the resonance even across the room. Hand them over — carefully.");
        opt("Here, all three.", () => {
          removeFromInventory('tome_fragment_1', 1);
          removeFromInventory('tome_fragment_2', 1);
          removeFromInventory('tome_fragment_3', 1);
          questFlags.grimoire_done = true;
          addToInventory('staff_of_aldermast');
          buildInventory(); buildEquipPanel(); updateHUD();
          say("There. Whole again. Centuries of work, intact. As promised — the Void Rune is now available at the Spell Tome. And this staff has been waiting for someone worthy. It was made to amplify arcane intent. I find myself no longer needing it. You clearly do.");
          log('✦ Quest complete: The Fractured Grimoire! Received Staff of Aldermast.','gold');
          optionsEl.innerHTML = '';
          opt('I am honoured.', close);
        });
      } else {
        say("You have found all three fragments — but I sense you do not have them all on you. Check your inventory. Bring all three at once.");
        opt("I'll check.", close);
      }
    }
    panel.classList.add('show');
    return;
  }

  // All quests done — idle chat
  if(questFlags.grimoire_done) {
    say("The Grimoire is whole again. I have re-inscribed the void rune recipe into it — that knowledge is safe now. Come back if you find anything else. I suspect you will.");
  } else if(questFlags.constellation_done) {
    say("The constellation burns bright again. Whatever is happening below that chapel — the surges will slow, for a time. Though I suspect the calm won't last. Come back if you find anything else interesting.");
  } else {
    say("The tower is quiet today. That usually means something loud is about to happen.");
  }
  opt('Goodbye, Aldermast.', close);

  // Standard lore options always available
  const lore = [
    ["What are Shadow Walkers?", "Impressions. When something vast moved through the Whisperwood — centuries ago — it left residue. The Shadow Walkers are that residue, shaped by the ambient fear of the forest. They are not alive, exactly. But they are not not alive either."],
    ["What happened to the Grimward kings?", "They were warned. I warned them personally, three times, in writing. They built their city on a convergence point — aetheric lines crossing in the wrong configuration. When the cultists started digging beneath the chapel, the end was already written. I left before the last page."],
    ["Tell me about the Void Shards.", questFlags.constellation_accepted ?
      "Crystallised void-energy. They fell when four stars in the Constellation were extinguished — something consumed them. The shards landed in the darkest places in the realm, drawn by resonance. You will feel cold near them." :
      "Remnants of extinguished stars. I've only theorised about them. If one ever fell to the surface, it would be extraordinary. And dangerous."],
    ["Tell me about rune crafting.", questFlags.magic_intro_seen ?
      "Runes are crystallised intent. The Arcane Dust forms the substrate — coal gives the spark, copper ore the vessel. From there the elemental shape depends on what you bind into the dust. The Spell Tome upstairs has the full catalogue. Your Magic level governs what you can attempt without the rune... rebounding." :
      "Rune crafting? A worthy pursuit. Find the Spell Tome in this very tower — it will guide you. Start with Arcane Dust before you attempt anything more ambitious. The tome is upstairs."],
    ["What is magic, really?", "Pattern recognition, at the most fundamental level. The world has a grammar. Magic is learning to speak it. The runes are just mnemonic shortcuts — training wheels for those who haven't memorised the conjugations yet. Give it time."],
  ];
  lore.forEach(([q,a]) => opt(q, ()=>say(a)));
  panel.classList.add('show');
}

function openWizardConstellationOffer(npc) {
  const p = state.players[state.activePlayer];
  const textEl   = document.getElementById('dialogue-text');
  const optionsEl= document.getElementById('dialogue-options');
  const combatAvg = Math.floor((p.skills.Attack.lvl + p.skills.Defence.lvl + p.skills.Strength.lvl) / 3);

  function say(text) { textEl.textContent = text; }
  function opt(label, fn) {
    const b = document.createElement('div');
    b.className = 'dlg-option';
    b.textContent = label;
    b.onclick = fn;
    optionsEl.appendChild(b);
  }
  function close() { document.getElementById('dialogue-close').click(); }

  optionsEl.innerHTML = '';

  if(combatAvg < 30) {
    say(`Four Void Shards, scattered across the deepest dungeon chambers. The things guarding them are not goblins, ${p.name}. You need seasoned combat skills — I'd say an average of level 30 across Attack, Defence, and Strength before I'd send you in. You are currently at ${combatAvg}. Come back when you're ready.`);
    opt("I'll train and return.", close);
    return;
  }

  // Level requirement met
  say("Good — you have the mettle for this. The four Void Shards are hidden in dungeon chests across the realm. The Ashwood Crypts, the Iron Depths, the Cultist Catacombs — and one last shard in the deepest chest of the Stormcrag mountain caves. Each one will feel distinctly cold. Bring all four and I'll forge something you won't find anywhere else.");
  opt("I'll find them.", () => {
    questFlags.constellation_accepted = true;
    log('✦ Quest accepted: The Starless Constellation','gold');
    say("Excellent. Remember — four shards, all of them. Half a constellation is useless to me.");
    optionsEl.innerHTML = '';
    opt('Understood.', close);
  });
  opt("Not yet.", close);
}

// ======= STORMCRAG REACH =======
// Rocky mountain terrain south of the Whisperwood. Lush forest fades into bare stone.
// The Aetheric Spire (Wizard Tower) stands at the map's southern end.
function makeStormcragMap() {
  const W=60, H=50;
  const rng = makePRNG(worldSeed + 77742);
  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.DARK_GRASS));
  const floor  = Array.from({length:H}, ()=>Array(W).fill(T.DARK_GRASS));

  // Hard border
  for(let y=0;y<H;y++) for(let x=0;x<W;x++)
    if(y===0||y===H-1||x===0||x===W-1) tiles[y][x]=T.WALL;

  // Elevation noise: north = forest, south = stone
  const elevNoise = makeFractalNoise(worldSeed+55521, W, H, 4);
  const rockNoise  = makeFractalNoise(worldSeed+33318, W, H, 3);

  for(let y=1;y<H-1;y++) {
    const elevation = y / (H-1); // 0 = north (forest), 1 = south (rocky peak)
    for(let x=1;x<W-1;x++) {
      const n = elevNoise(x,y);
      const rocky = elevation * 0.7 + n * 0.3;
      if(rocky > 0.72) {
        tiles[y][x] = rockNoise(x,y) > 0.5 ? T.STONE_FLOOR : T.WALL; // bare rock / boulders
      } else if(rocky > 0.5) {
        tiles[y][x] = T.DIRT; // transitional scree
      } else if(rocky > 0.35) {
        tiles[y][x] = T.DARK_GRASS; // sparse scrub
      } else {
        // Forest zone — trees
        tiles[y][x] = n > 0.55 ? T.NORMAL_TREE : (n > 0.42 ? T.OAK : T.DARK_GRASS);
      }
    }
  }

  // Smooth water pools only in the northern third
  const waterNoise = makeFractalNoise(worldSeed+11198, W, H, 3);
  for(let y=2;y<Math.floor(H*0.35);y++) for(let x=2;x<W-2;x++)
    if(waterNoise(x,y)>0.80 && tiles[y][x]===T.DARK_GRASS) tiles[y][x]=T.WATER;

  // Carve a guaranteed-connected winding path from north portal (x=18) to tower (x=30)
  // Uses a two-phase approach: wind south while slowly drifting toward towerX
  const towerX = 30, towerY = H-8;
  const startX = 18;
  let cx = startX;
  for(let y=1;y<towerY-4;y++) {
    // Gently bias cx toward towerX so the path always arrives there
    const bias = cx < towerX ? 1 : (cx > towerX ? -1 : 0);
    const drift = Math.floor(rng()*3)-1 + (rng()<0.4 ? bias : 0);
    cx = Math.max(4, Math.min(W-5, cx + drift));
    for(let dx=-1;dx<=1;dx++) {
      const nx=cx+dx;
      if(nx>0&&nx<W-1) tiles[y][nx]=T.DIRT;
    }
  }
  // Final straight connector — walk cx horizontally to towerX, then straight south into clearing
  const connY = towerY-4;
  const step = cx < towerX ? 1 : -1;
  for(let x=cx; x !== towerX; x+=step) {
    if(x>0&&x<W-1) { tiles[connY][x]=T.DIRT; tiles[connY-1][x]=T.DIRT; }
  }
  for(let y=connY; y<towerY+2; y++)
    if(y>0&&y<H-1) tiles[y][towerX]=T.DIRT;

  // Wide clearing in the south for the tower approach
  for(let dy=-5;dy<=4;dy++) for(let dx=-8;dx<=8;dx++) {
    const ny=towerY+dy, nx=towerX+dx;
    if(ny>0&&ny<H-1&&nx>0&&nx<W-1) tiles[ny][nx]=T.STONE_FLOOR;
  }

  // Scatter rubble around the clearing
  for(let att=0;att<40;att++) {
    const rx=towerX-10+Math.floor(rng()*20), ry=towerY-8+Math.floor(rng()*12);
    if(ry>0&&ry<H-1&&rx>0&&rx<W-1&&tiles[ry][rx]===T.STONE_FLOOR)
      tiles[ry][rx]=T.STONE_RUBBLE;
  }

  // Snapshot floor
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) floor[y][x]=tiles[y][x];

  // North return portal at x=18 (aligned with Whisperwood south exit)
  tiles[0][startX]=T.DARK_GRASS;
  placeDecor(tiles,floor,0,startX,T.FOREST_PORTAL);

  // Tower — a rough ring of walls with WIZARD_DOOR at the south face
  // Outer ring
  const tw=9, th=9;
  const tx=towerX-Math.floor(tw/2), ty=towerY-th+2;
  for(let dy=0;dy<th;dy++) for(let dx=0;dx<tw;dx++) {
    const ny=ty+dy, nx=tx+dx;
    if(ny<0||ny>=H||nx<0||nx>=W) continue;
    const isEdge = dy===0||dy===th-1||dx===0||dx===tw-1;
    tiles[ny][nx] = isEdge ? T.WALL : T.STONE_FLOOR;
    floor[ny][nx] = isEdge ? T.WALL : T.STONE_FLOOR;
  }
  // Cracked exterior walls
  [[ty,tx+2],[ty,tx+6],[ty+2,tx],[ty+6,tx],[ty+2,tx+tw-1],[ty+6,tx+tw-1]].forEach(([ny,nx])=>{
    if(ny>0&&ny<H-1&&nx>0&&nx<W-1) tiles[ny][nx]=T.CRACKED_WALL;
  });
  // Tower door — south face, clears a gap and places WIZARD_DOOR
  const doorX=tx+Math.floor(tw/2), doorY=ty+th-1;
  tiles[doorY][doorX]=T.STONE_FLOOR; floor[doorY][doorX]=T.STONE_FLOOR;
  placeDecor(tiles,floor,doorY,doorX,T.WIZARD_DOOR);

  // Scatter gold and mithril ore in the rocky mid/south terrain
  const oreTypes = [
    {tile:T.GOLD_ORE, count:10, minY:Math.floor(H*0.35)},
    {tile:T.MITHRIL,  count:8,  minY:Math.floor(H*0.55)},
  ];
  oreTypes.forEach(({tile:oreTile, count, minY})=>{
    let placed=0;
    for(let att=0;att<400&&placed<count;att++){
      const ox=3+Math.floor(rng()*(W-6)), oy=minY+Math.floor(rng()*(H-minY-8));
      if(tiles[oy][ox]===T.STONE_FLOOR||tiles[oy][ox]===T.DIRT||tiles[oy][ox]===T.DARK_GRASS){
        // Keep away from tower and portals
        const nearTower = Math.abs(ox-towerX)<12 && Math.abs(oy-towerY)<12;
        const nearPortal = oy<6;
        if(!nearTower&&!nearPortal){ tiles[oy][ox]=oreTile; placed++; }
      }
    }
  });

  // Scatter shadow walkers in the rocky mid-section
  let swPlaced=0;
  for(let att=0;att<300&&swPlaced<8;att++) {
    const ex=4+Math.floor(rng()*(W-8)), ey=Math.floor(H*0.25)+Math.floor(rng()*Math.floor(H*0.5));
    if(tiles[ey][ex]!==T.DARK_GRASS&&tiles[ey][ex]!==T.DIRT&&tiles[ey][ex]!==T.STONE_FLOOR) continue;
    const nearPortalOrDoor = (Math.abs(ex-18)<8&&ey<8)||(Math.abs(ex-towerX)<10&&Math.abs(ey-towerY)<10);
    if(!nearPortalOrDoor){ tiles[ey][ex]=T.SHADOW_WALKER; swPlaced++; }
  }

  return {tiles, floor, W, H, name:'STORMCRAG REACH', entryX:18, entryY:2};
}

// ======= WIZARD TOWER INTERIOR =======
function makeWizardTowerInterior() {
  const W=22, H=26;
  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.STONE_FLOOR));
  const floor  = Array.from({length:H}, ()=>Array(W).fill(T.STONE_FLOOR));

  // Outer walls — circular-ish tower footprint (rectangular with chamfered corners)
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    const edge = y===0||y===H-1||x===0||x===W-1;
    const corner = (y<2||y>H-3)&&(x<2||x>W-3);
    tiles[y][x] = (edge||corner) ? T.WALL : T.STONE_FLOOR;
  }
  // Chamfer corners properly
  [[0,0],[0,1],[1,0],[0,W-1],[0,W-2],[1,W-1],
   [H-1,0],[H-1,1],[H-2,0],[H-1,W-1],[H-1,W-2],[H-2,W-1]
  ].forEach(([y,x])=>tiles[y][x]=T.WALL);

  // Entry zone (south) — a small vestibule
  tiles[H-2][Math.floor(W/2)-1]=T.STONE_FLOOR;
  tiles[H-2][Math.floor(W/2)  ]=T.STONE_FLOOR;
  tiles[H-2][Math.floor(W/2)+1]=T.STONE_FLOOR;

  // Exit tile at south wall center
  tiles[H-1][Math.floor(W/2)]=T.STONE_FLOOR;
  placeDecor(tiles,floor,H-1,Math.floor(W/2),T.EXIT_INTERIOR);

  // Cracked walls for atmosphere
  [[2,3],[2,W-4],[Math.floor(H/2),2],[Math.floor(H/2),W-3]].forEach(([y,x])=>{
    if(tiles[y][x]===T.WALL) tiles[y][x]=T.CRACKED_WALL;
  });

  // ---- FLOOR LEVELS — divide tower into three 'floors' with interior walls ----
  // Ground floor divider (with central arch gap)
  for(let x=3;x<W-3;x++) tiles[H-8][x]=T.WALL;
  tiles[H-8][Math.floor(W/2)-1]=T.STONE_FLOOR; // arch gap
  tiles[H-8][Math.floor(W/2)  ]=T.STONE_FLOOR;
  tiles[H-8][Math.floor(W/2)+1]=T.STONE_FLOOR;

  // Mid floor divider
  for(let x=3;x<W-3;x++) tiles[Math.floor(H*0.45)][x]=T.WALL;
  tiles[Math.floor(H*0.45)][Math.floor(W/2)]=T.STONE_FLOOR; // arch gap

  // Snapshot floor before decorations
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) floor[y][x]=tiles[y][x];

  // ---- GROUND FLOOR (south section) — entry / cauldron room ----
  const gf = H-7; // top row of ground floor
  // Cauldron — west side
  placeDecor(tiles,floor,gf+1,3,T.CAULDRON);
  placeDecor(tiles,floor,gf+1,4,T.CANDLE);
  // Barrels of components — east side
  placeDecor(tiles,floor,gf+1,W-4,T.BARREL);
  placeDecor(tiles,floor,gf+2,W-4,T.BARREL);
  // Candles flanking entry arch
  placeDecor(tiles,floor,H-4,Math.floor(W/2)-3,T.CANDLE);
  placeDecor(tiles,floor,H-4,Math.floor(W/2)+3,T.CANDLE);
  // Stone rubble in corners
  placeDecor(tiles,floor,gf+3,3,T.STONE_RUBBLE);
  placeDecor(tiles,floor,gf+3,W-4,T.STONE_RUBBLE);

  // ---- MID FLOOR (middle section) — study / library ----
  const mf_top = Math.floor(H*0.45)+1;
  const mf_bot = H-9;
  const mf_mid = Math.floor((mf_top+mf_bot)/2);
  // Bookshelves along walls
  for(let x=3;x<=6;x++) placeDecor(tiles,floor,mf_top+1,x,T.BOOKSHELF);
  for(let x=W-7;x<=W-4;x++) placeDecor(tiles,floor,mf_top+1,x,T.BOOKSHELF);
  // Spell tome stand — center
  placeDecor(tiles,floor,mf_top+2,Math.floor(W/2),T.SPELL_TOME);
  // Potion rack — east wall
  placeDecor(tiles,floor,mf_mid,W-3,T.POTION_RACK);
  placeDecor(tiles,floor,mf_mid+1,W-3,T.POTION_RACK);
  // Table with candles
  placeDecor(tiles,floor,mf_top+3,Math.floor(W/2)-2,T.TABLE);
  placeDecor(tiles,floor,mf_top+3,Math.floor(W/2)+2,T.TABLE);
  placeDecor(tiles,floor,mf_top+3,Math.floor(W/2)-3,T.CANDLE);
  placeDecor(tiles,floor,mf_top+3,Math.floor(W/2)+3,T.CANDLE);

  // ---- TOP FLOOR (north section) — observatory / wizard's sanctum ----
  const tf = Math.floor(H*0.45)-1;
  // Arcane circle — center of top floor
  const cRow = Math.floor(tf/2)+1;
  placeDecor(tiles,floor,cRow,Math.floor(W/2),T.ARCANE_CIRCLE);
  // Crystal ball on stand — just north of circle
  placeDecor(tiles,floor,cRow-2,Math.floor(W/2),T.CRYSTAL_BALL);
  // Telescope — north-east corner
  placeDecor(tiles,floor,2,W-5,T.TELESCOPE);
  // Bookshelf north wall
  for(let x=4;x<=8;x++) placeDecor(tiles,floor,2,x,T.BOOKSHELF);
  // Candles around arcane circle
  [[-2,-2],[-2,2],[2,-2],[2,2]].forEach(([dy,dx])=>
    placeDecor(tiles,floor,cRow+dy,Math.floor(W/2)+dx,T.CANDLE));

  // Wizard NPC — stands beside crystal ball
  tiles[cRow-1][Math.floor(W/2)+2]=T.NPC_WIZARD;

  return {tiles, floor, W, H, name:'AETHERIC SPIRE', isInterior:true, entryX:Math.floor(W/2), entryY:H-3};
}

// ======= THE WHISPERWOOD =======
// A dark, dense forest. Shadow Walkers lurk between the trees.
// Enemies stay 5+ tiles from portals; spawn 7+ tiles from portals.
function makeWhisperwoodMap() {
  const W=80, H=60;
  const rng = makePRNG(worldSeed + 88881);
  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.DARK_GRASS));
  const floor  = Array.from({length:H}, ()=>Array(W).fill(T.DARK_GRASS));

  // Hard border
  for(let y=0;y<H;y++) for(let x=0;x<W;x++)
    if(y===0||y===H-1||x===0||x===W-1) tiles[y][x]=T.WALL;

  // Dense tree coverage — fractal noise for organic clusters
  const treeNoise = makeFractalNoise(worldSeed+22211, W, H, 4);
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++) {
    const n = treeNoise(x,y);
    if(n>0.45) tiles[y][x] = T.NORMAL_TREE;
    else if(n>0.30) tiles[y][x] = T.OAK;
  }

  // A few small water pools
  const waterNoise = makeFractalNoise(worldSeed+44433, W, H, 3);
  for(let y=2;y<H-2;y++) for(let x=2;x<W-2;x++)
    if(waterNoise(x,y)>0.78 && tiles[y][x]!==T.WALL) tiles[y][x]=T.WATER;
  smoothTerrain(tiles,W,H,T.WATER,2);

  // Main winding dirt path from north entry (x=18) south
  const pathX = 18;
  const southExitX = pathX;
  const mainPathXByRow = []; // tracks main-path x per row for branch origins
  let cx = pathX;
  for(let y=1;y<H-1;y++) {
    const bias = cx < southExitX ? 1 : (cx > southExitX ? -1 : 0);
    cx = Math.max(4, Math.min(W-5, cx + Math.floor(rng()*3)-1 + (rng()<0.3?bias:0)));
    for(let dx=-1;dx<=1;dx++)
      if(tiles[y][cx+dx]!==T.WALL) tiles[y][cx+dx]=T.DIRT;
    mainPathXByRow.push(cx);
  }
  // Guarantee last few rows connect straight to south exit
  for(let y=H-5;y<H-1;y++)
    if(tiles[y][southExitX]!==T.WALL) tiles[y][southExitX]=T.DIRT;

  // Wider clearing around north entry
  for(let dy=0;dy<5;dy++) for(let dx=-3;dx<=3;dx++) {
    const ny=1+dy, nx=pathX+dx;
    if(nx>0&&nx<W-1) tiles[ny][nx]=T.DARK_GRASS;
  }

  // ── Branching side paths ──
  // 3–4 branches split off the main path and end in small clearings
  const branchCount = 3 + Math.floor(rng()*2);
  const usedRows = [];
  let branchesMade = 0;
  for(let att=0; att<100 && branchesMade<branchCount; att++) {
    const rowY = 10 + Math.floor(rng() * (H - 22)); // avoid portal ends
    // Space branches at least 10 rows apart from each other
    if(usedRows.some(r => Math.abs(r - rowY) < 10)) continue;
    const originX = mainPathXByRow[rowY - 1] || pathX;
    const dir = rng() < 0.5 ? 1 : -1;
    const len = 9 + Math.floor(rng() * 9); // 9–17 tiles

    let bx = originX, by = rowY;
    let blocked = false;
    for(let i=0; i<len; i++) {
      bx = Math.max(3, Math.min(W-4, bx + dir));
      if(rng() < 0.2) by = Math.max(3, Math.min(H-4, by + (rng()<0.5?1:-1)));
      if(tiles[by][bx]===T.WALL) { blocked=true; break; }
      tiles[by][bx] = T.DIRT;
      // Occasionally widen path by 1 tile
      if(rng() < 0.35) {
        const wy = Math.max(1, Math.min(H-2, by + (rng()<0.5?1:-1)));
        if(tiles[wy][bx]!==T.WALL) tiles[wy][bx]=T.DARK_GRASS;
      }
    }
    if(blocked) continue;

    // Terminal clearing (4×4 open area)
    for(let dy=-2; dy<=2; dy++) for(let dx=-2; dx<=2; dx++) {
      const cy=by+dy, cc=bx+dx;
      if(cy>0&&cy<H-1&&cc>0&&cc<W-1&&tiles[cy][cc]!==T.WALL)
        tiles[cy][cc] = T.DARK_GRASS;
    }
    usedRows.push(rowY);
    branchesMade++;
  }

  // ── Connectivity flood-fill: ensure all passable tiles are reachable ──
  const passable = t => t===T.DARK_GRASS||t===T.DIRT||t===T.GRAVE||
                        t===T.CANDLE||t===T.WATER||t===T.SHADOW_WALKER;
  const reached = Array.from({length:H}, ()=>Array(W).fill(false));
  const q = [];
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++)
    if(tiles[y][x]===T.DIRT){ reached[y][x]=true; q.push([y,x]); }
  let qi=0;
  while(qi<q.length){
    const [cy2,cx2]=q[qi++];
    for(const [dy,dx] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const ny=cy2+dy, nx=cx2+dx;
      if(ny<1||ny>H-2||nx<1||nx>W-2||reached[ny][nx]) continue;
      if(passable(tiles[ny][nx])){ reached[ny][nx]=true; q.push([ny,nx]); }
    }
  }
  // For every isolated passable tile, carve a corridor to the nearest reached tile
  for(let pass=0;pass<6;pass++){
    for(let y=2;y<H-2;y++) for(let x=2;x<W-2;x++){
      if(reached[y][x]||!passable(tiles[y][x])) continue;
      let bestD=9999, bry=-1, brx=-1;
      for(let sy=1;sy<H-1;sy++) for(let sx=1;sx<W-1;sx++){
        if(!reached[sy][sx]) continue;
        const d=Math.abs(sy-y)+Math.abs(sx-x);
        if(d<bestD){ bestD=d; bry=sy; brx=sx; }
      }
      if(bry===-1) continue;
      const stepX=x<brx?1:-1, stepY=y<bry?1:-1;
      let carveX=x;
      while(carveX!==brx){
        if(tiles[y][carveX]===T.NORMAL_TREE||tiles[y][carveX]===T.OAK) tiles[y][carveX]=T.DARK_GRASS;
        if(!reached[y][carveX]&&passable(tiles[y][carveX])){ reached[y][carveX]=true; q.push([y,carveX]); }
        carveX+=stepX;
      }
      let carveY=y;
      while(carveY!==bry){
        if(tiles[carveY][brx]===T.NORMAL_TREE||tiles[carveY][brx]===T.OAK) tiles[carveY][brx]=T.DARK_GRASS;
        if(!reached[carveY][brx]&&passable(tiles[carveY][brx])){ reached[carveY][brx]=true; q.push([carveY,brx]); }
        carveY+=stepY;
      }
      let qi2=0;
      while(qi2<q.length){
        const [cy3,cx3]=q[qi2++];
        for(const [dy,dx] of [[-1,0],[1,0],[0,-1],[0,1]]){
          const ny=cy3+dy, nx=cx3+dx;
          if(ny<1||ny>H-2||nx<1||nx>W-2||reached[ny][nx]) continue;
          if(passable(tiles[ny][nx])){ reached[ny][nx]=true; q.push([ny,nx]); }
        }
      }
    }
  }

  // Snapshot floor
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) floor[y][x]=tiles[y][x];

  // Portal positions — stored on the map for enemy AI exclusion zones
  const portalPositions = [[pathX, 0], [southExitX, H-1]];

  // North return portal (back to Ashenveil)
  tiles[0][pathX] = T.DARK_GRASS;
  placeDecor(tiles,floor,0,pathX,T.FOREST_PORTAL);

  // South exit portal — leads onward
  tiles[H-1][southExitX]=T.DARK_GRASS;
  placeDecor(tiles,floor,H-1,southExitX,T.EXIT);
  for(let dy=1;dy<=5;dy++)
    if(tiles[H-1-dy][southExitX]!==T.WALL) tiles[H-1-dy][southExitX]=T.DIRT;

  // Scatter ancient graves and candles
  for(let att=0;att<50;att++) {
    const gx=3+Math.floor(rng()*(W-6)), gy=6+Math.floor(rng()*(H-12));
    if(tiles[gy][gx]===T.DARK_GRASS && reached[gy][gx]) {
      placeDecor(tiles,floor,gy,gx,T.GRAVE);
      if(rng()<0.5 && tiles[gy][gx+1]===T.DARK_GRASS)
        placeDecor(tiles,floor,gy,gx+1,T.CANDLE);
    }
  }

  // Place Shadow Walkers
  // Requirements: reachable tile, adjacent to tree, 7-tile Chebyshev exclusion from portals
  let swPlaced=0;
  for(let att=0;att<600&&swPlaced<18;att++) {
    const ex=3+Math.floor(rng()*(W-6));
    const ey=4+Math.floor(rng()*(H-8));
    if(!reached[ey][ex]) continue;
    if(tiles[ey][ex]!==T.DARK_GRASS && tiles[ey][ex]!==T.DIRT) continue;
    const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    const nearTree=dirs.some(([dy,dx])=>{
      const t=tiles[ey+dy]?.[ex+dx];
      return t===T.NORMAL_TREE||t===T.OAK;
    });
    const tooClose = portalPositions.some(([px,py]) =>
      Math.abs(ex-px)<=7 && Math.abs(ey-py)<=7
    );
    if(nearTree && !tooClose) { tiles[ey][ex]=T.SHADOW_WALKER; swPlaced++; }
  }

  return {tiles, floor, W, H, name:'THE WHISPERWOOD',
          entryX:pathX, entryY:2, portalPositions};
}

// Shadow Walker special AI — stays near trees by day, roams freely at night
function updateShadowWalker(e, dt) {
  const night = getNightAlpha();
  if(night > 0.3) {
    // Night: extended aggro and patrol — acts like normal enemy
    e.def.aggroRange = 8;
    e.def.patrolRadius = 7;
  } else {
    // Day: hug trees, small patrol radius
    e.def.aggroRange = 4;
    e.def.patrolRadius = 2;
    // Drift toward nearest tree if not near one
    if(!e._treeX) {
      const map = currentMap;
      let bestDist = Infinity, bx=e.homeX, by=e.homeY;
      for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++) {
        const ty=Math.round(e.y)+dy, tx=Math.round(e.x)+dx;
        if(ty<0||ty>=map.H||tx<0||tx>=map.W) continue;
        const t=map.tiles[ty][tx];
        if(t===T.NORMAL_TREE||t===T.OAK) {
          const d=Math.abs(dy)+Math.abs(dx);
          if(d<bestDist){bestDist=d;bx=tx;by=ty;}
        }
      }
      e._treeX=bx; e._treeY=by;
    }
    // Home position drifts toward tree shade
    e.homeX += (e._treeX - e.homeX)*0.01;
    e.homeY += (e._treeY - e.homeY)*0.01;
  }
}

// Shadow Walker visual — a smoky humanoid silhouette
// Shadow walker halo sprite — built once, reused for all shadow walkers
let _swHaloSprite = null;
function _buildSwHalo() {
  const sz = TILE * 2;
  const oc = document.createElement('canvas');
  oc.width = oc.height = sz;
  const c = oc.getContext('2d');
  const g = c.createRadialGradient(sz/2,sz/2,2,sz/2,sz/2,sz/2);
  g.addColorStop(0,'rgba(40,20,70,0.8)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=g; c.fillRect(0,0,sz,sz);
  return oc;
}

function drawShadowWalker(ctx, px, py, e, now) {
  const ts=TILE;
  const night = getNightAlpha();
  // Use low-frequency time quantisation to reduce sin calls — updates ~30fps visually
  const t30 = Math.floor(now * 0.03) / 30; // quantised to ~30hz
  const flicker = Math.sin(t30*0.003*1000+e.id*1.7)*0.12;
  const alpha = 0.55 + night*0.35 + flicker;

  // Smoky halo — use cached sprite instead of createRadialGradient per frame
  if(!_swHaloSprite) _swHaloSprite = _buildSwHalo();
  const hsz = TILE * 2;
  ctx.globalAlpha = alpha * 0.8;
  ctx.drawImage(_swHaloSprite, px - TILE/2, py - TILE/2, hsz, hsz);
  ctx.globalAlpha = 1;

  // Body silhouette
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#120818';
  const sway = Math.sin(t30*0.002*1000)*0.15; // quantised
  // Torso + head in single path for fewer state changes
  ctx.beginPath();
  ctx.ellipse(px+ts/2, py+ts*0.5, ts*0.18, ts*0.28, sway, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(px+ts/2, py+ts*0.22, ts*0.14, ts*0.14+flicker*ts*0.5, 0, 0, Math.PI*2);
  ctx.fill();
  // Wispy tendrils
  ctx.strokeStyle='#1e0a28'; ctx.lineWidth=3; ctx.lineCap='round';
  const wave0 = Math.sin(t30*0.004*1000+e.id-4)*3;
  const wave1 = Math.sin(t30*0.004*1000+e.id+4)*3;
  ctx.beginPath();
  ctx.moveTo(px+ts/2-4, py+ts*0.65);
  ctx.quadraticCurveTo(px+ts/2-4+wave0, py+ts*0.8, px+ts/2-4-wave0, py+ts*0.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px+ts/2+4, py+ts*0.65);
  ctx.quadraticCurveTo(px+ts/2+4+wave1, py+ts*0.8, px+ts/2+4-wave1, py+ts*0.95);
  ctx.stroke();
  // Eyes — batch both into one path
  const eyeA = 0.7+night*0.3;
  ctx.fillStyle=`rgba(160,80,255,${eyeA})`;
  ctx.beginPath();
  ctx.arc(px+ts*0.42, py+ts*0.2, 2, 0, Math.PI*2);
  ctx.arc(px+ts*0.58, py+ts*0.2, 2, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle=`rgba(160,80,255,${eyeA*0.3})`;
  ctx.beginPath();
  ctx.arc(px+ts*0.42, py+ts*0.2, 5, 0, Math.PI*2);
  ctx.arc(px+ts*0.58, py+ts*0.2, 5, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  if(e.flashTimer>0){ctx.fillStyle=`rgba(255,255,255,${e.flashTimer*0.4})`; ctx.fillRect(px,py,ts,ts);}
}


// ======= FARM INTERACTIONS =======
function harvestCrop(x, y, itemId, msg, xp) {
  if(currentActivity) { log('Already busy.', 'bad'); return; }
  log(msg, '');
  SFX.chop(); // satisfying thwack
  startActivity('Harvesting', 1800, () => {
    addToInventory(itemId);
    buildInventory();
    giveXP('Farming', xp);
    log(`You harvest some ${ITEMS[itemId].name}.`, 'good');
    // Remove crop — respawn after 15 mins
    currentMap.tiles[y][x] = currentMap.floor[y][x] || T.GRASS;
    setTimeout(() => {
      if(currentMap && currentMap.tiles[y]) {
        currentMap.tiles[y][x] = itemId === 'wheat' ? T.CROP_WHEAT : T.CROP_TURNIP;
      }
    }, 15 * 60 * 1000);
  });
}

function catchAnimal(x, y, species) {
  if(currentActivity) { log('Already busy.', 'bad'); return; }
  const farmLvl = state.players[state.activePlayer].skills.Farming?.lvl || 1;
  const missChance = Math.max(0.05, 0.28 - farmLvl * 0.005);
  const chanceMiss = Math.random() < missChance;
  if(chanceMiss) {
    log(`The ${species} evades you and scurries off!`, 'bad');
    // Move animal a few tiles away
    const npc = npcs.find(n => n.x === x && n.y === y);
    if(npc) { npc.x = Math.max(1,Math.min(currentMap.W-2, npc.x+(Math.random()>0.5?3:-3))); }
    return;
  }
  const drops = { chicken:['raw_chicken','egg'], pig:['raw_pork'], cow:['raw_beef'] };
  const pool = drops[species] || ['raw_chicken'];
  const drop = pool[Math.floor(Math.random()*pool.length)];
  const also = (species==='chicken' && Math.random()<0.4) ? 'egg' : null;
  addToInventory(drop);
  if(also) addToInventory(also);
  buildInventory();
  log(`You catch the ${species} and gather ${ITEMS[drop].name}${also?' and an '+ITEMS[also].name:''}.`, 'good');
  giveXP('Farming', species==='cow'?8:species==='pig'?5:3);
  // The NPC animal stays — it's just gathering produce, not slaughtering
}

function makeAshenveil() {
  const W=MAP_W, H=MAP_H;
  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.GRASS));
  // Floor layer — records the ground tile underneath decorations
  const floor = Array.from({length:H}, ()=>Array(W).fill(T.GRASS));

  // Stone border walls
  for(let y=0;y<H;y++) for(let x=0;x<W;x++)
    if(y===0||y===H-1||x===0||x===W-1) tiles[y][x]=T.WALL;

  // ---- COBBLESTONE TOWN SQUARE (center-left area) ----
  for(let y=10;y<=22;y++) for(let x=8;x<=28;x++) tiles[y][x]=T.COBBLE;

  // ---- MAIN ROAD: horizontal spine east to EXIT ----
  for(let x=1;x<W-1;x++) {
    if(tiles[16][x]===T.GRASS||tiles[16][x]===T.COBBLE) tiles[16][x]=T.DIRT;
  }
  // Re-cobble the town square road section
  for(let x=8;x<=28;x++) tiles[16][x]=T.COBBLE;

  // ---- NORTH ROAD from top wall down to square ----
  for(let y=1;y<=10;y++) tiles[y][18]=T.DIRT;

  // ---- SOUTH ROAD from square to bottom wall ----
  for(let y=22;y<H-1;y++) tiles[y][18]=T.DIRT;

  // ---- INN / TAVERN — "The Tarnished Flagon" (north-west of square) ----
  // Layout: 5 wide × 4 tall (y=5..8, x=6..10)
  //   y=5 (roof):   ROOF_L  ROOF_M  ROOF_CHIMNEY  ROOF_M  ROOF_R
  //   y=6 (wall):   SIDE    WIN     WIN            WIN     SIDE
  //   y=7 (wall):   SIDE    WIN     WIN            WIN     SIDE
  //   y=8 (front):  PLAIN   WIN     BWALL_DOOR     WIN     PLAIN   ← door is the teleporter
  //   y=9 col 8: approach stone floor (cobble path leads here from square)
  for(let fy=5;fy<=9;fy++) for(let fx=5;fx<=11;fx++) tiles[fy][fx]=T.STONE_FLOOR;
  // Roof row (y=5)
  tiles[5][6]=T.ROOF_L; tiles[5][7]=T.ROOF_M; tiles[5][8]=T.ROOF_CHIMNEY;
  tiles[5][9]=T.ROOF_M; tiles[5][10]=T.ROOF_R;
  // Upper wall row (y=6)
  tiles[6][6]=T.BWALL_SIDE; tiles[6][7]=T.BWALL_WIN;
  tiles[6][8]=T.BWALL_WIN;  tiles[6][9]=T.BWALL_WIN; tiles[6][10]=T.BWALL_SIDE;
  // Mid wall row (y=7)
  tiles[7][6]=T.BWALL_SIDE; tiles[7][7]=T.BWALL_WIN;
  tiles[7][8]=T.BWALL_WIN;  tiles[7][9]=T.BWALL_WIN; tiles[7][10]=T.BWALL_SIDE;
  // Front face row (y=8) — BWALL_DOOR at col 8 IS the teleporter (solid but triggers on bump/click)
  tiles[8][6]=T.BWALL_PLAIN; tiles[8][7]=T.BWALL_WIN;
  tiles[8][8]=T.BWALL_DOOR;  tiles[8][9]=T.BWALL_WIN; tiles[8][10]=T.BWALL_PLAIN;
  // y=9 approach — stone floor (cobble path already leads here)

  // ---- BLACKSMITH — "The Ashen Forge" (4 wide × 3 tall, y=5..7, x=23..26) ----
  //   y=5 (roof):   ROOF_L  ROOF_CHIMNEY  ROOF_CHIMNEY  ROOF_R
  //   y=6 (wall):   BWALL_FORGE  BWALL_FORGE  BWALL_FORGE  BWALL_SIDE
  //   y=7 (front):  BWALL_FORGE  BWALL_DOOR   BWALL_PLAIN  BWALL_FORGE
  //   Door at y=7,x=24 — approach tile y=8,x=24
  for(let fy=5;fy<=8;fy++) for(let fx=22;fx<=27;fx++) tiles[fy][fx]=T.STONE_FLOOR;
  // Roof (y=5)
  tiles[5][23]=T.ROOF_L;       tiles[5][24]=T.ROOF_CHIMNEY;
  tiles[5][25]=T.ROOF_CHIMNEY; tiles[5][26]=T.ROOF_R;
  // Wall (y=6)
  tiles[6][23]=T.BWALL_FORGE; tiles[6][24]=T.BWALL_FORGE;
  tiles[6][25]=T.BWALL_FORGE; tiles[6][26]=T.BWALL_SIDE;
  // Front face (y=7) — door at x=24
  tiles[7][23]=T.BWALL_FORGE; tiles[7][24]=T.BWALL_DOOR;
  tiles[7][25]=T.BWALL_PLAIN; tiles[7][26]=T.BWALL_FORGE;
  // Smelter and workbench are inside — see makeBlacksmithInterior()

  // ---- MARKET STALL / SHOP (south side of square) ----
  // Layout (6 wide x 3 tall, top-left at y=19 x=12):
  //   Row y=19 (roof):   ROOF_L ROOF_M ROOF_M ROOF_M ROOF_M ROOF_R
  //   Row y=20 (front):  AWNING AWNING AWNING AWNING AWNING AWNING  (open-front stall)
  //   Row y=21 (ground): FLOOR  FLOOR  FLOOR  FLOOR  FLOOR  FLOOR   (open, walkable)
  for(let fy=19;fy<=21;fy++) for(let fx=12;fx<=17;fx++) tiles[fy][fx]=T.STONE_FLOOR;
  tiles[19][12]=T.ROOF_L;     tiles[19][13]=T.ROOF_M;  tiles[19][14]=T.ROOF_M;
  tiles[19][15]=T.ROOF_M;     tiles[19][16]=T.ROOF_M;  tiles[19][17]=T.ROOF_R;
  tiles[20][12]=T.BWALL_AWNING; tiles[20][13]=T.BWALL_AWNING; tiles[20][14]=T.BWALL_AWNING;
  tiles[20][15]=T.BWALL_AWNING; tiles[20][16]=T.BWALL_AWNING; tiles[20][17]=T.BWALL_AWNING;
  // Row y=21 stays as stone floor — open front of stall is walkable
  // Interactive shop/cooking tiles on stall counter
  tiles[20][14]=T.SHOP;
  tiles[20][15]=T.COOKING_FIRE;
  // Blacksmith interactive tiles (inside, reachable after entering via INN_DOOR logic)
  // Smelter and workbench are inside — see makeBlacksmithInterior()


    // ---- TOWN WELL and LAMPPOSTS — placed via placeDecor after floor snapshot ----

  // ---- DOCKS / WATER (south-east corner) ----
  for(let y=24;y<=H-2;y++) for(let x=35;x<=W-2;x++) tiles[y][x]=T.WATER;
  // Extend water one row north for pier-over-water effect
  for(let x=35;x<=W-2;x++) tiles[23][x]=T.WATER;
  // ---- DOCK BOARDWALK: runs east from cobble square edge (x=28) along y=22,23 ----
  for(let x=28;x<=36;x++) { tiles[22][x]=T.DOCK_PLANK; tiles[23][x]=T.DOCK_PLANK; }
  // Pier head juts further east over water at y=22,23 x=35,36 (already set above)
  // Dock railing suggestion — placeDecor barrels at pier sides
  // Fishing spots on pier head
  tiles[22][34]=T.FISHING; tiles[22][36]=T.FISHING;
  // Cobble connector: east road (y=16,x=30) south to dock approach (y=21,x=30)
  for(let y=17;y<=21;y++) if(tiles[y][30]!==T.COBBLE) tiles[y][30]=T.COBBLE;
  // Dock approach row at y=21 widens to boardwalk x=28..30
  for(let x=28;x<=30;x++) if(tiles[21][x]===T.GRASS||tiles[21][x]===T.COBBLE) tiles[21][x]=T.COBBLE;

  // ---- TREES / NATURE around town edges ----
  // NW corner cluster
  [[2,2],[2,3],[3,2],[3,4],[2,30],[3,31],  // [2,32] and [3,33] removed — hit Mira's house
  // SW land area (x<34 stays dry)
   [26,4],[27,3],[28,5],[27,6],
   [24,8],[25,9],[26,10]
  ].forEach(([y,x])=>{ if(x>0&&x<W-1&&y>0&&y<H-1) tiles[y][x]=T.NORMAL_TREE; });
  // NE oaks — repositioned away from house footprints
  [[4,36],[4,37],[4,43],[4,44],[5,43],[4,50],[4,51],[5,50],
   [22,4],[23,5],[22,6],[21,4]
  ].forEach(([y,x])=>{ if(x>0&&x<W-1&&y>0&&y<H-1) tiles[y][x]=T.OAK; });

  // ---- PATHS connecting buildings to main road ----
  // Inn to road
  for(let y=10;y<=16;y++) tiles[y][8]=T.COBBLE;
  // Blacksmith to road — door at x=24
  for(let y=8;y<=16;y++) tiles[y][24]=T.COBBLE;
  // Market path south
  for(let y=16;y<=19;y++) tiles[y][14]=T.COBBLE;

  // ---- NORTH GATE AREA ----
  // Clear path from north wall into town
  for(let y=1;y<=4;y++) tiles[y][18]=T.DIRT;
  tiles[1][17]=T.WALL; tiles[1][19]=T.WALL;
  // Chapel portal replaces the north gate opening — the old road north leads to the Forsaken Chapel
  // (placed post-snapshot via placeDecor so floor=DIRT is recorded underneath)

  // ---- RESIDENTIAL DISTRICT (north strip, east of blacksmith) ----
  // placeHouse: builds a 5-wide x 4-tall house using new building tiles
  // roofChimneyCol: 'L' = chimney on left side, 'R' = right side, 'N' = no chimney
  // wallTile: HOUSE_A, HOUSE_B, or HOUSE_C for per-variant wall/window colour
  function placeHouse(ty, tx) {
    // 3 wide x 2 tall:
    // row ty+0: ROOF_L  ROOF_CHIMNEY  ROOF_R
    // row ty+1: BWALL_WIN  BWALL_DOOR  BWALL_WIN
    tiles[ty+0][tx+0] = T.ROOF_L;
    tiles[ty+0][tx+1] = T.ROOF_CHIMNEY;
    tiles[ty+0][tx+2] = T.ROOF_R;
    tiles[ty+1][tx+0] = T.BWALL_WIN;
    tiles[ty+1][tx+1] = T.BWALL_DOOR;
    tiles[ty+1][tx+2] = T.BWALL_WIN;
  }

  // Mira's house — y:2, x:32  (house A: chimney right, warm)
  placeHouse(2, 32);
  // Aldric's house — y:2, x:39 (house B: no chimney, noble blue)
  placeHouse(2, 39);
  // Residence — y:2, x:46 (house A)
  placeHouse(2, 46);
  // Residence — y:2, x:53 (house C: chimney left, dark)
  placeHouse(2, 53);

  // North lane road connecting houses to main east road
  for(let x=31;x<=W-2;x++) if(tiles[8][x]===T.GRASS) tiles[8][x]=T.DIRT;
  // Dirt paths from each house door (y=3) down to north lane (y=8)
  // House door columns: 33, 40, 47, 54
  for(const doorX of [33, 40, 47, 54]) {
    for(let py=4; py<=7; py++) {
      if(tiles[py][doorX]===T.GRASS) tiles[py][doorX]=T.DIRT;
    }
  }
  for(let y=9;y<=15;y++) if(tiles[y][35]===T.GRASS) tiles[y][35]=T.DIRT;
  for(let y=9;y<=15;y++) if(tiles[y][42]===T.GRASS) tiles[y][42]=T.DIRT;
  for(let y=9;y<=15;y++) if(tiles[y][49]===T.GRASS) tiles[y][49]=T.DIRT;
  for(let y=9;y<=15;y++) if(tiles[y][56]===T.GRASS) tiles[y][56]=T.DIRT;

  // ---- SOUTH-WEST RESIDENTIAL (Elspeth & Rowan) ----
  // Elspeth's house — y:26, x:2 (house C: chimney left, dark)
  placeHouse(26, 2);
  // Rowan's house — y:26, x:10 (house B: no chimney, noble)
  placeHouse(26, 10);

  // South lane
  for(let x=3;x<=18;x++) if(tiles[30][x]===T.GRASS||tiles[30][x]===T.DIRT) tiles[30][x]=T.DIRT;
  // Dirt paths from SW house doors (y=27) down to south lane (y=30)
  // House door columns: 3 (placeHouse(26,2)→x=3), 11 (placeHouse(26,10)→x=11)
  for(const doorX of [3, 11]) {
    for(let py=28; py<=29; py++) {
      if(tiles[py][doorX]===T.GRASS) tiles[py][doorX]=T.DIRT;
    }
  }

  // ---- CEMETERY structure (fences placed post-snapshot via placeDecor) ----
  for(let y=2;y<=8;y++) for(let x=45;x<=56;x++) tiles[y][x]=T.DARK_GRASS;
  // Path from east road up to cemetery
  for(let y=9;y<=15;y++) if(tiles[y][51]===T.GRASS||tiles[y][51]===T.DIRT) tiles[y][51]=T.DIRT;

  // ---- EXIT portal — placed via placeDecor after floor snapshot ----
  const exitY = 16;
  for(let dx=1;dx<=4;dx++) if(W-1-dx>0) tiles[exitY][W-1-dx]=T.DIRT;

  // ---- Snapshot floor layer before placing decorations ----
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) floor[y][x]=tiles[y][x];

  // Town well (centre of square)
  placeDecor(tiles,floor,15,18,T.TOWN_WELL);
  // Dock barrels and lanterns (placed after floor snapshot so floor=DOCK_PLANK is saved)
  placeDecor(tiles,floor,22,28,T.BARREL); placeDecor(tiles,floor,23,28,T.BARREL);
  placeDecor(tiles,floor,22,33,T.BARREL);

  // ---- LAMPPOSTS ----
  // North road flanking — x=17,19 beside road x=18 (not on it)
  [[3,17],[3,19],[7,17],[7,19]].forEach(([y,x])=>placeDecor(tiles,floor,y,x,T.LAMPPOST));
  // Flank inn cobble path x=8 — lamps at x=7 beside it (not on it)
  [[10,7],[13,7]].forEach(([y,x])=>placeDecor(tiles,floor,y,x,T.LAMPPOST));
  // Flank blacksmith cobble path x=25 — lamps at x=26 beside it
  [[10,25],[13,25]].forEach(([y,x])=>placeDecor(tiles,floor,y,x,T.LAMPPOST));
  // Town square corner posts (on cobble, not on any path)
  [[10,9],[10,27],[22,9],[22,27]].forEach(([y,x])=>placeDecor(tiles,floor,y,x,T.LAMPPOST));
  // East road flanking — y=15 (north side) and y=17 (south side), but NOT at connector columns x=35,42,49,56
  // Connectors are at x=35,42,49,56 so skip those; lamp at x=37,44,51 etc (between connectors)
  [[15,38],[15,44],[15,53],[15,57],
   [17,38],[17,44],[17,53],[17,57]].forEach(([y,x])=>{
    if(x>0&&x<W-1) placeDecor(tiles,floor,y,x,T.LAMPPOST);
  });
  // Residential north lane: lamps ABOVE the lane at y=7, not y=8 which IS the lane
  [[7,34],[7,41],[7,48],[7,55]].forEach(([y,x])=>placeDecor(tiles,floor,y,x,T.LAMPPOST));
  // Connector paths y=9-15 at x=35,42,49,56 — lamp beside at x+1 (not on path) at mid-point y=12
  [[12,36],[12,43],[12,50],[12,57]].forEach(([y,x])=>{
    if(x<W-1) placeDecor(tiles,floor,y,x,T.LAMPPOST);
  });
  // SW lane: x=3..18 on y=30 — lamp beside path at y=31 not y=30, and offset x from connectors x=4,12
  [[31,3],[31,13],[31,17]].forEach(([y,x])=>placeDecor(tiles,floor,y,x,T.LAMPPOST));
  // SW connectors are y=23-25 at x=4,12 — lamps beside at x=3 and x=11
  [[24,3],[24,11]].forEach(([y,x])=>placeDecor(tiles,floor,y,x,T.LAMPPOST));

  // ---- SIGNS ----
  // North lane entrance: y=7 x=31 (above lane y=8, not on it)
  placeDecor(tiles,floor,7,31,T.SIGN);
  // South road junction: y=22 x=19 (beside road x=18, not on it)
  placeDecor(tiles,floor,22,19,T.SIGN);
  // Cemetery entrance: already placed below with cemetery decor

  // NPC spawn markers — converted to entities on load
  tiles[11][10]=T.NPC_GUARD;
  tiles[11][26]=T.NPC_GUARD;
  tiles[16][30]=T.NPC_GUARD;   // Edwyn — south road / docks patrol
  tiles[18][15]=T.NPC_MERCHANT;
  tiles[6][35]=T.NPC_VILLAGER;  // Mira
  tiles[6][42]=T.NPC_VILLAGER;  // Aldric
  tiles[32][4]=T.NPC_VILLAGER;  // Elspeth
  tiles[32][12]=T.NPC_VILLAGER; // Rowan
  tiles[14][6]=T.NPC_VILLAGER;  // Old Bertram — homestead quest giver

  // ---- Town decorations ----
  placeDecor(tiles,floor,22,20,T.NOTICE_BOARD);
  placeDecor(tiles,floor,10,29,T.CHEST); placeDecor(tiles,floor,10,30,T.CHEST);
  placeDecor(tiles,floor,22,32,T.BARREL); placeDecor(tiles,floor,22,33,T.BARREL); placeDecor(tiles,floor,22,34,T.BARREL);
  placeDecor(tiles,floor,10,6,T.CANDLE); placeDecor(tiles,floor,10,10,T.CANDLE);
  placeDecor(tiles,floor,9,23,T.BARREL); // outside blacksmith

  // Inn door
  // INN_DOOR tile removed — BWALL_DOOR at y=8,x=8 is the trigger (see checkZoneExit)

  // ---- CHAPEL PORTAL (north gate, top of north road) ----
  placeDecor(tiles,floor,1,18,T.CHAPEL_PORTAL);
  // Warning sign just south of the portal
  placeDecor(tiles,floor,4,17,T.SIGN);  // left of north road at y=4

  // House facades now built tile-by-tile in placeHouse() above

    // Residential lane chests
  placeDecor(tiles,floor,6,37,T.CHEST);
  placeDecor(tiles,floor,6,44,T.CHEST);

  // ---- Cemetery fences and decorations ----
  // North fence row at y=1
  for(let x=44;x<=57;x++) placeDecor(tiles,floor,1,x,T.FENCE);
  // South fence row at y=9 — leave gaps at connector columns x=49,51,56 (paths) AND gate gap x=52,53
  for(let x=44;x<=57;x++){
    if(x===52||x===53) continue;     // gate opening
    if(x===49||x===51||x===56) continue;  // connector paths
    placeDecor(tiles,floor,9,x,T.FENCE);
  }
  // West fence at x=44 — y=2..8, but the north lane is y=8 so skip y=8
  for(let y=2;y<=7;y++) placeDecor(tiles,floor,y,44,T.FENCE);
  // East fence at x=57 — y=2..8, skip y=8 (on lane)
  for(let y=2;y<=7;y++) placeDecor(tiles,floor,y,57,T.FENCE);
  // Cemetery sign at gate
  placeDecor(tiles,floor,9,52,T.SIGN);
  // Gravestones
  [[3,46],[3,49],[3,52],[3,55],
   [5,46],[5,49],[5,52],[5,55],
   [7,47],[7,51],[7,54]
  ].forEach(([gy,gx])=>{ if(gx>=45&&gx<=56) placeDecor(tiles,floor,gy,gx,T.GRAVE); });
  // Cemetery path: update to x=52 (centre of gate)
  // (path already laid at x=51 in structure section — we'll leave that and also gate at 52)

  // ---- FLOWERS ----
  // Along inn cobble path x=8 — scatter on WEST side x=6,7 between y=10-15 (not on path x=8 or lamp x=7)
  // Lamps are at x=7,y=10 and x=7,y=13 so avoid those
  [[11,6],[12,6],[14,6],[15,6]
  ].forEach(([fy,fx])=>{ if(tiles[fy][fx]===T.GRASS) placeDecor(tiles,floor,fy,fx,T.FLOWER); });
  // Along blacksmith path x=25 — scatter on x=27,28
  [[11,27],[12,27],[14,27],[15,27],[11,28],[14,28]
  ].forEach(([fy,fx])=>{ if(tiles[fy][fx]===T.GRASS) placeDecor(tiles,floor,fy,fx,T.FLOWER); });
  // Square perimeter — between corner lamps, on grass just outside cobble (x=7 and x=29)
  [[11,29],[13,29],[15,29],[17,29],[20,29],
   [11,7],[17,7],[20,7]
  ].forEach(([fy,fx])=>{ if(tiles[fy][fx]===T.GRASS) placeDecor(tiles,floor,fy,fx,T.FLOWER); });
  // North road flanking — beside x=18 road, left and right at various y
  [[2,16],[4,16],[5,16],[6,16],[2,20],[4,20],[5,20],[6,20]
  ].forEach(([fy,fx])=>{ if(tiles[fy][fx]===T.GRASS) placeDecor(tiles,floor,fy,fx,T.FLOWER); });
  // Residential north lane — scatter between houses and ABOVE lane (y=6,7 at non-lamp x)
  [[6,38],[6,40],[6,45],[6,52],[7,38],[7,40],[7,45],[7,52]
  ].forEach(([fy,fx])=>{ if(tiles[fy][fx]===T.GRASS) placeDecor(tiles,floor,fy,fx,T.FLOWER); });
  // Along east road southern grass strip y=17-19, staggered, NOT at connector x cols
  [[18,37],[19,37],[18,40],[19,40],[18,44],[19,44],[18,47],[19,47],[18,53],[19,53]
  ].forEach(([fy,fx])=>{ if(tiles[fy][fx]===T.GRASS) placeDecor(tiles,floor,fy,fx,T.FLOWER); });
  // SW residential area — around houses and lane
  [[25,2],[25,8],[25,16],[31,2],[31,8],[31,16],[32,8],[33,4],[33,12]
  ].forEach(([fy,fx])=>{ if(tiles[fy][fx]===T.GRASS) placeDecor(tiles,floor,fy,fx,T.FLOWER); });
  // Cemetery surroundings — just outside fence east and west
  [[2,58],[4,58],[6,58],[2,43],[4,43],[6,43]
  ].forEach(([fy,fx])=>{ if(fy>0&&fy<H-1&&fx>0&&fx<W-1&&tiles[fy][fx]===T.GRASS) placeDecor(tiles,floor,fy,fx,T.FLOWER); });
  // NW corner cluster near trees
  [[4,5],[4,6],[5,5],[6,5]
  ].forEach(([fy,fx])=>{ if(tiles[fy][fx]===T.GRASS) placeDecor(tiles,floor,fy,fx,T.FLOWER); });

  // ---- BUSHES ----
  // Along north wall east of inn, west of residential lane
  [[2,14],[2,16],[2,20],[2,22],[2,26],[2,29]
  ].forEach(([by,bx])=>{ if(tiles[by][bx]===T.GRASS) placeDecor(tiles,floor,by,bx,T.BUSH); });
  // Flanking the inn building exterior
  [[5,4],[6,4],[7,4],[8,4]
  ].forEach(([by,bx])=>{ if(tiles[by][bx]===T.GRASS) placeDecor(tiles,floor,by,bx,T.BUSH); });
  // East of blacksmith exterior
  [[5,29],[6,29],[7,29]
  ].forEach(([by,bx])=>{ if(tiles[by][bx]===T.GRASS) placeDecor(tiles,floor,by,bx,T.BUSH); });
  // South of town square (west of market stall)
  [[23,9],[23,10],[23,11]
  ].forEach(([by,bx])=>{ if(tiles[by][bx]===T.COBBLE||tiles[by][bx]===T.GRASS) placeDecor(tiles,floor,by,bx,T.BUSH); });
  // Docks edge (land side of water, west of barrels)
  [[22,29],[22,30],[22,31]
  ].forEach(([by,bx])=>{ if(tiles[by][bx]===T.GRASS) placeDecor(tiles,floor,by,bx,T.BUSH); });
  // SW residential perimeter
  [[25,7],[25,9],[25,14],[25,15],[30,2],[30,8],[30,14]
  ].forEach(([by,bx])=>{ if(tiles[by][bx]===T.GRASS) placeDecor(tiles,floor,by,bx,T.BUSH); });
  // North lane — beside house walls (y=1-2, between houses x gaps)
  [[1,31],[1,38],[1,45],[1,52]
  ].forEach(([by,bx])=>{ if(by>0&&bx>0&&bx<W-1&&tiles[by][bx]===T.GRASS) placeDecor(tiles,floor,by,bx,T.BUSH); });
  // Cemetery corners outside fence
  [[1,43],[1,58],[9,43]
  ].forEach(([by,bx])=>{ if(by>0&&bx>0&&bx<W-1&&tiles[by][bx]===T.GRASS) placeDecor(tiles,floor,by,bx,T.BUSH); });
  // East of market/south square scatter
  [[17,29],[18,29],[19,29]
  ].forEach(([by,bx])=>{ if(tiles[by][bx]===T.GRASS) placeDecor(tiles,floor,by,bx,T.BUSH); });

  // Place EXIT (east → Ashwood Vale)
  placeDecor(tiles,floor,exitY,W-1,T.EXIT);

  // ---- SOUTH PORTAL — path leads into the Whisperwood ----
  // Open gap in south wall and lay a dirt path down to it
  const southPortalX = 18; // aligned with the existing south road
  tiles[H-1][southPortalX] = T.GRASS; // break wall
  tiles[H-1][southPortalX-1] = T.GRASS;
  tiles[H-1][southPortalX+1] = T.GRASS;
  // Dirt path from south square road to portal
  for(let y=22;y<H-1;y++) {
    if(tiles[y][southPortalX]!==T.WATER && tiles[y][southPortalX]!==T.WALL)
      tiles[y][southPortalX]=T.DIRT;
  }
  placeDecor(tiles,floor,H-1,southPortalX,T.FOREST_PORTAL);

  // ---- WEST PORTAL — path leads to Greenfield Pastures ----
  const westPortalY = 16; // aligned with the main east-west road
  tiles[westPortalY][0] = T.GRASS;
  tiles[westPortalY-1][0] = T.GRASS;
  tiles[westPortalY+1][0] = T.GRASS;
  // Short dirt path from town road west to portal
  for(let x=1;x<8;x++) {
    if(tiles[westPortalY][x]!==T.WALL && tiles[westPortalY][x]!==T.WATER)
      tiles[westPortalY][x]=T.DIRT;
  }
  placeDecor(tiles,floor,westPortalY,0,T.FARM_PORTAL);

  return {tiles, floor, W, H, name:'ASHENVEIL'};
}

// ======= GREENFIELD
function makeGreenfieldMap() {
  const W = 70, H = 44;
  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.GRASS));
  const floor  = Array.from({length:H}, ()=>Array(W).fill(T.GRASS));

  function pd(y,x,tile) { placeDecor(tiles,floor,y,x,tile); }

  // Border walls
  for(let y=0;y<H;y++) for(let x=0;x<W;x++)
    if(y===0||y===H-1||x===0||x===W-1) tiles[y][x]=T.WALL;

  // ---- MAIN DIRT LANE — runs east-west through the map ----
  const laneY = 22;
  for(let x=1;x<W-1;x++) tiles[laneY][x]=T.DIRT;
  // North-south branch through farm centre
  for(let y=1;y<H-1;y++) tiles[y][35]=T.DIRT;

  // ---- FARMHOUSE (east side, x=50–62, y=5–14) ----
  for(let y=6;y<=13;y++) for(let x=50;x<=61;x++) tiles[y][x]=T.STONE_FLOOR;
  // Walls
  for(let x=50;x<=61;x++) { tiles[6][x]=T.WALL; tiles[13][x]=T.WALL; }
  for(let y=6;y<=13;y++)  { tiles[y][50]=T.WALL; tiles[y][61]=T.WALL; }
  // Door
  tiles[13][55]=T.STONE_FLOOR; tiles[13][56]=T.STONE_FLOOR;
  // Interior furnishings
  pd(8,52,T.BED); pd(8,54,T.TABLE); pd(8,57,T.BARREL);
  pd(10,52,T.BOOKSHELF); pd(10,59,T.COOKING_FIRE);
  pd(7,58,T.CANDLE); pd(7,52,T.CANDLE);
  // Dirt path to door
  for(let y=14;y<=laneY;y++) tiles[y][55]=T.DIRT;

  // ---- BARN (west side, x=5–18, y=5–16) ----
  for(let y=6;y<=15;y++) for(let x=5;x<=18;x++) tiles[y][x]=T.STONE_FLOOR;
  for(let x=5;x<=18;x++) { tiles[6][x]=T.WALL; tiles[15][x]=T.WALL; }
  for(let y=6;y<=15;y++)  { tiles[y][5]=T.WALL; tiles[y][18]=T.WALL; }
  tiles[15][10]=T.STONE_FLOOR; tiles[15][11]=T.STONE_FLOOR; // barn door
  // Barn interior — hay bales, troughs, animals
  pd(8,7,T.HAY_BALE); pd(8,9,T.HAY_BALE); pd(8,14,T.HAY_BALE); pd(8,16,T.HAY_BALE);
  pd(12,7,T.WATER_TROUGH); pd(12,13,T.WATER_TROUGH);
  pd(10,7,T.ANIMAL_COW); pd(10,14,T.ANIMAL_CHICKEN);
  pd(13,10,T.BARREL); pd(9,16,T.CANDLE); pd(9,7,T.CANDLE);
  // Path barn→lane
  for(let y=16;y<=laneY;y++) tiles[y][11]=T.DIRT;

  // ---- WINDMILL (north-centre, x=32–38, y=2–10) ----
  // Stone base
  for(let y=5;y<=10;y++) for(let x=32;x<=38;x++) tiles[y][x]=T.STONE_FLOOR;
  for(let x=32;x<=38;x++) { tiles[5][x]=T.WALL; tiles[10][x]=T.WALL; }
  for(let y=5;y<=10;y++)  { tiles[y][32]=T.WALL; tiles[y][38]=T.WALL; }
  tiles[10][34]=T.STONE_FLOOR; tiles[10][35]=T.STONE_FLOOR; // door (on lane branch)
  pd(7,35,T.WINDMILL);

  // ---- WHEAT FIELDS (north of lane, left section x=5–28, y=2–18) ----
  // Row crops with soil paths between
  for(let row=0;row<4;row++) {
    const fy = 3 + row * 4;
    for(let x=20;x<=28;x++) pd(fy, x, T.CROP_WHEAT);
    for(let x=20;x<=28;x++) pd(fy+1, x, T.CROP_WHEAT);
  }
  // Row paths between crop bands
  for(let row=0;row<3;row++) {
    const py = 5 + row * 4;
    for(let x=20;x<=28;x++) if(tiles[py][x]===T.GRASS) tiles[py][x]=T.DIRT;
  }

  // ---- TURNIP PATCH (south of lane, x=5–25, y=26–36) ----
  for(let ry=26;ry<=36;ry+=3) {
    for(let x=5;x<=25;x+=2) {
      if(tiles[ry][x]===T.GRASS) pd(ry,x,T.CROP_TURNIP);
    }
    // Soil row
    if(ry+1<=36) for(let x=5;x<=25;x++) if(tiles[ry+1][x]===T.GRASS) tiles[ry+1][x]=T.DIRT;
  }

  // ---- ANIMAL PASTURE (south-east, fenced, x=42–66, y=26–40) ----
  // Fence posts around perimeter
  for(let x=42;x<=66;x+=2) { pd(26,x,T.FENCE_POST); pd(40,x,T.FENCE_POST); }
  for(let y=27;y<=39;y+=2) { pd(y,42,T.FENCE_POST); pd(y,66,T.FENCE_POST); }
  // Roaming animals inside
  pd(30,48,T.ANIMAL_PIG);
  pd(34,55,T.ANIMAL_COW);
  pd(28,60,T.ANIMAL_CHICKEN);
  pd(37,50,T.ANIMAL_PIG);
  pd(32,63,T.ANIMAL_CHICKEN);
  // Water trough in pasture
  pd(33,46,T.WATER_TROUGH);
  // Grass fills interior
  // Gate gap at top of fence (for lane)
  tiles[26][53]=T.GRASS; tiles[26][54]=T.GRASS; // open gate

  // ---- SCARECROWS dotted through fields ----
  pd(7,22,T.SCARECROW); pd(14,25,T.SCARECROW); pd(29,15,T.SCARECROW);

  // ---- WELL near farmhouse ----
  pd(17,55,T.TOWN_WELL);

  // ---- FLOWERS & SCATTER ----
  const flowerSpots=[[3,30],[3,40],[20,3],[20,40],[38,5],[38,25],[40,35],[41,20]];
  flowerSpots.forEach(([fy,fx])=>{ if(tiles[fy]&&tiles[fy][fx]===T.GRASS) pd(fy,fx,T.FLOWER); });

  // Trees lining north and east borders
  for(let x=2;x<=68;x+=5) if(tiles[1][x]===T.GRASS) tiles[1][x]=T.NORMAL_TREE;
  for(let y=2;y<=40;y+=4) if(tiles[y][68]===T.GRASS) tiles[y][68]=T.NORMAL_TREE;

  // ---- FARMER NPCs ----
  pd(laneY-2, 35, T.NPC_FARMER); // near crossroads
  pd(9, 25, T.NPC_FARMER);       // in the wheat fields

  // ---- FARM PORTAL (east wall, y=laneY) → back to Ashenveil ----
  tiles[laneY][W-1]=T.GRASS;
  tiles[laneY-1][W-1]=T.GRASS;
  tiles[laneY+1][W-1]=T.GRASS;
  pd(laneY, W-1, T.FARM_PORTAL);

  // Named NPCs
  const namedNpcs = [
    { x:35, y:laneY-2, name:'Greta',  gender:'f' },
    { x:25, y:9,       name:'Aldous', gender:'m' },
  ];

  return { tiles, floor, W, H, name:'GREENFIELD PASTURES',
           namedNpcs, entryX:W-2, entryY:laneY };
}


// ======= HOUSE INTERIOR MAPS =======
function makeHouseInterior(residentName) {
  const W=14, H=11;
  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.STONE_FLOOR));
  const floor  = Array.from({length:H}, ()=>Array(W).fill(T.STONE_FLOOR));
  function pd(y,x,tile){ placeDecor(tiles,floor,y,x,tile); }

  // Outer walls
  for(let y=0;y<H;y++) for(let x=0;x<W;x++)
    if(y===0||y===H-1||x===0||x===W-1) tiles[y][x]=T.WALL;

  // Dividing wall — bedroom vs living area (vertical)
  for(let y=1;y<=H-2;y++) tiles[y][7]=T.WALL;
  tiles[4][7]=T.STONE_FLOOR; tiles[5][7]=T.STONE_FLOOR; // doorway

  // Floor snapshot
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) floor[y][x]=tiles[y][x];

  // ---- Living area (left, x=1..6) ----
  pd(2,2,T.FIREPLACE);
  pd(4,2,T.SMALL_TABLE); pd(4,3,T.SMALL_TABLE);
  pd(2,5,T.BOOKSHELF);
  pd(6,2,T.BARREL);
  pd(7,5,T.PLANT);
  pd(1,1,T.CANDLE); pd(1,6,T.CANDLE);

  // ---- Bedroom (right, x=8..12) ----
  pd(2,9,T.BED); pd(2,10,T.BED);
  pd(4,12,T.WARDROBE);
  pd(6,9,T.CHEST);
  pd(1,8,T.CANDLE); pd(1,12,T.CANDLE);
  pd(7,11,T.PLANT);

  // Resident-specific flourish
  if(residentName==='Mira'){
    pd(6,4,T.CHEST); // her locket might be here...
    pd(3,5,T.CANDLE);
  } else if(residentName==='Aldric'){
    pd(3,3,T.BOOKSHELF);
    pd(6,5,T.WORKBENCH);
  } else if(residentName==='Elspeth'){
    pd(6,4,T.COOKING_FIRE);
    pd(3,5,T.PLANT);
  } else if(residentName==='Rowan'){
    pd(6,5,T.BARREL);
    pd(3,3,T.NOTICE_BOARD);
  }

  // Exit door in south wall, centre
  pd(H-1, 6, T.EXIT_INTERIOR);

  return {tiles, floor, W, H, isInterior:true,
          name:`${residentName.toUpperCase()}'S HOUSE`,
          entryX:6, entryY:H-2};
}

// ======= BLACKSMITH INTERIOR =======
function makeBlacksmithInterior() {
  const W=16, H=12;
  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.STONE_FLOOR));
  const floor  = Array.from({length:H}, ()=>Array(W).fill(T.STONE_FLOOR));
  function pd(y,x,tile){ placeDecor(tiles,floor,y,x,tile); }

  // Outer walls
  for(let y=0;y<H;y++) for(let x=0;x<W;x++)
    if(y===0||y===H-1||x===0||x===W-1) tiles[y][x]=T.WALL;

  // Dividing wall — forge area (left) vs workshop (right)
  for(let y=1;y<=H-2;y++) tiles[y][8]=T.WALL;
  tiles[5][8]=T.STONE_FLOOR; tiles[6][8]=T.STONE_FLOOR; // doorway between halves

  // Floor snapshot
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) floor[y][x]=tiles[y][x];

  // ---- Forge side (left, x=1..7) ----
  pd(2,2,T.SMELTER);
  pd(2,5,T.SMELTER);
  pd(4,2,T.COOKING_FIRE); // secondary fire pit
  pd(1,1,T.CANDLE); pd(1,6,T.CANDLE);
  pd(6,6,T.BARREL); pd(7,6,T.BARREL); // fuel barrels
  pd(8,2,T.CHEST);                     // ore chest
  pd(9,5,T.BARREL);

  // ---- Workshop side (right, x=9..14) ----
  pd(2,10,T.WORKBENCH);
  pd(2,12,T.WORKBENCH);
  pd(4,10,T.BOOKSHELF);  // smithing reference texts
  pd(4,13,T.CANDLE);
  pd(7,10,T.CHEST);      // finished goods chest
  pd(7,12,T.BARREL);
  pd(9,13,T.PLANT);      // surprisingly, one green thing
  pd(1,14,T.CANDLE);

  // NPC blacksmith spawn
  tiles[5][11] = T.NPC_GUARD; // re-using guard tile for now, named below

  // Exit door
  pd(H-1, 7, T.EXIT_INTERIOR);

  return {tiles, floor, W, H, isInterior:true,
          name:'THE ASHEN FORGE', entryX:7, entryY:H-2};
}

// ======= INN INTERIOR MAP =======
function makeInnInterior() {
  const W=20, H=16;
  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.STONE_FLOOR));
  const floor  = Array.from({length:H}, ()=>Array(W).fill(T.STONE_FLOOR));

  // Outer walls
  for(let y=0;y<H;y++) for(let x=0;x<W;x++)
    if(y===0||y===H-1||x===0||x===W-1) tiles[y][x]=T.WALL;

  // Dividing wall (common room vs lodging)
  for(let x=1;x<=18;x++) tiles[6][x]=T.WALL;
  tiles[6][9]=T.STONE_FLOOR; // doorway

  // Room divider
  for(let y=1;y<=5;y++) tiles[y][10]=T.WALL;

  // Bar counter
  for(let y=8;y<=13;y++) tiles[y][15]=T.WALL;
  tiles[7][14]=T.WALL; tiles[7][15]=T.WALL; tiles[7][16]=T.WALL;
  tiles[14][14]=T.WALL; tiles[14][15]=T.WALL;
  tiles[11][15]=T.STONE_FLOOR; // bar opening

  // ---- Snapshot floor before placing decorations ----
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) floor[y][x]=tiles[y][x];

  // Beds
  placeDecor(tiles,floor,2,3,T.BED); placeDecor(tiles,floor,2,4,T.BED);
  placeDecor(tiles,floor,2,13,T.BED); placeDecor(tiles,floor,2,14,T.BED);
  // Chests
  placeDecor(tiles,floor,4,3,T.CHEST); placeDecor(tiles,floor,4,13,T.CHEST);
  // Room candles
  placeDecor(tiles,floor,1,2,T.CANDLE); placeDecor(tiles,floor,1,8,T.CANDLE);
  placeDecor(tiles,floor,1,12,T.CANDLE); placeDecor(tiles,floor,1,18,T.CANDLE);
  // Bar barrels
  placeDecor(tiles,floor,7,2,T.BARREL); placeDecor(tiles,floor,7,3,T.BARREL);
  placeDecor(tiles,floor,7,17,T.BARREL); placeDecor(tiles,floor,7,18,T.BARREL);
  // Bookshelves
  placeDecor(tiles,floor,10,1,T.BOOKSHELF); placeDecor(tiles,floor,11,1,T.BOOKSHELF);
  // Fireplace
  placeDecor(tiles,floor,12,1,T.COOKING_FIRE);
  // Tables
  placeDecor(tiles,floor,9,4,T.TABLE);  placeDecor(tiles,floor,9,5,T.TABLE);
  placeDecor(tiles,floor,9,9,T.TABLE);  placeDecor(tiles,floor,9,10,T.TABLE);
  placeDecor(tiles,floor,12,4,T.TABLE); placeDecor(tiles,floor,12,5,T.TABLE);
  // Candles on tables
  placeDecor(tiles,floor,8,4,T.CANDLE); placeDecor(tiles,floor,8,9,T.CANDLE);
  // Notice board
  placeDecor(tiles,floor,13,11,T.NOTICE_BOARD);
  // Exit door
  placeDecor(tiles,floor,H-1,9,T.EXIT_INTERIOR);
  // Innkeeper
  tiles[10][17]=T.NPC_INNKEEPER;
  // Inn patrons — seated near the tables
  tiles[9][6]=T.NPC_VILLAGER;   // Oswin
  tiles[12][7]=T.NPC_VILLAGER;  // Thessaly

  return {tiles, floor, W, H, isInterior:true, name:'THE TARNISHED FLAGON'};
}

// ======= DUNGEON SYSTEM =======

// ---- Procedural dungeon generator (BSP rooms + corridors) ----
function makeDungeonMap(config) {
  const { W=60, H=40, name='DUNGEON', minRooms=8, maxRooms=14,
          enemies: enemyTypes=['skeleton','zombie'], seed=Date.now(),
          hasCryptStair=false } = config;
  const rng = makePRNG(seed);

  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.WALL));
  const floor  = Array.from({length:H}, ()=>Array(W).fill(T.WALL));

  // BSP room generation
  const rooms = [];
  function tryPlaceRoom(x1,y1,x2,y2, depth=0) {
    const rw=x2-x1, rh=y2-y1;
    if(rw<8||rh<8||depth>6) return;
    // Decide whether to split or make room
    const makeRoom = depth>=3 || rng()<0.35;
    if(makeRoom) {
      const rx=x1+1+Math.floor(rng()*Math.max(1,rw-8));
      const ry=y1+1+Math.floor(rng()*Math.max(1,rh-8));
      const rw2=5+Math.floor(rng()*Math.min(8,rw-rx+x1-2));
      const rh2=4+Math.floor(rng()*Math.min(6,rh-ry+y1-2));
      if(rx+rw2<x2-1&&ry+rh2<y2-1) {
        rooms.push({x:rx,y:ry,w:rw2,h:rh2,cx:Math.floor(rx+rw2/2),cy:Math.floor(ry+rh2/2)});
      }
      return;
    }
    // Split horizontally or vertically
    if(rw>rh) {
      const mid=x1+4+Math.floor(rng()*(rw-8));
      tryPlaceRoom(x1,y1,mid,y2,depth+1);
      tryPlaceRoom(mid,y1,x2,y2,depth+1);
    } else {
      const mid=y1+4+Math.floor(rng()*(rh-8));
      tryPlaceRoom(x1,y1,x2,mid,depth+1);
      tryPlaceRoom(x1,mid,x2,y2,depth+1);
    }
  }
  tryPlaceRoom(1,1,W-1,H-1);

  // Cap to maxRooms
  while(rooms.length>maxRooms) rooms.splice(Math.floor(rng()*rooms.length),1);
  if(rooms.length<2) { // fallback — place a few rooms manually
    rooms.push({x:3,y:3,w:8,h:6,cx:7,cy:6},{x:20,y:5,w:7,h:6,cx:23,cy:8},{x:40,y:10,w:9,h:7,cx:44,cy:13});
  }

  // Carve rooms into tiles
  rooms.forEach(r=>{
    for(let y=r.y;y<r.y+r.h;y++)
      for(let x=r.x;x<r.x+r.w;x++)
        tiles[y][x]=T.DUNGEON_FLOOR;
  });

  // Connect rooms with L-shaped corridors
  const shuffled=[...rooms].sort(()=>rng()-0.5);
  for(let i=0;i<shuffled.length-1;i++) {
    const a=shuffled[i], b=shuffled[i+1];
    // Horizontal then vertical
    const midX=rng()<0.5?a.cx:b.cx;
    for(let x=Math.min(a.cx,midX);x<=Math.max(a.cx,midX);x++)
      if(y_in_bounds(a.cy,H)) tiles[a.cy][x]=T.DUNGEON_FLOOR;
    for(let y=Math.min(a.cy,b.cy);y<=Math.max(a.cy,b.cy);y++)
      if(x_in_bounds(midX,W)) tiles[y][midX]=T.DUNGEON_FLOOR;
    for(let x=Math.min(midX,b.cx);x<=Math.max(midX,b.cx);x++)
      if(y_in_bounds(b.cy,H)) tiles[b.cy][x]=T.DUNGEON_FLOOR;
  }

  function y_in_bounds(y,H){return y>=0&&y<H;}
  function x_in_bounds(x,W){return x>=0&&x<W;}

  // Snapshot floor
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) floor[y][x]=tiles[y][x];

  // ---- Place features ----
  // Torches on walls near rooms
  rooms.forEach(r=>{
    [[r.y-1,r.x+1],[r.y-1,r.x+r.w-2],[r.y+r.h,r.x+1],[r.y+r.h,r.x+r.w-2]].forEach(([ty,tx])=>{
      if(ty>=0&&ty<H&&tx>=0&&tx<W&&tiles[ty][tx]===T.WALL)
        { floor[ty][tx]=T.DUNGEON_FLOOR; tiles[ty][tx]=T.DUNGEON_TORCH; }
    });
  });

  // Place stair up (entrance) in first room — clear a 3x3 area first
  const entryRoom = rooms[0];
  // Clear the whole entry room to ensure it's walkable
  for(let y=entryRoom.y; y<entryRoom.y+entryRoom.h; y++)
    for(let x=entryRoom.x; x<entryRoom.x+entryRoom.w; x++)
      tiles[y][x] = T.DUNGEON_FLOOR;

  const stairUpX = entryRoom.cx;
  const stairUpY = entryRoom.cy;
  tiles[stairUpY][stairUpX] = T.DUNGEON_STAIR_UP;
  floor[stairUpY][stairUpX] = T.DUNGEON_FLOOR;

  // Spawn point: one tile south of stair, guaranteed floor
  const spawnX = stairUpX;
  const spawnY = stairUpY + 1;
  tiles[spawnY][spawnX] = T.DUNGEON_FLOOR;
  floor[spawnY][spawnX] = T.DUNGEON_FLOOR;

  // Also clear last room fully for exit stair
  const exitRoom = rooms[rooms.length-1];
  for(let y=exitRoom.y; y<exitRoom.y+exitRoom.h; y++)
    for(let x=exitRoom.x; x<exitRoom.x+exitRoom.w; x++)
      tiles[y][x] = T.DUNGEON_FLOOR;

  // Place stair down / crypt stair in last room
  const stairTile = hasCryptStair ? T.CRYPT_STAIR : T.DUNGEON_STAIR_DOWN;
  tiles[exitRoom.cy][exitRoom.cx] = stairTile;
  floor[exitRoom.cy][exitRoom.cx] = T.DUNGEON_FLOOR;

  // Place chests in middle rooms (1–3 chests)
  const chestRooms = rooms.slice(1,-1).sort(()=>rng()-0.5).slice(0,3);
  chestRooms.forEach(r=>{
    const cx=r.x+1+Math.floor(rng()*(r.w-2));
    const cy=r.y+1+Math.floor(rng()*(r.h-2));
    if(tiles[cy][cx]===T.DUNGEON_FLOOR){
      tiles[cy][cx]=T.CHEST; floor[cy][cx]=T.DUNGEON_FLOOR;
    }
  });

  // Place enemies — skeletons and zombies scattered across rooms (skip entry/exit rooms)
  // Also keep a clear radius around stair tiles so player isn't instantly attacked
  const DUNGEON_ENEMY_MAP = {skeleton:T.SKELETON, zombie:T.ZOMBIE};
  const STAIR_TILES = new Set([T.DUNGEON_STAIR_UP, T.DUNGEON_STAIR_DOWN, T.CRYPT_STAIR]);
  const STAIR_CLEAR = 5;
  rooms.slice(1,-1).forEach((r,i)=>{
    const count = 1+Math.floor(rng()*3);
    for(let n=0;n<count;n++){
      let att=0;
      while(att++<20){
        const ex=r.x+1+Math.floor(rng()*(r.w-2));
        const ey=r.y+1+Math.floor(rng()*(r.h-2));
        if(tiles[ey][ex]!==T.DUNGEON_FLOOR) continue;
        // Stay away from stairs
        let nearStair=false;
        for(let dy=-STAIR_CLEAR; dy<=STAIR_CLEAR&&!nearStair; dy++)
          for(let dx=-STAIR_CLEAR; dx<=STAIR_CLEAR&&!nearStair; dx++) {
            const ny=ey+dy, nx=ex+dx;
            if(ny>=0&&ny<H&&nx>=0&&nx<W&&STAIR_TILES.has(tiles[ny][nx])) nearStair=true;
          }
        if(!nearStair){
          const eType=enemyTypes[Math.floor(rng()*enemyTypes.length)];
          tiles[ey][ex]=DUNGEON_ENEMY_MAP[eType]||T.SKELETON;
          break;
        }
      }
    }
  });

  return {tiles, floor, W, H, name, isInterior:true,
          entryX:spawnX, entryY:spawnY};
}

// ---- Ashwood Vale dungeon ----
function makeAshwoodDungeon(seed) {
  return makeDungeonMap({
    W:56, H:38, name:'THE ASHWOOD CRYPTS',
    minRooms:8, maxRooms:12, seed,
    enemies:['skeleton','zombie'],
  });
}

// ---- Iron Peaks dungeon ----
function makeIronPeaksDungeon(seed) {
  return makeDungeonMap({
    W:60, H:42, name:'THE IRON DEPTHS',
    minRooms:10, maxRooms:14, seed,
    enemies:['skeleton','zombie','skeleton'],
  });
}

// ---- Cultist Catacombs (under Forsaken Chapel) ----
function makeCultistCatacombs(seed) {
  return makeDungeonMap({
    W:52, H:36, name:'THE CULTIST CATACOMBS',
    minRooms:9, maxRooms:13, seed: seed||12345,
    enemies:['zombie','skeleton','zombie'],
    hasCryptStair:false,
  });
}

// ---- Dungeon stair tile rendering ----
function drawDungeonStair(ctx, px, py, tileType) {
  const ts=TILE;
  // Stone floor base
  ctx.fillStyle='#1a1420'; ctx.fillRect(px,py,ts,ts);
  // Stair steps
  ctx.strokeStyle = tileType===T.DUNGEON_STAIR_UP ? '#8a7a60' : '#5a4a38';
  ctx.lineWidth=1.5;
  const steps=4;
  for(let i=0;i<steps;i++){
    const frac=(i+1)/(steps+1);
    const sx=px+ts*0.15, ex=px+ts*0.85;
    const sy = tileType===T.DUNGEON_STAIR_UP
      ? py+ts*(0.8-frac*0.5)
      : py+ts*(0.2+frac*0.5);
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,sy); ctx.stroke();
  }
  // Arrow indicator
  ctx.fillStyle = tileType===T.DUNGEON_STAIR_UP ? '#a09070' : '#7a6a50';
  ctx.font=`${ts*0.45}px serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(tileType===T.DUNGEON_STAIR_UP ? '▲' : '▼', px+ts/2, py+ts/2);
}

function drawDungeonTorch(ctx, px, py, now) {
  const ts=TILE;
  ctx.fillStyle='#100c08'; ctx.fillRect(px,py,ts,ts);
  // Bracket
  ctx.fillStyle='#4a3a28';
  ctx.fillRect(px+ts*0.35,py+ts*0.3,ts*0.3,ts*0.45);
  // Flame flicker
  const flicker=Math.sin(now*0.004+px*0.1)*0.15;
  const grad=ctx.createRadialGradient(px+ts/2,py+ts*0.28,1,px+ts/2,py+ts*0.28,ts*0.28+flicker*ts);
  grad.addColorStop(0,'rgba(255,220,80,0.95)');
  grad.addColorStop(0.4,'rgba(220,100,20,0.7)');
  grad.addColorStop(1,'rgba(180,60,0,0)');
  ctx.fillStyle=grad; ctx.beginPath();
  ctx.ellipse(px+ts/2,py+ts*0.28,ts*0.18,ts*0.22+flicker*ts*0.5,0,0,Math.PI*2);
  ctx.fill();
}

function drawZombie(ctx, px, py, e) {
  const ts=TILE;
  const wobble = Math.sin(Date.now()*0.002+e.id)*2;
  // Body — decayed green-grey
  ctx.fillStyle='#2a3a1a'; ctx.fillRect(px+ts*0.2,py+ts*0.35,ts*0.6,ts*0.55);
  // Head
  ctx.fillStyle='#3a4a28';
  ctx.beginPath(); ctx.arc(px+ts/2+wobble,py+ts*0.28,ts*0.18,0,Math.PI*2); ctx.fill();
  // Glowing eyes
  ctx.fillStyle='rgba(80,200,40,0.9)';
  ctx.beginPath(); ctx.arc(px+ts*0.42+wobble,py+ts*0.26,2.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+ts*0.58+wobble,py+ts*0.26,2.5,0,Math.PI*2); ctx.fill();
  // Arms reaching forward
  ctx.strokeStyle='#2a3a1a'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(px+ts*0.2,py+ts*0.45); ctx.lineTo(px+ts*0.05,py+ts*0.35+wobble); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+ts*0.8,py+ts*0.45); ctx.lineTo(px+ts*0.95,py+ts*0.35+wobble); ctx.stroke();
  // Flash
  if(e.flashTimer>0){ ctx.fillStyle=`rgba(255,255,255,${e.flashTimer*0.5})`; ctx.fillRect(px,py,ts,ts); }
}

// ---- Dungeon entrance placement in overworld zones ----
function placeDungeonEntrance(tiles, W, H, rng, stairTile) {
  // Find a clear floor spot away from edges and exits
  for(let att=0;att<200;att++){
    const x=8+Math.floor(rng()*(W-16));
    const y=8+Math.floor(rng()*(H-16));
    if(tiles[y][x]===T.GRASS||tiles[y][x]===T.DARK_GRASS||tiles[y][x]===T.DIRT){
      // Don't block paths
      let clear=true;
      for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
        const t=tiles[y+dy]?.[x+dx];
        if(t===T.EXIT||t===T.EXIT_RETURN||t===T.SMELTER||t===T.SHOP) { clear=false; break; }
      }
      if(clear){ tiles[y][x]=stairTile; return {x,y}; }
    }
  }
  return null;
}

// ---- Dungeon loot table ----
const DUNGEON_LOOT = [
  {id:'iron_sword',    w:4},
  {id:'iron_helm',     w:4},
  {id:'iron_plate',    w:3},
  {id:'iron_legs',     w:3},
  {id:'iron_shield',   w:3},
  {id:'bronze_sword',  w:6},
  {id:'bronze_helm',   w:6},
  {id:'bronze_plate',  w:5},
  {id:'bronze_legs',   w:5},
  {id:'wheat',         w:6},
  {id:'turnip',        w:6},
  {id:'egg',           w:4},
  {id:'bones',         w:10},
  {id:'coins',         w:8},
  {id:'goblin_hide',   w:7},
  {id:'iron_arrows',   w:5},
  {id:'bronze_arrows', w:7},
  {id:'steel_sword',   w:1},
  {id:'mithril_sword', w:1},
];

function rollDungeonLoot(rng) {
  const total = DUNGEON_LOOT.reduce((s,e)=>s+e.w,0);
  let r = rng()*total;
  for(const entry of DUNGEON_LOOT){ r-=entry.w; if(r<=0) return entry.id; }
  return 'bones';
}

// ======= THE FORSAKEN CHAPEL =======
function makeChapelMap() {
  const W=44, H=32;
  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.DUNGEON_FLOOR));
  const floor  = Array.from({length:H}, ()=>Array(W).fill(T.DUNGEON_FLOOR));

  // Outer walls
  for(let y=0;y<H;y++) for(let x=0;x<W;x++)
    if(y===0||y===H-1||x===0||x===W-1) tiles[y][x]=T.WALL;

  // ---- NAVE (main hall, centre) ----
  // The nave runs north-south: x=8..35, y=2..22
  for(let y=2;y<=22;y++) for(let x=8;x<=35;x++) tiles[y][x]=T.STONE_FLOOR;

  // ---- TRANSEPTS (side wings) ----
  // West transept: x=2..8, y=8..16
  for(let y=8;y<=16;y++) for(let x=2;x<=8;x++) tiles[y][x]=T.STONE_FLOOR;
  // East transept: x=35..42, y=8..16
  for(let y=8;y<=16;y++) for(let x=35;x<=42;x++) tiles[y][x]=T.STONE_FLOOR;

  // ---- APSE / SANCTUARY (north end behind altar) ----
  for(let y=2;y<=7;y++) for(let x=12;x<=31;x++) tiles[y][x]=T.STONE_FLOOR;

  // ---- WALLS around nave perimeter ----
  for(let x=8;x<=35;x++) { tiles[2][x]=T.WALL; }            // north wall
  for(let y=2;y<=22;y++) { tiles[y][8]=T.WALL; tiles[y][35]=T.WALL; }
  tiles[22][8]=T.WALL; tiles[22][35]=T.WALL;
  // Transept outer walls
  for(let y=8;y<=16;y++) { tiles[y][2]=T.WALL; tiles[y][42]=T.WALL; }
  for(let x=2;x<=8;x++)  { tiles[8][x]=T.WALL; tiles[16][x]=T.WALL; }
  for(let x=35;x<=42;x++){ tiles[8][x]=T.WALL; tiles[16][x]=T.WALL; }
  // Transept doorways into nave (open 2 tiles)
  tiles[11][8]=T.STONE_FLOOR; tiles[12][8]=T.STONE_FLOOR;
  tiles[11][35]=T.STONE_FLOOR; tiles[12][35]=T.STONE_FLOOR;
  // Apse arch wall
  for(let x=8;x<=35;x++) tiles[7][x]=T.WALL;
  tiles[7][19]=T.STONE_FLOOR; tiles[7][20]=T.STONE_FLOOR; // arch opening

  // ---- COLUMNS down the nave ----
  [[5,11],[5,17],[5,23],[5,29],
   [10,11],[10,17],[10,23],[10,29],
   [15,11],[15,17],[15,23],[15,29],
   [20,11],[20,17],[20,23],[20,29]
  ].forEach(([py,px])=>{ tiles[py][px]=T.PILLAR; });

  // ---- SOUTH PORCH / ENTRANCE ----
  for(let y=22;y<=28;y++) for(let x=16;x<=27;x++) tiles[y][x]=T.STONE_FLOOR;
  for(let x=16;x<=27;x++) tiles[28][x]=T.WALL;
  for(let y=22;y<=28;y++) { tiles[y][16]=T.WALL; tiles[y][27]=T.WALL; }
  // Porch door opening (exit back to Ashenveil)
  tiles[28][21]=T.STONE_FLOOR; tiles[28][22]=T.STONE_FLOOR;
  // Wall between nave and porch except entrance gap
  for(let x=16;x<=27;x++) if(x<20||x>23) tiles[22][x]=T.WALL;

  // ---- FLOOR RUNES (carved into nave floor) ----
  // Central aisle
  [[9,21],[12,21],[15,21],[18,21],[21,21],
   [9,22],[12,22],[15,22],[18,22]
  ].forEach(([ry,rx])=>{ tiles[ry][rx]=T.CHAPEL_RUNE; });

  // ---- SNAPSHOT FLOOR ----
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) floor[y][x]=tiles[y][x];

  // ---- ALTAR (north apse, centred) ----
  placeDecor(tiles,floor,4,21,T.ALTAR);

  // ---- LORE OBJECTS ----
  // Bookshelves in transepts (heretical texts)
  placeDecor(tiles,floor,10,3,T.BOOKSHELF);
  placeDecor(tiles,floor,13,3,T.BOOKSHELF);
  placeDecor(tiles,floor,10,41,T.BOOKSHELF);
  placeDecor(tiles,floor,13,41,T.BOOKSHELF);
  // Chests in apse corners
  placeDecor(tiles,floor,3,10,T.CHEST);
  placeDecor(tiles,floor,3,33,T.CHEST);
  // Candles throughout
  [[4,13],[4,16],[4,27],[4,30],
   [8,10],[8,33],[21,10],[21,33]
  ].forEach(([cy,cx])=>placeDecor(tiles,floor,cy,cx,T.CANDLE));
  // Barrels in porch (abandoned supplies)
  placeDecor(tiles,floor,25,18,T.BARREL);
  placeDecor(tiles,floor,25,25,T.BARREL);
  placeDecor(tiles,floor,26,18,T.BARREL);

  // ---- HIDDEN TOMB (west transept) ----
  // A grave slab concealing stairs to the Cultist Catacombs
  placeDecor(tiles,floor,14,6,T.GRAVE);
  placeDecor(tiles,floor,13,5,T.CANDLE);  // candle hint

  // ---- EXIT (south porch door back to Ashenveil) ----
  placeDecor(tiles,floor,28,21,T.EXIT_INTERIOR);

  return {tiles, floor, W, H, isInterior:true, name:'THE FORSAKEN CHAPEL'};
}

// The hidden crypt stair is placed in the west transept of the chapel.
// The player sees it when entering — one GRAVE tile hides a CRYPT_STAIR beneath.
// Interacting with it reveals the stairs.
function revealCryptStair() {
  if(!currentMap || currentMap.name !== 'THE FORSAKEN CHAPEL') return;
  const cx=6, cy=14; // west transept corner grave position
  currentMap.tiles[cy][cx] = T.CRYPT_STAIR;
  currentMap.floor[cy][cx]  = T.DUNGEON_FLOOR;
  log('⚰ You move the tomb... Stone steps descend into darkness.', 'info');
  questFlags.crypt_stair_revealed = true;
}

// Chapel lore texts
const CHAPEL_RUNE_TEXTS = [
  ['The Rite of Unmaking', [
    'In a tongue older than Ashenveil, the stones read:',
    '"When the seventh night turns, the veil thins."',
    '"Blood calls blood. The cycle does not end."',
    '"Grimtide is not a day — it is a door."',
  ]],
  ['An Offering Circle', [
    'Ash and old wax ring the symbol.',
    'Whatever rite was performed here has been completed.',
    'The air smells faintly of copper.',
  ]],
  ['The Warden\'s Mark', [
    'This rune matches the crest on the Hooded Figure\'s cloak.',
    'Below it, scratched hastily: "The key was never meant for men."',
  ]],
  ['A Warning', [
    'Scratched over the carved symbol in common tongue:',
    '"Turn back. It watches from the water."',
    '"Do not come on Grimtide."',
  ]],
];
let runeIndex = 0;

function readChapelRune(x, y) {
  SFX.rune();
  const [title, lines] = CHAPEL_RUNE_TEXTS[runeIndex % CHAPEL_RUNE_TEXTS.length];
  runeIndex++;
  // Set clue flag if relevant rune
  if(title.includes('Warden')) questFlags.clue_chapel_rune = true;
  showReadPanel(title, lines, null);
}

function examineAltar(x, y) {
  SFX.altar();
  questFlags.clue_chapel_altar = true;
  const isDark = gameTime > 0.5 || gameTime < 0.2;
  const lines = isDark
    ? [
        'The altar is slick with something dark. Candles burned to their last inch.',
        'A iron bowl at the centre holds ash and a single black feather.',
        'Carved into the face: the same rune as the chapel floor — and below it,',
        '"The Ashen Key opens what the tide conceals."',
        '✦ Clue found — something waits beneath Ashenveil.',
      ]
    : [
        'The altar is cold. In daylight, the dried stains look older than Ashenveil itself.',
        'The iron bowl is empty. Candles, unlit.',
        'Carved into the face: a circle and a vertical line — the same mark from Vayne\'s patrol log.',
        'This place was in use recently.',
      ];
  showReadPanel('Desecrated Altar', lines, null);
}


// When entering a building we push the current world state onto a stack,
// load the interior, and pop back out when stepping on EXIT_INTERIOR.
let interiorStack = []; // [{map, enemies, npcs, playerPos, zoneIndex, zoneName}]

function enterInterior(makeMapFn, entryName) {
  if(zoneTransitioning) return;
  zoneTransitioning = true;

  const flash = document.getElementById('zone-flash');
  flash.style.transition='opacity 0.3s';
  flash.style.opacity='1';

  setTimeout(()=>{
    // Save current world state
    interiorStack.push({
      map: currentMap,
      enemies: enemies.slice(),
      npcs: npcs.slice(),
      pos: {x:playerPos.x, y:playerPos.y},
      zoneIndex,
      zoneName: document.getElementById('zone-name').textContent,
    });

    // Load interior
    groundBags = []; // clear dropped bags when entering/leaving interiors
    currentMap = makeMapFn();
    minimapDirty = true; _dirtCache = null;
    Weather.forceChange();
    Music.onZoneChange();
    // Remember the portal entry point for respawn (outdoor position before entering)
    if(!currentMap || !currentMap.isInterior) lastPortalZone = zoneIndex;
    Fireflies.init();
    enemies = [];
    spawnNpcsFromMap();
    spawnEnemiesFromMap();

    // Use dungeon-defined entry point if available, otherwise find safe spot
    let spawnX, spawnY;
    if(currentMap.entryX != null && currentMap.entryY != null) {
      spawnX = currentMap.entryX;
      spawnY = currentMap.entryY;
    } else {
      spawnX = Math.floor(currentMap.W/2);
      spawnY = currentMap.H-3;
    }
    const spawn = findSafeSpawn(spawnX, spawnY);
    playerPos = {x:spawn.x, y:spawn.y};
    playerReal = {x:spawn.x, y:spawn.y};
    playerPath = []; playerMoving = false;

    // Snap camera
    camera.x = Math.max(0, spawn.x*TILE - canvas.width/2);
    camera.y = Math.max(0, spawn.y*TILE - canvas.height/2);

    document.getElementById('zone-name').textContent = currentMap.name || entryName;
    log(`You step inside ${currentMap.name || entryName}.`, 'info');

    flash.style.opacity='0';
    setTimeout(()=>{ zoneTransitioning=false; }, 400);
  }, 320);
}

function exitInterior() {
  if(zoneTransitioning || interiorStack.length===0) return;
  zoneTransitioning = true;

  const flash = document.getElementById('zone-flash');
  flash.style.transition='opacity 0.3s';
  flash.style.opacity='1';

  setTimeout(()=>{
    const saved = interiorStack.pop();
    currentMap = saved.map;
    enemies = saved.enemies;
    npcs = saved.npcs;
    zoneIndex = saved.zoneIndex;
    minimapDirty = true; _dirtCache = null;
    Weather.forceChange();
    Music.onZoneChange();
    _chapelCultistsActive = false; // reset so re-entry works cleanly

    // Return player just outside the door they came from.
    // If they entered via a south-edge portal (y === map height-1), step north.
    // Otherwise step south (default — inn doors, dungeon stairs, wizard tower, etc.)
    const entryOnSouthEdge = saved.pos.y >= saved.map.H - 1;
    const spawnY = entryOnSouthEdge ? saved.pos.y - 1 : saved.pos.y + 1;
    playerPos = {x:saved.pos.x, y:spawnY};
    playerReal = {x:playerPos.x, y:playerPos.y};
    playerPath = []; playerMoving = false;

    camera.x = Math.max(0, playerPos.x*TILE - canvas.width/2);
    camera.y = Math.max(0, playerPos.y*TILE - canvas.height/2);

    document.getElementById('zone-name').textContent = saved.zoneName;
    log('You step back outside.', 'info');

    flash.style.opacity='0';
    setTimeout(()=>{ zoneTransitioning=false; }, 400);
  }, 320);
}
const NPC_DEFS = {
  [T.NPC_GUARD]:     { name:'Town Guard',  letter:'G', bg:'#1a2a3a', col:'#4a7aaa', patrolRadius:6,  speed:0.8 },
  [T.NPC_MERCHANT]:  { name:'Merchant',    letter:'M', bg:'#2a1a0a', col:'#c8922a', patrolRadius:3,  speed:0.6 },
  [T.NPC_VILLAGER]:  { name:'Villager',    letter:'V', bg:'#1e1a16', col:'#8a7a68', patrolRadius:5,  speed:0.7 },
  [T.NPC_INNKEEPER]: { name:'Innkeeper',   letter:'I', bg:'#2a1208', col:'#a06030', patrolRadius:2,  speed:0.5 },
  [T.NPC_WIZARD]:    { name:'Aldermast',   letter:'W', bg:'#0d0820', col:'#a060e0', patrolRadius:1,  speed:0.3 },
  [T.NPC_FARMER]:    { name:'Farmer',      letter:'F', bg:'#141a0a', col:'#7aaa4a', patrolRadius:4,  speed:0.5 },
  // Animals — wander freely, no dialogue
  [T.ANIMAL_CHICKEN]:{ name:'Chicken', letter:'🐔', bg:'#2a2010', col:'#f0e060', patrolRadius:5, speed:0.5, isAnimal:true },
  [T.ANIMAL_PIG]:    { name:'Pig',     letter:'🐷', bg:'#2a1818', col:'#e09080', patrolRadius:4, speed:0.4, isAnimal:true },
  [T.ANIMAL_COW]:    { name:'Cow',     letter:'🐄', bg:'#1a1a18', col:'#d0c8a0', patrolRadius:6, speed:0.35,isAnimal:true },
};

// Named NPC pool — keyed by spawn tile position "y,x"
// Each entry overrides def.name, def.letter, and optionally dialogue
const NAMED_NPCS = {
  // Guards (Ashenveil world map)
  '11,10': { name:'Vayne',    gender:'m', title:'Corporal Vayne',   col:'#5a8aba', letter:'V' },
  '11,26': { name:'Sera',     gender:'f', title:'Guard Sera',       col:'#7a9aaa', letter:'S' },
  '16,30': { name:'Edwyn',    gender:'m', title:'Guard Edwyn',      col:'#6a8aaa', letter:'E' },
  // Merchant
  '18,15': { name:'Dorin',    gender:'m', title:'Dorin the Trader', col:'#d8a040', letter:'D' },
  // Villagers
  '6,35':  { name:'Mira',     gender:'f', title:'Mira',             col:'#a09080', letter:'M' },
  '6,42':  { name:'Aldric',   gender:'m', title:'Aldric',           col:'#908070', letter:'A' },
  '32,4':  { name:'Elspeth',  gender:'f', title:'Elspeth',          col:'#b08878', letter:'E' },
  '32,12': { name:'Rowan',    gender:'m', title:'Rowan',            col:'#887868', letter:'R' },
  // Innkeeper — inn interior map
  'inn:10,17': { name:'Bram',     gender:'m', title:'Bram Hollowtap', col:'#b07040', letter:'B' },
  // Blacksmith interior
  'forge:5,11': { name:'Grimward', gender:'m', title:'Grimward the Smith', col:'#8a6040', letter:'G' },
  // Inn patrons — inn interior map
  'inn:9,6':   { name:'Oswin',    gender:'m', title:'Oswin',          col:'#9a8878', letter:'O' },
  'inn:12,7':  { name:'Thessaly', gender:'f', title:'Thessaly',       col:'#a08898', letter:'T' },
  // Greenfield Pastures farmers
  'farm:20,35': { name:'Greta',   gender:'f', title:'Greta',          col:'#7aaa4a', letter:'G' },
  'farm:9,25':  { name:'Aldous',  gender:'m', title:'Aldous',         col:'#6a9a3a', letter:'A' },
  // Old Bertram — homestead quest giver (west of inn cobble path)
  '14,6': { name:'Bertram', gender:'m', title:'Old Bertram', col:'#9a7850', letter:'B' },
};

// Per-v// unique rumour lines (keyed by name)
// Named villager rumours — static fallback used when no dynamic greet applies
// These are the "first impression" lines; getDynamicGreet overrides them with context
const VILLAGER_RUMOURS = {
  Mira:     "I lost a silver locket near the docks last week. If you find it, there's a reward in it for you.",
  Aldric:   "My leg still aches from the wolf bite I got in the Ashwood. Healer says it'll pass. I have my doubts.",
  Elspeth:  "Don't drink the well water after dark. I don't care what anyone says. Something's wrong with it.",
  Rowan:    "I saw a light out on the water three nights past. No boat that I know of. Gone before I could look twice.",
  Oswin:    "Been stuck here three days waiting on a caravan that hasn't shown. Bram's ale is good at least. Too good, maybe.",
  Greta:    "Best farm west of Ashenveil — only farm west of Ashenveil, but the principle stands. The animals need feeding, the crops need tending. It's good work.",
  Aldous:   "I've been working the wheat since I was twelve. Thirty years now. The fields know me better than any person in that town does.",
  Grimward: "If you've got ore, I can smelt it. If you want gear, I've got stock. Just don't touch the cooling rack.",
  Thessaly: "I came to Ashenveil to find someone. Asked around. Nobody talks much. Maybe you know something — person in a dark cloak, never shows their face?",
  Bertram:  "I had a homestead once. Fine land, good soil. Haven't been back in years — gave the sigil to whoever needed it more. Maybe that's you.",
};

// ======= HOMESTEAD MAP =======
function makeHomeMap() {
  const W = 30, H = 24;
  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.GRASS));
  const floor  = Array.from({length:H}, ()=>Array(W).fill(T.GRASS));

  // Border fence
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    if(y===0||y===H-1||x===0||x===W-1) tiles[y][x]=T.FENCE;
  }

  // Small cabin top-left area (3×2)
  tiles[2][2]=T.ROOF_L; tiles[2][3]=T.ROOF_CHIMNEY; tiles[2][4]=T.ROOF_R;
  tiles[3][2]=T.BWALL_WIN; tiles[3][3]=T.BWALL_DOOR; tiles[3][4]=T.BWALL_WIN;
  for(let fy=1;fy<=4;fy++) for(let fx=1;fx<=5;fx++) {
    if(tiles[fy][fx]===T.GRASS) tiles[fy][fx]=T.STONE_FLOOR;
  }

  // Dirt path from cabin to farm area
  for(let y=4;y<=8;y++) tiles[y][4]=T.DIRT;
  for(let x=4;x<=8;x++) tiles[8][x]=T.DIRT;

  // Farmable area — 10×8 patch of dirt (right side of map)
  for(let y=3;y<=12;y++) for(let x=8;x<=22;x++) tiles[y][x]=T.DIRT;

  // Well (left of farm)
  tiles[6][6]=T.TOWN_WELL;

  // Trees along south and east edges for atmosphere
  [[14,2],[15,4],[16,3],[14,24],[15,25],[16,24],
   [20,5],[21,6],[20,8],[22,14],[21,16],[22,18],
   [18,22],[19,24],[20,22]
  ].forEach(([y,x])=>{ if(x>0&&x<W-1&&y>0&&y<H-1) tiles[y][x]=T.NORMAL_TREE; });

  // Flowers near fence
  [[13,4],[13,6],[17,6],[13,24],[17,24]
  ].forEach(([y,x])=>{ if(x>0&&x<W-1&&y>0&&y<H-1&&tiles[y][x]===T.GRASS) tiles[y][x]=T.FLOWER; });

  // Snapshot floor
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) floor[y][x]=tiles[y][x];

  // Place well and candle as decor after floor snapshot
  placeDecor(tiles,floor,6,6,T.TOWN_WELL);
  placeDecor(tiles,floor,4,2,T.CANDLE);
  placeDecor(tiles,floor,4,5,T.BARREL);

  // Exit back out (south wall centre)
  placeDecor(tiles,floor,H-1,Math.floor(W/2),T.EXIT_INTERIOR);

  // Restore any saved farm plots onto the map
  if(state.farmPlots) {
    for(const [key, plot] of Object.entries(state.farmPlots)) {
      const [px,py] = key.split(',').map(Number);
      if(py>=0&&py<H&&px>=0&&px<W) {
        if(plot.state==='tilled') {
          tiles[py][px]=T.TILLED_SOIL;
          floor[py][px]=T.DIRT;
        } else if(plot.state==='planted') {
          const now=Date.now();
          if(now - plot.plantedAt >= plot.growTime) {
            tiles[py][px]=plot.cropTile;
          } else if(now - plot.plantedAt >= plot.growTime/2) {
            tiles[py][px]=T.CROP_GROWING;
          } else {
            tiles[py][px]=T.SEEDLING;
          }
          floor[py][px]=T.DIRT;
        }
      }
    }
  }

  return {tiles, floor, W, H, isInterior:true, name:'YOUR HOMESTEAD', entryX:4, entryY:H-2};
}

// ======= HOME CABIN INTERIOR =======
function makeHomeCabinInterior() {
  const W=9, H=7;
  const tiles = Array.from({length:H}, ()=>Array(W).fill(T.STONE_FLOOR));
  const floor  = Array.from({length:H}, ()=>Array(W).fill(T.STONE_FLOOR));

  // Outer walls
  for(let y=0;y<H;y++) for(let x=0;x<W;x++)
    if(y===0||y===H-1||x===0||x===W-1) tiles[y][x]=T.WALL;

  // Floor snapshot
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) floor[y][x]=tiles[y][x];

  // Bed — use saved position if available, else default (2,2)
  const bx = state.homeBed?.x ?? 2;
  const by = state.homeBed?.y ?? 2;
  placeDecor(tiles, floor, by, bx, T.BED);

  // Exit in south wall centre
  placeDecor(tiles, floor, H-1, Math.floor(W/2), T.EXIT_INTERIOR);

  return {tiles, floor, W, H, isInterior:true, name:'YOUR CABIN',
          entryX:Math.floor(W/2), entryY:H-2};
}

// Periodic tick that checks if planted crops in homestead have finished growing
let _homeGrowthTickId = null;
function startHomeGrowthTick() {
  if(_homeGrowthTickId) return;
  _homeGrowthTickId = setInterval(()=>{
    if(!state.farmPlots) return;
    let changed = false;
    for(const [key, plot] of Object.entries(state.farmPlots)) {
      if(plot.state !== 'planted') continue;
      const now = Date.now();
      if(now - plot.plantedAt < plot.growTime) continue;
      // Crop is mature — update the live map tile if we're currently in the homestead
      if(currentMap && currentMap.name === 'YOUR HOMESTEAD') {
        const [px,py] = key.split(',').map(Number);
        if(py>=0&&py<currentMap.H&&px>=0&&px<currentMap.W) {
          currentMap.tiles[py][px] = plot.cropTile;
          minimapDirty = true;
          changed = true;
        }
      }
    }
    if(changed) minimapDirty = true;
  }, 10000); // check every 10 seconds
}

