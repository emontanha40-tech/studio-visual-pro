import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateBrandTokens } from '../src/brand/brandTokens.mjs';
import { FONT_CATALOG } from '../src/brand/fontCatalog.mjs';
import {
  generateHtml,
  generateLandingPackage,
  exportLandingPackage,
  STORY_SAFE_ZONES,
  FONT_DIR_ABS,
} from '../src/brand/htmlGenerator.mjs';
import { renderHtml, VIEWPORTS } from '../src/brand/renderer.mjs';
import {
  MAX_AUDIT_CYCLES,
  parseAuditResult,
  runVisualAuditLoop,
} from '../src/brand/visualAuditor.mjs';
import { isValidWoff2, extractLatinWoff2Url } from '../scripts/fetch-fonts.mjs';

const tokens = validateBrandTokens({
  schema_version: '1.0.0',
  brand_name: 'Connect Soluções',
  colors: {
    primary: '#1E3A8A', secondary: '#0EA5E9', accent: '#F59E0B',
    background_main: '#FFFFFF', surface_card: '#F1F5F9',
    text_primary: '#0F172A', text_muted: '#475569',
    cta_bg: '#1E3A8A', cta_text: '#FFFFFF',
  },
  typography: { heading_font: 'Poppins', body_font: 'Inter' },
  voice: { tone: 'premium', keywords: ['tecnologia'] },
}).tokens;

test('Fontes .woff2 reais existem em assets/fonts/ com cabeçalho wOF2 válido', () => {
  for (const [name, meta] of Object.entries(FONT_CATALOG)) {
    const file = path.join(FONT_DIR_ABS, meta.file);
    assert.ok(fs.existsSync(file), `Fonte ausente: ${name} (${file})`);
    const buf = fs.readFileSync(file);
    assert.ok(isValidWoff2(buf), `Arquivo inválido para ${name}`);
  }
  const { missingFonts } = generateHtml(tokens, { template: 'banner', headline: 'Teste' });
  assert.deepEqual(missingFonts, []);
});

test('extractLatinWoff2Url extrai o subset latin de CSS do Google Fonts', () => {
  const sample = `
/* cyrillic */
@font-face { src: url(https://fonts.gstatic.com/s/inter/cyrillic.woff2) format('woff2'); }
/* latin */
@font-face { src: url(https://fonts.gstatic.com/s/inter/latin.woff2) format('woff2'); }
`;
  assert.equal(extractLatinWoff2Url(sample), 'https://fonts.gstatic.com/s/inter/latin.woff2');
});

