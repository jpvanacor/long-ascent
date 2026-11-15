/* Long Ascent: what the realm has built, painted into the scene. A plot, a pile or a wing for every purchase,
   the four named buildings of every kind, the landmarks, and the walls of a town that has grown.
   The scene calls begin() once a frame, asks taken() for every house plot, then draw(). */
(function (root) {
  'use strict';
  const Scene = root.Scene, K = Scene.kit, TAU = Math.PI * 2;
  const R = K.R, P = K.P, Ci = K.Ci, El = K.El, Dome = K.Dome, Ln = K.Ln, tone = K.tone, dk = K.dk, mix = K.mix, col = K.col, PAL = K.C, GLOW = K.GLOW, CYAN = K.CYAN, win = K.win, smoke = K.smoke;
  let E = null, ctx = null, S = null, F = null, stage = null, mk = null, age = 1, still = false;
  const Town = {};
  const n = function (id) { return S.b[id] || 0; };
  const hh = function (i, k) { const v = Math.sin(i * 127.1 + k * 311.7 + 17.3) * 43758.5453; return v - Math.floor(v); };
  const DARK = [56, 50, 54];

  /* ---------- shapes ---------- */
  function box(x, y, w, h, c) { R(x - w / 2, y - h, w, h, c); R(x + w * 0.12, y - h, w * 0.38, h, dk(c, 0.86)); }       // a block, lit from the left
  function gable(x, y, w, h, c, over) { const o = over === undefined ? 0.6 : over; P([x - w / 2 - o, y, x, y - h, x + w / 2 + o, y], c); }
  function hip(x, y, w, h, c, top) { const tw = (top === undefined ? 0.5 : top) * w / 2; P([x - w / 2 - 0.6, y, x - tw, y - h, x + tw, y - h, x + w / 2 + 0.6, y], c); }
  function arch(x, y, w, h, d) { const c = tone(DARK, d); R(x - w / 2, y - h, w, h, c); Dome(x, y - h, w / 2, w * 0.55, c); }
  function wins(x, y, k, step, w, h, u) { for (let i = 0; i < k; i++) win(x + i * step, y, w, h, (u + i * 0.23) % 1); }
  function flag(x, y, h, c, d) { const f = still ? 0 : Math.sin(E.t * 2.4 + x) * 0.5; Ln(x, y, x, y - h, tone(PAL.timber, d), 0.3); P([x, y - h, x + 3.2, y - h + 0.9 + f, x, y - h + 1.8], tone(c, d)); }
  function stack(x, y, w, h, c, seed) { P([x - w / 2 - 0.3, y, x - w / 2, y - h, x + w / 2, y - h, x + w / 2 + 0.3, y], c); R(x - w / 2 - 0.2, y - h, w + 0.4, 0.8, dk(c, 0.7)); if (seed !== undefined) smoke(x, y - h - 0.6, Math.max(0.5, w * 0.45), true, seed); }
  function glow(x, y, w, h, c, a) { R(x, y, w, h, c, a === undefined ? 0.55 + 0.45 * E.night : a); if (E.night > 0.2) Ci(x + w / 2, y + h / 2, Math.max(w, h) * 1.6, c, 0.13 * E.night); }
  function band(x, y, w, h, d) { R(x, y, w, h, E.night > 0.1 ? GLOW : tone([70, 84, 104], d), E.night > 0.1 ? E.night * 0.9 : 0.9); }       // a strip of windows
  function mast(x, y, h, d, lamp) { const c = tone(PAL.iron, d); Ln(x, y, x, y - h, c, 0.35); Ln(x - h * 0.09, y, x, y - h * 0.5, c, 0.2); Ln(x + h * 0.09, y, x, y - h * 0.5, c, 0.2); if (lamp && E.night > 0.2 && (still || Math.sin(E.t * 2.2 + x) > 0)) Ci(x, y - h, 0.7, [255, 70, 60], 1); }
  function crates(x, y, k, d, cs) { for (let i = 0; i < k; i++) { const r = Math.floor(i / 3), q = i % 3; R(x + q * 2.3 + (r % 2) * 0.6, y - 1.7 - r * 1.7, 2.1, 1.6, tone(cs[i % cs.length], d)); } }

  /* ---------- where the landmarks stand: x of the middle, y of the ground, width, height, and the row of houses they displace ---------- */
  const LM = {
    watch: [114, 151.2, 7, 20, -1], forge: [126, 150.7, 10, 10, 0], market: [237, 152.2, 30, 9, -1], moot: [240, 149.6, 15, 15, 0],
    hall: [146, 141.8, 14, 18, 1], ware: [98, 153.2, 15, 9, -1], armoury: [264, 150.2, 10, 12, -1], corn: [210, 141.8, 14, 16, 1],
    station: [251, 150.6, 8, 15, 0], depot: [283, 141.4, 21, 8, -1], arms: [297, 148.8, 15, 13, -1], engine: [170, 141.7, 9, 21, 1],
    container: [84, 152.8, 13, 14, -1], radio: [268, 107.5, 8, 34, -1], proving: [150, 182, 26, 11, -1], grid: [262, 141, 10, 9, -1],
    tracking: [142, 121.6, 16, 16, -1], control: [226, 161.2, 19, 9, -1], exo: [166, 171, 14, 11, -1], fusion: [286, 181, 22, 13, -1]
  };
  const BAND_Y = [149, 141, 133];
  function shown(id) { return !!S.lm[id] || (F.lmOpen || []).indexOf(id) >= 0; }       // built, or pegged out because it can be built
  Town.at = function (id) { return LM[id] || null; };
  Town.taken = function (h) {
    for (const id in LM) { const q = LM[id]; if (q[4] === h.b && Math.abs(h.x - q[0]) < q[2] / 2 + 3.6 && shown(id)) return true; }
    if (h.b === 0 && h.x > 129 && h.x < 141 && mk('guild') >= 3) return true;           // the cloth hall
    return false;
  };

  /* ---------- a frame begins ---------- */
  Town.begin = function (env, context, state, facts, stageOf, marks) {
    E = env; ctx = context; S = state; F = facts || {}; stage = stageOf; mk = marks; age = S.age; still = !!Scene.still;
    return !!(S.b && S.lm);
  };

  /* ================= the kinds of building: what each purchase adds, and their named buildings ================= */

  /* farmland: a tilled plot for every farmstead, then a rick on each */
  function plots(put) {
    const farms = n('farm'); if (!farms) return;
    const port = n('port') > 0, cols = port ? 3 : 7, rows = 6, cap = cols * rows;
    const tints = [PAL.wheat, PAL.crop, PAL.fallow, PAL.crop, PAL.wheat, [168, 184, 96], PAL.fallow];
    put(161, function () {
      for (let i = 0; i < Math.min(farms, cap); i++) {
        const c = i % cols, r = Math.floor(i / cols), x0 = 14 + c * 18.5, y0 = 161 + r * 6, y1 = y0 + 6, f0 = (y0 - 161) / 36, f1 = (y1 - 161) / 36;
        const tint = tone(dk(tints[(c + r * 3) % tints.length], 0.94 + hh(i, 3) * 0.12), 0.03);
        P([x0 - 9 * f0 + 0.3, y0 + 0.2, x0 + 16.5 - 7 * f0 - 0.3, y0 + 0.2, x0 + 16.5 - 7 * f1 - 0.3, y1 - 0.2, x0 - 9 * f1 + 0.3, y1 - 0.2], tint);
        if (E.z > 1.4) for (let k = 1; k < 4; k++) Ln(x0 - 9 * f0 + (16.5 + 2 * f0) * k / 4, y0 + 0.3, x0 - 9 * f1 + (16.5 + 2 * f1) * k / 4, y1 - 0.3, dk(tint, 0.86), 0.3, 0.7);
      }
    });
    for (let i = cap; i < Math.min(farms, cap * 2); i++) (function (i) {               // ricks
      const j = i - cap, c = j % cols, r = Math.floor(j / cols), y = 164.2 + r * 6, x = 14 + c * 18.5 + 5 + hh(j, 5) * 6 - 9 * (y - 161) / 36;
      put(y, function () { Dome(x, y, 1.3, 1.9, tone([214, 186, 104], 0.03)); });
    })(i);
  }
  function farmMarks(put) {
    const m = mk('farm'), port = n('port') > 0, d = 0.04;
    if (m >= 2) put(160.7, function () {                                               // the granary, on staddle stones
      const x = port ? 52 : 58, y = 160.7, c = tone(PAL.timber, d);
      for (const sx of [x - 3.4, x, x + 3.4]) R(sx - 0.4, y - 1.1, 0.8, 1.1, tone(PAL.stone, d));
      box(x, y - 1.1, 9, 4.2, c); gable(x, y - 5.3, 9, 3.4, tone(dk(PAL.thatch, 0.92), d)); R(x - 0.9, y - 4, 1.8, 2.9, dk(c, 0.6));
    });
    if (m >= 3 && !port) put(162.4, function () {                                      // the manor house
      const x = 106, y = 162.4, c = tone(PAL.lime, d);
      box(x, y, 13, 6.4, c); hip(x, y - 6.4, 13, 3.6, tone(PAL.terra, d), 0.55);
      stack(x - 4.6, y - 8, 1.2, 3.6, dk(c, 0.8), 0.3); stack(x + 4.6, y - 8, 1.2, 3.6, dk(c, 0.8));
      wins(x - 5, y - 5.2, 4, 3, 1.3, 1.6, 0.2); R(x - 0.8, y - 2.8, 1.6, 2.8, tone(dk(PAL.timber, 0.6), d));
    });
    if (m >= 4 && !port) {                                                             // the great estate: a walled court and a dovecote
      put(162.3, function () { const c = tone(PAL.stone, d); R(92, 160.6, 6, 1.9, c); R(114.6, 160.6, 9.4, 1.9, c); Dome(121.4, 162.5, 2.4, 0.01, c); box(121.4, 162.5, 3.6, 7.4, c); P([119.2, 155.1, 121.4, 151.8, 123.6, 155.1], tone(PAL.slate, d)); for (let i = 0; i < 2; i++) R(120.6 + i * 1.1, 157 + i * 1.6, 0.6, 0.7, tone(DARK, d)); flag(121.4, 151.8, 3.6, [176, 44, 36], d); });
      put(164.4, function () { const c = tone(PAL.stone, d); R(92, 162.6, 9, 1.8, c); R(104.4, 162.6, 19.6, 1.8, c); R(100.6, 161.4, 1, 3, dk(c, 0.84)); R(103.6, 161.4, 1, 3, dk(c, 0.84)); });
    }
  }
  function lumberUnits(put) {
    const c0 = n('lumber'); if (!c0 || age > 2) return;
    const d = 0.03, wood = tone([150, 110, 70], d), end = tone([206, 176, 128], d), m = mk('lumber');
    for (let i = 0; i < Math.min(c0, 24); i++) (function (i) {                         // a stack of logs for every camp
      const row = i % 3, q = Math.floor(i / 3), x = 294 + q * 5.6 + row * 1.5, y = 174.6 + row * 3;
      put(y, function () { for (let k = 0; k < 3; k++) { const lx = x + (k === 2 ? 0.9 : k * 1.8), ly = y - 0.9 - (k === 2 ? 1.5 : 0); Ci(lx, ly, 0.95, wood); Ci(lx, ly, 0.45, end); } });
    })(i);
    if (m >= 1) put(177.4, function () {                                               // the sawpit
      const x = 268, y = 177.4, tb = tone(PAL.timber, d);
      R(x - 5, y - 0.5, 10, 1, tone([70, 54, 40], d)); for (const sx of [x - 4.4, x + 4.4]) Ln(sx, y + 0.4, sx, y - 4.6, tb, 0.6); Ln(x - 5.4, y - 4.6, x + 5.4, y - 4.6, tb, 0.6);
      R(x - 4.6, y - 5.6, 9.2, 1, wood); const sw = still ? 0 : Math.sin(E.t * 3) * 1.2; Ln(x + sw, y - 7.4, x + sw, y - 1.2, tone([180, 184, 190], d), 0.3);
    });
    if (m >= 2) put(182.4, function () {                                               // the timber yard: sawn planks, stacked to season
      for (let i = 0; i < 4; i++) { const x = 322 + i * 5.2, y = 182.4 - (i % 2) * 1.6; for (let k = 0; k < 4; k++) R(x - 2.2 + (k % 2) * 0.3, y - 1 - k * 0.95, 4.4, 0.75, tone(k % 2 ? [206, 176, 128] : [186, 152, 104], d)); }
      Ln(318, 182.6, 318, 180.2, tone(PAL.timber, d), 0.4); Ln(342, 182.6, 342, 180.2, tone(PAL.timber, d), 0.4); Ln(318, 180.8, 342, 180.8, tone(PAL.timber, d), 0.25);
    });
    if (m >= 3) put(171.6, function () {                                               // charcoal kilns
      for (let i = 0; i < 2; i++) { const x = 334 + i * 8, y = 171.6 + i * 0.8; Dome(x, y, 3.2, 2.9, tone([92, 74, 58], d)); Dome(x + 0.9, y, 2.2, 2.7, tone([74, 60, 48], d)); if (E.night > 0.2) Ci(x - 1.4, y - 0.7, 0.5, [255, 150, 70], E.night); smoke(x, y - 3, 0.75, true, 0.2 + i * 0.4); }
    });
    if (m >= 4) put(178.8, function () {                                               // the forest lodge
      const x = 351, y = 178.8, c = tone([138, 100, 62], d);
      box(x, y, 10, 4.6, c); for (let k = 1; k < 4; k++) Ln(x - 5, y - k * 1.15, x + 5, y - k * 1.15, dk(c, 0.8), 0.18); gable(x, y - 4.6, 10, 5.4, tone(dk(PAL.thatch, 0.8), d), 1);
      stack(x + 2.8, y - 6.6, 1.1, 2.6, tone(PAL.stone, d), 0.7); win(x - 3.4, y - 3.2, 1.4, 1.5, 0.3); R(x + 0.6, y - 2.9, 1.7, 2.9, dk(c, 0.55)); flag(x - 3.6, y - 6.4, 3.4, [60, 110, 70], d);
    });
  }
  function scriptUnits(put) {
    const c0 = n('script'); if (!c0) return;
    const x = 262, y = 121, d = 0.22, c = tone(PAL.lime, d), cd = dk(c, 0.86), rf = tone(PAL.terra, d), m = mk('script');
    if (age <= 3) {
      for (let i = 0; i < Math.min(c0, 10); i++) (function (i) {                       // a cell for every scriptorium, then a garden bed
        const cx = 285 + (i % 5) * 3.3, cy = 120.2 + Math.floor(i / 5) * 2.6;
        put(cy, function () { R(cx - 1.2, cy - 1.7, 2.4, 1.7, c); P([cx - 1.5, cy - 1.7, cx, cy - 2.9, cx + 1.5, cy - 1.7], rf); R(cx - 0.3, cy - 1, 0.6, 1, tone(DARK, d)); });
      })(i);
      if (c0 > 10) put(124.2, function () { for (let i = 0; i < Math.min(c0 - 10, 14); i++) R(252 + (i % 7) * 3.1, 123.4 + Math.floor(i / 7) * 1.5, 2.6, 1.1, tone(i % 3 ? [112, 150, 84] : [150, 122, 86], d)); });
    }
    if (m >= 1) put(120.98, function () {                                              // the bell tower
      R(x - 9.5, y - 15.5, 3.4, 15.5, c); R(x - 7.6, y - 15.5, 1.5, 15.5, cd); P([x - 10.1, y - 15.5, x - 7.8, y - 20.6, x - 5.5, y - 15.5], rf);
      R(x - 8.5, y - 14.3, 1.4, 2.2, tone(DARK, d)); const sw = still ? 0 : Math.sin(E.t * 2.2) * 0.3; Ci(x - 7.8 + sw, y - 12.7, 0.5, tone([196, 164, 84], d));
    });
    if (m >= 3) put(122.3, function () { R(x - 6.8, y - 1, 26.4, 2.3, c); for (let i = 0; i < 8; i++) arch(x - 5 + i * 3.2, y + 1.3, 1.7, 1, d); R(x - 7.1, y - 1.5, 27, 0.7, rf); });      // the cloister
    if (m >= 4) put(121.4, function () { const cx = x - 15.5; R(cx - 3.2, y - 4.2, 6.4, 4.6, c); R(cx + 0.8, y - 4.2, 2.4, 4.6, cd); P([cx - 3.8, y - 4.2, cx, y - 9.4, cx + 3.8, y - 4.2], rf); for (let i = 0; i < 3; i++) win(cx - 2.4 + i * 1.9, y - 3.2, 0.9, 2, 0.2 + i * 0.3); Ln(cx, y - 9.4, cx, y - 11, tone([196, 164, 84], d), 0.3); });      // the chapter house
  }

  /* ----- Renaissance ----- */
  function guildUnits(put) {
    const c0 = n('guild'); if (!c0) return;
    const x = 151, y = 150.5, d = 0.1, c = tone(PAL.plaster, d), cd = dk(c, 0.87), rf = tone(PAL.terra, d), m = mk('guild');
    put(151.45, function () { crates(139.6, 151.5, Math.min(c0, 18), d, [[150, 110, 70], [176, 140, 96], [124, 92, 60], [190, 160, 110]]); if (c0 > 18) for (let i = 0; i < Math.min(c0 - 18, 8); i++) Ci(147.4 + i * 1.7, 150.9, 0.75, tone(i % 2 ? [120, 86, 56] : [146, 106, 70], d)); });      // goods by the door: a crate for every guild, then barrels
    if (m >= 4) put(150.3, function () { [[144.5, 15.5, 0.2], [152.5, 17.2, 0.7], [160, 16, 0.45]].forEach(function (q) { const w = 5.6, h = q[1], wc = tone(mix(PAL.plaster, [214, 178, 136], q[2]), d + 0.03); R(q[0] - w / 2, y - h, w, h, wc); P([q[0] - w / 2, y - h, q[0] - w / 2, y - h - 1.5, q[0] - 1, y - h - 1.5, q[0] - 1, y - h - 3, q[0] + 1, y - h - 3, q[0] + 1, y - h - 1.5, q[0] + w / 2, y - h - 1.5, q[0] + w / 2, y - h], tone(dk(PAL.terra, 0.9), d + 0.03)); wins(q[0] - 1.9, y - h + 1.2, 2, 2.4, 1.2, 1.6, q[2]); }); });      // the merchants' row
    if (m >= 1) put(150.55, function () { const cx = 164.6; box(cx, y, 7, 6.4, cd); gable(cx, y - 6.4, 7, 3, rf); wins(cx - 2.4, y - 5.2, 2, 3, 1.3, 1.5, 0.3); R(cx - 0.8, y - 2.6, 1.6, 2.6, tone(DARK, d)); R(cx + 1.6, y - 3.6, 1.6, 1.1, tone([196, 164, 84], d)); });      // the counting house
    if (m >= 3) put(150.6, function () { const cx = 135.6; box(cx, y, 9.6, 7.8, c); P([cx - 5.2, y - 7.8, cx - 3.4, y - 7.8, cx - 3.4, y - 9.6, cx - 1.6, y - 9.6, cx - 1.6, y - 11.4, cx + 1.6, y - 11.4, cx + 1.6, y - 9.6, cx + 3.4, y - 9.6, cx + 3.4, y - 7.8, cx + 5.2, y - 7.8], rf); for (let i = 0; i < 3; i++) arch(cx - 3 + i * 3, y, 2, 2.6, d); wins(cx - 3.6, y - 6.6, 3, 3, 1.4, 1.7, 0.1); });      // the cloth hall
  }
  function masonUnits(put) {
    const c0 = n('mason'); if (!c0 || age > 3) return;
    const x = age === 3 ? 228 : 262, y = 188, d = 0.03, c = tone([214, 208, 194], d), cd = dk(c, 0.84), m = mk('mason');
    put(y + 0.01, function () { for (let i = 0; i < Math.min(c0, 24); i++) { const r = Math.floor(i / 6), bx = x + (i % 6) * 3.3 + r * 1.2, by = y - r * 2.3; R(bx, by - 2.2, 3.1, 2.2, c); R(bx + 1.9, by - 2.2, 1.2, 2.2, cd); } });      // a dressed block for every yard
    if (m >= 1) put(y + 0.7, function () { const kx = x + 27; P([kx - 3.4, y + 0.6, kx - 2.2, y - 6, kx + 2.2, y - 6, kx + 3.4, y + 0.6], tone(PAL.stone, d)); P([kx + 0.6, y + 0.6, kx + 0.4, y - 6, kx + 2.2, y - 6, kx + 3.4, y + 0.6], tone(PAL.stoneD, d)); arch(kx - 0.8, y + 0.6, 1.6, 1.3, d); glow(kx - 1.4, y - 0.6, 1.2, 0.8, [255, 150, 60]); smoke(kx, y - 6.4, 1, false, 0.6); });      // the lime kiln
    if (m >= 3) put(y - 0.3, function () { const lx = x + 37; box(lx, y - 0.3, 8, 4.2, tone(PAL.stone, d)); hip(lx, y - 4.5, 8, 2.6, tone(PAL.slate, d), 0.4); R(lx - 0.8, y - 3, 1.6, 2.7, tone(DARK, d)); win(lx + 1.8, y - 3.2, 1.3, 1.4, 0.4); });      // the stonecutters' lodge
    if (m >= 4) put(y + 0.4, function () { const hx = x + 49, st = tone(PAL.lime, d); box(hx, y + 0.4, 11, 8.6, st); P([hx - 6, y - 8.2, hx - 4, y - 8.2, hx - 4, y - 10, hx - 2, y - 10, hx - 2, y - 11.8, hx + 2, y - 11.8, hx + 2, y - 10, hx + 4, y - 10, hx + 4, y - 8.2, hx + 6, y - 8.2], dk(st, 0.92)); arch(hx, y + 0.4, 3, 3.4, d); wins(hx - 4.2, y - 6.6, 2, 6.8, 1.5, 2.2, 0.2); flag(hx, y - 11.8, 4, [62, 110, 170], d); });      // the masons' hall
  }
  function univMarks(put) {
    const c0 = n('univ'); if (!c0) return;
    const x = 234, y = 141, d = 0.16, c = tone(PAL.plaster, d), cd = dk(c, 0.87), rf = tone(PAL.terra, d), m = mk('univ');
    if (age <= 3) put(140.99, function () { const cs = [[176, 44, 36], [62, 110, 170], [230, 196, 70], [90, 150, 110]]; for (let i = 0; i < Math.min(c0, 14); i++) { const px = x - 9.6 + i * 1.5, f = still ? 0 : Math.sin(E.t * 2.6 + i) * 0.25; Ln(px, y - 12, px, y - 13.9, tone(PAL.timber, d), 0.15); P([px, y - 13.9, px + 1.1, y - 13.5 + f, px, y - 13.1], tone(cs[i % 4], d)); } });      // a pennant on the roof for every university
    if (m >= 4) put(141.02, function () { for (const tx of [x - 11.4, x + 11.4]) { R(tx - 1.5, y - 15, 3, 15, tx < x ? c : cd); Dome(tx, y - 15, 1.9, 2.2, tone([104, 132, 122], d)); Ln(tx, y - 17.2, tx, y - 19.2, tone([196, 164, 84], d), 0.3); win(tx - 0.6, y - 13.4, 1.2, 1.8, 0.4); } });      // the great college: two towers on the old front
    if (m >= 3) put(141.03, function () { const tx = x + 16.5; R(tx - 2.6, y - 12.4, 5.2, 3.4, c); R(tx + 0.6, y - 12.4, 2, 3.4, cd); P([tx - 3.1, y - 12.4, tx, y - 16.2, tx + 3.1, y - 12.4], rf); for (let i = 0; i < 3; i++) win(tx - 2 + i * 1.5, y - 11.6, 0.8, 1.6, 0.2 + i * 0.3); });      // the anatomy theatre
    if (m >= 2) put(142.4, function () { const px = x + 20.5; box(px, 142.4, 7, 4.4, cd); gable(px, 138, 7, 2.4, rf); stack(px + 2, 136.6, 1, 3, dk(cd, 0.8), 0.15); R(px - 2.6, 139.4, 2, 3, tone(DARK, d)); win(px + 0.6, 139.2, 1.6, 1.5, 0.5); });      // the printing house
  }

  /* ----- Industrial ----- */
  function bankMarks(put) {
    const c0 = n('bank'); if (!c0) return;
    const x = 214, y = 150.5, d = 0.1, c = tone([216, 212, 202], d), cd = dk(c, 0.86), m = mk('bank');
    put(151.5, function () { for (let i = 0; i < Math.min(c0, 13); i++) { const px = 205.4 + i * 1.5; R(px - 0.2, 150.5, 0.4, 1.1, tone(PAL.iron, d)); Ci(px, 150.4, 0.32, tone([226, 190, 80], d)); } });      // a gilded post before the door for every bank
    if (m >= 4) put(150.62, function () { const tx = 207.6; R(tx - 1.9, y - 26, 3.8, 26, c); R(tx + 0.4, y - 26, 1.5, 26, cd); R(tx - 2.3, y - 26.8, 4.6, 0.9, dk(c, 0.8)); Ci(tx, y - 23.2, 1.3, tone([240, 236, 220], d)); Ln(tx, y - 23.2, tx, y - 24.1, tone(DARK, d), 0.18); P([tx - 2, y - 26.8, tx, y - 31, tx + 2, y - 26.8], tone([120, 150, 140], d)); Ci(tx, y - 31.4, 0.6, tone([226, 190, 80], d)); });      // the bank tower
    if (m >= 2) put(150.45, function () { const bx = 226.4; R(bx - 5, y - 14.4, 10, 14.4, cd); R(bx - 5.3, y - 15.1, 10.6, 0.9, dk(c, 0.76)); for (let r = 0; r < 3; r++) wins(bx - 3.9, y - 13.4 + r * 3.1, 4, 2.3, 1.3, 1.9, 0.15 + r * 0.2); });      // the clearing house
    if (m >= 1) put(150.75, function () { const sx = 227.2; box(sx, y, 6, 5.4, c); R(sx - 3.3, y - 6, 6.6, 0.7, dk(c, 0.78)); R(sx - 1.1, y - 3.2, 2.2, 3.2, tone(PAL.iron, d)); Ci(sx, y - 1.7, 0.4, tone([226, 190, 80], d)); for (let i = 0; i < 3; i++) Ln(sx + 1.7 + i * 0.5, y - 4.4, sx + 1.7 + i * 0.5, y - 3, tone(PAL.iron, d), 0.14); });      // the strongroom
  }
  function steelMarks(put) {
    const c0 = n('steel'); if (!c0) return;
    const x = 250, y = 171, d = 0.03, c = tone(dk(PAL.brick, 0.86), d), iron = tone([70, 74, 84], d), m = mk('steel');
    put(173.4, function () { for (let i = 0; i < Math.min(c0, 20); i++) { const bx = 253 + (i % 10) * 3.1, by = 173.4 - Math.floor(i / 10) * 1.1; for (let k = 0; k < 2; k++) R(bx + k * 0.25, by - 0.5 - k * 0.5, 2.4, 0.42, tone(k ? [176, 182, 192] : [146, 152, 164], d)); } });      // billets in the yard: a stack for every works
    if (m >= 1) put(170.9, function () { const fx = x - 9.5; P([fx - 3.4, y, fx - 2.2, y - 14, fx - 2.9, y - 18.6, fx + 2.9, y - 18.6, fx + 2.2, y - 14, fx + 3.4, y], tone([84, 70, 66], d)); R(fx - 3.6, y - 19.4, 7.2, 0.9, iron); for (const by of [5, 10]) R(fx - 3.2, y - by, 6.4, 0.5, iron); Ln(fx + 8, y, fx + 2.6, y - 18.8, iron, 0.45); glow(fx - 1.2, y - 2.4, 2.4, 1.6, [255, 150, 60]); if (E.night > 0.1) Ci(fx, y - 20, 3.4, [255, 140, 60], 0.3 * E.night); smoke(fx, y - 19.6, 1.4, true, 0.33); });      // the blast furnace
    if (m >= 3) put(177, function () { const ox = 300, oy = 177; R(ox, oy - 3.2, 30, 3.2, c); R(ox, oy - 3.8, 30, 0.7, iron); for (let i = 0; i < 10; i++) { R(ox + 1 + i * 2.9, oy - 2.4, 1.7, 2.4, tone([40, 30, 28], d)); if (i % 3 !== 1) glow(ox + 1.3 + i * 2.9, oy - 1.9, 1.1, 1.3, [255, 150, 60], 0.5 + 0.5 * E.night); } stack(ox + 31.6, oy, 1.6, 12, c, 0.8); smoke(ox + 9, oy - 4, 1.2, false, 0.1); });      // the coke ovens
    if (m >= 4) put(175.2, function () { const gx = x + 16; for (const lx of [gx - 11, gx + 11]) { Ln(lx - 1.2, 175.2, lx, 165.4, iron, 0.5); Ln(lx + 1.2, 175.2, lx, 165.4, iron, 0.5); } R(gx - 12, 164.6, 24, 1.1, iron); const tr = still ? 0 : Math.sin(E.t * 0.3) * 6; R(gx + tr - 1.2, 165.6, 2.4, 1, tone([200, 150, 60], d)); Ln(gx + tr, 166.6, gx + tr, 170.6, iron, 0.2); R(gx + tr - 1.3, 170.6, 2.6, 0.8, tone([176, 182, 192], d)); });      // the great foundry: a travelling crane over the yard
  }
  function obsMarks(put) {
    const c0 = n('obs'); if (!c0) return;
    const x = 282, y = 104.5, d = 0.22, c = tone([228, 224, 214], d), dm = tone([150, 160, 168], d), m = mk('obs');
    put(107.2, function () { for (let i = 0; i < Math.min(c0, 10); i++) { const hx = 290.6 + (i % 5) * 2.5, hy = 105.8 + Math.floor(i / 5) * 1.4; R(hx - 0.9, hy - 1.2, 1.8, 1.2, c); R(hx - 1, hy - 1.5, 2, 0.4, dm); } });      // an instrument hut for every observatory
    if (m >= 4) put(104.4, function () { const tx = x - 1; R(tx - 1.6, y - 16, 3.2, 16, dk(c, 0.92)); R(tx - 2, y - 16.7, 4, 0.8, dm); Ln(tx, y - 16.7, tx, y - 21.4, tone(PAL.iron, d), 0.3); Ci(tx, y - 19.6 + (still ? 0 : Math.max(0, Math.sin(E.t * 0.4)) * 1.4), 0.9, tone([190, 50, 44], d)); });      // the royal observatory: a time ball on its tower
    if (m >= 2) put(104.55, function () { const gx = x + 11.5; R(gx - 4.4, y - 4.2, 8.8, 4.2, c); R(gx + 0.8, y - 4.2, 3.6, 4.2, dk(c, 0.86)); Dome(gx, y - 4.2, 4.6, 5, dm); P([gx - 0.6, y - 9.2, gx + 0.6, y - 9.2, gx + 1.3, y - 4.3, gx - 0.1, y - 4.3], tone([40, 44, 54], d)); });      // the great refractor
    if (m >= 3) put(105.2, function () { const lx = x - 21; box(lx, 105.1, 9, 4.4, tone(PAL.brick, d)); R(lx - 4.8, 100.1, 9.6, 0.7, tone(PAL.slate, d)); stack(lx + 2.6, 100.4, 1, 3.2, tone(dk(PAL.brick, 0.8), d), 0.5); wins(lx - 3.6, 101.8, 4, 2.1, 1.2, 1.6, 0.2); });      // the physics laboratory
  }

  /* ----- Modern ----- */
  function exchMarks(put) {
    const c0 = n('exch'); if (!c0) return;
    const y = 134, d = 0.2, m = mk('exch');
    const tower = function (x, w, h, tint) { const c = tone(mix(PAL.glass, [92, 128, 162], tint), d); R(x - w / 2, y - h, w, h, c); R(x + w * 0.14, y - h, w * 0.36, h, dk(c, 0.84)); R(x - w / 2, y - h, w, 0.9, tone([220, 226, 232], d)); for (let r = 0; r < Math.floor(h / 3); r++) for (let k = 0; k < 3; k++) if (E.night > 0.08 && ((r * 7 + k * 13 + Math.round(x)) % 10) < 6) R(x - w / 2 + 1 + k * (w - 2) / 3, y - h + 2 + r * 3, 1.3, 1.5, GLOW, E.night); };
    if (m >= 4) put(133.9, function () { tower(193, 8, 29, 0.35); tower(250.5, 9, 35, 0.65); R(222, y - 25, 16, 1.2, tone([200, 214, 226], d)); });      // the financial district
    put(134.05, function () { for (let i = 0; i < Math.min(c0, 16); i++) { const bx = 197.4 + i * 3.2, h = 2 + hh(i, 41) * 2.6; R(bx, y + 1.4 - h, 2.7, h, tone(i % 3 ? PAL.concrete : mix(PAL.glass, PAL.concrete, 0.4), d)); if (E.night > 0.1 && hh(i, 42) < 0.6) R(bx + 0.6, y + 2 - h, 1.2, 0.7, GLOW, E.night); } });      // an office block for every exchange
    if (m >= 1) put(134.1, function () { const c = tone(mix(PAL.glass, PAL.concrete, 0.5), d); R(199, y - 4.6, 46, 4.6, c); R(199, y - 5.2, 46, 0.7, tone([220, 226, 232], d)); R(200, y - 3.4, 44, 0.9, E.night > 0.1 ? [255, 190, 90] : tone([60, 70, 86], d), E.night > 0.1 ? 0.95 : 0.9); if (!still) for (let i = 0; i < 7; i++) R(200 + ((E.t * 2.2 + i * 6.3) % 43), y - 3.3, 1.6, 0.7, [140, 230, 150], 0.8); });      // the trading floor, with its ticker
  }
  function refinMarks(put) {
    const c0 = n('refin'); if (!c0) return;
    const x = 304, y = 191, d = 0.03, c = tone([198, 202, 208], d), cd = dk(c, 0.82), pc = tone([120, 126, 136], d), m = mk('refin');
    put(194.6, function () { for (let i = 0; i < Math.min(c0, 14); i++) { const tx = 299 + i * 3.1; R(tx - 1.1, 192.2, 2.2, 2.4, i % 4 === 3 ? tone([196, 84, 60], d) : c); El(tx, 192.2, 1.1, 0.4, dk(c, 1.06)); } });      // a drum on the apron for every refinery
    if (m >= 1) put(y - 0.05, function () { const tx = x + 18; R(tx - 2, y - 35, 4, 35, c); R(tx + 0.4, y - 35, 1.6, 35, cd); Dome(tx, y - 35, 2, 2, c); for (let k = 6; k < 35; k += 7) R(tx - 2.8, y - k, 5.6, 0.7, pc); Ln(tx - 2.4, y, tx - 2.4, y - 35, pc, 0.2); if (E.night > 0.1) Ci(tx, y - 37.4, 0.8, [255, 70, 60], E.night); });      // the cracking tower
    if (m >= 2) put(y + 0.02, function () { for (const q of [[x + 41, 4.2], [x + 50, 3.4]]) { Ci(q[0], y - q[1] - 1.2, q[1], c); Ci(q[0] + q[1] * 0.3, y - q[1] - 0.6, q[1] * 0.7, cd, 0.5); Ln(q[0] - q[1] * 0.7, y, q[0] - q[1] * 0.5, y - 2.6, pc, 0.5); Ln(q[0] + q[1] * 0.7, y, q[0] + q[1] * 0.5, y - 2.6, pc, 0.5); } });      // the tank farm
    if (m >= 3) put(y + 0.04, function () { for (let i = 0; i < 3; i++) R(x - 40, y - 2 - i * 1.3, 32, 0.6, i === 1 ? tone([196, 150, 70], d) : pc); for (let k = 0; k < 5; k++) Ln(x - 38 + k * 7, y, x - 38 + k * 7, y - 5, pc, 0.35); box(x - 43, y, 6, 4, tone(PAL.concrete, d)); R(x - 46.2, y - 4.5, 6.4, 0.6, pc); Ci(x - 34, y - 3.3, 0.9, tone([196, 60, 50], d)); });      // the pipeline terminal
    if (m >= 4) put(y - 0.1, function () { const fx = x + 4, col2 = tone([232, 234, 238], d); for (let i = 0; i < 3; i++) { const cx = fx + i * 3.2, h = 26 - i * 5; R(cx - 1, y - 19 - h * 0.5, 2, h * 0.5, col2); } for (const lv of [8, 14, 20]) R(fx - 2, y - 19 - lv * 0.5, 9.6, 0.5, pc); });      // the chemical works: a second bank of columns behind the first
  }
  function instMarks(put) {
    const c0 = n('inst'); if (!c0) return;
    const x = 262, y = 118, d = 0.2, c = tone([236, 236, 232], d), m = mk('inst');
    put(119.7, function () { for (let i = 0; i < Math.min(c0, 12); i++) { const mx = 239.6 + i * 2.7; R(mx, 118.3, 2.3, 1.5, c); R(mx, 118.9, 2.3, 0.35, tone([70, 120, 180], d)); } });      // a laboratory hut for every institute
    if (m >= 3) put(122.6, function () { ctx.strokeStyle = col(tone([170, 176, 184], d), 0.95); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(x + 2, 122.6, 16, 1.9, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = col(E.night > 0.1 ? CYAN : tone([90, 150, 200], d), 0.8); ctx.lineWidth = 0.25; ctx.beginPath(); ctx.ellipse(x + 2, 122.6, 16, 1.9, 0, 0, TAU); ctx.stroke(); for (const a of [0.4, 2.2, 3.6, 5.3]) R(x + 2 + Math.cos(a) * 16 - 0.9, 122.6 + Math.sin(a) * 1.9 - 1.5, 1.8, 1.5, c); });      // the particle ring
    if (m >= 2) put(118.4, function () { const bx = x - 22; box(bx, 118.4, 9, 5, tone([188, 192, 198], d)); for (let i = 0; i < 3; i++) R(bx - 3.6 + i * 2.8, 112.6, 1.8, 0.8, tone([130, 136, 144], d)); for (let i = 0; i < 5; i++) Ci(bx - 3 + i * 1.5, 116.4, 0.3, still || Math.sin(E.t * (2 + i) + i) > 0 ? [120, 230, 150] : [60, 90, 70], 0.95); });      // the computing centre
    if (m >= 4) put(118.3, function () { const gx = x + 25; Dome(gx, 118.3, 5.4, 5.6, tone(mix(PAL.glass, [200, 226, 236], 0.4), d), 0.92); ctx.strokeStyle = col(tone([230, 236, 240], d), 0.8); ctx.lineWidth = 0.2; ctx.beginPath(); ctx.ellipse(gx, 118.3, 5.4, 5.6, 0, Math.PI, TAU); ctx.moveTo(gx, 118.3); ctx.lineTo(gx, 112.7); ctx.moveTo(gx - 5, 116); ctx.lineTo(gx + 5, 116); ctx.stroke(); box(gx + 8.6, 118.3, 5, 3.4, c); });      // the science campus
  }
  /* ----- Space ----- */
  function portMarks(put) {
    const c0 = n('port'); if (!c0) return;
    const x = 100, y = 180, d = 0.03, c = tone(PAL.pearl, d), cd = dk(c, 0.86), m = mk('port');
    put(192.4, function () { for (let i = 0; i < Math.min(c0, 12); i++) { const hx = 62 + i * 4.3; Dome(hx, 192.4, 1.9, 1.7, c); R(hx - 0.8, 191.5, 1.6, 0.9, tone([40, 60, 90], d)); } });      // a hangar on the apron for every spaceport
    if (m >= 2) put(181, function () { const ax = x - 38; box(ax, 181, 11, 17, c); R(ax - 5.7, 163.4, 11.4, 0.8, tone([150, 156, 166], d)); R(ax - 2.6, 166, 3.4, 15, tone([52, 60, 76], d)); R(ax - 2.6, 166, 0.5, 15, E.night > 0.1 ? CYAN : tone([120, 170, 200], d), 0.9); R(ax + 2.2, 166.4, 2.2, 1.4, E.night > 0.1 ? CYAN : tone([70, 100, 130], d), 0.95); });      // the assembly hall
    if (m >= 3) put(191, function () { ctx.strokeStyle = col(tone([226, 230, 236], d), 0.9); ctx.lineWidth = 0.35; ctx.setLineDash([1.4, 1.1]); ctx.beginPath(); ctx.ellipse(x + 12, 191.2, 13, 2.2, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, on = still || Math.sin(E.t * 3 - i) > 0.2; Ci(x + 12 + Math.cos(a) * 13, 191.2 + Math.sin(a) * 2.2, 0.35, on ? CYAN : tone([90, 120, 140], d), 0.95); } P([x + 9, 191.4, x + 11, 188.4, x + 13, 188.4, x + 15, 191.4], c); R(x + 10.6, 187.2, 2.8, 1.3, cd); });      // the landing field
    if (m >= 4) put(179.2, function () { const tx = x - 14; P([tx - 1.6, 179.2, tx - 0.5, 135, tx + 0.5, 135, tx + 1.6, 179.2], c); P([tx + 0.3, 179.2, tx + 0.1, 135, tx + 0.5, 135, tx + 1.6, 179.2], cd); El(tx, 150, 4.4, 1.1, c); El(tx, 149.7, 3.2, 0.6, tone([52, 60, 76], d)); R(tx - 0.25, 138, 0.5, 40, E.night > 0.1 ? CYAN : tone([150, 190, 214], d), 0.8); Ci(tx, 134.4, 0.9, CYAN, 0.6 + 0.4 * E.night); if (E.night > 0.2) Ci(tx, 134.4, 4, CYAN, 0.16 * E.night); });      // the orbital terminal
  }
  function fabMarks(put) {
    const c0 = n('fab'); if (!c0) return;
    const x = 224, y = 193, d = 0.03, c = tone(PAL.pearl, d), cd = dk(c, 0.86), edge = function () { return E.night > 0.1 ? CYAN : tone([120, 170, 200], d); }, m = mk('fab');
    put(196.2, function () { for (let i = 0; i < Math.min(c0, 18); i++) { const q = i % 9, r = Math.floor(i / 9), mx = 187 + q * 2.6 + r * 0.9, my = 196.2 - r * 1.7; R(mx, my - 1.6, 2.2, 1.6, r ? cd : c); R(mx, my - 1.6, 2.2, 0.25, edge(), 0.85); } });      // a printed module for every fabricator
    if (m >= 1) put(y + 0.02, function () { for (const q of [[x - 25, 10.5], [x - 20.6, 8.2]]) { R(q[0] - 1.7, y - q[1], 3.4, q[1], c); R(q[0] + 0.4, y - q[1], 1.3, q[1], cd); Dome(q[0], y - q[1], 1.7, 1.4, c); R(q[0] - 1.7, y - q[1] * 0.5, 3.4, 0.3, edge(), 0.85); } Ln(x - 18.9, y - 6.6, x - 9, y - 5, tone(PAL.iron, d), 0.3); });      // the feedstock silos
    if (m >= 3) put(y - 0.3, function () { const gx = x + 43, iron = tone(PAL.iron, d); for (const lx of [gx - 8, gx + 8]) Ln(lx, y - 0.3, lx, y - 12.4, iron, 0.5); R(gx - 8.6, y - 13, 17.2, 0.9, iron); for (let i = 0; i < 3; i++) { const ax = gx - 5 + i * 5, sw = still ? 0.3 : Math.sin(E.t * 1.3 + i * 2) * 0.7; Ln(ax, y - 12.2, ax + sw * 2, y - 8, iron, 0.4); Ln(ax + sw * 2, y - 8, ax + sw * 3.4, y - 5.2, iron, 0.3); Ci(ax + sw * 3.4, y - 5.2, 0.45, CYAN, 0.9); } });      // the robot bay
    if (m >= 2) put(y + 0.6, function () { const hx = x + 43; R(hx - 10, y - 3.4, 20, 4, c); R(hx + 2, y - 3.4, 8, 4, cd); Dome(hx, y - 3.4, 10, 2.2, c); R(hx - 10, y - 2, 20, 0.4, edge(), 0.85); R(hx - 1.6, y - 2.6, 3.2, 3.2, tone([52, 60, 76], d)); });      // the print hall
    if (m >= 4) put(y + 0.1, function () { const tx = x + 61; for (let i = 0; i < 6; i++) { const ox = (i % 2 ? 0.9 : -0.9); R(tx - 3 + ox, y + 0.1 - (i + 1) * 3, 6, 2.8, i % 2 ? cd : c); R(tx - 3 + ox, y + 0.1 - (i + 1) * 3, 6, 0.3, edge(), 0.85); } Ln(tx, y - 18, tx, y - 23, tone(PAL.iron, d), 0.3); if (E.night > 0.1) Ci(tx, y - 9, 8, CYAN, 0.07 * E.night); });      // the autofactory
  }
  function arrayMarks(put) {
    const c0 = n('array'); if (!c0) return;
    const d = 0.22, m = mk('array'), c = tone([232, 234, 238], d);
    put(108.4, function () { for (let i = 0; i < Math.min(c0, 16); i++) { const ax = 320 + (i % 8) * 4.6 + Math.floor(i / 8) * 1.6, ay = 105.6 + Math.floor(i / 8) * 1.7 + (i % 8) * 0.5; Ln(ax, ay, ax, ay - 1.7, tone(PAL.iron, d), 0.2); Ln(ax - 0.8, ay - 1.7, ax + 0.8, ay - 1.7, c, 0.22); } });      // an aerial in the field for every array
    if (m >= 4) put(97.3, function () { K.dish(331, 97.6, 10.5, 0.24); });                                // the great array
    if (m >= 2) put(100.7, function () { box(321.4, 100.7, 6, 3.2, c); band(318.8, 98.4, 5.2, 0.7, d); mast(323.4, 97.5, 6, d, true); });      // the control room
    if (m >= 3) [[326.5, 99.5, 3.4], [357, 106.2, 3], [345, 105.9, 2.6]].forEach(function (q) { put(q[1], function () { K.dish(q[0], q[1], q[2], d); }); });      // the long baseline
  }

  /* ================= landmarks ================= */
  const DRAW = {
    watch: function (x, y, d) {
      const tb = tone(PAL.timber, d), tbd = dk(tb, 0.8);
      Ln(x - 2.4, y, x - 1.6, y - 13, tb, 0.7); Ln(x + 2.4, y, x + 1.6, y - 13, tb, 0.7); Ln(x - 2.3, y - 3.4, x + 1.9, y - 8.4, tbd, 0.35); Ln(x + 2.3, y - 3.4, x - 1.9, y - 8.4, tbd, 0.35); Ln(x - 2, y - 8.4, x + 2, y - 8.4, tbd, 0.4);
      R(x - 3.2, y - 13.6, 6.4, 0.9, tb); R(x - 3, y - 15.6, 6, 2, tone(dk(PAL.timber, 1.15), d)); for (let i = 0; i < 4; i++) R(x - 3 + i * 1.7, y - 16.4, 0.9, 0.9, tb);
      Ln(x - 2.7, y - 15.6, x - 2.7, y - 18.6, tb, 0.35); Ln(x + 2.7, y - 15.6, x + 2.7, y - 18.6, tb, 0.35); P([x - 3.9, y - 18.4, x, y - 21.2, x + 3.9, y - 18.4], tone(dk(PAL.thatch, 0.85), d));
      const fl = still ? 1 : 0.75 + 0.25 * Math.sin(E.t * 8); R(x - 0.7, y - 17, 1.4, 0.6, tone(PAL.iron, d)); P([x - 0.6, y - 17, x, y - 18.1 - fl * 0.5, x + 0.6, y - 17], [255, 170, 70], 0.55 + 0.45 * E.night); if (E.night > 0.2) Ci(x, y - 17.4, 3.4, [255, 160, 70], 0.2 * E.night);
    },
    forge: function (x, y, d) {
      const c = tone(PAL.stone, d);
      box(x, y, 9.4, 4.8, c); hip(x, y - 4.8, 9.4, 2.8, tone(dk(PAL.thatch, 0.8), d), 0.5); stack(x + 2.8, y - 6, 1.7, 4.6, dk(c, 0.82), 0.45);
      R(x - 3.8, y - 3.4, 4.2, 3.4, tone([40, 30, 28], d)); glow(x - 2.9, y - 2.2, 2.4, 1.6, [255, 150, 60]);
      R(x + 5.4, y - 1.5, 1.8, 0.5, tone(PAL.iron, d)); R(x + 5.9, y - 1, 0.8, 1, tone(PAL.iron, d));       // the anvil outside
    },
    market: function (x, y, d) {
      const st = tone(PAL.stone, d);
      R(x + 11.6, y - 0.5, 2.8, 0.5, st); R(x + 12.1, y - 1, 1.8, 0.5, st); R(x + 12.7, y - 6, 0.6, 5, st); R(x + 11.9, y - 5.1, 2.2, 0.55, st);       // the market cross
      [[-11, [196, 60, 50]], [-3, [62, 110, 170]], [5, [90, 150, 110]]].forEach(function (q, i) {
        const sx = x + q[0], wd = tone(PAL.timber, d), cloth = age >= 4 ? [[236, 236, 236], [70, 124, 168], [214, 170, 80]][i] : q[1];
        Ln(sx - 2.7, y, sx - 2.7, y - 4, wd, 0.25); Ln(sx + 2.7, y, sx + 2.7, y - 4, wd, 0.25); R(sx - 2.9, y - 2.1, 5.8, 0.5, wd);
        for (let k = 0; k < 5; k++) P([sx - 3.3 + k * 1.32, y - 3.9, sx - 1.98 + k * 1.32, y - 3.9, sx - 2.1 + k * 1.2, y - 5.3, sx - 3 + k * 1.2, y - 5.3], tone(k % 2 ? [240, 234, 220] : cloth, d));
        for (let k = 0; k < 4; k++) Ci(sx - 1.8 + k * 1.2, y - 2.4, 0.42, tone([[214, 90, 60], [226, 190, 80], [120, 160, 90], [200, 120, 70]][(k + i) % 4], d));
      });
    },
    moot: function (x, y, d) {
      const tb = tone(PAL.timber, d), pl = tone(PAL.wattle, d);
      for (let i = 0; i < 5; i++) Ln(x - 6 + i * 3, y, x - 6 + i * 3, y - 4.4, tb, 0.7);                 // an open ground floor on posts
      R(x - 7, y - 9.4, 14, 5.2, pl); R(x + 1.6, y - 9.4, 5.4, 5.2, dk(pl, 0.87)); R(x - 7.3, y - 4.6, 14.6, 0.7, tb); R(x - 7.3, y - 9.6, 14.6, 0.6, tb);
      for (let i = 0; i < 6; i++) Ln(x - 7 + i * 2.8, y - 9.4, x - 7 + i * 2.8, y - 4.4, tb, 0.3); Ln(x - 7, y - 9.2, x - 4.2, y - 4.6, tb, 0.25); Ln(x + 7, y - 9.2, x + 4.2, y - 4.6, tb, 0.25);
      P([x - 8, y - 9.6, x - 4.4, y - 14.6, x + 4.4, y - 14.6, x + 8, y - 9.6], tone(dk(PAL.thatch, 0.78), d)); wins(x - 5.4, y - 8.4, 4, 2.8, 1.4, 1.9, 0.15);
      R(x - 0.9, y - 16.8, 1.8, 2.2, tb); P([x - 1.5, y - 16.8, x, y - 18.6, x + 1.5, y - 16.8], tone(dk(PAL.thatch, 0.78), d)); flag(x + 5.6, y - 14.6, 4, [196, 150, 50], d);
    },
    hall: function (x, y, d) {
      const c = tone(PAL.plaster, d), rf = tone(PAL.terra, d);
      box(x, y, 13, 9, c); for (let i = 0; i < 4; i++) arch(x - 4.6 + i * 3.1, y, 2, 2.8, d); R(x - 6.5, y - 4.6, 13, 0.5, dk(c, 0.8)); wins(x - 5.4, y - 8, 4, 3.1, 1.5, 2.2, 0.1);
      hip(x, y - 9, 13, 2.8, rf, 0.7);
      R(x - 1.9, y - 15.4, 3.8, 6.6, c); R(x + 0.4, y - 15.4, 1.5, 6.6, dk(c, 0.86)); Ci(x, y - 13.2, 1.25, tone([240, 236, 220], d)); Ln(x, y - 13.2, x, y - 14.1, tone(DARK, d), 0.18); Ln(x, y - 13.2, x + 0.6, y - 13, tone(DARK, d), 0.18);
      Dome(x, y - 15.4, 2.1, 2.2, tone([104, 132, 122], d)); flag(x, y - 17.5, 3.4, [176, 44, 36], d);
    },
    ware: function (x, y, d) {
      for (let i = 0; i < 3; i++) {
        const cx = x - 4.8 + i * 4.8, h = 6.2 + (i % 2) * 1.2, c = tone(mix(PAL.plaster, [206, 170, 130], i * 0.4), d);
        box(cx, y, 4.6, h, c); P([cx - 2.5, y - h, cx - 1.5, y - h, cx - 1.5, y - h - 1.3, cx - 0.6, y - h - 1.3, cx - 0.6, y - h - 2.6, cx + 0.6, y - h - 2.6, cx + 0.6, y - h - 1.3, cx + 1.5, y - h - 1.3, cx + 1.5, y - h, cx + 2.5, y - h], tone(dk(PAL.terra, 0.92), d));
        R(cx - 0.8, y - 2.4, 1.6, 2.4, tone(DARK, d)); R(cx - 0.7, y - h + 1, 1.4, 1.7, tone(DARK, d)); Ln(cx, y - h - 1.6, cx + 1.9, y - h - 1.6, tone(PAL.timber, d), 0.25); Ln(cx + 1.7, y - h - 1.6, cx + 1.7, y - h + 0.6, tone([90, 80, 70], d), 0.12);
      }
      crates(x + 7.6, y + 0.4, 5, d, [[150, 110, 70], [176, 140, 96]]);
    },
    armoury: function (x, y, d) {
      const c = tone(PAL.stone, d);
      box(x, y, 9.4, 7.6, c); for (let i = 0; i < 5; i++) R(x - 4.7 + i * 2.1, y - 8.5, 1.1, 0.9, c);
      for (const tx of [x - 4.7, x + 4.7]) { R(tx - 1.3, y - 10.4, 2.6, 10.4, tx < x ? c : dk(c, 0.86)); for (let i = 0; i < 2; i++) R(tx - 1.4 + i * 1.7, y - 11.2, 1.1, 0.9, c); }
      arch(x, y, 2.8, 3.2, d); R(x - 1.4, y - 2.2, 2.8, 0.3, tone(PAL.iron, d)); win(x - 3.3, y - 6.2, 0.7, 1.8, 0.9); win(x + 2.6, y - 6.2, 0.7, 1.8, 0.9); flag(x - 4.7, y - 11.2, 3.6, [176, 44, 36], d);
      for (let i = 0; i < 3; i++) Ci(x + 6.8 + (i === 2 ? 0.6 : i * 1.2), y - 0.6 - (i === 2 ? 1 : 0), 0.6, tone(PAL.iron, d));      // shot, piled by the door
    },
    corn: function (x, y, d) {
      const c = tone(PAL.lime, d);
      box(x, y, 13.4, 8, c); R(x - 7.2, y - 8.8, 14.4, 0.9, dk(c, 0.82)); P([x - 7.4, y - 8.8, x, y - 12.2, x + 7.4, y - 8.8], c); P([x, y - 8.8, x, y - 12.2, x + 7.4, y - 8.8], dk(c, 0.88));
      for (let i = 0; i < 6; i++) { R(x - 6 + i * 2.3, y - 7.8, 0.9, 7.2, dk(c, 1.05)); if (i < 5) R(x - 4.9 + i * 2.3, y - 5.6, 1.1, 5, tone(DARK, d), 0.7); }
      R(x - 7.2, y - 0.7, 14.4, 0.7, dk(c, 0.8)); Dome(x, y - 12, 2.6, 2.8, tone([120, 150, 140], d)); Ci(x, y - 15.4, 0.8, tone([226, 190, 80], d));
    },
    station: function (x, y, d) {                                                      // the telegraph office
      const c = tone(PAL.brick, d), wire = tone([40, 40, 46], d);
      box(x, y, 7, 7.6, c); hip(x, y - 7.6, 7, 2.2, tone(PAL.slate, d), 0.6); R(x - 0.8, y - 2.8, 1.6, 2.8, tone(DARK, d)); wins(x - 2.6, y - 6.4, 2, 3.6, 1.3, 1.8, 0.2); R(x - 2.8, y - 3.9, 5.6, 0.8, tone([232, 226, 206], d));
      Ln(x + 1.2, y - 9.4, x + 1.2, y - 15.4, tone(PAL.timber, d), 0.4); for (const a of [14.6, 13.4]) { Ln(x - 0.6, y - a, x + 3, y - a, tone(PAL.timber, d), 0.3); for (const q of [-0.4, 2.8]) R(x + q - 0.2, y - a - 0.5, 0.4, 0.5, tone([150, 200, 190], d)); }
      ctx.strokeStyle = col(wire, 0.7); ctx.lineWidth = 0.1; for (const a of [15, 13.8]) { ctx.beginPath(); ctx.moveTo(x + 2.8, y - a); ctx.quadraticCurveTo(x + 11, y - a + 3.4, x + 19, y - a + 0.6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 0.4, y - a); ctx.quadraticCurveTo(x - 9, y - a + 3, x - 17, y - a + 0.4); ctx.stroke(); }
      Ln(x + 19, y, x + 19, y - 14.6, tone(PAL.timber, d), 0.35); Ln(x + 18, y - 14, x + 20, y - 14, tone(PAL.timber, d), 0.25);
    },
    depot: function (x, y, d) {
      const c = tone(PAL.brick, d), iron = tone(PAL.iron, d);
      box(x, y, 20, 4.6, c); P([x - 10.6, y - 4.6, x, y - 6.8, x + 10.6, y - 4.6], tone(PAL.slate, d)); for (let i = 0; i < 4; i++) arch(x - 7.2 + i * 4.8, y, 2.8, 2.2, d);
      R(x - 12, y + 0.5, 26, 0.25, iron); R(x - 12, y + 1.2, 26, 0.25, iron);
      R(x + 11, y - 1.9, 4.6, 1.9, tone([122, 52, 46], d)); R(x + 11, y - 2.3, 4.6, 0.5, tone([70, 40, 36], d)); for (const wx of [x + 12, x + 14.6]) Ci(wx, y + 0.3, 0.6, iron);
      Ln(x - 11.8, y, x - 11.8, y - 6.6, iron, 0.4); Ln(x - 11.8, y - 6.6, x - 8.4, y - 5.2, iron, 0.3); Ln(x - 8.4, y - 5.2, x - 8.4, y - 2.8, iron, 0.12); R(x - 9, y - 2.8, 1.2, 1, tone([176, 140, 96], d));
    },
    arms: function (x, y, d) {
      const c = tone(dk(PAL.brick, 0.92), d), rf = tone([70, 74, 84], d);
      box(x, y, 14, 6.4, c); for (let i = 0; i < 3; i++) { P([x - 7 + i * 4.67, y - 6.4, x - 7 + i * 4.67, y - 9.4, x - 7 + (i + 1) * 4.67, y - 6.4], rf); R(x - 6.9 + i * 4.67, y - 9.2, 0.35, 2.8, E.night > 0.1 ? GLOW : tone([170, 190, 204], d), 0.9); }
      wins(x - 5.8, y - 4.8, 5, 2.5, 1.5, 2.2, 0.1); R(x - 1.2, y - 2.8, 2.4, 2.8, tone(DARK, d)); stack(x + 8.4, y, 1.7, 14.5, c, 0.62);
      crates(x - 12.4, y + 0.3, 5, d, [[110, 120, 90], [130, 138, 100]]);
    },
    engine: function (x, y, d) {
      const c = tone(PAL.brick, d);
      stack(x + 5.8, y, 1.9, 20.4, dk(c, 0.9), 0.28);
      box(x, y, 8.4, 13, c); hip(x, y - 13, 8.4, 2.4, tone(PAL.slate, d), 0.5); R(x - 1.3, y - 10.6, 2.6, 7.4, tone(DARK, d), 0.8); Dome(x, y - 10.6, 1.3, 1.5, tone(DARK, d), 0.8); if (E.night > 0.1) R(x - 1.3, y - 10.6, 2.6, 7.4, GLOW, 0.5 * E.night);
      const a = still ? 0.2 : Math.sin(E.t * 1.6) * 0.32, bx = x - 4.2, by = y - 11.4;                // the beam, rocking through the wall
      Ln(bx - Math.cos(a) * 4.6, by + Math.sin(a) * 4.6, bx + Math.cos(a) * 2.2, by - Math.sin(a) * 2.2, tone(PAL.iron, d), 0.7); Ln(bx - Math.cos(a) * 4.4, by + Math.sin(a) * 4.4, bx - Math.cos(a) * 4.4, y - 2, tone(PAL.iron, d), 0.25);
    },
    container: function (x, y, d) {
      const iron = tone([226, 150, 50], d), cs = [[198, 84, 60], [70, 124, 168], [214, 170, 80], [96, 150, 110], [180, 180, 186]];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - (r === 2 ? 1 : 0); k++) R(x + 1.6 + k * 3.3 + (r === 2 ? 1.6 : 0), y - 1.6 - r * 1.6, 3.1, 1.5, tone(cs[(r * 2 + k * 3) % 5], d));
      for (const lx of [x - 6, x - 0.6]) { Ln(lx - 0.9, y, lx, y - 12, iron, 0.5); Ln(lx + 0.9, y, lx, y - 12, iron, 0.5); }
      R(x - 15, y - 12.8, 17.6, 1, iron); Ln(x - 3.3, y - 12.8, x - 3.3, y - 15.6, iron, 0.4); Ln(x - 3.3, y - 15.6, x - 14.6, y - 12.9, iron, 0.2); Ln(x - 3.3, y - 15.6, x + 2.4, y - 12.9, iron, 0.2);
      const tr = still ? 0.4 : 0.5 + 0.5 * Math.sin(E.t * 0.25), tx = x - 13 + tr * 12; R(tx - 0.9, y - 11.8, 1.8, 0.8, tone(PAL.iron, d)); Ln(tx, y - 11, tx, y - 6.4, tone(PAL.iron, d), 0.12); R(tx - 1.5, y - 6.4, 3, 1.4, tone(cs[1], d));
    },
    radio: function (x, y, d) {
      const c = tone(PAL.concrete, d), iron = tone([196, 60, 50], d);
      box(x + 4, y, 7, 4, c); band(x + 1.2, y - 2.8, 5.6, 0.8, d);
      for (let k = 0; k < 6; k++) { const y0 = y - k * 5, y1 = y0 - 5, w0 = 1.9 - k * 0.27, w1 = 1.9 - (k + 1) * 0.27, cc = k % 2 ? tone([236, 236, 236], d) : iron; Ln(x - w0, y0, x - w1, y1, cc, 0.28); Ln(x + w0, y0, x + w1, y1, cc, 0.28); Ln(x - w0, y0, x + w1, y1, cc, 0.16); Ln(x + w0, y0, x - w1, y1, cc, 0.16); }
      Ln(x, y - 30, x, y - 34, iron, 0.25); Ln(x - 9, y + 0.6, x, y - 22, tone(PAL.iron, d), 0.08); Ln(x + 11, y + 0.6, x, y - 22, tone(PAL.iron, d), 0.08);
      if (E.night > 0.15) for (const q of [34, 20, 10]) if (still || Math.sin(E.t * 2.2 + q) > -0.3) Ci(x, y - q, 0.6, [255, 70, 60], 1);
      if (!still) for (let i = 0; i < 2; i++) { const f = (E.t * 0.35 + i * 0.5) % 1; ctx.strokeStyle = col([255, 255, 255], 0.3 * (1 - f)); ctx.lineWidth = 0.2; ctx.beginPath(); ctx.arc(x, y - 33, 1.5 + f * 7, -2.4, -0.74); ctx.stroke(); }
    },
    proving: function (x, y, d) {
      const c = tone([120, 132, 104], d), iron = tone(PAL.iron, d);
      for (let i = 0; i < 9; i++) Ln(x - 13 + i * 3.25, y + 0.8, x - 13 + i * 3.25, y - 1.4, iron, 0.22); Ln(x - 13, y - 1.2, x + 13, y - 1.2, iron, 0.12); Ln(x - 13, y - 0.4, x + 13, y - 0.4, iron, 0.12);
      R(x - 11.6, y - 3.4, 9.2, 3.4, c); Dome(x - 7, y - 3.4, 4.6, 2.6, dk(c, 0.9)); R(x - 9, y - 3, 4, 3, tone([40, 44, 40], d));
      R(x - 0.6, y - 2.1, 5.4, 1.5, tone([96, 108, 84], d)); R(x + 0.6, y - 3.1, 2.6, 1.1, tone([84, 96, 74], d)); Ln(x + 3, y - 2.7, x + 6.4, y - 3.1, tone([84, 96, 74], d), 0.4); for (let i = 0; i < 3; i++) Ci(x + 0.3 + i * 1.8, y - 0.5, 0.6, iron);
      for (const tx of [x + 9.4, x + 11.8]) { Ln(tx, y, tx, y - 2.6, tone(PAL.timber, d), 0.25); Ci(tx, y - 3.6, 1.1, [240, 236, 228], 0.95); Ci(tx, y - 3.6, 0.5, [196, 60, 50], 0.95); }
    },
    grid: function (x, y, d) {
      const c = tone(PAL.concrete, d), iron = tone(PAL.iron, d);
      box(x, y, 9, 5, c); band(x - 3.8, y - 3.8, 7.6, 0.9, d); R(x - 4.7, y - 5.5, 9.4, 0.6, dk(c, 0.78));
      for (let i = 0; i < 3; i++) { const tx = x + 6.4 + i * 2.6; R(tx - 0.9, y - 2.2, 1.8, 2.2, tone([120, 130, 140], d)); Ln(tx, y - 2.2, tx, y - 4.2, iron, 0.2); Ci(tx, y - 4.4, 0.4, tone([220, 226, 232], d)); }
    },
    tracking: function (x, y, d) {
      const c = tone(PAL.pearl, d);
      box(x - 9, y, 6, 3.4, c); band(x - 11.6, y - 2.4, 5.2, 0.7, d);
      R(x - 1.3, y - 4, 2.6, 4, dk(c, 0.9)); K.dish(x, y - 3, 7.4, d);
      if (E.night > 0.1) Ci(x - 9, y - 4, 0.5, CYAN, E.night);
    },
    control: function (x, y, d) {
      const c = tone(PAL.pearl, d);
      R(x - 9, y - 4.4, 18, 4.4, c); R(x + 2, y - 4.4, 7, 4.4, dk(c, 0.88)); P([x - 9, y - 4.4, x - 7, y - 6, x + 7, y - 6, x + 9, y - 4.4], dk(c, 0.94));
      R(x - 8, y - 3.4, 16, 1.2, E.night > 0.1 ? CYAN : tone([52, 70, 96], d), E.night > 0.1 ? 0.85 : 0.92); R(x - 1.2, y - 1.8, 2.4, 1.8, tone([40, 50, 66], d));
      mast(x - 6.4, y - 6, 5.4, d, true); K.dish(x + 5.4, y - 5.6, 2.6, d);
      if (E.night > 0.1) Ci(x, y - 3, 11, CYAN, 0.06 * E.night);
    },
    exo: function (x, y, d) {
      const c = tone(PAL.pearl, d), dark = tone([40, 50, 66], d), fr = tone([150, 160, 172], d);
      R(x - 6, y - 4, 12, 4, c); Dome(x, y - 4, 6, 3, c); Dome(x + 1.8, y - 4, 4.2, 2.8, dk(c, 0.88)); R(x - 3.4, y - 4.6, 6.8, 4.6, dark); Dome(x, y - 4.6, 3.4, 1.4, dark);
      const fx = x + 8.6, sw = still ? 0 : Math.sin(E.t * 1.1) * 0.25;                                  // a frame standing by the door
      R(fx - 1.1, y - 3.6, 2.2, 2, fr); R(fx - 0.6, y - 4.5, 1.2, 0.9, fr); R(fx - 0.5, y - 4.25, 1, 0.3, CYAN, 0.95);
      Ln(fx - 0.7, y - 1.6, fx - 0.9, y, fr, 0.5); Ln(fx + 0.7, y - 1.6, fx + 0.9, y, fr, 0.5); Ln(fx - 1.3, y - 3.4, fx - 1.9 - sw, y - 1.6, fr, 0.4); Ln(fx + 1.3, y - 3.4, fx + 1.9 + sw, y - 1.6, fr, 0.4);
    },
    fusion: function (x, y, d) {
      const c = tone(PAL.pearl, d), pulse = still ? 0.6 : 0.5 + 0.3 * Math.sin(E.t * 2.6);
      Ci(x, y - 5, 9, CYAN, (0.05 + 0.1 * E.night) * (0.6 + pulse));
      for (const a of [-8.6, 8.6]) P([x + a - 1.2, y, x + a * 0.72 - 0.6, y - 5.4, x + a * 0.72 + 0.6, y - 5.4, x + a + 1.2, y], dk(c, 0.84));
      El(x, y - 4.2, 10.4, 3.5, c); El(x + 2.2, y - 3.8, 7.6, 2.9, dk(c, 0.9)); El(x, y - 4.8, 6, 1.6, tone([36, 46, 66], d)); El(x, y - 4.8, 4.2, 1, mix([255, 255, 255], CYAN, 0.6), 0.55 + 0.4 * pulse);
      R(x - 0.8, y - 11.6, 1.6, 7, dk(c, 0.92)); Ci(x, y - 12, 1.2, CYAN, 0.7 + 0.3 * pulse);
      ctx.strokeStyle = col(E.night > 0.1 ? CYAN : tone([120, 170, 200], d), 0.8); ctx.lineWidth = 0.3; ctx.beginPath(); ctx.ellipse(x, y - 4.2, 10.4, 3.5, 0, 0, Math.PI); ctx.stroke();
    }
  };
  /* the lines that carry the grid's power out along the road */
  function pylons(put) {
    if (!S.lm.grid) return;
    const pts = [[183, 157.6, 9.5], [201.5, 168.4, 12], [193.4, 187, 15.5]];
    pts.forEach(function (q, i) {
      put(q[1], function () {
        const x = q[0], y = q[1], h = q[2], c = tone([150, 156, 164], y > 160 ? 0.03 : 0.08), w = h * 0.17;
        Ln(x - w, y, x - w * 0.3, y - h, c, 0.3); Ln(x + w, y, x + w * 0.3, y - h, c, 0.3); for (let k = 1; k < 4; k++) { const f = k / 4, hw = w * (1 - 0.7 * f); Ln(x - hw, y - h * f, x + hw * (k % 2 ? 1 : -1) * 0.2 + (k % 2 ? hw : -hw) * 0.8, y - h * (f - 0.25), c, 0.15); }
        for (const a of [0.92, 0.74]) Ln(x - h * 0.3, y - h * a, x + h * 0.3, y - h * a, c, 0.25);
        const nx = pts[i + 1];
        ctx.strokeStyle = col(tone([40, 40, 46], 0.05), 0.75); ctx.lineWidth = 0.12;
        for (const a of [0.92, 0.74]) for (const sd of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(x + sd * h * 0.3, y - h * a);
          if (nx) ctx.quadraticCurveTo((x + nx[0]) / 2 + sd * 2, (y - h * a + nx[1] - nx[2] * a) / 2 + 4, nx[0] + sd * nx[2] * 0.3, nx[1] - nx[2] * a); else ctx.quadraticCurveTo(x + sd * 3 + 2, y - h * a + 9, x + 4 + sd * 5, 204);
          ctx.stroke();
          if (i === 0) { ctx.beginPath(); ctx.moveTo(x + sd * h * 0.3, y - h * a); ctx.quadraticCurveTo(x + 30, y - h * a - 1, 258 + sd, 139); ctx.stroke(); }
        }
      });
    });
  }
  function peg(x, y, w, d) {                                                           // ground pegged out for a landmark that can be built
    const wd = tone(PAL.timber, d);
    for (const px of [x - w / 2, x + w / 2]) Ln(px, y, px, y - 1.8, wd, 0.3);
    ctx.strokeStyle = col(tone([226, 214, 180], d), 0.9); ctx.lineWidth = 0.14; ctx.setLineDash([0.8, 0.6]); ctx.beginPath(); ctx.moveTo(x - w / 2, y - 1.5); ctx.lineTo(x + w / 2, y - 1.5); ctx.stroke(); ctx.setLineDash([]);
    Ln(x, y, x, y - 3.4, wd, 0.3); R(x - 1.5, y - 4.4, 3, 1.5, tone([226, 214, 180], d)); Ln(x - 0.9, y - 3.65, x + 0.9, y - 3.65, wd, 0.16);
  }
  function depth(y) { return y >= 160 ? 0.03 : y >= 150 ? 0.1 : y >= 138 ? 0.155 : y >= 128 ? 0.2 : 0.23; }

  /* ---------- a town that has grown keeps a gate, and then walls ---------- */
  function walls(put) {
    if (S.rank < 3) return;
    const stone = S.rank >= 4, d = 0.1, c = tone(stone ? PAL.stone : PAL.timber, d), cd = dk(c, 0.84);
    [108.4, 257.4].forEach(function (x, i) {
      if (!stone && i === 0) return;                                                   // a town has one gate, on the road side
      put(151.05, function () {
        if (!stone) { for (let k = 0; k < 5; k++) { const px = x + 1.2 + k * 1.1; P([px - 0.45, 151.2, px - 0.45, 147.4, px, 146.6, px + 0.45, 147.4, px + 0.45, 151.2], k % 2 ? c : cd); } Ln(x - 1.8, 151.2, x - 1.8, 145.6, c, 0.7); Ln(x + 0.6, 151.2, x + 0.6, 145.6, c, 0.7); R(x - 2.3, 145.2, 3.4, 0.8, cd); return; }
        const h = age >= 4 ? 7 : 9.4; box(x, 151.2, 3.6, h, c); for (let k = 0; k < 3; k++) R(x - 1.9 + k * 1.4, 151.2 - h - 0.9, 0.9, 0.9, c); arch(x, 151.2, 1.5, 2.2, d); if (age <= 3) flag(x, 151.2 - h - 0.8, 3.6, [176, 44, 36], d);
      });
    });
    if (stone && age <= 3) put(131.7, function () {                                    // the wall behind the last row of houses
      const w = tone(PAL.stone, 0.22); R(144, 129.2, 108, 2.6, w); for (let k = 0; k < 36; k++) R(144 + k * 3, 128.4, 1.7, 0.9, w);
      for (const tx of [144, 198, 252]) { R(tx - 1.8, 126.4, 3.6, 5.4, dk(w, 0.94)); for (let k = 0; k < 3; k++) R(tx - 1.9 + k * 1.4, 125.6, 0.9, 0.9, w); }
    });
  }

  /* ---------- everything, handed to the scene's sorted list ---------- */
  Town.draw = function (put, events) {
    plots(put); farmMarks(put); lumberUnits(put); scriptUnits(put); guildUnits(put); masonUnits(put); univMarks(put); bankMarks(put); steelMarks(put); obsMarks(put);
    exchMarks(put); refinMarks(put); instMarks(put); portMarks(put); fabMarks(put); arrayMarks(put); pylons(put);
    walls(put);
    for (const id in LM) (function (id) {
      const q = LM[id], built = !!S.lm[id];
      if (!built && (F.lmOpen || []).indexOf(id) < 0) return;
      if (built) { if (DRAW[id]) put(q[1] + 0.05, function () { DRAW[id](q[0], q[1], depth(q[1])); }); }
      else if (E.z > 0.9) put(q[1] + 0.05, function () { peg(q[0], q[1], Math.min(q[2], 12), depth(q[1])); });
    })(id);
  };
  /* ---------- places the heroes found, far from the walls: a surveyor's pennant, then the outpost ---------- */
  const POST = {                 // x of the middle, y of the ground, width, height
    d1c: [70, 115.6, 10, 6], d3a: [80.6, 115.8, 10, 9], d2c: [116, 117.2, 11, 6], d3c: [127.5, 117.8, 8, 7],
    d4c: [7, 117.3, 8, 6], d5a: [34, 62, 9, 6, 1], d5b: [60, 50, 8, 5, 1], d5c: [122, 56, 8, 8, 1]      // the last three are overhead
  };
  const FAR = 0.4;
  const POSTS = {
    d1c: function (x, y) {       // mine workings: an adit in the hill, a spoil heap and a tub on rails
      P([x - 5, y, x - 2.6, y - 4.6, x + 2.4, y - 5, x + 5, y], tone([98, 108, 96], FAR));
      R(x - 1.2, y - 2.6, 2.4, 2.6, tone([40, 36, 36], FAR)); Ln(x - 1.4, y, x - 1.4, y - 2.8, tone(PAL.timber, FAR), 0.4); Ln(x + 1.4, y, x + 1.4, y - 2.8, tone(PAL.timber, FAR), 0.4); Ln(x - 1.6, y - 2.8, x + 1.6, y - 2.8, tone(PAL.timber, FAR), 0.4);
      Dome(x + 3.6, y, 1.6, 1.3, tone([120, 112, 104], FAR)); R(x - 0.5, y - 0.9, 1.2, 0.7, tone([90, 70, 54], FAR));
    },
    d3a: function (x, y) {       // colliery: winding tower with its wheel, an engine house and its smoke
      const c = tone(PAL.iron, FAR);
      Ln(x - 1.6, y, x - 0.4, y - 7.4, c, 0.45); Ln(x + 1.6, y, x + 0.4, y - 7.4, c, 0.45); Ln(x + 3.6, y, x + 0.4, y - 6.6, c, 0.35);
      ctx.strokeStyle = col(c); ctx.lineWidth = 0.35; ctx.beginPath(); ctx.arc(x, y - 7.6, 1.1, 0, TAU); ctx.stroke();
      box(x - 3.4, y, 3.2, 2.6, tone([150, 96, 80], FAR)); gable(x - 3.4, y - 2.6, 3.2, 1.3, tone([70, 62, 64], FAR), 0.3);
      stack(x - 4.6, y - 2, 0.7, 4, tone([120, 84, 74], FAR), 0.83); Dome(x + 4.2, y, 1.8, 1.4, tone([52, 50, 54], FAR));
    },
    d2c: function (x, y) {       // free port: a quay, two warehouses and a ship alongside
      R(x - 5.5, y - 0.5, 11, 0.9, tone(PAL.stone, FAR)); for (const px of [x - 4.5, x - 1.5, x + 1.5, x + 4.5]) R(px - 0.15, y + 0.4, 0.3, 1, tone(PAL.timber, FAR));
      box(x - 2.8, y - 0.5, 3.4, 2.4, tone(PAL.lime, FAR)); gable(x - 2.8, y - 2.9, 3.4, 1.5, tone(PAL.terra, FAR), 0.3);
      box(x + 0.9, y - 0.5, 3, 2, tone([196, 176, 150], FAR)); gable(x + 0.9, y - 2.5, 3, 1.3, tone(PAL.terra, FAR), 0.3);
      const m = tone(PAL.timber, FAR);                                                  // a ship alongside: her masts over the roofs
      for (const mx of [x + 3.4, x + 4.9]) { Ln(mx, y - 0.5, mx, y - 5.6, m, 0.3); Ln(mx - 1, y - 4.4, mx + 1, y - 4.4, m, 0.25); R(mx - 0.9, y - 4.3, 1.8, 0.5, tone(PAL.lime, FAR)); }
      P([x + 2.2, y - 0.5, x + 6.2, y - 0.5, x + 5.7, y - 1.3, x + 2.6, y - 1.3], tone([74, 58, 50], FAR));
    },
    d3c: function (x, y) {       // garrison: a square fort with corner towers and the colours over the gate
      const c = tone([150, 146, 140], FAR), cd = tone([120, 116, 112], FAR);
      R(x - 3.6, y - 2.8, 7.2, 2.8, c); for (const tx of [x - 3.9, x + 2.7]) { R(tx, y - 4, 1.2, 4, cd); R(tx - 0.2, y - 4.4, 1.6, 0.5, cd); }
      R(x - 0.6, y - 1.6, 1.2, 1.6, tone([44, 40, 40], FAR)); for (let i = 0; i < 4; i++) R(x - 2.4 + i * 1.4, y - 3.2, 0.7, 0.4, c);
      flag(x, y - 2.8, 4, [176, 44, 36], FAR);
    },
    d4c: function (x, y) {       // ice core laboratory: huts on legs, a drill tower, the cores kept cold
      const c = tone([226, 230, 234], FAR);
      R(x - 3.6, y - 2.6, 4.4, 1.9, tone([200, 70, 56], FAR)); for (const lx of [x - 3.2, x - 1.4, x + 0.4]) R(lx, y - 0.8, 0.3, 0.8, tone(PAL.iron, FAR));
      band(x - 3.1, y - 2.1, 3.4, 0.5, FAR); Dome(x + 2.6, y, 1.5, 1.7, c);
      Ln(x + 0.6, y, x + 1.3, y - 5.6, tone(PAL.iron, FAR), 0.35); Ln(x + 2, y, x + 1.3, y - 5.6, tone(PAL.iron, FAR), 0.35); mast(x - 3, y - 2.6, 3, FAR, true);
    },
    d5a: function (x, y) {       // orbital scrapyard: a yard in orbit, hulks drifting beside it
      const c = sky([226, 230, 236]), y0 = y - 3;
      R(x - 2.2, y0 - 0.35, 4.4, 0.7, c); R(x - 0.4, y0 - 1.3, 0.8, 2.6, c); R(x - 3.9, y0 - 1.1, 1.5, 2.2, sky([120, 150, 206])); R(x + 2.4, y0 - 1.1, 1.5, 2.2, sky([120, 150, 206]));
      for (let i = 0; i < 4; i++) { const a = (still ? 0 : E.t * 0.05) + i * 1.7, r = 2.6 + i * 0.5; R(x + Math.cos(a) * r * 1.5 - 0.25, y0 + Math.sin(a) * r * 0.6 - 0.2, 0.5 + (i % 2) * 0.3, 0.4, sky([190, 176, 160])); }
      lamp(x, y0 - 1.6, [255, 190, 90], 0);
    },
    d5b: function (x, y) {       // helium works: a tanker on its way down from the mine, low over the horizon of the day
      const c = sky([232, 234, 238]), y0 = y - 2.5;
      R(x - 2.4, y0 - 0.7, 4.8, 1.4, c); Ci(x - 2.4, y0, 0.7, c); Ci(x + 2.4, y0, 0.7, c); R(x - 1.2, y0 - 0.7, 0.5, 1.4, sky([196, 150, 60])); R(x + 0.7, y0 - 0.7, 0.5, 1.4, sky([196, 150, 60]));
      P([x + 3, y0 - 0.5, x + 4.4, y0, x + 3, y0 + 0.5], sky([170, 176, 186]));
      if (!still) for (let i = 0; i < 3; i++) Ci(x - 3.4 - i * 1.1, y0 + Math.sin(E.t * 3 + i) * 0.15, 0.35 - i * 0.07, [255, 220, 150], 0.7 - i * 0.2);
      lamp(x + 1.8, y0 - 0.9, [255, 214, 110], 1.3);
    },
    d5c: function (x, y) {       // listening post: five receivers flying in a ring, turned to the same star
      const y0 = y - 4, a0 = still ? 0.4 : E.t * 0.04;
      ctx.strokeStyle = col(CYAN, 0.25 + 0.2 * E.night); ctx.lineWidth = 0.15; ctx.beginPath(); ctx.ellipse(x, y0, 3.4, 2.2, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < 5; i++) { const a = a0 + i * TAU / 5; R(x + Math.cos(a) * 3.4 - 0.45, y0 + Math.sin(a) * 2.2 - 0.3, 0.9, 0.6, sky([226, 232, 240])); }
      lamp(x, y0, CYAN, 2.1);
    }
  };
  function sky(c) { return mix(c, E.mid || [150, 180, 220], 0.28 - 0.2 * E.night); }           // a thing overhead: pale by day, bright against the night
  function lamp(x, y, c, ph) { const on = still || Math.sin(E.t * 1.8 + ph) > -0.2; if (on) { Ci(x, y, 0.42, c, 0.95); if (E.night > 0.2) Ci(x, y, 1.6, c, 0.2 * E.night); } }
  Town.post = function (id) { return POST[id] || null; };
  Town.far = function () {
    const ps = F.sites || {};
    for (const id in POST) {
      const st = ps[id], q = POST[id]; if (!st) continue;
      if (st === 2) POSTS[id](q[0], q[1]);
      else if (q[4]) { ctx.strokeStyle = col([240, 236, 220], 0.8); ctx.lineWidth = 0.3; ctx.setLineDash([0.8, 0.8]); ctx.beginPath(); ctx.arc(q[0], q[1] - q[3] / 2, 2.4, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }      // charted, nothing there yet
      else { R(q[0] - 1.6, q[1] - 0.3, 3.2, 0.5, tone([150, 140, 110], FAR)); flag(q[0], q[1], 4.4, [240, 236, 220], FAR); }      // found, not yet built on
    }
  };

  /* places that can be touched; the life layer calls this so that they lie over the houses and under what stands in front */
  Town.sites = function () {
    for (const id in LM) { const q = LM[id]; if (shown(id)) K.site('lm:' + id, q[0] - q[2] / 2 - 1, q[1] - q[3], q[2] + 2, q[3] + 1.5); }
    for (const id in POST) { const q = POST[id]; if ((F.sites || {})[id]) K.site('post:' + id, q[0] - q[2] / 2 - 1, q[1] - q[3] - 1, q[2] + 2, q[3] + 3); }
  };
  root.Town = Town;
})(typeof globalThis !== 'undefined' ? globalThis : this);
