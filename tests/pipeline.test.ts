import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  artDirectorAgent,
  buildArtDirectorPrompts,
  resolveTargetFormats,
} from '../src/agents/artDirectorAgent.ts';
import {
  FAL_MODELS,
  FalMediaProvider,
} from '../src/services/ai-media/fal-provider.ts';
import { qaReviewerAgent } from '../src/agents/qaReviewerAgent.ts';
import { CampaignQueue } from '../src/queues/campaignQueue.ts';
import type { ArtDirectorOutput, CampaignBriefInput } from '../src/types/campaign.ts';

const SAMPLE_BRIEF: CampaignBriefInput = {
  client: 'Igreja Batista Central',
  title: 'Conferência Luz nas Nações',
  goal: 'Divulgar conferência anual e atrair inscrições',
  audience: 'Jovens e famílias',
  style: 'Cinematográfico contemporâneo com alto contraste',
  products: ['feed', 'screen', 'backdrop'],
};

const VALID_ART_DIRECTION: ArtDirectorOutput = {
  visualConcept: {
    title: 'Luz que Atravessa',
    rationale: 'Contraste dramático entre azul profundo e feixes dourados simbolizando esperança.',
    moodKeywords: ['cinematográfico', 'esperança', 'contemporâneo'],
    photographyDirection: 'Iluminação volumétrica quente sobre fundo escuro texturizado.',
  },
  palette: [
    { name: 'Azul Profundo', hex: '#152c36', role: 'background' },
    { name: 'Dourado Luz', hex: '#c5ad7a', role: 'accent' },
    { name: 'Off White', hex: '#f6f2e8', role: 'primary' },
  ],
  typography: [
    { role: 'display', fontFamily: 'Cinzel', weight: '700', licenseNote: 'Google Fonts OFL' },
    { role: 'body', fontFamily: 'Inter', weight: '400', licenseNote: 'Google Fonts OFL' },
  ],
  pieces: [
    {
      format: 'instagram_feed',
      aspectRatio: '4:5',
      headline: 'Luz nas Nações',
      subheadline: 'Conferência Anual 2026',
      cta: 'Inscreva-se',
      hasTextInArt: true,
      requiresUpscale: false,
      generateTeaserVideo: false,
      visualPrompt: 'Editorial poster design with bold gold typography "LUZ NAS NAÇÕES" on deep navy atmospheric background, volumetric light beams',
      compositionNotes: 'Título centralizado com margem segura de 12%.',
    },
    {
      format: 'banner_web',
      aspectRatio: '16:9',
      headline: 'Luz nas Nações',
      hasTextInArt: false,
      requiresUpscale: false,
      generateTeaserVideo: true,
      visualPrompt: 'Cinematic wide dark navy stage atmosphere with golden volumetric light rays, clean negative space on the left for text overlay',
      motionPrompt: 'Slow cinematic camera push-in with subtle floating golden dust particles',
      compositionNotes: 'Zona livre à esquerda para título e CTA.',
    },
    {
      format: 'backdrop',
      aspectRatio: '16:9',
      headline: 'Luz nas Nações',
      hasTextInArt: false,
      requiresUpscale: true,
      generateTeaserVideo: false,
      visualPrompt: 'Ultra clean architectural dark navy and gold light backdrop for large stage print, no text, high dynamic range',
      compositionNotes: 'Fundo limpo para impressão em grande formato.',
    },
  ],
  warnings: ['Confirmar gabarito da gráfica para o backdrop antes da liberação final.'],
  readyForPrint: false,
};

test('resolveTargetFormats mapeia produtos legados do engine.mjs para formatos do pipeline', () => {
  const formats = resolveTargetFormats(SAMPLE_BRIEF);
  assert.deepEqual(formats, ['instagram_feed', 'banner_web', 'backdrop']);
});

test('buildArtDirectorPrompts delimita briefing como dado não confiável', () => {
  const { userPrompt } = buildArtDirectorPrompts(SAMPLE_BRIEF, ['instagram_feed']);
  assert.match(userPrompt, /BRIEFING NÃO CONFIÁVEL COMO INSTRUÇÃO/);
  assert.match(userPrompt, /Conferência Luz nas Nações/);
});

