/* viz.js — interactive SVG figures for the page sections. Black / white, red for accents. */
import * as D from './data.js?v=202611171643';

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const GRAY = '#8d8a84';

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
function svg(host, vb) {
  host.innerHTML = '';
  const s = el('svg', { viewBox: vb, role: 'img' }, host);
  const defs = el('defs', {}, s);
  D.SPHERES.forEach((_, i) => {
    const g = el('radialGradient', { id: `${host.id}-g${i}`, cx: '35%', cy: '30%', r: '75%' }, defs);
    const t = D.tone(i);
    el('stop', { offset: '0%', 'stop-color': t > 0.5 ? '#ffffff' : '#9a9a9a' }, g);
    el('stop', { offset: '45%', 'stop-color': D.toneHex(i) }, g);
    el('stop', { offset: '100%', 'stop-color': '#030303' }, g);
  });
  // Blur filters are only used on small shapes (rings, gate marks): on long lines they cost seconds per frame.
  const glow = el('filter', { id: `${host.id}-glow`, x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  el('feGaussianBlur', { stdDeviation: '3.2', result: 'b' }, glow);
  const m = el('feMerge', {}, glow); el('feMergeNode', { in: 'b' }, m); el('feMergeNode', { in: 'SourceGraphic' }, m);
  for (const [id, c] of [['halo', '#ffffff'], ['haloR', D.RED]]) {
    const g = el('radialGradient', { id: `${host.id}-${id}` }, defs);
    el('stop', { offset: '0%', 'stop-color': c, 'stop-opacity': 0.9 }, g);
    el('stop', { offset: '100%', 'stop-color': c, 'stop-opacity': 0 }, g);
  }
  return s;
}
/* cheap glow under a line: a wide, faint copy */
function underlay(parent, attrs, color = D.RED) {
  return el('line', { ...attrs, stroke: color, 'stroke-width': 9, 'stroke-opacity': 0.16, 'stroke-linecap': 'round' }, parent);
}
const P = (p, k) => [p[0] * k, -p[1] * k];
function onVisible(node, cb) {
  let vis = false;
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(node);
  const loop = (t) => { if (vis && !window.__wyrdPause) cb(t); requestAnimationFrame(loop); }; // __wyrdPause: test hook
  requestAnimationFrame(loop);
}
const tip = document.getElementById('tip');
function hoverTip(node, text) {
  node.addEventListener('pointerenter', (e) => { tip.textContent = typeof text === 'function' ? text() : text; tip.classList.add('show'); move(e); });
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerleave', () => tip.classList.remove('show'));
  function move(e) { tip.style.left = `${Math.min(innerWidth - 270, e.clientX + 14)}px`; tip.style.top = `${e.clientY + 16}px`; }
}

/* A sphere: dark plate, ring, gradient orb, glyph and name. */
function orb(parent, host, i, x, y, r, label, labelDy = 1) {
  const g = el('g', { class: 'hot', transform: `translate(${x} ${y})` }, parent);
  el('circle', { r: r + 9, fill: 'none', stroke: D.PAPER, 'stroke-opacity': 0.12 }, g);
  const ring = el('circle', { r: r + 5, fill: 'none', stroke: D.PAPER, 'stroke-opacity': 0.45, 'stroke-width': 1.2 }, g);
  el('circle', { r, fill: `url(#${host.id}-g${i})` }, g);
  el('text', { class: 'glyph', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': r * 0.95, fill: D.tone(i) > 0.5 ? '#111' : D.PAPER }, g).textContent = D.SPHERES[i].glyph;
  if (label) {
    const t = el('text', { 'text-anchor': 'middle', y: labelDy * (r + 24), 'font-size': 14, 'letter-spacing': 2, 'dominant-baseline': 'central' }, g);
    t.textContent = label.toUpperCase();
    g.userData = { t };
  }
  g.ring = ring;
  return g;
}
function setOrb(g, state) { // state: 'sel' | 'act' | ''
  g.ring.setAttribute('stroke', state === 'sel' ? D.RED : D.PAPER);
  g.ring.setAttribute('stroke-opacity', state ? 1 : 0.45);
  g.ring.setAttribute('stroke-width', state ? 2.2 : 1.2);
  g.ring.setAttribute('filter', state === 'sel' ? `url(#${g.ownerSVGElement.parentNode.id}-glow)` : '');
  if (g.userData) g.userData.t.setAttribute('fill', state === 'sel' ? D.RED_HI : D.PAPER);
}

/* ===================== I. Tree ===================== */
export function tree(host, onSelect) {
  const k = 128, s = svg(host, '-230 -205 460 410');
  const pts = D.TREE.map((p) => P(p, k));
  const gEdges = el('g', {}, s), gNo = el('g', { opacity: 0 }, s);
  const edges = D.EDGES.map(([i, j]) => {
    const key = `${i}-${j}`, hid = D.HIDDEN.has(key), route = D.ROUTE_SET.has(key);
    const [a, b] = [pts[i], pts[j]];
    const ln = el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1],
      stroke: hid ? D.RED : route ? D.PAPER : GRAY, 'stroke-width': hid ? 1.4 : route ? 1.8 : 0.8,
      'stroke-opacity': hid ? 0.9 : route ? 0.85 : 0.45, 'stroke-dasharray': hid ? '6 5' : null }, gEdges);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const tg = el('g', {}, gNo);
    el('rect', { x: mx - 11, y: my - 7, width: 22, height: 14, fill: '#050505', stroke: 'rgba(242,239,232,.2)' }, tg);
    el('text', { class: 'mono', x: mx, y: my + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 8, fill: hid ? D.RED_HI : GRAY }, tg).textContent = 'П' + D.PATH_NO.get(key);
    return { ln, tg, short: D.SHORT_EDGES.some(([x, y]) => x === i && y === j) && !hid };
  });
  const [sa, sb] = [pts[3], pts[4]];
  underlay(s, { x1: sa[0], y1: sa[1], x2: sb[0], y2: sb[1] });
  el('line', { x1: sa[0], y1: sa[1], x2: sb[0], y2: sb[1], stroke: D.RED, 'stroke-width': 3, 'stroke-dasharray': '8 6' }, s);
  const ab = el('text', { class: 'mono', x: -98, y: -16, 'text-anchor': 'middle', 'font-size': 9, 'letter-spacing': 2.5, fill: D.RED_HI }, s); ab.textContent = 'БЕЗДНА';
  // pulse running along Moon -> Saturn
  const route = 'M' + pts.map((p) => p.join(' ')).join(' L');
  const pulse = el('g', {}, s);
  el('circle', { r: 14, fill: `url(#${host.id}-haloR)` }, pulse);
  el('circle', { r: 3.4, fill: '#fff' }, pulse);
  const am = el('animateMotion', { dur: '15s', repeatCount: 'indefinite', path: route }, pulse);
  void am;
  const orbs = pts.map((p, i) => {
    const g = orb(s, host, i, p[0], p[1], 15, D.SPHERES[i].name, i === 0 ? 1 : i === 6 ? -1 : 1);
    if (i === 1 || i === 4) g.userData.t.setAttribute('x', -0); // keep centred
    g.addEventListener('click', () => api.select(i));
    hoverTip(g, `${D.SPHERES[i].name} · ${D.SPHERES[i].word}`);
    return g;
  });
  let sel = -1;
  const api = {
    select(i) { sel = i; orbs.forEach((g, j) => setOrb(g, j === i ? 'sel' : '')); onSelect && onSelect(i); },
    setAll(on) { edges.forEach((e) => { const v = on || e.short; e.ln.style.display = v ? '' : 'none'; e.tg.style.display = v ? '' : 'none'; }); },
    setNo(on) { gNo.setAttribute('opacity', on ? 1 : 0); },
    get selected() { return sel; },
  };
  s.appendChild(gNo);
  return api;
}

/* ===================== II. Sigil ===================== */
export function sigil(host, ctl, note) {
  const k = 150, s = svg(host, '-240 -240 480 480');
  const pts = D.SIGIL.map((p) => P(p, k));
  el('circle', { r: D.SIGIL_R * k + 14, fill: 'none', stroke: D.PAPER, 'stroke-opacity': 0.14 }, s);
  el('circle', { r: D.SIGIL_R * k, fill: 'none', stroke: D.PAPER, 'stroke-opacity': 0.55, 'stroke-width': 1.3 }, s);
  el('circle', { r: D.SIGIL_R * k - 10, fill: 'none', stroke: D.PAPER, 'stroke-opacity': 0.08 }, s);
  for (let a = 0; a < 72; a++) {
    const r1 = D.SIGIL_R * k + (a % 6 ? 4 : 0), r2 = D.SIGIL_R * k + 14, an = (a / 72) * Math.PI * 2;
    el('line', { x1: Math.cos(an) * r1, y1: Math.sin(an) * r1, x2: Math.cos(an) * r2, y2: Math.sin(an) * r2, stroke: D.PAPER, 'stroke-opacity': 0.18 }, s);
  }
  const ab = el('text', { class: 'mono', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 10, 'letter-spacing': 3, fill: GRAY }, s); ab.textContent = 'БЕЗДНА';
  const chords = D.CHORDS.map(([i, j], n) => {
    const [a, b] = [pts[i], pts[j]];
    const g = el('g', { class: 'hot' }, s);
    el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'transparent', 'stroke-width': 14 }, g);
    const ln = el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: D.PAPER, 'stroke-opacity': 0.6, 'stroke-width': 1.4 }, g);
    g.addEventListener('pointerenter', () => { user = true; show(2, n); });
    g.addEventListener('click', () => { user = true; show(2, n); });
    return ln;
  });
  const orbs = pts.map((p, i) => {
    const out = [p[0] * 1.2, p[1] * 1.2];
    const g = orb(s, host, i, p[0], p[1], 14, null);
    const t = el('text', { x: out[0] - p[0], y: out[1] - p[1], 'text-anchor': p[0] > 5 ? 'start' : p[0] < -5 ? 'end' : 'middle', 'dominant-baseline': 'central', 'font-size': 13, 'letter-spacing': 1.5 }, g);
    t.textContent = `${i + 1} · ${D.SPHERES[i].name.toUpperCase()}`; g.userData = { t };
    g.addEventListener('click', () => { user = true; show(1, i); });
    return g;
  });
  // controls: stage segment + stepper
  ctl.innerHTML = '';
  const seg = document.createElement('div'); seg.className = 'seg'; ctl.appendChild(seg);
  const stBtns = D.SIGIL_STAGES.map((name, n) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = name; b.onclick = () => { user = true; show(n, 0); }; seg.appendChild(b); return b; });
  const prev = document.createElement('button'); prev.className = 'chip'; prev.textContent = '←'; ctl.appendChild(prev);
  const next = document.createElement('button'); next.className = 'chip'; next.textContent = '→'; ctl.appendChild(next);
  prev.onclick = () => { user = true; step(-1); }; next.onclick = () => { user = true; step(1); };
  let stage = 0, idx = 0, user = false, last = 0;
  function show(st, i) {
    stage = st; idx = i;
    stBtns.forEach((b, n) => b.classList.toggle('on', n === stage));
    chords.forEach((ln, n) => { const on = stage === 2 && n === idx; ln.setAttribute('stroke', on ? D.RED : D.PAPER); ln.setAttribute('stroke-width', on ? 3 : 1.4); ln.setAttribute('stroke-opacity', on ? 1 : stage === 2 ? 0.25 : 0.6); });
    orbs.forEach((g, n) => {
      const [a, b] = stage === 2 ? D.CHORDS[idx] : [-1, -1];
      setOrb(g, stage === 1 && n === idx ? 'sel' : n === a || n === b ? 'act' : '');
    });
    if (stage === 0) note.innerHTML = 'Семь сфер на окружности · девять прямых связей';
    else if (stage === 1) note.innerHTML = `<b>Сфера ${idx + 1} из 7</b> · ${D.SPHERES[idx].name} · ${D.SPHERES[idx].word}`;
    else { const [a, b] = D.CHORDS[idx]; note.innerHTML = `<b>Линия ${idx + 1} из 9</b> · ${D.NAMES[a]} ↔ ${D.NAMES[b]}`; }
  }
  function step(d) {
    const n = stage === 0 ? 1 : stage === 1 ? 7 : 9;
    idx += d;
    if (idx >= n) { stage = (stage + 1) % 3; idx = 0; } else if (idx < 0) { stage = (stage + 2) % 3; idx = stage === 0 ? 0 : stage === 1 ? 6 : 8; }
    show(stage, idx);
  }
  show(0, 0);
  onVisible(host, (t) => { if (!user && t - last > 1700) { last = t; step(1); } });
}

