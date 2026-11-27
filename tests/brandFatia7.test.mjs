import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fillQuickBrief, sanitizeText } from '../src/brand/quickBrief.mjs';
import { generateKit, SOCIAL_PIECES } from '../src/brand/kitService.mjs';
import { openProjectStore, isKitId } from '../src/brand/projectStore.mjs';
import { applyPrimaryColor, sanitizeTestimonials, DEFAULT_TOKENS } from '../src/brand/campaignService.mjs';
import { generateLandingPackage } from '../src/brand/htmlGenerator.mjs';
import { contrastRatio } from '../src/brand/brandTokens.mjs';
import { createServer } from '../server.mjs';

/** Extrai nomes e conteúdos das entradas de um Buffer ZIP gerado por buildZip. */
function readZipEntries(buf) {
  const entries = new Map();
  let off = 0;
  while (off + 30 <= buf.length && buf.readUInt32LE(off) === 0x04034b50) {
    const compSize = buf.readUInt32LE(off + 18);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const name = buf.subarray(off + 30, off + 30 + nameLen).toString('utf8');
    const dataStart = off + 30 + nameLen + extraLen;
    const raw = zlib.inflateRawSync(buf.subarray(dataStart, dataStart + compSize));
    entries.set(name, raw);
    off = dataStart + compSize;
  }
  return entries;
}

const fakeRender = async (html, opts) => ({
  buffer: Buffer.from(`PNG:${opts.width}x${opts.height}@${opts.deviceScaleFactor}x`),
  inspection: [],
});

test('Fatia 7.1 — Gemini real ativo por padrão com GEMINI_API_KEY, sanitiza HTML/invisíveis e corrige contraste WCAG AA', async () => {
  let called = 0;
  const geminiDraft = {
    brand_name: '<b>Clínica\u200B Lumina</b>',
    tagline: '<script>alert(1)</script>Sorriso natural em Londrina',
    headline: 'Lentes de contato dental\u0007',
    subtitle: 'Atendimento <i>personalizado</i> com planejamento digital.',
    cta: 'Agendar <b>avaliação</b>',
    archetype: 'local_authority',
    colors: {
      primary: '#FDE047', secondary: '#0EA5E9', accent: '#F59E0B',
      background_main: '#FFFFFF', surface_card: '#F8FAFC',
      text_primary: '#0F172A', text_muted: '#475569',
      cta_bg: '#FDE047', cta_text: '#FFFFFF', // contraste péssimo de propósito!
    },
    typography: { heading_font: 'Playfair Display', body_font: 'Inter' },
    logo_primitive: 'petal',
    content: {
      features: [
        { title: '<b>Planejamento</b>', text: 'Etapa inicial com avaliação.' },
        { title: 'Lentes', text: 'Opções sob medida.' },
        { title: 'Acompanhamento', text: 'Suporte pós-procedimento.' },
      ],
      faq: [
        { title: 'Como agendar?', text: 'Fale com a equipe.' },
        { title: 'Quanto tempo?', text: 'Consulte na avaliação.' },
        { title: 'Onde fica?', text: 'Em Londrina.' },
      ],
      ctaHeadline: 'Agende sua visita',
      ctaSubtitle: 'Consulte horários com a equipe.',
    },
  };

  const fetchImpl = async () => {
    called += 1;
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(geminiDraft) }] } }],
      }),
    };
  };

  // Sem STUDIO_BRIEF_GEMINI=1: Gemini já deve ser chamado por padrão quando GEMINI_API_KEY existe
  const res = await fillQuickBrief('Clínica odontológica premium em Londrina focada em lentes de contato', {
    env: { GEMINI_API_KEY: 'test-key-123' },
    fetchImpl,
  });

  assert.equal(called, 1);
  assert.equal(res.source, 'gemini');
  assert.equal(res.tokens.brand_name, 'Clínica Lumina');
  assert.doesNotMatch(res.tagline, /<|>/);
  assert.doesNotMatch(res.headline, /\u0007/);
  assert.doesNotMatch(res.subtitle, /<i>/);
  assert.doesNotMatch(res.cta, /<b>/);
  // Validador WCAG AA deve ter corrigido o cta_text para contraste >= 4.5
  assert.ok(contrastRatio(res.tokens.colors.cta_bg, res.tokens.colors.cta_text) >= 4.5);
  assert.ok(res.corrections.length >= 1);

  // STUDIO_BRIEF_GEMINI=0 desliga explicitamente
  const disabled = await fillQuickBrief('Clínica odontológica premium em Londrina focada em lentes de contato', {
    env: { GEMINI_API_KEY: 'test-key-123', STUDIO_BRIEF_GEMINI: '0' },
    fetchImpl,
  });
  assert.equal(called, 1);
  assert.equal(disabled.source, 'deterministic');

  // Timeout/falha de rede cai no fallback determinístico sem quebrar
  const fallbackRes = await fillQuickBrief('Clínica odontológica premium em Londrina focada em lentes de contato', {
    env: { GEMINI_API_KEY: 'test-key-123' },
    fetchImpl: async () => { throw new Error('timeout'); },
  });
  assert.equal(fallbackRes.source, 'deterministic');
  assert.ok(contrastRatio(fallbackRes.tokens.colors.cta_bg, fallbackRes.tokens.colors.cta_text) >= 4.5);
  assert.equal(sanitizeText('<b>Oi\u200B</b>'), 'Oi');
});

