/* Slides Studio — presentation editor. The slide is a fixed 1920×1080 canvas; everything is scaled to fit.
   Elements: text, shape, image. Files are plain JSON (.slides). The native shell (Rust) only does files, dialogs and
   printing; in a normal browser the same code falls back to downloads/uploads so the UI can be tested anywhere. */
(() => {
'use strict';
const W = 1920, H = 1080;
const invoke = window.__TAURI__ ? window.__TAURI__.core.invoke : null;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const store = {
  get(k, d) { try { const v = localStorage.getItem('slides.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('slides.' + k, JSON.stringify(v)); } catch (e) {} }
};

/* ───────────── texts ───────────── */
const I18N = {
  en: {
    'menu.file': 'File', 'menu.edit': 'Edit', 'menu.slide': 'Slide', 'menu.view': 'View', 'menu.settings': 'Settings',
    'a.present': 'Present', 'a.new': 'New', 'a.open': 'Open…', 'a.save': 'Save', 'a.saveAs': 'Save As…',
    'a.exportPdf': 'Export as PDF…', 'a.exportHtml': 'Export as HTML slideshow…',
    'a.undo': 'Undo', 'a.redo': 'Redo', 'a.copy': 'Copy', 'a.cut': 'Cut', 'a.paste': 'Paste', 'a.duplicate': 'Duplicate',
    'a.delete': 'Delete', 'a.selectAll': 'Select All', 'a.front': 'Bring to Front', 'a.back': 'Send to Back',
    'a.forward': 'Bring Forward', 'a.backward': 'Send Backward',
    'a.newSlide': 'New Slide', 'a.dupSlide': 'Duplicate Slide', 'a.delSlide': 'Delete Slide', 'a.slideLeft': 'Move Slide Left',
    'a.slideRight': 'Move Slide Right', 'a.fromStart': 'Present from Start', 'a.fromCurrent': 'Present from This Slide',
    'a.theme': 'Theme', 'a.language': 'Language', 'a.autohide': 'Auto-hide bars', 'a.snap': 'Snap to guides',
    'tool.text': 'Text', 'tool.shapes': 'Shapes', 'tool.images': 'Images', 'tool.templates': 'Layouts', 'tool.themes': 'Themes',
    'tool.slide': 'Slide', 'tool.notes': 'Notes',
    'f.title': 'Title', 'f.subtitle': 'Subtitle', 'f.heading': 'Heading', 'f.body': 'Body text',
    'f.addTitle': 'Add a title', 'f.addSubtitle': 'Add a subtitle', 'f.addHeading': 'Add a heading', 'f.addText': 'Add some text',
    'f.addImage': 'Add Image…', 'f.dropImage': 'Or drop / paste an image here', 'f.text': 'Text',
    'shape.rect': 'Rectangle', 'shape.round': 'Rounded', 'shape.ellipse': 'Ellipse', 'shape.triangle': 'Triangle',
    'shape.star': 'Star', 'shape.arrow': 'Arrow', 'shape.line': 'Line', 'shape.diamond': 'Diamond',
    'lay.title': 'Title', 'lay.content': 'Title + content', 'lay.two': 'Two columns', 'lay.imgtext': 'Image + text',
    'lay.quote': 'Quote', 'lay.section': 'Section', 'lay.blank': 'Blank', 'lay.big': 'Big statement',
    'o.font': 'Font', 'o.size': 'Size', 'o.color': 'Color', 'o.fill': 'Fill', 'o.stroke': 'Outline', 'o.width': 'Width',
    'o.radius': 'Corners', 'o.opacity': 'Opacity', 'o.rotate': 'Rotate', 'o.align': 'Align', 'o.fit': 'Fit',
    'o.bg': 'Background', 'o.transition': 'Transition', 'o.none': 'None', 'o.fade': 'Fade', 'o.slide': 'Slide', 'o.zoom': 'Zoom',
    'o.contain': 'Fit', 'o.cover': 'Fill', 'o.stretch': 'Stretch', 'o.noSel': 'Click an element to edit it — or add one from the left.',
    'o.replace': 'Replace image…', 'o.onSlide': 'On slide',
    'al.left': 'Left', 'al.center': 'Center', 'al.right': 'Right', 'al.top': 'Top', 'al.middle': 'Middle', 'al.bottom': 'Bottom',
    'n.title': 'Speaker notes', 'n.ph': 'Notes for this slide (not shown on the slide)…',
    'st.slide': 'Slide {n} of {m}', 'st.sel': '{n} selected', 'st.saved': 'Saved', 'st.unsaved': 'Unsaved changes',
    'toast.saved': 'Saved “{name}”.', 'toast.opened': 'Opened “{name}”.', 'toast.openFail': 'Could not open the file: {e}',
    'toast.saveFail': 'Could not save: {e}', 'toast.exported': 'Exported to {path}', 'toast.printHint': 'Choose “Save as PDF” as the printer.',
    'toast.imgFail': 'That image could not be read.', 'toast.restored': 'Restored your last session.',
    'confirm.title': 'Unsaved changes', 'confirm.discard': 'The presentation has unsaved changes. Discard them?',
    'confirm.ok': 'Discard', 'confirm.cancel': 'Cancel', 'untitled': 'Untitled presentation',
    'end': 'End of presentation — click or press Esc to leave'
  },
  de: {
    'menu.file': 'Datei', 'menu.edit': 'Bearbeiten', 'menu.slide': 'Folie', 'menu.view': 'Ansicht', 'menu.settings': 'Einstellungen',
    'a.present': 'Präsentieren', 'a.new': 'Neu', 'a.open': 'Öffnen…', 'a.save': 'Speichern', 'a.saveAs': 'Speichern unter…',
    'a.exportPdf': 'Als PDF exportieren…', 'a.exportHtml': 'Als HTML-Slideshow exportieren…',
    'a.undo': 'Rückgängig', 'a.redo': 'Wiederholen', 'a.copy': 'Kopieren', 'a.cut': 'Ausschneiden', 'a.paste': 'Einfügen',
    'a.duplicate': 'Duplizieren', 'a.delete': 'Löschen', 'a.selectAll': 'Alles auswählen', 'a.front': 'Ganz nach vorn',
    'a.back': 'Ganz nach hinten', 'a.forward': 'Eine Ebene nach vorn', 'a.backward': 'Eine Ebene nach hinten',
    'a.newSlide': 'Neue Folie', 'a.dupSlide': 'Folie duplizieren', 'a.delSlide': 'Folie löschen', 'a.slideLeft': 'Folie nach links',
    'a.slideRight': 'Folie nach rechts', 'a.fromStart': 'Von Anfang präsentieren', 'a.fromCurrent': 'Ab dieser Folie präsentieren',
    'a.theme': 'Design', 'a.language': 'Sprache', 'a.autohide': 'Leisten automatisch ausblenden', 'a.snap': 'An Hilfslinien ausrichten',
    'tool.text': 'Text', 'tool.shapes': 'Formen', 'tool.images': 'Bilder', 'tool.templates': 'Layouts', 'tool.themes': 'Designs',
    'tool.slide': 'Folie', 'tool.notes': 'Notizen',
    'f.title': 'Titel', 'f.subtitle': 'Untertitel', 'f.heading': 'Überschrift', 'f.body': 'Fließtext',
    'f.addTitle': 'Titel hinzufügen', 'f.addSubtitle': 'Untertitel hinzufügen', 'f.addHeading': 'Überschrift hinzufügen', 'f.addText': 'Text hinzufügen',
    'f.addImage': 'Bild hinzufügen…', 'f.dropImage': 'Oder Bild hierher ziehen / einfügen', 'f.text': 'Text',
    'shape.rect': 'Rechteck', 'shape.round': 'Abgerundet', 'shape.ellipse': 'Ellipse', 'shape.triangle': 'Dreieck',
    'shape.star': 'Stern', 'shape.arrow': 'Pfeil', 'shape.line': 'Linie', 'shape.diamond': 'Raute',
    'lay.title': 'Titel', 'lay.content': 'Titel + Inhalt', 'lay.two': 'Zwei Spalten', 'lay.imgtext': 'Bild + Text',
    'lay.quote': 'Zitat', 'lay.section': 'Abschnitt', 'lay.blank': 'Leer', 'lay.big': 'Große Aussage',
    'o.font': 'Schrift', 'o.size': 'Größe', 'o.color': 'Farbe', 'o.fill': 'Füllung', 'o.stroke': 'Kontur', 'o.width': 'Breite',
    'o.radius': 'Ecken', 'o.opacity': 'Deckkraft', 'o.rotate': 'Drehen', 'o.align': 'Ausrichten', 'o.fit': 'Anpassung',
    'o.bg': 'Hintergrund', 'o.transition': 'Übergang', 'o.none': 'Keiner', 'o.fade': 'Überblenden', 'o.slide': 'Schieben', 'o.zoom': 'Zoom',
    'o.contain': 'Einpassen', 'o.cover': 'Füllen', 'o.stretch': 'Strecken', 'o.noSel': 'Element anklicken zum Bearbeiten — oder links eines hinzufügen.',
    'o.replace': 'Bild ersetzen…', 'o.onSlide': 'Auf der Folie',
    'al.left': 'Links', 'al.center': 'Mitte', 'al.right': 'Rechts', 'al.top': 'Oben', 'al.middle': 'Mitte', 'al.bottom': 'Unten',
    'n.title': 'Sprechernotizen', 'n.ph': 'Notizen zu dieser Folie (nicht auf der Folie sichtbar)…',
    'st.slide': 'Folie {n} von {m}', 'st.sel': '{n} ausgewählt', 'st.saved': 'Gespeichert', 'st.unsaved': 'Ungespeicherte Änderungen',
    'toast.saved': '„{name}“ gespeichert.', 'toast.opened': '„{name}“ geöffnet.', 'toast.openFail': 'Datei konnte nicht geöffnet werden: {e}',
    'toast.saveFail': 'Speichern fehlgeschlagen: {e}', 'toast.exported': 'Exportiert nach {path}', 'toast.printHint': 'Wähle „Als PDF speichern“ als Drucker.',
    'toast.imgFail': 'Dieses Bild konnte nicht gelesen werden.', 'toast.restored': 'Letzte Sitzung wiederhergestellt.',
    'confirm.title': 'Ungespeicherte Änderungen', 'confirm.discard': 'Die Präsentation hat ungespeicherte Änderungen. Verwerfen?',
    'confirm.ok': 'Verwerfen', 'confirm.cancel': 'Abbrechen', 'untitled': 'Unbenannte Präsentation',
    'end': 'Ende der Präsentation — Klick oder Esc zum Beenden'
  }
};
let lang = store.get('lang', (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en');
const t = (k, p) => { let s = (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k; if (p) for (const x in p) s = s.replace('{' + x + '}', p[x]); return s; };

/* ───────────── themes, fonts, shapes ───────────── */
const SANS = '"Segoe UI",system-ui,-apple-system,Arial,sans-serif', SERIF = 'Georgia,"Times New Roman",serif';
const THEMES = {
  studio:   {name: 'Studio',   bg: '#ffffff', text: '#1f2328', accent: '#378ef0', accent2: '#7a5cff', head: SANS,  body: SANS},
  midnight: {name: 'Midnight', bg: '#14161f', text: '#f2f4ff', accent: '#6ea8ff', accent2: '#c18bff', head: SANS,  body: SANS},
  sunset:   {name: 'Sunset',   bg: '#fff4ea', text: '#3b1f14', accent: '#ff6a3d', accent2: '#ffb347', head: SANS,  body: SANS},
  forest:   {name: 'Forest',   bg: '#f1f7f2', text: '#173324', accent: '#2f9e5b', accent2: '#8bc34a', head: SANS,  body: SANS},
  paper:    {name: 'Paper',    bg: '#faf7f0', text: '#2b2b2b', accent: '#b5483a', accent2: '#2f5d8a', head: SERIF, body: SERIF},
  neon:     {name: 'Neon',     bg: '#0b0b12', text: '#ffffff', accent: '#00e5ff', accent2: '#ff2bd6', head: SANS,  body: SANS},
  mono:     {name: 'Mono',     bg: '#f4f4f4', text: '#111111', accent: '#111111', accent2: '#777777', head: '"Courier New",monospace', body: '"Courier New",monospace'}
};
const FONTS = [['Theme heading', 't:head'], ['Theme body', 't:body'], ['Segoe UI', SANS], ['Georgia', SERIF], ['Arial', 'Arial,Helvetica,sans-serif'],
  ['Trebuchet', '"Trebuchet MS",sans-serif'], ['Verdana', 'Verdana,sans-serif'], ['Times', '"Times New Roman",serif'],
  ['Courier', '"Courier New",monospace'], ['Impact', 'Impact,"Arial Black",sans-serif']];
const SWATCHES = ['t:text', 't:bg', 't:accent', 't:accent2', '#ffffff', '#000000', '#e5484d', '#f5a524', '#ffd60a', '#30a46c', '#0ea5e9', '#8e4ec6', '#ec4899', '#64748b'];
const SHAPES = {
  rect: 'Rectangle', round: 'Rounded', ellipse: 'Ellipse', triangle: 'Triangle', diamond: 'Diamond', star: 'Star', arrow: 'Arrow', line: 'Line'
};
const TRANSITIONS = ['none', 'fade', 'slide', 'zoom'];

/* ───────────── document model ───────────── */
const newEl = (type, p) => Object.assign({id: uid(), type, x: 100, y: 100, w: 400, h: 200, rot: 0, op: 1}, p);
const textEl = (p) => newEl('text', Object.assign({text: '', size: 48, color: 't:text', font: 't:body', bold: false, italic: false, underline: false, align: 'left', w: 700}, p));
const shapeEl = (shape, p) => newEl('shape', Object.assign({shape, fill: 't:accent', stroke: null, sw: 0, radius: 24, w: 300, h: 300}, p));
const imageEl = (src, w, h, p) => { const k = Math.min(1, 1100 / w, 700 / h); return newEl('image', Object.assign({src, fit: 'contain', w: Math.round(w * k), h: Math.round(h * k), x: Math.round((W - w * k) / 2), y: Math.round((H - h * k) / 2)}, p)); };
const newSlide = (els = []) => ({id: uid(), bg: 't:bg', els, trans: 'fade', notes: ''});

function layout(kind) {
  const T = (p) => textEl(Object.assign({ph: true}, p));
  switch (kind) {
    case 'title': return [
      shapeEl('rect', {x: 0, y: 0, w: 40, h: H, fill: 't:accent'}),
      T({x: 140, y: 340, w: 1500, size: 120, bold: true, font: 't:head', text: t('f.addTitle')}),
      T({x: 144, y: 620, w: 1400, size: 52, color: 't:accent', text: t('f.addSubtitle')})];
    case 'content': return [
      T({x: 120, y: 80, w: 1680, size: 84, bold: true, font: 't:head', text: t('f.addHeading')}),
      shapeEl('rect', {x: 124, y: 200, w: 160, h: 8, fill: 't:accent'}),
      T({x: 120, y: 270, w: 1680, size: 46, text: '• ' + t('f.addText') + '\n• ' + t('f.addText') + '\n• ' + t('f.addText')})];
    case 'two': return [
      T({x: 120, y: 80, w: 1680, size: 84, bold: true, font: 't:head', text: t('f.addHeading')}),
      shapeEl('rect', {x: 124, y: 200, w: 160, h: 8, fill: 't:accent'}),
      T({x: 120, y: 270, w: 800, size: 42, text: t('f.addText')}), T({x: 1000, y: 270, w: 800, size: 42, text: t('f.addText')})];
    case 'imgtext': return [
      shapeEl('round', {x: 120, y: 120, w: 800, h: 840, fill: 't:accent2', radius: 32}),
      T({x: 1000, y: 160, w: 800, size: 84, bold: true, font: 't:head', text: t('f.addHeading')}),
      T({x: 1000, y: 380, w: 800, size: 42, text: t('f.addText')})];
    case 'quote': return [
      T({x: 160, y: 120, w: 300, size: 300, bold: true, color: 't:accent', font: 't:head', text: '“', ph: false}),
      T({x: 260, y: 360, w: 1400, size: 76, italic: true, font: 't:head', text: t('f.addText')}),
      T({x: 264, y: 760, w: 1200, size: 40, color: 't:accent', text: '— ' + t('f.title')})];
    case 'section': return [
      shapeEl('rect', {x: 0, y: 0, w: W, h: H, fill: 't:accent'}),
      T({x: 140, y: 400, w: 1600, size: 130, bold: true, color: '#ffffff', font: 't:head', text: t('f.addTitle')})];
    case 'big': return [
      T({x: 160, y: 300, w: 1600, size: 140, bold: true, align: 'center', font: 't:head', text: t('f.addText')})];
    default: return [];
  }
}

let doc, cur = 0, sel = [], file = {path: null, name: null}, dirty = false, clip = null;
let tool = null, settings = Object.assign({snap: true, ui: 'dark', autohide: false}, store.get('settings', {}));

const newDoc = () => ({version: 1, title: '', theme: 'studio', slides: [newSlide(layout('title'))]});
const slide = () => doc.slides[cur];
const themeOf = () => THEMES[doc.theme] || THEMES.studio;
const byId = id => slide().els.find(e => e.id === id);
const selEls = () => sel.map(byId).filter(Boolean);

/* Colors/fonts may be theme tokens ("t:accent") so a theme change recolors the whole deck. */
function color(c, th = themeOf()) { if (c && typeof c === 'string' && c.startsWith('t:')) return th[c.slice(2)] || '#000'; return c || 'transparent'; }
function fontOf(f, th = themeOf()) { return f && f.startsWith('t:') ? th[f.slice(2)] : (f || th.body); }
function bgCss(b, th = themeOf()) {
  if (b && typeof b === 'object') return `linear-gradient(${b.a ?? 135}deg,${color(b.c1, th)},${color(b.c2, th)})`;
  return color(b, th);
}

/* ───────────── history ───────────── */
const hist = {stack: [], i: -1};
function snapshot() { return JSON.stringify({doc, cur}); }
function commit(markDirty = true) {
  const s = snapshot();
  if (hist.stack[hist.i] === s) return;
  hist.stack.length = hist.i + 1; hist.stack.push(s); if (hist.stack.length > 150) hist.stack.shift(); hist.i = hist.stack.length - 1;
  if (markDirty) { dirty = true; autosave(); }
  syncUi();
}
function restore(s) {
  const o = JSON.parse(s); doc = o.doc; cur = clamp(o.cur, 0, doc.slides.length - 1);
  sel = sel.filter(id => byId(id)); dirty = true; autosave(); renderAll();
}
function undo() { if (hist.i > 0) { hist.i--; restore(hist.stack[hist.i]); } }
function redo() { if (hist.i < hist.stack.length - 1) { hist.i++; restore(hist.stack[hist.i]); } }
let autosaveT = 0;
function autosave() { clearTimeout(autosaveT); autosaveT = setTimeout(() => { try { localStorage.setItem('slides.autosave', JSON.stringify({doc, file})); } catch (e) {} }, 400); }

/* ───────────── rendering of slide content ───────────── */
const SVG_NS = 'http://www.w3.org/2000/svg';
function shapeSvg(e, th) {
  const w = e.w, h = e.h, fill = color(e.fill, th), st = e.stroke ? color(e.stroke, th) : 'none', sw = e.sw || 0;
  let inner;
  switch (e.shape) {
    case 'ellipse': inner = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}"/>`; break;
    case 'triangle': inner = `<polygon points="${w / 2},0 ${w},${h} 0,${h}"/>`; break;
    case 'diamond': inner = `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}"/>`; break;
    case 'star': {
      const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.2 : 0.5, a = -Math.PI / 2 + i * Math.PI / 5; pts.push(`${w / 2 + Math.cos(a) * r * w * 1.0},${h / 2 + Math.sin(a) * r * h * 1.0}`); }
      inner = `<polygon points="${pts.join(' ')}"/>`; break; }
    case 'arrow': { const b = h * 0.3, hh = w * 0.35;
      inner = `<polygon points="0,${h / 2 - b / 2} ${w - hh},${h / 2 - b / 2} ${w - hh},0 ${w},${h / 2} ${w - hh},${h} ${w - hh},${h / 2 + b / 2} 0,${h / 2 + b / 2}"/>`; break; }
    case 'line': return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="${fill}" stroke-width="${Math.max(2, sw || 8)}" stroke-linecap="round"/></svg>`;
    case 'round': inner = `<rect width="${w}" height="${h}" rx="${Math.min(e.radius ?? 24, w / 2, h / 2)}"/>`; break;
    default: inner = `<rect width="${w}" height="${h}" rx="${Math.min(e.radius ?? 0, w / 2, h / 2)}"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><g fill="${fill}" stroke="${st}" stroke-width="${sw}">${inner}</g></svg>`;
}
/* One element as a DOM node, positioned in slide pixels. `hideEmpty` skips untouched placeholders (present/export). */
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
  } else if (e.type === 'image') {
    n.style.height = e.h + 'px';
    n.style.backgroundImage = `url("${e.src}")`;
    n.style.backgroundSize = e.fit === 'stretch' ? '100% 100%' : e.fit === 'cover' ? 'cover' : 'contain';
  }
  return n;
}
function slideNode(s, th = themeOf(), hideEmpty = false) {
  const root = el('div', {className: 'slide-root'});
  root.style.cssText = 'position:absolute;inset:0;overflow:hidden';
  const bg = el('div', {className: 'slide-bg'}); bg.style.background = bgCss(s.bg, th); root.append(bg);
  for (const e of s.els) { const n = elNode(e, th, hideEmpty); if (n) root.append(n); }
  return root;
}

/* ───────────── stage ───────────── */
const stage = $('#stage'), overlay = $('#overlay'), wrap = $('#stagewrap');
let scale = 1;
function fit() {
  const r = wrap.getBoundingClientRect(), pad = 28;
  scale = Math.max(0.1, Math.min((r.width - pad * 2) / W, (r.height - pad * 2) / H));
  const x = (r.width - W * scale) / 2, y = (r.height - H * scale) / 2;
  for (const n of [stage, overlay]) { n.style.transform = `scale(${scale})`; n.style.left = x + 'px'; n.style.top = y + 'px'; }
}
function renderStage() {
  stage.replaceChildren(slideNode(slide()));
  renderOverlay();
}
function nodeOf(id) { return stage.querySelector(`.el[data-id="${id}"]`); }
function boxOf(e) { const n = nodeOf(e.id); return {x: e.x, y: e.y, w: e.w, h: e.type === 'text' ? (n ? n.offsetHeight : e.size * 1.2) : e.h}; }

const HANDLES = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
function renderOverlay() {
  overlay.replaceChildren();
  for (const e of selEls()) {
    const b = boxOf(e), box = el('div', {className: 'sel'});
    box.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;transform:rotate(${e.rot || 0}deg)`;
    if (sel.length === 1 && !editing) {
      for (const [hx, hy] of HANDLES) {
        if (e.type === 'text' && hy !== 0 && hx === 0) continue;       // text height is automatic
        const h = el('div', {className: 'handle' + (hx === 0 ? ' edge-v' : hy === 0 ? ' edge-h' : '')});
        h.style.cssText = `left:${(hx + 1) * 50}%;top:${(hy + 1) * 50}%;cursor:${cursorFor(hx, hy, e.rot)}`;
        h.dataset.hx = hx; h.dataset.hy = hy;
        box.append(h);
      }
      const r = el('div', {className: 'handle rot'}); r.style.cssText = 'left:50%;top:-44px'; r.dataset.rot = 1; box.append(r);
    }
    overlay.append(box);
  }
  const f = $('#stSel'); f.textContent = sel.length ? t('st.sel', {n: sel.length}) : '';
  renderOptbar();
}
function cursorFor(hx, hy, rot = 0) {
  const base = Math.atan2(hy, hx) * 180 / Math.PI + rot, a = ((base % 180) + 180) % 180;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][Math.round(a / 45) % 4];
}

/* Pointer interaction: move, resize, rotate, marquee-less click select. */
let drag = null, editing = null, guides = [], lastDownEl = null;
const toLogical = ev => { const r = stage.getBoundingClientRect(); return {x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale}; };

wrap.addEventListener('pointerdown', ev => {
  if (ev.button !== 0) return;
  if (editing && editing.node.contains(ev.target)) return;
  if (editing) finishEdit();
  const p = toLogical(ev), handle = ev.target.closest && ev.target.closest('.handle');
  if (handle && sel.length === 1) {
    const e = byId(sel[0]), b = boxOf(e);
    drag = handle.dataset.rot ? {kind: 'rot', e, cx: b.x + b.w / 2, cy: b.y + b.h / 2}
      : {kind: 'resize', e, hx: +handle.dataset.hx, hy: +handle.dataset.hy, start: {...b}, size: e.size, p, rot: (e.rot || 0) * Math.PI / 180};
    wrap.setPointerCapture(ev.pointerId); ev.preventDefault(); return;
  }
  const target = ev.target.closest && ev.target.closest('.el');
  lastDownEl = target && stage.contains(target) ? target.dataset.id : null;
  if (target && stage.contains(target)) {
    const id = target.dataset.id;
    if (ev.shiftKey) sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
    else if (!sel.includes(id)) sel = [id];
    renderOverlay(); renderPanels();
    drag = {kind: 'move', p, orig: selEls().map(e => ({e, x: e.x, y: e.y})), moved: false};
    wrap.setPointerCapture(ev.pointerId);
  } else {
    if (sel.length) { sel = []; renderOverlay(); renderPanels(); }
  }
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
      // Snap the group's bounding box to the slide's edges/center and to other elements.
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
    drag.e.rot = Math.round(((a % 360) + 360) % 360 * 10) / 10;
    const n = nodeOf(drag.e.id); if (n) n.style.transform = `rotate(${drag.e.rot}deg)`;
    renderOverlay();
  } else if (drag.kind === 'resize') {
    const {e, hx, hy, start, rot} = drag, dx = p.x - drag.p.x, dy = p.y - drag.p.y;
    const lx = dx * Math.cos(rot) + dy * Math.sin(rot), ly = -dx * Math.sin(rot) + dy * Math.cos(rot);
    let w = start.w, h = start.h;
    if (hx) w = Math.max(30, start.w + hx * lx);
    if (hy && e.type !== 'text') h = Math.max(30, start.h + hy * ly);
    if (hx && hy && (e.type === 'text' || e.type === 'image' || ev.shiftKey)) {          // corners keep the proportions
      const k = Math.max(w / start.w, h / start.h); w = Math.max(30, start.w * k); h = Math.max(30, start.h * k);
    }
    if (e.type === 'text' && hx && hy) e.size = Math.max(8, Math.round(drag.size * w / start.w));
    const dw = w - start.w, dh = h - start.h;
    const sx = hx * dw / 2, sy = hy * dh / 2;
    const cx = start.x + start.w / 2 + sx * Math.cos(rot) - sy * Math.sin(rot);
    const cy = start.y + start.h / 2 + sx * Math.sin(rot) + sy * Math.cos(rot);
    e.w = Math.round(w); if (e.type !== 'text') e.h = Math.round(h);
    e.x = Math.round(cx - e.w / 2); e.y = Math.round(cy - (e.type === 'text' ? start.h : e.h) / 2);
    const n = nodeOf(e.id);
    if (n) { const fresh = elNode(e, themeOf()); n.replaceWith(fresh); }
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
// With pointer capture the click target is the stage wrapper, so the element comes from the last pointerdown.
wrap.addEventListener('dblclick', () => {
  const e = lastDownEl && byId(lastDownEl);
  if (e && e.type === 'text') startEdit(e);
});
function startEdit(e) {
  if (!e) return;
  finishEdit();
  sel = [e.id]; const node = nodeOf(e.id); if (!node) return;
  node.classList.add('editing'); node.contentEditable = 'plaintext-only';
  if (node.contentEditable !== 'plaintext-only') node.contentEditable = 'true';
  if (e.ph) node.textContent = '';
  editing = {e, node}; renderOverlay();
  node.focus();
  const r = document.createRange(); r.selectNodeContents(node); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  node.addEventListener('input', () => { overlayFollow(); });
  node.addEventListener('keydown', k => { if (k.key === 'Escape') { k.preventDefault(); finishEdit(); } k.stopPropagation(); });
}
function overlayFollow() { if (editing) { const n = editing.node, box = overlay.querySelector('.sel'); if (box) box.style.height = n.offsetHeight + 'px'; } }
function finishEdit() {
  if (!editing) return;
  const {e, node} = editing; editing = null;
  const txt = node.innerText.replace(/\n$/, '');
  node.contentEditable = 'false'; node.classList.remove('editing');
  if (txt.trim() === '' && e.ph) { /* untouched placeholder keeps its hint */ } else if (txt !== e.text || e.ph) { e.text = txt; e.ph = false; }
  if (!e.ph && e.text.trim() === '') { slide().els = slide().els.filter(x => x !== e); sel = []; }
  getSelection().removeAllRanges();
  commit(); renderAll();
}

/* ───────────── editing actions ───────────── */
function addEl(e) { slide().els.push(e); sel = [e.id]; commit(); renderAll(); return e; }
function addText(kind) {
  const p = kind === 'title' ? {size: 110, bold: true, font: 't:head', w: 1500, x: 210, y: 360, text: t('f.addTitle')}
    : kind === 'heading' ? {size: 72, bold: true, font: 't:head', w: 1200, x: 360, y: 400, text: t('f.addHeading')}
    : {size: 44, w: 1000, x: 460, y: 440, text: t('f.addText')};
  const e = addEl(textEl(p)); e.ph = false; commit(false); renderAll(); setTimeout(() => startEdit(e), 30);
}
function addShape(kind) {
  const p = kind === 'line' ? {w: 600, h: 24, fill: 't:text', sw: 10, x: 660, y: 528} : {x: 810, y: 390, w: 300, h: 300};
  addEl(shapeEl(kind, p));
}
function del() { if (!sel.length) return; slide().els = slide().els.filter(e => !sel.includes(e.id)); sel = []; commit(); renderAll(); }
function dup() {
  const copies = selEls().map(e => Object.assign(JSON.parse(JSON.stringify(e)), {id: uid(), x: e.x + 40, y: e.y + 40}));
  slide().els.push(...copies); sel = copies.map(c => c.id); commit(); renderAll();
}
function copy() { if (sel.length) { clip = JSON.stringify(selEls()); try { Native.clipboardWrite('slides-studio:' + clip); } catch (e) {} } }
function paste() {
  if (!clip) return;
  const items = JSON.parse(clip).map(e => Object.assign(e, {id: uid(), x: e.x + 40, y: e.y + 40}));
  slide().els.push(...items); sel = items.map(i => i.id); clip = JSON.stringify(items); commit(); renderAll();
}
function order(how) {
  const els = slide().els, picked = els.filter(e => sel.includes(e.id)), rest = els.filter(e => !sel.includes(e.id));
  if (how === 'front') slide().els = [...rest, ...picked];
  else if (how === 'back') slide().els = [...picked, ...rest];
  else { const idx = els.indexOf(picked[0]); const j = clamp(idx + (how === 'forward' ? 1 : -1), 0, els.length - 1);
    const a = els.slice(); for (const p of picked) a.splice(a.indexOf(p), 1); a.splice(clamp(j, 0, a.length), 0, ...picked); slide().els = a; }
  commit(); renderAll();
}
function nudge(dx, dy) { for (const e of selEls()) { e.x += dx; e.y += dy; } commit(); renderStage(); renderThumbs(); }
function alignTo(how) {
  for (const e of selEls()) {
    const b = boxOf(e);
    if (how === 'left') e.x = 0 + 60; if (how === 'center') e.x = Math.round(W / 2 - b.w / 2); if (how === 'right') e.x = W - b.w - 60;
    if (how === 'top') e.y = 60; if (how === 'middle') e.y = Math.round(H / 2 - b.h / 2); if (how === 'bottom') e.y = H - b.h - 60;
  }
  commit(); renderAll();
}
function setProp(key, val) {
  const els = selEls(); if (!els.length) return;
  for (const e of els) e[key] = val;
  commit(); renderStage(); renderThumbs();
}
/* Slides */
function addSlide(kind = 'blank', at = cur + 1) {
  const s = newSlide(layout(kind)); s.bg = slide() ? slide().bg : 't:bg';
  if (kind === 'section') s.bg = 't:bg';
  doc.slides.splice(at, 0, s); go(at); commit(); renderAll();
}
function go(i) { if (editing) finishEdit(); cur = clamp(i, 0, doc.slides.length - 1); sel = []; renderAll(); }
function dupSlide() { const s = JSON.parse(JSON.stringify(slide())); s.id = uid(); s.els.forEach(e => e.id = uid()); doc.slides.splice(cur + 1, 0, s); cur++; sel = []; commit(); renderAll(); }
function delSlide() {
  if (doc.slides.length === 1) { doc.slides[0] = newSlide(); } else { doc.slides.splice(cur, 1); cur = clamp(cur, 0, doc.slides.length - 1); }
  sel = []; commit(); renderAll();
}
function moveSlide(from, to) {
  to = clamp(to, 0, doc.slides.length - 1); if (from === to) return;
  const [s] = doc.slides.splice(from, 1); doc.slides.splice(to, 0, s); cur = to; commit(); renderAll();
}
function setTheme(id) { doc.theme = id; commit(); renderAll(); }

/* ───────────── option bar ───────────── */
const ICON = {
  left: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 3h12M2 7h8M2 11h12M2 14h6" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
  center: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 3h12M4 7h8M2 11h12M5 14h6" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
  right: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 3h12M6 7h8M2 11h12M8 14h6" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>'
};
function btn(label, fn, opts = {}) { const b = el('button', {title: opts.title || '', innerHTML: label}); if (opts.on) b.classList.add('on'); b.onclick = fn; return b; }
function group(...kids) { return el('div', {className: 'grp'}, ...kids); }
function sepEl() { return el('div', {className: 'sep'}); }
function colorPicker(label, value, onChange, allowNone = false) {
  const wrapEl = el('div', {className: 'grp'});
  if (label) wrapEl.append(el('label', {textContent: label}));
  const sw = el('div', {className: 'grp'});
  for (const c of SWATCHES.slice(0, 8)) {
    const b = el('button', {className: 'swatch', title: c}); b.style.background = color(c);
    if (c === value) b.style.outline = '2px solid var(--accent)';
    b.onclick = () => onChange(c); sw.append(b);
  }
  const inp = el('input', {type: 'color'}); inp.value = /^#[0-9a-f]{6}$/i.test(color(value)) ? color(value) : '#000000';
  inp.oninput = () => onChange(inp.value);
  wrapEl.append(sw, inp);
  if (allowNone) wrapEl.append(btn('∅', () => onChange(null), {title: t('o.none')}));
  return wrapEl;
}
function numberField(label, value, min, max, onChange, step = 1) {
  const i = el('input', {type: 'number', value: Math.round(value * 100) / 100, min, max, step});
  i.onchange = () => onChange(clamp(parseFloat(i.value) || 0, min, max));
  i.addEventListener('keydown', ev => ev.stopPropagation());
  return group(el('label', {textContent: label}), i);
}
function renderOptbar() {
  const bar = $('#optbar'); bar.replaceChildren();
  const els = selEls();
  if (!els.length) {
    const s = slide();
    bar.append(el('span', {className: 'hint', textContent: t('o.noSel')}), el('div', {className: 'grow'}));
    bar.append(group(el('label', {textContent: t('o.bg')}), ...bgChoices()));
    const tr = el('select'); for (const x of TRANSITIONS) tr.append(el('option', {value: x, textContent: t('o.' + (x === 'slide' ? 'slide' : x)), selected: s.trans === x}));
    tr.onchange = () => { s.trans = tr.value; commit(); };
    bar.append(sepEl(), group(el('label', {textContent: t('o.transition')}), tr));
    return;
  }
  const e = els[0], one = els.length === 1;
  if (e.type === 'text') {
    const fs = el('select'); for (const [n, v] of FONTS) fs.append(el('option', {value: v, textContent: n, selected: e.font === v}));
    fs.onchange = () => setProp('font', fs.value);
    bar.append(group(fs), numberField(t('o.size'), e.size, 8, 400, v => setProp('size', v)), sepEl(),
      group(btn('<b>B</b>', () => setProp('bold', !e.bold), {on: e.bold, title: 'Ctrl+B'}), btn('<i>I</i>', () => setProp('italic', !e.italic), {on: e.italic, title: 'Ctrl+I'}),
        btn('<u>U</u>', () => setProp('underline', !e.underline), {on: e.underline, title: 'Ctrl+U'})), sepEl(),
      group(...['left', 'center', 'right'].map(a => btn(ICON[a], () => setProp('align', a), {on: e.align === a, title: t('al.' + a)}))), sepEl(),
      colorPicker(t('o.color'), e.color, v => setProp('color', v)));
  } else if (e.type === 'shape') {
    bar.append(colorPicker(t('o.fill'), e.fill, v => setProp('fill', v)), sepEl(),
      colorPicker(t('o.stroke'), e.stroke, v => { setProp('stroke', v); if (v && !e.sw) setProp('sw', 6); }, true),
      numberField(t('o.width'), e.sw || 0, 0, 80, v => setProp('sw', v)));
    if (e.shape === 'rect' || e.shape === 'round') bar.append(numberField(t('o.radius'), e.radius ?? 0, 0, 400, v => setProp('radius', v)));
  } else if (e.type === 'image') {
    const fit = el('select'); for (const f of ['contain', 'cover', 'stretch']) fit.append(el('option', {value: f, textContent: t('o.' + f), selected: e.fit === f}));
    fit.onchange = () => setProp('fit', fit.value);
    bar.append(group(el('label', {textContent: t('o.fit')}), fit), btn(t('o.replace'), () => pickImages(src => setProp('src', src.src))));
  }
  bar.append(sepEl(), numberField(t('o.opacity') + ' %', (e.op ?? 1) * 100, 0, 100, v => setProp('op', v / 100)),
    numberField(t('o.rotate') + ' °', e.rot || 0, 0, 360, v => setProp('rot', v)), sepEl(),
    group(...['left', 'center', 'right', 'top', 'middle', 'bottom'].map(a => btn({left: '⇤', center: '↔', right: '⇥', top: '⤒', middle: '↕', bottom: '⤓'}[a], () => alignTo(a), {title: t('o.align') + ': ' + t('al.' + a)}))),
    sepEl(), group(btn('⬒', () => order('front'), {title: t('a.front')}), btn('⬓', () => order('back'), {title: t('a.back')}),
      btn('⧉', dup, {title: t('a.duplicate') + ' (Ctrl+D)'}), btn('🗑', del, {title: t('a.delete')})));
}
function bgChoices() {
  const s = slide(), out = [];
  for (const c of ['t:bg', 't:text', 't:accent', 't:accent2', '#ffffff', '#000000']) {
    const b = el('button', {className: 'swatch'}); b.style.background = color(c); b.title = c;
    b.onclick = () => { s.bg = c; commit(); renderAll(); }; out.push(b);
  }
  const g = el('button', {className: 'swatch', title: 'Gradient'}); g.style.background = bgCss({c1: 't:accent', c2: 't:accent2', a: 135});
  g.onclick = () => { s.bg = {c1: 't:accent', c2: 't:accent2', a: 135}; commit(); renderAll(); }; out.push(g);
  const inp = el('input', {type: 'color'}); inp.value = typeof s.bg === 'string' && /^#/.test(color(s.bg)) ? color(s.bg) : '#ffffff';
  inp.oninput = () => { s.bg = inp.value; renderStage(); renderThumbs(); }; inp.onchange = () => { commit(); };
  out.push(inp);
  return out;
}

/* ───────────── left rail + flyouts ───────────── */
const TOOLS = [
  ['templates', 'tool.templates', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 10v10"/></svg>'],
  ['text', 'tool.text', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>'],
  ['shapes', 'tool.shapes', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="9" height="9" rx="1"/><circle cx="16" cy="8" r="5"/></svg>'],
  ['images', 'tool.images', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>'],
  ['themes', 'tool.themes', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.4"/><circle cx="12" cy="7" r="1.4"/><circle cx="16" cy="10" r="1.4"/></svg>'],
  ['notes', 'tool.notes', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5"/></svg>']
];
function renderTools() {
  const box = $('#tools'); box.replaceChildren();
  for (const [id, key, icon] of TOOLS) {
    const b = el('button', {innerHTML: icon + `<span>${t(key)}</span>`, title: t(key)});
    if (tool === id) b.classList.add('on');
    b.onclick = () => { tool = tool === id ? null : id; renderTools(); renderPanels(); fit(); };
    box.append(b);
  }
}
function previewOf(s, th = themeOf()) {
  const pv = el('div', {className: 'pv'}); pv.style.background = '#fff';
  const inner = slideNode(s, th, false); inner.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;overflow:hidden`;
  pv.append(inner);
  requestAnimationFrame(() => { const w = pv.clientWidth || 140; inner.style.transform = `scale(${w / W})`; });
  return pv;
}
function renderPanels() {
  const f = $('#flyout'); f.replaceChildren(); f.classList.toggle('open', !!tool);
  if (!tool) return;
  const th = themeOf();
  if (tool === 'text') {
    f.append(el('h3', {textContent: t('tool.text')}));
    for (const [k, label, size, bold] of [['title', t('f.title'), 40, true], ['heading', t('f.heading'), 28, true], ['body', t('f.body'), 18, false]]) {
      const b = el('button', {className: 'tbtn', textContent: label}); b.style.fontSize = size + 'px'; b.style.fontWeight = bold ? '700' : '400';
      b.onclick = () => addText(k); f.append(b);
    }
  } else if (tool === 'shapes') {
    f.append(el('h3', {textContent: t('tool.shapes')}));
    const g = el('div', {className: 'shapes'});
    for (const k of Object.keys(SHAPES)) {
      const b = el('button', {title: t('shape.' + k)});
      b.innerHTML = shapeSvg({shape: k, w: 60, h: 60, fill: '#888', sw: 0, radius: k === 'round' ? 14 : 0}, th).replace('<svg ', '<svg width="100%" height="100%" ');
      b.onclick = () => addShape(k); g.append(b);
    }
    f.append(g);
  } else if (tool === 'images') {
    f.append(el('h3', {textContent: t('tool.images')}), btn(t('f.addImage'), () => pickImages(addImage), {}));
    f.lastChild.className = 'primary big';
    f.append(el('div', {className: 'drop-hint', textContent: t('f.dropImage')}));
  } else if (tool === 'templates') {
    f.append(el('h3', {textContent: t('tool.templates')}));
    const g = el('div', {className: 'grid'});
    for (const k of ['title', 'content', 'two', 'imgtext', 'quote', 'section', 'big', 'blank']) {
      const s = newSlide(layout(k).map(e => (e.ph ? Object.assign(e, {ph: false}) : e))); s.bg = k === 'blank' ? 't:bg' : 't:bg';
      const c = el('div', {className: 'card', title: t('lay.' + k)}, previewOf(s), el('div', {textContent: t('lay.' + k)}));
      c.onclick = () => addSlide(k); g.append(c);
    }
    f.append(g);
  } else if (tool === 'themes') {
    f.append(el('h3', {textContent: t('tool.themes')}));
    const g = el('div', {className: 'grid'});
    for (const [id, tm] of Object.entries(THEMES)) {
      const s = newSlide([textEl({x: 80, y: 280, w: 1700, size: 220, bold: true, font: 't:head', text: 'Aa'}),
        shapeEl('rect', {x: 80, y: 700, w: 700, h: 40, fill: 't:accent'}), shapeEl('rect', {x: 80, y: 790, w: 440, h: 40, fill: 't:accent2'})]);
      const c = el('div', {className: 'card', title: tm.name}, previewOf(s, tm), el('div', {textContent: tm.name}));
      if (doc.theme === id) c.style.borderColor = 'var(--accent)';
      c.onclick = () => setTheme(id); g.append(c);
    }
    f.append(g);
  } else if (tool === 'notes') {
    f.append(el('h3', {textContent: t('n.title')}));
    const ta = el('textarea', {placeholder: t('n.ph'), value: slide().notes || ''});
    ta.addEventListener('keydown', ev => ev.stopPropagation());
    ta.oninput = () => { slide().notes = ta.value; dirty = true; autosave(); };
    ta.onchange = () => commit();
    f.append(ta);
  }
}

/* ───────────── filmstrip ───────────── */
function renderThumbs() {
  const fs = $('#filmstrip'); fs.replaceChildren();
  doc.slides.forEach((s, i) => {
    const th = el('div', {className: 'thumb' + (i === cur ? ' cur' : ''), draggable: true}, previewOf(s), el('span', {className: 'n', textContent: i + 1}));
    th.onclick = () => go(i);
    th.ondragstart = ev => { ev.dataTransfer.setData('text/slide', String(i)); ev.dataTransfer.effectAllowed = 'move'; };
    th.ondragover = ev => { if (ev.dataTransfer.types.includes('text/slide')) { ev.preventDefault(); th.classList.add('dragover'); } };
    th.ondragleave = () => th.classList.remove('dragover');
    th.ondrop = ev => { ev.preventDefault(); th.classList.remove('dragover'); const from = +ev.dataTransfer.getData('text/slide'); if (!isNaN(from)) moveSlide(from, i); };
    th.oncontextmenu = () => { cur = i; };
    fs.append(th);
  });
  const add = el('button', {className: 'addslide', textContent: '+', title: t('a.newSlide') + ' (Ctrl+M)'});
  add.onclick = () => addSlide('content');
  fs.append(add);
  $('#stSlide').textContent = t('st.slide', {n: cur + 1, m: doc.slides.length});
}

/* ───────────── images ───────────── */
function readImage(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('read'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error('decode'));
      img.onload = () => {
        // Large photos are scaled down so presentation files stay small.
        const k = Math.min(1, 2400 / Math.max(img.width, img.height));
        if (k === 1 && file.size < 1.5e6) return res({src: fr.result, w: img.width, h: img.height});
        const c = el('canvas', {width: Math.round(img.width * k), height: Math.round(img.height * k)});
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const png = /png|gif|svg|webp/.test(file.type);
        res({src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88), w: c.width, h: c.height});
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
const addImage = r => addEl(imageEl(r.src, r.w, r.h));
function pickImages(cb) {
  const inp = $('#fileImg'); inp.value = '';
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { cb(await readImage(f)); } catch (e) { toast(t('toast.imgFail')); } };
  inp.click();
}
document.addEventListener('paste', async ev => {
  if (editing) return;
  const files = [...(ev.clipboardData ? ev.clipboardData.files : [])];
  if (files.length) { ev.preventDefault(); addImages(files); }
});
document.addEventListener('dragover', ev => { if (ev.dataTransfer && [...ev.dataTransfer.types].includes('Files')) ev.preventDefault(); });
document.addEventListener('drop', ev => {
  if (ev.dataTransfer && ev.dataTransfer.files.length) { ev.preventDefault(); addImages([...ev.dataTransfer.files]); }
});

/* ───────────── files ───────────── */
function toast(msg) { const n = $('#toast'); n.textContent = msg; n.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => n.classList.remove('show'), 3200); }
const askDiscard = async () => !dirty || (invoke ? invoke('confirm', {title: t('confirm.title'), message: t('confirm.discard'), okLabel: t('confirm.ok'), cancelLabel: t('confirm.cancel')}) : confirm(t('confirm.discard')));
function loadDoc(text, info) {
  const o = JSON.parse(text);
  if (!o || !Array.isArray(o.slides) || !o.slides.length) throw new Error('not a presentation');
  doc = o; cur = 0; sel = []; file = {path: info.path || null, name: info.name || null}; dirty = false;
  hist.stack = []; hist.i = -1; commit(false); renderAll();
}
async function doNew() { if (!(await askDiscard())) return; doc = newDoc(); cur = 0; sel = []; file = {path: null, name: null}; dirty = false; hist.stack = []; hist.i = -1; commit(false); renderAll(); }
async function doOpen() {
  if (!(await askDiscard())) return;
  if (invoke) {
    try { const docs = await invoke('open_files'); if (docs.length) { loadDoc(docs[0].content, docs[0]); toast(t('toast.opened', {name: docs[0].name})); } }
    catch (e) { toast(t('toast.openFail', {e})); }
  } else {
    const inp = $('#fileDoc'); inp.value = '';
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { loadDoc(await f.text(), {name: f.name}); toast(t('toast.opened', {name: f.name})); } catch (e) { toast(t('toast.openFail', {e})); } };
    inp.click();
  }
}
const fileTitle = () => file.name || ((doc.title || t('untitled')) + '.slides');
async function doSave(as) {
  const content = JSON.stringify(doc);
  try {
    if (invoke) {
      const r = await invoke('save_file', {path: as ? null : file.path, suggestedName: fileTitle(), content});
      if (!r) return false; file = {path: r.path, name: r.name};
    } else {
      downloadBlob(new Blob([content], {type: 'application/json'}), fileTitle()); file.name = fileTitle();
    }
    dirty = false; syncUi(); toast(t('toast.saved', {name: file.name})); return true;
  } catch (e) { toast(t('toast.saveFail', {e})); return false; }
}
function downloadBlob(blob, name) {
  const a = el('a', {href: URL.createObjectURL(blob), download: name}); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* Standalone HTML slideshow: the slides as static HTML + a tiny navigation script (no dependencies). */
function exportHtml() {
  const th = themeOf(), slides = doc.slides.map(s => {
    const r = slideNode(s, th, true); r.className = 'slide'; return r.outerHTML;
  });
  const title = (doc.title || file.name || 'Presentation').replace(/[<&]/g, '');
  const trans = JSON.stringify(doc.slides.map(s => s.trans || 'none'));
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:${SANS}}
#s{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
.slide{position:absolute;inset:0;display:none;overflow:hidden}.slide.on{display:block}.el{position:absolute}
.el.text{white-space:pre-wrap;overflow-wrap:break-word;line-height:1.2}.el svg{width:100%;height:100%;display:block;overflow:visible}
.el.image{background-repeat:no-repeat;background-position:center}
@keyframes fade{from{opacity:0}to{opacity:1}}@keyframes slide{from{transform:translateX(120px);opacity:0}to{transform:none;opacity:1}}
@keyframes zoom{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}
#n{position:fixed;right:12px;bottom:8px;color:#fff;opacity:.5;font-size:13px}</style></head>
<body><div id="s">${slides.join('')}</div><div id="n"></div>
<script>(function(){var T=${trans},S=document.querySelectorAll('.slide'),i=0,s=document.getElementById('s'),n=document.getElementById('n');
function fit(){var k=Math.min(innerWidth/${W},innerHeight/${H});s.style.transform='scale('+k+')';s.style.left=(innerWidth-${W}*k)/2+'px';s.style.top=(innerHeight-${H}*k)/2+'px'}
function show(j){i=Math.max(0,Math.min(S.length-1,j));S.forEach(function(x,k){x.classList.toggle('on',k===i);x.style.animation=''});var a=T[i];if(a&&a!=='none'){S[i].style.animation=a+' .45s ease'}n.textContent=(i+1)+' / '+S.length;location.hash=i+1}
addEventListener('resize',fit);addEventListener('keydown',function(e){if(/ArrowRight|PageDown| |Enter/.test(e.key))show(i+1);else if(/ArrowLeft|PageUp|Backspace/.test(e.key))show(i-1);else if(e.key==='Home')show(0);else if(e.key==='End')show(S.length-1);else if(e.key==='f')document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()});
addEventListener('click',function(e){show(e.clientX<innerWidth/4?i-1:i+1)});fit();show((parseInt(location.hash.slice(1))||1)-1)})();</script></body></html>`;
  return html;
}
async function doExportHtml() {
  const html = exportHtml(), name = (file.name || fileTitle()).replace(/\.slides$/i, '') + '.html';
  try {
    if (invoke) {
      const p = await invoke('save_bytes', {suggestedName: name, filterName: 'HTML', extensions: ['html'], bytes: Array.from(new TextEncoder().encode(html))});
      if (p) toast(t('toast.exported', {path: p}));
    } else { downloadBlob(new Blob([html], {type: 'text/html'}), name); }
  } catch (e) { toast(t('toast.saveFail', {e})); }
}
function doExportPdf() {
  const root = $('#printroot'), th = themeOf(); root.replaceChildren();
  for (const s of doc.slides) { const p = el('div', {className: 'pslide'}); p.append(slideNode(s, th, true)); root.append(p); }
  toast(t('toast.printHint'));
  setTimeout(() => { (invoke ? invoke('print_page').catch(e => toast(String(e))) : window.print()); }, 400);
}

/* ───────────── present mode ───────────── */
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
  pslide.replaceChildren(slideNode(s, themeOf(), true));
  pslide.style.animation = 'none'; void pslide.offsetWidth;
  if (animate && s.trans && s.trans !== 'none') pslide.style.animation = `t-${s.trans} .45s ease`;
  $('#pbar').style.width = ((pi + 1) / doc.slides.length * 100) + '%';
  $('#pnum').textContent = `${pi + 1} / ${doc.slides.length}`;
  pres.classList.remove('blank');
}
function present(from = 0) {
  if (editing) finishEdit();
  presenting = true; pres.classList.add('on'); presFit(); presShow(from, false);
  const d = document.documentElement; if (d.requestFullscreen) d.requestFullscreen().catch(() => {});
}
function endPresent() {
  if (!presenting) return; presenting = false; pres.classList.remove('on');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  go(pi);
}
const pNext = () => { if (pi < doc.slides.length - 1) presShow(pi + 1); else endPresent(); };
const pPrev = () => presShow(pi - 1);
$('#pNext').onclick = e => { e.stopPropagation(); pNext(); };
$('#pPrev').onclick = e => { e.stopPropagation(); pPrev(); };
$('#pBlank').onclick = e => { e.stopPropagation(); pres.classList.toggle('blank'); };
$('#pExit').onclick = e => { e.stopPropagation(); endPresent(); };
pres.addEventListener('click', ev => { if (ev.target.closest('.pctl')) return; (ev.clientX < innerWidth / 5) ? pPrev() : pNext(); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && presenting) { presenting = false; pres.classList.remove('on'); go(pi); } });

/* ───────────── menus ───────────── */
const MENUS = () => ({
  file: [[t('a.new'), doNew, 'Ctrl+N'], [t('a.open'), doOpen, 'Ctrl+O'], null, [t('a.save'), () => doSave(false), 'Ctrl+S'], [t('a.saveAs'), () => doSave(true), 'Ctrl+Shift+S'],
    null, [t('a.exportPdf'), doExportPdf, 'Ctrl+P'], [t('a.exportHtml'), doExportHtml]],
  edit: [[t('a.undo'), undo, 'Ctrl+Z'], [t('a.redo'), redo, 'Ctrl+Y'], null, [t('a.cut'), () => { copy(); del(); }, 'Ctrl+X'], [t('a.copy'), copy, 'Ctrl+C'],
    [t('a.paste'), paste, 'Ctrl+V'], [t('a.duplicate'), dup, 'Ctrl+D'], [t('a.delete'), del, 'Del'], [t('a.selectAll'), () => { sel = slide().els.map(e => e.id); renderOverlay(); }, 'Ctrl+A'],
    null, [t('a.front'), () => order('front')], [t('a.forward'), () => order('forward'), 'Ctrl+]'], [t('a.backward'), () => order('backward'), 'Ctrl+['], [t('a.back'), () => order('back')]],
  slide: [[t('a.newSlide'), () => addSlide('content'), 'Ctrl+M'], [t('a.dupSlide'), dupSlide], [t('a.delSlide'), delSlide], null,
    [t('a.slideLeft'), () => moveSlide(cur, cur - 1)], [t('a.slideRight'), () => moveSlide(cur, cur + 1)], null,
    [t('a.fromStart'), () => present(0), 'F5'], [t('a.fromCurrent'), () => present(cur), 'Shift+F5']],
  view: [[(settings.snap ? '✓ ' : '') + t('a.snap'), () => { settings.snap = !settings.snap; saveSettings(); }]],
  settings: [[t('a.theme') + ': ' + (settings.ui === 'dark' ? '☾ → ☀' : '☀ → ☾'), () => { settings.ui = settings.ui === 'dark' ? 'light' : 'dark'; applyUi(); saveSettings(); }],
    [t('a.language') + ': ' + (lang === 'de' ? 'Deutsch → English' : 'English → Deutsch'), () => { lang = lang === 'de' ? 'en' : 'de'; store.set('lang', lang); applyLang(); renderAll(); }],
    [(settings.autohide ? '✓ ' : '') + t('a.autohide'), () => { settings.autohide = !settings.autohide; applyUi(); saveSettings(); }]]
});
function buildMenus() {
  const defs = MENUS();
  document.querySelectorAll('.menu').forEach(m => {
    const drop = $('.drop', m); drop.replaceChildren();
    for (const it of defs[m.dataset.menu]) {
      if (!it) { drop.append(el('hr')); continue; }
      const b = el('button', {innerHTML: `<span>${it[0]}</span><span class="k">${it[2] || ''}</span>`});
      b.onclick = () => { m.classList.remove('open'); it[1](); buildMenus(); };
      drop.append(b);
    }
  });
}
document.addEventListener('click', ev => {
  const m = ev.target.closest && ev.target.closest('.menu>button');
  document.querySelectorAll('.menu.open').forEach(x => { if (!m || x !== m.parentElement) x.classList.remove('open'); });
  if (m) { m.parentElement.classList.toggle('open'); }
});
const saveSettings = () => store.set('settings', settings);
function applyUi() { document.documentElement.dataset.theme = settings.ui; if (window.AutoHide) AutoHide.set(!!settings.autohide); }
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i]').forEach(n => { n.textContent = t(n.dataset.i); });
  buildMenus(); renderTools();
}

/* Native context menu on elements and slides */
Native.setProvider(ev => {
  const target = ev.target.closest && ev.target.closest('.el');
  if (target && stage.contains(target)) {
    const id = target.dataset.id; if (!sel.includes(id)) { sel = [id]; renderOverlay(); }
    return [{id: 'cm:copy', label: t('a.copy'), accel: 'Ctrl+C'}, {id: 'cm:cut', label: t('a.cut'), accel: 'Ctrl+X'}, {id: 'cm:paste', label: t('a.paste'), accel: 'Ctrl+V', enabled: !!clip},
      {id: 'cm:dup', label: t('a.duplicate'), accel: 'Ctrl+D'}, null, {id: 'cm:front', label: t('a.front')}, {id: 'cm:back', label: t('a.back')}, null, {id: 'cm:del', label: t('a.delete'), accel: 'Delete'}];
  }
  if (ev.target.closest && ev.target.closest('.thumb')) return [{id: 'cm:newslide', label: t('a.newSlide')}, {id: 'cm:dupslide', label: t('a.dupSlide')}, {id: 'cm:delslide', label: t('a.delSlide')}];
  return null;
});
Native.setHandler(id => ({
  'cm:copy': copy, 'cm:cut': () => { copy(); del(); }, 'cm:paste': paste, 'cm:dup': dup, 'cm:front': () => order('front'),
  'cm:back': () => order('back'), 'cm:del': del, 'cm:newslide': () => addSlide('content'), 'cm:dupslide': dupSlide, 'cm:delslide': delSlide
}[id] || (() => {}))());

/* ───────────── keyboard ───────────── */
document.addEventListener('keydown', ev => {
  const ctrl = ev.ctrlKey || ev.metaKey, k = ev.key;
  if (presenting) {
    if (/^(ArrowRight|ArrowDown|PageDown| |Enter)$/.test(k)) { ev.preventDefault(); pNext(); }
    else if (/^(ArrowLeft|ArrowUp|PageUp|Backspace)$/.test(k)) { ev.preventDefault(); pPrev(); }
    else if (k === 'Home') presShow(0); else if (k === 'End') presShow(doc.slides.length - 1);
    else if (k === 'Escape') endPresent(); else if (k.toLowerCase() === 'b' || k === '.') pres.classList.toggle('blank');
    return;
  }
  const inField = ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA' || ev.target.tagName === 'SELECT' || ev.target.isContentEditable);
  if (ctrl && k.toLowerCase() === 's') { ev.preventDefault(); doSave(ev.shiftKey); return; }
  if (ctrl && k.toLowerCase() === 'o') { ev.preventDefault(); doOpen(); return; }
  if (ctrl && k.toLowerCase() === 'n') { ev.preventDefault(); doNew(); return; }
  if (ctrl && k.toLowerCase() === 'p') { ev.preventDefault(); doExportPdf(); return; }
  if (k === 'F5') { ev.preventDefault(); present(ev.shiftKey ? cur : 0); return; }
  if (inField) return;
  if (ctrl && k.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
  else if (ctrl && k.toLowerCase() === 'y') { ev.preventDefault(); redo(); }
  else if (ctrl && k.toLowerCase() === 'c') { ev.preventDefault(); copy(); }
  else if (ctrl && k.toLowerCase() === 'x') { ev.preventDefault(); copy(); del(); }
  else if (ctrl && k.toLowerCase() === 'v') { ev.preventDefault(); if (clip) paste(); else Native.clipboardRead().then(tx => { if (tx && tx.startsWith('slides-studio:')) { clip = tx.slice(14); paste(); } }).catch(() => {}); }
  else if (ctrl && k.toLowerCase() === 'd') { ev.preventDefault(); dup(); }
  else if (ctrl && k.toLowerCase() === 'a') { ev.preventDefault(); sel = slide().els.map(e => e.id); renderOverlay(); }
  else if (ctrl && k.toLowerCase() === 'm') { ev.preventDefault(); addSlide('content'); }
  else if (ctrl && k.toLowerCase() === 'b' && sel.length) { ev.preventDefault(); const e = selEls()[0]; if (e.type === 'text') setProp('bold', !e.bold); }
  else if (ctrl && k.toLowerCase() === 'i' && sel.length) { ev.preventDefault(); const e = selEls()[0]; if (e.type === 'text') setProp('italic', !e.italic); }
  else if (ctrl && k === ']') { ev.preventDefault(); order(ev.shiftKey ? 'front' : 'forward'); }
  else if (ctrl && k === '[') { ev.preventDefault(); order(ev.shiftKey ? 'back' : 'backward'); }
  else if (k === 'Delete' || k === 'Backspace') { if (sel.length) { ev.preventDefault(); del(); } else if (k === 'Delete') delSlide(); }
  else if (k === 'Enter' && sel.length === 1 && selEls()[0] && selEls()[0].type === 'text') { ev.preventDefault(); startEdit(selEls()[0]); }
  else if (k === 'Escape') { sel = []; renderOverlay(); renderPanels(); }
  else if (/^Arrow/.test(k)) {
    ev.preventDefault();
    const s = ev.shiftKey ? 20 : 2;
    if (sel.length) nudge(k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0, k === 'ArrowUp' ? -s : k === 'ArrowDown' ? s : 0);
    else go(cur + (k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 1));
  }
});

/* ───────────── bootstrap ───────────── */
function syncUi() {
  const name = file.name || t('untitled');
  document.title = `${name}${dirty ? ' •' : ''} — Slides Studio`;
  $('#docTitle').innerHTML = `<b></b>${dirty ? ' •' : ''}`; $('#docTitle b').textContent = name;
  $('#stSaved').textContent = dirty ? t('st.unsaved') : t('st.saved');
  $('#btnUndo').disabled = hist.i <= 0; $('#btnRedo').disabled = hist.i >= hist.stack.length - 1;
}
function renderAll() { renderStage(); renderThumbs(); renderPanels(); syncUi(); }
$('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo; $('#btnPresent').onclick = () => present(0);
window.addEventListener('resize', () => { fit(); if (presenting) presFit(); });
new ResizeObserver(fit).observe(wrap);

function init() {
  doc = newDoc();
  let restored = false;
  try { const a = JSON.parse(localStorage.getItem('slides.autosave') || 'null'); if (a && a.doc && a.doc.slides && a.doc.slides.length) { doc = a.doc; file = a.file || file; restored = true; } } catch (e) {}
  applyUi(); applyLang(); fit(); commit(false); dirty = false; renderAll();
  if (restored) toast(t('toast.restored'));
  if (invoke) {
    invoke('initial_files').then(docs => { if (docs.length) { try { loadDoc(docs[0].content, docs[0]); } catch (e) { toast(t('toast.openFail', {e})); } } }).catch(() => {});
    if (window.__TAURI__.event) window.__TAURI__.event.listen('open-docs', ev => { const d = (ev.payload || [])[0]; if (d) { try { loadDoc(d.content, d); } catch (e) { toast(t('toast.openFail', {e})); } } });
  }
  window.addEventListener('beforeunload', e => { if (dirty && !invoke) { e.preventDefault(); e.returnValue = ''; } });
}
// Test hook (also handy for scripting): the editor state is not exposed in release use beyond this read-only view.
window.__slides = {get doc() { return doc; }, get sel() { return sel; }, get cur() { return cur; }, addSlide, addShape, addText, present, exportHtml};
init();
})();
