/* Long Ascent: sound. One music track per age, played through an audio element (it streams, so nothing large is
   decoded up front), and short effects decoded once into Web Audio buffers. Nothing plays before the first
   touch, and everything stops while the app is in the background. */
(function () {
  'use strict';
  const KEY = 'long-ascent-audio-v1', GAP_MS = 14000;
  const NAMES = ['tap', 'open', 'coin', 'buy', 'research', 'doctrine', 'edict', 'stage', 'recruit', 'equip', 'send', 'victory', 'defeat', 'draw', 'relic', 'collect', 'perk', 'ageup', 'depart', 'error'];
  const set = { music: 0.6, sfx: 0.8 };
  let base = 'audio/', ctx = null, out = null, unlocked = false, hidden = false, napping = false, cur = null, curAge = 0, wantAge = 1;
  const buf = {}, lastAt = {};

  function save() { try { localStorage.setItem(KEY, JSON.stringify(set)); } catch (e) { /* no storage here */ } }
  function clamp(v) { return Math.max(0, Math.min(1, +v || 0)); }
  function fade(a, to, ms, then) {
    clearInterval(a._fade);
    const from = a.volume, t0 = Date.now();
    a._fade = setInterval(function () {
      const f = Math.min(1, (Date.now() - t0) / ms);
      try { a.volume = clamp(from + (to - from) * f); } catch (e) { /* some browsers fix the volume */ }
      if (f >= 1) { clearInterval(a._fade); if (then) then(); }
    }, 60);
  }
  function drop(a) {
    a._dead = true; clearTimeout(a._gap);
    fade(a, 0, 1200, function () { try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { /* already gone */ } });
  }
  function music() {
    if (!unlocked || hidden) return;
    if (set.music <= 0) { if (cur) { drop(cur); cur = null; curAge = 0; } return; }
    if (cur && curAge === wantAge) {
      if (cur.paused && !cur._gap) cur.play().catch(function () {});
      return;
    }
    if (cur) drop(cur);
    const a = new Audio(base + 'music/age' + wantAge + '.mp3');
    a.preload = 'auto'; a.volume = 0; cur = a; curAge = wantAge;
    a.addEventListener('ended', function () {            // let the room breathe, then play it again
      if (a._dead) return;
      a._gap = setTimeout(function () {
        a._gap = 0;
        if (a._dead || hidden || set.music <= 0) return;
        try { a.currentTime = 0; a.volume = clamp(set.music); } catch (e) { /* ignore */ }
        a.play().catch(function () {});
      }, GAP_MS);
    });
    a.addEventListener('error', function () { if (cur === a) { cur = null; curAge = 0; } });
    const p = a.play();
    if (p && p.then) p.then(function () { fade(a, clamp(set.music), 2500); }).catch(function () { if (cur === a) { cur = null; curAge = 0; } });
    else fade(a, clamp(set.music), 2500);
  }
  function loadOne(name) {
    return fetch(base + 'sfx/' + name + '.mp3').then(function (r) { if (!r.ok) throw new Error(name); return r.arrayBuffer(); })
      .then(function (b) { return new Promise(function (ok, no) { ctx.decodeAudioData(b, ok, no); }); })
      .then(function (ab) { buf[name] = ab; }).catch(function () { /* a missing effect is silent */ });
  }
  function unlock() {
    if (unlocked) { if (ctx && ctx.state === 'suspended' && !hidden) ctx.resume().catch(function () {}); return; }
    unlocked = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        ctx = new AC(); out = ctx.createGain(); out.gain.value = clamp(set.sfx); out.connect(ctx.destination);
        if (ctx.state === 'suspended') ctx.resume().catch(function () {});
        NAMES.forEach(loadOne);
      }
    } catch (e) { ctx = null; }
    music();
  }
  function onHide() {
    hidden = document.hidden || napping;
    if (hidden) {
      if (cur) { clearInterval(cur._fade); try { cur.pause(); } catch (e) { /* ignore */ } }
      if (ctx && ctx.state === 'running') ctx.suspend().catch(function () {});
    } else {
      if (ctx && ctx.state === 'suspended' && unlocked) ctx.resume().catch(function () {});
      if (cur && !cur._gap && set.music > 0) { try { cur.volume = clamp(set.music); } catch (e) { /* ignore */ } }
      music();
    }
  }

  window.Sound = {
    names: NAMES,
    init: function (path) {
      if (path) base = path;
      try { const o = JSON.parse(localStorage.getItem(KEY)); if (o) { if (o.music !== undefined) set.music = clamp(o.music); if (o.sfx !== undefined) set.sfx = clamp(o.sfx); } } catch (e) { /* defaults */ }
      ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { window.addEventListener(ev, unlock, { passive: true }); });
      document.addEventListener('visibilitychange', onHide);
      document.addEventListener('apppause', function () { napping = true; onHide(); });        // sent by the Android app when it leaves the screen
      document.addEventListener('appresume', function () { napping = false; onHide(); });
      window.addEventListener('pagehide', function () { if (cur) { try { cur.pause(); } catch (e) { /* ignore */ } } });
    },
    /* o: rate (pitch), gain */
    play: function (name, o) {
      if (!ctx || !out || hidden || set.sfx <= 0) return;
      const b = buf[name]; if (!b) return;
      const t = ctx.currentTime;
      if (lastAt[name] !== undefined && t - lastAt[name] < 0.045) return;
      lastAt[name] = t;
      try {
        const s = ctx.createBufferSource(); s.buffer = b;
        if (o && o.rate) s.playbackRate.value = o.rate;
        if (o && o.gain !== undefined) { const g = ctx.createGain(); g.gain.value = o.gain; s.connect(g); g.connect(out); } else s.connect(out);
        s.start();
      } catch (e) { /* ignore */ }
    },
    setAge: function (age) { wantAge = Math.max(1, Math.min(5, age | 0)); music(); },
    volume: function (kind, v) {
      set[kind] = clamp(v); save();
      if (kind === 'sfx' && out) out.gain.value = set.sfx;
      if (kind === 'music') {
        if (cur && set.music > 0) { clearInterval(cur._fade); try { cur.volume = set.music; } catch (e) { /* ignore */ } }
        music();
      }
    },
    get: function () { return { music: set.music, sfx: set.sfx }; },
    state: function () { return { unlocked: unlocked, effects: Object.keys(buf).length, track: curAge, playing: !!(cur && !cur.paused), at: cur ? cur.currentTime : 0, volume: cur ? cur.volume : 0 }; },
    get ready() { return unlocked; }
  };
})();