test('Fatia 7.2 — Kit Completo em 1 clique gera Landing publicada + 3 sociais Retina 2x + ZIP estruturado', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svp-kit-'));
  const pubDir = path.join(tmpDir, 'published');
  const dbPath = path.join(tmpDir, 'studio.db');
  const store = openProjectStore(dbPath);
  const scales = [];
  const spyRender = async (html, opts) => {
    scales.push({ width: opts.width, height: opts.height, scale: opts.deviceScaleFactor, fullPage: Boolean(opts.fullPage) });
    return fakeRender(html, opts);
  };

  try {
    const kit = await generateKit({
      tokens: DEFAULT_TOKENS,
      archetype: 'local_authority',
      headline: 'Clínica Exemplo Londrina',
      subtitle: 'Atendimento odontológico focado em lentes de contato.',
      cta: 'Agendar visita',
      testimonials: [{ name: 'Ana Paula', text: 'Atendimento excelente e pontual.' }],
    }, { store, publishDir: pubDir, env: {}, renderImpl: spyRender });

    assert.ok(isKitId(kit.id));
    assert.equal(kit.liveUrl, `/published/${kit.slug}/`);
    assert.equal(kit.landing.status, 'approved');
    assert.equal(kit.social.length, 3);
    assert.deepEqual(kit.social.map((s) => s.file), SOCIAL_PIECES.map((s) => s.file));
    for (const s of kit.social) {
      assert.equal(s.status, 'approved');
      assert.equal(s.thumbUrl, `/api/kits/${kit.id}/social/${s.file}`);
    }

    // 1 landing (scale 1) + 3 sociais em Retina (scale 2)
    assert.equal(scales.length, 4);
    assert.equal(scales[0].scale, 1);
    assert.equal(scales[1].scale, 2);
    assert.equal(scales[2].scale, 2);
    assert.equal(scales[3].scale, 2);

    // Publicação em disco
    assert.ok(fs.existsSync(path.join(pubDir, kit.slug, 'index.html')));
    assert.ok(fs.existsSync(path.join(pubDir, kit.slug, 'styles.css')));
    assert.ok(fs.existsSync(path.join(pubDir, kit.slug, 'logo.svg')));

    // Estrutura do ZIP salvo no SQLite
    const savedZip = store.getZip(kit.id);
    assert.ok(savedZip && savedZip.data.length > 0);
    const entries = readZipEntries(savedZip.data);
    for (const expected of [
      'site/index.html', 'site/styles.css', 'site/logo.svg',
      'social/post-feed.png', 'social/story.png', 'social/banner.png',
      'brand/logo.svg', 'brand/brand-tokens.json',
    ]) {
      assert.ok(entries.has(expected), `ZIP deve conter ${expected}`);
    }
    assert.ok([...entries.keys()].some((k) => k.startsWith('site/fonts/') && k.endsWith('.woff2')));
    const tokensJson = JSON.parse(entries.get('brand/brand-tokens.json').toString('utf8'));
    assert.equal(tokensJson.brand_name, DEFAULT_TOKENS.brand_name);
    assert.match(entries.get('site/index.html').toString('utf8'), /Ana Paula/);
  } finally {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Fatia 7.3 — Ajuste fino (cor primária WCAG AA + arquétipo + depoimentos reais opcionais) sem chamar IA', () => {
  // Cor primária clara força auto-correção de contraste do texto do botão
  const fixed = applyPrimaryColor(DEFAULT_TOKENS, '#FFEE55');
  assert.equal(fixed.tokens.colors.primary, '#FFEE55');
  assert.equal(fixed.tokens.colors.cta_bg, '#FFEE55');
  assert.ok(contrastRatio(fixed.tokens.colors.cta_bg, fixed.tokens.colors.cta_text) >= 4.5);
  assert.ok(fixed.corrections.length >= 1);

  // Depoimentos são sanitizados, limitados a 3 e ignoram vazios
  const clean = sanitizeTestimonials([
    { name: '<b>Maria</b>', text: 'Ótimo atendimento!' },
    { name: '', text: 'Sem nome deve sumir' },
    { name: 'João', text: '<i>Muito bom</i>' },
    { name: 'Carla', text: 'Recomendo.' },
    { name: 'Quarto', text: 'Deve ser cortado pelo limite de 3' },
  ]);
  assert.equal(clean.length, 3);
  assert.equal(clean[0].name, 'Maria');
  assert.equal(clean[1].text, 'Muito bom');

  // Render com depoimentos em local_authority e saas_modern; sem depoimentos nunca inventa
  const withQuotes = generateLandingPackage(fixed.tokens, { archetype: 'saas_modern', testimonials: clean });
  assert.match(withQuotes.indexHtml, /Maria/);
  assert.match(withQuotes.indexHtml, /Ótimo atendimento!/);
  const withoutQuotes = generateLandingPackage(fixed.tokens, { archetype: 'saas_modern' });
  assert.doesNotMatch(withoutQuotes.indexHtml, /<blockquote>/);
});

