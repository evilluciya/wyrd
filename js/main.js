/* main.js — page wiring: Telegram, hero scene, section figures and the full-screen atlas. */
import * as D from './data.js?v=202611171643';
import { Atlas } from './atlas.js?v=202611171643';
import * as V from './viz.js?v=202611171643';

const DEV_LINK = '<p class="dev-link">Канал разработчика: <a class="tg-link" href="https://t.me/livinggad" target="_blank" rel="noopener">@LIVINGGAD</a></p>';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const coarse = matchMedia('(pointer: coarse)').matches;
const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined ? window.Telegram.WebApp : null;
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };

/* ================= Telegram Mini App ================= */
if (tg) {
  try {
    tg.ready(); tg.expand();
    tg.setHeaderColor && tg.setHeaderColor('#050505'); tg.setBackgroundColor && tg.setBackgroundColor('#050505');
    tg.disableVerticalSwipes && tg.disableVerticalSwipes(); // rotating the model must not close the app
  } catch (e) { /* older clients */ }
}

/* ================= hero ================= */
V.heroSigil($('#heroSigil'));
const hero = new Atlas($('#heroCanvas'), { interactive: !coarse, labels: !coarse, offsetX: 0.2, overlay: false });
hero.setScene('morph'); hero.intro();
if (coarse) hero.renderer.domElement.style.touchAction = 'pan-y';
let heroVisible = true, atlasOpen = false;
const heroLoop = () => (heroVisible && !atlasOpen ? hero.start() : hero.stop());
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; heroLoop(); }).observe($('#top'));

$$('[data-count]').forEach((el) => {
  const to = +el.dataset.count, t0 = performance.now() + 700;
  const step = (now) => { const k = Math.min(1, Math.max(0, (now - t0) / 1400)); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
});

/* ================= sections ================= */
const ROWS = [['Слово', 'word', 'w'], ['Процесс', 'process'], ['Звезда', 'star'], ['Камень', 'stone'], ['Аромат', 'incense'], ['Форма', 'form']];
const dl = (s) => `<dl>${ROWS.map(([n, k, c]) => `<dt>${n}</dt><dd${c ? ` class="${c}"` : ''}>${s[k]}</dd>`).join('')}</dl>`;
const place = (i) => `На Древе — уровень ${i + 1} снизу. На сигиле — точка ${i + 1} от нижней против часовой стрелки.`;

function showCard(i) {
  const s = D.SPHERES[i];
  $('#treeCard').innerHTML = `<div class="card-glyph">${s.glyph}</div><h3 class="card-name">${s.name}</h3>
    <div class="card-no">сфера ${i + 1} из 7</div>${dl(s)}
    <p class="mute" style="font-size:15px;margin:14px 0 0">${place(i)}</p>
    <div class="btn-wrap"><button class="btn btn-red btn-sm" data-open-sphere="${i}">Смотреть в 3D</button></div>`;
  $('#treeCard [data-open-sphere]').onclick = () => openAtlas('tree', i);
  cardsApi.select(i);
}
const treeApi = V.tree($('#vizTree'), showCard);
$('#treeAll').onchange = (e) => treeApi.setAll(e.target.checked);
$('#treeNo').onchange = (e) => treeApi.setNo(e.target.checked);

const note = (id) => { const n = document.createElement('div'); n.className = 'viz-note'; $(id).after(n); return n; };
V.sigil($('#vizSigil'), $('#sigilCtl'), note('#sigilCtl'));
V.morph($('#vizMorph'), $('#morphRange'));
V.nine($('#vizNine'), $('#nineCtl'), note('#nineCtl'));
V.tetra($('#vizTetra'));
const cardsApi = V.cards($('#sphereCards'), (i) => { treeApi.select(i); $('#s1').scrollIntoView({ behavior: 'smooth' }); });
treeApi.select(3);

$$('.sec-head, .frame, .spheres').forEach((el) => el.classList.add('reveal'));
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.1 });
$$('.reveal').forEach((el) => io.observe(el));

