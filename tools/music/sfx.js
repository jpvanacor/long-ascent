/* Long Ascent: the sound effects, written the same way as the music: a few notes each, from the same samples.
   Every effect returns its mix, the peak level it is written at (dBFS), and whether it is mono. */
'use strict';
const { Mix } = require('./lib.js');

function fx(seconds, o, build) {
  const mix = new Mix(seconds, { reverb: { room: o.room === undefined ? 0.5 : o.room, damp: 0.5 }, wet: o.wet === undefined ? 0.5 : o.wet });
  const stems = {};
  const on = function (inst, level, pan) { const k = inst + (pan || 0); return stems[k] || (stems[k] = mix.stem({ name: inst, level: level === undefined ? -20 : level, send: 0.3, pan: pan || 0 })); };
  /* n(instrument, note or [notes], time, length, velocity, stem level, extra) */
  const n = function (inst, notes, t, dur, vel, level, extra) { [].concat(notes).forEach(function (m) { on(inst, level, extra && extra.pan).note(inst, m, t, dur, Object.assign({ vel: vel === undefined ? 0.8 : vel }, extra || {})); }); };
  build(n);
  return { mix: mix, peak: o.peak, mono: !!o.mono, floor: o.floor };
}
const seq = function (n, inst, notes, t0, step, dur, vel, level, extra) { notes.forEach(function (m, i) { n(inst, m, t0 + i * step, dur, typeof vel === 'function' ? vel(i) : vel, level, extra); }); };

