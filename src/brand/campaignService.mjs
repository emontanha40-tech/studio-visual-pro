// Fatia 5 — Serviço de campanha: Brand Tokens → template → render → Auditor Visual → pacote ZIP.
import fs from 'node:fs';
import path from 'node:path';
import { validateBrandTokens, normalizeHex } from './brandTokens.mjs';
import { generateHtml, generateLandingPackage, STORY_SAFE_ZONES, FONT_DIR_ABS, PROJECT_ROOT } from './htmlGenerator.mjs';
import { renderHtml, VIEWPORTS } from './renderer.mjs';
import { runVisualAuditLoop, createAuditor, structuralInspectFn } from './visualAuditor.mjs';
import { buildZip } from './zip.mjs';
import { LANDING_ARCHETYPES, parseLandingContent, sanitizeText } from './quickBrief.mjs';
import { resolveHeroPhoto } from './stockPhotos.mjs';

export const TEMPLATES = ['landing', 'story', 'post', 'banner'];
const VIEWPORT_OF = { landing: VIEWPORTS.landing, story: VIEWPORTS.story_9x16, post: VIEWPORTS.post_1x1, banner: VIEWPORTS.banner };
const MAX_STORED = 20;
const store = new Map();

export const DEFAULT_TOKENS = {
  schema_version: '1.0.0', brand_name: 'Connect Soluções',
  colors: { primary: '#1E3A8A', secondary: '#0EA5E9', accent: '#F59E0B', background_main: '#FFFFFF', surface_card: '#F1F5F9',
    text_primary: '#0F172A', text_muted: '#475569', cta_bg: '#1E3A8A', cta_text: '#FFFFFF' },
  typography: { heading_font: 'Poppins', body_font: 'Inter' },
  voice: { tone: 'premium', keywords: [] },
};

/** Só aceita imagem https:// ou caminho absoluto do próprio Studio (sem ".."); senão → modo geométrico. */
export function sanitizeImageUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const v = raw.trim();
  if (v.length > 2000 || /[\s"'<>\\]/.test(v)) return null;
  if (/^https:\/\/[^/]+/i.test(v)) return v;
  if (v.startsWith('/') && !v.startsWith('//') && !v.includes('..')) return v;
  return null;
}
const pct = (n) => (Number.isFinite(+n) && n !== '' && n !== null ? Math.min(100, Math.max(0, +n)) : 50);
const txt = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Depoimentos só entram se informados pelo usuário (nunca inventados): até 3, texto limpo. */
export function sanitizeTestimonials(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => ({ name: sanitizeText(t?.name ?? '').slice(0, 48), text: sanitizeText(t?.text ?? '').slice(0, 220) }))
    .filter((t) => t.name && t.text)
    .slice(0, 3);
}

/** Troca a cor primária/botão e deixa o validador WCAG AA recalcular o contraste do botão. */
export function applyPrimaryColor(tokens, hex) {
  const n = normalizeHex(hex);
  if (!n) return { tokens, corrections: [] };
  const v = validateBrandTokens({ ...tokens, colors: { ...tokens.colors, primary: n, cta_bg: n } });
  return v.ok ? { tokens: v.tokens, corrections: v.corrections } : { tokens, corrections: [] };
}

