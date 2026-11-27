import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateLandingPackage, featureIcon, onPrimary } from '../src/brand/htmlGenerator.mjs';
import { resolveHeroPhoto, detectSegment } from '../src/brand/stockPhotos.mjs';
import { contrastRatio } from '../src/brand/brandTokens.mjs';
import { DEFAULT_TOKENS } from '../src/brand/campaignService.mjs';

const tokens = DEFAULT_TOKENS;

test('landing: ícones SVG nos cards, CTA final primary com seta e sem nome da marca no card geométrico', () => {
  const { standaloneHtml: h } = generateLandingPackage(tokens, { headline: 'X', cta: 'Agendar', archetype: 'local_authority', tagline: 'Sorrisos com cuidado' });
  assert.equal((h.match(/class="lp-icon"/g) ?? []).length, 3);
  assert.match(h, /class="lp-cta-btn"[^>]*>Agendar<svg class="lp-arrow"/);
  assert.match(h, /id="contato" style="--on-primary:#FFFFFF"/);
  const geo = h.match(/<div class="lp-geo-card"[\s\S]*?<\/div>/)[0];
  assert.ok(!geo.includes(tokens.brand_name));
  assert.match(geo, /Sorrisos com cuidado/);
});

test('landing com foto: tratamento editorial, crédito e HTML escapado', () => {
  const { standaloneHtml: h } = generateLandingPackage(tokens, { headline: 'X', imageUrl: 'https://img.example/a.jpg', photoCredit: 'Foto: <b>Ana</b> / Pexels' });
  assert.match(h, /class="lp-media lp-photo"/);
  assert.match(h, /Foto: &lt;b&gt;Ana&lt;\/b&gt;/);
  assert.match(h, /\.lp-photo::after/);
});

test('texto do CTA final tem contraste AA sobre qualquer primary', () => {
  for (const primary of ['#1E3A8A', '#F59E0B', '#FACC15', '#0EA5E9', '#7C3AED', '#10B981']) {
    const t = { ...tokens, colors: { ...tokens.colors, primary } };
    assert.ok(contrastRatio(onPrimary(t), primary) >= 4.5, primary);
  }
});

test('featureIcon escolhe por palavra-chave e rotaciona no padrão', () => {
  assert.match(featureIcon('Atendimento com cuidado'), /<path d="M19 14c1\.5/);
  assert.match(featureIcon('xyz', 0), /svg/);
  assert.match(featureIcon('xyz', 0), /m12 3 1\.9/);
});

test('stockPhotos: detecta segmento, usa acervo local e Pexels com timeout/erro seguro', async () => {
  assert.equal(detectSegment({ text: 'Clínica Odontológica premium' }).segment, 'odontologia');
  assert.equal(detectSegment({ text: 'algo', archetype: 'saas_modern' }).segment, null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-'));
  fs.mkdirSync(path.join(dir, 'odontologia'));
  fs.writeFileSync(path.join(dir, 'odontologia', 'a.jpg'), Buffer.from([1, 2, 3]));
  const local = await resolveHeroPhoto({ text: 'dentista' }, { env: {}, photoDir: dir, fetchImpl: () => { throw new Error('sem rede'); } });
  assert.equal(local.source, 'acervo-local');
  assert.match(local.url, /^data:image\/jpeg;base64,/);

  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ photos: [{ photographer: 'Ana', src: { large2x: 'https://images.pexels.com/p.jpg' } }] }) }; };
  const px = await resolveHeroPhoto({ text: 'restaurante' }, { env: { PEXELS_API_KEY: 'k' }, photoDir: dir, fetchImpl });
  assert.equal(px.url, 'https://images.pexels.com/p.jpg');
  assert.equal(px.credit, 'Foto: Ana / Pexels');
  assert.ok(seen.init.signal && seen.init.headers.Authorization === 'k');

  const bad = await resolveHeroPhoto({ text: 'restaurante' }, { env: { PEXELS_API_KEY: 'k' }, photoDir: dir, fetchImpl: async () => { throw new Error('timeout'); } });
  assert.equal(bad, null);
  const insecure = await resolveHeroPhoto({ text: 'restaurante' }, { env: { PEXELS_API_KEY: 'k' }, photoDir: dir, fetchImpl: async () => ({ ok: true, json: async () => ({ photos: [{ src: { large2x: 'javascript:x' } }] }) }) });
  assert.equal(insecure, null);
  assert.equal(await resolveHeroPhoto({ text: 'restaurante' }, { env: {}, photoDir: dir }), null);
});
