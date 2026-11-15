/* Pictures of the city view: node tools/city.js [filter]. Needs Playwright and Chrome (PLAYWRIGHT, CHROME).
   Each line: name, snapshot, hours after it, hour of day, zoom (0 = as opened, or pixels per unit), x of the left edge, extra steps. */
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const root = path.join(__dirname, '..'), snaps = JSON.parse(fs.readFileSync(path.join(__dirname, 'snaps.json'), 'utf8'));
const H = 3600e3, filter = process.argv[2] || '', PORT = 8137;
const shots = [
  ['c01-a1-new', null, 0, 10, 0, null],
  ['c02-a1-day', 'a1_first', 0.001, 10, 0, null],
  ['c03-a1-mid', 'a1_mid', 0.01, 15, 0, null],
  ['c04-a1-fields', 'a1_mid', 0.01, 15, 0, 20],
  ['c05-a1-forest', 'a1_mid', 0.01, 15, 0, 300],
  ['c06-a1-night', 'a1_mid', 0.01, 22, 0, null],
  ['c07-a1-close', 'a1_mid', 0.01, 11, 9, 150],
  ['c08-a1-whole', 'a1_mid', 0.01, 11, 1, 0],
  ['c10-a2-day', 'a2', 0.01, 9, 0, null],
  ['c11-a2-harbor', 'a2', 0.01, 9, 0, 40],
  ['c12-a3-day', 'a3', 0.01, 13, 0, null],
  ['c13-a3-works', 'a3', 0.01, 13, 0, 250],
  ['c14-a4-day', 'a4', 0.01, 17.6, 0, null],
  ['c15-a4-night', 'a4', 0.01, 23, 0, 220],
  ['c16-a5-day', 'a5', 0.01, 12, 0, null],
  ['c17-a5-port', 'a5', 0.01, 12, 0, 60],
  ['c18-a5-night', 'a5', 0.01, 21, 0, 200],
  ['t01-strip-a1', 'a1_mid', 0.01, 15, -1, null],
  ['t02-strip-a3', 'a3', 0.01, 13, -1, null],
  ['t03-strip-a5', 'a5', 0.01, 21, -1, null]
].filter((s) => !filter || s[0].indexOf(filter) >= 0);
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const errs = [];
  fs.mkdirSync(path.join(root, 'shots'), { recursive: true });
  for (const sh of shots) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(sh[0] + ': ' + e)); p.on('console', (m) => { if (m.type() === 'error' && !/audio\/|\.mp3|manifest|icon-192|sw\.js/.test(m.text() + (m.location().url || ''))) errs.push(sh[0] + ': ' + m.text()); });
    const snap = sh[1] ? snaps[sh[1]] : null, t = snap ? snap.t + sh[2] * H : Date.UTC(2026, 10, 15, 11, 0, 0);
    await p.clock.install({ time: new Date(t) });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html');
    await p.waitForFunction(() => window.__la && document.fonts.status === 'loaded');
    await p.evaluate(([st, hour]) => { window.__la.scene.hour = hour; document.getElementById('turn').classList.remove('on'); if (st) { st.seen = { council: 1, age: 1, edicts: 1, party2: 1, city: 1 }; window.__la.set(st); } else window.__la.state.seen.city = 1; }, [snap ? snap.s : null, sh[3]]);
    await p.clock.runFor(600);
    if (sh[4] >= 0) {
      await p.evaluate(() => window.__la.city());
      await p.clock.runFor(300);
      await p.evaluate(([z, x]) => { const sc = window.__la.scene, c = sc.camera(); if (z) sc.zoomTo(z === 1 ? c.min : z, 195, 600); if (x !== null) sc.pan(1e6, 0), sc.pan(-x * sc.camera().z, 0); }, [sh[4], sh[5]]);
    }
    await p.clock.runFor(700);
    await p.screenshot({ path: path.join(root, 'shots', sh[0] + '.png') });
    await ctx.close();
  }
  await b.close(); srv.kill();
  console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no page errors, ' + shots.length + ' pictures');
})();
