/* Slides Studio — presentation editor of the Studio family. Same chrome and controls as the other apps: menus built from
   MENUS (customizable shortcuts), option bar, tool rail, document tabs, panels on the right, status bar, settings dialog.
   A slide is a fixed 1920×1080 canvas with text, shapes, pictures and tables; files are plain JSON (.slides).
   The native shell (Rust) does files, dialogs, printing and texts; in a plain browser the same code falls back to
   downloads/uploads so the UI can be tried anywhere. */
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const STORE = 'slides-studio.v1';
const W = 1920, H = 1080;
const invoke = window.__TAURI__ ? window.__TAURI__.core.invoke : null;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const IS_PRESENTER = location.hash === '#presenter';

/* ================= Texts (src-tauri/i18n/*.json, served by Rust) ================= */
let I18N = {en: {}, de: {}}, lang = 'en';
function t(key, vars) {
  let s = (I18N[lang] && I18N[lang][key]) ?? I18N.en[key] ?? key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
const fmtKey = k => lang === 'de' ? k.replace(/Ctrl/g, 'Strg').replace(/Shift/g, 'Umschalt') : k;
async function loadTexts() {
  if (invoke) { I18N = await invoke('texts'); return; }
  // Browser preview (repository root served): the same files.
  const get = l => fetch(`../src-tauri/i18n/${l}.json`).then(r => r.json()).catch(() => ({}));
  I18N = {en: await get('en'), de: await get('de')};
}

/* ================= Designs (the look of a presentation) ================= */
const SANS = '"Segoe UI",system-ui,-apple-system,Arial,sans-serif', SERIF = 'Georgia,"Times New Roman",serif';
const DESIGNS = {
  studio:   {name: 'Studio',   bg: '#ffffff', text: '#1f2328', accent: '#378ef0', accent2: '#7a5cff', head: SANS,  body: SANS},
  midnight: {name: 'Midnight', bg: '#14161f', text: '#f2f4ff', accent: '#6ea8ff', accent2: '#c18bff', head: SANS,  body: SANS},
  sunset:   {name: 'Sunset',   bg: '#fff4ea', text: '#3b1f14', accent: '#ff6a3d', accent2: '#ffb347', head: SANS,  body: SANS},
  forest:   {name: 'Forest',   bg: '#f1f7f2', text: '#173324', accent: '#2f9e5b', accent2: '#8bc34a', head: SANS,  body: SANS},
  paper:    {name: 'Paper',    bg: '#faf7f0', text: '#2b2b2b', accent: '#b5483a', accent2: '#2f5d8a', head: SERIF, body: SERIF},
  neon:     {name: 'Neon',     bg: '#0b0b12', text: '#ffffff', accent: '#00e5ff', accent2: '#ff2bd6', head: SANS,  body: SANS},
  mono:     {name: 'Mono',     bg: '#f4f4f4', text: '#111111', accent: '#111111', accent2: '#777777', head: '"Courier New",monospace', body: '"Courier New",monospace'}
};
const FONTS = [['font.head', 't:head'], ['font.body', 't:body'], ['Segoe UI', SANS], ['Georgia', SERIF], ['Arial', 'Arial,Helvetica,sans-serif'],
  ['Trebuchet', '"Trebuchet MS",sans-serif'], ['Verdana', 'Verdana,sans-serif'], ['Times', '"Times New Roman",serif'],
  ['Courier', '"Courier New",monospace'], ['Impact', 'Impact,"Arial Black",sans-serif']];
const SWATCHES = ['t:text', 't:bg', 't:accent', 't:accent2', '#ffffff', '#000000', '#e5484d', '#f5a524', '#30a46c', '#0ea5e9'];
const SHAPES = ['rect', 'round', 'ellipse', 'triangle', 'diamond', 'star', 'arrow', 'line'];
const TRANSITIONS = ['none', 'fade', 'slide', 'zoom'];
const LAYOUTS = ['title', 'content', 'two', 'imgtext', 'quote', 'section', 'big', 'blank'];

/* ================= Document model ================= */
const newEl = (type, p) => Object.assign({id: uid(), type, x: 100, y: 100, w: 400, h: 200, rot: 0, op: 1}, p);
const textEl = p => newEl('text', Object.assign({text: '', size: 48, color: 't:text', font: 't:body', bold: false, italic: false, underline: false, align: 'left', w: 700}, p));
const shapeEl = (shape, p) => newEl('shape', Object.assign({shape, fill: 't:accent', stroke: null, sw: 0, radius: 24, w: 300, h: 300}, p));
const imageEl = (src, w, h, p) => { const k = Math.min(1, 1100 / w, 700 / h);
  return newEl('image', Object.assign({src, fit: 'contain', iw: w, ih: h, w: Math.round(w * k), h: Math.round(h * k), x: Math.round((W - w * k) / 2), y: Math.round((H - h * k) / 2)}, p)); };
const tableEl = (rows, cols, p) => { const w = Math.min(1600, cols * 300);
  return newEl('table', Object.assign({cells: Array.from({length: rows}, () => Array(cols).fill('')), hdr: true, size: 32, color: 't:text', fill: 't:accent', w, x: Math.round((W - w) / 2), y: 260}, p)); };
const AUTO_H = new Set(['text', 'table']);              // height follows the content
const newSlide = (els = []) => ({id: uid(), bg: 't:bg', els, trans: 'fade', notes: ''});

function layout(kind) {
  const T = p => textEl(Object.assign({ph: true}, p));
  switch (kind) {
    case 'title': return [shapeEl('rect', {x: 0, y: 0, w: 40, h: H, fill: 't:accent'}),
      T({x: 140, y: 340, w: 1500, size: 120, bold: true, font: 't:head', text: t('ph.title')}),
      T({x: 144, y: 620, w: 1400, size: 52, color: 't:accent', text: t('ph.subtitle')})];
    case 'content': return [T({x: 120, y: 80, w: 1680, size: 84, bold: true, font: 't:head', text: t('ph.heading')}),
      shapeEl('rect', {x: 124, y: 200, w: 160, h: 8, fill: 't:accent'}),
      T({x: 120, y: 270, w: 1680, size: 46, text: ['', '', ''].map(() => '• ' + t('ph.text')).join('\n')})];
    case 'two': return [T({x: 120, y: 80, w: 1680, size: 84, bold: true, font: 't:head', text: t('ph.heading')}),
      shapeEl('rect', {x: 124, y: 200, w: 160, h: 8, fill: 't:accent'}),
      T({x: 120, y: 270, w: 800, size: 42, text: t('ph.text')}), T({x: 1000, y: 270, w: 800, size: 42, text: t('ph.text')})];
    case 'imgtext': return [shapeEl('round', {x: 120, y: 120, w: 800, h: 840, fill: 't:accent2', radius: 32}),
      T({x: 1000, y: 160, w: 800, size: 84, bold: true, font: 't:head', text: t('ph.heading')}),
      T({x: 1000, y: 380, w: 800, size: 42, text: t('ph.text')})];
    case 'quote': return [textEl({x: 160, y: 120, w: 300, size: 300, bold: true, color: 't:accent', font: 't:head', text: '“'}),
      T({x: 260, y: 360, w: 1400, size: 76, italic: true, font: 't:head', text: t('ph.text')}),
      T({x: 264, y: 760, w: 1200, size: 40, color: 't:accent', text: '— ' + t('ph.author')})];
    case 'section': return [shapeEl('rect', {x: 0, y: 0, w: W, h: H, fill: 't:accent'}),
      T({x: 140, y: 400, w: 1600, size: 130, bold: true, color: '#ffffff', font: 't:head', text: t('ph.title')})];
    case 'big': return [T({x: 160, y: 300, w: 1600, size: 140, bold: true, align: 'center', font: 't:head', text: t('ph.text')})];
    default: return [];
  }
}
const newDeck = () => ({version: 1, theme: 'studio', slides: [newSlide(layout('title'))]});
const validDeck = o => !!o && Array.isArray(o.slides) && o.slides.length > 0 && o.slides.every(s => s && Array.isArray(s.els));

/* Colors/fonts may be design tokens ("t:accent") so a design change restyles the whole deck. */
const designOf = d => DESIGNS[d && d.theme] || DESIGNS.studio;
function color(c, th) { if (typeof c === 'string' && c.startsWith('t:')) return th[c.slice(2)] || '#000'; return c || 'transparent'; }
const fontOf = (f, th) => f && f.startsWith('t:') ? th[f.slice(2)] : (f || th.body);
const bgCss = (b, th) => b && typeof b === 'object' ? `linear-gradient(${b.a ?? 135}deg,${color(b.c1, th)},${color(b.c2, th)})` : color(b, th);

/* ================= Settings, documents, session ================= */
const THEMES = ['dark', 'light', 'github', 'github-dark'];
const DEF = {keys: {}, autoHide: false, lang: 'auto', theme: 'dark', dock: true, dockTab: 'layouts', snap: true, zoom: 100};
let settings = {...DEF}, docs = [], active = -1, untitledN = 1, recent = [], booted = false, saveT;
/* The open document's working state; storeCurrent() writes it back to docs[active]. */
let doc = null, cur = 0, sel = [], hist = {stack: [], i: -1};
const D = () => docs[active];
const design = () => designOf(doc);
const slide = () => doc.slides[cur];
const byId = id => slide().els.find(e => e.id === id);
const selEls = () => doc ? sel.map(byId).filter(Boolean) : [];
const effectiveLang = () => settings.lang === 'auto' ? ((navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en') : settings.lang;

function storeCurrent() { const d = D(); if (d && doc) { d.deck = doc; d.cur = cur; d.hist = hist; } }
function saveNow() {
  if (IS_PRESENTER || !booted) return;
  storeCurrent();
  const base = {active, settings, untitledN, recent};
  const full = docs.map(d => ({name: d.name, path: d.path, dirty: d.dirty, cur: d.cur, deck: d.deck}));
  try { localStorage.setItem(STORE, JSON.stringify({...base, docs: full})); }
  catch (e) {
    // Too big for the browser storage (pictures): saved files are kept as paths only.
    try { localStorage.setItem(STORE, JSON.stringify({...base, docs: full.map(d => d.path && !d.dirty ? {...d, deck: null} : d)})); } catch (e2) {}
  }
}
function saveSession() { clearTimeout(saveT); saveT = setTimeout(saveNow, 300); }
window.addEventListener('beforeunload', saveNow);

function addRecent(path, name) {
  if (typeof path !== 'string') return;
  recent = [{path, name}, ...recent.filter(r => r.path !== path)].slice(0, 10);
}
function renderRecent() {
  $('#recent').innerHTML = recent.length ? `<div class="sect">${esc(t('ui.recent'))}</div>` + recent.map((r, i) =>
    `<button data-recent="${i}"><span class="tab-ico">SL</span><span>${esc(r.name)}</span><small>${esc(r.path)}</small></button>`).join('') : '';
}
$('#recent').addEventListener('click', async e => {
  const b = e.target.closest('[data-recent]'); if (!b) return;
  const r = recent[+b.dataset.recent];
  try { openNative([await invoke('read_file', {path: r.path})]); }
  catch (err) { recent = recent.filter(x => x !== r); renderRecent(); saveSession(); toast(t('toast.missing', {name: r.name})); }
});

function openDoc(name, deck, path = null) {
  const same = path ? docs.findIndex(d => d.path === path) : -1;
  if (same >= 0) { activate(same); return; }
  if (editing) finishEdit();
  storeCurrent();
  docs.push({name: name || `${t('ui.untitled')} ${untitledN++}.slides`, path, deck, cur: 0, dirty: false, hist: {stack: [], i: -1}});
  active = docs.length - 1;
  if (path) addRecent(path, name);
  loadActive();
}
const openNative = list => list.forEach(f => {
  let deck; try { deck = JSON.parse(f.content); } catch (e) { deck = null; }
  if (!validDeck(deck)) return toast(t('toast.notDeck', {name: f.name}));
  openDoc(f.name, deck, invoke ? f.path : null);
});
function loadActive() {
  const d = D();
  $('#emptyState').hidden = !!d; $('#workspace').hidden = !d;
  editing = null; sel = [];
  if (!d) {
    doc = null; overlay.replaceChildren(); stage.replaceChildren();
    renderTabs(); updateTitle(); renderRecent(); renderOptbar(); renderDock(); syncDisabled(); saveSession(); return;
  }
  doc = d.deck; cur = clamp(d.cur || 0, 0, doc.slides.length - 1); hist = d.hist || {stack: [], i: -1}; d.hist = hist;
  if (!hist.stack.length) { hist.stack = [snapshot()]; hist.i = 0; }
  renderTabs(); fit(); renderAll(); saveSession();
}
function activate(i) { if (i === active) return; if (editing) finishEdit(); storeCurrent(); active = i; loadActive(); }
async function ask(message) {
  return invoke ? invoke('confirm', {title: t('confirm.title'), message, okLabel: t('confirm.ok'), cancelLabel: t('confirm.cancel')}) : confirm(message);
}
async function closeTab(i) {
  const d = docs[i]; if (!d) return;
  if (d.dirty && !await ask(t('confirm.close', {name: d.name}))) return;
  storeCurrent();
  i = docs.indexOf(d); docs.splice(i, 1);
  if (i < active) active--; else active = Math.min(active, docs.length - 1);   // -1 = start screen
  loadActive();
}
function renderTabs() {
  const box = $('#tabs'); box.innerHTML = '';
  docs.forEach((d, i) => {
    const tab = el('div', {className: 'tab' + (i === active ? ' active' : '') + (d.dirty ? ' dirty' : '')});
    tab.dataset.i = i;
    tab.title = (d.path || d.name) + (!d.path && d.dirty ? ' ' + t('ui.notSaved') : '');
    tab.innerHTML = `<span class="tab-ico">SL</span><span class="name">${esc(d.name)}</span><button class="x" title="${esc(tip('closeTab'))}">&#10005;</button>`;
    tab.onmousedown = e => { if (e.button === 1) { e.preventDefault(); closeTab(i); } };
    tab.onclick = e => e.target.closest('.x') ? closeTab(i) : activate(i);
    box.append(tab);
  });
  const plus = el('button', {className: 'tab-new', title: tip('newDoc'), textContent: '+'});
  plus.onclick = () => run('newDoc');
  box.append(plus);
}
function updateTitle() {
  const d = D(), st = $('#stState');
  if (!d) {
    $('#apptitle').textContent = document.title = 'Slides Studio';
    st.className = ''; st.textContent = ''; ['#stSlide', '#stSel'].forEach(s => $(s).textContent = '');
    return;
  }
  $('#apptitle').textContent = `${d.name}${d.dirty ? ' ●' : ''}  —  Slides Studio`;
  document.title = `${d.dirty ? '● ' : ''}${d.name} — Slides Studio`;
  st.className = 'st-state' + (d.dirty ? ' dirty' : '');
  st.textContent = d.dirty ? t('st.dirty') : d.path ? t('st.saved') : t('st.clean');
}
function markDirty(flag) {
  const d = D(); if (!d) return;
  if (d.dirty !== flag) { d.dirty = flag; renderTabs(); }
  updateTitle(); saveSession();
}

/* ================= History ================= */
function snapshot() { return JSON.stringify({deck: doc, cur}); }
function commit(dirty = true) {
  const s = snapshot();
  if (hist.stack[hist.i] === s) return;
  hist.stack.length = hist.i + 1; hist.stack.push(s);
  if (hist.stack.length > 150) hist.stack.shift();
  hist.i = hist.stack.length - 1;
  if (dirty) markDirty(true); else saveSession();
  syncDisabled();
}
function restore(s) {
  const o = JSON.parse(s); doc = o.deck; D().deck = doc; cur = clamp(o.cur, 0, doc.slides.length - 1);
  sel = sel.filter(id => byId(id)); markDirty(true); renderAll();
}
function undo() { if (editing) finishEdit(); if (hist.i > 0) { hist.i--; restore(hist.stack[hist.i]); } }
function redo() { if (hist.i < hist.stack.length - 1) { hist.i++; restore(hist.stack[hist.i]); } }

/* ================= Drawing slides ================= */
function shapeSvg(e, th) {
  const w = e.w, h = e.h, fill = color(e.fill, th), st = e.stroke ? color(e.stroke, th) : 'none', sw = e.sw || 0;
  let inner;
  switch (e.shape) {
    case 'ellipse': inner = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}"/>`; break;
    case 'triangle': inner = `<polygon points="${w / 2},0 ${w},${h} 0,${h}"/>`; break;
    case 'diamond': inner = `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}"/>`; break;
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.2 : 0.5, a = -Math.PI / 2 + i * Math.PI / 5; pts.push(`${w / 2 + Math.cos(a) * r * w},${h / 2 + Math.sin(a) * r * h}`); }
      inner = `<polygon points="${pts.join(' ')}"/>`; break; }
    case 'arrow': { const b = h * 0.3, hh = w * 0.35;
      inner = `<polygon points="0,${h / 2 - b / 2} ${w - hh},${h / 2 - b / 2} ${w - hh},0 ${w},${h / 2} ${w - hh},${h} ${w - hh},${h / 2 + b / 2} 0,${h / 2 + b / 2}"/>`; break; }
    case 'line': return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="${fill}" stroke-width="${Math.max(2, sw || 8)}" stroke-linecap="round"/></svg>`;
    case 'round': inner = `<rect width="${w}" height="${h}" rx="${Math.min(e.radius ?? 24, w / 2, h / 2)}"/>`; break;
    default: inner = `<rect width="${w}" height="${h}" rx="${Math.min(e.radius ?? 0, w / 2, h / 2)}"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><g fill="${fill}" stroke="${st}" stroke-width="${sw}">${inner}</g></svg>`;
}
/* One element as a DOM node in slide pixels. `hideEmpty` leaves out untouched placeholders (present / export). */
function elNode(e, th, hideEmpty) {
  if (hideEmpty && e.ph) return null;
  const n = el('div', {className: 'el ' + e.type});
  n.dataset.id = e.id;
  n.style.cssText = `left:${e.x}px;top:${e.y}px;width:${e.w}px;transform:rotate(${e.rot || 0}deg);opacity:${e.op ?? 1}`;
  if (e.type === 'text') {
    n.textContent = e.text;
    Object.assign(n.style, {fontSize: e.size + 'px', color: color(e.color, th), fontFamily: fontOf(e.font, th), fontWeight: e.bold ? '700' : '400',
      fontStyle: e.italic ? 'italic' : 'normal', textDecoration: e.underline ? 'underline' : 'none', textAlign: e.align || 'left'});
  } else if (e.type === 'shape') {
    n.style.height = e.h + 'px'; n.innerHTML = shapeSvg(e, th);
  } else if (e.type === 'table') {
    const tb = el('table', {className: 'tbl'});
    Object.assign(tb.style, {fontSize: e.size + 'px', color: color(e.color, th), fontFamily: fontOf('t:body', th)});
    e.cells.forEach((row, r) => {
      const tr = el('tr');
      row.forEach((c, ci) => {
        const head = e.hdr && r === 0, td = el(head ? 'th' : 'td', {textContent: c});
        td.dataset.r = r; td.dataset.c = ci;
        if (head) { td.style.background = color(e.fill, th); td.style.color = '#fff'; } else if (r % 2 === 0) td.style.background = 'rgba(127,127,127,.08)';
        tr.append(td);
      });
      tb.append(tr);
    });
    n.append(tb);
  } else if (e.type === 'image') {
    n.style.height = e.h + 'px';
    n.style.backgroundImage = `url("${e.src}")`;
    n.style.backgroundSize = e.fit === 'stretch' ? '100% 100%' : e.fit === 'cover' ? 'cover' : 'contain';
  }
  return n;
}
function slideNode(s, th, hideEmpty = false) {
  const root = el('div', {className: 'slide-root'});
  root.style.cssText = 'position:absolute;inset:0;overflow:hidden';
  const bg = el('div', {className: 'slide-bg'}); bg.style.background = bgCss(s.bg, th); root.append(bg);
  for (const e of s.els) { const n = elNode(e, th, hideEmpty); if (n) root.append(n); }
  return root;
}
/* A small, scaled copy of a slide (filmstrip, layout and design cards). */
function previewOf(s, th) {
  const pv = el('div', {className: 'pv'}), inner = slideNode(s, th);
  inner.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;overflow:hidden`;
  pv.append(inner);
  const sc = () => { const w = pv.clientWidth; if (w) inner.style.transform = `scale(${w / W})`; };
  requestAnimationFrame(sc); new ResizeObserver(sc).observe(pv);
  return pv;
}

/* ================= Stage (canvas) ================= */
const stage = $('#stage'), overlay = $('#overlay'), wrap = $('#stagewrap'), sizer = $('#sizer');
let scale = 1;
function fit() {
  if (!doc) return;
  const pad = 28, r = wrap.getBoundingClientRect();
  if (!r.width) return;
  const base = Math.max(0.05, Math.min((r.width - pad * 2) / W, (r.height - pad * 2) / H));
  scale = base * settings.zoom / 100;
  const sw = W * scale, sh = H * scale, bw = Math.max(wrap.clientWidth, sw + pad * 2), bh = Math.max(wrap.clientHeight, sh + pad * 2);
  sizer.style.width = bw + 'px'; sizer.style.height = bh + 'px';
  for (const n of [stage, overlay]) { n.style.transform = `scale(${scale})`; n.style.left = (bw - sw) / 2 + 'px'; n.style.top = (bh - sh) / 2 + 'px'; }
  $('#zVal').textContent = settings.zoom + '%';
}
new ResizeObserver(() => fit()).observe(wrap);
function renderStage() { if (!doc) return; stage.replaceChildren(slideNode(slide(), design())); renderOverlay(); }
const nodeOf = id => stage.querySelector(`.el[data-id="${id}"]`);
function boxOf(e) { const n = AUTO_H.has(e.type) && nodeOf(e.id); return {x: e.x, y: e.y, w: e.w, h: AUTO_H.has(e.type) ? (n ? n.offsetHeight : e.size * 1.2) : e.h}; }

const HANDLES = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
function cursorFor(hx, hy, rot = 0) {
  const a = (((Math.atan2(hy, hx) * 180 / Math.PI + rot) % 180) + 180) % 180;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][Math.round(a / 45) % 4];
}
function renderOverlay() {
  overlay.replaceChildren();
  for (const e of selEls()) {
    const b = boxOf(e), box = el('div', {className: 'sel'});
    box.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;transform:rotate(${e.rot || 0}deg)`;
    if (sel.length === 1 && !editing) {
      for (const [hx, hy] of HANDLES) {
        if (AUTO_H.has(e.type) && hy !== 0 && hx === 0) continue;   // text and table height is automatic
        const h = el('div', {className: 'handle' + (hx === 0 ? ' edge-v' : hy === 0 ? ' edge-h' : '')});
        h.style.cssText = `left:${(hx + 1) * 50}%;top:${(hy + 1) * 50}%;cursor:${cursorFor(hx, hy, e.rot)}`;
        h.dataset.hx = hx; h.dataset.hy = hy; box.append(h);
      }
      const r = el('div', {className: 'handle rot'}); r.style.cssText = 'left:50%;top:-48px'; r.dataset.rot = 1; box.append(r);
    }
    overlay.append(box);
  }
  $('#stSel').textContent = sel.length ? t('st.sel', {n: sel.length}) : '';
  renderOptbar();
}

/* Pointer: select, move (with snap guides), resize, rotate; double-click edits text or a table cell. */
let drag = null, editing = null, guides = [], lastDownEl = null, lastDownCell = null;
const toLogical = ev => { const r = stage.getBoundingClientRect(); return {x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale}; };
wrap.addEventListener('pointerdown', ev => {
  if (ev.button !== 0 || !doc) return;
  if (editing && editing.node.contains(ev.target)) return;
  if (editing) finishEdit();
  const p = toLogical(ev), handle = ev.target.closest('.handle');
  if (handle && sel.length === 1) {
    const e = byId(sel[0]), b = boxOf(e);
    drag = handle.dataset.rot ? {kind: 'rot', e, cx: b.x + b.w / 2, cy: b.y + b.h / 2}
      : {kind: 'resize', e, hx: +handle.dataset.hx, hy: +handle.dataset.hy, start: {...b}, size: e.size, p, rot: (e.rot || 0) * Math.PI / 180};
    wrap.setPointerCapture(ev.pointerId); ev.preventDefault(); return;
  }
  const target = ev.target.closest('.el');
  lastDownEl = target && stage.contains(target) ? target.dataset.id : null;
  const cell = ev.target.closest('td,th');
  lastDownCell = cell && lastDownEl ? [+cell.dataset.r, +cell.dataset.c] : null;
  if (lastDownEl) {
    const id = lastDownEl;
    if (ev.shiftKey) sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
    else if (!sel.includes(id)) sel = [id];
    renderOverlay();
    drag = {kind: 'move', p, orig: selEls().map(e => ({e, x: e.x, y: e.y})), moved: false};
    wrap.setPointerCapture(ev.pointerId);
  } else if (sel.length) { sel = []; renderOverlay(); }
});
wrap.addEventListener('pointermove', ev => {
  if (!drag) return;
  const p = toLogical(ev);
  if (drag.kind === 'move') {
    let dx = p.x - drag.p.x, dy = p.y - drag.p.y;
    if (!drag.moved && Math.hypot(dx, dy) * scale < 3) return;
    drag.moved = true;
    if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    guides = [];
    if (settings.snap && drag.orig.length) {
      // The group's box snaps to the slide's edges and center and to the other elements.
      const bs = drag.orig.map(o => { const b = boxOf(o.e); return {x: o.x + dx, y: o.y + dy, w: b.w, h: b.h}; });
      const gx0 = Math.min(...bs.map(b => b.x)), gy0 = Math.min(...bs.map(b => b.y));
      const gx1 = Math.max(...bs.map(b => b.x + b.w)), gy1 = Math.max(...bs.map(b => b.y + b.h));
      const tx = [0, W / 2, W], ty = [0, H / 2, H];
      for (const o of slide().els) if (!sel.includes(o.id)) { const b = boxOf(o); tx.push(b.x, b.x + b.w / 2, b.x + b.w); ty.push(b.y, b.y + b.h / 2, b.y + b.h); }
      const th = 8 / scale, near = (vals, targets) => { let best = null; for (const v of vals) for (const g of targets) { const d = g - v; if (Math.abs(d) < th && (!best || Math.abs(d) < Math.abs(best.d))) best = {d, g}; } return best; };
      const sx = near([gx0, (gx0 + gx1) / 2, gx1], tx), sy = near([gy0, (gy0 + gy1) / 2, gy1], ty);
      if (sx) { dx += sx.d; guides.push({v: sx.g}); }
      if (sy) { dy += sy.d; guides.push({h: sy.g}); }
    }
    for (const o of drag.orig) { o.e.x = Math.round(o.x + dx); o.e.y = Math.round(o.y + dy); const n = nodeOf(o.e.id); if (n) { n.style.left = o.e.x + 'px'; n.style.top = o.e.y + 'px'; } }
    renderOverlay(); drawGuides();
  } else if (drag.kind === 'rot') {
    let a = Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180 / Math.PI + 90;
    if (!ev.altKey) { const r = Math.round(a / 15) * 15; if (Math.abs(a - r) < 4) a = r; }
    drag.e.rot = Math.round((((a % 360) + 360) % 360) * 10) / 10;
    const n = nodeOf(drag.e.id); if (n) n.style.transform = `rotate(${drag.e.rot}deg)`;
    renderOverlay();
  } else if (drag.kind === 'resize') {
    const {e, hx, hy, start, rot} = drag, dx = p.x - drag.p.x, dy = p.y - drag.p.y;
    const lx = dx * Math.cos(rot) + dy * Math.sin(rot), ly = -dx * Math.sin(rot) + dy * Math.cos(rot);
    let w = start.w, h = start.h;
    if (hx) w = Math.max(30, start.w + hx * lx);
    if (hy && !AUTO_H.has(e.type)) h = Math.max(30, start.h + hy * ly);
    if (hx && hy && (AUTO_H.has(e.type) || e.type === 'image' || ev.shiftKey)) {      // corners keep the proportions
      const k = Math.max(w / start.w, h / start.h); w = Math.max(30, start.w * k); h = Math.max(30, start.h * k);
    }
    if (AUTO_H.has(e.type) && hx && hy) e.size = Math.max(8, Math.round(drag.size * w / start.w));
    const sx = hx * (w - start.w) / 2, sy = hy * (h - start.h) / 2;
    const cx = start.x + start.w / 2 + sx * Math.cos(rot) - sy * Math.sin(rot);
    const cy = start.y + start.h / 2 + sx * Math.sin(rot) + sy * Math.cos(rot);
    e.w = Math.round(w); if (!AUTO_H.has(e.type)) e.h = Math.round(h);
    e.x = Math.round(cx - e.w / 2); e.y = Math.round(cy - (AUTO_H.has(e.type) ? start.h : e.h) / 2);
    const n = nodeOf(e.id); if (n) n.replaceWith(elNode(e, design()));
    renderOverlay();
  }
});
const endDrag = () => { if (!drag) return; const moved = drag.kind !== 'move' || drag.moved; drag = null; guides = []; drawGuides(); if (moved) { commit(); renderThumbs(); } };
wrap.addEventListener('pointerup', endDrag);
wrap.addEventListener('pointercancel', endDrag);
function drawGuides() {
  overlay.querySelectorAll('.guide').forEach(g => g.remove());
  for (const g of guides) {
    const d = el('div', {className: 'guide ' + (g.v !== undefined ? 'v' : 'h')});
    if (g.v !== undefined) d.style.left = g.v - 1 + 'px'; else d.style.top = g.h - 1 + 'px';
    overlay.append(d);
  }
}
// With pointer capture the click target is the canvas, so the element comes from the last pointerdown.
wrap.addEventListener('dblclick', () => {
  const e = lastDownEl && byId(lastDownEl);
  if (e && e.type === 'text') startEdit(e);
  else if (e && e.type === 'table' && lastDownCell) startEdit(e, lastDownCell);
});
wrap.addEventListener('wheel', e => { if (e.ctrlKey && doc) { e.preventDefault(); setZoom(settings.zoom + (e.deltaY < 0 ? 10 : -10)); } }, {passive: false});

function startEdit(e, cell) {
  if (!e) return;
  finishEdit();
  sel = [e.id];
  const host = nodeOf(e.id); if (!host) return;
  const node = cell ? host.querySelector(`[data-r="${cell[0]}"][data-c="${cell[1]}"]`) : host;
  if (!node) return;
  node.classList.add('editing'); node.contentEditable = 'plaintext-only';
  if (node.contentEditable !== 'plaintext-only') node.contentEditable = 'true';
  if (e.ph) node.textContent = '';
  editing = {e, node, cell}; renderOverlay();
  node.focus();
  const r = document.createRange(); r.selectNodeContents(node); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  node.addEventListener('input', () => { const box = overlay.querySelector('.sel'); if (box) box.style.height = host.offsetHeight + 'px'; });
  node.addEventListener('keydown', k => {
    if (k.key === 'Escape') { k.preventDefault(); finishEdit(); }
    else if (k.key === 'Tab' && cell) {                       // Tab / Shift+Tab walk through the cells
      k.preventDefault();
      const cols = e.cells[0].length, n = e.cells.length * cols, i = (cell[0] * cols + cell[1] + (k.shiftKey ? -1 : 1) + n) % n;
      finishEdit(); startEdit(e, [Math.floor(i / cols), i % cols]);
    }
  });
}
function finishEdit() {
  if (!editing) return;
  const {e, node, cell} = editing; editing = null;
  const txt = node.innerText.replace(/\n$/, '');
  node.contentEditable = 'false'; node.classList.remove('editing');
  getSelection().removeAllRanges();
  if (cell) e.cells[cell[0]][cell[1]] = txt;
  else if (txt.trim() === '' && e.ph) { /* an untouched placeholder keeps its hint */ }
  else { e.text = txt; e.ph = false; if (e.text.trim() === '') { slide().els = slide().els.filter(x => x !== e); sel = []; } }
  commit(); renderAll();
}

/* ================= Editing actions ================= */
function addEl(e) { if (editing) finishEdit(); slide().els.push(e); sel = [e.id]; commit(); renderAll(); return e; }
function addText(kind) {
  const p = kind === 'title' ? {size: 110, bold: true, font: 't:head', w: 1500, x: 210, y: 360, text: t('ph.title')}
    : kind === 'heading' ? {size: 72, bold: true, font: 't:head', w: 1200, x: 360, y: 400, text: t('ph.heading')}
    : {size: 44, w: 1000, x: 460, y: 440, text: t('ph.text')};
  const e = addEl(textEl(p)); setTimeout(() => startEdit(e), 30);
}
function addShape(kind) {
  addEl(shapeEl(kind, kind === 'line' ? {w: 600, h: 24, fill: 't:text', sw: 10, x: 660, y: 528} : {x: 810, y: 390, w: 300, h: 300}));
}
function addTable(rows = 4, cols = 3) {
  const e = tableEl(rows, cols);
  e.cells[0] = e.cells[0].map((_, i) => `${t('tbl.col')} ${i + 1}`);
  addEl(e);
}
function tableOp(op) {
  const e = selEls()[0]; if (!e || e.type !== 'table') return;
  const rows = e.cells.length, cols = e.cells[0].length;
  if (op === 'addRow') e.cells.push(Array(cols).fill(''));
  if (op === 'delRow' && rows > 1) e.cells.pop();
  if (op === 'addCol') { e.cells.forEach(r => r.push('')); e.w = Math.min(W - e.x, Math.round(e.w * (cols + 1) / cols)); }
  if (op === 'delCol' && cols > 1) { e.cells.forEach(r => r.pop()); e.w = Math.round(e.w * (cols - 1) / cols); }
  commit(); renderAll();
}
function del() { if (!sel.length) return; slide().els = slide().els.filter(e => !sel.includes(e.id)); sel = []; commit(); renderAll(); }
function dup() {
  const copies = selEls().map(e => Object.assign(JSON.parse(JSON.stringify(e)), {id: uid(), x: e.x + 40, y: e.y + 40}));
  if (!copies.length) return;
  slide().els.push(...copies); sel = copies.map(c => c.id); commit(); renderAll();
}
let clip = null;
function copy() { if (!sel.length) return; clip = JSON.stringify(selEls()); Promise.resolve(Native.clipboardWrite('slides-studio:' + clip)).catch(() => {}); }
async function paste() {
  try { const tx = await Native.clipboardRead(); if (tx && tx.startsWith('slides-studio:')) clip = tx.slice(14); } catch (e) {}
  if (!clip) return;
  const items = JSON.parse(clip).map(e => Object.assign(e, {id: uid(), x: e.x + 40, y: e.y + 40}));
  slide().els.push(...items); sel = items.map(i => i.id); clip = JSON.stringify(items); commit(); renderAll();
}
function order(how) {
  if (!sel.length) return;
  const els = slide().els, picked = els.filter(e => sel.includes(e.id)), rest = els.filter(e => !sel.includes(e.id));
  if (how === 'front') slide().els = [...rest, ...picked];
  else if (how === 'back') slide().els = [...picked, ...rest];
  else { const idx = els.indexOf(picked[0]), a = rest.slice(); a.splice(clamp(idx + (how === 'forward' ? 1 : -1), 0, a.length), 0, ...picked); slide().els = a; }
  commit(); renderAll();
}
function nudge(dx, dy) { for (const e of selEls()) { e.x += dx; e.y += dy; } commit(); renderStage(); renderThumbs(); }
function alignTo(how) {
  for (const e of selEls()) {
    const b = boxOf(e);
    if (how === 'left') e.x = 60; if (how === 'center') e.x = Math.round(W / 2 - b.w / 2); if (how === 'right') e.x = W - b.w - 60;
    if (how === 'top') e.y = 60; if (how === 'middle') e.y = Math.round(H / 2 - b.h / 2); if (how === 'bottom') e.y = H - b.h - 60;
  }
  commit(); renderAll();
}
function setProp(key, val) {
  const els = selEls(); if (!els.length) return;
  for (const e of els) e[key] = val;
  commit(); renderStage(); renderThumbs();
}
function toggleText(key) { const e = selEls().find(x => x.type === 'text'); if (e) setProp(key, !e[key]); }
/* Slides */
function go(i) { if (!doc) return; if (editing) finishEdit(); cur = clamp(i, 0, doc.slides.length - 1); sel = []; renderAll(); saveSession(); }
function addSlide(kind = 'content', at = cur + 1) {
  if (editing) finishEdit();
  const s = newSlide(layout(kind)); s.bg = slide().bg; s.trans = slide().trans;
  doc.slides.splice(at, 0, s); cur = at; sel = []; commit(); renderAll();
}
function dupSlide() { const s = JSON.parse(JSON.stringify(slide())); s.id = uid(); s.els.forEach(e => e.id = uid()); doc.slides.splice(cur + 1, 0, s); cur++; sel = []; commit(); renderAll(); }
function delSlide() {
  if (doc.slides.length === 1) doc.slides[0] = newSlide(); else { doc.slides.splice(cur, 1); cur = clamp(cur, 0, doc.slides.length - 1); }
  sel = []; commit(); renderAll();
}
function moveSlide(from, to) {
  to = clamp(to, 0, doc.slides.length - 1); if (from === to) return;
  const [s] = doc.slides.splice(from, 1); doc.slides.splice(to, 0, s); cur = to; commit(); renderAll();
}
function setDesign(id) { doc.theme = id; commit(); renderAll(); }

/* ================= Pictures ================= */
function readImage(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('read'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error('decode'));
      img.onload = () => {
        // Big photos are scaled down so presentation files stay small.
        const k = Math.min(1, 2400 / Math.max(img.width, img.height));
        if (k === 1 && file.size < 1.5e6) return res({src: fr.result, w: img.width, h: img.height});
        const c = el('canvas', {width: Math.round(img.width * k), height: Math.round(img.height * k)});
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res({src: c.toDataURL(/png|gif|svg|webp/.test(file.type) ? 'image/png' : 'image/jpeg', 0.88), w: c.width, h: c.height});
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function addImages(files) {
  for (const f of files) {
    if (!/^image\//.test(f.type)) continue;
    try { const r = await readImage(f); addEl(imageEl(r.src, r.w, r.h)); } catch (e) { toast(t('toast.imgFail')); }
  }
}
function pickImage(cb) {
  const inp = $('#fileImg'); inp.value = '';
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { cb(await readImage(f)); } catch (e) { toast(t('toast.imgFail')); } };
  inp.click();
}
document.addEventListener('paste', ev => {
  if (editing || IS_PRESENTER || !doc || Native.isField(ev.target)) return;
  const files = [...(ev.clipboardData ? ev.clipboardData.files : [])];
  if (files.length) { ev.preventDefault(); addImages(files); }
});
document.addEventListener('dragover', ev => { if (ev.dataTransfer && [...ev.dataTransfer.types].includes('Files')) ev.preventDefault(); });
document.addEventListener('drop', ev => {
  if (IS_PRESENTER || !ev.dataTransfer || !ev.dataTransfer.files.length) return;
  ev.preventDefault();
  const files = [...ev.dataTransfer.files], decks = files.filter(f => /\.(slides|json)$/i.test(f.name));
  if (decks.length) decks.forEach(async f => openNative([{name: f.name, content: await f.text(), path: null}]));
  else if (doc) addImages(files);
});

/* ================= Files ================= */
let toastT;
function toast(msg) { const n = $('#toast'); n.textContent = msg; n.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => n.classList.remove('show'), 2400); }
function download(blob, name) {
  const a = el('a', {href: URL.createObjectURL(blob), download: name}); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
async function openFile() {
  if (invoke) { try { openNative(await invoke('open_files')); } catch (e) { toast(t('toast.openFail', {e})); } return; }
  const inp = $('#fileIn'); inp.value = '';
  inp.onchange = async () => { for (const f of inp.files) openNative([{name: f.name, content: await f.text(), path: null}]); };
  inp.click();
}
async function save(as) {
  if (editing) finishEdit();
  const d = D(), content = JSON.stringify(doc);
  try {
    if (invoke) {
      const r = await invoke('save_file', {path: as ? null : d.path, suggestedName: d.name, content});
      if (!r) return false;
      d.path = r.path; d.name = r.name; addRecent(r.path, r.name);
    } else download(new Blob([content], {type: 'application/json'}), d.name);
    markDirty(false); renderTabs(); toast(t('toast.saved', {name: d.name})); return true;
  } catch (e) { toast(t('toast.saveFail', {e})); return false; }
}
const baseName = () => D().name.replace(/\.(slides|json)$/i, '');
async function saveBytes(name, filterName, ext, bytes, mime) {
  try {
    if (invoke) { const p = await invoke('save_bytes', {suggestedName: name, filterName, extensions: [ext], bytes: Array.from(bytes)}); if (p) toast(t('toast.exported', {path: p})); }
    else download(new Blob([bytes], {type: mime}), name);
  } catch (e) { toast(t('toast.saveFail', {e})); }
}
/* Standalone HTML slideshow: the slides as static HTML plus a tiny navigation script. */
function slideshowHtml() {
  const th = design(), slides = doc.slides.map(s => { const r = slideNode(s, th, true); r.className = 'slide'; r.removeAttribute('style'); return r.outerHTML; });
  const trans = JSON.stringify(doc.slides.map(s => s.trans || 'none'));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(baseName())}</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:${SANS}}
#s{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
.slide{position:absolute;inset:0;display:none;overflow:hidden}.slide.on{display:block}.el{position:absolute}.slide-bg{position:absolute;inset:0}
.el.text{white-space:pre-wrap;overflow-wrap:break-word;line-height:1.2}.el svg{width:100%;height:100%;display:block;overflow:visible}
.el.image{background-repeat:no-repeat;background-position:center}
.tbl{border-collapse:collapse;width:100%;table-layout:fixed}.tbl td,.tbl th{border:1px solid rgba(127,127,127,.45);padding:.35em .55em;text-align:left;white-space:pre-wrap;line-height:1.25;font-weight:400}.tbl th{font-weight:700}
@keyframes fade{from{opacity:0}to{opacity:1}}@keyframes slide{from{transform:translateX(120px);opacity:0}to{transform:none;opacity:1}}
@keyframes zoom{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}
#n{position:fixed;right:12px;bottom:8px;color:#fff;opacity:.5;font-size:13px}</style></head>
<body><div id="s">${slides.join('')}</div><div id="n"></div>
<script>(function(){var T=${trans},S=document.querySelectorAll('.slide'),i=0,s=document.getElementById('s'),n=document.getElementById('n');
function fit(){var k=Math.min(innerWidth/${W},innerHeight/${H});s.style.transform='scale('+k+')';s.style.left=(innerWidth-${W}*k)/2+'px';s.style.top=(innerHeight-${H}*k)/2+'px'}
function show(j){i=Math.max(0,Math.min(S.length-1,j));S.forEach(function(x,k){x.classList.toggle('on',k===i);x.style.animation=''});var a=T[i];if(a&&a!=='none'){S[i].style.animation=a+' .45s ease'}n.textContent=(i+1)+' / '+S.length;location.hash=i+1}
addEventListener('resize',fit);addEventListener('keydown',function(e){if(/ArrowRight|ArrowDown|PageDown| |Enter/.test(e.key))show(i+1);else if(/ArrowLeft|ArrowUp|PageUp|Backspace/.test(e.key))show(i-1);else if(e.key==='Home')show(0);else if(e.key==='End')show(S.length-1);else if(e.key==='f')document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()});
addEventListener('click',function(e){show(e.clientX<innerWidth/4?i-1:i+1)});fit();show((parseInt(location.hash.slice(1))||1)-1)})();<\/script></body></html>`;
}
async function exportHtml() { if (editing) finishEdit(); await saveBytes(baseName() + '.html', 'HTML', 'html', new TextEncoder().encode(slideshowHtml()), 'text/html'); }
function exportPdf() {
  if (editing) finishEdit();
  const root = $('#printroot'), th = design(); root.replaceChildren();
  for (const s of doc.slides) { const p = el('div', {className: 'pslide'}); p.append(slideNode(s, th, true)); root.append(p); }
  toast(t('toast.printHint'));
  setTimeout(() => (invoke ? invoke('print_page').catch(e => toast(String(e))) : window.print()), 400);
}
/* Heights of auto-height elements, measured off-screen exactly as drawn (for the PowerPoint export). */
function measureHeights() {
  const box = el('div'); box.style.cssText = `position:fixed;left:-99999px;top:0;width:${W}px;height:${H}px;visibility:hidden`;
  document.body.append(box);
  const out = {}, th = design();
  for (const s of doc.slides) {
    box.replaceChildren(slideNode(s, th));
    for (const e of s.els) if (AUTO_H.has(e.type)) { const n = box.querySelector(`.el[data-id="${e.id}"]`); if (n) out[e.id] = n.offsetHeight; }
  }
  box.remove();
  return out;
}
/* Pictures as PNG/JPEG bytes (PowerPoint can't read WebP etc., so those are redrawn as PNG). */
async function imageBytes() {
  const out = {};
  for (const s of doc.slides) for (const e of s.els) if (e.type === 'image' && e.src && !out[e.id]) {
    const m = /^data:image\/(png|jpe?g);base64,(.*)$/i.exec(e.src);
    let bytes, ext, w = e.iw, h = e.ih;
    if (m) { ext = /png/i.test(m[1]) ? 'png' : 'jpeg'; bytes = Uint8Array.from(atob(m[2]), ch => ch.charCodeAt(0)); }
    if (!bytes || !w || !h) {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = e.src; }).catch(() => null);
      if (!img) continue;
      w = img.naturalWidth; h = img.naturalHeight;
      if (!bytes) {
        const c = el('canvas', {width: w, height: h}); c.getContext('2d').drawImage(img, 0, 0);
        bytes = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer()); ext = 'png';
      }
    }
    out[e.id] = {ext, bytes, w, h};
  }
  return out;
}
async function buildPptx() { if (editing) finishEdit(); return PptxExport.build({doc, theme: design(), color, heights: measureHeights(), images: await imageBytes()}); }
async function exportPptx() {
  try { await saveBytes(baseName() + '.pptx', 'PowerPoint', 'pptx', await buildPptx(), 'application/vnd.openxmlformats-officedocument.presentationml.presentation'); }
  catch (e) { toast(t('toast.saveFail', {e})); }
}

