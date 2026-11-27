# STATUS ATUAL — Studio Visual Pro

## Concluído
- Pipeline criativo multimodal completo em TypeScript (Node 22) + Zod integrado ao núcleo legado (`src/engine.mjs`).
- **5 motores de mídia (`src/services/ai-media/fal-provider.ts`):** Flux Pro v1.1, Ideogram v2, Google Imagen 3 (`fal-ai/imagen3`), Clarity Upscaler e Kling Video unificados sob `FAL_KEY`.
- **4 agentes orquestradores (`src/agents/`):** `artDirectorAgent`, `mediaProducerAgent`, `qaReviewerAgent` (QA Visual com visão computacional) e `showcaseBuilderAgent`, orquestrados por `src/queues/campaignQueue.ts`.
- **Servidor & Preview Web:** `server.mjs` conectado com `POST /api/campaigns`, `GET /api/campaigns/:id`, `GET /showcase` (`public/showcase.html` + `public/showcase.mjs`) e suporte a `BIND_HOST`/`ALLOWED_HOSTS`.
- **Validação & Git:** `npm run check` (`tsc --noEmit`) + 37/37 testes passando; tudo sincronizado com `origin/main` (commit `763fdb8`).
- **App no ar via Tailscale (iPhone):** `http://100.82.176.70:4173/` e `http://100.82.176.70:4173/showcase`.

## Falta fazer
- Configurar `FAL_KEY` e `GEMINI_API_KEY` no ambiente do servidor para o primeiro teste real de geração de imagens/vídeos.
- ~~Formulário na UI~~ feito em `/showcase` (dispara `POST /api/campaigns`); falta homologar no iPhone com `FAL_KEY` real.

## Fatia 9A — Catálogo unificado + fluxo em 2 etapas (2026-11-27)
- Concluído: `src/kit/` (catálogo de 8 peças: landing, feed, story, whatsapp, banner, telão c/ overscan 10%, slide-capa, slide-fundo; presets Culto/Série e Lançamento; identidade WCAG; foto por nicho via acervo local `assets/fotos/<nicho>/` ou Pexels com `PEXELS_API_KEY`; ZIP por pastas + manifesto). UI em `/kit`, API `/api/kit/{catalog,identity,build}`. Testes: `tests/kit.test.mjs`.
- Commit local das Fatias 4–9A salvo na branch `main` e acesso via Tailscale (`http://100.82.176.70:4173/kit` e `http://connect-projetos.tail9dcf54.ts.net:4173/kit`) liberado para iPhone e Dell (`ALLOWED_HOSTS` aceitando host com porta).
- Falta: rasterização PNG via Playwright (peças hoje são SVG), acervo de fotos curado em `assets/fotos/`, upload de foto do cliente, homologação visual no iPhone/Dell, impressos (9B) e Teaser 60s (9C).

## Fatia 9B — Impressos & Gráfica (2026-11-27)
- Concluído: 6 impressos no catálogo (`src/kit/catalog.mjs`): Convite frente/verso 100×150 mm, Bloco de Oração 148×210, Cartão de Decisão 148×105, Régua de Livro frente/verso 50×180, Backdrop 3200×1800 mm e Wind Banner 700×2000 mm (escala 1:10, 150 DPI, sangria 10 mm reais).
- `src/kit/print.mjs`: mm → px a 300 DPI (pequenos) com sangria de 3 mm; PNG com densidade `pHYs`; PDF via Playwright com marcas de corte vetoriais. ZIP: pasta `impressos/` (PNG + PDF por lado), manifesto com corte, sangria, escala, DPI e `gabarito_provisorio`. Seleção por checkbox em `/kit`.
- Testes: `tests/print.test.mjs` (geometria + render real). 100/100 testes e `npm run check` OK.
- Falta: homologar visual no iPhone/Dell; gabarito real da gráfica, perfil ICC (saída hoje em RGB) e prova visual aprovada; grandes formatos são prova 1:10 provisória; Teaser 60s (9C); rasterização PNG das peças digitais.

## Fatia 9C — Teaser 60s ✅ (2026-11-27)
- Concluído: `src/kit/teaser.mjs` (6 cenas de 10s via Playwright + MP4 H.264 via FFmpeg, 9:16 e 16:9, mesmos Brand Tokens/fontes locais/logo), fila única (1 render por vez, 429 se cheia), erro estruturado `ffmpeg_unavailable`/`chromium_unavailable`, rotas `/api/kit/teasers` (+`/video`), botão na UI `/kit`. Render real: 60s, ~17s de processamento por formato. Testes: `tests/teaser.test.mjs`.

## Consolidação Final (9B + 9C + PNG Retina + Acervo Local) ✅ (2026-11-27)
- Concluído: unificação 9B (Impressos) + 9C (Teaser 60s) na `main`; rasterização PNG Retina 2× via Playwright (`src/kit/raster.mjs`) para todas as peças digitais no ZIP (`/site/`, `/social/`, `/projecao/`, `/impressos/`, `/video/`, `/brand/`); acervo local curado em `assets/photos/` como fallback automático por nicho (`src/kit/photos.mjs`); checkbox para incluir Teaser 60s direto no ZIP em `/kit`.
- Validação: `npm run check` + **108/108** testes passando (`tests/kitExport.test.mjs` incluído). Serviço `studio-visual-pro.service` reiniciado e validado em `http://100.82.176.70:4173/kit`.
- Falta: teste real completo e homologação visual no iPhone via `http://100.82.176.70:4173/kit`.
