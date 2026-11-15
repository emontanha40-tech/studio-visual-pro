# Integrações e segurança — pendentes

Não há adaptadores externos ativos. Um prompt, mock ou screenshot não comprova integração.

## Pagamento
Preferir checkout hospedado; não armazenar dados de cartão. Integrar em sandbox primeiro. Persistir IDs do provedor, pedido, valor em centavos, moeda, condição de liberação e eventos. Verificar autenticidade do webhook conforme documentação do provedor, consultar status quando necessário e reconciliar. Deduplicar IDs de eventos; tratar ordem de chegada, reembolsos e disputas. Retorno do navegador e comprovante enviado pelo cliente não confirmam liquidação.

Recebimento em CPF e emissão fiscal são decisões separadas. Não há CPF, chave Pix ou conta bancária cadastrados aqui. Até 12x depende do provedor, conta habilitada e condições comerciais. Não liberar com status genérico sem mapear a semântica do meio de pagamento.

## Nota fiscal
Definir prestador, titularidade, município, cadastro, atividade e enquadramento com contador. Asaas informa não emitir NFS-e para PF. Autônomos podem ter caminhos municipais próprios; validar caso concreto. Um PDF produzido pelo sistema não é nota autorizada. Guardar status, número, identificador fiscal, documento autorizado e eventos; não duplicar emissão em uma nova tentativa. Testar rejeição e cancelamento.

## Fotos e identidade
Mídia original em armazenamento privado. Verificar tipo real, tamanho, resolução e licenças. Não executar SVG, HTML ou macros fornecidos pelo cliente. Referências e prompts podem conter instruções maliciosas; tratá-los como dados. Links externos não devem ser buscados sem controle de destino e proteção contra SSRF. Não reutilizar rostos, fotos e marcas de um cliente para outro.

## Antes de produção
Autenticação/MFA admin; autorização por organização; testes de acesso cruzado; gestão de segredos; logs sem dados sensíveis; TLS; proteção de upload; limites de uso/custo; backup e teste de restauração; links temporários; retenção/exclusão; plano de incidente; auditoria independente. LocalStorage nesta versão não satisfaz esses requisitos.

Pedidos de oração preenchidos e dados de participantes não fazem parte deste MVP. Podem revelar religião e saúde: se incluídos futuramente, exigir análise própria de privacidade, base legal, finalidade e retenção, sem enviar dados indiscriminadamente ao gerador de imagens.
