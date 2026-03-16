// ======= NPC DIALOGUE DATA =======
// Generic villager lines — base pool, extended dynamically
const VILLAGER_LINES_BASE = [
  "Strange times... the eastern roads grow more dangerous each passing season.",
  "They say the Iron Peaks are haunted. I wouldn't go near them.",
  "My cousin vanished in the Cursed Marshes three moons ago. No trace.",
  "If you're hunting, watch your back. Wolves have been bold lately.",
  "Ashenveil's seen better days, but at least we have strong walls.",
  "The well water tastes odd since the rains. I blame the bogs to the east.",
  "I heard a merchant came through selling mithril ore for a song. Gone by dawn.",
  "Mind your pockets in the market. Fingers are quick around here.",
];

function getVillagerLines() {
  const lines = [...VILLAGER_LINES_BASE];
  const qf = questFlags;
  const w  = Weather.current;
  // Quest-reactive lines that spread through the town
  if(qf.chapel_visited)
    lines.push("Someone went into the Forsaken Chapel this week. Haven't seen them since. You hear things from that place at night.");
  if(qf.ashen_seal_accepted && !qf.ashen_seal_returned)
    lines.push("Word is someone's heading into the cultist tunnels. Either very brave or very foolish. Probably both.");
  if(qf.ashen_seal_returned)
    lines.push("Did you hear? Someone cleared out the Cultist Catacombs. First time in twenty years. The south road feels safer already.");
  if(qf.mystery_met)
    lines.push("The hooded figure at the docks — I saw them too, before. Never found out who it was. Glad someone's looking into it.");
  if(qf.mystery_key_given)
    lines.push("The old mystery of the docks — solved, they say. Always wondered what that figure was about.");
  if(qf.constellation_done)
    lines.push("Four stars reappeared in the sky the other night. Just blinked back on. The old folk say that's a good omen. About time we had one.");
  if(qf.aldermast_met)
    lines.push("The wizard in the Spire — Aldermast — actually spoke to someone this week. He hasn't left that tower in years. Must be something important.");
  // Weather reactive
  if(w === Weather.HEAVY_RAIN)
    lines.push("This rain won't let up. The south road will flood if it keeps on. Happened ten years ago — boats in the market square.");
  if(w === Weather.FOG)
    lines.push("Fog this thick, you can't see the chapel from the square. I don't like it. Things move in this kind of fog.");
  if(w === Weather.SNOW || w === Weather.SNOWSTORM)
    lines.push("Snow in Ashenveil. Haven't seen this since the old winter. The children love it. The traders do not.");
  return lines;
}

// VILLAGER_LINES for backwards compatibility
const VILLAGER_LINES = VILLAGER_LINES_BASE;

const NPC_DIALOGUE = {
  [T.NPC_GUARD]: {
    greet: [
      "Halt! State your business.",
      "Move along, traveller.",
      "Keep your weapons sheathed inside the walls.",
      "I've got my eye on you.",
    ],
    lines: [
      ["On duty, are you?",     "Always. Ashenveil doesn't sleep, and neither do I. Goblins have been pressing closer to the walls — three sightings this week alone."],
      ["Anything I should know?","Avoid the eastern zones at night. The creatures grow bolder in the dark, and the guard patrols don't extend past the first portal."],
      ["Seen anything strange?", "A hooded figure was spotted near the docks last night. Didn't respond when hailed. Slipped into the fog before we could question them."],
    ],
  },
  [T.NPC_VILLAGER]: {
    get greet() { return getVillagerLines(); },
    lines: [
      ["Tell me about Ashenveil.", "It's a rough place, but it's home. The market runs every day, the inn's warm, and the Grimward family keeps the forge burning. That's enough for most of us."],
      ["How are things?",          "Quiet. Too quiet. The caravans from the west haven't come in two weeks. Something's blocking the pass, but nobody dares find out what."],
    ],
  },
  [T.NPC_INNKEEPER]: {
    greet: [
      "Welcome to the Tarnished Flagon! Best — and only — inn in Ashenveil.",
      "Back again? The ale's still cold and the stew's still hot.",
      "Settle in, rest your feet. You look like you've been through it.",
      "We've got five brews on tap tonight. Don't let me down.",
    ],
    lines: [
      ["How's business?",          "Can't complain. Adventurers like yourself keep the coin flowing. Lost three regulars last month to the marshes though. Pour one out, as they say."],
      ["Any news passing through?", "A merchant came through yesterday. Said the Obsidian Depths are moving — literally. The tunnels shift overnight. Strange magic, that."],
      ["What's your best brew?",    "The Ashenveil Mead. Local honey, aged two seasons in oak barrels. Costs a bit more, but nothing else like it in the region. Worth every coin."],
      ["Tell me about the rooms.",  "Two rooms upstairs, straw beds but clean linen. Sleep on either one — no charge for resting. My policy: a rested adventurer is a living one."],
    ],
    hasTrade: true,
  },
  [T.NPC_MERCHANT]: {
    greet: [
      "Ahh, a customer! Come, come — finest wares in the region.",
      "Looking to buy? Sell? I deal in both.",
      "You have coin, I have goods. Let's do business.",
      "Everything at fair prices. Well... fair to me, at least. Ha!",
    ],
    lines: [
      ["Where do you get your stock?", "I travel the zones — dangerous work, but the margins are good. Found a chest of goblin-looted gear last week. Cleaned it up, marked it up, here we are."],
      ["Any rare items?",              "Not today. But if you bring me interesting materials — ores, rare hides — I'll give you a fair price. Better than leaving them to rot in your pack."],
    ],
    hasTrade: true,
  },
  [T.NPC_FARMER]: {
    greet: [
      "Good day! Mind the mud — it's been wet.",
      "Best farm in the valley. Only farm in the valley, but still.",
      "Have a look around. Don't spook the animals.",
      "Lots of work to be done. Always is.",
    ],
    lines: [
      ["What do you grow here?",     "Wheat mostly — sells well in Ashenveil. Turnips too. Not glamorous, but people eat. The animals are for meat and eggs, though I grow fond of the beasts. Don't tell anyone."],
      ["How did this farm start?",   "My grandmother cleared this land herself. Three axes and a bad temper, she always said. I've kept it going since. Ashenveil folk forget we're here, but their bread doesn't forget us."],
      ["Any trouble out here?",      "The wolves come down from the Ashwood at night. Lost two hens last season. Put up better fencing but they still find a way. Nights on Grimtide are the worst — something else moves out here then."],
      ["Anything need doing?",       "Always. Animals wander, fences break, weather turns. If you're handy and looking for work, the land provides. But it doesn't provide for free."],
    ],
  },
  [T.NPC_WIZARD]: {
    greet: [
      "Hmm? A visitor? It has been... some time.",
      "Don't touch anything. Several of those items are catastrophically unstable.",
      "You've climbed a long way. Most don't bother. I wonder what you want.",
      "The tower remembers every soul that has ascended its steps. Even yours.",
    ],
    lines: [
      ["Who are you?",           "Aldermast. Once court wizard to the Grimward kings, before the court ceased to exist. Now I am simply... a custodian of what they left behind. And what they left behind is considerable."],
      ["What is this place?",    "The Aetheric Spire. Seven hundred years old and still standing, though I'll admit the lower floors are more 'rubble' than 'architecture' at this point. I've been meaning to repair them. For about four centuries."],
      ["What do you study?",     "The boundary between the seen and unseen world. The Whisperwood below is a membrane — thin, fraying. The Shadow Walkers are not creatures. They are impressions. Echoes of something that passed through long ago and left stains."],
      ["Do you know of the Crypts?", "The Cultist Catacombs. Yes. They were sealed by my predecessor for good reason. Whatever ritual they were performing in those depths, it was not finished. I would advise against finishing it for them."],
      ["Can you teach me?",      "Perhaps. Return when you've proven yourself against the dangers of the Reach. I don't invest in those who get themselves killed on the way to my door. Come back stronger, and we shall talk terms."],
    ],
    wizardDialogue: true,
  },
};