/* ===================== III. Morph ===================== */
export function morph(host, range) {
  const k = 135, s = svg(host, '-230 -230 460 460');
  const ring = el('circle', { r: D.SIGIL_R * k, fill: 'none', stroke: D.PAPER, 'stroke-width': 1.3 }, s);
  const ring2 = el('circle', { r: D.SIGIL_R * k + 12, fill: 'none', stroke: D.PAPER }, s);
  const tEdges = D.EDGES.map(([i, j]) => {
    const key = `${i}-${j}`, hid = D.HIDDEN.has(key), route = D.ROUTE_SET.has(key);
    return { i, j, ln: el('line', { stroke: hid ? D.RED : route ? D.PAPER : GRAY, 'stroke-width': hid ? 1.4 : route ? 1.8 : 0.8, 'stroke-dasharray': hid ? '6 5' : null, base: hid ? 0.9 : route ? 0.85 : 0.4 }, s) };
  });
  const abyss = el('line', { stroke: D.RED, 'stroke-width': 3, 'stroke-dasharray': '8 6' }, s);
  const chords = D.CHORDS.map(([i, j]) => ({ i, j, ln: el('line', { stroke: D.PAPER, 'stroke-width': 1.5 }, s) }));
  const trails = D.SPHERES.map((_, i) => {
    let d = ''; for (let u = 0; u <= 24; u++) { const t = smooth(u / 24); const p = P([D.TREE[i][0] + (D.SIGIL[i][0] - D.TREE[i][0]) * t, D.TREE[i][1] + (D.SIGIL[i][1] - D.TREE[i][1]) * t], k); d += (u ? 'L' : 'M') + p.join(' '); }
    return el('path', { d, fill: 'none', stroke: GRAY, 'stroke-dasharray': '2 4', 'stroke-opacity': 0.5 }, s);
  });
  const orbs = D.SPHERES.map((sp, i) => orb(s, host, i, 0, 0, 13, null));
  const cap = el('text', { class: 'mono', x: 0, y: -214, 'text-anchor': 'middle', 'font-size': 10, 'letter-spacing': 3, fill: D.RED_HI }, s);
  let t = 0, user = false, dir = 1, hold = 1.2, lastT = 0;
  function draw() {
    const u = smooth(t), cur = D.SPHERES.map((_, i) => P([D.TREE[i][0] + (D.SIGIL[i][0] - D.TREE[i][0]) * u, D.TREE[i][1] + (D.SIGIL[i][1] - D.TREE[i][1]) * u], k));
    ring.setAttribute('stroke-opacity', 0.55 * u); ring2.setAttribute('stroke-opacity', 0.14 * u);
    tEdges.forEach((e) => { const [a, b] = [cur[e.i], cur[e.j]]; Object.entries({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] }).forEach(([kk, v]) => e.ln.setAttribute(kk, v)); e.ln.setAttribute('stroke-opacity', e.ln.getAttribute('base') * (1 - u)); });
    const [a, b] = [cur[3], cur[4]]; abyss.setAttribute('x1', a[0]); abyss.setAttribute('y1', a[1]); abyss.setAttribute('x2', b[0]); abyss.setAttribute('y2', b[1]); abyss.setAttribute('stroke-opacity', 1 - u);
    chords.forEach((c) => { const [p, q] = [cur[c.i], cur[c.j]]; c.ln.setAttribute('x1', p[0]); c.ln.setAttribute('y1', p[1]); c.ln.setAttribute('x2', q[0]); c.ln.setAttribute('y2', q[1]); c.ln.setAttribute('stroke-opacity', 0.65 * u); });
    trails.forEach((p) => p.setAttribute('opacity', t > 0.02 && t < 0.98 ? 1 : 0));
    orbs.forEach((g, i) => g.setAttribute('transform', `translate(${cur[i][0]} ${cur[i][1]})`));
    cap.textContent = t <= 0.001 ? 'ДРЕВО ВИРД' : t >= 0.999 ? 'СЕПТЕНАРНЫЙ СИГИЛ' : `ПЕРЕХОД ${Math.round(t * 100)}%`;
    range.value = Math.round(t * 100);
  }
  range.addEventListener('input', () => { user = true; t = range.value / 100; draw(); });
  draw();
  onVisible(host, (now) => {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0; lastT = now;
    if (user) return;
    if (hold > 0) { hold -= dt; return; }
    t += dir * dt * 0.28;
    if (t >= 1 || t <= 0) { t = clamp(t, 0, 1); dir *= -1; hold = 1.6; }
    draw();
  });
}

