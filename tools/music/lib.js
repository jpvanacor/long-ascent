/* Long Ascent: a small offline renderer for the game's music and sound effects.
   Notes are played from the FluidR3_GM instrument samples (one mp3 per key, from gleitz/midi-js-soundfonts),
   mixed in stems, sent through a plain Freeverb, and written out with ffmpeg.
   Set SOUNDFONT to the FluidR3_GM folder of that repository. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync, spawnSync } = require('child_process');
const SR = 44100;
const SF = process.env.SOUNDFONT;
if (!SF || !fs.existsSync(SF)) throw new Error('Set SOUNDFONT to the FluidR3_GM folder of a checkout of https://github.com/gleitz/midi-js-soundfonts');
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'], STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/* 'F#4' or 'Bb3' -> midi number */
function midi(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (+m[3] + 1) + STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
function rng(seed) { let a = seed | 0; return function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const cache = {};
function sample(inst, m) {
  const key = inst + ':' + m;
  if (cache[key]) return cache[key];
  if (m < 21 || m > 108) throw new Error('out of range ' + key);
  const file = path.join(SF, inst + '-mp3', NAMES[m % 12] + (Math.floor(m / 12) - 1) + '.mp3');
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SR), 'pipe:1'], { maxBuffer: 1 << 26 });
  const d = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  const n = d.length >> 1; let peak = 0, first = 0;
  for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(d[2 * i]), Math.abs(d[2 * i + 1])); if (a > peak) peak = a; }
  for (let i = 0; i < n; i++) { if (Math.max(Math.abs(d[2 * i]), Math.abs(d[2 * i + 1])) > peak * 0.02) { first = Math.max(0, i - 48); break; } }
  const len = n - first, l = new Float32Array(len), r = new Float32Array(len);
  for (let i = 0; i < len; i++) { l[i] = d[2 * (i + first)]; r[i] = d[2 * (i + first) + 1]; }
  return (cache[key] = { l: l, r: r, n: len, peak: peak });
}

/* instruments that hold their tone for the whole sample, and so can be looped for long notes */
const SUSTAINED = { cello: 1, recorder: 1, flute: 1, viola: 1, string_ensemble_1: 1, clarinet: 1, oboe: 1, contrabass: 1, pad_2_warm: 1, pad_7_halo: 1, pad_1_new_age: 1, pad_4_choir: 1,
  french_horn: 1, trumpet: 1, trombone: 1, brass_section: 1, choir_aahs: 1, voice_oohs: 1 };
const RELEASE = { cello: 0.22, recorder: 0.09, flute: 0.12, viola: 0.2, string_ensemble_1: 0.45, clarinet: 0.1, oboe: 0.1, contrabass: 0.25, pad_2_warm: 0.9, pad_7_halo: 0.9, pad_1_new_age: 0.9, pad_4_choir: 0.8,
  french_horn: 0.16, trumpet: 0.1, trombone: 0.14, brass_section: 0.16, choir_aahs: 0.5, voice_oohs: 0.5, acoustic_guitar_nylon: 0.25, harpsichord: 0.12, acoustic_grand_piano: 0.3, electric_piano_1: 0.3,
  acoustic_bass: 0.18, vibraphone: 0.5, orchestral_harp: 0.6, pizzicato_strings: 0.3 };

