/** Fondo procedural original de «Fintrax Código Error.html»: nebulosa, Tierra y Luna. */
function mkNoise(seed) {
  const P = new Uint8Array(512);
  let s = seed;
  for (let i = 0; i < 256; i++) P[i] = i;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [P[i], P[j]] = [P[j], P[i]];
  }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  function n3(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = x*x*(3-2*x), v = y*y*(3-2*y), q = z*z*(3-2*z);
    const a = P[X]+Y, b = P[X+1]+Y, aa = P[a]+Z, ab = P[a+1]+Z, ba = P[b]+Z, bb = P[b+1]+Z;
    const x00 = P[aa]+(P[ba]-P[aa])*u, x10 = P[ab]+(P[bb]-P[ab])*u;
    const x01 = P[aa+1]+(P[ba+1]-P[aa+1])*u, x11 = P[ab+1]+(P[bb+1]-P[ab+1])*u;
    const y0 = x00+(x10-x00)*v, y1 = x01+(x11-x01)*v;
    return (y0+(y1-y0)*q)/255;
  }
  function fbm(x, y, z, octavas) {
    let suma = 0, amplitud = 0.5, normal = 0;
    for (let i = 0; i < octavas; i++) {
      suma += amplitud*n3(x,y,z); normal += amplitud;
      x = x*2.03+5.2; y = y*2.03+1.7; z = z*2.03+9.1; amplitud *= 0.5;
    }
    return suma/normal;
  }
  return { n3, fbm };
}

function sstep(a, b, x) {
  x = Math.max(0, Math.min(1, (x-a)/(b-a)));
  return x*x*(3-2*x);
}
const mix = (a, b, t) => a+(b-a)*t;

function renderEarth(W, H, cx, cy, R, top, sc) {
  const A = mkNoise(7), B = mkNoise(99), lw = Math.ceil(W*sc), lh = Math.ceil((H-top)*sc);
  const data = new Uint8ClampedArray(lw*lh*4);
  const ct = Math.cos(0.4), st = Math.sin(0.4), cs = Math.cos(0.6), ss = Math.sin(0.6);
  let Lx = 0.78, Ly = -0.3, Lz = 0.55;
  const l = Math.hypot(Lx,Ly,Lz); Lx /= l; Ly /= l; Lz /= l;
  let Hx = Lx, Hy = Ly, Hz = Lz+1;
  const hl = Math.hypot(Hx,Hy,Hz); Hx /= hl; Hy /= hl; Hz /= hl;
  for (let y = 0; y < lh; y++) {
    const dy = (top+y/sc-cy)/R;
    for (let x = 0; x < lw; x++) {
      const dx = (x/sc-cx)/R, r2 = dx*dx+dy*dy;
      if (r2 >= 1) continue;
      const nz = Math.sqrt(1-r2), y1 = dy*ct-nz*st, z1 = dy*st+nz*ct;
      const px = dx*cs+z1*ss, pz = -dx*ss+z1*cs, py = y1;
      const lit = sstep(-0.1,0.4,dx*Lx+dy*Ly+nz*Lz);
      const e = A.fbm(px*1.5,py*1.5,pz*1.5,6), land = e > 0.55;
      const cl = B.fbm(px*2.4+4,py*3.2,pz*2.4,6), cc = sstep(0.46,0.68,cl)*0.85;
      let r, g, b;
      if (land) {
        const m = B.fbm(px*2+9,py*2,pz*2,4), alt = (e-0.55)/0.2;
        const lat = Math.abs(py)+(A.n3(px*6,py*6,pz*6)-0.5)*0.25, gr = sstep(0.42,0.56,m);
        r = mix(150,44,gr); g = mix(128,92,gr); b = mix(86,50,gr);
        const k = sstep(0.55,0.9,alt); r = mix(r,112,k); g = mix(g,102,k); b = mix(b,92,k);
        const sn = Math.max(sstep(0.9,0.98,lat),sstep(0.9,1,alt));
        r = mix(r,234,sn); g = mix(g,242,sn); b = mix(b,248,sn);
        const dt = 0.85+0.3*A.fbm(px*20,py*20,pz*20,2); r *= dt; g *= dt; b *= dt;
      } else {
        const dp = Math.min(1,(0.55-e)/0.2); r = mix(10,2,dp); g = mix(70,18,dp); b = mix(118,48,dp);
        const nh = dx*Hx+dy*Hy+nz*Hz;
        if (nh > 0) { const sp = Math.pow(nh,70)*0.8*(1-cc); r += 190*sp; g += 225*sp; b += 255*sp; }
      }
      const dk = 1-0.5*sstep(0.12,0.55,nz), sh = (0.04+0.72*lit)*dk;
      r *= sh; g *= sh; b *= sh;
      if (land && lit < 0.3) {
        const cty = sstep(0.62,0.8,A.fbm(px*22,py*22,pz*22,3))*(1-lit/0.3)*(1-cc*0.85);
        r += 255*cty; g += 185*cty; b += 95*cty;
      }
      const c2 = (0.06+0.62*lit)*dk;
      r = mix(r,235*c2,cc); g = mix(g,242*c2,cc); b = mix(b,252*c2,cc);
      const rim = Math.pow(1-nz,3.2)*(0.25+0.8*lit); r += 55*rim; g += 140*rim; b += 255*rim;
      const alpha = r2 > 0.9975 ? (1-r2)/0.0025 : 1, i = (y*lw+x)*4;
      data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = alpha*255;
    }
  }
  return { w: lw, h: lh, data };
}

