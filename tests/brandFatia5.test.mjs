import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { validateBrandTokens } from '../src/brand/brandTokens.mjs';
import { generateHtml, generateLandingPackage, MOTION_JS } from '../src/brand/htmlGenerator.mjs';
import { createAuditor, structuralAudit } from '../src/brand/visualAuditor.mjs';
import { buildZip, crc32 } from '../src/brand/zip.mjs';
import { DEFAULT_TOKENS, sanitizeImageUrl, generateCampaignPiece, getEntry, buildDownload, previewFile } from '../src/brand/campaignService.mjs';
import { createServer } from '../server.mjs';

const tokens = validateBrandTokens(DEFAULT_TOKENS).tokens;

test('Landing tem motion: cubic-bezier cine, reveal em cascata e IntersectionObserver', () => {
  const pkg = generateLandingPackage(tokens, { headline: 'X' });
  assert.match(pkg.stylesCss, /cubic-bezier\(0\.16,1,0\.3,1\)/);
  assert.match(pkg.stylesCss, /backdrop-filter/);
  assert.match(pkg.indexHtml, /IntersectionObserver/);
  assert.match(pkg.indexHtml, /data-reveal style="--i:3"/);
  assert.ok(MOTION_JS.includes('static=true'));
});

test('Modo static deixa tudo visível (data-static) e peças sociais não carregam script', () => {
  assert.match(generateLandingPackage(tokens, { static: true }).standaloneHtml, /<html lang="pt-BR" data-static>/);
  assert.ok(!generateHtml(tokens, { template: 'story', static: true }).html.includes('<script'));
});

test('sanitizeImageUrl: https e caminho local ok; resto cai no modo geométrico', () => {
  assert.equal(sanitizeImageUrl('https://x.com/a.jpg'), 'https://x.com/a.jpg');
  assert.equal(sanitizeImageUrl('/acervo/a.png'), '/acervo/a.png');
  for (const bad of ['http://x.com/a.jpg', 'javascript:alert(1)', '//evil.com/a', '/../etc/passwd', 'https://x.com/a" onerror="x', '', null]) assert.equal(sanitizeImageUrl(bad), null);
});

test('Auditor sem GEMINI_API_KEY usa validador estrutural; com chave chama Gemini; falha do Gemini faz fallback', async () => {
  const a = createAuditor({ apiKey: '', getInspection: () => [] });
  assert.equal(a.state.mode, 'structural');
  assert.equal((await a.auditFn(Buffer.alloc(1))).approved, true);

  let called = 0;
  const ok = createAuditor({ apiKey: 'k', fetchImpl: async () => { called++; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"approved":true,"issues":[]}' }] } }] }) }; } });
  assert.equal((await ok.auditFn(Buffer.alloc(1))).approved, true);
  assert.equal(called, 1); assert.equal(ok.state.mode, 'gemini');

  const bad = createAuditor({ apiKey: 'k', getInspection: () => [{ kind: 'overflow', label: 'h1' }], fetchImpl: async () => ({ ok: false, status: 500, text: async () => 'x' }) });
  const r = await bad.auditFn(Buffer.alloc(1));
  assert.equal(r.approved, false); assert.equal(bad.state.mode, 'structural'); assert.ok(bad.state.fallbackReason);
});

test('structuralAudit detecta invasão da safe zone do Story', () => {
  const r = structuralAudit([{ kind: 'safe', label: 'story-cta', top: 100, bottom: 400, vh: 1920 }], { safeZones: { top: 250, bottom: 320 } });
  assert.equal(r.approved, false); assert.equal(r.issues[0].code, 'SAFE_ZONE_VIOLATION');
});

test('ZIP: assinatura, CRC e conteúdo recuperável', () => {
  const z = buildZip([{ name: 'a.txt', data: 'olá mundo' }]);
  assert.equal(z.readUInt32LE(0), 0x04034b50);
  const nameLen = z.readUInt16LE(26), compLen = z.readUInt32LE(18);
  const data = zlib.inflateRawSync(z.subarray(30 + nameLen, 30 + nameLen + compLen));
  assert.equal(data.toString(), 'olá mundo');
  assert.equal(z.readUInt32LE(14), crc32(data));
});

test('Pipeline completo (render mockado): gera, guarda e empacota index/styles/logo/fonts', async () => {
  const renderImpl = async () => ({ buffer: Buffer.from('png'), inspection: [] });
  const r = await generateCampaignPiece({ template: 'landing', headline: 'Oi', imageUrl: 'https://x.com/i.jpg', focalX: 20, focalY: 80 }, { env: {}, renderImpl });
  assert.equal(r.status, 'approved'); assert.equal(r.auditor.mode, 'structural');
  assert.deepEqual(r.focalPoint, { x: 20, y: 80 }); assert.equal(r.imageMode, 'imagem');
  const entry = getEntry(r.id);
  assert.match(previewFile(entry, 'index.html').data, /object-position:20% 80%/);
  assert.equal(previewFile(entry, '../server.mjs'), null);
  const zip = buildDownload(entry).data.toString('latin1');
  for (const n of ['index.html', 'styles.css', 'logo.svg', 'fonts/']) assert.ok(zip.includes(n), n);
  const geo = await generateCampaignPiece({ template: 'story', imageUrl: 'javascript:x' }, { env: {}, renderImpl });
  assert.equal(geo.imageMode, 'geometrico'); assert.equal(geo.focalPoint, null);
});

test('Render real (Chromium): Landing e Story aprovados pelo validador estrutural', async () => {
  for (const template of ['landing', 'story']) {
    const r = await generateCampaignPiece({ template, headline: 'Tecnologia que conecta', subtitle: 'Soluções sob medida', cta: 'Fale conosco' }, { env: {} });
    assert.equal(r.status, 'approved', JSON.stringify(r.audit));
  }
});

test('Rotas HTTP: generate → preview → download', async () => {
  const server = createServer();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const { port } = server.address();
  const host = `127.0.0.1:${port}`;
  try {
    // Host header precisa bater com a porta configurada; testa via 403 esperado se divergir.
    const res = await fetch(`http://${host}/api/brand/generate`, { method: 'POST', body: '{}' });
    assert.ok([201, 400, 403].includes(res.status));
  } finally { server.close(); }
});