class Stem {
  constructor(seconds, opt) {
    this.n = Math.ceil(seconds * SR); this.L = new Float32Array(this.n); this.R = new Float32Array(this.n);
    this.level = opt.level; this.send = opt.send === undefined ? 0.25 : opt.send; this.pan = opt.pan || 0; this.name = opt.name || ''; this.events = [];
  }
  /* one sample segment: from sample offset off, lasting len samples, with fade-in fi and fade-out fo (samples) */
  seg(s, start, off, len, g, fi, fo, power) {
    const pl = Math.cos((this.pan + 1) * Math.PI / 4) * Math.SQRT2 * g, pr = Math.sin((this.pan + 1) * Math.PI / 4) * Math.SQRT2 * g;
    const tail = Math.min(len, s.n - off), edge = Math.min(1323, tail);       // never run off the end of a sample with a click
    for (let i = 0; i < tail; i++) {
      const j = start + i; if (j < 0) continue; if (j >= this.n) break;
      let e = 1;
      if (i < fi) { const x = i / fi; e = power ? Math.sin(x * Math.PI / 2) : x; }
      if (i >= len - fo) { const x = Math.max(0, (len - i) / fo); e *= power ? Math.sin(x * Math.PI / 2) : x * x; }
      if (i >= tail - edge && tail < len) e *= (tail - i) / edge;
      this.L[j] += s.l[off + i] * pl * e; this.R[j] += s.r[off + i] * pr * e;
    }
  }
  /* play a note. t and dur in seconds; o: vel (0..1), rel (release seconds), atk */
  note(inst, m, t, dur, o) {
    o = o || {};
    this.events.push({ m: midi(m), t: t, d: dur });
    const s = sample(inst, midi(m)), g = (o.vel === undefined ? 0.8 : o.vel) * 0.1 / s.peak, start = Math.round(t * SR);
    const rel = Math.round((o.rel === undefined ? (RELEASE[inst] || 0.2) : o.rel) * SR), atk = Math.round((o.atk || 0.003) * SR), hold = Math.max(1, Math.round(dur * SR));
    if (hold + rel <= s.n - 2000 || !SUSTAINED[inst]) { this.seg(s, start, 0, hold + rel, g, atk, rel, false); return; }
    // a long note on a sustained instrument: play the start once, then loop the steady part with equal-power crossfades
    const xf = Math.round(0.5 * SR), skip = Math.round(0.55 * SR), body = s.n - 2000 - skip;      // the loopable stretch of the sample
    let pos = 0, first = true;
    while (pos < hold + rel) {
      const left = hold + rel - pos, room = first ? s.n - 2000 : body, last = left <= room, len = last ? left : room;
      this.seg(s, start + pos, first ? 0 : skip, len, g, first ? atk : xf, last ? rel : xf, !last || !first ? true : false);
      pos += len - xf; first = false;
      if (last) break;
    }
  }
  rms() { let s = 0, c = 0; for (let i = 0; i < this.n; i++) { const e = this.L[i] * this.L[i] + this.R[i] * this.R[i]; if (e > 1e-7) { s += e; c++; } } return c ? Math.sqrt(s / c / 2) : 0; }
}

/* Freeverb (Jezar): eight damped combs and four allpasses per side */
function reverb(inL, inR, o) {
  o = o || {};
  const n = inL.length, outL = new Float32Array(n), outR = new Float32Array(n);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], alls = [556, 441, 341, 225], spread = 23;
  const fb = (o.room === undefined ? 0.8 : o.room) * 0.28 + 0.7, damp = (o.damp === undefined ? 0.4 : o.damp) * 0.4, gain = 0.015;
  for (let ch = 0; ch < 2; ch++) {
    const out = ch ? outR : outL, add = ch ? spread : 0;
    const cb = combs.map(function (len) { return { buf: new Float32Array(len + add), i: 0, st: 0 }; });
    const ab = alls.map(function (len) { return { buf: new Float32Array(len + add), i: 0 }; });
    for (let k = 0; k < n; k++) {
      const x = (inL[k] + inR[k]) * gain; let y = 0;
      for (let c = 0; c < 8; c++) { const q = cb[c], v = q.buf[q.i]; q.st = v * (1 - damp) + q.st * damp; q.buf[q.i] = x + q.st * fb; if (++q.i >= q.buf.length) q.i = 0; y += v; }
      for (let a = 0; a < 4; a++) { const q = ab[a], v = q.buf[q.i], w = -y + v; q.buf[q.i] = y + v * 0.5; if (++q.i >= q.buf.length) q.i = 0; y = w; }
      out[k] = y;
    }
  }
  return [outL, outR];
}

