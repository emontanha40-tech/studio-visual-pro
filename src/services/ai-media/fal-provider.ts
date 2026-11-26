import type { AspectRatio } from '../../types/campaign.ts';
import type {
  KeyVisualRequest,
  MediaGenerationResult,
  MediaProvider,
  TypographyArtRequest,
  UpscaleRequest,
  VideoAnimationRequest,
} from './types.ts';

export const FAL_MODELS = {
  KEY_VISUAL: 'fal-ai/flux-pro/v1.1',
  TYPOGRAPHY_ART: 'fal-ai/ideogram/v2',
  UPSCALE_PRINT: 'fal-ai/clarity-upscaler',
  VIDEO_TEASER: 'fal-ai/kling-video/v1.6/standard/image-to-video',
} as const;

export interface FalProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const ASPECT_TO_FAL_IMAGE_SIZE: Record<AspectRatio, { width: number; height: number }> = {
  '4:5': { width: 1024, height: 1280 },
  '9:16': { width: 768, height: 1344 },
  '16:9': { width: 1344, height: 768 },
  '3:4': { width: 896, height: 1152 },
  '1:1': { width: 1024, height: 1024 },
  '21:9': { width: 1536, height: 640 },
};

const ASPECT_TO_IDEOGRAM: Record<AspectRatio, string> = {
  '4:5': 'ASPECT_4_5',
  '9:16': 'ASPECT_9_16',
  '16:9': 'ASPECT_16_9',
  '3:4': 'ASPECT_3_4',
  '1:1': 'ASPECT_1_1',
  '21:9': 'ASPECT_16_9',
};

/**
 * Provider unificado conectado à API REST da fal.ai (`FAL_KEY`).
 * Unifica Flux Pro v1.1, Ideogram v2, Clarity Upscaler e Kling Video.
 */
export class FalMediaProvider implements MediaProvider {
  public readonly name = 'fal.ai';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FalProviderOptions = {}) {
    const key = options.apiKey ?? process.env.FAL_KEY ?? '';
    if (!key.trim()) {
      throw new Error(
        'FAL_KEY não configurada. Defina FAL_KEY no ambiente do servidor antes de acionar modelos de mídia.',
      );
    }
    this.apiKey = key.trim();
    this.baseUrl = (options.baseUrl ?? 'https://fal.run').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async invoke<TResponse>(modelId: string, payload: Record<string, unknown>): Promise<TResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/${modelId}`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(
          `fal.ai (${modelId}) falhou com HTTP ${response.status}: ${bodyText.slice(0, 300)}`,
        );
      }

      return (await response.json()) as TResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  async generateKeyVisual(req: KeyVisualRequest): Promise<MediaGenerationResult> {
    const imageSize = ASPECT_TO_FAL_IMAGE_SIZE[req.aspectRatio];
    const data = await this.invoke<{
      images?: Array<{ url: string; width?: number; height?: number }>;
      seed?: number;
      request_id?: string;
    }>(FAL_MODELS.KEY_VISUAL, {
      prompt: req.prompt,
      image_size: imageSize,
      safety_tolerance: req.safetyTolerance ?? '2',
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
    });

    const image = data.images?.[0];
    if (!image?.url) {
      throw new Error(`fal.ai (${FAL_MODELS.KEY_VISUAL}) não retornou URL de imagem.`);
    }

    return {
      provider: this.name,
      modelId: FAL_MODELS.KEY_VISUAL,
      modelKind: 'key_visual',
      url: image.url,
      width: image.width ?? imageSize.width,
      height: image.height ?? imageSize.height,
      seed: data.seed,
      requestId: data.request_id,
    };
  }

  async generateTypographyArt(req: TypographyArtRequest): Promise<MediaGenerationResult> {
    const data = await this.invoke<{
      images?: Array<{ url: string; width?: number; height?: number }>;
      seed?: number;
      request_id?: string;
    }>(FAL_MODELS.TYPOGRAPHY_ART, {
      prompt: req.prompt,
      aspect_ratio: ASPECT_TO_IDEOGRAM[req.aspectRatio],
      style: req.style ?? 'DESIGN',
      ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
    });

    const image = data.images?.[0];
    if (!image?.url) {
      throw new Error(`fal.ai (${FAL_MODELS.TYPOGRAPHY_ART}) não retornou URL de imagem.`);
    }

    return {
      provider: this.name,
      modelId: FAL_MODELS.TYPOGRAPHY_ART,
      modelKind: 'typography_art',
      url: image.url,
      width: image.width,
      height: image.height,
      seed: data.seed,
      requestId: data.request_id,
    };
  }

  async upscaleForPrint(req: UpscaleRequest): Promise<MediaGenerationResult> {
    const data = await this.invoke<{
      image?: { url: string; width?: number; height?: number };
      seed?: number;
      request_id?: string;
    }>(FAL_MODELS.UPSCALE_PRINT, {
      image_url: req.imageUrl,
      upscale_factor: req.scaleFactor ?? 4,
      prompt: req.prompt ?? 'masterpiece, ultra sharp, print quality, clean details',
      creativity: req.creativity ?? 0.25,
      resemblance: req.resemblance ?? 0.75,
    });

    if (!data.image?.url) {
      throw new Error(`fal.ai (${FAL_MODELS.UPSCALE_PRINT}) não retornou URL ampliada.`);
    }

    return {
      provider: this.name,
      modelId: FAL_MODELS.UPSCALE_PRINT,
      modelKind: 'upscale_print',
      url: data.image.url,
      width: data.image.width,
      height: data.image.height,
      seed: data.seed,
      requestId: data.request_id,
    };
  }

  async animateTeaser(req: VideoAnimationRequest): Promise<MediaGenerationResult> {
    const data = await this.invoke<{
      video?: { url: string };
      request_id?: string;
    }>(FAL_MODELS.VIDEO_TEASER, {
      image_url: req.imageUrl,
      prompt: req.motionPrompt,
      duration: req.durationSeconds ?? '5',
      aspect_ratio: req.aspectRatio ?? '16:9',
    });

    if (!data.video?.url) {
      throw new Error(`fal.ai (${FAL_MODELS.VIDEO_TEASER}) não retornou URL de vídeo.`);
    }

    return {
      provider: this.name,
      modelId: FAL_MODELS.VIDEO_TEASER,
      modelKind: 'video_teaser',
      url: data.video.url,
      requestId: data.request_id,
    };
  }
}
