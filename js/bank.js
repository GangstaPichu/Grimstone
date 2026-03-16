// ============================================================
// BANK — Grimstone Savings Bank
// ============================================================

// ── Stock market companies ─────────────────────────────────
const STOCKS = {
  grimco:   { name:'Grimco Mining Co.',    icon:'⛏',  color:'#8b5a2b', basePrice:12 },
  ironvale: { name:'Ironvale Smelters',    icon:'🔥',  color:'#c84020', basePrice:25 },
  ashgold:  { name:'Ashenveil Gold Trust', icon:'🪙',  color:'#c8922a', basePrice:45 },
  verdant:  { name:'Verdant Farms Ltd.',   icon:'🌾',  color:'#4a8a2a', basePrice:8  },
};

// ── Savings bond tiers ─────────────────────────────────────
const BOND_TIERS = [
  { id:'short',  name:'Short Bond',  duration: 5*60*1000, rate:0.10, icon:'📜', desc:'5 min lockup — +10% return'  },
  { id:'medium', name:'Medium Bond', duration:15*60*1000, rate:0.25, icon:'📜', desc:'15 min lockup — +25% return' },
  { id:'long',   name:'Long Bond',   duration:30*60*1000, rate:0.50, icon:'📜', desc:'30 min lockup — +50% return' },
];

// ── Ensure bank state on player object ─────────────────────
function ensureBankState(p) {
  if(!p.bank) p.bank = { gold:0, bonds:[], stocks:{} };
  for(const id in STOCKS) if(!(id in p.bank.stocks)) p.bank.stocks[id] = 0;
}

// ── Add a specific amount of coins to inventory ────────────
function bankAddCoins(p, amount) {
  const slot = p.inventory.find(s => s?.id === 'coins');
  if(slot) {
    slot.qty += amount;
  } else {
    for(let i = 0; i < 28; i++) {
      if(!p.inventory[i]) { p.inventory[i] = { id:'coins', qty:amount }; break; }
    }
  }
}

// ── Stock price updates (random walk, every 30 s) ──────────
function updateStockPrices() {
  const now = Date.now();
  if(!state.stockMarket) {
    state.stockMarket = {
      prices: Object.fromEntries(Object.entries(STOCKS).map(([k,v]) => [k, v.basePrice])),
      lastUpdate: 0,
    };
  }
  if(now - state.stockMarket.lastUpdate < 30000) return;
  for(const id in STOCKS) {
    const base    = STOCKS[id].basePrice;
    const current = state.stockMarket.prices[id];
    const factor  = 0.88 + Math.random() * 0.26;   // ±13 % random walk
    state.stockMarket.prices[id] = Math.max(Math.round(base * 0.4), Math.min(Math.round(base * 2.5), Math.round(current * factor)));
  }
  state.stockMarket.lastUpdate = now;
}

// ── Check if any bonds have matured ───────────────────────
function checkBondMaturity() {
  const p = state.players[state.activePlayer];
  ensureBankState(p);
  const now = Date.now();
  const matured = [];
  p.bank.bonds = p.bank.bonds.filter(b => {
    if(now >= b.matureAt) { matured.push(b); return false; }
    return true;
  });
  matured.forEach(b => {
    const payout = Math.floor(b.amount * (1 + b.rate));
    p.bank.gold += payout;
    log(`💰 Your ${b.name} has matured! You received ${payout}g (${b.amount} + ${payout - b.amount} interest).`, 'gold');
  });
  if(matured.length) { buildInventory(); updateHUD(); }
}

