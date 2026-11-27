// Fatia 5 — aba "Web Sites & Campanha": abas, geração, selo do Auditor, preview em iframe e download do ZIP.
import { validateBrandTokens, contrastRatio } from '/brandTokens.mjs';

const $ = (id) => document.getElementById(id);

export function badgeFor(result) {
  if (result.status === 'approved') return { text: '✔ approved', bg: '#166534', fg: '#f0fdf4' };
  return { text: '⚠ qa_warning', bg: '#b45309', fg: '#fffbeb' };
}

function selectTab(name) {
  for (const b of document.querySelectorAll('#tabs [data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
}

export function showResult(r) {
  $('brand-result').hidden = false;
  const b = badgeFor(r);
  const badge = $('brand-badge');
  badge.textContent = b.text;
  badge.style.background = b.bg;
  badge.style.color = b.fg;
  const auditor = r.auditor.mode === 'gemini' ? 'Gemini Vision' : 'validador estrutural';
  $('brand-meta').textContent = `Auditor: ${auditor}${r.auditor.fallbackReason ? ' (fallback)' : ''} • ${r.attempts} ciclo(s) • modo ${r.imageMode}`;
  const issues = $('brand-issues');
  issues.textContent = '';
  for (const i of r.audit.issues) {
    const li = document.createElement('li');
    li.textContent = `${i.code} (${i.severity}): ${i.fix_hint}`;
    issues.appendChild(li);
  }
  $('brand-download').href = r.downloadUrl;
  const live = $('brand-live');
  if (live) {
    live.hidden = !r.liveUrl;
    if (r.liveUrl) live.href = r.liveUrl;
  }
  const frame = $('brand-frame');
  const img = $('brand-img');
  frame.hidden = !r.previewUrl;
  img.hidden = Boolean(r.previewUrl);
  if (r.previewUrl) frame.src = r.previewUrl;
  else img.src = `${r.pngUrl}?t=${Date.now()}`;
}

// Dados do Briefing Rápido (tokens, conteúdo, tagline) enviados junto com o formulário.
let briefState = null;
const DEFAULT_TOKENS_UI = { schema_version: '1.0.0', brand_name: 'Connect Soluções', colors: { primary: '#1E3A8A', secondary: '#0EA5E9', accent: '#F59E0B', background_main: '#FFFFFF', surface_card: '#F1F5F9', text_primary: '#0F172A', text_muted: '#475569', cta_bg: '#1E3A8A', cta_text: '#FFFFFF' }, typography: { heading_font: 'Poppins', body_font: 'Inter' }, voice: { tone: 'premium', keywords: [] } };
let filledBrief = '';
let colorTouched = false;
function updateContrast() {
  const el = $('fine-contrast');
  if (!el) return;
  const r = previewContrast(briefState?.tokens, $('fine-color').value);
  el.textContent = `Contraste do botão: ${r.ratio.toFixed(2)}:1 ${r.ok ? '✔ WCAG AA' : '✖ abaixo de AA'}${r.corrected ? ' (texto do botão ajustado automaticamente)' : ''}`;
}

/** Recalcula, no cliente, o contraste do botão com a cor primária escolhida (mesmo validador WCAG AA do servidor). */
export function previewContrast(tokens, hex) {
  const base = tokens ?? DEFAULT_TOKENS_UI;
  const v = validateBrandTokens({ ...base, colors: { ...base.colors, primary: hex, cta_bg: hex } });
  if (!v.ok) return { ratio: 0, ok: false, text: '#FFFFFF' };
  const ratio = contrastRatio(v.tokens.colors.cta_bg, v.tokens.colors.cta_text);
  return { ratio, ok: ratio >= 4.5, text: v.tokens.colors.cta_text, corrected: v.corrections.length > 0 };
}

export function collectTestimonials(read) {
  return [1, 2].map((n) => ({ name: read(`fine-t${n}-name`), text: read(`fine-t${n}-text`) })).filter((t) => t.name && t.text);
}

export function buildPayload(formData, state, { color, testimonials, colorTouched }) {
  const fd = { ...(state ?? {}), ...formData };
  if (!fd.archetype) delete fd.archetype;
  // Conteúdo gerado por regras locais é específico do arquétipo; o da IA vale para qualquer um.
  if (state && state.source !== 'gemini' && fd.archetype !== state.archetype) { delete fd.content; delete fd.tagline; }
  delete fd.source;
  if (colorTouched) fd.primaryColor = color; else delete fd.primaryColor;
  if (testimonials.length) fd.testimonials = testimonials;
  return fd;
}

export function applyQuickBrief(form, data) {
  briefState = { tokens: data.tokens, content: data.content, tagline: data.tagline, archetype: data.archetype, source: data.source };
  colorTouched = false;
  if ($('fine-color')) { $('fine-color').value = data.tokens.colors.primary.toLowerCase(); updateContrast(); }
  for (const [name, value] of [['headline', data.headline], ['subtitle', data.subtitle], ['cta', data.cta], ['archetype', data.archetype], ['template', data.template]]) {
    if (form.elements[name] && value) form.elements[name].value = value;
  }
}

if (typeof document !== 'undefined' && $('quick-brief-btn')) {
  $('quick-brief-btn').addEventListener('click', async () => {
    const btn = $('quick-brief-btn');
    if ($('kit-submit').disabled) return;
    btn.disabled = true;
    $('quick-brief-status').textContent = 'Preenchendo…';
    try {
      await fillFormFromBrief($('quick-brief-text').value.trim());
    } catch (err) {
      $('quick-brief-status').textContent = err instanceof Error ? err.message : 'Falha ao preencher.';
    } finally {
      btn.disabled = false;
    }
  });
}

async function fillFormFromBrief(briefing) {
  const res = await fetch('/api/brief/fill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ briefing }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || 'Falha ao preencher.');
  applyQuickBrief($('brand-form'), data);
  filledBrief = briefing;
  const fix = data.corrections?.length ? ` • ${data.corrections.length} ajuste(s) de contraste` : '';
  $('quick-brief-status').textContent = `Preenchido (${data.source === 'gemini' ? 'Gemini' : 'regras locais'}) • ${data.tokens.brand_name}${fix}.`;
}

function currentPayload() {
  const { primaryColor, ...form } = Object.fromEntries(new FormData($('brand-form')));
  return buildPayload(form, briefState, { color: primaryColor, colorTouched, testimonials: collectTestimonials((id) => $(id).value.trim()) });
}

const fmtDate = (ms) => new Date(ms).toLocaleString('pt-BR');

let historyPage = 0;
export async function loadHistory(page = 0) {
  const list = $('kit-history-list');
  if (!list) return;
  const more = $('kit-history-more');
  more.disabled = true;
  try {
    const res = await fetch(`/api/kits?page=${page}`);
    if (!res.ok) throw new Error('Histórico indisponível.');
    const { kits, hasMore } = await res.json();
    historyPage = page;
    more.hidden = !hasMore;
    if (page === 0) list.textContent = '';
    if (page === 0 && !kits.length) { const li = document.createElement('li'); li.textContent = 'Nenhum kit ainda.'; list.appendChild(li); return; }
    for (const k of kits) {
      const li = document.createElement('li');
      li.append(`${k.brandName} — ${fmtDate(k.createdAt)} `);
      if (k.liveAvailable) { const a = document.createElement('a'); a.href = k.liveUrl; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Reabrir site'; li.append(a, ' · '); }
      const d = document.createElement('a'); d.href = k.downloadUrl; d.download = ''; d.textContent = 'Baixar ZIP';
      li.append(d);
      list.appendChild(li);
    }
  } catch { list.textContent = 'Histórico indisponível.'; }
  finally { more.disabled = false; }
}

export function showKit(k) {
  $('kit-result').hidden = false;
  const b = badgeFor(k.landing);
  const lb = $('kit-landing-badge');
  lb.textContent = `Landing ${b.text} · Auditor estrutural`; lb.style.background = b.bg; lb.style.color = b.fg;
  $('kit-download').href = k.downloadUrl;
  const live = $('kit-live');
  const frame = $('kit-frame');
  live.hidden = !k.liveUrl;
  frame.hidden = !k.liveUrl;
  if (k.liveUrl) { live.href = k.liveUrl; frame.src = `${k.liveUrl}?t=${Date.now()}`; }
  const thumbs = $('kit-thumbs');
  thumbs.textContent = '';
  for (const s of k.social) {
    const fig = document.createElement('figure');
    fig.style.margin = '0';
    const img = document.createElement('img');
    img.src = s.thumbUrl; img.alt = s.label; img.style.cssText = 'width:100%;max-height:220px;object-fit:contain;border-radius:8px;background:#0f172a;';
    const cap = document.createElement('figcaption');
    const sb = badgeFor(s);
    const tag = document.createElement('span');
    tag.textContent = sb.text; tag.style.cssText = `padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;background:${sb.bg};color:${sb.fg};margin-left:6px;`;
    cap.append(s.label, tag);
    fig.append(img, cap);
    thumbs.appendChild(fig);
  }
}

if (typeof document !== 'undefined' && $('kit-submit')) {
  $('fine-color').addEventListener('input', () => { colorTouched = true; updateContrast(); });
  $('brand-form').addEventListener('input', () => {
    if (!$('kit-result').hidden) $('kit-status').textContent = 'Ajustes pendentes. Gere o kit para atualizar a galeria e salvar uma versão.';
  });
  updateContrast();
  loadHistory();
  $('kit-history-more').addEventListener('click', () => loadHistory(historyPage + 1));
  $('kit-submit').addEventListener('click', async () => {
    const btn = $('kit-submit');
    if ($('quick-brief-btn').disabled) return;
    btn.disabled = true;
    $('kit-status').textContent = 'Gerando kit (site, 3 peças sociais Retina, ZIP)… pode levar alguns segundos.';
    try {
      const briefing = $('quick-brief-text').value.trim();
      if (briefing && briefing !== filledBrief) await fillFormFromBrief(briefing);
      const payload = currentPayload();
      const res = await fetch('/api/brand/kit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Falha ao gerar kit.');
      $('kit-status').textContent = 'Kit pronto e salvo no histórico.';
      showKit(data);
      loadHistory();
    } catch (err) {
      $('kit-status').textContent = err instanceof Error ? err.message : 'Falha ao gerar kit.';
    } finally {
      btn.disabled = false;
    }
  });
}

if (typeof document !== 'undefined' && $('brand-form')) {
  for (const b of document.querySelectorAll('#tabs [data-tab]')) b.addEventListener('click', () => selectTab(b.dataset.tab));
  $('brand-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = currentPayload();
    $('brand-submit').disabled = true;
    $('brand-status').textContent = 'Gerando e auditando…';
    try {
      const res = await fetch('/api/brand/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fd) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Falha ao gerar.');
      $('brand-status').textContent = 'Pronto.';
      showResult(data);
    } catch (err) {
      $('brand-status').textContent = err instanceof Error ? err.message : 'Falha ao gerar.';
    } finally {
      $('brand-submit').disabled = false;
    }
  });
}
