/* Long Ascent: the illustrated settlement. A small procedural painter on a 2D canvas.
   Everything is drawn in a 360 x 200 space. The sky follows the device clock, the land keeps its history:
   the keep, the cathedral, the harbor and the railway stay as the ages turn.
   The same picture is shown two ways: as the strip at the top of the game, and as the city view, where a
   camera can be moved and brought closer. The people and the work in it are drawn by city.js. */
(function (root) {
  'use strict';
  const W = 360, H = 200, TAU = Math.PI * 2;
  let cv = null, ctx = null, cssW = 0, cssH = 0, dpr = 1;
  let layout = null, layoutSeed = -1, E = null;
  const Scene = { hour: null, still: false, facts: {} };
  const GROUND = 200, SKYTOP = 22;                         // the bottom of the land; how far up the camera may look when close
  const cam = { on: false, z: 0, x: 0, y: 0, pad: 0 };      // city view: screen pixels per unit, and the world point in the top left corner
  let T = { k: 1, ox: 0, oy: 0 };                           // the transform of the last frame, in css pixels: screen = world * k + o
  let sites = [], events = [];

  /* ---------- colour ---------- */
  const mix = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  const dk = function (c, k) { return [c[0] * k, c[1] * k, c[2] * k]; };
  const col = function (c, a) { return a === undefined || a >= 1 ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')' : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; };
  const clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  const NIGHT = [12, 18, 44], WARM = [255, 170, 100], GLOW = [255, 214, 130], CYAN = [120, 222, 255];
  const C = {
    grass: [124, 152, 86], fore: [108, 140, 74], hill: [100, 132, 80], sea: [70, 122, 164], seaFar: [128, 172, 200], sand: [206, 192, 152],
    stone: [182, 176, 162], stoneD: [128, 123, 116], lime: [208, 199, 178], slate: [88, 96, 112], thatch: [152, 122, 64], wattle: [216, 200, 162],
    timber: [112, 80, 50], terra: [188, 94, 62], plaster: [228, 214, 182], brick: [150, 86, 68], concrete: [192, 198, 204], glass: [132, 164, 192],
    pearl: [226, 233, 240], iron: [70, 72, 78], wheat: [214, 190, 110], crop: [142, 172, 92], fallow: [152, 122, 86], leaf: [72, 112, 62], pine: [52, 92, 66]
  };
  const KEYS = [
    { h: 0, top: [10, 16, 36], mid: [20, 31, 63], bot: [37, 52, 92], L: 0.27, warm: 0, star: 1 },
    { h: 5, top: [10, 16, 36], mid: [20, 31, 63], bot: [42, 58, 98], L: 0.27, warm: 0, star: 1 },
    { h: 6.4, top: [58, 74, 122], mid: [201, 137, 123], bot: [243, 201, 139], L: 0.68, warm: 0.7, star: 0.1 },
    { h: 8, top: [98, 152, 204], mid: [158, 198, 228], bot: [218, 234, 242], L: 1, warm: 0.08, star: 0 },
    { h: 16.5, top: [98, 152, 204], mid: [158, 198, 228], bot: [218, 234, 242], L: 1, warm: 0.08, star: 0 },
    { h: 18.4, top: [52, 56, 110], mid: [186, 104, 128], bot: [244, 170, 100], L: 0.62, warm: 0.85, star: 0.12 },
    { h: 20, top: [14, 20, 44], mid: [30, 40, 78], bot: [58, 66, 108], L: 0.32, warm: 0.1, star: 0.9 },
    { h: 24, top: [10, 16, 36], mid: [20, 31, 63], bot: [37, 52, 92], L: 0.27, warm: 0, star: 1 }
  ];
  function makeEnv(hour, age, t) {
    let i = 0; while (i < KEYS.length - 2 && hour >= KEYS[i + 1].h) i++;
    const a = KEYS[i], b = KEYS[i + 1], f = clamp((hour - a.h) / (b.h - a.h), 0, 1);
    const e = { hour: hour, age: age, t: t, L: a.L + (b.L - a.L) * f, warm: a.warm + (b.warm - a.warm) * f, star: a.star + (b.star - a.star) * f,
      top: mix(a.top, b.top, f), mid: mix(a.mid, b.mid, f), bot: mix(a.bot, b.bot, f) };
    const smog = [0, 0, 0, 0.42, 0.16, 0.05][age] || 0;
    if (smog) { const sc = dk([168, 150, 128], 0.3 + 0.7 * e.L); e.top = mix(e.top, sc, smog * 0.5); e.mid = mix(e.mid, sc, smog * 0.75); e.bot = mix(e.bot, sc, smog); }
    e.night = clamp((0.8 - e.L) / 0.55, 0, 1);
    e.haze = mix(e.bot, e.mid, 0.35);
    return e;
  }
  function tone(c, depth) {
    let r = mix(c, NIGHT, (1 - E.L) * 0.78);
    if (E.warm) r = mix(r, WARM, E.warm * 0.13);
    if (depth) r = mix(r, E.haze, depth);
    return r;
  }

  /* ---------- primitives ---------- */
  function R(x, y, w, h, c, a) { ctx.fillStyle = col(c, a); ctx.fillRect(x, y, w, h); }
  function P(p, c, a) { ctx.fillStyle = col(c, a); ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); ctx.fill(); }
  function Ci(x, y, r, c, a) { ctx.fillStyle = col(c, a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  function El(x, y, rx, ry, c, a) { ctx.fillStyle = col(c, a); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }
  function Dome(x, y, rx, ry, c, a) { ctx.fillStyle = col(c, a); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); }
  function Ln(x1, y1, x2, y2, c, w, a) { ctx.strokeStyle = col(c, a); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function win(x, y, w, h, u) {          // a window: dark by day, lit at night
    if (E.night > 0.08 && u < 0.68) R(x, y, w, h, E.age === 5 && u < 0.2 ? CYAN : GLOW, Math.min(1, E.night * 1.25));
    else R(x, y, w, h, tone([58, 60, 74], 0.1), 0.75);
  }
  function smoke(x, y, k, grey, seed) {
    if (Scene.still) return;
    const c = tone(grey ? [96, 92, 90] : [226, 226, 228], 0.2);
    for (let i = 0; i < 5; i++) {
      const ph = ((E.t * 0.07 + i / 5 + seed) % 1 + 1) % 1;
      Ci(x + ph * 12 * k + Math.sin(ph * 5 + seed * 9) * 1.5, y - ph * 15 * k, (1.1 + ph * 3.2) * k, c, (1 - ph) * (grey ? 0.5 : 0.42));
    }
  }

  /* ---------- seeded layout of one world ---------- */
  function makeLayout(seed) {
    const r = Core.mulberry32(4201 + seed * 7717), L = {};
    L.ph = []; for (let i = 0; i < 8; i++) L.ph.push(r() * TAU);
    L.stars = []; for (let i = 0; i < 80; i++) L.stars.push({ x: r() * W, y: 6 + r() * 100, s: 0.35 + r() * 0.6, p: r() * TAU, f: 0.5 + r() });
    L.clouds = []; for (let i = 0; i < 5; i++) L.clouds.push({ x: r() * (W + 140), y: 40 + r() * 34, s: 0.6 + r() * 0.7, v: 0.35 + r() * 0.6 });
    L.glints = []; for (let i = 0; i < 18; i++) L.glints.push({ x: 4 + r() * 126, y: 121 + r() * 27, w: 2 + r() * 5, p: r() * TAU });
    const slots = [];
    const band = function (y, s, x0, x1, step, gapA, gapB, b) {
      for (let x = x0; x <= x1; x += step) { if (x > gapA && x < gapB) continue; slots.push({ x: x + (r() - 0.5) * 3, y: y + r() * 1.6, s: s, u: r(), v: r(), b: b, k: Math.abs(x - 186) + b * 16 + r() * 12 }); }
    };
    band(149, 1, 124, 250, 9, 168, 205, 0); band(141, 0.82, 134, 252, 8, 174, 199, 1); band(133, 0.66, 148, 248, 7, 0, 0, 2);
    L.houses = slots.sort(function (a, b) { return a.k - b.k; });
    L.trees = [];
    const tree = function (x, y, s, kind) { L.trees.push({ x: x, y: y, s: s, kind: kind, u: r() }); };
    for (let i = 0; i < 26; i++) tree(300 + r() * 62, 153 + r() * 42, 0.9 + r() * 0.5, r() < 0.6 ? 1 : 0);      // the forest on the right
    for (let i = 0; i < 9; i++) tree(252 + r() * 100, 108 + r() * 34, 0.55 + r() * 0.25, r() < 0.5 ? 1 : 0);     // hill slopes
    for (let i = 0; i < 6; i++) tree(2 + r() * 22, 153 + r() * 5, 0.8 + r() * 0.3, 0);                           // by the shore
    for (let i = 0; i < 7; i++) tree(150 + r() * 80, 158 + r() * 34, 0.9 + r() * 0.4, 0);                        // meadow
    /* drawn after everything above so that worlds already under way keep their houses and trees where they were */
    L.high = []; for (let i = 0; i < 420; i++) L.high.push({ x: r() * W, y: 104 - r() * 560, s: 0.3 + r() * 0.5, p: r() * TAU, f: 0.5 + r() });     // seen only in the city view
    for (let i = 0; i < 4; i++) L.clouds.push({ x: r() * (W + 140), y: -70 + r() * 90, s: 0.8 + r() * 0.9, v: 0.25 + r() * 0.4 });
    return L;
  }

  /* ---------- sky ---------- */
  function sky() {
    const g = ctx.createLinearGradient(0, -110, 0, 124);
    g.addColorStop(0, col(E.top)); g.addColorStop(0.62, col(E.mid)); g.addColorStop(1, col(E.bot));
    ctx.fillStyle = g; ctx.fillRect(0, -130, W, 256);
    if (E.star > 0.02) for (const list of E.city ? [layout.stars, layout.high] : [layout.stars]) for (const s of list) {
      if (s.y < E.y0 - 2 || s.x < E.x0 - 2 || s.x > E.x1 + 2) continue;
      const tw = Scene.still ? 0.8 : 0.55 + 0.45 * Math.sin(E.t * s.f + s.p);
      Ci(s.x, s.y, s.s, [236, 240, 255], E.star * tw * 0.9);
    }
    const h = E.hour;
    if (h > 5.6 && h < 19) {
      const f = (h - 5.6) / 13.4, x = 24 + f * 312, y = 112 - Math.sin(f * Math.PI) * 64, c = mix([255, 244, 214], [255, 190, 120], E.warm);
      Ci(x, y, 22, c, 0.12); Ci(x, y, 13, c, 0.2); Ci(x, y, 7.5, c, 1);
      E.sunX = x;
    } else {
      const f = ((h + 24 - 19) % 24) / 10.6, x = 40 + f * 280, y = 108 - Math.sin(clamp(f, 0, 1) * Math.PI) * 56;
      Ci(x, y, 16, [214, 224, 255], 0.08); Ci(x, y, 6.5, [232, 236, 248], 1); Ci(x + 2.6, y - 1.4, 5.6, E.top, 0.94);
      E.sunX = x;
    }
    for (const c of layout.clouds) {
      const x = ((c.x + (Scene.still ? 0 : E.t * c.v)) % (W + 140)) - 70, cc = mix(tone([250, 250, 252], 0), E.mid, 0.22), a = 0.5 + 0.35 * E.L;
      El(x, c.y, 22 * c.s, 5.5 * c.s, cc, a); El(x - 9 * c.s, c.y - 3.5 * c.s, 11 * c.s, 5 * c.s, cc, a); El(x + 8 * c.s, c.y - 4.5 * c.s, 13 * c.s, 6 * c.s, cc, a);
    }
    if (E.age >= 5 && E.star > 0.2 && !Scene.still) {            // a satellite crossing
      const f = (E.t * 0.02) % 1; Ci(-10 + f * 380, 26 + f * 16, 0.9, [255, 255, 255], 0.9 * E.star);
    }
    if (E.age >= 4 && !Scene.still) {                             // an airliner now and then
      const f = (E.t * 0.012 + 0.3) % 1;
      if (f < 0.42) {
        const x = -30 + f / 0.42 * 420, y = 46 - f * 26;
        Ln(x - 46, y + 2.6, x - 4, y + 0.2, [255, 255, 255], 1.1, 0.28 * E.L + 0.05);
        P([x - 4, y + 0.6, x + 3, y - 0.4, x - 3.4, y - 0.8], tone([236, 238, 242], 0.1));
        if (E.night > 0.3 && Math.sin(E.t * 5) > 0) Ci(x, y, 0.9, [255, 80, 70], 1);
      }
    }
  }
  function ridge(base, amp, k, c, dep, foot) {
    const p = [0, foot];
    for (let x = 0; x <= W; x += 6) {
      const n = Math.sin(x * 0.011 + layout.ph[k]) * 0.5 + Math.sin(x * 0.027 + layout.ph[k + 1]) * 0.3 + Math.sin(x * 0.063 + layout.ph[k + 2]) * 0.15 + Math.sin(x * 0.13 + layout.ph[k + 3]) * 0.05;
      p.push(x, base - amp * (0.5 + 0.5 * n));
    }
    p.push(W, foot); P(p, tone(c, dep));
  }

  /* ---------- far shore: the reactor and the Ark ---------- */
  function coolingTower(x, y, h, w) {
    const c = tone([204, 204, 200], 0.42);
    ctx.fillStyle = col(c); ctx.beginPath(); ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x - w * 0.22, y - h * 0.6, x - w * 0.34, y - h); ctx.lineTo(x + w * 0.34, y - h);
    ctx.quadraticCurveTo(x + w * 0.22, y - h * 0.6, x + w / 2, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col(tone([170, 170, 168], 0.42)); ctx.beginPath(); ctx.moveTo(x + w * 0.1, y);
    ctx.quadraticCurveTo(x + w * 0.16, y - h * 0.6, x + w * 0.1, y - h); ctx.lineTo(x + w * 0.34, y - h);
    ctx.quadraticCurveTo(x + w * 0.22, y - h * 0.6, x + w / 2, y); ctx.closePath(); ctx.fill();
  }
  function reactor(st) {
    if (st < 1) return;
    const y = 115.5;
    if (st === 1) { coolingTower(22, y, 11, 15); Ln(33, y, 33, y - 22, tone(C.iron, 0.4), 0.8); Ln(27, y - 22, 40, y - 22, tone(C.iron, 0.4), 0.8); return; }
    coolingTower(22, y, 23, 15); coolingTower(40, y, 20, 13);
    if (st >= 3) { Dome(56, y, 6, 7.5, tone([214, 214, 210], 0.42)); R(50, y - 2.5, 12, 2.5, tone([190, 190, 186], 0.42)); }
    if (st >= 4) { R(63, y - 5, 15, 5, tone([186, 188, 190], 0.42)); R(63, y - 5.8, 15, 1, tone([120, 126, 134], 0.42)); for (let i = 0; i < 5; i++) win(64.5 + i * 2.8, y - 3.6, 1.5, 1.4, (i * 0.37) % 1); }
    if (st >= 5) {
      smoke(22, y - 24, 2.1, false, 0.13); smoke(40, y - 21, 1.8, false, 0.61);
      const pc = tone(C.iron, 0.38);
      for (const px of [86, 108, 128]) { Ln(px - 2, 117, px, 106, pc, 0.6); Ln(px + 2, 117, px, 106, pc, 0.6); Ln(px - 2.6, 108.5, px + 2.6, 108.5, pc, 0.6); }
      ctx.strokeStyle = col(pc, 0.7); ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(78, 111);
      ctx.quadraticCurveTo(82, 110.5, 86, 108.5); ctx.quadraticCurveTo(97, 112, 108, 108.5); ctx.quadraticCurveTo(118, 112, 128, 108.5); ctx.quadraticCurveTo(139, 113, 150, 116); ctx.stroke();
    }
  }
  function ark(st, lift) {
    if (st < 1) return;
    const x = 98, y = 115.5 - (lift || 0), gc = tone([150, 70, 60], 0.36), gy = 115.5;
    for (let i = 0; i < 9; i++) { Ln(x - 9, gy - i * 5, x - 5, gy - i * 5 - 5, gc, 0.5); Ln(x - 5, gy - i * 5, x - 9, gy - i * 5 - 5, gc, 0.5); }
    Ln(x - 9, gy, x - 9, gy - 46, gc, 0.8); Ln(x - 5, gy, x - 5, gy - 46, gc, 0.8);
    if (!lift) { Ln(x - 5, gy - 30, x - 2, gy - 30, gc, 0.8); Ln(x - 5, gy - 14, x - 2, gy - 14, gc, 0.8); }
    R(x - 14, gy - 1.5, 26, 1.5, tone(C.concrete, 0.36));
    if (st >= 2) {
      const body = tone([236, 238, 242], 0.3), shade = tone([186, 192, 204], 0.3);
      if (st >= 4) { R(x - 5, y - 17, 2.4, 16, shade); R(x + 2.6, y - 17, 2.4, 16, shade); P([x - 5, y - 17, x - 3.8, y - 20.5, x - 2.6, y - 17], shade); P([x + 2.6, y - 17, x + 3.8, y - 20.5, x + 5, y - 17], shade); }
      R(x - 2.6, y - 31, 5.2, 30, body); R(x + 0.6, y - 31, 2, 30, shade);
      R(x - 2.6, y - 12, 5.2, 1.4, tone([40, 44, 54], 0.3)); R(x - 2.6, y - 24, 5.2, 1.4, tone([40, 44, 54], 0.3));
      if (st >= 3) { R(x - 4.2, y - 37.5, 8.4, 6.5, body); R(x + 1.2, y - 37.5, 3, 6.5, shade); P([x - 4.2, y - 37.5, x, y - 47, x + 4.2, y - 37.5], body); P([x + 0.8, y - 37.5, x, y - 47, x + 4.2, y - 37.5], shade); for (let i = 0; i < 3; i++) win(x - 3.2 + i * 2.4, y - 35.6, 1.2, 1.2, 0.1 + i * 0.25); }
      else P([x - 2.6, y - 31, x, y - 36, x + 2.6, y - 31], body);
      if (st >= 4) P([x - 2.6, y - 1, x - 3.6, y + 1.2, x + 3.6, y + 1.2, x + 2.6, y - 1], tone([70, 74, 86], 0.3));
    }
    if (st >= 5 && !lift) { smoke(x + 4, gy - 2, 1.2, false, 0.4); if (E.night > 0.2 && Math.sin(E.t * 3) > 0) Ci(x - 7, gy - 47, 1, [255, 70, 60], 1); }
    if (lift) {
      const f = 0.7 + 0.3 * Math.sin(E.t * 40);
      P([x - 3.4, y + 1, x, y + 14 + 8 * f, x + 3.4, y + 1], [255, 190, 90], 0.95); P([x - 1.8, y + 1, x, y + 8 + 4 * f, x + 1.8, y + 1], [255, 250, 220], 1);
      Ci(x, y + 4, 12 + 4 * f, [255, 200, 120], 0.16);
      for (let i = 0; i < 9; i++) { const ph = (i / 9 + E.t * 0.6) % 1; Ci(x + (i % 2 ? 1 : -1) * ph * 16, gy - 2 - ph * 4, 3 + ph * 7, tone([232, 232, 236], 0.2), (1 - ph) * 0.6); }
    }
  }

  /* ---------- the bay: sea, railway viaduct, harbor, ships ---------- */
  function sea() {
    const g = ctx.createLinearGradient(0, 118, 0, 154);
    g.addColorStop(0, col(tone(C.seaFar, 0.3))); g.addColorStop(1, col(tone(C.sea, 0.06)));
    ctx.fillStyle = g; ctx.fillRect(0, 118.6, 154, 37);
    const sx = clamp(E.sunX || 60, 6, 124), lc = E.hour > 5.6 && E.hour < 19 ? mix([255, 244, 214], [255, 190, 120], E.warm) : [220, 228, 250];
    for (let i = 0; i < 9; i++) { const y = 120 + i * 3.4, w = 5 + i * 1.7 + (Scene.still ? 0 : Math.sin(E.t * 1.3 + i) * 1.5); R(sx - w / 2, y, w, 0.8, lc, 0.3 * (E.L < 0.5 ? 0.6 : 1)); }
    for (const gl of layout.glints) { const a = Scene.still ? 0.2 : 0.14 + 0.14 * Math.sin(E.t * 0.9 + gl.p); R(gl.x, gl.y, gl.w, 0.6, [255, 255, 255], a * (0.4 + 0.6 * E.L)); }
  }
  function viaduct(st, done) {
    const c = tone(E.age >= 4 ? [168, 166, 160] : [164, 142, 124], 0.26), cd = tone([120, 104, 92], 0.26), deck = 128;
    if (st === 1) { for (const x of [118, 126, 133]) { Ln(x, 131, x, 126.5, tone(C.timber, 0.2), 0.5); P([x, 126.5, x + 2.4, 127.3, x, 128.1], tone([190, 60, 50], 0.2)); } return; }
    if (st < 2) return;
    for (let x = -4; x < 128; x += 12) {
      ctx.fillStyle = col(c); ctx.beginPath(); ctx.moveTo(x, deck + 1.6); ctx.lineTo(x + 12, deck + 1.6); ctx.lineTo(x + 12, deck + 9.5); ctx.lineTo(x + 10.6, deck + 9.5); ctx.lineTo(x + 10.6, deck + 6.6);
      ctx.arc(x + 6, deck + 6.6, 4.6, 0, Math.PI, true); ctx.lineTo(x + 1.4, deck + 9.5); ctx.lineTo(x, deck + 9.5); ctx.closePath(); ctx.fill();
      R(x + 10.6, deck + 1.6, 1.4, 8, cd, 0.5);
    }
    R(-4, deck, 138, 1.7, c); R(-4, deck - 0.5, 138, 0.6, cd);
    if (st >= 3) {                                                        // the terminus
      const bc = tone(C.brick, 0.2); R(131, 122.5, 15, 7.5, bc); R(140, 122.5, 6, 7.5, dk(bc, 0.86));
      P([130, 122.5, 138.5, 118.5, 147, 122.5], tone(C.slate, 0.2)); R(136.8, 115.5, 3.4, 4, bc); P([136.2, 115.5, 138.5, 112.6, 140.8, 115.5], tone(C.slate, 0.2));
      Ci(138.5, 117.4, 0.9, [240, 236, 220], 1); for (let i = 0; i < 4; i++) win(132.4 + i * 3.4, 125, 1.6, 2.6, 0.2 + i * 0.13);
    }
    if (done && !Scene.still) {                                           // the train
      const f = (E.t * 0.028) % 1;
      if (f < 0.5) {
        const x = -44 + f / 0.5 * 172, y = deck - 0.5, steam = E.age === 3;
        ctx.save(); ctx.beginPath(); ctx.rect(-10, 100, 141, 40); ctx.clip();
        for (let i = 0; i < 4; i++) { R(x - 10 - i * 8.6, y - 3.2, 7.8, 3.2, tone(steam ? [122, 52, 46] : [230, 234, 238], 0.22)); if (!steam) R(x - 10 - i * 8.6, y - 2.2, 7.8, 0.8, tone([40, 90, 160], 0.2)); else for (let k = 0; k < 3; k++) win(x - 9.2 - i * 8.6 + k * 2.5, y - 2.5, 1.3, 1, 0.3); }
        if (steam) { R(x - 1, y - 3.4, 8.5, 3.4, tone([36, 38, 44], 0.2)); R(x + 4.6, y - 5.6, 1.5, 2.4, tone([36, 38, 44], 0.2)); R(x - 1, y - 5, 3, 1.8, tone([36, 38, 44], 0.2)); smoke(x + 4, y - 6, 1.1, false, 0.2); }
        else { P([x - 1, y - 3.2, x + 6, y - 3.2, x + 10, y, x - 1, y], tone([230, 234, 238], 0.2)); R(x + 3, y - 2.4, 3.4, 0.9, tone([40, 60, 90], 0.2)); }
        ctx.restore();
      }
    }
  }
  function sailShip(x, y, s, u, sail) {
    const b = Scene.still ? 0 : Math.sin(E.t * 0.8 + u * 9) * 0.5; y += b;
    P([x - 7 * s, y - 2.2 * s, x + 7.5 * s, y - 2.2 * s, x + 5.5 * s, y, x - 5.5 * s, y], tone([92, 62, 44], 0.14));
    R(x - 6.4 * s, y - 3 * s, 2.6 * s, 0.9 * s, tone([92, 62, 44], 0.14));
    const sc = tone(sail || [238, 228, 204], 0.12);
    for (const m of [[-2.6, 9], [2.4, 11]]) {
      Ln(x + m[0] * s, y - 2.2 * s, x + m[0] * s, y - (m[1] + 3) * s, tone(C.timber, 0.14), 0.45 * s);
      P([x + (m[0] - 2.5) * s, y - 3.4 * s, x + (m[0] + 2.7) * s, y - 3.4 * s, x + (m[0] + 2.1) * s, y - (m[1] * 0.62 + 2) * s, x + (m[0] - 1.9) * s, y - (m[1] * 0.62 + 2) * s], sc);
      P([x + (m[0] - 1.7) * s, y - (m[1] * 0.62 + 2.6) * s, x + (m[0] + 1.9) * s, y - (m[1] * 0.62 + 2.6) * s, x + (m[0] + 1.4) * s, y - (m[1] + 1.6) * s, x + (m[0] - 1.3) * s, y - (m[1] + 1.6) * s], sc);
    }
    P([x + 2.4 * s, y - 14 * s, x + 5 * s, y - 13.3 * s, x + 2.4 * s, y - 12.6 * s], tone(sail ? [20, 20, 24] : [170, 44, 38], 0.12));
  }
  function steamer(x, y, s, u) {
    const b = Scene.still ? 0 : Math.sin(E.t * 0.7 + u * 7) * 0.4; y += b;
    P([x - 10 * s, y - 2.6 * s, x + 11 * s, y - 2.6 * s, x + 8.5 * s, y, x - 8.5 * s, y], tone([44, 46, 56], 0.14)); R(x - 8.5 * s, y - 0.8 * s, 17 * s, 0.8 * s, tone([150, 52, 44], 0.14));
    R(x - 5 * s, y - 4.6 * s, 9 * s, 2 * s, tone([226, 222, 210], 0.14)); R(x - 1.4 * s, y - 8.4 * s, 2.4 * s, 3.8 * s, tone([40, 40, 48], 0.14)); R(x - 1.4 * s, y - 7.4 * s, 2.4 * s, 0.9 * s, tone([186, 60, 48], 0.14));
    for (let i = 0; i < 4; i++) win(x - 4.2 * s + i * 2.1 * s, y - 4 * s, 1 * s, 0.9 * s, 0.2 + i * 0.1);
    smoke(x - 0.2 * s, y - 8.6 * s, 0.9 * s, true, u);
  }
  function freighter(x, y, s, u) {
    const b = Scene.still ? 0 : Math.sin(E.t * 0.6 + u * 5) * 0.3; y += b;
    P([x - 13 * s, y - 2.6 * s, x + 14 * s, y - 2.6 * s, x + 12 * s, y, x - 12 * s, y], tone([34, 56, 96], 0.14)); R(x - 12 * s, y - 0.7 * s, 24 * s, 0.7 * s, tone([150, 52, 44], 0.14));
    const box = [[198, 84, 60], [70, 124, 168], [214, 170, 80], [96, 150, 110], [180, 180, 186]];
    for (let i = 0; i < 6; i++) for (let k = 0; k < 2; k++) R(x - 7.6 * s + i * 3.1 * s, y - (4.3 + k * 1.6) * s, 2.8 * s, 1.5 * s, tone(box[(i * 3 + k * 2) % 5], 0.14));
    R(x - 12 * s, y - 6.6 * s, 3.4 * s, 4 * s, tone([232, 234, 238], 0.14)); for (let i = 0; i < 2; i++) win(x - 11.5 * s + i * 1.6 * s, y - 6 * s, 1 * s, 0.8 * s, 0.3);
  }
  function harbor(st, age) {
    const sc = tone(C.stone, 0.14), sd = tone(C.stoneD, 0.14);
    if (st >= 1) { P([26, 152, 52, 146.6, 82, 141.6, 84, 143.6, 54, 149.4, 30, 154], sc); P([28, 153.2, 54, 148.4, 84, 143, 84, 143.8, 54, 149.6, 30, 154.2], sd, 0.6); }
    if (age >= 2 || st >= 1) sailShip(44, 138.6, 0.9, 0.2);
    if (st >= 2) sailShip(98, 136.5, 0.72, 0.7);
    if (age >= 3) steamer(66, 134.5, 0.8, 0.4);
    if (age >= 4) freighter(34, 131, 0.82, 0.9);
    if (st >= 4) {                                                        // the lighthouse
      const x = 82, y = 142.6;
      if (E.night > 0.25 && !Scene.still) { const a = E.t * 0.7, bx = Math.cos(a), w = 0.12; ctx.fillStyle = col([255, 238, 190], 0.075 * E.night * (0.4 + 0.6 * Math.abs(bx))); ctx.beginPath(); ctx.moveTo(x, y - 27); ctx.lineTo(x + bx * 150, y - 27 - 150 * w - 10); ctx.lineTo(x + bx * 150, y - 27 + 150 * w - 10); ctx.closePath(); ctx.fill(); }
      P([x - 3, y, x - 1.9, y - 25, x + 1.9, y - 25, x + 3, y], tone([238, 234, 224], 0.12)); P([x + 0.6, y, x + 0.5, y - 25, x + 1.9, y - 25, x + 3, y], tone([200, 196, 188], 0.12));
      R(x - 2.4, y - 10.5, 4.8, 3.4, tone([176, 54, 44], 0.12)); R(x - 2.1, y - 19.5, 4.2, 3, tone([176, 54, 44], 0.12));
      R(x - 2.7, y - 25.8, 5.4, 1, sd); R(x - 1.5, y - 28.6, 3, 2.8, E.night > 0.1 ? GLOW : tone([210, 226, 236], 0.1)); P([x - 2.2, y - 28.6, x, y - 31.4, x + 2.2, y - 28.6], tone([120, 46, 40], 0.12));
      if (E.night > 0.1) Ci(x, y - 27.2, 5, GLOW, 0.22 * E.night);
    }
  }
  function quays(st) {
    if (st < 2) return;
    P([104, 153.4, 112, 142, 124, 130, 127, 130.6, 115.5, 142.6, 108, 153.6], tone(C.stone, 0.16)); for (let i = 0; i < 5; i++) R(106.6 + i * 3.6, 150.4 - i * 4.6, 0.9, 1.3, tone(C.stoneD, 0.16));
  }
  function arsenal() {
    const x = 117, y = 143.4, pc = tone(C.plaster, 0.16);
    R(x, y - 6.5, 17, 6.5, pc); R(x + 10, y - 6.5, 7, 6.5, dk(pc, 0.88)); P([x - 1, y - 6.5, x + 8.5, y - 10.5, x + 18, y - 6.5], tone(C.terra, 0.16));
    for (let i = 0; i < 4; i++) { R(x + 1.6 + i * 3.9, y - 3.6, 2.4, 3.6, tone([56, 50, 54], 0.16)); Dome(x + 2.8 + i * 3.9, y - 3.6, 1.2, 1.3, tone([56, 50, 54], 0.16)); }
  }

  /* ---------- land ---------- */
  function midland() {
    const gc = [null, C.grass, [128, 152, 90], [118, 132, 94], [112, 136, 100], [104, 138, 112]][E.age];
    P([104, 153.5, 112, 142, 124, 130, 138, 123.4, 153, 120.9, 175, 121.5, 215, 122, 245, 117, 272, 106, 296, 97.5, 314, 94.5, 336, 97.5, 360, 104, 360, 156, 104, 156], tone(gc, 0.16));
    P([228, 156, 240, 124, 252, 115, 272, 106, 296, 97.5, 314, 94.5, 336, 97.5, 360, 104, 360, 156], tone(dk(gc, 0.9), 0.13));
    P([300, 156, 312, 120, 320, 100, 336, 97.5, 360, 104, 360, 156], tone(dk(gc, 0.8), 0.11));
  }
  function foreland() {
    const gc = [null, C.fore, [112, 142, 78], [104, 122, 82], [100, 128, 88], [94, 130, 100]][E.age];
    const g = ctx.createLinearGradient(0, 150, 0, 200); g.addColorStop(0, col(tone(gc, 0.07))); g.addColorStop(1, col(tone(dk(gc, 0.78), 0)));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 151.6); ctx.quadraticCurveTo(50, 149.6, 104, 153.2); ctx.lineTo(150, 152.4); ctx.lineTo(360, 152); ctx.lineTo(360, 290); ctx.lineTo(0, 290); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = col(tone(C.sand, 0.08)); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(0, 151.8); ctx.quadraticCurveTo(50, 149.8, 104, 153.4); ctx.stroke();
    const paving = tone([null, [176, 154, 116], [186, 170, 136], [150, 146, 140], [98, 100, 106], [198, 206, 214]][E.age], 0.07);   // the street along the town front
    ctx.fillStyle = col(paving); ctx.beginPath(); ctx.moveTo(110, 151.5); ctx.lineTo(256, 151); ctx.quadraticCurveTo(259, 152.7, 256, 154.4); ctx.lineTo(110, 154.7); ctx.quadraticCurveTo(106.5, 153.1, 110, 151.5); ctx.closePath(); ctx.fill();
    if (E.age === 3 && E.z > 2) for (let x = 112; x < 256; x += 3) Ln(x, 151.6, x - 0.6, 154.5, dk(paving, 0.9), 0.12, 0.6);       // setts
    if (E.age >= 4) { ctx.strokeStyle = col(E.age === 5 ? CYAN : [240, 236, 200], E.age === 5 ? 0.5 : 0.55); ctx.lineWidth = 0.25; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(112, 153.05); ctx.lineTo(255, 152.7); ctx.stroke(); ctx.setLineDash([]); }
    const road = tone(E.age >= 4 ? [96, 98, 104] : [184, 164, 124], 0.05);                         // the road out of town
    ctx.strokeStyle = col(road); ctx.lineWidth = E.age >= 4 ? 3.2 : 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(176, 152.5); ctx.bezierCurveTo(178, 166, 206, 172, 198, 201); ctx.lineTo(197, 290); ctx.stroke(); ctx.lineCap = 'butt';
    if (E.age >= 4) { ctx.strokeStyle = col([240, 236, 200], 0.6); ctx.lineWidth = 0.4; ctx.setLineDash([2.5, 2.5]); ctx.beginPath(); ctx.moveTo(176, 152.5); ctx.bezierCurveTo(178, 166, 206, 172, 198, 201); ctx.stroke(); ctx.setLineDash([]); }
  }
  function tree(t, dep) {
    const s = t.s, x = t.x, y = t.y;
    if (t.kind === 1) { R(x - 0.5 * s, y - 2.5 * s, 1 * s, 2.5 * s, tone(C.timber, dep)); const c = tone(dk(C.pine, 0.9 + t.u * 0.25), dep); P([x - 3.4 * s, y - 2 * s, x, y - 8 * s, x + 3.4 * s, y - 2 * s], c); P([x - 2.6 * s, y - 5.4 * s, x, y - 11.4 * s, x + 2.6 * s, y - 5.4 * s], c); }
    else { R(x - 0.6 * s, y - 3.4 * s, 1.2 * s, 3.4 * s, tone(C.timber, dep)); const c = tone(dk(C.leaf, 0.9 + t.u * 0.3), dep); Ci(x, y - 6.2 * s, 3.6 * s, c); Ci(x - 2.2 * s, y - 4.6 * s, 2.5 * s, c); Ci(x + 2.3 * s, y - 4.8 * s, 2.6 * s, dk(c, 0.92)); }
  }

  /* ---------- houses of the town, one style per age ---------- */
  function house(kind, h) {
    const x = h.x, y = h.y, s = h.s, u = h.u, v = h.v, dep = 0.1 + h.b * 0.055;
    if (kind === 1) {
      const w = (8 + 3 * u) * s, ht = 4.4 * s, wc = tone(C.wattle, dep);
      R(x - w / 2, y - ht, w, ht, wc); R(x + w * 0.1, y - ht, w * 0.4, ht, dk(wc, 0.86));
      P([x - w / 2 - s, y - ht, x - w * 0.16, y - ht - 5 * s, x + w * 0.16, y - ht - 5 * s, x + w / 2 + s, y - ht], tone(dk(C.thatch, 0.9 + v * 0.2), dep));
      R(x - w * 0.32, y - 2.5 * s, 1.5 * s, 2.5 * s, tone(dk(C.timber, 0.7), dep)); win(x + w * 0.08, y - ht * 0.82, 1.5 * s, 1.4 * s, v);
      if (v < 0.3) smoke(x + w * 0.1, y - ht - 5 * s, 0.6 * s, false, u);
    } else if (kind === 2) {
      const w = (6 + 2.4 * u) * s, ht = (8.5 + 5 * v) * s, wc = tone(mix(C.plaster, [214, 178, 136], u), dep);
      R(x - w / 2, y - ht, w, ht, wc); R(x + w * 0.12, y - ht, w * 0.38, ht, dk(wc, 0.87));
      P([x - w / 2 - 0.6 * s, y - ht, x, y - ht - 4.4 * s, x + w / 2 + 0.6 * s, y - ht], tone(dk(C.terra, 0.88 + v * 0.22), dep));
      for (let r = 0; r < Math.floor(ht / (3.4 * s)); r++) for (let c = 0; c < 2; c++) win(x - w * 0.3 + c * w * 0.42, y - ht + 1.4 * s + r * 3.3 * s, 1.3 * s, 1.7 * s, (u * 7 + v * 3 + r * 0.31 + c * 0.17) % 1);
    } else if (kind === 3) {
      const w = (8 + 2.5 * u) * s, ht = (8 + 3.5 * v) * s, wc = tone(dk(C.brick, 0.9 + u * 0.2), dep);
      R(x - w / 2, y - ht, w, ht, wc); R(x + w * 0.12, y - ht, w * 0.38, ht, dk(wc, 0.86));
      P([x - w / 2 - 0.5 * s, y - ht, x - w * 0.3, y - ht - 3 * s, x + w * 0.3, y - ht - 3 * s, x + w / 2 + 0.5 * s, y - ht], tone(C.slate, dep));
      R(x + w * 0.16, y - ht - 5.4 * s, 1.5 * s, 4 * s, dk(wc, 0.8));
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) win(x - w * 0.38 + c * w * 0.3, y - ht + 1.3 * s + r * 3.2 * s, 1.2 * s, 1.7 * s, (u * 5 + v * 9 + r * 0.37 + c * 0.21) % 1);
      if (v < 0.4) smoke(x + w * 0.2, y - ht - 5.6 * s, 0.6 * s, true, v);
    } else if (kind === 4) {
      const w = (9 + 4 * u) * s, ht = (12 + 17 * v) * s, wc = tone(u < 0.5 ? C.concrete : mix(C.glass, C.concrete, 0.35), dep);
      R(x - w / 2, y - ht, w, ht, wc); R(x + w * 0.16, y - ht, w * 0.34, ht, dk(wc, 0.86)); R(x - w * 0.2, y - ht - 1.6 * s, w * 0.4, 1.6 * s, dk(wc, 0.8));
      for (let r = 0; r < Math.floor((ht - 2 * s) / (3 * s)); r++) for (let c = 0; c < Math.floor(w / (2.6 * s)); c++) win(x - w / 2 + 1 * s + c * 2.6 * s, y - ht + 1.6 * s + r * 3 * s, 1.5 * s, 1.5 * s, (u * 11 + v * 5 + r * 0.29 + c * 0.43) % 1);
    } else {
      const w = (5 + 3 * u) * s, ht = (20 + 24 * v) * s, wc = tone(C.pearl, dep);
      if (u > 0.82) { Dome(x, y, w * 1.3, w * 1.1, wc); Dome(x + w * 0.3, y, w * 0.9, w * 1.05, dk(wc, 0.88)); Ln(x - w * 1.3, y, x + w * 1.3, y, tone(CYAN, dep), 0.5 * s, 0.7); return; }
      P([x - w / 2, y, x - w * 0.36, y - ht, x + w * 0.36, y - ht, x + w / 2, y], wc); P([x + w * 0.1, y, x + w * 0.08, y - ht, x + w * 0.36, y - ht, x + w / 2, y], dk(wc, 0.86));
      P([x - w * 0.36, y - ht, x, y - ht - 5 * s, x + w * 0.36, y - ht], wc); Ln(x, y - ht - 5 * s, x, y - ht - 9 * s, tone(C.iron, dep), 0.4 * s);
      R(x - 0.3 * s, y - ht, 0.6 * s, ht, E.night > 0.1 ? CYAN : tone([150, 190, 214], dep), E.night > 0.1 ? 0.9 : 0.7);
      for (let r = 0; r < Math.floor(ht / (4 * s)); r++) win(x - w * 0.3, y - ht + 2 * s + r * 4 * s, 1 * s, 1.4 * s, (u * 3 + r * 0.41) % 1);
    }
  }

  /* ---------- landmarks ---------- */
  function keep() {
    const x = 310, y = 95.5, c = tone(C.stone, 0.24), cd = dk(c, 0.84);
    R(x - 17, y - 6.5, 34, 7.5, c); R(x + 4, y - 6.5, 13, 7.5, cd); for (let i = 0; i < 8; i++) R(x - 17 + i * 4.4, y - 8.2, 2.4, 1.8, c);
    R(x - 6, y - 21, 12, 22, c); R(x + 1, y - 21, 5, 22, cd); for (let i = 0; i < 4; i++) R(x - 6.6 + i * 3.6, y - 23, 2.3, 2.2, c);
    R(x + 11, y - 12.5, 6.5, 13.5, c); R(x + 14.5, y - 12.5, 3, 13.5, cd); for (let i = 0; i < 2; i++) R(x + 10.6 + i * 4, y - 14, 2.6, 1.7, c);
    win(x - 2.6, y - 16, 1.1, 2.6, 0.2); win(x + 1.6, y - 10, 1.1, 2.6, 0.9); win(x + 13, y - 8, 1, 2, 0.4);
    Ln(x, y - 23, x, y - 31, tone(C.timber, 0.2), 0.5);
    const fl = Scene.still ? 0 : Math.sin(E.t * 2.4) * 0.9; P([x, y - 31, x + 6, y - 29.6 + fl, x, y - 27.6], tone([176, 44, 36], 0.16));
  }
  function cathedral(st) {
    const x = 186, y = 150.5, c = tone(C.lime, 0.12), cd = dk(c, 0.86), rf = tone(C.slate, 0.12), tb = tone(C.timber, 0.12);
    if (st < 1) { for (const sx of [174, 184, 196]) Ln(sx, y, sx, y - 4, tb, 0.5); R(200, y - 1.6, 3, 1.6, cd); return; }
    if (st === 1) {
      R(x - 13, y - 3, 34, 3, c); R(x + 6, y - 3, 15, 3, cd); R(x - 13, y - 6, 5, 6, c);
      for (const sx of [x - 14, x - 6, x + 8, x + 22]) Ln(sx, y, sx, y - 11, tb, 0.5); Ln(x - 14, y - 7, x + 22, y - 7, tb, 0.4); Ln(x - 14, y - 11, x + 22, y - 11, tb, 0.4);
      return;
    }
    R(x - 4, y - 17, 25, 17, c); R(x + 9, y - 17, 12, 17, cd);                                   // nave
    P([x - 5, y - 17, x - 1, y - 24.5, x + 18, y - 24.5, x + 22, y - 17], rf);
    R(x + 5, y - 21, 7, 21, c); R(x + 9, y - 21, 3, 21, cd); P([x + 4, y - 21, x + 8.5, y - 28, x + 13, y - 21], rf);   // transept
    R(x + 21, y - 12, 3.4, 12, cd); P([x + 20.6, y - 12, x + 22.7, y - 15.6, x + 24.8, y - 12], rf);                    // apse
    for (let i = 0; i < 4; i++) { const wx = x - 1.6 + i * 5 + (i > 1 ? 4 : 0); win(wx, y - 12.5, 1.5, 6, 0.1 + i * 0.12); P([wx, y - 12.5, wx + 0.75, y - 14.3, wx + 1.5, y - 12.5], tone([58, 60, 74], 0.1), 0.75); }
    const th = st >= 3 ? 31 : 15;
    R(x - 13.5, y - th, 9.5, th, c); R(x - 8, y - th, 4, th, cd);                                 // west tower
    R(x - 10.3, y - 6, 3, 6, tone([52, 46, 50], 0.12)); Dome(x - 8.8, y - 6, 1.5, 1.8, tone([52, 46, 50], 0.12));
    if (st >= 3) {
      P([x - 14.2, y - 31, x - 8.75, y - 55, x - 3.3, y - 31], rf); P([x - 8.75, y - 31, x - 8.75, y - 55, x - 3.3, y - 31], dk(rf, 0.84));
      Ln(x - 8.75, y - 55, x - 8.75, y - 59.5, tone([196, 164, 84], 0.1), 0.6); Ln(x - 10.2, y - 57.6, x - 7.3, y - 57.6, tone([196, 164, 84], 0.1), 0.6);
      if (E.night > 0.1) Ci(x - 8.75, y - 20, 1.9, GLOW, E.night); else Ci(x - 8.75, y - 20, 1.9, tone([70, 74, 96], 0.1), 0.85);
      win(x - 11.6, y - 28.5, 1.2, 3.4, 0.3); win(x - 7.1, y - 28.5, 1.2, 3.4, 0.5);
    } else {
      for (const sx of [x - 15, x - 3]) Ln(sx, y, sx, y - 33, tb, 0.5); for (const sy of [18, 24, 30]) Ln(x - 15, y - sy, x - 3, y - sy, tb, 0.4); Ln(x - 15, y - 18, x - 3, y - 24, tb, 0.3); Ln(x - 15, y - 24, x - 3, y - 30, tb, 0.3);
    }
  }
  function abbey(lv) {
    const x = 262, y = 121, c = tone(C.lime, 0.22), cd = dk(c, 0.86), rf = tone(C.terra, 0.22);
    R(x - 7, y - 6.5, 14, 6.5, c); R(x + 1, y - 6.5, 6, 6.5, cd); P([x - 8, y - 6.5, x, y - 11, x + 8, y - 6.5], rf);
    R(x - 9.5, y - 10, 3.4, 10, c); P([x - 10, y - 10, x - 7.8, y - 13.6, x - 5.6, y - 10], rf); win(x - 8.6, y - 8.6, 1.4, 1.8, 0.4);
    win(x - 2, y - 4.6, 1.3, 2.8, 0.2); win(x + 2.6, y - 4.6, 1.3, 2.8, 0.6);
    if (lv >= 2) { R(x + 7, y - 4, 12, 4, c); R(x + 13, y - 4, 6, 4, cd); P([x + 6.4, y - 4, x + 13, y - 6.6, x + 19.6, y - 4], rf); for (let i = 0; i < 3; i++) win(x + 8.6 + i * 3.4, y - 2.8, 1.5, 1.8, 0.15 + i * 0.3); }
  }
  function university(lv) {
    const x = 234, y = 141, c = tone(C.plaster, 0.16), cd = dk(c, 0.87), rf = tone(C.terra, 0.16);
    R(x - 12, y - 9, 24, 9, c); R(x + 2, y - 9, 10, 9, cd); P([x - 13, y - 9, x - 10, y - 12, x + 10, y - 12, x + 13, y - 9], rf);
    R(x - 3.6, y - 14.5, 7.2, 3.4, c); Dome(x, y - 14.5, 4.4, 5, tone([104, 132, 122], 0.16)); Ln(x, y - 19.5, x, y - 22, tone([196, 164, 84], 0.14), 0.5);
    for (let i = 0; i < 6; i++) { R(x - 10.4 + i * 3.7, y - 4, 2, 4, tone([58, 52, 56], 0.16)); Dome(x - 9.4 + i * 3.7, y - 4, 1, 1.2, tone([58, 52, 56], 0.16)); win(x - 10.2 + i * 3.7, y - 7.8, 1.6, 1.8, 0.1 + i * 0.14); }
    if (lv >= 2) { R(x + 12, y - 6.5, 9, 6.5, cd); P([x + 11.4, y - 6.5, x + 16.5, y - 9.6, x + 21.6, y - 6.5], rf); win(x + 14, y - 4.6, 1.5, 2, 0.35); win(x + 17.6, y - 4.6, 1.5, 2, 0.8); }
  }
  function observatory(lv) {
    const x = 282, y = 104.5, c = tone([228, 224, 214], 0.22);
    R(x - 5, y - 6, 10, 6, c); R(x + 1, y - 6, 4, 6, dk(c, 0.86)); Dome(x, y - 6, 5.6, 6, tone([150, 160, 168], 0.22)); R(x - 0.5, y - 12, 1, 6, tone([40, 44, 54], 0.2));
    if (lv >= 2) { R(x - 13, y - 3.6, 8, 3.6, c); Dome(x - 9, y - 3.6, 3, 3.2, tone([150, 160, 168], 0.22)); }
  }
  function dish(x, y, r, dep) {
    const c = tone([232, 234, 238], dep);
    Ln(x, y, x, y - r * 0.9, tone(C.iron, dep), 0.7); Ln(x - r * 0.5, y, x, y - r * 0.6, tone(C.iron, dep), 0.4); Ln(x + r * 0.5, y, x, y - r * 0.6, tone(C.iron, dep), 0.4);
    ctx.save(); ctx.translate(x, y - r * 1.1); ctx.rotate(-0.6); ctx.fillStyle = col(c); ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col(dk(c, 0.8)); ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.14, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = col(tone(C.iron, dep)); ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.8); ctx.stroke(); ctx.restore();
  }
  function institute(lv) {
    const x = 262, y = 118, c = tone([236, 236, 232], 0.2);
    if (lv >= 2) { R(x + 8, y - 12, 9, 12, c); R(x + 13, y - 12, 4, 12, dk(c, 0.86)); for (let r = 0; r < 3; r++) R(x + 9, y - 10.4 + r * 3.4, 7, 1.3, E.night > 0.1 ? GLOW : tone([70, 84, 104], 0.2), E.night > 0.1 ? E.night * 0.9 : 0.9); }
    R(x - 12, y - 7, 22, 7, c); R(x + 2, y - 7, 8, 7, dk(c, 0.87)); R(x - 12, y - 7.8, 22, 0.9, tone([130, 136, 144], 0.2));
    for (let r = 0; r < 2; r++) R(x - 10.6, y - 5.6 + r * 2.8, 19.4, 1.2, E.night > 0.1 ? GLOW : tone([70, 84, 104], 0.2), E.night > 0.1 ? E.night * 0.9 : 0.9);
    dish(x - 17, y, 5, 0.2);
  }
  function guildhall(lv) {
    const x = 151, y = 150.5, c = tone(C.plaster, 0.1), cd = dk(c, 0.87), rf = tone(C.terra, 0.1);
    R(x - 10, y - 10, 20, 10, c); R(x + 2, y - 10, 8, 10, cd);
    P([x - 11, y - 10, x - 8, y - 12.5, x - 5, y - 12.5, x - 5, y - 15, x - 2, y - 15, x - 2, y - 17.5, x + 2, y - 17.5, x + 2, y - 15, x + 5, y - 15, x + 5, y - 12.5, x + 8, y - 12.5, x + 11, y - 10], rf);
    for (let i = 0; i < 4; i++) { R(x - 8.6 + i * 4.6, y - 4.2, 2.8, 4.2, tone([58, 50, 54], 0.1)); Dome(x - 7.2 + i * 4.6, y - 4.2, 1.4, 1.5, tone([58, 50, 54], 0.1)); win(x - 8.2 + i * 4.6, y - 8.6, 1.8, 2, 0.12 + i * 0.2); }
    if (lv >= 2) { R(x - 1.6, y - 23, 3.2, 6, c); P([x - 2.4, y - 23, x, y - 27, x + 2.4, y - 23], rf); Ci(x, y - 20.6, 0.9, tone([60, 54, 58], 0.1)); }
  }
  function bank(lv) {
    const x = 214, y = 150.5, c = tone([216, 212, 202], 0.1), cd = dk(c, 0.86);
    R(x - 9, y - 11, 18, 11, c); R(x + 2, y - 11, 7, 11, cd); P([x - 10.4, y - 11, x, y - 16, x + 10.4, y - 11], c); P([x, y - 11, x, y - 16, x + 10.4, y - 11], cd); R(x - 10.4, y - 11.8, 20.8, 1, dk(c, 0.78));
    for (let i = 0; i < 5; i++) { R(x - 8 + i * 3.7, y - 10, 1.2, 9, dk(c, 1.06)); win(x - 6.3 + i * 3.7, y - 7.6, 1.5, 4.4, 0.2 + i * 0.15); }
    R(x - 10.4, y - 1.2, 20.8, 1.2, dk(c, 0.8));
    if (lv >= 2) { Dome(x, y - 16, 3.4, 3.8, tone([120, 150, 140], 0.1)); }
  }
  function exchange(lv) {
    const list = [[222, 134, 12, 44, 0.2], [206, 134, 10, 34, 0.55], [238, 134, 11, 39, 0.8]];
    for (let i = 0; i < Math.min(3, lv); i++) {
      const t = list[i], x = t[0], y = t[1], w = t[2], h = t[3], c = tone(mix(C.glass, [92, 128, 162], t[4]), 0.2);
      R(x - w / 2, y - h, w, h, c); R(x + w * 0.14, y - h, w * 0.36, h, dk(c, 0.84)); R(x - w / 2, y - h, w, 0.9, tone([220, 226, 232], 0.2));
      for (let r = 0; r < Math.floor(h / 3); r++) for (let k = 0; k < 4; k++) if (E.night > 0.08 && ((r * 7 + k * 13 + i * 5) % 10) < 6) R(x - w / 2 + 1 + k * (w - 2) / 4, y - h + 2 + r * 3, 1.4, 1.5, GLOW, E.night);
      for (let k = 1; k < 4; k++) R(x - w / 2 + k * w / 4, y - h, 0.3, h, dk(c, 0.72), 0.7);
      if (i === 0) { Ln(x, y - h, x, y - h - 9, tone(C.iron, 0.2), 0.5); if (E.night > 0.2 && Math.sin(E.t * 2.2) > 0) Ci(x, y - h - 9, 0.9, [255, 70, 60], 1); }
    }
  }
  function fields(n, lv) {
    const cols = [C.wheat, C.crop, C.fallow, C.crop, C.wheat, [168, 184, 96], C.fallow];
    for (let i = 0; i < n; i++) {
      const x0 = 14 + i * 18.5, c = tone(cols[i % cols.length], 0.03);
      P([x0, 161, x0 + 16.5, 161, x0 + 9.5, 197, x0 - 9, 197], c);
      for (let k = 1; k < 4; k++) Ln(x0 + 16.5 * k / 4, 161, x0 - 9 + 18.5 * k / 4, 197, dk(c, 0.86), 0.45, 0.8);
    }
  }
  function farmstead(x, y, s) {
    house(1, { x: x, y: y, s: s, u: 0.7, v: 0.6, b: -1 });
    const c = tone(C.timber, 0.05); R(x + 7 * s, y - 5 * s, 7 * s, 5 * s, c); P([x + 6.2 * s, y - 5 * s, x + 10.5 * s, y - 8.6 * s, x + 14.8 * s, y - 5 * s], tone(dk(C.thatch, 0.9), 0.05)); R(x + 9.4 * s, y - 3 * s, 2.2 * s, 3 * s, dk(c, 0.6));
  }
  function windmill(x, y) {
    const c = tone([222, 212, 190], 0.05);
    P([x - 3.4, y, x - 2.2, y - 12, x + 2.2, y - 12, x + 3.4, y], c); P([x + 0.6, y, x + 0.4, y - 12, x + 2.2, y - 12, x + 3.4, y], dk(c, 0.86)); P([x - 2.8, y - 12, x, y - 15, x + 2.8, y - 12], tone(C.timber, 0.05)); R(x - 0.8, y - 2.8, 1.6, 2.8, tone(dk(C.timber, 0.6), 0.05));
    const a0 = Scene.still ? 0.5 : E.t * 0.55;
    for (let i = 0; i < 4; i++) { const a = a0 + i * Math.PI / 2, cx = x, cy = y - 12.6, ex = cx + Math.cos(a) * 9.5, ey = cy + Math.sin(a) * 9.5, nx = -Math.sin(a) * 1.5, ny = Math.cos(a) * 1.5; Ln(cx, cy, ex, ey, tone(C.timber, 0.05), 0.5); P([cx + (ex - cx) * 0.3, cy + (ey - cy) * 0.3, ex, ey, ex + nx, ey + ny, cx + (ex - cx) * 0.3 + nx, cy + (ey - cy) * 0.3 + ny], tone([236, 228, 206], 0.05), 0.92); }
  }
  function spaceport(lv) {
    const x = 100, y = 180, c = tone(C.pearl, 0.03);
    El(x + 26, y + 5, 20, 3.6, tone([150, 154, 160], 0.03)); El(x + 26, y + 5, 14, 2.2, tone([124, 128, 136], 0.03));
    Dome(x - 4, y, 17, 7.5, c); Dome(x + 2, y, 11, 7.2, dk(c, 0.88)); R(x - 21, y - 0.6, 34, 1.4, tone([150, 156, 166], 0.03)); for (let i = 0; i < 7; i++) win(x - 16 + i * 4, y - 3, 2.2, 1.4, 0.1 + i * 0.11);
    R(x - 26, y - 17, 1.6, 17, c); R(x - 28.4, y - 20, 6.4, 3.4, c); R(x - 27.8, y - 19.2, 5.2, 1.3, E.night > 0.1 ? CYAN : tone([70, 100, 130], 0.03), 0.95);
    P([x + 20, y + 4, x + 27, y - 3.6, x + 29.5, y - 3.6, x + 34, y + 4], c); P([x + 27, y - 3.6, x + 28.2, y - 8.5, x + 29.5, y - 3.6], c); P([x + 28, y + 4, x + 29.5, y - 3.6, x + 34, y + 4], dk(c, 0.84));
    if (lv >= 2) { P([x + 40, y + 6, x + 45, y + 0.6, x + 47, y + 0.6, x + 50.5, y + 6], c); P([x + 45, y + 0.6, x + 46, y - 3, x + 47, y + 0.6], c); }
  }
  function lumber(x, y, lv) {
    const c = tone([150, 110, 70], 0.03), e = tone([206, 176, 128], 0.03);
    for (let p = 0; p < Math.min(3, lv + 0); p++) { const px = x + p * 13; for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) { Ci(px + k * 3.2 + r * 1.6, y - 1.5 - r * 2.7, 1.6, c); Ci(px + k * 3.2 + r * 1.6, y - 1.5 - r * 2.7, 0.8, e); } }
    P([x - 16, y - 6.5, x - 9, y - 10, x - 2, y - 6.5], tone(dk(C.thatch, 0.85), 0.03)); Ln(x - 14.6, y - 6.5, x - 14.6, y, tone(C.timber, 0.03), 0.8); Ln(x - 3.4, y - 6.5, x - 3.4, y, tone(C.timber, 0.03), 0.8); R(x - 13, y - 2.6, 8, 0.9, tone(C.timber, 0.03));
    for (const sx of [x + 44, x + 51, x - 24]) El(sx, y + 2, 1.7, 0.8, e);
  }
  function masons(x, y, lv) {
    const c = tone([214, 208, 194], 0.03), cd = dk(c, 0.84), tb = tone(C.timber, 0.03);
    for (let i = 0; i < 3 + lv; i++) { const bx = x + (i % 3) * 5.4 + (i > 2 ? 2.4 : 0), by = y - (i > 2 ? 3.4 : 0); R(bx, by - 3.2, 5, 3.2, c); R(bx + 3, by - 3.2, 2, 3.2, cd); }
    Ln(x - 12, y, x - 8, y - 15, tb, 0.8); Ln(x - 4, y, x - 8, y - 15, tb, 0.8); Ln(x - 8, y - 15, x + 4, y - 19, tb, 0.7); Ln(x + 4, y - 19, x + 4, y - 9, tb, 0.3); R(x + 2.4, y - 9, 3.2, 2.4, c);
    ctx.strokeStyle = col(tb); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(x - 8, y - 4.4, 3.6, 0, TAU); ctx.stroke(); Ln(x - 11.6, y - 4.4, x - 4.4, y - 4.4, tb, 0.3); Ln(x - 8, y - 8, x - 8, y - 0.8, tb, 0.3);
  }
  function steelworks(x, y, lv) {
    const c = tone(dk(C.brick, 0.86), 0.03), cd = dk(c, 0.82), rf = tone([70, 74, 84], 0.03);
    for (let n = 0; n < (lv >= 3 ? 2 : 1); n++) {
      const sx = x + n * 38, w = 34;
      R(sx, y - 11, w, 11, c); R(sx + w * 0.6, y - 11, w * 0.4, 11, cd);
      for (let i = 0; i < 4; i++) P([sx + i * w / 4, y - 11, sx + i * w / 4, y - 15.5, sx + (i + 1) * w / 4, y - 11], rf);
      for (let i = 0; i < 5; i++) win(sx + 2.4 + i * 6.2, y - 8, 3, 3.6, 0.1 + i * 0.13);
      R(sx + 13, y - 5, 6, 5, [255, 150, 60], 0.55 + 0.45 * E.night); if (E.night > 0.2) Ci(sx + 16, y - 3, 9, [255, 140, 60], 0.14 * E.night);
    }
    const stacks = lv >= 2 ? [[x + 6, 27], [x + 13, 22], [x + 29, 30]] : [[x + 6, 26], [x + 29, 21]];
    for (const s of stacks) { P([s[0] - 1.9, y - 11, s[0] - 1.3, y - s[1], s[0] + 1.3, y - s[1], s[0] + 1.9, y - 11], c); R(s[0] - 1.6, y - s[1], 3.2, 1.3, tone([52, 44, 44], 0.03)); smoke(s[0], y - s[1] - 1, 1.5, true, s[1] * 0.07); }
  }
  function refinery(x, y, lv) {
    const c = tone([198, 202, 208], 0.03), cd = dk(c, 0.82), pc = tone([120, 126, 136], 0.03);
    for (const t of [[x, 22], [x + 6, 29], [x + 12, 17]]) { R(t[0] - 1.6, y - t[1], 3.2, t[1], c); R(t[0] + 0.3, y - t[1], 1.3, t[1], cd); Dome(t[0], y - t[1], 1.6, 1.6, c); for (let k = 5; k < t[1]; k += 6) R(t[0] - 2.1, y - k, 4.2, 0.6, pc); if (E.night > 0.1) Ci(t[0], y - t[1] - 1.6, 0.7, GLOW, E.night); }
    for (let i = 0; i < 2; i++) R(x - 4, y - 5 - i * 4, 26, 0.7, pc);
    for (let i = 0; i < (lv >= 2 ? 3 : 2); i++) { const tx = x + 23 + i * 9; Ci(tx, y - 5.4, 4.2, c); Ci(tx + 1.3, y - 4.6, 3, cd, 0.5); Ln(tx - 3, y, tx - 2, y - 2.6, pc, 0.5); Ln(tx + 3, y, tx + 2, y - 2.6, pc, 0.5); }
    const fx = x - 8; Ln(fx, y, fx, y - 33, pc, 0.8);
    const fl = Scene.still ? 1 : 0.75 + 0.25 * Math.sin(E.t * 9); P([fx - 1.5, y - 33, fx + 0.6 * fl, y - 38.5 - 2 * fl, fx + 1.5, y - 33], [255, 170, 70], 0.95); Ci(fx, y - 35, 5.5, [255, 160, 70], 0.1 + 0.16 * E.night);
  }
  function fabricator(x, y, lv) {
    const c = tone(C.pearl, 0.03), cd = dk(c, 0.86);
    for (let i = 0; i < Math.min(3, lv + 1); i++) {
      const dx = x + i * 17, r = 9 - i * 1.4;
      Dome(dx, y, r, r * 0.86, c); Dome(dx + r * 0.3, y, r * 0.7, r * 0.82, cd);
      ctx.strokeStyle = col(E.night > 0.1 ? CYAN : tone([120, 170, 200], 0.03), 0.85); ctx.lineWidth = 0.45; ctx.beginPath();
      ctx.ellipse(dx, y, r, r * 0.86, 0, Math.PI, TAU); ctx.moveTo(dx - r * 0.5, y); ctx.lineTo(dx - r * 0.3, y - r * 0.8); ctx.moveTo(dx + r * 0.5, y); ctx.lineTo(dx + r * 0.3, y - r * 0.8); ctx.moveTo(dx - r * 0.86, y - r * 0.44); ctx.lineTo(dx + r * 0.86, y - r * 0.44); ctx.stroke();
      if (E.night > 0.1) Ci(dx, y - 3, r * 1.3, CYAN, 0.08 * E.night);
    }
    Ln(x - 13, y, x - 13, y - 15, tone(C.iron, 0.03), 0.9); Ln(x - 13, y - 15, x - 2, y - 13, tone(C.iron, 0.03), 0.7); Ln(x - 2, y - 13, x - 2, y - 10, tone(C.iron, 0.03), 0.4);
  }

  function onRoad(t) {                                    // the road out of town is kept clear, now that carts use it
    if (t.y < 153 || t.x < 160 || t.x > 216) return false;
    for (let u = 0; u <= 1.001; u += 0.04) {
      const v = 1 - u, x = v * v * v * 176 + 3 * v * v * u * 178 + 3 * v * u * u * 206 + u * u * u * 198, y = v * v * v * 152.5 + 3 * v * v * u * 166 + 3 * v * u * u * 172 + u * u * u * 201;
      if (Math.abs(t.x - x) < 7.5 && Math.abs(t.y - 1 - y) < 5) return true;
    }
    return false;
  }

  /* ---------- the camera of the city view ---------- */
  function resize() {
    const r = cv.getBoundingClientRect(), d = Math.min(3, root.devicePixelRatio || 1);
    if (r.width === cssW && r.height === cssH && d === dpr) return;
    cssW = r.width; cssH = r.height; dpr = d; cv.width = Math.max(1, Math.round(cssW * dpr)); cv.height = Math.max(1, Math.round(cssH * dpr));
  }
  function zoomRange() { const fit = cssW / W, lo = Math.max(fit, 0.26 * cssH / 110); return [lo, Math.max(lo * 3, fit * 7)]; }   // on a tall screen the widest view stops short of the whole width, so the land keeps a quarter of the height
  function homeZoom() { const r = zoomRange(); return clamp(0.62 * (cssH - cam.pad) / 108, r[0] * 1.5, r[1]); }     // the land fills a little over half the screen
  function clampCam() {
    const r = zoomRange();
    if (!cam.z) { cam.z = homeZoom(); cam.x = 180 - cssW / cam.z / 2; cam.y = 1e9; }                                // first look: the town centre, standing on the ground
    cam.z = clamp(cam.z, r[0], r[1]);
    const vw = cssW / cam.z, vh = cssH / cam.z, low = GROUND + cam.pad / cam.z - vh;                                 // the ground rests on the bottom edge
    cam.x = clamp(cam.x, 0, Math.max(0, W - vw));
    cam.y = clamp(cam.y, Math.min(low, SKYTOP), low);
  }
  Scene.attach = function (canvas) { cv = canvas; ctx = cv.getContext('2d'); cssW = cssH = 0; };
  Scene.city = function (on, pad) { cam.on = !!on; cam.pad = pad || 0; };
  Scene.home = function () { cam.z = 0; };
  Scene.pan = function (dx, dy) { if (!cam.on || !cam.z) return; cam.x -= dx / cam.z; cam.y -= dy / cam.z; clampCam(); };
  Scene.zoomBy = function (f, px, py) {                      // keeps the point under the fingers where it is
    if (!cam.on || !cam.z) return;
    const wx = cam.x + px / cam.z, wy = cam.y + py / cam.z, r = zoomRange();
    cam.z = clamp(cam.z * f, r[0], r[1]); cam.x = wx - px / cam.z; cam.y = wy - py / cam.z; clampCam();
  };
  Scene.zoomTo = function (z, px, py) { if (cam.z) Scene.zoomBy(z / cam.z, px, py); };
  Scene.camera = function () { const r = cssW ? zoomRange() : [1, 7]; return { on: cam.on, z: cam.z, x: cam.x, y: cam.y, min: r[0], max: r[1], home: cssW ? homeZoom() : 0 }; };
  Scene.look = function (id) {                               // bring a place to the middle of the view
    const st = sites.filter(function (q) { return q.id === id; }).pop();
    if (!st || !cam.on || !cam.z) return false;
    cam.x = st.x + st.w / 2 - cssW / cam.z / 2; clampCam(); return true;
  };
  Scene.pick = function (px, py) {                           // what stands under a touch; a finger is wider than a pixel
    const x = (px - T.ox) / T.k, y = (py - T.oy) / T.k;
    for (const pad of [0, 10 / T.k]) for (let i = sites.length - 1; i >= 0; i--) {
      const q = sites[i];
      if (x >= q.x - pad && x <= q.x + q.w + pad && y >= q.y - pad && y <= q.y + q.h + pad) return q.id;
    }
    return null;
  };
  Scene.where = function (id) {                              // the middle of a place, in css pixels of the canvas
    const st = sites.filter(function (q) { return q.id === id; }).pop();
    return st ? { x: (st.x + st.w / 2) * T.k + T.ox, y: (st.y + st.h / 2) * T.k + T.oy } : null;
  };
  Scene.places = function () { return sites.map(function (q) { return q.id; }); };
  Scene.emit = function (kind, id) { events.push({ k: kind, id: id, t: Date.now() }); if (events.length > 24) events.shift(); };
  Scene.kit = { W: W, H: H, C: C, GLOW: GLOW, CYAN: CYAN, mix: mix, dk: dk, col: col, clamp: clamp, tone: tone, R: R, P: P, Ci: Ci, El: El, Dome: Dome, Ln: Ln, win: win, smoke: smoke, sailShip: sailShip,
    site: function (id, x, y, w, h) { sites.push({ id: id, x: x, y: y, w: w, h: h }); } };

  /* ---------- one frame ---------- */
  Scene.draw = function (S, tms, fx) {
    if (!cv) return;
    resize(); if (!cssW || !cssH) return;
    const seed = S.world || 1;
    if (seed !== layoutSeed) { layout = makeLayout(seed); layoutSeed = seed; }
    const now = new Date(tms), hour = Scene.hour !== null ? Scene.hour : now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    const age = S.age, n = function (id) { return S.b[id] || 0; }, lv = function (id) { const c = n(id); return c >= 50 ? 3 : c >= 10 ? 2 : c >= 1 ? 1 : 0; };
    E = makeEnv(hour, age, tms / 1000 % 100000);
    let k, ox, oy;
    if (cam.on) { clampCam(); k = cam.z; ox = -cam.x * k; oy = -cam.y * k; }
    else { k = cssW / W; ox = 0; oy = cssH - H * k; }           // the strip: keep the ground at the bottom edge, let the sky absorb any slack
    T = { k: k, ox: ox, oy: oy };
    E.z = k; E.city = cam.on; E.ms = tms; E.x0 = -ox / k; E.y0 = -oy / k; E.x1 = E.x0 + cssW / k; E.y1 = E.y0 + cssH / k;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = col(E.top); ctx.fillRect(0, 0, cv.width, cv.height);       // whatever lies above the painted sky
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    const stage = function (a) { return age > a ? 99 : age === a ? S.project : 0; };
    sites = [];
    const City = root.City && root.City.begin(E, ctx, S, Scene.facts || {}, stage) ? root.City : null;

    sky(); if (City) City.sky();
    ridge(101, 30, 0, [96, 110, 144], 0.62, 127); ridge(110, 16, 4, [84, 104, 116], 0.46, 127);
    P([0, 116.6, 40, 114, 96, 114.6, 132, 116.8, 180, 118, 360, 118.4, 360, 122, 0, 122], tone([78, 100, 82], 0.4));
    reactor(stage(4)); ark(stage(5), fx && fx.lift); if (City) City.far();
    sea(); viaduct(stage(3), stage(3) >= 4);
    harbor(stage(2), age); if (City) City.bay();
    midland(); quays(stage(2));

    const items = [], put = function (y, f) { items.push({ y: y, f: f }); };
    put(95.5, keep);
    if (n('script')) put(121, function () { abbey(lv('script')); });
    if (n('obs')) put(104.5, function () { observatory(lv('obs')); });
    if (n('inst')) put(118, function () { institute(lv('inst')); });
    if (n('array')) { put(99, function () { dish(338, 99.5, 6.5, 0.22); }); put(102, function () { dish(350, 103.5, 5, 0.2); }); if (lv('array') >= 2) put(101, function () { dish(327, 99, 4.6, 0.22); }); }
    const keepTrees = [1, 1, 0.85, 0.5, 0.42, 0.5][age] - Math.min(0.25, n('lumber') * 0.004);
    for (const t of layout.trees) if (t.u < keepTrees && !onRoad(t)) (function (t) { put(t.y, function () { tree(t, t.y < 150 ? 0.2 : 0.04); }); })(t);
    let total = 0; for (const b in S.b) total += S.b[b];
    const count = Math.min(layout.houses.length, 3 + Math.floor(1.7 * Math.sqrt(total)));
    for (let i = 0; i < count; i++) (function (h) {
      const kind = Math.max(1, age - (h.u < 0.3 ? 1 : 0));
      put(h.y, function () { house(kind, h); });
    })(layout.houses[i]);
    put(150.5, function () { cathedral(stage(1)); });
    if (n('guild')) put(150.6, function () { guildhall(lv('guild')); });
    if (n('bank')) put(150.7, function () { bank(lv('bank')); });
    if (n('exch')) put(134, function () { exchange(lv('exch')); });
    if (n('univ')) put(141, function () { university(lv('univ')); });
    if (stage(2) >= 3) put(143.4, arsenal);
    put(151, foreland);
    const farms = n('farm'), port = n('port');
    if (farms) { put(161, function () { fields(Math.min(port ? 3 : 7, 2 + Math.floor(farms / 8)), lv('farm')); }); put(160.5, function () { farmstead(34, 160.5, 1.05); }); }
    if (farms >= 20 && !port) put(163, function () { farmstead(92, 163, 1); });
    if (farms >= 10) put(166, function () { windmill(port ? 8 : 133, port ? 163 : 166); });
    if (port) put(186, function () { spaceport(lv('port')); });
    if (n('lumber') && age <= 2) put(176, function () { lumber(292, 176, lv('lumber')); });
    if (n('mason') && age <= 3) put(188, function () { masons(age === 3 ? 228 : 262, 188, lv('mason')); });
    if (n('steel')) put(171, function () { steelworks(250, 171, lv('steel')); });
    if (n('refin')) put(191, function () { refinery(304, 191, lv('refin')); });
    if (n('fab')) put(193, function () { fabricator(224, 193, lv('fab')); });
    if (City) City.town(put, { count: count, total: total, events: events, lift: fx && fx.lift });
    items.sort(function (a, b) { return a.y - b.y; });
    for (const it of items) it.f();
    if (E.night > 0.5) { ctx.fillStyle = col([10, 14, 40], 0.05 * E.night); ctx.fillRect(E.x0 - 1, E.y0 - 1, E.x1 - E.x0 + 2, E.y1 - E.y0 + 2); }
    if (City) City.over(events);
    for (let i = events.length - 1; i >= 0; i--) if (tms - events[i].t > 9000) events.splice(i, 1);
  };
  root.Scene = Scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
