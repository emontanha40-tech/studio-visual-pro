import { crc32 } from 'node:zlib';
import { escapeXML } from '../engine.mjs';

export function printGeometry(piece) {
  const { scale, dpi, bleedMm } = piece.print;
  const width = piece.width / scale;
  const height = piece.height / scale;
  const bleed = bleedMm / scale;
  const artWidth = width + 2 * bleed;
  const artHeight = height + 2 * bleed;
  const pixels = (mm) => Math.round(mm * dpi / 25.4);
  return { width, height, bleed, artWidth, artHeight, pixelWidth: pixels(artWidth), pixelHeight: pixels(artHeight) };
}

function withPngDensity(png, dpi) {
  const chunks = [png.subarray(0, 8)];
  const density = Buffer.alloc(21);
  density.writeUInt32BE(9);
  density.write('pHYs', 4);
  const ppm = Math.round(dpi / 0.0254);
  density.writeUInt32BE(ppm, 8);
  density.writeUInt32BE(ppm, 12);
  density[16] = 1;
  density.writeUInt32BE(crc32(density.subarray(4, 17)), 17);
  for (let offset = 8; offset < png.length;) {
    const end = offset + png.readUInt32BE(offset) + 12;
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type !== 'pHYs') chunks.push(png.subarray(offset, end));
    if (type === 'IHDR') chunks.push(density);
    offset = end;
  }
  return Buffer.concat(chunks);
}

function layout(piece, identity, side, g) {
  const form = piece.id === 'prayer' || piece.id === 'decision';
  const back = side === 'verso';
  const { width, height, bleed, artWidth, artHeight } = g;
  const margin = Math.min(width, height) * 0.09;
  const unit = Math.min(width, height);
  const { colors: c, typography: t } = identity.kit;
  const title = form ? piece.name : back ? identity.marca : identity.headlines.hero;
  const detail = !form && (back || !piece.print.provisional) ? identity.headlines.subtitulo : '';
  const event = piece.id === 'invitation' ? [identity.evento.data, identity.evento.local].filter(Boolean).join(' · ') : '';
  const fields = piece.id === 'decision' ? ['Nome', 'Contato', 'Minha decisão'] : ['Nome (opcional)', 'Pedido de oração', '', '', ''];
  const lines = form ? fields.map(label => `<div class="line">${escapeXML(label)}</div>`).join('') : '';
  const headingSize = Math.min(unit * (form ? .085 : .14), height * .17);
  const ink = form ? '#171717' : c.text;
  const label = !back || form ? `<p class="brand">${escapeXML(identity.marca)}</p>` : '';
  const body = `<style>
    * { box-sizing:border-box } html,body { margin:0; overflow:hidden }
    svg { display:block } .art { width:100%; height:100%; padding:${margin}px; display:flex;
    flex-direction:column; justify-content:${form ? 'flex-start' : 'center'}; gap:${unit * .035}px;
    color:${ink}; font-family:${t.display}; overflow-wrap:anywhere; }
    p,h1 { margin:0 } h1 { font-size:${headingSize}px; line-height:1.08; font-weight:${t.weightDisplay} }
    .brand { font-weight:700 } p,.line { font-size:${unit * .04}px; line-height:1.25 }
    .line { border-bottom:0.22px solid #555; min-height:${unit * .105}px; padding-top:${unit * .025}px }
    </style>`;
  const art = `<rect width="${artWidth}" height="${artHeight}" fill="${form ? '#fff' : c.bg}"/>
    <rect x="${bleed}" y="${bleed}" width="${width}" height="${unit * .022}" fill="${c.primary}"/>
    <foreignObject x="${bleed}" y="${bleed}" width="${width}" height="${height}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="art">${label}
        <h1>${escapeXML(title)}</h1>
        ${detail ? `<p>${escapeXML(detail)}</p>` : ''}
        ${event ? `<p>${escapeXML(event)}</p>` : ''}${lines}
      </div>
    </foreignObject>`;
  return { body, art };
}

function cropMarks(g, gutter) {
  const { bleed, width, height, artWidth, artHeight } = g;
  const left = gutter + bleed;
  const top = gutter + bleed;
  const right = gutter + artWidth;
  const bottom = gutter + artHeight;
  const gap = 1;
  const length = 3;
  const strokes = [];
  for (const x of [left, left + width]) {
    strokes.push(`M ${x} ${gutter - gap - length} v ${length}`, `M ${x} ${bottom + gap} v ${length}`);
  }
  for (const y of [top, top + height]) {
    strokes.push(`M ${gutter - gap - length} ${y} h ${length}`, `M ${right + gap} ${y} h ${length}`);
  }
  return `<path d="${strokes.join(' ')}" fill="none" stroke="#000" stroke-width=".2"/>`;
}

export async function renderPrintPieces(pieces, identity) {
  if (!pieces.length) return new Map();
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ timeout: 15000 });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    await page.route('**/*', route => route.abort());
    const output = new Map();
    for (const piece of pieces) {
      const g = printGeometry(piece);
      const sides = [];
      for (const side of piece.print.sides) {
        const { body, art } = layout(piece, identity, side, g);
        const document = (svg) => `<!doctype html><meta charset="utf-8">${body}${svg}`;
        await page.setViewportSize({ width: g.pixelWidth, height: g.pixelHeight });
        await page.setContent(document(`<svg width="${g.pixelWidth}" height="${g.pixelHeight}"
          viewBox="0 0 ${g.artWidth} ${g.artHeight}" preserveAspectRatio="none">${art}</svg>`));
        await page.evaluate(() => {
          const box = document.querySelector('.art');
          for (let attempt = 0; box.scrollHeight > box.clientHeight + 1 && attempt < 20; attempt++) {
            for (const element of box.children) {
              element.style.fontSize = `${parseFloat(getComputedStyle(element).fontSize) * 0.9}px`;
            }
          }
        });
        const artwork = await page.locator('svg').innerHTML();
        const png = withPngDensity(await page.screenshot({ type: 'png' }), piece.print.dpi);
        const gutter = 5;
        const sheetWidth = g.artWidth + 2 * gutter;
        const sheetHeight = g.artHeight + 2 * gutter;
        await page.setContent(document(`<style>@page { size:${sheetWidth}mm ${sheetHeight}mm; margin:0 }</style>
          <svg width="${sheetWidth}mm" height="${sheetHeight}mm" viewBox="0 0 ${sheetWidth} ${sheetHeight}">
            <g transform="translate(${gutter} ${gutter})">${artwork}</g>${cropMarks(g, gutter)}
          </svg>`));
        const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
        sides.push({ side, png, pdf, geometry: g });
      }
      output.set(piece.id, sides);
    }
    return output;
  } finally {
    await browser.close();
  }
}
