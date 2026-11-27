import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrandTokens, contrastRatio, SCHEMA_VERSION } from '../src/brand/brandTokens.mjs';

const base = () => ({
  schema_version: '1.0.0', brand_name: 'Luz',
  colors: { primary: '#1E3A8A', secondary: '#0EA5E9', accent: '#F59E0B', background_main: '#FFFFFF',
    surface_card: '#F1F5F9', text_primary: '#0F172A', text_muted: '#475569', cta_bg: '#1E3A8A', cta_text: '#FFFFFF' },
  typography: { heading_font: 'Poppins', body_font: 'Inter' },
  voice: { tone: 'inspirador', keywords: ['luz'] },
});

test('contraste preto/branco = 21', () => assert.equal(Math.round(contrastRatio('#000', '#fff')), 21));
test('tokens válidos passam sem correção', () => {
  const r = validateBrandTokens(base());
  assert.ok(r.ok); assert.equal(r.tokens.schema_version, SCHEMA_VERSION); assert.equal(r.corrections.length, 0);
});
test('cta ilegível é corrigido deterministicamente', () => {
  const i = base(); i.colors.cta_bg = '#FDE047'; i.colors.cta_text = '#FFFFFF';
  const r = validateBrandTokens(i);
  assert.ok(r.ok); assert.equal(r.tokens.colors.cta_text, '#0F172A');
  assert.ok(contrastRatio(r.tokens.colors.cta_bg, r.tokens.colors.cta_text) >= 4.5);
  assert.equal(r.corrections.length, 1);
});
test('hex curto é normalizado', () => {
  const i = base(); i.colors.accent = '#f90';
  assert.equal(validateBrandTokens(i).tokens.colors.accent, '#FF9900');
});
test('rejeita papel faltando, versão errada e tom inválido', () => {
  const i = base(); delete i.colors.surface_card; i.schema_version = '2.0.0'; i.voice.tone = 'x';
  const r = validateBrandTokens(i);
  assert.equal(r.ok, false); assert.equal(r.errors.length, 3);
});