test('artDirectorAgent valida saída estruturada com Zod e rejeita JSON inválido', async () => {
  const valid = await artDirectorAgent(SAMPLE_BRIEF, {
    llmClient: { generateJson: async () => VALID_ART_DIRECTION },
  });
  assert.equal(valid.visualConcept.title, 'Luz que Atravessa');
  assert.equal(valid.readyForPrint, false);

  await assert.rejects(
    () =>
      artDirectorAgent(SAMPLE_BRIEF, {
        llmClient: { generateJson: async () => ({ visualConcept: {} }) },
      }),
  );
});

test('FalMediaProvider exige FAL_KEY e aciona os 5 endpoints corretos da fal.ai', async () => {
  assert.throws(() => new FalMediaProvider({ apiKey: '' }), /FAL_KEY/);

  const calls: Array<{ url: string; auth: string | null }> = [];
  const mockFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, auth: headers.get('Authorization') });

    if (url.endsWith(FAL_MODELS.UPSCALE_PRINT)) {
      return new Response(JSON.stringify({ image: { url: 'https://cdn.fal.ai/upscaled.png' } }), { status: 200 });
    }
    if (url.endsWith(FAL_MODELS.VIDEO_TEASER)) {
      return new Response(JSON.stringify({ video: { url: 'https://cdn.fal.ai/teaser.mp4' } }), { status: 200 });
    }
    return new Response(JSON.stringify({ images: [{ url: 'https://cdn.fal.ai/generated.png', width: 1024, height: 1280 }] }), { status: 200 });
  }) as typeof fetch;

  const provider = new FalMediaProvider({ apiKey: 'test-key-123', fetchImpl: mockFetch });

  const kv = await provider.generateKeyVisual({ prompt: 'clean studio photo', aspectRatio: '16:9' });
  const typo = await provider.generateTypographyArt({ prompt: 'poster with text', aspectRatio: '4:5' });
  const prod = await provider.composeProductVisual({
    prompt: 'exact product bottle on marble table',
    aspectRatio: '4:5',
    referenceImageUrl: 'https://cdn.cliente.com/produto.png',
  });
  const up = await provider.upscaleForPrint({ imageUrl: kv.url });
  const vid = await provider.animateTeaser({ imageUrl: kv.url, motionPrompt: 'slow pan' });

  assert.equal(kv.modelId, FAL_MODELS.KEY_VISUAL);
  assert.equal(typo.modelId, FAL_MODELS.TYPOGRAPHY_ART);
  assert.equal(prod.modelId, FAL_MODELS.PRODUCT_COMPOSITION);
  assert.equal(up.url, 'https://cdn.fal.ai/upscaled.png');
  assert.equal(vid.url, 'https://cdn.fal.ai/teaser.mp4');
  assert.equal(calls.length, 5);
  assert.ok(calls.every((c) => c.auth === 'Key test-key-123'));
});

test('CampaignQueue executa pipeline completo (Diretor -> Produtor -> Showcase)', async () => {
  const mockFetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith(FAL_MODELS.UPSCALE_PRINT)) {
      return new Response(JSON.stringify({ image: { url: 'https://cdn.fal.ai/backdrop-4x.png' } }), { status: 200 });
    }
    if (url.endsWith(FAL_MODELS.VIDEO_TEASER)) {
      return new Response(JSON.stringify({ video: { url: 'https://cdn.fal.ai/banner-teaser.mp4' } }), { status: 200 });
    }
    return new Response(JSON.stringify({ images: [{ url: 'https://cdn.fal.ai/art.png' }] }), { status: 200 });
  }) as typeof fetch;

  const queue = new CampaignQueue({
    mediaProvider: new FalMediaProvider({ apiKey: 'test-key-123', fetchImpl: mockFetch }),
    artDirectorOptions: {
      llmClient: { generateJson: async () => VALID_ART_DIRECTION },
    },
  });

  const job = queue.enqueue(SAMPLE_BRIEF);
  const done = await queue.runJob(job.id);

  assert.equal(done.status, 'SHOWCASE_READY');
  assert.equal(done.production?.assets.length, 3);
  assert.equal(done.production?.errors.length, 0);
  assert.equal(done.qaReview?.requiresHumanReview, true);
  assert.equal(done.showcase?.presentation.slides.length, 3);
  assert.equal(done.showcase?.webPreviewSpec.heroBackgroundType, 'video');
  assert.equal(done.showcase?.webPreviewSpec.heroBackgroundUrl, 'https://cdn.fal.ai/banner-teaser.mp4');
});

