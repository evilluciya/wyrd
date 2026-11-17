/* atlas.js — the 3D atlas: Tree of Wyrd, septenary sigil, Tree <-> sigil transition,
   Sigil of the Nine, double tetrahedron. Free rotation on both axes with inertia,
   pinch / wheel zoom, tap a sphere for its card. Black and white; red only for accents. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as D from './data.js?v=202611171643';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const backOut = (t) => { const c = 1.6; t = clamp(t, 0, 1) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };

// Linear-space colours. Red is pushed just past 1 so the bloom pass picks it up.
const C = {
  paper: new THREE.Color(D.PAPER),
  gray: new THREE.Color('#9a968e'),
  dim: new THREE.Color('#5a5752'),
  red: new THREE.Color(D.RED).multiplyScalar(1.55),
  white: new THREE.Color(1.6, 1.58, 1.52),
};
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const HALO = () => canvasTex(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const RING = () => canvasTex(256, (g, s) => {
  g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(s / 2, s / 2, s * 0.43, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 6;
  for (let k = 0; k < 4; k++) { // engraved ticks at the cardinal points
    const a = (k * Math.PI) / 2, r1 = s * 0.385, r2 = s * 0.5;
    g.beginPath(); g.moveTo(s / 2 + Math.cos(a) * r1, s / 2 + Math.sin(a) * r1); g.lineTo(s / 2 + Math.cos(a) * r2, s / 2 + Math.sin(a) * r2); g.stroke();
  }
});

function tag(cls, html) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return new CSS2DObject(d); }

export class Atlas {
  constructor(el, opts = {}) {
    this.el = el;
    this.o = Object.assign({ interactive: true, labels: true, offsetX: 0, bloom: true, autoSpin: true, overlay: true }, opts);
    this.scene = 'tree';
    this.progress = 0; this.playing = true; this.showAll = true; this.showNumbers = false;
    this.selected = -1; this.time = 0; this.intro_t = 1; this.la = 1;
    this.morphPhase = 'hold_tree'; this.morphHold = D.MORPH_HOLD;
    this.autoSpin = this.o.autoSpin; this.vel = new THREE.Vector2(); this.zoom = 1;
    this.status = ''; this.mats = [];
    this.onPick = null; this.onFrame = null;

    this._renderer(); this._world(); this._spheres();
    this._tree(); this._sigil(); this._morph(); this._nine(); this._tetra();
    if (this.o.overlay) this._overlay();
    if (this.o.interactive) this._input();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(el);
    this.resize(); this.setScene('tree');
    this._last = performance.now();
  }

  /* ---------------- setup ---------------- */
  _renderer() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.75 : 2));
    r.setClearColor(0x050505, 1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.el.appendChild(r.domElement);
    this.three = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
    const pm = new THREE.PMREMGenerator(r);
    this.three.environment = pm.fromScene(new RoomEnvironment(r), 0.04).texture;
    if (/[?&]lite\b/.test(location.search)) this.o.bloom = false;
    if (this.o.bloom) {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(this.three, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 0.3);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }
    this.css = new CSS2DRenderer();
    this.css.domElement.className = 'css2d';
    this.el.appendChild(this.css.domElement);
  }

  _world() {
    const s = this.three;
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-3, 4, 5); s.add(key);
    s.add(new THREE.AmbientLight(0xffffff, 0.15));
    // star dust far behind the model
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 60, q = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * q * r, u * r, Math.sin(a) * q * r], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfbab0, size: coarse ? 1.6 : 1.3, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false }));
    s.add(this.stars);

    this.pivot = new THREE.Group(); s.add(this.pivot);
    this.pivot.quaternion.setFromEuler(new THREE.Euler(0.2, 0.62, 0, 'YXZ'));
    this.groups = {};
    for (const k of ['tree', 'sigil', 'morph', 'nine', 'tetra']) { this.groups[k] = new THREE.Group(); this.pivot.add(this.groups[k]); }

    // engraved pedestal below every figure
    const ped = new THREE.Group(); ped.position.y = -1.85;
    for (const [r, o] of [[0.55, 0.22], [1.05, 0.16], [1.6, 0.12], [1.66, 0.08]]) {
      const pts = []; for (let k = 0; k <= 96; k++) { const a = (k / 96) * Math.PI * 2; pts.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
      ped.add(this._line(pts, C.gray, 1, o));
    }
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2, r1 = k % 7 === 0 ? 1.12 : 1.5;
      ped.add(this._line([Math.cos(a) * r1, 0, Math.sin(a) * r1, Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6], k % 7 === 0 ? C.red : C.gray, 1, k % 7 === 0 ? 0.55 : 0.18));
    }
    this.pivot.add(ped); this.pedestal = ped;
  }

  _line(pts, color, width = 1, opacity = 1, dashed = false) {
    const g = new LineGeometry(); g.setPositions(pts);
    const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false, dashed, dashSize: 0.07, gapSize: 0.055 });
    if (dashed) m.defines.USE_DASH = '';
    const l = new Line2(g, m); l.frustumCulled = false;
    if (dashed) l.computeLineDistances();
    this.mats.push(m);
    return l;
  }
  _seg(a, b, color, width, opacity, dashed) { return this._line([...a, ...b], color, width, opacity, dashed); }
  _setSeg(l, a, b) {
    const arr = l.geometry.attributes.instanceStart.data.array;
    arr[0] = a[0]; arr[1] = a[1]; arr[2] = a[2]; arr[3] = b[0]; arr[4] = b[1]; arr[5] = b[2];
    l.geometry.attributes.instanceStart.data.needsUpdate = true;
    if (l.material.dashed) l.computeLineDistances();
  }
  _paint(l, color, opacity, width) {
    const m = l.material; m.color.copy(color); m.opacity = opacity * this.la; if (width) m.linewidth = width;
    l.visible = m.opacity > 0.01;
  }
  _ring(r, segs = 128, z = 0) {
    const p = []; for (let k = 0; k <= segs; k++) { const a = (k / segs) * Math.PI * 2; p.push(Math.cos(a) * r, Math.sin(a) * r, z); } return p;
  }

  _spheres() {
    const geo = new THREE.SphereGeometry(0.105, 64, 48);
    const halo = HALO(), ring = RING();
    this.nodes = D.SPHERES.map((s, i) => {
      const t = D.tone(i);
      // pearl (Moon) -> polished obsidian (Saturn): low metalness so black stays black, clearcoat gives the gloss
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(D.toneHex(i)), metalness: 0.04, roughness: 0.42 - (1 - t) * 0.3,
        clearcoat: 1, clearcoatRoughness: 0.05 + t * 0.1, envMapIntensity: 0.45 + (1 - t) * 0.5,
      });
      const m = new THREE.Mesh(geo, mat); m.userData.index = i;
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffffff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
      h.scale.setScalar(0.62); m.add(h);
      const rg = new THREE.Sprite(new THREE.SpriteMaterial({ map: ring, color: C.paper.clone(), transparent: true, opacity: 0.38, depthWrite: false }));
      rg.scale.setScalar(0.38); m.add(rg);
      m.userData.halo = h; m.userData.ring = rg;
      this.pivot.add(m);
      if (this.o.labels) {
        const l = tag('lbl', `<i>${s.glyph}</i><span>${s.name}</span>`);
        this.pivot.add(l); m.userData.label = l;
      }
      return m;
    });
  }

  /* ---------------- figures ---------------- */
  _tree() {
    const g = this.groups.tree;
    this.treeEdges = D.EDGES.map(([i, j]) => {
      const k = `${i}-${j}`, hidden = D.HIDDEN.has(k), route = D.ROUTE_SET.has(k);
      const l = this._seg(D.TREE[i], D.TREE[j], C.gray, 1, 0.5, hidden);
      l.userData = { k, hidden, route, short: D.SHORT_EDGES.some(([a, b]) => a === i && b === j) };
      g.add(l);
      if (this.o.labels) {
        const t = tag('pno', 'П' + D.PATH_NO.get(k)); t.position.set(...lerp3(D.TREE[i], D.TREE[j], 0.5));
        g.add(t); l.userData.no = t;
      }
      return l;
    });
    const [a, b] = D.ABYSS;
    this.abyss = this._seg(D.TREE[a], D.TREE[b], C.red, 3.2, 1, true); g.add(this.abyss);
    if (this.o.labels) {
      const t = tag('acc', 'Бездна'); t.position.set(-0.62, 0.18, 0); g.add(t);
    }
    this.pulse = new THREE.Mesh(new THREE.SphereGeometry(0.032, 24, 16), new THREE.MeshBasicMaterial({ color: C.white }));
    const ph = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO(), color: C.red, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    ph.scale.setScalar(0.42); this.pulse.add(ph); g.add(this.pulse);
  }

  _sigil() {
    const g = this.groups.sigil;
    g.add(this._line(this._ring(D.SIGIL_R), C.paper, 1.4, 0.55));
    g.add(this._line(this._ring(D.SIGIL_R + 0.09), C.gray, 1, 0.22));
    g.add(this._line(this._ring(D.SIGIL_R - 0.07, 128), C.gray, 1, 0.12));
    this.sigilChords = D.CHORDS.map(([i, j]) => { const l = this._seg(D.SIGIL[i], D.SIGIL[j], C.paper, 1.5, 0.6); g.add(l); return l; });
    if (this.o.labels) {
      const t = tag('mute', 'Бездна'); g.add(t);
      this.chordTag = tag('acc', ''); g.add(this.chordTag);
    }
  }

  _morphPos(i, u) {
    const p = lerp3(D.TREE[i], D.SIGIL[i], smooth(u));
    return [p[0], p[1], Math.sin(Math.PI * u) * D.MORPH_DEPTH[i]];
  }
  _morph() {
    const g = this.groups.morph;
    this.trails = D.SPHERES.map((_, i) => {
      const p = []; for (let u = 0; u <= 30; u++) p.push(...this._morphPos(i, u / 30));
      const l = this._line(p, C.gray, 1, 0.3); g.add(l); return l;
    });
    this.morphEdges = D.EDGES.map(([i, j]) => {
      const k = `${i}-${j}`, l = this._seg(D.TREE[i], D.TREE[j], C.gray, 1, 0.5, D.HIDDEN.has(k));
      l.userData = { i, j, hidden: D.HIDDEN.has(k), route: D.ROUTE_SET.has(k) }; g.add(l); return l;
    });
    this.morphAbyss = this._seg(D.TREE[3], D.TREE[4], C.red, 3.2, 1, true); g.add(this.morphAbyss);
    this.morphRing = this._line(this._ring(D.SIGIL_R), C.paper, 1.5, 0); g.add(this.morphRing);
    this.morphRing2 = this._line(this._ring(D.SIGIL_R + 0.09), C.gray, 1, 0); g.add(this.morphRing2);
    this.morphChords = D.CHORDS.map(([i, j]) => { const l = this._seg(D.SIGIL[i], D.SIGIL[j], C.paper, 1.6, 0); l.userData = { i, j }; g.add(l); return l; });
  }

  _nine() {
    const g = this.groups.nine;
    this.nineSegs = D.NINE_SEGS.map(([a, b]) => { const l = this._seg(a, b, C.paper, 1.6, 0.6); g.add(l); return l; });
    const dot = new THREE.SphereGeometry(0.038, 24, 16);
    this.crosses = [D.NINE_X1, D.NINE_X2].map((p) => {
      const m = new THREE.Mesh(dot, new THREE.MeshBasicMaterial({ color: C.paper })); m.position.set(...p);
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      h.scale.setScalar(0.5); m.add(h); m.userData.halo = h; g.add(m);
      if (this.o.labels) { const t = tag('mute', 'пересечение'); t.position.set(p[0], p[1] + 0.15, p[2]); g.add(t); m.userData.tag = t; }
      return m;
    });
    const S = 0.15;
    this.gates = [[D.NINE_EARTH, 'Земные Врата', false], [D.NINE_STAR, 'Звёздные Врата', true]].map(([p, name, star]) => {
      const gg = new THREE.Group(); gg.position.set(...p);
      const fill = new THREE.Mesh(new THREE.CircleGeometry(S, 4), new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }));
      gg.add(fill);
      const out = this._line([0, S, 0, S, 0, 0, 0, -S, 0, -S, 0, 0, 0, S, 0], C.paper, 2, 0.8); gg.add(out);
      const inner = star ? this._line(this._ring(S * 0.5, 48), C.paper, 1.3, 0.8) : null; if (inner) gg.add(inner);
      if (this.o.labels) { const t = tag('mute', name); t.position.set(0, -S - 0.12, 0); gg.add(t); gg.userData.tag = t; }
      gg.userData.lines = [out, inner].filter(Boolean); gg.userData.star = star;
      g.add(gg); return gg;
    });
  }

  _tetra() {
    const g = this.groups.tetra; g.scale.setScalar(0.8);
    const V = [...D.TETRA_BASE, D.TETRA_TOP, D.TETRA_BOTTOM];
    const faces = [[0, 1, 3], [1, 2, 3], [2, 0, 3], [0, 1, 4], [1, 2, 4], [2, 0, 4]];
    for (const f of faces) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(f.flatMap((i) => V[i]), 3));
      const up = f.includes(3);
      g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: up ? C.red : C.paper, transparent: true, opacity: up ? 0.07 : 0.045, side: THREE.DoubleSide, depthWrite: false })));
    }
    for (const i of [0, 1, 2]) {
      g.add(this._seg(V[i], V[3], C.red, 2, 0.95));
      g.add(this._seg(V[i], V[4], C.paper, 1.6, 0.75));
    }
    g.add(this._line([...V[0], ...V[1], ...V[2], ...V[0]], C.red, 2.4, 1, true));
    g.add(this._line(this._ring(1.32, 128).map((v, k) => (k % 3 === 1 ? 0 : k % 3 === 2 ? -v : v)), C.gray, 1, 0.22)); // the plane of the Sun
    const dot = new THREE.SphereGeometry(0.05, 32, 24);
    V.forEach((p, i) => {
      const col = i === 3 ? C.red : i === 4 ? C.white : C.paper;
      const m = new THREE.Mesh(dot, new THREE.MeshBasicMaterial({ color: col })); m.position.set(...p);
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO(), color: i === 3 ? C.red : 0xffffff, transparent: true, opacity: i > 2 ? 0.7 : 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
      h.scale.setScalar(i > 2 ? 0.55 : 0.3); m.add(h); g.add(m);
    });
    if (this.o.labels) {
      const a = tag('acc', 'Акаузальное'); a.position.set(0, 1.72, 0); g.add(a);
      const c = tag('lbl solo', '<span>Каузальное</span>'); c.position.set(0, -1.72, 0); g.add(c);
      const p = tag('mute', 'плоскость Солнца'); p.position.set(1.05, 0.12, 0.9); g.add(p);
    }
  }

  _overlay() {
    const d = document.createElement('div'); d.className = 'lock'; d.hidden = true;
    d.innerHTML = '<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span><div class="lock-cap"><b></b><i><s></s></i></div><span class="wave"></span>';
    this.el.appendChild(d); this.lockEl = d;
  }

  /* ---------------- input ---------------- */
  _input() {
    const c = this.renderer.domElement; c.style.touchAction = 'none';
    const ptr = new Map(); let moved = 0, lastT = 0, pinch0 = 0, zoom0 = 1;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0; lastT = performance.now(); this.dragging = true; this.vel.set(0, 0);
      if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = this.zoom; }
    });
    c.addEventListener('pointermove', (e) => {
      const p = ptr.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptr.size === 2) { const [a, b] = [...ptr.values()]; this.zoom = clamp(zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch0), 0.5, 3.2); moved += 99; return; }
      moved += Math.abs(dx) + Math.abs(dy);
      const now = performance.now(), dt = Math.max(1, now - lastT) / 1000; lastT = now;
      this._rot(dx * 0.0085, dy * 0.0085);
      this.vel.set(clamp(dx * 0.0085 / dt, -9, 9), clamp(dy * 0.0085 / dt, -6, 6));
    });
    const up = (e) => {
      if (!ptr.has(e.pointerId)) return;
      ptr.delete(e.pointerId);
      if (ptr.size === 0) {
        this.dragging = false;
        if (performance.now() - lastT > 90) this.vel.set(0, 0);
        if (moved < 7 && e.type === 'pointerup') this._pick(e);
      }
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = clamp(this.zoom * (1 - e.deltaY * 0.0012), 0.5, 3.2); }, { passive: false });
  }
  _rot(ax, ay) {
    const q = new THREE.Quaternion();
    this.pivot.quaternion.premultiply(q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ax));
    this.pivot.quaternion.premultiply(q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), ay));
  }
  _pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, this.camera);
    const hit = rc.intersectObjects(this.nodes.filter((n) => n.visible), false)[0];
    // generous touch target: nearest sphere within 26 px
    let idx = hit ? hit.object.userData.index : -1;
    if (idx < 0) {
      let best = 26;
      this.nodes.forEach((n, i) => {
        if (!n.visible) return;
        const s = this.screenOf(n);
        const d = Math.hypot(s.x - (e.clientX - r.left), s.y - (e.clientY - r.top)); if (d < best) { best = d; idx = i; }
      });
    }
    if (idx >= 0) { this.select(idx); this.onPick && this.onPick(idx); }
  }
  screenOf(obj) {
    const v = obj.getWorldPosition(new THREE.Vector3()).project(this.camera);
    return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h };
  }

  /* ---------------- public ---------------- */
  setScene(k) {
    this.scene = k; this.progress = 0;
    if (k === 'morph') { this.morphPhase = 'hold_tree'; this.morphHold = D.MORPH_HOLD; }
    for (const [key, g] of Object.entries(this.groups)) g.visible = key === k;
    this.nodes.forEach((n) => { n.visible = k !== 'tetra'; if (n.userData.label) n.userData.label.visible = n.visible; });
    if (this.lockEl) this.lockEl.hidden = true;
  }
  setProgress(v) {
    this.progress = clamp(v, 0, 100);
    if (this.scene === 'morph') { this.morphPhase = this.progress >= 99.5 ? 'to_tree' : 'to_sigil'; this.morphHold = 0; }
    this.playing = false;
  }
  select(i) { this.selected = i; }
  reset() { this.pivot.quaternion.setFromEuler(new THREE.Euler(0.2, 0.62, 0, 'YXZ')); this.vel.set(0, 0); this.zoom = 1; }
  intro() { this.intro_t = 0; this._introStart = undefined; }
  stageCount() { return (D.STAGED[this.scene] || []).length; }
  caption() {
    if (this.scene === 'morph') {
      const p = this.morphPhase;
      if (p === 'hold_tree') return `упор · древо ${this.morphHold.toFixed(1)} с`;
      if (p === 'hold_sigil') return `упор · сигил ${this.morphHold.toFixed(1)} с`;
      return `${p === 'to_sigil' ? 'древо → сигил' : 'сигил → древо'} ${Math.round(this.progress)}%`;
    }
    const st = D.STAGED[this.scene]; if (!st) return '';
    const i = Math.min(st.length - 1, Math.floor((this.progress / 100) * st.length));
    return `этап ${i + 1}/${st.length} · ${st[i]}`;
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h);
    if (this.composer && this.composer.setPixelRatio) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    this.css.setSize(w, h);
    const cam = this.camera; cam.aspect = w / h;
    // atlas: lift the model above the status panel; phone hero: lift it above the title
    const off = w > 700 ? this.o.offsetX : 0, offY = this.o.overlay ? Math.min(85, h * 0.1) : w <= 700 ? h * 0.22 : 0;
    if (off || offY) cam.setViewOffset(w, h, -w * off, offY, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    const fit = this.o.overlay ? (w <= 700 ? 1.95 : 2.5) : w > 700 && off ? 1.95 : 1.9;
    this.dist = fit / (Math.tan((cam.fov * Math.PI) / 360) * Math.min(1, cam.aspect * (off ? 1.25 : 1)));
    for (const m of this.mats) m.resolution.set(w, h);
  }

  /* ---------------- frame ---------------- */
  /* Adaptive quality: weak GPU -> drop bloom, then lower the pixel ratio. */
  _quality(raw) {
    if (raw > 0.5) return; // tab was hidden
    this._qn = (this._qn || 0) + 1; this._qs = (this._qs || 0) + raw;
    if (this._qn < 45) return;
    const avg = this._qs / this._qn; this._qn = 0; this._qs = 0;
    if (avg < 0.034) return;
    if (this.composer) { this.composer = null; }
    else if (this.renderer.getPixelRatio() > 1) { this.renderer.setPixelRatio(1); this.resize(); }
  }

  frame() {
    const now = performance.now(), raw = (now - this._last) / 1000, dt = clamp(raw, 0, 0.06); this._last = now;
    this._quality(raw);
    this.time += dt;
    // inertia + auto spin
    if (!this.dragging) {
      this._rot(this.vel.x * dt, this.vel.y * dt);
      const damp = Math.exp(-1.9 * dt); this.vel.y *= damp;
      if (this.autoSpin) this.vel.x += (0.3 - this.vel.x) * Math.min(1, dt * 1.1); else { this.vel.x *= damp; if (Math.abs(this.vel.x) < 0.002) this.vel.x = 0; }
    }
    this.stars.rotation.y += dt * 0.006;
    const d = this.dist / this.zoom; this.camera.position.set(0, 0, d); this.camera.lookAt(0, 0, 0);

    // intro: spheres drop in one after another, lines fade in afterwards
    if (this.intro_t < 1) this.intro_t = Math.min(1, (now - (this._introStart ??= now)) / 3000);
    this.la = smooth((this.intro_t - 0.3) / 0.6);

    if (this.playing) {
      if (this.scene === 'morph') this._advanceMorph(dt);
      else if (D.STAGED[this.scene]) this.progress = (this.progress + (this.scene === 'sigil' ? 9 : 7) * dt) % 100;
    }

    let pos;
    switch (this.scene) {
      case 'tree': pos = D.TREE; this.status = this._updTree(); break;
      case 'sigil': pos = D.SIGIL; this.status = this._updSigil(); break;
      case 'morph': { const t = this.progress / 100; pos = D.SPHERES.map((_, i) => this._morphPos(i, t)); this.status = this._updMorph(pos); break; }
      case 'nine': pos = D.NAMES.map((n) => D.NINE_NODES[n]); this.status = this._updNine(); break;
      default: pos = null; this.status = 'Два отражённых тетраэдра с общим основанием в плоскости Солнца · красная вершина — акаузальное, белая — каузальное';
    }
    if (pos) this._placeNodes(pos);
    this.pedestal.children.forEach((l) => { if (l.material && l.material.isLineMaterial) l.material.opacity = (l.userData.o ??= l.material.opacity) * this.la; });

    if (this.composer) this.composer.render(); else this.renderer.render(this.three, this.camera);
    this.css.render(this.three, this.camera);
    // CSS2D labels do not inherit a hidden parent: hide the inactive scenes' labels by hand
    for (const [key, g] of Object.entries(this.groups)) if (key !== this.scene) g.traverse((o) => { if (o.isCSS2DObject) o.element.style.display = 'none'; });
    if (this.scene === 'morph') this._lockOverlay(pos);
    this.onFrame && this.onFrame(this);
  }

  _advanceMorph(dt) {
    const p = this.morphPhase;
    if (p.startsWith('hold')) {
      this.morphHold -= dt;
      if (this.morphHold <= 0) { this.morphHold = 0; this.morphPhase = p === 'hold_sigil' ? 'to_tree' : 'to_sigil'; }
      return;
    }
    const step = D.MORPH_RATE * dt;
    if (p === 'to_sigil') { this.progress += step; if (this.progress >= 100) { this.progress = 100; this.morphPhase = 'hold_sigil'; this.morphHold = D.MORPH_HOLD; } }
    else { this.progress -= step; if (this.progress <= 0) { this.progress = 0; this.morphPhase = 'hold_tree'; this.morphHold = D.MORPH_HOLD; } }
  }

  _placeNodes(pos, active = this._active || new Set()) {
    const inv = this.pivot.quaternion.clone().invert();
    const down = new THREE.Vector3(0, -0.2, 0).applyQuaternion(inv);
    this.nodes.forEach((n, i) => {
      const k = backOut((this.intro_t * 3.0 - i * 0.22) / 1.1);
      const from = [pos[i][0], pos[i][1] + 2.4, pos[i][2] - 1.2];
      const p = this.intro_t < 1 ? lerp3(from, pos[i], clamp(k, 0, 1.2)) : pos[i];
      n.position.set(p[0], p[1], p[2]); n.scale.setScalar(Math.max(0.001, this.intro_t < 1 ? clamp(k, 0, 1.2) : 1));
      const sel = i === this.selected, act = active.has(i);
      const ring = n.userData.ring.material, halo = n.userData.halo.material;
      ring.color.copy(sel ? C.red : act ? C.white : C.paper);
      ring.opacity = sel ? 1 : act ? 0.95 : 0.34;
      n.userData.ring.scale.setScalar(sel ? 0.48 : act ? 0.44 : 0.38);
      ring.rotation = sel ? this.time * 0.8 : 0;
      halo.color.copy(sel ? C.red : C.paper); halo.opacity = sel ? 0.7 : act ? 0.32 : 0.06 + 0.08 * (1 - D.tone(i));
      const l = n.userData.label;
      if (l) { l.position.set(p[0] + down.x, p[1] + down.y, p[2] + down.z); l.element.classList.toggle('on', sel || act); l.element.classList.toggle('sel', sel); }
    });
  }

  _updTree() {
    const phase = (this.time * 0.42) % 6, step = Math.floor(phase), t = phase - step;
    this._active = new Set([step]); if (t > 0.62) this._active.add(step + 1);
    for (const l of this.treeEdges) {
      const u = l.userData, show = this.showAll || (u.short && !u.hidden);
      if (!show) { l.visible = false; if (u.no) u.no.visible = false; continue; }
      if (u.hidden) this._paint(l, C.red, 0.9, 1.7);
      else if (u.route) this._paint(l, C.paper, step === D.ROUTE.findIndex(([a, b]) => `${a}-${b}` === u.k) ? 1 : 0.8, 2.2);
      else this._paint(l, C.gray, 0.42, 1);
      if (u.no) u.no.visible = this.showNumbers;
    }
    this._paint(this.abyss, C.red, 1, 3.2);
    this.pulse.position.set(...lerp3(D.TREE[step], D.TREE[step + 1], t));
    this.pulse.visible = this.la > 0.5;
    const A = D.SPHERES[step], B = D.SPHERES[step + 1];
    return `П${D.PATH_NO.get(`${step}-${step + 1}`)} ${A.name} → ${B.name} · ${B.word}, ${B.process.toLowerCase()} · пунктир — три скрытых пути`;
  }

  _updSigil() {
    const st = D.SIGIL_STAGES.length, raw = (this.progress / 100) * st, stage = Math.min(st - 1, Math.floor(raw));
    const t = this.progress >= 100 ? 1 : raw - stage;
    const ap = stage === 1 ? Math.min(6, Math.floor(t * 7)) : -1, al = stage === 2 ? Math.min(8, Math.floor(t * 9)) : -1;
    this._active = new Set(ap >= 0 ? [ap] : []);
    this.sigilChords.forEach((l, k) => this._paint(l, k === al ? C.red : C.paper, k === al ? 1 : al >= 0 ? 0.3 : 0.6, k === al ? 3.2 : 1.5));
    if (this.chordTag) {
      this.chordTag.visible = al >= 0;
      if (al >= 0) {
        const [i, j] = D.CHORDS[al]; this.chordTag.position.set(...lerp3(D.SIGIL[i], D.SIGIL[j], 0.5));
        this.chordTag.element.textContent = `линия ${al + 1} · ${D.NAMES[i]} ↔ ${D.NAMES[j]}`;
      }
    }
    if (stage === 0) return 'Полная эмблема: семь сфер на окружности и девять прямых связей между ними';
    if (stage === 1) { const s = D.SPHERES[ap]; return `Сфера ${ap + 1} из 7: ${s.name} (${s.word}) — от нижней точки против часовой стрелки`; }
    const [i, j] = D.CHORDS[al]; return `Линия ${al + 1} из 9: ${D.NAMES[i]} ↔ ${D.NAMES[j]} — связь между двумя сферами`;
  }

  _updMorph(cur) {
    const t = this.progress / 100, s = smooth(t), ta = 1 - s, ph = this.morphPhase;
    const treeLock = ph === 'hold_tree', sigLock = ph === 'hold_sigil';
    this._active = new Set();
    this.trails.forEach((l) => this._paint(l, C.gray, t > 0.015 && t < 0.985 ? 0.3 : 0, 1));
    for (const l of this.morphEdges) {
      const u = l.userData, show = this.showAll || u.route;
      if (!show || ta < 0.03) { l.visible = false; continue; }
      this._setSeg(l, cur[u.i], cur[u.j]);
      if (u.hidden) this._paint(l, C.red, 0.9 * ta, 1.7);
      else if (u.route) this._paint(l, C.paper, (treeLock ? 1 : 0.8) * ta, treeLock ? 2.4 : 1.8);
      else this._paint(l, C.gray, 0.4 * ta, 1);
    }
    this._setSeg(this.morphAbyss, cur[3], cur[4]);
    this._paint(this.morphAbyss, C.red, treeLock ? 1 : 0.85 * ta, 3);
    this._paint(this.morphRing, sigLock ? C.red : C.paper, (sigLock ? 1 : 0.55) * s, sigLock ? 2 : 1.4);
    this._paint(this.morphRing2, C.gray, 0.22 * s, 1);
    for (const l of this.morphChords) { this._setSeg(l, cur[l.userData.i], cur[l.userData.j]); this._paint(l, sigLock ? C.red : C.paper, (sigLock ? 0.95 : 0.6) * s, sigLock ? 2.4 : 1.6); }
    if (sigLock) return `Упор · сигил: семь точек на окружности и девять линий · через ${this.morphHold.toFixed(1)} с — обратно в Древо`;
    if (treeLock) return `Упор · Древо: семь сфер, 21 путь, Бездна между Солнцем и Марсом · через ${this.morphHold.toFixed(1)} с — переход в сигил`;
    return `${ph === 'to_sigil' ? 'Древо → сигил' : 'Сигил → Древо'} ${Math.round(this.progress)}% · те же семь сфер идут по объёмным дугам`;
  }

  _lockOverlay() {
    const el = this.lockEl; if (!el) return;
    const locked = this.morphPhase.startsWith('hold') && this.la > 0.9;
    el.hidden = !locked; if (!locked) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const n of this.nodes) { const p = this.screenOf(n); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const pad = 34, top = Math.max(y0 - pad, 104); // keep the caption below the scene tabs
    Object.assign(el.style, { left: `${x0 - pad}px`, top: `${top}px`, width: `${x1 - x0 + pad * 2}px`, height: `${Math.max(60, y1 + pad - top)}px` });
    const flash = clamp(1 - (D.MORPH_HOLD - this.morphHold) / 0.55, 0, 1);
    el.style.setProperty('--flash', flash.toFixed(3));
    el.querySelector('b').textContent = this.morphPhase === 'hold_sigil' ? 'Септенарный сигил собран' : 'Древо Вирд собрано';
    el.querySelector('s').style.width = `${(this.morphHold / D.MORPH_HOLD) * 100}%`;
  }

  _updNine() {
    const st = D.NINE_STAGES.length, raw = (this.progress / 100) * st, stage = Math.min(st - 1, Math.floor(raw));
    const t = this.progress >= 100 ? 1 : raw - stage;
    const aseg = stage === 0 ? Math.min(D.NINE_SEGS.length - 1, Math.floor(t * D.NINE_SEGS.length)) : -1;
    let an = null;
    if (stage === 1 || stage === 5) an = D.NAMES[Math.min(6, Math.floor(t * 7))]; else if (stage === 3) an = 'Юпитер';
    this._active = new Set(an ? [D.INDEX[an]] : []);
    this.nineSegs.forEach((l, k) => this._paint(l, k === aseg ? C.red : C.paper, k === aseg ? 1 : 0.55, k === aseg ? 3.2 : 1.6));
    for (const m of this.crosses) {
      const lit = stage === 2; m.material.color.copy(lit ? C.white : C.paper); m.scale.setScalar(lit ? 1.35 : 1);
      m.userData.halo.material.opacity = lit ? 0.8 : 0; if (m.userData.tag) m.userData.tag.visible = lit;
    }
    for (const g of this.gates) {
      const lit = (!g.userData.star && (stage === 3 || stage === 6)) || (g.userData.star && stage === 4);
      g.userData.lines.forEach((l) => this._paint(l, lit ? C.red : C.paper, lit ? 1 : 0.6, lit ? 2.6 : 1.6));
      if (g.userData.tag) g.userData.tag.element.classList.toggle('hot', lit);
    }
    return `${D.NINE_STAGES[stage]} · ${D.NINE_HINTS[stage]}`;
  }

  start() { this._last = performance.now(); this.renderer.setAnimationLoop(() => this.frame()); }
  stop() { this.renderer.setAnimationLoop(null); }
}
