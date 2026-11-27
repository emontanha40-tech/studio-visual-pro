// Fatia 12b — Extrator de DNA Visual a partir de Imagem de Arte (Gemini Vision + fallback cromático local honesto).
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { dnaToBrandKit, normalizeHex, relativeLuminance } from './dna.mjs';

const run = promisify(execFile);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const IMAGE_DNA_PROMPT = [
  'Você é um Diretor de Arte Sênior especialista em engenharia reversa de design.',
  'Analise a imagem de referência e responda EXCLUSIVAMENTE com JSON válido (sem markdown).',
  'Contrato estrito:',
  '{',
  '  "suggested_name": string (nome curto do estilo, máx 35 chars),',
  '  "palette": { "bg": "#RRGGBB", "surface": "#RRGGBB", "primary": "#RRGGBB", "accent": "#RRGGBB", "text": "#RRGGBB", "muted": "#RRGGBB" },',
  '  "art_direction": { "style": string, "mood": string, "composition": string },',
  '  "breathing_room": { "level": "compact"|"balanced"|"generous", "sectionY": string, "cardRadius": string },',
  '  "contrast": { "level": "low"|"medium"|"high", "mode": "dark"|"light" },',
  '  "photo_treatment": { "grade": string, "vignette": "none"|"subtle"|"strong", "css_filter": string },',
  '  "hierarchy": { "font_style": "sans"|"serif"|"humanist", "display_weight": number, "tracking": string, "emphasis": string }',
  '}',
].join('\n');

export function parseImageDnaJson(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    obj = JSON.parse(cleaned);
  }
  if (!obj || typeof obj !== 'object' || !obj.palette || typeof obj.palette !== 'object') {
    throw new Error('JSON de DNA visual inválido: campo palette obrigatório.');
  }
  const fontMap = {
    serif: 'Georgia, "Times New Roman", serif',
    humanist: '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
    sans: 'Inter, -apple-system, sans-serif',
  };
  const fontStyle = fontMap[obj.hierarchy?.font_style] ? obj.hierarchy.font_style : 'sans';
  const breathing = obj.breathing_room || {};
  const sectionByLevel = { compact: '56px', balanced: '84px', generous: '112px' };
  const sectionY = breathing.sectionY || sectionByLevel[breathing.level] || '84px';

  return {
    suggested_name: String(obj.suggested_name || 'Arte de Referência').trim().slice(0, 40),
    dna: {
      source_type: 'image',
      palette: {
        bg: normalizeHex(obj.palette.bg, '#0b0e17'),
        surface: normalizeHex(obj.palette.surface, '#151b2b'),
        primary: normalizeHex(obj.palette.primary, '#2f7bff'),
        accent: normalizeHex(obj.palette.accent, '#00e5ff'),
        text: normalizeHex(obj.palette.text, '#f4f7ff'),
        muted: normalizeHex(obj.palette.muted, '#9aa6c2'),
      },
      art_direction: {
        style: String(obj.art_direction?.style || 'Editorial contemporâneo').slice(0, 80),
        mood: String(obj.art_direction?.mood || 'Sofisticado e limpo').slice(0, 80),
        composition: String(obj.art_direction?.composition || 'Assimetria equilibrada com foco central').slice(0, 120),
      },
      breathing_room: {
        level: ['compact', 'balanced', 'generous'].includes(breathing.level) ? breathing.level : 'balanced',
        sectionY,
        cardRadius: String(breathing.cardRadius || '18px').slice(0, 20),
      },
      contrast: {
        level: ['low', 'medium', 'high'].includes(obj.contrast?.level) ? obj.contrast.level : 'high',
        mode: obj.contrast?.mode === 'light' ? 'light' : 'dark',
      },
      photo_treatment: {
        grade: String(obj.photo_treatment?.grade || 'Contraste cinematográfico suave').slice(0, 80),
        vignette: ['none', 'subtle', 'strong'].includes(obj.photo_treatment?.vignette) ? obj.photo_treatment.vignette : 'subtle',
        css_filter: String(obj.photo_treatment?.css_filter || 'contrast(1.06) saturate(1.08)').slice(0, 80),
      },
      hierarchy: {
        font_style: fontStyle,
        display_weight: Math.max(500, Math.min(900, Number(obj.hierarchy?.display_weight) || 800)),
        tracking: String(obj.hierarchy?.tracking || '-0.03em').slice(0, 20),
        emphasis: String(obj.hierarchy?.emphasis || 'Título display forte + subtítulo limpo').slice(0, 100),
      },
      typography: {
        display: fontMap[fontStyle],
        body: 'Inter, system-ui, sans-serif',
        weightDisplay: Math.max(500, Math.min(900, Number(obj.hierarchy?.display_weight) || 800)),
        tracking: String(obj.hierarchy?.tracking || '-0.03em').slice(0, 20),
      },
      spacing: {
        sectionY,
        cardRadius: String(breathing.cardRadius || '18px').slice(0, 20),
        containerMax: '1100px',
      },
      motion: {
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        durationMs: 380,
      },
    },
  };
}

/**
 * Extrai cores reais da imagem usando FFmpeg (reduz para 4x4 RGB) sem dependências externas.
 */