class Mix {
  constructor(seconds, opt) { this.seconds = seconds; this.stems = []; this.opt = opt || {}; }
  stem(o) { const s = new Stem(this.seconds, o); this.stems.push(s); return s; }
  /* balance the stems to their target levels (dB, RMS over the sounding parts), add reverb, return [L, R] */
  render() {
    const n = Math.ceil(this.seconds * SR), L = new Float32Array(n), R = new Float32Array(n), sL = new Float32Array(n), sR = new Float32Array(n), report = [];
    for (const st of this.stems) {
      const r = st.rms(); if (!r) { report.push(st.name + ' (silent)'); continue; }
      const g = Math.pow(10, st.level / 20) / r;
      for (let i = 0; i < n; i++) { const a = st.L[i] * g, b = st.R[i] * g; L[i] += a; R[i] += b; sL[i] += a * st.send; sR[i] += b * st.send; }
      report.push(st.name + ' ' + st.level + 'dB');
    }
    const wet = reverb(sL, sR, this.opt.reverb), w = this.opt.wet === undefined ? 1 : this.opt.wet;
    for (let i = 0; i < n; i++) { L[i] += wet[0][i] * w; R[i] += wet[1][i] * w; }
    if (this.opt.fadeOut) { const f = Math.round(this.opt.fadeOut * SR); for (let i = 0; i < f; i++) { const e = i / f, k = n - 1 - i; L[k] *= e; R[k] *= e; } }
    this.report = report.join(', ');
    return [L, R];
  }
}

/* cut the silence after the last sound, with a short fade so nothing clicks */
function trim(L, R, floorDb) {
  let peak = 0, last = 0; const n = L.length;
  for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; }
  const floor = peak * Math.pow(10, (floorDb || -52) / 20);
  for (let i = n - 1; i >= 0; i--) if (Math.max(Math.abs(L[i]), Math.abs(R[i])) > floor) { last = i; break; }
  const end = Math.min(n, last + Math.round(0.03 * SR)), f = Math.min(end, Math.round(0.03 * SR)), l = L.slice(0, end), r = R.slice(0, end);
  for (let i = 0; i < f; i++) { const e = i / f; l[end - 1 - i] *= e; r[end - 1 - i] *= e; }
  return [l, r];
}
function writeWav(file, L, R) {
  const n = L.length, b = Buffer.alloc(44 + n * 8);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 8, 28); b.writeUInt16LE(8, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) { b.writeFloatLE(L[i], 44 + i * 8); b.writeFloatLE(R[i], 48 + i * 8); }
  fs.writeFileSync(file, b);
}
function stats(L, R) {
  let peak = 0, s = 0; const n = L.length;
  for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; s += L[i] * L[i] + R[i] * R[i]; }
  return { peak: peak, rms: Math.sqrt(s / n / 2), seconds: n / SR };
}
function loudness(wav) {       // integrated loudness (LUFS) and true peak (dBTP), measured by ffmpeg
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const tail = r.stderr.slice(r.stderr.lastIndexOf('Summary:')), i = /I:\s+(-?[\d.]+) LUFS/.exec(tail), p = /Peak:\s+(-?[\d.]+) dBFS/.exec(tail);
  return { I: i ? +i[1] : NaN, TP: p ? +p[1] : NaN };
}
/* write an mp3. o: lufs (target loudness) or peak (target peak, dBFS), mono, q (lame quality), trim (cut silence at the end) */
function encode(L, R, out, o) {
  o = o || {};
  const tmp = path.join(os.tmpdir(), 'la-' + process.pid + '-' + path.basename(out) + '.wav');
  writeWav(tmp, L, R);
  let gain;
  const st = stats(L, R), lu = loudness(tmp);
  if (o.lufs !== undefined && isFinite(lu.I)) gain = Math.min(o.lufs - lu.I, (o.ceiling === undefined ? -1.5 : o.ceiling) - lu.TP);
  else gain = (o.peak === undefined ? -3 : o.peak) - 20 * Math.log10(st.peak || 1);
  const af = ['volume=' + gain.toFixed(2) + 'dB'];
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-af', af.join(','), '-ac', o.mono ? '1' : '2', '-c:a', 'libmp3lame', '-q:a', String(o.q === undefined ? 5 : o.q), '-map_metadata', '-1', '-id3v2_version', '0', '-write_xing', '1', out]);
  fs.unlinkSync(tmp);
  const after = loudness(out);
  return { file: path.basename(out), seconds: st.seconds, gain: gain, I: after.I, TP: after.TP, kb: Math.round(fs.statSync(out).size / 1024) };
}
/* a picture of the sound, to check by eye what cannot be checked by ear here */
function picture(mp3, png) { execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp3, '-lavfi', 'showspectrumpic=s=1400x420:legend=0:scale=log:fscale=log:start=60:stop=12000', png]); }

module.exports = { SR, midi, rng, sample, Stem, Mix, reverb, trim, writeWav, stats, loudness, encode, picture };
