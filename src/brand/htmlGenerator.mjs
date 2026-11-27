// Fatia 3 & 4 — Gerador de HTML/CSS a partir de Brand Tokens + logo.
// CSS Variables são a ponte única: templates consomem var(--color-*) / var(--font-*).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFontPair, FONT_CATALOG } from './fontCatalog.mjs';
import { logoInline, buildLogoSvg, escapeXml } from './logo.mjs';
import { contrastRatio, DARK_TEXT, LIGHT_TEXT } from './brandTokens.mjs';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FONT_DIR_ABS = path.join(PROJECT_ROOT, 'assets/fonts');

// Zonas seguras de UI do Instagram/TikTok para Story 9:16 (1080x1920).
export const STORY_SAFE_ZONES = Object.freeze({
  width: 1080,
  height: 1920,
  top: 250,
  bottom: 320,
  side: 72,
});

/** Bloco :root com as 9 cores semânticas + fontes. */
export function rootVarsCss(tokens, pair = resolveFontPair(tokens.typography)) {
  const c = tokens.colors;
  const lines = Object.entries(c).map(([k, v]) => `  --color-${k.replace(/_/g, '-')}: ${v};`);
  lines.push(`  --font-heading: '${pair.heading}', ${pair.headingMeta.fallback};`);
  lines.push(`  --font-body: '${pair.body}', ${pair.bodyMeta.fallback};`);
  return `:root{\n${lines.join('\n')}\n}`;
}

/** @font-face só para .woff2 que existem em disco (evita 404/fonte quebrada no Chromium). */
export function safeFontFaceCss(pair, { fontDir = FONT_DIR_ABS, urlPrefix = null, exists = fs.existsSync } = {}) {
  const missing = [];
  const css = [...new Set([pair.heading, pair.body])].map((n) => {
    const m = FONT_CATALOG[n];
    const abs = path.join(fontDir, m.file);
    if (!exists(abs)) { missing.push(n); return ''; }
    const src = urlPrefix ? `${urlPrefix}/${m.file}` : `file://${abs}`;
    return `@font-face{font-family:'${n}';src:url('${src}') format('woff2');font-weight:${m.weights};font-display:swap}`;
  }).filter(Boolean).join('\n');
  return { css, missing };
}

const clampPct = (n, d = 50) => (Number.isFinite(+n) ? Math.min(100, Math.max(0, +n)) : d);

const BASE_CSS = `*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%}
body{font-family:var(--font-body);background:var(--color-background-main);color:var(--color-text-primary);overflow:hidden}
body.is-landing{height:auto;min-height:100%;overflow-x:hidden;overflow-y:auto}
h1,h2,h3{font-family:var(--font-heading);line-height:1.12}
.logo svg{height:100%;width:auto;display:block}
.cta{display:inline-block;background:var(--color-cta-bg);color:var(--color-cta-text);font-family:var(--font-heading);font-weight:700;border-radius:999px;text-decoration:none}
.muted{color:var(--color-text-muted)}
.card{background:var(--color-surface-card);border-radius:24px}
.hero-img{width:100%;height:100%;object-fit:cover}`;