export async function samplePaletteWithFfmpeg(imageBuffer, ext = '.png') {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const dir = await mkdtemp(path.join(tmpdir(), 'svp-img-'));
  try {
    const imgPath = path.join(dir, `ref${ext}`);
    await writeFile(imgPath, imageBuffer);
    const { stdout } = await run(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe', '-i', imgPath,
      '-vf', 'scale=4:4:flags=area', '-frames:v', '1', '-threads', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
    ], { encoding: 'buffer', maxBuffer: 1024 * 1024, timeout: 10000 });

    const pixels = [];
    for (let i = 0; i + 2 < stdout.length; i += 3) {
      const r = stdout[i];
      const g = stdout[i + 1];
      const b = stdout[i + 2];
      const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      pixels.push({ hex, lum: relativeLuminance(hex), sat });
    }
    if (!pixels.length) return null;
    const byLum = [...pixels].sort((a, b) => a.lum - b.lum);
    const bySat = [...pixels].sort((a, b) => b.sat - a.sat);
    const avgLum = pixels.reduce((acc, p) => acc + p.lum, 0) / pixels.length;
    const isDark = avgLum < 0.45;
    const bg = isDark ? byLum[0].hex : byLum[byLum.length - 1].hex;
    const surface = isDark ? byLum[Math.min(3, byLum.length - 1)].hex : byLum[Math.max(0, byLum.length - 4)].hex;
    const primary = bySat[0].sat > 0.15 ? bySat[0].hex : (isDark ? '#3b82f6' : '#1d4ed8');
    const accent = bySat[1]?.sat > 0.15 ? bySat[1].hex : primary;
    const text = isDark ? '#f4f7ff' : '#111827';
    const muted = isDark ? '#9aa6c2' : '#475569';
    return { bg, surface, primary, accent, text, muted, mode: isDark ? 'dark' : 'light' };
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function extractStyleFromImage(imageBuffer, {
  mimeType = 'image/png',
  filename = 'referencia.png',
  apiKey = process.env.STYLE_LAB_ENABLE_VISION === '1' ? process.env.GEMINI_API_KEY || '' : '',
  model = 'gemini-2.5-flash',
  fetchImpl = fetch,
} = {}) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length < 16) {
    throw new Error('Envie uma imagem válida (PNG, JPG ou WebP).');
  }
  if (imageBuffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Imagem excede o limite de 8 MB.');
  }
  const signatures = {
    'image/png': imageBuffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
    'image/jpeg': imageBuffer.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
    'image/webp': imageBuffer.toString('ascii', 0, 4) === 'RIFF' && imageBuffer.toString('ascii', 8, 12) === 'WEBP',
  };
  if (!ALLOWED_MIMES.has(mimeType) || !signatures[mimeType]) throw new Error('Formato de imagem inválido.');
  const mime = mimeType;
  const cleanName = path.basename(String(filename || 'referencia.png')).replace(/\.[^.]+$/, '').slice(0, 35) || 'Arte Extraída';

  if (apiKey.trim()) {
    const base64 = imageBuffer.toString('base64');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: IMAGE_DNA_PROMPT }] },
        contents: [{
          role: 'user',
          parts: [
            { text: `Extraia o DNA visual completo desta imagem de referência (${cleanName}). Retorne apenas o JSON estrito.` },
            { inlineData: { mimeType: mime, data: base64 } },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini Vision falhou (HTTP ${res.status}).`);
    }
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Gemini Vision retornou resposta vazia.');
    const parsed = parseImageDnaJson(rawText);
    parsed.dna.source_ref = path.basename(String(filename || 'referencia.png'));
    const brand_kit = dnaToBrandKit({ name: parsed.suggested_name, dna: parsed.dna });
    return {
      origem: 'gemini-vision',
      suggested_name: parsed.suggested_name,
      dna: parsed.dna,
      brand_kit,
      warnings: [],
    };
  }

  // Fallback honesto local quando GEMINI_API_KEY não estiver configurada
  const ext = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '.png';
  const palette = await samplePaletteWithFfmpeg(imageBuffer, ext);
  if (!palette) throw new Error('O FFmpeg não conseguiu ler as cores da imagem.');
  const parsed = parseImageDnaJson({
    suggested_name: cleanName,
    palette,
    art_direction: {
      style: 'Extração cromática local (sem Gemini Vision)',
      mood: palette.mode === 'dark' ? 'Alto contraste escuro' : 'Editorial claro',
      composition: 'Hierarquia padrão equilibrada',
    },
    breathing_room: { level: 'balanced', sectionY: '84px', cardRadius: '18px' },
    contrast: { level: 'high', mode: palette.mode },
    photo_treatment: { grade: 'Natural calibrado', vignette: 'subtle', css_filter: 'contrast(1.04)' },
    hierarchy: { font_style: 'sans', display_weight: 800, tracking: '-0.03em', emphasis: 'Título forte + apoio legível' },
  });
  parsed.dna.source_ref = path.basename(String(filename || 'referencia.png'));
  const brand_kit = dnaToBrandKit({ name: parsed.suggested_name, dna: parsed.dna });

  return {
    origem: 'heuristic-fallback',
    suggested_name: parsed.suggested_name,
    dna: parsed.dna,
    brand_kit,
    warnings: ['Gemini Vision indisponível. A paleta foi medida localmente; os demais campos usam valores padrão.'],
  };
}
