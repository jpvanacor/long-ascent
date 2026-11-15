/* Touches the city view the way a player would and checks what happens: node tools/citytest.js
   Needs Playwright and Chrome (PLAYWRIGHT, CHROME). */
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const root = path.join(__dirname, '..'), snaps = JSON.parse(fs.readFileSync(path.join(__dirname, 'snaps.json'), 'utf8'));
const PORT = 8139, wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await wait(500);
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [], out = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (name, cond, extra) => { const line = (cond ? 'ok   ' : 'FAIL ') + name + (extra !== undefined ? ' (' + extra + ')' : ''); out.push(line); console.log(line); if (!cond) errs.push('check failed: ' + name); };
  const snap = snaps.a1_mid;
  await p.clock.install({ time: new Date(snap.t + 36e3) });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html');
  await p.waitForFunction(() => window.__la && document.fonts.status === 'loaded');
  await p.evaluate((st) => { window.__la.scene.hour = 11; document.getElementById('turn').classList.remove('on'); st.seen = { council: 1, age: 1, edicts: 1, party2: 1 }; window.__la.set(st); }, snap.s);
  const tick = async (ms) => { await p.clock.runFor(ms || 400); await wait(60); };
  const cityOn = () => p.evaluate(() => document.documentElement.classList.contains('city'));
  const sheetOn = () => p.evaluate(() => !document.getElementById('modal').hidden);
  const cam = () => p.evaluate(() => window.__la.scene.camera());
  const at = (id) => p.evaluate((i) => { const w = window.__la.scene.where(i), r = document.getElementById('scene').getBoundingClientRect(); return w ? { x: r.left + w.x, y: r.top + w.y } : null; }, id);
  const back = async () => { await p.evaluate(() => history.back()); await wait(250); await tick(); };
  await tick(600);

  // the strip: the counters do not open the city, the picture does
  await p.locator('#col-gold').tap(); await tick();
  ok('a tap on a counter leaves the strip as it is', !(await cityOn()));
  await p.touchscreen.tap(200, 150); await tick();
  ok('a tap on the picture opens the city', await cityOn());
  ok('the first visit explains how to move', await p.locator('#cityhint').count() === 1);
  const c0 = await cam();
  ok('the view opens on the town at the usual distance', Math.abs(c0.z - c0.home) < 0.01 && c0.x > 115 && c0.x < 165, 'z ' + c0.z.toFixed(2) + ', x ' + c0.x.toFixed(0));
  await p.screenshot({ path: path.join(root, 'shots', 'i01-city-open.png') });

  // one finger moves the view
  await p.mouse.move(300, 600); await p.mouse.down(); await p.mouse.move(250, 600, { steps: 4 }); await p.mouse.move(120, 600, { steps: 6 }); await p.mouse.up(); await tick();
  const c1 = await cam();
  ok('dragging left moves the view right', c1.x > c0.x + 20, (c1.x - c0.x).toFixed(1) + ' units');
  ok('a drag does not open anything', !(await sheetOn()));

  // two fingers bring it closer
  await p.evaluate(() => {
    const cv = document.getElementById('scene'), ev = (type, id, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    ev('pointerdown', 11, 150, 600); ev('pointerdown', 12, 240, 600);
    for (let i = 1; i <= 6; i++) { ev('pointermove', 11, 150 - i * 10, 600); ev('pointermove', 12, 240 + i * 10, 600); }
    ev('pointerup', 11, 90, 600); ev('pointerup', 12, 300, 600);
  });
  await tick();
  const c2 = await cam();
  ok('spreading two fingers comes closer', c2.z > c1.z * 1.3, 'z ' + c1.z.toFixed(2) + ' -> ' + c2.z.toFixed(2));
  await p.locator('#cityzoom').tap(); await tick();
  const c3 = await cam();
  ok('the zoom button steps to the widest view', Math.abs(c3.z - c3.min) < 0.01, 'z ' + c3.z.toFixed(2));
  await p.locator('#cityzoom').tap(); await tick();
  const c4 = await cam();
  ok('and then back to the usual one', Math.abs(c4.z - c4.home) < 0.01);
  await p.touchscreen.tap(200, 300); await wait(120); await p.touchscreen.tap(200, 300); await tick();
  const c5 = await cam();
  ok('a double tap on open sky comes closer', c5.z > c4.z * 1.5, 'z ' + c5.z.toFixed(2));
  await p.locator('#cityzoom').tap(); await tick(); await p.locator('#cityzoom').tap(); await tick();       // widest, then usual

  // the great work: tap it, the card opens over the city, Back closes only the card
  await p.evaluate(() => window.__la.scene.look('work:1')); await tick();
  let pt = await at('work:1');
  await p.touchscreen.tap(pt.x, pt.y); await tick();
  ok('a tap on the cathedral opens its card', await sheetOn() && await p.locator('#sheet [data-act="build"]').count() === 1);
  await p.screenshot({ path: path.join(root, 'shots', 'i02-city-project.png') });
  await back();
  ok('Back closes the card and keeps the city', !(await sheetOn()) && await cityOn());

  // a building: buy from the city
  await p.evaluate(() => { const s = window.__la.state; s.res.gold = 5e7; window.__la.scene.look('b:farm'); }); await tick();
  pt = await at('b:farm');
  const before = await p.evaluate(() => window.__la.state.b.farm);
  await p.touchscreen.tap(pt.x, pt.y); await tick();
  ok('a tap on the fields opens the farmstead card', await sheetOn() && await p.locator('#sheet [data-act="buy:farm"]').count() === 1, JSON.stringify(pt) + ' picked ' + await p.evaluate(([x, y]) => { const r = document.getElementById('scene').getBoundingClientRect(); return window.__la.scene.pick(x - r.left, y - r.top) + ' | sheet: ' + document.getElementById('sheet').textContent.slice(0, 60); }, [pt.x, pt.y]));
  await p.locator('#sheet [data-act="buy:farm"]').tap(); await tick(200);
  const after = await p.evaluate(() => window.__la.state.b.farm);
  ok('buying there adds a farmstead', after === before + 1, before + ' -> ' + after);
  await p.screenshot({ path: path.join(root, 'shots', 'i03-city-buy.png') });
  await p.locator('#sheet .btn.alt.big').last().tap(); await tick();
  ok('Close puts the card away and keeps the city', !(await sheetOn()) && await cityOn());
  await p.clock.runFor(500); await p.screenshot({ path: path.join(root, 'shots', 'i04-city-built.png') });

  // the list of what is going on
  const feed = await p.evaluate(() => Array.from(document.querySelectorAll('#feed .tag')).map((t) => t.dataset.feed + ': ' + t.textContent));
  ok('the list names the great work and the party', feed.some((f) => /^work:1/.test(f)) && feed.some((f) => /^keep/.test(f)), feed.join(' | '));
  await p.locator('#feed .tag[data-feed="keep"]').first().tap(); await tick();
  ok('its line about the party opens the heroes card', await sheetOn() && await p.locator('#sheet .track').count() >= 1);
  await p.locator('#sheet .btn.big').first().tap(); await tick();
  ok('"To the heroes" leaves the city for that tab', !(await cityOn()) && !(await sheetOn()) && await p.evaluate(() => document.querySelector('#tabs button.on').dataset.tab) === 'heroes');

  // a card over the city: Back twice closes the card, then the city; the Android app asks the same of goBack
  await p.evaluate(() => window.__la.go('realm')); await tick();
  await p.locator('#expand').tap(); await tick();
  await p.locator('#feed .tag[data-feed="work:1"]').tap(); await tick();
  ok('a card opens over the city again', await sheetOn() && await cityOn());
  await back();
  const mid = [await sheetOn(), await cityOn()];
  await back();
  ok('Back, Back: first the card, then the city', !mid[0] && mid[1] && !(await sheetOn()) && !(await cityOn()));
  await p.locator('#expand').tap(); await tick();
  await p.locator('#feed .tag[data-feed="work:1"]').tap(); await tick();
  const b1 = await p.evaluate(() => window.__back()), s1 = [await sheetOn(), await cityOn()];
  await wait(200); await tick();
  const b2 = await p.evaluate(() => window.__back()), s2 = [await sheetOn(), await cityOn()];
  await wait(200); await tick();
  const b3 = await p.evaluate(() => window.__back());
  ok('the Android Back hook closes the card, then the city, then reports nothing left', b1 === true && !s1[0] && s1[1] && b2 === true && !s2[1] && b3 === false);
  await p.locator('#menu').tap(); await tick(); await back();
  ok('the history steps are still in order afterwards', !(await sheetOn()) && await p.evaluate(() => document.location.pathname.endsWith('index.html')));

  // Back closes the city; the close button too
  await p.evaluate(() => window.__la.go('realm')); await tick();
  await p.locator('#expand').tap(); await tick();
  ok('the corner button opens the city', await cityOn());
  await back();
  ok('Back closes the city', !(await cityOn()));
  await p.locator('#expand').tap(); await tick();
  await p.locator('#cityclose').tap(); await tick(); await wait(200);
  ok('the close button closes it', !(await cityOn()));
  await p.locator('#menu').tap(); await tick();
  ok('sheets still open afterwards', await sheetOn());
  await back();
  ok('and Back still closes them', !(await sheetOn()));

  // a stage of the great work is built from the city: the card steps aside
  await p.evaluate(() => { const s = window.__la.state; s.res.gold = 1e12; s.res.mat = 1e12; s.res.kn = 1e12; }); await tick();
  await p.locator('#expand').tap(); await tick();
  await p.evaluate(() => window.__la.scene.look('work:1')); await tick();
  const call = await p.locator('#feed .tag.go[data-feed="work:1"]').count();
  ok('the list calls out a stage that can be built', call === 1);
  await p.locator('#feed .tag[data-feed="work:1"]').tap(); await tick();
  await p.locator('#sheet [data-act="build"]').tap(); await tick(300);
  ok('building closes the card for the celebration', !(await sheetOn()) && await cityOn());
  await p.clock.runFor(1500); await p.screenshot({ path: path.join(root, 'shots', 'i05-city-stage.png') });

  await b.close(); srv.kill();
  console.log(errs.length ? 'PROBLEMS\n' + errs.join('\n') : 'all ' + out.length + ' checks passed, no page errors');
  process.exit(errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
