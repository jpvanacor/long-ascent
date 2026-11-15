/* A robot plays the game through its real buttons: a few check-ins a day, tapping whatever is offered.
   A smoke test of the whole interface, from the first tap to the departure of the Ark.
   Usage: node tools/bot.js   (needs Playwright and Chrome; the paths can be set with PLAYWRIGHT and CHROME) */
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path'), { spawn } = require('child_process');
const root = path.join(__dirname, '..'), PORT = 8132;
const GAPS = [1.25, 2.5, 3.5, 4, 9, 5, 6, 4];            // hours between check-ins: first day, then a daily rhythm
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text() + ' ' + (m.location().url || '')); });
  await p.clock.install({ time: new Date(Date.UTC(2026, 10, 15, 11, 0, 0)) });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html');
  await p.waitForFunction(() => window.__la);
  const tick = async (ms) => { await p.clock.runFor(ms || 600); };
  const clear = async () => {                             // dismiss overlays
    await p.evaluate(() => { const t = document.getElementById('turn'); if (t.classList.contains('on')) t.click(); });
    for (let i = 0; i < 4; i++) { const c = p.locator('#modal:not([hidden]) #sheet .btn.big'); if (await c.count()) { await c.last().click(); await tick(300); } else break; }
  };
  const seen = {};
  const shut = async () => {                              // a sheet opened by the last tap (a celebration, mostly): note which kind, then put it away as a player would
    if (!(await p.locator('#modal:not([hidden])').count())) return;
    const h = await p.evaluate(() => { const e = document.querySelector('#sheet h3'); return e ? e.textContent : '(no title)'; });
    seen[h] = (seen[h] || 0) + 1; await clear();
  };
  const tap = async (loc) => { await shut(); await loc.click(); };          // a tap on the panel under any sheet
  const tab = async (name) => {
    await shut();
    const t = p.locator('#tabs:not([hidden]) button[data-tab="' + name + '"]'); if (await t.count()) { await t.first().click(); await tick(300); return true; } return name === 'realm'; };
  const clickAll = async (sel, max) => {                  // tap enabled buttons matching a selector until none is left
    let n = 0;
    for (let i = 0; i < (max || 60); i++) {
      if (!/^#sheet/.test(sel) && await p.locator('#modal:not([hidden])').count()) await clear();         // a celebration may have opened over the panel
      const el = p.locator(sel + ':not([disabled])'); if (!(await el.count())) break; await el.first().click(); n++; await tick(260);
    }
    return n;
  };
  const info = () => p.evaluate(() => { const s = window.__la.state; return { age: s.age, stage: s.project, world: s.world, heroes: Object.keys(s.heroes).length, sent: s.stats.sent, wins: s.stats.wins, legacy: s.legacy.pts, items: Object.keys(s.items).length, techs: Object.keys(s.tech).length, docs: Object.keys(s.doctrine).length, rank: s.rank, lm: Object.keys(s.lm).length,
      places: Object.keys(s.disc).length, posts: Object.keys(s.disc).filter((k) => s.disc[k] === 2).length, events: s.stats.events, goals: s.stats.claimed, jobs: s.jobs, kept: Object.keys(s.items).filter((k) => s.items[k] === 'city').length,
      carried: Object.keys(s.items).filter((k) => s.items[k] && s.items[k] !== 'city').length, building: window.Core.worksOpen(s) && s.work < window.Core.stageWork(s) }; });
  const news = async () => {                              // hear the news and take the first choice that can be paid
    const call = p.locator('#panel [data-act="event"]');
    if (!(await call.count())) return;
    await tap(call.first()); await tick(300);
    const a = p.locator('#sheet [data-act="event:0"]:not([disabled])'), b2 = p.locator('#sheet [data-act="event:1"]:not([disabled])');
    if (await a.count()) await a.click(); else if (await b2.count()) await b2.click();
    await tick(400); await clear();
  };
  const people = async () => {                            // two tenths on the great work while it needs them, the rest shared out
    const s = await info(); if (s.rank < 2) return;
    const want = s.building ? { gold: 3, mat: 2, kn: 3, work: 2 } : { gold: 4, mat: 3, kn: 3, work: 0 };
    for (const j of ['gold', 'mat', 'kn', 'work']) for (let k = s.jobs[j]; k > want[j]; k--) { await tap(p.locator('[data-act="job-:' + j + '"]')); await tick(120); }
    for (const j of ['work', 'gold', 'mat', 'kn']) for (let k = 0; k < 10; k++) { const plus = p.locator('[data-act="job+:' + j + '"]:not([disabled])'); if ((await info()).jobs[j] >= want[j] || !(await plus.count())) break; await tap(plus); await tick(120); }
    for (const j of ['gold', 'mat', 'kn']) await clickAll('[data-act="job+:' + j + '"]', 10);       // nobody is left idle
  };
  const stow = async () => {                              // every item out of the strongroom: into the town if there is a place, else to a hero
    for (let k = 0; k < 6; k++) {
      const idle = p.locator('#panel .tile.k-idle[data-item]');
      if (!(await idle.count())) break;
      await tap(idle.first()); await tick(300);
      const town = p.locator('#sheet [data-act^="item-city:"]:not([disabled])'), hero = p.locator('#sheet [data-act^="item-hero:"]:not([disabled]):not(.laden)');
      if (await town.count()) await town.click(); else if (await hero.count()) await hero.first().click(); else { await clear(); break; }
      await tick(300); await clear();
    }
  };
  const checkin = async () => {
    await clear(); await tab('realm');
    for (let i = 0; i < 12; i++) { const w = p.locator('[data-act="work"]'); if (!(await w.count())) break; await tap(w.first()); await tick(120); }
    await news(); await clickAll('[data-act^="goal:"]', 12); await clear();
    const seg = p.locator('.seg button', { hasText: 'Max' }); if (await seg.count()) { await tap(seg.first()); await tick(260); }
    for (let pass = 0; pass < 3; pass++) {
      if (await p.locator('[data-act="depart"]').count()) return 'depart';
      if (await clickAll('[data-act="advance"]', 1)) { await tick(5000); await clear(); }
      await clickAll('[data-act="build"]', 3);
      const call = p.locator('[data-act="edict"].call');
      if (await call.count()) { await call.first().click({ force: true }); await tick(300); await p.locator('#sheet .card .btn').first().click(); await tick(300); await clear(); }
      if (await tab('town')) { await clickAll('[data-act^="lm:"]', 4); await clear(); await people(); }
      if (await tab('tree')) {
        for (let k = 0; k < 14; k++) {                    // research whatever can be paid, cheapest first, then take a doctrine
          const n = p.locator('.node.afford:not(.fork)');
          if (!(await n.count())) break;
          await tap(n.last()); await tick(300);
          const go = p.locator('#sheet [data-act="research"]:not([disabled])');
          if (await go.count()) { await go.click(); await tick(400); } else { await clear(); break; }
        }
        const fork = p.locator('.node.fork.open');
        if (await fork.count()) { await tap(fork.first()); await tick(300); const a = p.locator('#sheet [data-act^="adopt:"]:not([disabled])'); if (await a.count()) { await a.nth(pass % 3 === 0 ? 0 : 0).click(); await tick(400); } await clear(); }
      }
      if (await tab('heroes')) {
        await clickAll('#panel .btn:has-text("Dismiss all")', 1); await clickAll('#panel .btn:has-text("Dismiss")', 8);
        await clickAll('[data-act^="recruit:"]', 3); await clickAll('[data-act^="gear:"]', 8); await clickAll('[data-act^="post:"]', 3); await stow();
        for (let k = 0; k < 2; k++) {                     // send: the trial when it is at least an even fight, else the longest mission with good odds, else the best odds on offer
          const sends = p.locator('[data-act^="send:"]:not([disabled])'), n = await sends.count();
          let pick = -1, best = -1, any = -1, anyOdds = -1;
          for (let i = 0; i < n; i++) {
            const act = await sends.nth(i).getAttribute('data-act'), odds = +(await sends.nth(i).getAttribute('data-odds')), trial = /^send:trial/.test(act);
            if (odds > anyOdds) { anyOdds = odds; any = i; }
            if (trial ? odds >= 40 : odds >= 55) { const score = trial ? 1e6 : i; if (score > best) { best = score; pick = i; } }
          }
          if (pick < 0) pick = any;
          if (pick < 0) break;
          await tap(sends.nth(pick)); await tick(300);
        }
      }
      await tab('realm');
      await clickAll('[data-act^="goal:"]', 12);
      await clickAll('[data-act^="buy:"]', 12); await clear();
    }
  };
  // the first session: fifteen minutes of attention
  await clear();
  for (let i = 0; i < 18; i++) { await checkin(); await p.clock.fastForward(50000); await tick(600); }
  let hoursIn = 0.25, n = 1, last = { age: 1 }, done = false;
  const t0 = Date.now();
  for (let i = 0; i < 80 && !done; i++) {
    const gap = i < 4 ? GAPS[i] : GAPS[4 + ((i - 4) % 4)];
    await p.clock.fastForward(gap * 3600e3); await tick(800); hoursIn += gap; n++;
    await checkin();
    const s = await info();
    if (s.age !== last.age || i % 6 === 0) console.log(('+' + hoursIn.toFixed(1) + 'h').padStart(8), 'age', s.age, 'stage', s.stage, 'techs', s.techs, 'doctrines', s.docs, 'heroes', s.heroes, 'fights', s.wins + '/' + s.sent, '| rank', s.rank, 'landmarks', s.lm, 'places', s.places + ' (' + s.posts + ' in use)', 'items', s.items + ' (' + s.kept + ' kept, ' + s.carried + ' carried)', 'news', s.events, 'goals', s.goals, 'jobs', [s.jobs.gold, s.jobs.mat, s.jobs.kn, s.jobs.work, s.jobs.idle].join(''));
    last = s;
    if (i === 2) { await tab('town'); await p.locator('[data-act="chronicle"]').click(); await tick(300); await p.locator('#sheet .chap').first().click(); await tick(300); await clear(); }       // leaf through the chronicle once
    await clear(); await tab('realm');
    const dep = p.locator('[data-act="depart"]');
    if (await dep.count()) {
      await dep.first().click(); await tick(300);
      await p.locator('#sheet .btn', { hasText: 'Launch the Ark' }).click(); await tick(2600);
      await p.screenshot({ path: path.join(root, 'shots', 'bot-launch.png') });
      await tick(4200); await clear();
      const e = await info(), au = await p.evaluate(() => ({ ready: window.Sound.ready, set: window.Sound.get() }));
      console.log('departed after ' + (hoursIn / 24).toFixed(1) + ' days and ' + n + ' check-ins. world ' + e.world + ', legacy ' + e.legacy + ', sound unlocked: ' + au.ready);
      await tab('legacy'); await tick(400);
      await p.screenshot({ path: path.join(root, 'shots', 'bot-new-world.png') });
      done = true;
    }
  }
  await b.close(); srv.kill();
  console.log('sheets that were open when the robot changed tabs: ' + (Object.keys(seen).map((k) => k + ' x' + seen[k]).join(', ') || 'none'));
  console.log((done ? 'finished a world' : 'DID NOT FINISH') + ', ' + (errs.length ? 'PAGE ERRORS\n' + [...new Set(errs)].slice(0, 12).join('\n') : 'no page errors') + '  (' + ((Date.now() - t0) / 1000).toFixed(0) + 's)');
  if (!done || errs.length) process.exit(1);
})().catch((e) => { console.error('BOT FAILED', e); process.exit(1); });
