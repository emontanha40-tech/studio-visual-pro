// Catálogo unificado. Dimensões digitais em px e dimensões de corte dos impressos em mm.
// safe = fração de margem segura por lado {t,r,b,l}. Story: topo/base livres da UI do app.
function printPiece(id, name, width, height, { sides = ['frente'], scale = 1 } = {}) {
  const large = scale !== 1;
  return {
    id, name, width, height, category: 'impressos', format: 'print', unit: 'mm',
    print: { sides, scale, dpi: large ? 150 : 300, bleedMm: large ? 10 : 3, provisional: large },
  };
}

export const CATEGORIES = [
  { id: 'web', name: 'Web' },
  { id: 'social', name: 'Redes Sociais' },
  { id: 'projecao', name: 'Projeção / Telão' },
  { id: 'impressos', name: 'Impressos e gráfica' },
];

export const KIT_PIECES = [
  { id: 'landing', category: 'web', name: 'Landing Page', width: 1440, height: null, format: 'html', note: 'Use ?static=true para desligar animações (Auditor Visual).' },
  { id: 'feed', category: 'social', name: 'Feed 4:5', width: 1080, height: 1350, format: 'svg', safe: { t: 0.05, r: 0.05, b: 0.05, l: 0.05 } },
  { id: 'story', category: 'social', name: 'Story 9:16', width: 1080, height: 1920, format: 'svg', safe: { t: 250 / 1920, r: 0.06, b: 340 / 1920, l: 0.06 }, note: 'Zonas livres: 250px topo, 340px base.' },
  { id: 'whatsapp', category: 'social', name: 'WhatsApp 1:1', width: 1080, height: 1080, format: 'svg', safe: { t: 0.06, r: 0.06, b: 0.06, l: 0.06 } },
  { id: 'banner', category: 'social', name: 'Banner 1200×628', width: 1200, height: 628, format: 'svg', safe: { t: 0.08, r: 0.06, b: 0.08, l: 0.06 } },
  { id: 'screen', category: 'projecao', name: 'Telão 16:9 (overscan 10%)', width: 1920, height: 1080, format: 'svg', safe: { t: 0.1, r: 0.1, b: 0.1, l: 0.1 }, note: 'Conteúdo dentro de 10% de overscan.' },
  { id: 'slide-capa', category: 'projecao', name: 'Slide de Série — capa com título', width: 1920, height: 1080, format: 'svg', safe: { t: 0.1, r: 0.1, b: 0.1, l: 0.1 } },
  { id: 'slide-fundo', category: 'projecao', name: 'Slide de Série — fundo limpo (letras)', width: 1920, height: 1080, format: 'svg', safe: { t: 0.1, r: 0.1, b: 0.1, l: 0.1 }, note: 'Sem texto: para letras e projeção.' },
  printPiece('invitation', 'Convite frente e verso', 100, 150, { sides: ['frente', 'verso'] }),
  printPiece('prayer', 'Bloco de Oração', 148, 210),
  printPiece('decision', 'Cartão de Decisão', 148, 105),
  printPiece('bookmark', 'Régua de Livro frente e verso', 50, 180, { sides: ['frente', 'verso'] }),
  printPiece('backdrop', 'Backdrop', 3200, 1800, { scale: 10 }),
  printPiece('wind', 'Wind Banner', 700, 2000, { scale: 10 }),
];

export const PRESETS = [
  { id: 'culto-serie', name: 'Kit Culto / Série', pieces: ['feed', 'story', 'whatsapp', 'screen', 'slide-capa', 'slide-fundo'] },
  { id: 'lancamento', name: 'Kit Lançamento', pieces: ['landing', 'feed', 'story', 'whatsapp', 'banner'] },
];

export function resolvePieces({ pieces, preset } = {}) {
  let ids = pieces;
  if (!ids && preset) {
    const p = PRESETS.find((x) => x.id === preset);
    if (!p) throw new Error('Preset desconhecido.');
    ids = p.pieces;
  }
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('Selecione ao menos uma peça.');
  const out = [];
  for (const id of new Set(ids)) {
    const piece = KIT_PIECES.find((x) => x.id === id);
    if (!piece) throw new Error(`Peça desconhecida: ${String(id).slice(0, 40)}`);
    out.push(piece);
  }
  return out;
}
