/* Pacing tool. A scripted player checks in a few times a day against the real game rules.
   node tools/sim.js cal     price every sink from a scheduled run, smooth the tables, fit project costs to the target week
   node tools/sim.js check   replay with the frozen numbers under several play styles (add "v" for the full log) */
const Core = require('../js/core.js');
const fs = require('fs');
const path = require('path');
const HMS = 3600e3;
const START = Date.UTC(2026, 10, 15, 11, 0, 0);       // a Sunday, 11:00, clock read as local time
const T = Core.TUNE;
const TUNE_FILE = path.join(__dirname, 'tune.json');
const VAL = { gold: 1, mat: 2.5, kn: 10 };
const END_H = [0, 10, 34, 68, 114, 164];              // hour at which each age should be finished
const TYPICAL = { T1: 2 * 3600, T2: 30 * 3600 };
const CAL = {
  techF1: [0.005, 0.009, 0.014, 0.02, 0.15, 0.15, 0.4, 0.4, 0.75, 0.75],
  techF: [0.02, 0.08, 0.14, 0.2, 0.28, 0.36, 0.46, 0.56, 0.68, 0.8],
  stageF: { 3: [0.15, 0.4, 1.0], 4: [0.25, 0.5, 0.75, 1.0], 5: [0.2, 0.4, 0.6, 0.8, 1.0] },
  heroF: { ranger: 0.022, physician: 0.15, carto: 0.02, engineer: 0.02, envoy: 0.02, pilot: 0.02 },
  gearF1: [0.4, 0.75], gearF: [0.3, 0.6], trialF: 0.6
};
const STAGE_W = { 3: [0.03, 0.22, 0.75], 4: [0.05, 0.15, 0.3, 0.5], 5: [0.04, 0.09, 0.17, 0.28, 0.42] };
const TECH_AGE1 = [1, 3, 8, 30, 150, 600, 2000, 6000, 15000, 35000];
const PATTERNS = {
  normal: ['07:30', '12:30', '18:30', '22:30'],
  sparse: ['08:00', '21:00'],
  dense: ['07:00', '09:30', '12:30', '15:30', '18:30', '21:00', '23:00']
};
const clone = function (o) { return JSON.parse(JSON.stringify(o)); };
const sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
const hrs = function (t) { return (t - START) / HMS; };

function checkins(pattern, days) {
  const day0 = START - 11 * HMS, out = [];
  const at = function (d, hm) { const p = hm.split(':'); return day0 + d * 24 * HMS + (+p[0]) * HMS + (+p[1]) * 60e3; };
  ['12:30', '15:00', '18:30', '22:30'].forEach(function (hm) { out.push(at(0, hm)); });
  for (let d = 1; d <= days; d++) PATTERNS[pattern].forEach(function (hm) { out.push(at(d, hm)); });
  return out;
}

