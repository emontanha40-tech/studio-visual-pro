// Fatia 7 — Histórico de kits gerados em SQLite local (node:sqlite, sem dependências novas).
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PROJECT_ROOT } from './htmlGenerator.mjs';

export const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, 'data', 'studio.db');
const ID_RE = /^[a-z0-9]{6,40}$/;
export const isKitId = (v) => ID_RE.test(String(v));

export function openProjectStore(dbPath = process.env.STUDIO_DB_PATH || DEFAULT_DB_PATH) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS kits (
    id TEXT PRIMARY KEY, slug TEXT NOT NULL, brand_name TEXT NOT NULL, archetype TEXT, live_url TEXT,
    summary_json TEXT NOT NULL, zip BLOB NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kit_files (
    kit_id TEXT NOT NULL REFERENCES kits(id) ON DELETE CASCADE, name TEXT NOT NULL, data BLOB NOT NULL,
    PRIMARY KEY (kit_id, name)
  );
  CREATE INDEX IF NOT EXISTS kits_created ON kits(created_at DESC);`);
  const insKit = db.prepare('INSERT INTO kits (id, slug, brand_name, archetype, live_url, summary_json, zip, created_at) VALUES (?,?,?,?,?,?,?,?)');
  const insFile = db.prepare('INSERT INTO kit_files (kit_id, name, data) VALUES (?,?,?)');
  const list = db.prepare('SELECT id, slug, brand_name, archetype, live_url, summary_json, created_at FROM kits ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?');
  const getKit = db.prepare('SELECT id, slug, brand_name, archetype, live_url, summary_json, created_at FROM kits WHERE id = ?');
  const getZip = db.prepare('SELECT slug, zip FROM kits WHERE id = ?');
  const getFile = db.prepare('SELECT data FROM kit_files WHERE kit_id = ? AND name = ?');
  const toRow = (r) => ({ id: r.id, slug: r.slug, brandName: r.brand_name, archetype: r.archetype, liveUrl: r.live_url, createdAt: r.created_at, ...JSON.parse(r.summary_json) });
  return {
    saveKit({ id, slug, brandName, archetype, liveUrl, summary, zip, files = [], createdAt = Date.now() }) {
      db.exec('BEGIN');
      try {
        insKit.run(id, slug, brandName, archetype ?? null, liveUrl ?? null, JSON.stringify(summary), zip, createdAt);
        for (const f of files) insFile.run(id, f.name, f.data);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    listKits(limit = 50, offset = 0) { return list.all(Math.min(Math.max(+limit || 50, 1), 200), offset).map(toRow); },
    getKit(id) { const r = getKit.get(String(id)); return r ? toRow(r) : null; },
    getZip(id) { const r = getZip.get(String(id)); return r ? { slug: r.slug, data: Buffer.from(r.zip) } : null; },
    getFile(id, name) { const r = getFile.get(String(id), String(name)); return r ? Buffer.from(r.data) : null; },
    close() { db.close(); },
  };
}
