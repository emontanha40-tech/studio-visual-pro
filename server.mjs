import http from 'node:http';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { carregarAcervo } from './src/acervo-catalogo.mjs';
import { extractSemanticBriefing, BRAND_KITS } from './src/website/brandKit.mjs';
import { KIT_PIECES, PRESETS, CATEGORIES } from './src/kit/catalog.mjs';
import { buildIdentity } from './src/kit/identity.mjs';
import { buildKit } from './src/kit/batch.mjs';
import { createTeaserQueue } from './src/kit/teaser.mjs';
import { fillQuickBrief } from './src/brand/quickBrief.mjs';
import { generateKit } from './src/brand/kitService.mjs';
import { openProjectStore, isKitId } from './src/brand/projectStore.mjs';
import { openStyleStore, isPresetId } from './src/style-lab/store.mjs';
import { extractStyleFromUrl } from './src/style-lab/urlExtractor.mjs';
import { extractStyleFromImage } from './src/style-lab/imageExtractor.mjs';
import { extractStyleFromVideo } from './src/style-lab/videoExtractor.mjs';
import { generateCampaignPiece, publishedFile, PUBLISHED_DIR } from './src/brand/campaignService.mjs';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { CampaignQueue } from './src/queues/campaignQueue.ts';
import { createMediaProvider } from './src/services/ai-media/index.ts';

const execFileAsync = promisify(execFile);

// Carrega .env automaticamente (Node 22+) para que FAL_KEY / ANTHROPIC_API_KEY nunca fiquem vazias
const envPath = new URL('.env', import.meta.url);
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // ignora erro de leitura de .env opcional
  }
}

const port = Number(process.env.PORT || 4173);
const bindHost = process.env.BIND_HOST || '127.0.0.1';
const rawExtraHosts = (process.env.ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);
const MAX_BODY_BYTES = 64 * 1024;

function normalizeAllowedHosts(hosts, serverPort) {
  return hosts
    .map((h) => String(h).trim())
    .filter(Boolean)
    .flatMap((h) => (h.includes(':') ? [h] : [h, `${h}:${serverPort}`]));
}

