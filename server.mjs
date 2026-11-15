import http from 'node:http';
import {carregarAcervo} from './src/acervo-catalogo.mjs';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
const port = Number(process.env.PORT || 4173);
const routes = new Map([
  ['/', ['public/index.html','text/html']],
  ['/app.mjs', ['public/app.mjs','text/javascript']],
  ['/style.css', ['public/style.css','text/css']],
  ['/engine.mjs', ['src/engine.mjs','text/javascript']],
  ['/acervo.mjs', ['public/acervo.mjs','text/javascript']],
]);
export function createServer({lerAcervo = carregarAcervo} = {}) {
  return http.createServer(async (req, res) => {
    const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!allowedHosts.includes(req.headers.host)) { res.writeHead(403); res.end('Host recusado'); return; }
    if (req.method !== 'GET') { res.writeHead(405); res.end('Somente leitura'); return; }
    if (req.url === '/api/acervo') {
      try {
        const catalogo = await lerAcervo();
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
          'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer'});
        res.end(JSON.stringify(catalogo));
      } catch {
        res.writeHead(503, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
          'X-Content-Type-Options':'nosniff'});
        res.end(JSON.stringify({erro:'Catálogo indisponível. Tente novamente.'}));
      }
      return;
    }
    const route = routes.get(req.url);
    if (!route) { res.writeHead(404); res.end('Não encontrado'); return; }
    try {
      const body = await readFile(new URL(route[0], import.meta.url));
      res.writeHead(200, {'Content-Type':route[1]+'; charset=utf-8', 'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
        'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});
      res.end(body);
    } catch { res.writeHead(500); res.end('Falha ao abrir arquivo'); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer().listen(port, '127.0.0.1', () => console.log(`Studio Visual Pro • laboratório local: http://127.0.0.1:${port}\nCtrl+C encerra. Use apenas dados de teste.`));
}
