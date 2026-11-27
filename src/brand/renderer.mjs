// Fatia 3 & 4 — Renderizador Playwright (multi-viewport, retina, fullPage, espera de fontes).
import fs from 'node:fs';
import path from 'node:path';

export const VIEWPORTS = {
  landing: { width: 1280, height: 800 },
  post_1x1: { width: 1080, height: 1080 },
  story_9x16: { width: 1080, height: 1920 },
  banner: { width: 1200, height: 628 },
};

function readPngSize(buf, fallbackW, fallbackH) {
  if (Buffer.isBuffer(buf) && buf.length >= 24 && buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  return { width: fallbackW, height: fallbackH };
}

export async function renderHtml(
  html,
  { width = 1280, height = 800, deviceScaleFactor = 1, screenshotScale = 'device', fullPage = false, outPath, type = 'png', inspectFn = null } = {},
) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready); // espera explícita de fontes
    const shotOpts = fullPage
      ? { type, fullPage: true }
      : { type, clip: { x: 0, y: 0, width, height } };
    const inspection = inspectFn ? await page.evaluate(inspectFn) : null;
    const buf = await page.screenshot({ ...shotOpts, scale: screenshotScale });
    if (outPath) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, buf);
    }
    const outputScale = screenshotScale === 'css' ? 1 : deviceScaleFactor;
    const size = readPngSize(buf, width * outputScale, height * outputScale);
    return { buffer: buf, width: size.width, height: size.height, inspection };
  } finally {
    await browser.close();
  }
}
