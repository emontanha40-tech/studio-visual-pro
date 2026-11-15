# Ambiente de trabalho dos agentes

Base: recomendações do documento Meu-Assessor-proximos-passos.pdf fornecido pelo proprietário, adaptadas ao Studio Visual Pro.

## Arquivos compartilhados
- AGENTS.md: regras de escopo e engenharia, preservando as regras existentes.
- CLAUDE.md: importa AGENTS.md para Claude Code.
- PROGRESSO.md: passagem de contexto entre sessões e ferramentas.
- IDEIAS.md: fila de possibilidades fora da tarefa corrente.
- opencode.json: quando não existir configuração anterior, inclui apenas PROGRESSO.md como instrução adicional. AGENTS.md é descoberto pelo próprio OpenCode.

## Ciclo de uma tarefa
Definir Objetivo, Visto, Limite e Pronto quando. Inspecionar a fonte, propor um plano curto e implementar dentro da autorização recebida. Executar testes relevantes e npm run check. Revisar a evidência e atualizar PROGRESSO.md. Salvar checkpoint no Git somente dentro da autorização do proprietário. Manter tarefas dependentes na mesma conversa e preparar a passagem quando trocar de ferramenta.

## OpenCode e OpenRouter
Abrir o OpenCode na pasta exata do projeto. Conectar OpenRouter pela interface da ferramenta e inserir a chave somente no mecanismo de autenticação oferecido. Selecionar o modelo na lista real da conta. Definir limite de gasto no provedor e conferir se ele é bloqueio efetivo ou apenas alerta antes de depender desse limite. Nada nesta preparação conecta a conta, altera autenticação, seleciona modelo ou efetua chamadas pagas.

Plan é adequado ao diagnóstico. Build é adequado à implementação autorizada. Conferir os nomes e atalhos da versão instalada. Uma instrução em Markdown é orientação para o agente, não isolamento de segurança.

## Exemplo de missão no chat do agente
OBJETIVO: conferir o ambiente e o acervo instalado.
VISTO: ler AGENTS.md, PROGRESSO.md e a habilidade local indicada no projeto.
LIMITE: somente leitura, sem serviços pagos, sem alterar Git ou arquivos.
PRONTO QUANDO: informar quais instruções carregou, o estado real do projeto e a menor próxima tarefa verificável.

## Verificações
O instalador confere a pasta e a identidade do package.json, preserva arquivos existentes diferentes, inclui referências e executa npm test e npm run check depois de gravar. A aceitação humana consiste em iniciar uma sessão e pedir ao agente que informe os arquivos consultados e a tarefa atual.

Git e backup remoto continuam pendentes até serem configurados e verificados. Não inicializar repositório dentro de outro, não publicar o acervo comprado e não incluir credenciais no histórico.

Fontes de configuração consultadas: https://opencode.ai/docs/config e https://opencode.ai/docs/instructions .
