import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrandTokens } from '../src/brand/brandTokens.mjs';
import { buildLogoSvg, logoInline, logoDataUri, escapeXml } from '../src/brand/logo.mjs';
import { resolveFontPair, fontFaceCss, DEFAULT_PAIR } from '../src/brand/fontCatalog.mjs';

const mk = (over = {}) => validateBrandTokens({
  schema_version: '1.0.0', brand_name: 'Luz', ...over,
  colors: { primary: '#1E3A8A', secondary: '#0EA5E9', accent: '#F59E0B', background_main: '#FFFFFF',
    surface_card: '#F1F5F9', text_primary: '#0F172A', text_muted: '#475569', cta_bg: '#1E3A8A', cta_text: '#FFFFFF' },
  typography: { heading_font: 'Playfair Display', body_font: 'Inter', ...(over.typography || {}) },
  voice: { tone: 'premium', keywords: [] },
}).tokens;

const vb = (svg) => svg.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number);

test('SVG sem width/height fixos e viewBox cresce com o nome', () => {
  const a = buildLogoSvg(mk()), b = buildLogoSvg(mk({ brand_name: 'Conexão Tecnológica Avançada Ltda' }));
  assert.ok(!/<svg[^>]*\s(width|height)=/.test(a));
  assert.ok(vb(b)[0] > vb(a)[0]);
});
test('inline sem xmlns e data URI base64 decodificável', () => {
  assert.ok(!logoInline(mk()).includes('xmlns'));
  const u = logoDataUri(mk());
  assert.ok(u.startsWith('data:image/svg+xml;base64,'));
  const dec = Buffer.from(u.split(',')[1], 'base64').toString();
  assert.ok(dec.includes('xmlns="http://www.w3.org/2000/svg"'));
});
test('ícone usa primary/secondary/accent e título usa heading_font', () => {
  const s = buildLogoSvg(mk());
  for (const c of ['#1E3A8A', '#0EA5E9', '#F59E0B']) assert.ok(s.includes(`fill="${c}"`));
  assert.ok(s.includes("font-family=\"'Playfair Display', serif\""));
});
test('escape seguro de & e \' no nome', () => {
  const s = buildLogoSvg(mk({ brand_name: `Pão & Cia's <b>` }));
  assert.ok(s.includes('Pão &amp; Cia&apos;s &lt;b&gt;'));
  assert.ok(!s.includes('<b>'));
  assert.equal(escapeXml('"'), '&quot;');
});
test('fonte fora do catálogo faz fallback ao par padrão, sem rede', () => {
  const r = resolveFontPair({ heading_font: 'Comic Neue', body_font: 'Papyrus' });
  assert.equal(r.heading, DEFAULT_PAIR.heading_font); assert.equal(r.body, DEFAULT_PAIR.body_font);
  assert.equal(r.fallbacks.length, 2);
  const css = fontFaceCss(r);
  assert.ok(!/https?:/.test(css)); assert.ok(css.includes('.woff2'));
  assert.ok(buildLogoSvg(mk({ typography: { heading_font: 'Comic Neue' } })).includes("'Poppins'"));
});
test('catálogo é case-insensitive e par válido não gera fallback', () => {
  const r = resolveFontPair({ heading_font: 'lora', body_font: 'INTER' });
  assert.equal(r.heading, 'Lora'); assert.equal(r.fallbacks.length, 0);
});
