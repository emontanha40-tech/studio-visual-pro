# Registro de validação — 06/11/2026

Ambiente: Node.js 24.22.1, Linux. Requisito declarado do projeto: Node.js >=22; macOS, Windows e Node 22 ainda precisam de execução local.

Executados e aprovados:
- 17 testes de domínio: campos obrigatórios, sequência, alteração de revisão/direção, falta de conteúdo, impressão sem especificação, direitos de uso, restauração sem aprovações, snapshot alterado, campos/produtos desconhecidos, data/hora, escape de SVG, prompt e imutabilidade.
- 4 testes HTTP: painel e cabeçalhos, bloqueio de caminho não público, recusa de escrita e Host externo.
- Verificação de sintaxe de server.mjs, src/engine.mjs e public/app.mjs.
- Validação JSON dos arquivos do pacote e integridade do ZIP.

Não concluído neste ambiente:
- Teste visual/E2E no navegador: navegador Chromium não disponível; tentativa de download falhou. Não há alegação de homologação visual, mobile ou acessibilidade.
- Integração real de IA, pagamento, nota, nuvem e impressão: não implementadas.
- Auditoria independente e validação multiusuário: pendentes.

Roteiro manual no VS Code:
1. Abrir em desktop e celular (responsividade pelo modo de dispositivo do navegador local).
2. Carregar exemplo → aprovar briefing → escolher direção → aprovar identidade/conteúdo/plano → baixar JSON.
3. Editar um campo sem aplicar: qualquer aprovação/exportação deve pedir aplicação das alterações.
4. Aplicar alteração: aprovações anteriores devem desaparecer.
5. Salvar rascunho e recarregar: conteúdo volta, aprovações não.
6. Testar campos longos, navegação por teclado e download dos três tipos de exportação.
7. Conferir que prévias são explicitamente demonstrativas e que serviços externos estão desconectados.

Testes não equivalem a autorização de uso em produção.
