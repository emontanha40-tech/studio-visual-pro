import type {
  MediaProductionResult,
  ShowcaseOutput,
  ShowcaseSlide,
} from '../types/campaign.ts';

/**
 * Agente 3 — Montador de Apresentação & Web (`showcaseBuilderAgent`).
 * Transforma os ativos gerados em:
 * 1. JSON de apresentação com transições cinematográficas (vídeos como background).
 * 2. Especificação de preview web interativo (React/Tailwind) para aprovação do cliente.
 */
export function showcaseBuilderAgent(production: MediaProductionResult): ShowcaseOutput {
  const { artDirection, assets } = production;

  const slides: ShowcaseSlide[] = assets.map((asset, index) => {
    const piece = artDirection.pieces.find((p) => p.format === asset.format);
    const hasVideo = Boolean(asset.videoUrl);
    return {
      id: `slide-${index + 1}-${asset.format}`,
      title: piece?.headline ?? artDirection.visualConcept.title,
      subtitle: piece?.subheadline,
      backgroundUrl: asset.videoUrl ?? asset.upscaledUrl ?? asset.url,
      backgroundType: hasVideo ? 'video' : 'image',
      transition: index === 0 ? 'cinematic-zoom' : hasVideo ? 'fade' : 'parallax-slide',
      durationMs: hasVideo ? 6000 : 4500,
      assetFormat: asset.format,
    };
  });

  const primaryColor =
    artDirection.palette.find((c) => c.role === 'primary')?.hex ?? '#152c36';
  const accentColor =
    artDirection.palette.find((c) => c.role === 'accent')?.hex ?? '#c5ad7a';
  const backgroundColor =
    artDirection.palette.find((c) => c.role === 'background')?.hex ?? '#0f172a';

  const heroAsset =
    assets.find((a) => a.format === 'banner_web' && a.videoUrl) ??
    assets.find((a) => a.videoUrl) ??
    assets[0];

  return {
    presentation: {
      campaignTitle: artDirection.visualConcept.title,
      palette: artDirection.palette,
      typography: artDirection.typography,
      slides,
    },
    webPreviewSpec: {
      heroHeadline: artDirection.visualConcept.title,
      heroSubheadline: artDirection.visualConcept.rationale,
      heroBackgroundUrl: heroAsset?.videoUrl ?? heroAsset?.url ?? '',
      heroBackgroundType: heroAsset?.videoUrl ? 'video' : 'image',
      primaryColor,
      accentColor,
      backgroundColor,
      galleryAssets: assets,
    },
  };
}
