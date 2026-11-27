// Fatia 12 — Normalização de DNA Visual & Motion -> Brand Kit compatível com /kit e Teaser 60s.

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHex(v) {
  return typeof v === 'string' && HEX_RE.test(v.trim());
}

export function normalizeHex(v, fallback = '#090e1d') {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  if (HEX_RE.test(s)) return s.toLowerCase();
  const short = /^#([0-9a-fA-F]{3})$/.exec(s);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i.exec(s);
  if (rgb) {
    const hex = [rgb[1], rgb[2], rgb[3]]
      .map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0'))
      .join('');
    return `#${hex}`;
  }
  return fallback;
}

export function relativeLuminance(hex) {
  const c = normalizeHex(hex, '#000000');
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function mixHex(hexA, hexB, weight = 0.5) {
  const a = normalizeHex(hexA, '#000000');
  const b = normalizeHex(hexB, '#ffffff');
  const w = Math.max(0, Math.min(1, weight));
  const out = [1, 3, 5].map((i) => {
    const va = parseInt(a.slice(i, i + 2), 16);
    const vb = parseInt(b.slice(i, i + 2), 16);
    return Math.round(va * (1 - w) + vb * w).toString(16).padStart(2, '0');
  });
  return `#${out.join('')}`;
}

export function slugifyPresetId(name) {
  const base = String(name || 'estilo-custom')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `custom-${base || 'estilo'}`;
}

const safeFont = (value, fallback) => typeof value === 'string'
  && /^[\p{L}\p{N} "'_,.-]{1,120}$/u.test(value) ? value : fallback;

function safeLength(value, fallback, min, max) {
  const match = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)$/.exec(String(value));
  if (!match || Number(match[1]) < min || Number(match[1]) > max) return fallback;
  return value;
}

function safeEasing(value) {
  const fallback = 'cubic-bezier(0.16, 1, 0.3, 1)';
  if (/^(ease(-in|-out|-in-out)?|linear|step-start|step-end)$/.test(value)) return value;
  const curve = /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/.exec(value);
  if (!curve) return fallback;
  const points = curve.slice(1).map(Number);
  return points.every(Number.isFinite) && [points[0], points[2]].every((x) => x >= 0 && x <= 1)
    ? `cubic-bezier(${points.join(', ')})` : fallback;
}

/**
 * Converte um DNA extraído (URL, Imagem ou Vídeo) em um Brand Kit completo,
 * garantindo contraste WCAG AA e defaults da Constituição de Design & Motion.
 */
export function dnaToBrandKit({ id, name, dna = {} }) {
  dna = dna && typeof dna === 'object' ? dna : {};
  const palette = dna.palette || {};
  const bg = normalizeHex(palette.bg, '#090e1d');
  const isDark = relativeLuminance(bg) < 0.35;
  const surface = normalizeHex(palette.surface, isDark ? mixHex(bg, '#ffffff', 0.08) : mixHex(bg, '#000000', 0.04));
  let text = normalizeHex(palette.text, isDark ? '#f4f7ff' : '#111827');
  let muted = normalizeHex(palette.muted, isDark ? mixHex(text, bg, 0.35) : mixHex(text, bg, 0.42));
  let primary = normalizeHex(palette.primary, isDark ? '#2f7bff' : '#1d4ed8');
  const accent = normalizeHex(palette.accent, mixHex(primary, isDark ? '#ffffff' : '#000000', 0.25));
  const secondary = normalizeHex(palette.secondary, mixHex(primary, accent, 0.5));

  const accessible = contrastRatio('#ffffff', bg) >= 4.5 ? '#ffffff' : '#000000';
  if (contrastRatio(text, bg) < 4.5) text = accessible;
  if (contrastRatio(muted, bg) < 4.5) muted = accessible;
  if (contrastRatio(primary, bg) < 3.0) {
    primary = isDark ? mixHex(primary, '#ffffff', 0.4) : mixHex(primary, '#000000', 0.35);
  }

  if (contrastRatio(primary, bg) < 3) primary = accessible;

  const typo = dna.typography || {};
  const displayFont = safeFont(typo.display, 'Inter, -apple-system, sans-serif');
  const bodyFont = safeFont(typo.body, 'Inter, system-ui, sans-serif');
  const weightDisplay = Math.max(500, Math.min(900, Number(typo.weightDisplay) || 800));
  const tracking = safeLength(typo.tracking, '-0.03em', -8, 8);

  const spacing = dna.spacing || {};
  const sectionY = safeLength(spacing.sectionY, '84px', 0, 180);
  const cardRadius = safeLength(spacing.cardRadius, '18px', 0, 80);
  const containerMax = safeLength(spacing.containerMax, '1100px', 20, 1600);

  const motion = dna.motion || {};
  const easing = safeEasing(motion.easing);
  const durationMs = Math.max(120, Math.min(1200, Number(motion.durationMs) || 380));

  const teaser = dna.teaser ? {
    avg_scene_seconds: Math.max(1.5, Math.min(12, Number(dna.teaser.avg_scene_seconds) || 10)),
    transition_frames: Math.max(4, Math.min(24, Number(dna.teaser.transition_frames) || 12)),
    pace: ['fast', 'medium', 'cinematic'].includes(dna.teaser.pace) ? dna.teaser.pace : 'medium',
    cut_count: Math.max(0, Number(dna.teaser.cut_count) || 0),
    duration_s: Math.max(0, Number(dna.teaser.duration_s) || 0),
  } : undefined;

  return {
    id: id || slugifyPresetId(name),
    nome: String(name || 'Estilo Extraído').trim().slice(0, 60) || 'Estilo Extraído',
    custom: true,
    colors: {
      bg,
      surface,
      primary,
      accent,
      secondary,
      success: isDark ? '#10f5a0' : '#15803d',
      text,
      muted,
    },
    typography: {
      display: displayFont,
      body: bodyFont,
      weightDisplay,
      tracking,
    },
    spacing: {
      sectionY,
      cardRadius,
      containerMax,
    },
    contrast: {
      minRatio: 4.5,
      mode: isDark ? 'dark' : 'light',
    },
    motion: {
      easing,
      durationMs,
    },
    ...(teaser ? { teaser } : {}),
  };
}
