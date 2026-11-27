// Fatia 8A — Foto real para o Hero quando o usuário não envia imagem própria.
// Ordem: (1) acervo curado local assets/photos/<segmento>/*.jpg|webp (2) Pexels (3) Unsplash (4) nada → modo geométrico.
// Chaves só no servidor (env). Orçamento: 1 chamada, timeout 4s, sem retentativa; falha → null (nunca quebra a geração).
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from './htmlGenerator.mjs';

export const PHOTO_DIR = path.join(PROJECT_ROOT, 'assets', 'photos');
const MAX_LOCAL_BYTES = 450 * 1024;
const TIMEOUT_MS = 4000;
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png' };

// segmento (nome da pasta local) → [padrão pt-BR sem acento, consulta em inglês p/ APIs]
const SEGMENTS = [
  ['odontologia', /odont|dentist|dente|sorriso|ortodon/, 'dentist clinic smiling patient'],
  ['saude', /clinic|medic|saude|psicolog|fisioter|nutri|consultorio|terapia/, 'healthcare professional patient consultation'],
  ['beleza', /beleza|estetic|salao|barbear|cabelo|spa|maquiag/, 'beauty salon professional'],
  ['gastronomia', /restaurante|cafe|padaria|pizza|hamburg|gastronom|comida|confeitaria/, 'restaurant chef food'],
  ['fitness', /academia|fitness|treino|pilates|crossfit|personal/, 'fitness training gym'],
  ['juridico', /advoga|juridic|direito|escritorio de/, 'lawyer office meeting'],
  ['imobiliaria', /imovel|imobili|apartamento|corretor|construtora/, 'modern house real estate'],
  ['educacao', /escola|curso|educa|ensino|aula|faculdade/, 'students learning classroom'],
  ['moda', /moda|roupa|colecao|boutique|joia|vestuario/, 'fashion boutique clothing'],
  ['tecnologia', /saas|software|plataforma|aplicativo|automacao|dashboard|sistema|tecnolog/, 'team working laptop modern office'],
];
const GENERIC = { local_authority: 'friendly professional team workplace', product_launch: 'product lifestyle studio', saas_modern: 'team working laptop modern office', classic: 'business team meeting' };

const fold = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** @returns {{ segment: string|null, query: string }} */
export function detectSegment({ text = '', archetype } = {}) {
  const t = fold(text);
  for (const [segment, re, query] of SEGMENTS) if (re.test(t)) return { segment, query };
  return { segment: null, query: GENERIC[archetype] ?? GENERIC.classic };
}

function localPhoto(segment, photoDir) {
  if (!segment) return null;
  try {
    const dir = path.join(photoDir, segment);
    const file = fs.readdirSync(dir).sort().find((f) => MIME[path.extname(f).toLowerCase()]);
    if (!file) return null;
    const abs = path.join(dir, file);
    if (fs.statSync(abs).size > MAX_LOCAL_BYTES) return null;
    const url = `data:${MIME[path.extname(file).toLowerCase()]};base64,${fs.readFileSync(abs).toString('base64')}`;
    return { url, source: 'acervo-local', credit: null };
  } catch { return null; }
}

async function getJson(url, headers, fetchImpl) {
  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
const httpsOnly = (u) => (typeof u === 'string' && /^https:\/\/[^\s"'<>\\]{1,1900}$/.test(u) ? u : null);

/**
 * @param {{ text?: string, archetype?: string }} brief texto livre (nome, headline, tagline) e arquétipo
 * @param {{ env?: object, fetchImpl?: typeof fetch, photoDir?: string }} deps
 * @returns {Promise<{ url: string, source: string, credit: string|null, query: string }|null>}
 */
export async function resolveHeroPhoto(brief = {}, { env = process.env, fetchImpl = fetch, photoDir = PHOTO_DIR } = {}) {
  const { segment, query } = detectSegment(brief);
  const local = localPhoto(segment, photoDir);
  if (local) return { ...local, query };
  try {
    if (env.PEXELS_API_KEY) {
      const data = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, { Authorization: env.PEXELS_API_KEY }, fetchImpl);
      const p = data?.photos?.[0];
      const url = httpsOnly(p?.src?.large2x ?? p?.src?.large);
      if (url) return { url, source: 'pexels', credit: p.photographer ? `Foto: ${String(p.photographer).slice(0, 60)} / Pexels` : 'Pexels', query };
    }
    if (env.UNSPLASH_ACCESS_KEY) {
      const data = await getJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` }, fetchImpl);
      const p = data?.results?.[0];
      const url = httpsOnly(p?.urls?.regular);
      if (url) return { url, source: 'unsplash', credit: p.user?.name ? `Foto: ${String(p.user.name).slice(0, 60)} / Unsplash` : 'Unsplash', query };
    }
  } catch { /* rede/timeout/cota: segue sem foto (modo geométrico) */ }
  return null;
}
