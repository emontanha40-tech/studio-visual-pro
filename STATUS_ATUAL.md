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
