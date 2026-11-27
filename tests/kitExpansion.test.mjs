import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BRAND_KITS } from '../src/website/brandKit.mjs';
import { KIT_PIECES, PRESETS } from '../src/kit/catalog.mjs';
import { buildIdentity, contrastRatio } from '../src/kit/identity.mjs';
import { renderPieceSVG } from '../src/kit/render.mjs';
import { renderLinktreeHTML, renderHotsiteHTML, renderEmailKitHTML } from '../src/kit/webTemplates.mjs';
import { buildKit } from '../src/kit/batch.mjs';
import { renderSvgPngs } from '../src/kit/raster.mjs';

const sample = {
  marca: 'Igreja Viva',
  nicho: 'igreja',
  slogan: 'Conferência <b>Esperança</b> 2026',
  subtitulo: 'Três dias de adoração, palavra e comunhão.',
  data: '14 a 16 de Novembro · 19h30',
  local: 'Av. Higienópolis, 1200 — Londrina/PR',
  modelo: 'ministerial-serie',
};

test('5 modelos visuais distintos com contraste WCAG AA e presentes na tela /kit', async () => {
  const expected = ['editorial-clean', 'tech-cinematografico', 'comercial-conversao', 'ministerial-serie', 'minimalista-suico'];
  const bgs = new Set();
  const primaries = new Set();
  for (const id of expected) {
    assert.ok(BRAND_KITS[id], `modelo ausente: ${id}`);
    const identity = buildIdentity({ ...sample, modelo: id });
    assert.ok(contrastRatio(identity.kit.colors.text, identity.kit.colors.bg) >= 4.5, `${id} text/bg`);
    assert.ok(contrastRatio(identity.kit.colors.primary, identity.kit.colors.bg) >= 4.5, `${id} primary/bg`);
    assert.ok(contrastRatio(identity.kit.colors.onPrimary, identity.kit.colors.primary) >= 4.5, `${id} onPrimary/primary`);
    bgs.add(identity.kit.colors.bg);
    primaries.add(identity.kit.colors.primary);
  }
  assert.equal(bgs.size, 5, 'cada direção de arte deve ter fundo distinto');
  assert.equal(primaries.size, 5, 'cada direção de arte deve ter cor primária distinta');

  const kitHtml = await readFile(new URL('../public/kit.html', import.meta.url), 'utf8');
  for (const id of expected) assert.ok(kitHtml.includes(`value="${id}"`), `option ${id} ausente em kit.html`);
});

test('catálogo WEB e PROJEÇÃO expandidos + presets íntegros', () => {
  const ids = new Set(KIT_PIECES.map((p) => p.id));
  for (const id of ['landing', 'linktree', 'hotsite', 'email-kit', 'lower-third', 'welcome-countdown']) {
    assert.ok(ids.has(id), `peça ausente no catálogo: ${id}`);
  }
  const lt = KIT_PIECES.find((p) => p.id === 'lower-third');
  assert.equal(lt.category, 'projecao');
  assert.equal(lt.transparent, true);
  assert.deepEqual([lt.width, lt.height], [1920, 1080]);

  const wc = KIT_PIECES.find((p) => p.id === 'welcome-countdown');
  assert.equal(wc.category, 'projecao');
  assert.deepEqual([wc.width, wc.height], [1920, 1080]);

  for (const preset of PRESETS) {
    for (const pid of preset.pieces) assert.ok(ids.has(pid), `preset ${preset.id} referencia peça inexistente: ${pid}`);
  }
});

test('WEB expandido: Linktree Pro, Hotsite interativo e Kit de E-mail HTML', () => {
  const identity = buildIdentity(sample);

  const bio = renderLinktreeHTML(identity, { photoFile: 'foto-base.jpg', whatsapp: '5543999990000' });
  assert.ok(bio.includes('bio-page'));
  assert.ok(bio.includes('dc-progress') && bio.includes('dc-drawer'));
  assert.ok(bio.includes('https://wa.me/5543999990000'));
  assert.ok(bio.includes('foto-base.jpg'));
  assert.equal(bio.includes('<b>Esperança</b>'), false);

  const hotsite = renderHotsiteHTML(identity, { whatsapp: '5543999990000' });
  assert.ok(hotsite.includes('role="tablist"'));
  assert.ok(hotsite.includes('data-hs-tab'));
  assert.ok(hotsite.includes('<details>'));
  assert.ok(hotsite.includes('id="localizacao"'));
  assert.ok(hotsite.includes('google.com/maps/search'));
  assert.ok(hotsite.includes('dc-progress') && hotsite.includes('dc-drawer'));
  assert.equal(hotsite.includes('<b>Esperança</b>'), false);

  const email = renderEmailKitHTML(identity);
  assert.ok(email.signatureHtml.includes('<table role="presentation"'));
  assert.ok(email.newsletterHeaderHtml.includes('<table role="presentation"'));
  assert.ok(email.previewHtml.includes('data-copy="code-sig"'));
  assert.ok(email.previewHtml.includes('data-copy="code-news"'));
  assert.equal(email.signatureHtml.includes('<b>Esperança</b>'), false);
});

