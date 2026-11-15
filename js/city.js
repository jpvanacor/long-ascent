/* Long Ascent: life in the settlement. The people, animals, carts and work drawn into the scene; the things the
   game says are going on (the great work, parties on the road, edicts, the trial of the age); and the places
   that can be touched in the city view.
   Nothing here remembers the last frame: where everyone stands follows from the clock and from the state of the
   game, so the picture after a pause is the one it would have been without it. */
(function (root) {
  'use strict';
  const Scene = root.Scene, K = Scene.kit, TAU = Math.PI * 2;
  const R = K.R, P = K.P, Ci = K.Ci, El = K.El, Dome = K.Dome, Ln = K.Ln, tone = K.tone, dk = K.dk, col = K.col, clamp = K.clamp, PAL = K.C, GLOW = K.GLOW, CYAN = K.CYAN, smoke = K.smoke, site = K.site;
  let E = null, ctx = null, S = null, F = null, stage = null, age = 1, T0 = 0;
  const City = {};

  /* ---------- small helpers ---------- */
  const hh = function (i, k) { const v = Math.sin(i * 127.1 + k * 311.7 + 17.3) * 43758.5453; return v - Math.floor(v); };   // a fixed "random" number for person i, trait k
  const sy = function (y) { return y <= 152 ? clamp(0.5 + (y - 96) * 0.5 / 56, 0.42, 1) : 1 + (y - 152) * 0.0095; };            // things further up the picture are further away
  const dp = function (y) { return y >= 160 ? 0.03 : y >= 150 ? 0.1 - (y - 150) * 0.007 : clamp(0.1 + (150 - y) * 0.0026, 0.1, 0.26); };   // and hazier
  const n = function (id) { return S.b[id] || 0; };
  const SKIN = [226, 190, 160], CARS = [[196, 60, 52], [62, 110, 170], [230, 200, 80], [226, 226, 226], [54, 58, 66], [90, 150, 110], [240, 140, 60]];
  const COATS = [null,
    [[150, 110, 70], [124, 96, 70], [160, 132, 90], [112, 100, 84], [146, 84, 60], [96, 108, 84]],          // undyed wool, russet, moss
    [[150, 52, 48], [52, 84, 136], [176, 140, 60], [70, 112, 84], [120, 70, 110], [196, 180, 150]],         // dyed cloth
    [[46, 46, 54], [70, 62, 58], [92, 78, 66], [58, 70, 88], [110, 60, 54], [120, 120, 116]],               // soot and serge
    [[196, 70, 60], [62, 110, 170], [230, 200, 80], [90, 150, 110], [226, 226, 226], [64, 64, 74]],         // ready-made
    [[226, 233, 240], [150, 220, 240], [240, 200, 120], [190, 200, 220], [120, 222, 255], [250, 250, 250]]]; // light suits
  const HATS = [null, [1, 0, 1, 0, 2], [2, 0, 2, 1, 0], [3, 3, 0, 2, 0], [0, 0, 0, 4, 0], [5, 0, 5, 0, 0]];
  const RD = [176, 152.5, 178, 166, 206, 172, 198, 201];                                 // the road out of town, as drawn by the scene
  function roadAt(u) {
    if (u > 1) return { x: RD[6] - (u - 1) * 2, y: RD[7] + (u - 1) * 60 };                // past the edge of the picture
    const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return { x: a * RD[0] + b * RD[2] + c * RD[4] + d * RD[6], y: a * RD[1] + b * RD[3] + c * RD[5] + d * RD[7] };
  }

  /* ---------- people ---------- */
  function pennant(x, y, s, c, d) {
    const f = Scene.still ? 0 : Math.sin(E.t * 3 + x) * 0.3 * s;
    Ln(x, y + 1.4 * s, x, y - 2.4 * s, tone(PAL.timber, d), 0.18 * s); P([x, y - 2.4 * s, x + 1.8 * s, y - 1.95 * s + f, x, y - 1.4 * s], tone(c, d));
  }
  function hat(kind, x, y, s, coat, d, dir) {              // y: the middle of the head
    if (kind === 1) Dome(x, y - 0.02 * s, 0.54 * s, 0.58 * s, dk(coat, 0.72));                                                    // hood
    else if (kind === 2) { R(x - 0.78 * s, y - 0.42 * s, 1.56 * s, 0.2 * s, tone([74, 54, 42], d)); Dome(x, y - 0.4 * s, 0.42 * s, 0.42 * s, tone([74, 54, 42], d)); }   // wide brim
    else if (kind === 3) { R(x - 0.36 * s, y - 1.1 * s, 0.72 * s, 0.74 * s, tone([30, 30, 34], d)); R(x - 0.62 * s, y - 0.42 * s, 1.24 * s, 0.16 * s, tone([30, 30, 34], d)); }   // tall hat
    else if (kind === 4) Dome(x, y - 0.1 * s, 0.52 * s, 0.48 * s, tone([236, 196, 60], d));                                        // hard hat
    else if (kind === 5) { Dome(x, y - 0.02 * s, 0.54 * s, 0.58 * s, tone([232, 238, 244], d)); R(x - 0.2 * s + 0.2 * s * dir, y - 0.22 * s, 0.42 * s, 0.24 * s, CYAN, 0.9); }   // visor
    else if (kind === 6) { Dome(x, y - 0.02 * s, 0.52 * s, 0.56 * s, tone([134, 138, 146], d)); R(x - 0.52 * s, y - 0.08 * s, 1.04 * s, 0.14 * s, tone([100, 104, 112], d)); }  // helm
    else Dome(x, y - 0.1 * s, 0.47 * s, 0.42 * s, tone([70, 52, 40], d));                                                           // bare head
  }
  function toolIn(kind, hx, hy, a, dir, s, d) {
    const wood = tone(PAL.timber, d), iron = tone([122, 126, 134], d);
    if (kind === 'pike') { Ln(hx, hy + 1 * s, hx, hy - 3 * s, wood, 0.2 * s); P([hx - 0.26 * s, hy - 3 * s, hx, hy - 3.9 * s, hx + 0.26 * s, hy - 3 * s], iron); return; }
    const ux = Math.sin(a) * dir, uy = Math.cos(a), ex = hx + ux * 1.5 * s, ey = hy + uy * 1.5 * s, nx = uy * dir, ny = -Math.sin(a);
    Ln(hx, hy, ex, ey, wood, 0.22 * s);
    if (kind === 'hammer') R(ex - 0.42 * s, ey - 0.3 * s, 0.84 * s, 0.6 * s, iron);
    else if (kind === 'axe') P([ex, ey, ex + nx * 0.9 * s, ey + ny * 0.9 * s, ex + ux * 0.55 * s + nx * 0.7 * s, ey + uy * 0.55 * s + ny * 0.7 * s], iron);
    else if (kind === 'torch') { Ci(ex, ey, 0.5 * s, [255, 190, 90], 0.95); Ci(ex, ey, 1.6 * s, [255, 170, 80], 0.18); }
    else Ln(ex, ey, ex + nx * 0.8 * s, ey + ny * 0.8 * s, iron, 0.3 * s);                    // hoe, pick, shovel
  }
  /* one person, feet at (x, y). o: c coat, hat, act (walk, work, carry, cheer, talk, drill, stand), ph, dir, tool, load, flag, skirt, lamp */
  function man(x, y, s, o) {
    const d = dp(y), coat = tone(o.c, d), k = E.z * s;
    if (k < 1.35) {                                         // far away or the small strip: a mark is enough
      R(x - 0.42 * s, y - 2.5 * s, 0.84 * s, 2.5 * s, coat); Ci(x, y - 2.9 * s, 0.5 * s, tone(SKIN, d));
      if (o.flag) pennant(x, y - 3.2 * s, s, o.flag, d);
      return;
    }
    const still = Scene.still, act = o.act || 'stand', dir = o.dir || 1, ph = o.ph || 0;
    const sw = act === 'walk' && !still ? Math.sin(ph) : 0, bob = Math.abs(sw) * 0.1 * s;
    const legs = tone(o.legs || [58, 50, 46], d), skin = tone(SKIN, d), hip = y - 1.25 * s - bob, sh = y - 2.5 * s - bob, lw = 0.34 * s;
    if (o.skirt) P([x - 0.5 * s, sh + 0.9 * s, x + 0.5 * s, sh + 0.9 * s, x + 0.74 * s, y - 0.2 * s, x - 0.74 * s, y - 0.2 * s], dk(coat, 0.84));
    Ln(x - 0.2 * s, hip, x - 0.2 * s + sw * 0.55 * s, y, legs, lw); Ln(x + 0.2 * s, hip, x + 0.2 * s - sw * 0.55 * s, y, legs, lw);
    R(x - 0.47 * s, sh, 0.94 * s, 1.34 * s, coat);
    let a1 = -sw * 0.7, a2 = sw * 0.7, tool = o.tool && act !== 'walk' ? o.tool : null;
    if (act === 'work') { const q = still ? 0.4 : Math.max(0, Math.sin(ph)); a1 = 2.5 - 2.1 * q * q; a2 = a1 - 0.6; tool = o.tool || 'hoe'; }
    else if (act === 'carry') { a1 = 2.7; a2 = 2.9; }
    else if (act === 'cheer') { a1 = 2.7 + (still ? 0 : Math.sin(ph) * 0.35); a2 = 2.7 - (still ? 0 : Math.sin(ph) * 0.35); }
    else if (act === 'talk') { a1 = 1.5 + (still ? 0 : Math.sin(ph) * 0.5); a2 = 0.1; }
    else if (act === 'drill') { a1 = 0.6; a2 = 0; tool = 'pike'; }
    const L = 1.05 * s, ax = x + 0.36 * s * dir, bx = x - 0.36 * s * dir, ay = sh + 0.2 * s, hx = ax + Math.sin(a1) * L * dir, hy = ay + Math.cos(a1) * L;
    Ln(bx, ay, bx + Math.sin(a2) * L * dir, ay + Math.cos(a2) * L, dk(coat, 0.78), lw);
    if (tool) toolIn(tool, hx, hy, a1, dir, s, d);
    Ln(ax, ay, hx, hy, dk(coat, 0.88), lw);
    if (o.load) R(x - 0.8 * s, sh - 1 * s, 1.6 * s, 0.85 * s, tone(o.load, d));
    Ci(x, sh - 0.4 * s, 0.45 * s, skin);
    hat(o.hat | 0, x, sh - 0.4 * s, s, coat, d, dir);
    if (o.flag) pennant(x - 0.55 * s * dir, sh - 0.3 * s, s, o.flag, d);
    if (o.lamp && E.night > 0.3) { Ci(hx, hy + 0.3 * s, 1.5 * s, GLOW, 0.2 * E.night); Ci(hx, hy + 0.3 * s, 0.3 * s, GLOW, 1); }
  }
  function folk(i, salt) { const c = COATS[age], hs = HATS[age]; return { c: c[Math.floor(hh(i, salt) * c.length)], hat: hs[Math.floor(hh(i, salt + 1) * hs.length)], skirt: hh(i, salt + 2) < 0.38 }; }
  function worker(i, x, y, tool, s, rate) {
    const c = COATS[age], t = T0;
    man(x, y, (s || 1) * sy(y), { c: c[(i + 2) % c.length], hat: age >= 4 ? 4 : age === 3 ? 0 : 1, act: 'work', tool: tool, ph: t * (rate || 3.4) + i * 1.7, dir: i % 2 ? 1 : -1 });
  }

  /* ---------- animals, carts and other traffic ---------- */
  function beast(kind, x, y, s, dir, ph) {                 // ox, horse, cow or sheep; feet at (x, y)
    const d = dp(y), c = tone(kind === 'sheep' ? [232, 228, 214] : kind === 'horse' ? [112, 78, 54] : kind === 'ox' ? [150, 120, 92] : [228, 224, 216], d), dark = tone([52, 44, 40], d);
    const small = kind === 'sheep', L = (small ? 1.5 : 2.3) * s, B = (small ? 0.9 : 1.2) * s, leg = (small ? 0.7 : 1.35) * s, sw = Scene.still ? 0 : Math.sin(ph) * 0.35 * s;
    if (E.z * s < 1.2) { R(x - L, y - leg - B * 1.5, L * 2, B * 1.5 + leg * 0.5, c); return; }
    for (const q of [-0.72, -0.44, 0.44, 0.72]) Ln(x + q * L, y - leg, x + q * L + (q * q > 0.3 ? sw : -sw), y, dark, 0.3 * s);
    El(x, y - leg - B * 0.7, L, B, c);
    if (kind === 'cow') El(x - 0.3 * L, y - leg - B * 0.8, 0.42 * L, 0.5 * B, dark, 0.8);
    const hx = x + (L + 0.3 * s) * dir, hy = y - leg - B * (kind === 'horse' ? 1.75 : 1.0);
    if (kind === 'horse') P([x + 0.5 * L * dir, y - leg - B * 1.25, hx - 0.2 * s * dir, hy - 0.3 * s, hx + 0.25 * s * dir, hy + 0.45 * s, x + 0.95 * L * dir, y - leg - B * 0.4], c);
    El(hx, hy, 0.56 * s, 0.42 * s, small ? dark : c);
    if (kind === 'ox' || kind === 'cow') Ln(hx - 0.3 * s, hy - 0.42 * s, hx + 0.3 * s, hy - 0.56 * s, tone([236, 230, 210], d), 0.2 * s);
  }
  function cart(x, y, s, dir, kind, ph, u) {               // 1 ox cart, 2 covered wagon, 3 steam lorry, 4 car or bus, 5 pod
    const d = dp(y), wood = tone(PAL.timber, d), dark = tone([40, 38, 40], d);
    const wheel = function (wx, r) { Ci(wx, y - r, r, dark); Ci(wx, y - r, r * 0.45, tone([150, 140, 126], d)); };
    if (E.z * s < 1.15) { R(x - 3 * s, y - 2.6 * s, 6 * s, 2.3 * s, kind === 4 ? tone(CARS[Math.floor(u * 7)], d) : kind === 5 ? tone(PAL.pearl, d) : wood); return; }
    if (kind <= 2) {
      const bx = x - 1.4 * s * dir;
      R(bx - 2.6 * s, y - 2.6 * s, 5.2 * s, 1.5 * s, wood);
      if (kind === 2) { ctx.fillStyle = col(tone([232, 222, 198], d)); ctx.beginPath(); ctx.ellipse(bx, y - 2.6 * s, 2.5 * s, 2 * s, 0, Math.PI, TAU); ctx.fill(); }
      else { R(bx - 2.2 * s, y - 3.6 * s, 1.5 * s, 1 * s, tone([206, 178, 110], d)); R(bx - 0.5 * s, y - 3.8 * s, 1.6 * s, 1.2 * s, tone([188, 160, 104], d)); R(bx + 1.2 * s, y - 3.4 * s, 1.1 * s, 0.8 * s, tone([150, 110, 70], d)); }
      wheel(bx - 1.6 * s, 1.05 * s); wheel(bx + 1.6 * s, 1.05 * s);
      Ln(bx + 2.6 * s * dir, y - 1.9 * s, bx + 4.6 * s * dir, y - 2 * s, wood, 0.2 * s);
      beast(kind === 2 ? 'horse' : 'ox', bx + 6.6 * s * dir, y, s, dir, ph);
      man(bx + 2.1 * s * dir, y - 2.5 * s, s * 0.82, { c: [124, 98, 72], hat: kind, act: 'stand', dir: dir });
      return;
    }
    if (kind === 3) {
      R(x - 3.4 * s, y - 2.7 * s, 6.8 * s, 1.6 * s, tone([96, 48, 42], d)); R(x + (dir > 0 ? 1.2 : -3.2) * s, y - 4.4 * s, 2 * s, 1.8 * s, tone([62, 46, 42], d));
      R(x + (dir > 0 ? 2.4 : -3) * s, y - 5.8 * s, 0.6 * s, 1.5 * s, dark); smoke(x + 2.7 * s * dir, y - 6 * s, 0.7 * s, true, u);
      R(x - (dir > 0 ? 3.2 : -0.4) * s, y - 3.7 * s, 2.8 * s, 1 * s, tone([150, 124, 90], d));
      wheel(x - 2.1 * s, 1.1 * s); wheel(x + 2.1 * s, 1.1 * s); return;
    }
    if (kind === 4) {
      const big = u > 0.72, len = (big ? 8.4 : 4.8) * s, ht = (big ? 3.1 : 1.45) * s, c = tone(big ? [208, 62, 52] : CARS[Math.floor(u * 9.7) % 7], d), base = y - 0.85 * s;
      R(x - len / 2, base - ht, len, ht, c);
      const gl = E.night > 0.1 ? GLOW : tone([170, 200, 220], d);
      if (big) for (let i = 0; i < 5; i++) R(x - len / 2 + 0.6 * s + i * 1.5 * s, base - ht + 0.45 * s, 1.1 * s, 1.1 * s, gl, 0.9);
      else { R(x - len * 0.27, base - ht - 1.1 * s, len * 0.54, 1.15 * s, dk(c, 0.9)); R(x - len * 0.22, base - ht - 0.9 * s, len * 0.44, 0.72 * s, gl, 0.9); }
      wheel(x - len * 0.3, 0.75 * s); wheel(x + len * 0.3, 0.75 * s);
      if (E.night > 0.2) { Ci(x + len / 2 * dir, base - 0.5 * s, 0.4 * s, [255, 244, 200], 1); Ci(x + (len / 2 + 2 * s) * dir, base - 0.4 * s, 2.4 * s, [255, 244, 200], 0.12 * E.night); }
      return;
    }
    const hy = y - 1.5 * s + (Scene.still ? 0 : Math.sin(ph * 0.35) * 0.2 * s), c = tone(PAL.pearl, d);
    El(x, y - 0.12 * s, 2.5 * s, 0.36 * s, CYAN, 0.22 + 0.22 * E.night);
    El(x, hy - 1 * s, 3 * s, 1.25 * s, c); El(x + 0.7 * s * dir, hy - 1.25 * s, 1.5 * s, 0.7 * s, E.night > 0.1 ? CYAN : tone([120, 170, 200], d), 0.9);
  }
  function bird(x, y, s, flap, c, a) {
    const f = Math.sin(flap) * 0.9 * s;
    ctx.strokeStyle = col(c, a === undefined ? 0.9 : a); ctx.lineWidth = 0.3 * s; ctx.beginPath(); ctx.moveTo(x - 1.7 * s, y - f);
    ctx.quadraticCurveTo(x - 0.6 * s, y - 0.55 * s - f * 0.3, x, y); ctx.quadraticCurveTo(x + 0.6 * s, y - 0.55 * s - f * 0.3, x + 1.7 * s, y - f); ctx.stroke();
  }

  /* ---------- props ---------- */
  function lamp(x, y) {
    const d = dp(y), c = tone(age >= 5 ? PAL.pearl : PAL.iron, d), lit = E.night > 0.15;
    Ln(x, y, x, y - 4.4, c, 0.22);
    if (age >= 5) R(x - 0.5, y - 5, 1, 0.5, lit ? CYAN : c, 1); else R(x - 0.42, y - 5.1, 0.84, 0.8, lit ? GLOW : tone([190, 200, 206], d), lit ? 1 : 0.8);
    if (lit) Ci(x, y - 4.7, 3.4, age >= 5 ? CYAN : GLOW, 0.11 * E.night);
  }
  function well(x, y) {
    const d = dp(y), st = tone(PAL.stone, d), wd = tone(PAL.timber, d);
    if (age <= 2) { R(x - 1.5, y - 1.3, 3, 1.3, st); R(x + 0.3, y - 1.3, 1.2, 1.3, dk(st, 0.84)); Ln(x - 1.3, y - 1.3, x - 1.3, y - 3.6, wd, 0.25); Ln(x + 1.3, y - 1.3, x + 1.3, y - 3.6, wd, 0.25); P([x - 1.9, y - 3.5, x, y - 4.6, x + 1.9, y - 3.5], tone(age === 1 ? PAL.thatch : PAL.terra, d)); return; }
    if (age <= 4) {                                         // a fountain
      El(x, y - 0.3, 2.6, 0.7, st); R(x - 2.6, y - 0.9, 5.2, 0.7, st); R(x - 0.4, y - 2.8, 0.8, 2, dk(st, 0.9)); El(x, y - 0.9, 2.3, 0.45, tone([120, 170, 200], d), 0.9);
      if (!Scene.still) for (let i = 0; i < 4; i++) { const f = (E.t * 1.4 + i / 4) % 1; Ci(x + (i % 2 ? 1 : -1) * f * 1.6, y - 2.9 + f * f * 2, 0.22, [230, 242, 250], 0.8 * (1 - f)); }
      return;
    }
    Ln(x, y, x, y - 3.4, tone(PAL.pearl, d), 0.4); Ci(x, y - 4.2, 1.1, CYAN, 0.5 + 0.3 * E.night); Ci(x, y - 4.2, 2.8, CYAN, 0.1 + 0.1 * E.night);      // a light on a mast
  }
  function stall(x, y, c) {
    const d = dp(y), s = sy(y), wd = tone(PAL.timber, d);
    Ln(x - 2.7 * s, y, x - 2.7 * s, y - 4 * s, wd, 0.25 * s); Ln(x + 2.7 * s, y, x + 2.7 * s, y - 4 * s, wd, 0.25 * s); R(x - 2.9 * s, y - 2.1 * s, 5.8 * s, 0.5 * s, wd);
    for (let i = 0; i < 5; i++) P([x - 3.3 * s + i * 1.32 * s, y - 3.9 * s, x - 1.98 * s + i * 1.32 * s, y - 3.9 * s, x - 2.1 * s + i * 1.2 * s, y - 5.3 * s, x - 3 * s + i * 1.2 * s, y - 5.3 * s], tone(i % 2 ? [240, 234, 220] : c, d));
    for (let i = 0; i < 4; i++) Ci(x - 1.8 * s + i * 1.2 * s, y - 2.4 * s, 0.42 * s, tone([[214, 90, 60], [226, 190, 80], [120, 160, 90], [200, 120, 70]][i], d));
  }
  function bunting(x0, x1, y) {
    const d = dp(y), cs = [[196, 60, 50], [230, 196, 70], [62, 110, 170], [240, 234, 220]];
    Ln(x0, y, x0, y - 6.2, tone(PAL.timber, d), 0.25); Ln(x1, y, x1, y - 6.2, tone(PAL.timber, d), 0.25);
    const nn = Math.round((x1 - x0) / 1.7);
    for (let i = 0; i < nn; i++) { const f = (i + 0.5) / nn, x = x0 + (x1 - x0) * f, sag = Math.sin(f * Math.PI) * 1.5; P([x - 0.6, y - 6.1 + sag, x + 0.6, y - 6.1 + sag, x, y - 5 + sag], tone(cs[i % 4], d)); }
    ctx.strokeStyle = col(tone([90, 80, 70], d), 0.8); ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(x0, y - 6.1); ctx.quadraticCurveTo((x0 + x1) / 2, y - 3.1, x1, y - 6.1); ctx.stroke();
  }
  function plot(x, y, w) {                                 // ground pegged out for something not yet built
    const d = dp(y), s = sy(y), wd = tone(PAL.timber, d);
    for (const px of [x - w / 2, x + w / 2]) Ln(px, y, px, y - 1.8 * s, wd, 0.3 * s);
    ctx.strokeStyle = col(tone([226, 214, 180], d), 0.9); ctx.lineWidth = 0.14 * s; ctx.setLineDash([0.8 * s, 0.6 * s]); ctx.beginPath(); ctx.moveTo(x - w / 2, y - 1.5 * s); ctx.lineTo(x + w / 2, y - 1.5 * s); ctx.stroke(); ctx.setLineDash([]);
    Ln(x, y, x, y - 3.4 * s, wd, 0.3 * s); R(x - 1.5 * s, y - 4.4 * s, 3 * s, 1.5 * s, tone([226, 214, 180], d)); Ln(x - 0.9 * s, y - 3.65 * s, x + 0.9 * s, y - 3.65 * s, wd, 0.16 * s);
  }
  function hoist(x, y, h) {                                // a block going up a rope
    const f = Scene.still ? 0.5 : 0.5 + 0.5 * Math.sin(E.t * 0.7), d = dp(y);
    Ln(x, y - h, x, y - h * f - 1.2, tone([90, 80, 70], d), 0.14); R(x - 1.1, y - h * f - 1.2, 2.2, 1.4, tone(PAL.lime, d));
  }
  function tent(x, y, s, c, d) { P([x - 2.2 * s, y, x, y - 2.6 * s, x + 2.2 * s, y], tone(c, d)); P([x - 0.5 * s, y, x, y - 1.5 * s, x + 0.5 * s, y], tone([40, 30, 30], d)); }
  function puff(x, y, r, a) { Ci(x, y, r, tone([214, 204, 186], 0.05), a); }

  /* ---------- where things stand ---------- */
  function spot(id) {                                      // the patch of ground a kind of building takes: x, y, width, height
    const port = n('port') > 0;
    switch (id) {
      case 'farm': return port ? [4, 156, 64, 42] : [6, 156, 140, 42];
      case 'lumber': return age <= 2 ? [272, 163, 78, 17] : null;
      case 'script': return [250, 106, 34, 16];
      case 'guild': return [140, 132, 22, 19];
      case 'mason': return age > 3 ? null : age === 3 ? [214, 168, 34, 21] : [248, 168, 36, 21];
      case 'univ': return [221, 118, 36, 24];
      case 'bank': return [203, 133, 22, 18];
      case 'steel': return [248, 142, 80, 30];
      case 'obs': return [267, 90, 22, 15];
      case 'exch': return [200, 88, 45, 46];
      case 'refin': return [292, 156, 50, 36];
      case 'inst': return [242, 104, 38, 15];
      case 'port': return [70, 158, 84, 30];
      case 'fab': return [208, 181, 54, 13];
      case 'array': return [320, 90, 38, 15];
    }
    return null;
  }
  function stand(id) {                                     // where the main building of a kind stands: its door, more or less
    switch (id) {
      case 'farm': return [44, 161.5]; case 'lumber': return [298, 177.5]; case 'script': return [262, 122]; case 'guild': return [151, 151.4]; case 'mason': return [age === 3 ? 230 : 264, 189];
      case 'univ': return [234, 142]; case 'bank': return [214, 151.4]; case 'steel': return [268, 172]; case 'obs': return [282, 105.5]; case 'exch': return [222, 135];
      case 'refin': return [316, 192]; case 'inst': return [262, 119]; case 'port': return [106, 187]; case 'fab': return [232, 194]; case 'array': return [338, 100.5];
    }
    return null;
  }
  const WORK = [null, [171, 92, 42, 59], [24, 112, 104, 42], [0, 110, 148, 28], [10, 88, 72, 28], [84, 66, 30, 50]];        // the great works
  function workMark() {                                    // where the next stage is going up
    const st = S.project;
    if (age === 1) return [188, 132 - st * 9];
    if (age === 2) return [[56, 134], [114, 124], [126, 127], [82, 108]][Math.min(3, st)];
    if (age === 3) return [[126, 119], [60, 117], [138, 107], [60, 117]][Math.min(3, st)];
    return age === 4 ? [40, 84] : [98, 62];
  }
  function lore() { for (const id of ['array', 'inst', 'obs', 'univ', 'script']) if (n(id)) return id; return null; }       // where the newest learning is done
  const LORE = { script: [262, 104], univ: [234, 114], obs: [282, 86], inst: [262, 100], array: [338, 86] };

  /* ---------- a frame begins ---------- */
  City.begin = function (env, context, state, facts, stageOf) {
    E = env; ctx = context; S = state; F = facts || {}; stage = stageOf; age = S.age; T0 = Scene.still ? 1000 : E.t;
    return true;
  };

  /* birds over the land */
  City.sky = function () {
    if (Scene.still || E.night > 0.7) return;
    const per = 46, f = (E.t / per) % 1, c = tone([40, 40, 48], 0.3);
    if (f < 0.5) for (let i = 0; i < 7; i++) {
      const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1, x = -20 + f * 2 * 400 - row * 4.2, y = 58 + Math.sin(f * 6) * 5 + side * row * 2.1 - f * 14;
      bird(x, y, 0.8, E.t * 7 + i, c, 0.75);
    }
  };

  /* the far shore: the reactor and the Ark while they are being built */
  City.far = function () {
    if (age < 4 || !F.projectOpen || Scene.still) return;
    const x0 = age === 4 ? 18 : 90, x1 = age === 4 ? 78 : 106, top = age === 4 ? 20 : 44;
    for (let i = 0; i < 5; i++) {                           // welding
      const on = Math.sin(E.t * (9 + i * 2.3) + i * 4) > 0.55 && ((E.t * 0.4 + i * 0.37) % 1) < 0.6;
      if (on) { const x = x0 + hh(i, 61) * (x1 - x0), y = 115 - hh(i, 62) * top; Ci(x, y, 0.5, [255, 250, 220], 1); Ci(x, y, 1.8, [160, 210, 255], 0.3); }
    }
    for (let i = 0; i < 3; i++) { const f = (E.t * 0.02 + i * 0.37) % 1, x = 150 - f * (150 - x1); R(x, 115.2, 2.2, 0.9, tone([200, 150, 60], 0.36)); R(x + (i % 2 ? 2.2 : -0.7), 115.4, 0.7, 0.7, tone([60, 60, 66], 0.36)); }
  };

  /* the bay: a boat at work and gulls */
  City.bay = function () {
    const t = T0;
    if (age <= 3) {
      const per = 150, f = (t / per) % 1, out = f < 0.5, u = out ? f * 2 : 2 - f * 2, x = 8 + u * 112, y = 146.5 + Math.sin(u * 5) * 1.2 + (Scene.still ? 0 : Math.sin(E.t * 0.9) * 0.3), d = 0.12, dir = out ? 1 : -1;
      P([x - 3.6, y - 1.1, x + 3.6, y - 1.1, x + 2.6, y, x - 2.6, y], tone([104, 74, 52], d));
      Ln(x - 0.4 * dir, y - 1.1, x - 0.4 * dir, y - 5.6, tone(PAL.timber, d), 0.22); P([x - 0.2 * dir, y - 5.4, x + 2.6 * dir, y - 1.7, x - 0.2 * dir, y - 1.7], tone([232, 220, 196], d));
      if (E.z > 1.6) { R(x - 1.9 * dir - 0.3, y - 2.6, 0.7, 1.5, tone(COATS[age][1], d)); Ci(x - 1.9 * dir, y - 3, 0.36, tone(SKIN, d)); }
    }
    if (!Scene.still && E.night < 0.6 && stage(2) >= 1) for (let i = 0; i < 3; i++) {
      const a = E.t * (0.35 + i * 0.07) + i * 2.1; bird(58 + Math.cos(a) * (13 + i * 4), 127 + Math.sin(a) * (4 + i), 0.5, E.t * 6 + i * 2, tone([244, 244, 246], 0.1), 0.9);
    }
  };

  /* everything that stands on the land, sorted with the houses by how far down the picture it is */
  City.town = function (put, info) {
    const t = T0, city = E.city, day = clamp((E.L - 0.3) / 0.5, 0.1, 1), nowMs = E.ms;
    const edict = S.edict && S.edict.until > nowMs ? S.edict.id : null;
    const fest = info.events.some(function (ev) { return ev.k === 'rank' && nowMs - ev.t < 9000; });      // the town has just grown a rank
    const share = function (job) { return F.jobs ? 0.45 + 0.16 * (F.jobs[job] || 0) : 1; };              // more hands where the people have been sent

    /* places that can be touched, back to front */
    site('town', 118, 120, 138, 31);
    if (root.Town) root.Town.sites();
    for (let a = 1; a <= Math.min(5, age); a++) if (a < age || F.projectOpen || S.project > 0) { const w = WORK[a]; site('work:' + a, w[0], w[1], w[2], w[3]); }
    for (const b of Core.BUILDINGS) { const q = spot(b.id); if (q && (n(b.id) || (F.plots || []).indexOf(b.id) >= 0)) site('b:' + b.id, q[0], q[1], q[2], q[3]); }
    site('keep', 291, 63, 38, 34);

    /* the street: a well or a fountain, lamps, goods by the guild */
    put(153.3, function () { well(168.5, 153.3); });
    if (age >= 3) for (const x of [124, 146, 204, 226, 248]) put(151.2, function () { lamp(x, 151.5); });

    /* townsfolk walking the street; fewer after dark, more at a fair */
    const out = Math.round(clamp(info.count * 0.85 + (edict === 'fair' ? 8 : 0), 3, 34) * day);
    for (let i = 0; i < out; i++) {
      const a = 112 + hh(i, 1) * 106, len = Math.min(254 - a, 16 + hh(i, 2) * 64), v = 1.2 + hh(i, 3) * 1.3;
      let p = (t * v + hh(i, 4) * 2 * len) % (2 * len); const dir = p < len ? 1 : -1; if (p >= len) p = 2 * len - p;
      const x = a + p, y = 151.9 + hh(i, 5) * 2.4, o = folk(i, 6);
      o.act = 'walk'; o.ph = t * v * 2.4 + i; o.dir = dir; o.lamp = hh(i, 9) < 0.4; if (hh(i, 10) < 0.16) { o.act = 'carry'; o.load = [176, 140, 96]; }
      if (fest && i % 2 === 0) { o.act = 'cheer'; o.ph = t * 6 + i; }
      put(y, function () { man(x, y, sy(y), o); });
    }
    /* carts and, later, cars on the road out of town */
    const wheels = (age >= 4 ? 4 : Math.min(3, 1 + Math.floor(info.total / 30)) + (edict === 'levy' ? 2 : 0)) + Math.min(3, F.routes || 0), kind = age;      // every route found puts another cart on the road
    for (let i = 0; i < wheels; i++) {
      const per = (age >= 4 ? 15 : age === 3 ? 26 : 40) + i * 7, q = t / per + hh(i, 11) * 3, f = q % 1, outb = (Math.floor(q) + i) % 2 === 0, u = outb ? f : 1 - f, pt = roadAt(u), side = (outb ? 1 : -1) * (age >= 4 ? 1.5 : 0.9);
      put(pt.y, function () { cart(pt.x + side * sy(pt.y), pt.y, sy(pt.y) * (kind <= 2 ? 0.8 : 0.9), outb ? 1 : -1, kind === 3 && i % 2 ? 2 : kind, t * 4 + i, hh(i, 12)); });
    }
    if (age >= 4) for (let i = 0; i < (age === 4 ? 4 : 3); i++) {                           // traffic along the front
      const per = 17 + i * 5, q = t / per + hh(i, 13) * 3, f = q % 1, right = i % 2 === 0, x = right ? 112 + f * 142 : 254 - f * 142, y = right ? 153.9 : 152.6;
      put(y + 0.4, function () { cart(x, y + 0.5, 0.8, right ? 1 : -1, kind, t * 4 + i, hh(i, 14)); });
    }

    /* the fields: hands at work, beasts at grass */
    const farms = n('farm'), port = n('port');
    if (farms) {
      const cols = port ? 3 : 7, tilled = Math.min(farms, cols * 6), rows = Math.min(cols, tilled), deep = Math.ceil(tilled / cols) * 6, hands = Math.round(Math.min(9, 1 + farms / 6) * (0.3 + 0.7 * day) * share('gold'));
      for (let i = 0; i < hands; i++) { const fi = i % rows, y = 162.6 + hh(i, 21) * Math.max(1, deep - 3), x = 14 + fi * 18.5 + 3 + hh(i, 22) * 9 - (y - 161) * 0.26; put(y, function () { worker(i, x, y, age >= 4 ? 'shovel' : 'hoe', 0.95, 2.6 + hh(i, 23)); }); }
      if (age <= 4 && farms >= 3) for (let i = 0; i < Math.min(4, 1 + Math.floor(farms / 12)); i++) { const x = (port ? 44 : 60) + i * 9 + hh(i, 24) * 3, y = 156.6 + hh(i, 25) * 1.6; put(y, function () { beast('cow', x, y, 0.8, i % 2 ? 1 : -1, 0); }); }
      if (E.z > 1.6 && !port) for (let i = 0; i < 2; i++) put(159.2, function () { const d = dp(159); Dome(112 + i * 5, 159.4, 2, 2.4, tone([214, 186, 104], d)); });    // ricks
    }
    if (age <= 3) for (let i = 0; i < 5; i++) {                                              // sheep on the meadow, either side of the road
      const left = i % 2 === 0, x = (left ? 146 : 212) + hh(i, 26) * 24 + Math.sin(t * 0.05 + i) * 2, y = 157.5 + hh(i, 27) * 9;
      put(y, function () { beast('sheep', x, y, 0.75 * sy(y), hh(i, 28) < 0.5 ? 1 : -1, t * 2 + i); });
    }

    /* work at the places the realm owns */
    const crews = function (id, k, f) { const c = n(id); if (c) for (let i = 0; i < Math.round(Math.min(k + 1, (1 + c / 8) * share(Core.B[id].res)) * (0.4 + 0.6 * day)); i++) f(i); };
    if (age <= 2) crews('lumber', 4, function (i) { const x = 300 + i * 7.5 + hh(i, 31) * 2, y = 182.6 + (i % 2) * 1.4; put(y, function () { worker(i, x, y, 'axe', 1, 3.6); }); });
    if (age <= 3) crews('mason', 3, function (i) { const x = (age === 3 ? 228 : 262) + 3 + i * 6, y = 189.4 + (i % 2) * 1.2; put(y, function () { worker(i, x, y, 'hammer', 1, 4.2); }); });
    crews('script', 2, function (i) { const x = 256 + ((t * 0.6 + i * 9) % 18), y = 122 + i * 0.6; put(y, function () { man(x, y, sy(y), { c: [84, 66, 54], hat: 1, act: 'walk', ph: t * 2 + i, dir: 1 }); }); });
    crews('univ', 3, function (i) { const x = 226 + i * 6 + Math.sin(t * 0.3 + i * 2) * 2.5, y = 142.3 + (i % 2) * 0.7; put(y, function () { man(x, y, sy(y), { c: [40, 40, 52], hat: age >= 3 ? 3 : 2, act: i ? 'stand' : 'talk', ph: t * 3, dir: i % 2 ? -1 : 1 }); }); });
    crews('steel', 3, function (i) { const x = 254 + ((t * 1.1 + i * 11) % 30), y = 172.6 + i * 0.9; put(y, function () { man(x, y, sy(y), { c: [70, 62, 58], hat: age >= 4 ? 4 : 0, act: 'carry', load: [150, 152, 158], ph: t * 3 + i, dir: 1 }); }); });
    crews('refin', 2, function (i) { const x = 300 + i * 14 + Math.sin(t * 0.25 + i) * 3, y = 192.6; put(y, function () { man(x, y, sy(y), { c: [236, 150, 50], hat: 4, act: 'walk', ph: t * 3 + i, dir: i ? -1 : 1 }); }); });
    crews('inst', 2, function (i) { const x = 250 + i * 12 + Math.sin(t * 0.3 + i * 3) * 3, y = 119.2; put(y, function () { man(x, y, sy(y), { c: [236, 238, 240], hat: 0, act: 'walk', ph: t * 3 + i, dir: i ? -1 : 1 }); }); });
    crews('port', 3, function (i) { const x = 84 + i * 13 + Math.sin(t * 0.3 + i) * 3, y = 187.4 + (i % 2); put(y, function () { man(x, y, sy(y), { c: [240, 150, 60], hat: 5, act: 'walk', ph: t * 3 + i, dir: i % 2 ? 1 : -1 }); }); });
    if (n('fab') && !Scene.still) for (let i = 0; i < 2; i++) {                              // carriers between the fabricator and the pads
      const f = (t * 0.04 + i * 0.5) % 1, back = Math.floor(t * 0.04 + i * 0.5) % 2, u = back ? 1 - f : f, x = 224 - u * 96, y = 193 - Math.sin(u * Math.PI) * 26 - u * 9;
      put(194, function () { R(x - 1.2, y - 0.4, 2.4, 0.8, tone(PAL.pearl, 0.03)); Ci(x - 1.3, y - 0.5, 0.45, CYAN, 0.9); Ci(x + 1.3, y - 0.5, 0.45, CYAN, 0.9); if (!back) R(x - 0.6, y + 0.4, 1.2, 0.9, tone([200, 150, 60], 0.03)); });
    }
    if (port && !Scene.still && !info.lift) {                                                // cargo to orbit on a timetable
      const f = (t / 52) % 1;
      if (f < 0.16) { const g = f / 0.16, x = 127 + g * g * 26, y = 177 - g * g * 150; put(187, function () { P([x - 1.6, y + 3, x, y - 3.4, x + 1.6, y + 3], tone(PAL.pearl, 0.05)); P([x - 1, y + 3, x, y + 5 + 3 * Math.sin(E.t * 30), x + 1, y + 3], [255, 200, 110], 0.95); for (let i = 0; i < 6; i++) { const b = i / 6; Ci(x - b * g * 12 + Math.sin(i) * 0.6, y + 5 + b * g * 60, 1 + b * 2.4, tone([236, 236, 240], 0.1), 0.34 * (1 - b)); } }); }
    }
    if (stage(2) >= 1 && E.z > 1.2) for (let i = 0; i < Math.round(3 * day); i++) {            // the harbor: hands on the breakwater
      const u = ((t * 0.02 + i * 0.31) % 1), back = Math.floor(t * 0.02 + i * 0.31) % 2, f = back ? 1 - u : u, x = 34 + f * 46, y = 151.4 - f * 9;
      put(y, function () { man(x, y - 0.6, 0.8, { c: COATS[age][(i + 1) % 6], hat: age >= 4 ? 4 : 1, act: back ? 'walk' : 'carry', load: back ? null : [150, 110, 70], ph: t * 3 + i, dir: back ? -1 : 1 }); });
    }
    put(96.2, function () {                                                                   // watch on the keep
      for (let i = 0; i < 2; i++) { const p = (t * 0.5 + i * 23) % 56, back = p >= 28; man(296 + (back ? 56 - p : p), 89.2, 0.5, { c: [120, 60, 54], hat: 6, act: 'drill', dir: back ? -1 : 1 }); }
    });

    /* the great work of the age: a gang on the site */
    if (F.projectOpen) crew(put);
    /* ground pegged out for buildings not yet bought */
    if (E.z > 0.9) for (const id of F.plots || []) { const q = spot(id) && stand(id); if (q) put(q[1], function () { plot(q[0], q[1], 9 * sy(q[1])); }); }

    /* heroes: at home by the well, or on the road */
    const hc = F.hc || {}, home = F.home || [];
    home.forEach(function (id, i) {
      const x = 160.5 - i * 2.3, y = 154.9 + (i % 2) * 0.8;
      put(y, function () { man(x, y, sy(y) * 1.06, { c: hc[id] || [200, 200, 200], hat: 6, act: i === 0 ? 'drill' : 'stand', dir: 1, flag: i === 0 ? [196, 60, 50] : null }); });
    });
    if (home.length) site('heroes', 160.5 - home.length * 2.3 - 1, 149.5, home.length * 2.3 + 4, 7);
    for (const p of S.parties) {
      const gone = (nowMs - p.t0) / 1000, left = (p.t1 - nowMs) / 1000, walk = 26;
      let u = -1, outb = true;
      if (gone >= 0 && gone < walk) u = 0.02 + gone / walk * 1.05; else if (left >= 0 && left < walk) { u = 0.02 + left / walk * 1.05; outb = false; }
      if (u < 0) continue;
      p.h.forEach(function (id, i) {
        const pt = roadAt(clamp(u - i * 0.045 * (outb ? 1 : -1), 0, 1.3));
        put(pt.y, function () { man(pt.x + (i % 2 ? 0.9 : -0.9), pt.y, sy(Math.min(pt.y, 200)) * 1.06, { c: hc[id] || [200, 200, 200], hat: 6, act: 'walk', ph: t * 5 + i * 2, dir: outb ? 1 : -1, flag: i === 0 ? [196, 60, 50] : null }); });
      });
    }
    for (const r of S.reports) {                                                             // just back: they stand in the street for a while
      const since = (nowMs - r.t) / 1000;
      if (since < 0 || since > 45 || !r.h) continue;
      r.h.forEach(function (id, i) {
        const x = 181 + i * 2.4, y = 155.2 + (i % 2) * 0.7, win = r.result === 'win';
        put(y, function () { man(x, y, sy(y) * 1.06, { c: hc[id] || [200, 200, 200], hat: 6, act: win ? 'cheer' : 'stand', ph: t * 6 + i, dir: -1, flag: i === 0 ? (win ? [230, 196, 70] : [110, 110, 116]) : null }); });
      });
      if (r.result === 'win') put(155.9, function () { const d = dp(156); R(178, 154.6, 2.2, 1.4, tone([150, 104, 60], d)); R(178, 154.4, 2.2, 0.5, tone([230, 196, 70], d)); });
    }

    /* news waiting at the market cross: a crier with a bell */
    if (F.news) {
      site('news', 243, 144.5, 13, 10);
      put(153.2, function () { man(247.2, 153.2, sy(153.2) * 1.05, { c: [150, 52, 48], hat: age >= 4 ? 0 : 2, act: 'cheer', ph: t * 5, dir: -1, flag: [230, 196, 70] }); });
    }
    /* items kept in the town stand on plinths before the great door */
    for (let i = 0; i < Math.min(4, F.kept || 0); i++) put(154.3, function () { const x = 197 + i * 2.8, d = dp(154.3); R(x - 0.8, 153.2, 1.6, 1.1, tone(PAL.stone, d)); R(x - 1, 153, 2, 0.3, tone(PAL.stoneD, d)); Ci(x, 152.5, 0.55, tone([230, 196, 70], d)); if (!Scene.still && Math.sin(E.t * 1.7 + i * 2) > 0.86) Ci(x + 0.3, 152.2, 0.3, [255, 255, 255], 0.9); });

    /* an edict in force changes the street */
    if (fest) {
      put(150.95, function () { bunting(126, 170, 151.4); bunting(204, 248, 151.4); });
    }
    if (edict === 'fair') {
      put(150.95, function () { bunting(158, 200, 151.4); });
      [[152, [196, 60, 50]], [178, [62, 110, 170]], [205, [90, 150, 110]]].forEach(function (q) { put(151.6, function () { stall(q[0], 151.7, q[1]); }); });
    } else if (edict === 'levy') {
      for (let i = 0; i < 4; i++) { const pt = roadAt(1 - ((t * 0.03 + i * 0.25) % 1)); put(pt.y, function () { man(pt.x - 1.4, pt.y, sy(pt.y), { c: COATS[age][i % 6], hat: age >= 4 ? 4 : 1, act: 'carry', load: i % 2 ? [150, 110, 70] : [186, 180, 168], ph: t * 3.4 + i, dir: -1 }); }); }
    } else if (edict === 'symposium') {
      const q = LORE[lore() || 'script'], bx = q[0], by = lore() ? spot(lore())[1] + spot(lore())[3] + 1.4 : 123;
      for (let i = 0; i < 6; i++) { const a = -0.3 + i / 5 * (Math.PI + 0.6), x = bx + Math.cos(a) * 7, y = by + Math.sin(a) * 1.3 + 1; put(y, function () { man(x, y, sy(y), { c: i === 0 ? [62, 90, 150] : [44, 44, 58], hat: age >= 3 ? 3 : 1, act: i === 0 ? 'talk' : 'stand', ph: t * 3, dir: x < bx ? 1 : -1, flag: i === 0 ? [80, 120, 200] : null }); }); }
    } else if (edict === 'muster') {
      for (let i = 0; i < 8; i++) { const x = 149 + (i % 4) * 2.8, y = 158.5 + Math.floor(i / 4) * 2.3; put(y, function () { man(x, y, sy(y), { c: [150, 52, 48], hat: 6, act: 'drill', dir: 1 }); }); }
      put(158, function () { man(145, 158, sy(158), { c: [70, 50, 44], hat: 6, act: 'talk', ph: t * 4, dir: 1, flag: [196, 60, 50] }); });
    }
    if (F.edicts) site('edict', 162, 146.5, 13, 8.5);                                         // the well, where edicts are cried

    /* the enemy of the age, in sight until it is beaten */
    if (F.trial) threat(put);

    /* things that have just happened */
    for (const ev of info.events) {
      const a = (nowMs - ev.t) / 1000;
      if (a < 0) continue;
      if (ev.k === 'buy' && a < 2) { const q = spot(ev.id) && stand(ev.id); if (q) put(q[1] + 0.6, function () { dust(q[0], q[1], 12 * sy(q[1]), a / 2); }); }
      else if (ev.k === 'mark' && a < 3) { const q = spot(ev.id) && stand(ev.id); if (q) put(q[1] + 0.7, function () { dust(q[0] + 6, q[1], 18 * sy(q[1]), a / 3); }); }
      else if (ev.k === 'post' && a < 3) { const q = root.Town && root.Town.post(ev.id); if (q && !q[4]) put(q[1] + 0.7, function () { dust(q[0], q[1], 9, a / 3); }); }
      else if (ev.k === 'lm' && a < 3) { const q = root.Town && root.Town.at(ev.id); if (q) put(q[1] + 0.7, function () { dust(q[0], q[1], Math.max(10, q[2]) * sy(q[1]), a / 3); }); }
      else if (ev.k === 'work' && a < 0.55) put(170.2, function () { man(118, 170, sy(170), { c: COATS[age][0], hat: age >= 4 ? 4 : 1, act: 'work', tool: 'hoe', ph: 0.4 + a / 0.55 * 2.6, dir: 1 }); Ci(121, 168.5 - a * 9, 0.7, [244, 203, 94], 1 - a / 0.55); });
    }
  };

  function dust(x, y, w, f) {                              // a building going up: poles for a moment, dust, sparks, hands
    const s = w / 12, tb = tone(PAL.timber, 0.05), a = Math.min(1, (1 - f) * 2.5), h = 8 * s;
    for (let i = 0; i < 3; i++) Ln(x - w / 2 + i * w / 2, y, x - w / 2 + i * w / 2, y - h, tb, 0.32 * s, a);
    Ln(x - w / 2, y - h * 0.55, x + w / 2, y - h * 0.55, tb, 0.26 * s, a); Ln(x - w / 2, y - h, x + w / 2, y - h, tb, 0.26 * s, a); Ln(x - w / 2, y - h * 0.55, x, y - h, tb, 0.2 * s, a);
    for (let i = 0; i < 9; i++) puff(x + (hh(i, 71) - 0.5) * w * (1 + f * 0.8), y - 0.4 * s - f * (2 + hh(i, 72) * 6) * s, (1.3 + f * 3.4) * s, 0.5 * (1 - f));
    for (let i = 0; i < 7; i++) { const g = (f * 2.2 + i * 0.17) % 1; Ci(x + (hh(i, 73) - 0.5) * w, y - (2 + hh(i, 74) * 5 + g * 2.5) * s, 0.4 * s, [255, 236, 170], (1 - f) * (1 - g)); }
    if (f < 0.8) for (let i = 0; i < 2; i++) worker(i + 5, x + (i ? 1 : -1) * w * 0.32, y + 0.3, 'hammer', s / sy(y + 0.3) * 0.9, 9);
  }

  /* the gang on the great work */
  function crew(put) {
    const st = S.project, k = F.stageReady ? 5 : F.building > 0 ? Math.max(2, Math.min(6, Math.round(F.building))) : 1;      // as many hands as there is work an hour
    const hand = function (i, x, y, tool, s) { put(y + 0.02, function () { worker(i + 3, x, y, tool, s, 3 + (i % 3) * 0.6); }); };
    if (age === 1) {
      if (st === 0) for (let i = 0; i < k; i++) hand(i, 173 + i * 6.4, 151.5 + (i % 2) * 0.5, i % 2 ? 'shovel' : 'pick');
      else if (st === 1) { for (let i = 0; i < k; i++) hand(i, 174 + i * 7.2, 151.4, 'hammer'); put(150.62, function () { hoist(197, 150.5, 11); for (let i = 0; i < 2; i++) worker(i, 180 + i * 16, 143.5, 'hammer', 0.9, 3.8); }); }
      else { for (let i = 0; i < k; i++) hand(i, 166 + i * 2.6, 151.5 + (i % 2) * 0.5, 'hammer'); put(150.62, function () { hoist(170.5, 150.5, 31); for (let i = 0; i < 2; i++) worker(i, 174 + i * 5, 132.5 - i * 6, 'hammer', 0.9, 3.8); }); }
    } else if (age === 2) {
      const at = [[40, 150.6, 62, 146.2], [107, 151.5, 120, 136], [119, 144.6, 132, 144.4], [78, 144.6, 86, 143.6]][Math.min(3, st)];
      for (let i = 0; i < k; i++) { const f = k > 1 ? i / (k - 1) : 0, x = at[0] + (at[2] - at[0]) * f, y = at[1] + (at[3] - at[1]) * f; hand(i, x, y, i % 2 ? 'hammer' : 'pick', 0.85); }
      if (st === 3) put(142.7, function () { hoist(85.5, 142.6, 22); });
    } else if (age === 3) {
      const at = [[116, 131.6, 134, 131.4], [112, 131.5, 130, 131.2], [130, 130.6, 146, 130.4], [40, 127.6, 100, 127.6]][Math.min(3, st)];
      for (let i = 0; i < k; i++) { const f = k > 1 ? i / (k - 1) : 0; hand(i, at[0] + (at[2] - at[0]) * f, at[1] + (at[3] - at[1]) * f, i % 2 ? 'hammer' : 'pick', st === 3 ? 0.7 : 0.8); }
      if (st === 1 || st === 2) put(131.3, function () { const c = tone(PAL.iron, 0.2), x = st === 1 ? 126 : 150; Ln(x, 131, x, 119, c, 0.5); Ln(x, 119, x - 9, 121.5, c, 0.4); Ln(x - 9, 121.5, x - 9, 124 + Math.sin(E.t * 0.8) * 2, c, 0.15); R(x - 1.5, 129.4, 3, 1.8, tone([60, 44, 40], 0.2)); smoke(x + 0.6, 128.4, 0.6, true, 0.3); });
    }
  }

  /* the trial of the age, waiting */
  function threat(put) {
    const fl = Scene.still ? 0 : Math.sin(E.t * 2.6);
    if (age === 1) {                                        // the warlord's camp on the high pass
      site('trial', 226, 86, 34, 14);
      put(96, function () { const d = 0.34; for (let i = 0; i < 3; i++) { tent(232 + i * 8, 97.2 + (i % 2) * 0.8, 0.9, [96, 52, 44], d); Ln(236 + i * 8, 97.4, 236 + i * 8, 91, tone(PAL.timber, d), 0.25); P([236 + i * 8, 91, 239.4 + i * 8, 91.8 + fl * 0.4, 236 + i * 8, 92.8], tone([176, 40, 34], d)); } Ci(244, 96.8, 0.7, [255, 170, 80], 0.9); smoke(244, 96, 0.7, true, 0.5); });
    } else if (age === 2) {                                 // corsair sails off the point
      site('trial', 2, 112, 44, 16);
      put(128.6, function () { K.sailShip(16, 126.5, 0.62, 0.35, [44, 40, 48]); K.sailShip(34, 124.4, 0.5, 0.8, [44, 40, 48]); });
    } else {                                                // later enemies keep to the far shore: lights that should not be there
      site('trial', 150, 104, 34, 14);
      put(118.5, function () { const d = 0.38; R(154, 113.4, 22, 3, tone([34, 34, 40], d)); R(158, 111.4, 5, 2, tone([34, 34, 40], d)); R(168, 110.4, 3, 3, tone([34, 34, 40], d)); if (fl > 0 || Scene.still) { Ci(169.5, 109.6, 0.8, [255, 60, 50], 1); Ci(169.5, 109.6, 3, [255, 60, 50], 0.2); } smoke(160, 111, 0.7, true, 0.7); });
    }
  }

  /* drawn last and unshaded by the night: signs of what can be done now, and celebrations */
  function mark(x, y, c) {
    const r = (E.city ? 7.5 : 3.6) / E.z, b = Scene.still ? 0 : Math.sin(E.t * 3.2) * r * 0.25; y += b - r * 1.6;
    Ci(x, y, r * 2.1, c, 0.2); P([x, y - r * 1.25, x + r * 0.85, y, x, y + r * 1.25, x - r * 0.85, y], c, 1); P([x, y - r * 0.6, x + r * 0.4, y, x, y + r * 0.6, x - r * 0.4, y], [255, 255, 255], 0.7);
  }
  City.over = function (events) {
    const nowMs = E.ms;
    if (F.projectOpen && F.stageReady) { const q = workMark(); mark(q[0], q[1], [255, 214, 110]); }
    if (F.kn && lore()) { const q = LORE[lore()]; mark(q[0], q[1], [151, 185, 255]); }
    if (F.heroMark) { const hm = (F.home || []).length; if (hm) mark(160.5 - hm * 1.15, 149.2, [255, 154, 140]); else mark(310, 64, [255, 154, 140]); }
    if (F.trial) { const q = age === 1 ? [244, 86] : age === 2 ? [24, 112] : [166, 104]; mark(q[0], q[1], [255, 90, 70]); }
    if (E.city) for (const id of F.plots || []) { const q = spot(id) && stand(id); if (q) mark(q[0], q[1] - 5 * sy(q[1]), [240, 236, 220]); }
    if (E.city) for (const id of F.lmOpen || []) { const q = root.Town && root.Town.at(id); if (q) mark(q[0], q[1] - 6 * sy(q[1]), [240, 236, 220]); }
    if (F.news) mark(247.2, 147.4, [255, 214, 110]);
    if (E.city && root.Town) for (const id in F.sites || {}) if (F.sites[id] === 1) { const q = root.Town.post(id); if (q) mark(q[0], q[1] - (q[4] ? q[3] / 2 + 3.4 : 6), [240, 236, 220]); }
    for (const ev of events) {
      const a = (nowMs - ev.t) / 1000;
      if (a < 0) continue;
      if (ev.k === 'stage' && a < 6) {                      // rockets over the great work
        const w = WORK[Math.min(5, ev.id || age)], cx = w[0] + w[2] / 2, top = w[1];
        for (let i = 0; i < 6; i++) {
          const b = a - i * 0.55; if (b < 0 || b > 2.2) continue;
          const x = cx + (hh(i, 81) - 0.5) * 60, y = top - 8 - hh(i, 82) * 26, c = [[255, 214, 110], [255, 130, 110], [150, 200, 255], [255, 255, 255]][i % 4];
          if (b < 0.5) { Ln(x, y + 30 * (1 - b / 0.5), x, y + 30 * (1 - b / 0.5) + 4, c, 0.5, 0.95); continue; }
          const g = (b - 0.5) / 1.7, rr = 4 + (1 - Math.pow(1 - g, 2.2)) * 15;
          Ci(x, y, rr * 1.25, c, 0.16 * (1 - g));
          for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 18; k++) { const an = k / 18 * TAU + i + ring * 0.17, r2 = rr * (ring ? 0.58 : 1); Ci(x + Math.cos(an) * r2, y + Math.sin(an) * r2 + g * g * 7, (ring ? 0.6 : 0.85) * (1 - g * 0.45), ring ? [255, 255, 255] : c, 1 - g * g); }
        }
      } else if (ev.k === 'research' && a < 2.4) {          // light rising where the learning is done
        const q = LORE[lore() || 'script'], g = a / 2.4;
        Ci(q[0], q[1] + 10, 3 + g * 16, [151, 185, 255], 0.22 * (1 - g));
        for (let i = 0; i < 9; i++) { const f = (g * 1.4 + hh(i, 91) * 0.5) % 1; Ci(q[0] + (hh(i, 92) - 0.5) * 16, q[1] + 12 - f * 26, 0.5, [220, 232, 255], (1 - f) * (1 - g)); }
      } else if (ev.k === 'recruit' && a < 1.6) { const g = a / 1.6; ctx.strokeStyle = col([255, 154, 140], 1 - g); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(160, 152, 2 + g * 12, 0, TAU); ctx.stroke(); }
      else if (ev.k === 'news' && a < 2) { const g = a / 2; ctx.strokeStyle = col([255, 214, 110], 1 - g); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(249.5, 150, 2 + g * 16, 0, TAU); ctx.stroke(); }
      else if (ev.k === 'rank' && a < 6) {                 // rockets over the town
        for (let i = 0; i < 5; i++) {
          const b = a - i * 0.7; if (b < 0 || b > 2.2) continue;
          const x = 140 + hh(i, 85) * 100, y = 112 - hh(i, 86) * 22, c = [[201, 162, 255], [255, 214, 110], [255, 255, 255], [150, 200, 255]][i % 4];
          if (b < 0.5) { Ln(x, y + 26 * (1 - b / 0.5), x, y + 26 * (1 - b / 0.5) + 4, c, 0.5, 0.95); continue; }
          const g = (b - 0.5) / 1.7, rr = 3 + (1 - Math.pow(1 - g, 2.2)) * 12;
          for (let k = 0; k < 16; k++) { const an = k / 16 * TAU + i; Ci(x + Math.cos(an) * rr, y + Math.sin(an) * rr + g * g * 6, 0.8 * (1 - g * 0.45), c, 1 - g * g); }
        }
      }
      else if (ev.k === 'edict' && a < 2) { const g = a / 2; ctx.strokeStyle = col([201, 162, 255], 1 - g); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(176, 150, 3 + g * 40, 0, TAU); ctx.stroke(); }
    }
  };
  City.spot = spot; City.WORK = WORK;
  root.City = City;
})(typeof globalThis !== 'undefined' ? globalThis : this);