module.exports = {
  tap: function () { return fx(0.4, { peak: -15, mono: true, wet: 0 }, function (n) { n('woodblock', 'G5', 0, 0.06, 0.6); }); },
  open: function () { return fx(0.6, { peak: -15, mono: true, wet: 0.15 }, function (n) { n('marimba', 'E5', 0, 0.12, 0.6); n('marimba', 'A5', 0.055, 0.14, 0.7); }); },
  coin: function () { return fx(0.9, { peak: -11, mono: true, wet: 0.25 }, function (n) { n('glockenspiel', 'B6', 0, 0.3, 0.7); n('glockenspiel', 'E7', 0.07, 0.4, 0.8); }); },
  buy: function () { return fx(0.9, { peak: -11, mono: true, wet: 0.2 }, function (n) { n('marimba', ['C4', 'G4'], 0, 0.2, 0.8, -20); n('glockenspiel', 'G6', 0.05, 0.3, 0.5, -26); }); },
  error: function () { return fx(0.5, { peak: -15, mono: true, wet: 0 }, function (n) { n('marimba', 'D3', 0, 0.14, 0.8, -20); n('woodblock', 'C4', 0, 0.06, 0.5, -24); }); },
  research: function () {
    return fx(2.2, { peak: -9, wet: 0.7, room: 0.6 }, function (n) { seq(n, 'orchestral_harp', ['C5', 'E5', 'G5', 'C6', 'E6'], 0, 0.055, 0.8, 0.8, -20); n('celesta', 'G6', 0.3, 0.6, 0.6, -24); });
  },
  perk: function () { return fx(2, { peak: -10, wet: 0.7, room: 0.6 }, function (n) { seq(n, 'music_box', ['A5', 'C#6', 'E6', 'A6'], 0, 0.07, 0.8, 0.8); }); },
  doctrine: function () {
    return fx(3.4, { peak: -8, wet: 1, room: 0.8 }, function (n) {
      n('tubular_bells', 'G4', 0, 1.6, 0.8, -20); n('timpani', 'C3', 0, 0.8, 0.6, -24);
      n('choir_aahs', ['C4', 'G4', 'C5'], 0.05, 1.3, 0.7, -24, { atk: 0.15 });
    });
  },
  edict: function () {
    return fx(2.2, { peak: -9, wet: 0.8, room: 0.6 }, function (n) {
      seq(n, 'trumpet', ['G4', 'C5', 'E5'], 0, 0.13, 0.1, 0.8, -20); n('trumpet', 'G5', 0.39, 0.5, 0.85, -20);
      n('brass_section', ['C4', 'E4', 'G4'], 0.39, 0.5, 0.6, -25);
    });
  },
  stage: function () {
    return fx(3.2, { peak: -7, wet: 0.9, room: 0.7 }, function (n) {
      n('timpani', 'G2', 0, 0.5, 0.7, -21); n('timpani', 'C3', 0.16, 0.9, 0.85, -21);
      n('tubular_bells', 'C5', 0.16, 1.4, 0.8, -22); n('brass_section', ['C4', 'E4', 'G4', 'C5'], 0.16, 0.9, 0.7, -23);
    });
  },
  recruit: function () {
    return fx(2.2, { peak: -9, wet: 0.8, room: 0.6 }, function (n) { n('french_horn', 'C4', 0, 0.2, 0.8, -20); n('french_horn', 'G4', 0.22, 0.6, 0.85, -20); n('taiko_drum', 'C3', 0, 0.4, 0.5, -26); });
  },
  equip: function () {
    return fx(1, { peak: -11, wet: 0.3 }, function (n) { n('woodblock', 'C4', 0, 0.06, 0.6, -24); n('glockenspiel', ['A6', 'E7'], 0.01, 0.3, 0.7, -21); n('glockenspiel', 'A7', 0.09, 0.25, 0.4, -27); });
  },
  send: function () {
    return fx(2, { peak: -9, wet: 0.7, room: 0.6 }, function (n) {
      n('taiko_drum', 'C3', 0, 0.3, 0.6, -21); n('taiko_drum', 'C3', 0.16, 0.3, 0.6, -21); n('taiko_drum', 'G3', 0.32, 0.5, 0.85, -21);
      n('french_horn', 'G3', 0.32, 0.45, 0.6, -24);
    });
  },
  victory: function () {
    return fx(3, { peak: -7, wet: 0.9, room: 0.7 }, function (n) {
      seq(n, 'trumpet', ['G4', 'C5', 'E5'], 0, 0.13, 0.11, 0.8, -21); n('trumpet', 'G5', 0.39, 0.9, 0.8, -21);
      n('brass_section', ['C4', 'G4', 'C5', 'E5'], 0.39, 0.9, 0.8, -22); n('timpani', 'C3', 0.39, 0.8, 0.8, -23);
      seq(n, 'glockenspiel', ['C7', 'E7', 'G7'], 0.42, 0.08, 0.4, 0.5, -28);
    });
  },
  defeat: function () {
    return fx(3, { peak: -9, wet: 0.9, room: 0.7 }, function (n) {
      n('trombone', 'Eb3', 0, 0.32, 0.75, -20); n('trombone', 'D3', 0.34, 0.32, 0.7, -20); n('trombone', 'C3', 0.68, 0.9, 0.7, -20);
      n('cello', 'C2', 0.68, 0.9, 0.7, -23); n('timpani', 'C2', 0.68, 0.8, 0.5, -25);
    });
  },
  draw: function () { return fx(1.4, { peak: -12, wet: 0.5 }, function (n) { n('pizzicato_strings', 'G3', 0, 0.3, 0.75); n('pizzicato_strings', 'D3', 0.2, 0.35, 0.7); }); },
  relic: function () {
    return fx(4, { peak: -8, wet: 1.1, room: 0.85 }, function (n) {
      n('choir_aahs', ['D4', 'A4', 'D5', 'F#5'], 0, 1.6, 0.7, -23, { atk: 0.2 });
      seq(n, 'orchestral_harp', ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'F#6', 'A6'], 0.1, 0.06, 0.9, function (i) { return 0.55 + 0.04 * i; }, -21);
      n('glockenspiel', 'D7', 0.62, 0.5, 0.6, -26); n('glockenspiel', 'F#7', 0.72, 0.5, 0.6, -26);
    });
  },
  collect: function () {
    return fx(1.8, { peak: -10, wet: 0.4 }, function (n) {
      n('marimba', 'E4', 0, 0.2, 0.7, -23);
      [['E6', 0], ['G6', 0.07], ['B6', 0.14], ['E7', 0.21], ['G6', 0.3], ['B6', 0.36], ['E7', 0.43], ['B7', 0.52]].forEach(function (c, i) { n('glockenspiel', c[0], c[1], 0.3, 0.6 + 0.03 * i, -21, { pan: i % 2 ? 0.3 : -0.3 }); });
    });
  },
  ageup: function () {
    return fx(6.2, { peak: -6, wet: 1.1, room: 0.85 }, function (n) {
      for (let i = 0; i < 10; i++) n('timpani', 'C3', i * 0.07, 0.2, 0.25 + 0.06 * i, -22);
      n('brass_section', ['F3', 'A3', 'C4', 'F4'], 0.75, 0.48, 0.75, -21); n('brass_section', ['G3', 'B3', 'D4', 'G4'], 1.3, 0.48, 0.8, -21);
      n('brass_section', ['C4', 'E4', 'G4', 'C5'], 1.85, 1.8, 0.85, -21); n('trumpet', 'F4', 0.75, 0.46, 0.75, -23); n('trumpet', 'G4', 1.3, 0.46, 0.8, -23); n('trumpet', ['C5', 'E5', 'G5'], 1.85, 1.8, 0.8, -23);
      n('timpani', 'G2', 0.75, 0.4, 0.7, -22); n('timpani', 'G2', 1.3, 0.4, 0.75, -22); n('timpani', 'C3', 1.85, 1.2, 0.9, -22);
      n('choir_aahs', ['C4', 'G4', 'E5'], 1.85, 1.9, 0.7, -25, { atk: 0.1 });
      seq(n, 'tubular_bells', ['C5', 'G5', 'C6'], 1.85, 0.35, 1.2, 0.8, -24);
      seq(n, 'glockenspiel', ['C6', 'E6', 'G6', 'C7', 'E7', 'G7'], 1.9, 0.09, 0.5, 0.55, -28);
    });
  },
  depart: function () {
    return fx(8, { peak: -6, wet: 1.2, room: 0.9 }, function (n) {
      for (let i = 0; i < 46; i++) n('timpani', i % 2 ? 'G2' : 'C2', i * 0.09, 0.25, 0.15 + 0.014 * i, -22);
      seq(n, 'pad_7_halo', ['D3', 'A3', 'D4', 'A4', 'D5'], 0, 0.9, 2.1, 0.75, -24, { atk: 0.5 });
      n('reverse_cymbal', 'C4', 2.5, 1.9, 0.8, -23);
      n('taiko_drum', 'C3', 4.15, 0.8, 0.95, -19); n('timpani', 'C2', 4.15, 1.2, 0.9, -21);
      n('choir_aahs', ['D4', 'A4', 'F#5'], 4.15, 1.6, 0.75, -23, { atk: 0.1 }); n('pad_7_halo', ['D5', 'A5'], 4.15, 1.8, 0.7, -25);
    });
  }
};
