export * from './types.ts';
export { FAL_MODELS, FalMediaProvider } from './fal-provider.ts';
export type { FalProviderOptions } from './fal-provider.ts';

import { FalMediaProvider, type FalProviderOptions } from './fal-provider.ts';
import type { MediaProvider } from './types.ts';

export function createMediaProvider(options?: FalProviderOptions): MediaProvider {
  return new FalMediaProvider(options);
}
