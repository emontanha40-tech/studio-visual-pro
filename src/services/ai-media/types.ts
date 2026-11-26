import type { AspectRatio, MediaModelKind } from '../../types/campaign.ts';

export interface KeyVisualRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  negativePrompt?: string;
  seed?: number;
  safetyTolerance?: '1' | '2' | '3' | '4' | '5';
}

export interface TypographyArtRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  style?: 'AUTO' | 'GENERAL' | 'REALISTIC' | 'DESIGN' | 'RENDER_3D' | 'ANIME';
  negativePrompt?: string;
  seed?: number;
}

export interface ProductCompositionRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  referenceImageUrl?: string;
  negativePrompt?: string;
  seed?: number;
}

export interface UpscaleRequest {
  imageUrl: string;
  scaleFactor?: 2 | 4;
  prompt?: string;
  creativity?: number;
  resemblance?: number;
}

export interface VideoAnimationRequest {
  imageUrl: string;
  motionPrompt: string;
  durationSeconds?: '5' | '10';
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface MediaGenerationResult {
  provider: string;
  modelId: string;
  modelKind: MediaModelKind;
  url: string;
  width?: number;
  height?: number;
  seed?: number;
  requestId?: string;
}

/**
 * Interface padronizada da camada de serviços de mídia (`src/services/ai-media/`).
 * Permite trocar fal.ai por Replicate ou APIs nativas sem alterar os agentes.
 */
export interface MediaProvider {
  readonly name: string;
  generateKeyVisual(req: KeyVisualRequest): Promise<MediaGenerationResult>;
  generateTypographyArt(req: TypographyArtRequest): Promise<MediaGenerationResult>;
  composeProductVisual(req: ProductCompositionRequest): Promise<MediaGenerationResult>;
  upscaleForPrint(req: UpscaleRequest): Promise<MediaGenerationResult>;
  animateTeaser(req: VideoAnimationRequest): Promise<MediaGenerationResult>;
}
