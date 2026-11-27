import test from 'node:test';
import assert from 'node:assert/strict';
import { KIT_PIECES } from '../src/kit/catalog.mjs';
import { printGeometry } from '../src/kit/print.mjs';
import { buildKit } from '../src/kit/batch.mjs';

const piece = (id) => KIT_PIECES.find((p) => p.id === id);

test('catálogo traz os 6 impressos com medidas e lados corretos', () => {
  const dims = Object.fromEntries(KIT_PIECES.filter((p) => p.format === 'print').map((p) => [p.id, [p.width, p.height, p.print.sides.length]]));
  assert.deepEqual(dims, {
    invitation: [100, 150, 2], prayer: [148, 210, 1], decision: [148, 105, 1],
    bookmark: [50, 180, 2], backdrop: [3200, 1800, 1], wind: [700, 2000, 1],
  });
});

test('geometria: 300 DPI com sangria de 3 mm nos impressos pequenos', () => {
  const g = printGeometry(piece('invitation'));
  assert.equal(g.artWidth, 106);
  assert.equal(g.artHeight, 156);
  assert.equal(g.pixelWidth, Math.round(106 * 300 / 25.4));
  assert.equal(piece('invitation').print.dpi, 300);
});

test('geometria: grande formato em escala 1:10, 150 DPI e sangria de 10 mm reais', () => {
  const p = piece('backdrop');
  const g = printGeometry(p);
  assert.equal(p.print.dpi, 150);
  assert.equal(p.print.scale, 10);
  assert.equal(g.width, 320);
  assert.equal(g.bleed, 1);
  assert.equal(g.artWidth, 322);
  assert.equal(g.pixelWidth, Math.round(322 * 150 / 25.4));
});

test('ZIP: impressos geram PNG + PDF em /impressos/ com manifesto e aviso de gabarito', async (t) => {
  let kit;
  try {
    kit = await buildKit({ pieces: ['invitation', 'decision'], marca: 'Igreja Teste', nicho: 'igreja', titulo: 'Culto de Domingo' }, { photoResolver: async () => null });
  } catch (err) {
    if (/Executable doesn't exist|browserType\.launch/i.test(String(err))) return t.skip('Chromium indisponível');
    throw err;
  }
  const zip = kit.zip.toString('latin1');
  for (const f of ['impressos/invitation-frente.png', 'impressos/invitation-frente.pdf', 'impressos/invitation-verso.png', 'impressos/invitation-verso.pdf', 'impressos/decision-frente.png', 'impressos/decision-frente.pdf']) {
    assert.ok(zip.includes(f), `falta ${f}`);
  }
  const inv = kit.manifest.pecas.find((p) => p.id === 'invitation');
  assert.equal(inv.sangria_final_mm, 3);
  assert.equal(inv.dpi, 300);
  assert.equal(inv.arquivos.length, 4);
  const png = kit.zip.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  assert.ok(png > 0);
  assert.ok(kit.zip.includes(Buffer.from('pHYs')), 'PNG sem densidade 300 DPI');
  assert.ok(kit.zip.includes(Buffer.from('%PDF')));
});