// ── Main bank panel ────────────────────────────────────────
function openBankPanel(tab) {
  tab = tab || 'vault';
  checkBondMaturity();
  updateStockPrices();

  const p     = state.players[state.activePlayer];
  ensureBankState(p);
  const panel = document.getElementById('ctx-menu');
  panel.innerHTML = '';
  panel.style.display = 'block';
  panel.style.width   = '340px';
  panel.style.minWidth = '340px';

  // Centre panel in map container
  const _r = document.getElementById('map-container').getBoundingClientRect();
  panel.style.left = (_r.left + _r.width  / 2 - 170) + 'px';
  panel.style.top  = (_r.top  + _r.height / 2 - 210) + 'px';

  // Title
  const title = document.createElement('div');
  title.className = 'ctx-title';
  title.textContent = '🏦 Grimstone Savings Bank';
  panel.appendChild(title);

  // Tab bar
  const tabs = [
    { id:'vault',  label:'🔒 Vault'  },
    { id:'market', label:'📈 Market' },
    { id:'bonds',  label:'📜 Bonds'  },
  ];
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:2px;padding:4px 8px;border-bottom:1px solid #444;margin-bottom:2px;';
  tabs.forEach(({ id, label }) => {
    const btn = document.createElement('div');
    btn.style.cssText = 'flex:1;text-align:center;padding:5px 2px;cursor:pointer;font-size:11px;border-radius:3px;'
      + (id === tab ? 'background:#3a3a3a;color:#e0d8c0;font-weight:bold;' : 'color:#666;');
    btn.textContent = label;
    btn.onclick = () => openBankPanel(id);
    tabBar.appendChild(btn);
  });
  panel.appendChild(tabBar);

  if(tab === 'vault')  renderVaultTab(panel, p);
  else if(tab === 'market') renderMarketTab(panel, p);
  else                 renderBondsTab(panel, p);

  // Close
  const closeBtn = document.createElement('div');
  closeBtn.className = 'ctx-item';
  closeBtn.innerHTML = '<span class="ctx-icon">✖</span>Leave Bank';
  closeBtn.style.marginTop = '4px';
  closeBtn.onclick = () => { panel.style.width = ''; panel.style.minWidth = ''; hideCtxMenu(); };
  panel.appendChild(closeBtn);
}

// ── Vault tab ─────────────────────────────────────────────
function renderVaultTab(panel, p) {
  const body = document.createElement('div');
  body.style.cssText = 'padding:8px 12px;';

  const goldInHand = p.inventory.reduce((s, sl) => s + (sl?.id === 'coins' ? sl.qty : 0), 0);
  const info = document.createElement('div');
  info.style.cssText = 'margin-bottom:10px;padding:6px;background:#1a1a1a;border-radius:4px;font-size:11px;';
  info.innerHTML = `<div style="color:#c8922a;">💰 In hand: <b>${goldInHand}g</b></div>`
    + `<div style="color:#8aaa6a;margin-top:3px;">🏦 Stored: <b>${p.bank.gold}g</b></div>`;
  body.appendChild(info);

  body.appendChild(_bankAmountRow('Amount to deposit', '⬇ Deposit', amount => {
    const have = p.inventory.reduce((s, sl) => s + (sl?.id === 'coins' ? sl.qty : 0), 0);
    if(have < amount) { log('Not enough gold in hand.', 'bad'); return; }
    removeFromInventory('coins', amount);
    p.bank.gold += amount;
    log(`Deposited ${amount}g into the bank vault.`, 'good');
    buildInventory(); updateHUD();
    openBankPanel('vault');
  }));

  body.appendChild(_bankAmountRow('Amount to withdraw', '⬆ Withdraw', amount => {
    if(p.bank.gold < amount) { log('Not enough gold in the vault.', 'bad'); return; }
    p.bank.gold -= amount;
    bankAddCoins(p, amount);
    log(`Withdrew ${amount}g from the bank vault.`, 'good');
    buildInventory(); updateHUD();
    openBankPanel('vault');
  }));

  panel.appendChild(body);
}

