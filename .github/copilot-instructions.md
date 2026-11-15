# GitHub Copilot Pro — Segurança e Escopo Operacional

## Antes de Alterar Código
- Confirme com `pwd -P` o diretório físico real (não confie no nome visual).
- Verifique `git status` e a branch atual (se for repositório Git).
- Identifique o ambiente: desenvolvimento, testes ou produção.
- Preserve alterações não commitadas; apenas faça commit com autorização.

## Operações Bloqueadas
- Nenhum push, merge ou alteração de `main`/`master` sem autorização.
- Nenhum deployment, migração real ou acesso a infraestrutura.
- Nenhum acesso, leitura ou transmissão de credenciais, `.env` ou segredos.
- Nenhum comando destrutivo: `rm -rf`, `git clean`, `docker prune` sem autorização.
- Nenhuma alteração em projetos fora do escopo: meu-assessor, Pastor-One, Studio Visual Pro.

## Prioridades de Operação
- Testes locais e soluções econômicas: primeira escolha.
- Simulação antes de execução real.
- Auditoria independente exigida antes de produção.
- Respeite as instruções específicas de cada projeto (AGENTS.md, CLAUDE.md).

## DEV Control Center V9 (Diretório de Controle)
- Simulação apenas. Nenhuma execução real de agentes Copilot/Codex/Claude/Gemini.
- `realEnabled=false` em todos os 4 provedores. Verificação permanente.
- Hardlinks (nlink>1) bloqueiam operações. Permissões: 0600.
- Cópia diagnóstica: `/Users/Windows/Developer/dev-manager` (autorizada).
- Original: `/Users/Windows/Documents/Meu assessor/Projetos/dev-manager` (não modificar).
- Gate 7 permanece bloqueado. Sem exceções.

## Linguagem
Português do Brasil em tudo: respostas, código, commits, testes.
