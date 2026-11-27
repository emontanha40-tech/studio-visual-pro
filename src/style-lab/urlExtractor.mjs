// Fatia 12a — Extrator de DNA Visual & Motion a partir de URL de Website (Playwright DOM & Computed Styles).
import { dnaToBrandKit, normalizeHex, relativeLuminance } from './dna.mjs';

import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [address, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['224.0.0.0', 3],
]) blocked.addSubnet(address, bits);

async function downloadReference(raw, allowPrivate, signal) {
  const url = new URL(validateReferenceUrl(raw, { allowPrivate }));
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const address = isIP(host) ? host : (await lookup(host, { family: 4 })).address;
  if (!allowPrivate && (isIP(address) !== 4 || blocked.check(address))) {
    throw new Error('Endereços locais ou privados não são permitidos nesta extração.');
  }
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request(url, {
      agent: false, signal, family: isIP(address), autoSelectFamily: false,
      lookup: (_host, _options, callback) => callback(null, address, isIP(address)),
    }, (res) => {
      const chunks = [];
      let bytes = 0;
      res.on('error', reject);
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) req.destroy(new Error('Recurso da referência excede 2 MB.'));
        else chunks.push(chunk);
      });
      res.on('end', () => resolve({
        status: res.statusCode,
        location: res.headers.location,
        contentType: res.headers['content-type'],
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1|\[::1\]|172\.(1[6-9]|2\d|3[01])\.)/i;

export function validateReferenceUrl(rawUrl, { allowPrivate = false } = {}) {
  const s = String(rawUrl || '').trim();
  if (!s) throw new Error('Informe uma URL de website válida (https://...).');
  let parsed;
  try {
    parsed = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s) ? s : `https://${s}`);
  } catch {
    throw new Error('URL inválida. Exemplo: https://exemplo.com.br');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Apenas URLs HTTP ou HTTPS são permitidas.');
  }
  if (!allowPrivate && (PRIVATE_HOST_RE.test(parsed.hostname) || parsed.hostname.startsWith('[') || (isIP(parsed.hostname) === 4 && blocked.check(parsed.hostname)))) {
    throw new Error('Endereços locais ou privados não são permitidos nesta extração.');
  }
  if (parsed.username || parsed.password || (!allowPrivate && parsed.port)) {
    throw new Error('Use uma URL pública sem credenciais ou porta personalizada.');
  }
  return parsed.toString();
}

/**
 * Converte métricas coletadas do DOM em DNA estruturado + Brand Kit.
 */
export function buildUrlDnaFromSnapshot(raw, url) {
  const bg = normalizeHex(raw.bg, '#090e1d');
  const isDark = relativeLuminance(bg) < 0.35;
  const surface = normalizeHex(raw.surface, bg);
  const text = normalizeHex(raw.text, isDark ? '#f4f7ff' : '#111827');
  const muted = normalizeHex(raw.muted, text);
  const primary = normalizeHex(raw.primary, isDark ? '#2f7bff' : '#1d4ed8');
  const accent = normalizeHex(raw.accent, primary);

  const h1Size = Number(raw.h1Size) || 48;
  const h2Size = Number(raw.h2Size) || 32;
  const bodySize = Number(raw.bodySize) || 16;
  const scaleRatio = Number((h1Size / Math.max(12, bodySize)).toFixed(2));

  const dna = {
    source_type: 'url',
    source_ref: url,
    title: String(raw.title || '').trim().slice(0, 120),
    palette: { bg, surface, primary, accent, text, muted },
    typography: {
      display: raw.displayFont || 'Inter, -apple-system, sans-serif',
      body: raw.bodyFont || 'Inter, system-ui, sans-serif',
      weightDisplay: Number(raw.displayWeight) || 800,
      tracking: raw.displayTracking && raw.displayTracking !== 'normal' ? raw.displayTracking : '-0.03em',
      scale: { h1Px: h1Size, h2Px: h2Size, bodyPx: bodySize, ratio: scaleRatio },
    },
    spacing: {
      sectionY: raw.sectionY || '84px',
      cardRadius: raw.cardRadius || '18px',
      containerMax: raw.containerMax || '1100px',
    },
    shadows: Array.isArray(raw.shadows) ? raw.shadows.slice(0, 4) : [],
    motion: {
      easing: raw.easing || 'cubic-bezier(0.16, 1, 0.3, 1)',
      durationMs: Number(raw.durationMs) || 320,
      curves_detected: Array.isArray(raw.curves) ? raw.curves.slice(0, 6) : [],
    },
  };

  const hostName = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Website'; }
  })();
  const suggestedName = (dna.title ? dna.title.split(/[|\-–—·]/)[0].trim() : hostName).slice(0, 40) || hostName;
  const brand_kit = dnaToBrandKit({ name: suggestedName, dna });

  return {
    origem: 'playwright-dom',
    suggested_name: suggestedName,
    dna,
    brand_kit,
    warnings: [],
  };
}

/**
 * Abre a URL em Chromium headless via Playwright e extrai Computed Styles reais.
 */
