/* Renders the music and the sound effects into audio/. Usage: node tools/music/build.js [music|sfx|name...]
   Needs ffmpeg, and SOUNDFONT pointing at the FluidR3_GM folder of gleitz/midi-js-soundfonts. */
'use strict';
const path = require('path'), fs = require('fs');
const { encode, picture, stats, trim } = require('./lib.js');
const out = path.join(__dirname, '..', '..', 'audio'), pics = process.env.PICTURES;
const want = process.argv.slice(2), all = !want.length;
if (all || want.indexOf('music') >= 0 || want.some((w) => /^age/.test(w))) {
  for (const piece of require('./score.js').pieces) {
    const t0 = Date.now(), p = piece();
    if (!all && want.indexOf('music') < 0 && want.indexOf(p.name) < 0) continue;
    const [L, R] = p.mix.render(), cut = trim(L, R, -60), st = stats(cut[0], cut[1]);
    const r = encode(cut[0], cut[1], path.join(out, 'music', p.name + '.mp3'), { lufs: p.lufs, q: 5 });
    console.log(r.file.padEnd(12), r.seconds.toFixed(1) + 's', r.kb + 'KB', 'mix peak ' + st.peak.toFixed(2), 'gain ' + r.gain.toFixed(1) + 'dB', 'I ' + r.I + ' LUFS', 'TP ' + r.TP + ' dB', '(' + ((Date.now() - t0) / 1000).toFixed(1) + 's)  ' + p.mix.report);
    if (pics) fs.writeFileSync(path.join(pics, p.name + '.json'), JSON.stringify(p.mix.stems.map((s) => ({ name: s.name, events: s.events }))));
  }
}
if (all || want.indexOf('sfx') >= 0 || want.some((w) => !/^age|music|sfx/.test(w))) {
  const sfx = require('./sfx.js');
  for (const name in sfx) {
    if (!all && want.indexOf('sfx') < 0 && want.indexOf(name) < 0) continue;
    const e = sfx[name](), [L, R] = e.mix.render(), cut = trim(L, R, e.floor || -48);
    const r = encode(cut[0], cut[1], path.join(out, 'sfx', name + '.mp3'), { peak: e.peak, q: 6, mono: !!e.mono });
    console.log(r.file.padEnd(14), r.seconds.toFixed(2) + 's', r.kb + 'KB', 'peak ' + e.peak + ' dB', 'TP ' + r.TP);
    if (pics) fs.writeFileSync(path.join(pics, 'sfx-' + name + '.json'), JSON.stringify(e.mix.stems.map((s) => ({ name: s.name, events: s.events }))));
  }
}