/* ---------- the scripted player ---------- */
function rankBuildings(s, d) {
  const list = [];
  for (const b of Core.BUILDINGS) {
    if (!Core.buildingVisible(s, b)) continue;
    const n = Core.count(s, b.id), c = Core.buildCost(b, n, 1), k = b.prod * (d.bm[b.id] || 1) * d.rm[b.res];
    const gain = ((n + 1) * Core.milestoneMult(n + 1) - n * Core.milestoneMult(n)) * k * VAL[b.res];
    list.push({ b: b, pb: ((c.gold || 0) + (c.mat || 0) * VAL.mat) / gain, c: c });
  }
  return list.sort(function (x, y) { return x.pb - y.pb; });
}
function buyBest(s, now, limit) {
  const d = Core.derive(s, now);
  for (const r of rankBuildings(s, d)) {
    if (r.pb > limit) break;
    if (Core.canPay(s, r.c)) { Core.buy(s, r.b.id, 1); return true; }
  }
  return false;
}
function combos(ids, k) {
  const out = [];
  (function rec(i, cur) {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let j = i; j < ids.length; j++) { cur.push(ids[j]); rec(j + 1, cur); cur.pop(); }
  })(0, []);
  return out;
}
function bestTeam(s, mid, now, avail) {
  let best = null;
  for (const c of combos(avail, Math.min(Core.PARTY_SIZE, avail.length))) {
    const p = Core.forecast(s, mid, c, now, 30), score = p + (c.indexOf('carto') >= 0 ? 0.03 : 0);
    if (!best || score > best.score) best = { ids: c, p: p, score: score };
  }
  return best;
}
function sendParties(s, now, gap, ctx) {
  if (!Core.has(s, 'heroes') || ctx.opt.noHeroes) return;
  for (let guard = 0; guard < 4; guard++) {
    const d = Core.derive(s, now);
    if (s.parties.length >= d.slots) break;
    const taken = Core.busy(s), avail = Object.keys(s.heroes).filter(function (id) { return !taken[id]; });
    if (!avail.length) break;
    let pick = null;
    const tr = Core.MISSION['trial' + s.age], out = function (m) { return s.parties.some(function (p) { return p.m === m.id; }); };
    const calHold = ctx.cal && ctx.cal.age === s.age && !ctx.cal.trialSet;
    if (Core.missionOpen(s, tr) && !out(tr) && !calHold) {
      const bt = bestTeam(s, tr.id, now, avail);
      if (bt.p >= (ctx.opt.trialAt === undefined ? 0.6 : ctx.opt.trialAt)) pick = { m: tr, team: bt };
    }
    if (!pick) {
      for (const m of Core.MISSIONS) {
        if (!Core.missionOpen(s, m) || m.age < s.age - 1 || out(m)) continue;
        const bt = bestTeam(s, m.id, now, avail);
        if (bt.p < 0.7) continue;
        const dur = Core.missionTime(m, d, bt.ids), hours = (m.loot.gold || 0) + (m.loot.mat || 0) + (m.loot.kn || 0);
        const v = hours * Math.pow(0.5, s.age - m.age) * bt.p * (dur <= gap * 1.15 ? 1 : 0.8 * gap / dur);
        if (!pick || v > pick.v) pick = { m: m, team: bt, v: v };
      }
    }
    if (!pick || !Core.send(s, pick.m.id, pick.team.ids, now)) break;
  }
}
function pickEdict(s, now) {
  if (!Core.has(s, 'edicts')) return;
  const d = Core.derive(s, now, false), c = Core.stageCost(s, d);
  let id = 'fair', worst = -1;
  if (c) for (const r of ['gold', 'mat', 'kn']) {
    if (!c[r]) continue;
    const wait = d.rate[r] > 0 ? (c[r] - s.res[r]) / d.rate[r] : 0;
    if (wait > worst) { worst = wait; id = { gold: 'fair', mat: 'levy', kn: 'symposium' }[r]; }
  } else if (!s.trialWon[s.age]) id = 'muster';
  Core.setEdict(s, id, now);
}
const DOCS = { 1: 'd1a', 2: 'd2a', 3: 'd3a', 4: 'd4b', 5: 'd5b' };

function normalSinks(s, now, ctx, calAge) {
  for (const t of Core.openTechs(s)) {
    if (t.age === calAge) continue;
    if (Core.research(s, t.id, now)) return true;
  }
  if (s.age === calAge) return false;
  if (Core.buildStage(s, now)) return true;
  for (const h of Core.HEROES) if (Core.heroAvailable(s, h) && s.res.gold >= (T.hero[h.id] || 0) && Core.recruit(s, h.id, now)) return true;
  if (!ctx.opt.noGear) {
    const ids = Object.keys(s.heroes), tr = Core.MISSION['trial' + s.age];
    const need = !s.trialWon[s.age] && Core.trialOpen(s) && ids.length && bestTeam(s, tr.id, now, ids).p < 0.6;
    const order = ids.slice().sort(function (a, b) { return s.heroes[a].gear - s.heroes[b].gear; });
    for (const id of order) {
      const c = Core.gearCost(s, id);
      if (c === null || s.res.mat < c) continue;
      if (need || c <= 0.5 * s.res.mat) { Core.upgradeGear(s, id); return true; }
    }
  }
  return false;
}

