import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKit } from '../src/kit/batch.mjs';
import { resolvePhoto } from '../src/kit/photos.mjs';

const base = { marca: 'Igreja Teste', nicho: 'igreja', titulo: 'Série Esperança', data: '12/12' };
const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
const skipSemChromium = (t, err) => {
  if (/Executable doesn't exist|browserType\.launch/i.test(String(err))) return t.skip('Chromium indisponível');
  throw err;
};

test('exportação: PNG Retina real (2×) nas pastas site/social/projecao/impressos/video/brand', async (t) => {
  let kit;
  try {
    kit = await buildKit({ ...base, pieces: ['landing', 'feed', 'story', 'screen', 'slide-capa', 'decision'], teaser: '9:16' },
      { teaserRenderer: async () => Buffer.from('mp4-falso') });
  } catch (err) { return skipSemChromium(t, err); }
  const nomes = kit.zip.toString('latin1');
  for (const f of ['site/landing/index.html', 'social/feed-1080x1350.png', 'social/story-1080x1920.png',
    'projecao/screen-1920x1080.png', 'projecao/slide-capa-1920x1080.png', 'impressos/decision-frente.png',
    'impressos/decision-frente.pdf', 'video/teaser-60s-9x16.mp4', 'brand/logo.svg', 'brand/brand-tokens.json']) {
    assert.ok(nomes.includes(f), `falta ${f}`);
  }
  const feed = kit.manifest.pecas.find((p) => p.id === 'feed');
  assert.deepEqual(feed.png_px, { largura: 2160, altura: 2700 });
  assert.equal(kit.manifest.video.formato, '9:16');
  assert.ok(kit.manifest.foto.fonte === 'acervo-local', 'sem foto enviada deve usar acervo local');
});

test('rasterizador: dimensões do PNG = 2× o formato da peça', async (t) => {
  const { renderSvgPngs } = await import('../src/kit/raster.mjs');
  let out;
  try {
    out = await renderSvgPngs([{ id: 'a', width: 300, height: 150, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><rect width="300" height="150" fill="#c00"/></svg>' }]);
  } catch (err) { return skipSemChromium(t, err); }
  assert.deepEqual(pngSize(out.get('a')), { w: 600, h: 300 });
});

test('acervo: cada nicho cai numa foto real local, mesmo sem imagem enviada', async () => {
  const casos = { 'clínica de saúde': 'saude', 'igreja / série': 'geral', 'tech SaaS': 'tecnologia', 'varejo': 'moda', 'negócios': 'geral', 'algo-aleatorio': 'geral', '': 'geral' };
  for (const [nicho, pasta] of Object.entries(casos)) {
    const p = await resolvePhoto({ nicho, env: {} });
    assert.equal(p?.source, 'acervo-local', nicho);
    assert.ok(p.credit.startsWith(`${pasta}/`), `${nicho} → ${p.credit}`);
    assert.ok(p.bytes.length > 10000);
  }
});
