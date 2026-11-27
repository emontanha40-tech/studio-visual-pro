import { createHash } from 'node:crypto';
import { resolvePieces } from './catalog.mjs';
import { buildIdentity } from './identity.mjs';
import { resolvePhoto } from './photos.mjs';
import { renderPieceSVG, renderLandingHTML } from './render.mjs';
import { renderLinktreeHTML, renderHotsiteHTML, renderEmailKitHTML } from './webTemplates.mjs';
import { renderPrintPieces } from './print.mjs';
import { renderSvgPngs, RETINA } from './raster.mjs';
import { TEASER_FORMATS, renderTeaser } from './teaser.mjs';
import { createZip } from './zip.mjs';

const FOLDER = { web: 'site', social: 'social', projecao: 'projecao', impressos: 'impressos' };
const sha = (d) => createHash('sha256').update(d).digest('hex');

/** Etapa 2: gera o lote selecionado e empacota em ZIP organizado por pastas. */
export async function buildKit(input = {}, { photoResolver = resolvePhoto, now = () => new Date(), rasterizer = renderSvgPngs, teaserRenderer = renderTeaser } = {}) {
  const pieces = resolvePieces(input);
  const identity = buildIdentity(input.identidade ?? input);
  const photo = await photoResolver({ nicho: identity.nicho });
  const printed = await renderPrintPieces(pieces.filter((p) => p.format === 'print'), identity);
  const svgs = new Map(pieces.filter((p) => p.format === 'svg').map((p) => [
    p.id, renderPieceSVG(p, identity, p.id === 'slide-fundo' || p.id === 'screen' || p.transparent ? null : photo)]));
  const pngs = await rasterizer(pieces.filter((p) => svgs.has(p.id))
    .map((p) => ({ id: p.id, width: p.width, height: p.height, svg: svgs.get(p.id), transparent: Boolean(p.transparent) })));
  const entries = [];
  const items = [];
  for (const p of pieces) {
    const dir = FOLDER[p.category];
    if (p.format === 'print') {
      const arquivos = printed.get(p.id).flatMap(({ side, png, pdf }) => (
        [['png', png], ['pdf', pdf]].map(([format, data]) => {
          const arquivo = `${dir}/${p.id}-${side}.${format}`;
          entries.push({ name: arquivo, data });
          return { arquivo, lado: side, formato: format, sha256: sha(data) };
        })
      ));
      const { pixelWidth, pixelHeight } = printed.get(p.id)[0].geometry;
      items.push({
        id: p.id, arquivo: arquivos[0].arquivo, sha256: arquivos[0].sha256, arquivos,
        corte_final_mm: { largura: p.width, altura: p.height },
        sangria_final_mm: p.print.bleedMm, escala: `1:${p.print.scale}`, dpi: p.print.dpi,
        png_px: { largura: pixelWidth, altura: pixelHeight }, gabarito_provisorio: p.print.provisional,
      });
    } else if (p.id === 'landing' || p.id === 'linktree' || p.id === 'hotsite') {
      const photoFile = photo ? `foto-base.${photo.mime === 'image/png' ? 'png' : 'jpg'}` : null;
      const html = p.id === 'landing'
        ? renderLandingHTML(identity, { photo, photoFile, whatsapp: input.whatsapp })
        : p.id === 'linktree'
          ? renderLinktreeHTML(identity, { photo, photoFile, whatsapp: input.whatsapp })
          : renderHotsiteHTML(identity, { photo, photoFile, whatsapp: input.whatsapp, programacao: input.programacao });
      entries.push({ name: `${dir}/${p.id}/index.html`, data: html });
      if (photo) entries.push({ name: `${dir}/${p.id}/${photoFile}`, data: photo.bytes });
      items.push({ id: p.id, arquivo: `${dir}/${p.id}/index.html`, sha256: sha(html) });
    } else if (p.id === 'email-kit') {
      const { previewHtml, signatureHtml, newsletterHeaderHtml } = renderEmailKitHTML(identity);
      entries.push(
        { name: `${dir}/email-kit/index.html`, data: previewHtml },
        { name: `${dir}/email-kit/assinatura-email.html`, data: signatureHtml },
        { name: `${dir}/email-kit/cabecalho-newsletter.html`, data: newsletterHeaderHtml },
      );
      items.push({
        id: p.id,
        arquivo: `${dir}/email-kit/index.html`,
        arquivos: [`${dir}/email-kit/index.html`, `${dir}/email-kit/assinatura-email.html`, `${dir}/email-kit/cabecalho-newsletter.html`],
        sha256: sha(previewHtml),
      });
    } else {
      const svg = svgs.get(p.id);
      const base = `${dir}/${p.id}-${p.width}x${p.height}`;
      const png = pngs.get(p.id);
      entries.push({ name: `${base}.png`, data: png }, { name: `${base}.svg`, data: svg });
      items.push({ id: p.id, arquivo: `${base}.png`, vetor: `${base}.svg`, largura: p.width, altura: p.height,
        png_px: { largura: p.width * RETINA, altura: p.height * RETINA }, retina: RETINA, sha256: sha(png) });
    }
  }
  entries.push({ name: 'brand/logo.svg', data: identity.logo_svg },
    { name: 'brand/brand-tokens.json', data: JSON.stringify({ marca: identity.marca, ...identity.kit }, null, 2) });
  if (photo) entries.push({ name: `brand/foto-base.${photo.mime === 'image/png' ? 'png' : 'jpg'}`, data: photo.bytes });
  let video = null;
  if (input.teaser) {
    if (!TEASER_FORMATS[input.teaser]) throw new Error('Formato de teaser inválido.');
    const mp4 = await teaserRenderer(input.identidade ?? input, input.teaser);
    const arquivo = `video/teaser-60s-${input.teaser.replace(':', 'x')}.mp4`;
    entries.push({ name: arquivo, data: mp4 });
    video = { arquivo, formato: input.teaser, duracao_s: 60, sha256: sha(mp4) };
  }
  const manifest = {
    gerado_em: now().toISOString(),
    marca: identity.marca,
    pecas: items,
    video,
    pastas: ['site', 'social', 'projecao', 'impressos', 'video', 'brand'],
    foto: photo ? { fonte: photo.source, credito: photo.credit } : { fonte: 'nenhuma (fundo gráfico)' },
    contraste: identity.contraste,
    avisos: identity.avisos,
    observacoes: [
      'Peças digitais em PNG Retina (2×, renderizado via Playwright) com SVG vetorial ao lado; homologação visual humana pendente.',
      'Todo texto vem do briefing informado; nenhum nome, data ou QR Code é gerado por IA.',
      'Impressos em RGB: PNG com sangria e PDF com sangria e marcas de corte. Confirme gabarito, perfil ICC e prova visual com a gráfica.',
    ],
  };
  entries.push({ name: 'manifesto.json', data: JSON.stringify(manifest, null, 2) });
  return { zip: createZip(entries), manifest, identity };
}