// Per-NPC line overrides — keyed "NpcName|prompt", value replaces the shared reply
// Used for guards Sera and Edwyn who have their own reaction to the docks question
const NPC_LINE_OVERRIDES = {
  'Sera|Seen anything strange?':
    "Strange? Maybe. There's been talk — but it's not my post to say. The Corporal patrols the south road. If something happened near the docks, he'd know before any of us. I'd ask Vayne if I were you.",
  'Edwyn|Seen anything strange?':
    "I — yeah. I mean... there's — look. There was something. Down south, near the water. But I only heard about it secondhand. Vayne's the one who actually saw it. He logs everything. You'd want to talk to him, not me.",
  'Vayne|Anything I should know?':
    "The eastern zones are dangerous after dark — don't let anyone tell you otherwise. And if you're planning to poke around the south docks at night... don't go alone. I've seen things I can't fully explain.",
};
let dialogueNpc = null;

// ======= DYNAMIC NPC DIALOGUE =======
// Returns a context-aware greeting for an NPC based on weather, quests, time, and world state

function getDynamicGreet(npc) {
  const qf = questFlags;
  const w  = Weather.current;
  const wn = Weather.getName();
  const isNight = getNightAlpha() > 0.5;
  const isDawn  = gameTime > 0.2 && gameTime < 0.3;
  const isDusk  = gameTime > 0.7 && gameTime < 0.8;
  const dayName = DAY_NAMES[gameDay % DAY_NAMES.length];
  const isGrimtide = dayName === 'Grimtide';
  const isRaining  = w === Weather.RAIN || w === Weather.HEAVY_RAIN;
  const isFoggy    = w === Weather.FOG;
  const isSnowing  = w === Weather.SNOW || w === Weather.SNOWSTORM;

  const name = npc.npcName;

  // ── Named NPCs get personalised context-aware greetings ──────────────
  if(name === 'Vayne') {
    if(qf.ashen_seal_returned)
      return "You actually cleaned out that catacomb. I owe you an apology — I didn't think you'd come back in one piece.";
    if(qf.ashen_seal_accepted && !qf.ashen_seal_returned)
      return "Still after that seal? The catacomb entrance is further south. Watch yourself down there.";
    if(qf.mystery_key_given)
      return "You met the figure, then. I knew someone would eventually. Whatever they told you — take it seriously.";
    if(isGrimtide && isNight)
      return "Grimtide watch. I've doubled the south patrol tonight. Don't ask me why. Just feels right.";
    if(isRaining)
      return `Rain makes the job harder. Visibility drops, sound carries wrong, and the ink runs on my log sheets. Corporal Vayne. You need something?`;
    if(isFoggy)
      return "Fog's thick as wool tonight. I hate fog. Things move in it that shouldn't.";
    if(isNight)
      return "Night watch. Keep your head down and your eyes open.";
    return null; // fall through to default pool
  }

  if(name === 'Edwyn') {
    if(qf.ashen_seal_returned)
      return "Word travels fast. They're saying you cleared the catacombs. Edwyn. South docks patrol. Glad it was you and not me.";
    if(isFoggy)
      return "Fog on the docks again. I've been doing this patrol six years and I still hate the fog. Something always moves in it.";
    if(isRaining)
      return "Wet boots, wet cloak, wet everything. Edwyn, south docks. What do you need?";
    if(isGrimtide && isNight)
      return "It's Grimtide. I've seen things on this dock on Grimtide nights I don't talk about. Stay close to the lanterns.";
    return null;
  }

  if(name === 'Sera') {
    if(qf.constellation_done)
      return "They say the wizard's tower lit up four nights ago. Four stars back in the sky. That you?";
    if(qf.constellation_accepted)
      return "Heard you're doing work for the old wizard. Careful — those that go to the Spire tend to come back... different.";
    if(isSnowing)
      return "Snow in Ashenveil. Rare. Where I'm from in the Iron Peaks this'd be nothing. Sera. You need something?";
    if(isRaining && w === Weather.HEAVY_RAIN)
      return "This rain's getting serious. Sera — transferred from the Iron Peaks last winter. We had weather like this before a rockslide buried half the garrison. Just saying.";
    return null;
  }

  if(name === 'Bram') {
    if(qf.ashen_seal_returned)
      return "You're the one who went into the catacombs. I heard. Drink's on me tonight — just this once. Bram Hollowtap. Sit down.";
    if(qf.mystery_key_given)
      return "The figure at the docks. I know more than I let on. I always do. But it'll cost you — in ale, at least. Bram Hollowtap. Come inside.";
    if(isRaining && w === Weather.HEAVY_RAIN)
      return "Finest night for business — nobody wants to be outside in this. Bram Hollowtap. The Flagon's warm and the ale's cold. Come in.";
    if(isFoggy)
      return "Fog brings in the nervous ones. Good for sales. Bram Hollowtap — I've seen twenty years of fog roll off this bay. Sit down.";
    if(isGrimtide)
      return "Grimtide. I don't drink on Grimtide. Don't ask me why. Bram Hollowtap — the bar's open, but I'm staying sober tonight.";
    if(isNight)
      return "Late crowd. The best kind. Bram Hollowtap — what are you having?";
    return null;
  }

  if(name === 'Mira') {
    if(qf.miras_locket_done)
      return "You found it. I still can't believe you found it. Thank you — truly.";
    if(isRaining)
      return "Rain again. I lost my locket in weather like this — visibility's bad, ground churns everything up. Mira. Are you back about the locket?";
    if(isGrimtide)
      return "Grimtide makes me nervous. I keep all the curtains shut tonight. Mira — something I can help you with?";
    return null;
  }

  if(name === 'Oswin') {
    if(qf.ashen_seal_returned)
      return "Ashenveil's full of heroes all of a sudden. Oswin — I'm still waiting on that caravan, but at least the company's interesting.";
    if(isRaining && w === Weather.HEAVY_RAIN)
      return "This rain's going to wash the road out. If it does the caravan won't get through for another week. Oswin. I'm losing money by the hour.";
    if(isSnowing)
      return "Snow. That's it. The pass is definitely blocked now. Oswin — I should have taken the coastal route.";
    return null;
  }

  if(name === 'Thessaly') {
    if(qf.mystery_met)
      return "You found the figure. I know — I've been watching the docks too. Thessaly. I think we should compare notes.";
    if(qf.mystery_key_given)
      return "The key. You got the key. Thessaly — I've been trying to find what that key opens for months. Tell me what you know.";
    if(isGrimtide && isNight)
      return "Tonight's the night I've been waiting for. Grimtide. The figure should appear. Thessaly — don't follow me to the docks. For your own sake.";
    if(isFoggy)
      return "The person I'm looking for moves in fog like this. Thessaly. Keep your eyes open.";
    return null;
  }

  if(name === 'Aldric') {
    if(isSnowing)
      return "Snow on my old leg wound. Feels like needles. Aldric — been out hunting regardless. Stupid, I know.";
    if(isRaining)
      return "Rain's good for tracking — softens the ground, holds a print. Aldric. Leg's holding up today.";
    if(qf.chapel_visited)
      return "I saw someone come out of the chapel last week. White as chalk, wouldn't say a word. Don't go in there. Aldric.";
    return null;
  }

  if(name === 'Elspeth') {
    if(qf.clue_chapel_altar)
      return "Something's wrong with the chapel. Has been for weeks. I can feel it from here. Elspeth — I was born in Ashenveil. I know when something's off.";
    if(isFoggy)
      return "Fog like this, I stand by the well and I listen. Ashenveil sounds different in fog. Older. Elspeth — morning watch.";
    if(isRaining)
      return "I watch the well every morning. Rain fills it fast but it tastes strange after. Elspeth. You need something?";
    if(isGrimtide)
      return "My mother told me to stay inside on Grimtide. Her mother told her the same. Elspeth. Old advice is usually old for a reason.";
    return null;
  }

  if(name === 'Rowan') {
    if(qf.ashen_seal_accepted)
      return "You're the one heading into the catacombs? Rowan — grain store. I had a cousin go down there once. Don't ask how it went.";
    if(isRaining)
      return "Good for the grain, bad for the roads. Rowan — south grain store. The roof leaks but I make do.";
    if(isNight)
      return "Still here. I sleep better days, work nights. Rowan — grain store. You need something at this hour?";
    return null;
  }

  if(name === 'Greta') {
    const w = Weather.current;
    if(w === Weather.HEAVY_RAIN)
      return "Rain like this, the turnip rows flood. Not what we need. Greta — I manage this farm. What can I do for you?";
    if(w === Weather.SNOW || w === Weather.SNOWSTORM)
      return "Snow! The animals are upset and so am I. Greta. Come inside, come inside.";
    if(isNight)
      return "Still out here? The wolves come after dark. Greta — I'll be heading in soon. Don't linger in the pasture.";
    if(isGrimtide)
      return "Grimtide. I pen the animals early on Grimtide. Something spooks them if I don't. Greta — you need something?";
    return null;
  }

  if(name === 'Aldous') {
    if(w === Weather.RAIN || w === Weather.HEAVY_RAIN)
      return "Rain's good for wheat but bad for my back. Aldous — thirty years in these fields. I know every row.";
    if(w === Weather.SNOWSTORM)
      return "Snowstorm. I've put canvas over the seedlings. Probably won't help. Aldous. You know anything about farming?";
    if(isNight)
      return "Working late — always something to do before dawn. Aldous. You're up at a strange hour.";
    return null;
  }

  if(name === 'Dorin') {
    if(qf.constellation_done)
      return "The stars look different lately. Cleaner. Been on these roads forty years — I notice things like that. Dorin. Something big happened.";
    if(qf.ashen_seal_returned)
      return "Word from the south road — a catacomb got cleared out. That was you? Dorin. Forty years trading these roads. First time I've heard that done.";
    if(isFoggy)
      return "Fog on the road means ambush weather. Dorin — I've been trading these roads long enough to know. Watch the tree lines.";
    if(isRaining && w === Weather.HEAVY_RAIN)
      return "Heavy rain means mud. Mud means wheels stick. Wheels stick means I'm sleeping in the cart again. Dorin. Not my finest season.";
    if(isSnowing)
      return "Snow. First of the year. Dorin — the mountain pass will close in a week at this rate. Buy what you need while I'm still moving.";
    return null;
  }

  // ── Generic NPC type fallbacks ──────────────────────────────────────
  const typeId = npc.typeId;

  if(typeId === T.NPC_GUARD) {
    if(qf.ashen_seal_returned)
      return "Word's gone round about what you did in the catacombs. The whole south watch noticed. Well done.";
    if(isGrimtide && isNight)
      return "Grimtide night watch. Double patrols tonight. Orders from above. Move along.";
    if(isFoggy)
      return "Fog makes this job twice as hard. If you see anything move near the walls, tell me immediately.";
    if(isRaining && w === Weather.HEAVY_RAIN)
      return "Heavy rain. Visibility's awful. Stay out of the alleys tonight.";
    if(isNight)
      return "Night patrol. Keep it moving, traveller.";
    return null;
  }

  if(typeId === T.NPC_MERCHANT) {
    if(isRaining)
      return "Nobody wants to shop in the rain. Except you, apparently. Come in, come in — I've got shelter and goods.";
    if(isSnowing)
      return "Snow! Good for business — everyone needs warmer gear. Come, see what I have.";
    if(isFoggy)
      return "Fog's bad for foot traffic. You're my first customer in an hour. Buy something.";
    return null;
  }

  if(name === 'Bertram') {
    if(qf.homestead_rewarded)
      return "How goes the homestead? I hope the soil is treating you well. I knew it would find the right hands eventually.";
    if(qf.homestead_quest_handedIn)
      return "You brought the wheat. I knew you would. Use that sigil wisely — the land remembers the hands that tend it.";
    if(qf.homestead_quest_accepted)
      return "Three stalks of wheat is all I ask. Prove you know how to grow something before you take on a whole plot.";
    if(qf.bertram_met)
      return "Old Bertram. Still here. You think on what I said?";
    return "Old Bertram. I've been sitting on something that ought to be passed on. You look like someone who doesn't mind getting their hands dirty.";
  }

  if(typeId === T.NPC_INNKEEPER) {
    if(isRaining && w === Weather.HEAVY_RAIN)
      return "Every bed's taken — rain drives people inside. Best storm for business I've had all season. Welcome to the Flagon!";
    if(isSnowing)
      return "Snow! Perfect night for a hot meal and a warm bed. Welcome to the Tarnished Flagon — come in from the cold.";
    if(isGrimtide)
      return "Grimtide. I keep all the lanterns lit on Grimtide. Old habit. Welcome to the Flagon — stay as long as you like.";
    if(qf.ashen_seal_returned)
      return "The catacomb adventurer! Word travels fast in a small town. First drink's on the house.";
    return null;
  }

  // ── Generic weather/time fallback for villagers ──────────────────────
  if(isFoggy)   return "Fog like this... I keep thinking I see shapes between the houses. Probably nothing.";
  if(isRaining && w === Weather.HEAVY_RAIN) return "Haven't seen rain this heavy in years. Stay on the main roads.";
  if(isSnowing && w === Weather.SNOWSTORM)  return "Snowstorm! I haven't seen weather like this since I was a child.";
  if(isGrimtide && isNight) return "It's Grimtide. My grandmother said to never go out on Grimtide night. I believe her now.";
  if(isNight)   return "Out late? Careful — the streets aren't safe after dark in these times.";
  if(isDawn)    return "Early riser. Smart. The town's quieter at dawn. Safer too.";

  return null; // no dynamic line — use the static pool
}


