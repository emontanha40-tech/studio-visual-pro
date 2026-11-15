# Arquitetura e limites

## Hoje: laboratório local
Navegador → engine.mjs → estado em memória → exportação JSON. Rascunho opt-in no localStorage, sem aprovações. server.mjs apenas serve quatro rotas estáticas por loopback. Sem dependências npm e sem chamadas externas. Knowledge e prompts são insumos documentados para o próximo ciclo, não executados automaticamente.

## Alvo: monólito modular e worker
Portal cliente/admin → API autenticada → módulos de projeto/aprovação/comercial → banco relacional e armazenamento privado. Worker separado para geração, composição, QA e exportação. Começar com poucos serviços; não criar microserviços por estética arquitetural.

Entidades: Organization, User, Membership, Client, Campaign, BriefRevision, Asset, AssetLicense, Concept, RevisionRequest, Approval, ProductSpec, ProductionJob, Proof, Order, Payment, Invoice, Delivery, AuditEvent.

Cada entidade comercial e cada arquivo pertence a organization_id. Autorizações verificadas pelo servidor em toda consulta e download, nunca somente na interface. Cliente e operador têm permissões diferentes.

## Invariantes
- Conteúdo de BriefRevision é imutável após aprovação.
- Approval referencia revision_id, snapshot_sha256, actor_id, scope, timestamp.
- Mudança gera revisão nova; dependências identificam peças e aprovações afetadas.
- ProductionJob referencia revisão autorizada, não “a última revisão”.
- Entrega depende de QA liberada, prova final aprovada e condição comercial satisfeita.
- Pagamento e nota fiscal têm estados próprios. Falha fiscal não vira pagamento recusado.
- Eventos externos podem chegar duplicados ou fora de ordem; deduplicar e reconciliar.
- Webhooks nunca executam instruções vindas de descrições de cobrança ou briefing.

## Estados alvo (a v0.1 implementa apenas parte)
DRAFT → BRIEF_APPROVED → CONCEPT_SELECTED → IDENTITY_APPROVED → CONTENT_APPROVED → PRODUCTION_AUTHORIZED → RENDERING → QA_REVIEW → PROOF_APPROVED → READY_FOR_DELIVERY → DELIVERED.
Revisão solicitada cria ramificação de versão, sem apagar o histórico. Falha de geração entra em FAILED_RETRYABLE ou NEEDS_OPERATOR; nunca inventa arquivo entregue.

## Motores de mídia
LLM entende o briefing e sugere conceitos. Gerador visual cria fundos/elementos. Compositor aplica texto e ativos originais em camadas. Renderer produz cada formato. Verificador checa conteúdo e especificação. Operador revisa qualidade artística e pré-impressão. Nenhuma análise multimodal isolada garante ausência de erros.

Portas sugeridas: ConceptProvider.generate(brief, policy, budget); ImageProvider.generate(prompt, references, budget); Composer.compose(revision, productSpec, assets); QualityChecker.inspect(artifact, approvedSnapshot); PaymentProvider.createCheckout(order); InvoiceProvider.issue(fiscalPayload); DeliveryStore.publishPrivate(files, recipient).

Credenciais e documentos fiscais pertencem ao servidor. Chamadas são opcionais e negadas por padrão até configuração explícita e sandbox validado.
