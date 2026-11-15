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
  const TABS = [['realm', 'Realm', 'tab.realm'], ['tree', 'Research', 'tab.council'], ['heroes', 'Heroes', 'tab.heroes'], ['age', 'Age', 'tab.age'], ['legacy', 'Legacy', 'tab.legacy']];
  const $ = function (id) { return document.getElementById(id); };
  const now = function () { return Date.now(); };
  const fmt = C.fmt, fmtTime = C.fmtTime;
  const fmtC = function (n) { return fmt(n).replace(/(\.\d*?)0+([A-Za-z]*)$/, '$1$2').replace(/\.([A-Za-z]*)$/, '$1'); };   // fixed prices read better without trailing zeros
  let S = null, D = null, booted = false, bootSaved = 0;
  let view = { tab: 'realm', qty: 1, older: false, oldGround: false };
  let lineup = [], openLog = {}, live = [], sheetLive = [], lastSig = '', lastBadges = '', lastPips = '', lastEmblem = 0, launch = null, toastTimer = 0, saveTimer = 0, switched = true;
  let histOpen = false, skipPop = 0;
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
      case 'b': return C.B[fx.b].res;
      case 'res': return fx.res;
      case 'techCost': return 'kn';
      case 'unlock': case 'projCost': return 'civ';
      case 'store': case 'time': return 'log';
      case 'hero': case 'loot': return 'arm';
      default: return 'cap';
    }
  }
  function ageTitle(a) { return 'The ' + C.AGES[a].name; }
  function hours(h) { return (Math.round(h * 10) / 10) + 'h'; }
  function short(name) { return name.replace(/^The /, ''); }
  function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { e.classList.remove('on'); }, 2800); }
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
  /* An open sheet is one step in the browser history, so the phone's back button closes it instead of leaving the game. */
  function openSheet(build, silent) {
    const sh = $('sheet'); sh.textContent = ''; sheetLive = []; build(sh); $('modal').hidden = false; sh.scrollTop = 0; sheetLive.forEach(function (f) { f(); });
    if (!silent) Snd.play('open');
    if (!histOpen) { try { history.pushState({ sheet: 1 }, ''); histOpen = true; } catch (e) { /* no history here */ } }
  }
  function closeSheet(fromBack) {
    $('modal').hidden = true; $('sheet').textContent = ''; sheetLive = [];
    if (fromBack === true) { histOpen = false; return; }
    if (histOpen) { histOpen = false; skipPop++; try { history.back(); } catch (e) { skipPop--; } }
  }
  function onPop() {
    if (skipPop > 0) {                     // our own step back; a sheet opened in the meantime needs its own step
      skipPop--;
      if (!$('modal').hidden && !histOpen) { try { history.pushState({ sheet: 1 }, ''); histOpen = true; } catch (e) { /* ignore */ } }
      return;
    }
    if (!$('modal').hidden) closeSheet(true); else histOpen = false;
  }
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
      if (S.reports.length) sh.appendChild(add(el('div', 'stats'), tag('tab.heroes', S.reports.length === 1 ? 'One party has returned' : S.reports.length + ' parties have returned')));
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
        if (!st2) { note.textContent = 'That text is not a Long Ascent save. Copy it again in full and retry.'; Snd.play('error'); return; }
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
      sh.appendChild(el('p', 'sm soft', 'Erases this realm, its legacy and its relics.'));
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
      add(sh, add(el('div', 'stats'), stat('ui.legacy', '+' + C.legacyGain(S) + ' legacy', 'c-gold'), stat('ui.relic', C.relicCount(S) + ' relics travel with you')));
      sh.appendChild(el('p', 'sm soft', 'Buildings, research, stock and the heroes of this world stay behind. Legacy buys advantages that last for every world to come.'));
      add(sh, add(el('div', 'acts'), btn('Launch the Ark', function () {
        closeSheet(); const old = JSON.parse(JSON.stringify(S)); const gain = C.depart(S, now());
        if (!gain) return;
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

  /* ---------- realm ---------- */
  function infoStore() {
    info('Storehouses', 'ui.store', 'log', ['While the game is closed, your buildings keep working until the storehouses are full.',
      add(el('div', 'stats'), stat('ui.clock', 'They hold ' + hours(D.storeH) + ' of output')),
      'Research, one doctrine and a legacy advantage make them deeper.']);
  }
  function edictSheet() {
    openSheet(function (sh) {
      sh.appendChild(sheetHead(tile('ui.edict', 'civ', 'lg'), 'Edicts', 'One at a time. Each lasts ' + C.EDICT_HOURS + ' hours.'));
      C.EDICTS.forEach(function (e) {
        const on = S.edict && S.edict.id === e.id && S.edict.until > now(), card = el('div', 'card row' + (on ? ' feature' : ''));
        add(card, tile('e.' + e.id, fxKind(e.fx)), add(el('div', 'mid'), el('div', 'name', e.name), el('div', 'sm soft', e.desc)),
          btn(on ? 'Renew' : 'Proclaim', function () {
            if (!C.setEdict(S, e.id, now())) return;
            closeSheet(); Snd.play('edict'); toast(e.name + ' is proclaimed.'); did();
            const t = document.querySelector('[data-act="edict"]'); if (t) sparkle(t, fxKind(e.fx));
          }, on ? 'alt' : ''));
        sh.appendChild(card);
      });
      sh.appendChild(closeRow());
    });
  }
  function infoBuilding(b) {
    const n = C.count(S, b.id), u = C.unitRate(S, D, b), next = C.nextMilestone(n);
    info(b.name, 'b.' + b.id, b.res, [b.desc,
      add(el('div', 'stats'), stat('res.' + b.res, fmtC(u) + '/s each', 'c-' + b.res), n ? stat('res.' + b.res, fmtC(u * n) + '/s in all', 'c-' + b.res) : null),
      next ? 'At ' + next + ' of them, every one produces twice as much.' : 'Every doubling has been reached.']);
  }
  function infoProject() {
    const pr = C.PROJECTS[S.age];
    info(pr.name, 'p.' + S.age, 'cap', ['The great work of this age. It is built in ' + pr.stages.length + ' stages, and each one appears in the settlement above.',
      'When it is finished and the trial of the age is won, the next age begins.']);
  }
  function workCard() {
    const card = el('div', 'card work');
    const b = btn('Work the land', function (bt, ev) {
      const g = C.work(S, now()), from = ev && (ev.clientX || ev.clientY) ? ev : bt;
      Snd.play('coin', { rate: 0.94 + Math.random() * 0.14 });
      FX.float(from, '+' + fmtC(g), { color: RC.gold, icon: ic('res.gold'), dy: -30 });
      FX.fly(from, $('col-gold'), { n: 1, size: 7 }, function () { FX.bump($('col-gold')); });
      did();
    }, 'ready', 'ui.work');
    b.dataset.act = 'work';
    add(card, b, el('div', 'sm soft', S.b.farm ? 'Keep working until the farmsteads carry the settlement.' : 'No coin yet. Work by hand until the first farmstead stands.'));
    return card;
  }
  function projectCard() {
    const pr = C.PROJECTS[S.age], card = el('div', 'card feature'), mid = el('div', 'mid');
    if (C.canAdvance(S)) {
      const b = btn('Enter the ' + C.AGES[S.age + 1].name, enterNextAge, 'big ready', 'ui.climb'); b.dataset.act = 'advance';
      add(card, add(el('div', 'head'), tile('age.' + (S.age + 1), 'cap', 'lg'), add(mid, el('div', 'name', pr.done), el('div', 'sm soft', C.TRIALS[S.age].name + ' is defeated.'))), add(el('div', 'acts'), b));
    } else if (C.canDepart(S)) {
      const b = btn('Launch the Ark', askDepart, 'big ready', 'p.5'); b.dataset.act = 'depart';
      add(card, add(el('div', 'head'), tile('p.5', 'cap', 'lg'), add(mid, el('div', 'name', 'The Ark stands fuelled'), el('div', 'sm soft', 'The launch corridor is clear.'))), add(el('div', 'acts'), b));
    } else if (C.projectDone(S)) {
      const tr = C.TRIALS[S.age];
      add(card, add(el('div', 'head'), tile('m.trial' + S.age, 'boss', 'lg', function () { infoMission(C.MISSION['trial' + S.age]); }), add(mid, el('div', 'name', tr.name), el('div', 'sm soft', pr.done + ' One enemy still bars the way.'))));
      if (view.tab !== 'heroes') add(card, add(el('div', 'acts'), btn('To the heroes', function () { Snd.play('tap'); go('heroes'); }, 'alt big', 'tab.heroes')));
    } else {
      const cv = costView(false), bar = el('div', 'bar'), fill = el('i'), eta = el('span', 'sm soft num'); bar.appendChild(fill);
      const b = btn('Build', function (bt) {
        if (!C.buildStage(S, now())) { Snd.play('error'); FX.shake(bt); return; }
        Snd.play('stage'); FX.burst($('scene'), { n: 44, color: ['#ffe9a8', '#ffffff', '#f4cb5e'], speed: 280, life: 1.1, size: 4 }); FX.ring($('scene'), '#fff3c4', 130, 6);
        did();
      }, 'big', 'ui.up');
      b.dataset.act = 'build';
      add(card, add(el('div', 'head'), tile('p.' + S.age, 'cap', 'lg', infoProject), add(mid, add(el('div', 'line'), el('div', 'name', pr.name), pips(S.project, pr.stages.length)), el('div', 'sm soft', pr.stages[S.project]), cv.el)), add(el('div', 'barrow gap'), bar, eta), add(el('div', 'acts'), b));
      live.push(function () {
        const c = C.stageCost(S, D); if (!c) return;
        cv.set(c); let f = 1, wait = 0;
        for (const r in c) { f = Math.min(f, S.res[r] / c[r]); if (S.res[r] < c[r]) wait = Math.max(wait, D.rate[r] > 0 ? (c[r] - S.res[r]) / D.rate[r] : Infinity); }
        fill.style.width = Math.round(100 * Math.max(0, Math.min(1, f))) + '%';
        const ok = C.canPay(S, c); b.disabled = !ok; b.classList.toggle('ready', ok);
        setText(eta, ok ? 'ready' : isFinite(wait) ? fmtTime(wait) : '');
      });
    }
    return card;
  }
  function buildingCard(b) {
    const card = el('div', 'card row'), t = tile('b.' + b.id, b.res, '', function () { infoBuilding(b); }), badge = el('span', 'badge');
    const outN = stat('res.' + b.res, '', 'c-' + b.res), bar = el('div', 'bar thin'), fill = el('i'), nx = el('span', 'num');
    const buy = el('button', 'btn buy'), q = el('span', 'q'), cv = costView(true);
    t.appendChild(badge); bar.appendChild(fill); buy.type = 'button'; buy.dataset.act = 'buy:' + b.id; add(buy, q, cv.el);
    buy.addEventListener('click', function () {
      const n = C.buy(S, b.id, view.qty);
      if (!n) { Snd.play('error'); FX.shake(buy); return; }
      Snd.play('buy'); FX.pop(t); FX.burst(t, { n: 10, color: [RC[b.res], '#fff'], speed: 130, life: 0.55 }); FX.float(t, '+' + n, { color: '#fff', dy: -34 });
      did();
    });
    add(card, t, add(el('div', 'mid'), el('div', 'name', b.name), add(el('div', 'stats'), outN), add(el('div', 'barrow'), bar, nx)), buy);
    live.push(function () {
      const n = C.count(S, b.id), next = C.nextMilestone(n);
      let prev = 0; for (const m of C.MILESTONES) if (m <= n) prev = m;
      setText(badge, String(n)); badge.style.display = n ? '' : 'none';
      setText(outN.b, '+' + fmtC(C.unitRate(S, D, b) * Math.max(1, n)) + '/s');
      fill.style.width = (next ? Math.round(100 * (n - prev) / (next - prev)) : 100) + '%';
      setText(nx, next ? 'x2 at ' + next : 'max');
      const qn = view.qty === 'max' ? Math.max(1, C.maxQty(S, b)) : view.qty, c = C.buildCost(b, n, qn);
      setText(q, 'Buy ' + qn); cv.set(c); buy.disabled = !C.canPay(S, c);
    });
    return card;
  }
  function nextGoal() {                      // one line of direction for a first world
    if (S.age > 1 || S.legacy.runs) return '';
    if (C.count(S, 'farm') < 5) return 'Five farmsteads bring woodcutters to the forest edge.';
    if (C.count(S, 'lumber') < 3) return 'Three lumber camps let the monks raise a scriptorium.';
    if (!C.councilOpen(S)) return 'The first page of knowledge opens Research.';
    if (!C.ageTabOpen(S)) return 'Three researched topics open the great work of this age.';
    if (!C.has(S, 'heroes')) return 'Research the Oath of watch to call your first hero.';
    return '';
  }
  function panelRealm(p) {
    const tags = el('div', 'stats top'), store = tag('ui.store', '', infoStore);
    tags.appendChild(store); live.push(function () { setText(store.lbl, hours(D.storeH) + ' storage'); });
    if (C.has(S, 'edicts')) {
      const e = tag('ui.edict', '', function () { edictSheet(); }); e.dataset.act = 'edict'; tags.appendChild(e);
      live.push(function () { const on = S.edict && S.edict.until > now(); setText(e.lbl, on ? C.EDICT[S.edict.id].name + ' ' + fmtTime((S.edict.until - now()) / 1000) : 'Proclaim an edict'); e.classList.toggle('call', !on); });
    }
    p.appendChild(tags);
    if (D.rate.gold < 5) p.appendChild(workCard());
    if (C.ageTabOpen(S)) p.appendChild(projectCard());
    p.appendChild(sec('Buildings', seg([[1, 'x1'], [10, 'x10'], ['max', 'Max']], view.qty, function (v) { view.qty = v; saveView(); render(); })));
    C.BUILDINGS.forEach(function (b) { if (b.age === S.age && C.buildingVisible(S, b)) p.appendChild(buildingCard(b)); });
    const goal = nextGoal(); if (goal) p.appendChild(el('div', 'hint', goal));
    if (S.age > 1) {
      p.appendChild(add(el('div', 'acts'), btn(view.older ? 'Hide earlier ages' : 'Show earlier ages', function () { Snd.play('tap'); view.older = !view.older; saveView(); render(); }, 'alt')));
      if (view.older) for (let a = S.age - 1; a >= 1; a--) {
        p.appendChild(el('h2', 'sec', C.AGES[a].name));
        C.BUILDINGS.forEach(function (b) { if (b.age === a) p.appendChild(buildingCard(b)); });
      }
    }
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
      if (st === 'owned') { add(sh, add(el('div', 'stats'), stat('ui.check', 'Researched', 'good')), closeRow()); return; }
      const needs = el('div', 'needs');
      t.all.forEach(function (id) { needs.appendChild(needLine(C.TECH[id].name, !!S.tech[id])); });
      if (t.any.length) needs.appendChild(needLine(t.any.map(function (id) { return C.TECH[id].name; }).join(' or '), t.any.some(function (id) { return S.tech[id]; })));
      if (needs.firstChild) sh.appendChild(needs);
      const cv = costView(false), eta = el('span', 'sm soft num');
      const b = btn('Research', function (bt) {
        if (!C.research(S, t.id, now())) { Snd.play('error'); FX.shake(bt); return; }
        closeSheet(); Snd.play('research');
        if (t.fx.type === 'unlock' && t.fx.what === 'heroes') toast('The Warden has sworn the oath. Heroes are open.');
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
    return add(band, grove, ribbon(a));
  }
  function panelTree(p) {
    const W = Math.max(270, Math.min(340, (p.clientWidth || 360) - 20));
    if (S.age < 5) { const f = el('div', 'treeband future'); f.style.width = W + 'px'; f.appendChild(ribbon(S.age + 1, true)); p.appendChild(f); }
    for (let a = S.age; a >= 1; a--) p.appendChild(treeBand(a, W));
    if (S.age === 1 && C.techCount(S) < 4) p.appendChild(el('div', 'hint', 'Each age grows a tree. Lines show what a node needs, and the three diamonds on top are a doctrine: you keep only one.'));
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
      }
      sh.appendChild(closeRow());
    });
  }
  function infoMission(m) {
    const tr = m.trait ? C.TRAITS[m.trait] : null;
    info(m.name, 'm.' + m.id, m.trial ? 'boss' : 'foe', [m.text || null,
      tr ? add(el('div', 'stats'), tag('trait.' + m.trait, tr.name)) : null, tr ? tr.desc : 'Nothing unusual is reported about this enemy.',
      m.trial ? 'Victory yields a relic and clears the way to ' + (m.age < 5 ? 'the next age' : 'the launch') + '. A failed attempt still wears the enemy down.'
        : 'The plunder is counted in hours of your own output, so it grows with the realm.' + (m.age < S.age ? ' Ground from an earlier age yields half.' : '')]);
  }
  function infoRelic(r) {
    const have = !!S.relics[r.id], from = C.MISSION[r.from];
    info(have ? r.name : 'Unknown relic', have ? r.id : 'ui.lock', have ? 'cap' : 'dim', have ? [r.desc, 'Relics travel with you to every new world.']
      : [from && from.age <= S.age ? 'Said to lie where this leads: ' + from.name + '.' : 'It lies in an age you have not reached.']);
  }
  function relicShelf(p) {
    p.appendChild(sec('Relics', el('span', 'sm soft num', C.relicCount(S) + ' of ' + C.RELICS.length)));
    const g = el('div', 'relics');
    C.RELICS.forEach(function (r) { const have = !!S.relics[r.id]; g.appendChild(tile(have ? r.id : 'ui.lock', have ? 'cap' : 'dim', 'sm', function () { infoRelic(r); })); });
    p.appendChild(g);
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
    if (r.relic) card.appendChild(add(el('div', 'head found'), tile(r.relic, 'cap', 'sm'), add(el('div', 'mid'), el('div', 'name', C.RELIC[r.relic].name), el('div', 'sm good', C.RELIC[r.relic].desc))));
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
    st.appendChild(stat('ui.clock', fmtTime(C.missionTime(m, D, lineup))));
    if (tr) st.appendChild(tag('trait.' + m.trait, tr.name, function () { info(tr.name, 'trait.' + m.trait, 'foe', [tr.desc]); }));
    if (m.trial && S.trialTries[m.age]) st.appendChild(tag('ui.loss', Math.round((1 - C.trialWear(S, m.age)) * 100) + '% weaker'));
    if (m.trial) add(loot, stat('ui.relic', 'Relic', 'c-gold'), stat('ui.flag', m.age < 5 ? 'Opens the next age' : 'Clears the launch'));
    else {
      for (const r of C.RES) if (m.loot[r]) { lootN[r] = stat('res.' + r, '', 'c-' + r); loot.appendChild(lootN[r]); }
      const rel = C.RELICS.find(function (x) { return x.from === m.id; });
      if (rel && !S.relics[rel.id]) loot.appendChild(stat('ui.relic', 'Relic ' + Math.round(m.relic * 100) + '%', 'c-gold'));
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
      add(el('div', 'stats under'), gear, tag('ui.star', h.ability, function () { infoHero(h); })));
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
      Snd.play('recruit'); toast(h.name + ' joins the realm.'); did();
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
    relicShelf(p);
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
      if (i >= S.project) { row.appendChild(cv.el); live.push(function () { cv.set(stageCostAt(i)); }); }
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
    p.appendChild(el('h2', 'sec', 'Chronicle'));
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
    if (!S.legacy.runs) p.appendChild(el('div', 'hint', 'Legacy is earned when the Ark departs: 40, and 4 more for every relic you carry.'));
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
    relicShelf(p);
    p.appendChild(el('p', 'sm soft', 'This is world ' + S.world + '. ' + (S.legacy.runs ? S.legacy.runs + (S.legacy.runs === 1 ? ' world has' : ' worlds have') + ' been left behind.' : 'No world has been left behind yet.')));
  }

  /* ---------- frame ---------- */
  function tabsOpen() {
    return TABS.filter(function (t) {
      return t[0] === 'realm' || (t[0] === 'tree' && C.councilOpen(S)) || (t[0] === 'heroes' && C.has(S, 'heroes')) || (t[0] === 'age' && C.ageTabOpen(S)) || (t[0] === 'legacy' && C.legacyOpen(S));
    });
  }
  function badges() {
    const b = {}, stage = C.ageTabOpen(S) && !C.projectDone(S) ? C.stageCost(S, D) : null;
    if (C.canAdvance(S) || C.canDepart(S) || (stage && C.canPay(S, stage))) { b.realm = 1; b.age = 1; }
    if (C.has(S, 'edicts') && !(S.edict && S.edict.until > now())) b.realm = 1;
    if (C.councilOpen(S)) {
      if (C.openTechs(S).some(function (t) { return S.res.kn >= C.techCost(S, t, D); })) b.tree = 1;
      for (let a = 1; a <= S.age; a++) if (C.doctrineOpen(S, a)) b.tree = 1;
    }
    if (C.has(S, 'heroes')) {
      const taken = C.busy(S);
      if (S.reports.length || (S.parties.length < D.slots && Object.keys(S.heroes).some(function (id) { return !taken[id]; }))) b.heroes = 1;
    }
    if (C.legacyOpen(S) && C.PERKS.some(function (k) { const c = C.perkCost(S, k.id); return c !== null && S.legacy.pts >= c; })) b.legacy = 1;
    return b;
  }
  function signature() {
    const t = view.tab, a = [t, S.age, S.world, tabsOpen().length, view.qty, view.older, view.oldGround];
    if (t === 'realm') a.push(D.rate.gold < 5, !!S.b.farm, nextGoal(), C.BUILDINGS.filter(function (b) { return C.buildingVisible(S, b); }).length, C.ageTabOpen(S), S.project, !!S.trialWon[S.age], C.has(S, 'edicts'));
    else if (t === 'tree') a.push(Object.keys(S.tech).length, Object.keys(S.doctrine).join(), C.techCount(S) < 4);
    else if (t === 'heroes') a.push(Object.keys(S.heroes).map(function (id) { return id + S.heroes[id].lvl + '.' + S.heroes[id].gear; }).join(), D.heroPow, D.muster, D.time, D.loot, S.parties.map(function (x) { return x.m; }).join(), S.reports.length, Object.keys(openLog).filter(function (k) { return openLog[k]; }).join(), lineup.join(), D.slots, !!S.trialWon[S.age], S.trialTries[S.age] || 0, C.trialOpen(S), C.relicCount(S));
    else if (t === 'age') a.push(S.project, !!S.trialWon[S.age], S.trialTries[S.age] || 0, C.trialOpen(S), S.log.length);
    else a.push(C.relicCount(S), S.legacy.runs);
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
    else if (C.ageTabOpen(S)) { of = pr.stages.length; n = S.project; sub = C.projectDone(S) ? C.TRIALS[S.age].name : pr.name + ': ' + pr.stages[S.project].toLowerCase(); }
    else sub = S.legacy.runs ? 'World ' + S.world : 'A settlement at the ford';
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
    ({ realm: panelRealm, tree: panelTree, heroes: panelHeroes, age: panelAge, legacy: panelLegacy })[view.tab](p);
    head(); live.forEach(function (f) { f(); });
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
    if (JSON.stringify(badges()) !== lastBadges) drawTabs();
  }
  function did() { cloud.dirty = true; saveSoon(); announce(); refresh(); }
  function announce() {                      // say once when a new part of the game opens
    const say = function (key, ok, text) { if (ok && !S.seen[key]) { S.seen[key] = 1; toast(text); } };
    say('council', C.councilOpen(S), 'The first pages are written. Research is open.');
    say('age', C.ageTabOpen(S), 'The bishop proposes a cathedral. The great work can begin.');
    say('edicts', C.has(S, 'edicts'), 'You may now proclaim edicts from the Realm.');
    say('party2', C.has(S, 'party2'), 'A second party can now be away at the same time.');
  }
  function step(first) {
    const out = C.advance(S, now());
    if (out.reports && !out.away) {
      const fresh = S.reports.slice(-out.reports), win = fresh.some(function (r) { return r.result === 'win'; });
      Snd.play(fresh.some(function (r) { return r.relic; }) ? 'relic' : win ? 'victory' : fresh.some(function (r) { return r.result === 'draw'; }) ? 'draw' : 'defeat');
      toast(out.reports === 1 ? 'A party is back from ' + lowerFirst(C.MISSION[fresh[0].m].name) + '.' : out.reports + ' parties have returned.');
      if (win) for (const r of C.RES) if (fresh.some(function (x) { return x.loot[r]; })) FX.bump($('col-' + r));
    }
    if (out.reports || out.away >= 60) { cloud.dirty = true; saveSoon(); }
    announce();
    if (first) { switched = true; render(); } else refresh();
    if (out.away >= 300 && $('modal').hidden && !$('turn').classList.contains('on')) showAway(out);
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
    setTimeout(function () { requestAnimationFrame(frame); }, Scene.still ? 1500 : 70);
  }
  function start(hot) {
    let local = null, hotState = null;
    try { local = C.load(localStorage.getItem(LOCAL_KEY), now()); } catch (e) { local = null; }
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
    window.addEventListener('popstate', onPop);
    booted = true;
    if (!bootSaved) turnPage('Long Ascent', C.AGES[1].intro, 'ui.climb', 0, true);
    step(true);
    setInterval(function () { step(false); }, 250);
    setInterval(saveLocal, 15000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { saveLocal(); pushCloud(); } else step(false); });
    window.addEventListener('pagehide', function () { saveLocal(); pushCloud(); });
    window.addEventListener('resize', function () { if (view.tab === 'tree') render(); });
    requestAnimationFrame(frame);
    initCloud();
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(function () { return { save: C.serialize(S, now()), view: view }; });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1') && !NATIVE && !window.claude) {
      navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }).then(function (reg) {
        if (reg.active) reg.active.postMessage({ cache: [1, 2, 3, 4, 5].map(function (a) { return new URL('audio/music/age' + a + '.mp3', location.href).href; }) });
      }).catch(function () { /* the game works without it */ });
    }
    checkUpdate();
    window.__la = { get state() { return S; }, set: function (st) { adopt(st); }, scene: Scene, go: go };
  }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
