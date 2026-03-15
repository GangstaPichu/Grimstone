// ========== TITLE CANVAS PARTICLES ==========
(function(){
  const c = document.getElementById('title-canvas');
  const ctx = c.getContext('2d');
  function resize(){ c.width=window.innerWidth; c.height=window.innerHeight; }
  resize(); window.addEventListener('resize',resize);
  const pts = Array.from({length:120},()=>({
    x:Math.random()*window.innerWidth,
    y:Math.random()*window.innerHeight,
    vx:(Math.random()-.5)*.3,
    vy:(Math.random()-.5)*.3,
    r:Math.random()*1.5+.3,
    a:Math.random()
  }));
  function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=c.width; if(p.x>c.width)p.x=0;
      if(p.y<0)p.y=c.height; if(p.y>c.height)p.y=0;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(200,146,42,${p.a*.6})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

// ========== CHAR CREATE BG PARTICLES ==========
(function(){
  const c = document.getElementById('char-bg-canvas');
  const ctx = c.getContext('2d');
  function resize(){ c.width=window.innerWidth; c.height=window.innerHeight; }
  resize(); window.addEventListener('resize',resize);
  const pts = Array.from({length:80},()=>({
    x:Math.random()*window.innerWidth,
    y:Math.random()*window.innerHeight,
    vx:(Math.random()-.5)*.2,
    vy:(Math.random()-.5)*.2,
    r:Math.random()*1.2+.2,
    a:Math.random()*.8
  }));
  function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=c.width; if(p.x>c.width)p.x=0;
      if(p.y<0)p.y=c.height; if(p.y>c.height)p.y=0;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(200,146,42,${p.a*.4})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

