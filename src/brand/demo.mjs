// Gera exemplos em docs/brand-demo/ (node src/brand/demo.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { validateBrandTokens } from './brandTokens.mjs';
import { generateHtml, exportLandingPackage, PROJECT_ROOT } from './htmlGenerator.mjs';
import { renderHtml, VIEWPORTS } from './renderer.mjs';

const tokens = validateBrandTokens({
  schema_version: '1.0.0', brand_name: 'Connect Soluções',
  colors: { primary: '#1E3A8A', secondary: '#0EA5E9', accent: '#F59E0B', background_main: '#FFFFFF',
    surface_card: '#F1F5F9', text_primary: '#0F172A', text_muted: '#475569', cta_bg: '#1E3A8A', cta_text: '#FFFFFF' },
  typography: { heading_font: 'Poppins', body_font: 'Inter' },
  voice: { tone: 'premium', keywords: [] },
}).tokens;

const out = path.join(PROJECT_ROOT, 'docs/brand-demo');
fs.mkdirSync(out, { recursive: true });

for (const [name, tpl, vp] of [
  ['banner', 'banner', VIEWPORTS.banner],
  ['post_1x1', 'post', VIEWPORTS.post_1x1],
  ['story_9x16', 'story', VIEWPORTS.story_9x16],
]) {
  const g = generateHtml(tokens, {
    template: tpl,
    headline: 'Tecnologia que conecta',
    subtitle: 'Soluções sob medida para o seu negócio',
    cta: 'Fale conosco',
  });
  fs.writeFileSync(path.join(out, `${name}.html`), g.html);
  await renderHtml(g.html, { ...vp, deviceScaleFactor: 1, outPath: path.join(out, `${name}.png`) });
  console.log(name, 'ok', g.missingFonts.length ? `(fontes ausentes → fallback: ${g.missingFonts})` : '(fontes locais ok)');
}

const landingDir = path.join(out, 'landing');
const pkg = exportLandingPackage(tokens, landingDir, {
  badge: 'Nova Geração',
  headline: 'Tecnologia que conecta seu negócio',
  subtitle: 'Soluções sob medida com identidade visual consistente e prontas para publicação.',
  cta: 'Fale conosco',
});
const lpShot = await renderHtml(pkg.standaloneHtml, {
  ...VIEWPORTS.landing,
  fullPage: true,
  outPath: path.join(landingDir, 'landing.png'),
});
console.log('landing ok', `${lpShot.width}x${lpShot.height}`, pkg.missingFonts.length ? `(faltando: ${pkg.missingFonts})` : '(fontes locais ok)');
