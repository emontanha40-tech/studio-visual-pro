import { createHash } from 'node:crypto';
import { resolvePieces } from './catalog.mjs';
import { buildIdentity } from './identity.mjs';
import { resolvePhoto } from './photos.mjs';
import { renderPieceSVG, renderLandingHTML } from './render.mjs';
import { createZip } from './zip.mjs';

const FOLDER = { web: '1-web', social: '2-redes-sociais', projecao: '3-projecao-telao' };
const sha = (d) => createHash('sha256').update(d).digest('hex');

/** Etapa 2: gera o lote selecionado e empacota em ZIP organizado por pastas. */
export async function buildKit(input = {}, { photoResolver = resolvePhoto, now = () => new Date() } = {}) {
  const pieces = resolvePieces(input);
  const identity = buildIdentity(input.identidade ?? input);
  const photo = await photoResolver({ nicho: identity.nicho });
  const entries = [];
  const items = [];
  for (const p of pieces) {
    const dir = FOLDER[p.category];
    if (p.id === 'landing') {
      const photoFile = photo ? `foto-base.${photo.mime === 'image/png' ? 'png' : 'jpg'}` : null;
      const html = renderLandingHTML(identity, { photo, photoFile, whatsapp: input.whatsapp });
      entries.push({ name: `${dir}/landing/index.html`, data: html });
      if (photo) entries.push({ name: `${dir}/landing/${photoFile}`, data: photo.bytes });
      items.push({ id: p.id, arquivo: `${dir}/landing/index.html`, sha256: sha(html) });
    } else {
      const svg = renderPieceSVG(p, identity, p.id === 'slide-fundo' || p.id === 'screen' ? null : photo);
      const arquivo = `${dir}/${p.id}-${p.width}x${p.height}.svg`;
      entries.push({ name: arquivo, data: svg });
      items.push({ id: p.id, arquivo, largura: p.width, altura: p.height, sha256: sha(svg) });
    }
  }
  const manifest = {
    gerado_em: now().toISOString(),
    marca: identity.marca,
    pecas: items,
    foto: photo ? { fonte: photo.source, credito: photo.credit } : { fonte: 'nenhuma (fundo gráfico)' },
    contraste: identity.contraste,
    avisos: identity.avisos,
    observacoes: [
      'Peças em SVG vetorial; rasterização PNG (Playwright) e homologação visual humana ainda pendentes.',
      'Todo texto vem do briefing informado; nenhum nome, data ou QR Code é gerado por IA.',
      'Impressos (convite, régua, backdrop) não fazem parte desta fatia.',
    ],
  };
  entries.push({ name: 'manifesto.json', data: JSON.stringify(manifest, null, 2) });
  return { zip: createZip(entries), manifest, identity };
}
