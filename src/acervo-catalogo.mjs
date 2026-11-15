import {readFile} from 'node:fs/promises';

const raiz = new URL('../.agents/skills/usar-infograficompanies/references/', import.meta.url);

function nomeBase(valor) {
  return typeof valor === 'string' ? valor.split(/[\\/]/).at(-1).normalize('NFC').replace(/\s+/g, ' ').trim() : '';
}

function categoriaPeloNome(nome) {
  const temas = [
    [/fitness|exerc[ií]cio/i, 'Atividade física'],
    [/sport|futebol/i, 'Esportes'],
    [/food|alimento/i, 'Alimentos'],
    [/calendar|calend[aá]rio/i, 'Calendários'],
    [/ecolog|energia/i, 'Ecologia'],
    [/pet\s*shop/i, 'Animais'],
    [/natal/i, 'Natal'],
    [/circle|c[ií]rculo/i, 'Diagramas circulares'],
    [/chart|gr[aá]fico/i, 'Gráficos'],
    [/table|tabela/i, 'Tabelas'],
    [/arrow|seta/i, 'Setas'],
    [/alphabet|alfabeto/i, 'Alfabeto'],
    [/business|neg[oó]cio/i, 'Negócios'],
    [/creative|criati/i, 'Criatividade'],
    [/device|dispositivo/i, 'Dispositivos'],
    [/digtal|digital/i, 'Digital'],
    [/south.?america/i, 'Mapas'],
    [/banner/i, 'Banners'],
    [/abstract/i, 'Abstratos'],
  ];
  return temas.find(([padrao]) => padrao.test(nome))?.[1] ?? null;
}

// Construir uma projeção permitida, sem copiar objetos ou caminhos do inventário.
export function projetarAcervo(inventario, manifesto) {
  if (!Array.isArray(inventario) || !Array.isArray(manifesto)) throw new Error('Acervo inválido');
  const downloads = new Set(manifesto.map(item => item?.name));
  if (downloads.has(undefined) || downloads.size !== manifesto.length) throw new Error('Manifesto inválido');
  const itens = inventario.map((item, indice) => {
    if (!item || typeof item.arquivo !== 'string' || !downloads.has(item.arquivo)) throw new Error('Entrada inválida');
    const apresentacao = nomeBase(item.apresentacao);
    const origem = nomeBase(item.arquivo);
    const nome = (apresentacao || origem).replace(/\.(pptx?|zip)$/i, '').replace(/_[a-f\d]{32}$/i, '');
    if (!nome) throw new Error('Nome ausente');
    return {
      id: `modelo-${indice + 1}`,
      nome,
      categoria: categoriaPeloNome(nome),
      slides: Number.isSafeInteger(item.slides) && item.slides > 0 ? item.slides : null,
      formato: /\.pptx$/i.test(apresentacao) ? 'PPTX' : /\.ppt$/i.test(origem) ? 'PPT legado' : 'Não informado',
      variante: /google slides/i.test(apresentacao) ? 'Versão identificada como Google Slides' : null,
    };
  });
  return {
    resumo: {
      downloads: downloads.size,
      entradas: itens.length,
      apresentacoesPptx: itens.filter(item => item.formato === 'PPTX').length,
      arquivosLegados: itens.filter(item => item.formato === 'PPT legado').length,
    },
    itens,
  };
}

export async function carregarAcervo() {
  const [inventario, manifesto] = await Promise.all([
    readFile(new URL('inventario.json', raiz), 'utf8'),
    readFile(new URL('downloads-confirmados.json', raiz), 'utf8'),
  ]);
  return projetarAcervo(JSON.parse(inventario), JSON.parse(manifesto));
}