function openWillaDialogue(npc) {
  const panel     = document.getElementById('dialogue-panel');
  const portrait  = document.getElementById('dialogue-portrait');
  const nameEl    = document.getElementById('dialogue-npc-name');
  const textEl    = document.getElementById('dialogue-text');
  const optionsEl = document.getElementById('dialogue-options');

  portrait.textContent       = 'W';
  portrait.style.background  = '#0a1a14';
  portrait.style.color       = '#60c890';
  portrait.style.borderColor = '#60c890';
  nameEl.textContent = 'WILLA — BANK TELLER';
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

  const greetings = [
    "Welcome to Grimstone Savings Bank! Your gold is safer here than buried in a field — and far more profitable, too. How can I help you today?",
    "Oh, hello! Lovely to see a face. We offer vault storage, stock shares, and savings bonds. Something for every adventurer!",
    "Good day! Whether you're saving up for better gear or investing in Ashenveil's finest companies, you've come to the right place. What can I do for you?",
  ];
  say(greetings[Math.floor(Math.random() * greetings.length)]);

  opt('▸ I\'d like to use the bank.', () => {
    closeDialogue();
    setTimeout(() => openBankPanel(), 0);
  });
  opt('▸ What services do you offer?', () => {
    say("Three services! The Vault stores your gold safely — no monsters can pickpocket it there! The Market lets you buy shares in local companies; prices shift over time, so keep an eye out. And Savings Bonds lock your gold for a set period and return it with guaranteed interest. Longer wait, better reward!");
    optionsEl.innerHTML = '';
    opt('▸ Open the bank.', () => { closeDialogue(); setTimeout(() => openBankPanel(), 0); });
    opt('▸ Thanks, goodbye!', close);
  });
  opt('▸ Tell me about yourself.', () => {
    say("Born and raised right here in Ashenveil! Four years behind this counter and I love every minute of it — numbers, ledgers, the satisfying clink of counted coin. When a farmer's bond matures and they can finally afford new tools... honestly, that never gets old. A bit nerdy, I know, but here we are!");
    optionsEl.innerHTML = '';
    opt('▸ Use the bank.', () => { closeDialogue(); setTimeout(() => openBankPanel(), 0); });
    opt('▸ Goodbye, Willa!', close);
  });
  opt('▸ Goodbye!', close);

  panel.classList.add('show');
  document.getElementById('dialogue-close').onclick = closeDialogue;
}

