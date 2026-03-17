// =====================================================================
// GRIMSTONE AUDIO ENGINE — Tone.js synthesised piano
// Uses PolySynth (FM + subtle reverb) — no external samples, loads instantly
// Day:   Slow arpeggiated D major, warm and gentle
// Night: Sparse D minor voicings, dark lowpass filter
// =====================================================================

// ======= SOUND EFFECTS =======
const SFX = (() => {
  let ctx = null;
  let masterGain = null;
  let ready = false;
  let vol = 0.6;

  function init() {
    if(ready) return;
    try {
      ctx = Tone.getContext().rawContext;
      masterGain = ctx.createGain();
      masterGain.gain.value = vol;
      masterGain.connect(ctx.destination);
      ready = true;
    } catch(e) { console.warn('SFX init failed', e); }
  }

  // Ensure AudioContext is running (browsers require user gesture)
  function resume() {
    if(ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setVol(v) {
    vol = v;
    if(masterGain) masterGain.gain.value = v;
  }

  // ---- Utility: play a series of oscillator notes ----
  function playTone(freq, type, startTime, duration, gainVal, fadeOut=true) {
    if(!ready) return;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    g.gain.setValueAtTime(gainVal, startTime);
    if(fadeOut) g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  function playNoise(type, startTime, duration, gainVal) {
    if(!ready) return;
    // White/pink noise via buffer
    const bufSize = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<bufSize;i++) data[i] = (Math.random()*2-1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    // Low-pass for "thud" feel
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = type==='thud' ? 200 : 800;
    g.gain.setValueAtTime(gainVal, startTime);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    src.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    src.start(startTime);
    src.stop(startTime + duration);
  }

  // ---- LEVEL UP FANFARE ----
  // Rising arpeggio with a triumphant bell tone
  function levelUp() {
    init(); resume();
    const now = ctx.currentTime + 0.05;
    // Chord: D major arpeggio ascending
    const notes = [293.66, 369.99, 440.00, 587.33, 740.00];
    notes.forEach((freq, i) => {
      const t = now + i * 0.09;
      // Bell-like sine with triangle harmonic
      playTone(freq,     'sine',     t, 0.8, 0.18);
      playTone(freq*2,   'triangle', t, 0.5, 0.07);
      playTone(freq*3,   'sine',     t, 0.35, 0.04);
    });
    // Final sustain chord
    const t2 = now + notes.length * 0.09 + 0.05;
    [293.66, 369.99, 440.00, 587.33].forEach((freq, i) => {
      playTone(freq, 'sine', t2, 1.4, 0.12);
    });
    // Shimmer noise burst
    playNoise('bright', now, 0.15, 0.08);
    playNoise('bright', t2, 0.3, 0.06);
  }

  // ---- MINING CLINK ----
  // Metal-on-rock: short sharp transient + ring
  function mine() {
    init(); resume();
    const now = ctx.currentTime + 0.02;
    // Impact thud
    playNoise('thud', now, 0.06, 0.4);
    // Ring (metal)
    playTone(1200, 'sine', now, 0.25, 0.12);
    playTone(1800, 'sine', now + 0.01, 0.2, 0.07);
    // Second hit echo at slight delay
    playNoise('thud', now + 0.07, 0.05, 0.25);
    playTone(1000, 'sine', now + 0.07, 0.18, 0.08);
  }

  // ---- AXE CHOP ----
  // Woody thwack: low thud + wood crack
  function chop() {
    init(); resume();
    const now = ctx.currentTime + 0.02;
    // Low woody thud
    playNoise('thud', now, 0.09, 0.5);
    // Wood crack — descending pitch
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(g); g.connect(masterGain);
    osc.start(now); osc.stop(now + 0.2);
  }

  // ---- FISHING SPLASH ----
  function fish() {
    init(); resume();
    const now = ctx.currentTime + 0.02;
    playNoise('bright', now, 0.08, 0.3);
    playTone(400, 'sine', now, 0.12, 0.08);
    playTone(600, 'sine', now + 0.03, 0.09, 0.05);
  }

  // ---- COMBAT HIT ----
  // Meaty impact
  function hit() {
    init(); resume();
    const now = ctx.currentTime + 0.01;
    playNoise('thud', now, 0.07, 0.35);
    playTone(120, 'sine', now, 0.1, 0.2);
    playTone(80,  'sine', now, 0.12, 0.15);
  }

  // ---- COMBAT MISS ----
  // Swish sound
  function miss() {
    init(); resume();
    const now = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(g); g.connect(masterGain);
    osc.start(now); osc.stop(now + 0.15);
  }

  // ---- RUNE / ALTAR HUM ----
  // Deep ominous resonance with slow vibrato
  function rune() {
    init(); resume();
    const now = ctx.currentTime + 0.05;
    // Root drone
    playTone(55,  'sine', now, 2.0, 0.14);
    playTone(110, 'sine', now, 2.0, 0.08);
    // Dissonant overtone — unsettling minor 2nd
    playTone(58.27,'sine', now + 0.3, 1.5, 0.06);
    // High shimmer
    playTone(880, 'sine', now, 1.8, 0.04);
    playTone(932, 'sine', now + 0.1, 1.6, 0.03);
    // Whisper noise
    playNoise('bright', now, 0.4, 0.06);
    playNoise('bright', now + 0.8, 0.3, 0.04);
  }

  // ---- ALTAR HUM ---- (deeper/darker than rune)
  function altar() {
    init(); resume();
    const now = ctx.currentTime + 0.05;
    playTone(41.2,  'sine', now, 2.5, 0.18);
    playTone(55,    'sine', now, 2.5, 0.10);
    playTone(82.4,  'sine', now + 0.2, 2.0, 0.07);
    // Trembling high note
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 1320;
    lfo.type = 'sine'; lfo.frequency.value = 4;
    lfoGain.gain.value = 30;
    g.gain.setValueAtTime(0.05, now + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    osc.connect(g); g.connect(masterGain);
    lfo.start(now); osc.start(now + 0.5);
    lfo.stop(now + 2.5); osc.stop(now + 2.5);
    playNoise('thud', now, 0.6, 0.10);
  }

  // ---- PORTAL WHOOSH ----
  function portal() {
    init(); resume();
    const now = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.4);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    osc.connect(g); g.connect(masterGain);
    osc.start(now); osc.stop(now + 0.7);
    playNoise('bright', now + 0.1, 0.5, 0.08);
  }

  // ---- CHEST OPEN ----
  function chest() {
    init(); resume();
    const now = ctx.currentTime + 0.02;
    // Creak: low rumble + squeak
    playNoise('thud', now, 0.15, 0.25);
    playTone(300, 'sawtooth', now, 0.12, 0.06);
    playTone(600, 'sine',     now + 0.1, 0.2, 0.07);
    // Shimmer of coins
    [1200,1500,1800,2100].forEach((f,i) => {
      playTone(f, 'sine', now + 0.18 + i*0.04, 0.18, 0.05);
    });
  }

  // ---- ITEM EQUIP ----
  function equip() {
    init(); resume();
    const now = ctx.currentTime + 0.02;
    playTone(440, 'triangle', now,       0.1, 0.12);
    playTone(550, 'triangle', now + 0.06, 0.1, 0.10);
    playTone(660, 'sine',     now + 0.12, 0.2, 0.09);
  }

  // ---- ITEM BUY ----
  function buy() {
    init(); resume();
    const now = ctx.currentTime + 0.02;
    playTone(523, 'sine', now,       0.08, 0.10);
    playTone(659, 'sine', now + 0.06, 0.08, 0.09);
    playTone(784, 'sine', now + 0.12, 0.15, 0.11);
  }

  // ---- DOOR OPEN ----
  // Heavy wooden door creak: low rumble + squeak + thud
  function door() {
    init(); resume();
    const now = ctx.currentTime + 0.02;
    // Low creak
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.22);
    g.gain.setValueAtTime(0.13, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(g); g.connect(masterGain);
    osc.start(now); osc.stop(now + 0.3);
    // High squeak
    const osc2 = ctx.createOscillator();
    const g2   = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(480, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(320, now + 0.18);
    g2.gain.setValueAtTime(0.07, now + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc2.connect(g2); g2.connect(masterGain);
    osc2.start(now + 0.04); osc2.stop(now + 0.25);
    // Door thud at end
    playNoise('thud', now + 0.2, 0.08, 0.18);
    // Warm interior ambience hint
    playTone(220, 'sine', now + 0.25, 0.4, 0.04);
  }

  return { init, resume, setVol, levelUp, mine, chop, fish, hit, miss, rune, altar, portal, chest, equip, buy, door };
})();

// ======= FIREFLY SYSTEM =======
const Fireflies = (() => {
  const MAX = 60;
  const flies = [];
  let initialized = false;

  // Zones that have fireflies
  const FIREFLY_ZONES = new Set([
    'ASHENVEIL', 'THE ASHWOOD VALE', 'THE WHISPERWOOD',
    'THE IRON PEAKS', 'THE CURSED MARSHES',
  ]);

  function shouldShow() {
    if(!currentMap) return false;
    const name = currentMap.name || '';
    // No fireflies indoors, in snowstorms, or wrong zones
    if(currentMap.isInterior) return false;
    if(Weather.current === Weather.SNOWSTORM) return false;
    return FIREFLY_ZONES.has(name);
  }

  function init() {
    flies.length = 0;
    // Seed each firefly with unique stable parameters
    for(let i = 0; i < MAX; i++) {
      const seed = i * 7919 + (worldSeed % 1000);
      const sr = (n) => { let v = Math.sin(seed*127.1+n*311.7)*43758.5453; return v-Math.floor(v); };
      flies.push({
        // World-space tile position (0.0–MAP_W / MAP_H range)
        tx: sr(0) * MAP_W,
        ty: sr(1) * MAP_H,
        // Drift parameters — lazy Lissajous float
        ax: 0.4 + sr(2) * 0.9,   // x amplitude in pixels
        ay: 0.3 + sr(3) * 0.7,   // y amplitude in pixels
        fx: 0.18 + sr(4) * 0.22, // x frequency
        fy: 0.13 + sr(5) * 0.19, // y frequency
        px: sr(6) * Math.PI * 2, // x phase offset
        py: sr(7) * Math.PI * 2, // y phase offset
        // Glow parameters — slow sinusoidal pulse, no hard on/off
        glowF: 0.10 + sr(8) * 0.18,   // glow cycle frequency (slow: ~8-16s per cycle)
        glowP: sr(9) * Math.PI * 2,    // glow phase offset
        glowMin: 0.05 + sr(10) * 0.12, // minimum brightness (never fully off)
        // Colour tint — warm amber-yellow only (cosy, not cool-green)
        hue: 38 + sr(11) * 22,         // 38=amber, 60=warm yellow
        // Size
        r: 1.2 + sr(12) * 1.0,
        // Slow drift velocity (tile/s)
        vx: (sr(13) - 0.5) * 0.008,
        vy: (sr(14) - 0.5) * 0.005,
      });
    }
    initialized = true;
  }

  function update(dt) {
    if(!initialized) return;
    for(const f of flies) {
      // Slow meander across map
      f.tx += f.vx * dt;
      f.ty += f.vy * dt;
      // Wrap around map edges
      if(f.tx < 0)     f.tx += MAP_W;
      if(f.tx > MAP_W) f.tx -= MAP_W;
      if(f.ty < 0)     f.ty += MAP_H;
      if(f.ty > MAP_H) f.ty -= MAP_H;
    }
  }

  function draw() {
    if(!shouldShow()) return;
    const nightA = getNightAlpha();
    if(nightA < 0.05) return; // only at night

    // Fade in as night deepens, fade out at dawn
    const fadeIn  = Math.min(1, nightA * 2.5);
    const now     = Date.now() * 0.001; // seconds
    const ox      = Math.round(camera.x);
    const oy      = Math.round(camera.y);
    const W       = canvas.width;
    const H       = canvas.height;

    ctx2.save();

    // Pre-bake one 32×32 glow sprite per unique hue (built once, reused every frame)
    if(!Fireflies._glowCache) Fireflies._glowCache = new Map();
    const gc = Fireflies._glowCache;

    // Collect visible flies and batch core dots into a single path per hue
    const hueBuckets = new Map(); // hue → [{sx,sy,r,alpha}]

    for(const f of flies) {
      const glowRaw = Math.sin(now * f.glowF * Math.PI * 2 + f.glowP);
      const blinkA  = f.glowMin + (1 - f.glowMin) * (glowRaw * 0.5 + 0.5);

      const wx = f.tx * TILE + Math.sin(now * f.fx + f.px) * f.ax * TILE * 0.5;
      const wy = f.ty * TILE + Math.sin(now * f.fy + f.py) * f.ay * TILE * 0.5;
      const sx = wx - ox;
      const sy = wy - oy;

      if(sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;

      const tileX = Math.floor(wx / TILE);
      const tileY = Math.floor(wy / TILE);
      if(!currentMap.tiles[tileY]) continue;
      const tileT = currentMap.tiles[tileY][tileX];
      if(tileT !== T.GRASS && tileT !== T.DARK_GRASS && tileT !== T.DIRT &&
         tileT !== T.FLOWER && tileT !== T.BUSH) continue;

      const alpha = fadeIn * blinkA * 0.42;
      const r     = f.r * (0.7 + blinkA * 0.3);
      const glowR = r * (4 + blinkA * 3);
      const h     = f.hue;

      // Draw glow halo using a cached sprite scaled to glowR*2
      if(!gc.has(h)) {
        const sz = 64;
        const oc = document.createElement('canvas');
        oc.width = oc.height = sz;
        const oc2 = oc.getContext('2d');
        const g = oc2.createRadialGradient(sz/2,sz/2,0,sz/2,sz/2,sz/2);
        g.addColorStop(0,   `hsla(${h},80%,80%,0.75)`);
        g.addColorStop(0.3, `hsla(${h},75%,65%,0.38)`);
        g.addColorStop(0.7, `hsla(${h},70%,50%,0.10)`);
        g.addColorStop(1,   `hsla(${h},65%,40%,0)`);
        oc2.fillStyle = g;
        oc2.fillRect(0,0,sz,sz);
        gc.set(h, oc);
      }
      const sprite = gc.get(h);
      const d = glowR * 2;
      ctx2.globalAlpha = alpha;
      ctx2.drawImage(sprite, sx - glowR, sy - glowR, d, d);
      ctx2.globalAlpha = 1;

      // Batch core dots by hue
      if(!hueBuckets.has(h)) hueBuckets.set(h, []);
      hueBuckets.get(h).push({sx, sy, r, alpha});
    }

    // Draw all core dots — one path per hue (avoids redundant fillStyle switches)
    for(const [h, dots] of hueBuckets) {
      ctx2.beginPath();
      for(const d of dots) {
        ctx2.moveTo(d.sx + d.r, d.sy);
        ctx2.arc(d.sx, d.sy, d.r, 0, Math.PI * 2);
      }
      // Use median alpha for the batch (minor visual approximation, huge perf win)
      const medAlpha = dots.reduce((a,d)=>a+d.alpha,0)/dots.length;
      ctx2.fillStyle = `hsla(${h}, 85%, 88%, ${medAlpha * 0.85})`;
      ctx2.fill();
    }

    ctx2.restore();
  }

  return { init, update, draw };
})();


// ======= WEATHER SYSTEM =======
const Weather = (() => {
  // Weather types
  const CLEAR = 0, RAIN = 1, HEAVY_RAIN = 2, FOG = 3, SNOW = 4, SNOWSTORM = 5;

  // Per-day weather state — seeded from worldSeed + gameDay
  let currentWeather = CLEAR;
  let targetWeather  = CLEAR;
  let weatherAlpha   = 0;    // 0–1 blend toward targetWeather
  let lastDay = -1;

  // Rain particle pool
  const RAIN_COUNT = 180;
  const SNOW_COUNT = 120;
  let weatherEnabled = true;
  const particles = [];

  function seededRand(seed) {
    let s = seed;
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >> 7))  >>> 0;
    s = (s ^ (s << 17)) >>> 0;
    return (s >>> 0) / 4294967295;
  }

  function pickWeatherForDay(day, zoneName) {
    const seed = (worldSeed * 31 + day * 1337) >>> 0;
    const r = seededRand(seed);
    const r2 = seededRand(seed + 7);

    // Zone-specific weights
    if(zoneName === 'STORMCRAG REACH' || zoneName === 'AETHERIC SPIRE') {
      if(r < 0.25) return SNOWSTORM;
      if(r < 0.55) return SNOW;
      if(r < 0.70) return HEAVY_RAIN;
      return CLEAR;
    }
    if(zoneName === 'THE WHISPERWOOD') {
      if(r < 0.30) return FOG;
      if(r < 0.50) return RAIN;
      if(r < 0.60) return HEAVY_RAIN;
      return CLEAR;
    }
    if(zoneName === 'THE CURSED MARSHES' || zoneName === 'THE OBSIDIAN DEPTHS') {
      if(r < 0.20) return FOG;
      if(r < 0.45) return HEAVY_RAIN;
      if(r < 0.60) return RAIN;
      return CLEAR;
    }
    // Default zones (Ashenveil, Ashwood Vale, Iron Peaks, dungeons)
    if(zoneName && zoneName.includes('CRYPT')) return CLEAR;
    if(zoneName && (zoneName.includes('DUNGEON') || zoneName.includes('DEPTHS') || zoneName.includes('CATACOMB') || zoneName.includes('SPIRE'))) return CLEAR;
    if(r < 0.18) return HEAVY_RAIN;
    if(r < 0.40) return RAIN;
    return CLEAR;
  }

  function initParticles() {
    particles.length = 0;
    const W = canvas.width, H = canvas.height;
    for(let i = 0; i < Math.max(RAIN_COUNT, SNOW_COUNT); i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 0, len: 0, drift: 0, size: 0,
        alpha: 0,
      });
    }
  }

  function tick() {
    if(!currentMap) return;
    const zoneName = currentMap.name || '';
    const isIndoor = currentMap.isInterior &&
      (zoneName.includes('CRYPT') || zoneName.includes('CATACOMB') ||
       zoneName.includes('INN') || zoneName.includes('IRON DEPTHS'));

    // Update weather once per day (or on zone change)
    if(gameDay !== lastDay) {
      lastDay = gameDay;
      targetWeather = isIndoor ? CLEAR : pickWeatherForDay(gameDay, zoneName);
      weatherAlpha = 0;
    }

    // Blend toward target
    if(currentWeather !== targetWeather) {
      weatherAlpha += 0.008;
      if(weatherAlpha >= 1) { currentWeather = targetWeather; weatherAlpha = 1; }
    } else {
      weatherAlpha = 1;
    }

    // Force clear indoors
    if(isIndoor) { currentWeather = CLEAR; weatherAlpha = 0; }
  }

  function getIntensity() {
    if(currentWeather === CLEAR) return 0;
    return (currentWeather === targetWeather) ? weatherAlpha : weatherAlpha * 0.7;
  }

  function draw() {
    if(!canvas || !ctx2) return;
    if(!weatherEnabled) return;
    const W = canvas.width, H = canvas.height;
    const intensity = getIntensity();
    if(intensity <= 0.01) return;

    const now = Date.now();
    const w = currentWeather;

    // ── FOG ──────────────────────────────────────────────────
    if(w === FOG) {
      // Multiple layers of drifting fog panels
      ctx2.save();
      for(let layer = 0; layer < 3; layer++) {
        const speed   = 0.018 + layer * 0.009;
        const offsetX = ((now * speed * 0.001) % (W * 2)) - W;
        const offsetY = Math.sin(now * 0.0003 + layer * 1.1) * 25;
        const fogAlpha = (0.13 + layer * 0.07) * intensity;

        // Irregular fog patches using overlapping ellipses
        ctx2.globalAlpha = fogAlpha;
        for(let i = 0; i < 6; i++) {
          const fx = ((i * 190 + offsetX) % (W + 200)) - 100;
          const fy = H * (0.2 + layer * 0.22) + offsetY + Math.sin(i * 2.3) * 40;
          const rx = 180 + i * 30;
          const ry = 60 + layer * 20 + Math.sin(i) * 15;
          const fogGrad = ctx2.createRadialGradient(fx, fy, 0, fx, fy, rx);
          fogGrad.addColorStop(0, `rgba(180,190,200,1)`);
          fogGrad.addColorStop(0.6, `rgba(160,175,185,0.5)`);
          fogGrad.addColorStop(1, `rgba(140,160,170,0)`);
          ctx2.fillStyle = fogGrad;
          ctx2.beginPath();
          ctx2.ellipse(fx, fy, rx, ry, 0, 0, Math.PI*2);
          ctx2.fill();
        }
      }
      // Ground-hugging fog strip at bottom
      const groundFog = ctx2.createLinearGradient(0, H * 0.65, 0, H);
      groundFog.addColorStop(0, `rgba(160,175,185,0)`);
      groundFog.addColorStop(1, `rgba(160,175,185,${0.22 * intensity})`);
      ctx2.globalAlpha = 1;
      ctx2.fillStyle = groundFog;
      ctx2.fillRect(0, H * 0.65, W, H * 0.35);
      ctx2.restore();
      return;
    }

    // ── RAIN ─────────────────────────────────────────────────
    if(w === RAIN || w === HEAVY_RAIN) {
      const heavy = (w === HEAVY_RAIN);
      const count = heavy ? RAIN_COUNT : Math.floor(RAIN_COUNT * 0.55);
      const baseSpeed = heavy ? 14 : 9;
      const windAngle = Math.sin(now * 0.00015) * 0.18; // gentle sway

      // Sky darkening
      ctx2.save();
      ctx2.fillStyle = `rgba(10,14,22,${(heavy ? 0.22 : 0.12) * intensity})`;
      ctx2.fillRect(0, 0, W, H);

      // Rain streaks
      ctx2.strokeStyle = heavy
        ? `rgba(160,185,220,${0.45 * intensity})`
        : `rgba(140,170,210,${0.30 * intensity})`;
      ctx2.lineWidth = heavy ? 1.1 : 0.8;
      ctx2.beginPath();

      for(let i = 0; i < count; i++) {
        if(!particles[i]) continue;
        const p = particles[i];
        // Update
        const dt = 0.016;
        p.x += windAngle * baseSpeed * dt * 60;
        p.y += baseSpeed * dt * 60 * (0.85 + (i % 5) * 0.06);
        if(p.y > H + 20) { p.y = -10 - Math.random() * 40; p.x = Math.random() * (W + 50) - 25; }
        if(p.x > W + 20) p.x -= W + 40;
        if(p.x < -20)    p.x += W + 40;

        const len = heavy ? 10 + (i % 4) * 2 : 7 + (i % 3) * 2;
        ctx2.moveTo(p.x, p.y);
        ctx2.lineTo(p.x + windAngle * len, p.y + len);
      }
      ctx2.stroke();

      // Splash ripples on ground (near bottom)
      ctx2.globalAlpha = 0.18 * intensity;
      const rippleCount = heavy ? 12 : 6;
      for(let i = 0; i < rippleCount; i++) {
        const seed = (i * 7919 + Math.floor(now / 400 + i * 1.7)) % 9999;
        const rx = (seed * 137) % W;
        const ry = H * 0.55 + (seed * 73) % (H * 0.45);
        const age = ((now / 400) + i * 1.7) % 1;
        const r = age * (heavy ? 7 : 5);
        ctx2.strokeStyle = `rgba(140,180,220,${(1-age)*0.6})`;
        ctx2.lineWidth = 0.7;
        ctx2.beginPath();
        ctx2.ellipse(rx, ry, r, r * 0.35, 0, 0, Math.PI*2);
        ctx2.stroke();
      }
      ctx2.globalAlpha = 1;
      ctx2.restore();
      return;
    }

    // ── SNOW ─────────────────────────────────────────────────
    if(w === SNOW || w === SNOWSTORM) {
      const storm  = (w === SNOWSTORM);
      const count  = storm ? SNOW_COUNT : Math.floor(SNOW_COUNT * 0.55);
      const drift  = Math.sin(now * 0.0002) * (storm ? 1.5 : 0.7);

      // Sky tint — cool grey-blue
      ctx2.save();
      ctx2.fillStyle = `rgba(20,22,35,${(storm ? 0.18 : 0.08) * intensity})`;
      ctx2.fillRect(0, 0, W, H);

      // Update all particles first, then batch-draw by size bucket (3 draw calls max)
      const szBuckets = [{r:1.0,ps:[]},{r:1.6,ps:[]},{r:2.2,ps:[]}];
      for(let i = 0; i < count; i++) {
        if(!particles[i]) continue;
        const p = particles[i];
        const dt = 0.016;
        const baseF = storm ? 2.8 : 1.6;
        const wobble = Math.sin(now * 0.001 * (0.5 + (i % 7) * 0.1) + i) * (storm ? 1.2 : 0.5);
        p.x += (drift + wobble) * dt * 60 * 0.3;
        p.y += baseF * dt * 60 * (0.7 + (i % 5) * 0.12);
        if(p.y > H + 10) { p.y = -5 - Math.random() * 30; p.x = Math.random() * (W + 40) - 20; }
        if(p.x > W + 10) p.x -= W + 20;
        if(p.x < -10)    p.x += W + 20;
        szBuckets[i % 3].ps.push(p);
      }
      // One draw call per size bucket
      const alpha = (storm ? 0.75 : 0.55) * intensity;
      ctx2.fillStyle = `rgba(220,230,245,${alpha})`;
      for(const bucket of szBuckets) {
        const sz = storm ? bucket.r * 1.1 : bucket.r * 0.9;
        ctx2.beginPath();
        for(const p of bucket.ps) {
          ctx2.moveTo(p.x + sz, p.y);
          ctx2.arc(p.x, p.y, sz, 0, Math.PI*2);
        }
        ctx2.fill();
      }

      // Ground snow accumulation — white strip at very bottom
      if(!currentMap.isInterior) {
        const snowGrad = ctx2.createLinearGradient(0, H * 0.78, 0, H);
        snowGrad.addColorStop(0, `rgba(200,215,235,0)`);
        snowGrad.addColorStop(1, `rgba(200,215,235,${(storm ? 0.28 : 0.14) * intensity})`);
        ctx2.fillStyle = snowGrad;
        ctx2.fillRect(0, H * 0.78, W, H * 0.22);
      }
      ctx2.restore();
    }
  }

  function getName() {
    return [,'Rain','Heavy Rain','Fog','Snow','Snowstorm'][currentWeather] || '';
  }

  function forceChange() {
    // Called on zone change so weather picks up new zone context
    lastDay = -1;
  }

  let nightMarketActive = false;
  function forceNightMarket(enable) {
    nightMarketActive = enable;
    if(enable) {
      targetWeather = FOG;
      weatherAlpha = 0; // blend in smoothly
    } else {
      lastDay = -1; // recalculate normal weather
    }
  }

  return { tick, draw, initParticles, getName, forceChange, forceNightMarket, getIntensity,
           setEnabled(v) { weatherEnabled = v; },
           get current() { return currentWeather; },
           CLEAR, RAIN, HEAVY_RAIN, FOG, SNOW, SNOWSTORM };
})();


const Music = (() => {
  let isReady=false, isStarted=false;
  let enabled     = localStorage.getItem('grimstone_music_enabled') !== '0';
  let userVolume  = parseInt(localStorage.getItem('grimstone_music_vol') ?? '35') / 100;
  let currentTheme='town_day', targetTheme='town_day';
  let dest=null;
  const synths={};   // named synth instances
  const parts=[];    // all Tone.Parts, stored flat

  // ─────────────────────────────────────────────────────────────────────
  // NOTE SHORTHAND helpers
  // Each note row: [time, pitch_or_array, dur, vel=0.6]
  // time: 'bar:beat:16th'   dur: '4n' '8n' '2n' '4n.' etc.
  // ─────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────
  // THEME DATA
  // Each theme: { bpm, loop, tracks:{ voiceName:{ notes[] } } }
  // voices: bass | chords | melody | arp | pad | perc
  // ─────────────────────────────────────────────────────────────────────
  const THEMES = {

    // ══════════════════════════════════════════════════════
    // ASHENVEIL DAY — D major, 120 bpm, lively market town
    // ══════════════════════════════════════════════════════
    town_day: { bpm:120, loop:'8m', tracks:{
      bass:[
        ['0:0:0','D2','4n'],['0:2:0','A2','8n'],['0:3:0','D2','8n'],
        ['1:0:0','G2','4n'],['1:2:0','D3','8n'],['1:3:0','G2','8n'],
        ['2:0:0','A2','4n'],['2:2:0','E3','8n'],['2:3:0','A2','8n'],
        ['3:0:0','D2','4n'],['3:2:0','F#2','8n'],['3:3:0','A2','8n'],
        ['4:0:0','G2','4n'],['4:2:0','D3','8n'],['4:3:0','G2','8n'],
        ['5:0:0','E2','4n'],['5:2:0','A2','8n'],['5:3:0','E2','8n'],
        ['6:0:0','A2','4n'],['6:2:0','C#3','8n'],['6:3:0','E2','8n'],
        ['7:0:0','D2','4n.'],['7:3:0','D2','8n'],
      ],
      chords:[
        // staccato lute strums on beats 2 & 4
        ['0:1:0',['D3','F#3','A3'],'8n',0.5],['0:3:0',['D3','F#3','A3'],'8n',0.45],
        ['1:1:0',['G3','B3','D4'],'8n',0.5],['1:3:0',['G3','B3','D4'],'8n',0.45],
        ['2:1:0',['A3','C#4','E4'],'8n',0.5],['2:3:0',['A3','C#4','E4'],'8n',0.45],
        ['3:1:0',['D3','F#3','A3'],'8n',0.5],['3:3:0',['A3','D4','F#4'],'8n',0.45],
        ['4:1:0',['G3','B3','D4'],'8n',0.5],['4:3:0',['G3','B3','D4'],'8n',0.45],
        ['5:1:0',['E3','G#3','B3'],'8n',0.5],['5:3:0',['E3','A3','C#4'],'8n',0.45],
        ['6:1:0',['A3','C#4','E4'],'8n',0.5],['6:3:0',['A3','E4','A4'],'8n',0.5],
        ['7:1:0',['D3','F#3','A3'],'8n',0.55],['7:3:0',['D3','A3','D4'],'8n',0.55],
      ],
      melody:[
        ['0:0:0','F#5','4n',0.6],['0:1:0','E5','8n',0.5],['0:1:2','D5','8n',0.5],
        ['0:2:0','E5','4n',0.55],['0:3:0','F#5','8n',0.6],['0:3:2','G5','8n',0.6],
        ['1:0:0','A5','4n.',0.65],['1:2:2','G5','8n',0.5],
        ['1:3:0','F#5','8n',0.5],['1:3:2','E5','8n',0.5],
        ['2:0:0','D5','4n',0.55],['2:1:0','E5','8n',0.5],['2:1:2','F#5','8n',0.55],
        ['2:2:0','G5','4n',0.6],['2:3:0','A5','8n',0.6],['2:3:2','B5','8n',0.65],
        ['3:0:0','A5','2n.',0.65],
        ['4:0:0','G5','4n',0.6],['4:1:0','F#5','8n',0.55],['4:1:2','E5','8n',0.5],
        ['4:2:0','D5','4n',0.5],['4:3:0','E5','8n',0.5],['4:3:2','F#5','8n',0.55],
        ['5:0:0','E5','4n.',0.55],['5:2:2','D5','8n',0.5],
        ['5:3:0','C#5','4n',0.5],
        ['6:0:0','D5','8n',0.55],['6:0:2','E5','8n',0.55],['6:1:0','F#5','4n',0.6],
        ['6:2:0','A5','4n',0.65],['6:3:0','G5','8n',0.6],['6:3:2','F#5','8n',0.55],
        ['7:0:0','D5','2n.',0.65],
      ],
    }},

    // ══════════════════════════════════════════════════════
    // ASHENVEIL NIGHT — D minor, 75 bpm, melancholy & sparse
    // ══════════════════════════════════════════════════════
    town_night: { bpm:75, loop:'8m', tracks:{
      bass:[
        ['0:0:0','D2','2n'],  ['2:0:0','A1','2n'],
        ['4:0:0','F2','2n'],  ['6:0:0','C2','2n'],
        ['8:0:0','Bb1','2n'], ['10:0:0','A1','2n'],
        ['12:0:0','D2','2n'], ['14:0:0','E2','2n'],
      ],
      chords:[
        ['0:0:0',['D3','F3','A3'],'4n.',0.4],
        ['2:0:0',['A2','E3','A3'],'4n.',0.35],
        ['4:0:0',['F3','A3','C4'],'4n.',0.4],
        ['6:0:0',['C3','G3','Bb3'],'4n.',0.35],
        ['8:0:0',['Bb2','F3','D4'],'4n.',0.4],
        ['10:0:0',['A2','C3','E3'],'4n.',0.35],
        ['12:0:0',['D3','F3','A3'],'4n.',0.4],
        ['14:0:0',['E3','G#3','B3'],'4n.',0.4],
        // second chord on beat 3
        ['0:2:0',['F3','A3','C4'],'4n',0.3],
        ['4:2:0',['A2','E3'],'4n',0.3],
        ['8:2:0',['D3','F3'],'4n',0.3],
        ['12:2:0',['A2','C3','E3'],'4n',0.3],
      ],
      melody:[
        ['1:0:0','A4','4n.',0.45],['1:2:2','G4','8n',0.4],
        ['2:0:0','F4','4n',0.45],['2:2:0','E4','4n.',0.4],
        ['3:0:0','D4','2n',0.45],
        ['5:0:0','F4','4n',0.4],['5:1:2','G4','8n',0.4],['5:2:0','A4','4n',0.45],
        ['6:0:0','G4','4n.',0.4],['6:2:2','F4','8n',0.35],
        ['7:0:0','E4','2n',0.45],
        ['9:0:0','D4','4n',0.4],['9:2:0','C4','4n',0.4],
        ['10:0:0','Bb3','4n.',0.4],['10:2:2','A3','8n',0.35],
        ['11:0:0','D4','2n',0.45],
        ['13:0:0','F4','4n',0.4],['13:1:2','E4','8n',0.4],['13:2:0','D4','4n',0.45],
        ['14:0:0','E4','4n.',0.45],['14:2:2','F#4','8n',0.45],
        ['15:0:0','D4','2n.',0.5],
      ],
    }},

    // ══════════════════════════════════════════════════════
    // WILDERNESS DAY — E Dorian, 135 bpm, driving adventure
    // Very different from town: modal key, faster, busier arp
    // ══════════════════════════════════════════════════════
    wild_day: { bpm:135, loop:'8m', tracks:{
      bass:[
        ['0:0:0','E2','8n'],['0:1:0','E2','8n'],['0:2:0','G2','8n'],['0:3:0','A2','8n'],
        ['1:0:0','B2','8n'],['1:1:0','A2','8n'],['1:2:0','G2','8n'],['1:3:0','E2','8n'],
        ['2:0:0','D2','8n'],['2:1:0','D2','8n'],['2:2:0','F#2','8n'],['2:3:0','A2','8n'],
        ['3:0:0','G2','4n'],['3:2:0','E2','4n'],
        ['4:0:0','A2','8n'],['4:1:0','A2','8n'],['4:2:0','C3','8n'],['4:3:0','E3','8n'],
        ['5:0:0','G2','8n'],['5:1:0','F#2','8n'],['5:2:0','E2','8n'],['5:3:0','D2','8n'],
        ['6:0:0','C2','8n'],['6:1:0','C2','8n'],['6:2:0','E2','8n'],['6:3:0','G2','8n'],
        ['7:0:0','B1','4n'],['7:2:0','E2','4n'],
      ],
      arp:[
        // fast 8th-note arpeggio, constant motion
        ['0:0:0','E4','8n',0.45],['0:0:2','G4','8n',0.4],['0:1:0','B4','8n',0.45],['0:1:2','E5','8n',0.4],
        ['0:2:0','B4','8n',0.4],['0:2:2','G4','8n',0.4],['0:3:0','E4','8n',0.4],['0:3:2','B3','8n',0.4],
        ['1:0:0','A4','8n',0.45],['1:0:2','C#5','8n',0.4],['1:1:0','E5','8n',0.45],['1:1:2','A5','8n',0.4],
        ['1:2:0','E5','8n',0.4],['1:2:2','C#5','8n',0.4],['1:3:0','A4','8n',0.4],['1:3:2','E4','8n',0.4],
        ['2:0:0','D4','8n',0.45],['2:0:2','F#4','8n',0.4],['2:1:0','A4','8n',0.45],['2:1:2','D5','8n',0.4],
        ['2:2:0','A4','8n',0.4],['2:2:2','F#4','8n',0.4],['2:3:0','D4','8n',0.4],['2:3:2','A3','8n',0.4],
        ['3:0:0','G4','8n',0.45],['3:0:2','B4','8n',0.4],['3:1:0','D5','8n',0.45],['3:1:2','G5','8n',0.4],
        ['3:2:0','E4','8n',0.4],['3:2:2','G4','8n',0.4],['3:3:0','B4','8n',0.4],['3:3:2','E5','8n',0.4],
        ['4:0:0','A4','8n',0.45],['4:0:2','C5','8n',0.4],['4:1:0','E5','8n',0.45],['4:1:2','A5','8n',0.4],
        ['4:2:0','G4','8n',0.4],['4:2:2','C5','8n',0.4],['4:3:0','E5','8n',0.4],['4:3:2','G5','8n',0.4],
        ['5:0:0','G4','8n',0.45],['5:0:2','B4','8n',0.4],['5:1:0','D5','8n',0.45],['5:1:2','G5','8n',0.4],
        ['5:2:0','E4','8n',0.4],['5:2:2','A4','8n',0.4],['5:3:0','C#5','8n',0.4],['5:3:2','E5','8n',0.4],
        ['6:0:0','C4','8n',0.45],['6:0:2','E4','8n',0.4],['6:1:0','G4','8n',0.45],['6:1:2','C5','8n',0.4],
        ['6:2:0','G4','8n',0.4],['6:2:2','E4','8n',0.4],['6:3:0','C4','8n',0.4],['6:3:2','G3','8n',0.4],
        ['7:0:0','B3','8n',0.45],['7:0:2','E4','8n',0.4],['7:1:0','G4','8n',0.45],['7:1:2','B4','8n',0.4],
        ['7:2:0','E5','8n',0.5],['7:2:2','G5','8n',0.5],['7:3:0','B5','8n',0.55],['7:3:2','E5','8n',0.45],
      ],
      melody:[
        ['0:0:0','E5','8n',0.7],['0:0:2','D5','8n',0.6],['0:1:0','B4','4n',0.65],
        ['0:2:0','G4','8n',0.6],['0:2:2','A4','8n',0.6],['0:3:0','B4','4n',0.65],
        ['1:0:0','E5','4n.',0.7],['1:2:2','D5','8n',0.6],
        ['1:3:0','C#5','8n',0.6],['1:3:2','B4','8n',0.55],
        ['2:0:0','A4','8n',0.6],['2:0:2','B4','8n',0.6],['2:1:0','C#5','4n',0.65],
        ['2:2:0','D5','4n',0.65],['2:3:0','E5','8n',0.7],['2:3:2','F#5','8n',0.7],
        ['3:0:0','G5','4n.',0.75],['3:2:2','F#5','8n',0.65],
        ['3:3:0','E5','4n',0.65],
        ['4:0:0','A5','4n',0.7],['4:1:0','G5','8n',0.65],['4:1:2','F#5','8n',0.6],
        ['4:2:0','E5','4n',0.65],['4:3:0','D5','8n',0.6],['4:3:2','C5','8n',0.55],
        ['5:0:0','B4','4n.',0.65],['5:2:2','A4','8n',0.6],
        ['5:3:0','G4','4n',0.6],
        ['6:0:0','A4','8n',0.6],['6:0:2','B4','8n',0.6],['6:1:0','C5','4n',0.65],
        ['6:2:0','B4','8n',0.6],['6:2:2','A4','8n',0.55],['6:3:0','G4','4n',0.6],
        ['7:0:0','E4','2n.',0.65],
      ],
    }},

    // ══════════════════════════════════════════════════════
    // WILDERNESS NIGHT — E minor, 85 bpm, tense & threatening
    // ══════════════════════════════════════════════════════
    wild_night: { bpm:85, loop:'8m', tracks:{
      bass:[
        ['0:0:0','E2','4n'],['0:2:0','B1','4n'],
        ['1:0:0','C2','4n'],['1:2:0','G1','4n'],
        ['2:0:0','A1','4n'],['2:2:0','E2','4n'],
        ['3:0:0','D2','2n'],
        ['4:0:0','E2','4n'],['4:2:0','D2','4n'],
        ['5:0:0','C2','4n'],['5:2:0','A1','4n'],
        ['6:0:0','Bb1','4n'],['6:2:0','F1','4n'],
        ['7:0:0','E1','2n'],
      ],
      chords:[
        ['0:0:0',['E3','G3','B3'],'8n',0.4],['0:2:0',['B2','D3','F#3'],'8n',0.35],
        ['1:0:0',['C3','E3','G3'],'8n',0.4],['1:2:0',['G2','B2','D3'],'8n',0.35],
        ['2:0:0',['A2','C3','E3'],'8n',0.4],['2:2:0',['E3','G3','B3'],'8n',0.4],
        ['3:0:0',['D3','F3','A3'],'4n.',0.4],
        ['4:0:0',['E3','G3','B3'],'8n',0.4],['4:2:0',['D3','F3','A3'],'8n',0.35],
        ['5:0:0',['C3','Eb3','G3'],'8n',0.4],['5:2:0',['A2','C3','E3'],'8n',0.35],
        ['6:0:0',['Bb2','D3','F3'],'8n',0.4],['6:2:0',['F2','A2','C3'],'8n',0.35],
        ['7:0:0',['E3','G3','B3'],'4n.',0.45],
      ],
      melody:[
        ['0:1:0','B4','4n',0.5],['0:2:2','A4','8n',0.45],['0:3:0','G4','4n',0.5],
        ['1:0:0','F4','4n.',0.5],['1:2:2','E4','8n',0.45],['1:3:0','D4','8n',0.4],
        ['2:0:0','C4','4n',0.5],['2:2:0','B3','4n.',0.5],
        ['3:2:0','E4','2n',0.5],
        ['4:0:0','G4','4n',0.55],['4:1:2','F4','8n',0.45],['4:2:0','E4','4n',0.5],
        ['5:0:0','D4','4n.',0.5],['5:2:2','C4','8n',0.4],['5:3:0','B3','4n',0.45],
        ['6:0:0','Bb3','4n',0.45],['6:2:0','A3','4n',0.45],
        ['7:0:0','E3','2n.',0.5],
      ],
    }},

    // ══════════════════════════════════════════════════════
    // INN — G major, 160 bpm jig, warm & boisterous
    // ══════════════════════════════════════════════════════
    inn: { bpm:160, loop:'8m', tracks:{
      bass:[
        // walking bass — lots of movement
        ['0:0:0','G2','4n'],['0:1:0','B2','8n'],['0:1:2','D3','8n'],['0:2:0','G2','4n'],['0:3:0','D3','8n'],['0:3:2','B2','8n'],
        ['1:0:0','C3','4n'],['1:1:0','E3','8n'],['1:1:2','G3','8n'],['1:2:0','C3','4n'],['1:3:0','G2','8n'],['1:3:2','E3','8n'],
        ['2:0:0','D3','4n'],['2:1:0','F#3','8n'],['2:1:2','A3','8n'],['2:2:0','D3','4n'],['2:3:0','A2','8n'],['2:3:2','F#2','8n'],
        ['3:0:0','G2','4n'],['3:1:0','A2','8n'],['3:1:2','B2','8n'],['3:2:0','D3','4n'],['3:3:0','G3','4n'],
        ['4:0:0','Em2','4n'],['4:0:0','E3','4n'],['4:1:0','G3','8n'],['4:1:2','B3','8n'],['4:2:0','E3','4n'],['4:3:0','B2','8n'],['4:3:2','G2','8n'],
        ['5:0:0','C3','4n'],['5:1:0','E3','8n'],['5:1:2','G3','8n'],['5:2:0','C4','4n'],['5:3:0','G3','4n'],
        ['6:0:0','A3','4n'],['6:1:0','C4','8n'],['6:1:2','E4','8n'],['6:2:0','A3','4n'],['6:3:0','E3','8n'],['6:3:2','C3','8n'],
        ['7:0:0','D3','4n'],['7:1:0','G3','4n'],['7:2:0','D4','4n'],['7:3:0','G3','4n'],
      ],
      chords:[
        // off-beat strums — classic jig feel
        ['0:0:2',['G3','B3','D4'],'8n',0.55],['0:1:2',['G3','B3','D4'],'8n',0.5],
        ['0:2:2',['G3','B3','D4'],'8n',0.55],['0:3:2',['G3','D4','G4'],'8n',0.5],
        ['1:0:2',['C3','E3','G3'],'8n',0.55],['1:1:2',['C4','E4','G4'],'8n',0.5],
        ['1:2:2',['C3','G3','C4'],'8n',0.55],['1:3:2',['C3','E3','G3'],'8n',0.5],
        ['2:0:2',['D3','F#3','A3'],'8n',0.55],['2:1:2',['D4','F#4','A4'],'8n',0.5],
        ['2:2:2',['D3','A3','D4'],'8n',0.55],['2:3:2',['D3','F#3','A3'],'8n',0.5],
        ['3:0:2',['G3','B3','D4'],'8n',0.55],['3:1:2',['G3','D4','G4'],'8n',0.5],
        ['3:2:2',['G3','B3','D4'],'8n',0.6],['3:3:2',['G3','B3','D4','G4'],'8n',0.6],
        ['4:0:2',['E3','G3','B3'],'8n',0.55],['4:1:2',['E3','B3','E4'],'8n',0.5],
        ['4:2:2',['E3','G3','B3'],'8n',0.55],['4:3:2',['E3','G3','B3'],'8n',0.5],
        ['5:0:2',['C3','E3','G3'],'8n',0.55],['5:1:2',['C4','E4','G4'],'8n',0.5],
        ['5:2:2',['C3','E3','G3'],'8n',0.55],['5:3:2',['C3','G3','E4'],'8n',0.5],
        ['6:0:2',['A3','C4','E4'],'8n',0.55],['6:1:2',['A3','E4','A4'],'8n',0.5],
        ['6:2:2',['F#3','A3','C4'],'8n',0.55],['6:3:2',['D3','F#3','A3'],'8n',0.5],
        ['7:0:2',['G3','B3','D4'],'8n',0.6],['7:1:2',['G3','B3','D4'],'8n',0.6],
        ['7:2:2',['G3','D4','G4'],'8n',0.65],['7:3:2',['G3','B3','D4','G4'],'8n',0.65],
      ],
      melody:[
        ['0:0:0','D5','4n',0.7],['0:1:0','B4','8n',0.6],['0:1:2','C5','8n',0.6],
        ['0:2:0','D5','4n',0.7],['0:3:0','E5','4n',0.65],
        ['1:0:0','G5','4n.',0.75],['1:2:0','E5','8n',0.65],
        ['1:2:2','D5','8n',0.6],['1:3:0','C5','8n',0.6],
        ['2:0:0','B4','8n',0.65],['2:0:2','A4','8n',0.6],['2:1:0','B4','4n',0.65],
        ['2:2:0','D5','4n',0.7],['2:3:0','F#5','8n',0.7],['2:3:2','E5','8n',0.65],
        ['3:0:0','D5','2n.',0.7],
        ['4:0:0','E5','4n',0.7],['4:1:0','D5','8n',0.6],['4:1:2','C5','8n',0.6],
        ['4:2:0','B4','4n',0.65],['4:3:0','A4','4n',0.6],
        ['5:0:0','G4','8n',0.6],['5:0:2','A4','8n',0.6],['5:1:0','B4','4n',0.65],
        ['5:2:0','C5','4n',0.65],['5:3:0','D5','4n',0.7],
        ['6:0:0','E5','4n',0.7],['6:1:0','D5','8n',0.6],['6:1:2','C5','8n',0.6],
        ['6:2:0','B4','4n',0.65],['6:3:0','A4','4n',0.6],
        ['7:0:0','G5','2n.',0.75],
      ],
    }},

    // ══════════════════════════════════════════════════════
    // DUNGEON — C# dim / atonal, 65 bpm, oppressive, no melody
    // Sparse irregular hits, heavy reverb, dissonance
    // ══════════════════════════════════════════════════════
    dungeon: { bpm:65, loop:'16m', tracks:{
      bass:[
        ['0:0:0','C#2','2n'], ['3:0:0','G2','2n'],
        ['5:2:0','Bb1','2n'], ['8:0:0','E2','2n'],
        ['10:3:0','C#2','2n'],['13:0:0','F2','2n'],
        ['15:0:0','Bb1','4n'],
      ],
      chords:[
        ['0:0:0',['C#3','G3','Bb3'],'4n.',0.35],
        ['3:0:0',['G2','Db3','F3'],'4n.',0.3],
        ['5:2:0',['Bb2','E3','G3'],'4n.',0.35],
        ['8:0:0',['E3','Bb3','D4'],'4n.',0.3],
        ['10:3:0',['C#3','G3'],'4n.',0.35],
        ['13:0:0',['F3','B3','Eb4'],'4n.',0.3],
        ['15:2:0',['C#3','G3','Bb3'],'4n.',0.35],
      ],
      // slow melodic fragment — only 4 notes, very sparse
      melody:[
        ['2:0:0','G4','4n.',0.3],
        ['6:0:0','Bb4','4n.',0.3],
        ['9:2:0','E4','4n.',0.25],
        ['12:0:0','C#4','4n.',0.3],
        ['14:2:0','F4','4n.',0.25],
      ],
      // random metallic perc hits
      perc:[
        ['1:2:0','C2','16n',0.3],
        ['4:0:2','C2','16n',0.25],
        ['7:1:0','C2','16n',0.3],
        ['9:3:2','C2','16n',0.25],
        ['11:0:0','C2','16n',0.3],
        ['14:2:2','C2','16n',0.25],
      ],
    }},

    // ══════════════════════════════════════════════════════
    // CHAPEL — E Phrygian, 52 bpm, ominous slow organ
    // ══════════════════════════════════════════════════════
    chapel: { bpm:52, loop:'12m', tracks:{
      bass:[
        ['0:0:0','E2','2n.'], ['3:0:0','F2','2n'],
        ['5:0:0','D2','2n.'], ['8:0:0','C2','2n'],
        ['10:0:0','Bb1','2n'],['11:2:0','A1','2n'],
      ],
      chords:[
        // slow held organ chords — long durations
        ['0:0:0',['E3','G3','B3'],'2n.',0.4],
        ['3:0:0',['F3','A3','C4'],'2n',0.35],
        ['5:0:0',['D3','F3','A3'],'2n.',0.4],
        ['8:0:0',['C3','E3','G3'],'2n',0.35],
        ['10:0:0',['Bb2','D3','F3'],'2n',0.4],
        ['11:2:0',['A2','C3','E3'],'2n',0.35],
        // inner voice movement
        ['1:2:0',['B3','D4','F#4'],'4n.',0.3],
        ['4:0:0',['E3','G3'],'4n.',0.3],
        ['6:2:0',['C3','F3','A3'],'4n.',0.3],
        ['9:0:0',['G2','C3','E3'],'4n.',0.3],
      ],
      melody:[
        ['2:0:0','B4','4n.',0.4],['2:2:2','A4','8n',0.35],['2:3:0','G4','4n',0.4],
        ['4:1:0','C5','4n.',0.4],['4:3:0','B4','4n',0.35],
        ['6:0:0','A4','4n',0.4],['6:2:0','F4','4n.',0.35],['6:3:2','G4','8n',0.35],
        ['8:0:0','E4','2n',0.4],
        ['9:2:0','D4','4n',0.35],['9:3:0','E4','4n',0.4],['9:3:2','F4','8n',0.4],
        ['11:0:0','E4','2n.',0.4],
      ],
    }},

    // ══════════════════════════════════════════════════════
    // STORMCRAG — A minor, 115 bpm, cold & driving mountain theme
    // Distinct from wilderness: more aggressive, no arp smoothness
    // ══════════════════════════════════════════════════════
    stormcrag: { bpm:115, loop:'8m', tracks:{
      bass:[
        // hard 8th bass hits — aggressive pulse
        ['0:0:0','A1','8n'],['0:1:0','A1','8n'],['0:2:0','C2','8n'],['0:3:0','E2','8n'],
        ['1:0:0','G1','8n'],['1:1:0','G1','8n'],['1:2:0','D2','8n'],['1:3:0','F2','8n'],
        ['2:0:0','F1','8n'],['2:1:0','F1','8n'],['2:2:0','C2','8n'],['2:3:0','A1','8n'],
        ['3:0:0','E1','4n'],['3:2:0','B1','4n'],
        ['4:0:0','A1','8n'],['4:1:0','A1','8n'],['4:2:0','E2','8n'],['4:3:0','G2','8n'],
        ['5:0:0','D2','8n'],['5:1:0','D2','8n'],['5:2:0','A2','8n'],['5:3:0','F2','8n'],
        ['6:0:0','C2','8n'],['6:1:0','G2','8n'],['6:2:0','E2','8n'],['6:3:0','A1','8n'],
        ['7:0:0','E2','4n'],['7:2:0','A1','4n'],
      ],
      chords:[
        // power chords — staccato 8th hits on the off-beats
        ['0:0:2',['A3','E4'],'8n',0.55],['0:1:2',['A3','E4'],'8n',0.5],
        ['0:2:2',['C4','G4'],'8n',0.55],['0:3:2',['E4','B4'],'8n',0.5],
        ['1:0:2',['G3','D4'],'8n',0.55],['1:1:2',['G3','D4'],'8n',0.5],
        ['1:2:2',['D4','A4'],'8n',0.55],['1:3:2',['F4','C5'],'8n',0.5],
        ['2:0:2',['F3','C4'],'8n',0.55],['2:1:2',['F3','C4'],'8n',0.5],
        ['2:2:2',['A3','E4'],'8n',0.55],['2:3:2',['C4','G4'],'8n',0.5],
        ['3:0:2',['E3','B3'],'8n',0.55],['3:2:2',['B3','F#4'],'8n',0.55],
        ['4:0:2',['A3','E4'],'8n',0.6],['4:1:2',['A3','E4'],'8n',0.55],
        ['4:2:2',['E4','B4'],'8n',0.6],['4:3:2',['G4','D5'],'8n',0.55],
        ['5:0:2',['D3','A3'],'8n',0.55],['5:2:2',['A3','E4'],'8n',0.55],
        ['5:3:2',['F3','C4'],'8n',0.5],
        ['6:0:2',['C4','G4'],'8n',0.55],['6:2:2',['E4','B4'],'8n',0.55],
        ['6:3:2',['A3','E4'],'8n',0.6],
        ['7:0:2',['E3','B3'],'8n',0.6],['7:2:2',['A3','E4'],'8n',0.65],
        ['7:3:2',['A3','E4','A4'],'8n',0.7],
      ],
      melody:[
        ['0:0:0','A4','8n',0.65],['0:0:2','C5','8n',0.65],['0:1:0','E5','4n',0.7],
        ['0:2:0','D5','8n',0.65],['0:2:2','C5','8n',0.6],['0:3:0','B4','4n',0.6],
        ['1:0:0','A4','4n.',0.65],['1:2:2','G4','8n',0.55],['1:3:0','F4','4n',0.55],
        ['2:0:0','E4','8n',0.6],['2:0:2','F4','8n',0.6],['2:1:0','G4','4n',0.65],
        ['2:2:0','A4','4n',0.65],['2:3:0','C5','8n',0.65],['2:3:2','B4','8n',0.6],
        ['3:0:0','A4','2n.',0.65],
        ['4:0:0','E5','8n',0.7],['4:0:2','F5','8n',0.7],['4:1:0','G5','4n',0.75],
        ['4:2:0','F5','8n',0.7],['4:2:2','E5','8n',0.65],['4:3:0','D5','4n',0.65],
        ['5:0:0','C5','4n.',0.65],['5:2:2','B4','8n',0.6],['5:3:0','A4','4n',0.6],
        ['6:0:0','G4','8n',0.6],['6:0:2','A4','8n',0.6],['6:1:0','B4','4n',0.65],
        ['6:2:0','C5','4n',0.65],['6:3:0','D5','8n',0.65],['6:3:2','E5','8n',0.7],
        ['7:0:0','A4','2n.',0.65],
      ],
    }},

    // ══════════════════════════════════════════════════════
    // FARM — C major, 132 bpm, bright pastoral
    // ══════════════════════════════════════════════════════
    farm: { bpm:132, loop:'8m', tracks:{
      bass:[
        ['0:0:0','C2','4n'],['0:2:0','G2','4n'],
        ['1:0:0','F2','4n'],['1:2:0','C3','4n'],
        ['2:0:0','G2','4n'],['2:2:0','D3','4n'],
        ['3:0:0','C2','2n'],
        ['4:0:0','Am1','4n'],['4:0:0','A1','4n'],['4:2:0','E2','4n'],
        ['5:0:0','F2','4n'],['5:2:0','C2','4n'],
        ['6:0:0','G2','4n'],['6:2:0','D2','4n'],
        ['7:0:0','C2','2n'],
      ],
      arp:[
        // bouncy 8th-note arpeggio, major feel
        ['0:0:0','C4','8n',0.45],['0:0:2','E4','8n',0.4],['0:1:0','G4','8n',0.45],['0:1:2','C5','8n',0.4],
        ['0:2:0','G4','8n',0.4],['0:2:2','E4','8n',0.4],['0:3:0','C4','8n',0.4],['0:3:2','E4','8n',0.4],
        ['1:0:0','F4','8n',0.45],['1:0:2','A4','8n',0.4],['1:1:0','C5','8n',0.45],['1:1:2','F5','8n',0.4],
        ['1:2:0','C5','8n',0.4],['1:2:2','A4','8n',0.4],['1:3:0','F4','8n',0.4],['1:3:2','A4','8n',0.4],
        ['2:0:0','G4','8n',0.45],['2:0:2','B4','8n',0.4],['2:1:0','D5','8n',0.45],['2:1:2','G5','8n',0.4],
        ['2:2:0','D5','8n',0.4],['2:2:2','B4','8n',0.4],['2:3:0','G4','8n',0.4],['2:3:2','B4','8n',0.4],
        ['3:0:0','C4','8n',0.45],['3:0:2','E4','8n',0.4],['3:1:0','G4','8n',0.45],['3:1:2','C5','8n',0.4],
        ['3:2:0','E5','8n',0.4],['3:2:2','G5','8n',0.45],['3:3:0','C6','8n',0.45],['3:3:2','G5','8n',0.4],
        ['4:0:0','A4','8n',0.45],['4:0:2','C5','8n',0.4],['4:1:0','E5','8n',0.45],['4:1:2','A5','8n',0.4],
        ['4:2:0','E5','8n',0.4],['4:2:2','C5','8n',0.4],['4:3:0','A4','8n',0.4],['4:3:2','C5','8n',0.4],
        ['5:0:0','F4','8n',0.45],['5:0:2','A4','8n',0.4],['5:1:0','C5','8n',0.45],['5:1:2','F5','8n',0.4],
        ['5:2:0','A4','8n',0.4],['5:2:2','F4','8n',0.4],['5:3:0','C4','8n',0.4],['5:3:2','A3','8n',0.4],
        ['6:0:0','G4','8n',0.45],['6:0:2','B4','8n',0.4],['6:1:0','D5','8n',0.45],['6:1:2','G5','8n',0.4],
        ['6:2:0','B4','8n',0.4],['6:2:2','D5','8n',0.4],['6:3:0','G5','8n',0.45],['6:3:2','D5','8n',0.4],
        ['7:0:0','C4','8n',0.45],['7:0:2','G4','8n',0.4],['7:1:0','E4','8n',0.45],['7:1:2','C5','8n',0.4],
        ['7:2:0','G4','8n',0.4],['7:2:2','E5','8n',0.45],['7:3:0','C5','8n',0.5],['7:3:2','G5','8n',0.5],
      ],
      melody:[
        ['0:0:0','G4','4n',0.65],['0:1:0','E4','8n',0.6],['0:1:2','F4','8n',0.6],
        ['0:2:0','G4','4n',0.65],['0:3:0','A4','4n',0.65],
        ['1:0:0','C5','4n.',0.7],['1:2:0','A4','8n',0.6],['1:2:2','G4','8n',0.6],['1:3:0','F4','8n',0.55],
        ['2:0:0','E4','8n',0.6],['2:0:2','D4','8n',0.55],['2:1:0','E4','4n',0.6],
        ['2:2:0','G4','4n',0.65],['2:3:0','B4','8n',0.65],['2:3:2','A4','8n',0.6],
        ['3:0:0','G4','2n.',0.65],
        ['4:0:0','A4','4n',0.65],['4:1:0','G4','8n',0.6],['4:1:2','F4','8n',0.55],
        ['4:2:0','E4','4n',0.6],['4:3:0','C4','4n',0.55],
        ['5:0:0','D4','4n.',0.6],['5:2:0','F4','8n',0.55],['5:2:2','E4','8n',0.55],['5:3:0','D4','8n',0.5],
        ['6:0:0','C4','8n',0.55],['6:0:2','D4','8n',0.55],['6:1:0','E4','4n',0.6],
        ['6:2:0','F4','4n',0.6],['6:3:0','G4','4n',0.65],
        ['7:0:0','C5','2n.',0.7],
      ],
    }},
  };

  // ── Zone → theme ───────────────────────────────────────────────────────
  function themeFor(mapName, isInterior, night) {
    if(!mapName) return night>0.5 ? 'town_night' : 'town_day';
    const n = mapName.toUpperCase();
    if(n.includes('FLAGON') || (n.includes('INN') && isInterior)) return 'inn';
    if(n.includes('CHAPEL') || n.includes('CATACOMB'))             return 'chapel';
    if(n.includes('CRYPT')  || n.includes('DEPTH'))                return 'dungeon';
    if(n.includes('STORMCRAG') || n.includes('AETHERIC') || n.includes('SPIRE')) return 'stormcrag';
    if(n.includes('FARM')   || n.includes('PASTURE'))              return 'farm';
    if(isInterior || n === 'ASHENVEIL' || n.includes('FORGE') || n.includes('FLAGON'))
      return night>0.5 ? 'town_night' : 'town_day';
    return night>0.5 ? 'wild_night' : 'wild_day';
  }

  async function init() {
    if(isStarted) return;
    isStarted = true;
    try {
      await Tone.start();

      // Master chain: comp → vol → out
      const comp = new Tone.Compressor(-20, 4);
      dest = new Tone.Volume(Tone.gainToDb(userVolume));
      comp.connect(dest);
      dest.toDestination();

      // ── Voice synths — warm FM-based for musical quality ─────────────────
      const bassRev  = new Tone.Reverb({decay:1.0, wet:0.10}); await bassRev.ready;
      const chordRev = new Tone.Reverb({decay:2.2, wet:0.28}); await chordRev.ready;
      const melRev   = new Tone.Reverb({decay:2.8, wet:0.30}); await melRev.ready;
      const padRev   = new Tone.Reverb({decay:7.0, wet:0.60}); await padRev.ready;
      const percRev  = new Tone.Reverb({decay:0.5, wet:0.06}); await percRev.ready;

      // BASS: FM with harmonics — warm round lute-bass pluck
      synths.bass = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity:2, modulationIndex:1.5,
        oscillator:{type:'sine'},
        envelope:{attack:0.008, decay:0.25, sustain:0.35, release:0.3},
        modulation:{type:'sine'},
        modulationEnvelope:{attack:0.01, decay:0.2, sustain:0.0, release:0.2},
        maxPolyphony:2,
      });

      // CHORDS: FM triangle — warm plucked harp/lute, no sustain
      synths.chords = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity:1.0, modulationIndex:0.3,
        oscillator:{type:'triangle'},
        envelope:{attack:0.006, decay:0.20, sustain:0.0, release:0.25},
        modulation:{type:'triangle'},
        modulationEnvelope:{attack:0.002, decay:0.12, sustain:0.0, release:0.15},
        maxPolyphony:6,
      });

      // MELODY: FM sine — warm flute/ocarina quality (not harsh square)
      synths.melody = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity:5, modulationIndex:2.5,
        oscillator:{type:'sine'},
        envelope:{attack:0.04, decay:0.08, sustain:0.65, release:0.25},
        modulation:{type:'sine'},
        modulationEnvelope:{attack:0.05, decay:0.1, sustain:0.4, release:0.2},
        maxPolyphony:2,
      });

      // ARP: triangle8 — bright harp, short decay, zero sustain
      synths.arp = new Tone.PolySynth(Tone.Synth, {
        oscillator:{type:'triangle8'},
        envelope:{attack:0.005, decay:0.18, sustain:0.0, release:0.22},
        maxPolyphony:4,
      });

      // PAD: slow FM organ — dungeon/chapel only
      synths.pad = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity:1.0, modulationIndex:0.5,
        oscillator:{type:'sine'},
        envelope:{attack:1.8, decay:0.6, sustain:0.7, release:2.5},
        modulation:{type:'sine'},
        modulationEnvelope:{attack:2.0, decay:1.0, sustain:0.5, release:2.0},
        maxPolyphony:4,
      });

      // PERC: short sine click
      synths.perc = new Tone.PolySynth(Tone.Synth, {
        oscillator:{type:'sine'},
        envelope:{attack:0.001, decay:0.07, sustain:0.0, release:0.08},
        maxPolyphony:2,
      });

      // Route voices through effects
      const bassLPF  = new Tone.Filter({frequency:480, type:'lowpass', rolloff:-24});
      const chordHPF = new Tone.Filter({frequency:120, type:'highpass'});
      const melHPF   = new Tone.Filter({frequency:200, type:'highpass'});
      const melEQ    = new Tone.EQ3({low:-6, mid:2, high:-2});
      synths.bass.chain(bassLPF, bassRev, comp);
      synths.bass.connect(comp);
      synths.chords.chain(chordHPF, chordRev, comp);
      synths.melody.chain(melHPF, melEQ, melRev, comp);
      synths.arp.chain(chordRev, comp);
      synths.pad.chain(padRev, comp);
      synths.perc.chain(percRev, comp);

      // Build all parts
      for(const [id, def] of Object.entries(THEMES)) {
        for(const [trackName, notes] of Object.entries(def.tracks)) {
          const sname = trackName === 'arp' ? 'arp' : trackName;
          const syn = synths[sname] || synths.chords;
          const tid = id, tname = trackName;
          const p = new Tone.Part((time, ev) => {
            if(!enabled || currentTheme !== tid) return;
            const s2 = synths[tname] || synths.chords;
            const ns = Array.isArray(ev.n) ? ev.n : [ev.n];
            s2.triggerAttackRelease(ns, ev.d, time, ev.v ?? 0.55);
          }, notes.map(([t,n,d,v]) => [t, {n,d,v}]));
          p.loop = true;
          p.loopEnd = def.loop;
          p.start(0);
          parts.push(p);
        }
      }

      const night = typeof getNightAlpha==='function' ? getNightAlpha() : 0;
      currentTheme = themeFor(currentMap?.name, currentMap?.isInterior, night);
      targetTheme  = currentTheme;
      Tone.Transport.bpm.value = THEMES[currentTheme].bpm;
      Tone.Transport.timeSignature = 4;
      Tone.Transport.start();

      isReady = true;
      // Apply persisted enabled state — silence immediately if Off
      if(!enabled) dest.volume.value = -Infinity;
    } catch(err) {
      console.warn('Grimstone audio failed:', err);
    }
  }

  function crossfadeTo(theme) {
    if(!isReady || theme===currentTheme) return;
    currentTheme = theme;
    // Cancel any in-flight BPM automation before starting the new ramp to prevent
    // stacked ramps causing wrong playback speed for guests who trigger zone/time
    // changes out of phase with the host.
    try { Tone.Transport.bpm.cancelScheduledValues(Tone.now()); } catch(_){}
    Tone.Transport.bpm.rampTo(THEMES[theme].bpm, 2.5);
  }

  function tick() {
    if(!isReady || !enabled) return;
    const night  = getNightAlpha();
    const wanted = themeFor(currentMap?.name, currentMap?.isInterior, night);
    if(wanted !== targetTheme) { targetTheme=wanted; crossfadeTo(wanted); }
  }

  function onZoneChange() {
    if(!isStarted) return;
    if(!isReady  || !enabled) return;
    const night  = getNightAlpha();
    const wanted = themeFor(currentMap?.name, currentMap?.isInterior, night);
    targetTheme  = wanted; crossfadeTo(wanted);
  }

  function toggle() {
    if(!isStarted) { init(); return; }
    enabled = !enabled;
    if(dest) dest.volume.rampTo(enabled ? Tone.gainToDb(userVolume) : -Infinity, 1.0);
    localStorage.setItem('grimstone_music_enabled', enabled ? '1' : '0');
  }

  function setVolume(v) {
    userVolume = v/100;
    if(dest && enabled) dest.volume.rampTo(Tone.gainToDb(userVolume), 0.1);
    localStorage.setItem('grimstone_music_vol', v);
  }

  return { init, tick, toggle, setVolume, onZoneChange,
           get enabled() { return enabled; } };
})();

function toggleMusic()      { Music.toggle(); }
function setMusicVolume(val){ Music.setVolume(val); }

