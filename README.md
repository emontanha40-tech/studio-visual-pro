# Studio Visual Pro — projeto inicial v0.1

Laboratório local funcional para iniciar o estúdio de criação de campanhas de Eduardo Montanha. Esta versão entrega código, painel, núcleo de regras e conhecimento inicial para continuar no VS Code. Não é uma plataforma pronta para clientes.

## Abrir no VS Code

1. Extraia o ZIP. Abra **a pasta que contém este package.json** em Arquivo → Abrir Pasta no VS Code. Se sua pasta já contém outro projeto, mantenha este pacote em uma subpasta separada; não sobrescreva arquivos.
2. Abra Terminal → Novo Terminal nessa pasta. Confira o caminho antes de executar. No PowerShell, use `Get-Location`; no macOS/Linux, `pwd`. Se estiver em um repositório, confira também `git status --short --branch`.
3. Verifique `node --version`: requisito de projeto Node.js 22 ou superior. Não é necessário instalar dependências deste pacote.
4. Execute:

```sh
npm test
npm start
```

5. Abra http://127.0.0.1:4173. Encerre com Ctrl+C.

O servidor escuta somente em 127.0.0.1. Não use túnel público, não faça deploy e não inclua dados de clientes nesta fase.

## Experimento de cinco minutos

- Clique em **Carregar exemplo fictício**.
- Aprove **Briefing**.
- Escolha uma das três direções.
- Aprove **Identidade**, depois **Conteúdo**, depois **Plano de produção**.
- Baixe o plano JSON e o briefing para IA.
- Altere o tema e aplique: as aprovações e a escolha são invalidadas.
- Adicione Backdrop sem especificações da gráfica: a autorização de produção deve ser bloqueada.

## O que funciona

- Checklist estruturado com 16 campos de texto, produtos e confirmação de direitos.
- Verificação de campos, datas, horários, pendências e alguns conflitos.
- Três estudos SVG programados para experimentar a escolha de direção.
- Aprovações por revisão, histórico em memória e invalidação de aprovações.
- Exportação do projeto, prompt de briefing e especificação de produção.
- Rascunho local opcional; ao recarregar, aprovações precisam ser refeitas.
- 21 testes automatizados (17 do núcleo e 4 HTTP), sem bibliotecas externas.

## Limites explícitos

- Não há modelo de IA conectado. As três prévias são **templates demonstrativos**, não conceitos gerados pela IA; as cores escolhidas no briefing ainda não alteram as prévias.
- Não gera kit gráfico final, PDF de impressão, fotos, vídeos, QR Code ou editáveis Canva/PSD.
- Não há upload de fotos nesta versão. O campo de referências recebe texto.
- Não processa pagamentos, não confirma Pix, não emite NFS-e e não faz upload para nuvem.
- Não há autenticação, isolamento de clientes, banco de dados, aceite jurídico ou assinatura digital. Estados no navegador são manipuláveis; nunca usar como autoridade comercial.
- A existência de printSpec não comprova conformidade técnica da gráfica. A validação técnica real ainda será implementada.
- Nenhuma conta externa, recurso remoto, repositório ou cobrança foi criado.
- Exportação JSON existe; importação pela interface fica para etapa futura. O módulo restoreDraft é usado apenas para o rascunho local.

## Estrutura

- `src/engine.mjs`: núcleo determinístico compartilhado pela interface e testes.
- `public/`: painel local responsivo.
- `knowledge/`: políticas, catálogo e briefing para alimentar o futuro orquestrador.
- `prompts/`: instruções por papel; não são treinamento de modelo.
- `docs/`: produto, arquitetura, produção, integrações, backlog e segurança.
- `PROMPT_VSCODE.md`: tarefa de continuidade para Codex ou Claude Code.
- `AGENTS.md`: regras de trabalho para agentes no repositório.

## Verificação

`npm test` executa os cenários de bloqueio, invalidação, conteúdo, escape de SVG e restauração. `npm run check` verifica sintaxe. Consulte `docs/VALIDACAO.md` para o registro exato desta entrega.

## Como alimentar o cérebro

Edite knowledge e prompts com exemplos **autorizados**, registrando motivo da aprovação/rejeição. A alteração desses arquivos ainda não muda automaticamente o painel. O primeiro trabalho do próximo ciclo será conectar essa base ao orquestrador no servidor, com validação de schema e testes. Não confunda arquivo de conhecimento com modelo treinado.

O projeto não inclui as artes de referência anexadas nem marcas oficiais: é necessário verificar licença antes de incorporá-las ao acervo comercial.