// Ícones inline minimalistas (traço Lucide, 24x24, currentColor). Escolha por palavra-chave do título; senão, rotação.
const ICON_PATHS = {
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L8 14.2 3 9.3l6.9-1z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="M12 15 9 12a22 22 0 0 1 2-4 12 12 0 0 1 11-6c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/>',
};
const ICON_RULES = [
  [/segur|prote|confi|garant|privac/, 'shield'], [/rapid|agil|imediat|velocid|automa|express/, 'zap'],
  [/cuidad|saude|sorriso|atendiment|acolh|bem-estar|bem estar/, 'heart'], [/qualid|premium|exclusiv|destaque|especial|lente/, 'star'],
  [/hora|prazo|tempo|agenda|horario|entrega/, 'clock'], [/equipe|time|pessoa|cliente|comunidade|especialist/, 'users'],
  [/recurso|modul|integra|plataforma|pacote|solu/, 'layers'], [/lanc|novo|novidade|inova|oferta/, 'rocket'],
  [/identidade|design|criativ|marca|visual|personaliz/, 'sparkles'], [/conver|pronto|result|consisten/, 'check'],
];
const ICON_ORDER = ['sparkles', 'check', 'zap', 'layers', 'shield', 'star'];
export function featureIcon(title, index = 0) {
  const t = String(title ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const key = ICON_RULES.find(([re]) => re.test(t))?.[1] ?? ICON_ORDER[index % ICON_ORDER.length];
  return `<span class="lp-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" focusable="false">${ICON_PATHS[key]}</svg></span>`;
}
const ARROW_ICON = '<svg class="lp-arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

const DEFAULT_FEATURES = [
  { title: 'Identidade Consistente', text: 'Cores, tipografia e logo unificados em cada ponto de contato.' },
  { title: 'Pronto para Conversão', text: 'Hierarquia clara com contraste validado e chamada direta.' },
  { title: 'Entrega Imediata', text: 'Pacote estático leve, responsivo e pronto para publicação.' },
];

const LANDING_SECTIONS = {
  saas_modern: ['Recursos da solução', 'Conheça a solução'],
  local_authority: ['Especialidades e atendimento', 'Planeje seu atendimento'],
  product_launch: ['Conheça os benefícios', 'Detalhes da oferta'],
};

function renderTestimonials(list) {
  return `<h2>Depoimentos</h2><div class="lp-quotes">${list.map(({ name, text }) =>
    `<blockquote data-reveal><p>“${escapeXml(text)}”</p><cite>— ${escapeXml(name)}</cite></blockquote>`).join('')}</div>`;
}

function renderLandingExtras(archetype, options, features) {
  if (archetype === 'saas_modern') {
    return `<section class="lp-wrap lp-metrics" aria-label="Resumo da solução" data-reveal>
      <div data-reveal style="--i:1"><strong>${features.length}</strong><span>recursos em destaque</span></div>
      <div data-reveal style="--i:2"><strong>01</strong><span>visão da solução</span></div>
      <div data-reveal style="--i:3"><strong>01</strong><span>próximo passo</span></div>
    </section>`;
  }
  if (archetype === 'product_launch') {
    return `<section class="lp-wrap lp-offer" aria-label="Oferta" data-reveal>
      <div class="lp-offer-box card"><span class="lp-badge">${escapeXml(options.badge || 'Lançamento')}</span>
      <h2>${escapeXml(options.ctaHeadline || 'Detalhes da oferta')}</h2>
      <p class="muted">${escapeXml(options.ctaSubtitle || 'Consulte os canais oficiais da marca para condições e disponibilidade.')}</p>
      <a class="cta lp-cta" href="#contato">${escapeXml(options.cta)}</a></div>
    </section>`;
  }
  if (archetype !== 'local_authority') return '';
  const faq = options.faq ?? [
    { title: 'Como agendar?', text: 'Consulte os canais oficiais da marca para verificar horários.' },
    { title: 'O que levar no primeiro atendimento?', text: 'Confirme com a equipe os documentos e materiais necessários.' },
    { title: 'Onde vejo os valores?', text: 'Consulte a equipe para conhecer as condições do atendimento.' },
  ];
  return `<section class="lp-extra"><div class="lp-wrap lp-local-grid">
    <article class="card lp-proof" data-reveal>${options.testimonials?.length ? renderTestimonials(options.testimonials) : '<h2>Depoimentos</h2><p class="muted">Espaço para avaliações autorizadas de clientes.</p>'}</article>
    <div class="lp-faq" data-reveal><h2>Perguntas frequentes</h2>${faq.map(({ title, text }) =>
      `<details><summary>${escapeXml(title)}</summary><p>${escapeXml(text)}</p></details>`).join('')}</div>
  </div></section>`;
}

/** Cor de texto de contraste máximo (branco ou escuro) sobre a cor primary. */
export function onPrimary(tokens) {
  const bg = tokens.colors.primary;
  return contrastRatio(LIGHT_TEXT, bg) >= contrastRatio(DARK_TEXT, bg) ? LIGHT_TEXT : DARK_TEXT;
}

function renderLandingBody(t, o) {
  const archetype = Object.hasOwn(LANDING_SECTIONS, o.archetype) ? o.archetype : 'classic';
  const [sectionTitle, offerTitle] = LANDING_SECTIONS[archetype] ?? ['Por que escolher nossa solução', 'Pronto para começar agora?'];
  const features = (Array.isArray(o.features) && o.features.length ? o.features : DEFAULT_FEATURES).slice(0, 3);
  const badge = o.badge ? `<span class="lp-badge">${escapeXml(o.badge)}</span>` : '';
  const heroMedia = o.imageUrl
    ? `<div class="lp-media lp-photo" data-reveal style="--i:2"><img data-parallax class="hero-img" src="${escapeXml(o.imageUrl)}" style="object-position:${clampPct(o.focalX)}% ${clampPct(o.focalY)}%" alt="" loading="eager" decoding="async">${o.photoCredit ? `<small class="lp-credit">${escapeXml(o.photoCredit)}</small>` : ''}</div>`
    : `<div class="lp-media lp-geo" data-reveal style="--i:2"><i class="lp-orb lp-orb1"></i><i class="lp-orb lp-orb2"></i><div class="lp-geo-card" data-parallax><span class="lp-geo-tag">${escapeXml(o.tagline || o.subtitle || 'Design modular orientado por Brand Tokens')}</span></div></div>`;

  return `<div class="landing lp-${archetype}">
<header class="lp-header"><div class="lp-wrap lp-nav"><div class="logo lp-logo">${logoInline(t)}</div><a class="cta lp-nav-cta" href="#contato">${escapeXml(o.cta)}</a></div></header>
<section class="lp-hero"><div class="lp-wrap lp-hero-grid">
  <div class="lp-hero-copy" data-reveal>${badge}<h1>${escapeXml(o.headline)}</h1><p class="muted lp-sub">${escapeXml(o.subtitle)}</p><div class="lp-actions"><a class="cta lp-cta" href="#contato">${escapeXml(o.cta)}</a></div></div>
  ${heroMedia}
</div></section>
${archetype === 'saas_modern' ? renderLandingExtras(archetype, o, features) : ''}
<section class="lp-features"><div class="lp-wrap">
  <h2 class="lp-sec-title" data-reveal>${escapeXml(o.sectionTitle || sectionTitle)}</h2>
  <div class="lp-grid">${features.map((f, i) => `<article class="card lp-card" data-reveal style="--i:${i + 1}">${featureIcon(f.title, i)}<h3>${escapeXml(f.title)}</h3><p class="muted">${escapeXml(f.text)}</p></article>`).join('')}</div>
</div></section>
${archetype === 'local_authority' || archetype === 'product_launch' ? renderLandingExtras(archetype, o, features) : ''}
${archetype !== 'local_authority' && o.testimonials?.length ? `<section class="lp-extra"><div class="lp-wrap lp-testimonials card">${renderTestimonials(o.testimonials)}</div></section>` : ''}
<section class="lp-cta-band" id="contato" style="--on-primary:${onPrimary(t)}"><div class="lp-wrap lp-cta-box" data-reveal>
  <div><h2>${escapeXml(o.ctaHeadline || offerTitle)}</h2><p class="lp-cta-sub">${escapeXml(o.ctaSubtitle || (archetype === 'classic' ? 'Converse com o nosso time e coloque sua campanha no ar.' : 'Consulte os canais oficiais da marca para saber mais.'))}</p></div>
  <a class="lp-cta-btn" href="#contato">${escapeXml(o.cta)}${ARROW_ICON}</a>
</div></section>
${archetype === 'saas_modern' ? `<a class="cta lp-floating" href="#contato">${escapeXml(o.cta)}</a>` : ''}
<footer class="lp-footer"><div class="lp-wrap lp-foot-row"><div class="logo lp-logo-sm">${logoInline(t)}</div><small class="muted">© ${escapeXml(t.brand_name)}</small></div></footer>
</div>`;
}

const TEMPLATES = {
  // Layout puramente tipográfico/geométrico (sem imagem externa).
  banner: (t, o) => `<main class="banner"><div class="logo" style="height:12vmin">${logoInline(t)}</div>
<h1>${escapeXml(o.headline)}</h1><p class="muted">${escapeXml(o.subtitle)}</p><span class="cta">${escapeXml(o.cta)}</span>
<i class="g g1"></i><i class="g g2"></i></main>`,

  // Com imagem + ponto focal.
  post: (t, o) => `<main class="post">${o.imageUrl ? `<img class="hero-img" src="${escapeXml(o.imageUrl)}" style="object-position:${clampPct(o.focalX)}% ${clampPct(o.focalY)}%" alt="">` : '<i class="g g1"></i><i class="g g2"></i>'}
<div class="over"><div class="logo" style="height:9vmin">${logoInline(t)}</div><h1>${escapeXml(o.headline)}</h1><span class="cta">${escapeXml(o.cta)}</span></div></main>`,

  // Story 9:16 (1080x1920) com zonas seguras: 250px topo e 320px base livres de texto/CTA.
  story: (t, o) => `<main class="story">${o.imageUrl ? `<img class="hero-img story-bg" src="${escapeXml(o.imageUrl)}" style="object-position:${clampPct(o.focalX)}% ${clampPct(o.focalY)}%" alt="">` : '<i class="g sg1"></i><i class="g sg2"></i>'}
<div class="story-safe">
  <div class="logo story-logo">${logoInline(t)}</div>
  <div class="story-copy"><h1>${escapeXml(o.headline)}</h1>${o.subtitle ? `<p class="muted story-sub">${escapeXml(o.subtitle)}</p>` : ''}</div>
  <div class="story-foot"><span class="cta story-cta">${escapeXml(o.cta)}</span></div>
</div></main>`,

  // Landing Page modular e deployável.
  landing: renderLandingBody,
};


const MOTION_CSS = `
.lp-offer{padding-block:8px 48px}
.lp-offer-box{padding:48px;text-align:center;display:grid;gap:16px;justify-items:center;border:1px solid color-mix(in srgb,var(--color-primary) 30%,transparent)}
.lp-offer-box h2{font-size:clamp(26px,4vw,40px)}
.landing .cta:not(.lp-floating){position:relative}
.landing .cta{overflow:hidden}
.landing .cta::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);transform:translateX(-120%);transition:transform .7s var(--ease-cine)}
.landing .cta:hover::after{transform:translateX(120%)}
html.is-static .landing .cta::after{display:none}
.lp-saas_modern .lp-metrics div{transition:transform .5s var(--ease-cine)}
:root{--ease-cine:cubic-bezier(0.16,1,0.3,1)}
.lp-header{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--color-background-main) 78%,transparent);-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4)}
.lp-geo-card{background:color-mix(in srgb,var(--color-background-main) 72%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid color-mix(in srgb,var(--color-background-main) 60%,transparent)}
.lp-card{transition:transform .6s var(--ease-cine),box-shadow .6s var(--ease-cine)}
.lp-card:hover{transform:translateY(-6px);box-shadow:0 18px 40px rgba(15,23,42,.14)}
.landing .cta{transition:transform .45s var(--ease-cine),box-shadow .45s var(--ease-cine)}
.landing .cta:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 10px 28px rgba(15,23,42,.22)}
.lp-orb{animation:lp-float 9s var(--ease-cine) infinite alternate}
@keyframes lp-float{to{transform:translate3d(-14px,18px,0) scale(1.06)}}
html.js-motion [data-reveal]{opacity:0;transform:translate3d(0,32px,0);transition:opacity .95s var(--ease-cine),transform .95s var(--ease-cine);transition-delay:calc(var(--i,0)*110ms);will-change:opacity,transform}
html.js-motion [data-reveal].is-in{opacity:1;transform:none}
html.is-static [data-reveal]{opacity:1!important;transform:none!important;transition:none!important}
html.is-static .lp-orb{animation:none}
html.is-static .landing *,html.is-static .landing *::details-content{animation:none!important;transition:none!important}
html.js-motion [data-parallax]{translate:0 var(--parallax,0px)}
@media (hover:hover){html.js-motion .lp-card.is-in:hover,html:not(.js-motion):not(.is-static) .lp-card:hover{translate:0 -5px;box-shadow:0 14px 32px color-mix(in srgb,var(--color-primary) 20%,transparent)}
html:not(.is-static) .landing .cta:hover{box-shadow:0 0 24px color-mix(in srgb,var(--color-primary) 35%,transparent)}}
@media (prefers-reduced-motion:no-preference){html:not(.is-static) .lp-faq details[open] p{animation:faq-in .25s var(--ease-cine) both}}
@keyframes faq-in{from{opacity:0;translate:0 -4px}to{opacity:1;translate:0 0}}
@media (prefers-reduced-motion:reduce){.lp-orb{animation:none}.lp-card,.landing .cta{transition:none}}`;

// Micro-runtime (sem dependências). ?static=true / data-static / reduced-motion → tudo visível sem esperar scroll.
export const MOTION_JS = `(() => {
  const root = document.documentElement;
  if (new URLSearchParams(location.search).get('static') === 'true' /* ?static=true */ || root.hasAttribute('data-static') ||
      matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    root.classList.add('is-static');
    return;
  }
  root.classList.add('js-motion');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0, rootMargin: '0px 0px -18px 0px' });
  document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));
  const layers = document.querySelectorAll('[data-parallax]');
  if (!layers.length) return;
  let queued = false;
  function update() {
    queued = false;
    const offset = Math.min(Math.max(window.scrollY, 0) * 0.12, 36);
    layers.forEach((layer) => layer.style.setProperty('--parallax', offset + 'px'));
  }
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
})();`; // ?static=true


const EDITORIAL_CSS = `
.lp-photo{padding:0;border-radius:28px;background:var(--color-surface-card);box-shadow:0 36px 70px -24px rgba(15,23,42,.5),0 14px 28px -14px rgba(15,23,42,.28);isolation:isolate}
.lp-photo::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;border-radius:inherit;background:radial-gradient(ellipse at 50% 42%,transparent 52%,rgba(15,23,42,.30) 100%),linear-gradient(180deg,transparent 58%,rgba(15,23,42,.38))}
.lp-credit{position:absolute;z-index:2;right:14px;bottom:10px;font-size:11px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.lp-geo-tag{font-size:17px;line-height:1.45;color:var(--color-text-primary);font-weight:500}
.lp-header{padding:14px 0}
.lp-nav{flex-wrap:nowrap}
.lp-logo{flex:1 1 auto;display:flex;align-items:center}
.lp-nav .lp-nav-cta{flex:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46%;font-size:14px;font-weight:600;padding:9px 18px;box-shadow:none}
.lp-icon{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;color:var(--color-primary);background:color-mix(in srgb,var(--color-primary) 12%,var(--color-surface-card));flex:none}
.lp-cta-band .lp-cta-box{background:var(--color-primary);color:var(--on-primary,#fff);box-shadow:0 30px 60px -28px color-mix(in srgb,var(--color-primary) 70%,#000)}
.lp-cta-band .lp-cta-box h2{color:var(--on-primary,#fff);font-size:clamp(28px,4.4vw,40px)}
.lp-cta-band .lp-cta-sub{color:var(--on-primary,#fff);font-size:18px;line-height:1.5;max-width:52ch}
.lp-cta-btn{display:inline-flex;align-items:center;gap:10px;flex:none;background:var(--on-primary,#fff);color:var(--color-primary);font-family:var(--font-heading);font-weight:700;font-size:18px;padding:18px 34px;border-radius:999px;text-decoration:none;transition:transform .45s var(--ease-cine),box-shadow .45s var(--ease-cine)}
.lp-cta-btn:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.28)}
.lp-cta-btn .lp-arrow{transition:transform .35s var(--ease-cine)}.lp-cta-btn:hover .lp-arrow{transform:translateX(4px)}
.lp-product_launch .lp-cta-band .lp-cta-box{display:grid;justify-items:center;gap:24px}
.lp-product_launch .lp-cta-sub{margin-inline:auto}
html.is-static .lp-cta-btn,html.is-static .lp-cta-btn .lp-arrow{transition:none!important}
@media(max-width:680px){
.lp-header{padding:10px 0}.lp-nav{gap:10px}.lp-logo{height:34px}.lp-nav .lp-nav-cta{font-size:13px;padding:8px 14px;max-width:42%}
.lp-photo{border-radius:22px}.lp-cta-band .lp-cta-box{padding:32px 24px;width:calc(100% - 40px)}.lp-cta-btn{width:100%;justify-content:center}
}`;

const htmlAttrs = (o) => (o.static ? ' data-static' : '');

const TEMPLATE_CSS = `
.banner,.post{position:relative;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:3vmin;padding:8vmin;overflow:hidden}
.banner h1{font-size:9vmin;max-width:80%}.banner p{font-size:3.4vmin}.banner .cta,.post .cta{font-size:3.2vmin;padding:2vmin 5vmin;align-self:flex-start}
.g{position:absolute;border-radius:50%;z-index:0}.g1{width:60vmin;height:60vmin;right:-15vmin;top:-15vmin;background:var(--color-primary);opacity:.9}
.g2{width:36vmin;height:36vmin;right:12vmin;bottom:-12vmin;background:var(--color-accent);opacity:.85}
.banner>*:not(.g),.over{position:relative;z-index:1}
.post .hero-img{position:absolute;inset:0}.post .over{margin-top:auto;display:flex;flex-direction:column;gap:3vmin;background:linear-gradient(transparent,var(--color-surface-card));padding:4vmin;border-radius:24px}
.post h1{font-size:7vmin}
.story{position:relative;width:100%;height:100%;overflow:hidden;background:var(--color-background-main)}
.story-bg{position:absolute;inset:0;z-index:0}
.sg1{width:720px;height:720px;right:-240px;top:-160px;background:var(--color-primary);opacity:.22}
.sg2{width:620px;height:620px;left:-200px;bottom:-140px;background:var(--color-accent);opacity:.24}
.story-safe{position:relative;z-index:1;width:100%;height:100%;padding:${STORY_SAFE_ZONES.top}px ${STORY_SAFE_ZONES.side}px ${STORY_SAFE_ZONES.bottom}px;display:flex;flex-direction:column;justify-content:space-between;gap:40px}
.story-logo{height:76px;max-width:100%}
.story-copy{display:flex;flex-direction:column;gap:28px;background:var(--color-surface-card);padding:48px;border-radius:32px}
.story-copy h1{font-size:76px;line-height:1.08;overflow-wrap:break-word}
.story-sub{font-size:34px;line-height:1.35;overflow-wrap:break-word}
.story-foot{display:flex;justify-content:flex-start}
.story-cta{font-size:36px;padding:26px 56px}
.landing{width:100%;background:var(--color-background-main);color:var(--color-text-primary)}
.lp-wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 32px}
.lp-header{border-bottom:1px solid var(--color-surface-card);padding:20px 0}
.lp-nav{display:flex;align-items:center;justify-content:space-between;gap:24px}
.lp-logo{height:44px}.lp-logo-sm{height:34px}
.lp-nav-cta{font-size:15px;padding:12px 24px}
.lp-hero{padding:72px 0}
.lp-hero-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:48px;align-items:center}
.lp-badge{display:inline-block;background:var(--color-surface-card);color:var(--color-text-primary);font-family:var(--font-heading);font-weight:700;font-size:13px;padding:6px 14px;border-radius:999px;margin-bottom:20px}
.lp-hero-copy h1{font-size:52px;margin-bottom:20px}
.lp-sub{font-size:19px;line-height:1.55;margin-bottom:32px;max-width:54ch}
.lp-cta{font-size:17px;padding:16px 34px}
.lp-media{position:relative;min-height:360px;border-radius:28px;overflow:hidden;background:var(--color-surface-card);display:flex;align-items:center;justify-content:center;padding:32px}
.lp-orb{position:absolute;border-radius:50%}.lp-orb1{width:260px;height:260px;right:-60px;top:-60px;background:var(--color-primary);opacity:.85}
.lp-orb2{width:180px;height:180px;left:-40px;bottom:-40px;background:var(--color-accent);opacity:.85}
.lp-geo-card{position:relative;z-index:1;background:var(--color-background-main);border-radius:20px;padding:28px;display:flex;flex-direction:column;gap:8px;max-width:85%;box-shadow:0 16px 40px rgba(15,23,42,.12)}
.lp-geo-card strong{font-family:var(--font-heading);font-size:22px}
.lp-features{padding:64px 0;background:var(--color-surface-card)}
.lp-sec-title{font-size:34px;margin-bottom:36px}
.lp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.lp-card{background:var(--color-background-main);padding:28px;display:flex;flex-direction:column;gap:12px}
.lp-card h3{font-size:20px}.lp-card p{font-size:15px;line-height:1.5}
.lp-cta-band{padding:64px 0}
.lp-cta-box{background:var(--color-surface-card);border-radius:28px;padding:44px;display:flex;align-items:center;justify-content:space-between;gap:32px}
.lp-cta-box h2{font-size:30px;margin-bottom:8px}
.lp-footer{padding:32px 0;border-top:1px solid var(--color-surface-card)}
.lp-foot-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
[id=contato]{scroll-margin-top:88px}
.landing h1,.landing h2,.landing h3,.landing p,.landing .cta,.landing summary{overflow-wrap:anywhere}
.lp-nav,.lp-foot-row{min-width:0}
.lp-logo,.lp-logo-sm{min-width:0}
.lp-logo svg,.lp-logo-sm svg{max-width:100%}
.lp-nav .cta{flex:none;max-width:48%;text-align:center}
.lp-media:has(img){padding:0}
.lp-media img{position:absolute;inset:-24px 0 0;height:calc(100% + 24px)}
.lp-geo-card{background:var(--color-background-main)!important}
.lp-saas_modern .lp-hero{background:radial-gradient(ellipse at 82% 40%,color-mix(in srgb,var(--color-accent) 24%,transparent),transparent 56%)}
.lp-saas_modern .lp-hero-grid{grid-template-columns:1.2fr .8fr}
.lp-saas_modern .lp-grid{grid-template-columns:1.25fr .75fr}
.lp-saas_modern .lp-card:first-child{grid-row:span 2;justify-content:end;min-height:260px;background:radial-gradient(ellipse at top right,color-mix(in srgb,var(--color-accent) 20%,transparent),transparent 64%),var(--color-background-main)}
.lp-saas_modern .lp-card:first-child h3{font-size:30px}
.lp-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding-block:12px 44px}
.lp-metrics div{display:grid;gap:6px;border-top:1px solid var(--color-text-muted);padding:16px 0}
.lp-metrics strong{font:700 clamp(26px,4vw,48px)/1 var(--font-heading)}
.lp-floating{position:fixed;z-index:12;bottom:max(12px,env(safe-area-inset-bottom));right:16px;padding:14px 22px;max-width:calc(100% - 32px);box-shadow:0 8px 26px #0003}
.lp-saas_modern .lp-footer{padding-bottom:104px}
.lp-local_authority .lp-hero{padding-block:80px;background:var(--color-surface-card)}
.lp-local_authority .lp-features{background:var(--color-background-main)}
.lp-local_authority .lp-card,.lp-proof{background:var(--color-surface-card);border-radius:10px}
.lp-local_authority .lp-media{border-radius:110px 24px 24px 24px;background:var(--color-background-main)}
.lp-extra{padding:32px 0 64px}
.lp-local-grid{display:grid;grid-template-columns:1fr 1.35fr;gap:40px}
.lp-proof{padding:36px;align-self:start}
.lp-quotes{display:grid;gap:14px;margin-top:12px}.lp-quotes blockquote{margin:0;padding-left:14px;border-left:3px solid var(--color-accent)}.lp-quotes cite{display:block;margin-top:6px;font-style:normal;font-weight:600;color:var(--color-text-muted)}.lp-testimonials{padding:28px;margin:24px auto}
.lp-extra h2{margin-bottom:16px}
.lp-faq details{border-bottom:1px solid var(--color-text-muted);padding:16px 0}
.lp-faq summary{cursor:pointer;font-weight:700}
.lp-faq details p{padding:12px 0 4px;line-height:1.5}
.lp-product_launch .lp-hero-grid{grid-template-columns:1fr;text-align:center;gap:32px}
.lp-product_launch .lp-hero-copy h1{font-size:clamp(38px,7vw,88px);max-width:16ch;margin-inline:auto}
.lp-product_launch .lp-sub{margin-inline:auto}
.lp-product_launch .lp-media{width:min(100%,800px);margin:auto;border-radius:32px 32px 110px 32px}
.lp-product_launch .lp-grid{grid-template-columns:1fr}
.lp-product_launch .lp-card{width:min(100%,760px);border-inline-start:5px solid var(--color-primary)}
.lp-product_launch .lp-card:nth-child(2){justify-self:center}
.lp-product_launch .lp-card:nth-child(3){justify-self:end}
.lp-product_launch .lp-cta-box{display:block;padding-block:64px;text-align:center}
@media(max-width:680px){.lp-wrap{padding-inline:20px}.lp-hero{padding-block:48px}.lp-hero-copy h1{font-size:clamp(31px,9vw,52px)}.lp-saas_modern .lp-hero-grid,.lp-saas_modern .lp-grid,.lp-local-grid{grid-template-columns:1fr}.lp-saas_modern .lp-card:first-child{grid-row:auto;min-height:180px}.lp-metrics{gap:8px;font-size:13px}.lp-media{min-height:250px}.lp-nav{gap:12px}.lp-nav-cta{padding:9px 12px}.lp-local_authority .lp-hero{padding-block:48px}}
@media (max-width:860px){.lp-hero-grid,.lp-grid{grid-template-columns:1fr}.lp-cta-box{flex-direction:column;align-items:flex-start}}${MOTION_CSS}${EDITORIAL_CSS}`;

/**
 * @param tokens tokens validados
 * @param opts { template:'banner'|'post'|'story'|'landing', headline, subtitle, cta, imageUrl, focalX, focalY, fontDir }
 * @returns { html, missingFonts, fallbacks }
 */
export function generateHtml(tokens, opts = {}) {
  const o = { template: 'banner', headline: tokens.brand_name, subtitle: '', cta: 'Saiba mais', ...opts };
  const tpl = TEMPLATES[o.template];
  if (!tpl) throw new Error(`template desconhecido: ${o.template}`);
  const pair = resolveFontPair(tokens.typography);
  const { css: faces, missing } = safeFontFaceCss(pair, o.fontDir ? { fontDir: o.fontDir } : {});
  const bodyClass = o.template === 'landing' ? ' class="is-landing"' : '';
  const script = o.template === 'landing' ? `<script>${MOTION_JS}</script>` : '';
  const html = `<!doctype html><html lang="pt-BR"${htmlAttrs(o)}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeXml(tokens.brand_name)}</title><style>
${faces}
${rootVarsCss(tokens, pair)}
${BASE_CSS}${TEMPLATE_CSS}
</style></head><body${bodyClass}>${tpl(tokens, o)}${script}</body></html>`;
  return { html, missingFonts: missing, fallbacks: pair.fallbacks };
}

/**
 * Gera pacote estático deployável da Landing Page (index.html + styles.css + standaloneHtml).
 */
export function generateLandingPackage(tokens, opts = {}) {
  const o = { headline: tokens.brand_name, subtitle: '', cta: 'Começar agora', ...opts, template: 'landing' };
  const pair = resolveFontPair(tokens.typography);
  const fontDir = o.fontDir ?? FONT_DIR_ABS;
  const { css: deployFaces, missing } = safeFontFaceCss(pair, { fontDir, urlPrefix: o.fontUrlPrefix ?? './fonts' });
  const { css: localFaces } = safeFontFaceCss(pair, { fontDir });
  const bodyMarkup = renderLandingBody(tokens, o);

  const stylesCss = [deployFaces, rootVarsCss(tokens, pair), BASE_CSS, TEMPLATE_CSS].filter(Boolean).join('\n');
  const indexHtml = `<!doctype html><html lang="pt-BR"${htmlAttrs(o)}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeXml(tokens.brand_name)}</title><link rel="stylesheet" href="./styles.css"></head><body class="is-landing">${bodyMarkup}<script>${MOTION_JS}</script></body></html>`;
  const standaloneHtml = `<!doctype html><html lang="pt-BR"${htmlAttrs(o)}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeXml(tokens.brand_name)}</title><style>
${localFaces}
${rootVarsCss(tokens, pair)}
${BASE_CSS}${TEMPLATE_CSS}
</style></head><body class="is-landing">${bodyMarkup}<script>${MOTION_JS}</script></body></html>`;

  const fontFiles = [...new Set([pair.heading, pair.body])]
    .map((n) => FONT_CATALOG[n].file)
    .filter((f) => fs.existsSync(path.join(fontDir, f)));

  return { indexHtml, stylesCss, standaloneHtml, logoSvg: buildLogoSvg(tokens, { withXmlns: true }), fontFiles, missingFonts: missing, fallbacks: pair.fallbacks };
}

/**
 * Grava o pacote estático da Landing Page em disco (index.html, styles.css e fonts/*.woff2 se presentes).
 */
export function exportLandingPackage(tokens, outDir, opts = {}) {
  const pkg = generateLandingPackage(tokens, opts);
  const fontDir = opts.fontDir ?? FONT_DIR_ABS;
  fs.mkdirSync(outDir, { recursive: true });
  const indexPath = path.join(outDir, 'index.html');
  const stylesPath = path.join(outDir, 'styles.css');
  fs.writeFileSync(indexPath, pkg.indexHtml);
  fs.writeFileSync(stylesPath, pkg.stylesCss);
  fs.writeFileSync(path.join(outDir, 'logo.svg'), pkg.logoSvg);

  if (pkg.fontFiles.length) {
    const outFonts = path.join(outDir, 'fonts');
    fs.mkdirSync(outFonts, { recursive: true });
    for (const f of pkg.fontFiles) {
      fs.copyFileSync(path.join(fontDir, f), path.join(outFonts, f));
    }
  }
  return { ...pkg, outDir, indexPath, stylesPath };
}
