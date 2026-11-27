import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrandTokens, contrastRatio } from '../src/brand/brandTokens.mjs';
import { generateHtml, generateLandingPackage, onPrimary } from '../src/brand/htmlGenerator.mjs';
import { DEFAULT_TOKENS } from '../src/brand/campaignService.mjs';
import { CONSTITUTION_CSS, CONSTITUTION_JS } from '../src/engine/design-constitution.mjs';

const tokens = validateBrandTokens(DEFAULT_TOKENS).tokens;

test('Constituição é injetada em toda landing, sem pedir no briefing', () => {
  for (const archetype of ['classic', 'saas_modern', 'local_authority', 'product_launch']) {
    const pkg = generateLandingPackage(tokens, { headline: 'Evento', archetype });
    for (const html of [pkg.indexHtml, pkg.standaloneHtml]) {
      assert.match(html, /class="dc-progress"/);
      assert.match(html, /id="dc-drawer"/);
      assert.ok(html.includes('dc-js'), 'runtime da constituição presente');
    }
    assert.ok(pkg.stylesCss.includes('backdrop-filter:blur(16px)'));
    assert.ok(pkg.standaloneHtml.includes('backdrop-filter:blur(16px)'));
  }
  assert.match(generateHtml(tokens, { template: 'landing', headline: 'X' }).html, /dc-progress/);
});

test('Constituição: stagger, blur-to-sharp, scroll reveal com scale e fallback estático', () => {
  assert.match(CONSTITUTION_CSS, /cubic-bezier\(0\.16,1,0\.3,1\)/);
  assert.match(CONSTITUTION_CSS, /filter:blur\(14px\)/);
  assert.match(CONSTITUTION_CSS, /scale\(\.965\)/);
  assert.match(CONSTITUTION_CSS, /html\.is-static \[data-reveal\]/);
  assert.match(CONSTITUTION_CSS, /\.lp-faq summary::after/);
  assert.match(CONSTITUTION_JS, /static'\) === 'true'/);
  assert.match(CONSTITUTION_JS, /IntersectionObserver/);
});

test('Cronograma opcional entra como timeline e drawer não simula envio real', () => {
  const pkg = generateLandingPackage(tokens, { headline: 'X', schedule: [{ time: '19h', title: 'Abertura' }] });
  assert.match(pkg.indexHtml, /dc-timeline/);
  assert.match(pkg.indexHtml, /Demonstração: o envio ainda não está conectado/);
  const wa = generateLandingPackage(tokens, { headline: 'X', whatsapp: '+55 (11) 99999-0000' });
  assert.match(wa.indexHtml, /data-wa="5511999990000"/);
});

test('Texto sobre primary mantém contraste WCAG AA', () => {
  assert.ok(contrastRatio(onPrimary(tokens), tokens.colors.primary) >= 4.5);
});