function openBertramDialogue(npc) {
  const qf = questFlags;
  const panel     = document.getElementById('dialogue-panel');
  const portrait  = document.getElementById('dialogue-portrait');
  const nameEl    = document.getElementById('dialogue-npc-name');
  const textEl    = document.getElementById('dialogue-text');
  const optionsEl = document.getElementById('dialogue-options');

  portrait.textContent  = 'B';
  portrait.style.background  = '#1a1208';
  portrait.style.color       = '#9a7850';
  portrait.style.borderColor = '#9a7850';
  nameEl.textContent = 'OLD BERTRAM';
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

  if(!qf.bertram_met) {
    qf.bertram_met = true;
    say("Been sitting on this plot deed for three years now. My back won't let me farm anymore. You look like you might have some patience in you — which is the only thing farming asks of a person. I'll give you the homestead sigil. But first, prove you know something about growing. Bring me three wheat and it's yours.");
    opt("▸ I'll bring you the wheat.", () => {
      qf.homestead_quest_accepted = true;
      say("Good. Wheat grows wild in the fields east of town — or you can find seeds in chests and plant your own. Either way: three stalks. Come back when you have them.");
      log('✦ Quest accepted: A Place to Call Home — bring Old Bertram 3 wheat.', 'gold');
      optionsEl.innerHTML = '';
      opt('▸ Understood.', close);
    });
    opt("▸ Not right now.", close);
    panel.classList.add('show');
    document.getElementById('dialogue-close').onclick = closeDialogue;
    return;
  }

  if(qf.homestead_quest_accepted && !qf.homestead_rewarded) {
    const wheatCount = countInInventory('wheat');
    if(wheatCount >= 3) {
      say("Three stalks of wheat. Good. You know how to grow something — or at least how to find it. Here, take the sigil. Use it anywhere to return to the homestead. The land is yours now. Treat it well.");
      opt("▸ Here's the wheat.", () => {
        removeFromInventory('wheat', 3);
        qf.homestead_quest_handedIn = true;
        qf.homestead_rewarded = true;
        addToInventory('home_sigil');
        buildInventory(); updateHUD();
        say("The land remembers the hands that tend it. Use the sigil in your inventory whenever you want to return. You can till the soil with a hoe — buy one from Dorin if you haven't already — and plant seeds to grow crops.");
        log('✦ Quest complete: A Place to Call Home! Received Homestead Sigil.', 'gold');
        optionsEl.innerHTML = '';
        opt('▸ Thank you, Bertram.', close);
      });
      opt("▸ Not yet.", close);
    } else {
      say(`I need three wheat. You're carrying ${wheatCount} right now. Check the fields east of town, or plant wheat seeds and come back when they've grown.`);
      opt("▸ I'll keep looking.", close);
    }
    panel.classList.add('show');
    document.getElementById('dialogue-close').onclick = closeDialogue;
    return;
  }

  if(qf.homestead_rewarded) {
    say("How goes the homestead? I hope the soil is treating you well. Till with the hoe, plant your seeds, water with patience. The land gives back what you put into it.");
    opt("▸ It's coming along.", close);
    opt("▸ Goodbye, Bertram.", close);
    panel.classList.add('show');
    document.getElementById('dialogue-close').onclick = closeDialogue;
    return;
  }
}