let lastY = 0;
addEventListener('scroll', () => {
  const y = scrollY; $('#topnav').classList.toggle('hide', y > lastY && y > 200); lastY = y;
  let cur = null; $$('.sec[id]').forEach((s) => { if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = s.id; });
  $$('.navlinks a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + cur));
}, { passive: true });

/* ================= atlas ================= */
let atlas = null;
const ui = { cap: $('#stCap'), text: $('#stText'), tl: $('#timeline'), play: $('#playBtn') };

function buildAtlas() {
  atlas = new Atlas($('#atlasCanvas'), { interactive: true, labels: true });
  atlas.onPick = (i) => sphereSheet(i);
  let lastText = '', lastCap = '';
  atlas.onFrame = (a) => {
    if (a.status !== lastText) { ui.text.textContent = lastText = a.status; }
    const c = a.caption(); if (c !== lastCap) { ui.cap.textContent = lastCap = c; }
    const p = a.progress; ui.tl.querySelector('i').style.width = `${p}%`; ui.tl.querySelector('b').style.left = `${p}%`;
    ui.play.textContent = a.playing ? 'Стоп' : 'Пуск';
  };
  const tabs = $('#tabs');
  D.SCENES.forEach((s) => { const b = document.createElement('button'); b.textContent = s.title; b.dataset.k = s.key; b.title = s.full; b.onclick = () => setScene(s.key); tabs.appendChild(b); });
  ui.play.onclick = () => { atlas.playing = !atlas.playing; };
  $('#spinBtn').onclick = (e) => { atlas.autoSpin = !atlas.autoSpin; e.target.classList.toggle('on', atlas.autoSpin); };
  $('#allBtn').onclick = (e) => { atlas.showAll = !atlas.showAll; e.target.classList.toggle('on', atlas.showAll); };
  $('#noBtn').onclick = (e) => { atlas.showNumbers = !atlas.showNumbers; e.target.classList.toggle('on', atlas.showNumbers); };
  $('#resetBtn').onclick = () => atlas.reset();
  $('#hintBtn').onclick = () => openSheet('💡 ' + D.SCENES.find((s) => s.key === atlas.scene).full, `<p style="margin:0">${D.SCENE_HINT[atlas.scene]}</p>` + DEV_LINK);
  $('#sheetOk').onclick = closeSheet;
  // timeline: drag to scrub stages both ways; never switches the scene
  const tl = ui.tl; let drag = false;
  const apply = (e) => { const r = tl.getBoundingClientRect(); atlas.setProgress(((e.clientX - r.left) / r.width) * 100); };
  tl.addEventListener('pointerdown', (e) => { drag = true; tl.setPointerCapture(e.pointerId); apply(e); });
  tl.addEventListener('pointermove', (e) => drag && apply(e));
  tl.addEventListener('pointerup', () => { drag = false; });
  addEventListener('keydown', (e) => {
    if (!atlasOpen) return;
    const keys = D.SCENES.map((s) => s.key), i = keys.indexOf(atlas.scene);
    if (e.key === 'Escape') { if (!$('#sheet').hidden) closeSheet(); else closeAtlas(); }
    else if (e.key === ' ') { e.preventDefault(); atlas.playing = !atlas.playing; }
    else if (e.key === 'ArrowRight') setScene(keys[(i + 1) % keys.length]);
    else if (e.key === 'ArrowLeft') setScene(keys[(i + keys.length - 1) % keys.length]);
    else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') atlas.reset();
    else if (/^[1-5]$/.test(e.key)) setScene(keys[+e.key - 1]);
  });
}

function setScene(k) {
  atlas.setScene(k); atlas.playing = true;
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.k === k));
  $('#tabs button.on') && $('#tabs button.on').scrollIntoView({ inline: 'center', block: 'nearest' });
  const staged = k === 'morph' || atlas.stageCount() > 0;
  ui.tl.classList.toggle('off', !staged);
  ui.play.style.visibility = staged ? '' : 'hidden';
  $$('.tick', ui.tl).forEach((t) => t.remove());
  const n = atlas.stageCount();
  for (let i = 1; i < n; i++) { const t = document.createElement('span'); t.className = 'tick'; t.style.left = `${(i / n) * 100}%`; ui.tl.appendChild(t); }
  $('#allBtn').hidden = $('#noBtn').hidden = !(k === 'tree' || k === 'morph');
  $('#noBtn').hidden = k !== 'tree';
}

function openSheet(title, html) { $('#sheetTitle').innerHTML = title; $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; }
function sphereSheet(i) {
  const s = D.SPHERES[i];
  openSheet(`<span class="g">${s.glyph}</span>${s.name}`, `<div class="card-no" style="margin-top:0">сфера ${i + 1} из 7</div>${dl(s)}<p class="mute" style="font-size:15px;margin:12px 0 0">${place(i)}</p>`);
}

function openAtlas(scene = 'tree', sphere = -1) {
  if (!atlas) buildAtlas();
  $('#atlas').hidden = false; atlasOpen = true; document.body.style.overflow = 'hidden';
  heroLoop(); atlas.resize();
  setScene(D.SCENES.some((s) => s.key === scene) ? scene : 'tree');
  atlas.select(sphere); if (sphere >= 0) sphereSheet(sphere);
  atlas.start();
  if (tg && tg.BackButton) { tg.BackButton.show(); tg.BackButton.onClick(closeAtlas); }
  if (!store.get('wyrd_intro') && sphere < 0) {
    store.set('wyrd_intro', '1');
    openSheet('Как смотреть', `<ol><li>Тяните пальцем или мышью — модель вращается в любую сторону.</li><li>Бросок — раскрутить, щипок или колесо — приблизить.</li><li>Коснитесь сферы — откроется её карточка.</li><li>Вкладки сверху — пять сцен, шкала внизу — этапы.</li><li>💡 — подсказка к текущей сцене.</li></ol>` + DEV_LINK);
  }
}
function closeAtlas() {
  if (!atlasOpen) return;
  closeSheet(); $('#atlas').hidden = true; atlasOpen = false; document.body.style.overflow = '';
  atlas.stop(); heroLoop();
  if (tg && tg.BackButton) { tg.BackButton.offClick(closeAtlas); tg.BackButton.hide(); }
}
$('#atlasClose').onclick = closeAtlas;
$$('[data-atlas]').forEach((b) => b.addEventListener('click', () => openAtlas(b.dataset.atlas || 'tree')));

window.__wyrd = { hero, openAtlas, closeAtlas, setScene: (k) => setScene(k), get atlas() { return atlas; }, D };

// deep link: #atlas / #tree … or Telegram startapp=atlas|tree|sigil|morph|nine|tetra
const start = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || location.hash.slice(1);
if (start === 'atlas' || start === 'play') openAtlas('tree');
else if (D.SCENES.some((s) => s.key === start)) openAtlas(start);
