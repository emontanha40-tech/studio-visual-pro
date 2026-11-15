function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function filtrarAcervo(itens, consulta) {
  const termos = normalizar(consulta).split(/\s+/).filter(Boolean);
  return itens.filter(item => {
    const texto = normalizar(`${item.nome} ${item.categoria ?? ''}`);
    return termos.every(termo => texto.includes(termo));
  });
}

export function iniciarAcervo(documento = document) {
  const campo = documento.querySelector('#acervo-busca');
  const formulario = documento.querySelector('#acervo-form');
  const resultados = documento.querySelector('#acervo-resultados');
  const status = documento.querySelector('#acervo-status');
  const resumo = documento.querySelector('#acervo-resumo');
  const repetir = documento.querySelector('#acervo-repetir');
  let dados = null;

  function elemento(tag, texto, classe) {
    const no = documento.createElement(tag);
    if (texto !== undefined) no.textContent = texto;
    if (classe) no.className = classe;
    return no;
  }

  function pesquisar() {
    if (!dados) return;
    const itens = filtrarAcervo(dados.itens, campo.value);
    resultados.replaceChildren();
    status.className = itens.length ? '' : 'acervo-empty';
    status.textContent = itens.length
      ? `${itens.length} de ${dados.resumo.entradas} entradas exibidas.`
      : 'Nenhum modelo encontrado. Tente outro nome ou tema.';
    for (const item of itens) {
      const cartao = elemento('article', undefined, 'acervo-result-card');
      cartao.append(elemento('h3', item.nome));
      const detalhes = elemento('p', undefined, 'acervo-result-meta');
      detalhes.append(
        elemento('span', item.categoria ?? 'Categoria não informada', 'acervo-badge'),
        elemento('span', item.slides === null ? 'Quantidade de slides não informada' : `${item.slides} slides`, 'acervo-badge'),
        elemento('span', item.formato, 'acervo-badge'),
      );
      cartao.append(detalhes);
      if (item.variante) cartao.append(elemento('p', item.variante, 'hint'));
      resultados.append(cartao);
    }
  }

  async function carregar() {
    dados = null;
    repetir.hidden = true;
    resultados.replaceChildren();
    resumo.textContent = '';
    status.className = 'acervo-loading';
    status.textContent = 'Carregando catálogo…';
    resultados.setAttribute('aria-busy', 'true');
    const controle = new AbortController();
    const prazo = setTimeout(() => controle.abort(), 8000);
    try {
      const resposta = await fetch('/api/acervo', {signal: controle.signal});
      if (!resposta.ok) throw new Error('Catálogo indisponível');
      const recebido = await resposta.json();
      if (!Array.isArray(recebido.itens) || !recebido.resumo || !Number.isSafeInteger(recebido.resumo.entradas)) {
        throw new Error('Resposta inválida');
      }
      dados = recebido;
      const r = dados.resumo;
      resumo.textContent = `${r.downloads} downloads catalogados · ${r.apresentacoesPptx} apresentações PPTX · ${r.arquivosLegados} arquivo PPT legado. As ${r.entradas} entradas incluem versões e variantes; não representam modelos únicos.`;
      pesquisar();
    } catch {
      status.className = 'acervo-error';
      status.textContent = 'Não foi possível carregar o catálogo. Tente novamente.';
      repetir.hidden = false;
    } finally {
      clearTimeout(prazo);
      resultados.setAttribute('aria-busy', 'false');
    }
  }

  campo.addEventListener('input', pesquisar);
  formulario.addEventListener('submit', evento => { evento.preventDefault(); pesquisar(); });
  repetir.addEventListener('click', carregar);
  return carregar();
}
