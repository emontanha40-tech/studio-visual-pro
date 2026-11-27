import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeaserQueue, renderTeaser, teaserScenes } from '../src/kit/teaser.mjs';
import { buildIdentity } from '../src/kit/identity.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('teaser: 6 cenas a partir do briefing', () => {
  const input = { nome: 'Série Esperança', nicho: 'igreja', cta: 'Venha' };
  const scenes = teaserScenes(input, buildIdentity(input));
  assert.equal(scenes.length, 6);
  assert.ok(scenes.every(([, h]) => h.length > 0));
});

test('teaser: formato inválido → 400', () => {
  const q = createTeaserQueue(async () => Buffer.from('x'));
  assert.equal(q.submit({ formato: '4:3' }).status, 400);
  assert.equal(q.submit(null).status, 400);
});

test('teaser: fila única, 2º pedido concorrente → 429, depois conclui', async () => {
  let release;
  const q = createTeaserQueue(() => new Promise((r) => { release = () => r(Buffer.from('mp4')); }));
  const a = q.submit({ formato: '9:16' });
  assert.equal(a.status, 202);
  await wait(5);
  const b = q.submit({ formato: '16:9' }); // vai para pending
  assert.equal(b.status, 202);
  assert.equal(q.submit({ formato: '16:9' }).status, 429);
  release();
  await wait(10);
  assert.equal(q.get(a.body.id).status, 'ready');
  release();
  await wait(10);
  assert.equal(q.get(b.body.id).status, 'ready');
});

test('teaser: falha vira status failed sem vazar detalhes', async () => {
  const q = createTeaserQueue(async () => { throw new Error('segredo /home/x'); });
  const { body } = q.submit({ formato: '9:16' });
  await wait(10);
  const job = q.get(body.id);
  assert.equal(job.status, 'failed');
  assert.ok(!job.erro.includes('segredo'));
});

test('teaser: sem FFmpeg → erro estruturado ffmpeg_unavailable', async () => {
  const old = process.env.FFMPEG_PATH;
  process.env.FFMPEG_PATH = '/nonexistent/ffmpeg';
  try {
    await assert.rejects(renderTeaser({ nome: 'X' }, '9:16'), { code: 'ffmpeg_unavailable' });
  } finally {
    if (old === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = old;
  }
});
