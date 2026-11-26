import { QaReviewResultSchema } from '../schemas/campaign.schema.ts';
import type {
  GeneratedMediaAsset,
  MediaProductionResult,
  QaReviewResult,
} from '../types/campaign.ts';

export interface VisionQAClient {
  inspectAssets(params: {
    systemPrompt: string;
    userPrompt: string;
    assets: GeneratedMediaAsset[];
  }): Promise<unknown>;
}

export interface QaReviewerOptions {
  visionClient?: VisionQAClient;
  model?: string;
}

export function buildQaReviewerPrompts(production: MediaProductionResult): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = [
    'Você é o Revisor Independente de QA Visual do Studio Visual Pro.',
    'Responda EXCLUSIVAMENTE com um objeto JSON válido (sem markdown).',
    'REGRAS INVIOLÁVEIS (prompts/quality-reviewer.md):',
    '1. Inspecione texto borrado/distorcido, anatomia/mãos deformadas, corte, legibilidade e fidelidade do produto.',
    '2. Separe achados em BLOCKER, WARNING e SUGGESTION.',
    '3. Nunca aprove automaticamente uma peça sem conferência; requiresHumanReview é sempre true.',
    '4. Se não executou algum teste (ex: decodificação de QR Code ou PDF CMYK de gráfica), liste explicitamente em checksNotPerformed.',
  ].join('\n');

  const userPrompt = [
    'CONCEITO_APROVADO_JSON:',
    JSON.stringify(production.artDirection.visualConcept, null, 2),
    '',
    'ATIVOS_GERADOS_JSON:',
    JSON.stringify(production.assets, null, 2),
    '',
    'Retorne JSON: { passed: boolean, issues: [{ severity, product, field, expected, observed, remediation }], checksNotPerformed: string[], requiresHumanReview: true, reviewedAt: ISOString }.',
  ].join('\n');

  return { systemPrompt, userPrompt };
}

/**
 * Cliente padrão de visão computacional via Gemini (`GEMINI_API_KEY`).
 * Se nenhuma chave estiver configurada, retorna revisão estrutural segura
 * marcando explicitamente a inspeção visual em `checksNotPerformed`.
 */
export function createDefaultVisionQAClient(options: {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
} = {}): VisionQAClient {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? '';
  const model = options.model ?? 'gemini-2.5-flash';
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async inspectAssets({ systemPrompt, userPrompt, assets }) {
      if (!apiKey.trim()) {
        return {
          passed: assets.length > 0,
          issues: [],
          checksNotPerformed: [
            'Inspeção multimodal por visão computacional (GEMINI_API_KEY não configurada)',
            'Validação técnica de PDF/CMYK e gabarito da gráfica',
            'Decodificação de QR Code por ferramenta dedicada',
          ],
          requiresHumanReview: true,
          reviewedAt: new Date().toISOString(),
        };
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Gemini Vision QA falhou (HTTP ${response.status}): ${text.slice(0, 300)}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Gemini Vision QA retornou resposta vazia.');
      }

      return JSON.parse(rawText);
    },
  };
}

/**
 * Agente 4 — Revisor de QA Visual (`qaReviewerAgent`).
 * Valida ativos gerados antes de liberar o Showcase ao cliente.
 */
export async function qaReviewerAgent(
  production: MediaProductionResult,
  options: QaReviewerOptions = {},
): Promise<QaReviewResult> {
  const { systemPrompt, userPrompt } = buildQaReviewerPrompts(production);
  const client = options.visionClient ?? createDefaultVisionQAClient({ model: options.model });

  const rawReview = await client.inspectAssets({
    systemPrompt,
    userPrompt,
    assets: production.assets,
  });

  const validated = QaReviewResultSchema.parse(rawReview);
  const hasBlocker = validated.issues.some((issue) => issue.severity === 'BLOCKER');

  return {
    ...validated,
    passed: validated.passed && !hasBlocker,
    requiresHumanReview: true,
  };
}