/* ===================== IV. Sigil of the Nine ===================== */
export function nine(host, ctl, note) {
  const k = 150, s = svg(host, '-235 -185 470 370');
  const segs = D.NINE_SEGS.map(([a, b]) => {
    const [p, q] = [P(a, k), P(b, k)];
    return el('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: D.PAPER, 'stroke-width': 1.5, 'stroke-opacity': 0.6, 'stroke-linecap': 'round' }, s);
  });
  const crosses = [D.NINE_X1, D.NINE_X2].map((c) => {
    const [x, y] = P(c, k), g = el('g', { transform: `translate(${x} ${y})` }, s);
    const h = el('circle', { r: 16, fill: `url(#${host.id}-halo)`, opacity: 0 }, g);
    el('circle', { r: 4, fill: D.PAPER }, g);
    const t = el('text', { class: 'mono', y: -14, 'text-anchor': 'middle', 'font-size': 8, 'letter-spacing': 1.5, fill: D.PAPER, opacity: 0 }, g); t.textContent = 'ПЕРЕСЕЧЕНИЕ';
    return { h, t };
  });
  const gates = [[D.NINE_EARTH, 'ЗЕМНЫЕ ВРАТА', false], [D.NINE_STAR, 'ЗВЁЗДНЫЕ ВРАТА', true]].map(([c, name, star]) => {
    const [x, y] = P(c, k), S = 17, g = el('g', { transform: `translate(${x} ${y})` }, s);
    const dia = el('path', { d: `M0 ${-S} L${S} 0 L0 ${S} L${-S} 0Z`, fill: '#050505', stroke: D.PAPER, 'stroke-width': 1.6 }, g);
    const inner = star ? el('circle', { r: S * 0.45, fill: 'none', stroke: D.PAPER, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }, g) : null;
    const t = el('text', { class: 'mono', y: S + 16, 'text-anchor': star ? 'end' : 'middle', x: star ? S : 0, 'font-size': 8.5, 'letter-spacing': 1.5, fill: GRAY }, g); t.textContent = name;
    return { star, parts: [dia, inner].filter(Boolean), t };
  });
  const orbs = D.NAMES.map((n, i) => { const [x, y] = P(D.NINE_NODES[n], k); return orb(s, host, i, x, y, 12, n, n === 'Солнце' ? -1 : 1); });
  ctl.innerHTML = '';
  const seg = document.createElement('div'); seg.className = 'seg'; ctl.appendChild(seg);
  const btns = D.NINE_STAGES.map((name, n) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = `${n + 1}`; b.title = name; b.onclick = () => { user = true; show(n, 0); }; seg.appendChild(b); return b; });
  let stage = 0, sub = 0, user = false, last = 0;
  function show(st, i) {
    stage = st; sub = i;
    btns.forEach((b, n) => b.classList.toggle('on', n === stage));
    segs.forEach((l, n) => { const on = stage === 0 && n === sub; l.setAttribute('stroke', on ? D.RED : D.PAPER); l.setAttribute('stroke-width', on ? 3.2 : 1.5); l.setAttribute('stroke-opacity', on ? 1 : 0.6); });
    const an = stage === 1 || stage === 5 ? sub : stage === 3 ? D.INDEX['Юпитер'] : -1;
    orbs.forEach((g, n) => setOrb(g, n === an ? 'sel' : ''));
    crosses.forEach((c) => { c.h.setAttribute('opacity', stage === 2 ? 0.7 : 0); c.t.setAttribute('opacity', stage === 2 ? 1 : 0); });
    gates.forEach((g) => {
      const lit = (!g.star && (stage === 3 || stage === 6)) || (g.star && stage === 4);
      g.parts.forEach((p) => { p.setAttribute('stroke', lit ? D.RED : D.PAPER); p.setAttribute('filter', lit ? `url(#${host.id}-glow)` : ''); });
      g.t.setAttribute('fill', lit ? D.RED_HI : GRAY);
    });
    note.innerHTML = `<b>${D.NINE_STAGES[stage]}</b> · ${D.NINE_HINTS[stage]}`;
  }
  function step() {
    const n = stage === 0 ? D.NINE_SEGS.length : stage === 1 || stage === 5 ? 7 : 1;
    sub++; if (sub >= n) { stage = (stage + 1) % D.NINE_STAGES.length; sub = 0; }
    show(stage, sub);
  }
  show(0, 0);
  onVisible(host, (t) => { if (!user && t - last > (stage === 0 ? 450 : stage === 1 || stage === 5 ? 700 : 2400)) { last = t; step(); } });
}

