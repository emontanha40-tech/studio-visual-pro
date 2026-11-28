#!/usr/bin/env node
// Propaga a Constituição Padrão de Interface, Design & Motion (docs/CONSTITUICAO-DESIGN-MOTION.md)
// e o bloco obrigatório de regras para AGENTS.md, GEMINI.md e CLAUDE.md na raiz do workspace
// e nos repositórios irmãos ativos. Idempotente e seguro (nunca sobrescreve regras existentes).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_SOURCE_DOC = path.join(ROOT_DIR, 'docs', 'CONSTITUICAO-DESIGN-MOTION.md');
export const MARKER_START = '<!-- constituicao-design-motion-v1 -->';
export const MARKER_END = '<!-- /constituicao-design-motion-v1 -->';

const SKIP_DIRS = new Set([
  '.git', '.stfolder', '.studio_uploads', '.telegram-midias',
  'Backups', 'backups', 'plans', 'node_modules', 'meu-assessor-preservacoes',
  'docs',
]);

export const RULE_BLOCKS = {
  'AGENTS.md': `${MARKER_START}
## Constituição Padrão de Interface, Design & Motion (Obrigatória em Projetos Web/SaaS)

Aplicar como padrão permanente e obrigatório em 100% dos sites, landing pages, hotsites, linktrees e interfaces web/SaaS gerados pelos agentes, sem depender de pedido no briefing (especificação completa em \`docs/CONSTITUICAO-DESIGN-MOTION.md\`):

- **Glassmorphism:** cabeçalho fixo flutuante com \`backdrop-filter: blur(16px) saturate(1.5)\` (e \`-webkit-\`), estado compacto ao rolar e barra de progresso de scroll na cor primária.
- **Hero Cinematográfico (Stagger + Blur-to-Sharp):** entrada em cascata (\`130ms\`), transição de desfoque para nítido (\`blur(14px)\` → \`blur(0)\`) e parallax suave na mídia.
- **Scroll Cinematográfico (\`IntersectionObserver\`):** revelação progressiva (\`[data-reveal]\`) com \`opacity\`, \`translateY\` e \`scale\` sutil; hero visível sem depender de rolagem.
- **Micro-interações Táteis & Glow:** curva padrão obrigatória \`cubic-bezier(0.16, 1, 0.3, 1)\`, elevação/glow em CTAs e cards reativos ao ponteiro, foco visível por teclado e FAQ/drawer fluidos.
- **Contraste WCAG AA & Responsividade:** contraste mínimo WCAG AA (4.5:1 texto normal / 3:1 texto grande e controles), tipografia fluida com \`clamp()\` e zero overflow horizontal no mobile (ex.: \`390px\`).
- **Fail-safe & Honestidade:** sem JS, com \`?static=true\` ou \`prefers-reduced-motion: reduce\`, 100% do conteúdo fica visível sem bloqueios; nunca simular envio, integração ou pagamento real sem backend conectado.
${MARKER_END}`,

  'GEMINI.md': `${MARKER_START}
## Padrão Obrigatório de Interface, Design & Motion (Web/SaaS)

Todo projeto web ou SaaS gerado ou evoluído pelos agentes deve aplicar permanentemente a Constituição Padrão de Interface, Design & Motion (\`docs/CONSTITUICAO-DESIGN-MOTION.md\`): Glassmorphism no header, Hero com Stagger e Blur-to-Sharp, Scroll Cinematográfico com \`IntersectionObserver\`, Micro-interações táteis/glow com \`cubic-bezier(0.16, 1, 0.3, 1)\`, contraste WCAG AA, responsividade sem overflow mobile e fail-safe para \`prefers-reduced-motion\` / \`?static=true\`.
${MARKER_END}`,

  'CLAUDE.md': `${MARKER_START}
## Padrão Obrigatório de Interface, Design & Motion (Web/SaaS)

Todo projeto web ou SaaS gerado ou evoluído pelos agentes deve aplicar permanentemente a Constituição Padrão de Interface, Design & Motion (\`docs/CONSTITUICAO-DESIGN-MOTION.md\`): Glassmorphism no header, Hero com Stagger e Blur-to-Sharp, Scroll Cinematográfico com \`IntersectionObserver\`, Micro-interações táteis/glow com \`cubic-bezier(0.16, 1, 0.3, 1)\`, contraste WCAG AA, responsividade sem overflow mobile e fail-safe para \`prefers-reduced-motion\` / \`?static=true\`.
${MARKER_END}`,
};

function discoverTargets(workspaceDir) {
  const targets = [];
  const seen = new Set();
  const addTarget = (dir) => {
    try {
      const real = fs.realpathSync(dir);
      if (seen.has(real)) return;
      seen.add(real);
      targets.push(real);
    } catch {
      // ignora diretórios inacessíveis
    }
  };
  addTarget(workspaceDir);
  const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.startsWith('.') || SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(workspaceDir, ent.name);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (!stat.isDirectory()) continue;
    addTarget(full);
  }
  return targets;
}

export function propagateConstitution({
  sourceDocPath = DEFAULT_SOURCE_DOC,
  workspaceDir = '/home/ubuntu/workspaces/Projetos',
  dryRun = false,
} = {}) {
  const docContent = fs.readFileSync(sourceDocPath, 'utf8');
  const targets = discoverTargets(workspaceDir);
  const report = [];

  for (const targetDir of targets) {
    const actions = [];
    const destDoc = path.join(targetDir, 'docs', 'CONSTITUICAO-DESIGN-MOTION.md');
    const existingDoc = fs.existsSync(destDoc) ? fs.readFileSync(destDoc, 'utf8') : null;
    if (existingDoc !== docContent) {
      actions.push(existingDoc === null ? 'create:docs/CONSTITUICAO-DESIGN-MOTION.md' : 'update:docs/CONSTITUICAO-DESIGN-MOTION.md');
      if (!dryRun) {
        fs.mkdirSync(path.dirname(destDoc), { recursive: true });
        fs.writeFileSync(destDoc, docContent, 'utf8');
      }
    }

    for (const [filename, block] of Object.entries(RULE_BLOCKS)) {
      const rulePath = path.join(targetDir, filename);
      const exists = fs.existsSync(rulePath);
      const current = exists ? fs.readFileSync(rulePath, 'utf8') : '';
      if (current.includes(MARKER_START)) continue;
      actions.push(exists ? `append:${filename}` : `create:${filename}`);
      if (!dryRun) {
        const next = exists
          ? `${current.replace(/\s+$/, '')}\n\n${block}\n`
          : `${block}\n`;
        fs.writeFileSync(rulePath, next, 'utf8');
      }
    }

    report.push({ targetDir, actions });
  }

  return { workspaceDir, dryRun, totalTargets: targets.length, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const wsIdx = args.indexOf('--workspace');
  const workspaceDir = wsIdx >= 0 && args[wsIdx + 1] ? path.resolve(args[wsIdx + 1]) : '/home/ubuntu/workspaces/Projetos';
  const result = propagateConstitution({ workspaceDir, dryRun });
  const changed = result.report.filter((r) => r.actions.length > 0);
  console.log(`Constituição propagada (${dryRun ? 'DRY-RUN' : 'APLICADO'}): ${changed.length}/${result.totalTargets} diretórios atualizados em ${result.workspaceDir}`);
  for (const item of changed) {
    console.log(`- ${path.basename(item.targetDir)}: ${item.actions.join(', ')}`);
  }
}