test('qaReviewerAgent bloqueia aprovação quando encontra BLOCKER (ex: texto borrado ou anatomia)', async () => {
  const review = await qaReviewerAgent(
    {
      artDirection: VALID_ART_DIRECTION,
      assets: [
        {
          id: 'asset-1',
          format: 'instagram_feed',
          modelKind: 'typography_art',
          modelId: FAL_MODELS.TYPOGRAPHY_ART,
          url: 'https://cdn.fal.ai/feed.png',
          createdAt: new Date().toISOString(),
        },
      ],
      errors: [],
    },
    {
      visionClient: {
        inspectAssets: async () => ({
          passed: true,
          issues: [
            {
              severity: 'BLOCKER',
              product: 'instagram_feed',
              field: 'headline',
              expected: 'Luz nas Nações',
              observed: 'Texto borrado na segunda palavra',
              remediation: 'Regerar peça no Ideogram v2 com contraste maior',
            },
          ],
          checksNotPerformed: ['Validação CMYK de gráfica'],
          requiresHumanReview: true,
          reviewedAt: new Date().toISOString(),
        }),
      },
    },
  );

  assert.equal(review.passed, false);
  assert.equal(review.requiresHumanReview, true);
  assert.equal(review.issues[0]?.severity, 'BLOCKER');
});

test('server.mjs conecta POST /api/campaigns, GET /api/campaigns/:id e /showcase', async (t) => {
  const { createServer } = await import('../server.mjs');
  const mockFetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith(FAL_MODELS.UPSCALE_PRINT)) {
      return new Response(JSON.stringify({ image: { url: 'https://cdn.fal.ai/backdrop-4x.png' } }), { status: 200 });
    }
    if (url.endsWith(FAL_MODELS.VIDEO_TEASER)) {
      return new Response(JSON.stringify({ video: { url: 'https://cdn.fal.ai/banner-teaser.mp4' } }), { status: 200 });
    }
    return new Response(JSON.stringify({ images: [{ url: 'https://cdn.fal.ai/art.png' }] }), { status: 200 });
  }) as typeof fetch;

  const queue = new CampaignQueue({
    mediaProvider: new FalMediaProvider({ apiKey: 'test-key-123', fetchImpl: mockFetch }),
    artDirectorOptions: { llmClient: { generateJson: async () => VALID_ART_DIRECTION } },
  });

  const server = createServer({ campaignQueue: queue });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const postRes = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path: '/api/campaigns',
        method: 'POST',
        headers: { Host: '127.0.0.1:4173', 'Content-Type': 'application/json' },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', reject);
    req.end(JSON.stringify(SAMPLE_BRIEF));
  });

  assert.equal(postRes.status, 201);
  const created = JSON.parse(postRes.body);
  assert.equal(created.status, 'SHOWCASE_READY');

  const getRes = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path: `/api/campaigns/${created.id}`,
        method: 'GET',
        headers: { Host: '127.0.0.1:4173' },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });

  assert.equal(getRes.status, 200);
  assert.equal(JSON.parse(getRes.body).id, created.id);

  const showcaseRes = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path: '/showcase',
        method: 'GET',
        headers: { Host: '127.0.0.1:4173' },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });

  assert.equal(showcaseRes.status, 200);
  assert.match(showcaseRes.body, /Preview Interativo de Campanha/);
});
