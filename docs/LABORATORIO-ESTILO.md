# Laboratório de Estilo

Abra `/estilo` no Studio Visual Pro. Escolha uma URL, uma imagem ou um MP4, examine a prévia e dê um nome ao preset. Depois de salvar, **Usar agora no Kit em Lote** abre o `/kit` com o modelo selecionado. O SQLite usa `data/studio.db` por padrão e aceita `STUDIO_DB_PATH` no servidor.

- **Site** – o Chromium mede estilos do HTML inicial e de folhas CSS públicas. Páginas que montam o conteúdo via JavaScript podem produzir uma amostra parcial. A busca opera por IPv4 público e aplica limites de tamanho e tempo.
- **Imagem** – aceita PNG, JPEG e WebP até 8 MB. O FFmpeg mede a paleta localmente. Quando o Gemini Vision está ativado, a referência também é enviada ao provedor para analisar composição, respiro, contraste, fotografia e hierarquia.
- **Vídeo** – aceita MP4 até 25 MB e três minutos. O FFmpeg detecta cortes e mede o intervalo médio. O laboratório exibe até três quadros representativos. A análise visual usa um desses quadros. O Teaser 60s adapta a quantidade de cenas e as transições ao ritmo medido dentro dos limites do renderizador.

O DNA preserva as medições de referência. O Kit aplica cores, tipografia e medidas compatíveis com cada template e mantém os padrões de movimento dos componentes da Constituição Visual. O banco guarda o DNA e o preset. As imagens de prévia ficam na resposta da extração.

O uso do Gemini depende de `STYLE_LAB_ENABLE_VISION=1` e `GEMINI_API_KEY` no servidor. Ative após confirmar o orçamento e a permissão para enviar as referências. Cada extração usa até uma chamada, com timeout de 20 segundos e limite de saída. A homologação roda em loopback com Vision desativado e valida o caminho local. O contrato HTTP do provedor é testado com uma resposta simulada.
