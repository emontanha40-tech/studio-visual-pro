// Fatia 8A — Setup único: baixa acervo curado local de fotos reais (Unsplash License) para assets/photos/<segmento>/.
// Após executado uma vez, o Studio entrega fotografia real no Hero e nas seções 100% offline.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PHOTO_DIR_ABS = path.join(PROJECT_ROOT, 'assets', 'photos');
const MAX_BYTES = 450 * 1024;
const TIMEOUT_MS = 12000;

const u = (id, w = 1080) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=76`;

// Catálogo curado por segmento (mesmas chaves de src/brand/stockPhotos.mjs + 'geral').
// Cada segmento possui foto principal (hero.jpg) e foto de seção/ambiente (section.jpg).
export const PHOTO_SOURCES = {
  odontologia: {
    hero: u('1629909613654-28e377c37b09'),
    section: u('1606811841689-23dfddce3e95'),
  },
  saude: {
    hero: u('1576091160550-2173dba999ef'),
    section: u('1519494026892-80bbd2d6fd0d'),
  },
  beleza: {
    hero: u('1560066984-138dadb4c035'),
    section: u('1522337360788-8b13dee7a37e'),
  },
  gastronomia: {
    hero: u('1517248135467-4c7edcad34c4'),
    section: u('1414235077428-338989a2e8c0'),
  },
  fitness: {
    hero: u('1534438327276-14e5300c3a48'),
    section: u('1517836357463-d25dfeac3438'),
  },
  juridico: {
    hero: u('1589829545856-d10d557cf95f'),
    section: u('1497366216548-37526070297c'),
  },
  imobiliaria: {
    hero: u('1600585154340-be6161a56a0c'),
    section: u('1600607687939-ce8a6c25118c'),
  },
  educacao: {
    hero: u('1523240795612-9a054b0db644'),
    section: u('1522202176988-66273c2fd55f'),
  },
  moda: {
    hero: u('1441986300917-64674bd600d8'),
    section: u('1490481651871-ab68de25d43d'),
  },
  tecnologia: {
    hero: u('1522071820081-009f0129c71c'),
    section: u('1531403009284-440f080d1e12'),
  },
  geral: {
    hero: u('1556761175-b413da4baf72'),
    section: u('1497366811353-6870744d04b2'),
  },
};

export function isValidJpeg(buf) {
  return Buffer.isBuffer(buf) && buf.length > 1024 && buf.length <= MAX_BYTES && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

export async function fetchAllPhotos({ photoDir = PHOTO_DIR_ABS, force = false, fetchImpl = fetch } = {}) {
  const results = [];
  for (const [segment, slots] of Object.entries(PHOTO_SOURCES)) {
    const segDir = path.join(photoDir, segment);
    fs.mkdirSync(segDir, { recursive: true });
    for (const [slot, url] of Object.entries(slots)) {
      const file = `${slot}.jpg`;
      const dest = path.join(segDir, file);
      if (!force && fs.existsSync(dest)) {
        const existing = fs.readFileSync(dest);
        if (isValidJpeg(existing)) {
          results.push({ segment, file, status: 'cached', bytes: existing.length });
          continue;
        }
      }
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Falha ao baixar ${segment}/${file}: HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!isValidJpeg(buf)) throw new Error(`Arquivo inválido ou acima de 450KB para ${segment}/${file} (${buf.length} bytes)`);
      fs.writeFileSync(dest, buf);
      results.push({ segment, file, status: 'downloaded', bytes: buf.length });
    }
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes('--force');
  const results = await fetchAllPhotos({ force });
  for (const r of results) {
    console.log(`[photos] ${r.status.padEnd(10)} ${r.segment}/${r.file} (${(r.bytes / 1024).toFixed(1)} KB)`);
  }
}
