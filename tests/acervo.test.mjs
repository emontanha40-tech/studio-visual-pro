import test from 'node:test';
import assert from 'node:assert/strict';
import {projetarAcervo, carregarAcervo} from '../src/acervo-catalogo.mjs';
import {filtrarAcervo, iniciarAcervo} from '../public/acervo.mjs';
import {createServer} from '../server.mjs';

async function request(t, path, opcoes = {}) {
  const server = createServer(opcoes);
  // Exercitar o mesmo handler sem abrir portas; testes/server.test.mjs cobre a rede real.
  return new Promise((resolve, reject) => {
    const resposta = {
      writeHead(status, headers = {}) {
        this.status = status;
        this.headers = Object.fromEntries(Object.entries(headers).map(([key,value]) => [key.toLowerCase(),value]));
      },
      end(body) { resolve({status:this.status, headers:this.headers, body:String(body)}); },
    };
    try { server.emit('request', {method:'GET', url:path, headers:{host:'127.0.0.1:4173'}}, resposta); }
    catch (error) { reject(error); }
  });
}

test('projeção exclui caminhos internos e texto privado mesmo quando o inventário ganha campos', () => {
  const catalogo = projetarAcervo([{arquivo:'pacote.zip', apresentacao:'/Users/pessoa/pasta/Charts Dark.pptx', slides:31,
    amostra_textos:['CONTEUDO_PRIVADO'], fontes:{SEGREDO:1}, token:'NAO_ENVIAR', caminho:'/privado'}], [{name:'pacote.zip',sha256:'HASH_PRIVADO'}]);
  assert.equal(catalogo.itens[0].nome, 'Charts Dark');
  assert.equal(catalogo.itens[0].categoria, 'Gráficos');
  const json = JSON.stringify(catalogo);
  for (const proibido of ['Users', '/privado', 'CONTEUDO_PRIVADO', 'SEGREDO', 'NAO_ENVIAR', 'HASH_PRIVADO', 'amostra_textos', 'fontes', 'sha256']) {
    assert.equal(json.includes(proibido), false, proibido);
  }
});

test('catálogo real distingue downloads, apresentações e arquivo sem quantidade conhecida', async () => {
  const catalogo = await carregarAcervo();
  assert.deepEqual(catalogo.resumo, {downloads:27, entradas:36, apresentacoesPptx:35, arquivosLegados:1});
  const legado = catalogo.itens.find(item => item.formato === 'PPT legado');
  assert.equal(legado.slides, null);
  assert.equal(legado.categoria, 'Animais');
  assert.equal(catalogo.itens.some(item => item.variante), true);
});

test('busca encontra categoria em português sem acentos, permite limpar e trata ausência de resultados', async () => {
  const {itens} = await carregarAcervo();
  assert.ok(filtrarAcervo(itens,'  GRAFICOS  ').some(item => item.nome === 'Charts Dark'));
  assert.ok(filtrarAcervo(itens,'calendarios').length > 0);
  assert.equal(filtrarAcervo(itens,'NÃO_EXISTE_987').length, 0);
  assert.equal(filtrarAcervo(itens,'   ').length, itens.length);
  assert.equal(filtrarAcervo(itens,'circle circulares').length, 1);
});

test('entrada desconhecida não permite construir catálogo com dados fora do manifesto', () => {
  assert.throws(() => projetarAcervo([{arquivo:'outro.zip'}], [{name:'permitido.zip'}]));
  assert.throws(() => projetarAcervo([], [{name:'duplicado'},{name:'duplicado'}]));
});