test('PROJEÇÃO expandida: Lower Third transparente e Tela de Boas-Vindas / Contagem Regressiva', async (t) => {
  const identity = buildIdentity(sample);
  const ltPiece = KIT_PIECES.find((p) => p.id === 'lower-third');
  const wcPiece = KIT_PIECES.find((p) => p.id === 'welcome-countdown');

  const ltSvg = renderPieceSVG(ltPiece, identity);
  assert.ok(ltSvg.includes('viewBox="0 0 1920 1080"'));
  assert.equal(ltSvg.includes('<rect width="1920" height="1080"'), false, 'lower-third não pode ter fundo opaco total');
  assert.equal(ltSvg.includes('<b>Esperança</b>'), false);

  const wcSvg = renderPieceSVG(wcPiece, identity);
  assert.ok(wcSvg.includes('SEJA BEM-VINDO'));
  assert.ok(wcSvg.includes('COMEÇAMOS EM BREVE'));
  assert.ok(wcSvg.includes('05:00'));

  // Verifica PNG real com transparência (color type 6 = RGBA) via Playwright
  let pngs;
  try {
    pngs = await renderSvgPngs([{ id: 'lower-third', width: 320, height: 180, svg: ltSvg, transparent: true }], { scale: 1 });
  } catch (err) {
    if (/Executable doesn't exist|browserType\.launch/i.test(String(err))) return t.skip('Chromium indisponível');
    throw err;
  }
  const buf = pngs.get('lower-third');
  assert.equal(buf[25], 6, 'PNG da Lower Third deve ser RGBA (color type 6) com canal alfa');
});

test('buildKit empacota todas as novas peças WEB e PROJEÇÃO nas pastas corretas do ZIP', async () => {
  const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const { zip, manifest } = await buildKit(
    { ...sample, pieces: ['linktree', 'hotsite', 'email-kit', 'lower-third', 'welcome-countdown'] },
    {
      photoResolver: async () => null,
      rasterizer: async (items) => {
        const lt = items.find((x) => x.id === 'lower-third');
        assert.equal(lt?.transparent, true, 'rasterizer deve receber transparent=true para lower-third');
        return new Map(items.map((x) => [x.id, fakePng]));
      },
    },
  );
  const raw = zip.toString('latin1');
  for (const expectedPath of [
    'site/linktree/index.html',
    'site/hotsite/index.html',
    'site/email-kit/index.html',
    'site/email-kit/assinatura-email.html',
    'site/email-kit/cabecalho-newsletter.html',
    'projecao/lower-third-1920x1080.png',
    'projecao/lower-third-1920x1080.svg',
    'projecao/welcome-countdown-1920x1080.png',
    'projecao/welcome-countdown-1920x1080.svg',
  ]) {
    assert.ok(raw.includes(expectedPath), `arquivo ausente no ZIP: ${expectedPath}`);
  }
  assert.equal(manifest.pecas.length, 5);
});

test('hotsite: cabeçalho mobile permite logo/CTA encolherem com marca longa', () => {
  const identity = buildIdentity({ ...sample, marca: 'Comunidade Cristã Internacional Videira do Reino de Londrina' });
  const html = renderHotsiteHTML(identity, { whatsapp: '5543999990000' });
  assert.match(html, /\.lp-logo\{flex:1 1 auto;min-width:0\}/);
  assert.match(html, /\.lp-logo svg\{max-width:100%\}/);
  assert.match(html, /@media\(max-width:680px\)\{\.lp-logo\{height:34px\}/);
});
