// ======= RENDER ENGINE =======
const canvas = document.getElementById('game-canvas');
const ctx2 = canvas.getContext('2d');
ctx2.imageSmoothingEnabled = false; // set once — pixelated rendering, no per-frame cost
let currentMap = null;
let camera = {x:0, y:0};       // camera in pixel units
let cameraTarget = {x:0, y:0}; // smooth follow target
let playerPos = {x:5, y:5};
let p2Pos  = {x:6, y:5};
let p2Real = {x:6, y:5};
let p2Moving = false;
let hoverTile = {x:-1, y:-1};
let damagedTiles = {};

// Camera lerp — smooth follow
function updateCamera() {
  const targetX = playerReal.x * TILE - canvas.width/2 + TILE/2;
  const targetY = playerReal.y * TILE - canvas.height/2 + TILE/2;
  const maxX = (currentMap ? currentMap.W : 20) * TILE - canvas.width;
  const maxY = (currentMap ? currentMap.H : 14) * TILE - canvas.height;
  cameraTarget.x = Math.max(0, Math.min(maxX, targetX));
  cameraTarget.y = Math.max(0, Math.min(maxY, targetY));
  // Lerp
  camera.x += (cameraTarget.x - camera.x) * 0.12;
  camera.y += (cameraTarget.y - camera.y) * 0.12;
}

// Convert screen pixel to tile coordinate
function screenToTile(sx, sy) {
  return {
    x: Math.floor((sx + camera.x) / TILE),
    y: Math.floor((sy + camera.y) / TILE),
  };
}

const TILE_COLORS = {
  [T.GRASS]:'#1a2a14', [T.DIRT]:'#2a1e12', [T.STONE_FLOOR]:'#252830',
  [T.WATER]:'#0e2030', [T.DARK_GRASS]:'#0e1a0e', [T.WALL]:'#111318',
  [T.DUNGEON_FLOOR]:'#18151a', [T.COBBLE]:'#2a2824',
  // Building tiles
  [T.ROOF_L]:'#2a1810', [T.ROOF_M]:'#2a1810', [T.ROOF_R]:'#2a1810', [T.ROOF_CHIMNEY]:'#2a1810',
  [T.BWALL_DOOR]:'#1e1c24', [T.BWALL_WIN]:'#1e1c24', [T.BWALL_FORGE]:'#1a1820',
  [T.BWALL_AWNING]:'#1e1810', [T.BWALL_PLAIN]:'#1e1c24', [T.BWALL_SIDE]:'#181620',
  [T.SMALL_TABLE]:'#2a1c10', [T.WARDROBE]:'#1c1408',
  [T.FIREPLACE]:'#1a0c04',   [T.PLANT]:'#0c1a08',
  [T.DOCK_PLANK]:'#2a1a08',
  // Homestead tiles
  [T.TILLED_SOIL]:'#2a1a0a', [T.SEEDLING]:'#2a1a0a', [T.CROP_GROWING]:'#2a1a0a',
  [T.HOME_WHEAT]:'#2a1a0a',  [T.HOME_TURNIP]:'#2a1a0a', [T.HOME_CARROT]:'#2a1a0a',
  [T.HOME_POTATO]:'#2a1a0a', [T.HOME_ONION]:'#2a1a0a',
};

function tileColor(t) {
  return TILE_COLORS[t] || TILE_COLORS[T.GRASS];
}
// ======= TILE SPRITE CACHE =======
// Pre-renders static tiles to offscreen canvases so drawTile avoids
// expensive path/gradient work every frame for unchanging tiles.
const TILE_CACHE = new Map();
const _lightCache = {}; // keyed by (radius*100+alphaInt), reused each frame
const _staticTileCache = {}; // keyed by T.xxx tile constant

// Render a static (non-animated) tile via a cached offscreen TILE×TILE sprite.
// drawFn(ctx, 0, 0) is called once on first use; subsequent calls just blit.
function _drawCachedTile(ctx, tileKey, px, py, drawFn) {
  if(!_staticTileCache[tileKey]) {
    const oc = document.createElement('canvas');
    oc.width = oc.height = TILE;
    const oc2 = oc.getContext('2d');
    drawFn(oc2, 0, 0);
    _staticTileCache[tileKey] = oc;
  }
  ctx.drawImage(_staticTileCache[tileKey], px, py);
}

function buildTileCache() {
  const STATIC_TILES = [
    T.STONE_FLOOR, T.COBBLE, T.WALL, T.DUNGEON_FLOOR, T.DOCK_PLANK,
    T.BWALL_SIDE, T.BWALL_PLAIN, T.BWALL_WIN,
  ];
  for(const tileType of STATIC_TILES) {
    const oc = document.createElement('canvas');
    oc.width = TILE; oc.height = TILE;
    const c = oc.getContext('2d');
    c.fillStyle = TILE_COLORS[tileType] || '#111';
    c.fillRect(0,0,TILE,TILE);
    _renderStaticToCtx(c, tileType, 0, 0);
    TILE_CACHE.set(tileType, oc);
  }
}

function _renderStaticToCtx(c, t, px, py) {
  const cx=px+TILE/2, cy=py+TILE/2;
  if(t===T.STONE_FLOOR){
    c.strokeStyle='rgba(255,255,255,0.04)'; c.lineWidth=0.7;
    for(let i=0;i<2;i++){c.strokeRect(px+1+i*19,py+1,17,TILE/2-2);c.strokeRect(px+10+i*19,py+TILE/2+1,17,TILE/2-2);}
  } else if(t===T.COBBLE){
    c.strokeStyle='rgba(255,255,255,0.06)'; c.lineWidth=0.8;
    for(let i=0;i<2;i++){c.strokeRect(px+i*20,py+1,18,TILE/2-2);c.strokeRect(px+i*20+10,py+TILE/2+1,18,TILE/2-2);}
  } else if(t===T.WALL){
    c.fillStyle='#2a2420'; c.fillRect(px,py,TILE,TILE);
    c.strokeStyle='rgba(0,0,0,0.4)'; c.lineWidth=1; c.strokeRect(px+2,py+2,TILE-4,TILE-4);
    c.fillStyle='rgba(255,255,255,0.03)';
    for(let i=0;i<3;i++) c.fillRect(px+2,py+2+i*11,TILE-4,9);
  } else if(t===T.DUNGEON_FLOOR){
    c.strokeStyle='rgba(255,255,255,0.03)'; c.lineWidth=0.6;
    for(let i=0;i<2;i++){c.strokeRect(px+1+i*18,py+1,16,TILE/2-2);c.strokeRect(px+9+i*18,py+TILE/2+1,16,TILE/2-2);}
  } else if(t===T.DOCK_PLANK){
    c.fillStyle='#321e0c'; c.fillRect(px,py,TILE,TILE);
    c.strokeStyle='rgba(0,0,0,0.45)'; c.lineWidth=1;
    for(let i=1;i<5;i++){c.beginPath();c.moveTo(px,py+i*8);c.lineTo(px+TILE,py+i*8);c.stroke();}
    c.strokeStyle='rgba(255,200,120,0.07)'; c.lineWidth=0.7;
    for(let i=0;i<3;i++){c.beginPath();c.moveTo(px+5+i*13,py+1);c.lineTo(px+4+i*13,py+TILE-1);c.stroke();}
    c.fillStyle='rgba(0,0,0,0.55)';
    [[4,4],[TILE-4,4],[4,TILE-4],[TILE-4,TILE-4]].forEach(([dx,dy])=>{c.beginPath();c.arc(px+dx,py+dy,1.5,0,Math.PI*2);c.fill();});
    c.fillStyle='rgba(0,0,0,0.15)'; c.fillRect(px,py+TILE-3,TILE,3);
  } else if(t===T.BWALL_SIDE){
    c.fillStyle='rgba(0,0,0,0.3)'; c.fillRect(px,py,3,TILE); c.fillRect(px+TILE-3,py,3,TILE);
  } else if(t===T.BWALL_PLAIN){
    c.strokeStyle='rgba(255,255,255,0.04)'; c.lineWidth=0.8;
    for(let i=0;i<3;i++) c.strokeRect(px+3,py+3+i*12,TILE-6,10);
  } else if(t===T.BWALL_WIN){
    const glow=c.createRadialGradient(cx,cy,2,cx,cy,12);
    glow.addColorStop(0,'rgba(255,200,80,0.22)'); glow.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=glow; c.fillRect(px,py,TILE,TILE);
    c.strokeStyle='rgba(160,130,60,0.5)'; c.lineWidth=1.2; c.strokeRect(cx-7,cy-7,14,14);
  }
}

// Per-position dirt cache (keyed by "x,y") — lazy-built on first render, permanent
const DIRT_CACHE = new Map();
function getDirtCached(x, y) {
  const key = x*1000+y;
  if(DIRT_CACHE.has(key)) return DIRT_CACHE.get(key);
  const oc = document.createElement('canvas');
  oc.width = TILE; oc.height = TILE;
  const c = oc.getContext('2d');
  c.fillStyle = '#3a2a14'; c.fillRect(0,0,TILE,TILE);
  const dr = (n) => { let v=Math.sin(x*127.1+y*311.7+n*74.3)*43758.5453; return v-Math.floor(v); };
  const baseShift=(dr(0)-0.5)*18;
  c.fillStyle=`rgba(${70+baseShift|0},${42+baseShift|0},${18+baseShift|0},0.35)`;
  c.fillRect(0,0,TILE,TILE);
  c.strokeStyle='rgba(20,10,4,0.28)'; c.lineWidth=1.2;
  const rutDir=(x+y)%2, numRuts=dr(1)>0.5?2:1;
  for(let r=0;r<numRuts;r++){
    const off=10+dr(r+2)*20;
    c.beginPath();
    if(rutDir===0){c.moveTo(0,off);c.bezierCurveTo(12,off+(dr(r+4)-0.5)*4,28,off+(dr(r+5)-0.5)*4,TILE,off+(dr(r+6)-0.5)*3);}
    else{c.moveTo(off,0);c.bezierCurveTo(off+(dr(r+4)-0.5)*4,12,off+(dr(r+5)-0.5)*4,28,off+(dr(r+6)-0.5)*3,TILE);}
    c.stroke();
  }
  const np=3+Math.floor(dr(10)*4);
  for(let p=0;p<np;p++){
    const bx=2+dr(p*3+11)*36,by=2+dr(p*3+12)*36,br=0.8+dr(p*3+13)*1.4;
    c.fillStyle=dr(p+20)>0.5?'rgba(120,90,55,0.22)':'rgba(30,15,5,0.2)';
    c.beginPath();c.ellipse(bx,by,br*1.4,br,dr(p+21)*Math.PI,0,Math.PI*2);c.fill();
  }
  const eg=c.createRadialGradient(TILE/2,TILE/2,TILE*0.1,TILE/2,TILE/2,TILE*0.72);
  eg.addColorStop(0,'rgba(80,50,20,0.0)');eg.addColorStop(1,'rgba(10,5,2,0.22)');
  c.fillStyle=eg;c.fillRect(0,0,TILE,TILE);
  c.strokeStyle='rgba(80,40,100,0.15)';c.strokeRect(1,1,TILE-2,TILE-2);
  DIRT_CACHE.set(key,oc);
  if(DIRT_CACHE.size>8192){const fk=DIRT_CACHE.keys().next().value;DIRT_CACHE.delete(fk);}
  return oc;
}



