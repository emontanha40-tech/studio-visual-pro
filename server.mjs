import http from 'node:http';
import { carregarAcervo } from './src/acervo-catalogo.mjs';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { CampaignQueue } from './src/queues/campaignQueue.ts';
import { createMediaProvider } from './src/services/ai-media/index.ts';

const port = Number(process.env.PORT || 4173);
const bindHost = process.env.BIND_HOST || '127.0.0.1';
const extraHosts = (process.env.ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);
const MAX_BODY_BYTES = 64 * 1024;

const routes = new Map([
  ['/', ['public/index.html', 'text/html']],
  ['/showcase', ['public/showcase.html', 'text/html']],
  ['/app.mjs', ['public/app.mjs', 'text/javascript']],
  ['/showcase.mjs', ['public/showcase.mjs', 'text/javascript']],
  ['/style.css', ['public/style.css', 'text/css']],
  ['/engine.mjs', ['src/engine.mjs', 'text/javascript']],
  ['/acervo.mjs', ['public/acervo.mjs', 'text/javascript']],
]);

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Corpo da requisição excede o limite de 64 KB.'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function getDefaultQueue() {
  return new CampaignQueue({ mediaProvider: createMediaProvider() });
}

/**
 * @param {{ lerAcervo?: typeof carregarAcervo, campaignQueue?: CampaignQueue | null }} [options]
 */
export function createServer({ lerAcervo = carregarAcervo, campaignQueue = null } = {}) {
  let activeQueue = campaignQueue ?? null;

  return http.createServer(async (req, res) => {
    const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`, ...extraHosts];
    if (!allowedHosts.includes(req.headers.host)) {
      res.writeHead(403);
      res.end('Host recusado');
      return;
    }

    const urlObj = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = urlObj.pathname;

    if (req.method === 'POST' && pathname === '/api/campaigns') {
      try {
        const brief = await readJsonBody(req);
        const queue = activeQueue ?? (activeQueue = getDefaultQueue());
        const job = queue.enqueue(brief);
        const completed = await queue.runJob(job.id);
        const status = completed.status === 'SHOWCASE_READY' ? 201 : 422;
        sendJson(res, status, completed);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao iniciar produção.';
        const status = /FAL_KEY|GEMINI_API_KEY/.test(message) ? 503 : 400;
        sendJson(res, status, { erro: message });
      }
      return;
    }

    if (req.method !== 'GET') {
      res.writeHead(405);
      res.end('Somente leitura');
      return;
    }

    if (pathname.startsWith('/api/campaigns/')) {
      const jobId = decodeURIComponent(pathname.slice('/api/campaigns/'.length));
      const job = activeQueue?.getJob(jobId);
      if (!job) {
        sendJson(res, 404, { erro: 'Campanha não encontrada.' });
        return;
      }
      sendJson(res, 200, job);
      return;
    }

    if (pathname === '/api/acervo') {
      try {
        const catalogo = await lerAcervo();
        sendJson(res, 200, catalogo);
      } catch {
        sendJson(res, 503, { erro: 'Catálogo indisponível. Tente novamente.' });
      }
      return;
    }

    const route = routes.get(pathname);
    if (!route) {
      res.writeHead(404);
      res.end('Não encontrado');
      return;
    }

    try {
      const body = await readFile(new URL(route[0], import.meta.url));
      res.writeHead(200, {
        'Content-Type': route[1] + '; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy':
          "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: https:; media-src 'self' https:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
      res.end(body);
    } catch {
      res.writeHead(500);
      res.end('Falha ao abrir arquivo');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer().listen(port, bindHost, () =>
    console.log(
      `Studio Visual Pro • ativo em: http://${bindHost}:${port}\nPreview de campanha: http://${bindHost}:${port}/showcase\nCtrl+C encerra.`,
    ),
  );
}
