# Direção dos produtos e reaproveitamento da inteligência

Decisão do proprietário em 15/11/2026. Este documento orienta planejamento e desenvolvimento; não implementa integração ou migração.

## O que preservar
O proprietário informa que o Meu Assessor já opera por WhatsApp, web e aplicativo. Não tratar esses canais como inexistentes nem propor reconstrução antes de conferir o código e o uso real. Pastor One mantém o papel de aplicativo/interface do ecossistema existente. O estado comercial e o isolamento entre clientes ainda precisam de validação própria.

## Produtos separados, tecnologia reaproveitável
CRM deve ser um produto separado. Reaproveitar inteligência, ferramentas, serviços, contratos de API, componentes de agenda, automações e integrações com WhatsApp e provedores de IA quando a análise na fonte justificar. Separar o que é lógica genérica do que é regra pastoral específica; não impor regras da igreja ao CRM genérico. Não duplicar uma função existente sem justificar a necessidade e estabelecer a fonte canônica.

Não confundir reutilização de código com obrigação de rodar todos os produtos em um único processo, banco ou conta. Decidir biblioteca compartilhada ou serviço/API com base na implementação existente, dependências e autorização; não introduzir microserviços ou uma plataforma paralela apenas por padronização.

## Dados para compreender requisitos, não para copiar aos clientes
Dados do proprietário podem orientar requisitos e testes somente no contexto e finalidade autorizados. Não usar esta decisão como autorização para ler, exportar, migrar, enviar a provedores ou misturar dados reais. Para desenvolvimento e demonstração, usar exemplos sintéticos. Não fazer treinamento com dados privados por padrão.

Cada cliente comercial deve operar com seus próprios dados. Isolar identidade, organização, papéis, registros, documentos, histórico, memória de IA, credenciais, números de WhatsApp, calendários, filas, automações e custos. Validar o contexto do cliente no servidor em cada consulta e ação; filtro visual sozinho não basta. Um usuário pode ter acesso a mais de um produto quando explicitamente autorizado, sem conceder acesso a dados de outro cliente.

## Prontidão comercial: requisitos ainda a demonstrar
- Autenticação e autorização com testes negativos de acesso entre clientes, incluindo arquivos, pesquisa, contexto enviado à IA e tarefas em segundo plano.
- Cadastro e revogação de integrações próprias de cada cliente; nenhuma reutilização de token ou número pessoal por conveniência.
- Limites, medição de uso e orçamento por cliente; possibilidade de suspender novas execuções sem perder registros ou tarefas.
- Auditoria, backup protegido, restauração testada e política de retenção; exclusão somente em escopo aprovado.
- Homologação de um fluxo completo com dois clientes fictícios isolados antes de piloto comercial.

Não declarar esses requisitos implementados por existir esta documentação ou por funcionar com o único proprietário.

## Escopo desta preparação
Somente instruções. Não alterar banco, ativar multiusuário, copiar dados, migrar integrações, enviar mensagens, conectar serviços pagos ou publicar. Preservar a arquitetura em operação até uma missão específica aprovada.

## Próxima missão possível no CRM
Após confirmar a pasta canônica: mapear um único fluxo já existente no Meu Assessor (por exemplo, agendamento) e identificar interfaces reutilizáveis, regras pastorais que devem permanecer específicas e lacunas de isolamento. Começar por leitura e evidências, com dados sintéticos; não iniciar uma migração completa.