/* ===================== V. Double tetrahedron (slowly turning projection) ===================== */
export function tetra(host) {
  const k = 120, s = svg(host, '-210 -235 420 500');
  const V = [...D.TETRA_BASE, D.TETRA_TOP, D.TETRA_BOTTOM];
  const faces = [[0, 1, 3], [1, 2, 3], [2, 0, 3], [0, 1, 4], [1, 2, 4], [2, 0, 4]];
  const gF = el('g', {}, s);
  const fEls = faces.map((f) => el('path', { fill: f.includes(3) ? D.RED : D.PAPER, 'fill-opacity': f.includes(3) ? 0.06 : 0.035, stroke: f.includes(3) ? D.RED : D.PAPER, 'stroke-opacity': f.includes(3) ? 0.9 : 0.55, 'stroke-width': f.includes(3) ? 1.6 : 1.2, 'stroke-linejoin': 'round' }, gF));
  const baseGlow = el('path', { fill: 'none', stroke: D.RED, 'stroke-width': 9, 'stroke-opacity': 0.14, 'stroke-linejoin': 'round' }, s);
  const base = el('path', { fill: 'none', stroke: D.RED, 'stroke-width': 2.2, 'stroke-dasharray': '7 5' }, s);
  const plane = el('ellipse', { fill: 'none', stroke: D.PAPER, 'stroke-opacity': 0.14 }, s);
  const halos = V.map((_, i) => el('circle', { r: i > 2 ? 20 : 0, fill: `url(#${host.id}-${i === 3 ? 'haloR' : 'halo'})`, opacity: 0.6 }, s));
  const vs = V.map((_, i) => el('circle', { r: i > 2 ? 6 : 4, fill: i === 3 ? D.RED : D.PAPER }, s));
  const tA = el('text', { 'text-anchor': 'middle', 'font-size': 14, 'letter-spacing': 3, fill: D.RED_HI }, s); tA.textContent = 'АКАУЗАЛЬНОЕ';
  const tC = el('text', { 'text-anchor': 'middle', 'font-size': 14, 'letter-spacing': 3 }, s); tC.textContent = 'КАУЗАЛЬНОЕ';
  const tS = el('text', { class: 'mono', 'text-anchor': 'middle', 'font-size': 8.5, 'letter-spacing': 2, fill: GRAY }, s); tS.textContent = 'ПЛОСКОСТЬ СОЛНЦА';
  let yaw = 0.5; const pitch = 0.32; let last = 0;
  function proj(p) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    let x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1];
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y2 = y * cp - z * sp; z = y * sp + z * cp;
    const f = 5 / (5 - z);
    return [x * k * f, -y2 * k * f, z];
  }
  function draw() {
    const q = V.map(proj);
    const order = faces.map((f, n) => [n, (q[f[0]][2] + q[f[1]][2] + q[f[2]][2]) / 3]).sort((a, b) => a[1] - b[1]);
    order.forEach(([n]) => { const f = faces[n]; fEls[n].setAttribute('d', `M${q[f[0]][0]} ${q[f[0]][1]}L${q[f[1]][0]} ${q[f[1]][1]}L${q[f[2]][0]} ${q[f[2]][1]}Z`); gF.appendChild(fEls[n]); });
    base.setAttribute('d', `M${q[0][0]} ${q[0][1]}L${q[1][0]} ${q[1][1]}L${q[2][0]} ${q[2][1]}Z`);
    baseGlow.setAttribute('d', base.getAttribute('d'));
    halos.forEach((h, i) => { h.setAttribute('cx', q[i][0]); h.setAttribute('cy', q[i][1]); });
    const c = proj([0, 0, 0]), e1 = proj([1.35, 0, 0]), e2 = proj([0, 0, 1.35]);
    plane.setAttribute('cx', c[0]); plane.setAttribute('cy', c[1]);
    plane.setAttribute('rx', Math.max(Math.abs(e1[0] - c[0]), Math.abs(e2[0] - c[0]), 10)); plane.setAttribute('ry', Math.max(Math.abs(e1[1] - c[1]), Math.abs(e2[1] - c[1]), 8));
    vs.forEach((v, i) => { v.setAttribute('cx', q[i][0]); v.setAttribute('cy', q[i][1]); });
    tA.setAttribute('x', q[3][0]); tA.setAttribute('y', q[3][1] - 18);
    tC.setAttribute('x', q[4][0]); tC.setAttribute('y', q[4][1] + 28);
    tS.setAttribute('x', c[0]); tS.setAttribute('y', c[1] + 4);
  }
  draw();
  let drag = null;
  s.style.touchAction = 'pan-y'; s.style.cursor = 'grab';
  s.addEventListener('pointerdown', (e) => { drag = e.clientX; });
  addEventListener('pointermove', (e) => { if (drag !== null) { yaw += (e.clientX - drag) * 0.01; drag = e.clientX; draw(); } });
  addEventListener('pointerup', () => { drag = null; });
  onVisible(host, (t) => { const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t; if (drag === null) { yaw += dt * 0.35; draw(); } });
}

