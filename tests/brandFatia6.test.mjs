import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fillQuickBrief, LANDING_ARCHETYPES } from '../src/brand/quickBrief.mjs';
import { generateLandingPackage } from '../src/brand/htmlGenerator.mjs';
import { generateCampaignPiece, getEntry, publishLanding, publishedFile, slugify } from '../src/brand/campaignService.mjs';
import { contrastRatio } from '../src/brand/brandTokens.mjs';

const fakeRender = async () => ({ buffer: Buffer.from('png'), inspection: [] });

test('Briefing Rápido sem chave usa fallback determinístico e respeita WCAG AA', async () => {
  const r = await fillQuickBrief('Clínica odontológica premium em Londrina focada em lentes de contato', { env: {} });
  assert.equal(r.source, 'deterministic');
  assert.equal(r.archetype, 'local_authority');
  assert.equal(r.template, 'landing');
  assert.match(r.tokens.brand_name, /Londrina/);
  assert.ok(r.headline.length <= 90 && r.subtitle.length <= 160 && r.cta.length <= 34 && r.tagline.length <= 80);
  assert.ok(contrastRatio(r.tokens.colors.cta_bg, r.tokens.colors.cta_text) >= 4.5);
  assert.equal(r.content.features.length, 3);
  assert.equal(r.content.faq.length, 3);
  assert.ok(r.tokens.typography.heading_font && r.tokens.logo_primitive);
});

test('Briefing Rápido escolhe arquétipos e rejeita texto inválido', async () => {
  assert.equal((await fillQuickBrief('Plataforma SaaS de automação para equipes de vendas', { env: {} })).archetype, 'saas_modern');
  assert.equal((await fillQuickBrief('Lançamento do novo produto de coleção de verão', { env: {} })).archetype, 'product_launch');
  await assert.rejects(fillQuickBrief('curto', { env: {} }));
  await assert.rejects(fillQuickBrief('x'.repeat(1300), { env: {} }));
});

test('Briefing Rápido cai no fallback quando o provedor falha', async () => {
  const r = await fillQuickBrief('Plataforma SaaS de automação para equipes de vendas', {
    env: { GEMINI_API_KEY: 'k', STUDIO_BRIEF_GEMINI: '1' }, fetchImpl: async () => { throw new Error('rede'); },
  });
  assert.equal(r.source, 'deterministic');
});

test('3 arquétipos geram marcações distintas com CSS Variables e logo inline', async () => {
  const { tokens } = await fillQuickBrief('Clínica odontológica premium em Londrina', { env: {} });
  const out = {};
  for (const archetype of LANDING_ARCHETYPES) {
    const pkg = generateLandingPackage(tokens, { archetype, headline: 'H', subtitle: 'S', cta: 'Ir' });
    out[archetype] = pkg.indexHtml;
    assert.match(pkg.stylesCss, /--color-primary/);
    assert.match(pkg.indexHtml, /<svg/);
    assert.match(pkg.indexHtml, new RegExp(`lp-${archetype}`));
    assert.match(pkg.indexHtml, /data-parallax/);
  }
  assert.match(out.saas_modern, /lp-metrics/);
  assert.match(out.saas_modern, /lp-floating/);
  assert.match(out.local_authority, /<details>/);
  assert.match(out.product_launch, /lp-offer/);
  assert.doesNotMatch(out.local_authority, /lp-offer/);
  assert.match(out.saas_modern, /--i:3/); // stagger
});

test('motion: stagger, parallax e ?static=true presentes no runtime', () => {
  const pkg = generateLandingPackage({ ...fillTokens() }, { archetype: 'saas_modern' });
  assert.match(pkg.indexHtml, /static/);
  assert.match(pkg.stylesCss, /transition-delay:calc\(var\(--i,0\)\*110ms\)/);
  assert.match(pkg.stylesCss, /\.cta::after/);
});

function fillTokens() {
  return {
    schema_version: '1.0.0', brand_name: 'Acme',
    colors: { primary: '#1E3A8A', secondary: '#0EA5E9', accent: '#F59E0B', background_main: '#FFFFFF', surface_card: '#F1F5F9', text_primary: '#0F172A', text_muted: '#475569', cta_bg: '#1E3A8A', cta_text: '#FFFFFF' },
    typography: { heading_font: 'Poppins', body_font: 'Inter' }, voice: { tone: 'premium', keywords: [] },
  };
}

test('publicação grava index/styles/logo/fonts em diretório estático e bloqueia traversal', async () => {
  const brief = await fillQuickBrief('Plataforma SaaS de automação para equipes de vendas', { env: {} });
  const piece = await generateCampaignPiece({ template: 'landing', tokens: brief.tokens, archetype: brief.archetype, content: brief.content, headline: brief.headline }, { env: {}, renderImpl: fakeRender });
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'svp-pub-'));
  try {
    const pub = publishLanding(getEntry(piece.id), 'Meu Site Ótimo!', { baseDir: base });
    assert.equal(pub.slug, 'meu-site-otimo');
    assert.equal(pub.url, '/published/meu-site-otimo/');
    for (const f of ['index.html', 'styles.css', 'logo.svg']) assert.ok(fs.existsSync(path.join(base, pub.slug, f)), f);
    assert.ok(pub.files.some((f) => f.startsWith('fonts/')));
    assert.match(publishedFile('meu-site-otimo/index.html', { baseDir: base }).type, /html/);
    assert.equal(publishedFile('meu-site-otimo/../../etc/passwd', { baseDir: base }), null);
    assert.equal(publishedFile('..%2f/index.html', { baseDir: base }), null);
    assert.equal(publishedFile('meu-site-otimo/fonts/x.txt', { baseDir: base }), null);
    // republicar o mesmo slug substitui sem erro
    publishLanding(getEntry(piece.id), 'meu-site-otimo', { baseDir: base });
    assert.equal(slugify('../../etc'), 'etc');
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('só Landing Page é publicável', () => {
  assert.throws(() => publishLanding({ template: 'story', tokens: fillTokens(), id: 'abcdefg' }, 'x'), /Landing/);
});
