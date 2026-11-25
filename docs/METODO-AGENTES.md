# Método comum de desenvolvimento com agentes

## Início e contexto
Confirmar caminho físico, projeto, branch, alterações locais e ambiente usando os mecanismos autorizados do projeto. Ler AGENTS.md, PROGRESSO.md, README e os documentos pertinentes. As restrições específicas de cada projeto permanecem válidas. Não importar permissões de outro projeto nem presumir proteção equivalente.

## Uma missão por vez
Usar Objetivo, Visto, Limite e Pronto quando. Planejar no agente que acessa os arquivos e executar dentro do escopo autorizado. Não pedir confirmação novamente por cada comando rotineiro já autorizado. Parar por informação indispensável, conflito real ou ação sensível fora do escopo. Não ampliar o trabalho para ideias paralelas.

## Entrega e evidência
Diagnosticar na fonte. Escolher a menor mudança coerente com a arquitetura existente. Executar testes relevantes e as verificações previstas no projeto; não repetir testes sem mudança ou dúvida nova. Registrar resultados realmente executados, diferenciando resultado anterior, teste atual e homologação humana. Não concluir sucesso por ausência de erros aparentes ou pela própria declaração do agente. Revisar alterações relevantes de forma independente antes de produção.

## Continuidade
Atualizar PROGRESSO.md ao concluir uma etapa ou passar para outra ferramenta: objetivo atual, arquivos alterados, evidências, testes, bloqueios e próxima tarefa. Guardar decisões em docs/ e ideias em IDEIAS.md. Manter tarefas dependentes na mesma conversa. Para tarefa independente, fazer checkpoint e iniciar uma conversa adequada após conferir os comandos da ferramenta; não usar /clear automaticamente nem eliminar contexto útil.

## Preservação e Git
Preservar trabalho existente, inclusive arquivos não rastreados. Não executar limpeza, descarte, reset --hard, git clean, exclusão ou alteração de branch sem autorização específica. Não versionar arquivos apenas porque parecem temporários nem apagá-los por esse motivo. Git e backup são verificados separadamente: commit local não comprova backup externo, .gitignore não retira segredos já rastreados, e backup só está confirmado com destino e evidência. Fazer commit ou push apenas dentro da autorização e das regras locais. Nunca adicionar todo o projeto indiscriminadamente.

## Dados, permissões e custos
Não ler nem expor credenciais para diagnosticar o ambiente. Não copiar .env, dados reais ou arquivos privados entre projetos. Usar dados sintéticos para desenvolvimento. Não enviar mensagens, alterar agenda real, executar migrações, ativar pagamentos ou publicar sem escopo específico. Modelo, provedor, limite de gasto e integrações dependem da missão e da conta; não ficam habilitados por estas instruções. Não remover guardas ou limpar variáveis para contornar recusa. Arquivos Markdown orientam agentes, mas não são isolamento de segurança.

## Troca de ferramenta
Codex e OpenCode devem usar AGENTS.md. CLAUDE.md deve encaminhar às regras sem perder instruções anteriores. GEMINI.md fornece o mesmo encaminhamento às ferramentas que o reconheçam. Em qualquer ferramenta, confirmar que as regras foram carregadas. Não prometer compartilhamento automático de histórico, login, ferramentas, limites ou memória entre provedores. Usar PROGRESSO.md como passagem de contexto.

## Fechamento
Informar o que mudou, o que foi testado, o que não foi testado e a próxima ação. Evitar rodadas de relatórios repetidos e adjetivos de autoavaliação. Usar português do Brasil. Não colocar informação de implementação no produto sem benefício ao usuário.
