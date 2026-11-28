import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { propagateConstitution, MARKER_START } from '../scripts/propagar-constituicao.mjs';

test('propagateConstitution replica Constituição em workspace e irmãos com idempotência e dry-run', (t) => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'svp-ws-'));
  t.after(() => fs.rmSync(ws, { recursive: true, force: true }));

  const repoA = path.join(ws, 'projeto-a');
  const repoB = path.join(ws, 'projeto-b');
  const backup = path.join(ws, 'Backups');
  fs.mkdirSync(repoA, { recursive: true });
  fs.mkdirSync(repoB, { recursive: true });
  fs.mkdirSync(backup, { recursive: true });
  fs.writeFileSync(path.join(repoA, 'AGENTS.md'), '# Regras existentes\n', 'utf8');

  const dry = propagateConstitution({ workspaceDir: ws, dryRun: true });
  assert.equal(dry.dryRun, true);
  assert.equal(dry.totalTargets, 3); // ws + projeto-a + projeto-b (ignora Backups)
  assert.equal(fs.existsSync(path.join(repoA, 'docs', 'CONSTITUICAO-DESIGN-MOTION.md')), false);

  const first = propagateConstitution({ workspaceDir: ws, dryRun: false });
  assert.equal(first.totalTargets, 3);
  for (const dir of [ws, repoA, repoB]) {
    assert.equal(fs.existsSync(path.join(dir, 'docs', 'CONSTITUICAO-DESIGN-MOTION.md')), true);
    for (const f of ['AGENTS.md', 'GEMINI.md', 'CLAUDE.md']) {
      const txt = fs.readFileSync(path.join(dir, f), 'utf8');
      assert.ok(txt.includes(MARKER_START), `${dir}/${f}`);
    }
  }
  // Preserva conteúdo anterior em AGENTS.md
  assert.ok(fs.readFileSync(path.join(repoA, 'AGENTS.md'), 'utf8').startsWith('# Regras existentes'));
  // Ignora Backups
  assert.equal(fs.existsSync(path.join(backup, 'AGENTS.md')), false);

  // Idempotência: segunda execução não altera nada
  const second = propagateConstitution({ workspaceDir: ws, dryRun: false });
  assert.equal(second.report.every((r) => r.actions.length === 0), true);
});