/* During calibration the sinks of the age being tuned are priced from what the player holds
   at the moment each one is meant to become affordable. */
function calSinks(s, now, ctx) {
  const cal = ctx.cal, a = cal.age, f = (now - cal.t0) / (cal.t1 - cal.t0), d = Core.derive(s, now);
  const tf = a === 1 ? CAL.techF1 : CAL.techF;
  const due = Core.TECHS.filter(function (t) { return t.age === a && !s.tech[t.id] && f >= tf[t.rank]; }).sort(function (x, y) { return x.rank - y.rank; });
  if (due.length && s.res.kn > 1.3) {
    const w = due.map(function (_, j) { return Math.pow(1.5, j); }), W = sum(w), budget = 0.85 * s.res.kn;
    due.forEach(function (t, j) {
      T.tech[a][t.rank] = Math.max(1, budget * w[j] / W / d.techCost);
      Core.research(s, t.id, now);
    });
  }
  for (const h of Core.HEROES) {
    if (h.id === 'warden' || !Core.heroAvailable(s, h) || f < CAL.heroF[h.id]) continue;
    T.hero[h.id] = Math.max(10, 0.3 * s.res.gold);
    Core.recruit(s, h.id, now);
  }
  const gf = a === 1 ? CAL.gearF1 : CAL.gearF, ids = Object.keys(s.heroes);
  for (let k = 0; k < 2; k++) {
    const lvl = 2 * (a - 1) + k;
    if (f < gf[k] || cal.gear[k] || !ids.length) continue;
    T.gear[lvl] = Math.max(1, 0.5 * s.res.mat / Math.min(3, ids.length));
    cal.gear[k] = true;
    ids.slice(0, 3).forEach(function (id) { if (s.heroes[id].gear === lvl) Core.upgradeGear(s, id); });
  }
  ids.forEach(function (id) { const c = Core.gearCost(s, id); if (c !== null && c <= 0.1 * s.res.mat) Core.upgradeGear(s, id); });
  const stages = Core.PROJECTS[a].stages.length, sf = CAL.stageF[stages];
  while (s.project < stages && f >= sf[s.project]) {
    const i = s.project, p = T.proj[a];
    p.gold[i] = Math.max(1, 0.8 * s.res.gold / d.projCost);
    p.mat[i] = Math.max(1, 0.8 * s.res.mat / d.projCost);
    p.kn[i] = i === stages - 1 ? Math.max(1, 0.85 * s.res.kn / d.projCost) : 0;
    if (!Core.buildStage(s, now)) break;
  }
  if (!cal.trialSet && f >= CAL.trialF && Core.trialOpen(s)) {
    const team = function () { return bestTeam(s, 'trial' + a, now, Object.keys(s.heroes)).p; };
    let lo = 0.02, hi = 400;
    for (let i = 0; i < 40; i++) {
      const mid = Math.sqrt(lo * hi);
      T.enemy[a] = { hp: 450 * mid, atk: 50 * mid };
      if (team() > 0.8) lo = mid; else hi = mid;
    }
    T.enemy[a] = { hp: 450 * lo, atk: 50 * lo };
    cal.trialSet = true;
  }
}

function act(s, now, next, ctx) {
  const o = ctx.opt, calAge = ctx.cal ? ctx.cal.age : 0;
  Core.advance(s, now);
  s.reports.length = 0;
  for (let guard = 0; guard < 6000; guard++) {
    if (Core.canAdvance(s)) { Core.advanceAge(s, now); ctx.ages[s.age - 1] = now; if (ctx.stopAge && s.age > ctx.stopAge) { ctx.over = true; return; } continue; }
    if (Core.canDepart(s)) { ctx.ages[5] = now; ctx.over = true; return; }
    let did = false;
    for (let a = 1; a <= s.age; a++) if (Core.doctrineOpen(s, a)) { Core.chooseDoctrine(s, (o.docs || DOCS)[a], now); did = true; }
    if (did) continue;
    if (buyBest(s, now, o.T1)) continue;
    if (normalSinks(s, now, ctx, calAge)) continue;
    if (calAge === s.age && !ctx.calDone) { calSinks(s, now, ctx); ctx.calDone = true; continue; }
    if (buyBest(s, now, o.T2)) continue;
    break;
  }
  ctx.calDone = false;
  pickEdict(s, now);
  sendParties(s, now, (next - now) / 1000, ctx);
}

