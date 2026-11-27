/**
 * Fatia A — Design Tokens (Brand Kit) + Extração Semântica AST/JSON + Logo SVG Paramétrico.
 * Segue as 5 Decisões Arquiteturais (ADR) do Conselho de Agentes Connect:
 * 1. Templates Paramétricos (AST/JSON)
 * 2. Playwright como motor de renderização
 * 3. Logos Vetoriais Paramétricos em SVG (zero difusão)
 * 4. Smart Crop por Ponto Focal (focal_x, focal_y)
 * 5. Budget rígido de máx. 2 ciclos de QA
 */

export const BRAND_KITS = {
  'tech-cinematografico': {
    id: 'tech-cinematografico',
    nome: 'Tech Cinematográfico',
    colors: { bg: '#03050c', surface: '#090e1d', primary: '#2f7bff', accent: '#00e5ff', secondary: '#8b5cf6', success: '#10f5a0', text: '#f4f7ff', muted: '#9aa6c2' },
    typography: { display: 'Inter, -apple-system, sans-serif', body: 'Inter, system-ui, sans-serif', weightDisplay: 800, tracking: '-0.035em' },
    spacing: { sectionY: '80px', cardRadius: '22px', containerMax: '1080px' },
    contrast: { minRatio: 4.5, mode: 'dark' },
  },
  'editorial-clean': {
    id: 'editorial-clean',
    nome: 'Editorial Luxo',
    colors: { bg: '#0b0c10', surface: '#14161f', primary: '#d4a359', accent: '#f3d59b', secondary: '#8c6d3f', success: '#e6c27a', text: '#faf8f5', muted: '#b5afa4' },
    typography: { display: 'Georgia, "Times New Roman", serif', body: 'Inter, system-ui, sans-serif', weightDisplay: 700, tracking: '-0.02em' },
    spacing: { sectionY: '96px', cardRadius: '18px', containerMax: '1020px' },
    contrast: { minRatio: 4.5, mode: 'dark' },
  },
  'comercial-conversao': {
    id: 'comercial-conversao',
    nome: 'Alta Conversão',
    colors: { bg: '#070b14', surface: '#0f1628', primary: '#6366f1', accent: '#38bdf8', secondary: '#a855f7', success: '#10f5a0', text: '#ffffff', muted: '#a5b4fc' },
    typography: { display: 'Inter, -apple-system, sans-serif', body: 'Inter, system-ui, sans-serif', weightDisplay: 800, tracking: '-0.03em' },
    spacing: { sectionY: '72px', cardRadius: '20px', containerMax: '1120px' },
    contrast: { minRatio: 4.5, mode: 'dark' },
  },
};

function escXml(str) {
  return String(str || '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Gera um logo vetorial SVG limpo e escalável usando as cores do Brand Kit (ADR #3).
 */
export function generateParametricSvgLogo(marca, kit) {
  const label = escXml((marca || 'CONNECT').toUpperCase().slice(0, 18));
  const c1 = kit.colors.primary;
  const c2 = kit.colors.accent;
  const tx = kit.colors.text;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 56" role="img" aria-label="${label}">
  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
  <rect x="4" y="10" width="36" height="36" rx="10" fill="url(#lg)"/>
  <circle cx="22" cy="28" r="8" fill="${kit.colors.bg}"/>
  <circle cx="22" cy="28" r="3.5" fill="${c2}"/>
  <text x="52" y="36" fill="${tx}" font-family="Inter, -apple-system, sans-serif" font-weight="800" font-size="22" letter-spacing="3">${label}</text>
</svg>`;
}

/**
 * Extração Semântica Estruturada (AST/JSON) a partir do Briefing do cliente.
 */
export function extractSemanticBriefing(input = {}) {
  const modelo = BRAND_KITS[input.modelo] ? input.modelo : 'tech-cinematografico';
  const brandKit = BRAND_KITS[modelo];
  const marca = String(input.marca || 'Connect').trim();
  const nicho = String(input.nicho || input.subtitulo_marca || 'Soluções Tecnológicas').trim();
  const diferencial = String(input.diferencial || 'automação personalizada para sua necessidade real').trim();

  return {
    schema_version: '2.0',
    slug: String(input.slug || marca.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, '') || 'site-gerado',
    brand_kit: brandKit,
    tom_de_voz: modelo === 'editorial-clean' ? 'executivo-sofisticado' : modelo === 'comercial-conversao' ? 'direto-persuasivo' : 'inovador-cinematografico',
    headlines: {
      hero: String(input.slogan || `${marca}: conectando você ao que há de melhor.`).trim(),
      subtitulo: String(input.subtitulo || `${nicho} com ${diferencial}.`).trim(),
      cta_principal: 'Falar no WhatsApp agora',
    },
    svg_logo_parametrico: generateParametricSvgLogo(marca, brandKit),
    focal_points: {
      hero: { x: 0.5, y: 0.45 },
      founder: { x: 0.5, y: 0.18 },
      cards: { x: 0.5, y: 0.5 },
    },
    formatos_alvo: ['web-desktop', 'web-mobile', 'social-1x1', 'story-9x16', 'banner-16x9'],
    qa_budget: { max_retries: 2, min_contrast_ratio: 4.5, renderer: 'playwright' },
  };
}