function openDialogue(npc) {
  // Wizard gets a fully quest-aware custom dialogue
  if(npc.typeId === T.NPC_WIZARD) {
    document.getElementById('dialogue-panel').classList.add('show');
    document.getElementById('dialogue-close').onclick = closeDialogue;
    openWizardDialogue(npc);
    return;
  }
  // Bertram — homestead quest giver
  if(npc.npcName === 'Bertram') {
    openBertramDialogue(npc);
    return;
  }
  // Willa — bank teller
  if(npc.npcName === 'Willa') {
    openWillaDialogue(npc);
    return;
  }
  dialogueNpc = npc;
  const data = NPC_DIALOGUE[npc.typeId] || NPC_DIALOGUE[T.NPC_VILLAGER];
  const panel = document.getElementById('dialogue-panel');
  const portrait = document.getElementById('dialogue-portrait');
  const nameEl = document.getElementById('dialogue-npc-name');
  const textEl = document.getElementById('dialogue-text');
  const optionsEl = document.getElementById('dialogue-options');

  portrait.textContent = npc.def.letter;
  portrait.style.background = npc.def.bg;
  portrait.style.color = npc.def.col;
  portrait.style.borderColor = npc.def.col;
  nameEl.textContent = npc.def.name.toUpperCase();

  // Dynamic context-aware greeting takes priority (weather, quests, time of day)
  const dynamicGreet = getDynamicGreet(npc);
  const personalRumour = npc.npcName && VILLAGER_RUMOURS[npc.npcName];
  let greet;
  if(dynamicGreet) {
    greet = dynamicGreet;
  } else {
    let greetPool = data.greet;
    if(personalRumour) greetPool = [personalRumour, ...data.greet];
    greet = greetPool[Math.floor(Math.random() * greetPool.length)];
  }
  textEl.textContent = greet;

  // Mira — return her locket if player has found it
  if(npc.npcName === 'Mira' && questFlags.miras_locket_found && !questFlags.miras_locket_done) {
    const p = state.players[state.activePlayer];
    textEl.textContent = "Oh — is that... is that my locket? I've been looking everywhere for it. How did you find it?";
    optionsEl.innerHTML = '';
    const returnBtn = document.createElement('div');
    returnBtn.className = 'dlg-option';
    returnBtn.textContent = '▸ I found it in a barrel on the dock.';
    returnBtn.onclick = () => {
      removeFromInventory('miras_locket');
      p.gold = (p.gold||0) + 15;
      questFlags.miras_locket_done = true;
      buildInventory(); updateHUD();
      textEl.textContent = "I don't know how to thank you. It was my mother's — I thought it was gone forever. Please, take this. It's not much, but it's all I have on me.";
      optionsEl.innerHTML = '';
      log('📿 Returned the locket to Mira. +15g', 'gold');
      log('✦ Quest complete: Mira\'s Lost Locket!', 'gold');
      const closeBtn2 = document.createElement('div');
      closeBtn2.className = 'dlg-option';
      closeBtn2.textContent = '▸ Glad I could help.';
      closeBtn2.onclick = closeDialogue;
      optionsEl.appendChild(closeBtn2);
    };
    optionsEl.appendChild(returnBtn);
    const noBtn = document.createElement('div');
    noBtn.className = 'dlg-option';
    noBtn.textContent = '▸ Actually, let me hold onto it a bit longer.';
    noBtn.onclick = closeDialogue;
    optionsEl.appendChild(noBtn);
    panel.classList.add('show');
    document.getElementById('dialogue-close').onclick = closeDialogue;
    return;
  }

  // Build dialogue options — named NPCs get a "What's your name?" option
  optionsEl.innerHTML = '';
  if(npc.npcName) {
    const he = npc.gender === 'f' ? 'She' : 'He';
    const his = npc.gender === 'f' ? 'her' : 'his';
    const nameLines = {
      Vayne:    `Corporal Vayne. ${he}'s been on the east gate watch for six years. ${he} keeps ${his} patrol log pinned to the town notice board.`,
      Sera:     `Guard Sera. ${he} transferred from the Iron Peaks garrison last winter. ${he} doesn't talk much about why.`,
      Edwyn:    `Guard Edwyn. ${he} draws the south road and docks patrol — the shift nobody else wants. ${he} says ${he} doesn't mind. ${he}'s not convincing.`,
      Dorin:    `Dorin. ${he}'s been trading these roads since before Ashenveil had proper walls. ${he} knows where everything comes from — and where it disappears to.`,
      Mira:     `Mira. ${he} runs the upper rooms of the Flagon when Bram's busy. ${he} lost a locket near the docks — keeps hoping someone will find it.`,
      Aldric:   `Aldric. ${he} was a hunter before the wolf got ${his} leg. Still goes out sometimes. Probably shouldn't.`,
      Elspeth:  `Elspeth. ${he} was born in Ashenveil and doesn't plan to die anywhere else. ${he} watches the well every morning.`,
      Rowan:    `Rowan. ${he} works the grain store on the south end. ${he} keeps odd hours — says ${he} sleeps better in the day.`,
      Bram:     `Bram Hollowtap. ${he}'s run the Tarnished Flagon for twenty years. ${he} knows every rumour that passes through Ashenveil, and shares none of them for free.`,
      Oswin:    `Oswin. ${he} travels between settlements buying and selling whatever fits in ${his} pack. ${he}'s been waiting on a caravan for three days. ${he} looks like ${he} regrets stopping here.`,
      Thessaly: `Thessaly. ${he} arrived in Ashenveil alone and hasn't said where from. ${he}'s been asking questions around town — quietly. ${he} seems to know more than ${he} lets on.`,
      Bertram:  `Old Bertram. ${he} worked a homestead east of town for thirty years before age slowed him down. ${he} still carries the sigil that binds that land — and ${he}'s been looking for someone worth passing it to.`,
      Willa:    `Willa. ${he} manages the counter at Grimstone Savings Bank — deposits, withdrawals, shares, and bonds. ${he} says the job is boring. ${he} seems to like it.`,
    };
    const intro = nameLines[npc.npcName] || `${npc.npcName}. A resident of Ashenveil.`;
    const nameBtn = document.createElement('div');
    nameBtn.className = 'dlg-option';
    nameBtn.textContent = '▸ Who are you?';
    nameBtn.onclick = () => {
      textEl.textContent = intro;
      optionsEl.innerHTML = '';
      (data.lines || []).forEach(l => addDlgOption(l, data, textEl, optionsEl, npc));
      if(data.hasTrade) addTradeOption(optionsEl, npc);
    };
    optionsEl.appendChild(nameBtn);
  }
  // Vayne-specific: show patrol logbook (only after asking about the docks)
  if(npc.npcName === 'Vayne' && questFlags.vayne_docks_asked) {
    const logBtn = document.createElement('div');
    logBtn.className = 'dlg-option';
    logBtn.textContent = '▸ Show me your log.';
    logBtn.onclick = () => {
      closeDialogue();
      showReadPanel('Corporal Vayne\'s Patrol Log', [
        { icon:'📓', text: '"PATROL LOG — Corporal Vayne, East Gate & South Road\n\nStonedawn:  Quiet watch. Replaced torch at post 3. No incidents.\nIronmark:   Wolves sighted near the water gate at second bell. Chased off. No casualties.\nAshveil:    Heavy fog. Visibility poor. Nothing to report.\nGrimtide:   !! INCIDENT — South docks, approx. 11 bells. Observed a cloaked figure standing at the dock\'s edge. Called out twice. No response. Figure departed into the fog before I could reach the waterline. No lantern carried.\nEmberfell:  Posted a notice on the board. Vayne.\nDuskholm:   Patrolled docks twice. Nothing.\nMoonwatch:  Quiet. Asked Edwyn to keep an eye on the south end.\n\n[A note in the margin, different hand: \'I know who it is. Don\'t go to the docks alone. — unsigned\']"' },
      ], 'clue_guard_logbook');
    };
    optionsEl.appendChild(logBtn);
  }

  (data.lines || []).forEach(([prompt, reply]) => {
    const btn = document.createElement('div');
    btn.className = 'dlg-option';
    btn.textContent = '▸ ' + prompt;
    btn.onclick = () => {
      // Check for a per-NPC line override before showing the shared reply
      const overrideKey = npc.npcName ? `${npc.npcName}|${prompt}` : null;
      const displayReply = (overrideKey && NPC_LINE_OVERRIDES[overrideKey]) || reply;
      textEl.textContent = displayReply;
      // Set flag when Vayne is asked about the docks
      if(npc.npcName === 'Vayne' && prompt === 'Seen anything strange?') {
        questFlags.vayne_docks_asked = true;
      }
      optionsEl.innerHTML = '';
      if(npc.npcName) {
        // keep "Who are you?" available after picking a topic
        const nameBtn2 = document.createElement('div');
        nameBtn2.className = 'dlg-option';
        nameBtn2.textContent = '▸ Who are you?';
        nameBtn2.onclick = () => openDialogue(npc);
        optionsEl.appendChild(nameBtn2);
      }
      if(npc.npcName === 'Vayne' && questFlags.vayne_docks_asked) {
        const logBtn2 = document.createElement('div');
        logBtn2.className = 'dlg-option';
        logBtn2.textContent = '▸ Show me your log.';
        logBtn2.onclick = () => { closeDialogue(); showReadPanel('Corporal Vayne\'s Patrol Log', [
          { icon:'📓', text: '"PATROL LOG — Corporal Vayne, East Gate & South Road\n\nStonedawn:  Quiet watch. Replaced torch at post 3. No incidents.\nIronmark:   Wolves sighted near the water gate at second bell. Chased off. No casualties.\nAshveil:    Heavy fog. Visibility poor. Nothing to report.\nGrimtide:   !! INCIDENT — South docks, approx. 11 bells. Observed a cloaked figure standing at the dock\'s edge. Called out twice. No response. Figure departed into the fog before I could reach the waterline. No lantern carried.\nEmberfell:  Posted a notice on the board. Vayne.\nDuskholm:   Patrolled docks twice. Nothing.\nMoonwatch:  Quiet. Asked Edwyn to keep an eye on the south end.\n\n[A note in the margin, different hand: \'I know who it is. Don\'t go to the docks alone. — unsigned\']"' },
        ], 'clue_guard_logbook'); };
        optionsEl.appendChild(logBtn2);
      }
      (data.lines || []).filter(l => l[0] !== prompt).forEach(l => addDlgOption(l, data, textEl, optionsEl, npc));
      if(data.hasTrade) addTradeOption(optionsEl, npc);
    };
    optionsEl.appendChild(btn);
  });
  if(data.hasTrade) addTradeOption(optionsEl, npc);

  document.getElementById('dialogue-close').onclick = closeDialogue;
  panel.classList.add('show');
}

function addDlgOption([prompt, reply], data, textEl, optionsEl, npc) {
  const btn = document.createElement('div');
  btn.className = 'dlg-option';
  btn.textContent = '▸ ' + prompt;
  btn.onclick = () => {
    const overrideKey = npc && npc.npcName ? `${npc.npcName}|${prompt}` : null;
    textEl.textContent = (overrideKey && NPC_LINE_OVERRIDES[overrideKey]) || reply;
    optionsEl.innerHTML = '';
    (data.lines || []).filter(l => l[0] !== prompt).forEach(l => addDlgOption(l, data, textEl, optionsEl, npc));
    if(data.hasTrade) addTradeOption(optionsEl, npc);
  };
  optionsEl.appendChild(btn);
}

