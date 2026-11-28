import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openKitHistoryStore, isBatchId, createBatchSlug } from '../src/kit/historyStore.mjs';
import { createServer } from '../server.mjs';

function req(server, urlPath, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const r = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      path: urlPath,
      method,
      headers: { Host: '127.0.0.1:4173', 'Content-Type': 'application/json' },
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
    r.end(body ? JSON.stringify(body) : undefined);
  });
}

test('kitHistoryStore: salva, lista em ordem reversa, consulta e remove lotes no SQLite', () => {
  const store = openKitHistoryStore(':memory:');
  try {
    assert.equal(isBatchId('lote-abc12345'), true);
    assert.equal(isBatchId('../evil'), false);
    assert.match(createBatchSlug('Igreja Vida Nova', 'lote-12345678'), /^igreja-vida-nova-345678$/);

    const a = store.saveBatch({
      marca: 'Clínica Luz',
      titulo: 'Sorriso renovado',
      modelo: 'editorial-clean',
      liveUrl: '/published/clinica-luz-111111/',
      piecesCount: 4,
      briefing: { marca: 'Clínica Luz', nicho: 'odontologia', slogan: 'Sorriso renovado', data: '20/12', local: 'Centro', modelo: 'editorial-clean' },
      pieces: ['landing', 'feed'],
      createdAt: 1000,
    });
    const b = store.saveBatch({
      marca: 'Igreja Raízes',
      titulo: 'Conferência Anual',
      modelo: 'ministerial-serie',
      liveUrl: null,
      piecesCount: 2,
      briefing: { marca: 'Igreja Raízes', nicho: 'igreja', slogan: 'Conferência Anual', modelo: 'ministerial-serie' },
      pieces: ['feed', 'story'],
      createdAt: 2000,
    });

    const list = store.listBatches(10);
    assert.equal(list.length, 2);
    assert.equal(list[0].id, b.id);
    assert.equal(list[1].id, a.id);
    assert.equal(list[1].briefing.data, '20/12');
    assert.equal(store.getBatch(a.id)?.marca, 'Clínica Luz');
    assert.equal(store.deleteBatch(a.id), true);
    assert.equal(store.listBatches(10).length, 1);
  } finally {
    store.close();
  }
});

test('API /api/kit/build grava histórico no SQLite, publica Site ao Vivo e /api/kit/history lista corretamente', async (t) => {
  const tmpPub = fs.mkdtempSync(path.join(os.tmpdir(), 'svp-pub-'));
  const kitHistoryStore = openKitHistoryStore(':memory:');
  const server = createServer({
    kitHistoryStore,
    kitDeps: {
      publishDir: tmpPub,
      photoResolver: async () => null,
      rasterizer: async (items) => new Map(items.map((i) => [i.id, Buffer.from([137, 80, 78, 71])])),
    },
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    kitHistoryStore.close();
    fs.rmSync(tmpPub, { recursive: true, force: true });
  });

  const buildRes = await req(server, '/api/kit/build', 'POST', {
    marca: 'Connect Studio',
    nicho: 'tecnologia',
    slogan: 'Inovação que acelera resultados',
    subtitulo: 'Design e engenharia em um só lugar',
    data: '10/01 às 19h',
    local: 'Londrina - PR',
    modelo: 'tech-cinematografico',
    pieces: ['landing', 'feed'],
  });
  assert.equal(buildRes.status, 200);
  assert.equal(buildRes.body.readUInt32LE(0), 0x04034b50);
  const batchId = buildRes.headers['x-kit-batch-id'];
  const liveUrl = buildRes.headers['x-kit-live-url'];
  assert.ok(batchId && batchId.startsWith('lote-'));
  assert.ok(liveUrl && liveUrl.startsWith('/published/'));

  const liveRes = await req(server, liveUrl);
  assert.equal(liveRes.status, 200);
  assert.match(liveRes.body.toString('utf8'), /Connect Studio/);

  const histRes = await req(server, '/api/kit/history');
  assert.equal(histRes.status, 200);
  const hist = JSON.parse(histRes.body.toString('utf8'));
  assert.equal(hist.ok, true);
  assert.equal(hist.lotes.length, 1);
  assert.equal(hist.lotes[0].id, batchId);
  assert.equal(hist.lotes[0].marca, 'Connect Studio');
  assert.equal(hist.lotes[0].live_url, liveUrl);
  assert.equal(hist.lotes[0].live_available, true);
  assert.equal(hist.lotes[0].briefing.data, '10/01 às 19h');
  assert.equal(hist.lotes[0].briefing.modelo, 'tech-cinematografico');

  const delRes = await req(server, `/api/kit/history/${batchId}`, 'DELETE');
  assert.equal(delRes.status, 200);
  const histAfter = JSON.parse((await req(server, '/api/kit/history')).body.toString('utf8'));
  assert.equal(histAfter.lotes.length, 0);
});
