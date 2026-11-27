import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ACERVO_DIR = fileURLToPath(new URL('../../assets/photos', import.meta.url));
// nicho livre → pasta do acervo curado (primeira regra que casar). 'geral' é o fallback final.
const NICHOS = [
  ['odontologia', /odont|dentist|sorriso|ortodon/],
  ['saude', /clinic|medic|saude|psicolog|fisioter|nutri|consultorio|terapia|hospital/],
  ['igreja', /igreja|serie|culto|ministerio|pastor|congresso|evangeli|batism|jovens|crist|louvor|missao/],
  ['tecnologia', /tech|saas|software|plataforma|aplicativo|\bapp\b|automac|sistema|dashboard|tecnolog/],
  ['moda', /varejo|loja|comercio|boutique|moda|roupa|vestuario|joia/],
  ['geral', /negocio|empresa|consultoria|servico|corporativ/],
];

const MAX_BYTES = 3 * 1024 * 1024;
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Foto-base por nicho. Ordem: acervo local curado (assets/photos/<nicho>/hero.jpg, com sinônimos e fallback 'geral') →
 * Pexels (somente se PEXELS_API_KEY existir; 1 tentativa, timeout 5 s, limite 3 MB) → null (fundo gráfico).
 * Nunca gera rostos ou pessoas por IA. Retorna {bytes, mime, source, credit} ou null.
 */
async function fromAcervo(baseDir, folders, seed) {
  for (const folder of folders) {
    try {
      const dir = path.resolve(baseDir, folder);
      const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
      if (!files.length) continue;
      const pick = files.find((f) => /^hero\./i.test(f)) ?? files[createHash('sha256').update(seed).digest()[0] % files.length];
      const bytes = await readFile(path.join(dir, pick));
      return { bytes, mime: /png$/i.test(pick) ? 'image/png' : 'image/jpeg', source: 'acervo-local', credit: `${folder}/${pick}` };
    } catch { /* pasta ausente: tenta a próxima */ }
  }
  return null;
}

export async function resolvePhoto({ nicho, env = process.env, fetchImpl = globalThis.fetch, baseDir = ACERVO_DIR } = {}) {
  const slug = slugify(nicho);
  const folders = [slug, ...NICHOS.filter(([, re]) => re.test(slug.replace(/-/g, ' '))).map(([f]) => f), 'geral'].filter(Boolean);
  const local = await fromAcervo(baseDir, [...new Set(folders)], slug || 'geral');
  if (local) return local;
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
