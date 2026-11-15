import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createServer} from '../server.mjs';
async function request(t,path,method='GET',host='127.0.0.1:4173'){
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:server.address().port,path,method,headers:{Host:host}},res=>{let body='';res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end();});
}
test('servidor serve painel e política de conteúdo',async t=>{const r=await request(t,'/');assert.equal(r.status,200);assert.ok(r.body.includes('Studio Visual Pro'));assert.ok(r.headers['content-security-policy'].includes("frame-ancestors 'none'"));});
test('não expõe arquivos fora da lista pública',async t=>{assert.equal((await request(t,'/../.env')).status,404);});
test('recusa escrita HTTP',async t=>{assert.equal((await request(t,'/','POST')).status,405);});
test('recusa Host externo',async t=>{assert.equal((await request(t,'/','GET','example.com')).status,403);});

test('HTTP real entrega catálogo e mantém inventário e originais fora das rotas públicas',async t=>{
  const r=await request(t,'/api/acervo');
  assert.equal(r.status,200);
  const catalogo=JSON.parse(r.body);
  assert.equal(catalogo.resumo.downloads,27);
  assert.equal(catalogo.itens.length,36);
  for(const campo of ['amostra_textos','fontes','/Users/','sha256'])assert.equal(r.body.includes(campo),false);
  for(const caminho of ['/acervo-local/infograficompanies/originais/Charts%20Dark.pptx','/.agents/skills/usar-infograficompanies/references/inventario.json'])assert.equal((await request(t,caminho)).status,404);
  assert.equal((await request(t,'/acervo.mjs')).status,200);
});
