// Agente de Homologação Real E2E: simula um cliente no /kit (Playwright), gera o lote completo,
// audita o ZIP (PNG Retina, PDF, MP4 via ffprobe) e percorre os sites gerados testando scroll e animações.
// Saída: output/homologacao/RELATORIO_HOMOLOGACAO.md + screenshots. Só loopback; nenhum serviço pago.
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from '../server.mjs';
import { openStyleStore } from '../src/style-lab/store.mjs';
import { extractStyleFromImage } from '../src/style-lab/imageExtractor.mjs';
import { extractStyleFromVideo } from '../src/style-lab/videoExtractor.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'output', 'homologacao');
const SEM_VIDEO = process.argv.includes('--sem-video');
const resultados = [];
const check = (area, nome, ok, detalhe = '') => { resultados.push({ area, nome, ok: Boolean(ok), detalhe: String(detalhe) }); console.log(`${ok ? 'OK ' : 'FALHA'} [${area}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`); };

const listen = (server) => new Promise((r) => server.listen(0, '127.0.0.1', r));
async function walk(dir, base = dir) {
  const out = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const f = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...await walk(f, base)); else out.push(path.relative(base, f));
  }
  return out;
}
function staticServer(dir) {
  const mime = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
  return http.createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
      const file = path.resolve(dir, rel.endsWith('/') ? `${rel}index.html` : rel);
      if (!file.startsWith(dir + path.sep)) { res.writeHead(403).end(); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
}

async function extractZip(zipPath, destDir) {
  const buf = await readFile(zipPath);
  let off = 0;
  while (off + 30 <= buf.length && buf.readUInt32LE(off) === 0x04034b50) {
    const method = buf.readUInt16LE(off + 8);
    const compSize = buf.readUInt32LE(off + 18);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const name = buf.subarray(off + 30, off + 30 + nameLen).toString('utf8');
    const start = off + 30 + nameLen + extraLen;
    const raw = buf.subarray(start, start + compSize);
    off = start + compSize;
    if (name.endsWith('/')) continue;
    const target = path.resolve(destDir, name);
    if (!target.startsWith(destDir + path.sep)) throw new Error(`Zip Slip bloqueado: ${name}`);
    await mkdir(path.dirname(target), { recursive: true });
    const data = method === 8 ? inflateRawSync(raw) : raw;
    await writeFile(target, data);
  }
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'zip'), { recursive: true });
  await mkdir(path.join(OUT, 'screenshots'), { recursive: true });
  const shot = (page, nome, opts = {}) => page.screenshot({ path: path.join(OUT, 'screenshots', `${nome}.png`), ...opts });

  const styleStore = openStyleStore(':memory:');
  const app = createServer({
    styleStore,
    kitDeps: {
      allowPrivateUrls: true,
      extractStyleFromImage: (bytes, options) => extractStyleFromImage(bytes, { ...options, apiKey: '' }),
      extractStyleFromVideo: (bytes, options) => extractStyleFromVideo(bytes, { ...options, apiKey: '' }),
    },
  });
  await listen(app);
  const base = `http://127.0.0.1:${app.address().port}`;
  const browser = await chromium.launch({ timeout: 20000 });
  const files = {};
  try {
    // ---------- 1. Cliente no /kit ----------
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(`${base}/kit`);
    const modelos = await page.$$eval('#k-modelo option', (o) => o.map((x) => x.value));
    check('kit', '5 direções de arte no seletor', modelos.length === 5, modelos.join(', '));
    const fixture = http.createServer((req, res) => {
      if (req.url === '/ref.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' }).end(
          'body{background:#112233;color:white;font:18px Georgia} h1{font-size:54px} section{padding:92px;border-radius:14px;box-shadow:0 2px 8px black} button{background:#55ddff;transition:opacity 200ms cubic-bezier(0.2,0.8,0.4,1)}',
        );
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(
        '<title>Referência editorial</title><link rel="stylesheet" href="/ref.css"><section><h1>Exemplo</h1><button>Contato</button></section>',
      );
    });
    await listen(fixture);
    try {
      await page.goto(`${base}/estilo`);
      await page.fill('#sl-url', `http://127.0.0.1:${fixture.address().port}/`);
      const extract = async (type) => {
        const [response] = await Promise.all([
          page.waitForResponse((res) => res.url().endsWith(`/extract/${type}`) || res.url().includes(`/extract/${type}?`)),
          page.click(`#sl-btn-${type}`),
        ]);
        if (!response.ok()) {
          await page.waitForFunction((source) => !document.querySelector('#sl-btn-' + source).disabled, type);
          throw new Error(await page.locator(`#sl-status-${type}`).textContent());
        }
        await page.waitForFunction((source) => {
          const summary = document.querySelector('#sl-json').textContent;
          return summary && JSON.parse(summary).dna.source_type === source;
        }, type);
      };
      await extract('url');
      const extracted = async () => JSON.parse(await page.locator('#sl-json').textContent()).dna;
      const site = await extracted();
      check('estilo', 'Extrai CSS externo, escala, raio, sombra e curva completa',
        site.palette.bg === '#112233' && site.typography.scale.h1Px === 54 && site.spacing.cardRadius === '14px' &&
        site.shadows.length === 1 && site.motion.easing === 'cubic-bezier(0.2, 0.8, 0.4, 1)');

      const video = path.join(OUT, 'referencia.mp4');
      const frame = path.join(OUT, 'referencia.png');
      const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
      await run(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'color=red:s=160x90:d=2',
        '-f', 'lavfi', '-i', 'color=blue:s=160x90:d=2', '-filter_complex',
        '[0:v][1:v]concat=n=2:v=1:a=0', '-c:v', 'libx264', '-threads', '1', video], { timeout: 15000 });
      await run(ffmpeg, ['-v', 'error', '-i', video, '-frames:v', '1', '-threads', '1', frame], { timeout: 15000 });
      await page.click('[data-tab=image]');
      await page.setInputFiles('#sl-image', frame);
      await extract('image');
      check('estilo', 'Mede paleta da imagem em FFmpeg e exibe aviso do modo local',
        (await extracted()).source_type === 'image' && await page.locator('#sl-warnings').isVisible());
      await page.click('[data-tab=video]');
      await page.setInputFiles('#sl-video', video);
      await extract('video');
      const clip = await extracted();
      check('estilo', 'Detecta corte, mede ritmo e extrai quadros representativos',
        clip.teaser.cut_count === 1 && clip.teaser.avg_scene_seconds === 2 && clip.keyframes_extracted === 2);
      await page.fill('#sl-preset-name', 'Ritmo de Homologação');
      await page.click('#sl-save');
      await page.waitForSelector('#sl-go-kit:not([hidden])');
      await shot(page, '00-laboratorio-de-estilo', { fullPage: true });
      await page.click('#sl-go-kit');
      await page.waitForFunction(() => document.querySelector('#k-modelo')?.value === 'custom-ritmo-de-homologacao');
      check('estilo', 'Preset SQLite selecionado automaticamente no Kit', true);
      const saved = styleStore.getPreset('custom-ritmo-de-homologacao');
      check('estilo', 'Ritmo armazenado no preset', saved?.brand_kit.teaser.avg_scene_seconds === 2);
    } finally {
      await new Promise((resolve) => fixture.close(resolve));
    }
    await page.fill('#k-marca', 'Igreja Vida Nova');
    await page.fill('#k-nicho', 'igreja');
    await page.fill('#k-slogan', 'Série Raízes: firmados na esperança');
    await page.fill('#k-sub', 'Quatro domingos para crescer em fé, comunidade e propósito.');
    await page.fill('#k-data', '14/12 às 19h');
    await page.fill('#k-local', 'Av. Paulista, 1000 - São Paulo');
    if (await page.locator('#k-whats').count()) await page.fill('#k-whats', '5511999999999');
    if (await page.locator('#k-prog').count()) await page.fill('#k-prog', '19:00 | Abertura e louvor | Recepção e momento de adoração\n19:40 | Mensagem | Série Raízes, parte 1\n20:30 | Comunhão | Café e acolhimento');
    await page.selectOption('#k-modelo', 'custom-ritmo-de-homologacao');
    await page.click('#k-validar');
    await page.waitForSelector('#etapa2:not([hidden])');
    await shot(page, '01-kit-etapa1');
    const todas = await page.$$eval('#k-pecas input[type=checkbox]', (c) => c.map((x) => x.value));
    for (const id of ['landing', 'bio', 'hotsite', 'email', 'lower-third', 'welcome']) check('kit', `peça ${id} no catálogo da tela`, todas.includes(id));
    await page.evaluate(() => document.querySelectorAll('#k-pecas input[type=checkbox]').forEach((c) => { c.checked = true; }));
    if (!SEM_VIDEO) await page.check('#k-zip-teaser');
    await shot(page, '02-kit-etapa2', { fullPage: true });
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), page.click('#k-gerar')]);
    const zipPath = path.join(OUT, 'kit.zip');
    await download.saveAs(zipPath);
    await page.waitForFunction(() => /Pronto/.test(document.getElementById('k-status').textContent));
    check('kit', 'lote completo gerado e baixado', true, (await page.textContent('#k-status')).trim());
    await ctx.close();

    // ---------- 2. Auditoria do ZIP ----------
    const dir = path.join(OUT, 'zip');
    await extractZip(zipPath, dir);
    const lista = await walk(dir);
    const manifesto = JSON.parse(await readFile(path.join(dir, 'manifesto.json'), 'utf8'));
    check('zip', 'manifesto com peças', manifesto.pecas.length >= 19, `${manifesto.pecas.length} itens, ${lista.length} arquivos`);
    for (const p of manifesto.pecas.filter((x) => x.png_px && x.retina)) {
      const b = await readFile(path.join(dir, p.arquivo));
      const [w, h] = [b.readUInt32BE(16), b.readUInt32BE(20)];
      check('zip', `PNG Retina ${p.id}`, w === p.png_px.largura && h === p.png_px.altura && w === p.largura * 2, `${w}x${h}`);
    }
    const lt = await readFile(path.join(dir, 'projecao/lower-third-1920x1080.png'));
    check('zip', 'Lower Third 1920x1080 @2x com canal alfa', lt.readUInt32BE(16) === 3840 && (lt[25] === 6 || lt[25] === 4), `color type ${lt[25]}`);
    for (const f of lista.filter((x) => x.endsWith('.pdf'))) {
      const b = await readFile(path.join(dir, f));
      check('zip', `PDF válido ${f}`, b.subarray(0, 5).toString() === '%PDF-' && b.includes('%%EOF'), `${b.length} bytes`);
    }
    for (const f of lista.filter((x) => /^impressos\/.*\.png$/.test(x))) {
      const b = await readFile(path.join(dir, f));
      check('zip', `PNG de impresso ${f}`, b.readUInt32BE(16) > 500, `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`);
    }
    const mp4 = lista.find((x) => x.endsWith('.mp4'));
    if (SEM_VIDEO) check('zip', 'MP4 (ignorado por --sem-video)', true, 'não auditado');
    else if (!mp4) check('zip', 'MP4 presente', false, 'ausente do ZIP');
    else {
      const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height:format=duration', '-of', 'json', path.join(dir, mp4)]);
      const j = JSON.parse(stdout), v = j.streams.find((s) => s.codec_name);
      const dur = Number(j.format.duration);
      check('zip', 'MP4 codec H.264', v?.codec_name === 'h264', `${v?.codec_name} ${v?.width}x${v?.height}`);
      check('zip', 'MP4 duração ≈ 60 s', Math.abs(dur - 60) < 3, `${dur.toFixed(1)} s`);
    }
    for (const f of ['site/landing/index.html', 'site/bio/index.html', 'site/hotsite/index.html', 'site/email/assinatura.html', 'site/email/cabecalho-newsletter.html']) check('zip', `arquivo ${f}`, lista.includes(f));
    check('zip', 'fontes locais no pacote do site', lista.some((x) => x.startsWith('site/landing/fonts/') && x.endsWith('.woff2')));
    const email = await readFile(path.join(dir, 'site/email/assinatura.html'), 'utf8');
    check('zip', 'e-mail sem <script> e com estilos inline', !/<script/i.test(email) && /style="/.test(email));
    Object.assign(files, { dir });

    // ---------- 3. Sites ao vivo: scroll e animações ----------
    const sites = staticServer(path.join(dir, 'site'));
    await listen(sites);
    const sbase = `http://127.0.0.1:${sites.address().port}`;
    for (const [nome, vp] of [['landing', { width: 1440, height: 900 }], ['hotsite', { width: 1440, height: 900 }], ['bio', { width: 390, height: 844 }]]) {
      const c = await browser.newContext({ viewport: vp });
      const p = await c.newPage();
      const erros = [];
      p.on('pageerror', (er) => erros.push(er.message));
      await p.goto(`${sbase}/${nome}/`, { waitUntil: 'load' });
      await p.waitForTimeout(1600);
      await shot(p, `${nome}-01-hero`);
      const h1 = await p.$eval('h1', (el) => ({ op: Number(getComputedStyle(el).opacity), blur: getComputedStyle(el).filter }));
      check(nome, 'hero entra em cascata (h1 visível após stagger, sem blur)', h1.op === 1 && (h1.blur === 'none' || /blur\(0/.test(h1.blur)), JSON.stringify(h1));
      const glass = await p.$eval('.gl-head', (el) => getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter);
      check(nome, 'header glassmorphism blur(16px)', /blur\(16px\)/.test(glass), glass);
      const antes = await p.$$eval('.rv.in', (n) => n.length);
      const total = await p.$$eval('.rv', (n) => n.length);
      const bgAntes = await p.$eval('[data-parallax]', (el) => el.style.transform || getComputedStyle(el).transform).catch(() => '');
      const alt = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (let y = 0; y <= alt; y += 350) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(140); if (y === 700) await shot(p, `${nome}-02-scroll`); }
      await p.waitForTimeout(1200);
      const depois = await p.$$eval('.rv.in', (n) => n.length);
      check(nome, 'coreografia de scroll revela blocos', total > 3 && depois > antes && depois === total, `${antes} → ${depois}/${total}`);
      const prog = await p.$eval('.gl-prog', (el) => getComputedStyle(el).transform);
      check(nome, 'barra de progresso acompanha o scroll', /matrix\(0?\.?9|matrix\(1,/.test(prog) || prog.startsWith('matrix(1'), prog);
      const solid = await p.$eval('.gl-head', (el) => el.classList.contains('solid'));
      check(nome, 'header ganha estado "solid" ao rolar', solid);
      if (nome !== 'bio') {
        await p.evaluate(() => scrollTo(0, 400)); await p.waitForTimeout(250);
        const bgDepois = await p.$eval('[data-parallax]', (el) => el.style.transform);
        check(nome, 'parallax do hero move com o scroll', bgDepois && bgDepois !== bgAntes, bgDepois);
      }
      await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(500);
      await shot(p, `${nome}-03-fim`);
      await p.evaluate(() => scrollTo(0, 0));
      // micro-interações
      const btn = p.locator('.btn.shine').first();
      const y0 = (await btn.boundingBox()).y; await btn.hover(); await p.waitForTimeout(600);
      const y1 = (await btn.boundingBox()).y;
      check(nome, 'botão sobe no hover (elevação física)', y1 < y0, `${y0.toFixed(1)} → ${y1.toFixed(1)}`);
      await p.evaluate(() => document.querySelector('[data-open-drawer]').click()); await p.waitForTimeout(700);
      check(nome, 'drawer de inscrição abre', await p.evaluate(() => document.body.classList.contains('dr-open')));
      await shot(p, `${nome}-04-drawer`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      if (nome === 'hotsite') {
        await p.evaluate(() => document.getElementById('programacao').scrollIntoView()); await p.waitForTimeout(900);
        await p.click('#ah1'); await p.waitForTimeout(700);
        check(nome, 'acordeão da programação abre', await p.$eval('#ah1', (b) => b.getAttribute('aria-expanded') === 'true' && b.parentElement.classList.contains('open')));
        await p.click('#t2'); await p.waitForTimeout(400);
        check(nome, 'abas alternam painel', await p.$eval('#p2', (el) => !el.hidden) && await p.$eval('#p1', (el) => el.hidden));
        await shot(p, `${nome}-05-abas`);
        const cd = await p.$eval('[data-countdown] b', (b) => b.textContent);
        check(nome, 'contagem regressiva renderiza', /^\d\d$/.test(cd), cd);
      }
      check(nome, 'sem erros de JavaScript', erros.length === 0, erros.join(' | '));
      await c.close();
      // fallback estático
      const c2 = await browser.newContext({ viewport: vp });
      const p2 = await c2.newPage();
      await p2.goto(`${sbase}/${nome}/?static=true`, { waitUntil: 'load' });
      const invis = await p2.$$eval('.rv,.st', (n) => n.filter((el) => Number(getComputedStyle(el).opacity) < 1).length);
      check(nome, '?static=true deixa 100% visível (Auditor)', invis === 0, `${invis} elementos invisíveis`);
      await shot(p2, `${nome}-06-static`, { fullPage: true });
      await c2.close();
    }
    await new Promise((r) => sites.close(r));
  } finally {
    await browser.close();
    await new Promise((r) => app.close(r));
    styleStore.close();
  }

  const falhas = resultados.filter((r) => !r.ok);
  const shots = (await readdir(path.join(OUT, 'screenshots'))).sort();
  const md = `# Relatório de Homologação E2E — Studio Visual Pro

Gerado em ${new Date().toISOString()} por \`npm run homologar\`${SEM_VIDEO ? ' (modo --sem-video)' : ''}.

**Resultado: ${falhas.length === 0 ? 'APROVADO' : `REPROVADO (${falhas.length} falha(s))`}** — ${resultados.length - falhas.length}/${resultados.length} verificações automáticas.

> Isto é teste automatizado em Chromium (loopback). **Não substitui** a homologação visual humana no iPhone/Dell.

| Área | Verificação | Resultado | Detalhe |
|---|---|---|---|
${resultados.map((r) => `| ${r.area} | ${r.nome} | ${r.ok ? '✅' : '❌'} | ${r.detalhe.replace(/\|/g, '\\|')} |`).join('\n')}

## Screenshots (output/homologacao/screenshots/)
${shots.map((s) => `- ${s}`).join('\n')}
`;
  await writeFile(path.join(OUT, 'RELATORIO_HOMOLOGACAO.md'), md);
  console.log(`\nRelatório: ${path.relative(ROOT, path.join(OUT, 'RELATORIO_HOMOLOGACAO.md'))} — ${falhas.length ? 'REPROVADO' : 'APROVADO'}`);
  process.exitCode = falhas.length ? 1 : 0;
}

main().catch(async (err) => {
  console.error('Homologação abortada:', err);
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'RELATORIO_HOMOLOGACAO.md'), `# Relatório de Homologação E2E\n\n**ABORTADA:** ${String(err?.stack || err).slice(0, 1500)}\n\nParciais:\n${resultados.map((r) => `- ${r.ok ? 'OK' : 'FALHA'} [${r.area}] ${r.nome} ${r.detalhe}`).join('\n')}\n`);
  process.exitCode = 1;
});
