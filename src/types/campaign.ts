/**
 * Tipos centrais do pipeline criativo multimodal — Studio Visual Pro.
 * Conecta o domínio determinístico existente (`src/engine.mjs`) com os
 * agentes orquestradores (LLMs) e motores de mídia (fal.ai / provedores).
 */

export type CampaignFormat =
  | 'instagram_feed'   // 4:5 (1080x1350)  -> engine.mjs: 'feed'
  | 'instagram_story'  // 9:16 (1080x1920) -> engine.mjs: 'story'
  | 'banner_web'       // 16:9 (1920x1080) -> engine.mjs: 'screen'
  | 'folder_print'     // A4 / impresso    -> engine.mjs: 'invitation' | 'prayer' | 'decision'
  | 'backdrop';        // Grande formato   -> engine.mjs: 'backdrop' | 'wind'

export type AspectRatio = '4:5' | '9:16' | '16:9' | '3:4' | '1:1' | '21:9';

export type MediaModelKind =
  | 'key_visual'       // fal-ai/flux-pro/v1.1 | google/imagen-3
  | 'typography_art'   // fal-ai/ideogram/v2
  | 'upscale_print'    // fal-ai/clarity-upscaler
  | 'video_teaser';    // fal-ai/kling-video

export interface FormatSpec {
  format: CampaignFormat;
  label: string;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  isPrint: boolean;
  requiresUpscale: boolean;
  supportsVideoTeaser: boolean;
}

export const FORMAT_SPECS: Record<CampaignFormat, FormatSpec> = {
  instagram_feed: {
    format: 'instagram_feed',
    label: 'Instagram Feed (4:5)',
    aspectRatio: '4:5',
    width: 1080,
    height: 1350,
    isPrint: false,
    requiresUpscale: false,
    supportsVideoTeaser: true,
  },
  instagram_story: {
    format: 'instagram_story',
    label: 'Instagram Story / Reels (9:16)',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    isPrint: false,
    requiresUpscale: false,
    supportsVideoTeaser: true,
  },
  banner_web: {
    format: 'banner_web',
    label: 'Banner Web / Telão (16:9)',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    isPrint: false,
    requiresUpscale: false,
    supportsVideoTeaser: true,
  },
  folder_print: {
    format: 'folder_print',
    label: 'Folder / Impresso (A4)',
    aspectRatio: '3:4',
    width: 2480,
    height: 3508,
    isPrint: true,
    requiresUpscale: true,
    supportsVideoTeaser: false,
  },
  backdrop: {
    format: 'backdrop',
    label: 'Backdrop / Grande Formato',
    aspectRatio: '16:9',
    width: 3840,
    height: 2160,
    isPrint: true,
    requiresUpscale: true,
    supportsVideoTeaser: false,
  },
};

/**
 * Mapeamento do catálogo existente em `src/engine.mjs` para os formatos do pipeline IA.
 */
export const ENGINE_CATALOG_TO_FORMAT: Record<string, CampaignFormat> = {
  feed: 'instagram_feed',
  story: 'instagram_story',
  whatsapp: 'instagram_feed',
  screen: 'banner_web',
  invitation: 'folder_print',
  prayer: 'folder_print',
  decision: 'folder_print',
  backdrop: 'backdrop',
  wind: 'backdrop',
};

/**
 * Briefing de entrada — compatível com `emptyBrief()` de `src/engine.mjs`.
 */
export interface CampaignBriefInput {
  client: string;
  title: string;
  goal: string;
  audience: string;
  style: string;
  colors?: string;
  avoid?: string;
  references?: string;
  date?: string;
  time?: string;
  venue?: string;
  people?: string;
  printSpec?: string;
  notes?: string;
  /** IDs do catálogo legado (`engine.mjs`) ou formatos diretos do pipeline */
  products?: string[];
  formats?: CampaignFormat[];
}

export interface PaletteColor {
  name: string;
  hex: string;
  role: 'primary' | 'secondary' | 'accent' | 'background' | 'text';
}

export interface TypographySuggestion {
  role: 'display' | 'body' | 'accent';
  fontFamily: string;
  weight: string;
  licenseNote: string;
}

export interface PieceArtPrompt {
  format: CampaignFormat;
  aspectRatio: AspectRatio;
  headline: string;
  subheadline?: string;
  cta?: string;
  /** Define roteamento: true -> Ideogram v2; false -> Flux Pro v1.1 */
  hasTextInArt: boolean;
  /** Define se precisa passar pelo Clarity Upscaler (4x/8x) para impressão */
  requiresUpscale: boolean;
  /** Define se deve gerar teaser/loop em vídeo (Kling) */
  generateTeaserVideo: boolean;
  /** Prompt técnico em inglês otimizado para o modelo especialista */
  visualPrompt: string;
  negativePrompt?: string;
  /** Prompt de movimento para Image-to-Video (quando generateTeaserVideo = true) */
  motionPrompt?: string;
  compositionNotes: string;
}

export interface ArtDirectorOutput {
  campaignId?: string;
  visualConcept: {
    title: string;
    rationale: string;
    moodKeywords: string[];
    photographyDirection: string;
  };
  palette: PaletteColor[];
  typography: TypographySuggestion[];
  pieces: PieceArtPrompt[];
  /** Avisos editoriais ou pendências detectadas sem inventar dados */
  warnings: string[];
  /** Sempre falso até validação técnica/humana (invariante do Studio Visual Pro) */
  readyForPrint: false;
}

export interface GeneratedMediaAsset {
  id: string;
  format: CampaignFormat;
  modelKind: MediaModelKind;
  modelId: string;
  url: string;
  width?: number;
  height?: number;
  upscaledUrl?: string;
  videoUrl?: string;
  seed?: number;
  createdAt: string;
}

export interface MediaProductionResult {
  artDirection: ArtDirectorOutput;
  assets: GeneratedMediaAsset[];
  errors: Array<{ format: CampaignFormat; stage: MediaModelKind; message: string }>;
}

export interface ShowcaseSlide {
  id: string;
  title: string;
  subtitle?: string;
  backgroundUrl: string;
  backgroundType: 'video' | 'image';
  transition: 'fade' | 'cinematic-zoom' | 'parallax-slide';
  durationMs: number;
  assetFormat: CampaignFormat;
}

export interface ShowcaseOutput {
  presentation: {
    campaignTitle: string;
    palette: PaletteColor[];
    typography: TypographySuggestion[];
    slides: ShowcaseSlide[];
  };
  webPreviewSpec: {
    heroHeadline: string;
    heroSubheadline: string;
    heroBackgroundUrl: string;
    heroBackgroundType: 'video' | 'image';
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    galleryAssets: GeneratedMediaAsset[];
  };
}

export type PipelineJobStatus =
  | 'QUEUED'
  | 'ART_DIRECTION'
  | 'MEDIA_PRODUCTION'
  | 'SHOWCASE_READY'
  | 'FAILED_RETRYABLE';

export interface PipelineJob {
  id: string;
  status: PipelineJobStatus;
  brief: CampaignBriefInput;
  artDirection?: ArtDirectorOutput;
  production?: MediaProductionResult;
  showcase?: ShowcaseOutput;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