test('Landing Page modular exporta pacote estático (index.html + styles.css) e renderiza fullPage', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svp-lp-'));
  try {
    const pkg = exportLandingPackage(tokens, tmpDir, {
      badge: 'Lançamento',
      headline: 'Presença digital em minutos',
      subtitle: 'Landing page modular usando CSS Variables e logo inline.',
      cta: 'Quero começar',
    });
    assert.ok(fs.existsSync(pkg.indexPath));
    assert.ok(fs.existsSync(pkg.stylesPath));
    assert.ok(pkg.indexHtml.includes('<link rel="stylesheet" href="./styles.css">'));
    assert.ok(pkg.indexHtml.includes('<svg viewBox='));
    assert.ok(pkg.stylesCss.includes(':root{') && pkg.stylesCss.includes('--color-cta-bg: #1E3A8A;'));
    assert.ok(pkg.stylesCss.includes('var(--color-primary)'));
    assert.ok(fs.existsSync(path.join(tmpDir, 'fonts', 'Poppins-Variable.woff2')));

    const shot = await renderHtml(pkg.standaloneHtml, {
      ...VIEWPORTS.landing,
      fullPage: true,
    });
    assert.equal(shot.width, VIEWPORTS.landing.width);
    assert.ok(shot.height > VIEWPORTS.landing.height, `fullPage deveria exceder ${VIEWPORTS.landing.height}px (obteve ${shot.height}px)`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Story 9:16 (1080x1920) respeita zonas seguras de 250px no topo e 320px na base', async () => {
  const { html } = generateHtml(tokens, {
    template: 'story',
    headline: 'Campanha no ar hoje',
    subtitle: 'Design pensado para Instagram e TikTok sem cortes.',
    cta: 'Saiba mais',
  });
  const shot = await renderHtml(html, { ...VIEWPORTS.story_9x16 });
  assert.equal(shot.width, 1080);
  assert.equal(shot.height, 1920);

  // Medição real no Chromium dos elementos críticos dentro das safe zones.
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: VIEWPORTS.story_9x16 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const rects = await page.evaluate(() => {
      return ['.story-logo', '.story-copy h1', '.story-sub', '.story-cta'].map((sel) => {
        const el = document.querySelector(sel);
        const r = el.getBoundingClientRect();
        return { sel, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });
    });
    const maxBottom = STORY_SAFE_ZONES.height - STORY_SAFE_ZONES.bottom;
    for (const r of rects) {
      assert.ok(r.top >= STORY_SAFE_ZONES.top, `${r.sel} invadiu topo (${r.top} < ${STORY_SAFE_ZONES.top})`);
      assert.ok(r.bottom <= maxBottom, `${r.sel} invadiu base (${r.bottom} > ${maxBottom})`);
      assert.ok(r.left >= 0 && r.right <= STORY_SAFE_ZONES.width, `${r.sel} saiu das laterais`);
    }
  } finally {
    await browser.close();
  }
});

test('Auditor Visual valida contrato JSON estrito e rejeita formato inválido', () => {
  const ok = parseAuditResult('```json\n{"approved": true, "issues": []}\n```');
  assert.deepEqual(ok, { approved: true, issues: [] });

  // Issue crítica força approved=false mesmo se modelo devolver true
  const forced = parseAuditResult({
    approved: true,
    issues: [{ code: 'TEXT_OVERFLOW', severity: 'critical', fix_hint: 'Reduzir fonte do h1' }],
  });
  assert.equal(forced.approved, false);

  assert.throws(() => parseAuditResult({ approved: true }));
  assert.throws(() => parseAuditResult({
    approved: false,
    issues: [{ code: 'INVALID_CODE', severity: 'critical', fix_hint: 'x' }],
  }));
});

test('Auditor Visual aprova na 2ª tentativa após aplicar fix_hint', async () => {
  let seenHints = [];
  const res = await runVisualAuditLoop({
    renderFn: async ({ cycle, previousIssues }) => {
      if (cycle === 2) seenHints = previousIssues.map((i) => i.fix_hint);
      return Buffer.from(`png-v${cycle}`);
    },
    auditFn: async (_buf, { cycle }) => {
      if (cycle === 1) {
        return {
          approved: false,
          issues: [{ code: 'TEXT_OVERFLOW', severity: 'critical', fix_hint: 'Diminuir headline para 64px' }],
        };
      }
      return { approved: true, issues: [] };
    },
  });
  assert.equal(res.status, 'approved');
  assert.equal(res.attempts, 2);
  assert.deepEqual(seenHints, ['Diminuir headline para 64px']);
  assert.equal(res.buffer.toString(), 'png-v2');
});

test('Auditor Visual respeita teto rigoroso de 2 ciclos e salva melhor render com qa_warning', async () => {
  const tmpFile = path.join(os.tmpdir(), `svp-qa-${Date.now()}.png`);
  let calls = 0;
  try {
    const res = await runVisualAuditLoop({
      maxCycles: 5, // mesmo pedindo 5, teto rígido é 2
      outPath: tmpFile,
      renderFn: async ({ cycle }) => {
        calls++;
        return Buffer.from(`render-cycle-${cycle}`);
      },
      auditFn: async (_buf, { cycle }) => {
        if (cycle === 1) {
          // Ciclo 1 tem 2 issues críticas
          return {
            approved: false,
            issues: [
              { code: 'TEXT_OVERFLOW', severity: 'critical', fix_hint: 'Ajustar h1' },
              { code: 'OUT_OF_BOUNDS', severity: 'critical', fix_hint: 'Ajustar CTA' },
            ],
          };
        }
        // Ciclo 2 melhora para 1 issue crítica (ainda reprova → melhor render)
        return {
          approved: false,
          issues: [{ code: 'ILLEGIBLE_OVERLAP', severity: 'critical', fix_hint: 'Aumentar opacidade do fundo' }],
        };
      },
    });

    assert.equal(calls, MAX_AUDIT_CYCLES);
    assert.equal(res.attempts, 2);
    assert.equal(res.status, 'qa_warning');
    assert.equal(res.selectedCycle, 2);
    assert.equal(fs.readFileSync(tmpFile, 'utf8'), 'render-cycle-2');
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test('generateLandingPackage mantém coerência de tokens e fallbacks', () => {
  const pkg = generateLandingPackage(tokens, { headline: 'Título', cta: 'Ação' });
  assert.ok(pkg.indexHtml.includes('Título') && pkg.indexHtml.includes('Ação'));
  assert.deepEqual(pkg.fallbacks, []);
});