function addTradeOption(optionsEl, npc) {
  const btn = document.createElement('div');
  btn.className = 'dlg-option';
  btn.textContent = npc && npc.typeId === T.NPC_INNKEEPER
    ? '▸ What\'s on the menu?'
    : '▸ Let\'s trade.';
  btn.onclick = () => {
    closeDialogue();
    if(npc && npc.typeId === T.NPC_INNKEEPER) openInnkeeperShop();
    else openMerchantShop();
  };
  optionsEl.appendChild(btn);
}

function closeDialogue() {
  document.getElementById('dialogue-panel').classList.remove('show');
  dialogueNpc = null;
}

// ======= MERCHANT SHOP =======
const MERCHANT_BUY_STOCK = [
  { id:'sword',      qty:1,  cost:50,  desc:'A reliable iron blade.' },
  { id:'bait',       qty:10, cost:5,   desc:'Worms and grubs for fishing.' },
  { id:'fly_lure',   qty:5,  cost:10,  desc:'Feathered lure for fly fishing.' },
  { id:'harpoon',    qty:1,  cost:30,  desc:'Heavy spear for deep-water fishing.' },
  { id:'cooked_trout', qty:1, cost:12, desc:'Restores health when eaten.' },
  { id:'cooked_salmon', qty:1, cost:18, desc:'Hearty meal, restores more health.' },
];

const MERCHANT_SELL_ACCEPTS = [
  { id:'bones',        price:5,   desc:'Dropped by skeletons.' },
  { id:'goblin_hide',  price:8,   desc:'Rough hide from goblins.' },
  { id:'bronze_bar',   price:20,  desc:'Smelted from copper ore.' },
  { id:'iron_bar',     price:30,  desc:'Smelted from iron ore.' },
  { id:'gold_bar',     price:55,  desc:'Smelted from gold ore.' },
  { id:'mithril_bar',  price:90,  desc:'Rare and valuable metal.' },
  { id:'coal',         price:8,   desc:'Used as fuel for smelting.' },
  { id:'copper_ore',   price:4,   desc:'Raw copper ore.' },
  { id:'iron_ore',     price:7,   desc:'Raw iron ore.' },
  { id:'normal_log',   price:3,   desc:'Freshly chopped wood.' },
  { id:'oak_log',      price:6,   desc:'Dense hardwood.' },
  { id:'willow_log',   price:12,  desc:'Flexible willow timber.' },
  { id:'raw_trout',    price:4,   desc:'Fresh catch.' },
  { id:'raw_salmon',   price:7,   desc:'Prized fish.' },
];

// ======= SHOP CONFIG SYSTEM =======
// Each shop is a config object passed to openShopPanel()

const MERCHANT_SHOP_CONFIG = {
  title: 'The Wandering Merchant',
  portraitLetter: 'M',
  portraitBg: '#2a1a0a',
  portraitCol: '#c8922a',
  hasSellTab: true,
  buyStock: [
    // ---- Weapons ----
    { id:'wooden_club',   qty:1,  cost:8,   category:'Weapons',     desc:'A crude bludgeon. Better than nothing.' },
    { id:'bronze_sword',  qty:1,  cost:40,  category:'Weapons',     desc:'Entry-level blade. Serviceable.' },
    { id:'iron_sword',    qty:1,  cost:120, category:'Weapons',     desc:'A solid iron blade. Reliable in a fight.' },
    { id:'war_axe',       qty:1,  cost:95,  category:'Weapons',     desc:'Heavy axe. Slow but hits hard.' },
    { id:'steel_sword',   qty:1,  cost:280, category:'Weapons',     desc:'Hardened steel. A serious weapon.' },
    { id:'bone_dagger',   qty:1,  cost:60,  category:'Weapons',     desc:'A jagged dagger carved from bone.' },
    // ---- Shields ----
    { id:'wooden_shield', qty:1,  cost:15,  category:'Shields',     desc:'Rough-cut wood. Stops the odd blow.' },
    { id:'bronze_shield', qty:1,  cost:55,  category:'Shields',     desc:'Light bronze buckler.' },
    { id:'iron_shield',   qty:1,  cost:140, category:'Shields',     desc:'Sturdy iron shield.' },
    { id:'kite_shield',   qty:1,  cost:320, category:'Shields',     desc:'Large kite shield. Superior coverage.' },
    // ---- Helmets ----
    { id:'leather_coif',  qty:1,  cost:20,  category:'Helmets',     desc:'Soft leather head wrap.' },
    { id:'bronze_helm',   qty:1,  cost:50,  category:'Helmets',     desc:'Basic bronze helm.' },
    { id:'iron_helm',     qty:1,  cost:130, category:'Helmets',     desc:'Full iron helm with cheek guards.' },
    { id:'steel_helm',    qty:1,  cost:300, category:'Helmets',     desc:'Reinforced steel helm. Heavy but protective.' },
    // ---- Body Armour ----
    { id:'leather_body',  qty:1,  cost:30,  category:'Body Armour', desc:'Tanned hide vest. Light protection.' },
    { id:'bronze_plate',  qty:1,  cost:80,  category:'Body Armour', desc:'Bronze breastplate.' },
    { id:'iron_plate',    qty:1,  cost:200, category:'Body Armour', desc:'Heavy iron plate armour.' },
    { id:'steel_plate',   qty:1,  cost:450, category:'Body Armour', desc:'Thick steel plate. The best money can buy.' },
    // ---- Legs ----
    { id:'leather_legs',  qty:1,  cost:25,  category:'Legs',        desc:'Leather leg wraps.' },
    { id:'bronze_legs',   qty:1,  cost:65,  category:'Legs',        desc:'Bronze greaves.' },
    { id:'iron_legs',     qty:1,  cost:160, category:'Legs',        desc:'Iron greaves. Good knee coverage.' },
    { id:'steel_legs',    qty:1,  cost:360, category:'Legs',        desc:'Steel greaves. Solid protection.' },
    // ---- Ammo ----
    { id:'bronze_arrows', qty:20, cost:18,  category:'Ammo',        desc:'Bundle of bronze-tipped arrows.' },
    { id:'iron_arrows',   qty:20, cost:35,  category:'Ammo',        desc:'Sharper iron arrows. Better range.' },
    // ---- Food ----
    { id:'cooked_trout',  qty:1,  cost:12,  category:'Food',        desc:'Restores health when eaten.' },
    { id:'cooked_salmon', qty:1,  cost:20,  category:'Food',        desc:'Hearty meal, restores more health.' },
    // ---- Farming ----
    { id:'hoe',          qty:1,  cost:35,  category:'Farming',     desc:"Till dirt tiles at your homestead to prepare them for planting." },
    { id:'wheat_seed',   qty:5,  cost:4,   category:'Farming',     desc:'Plant at the homestead. Grows in ~5 minutes.' },
    { id:'turnip_seed',  qty:5,  cost:5,   category:'Farming',     desc:'Plant at the homestead. Grows in ~4 minutes.' },
    { id:'carrot_seed',  qty:5,  cost:6,   category:'Farming',     desc:'Plant at the homestead. Grows in ~6 minutes.' },
    { id:'potato_seed',  qty:5,  cost:7,   category:'Farming',     desc:'Plant at the homestead. Grows in ~8 minutes.' },
    { id:'onion_seed',   qty:5,  cost:5,   category:'Farming',     desc:'Plant at the homestead. Grows in ~5 minutes.' },
  ],
  sellAccepts: [
    { id:'bones',       price:5,  desc:'Dropped by skeletons.' },
    { id:'goblin_hide', price:8,  desc:'Rough hide from goblins.' },
    { id:'bronze_bar',  price:20, desc:'Smelted from copper ore.' },
    { id:'iron_bar',    price:30, desc:'Smelted from iron ore.' },
    { id:'gold_bar',    price:55, desc:'Smelted from gold ore.' },
    { id:'mithril_bar', price:90, desc:'Rare and valuable metal.' },
    { id:'coal',        price:8,  desc:'Used as fuel for smelting.' },
    { id:'copper_ore',  price:4,  desc:'Raw copper ore.' },
    { id:'iron_ore',    price:7,  desc:'Raw iron ore.' },
    { id:'normal_log',  price:3,  desc:'Freshly chopped wood.' },
    { id:'oak_log',     price:6,  desc:'Dense hardwood.' },
    { id:'willow_log',  price:12, desc:'Flexible willow timber.' },
    { id:'raw_trout',   price:4,  desc:'Fresh catch.' },
    { id:'raw_salmon',  price:7,  desc:'Prized fish.' },
    { id:'wheat',       price:3,  desc:'Harvested from your homestead.' },
    { id:'turnip',      price:4,  desc:'Harvested from your homestead.' },
    { id:'carrot',      price:5,  desc:'Harvested from your homestead.' },
    { id:'potato',      price:6,  desc:'Harvested from your homestead.' },
    { id:'onion',       price:3,  desc:'Harvested from your homestead.' },
  ],
};

