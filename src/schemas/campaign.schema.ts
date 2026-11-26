import { z } from 'zod';

export const CampaignFormatSchema = z.enum([
  'instagram_feed',
  'instagram_story',
  'banner_web',
  'folder_print',
  'backdrop',
]);

export const AspectRatioSchema = z.enum(['4:5', '9:16', '16:9', '3:4', '1:1', '21:9']);

export const HexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, 'Cor hexadecimal inválida (ex: #152c36)');

export const CampaignBriefSchema = z.object({
  client: z.string().trim().min(1, 'Cliente é obrigatório').max(2000),
  title: z.string().trim().min(1, 'Tema/título é obrigatório').max(2000),
  goal: z.string().trim().min(1, 'Objetivo é obrigatório').max(2000),
  audience: z.string().trim().min(1, 'Público-alvo é obrigatório').max(2000),
  style: z.string().trim().min(1, 'Preferência visual é obrigatória').max(2000),
  colors: z.string().max(2000).optional(),
  avoid: z.string().max(2000).optional(),
  references: z.string().max(2000).optional(),
  date: z.string().max(100).optional(),
  time: z.string().max(50).optional(),
  venue: z.string().max(500).optional(),
  people: z.string().max(2000).optional(),
  printSpec: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  products: z.array(z.string()).optional(),
  formats: z.array(CampaignFormatSchema).optional(),
});

export const PaletteColorSchema = z.object({
  name: z.string().min(1),
  hex: HexColorSchema,
  role: z.enum(['primary', 'secondary', 'accent', 'background', 'text']),
});

export const TypographySuggestionSchema = z.object({
  role: z.enum(['display', 'body', 'accent']),
  fontFamily: z.string().min(1),
  weight: z.string().min(1),
  licenseNote: z.string().min(1),
});

export const PieceArtPromptSchema = z.object({
  format: CampaignFormatSchema,
  aspectRatio: AspectRatioSchema,
  headline: z.string().min(1).max(160),
  subheadline: z.string().max(240).optional(),
  cta: z.string().max(80).optional(),
  hasTextInArt: z.boolean(),
  preserveProductIdentity: z.boolean().optional(),
  referenceImageUrl: z.string().url().optional(),
  requiresUpscale: z.boolean(),
  generateTeaserVideo: z.boolean(),
  visualPrompt: z.string().min(20, 'Prompt técnico muito curto'),
  negativePrompt: z.string().optional(),
  motionPrompt: z.string().optional(),
  compositionNotes: z.string().min(5),
});

export const ArtDirectorOutputSchema = z.object({
  campaignId: z.string().optional(),
  visualConcept: z.object({
    title: z.string().min(2),
    rationale: z.string().min(10),
    moodKeywords: z.array(z.string().min(1)).min(2).max(10),
    photographyDirection: z.string().min(10),
  }),
  palette: z.array(PaletteColorSchema).min(3).max(6),
  typography: z.array(TypographySuggestionSchema).min(2).max(4),
  pieces: z.array(PieceArtPromptSchema).min(1),
  warnings: z.array(z.string()).default([]),
  readyForPrint: z.literal(false).default(false),
});

export const QaIssueSchema = z.object({
  severity: z.enum(['BLOCKER', 'WARNING', 'SUGGESTION']),
  product: CampaignFormatSchema,
  field: z.string().min(1),
  expected: z.string().min(1),
  observed: z.string().min(1),
  remediation: z.string().min(1),
});

export const QaReviewResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(QaIssueSchema),
  checksNotPerformed: z.array(z.string()),
  requiresHumanReview: z.literal(true).default(true),
  reviewedAt: z.string().min(1),
});

export type ValidatedArtDirectorOutput = z.infer<typeof ArtDirectorOutputSchema>;
export type ValidatedCampaignBrief = z.infer<typeof CampaignBriefSchema>;
export type ValidatedQaReviewResult = z.infer<typeof QaReviewResultSchema>;