test('API entrega somente metadados e preserva o acesso restrito a originais e inventário bruto', async t => {
  const r = await request(t,'/api/acervo');
  assert.equal(r.status,200);
  assert.match(r.headers['content-type'], /application\/json/);
  const dados = JSON.parse(r.body);
  assert.equal(dados.itens.length,36);
  assert.deepEqual(Object.keys(dados.itens[0]).sort(), ['categoria','formato','id','nome','slides','variante']);
  for (const proibido of ['amostra_textos','/Users/','/Presentation','sha256','fontes','formas_nativas']) assert.equal(r.body.includes(proibido),false);
  for (const path of [
    '/acervo-local/infograficompanies/originais/Charts%20Dark.pptx',
    '/.agents/skills/usar-infograficompanies/references/inventario.json',
    '/.agents/skills/usar-infograficompanies/references/downloads-confirmados.json',
    '/knowledge/acervos/infograficompanies.json',
    '/%2e%2e/.env',
  ]) assert.equal((await request(t,path)).status,404,path);
});

test('falha de leitura retorna erro recuperável sem expor caminhos ou detalhes internos', async t => {
  const r = await request(t,'/api/acervo',{lerAcervo:async () => {throw new Error('ENOENT /Users/pessoa/segredo');}});
  assert.equal(r.status,503);
  assert.match(r.headers['cache-control'],/no-store/);
  assert.deepEqual(JSON.parse(r.body),{erro:'Catálogo indisponível. Tente novamente.'});
});

function documentoDeTeste() {
  class Elemento {
    constructor(tag) { this.tag = tag; this.children = []; this.eventos = {}; this.value = ''; this.hidden = false; this.textContent = ''; this.atributos = {}; }
    append(...nos) { this.children.push(...nos); }
    replaceChildren(...nos) { this.children = nos; }
    setAttribute(nome, valor) { this.atributos[nome] = valor; }
    addEventListener(nome, funcao) { this.eventos[nome] = funcao; }
    emitir(nome, evento = {}) { return this.eventos[nome](evento); }
    set innerHTML(_) { throw new Error('Não usar HTML interpretado para dados do catálogo.'); }
  }
  const elementos = Object.fromEntries(['busca','form','resultados','status','resumo','repetir'].map(nome => [`#acervo-${nome}`,new Elemento(nome)]));
  return {querySelector: seletor => elementos[seletor], createElement: tag => new Elemento(tag)};
}

test('interface mantém campo e valor durante busca e mostra ausência de resultados sem interpretar HTML', async t => {
  const documento = documentoDeTeste();
  const catalogo = await carregarAcervo();
  t.mock.method(globalThis,'fetch',async () => ({ok:true,json:async () => catalogo}));
  await iniciarAcervo(documento);
  const campo = documento.querySelector('#acervo-busca');
  campo.value = 'calendarios';
  campo.emitir('input');
  assert.ok(documento.querySelector('#acervo-resultados').children.length > 0);
  assert.equal(documento.querySelector('#acervo-busca'), campo);
  assert.equal(campo.value, 'calendarios');
  campo.value = '<img src=x onerror=alert(1)>';
  campo.emitir('input');
  assert.match(documento.querySelector('#acervo-status').textContent,/Nenhum modelo encontrado/);
  assert.equal(documento.querySelector('#acervo-resultados').children.length,0);
  campo.value = ' ';
  campo.emitir('input');
  assert.equal(documento.querySelector('#acervo-resultados').children.length,36);
  assert.match(documento.querySelector('#acervo-resumo').textContent,/27 downloads catalogados/);
});

test('interface permite nova tentativa após falha de carregamento', async t => {
  const documento = documentoDeTeste();
  const catalogo = await carregarAcervo();
  let chamadas = 0;
  t.mock.method(globalThis,'fetch',async () => ++chamadas === 1 ? {ok:false} : {ok:true,json:async () => catalogo});
  await iniciarAcervo(documento);
  assert.match(documento.querySelector('#acervo-status').textContent,/Não foi possível carregar/);
  assert.equal(documento.querySelector('#acervo-repetir').hidden,false);
  await documento.querySelector('#acervo-repetir').emitir('click');
  assert.equal(documento.querySelector('#acervo-repetir').hidden,true);
  assert.equal(documento.querySelector('#acervo-resultados').children.length,36);
});
