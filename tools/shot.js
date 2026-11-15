/* Phone-sized screenshots of the game in several states. Usage: node tools/shot.js [filter] [width]
   Needs Playwright and Chrome; the paths can be set with PLAYWRIGHT and CHROME. */
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const root = path.join(__dirname, '..'), snaps = JSON.parse(fs.readFileSync(path.join(__dirname, 'snaps.json'), 'utf8'));
const H = 3600e3, filter = process.argv[2] || '', WIDTH = +process.argv[3] || 390, PORT = 8131;
const close = async (p) => { for (let i = 0; i < 3; i++) { if (await p.locator('#modal').isHidden()) break; const c = p.locator('#sheet .btn.big'); await c.last().click({ timeout: 3000 }); await p.waitForTimeout(120); } };
const tab = (name) => async (p) => { await close(p); await p.evaluate((n) => window.__la.go(n), name); };
const stay = async () => {};
const then = (...fs) => async (p) => { for (const f of fs) { await f(p); await p.waitForTimeout(250); } };
const tap = (sel) => async (p) => { await p.locator(sel).first().click({ timeout: 3000 }); };
// name, snapshot (null = new game), hours after the snapshot, steps, optional height
const shots = [
  ['01-title', null, 0, null],
  ['02-new-realm', null, 0, tap('#turn')],
  ['03-a1-realm', 'a1_first', 0.001, tab('realm')],
  ['04-a1-tree', 'a1_first', 0.001, tab('tree')],
  ['05-a1-tech-sheet', 'a1_first', 0.001, then(tab('tree'), tap('.node.open'))],
  ['06-a1-heroes', 'a1_first', 0.001, tab('heroes')],
  ['07-a1-away', 'a1_mid', 7.5, null],
  ['08-a1-heroes-report', 'a1_mid', 7.5, tab('heroes')],
  ['09-a1-age', 'a1_mid', 7.5, tab('age')],
  ['10-a2-realm', 'a2', 0.5, tab('realm')],
  ['11-a2-tree', 'a2', 0.5, tab('tree')],
  ['12-a2-doctrine', 'a2', 0.5, then(tab('tree'), tap('.node.fork'))],
  ['13-a2-edicts', 'a2', 0.5, then(tab('realm'), tap('[data-act="edict"]'))],
  ['14-a3-realm', 'a3', 0.2, tab('realm')],
  ['15-a3-heroes', 'a3', 4, tab('heroes')],
  ['16-a4-realm', 'a4', 0.2, tab('realm')],
  ['17-a4-tree', 'a4', 0.2, tab('tree')],
  ['18-a5-realm', 'a5', 0.2, tab('realm')],
  ['19-a5-heroes', 'a5', 9.5, tab('heroes')],
  ['20-a5-legacy', 'a5_end', 0.01, tab('legacy')],
  ['21-menu', 'a2', 0.5, then(tab('realm'), tap('#menu'))],
  ['22-hero-sheet', 'a3', 0.2, then(tab('heroes'), tap('.card .face.lg'))],
  ['30-tall-a1-heroes', 'a1_mid', 7.5, tab('heroes'), 2600],
  ['31-tall-a3-tree', 'a3', 0.2, tab('tree'), 2100],
  ['32-tall-a3-realm', 'a3', 0.2, then(tab('realm'), tap('#panel .btn.alt')), 2300],
  ['33-tall-a5-heroes', 'a5', 9.5, tab('heroes'), 3400],
  ['34-tall-a4-age', 'a4', 0.2, tab('age'), 2000],
  ['35-tall-a5-legacy', 'a5_end', 0.01, tab('legacy'), 1700]
].filter((s) => !filter || s[0].indexOf(filter) >= 0);
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const errs = [];
  fs.mkdirSync(path.join(root, 'shots'), { recursive: true });
  for (const sh of shots) {
    const ctx = await b.newContext({ viewport: { width: WIDTH, height: sh[4] || 780 }, deviceScaleFactor: sh[4] ? 1.5 : 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(sh[0] + ': ' + e)); p.on('console', (m) => { if (m.type() === 'error' && !/audio\/|\.mp3|manifest|icon-192|sw\.js/.test(m.text() + (m.location().url || ''))) errs.push(sh[0] + ': ' + m.text() + ' ' + (m.location().url || '')); });
    const snap = sh[1] ? snaps[sh[1]] : null, t = snap ? snap.t + sh[2] * H : Date.UTC(2026, 10, 15, 11, 0, 0);
    await p.clock.setFixedTime(new Date(t));
    await p.goto('http://127.0.0.1:' + PORT + '/index.html');
    await p.waitForFunction(() => window.__la && document.fonts.status === 'loaded');
    if (snap) await p.evaluate((st) => { st.seen = { council: 1, age: 1, edicts: 1, party2: 1 }; document.getElementById('turn').classList.remove('on'); window.__la.set(st); }, snap.s);
    await p.waitForTimeout(350);
    try { if (sh[3]) await sh[3](p); } catch (e) { errs.push(sh[0] + ': step failed: ' + String(e).split('\n')[0]); }
    await p.waitForTimeout(450);
    if (sh[0] === '07-a1-away') {            // the amounts must have counted up to what was earned
      await p.waitForTimeout(1300);
      const shown = await p.evaluate(() => Array.from(document.querySelectorAll('#sheet .gains b')).map((b) => b.textContent));
      if (shown.length !== 3 || shown.some((v) => /^\+0(\.0+)?$/.test(v))) errs.push(sh[0] + ': away amounts read ' + JSON.stringify(shown));
      else console.log('away amounts shown: ' + shown.join(' '));
    }
    await p.screenshot({ path: path.join(root, 'shots', sh[0] + '.png') });
    await ctx.close();
  }
  await b.close(); srv.kill();
  console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no page errors, ' + shots.length + ' screenshots');
})();
