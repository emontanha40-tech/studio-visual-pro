// Fatia 4 — Auditor Visual com contrato JSON estrito e teto rigoroso de 2 ciclos.
import fs from 'node:fs';
import path from 'node:path';

export const MAX_AUDIT_CYCLES = 2;
export const VALID_ISSUE_CODES = ['TEXT_OVERFLOW', 'ILLEGIBLE_OVERLAP', 'OUT_OF_BOUNDS', 'SAFE_ZONE_VIOLATION'];
export const VALID_SEVERITIES = ['critical', 'warning'];

const SYSTEM_PROMPT = [
  'Você é um Auditor Visual objetivo de peças gráficas e páginas web.',
  'Responda EXCLUSIVAMENTE com JSON válido (sem markdown, sem comentários).',
  'Cheque APENAS falhas visuais reais:',
  '- TEXT_OVERFLOW: texto cortado, truncado ou estourando a caixa.',
  '- ILLEGIBLE_OVERLAP: sobreposição de elementos que torna texto/CTA ilegível.',
  '- OUT_OF_BOUNDS: elemento essencial fora da área visível.',
  '- SAFE_ZONE_VIOLATION: texto/logo/CTA invadindo zona segura de UI (quando aplicável, ex: Story 9:16).',
  'Contrato estrito: {"approved": boolean, "issues": [{"code": string, "severity": "critical"|"warning", "fix_hint": string}]}',
  'Se não houver falhas reais, retorne {"approved": true, "issues": []}.',
].join('\n');

/** Valida e normaliza o retorno do auditor visual segundo o contrato estrito. */
export function parseAuditResult(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    obj = JSON.parse(cleaned);
  }
  if (!obj || typeof obj !== 'object' || typeof obj.approved !== 'boolean' || !Array.isArray(obj.issues)) {
    throw new Error('Contrato do Auditor Visual inválido: esperado { approved: boolean, issues: [] }');
  }
  const issues = obj.issues.map((it, idx) => {
    if (!it || typeof it !== 'object') throw new Error(`Issue #${idx} inválida`);
    const code = String(it.code ?? '').trim();
    const severity = String(it.severity ?? '').trim();
    const fix_hint = String(it.fix_hint ?? '').trim();
    if (!VALID_ISSUE_CODES.includes(code)) throw new Error(`Issue #${idx} code inválido: ${code}`);
    if (!VALID_SEVERITIES.includes(severity)) throw new Error(`Issue #${idx} severity inválida: ${severity}`);
    if (!fix_hint) throw new Error(`Issue #${idx} fix_hint obrigatório`);
    return { code, severity, fix_hint };
  });
  const hasCritical = issues.some((i) => i.severity === 'critical');
  return { approved: obj.approved && !hasCritical, issues };
}

/** Pontuação menor = render melhor (prioriza menos falhas críticas, depois menos warnings). */
export function scoreAudit(audit) {
  const critical = audit.issues.filter((i) => i.severity === 'critical').length;
  const warning = audit.issues.filter((i) => i.severity === 'warning').length;
  return critical * 100 + warning;
}

/** Cliente de visão Gemini (multimodal com PNG em base64). */
export function createGeminiVisionAuditor({
  apiKey = process.env.GEMINI_API_KEY ?? '',
  model = 'gemini-2.5-flash',
  fetchImpl = fetch,
} = {}) {
  return async function auditImage(pngBuffer, context = {}) {
    if (!apiKey.trim()) {
      throw new Error('GEMINI_API_KEY ausente para o Auditor Visual');
    }
    const base64 = Buffer.from(pngBuffer).toString('base64');
    const prompt = `Inspecione a imagem renderizada (template: ${context.template ?? 'desconhecido'}, viewport: ${context.width ?? '?'}x${context.height ?? '?'}).${context.safeZones ? ` Respeite safe zones: topo ${context.safeZones.top}px, base ${context.safeZones.bottom}px.` : ''} Retorne apenas o JSON estrito.`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: base64 } },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Gemini Vision falhou (HTTP ${res.status}): ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Gemini Vision retornou resposta vazia');
    return parseAuditResult(rawText);
  };
}

/**
 * Executa até MAX_AUDIT_CYCLES (2) ciclos de render + auditoria visual.
 * - Aprovado no ciclo 1 ou 2 → salva e retorna status "approved".
 * - Reprovado na 2ª tentativa → seleciona o melhor render e salva com status "qa_warning".
 */
