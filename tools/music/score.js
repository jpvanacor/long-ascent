/* Long Ascent: the five pieces, one per age, written as plain note lists.
   A voice is a string of pitch:length pairs (r is a rest, [..] a chord); lengths are in the unit of the piece
   (an eighth note for the 6/8 dance, a beat for the others). Bars are separated by | only for the eye. */
'use strict';
const { Mix, midi, rng } = require('./lib.js');

function parse(str) {
  const out = [], re = /(\[[^\]]+\]|[A-G][#b]?-?\d|r):([\d.]+)/g; let m;
  const clean = str.replace(/\|/g, ' ');
  while ((m = re.exec(clean))) out.push({ notes: m[1] === 'r' ? [] : m[1].charAt(0) === '[' ? m[1].slice(1, -1).trim().split(/\s+/).map(midi) : [midi(m[1])], d: +m[2] });
  return out;
}
function length(str) { return parse(str).reduce(function (a, e) { return a + e.d; }, 0); }
/* time of a position in units: steady, then slowing down between a and b until every unit is `slow` times longer */
function clock(unit, a, b, slow, swing) {
  return function (u) {
    if (swing) { const f = u - Math.floor(u); if (Math.abs(f - 0.5) < 0.01) u = Math.floor(u) + swing; }
    let x = u;
    if (a !== undefined && u > a) { const v = Math.min(u, b) - a; x = a + v + (slow - 1) * v * v / (2 * (b - a)) + (u > b ? (u - b) * slow : 0); }
    return x * unit;
  };
}
/* put a voice on a stem. o: at (start unit), vel, legato (fraction of the length that sounds), roll (seconds between chord notes), accent (units per bar), jitter */
function play(stem, inst, str, T, o) {
  o = o || {};
  const rnd = rng(o.seed || 7), ev = parse(str); let u = o.at || 0;
  ev.forEach(function (e) {
    const t0 = T(u), t1 = T(u + e.d), strong = o.accent && Math.abs(u / o.accent - Math.round(u / o.accent)) < 0.01;
    e.notes.forEach(function (m, i) {
      const vel = (o.vel || 0.8) * (strong ? 1.1 : 1) * (0.94 + 0.12 * rnd());
      const t = t0 + (o.roll || 0) * i + (rnd() - 0.5) * (o.jitter === undefined ? 0.008 : o.jitter);
      const dur = Math.max(0.05, (t1 - t0) * (o.legato === undefined ? 0.92 : o.legato) + (o.ring || 0));
      stem.note(inst, m + (o.shift || 0), Math.max(0, t), dur, { vel: Math.min(1, vel), rel: o.rel });
    });
    u += e.d;
  });
  return u;
}
/* build a voice from a list of bars: names of patterns */
function bars(list, table) { return list.map(function (c) { if (!table[c]) throw new Error('no pattern for ' + c); return table[c]; }).join(' | '); }

/* ---------- 1. Medieval: a round dance in D Dorian, 6/8 ---------- */
function medieval() {
  const U = 0.3, T = clock(U, 180, 198, 1.7), mix = new Mix(66, { reverb: { room: 0.72, damp: 0.5 }, wet: 1, fadeOut: 0.4 });
  const lute = mix.stem({ name: 'lute', level: -21, send: 0.16, pan: -0.22 }), rec = mix.stem({ name: 'recorder', level: -19.5, send: 0.3, pan: 0.15 }), bass = mix.stem({ name: 'cello', level: -22.5, send: 0.14 });
  const harm = ['Dm', 'Dm',
    'Dm', 'C', 'Dm', 'Am', 'Dm', 'G', 'C', 'Dm',
    'F', 'C', 'G', 'Dm', 'F', 'C', 'Am', 'Dm',
    'Dm', 'C', 'G', 'Dm',
    'Dm', 'C', 'Dm', 'Am', 'Dm', 'G', 'C', 'Dm',
    'Dm', 'Dm'];
  const arp = { Dm: 'D3:1 A3:1 D4:1 F4:1 D4:1 A3:1', C: 'C3:1 G3:1 C4:1 E4:1 C4:1 G3:1', Am: 'A2:1 E3:1 A3:1 C4:1 A3:1 E3:1', G: 'G2:1 D3:1 G3:1 B3:1 G3:1 D3:1', F: 'F2:1 C3:1 F3:1 A3:1 F3:1 C3:1' };
  const root = { Dm: 'D2:6', C: 'C2:6', Am: 'A2:6', G: 'G2:6', F: 'F2:6' };
  play(lute, 'acoustic_guitar_nylon', bars(harm, arp), T, { vel: 0.7, accent: 3, ring: 0.5, legato: 1, seed: 11 });
  lute.note('acoustic_guitar_nylon', 'D3', T(192), 3, { vel: 0.7 }); lute.note('acoustic_guitar_nylon', 'A3', T(192) + 0.05, 3, { vel: 0.62 }); lute.note('acoustic_guitar_nylon', 'D4', T(192) + 0.1, 3, { vel: 0.62 }); lute.note('acoustic_guitar_nylon', 'F4', T(192) + 0.15, 3, { vel: 0.6 });
  play(bass, 'cello', bars(harm, root) + ' | D2:8', T, { vel: 0.7, legato: 0.97, seed: 3, jitter: 0.004 });
  const A = 'A4:2 D5:1 D5:2 E5:1 | E5:2 D5:1 C5:2 D5:1 | F5:2 E5:1 D5:2 C5:1 | E5:2 C5:1 A4:3 | A4:2 D5:1 D5:2 E5:1 | D5:2 B4:1 D5:2 E5:1 | E5:2 G5:1 E5:2 C5:1 | ';
  const B = 'F5:2 G5:1 A5:2 G5:1 | E5:2 G5:1 E5:2 D5:1 | D5:2 E5:1 D5:2 B4:1 | D5:3 A4:3 | F5:2 G5:1 A5:2 G5:1 | G5:2 E5:1 C5:2 E5:1 | E5:2 D5:1 C5:2 B4:1 | A4:2 C5:1 D5:3';
  play(rec, 'recorder', 'r:12 | ' + A + 'D5:5 r:1 | ' + B + ' | r:24 | ' + A + 'D5:6', T, { vel: 0.72, accent: 3, legato: 0.9, seed: 5 });
  return { mix: mix, lufs: -18, name: 'age1' };
}

/* ---------- 2. Renaissance: a pavane in G on the passamezzo ground, with a romanesca in the middle ---------- */
function renaissance() {
  const U = 60 / 96, T = clock(U, 100, 112, 1.6), mix = new Mix(80, { reverb: { room: 0.78, damp: 0.42 }, wet: 1, fadeOut: 0.4 });
  const harp = mix.stem({ name: 'harpsichord', level: -22, send: 0.2, pan: -0.18 }), fl = mix.stem({ name: 'flute', level: -19.5, send: 0.3, pan: 0.18 }), bass = mix.stem({ name: 'cello', level: -22, send: 0.16 });
  const harm = ['G', 'D',
    'G', 'C', 'G', 'D', 'G', 'C', 'GD', 'G',
    'G', 'D', 'Em', 'B', 'G', 'D', 'EmB', 'Em',
    'G', 'C', 'G', 'D', 'G', 'C', 'GD', 'G',
    'C', 'G'];
  const h = { G: 'D3:.5 G3:.5 B3:.5 G3:.5', C: 'E3:.5 G3:.5 C4:.5 G3:.5', D: 'D3:.5 F#3:.5 A3:.5 F#3:.5', Em: 'E3:.5 G3:.5 B3:.5 G3:.5', B: 'D#3:.5 F#3:.5 B3:.5 F#3:.5' };
  const arp = { G: h.G + ' ' + h.G, C: h.C + ' ' + h.C, D: h.D + ' ' + h.D, Em: h.Em + ' ' + h.Em, B: h.B + ' ' + h.B, GD: h.G + ' ' + h.D, EmB: h.Em + ' ' + h.B };
  const low = { G: 'G2:2 G2:2', C: 'C3:2 C3:2', D: 'D2:2 D2:2', Em: 'E2:2 E2:2', B: 'B2:2 B2:2', GD: 'G2:2 D2:2', EmB: 'E2:2 B2:2' };
  play(harp, 'harpsichord', bars(harm, arp), T, { vel: 0.62, accent: 2, legato: 1, ring: 0.25, seed: 21 });
  play(harp, 'harpsichord', bars(harm, low), T, { vel: 0.7, legato: 0.95, seed: 22 });
  ['G2', 'D3', 'G3', 'B3', 'D4'].forEach(function (n, i) { harp.note('harpsichord', n, T(112) + i * 0.05, 3, { vel: 0.66 }); });
  play(bass, 'cello', bars(harm, low) + ' | G2:5', T, { vel: 0.7, legato: 0.96, seed: 23, jitter: 0.004 });
  const A = 'D5:1.5 E5:.5 D5:1 B4:1 | C5:1.5 D5:.5 E5:2 | D5:1 B4:1 G4:1 B4:1 | A4:3 r:1 | D5:1.5 E5:.5 D5:1 G5:1 | E5:1.5 F#5:.5 G5:2 | D5:1 B4:1 A4:1.5 G4:.5 | G4:3 r:1';
  const B = 'B4:1 D5:1 G5:2 | F#5:1 E5:1 D5:2 | E5:1 F#5:1 G5:1 E5:1 | F#5:2 D#5:2 | B4:1 D5:1 G5:2 | A5:1 G5:1 F#5:2 | G5:1 E5:1 F#5:1.5 D#5:.5 | E5:3 r:1';
  const A2 = 'D5:1.5 E5:.5 D5:.5 C5:.5 B4:1 | C5:1.5 D5:.5 E5:1 G5:1 | D5:1 B4:1 G4:1 B4:1 | A4:3 r:1 | D5:1.5 E5:.5 D5:1 G5:1 | E5:1.5 F#5:.5 G5:2 | D5:1 B4:1 A4:1.5 G4:.5 | G4:4';
  play(fl, 'flute', 'r:8 | ' + A + ' | ' + B + ' | ' + A2 + ' | E5:2 C5:2 | B4:1 A4:1 G4:3', T, { vel: 0.72, accent: 4, legato: 0.93, seed: 25 });
  return { mix: mix, lufs: -18, name: 'age2' };
}

/* ---------- 3. Industrial: a waltz, A minor with a C major middle ---------- */
function industrial() {
  const U = 60 / 132, T = clock(U, 147, 156, 1.6), mix = new Mix(78, { reverb: { room: 0.7, damp: 0.45 }, wet: 1, fadeOut: 0.4 });
  const pno = mix.stem({ name: 'piano', level: -21.5, send: 0.2, pan: -0.15 }), cl = mix.stem({ name: 'clarinet', level: -20.5, send: 0.3, pan: 0.2 }), str = mix.stem({ name: 'strings', level: -27, send: 0.4 });
  const A = ['Am', 'Am2', 'Dm', 'Am', 'E7', 'E72', 'Am', 'E7', 'Am', 'Am2', 'Dm', 'Am', 'F', 'E7', 'Am', 'Am2'];
  const B = ['C', 'C2', 'G7', 'G72', 'G7', 'G72', 'C', 'C2', 'C', 'C7', 'F', 'Dm', 'CG', 'G7', 'C', 'E7'];
  const harm = ['Am', 'Am2'].concat(A, B, A, ['Am']);
  const oom = { Am: 'A2:1 [A3 C4 E4]:1 [A3 C4 E4]:1', Am2: 'E3:1 [A3 C4 E4]:1 [A3 C4 E4]:1', Dm: 'D3:1 [A3 D4 F4]:1 [A3 D4 F4]:1', E7: 'E2:1 [G#3 B3 D4]:1 [G#3 B3 D4]:1', E72: 'B2:1 [G#3 B3 D4]:1 [G#3 B3 D4]:1',
    F: 'F2:1 [A3 C4 F4]:1 [A3 C4 F4]:1', C: 'C3:1 [G3 C4 E4]:1 [G3 C4 E4]:1', C2: 'G2:1 [G3 C4 E4]:1 [G3 C4 E4]:1', G7: 'G2:1 [B3 D4 F4]:1 [B3 D4 F4]:1', G72: 'D3:1 [B3 D4 F4]:1 [B3 D4 F4]:1',
    C7: 'C3:1 [G3 Bb3 E4]:1 [G3 Bb3 E4]:1', CG: 'G2:1 [G3 C4 E4]:1 [G3 C4 E4]:1' };
  const pad = { Am: '[C4 E4]:3', Am2: '[C4 E4]:3', Dm: '[D4 F4]:3', E7: '[B3 E4]:3', E72: '[B3 E4]:3', F: '[C4 F4]:3', C: '[E4 G4]:3', C2: '[E4 G4]:3', G7: '[D4 F4]:3', G72: '[D4 F4]:3', C7: '[E4 Bb4]:3', CG: '[E4 G4]:3' };
  play(pno, 'acoustic_grand_piano', bars(harm, oom), T, { vel: 0.66, accent: 3, legato: 0.7, seed: 31, roll: 0.006 });
  ['A2', 'E3', 'A3', 'C4', 'E4'].forEach(function (n, i) { pno.note('acoustic_grand_piano', n, T(153) + i * 0.07, 3, { vel: 0.6 }); });
  play(str, 'string_ensemble_1', 'r:6 | ' + bars(harm.slice(2), pad) + ' | [C4 E4]:5', T, { vel: 0.7, legato: 1.02, seed: 33, jitter: 0.004 });
  const mA = 'A4:1 C5:1 E5:1 | A5:2 E5:1 | F5:1 E5:1 D5:1 | E5:3 | D5:1 B4:1 G#4:1 | E5:2 D5:1 | C5:1 B4:1 A4:1 | B4:3 | A4:1 C5:1 E5:1 | A5:2 E5:1 | F5:1 G5:1 A5:1 | E5:2 C5:1 | A4:1 C5:1 F5:1 | E5:2 D5:1 | C5:1 B4:1 A4:1 | A4:3';
  const mB = 'E5:1 G5:1 C6:1 | C6:2 G5:1 | B5:1 A5:1 G5:1 | F5:2 D5:1 | D5:1 F5:1 B5:1 | A5:2 G5:1 | E5:1 G5:1 E5:1 | C5:3 | E5:1 G5:1 C6:1 | Bb5:2 G5:1 | A5:1 F5:1 A5:1 | F5:1 E5:1 D5:1 | E5:1 G5:1 C6:1 | F5:1 D5:1 B4:1 | C5:3 | B4:1 D5:1 E5:1';
  play(cl, 'clarinet', 'r:6 | ' + mA + ' | ' + mB + ' | ' + mA, T, { vel: 0.7, accent: 3, legato: 0.95, seed: 35 });
  return { mix: mix, lufs: -18, name: 'age3' };
}

/* ---------- 4. Modern: a slow swing in F for electric piano, bass and vibraphone ---------- */
function modern() {
  const U = 60 / 92, T = clock(U, 100, 108, 1.5, 0.64), mix = new Mix(82, { reverb: { room: 0.66, damp: 0.5 }, wet: 1, fadeOut: 0.5 });
  const ep = mix.stem({ name: 'electric piano', level: -23, send: 0.22, pan: -0.2 }), vib = mix.stem({ name: 'vibraphone', level: -20, send: 0.32, pan: 0.2 }), bass = mix.stem({ name: 'bass', level: -20.5, send: 0.06 });
  const A = ['F', 'Dm', 'Gm', 'C', 'F', 'Dm', 'GmC', 'F'], B = ['Bb', 'Am', 'Gm', 'C', 'Bb', 'AmDm', 'GmC', 'F'];
  const harm = ['F', 'F'].concat(A, B, A, ['F', 'F']);
  const v = { F: '[A3 C4 E4]', Dm: '[F3 A3 C4]', Gm: '[F3 Bb3 D4]', C: '[E3 Bb3 D4]', Bb: '[A3 D4 F4]', Am: '[G3 C4 E4]' };
  const comp = {}; ['F', 'Dm', 'Gm', 'C', 'Bb', 'Am'].forEach(function (c) { comp[c] = v[c] + ':1.5 ' + v[c] + ':2.5'; });
  comp.GmC = v.Gm + ':2 ' + v.C + ':2'; comp.AmDm = v.Am + ':2 ' + v.Dm + ':2';
  play(ep, 'electric_piano_1', bars(harm, comp), T, { vel: 0.62, accent: 4, legato: 0.8, seed: 41, roll: 0.012 });
  // the bass walks: root, fifth, then a step toward the next root
  const walk = ['F2:2 C3:1 E2:1', 'F2:2 C3:1 E2:1',
    'F2:2 C3:1 E2:1', 'D2:2 A2:1 F#2:1', 'G2:2 D3:1 Bb2:1', 'C3:2 G2:1 E2:1', 'F2:2 C3:1 E2:1', 'D2:2 A2:1 F#2:1', 'G2:2 C3:2', 'F2:2 C3:1 A2:1',
    'Bb2:2 F2:1 G2:1', 'A2:2 E2:1 Ab2:1', 'G2:2 D3:1 Bb2:1', 'C3:2 G2:1 A2:1', 'Bb2:2 F2:1 G2:1', 'A2:2 D2:2', 'G2:2 C3:2', 'F2:2 C3:1 E2:1',
    'F2:2 C3:1 E2:1', 'D2:2 A2:1 F#2:1', 'G2:2 D3:1 Bb2:1', 'C3:2 G2:1 E2:1', 'F2:2 C3:1 E2:1', 'D2:2 A2:1 F#2:1', 'G2:2 C3:2', 'F2:2 C3:2',
    'F2:4', 'F2:4'];
  play(bass, 'acoustic_bass', walk.join(' | '), T, { vel: 0.74, accent: 4, legato: 0.86, seed: 43 });
  const mA = 'r:1 A4:1 C5:1 E5:1 | D5:2 C5:1 A4:1 | Bb4:1.5 D5:.5 F5:2 | E5:1 D5:1 Bb4:1 G4:1 | A4:3 r:1 | r:1 F5:1 E5:1 D5:1 | D5:1 Bb4:1 G4:1 Bb4:1 | A4:3 r:1';
  const mB = 'D5:1 F5:1 A5:2 | G5:1 E5:1 C5:2 | Bb4:1 D5:1 F5:1.5 D5:.5 | E5:2 r:1 C5:1 | D5:1 F5:1 A5:2 | G5:1 E5:1 F5:1 D5:1 | Bb4:1 D5:1 C5:1 E5:1 | F5:3 r:1';
  play(vib, 'vibraphone', 'r:8 | ' + mA + ' | ' + mB + ' | ' + mA + ' | F4:.5 A4:.5 C5:.5 E5:.5 G5:2 | r:4', T, { vel: 0.72, accent: 4, legato: 1, ring: 0.9, seed: 45 });
  return { mix: mix, lufs: -18, name: 'age4' };
}

/* ---------- 5. Space: slow chords in D Lydian with far bells ---------- */
function space() {
  const T = clock(1), mix = new Mix(76, { reverb: { room: 0.9, damp: 0.3 }, wet: 1.25, fadeOut: 5 });
  const pad = mix.stem({ name: 'pad', level: -24, send: 0.45 }), low = mix.stem({ name: 'low', level: -25, send: 0.2 }), halo = mix.stem({ name: 'halo', level: -29, send: 0.5, pan: 0.1 });
  const bellL = mix.stem({ name: 'bells left', level: -25, send: 0.6, pan: -0.45 }), bellR = mix.stem({ name: 'bells right', level: -25, send: 0.6, pan: 0.45 });
  const chords = [['D2', ['A3', 'D4', 'E4', 'F#4'], 'A4'], ['D2', ['B3', 'E4', 'G#4'], 'B4'], ['F#2', ['A3', 'C#4', 'E4'], 'C#5'], ['B2', ['A3', 'D4', 'F#4'], 'D5'],
    ['D2', ['A3', 'D4', 'E4', 'F#4'], 'A4'], ['D2', ['B3', 'E4', 'G#4'], 'B4'], ['C#3', ['A3', 'E4', 'A4'], 'C#5'], ['D2', ['A3', 'D4', 'F#4'], 'D5']];
  chords.forEach(function (c, i) {
    const t = i * 8, len = i === 7 ? 13 : 8.6;
    low.note('pad_2_warm', c[0], t, len, { vel: 0.8 });
    c[1].forEach(function (n, k) { pad.note('pad_2_warm', n, t + k * 0.12, len, { vel: 0.72 }); });
    halo.note('pad_7_halo', c[2], t + 1, len - 1.2, { vel: 0.7, atk: 1.2 });
  });
  const bells = [[1, 'F#5'], [2.5, 'A5'], [4, 'E6'], [6.5, 'C#6'], [9, 'G#5'], [10.5, 'B5'], [12, 'E6'], [14.5, 'B5'], [17, 'A5'], [18.5, 'C#6'], [20, 'E6'], [22, 'F#6'],
    [25, 'D6'], [26.5, 'B5'], [28, 'F#5'], [30.5, 'A5'], [33, 'F#5'], [34.5, 'A5'], [36, 'E6'], [38, 'G#6'], [41, 'G#5'], [42.5, 'B5'], [44, 'E6'], [46, 'B6'],
    [49, 'C#6'], [50.5, 'A5'], [52, 'E5'], [54, 'A5'], [57, 'F#5'], [58.5, 'A5'], [60, 'D6'], [64, 'A6']];
  bells.forEach(function (b, i) {
    const a = i % 2 ? bellR : bellL, o = i % 2 ? bellL : bellR;
    a.note('fx_3_crystal', b[1], b[0], 2.5, { vel: 0.8 }); a.note('celesta', b[1], b[0], 2, { vel: 0.3 });
    o.note('fx_3_crystal', b[1], b[0] + 0.75, 2.5, { vel: 0.36 }); a.note('fx_3_crystal', b[1], b[0] + 1.5, 2.5, { vel: 0.16 });
  });
  return { mix: mix, lufs: -19, name: 'age5' };
}

module.exports = { pieces: [medieval, renaissance, industrial, modern, space], parse, length, clock, play };
