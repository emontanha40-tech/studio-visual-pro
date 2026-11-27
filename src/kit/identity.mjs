import { extractSemanticBriefing } from '../website/brandKit.mjs';

const HEX = /^#[0-9a-fA-F]{6}$/;
export const FONT_STACKS = {
  sans: 'Inter, -apple-system, "Segoe UI", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  humanist: '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
};
const OVERRIDABLE = ['bg', 'surface', 'primary', 'accent', 'text', 'muted'];

function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Etapa 1: valida/ajusta a Identidade Visual Base (paleta WCAG AA, fontes, logo SVG, foco da foto). */
export function buildIdentity(input = {}) {
  const ast = extractSemanticBriefing(input);
  const colors = { ...ast.brand_kit.colors };
  const avisos = [];
  for (const k of OVERRIDABLE) {
    const v = input.cores?.[k];
    if (v === undefined) continue;
    if (typeof v === 'string' && HEX.test(v)) colors[k] = v.toLowerCase();
    else avisos.push(`Cor "${k}" ignorada: use #RRGGBB.`);
  }
  const minimo = ast.qa_budget.min_contrast_ratio;
  const checks = [];
  const ensure = (papel, fundo) => {
    const antes = contrastRatio(colors[papel], colors[fundo]);
    if (antes < minimo) {
      const alt = contrastRatio('#ffffff', colors[fundo]) >= contrastRatio('#000000', colors[fundo]) ? '#ffffff' : '#000000';
      avisos.push(`Contraste de "${papel}" sobre "${fundo}" era ${antes.toFixed(2)}:1; ajustado automaticamente.`);
      colors[papel] = alt;
    }
    checks.push({ papel, fundo, ratio: Number(contrastRatio(colors[papel], colors[fundo]).toFixed(2)), ok: true });
  };
  ensure('text', 'bg'); ensure('muted', 'bg'); ensure('primary', 'bg');
  // Texto sobre o botão primário: escolhe a cor com melhor contraste.
  const onPrimary = contrastRatio('#ffffff', colors.primary) >= contrastRatio('#04060c', colors.primary) ? '#ffffff' : '#04060c';
  colors.onPrimary = onPrimary;
  checks.push({ papel: 'onPrimary', fundo: 'primary', ratio: Number(contrastRatio(onPrimary, colors.primary).toFixed(2)), ok: true });

  const fonte = FONT_STACKS[input.fonte] ? input.fonte : (ast.brand_kit.typography.display.includes('Georgia') ? 'serif' : 'sans');
  const kit = { ...ast.brand_kit, colors, typography: { ...ast.brand_kit.typography, display: FONT_STACKS[fonte] } };
  const marca = String(input.marca || 'Connect').trim();
  const evento = {
    data: String(input.data || '').slice(0, 80),
    local: String(input.local || '').slice(0, 120),
  };
  return {
    schema_version: '1.0',
    marca,
    nicho: String(input.nicho || input.subtitulo_marca || '').trim().slice(0, 80),
    kit,
    fonte,
    headlines: ast.headlines,
    logo_svg: ast.svg_logo_parametrico.replace(/#[0-9a-fA-F]{6}/g, (m) => m), // logo já usa o kit base
    focal: ast.focal_points,
    evento,
    beneficios: normalizarBeneficios(input.beneficios),
    contraste: checks,
    avisos,
  };
}

function normalizarBeneficios(list) {
  const base = Array.isArray(list) ? list.map((s) => String(s || '').trim().slice(0, 80)).filter(Boolean).slice(0, 3) : [];
  const padrao = ['Atendimento próximo e humano', 'Processo claro, sem surpresas', 'Resultado que você acompanha'];
  while (base.length < 3) base.push(padrao[base.length]);
  return base;
}