/* ================= Present mode ================= */
const pres = $('#present'), pslide = $('#pslide');
let pi = 0, presenting = false;
function presFit() {
  const k = Math.min(innerWidth / W, innerHeight / H);
  pslide.style.setProperty('--s', k); pslide.style.setProperty('--w', (innerWidth * 0.12) + 'px');
  pslide.style.transform = `scale(${k})`; pslide.style.left = (innerWidth - W * k) / 2 + 'px'; pslide.style.top = (innerHeight - H * k) / 2 + 'px';
}
function presShow(i, animate = true) {
  pi = clamp(i, 0, doc.slides.length - 1);
  const s = doc.slides[pi];
  pslide.replaceChildren(slideNode(s, design(), true));
  pslide.style.animation = 'none'; void pslide.offsetWidth;
  if (animate && s.trans && s.trans !== 'none') pslide.style.animation = `t-${s.trans} .45s ease`;
  $('#pbar').style.width = ((pi + 1) / doc.slides.length * 100) + '%';
  $('#pnum').textContent = `${pi + 1} / ${doc.slides.length}`;
  pres.classList.remove('blank');
  presState();
}
function present(from = 0) {
  if (!doc) return;
  if (editing) finishEdit();
  closeMenus();
  presenting = true; pres.classList.add('on'); presFit(); presShow(from, false);
  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
}
function endPresent() {
  if (!presenting) return;
  presenting = false; pres.classList.remove('on'); presState();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  go(pi);
}
const pNext = () => { if (pi < doc.slides.length - 1) presShow(pi + 1); else endPresent(); };
const pPrev = () => presShow(pi - 1);
const toggleBlank = () => { pres.classList.toggle('blank'); presState(); };
$('#pNext').onclick = e => { e.stopPropagation(); pNext(); };
$('#pPrev').onclick = e => { e.stopPropagation(); pPrev(); };
$('#pBlank').onclick = e => { e.stopPropagation(); toggleBlank(); };
$('#pPresenter').onclick = e => { e.stopPropagation(); openPresenter(); };
$('#pExit').onclick = e => { e.stopPropagation(); endPresent(); };
pres.addEventListener('click', ev => { if (ev.target.closest('.pctl')) return; (ev.clientX < innerWidth / 5) ? pPrev() : pNext(); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && presenting) { presenting = false; pres.classList.remove('on'); presState(); go(pi); } });
window.addEventListener('resize', () => { if (presenting) presFit(); });

