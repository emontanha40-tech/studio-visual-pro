// Histórico de lotes do /kit em SQLite local (node:sqlite) + publicação segura de site ao vivo.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { slugify, PUBLISHED_DIR } from '../brand/campaignService.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_KIT_DB_PATH = path.join(ROOT_DIR, 'data', 'studio.db');
const BATCH_ID_RE = /^[a-z0-9][a-z0-9-]{5,40}$/;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export function isBatchId(id) {
  return BATCH_ID_RE.test(String(id || ''));
}

export function createBatchSlug(marca, id) {
  const base = slugify(marca) || 'campanha';
  const suffix = String(id || '').replace(/[^a-z0-9]/g, '').slice(-6) || '000000';
  const trimmed = base.slice(0, 38).replace(/-+$/g, '') || 'campanha';
  return `${trimmed}-${suffix}`;
}

/** Publica a página web gerada no lote (index.html + foto-base opcional) em public/published/<slug>/. */
export function publishKitSite(publishedSite, slug, { baseDir = PUBLISHED_DIR } = {}) {
  if (!publishedSite?.html) return null;
  if (!SLUG_RE.test(String(slug || ''))) throw new Error('Slug de publicação inválido.');
  fs.mkdirSync(baseDir, { recursive: true });
  const outDir = path.join(baseDir, slug);
  const tmp = `${outDir}.tmp-${process.pid}-${Date.now()}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'index.html'), publishedSite.html, 'utf8');
  if (publishedSite.photoFile && publishedSite.photoBytes && /^foto-base\.(jpg|png)$/.test(publishedSite.photoFile)) {
    fs.writeFileSync(path.join(tmp, publishedSite.photoFile), publishedSite.photoBytes);
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.renameSync(tmp, outDir);
  return { slug, url: `/published/${slug}/`, kind: publishedSite.kind || 'landing' };
}

export function openKitHistoryStore(dbPath = process.env.STUDIO_DB_PATH || DEFAULT_KIT_DB_PATH) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS kit_batches (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    marca TEXT NOT NULL,
    titulo TEXT NOT NULL,
    modelo TEXT NOT NULL,
    live_url TEXT,
    pieces_count INTEGER NOT NULL,
    briefing_json TEXT NOT NULL,
    pieces_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS kit_batches_created ON kit_batches(created_at DESC);`);

  const insert = db.prepare(`INSERT INTO kit_batches
    (id, slug, marca, titulo, modelo, live_url, pieces_count, briefing_json, pieces_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const selectAll = db.prepare(`SELECT id, slug, marca, titulo, modelo, live_url, pieces_count, briefing_json, pieces_json, created_at
    FROM kit_batches ORDER BY created_at DESC, rowid DESC LIMIT ?`);
  const selectOne = db.prepare(`SELECT id, slug, marca, titulo, modelo, live_url, pieces_count, briefing_json, pieces_json, created_at
    FROM kit_batches WHERE id = ?`);
  const removeOne = db.prepare('DELETE FROM kit_batches WHERE id = ?');

  const toRow = (r) => ({
    id: r.id,
    slug: r.slug,
    marca: r.marca,
    titulo: r.titulo,
    modelo: r.modelo,
    live_url: r.live_url || null,
    pieces_count: r.pieces_count,
    briefing: JSON.parse(r.briefing_json),
    pieces: JSON.parse(r.pieces_json),
    created_at: r.created_at,
  });

  return {
    saveBatch({
      id = `lote-${randomUUID().slice(0, 8)}`,
      slug,
      marca,
      titulo,
      modelo = 'tech-cinematografico',
      liveUrl = null,
      piecesCount = 0,
      briefing = {},
      pieces = [],
      createdAt = Date.now(),
    }) {
      const cleanId = isBatchId(id) ? id : `lote-${randomUUID().slice(0, 8)}`;
      const cleanMarca = String(marca || 'Connect').trim().slice(0, 80) || 'Connect';
      const cleanTitulo = String(titulo || cleanMarca).trim().slice(0, 160) || cleanMarca;
      const cleanModelo = String(modelo || 'tech-cinematografico').trim().slice(0, 80);
      const cleanSlug = SLUG_RE.test(String(slug || '')) ? slug : createBatchSlug(cleanMarca, cleanId);
      const safeBriefing = {
        marca: String(briefing.marca ?? cleanMarca).slice(0, 60),
        nicho: String(briefing.nicho ?? '').slice(0, 80),
        slogan: String(briefing.slogan ?? cleanTitulo).slice(0, 140),
        subtitulo: String(briefing.subtitulo ?? '').slice(0, 200),
        data: String(briefing.data ?? '').slice(0, 80),
        local: String(briefing.local ?? '').slice(0, 120),
        modelo: String(briefing.modelo ?? cleanModelo).slice(0, 80),
      };
      const safePieces = Array.isArray(pieces) ? pieces.map((p) => String(p).slice(0, 40)).filter(Boolean) : [];
      insert.run(
        cleanId,
        cleanSlug,
        cleanMarca,
        cleanTitulo,
        cleanModelo,
        liveUrl || null,
        Number(piecesCount) || safePieces.length,
        JSON.stringify(safeBriefing),
        JSON.stringify(safePieces),
        createdAt,
      );
      return toRow(selectOne.get(cleanId));
    },
    listBatches(limit = 20) {
      const cap = Math.min(Math.max(Number(limit) || 20, 1), 100);
      return selectAll.all(cap).map(toRow);
    },
    getBatch(id) {
      if (!isBatchId(id)) return null;
      const r = selectOne.get(String(id));
      return r ? toRow(r) : null;
    },
    deleteBatch(id) {
      if (!isBatchId(id)) return false;
      return removeOne.run(String(id)).changes > 0;
    },
    close() {
      db.close();
    },
  };
}