test('Fatia 7.4 — Persistência SQLite e rotas HTTP (/api/brand/kit, /api/kits, /zip, /social, /published)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svp-http-kit-'));
  const pubDir = path.join(tmpDir, 'published');
  const dbPath = path.join(tmpDir, 'studio.db');
  const store1 = openProjectStore(dbPath);
  const server = createServer({ projectStore: store1, kitDeps: { publishDir: pubDir, env: {}, renderImpl: fakeRender } });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const req = (urlPath, opts = {}) => fetch(`${base}${urlPath}`, {
    ...opts,
    headers: { host: `127.0.0.1:${process.env.PORT || 4173}`, ...(opts.headers ?? {}) },
  });

  try {
    // 1. Criar kit via HTTP
    const createRes = await req('/api/brand/kit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokens: DEFAULT_TOKENS,
        archetype: 'product_launch',
        headline: 'Lançamento Exclusivo',
        primaryColor: '#FDE047',
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(isKitId(created.id));
    assert.equal(created.archetype, 'product_launch');

    // 2. Listar histórico via GET /api/kits
    const listRes = await req('/api/kits');
    assert.equal(listRes.status, 200);
    const { kits } = await listRes.json();
    assert.equal(kits.length, 1);
    assert.equal(kits[0].id, created.id);
    assert.equal(kits[0].liveAvailable, true);

    // 3. Baixar ZIP via GET /api/kits/:id/zip
    const zipRes = await req(created.downloadUrl);
    assert.equal(zipRes.status, 200);
    assert.equal(zipRes.headers.get('content-type'), 'application/zip');
    const zipBuf = Buffer.from(await zipRes.arrayBuffer());
    assert.equal(zipBuf.readUInt32LE(0), 0x04034b50);

    // 4. Abrir miniatura social via GET /api/kits/:id/social/post-feed.png
    const pngRes = await req(`/api/kits/${created.id}/social/post-feed.png`);
    assert.equal(pngRes.status, 200);
    assert.equal(pngRes.headers.get('content-type'), 'image/png');

    // 5. Abrir site publicado ao vivo via GET /published/<slug>/
    const liveRes = await req(created.liveUrl);
    assert.equal(liveRes.status, 200);
    assert.match(await liveRes.text(), /Lançamento Exclusivo/);

    // 6. ID inválido retorna 404
    const badRes = await req('/api/kits/../../etc/zip');
    assert.equal(badRes.status, 404);
  } finally {
    server.close();
    store1.close();
  }

  // 7. Reabrir banco SQLite do disco confirma persistência durável
  const store2 = openProjectStore(dbPath);
  try {
    const persisted = store2.listKits(10);
    assert.equal(persisted.length, 1);
    assert.ok(store2.getZip(persisted[0].id));
    assert.ok(store2.getFile(persisted[0].id, 'banner.png'));
  } finally {
    store2.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
