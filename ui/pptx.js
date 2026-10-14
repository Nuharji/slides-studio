/* PPTX export: builds a minimal PresentationML package (a ZIP of XML parts) with no dependencies.
   PptxExport.build({doc, theme, color, heights, images}) → Uint8Array
     doc      the presentation (1920×1080 px slides)
     theme    the active theme object (colors/fonts as hex / CSS font stacks)
     color    (token|hex, theme) → "#rrggbb"
     heights  {elementId: measured height in px} for auto-height elements (text, tables)
     images   {elementId: {ext: 'png'|'jpeg', bytes: Uint8Array, w, h}} decoded pictures
   Text, shapes, pictures, tables, backgrounds and rotation/opacity are carried over; transitions and speaker
   notes are not. */
(() => {
'use strict';
const EMU = 6350;                 // 1 slide px = 6350 EMU (1920 px = 13.333 in)
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const emu = px => Math.round(px * EMU);
const hex = c => (/^#[0-9a-f]{6}$/i.test(c) ? c.slice(1) : /^#[0-9a-f]{3}$/i.test(c) ? c.slice(1).replace(/./g, m => m + m) : '000000').toUpperCase();
const family = stack => { const m = String(stack || '').match(/^\s*"([^"]+)"|^\s*([^,]+)/); return (m && (m[1] || m[2]) || 'Calibri').trim(); };

/* ── ZIP (stored, no compression) ── */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files) {                    // files: [{name, data: Uint8Array}]
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true);
    lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(offset + cdSize + 22); let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

/* ── DrawingML pieces ── */
const solid = (rgb, alpha) => `<a:solidFill><a:srgbClr val="${hex(rgb)}">${alpha != null && alpha < 1 ? `<a:alpha val="${Math.round(alpha * 100000)}"/>` : ''}</a:srgbClr></a:solidFill>`;
const xfrm = (e, h) => `<a:xfrm${e.rot ? ` rot="${Math.round(e.rot * 60000)}"` : ''}><a:off x="${emu(e.x)}" y="${emu(e.y)}"/><a:ext cx="${emu(e.w)}" cy="${emu(h)}"/></a:xfrm>`;
const PRST = {rect: 'rect', round: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', star: 'star5', arrow: 'rightArrow', line: 'line'};

function runs(text, o) {                 // one a:p per line
  return String(text).split('\n').map(line => {
    const rPr = `<a:rPr lang="de-DE" sz="${Math.max(100, Math.round(o.size * 50))}"${o.bold ? ' b="1"' : ''}${o.italic ? ' i="1"' : ''}${o.underline ? ' u="sng"' : ''} dirty="0">` +
      `${solid(o.color, o.alpha)}<a:latin typeface="${esc(o.font)}"/><a:cs typeface="${esc(o.font)}"/></a:rPr>`;
    return `<a:p><a:pPr algn="${{center: 'ctr', right: 'r'}[o.align] || 'l'}"/>` +
      (line ? `<a:r>${rPr}<a:t>${esc(line)}</a:t></a:r>` : `<a:endParaRPr lang="de-DE" sz="${Math.max(100, Math.round(o.size * 50))}"/>`) + '</a:p>';
  }).join('');
}

function build({doc, theme, color, heights = {}, images = {}}) {
  const enc = new TextEncoder(), files = [], add = (name, text) => files.push({name, data: typeof text === 'string' ? enc.encode(text) : text});
  const col = c => color(c, theme), font = f => family(f && f.startsWith('t:') ? theme[f.slice(2)] : (f || theme.body));
  const slides = doc.slides, W = 12192000, H = 6858000;
  let mediaN = 0;
  const grpHeader = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

  slides.forEach((s, si) => {
    let id = 2, body = '';
    const rels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'];
    for (const e of s.els) {
      if (e.ph) continue;                                        // untouched placeholders stay out of the file
      const alpha = e.op ?? 1, name = esc(e.type + ' ' + id);
      if (e.type === 'text') {
        const h = heights[e.id] || e.size * 1.25;
        body += `<p:sp><p:nvSpPr><p:cNvPr id="${id++}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(e, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
          `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>` +
          runs(e.text, {size: e.size, bold: e.bold, italic: e.italic, underline: e.underline, color: col(e.color), font: font(e.font), align: e.align, alpha}) +
          '</p:txBody></p:sp>';
      } else if (e.type === 'shape') {
        const prst = PRST[e.shape] || 'rect', fill = solid(col(e.fill), alpha);
        const adj = e.shape === 'round' ? `<a:avLst><a:gd name="adj" fmla="val ${Math.round(Math.min(50000, (e.radius ?? 24) / Math.max(1, Math.min(e.w, e.h)) * 100000))}"/></a:avLst>` : '<a:avLst/>';
        const ln = e.shape === 'line' ? `<a:ln w="${emu(Math.max(2, e.sw || 8))}" cap="rnd">${solid(col(e.fill), alpha)}</a:ln>`
          : e.stroke && e.sw ? `<a:ln w="${emu(e.sw)}">${solid(col(e.stroke), alpha)}</a:ln>` : '<a:ln><a:noFill/></a:ln>';
        body += `<p:sp><p:nvSpPr><p:cNvPr id="${id++}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(e, e.h)}<a:prstGeom prst="${prst}">${adj}</a:prstGeom>` +
          `${e.shape === 'line' ? '<a:noFill/>' : fill}${ln}</p:spPr><p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:endParaRPr lang="de-DE"/></a:p></p:txBody></p:sp>`;
      } else if (e.type === 'image' && images[e.id]) {
        const im = images[e.id]; mediaN++;
        const file = `image${mediaN}.${im.ext}`, rid = 'rId' + (rels.length + 1);
        add('ppt/media/' + file, im.bytes);
        rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${file}"/>`);
        // contain = letterbox inside the box, cover = crop, stretch = fill
        let box = {x: e.x, y: e.y, w: e.w, h: e.h}, crop = '';
        if (e.fit !== 'stretch' && im.w && im.h) {
          const k = e.fit === 'cover' ? Math.max(e.w / im.w, e.h / im.h) : Math.min(e.w / im.w, e.h / im.h);
          if (e.fit === 'cover') {
            const cw = e.w / (im.w * k), ch = e.h / (im.h * k);
            crop = `<a:srcRect l="${Math.round((1 - cw) / 2 * 100000)}" r="${Math.round((1 - cw) / 2 * 100000)}" t="${Math.round((1 - ch) / 2 * 100000)}" b="${Math.round((1 - ch) / 2 * 100000)}"/>`;
          } else {
            const w = im.w * k, h = im.h * k; box = {x: e.x + (e.w - w) / 2, y: e.y + (e.h - h) / 2, w, h};
          }
        }
        body += `<p:pic><p:nvPicPr><p:cNvPr id="${id++}" name="${name}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
          `<p:blipFill><a:blip r:embed="${rid}">${alpha < 1 ? `<a:alphaModFix amt="${Math.round(alpha * 100000)}"/>` : ''}</a:blip>${crop}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
          `<p:spPr>${xfrm(Object.assign({}, e, box), box.h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
      } else if (e.type === 'table') {
        const rows = e.cells.length, cols = e.cells[0].length, colW = emu(e.w / cols), total = heights[e.id] || rows * e.size * 1.9, rowH = emu(total / rows);
        const accent = col(e.fill), text = col(e.color);
        let tr = '';
        e.cells.forEach((row, r) => {
          const head = e.hdr && r === 0;
          tr += `<a:tr h="${rowH}">` + row.map(c => {
            const fill = head ? accent : (r % 2 ? 'F2F2F2' : 'FFFFFF');
            return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${runs(c, {size: e.size, bold: head, color: head ? '#ffffff' : text, font: font('t:body'), align: 'left', alpha: 1})}</a:txBody>` +
              `<a:tcPr marL="${emu(14)}" marR="${emu(14)}" marT="${emu(8)}" marB="${emu(8)}" anchor="ctr">` +
              ['L', 'R', 'T', 'B'].map(s => `<a:ln${s} w="9525"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:ln${s}>`).join('') + `${solid(fill)}</a:tcPr></a:tc>`;
          }).join('') + '</a:tr>';
        });
        body += `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id++}" name="${name}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>` +
          `<p:xfrm><a:off x="${emu(e.x)}" y="${emu(e.y)}"/><a:ext cx="${emu(e.w)}" cy="${emu(total)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">` +
          `<a:tbl><a:tblPr firstRow="${e.hdr ? 1 : 0}" bandRow="1"/><a:tblGrid>${`<a:gridCol w="${colW}"/>`.repeat(cols)}</a:tblGrid>${tr}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
      }
    }
    // Slide background: solid, or a two-stop gradient.
    let bg;
    if (s.bg && typeof s.bg === 'object') {
      bg = `<p:bg><p:bgPr><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0">${solid(col(s.bg.c1)).replace(/<\/?a:solidFill>/g, '')}</a:gs><a:gs pos="100000">${solid(col(s.bg.c2)).replace(/<\/?a:solidFill>/g, '')}</a:gs></a:gsLst><a:lin ang="${Math.round(((s.bg.a ?? 135) % 360) * 60000)}" scaled="0"/></a:gradFill><a:effectLst/></p:bgPr></p:bg>`;
    } else bg = `<p:bg><p:bgPr>${solid(col(s.bg))}<a:effectLst/></p:bgPr></p:bg>`;
    add(`ppt/slides/slide${si + 1}.xml`, `${XML}<p:sld ${NS}><p:cSld>${bg}<p:spTree>${grpHeader}${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    add(`ppt/slides/_rels/slide${si + 1}.xml.rels`, `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
  });

  const th = theme, scheme = (n, v) => `<a:${n}><a:srgbClr val="${hex(v)}"/></a:${n}>`;
  const fillLst = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3);
  add('ppt/theme/theme1.xml', `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Studio"><a:themeElements>` +
    `<a:clrScheme name="Studio">${scheme('dk1', th.text)}${scheme('lt1', th.bg)}${scheme('dk2', th.text)}${scheme('lt2', th.bg)}${scheme('accent1', th.accent)}${scheme('accent2', th.accent2)}` +
    `${scheme('accent3', th.accent)}${scheme('accent4', th.accent2)}${scheme('accent5', th.accent)}${scheme('accent6', th.accent2)}${scheme('hlink', th.accent)}${scheme('folHlink', th.accent2)}</a:clrScheme>` +
    `<a:fontScheme name="Studio"><a:majorFont><a:latin typeface="${esc(family(th.head))}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${esc(family(th.body))}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="Studio"><a:fillStyleLst>${fillLst}</a:fillStyleLst><a:lnStyleLst>${'<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3)}</a:lnStyleLst>` +
    `<a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${fillLst}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);

  add('ppt/slideLayouts/slideLayout1.xml', `${XML}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${grpHeader}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  add('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  add('ppt/slideMasters/slideMaster1.xml', `${XML}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${grpHeader}</p:spTree></p:cSld>` +
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
    `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`);
  add('ppt/slideMasters/_rels/slideMaster1.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`);

  const n = slides.length;
  add('ppt/presentation.xml', `${XML}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>` +
    slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('') + `</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  add('ppt/_rels/presentation.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
    slides.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>`);
  add('_rels/.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);
  add('[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>` +
    `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
    slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('') + '</Types>');

  // [Content_Types].xml first, as Office expects.
  files.sort((a, b) => (a.name === '[Content_Types].xml' ? -1 : b.name === '[Content_Types].xml' ? 1 : 0));
  return zip(files);
}

window.PptxExport = {build, crc32, zip};
})();
