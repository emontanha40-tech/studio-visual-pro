import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrandTokens, COLOR_ROLES } from '../src/brand/brandTokens.mjs';
import { generateHtml, rootVarsCss, safeFontFaceCss } from '../src/brand/htmlGenerator.mjs';
import { resolveFontPair } from '../src/brand/fontCatalog.mjs';
import { renderHtml } from '../src/brand/renderer.mjs';

const tokens = validateBrandTokens({
  schema_version: '1.0.0', brand_name: 'Connect & Cia',
  colors: { primary: '#1E3A8A', secondary: '#0EA5E9', accent: '#F59E0B', background_main: '#FFFFFF',
    surface_card: '#F1F5F9', text_primary: '#0F172A', text_muted: '#475569', cta_bg: '#1E3A8A', cta_text: '#FFFFFF' },
  typography: { heading_font: 'Playfair Display', body_font: 'Inter' },
  voice: { tone: 'premium', keywords: [] },
}).tokens;

test(':root contém as 9 cores e as 2 fontes', () => {
  const css = rootVarsCss(tokens);
  for (const r of COLOR_ROLES) assert.ok(css.includes(`--color-${r.replace(/_/g, '-')}:`), r);
  assert.ok(css.includes('--font-heading') && css.includes('--font-body'));
});
test('@font-face omitido quando .woff2 não existe; incluído quando existe', () => {
  const pair = resolveFontPair(tokens.typography);
  const none = safeFontFaceCss(pair, { exists: () => false });
  assert.equal(none.css, ''); assert.equal(none.missing.length, 2);
  const all = safeFontFaceCss(pair, { exists: () => true });
  assert.ok(all.css.includes('@font-face') && all.missing.length === 0);
});
test('HTML usa variáveis, escapa nome e aplica ponto focal', () => {
  const { html } = generateHtml(tokens, { template: 'post', headline: '<b>x</b>', imageUrl: 'data:image/png;base64,AAAA', focalX: 30, focalY: 120 });
  assert.ok(html.includes('object-position:30% 100%'));
  assert.ok(!html.includes('<b>x</b>') && html.includes('Connect &amp; Cia'));
  assert.ok(html.includes('var(--color-cta-bg)'));
  assert.throws(() => generateHtml(tokens, { template: 'nope' }));
});
test('Playwright renderiza PNG com deviceScaleFactor 2 (retina)', async () => {
  const { html } = generateHtml(tokens, { template: 'banner', headline: 'Sua marca em foco', subtitle: 'Gerado a partir dos Brand Tokens' });
  const r = await renderHtml(html, { width: 600, height: 314, deviceScaleFactor: 2 });
  assert.deepEqual([...r.buffer.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal(r.buffer.readUInt32BE(16), 1200);
  assert.equal(r.buffer.readUInt32BE(20), 628);
});
