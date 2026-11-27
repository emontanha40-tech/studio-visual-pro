import { readFile } from 'node:fs/promises';

const FONTS = [['Inter', 'Inter-Variable.woff2', '100 900'], ['Lora', 'Lora-Variable.woff2', '400 700']];
export const RETINA = 2;

async function fontCss() {
  const faces = await Promise.all(FONTS.map(async ([family, file, weights]) => {
    const bytes = await readFile(new URL(`../../assets/fonts/${file}`, import.meta.url));
    return `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2');font-weight:${weights}}`;
  }));
  return faces.join('\n');
}

/** Rasteriza SVGs do kit em PNG Retina (2×) via Playwright, com fontes locais e sem rede. Retorna Map id → Buffer. */
export async function renderSvgPngs(items, { scale = RETINA } = {}) {
  if (!items.length) return new Map();
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ timeout: 15000 });
  try {
    const css = await fontCss();
    const context = await browser.newContext({ deviceScaleFactor: scale });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.route('**/*', (route) => route.abort());
    const out = new Map();
    for (const { id, width, height, svg } of items) {
      await page.setViewportSize({ width, height });
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css} html,body{margin:0;overflow:hidden;background:transparent}svg{display:block}</style>${svg}`);
      await page.evaluate(() => document.fonts.ready);
      out.set(id, await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } }));
    }
    return out;
  } finally {
    await browser.close();
  }
}
