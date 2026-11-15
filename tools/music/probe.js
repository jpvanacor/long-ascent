// prints the loudness envelope of a few samples (RMS per 100 ms), to see attack, sustain and tail
const { execFileSync } = require('child_process');
const SF = process.env.SOUNDFONT;
function load(inst, note) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', `${SF}/${inst}-mp3/${note}.mp3`, '-f', 'f32le', '-ac', '2', '-ar', '44100', 'pipe:1'], { maxBuffer: 1 << 26 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}
for (const [inst, note] of process.argv.slice(2).map((a) => a.split(':'))) {
  const d = load(inst, note), n = d.length / 2, win = 4410; let peak = 0, first = -1; const env = [];
  for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(d[2 * i]), Math.abs(d[2 * i + 1])); if (a > peak) peak = a; }
  for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(d[2 * i]), Math.abs(d[2 * i + 1])); if (first < 0 && a > peak * 0.02) first = i; }
  for (let w = 0; w + win <= n; w += win) { let s = 0; for (let i = w; i < w + win; i++) s += d[2 * i] * d[2 * i] + d[2 * i + 1] * d[2 * i + 1]; env.push(Math.sqrt(s / win / 2)); }
  const mx = Math.max(...env);
  console.log((inst + ':' + note).padEnd(28), 'peak', peak.toFixed(3), 'onset', (first / 44.1).toFixed(1) + 'ms', 'len', (n / 44100).toFixed(2), env.map((e) => Math.round(9 * e / mx)).join(''));
}
