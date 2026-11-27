import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { FONT_CATALOG } from '../brand/fontCatalog.mjs';
import { buildIdentity } from './identity.mjs';
import { resolvePhoto } from './photos.mjs';

export const TEASER_FORMATS = {
  '9:16': { width: 720, height: 1280 },
  '16:9': { width: 1280, height: 720 },
};
const SCENE_SECONDS = 10;
const TARGET_TOTAL_SECONDS = 60;
const FPS = 24;
const TRANSITION_FRAMES = 12;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/**
 * Resolve ritmo do teaser (duração por cena e frames de transição) usando DNA de vídeo se presente.
 */
export function resolveTeaserTiming(identity, baseScenes) {
  const teaserDna = identity?.kit?.teaser;
  if (!teaserDna || !Number.isFinite(Number(teaserDna.avg_scene_seconds))) {
    return {
      scenes: baseScenes,
      sceneSeconds: SCENE_SECONDS,
      transitionFrames: TRANSITION_FRAMES,
      totalSeconds: baseScenes.length * SCENE_SECONDS,
    };
  }
  const avgSec = Math.max(1.5, Math.min(12, Number(teaserDna.avg_scene_seconds)));
  const transitionFrames = Math.max(4, Math.min(20, Number(teaserDna.transition_frames) || TRANSITION_FRAMES));
  const targetCount = Math.max(baseScenes.length, Math.min(24, Math.round(TARGET_TOTAL_SECONDS / avgSec)));
  const scenes = Array.from({ length: targetCount }, (_, i) => baseScenes[i % baseScenes.length]);
  const sceneSeconds = Number((TARGET_TOTAL_SECONDS / scenes.length).toFixed(3));
  return {
    scenes,
    sceneSeconds,
    transitionFrames,
    totalSeconds: TARGET_TOTAL_SECONDS,
  };
}
const run = promisify(execFile);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const dataUrl = (mime, bytes) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
const limited = (s, max) => typeof s === 'string' ? s.trim().slice(0, max) : '';

class TeaserError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function teaserScenes(input, identity) {
  const benefits = Array.isArray(input.beneficios) ? input.beneficios.map((s) => limited(s, 80)).filter(Boolean) : [];
  const details = [identity.evento.data, identity.evento.local].filter(Boolean).join(' · ');
  return [
    [identity.marca, limited(identity.headlines.hero, 140), ''],
    [identity.nicho, limited(identity.headlines.subtitulo, 200), ''],
    [identity.marca, limited(input.diferencial, 140) || benefits[0] || identity.nicho || identity.marca, ''],
    [identity.marca, benefits[1] || (details ? 'Quando e onde' : limited(identity.headlines.hero, 140)), details],
    [identity.nicho, benefits[2] || limited(identity.headlines.subtitulo, 200), ''],
    [identity.marca, limited(input.cta, 100) || identity.headlines.cta_principal, details],
  ];
}