const INNKEEPER_SHOP_CONFIG = {
  title: 'The Tarnished Flagon',
  portraitLetter: 'I',
  portraitBg: '#2a1208',
  portraitCol: '#a06030',
  hasSellTab: false,
  buyStock: [
    // ── Ales & Brews ──
    { id:'pale_ale',       qty:1, cost:4,  desc:'Crisp and light. Restores 6 HP. "Goes down easy."',            hp:6  },
    { id:'dark_stout',     qty:1, cost:7,  desc:'Thick and bitter. Restores 10 HP. "Puts hair on your chest."', hp:10 },
    { id:'ashenveil_mead', qty:1, cost:10, desc:'Honeyed warmth. Restores 14 HP. "Brewed right here in town."', hp:14 },
    { id:'witchwood_brew', qty:1, cost:14, desc:'Murky green. Restores 12 HP + eerie focus. "Best not to ask what\'s in it."', hp:12 },
    { id:'ironpeak_lager', qty:1, cost:9,  desc:'Cold and sharp. Restores 11 HP. "Imported at great cost."',   hp:11 },
    // ── Food ──
    { id:'inn_stew',       qty:1, cost:8,  desc:'A thick stew of root veg and bone broth. Restores 18 HP.',     hp:18 },
    { id:'roast_leg',      qty:1, cost:12, desc:'Slow-roasted beast leg, charred edges. Restores 22 HP.',       hp:22 },
    { id:'ash_bread',      qty:1, cost:3,  desc:'Dense loaf baked in ash coals. Restores 8 HP.',                hp:8  },
    { id:'smoked_fish',    qty:1, cost:6,  desc:'Fish smoked over willow wood. Restores 12 HP.',                hp:12 },
    { id:'mushroom_pie',   qty:1, cost:11, desc:'Earthy marsh mushrooms in a thick crust. Restores 20 HP.',     hp:20 },
  ],
  sellAccepts: [],
};

// Ale/drink flavour messages shown on consume
const DRINK_FLAVOUR = {
  pale_ale:       "You take a long sip of the pale ale. Cold and refreshing.",
  dark_stout:     "The dark stout coats your throat like warm iron. Invigorating.",
  ashenveil_mead: "The mead spreads golden warmth through your chest.",
  witchwood_brew: "The brew tingles strangely on your tongue. You feel... sharpened.",
  ironpeak_lager: "Crisp and cold as a mountain stream. Clarity returns.",
  inn_stew:       "The stew fills you up. Simple, hearty, good.",
  roast_leg:      "You tear into the roasted leg. Rich and satisfying.",
  ash_bread:      "Dense bread. Not fancy, but it does the job.",
  smoked_fish:    "The smoked fish has a pleasant bitterness. It sustains you.",
  mushroom_pie:   "The mushroom pie is surprisingly rich. You feel fortified.",
};

let currentShopConfig = null;
let currentShopTab = 'buy';

function openMerchantShop() { openShopPanel(MERCHANT_SHOP_CONFIG); }
function openInnkeeperShop() { openShopPanel(INNKEEPER_SHOP_CONFIG); }

function openShopPanel(config) {
  currentShopConfig = config;
  currentShopTab = 'buy';
  document.getElementById('shop-panel').classList.add('show');
  document.getElementById('shop-portrait').textContent = config.portraitLetter;
  document.getElementById('shop-portrait').style.background = config.portraitBg;
  document.getElementById('shop-portrait').style.color = config.portraitCol;
  document.getElementById('shop-portrait').style.borderColor = config.portraitCol;
  document.getElementById('shop-title').textContent = config.title;
  document.getElementById('shop-close').onclick = closeMerchantShop;

  // Show/hide sell tab
  const tabSell = document.getElementById('tab-sell');
  tabSell.style.display = config.hasSellTab ? '' : 'none';
  document.getElementById('tab-buy').classList.add('active');
  tabSell.classList.remove('active');

  renderShopContent();
  updateShopGold();
}

function closeMerchantShop() {
  document.getElementById('shop-panel').classList.remove('show');
  currentShopConfig = null;
}

function updateShopGold() {
  const p = state.players[state.activePlayer];
  document.getElementById('shop-gold-display').textContent = `Your gold: ${p.gold}g`;
}

function switchShopTab(tab) {
  if(!currentShopConfig) return;
  currentShopTab = tab;
  document.getElementById('tab-buy').classList.toggle('active', tab === 'buy');
  document.getElementById('tab-sell').classList.toggle('active', tab === 'sell');
  renderShopContent();
}

