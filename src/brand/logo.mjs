// Fatia 2 — Logo SVG paramétrico (ícone geométrico + wordmark), sem IA de difusão.
import { resolveFontPair, FONT_CATALOG } from './fontCatalog.mjs';

export function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

export const LOGO_PRIMITIVES = ['orbit', 'petal', 'facet'];

const ICON = 64, GAP = 16, PAD = 8, H = 80, FONT_SIZE = 36;
const CHAR_W = 0.62; // estimativa conservadora (em em) para não cortar nomes longos

export function estimateTextWidth(text, size = FONT_SIZE) {
  return Math.ceil([...text].length * size * CHAR_W);
}

/** Ícone: círculo (primary), quadrado girado (secondary), ponto (accent). */
function iconShapes(c, x, y, primitive) {
  if (primitive === 'petal') {
    return `<rect x="${x}" y="${y}" width="64" height="64" rx="22" fill="${c.primary}"/><g transform="translate(${x} ${y})"><path d="M17 39Q16 17 44 16Q47 43 23 47Z" fill="${c.accent}"/><path d="M22 44L37 26" stroke="${c.primary}" stroke-width="3" stroke-linecap="round"/></g>`;
  }
  if (primitive === 'facet') {
    return `<g transform="translate(${x} ${y})"><path d="M32 0L64 32L32 64L0 32Z" fill="${c.primary}"/><path d="M32 10L53 32H11Z" fill="${c.accent}"/><path d="M11 32H53L32 53Z" fill="${c.secondary}"/></g>`;
  }
  const cx = x + ICON / 2, cy = y + ICON / 2;
  return `<circle cx="${cx}" cy="${cy}" r="${ICON / 2}" fill="${c.primary}"/>` +
    `<rect x="${cx - 16}" y="${cy - 16}" width="32" height="32" rx="6" fill="${c.secondary}" transform="rotate(45 ${cx} ${cy})"/>` +
    `<circle cx="${cx}" cy="${cy}" r="7" fill="${c.accent}"/>`;
}

/** @param tokens tokens já validados (validateBrandTokens().tokens) */
export function buildLogoSvg(tokens, { withXmlns = true } = {}) {
  const c = tokens.colors;
  const { heading, headingMeta } = resolveFontPair(tokens.typography);
  const name = escapeXml(tokens.brand_name);
  const textW = estimateTextWidth(tokens.brand_name);
  const vbW = PAD * 2 + ICON + GAP + textW;
  const vbH = H;
  const tx = PAD + ICON + GAP;
  const family = `'${escapeXml(heading)}', ${headingMeta.fallback}`;
  return `<svg${withXmlns ? ' xmlns="http://www.w3.org/2000/svg"' : ''} viewBox="0 0 ${vbW} ${vbH}" role="img" aria-label="${name}" preserveAspectRatio="xMinYMid meet">` +
    `<title>${name}</title>${iconShapes(c, PAD, (vbH - ICON) / 2, tokens.logo_primitive)}` +
    `<text x="${tx}" y="${vbH / 2}" dominant-baseline="central" font-family="${family}" font-weight="700" font-size="${FONT_SIZE}" fill="${c.text_primary}" textLength="${textW}" lengthAdjust="spacingAndGlyphs">${name}</text></svg>`;
}

/** SVG inline para embutir no HTML (sem xmlns, sem width/height). */
export const logoInline = (tokens) => buildLogoSvg(tokens, { withXmlns: false });

/** Data URI base64 para <img src>. */
export const logoDataUri = (tokens) =>
  'data:image/svg+xml;base64,' + Buffer.from(buildLogoSvg(tokens, { withXmlns: true }), 'utf8').toString('base64');

export { FONT_CATALOG };
