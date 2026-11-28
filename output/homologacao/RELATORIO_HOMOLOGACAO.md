# Relatório de Homologação E2E — Studio Visual Pro

Gerado em 2026-11-27T21:18:51.016Z por `npm run homologar`.

**Resultado: REPROVADO (1 falha(s))** — 83/84 verificações automáticas.

> Isto é teste automatizado em Chromium (loopback, 1440px + 390px). **Não substitui** a homologação visual humana no iPhone/Dell.

| Área | Verificação | Resultado | Detalhe |
|---|---|---|---|
| desktop-1440 | 5 direções de arte nativas no seletor | ✅ | tech-cinematografico, editorial-clean, comercial-conversao, ministerial-serie, minimalista-suico |
| desktop-1440 | /kit sem overflow horizontal em 1440px | ✅ |  |
| desktop-1440 | /estilo sem overflow horizontal em 1440px | ✅ |  |
| estilo | Extrai CSS externo, escala, raio, sombra e curva completa | ✅ |  |
| estilo | Mede paleta da imagem em FFmpeg e exibe aviso do modo local | ✅ |  |
| estilo | Detecta corte, mede ritmo e extrai quadros representativos | ✅ |  |
| desktop-1440 | Preset SQLite selecionado automaticamente no /kit | ✅ |  |
| estilo | Ritmo armazenado no preset | ✅ |  |
| kit | peça landing no catálogo da tela | ✅ |  |
| kit | peça linktree no catálogo da tela | ✅ |  |
| kit | peça hotsite no catálogo da tela | ✅ |  |
| kit | peça email-kit no catálogo da tela | ✅ |  |
| kit | peça lower-third no catálogo da tela | ✅ |  |
| kit | peça welcome-countdown no catálogo da tela | ✅ |  |
| desktop-1440 | Lote completo gerado e baixado em 1440px | ✅ | Pronto: 19 peças no ZIP. Abrir Site ao Vivo |
| historico | Campanha recente listada no /kit com marca e título | ✅ |  |
| historico | Link direto do Site ao Vivo publicado responde HTTP 200 | ✅ | /published/igreja-vida-nova-9a31cf/ |
| historico | Botão Duplicar Briefing restaura marca e preset visual | ✅ | Igreja Vida Nova / custom-ritmo-de-homologacao |
| mobile-390 | /estilo sem overflow horizontal em 390px (iPhone) | ✅ |  |
| mobile-390 | Fluxo /estilo -> salvar preset -> /kit funciona em 390px | ✅ |  |
| mobile-390 | /kit sem overflow horizontal em 390px (iPhone) | ✅ |  |
| mobile-390 | ZIP gerado e baixado em 390px (assinatura PK válida) | ✅ | 4782493 bytes |
| mobile-390 | Campanhas Recentes atualiza sem overflow em 390px | ✅ |  |
| zip | manifesto com 19 peças | ✅ | 19 itens, 48 arquivos |
| zip | PNG Retina feed | ✅ | 2160x2700 |
| zip | PNG Retina story | ✅ | 2160x3840 |
| zip | PNG Retina whatsapp | ✅ | 2160x2160 |
| zip | PNG Retina banner | ✅ | 2400x1256 |
| zip | PNG Retina screen | ✅ | 3840x2160 |
| zip | PNG Retina slide-capa | ✅ | 3840x2160 |
| zip | PNG Retina slide-fundo | ✅ | 3840x2160 |
| zip | PNG Retina lower-third | ✅ | 3840x2160 |
| zip | PNG Retina welcome-countdown | ✅ | 3840x2160 |
| zip | Lower Third 1920x1080 @2x com canal alfa | ✅ | color type 6 |
| zip | PDF válido impressos/backdrop-frente.pdf | ✅ | 15362 bytes |
| zip | PDF válido impressos/bookmark-frente.pdf | ✅ | 22506 bytes |
| zip | PDF válido impressos/bookmark-verso.pdf | ✅ | 14943 bytes |
| zip | PDF válido impressos/decision-frente.pdf | ✅ | 21501 bytes |
| zip | PDF válido impressos/invitation-frente.pdf | ✅ | 24871 bytes |
| zip | PDF válido impressos/invitation-verso.pdf | ✅ | 17308 bytes |
| zip | PDF válido impressos/prayer-frente.pdf | ✅ | 21427 bytes |
| zip | PDF válido impressos/wind-frente.pdf | ✅ | 15354 bytes |
| zip | PNG de impresso impressos/backdrop-frente.png | ✅ | 1902x1075 |
| zip | PNG de impresso impressos/bookmark-frente.png | ✅ | 661x2197 |
| zip | PNG de impresso impressos/bookmark-verso.png | ✅ | 661x2197 |
| zip | PNG de impresso impressos/decision-frente.png | ✅ | 1819x1311 |
| zip | PNG de impresso impressos/invitation-frente.png | ✅ | 1252x1843 |
| zip | PNG de impresso impressos/invitation-verso.png | ✅ | 1252x1843 |
| zip | PNG de impresso impressos/prayer-frente.png | ✅ | 1819x2551 |
| zip | PNG de impresso impressos/wind-frente.png | ✅ | 425x1193 |
| zip | MP4 codec H.264 | ✅ | h264 720x1280 |
| zip | MP4 duração ≈ 60 s | ✅ | 60.0 s |
| zip | arquivo site/landing/index.html | ✅ |  |
| zip | arquivo site/linktree/index.html | ✅ |  |
| zip | arquivo site/hotsite/index.html | ✅ |  |
| zip | arquivo site/email-kit/assinatura-email.html | ✅ |  |
| zip | arquivo site/email-kit/cabecalho-newsletter.html | ✅ |  |
| zip | e-mail sem <script> e com estilos inline | ✅ |  |
| landing-1440 | hero visível após entrada (sem blur) | ✅ | {"op":1,"blur":"blur(0px)"} |
| landing-1440 | sem overflow horizontal | ✅ |  |
| landing-1440 | coreografia de scroll revela blocos | ✅ | 7/7 |
| landing-1440 | sem erros de JavaScript | ✅ |  |
| landing-1440 | ?static=true deixa 100% visível | ✅ | 0 invisíveis |
| hotsite-1440 | hero visível após entrada (sem blur) | ✅ | {"op":1,"blur":"blur(0px)"} |
| hotsite-1440 | sem overflow horizontal | ✅ |  |
| hotsite-1440 | coreografia de scroll revela blocos | ✅ | 10/10 |
| hotsite-1440 | header glassmorphism blur(16px) | ✅ | blur(16px) saturate(1.5) |
| hotsite-1440 | abas de programação alternam painel | ✅ |  |
| hotsite-1440 | acordeão da programação abre | ✅ |  |
| hotsite-1440 | sem erros de JavaScript | ✅ |  |
| hotsite-1440 | ?static=true deixa 100% visível | ✅ | 0 invisíveis |
| hotsite-390 | hero visível após entrada (sem blur) | ✅ | {"op":1,"blur":"blur(0px)"} |
| hotsite-390 | sem overflow horizontal | ✅ |  |
| hotsite-390 | coreografia de scroll revela blocos | ✅ | 10/10 |
| hotsite-390 | header glassmorphism blur(16px) | ✅ | blur(16px) saturate(1.5) |
| hotsite-390 | abas de programação alternam painel | ✅ |  |
| hotsite-390 | acordeão da programação abre | ✅ |  |
| hotsite-390 | sem erros de JavaScript | ✅ |  |
| hotsite-390 | ?static=true deixa 100% visível | ✅ | 0 invisíveis |
| linktree-390 | hero visível após entrada (sem blur) | ✅ | {"op":1,"blur":"blur(0px)"} |
| linktree-390 | sem overflow horizontal | ✅ |  |
| linktree-390 | coreografia de scroll revela blocos | ❌ | 4/5 faltam: Como chegar ao localAv. Paulis@924/1102 |
| linktree-390 | sem erros de JavaScript | ✅ |  |
| linktree-390 | ?static=true deixa 100% visível | ✅ | 0 invisíveis |

## Screenshots (output/homologacao/screenshots/)
- 00-laboratorio-de-estilo-1440.png
- 01-kit-etapa1-1440.png
- 02-kit-etapa2-1440.png
- 03-campanhas-recentes-1440.png
- 04-estilo-mobile-390.png
- 05-kit-mobile-390.png
- hotsite-1440-01-hero.png
- hotsite-390-01-hero.png
- landing-1440-01-hero.png
- linktree-390-01-hero.png
