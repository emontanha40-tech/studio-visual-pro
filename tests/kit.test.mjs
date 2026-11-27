import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { KIT_PIECES, PRESETS, resolvePieces } from '../src/kit/catalog.mjs';
import { buildIdentity, contrastRatio } from '../src/kit/identity.mjs';
import { renderPieceSVG, renderLandingHTML } from '../src/kit/render.mjs';
import { buildKit } from '../src/kit/batch.mjs';
import { createZip } from '../src/kit/zip.mjs';
import { resolvePhoto } from '../src/kit/photos.mjs';
import { createServer } from '../server.mjs';

const input = { marca: 'Clínica Sorriso', nicho: 'odontologia', slogan: 'Seu sorriso <b>&</b> cuidado', data: '12/12 às 19h' };

test('catálogo: presets só referenciam peças existentes e dimensões corretas', () => {
  for (const p of PRESETS) for (const id of p.pieces) assert.ok(KIT_PIECES.some((x) => x.id === id), id);
  const g = (id) => KIT_PIECES.find((x) => x.id === id);
  assert.deepEqual([g('feed').width, g('feed').height], [1080, 1350]);
  assert.deepEqual([g('story').width, g('story').height], [1080, 1920]);
  assert.deepEqual([g('screen').width, g('screen').height], [1920, 1080]);
  assert.equal(g('screen').safe.l, 0.1);
  assert.throws(() => resolvePieces({ pieces: ['nao-existe'] }), /desconhecida/);
  assert.throws(() => resolvePieces({ pieces: [] }), /ao menos/);
});

test('identidade: força contraste WCAG AA e rejeita cor inválida', () => {
  const id = buildIdentity({ ...input, cores: { text: '#111111', primary: 'red' } });
  assert.ok(contrastRatio(id.kit.colors.text, id.kit.colors.bg) >= 4.5);
  assert.ok(id.avisos.some((a) => a.includes('primary')));
  assert.ok(id.avisos.some((a) => a.includes('ajustado')));
});

test('SVGs: dimensões, escape de texto, fundo limpo sem <text>', () => {
  const id = buildIdentity(input);
  for (const p of KIT_PIECES.filter((x) => x.format === 'svg')) {
    const svg = renderPieceSVG(p, id);
    assert.ok(svg.includes(`viewBox="0 0 ${p.width} ${p.height}"`), p.id);
    assert.equal(svg.includes('<b>'), false);
  }
  assert.equal(renderPieceSVG(KIT_PIECES.find((x) => x.id === 'slide-fundo'), id).includes('<text'), false);
  assert.ok(renderPieceSVG(KIT_PIECES.find((x) => x.id === 'slide-capa'), id).includes('<text'));
});

test('telão: texto dentro do overscan de 10%', () => {
  const id = buildIdentity(input);
  const svg = renderPieceSVG(KIT_PIECES.find((x) => x.id === 'screen'), id);
  for (const m of svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"/g)) {
    assert.ok(Number(m[1]) >= 192 - 0.01 && Number(m[2]) >= 108 && Number(m[2]) <= 972, m[0]);
  }
});

test('landing: ícones SVG, CTA final, animação desligável por ?static=true', () => {
  const html = renderLandingHTML(buildIdentity(input));
  assert.ok(html.includes('class="ic"'));
  assert.ok(html.includes('id="contato"'));
  assert.ok(html.includes("get('static')==='true'"));
  assert.equal(html.includes('<b>&</b>'), false);
  assert.ok(renderLandingHTML(buildIdentity(input), { photoFile: 'foto-base.jpg' }).includes('foto-base.jpg'));
});

test('zip: assinatura e crc legíveis por unzip', async () => {
  const z = createZip([{ name: 'a/b.txt', data: 'olá' }]);
  assert.equal(z.readUInt32LE(0), 0x04034b50);
  assert.equal(z.readUInt32LE(z.length - 22), 0x06054b50);
});

test('lote: pastas, manifesto honesto e foto ausente', async () => {
  const { zip, manifest } = await buildKit({ ...input, preset: 'lancamento' }, { photoResolver: async () => null });
  const nomes = manifest.pecas.map((p) => p.arquivo);
  assert.ok(nomes.includes('1-web/landing/index.html'));
  assert.ok(nomes.some((n) => n.startsWith('2-redes-sociais/story-1080x1920')));
  assert.match(manifest.foto.fonte, /nenhuma/);
  assert.ok(manifest.observacoes.some((o) => o.includes('pendentes')));
  assert.ok(zip.includes(Buffer.from('manifesto.json')));
});

test('lote com foto inclui o arquivo e crédito', async () => {
  const photo = { bytes: Buffer.from([1, 2, 3]), mime: 'image/jpeg', source: 'acervo-local', credit: 'x.jpg' };
  const { zip, manifest } = await buildKit({ ...input, pieces: ['landing', 'feed'] }, { photoResolver: async () => photo });
  assert.ok(zip.includes(Buffer.from('1-web/landing/foto-base.jpg')));
  assert.equal(manifest.foto.fonte, 'acervo-local');
});

test('fotos: sem acervo nem chave retorna null; Pexels só com chave e domínio permitido', async () => {
  assert.equal(await resolvePhoto({ nicho: 'zzz-inexistente', env: {}, baseDir: '/nonexistent' }), null);
  let calls = 0;
  const fake = async (url) => {
    calls++;
    if (url.includes('api.pexels.com')) return { ok: true, json: async () => ({ photos: [{ photographer: 'Ana', src: { large2x: 'https://evil.example/x.jpg' } }] }) };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
  assert.equal(await resolvePhoto({ nicho: 'dentista', env: { PEXELS_API_KEY: 'k' }, fetchImpl: fake, baseDir: '/nonexistent' }), null);
  assert.equal(calls, 1);
});

function req(server, path, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: server.address().port, path, method, headers: { Host: '127.0.0.1:4173', 'Content-Type': 'application/json' } }, (res) => {
      const chunks = []; res.on('data', (d) => chunks.push(d)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.on('error', reject); r.end(body ? JSON.stringify(body) : undefined);
  });
}

test('API: catálogo, identidade e ZIP; peça inválida retorna 400', async (t) => {
  const server = createServer(); await new Promise((r) => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise((r) => server.close(r)));
  const cat = JSON.parse((await req(server, '/api/kit/catalog')).body);
  assert.equal(cat.pecas.length, KIT_PIECES.length);
  assert.equal(JSON.parse((await req(server, '/api/kit/identity', 'POST', input)).body).ok, true);
  const z = await req(server, '/api/kit/build', 'POST', { ...input, pieces: ['feed', 'slide-fundo'], nicho: '' });
  assert.equal(z.status, 200); assert.equal(z.headers['content-type'], 'application/zip'); assert.equal(z.body.readUInt32LE(0), 0x04034b50);
  assert.equal((await req(server, '/api/kit/build', 'POST', { pieces: ['x'] })).status, 400);
  assert.equal((await req(server, '/kit')).status, 200);
});