function firstSession(s, ctx) {
  const end = START + 15 * 60e3, seen = {};
  const note = function (k, t) { if (ctx.trace && !seen[k]) { seen[k] = 1; ctx.trace.push(Math.round((t - START) / 1000) + 's ' + k); } };
  for (let t = START; t <= end; t += 5e3) {
    if (t < START + 75e3) for (let i = 0; i < 8; i++) Core.work(s, t);
    act(s, t, end + 75 * 60e3, ctx);
    if (Core.count(s, 'farm') >= 1) note('first farmstead', t);
    if (Core.count(s, 'farm') >= 10) note('10 farmsteads', t);
    if (Core.count(s, 'lumber') >= 1) note('first lumber camp', t);
    if (Core.count(s, 'script') >= 1) note('first scriptorium', t);
    for (let i = 1; i <= 6; i++) if (Core.techCount(s) >= i) note('research #' + i, t);
    if (s.heroes.warden) note('Warden joins', t);
    if (s.heroes.ranger) note('Ranger recruited', t);
    if (s.stats.sent) note('first expedition sent', t);
    if (Core.ageTabOpen(s)) note('great project proposed', t);
    if (s.project >= 1) note('stage 1 built', t);
  }
  return end;
}

/* Run from a snapshot (or a new game) until the given age is finished. */
function run(snap, ctx, pattern) {
  const times = checkins(pattern || 'normal', 45);
  let s, t;
  ctx.ages = ctx.ages || {};
  let n = snap ? 0 : 1;
  if (snap) {       // a snapshot is taken in the middle of a check-in, at the moment an age begins: finish that check-in first
    s = clone(snap.s); t = snap.t;
    const nx = times.find(function (x) { return x > t; });
    act(s, t, nx, ctx);
  } else { s = Core.newState(START); t = firstSession(s, ctx); if (ctx.each) ctx.each(s, t); }
  for (let i = 0; i < times.length && !ctx.over; i++) {
    if (times[i] <= t) continue;
    act(s, times[i], times[i + 1] || times[i] + 5 * HMS, ctx); t = times[i]; n++;
    if (ctx.each) ctx.each(s, t);
  }
  return { s: s, t: t, n: n };
}