export async function extractStyleFromUrl(rawUrl, { allowPrivate = false, timeoutMs = 20000 } = {}) {
  let url = validateReferenceUrl(rawUrl, { allowPrivate });
  const signal = AbortSignal.timeout(timeoutMs);
  let document;
  for (let redirects = 0; redirects <= 4; redirects++) {
    document = await downloadReference(url, allowPrivate, signal);
    if (!(document.status >= 300 && document.status < 400 && document.location)) break;
    url = validateReferenceUrl(new URL(document.location, url).href, { allowPrivate });
  }
  if (document.status !== 200 || !/^text\/html\b/i.test(document.contentType || '')) {
    throw new Error('A referência deve responder com uma página HTML acessível.');
  }
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ timeout: 15000 });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, javaScriptEnabled: false, serviceWorkers: 'block',
    });
    let remaining = 16;
    await context.route('**/*', async (route) => {
      const req = route.request();
      if (req.resourceType() === 'document' && req.url() === url.split('#')[0]) {
        return route.fulfill({
          contentType: document.contentType, body: document.body,
          headers: { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline' http: https:; base-uri 'none'" },
        });
      }
      if (req.resourceType() === 'stylesheet' && remaining-- > 0) {
        try {
          const css = await downloadReference(req.url(), allowPrivate, signal);
          if (css.status === 200 && /^text\/css\b/i.test(css.contentType || '')) {
            return await route.fulfill({ contentType: css.contentType, body: css.body });
          }
        } catch { /* Folhas inacessíveis não impedem a leitura do HTML. */ }
      }
      await route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });

    const snapshot = await page.evaluate(() => {
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const isVisibleColor = (c) => c && c !== 'transparent' && !/^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/i.test(c);

      const bodyStyle = cs(document.body);
      const htmlStyle = cs(document.documentElement);
      const bg = isVisibleColor(bodyStyle?.backgroundColor)
        ? bodyStyle.backgroundColor
        : (isVisibleColor(htmlStyle?.backgroundColor) ? htmlStyle.backgroundColor : '#ffffff');

      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      const p = document.querySelector('main p, section p, p');
      const h1Style = cs(h1);
      const h2Style = cs(h2);
      const pStyle = cs(p);

      const text = h1Style?.color || bodyStyle?.color || '#111827';
      const muted = pStyle?.color || text;

      const surfaces = [...document.querySelectorAll('section, article, .card, [class*="card"], header, main > div')].slice(0, 40);
      let surface = bg;
      let cardRadius = '';
      let sectionY = '';
      let containerMax = '';
      const shadows = new Set();

      for (const el of surfaces) {
        const st = cs(el);
        if (!st) continue;
        if (surface === bg && isVisibleColor(st.backgroundColor) && st.backgroundColor !== bg) {
          surface = st.backgroundColor;
        }
        if (!cardRadius && st.borderRadius && st.borderRadius !== '0px') {
          cardRadius = st.borderRadius.split(' ')[0];
        }
        if (st.boxShadow && st.boxShadow !== 'none' && shadows.size < 4) {
          shadows.add(st.boxShadow);
        }
        if (!sectionY && (el.tagName === 'SECTION' || el.tagName === 'ARTICLE')) {
          const pt = parseFloat(st.paddingTop);
          if (pt >= 24 && pt <= 180) sectionY = `${Math.round(pt)}px`;
        }
        if (!containerMax) {
          const mw = parseFloat(st.maxWidth);
          if (mw >= 720 && mw <= 1600) containerMax = `${Math.round(mw)}px`;
        }
      }

      const interactives = [...document.querySelectorAll('a, button, [role="button"], .btn, [class*="btn"], [class*="cta"]')].slice(0, 60);
      let primary = '';
      let accent = '';
      const curves = new Set();
      let durationMs = 0;

      for (const el of interactives) {
        const st = cs(el);
        if (!st) continue;
        if (isVisibleColor(st.backgroundColor) && st.backgroundColor !== bg && st.backgroundColor !== surface) {
          if (!primary) primary = st.backgroundColor;
          else if (!accent && st.backgroundColor !== primary) accent = st.backgroundColor;
        } else if (!primary && isVisibleColor(st.color) && st.color !== text && st.color !== bg) {
          primary = st.color;
        }
        if (!cardRadius && st.borderRadius && st.borderRadius !== '0px' && !st.borderRadius.includes('999')) {
          cardRadius = st.borderRadius.split(' ')[0];
        }
        const tf = st.transitionTimingFunction;
        const td = st.transitionDuration;
        if (td && td !== '0s') {
          const sec = parseFloat(td);
          if (!durationMs && Number.isFinite(sec) && sec > 0) durationMs = Math.round(sec * 1000);
          if (tf) {
            for (const curve of tf.match(/(?:[^,()]|\([^()]*\))+/g) || []) curves.add(curve.trim());
          }
        }
      }

      if (!accent && primary) accent = primary;
      const curvesList = [...curves];

      return {
        title: document.title || '',
        bg,
        surface,
        text,
        muted,
        primary,
        accent,
        displayFont: h1Style?.fontFamily || bodyStyle?.fontFamily || '',
        bodyFont: bodyStyle?.fontFamily || '',
        displayWeight: parseInt(h1Style?.fontWeight || '800', 10) || 800,
        displayTracking: h1Style?.letterSpacing || '',
        h1Size: Math.round(parseFloat(h1Style?.fontSize || '48')) || 48,
        h2Size: Math.round(parseFloat(h2Style?.fontSize || '32')) || 32,
        bodySize: Math.round(parseFloat(bodyStyle?.fontSize || '16')) || 16,
        cardRadius: cardRadius || '16px',
        sectionY: sectionY || '80px',
        containerMax: containerMax || '1100px',
        shadows: [...shadows],
        easing: curvesList[0] || 'cubic-bezier(0.16, 1, 0.3, 1)',
        durationMs: durationMs || 320,
        curves: curvesList,
      };
    });

    return buildUrlDnaFromSnapshot(snapshot, new URL(url).origin + new URL(url).pathname);
  } finally {
    await browser.close();
  }
}