function renderNebula(W, H, sc) {
  const A = mkNoise(3), B = mkNoise(11), lw = Math.ceil(W*sc), lh = Math.ceil(H*sc);
  const data = new Uint8ClampedArray(lw*lh*4), asp = W/H;
  const bx = (0.1-0.9)*asp, by = 1.05, bb = bx*bx+by*by;
  for (let y = 0; y < lh; y++) {
    const v = y/lh;
    for (let x = 0; x < lw; x++) {
      const u = x/lw, ax = (u-0.9)*asp, ay = v+0.05, t = (ax*bx+ay*by)/bb;
      const dd = Math.hypot(ax-bx*t,ay-by*t);
      const q = A.fbm(u*2.6*asp,v*2.6,1,5), wv = A.fbm(u*asp*2.6+q*1.6,v*2.6+q*1.6,3,5);
      const band = Math.exp(-Math.pow(dd/(0.24+0.12*(q-0.5)),2)), dens = band*sstep(0.36,0.68,wv);
      const dust = B.fbm(u*asp*6+q*2,v*6,5,5), lane = sstep(0.55,0.7,dust)*band;
      const hue = B.fbm(u*asp*1.5,v*1.5,8,3), br = dens*(1-0.8*lane), haze = band*0.3*(1-lane*0.6), i = (y*lw+x)*4;
      data[i] = 2+br*(10+34*hue)+haze*5;
      data[i+1] = 5+br*(32+40*(1-hue))+haze*16;
      data[i+2] = 11+br*(80+70*wv)+haze*40; data[i+3] = 255;
    }
  }
  return { w: lw, h: lh, data };
}

function renderMoon(r) {
  const A = mkNoise(21), s = Math.ceil(r*2)+2, data = new Uint8ClampedArray(s*s*4), c = s/2;
  const L = [0.55,0.4,0.73], cr = [];
  let q = 1;
  const rn = () => { q = (q*16807)%2147483647; return q/2147483647; };
  for (let i = 0; i < 36; i++) {
    const a = rn()*6.283, rr = Math.sqrt(rn())*0.85, sz = rn();
    cr.push([Math.cos(a)*rr,Math.sin(a)*rr,0.03+sz*sz*0.11]);
  }
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const nx = (x+0.5-c)/r, ny = (y+0.5-c)/r, r2 = nx*nx+ny*ny;
    if (r2 >= 1) continue;
    const nz = Math.sqrt(1-r2), lit = sstep(-0.05,0.5,nx*L[0]+ny*L[1]+nz*L[2]);
    const mare = sstep(0.5,0.62,A.fbm(nx*2.2+3,ny*2.2,nz*2.2,4));
    let v = mix(128,62,mare*0.9)*(0.88+0.24*A.fbm(nx*14,ny*14,nz*14,3));
    for (const [cx0,cy0,cz] of cr) {
      const cx = nx-cx0, cy = ny-cy0, dd = Math.hypot(cx,cy)/cz;
      if (dd < 0.92) v *= 0.86;
      else if (dd < 1.15) v *= 1.1-0.14*((cx*L[0]+cy*L[1])/(cz*dd));
    }
    const sh = 0.04+0.96*lit, k = r2 > 0.96 ? (1-r2)/0.04 : 1, j = (y*s+x)*4;
    data[j] = v*0.88*sh+5*(1-lit); data[j+1] = v*0.98*sh+16*(1-lit);
    data[j+2] = v*1.1*sh+28*(1-lit); data[j+3] = k*255;
  }
  return { w: s, h: s, data };
}

function toCanvas(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.w; canvas.height = image.h;
  canvas.getContext('2d').putImageData(new ImageData(image.data,image.w,image.h),0,0);
  return canvas;
}