/* ---------- calibration ---------- */
function calibrate() {
  let snap = null;
  for (let a = 1; a <= 5; a++) {
    if (a > 1) T.enemy[a] = { hp: T.enemy[a - 1].hp * 3.3, atk: T.enemy[a - 1].atk * 3.3 };
    if (!T.tech[a].length) T.tech[a] = new Array(10).fill(Infinity);
    let end = null;
    for (let pass = 0; pass < 4; pass++) {
      const ctx = { opt: TYPICAL, stopAge: a, cal: { age: a, t0: snap ? snap.t : START, t1: START + END_H[a] * HMS, gear: [false, false], trialSet: false } };
      end = run(snap, ctx);
    }
    snap = { s: end.s, t: end.t };
    console.log('age ' + a + ' priced, scheduled run ended at +' + hrs(end.t).toFixed(1) + 'h');
  }
}
function smooth() {
  for (let a = 1; a <= 5; a++) {
    const p = T.proj[a], n = p.gold.length, w = STAGE_W[n];
    const G = sum(p.gold), Mt = sum(p.mat);
    p.gold = w.map(function (x) { return Core.nice(G * x); });
    p.mat = w.map(function (x) { return Core.nice(Mt * x); });
    p.kn = p.kn.map(Core.nice);
    if (a === 1) T.tech[1] = TECH_AGE1.slice();
    else {
      const tot = sum(T.tech[a]), r = 1.55, W = sum(T.tech[a].map(function (_, i) { return Math.pow(r, i); }));
      T.tech[a] = T.tech[a].map(function (_, i) { return Core.nice(tot * Math.pow(r, i) / W); });
    }
    T.enemy[a] = { hp: Core.nice(T.enemy[a].hp), atk: Core.nice(T.enemy[a].atk) };
    const g0 = 2 * (a - 1);
    if (g0 && T.gear[g0] < T.gear[g0 - 1] * 2.5) T.gear[g0] = T.gear[g0 - 1] * 2.5;
    T.gear[g0] = Core.nice(T.gear[g0]); T.gear[g0 + 1] = Core.nice(T.gear[g0] * 3.5);
  }
  for (const h of Core.HEROES) T.hero[h.id] = Core.nice(T.hero[h.id]);
}
/* Scale each age's project so the typical player finishes it at the check-in nearest the target. */
function fit() {
  let snap = null;
  for (let a = 1; a <= 5; a++) {
    const base = clone(T.proj[a]), grid = [];
    for (let m = 0.2; m < 6; m *= 1.18) grid.push(m);
    const setM = function (m) { for (const r of ['gold', 'mat', 'kn']) T.proj[a][r] = base[r].map(function (v) { return Core.nice(v * m); }); };
    const res = grid.map(function (m) {
      setM(m);
      const ctx = { opt: TYPICAL, stopAge: a }; run(snap, ctx);
      return { m: m, end: ctx.ages[a] ? hrs(ctx.ages[a]) : 1e9 };
    });
    let bestEnd = null;       // nearest finishing check-in that leaves real slack in the multiplier
    const width = function (e) { const ms = res.filter(function (r) { return r.end === e; }).map(function (r) { return r.m; }); return Math.max.apply(null, ms) / Math.min.apply(null, ms); };
    res.forEach(function (r) { if (width(r.end) < 1.35) return; if (bestEnd === null || Math.abs(r.end - END_H[a]) < Math.abs(bestEnd - END_H[a])) bestEnd = r.end; });
    if (bestEnd === null) res.forEach(function (r) { if (bestEnd === null || Math.abs(r.end - END_H[a]) < Math.abs(bestEnd - END_H[a])) bestEnd = r.end; });
    const ok = res.filter(function (r) { return r.end === bestEnd; }).map(function (r) { return r.m; });
    const m = Math.sqrt(Math.min.apply(null, ok) * Math.max.apply(null, ok));
    setM(m);
    const ctx = { opt: TYPICAL, stopAge: a }, end = run(snap, ctx);
    snap = { s: end.s, t: end.t };
    console.log('age ' + a + ' project x' + m.toFixed(2) + ' (range ' + Math.min.apply(null, ok).toFixed(2) + ' to ' + Math.max.apply(null, ok).toFixed(2) + '), typical player finishes at +' + hrs(end.t).toFixed(1) + 'h, target ' + END_H[a] + 'h');
  }
}

