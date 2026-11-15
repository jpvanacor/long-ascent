/* Long Ascent: the interface. Panels are rebuilt only when their structure changes; numbers, timers and
   button states are refreshed in place four times a second. Words are kept short on the surface: every
   tile opens a sheet with the full explanation. */
(function () {
  'use strict';
  const C = Core, ICONS = window.ICONS || {}, FX = window.FX, Snd = window.Sound;
  const LOCAL_KEY = 'long-ascent-save-v1', VIEW_KEY = 'long-ascent-view-v2', NS = 'http://www.w3.org/2000/svg';
  const HC = { warden: '#5d82b3', ranger: '#5f9a4a', physician: '#3fa39a', carto: '#c79a3a', engineer: '#c7692c', envoy: '#8a63b8', pilot: '#3b9bd6' };
  const RC = { gold: '#f4cb5e', mat: '#e99a6c', kn: '#97b9ff' };
  const KIND = { gold: ['res.gold', 'Gold'], mat: ['res.mat', 'Materials'], kn: ['res.kn', 'Knowledge'], civ: ['ui.village', 'Realm'], log: ['ui.store', 'Logistics'], arm: ['tab.heroes', 'Heroes'], cap: ['ui.star', 'Prosperity'] };
  const KIND_COLOR = { gold: '#f4cb5e', mat: '#e99a6c', kn: '#97b9ff', civ: '#c9a2ff', log: '#8fe0b0', arm: '#ff9a8c', cap: '#ffe9a8', doc: '#ffffff' };
  const THEME = [null, '#170f09', '#0c1124', '#131516', '#15181c', '#050912'];
  const TABS = [['realm', 'Realm', 'tab.realm'], ['town', 'Town', 'tab.town'], ['tree', 'Research', 'tab.council'], ['heroes', 'Heroes', 'tab.heroes'], ['age', 'Age', 'tab.age'], ['legacy', 'Legacy', 'tab.legacy']];
  const $ = function (id) { return document.getElementById(id); };
  const now = function () { return Date.now(); };
  const fmt = C.fmt, fmtTime = C.fmtTime;
  const fmtC = function (n) { return fmt(n).replace(/(\.\d*?)0+([A-Za-z]*)$/, '$1$2').replace(/\.([A-Za-z]*)$/, '$1'); };   // fixed prices read better without trailing zeros
  let S = null, D = null, booted = false, bootSaved = 0;
  let view = { tab: 'realm', qty: 1, older: false, oldGround: false };
  let lineup = [], openLog = {}, live = [], sheetLive = [], lastSig = '', lastBadges = '', lastPips = '', lastEmblem = 0, launch = null, toastTimer = 0, saveTimer = 0, switched = true;
  let sheetStep = false, cityStep = false, skipPop = 0, city = false, feedSig = '', drawQueued = false, toastQ = [], openChap = {}, oldRealm = false, workSaid = '';
  const cloud = { ref: null, state: 'none', at: 0, dirty: false, busy: false, timer: 0 };
  const VERSION = +window.APP_VERSION || 0, NATIVE = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  const REPO = 'jpvanacor/long-ascent', APK_URL = 'https://github.com/' + REPO + '/releases/latest/download/long-ascent.apk';

  /* ---------- small DOM helpers ---------- */
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; }
  function add(p) { for (let i = 1; i < arguments.length; i++) { const k = arguments[i]; if (k) p.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); } return p; }
  function ic(key, cls) {
    const s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    s.setAttribute('viewBox', '0 0 512 512'); s.setAttribute('class', 'ic' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', ICONS[key] || ICONS['ui.info'] || ''); s.appendChild(p);
    return s;
  }
  function tile(key, kind, size, tap) {
    const t = el(tap ? 'button' : 'div', 'tile' + (kind ? ' k-' + kind : '') + (size ? ' ' + size : ''));
    if (tap) { t.type = 'button'; t.addEventListener('click', tap); }
    t.appendChild(ic(key));
    return t;
  }
  function btn(label, fn, cls, icon) {
    const b = el('button', 'btn' + (cls ? ' ' + cls : '')); b.type = 'button';
    if (icon) b.appendChild(ic(icon));
    if (label) b.appendChild(el('span', 'lbl', label));
    b.addEventListener('click', function (ev) { fn(b, ev); });
    return b;
  }
  function stat(icon, text, cls) { const s = el('span', 'stat'), b = el('b', null, text); s.appendChild(ic(icon, cls)); s.appendChild(b); s.b = b; return s; }
  function tag(icon, text, tap) {
    const t = el(tap ? 'button' : 'span', 'tag'), l = el('span', null, text);
    if (tap) { t.type = 'button'; t.addEventListener('click', tap); }
    t.appendChild(ic(icon)); t.appendChild(l); t.lbl = l;
    return t;
  }
  function pips(n, of) { const p = el('span', 'pips'); for (let i = 0; i < of; i++) p.appendChild(el('i', i < n ? 'on' : '')); return p; }
  function sec(text, side) { const h = el('h2', 'sec', text); if (!side) return h; const w = el('div', 'sechead'); h.classList.add('left'); add(w, h, side); return w; }
  function setText(e, t) { if (e.textContent !== t) e.textContent = t; }
  function face(id, cls, tap) {
    const f = el(tap ? 'button' : 'span', 'face' + (cls ? ' ' + cls : ''));
    if (tap) { f.type = 'button'; f.addEventListener('click', tap); }
    f.style.setProperty('--hc', HC[id] || '#888'); f.appendChild(ic('h.' + id)); f.setAttribute('aria-label', C.HERO[id].name);
    return f;
  }
  /* a price: one chip per resource, red when it cannot be paid. inBtn: icons take the button's ink */
  function costView(inBtn) {
    const box = el('span', 'costs'), parts = {};
    return { el: box, set: function (c) {
      for (const r of C.RES) {
        const v = c && c[r];
        if (!v) { if (parts[r]) parts[r].wrap.style.display = 'none'; continue; }
        if (!parts[r]) { const wrap = el('span', 'cost num'), num = el('span'); wrap.appendChild(ic('res.' + r, inBtn ? '' : 'c-' + r)); wrap.appendChild(num); box.appendChild(wrap); parts[r] = { wrap: wrap, num: num }; }
        parts[r].wrap.style.display = ''; setText(parts[r].num, fmtC(v)); parts[r].wrap.classList.toggle('short', S.res[r] < v);
      }
    } };
  }
  function seg(options, value, pick) {
    const s = el('div', 'seg');
    options.forEach(function (o) { const b = el('button', o[0] === value ? 'on' : '', o[1]); b.type = 'button'; b.addEventListener('click', function () { Snd.play('tap'); pick(o[0]); }); s.appendChild(b); });
    return s;
  }
  function fxKind(fx) {
    switch (fx.type) {
      case 'lm': return fxKind(C.LANDMARK[fx.id].fx);
      case 'b': return C.B[fx.b].res;
      case 'res': return fx.res;
      case 'techCost': return 'kn';
      case 'unlock': case 'projCost': case 'edictTime': return 'civ';
      case 'store': case 'time': return 'log';
      case 'hero': case 'loot': case 'self': case 'party': case 'xp': return 'arm';
      default: return 'cap';
    }
  }
  function ageTitle(a) { return 'The ' + C.AGES[a].name; }
  function hours(h) { return (Math.round(h * 10) / 10) + 'h'; }
  function short(name) { return name.replace(/^The /, ''); }
  function toast(t) {                        // one line at the foot of the screen; several in a row wait their turn
    const e = $('toast');
    if (toastTimer) { if (toastQ.length < 4) toastQ.push(t); return; }
    e.textContent = t; e.classList.toggle('top', !$('modal').hidden); e.classList.add('on');       // over an open sheet it goes to the top, clear of the buttons
    toastTimer = setTimeout(function () {
      e.classList.remove('on'); toastTimer = 0;
      if (toastQ.length) { const next = toastQ.shift(); setTimeout(function () { toast(next); }, 240); }
    }, toastQ.length ? 2000 : 2800);
  }
  function sparkle(target, kind, big) {
    const c = KIND_COLOR[kind] || '#ffe9a8';
    FX.burst(target, { n: big ? 34 : 16, color: [c, '#ffffff', c], speed: big ? 250 : 170, life: big ? 1 : 0.7, size: big ? 4 : 3 });
    FX.ring(target, c, big ? 90 : 48, big ? 6 : 4);
  }

  /* ---------- saving ---------- */
  function saveLocal() { if (!booted) return; try { localStorage.setItem(LOCAL_KEY, C.serialize(S, now())); } catch (e) { /* storage may be missing here */ } }
  function saveView() { try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch (e) { /* ignore */ } }
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveLocal, 400); if (cloud.state === 'on' && !cloud.timer) cloud.timer = setTimeout(function () { cloud.timer = 0; pushCloud(); }, Math.max(5000, 20000 - (now() - cloud.at))); }
  function pushCloud() {
    if (!cloud.ref || cloud.busy || !cloud.dirty || cloud.state !== 'on') return;
    cloud.busy = true; cloud.dirty = false;
    let body;
    try { body = { saved: now(), age: S.age, world: S.world, json: C.serialize(S, now()) }; } catch (e) { cloud.busy = false; return; }
    cloud.ref.set(body).then(function () { cloud.at = now(); cloud.busy = false; }, function (e) {
      cloud.busy = false; cloud.dirty = true;
      const code = e && e.code;
      if (code === 'revoked' || code === 'not_granted' || code === 'invalid_argument' || code === 'capability_disabled' || code === 'capability_removed' || code === 'quota_exceeded') cloud.state = 'none';
    });
  }
  function initCloud() {                     // only when the game runs as a Claude artifact; the app itself saves on the device
    const use = window.claude && window.claude.use;
    if (!use) { cloud.state = 'none'; return; }
    cloud.state = 'checking';
    const limit = setTimeout(function () { if (cloud.state === 'checking') cloud.state = 'slow'; }, 10000);
    Promise.all([use('db'), use('user')]).then(function (got) {
      const db = got[0], user = got[1];
      if (!db || !user) throw new Error('no store');
      return Promise.resolve(user.id()).then(function (id) {
        if (!id) throw new Error('no id');
        cloud.ref = db.doc('data/users/' + id + '/save');
        return cloud.ref.get();
      });
    }).then(function (snap) {
      clearTimeout(limit); cloud.state = 'on';
      const data = snap && snap.exists ? snap.data() : null, other = data && data.json ? C.load(data.json, now()) : null;
      if (other && (other.saved || 0) > bootSaved + 2000) { cloud.at = now(); adopt(other, 'Your realm was restored from its saved copy.'); }
      else { cloud.dirty = true; pushCloud(); }
    }).catch(function () { clearTimeout(limit); cloud.state = 'none'; });
  }
  function adopt(state, message) {
    S = state; bootSaved = S.saved || 0; lineup = []; openLog = {}; lastSig = ''; launch = null;
    closeSheet(); Snd.setAge(S.age); step(true); saveLocal(); if (message) toast(message);
  }
  function encodeSave() { return 'LA1.' + btoa(unescape(encodeURIComponent(C.serialize(S, now())))); }
  function decodeSave(text) {
    try { const t = String(text).replace(/\s+/g, ''); if (t.slice(0, 4) !== 'LA1.') return null; return C.load(decodeURIComponent(escape(atob(t.slice(4)))), now()); } catch (e) { return null; }
  }

  /* ---------- sheets ---------- */
  /* The city view and an open sheet are each one step in the browser history, so the phone's back button closes
     what is on top instead of leaving the game. Each step is added while the player is touching the screen:
     browsers skip steps a page adds on its own. The Android app does not rely on this; it asks goBack() below. */
  function pushStep() { try { history.pushState({ layer: 1 }, ''); return true; } catch (e) { return false; } }
  function dropStep() { skipPop++; try { history.back(); } catch (e) { skipPop--; } }
  function openSheet(build, silent) {
    const sh = $('sheet'); sh.textContent = ''; sheetLive = []; build(sh); $('modal').hidden = false; sh.scrollTop = 0; sheetLive.forEach(function (f) { f(); });
    if (!silent) Snd.play('open');
    $('toast').classList.add('top');           // a line already showing moves clear of the sheet's buttons
    if (!sheetStep) sheetStep = pushStep();
  }
  function closeSheet(fromBack) {
    $('modal').hidden = true; $('sheet').textContent = ''; sheetLive = []; $('toast').classList.remove('top');
    if (sheetStep) { sheetStep = false; if (fromBack !== true) dropStep(); }
  }
  function onPop() {
    if (skipPop > 0) { skipPop--; return; }                             // our own step back
    if (!$('modal').hidden) closeSheet(true); else if (city) closeCity(true);
  }
  function goBack() {                        // what Back means in the game: close what is on top; false when nothing is open
    if (!$('modal').hidden) { closeSheet(); return true; }
    if (city) { closeCity(); return true; }
    return false;
  }
  function inSheet(build) { const keep = live; live = sheetLive; try { return build(); } finally { live = keep; } }   // a card whose numbers follow the sheet, not the panel
  function goTab(tab) { if (!$('modal').hidden) closeSheet(); if (city) closeCity(); go(tab); }
  function sheetHead(tileEl, title, under) {
    const mid = el('div', 'mid'); mid.appendChild(el('h3', null, title));
    if (under) mid.appendChild(typeof under === 'string' ? el('div', 'sm soft', under) : under);
    return add(el('div', 'sheethead'), tileEl, mid);
  }
  function closeRow() { return add(el('div', 'acts'), btn('Close', function () { closeSheet(); }, 'alt big')); }
  function info(title, icon, kind, lines) {
    openSheet(function (sh) {
      sh.appendChild(sheetHead(tile(icon, kind, 'lg'), title));
      lines.forEach(function (l) { if (l) sh.appendChild(typeof l === 'string' ? el('p', null, l) : l); });
      sh.appendChild(closeRow());
    });
  }
  function showAway(out) {
    openSheet(function (sh) {
      sh.appendChild(sheetHead(tile('ui.sleep', 'kn', 'lg'), 'While you were away', 'Gone for ' + fmtTime(out.away)));
      const g = el('div', 'gains');
      for (const r of C.RES) if (out.gains[r] > 0) { const b = el('b', 'c-' + r); add(g, ic('res.' + r, 'c-' + r), el('span', null, C.RES_NAME[r]), b); FX.count(b, out.gains[r], 900, fmt, '+'); }
      sh.appendChild(g);
      if (out.capped) sh.appendChild(add(el('div', 'hint'), 'The storehouses were full after ' + hours(out.storeH) + ' and work stopped there.'));
      const notes = el('div', 'stats');
      if (out.work > 0.05) notes.appendChild(tag('job.work', oneDec(out.work) + ' work done on the ' + short(C.PROJECTS[S.age].name).toLowerCase()));
      if (S.reports.length) notes.appendChild(tag('tab.heroes', S.reports.length === 1 ? 'One party has returned' : S.reports.length + ' parties have returned'));
      if (S.ev.cur) notes.appendChild(tag('ui.news', 'News has reached the town'));
      if (notes.firstChild) sh.appendChild(notes);
      sh.appendChild(add(el('div', 'acts'), btn('Continue', function (b) {
        Snd.play('collect');
        for (const r of C.RES) if (out.gains[r] > 0) (function (r) { FX.fly(b, $('col-' + r), { n: 6, color: RC[r], rim: 'rgba(0,0,0,.45)' }, function () { FX.bump($('col-' + r)); }); })(r);
        closeSheet();
      }, 'big ready', 'ui.chest')));
    }, true);
  }
  function slider(icon, value, change) {
    const row = el('div', 'slider'), inp = el('input'), pct = el('span', 'num sm soft');
    inp.type = 'range'; inp.min = '0'; inp.max = '100'; inp.step = '5'; inp.value = String(Math.round(value * 100));
    const show = function () { pct.textContent = inp.value === '0' ? 'off' : inp.value + '%'; };
    inp.addEventListener('input', function () { show(); change(inp.value / 100); });
    show(); add(row, ic(icon), inp, pct);
    return row;
  }
  function openMenu() {
    openSheet(function (sh) {
      const au = Snd.get();
      sh.appendChild(el('h2', 'sec', 'Sound'));
      sh.appendChild(slider('ui.music', au.music, function (v) { Snd.volume('music', v); }));
      sh.appendChild(slider('ui.sound', au.sfx, function (v) { Snd.volume('sfx', v); Snd.play('coin'); }));
      sh.appendChild(el('h2', 'sec', 'Save'));
      const st = cloud.state === 'on' ? 'Saved to your Claude account as you play' + (cloud.at ? ' (last copy at ' + new Date(cloud.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ').' : '.')
        : cloud.state === 'checking' || cloud.state === 'slow' ? 'Looking for your saved realm. Until it answers, progress is kept on this device only.'
          : 'Progress is kept on this device. To move it to another device, or to keep a backup, copy the text below and load it there.';
      sh.appendChild(el('p', 'sm soft', st));
      const out = el('textarea'); out.id = 'save-out'; out.readOnly = true; out.value = encodeSave();
      add(sh, out, add(el('div', 'acts'), btn('Copy', function (b) {
        const lbl = b.querySelector('.lbl'), done = function () { lbl.textContent = 'Copied'; }, manual = function () { out.select(); lbl.textContent = 'Select all, then copy'; };
        try { navigator.clipboard.writeText(out.value).then(done, manual); } catch (e) { manual(); }
      }, 'alt', 'ui.copy')));
      const inp = el('textarea'); inp.id = 'save-in'; inp.placeholder = 'Paste a save here';
      const note = el('p', 'sm bad');
      add(sh, inp, note, add(el('div', 'acts'), btn('Load this save', function () {
        const st2 = decodeSave(inp.value);
        if (!st2) { note.textContent = /^\s*LA1\./.test(inp.value) ? 'That save could not be loaded. Saves from before version 6 follow other rules and cannot be carried over.' : 'That text is not a Long Ascent save. Copy it again in full and retry.'; Snd.play('error'); return; }
        cloud.dirty = true; adopt(st2, 'Save loaded.');
      }, 'alt', 'ui.load')));
      sh.appendChild(el('h2', 'sec', 'Credits'));
      const cr = el('div', 'credits');
      add(cr, el('p', null, 'Icons from game-icons.net by Lorc, Delapouite, Skoll, Caro Asercion, Willdabeast, Lord Berandas, Heavenly Dog and sbed, under CC BY 3.0.'),
        el('p', null, 'Music and sound effects were written for this game and rendered from the FluidR3_GM instrument samples by Frank Wen (via midi-js-soundfonts).'),
        el('p', null, 'Typefaces under the SIL Open Font License: Grenze Gotisch, IM Fell English, Besley, Archivo, Michroma, Source Serif 4 and IBM Plex Sans.'),
        el('p', null, 'Long Ascent, version ' + VERSION + (NATIVE ? ', Android app' : ', web app') + '. The full list is in CREDITS.md in the repository.'));
      sh.appendChild(cr);
      sh.appendChild(el('h2', 'sec', 'Start over'));
      sh.appendChild(el('p', 'sm soft', 'Erases this realm, its legacy and its items.'));
      let armed = false;
      add(sh, add(el('div', 'acts'), btn('Erase everything', function (b) {
        if (!armed) { armed = true; b.querySelector('.lbl').textContent = 'Tap again to erase for good'; return; }
        cloud.dirty = true; view.tab = 'realm'; adopt(C.newState(now()), 'A new realm begins.');
      }, 'alt', 'ui.trash')));
      sh.appendChild(closeRow());
    });
  }
  function askDepart() {
    openSheet(function (sh) {
      sh.appendChild(sheetHead(tile('p.5', 'cap', 'lg'), 'Leave this world', 'The long ascent begins again from a ford and a keep.'));
      add(sh, add(el('div', 'stats'), stat('ui.legacy', '+' + C.legacyGain(S) + ' legacy', 'c-gold'), stat('ui.relic', C.itemCount(S) + (C.itemCount(S) === 1 ? ' item travels with you' : ' items travel with you'))));
      sh.appendChild(el('p', 'sm soft', 'Buildings, landmarks, research, stock, the places found and the heroes of this world stay behind. Legacy buys advantages that last for every world to come.'));
      add(sh, add(el('div', 'acts'), btn('Launch the Ark', function () {
        closeSheet(); const old = JSON.parse(JSON.stringify(S)); const gain = C.depart(S, now());
        if (!gain) return;
        if (city) closeCity();
        Snd.play('depart'); launch = { state: old, t0: now(), gain: gain }; lineup = []; openLog = {}; view.tab = 'legacy'; switched = true; cloud.dirty = true; saveSoon(); step(true);
      }, 'big ready', 'p.5'), btn('Stay for now', function () { closeSheet(); }, 'alt')));
    });
  }
  function turnPage(title, text, icon, ms, instant) {
    const t = $('turn'); t.textContent = '';
    const em = el('div', 'emblem'); em.appendChild(ic(icon));
    add(t, em, el('div', 'big', title), el('p', null, text));
    if (instant) { t.style.transition = 'none'; t.classList.add('on'); void t.offsetWidth; t.style.transition = ''; add(t, el('p', 'sm', 'Tap to begin')); } else t.classList.add('on');
    const hide = function () { t.classList.remove('on'); };
    t.onclick = hide; if (!instant) setTimeout(hide, ms || 3600);
  }
  function enterNextAge() {
    if (!C.advanceAge(S, now())) return;
    Snd.play('ageup'); Snd.setAge(S.age);
    document.documentElement.classList.add('shifting');
    setTimeout(function () { document.documentElement.classList.remove('shifting'); }, 1600);
    turnPage(ageTitle(S.age), C.AGES[S.age].intro, 'age.' + S.age, 4200);
    view.older = false; lineup = []; switched = true; did();
    FX.confetti([getComputedStyle(document.documentElement).getPropertyValue('--trim-hi').trim() || '#ffe9a8', '#ffffff', getComputedStyle(document.documentElement).getPropertyValue('--btn').trim() || '#f4cb5e'], 90);
  }
  function go(tab) { if (view.tab === tab) return; view.tab = tab; switched = true; saveView(); $('panel').scrollTop = 0; render(); }

  /* ---------- the city view ---------- */
  /* The picture at the top, opened to the whole screen. It can be dragged, brought closer with two fingers or a
     double tap, and the things in it can be touched. The game goes on underneath. */
  function redraw() {
    if (drawQueued) return; drawQueued = true;
    requestAnimationFrame(function () { drawQueued = false; if (!document.hidden && !launch) Scene.draw(S, now()); });
  }
  function place(id) {                       // where a part of the picture is on screen, for effects; the whole picture if it is not there
    const at = Scene.where(id), r = $('scene').getBoundingClientRect();
    return at && at.x > 0 && at.x < r.width && at.y > 0 && at.y < r.height ? { clientX: r.left + at.x, clientY: r.top + at.y } : $('scene');
  }
  function rgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
  function tellScene(b) {                    // what the picture needs to know about the game, four times a second
    if (launch) { Scene.facts = {}; return; }                                  // the world being left behind is shown as it was
    const open = C.ageTabOpen(S) && !C.projectDone(S), cost = open ? C.stageCost(S, D) : null, busy = C.has(S, 'heroes') ? C.busy(S) : {}, hc = {};
    for (const id in HC) hc[id] = rgb(HC[id]);
    const marks = {}; C.BUILDINGS.forEach(function (x) { if (S.b[x.id]) marks[x.id] = C.doublings(S, x); });
    const sites = {}; C.DISCOVERIES.forEach(function (z) { if (z.kind === 'site' && S.disc[z.id]) sites[z.id] = S.disc[z.id]; });
    Scene.facts = {
      rank: S.rank, marks: marks, lm: Object.keys(S.lm), lmOpen: C.LANDMARKS.filter(function (l) { return C.landmarkState(S, l) === 'open'; }).map(function (l) { return l.id; }),
      sites: sites, news: !!S.ev.cur, jobs: S.rank >= 2 ? S.jobs : null, building: open ? D.work : 0, routes: Object.keys(S.disc).filter(function (id) { return S.disc[id] === 2 && C.DISCOVERY[id].kind === 'route'; }).length, kept: Math.min(C.citySlots(S), C.itemsKept(S).length),
      projectOpen: open, stageReady: !!(cost && C.stageReady(S, D)), trial: C.trialOpen(S) && !S.trialWon[S.age], edicts: C.has(S, 'edicts'),
      plots: C.BUILDINGS.filter(function (x) { return x.age === S.age && C.buildingVisible(S, x) && !C.count(S, x.id); }).map(function (x) { return x.id; }),
      home: C.has(S, 'heroes') ? Object.keys(S.heroes).filter(function (id) { return !busy[id]; }) : [], hc: hc, kn: !!b.tree, heroMark: !!b.heroes
    };
  }
  function openCity() {
    if (city || launch) return;
    city = true; document.documentElement.classList.add('city'); $('cityui').hidden = false;
    Scene.city(true, parseFloat(getComputedStyle($('tabs')).paddingBottom) || 0);
    cityStep = pushStep(); Snd.play('open'); feedSig = ''; drawFeed(); redraw();
    if (!S.seen.city) {                      // said once: how to move about
      S.seen.city = 1;
      const h = el('div', null, 'Drag to look around. Pinch or double tap to come closer. Tap a building to act.'); h.id = 'cityhint'; $('cityui').appendChild(h);
      setTimeout(function () { h.classList.add('off'); }, 6000); setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 7000);
    }
  }
  function closeCity(fromBack) {
    if (!city) return;
    if (!$('modal').hidden) closeSheet();    // a card over the city goes first: its step lies on top of the city's
    city = false; document.documentElement.classList.remove('city'); $('cityui').hidden = true; Scene.city(false);
    if (cityStep) { cityStep = false; if (fromBack !== true) dropStep(); }
    redraw();
  }
  function feedLines() {                     // what is going on, in a few words: icon, text, the place it belongs to, whether it calls for action
    const L = [], t = now(), F = Scene.facts || {};
    if (C.canAdvance(S)) L.push(['age.' + (S.age + 1), ageTitle(S.age + 1) + ' awaits', 'work:' + S.age, 1]);
    else if (C.canDepart(S)) L.push(['p.5', 'The Ark is ready', 'work:5', 1]);
    else if (C.ageTabOpen(S) && !C.projectDone(S) && C.stageCost(S, D)) {
      const pr = C.PROJECTS[S.age], c = C.stageCost(S, D), need = C.stageWork(S); let f = need ? Math.min(1, S.work / need) : 1; for (const r in c) f = Math.min(f, S.res[r] / c[r]);
      const ok = C.stageReady(S, D);
      L.push(['p.' + S.age, short(pr.name) + ', ' + pr.stages[S.project].toLowerCase() + ': ' + (ok ? 'ready to build' : Math.floor(100 * Math.max(0, Math.min(0.99, f))) + '%'), 'work:' + S.age, ok ? 1 : 0]);
    }
    if (S.ev.cur) { const v = C.eventView(S, t); if (v) L.push(['ui.news', v.name, 'news', 1]); }
    (F.lmOpen || []).slice(0, 2).forEach(function (id) { const l = C.LANDMARK[id]; L.push(['lm.' + id, l.name + ': can be built', 'lm:' + id, C.canPay(S, C.landmarkCost(l)) ? 1 : 0]); });
    Object.keys(F.sites || {}).filter(function (id) { return F.sites[id] === 1; }).slice(0, 1).forEach(function (id) { const z = C.DISCOVERY[id]; L.push(['d.' + id, z.build + ': can be built', 'post:' + id, C.canPay(S, C.outpostCost(id)) ? 1 : 0]); });
    if (S.rank >= 2 && S.jobs.idle > 0) L.push(['ui.people', 'People are idle', 'jobs', 1]);
    if (C.activeGoals(S).some(function (g) { return C.goalState(S, g).done; })) L.push(['ui.goal', 'A goal is reached', 'goals', 1]);
    if (F.trial && !S.parties.some(function (p) { return p.m === 'trial' + S.age; })) L.push(['m.trial' + S.age, short(C.TRIALS[S.age].name) + ' bars the way', 'trial', 0]);
    S.parties.forEach(function (p) { L.push(['m.' + p.m, C.MISSION[p.m].name + ': ' + (t >= p.t1 ? 'returning' : fmtTime((p.t1 - t) / 1000)), 'keep', 0]); });
    if (S.reports.length) L.push(['tab.heroes', S.reports.length === 1 ? 'One party has returned' : S.reports.length + ' parties have returned', 'keep', 1]);
    if (F.edicts) { const on = S.edict && S.edict.until > t; L.push(['ui.edict', on ? C.EDICT[S.edict.id].name + ' ' + fmtTime((S.edict.until - t) / 1000) : 'Proclaim an edict', 'edict', on ? 0 : 1]); }
    if (F.kn) L.push(['tab.council', 'Research is waiting', 'tree', 1]);
    (F.plots || []).slice(0, 2).forEach(function (id) { const b = C.B[id]; L.push(['b.' + id, b.name + ': not built yet', 'b:' + id, C.canPay(S, C.buildCost(b, 0, 1)) ? 1 : 0]); });
    L.sort(function (a, b) { return b[3] - a[3]; });       // what can be done now comes first
    return L.slice(0, 7);
  }
  function drawFeed() {
    const box = $('feed'), L = feedLines(), sig = L.map(function (l) { return l[0] + l[2] + l[3]; }).join('|');
    if (sig !== feedSig) {
      feedSig = sig; box.textContent = '';
      L.forEach(function (l) {
        const t = tag(l[0], l[1], function () {
          if (l[2] === 'tree' || l[2] === 'jobs' || l[2] === 'goals') { Snd.play('tap'); goTab(l[2] === 'tree' ? 'tree' : l[2] === 'jobs' ? 'town' : 'realm'); }
          else if (l[2] === 'news') eventSheet();
          else { Scene.look(l[2]); redraw(); citySite(l[2]); }
        });
        if (l[3]) t.classList.add('go');
        t.dataset.feed = l[2]; box.appendChild(t);
      });
    } else L.forEach(function (l, i) { setText(box.children[i].lbl, l[1]); });
  }
  function buildingSheet(b) {
    openSheet(function (sh) {
      sh.appendChild(el('p', 'sm soft', b.desc));
      sh.appendChild(sec(C.count(S, b.id) ? 'Build more' : 'Not built yet', seg([[1, 'x1'], [10, 'x10'], ['max', 'Max']], view.qty, function (v) { view.qty = v; saveView(); render(); buildingSheet(b); })));
      const row = el('div', 'marks');
      b.marks.forEach(function (name, i) { const have = C.doublings(S, b) > i; row.appendChild(add(el('span', 'mk' + (have ? ' on' : '')), ic(have ? 'ui.check' : 'ui.lock'), el('span', null, name + ' ' + C.MILESTONES[i]))); });
      sh.appendChild(row);
      sh.appendChild(inSheet(function () { return buildingCard(b); }));
      sh.appendChild(closeRow());
    }, !$('modal').hidden);
  }
  function projectSheet() {
    openSheet(function (sh) { sh.appendChild(inSheet(projectCard)); sh.appendChild(closeRow()); });
  }
  function keepSheet() {
    if (!C.has(S, 'heroes')) { info('The keep', 'tab.realm', 'civ', ['It has watched the ford since before the first field was cut.', 'Heroes will answer once a watchtower stands in the town. Research the Oath of watch to learn how to build one.']); return; }
    openSheet(function (sh) {
      const free = Object.keys(S.heroes).length - Object.keys(C.busy(S)).length;
      sh.appendChild(sheetHead(tile('tab.heroes', 'arm', 'lg'), 'The heroes', free ? free + (free === 1 ? ' hero is' : ' heroes are') + ' at home.' : 'Everyone is away.'));
      inSheet(function () { S.parties.forEach(function (pt) { sh.appendChild(partyCard(pt)); }); });
      if (S.reports.length) sh.appendChild(el('div', 'hint', S.reports.length === 1 ? 'A party has returned and waits to report.' : S.reports.length + ' parties have returned and wait to report.'));
      sh.appendChild(add(el('div', 'acts'), btn('To the heroes', function () { Snd.play('tap'); goTab('heroes'); }, 'big', 'tab.heroes'), btn('Close', function () { closeSheet(); }, 'alt big')));
    });
  }
  function citySite(id) {                    // something in the picture was touched
    if (!id) return;
    if (id.slice(0, 2) === 'b:') { buildingSheet(C.B[id.slice(2)]); return; }
    if (id.slice(0, 5) === 'work:') {
      const a = +id.slice(5);
      if (a === S.age && C.ageTabOpen(S)) projectSheet(); else info(C.PROJECTS[a].name, 'p.' + a, 'cap', [C.PROJECTS[a].done, 'A great work of the ' + C.AGES[a].name + '. It stands for as long as this world lasts.']);
      return;
    }
    if (id === 'keep' || id === 'heroes') keepSheet();
    else if (id === 'trial') infoMission(C.MISSION['trial' + S.age]);
    else if (id === 'edict') edictSheet();
    else if (id === 'town') rankSheet();
    else if (id === 'news') eventSheet();
    else if (id.slice(0, 3) === 'lm:' && C.LANDMARK[id.slice(3)]) landmarkSheet(C.LANDMARK[id.slice(3)]);
    else if (id.slice(0, 5) === 'post:' && C.DISCOVERY[id.slice(5)]) postSheet(C.DISCOVERY[id.slice(5)]);
  }
  function cityTouch() {                     // one finger moves the view, two change how close it is, a tap picks
    const cv = $('scene'), pts = new Map();
    let moved = 0, t0 = 0, lastTap = 0, lastX = 0, lastY = 0, pinch = null;
    const pos = function (e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', function (e) {
      if (!city) return;
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* not every browser */ }
      pts.set(e.pointerId, pos(e)); pinch = null;
      if (pts.size === 1) { moved = 0; t0 = now(); }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!city || !pts.has(e.pointerId)) return;
      const was = pts.get(e.pointerId), p = pos(e);
      pts.set(e.pointerId, p);
      if (pts.size === 1) { Scene.pan(p.x - was.x, p.y - was.y); moved += Math.abs(p.x - was.x) + Math.abs(p.y - was.y); }
      else if (pts.size === 2) {
        const a = Array.from(pts.values()), d = Math.max(1, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
        if (pinch) { Scene.zoomBy(d / pinch.d, mx, my); Scene.pan(mx - pinch.x, my - pinch.y); }
        pinch = { d: d, x: mx, y: my }; moved += 99;
      }
      redraw();
    });
    const up = function (e) { pts.delete(e.pointerId); pinch = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) { if (!city) return; e.preventDefault(); const p = pos(e); Scene.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y); redraw(); }, { passive: false });
    /* Taps are read from the click, which arrives after the finger has lifted: a sheet opened any earlier would
       receive that same click on its backdrop and close again. */
    cv.addEventListener('click', function (e) {
      if (!city) { openCity(); return; }
      if (moved > 12 || now() - t0 > 700) return;
      const p = pos(e), id = Scene.pick(p.x, p.y);
      if (id) { lastTap = 0; citySite(id); return; }
      if (now() - lastTap < 340 && Math.hypot(p.x - lastX, p.y - lastY) < 44) { lastTap = 0; const c = Scene.camera(); Scene.zoomTo(c.z > c.home * 1.3 ? c.home : c.home * 1.9, p.x, p.y); redraw(); }
      else { lastTap = now(); lastX = p.x; lastY = p.y; }
    });
    $('expand').appendChild(ic('ui.expand')); $('expand').addEventListener('click', openCity);
    $('cityclose').appendChild(ic('ui.shrink')); $('cityclose').addEventListener('click', function () { Snd.play('tap'); closeCity(); });
    $('cityzoom').appendChild(ic('ui.zoom'));
    $('cityzoom').addEventListener('click', function () {      // three steps: the usual view, close up, the whole city
      const c = Scene.camera(), r = cv.getBoundingClientRect(), next = c.z > c.home * 1.3 ? c.min : c.z < c.home * 0.8 ? c.home : c.home * 1.9;
      Snd.play('tap'); Scene.zoomTo(next, r.width / 2, r.height * 0.7); redraw();
    });
  }

  /* ---------- what things promise and what came of them ---------- */
  function oneDec(v) { return String(Math.round(v * 10) / 10); }
  function promiseBox(list) {                // the outcomes of a choice, as chips
    const box = el('div', 'promise'), row = el('div', 'stats');
    list.forEach(function (o) {
      if (o.k === 'gain') row.appendChild(stat('res.' + o.res, '+' + fmt(o.v), 'c-' + o.res));
      else if (o.k === 'pay' || o.k === 'lose') { if (o.v > 0) { const st = stat('res.' + o.res, '−' + fmt(o.v), 'c-' + o.res); st.classList.add('neg'); row.appendChild(st); } }
      else if (o.k === 'people') row.appendChild(stat('ui.settler', '+' + C.fmtInt(o.v) + ' people'));
      else if (o.k === 'work') row.appendChild(stat('job.work', '+' + oneDec(o.v) + ' work on the ' + short(C.PROJECTS[S.age].name).toLowerCase()));
      else if (o.k === 'xp') row.appendChild(stat('ui.xp', 'Every hero trains for ' + hours(o.v)));
      else if (o.k === 'boost') row.appendChild(stat('res.' + o.res, '+' + Math.round((o.m - 1) * 100) + '% ' + C.RES_NAME[o.res].toLowerCase() + ' for ' + hours(o.h), 'c-' + o.res));
      else if (o.k === 'luck') row.appendChild(stat(o.ok ? 'ui.check' : 'ui.loss', o.ok ? 'It went well' : 'It went badly', o.ok ? 'good' : 'bad'));
    });
    if (row.firstChild) box.appendChild(row);
    list.forEach(function (o) {
      if (o.k !== 'risk') return;
      const win = promiseBox(o.win), lose = promiseBox(o.lose);
      add(box, add(el('div', 'odds2'), tag('ui.luck', Math.round(o.p * 100) + ' in 100'), win.firstChild ? win : el('span', 'sm soft', 'nothing is lost')),
        add(el('div', 'odds2'), tag('ui.loss', 'otherwise'), lose.firstChild ? lose : el('span', 'sm soft', 'nothing more')));
    });
    return box;
  }
  function rankIcon(r) { return 'rank.' + Math.min(10, Math.max(1, r)); }
  function peopleText(n) { return C.fmtInt(n) + ' people'; }

  /* ---------- news: something happened in the town and waits for a decision ---------- */
  function eventSheet() {
    const v = C.eventView(S, now());
    if (!v) return;
    openSheet(function (sh) {
      sh.appendChild(sheetHead(tile('ev.' + v.id, 'civ', 'lg'), v.name, v.text));
      v.choices.forEach(function (c, i) {
        const card = el('div', 'card'), b = btn(c.label, function (bt) {
          const out = C.answerEvent(S, i, now());
          if (!out) { Snd.play('error'); FX.shake(bt); return; }
          Snd.play('edict'); Scene.emit('news'); eventResult(v, c, out); did();
        }, 'big');
        b.disabled = !c.ok; b.dataset.act = 'event:' + i;
        add(card, promiseBox(c.promise), c.ok ? null : el('div', 'sm bad', 'There is not enough in the stores for this.'), add(el('div', 'acts'), b));
        sh.appendChild(card);
      });
      sh.appendChild(add(el('div', 'acts'), btn('Decide later', function () { closeSheet(); }, 'alt big')));
    });
  }
  function eventResult(v, c, out) {
    openSheet(function (sh) {
      sh.appendChild(sheetHead(tile('ev.' + v.id, 'civ', 'lg'), v.name, c.label + '.'));
      const box = promiseBox(out);
      sh.appendChild(box.firstChild ? box : el('p', 'sm soft', 'Nothing more came of it.'));
      sh.appendChild(el('p', 'sm soft', 'More news will reach the town before long.'));
      sh.appendChild(add(el('div', 'acts'), btn('Continue', function (b) {
        Snd.play('collect');
        out.forEach(function (o) { if (o.k === 'gain') FX.fly(b, $('col-' + o.res), { n: 5, color: RC[o.res], rim: 'rgba(0,0,0,.45)' }, function () { FX.bump($('col-' + o.res)); }); });
        closeSheet();
      }, 'big ready', 'ui.chest')));
    }, true);
  }
  function eventCard() {                     // the call on the Realm and Town panels
    const v = C.eventView(S, now()), card = el('div', 'card row feature');
    const b = btn('Hear it', function () { eventSheet(); }, 'ready'); b.dataset.act = 'event';
    add(card, tile('ev.' + v.id, 'civ', '', function () { eventSheet(); }), add(el('div', 'mid'), add(el('div', 'stats'), tag('ui.news', 'News')), el('div', 'name', v.name)), b);
    return card;
  }

  /* ---------- goals ---------- */
  function goalsBox(p) {
    const gs = C.activeGoals(S);
    if (!gs.length) return;
    p.appendChild(sec('Goals', el('span', 'sm soft num', (S.stats.claimed || 0) + ' reached')));
    const box = el('div', 'goals');
    gs.forEach(function (g) {
      const st = C.goalState(S, g), row = el('div', 'goal' + (st.done ? ' done' : '')), prog = el('span', 'sm soft num'), cv = costView(true);
      const b = el('button', 'btn buy'), q = el('span', 'q', st.done ? 'Claim' : 'Reward');
      b.type = 'button'; b.dataset.act = 'goal:' + g.id; b.disabled = !st.done; if (st.done) b.classList.add('ready'); add(b, q, cv.el);
      b.addEventListener('click', function () {
        const r = C.claimGoal(S, g.id, now());
        if (!r) { Snd.play('error'); FX.shake(b); return; }
        Snd.play('collect'); FX.float(b, '+' + fmt(r.v), { color: RC[r.res], icon: ic('res.' + r.res), dy: -30 });
        FX.fly(b, $('col-' + r.res), { n: 6, color: RC[r.res], rim: 'rgba(0,0,0,.45)' }, function () { FX.bump($('col-' + r.res)); });
        did();
      });
      add(row, add(el('span', 'gi'), ic(st.done ? 'ui.check' : g.icon)), add(el('div', 'mid'), el('div', 'gt', g.text), g.of > 1 ? prog : null), b);
      live.push(function () {
        const now2 = C.goalState(S, g), r = C.goalReward(S, g, D), c = {}; c[r.res] = r.v;
        cv.set(c); cv.el.querySelectorAll('.short').forEach(function (x) { x.classList.remove('short'); });
        if (g.of > 1) setText(prog, C.fmtInt(now2.cur) + ' of ' + g.of);
      });
      box.appendChild(row);
    });
    p.appendChild(box);
  }
  function goalSig() { return C.activeGoals(S).map(function (g) { return g.id + (C.goalState(S, g).done ? '!' : ''); }).join(); }

  /* ---------- the town: rank, people, landmarks ---------- */
  function rankSheet() {
    openSheet(function (sh) {
      const pop = C.people(S);
      sh.appendChild(sheetHead(tile(rankIcon(S.rank), 'civ', 'lg'), 'The town', peopleText(pop) + ' live here.'));
      sh.appendChild(el('p', 'sm soft', 'Every building brings people. So do named buildings, landmarks, stages of the great work, roads and outposts.'));
      const list = el('div', 'stages');
      for (let r = 1; r < C.RANKS.length; r++) {
        const R = C.RANKS[r], row = el('div', 'stage rk' + (r <= S.rank ? ' done' : r === S.rank + 1 ? ' now' : '')), m = el('div', 'nm');
        add(m, el('div', null, R.name + (r > S.rank ? ', ' + peopleText(C.TUNE.rank[r]) : '')));
        if (r <= S.rank) m.appendChild(el('div', 'sm soft', R.text));
        else C.rankOpens(r).forEach(function (t) { m.appendChild(el('div', 'sm soft', t)); });
        add(row, ic(r <= S.rank ? 'ui.check' : rankIcon(r)), m);
        list.appendChild(row);
      }
      add(sh, list, closeRow());
    });
  }
  function rankCard() {
    const card = el('div', 'card feature'), mid = el('div', 'mid'), nm = el('div', 'name bigname'), ppl = el('div', 'sm soft num'), bar = el('div', 'bar'), fill = el('i'), nx = el('span', 'sm soft num'), opens = el('div', 'opens');
    bar.appendChild(fill);
    add(card, add(el('div', 'head'), tile(rankIcon(S.rank), 'civ', 'lg', rankSheet), add(mid, nm, ppl)), add(el('div', 'barrow gap'), bar, nx), opens);
    if (S.rank < C.RANKS.length - 1) {
      add(opens, el('div', 'sm', 'As a ' + C.RANKS[S.rank + 1].name.toLowerCase() + ':'));
      C.rankOpens(S.rank + 1).forEach(function (t) { opens.appendChild(add(el('div', 'sm soft open1'), ic('ui.lock'), el('span', null, t))); });
    } else opens.appendChild(el('div', 'sm soft', 'No town has ever been larger.'));
    live.push(function () {
      const pop = C.people(S), next = S.rank < C.RANKS.length - 1 ? C.TUNE.rank[S.rank + 1] : 0, prev = C.TUNE.rank[S.rank] || 0;
      setText(nm, C.RANKS[S.rank].name); setText(ppl, peopleText(pop));
      fill.style.width = (next ? Math.round(100 * Math.max(0, Math.min(1, (pop - prev) / (next - prev)))) : 100) + '%';
      setText(nx, next ? C.RANKS[S.rank + 1].name + ' at ' + C.fmtInt(next) : '');
    });
    return card;
  }
  function jobsBox(p) {
    p.appendChild(sec('The people', el('span', 'sm soft', 'in tenths')));
    if (S.rank < 2) { p.appendChild(el('div', 'hint', 'A hamlet has no hands to spare. As a village, the people can be set to tasks: fields, woods, books and the great work.')); return; }
    const box = el('div', 'jobs card'), idle = el('div', 'idle sm');
    const KINDS = { gold: 'gold', mat: 'mat', kn: 'kn', work: 'cap' };
    ['gold', 'mat', 'kn', 'work'].forEach(function (job) {
      const row = el('div', 'job'), n = el('b', 'num'), fx = el('div', 'sm soft'), pp = el('span', 'pips'), minus = el('button', 'step', '−'), plus = el('button', 'step', '+');
      for (let i = 0; i < 10; i++) pp.appendChild(el('i'));
      minus.type = plus.type = 'button'; minus.setAttribute('aria-label', 'Fewer on ' + C.jobName(job, S.age)); plus.setAttribute('aria-label', 'More on ' + C.jobName(job, S.age)); plus.dataset.act = 'job+:' + job; minus.dataset.act = 'job-:' + job;
      const move = function (from, to, bt) { if (!C.moveJob(S, from, to)) { Snd.play('error'); FX.shake(bt); return; } Snd.play('tap'); did(); };
      minus.addEventListener('click', function () { move(job, 'idle', minus); });
      plus.addEventListener('click', function () { move('idle', job, plus); });
      add(row, tile('job.' + job, KINDS[job], 'sm'), add(el('div', 'mid'), add(el('div', 'line'), el('div', 'name', C.jobName(job, S.age)), pp), fx), add(el('div', 'stepper'), minus, n, plus));
      live.push(function () {
        const v = S.jobs[job] || 0, open = job !== 'work' || (C.worksOpen(S) && S.work < C.stageWork(S));
        setText(n, String(v)); for (let i = 0; i < 10; i++) pp.children[i].className = i < v ? 'on' : '';
        minus.disabled = v < 1; plus.disabled = !(S.jobs.idle > 0) || !open; plus.classList.toggle('call', S.jobs.idle > 0 && open);
        if (job === 'work') setText(fx, !C.worksOpen(S) ? 'No great work is being raised.' : S.work >= C.stageWork(S) ? 'The work for this stage is done.' : oneDec(D.work) + ' work an hour, ' + oneDec(S.work) + ' of ' + C.stageWork(S) + ' done');
        else setText(fx, '+' + Math.round(D.jp * v * 100) + '% ' + C.RES_NAME[job].toLowerCase());
      });
      box.appendChild(row);
    });
    box.appendChild(idle);
    live.push(function () { const v = S.jobs.idle || 0; idle.style.display = v ? '' : 'none'; setText(idle, v === 1 ? 'One tenth of the people is idle. Tap + to give it a task.' : v + ' tenths of the people are idle. Tap + to give them a task.'); });
    p.appendChild(box);
    p.appendChild(el('div', 'sm soft pad', 'Each tenth adds ' + Math.round(C.jobPower(S.rank) * 100) + '% to its task. Take people from one task with −, then give them to another with +.'));
  }
  function landmarkSheet(l) {
    openSheet(function (sh) {
      const st = C.landmarkState(S, l), kind = fxKind(l.fx), t = C.TECH[l.tech];
      sh.appendChild(sheetHead(tile('lm.' + l.id, st === 'locked' ? 'dim' : kind, 'lg'), l.name, add(el('div', 'stats'), tag('age.' + l.age, C.AGES[l.age].name), tag('ui.star', 'Landmark'))));
      add(sh, el('p', null, l.desc), el('p', 'sm soft', l.text));
      if (st === 'built') { add(sh, add(el('div', 'stats'), stat('ui.check', 'Built', 'good')), closeRow()); return; }
      const needs = el('div', 'needs');
      needs.appendChild(needLine('Research: ' + t.name, !!S.tech[t.id]));
      if (l.rank) needs.appendChild(needLine('A ' + C.RANKS[l.rank].name.toLowerCase() + ' (' + peopleText(C.TUNE.rank[l.rank]) + ')', S.rank >= l.rank));
      sh.appendChild(needs);
      const cv = costView(false), b = btn('Build', function (bt) {
        if (!C.buildLandmark(S, l.id, now())) { Snd.play('error'); FX.shake(bt); return; }
        closeSheet(); built(l); did();
      }, 'big', 'ui.up');
      b.dataset.act = 'lm:' + l.id;
      add(sh, add(el('div', 'line cost-line'), cv.el), add(el('div', 'acts'), b));
      if (st === 'locked' && C.techOpen(S, t)) sh.appendChild(add(el('div', 'acts'), btn('To research', function () { Snd.play('tap'); goTab('tree'); }, 'alt big', 'tab.council')));
      sh.appendChild(closeRow());
      sheetLive.push(function () { const c = C.landmarkCost(l), ok = C.landmarkState(S, l) === 'open' && C.canPay(S, c); cv.set(c); b.disabled = !ok; b.classList.toggle('ready', ok); });
    }, !$('modal').hidden);
  }
  function built(l) {                        // a landmark has just gone up
    const at = place('lm:' + l.id);
    Snd.play('stage'); FX.burst(at, { n: 36, color: ['#ffe9a8', '#ffffff', KIND_COLOR[fxKind(l.fx)] || '#f4cb5e'], speed: 240, life: 1, size: 4 }); FX.ring(at, '#fff3c4', 110, 5);
    Scene.emit('lm', l.id);
    toast(l.fx.type === 'unlock' && l.fx.what === 'heroes' ? 'The Watchtower is built. The Warden has sworn the oath, and Heroes are open.' : 'The ' + l.name + ' is built. ' + l.desc);
  }
  function landmarkCard(l) {
    const st = C.landmarkState(S, l), kind = fxKind(l.fx), card = el('div', 'card row' + (st === 'locked' || st === 'rank' ? ' shadow' : '')), mid = el('div', 'mid');
    add(mid, el('div', 'name', l.name), el('div', 'sm soft', l.desc));
    let side = null;
    if (st === 'built') side = stat('ui.check', 'Built', 'good');
    else if (st === 'open') {
      const b = el('button', 'btn buy'), cv = costView(true); b.type = 'button'; b.dataset.act = 'lm:' + l.id; add(b, el('span', 'q', 'Build'), cv.el);
      b.addEventListener('click', function () { if (!C.buildLandmark(S, l.id, now())) { Snd.play('error'); FX.shake(b); return; } built(l); did(); });
      live.push(function () { const c = C.landmarkCost(l), ok = C.canPay(S, c); cv.set(c); b.disabled = !ok; b.classList.toggle('ready', ok); });
      side = b;
    } else if (st === 'rank') mid.appendChild(add(el('div', 'stats'), tag(rankIcon(l.rank), 'Needs a ' + C.RANKS[l.rank].name.toLowerCase(), rankSheet)));
    else mid.appendChild(add(el('div', 'stats'), tag('tab.council', 'Learned from ' + C.TECH[l.tech].name.toLowerCase(), function () { techSheet(C.TECH[l.tech]); })));
    add(card, tile('lm.' + l.id, st === 'locked' ? 'dim' : kind, '', function () { landmarkSheet(l); }), mid, side);
    return card;
  }
  function chronicleSheet() {
    openSheet(function (sh) {
      const ch = C.chronicle(S);
      sh.appendChild(sheetHead(tile('ui.book', 'kn', 'lg'), 'Chronicle', ch.have + ' of ' + ch.of + ' pages written'));
      ch.chapters.forEach(function (c, ci) {
        const open = openChap[ci] === undefined ? (c.age ? c.age === S.age : false) : openChap[ci], hidden = c.age > S.age;
        const hd = el('button', 'chap' + (open ? ' on' : '')); hd.type = 'button';
        add(hd, el('span', null, c.title), el('span', 'sm soft num', c.have + ' of ' + c.pages.length));
        hd.addEventListener('click', function () { Snd.play('tap'); openChap[ci] = !open; const top = $('sheet').scrollTop; chronicleSheet(); $('sheet').scrollTop = top; });
        sh.appendChild(hd);
        if (!open) return;
        const list = el('div', 'pages');
        c.pages.forEach(function (pg) {
          const row = el('div', 'page' + (pg.have ? '' : ' blank'));
          add(row, tile(pg.have ? pg.icon : 'ui.lock', pg.have ? 'cap' : 'dim', 'sm'), add(el('div', 'mid'), el('div', 'name', pg.have || !hidden ? pg.name : 'Not yet known'), el('div', 'sm soft', pg.have ? pg.note : hidden ? 'It belongs to an age you have not reached.' : pg.hint)));
          list.appendChild(row);
        });
        sh.appendChild(list);
      });
      sh.appendChild(closeRow());
    }, !$('modal').hidden);
  }
  function panelTown(p) {
    if (S.seen.rank !== S.rank) { S.seen.rank = S.rank; }
    if (S.ev.cur) p.appendChild(eventCard());
    p.appendChild(rankCard());
    jobsBox(p);
    p.appendChild(sec('Landmarks', el('span', 'sm soft num', Object.keys(S.lm).length + ' of ' + C.LANDMARKS.length)));
    C.LANDMARKS.forEach(function (l) { if (l.age === S.age) p.appendChild(landmarkCard(l)); });
    const old = C.LANDMARKS.filter(function (l) { return l.age < S.age; });
    if (old.length) {
      old.forEach(function (l) { if (!S.lm[l.id]) p.appendChild(landmarkCard(l)); });
      const g = el('div', 'relics');
      old.forEach(function (l) { if (S.lm[l.id]) g.appendChild(tile('lm.' + l.id, fxKind(l.fx), 'sm', function () { landmarkSheet(l); })); });
      if (g.firstChild) { p.appendChild(el('div', 'sm soft pad', 'Standing from earlier ages:')); p.appendChild(g); }
    }
    if (S.age < 5) {
      const nx = C.LANDMARKS.filter(function (l) { return l.age === S.age + 1; }), g = el('div', 'relics');
      nx.forEach(function (l) { g.appendChild(tile('lm.' + l.id, 'dim', 'sm', function () { landmarkSheet(l); })); });
      p.appendChild(el('div', 'sm soft pad', 'In the ' + C.AGES[S.age + 1].name + ': ' + nx.map(function (l) { return l.name; }).join(', ') + '.')); p.appendChild(g);
    }
    p.appendChild(el('h2', 'sec', 'Chronicle'));
    const ch = C.chronicle(S), cc = el('div', 'card row'), cb = btn('Open', function () { chronicleSheet(); }, 'alt'); cb.dataset.act = 'chronicle';
    add(cc, tile('ui.book', 'kn', '', function () { chronicleSheet(); }), add(el('div', 'mid'), el('div', 'name', ch.have + ' of ' + ch.of + ' pages'), el('div', 'sm soft', 'Everything there is to raise, build, find and beat.')), cb);
    p.appendChild(cc);
  }

  /* ---------- realm ---------- */
  function infoStore() {
    info('Storehouses', 'ui.store', 'log', ['While the game is closed, your buildings keep working until the storehouses are full.',
      add(el('div', 'stats'), stat('ui.clock', 'They hold ' + hours(D.storeH) + ' of output')),
      'Research, one doctrine and a legacy advantage make them deeper.']);
  }
  function edictSheet() {
    openSheet(function (sh) {
      sh.appendChild(sheetHead(tile('ui.edict', 'civ', 'lg'), 'Edicts', 'One at a time. Each lasts ' + D.edictH + ' hours.'));
      C.EDICTS.forEach(function (e) {
        const on = S.edict && S.edict.id === e.id && S.edict.until > now(), card = el('div', 'card row' + (on ? ' feature' : ''));
        add(card, tile('e.' + e.id, fxKind(e.fx)), add(el('div', 'mid'), el('div', 'name', e.name), el('div', 'sm soft', e.desc)),
          btn(on ? 'Renew' : 'Proclaim', function () {
            if (!C.setEdict(S, e.id, now())) return;
            closeSheet(); Snd.play('edict'); toast(e.name + ' is proclaimed.'); Scene.emit('edict'); did();
            const t = document.querySelector('[data-act="edict"]'); if (t) sparkle(t, fxKind(e.fx));
          }, on ? 'alt' : ''));
        sh.appendChild(card);
      });
      sh.appendChild(closeRow());
    });
  }
  function infoBuilding(b) {
    const n = C.count(S, b.id), u = C.unitRate(S, D, b), next = C.nextMark(S, b), rows = el('div', 'stages');
    b.marks.forEach(function (name, i) {
      const have = C.doublings(S, b) > i, need = C.markNeed(b, i), row = el('div', 'stage' + (have ? ' done' : next && next.i === i ? ' now' : ''));
      add(row, ic(have ? 'ui.check' : 'ui.lock'), add(el('span', 'nm'), el('div', null, name), need && !S.tech[need] ? el('div', 'sm soft', 'Needs ' + C.TECH[need].name.toLowerCase()) : null), el('span', 'sm soft num', 'at ' + C.MILESTONES[i]));
      rows.appendChild(row);
    });
    info(b.name, 'b.' + b.id, b.res, [b.desc,
      add(el('div', 'stats'), stat('res.' + b.res, fmtC(u) + '/s each', 'c-' + b.res), n ? stat('res.' + b.res, fmtC(u * n) + '/s in all', 'c-' + b.res) : null, stat('ui.settler', C.PEOPLE[b.age] + ' people each')),
      'As they grow in number they raise four named buildings. Each one doubles what every ' + b.name.toLowerCase() + ' produces.', rows,
      'Beyond ' + C.MILESTONES[C.NAMED - 1] + ', further doublings come at ' + C.MILESTONES.slice(C.NAMED).join(', ') + '.']);
  }
  function infoProject() {
    const pr = C.PROJECTS[S.age];
    info(pr.name, 'p.' + S.age, 'cap', ['The great work of this age. It is built in ' + pr.stages.length + ' stages, and each one appears in the settlement above.',
      'A stage needs gold and materials, and it needs work. A standing crew gives one work an hour. Every tenth of the people you set to the great work in Town gives one more.',
      'When it is finished and the trial of the age is won, the next age begins.']);
  }
  function workCard() {
    const card = el('div', 'card work');
    const b = btn('Work the land', function (bt, ev) {
      const g = C.work(S, now()), from = ev && (ev.clientX || ev.clientY) ? ev : bt;
      Snd.play('coin', { rate: 0.94 + Math.random() * 0.14 });
      FX.float(from, '+' + fmtC(g), { color: RC.gold, icon: ic('res.gold'), dy: -30 });
      FX.fly(from, $('col-gold'), { n: 1, size: 7 }, function () { FX.bump($('col-gold')); });
      Scene.emit('work'); did();
    }, 'ready', 'ui.work');
    b.dataset.act = 'work';
    add(card, b, el('div', 'sm soft', S.b.farm ? 'Keep working until the farmsteads carry the settlement.' : 'No coin yet. Work by hand until the first farmstead stands.'));
    return card;
  }
  function projectCard() {
    const pr = C.PROJECTS[S.age], card = el('div', 'card feature'), mid = el('div', 'mid');
    if (C.canAdvance(S)) {
      const b = btn('Enter the ' + C.AGES[S.age + 1].name, function () { if (!$('modal').hidden) closeSheet(); enterNextAge(); }, 'big ready', 'ui.climb'); b.dataset.act = 'advance';
      add(card, add(el('div', 'head'), tile('age.' + (S.age + 1), 'cap', 'lg'), add(mid, el('div', 'name', pr.done), el('div', 'sm soft', C.TRIALS[S.age].name + ' is defeated.'))), add(el('div', 'acts'), b));
    } else if (C.canDepart(S)) {
      const b = btn('Launch the Ark', askDepart, 'big ready', 'p.5'); b.dataset.act = 'depart';
      add(card, add(el('div', 'head'), tile('p.5', 'cap', 'lg'), add(mid, el('div', 'name', 'The Ark stands fuelled'), el('div', 'sm soft', 'The launch corridor is clear.'))), add(el('div', 'acts'), b));
    } else if (C.projectDone(S)) {
      const tr = C.TRIALS[S.age];
      add(card, add(el('div', 'head'), tile('m.trial' + S.age, 'boss', 'lg', function () { infoMission(C.MISSION['trial' + S.age]); }), add(mid, el('div', 'name', tr.name), el('div', 'sm soft', pr.done + ' One enemy still bars the way.'))));
      if (view.tab !== 'heroes' || city) add(card, add(el('div', 'acts'), btn('To the heroes', function () { Snd.play('tap'); goTab('heroes'); }, 'alt big', 'tab.heroes')));
    } else {
      const cv = costView(false), bar = el('div', 'bar'), fill = el('i'), eta = el('span', 'sm soft num'); bar.appendChild(fill);
      const wbar = el('div', 'bar'), wfill = el('i'), wtxt = el('span', 'sm soft num'), more = tag('ui.people', 'More builders', function () { Snd.play('tap'); goTab('town'); }); wbar.appendChild(wfill); wbar.classList.add('labour');
      const b = btn('Build', function (bt) {
        if (!C.buildStage(S, now())) { Snd.play('error'); FX.shake(bt); return; }
        const at = place('work:' + S.age);
        Snd.play('stage'); FX.burst(at, { n: 44, color: ['#ffe9a8', '#ffffff', '#f4cb5e'], speed: 280, life: 1.1, size: 4 }); FX.ring(at, '#fff3c4', 130, 6);
        Scene.emit('stage', S.age); if (!$('modal').hidden) closeSheet();        // in the city view the sheet steps aside for the celebration
        did();
      }, 'big', 'ui.up');
      b.dataset.act = 'build';
      const acts = add(el('div', 'acts'), b);
      add(card, add(el('div', 'head'), tile('p.' + S.age, 'cap', 'lg', infoProject), add(mid, add(el('div', 'line'), el('div', 'name', pr.name), pips(S.project, pr.stages.length)), el('div', 'sm soft', pr.stages[S.project]), cv.el)), add(el('div', 'barrow gap'), add(el('span', 'bi'), ic('ui.chest')), bar, eta), add(el('div', 'barrow gap'), add(el('span', 'bi'), ic('job.work')), wbar, wtxt, more), acts);
      live.push(function () {
        const c = C.stageCost(S, D); if (!c) return;
        cv.set(c); let f = 1, wait = 0;
        for (const r in c) { f = Math.min(f, S.res[r] / c[r]); if (S.res[r] < c[r]) wait = Math.max(wait, D.rate[r] > 0 ? (c[r] - S.res[r]) / D.rate[r] : Infinity); }
        fill.style.width = Math.round(100 * Math.max(0, Math.min(1, f))) + '%';
        const need = C.stageWork(S), done = S.work >= need - 1e-6, wwait = done ? 0 : D.work > 0 ? (need - S.work) / D.work * 3600 : Infinity;
        wfill.style.width = Math.round(100 * (need ? Math.min(1, S.work / need) : 1)) + '%';
        setText(wtxt, done ? 'work done' : oneDec(S.work) + ' of ' + need + ' work' + (isFinite(wwait) ? ', ' + fmtTime(wwait) : ''));
        more.style.display = !done && S.rank >= 2 && view.tab !== 'town' ? '' : 'none';
        const ok = C.stageReady(S, D); b.disabled = !ok; b.classList.toggle('ready', ok); acts.style.display = ok ? '' : 'none';      // the button appears when there is something to press
        setText(eta, C.canPay(S, c) ? 'paid for' : isFinite(wait) ? fmtTime(wait) : '');
      });
    }
    return card;
  }
  function buildingCard(b) {
    const card = el('div', 'card row'), t = tile('b.' + b.id, b.res, '', function () { infoBuilding(b); }), badge = el('span', 'badge');
    const outN = stat('res.' + b.res, '', 'c-' + b.res), bar = el('div', 'bar thin'), fill = el('i'), nx = el('span', 'num nx'), lock = ic('ui.lock'), nxt = el('span');
    add(nx, lock, nxt);
    const buy = el('button', 'btn buy'), q = el('span', 'q'), cv = costView(true);
    t.appendChild(badge); bar.appendChild(fill); buy.type = 'button'; buy.dataset.act = 'buy:' + b.id; add(buy, q, cv.el);
    buy.addEventListener('click', function () {
      const n = C.buy(S, b.id, view.qty, now());
      if (!n) { Snd.play('error'); FX.shake(buy); return; }
      Snd.play('buy'); FX.pop(t); FX.burst(t, { n: 10, color: [RC[b.res], '#fff'], speed: 130, life: 0.55 }); FX.float(t, '+' + n, { color: '#fff', dy: -34 });
      Scene.emit('buy', b.id); did();
    });
    add(card, t, add(el('div', 'mid'), el('div', 'name', b.name), add(el('div', 'stats'), outN), add(el('div', 'barrow'), bar, nx)), buy);
    live.push(function () {
      const n = C.count(S, b.id), next = C.nextMark(S, b), held = !!(next && next.need);
      setText(badge, String(n)); badge.style.display = n ? '' : 'none';
      setText(outN.b, '+' + fmtC(C.unitRate(S, D, b) * Math.max(1, n)) + '/s');
      fill.style.width = (next ? Math.round(100 * Math.max(0, Math.min(1, (n - next.prev) / (next.at - next.prev)))) : 100) + '%';
      lock.style.display = held ? '' : 'none'; nx.classList.toggle('warn', held && n >= next.at);
      setText(nxt, !next ? 'max' : held && n >= next.at ? (next.name || 'Next doubling') + ' needs research' : (next.name || 'x2') + ' at ' + next.at);
      const qn = view.qty === 'max' ? Math.max(1, C.maxQty(S, b)) : view.qty, c = C.buildCost(b, n, qn);
      setText(q, 'Buy ' + qn); cv.set(c); buy.disabled = !C.canPay(S, c);
    });
    return card;
  }
  function shadowBuilding(b) {               // a kind of building that is still to come
    const card = el('div', 'card row shadow'), need = b.id === 'lumber' ? 'Woodcutters come once five farmsteads stand.' : b.id === 'script' ? 'The monks come once three lumber camps stand.' : 'Not yet.';
    add(card, tile('b.' + b.id, 'dim'), add(el('div', 'mid'), el('div', 'name', b.name), el('div', 'sm soft', need)));
    return card;
  }
  function comingRow(list, text) {           // small dim tiles for things of the next age, with their names
    const g = el('div', 'relics');
    list.forEach(function (x) { g.appendChild(tile(x[0], 'dim', 'sm', x[2] || null)); });
    return [el('div', 'sm soft pad', text + ': ' + list.map(function (x) { return x[1]; }).join(', ') + '.'), g];
  }
  function panelRealm(p) {
    const tags = el('div', 'stats top'), store = tag('ui.store', '', infoStore);
    tags.appendChild(store); live.push(function () { setText(store.lbl, hours(D.storeH) + ' storage'); });
    if (C.townOpen(S)) {
      const rk = tag(rankIcon(S.rank), '', function () { Snd.play('tap'); go('town'); }); rk.dataset.act = 'rank'; tags.appendChild(rk);
      live.push(function () { setText(rk.lbl, C.RANKS[S.rank].name + ', ' + peopleText(C.people(S))); });
    }
    if (C.has(S, 'edicts')) {
      const e = tag('ui.edict', '', function () { edictSheet(); }); e.dataset.act = 'edict'; tags.appendChild(e);
      live.push(function () { const on = S.edict && S.edict.until > now(); setText(e.lbl, on ? C.EDICT[S.edict.id].name + ' ' + fmtTime((S.edict.until - now()) / 1000) : 'Proclaim an edict'); e.classList.toggle('call', !on); });
    }
    if (D.boost) { const bo = tag('res.' + D.boost.res, ''); tags.appendChild(bo); live.push(function () { setText(bo.lbl, S.boost ? '+' + Math.round((S.boost.m - 1) * 100) + '% ' + fmtTime(Math.max(0, S.boost.until - now()) / 1000) : ''); }); }
    p.appendChild(tags);
    if (S.ev.cur) p.appendChild(eventCard());
    if (D.rate.gold < 5) p.appendChild(workCard());
    const act = C.ageTabOpen(S) && (C.canAdvance(S) || C.canDepart(S) || C.projectDone(S) || C.stageReady(S, D));
    if (act) p.appendChild(projectCard());
    goalsBox(p);
    p.appendChild(sec('Buildings', seg([[1, 'x1'], [10, 'x10'], ['max', 'Max']], view.qty, function (v) { view.qty = v; saveView(); render(); })));
    C.BUILDINGS.forEach(function (b) { if (b.age === S.age) p.appendChild(C.buildingVisible(S, b) ? buildingCard(b) : shadowBuilding(b)); });
    if (C.ageTabOpen(S) && !act) { p.appendChild(el('h2', 'sec', 'Great work')); p.appendChild(projectCard()); }
    if (S.age > 1) {
      p.appendChild(add(el('div', 'acts'), btn(view.older ? 'Hide earlier ages' : 'Show earlier ages', function () { Snd.play('tap'); view.older = !view.older; saveView(); render(); }, 'alt')));
      if (view.older) for (let a = S.age - 1; a >= 1; a--) {
        p.appendChild(el('h2', 'sec', C.AGES[a].name));
        C.BUILDINGS.forEach(function (b) { if (b.age === a) p.appendChild(buildingCard(b)); });
      }
    }
    if (S.age < 5 && C.ageTabOpen(S)) comingRow(C.BUILDINGS.filter(function (b) { return b.age === S.age + 1; }).map(function (b) { return ['b.' + b.id, b.name]; }), 'In the ' + C.AGES[S.age + 1].name).forEach(function (e) { p.appendChild(e); });
  }

  /* ---------- the skill tree ---------- */
  function nodeState(t) { return S.tech[t.id] ? 'owned' : C.techOpen(S, t) ? 'open' : 'locked'; }
  function docState(d) { const got = S.doctrine[d.age]; return got === d.id ? 'owned' : got ? 'closed' : C.doctrineOpen(S, d.age) ? 'open' : 'locked'; }
  function needLine(text, ok) { return stat(ok ? 'ui.check' : 'ui.lock', text, ok ? 'good' : 'faint'); }
  function techSheet(t) {
    openSheet(function (sh) {
      const kind = fxKind(t.fx), st = nodeState(t);
      sh.appendChild(sheetHead(tile(t.id, kind, 'lg'), t.name, add(el('div', 'stats'), tag('age.' + t.age, C.AGES[t.age].name), tag(KIND[kind][0], KIND[kind][1]))));
      sh.appendChild(el('p', null, t.desc));
      opensBlock(sh, t, st);
      if (st === 'owned') { add(sh, add(el('div', 'stats'), stat('ui.check', 'Researched', 'good')), closeRow()); return; }
      const needs = el('div', 'needs');
      t.all.forEach(function (id) { needs.appendChild(needLine(C.TECH[id].name, !!S.tech[id])); });
      if (t.any.length) needs.appendChild(needLine(t.any.map(function (id) { return C.TECH[id].name; }).join(' or '), t.any.some(function (id) { return S.tech[id]; })));
      if (needs.firstChild) sh.appendChild(needs);
      const cv = costView(false), eta = el('span', 'sm soft num');
      const b = btn('Research', function (bt) {
        if (!C.research(S, t.id, now())) { Snd.play('error'); FX.shake(bt); return; }
        closeSheet(); Snd.play('research'); Scene.emit('research');
        if (t.fx.type === 'lm') { const l = C.LANDMARK[t.fx.id], ls = C.landmarkState(S, l); toast(ls === 'rank' ? 'The ' + l.name + ' is understood. It needs a ' + C.RANKS[l.rank].name.toLowerCase() + ' to stand in.' : 'The ' + l.name + ' can now be built in Town.'); }
        did();
        const n = document.querySelector('[data-node="' + t.id + '"]'); if (n) { sparkle(n, kind); FX.pop(n); }
      }, 'big', 'res.kn');
      b.dataset.act = 'research';
      add(sh, add(el('div', 'line cost-line'), cv.el, eta), add(el('div', 'acts'), b), closeRow());
      sheetLive.push(function () {
        const c = C.techCost(S, t, D), ok = st === 'open' && S.res.kn >= c;
        cv.set({ kn: c }); b.disabled = !ok; b.classList.toggle('ready', ok);
        setText(eta, st !== 'open' ? 'Locked' : ok ? '' : D.rate.kn > 0 ? 'about ' + fmtTime((c - S.res.kn) / D.rate.kn) : '');
      });
    });
  }
  function opensBlock(sh, t, st) {           // what a topic opens, shown before it is bought
    if (t.fx.type === 'lm') {
      const l = C.LANDMARK[t.fx.id], cv = costView(false), ls = C.landmarkState(S, l), mid = el('div', 'mid');
      add(mid, el('div', 'name', l.name), el('div', 'sm soft', l.text), cv.el);
      if (l.rank) mid.appendChild(add(el('div', 'stats'), needLine('Needs a ' + C.RANKS[l.rank].name.toLowerCase(), S.rank >= l.rank)));
      if (ls === 'built') mid.appendChild(add(el('div', 'stats'), stat('ui.check', 'Built', 'good')));
      sh.appendChild(add(el('div', 'head found'), tile('lm.' + l.id, st === 'owned' ? fxKind(l.fx) : 'dim', '', st === 'owned' ? function () { landmarkSheet(l); } : null), mid));
      sheetLive.push(function () { if (ls !== 'built') cv.set(C.landmarkCost(l)); });
      return;
    }
    if (t.fx.type !== 'b') return;
    const b = C.B[t.fx.b], n = C.count(S, b.id), list = el('div', 'stages');
    (t.marks || []).forEach(function (i) {
      const have = C.doublings(S, b) > i, row = el('div', 'stage' + (have ? ' done' : ''));
      add(row, ic(have ? 'ui.check' : 'b.' + b.id), el('span', 'nm', b.marks[i]), el('span', 'sm soft num', have ? 'raised' : n >= C.MILESTONES[i] ? 'at once' : n + ' of ' + C.MILESTONES[i]));
      list.appendChild(row);
    });
    sh.appendChild(list);
    if (st !== 'owned' && n) {                // what it does to the income, worked out on a copy of the realm
      const copy = JSON.parse(JSON.stringify(S)); copy.tech[t.id] = 1;
      const after = C.derive(copy, now()).rate[b.res];
      sh.appendChild(add(el('div', 'stats'), stat('res.' + b.res, '+' + fmtC(D.rate[b.res]) + '/s now', 'c-' + b.res), stat('ui.up', '+' + fmtC(after) + '/s after', 'good')));
    }
  }
  function doctrineSheet(a) {
    openSheet(function (sh) {
      const open = C.doctrineOpen(S, a), got = S.doctrine[a];
      sh.appendChild(sheetHead(tile('ui.fork', 'cap', 'lg'), 'Doctrine of the ' + C.AGES[a].name, got ? 'It holds until you leave this world.' : 'Choose one of three. It holds until you leave this world.'));
      C.DOCTRINES.forEach(function (d) {
        if (d.age !== a) return;
        const mine = got === d.id, card = el('div', 'card row' + (mine ? ' feature' : ''));
        let side;
        if (mine) side = stat('ui.check', 'Adopted', 'good');
        else {
          side = btn('Adopt', function (bt) {
            if (!C.chooseDoctrine(S, d.id, now())) { Snd.play('error'); FX.shake(bt); return; }
            closeSheet(); Snd.play('doctrine'); toast(d.name + ' is adopted.'); did();
            const n = document.querySelector('[data-node="' + d.id + '"]'); if (n) { sparkle(n, 'doc', true); FX.pop(n); }
          }, open ? 'ready' : '');
          side.disabled = !open; side.dataset.act = 'adopt:' + d.id;
          if (got) side.style.visibility = 'hidden';
        }
        add(card, tile(d.id, got && !mine ? 'dim' : fxKind(d.fx)), add(el('div', 'mid'), el('div', 'name', d.name), el('div', 'sm soft', d.desc)), side);
        sh.appendChild(card);
      });
      if (!open && !got) sh.appendChild(el('div', 'hint', 'The fork opens with ' + C.TECH[C.ROLE_ID[a].M2].name + '.'));
      sh.appendChild(closeRow());
    });
  }
  function ribbon(a, future) {
    const r = el('div', 'ribbon'), em = el('div', 'emblem'), sm = el('small');
    em.appendChild(ic(future ? 'ui.lock' : 'age.' + a));
    if (future) sm.textContent = 'Opens when this age turns';
    else { const d = S.doctrine[a]; sm.textContent = C.techCount(S, a) + ' of 10' + (d ? ', ' + C.DOCTRINE[d].name.toLowerCase() : ''); }
    return add(r, em, el('span', null, C.AGES[a].name), sm);
  }
  function treeBand(a, W) {
    const Hh = 440, X = function (c) { return Math.round(W * (c + 0.5) / C.TREE_COLS); }, Y = function (r) { return 384 - r * 82; };
    const band = el('div', 'treeband'), grove = el('div', 'grove'), svg = document.createElementNS(NS, 'svg');
    band.style.width = W + 'px'; grove.style.height = Hh + 'px';
    svg.setAttribute('class', 'wires'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    const wire = function (x1, y1, x2, y2, st) {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); if (st) l.setAttribute('class', st);
      svg.appendChild(l);
    };
    const techs = C.TECHS.filter(function (t) { return t.age === a; }), docs = C.DOCTRINES.filter(function (d) { return d.age === a; });
    techs.forEach(function (t) {
      const st = nodeState(t);
      t.all.concat(t.any).forEach(function (pid) {
        const pa = C.TECH[pid], have = !!S.tech[pid];
        wire(X(pa.col), Y(pa.row), X(t.col), Y(t.row), have && st === 'owned' ? 'on' : have && st === 'open' ? 'ready' : '');
      });
    });
    const m2 = C.TECH[C.ROLE_ID[a].M2], jx = X(2), jy = Y(3.25), chosen = S.doctrine[a], forkOpen = C.doctrineOpen(S, a);
    wire(X(m2.col), Y(m2.row), jx, jy, chosen ? 'on' : forkOpen ? 'ready' : '');
    docs.forEach(function (d) { wire(jx, jy, X(d.col), Y(d.row), chosen === d.id ? 'on' : forkOpen ? 'ready' : ''); });
    grove.appendChild(svg);
    const cap = el('div', 'forknote', chosen ? C.DOCTRINE[chosen].name : 'Doctrine: choose one of three'); cap.style.top = '0'; grove.appendChild(cap);
    techs.forEach(function (t) {
      const st = nodeState(t), n = el('button', 'node t-' + fxKind(t.fx) + ' ' + st);
      n.type = 'button'; n.dataset.node = t.id; n.dataset.state = st; n.style.left = X(t.col) + 'px'; n.style.top = Y(t.row) + 'px'; n.setAttribute('aria-label', t.name);
      n.appendChild(ic(t.id));
      if (st === 'open') {
        const pr = el('span', 'price num'), num = el('span'); pr.appendChild(ic('res.kn')); pr.appendChild(num); n.appendChild(pr);
        live.push(function () { const c = C.techCost(S, t, D), ok = S.res.kn >= c; setText(num, fmtC(c)); pr.classList.toggle('short', !ok); n.classList.toggle('afford', ok); });
      }
      n.addEventListener('click', function () { techSheet(t); });
      grove.appendChild(n);
    });
    docs.forEach(function (d) {
      const st = docState(d), n = el('button', 'node fork t-doc ' + st + (st === 'open' ? ' afford' : ''));
      n.type = 'button'; n.dataset.node = d.id; n.dataset.state = st; n.style.left = X(d.col) + 'px'; n.style.top = Y(d.row) + 'px'; n.setAttribute('aria-label', d.name);
      n.appendChild(ic(d.id));
      n.addEventListener('click', function () { doctrineSheet(a); });
      grove.appendChild(n);
    });
    return add(band, ribbon(a), grove);
  }
  function panelTree(p) {
    const W = Math.max(270, Math.min(340, (p.clientWidth || 360) - 20));
    if (S.age < 5) {
      const f = el('div', 'treeband future'), a = S.age + 1; f.style.width = W + 'px'; f.appendChild(ribbon(a, true));
      comingRow(C.LANDMARKS.filter(function (l) { return l.age === a; }).map(function (l) { return ['lm.' + l.id, l.name, function () { landmarkSheet(l); }]; }), 'Ten topics. They teach').forEach(function (e) { f.appendChild(e); });
      p.appendChild(f);
    }
    for (let a = S.age; a >= 1; a--) p.appendChild(treeBand(a, W));
    if (S.age === 1 && C.techCount(S) < 4) p.appendChild(el('div', 'hint', 'Each age grows a tree. Every topic opens something to build: tap one to see what. The three diamonds on top are a doctrine, and you keep only one.'));
  }
  function focusTree(p) {                    // open the tree where there is something to do
    const open = p.querySelectorAll('.node.open'); if (!open.length) return;
    let low = open[0]; open.forEach(function (n) { if (n.getBoundingClientRect().top > low.getBoundingClientRect().top) low = n; });
    p.scrollTop += low.getBoundingClientRect().bottom - p.getBoundingClientRect().bottom + 70;
  }

  /* ---------- heroes ---------- */
  function infoHero(h) {
    openSheet(function (sh) {
      const me = S.heroes[h.id];
      sh.appendChild(sheetHead(face(h.id, 'lg'), h.name, h.role));
      add(sh, add(el('div', 'stats'), tag('ui.star', h.ability)), el('p', null, h.text));
      if (me) {
        const st = C.heroStats(S, h.id, D, D.muster), cap = C.levelCap(S);
        add(sh, add(el('div', 'stats'), stat('ui.xp', 'Level ' + me.lvl + (me.lvl >= cap ? ' (the most this age allows)' : ' of ' + cap)), stat('ui.hp', C.fmtInt(Math.round(st.max)), 'bad'), stat('ui.atk', C.fmtInt(Math.round(st.atk))), st.heal ? stat('ui.heal', C.fmtInt(Math.round(st.heal)), 'good') : null),
          add(el('div', 'stats'), stat('ui.gear', C.GEAR_NAMES[me.gear])),
          el('p', 'sm soft', 'Heroes gain experience on every expedition, win or lose. Better equipment makes them 30% stronger each time.'));
        const it = C.carried(S, h.id);
        if (it) sh.appendChild(add(el('div', 'head found'), tile(it, 'cap', 'sm', function () { itemSheet(C.ITEM[it]); }), add(el('div', 'mid'), el('div', 'name', C.ITEM[it].name), el('div', 'sm good', C.ITEM[it].heroDesc))));
      }
      sh.appendChild(closeRow());
    });
  }
  function infoMission(m) {
    const tr = m.trait ? C.TRAITS[m.trait] : null, z = C.DISC_FROM[m.id], it = C.ITEM_FROM[m.id];
    info(m.name, 'm.' + m.id, m.trial ? 'boss' : 'foe', [m.text || null,
      tr ? add(el('div', 'stats'), tag('trait.' + m.trait, tr.name)) : null, tr ? tr.desc : 'Nothing unusual is reported about this enemy.',
      m.trial ? 'Victory yields an item and clears the way to ' + (m.age < 5 ? 'the next age' : 'the launch') + '. A failed attempt still wears the enemy down.'
        : 'The plunder is counted in hours of your own output, so it grows with the realm.' + (m.age < S.age ? ' Ground from an earlier age yields half.' : ''),
      z ? (S.disc[z.id] ? 'Found here: ' + C.lowerThe(z.name) + '.' : 'Nobody has come back from here with a map. The first victory finds a place.') : null,
      it && !m.trial ? (S.items[it.id] !== undefined ? 'Brought back from here: ' + it.name + '.' : 'An item is said to lie along this way. Each victory has ' + Math.round(it.chance * 100) + ' chances in 100 of finding it.') : null]);
  }
  /* ---------- places found and items brought back ---------- */
  function discCard(z) {
    const st = S.disc[z.id] || 0, card = el('div', 'card row' + (st ? '' : ' shadow')), mid = el('div', 'mid');
    if (!st) {
      add(mid, el('div', 'name', 'Unexplored'), el('div', 'sm soft', 'Somewhere along: ' + C.lowerThe(C.MISSION[z.from].name) + '.'));
      add(card, tile('ui.found', 'dim'), mid);
      return card;
    }
    add(mid, add(el('div', 'line'), el('div', 'name', z.name), tag(z.kind === 'route' ? 'ui.away' : 'ui.found', z.kind === 'route' ? 'Route' : st === 2 ? z.build : 'Site')), el('div', 'sm soft', z.text));
    let side = null;
    if (st === 2) mid.appendChild(add(el('div', 'stats'), stat('ui.check', z.desc, 'good')));
    else {
      const b = el('button', 'btn buy'), cv = costView(true); b.type = 'button'; b.dataset.act = 'post:' + z.id; add(b, el('span', 'q', 'Build'), cv.el);
      b.addEventListener('click', function () {
        if (!C.buildOutpost(S, z.id, now())) { Snd.play('error'); FX.shake(b); return; }
        raisePost(z, b); did();
      });
      live.push(function () { const c = C.outpostCost(z.id), ok = C.canPay(S, c); cv.set(c); b.disabled = !ok; b.classList.toggle('ready', ok); });
      mid.appendChild(el('div', 'sm', z.build + ': ' + z.desc));
      side = b;
    }
    add(card, tile('d.' + z.id, fxKind(z.fx)), mid, side);
    return card;
  }
  function raisePost(z, at) {                // an outpost has just gone up
    Snd.play('stage'); if (at) sparkle(at, fxKind(z.fx), true);
    toast(z.build + ' built. ' + z.desc); Scene.emit('post', z.id);
  }
  function postSheet(z) {                    // a place the heroes found, touched in the picture
    openSheet(function (sh) {
      const st = S.disc[z.id] || 0, kind = fxKind(z.fx);
      sh.appendChild(sheetHead(tile('d.' + z.id, kind, 'lg'), st === 2 ? z.build : z.name, add(el('div', 'stats'), tag('ui.found', st === 2 ? 'Outpost' : 'Site'), tag('ui.away', 'Found on: ' + C.MISSION[z.from].name))));
      add(sh, el('p', null, z.text));
      if (st === 2) { add(sh, add(el('div', 'stats'), stat('ui.check', z.desc, 'good')), closeRow()); return; }
      sh.appendChild(el('p', 'sm soft', z.build + ': ' + z.desc));
      const cv = costView(false), b = btn('Build', function (bt) {
        if (!C.buildOutpost(S, z.id, now())) { Snd.play('error'); FX.shake(bt); return; }
        closeSheet(); raisePost(z, null); did();
      }, 'big', 'ui.up');
      b.dataset.act = 'post:' + z.id;
      add(sh, add(el('div', 'line cost-line'), cv.el), add(el('div', 'acts'), b), closeRow());
      sheetLive.push(function () { const c = C.outpostCost(z.id), ok = S.disc[z.id] === 1 && C.canPay(S, c); cv.set(c); b.disabled = !ok; b.classList.toggle('ready', ok); });
    }, !$('modal').hidden);
  }
  function discBox(p) {
    p.appendChild(sec('Places found', el('span', 'sm soft num', C.discCount(S) + ' of ' + C.DISCOVERIES.length)));
    const mine = C.DISCOVERIES.filter(function (z) { return S.disc[z.id]; });
    mine.filter(function (z) { return S.disc[z.id] === 1; }).forEach(function (z) { p.appendChild(discCard(z)); });      // sites waiting for an outpost come first
    C.DISCOVERIES.forEach(function (z) { if (z.age === S.age && S.disc[z.id] !== 1) p.appendChild(discCard(z)); });
    const old = mine.filter(function (z) { return z.age < S.age && S.disc[z.id] === 2; });
    if (old.length) {
      const g = el('div', 'relics');
      old.forEach(function (z) { g.appendChild(tile('d.' + z.id, fxKind(z.fx), 'sm', function () { info(z.name, 'd.' + z.id, fxKind(z.fx), [z.text, add(el('div', 'stats'), stat('ui.check', (z.build ? z.build + ': ' : '') + z.desc, 'good'))]); })); });
      p.appendChild(el('div', 'sm soft pad', 'From earlier ages:')); p.appendChild(g);
    }
    if (!mine.length) p.appendChild(el('div', 'hint', 'The first victory on each expedition finds a place. A route pays from that day on. A site needs an outpost built before it gives anything.'));
  }
  function whereText(id) {
    const at = S.items[id];
    return at === 'city' ? 'Kept in the town' : at && C.HERO[at] ? 'Carried by ' + C.lowerThe(C.HERO[at].name) : 'In the strongroom';
  }
  function itemSheet(x) {
    openSheet(function (sh) {
      const have = S.items[x.id] !== undefined, from = C.MISSION[x.from];
      if (!have) {
        sh.appendChild(sheetHead(tile('ui.lock', 'dim', 'lg'), 'Unknown item'));
        add(sh, el('p', null, from && from.age <= S.age ? 'Said to lie along: ' + C.lowerThe(from.name) + '.' : 'It lies in an age you have not reached.'), closeRow());
        return;
      }
      const locked = C.itemLocked(S, x.id), at = S.items[x.id], away = C.busy(S), free = C.citySlots(S) - C.itemsKept(S).length;
      sh.appendChild(sheetHead(tile(x.id, 'cap', 'lg'), x.name, whereText(x.id) + (locked ? ', away with a party' : '') + '.'));
      const two = el('div', 'two');
      add(two, add(el('div', 'side' + (at && at !== 'city' ? ' on' : '')), add(el('div', 'stats'), tag('tab.heroes', 'Carried by a hero')), el('div', 'sm', x.heroDesc)),
        add(el('div', 'side' + (at === 'city' ? ' on' : '')), add(el('div', 'stats'), tag('ui.honour', 'Kept in the town')), el('div', 'sm', x.cityDesc)));
      sh.appendChild(two);
      if (locked) { add(sh, el('div', 'hint', 'It can be moved when the party is back.'), closeRow()); return; }
      const put = function (where) { return function (bt) { if (!C.placeItem(S, x.id, where)) { Snd.play('error'); FX.shake(bt); return; } Snd.play('equip'); did(); itemSheet(x); }; };
      if (at !== 'city') {
        const b = btn(C.citySlots(S) ? 'Keep it in the town' : 'No place of honour yet', put('city'), 'big', 'ui.honour'); b.dataset.act = 'item-city:' + x.id; b.disabled = free < 1;
        sh.appendChild(add(el('div', 'acts'), b));
        if (free < 1) sh.appendChild(el('div', 'sm soft', C.citySlots(S) ? 'Every place of honour is taken. Move another item out first.' : 'A town has one place of honour. Larger ranks have more.'));
      }
      const roster = C.HEROES.filter(function (h) { return S.heroes[h.id] && h.id !== at; });
      if (roster.length) {
        sh.appendChild(el('div', 'sm soft pad', 'Give it to a hero:'));
        const row = el('div', 'roster');
        roster.forEach(function (h) { const f = face(h.id, '', put(h.id)); f.disabled = !!away[h.id]; f.dataset.act = 'item-hero:' + x.id + ':' + h.id; if (C.carried(S, h.id)) f.classList.add('laden'); row.appendChild(f); });
        sh.appendChild(row);
        if (roster.some(function (h) { return C.carried(S, h.id); })) sh.appendChild(el('div', 'sm soft', 'A hero carries one item. What a marked hero carries now goes to the strongroom.'));
      }
      if (at) sh.appendChild(add(el('div', 'acts'), btn('Put it in the strongroom', put(''), 'alt', 'ui.vault')));
      sh.appendChild(closeRow());
    }, !$('modal').hidden);
  }
  function itemShelf(p) {
    const kept = C.itemsKept(S).length, places = C.citySlots(S);
    p.appendChild(sec('Items', el('span', 'sm soft num', C.itemCount(S) + ' of ' + C.ITEMS.length)));
    if (C.itemCount(S)) p.appendChild(add(el('div', 'stats top'), tag('ui.honour', places ? kept + ' of ' + places + (places === 1 ? ' place of honour in use' : ' places of honour in use') : 'No place of honour yet', rankSheet)));
    const g = el('div', 'relics');
    C.ITEMS.forEach(function (x) {
      const have = S.items[x.id] !== undefined, at = S.items[x.id], t = tile(have ? x.id : 'ui.lock', have ? (at ? 'cap' : 'idle') : 'dim', 'sm', function () { itemSheet(x); });
      t.dataset.item = x.id;
      if (have && at === 'city') t.appendChild(add(el('span', 'badge pin'), ic('ui.honour')));
      else if (have && at) { const b = el('span', 'badge pin'); b.style.background = HC[at] || '#555'; b.appendChild(ic('h.' + at)); t.appendChild(b); }
      g.appendChild(t);
    });
    p.appendChild(g);
    if (!C.itemCount(S)) p.appendChild(el('div', 'hint', 'Some expeditions bring back an item. Each does one thing when a hero carries it and another when it is kept in the town.'));
    else if (C.ITEMS.some(function (x) { return S.items[x.id] === ''; })) p.appendChild(el('div', 'hint', 'An item in the strongroom does nothing. Tap it to choose where it goes.'));
  }
  function oddsWord(p) { return p >= 0.9 ? 'Strong' : p >= 0.7 ? 'Good' : p >= 0.45 ? 'Even' : p >= 0.2 ? 'Poor' : 'Grim'; }
  function reportCard(r) {
    const m = C.MISSION[r.m], key = r.m + r.t, card = el('div', 'card'), bn = el('div', 'banner');
    const k = r.result === 'win' ? ['#3f8a3a', 'ui.win', 'Victory'] : r.result === 'draw' ? ['#a8842a', 'ui.draw', 'Withdrew'] : ['#9a3a32', 'ui.loss', 'Defeat'];
    bn.style.setProperty('--bc', k[0]); add(bn, ic(k[1]), el('b', null, k[2]), el('span', null, m.name)); card.appendChild(bn);
    const st = el('div', 'stats'); st.appendChild(stat('ui.clock', r.rounds + (r.rounds === 1 ? ' round' : ' rounds')));
    for (const x of C.RES) if (r.loot[x]) st.appendChild(stat('res.' + x, '+' + fmt(r.loot[x]), 'c-' + x));
    card.appendChild(st);
    const who = el('div', 'who');
    (r.h || []).forEach(function (id) {
      if (!C.HERO[id]) return;
      const w = el('div', 'whoone'), bar = el('div', 'bar thin'), fill = el('i'); bar.appendChild(fill);
      fill.style.width = Math.round(100 * (r.hp && r.hp[id] !== undefined ? r.hp[id] : 0)) + '%';
      add(w, face(id, 'xs'), bar); who.appendChild(w);
    });
    r.ups.forEach(function (u) { who.appendChild(tag('ui.xp', short(C.HERO[u.id].name) + ' Lv ' + u.lvl)); });
    card.appendChild(who);
    if (r.relic && C.ITEM[r.relic]) card.appendChild(add(el('div', 'head found'), tile(r.relic, 'cap', 'sm', function () { itemSheet(C.ITEM[r.relic]); }), add(el('div', 'mid'), el('div', 'name', C.ITEM[r.relic].name), el('div', 'sm good', 'An item. Tap it to choose where it goes.'))));
    if (r.disc && C.DISCOVERY[r.disc]) { const z = C.DISCOVERY[r.disc]; card.appendChild(add(el('div', 'head found'), tile('d.' + z.id, fxKind(z.fx), 'sm'), add(el('div', 'mid'), el('div', 'name', 'Found: ' + C.lowerThe(z.name)), el('div', 'sm good', z.kind === 'route' ? z.desc : 'A site. ' + z.build + ' can be built here: see Places found.')))); }
    if (m.trial && r.result !== 'win') card.appendChild(el('div', 'sm soft', 'The enemy is worn down. The next attempt will be easier.'));
    if (openLog[key]) { const a = el('div', 'acct'); r.log.forEach(function (ln) { a.appendChild(el('div', null, ln)); }); card.appendChild(a); }
    add(card, add(el('div', 'acts'), btn(openLog[key] ? 'Hide account' : 'Account', function () { Snd.play('tap'); openLog[key] = !openLog[key]; render(); }, 'alt', 'ui.scroll'),
      btn('Dismiss', function () { Snd.play('tap'); const i = S.reports.indexOf(r); if (i >= 0) S.reports.splice(i, 1); delete openLog[key]; did(); }, 'alt', 'ui.check')));
    return card;
  }
  function partyCard(pt) {
    const m = C.MISSION[pt.m], card = el('div', 'card'), left = el('em', 'num'), track = el('div', 'track'), fill = el('i'), mark = el('b'), who = el('div', 'who');
    mark.appendChild(ic('ui.away')); add(track, fill, mark, left);
    pt.h.forEach(function (id) { who.appendChild(face(id, 'xs')); });
    add(card, add(el('div', 'head'), tile('m.' + m.id, m.trial ? 'boss' : 'foe', 'sm', function () { infoMission(m); }), add(el('div', 'mid'), el('div', 'name', m.name), who)), track);
    live.push(function () {
      const n = now(), f = Math.max(0, Math.min(1, (n - pt.t0) / (pt.t1 - pt.t0)));
      setText(left, n >= pt.t1 ? 'returning' : fmtTime((pt.t1 - n) / 1000)); fill.style.width = (f * 100) + '%'; mark.style.left = (5 + f * 90) + '%';
    });
    return card;
  }
  function missionCard(m, free) {
    const card = el('div', 'card'), tr = m.trait ? C.TRAITS[m.trait] : null, p = lineup.length ? C.forecast(S, m.id, lineup, now(), 40) : 0, mid = el('div', 'mid');
    const st = el('div', 'stats'), loot = el('div', 'stats'), lootN = {};
    st.appendChild(stat('ui.clock', fmtTime(C.missionTime(S, m, D, lineup))));
    if (C.DISC_FROM[m.id] && !S.disc[C.DISC_FROM[m.id].id]) st.appendChild(tag('ui.found', 'Unexplored'));
    if (tr) st.appendChild(tag('trait.' + m.trait, tr.name, function () { info(tr.name, 'trait.' + m.trait, 'foe', [tr.desc]); }));
    if (m.trial && S.trialTries[m.age]) st.appendChild(tag('ui.loss', Math.round((1 - C.trialWear(S, m.age)) * 100) + '% weaker'));
    if (m.trial) add(loot, S.items[C.ITEM_FROM[m.id].id] === undefined ? stat('ui.relic', 'Item', 'c-gold') : null, stat('ui.flag', m.age < 5 ? 'Opens the next age' : 'Clears the launch'));
    else {
      for (const r of C.RES) if (m.loot[r]) { lootN[r] = stat('res.' + r, '', 'c-' + r); loot.appendChild(lootN[r]); }
      const rel = C.ITEM_FROM[m.id];
      if (rel && S.items[rel.id] === undefined) loot.appendChild(stat('ui.relic', 'Item ' + Math.round(rel.chance * 100) + '%', 'c-gold'));
      live.push(function () { const est = C.lootEstimate(S, m, lineup, D); for (const r in lootN) setText(lootN[r].b, '+' + fmt(est[r] || 0)); });
    }
    add(mid, el('div', 'name', m.name), st, loot);
    add(card, add(el('div', 'head'), tile('m.' + m.id, m.trial ? 'boss' : 'foe', '', function () { infoMission(m); }), mid));
    const bar = el('div', 'bar odds'), fill = el('i'), lab = el('span', 'num'), send = btn('Send', function (bt) {
      if (!C.send(S, m.id, lineup, now())) { Snd.play('error'); FX.shake(bt); toast('That party cannot leave right now.'); return; }
      Snd.play('send'); lineup = []; did();
    }, '', 'ui.party');
    send.dataset.act = 'send:' + m.id; send.dataset.odds = String(Math.round(p * 100)); send.disabled = !free || !lineup.length;
    bar.appendChild(fill); fill.style.width = Math.round(p * 100) + '%'; bar.style.setProperty('--c', p >= 0.7 ? '#8fd06e' : p >= 0.45 ? '#f1b54a' : '#ff8068');
    lab.textContent = lineup.length ? oddsWord(p) + ' ' + Math.round(p * 100) + '%' : 'Choose a party'; lab.className = 'num ' + (p >= 0.7 ? 'good' : p >= 0.45 ? 'warn' : 'bad');
    add(card, add(el('div', 'acts odds-row'), add(el('div', 'barrow grow'), bar, lab), send));
    return card;
  }
  function heroCard(h, away) {
    const card = el('div', 'card'), lvl = el('span', 'sm num soft'), bar = el('div', 'bar thin'), fill = el('i'), hp = stat('ui.hp', '', 'bad'), atk = stat('ui.atk', ''), gear = tag('ui.gear', '');
    const up = el('button', 'btn buy'), q = el('span', 'q'), cv = costView(true), f = face(h.id, 'lg', function () { infoHero(h); });
    bar.appendChild(fill); up.type = 'button'; up.dataset.act = 'gear:' + h.id; add(up, q, cv.el);
    up.addEventListener('click', function () {
      if (!C.upgradeGear(S, h.id)) { Snd.play('error'); FX.shake(up); return; }
      Snd.play('equip'); FX.pop(f); sparkle(f, 'arm'); did();
    });
    add(card, add(el('div', 'head'), f, add(el('div', 'mid'), add(el('div', 'line'), el('div', 'name', h.name), lvl), add(el('div', 'stats'), hp, atk, away ? tag('ui.away', 'Away') : null), bar), up),
      add(el('div', 'stats under'), gear, tag('ui.star', h.ability, function () { infoHero(h); }), C.carried(S, h.id) ? tag('ui.relic', C.ITEM[C.carried(S, h.id)].name, function () { itemSheet(C.ITEM[C.carried(S, h.id)]); }) : null));
    live.push(function () {
      const me = S.heroes[h.id]; if (!me) return;
      const cap = C.levelCap(S), c = C.gearCost(S, h.id), st = C.heroStats(S, h.id, D, D.muster);
      setText(lvl, 'Lv ' + me.lvl + (me.lvl >= cap ? ' max' : ''));
      fill.style.width = (me.lvl >= cap ? 100 : Math.min(100, Math.round(100 * me.xp / C.xpNeed(me.lvl)))) + '%';
      setText(hp.b, C.fmtInt(Math.round(st.max))); setText(atk.b, C.fmtInt(Math.round(st.atk))); setText(gear.lbl, C.GEAR_NAMES[me.gear]);
      if (c === null) { setText(q, 'Best gear'); cv.set(null); up.disabled = true; } else { setText(q, 'Upgrade'); cv.set({ mat: c }); up.disabled = S.res.mat < c; }
    });
    return card;
  }
  function recruitCard(h) {
    const cost = C.TUNE.hero[h.id] || 0, card = el('div', 'card row'), b = el('button', 'btn buy'), cv = costView(true);
    b.type = 'button'; b.dataset.act = 'recruit:' + h.id; add(b, el('span', 'q', 'Recruit'), cv.el);
    b.addEventListener('click', function () {
      if (!C.recruit(S, h.id, now())) { Snd.play('error'); FX.shake(b); return; }
      Snd.play('recruit'); toast(h.name + ' joins the realm.'); Scene.emit('recruit'); did();
    });
    add(card, face(h.id, 'lg', function () { infoHero(h); }), add(el('div', 'mid'), el('div', 'name', h.name), el('div', 'sm soft', h.role), add(el('div', 'stats'), tag('ui.star', h.ability, function () { infoHero(h); }))), b);
    live.push(function () { cv.set({ gold: cost }); b.disabled = S.res.gold < cost; b.classList.toggle('ready', S.res.gold >= cost); });
    return card;
  }
  function panelHeroes(p) {
    if (S.reports.length) {
      p.appendChild(sec('Returned', S.reports.length > 1 ? btn('Dismiss all', function () { Snd.play('tap'); S.reports.length = 0; openLog = {}; did(); }, 'alt') : null));
      S.reports.slice().reverse().forEach(function (r) { p.appendChild(reportCard(r)); });
    }
    const taken = C.busy(S), roster = C.HEROES.filter(function (h) { return S.heroes[h.id]; }), free = S.parties.length < D.slots;
    if (S.parties.length) { p.appendChild(el('h2', 'sec', 'Away')); S.parties.forEach(function (pt) { p.appendChild(partyCard(pt)); }); }
    lineup = lineup.filter(function (id) { return S.heroes[id] && !taken[id]; });
    if (!lineup.length && free) {
      lineup = (S.lineup || []).filter(function (id) { return S.heroes[id] && !taken[id]; });
      roster.forEach(function (h) { if (lineup.length < C.PARTY_SIZE && !taken[h.id] && lineup.indexOf(h.id) < 0) lineup.push(h.id); });   // a party leaves at full strength unless told otherwise
    }
    const idle = roster.filter(function (h) { return !taken[h.id]; });
    p.appendChild(el('h2', 'sec', 'Expedition'));
    if (free && idle.length) {
      const slots = el('div', 'slots');
      for (let i = 0; i < C.PARTY_SIZE; i++) (function (i) {
        const id = lineup[i], s = el('button', 'slot' + (id ? ' full' : '')); s.type = 'button';
        if (id) { s.style.setProperty('--hc', HC[id]); s.appendChild(ic('h.' + id)); s.setAttribute('aria-label', 'Remove ' + C.HERO[id].name); s.addEventListener('click', function () { Snd.play('tap'); lineup.splice(i, 1); render(); }); }
        else { s.appendChild(ic('ui.party')); s.disabled = true; }
        slots.appendChild(s);
      })(i);
      p.appendChild(slots);
      const bench = roster.filter(function (h) { return lineup.indexOf(h.id) < 0; });      // everyone who is not in the party
      if (bench.length) {
        const row = el('div', 'roster');
        bench.forEach(function (h) {
          const c = face(h.id, '', function () {
            if (lineup.length >= C.PARTY_SIZE) { Snd.play('error'); toast('A party is at most ' + C.PARTY_SIZE + ' strong. Tap a member above to free a place.'); return; }
            lineup.push(h.id); Snd.play('tap'); render();
          });
          c.disabled = !!taken[h.id]; c.dataset.pick = h.id; row.appendChild(c);
        });
        p.appendChild(row);
      }
      const out = function (m) { return S.parties.some(function (x) { return x.m === m.id; }); };
      const trial = C.MISSION['trial' + S.age];
      if (C.missionOpen(S, trial) && !out(trial)) p.appendChild(missionCard(trial, free));
      C.MISSIONS.forEach(function (m) { if (m.age === S.age && C.missionOpen(S, m) && !out(m)) p.appendChild(missionCard(m, free)); });
      if (S.age > 1) {
        p.appendChild(add(el('div', 'acts'), btn(view.oldGround ? 'Hide old ground' : 'Old ground (half the plunder)', function () { Snd.play('tap'); view.oldGround = !view.oldGround; saveView(); render(); }, 'alt')));
        if (view.oldGround) C.MISSIONS.forEach(function (m) { if (m.age === S.age - 1 && !out(m)) p.appendChild(missionCard(m, free)); });
      }
    } else p.appendChild(el('div', 'hint', !free ? (D.slots > 1 ? 'Both parties are away.' : 'The party is away. Another can leave when it returns.') : 'Everyone is away.'));

    p.appendChild(el('h2', 'sec', 'Heroes'));
    roster.forEach(function (h) { p.appendChild(heroCard(h, !!taken[h.id])); });
    C.HEROES.forEach(function (h) { if (C.heroAvailable(S, h)) p.appendChild(recruitCard(h)); });
    discBox(p);
    itemShelf(p);
  }

  /* ---------- age ---------- */
  function stageCostAt(i) { const t = C.TUNE.proj[S.age], c = {}; for (const r of C.RES) { const v = (t[r] && t[r][i]) || 0; if (v > 0) c[r] = Math.ceil(v * D.projCost); } return c; }
  function panelAge(p) {
    const pr = C.PROJECTS[S.age], tr = C.TRIALS[S.age], won = !!S.trialWon[S.age];
    p.appendChild(el('p', 'lede', C.AGES[S.age].intro));
    p.appendChild(el('h2', 'sec', pr.name));
    p.appendChild(projectCard());
    const list = el('div', 'stages');
    pr.stages.forEach(function (name, i) {
      const row = el('div', 'stage' + (i < S.project ? ' done' : i === S.project ? ' now' : '')), cv = costView(false);
      add(row, ic(i < S.project ? 'ui.check' : i === S.project ? 'ui.up' : 'ui.lock'), el('span', 'nm', name));
      if (i >= S.project) { add(row, cv.el, el('span', 'sm soft num wk', C.TUNE.work[S.age][i] + ' work')); live.push(function () { cv.set(stageCostAt(i)); }); }
      list.appendChild(row);
    });
    p.appendChild(list);
    p.appendChild(el('h2', 'sec', 'Trial of the age'));
    if (C.trialOpen(S) || won) {
      const card = el('div', 'card'), tags = el('div', 'stats');
      tags.appendChild(tag('trait.' + tr.trait, C.TRAITS[tr.trait].name, function () { info(C.TRAITS[tr.trait].name, 'trait.' + tr.trait, 'foe', [C.TRAITS[tr.trait].desc]); }));
      tags.appendChild(won ? stat('ui.check', 'Defeated', 'good') : stat('ui.loss', 'Undefeated', 'bad'));
      if (!won && S.trialTries[S.age]) tags.appendChild(tag('ui.loss', Math.round((1 - C.trialWear(S, S.age)) * 100) + '% weaker'));
      add(card, add(el('div', 'head'), tile('m.trial' + S.age, won ? 'dim' : 'boss', 'lg', function () { infoMission(C.MISSION['trial' + S.age]); }), add(el('div', 'mid'), el('div', 'name', tr.name), tags)), el('p', 'sm soft', tr.text));
      if (!won) card.appendChild(add(el('div', 'acts'), btn('To the heroes', function () { Snd.play('tap'); go('heroes'); }, 'alt', 'tab.heroes')));
      p.appendChild(card);
    } else p.appendChild(el('div', 'hint', S.age === 1 ? 'Something stirs in the high pass. Lay the foundations and call a hero first.' : 'It will show itself soon.'));
    if (S.age < 5) {
      const a = S.age + 1, card = el('div', 'card shadow');
      p.appendChild(el('h2', 'sec', 'What comes after'));
      add(card, add(el('div', 'head'), tile('age.' + a, 'dim', 'lg'), add(el('div', 'mid'), el('div', 'name', ageTitle(a)), el('div', 'sm soft', C.AGES[a].intro))));
      comingRow(C.BUILDINGS.filter(function (b) { return b.age === a; }).map(function (b) { return ['b.' + b.id, b.name]; }), 'New buildings').forEach(function (e) { card.appendChild(e); });
      comingRow(C.LANDMARKS.filter(function (l) { return l.age === a; }).map(function (l) { return ['lm.' + l.id, l.name, function () { landmarkSheet(l); }]; }), 'Landmarks').forEach(function (e) { card.appendChild(e); });
      comingRow(C.HEROES.filter(function (h) { return h.age === a; }).map(function (h) { return ['h.' + h.id, h.name + ', ' + h.role.toLowerCase()]; }).concat([['p.' + a, C.PROJECTS[a].name]]), 'Also').forEach(function (e) { card.appendChild(e); });
      p.appendChild(card);
    }
    p.appendChild(el('h2', 'sec', 'Annals'));
    const ol = el('ul', 'chron');
    S.log.slice(-40).reverse().forEach(function (e) {
      const d = new Date(e.t), li = el('li');
      add(li, el('time', null, d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), el('span', null, e.x));
      ol.appendChild(li);
    });
    p.appendChild(ol);
  }

  /* ---------- legacy ---------- */
  function panelLegacy(p) {
    const top = el('div', 'card feature'), pts = el('div', 'name bigname num'), gain = el('div', 'sm soft');
    add(top, add(el('div', 'head'), tile('tab.legacy', 'cap', 'lg'), add(el('div', 'mid'), pts, gain)));
    live.push(function () {
      setText(pts, S.legacy.pts + ' legacy');
      setText(gain, C.canDepart(S) || S.age === 5 ? 'Leaving this world now adds ' + C.legacyGain(S) + '.' : 'What one world learns, the next inherits.');
    });
    p.appendChild(top);
    if (!S.legacy.runs) p.appendChild(el('div', 'hint', 'Legacy is earned when the Ark departs: 40, and 4 more for every item you carry.'));
    p.appendChild(el('h2', 'sec', 'Advantages'));
    C.PERKS.forEach(function (k) {
      const card = el('div', 'card row'), t = tile('k.' + k.id, fxKind(k.fx)), b = el('button', 'btn buy'), q = el('span', 'q'), cost = el('span', 'cost num'), num = el('span'), pp = el('span');
      b.type = 'button'; b.dataset.act = 'perk:' + k.id; cost.appendChild(ic('ui.legacy')); cost.appendChild(num); add(b, q, cost);
      b.addEventListener('click', function () {
        if (!C.buyPerk(S, k.id)) { Snd.play('error'); FX.shake(b); return; }
        Snd.play('perk'); FX.pop(t); sparkle(t, fxKind(k.fx)); did();
      });
      add(card, t, add(el('div', 'mid'), el('div', 'name', k.name), pp, el('div', 'sm soft', k.desc)), b);
      let shown = -1;
      live.push(function () {
        const n = S.legacy.perks[k.id] || 0, c = C.perkCost(S, k.id);
        if (n !== shown) { shown = n; pp.textContent = ''; pp.appendChild(pips(n, k.max)); }
        if (c === null) { setText(q, 'Complete'); cost.style.display = 'none'; b.disabled = true; } else { setText(q, 'Raise'); cost.style.display = ''; setText(num, String(c)); b.disabled = S.legacy.pts < c; }
      });
      p.appendChild(card);
    });
    itemShelf(p);
    p.appendChild(el('p', 'sm soft', 'This is world ' + S.world + '. ' + (S.legacy.runs ? S.legacy.runs + (S.legacy.runs === 1 ? ' world has' : ' worlds have') + ' been left behind.' : 'No world has been left behind yet.')));
  }

  /* ---------- frame ---------- */
  function tabsOpen() {
    return TABS.filter(function (t) {
      return t[0] === 'realm' || (t[0] === 'town' && C.townOpen(S)) || (t[0] === 'tree' && C.councilOpen(S)) || (t[0] === 'heroes' && C.has(S, 'heroes')) || (t[0] === 'age' && C.ageTabOpen(S)) || (t[0] === 'legacy' && C.legacyOpen(S));
    });
  }
  function badges() {
    const b = {}, stage = C.ageTabOpen(S) && !C.projectDone(S) ? C.stageCost(S, D) : null;
    if (C.canAdvance(S) || C.canDepart(S) || (stage && C.stageReady(S, D))) { b.realm = 1; b.age = 1; }
    if (S.ev.cur || C.activeGoals(S).some(function (g) { return C.goalState(S, g).done; })) b.realm = 1;
    if (C.townOpen(S)) {
      if (S.seen.rank !== undefined && S.seen.rank !== S.rank) b.town = 1;
      if (S.rank >= 2 && (S.jobs.idle > 0 || (S.jobs.work > 0 && C.worksOpen(S) && S.work >= C.stageWork(S) - 1e-6))) b.town = 1;      // people with nothing to do
      if (C.LANDMARKS.some(function (l) { return C.landmarkState(S, l) === 'open' && C.canPay(S, C.landmarkCost(l)); })) b.town = 1;
    }
    if (C.has(S, 'edicts') && !(S.edict && S.edict.until > now())) b.realm = 1;
    if (C.councilOpen(S)) {
      if (C.openTechs(S).some(function (t) { return S.res.kn >= C.techCost(S, t, D); })) b.tree = 1;
      for (let a = 1; a <= S.age; a++) if (C.doctrineOpen(S, a)) b.tree = 1;
    }
    if (C.has(S, 'heroes')) {
      const taken = C.busy(S);
      if (S.reports.length || (S.parties.length < D.slots && Object.keys(S.heroes).some(function (id) { return !taken[id]; }))) b.heroes = 1;
      if (Object.keys(S.disc).some(function (id) { return S.disc[id] === 1 && C.canPay(S, C.outpostCost(id)); })) b.heroes = 1;
      if (C.ITEMS.some(function (x) { return S.items[x.id] === ''; })) b.heroes = 1;
    }
    if (C.legacyOpen(S) && C.PERKS.some(function (k) { const c = C.perkCost(S, k.id); return c !== null && S.legacy.pts >= c; })) b.legacy = 1;
    return b;
  }
  function signature() {
    const t = view.tab, a = [t, S.age, S.world, tabsOpen().length, view.qty, view.older, view.oldGround];
    if (t === 'realm') a.push(D.rate.gold < 5, !!S.b.farm, goalSig(), !!S.ev.cur, S.rank, C.townOpen(S), !!D.boost, C.ageTabOpen(S) && C.stageReady(S, D), C.BUILDINGS.filter(function (b) { return C.buildingVisible(S, b); }).length, C.ageTabOpen(S), S.project, !!S.trialWon[S.age], C.has(S, 'edicts'));
    else if (t === 'town') a.push(S.rank, !!S.ev.cur, C.LANDMARKS.map(function (l) { return C.landmarkState(S, l).charAt(0); }).join(''), S.log.length);
    else if (t === 'tree') a.push(Object.keys(S.tech).length, Object.keys(S.doctrine).join(), C.techCount(S) < 4);
    else if (t === 'heroes') a.push(Object.keys(S.heroes).map(function (id) { return id + S.heroes[id].lvl + '.' + S.heroes[id].gear; }).join(), D.heroPow, D.muster, D.time, D.loot, S.parties.map(function (x) { return x.m; }).join(), S.reports.length, Object.keys(openLog).filter(function (k) { return openLog[k]; }).join(), lineup.join(), D.slots, !!S.trialWon[S.age], S.trialTries[S.age] || 0, C.trialOpen(S), JSON.stringify(S.items), JSON.stringify(S.disc), C.citySlots(S));
    else if (t === 'age') a.push(S.project, !!S.trialWon[S.age], S.trialTries[S.age] || 0, C.trialOpen(S), S.log.length);
    else a.push(JSON.stringify(S.items), S.legacy.runs);
    return a.join('|');
  }
  function head() {
    const seen = { gold: true, mat: S.tot.mat > 0 || !!S.b.lumber || S.age > 1, kn: S.tot.kn > 0 || !!S.b.script || S.age > 1 };
    for (const r of C.RES) {
      $('col-' + r).classList.toggle('hid', !seen[r]);
      setText($('amt-' + r), fmt(S.res[r] >= 1000 ? S.res[r] : Math.floor(S.res[r])));
      setText($('rate-' + r), '+' + fmtC(D.rate[r]) + '/s');
    }
    const pr = C.PROJECTS[S.age]; let sub, n = 0, of = 0;
    if (C.canAdvance(S)) sub = ageTitle(S.age + 1) + ' awaits';
    else if (C.canDepart(S)) sub = 'The Ark is ready';
    else if (C.ageTabOpen(S)) { of = pr.stages.length; n = S.project; sub = C.RANKS[S.rank].name + ' of ' + peopleText(C.people(S)); }
    else sub = C.townOpen(S) ? C.RANKS[S.rank].name + ' of ' + peopleText(C.people(S)) : S.legacy.runs ? 'World ' + S.world : 'A settlement at the ford';
    if (launch) { setText($('title'), 'The Ark departs'); setText($('sub'), 'World ' + (S.world - 1) + ' falls away below'); of = 0; }
    else { setText($('title'), ageTitle(S.age)); setText($('sub'), sub); }
    if (of + ':' + n !== lastPips) { lastPips = of + ':' + n; const sp = $('stagepips'); sp.textContent = ''; for (let i = 0; i < of; i++) sp.appendChild(el('span', 'pip' + (i < n ? ' on' : ''))); }
    if (S.age !== lastEmblem) { lastEmblem = S.age; const em = $('emblem'); em.textContent = ''; em.appendChild(ic('age.' + S.age)); const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', THEME[S.age]); }
  }
  function drawTabs() {
    const nav = $('tabs'), open = tabsOpen(), b = badges();
    if (!open.some(function (t) { return t[0] === view.tab; })) view.tab = 'realm';
    nav.textContent = ''; nav.hidden = open.length < 2;
    open.forEach(function (t) {
      const bt = el('button', t[0] === view.tab ? 'on' : ''); bt.type = 'button'; bt.dataset.tab = t[0];
      add(bt, ic(t[2]), el('span', null, t[1]));
      if (b[t[0]] && t[0] !== view.tab) bt.appendChild(el('span', 'dot'));
      bt.addEventListener('click', function () { Snd.play('tap'); go(t[0]); });
      nav.appendChild(bt);
    });
    lastBadges = JSON.stringify(b);
  }
  function render() {
    D = C.derive(S, now());
    document.documentElement.setAttribute('data-age', String(S.age));
    drawTabs();
    const p = $('panel'), keep = p.scrollTop;
    live = []; p.textContent = '';
    ({ realm: panelRealm, town: panelTown, tree: panelTree, heroes: panelHeroes, age: panelAge, legacy: panelLegacy })[view.tab](p);
    head(); live.forEach(function (f) { f(); });
    tellScene(badges()); if (city) drawFeed();
    p.scrollTop = switched ? 0 : keep; lastSig = signature();
    if (switched) {
      switched = false;
      if (!FX.quiet) { p.classList.remove('enter'); void p.offsetWidth; p.classList.add('enter'); }
      if (view.tab === 'tree') focusTree(p);
    }
  }
  function refresh() {
    D = C.derive(S, now());
    if (signature() !== lastSig) { render(); return; }
    head(); live.forEach(function (f) { f(); });
    if (!$('modal').hidden) sheetLive.forEach(function (f) { f(); });
    const b = badges();
    if (JSON.stringify(b) !== lastBadges) drawTabs();
    tellScene(b); if (city) drawFeed();
  }
  function did() { cloud.dirty = true; saveSoon(); announce(); refresh(); drainNews(); }
  function drainNews() {                     // what the rules reported since the last look: named buildings raised, the town's rank
    if (!S.news || !S.news.length) return;
    const list = S.news.splice(0, S.news.length); let rank = 0;
    list.forEach(function (n) {
      if (n.k === 'mark') {
        const b = C.B[n.b];
        if (n.i >= C.NAMED) { toast(b.pl + ' produce twice as much again.'); return; }
        toast(b.marks[n.i] + ' raised. ' + b.pl + ' produce twice as much.');
        Snd.play('stage'); Scene.emit('mark', n.b);
        const t = document.querySelector('[data-act="buy:' + n.b + '"]'); if (t) sparkle(t, b.res, true);
      } else if (n.k === 'rank') rank = Math.max(rank, n.r);
      else if (n.k === 'idle') toast('The builders have nothing to raise. Give them a task in Town.');
    });
    if (rank) rankUp(rank);
    refresh();
  }
  function rankUp(r) {                       // the town has grown into something larger
    const R = C.RANKS[r], was = C.RANKS[r - 1].name.toLowerCase(), tint = getComputedStyle(document.documentElement);
    Snd.play('doctrine'); Scene.emit('rank');
    FX.confetti([tint.getPropertyValue('--trim-hi').trim() || '#ffe9a8', '#ffffff', '#c9a2ff'], 70);
    if (!$('modal').hidden || $('turn').classList.contains('on') || launch) { toast('The ' + was + ' has grown into a ' + R.name.toLowerCase() + '. See Town.'); return; }
    openSheet(function (sh) {
      sh.appendChild(sheetHead(tile(rankIcon(r), 'civ', 'lg'), 'A ' + R.name.toLowerCase(), 'The ' + was + ' has grown: ' + peopleText(C.people(S)) + ' live here now.'));
      sh.appendChild(el('p', 'lede', R.text));
      const needs = el('div', 'needs');
      C.rankOpens(r).forEach(function (t) { needs.appendChild(stat('ui.check', t, 'good')); });
      if (needs.firstChild) sh.appendChild(needs);
      sh.appendChild(add(el('div', 'acts'), view.tab === 'town' && !city ? null : btn('To the town', function () { Snd.play('tap'); goTab('town'); }, 'big', 'tab.town'), btn('Close', function () { closeSheet(); }, 'alt big')));
    }, true);
  }
  function announce() {                      // say once when a new part of the game opens
    const say = function (key, ok, text) { if (ok && !S.seen[key]) { S.seen[key] = 1; toast(text); } };
    say('town', C.townOpen(S), 'The hamlet is on the map. Town is open.');
    say('council', C.councilOpen(S), 'The first pages are written. Research is open.');
    say('age', C.ageTabOpen(S), 'The bishop proposes a cathedral. The great work can begin.');
    say('edicts', C.has(S, 'edicts'), 'You may now proclaim edicts from the Realm.');
    say('party2', C.has(S, 'party2'), 'A second party can now be away at the same time.');
    say('party3', C.has(S, 'party3'), 'A third party can now be away at the same time.');
  }
  function step(first) {
    const out = C.advance(S, now());
    if (out.reports && !out.away) {
      const fresh = S.reports.slice(-out.reports), win = fresh.some(function (r) { return r.result === 'win'; });
      Snd.play(fresh.some(function (r) { return r.relic; }) ? 'relic' : win ? 'victory' : fresh.some(function (r) { return r.result === 'draw'; }) ? 'draw' : 'defeat');
      toast(out.reports === 1 ? 'A party is back from ' + lowerFirst(C.MISSION[fresh[0].m].name) + '.' : out.reports + ' parties have returned.');
      fresh.forEach(function (r) { if (r.disc && C.DISCOVERY[r.disc]) toast('Found: ' + C.lowerThe(C.DISCOVERY[r.disc].name) + '.'); if (r.relic && C.ITEM[r.relic]) toast('Brought back: ' + C.ITEM[r.relic].name + '.'); });
      if (win) for (const r of C.RES) if (fresh.some(function (x) { return x.loot[r]; })) FX.bump($('col-' + r));
    }
    if (out.reports || out.away >= 60 || out.event) { cloud.dirty = true; saveSoon(); }
    if (out.event && !out.away) { Snd.play('open'); toast('News has reached the town.'); Scene.emit('news'); }
    const stageKey = S.age + ':' + S.project, worked = C.worksOpen(S) && S.work >= C.stageWork(S) - 1e-6;
    if (worked && workSaid !== stageKey && out.work > 0 && !out.away) toast(S.jobs.work > 0 ? 'The work for this stage is done. The builders can be given other tasks.' : 'The work for this stage is done.');
    if (worked) workSaid = stageKey;
    announce();
    if (first) { switched = true; render(); } else refresh();
    if (out.away >= 300 && $('modal').hidden && !$('turn').classList.contains('on')) showAway(out);
    drainNews();
  }
  function checkUpdate() {                   // the Android app asks GitHub whether a newer build exists
    if (!NATIVE || navigator.onLine === false) return;
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      const v = j && j.tag_name ? parseInt(String(j.tag_name).replace(/[^0-9]/g, ''), 10) : 0;
      if (v > VERSION) { const u = $('update'); u.textContent = 'Version ' + v + ' is ready. Tap to download it.'; u.href = APK_URL; u.hidden = false; }
    }).catch(function () { /* offline or rate limited: ask again next time */ });
  }
  function lowerFirst(t) { return /^The /.test(t) ? 'the ' + t.slice(4) : t.charAt(0).toLowerCase() + t.slice(1); }
  function frame() {
    if (!document.hidden) {
      const t = now();
      if (launch) {
        const f = (t - launch.t0) / 5200;
        if (f >= 1) { const g = launch.gain; launch = null; Snd.setAge(S.age); turnPage('A new world', 'The Ark has made landfall. You carry ' + g + ' legacy and everything the old world learned.', 'ui.world', 4600); }
        else Scene.draw(launch.state, t, { lift: f < 0.12 ? 0.01 : Math.pow((f - 0.12) / 0.88, 2.2) * 190 });
      }
      if (!launch) Scene.draw(S, t);
    }
    setTimeout(function () { requestAnimationFrame(frame); }, Scene.still ? 1500 : city ? 24 : 70);
  }
  function start(hot) {
    let local = null, hotState = null;
    try { const raw = localStorage.getItem(LOCAL_KEY); local = C.load(raw, now()); oldRealm = !local && C.isOldSave(raw); } catch (e) { local = null; }
    try { const v = JSON.parse(localStorage.getItem(VIEW_KEY)); if (v && typeof v === 'object') for (const k in view) if (v[k] !== undefined) view[k] = v[k]; } catch (e) { /* defaults */ }
    if (hot && hot.save) { hotState = C.load(hot.save, now()); if (hot.view) for (const k in view) if (hot.view[k] !== undefined) view[k] = hot.view[k]; }
    S = hotState && (!local || (hotState.saved || 0) >= (local.saved || 0)) ? hotState : local;
    bootSaved = S ? (S.saved || 0) : 0;
    if (!S) S = C.newState(now());
    if ([1, 10, 'max'].indexOf(view.qty) < 0) view.qty = 1;
    if (!TABS.some(function (t) { return t[0] === view.tab; })) view.tab = 'realm';
    try { Scene.still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { Scene.still = false; }
    Scene.attach($('scene'));
    FX.init($('fx'), $('floaters'), $('app'));
    Snd.init('audio/'); Snd.setAge(S.age);
    for (const r of C.RES) $('ico-' + r).appendChild(ic('res.' + r));
    $('menu').appendChild(ic('ui.menu'));
    $('menu').addEventListener('click', openMenu);
    $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeSheet(); });
    cityTouch();
    window.addEventListener('popstate', onPop);
    booted = true;
    if (!bootSaved) turnPage('Long Ascent', oldRealm ? 'Version ' + VERSION + ' changes how a realm grows, so the old one could not be carried over. A new settlement is founded at the ford.' : C.AGES[1].intro, 'ui.climb', 0, true);
    step(true);
    setInterval(function () { step(false); }, 250);
    setInterval(saveLocal, 15000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { saveLocal(); pushCloud(); } else step(false); });
    window.addEventListener('pagehide', function () { saveLocal(); pushCloud(); });
    document.addEventListener('apppause', function () { saveLocal(); });                      // the Android app going to the background
    document.addEventListener('appresume', function () { step(false); });
    window.addEventListener('resize', function () { if (view.tab === 'tree') render(); if (city) redraw(); });
    requestAnimationFrame(frame);
    initCloud();
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(function () { return { save: C.serialize(S, now()), view: view }; });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1') && !NATIVE && !window.claude) {
      navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }).then(function (reg) {
        if (reg.active) reg.active.postMessage({ cache: [1, 2, 3, 4, 5].map(function (a) { return new URL('audio/music/age' + a + '.mp3', location.href).href; }) });
      }).catch(function () { /* the game works without it */ });
    }
    checkUpdate();
    window.__la = { get state() { return S; }, set: function (st) { adopt(st); }, scene: Scene, go: go, city: openCity, leave: closeCity, touch: citySite, news: eventSheet, chronicle: chronicleSheet };
    window.__back = goBack;                  // the Android app calls this when Back is pressed
  }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
