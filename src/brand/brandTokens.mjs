// Fatia 1 — Contrato Brand Tokens v1.0.0 + validador determinístico WCAG AA.
export const SCHEMA_VERSION = '1.0.0';
import { LOGO_PRIMITIVES } from './logo.mjs';

export const DARK_TEXT = '#0F172A';
export const LIGHT_TEXT = '#FFFFFF';
export const WCAG_AA = 4.5;

export const COLOR_ROLES = [
  'primary', 'secondary', 'accent',
  'background_main', 'surface_card',
  'text_primary', 'text_muted',
  'cta_bg', 'cta_text',
];
export const TONES = ['formal', 'amigavel', 'inspirador', 'tecnico', 'descontraido', 'premium'];

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function normalizeHex(h) {
  if (typeof h !== 'string' || !HEX.test(h)) return null;
  let x = h.slice(1);
  if (x.length === 3) x = [...x].map((c) => c + c).join('');
  return '#' + x.toUpperCase();
}

export function relativeLuminance(hex) {
  const n = normalizeHex(hex);
  if (!n) throw new Error(`Cor inválida: ${hex}`);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function bestText(bg) {
  const foregrounds = [DARK_TEXT, LIGHT_TEXT, '#000000'];
  return foregrounds.find((fg) => contrastRatio(bg, fg) >= WCAG_AA) ?? LIGHT_TEXT;
}

/**
 * Valida e auto-corrige tokens sem rechamar LLM.
 * @returns {{ok:boolean, tokens:object|null, errors:string[], corrections:string[]}}
 */
export function validateBrandTokens(input) {
  const errors = [];
  const corrections = [];
  if (!input || typeof input !== 'object') return { ok: false, tokens: null, errors: ['Tokens ausentes'], corrections };
  const major = String(input.schema_version ?? '').split('.')[0];
  if (major !== SCHEMA_VERSION.split('.')[0]) errors.push(`schema_version incompatível (esperado ${SCHEMA_VERSION})`);

  const colors = {};
  for (const role of COLOR_ROLES) {
    const n = normalizeHex(input.colors?.[role]);
    if (!n) errors.push(`colors.${role} ausente ou hex inválido`);
    else colors[role] = n;
  }
  const typo = input.typography ?? {};
  for (const k of ['heading_font', 'body_font']) {
    if (typeof typo[k] !== 'string' || !typo[k].trim()) errors.push(`typography.${k} obrigatório`);
  }
  const voice = input.voice ?? {};
  if (!TONES.includes(voice.tone)) errors.push(`voice.tone deve ser um de: ${TONES.join(', ')}`);
  if (typeof input.brand_name !== 'string' || !input.brand_name.trim()) errors.push('brand_name obrigatório');
  if (errors.length) return { ok: false, tokens: null, errors, corrections };

  const fixPair = (fgKey, bgKey) => {
    const before = contrastRatio(colors[fgKey], colors[bgKey]);
    if (before >= WCAG_AA) return;
    colors[fgKey] = bestText(colors[bgKey]);
    corrections.push(`${fgKey} corrigido para ${colors[fgKey]} (contraste ${before.toFixed(2)} → ${contrastRatio(colors[fgKey], colors[bgKey]).toFixed(2)} sobre ${bgKey})`);
  };
  fixPair('cta_text', 'cta_bg');
  fixPair('text_primary', 'background_main');
  fixPair('text_primary', 'surface_card');
  fixPair('text_muted', 'background_main');
  for (const role of ['text_primary', 'text_muted']) {
    const backgrounds = ['background_main', 'surface_card'];
    if (backgrounds.every((bg) => contrastRatio(colors[role], colors[bg]) >= WCAG_AA)) continue;
    const shared = [DARK_TEXT, LIGHT_TEXT, '#000000'].find((fg) =>
      backgrounds.every((bg) => contrastRatio(fg, colors[bg]) >= WCAG_AA));
    if (shared) {
      colors[role] = shared;
      corrections.push(`${role} ajustado para contraste no fundo e nos cartões`);
    } else {
      colors.surface_card = colors.background_main;
      corrections.push('surface_card alinhado ao fundo para manter contraste do texto');
    }
    fixPair(role, 'background_main');
  }

  const tokens = {
    schema_version: SCHEMA_VERSION,
    brand_name: input.brand_name.trim(),
    colors,
    typography: { heading_font: typo.heading_font.trim(), body_font: typo.body_font.trim() },
    ...(LOGO_PRIMITIVES.includes(input.logo_primitive) ? { logo_primitive: input.logo_primitive } : {}),
    voice: { tone: voice.tone, keywords: Array.isArray(voice.keywords) ? voice.keywords.map(String).slice(0, 10) : [] },
  };
  return { ok: true, tokens, errors, corrections };
}
