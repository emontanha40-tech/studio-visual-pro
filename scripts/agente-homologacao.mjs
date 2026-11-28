// Agente de Homologação Real E2E: simula um cliente em 1440px (Desktop) e 390px (iPhone),
// percorrendo /estilo -> salvar preset -> /kit -> gerar ZIP -> Campanhas Recentes (Duplicar Briefing & Site ao Vivo),
// audita o ZIP (PNG Retina, PDF, MP4 via ffprobe) e percorre os sites gerados testando scroll e animações.
// Saída: output/homologacao-*/RELATORIO_HOMOLOGACAO.md + screenshots. Só loopback; nenhum serviço pago.
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from '../server.mjs';
import { openStyleStore } from '../src/style-lab/store.mjs';
import { openKitHistoryStore } from '../src/kit/historyStore.mjs';
import { extractStyleFromImage } from '../src/style-lab/imageExtractor.mjs';
import { extractStyleFromVideo } from '../src/style-lab/videoExtractor.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_ROOT = path.join(ROOT, 'output');
await mkdir(OUTPUT_ROOT, { recursive: true });
const OUT = await mkdtemp(path.join(OUTPUT_ROOT, 'homologacao-'));
const SEM_VIDEO = process.argv.includes('--sem-video');
const resultados = [];
const check = (area, nome, ok, detalhe = '') => {
  resultados.push({ area, nome, ok: Boolean(ok), detalhe: String(detalhe) });
  console.log(`${ok ? 'OK ' : 'FALHA'} [${area}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
};

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

async function hasNoOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

async function main() {
  await mkdir(path.join(OUT, 'zip'), { recursive: true });
  await mkdir(path.join(OUT, 'published'), { recursive: true });
  await mkdir(path.join(OUT, 'screenshots'), { recursive: true });
  const shot = (page, nome, opts = {}) => page.screenshot({ path: path.join(OUT, 'screenshots', `${nome}.png`), ...opts });

  const styleStore = openStyleStore(':memory:');
  const kitHistoryStore = openKitHistoryStore(':memory:');
  const app = createServer({
    styleStore,
    kitHistoryStore,
    kitDeps: {
      allowPrivateUrls: true,
      publishDir: path.join(OUT, 'published'),
      extractStyleFromImage: (bytes, options) => extractStyleFromImage(bytes, { ...options, apiKey: '' }),
      extractStyleFromVideo: (bytes, options) => extractStyleFromVideo(bytes, { ...options, apiKey: '' }),
    },
  });
  await listen(app);
  const base = `http://127.0.0.1:${app.address().port}`;
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
  const fixtureUrl = `http://127.0.0.1:${fixture.address().port}/`;

  const browser = await chromium.launch({ timeout: 20000 });
  const zipPath = path.join(OUT, 'kit.zip');

  const extractOnEstilo = async (page, type) => {
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

  try {
    // ---------- 1. Fluxo Desktop 1440px: /estilo -> salvar preset -> /kit -> gerar ZIP -> Campanhas Recentes ----------
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(`${base}/kit`);
    const modelos = await page.$$eval('#k-modelo option', (o) => o.map((x) => x.value));
    check('desktop-1440', '5 direções de arte nativas no seletor', modelos.length === 5, modelos.join(', '));
    check('desktop-1440', '/kit sem overflow horizontal em 1440px', await hasNoOverflow(page));

    await page.goto(`${base}/estilo`);
    check('desktop-1440', '/estilo sem overflow horizontal em 1440px', await hasNoOverflow(page));
    await page.fill('#sl-url', fixtureUrl);
    await extractOnEstilo(page, 'url');
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
    await extractOnEstilo(page, 'image');
    check('estilo', 'Mede paleta da imagem em FFmpeg e exibe aviso do modo local',
      (await extracted()).source_type === 'image' && await page.locator('#sl-warnings').isVisible());
    await page.click('[data-tab=video]');
    await page.setInputFiles('#sl-video', video);
    await extractOnEstilo(page, 'video');
    const clip = await extracted();
    check('estilo', 'Detecta corte, mede ritmo e extrai quadros representativos',
      clip.teaser.cut_count === 1 && clip.teaser.avg_scene_seconds === 2 && clip.keyframes_extracted === 2);
    await page.fill('#sl-preset-name', 'Ritmo de Homologação');
    await page.click('#sl-save');
    await page.waitForSelector('#sl-go-kit:not([hidden])');
    await shot(page, '00-laboratorio-de-estilo-1440', { fullPage: true });
    await page.click('#sl-go-kit');
    await page.waitForFunction(() => document.querySelector('#k-modelo')?.value === 'custom-ritmo-de-homologacao');
    check('desktop-1440', 'Preset SQLite selecionado automaticamente no /kit', true);
    const saved = styleStore.getPreset('custom-ritmo-de-homologacao');
    check('estilo', 'Ritmo armazenado no preset', saved?.brand_kit.teaser.avg_scene_seconds === 2);

    await page.fill('#k-marca', 'Igreja Vida Nova');
    await page.fill('#k-nicho', 'igreja');
    await page.fill('#k-slogan', 'Série Raízes: firmados na esperança');
    await page.fill('#k-sub', 'Quatro domingos para crescer em fé, comunidade e propósito.');
    await page.fill('#k-data', '14/12 às 19h');
    await page.fill('#k-local', 'Av. Paulista, 1000 - São Paulo');
    await page.selectOption('#k-modelo', 'custom-ritmo-de-homologacao');
    await page.click('#k-validar');
    await page.waitForSelector('#etapa2:not([hidden])');
    await shot(page, '01-kit-etapa1-1440');
    const todas = await page.$$eval('#k-pecas input[type=checkbox]', (c) => c.map((x) => x.value));
    for (const id of ['landing', 'linktree', 'hotsite', 'email-kit', 'lower-third', 'welcome-countdown']) {
      check('kit', `peça ${id} no catálogo da tela`, todas.includes(id));
    }
    await page.evaluate(() => document.querySelectorAll('#k-pecas input[type=checkbox]').forEach((c) => { c.checked = true; }));
    if (!SEM_VIDEO) await page.check('#k-zip-teaser');
    await shot(page, '02-kit-etapa2-1440', { fullPage: true });
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), page.click('#k-gerar')]);
    await download.saveAs(zipPath);
    await page.waitForFunction(() => /Pronto/.test(document.getElementById('k-status').textContent));
    check('desktop-1440', 'Lote completo gerado e baixado em 1440px', true, (await page.textContent('#k-status')).trim());

    // Campanhas Recentes + Site ao Vivo + Duplicar Briefing
    await page.waitForSelector('#k-historico .kit-history-card');
    const cardText = await page.locator('#k-historico .kit-history-card').first().textContent();
    check('historico', 'Campanha recente listada no /kit com marca e título', cardText.includes('Igreja Vida Nova') && cardText.includes('Série Raízes'));
    const liveHref = await page.locator('#k-historico .kit-history-card a[href^="/published/"]').first().getAttribute('href');
    const liveRes = liveHref ? await page.request.get(`${base}${liveHref}`) : null;
    check('historico', 'Link direto do Site ao Vivo publicado responde HTTP 200', Boolean(liveRes && liveRes.status() === 200), liveHref || 'ausente');
    await page.fill('#k-marca', 'Marca Alterada Temporariamente');
    await page.click('#k-historico .kit-history-card [data-duplicar]');
    await page.waitForFunction(() => document.getElementById('k-marca').value !== 'Marca Alterada Temporariamente', null, { timeout: 5000 }).catch(() => {});
    const restoredMarca = await page.inputValue('#k-marca');
    const restoredModelo = await page.inputValue('#k-modelo');
    check('historico', 'Botão Duplicar Briefing restaura marca e preset visual', restoredMarca === 'Igreja Vida Nova' && restoredModelo === 'custom-ritmo-de-homologacao', `${restoredMarca} / ${restoredModelo}`);
    await shot(page, '03-campanhas-recentes-1440', { fullPage: true });
    await ctx.close();

    // ---------- 2. Fluxo Mobile iPhone 390px: /estilo -> salvar preset -> /kit -> gerar ZIP ----------
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const mpage = await mctx.newPage();
    mpage.setDefaultTimeout(60000);
    await mpage.goto(`${base}/estilo`);
    check('mobile-390', '/estilo sem overflow horizontal em 390px (iPhone)', await hasNoOverflow(mpage));
    await mpage.fill('#sl-url', fixtureUrl);
    await extractOnEstilo(mpage, 'url');
    await mpage.fill('#sl-preset-name', 'Estilo iPhone 390');
    await mpage.click('#sl-save');
    await mpage.waitForSelector('#sl-go-kit:not([hidden])');
    await shot(mpage, '04-estilo-mobile-390', { fullPage: true });
    await mpage.click('#sl-go-kit');
    await mpage.waitForFunction(() => document.querySelector('#k-modelo')?.value === 'custom-estilo-iphone-390');
    check('mobile-390', 'Fluxo /estilo -> salvar preset -> /kit funciona em 390px', true);
    check('mobile-390', '/kit sem overflow horizontal em 390px (iPhone)', await hasNoOverflow(mpage));
    await mpage.fill('#k-marca', 'Café Aurora Mobile');
    await mpage.fill('#k-nicho', 'cafeteria');
    await mpage.fill('#k-slogan', 'Torra fresca toda manhã');
    await mpage.fill('#k-sub', 'Grãos selecionados e ambiente acolhedor.');
    await mpage.click('#k-validar');
    await mpage.waitForSelector('#etapa2:not([hidden])');
    await mpage.evaluate(() => {
      document.querySelectorAll('#k-pecas input[type=checkbox]').forEach((c) => {
        c.checked = c.value === 'landing' || c.value === 'feed';
      });
    });
    const [mDownload] = await Promise.all([mpage.waitForEvent('download', { timeout: 120000 }), mpage.click('#k-gerar')]);
    const mobileZipPath = path.join(OUT, 'kit-mobile-390.zip');
    await mDownload.saveAs(mobileZipPath);
    const mobileBuf = await readFile(mobileZipPath);
    await mpage.waitForFunction(() => /Pronto/.test(document.getElementById('k-status').textContent));
    check('mobile-390', 'ZIP gerado e baixado em 390px (assinatura PK válida)', mobileBuf.readUInt32LE(0) === 0x04034b50, `${mobileBuf.length} bytes`);
    await mpage.waitForFunction(() => document.getElementById('k-historico').textContent.includes('Café Aurora Mobile'));
    check('mobile-390', 'Campanhas Recentes atualiza sem overflow em 390px', await hasNoOverflow(mpage));
    await shot(mpage, '05-kit-mobile-390', { fullPage: true });
    await mctx.close();

    // ---------- 3. Auditoria do ZIP (Desktop completo) ----------
    const dir = path.join(OUT, 'zip');
    await extractZip(zipPath, dir);
    const lista = await walk(dir);
    const manifesto = JSON.parse(await readFile(path.join(dir, 'manifesto.json'), 'utf8'));
    check('zip', 'manifesto com 19 peças', manifesto.pecas.length >= 19, `${manifesto.pecas.length} itens, ${lista.length} arquivos`);
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
      check('zip', `PNG de impresso ${f}`, Math.max(b.readUInt32BE(16), b.readUInt32BE(20)) > 1000 && Math.min(b.readUInt32BE(16), b.readUInt32BE(20)) >= 400, `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`);
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
    for (const f of ['site/landing/index.html', 'site/linktree/index.html', 'site/hotsite/index.html', 'site/email-kit/assinatura-email.html', 'site/email-kit/cabecalho-newsletter.html']) {
      check('zip', `arquivo ${f}`, lista.includes(f));
    }
    const email = await readFile(path.join(dir, 'site/email-kit/assinatura-email.html'), 'utf8');
    check('zip', 'e-mail sem <script> e com estilos inline', !/<script/i.test(email) && /style="/.test(email));

    // ---------- 4. Sites ao vivo: scroll, animações, Constituição & mobile ----------
    const sites = staticServer(path.join(dir, 'site'));
    await listen(sites);
    const sbase = `http://127.0.0.1:${sites.address().port}`;
    for (const [nome, vp] of [['landing', { width: 1440, height: 900 }], ['hotsite', { width: 1440, height: 900 }], ['hotsite', { width: 390, height: 844 }], ['linktree', { width: 390, height: 844 }]]) {
      const tag = `${nome}-${vp.width}`;
      const c = await browser.newContext({ viewport: vp });
      const p = await c.newPage();
      const erros = [];
      p.on('pageerror', (er) => erros.push(er.message));
      await p.goto(`${sbase}/${nome}/`, { waitUntil: 'load' });
      await p.waitForTimeout(1400);
      await shot(p, `${tag}-01-hero`);
      const h1 = await p.$eval('h1', (el) => ({ op: Number(getComputedStyle(el).opacity), blur: getComputedStyle(el).filter }));
      check(tag, 'hero visível após entrada (sem blur)', h1.op === 1 && (h1.blur === 'none' || /blur\(0/.test(h1.blur)), JSON.stringify(h1));
      check(tag, 'sem overflow horizontal', await hasNoOverflow(p));

      const alt = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (let y = 0; y < alt; y += 350) {
        await p.evaluate((top) => scrollTo({ top, behavior: 'instant' }), y);
        await p.waitForTimeout(100);
      }
      await p.evaluate((top) => scrollTo({ top, behavior: 'instant' }), alt);
      await p.waitForTimeout(900);

      const revealSel = nome === 'landing' ? '.rv' : '[data-reveal]';
      const revealedSel = nome === 'landing' ? '.rv.in' : '[data-reveal].is-in';
      const { total, revealed, falta } = await p.evaluate(([sel, revSel]) => {
        const els = [...document.querySelectorAll(sel)].filter((el) => !el.closest('[hidden]'));
        return { total: els.length, revealed: els.filter((el) => el.matches(revSel)).length, falta: els.filter((el) => !el.matches(revSel)).map((el) => `${el.textContent.trim().slice(0, 30)}@${Math.round(el.getBoundingClientRect().top + scrollY)}/${document.documentElement.scrollHeight}`) };
      }, [revealSel, revealedSel]);
      check(tag, 'coreografia de scroll revela blocos', total > 0 && revealed === total, `${revealed}/${total}${falta.length ? ' faltam: ' + falta.join('; ') : ''}`);

      if (nome === 'hotsite') {
        const glass = await p.$eval('.lp-header', (el) => getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter);
        check(tag, 'header glassmorphism blur(16px)', /blur\(16px\)/.test(glass), glass);
        const tabCount = await p.$$eval('.hs-tab', (n) => n.length);
        if (tabCount > 1) {
          await p.locator('.hs-tab').nth(1).click();
          await p.waitForTimeout(250);
          check(tag, 'abas de programação alternam painel', await p.locator('.hs-tab').nth(1).getAttribute('aria-selected') === 'true');
        }
        const firstDetails = p.locator('.hs-panel:not([hidden]) details').first();
        if (await firstDetails.count()) {
          await firstDetails.locator('summary').click();
          await p.waitForTimeout(250);
          check(tag, 'acordeão da programação abre', await firstDetails.evaluate((el) => el.open));
        }
      }
      check(tag, 'sem erros de JavaScript', erros.length === 0, erros.join(' | '));
      await c.close();

      // fallback estático ?static=true
      const c2 = await browser.newContext({ viewport: vp });
      const p2 = await c2.newPage();
      await p2.goto(`${sbase}/${nome}/?static=true`, { waitUntil: 'load' });
      const invis = await p2.$$eval(`${revealSel}, h1`, (n) => n.filter((el) => Number(getComputedStyle(el).opacity) < 1).length);
      check(tag, '?static=true deixa 100% visível', invis === 0, `${invis} invisíveis`);
      await c2.close();
    }
    await new Promise((r) => sites.close(r));
  } finally {
    await browser.close();
    await new Promise((r) => fixture.close(r));
    await new Promise((r) => app.close(r));
    styleStore.close();
    kitHistoryStore.close();
  }

  const falhas = resultados.filter((r) => !r.ok);
  const shots = (await readdir(path.join(OUT, 'screenshots'))).sort();
  const md = `# Relatório de Homologação E2E — Studio Visual Pro

Gerado em ${new Date().toISOString()} por \`npm run homologar\`${SEM_VIDEO ? ' (modo --sem-video)' : ''}.

**Resultado: ${falhas.length === 0 ? 'APROVADO' : `REPROVADO (${falhas.length} falha(s))`}** — ${resultados.length - falhas.length}/${resultados.length} verificações automáticas.

> Isto é teste automatizado em Chromium (loopback, 1440px + 390px). **Não substitui** a homologação visual humana no iPhone/Dell.

| Área | Verificação | Resultado | Detalhe |
|---|---|---|---|
${resultados.map((r) => `| ${r.area} | ${r.nome} | ${r.ok ? '✅' : '❌'} | ${r.detalhe.replace(/\|/g, '\\|')} |`).join('\n')}

## Screenshots (screenshots/)
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
