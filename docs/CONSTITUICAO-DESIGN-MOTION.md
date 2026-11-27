# Constituição Padrão de Interface, Design & Motion (v1.0)

Padrão visual e de movimento **obrigatório** para qualquer site, landing page, hotsite, linktree ou interface web/SaaS gerada pelos agentes do workspace, independentemente de o cliente citar estética ou animações no briefing.

> Referência de implementação no Studio Visual Pro: `src/engine/design-constitution.mjs`.

## 1. Pilares Obrigatórios

1. **Header Glassmorphism**
   - Cabeçalho fixo flutuante com `backdrop-filter: blur(16px) saturate(1.5)` (com prefixo `-webkit-backdrop-filter`).
   - Transição suave ao rolar (`.is-scrolled`: compactação de padding, fundo mais denso e sombra sutil).
   - Barra de progresso de rolagem no topo na cor primária da marca.
2. **Hero Cinematográfico (Stagger + Blur-to-Sharp + Parallax)**
   - Entrada em cascata (`stagger` de `130ms` entre título, subtítulo, apoio e CTA).
   - Transição `blur-to-sharp` (`filter: blur(14px)` → `blur(0)` + `translate3d`).
   - Parallax suave na mídia principal em rolagem, sem comprometer legibilidade.
3. **Scroll Cinematográfico (`IntersectionObserver`)**
   - Revelação progressiva de seções, cards, depoimentos, cronogramas e FAQs via `IntersectionObserver` (`[data-reveal]`) combinando `opacity`, `translateY` e `scale` sutil.
   - Conteúdo acima da dobra (hero) não depende de scroll para ficar visível.
4. **Micro-interações Táteis & Glow**
   - Curva de movimento padrão obrigatória: `cubic-bezier(0.16, 1, 0.3, 1)`.
   - Botões e CTAs com resposta tátil em `:hover` (elevação + glow da cor primária), `:active` (pressão leve) e `:focus-visible` nítido.
   - Cards com borda/iluminação reativa ao ponteiro (`pointermove`) e elevação suave.
   - Acordeões/FAQ e drawers com abertura fluida e foco gerenciado por teclado (`Escape` e `Tab`).
5. **Tipografia, Respiro & Contraste WCAG AA**
   - Escala tipográfica fluida com `clamp()`, `text-wrap: balance` em títulos e `text-wrap: pretty` em parágrafos.
   - Espaçamento generoso entre seções (`clamp(72px, 9vw, 112px)`).
   - Contraste mínimo **WCAG AA** (4.5:1 para texto normal; 3:1 para texto grande e elementos interativos).
   - Responsividade mobile-first sem overflow horizontal (incluindo viewports de `390px`).

## 2. Fail-Safe, Acessibilidade & Honestidade

- **Sem bloqueio de conteúdo:** sem JavaScript, com `?static=true` (auditoria/screenshot) ou com `@media (prefers-reduced-motion: reduce)`, 100% do conteúdo deve permanecer imediatamente visível e funcional.
- **Sem simulação enganosa:** formulários, drawers ou integrações sem canal/backend conectado devem informar explicitamente estado de demonstração; nunca fingir envio, cobrança ou confirmação real.
- **Reutilização em outros projetos:** ao criar ou evoluir qualquer projeto web/SaaS no workspace, aplicar estes padrões desde a primeira entrega e validar contraste, responsividade mobile e ausência de erros no console.