export async function runVisualAuditLoop({
  renderFn,
  auditFn,
  outPath = null,
  maxCycles = MAX_AUDIT_CYCLES,
  context = {},
}) {
  if (typeof renderFn !== 'function') throw new Error('renderFn obrigatório');
  if (typeof auditFn !== 'function') throw new Error('auditFn obrigatório');

  // Teto rigoroso de 2 ciclos (nunca permite mais que MAX_AUDIT_CYCLES).
  const limit = Math.max(1, Math.min(Number(maxCycles) || MAX_AUDIT_CYCLES, MAX_AUDIT_CYCLES));
  let best = null;
  let lastIssues = [];
  const history = [];

  for (let cycle = 1; cycle <= limit; cycle++) {
    const rendered = await renderFn({ cycle, previousIssues: lastIssues });
    const buffer = Buffer.isBuffer(rendered) ? rendered : rendered.buffer;
    const audit = parseAuditResult(await auditFn(buffer, { ...context, cycle }));
    const entry = { cycle, buffer, audit, score: scoreAudit(audit) };
    history.push({ cycle, approved: audit.approved, issues: audit.issues });

    if (!best || entry.score < best.score) best = entry;

    if (audit.approved) {
      if (outPath) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, buffer);
      }
      return { status: 'approved', attempts: cycle, audit, buffer, outPath, history };
    }
    lastIssues = audit.issues;
  }

  // Reprovou na 2ª tentativa → salva o melhor render com status "qa_warning".
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, best.buffer);
  }
  return {
    status: 'qa_warning',
    attempts: limit,
    selectedCycle: best.cycle,
    audit: best.audit,
    buffer: best.buffer,
    outPath,
    history,
  };
}

/** Inspeção estrutural executada dentro da página (sem IA): estouro de texto, fora da área, zonas seguras. */
export function structuralInspectFn() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const isFull = document.body.classList.contains('is-landing');
  const out = [];
  for (const el of document.querySelectorAll('h1,h2,h3,p,.cta,.story-copy,.story-cta,.story-logo')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const label = el.className || el.tagName.toLowerCase();
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).display !== 'inline') out.push({ kind: 'overflow', label: String(label) });
    if (r.left < -1 || r.right > vw + 1 || (!isFull && r.bottom > vh + 1)) out.push({ kind: 'bounds', label: String(label) });
    if (el.matches('.story-copy,.story-cta,.story-logo')) out.push({ kind: 'safe', label: String(label), top: r.top, bottom: r.bottom, vh });
  }
  if (document.documentElement.scrollWidth > vw + 2) out.push({ kind: 'bounds', label: 'page-x-scroll' });
  return out;
}

/** Converte a inspeção estrutural no contrato estrito do auditor. */
export function structuralAudit(items, { safeZones = null } = {}) {
  const issues = [];
  const add = (code, severity, fix_hint) => { if (!issues.some((i) => i.code === code && i.fix_hint === fix_hint)) issues.push({ code, severity, fix_hint }); };
  for (const it of items ?? []) {
    if (it.kind === 'overflow') add('TEXT_OVERFLOW', 'critical', `Reduzir texto ou fonte em ${it.label}.`);
    else if (it.kind === 'bounds') add('OUT_OF_BOUNDS', 'critical', `Reposicionar ${it.label} dentro da área visível.`);
    else if (it.kind === 'safe' && safeZones && (it.top < safeZones.top - 1 || it.bottom > it.vh - safeZones.bottom + 1)) {
      add('SAFE_ZONE_VIOLATION', 'critical', `Mover ${it.label} para dentro da zona segura.`);
    }
  }
  return parseAuditResult({ approved: issues.length === 0, issues });
}

/**
 * Modo seguro: com GEMINI_API_KEY usa Gemini Vision; sem chave (ou se a API falhar) cai para o validador
 * estrutural, sem travar o fluxo. getInspection() devolve a inspeção do último render.
 */
export function createAuditor({ apiKey = process.env.GEMINI_API_KEY ?? '', getInspection, fetchImpl = fetch } = {}) {
  const useGemini = Boolean(apiKey.trim());
  const gemini = useGemini ? createGeminiVisionAuditor({ apiKey, fetchImpl }) : null;
  const state = { mode: useGemini ? 'gemini' : 'structural', fallbackReason: null };
  const auditFn = async (buffer, context = {}) => {
    if (gemini) {
      try { return await gemini(buffer, context); }
      catch (err) { state.mode = 'structural'; state.fallbackReason = err instanceof Error ? err.message.slice(0, 160) : 'falha Gemini'; }
    }
    return structuralAudit(getInspection?.(), { safeZones: context.safeZones });
  };
  return { auditFn, state };
}
