// Fatia 4 — Setup único: baixa os arquivos .woff2 do catálogo para assets/fonts/.
// Após executado uma vez, o renderizador opera 100% offline.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_CATALOG } from '../src/brand/fontCatalog.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FONT_DIR_ABS = path.join(PROJECT_ROOT, 'assets/fonts');

// URLs do Google Fonts CSS2 (User-Agent moderno retorna .woff2 variável/latin direto).
export const FONT_SOURCES = {
  Poppins: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap',
  Inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap',
  'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&display=swap',
  Montserrat: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@100..900&display=swap',
  Lora: 'https://fonts.googleapis.com/css2?family=Lora:wght@400..700&display=swap',
  'Roboto Mono': 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@100..700&display=swap',
};

const WOFF2_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export function isValidWoff2(buf) {
  return Buffer.isBuffer(buf) && buf.length > 64 && buf.subarray(0, 4).toString('ascii') === 'wOF2';
}

/** Extrai a URL .woff2 do subset /* latin *\/ (preferindo peso 700/variável se houver múltiplos). */
export function extractLatinWoff2Url(cssText) {
  const blocks = cssText.split(/\/\*\s*([^*]+?)\s*\*\//);
  const latinUrls = [];
  for (let i = 1; i < blocks.length; i += 2) {
    if (blocks[i].trim() === 'latin') {
      const m = blocks[i + 1]?.match(/url\((https:\/\/[^)]+\.woff2)\)/);
      if (m) latinUrls.push(m[1]);
    }
  }
  if (latinUrls.length) return latinUrls[latinUrls.length - 1];
  const fallback = cssText.match(/url\((https:\/\/[^)]+\.woff2)\)/);
  return fallback ? fallback[1] : null;
}

export async function fetchAllFonts({
  fontDir = FONT_DIR_ABS,
  force = false,
  fetchImpl = fetch,
} = {}) {
  fs.mkdirSync(fontDir, { recursive: true });
  const results = [];

  for (const [name, meta] of Object.entries(FONT_CATALOG)) {
    const dest = path.join(fontDir, meta.file);
    if (!force && fs.existsSync(dest)) {
      const existing = fs.readFileSync(dest);
      if (isValidWoff2(existing)) {
        results.push({ name, file: meta.file, status: 'cached', bytes: existing.length });
        continue;
      }
    }

    const cssUrl = FONT_SOURCES[name];
    if (!cssUrl) throw new Error(`Fonte sem URL configurada: ${name}`);

    const cssRes = await fetchImpl(cssUrl, { headers: { 'User-Agent': WOFF2_UA } });
    if (!cssRes.ok) throw new Error(`Falha ao buscar CSS de ${name}: HTTP ${cssRes.status}`);
    const cssText = await cssRes.text();
    const woff2Url = extractLatinWoff2Url(cssText);
    if (!woff2Url) throw new Error(`URL .woff2 não encontrada no CSS de ${name}`);

    const binRes = await fetchImpl(woff2Url, { headers: { 'User-Agent': WOFF2_UA } });
    if (!binRes.ok) throw new Error(`Falha ao baixar .woff2 de ${name}: HTTP ${binRes.status}`);
    const buf = Buffer.from(await binRes.arrayBuffer());
    if (!isValidWoff2(buf)) throw new Error(`Arquivo baixado para ${name} não é um .woff2 válido`);

    fs.writeFileSync(dest, buf);
    results.push({ name, file: meta.file, status: 'downloaded', bytes: buf.length });
  }

  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes('--force');
  const results = await fetchAllFonts({ force });
  for (const r of results) {
    console.log(`[fonts] ${r.status.padEnd(10)} ${r.file} (${(r.bytes / 1024).toFixed(1)} KB)`);
  }
}