function drawTile(x,y,t,floorT) {
  const px=x*TILE, py=y*TILE;

  // If this is a decoration tile, paint the underlying floor first
  const isDecor = DECOR_TILES.has(t);
  const baseTile = (isDecor && floorT != null) ? floorT : t;
  ctx2.fillStyle = tileColor(baseTile);
  ctx2.fillRect(px,py,TILE,TILE);

  // Overlay / decorations
  const cx=px+TILE/2, cy=py+TILE/2;
  ctx2.save();

  // Always draw floor texture/pattern under decor tiles
  if(isDecor && floorT != null) {
    if(floorT===T.GRASS||floorT===T.DARK_GRASS){
      ctx2.fillStyle=floorT===T.DARK_GRASS?'rgba(20,40,20,0.5)':'rgba(30,60,20,0.3)';
      for(let i=0;i<4;i++){
        const gx=px+Math.sin(x*7+y*3+i)*10+TILE/2-5+i*5;
        const gy=py+TILE*.6+i%2*4;
        ctx2.fillRect(gx,gy,1,4+i%3*2);
      }
    } else if(floorT===T.COBBLE){
      ctx2.strokeStyle='rgba(255,255,255,0.06)'; ctx2.lineWidth=0.8;
      const row=y%2;
      for(let i=0;i<2;i++){
        const bx=px+(row===0?i*20:i*20+10)%TILE;
        ctx2.strokeRect(bx,py+1,18,TILE/2-2);
        ctx2.strokeRect(bx,py+TILE/2+1,18,TILE/2-2);
      }
    } else if(floorT===T.STONE_FLOOR){
      ctx2.strokeStyle='rgba(255,255,255,0.04)';
      ctx2.strokeRect(px+1,py+1,TILE-2,TILE-2);
      ctx2.strokeStyle='rgba(255,255,255,0.03)';
      ctx2.beginPath(); ctx2.moveTo(px,py+TILE/2); ctx2.lineTo(px+TILE,py+TILE/2); ctx2.stroke();
    } else if(floorT===T.DIRT){
      const _dc = getDirtCache(currentMap.W, currentMap.H);
      const _db = (y * currentMap.W + x) * 16;
      const bs = (_dc[_db]-0.5)*18;
      ctx2.fillStyle = `rgba(${70+bs|0},${42+bs|0},${18+bs|0},0.3)`;
      ctx2.fillRect(px, py, TILE, TILE);
      ctx2.strokeStyle = 'rgba(20,10,4,0.22)'; ctx2.lineWidth=1;
      const rutDir=(x+y)%2;
      const off=10+_dc[_db+2]*20;
      ctx2.beginPath();
      if(rutDir===0){ ctx2.moveTo(px,py+off); ctx2.lineTo(px+TILE,py+off+(_dc[_db+3]-0.5)*4); }
      else { ctx2.moveTo(px+off,py); ctx2.lineTo(px+off+(_dc[_db+3]-0.5)*4,py+TILE); }
      ctx2.stroke();
      for(let di=0;di<4;di++){
        ctx2.fillStyle=_dc[_db+di+5]>0.5?'rgba(120,90,55,0.18)':'rgba(30,15,5,0.16)';
        ctx2.beginPath();
        ctx2.ellipse(px+3+_dc[_db+di*3+11]*34,py+3+_dc[_db+di*3+12]*34,1.2+_dc[_db+di+13],0.8,_dc[_db+di+14]*Math.PI,0,Math.PI*2);
        ctx2.fill();
      }
    }
  }

  if(!isDecor) {
  if(t===T.GRASS || t===T.DARK_GRASS){
    ctx2.fillStyle=t===T.DARK_GRASS?'rgba(20,40,20,0.5)':'rgba(30,60,20,0.3)';
    // Use precomputed sin table (built once at startup, indexed by tile position)
    const gi=(y*128+x)*4;
    for(let i=0;i<4;i++){
      const gx=px+_grassSin[gi+i]*10+TILE/2-5+i*5;
      const gy=py+TILE*.6+i%2*4;
      ctx2.fillRect(gx,gy,1,4+i%3*2);
    }
  } else if(t===T.STONE_FLOOR){
    ctx2.strokeStyle='rgba(255,255,255,0.04)';
    ctx2.strokeRect(px+1,py+1,TILE-2,TILE-2);
    ctx2.strokeStyle='rgba(255,255,255,0.03)';
    ctx2.beginPath(); ctx2.moveTo(px,py+TILE/2); ctx2.lineTo(px+TILE,py+TILE/2); ctx2.stroke();
  } else if(t===T.DIRT){
    ctx2.drawImage(getDirtCached(x, y), px, py);
  } else if(t===T.WATER){
    const woff=Math.sin(_waterT+x+y)*.5;  // _waterT updated at 10fps
    ctx2.fillStyle=`rgba(30,100,180,${0.15+woff*0.05})`;
    ctx2.fillRect(px,py,TILE,TILE);
    ctx2.fillStyle='rgba(60,160,220,0.08)';
    for(let wi=0;wi<3;wi++){
      ctx2.fillRect(px+4+wi*11,py+TILE/2-2+woff*3,8,2);
    }
  } else if(t===T.WALL){
    ctx2.fillStyle='rgba(255,255,255,0.03)';
    ctx2.fillRect(px,py,TILE,TILE/2);
    ctx2.strokeStyle='rgba(255,255,255,0.05)';
    ctx2.strokeRect(px,py,TILE,TILE);
  }
  } // end !isDecor floor textures

  // Objects
  const dmg = damagedTiles[`${x},${y}`]||0;
  const flash = dmg>0 ? Math.min(1,dmg/3) : 0;

  if(t===T.COPPER){
    drawOre(px,py,'#6a3a14','#a0622a',flash);
  } else if(t===T.IRON){
    drawOre(px,py,'#3a3a44','#6a6a7a',flash);
  } else if(t===T.GOLD_ORE){
    drawOre(px,py,'#7a5510','#d4a030',flash);
  } else if(t===T.MITHRIL){
    drawOre(px,py,'#1a2a4a','#3a6aaa',flash);
  } else if(t===T.COAL){
    drawOre(px,py,'#151515','#2a2a2a',flash);
  } else if(t===T.NORMAL_TREE||t===T.OAK||t===T.WILLOW){
    drawTree(px,py,t,flash);
  } else if(t===T.FISHING||t===T.FISHING2){
    ctx2.fillStyle='rgba(20,100,160,0.3)';
    ctx2.fillRect(px,py,TILE,TILE);
    ctx2.fillStyle='rgba(60,180,240,0.5)';
    ctx2.beginPath(); ctx2.arc(cx,cy,10,0,Math.PI*2); ctx2.fill();
    ctx2.font='18px serif'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
    ctx2.fillText('🐟',cx,cy);
  } else if(t===T.GOBLIN){
    drawEnemy(px,py,'#2a4a14','#4a8a24','G',flash);
  } else if(t===T.SKELETON){
    drawEnemy(px,py,'#3a3028','#8a7a60','S',flash);
  } else if(t===T.WOLF){
    drawEnemy(px,py,'#2a2830','#6a6870','W',flash);
  } else if(t===T.ZOMBIE){
    drawEnemy(px,py,'#1a2a10','#4a7a3a','Z',flash);
  } else if(t===T.SHADOW_WALKER){
    drawShadowWalker(ctx2,px,py,enemies.find(e=>e.x===tx&&e.y===ty)||{id:0,flashTimer:0},frameNow);
  } else if(t===T.FOREST_PORTAL){
    // Forest portal — swirling green-dark vortex
    const now2=frameNow;
    const g=ctx2.createRadialGradient(px+TILE/2,py+TILE/2,2,px+TILE/2,py+TILE/2,TILE/2);
    g.addColorStop(0,'rgba(20,60,10,0.95)');
    g.addColorStop(0.5,'rgba(10,40,5,0.7)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=g; ctx2.fillRect(px,py,TILE,TILE);
    // Rotating rune ring
    ctx2.save();
    ctx2.translate(px+TILE/2,py+TILE/2);
    ctx2.rotate(now2*0.0008);
    ctx2.strokeStyle=`rgba(40,180,40,${0.6+Math.sin(now2*0.003)*0.2})`;
    ctx2.lineWidth=1.5;
    ctx2.beginPath(); ctx2.arc(0,0,TILE*0.32,0,Math.PI*2); ctx2.stroke();
    ctx2.restore();
    // Sparkles
    ctx2.fillStyle='rgba(80,220,80,0.8)';
    for(let i=0;i<4;i++){
      const a=(now2*0.001+i*1.57)%(Math.PI*2);
      ctx2.beginPath(); ctx2.arc(px+TILE/2+Math.cos(a)*TILE*0.28, py+TILE/2+Math.sin(a)*TILE*0.28, 1.5,0,Math.PI*2); ctx2.fill();
    }

  // ─── FARM PORTAL ───────────────────────────────────────────────
  } else if(t===T.FARM_PORTAL){
    const now3=frameNow;
    const fp=ctx2.createRadialGradient(px+TILE/2,py+TILE/2,2,px+TILE/2,py+TILE/2,TILE/2);
    fp.addColorStop(0,'rgba(120,200,60,0.95)');
    fp.addColorStop(0.4,'rgba(80,160,30,0.7)');
    fp.addColorStop(1,'rgba(30,80,10,0)');
    ctx2.fillStyle=fp; ctx2.beginPath(); ctx2.arc(px+TILE/2,py+TILE/2,TILE/2,0,Math.PI*2); ctx2.fill();
    // Spinning wheat stalk silhouettes
    for(let wi=0;wi<5;wi++){
      const wa=now3*0.001+wi*1.25;
      const wx2=px+TILE/2+Math.cos(wa)*TILE*0.22;
      const wy2=py+TILE/2+Math.sin(wa)*TILE*0.22;
      ctx2.strokeStyle='rgba(200,180,60,0.7)'; ctx2.lineWidth=1.2;
      ctx2.beginPath(); ctx2.moveTo(wx2,wy2); ctx2.lineTo(wx2,wy2-8); ctx2.stroke();
      ctx2.fillStyle='rgba(220,200,70,0.8)'; ctx2.fillRect(wx2-2,wy2-10,4,4);
    }
    // Label
    ctx2.fillStyle='rgba(180,230,80,0.9)'; ctx2.font='bold 7px Cinzel,serif';
    ctx2.textAlign='center'; ctx2.fillText('FARM',px+TILE/2,py+TILE-4); ctx2.textAlign='left';

  // ─── HAY BALE ──────────────────────────────────────────────────
  } else if(t===T.HAY_BALE){
    ctx2.save();
    ctx2.translate(px,py);
    
    // Golden-yellow rounded rectangle bale
    ctx2.fillStyle='#c8a020'; ctx2.beginPath();
    ctx2.roundRect(0+4,0+10,TILE-8,TILE-16,4); ctx2.fill();
    ctx2.fillStyle='#e0b830';
    ctx2.beginPath(); ctx2.roundRect(0+6,0+12,TILE-12,TILE-20,3); ctx2.fill();
    // Straw texture lines
    ctx2.strokeStyle='rgba(180,140,10,0.5)'; ctx2.lineWidth=0.8;
    for(let si=0;si<5;si++){
      const sy2=0+14+si*3;
      ctx2.beginPath(); ctx2.moveTo(0+6,sy2); ctx2.lineTo(0+TILE-6,sy2); ctx2.stroke();
    }
    // Twine bands
    ctx2.strokeStyle='rgba(100,70,10,0.7)'; ctx2.lineWidth=1.5;
    [0+14,0+TILE-14].forEach(bx=>{ ctx2.beginPath(); ctx2.moveTo(bx,0+10); ctx2.lineTo(bx,0+TILE-6); ctx2.stroke(); });

  // ─── FENCE POST ────────────────────────────────────────────────
    ctx2.restore();
  } else if(t===T.FENCE_POST){
    ctx2.fillStyle='#8a6030';
    ctx2.fillRect(px+TILE/2-2,py+4,4,TILE-8);
    ctx2.fillStyle='#a07840';
    ctx2.fillRect(px+TILE/2-1,py+4,2,TILE-8);
    // Cross-beam suggestion
    ctx2.fillStyle='#8a6030';
    ctx2.fillRect(px+4,py+12,TILE-8,3);
    ctx2.fillRect(px+4,py+22,TILE-8,3);
    // Post cap
    ctx2.fillStyle='#6a4820'; ctx2.beginPath();
    ctx2.moveTo(px+TILE/2-3,py+4); ctx2.lineTo(px+TILE/2+3,py+4); ctx2.lineTo(px+TILE/2,py+1); ctx2.fill();

  // ─── WATER TROUGH ──────────────────────────────────────────────
  } else if(t===T.WATER_TROUGH){
    // Wooden body
    ctx2.fillStyle='#7a5020'; ctx2.fillRect(px+4,py+16,TILE-8,TILE-22);
    ctx2.fillStyle='#9a6830'; ctx2.fillRect(px+6,py+18,TILE-12,TILE-26);
    // Water inside
    ctx2.fillStyle='rgba(40,120,200,0.7)'; ctx2.fillRect(px+7,py+19,TILE-14,TILE-30);
    // Water shimmer
    const wt=frameNow*0.002;
    ctx2.fillStyle='rgba(100,180,255,0.3)';
    ctx2.fillRect(px+8+Math.sin(wt)*2,py+20,6,2);
    ctx2.fillRect(px+18+Math.sin(wt+1)*2,py+21,4,2);
    // Legs
    ctx2.fillStyle='#6a4010';
    ctx2.fillRect(px+5,py+TILE-10,4,10); ctx2.fillRect(px+TILE-9,py+TILE-10,4,10);

  // ─── SCARECROW ─────────────────────────────────────────────────
  } else if(t===T.SCARECROW){
    const sway=Math.sin(frameNow*0.0008)*2;
    ctx2.save(); ctx2.translate(px+TILE/2,py+TILE/2); ctx2.rotate(sway*0.04);
    // Post
    ctx2.fillStyle='#8a6030'; ctx2.fillRect(-2,-TILE/2+2,4,TILE-4);
    // Cross-arm
    ctx2.fillRect(-TILE/2+6,-TILE/2+10,TILE-12,3);
    // Coat body
    ctx2.fillStyle='#5a3a20';
    ctx2.fillRect(-7,-TILE/2+12,14,TILE/2-4);
    // Sleeves
    ctx2.fillRect(-TILE/2+6,-TILE/2+10,8,TILE/3-2);
    ctx2.fillRect(TILE/2-14,-TILE/2+10,8,TILE/3-2);
    // Head — burlap sack
    ctx2.fillStyle='#c8b060';
    ctx2.beginPath(); ctx2.arc(0,-TILE/2+10,7,0,Math.PI*2); ctx2.fill();
    // Face — stitched X eyes
    ctx2.strokeStyle='#4a3010'; ctx2.lineWidth=1;
    [[-3,-TILE/2+8],[3,-TILE/2+8]].forEach(([ex,ey])=>{
      ctx2.beginPath(); ctx2.moveTo(ex-1.5,ey-1.5); ctx2.lineTo(ex+1.5,ey+1.5); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(ex+1.5,ey-1.5); ctx2.lineTo(ex-1.5,ey+1.5); ctx2.stroke();
    });
    // Hat
    ctx2.fillStyle='#2a1a0a';
    ctx2.fillRect(-6,-TILE/2+1,12,3);
    ctx2.fillRect(-4,-TILE/2-4,8,7);
    // Straw tufts from sleeves
    ctx2.strokeStyle='#d4b040'; ctx2.lineWidth=0.8;
    for(let st=0;st<4;st++){
      ctx2.beginPath(); ctx2.moveTo(-TILE/2+8+st*1.5,-TILE/2+18+st); ctx2.lineTo(-TILE/2+6+st,-TILE/2+24+st*2); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(TILE/2-8-st*1.5,-TILE/2+18+st); ctx2.lineTo(TILE/2-6-st,-TILE/2+24+st*2); ctx2.stroke();
    }
    ctx2.restore();

  // ─── CROP WHEAT ────────────────────────────────────────────────
  } else if(t===T.CROP_WHEAT){
    const wt2=frameNow*0.0012;
    // Soil patch
    ctx2.fillStyle='#3a2810'; ctx2.fillRect(px+2,py+TILE-8,TILE-4,6);
    // Stalks with sway
    for(let si=0;si<5;si++){
      const sx=px+6+si*6;
      const sway2=Math.sin(wt2+si*0.7)*2;
      ctx2.strokeStyle='#8a7020'; ctx2.lineWidth=1.2;
      ctx2.beginPath(); ctx2.moveTo(sx,py+TILE-8); ctx2.quadraticCurveTo(sx+sway2,py+TILE/2,sx+sway2,py+8); ctx2.stroke();
      // Wheat head
      ctx2.fillStyle='#d4b030';
      for(let g=0;g<4;g++){
        ctx2.fillRect(sx+sway2-1,py+8+g*3,3,2);
      }
    }

  // ─── CROP TURNIP ───────────────────────────────────────────────
  } else if(t===T.CROP_TURNIP){
    // Soil
    ctx2.fillStyle='#3a2810'; ctx2.fillRect(px+4,py+TILE-8,TILE-8,6);
    // Turnip body — peeking from soil
    ctx2.fillStyle='#d060a0';
    ctx2.beginPath(); ctx2.ellipse(px+TILE/2,py+TILE-10,7,6,0,0,Math.PI*2); ctx2.fill();
    ctx2.fillStyle='#e080c0';
    ctx2.beginPath(); ctx2.ellipse(px+TILE/2-1,py+TILE-11,3,3,0,0,Math.PI*2); ctx2.fill();
    // Leafy greens
    ctx2.strokeStyle='#3a8020'; ctx2.lineWidth=1.5;
    const lw=frameNow*0.001;
    [[-3,-8],[0,-10],[3,-8]].forEach(([lx,ly])=>{
      ctx2.beginPath();
      ctx2.moveTo(px+TILE/2,py+TILE-12);
      ctx2.quadraticCurveTo(px+TILE/2+lx+Math.sin(lw)*1.5,py+TILE-16,px+TILE/2+lx*2,py+TILE-12+ly);
      ctx2.stroke();
    });

  // ─── TILLED SOIL ───────────────────────────────────────────────
  } else if(t===T.TILLED_SOIL){
    ctx2.fillStyle='#2a1a0a'; ctx2.fillRect(px,py,TILE,TILE);
    ctx2.strokeStyle='#1a0e05'; ctx2.lineWidth=1;
    for(let fy=0;fy<4;fy++){
      const ry=py+4+fy*9;
      ctx2.beginPath(); ctx2.moveTo(px+2,ry); ctx2.lineTo(px+TILE-2,ry); ctx2.stroke();
    }
    // Slight texture highlight
    ctx2.fillStyle='rgba(80,50,20,0.18)';
    for(let fy=0;fy<4;fy++) ctx2.fillRect(px+2,py+5+fy*9,TILE-4,3);

  // ─── SEEDLING ──────────────────────────────────────────────────
  } else if(t===T.SEEDLING){
    ctx2.fillStyle='#2a1a0a'; ctx2.fillRect(px,py,TILE,TILE);
    ctx2.strokeStyle='#1a0e05'; ctx2.lineWidth=1;
    for(let fy=0;fy<4;fy++){
      ctx2.beginPath(); ctx2.moveTo(px+2,py+4+fy*9); ctx2.lineTo(px+TILE-2,py+4+fy*9); ctx2.stroke();
    }
    // Tiny sprout
    ctx2.strokeStyle='#4a8020'; ctx2.lineWidth=1.5;
    ctx2.beginPath(); ctx2.moveTo(px+TILE/2,py+TILE-4); ctx2.lineTo(px+TILE/2,py+TILE-14); ctx2.stroke();
    ctx2.strokeStyle='#60a030';
    ctx2.beginPath(); ctx2.moveTo(px+TILE/2,py+TILE-12); ctx2.quadraticCurveTo(px+TILE/2-5,py+TILE-16,px+TILE/2-7,py+TILE-14); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(px+TILE/2,py+TILE-12); ctx2.quadraticCurveTo(px+TILE/2+5,py+TILE-16,px+TILE/2+7,py+TILE-14); ctx2.stroke();

  // ─── CROP GROWING ──────────────────────────────────────────────
  } else if(t===T.CROP_GROWING){
    ctx2.fillStyle='#2a1a0a'; ctx2.fillRect(px,py,TILE,TILE);
    ctx2.strokeStyle='#1a0e05'; ctx2.lineWidth=1;
    for(let fy=0;fy<4;fy++){
      ctx2.beginPath(); ctx2.moveTo(px+2,py+4+fy*9); ctx2.lineTo(px+TILE-2,py+4+fy*9); ctx2.stroke();
    }
    const sw=frameNow*0.001;
    ctx2.strokeStyle='#5a9030'; ctx2.lineWidth=1.5;
    for(let si=0;si<3;si++){
      const sx=px+8+si*10;
      const sway3=Math.sin(sw+si*1.1)*1.5;
      ctx2.beginPath(); ctx2.moveTo(sx,py+TILE-6); ctx2.quadraticCurveTo(sx+sway3,py+TILE/2+4,sx+sway3,py+TILE/2-4); ctx2.stroke();
      ctx2.fillStyle='#70c040';
      ctx2.beginPath(); ctx2.ellipse(sx+sway3,py+TILE/2-4,4,3,0.4,0,Math.PI*2); ctx2.fill();
    }

  // ─── HOME WHEAT ────────────────────────────────────────────────
  } else if(t===T.HOME_WHEAT){
    const wth=frameNow*0.0012;
    ctx2.fillStyle='#2a1a0a'; ctx2.fillRect(px,py,TILE,TILE);
    for(let si=0;si<5;si++){
      const sx=px+6+si*6; const sw2=Math.sin(wth+si*0.7)*2;
      ctx2.strokeStyle='#8a7020'; ctx2.lineWidth=1.2;
      ctx2.beginPath(); ctx2.moveTo(sx,py+TILE-4); ctx2.quadraticCurveTo(sx+sw2,py+TILE/2,sx+sw2,py+6); ctx2.stroke();
      ctx2.fillStyle='#d4b030';
      for(let g=0;g<4;g++) ctx2.fillRect(sx+sw2-1,py+6+g*3,3,2);
    }

  // ─── HOME TURNIP ───────────────────────────────────────────────
  } else if(t===T.HOME_TURNIP){
    ctx2.fillStyle='#2a1a0a'; ctx2.fillRect(px,py,TILE,TILE);
    ctx2.fillStyle='#d060a0';
    ctx2.beginPath(); ctx2.ellipse(px+TILE/2,py+TILE-8,7,6,0,0,Math.PI*2); ctx2.fill();
    ctx2.fillStyle='#e080c0';
    ctx2.beginPath(); ctx2.ellipse(px+TILE/2-1,py+TILE-9,3,3,0,0,Math.PI*2); ctx2.fill();
    const ltw=frameNow*0.001;
    ctx2.strokeStyle='#3a8020'; ctx2.lineWidth=1.5;
    [[-3,-8],[0,-10],[3,-8]].forEach(([lx,ly])=>{
      ctx2.beginPath(); ctx2.moveTo(px+TILE/2,py+TILE-10);
      ctx2.quadraticCurveTo(px+TILE/2+lx+Math.sin(ltw)*1.5,py+TILE-14,px+TILE/2+lx*2,py+TILE-10+ly); ctx2.stroke();
    });

  // ─── HOME CARROT ───────────────────────────────────────────────
  } else if(t===T.HOME_CARROT){
    ctx2.fillStyle='#2a1a0a'; ctx2.fillRect(px,py,TILE,TILE);
    // Carrot body
    ctx2.fillStyle='#e06010';
    ctx2.beginPath(); ctx2.moveTo(px+TILE/2-5,py+TILE-12);
    ctx2.lineTo(px+TILE/2+5,py+TILE-12); ctx2.lineTo(px+TILE/2,py+TILE-4); ctx2.closePath(); ctx2.fill();
    ctx2.fillStyle='#f07820';
    ctx2.beginPath(); ctx2.moveTo(px+TILE/2-4,py+TILE-12); ctx2.lineTo(px+TILE/2,py+TILE-13); ctx2.lineTo(px+TILE/2+4,py+TILE-12); ctx2.closePath(); ctx2.fill();
    const ctw=frameNow*0.0009;
    ctx2.strokeStyle='#3a8020'; ctx2.lineWidth=1.5;
    [[-4,-9],[0,-12],[4,-9]].forEach(([lx,ly])=>{
      ctx2.beginPath(); ctx2.moveTo(px+TILE/2,py+TILE-12);
      ctx2.quadraticCurveTo(px+TILE/2+lx+Math.sin(ctw)*1.5,py+TILE-16,px+TILE/2+lx*2,py+TILE-12+ly); ctx2.stroke();
    });

  // ─── HOME POTATO ───────────────────────────────────────────────
  } else if(t===T.HOME_POTATO){
    ctx2.fillStyle='#2a1a0a'; ctx2.fillRect(px,py,TILE,TILE);
    ctx2.fillStyle='#b08040';
    ctx2.beginPath(); ctx2.ellipse(px+TILE/2,py+TILE-9,9,6,0,0,Math.PI*2); ctx2.fill();
    ctx2.fillStyle='#c89050';
    ctx2.beginPath(); ctx2.ellipse(px+TILE/2-2,py+TILE-10,4,3,0.3,0,Math.PI*2); ctx2.fill();
    // Eyes (bumps)
    ctx2.fillStyle='#9a7030';
    [[3,0],[-3,1],[0,-2]].forEach(([ex,ey])=>{
      ctx2.beginPath(); ctx2.arc(px+TILE/2+ex,py+TILE-9+ey,1.2,0,Math.PI*2); ctx2.fill();
    });
    // Leafy stalks
    const ptw=frameNow*0.001;
    ctx2.strokeStyle='#4a8030'; ctx2.lineWidth=1.2;
    [[-4,-8],[0,-10],[4,-8]].forEach(([lx,ly])=>{
      ctx2.beginPath(); ctx2.moveTo(px+TILE/2,py+TILE-12);
      ctx2.quadraticCurveTo(px+TILE/2+lx+Math.sin(ptw)*1.5,py+TILE-16,px+TILE/2+lx*2,py+TILE-12+ly); ctx2.stroke();
    });

  // ─── HOME ONION ────────────────────────────────────────────────
  } else if(t===T.HOME_ONION){
    ctx2.fillStyle='#2a1a0a'; ctx2.fillRect(px,py,TILE,TILE);
    ctx2.fillStyle='#9060b0';
    ctx2.beginPath(); ctx2.ellipse(px+TILE/2,py+TILE-8,8,7,0,0,Math.PI*2); ctx2.fill();
    ctx2.fillStyle='#b080d0';
    ctx2.beginPath(); ctx2.ellipse(px+TILE/2-1,py+TILE-9,4,4,0,0,Math.PI*2); ctx2.fill();
    ctx2.strokeStyle='#c0a0e0'; ctx2.lineWidth=0.8;
    for(let ol=0;ol<3;ol++){
      ctx2.beginPath(); ctx2.ellipse(px+TILE/2,py+TILE-8+ol*2,8-ol,7-ol*1.5,0,0,Math.PI); ctx2.stroke();
    }
    const otw=frameNow*0.001;
    ctx2.strokeStyle='#4a8020'; ctx2.lineWidth=1.5;
    [[-3,-10],[0,-12],[3,-10]].forEach(([lx,ly])=>{
      ctx2.beginPath(); ctx2.moveTo(px+TILE/2,py+TILE-12);
      ctx2.quadraticCurveTo(px+TILE/2+lx+Math.sin(otw)*1.5,py+TILE-16,px+TILE/2+lx*2,py+TILE-12+ly); ctx2.stroke();
    });

  // ─── WINDMILL ──────────────────────────────────────────────────
  } else if(t===T.WINDMILL){
    const wt3=frameNow*0.0008;
    // Stone tower base
    ctx2.fillStyle='#7a7060';
    ctx2.beginPath(); ctx2.roundRect(px+8,py+8,TILE-16,TILE-10,3); ctx2.fill();
    ctx2.fillStyle='#9a9080';
    ctx2.fillRect(px+10,py+10,6,TILE-14);
    // Door
    ctx2.fillStyle='#5a3820';
    ctx2.beginPath(); ctx2.arc(px+TILE/2,py+TILE-8,5,Math.PI,0); ctx2.lineTo(px+TILE/2+5,py+TILE-4); ctx2.lineTo(px+TILE/2-5,py+TILE-4); ctx2.fill();
    // Rotating blades
    ctx2.save(); ctx2.translate(px+TILE/2,py+TILE/2-2); ctx2.rotate(wt3);
    ctx2.fillStyle='#c8a050';
    for(let bl=0;bl<4;bl++){
      ctx2.save(); ctx2.rotate(bl*Math.PI/2);
      ctx2.beginPath(); ctx2.moveTo(-2,0); ctx2.lineTo(2,0); ctx2.lineTo(3,-TILE*0.45); ctx2.lineTo(-3,-TILE*0.45); ctx2.closePath(); ctx2.fill();
      ctx2.restore();
    }
    // Hub
    ctx2.fillStyle='#5a3820'; ctx2.beginPath(); ctx2.arc(0,0,3,0,Math.PI*2); ctx2.fill();
    ctx2.restore();

  } else if(t===T.WIZARD_DOOR){
    // Ancient iron-banded wooden door with arcane glyph
    ctx2.fillStyle='#2a1808'; ctx2.fillRect(px+6,py+8,TILE-12,TILE-10);
    // Planks
    ctx2.strokeStyle='#1a1005'; ctx2.lineWidth=1;
    [14,20,26].forEach(yy=>{ ctx2.beginPath(); ctx2.moveTo(px+7,py+yy); ctx2.lineTo(px+TILE-7,py+yy); ctx2.stroke(); });
    // Iron bands
    ctx2.fillStyle='#4a4a50';
    ctx2.fillRect(px+6,py+10,TILE-12,3); ctx2.fillRect(px+6,py+26,TILE-12,3);
    // Door handle
    ctx2.fillStyle='#c8922a'; ctx2.beginPath(); ctx2.arc(px+TILE-11,py+22,2.5,0,Math.PI*2); ctx2.fill();
    // Arcane glyph — glowing triangle
    const glow=0.5+Math.sin(frameNow*0.003)*0.3;
    ctx2.strokeStyle=`rgba(140,80,220,${glow})`; ctx2.lineWidth=1.5;
    ctx2.beginPath(); ctx2.moveTo(px+TILE/2,py+13); ctx2.lineTo(px+TILE/2-5,py+22); ctx2.lineTo(px+TILE/2+5,py+22); ctx2.closePath(); ctx2.stroke();
    // Frame
    ctx2.strokeStyle='#5a4030'; ctx2.lineWidth=2;
    ctx2.strokeRect(px+5,py+7,TILE-10,TILE-9);

  } else if(t===T.ARCANE_CIRCLE){
    // Glowing runic circle inlaid into the floor
    const t2=frameNow;
    const pulse=0.6+Math.sin(t2*0.002)*0.25;
    // Outer ring
    ctx2.strokeStyle=`rgba(120,60,200,${pulse})`; ctx2.lineWidth=2;
    ctx2.beginPath(); ctx2.arc(cx,py+TILE*0.55,TILE*0.38,0,Math.PI*2); ctx2.stroke();
    // Inner ring
    ctx2.strokeStyle=`rgba(180,100,255,${pulse*0.8})`; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.arc(cx,py+TILE*0.55,TILE*0.24,0,Math.PI*2); ctx2.stroke();
    // Rotating runes (4 marks)
    ctx2.save(); ctx2.translate(cx,py+TILE*0.55); ctx2.rotate(t2*0.0006);
    ctx2.fillStyle=`rgba(200,140,255,${pulse})`;
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      ctx2.beginPath(); ctx2.arc(Math.cos(a)*TILE*0.31,Math.sin(a)*TILE*0.31,2.5,0,Math.PI*2); ctx2.fill();
    }
    ctx2.restore();
    // Centre glow
    const cg=ctx2.createRadialGradient(cx,py+TILE*0.55,1,cx,py+TILE*0.55,TILE*0.22);
    cg.addColorStop(0,`rgba(160,80,255,${pulse*0.4})`); cg.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=cg; ctx2.beginPath(); ctx2.arc(cx,py+TILE*0.55,TILE*0.22,0,Math.PI*2); ctx2.fill();

  } else if(t===T.CRYSTAL_BALL){
    // Crystal ball on an ornate stand
    // Stand
    ctx2.fillStyle='#5a3820'; ctx2.fillRect(px+12,py+28,TILE-24,5);
    ctx2.fillStyle='#7a5030'; ctx2.fillRect(px+14,py+24,TILE-28,6);
    // Ball shadow
    ctx2.fillStyle='rgba(0,0,0,0.25)'; ctx2.beginPath(); ctx2.ellipse(cx,py+TILE*0.6,9,4,0,0,Math.PI*2); ctx2.fill();
    // Ball body
    const bg2=ctx2.createRadialGradient(cx-3,py+14,2,cx,py+17,11);
    const swirl=frameNow*0.002;
    bg2.addColorStop(0,'rgba(220,200,255,0.95)');
    bg2.addColorStop(0.4,`rgba(${100+Math.sin(swirl)*40},60,${180+Math.cos(swirl)*40},0.85)`);
    bg2.addColorStop(1,'rgba(30,10,60,0.9)');
    ctx2.fillStyle=bg2; ctx2.beginPath(); ctx2.arc(cx,py+17,11,0,Math.PI*2); ctx2.fill();
    // Specular
    ctx2.fillStyle='rgba(255,255,255,0.7)'; ctx2.beginPath(); ctx2.ellipse(cx-4,py+12,3,2,-0.5,0,Math.PI*2); ctx2.fill();
    // Inner swirl light
    ctx2.strokeStyle=`rgba(200,160,255,${0.4+Math.sin(swirl*1.3)*0.2})`; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.arc(cx,py+17,6,swirl,swirl+Math.PI*1.2); ctx2.stroke();

  } else if(t===T.CAULDRON){
    // Large iron cauldron with bubbling potion
    // Legs
    ctx2.fillStyle='#2a2a2a';
    [[-6,4],[6,4]].forEach(([ox,h])=>{ ctx2.fillRect(px+TILE/2+ox-2,py+TILE-h-2,3,h); });
    // Body
    ctx2.fillStyle='#353535';
    ctx2.beginPath(); ctx2.ellipse(cx,py+TILE*0.62,13,10,0,0,Math.PI*2); ctx2.fill();
    // Rim
    ctx2.fillStyle='#454545'; ctx2.beginPath(); ctx2.ellipse(cx,py+TILE*0.5,13,4,0,0,Math.PI*2); ctx2.fill();
    // Liquid surface — green bubbling brew
    const bub=frameNow*0.003;
    ctx2.fillStyle=`rgba(${20+Math.sin(bub)*15},${120+Math.cos(bub*0.7)*20},30,0.9)`;
    ctx2.beginPath(); ctx2.ellipse(cx,py+TILE*0.5,11,3,0,0,Math.PI*2); ctx2.fill();
    // Bubbles
    ctx2.fillStyle='rgba(80,220,60,0.7)';
    [[0,0],[4,1],[-4,-1],[2,-2]].forEach(([ox,oy],i)=>{
      const r=1.2+Math.sin(bub*1.3+i)*0.5;
      ctx2.beginPath(); ctx2.arc(cx+ox+Math.sin(bub+i),py+TILE*0.5+oy+Math.cos(bub+i)*1.5,r,0,Math.PI*2); ctx2.fill();
    });
    // Steam wisps
    ctx2.strokeStyle=`rgba(180,255,160,${0.2+Math.sin(bub)*0.1})`; ctx2.lineWidth=1.5; ctx2.lineCap='round';
    [[-3,-8],[0,-10],[4,-7]].forEach(([ox,oy],i)=>{
      const w=Math.sin(bub*0.8+i)*3;
      ctx2.beginPath(); ctx2.moveTo(cx+ox,py+TILE*0.45); ctx2.quadraticCurveTo(cx+ox+w,py+TILE*0.45+oy/2,cx+ox-w,py+TILE*0.45+oy); ctx2.stroke();
    });

  } else if(t===T.TELESCOPE){
    // Brass telescope on a tripod
    // Tripod legs
    ctx2.strokeStyle='#6a4820'; ctx2.lineWidth=2; ctx2.lineCap='round';
    [[TILE/2-8,TILE-5],[TILE/2,TILE-4],[TILE/2+8,TILE-5]].forEach(([tx2,ty2])=>{
      ctx2.beginPath(); ctx2.moveTo(px+TILE/2,py+TILE*0.45); ctx2.lineTo(px+tx2,py+ty2); ctx2.stroke();
    });
    // Tube body — angled NE
    ctx2.save(); ctx2.translate(px+TILE/2,py+TILE*0.45); ctx2.rotate(-Math.PI*0.3);
    ctx2.fillStyle='#b07820';
    ctx2.fillRect(-3,-14,7,22);
    // Eyepiece
    ctx2.fillStyle='#7a5010'; ctx2.fillRect(-2,-18,5,6);
    // Lens end
    ctx2.fillStyle='#2040a0'; ctx2.beginPath(); ctx2.ellipse(3.5,8,4,3,0,0,Math.PI*2); ctx2.fill();
    ctx2.fillStyle='rgba(100,160,255,0.5)'; ctx2.beginPath(); ctx2.ellipse(3.5,8,2,1.5,0,0,Math.PI*2); ctx2.fill();
    ctx2.restore();

  } else if(t===T.POTION_RACK){
    // Wall-mounted rack with colourful potion bottles
    // Shelf plank
    ctx2.fillStyle='#5a3820'; ctx2.fillRect(px+3,py+18,TILE-6,4);
    // Wall mount
    ctx2.fillStyle='#3a2810'; ctx2.fillRect(px+5,py+12,3,8); ctx2.fillRect(px+TILE-8,py+12,3,8);
    // Bottles — 4 per rack, varied colours
    const bottleColors=['#c84040','#40a0c8','#60c840','#c8a020'];
    bottleColors.forEach((col,i)=>{
      const bx=px+5+i*(TILE-10)/3.5;
      ctx2.fillStyle=col;
      ctx2.beginPath(); ctx2.ellipse(bx+3,py+15,3,4,0,0,Math.PI*2); ctx2.fill();
      ctx2.fillRect(bx+1,py+9,4,7);
      // Cork
      ctx2.fillStyle='#8a6040'; ctx2.fillRect(bx+1,py+7,4,3);
      // Shine
      ctx2.fillStyle='rgba(255,255,255,0.5)'; ctx2.beginPath(); ctx2.ellipse(bx+2,py+13,1,2,0,0,Math.PI*2); ctx2.fill();
    });

  } else if(t===T.SPELL_TOME){
    // Open tome on a reading stand
    // Stand legs
    ctx2.fillStyle='#4a2e10'; ctx2.fillRect(px+14,py+28,12,4); ctx2.fillRect(px+17,py+22,6,8);
    // Book open — two pages
    ctx2.fillStyle='#e8dfc0';
    ctx2.beginPath(); ctx2.moveTo(px+6,py+26); ctx2.bezierCurveTo(px+6,py+8,px+TILE/2,py+10,px+TILE/2,py+24); ctx2.closePath(); ctx2.fill();
    ctx2.beginPath(); ctx2.moveTo(px+TILE-6,py+26); ctx2.bezierCurveTo(px+TILE-6,py+8,px+TILE/2,py+10,px+TILE/2,py+24); ctx2.closePath(); ctx2.fill();
    // Spine
    ctx2.fillStyle='#5a3018'; ctx2.fillRect(px+TILE/2-1,py+10,2,14);
    // Writing lines on pages
    ctx2.strokeStyle='rgba(80,50,20,0.4)'; ctx2.lineWidth=0.8;
    [14,17,20,23].forEach(yy=>{ ctx2.beginPath(); ctx2.moveTo(px+9,py+yy); ctx2.lineTo(px+TILE/2-3,py+yy); ctx2.stroke(); });
    [14,17,20,23].forEach(yy=>{ ctx2.beginPath(); ctx2.moveTo(px+TILE/2+3,py+yy); ctx2.lineTo(px+TILE-9,py+yy); ctx2.stroke(); });
    // Glowing rune on right page
    const rg=0.5+Math.sin(frameNow*0.004)*0.3;
    ctx2.fillStyle=`rgba(120,60,200,${rg})`;
    ctx2.beginPath(); ctx2.arc(px+TILE*0.72,py+17,3,0,Math.PI*2); ctx2.fill();

  } else if(t===T.STONE_RUBBLE){
    // Pile of broken stone chunks
    ctx2.fillStyle='#666060';
    [[8,28,10,5],[18,26,8,5],[6,22,12,6],[20,24,9,4],[12,20,8,7]].forEach(([rx,ry,rw,rh])=>{
      ctx2.fillRect(px+rx,py+ry,rw,rh);
      ctx2.fillStyle='#504848'; ctx2.fillRect(px+rx,py+ry,rw,2);
      ctx2.fillStyle='#777070'; ctx2.fillRect(px+rx,py+ry+rh-1,rw,1);
      ctx2.fillStyle='#666060';
    });
    ctx2.fillStyle='#554e4e'; ctx2.fillRect(px+10,py+30,18,4);

  } else if(t===T.CRACKED_WALL){
    // Stone wall with visible crack running through
    ctx2.fillStyle='#3a3535'; ctx2.fillRect(px,py,TILE,TILE);
    // Mortar lines
    ctx2.strokeStyle='#2a2525'; ctx2.lineWidth=1;
    [10,20,30].forEach(yy=>{ ctx2.beginPath(); ctx2.moveTo(px,py+yy); ctx2.lineTo(px+TILE,py+yy); ctx2.stroke(); });
    [8,20,32].forEach(xx=>{ ctx2.beginPath(); ctx2.moveTo(px+xx,py); ctx2.lineTo(px+xx,py+TILE); ctx2.stroke(); });
    // Jagged crack
    ctx2.strokeStyle='#181515'; ctx2.lineWidth=1.5;
    ctx2.beginPath();
    ctx2.moveTo(px+TILE*0.4,py+0);
    ctx2.lineTo(px+TILE*0.42,py+8);
    ctx2.lineTo(px+TILE*0.36,py+16);
    ctx2.lineTo(px+TILE*0.45,py+24);
    ctx2.lineTo(px+TILE*0.38,py+32);
    ctx2.lineTo(px+TILE*0.44,py+TILE);
    ctx2.stroke();
    // Dust fragments
    ctx2.fillStyle='#4a4444';
    [[TILE*0.35,10],[TILE*0.48,20],[TILE*0.32,28]].forEach(([fx,fy])=>{
      ctx2.fillRect(px+fx,py+fy,3,2);
    });
  } else if(t===T.DUNGEON_STAIR_DOWN||t===T.DUNGEON_STAIR_UP){
    drawDungeonStair(ctx2,px,py,t);
  } else if(t===T.CRYPT_STAIR){
    drawDungeonStair(ctx2,px,py,T.DUNGEON_STAIR_DOWN);
    // Purple tint for crypt
    ctx2.fillStyle='rgba(80,0,120,0.3)'; ctx2.fillRect(px,py,TILE,TILE);
  } else if(t===T.DUNGEON_TORCH){
    drawDungeonTorch(ctx2,px,py,frameNow);
  } else if(t===T.COBBLE){
    // Cobblestone pattern
    ctx2.strokeStyle='rgba(255,255,255,0.06)';
    ctx2.lineWidth=0.8;
    // Brick rows offset
    const row = y % 2;
    for(let i=0;i<2;i++){
      const bx = px + (row===0 ? i*20 : i*20+10)%TILE;
      ctx2.strokeRect(bx, py+1, 18, TILE/2-2);
      ctx2.strokeRect(bx, py+TILE/2+1, 18, TILE/2-2);
    }
  } else if(t===T.TABLE){
    // Wooden table top
    ctx2.fillStyle='#3a2410';
    ctx2.fillRect(px+4,py+10,TILE-8,TILE-16);
    ctx2.strokeStyle='#6a4820'; ctx2.lineWidth=1.5;
    ctx2.strokeRect(px+4,py+10,TILE-8,TILE-16);
    // Table legs
    ctx2.fillStyle='#2a1a0a';
    ctx2.fillRect(px+5,py+22,3,6);
    ctx2.fillRect(px+TILE-8,py+22,3,6);
    // Wood grain lines
    ctx2.strokeStyle='rgba(100,60,20,0.4)'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(px+8,py+12); ctx2.lineTo(px+8,py+24); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(px+14,py+12); ctx2.lineTo(px+14,py+24); ctx2.stroke();
  } else if(t===T.BARREL){
    
    // Barrel body
    ctx2.fillStyle='#3a2208';
    ctx2.beginPath(); ctx2.ellipse(cx,cy,TILE*.28,TILE*.36,0,0,Math.PI*2); ctx2.fill();
    ctx2.strokeStyle='#6a4010'; ctx2.lineWidth=1.5; ctx2.stroke();
    // Barrel bands
    ctx2.strokeStyle='#8a6030'; ctx2.lineWidth=2;
    ctx2.beginPath(); ctx2.ellipse(cx,cy-TILE*.12,TILE*.28,TILE*.08,0,0,Math.PI*2); ctx2.stroke();
    ctx2.beginPath(); ctx2.ellipse(cx,cy+TILE*.12,TILE*.28,TILE*.08,0,0,Math.PI*2); ctx2.stroke();
    // Top
    ctx2.fillStyle='#4a2e10';
    ctx2.beginPath(); ctx2.ellipse(cx,cy-TILE*.28,TILE*.28,TILE*.1,0,0,Math.PI*2); ctx2.fill();
    ctx2.strokeStyle='#6a4010'; ctx2.lineWidth=1; ctx2.stroke();
  } else if(t===T.INN){
    // Tavern — warm timber building with gabled roof, lit windows, hanging sign
    const now2 = frameNow;
    const warmFlicker = 0.5 + 0.2*Math.sin(now2*0.003 + x*0.4);
    // Warm stone/plaster wall
    ctx2.fillStyle='#241c12';
    ctx2.fillRect(px+2,py+12,TILE-4,TILE-14);
    ctx2.strokeStyle='rgba(255,255,255,0.04)'; ctx2.lineWidth=1;
    ctx2.strokeRect(px+2,py+12,TILE-4,TILE-14);
    // Timber frame
    ctx2.fillStyle='#14100a';
    ctx2.fillRect(px+2,py+12,3,TILE-14);
    ctx2.fillRect(px+TILE-5,py+12,3,TILE-14);
    ctx2.fillRect(px+2,py+21,TILE-4,2);
    // Gabled roof — warm dark red-brown
    ctx2.fillStyle='#2e1408';
    ctx2.beginPath(); ctx2.moveTo(px,py+14); ctx2.lineTo(cx,py+3); ctx2.lineTo(px+TILE,py+14); ctx2.closePath(); ctx2.fill();
    ctx2.strokeStyle='#4a2010'; ctx2.lineWidth=1.5; ctx2.stroke();
    // Roof ridge peak accent
    ctx2.strokeStyle='#6a3418'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(px+5,py+14); ctx2.lineTo(cx,py+4); ctx2.lineTo(px+TILE-5,py+14); ctx2.stroke();
    // Chimney — left side
    ctx2.fillStyle='#1c1410';
    ctx2.fillRect(px+6,py-2,7,14);
    ctx2.strokeStyle='#2e2018'; ctx2.lineWidth=1; ctx2.strokeRect(px+6,py-2,7,14);
    ctx2.fillStyle='#14100e'; ctx2.fillRect(px+5,py-3,9,3);
    // Chimney smoke + warm glow
    ctx2.strokeStyle=`rgba(200,160,100,${0.2+warmFlicker*0.15})`; ctx2.lineWidth=1.5;
    ctx2.beginPath(); ctx2.moveTo(px+9,py-3); ctx2.quadraticCurveTo(px+6,py-8,px+11,py-13); ctx2.stroke();
    // Warm window glow (left + right)
    const wgAmt = 0.22 + warmFlicker*0.1;
    ctx2.fillStyle=`rgba(220,140,40,${wgAmt})`;
    ctx2.fillRect(px+5,py+23,8,6);
    ctx2.fillRect(px+TILE-13,py+23,8,6);
    ctx2.strokeStyle='#3a2810'; ctx2.lineWidth=1;
    ctx2.strokeRect(px+5,py+23,8,6);
    ctx2.strokeRect(px+TILE-13,py+23,8,6);
    // Window cross-bars
    ctx2.strokeStyle='#1a1008'; ctx2.lineWidth=0.8;
    ctx2.beginPath(); ctx2.moveTo(px+9,py+23); ctx2.lineTo(px+9,py+29);
    ctx2.moveTo(px+5,py+26); ctx2.lineTo(px+13,py+26); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(px+TILE-9,py+23); ctx2.lineTo(px+TILE-9,py+29);
    ctx2.moveTo(px+TILE-13,py+26); ctx2.lineTo(px+TILE-5,py+26); ctx2.stroke();
    // Door — arched top
    ctx2.fillStyle='#100c08';
    ctx2.fillRect(cx-6,py+TILE-16,12,14);
    ctx2.strokeStyle='#4a3018'; ctx2.lineWidth=1.5; ctx2.strokeRect(cx-6,py+TILE-16,12,14);
    ctx2.fillStyle='#100c08';
    ctx2.beginPath(); ctx2.arc(cx,py+TILE-16,6,Math.PI,0); ctx2.fill();
    // Doorstep warm light spill
    ctx2.fillStyle=`rgba(200,120,30,${wgAmt*0.8})`;
    ctx2.fillRect(cx-7,py+TILE-4,14,4);
    // Hanging tavern sign
    ctx2.fillStyle='#1e1408';
    ctx2.fillRect(cx-9,py+11,18,7);
    ctx2.strokeStyle='#5a3a18'; ctx2.lineWidth=1.2; ctx2.strokeRect(cx-9,py+11,18,7);
    // Chain strings
    ctx2.strokeStyle='#3a2810'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(cx-7,py+11); ctx2.lineTo(cx-7,py+7); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(cx+7,py+11); ctx2.lineTo(cx+7,py+7); ctx2.stroke();
    // Mug on sign
    ctx2.fillStyle='#c8922a'; ctx2.fillRect(cx-5,py+12,8,4);
    ctx2.strokeStyle='#e8b84b'; ctx2.lineWidth=0.8; ctx2.strokeRect(cx-5,py+12,8,4);
    ctx2.beginPath(); ctx2.arc(cx+4,py+14,2,Math.PI*0.5,Math.PI*1.5); ctx2.stroke();
  } else if(t===T.BED){
    // Bed frame
    ctx2.fillStyle='#2a1a0a';
    ctx2.fillRect(px+3,py+5,TILE-6,TILE-8);
    ctx2.strokeStyle='#5a3010'; ctx2.lineWidth=1.5;
    ctx2.strokeRect(px+3,py+5,TILE-6,TILE-8);
    // Pillow
    ctx2.fillStyle='#d4c4a0';
    ctx2.fillRect(px+5,py+7,12,8);
    ctx2.strokeStyle='#b0a080'; ctx2.lineWidth=1;
    ctx2.strokeRect(px+5,py+7,12,8);
    // Blanket
    ctx2.fillStyle='#6a3a5a';
    ctx2.fillRect(px+5,py+16,TILE-10,12);
    // Blanket fold line
    ctx2.strokeStyle='#8a5a7a'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(px+5,py+20); ctx2.lineTo(px+TILE-5,py+20); ctx2.stroke();
    // Headboard
    ctx2.fillStyle='#3a2010';
    ctx2.fillRect(px+3,py+4,TILE-6,4);
  } else if(t===T.BOOKSHELF){
    // Shelf frame
    ctx2.fillStyle='#2a1808';
    ctx2.fillRect(px+3,py+3,TILE-6,TILE-6);
    ctx2.strokeStyle='#5a3010'; ctx2.lineWidth=1.5;
    ctx2.strokeRect(px+3,py+3,TILE-6,TILE-6);
    // Shelf planks
    ctx2.strokeStyle='#4a2808'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(px+3,py+14); ctx2.lineTo(px+TILE-3,py+14); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(px+3,py+24); ctx2.lineTo(px+TILE-3,py+24); ctx2.stroke();
    // Books — row 1
    const bookColors=['#8a2020','#1a4a2a','#2a2a6a','#6a5010','#5a1a5a'];
    for(let i=0;i<5;i++){
      ctx2.fillStyle=bookColors[i];
      ctx2.fillRect(px+5+i*6,py+5,5,8);
    }
    // Books — row 2
    for(let i=0;i<4;i++){
      ctx2.fillStyle=bookColors[(i+2)%5];
      ctx2.fillRect(px+6+i*7,py+16,5,7);
    }
    // Books — row 3 (a couple)
    ctx2.fillStyle=bookColors[0]; ctx2.fillRect(px+5,py+26,5,7);
    ctx2.fillStyle=bookColors[3]; ctx2.fillRect(px+11,py+26,5,7);
    ctx2.fillStyle=bookColors[2]; ctx2.fillRect(px+17,py+26,5,7);
  } else if(t===T.CANDLE){
    // Candle holder base
    ctx2.fillStyle='#4a3a10';
    ctx2.fillRect(px+14,py+28,12,4);
    // Candle body
    ctx2.fillStyle='#e8dfc0';
    ctx2.fillRect(px+17,py+14,6,15);
    ctx2.strokeStyle='#c8b890'; ctx2.lineWidth=1;
    ctx2.strokeRect(px+17,py+14,6,15);
    // Flame
    const flicker2=frameNow*0.005+x*1.3+y*0.7;
    const fw=2+Math.sin(flicker2)*1;
    ctx2.fillStyle=`rgba(255,160,30,0.95)`;
    ctx2.beginPath(); ctx2.ellipse(cx,py+11,fw,5,0,0,Math.PI*2); ctx2.fill();
    ctx2.fillStyle=`rgba(255,220,80,0.8)`;
    ctx2.beginPath(); ctx2.ellipse(cx,py+12,fw*0.5,2.5,0,0,Math.PI*2); ctx2.fill();
    // Glow — larger at night
    const candleNight = getNightAlpha();
    const candleGlowR = 16 + candleNight * 20;
    const cg=ctx2.createRadialGradient(cx,py+11,1,cx,py+11,candleGlowR);
    cg.addColorStop(0,`rgba(255,180,50,${0.3+Math.sin(flicker2)*0.1+candleNight*0.25})`);
    cg.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=cg; ctx2.fillRect(cx-candleGlowR,py+11-candleGlowR,candleGlowR*2,candleGlowR*2);
  } else if(t===T.CHEST){
    // Chest body
    ctx2.fillStyle='#3a2008';
    ctx2.fillRect(px+4,py+12,TILE-8,TILE-16);
    ctx2.strokeStyle='#7a4a10'; ctx2.lineWidth=1.5;
    ctx2.strokeRect(px+4,py+12,TILE-8,TILE-16);
    // Lid (slightly lighter)
    ctx2.fillStyle='#4a2c10';
    ctx2.fillRect(px+4,py+8,TILE-8,8);
    ctx2.strokeStyle='#7a4a10'; ctx2.lineWidth=1.5;
    ctx2.strokeRect(px+4,py+8,TILE-8,8);
    // Metal bands
    ctx2.strokeStyle='#8a7040'; ctx2.lineWidth=2;
    ctx2.beginPath(); ctx2.moveTo(px+4,py+16); ctx2.lineTo(px+TILE-4,py+16); ctx2.stroke();
    // Lock
    ctx2.fillStyle='#c8922a';
    ctx2.fillRect(cx-3,py+13,6,5);
    ctx2.strokeStyle='#e8b84b'; ctx2.lineWidth=1;
    ctx2.strokeRect(cx-3,py+13,6,5);
    // Keyhole
    ctx2.fillStyle='#1a0e00';
    ctx2.beginPath(); ctx2.arc(cx,py+15,1.5,0,Math.PI*2); ctx2.fill();
  } else if(t===T.NOTICE_BOARD){
    ctx2.save();
    ctx2.translate(px,py);
    
    // Wooden frame
    ctx2.fillStyle='#3a2208';
    ctx2.fillRect(0+2,0+3,TILE-4,TILE-8);
    ctx2.strokeStyle='#6a3c10'; ctx2.lineWidth=2;
    ctx2.strokeRect(0+2,0+3,TILE-4,TILE-8);
    // Corner pegs
    for(const[bx,by] of [[0+4,0+5],[0+TILE-8,0+5],[0+4,0+TILE-12],[0+TILE-8,0+TILE-12]]){
      ctx2.fillStyle='#8a5820'; ctx2.beginPath(); ctx2.arc(bx,by,2,0,Math.PI*2); ctx2.fill();
    }
    // Main parchment
    ctx2.fillStyle='#d4c080';
    ctx2.fillRect(0+5,0+6,TILE-10,TILE-14);
    // Parchment edge shadow
    ctx2.strokeStyle='rgba(80,50,0,0.4)'; ctx2.lineWidth=1;
    ctx2.strokeRect(0+5,0+6,TILE-10,TILE-14);
    // Handwritten lines (ink)
    ctx2.strokeStyle='rgba(30,18,5,0.7)'; ctx2.lineWidth=1;
    for(let li=0;li<4;li++){
      const lw = li%2===0 ? TILE-18 : TILE-24;
      ctx2.beginPath(); ctx2.moveTo(0+7,0+10+li*4); ctx2.lineTo(0+7+lw,0+10+li*4); ctx2.stroke();
    }
    // Red wax seal bottom-right
    ctx2.fillStyle='#8a1818';
    ctx2.beginPath(); ctx2.arc(0+TILE-10,0+TILE-11,4,0,Math.PI*2); ctx2.fill();
    ctx2.fillStyle='#c02020';
    ctx2.beginPath(); ctx2.arc(0+TILE-10,0+TILE-11,2.5,0,Math.PI*2); ctx2.fill();
    // Small pinned note top-right corner
    ctx2.fillStyle='#e8d89a';
    ctx2.fillRect(0+TILE-12,0+8,8,7);
    ctx2.strokeStyle='rgba(60,40,0,0.4)'; ctx2.lineWidth=0.8;
    ctx2.strokeRect(0+TILE-12,0+8,8,7);
    ctx2.fillStyle='#8a1818'; // red pin
    ctx2.beginPath(); ctx2.arc(0+TILE-8,0+9,1.5,0,Math.PI*2); ctx2.fill();
    ctx2.restore();
  } else if(t===T.SMALL_TABLE){
    // Small cosy wooden table — top-down view, round-ish
    ctx2.fillStyle='#3a2810'; ctx2.fillRect(px+6,py+8,TILE-12,TILE-14);
    ctx2.fillStyle='#4e3418'; ctx2.fillRect(px+8,py+10,TILE-16,TILE-18);
    // Tabletop grain lines
    ctx2.strokeStyle='#2e1c08'; ctx2.lineWidth=0.7;
    for(let i=0;i<3;i++){ ctx2.beginPath(); ctx2.moveTo(px+9,py+13+i*4); ctx2.lineTo(px+TILE-9,py+13+i*4); ctx2.stroke(); }
    // Candle on table
    ctx2.fillStyle='#e8d880'; ctx2.fillRect(cx-1,py+9,2,5);
    const tf=0.5+0.3*Math.sin(frameNow*0.004+x*1.1);
    const tg=ctx2.createRadialGradient(cx,py+9,0,cx,py+9,6);
    tg.addColorStop(0,`rgba(255,200,60,${tf*0.6})`); tg.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=tg; ctx2.fillRect(cx-6,py+3,12,12);
    // Legs shadow
    ctx2.fillStyle='rgba(0,0,0,0.25)'; ctx2.fillRect(px+6,py+TILE-8,4,4); ctx2.fillRect(px+TILE-10,py+TILE-8,4,4);

  } else if(t===T.WARDROBE){
    // Wardrobe — tall dark cabinet viewed from above, front face visible
    ctx2.fillStyle='#1a1008'; ctx2.fillRect(px+4,py+2,TILE-8,TILE-6);
    // Top edge (cabinet top)
    ctx2.fillStyle='#2e2010'; ctx2.fillRect(px+4,py+2,TILE-8,5);
    // Door panels
    ctx2.fillStyle='#241808';
    ctx2.fillRect(px+5,py+8,TILE/2-5,TILE-18);
    ctx2.fillRect(px+TILE/2+1,py+8,TILE/2-6,TILE-18);
    // Door gap
    ctx2.fillStyle='#0e0c08'; ctx2.fillRect(cx-1,py+8,2,TILE-16);
    // Handles
    ctx2.fillStyle='#7a6848';
    ctx2.beginPath(); ctx2.arc(px+TILE/2-4,py+TILE/2,2,0,Math.PI*2); ctx2.fill();
    ctx2.beginPath(); ctx2.arc(px+TILE/2+4,py+TILE/2,2,0,Math.PI*2); ctx2.fill();
    // Corner moulding lines
    ctx2.strokeStyle='#0e0a06'; ctx2.lineWidth=0.8;
    ctx2.strokeRect(px+5,py+8,TILE/2-5,TILE-18);
    ctx2.strokeRect(px+TILE/2+1,py+8,TILE/2-6,TILE-18);

  } else if(t===T.FIREPLACE){
    // Stone fireplace — embedded in floor, lit with animated fire
    ctx2.fillStyle='#1a1210'; ctx2.fillRect(px+2,py+2,TILE-4,TILE-4);
    // Stone surround
    ctx2.fillStyle='#2e2820';
    ctx2.fillRect(px+2,py+2,TILE-4,6);   // top mantel
    ctx2.fillRect(px+2,py+2,5,TILE-4);   // left stone
    ctx2.fillRect(px+TILE-7,py+2,5,TILE-4); // right stone
    // Fire box
    ctx2.fillStyle='#0e0804'; ctx2.fillRect(px+7,py+8,TILE-14,TILE-14);
    // Animated embers / fire
    const ff=0.5+0.35*Math.sin(frameNow*0.005+x*0.9);
    const ff2=0.5+0.35*Math.sin(frameNow*0.007+x*1.3+1);
    // Ember bed
    ctx2.fillStyle=`rgba(180,60,8,${0.7+ff*0.3})`; ctx2.fillRect(px+8,py+TILE-12,TILE-16,5);
    // Flame layers
    const fg=ctx2.createRadialGradient(cx,py+TILE-10,1,cx,py+TILE-10,12);
    fg.addColorStop(0,`rgba(255,220,80,${0.85+ff*0.15})`);
    fg.addColorStop(0.3,`rgba(255,100,20,${0.7+ff2*0.2})`);
    fg.addColorStop(0.7,`rgba(200,40,8,${0.3+ff*0.2})`);
    fg.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=fg; ctx2.fillRect(px+7,py+6,TILE-14,TILE-10);
    // Warm glow spill
    const fglow=ctx2.createRadialGradient(cx,cy,2,cx,cy,TILE*0.9);
    fglow.addColorStop(0,`rgba(220,100,30,${ff*0.22})`);
    fglow.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=fglow; ctx2.fillRect(px-4,py-4,TILE+8,TILE+8);
    // Mantel stone texture
    ctx2.strokeStyle='rgba(0,0,0,0.3)'; ctx2.lineWidth=0.6;
    for(let i=0;i<3;i++){ ctx2.beginPath(); ctx2.moveTo(px+2+i*6,py+2); ctx2.lineTo(px+2+i*6,py+8); ctx2.stroke(); }

  } else if(t===T.PLANT){
    // Potted plant — terracotta pot + leafy top
    // Pot
    ctx2.fillStyle='#7a3a18'; ctx2.fillRect(cx-6,py+TILE-12,12,9);
    ctx2.fillStyle='#8a4a20'; ctx2.fillRect(cx-7,py+TILE-13,14,3);
    ctx2.fillStyle='#5a2a10'; ctx2.fillRect(cx-5,py+TILE-4,10,2);
    // Soil
    ctx2.fillStyle='#3a2010'; ctx2.fillRect(cx-5,py+TILE-11,10,4);
    // Leaves — layered circles
    const lf=0.5+0.12*Math.sin(frameNow*0.002+x*0.7);
    ctx2.fillStyle=`hsla(110,50%,${22+lf*6}%,0.95)`; ctx2.beginPath(); ctx2.arc(cx,py+TILE-16,7,0,Math.PI*2); ctx2.fill();
    ctx2.fillStyle=`hsla(115,55%,${26+lf*5}%,0.9)`;  ctx2.beginPath(); ctx2.arc(cx-4,py+TILE-18,5,0,Math.PI*2); ctx2.fill();
    ctx2.fillStyle=`hsla(105,48%,${24+lf*5}%,0.9)`;  ctx2.beginPath(); ctx2.arc(cx+4,py+TILE-17,5,0,Math.PI*2); ctx2.fill();
    ctx2.fillStyle=`hsla(120,52%,${30+lf*4}%,0.8)`;  ctx2.beginPath(); ctx2.arc(cx,py+TILE-20,4,0,Math.PI*2); ctx2.fill();

  } else if(t===T.DOCK_PLANK){
    const r2=y%2; ctx2.fillStyle=r2?'#2a1a0a':'#321e0c'; ctx2.fillRect(px,py,TILE,TILE);
    ctx2.strokeStyle='rgba(0,0,0,0.45)'; ctx2.lineWidth=1;
    for(let i=1;i<5;i++){ctx2.beginPath();ctx2.moveTo(px,py+i*8);ctx2.lineTo(px+TILE,py+i*8);ctx2.stroke();}
    ctx2.strokeStyle='rgba(255,200,120,0.07)'; ctx2.lineWidth=0.7;
    for(let i=0;i<3;i++){ctx2.beginPath();ctx2.moveTo(px+5+i*13,py+1);ctx2.lineTo(px+4+i*13,py+TILE-1);ctx2.stroke();}
    ctx2.fillStyle='rgba(0,0,0,0.55)';
    [[4,4],[TILE-4,4],[4,TILE-4],[TILE-4,TILE-4]].forEach(([dx,dy])=>{ctx2.beginPath();ctx2.arc(px+dx,py+dy,1.5,0,Math.PI*2);ctx2.fill();});
    ctx2.fillStyle='rgba(0,0,0,0.15)'; ctx2.fillRect(px,py+TILE-3,TILE,3);

  } else if(t===T.INN_DOOR){
    ctx2.save();
    ctx2.translate(px,py);
    
    // Doorway — dark archway with warm amber glow
    ctx2.fillStyle='#1a0e06';
    ctx2.fillRect(0+4,0+2,TILE-8,TILE-2);
    ctx2.strokeStyle='#7a4a18'; ctx2.lineWidth=2;
    ctx2.strokeRect(0+4,0+2,TILE-8,TILE-2);
    const dg=ctx2.createRadialGradient(cx,cy,2,cx,cy,TILE*.4);
    dg.addColorStop(0,'rgba(200,120,40,0.35)');
    dg.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=dg; ctx2.fillRect(0,0,TILE,TILE);
    ctx2.fillStyle='rgba(200,120,40,0.7)';
    ctx2.font='14px serif'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
    ctx2.fillText('🚪',cx,cy);
    ctx2.restore();
  } else if(t===T.EXIT_INTERIOR){
    ctx2.save();
    ctx2.translate(px,py);
    
    // Exit door back outside
    ctx2.fillStyle='#1a1a10';
    ctx2.fillRect(0+4,0+2,TILE-8,TILE-2);
    ctx2.strokeStyle='#6a8a4a'; ctx2.lineWidth=2;
    ctx2.strokeRect(0+4,0+2,TILE-8,TILE-2);
    const eg=ctx2.createRadialGradient(cx,cy,2,cx,cy,TILE*.4);
    eg.addColorStop(0,'rgba(100,160,80,0.35)');
    eg.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=eg; ctx2.fillRect(0,0,TILE,TILE);
    ctx2.fillStyle='rgba(150,220,100,0.8)';
    ctx2.font='14px serif'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
    ctx2.fillText('🚪',cx,cy);
    ctx2.restore();
  } else if(t===T.BLACKSMITH){
    // Blacksmith — heavy stone building, anvil through small window, chimney smoke
    const now2 = frameNow;
    // Stone wall — dark granite
    ctx2.fillStyle = '#1e1c22';
    ctx2.fillRect(px+2, py+12, TILE-4, TILE-14);
    // Stone brick lines
    ctx2.strokeStyle = 'rgba(0,0,0,0.35)'; ctx2.lineWidth = 0.8;
    for(let row=0; row<3; row++){
      ctx2.beginPath(); ctx2.moveTo(px+2,py+18+row*6); ctx2.lineTo(px+TILE-2,py+18+row*6); ctx2.stroke();
    }
    ctx2.strokeStyle='rgba(255,255,255,0.04)'; ctx2.lineWidth=1;
    ctx2.strokeRect(px+2,py+12,TILE-4,TILE-14);
    // Roof — dark slate, angled
    ctx2.fillStyle = '#16141a';
    ctx2.beginPath(); ctx2.moveTo(px,py+14); ctx2.lineTo(cx,py+4); ctx2.lineTo(px+TILE,py+14); ctx2.closePath(); ctx2.fill();
    ctx2.strokeStyle='#2a2830'; ctx2.lineWidth=1.5; ctx2.stroke();
    ctx2.strokeStyle='#3a3646'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(px+4,py+14); ctx2.lineTo(cx,py+5); ctx2.lineTo(px+TILE-4,py+14); ctx2.stroke();
    // Chimney — thick stone stack
    ctx2.fillStyle='#1a1820';
    ctx2.fillRect(cx+4, py-2, 8, 14);
    ctx2.strokeStyle='#2a2830'; ctx2.lineWidth=1; ctx2.strokeRect(cx+4,py-2,8,14);
    ctx2.fillStyle='#12101a'; ctx2.fillRect(cx+3,py-3,10,3);
    // Forge glow from chimney
    const fglow = 0.4 + 0.2*Math.sin(now2*0.004);
    ctx2.strokeStyle=`rgba(255,${80+Math.floor(fglow*40)},10,${fglow*0.7})`; ctx2.lineWidth=2;
    ctx2.beginPath(); ctx2.moveTo(cx+8,py-3); ctx2.quadraticCurveTo(cx+5,py-9,cx+10,py-14); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(cx+8,py-3); ctx2.quadraticCurveTo(cx+12,py-9,cx+7,py-15); ctx2.stroke();
    // Door — heavy iron-banded
    ctx2.fillStyle='#0e0c10';
    ctx2.fillRect(cx-5, py+TILE-16, 10, 14);
    ctx2.strokeStyle='#3a3848'; ctx2.lineWidth=1.5; ctx2.strokeRect(cx-5,py+TILE-16,10,14);
    ctx2.strokeStyle='#5a4840'; ctx2.lineWidth=1.2;
    ctx2.beginPath(); ctx2.moveTo(cx-5,py+TILE-12); ctx2.lineTo(cx+5,py+TILE-12); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(cx-5,py+TILE-8); ctx2.lineTo(cx+5,py+TILE-8); ctx2.stroke();
    // Small window with forge glow
    ctx2.fillStyle=`rgba(255,80,10,0.18)`;
    ctx2.fillRect(px+5, py+18, 9, 7);
    ctx2.strokeStyle='#3a3040'; ctx2.lineWidth=1; ctx2.strokeRect(px+5,py+18,9,7);
    ctx2.strokeStyle='#2a2030'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(px+9,py+18); ctx2.lineTo(px+9,py+25); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(px+5,py+21); ctx2.lineTo(px+14,py+21); ctx2.stroke();
    // Hanging anvil sign
    ctx2.fillStyle='#3a3040';
    ctx2.fillRect(px+TILE-14,py+14,10,8);
    ctx2.strokeStyle='#5a5060'; ctx2.lineWidth=1; ctx2.strokeRect(px+TILE-14,py+14,10,8);
    ctx2.fillStyle='#8a8898'; ctx2.font='7px serif'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
    ctx2.fillText('⚒',px+TILE-9,py+18);
  } else if(t===T.TOWN_WELL){
    // Well
    ctx2.fillStyle='#1a2830';
    ctx2.beginPath(); ctx2.arc(cx,cy,TILE*.28,0,Math.PI*2); ctx2.fill();
    ctx2.strokeStyle='#5a7a6a'; ctx2.lineWidth=2;
    ctx2.stroke();
    ctx2.fillStyle='#0e2030';
    ctx2.beginPath(); ctx2.arc(cx,cy,TILE*.18,0,Math.PI*2); ctx2.fill();
    // Rope line
    ctx2.strokeStyle='#7a6a40'; ctx2.lineWidth=1.5;
    ctx2.beginPath(); ctx2.moveTo(cx,cy-TILE*.18); ctx2.lineTo(cx,cy-TILE*.36); ctx2.stroke();
  } else if(t===T.LAMPPOST){
    // Post
    ctx2.strokeStyle='#4a3a10'; ctx2.lineWidth=3;
    ctx2.beginPath(); ctx2.moveTo(cx,py+TILE-4); ctx2.lineTo(cx,py+8); ctx2.stroke();
    // Arm
    ctx2.beginPath(); ctx2.moveTo(cx,py+12); ctx2.lineTo(cx+10,py+8); ctx2.stroke();
    // Glow — bigger and brighter at night
    const nightBoost = 1 + getNightAlpha() * 2.5;
    const glowR = 14 * nightBoost;
    const glow=ctx2.createRadialGradient(cx+10,py+8,1,cx+10,py+8,glowR);
    const flicker=0.55+0.15*Math.sin(frameNow*0.004+x+y);
    glow.addColorStop(0,`rgba(255,200,80,${flicker * Math.min(1, nightBoost * 0.5)})`);
    glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=glow; ctx2.fillRect(cx-glowR,py-glowR+8,glowR*2+10,glowR*2+10);
    // Lantern
    ctx2.fillStyle='#c8922a';
    ctx2.fillRect(cx+7,py+5,7,6);
  } else if(t===T.SMELTER){
    // Stone forge / smelter — brick base, furnace mouth, chimney, molten glow
    const now2 = frameNow;
    // Glow pulse
    const glow = 0.55 + 0.25 * Math.sin(now2 * 0.004);
    // Ambient heat glow behind furnace
    const heatGrad = ctx2.createRadialGradient(cx, cy+4, 2, cx, cy+4, 20);
    heatGrad.addColorStop(0, `rgba(255,120,20,${glow*0.55})`);
    heatGrad.addColorStop(1, 'rgba(255,60,0,0)');
    ctx2.fillStyle = heatGrad;
    ctx2.fillRect(px+4, py+8, TILE-8, TILE-8);
    // Stone base — wide trapezoid shape
    ctx2.fillStyle = '#3a3028';
    ctx2.beginPath();
    ctx2.moveTo(px+3,  py+TILE-4);
    ctx2.lineTo(px+TILE-3, py+TILE-4);
    ctx2.lineTo(px+TILE-7, py+14);
    ctx2.lineTo(px+7,  py+14);
    ctx2.closePath(); ctx2.fill();
    // Stone brick lines
    ctx2.strokeStyle='rgba(0,0,0,0.25)'; ctx2.lineWidth=0.8;
    ctx2.beginPath();
    ctx2.moveTo(px+5, py+22); ctx2.lineTo(px+TILE-5, py+22);
    ctx2.moveTo(px+5, py+29); ctx2.lineTo(px+TILE-5, py+29);
    ctx2.moveTo(cx, py+14); ctx2.lineTo(cx, py+TILE-4);
    ctx2.stroke();
    // Highlight edge bricks
    ctx2.strokeStyle='rgba(255,255,255,0.06)'; ctx2.lineWidth=1;
    ctx2.strokeRect(px+3, py+14, TILE-6, TILE-18);
    // Furnace mouth — dark arch
    ctx2.fillStyle = '#0e0a06';
    ctx2.beginPath();
    ctx2.arc(cx, py+26, 9, Math.PI, 0);
    ctx2.lineTo(cx+9, py+34); ctx2.lineTo(cx-9, py+34);
    ctx2.closePath(); ctx2.fill();
    // Inner fire glow in the mouth
    ctx2.fillStyle = `rgba(255,${80+Math.floor(glow*60)},10,${glow*0.9})`;
    ctx2.beginPath();
    ctx2.arc(cx, py+26, 6, Math.PI, 0);
    ctx2.lineTo(cx+6, py+32); ctx2.lineTo(cx-6, py+32);
    ctx2.closePath(); ctx2.fill();
    // Bright core
    ctx2.fillStyle = `rgba(255,230,160,${glow*0.7})`;
    ctx2.beginPath(); ctx2.arc(cx, py+27, 3, 0, Math.PI*2); ctx2.fill();
    // Chimney — left and right stacks
    ctx2.fillStyle = '#2e2620';
    ctx2.fillRect(px+5,  py+4, 7, 12);
    ctx2.fillRect(px+TILE-12, py+4, 7, 12);
    // Chimney cap highlights
    ctx2.fillStyle = '#4a3e32';
    ctx2.fillRect(px+4,  py+4, 9, 2);
    ctx2.fillRect(px+TILE-13, py+4, 9, 2);
    // Smoke wisps from chimneys
    const sm = (now2*0.001) % (Math.PI*2);
    ctx2.strokeStyle = `rgba(180,160,140,${0.25+0.1*Math.sin(sm)})`;
    ctx2.lineWidth = 1.5;
    ctx2.beginPath();
    ctx2.moveTo(px+8, py+4);
    ctx2.quadraticCurveTo(px+5,  py-2, px+9, py-7);
    ctx2.moveTo(px+TILE-9, py+4);
    ctx2.quadraticCurveTo(px+TILE-5, py-2, px+TILE-10, py-7);
    ctx2.stroke();
  } else if(t===T.COOKING_FIRE){
    // Stone hearth with hanging pot and active fire
    const now2 = frameNow;
    const flicker = 0.6 + 0.3 * Math.sin(now2 * 0.007);
    const flicker2= 0.5 + 0.35* Math.sin(now2 * 0.011 + 1.2);
    // Stone surround — U-shape
    ctx2.fillStyle = '#2e2a24';
    ctx2.fillRect(px+3, py+20, TILE-6, TILE-22); // back wall
    ctx2.fillRect(px+3, py+20, 6, TILE-22);       // left wall
    ctx2.fillRect(px+TILE-9, py+20, 6, TILE-22);  // right wall
    // Stone texture lines
    ctx2.strokeStyle='rgba(0,0,0,0.2)'; ctx2.lineWidth=0.7;
    ctx2.beginPath();
    ctx2.moveTo(px+3, py+26); ctx2.lineTo(px+TILE-3, py+26);
    ctx2.moveTo(px+3, py+32); ctx2.lineTo(px+TILE-3, py+32);
    ctx2.stroke();
    ctx2.strokeStyle='rgba(255,255,255,0.04)'; ctx2.lineWidth=1;
    ctx2.strokeRect(px+3, py+20, TILE-6, TILE-22);
    // Ash floor
    ctx2.fillStyle = '#1a1614';
    ctx2.fillRect(px+9, py+33, TILE-18, TILE-36);
    // Fire glow on ground
    const fireGrad = ctx2.createRadialGradient(cx, py+34, 0, cx, py+34, 12);
    fireGrad.addColorStop(0, `rgba(255,140,20,${flicker*0.6})`);
    fireGrad.addColorStop(1, 'rgba(200,60,0,0)');
    ctx2.fillStyle = fireGrad; ctx2.fillRect(px+6, py+22, TILE-12, TILE-24);
    // Logs
    ctx2.fillStyle = '#4a2a10';
    ctx2.fillRect(px+8,  py+35, 14, 4);
    ctx2.fillRect(px+18, py+35, 14, 4);
    // Log highlight
    ctx2.fillStyle='rgba(120,60,20,0.5)';
    ctx2.fillRect(px+8, py+35, 14, 1);
    ctx2.fillRect(px+18,py+35, 14, 1);
    // Flames — layered
    [[cx-4, py+32, 4, 8, flicker,  255, 80,  10],
     [cx+3,  py+33, 3, 6, flicker2, 255, 120, 20],
     [cx,    py+30, 3, 9, flicker,  255, 200, 60]].forEach(([fx,fy,fw,fh,fl,r,g,b])=>{
      ctx2.fillStyle = `rgba(${r},${g},${b},${fl*0.85})`;
      ctx2.beginPath();
      ctx2.moveTo(fx-fw, fy+fh);
      ctx2.quadraticCurveTo(fx-fw, fy+fh*0.4, fx, fy);
      ctx2.quadraticCurveTo(fx+fw, fy+fh*0.4, fx+fw, fy+fh);
      ctx2.closePath(); ctx2.fill();
    });
    // Hanging chain from top
    ctx2.strokeStyle = '#5a5048'; ctx2.lineWidth = 1.2;
    ctx2.beginPath(); ctx2.moveTo(cx, py+4); ctx2.lineTo(cx, py+20); ctx2.stroke();
    // Support rod
    ctx2.fillStyle = '#4a4038';
    ctx2.fillRect(px+8, py+4, TILE-16, 3);
    // Hanging pot
    ctx2.fillStyle = '#3a3632';
    ctx2.beginPath(); ctx2.ellipse(cx, py+23, 9, 7, 0, 0, Math.PI*2); ctx2.fill();
    // Pot rim
    ctx2.fillStyle = '#4a4440';
    ctx2.beginPath(); ctx2.ellipse(cx, py+18, 9, 3, 0, 0, Math.PI*2); ctx2.fill();
    // Bubbling surface
    const bub2 = Math.sin(now2*0.005)*1.5;
    ctx2.fillStyle = `rgba(180,140,60,0.7)`;
    ctx2.beginPath(); ctx2.ellipse(cx, py+18+bub2, 6, 2, 0, 0, Math.PI*2); ctx2.fill();
    // Steam wisps
    ctx2.strokeStyle = `rgba(200,200,200,${0.15+0.08*Math.sin(now2*0.003)})`;
    ctx2.lineWidth = 1.2;
    ctx2.beginPath();
    ctx2.moveTo(cx-3, py+16);
    ctx2.quadraticCurveTo(cx-6, py+10, cx-2, py+6);
    ctx2.moveTo(cx+3, py+15);
    ctx2.quadraticCurveTo(cx+6, py+9,  cx+4, py+5);
    ctx2.stroke();
  } else if(t===T.SHOP){
    drawBuilding(px,py,'#0a1a2a','#2a6a9a','🏪');
  } else if(t===T.WORKBENCH){
    // Bench surface
    ctx2.fillStyle='#5a3810'; ctx2.fillRect(px+4,py+16,TILE-8,14);
    ctx2.strokeStyle='#8a5820'; ctx2.lineWidth=1.5; ctx2.strokeRect(px+4,py+16,TILE-8,14);
    // Legs
    ctx2.fillStyle='#3a2408';
    ctx2.fillRect(px+5,py+28,5,8); ctx2.fillRect(px+TILE-10,py+28,5,8);
    // Tool rack — back board
    ctx2.fillStyle='#3a2408'; ctx2.fillRect(px+4,py+10,TILE-8,7);
    ctx2.strokeStyle='#6a4010'; ctx2.lineWidth=1; ctx2.strokeRect(px+4,py+10,TILE-8,7);
    // Hanging tools (axe + saw silhouettes)
    ctx2.strokeStyle='#a07030'; ctx2.lineWidth=2;
    ctx2.beginPath(); ctx2.moveTo(px+11,py+11); ctx2.lineTo(px+11,py+16); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(px+18,py+11); ctx2.lineTo(px+22,py+11); ctx2.lineTo(px+22,py+14); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(px+28,py+11); ctx2.lineTo(px+28,py+16); ctx2.stroke();
    // Label
    ctx2.fillStyle='#c8922a'; ctx2.font='bold 7px Cinzel,serif';
    ctx2.textAlign='center'; ctx2.textBaseline='middle';
    ctx2.fillText('BENCH',cx,py+22);
  } else if(t===T.EXIT){
    drawExitPortal(px,py);
  } else if(t===T.EXIT_RETURN){
    drawReturnPortal(px,py);
  } else if(t===T.GRAVE){
    ctx2.save();
    ctx2.translate(px,py);
    
    // Gravestone — dark stone slab with cross
    ctx2.fillStyle='#2a2830'; ctx2.fillRect(0+10,0+14,TILE-20,TILE-18);
    ctx2.strokeStyle='#4a4858'; ctx2.lineWidth=1.5; ctx2.strokeRect(0+10,0+14,TILE-20,TILE-18);
    // Rounded top
    ctx2.beginPath(); ctx2.arc(cx,0+14,10,Math.PI,0); ctx2.fillStyle='#2a2830'; ctx2.fill();
    ctx2.strokeStyle='#4a4858'; ctx2.stroke();
    // Cross
    ctx2.strokeStyle='#6a6878'; ctx2.lineWidth=1.5;
    ctx2.beginPath(); ctx2.moveTo(cx,0+17); ctx2.lineTo(cx,0+28); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(cx-5,0+21); ctx2.lineTo(cx+5,0+21); ctx2.stroke();
    // Base mound
    ctx2.fillStyle='#1e2818'; ctx2.beginPath();
    ctx2.ellipse(cx,0+TILE-5,12,5,0,0,Math.PI*2); ctx2.fill();
    ctx2.restore();
  } else if(t===T.FENCE){
    ctx2.save();
    ctx2.translate(px,py);
    
    // Wooden fence post + rail
    ctx2.strokeStyle='#6a4a1a'; ctx2.lineWidth=2.5;
    // Two vertical posts
    ctx2.beginPath(); ctx2.moveTo(0+6,0+12); ctx2.lineTo(0+6,0+TILE-4); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(0+TILE-6,0+12); ctx2.lineTo(0+TILE-6,0+TILE-4); ctx2.stroke();
    // Two horizontal rails
    ctx2.lineWidth=1.8;
    ctx2.beginPath(); ctx2.moveTo(0+6,0+17); ctx2.lineTo(0+TILE-6,0+17); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(0+6,0+26); ctx2.lineTo(0+TILE-6,0+26); ctx2.stroke();
    // Post caps
    ctx2.fillStyle='#8a6428';
    ctx2.fillRect(0+4,0+10,5,4); ctx2.fillRect(0+TILE-9,0+10,5,4);
    ctx2.restore();
  } else if(t===T.HOUSE_A){
    ctx2.save();
    ctx2.translate(px,py);
    
    // Per-variant palette
    const isA = t===T.HOUSE_A, isB = t===T.HOUSE_B;
    const roofCol   = isA ? '#4a2010' : isB ? '#1c2a3a' : '#2a1c30';
    const roofHi    = isA ? '#6a3018' : isB ? '#2c4060' : '#3e2a48';
    const wallCol   = isA ? '#2e2418' : isB ? '#222c38' : '#222030';
    const wallHi    = isA ? '#3a2e20' : isB ? '#2c3848' : '#2c2840';
    const beamCol   = isA ? '#16100c' : isB ? '#141820' : '#181020';
    const doorCol   = isA ? '#18100a' : isB ? '#101420' : '#140e18';
    const doorAcc   = isA ? '#4a3018' : isB ? '#304060' : '#403058';
    const winGlow   = isA ? 'rgba(200,150,50,0.22)' : isB ? 'rgba(140,180,220,0.18)' : 'rgba(160,120,200,0.18)';
    const accentCol = isA ? '#6a4830' : isB ? '#486090' : '#6a4878';
    const hasChimney= isA || !isB;
    ctx2.fillStyle=wallCol;
    ctx2.fillRect(0+3,0+14,TILE-6,TILE-16);
    ctx2.strokeStyle=beamCol; ctx2.lineWidth=0.7;
    for(let row=0;row<4;row++){
      ctx2.beginPath(); ctx2.moveTo(0+3,0+20+row*5); ctx2.lineTo(0+TILE-3,0+20+row*5); ctx2.stroke();
    }
    ctx2.strokeStyle='rgba(255,255,255,0.04)'; ctx2.lineWidth=1;
    ctx2.strokeRect(0+3,0+14,TILE-6,TILE-16);
    ctx2.fillStyle=beamCol;
    ctx2.fillRect(0+3,0+14,3,TILE-16);
    ctx2.fillRect(0+TILE-6,0+14,3,TILE-16);
    ctx2.fillStyle=roofCol;
    ctx2.beginPath(); ctx2.moveTo(0,0+16); ctx2.lineTo(cx,0+4); ctx2.lineTo(0+TILE,0+16); ctx2.closePath(); ctx2.fill();
    ctx2.strokeStyle=roofHi; ctx2.lineWidth=1.2;
    ctx2.beginPath(); ctx2.moveTo(0+4,0+16); ctx2.lineTo(cx,0+5); ctx2.lineTo(0+TILE-4,0+16); ctx2.stroke();
    ctx2.strokeStyle=beamCol; ctx2.lineWidth=2;
    ctx2.beginPath(); ctx2.moveTo(0,0+16); ctx2.lineTo(0+TILE,0+16); ctx2.stroke();
    ctx2.strokeStyle=beamCol; ctx2.lineWidth=0.6;
    for(let row=0;row<2;row++){
      const y2=0+10+row*4, span=(row+1)*7;
      ctx2.beginPath(); ctx2.moveTo(cx-span,y2); ctx2.lineTo(cx+span,y2); ctx2.stroke();
    }
    if(hasChimney){
      const chx = isA ? 0+TILE-12 : 0+6;
      ctx2.fillStyle=beamCol;
      ctx2.fillRect(chx,0-1,7,13);
      ctx2.strokeStyle=wallHi; ctx2.lineWidth=1; ctx2.strokeRect(chx,0-1,7,13);
      ctx2.fillStyle=beamCol; ctx2.fillRect(chx-1,0-2,9,3);
    }
    ctx2.fillStyle=winGlow;
    ctx2.fillRect(0+5,0+18,9,7);
    ctx2.strokeStyle=accentCol; ctx2.lineWidth=1;
    ctx2.strokeRect(0+5,0+18,9,7);
    ctx2.strokeStyle=beamCol; ctx2.lineWidth=0.9;
    ctx2.beginPath();
    ctx2.moveTo(0+9,0+18); ctx2.lineTo(0+9,0+25);
    ctx2.moveTo(0+5,0+21); ctx2.lineTo(0+14,0+21);
    ctx2.stroke();
    ctx2.fillStyle=wallHi;
    ctx2.fillRect(0+3,0+18,2,7);
    if(isB){
      ctx2.fillStyle=winGlow;
      ctx2.fillRect(0+TILE-14,0+18,9,7);
      ctx2.strokeStyle=accentCol; ctx2.lineWidth=1;
      ctx2.strokeRect(0+TILE-14,0+18,9,7);
      ctx2.strokeStyle=beamCol; ctx2.lineWidth=0.9;
      ctx2.beginPath();
      ctx2.moveTo(0+TILE-10,0+18); ctx2.lineTo(0+TILE-10,0+25);
      ctx2.moveTo(0+TILE-14,0+21); ctx2.lineTo(0+TILE-5,0+21);
      ctx2.stroke();
    }
    ctx2.fillStyle=doorCol;
    ctx2.fillRect(cx-5,0+TILE-16,10,14);
    ctx2.strokeStyle=doorAcc; ctx2.lineWidth=1.2;
    ctx2.strokeRect(cx-5,0+TILE-16,10,14);
    if(isB){
      ctx2.fillStyle=doorCol;
      ctx2.beginPath(); ctx2.arc(cx,0+TILE-16,5,Math.PI,0); ctx2.fill();
    }
    ctx2.strokeStyle=doorAcc; ctx2.lineWidth=0.8;
    ctx2.beginPath();
    ctx2.moveTo(cx-5,0+TILE-10); ctx2.lineTo(cx+5,0+TILE-10);
    ctx2.moveTo(cx,0+TILE-16); ctx2.lineTo(cx,0+TILE-2);
    ctx2.stroke();
    ctx2.fillStyle=accentCol;
    ctx2.beginPath(); ctx2.arc(cx+(isA?-2:2),0+TILE-8,1.5,0,Math.PI*2); ctx2.fill();
    ctx2.restore();
  } else if(t===T.ROOF_L||t===T.ROOF_M||t===T.ROOF_R||t===T.ROOF_CHIMNEY){
    // Roof tile — top face (back, ridge) + angled face (front slope visible from above)
    const isLeft=t===T.ROOF_L, isMid=t===T.ROOF_M, isRight=t===T.ROOF_R, isChim=t===T.ROOF_CHIMNEY;
    // Top face (flat, dark — the back of the roof seen from above)
    ctx2.fillStyle='#1c0e06'; ctx2.fillRect(px,py,TILE,18);
    // Shingle rows on top face
    ctx2.strokeStyle='#100804'; ctx2.lineWidth=0.8;
    ctx2.beginPath(); ctx2.moveTo(px+1,py+7);  ctx2.lineTo(px+TILE-1,py+7);  ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(px+1,py+13); ctx2.lineTo(px+TILE-1,py+13); ctx2.stroke();
    // Front slope — lighter, angled face
    const sg=ctx2.createLinearGradient(px,py+16,px,py+TILE);
    sg.addColorStop(0,'#3c1e0e'); sg.addColorStop(1,'#281408');
    ctx2.fillStyle=sg; ctx2.fillRect(px,py+16,TILE,TILE-16);
    // Shingle rows on slope (denser, with tab cuts for texture)
    ctx2.strokeStyle='#180c04'; ctx2.lineWidth=1;
    for(let row=0;row<4;row++){
      const ry=py+20+row*6;
      if(ry<py+TILE-2){
        ctx2.beginPath(); ctx2.moveTo(px+1,ry); ctx2.lineTo(px+TILE-1,ry); ctx2.stroke();
        const tabOff=row%2===0?0:10;
        for(let ti=0;ti<4;ti++){
          const tx2=px+tabOff+ti*10;
          if(tx2>px+1&&tx2<px+TILE-1){
            ctx2.beginPath(); ctx2.moveTo(tx2,ry); ctx2.lineTo(tx2,ry-3); ctx2.stroke();
          }
        }
      }
    }
    // Eave drip edge at bottom
    ctx2.fillStyle='#0c0602'; ctx2.fillRect(px,py+TILE-3,TILE,3);
    ctx2.strokeStyle='#3a1e0a'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(px,py+TILE-3); ctx2.lineTo(px+TILE,py+TILE-3); ctx2.stroke();
    // Ridge line at very top
    ctx2.fillStyle='#4a2410'; ctx2.fillRect(px,py,TILE,2);
    // Left gable end — dark face
    if(isLeft){
      ctx2.fillStyle='#140a04'; ctx2.fillRect(px,py,4,TILE);
      ctx2.strokeStyle='#0e0802'; ctx2.lineWidth=1;
      ctx2.beginPath(); ctx2.moveTo(px+4,py); ctx2.lineTo(px+4,py+TILE); ctx2.stroke();
    }
    // Right gable end
    if(isRight){
      ctx2.fillStyle='#140a04'; ctx2.fillRect(px+TILE-4,py,4,TILE);
      ctx2.strokeStyle='#0e0802'; ctx2.lineWidth=1;
      ctx2.beginPath(); ctx2.moveTo(px+TILE-4,py); ctx2.lineTo(px+TILE-4,py+TILE); ctx2.stroke();
    }
    // Ridge highlight on mid tiles
    if(isMid||isChim){
      ctx2.fillStyle='#5a2e12'; ctx2.fillRect(px,py,TILE,2);
      ctx2.strokeStyle='#6a3818'; ctx2.lineWidth=0.8;
      ctx2.beginPath(); ctx2.moveTo(px,py+1); ctx2.lineTo(px+TILE,py+1); ctx2.stroke();
    }
    // Chimney stack
    if(isChim){
      const chX=cx-5, chW=10, chH=16;
      ctx2.fillStyle='#181420'; ctx2.fillRect(chX,py-chH+6,chW,chH);
      ctx2.strokeStyle='#242030'; ctx2.lineWidth=1; ctx2.strokeRect(chX,py-chH+6,chW,chH);
      ctx2.fillStyle='#0e0c14'; ctx2.fillRect(chX-2,py-chH+4,chW+4,4);
      // Mortar courses on chimney
      ctx2.strokeStyle='rgba(255,255,255,0.07)'; ctx2.lineWidth=0.7;
      for(let i=0;i<3;i++){ ctx2.beginPath(); ctx2.moveTo(chX+1,py-chH+9+i*4); ctx2.lineTo(chX+chW-1,py-chH+9+i*4); ctx2.stroke(); }
      // Smoke
      const sm=0.28+0.14*Math.sin(frameNow*0.0025+x*1.3);
      ctx2.strokeStyle=`rgba(150,130,100,${sm})`; ctx2.lineWidth=1.5;
      ctx2.beginPath(); ctx2.moveTo(cx,py-chH+4); ctx2.quadraticCurveTo(cx-4,py-chH-4,cx+2,py-chH-10); ctx2.stroke();
      ctx2.strokeStyle=`rgba(150,130,100,${sm*0.6})`;
      ctx2.beginPath(); ctx2.moveTo(cx+2,py-chH+4); ctx2.quadraticCurveTo(cx+5,py-chH-5,cx-1,py-chH-12); ctx2.stroke();
    }

  } else if(t===T.BWALL_SIDE){
    // Side/back wall — plain dressed stone, no front detail
    // Stone block courses
    ctx2.strokeStyle='rgba(0,0,0,0.35)'; ctx2.lineWidth=0.8;
    for(let row=0;row<5;row++){
      const ry=py+4+row*7;
      ctx2.beginPath(); ctx2.moveTo(px+1,ry); ctx2.lineTo(px+TILE-1,ry); ctx2.stroke();
    }
    for(let row=0;row<5;row++){
      const off=row%2===0?0:20; const ry=py+4+row*7;
      ctx2.beginPath(); ctx2.moveTo(px+off+20,ry+1); ctx2.lineTo(px+off+20,ry+6); ctx2.stroke();
    }
    // Top light — eave shadow cast down
    ctx2.fillStyle='rgba(0,0,0,0.28)'; ctx2.fillRect(px,py,TILE,6);
    ctx2.fillStyle='rgba(255,255,255,0.04)'; ctx2.fillRect(px,py+6,TILE,3);

  } else if(t===T.BWALL_PLAIN){
    // Front wall — stone face, no window or door
    ctx2.strokeStyle='rgba(0,0,0,0.4)'; ctx2.lineWidth=0.8;
    for(let row=0;row<5;row++){
      const ry=py+4+row*7;
      ctx2.beginPath(); ctx2.moveTo(px+1,ry); ctx2.lineTo(px+TILE-1,ry); ctx2.stroke();
    }
    for(let row=0;row<5;row++){
      const off=row%2===0?0:20; const ry=py+4+row*7;
      ctx2.beginPath(); ctx2.moveTo(px+off+20,ry+1); ctx2.lineTo(px+off+20,ry+6); ctx2.stroke();
    }
    // Eave shadow at top, corner shadows at sides
    ctx2.fillStyle='rgba(0,0,0,0.35)'; ctx2.fillRect(px,py,TILE,6);
    ctx2.fillStyle='rgba(0,0,0,0.18)'; ctx2.fillRect(px,py,3,TILE); ctx2.fillRect(px+TILE-3,py,3,TILE);
    // Slight top highlight on stone
    ctx2.fillStyle='rgba(255,255,255,0.03)'; ctx2.fillRect(px,py+6,TILE,3);

  } else if(t===T.BWALL_WIN){
    // Front wall — stone with warm window
    ctx2.strokeStyle='rgba(0,0,0,0.4)'; ctx2.lineWidth=0.8;
    for(let row=0;row<5;row++){
      const ry=py+4+row*7;
      ctx2.beginPath(); ctx2.moveTo(px+1,ry); ctx2.lineTo(px+TILE-1,ry); ctx2.stroke();
    }
    for(let row=0;row<5;row++){
      const off=row%2===0?0:20; const ry=py+4+row*7;
      ctx2.beginPath(); ctx2.moveTo(px+off+20,ry+1); ctx2.lineTo(px+off+20,ry+6); ctx2.stroke();
    }
    ctx2.fillStyle='rgba(0,0,0,0.35)'; ctx2.fillRect(px,py,TILE,6);
    ctx2.fillStyle='rgba(0,0,0,0.18)'; ctx2.fillRect(px,py,3,TILE); ctx2.fillRect(px+TILE-3,py,3,TILE);
    // Window — cross-framed, warm amber glow
    const wf=0.5+0.16*Math.sin(frameNow*0.0028+x*0.8+y*1.1);
    const wX=cx-8, wY=py+9, wW=16, wH=12;
    ctx2.fillStyle=`rgba(218,138,38,${0.2+wf*0.1})`; ctx2.fillRect(wX,wY,wW,wH);
    // Stone arch lintel above window
    ctx2.fillStyle='#2c2830'; ctx2.fillRect(wX-2,wY-3,wW+4,3);
    // Stone sill below window
    ctx2.fillStyle='#2c2830'; ctx2.fillRect(wX-2,wY+wH,wW+4,3);
    // Frame
    ctx2.strokeStyle='#3a2c1a'; ctx2.lineWidth=1.5; ctx2.strokeRect(wX,wY,wW,wH);
    // Cross bars
    ctx2.strokeStyle='#1c1208'; ctx2.lineWidth=1.2;
    ctx2.beginPath(); ctx2.moveTo(cx,wY); ctx2.lineTo(cx,wY+wH); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(wX,wY+wH/2); ctx2.lineTo(wX+wW,wY+wH/2); ctx2.stroke();
    // Glow spill on wall
    const wgl=ctx2.createRadialGradient(cx,wY+wH/2,1,cx,wY+wH/2,wW);
    wgl.addColorStop(0,`rgba(218,138,38,${wf*0.08})`); wgl.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=wgl; ctx2.fillRect(cx-wW,wY-wH/2,wW*2,wH*2);

  } else if(t===T.BWALL_FORGE){
    // Front wall — blacksmith, forge-lit window (hot orange)
    ctx2.strokeStyle='rgba(0,0,0,0.4)'; ctx2.lineWidth=0.8;
    for(let row=0;row<5;row++){
      const ry=py+4+row*7;
      ctx2.beginPath(); ctx2.moveTo(px+1,ry); ctx2.lineTo(px+TILE-1,ry); ctx2.stroke();
    }
    for(let row=0;row<5;row++){
      const off=row%2===0?0:20; const ry=py+4+row*7;
      ctx2.beginPath(); ctx2.moveTo(px+off+20,ry+1); ctx2.lineTo(px+off+20,ry+6); ctx2.stroke();
    }
    ctx2.fillStyle='rgba(0,0,0,0.35)'; ctx2.fillRect(px,py,TILE,6);
    ctx2.fillStyle='rgba(0,0,0,0.18)'; ctx2.fillRect(px,py,3,TILE); ctx2.fillRect(px+TILE-3,py,3,TILE);
    // Forge window — small, angry orange
    const ff=0.5+0.28*Math.sin(frameNow*0.005+x*1.4);
    const fX=cx-7, fY=py+10, fW=14, fH=11;
    ctx2.fillStyle=`rgba(255,${65+Math.floor(ff*55)},6,${0.3+ff*0.14})`; ctx2.fillRect(fX,fY,fW,fH);
    ctx2.fillStyle='#2e2030'; ctx2.fillRect(fX-2,fY-3,fW+4,3); // lintel
    ctx2.fillStyle='#2e2030'; ctx2.fillRect(fX-2,fY+fH,fW+4,3); // sill
    ctx2.strokeStyle='#2a2030'; ctx2.lineWidth=1.5; ctx2.strokeRect(fX,fY,fW,fH);
    ctx2.strokeStyle='#1a1820'; ctx2.lineWidth=1.2;
    ctx2.beginPath(); ctx2.moveTo(cx,fY); ctx2.lineTo(cx,fY+fH); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(fX,fY+fH/2); ctx2.lineTo(fX+fW,fY+fH/2); ctx2.stroke();
    // Hot glow spill
    const fgl=ctx2.createRadialGradient(cx,fY+fH/2,1,cx,fY+fH/2,fW*1.8);
    fgl.addColorStop(0,`rgba(255,80,8,${ff*0.18})`); fgl.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=fgl; ctx2.fillRect(cx-fW,fY-fH,fW*2,fH*3);

  } else if(t===T.BWALL_DOOR){
    // Front wall — arched wooden door centred
    ctx2.strokeStyle='rgba(0,0,0,0.4)'; ctx2.lineWidth=0.8;
    for(let row=0;row<5;row++){
      const ry=py+4+row*7;
      ctx2.beginPath(); ctx2.moveTo(px+1,ry); ctx2.lineTo(px+TILE-1,ry); ctx2.stroke();
    }
    for(let row=0;row<5;row++){
      const off=row%2===0?0:20; const ry=py+4+row*7;
      ctx2.beginPath(); ctx2.moveTo(px+off+20,ry+1); ctx2.lineTo(px+off+20,ry+6); ctx2.stroke();
    }
    ctx2.fillStyle='rgba(0,0,0,0.35)'; ctx2.fillRect(px,py,TILE,6);
    // Door — fills lower 60% of tile, arched top
    const dW=16, dH=24, dX=cx-8, dY=py+TILE-dH;
    // Stone arch header
    ctx2.fillStyle='#28242e'; ctx2.fillRect(dX-3,dY-3,dW+6,5);
    // Door body
    ctx2.fillStyle='#120e08';
    ctx2.fillRect(dX,dY+8,dW,dH-8);
    ctx2.beginPath(); ctx2.arc(cx,dY+8,8,Math.PI,0); ctx2.fill();
    // Door frame
    ctx2.strokeStyle='#3c3040'; ctx2.lineWidth=1.8;
    ctx2.strokeRect(dX,dY+8,dW,dH-8);
    ctx2.beginPath(); ctx2.arc(cx,dY+8,8,Math.PI,0); ctx2.stroke();
    // Door planks (vertical grain lines)
    ctx2.strokeStyle='#1e1810'; ctx2.lineWidth=0.9;
    ctx2.beginPath(); ctx2.moveTo(cx,dY+8); ctx2.lineTo(cx,dY+dH); ctx2.stroke();
    // Horizontal panel divider
    ctx2.beginPath(); ctx2.moveTo(dX+2,dY+dH*0.55); ctx2.lineTo(dX+dW-2,dY+dH*0.55); ctx2.stroke();
    // Iron door handle
    ctx2.fillStyle='#706878';
    ctx2.beginPath(); ctx2.arc(dX+dW-4,dY+dH*0.65,2.5,0,Math.PI*2); ctx2.fill();
    // Warm light spill at step
    const df=0.5+0.18*Math.sin(frameNow*0.003+x*0.6);
    const dgl=ctx2.createRadialGradient(cx,py+TILE,1,cx,py+TILE,dW);
    dgl.addColorStop(0,`rgba(200,128,28,${df*0.22})`); dgl.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=dgl; ctx2.fillRect(cx-dW,py+TILE-6,dW*2,8);

  } else if(t===T.BWALL_AWNING){
    ctx2.save();
    ctx2.translate(px,py);
    
    // Front wall — shop with fabric awning and display window
    // Timber plaster wall (warmer tone than stone)
    ctx2.fillStyle='#1c1a10'; ctx2.fillRect(0,0,TILE,TILE);
    // Plaster texture — faint horizontal lines
    ctx2.strokeStyle='rgba(0,0,0,0.2)'; ctx2.lineWidth=0.7;
    for(let row=0;row<6;row++){ ctx2.beginPath(); ctx2.moveTo(0+2,0+5+row*6); ctx2.lineTo(0+TILE-2,0+5+row*6); ctx2.stroke(); }
    // Vertical timber posts at sides
    ctx2.fillStyle='#100e08'; ctx2.fillRect(0,0,3,TILE); ctx2.fillRect(0+TILE-3,0,3,TILE);
    ctx2.fillStyle='rgba(0,0,0,0.35)'; ctx2.fillRect(0,0,TILE,5);
    // Display window — large, below awning
    const wX=0+5, wY=0+22, wW=TILE-10, wH=11;
    ctx2.fillStyle='rgba(160,120,40,0.1)'; ctx2.fillRect(wX,wY,wW,wH);
    ctx2.strokeStyle='#3a2c18'; ctx2.lineWidth=1.2; ctx2.strokeRect(wX,wY,wW,wH);
    ctx2.strokeStyle='#1a1408'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(cx,wY); ctx2.lineTo(cx,wY+wH); ctx2.stroke();
    // Gold coin in left pane
    ctx2.fillStyle='#c8922a'; ctx2.beginPath(); ctx2.arc(wX+Math.round(wW*0.27),wY+wH/2,3,0,Math.PI*2); ctx2.fill();
    ctx2.strokeStyle='#e8b84b'; ctx2.lineWidth=0.8; ctx2.stroke();
    // Fabric awning — spans full width
    const aY=0+14;
    ctx2.fillStyle='#4a2a0e';
    ctx2.beginPath(); ctx2.moveTo(0,aY); ctx2.lineTo(0+TILE,aY); ctx2.lineTo(0+TILE+2,aY+8); ctx2.lineTo(0-2,aY+8); ctx2.closePath(); ctx2.fill();
    // Awning stripe lines
    ctx2.strokeStyle='#6a3c18'; ctx2.lineWidth=1.8;
    for(let i=1;i<5;i++){ const ax=0+i*(TILE/5); ctx2.beginPath(); ctx2.moveTo(ax,aY); ctx2.lineTo(ax-2,aY+8); ctx2.stroke(); }
    // Fringe drops
    ctx2.strokeStyle='#5a3210'; ctx2.lineWidth=1;
    for(let i=0;i<=Math.floor(TILE/5);i++){ const fx=0+i*5; ctx2.beginPath(); ctx2.moveTo(fx,aY+8); ctx2.lineTo(fx-1,aY+12); ctx2.stroke(); }
    ctx2.restore();
  } else if(t===T.FLOWER){
    // Flower — 3 variants by position hash
    const v = (x*7 + y*11) % 3;
    ctx2.save();
    if(v===0){
      // Red poppies — small scattered dots
      const spots=[[cx-6,cy+2],[cx-2,cy-2],[cx+4,cy+1],[cx+1,cy+5],[cx-4,cy+6]];
      spots.forEach(([fx,fy])=>{
        ctx2.beginPath(); ctx2.arc(fx,fy,2.2,0,Math.PI*2);
        ctx2.fillStyle='#c03838'; ctx2.fill();
        ctx2.beginPath(); ctx2.arc(fx,fy,1,0,Math.PI*2);
        ctx2.fillStyle='#201008'; ctx2.fill();
      });
      // Stems
      ctx2.strokeStyle='#2a4a18'; ctx2.lineWidth=1;
      spots.forEach(([fx,fy])=>{ ctx2.beginPath(); ctx2.moveTo(fx,fy+2); ctx2.lineTo(fx+1,py+TILE-4); ctx2.stroke(); });
    } else if(v===1){
      // Yellow dandelions
      const spots=[[cx-5,cy+1],[cx+3,cy-1],[cx,cy+4],[cx-2,cy+7]];
      spots.forEach(([fx,fy])=>{
        for(let a=0;a<8;a++){
          const ang=a/8*Math.PI*2;
          ctx2.strokeStyle='#d4a820'; ctx2.lineWidth=1.2;
          ctx2.beginPath(); ctx2.moveTo(fx,fy); ctx2.lineTo(fx+Math.cos(ang)*4,fy+Math.sin(ang)*4); ctx2.stroke();
        }
        ctx2.beginPath(); ctx2.arc(fx,fy,1.5,0,Math.PI*2);
        ctx2.fillStyle='#f0c830'; ctx2.fill();
      });
      ctx2.strokeStyle='#285020'; ctx2.lineWidth=1;
      spots.forEach(([fx,fy])=>{ ctx2.beginPath(); ctx2.moveTo(fx,fy+5); ctx2.lineTo(fx,py+TILE-4); ctx2.stroke(); });
    } else if(v===2){
      // Blue forget-me-nots — tiny clusters
      const spots=[[cx-4,cy+3],[cx+2,cy],[cx+5,cy+5],[cx-1,cy+7],[cx-6,cy+6]];
      spots.forEach(([fx,fy])=>{
        ctx2.beginPath(); ctx2.arc(fx,fy,2.5,0,Math.PI*2);
        ctx2.fillStyle='rgba(60,100,200,0.75)'; ctx2.fill();
        ctx2.beginPath(); ctx2.arc(fx,fy,1,0,Math.PI*2);
        ctx2.fillStyle='#fff8e0'; ctx2.fill();
      });
      ctx2.strokeStyle='#2a4a18'; ctx2.lineWidth=0.8;
      spots.forEach(([fx,fy])=>{ ctx2.beginPath(); ctx2.moveTo(fx,fy+3); ctx2.lineTo(fx,py+TILE-4); ctx2.stroke(); });
    } else {
      // White clover patches — small white puffs with green base
      ctx2.fillStyle='#1e3a14';
      ctx2.fillRect(px+4,py+TILE-9,TILE-8,7);
      const puffs=[[cx-5,cy+3],[cx,cy+1],[cx+5,cy+4],[cx-2,cy+7],[cx+3,cy+7]];
      puffs.forEach(([fx,fy])=>{
        ctx2.beginPath(); ctx2.arc(fx,fy,2.8,0,Math.PI*2);
        ctx2.fillStyle='rgba(240,240,230,0.85)'; ctx2.fill();
      });
    }
    ctx2.restore();
  } else if(t===T.BUSH){
    
    // Bush — 3 variants by position hash
    const v = (x*13 + y*5) % 3;
    ctx2.save()
    ctx2.translate(px,py);;
    if(v===0){
      // Dense leafy bush — dark green mound
      const baseCol='#1a3a10', midCol='#2a5018', hiCol='#3a6820';
      ctx2.fillStyle=baseCol;
      ctx2.beginPath(); ctx2.ellipse(cx,0+TILE-7,14,8,0,0,Math.PI*2); ctx2.fill();
      ctx2.fillStyle=midCol;
      ctx2.beginPath(); ctx2.ellipse(cx-3,0+TILE-11,10,7,0,0,Math.PI*2); ctx2.fill();
      ctx2.beginPath(); ctx2.ellipse(cx+4,0+TILE-10,9,6,0,0,Math.PI*2); ctx2.fill();
      ctx2.fillStyle=hiCol;
      ctx2.beginPath(); ctx2.ellipse(cx,0+TILE-13,7,5,0,0,Math.PI*2); ctx2.fill();
      // Highlight dots
      ctx2.fillStyle='rgba(120,200,80,0.3)';
      [[cx-4,0+TILE-14],[cx+2,0+TILE-12],[cx-1,0+TILE-16]].forEach(([bx,by])=>{
        ctx2.beginPath(); ctx2.arc(bx,by,2,0,Math.PI*2); ctx2.fill();
      });
    } else if(v===1){
      // Flowering bush — green with pink/white blooms
      ctx2.fillStyle='#1e4010';
      ctx2.beginPath(); ctx2.ellipse(cx,0+TILE-7,13,7,0,0,Math.PI*2); ctx2.fill();
      ctx2.fillStyle='#2a5818';
      ctx2.beginPath(); ctx2.ellipse(cx-2,0+TILE-12,9,7,-.2,0,Math.PI*2); ctx2.fill();
      ctx2.beginPath(); ctx2.ellipse(cx+3,0+TILE-11,8,6,.2,0,Math.PI*2); ctx2.fill();
      // Flowers on bush
      const blooms=[[cx-5,0+TILE-13],[cx,0+TILE-16],[cx+5,0+TILE-13],[cx-2,0+TILE-10],[cx+3,0+TILE-9]];
      blooms.forEach(([bx,by],i)=>{
        ctx2.fillStyle= i%2===0 ? '#d87898' : '#f0e8d0';
        ctx2.beginPath(); ctx2.arc(bx,by,2.5,0,Math.PI*2); ctx2.fill();
      });
    } else {
      // Thorny bramble — darker, jagged look
      ctx2.fillStyle='#142808';
      ctx2.beginPath(); ctx2.ellipse(cx,0+TILE-7,14,7,0,0,Math.PI*2); ctx2.fill();
      ctx2.fillStyle='#1e3c10';
      ctx2.beginPath(); ctx2.ellipse(cx-4,0+TILE-11,8,6,-.3,0,Math.PI*2); ctx2.fill();
      ctx2.beginPath(); ctx2.ellipse(cx+3,0+TILE-10,9,6,.2,0,Math.PI*2); ctx2.fill();
      ctx2.fillStyle='#264a14';
      ctx2.beginPath(); ctx2.ellipse(cx,0+TILE-13,6,5,0,0,Math.PI*2); ctx2.fill();
      // Thorns (tiny spikes)
      ctx2.strokeStyle='#3a5a1a'; ctx2.lineWidth=1;
      [[cx-7,0+TILE-10],[cx+7,0+TILE-10],[cx-4,0+TILE-15],[cx+5,0+TILE-14]].forEach(([bx,by])=>{
        ctx2.beginPath(); ctx2.moveTo(bx,by); ctx2.lineTo(bx+3,by-4); ctx2.stroke();
        ctx2.beginPath(); ctx2.moveTo(bx,by); ctx2.lineTo(bx-3,by-3); ctx2.stroke();
      });
    }
    ctx2.restore();
  } else if(t===T.CHAPEL_PORTAL){
    // Swirling violet portal with cracked stone arch
    // Arch stones left and right
    ctx2.fillStyle='#2a2030'; ctx2.fillRect(px+2,py+4,6,TILE-6); ctx2.fillRect(px+TILE-8,py+4,6,TILE-6);
    ctx2.strokeStyle='#4a3858'; ctx2.lineWidth=1.5;
    ctx2.strokeRect(px+2,py+4,6,TILE-6); ctx2.strokeRect(px+TILE-8,py+4,6,TILE-6);
    // Arch top
    ctx2.fillStyle='#2a2030';
    ctx2.beginPath(); ctx2.arc(cx,py+10,12,Math.PI,0); ctx2.fill();
    ctx2.strokeStyle='#4a3858'; ctx2.lineWidth=1.5; ctx2.stroke();
    // Portal glow (animated via time)
    const pt = (frameNow/1200)%1;
    const pg1 = `rgba(100,20,160,${0.55+Math.sin(pt*Math.PI*2)*0.2})`;
    const pg2 = `rgba(160,40,220,${0.2+Math.sin(pt*Math.PI*2+1)*0.15})`;
    const pGrad = ctx2.createRadialGradient(cx,cy,2,cx,cy,12);
    pGrad.addColorStop(0,pg2); pGrad.addColorStop(1,pg1);
    ctx2.fillStyle=pGrad;
    ctx2.beginPath(); ctx2.ellipse(cx,cy,11,15,0,0,Math.PI*2); ctx2.fill();
    // Rune symbol in centre
    ctx2.fillStyle=`rgba(220,180,255,${0.5+Math.sin(pt*Math.PI*2)*0.3})`;
    ctx2.font='bold 14px serif'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
    ctx2.fillText('ᛟ',cx,cy);
    // Crack lines on arch stones
    ctx2.strokeStyle='rgba(90,70,120,0.6)'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(px+4,py+8); ctx2.lineTo(px+7,py+14); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(px+TILE-5,py+10); ctx2.lineTo(px+TILE-8,py+18); ctx2.stroke();
  } else if(t===T.ALTAR){
    // Desecrated stone altar — dark slab with candles and dried blood
    // Base slab
    ctx2.fillStyle='#1e1820'; ctx2.fillRect(px+4,py+18,TILE-8,TILE-20);
    ctx2.strokeStyle='#3a2a40'; ctx2.lineWidth=1.5; ctx2.strokeRect(px+4,py+18,TILE-8,TILE-20);
    // Top surface — slightly lighter
    ctx2.fillStyle='#28202e'; ctx2.fillRect(px+4,py+14,TILE-8,6);
    ctx2.strokeStyle='#4a3850'; ctx2.lineWidth=1; ctx2.strokeRect(px+4,py+14,TILE-8,6);
    // Carved symbol on front face
    ctx2.strokeStyle='#6a2080'; ctx2.lineWidth=1.2;
    ctx2.beginPath(); ctx2.moveTo(cx,py+20); ctx2.lineTo(cx,py+30); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(cx-5,py+23); ctx2.lineTo(cx+5,py+23); ctx2.stroke();
    ctx2.beginPath(); ctx2.arc(cx,py+20,4,0,Math.PI*2); ctx2.stroke();
    // Dried blood splatter
    ctx2.fillStyle='rgba(100,15,15,0.7)';
    [[cx-3,py+15],[cx+2,py+16],[cx-1,py+14],[cx+5,py+15]].forEach(([ax,ay])=>{
      ctx2.beginPath(); ctx2.arc(ax,ay,1.5,0,Math.PI*2); ctx2.fill();
    });
    // Two candles on top
    ctx2.fillStyle='#3a3040'; ctx2.fillRect(px+7,py+8,3,8); ctx2.fillRect(px+TILE-10,py+9,3,7);
    // Candle flames
    const ft=(frameNow/400)%1;
    ctx2.fillStyle=`rgba(220,120,20,${0.7+Math.sin(ft*Math.PI*2)*0.2})`;
    ctx2.beginPath(); ctx2.ellipse(px+8.5,py+7,1.5,3,0,0,Math.PI*2); ctx2.fill();
    ctx2.beginPath(); ctx2.ellipse(px+TILE-8.5,py+8,1.5,3,0,0,Math.PI*2); ctx2.fill();
  } else if(t===T.PILLAR){
    // Crumbling stone pillar
    // Base
    ctx2.fillStyle='#22202a'; ctx2.fillRect(px+8,py+TILE-8,TILE-16,7);
    ctx2.strokeStyle='#3a3848'; ctx2.lineWidth=1; ctx2.strokeRect(px+8,py+TILE-8,TILE-16,7);
    // Shaft
    ctx2.fillStyle='#1e1c26'; ctx2.fillRect(px+10,py+10,TILE-20,TILE-16);
    ctx2.strokeStyle='#34323e'; ctx2.lineWidth=1; ctx2.strokeRect(px+10,py+10,TILE-20,TILE-16);
    // Capital (top)
    ctx2.fillStyle='#2a2832'; ctx2.fillRect(px+7,py+8,TILE-14,5);
    ctx2.strokeStyle='#3a3848'; ctx2.lineWidth=1; ctx2.strokeRect(px+7,py+8,TILE-14,5);
    // Vertical fluting lines
    ctx2.strokeStyle='rgba(60,58,75,0.8)'; ctx2.lineWidth=1;
    for(let fl=0;fl<3;fl++){
      const fx=px+13+fl*5;
      ctx2.beginPath(); ctx2.moveTo(fx,py+12); ctx2.lineTo(fx,py+TILE-10); ctx2.stroke();
    }
    // Crack
    ctx2.strokeStyle='rgba(80,70,100,0.6)'; ctx2.lineWidth=1.2;
    ctx2.beginPath(); ctx2.moveTo(px+12,py+14); ctx2.lineTo(px+16,py+22); ctx2.lineTo(px+13,py+30); ctx2.stroke();
    // Crumble chunk missing from top-right
    ctx2.fillStyle='#12101a';
    ctx2.beginPath(); ctx2.moveTo(px+TILE-8,py+8); ctx2.lineTo(px+TILE-7,py+15); ctx2.lineTo(px+TILE-13,py+10); ctx2.closePath(); ctx2.fill();
  } else if(t===T.CHAPEL_RUNE){
    // Glowing floor rune carved into dark stone — variant shape by tile position
    const rv = (x*7 + y*13) % 4;
    const rt = (frameNow / 2200) % 1;
    const pulse = Math.sin(rt * Math.PI * 2);       // -1 → +1, slow breathe
    const glow  = 0.45 + pulse * 0.18;              // glow intensity
    const lineA = 0.65 + pulse * 0.22;              // carved line brightness

    // Dark worn flagstone base (slightly different shade to nearby floor)
    ctx2.fillStyle='#141018';
    ctx2.fillRect(px, py, TILE, TILE);
    // Subtle stone texture — two faint grout lines
    ctx2.strokeStyle='rgba(40,36,50,0.7)'; ctx2.lineWidth=0.5;
    ctx2.beginPath(); ctx2.moveTo(px,py+TILE*0.4); ctx2.lineTo(px+TILE,py+TILE*0.4); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(px+TILE*0.5,py); ctx2.lineTo(px+TILE*0.5,py+TILE); ctx2.stroke();

    // === OUTER AMBIENT GLOW — large soft bloom across the whole tile ===
    const bloom = ctx2.createRadialGradient(cx, cy, 0, cx, cy, TILE * 0.72);
    bloom.addColorStop(0, `rgba(110,30,180,${glow * 0.35})`);
    bloom.addColorStop(0.5,`rgba(80,15,140,${glow * 0.15})`);
    bloom.addColorStop(1, 'rgba(60,0,120,0)');
    ctx2.fillStyle = bloom;
    ctx2.fillRect(px, py, TILE, TILE);

    // === INNER GLOW — tight bright core ===
    const inner = ctx2.createRadialGradient(cx, cy, 0, cx, cy, 11);
    inner.addColorStop(0, `rgba(200,120,255,${glow * 0.55})`);
    inner.addColorStop(0.4,`rgba(150,50,220,${glow * 0.3})`);
    inner.addColorStop(1, 'rgba(100,20,180,0)');
    ctx2.fillStyle = inner;
    ctx2.beginPath(); ctx2.arc(cx, cy, 11, 0, Math.PI*2); ctx2.fill();

    // === CARVED SYMBOL — variant per position ===
    ctx2.strokeStyle = `rgba(210,140,255,${lineA})`;
    ctx2.shadowColor  = `rgba(180,80,255,${glow})`;
    ctx2.shadowBlur   = 6 + pulse * 4;
    ctx2.lineWidth = 1.6;
    ctx2.lineCap = 'round';

    if(rv === 0){
      // ᚱ-style — outer ring + vertical bar + two branches right
      ctx2.beginPath(); ctx2.arc(cx, cy, 9, 0, Math.PI*2); ctx2.stroke();
      ctx2.beginPath();
      ctx2.moveTo(cx, cy-9); ctx2.lineTo(cx, cy+9);       // vertical
      ctx2.moveTo(cx, cy-4); ctx2.lineTo(cx+7, cy-9);     // branch up-right
      ctx2.moveTo(cx, cy+1); ctx2.lineTo(cx+7, cy+5);     // branch mid-right
      ctx2.stroke();
    } else if(rv === 1){
      // ᛟ-style — hexagonal asterisk
      ctx2.beginPath(); ctx2.arc(cx, cy, 9, 0, Math.PI*2); ctx2.stroke();
      ctx2.beginPath();
      for(let a=0; a<3; a++){
        const ang = (a / 3) * Math.PI;
        ctx2.moveTo(cx + Math.cos(ang)*9, cy + Math.sin(ang)*9);
        ctx2.lineTo(cx - Math.cos(ang)*9, cy - Math.sin(ang)*9);
      }
      ctx2.stroke();
    } else if(rv === 2){
      // ᛏ-style — arrow pointing up with two side tines
      ctx2.beginPath();
      ctx2.moveTo(cx, cy+9);  ctx2.lineTo(cx, cy-9);      // vertical
      ctx2.moveTo(cx, cy-4);  ctx2.lineTo(cx-7, cy+1);    // left tine
      ctx2.moveTo(cx, cy-4);  ctx2.lineTo(cx+7, cy+1);    // right tine
      ctx2.moveTo(cx-6, cy+4);ctx2.lineTo(cx+6, cy+4);    // base bar
      ctx2.stroke();
      // Outer dotted circle via arcs
      ctx2.beginPath(); ctx2.arc(cx, cy, 10, 0, Math.PI*2);
      ctx2.setLineDash([2,3]); ctx2.stroke(); ctx2.setLineDash([]);
    } else {
      // ᚦ-style — vertical spine + right-side bulge
      ctx2.beginPath();
      ctx2.moveTo(cx-3, cy-9); ctx2.lineTo(cx-3, cy+9);   // spine
      ctx2.moveTo(cx-3, cy-9); ctx2.lineTo(cx+5, cy-4);   // bulge top
      ctx2.moveTo(cx+5, cy-4); ctx2.bezierCurveTo(cx+10,cy-1,cx+10,cy+3,cx+5,cy+3); // curve
      ctx2.moveTo(cx+5, cy+3); ctx2.lineTo(cx-3, cy+2);   // bulge bottom
      ctx2.stroke();
      // Small ring at top
      ctx2.beginPath(); ctx2.arc(cx-1, cy-6, 3, 0, Math.PI*2); ctx2.stroke();
    }

    // Reset shadow
    ctx2.shadowBlur = 0; ctx2.shadowColor = 'transparent';

    // === EDGE CRACK LINES — carved into the stone around the symbol ===
    ctx2.strokeStyle = `rgba(140,60,200,${glow * 0.4})`;
    ctx2.lineWidth = 0.8;
    ctx2.beginPath();
    ctx2.moveTo(cx-13, cy-8); ctx2.lineTo(cx-9, cy-3);
    ctx2.moveTo(cx+10, cy+6); ctx2.lineTo(cx+14, cy+10);
    ctx2.moveTo(cx-5,  cy+11);ctx2.lineTo(cx-8,  cy+14);
    ctx2.stroke();
  } else if(t===T.CARAVAN_PORTAL){
    // ─── CARAVAN PORTAL ──────────────────────────────────────────
    const cp=ctx2.createRadialGradient(px+TILE/2,py+TILE/2,2,px+TILE/2,py+TILE/2,TILE/2);
    const cpPulse=0.6+Math.sin(frameNow*0.0018)*0.25;
    cp.addColorStop(0,`rgba(160,100,40,${cpPulse})`);
    cp.addColorStop(0.45,`rgba(90,55,20,${cpPulse*0.6})`);
    cp.addColorStop(1,'rgba(30,15,5,0)');
    ctx2.fillStyle=cp; ctx2.beginPath(); ctx2.arc(px+TILE/2,py+TILE/2,TILE/2,0,Math.PI*2); ctx2.fill();
    for(let di=0;di<5;di++){
      const da=(frameNow*0.0007+di*1.256)%(Math.PI*2);
      const dr=TILE*0.22+Math.sin(frameNow*0.0013+di)*TILE*0.06;
      ctx2.fillStyle=`rgba(200,160,80,${0.4+Math.sin(da)*0.2})`;
      ctx2.beginPath(); ctx2.arc(px+TILE/2+Math.cos(da)*dr, py+TILE/2+Math.sin(da)*dr, 1.5,0,Math.PI*2); ctx2.fill();
    }
    ctx2.fillStyle=`rgba(210,170,90,${cpPulse})`; ctx2.font='bold 7px Cinzel,serif';
    ctx2.textAlign='center'; ctx2.fillText('ROAD',px+TILE/2,py+TILE-4); ctx2.textAlign='left';
  }

  ctx2.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x, y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

function drawOre(px,py,bgcol,accent,flash){
  ctx2.fillStyle=bgcol;
  ctx2.fillRect(px+4,py+6,TILE-8,TILE-10);
  ctx2.strokeStyle=accent;
  ctx2.lineWidth=1.5;
  ctx2.strokeRect(px+4,py+6,TILE-8,TILE-10);
  // Ore veins
  ctx2.fillStyle=accent;
  ctx2.beginPath(); ctx2.arc(px+12,py+14,3,0,Math.PI*2); ctx2.fill();
  ctx2.beginPath(); ctx2.arc(px+22,py+20,2,0,Math.PI*2); ctx2.fill();
  ctx2.beginPath(); ctx2.arc(px+18,py+12,2.5,0,Math.PI*2); ctx2.fill();
  if(flash>0){
    ctx2.fillStyle=`rgba(255,200,100,${flash*0.5})`;
    ctx2.fillRect(px+4,py+6,TILE-8,TILE-10);
  }
}

function drawTree(px,py,t,flash){
  const col = t===T.OAK?'#4a2a0e':t===T.WILLOW?'#1a3a14':'#2a1a08';
  const foliage = t===T.OAK?'#1a4a14':t===T.WILLOW?'#2a6a1a':'#1a3a10';
  // Trunk
  ctx2.fillStyle=col;
  ctx2.fillRect(px+TILE/2-4,py+TILE*.5,8,TILE*.5-2);
  // Canopy
  ctx2.fillStyle=foliage;
  ctx2.beginPath(); ctx2.arc(px+TILE/2,py+TILE*.4,TILE*.32,0,Math.PI*2); ctx2.fill();
  ctx2.fillStyle='rgba(0,0,0,0.2)';
  ctx2.beginPath(); ctx2.arc(px+TILE/2+3,py+TILE*.45,TILE*.2,0,Math.PI*2); ctx2.fill();
  if(flash>0){
    ctx2.fillStyle=`rgba(200,180,50,${flash*0.4})`;
    ctx2.fillRect(px,py,TILE,TILE);
  }
}

function drawEnemy(px,py,bg,col,letter,flash){
  ctx2.fillStyle=bg;
  ctx2.beginPath(); ctx2.arc(px+TILE/2,py+TILE/2,TILE/2-4,0,Math.PI*2); ctx2.fill();
  ctx2.strokeStyle=col; ctx2.lineWidth=1.5;
  ctx2.stroke();
  ctx2.fillStyle=col;
  ctx2.font='bold 14px Cinzel, serif';
  ctx2.textAlign='center'; ctx2.textBaseline='middle';
  ctx2.fillText(letter,px+TILE/2,py+TILE/2);
  if(flash>0){
    ctx2.fillStyle=`rgba(200,50,50,${flash*0.6})`;
    ctx2.beginPath(); ctx2.arc(px+TILE/2,py+TILE/2,TILE/2-4,0,Math.PI*2); ctx2.fill();
  }
}

function drawBuilding(px,py,bg,accent,icon){
  ctx2.fillStyle=bg;
  ctx2.fillRect(px+2,py+2,TILE-4,TILE-4);
  ctx2.strokeStyle=accent; ctx2.lineWidth=1.5;
  ctx2.strokeRect(px+2,py+2,TILE-4,TILE-4);
  ctx2.font='20px serif'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
  ctx2.fillText(icon,px+TILE/2,py+TILE/2);
}

function drawBuilding(px,py,bg,accent,icon){
  ctx2.fillStyle=bg;
  ctx2.fillRect(px+2,py+2,TILE-4,TILE-4);
  ctx2.strokeStyle=accent; ctx2.lineWidth=1.5;
  ctx2.strokeRect(px+2,py+2,TILE-4,TILE-4);
  ctx2.font='20px serif'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
  ctx2.fillText(icon,px+TILE/2,py+TILE/2);
}


function drawExitPortal(px,py){
  const cx=px+TILE/2, cy=py+TILE/2;
  const t=frameNow*0.002;
  // Pulsing outer glow
  const glow=ctx2.createRadialGradient(cx,cy,2,cx,cy,TILE*.55);
  const pulse=0.4+0.25*Math.sin(t);
  glow.addColorStop(0,`rgba(232,184,75,${pulse})`);
  glow.addColorStop(0.5,`rgba(200,146,42,${pulse*0.4})`);
  glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx2.fillStyle=glow;
  ctx2.fillRect(px-4,py-4,TILE+8,TILE+8);
  // Dark archway bg
  ctx2.fillStyle='#0a0806';
  ctx2.beginPath(); ctx2.arc(cx,cy,TILE*.36,0,Math.PI*2); ctx2.fill();
  // Spinning inner ring
  ctx2.save();
  ctx2.translate(cx,cy); ctx2.rotate(t*0.5);
  ctx2.strokeStyle=`rgba(232,184,75,0.8)`; ctx2.lineWidth=2;
  ctx2.setLineDash([4,4]);
  ctx2.beginPath(); ctx2.arc(0,0,TILE*.3,0,Math.PI*2); ctx2.stroke();
  ctx2.setLineDash([]);
  ctx2.restore();
  // Arrow pointing right
  ctx2.fillStyle='#e8b84b';
  ctx2.font='bold 16px serif'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
  ctx2.fillText('➤',cx,cy);
  // "NEXT ZONE" label above
  ctx2.fillStyle=`rgba(232,184,75,${0.6+0.3*Math.sin(t*1.5)})`;
  ctx2.font='bold 7px Cinzel,serif'; ctx2.letterSpacing='1px';
  ctx2.fillText('NEXT ZONE',cx,py+4);
}

function drawReturnPortal(px,py){
  const cx=px+TILE/2, cy=py+TILE/2;
  const t=frameNow*0.002;
  // Pulsing blue-silver glow
  const glow=ctx2.createRadialGradient(cx,cy,2,cx,cy,TILE*.55);
  const pulse=0.35+0.2*Math.sin(t*0.8+1);
  glow.addColorStop(0,`rgba(100,160,255,${pulse})`);
  glow.addColorStop(0.5,`rgba(60,100,200,${pulse*0.4})`);
  glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx2.fillStyle=glow;
  ctx2.fillRect(px-4,py-4,TILE+8,TILE+8);
  // Dark bg
  ctx2.fillStyle='#060810';
  ctx2.beginPath(); ctx2.arc(cx,cy,TILE*.36,0,Math.PI*2); ctx2.fill();
  // Spinning inner ring (reverse direction)
  ctx2.save();
  ctx2.translate(cx,cy); ctx2.rotate(-t*0.4);
  ctx2.strokeStyle=`rgba(120,180,255,0.7)`; ctx2.lineWidth=2;
  ctx2.setLineDash([4,4]);
  ctx2.beginPath(); ctx2.arc(0,0,TILE*.3,0,Math.PI*2); ctx2.stroke();
  ctx2.setLineDash([]);
  ctx2.restore();
  // Arrow pointing left
  ctx2.fillStyle='#80b8ff';
  ctx2.font='bold 16px serif'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
  ctx2.fillText('◀',cx,cy);
  // "PREV ZONE" label
  ctx2.fillStyle=`rgba(120,180,255,${0.6+0.3*Math.sin(t*1.5)})`;
  ctx2.font='bold 7px Cinzel,serif'; ctx2.letterSpacing='1px';
  ctx2.fillText('PREV ZONE',cx,py+4);
}

// drawPlayer — renders a player character at pixel-interpolated position.
// isP2:       true for the local P2 in split-screen coop (uses state.players[1])
// remoteConf: optional {bodyColor, ringColor, appearance, moving} for online remote players
function drawPlayer(realX,realY,isP2,remoteConf=null){
  ctx2.save();
  const cx=realX*TILE+TILE/2, cy=realY*TILE+TILE/2;
  const p = remoteConf ? null : state.players[isP2?1:0];
  const app  = remoteConf ? (remoteConf.appearance||{}) : (p?.appearance||{});
  const skin = SKIN_TONES[app.skinIdx||0];
  const cl   = CLASSES.find(c=>c.id===(app.classId||'warrior'))||CLASSES[0];

  const isMoving = remoteConf ? remoteConf.moving
                 : isP2      ? p2Moving
                              : playerMoving;
  const bobOffset = isMoving ? Math.sin(performance.now()*0.018)*2 : 0;

  const bodyColor = remoteConf ? remoteConf.bodyColor
                  : isP2      ? '#1a2a4a'
                               : '#2a1a0a';
  const ringColor = remoteConf ? remoteConf.ringColor
                  : isP2      ? '#4a8aaa'
                               : cl.color;

  // Shadow
  ctx2.fillStyle='rgba(0,0,0,0.4)';
  ctx2.beginPath(); ctx2.ellipse(cx,cy+TILE*.35,TILE*.22,TILE*.1,0,0,Math.PI*2); ctx2.fill();

  // Body
  ctx2.fillStyle=bodyColor;
  ctx2.beginPath(); ctx2.arc(cx,cy+bobOffset,TILE*.32,0,Math.PI*2); ctx2.fill();

  // Ring
  ctx2.strokeStyle=ringColor;
  ctx2.lineWidth=2;
  ctx2.beginPath(); ctx2.arc(cx,cy+bobOffset,TILE*.32,0,Math.PI*2); ctx2.stroke();

  // Face
  ctx2.fillStyle=skin;
  ctx2.beginPath(); ctx2.arc(cx,cy-2+bobOffset,TILE*.14,0,Math.PI*2); ctx2.fill();

  // Class icon
  ctx2.font='12px serif'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
  ctx2.fillText(cl.icon,cx,cy+5+bobOffset);

  // Name tag for remote players
  if(remoteConf && remoteConf.name) {
    ctx2.font='8px sans-serif'; ctx2.textAlign='center'; ctx2.textBaseline='bottom';
    ctx2.fillStyle='rgba(0,0,0,0.55)';
    const nw = ctx2.measureText(remoteConf.name).width;
    ctx2.fillRect(cx-nw/2-2, cy-TILE*.4-10, nw+4, 10);
    ctx2.fillStyle=ringColor;
    ctx2.fillText(remoteConf.name, cx, cy-TILE*.4);
  }

  ctx2.restore();
}

function drawGroundBags() {
  if(!groundBags.length) return;
  const s = TILE;
  const now = frameNow;
  for(const bag of groundBags) {
    const px = bag.x * s;
    const py = bag.y * s;
    const cx = px + s * 0.5;
    // Gentle bob
    const bob = Math.sin(now * 0.002 + bag.id) * s * 0.02;
    const cy  = py + s * 0.6 + bob;

    const bw = s * 0.34, bh = s * 0.26;

    // Shadow
    ctx2.fillStyle = 'rgba(0,0,0,0.28)';
    ctx2.beginPath();
    ctx2.ellipse(cx, py + s * 0.88, bw * 0.45, s * 0.05, 0, 0, Math.PI * 2);
    ctx2.fill();

    // Bag body
    ctx2.fillStyle = '#6b3d12';
    ctx2.beginPath();
    ctx2.roundRect(cx - bw/2, cy - bh/2, bw, bh, s * 0.06);
    ctx2.fill();

    // Highlight stripe
    ctx2.fillStyle = '#8a5220';
    ctx2.beginPath();
    ctx2.roundRect(cx - bw/2 + s*0.03, cy - bh/2 + s*0.03, bw - s*0.06, bh * 0.38, s*0.04);
    ctx2.fill();

    // Strap / tie knot
    ctx2.fillStyle = '#4a2808';
    ctx2.fillRect(cx - s*0.04, cy - bh/2 - s*0.07, s*0.08, s*0.09);

    // Flap top
    ctx2.fillStyle = '#7a4818';
    ctx2.beginPath();
    ctx2.roundRect(cx - bw*0.36, cy - bh/2 - s*0.11, bw*0.72, s*0.13, s*0.04);
    ctx2.fill();

    // Item count badge (if more than 1 total)
    const total = bag.items.reduce((t, i) => t + i.qty, 0);
    if(total > 1) {
      const bx = cx + bw * 0.36, by = cy + bh * 0.36;
      ctx2.fillStyle = 'rgba(0,0,0,0.75)';
      ctx2.beginPath();
      ctx2.arc(bx, by, s * 0.13, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.fillStyle = '#ffd070';
      ctx2.font = `bold ${Math.round(s * 0.15)}px monospace`;
      ctx2.textAlign = 'center';
      ctx2.textBaseline = 'middle';
      ctx2.fillText(total > 99 ? '99+' : String(total), bx, by);
      ctx2.textAlign = 'left';
      ctx2.textBaseline = 'alphabetic';
    }
  }
}

function renderMap(){
  if(!currentMap) return;
  updateCamera();
  frameNow = performance.now();   // single timestamp for all drawTile calls this frame
  const {tiles,W,H} = currentMap;
  ctx2.clearRect(0,0,canvas.width,canvas.height);

  // Only draw visible tiles (viewport culling)
  const startX = Math.max(0, Math.floor(camera.x / TILE));
  const startY = Math.max(0, Math.floor(camera.y / TILE));
  const endX   = Math.min(W, Math.ceil((camera.x + canvas.width)  / TILE) + 1);
  const endY   = Math.min(H, Math.ceil((camera.y + canvas.height) / TILE) + 1);

  ctx2.save();
  ctx2.translate(-Math.round(camera.x), -Math.round(camera.y));

  const floorMap = currentMap.floor;
  for(let y=startY;y<endY;y++) for(let x=startX;x<endX;x++) drawTile(x,y,tiles[y][x], floorMap ? floorMap[y][x] : null);


  // Walk destination indicator
  if(playerPath.length>0){
    const dest=playerPath[playerPath.length-1];
    const pulse=0.5+0.3*Math.sin(frameNow*0.008);
    ctx2.fillStyle=`rgba(200,180,100,${pulse*0.25})`;
    ctx2.fillRect(dest.x*TILE,dest.y*TILE,TILE,TILE);
    ctx2.strokeStyle=`rgba(200,180,100,${pulse*0.7})`;
    ctx2.lineWidth=1.5;
    ctx2.strokeRect(dest.x*TILE+1,dest.y*TILE+1,TILE-2,TILE-2);
  }

  // Hover highlight
  if(hoverTile.x>=0){
    ctx2.fillStyle='rgba(200,180,100,0.08)';
    ctx2.fillRect(hoverTile.x*TILE,hoverTile.y*TILE,TILE,TILE);
    ctx2.strokeStyle='rgba(200,180,100,0.3)';
    ctx2.lineWidth=1;
    ctx2.strokeRect(hoverTile.x*TILE,hoverTile.y*TILE,TILE,TILE);
  }

  // Local split-screen P2
  if(gameMode==='coop') {
    drawPlayer(p2Real.x, p2Real.y, true);
  }
  // Online remote players (up to 3) — only draw players on the same map
  if(isOnline()) {
    for(const rp of remotePlayers.values()) {
      if(rp.zone !== zoneIndex || rp.interior !== interiorStack.length) continue;
      const col = REMOTE_COLORS[rp.colorIdx] || REMOTE_COLORS[0];
      drawPlayer(rp.real.x, rp.real.y, false, {
        bodyColor: col.body, ringColor: col.ring,
        appearance: rp.appearance, moving: rp.moving, name: rp.name,
      });
    }
  }
  drawGroundBags();
  drawNpcs();
  drawPlayer(playerReal.x,playerReal.y,false);
  drawEnemies();

  ctx2.restore();

  // ---- Day/Night lighting with proper light source cutouts ----
  // Dungeons are always pitch dark regardless of time of day
  const isDungeon = currentMap && currentMap.isInterior &&
    (currentMap.name==='THE ASHWOOD CRYPTS'||currentMap.name==='THE IRON DEPTHS'||currentMap.name==='THE CULTIST CATACOMBS');
  const nightA = isDungeon ? 0.92 : getNightAlpha();
  if(nightA > 0) {
    const W = canvas.width, H = canvas.height;

    // Reuse persistent offscreen canvas — only resize when viewport changes
    if(nightCanvas.width !== W || nightCanvas.height !== H) {
      nightCanvas.width  = W;
      nightCanvas.height = H;
    }
    const lx = nightCtx;
    lx.clearRect(0, 0, W, H);

    // Fill with night darkness
    lx.fillStyle = `rgba(5,8,28,${nightA * 0.82})`;
    lx.fillRect(0, 0, W, H);

    // Punch transparent holes for every light source using destination-out
    lx.globalCompositeOperation = 'destination-out';

    const {tiles, W:mW, H:mH} = currentMap;
    const ox = Math.round(camera.x);
    const oy = Math.round(camera.y);

    // Player carries a dim ambient glow so they're always visible
    // In dungeons, player glow is bigger (carrying a torch)
    const psx = playerReal.x * TILE + TILE/2 - ox;
    const psy = playerReal.y * TILE + TILE/2 - oy;
    const playerGlowR = isDungeon ? TILE * 3.5 : TILE * 1.8;
    const playerGlowA = isDungeon ? 0.85 : 0.55 * nightA;
    // Use cached player glow sprite
    const pgRk = Math.round(playerGlowR);
    const pgAk = Math.round(playerGlowA * 10);
    const pgKey = pgRk * 100 + pgAk;
    if(!_lightCache[pgKey]) {
      const psz = pgRk * 2 + 2;
      const pc = document.createElement('canvas'); pc.width = pc.height = psz;
      const pctx = pc.getContext('2d');
      const pg = pctx.createRadialGradient(psz/2,psz/2,0,psz/2,psz/2,pgRk);
      pg.addColorStop(0, `rgba(0,0,0,${playerGlowA})`);
      pg.addColorStop(0.5, `rgba(0,0,0,${playerGlowA * 0.5})`);
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      pctx.fillStyle = pg; pctx.fillRect(0, 0, psz, psz);
      _lightCache[pgKey] = pc;
    }
    const pgs = _lightCache[pgKey];
    lx.drawImage(pgs, psx - pgs.width/2, psy - pgs.height/2);

    // Scan all tiles for light sources (only visible range + a bit of buffer)
    const startX = Math.max(0, Math.floor(camera.x / TILE) - 2);
    const startY = Math.max(0, Math.floor(camera.y / TILE) - 2);
    const endX   = Math.min(mW, Math.ceil((camera.x + W) / TILE) + 2);
    const endY   = Math.min(mH, Math.ceil((camera.y + H) / TILE) + 2);

    for(let ty = startY; ty < endY; ty++) {
      for(let tx = startX; tx < endX; tx++) {
        const t = tiles[ty][tx];
        let sx = tx * TILE - ox;
        let sy = ty * TILE - oy;
        let cx = sx + TILE / 2;
        let cy = sy + TILE / 2;
        let r = 0;
        let innerAlpha = 1;

        if(t === T.LAMPPOST) {
          // Lantern is offset to arm position
          cx = sx + TILE / 2 + 10;
          cy = sy + 8;
          // Radius grows dramatically at night
          r = TILE * (1.8 + nightA * 3.2);
          innerAlpha = 0.92 + nightA * 0.05;
        } else if(t === T.CANDLE) {
          cx = sx + TILE / 2;
          cy = sy + 11;
          r = TILE * (0.9 + nightA * 1.4);
          innerAlpha = 0.75 + nightA * 0.15;
        } else if(t === T.COOKING_FIRE || t === T.SMELTER) {
          cx = sx + TILE / 2;
          cy = sy + TILE / 2;
          r = TILE * (1.2 + nightA * 1.6);
          innerAlpha = 0.8;
        } else if(t === T.EXIT || t === T.EXIT_RETURN) {
          cx = sx + TILE / 2;
          cy = sy + TILE / 2;
          r = TILE * 1.0;
          innerAlpha = 0.6;
        } else if(t === T.DUNGEON_TORCH) {
          cx = sx + TILE / 2;
          cy = sy + TILE * 0.28;
          r = TILE * (2.2 + Math.sin(frameNow*0.003)*0.3);
          innerAlpha = 0.88;
        }

        if(r > 0) {
          // Use cached light sprite — build once per unique (radius, innerAlpha) key
          const rk = Math.round(r);
          const ak = Math.round(innerAlpha * 10);
          const lkey = rk * 100 + ak;
          if(!_lightCache[lkey]) {
            const sz = rk * 2 + 2;
            const lc = document.createElement('canvas');
            lc.width = lc.height = sz;
            const lctx = lc.getContext('2d');
            const lg = lctx.createRadialGradient(sz/2,sz/2,0,sz/2,sz/2,rk);
            lg.addColorStop(0,   `rgba(0,0,0,${innerAlpha})`);
            lg.addColorStop(0.35,`rgba(0,0,0,${innerAlpha * 0.75})`);
            lg.addColorStop(0.7, `rgba(0,0,0,${innerAlpha * 0.3})`);
            lg.addColorStop(1,   'rgba(0,0,0,0)');
            lctx.fillStyle = lg;
            lctx.fillRect(0, 0, sz, sz);
            _lightCache[lkey] = lc;
          }
          const ls = _lightCache[lkey];
          lx.drawImage(ls, cx - ls.width/2, cy - ls.height/2);
        }
      }
    }

    // Blit the mask onto the main canvas
    lx.globalCompositeOperation = 'source-over';
    ctx2.drawImage(nightCanvas, 0, 0);
  }

  // Weather overlay (rain, snow, fog) — skip inside interiors
  if(!currentMap || !currentMap.isInterior) Weather.draw();

  // Fireflies — appear at night in grassy outdoor zones
  Fireflies.draw();

  // ---- Clock display (top-center) ----
  const timeLabel   = getTimeLabel();
  const periodLabel = getPeriodLabel();
  const dayName     = getDayName(gameDay);
  const dayNum      = gameDay;
  const cw = canvas.width;
  ctx2.save();
  ctx2.textAlign = 'center';
  const clockW = 140, clockH = 42;
  const clockX = cw/2 - clockW/2, clockY = 8;
  // Background
  ctx2.fillStyle = 'rgba(5,6,8,0.78)';
  roundRect(ctx2, clockX, clockY, clockW, clockH, 5);
  ctx2.fill();
  // Border — gold by day, blue-silver by night
  ctx2.strokeStyle = nightA > 0.5 ? 'rgba(80,100,180,0.5)' : 'rgba(200,146,42,0.4)';
  ctx2.lineWidth = 1;
  roundRect(ctx2, clockX, clockY, clockW, clockH, 5);
  ctx2.stroke();
  const textCol = nightA > 0.5 ? '#8090d0' : '#e8b84b';
  const dimCol  = nightA > 0.5 ? '#5060a0' : '#a07828';
  // Day name — larger, top line
  ctx2.fillStyle = textCol;
  ctx2.font = 'bold 11px Cinzel, serif';
  ctx2.fillText(dayName, cw/2, clockY + 16);
  // Day number + time — smaller, bottom line
  ctx2.fillStyle = dimCol;
  ctx2.font = '9px Cinzel, serif';
  const weatherLabel = Weather.getName() ? `  ·  ${Weather.getName()}` : '';
  ctx2.fillText(`Day ${dayNum}  ·  ${periodLabel}  ${timeLabel}${weatherLabel}`, cw/2, clockY + 31);
  ctx2.restore();

  // Mini-map overlay (bottom-left corner)
  drawMinimap();
}

function drawMinimap() {
  if(!currentMap) return;
  const {tiles,W,H} = currentMap;
  const mw=120, mh=Math.floor(120*H/W);
  const mx=8, my=canvas.height-mh-8;
  const tileW=mw/W, tileH=mh/H;

  // Rebuild cached minimap only when map changes (not every frame)
  if(minimapDirty || minimapCanvas.height !== mh) {
    minimapCanvas.width  = mw;
    minimapCanvas.height = mh;
    const mc = minimapCtx;
    const MINI_COLORS = {
      [T.GRASS]:'#1a2a14',[T.DARK_GRASS]:'#0e1a0e',[T.DIRT]:'#2a1e12',
      [T.STONE_FLOOR]:'#252830',[T.WALL]:'#111318',[T.DUNGEON_FLOOR]:'#18151a',
      [T.WATER]:'#0e2030',[T.FISHING]:'#1a4060',[T.FISHING2]:'#1a4060',
      [T.COPPER]:'#8b5a2b',[T.IRON]:'#5a5a6a',[T.GOLD_ORE]:'#c8922a',
      [T.MITHRIL]:'#4a6a9a',[T.COAL]:'#2a2a2a',
      [T.NORMAL_TREE]:'#1a4010',[T.OAK]:'#2a5018',[T.WILLOW]:'#184a14',
      [T.GOBLIN]:'#2a4a14',[T.SKELETON]:'#5a4a38',[T.WOLF]:'#3a3840',
      [T.SMELTER]:'#8b3a0a',[T.COOKING_FIRE]:'#c83a0a',[T.SHOP]:'#2a6a9a',[T.WORKBENCH]:'#7a4a20',
      [T.EXIT]:'#e8b84b',[T.EXIT_RETURN]:'#4080ff',
      [T.COBBLE]:'#2a2824',[T.INN]:'#5a3a1a',[T.BLACKSMITH]:'#3a3a4a',
      [T.ROOF_L]:'#2a1208',[T.ROOF_M]:'#2a1208',[T.ROOF_R]:'#2a1208',[T.ROOF_CHIMNEY]:'#2a1208',
      [T.BWALL_SIDE]:'#1e1c28',[T.BWALL_PLAIN]:'#222030',[T.BWALL_WIN]:'#222030',[T.BWALL_FORGE]:'#1e1c28',[T.BWALL_DOOR]:'#222030',[T.BWALL_AWNING]:'#2a2010',
      [T.TOWN_WELL]:'#1a3a5a',[T.LAMPPOST]:'#6a5a20',
      [T.INN_DOOR]:'#c87840',[T.EXIT_INTERIOR]:'#4a8a30',
      [T.TABLE]:'#3a2410',[T.BARREL]:'#3a2208',
      [T.BED]:'#6a3a5a',[T.BOOKSHELF]:'#2a1808',[T.CANDLE]:'#c8922a',
      [T.CHEST]:'#4a2c10',[T.NOTICE_BOARD]:'#5a3810',
      [T.GRAVE]:'#2a2830',[T.FENCE]:'#5a3a10',
      [T.HOUSE_A]:'#5a2a1a',[T.HOUSE_B]:'#2a3a5a',[T.HOUSE_C]:'#3a2a4a',
      [T.FLOWER]:'#3a5030',[T.SIGN]:'#6a4820',[T.BUSH]:'#1a3a10',
      [T.CHAPEL_PORTAL]:'#6a20a0',[T.ALTAR]:'#3a1840',[T.PILLAR]:'#383040',[T.CHAPEL_RUNE]:'#5a1870',
    };
    const def = '#1a2a14';
    for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
      mc.fillStyle = MINI_COLORS[tiles[y][x]] || def;
      mc.fillRect(x*tileW, y*tileH, Math.max(1,tileW), Math.max(1,tileH));
    }
    minimapDirty = false;
  }

  // Stamp cached minimap — single drawImage instead of W*H fillRects
  ctx2.fillStyle='rgba(5,6,8,0.85)';
  ctx2.fillRect(mx-1,my-1,mw+2,mh+2);
  ctx2.strokeStyle='rgba(42,47,58,0.9)'; ctx2.lineWidth=1;
  ctx2.strokeRect(mx-1,my-1,mw+2,mh+2);
  ctx2.drawImage(minimapCanvas, mx, my);

  // Camera viewport rect
  const vx=mx+(camera.x/TILE)*tileW;
  const vy=my+(camera.y/TILE)*tileH;
  const vw=(canvas.width/TILE)*tileW;
  const vh=(canvas.height/TILE)*tileH;
  ctx2.strokeStyle='rgba(200,180,100,0.5)'; ctx2.lineWidth=1;
  ctx2.strokeRect(vx,vy,vw,vh);
  // Player dot
  ctx2.fillStyle='#e8b84b';
  ctx2.fillRect(mx+playerPos.x*tileW-1, my+playerPos.y*tileH-1, 3, 3);
}

function gameLoop(){
  const now = performance.now();
  const lastDt = lastFrameTime > 0 ? Math.min((now - lastFrameTime) / 1000, 0.1) : 0.016;
  // Update water animation at 10fps (saves ~100-200 Math.sin/frame across water tiles)
  if(now - _waterLastUpdate > 100){
    _waterT = now * 0.001;
    _waterLastUpdate = now;
  }
  tickDayNight(now);
  tickEnemies(now);
  tickNpcs(now);
  tickChapelCultists();
  updateHUD();
  if(gameMode==='coop') updateP2HUD();
  Music.tick();
  Weather.tick();
  Fireflies.update(lastDt);
  // Smoothly interpolate remote players toward their last known position
  if(isOnline()) {
    const lf = 0.18;
    for(const rp of remotePlayers.values()) {
      rp.real.x += (rp.pos.x - rp.real.x) * lf;
      rp.real.y += (rp.pos.y - rp.real.y) * lf;
    }
  }
  renderMap();
  requestAnimationFrame(gameLoop);
}

