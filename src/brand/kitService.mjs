// Fatia 7 — Kit completo em 1 clique: Landing publicada + 3 PNG sociais Retina + marca, empacotados em ZIP.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { generateLandingPackage, FONT_DIR_ABS } from './htmlGenerator.mjs';
import { generateCampaignPiece, getEntry, publishLanding, slugify, sanitizeImageUrl, PUBLISHED_DIR } from './campaignService.mjs';
import { resolveHeroPhoto } from './stockPhotos.mjs';
import { buildZip } from './zip.mjs';

export const SOCIAL_PIECES = [
  { template: 'post', file: 'post-feed.png', label: 'Post Feed 1080×1080' },
  { template: 'story', file: 'story.png', label: 'Story 1080×1920' },
  { template: 'banner', file: 'banner.png', label: 'Banner Wide 1200×628' },
];

const seal = (piece) => ({ status: piece.status, attempts: piece.attempts, issues: piece.audit?.issues ?? [], auditor: piece.auditor?.mode });

/**
 * @param input mesmo contrato de generateCampaignPiece (tokens, headline, archetype, content, primaryColor, testimonials…)
 * @param deps { store, env, fetchImpl, renderImpl, publishDir, fontDir }
 */
export async function generateKit(input = {}, { store, publishDir = PUBLISHED_DIR, fontDir = FONT_DIR_ABS, ...deps } = {}) {
  const base = { ...input, scale: 2 };
  // O kit pode ser atualizado várias vezes sem chamadas de IA (auditor). A busca de foto usa as chaves de foto, 1 vez por kit.
  const photoEnv = deps.env ?? process.env;
  const photo = sanitizeImageUrl(input.imageUrl) || input.autoPhoto === false ? null : await resolveHeroPhoto({
    text: [input.photoQuery, input.tagline, input.headline, input.subtitle, input.tokens?.brand_name].filter(Boolean).join(' '),
    archetype: input.archetype,
  }, { env: photoEnv, fetchImpl: deps.fetchImpl ?? fetch });
  const auditDeps = { ...deps, env: {}, photoEnv, photo };
  const landing = await generateCampaignPiece({ ...base, template: 'landing', scale: 1 }, auditDeps);
  const landingEntry = getEntry(landing.id);
  const id = randomUUID().replaceAll('-', '');
  const prefix = (slugify(input.slug || landingEntry.tokens.brand_name) || 'kit').slice(0, 22);
  const slug = `${prefix}-${id.slice(0, 16)}`;

  const social = [];
  for (const piece of SOCIAL_PIECES) {
    const r = await generateCampaignPiece({ ...base, template: piece.template }, { ...auditDeps, screenshotScale: 'css' });
    social.push({ ...piece, ...seal(r), png: getEntry(r.id).png });
  }

  const pkg = generateLandingPackage(landingEntry.tokens, { ...landingEntry.opts, fontDir });
  const files = [
    { name: 'site/index.html', data: pkg.indexHtml },
    { name: 'site/styles.css', data: pkg.stylesCss },
    { name: 'site/logo.svg', data: pkg.logoSvg },
    ...pkg.fontFiles.map((f) => ({ name: `site/fonts/${f}`, data: fs.readFileSync(path.join(fontDir, f)) })),
    ...social.map((s) => ({ name: `social/${s.file}`, data: s.png })),
    { name: 'brand/logo.svg', data: pkg.logoSvg },
    { name: 'brand/brand-tokens.json', data: JSON.stringify(landingEntry.tokens, null, 2) },
  ];
  const zip = buildZip(files);
  const summary = {
    landing: seal(landing),
    social: social.map(({ png, ...s }) => ({ ...s, thumbUrl: `/api/kits/${id}/social/${s.file}` })),
    primaryColor: landingEntry.tokens.colors.primary,
    colorCorrections: landing.colorCorrections,
    zipBytes: zip.length,
  };
  const published = publishLanding(landingEntry, slug, { baseDir: publishDir, fontDir, replace: false });
  const result = {
    id, slug: published.slug, brandName: landingEntry.tokens.brand_name, archetype: input.archetype ?? null,
    liveUrl: published.url, createdAt: Date.now(), ...summary, downloadUrl: `/api/kits/${id}/zip`,
  };
  try {
    store?.saveKit({
      id, slug: result.slug, brandName: result.brandName, archetype: result.archetype, liveUrl: result.liveUrl, summary, zip,
      files: social.map((s) => ({ name: s.file, data: s.png })), createdAt: result.createdAt,
    });
  } catch (error) {
    fs.rmSync(path.join(publishDir, published.slug), { recursive: true, force: true });
    throw error;
  }
  return result;
}
