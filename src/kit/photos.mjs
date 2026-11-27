import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MAX_BYTES = 3 * 1024 * 1024;
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Foto-base por nicho. Ordem: acervo local curado (assets/fotos/<nicho>/*.jpg|png) →
 * Pexels (somente se PEXELS_API_KEY existir; 1 tentativa, timeout 5 s, limite 3 MB) → null (fundo gráfico).
 * Nunca gera rostos ou pessoas por IA. Retorna {bytes, mime, source, credit} ou null.
 */
export async function resolvePhoto({ nicho, env = process.env, fetchImpl = globalThis.fetch, baseDir = 'assets/fotos' } = {}) {
  const slug = slugify(nicho);
  if (slug) {
    try {
      const dir = path.resolve(baseDir, slug);
      const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
      if (files.length) {
        const pick = files[createHash('sha256').update(slug).digest()[0] % files.length];
        const bytes = await readFile(path.join(dir, pick));
        return { bytes, mime: /png$/i.test(pick) ? 'image/png' : 'image/jpeg', source: 'acervo-local', credit: pick };
      }
    } catch { /* sem acervo para este nicho */ }
  }
  const key = env.PEXELS_API_KEY;
  if (key && slug && fetchImpl) {
    try {
      const q = encodeURIComponent(String(nicho).slice(0, 80));
      const r = await fetchImpl(`https://api.pexels.com/v1/search?query=${q}&orientation=landscape&per_page=1`, { headers: { Authorization: key }, signal: AbortSignal.timeout(5000) });
      if (!r.ok) return null;
      const photo = (await r.json()).photos?.[0];
      const url = photo?.src?.large2x || photo?.src?.large;
      if (!url || !/^https:\/\/images\.pexels\.com\//.test(url)) return null;
      const img = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
      if (!img.ok) return null;
      const bytes = Buffer.from(await img.arrayBuffer());
      if (bytes.length > MAX_BYTES) return null;
      return { bytes, mime: 'image/jpeg', source: 'pexels', credit: `${photo.photographer || 'Pexels'} / Pexels` };
    } catch { return null; }
  }
  return null;
}