async function makeHtml(identity, scenes, photo, format) {
  const heading = identity.fonte === 'serif' ? 'Lora' : 'Inter';
  const fonts = await Promise.all([...new Set([heading, 'Inter'])].map(async (name) => {
    const meta = FONT_CATALOG[name];
    const bytes = await readFile(new URL(`../../assets/fonts/${meta.file}`, import.meta.url));
    return `@font-face{font-family:'${name}';src:url(${dataUrl('font/woff2', bytes)}) format('woff2');font-weight:${meta.weights}}`;
  }));
  const { bg, text, muted, primary, accent } = identity.kit.colors;
  const { x, y } = identity.focal.hero;
  const image = photo?.bytes.length <= MAX_PHOTO_BYTES && ['image/jpeg', 'image/png'].includes(photo.mime)
    ? `url(${dataUrl(photo.mime, photo.bytes)})` : 'none';
  const logo = dataUrl('image/svg+xml', identity.logo_svg);
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>
    ${fonts.join('\n')}
    *{box-sizing:border-box}
    body{margin:0;background:${bg};color:${text};font:500 29px Inter;overflow:hidden}
    .art{position:absolute;inset:${format === '9:16' ? '0 0 52%' : '0 0 0 47%'};
      background:${image} ${x * 100}% ${y * 100}%/cover no-repeat,radial-gradient(ellipse at 75% 20%,${primary},transparent 70%),linear-gradient(145deg,${bg},${accent})}
    .art:after{content:'';position:absolute;inset:0;background:linear-gradient(${format === '9:16' ? '0deg' : '90deg'},${bg},transparent 68%)}
    section{position:absolute;inset:0;overflow:hidden;background:${bg};display:grid;align-content:center;
      padding:${format === '9:16' ? '450px 64px 124px' : '72px 48% 72px 84px'}}
    section[hidden]{display:none}
    .content{position:relative;min-width:0;overflow-wrap:anywhere}
    .logo{width:240px;height:auto;margin-bottom:25px}
    h1{font:750 ${format === '9:16' ? 55 : 49}px/1.08 '${heading}';margin:12px 0}
    p{margin:0;color:${muted};line-height:1.32}
    .rule{width:74px;height:5px;background:${primary};margin:25px 0}
    .incoming{animation:reveal 1s linear both paused}
    @keyframes reveal{from{opacity:0}to{opacity:1}}
    .incoming .content{animation:rise 1s ease-out both paused}
    @keyframes rise{from{transform:translateY(32px)}to{transform:translateY(0)}}
    </style><body>
    ${scenes.map(([label, headingText, details]) => `<section hidden><div class="art"></div><div class="content">
      <img class="logo" src="${logo}" alt=""><p>${escapeHtml(label)}</p><h1>${escapeHtml(headingText)}</h1>
      <div class="rule"></div><p>${escapeHtml(details)}</p></div></section>`).join('')}
    </body></html>`;
}

export async function renderTeaser(input, format) {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  try {
    const { stdout } = await run(ffmpeg, ['-hide_banner', '-encoders'], { timeout: 5000 });
    if (!/\blibx264\b/.test(stdout)) throw new Error('libx264');
  } catch {
    throw new TeaserError('ffmpeg_unavailable', 'O host precisa de FFmpeg com libx264 para gerar MP4.');
  }

  const { width, height } = TEASER_FORMATS[format];
  const identity = buildIdentity(input);
  const timing = resolveTeaserTiming(identity, teaserScenes(input, identity));
  const scenes = timing.scenes;
  const photo = await resolvePhoto({ nicho: identity.nicho });
  const html = await makeHtml(identity, scenes, photo, format);
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-teaser-'));
  try {
    let browser;
    try {
      const { chromium } = await import('playwright-core');
      browser = await chromium.launch({ timeout: 15000 });
    } catch {
      throw new TeaserError('chromium_unavailable', 'O host precisa do Chromium do Playwright para renderizar o teaser.');
    }

    const frames = [];
    try {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.route('**/*', (route) => route.abort());
      await page.setContent(html, { timeout: 10000 });
      await page.evaluate(async () => {
        await Promise.all([...document.fonts].map((font) => font.load()));
      });
      async function capture(scene, progress, duration) {
        const file = `frame-${frames.length}.jpg`;
        await page.evaluate(({ scene, progress }) => {
          document.querySelectorAll('section').forEach((el, i) => {
            el.hidden = i !== scene && !(progress < 1 && i === scene - 1);
            el.classList.toggle('incoming', progress < 1 && i === scene);
            for (const animation of el.getAnimations({ subtree: true })) animation.currentTime = progress * 1000;
          });
        }, { scene, progress });
        await page.screenshot({ type: 'jpeg', quality: 89, path: path.join(dir, file), timeout: 10000 });
        frames.push({ file, duration });
      }

      for (let i = 0; i < scenes.length; i++) {
        if (i) {
          for (let frame = 0; frame < timing.transitionFrames; frame++) {
            await capture(i, frame / timing.transitionFrames, 2 / FPS);
          }
        }
        const holdDuration = Math.max(0.25, timing.sceneSeconds - (i ? timing.transitionFrames * 2 / FPS : 0));
        await capture(i, 1, holdDuration);
      }
    } finally {
      await browser.close();
    }

    const list = frames.map(({ file, duration }) => `file '${file}'\noption framerate ${FPS}\nduration ${duration}`);
    list.push(`file '${frames.at(-1).file}'\noption framerate ${FPS}`);
    await writeFile(path.join(dir, 'frames.txt'), list.join('\n') + '\n');
    await run(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-f', 'concat', '-safe', '0', '-i', 'frames.txt',
      '-vf', `fps=${FPS}`, '-t', String(timing.totalSeconds), '-c:v', 'libx264',
      '-preset', 'ultrafast', '-threads', '2', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'teaser.mp4',
    ], { cwd: dir, timeout: 120000 });
    return await readFile(path.join(dir, 'teaser.mp4'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function createTeaserQueue(render = renderTeaser) {
  const jobs = new Map();
  const pending = [];
  let running = false;

  async function advance() {
    if (running || !pending.length) return;
    running = true;
    const { job, input } = pending.shift();
    job.status = 'rendering';
    try {
      job.video = await render(input, job.format);
      job.status = 'ready';
    } catch (error) {
      job.status = 'failed';
      job.code = error instanceof TeaserError ? error.code : 'render_failed';
      job.erro = error instanceof TeaserError ? error.message : 'Falha ao renderizar o teaser. Tente novamente.';
      if (!(error instanceof TeaserError)) console.error('teaser: falha de renderização', error.code || error.name);
    } finally {
      running = false;
      void advance();
    }
  }

  return {
    submit(input) {
      const format = input?.formato;
      if (typeof format !== 'string' || !Object.hasOwn(TEASER_FORMATS, format)) {
        return { status: 400, body: { code: 'invalid_format', erro: 'Escolha o formato 9:16 ou 16:9.' } };
      }
      if (pending.length) return { status: 429, body: { code: 'queue_full', erro: 'Fila cheia. Tente novamente quando um teaser terminar.' } };
      for (const [id, job] of jobs) {
        if (jobs.size < 5) break;
        if (job.status === 'ready' || job.status === 'failed') jobs.delete(id);
      }
      const job = { id: randomUUID(), format, status: 'queued' };
      jobs.set(job.id, job);
      pending.push({ job, input });
      void advance();
      return { status: 202, body: { ...job } };
    },
    get(id) {
      return jobs.get(id);
    },
  };
}
