// Fatia 12 — Persistência SQLite de presets extraídos no Laboratório de Estilo (node:sqlite).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { dnaToBrandKit, slugifyPresetId } from './dna.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_STYLE_DB_PATH = path.join(ROOT_DIR, 'data', 'studio.db');
const PRESET_ID_RE = /^[a-z0-9][a-z0-9-]{2,60}$/;

export function isPresetId(id) {
  return PRESET_ID_RE.test(String(id || ''));
}

export function openStyleStore(dbPath = process.env.STUDIO_DB_PATH || DEFAULT_STYLE_DB_PATH) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS style_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_ref TEXT,
    dna_json TEXT NOT NULL,
    brand_kit_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS style_presets_created ON style_presets(created_at DESC);`);

  const upsert = db.prepare(`INSERT INTO style_presets (id, name, source_type, source_ref, dna_json, brand_kit_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      source_type = excluded.source_type,
      source_ref = excluded.source_ref,
      dna_json = excluded.dna_json,
      brand_kit_json = excluded.brand_kit_json,
      created_at = excluded.created_at`);
  const selectAll = db.prepare('SELECT id, name, source_type, source_ref, dna_json, brand_kit_json, created_at FROM style_presets ORDER BY created_at DESC, rowid DESC LIMIT ?');
  const selectOne = db.prepare('SELECT id, name, source_type, source_ref, dna_json, brand_kit_json, created_at FROM style_presets WHERE id = ?');
  const removeOne = db.prepare('DELETE FROM style_presets WHERE id = ?');

  const toRow = (r) => ({
    id: r.id,
    name: r.name,
    source_type: r.source_type,
    source_ref: r.source_ref || '',
    dna: JSON.parse(r.dna_json),
    brand_kit: dnaToBrandKit({ id: r.id, name: r.name, dna: JSON.parse(r.dna_json) }),
    created_at: r.created_at,
  });

  return {
    savePreset({ id, name, source_type, source_ref = '', dna = {} }) {
      const cleanName = String(name || '').trim().slice(0, 60);
      if (!cleanName) throw new Error('Informe um nome para o preset visual.');
      const allowedTypes = new Set(['url', 'image', 'video']);
      const cleanType = allowedTypes.has(source_type) ? source_type : 'url';
      const cleanId = isPresetId(id) && id.startsWith('custom-') ? id : slugifyPresetId(cleanName);
      const kit = dnaToBrandKit({ id: cleanId, name: cleanName, dna });
      const cleanRef = String(source_ref || '').trim().slice(0, 300);
      upsert.run(cleanId, cleanName, cleanType, cleanRef, JSON.stringify(dna), JSON.stringify(kit), Date.now());
      return toRow(selectOne.get(cleanId));
    },
    listPresets(limit = 100) {
      const cap = Math.min(Math.max(Number(limit) || 100, 1), 200);
      return selectAll.all(cap).map(toRow);
    },
    getPreset(id) {
      if (!isPresetId(id)) return null;
      const row = selectOne.get(String(id));
      return row ? toRow(row) : null;
    },
    deletePreset(id) {
      if (!isPresetId(id)) return false;
      const info = removeOne.run(String(id));
      return info.changes > 0;
    },
    close() {
      db.close();
    },
  };
}