/* ---------- verification ---------- */
function play(name, pattern, opt, verbose) {
  const ctx = { opt: opt, trace: verbose ? [] : null }, rows = [];
  if (verbose) ctx.each = function (s, t) {
    const d = Core.derive(s, t);
    rows.push('  +' + hrs(t).toFixed(1).padStart(6) + 'h age ' + s.age + ' stage ' + s.project + ' tech ' + String(Core.techCount(s, s.age)).padStart(2) + '/10  g ' + Core.fmt(d.rate.gold).padStart(6) + '/s m ' + Core.fmt(d.rate.mat).padStart(6) + '/s k ' + Core.fmt(d.rate.kn).padStart(6) + '/s  trial ' + (s.trialWon[s.age] ? 'won' : ' - ') + '  lvl.gear ' + Object.keys(s.heroes).map(function (id) { return s.heroes[id].lvl + '.' + s.heroes[id].gear; }).join(' '));
  };
  const r = run(null, ctx, pattern), s = r.s;
  console.log(name.padEnd(34) + [1, 2, 3, 4, 5].map(function (a) { return ctx.ages[a] ? hrs(ctx.ages[a]).toFixed(0).padStart(5) + 'h' : '    - '; }).join(' ') +
    '   ' + (ctx.ages[5] ? (hrs(ctx.ages[5]) / 24).toFixed(1) + ' days' : 'unfinished') + ', ' + r.n + ' check-ins, fights won ' + s.stats.wins + '/' + s.stats.sent + ', relics ' + Core.relicCount(s));
  if (verbose) { console.log('  first session: ' + ctx.trace.join(' | ')); console.log(rows.join('\n')); }
  return { ctx: ctx, s: s, t: r.t };
}
function secondWorld(first) {
  const s = clone(first.s), t = first.t;
  const gain = Core.depart(s, t);
  for (const id of ['prosper', 'prosper', 'prosper', 'stores', 'orders', 'plans', 'prosper', 'lore', 'roads', 'prosper', 'orders']) Core.buyPerk(s, id);
  const ctx = { opt: TYPICAL, ages: {} }, times = checkins('normal', 60);
  let last = t;
  for (let x = t; x <= t + 15 * 60e3; x += 5e3) { if (x < t + 60e3) for (let i = 0; i < 8; i++) Core.work(s, x); act(s, x, t + 90 * 60e3, ctx); last = x; }
  for (let i = 0; i < times.length && !ctx.over; i++) { if (times[i] <= last) continue; act(s, times[i], times[i + 1] || times[i] + 5 * HMS, ctx); last = times[i]; }
  console.log('second world: ' + gain + ' legacy earned, perks ' + JSON.stringify(s.legacy.perks) + ', finished after ' + ((last - t) / HMS / 24).toFixed(1) + ' days');
}

const mode = process.argv[2] || 'check';
if (mode === 'cal') {
  calibrate(); smooth(); fit();
  fs.writeFileSync(TUNE_FILE, JSON.stringify(T, null, 1));
} else {
  const saved = JSON.parse(fs.readFileSync(TUNE_FILE, 'utf8'));
  for (const k in saved) T[k] = saved[k];
}
if (mode === 'snaps') {          // states for the screenshot tests
  const want = { 0.25: 'a1_first', 4: 'a1_mid', 25.5: 'a2', 55.5: 'a3', 97.5: 'a4', 145.5: 'a5' }, snaps = {};
  const ctx = { opt: TYPICAL, each: function (s, t) { const k = want[Math.round(hrs(t) * 100) / 100]; if (k) snaps[k] = { t: t, s: clone(s) }; } };
  const r = run(null, ctx);
  snaps.a5_end = { t: r.t, s: clone(r.s) };
  fs.writeFileSync(path.join(__dirname, 'snaps.json'), JSON.stringify(snaps));
  console.log('snapshots: ' + Object.keys(snaps).map(function (k) { return k + ' (age ' + snaps[k].s.age + ')'; }).join(', '));
  process.exit(0);
}
const v = process.argv[3] === 'v';
console.log('\nplay style                          age1   age2   age3   age4   age5');
const typical = play('typical, 4 check-ins a day', 'normal', TYPICAL, v);
play('2 check-ins a day', 'sparse', TYPICAL);
play('7 check-ins a day', 'dense', TYPICAL);
play('buys every building it can', 'normal', { T1: 3600, T2: 60 * 3600 });
play('stops at 20h payback', 'normal', { T1: 3600, T2: 20 * 3600 });
play('stops at 14h payback', 'normal', { T1: 3600, T2: 14 * 3600 });
play('stops at 10h payback', 'normal', { T1: 3600, T2: 10 * 3600 });
play('very cautious with buildings', 'normal', { T1: 3600, T2: 4 * 3600 });
play('never upgrades gear', 'normal', { T1: 2 * 3600, T2: 30 * 3600, noGear: true, trialAt: 0 });
play('reckless with trials', 'normal', { T1: 2 * 3600, T2: 30 * 3600, trialAt: 0.3 });
play('other doctrines', 'normal', { T1: 2 * 3600, T2: 30 * 3600, docs: { 1: 'd1c', 2: 'd2c', 3: 'd3c', 4: 'd4a', 5: 'd5c' } });
if (typical.ctx.ages[5]) secondWorld(typical);
