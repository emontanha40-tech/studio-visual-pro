// Fatia 2 — Catálogo de fontes locais (.woff2). Sem downloads: tudo resolvido offline.
export const FONT_DIR = 'assets/fonts';
export const FONT_CATALOG = {
  Poppins: { file: 'Poppins-Variable.woff2', fallback: 'sans-serif', weights: '300 800' },
  Inter: { file: 'Inter-Variable.woff2', fallback: 'sans-serif', weights: '100 900' },
  'Playfair Display': { file: 'PlayfairDisplay-Variable.woff2', fallback: 'serif', weights: '400 900' },
  Montserrat: { file: 'Montserrat-Variable.woff2', fallback: 'sans-serif', weights: '100 900' },
  Lora: { file: 'Lora-Variable.woff2', fallback: 'serif', weights: '400 700' },
  'Roboto Mono': { file: 'RobotoMono-Variable.woff2', fallback: 'monospace', weights: '100 700' },
};
export const DEFAULT_PAIR = { heading_font: 'Poppins', body_font: 'Inter' };

const lookup = (name) => {
  const k = Object.keys(FONT_CATALOG).find((n) => n.toLowerCase() === String(name ?? '').trim().toLowerCase());
  return k ?? null;
};

/** Resolve o par de fontes; fora do catálogo → par padrão (nunca lança, nunca vai à internet). */
export function resolveFontPair(typography = {}) {
  const h = lookup(typography.heading_font);
  const b = lookup(typography.body_font);
  const fallbacks = [];
  if (!h) fallbacks.push(`heading_font "${typography.heading_font}" fora do catálogo → ${DEFAULT_PAIR.heading_font}`);
  if (!b) fallbacks.push(`body_font "${typography.body_font}" fora do catálogo → ${DEFAULT_PAIR.body_font}`);
  const heading = h ?? DEFAULT_PAIR.heading_font;
  const body = b ?? DEFAULT_PAIR.body_font;
  return { heading, body, headingMeta: FONT_CATALOG[heading], bodyMeta: FONT_CATALOG[body], fallbacks };
}

/** CSS @font-face apenas com arquivos locais (file://-safe relativo a baseUrl). */
export function fontFaceCss(pair, baseUrl = FONT_DIR) {
  return [...new Set([pair.heading, pair.body])].map((n) => {
    const m = FONT_CATALOG[n];
    return `@font-face{font-family:'${n}';src:url('${baseUrl}/${m.file}') format('woff2');font-weight:${m.weights};font-display:swap}`;
  }).join('\n');
}