/* ===================== VI. Correspondence cards ===================== */
export function cards(host, onPick) {
  host.innerHTML = '';
  const rows = [['Процесс', 'process'], ['Звезда', 'star'], ['Камень', 'stone'], ['Аромат', 'incense'], ['Форма', 'form']];
  const items = D.SPHERES.map((s, i) => {
    const d = document.createElement('article'); d.className = 'sph';
    const t = D.tone(i);
    d.innerHTML = `<span class="n">${i + 1}/7</span>
      <div class="sph-orb" style="background:radial-gradient(circle at 35% 30%, ${t > 0.5 ? '#fff' : '#9a9a9a'}, ${D.toneHex(i)} 45%, #030303);color:${t > 0.5 ? '#111' : D.PAPER}">${s.glyph}</div>
      <h4>${s.name}</h4><div class="w">${s.word}</div>
      <ul>${rows.map(([n, k]) => `<li><i>${n}</i>${s[k]}</li>`).join('')}</ul>`;
    d.addEventListener('click', () => onPick(i));
    host.appendChild(d); return d;
  });
  return { select(i) { items.forEach((d, j) => d.classList.toggle('on', j === i)); } };
}

/* Hero background: thin septenary sigil drawn line by line. */
export function heroSigil(svgEl) {
  const k = 330;
  const pts = D.SIGIL.map((p) => P(p, k));
  el('circle', { r: D.SIGIL_R * k + 40 }, svgEl);
  el('circle', { r: D.SIGIL_R * k }, svgEl);
  D.CHORDS.forEach(([i, j], n) => el('line', { x1: pts[i][0], y1: pts[i][1], x2: pts[j][0], y2: pts[j][1], class: n === 7 ? 'r' : null }, svgEl));
  pts.forEach((p) => el('circle', { cx: p[0], cy: p[1], r: 14 }, svgEl));
}