export async function generateCampaignPiece(input = {}, { env = process.env, fetchImpl = fetch, renderImpl = renderHtml, screenshotScale, photo: presetPhoto, photoEnv = env } = {}) {
  const template = TEMPLATES.includes(input.template) ? input.template : 'landing';
  const v = validateBrandTokens(input.tokens ?? DEFAULT_TOKENS);
  if (!v.ok) throw new Error(`Brand Tokens inválidos: ${v.errors.join('; ')}`);
  const colorFix = applyPrimaryColor(v.tokens, input.primaryColor);
  const tokens = colorFix.tokens;
  const scale = Number(input.scale) === 2 ? 2 : 1;
  let imageUrl = sanitizeImageUrl(input.imageUrl);
  // Sem foto do usuário: busca foto real por nicho (landing/post/story). Nunca para banner geométrico; autoPhoto:false desliga.
  let photo = null;
  if (!imageUrl && input.autoPhoto !== false && template !== 'banner') {
    photo = presetPhoto !== undefined ? presetPhoto : await resolveHeroPhoto({
      text: [input.photoQuery, input.tagline, input.headline, input.subtitle, tokens.brand_name].filter(Boolean).join(' '),
      archetype: input.archetype,
    }, { env: photoEnv, fetchImpl });
    imageUrl = photo?.url ?? null;
  }
  const opts = {
    headline: txt(input.headline) || tokens.brand_name,
    subtitle: txt(input.subtitle, 400),
    cta: txt(input.cta, 60) || 'Saiba mais',
    badge: txt(input.badge, 60) || undefined,
    imageUrl: imageUrl ?? undefined,
    photoCredit: photo?.credit ?? undefined,
    focalX: pct(input.focalX), focalY: pct(input.focalY),
  };
  if (template === 'landing' && LANDING_ARCHETYPES.includes(input.archetype)) {
    opts.archetype = input.archetype;
    const content = parseLandingContent(input.content);
    if (content) Object.assign(opts, content);
    const tagline = txt(input.tagline, 80);
    if (tagline) opts.tagline = tagline;
  }
  if (template === 'landing') {
    const testimonials = sanitizeTestimonials(input.testimonials);
    if (testimonials.length) opts.testimonials = testimonials;
  }
  const viewport = VIEWPORT_OF[template];
  // Screenshot do auditor sempre em modo estático (tudo visível, sem esperar scroll).
  const buildHtml = () => (template === 'landing'
    ? generateLandingPackage(tokens, { ...opts, static: true }).standaloneHtml
    : generateHtml(tokens, { ...opts, template, static: true }).html);

  let lastInspection = null;
  const { auditFn, state } = createAuditor({ apiKey: env.GEMINI_API_KEY ?? '', getInspection: () => lastInspection, fetchImpl });
  const audit = await runVisualAuditLoop({
    renderFn: async () => {
      const r = await renderImpl(buildHtml(), { ...viewport, deviceScaleFactor: scale, screenshotScale, fullPage: template === 'landing', inspectFn: structuralInspectFn });
      lastInspection = r.inspection;
      return r;
    },
    auditFn,
    context: { template, width: viewport.width, height: viewport.height, safeZones: template === 'story' ? STORY_SAFE_ZONES : null },
  });

  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const entry = { id, template, tokens, opts, png: audit.buffer, createdAt: Date.now() };
  store.set(id, entry);
  while (store.size > MAX_STORED) store.delete(store.keys().next().value);

  return {
    id, template, tokens, colorCorrections: colorFix.corrections, status: audit.status, attempts: audit.attempts, audit: audit.audit, history: audit.history,
    auditor: { mode: state.mode, fallbackReason: state.fallbackReason },
    focalPoint: imageUrl ? { x: opts.focalX, y: opts.focalY } : null,
    imageMode: imageUrl ? 'imagem' : 'geometrico',
    photoSource: photo?.source ?? (imageUrl ? 'usuario' : null),
    previewUrl: template === 'landing' ? `/api/brand/preview/${id}/index.html` : null,
    pngUrl: `/api/brand/image/${id}`,
    downloadUrl: `/api/brand/download/${id}`,
  };
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
export const PUBLISHED_DIR = path.join(PROJECT_ROOT, 'public', 'published');

export function slugify(raw) {
  return String(raw ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
}

/** Publica a Landing Page (index.html, styles.css, logo.svg, fonts/) em public/published/<slug>/. */
export function publishLanding(entry, slugInput, { baseDir = PUBLISHED_DIR, fontDir = FONT_DIR_ABS, replace = true } = {}) {
  if (!entry || entry.template !== 'landing') throw new Error('Somente Landing Page pode ser publicada.');
  const slug = slugify(slugInput) || slugify(entry.tokens.brand_name) || `site-${entry.id.slice(-6)}`;
  if (!SLUG_RE.test(slug)) throw new Error('Slug inválido.');
  const outDir = path.join(baseDir, slug);
  const tmp = `${outDir}.tmp-${process.pid}-${Date.now()}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  const pkg = generateLandingPackage(entry.tokens, { ...entry.opts, fontDir });
  fs.mkdirSync(path.join(tmp, 'fonts'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'index.html'), pkg.indexHtml);
  fs.writeFileSync(path.join(tmp, 'styles.css'), pkg.stylesCss);
  fs.writeFileSync(path.join(tmp, 'logo.svg'), pkg.logoSvg);
  for (const f of pkg.fontFiles) fs.copyFileSync(path.join(fontDir, f), path.join(tmp, 'fonts', f));
  // Substituição só do diretório do próprio slug gerado por este serviço (dentro de baseDir).
  if (replace) fs.rmSync(outDir, { recursive: true, force: true });
  fs.renameSync(tmp, outDir);
  return { slug, url: `/published/${slug}/`, files: ['index.html', 'styles.css', 'logo.svg', ...pkg.fontFiles.map((f) => `fonts/${f}`)] };
}

/** Resolve arquivo publicado com proteção contra path traversal. */
export function publishedFile(urlRest, { baseDir = PUBLISHED_DIR } = {}) {
  const [slug, ...parts] = urlRest.split('/');
  if (!SLUG_RE.test(slug ?? '')) return null;
  const rel = parts.join('/') || 'index.html';
  if (!/^(index\.html|styles\.css|logo\.svg|foto-base\.(?:jpg|png)|fonts\/[\w.-]+\.woff2)$/.test(rel)) return null;
  const abs = path.join(baseDir, slug, rel);
  if (!fs.existsSync(abs)) return null;
  const ext = path.extname(rel);
  const type = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' }[ext];
  return { type, data: fs.readFileSync(abs) };
}

export function getEntry(id) { return store.get(String(id)) ?? null; }

/** Arquivo do pacote para o iframe de preview (index.html, styles.css, logo.svg, fonts/*.woff2). */
export function previewFile(entry, rel = 'index.html', { fontDir = FONT_DIR_ABS } = {}) {
  if (entry.template !== 'landing') return null;
  const pkg = generateLandingPackage(entry.tokens, { ...entry.opts, fontDir });
  if (rel === 'index.html') return { type: 'text/html; charset=utf-8', data: pkg.indexHtml };
  if (rel === 'styles.css') return { type: 'text/css; charset=utf-8', data: pkg.stylesCss };
  if (rel === 'logo.svg') return { type: 'image/svg+xml', data: pkg.logoSvg };
  const m = /^fonts\/([\w.-]+\.woff2)$/.exec(rel);
  if (m && pkg.fontFiles.includes(m[1])) return { type: 'font/woff2', data: fs.readFileSync(path.join(fontDir, m[1])) };
  return null;
}

/** ZIP publicável: Landing → index.html + styles.css + fonts/ + logo.svg; peças sociais → PNG + HTML. */
export function buildDownload(entry, { fontDir = FONT_DIR_ABS } = {}) {
  if (entry.template === 'landing') {
    const pkg = generateLandingPackage(entry.tokens, { ...entry.opts, fontDir });
    const files = [
      { name: 'index.html', data: pkg.indexHtml },
      { name: 'styles.css', data: pkg.stylesCss },
      { name: 'logo.svg', data: pkg.logoSvg },
      ...pkg.fontFiles.map((f) => ({ name: `fonts/${f}`, data: fs.readFileSync(path.join(fontDir, f)) })),
    ];
    return { filename: 'landing-page.zip', data: buildZip(files) };
  }
  const html = generateHtml(entry.tokens, { ...entry.opts, template: entry.template }).html;
  return { filename: `${entry.template}.zip`, data: buildZip([{ name: `${entry.template}.png`, data: entry.png }, { name: `${entry.template}.html`, data: html }]) };
}
