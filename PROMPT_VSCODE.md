# Copie o texto abaixo para o agente no VS Code

Você está assumindo o Studio Visual Pro, um estúdio de criação visual para igrejas, pastores e departamentos, com possibilidade de expansão a outros clientes.

Primeiro confirme a pasta atual, a branch e alterações existentes, sem modificar outros projetos. Leia AGENTS.md, README.md, docs/ARQUITETURA.md, docs/BACKLOG.md e knowledge/. Execute npm test e npm run check. Não faça deploy, não crie recursos pagos, não altere Git global e não conecte cobranças reais nesta etapa.

Objetivo deste ciclo: evoluir a v0.1 local para um núcleo persistente de briefing e orquestração, mantendo a interface demonstrável. Trabalhe até completar o escopo abaixo, com testes e documentação:

1. Carregue e valide a base knowledge no servidor, com schema versionado. Não duplique regras de produtos no frontend e backend.
2. Implemente persistência SQLite de projetos, revisões e eventos para desenvolvimento local. Faça migração versionada. Não publique esta base local como multiusuário.
3. Mova os comandos de aprovação para o servidor. Use snapshots imutáveis com SHA-256. Registre ator local como tal; autenticação real é requisito separado.
4. Acrescente importação de JSON com validação, limites de tamanho e recuperação segura de rascunhos, sem importar autorizações ou estados financeiros.
5. Defina adaptador de LLM para produzir três propostas em JSON validado. Mantenha-o DESLIGADO até que provedor, modelo e orçamento sejam definidos. Adaptador falso apenas em testes, nunca apresentado como IA real.
6. Faça o fluxo distinguir escolha de direção, solicitação de refinamento e aprovação da identidade. Nenhuma troca de data ou arte pode reutilizar autorização antiga.
7. Acrescente resumo legível do briefing e roteiro de perguntas condicionado aos produtos, incluindo gabarito para grandes formatos.
8. Teste invalidação, persistência, importação malformada, isolamento de arquivos e falha do provedor. Atualize README com capacidade real.

Preserve a direção visual sóbria: azul petróleo, areia, fundos claros, pouco brilho, boa hierarquia. Use fotos e logos originais como camadas preservadas quando o módulo de mídia existir. Não tente criar um editor gráfico completo nem integrar Pix/NFS-e neste primeiro ciclo.

Ao finalizar, entregue resumo dos arquivos alterados, testes executados, como abrir localmente e pendências. Se o projeto já evoluiu além da v0.1, adapte esta tarefa ao estado atual e não sobrescreva trabalho existente.