const routes = new Map([
  ['/', ['public/index.html', 'text/html']],
  ['/website', ['public/website.html', 'text/html']],
  ['/showcase', ['public/showcase.html', 'text/html']],
  ['/estilo', ['public/estilo.html', 'text/html']],
  ['/app.mjs', ['public/app.mjs', 'text/javascript']],
  ['/website.mjs', ['public/website.mjs', 'text/javascript']],
  ['/kit', ['public/kit.html', 'text/html']],
  ['/shell.mjs', ['public/shell.mjs', 'text/javascript']],
  ['/kit.mjs', ['public/kit.mjs', 'text/javascript']],
  ['/estilo.mjs', ['public/estilo.mjs', 'text/javascript']],
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

function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error(`Corpo da requisição excede o limite de ${Math.round(maxBytes / 1024)} KB.`));
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

function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error(`Arquivo excede o limite de ${Math.round(maxBytes / (1024 * 1024))} MB.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getDefaultQueue() {
  return new CampaignQueue({ mediaProvider: createMediaProvider() });
}

/**
 * @param {{ lerAcervo?: typeof carregarAcervo, campaignQueue?: CampaignQueue | null, extraAllowedHosts?: string[], projectStore?: ReturnType<typeof openProjectStore> | null, styleStore?: ReturnType<typeof openStyleStore> | null, kitDeps?: Record<string, any> }} [options]
 */
export function createServer({ lerAcervo = carregarAcervo, campaignQueue = null, extraAllowedHosts = rawExtraHosts, projectStore = null, styleStore = null, kitDeps = {} } = {}) {
  const teaserQueue = createTeaserQueue(kitDeps.renderTeaser);
  let activeQueue = campaignQueue ?? null;
  let activeStore = projectStore ?? null;
  let activeStyleStore = styleStore ?? null;
  const getStore = () => activeStore ?? (activeStore = openProjectStore());
  const getStyleStore = () => activeStyleStore ?? (activeStyleStore = openStyleStore());
  const enrichPreset = (payload) => {
    if (!payload || typeof payload !== 'object') return payload;
    delete payload.custom_brand_kit;
    if (payload.identidade && typeof payload.identidade === 'object') delete payload.identidade.custom_brand_kit;
    const modelo = payload.modelo || payload.identidade?.modelo;
    if (typeof modelo === 'string' && modelo.startsWith('custom-')) {
      const preset = getStyleStore().getPreset(modelo);
      if (preset?.brand_kit) {
        if (payload.identidade && typeof payload.identidade === 'object') {
          return { ...payload, identidade: { ...payload.identidade, custom_brand_kit: preset.brand_kit } };
        }
        return { ...payload, custom_brand_kit: preset.brand_kit };
      }
      throw new Error('O preset selecionado não está mais disponível.');
    }
    return payload;
  };
  let extractingStyle = false;
  async function runStyleExtraction(res, work) {
    if (extractingStyle) {
      sendJson(res, 429, { ok: false, erro: 'Uma extração de estilo já está em andamento.' });
      return;
    }
    extractingStyle = true;
    try {
      const result = await work();
      sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      sendJson(res, 400, { ok: false, erro: err instanceof Error ? err.message : 'Falha ao extrair o estilo.' });
    } finally {
      extractingStyle = false;
    }
  }
  const publishDir = kitDeps.publishDir ?? PUBLISHED_DIR;
  const normalizedExtraHosts = normalizeAllowedHosts(extraAllowedHosts, port);

  const server = http.createServer(async (req, res) => {
    const addr = server.address();
    const activePort = typeof addr === 'object' && addr ? addr.port : port;
    const allowedHosts = [
      `127.0.0.1:${port}`,
      `localhost:${port}`,
      `127.0.0.1:${activePort}`,
      `localhost:${activePort}`,
      ...normalizedExtraHosts,
    ];
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

    if (req.method === 'POST' && pathname === '/api/brand/generate') {
      try {
        const piece = await generateCampaignPiece(await readJsonBody(req));
        sendJson(res, 201, piece);
      } catch (err) {
        sendJson(res, 400, { erro: err instanceof Error ? err.message : 'Falha ao gerar peça.' });
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/api/brand/kit') {
      try {
        const result = await generateKit(await readJsonBody(req), { store: getStore(), ...kitDeps });
        sendJson(res, 201, result);
      } catch (err) {
        sendJson(res, 400, { erro: err instanceof Error ? err.message : 'Falha ao gerar kit.' });
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/api/kit/teasers') {
      try {
        const { status, body } = teaserQueue.submit(enrichPreset(await readJsonBody(req)));
        sendJson(res, status, body);
      } catch {
        sendJson(res, 400, { code: 'invalid_briefing', erro: 'Não foi possível ler o briefing.' });
      }
      return;
    }

    const teaserMatch = /^\/api\/kit\/teasers\/([a-f0-9-]{36})(\/video)?$/.exec(pathname);
    if (req.method === 'GET' && teaserMatch) {
      const [, id, isVideo] = teaserMatch;
      const job = teaserQueue.get(id);
      if (!job) {
        sendJson(res, 404, { code: 'teaser_not_found', erro: 'Teaser indisponível. Gere novamente.' });
      } else if (!isVideo) {
        const { status, format, code, erro } = job;
        sendJson(res, 200, { id, status, format, code, erro,
          videoUrl: status === 'ready' ? `/api/kit/teasers/${id}/video` : undefined });
      } else if (job.status !== 'ready') {
        sendJson(res, 409, { code: 'teaser_not_ready', erro: job.erro || 'O vídeo ainda está sendo gerado.' });
      } else {
        const video = job.video;
        const headers = {
          'Content-Type': 'video/mp4',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Accept-Ranges': 'bytes',
        };
        if (urlObj.searchParams.has('download')) {
          headers['Content-Disposition'] = `attachment; filename="teaser-${job.format.replace(':', 'x')}.mp4"`;
        }
        const range = req.headers.range;
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          const start = match?.[1] ? Number(match[1]) : Math.max(0, video.length - Number(match?.[2]));
          const end = match?.[1] && match[2] ? Math.min(Number(match[2]), video.length - 1) : video.length - 1;
          if (!match || start > end) {
            res.writeHead(416, { 'Content-Range': `bytes */${video.length}` }).end();
            return;
          }
          res.writeHead(206, { ...headers, 'Content-Length': end - start + 1,
            'Content-Range': `bytes ${start}-${end}/${video.length}` }).end(video.subarray(start, end + 1));
        } else {
          res.writeHead(200, { ...headers, 'Content-Length': video.length }).end(video);
        }
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/api/kit/ai-fill') {
      try {
        const { briefing } = await readJsonBody(req);
        const r = await fillQuickBrief(String(briefing ?? ''));
        const bText = String(briefing ?? '').toLowerCase();
        const modelo = /igreja|culto|minist[eé]r|s[eé]rie b[ií]blica|confer[eê]ncia crist[aã]|pastor/.test(bText)
          ? 'ministerial-serie'
          : /su[ií][çc]o|minimalista|arquitetura|galeria|est[uú]dio de design/.test(bText)
            ? 'minimalista-suico'
            : ({ saas_modern: 'tech-cinematografico', local_authority: 'editorial-clean', product_launch: 'comercial-conversao' }[r.archetype] || 'tech-cinematografico');
        const cut = (t, n) => String(t).slice(0, n);
        sendJson(res, 200, { ok: true, origem: r.source, campos: {
          marca: cut(r.tokens?.brand_name ?? r.brand_name ?? '', 60), nicho: cut(String(briefing).trim(), 80),
          slogan: cut(r.headline, 140), subtitulo: cut(r.subtitle, 200), modelo,
        } });
      } catch (err) {
        sendJson(res, 400, { ok: false, erro: err instanceof Error ? err.message : 'Não foi possível preencher a identidade.' });
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/api/kit/identity') {
      try {
        sendJson(res, 200, { ok: true, identidade: buildIdentity(enrichPreset(await readJsonBody(req))) });
      } catch (err) {
        sendJson(res, 400, { ok: false, erro: err instanceof Error ? err.message : 'Identidade inválida.' });
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/api/kit/build') {
      try {
        const { zip, manifest } = await buildKit(enrichPreset(await readJsonBody(req)), { ...(kitDeps.rasterizer && { rasterizer: kitDeps.rasterizer }), ...(kitDeps.renderTeaser && { teaserRenderer: kitDeps.renderTeaser }), ...(kitDeps.photoResolver && { photoResolver: kitDeps.photoResolver }) });
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="kit-studio-visual-pro.zip"',
          'X-Kit-Pecas': String(manifest.pecas.length),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(zip);
      } catch (err) {
        sendJson(res, 400, { ok: false, erro: err instanceof Error ? err.message : 'Falha ao gerar kit.' });
      }
      return;
    }

    // ===== Fatia 12: Laboratório de Estilo (Engenharia Reversa de DNA Visual & Motion) =====
    if (pathname.startsWith('/api/style-lab/') && req.method !== 'GET' &&
        (req.headers['sec-fetch-site'] === 'cross-site' ||
          (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` &&
            req.headers.origin !== `https://${req.headers.host}`))) {
      sendJson(res, 403, { ok: false, erro: 'Origem não autorizada.' });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/style-lab/presets') {
      const nativos = Object.values(BRAND_KITS).map((k) => ({ id: k.id, name: k.nome, source_type: 'native', brand_kit: k }));
      const customizados = getStyleStore().listPresets(100);
      sendJson(res, 200, { ok: true, nativos, customizados });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/style-lab/presets') {
      try {
        const body = await readJsonBody(req, 512 * 1024);
        const saved = getStyleStore().savePreset(body);
        sendJson(res, 201, { ok: true, preset: saved });
      } catch (err) {
        sendJson(res, 400, { ok: false, erro: err instanceof Error ? err.message : 'Falha ao salvar preset.' });
      }
      return;
    }

    const delPresetMatch = /^\/api\/style-lab\/presets\/([a-z0-9-]+)$/.exec(pathname);
    if (req.method === 'DELETE' && delPresetMatch) {
      const id = delPresetMatch[1];
      if (!isPresetId(id) || !getStyleStore().deletePreset(id)) {
        sendJson(res, 404, { ok: false, erro: 'Preset não encontrado.' });
        return;
      }
      sendJson(res, 200, { ok: true, id });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/style-lab/extract/url') {
      await runStyleExtraction(res, async () => {
        const body = await readJsonBody(req);
        const extractor = kitDeps.extractStyleFromUrl || extractStyleFromUrl;
        return extractor(body.url, { allowPrivate: Boolean(kitDeps.allowPrivateUrls) });
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/style-lab/extract/image') {
      await runStyleExtraction(res, async () => {
        const body = await readJsonBody(req, 12 * 1024 * 1024);
        const rawB64 = String(body.imageBase64 || '').replace(/^data:[^;]+;base64,/, '');
        if (!rawB64) throw new Error('Envie uma imagem em base64 para extração.');
        const buf = Buffer.from(rawB64, 'base64');
        const extractor = kitDeps.extractStyleFromImage || extractStyleFromImage;
        return extractor(buf, {
          mimeType: body.mimeType || 'image/png',
          filename: body.filename || 'referencia.png',
        });
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/style-lab/extract/video') {
      await runStyleExtraction(res, async () => {
        const ct = String(req.headers['content-type'] || '').toLowerCase();
        let buf;
        let filename = urlObj.searchParams.get('filename') || 'referencia.mp4';
        if (ct.includes('application/json')) {
          const body = await readJsonBody(req, 36 * 1024 * 1024);
          const rawB64 = String(body.videoBase64 || '').replace(/^data:[^;]+;base64,/, '');
          buf = Buffer.from(rawB64, 'base64');
          if (body.filename) filename = body.filename;
        } else {
          buf = await readRawBody(req, 26 * 1024 * 1024);
        }
        const extractor = kitDeps.extractStyleFromVideo || extractStyleFromVideo;
        return extractor(buf, { filename });
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/website/extract') {
      try {
        const payload = enrichPreset(await readJsonBody(req));
        const ast = extractSemanticBriefing(payload);
        sendJson(res, 200, { ok: true, ast, brand_kits: Object.keys(BRAND_KITS) });
      } catch (err) {
        sendJson(res, 400, { ok: false, erro: err instanceof Error ? err.message : 'Falha na extração semântica.' });
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/api/website/build') {
      try {
        const payload = await readJsonBody(req);
        const safeSlug = String(payload.slug || 'connect-oficial').replace(/[^a-zA-Z0-9_-]/g, '') || 'connect-oficial';
        const outDir = `/home/ubuntu/workspaces/Projetos/site-${safeSlug}`;
        const pyCode = [
          'import json, sys',
          'sys.path.insert(0, "/home/ubuntu/workspaces/Projetos/Assessor-Studio")',
          'from site_builder.engine import SiteBriefing, build_site',
          'data = json.loads(sys.argv[1])',
          'res = build_site(SiteBriefing.from_dict(data), sys.argv[2])',
          'print(json.dumps(res, ensure_ascii=False))',
        ].join('; ');
        const { stdout } = await execFileAsync('python3', ['-c', pyCode, JSON.stringify(payload), outDir]);
        sendJson(res, 200, JSON.parse(stdout.trim()));
      } catch (err) {
        sendJson(res, 400, { ok: false, erro: err instanceof Error ? err.message : 'Falha ao gerar site.' });
      }
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/api/website/preview/')) {
      const rest = pathname.slice('/api/website/preview/'.length);
      const [rawSlug, ...parts] = rest.split('/');
      const safeSlug = (rawSlug || 'connect-oficial').replace(/[^a-zA-Z0-9_-]/g, '') || 'connect-oficial';
      const relFile = parts.join('/') || 'index.html';
      const baseDir = path.resolve(`/home/ubuntu/workspaces/Projetos/site-${safeSlug}`);
      const target = path.resolve(baseDir, relFile);
      if (!target.startsWith(baseDir) || !existsSync(target)) {
        res.writeHead(404);
        res.end('Não encontrado');
        return;
      }
      const ext = path.extname(target).toLowerCase();
      const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' }[ext] || 'application/octet-stream';
      const data = await readFile(target);
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      res.end(data);
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

    if (pathname === '/api/kits') {
      const page = Math.max(0, Number(urlObj.searchParams.get('page') || 0) || 0);
      const limit = 20;
      const rows = getStore().listKits(limit + 1, page * limit);
      const hasMore = rows.length > limit;
      const kits = rows.slice(0, limit).map((k) => ({
        ...k,
        downloadUrl: `/api/kits/${k.id}/zip`,
        liveAvailable: existsSync(path.join(publishDir, k.slug, 'index.html')),
      }));
      sendJson(res, 200, { kits, hasMore });
      return;
    }

    if (pathname.startsWith('/api/kits/')) {
      const rest = pathname.slice('/api/kits/'.length);
      const zipMatch = /^([^/]+)\/zip$/.exec(rest);
      if (zipMatch) {
        const id = zipMatch[1];
        const found = isKitId(id) ? getStore().getZip(id) : null;
        if (!found) {
          res.writeHead(404);
          res.end('Não encontrado');
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="kit-${found.slug}.zip"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(found.data);
        return;
      }
      const socialMatch = /^([^/]+)\/social\/([\w.-]+\.png)$/.exec(rest);
      if (socialMatch) {
        const [, id, file] = socialMatch;
        const buf = isKitId(id) ? getStore().getFile(id, file) : null;
        if (!buf) {
          res.writeHead(404);
          res.end('Não encontrado');
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(buf);
        return;
      }
      res.writeHead(404);
      res.end('Não encontrado');
      return;
    }

    if (pathname.startsWith('/published/')) {
      const file = publishedFile(pathname.slice('/published/'.length), { baseDir: publishDir });
      if (!file) {
        res.writeHead(404);
        res.end('Não encontrado');
        return;
      }
      res.writeHead(200, {
        'Content-Type': file.type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(file.data);
      return;
    }

    if (pathname === '/api/kit/catalog') {
      sendJson(res, 200, { categorias: CATEGORIES, pecas: KIT_PIECES, presets: PRESETS });
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
          "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; media-src 'self' https:; frame-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
      res.end(body);
    } catch {
      res.writeHead(500);
      res.end('Falha ao abrir arquivo');
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer().listen(port, bindHost, () =>
    console.log(
      `Studio Visual Pro • ativo em: http://${bindHost}:${port}\nPreview de campanha: http://${bindHost}:${port}/showcase\nCtrl+C encerra.`,
    ),
  );
}