/* Presenter view: a second window (index.html#presenter) with the current and next slide, notes and a timer.
   Both windows talk over a BroadcastChannel: the presenter asks for the deck ("hello"), the main window sends it and
   every slide change, and the presenter sends navigation commands back. */
const chan = 'BroadcastChannel' in window ? new BroadcastChannel('slides-studio-presenter') : null;
function presState() { if (chan && !IS_PRESENTER) chan.postMessage({type: 'state', i: pi, presenting, blank: pres.classList.contains('blank'), theme: settings.theme}); }
if (chan && !IS_PRESENTER) chan.onmessage = ({data: m}) => {
  if (m.type === 'hello') { if (doc) chan.postMessage({type: 'doc', doc}); presState(); }
  else if (m.type === 'cmd' && presenting) {
    if (m.a === 'next') pNext(); else if (m.a === 'prev') pPrev(); else if (m.a === 'blank') toggleBlank(); else if (m.a === 'exit') endPresent();
  }
};
async function openPresenter() {
  const T = window.__TAURI__;
  if (T && T.webviewWindow) {
    try {
      const WW = T.webviewWindow.WebviewWindow, old = await WW.getByLabel('presenter');
      if (old) { await old.setFocus(); return; }
      new WW('presenter', {url: 'index.html#presenter', title: t('a.presenter') + ' — Slides Studio', width: 1200, height: 760});
    } catch (e) { toast(String(e)); }
  } else window.open('index.html#presenter', 'slides-presenter', 'width=1200,height=760');
}
function runPresenter() {
  document.body.className = 'presenter';
  document.body.replaceChildren();
  const timer = el('span', {className: 'pv-timer', textContent: '00:00'}), count = el('span', {className: 'pv-count'});
  const curBox = el('div', {className: 'pv-cur'}), nextBox = el('div', {className: 'pv-next'}), notes = el('div', {className: 'pv-notes'});
  const send = a => chan.postMessage({type: 'cmd', a});
  const b = (html, title, fn) => { const x = el('button', {className: 'ibtn', innerHTML: html, title}); x.onclick = fn; return x; };
  let deck = null, state = null, start = 0;
  document.body.append(
    el('div', {className: 'pv-head'}, timer, b('&#8634;', t('p.reset'), () => { start = state ? Date.now() : 0; }), el('span', {className: 'flex'}), count, el('span', {className: 'flex'}),
      b('&#8592;', '', () => send('prev')), b('&#8594;', '', () => send('next')), b('B', t('p.blank'), () => send('blank')), b('&#10005;', '', () => send('exit'))),
    el('div', {className: 'pv-body'},
      el('div', {className: 'pv-left'}, el('div', {className: 'sect', textContent: t('p.current')}), curBox),
      el('div', {className: 'pv-right'}, el('div', {className: 'sect', textContent: t('p.next')}), nextBox, el('div', {className: 'sect', textContent: t('p.notes')}), notes)));
  const put = (box, s) => {
    box.replaceChildren();
    if (!s) { box.append(el('div', {className: 'pv-empty', textContent: t('p.end')})); return; }
    const inner = slideNode(s, designOf(deck), true);
    inner.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;overflow:hidden;transform:scale(${box.clientWidth / W})`;
    box.append(inner);
  };
  const draw = () => {
    if (!deck || !state) { curBox.replaceChildren(el('div', {className: 'pv-empty', textContent: t('p.waiting')})); nextBox.replaceChildren(); notes.textContent = ''; count.textContent = ''; return; }
    put(curBox, deck.slides[state.i]); put(nextBox, deck.slides[state.i + 1]);
    curBox.classList.toggle('blank', !!state.blank);
    const n = deck.slides[state.i].notes;
    notes.textContent = n || t('p.noNotes'); notes.classList.toggle('muted', !n);
    count.textContent = `${state.i + 1} / ${deck.slides.length}`;
  };
  chan.onmessage = ({data: m}) => {
    if (m.type === 'doc') { deck = m.doc; draw(); }
    else if (m.type === 'state') {
      if (m.theme) document.documentElement.dataset.theme = m.theme;
      if (m.presenting && !start) start = Date.now();
      state = m.presenting ? m : null; draw();
    }
  };
  setInterval(() => { if (!start) return; const s = Math.floor((Date.now() - start) / 1000); timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 500);
  addEventListener('resize', draw);
  addEventListener('keydown', ev => {
    if (/^(ArrowRight|ArrowDown|PageDown| |Enter)$/.test(ev.key)) { ev.preventDefault(); send('next'); }
    else if (/^(ArrowLeft|ArrowUp|PageUp|Backspace)$/.test(ev.key)) { ev.preventDefault(); send('prev'); }
    else if (ev.key.toLowerCase() === 'b') send('blank'); else if (ev.key === 'Escape') send('exit');
  });
  document.title = t('a.presenter') + ' — Slides Studio';
  draw(); chan.postMessage({type: 'hello'});
}

/* ================= Actions, menus, shortcuts ================= */
function setZoom(z) { settings.zoom = clamp(Math.round(z / 10) * 10, 30, 300); fit(); saveSession(); }
const A = {
  newDoc: () => openDoc(null, newDeck()),
  openFile, save: () => save(false), saveAs: () => save(true), exportPdf, exportPptx, exportHtml,
  closeTab: () => closeTab(active),
  undo, redo, cut: () => { copy(); del(); }, copy, paste, duplicate: dup, delete: del,
  selectAll: () => { if (editing) return; sel = slide().els.map(e => e.id); renderOverlay(); },
  front: () => order('front'), forward: () => order('forward'), backward: () => order('backward'), back: () => order('back'),
  title: () => addText('title'), heading: () => addText('heading'), body: () => addText('body'),
  bold: () => toggleText('bold'), italic: () => toggleText('italic'), underline: () => toggleText('underline'),
  rect: () => addShape('rect'), round: () => addShape('round'), ellipse: () => addShape('ellipse'), triangle: () => addShape('triangle'),
  diamond: () => addShape('diamond'), star: () => addShape('star'), arrow: () => addShape('arrow'), line: () => addShape('line'),
  image: () => pickImage(r => addEl(imageEl(r.src, r.w, r.h))), table: () => addTable(),
  newSlide: () => addSlide('content'), dupSlide, delSlide, slideUp: () => moveSlide(cur, cur - 1), slideDown: () => moveSlide(cur, cur + 1),
  present: () => present(0), presentCurrent: () => present(cur), presenter: () => { openPresenter(); present(cur); },
  togglePanels: () => { settings.dock = !settings.dock; applySettings(); },
  toggleAutoHide: () => { settings.autoHide = !settings.autoHide; applySettings(); },
  toggleSnap: () => { settings.snap = !settings.snap; applySettings(); },
  zoomIn: () => setZoom(settings.zoom + 10), zoomOut: () => setZoom(settings.zoom - 10), zoomReset: () => setZoom(100),
  settings: () => openSettings(),
  langAuto: () => setLang('auto'), langEn: () => setLang('en'), langDe: () => setLang('de'),
  themeDark: () => setTheme('dark'), themeLight: () => setTheme('light'), themeGithub: () => setTheme('github'), themeGithubDark: () => setTheme('github-dark'),
  shortcuts: () => {
    let h = '';
    MENUS.forEach(([m, items]) => {
      const rows = items.filter(it => Array.isArray(it) && it[1]);
      if (rows.length) h += `<h4>${esc(t('menu.' + m))}</h4><table>` + rows.map(it => `<tr><td>${esc(t('a.' + it[0]))}</td><td><kbd>${esc(keyLabel(it[1]))}</kbd></td></tr>`).join('') + '</table>';
    });
    const k = (...keys) => keys.map(x => `<kbd>${esc(fmtKey(x))}</kbd>`).join(' / ');
    h += `<h4>${esc(t('ed.editor'))}</h4><table>
      <tr><td>${esc(t('ed.nudge'))}</td><td>${k('← ↑ → ↓')}</td></tr><tr><td>${esc(t('ed.nudgeBig'))}</td><td>${k('Shift+← ↑ → ↓')}</td></tr>
      <tr><td>${esc(t('ed.editText'))}</td><td>${k('Enter')}</td></tr><tr><td>${esc(t('ed.cell'))}</td><td>${k('Tab', 'Shift+Tab')}</td></tr>
      <tr><td>${esc(t('ed.deselect'))}</td><td>${k('Esc')}</td></tr><tr><td>${esc(t('ed.slides'))}</td><td>${k('PageUp', 'PageDown')}</td></tr>
      <tr><td>${esc(t('ed.zoom'))}</td><td><kbd>${esc(fmtKey('Ctrl'))}</kbd> + ${esc(t('ed.wheel'))}</td></tr></table>
      <h4>${esc(t('ed.present'))}</h4><table><tr><td>${esc(t('ed.presNav'))}</td><td>${k('→', '←')}</td></tr>
      <tr><td>${esc(t('ed.presBlank'))}</td><td>${k('B')}</td></tr><tr><td>${esc(t('ed.presP'))}</td><td>${k('P')}</td></tr></table>`;
    modal(t('a.shortcuts'), h);
  },
  about: async () => {
    const v = invoke ? await window.__TAURI__.app.getVersion().catch(() => '') : '';
    modal(t('a.about'), `${v ? `<p><b>${esc(t('about.version', {v}))}</b></p>` : ''}<p>${esc(t('about.p1'))}</p><p>${esc(t('about.p2'))}</p>`);
  }
};
// Menu items: [action, shortcut, checked(), fixed, extraKeys]; '-' is a separator, '#key' a section label (as in every Studio app).
const MENUS = [
  ['file', [['newDoc', 'Alt+N'], ['openFile', 'Ctrl+O'], '-', ['save', 'Ctrl+S'], ['saveAs', 'Ctrl+Shift+S'], '-',
    ['exportPptx', 'Ctrl+E'], ['exportPdf', 'Ctrl+P'], ['exportHtml'], '-', ['closeTab', 'Alt+W']]],
  ['edit', [['undo', 'Ctrl+Z', null, false, ['Ctrl+Shift+Z']], ['redo', 'Ctrl+Y'], '-', ['cut', 'Ctrl+X'], ['copy', 'Ctrl+C'], ['paste', 'Ctrl+V'],
    ['duplicate', 'Ctrl+D'], ['delete', 'Delete', null, true], ['selectAll', 'Ctrl+A'], '-',
    ['front', 'Ctrl+Shift+]'], ['forward', 'Ctrl+]'], ['backward', 'Ctrl+['], ['back', 'Ctrl+Shift+[']]],
  ['insert', [['title', 'Ctrl+Shift+1'], ['heading', 'Ctrl+Shift+2'], ['body', 'Ctrl+Shift+3'], '-',
    ['bold', 'Ctrl+B'], ['italic', 'Ctrl+I'], ['underline', 'Ctrl+U'], '-',
    ...SHAPES.map(s => [s]), '-', ['image', 'Ctrl+Shift+G'], ['table', 'Ctrl+Shift+L']]],
  ['slide', [['newSlide', 'Ctrl+M'], ['dupSlide', 'Ctrl+Shift+D'], ['delSlide'], '-', ['slideUp', 'Ctrl+Shift+ArrowLeft'], ['slideDown', 'Ctrl+Shift+ArrowRight'], '-',
    ['present', 'F5'], ['presentCurrent', 'Shift+F5'], ['presenter', 'Alt+F5']]],
  ['view', [['togglePanels', 'Ctrl+\\', () => settings.dock], ['toggleAutoHide', null, () => settings.autoHide], ['toggleSnap', null, () => settings.snap], '-',
    ['zoomIn'], ['zoomOut'], ['zoomReset', 'Ctrl+0']]],
  ['settings', [['settings', 'Ctrl+,'], '-', '#menu.language',
    ['langAuto', null, () => settings.lang === 'auto'], ['langEn', null, () => settings.lang === 'en'], ['langDe', null, () => settings.lang === 'de'],
    '-', '#menu.theme',
    ['themeDark', null, () => settings.theme === 'dark'], ['themeLight', null, () => settings.theme === 'light'],
    ['themeGithub', null, () => settings.theme === 'github'], ['themeGithubDark', null, () => settings.theme === 'github-dark']]],
  ['help', [['shortcuts', 'F1'], '-', ['about']]]
];
const keyLabel = k => fmtKey(k.replace('ArrowLeft', '←').replace('ArrowRight', '→'));
/* Actions that work with no presentation open (start screen), and those that need a selection. */
const NO_DOC = new Set(['newDoc', 'openFile', 'togglePanels', 'toggleAutoHide', 'toggleSnap', 'settings', 'langAuto', 'langEn', 'langDe',
  'themeDark', 'themeLight', 'themeGithub', 'themeGithubDark', 'shortcuts', 'about']);
const NEEDS_SEL = new Set(['cut', 'copy', 'duplicate', 'delete', 'front', 'forward', 'backward', 'back', 'bold', 'italic', 'underline']);
const allowed = act => NO_DOC.has(act) || (!!doc && (!NEEDS_SEL.has(act) || sel.length > 0) &&
  (act !== 'undo' || hist.i > 0) && (act !== 'redo' || hist.i < hist.stack.length - 1));
function run(act) { if (A[act] && allowed(act)) A[act](); }
function syncDisabled() { $$('[data-act]').forEach(b => b.disabled = !allowed(b.dataset.act)); }

const KEYMAP = {};
/* Built from the menu entries — again whenever a shortcut is changed in Settings (shortcuts.js). */
function buildKeymap() {
  for (const k in KEYMAP) delete KEYMAP[k];
  MENUS.forEach(([, items]) => items.forEach(it => { if (Array.isArray(it) && !it[3]) [it[1], ...(it[4] || [])].forEach(k => { if (k) KEYMAP[k] = it[0]; }); }));
}
let menuOpen = null;
function openMenu(m, items) {
  closeMenus();
  const dd = m.querySelector('.dropdown'); dd.innerHTML = '';
  items.forEach(it => {
    if (it === '-') return dd.append(document.createElement('hr'));
    if (typeof it === 'string') return dd.append(el('div', {className: 'dd-label', textContent: t(it.slice(1))}));
    const [act, key, check] = it, b = document.createElement('button');
    b.innerHTML = `<span class="chk">${check && check() ? '&#10003;' : ''}</span><span>${esc(t('a.' + act))}</span><kbd>${esc(key ? keyLabel(key) : '')}</kbd>`;
    b.disabled = !allowed(act);
    b.onmousedown = e => e.preventDefault();
    b.onclick = () => { closeMenus(); run(act); };
    dd.append(b);
  });
  m.classList.add('open'); menuOpen = m;
}
function closeMenus() { $$('.menu.open').forEach(x => x.classList.remove('open')); menuOpen = null; }
function buildMenubar() {
  const nav = $('#menus'); nav.innerHTML = ''; menuOpen = null;
  MENUS.forEach(([name, items]) => {
    const m = el('div', {className: 'menu'}), b = el('button', {textContent: t('menu.' + name)}), dd = el('div', {className: 'dropdown'});
    b.onmousedown = e => e.preventDefault();
    b.onclick = () => menuOpen === m ? closeMenus() : openMenu(m, items);
    b.onmouseenter = () => { if (menuOpen && menuOpen !== m) openMenu(m, items); };
    m.append(b, dd); nav.append(m);
  });
}
document.addEventListener('mousedown', e => { if (menuOpen && !e.target.closest('.menu')) closeMenus(); });
const keyOf = act => { for (const [, items] of MENUS) for (const it of items) if (Array.isArray(it) && it[0] === act && it[1]) return it[1]; return ''; };
const tip = act => t('a.' + act) + (keyOf(act) ? ` (${keyLabel(keyOf(act))})` : '');

/* ================= Tool bars ================= */
const SV = p => `<svg viewBox="0 0 24 24">${p}</svg>`;
const ICONS = {
  newf: SV('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6M9 15h6"/>'),
  open: SV('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  save: SV('<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8M7 21v-7h10v7"/>'),
  undo: SV('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  redo: SV('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
  image: SV('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
  table: SV('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>'),
  print: SV('<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>'),
  pptx: SV('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 18v-6h2.5a2 2 0 0 1 0 4H9"/>'),
  presenter: SV('<rect x="2" y="4" width="13" height="10" rx="1.5"/><rect x="17" y="4" width="5" height="6" rx="1"/><path d="M17 13h5M17 16h5M8 14v4M5 20h6"/>'),
  panel: SV('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>'),
  help: SV('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>'),
  gear: SV('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  alLeft: SV('<path d="M4 3v18M8 7h10M8 12h6M8 17h12"/>'), alCenter: SV('<path d="M12 3v18M6 7h12M8 12h8M5 17h14"/>'), alRight: SV('<path d="M20 3v18M6 7h10M10 12h6M4 17h12"/>'),
  alTop: SV('<path d="M3 4h18M7 8v10M12 8v6M17 8v12"/>'), alMiddle: SV('<path d="M3 12h18M7 6v12M12 8v8M17 5v14"/>'), alBottom: SV('<path d="M3 20h18M7 6v10M12 10v6M17 4v12"/>'),
  txLeft: SV('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'), txCenter: SV('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'), txRight: SV('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
  front: SV('<rect x="8" y="8" width="12" height="12" rx="1" fill="currentColor" fill-opacity=".25"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>'),
  back: SV('<rect x="4" y="4" width="12" height="12" rx="1" fill="currentColor" fill-opacity=".25"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/>'),
  dup: SV('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
  trash: SV('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
  rect: SV('<rect x="4" y="6" width="16" height="12" rx="1"/>'), round: SV('<rect x="4" y="6" width="16" height="12" rx="4"/>'),
  ellipse: SV('<ellipse cx="12" cy="12" rx="8" ry="6.5"/>'), triangle: SV('<path d="M12 4 21 19H3z"/>'), diamond: SV('<path d="M12 3l9 9-9 9-9-9z"/>'),
  star: SV('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'), arrow: SV('<path d="M3 12h15M13 6l6 6-6 6"/>'), line: SV('<path d="M4 20 20 4"/>')
};
function makeBtn(act, html, title) {
  const b = el('button', {className: 'ibtn', innerHTML: html, title: title || tip(act)});
  b.dataset.act = act; return b;
}
const RAIL = [['title', '<b class="g" style="font-size:17px">T</b>'], ['heading', '<b class="g">H</b>'], ['body', '<span class="g" style="font-size:13px">Aa</span>'], '-',
  ...SHAPES.map(s => [s, ICONS[s]]), '-', ['image', ICONS.image], ['table', ICONS.table]];
function buildToolbars() {
  const fill = (id, list) => { const box = $(id); box.innerHTML = ''; list.forEach(([a, i]) => box.append(makeBtn(a, i))); };
  fill('#fileBtns', [['newDoc', ICONS.newf], ['openFile', ICONS.open], ['save', ICONS.save], ['undo', ICONS.undo], ['redo', ICONS.redo]]);
  fill('#viewBtns', [['presenter', ICONS.presenter], ['exportPptx', ICONS.pptx], ['exportPdf', ICONS.print], ['togglePanels', ICONS.panel], ['settings', ICONS.gear], ['shortcuts', ICONS.help]]);
  const tools = $('#tools'); tools.innerHTML = '';
  RAIL.forEach(r => tools.append(r === '-' ? el('div', {className: 'sep'}) : makeBtn(r[0], r[1])));
  $$('[data-act="togglePanels"]').forEach(b => b.classList.toggle('active', settings.dock));
  syncDisabled();
}
document.addEventListener('mousedown', e => { if (e.target.closest('.ibtn,.cta,.swatch,.lcard,.thumb')) e.preventDefault(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) run(b.dataset.act); });

/* Option bar: what the selection can do (like the style controls in the other apps). */
$('#ctxBar').addEventListener('wheel', e => { const b = e.currentTarget; if (b.scrollWidth > b.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { b.scrollLeft += e.deltaY; e.preventDefault(); } }, {passive: false});
const grp = (...kids) => el('div', {className: 'group'}, ...kids);
const lbl = s => el('span', {className: 'optlabel', textContent: s});
function ib(html, title, fn, on) { const b = el('button', {className: 'ibtn' + (on ? ' active' : ''), innerHTML: html, title}); b.onclick = fn; return b; }
function numIn(value, min, max, fn) {
  const i = el('input', {type: 'number', value: Math.round(value * 100) / 100, min, max});
  i.onchange = () => fn(clamp(parseFloat(i.value) || 0, min, max));
  return i;
}
function swatches(value, fn, opts = {}) {
  const th = design(), out = [];
  for (const c of SWATCHES.slice(0, opts.n || 6)) {
    const b = el('button', {className: 'swatch' + (c === value ? ' active' : ''), title: c.startsWith('t:') ? t('ui.designs') : c});
    b.style.background = color(c, th); b.onclick = () => fn(c); out.push(b);
  }
  const inp = el('input', {type: 'color', title: t('ui.color')}); const hex = color(value, th);
  inp.value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000';
  inp.onchange = () => fn(inp.value); out.push(inp);
  if (opts.none) out.push(ib('&#8856;', t('ui.none'), () => fn(null), value == null));
  return out;
}
function renderOptbar() {
  const bar = $('#ctxBar'); bar.replaceChildren();
  if (!doc) return;
  const els = selEls();
  if (!els.length) { bar.append(el('span', {className: 'hint-line', textContent: t('ui.noSel')})); return; }
  const e = els[0];
  if (e.type === 'text') {
    const fs = el('select');
    for (const [n, v] of FONTS) fs.append(el('option', {value: v, textContent: n.startsWith('font.') ? t(n) : n, selected: e.font === v}));
    fs.onchange = () => setProp('font', fs.value);
    bar.append(grp(fs, numIn(e.size, 8, 400, v => setProp('size', v))),
      grp(ib('<b class="g">B</b>', tip('bold'), () => toggleText('bold'), e.bold), ib('<i class="g serif">I</i>', tip('italic'), () => toggleText('italic'), e.italic),
        ib('<u class="g">U</u>', tip('underline'), () => toggleText('underline'), e.underline)),
      grp(...['left', 'center', 'right'].map(a => ib(ICONS['tx' + a[0].toUpperCase() + a.slice(1)], t('tx.' + a), () => setProp('align', a), (e.align || 'left') === a))),
      grp(lbl(t('ui.color')), ...swatches(e.color, v => setProp('color', v))));
  } else if (e.type === 'shape') {
    bar.append(grp(lbl(t('ui.fill')), ...swatches(e.fill, v => setProp('fill', v))));
    if (e.shape === 'line') bar.append(grp(lbl(t('ui.width')), numIn(e.sw || 8, 1, 80, v => setProp('sw', v))));
    else bar.append(grp(lbl(t('ui.outline')), ...swatches(e.stroke, v => { setProp('stroke', v); if (v && !e.sw) setProp('sw', 6); }, {n: 3, none: true}), numIn(e.sw || 0, 0, 80, v => setProp('sw', v))));
    if (e.shape === 'rect' || e.shape === 'round') bar.append(grp(lbl(t('ui.corners')), numIn(e.radius ?? 0, 0, 400, v => setProp('radius', v))));
  } else if (e.type === 'image') {
    const fit = el('select'); for (const f of ['contain', 'cover', 'stretch']) fit.append(el('option', {value: f, textContent: t('ui.' + f), selected: e.fit === f}));
    fit.onchange = () => setProp('fit', fit.value);
    const rep = el('button', {className: 'btn-sm', textContent: t('ui.replace')});
    rep.onclick = () => pickImage(r => { for (const x of selEls()) Object.assign(x, {src: r.src, iw: r.w, ih: r.h}); commit(); renderAll(); });
    bar.append(grp(lbl(t('ui.fit')), fit), grp(rep));
  } else if (e.type === 'table') {
    bar.append(grp(lbl(t('ui.size')), numIn(e.size, 8, 200, v => setProp('size', v))),
      grp(lbl(t('ui.headerColor')), ...swatches(e.fill, v => setProp('fill', v), {n: 4})),
      grp(ib(t('ui.header'), t('ui.header'), () => setProp('hdr', !e.hdr), e.hdr)),
      grp(lbl(t('ui.row')), ib('+', '', () => tableOp('addRow')), ib('&minus;', '', () => tableOp('delRow')),
        lbl(t('ui.col')), ib('+', '', () => tableOp('addCol')), ib('&minus;', '', () => tableOp('delCol'))));
  }
  bar.append(grp(lbl(t('ui.opacity')), numIn((e.op ?? 1) * 100, 0, 100, v => setProp('op', v / 100)), lbl(t('ui.rotate')), numIn(e.rot || 0, 0, 360, v => setProp('rot', v))),
    grp(...['left', 'center', 'right', 'top', 'middle', 'bottom'].map(a => ib(ICONS['al' + a[0].toUpperCase() + a.slice(1)], t('al.' + a), () => alignTo(a)))),
    grp(makeBtn('front', ICONS.front), makeBtn('back', ICONS.back), makeBtn('duplicate', ICONS.dup), makeBtn('delete', ICONS.trash)));
  syncDisabled();
}

/* ================= Panels on the right ================= */
function renderDock() {
  $$('#dockTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === settings.dockTab));
  $$('.dpanel').forEach(p => p.classList.toggle('active', p.dataset.panel === settings.dockTab));
  const notes = $('#notesIn');
  if (!doc) { ['#layoutGrid', '#designGrid', '#slideProps'].forEach(s => $(s).replaceChildren()); notes.value = ''; notes.disabled = true; return; }
  notes.disabled = false;
  if (!settings.dock) return;
  const th = design();
  if (settings.dockTab === 'layouts') {
    $('#layoutGrid').replaceChildren(...LAYOUTS.map(k => {
      const s = newSlide(layout(k).map(e => Object.assign(e, {ph: false}))); s.bg = slide().bg;
      const c = el('button', {className: 'lcard', title: t('lay.' + k)}, previewOf(s, th), el('div', {textContent: t('lay.' + k)}));
      c.onclick = () => addSlide(k); return c;
    }));
  } else if (settings.dockTab === 'designs') {
    $('#designGrid').replaceChildren(...Object.entries(DESIGNS).map(([id, d]) => {
      const s = newSlide([textEl({x: 80, y: 280, w: 1700, size: 220, bold: true, font: 't:head', text: 'Aa'}),
        shapeEl('rect', {x: 80, y: 700, w: 700, h: 40, fill: 't:accent'}), shapeEl('rect', {x: 80, y: 790, w: 440, h: 40, fill: 't:accent2'})]);
      const c = el('button', {className: 'lcard' + (doc.theme === id ? ' active' : ''), title: d.name}, previewOf(s, d), el('div', {textContent: d.name}));
      c.onclick = () => setDesign(id); return c;
    }));
  } else if (settings.dockTab === 'slide') {
    const s = slide(), box = $('#slideProps');
    const setBg = v => { s.bg = v; commit(); renderAll(); };
    const row = el('div', {className: 'swrow'}, ...swatches(typeof s.bg === 'string' ? s.bg : null, setBg));
    const g = el('button', {className: 'swatch' + (s.bg && typeof s.bg === 'object' ? ' active' : ''), title: t('ui.gradient')});
    g.style.background = bgCss({c1: 't:accent', c2: 't:accent2', a: 135}, th); g.onclick = () => setBg({c1: 't:accent', c2: 't:accent2', a: 135});
    row.append(g);
    const tr = el('select', {className: 'wide-sel'});
    for (const x of TRANSITIONS) tr.append(el('option', {value: x, textContent: t('ui.tr.' + x), selected: s.trans === x}));
    tr.onchange = () => { s.trans = tr.value; commit(); };
    const all = el('button', {className: 'btn-sm', textContent: t('ui.applyAll')});
    all.onclick = () => { for (const x of doc.slides) { x.bg = JSON.parse(JSON.stringify(s.bg)); x.trans = s.trans; } commit(); renderAll(); };
    box.replaceChildren(el('div', {className: 'sect', textContent: t('ui.background')}), row,
      el('div', {className: 'sect', textContent: t('ui.transition')}), tr, el('div', {className: 'sect'}), all);
  } else if (settings.dockTab === 'notes') {
    if (document.activeElement !== notes) notes.value = slide().notes || '';
  }
}
$('#notesIn').addEventListener('input', e => { if (doc) { slide().notes = e.target.value; markDirty(true); } });
$('#notesIn').addEventListener('change', () => { if (doc) commit(); });
$$('#dockTabs button').forEach(b => b.onclick = () => { settings.dockTab = b.dataset.tab; settings.dock = true; applySettings(); });

/* ================= Filmstrip ================= */
function renderThumbs() {
  const fs = $('#filmstrip'); fs.replaceChildren();
  if (!doc) return;
  const th = design();
  doc.slides.forEach((s, i) => {
    const tb = el('div', {className: 'thumb' + (i === cur ? ' cur' : ''), draggable: true}, previewOf(s, th), el('span', {className: 'n', textContent: i + 1}));
    tb.dataset.i = i;
    tb.onclick = () => go(i);
    tb.ondragstart = ev => { ev.dataTransfer.setData('text/slide', String(i)); ev.dataTransfer.effectAllowed = 'move'; };
    tb.ondragover = ev => { if (ev.dataTransfer.types.includes('text/slide')) { ev.preventDefault(); tb.classList.add('dragover'); } };
    tb.ondragleave = () => tb.classList.remove('dragover');
    tb.ondrop = ev => { ev.preventDefault(); ev.stopPropagation(); tb.classList.remove('dragover'); const from = +ev.dataTransfer.getData('text/slide'); if (!isNaN(from)) moveSlide(from, i); };
    fs.append(tb);
  });
  const add = el('button', {className: 'addslide', textContent: '+', title: tip('newSlide')});
  add.onclick = () => run('newSlide');
  fs.append(add);
  const c = fs.children[cur]; if (c) c.scrollIntoView({block: 'nearest', inline: 'nearest'});
  $('#stSlide').textContent = t('st.slide', {n: cur + 1, m: doc.slides.length});
}
function renderAll() { if (!doc) return; renderStage(); renderThumbs(); renderDock(); updateTitle(); syncDisabled(); }

/* ================= Modal, settings ================= */
let settingsOpen = false, prefsSection = 'general';
function modal(title, html) {
  $('.modal').classList.remove('wide'); $('#modalFoot').hidden = true; settingsOpen = false;
  $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').classList.add('show');
}
function closeModal() { $('#modal').classList.remove('show'); settingsOpen = false; }
$('#modalClose').onclick = closeModal;
$('#modal').onmousedown = e => { if (e.target.id === 'modal') closeModal(); };
function openSettings(section) {
  if (section) prefsSection = section;
  $('.modal').classList.add('wide'); $('#modalFoot').hidden = false;
  settingsOpen = true; renderSettings(); $('#modal').classList.add('show');
}
function renderSettings() {
  const opt = (v, label, c) => `<option value="${v}"${v === c ? ' selected' : ''}>${esc(label)}</option>`;
  const sw = (name, label) => `<label class="switch"><input type="checkbox" data-sw="${name}"${settings[name] ? ' checked' : ''}><span></span>${esc(label)}</label>`;
  const mock = th => `<div class="tc-mock" data-theme="${th}"><div class="tc-bar"><i></i><i></i><i></i><b></b></div>
    <div class="tc-body" style="grid-template-columns:14px 1fr 38px"><div class="tc-rail"></div>
    <div class="tc-pv" style="padding:12px 16px"><div class="tc-paper" style="border-radius:2px;border-bottom:var(--paper-border)"><i></i><i style="width:70%"></i><i style="width:50%"></i></div></div><div class="tc-dock"></div></div></div>`;
  const body = {
    general: `<h3>${esc(t('set.language'))}</h3><p class="hint">${esc(t('set.languageHint'))}</p>
      <select class="wide-sel" data-sel="lang">${opt('auto', t('a.langAuto'), settings.lang)}${opt('en', 'English', settings.lang)}${opt('de', 'Deutsch', settings.lang)}</select>
      <h3>${esc(t('set.layout'))}</h3>${sw('dock', t('set.panels'))}${sw('autoHide', t('set.autoHide'))}`,
    appearance: `<h3>${esc(t('set.theme'))}</h3><div class="theme-grid">` + THEMES.map(th =>
      `<button class="theme-card${settings.theme === th ? ' active' : ''}" data-theme-pick="${th}">${mock(th)}
       <div class="theme-name">${esc(t('theme.' + th))}<span>${settings.theme === th ? '&#10003;' : ''}</span></div></button>`).join('') + '</div>',
    editor: `<h3>${esc(t('set.behavior'))}</h3>${sw('snap', t('set.snap'))}`,
    keys: '<div id="keysBox"></div>'
  };
  const sections = ['general', 'appearance', 'editor', 'keys'];
  $('#modalTitle').textContent = t('set.title');
  $('#modalBody').innerHTML = `<div class="prefs"><nav>${sections.map(k =>
    `<button data-sec="${k}" class="${k === prefsSection ? 'active' : ''}">${esc(t('set.' + k))}</button>`).join('')}</nav><section>${body[prefsSection]}</section></div>`;
  if (prefsSection === 'keys') Shortcuts.editor($('#keysBox'), {MENUS, keys: settings.keys || {}, t, fmtKey, comboOf, label: a => t('a.' + a),
    onChange: keys => { settings.keys = keys; applySettings(); }});
  $('#modalFoot').innerHTML = `<button class="btn-sm" data-pref="reset">${esc(t('set.reset'))}</button><span class="flex"></span>
    <button class="btn-sm primary" data-pref="done">${esc(t('set.done'))}</button>`;
}
$('#modal').addEventListener('click', e => {
  if (!settingsOpen) return;
  const x = e.target.closest('[data-sec],[data-theme-pick],[data-pref]'); if (!x) return;
  if (x.dataset.sec) prefsSection = x.dataset.sec;
  else if (x.dataset.themePick) settings.theme = x.dataset.themePick;
  else if (x.dataset.pref === 'done') return closeModal();
  else if (x.dataset.pref === 'reset') { settings = {...DEF}; toast(t('set.resetDone')); }
  applySettings(); renderSettings();
});
$('#modal').addEventListener('change', e => {
  const d = e.target.dataset;
  if (d.sel) { settings[d.sel] = e.target.value; applySettings(); renderSettings(); }
  if (d.sw) { settings[d.sw] = e.target.checked; applySettings(); }
});
function setLang(l) { settings.lang = l; applySettings(); }
function setTheme(th) { settings.theme = th; applySettings(); }

function applyLanguage() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach(n => n.textContent = t(n.dataset.i18n));
  $$('[data-i18n-ph]').forEach(n => n.placeholder = t(n.dataset.i18nPh));
  $$('[data-i18n-title]').forEach(n => n.title = t(n.dataset.i18nTitle));
  buildMenubar(); buildToolbars();
  if (booted) { renderTabs(); renderRecent(); updateTitle(); renderOptbar(); renderAll(); }
}
let appliedKeys = null;
function applySettings() {
  if (window.AutoHide) AutoHide.set(settings.autoHide);
  if (!THEMES.includes(settings.theme)) settings.theme = 'dark';
  if (window.Shared) Shared.push({theme: settings.theme, lang: settings.lang});
  document.documentElement.dataset.theme = settings.theme;
  if (JSON.stringify(settings.keys || {}) !== appliedKeys) {
    appliedKeys = JSON.stringify(settings.keys || {});
    Shortcuts.apply(MENUS, settings.keys || {}); buildKeymap(); buildToolbars();
  }
  const nl = effectiveLang();
  if (nl !== lang) { lang = nl; applyLanguage(); }
  $('#dock').classList.toggle('hidden', !settings.dock);
  $$('[data-act="togglePanels"]').forEach(b => b.classList.toggle('active', settings.dock));
  renderDock(); fit(); saveSession();
}

/* ================= Keyboard ================= */
function comboOf(e) {
  let k = e.key;
  if (/^Digit\d$/.test(e.code)) k = e.code.slice(5);
  else if (e.code === 'Minus') k = '-';
  else if (e.code === 'Period') k = '.';
  else if (e.code === 'Comma') k = ',';
  else if (e.code === 'BracketLeft') k = '[';
  else if (e.code === 'BracketRight') k = ']';
  else if (e.code === 'Backslash' || e.code === 'IntlBackslash') k = '\\';
  else if (k.length === 1) k = k.toUpperCase();
  return (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + (e.altKey ? 'Alt+' : '') + k;
}
// In text fields (notes, numbers, text being edited) these keep their normal meaning.
const FIELD_KEYS = new Set(['Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z', 'Ctrl+X', 'Ctrl+C', 'Ctrl+V', 'Ctrl+A', 'Delete', 'Backspace', 'Ctrl+B', 'Ctrl+I', 'Ctrl+U']);
window.addEventListener('keydown', e => {
  if (IS_PRESENTER || (window.Shortcuts && Shortcuts.recording)) return;
  const k = e.key;
  if (presenting) {
    if (/^(ArrowRight|ArrowDown|PageDown| |Enter)$/.test(k)) { e.preventDefault(); pNext(); }
    else if (/^(ArrowLeft|ArrowUp|PageUp|Backspace)$/.test(k)) { e.preventDefault(); pPrev(); }
    else if (k === 'Home') presShow(0); else if (k === 'End') presShow(doc.slides.length - 1);
    else if (k === 'Escape') endPresent(); else if (k.toLowerCase() === 'b' || k === '.') toggleBlank();
    else if (k.toLowerCase() === 'p') openPresenter();
    e.stopPropagation(); return;
  }
  if (k === 'Escape') {
    if ($('#modal').classList.contains('show')) closeModal();
    else if (menuOpen) closeMenus();
    else if (editing) finishEdit();
    else if (sel.length) { sel = []; renderOverlay(); }
    return;
  }
  if (e.ctrlKey && e.altKey) return;   // AltGr on international keyboards types characters
  const combo = comboOf(e), inField = !!editing || Native.isField(e.target) || e.target.isContentEditable || e.target.tagName === 'SELECT';
  if (inField && FIELD_KEYS.has(combo)) return;
  if ($('#modal').classList.contains('show')) return;
  const act = KEYMAP[combo];
  if (act) { e.preventDefault(); e.stopPropagation(); run(act); return; }
  if (inField || !doc) return;
  // Canvas keys (not in the menus): delete, move, edit, browse slides.
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); if (sel.length) del(); }
  else if (k === 'Enter' && sel.length === 1) { const x = selEls()[0]; if (x.type === 'text') { e.preventDefault(); startEdit(x); } else if (x.type === 'table') { e.preventDefault(); startEdit(x, [0, 0]); } }
  else if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); go(cur + (k === 'PageDown' ? 1 : -1)); }
  else if (/^Arrow/.test(k) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    const s = e.shiftKey ? 20 : 2;
    if (sel.length) nudge(k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0, k === 'ArrowUp' ? -s : k === 'ArrowDown' ? s : 0);
    else go(cur + (k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 1));
  }
}, true);

/* ================= Native right-click menus (see native.js) ================= */
{
  const item = act => ({id: act, label: t('a.' + act), accel: keyOf(act) || null, enabled: allowed(act)});
  let ctxTab = -1;
  Native.setProvider(e => {
    const tab = e.target.closest('.tab');
    if (tab) { ctxTab = +tab.dataset.i; return [{id: 'tab:close', label: t('a.closeTab'), accel: keyOf('closeTab') || null}]; }
    const th = e.target.closest('.thumb');
    if (th) { go(+th.dataset.i); return [item('newSlide'), item('dupSlide'), item('delSlide'), null, item('slideUp'), item('slideDown'), null, item('presentCurrent')]; }
    const target = e.target.closest('#stage .el');
    if (target && !editing) {
      if (!sel.includes(target.dataset.id)) { sel = [target.dataset.id]; renderOverlay(); }
      return [item('cut'), item('copy'), item('paste'), item('duplicate'), null, item('front'), item('forward'), item('backward'), item('back'), null, item('delete')];
    }
    if (e.target.closest('#stagewrap') && doc && !editing) return [item('paste'), item('selectAll'), null, item('newSlide'), item('presentCurrent')];
    return null;
  });
  Native.setHandler(id => { if (id === 'tab:close') return closeTab(ctxTab); run(id); });
}
$('#zIn').onclick = () => run('zoomIn'); $('#zOut').onclick = () => run('zoomOut'); $('#zVal').onclick = () => run('zoomReset');

/* Test hook (like Md's __md / Dt's __dt). */
window.__sl = {get doc() { return doc; }, get sel() { return sel; }, get cur() { return cur; }, docs: () => docs, A, run, addTable, startEdit, buildPptx, slideshowHtml, present, setSel: ids => { sel = ids; renderOverlay(); }};

/* ================= Boot ================= */
(async function boot() {
  await loadTexts();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE)); } catch (e) {}
  if (saved && saved.settings) settings = {...DEF, ...saved.settings};
  // Theme and language shared by all Studio apps (shared.js); the shared values win over this app's own.
  if (window.Shared) await Shared.init({apply: sh => {
    if (sh.theme) settings.theme = sh.theme;
    if (sh.lang) settings.lang = sh.lang;
    if (booted) applySettings();
  }});
  lang = effectiveLang();
  document.documentElement.dataset.theme = THEMES.includes(settings.theme) ? settings.theme : 'dark';
  if (IS_PRESENTER) { document.documentElement.lang = lang; if (chan) runPresenter(); return; }
  applyLanguage();
  recent = (saved && saved.recent) || [];
  if (saved && Array.isArray(saved.docs)) {
    // A saved session with no documents opens on the start screen.
    untitledN = saved.untitledN || 1;
    for (const d of saved.docs) {
      let deck = d.deck;
      if (!deck && d.path && invoke) { try { deck = JSON.parse((await invoke('read_file', {path: d.path})).content); } catch (e) { deck = null; } }
      if (validDeck(deck)) docs.push({name: d.name, path: invoke ? d.path : null, deck, cur: d.cur || 0, dirty: !!d.dirty, hist: {stack: [], i: -1}});
    }
    active = Math.min(saved.active ?? 0, docs.length - 1);
  } else {
    docs = [{name: `${t('ui.untitled')} ${untitledN++}.slides`, path: null, deck: newDeck(), cur: 0, dirty: false, hist: {stack: [], i: -1}}];
    active = 0;
  }
  booted = true;
  applySettings();
  loadActive();
  if (invoke) {
    // Files passed on the command line / via "Open with", and (macOS) files opened while running.
    invoke('initial_files').then(openNative).catch(e => toast(t('toast.openFail', {e})));
    window.__TAURI__.event.listen('open-docs', e => openNative(e.payload));
  }
})();