// ── Market tab ────────────────────────────────────────────
function renderMarketTab(panel, p) {
  updateStockPrices();
  const body = document.createElement('div');
  body.style.cssText = 'padding:8px 12px;max-height:320px;overflow-y:auto;';

  const info = document.createElement('div');
  info.style.cssText = 'color:#c8922a;font-size:10px;margin-bottom:8px;';
  info.innerHTML = `🏦 Vault: <b>${p.bank.gold}g</b> &nbsp;·&nbsp; Prices update every 30 seconds.`;
  body.appendChild(info);

  Object.entries(STOCKS).forEach(([id, stock]) => {
    const price = state.stockMarket.prices[id];
    const owned = p.bank.stocks[id] || 0;
    const trend = price > stock.basePrice ? '▲' : price < stock.basePrice ? '▼' : '─';
    const trendColor = price > stock.basePrice ? '#5a9a5a' : price < stock.basePrice ? '#9a4a4a' : '#888';

    const card = document.createElement('div');
    card.style.cssText = 'margin-bottom:8px;padding:7px;background:#1a1a1a;border-radius:4px;border:1px solid #2a2a2a;';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="color:${stock.color};font-size:11px;font-weight:bold;">${stock.icon} ${stock.name}</span>
        <span style="color:${trendColor};font-size:11px;">${trend} ${price}g/share</span>
      </div>
      <div style="color:#666;font-size:10px;margin-bottom:5px;">
        You own: ${owned} share${owned!==1?'s':''} &nbsp;(worth ${owned*price}g)
      </div>`;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:4px;align-items:center;';

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min  = '1';
    qtyInput.value = '1';
    qtyInput.style.cssText = 'width:48px;background:#222;border:1px solid #444;color:#ccc;padding:3px 4px;border-radius:3px;font-size:10px;';

    const buyBtn = document.createElement('div');
    buyBtn.style.cssText = 'flex:1;background:#1e3a1e;color:#8ad88a;padding:4px 6px;border-radius:3px;cursor:pointer;font-size:10px;text-align:center;';
    buyBtn.textContent = '📈 Buy';
    buyBtn.onclick = () => {
      const qty  = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      const cost = qty * price;
      if(p.bank.gold < cost) { log(`Need ${cost}g in vault to buy ${qty} × ${stock.name}.`, 'bad'); return; }
      p.bank.gold -= cost;
      p.bank.stocks[id] = (p.bank.stocks[id] || 0) + qty;
      log(`Bought ${qty} share${qty>1?'s':''} of ${stock.name} for ${cost}g.`, 'good');
      openBankPanel('market');
    };

    const sellBtn = document.createElement('div');
    sellBtn.style.cssText = 'flex:1;background:#3a1e1e;color:#d88a8a;padding:4px 6px;border-radius:3px;cursor:pointer;font-size:10px;text-align:center;';
    sellBtn.textContent = '📉 Sell';
    sellBtn.onclick = () => {
      const qty  = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      if((p.bank.stocks[id] || 0) < qty) { log(`You only own ${owned} share${owned!==1?'s':''} of ${stock.name}.`, 'bad'); return; }
      const gain = qty * price;
      p.bank.stocks[id] -= qty;
      p.bank.gold += gain;
      log(`Sold ${qty} share${qty>1?'s':''} of ${stock.name} for ${gain}g.`, 'good');
      openBankPanel('market');
    };

    btnRow.appendChild(qtyInput);
    btnRow.appendChild(buyBtn);
    btnRow.appendChild(sellBtn);
    card.appendChild(btnRow);
    body.appendChild(card);
  });

  panel.appendChild(body);
}

// ── Bonds tab ─────────────────────────────────────────────
function renderBondsTab(panel, p) {
  const body = document.createElement('div');
  body.style.cssText = 'padding:8px 12px;max-height:360px;overflow-y:auto;';

  const info = document.createElement('div');
  info.style.cssText = 'color:#c8922a;font-size:10px;margin-bottom:8px;';
  info.innerHTML = `🏦 Vault: <b>${p.bank.gold}g</b> &nbsp;·&nbsp; Bonds lock gold and return it with interest.`;
  body.appendChild(info);

  // Active bonds
  if(p.bank.bonds.length > 0) {
    const activeHdr = document.createElement('div');
    activeHdr.style.cssText = 'color:#888;font-size:10px;margin-bottom:4px;letter-spacing:0.5px;text-transform:uppercase;';
    activeHdr.textContent = 'Active Bonds';
    body.appendChild(activeHdr);

    const now = Date.now();
    p.bank.bonds.forEach(b => {
      const remaining = Math.max(0, b.matureAt - now);
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      const payout = Math.floor(b.amount * (1 + b.rate));
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:4px;padding:5px 7px;background:#1a1a1a;border-radius:4px;border:1px solid #2e2a1a;font-size:10px;color:#c8b060;';
      row.innerHTML = `📜 <b>${b.name}</b> — ${b.amount}g → ${payout}g`
        + `<span style="color:#666;margin-left:6px;">${remaining>0 ? `${mins}m ${secs}s remaining` : 'Collecting...'}</span>`;
      body.appendChild(row);
    });

    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid #333;margin:8px 0 6px;';
    body.appendChild(sep);
  }

  // Purchase new bond
  const newHdr = document.createElement('div');
  newHdr.style.cssText = 'color:#888;font-size:10px;margin-bottom:6px;letter-spacing:0.5px;text-transform:uppercase;';
  newHdr.textContent = 'Purchase a Bond';
  body.appendChild(newHdr);

  BOND_TIERS.forEach(tier => {
    const card = document.createElement('div');
    card.style.cssText = 'margin-bottom:8px;padding:7px;background:#1a1a1a;border-radius:4px;border:1px solid #2a2416;';
    card.innerHTML = `
      <div style="color:#c8b060;font-size:11px;font-weight:bold;margin-bottom:2px;">${tier.icon} ${tier.name}</div>
      <div style="color:#888;font-size:10px;margin-bottom:5px;">${tier.desc}</div>`;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:4px;align-items:center;';

    const amtInput = document.createElement('input');
    amtInput.type = 'number';
    amtInput.min  = '1';
    amtInput.placeholder = 'Amount';
    amtInput.style.cssText = 'flex:1;background:#222;border:1px solid #444;color:#ccc;padding:3px 4px;border-radius:3px;font-size:10px;';

    const lockBtn = document.createElement('div');
    lockBtn.style.cssText = 'background:#3a2e10;color:#c8b060;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:10px;white-space:nowrap;';
    lockBtn.textContent = '📜 Lock In';
    lockBtn.onclick = () => {
      const amount = parseInt(amtInput.value, 10);
      if(!amount || amount < 1) { log('Enter a valid amount.', 'bad'); return; }
      if(p.bank.gold < amount) { log('Not enough gold in vault to purchase that bond.', 'bad'); return; }
      p.bank.gold -= amount;
      p.bank.bonds.push({ name:tier.name, amount, rate:tier.rate, matureAt:Date.now() + tier.duration });
      const payout = Math.floor(amount * (1 + tier.rate));
      log(`📜 Locked ${amount}g into a ${tier.name}. Matures in ${tier.duration/60000} min — you'll receive ${payout}g.`, 'gold');
      openBankPanel('bonds');
    };

    btnRow.appendChild(amtInput);
    btnRow.appendChild(lockBtn);
    card.appendChild(btnRow);
    body.appendChild(card);
  });

  panel.appendChild(body);
}

// ── Shared amount-input + action-button row ────────────────
function _bankAmountRow(placeholder, btnLabel, callback) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:5px;margin-bottom:6px;align-items:center;';

  const input = document.createElement('input');
  input.type = 'number';
  input.min  = '1';
  input.placeholder = placeholder;
  input.style.cssText = 'flex:1;background:#222;border:1px solid #444;color:#ccc;padding:4px 6px;border-radius:3px;font-size:11px;';

  const btn = document.createElement('div');
  btn.style.cssText = 'background:#2a3a2a;color:#acd;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px;white-space:nowrap;';
  btn.textContent = btnLabel;
  btn.onclick = () => {
    const amount = parseInt(input.value, 10);
    if(!amount || amount < 1) { log('Enter a valid amount.', 'bad'); return; }
    callback(amount);
  };

  row.appendChild(input);
  row.appendChild(btn);
  return row;
}

// ── Periodic bond maturity check (run on game tick) ────────
setInterval(() => {
  if(typeof state !== 'undefined' && state.players) checkBondMaturity();
}, 15000);  // check every 15 s