function renderShopContent() {
  if(!currentShopConfig) return;
  const config = currentShopConfig;
  const p = state.players[state.activePlayer];
  const content = document.getElementById('shop-content');
  content.innerHTML = '';

  if(currentShopTab === 'buy') {
    let lastCategory = null;
    config.buyStock.forEach(stock => {
      const item = ITEMS[stock.id];
      if(!item) return;
      // Inject category divider when category changes
      if(stock.category && stock.category !== lastCategory) {
        lastCategory = stock.category;
        const div = document.createElement('div');
        div.className = 'shop-category';
        div.textContent = stock.category;
        content.appendChild(div);
      }
      const row = document.createElement('div');
      row.className = 'shop-row';
      const cantAfford = p.gold < stock.cost;
      const qtyLabel = stock.qty > 1 ? ` ×${stock.qty}` : '';
      row.innerHTML = `
        <div class="shop-row-icon">${item.icon}</div>
        <div class="shop-row-info">
          <div class="shop-row-name">${item.name}${qtyLabel}</div>
          <div class="shop-row-desc">${stock.desc}</div>
        </div>
        <div class="shop-row-price ${cantAfford ? 'cant-afford' : ''}">${stock.cost}g</div>`;
      row.onclick = () => {
        if(p.gold < stock.cost) { log('Not enough gold.','bad'); return; }
        p.gold -= stock.cost;
        addToInventory(stock.id, stock.qty || 1);
        buildInventory(); buildEquipPanel(); updateHUD(); updateShopGold();
        log(`${item.icon} ${item.name} — purchased for ${stock.cost}g.`, 'gold');
        renderShopContent();
      };
      content.appendChild(row);
    });
  } else {
    let hasSellable = false;
    (config.sellAccepts || []).forEach(entry => {
      const qty = countInInventory(entry.id);
      if(qty === 0) return;
      hasSellable = true;
      const item = ITEMS[entry.id];
      if(!item) return;
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <div class="shop-row-icon">${item.icon}</div>
        <div class="shop-row-info">
          <div class="shop-row-name">${item.name}</div>
          <div class="shop-row-desc">${entry.desc}</div>
        </div>
        <div class="shop-row-qty">×${qty}</div>
        <div class="shop-row-price">${entry.price}g ea</div>`;
      row.onclick = () => {
        const curQty = countInInventory(entry.id);
        if(curQty === 0) { log('None left to sell.','bad'); renderShopContent(); return; }
        removeFromInventory(entry.id, 1);
        buildInventory(); buildEquipPanel(); p.gold += entry.price;
        updateHUD(); updateShopGold();
        log(`Sold ${item.name} for ${entry.price}g.`, 'gold');
        renderShopContent();
      };
      content.appendChild(row);
    });
    if(!hasSellable) {
      content.innerHTML = '<div class="shop-empty">Nothing to sell. Gather resources or drops and come back.</div>';
    }
  }
}

// ======= MYSTERY NPC — THE HOODED FIGURE =======
// Spawns at the docks on Grimtide (every 7th day), between 11 PM and 1 AM
const MYSTERY_SPAWN_X  = 32; // dock tile X
const MYSTERY_SPAWN_Y  = 23; // dock tile Y
// Night window: 11 PM = gameTime ~0.958, 1 AM = gameTime ~0.042
// Wrap-around window: time > 0.958 OR time < 0.042

let mysteryNpc = null;       // entity object when spawned, null otherwise
let mysteryMet = false;      // true once player has spoken to them

function isMysteryWindow() {
  if(zoneIndex !== 0) return false;
  // Spawns on Grimtide (day 4, then every 7 days)
  if(getDayName(gameDay) !== 'Grimtide') return false;
  const t = gameTime;
  return t > 0.917 || t < 0.083; // 11 PM to 1 AM
}

function tickMysteryNpc() {
  if(!currentMap || currentMap.isInterior) return;
  if(isMysteryWindow()) {
    if(!mysteryNpc) spawnMysteryNpc();
  } else {
    if(mysteryNpc) despawnMysteryNpc();
  }
}

function spawnMysteryNpc() {
  if(mysteryMet) return; // won't respawn if already spoken to this cycle
  mysteryNpc = {
    def: { name:'Hooded Figure', letter:'?', bg:'#0a0808', col:'#8a7060', patrolRadius:0, speed:0 },
    typeId: 'mystery',
    x: MYSTERY_SPAWN_X, y: MYSTERY_SPAWN_Y,
    homeX: MYSTERY_SPAWN_X, homeY: MYSTERY_SPAWN_Y,
    rx: MYSTERY_SPAWN_X, ry: MYSTERY_SPAWN_Y,
    patrolX: MYSTERY_SPAWN_X, patrolY: MYSTERY_SPAWN_Y,
    patrolTimer: 999, pauseTimer: 0, moveTimer: 999,
    isMystery: true,
  };
  log('A hooded figure stands motionless at the docks...', 'gold');
}

function despawnMysteryNpc() {
  mysteryNpc = null;
  mysteryMet = false; // reset so they can appear again next cycle
}

function getMysteryNpcAt(tx, ty) {
  if(!mysteryNpc) return null;
  if(Math.round(mysteryNpc.x) === tx && Math.round(mysteryNpc.y) === ty) return mysteryNpc;
  return null;
}

function openMysteryDialogue() {
  if(!mysteryNpc) return;
  mysteryMet = true;

  // Mark quest progress
  if(!questFlags.mystery_met) {
    questFlags.mystery_met = true;
    setTimeout(() => log('✦ Quest updated: The Hooded Figure', 'gold'), 500);
  }

  const panel   = document.getElementById('dialogue-panel');
  const portrait = document.getElementById('dialogue-portrait');
  const nameEl  = document.getElementById('dialogue-npc-name');
  const textEl  = document.getElementById('dialogue-text');
  const optEl   = document.getElementById('dialogue-options');

  portrait.textContent   = '?';
  portrait.style.background   = '#0a0808';
  portrait.style.color        = '#8a7060';
  portrait.style.borderColor  = '#8a7060';
  nameEl.textContent = 'HOODED FIGURE';

  const lines = questFlags.mystery_key_given
    ? [
        { p:'You again?',   r:'You have what you need. The door in the depths will open when the stars align. Do not lose the key.' },
        { p:'Who are you?', r:'...' },
      ]
    : [
        { p:'Who are you?',          r:'Names have weight. I\'ll keep mine. I was sent to find someone worth finding. It seems I have.' },
        { p:'What do you want?',     r:'There is something buried in the Obsidian Depths. A relic older than Ashenveil itself. The ones who sealed it don\'t want it found. I do.' },
        { p:'Why come to the docks?', r:'Because the guards watch the roads. The water doesn\'t ask questions. Neither should you — not yet.' },
        { p:'[Ask about the relic]', r:'They called it the Hearthstone. A fragment of something that once kept an entire kingdom warm through a winter that lasted forty years. You\'ll know it when you see it. Take this — you\'ll need it.',
          onSelect: () => {
            if(!questFlags.mystery_key_given) {
              questFlags.mystery_key_given = true;
              addToInventory('ashen_key', 1);
              log('✦ The figure presses a cold iron key into your hand.', 'gold');
              log('  You received: 🗝 The Ashen Key', 'gold');
            }
          }
        },
      ];

  textEl.textContent = '"...You came."';
  optEl.innerHTML = '';

  lines.forEach(line => {
    const btn = document.createElement('div');
    btn.className = 'dlg-option';
    btn.textContent = '▸ ' + line.p;
    btn.onclick = () => {
      if(line.onSelect) line.onSelect();
      textEl.textContent = line.r;
      optEl.innerHTML = '';
      // After talking, figure becomes silent
      const farewell = document.createElement('div');
      farewell.className = 'dlg-option';
      farewell.textContent = '▸ I\'ll find it.';
      farewell.onclick = () => closeDialogue();
      optEl.appendChild(farewell);
    };
    optEl.appendChild(btn);
  });

  document.getElementById('dialogue-close').onclick = closeDialogue;
  dialogueNpc = mysteryNpc;
  panel.classList.add('show');
}

// Quest state flags — persisted in save data
let questFlags = {
  mystery_met: false,
  mystery_key_given: false,
  // clues found
  clue_noticeboard_town: false,
  clue_noticeboard_inn:  false,
  clue_inn_journal:      false,
  clue_guard_logbook:    false,
  clue_chest_note:       false,
  vayne_docks_asked:     false,
  // chapel clues
  clue_chapel_rune:      false,
  clue_chapel_altar:     false,
  chapel_visited:        false,
  // === Aldermast quest 1: The Ashen Seal ===
  aldermast_met:         false,   // talked to Aldermast for first time
  ashen_seal_accepted:   false,   // accepted the quest
  ashen_seal_found:      false,   // picked up the Ashen Seal in catacombs
  ashen_seal_returned:   false,   // handed seal back to Aldermast
  // === Aldermast quest 2: The Starless Constellation ===
  constellation_accepted: false,
  void_shards_found:      0,      // 0-4 shards collected
  constellation_done:     false,
  // === Aldermast quest 3: The Fractured Grimoire ===
  grimoire_accepted:      false,
  tome_fragments_found:   0,      // 0-3 fragments collected
  grimoire_done:          false,
  // === Magic intro ===
  magic_intro_seen:       false,  // Aldermast taught player about rune crafting
};

