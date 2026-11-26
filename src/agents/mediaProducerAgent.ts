import { randomUUID } from 'node:crypto';
import type { MediaProvider } from '../services/ai-media/types.ts';
import type {
  ArtDirectorOutput,
  GeneratedMediaAsset,
  MediaProductionResult,
  PieceArtPrompt,
} from '../types/campaign.ts';

async function produceSinglePiece(
  piece: PieceArtPrompt,
  provider: MediaProvider,
): Promise<GeneratedMediaAsset> {
  const baseResult = piece.preserveProductIdentity || piece.referenceImageUrl
    ? await provider.composeProductVisual({
        prompt: piece.visualPrompt,
        aspectRatio: piece.aspectRatio,
        referenceImageUrl: piece.referenceImageUrl,
        negativePrompt: piece.negativePrompt,
      })
    : piece.hasTextInArt
      ? await provider.generateTypographyArt({
          prompt: piece.visualPrompt,
          aspectRatio: piece.aspectRatio,
          negativePrompt: piece.negativePrompt,
        })
      : await provider.generateKeyVisual({
          prompt: piece.visualPrompt,
          aspectRatio: piece.aspectRatio,
          negativePrompt: piece.negativePrompt,
        });

  let upscaledUrl: string | undefined;
  if (piece.requiresUpscale) {
    const upscaled = await provider.upscaleForPrint({
      imageUrl: baseResult.url,
      scaleFactor: 4,
    });
    upscaledUrl = upscaled.url;
  }

  let videoUrl: string | undefined;
  if (piece.generateTeaserVideo && piece.motionPrompt) {
    const videoAspect =
      piece.aspectRatio === '9:16'
        ? '9:16'
        : piece.aspectRatio === '1:1'
          ? '1:1'
          : '16:9';
    const video = await provider.animateTeaser({
      imageUrl: baseResult.url,
      motionPrompt: piece.motionPrompt,
      aspectRatio: videoAspect,
      durationSeconds: '5',
    });
    videoUrl = video.url;
  }

  return {
    id: randomUUID(),
    format: piece.format,
    modelKind: baseResult.modelKind,
    modelId: baseResult.modelId,
    url: baseResult.url,
    width: baseResult.width,
    height: baseResult.height,
    upscaledUrl,
    videoUrl,
    seed: baseResult.seed,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Agente 2 — Produtor Visual (`mediaProducerAgent`).
 * Dispara em paralelo os modelos especialistas (Ideogram vs Flux),
 * aplica Clarity Upscaler em peças de impressão e anima teasers com Kling.
 */
export async function mediaProducerAgent(
  artDirection: ArtDirectorOutput,
  provider: MediaProvider,
): Promise<MediaProductionResult> {
  const assets: GeneratedMediaAsset[] = [];
  const errors: MediaProductionResult['errors'] = [];

  const settled = await Promise.allSettled(
    artDirection.pieces.map((piece) => produceSinglePiece(piece, provider)),
  );

  settled.forEach((outcome, index) => {
    const piece = artDirection.pieces[index];
    if (outcome.status === 'fulfilled') {
      assets.push(outcome.value);
    } else {
      errors.push({
        format: piece.format,
        stage: piece.hasTextInArt ? 'typography_art' : 'key_visual',
        message: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      });
    }
  });

  return { artDirection, assets, errors };
}
