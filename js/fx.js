/* Long Ascent: things that move when you act. Sparks, flying coins, rings and confetti are drawn on one
   overlay canvas that only runs while something is alive; floating numbers are plain elements.
   All positions are relative to the app frame. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  let cv = null, ctx = null, host = null, layer = null, W = 0, H = 0, dpr = 1, parts = [], running = false, last = 0, quiet = false;

  function size() {
    if (!cv) return;
    const r = host.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function at(target) {            // an element, a pointer event or {x, y} -> a point in the app frame
    if (!target) return { x: W / 2, y: H / 2 };
    const h = host.getBoundingClientRect();
    if (typeof target.clientX === 'number') return { x: target.clientX - h.left, y: target.clientY - h.top };
    if (typeof target.x === 'number') return { x: target.x, y: target.y };
    const r = target.getBoundingClientRect();
    return { x: r.left + r.width / 2 - h.left, y: r.top + r.height / 2 - h.top };
  }
  function kick() { if (!running && cv) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const keep = [];
    for (const p of parts) {
      p.age += dt;
      if (p.age < 0) { keep.push(p); continue; }                 // not started yet
      const f = p.age / p.life;
      if (f >= 1) { if (p.done) p.done(); continue; }
      if (p.kind === 'spark') {
        p.vx *= Math.pow(p.drag, dt * 60); p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
        ctx.globalAlpha = f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4; ctx.fillStyle = p.color;
        const s = p.size * (1 - 0.5 * f);
        if (p.shape === 'dot') { ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill(); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s, -s * (p.shape === 'flake' ? 0.45 : 1), s * 2, s * 2 * (p.shape === 'flake' ? 0.45 : 1)); ctx.restore(); }
      } else if (p.kind === 'coin') {
        const e = f * f * (3 - 2 * f), u = 1 - e;
        const x = u * u * p.x0 + 2 * u * e * p.cx + e * e * p.x1, y = u * u * p.y0 + 2 * u * e * p.cy + e * e * p.y1, r = p.size * (1 - 0.35 * e);
        ctx.globalAlpha = 1; ctx.fillStyle = p.rim; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, r * 0.74, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.28, r * 0.24, 0, TAU); ctx.fill();
      } else if (p.kind === 'ring') {
        const e = 1 - Math.pow(1 - f, 3);
        ctx.globalAlpha = 1 - f; ctx.strokeStyle = p.color; ctx.lineWidth = p.width * (1 - 0.6 * f);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * e, 0, TAU); ctx.stroke();
      }
      keep.push(p);
    }
    ctx.globalAlpha = 1; parts = keep;
    if (parts.length) requestAnimationFrame(loop); else { running = false; ctx.clearRect(0, 0, W, H); }
  }
  function again(el, cls) {        // restart a CSS animation class
    if (!el || quiet) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    const off = function () { el.classList.remove(cls); el.removeEventListener('animationend', off); };
    el.addEventListener('animationend', off);
  }
  const pick = function (c, i) { return Array.isArray(c) ? c[i % c.length] : c; };

  const FX = {
    init: function (canvas, floaters, frame) {
      cv = canvas; ctx = cv.getContext('2d'); layer = floaters; host = frame;
      try { quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { quiet = false; }
      size(); window.addEventListener('resize', size);
    },
    get quiet() { return quiet; },
    at: at,
    /* a burst of sparks. o: n, color (or list), speed, life, size, g, shape ('dot', 'chip', 'flake'), up (bias upward) */
    burst: function (target, o) {
      if (quiet || !cv) return;
      o = o || {}; const p = at(target), n = o.n || 14;
      if (parts.length > 500) return;
      for (let i = 0; i < n; i++) {
        const a = o.cone ? -Math.PI / 2 + (Math.random() - 0.5) * o.cone : Math.random() * TAU, v = (o.speed || 150) * (0.35 + 0.65 * Math.random());
        parts.push({ kind: 'spark', x: p.x + (Math.random() - 0.5) * (o.jitter || 6), y: p.y + (Math.random() - 0.5) * (o.jitter || 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0),
          g: o.g === undefined ? 260 : o.g, drag: o.drag || 0.94, age: -(o.delay || 0) - Math.random() * (o.stagger || 0), life: (o.life || 0.7) * (0.7 + 0.6 * Math.random()),
          size: (o.size || 3) * (0.6 + 0.8 * Math.random()), color: pick(o.color || '#ffd76a', i), shape: o.shape || 'chip', rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 12 });
      }
      kick();
    },
    ring: function (target, color, r1, width) {
      if (quiet || !cv) return;
      const p = at(target);
      parts.push({ kind: 'ring', x: p.x, y: p.y, r0: 8, r1: r1 || 46, width: width || 4, color: color || '#ffe9a8', age: 0, life: 0.5 });
      kick();
    },
    /* tokens that fly from one place to another, then call done once. o: n, color, rim, size, spread */
    fly: function (from, to, o, done) {
      o = o || {};
      if (quiet || !cv) { if (done) done(); return; }
      const a = at(from), b = at(to), n = o.n || 5; let told = false;
      for (let i = 0; i < n; i++) {
        const sx = a.x + (Math.random() - 0.5) * (o.spread || 24), sy = a.y + (Math.random() - 0.5) * (o.spread || 24);
        const mx = (sx + b.x) / 2 + (Math.random() - 0.5) * 90, my = Math.min(sy, b.y) - 30 - Math.random() * 50;
        parts.push({ kind: 'coin', x0: sx, y0: sy, x1: b.x, y1: b.y, cx: mx, cy: my, size: o.size || 6, color: o.color || '#f6cf5f', rim: o.rim || '#9a6d12',
          age: -i * 0.045, life: 0.55 + Math.random() * 0.2, done: function () { if (!told) { told = true; if (done) done(); } } });
      }
      kick();
    },
    /* a number that rises and fades */
    float: function (target, text, o) {
      if (!layer) return;
      o = o || {}; const p = at(target), e = document.createElement('div');
      e.className = 'float'; e.style.left = (p.x + (o.dx || 0)) + 'px'; e.style.top = (p.y + (o.dy || 0)) + 'px'; if (o.color) e.style.color = o.color;
      if (o.icon) e.appendChild(o.icon);
      e.appendChild(document.createTextNode(text));
      layer.appendChild(e);
      setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, quiet ? 700 : 1000);
    },
    confetti: function (colors, n) {
      if (quiet || !cv) return;
      for (let i = 0; i < (n || 70); i++) {
        parts.push({ kind: 'spark', x: Math.random() * W, y: -10 - Math.random() * 60, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 120, g: 140, drag: 0.992,
          age: -Math.random() * 0.5, life: 2.2 + Math.random() * 1.2, size: 3 + Math.random() * 3, color: pick(colors || ['#f4cb5e', '#fff'], i), shape: 'flake', rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 16 });
      }
      kick();
    },
    pop: function (el) { again(el, 'pop'); },
    bump: function (el) { again(el, 'bump'); },
    shake: function (el) { again(el, 'shake'); },
    flash: function (el) { again(el, 'flash'); },
    /* count a number up inside an element */
    count: function (el, to, ms, fmt, prefix) {
      const put = function (v) { el.textContent = (prefix || '') + fmt(v); };
      if (quiet) { put(to); return; }
      const t0 = performance.now(), dur = ms || 900;
      let done = false, seen = false;
      put(0);
      /* The element is often not on the page yet when this is called, so its absence only stops the count once it
         has been seen there. The timer is the safety net: frames do not run while the page is hidden. */
      const step = function (t) {
        if (done) return;
        if (el.isConnected) seen = true; else if (seen) { done = true; return; }
        const f = Math.min(1, Math.max(0, t - t0) / dur);
        if (f >= 1) { done = true; put(to); return; }
        put(to * (1 - Math.pow(1 - f, 3)));
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      setTimeout(function () { if (!done) { done = true; put(to); } }, dur + 600);
    }
  };
  window.FX = FX;
})();