export function crearFondoFintrax(canvas, reduce) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  let w, h, bake, earth, moon, geo, twin, bigs, frame = 0, resizeTimer = 0, cerrado = false;

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1,2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w*dpr; canvas.height = h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.imageSmoothingQuality = 'high';
    const m = Math.min(w,h);
    let seed = 5;
    const rng = () => { seed = (seed*16807)%2147483647; return (seed-1)/2147483646; };
    bake = document.createElement('canvas'); bake.width = w; bake.height = h;
    const b = bake.getContext('2d'); b.imageSmoothingQuality = 'high';
    b.drawImage(toCanvas(renderNebula(w,h,Math.min(0.35,Math.sqrt(260000/(w*h))))),0,0,w,h);
    twin = []; bigs = [];
    for (let i = 0; i < Math.round(w*h/2000); i++) {
      let x, y;
      if (rng() < 0.5) {
        const t = rng(), g = (rng()+rng()+rng()-1.5)*0.16*m;
        x = w*(0.88-0.76*t)+g; y = h*(-0.03+1.03*t)+g*0.5;
      } else { x = rng()*w; y = rng()*h; }
      const mg = Math.pow(rng(),5), sz = 0.35+mg*1.5, al = 0.3+mg*0.7, k = rng();
      const col = k < 0.15 ? '255,205,165' : k < 0.6 ? '225,238,255' : '170,205,255';
      if (mg > 0.55) {
        const gl = b.createRadialGradient(x,y,0,x,y,sz*5);
        gl.addColorStop(0,`rgba(${col},.55)`); gl.addColorStop(1,`rgba(${col},0)`);
        b.fillStyle = gl; b.fillRect(x-sz*5,y-sz*5,sz*10,sz*10);
      }
      b.fillStyle = `rgba(${col},${al.toFixed(2)})`;
      if (sz < 0.8) b.fillRect(x,y,sz+0.3,sz+0.3);
      else { b.beginPath(); b.arc(x,y,sz,0,6.2832); b.fill(); }
      if (mg > 0.3 && mg < 0.75 && twin.length < 90) twin.push({ x,y,s: sz,c: col,p: rng()*6.28,v: 0.5+rng()*1.5 });
      if (mg > 0.8 && bigs.length < 7) bigs.push({ x,y,r: 9+mg*16,p: rng()*6.28 });
    }
    const R = Math.max(w,h)*0.95, cx = w*0.84, cy = h*0.75+R, top = Math.max(0,Math.floor(h*0.75-8));
    earth = toCanvas(renderEarth(w,h,cx,cy,R,top,Math.min(0.7,Math.sqrt(280000/(w*(h-top))))));
    moon = toCanvas(renderMoon(m*0.052));
    geo = { R,cx,cy,top,mx: w*0.14,my: h*0.16 };
  }

  function draw(time) {
    if (cerrado) return;
    const sec = time/1000;
    ctx.drawImage(bake,0,0,w,h);
    for (const s of twin) {
      const a = reduce ? 0.6 : 0.5*(0.5+0.5*Math.sin(sec*s.v+s.p));
      ctx.fillStyle = `rgba(${s.c},${a.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(s.x,s.y,s.s*1.2,0,6.2832); ctx.fill();
    }
    for (const s of bigs) {
      ctx.save(); ctx.globalAlpha = reduce ? 0.8 : 0.6+0.4*Math.sin(sec*0.9+s.p);
      ctx.strokeStyle = 'rgba(190,230,255,.7)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(s.x-s.r,s.y); ctx.lineTo(s.x+s.r,s.y);
      ctx.moveTo(s.x,s.y-s.r); ctx.lineTo(s.x,s.y+s.r); ctx.stroke();
      const g = ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*0.5);
      g.addColorStop(0,'rgba(255,255,255,.9)'); g.addColorStop(1,'rgba(120,190,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x,s.y,s.r*0.5,0,6.2832); ctx.fill(); ctx.restore();
    }
    ctx.drawImage(moon,geo.mx+(reduce ? 0 : Math.sin(sec*0.15)*3)-moon.width/2,geo.my-moon.height/2);
    ctx.drawImage(earth,reduce ? 0 : Math.sin(sec*0.08)*3,geo.top,w,h-geo.top);
    const ag = ctx.createRadialGradient(geo.cx,geo.cy,geo.R*0.992,geo.cx,geo.cy,geo.R*1.03);
    ag.addColorStop(0,'rgba(90,200,255,0)'); ag.addColorStop(0.3,'rgba(110,215,255,.75)'); ag.addColorStop(1,'rgba(40,140,255,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(geo.cx,geo.cy,geo.R*1.03,0,6.2832); ctx.fill();
    ctx.save(); ctx.shadowColor = '#2aa8ff'; ctx.shadowBlur = 26;
    ctx.strokeStyle = 'rgba(150,225,255,.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(geo.cx,geo.cy,geo.R,0,6.2832); ctx.stroke(); ctx.restore();
    if (!reduce) frame = requestAnimationFrame(draw);
  }

  function resize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { build(); if (reduce) draw(0); },150);
  }
  build();
  frame = requestAnimationFrame(draw);
  window.addEventListener('resize',resize);
  return () => {
    cerrado = true;
    cancelAnimationFrame(frame);
    clearTimeout(resizeTimer);
    window.removeEventListener('resize',resize);
    canvas.width = canvas.height = 1;
  };
}
