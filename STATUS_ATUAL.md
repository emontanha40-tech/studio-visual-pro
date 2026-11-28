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

## Fatia 10 — Shell Unificado + Redesign Pro da Tela `/kit` ✅ (2026-11-27)
- Concluído: sidebar única (`public/shell.mjs`) aplicada em `/`, `/kit`, `/website` e `/showcase` com os 7 itens (`01 Briefing` a `07 Kit em Lote`), destaque de rota ativa e menu recolhível no mobile; remoção do aviso legado da tela principal; redesign da tela `/kit` com grid responsivo de 2 colunas, labels superiores em caixa alta, inputs `44px`, card **Briefing Inteligente (1 Clique)** conectado a `POST /api/kit/ai-fill`, hierarquia de botões com SVG e peças selecionáveis em grid de cards (3/2/1 colunas).
- Validação: `npm run check` + **109/109** testes passando (`tests/kit.test.mjs`), serviço `studio-visual-pro.service` reiniciado e smoke test HTTP 200 nas rotas `/`, `/kit`, `/website`, `/showcase` e `/shell.mjs`.
- Falta: homologação visual no iPhone (`http://100.82.176.70:4173/kit`) e teste real do fluxo completo de geração de lote.

## Fatia 11 — Bloco 1/3: Constituição Visual & Motion (2026-11-27)
- Concluído: `src/engine/design-constitution.mjs` (CSS+JS+shell) injetado em toda landing (`generateHtml`, `generateLandingPackage`): header glass com progresso de scroll, hero stagger blur-to-sharp + parallax, reveal opacity/translateY/scale, shimmer/glow nos cards, FAQ animado, cronograma opcional (`schedule`), drawer de inscrição (sem envio falso; WhatsApp só se `whatsapp` informado). `?static=true`/reduced-motion = tudo visível.
- Testes: 113/113 + `npm run check` limpo; smoke em Chromium sem erros JS. Novo: `tests/designConstitution.test.mjs`.

## Fatia 11 — Bloco 2/3: Expansão WEB, Projeção e 5 Modelos Visuais (2026-11-27)
- Concluído: `src/kit/webTemplates.mjs` (Linktree Pro mobile-first e Hotsite de Evento com abas/acordeão/localização usando Constituição Visual & Motion + Kit de E-mail com Assinatura HTML e Cabeçalho de Newsletter copiáveis); `src/kit/render.mjs` + `src/kit/raster.mjs` (Lower Third 1920×1080 PNG RGBA com fundo transparente via `omitBackground: true` + Tela de Boas-Vindas / Contagem Regressiva 1920×1080); `src/website/brandKit.mjs` + `public/kit.html` + `server.mjs` (5 direções de arte: Editorial Luxo, Tech Cinema, Alta Conversão, Ministerial / Série e Minimalista Suíço).
- Testes: `tests/kitExpansion.test.mjs` + suíte completa + `npm run check`.
- Falta: Bloco 3/3 da Fatia 11 e homologação visual no iPhone.

## Fatia 11 — Bloco 3/3: Homologação E2E em Chromium
- `npm run homologar` inicia o Studio em loopback, preenche o briefing fictício e baixa o ZIP das 19 peças com teaser. Requer Node 22+, Chromium do Playwright, Python 3, FFmpeg com libx264 e ffprobe.
- Validação local aprovada: 118/118 testes, `npm run check`, PNG Retina 2×, oito PDFs, teaser H.264 de 60 s e interações nos três sites. Relatório e oito capturas em `output/homologacao/`.
- Inspeção da captura móvel: logo do cabeçalho do Hotsite fica truncado a 390 px. Revisão visual em iPhone/Dell e reinício do serviço principal pendentes da integração fora do worktree.

## Fechamento Fatia 11 + Fatia 12 — Consolidação dos 3 Blocos ✅ (2026-11-27)
- **Bloco 1/3 (Hotsite Mobile 390px):** cabeçalho mobile corrigido em `src/kit/webTemplates.mjs` (logo flexível, botão compacto e quebra de texto sem overflow horizontal), coberto por `tests/kitExpansion.test.mjs`.
- **Bloco 2/3 (Regra Global de Design & Motion):** Constituição Padrão de Interface, Design & Motion registrada permanentemente em `AGENTS.md`, `GEMINI.md`, `CLAUDE.md` e `docs/CONSTITUICAO-DESIGN-MOTION.md`.
- **Bloco 3/3 (Fatia 12 — Laboratório de Estilo):** rota `/estilo` (`public/estilo.html`, `public/estilo.mjs`), extratores de URL, imagem e vídeo (`src/style-lab/`), persistência SQLite, integração com `/kit` e documentação em `docs/LABORATORIO-ESTILO.md` (`tests/styleLab.test.mjs`).
- **Validação final:** `npm run check` (`tsc --noEmit` + sintaxe) OK, **127/127** testes passando, zero segredos expostos, rotas ao vivo HTTP 200 em `http://100.82.176.70:4173/kit` e `http://100.82.176.70:4173/estilo`.
- **Falta fazer:** homologação visual no iPhone em `/kit` e `/estilo`; configurar `FAL_KEY` / `GEMINI_API_KEY` (e `STYLE_LAB_ENABLE_VISION=1` quando autorizado orçamento) para testes com IA paga; replicação opcional das regras globais fora do repositório.

## Bloco 3 — auditoria de continuidade (2026-11-27)

- A Constituição e os blocos de AGENTS.md, GEMINI.md e CLAUDE.md foram conferidos na raiz e nos destinos do workspace. A auditoria encontrou 21/21 diretórios completos (84 arquivos no inventário atual).
- Campanhas Recentes está ativa em `/kit`. A API retornou HTTP 200 via Tailscale e o botão Duplicar Briefing restaurou a marca no navegador. O SQLite de teste recuperou o briefing após reinício do servidor de laboratório.
- A homologação usa uma pasta isolada por execução em `output/homologacao-*/` e leva a rolagem até o fim da página em cada site testado. A checagem focal do Linktree confirmou 5/5 revelações em 390 px.
- `npm run check` aprovado e `npm test` com 130/130 testes. A aplicação da alteração no projeto principal segue o fluxo de revisão do worktree.
- `npm run homologar` aprovado em 84/84 verificações com teaser H.264, fluxo `/estilo → /kit` em 1440 px e 390 px e download dos dois ZIPs.

- Checkpoint automático Assessor Studio (2026-11-28 02:45 UTC).

- Checkpoint automático Assessor Studio (2026-11-28 02:45 UTC).

- Checkpoint automático Assessor Studio (2026-11-28 02:48 UTC).
