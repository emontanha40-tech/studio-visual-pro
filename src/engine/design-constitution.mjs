// Constituição Visual & Motion — camada PERMANENTE e obrigatória de todo site/peça web gerado.
// Não depende do briefing: o cliente só informa fatos; o motor aplica o padrão de agência.
// Fail-safe: sem JS, com ?static=true (Auditor) ou prefers-reduced-motion, 100% do conteúdo fica visível.
import { escapeXml } from '../brand/logo.mjs';

export const CONSTITUTION_VERSION = '1.0';

/** Marcação obrigatória: barra de progresso de scroll + drawer de ação/inscrição. */
export function constitutionShell(o = {}) {
  const title = escapeXml(o.drawerTitle || o.cta || 'Fale com a gente');
  const wa = String(o.whatsapp || '').replace(/\D/g, '');
  return `<div class="dc-progress" aria-hidden="true"><i></i></div>
<div class="dc-drawer" id="dc-drawer" role="dialog" aria-modal="true" aria-labelledby="dc-drawer-title" hidden${wa ? ` data-wa="${wa}"` : ''}>
  <div class="dc-backdrop" data-dc-close></div>
  <form class="dc-panel" novalidate>
    <button type="button" class="dc-close" data-dc-close aria-label="Fechar">×</button>
    <h2 id="dc-drawer-title">${title}</h2>
    <label>Nome<input name="nome" autocomplete="name" required></label>
    <label>WhatsApp<input name="whatsapp" inputmode="tel" autocomplete="tel" required></label>
    <button type="submit" class="cta dc-submit">${escapeXml(o.cta || 'Enviar')}</button>
    <p class="dc-note" role="status" aria-live="polite">${wa ? '' : 'Demonstração: o envio ainda não está conectado a nenhum canal real.'}</p>
  </form>
</div>`;
}

export const CONSTITUTION_CSS = `
:root{--dc-ease:cubic-bezier(0.16,1,0.3,1);--dc-header-h:72px;--dc-section-y:clamp(72px,9vw,112px)}
.dc-progress{position:fixed;inset:0 0 auto 0;height:3px;z-index:30;pointer-events:none}
.dc-progress i{display:block;height:100%;background:var(--color-primary);transform:scaleX(var(--dc-scroll,0));transform-origin:left;box-shadow:0 0 12px color-mix(in srgb,var(--color-primary) 60%,transparent)}
/* a) Header flutuante glass */
.landing{padding-top:var(--dc-header-h)}
.landing .lp-header{position:fixed;inset:0 0 auto 0;z-index:20;padding:16px 0;border-bottom:1px solid transparent;background:color-mix(in srgb,var(--color-background-main) 55%,transparent);-webkit-backdrop-filter:blur(16px) saturate(1.5);backdrop-filter:blur(16px) saturate(1.5);transition:padding .5s var(--dc-ease),background .5s var(--dc-ease),box-shadow .5s var(--dc-ease),border-color .5s var(--dc-ease)}
.landing .lp-header.is-scrolled{padding:9px 0;background:color-mix(in srgb,var(--color-background-main) 84%,transparent);border-bottom-color:color-mix(in srgb,var(--color-text-muted) 22%,transparent);box-shadow:0 10px 30px -12px rgba(15,23,42,.25)}
/* e) Tipografia e respiro nível agência */
.landing h1,.landing h2{letter-spacing:-.02em;text-wrap:balance}
.landing h1{font-size:clamp(40px,6.4vw,84px);line-height:1.04}
.landing .lp-hero-copy h1{font-size:clamp(40px,6.4vw,84px)}
.landing .lp-sec-title,.landing .lp-extra h2{font-size:clamp(30px,4vw,52px);line-height:1.08}
.landing .lp-sub{font-size:clamp(17px,1.6vw,21px);line-height:1.6}
.landing p{text-wrap:pretty}
.landing .lp-hero{padding-block:var(--dc-section-y);position:relative;overflow:clip}
.landing .lp-hero::before{content:"";position:absolute;inset:-20% -10% auto auto;width:60vw;height:60vw;max-width:760px;max-height:760px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--color-primary) 22%,transparent),transparent 68%);pointer-events:none}
.landing .lp-features,.landing .lp-cta-band{padding-block:var(--dc-section-y)}
.landing .lp-extra{padding-block:calc(var(--dc-section-y)/2) var(--dc-section-y)}
.landing .lp-footer{padding-block:48px}
.landing .lp-sec-title{margin-bottom:clamp(32px,5vw,56px)}
.landing .lp-grid{gap:clamp(18px,2.4vw,32px)}
.landing .lp-card{padding:clamp(24px,2.6vw,36px)}
.landing .lp-card p,.landing .lp-faq p{font-size:16px;line-height:1.65}
/* b) Hero cinematográfico: stagger + blur-to-sharp + parallax */
.landing .lp-photo{box-shadow:0 50px 90px -30px rgba(15,23,42,.55),0 18px 36px -16px rgba(15,23,42,.3)}
.landing .lp-photo img{transform:scale(1.08);transform-origin:center}
html.dc-js .landing .lp-hero-copy>*{opacity:0;filter:blur(14px);transform:translate3d(0,26px,0);animation:dc-in 1.1s var(--dc-ease) forwards;animation-delay:calc(var(--n,0)*130ms + 80ms)}
html.dc-js .landing .lp-hero-copy>:nth-child(1){--n:0}html.dc-js .landing .lp-hero-copy>:nth-child(2){--n:1}
html.dc-js .landing .lp-hero-copy>:nth-child(3){--n:2}html.dc-js .landing .lp-hero-copy>:nth-child(4){--n:3}
html.dc-js .landing .lp-hero .lp-media{opacity:0;filter:blur(18px);transform:scale(.96);animation:dc-in 1.4s var(--dc-ease) 380ms forwards}
@keyframes dc-in{to{opacity:1;filter:blur(0);transform:none}}
/* c) Coreografia de scroll: opacity + translateY + scale sutil */
html.js-motion [data-reveal]{opacity:0;transform:translate3d(0,44px,0) scale(.965);transition:opacity 1s var(--dc-ease),transform 1s var(--dc-ease);transition-delay:calc(var(--i,0)*110ms)}
html.js-motion [data-reveal].is-in{opacity:1;transform:none}
html.js-motion .lp-hero [data-reveal]{opacity:1;transform:none;transition:none}
/* d) Micro-interações táteis & glow */
.landing .cta,.landing .lp-cta-btn{position:relative;overflow:hidden;isolation:isolate;transition:transform .45s var(--dc-ease),box-shadow .45s var(--dc-ease)}
.landing .cta:hover,.landing .lp-cta-btn:hover{transform:translateY(-3px);box-shadow:0 16px 36px -10px color-mix(in srgb,var(--color-primary) 55%,transparent),0 0 0 1px color-mix(in srgb,var(--color-primary) 40%,transparent)}
.landing .cta:active,.landing .lp-cta-btn:active{transform:translateY(0) scale(.98)}
.landing .cta:focus-visible,.landing .lp-cta-btn:focus-visible,.dc-drawer :focus-visible,.landing summary:focus-visible{outline:3px solid var(--color-primary);outline-offset:3px}
.landing .lp-card,.landing .lp-proof,.landing .lp-quotes blockquote{position:relative}
.landing .lp-card::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:radial-gradient(260px circle at var(--mx,50%) var(--my,0%),color-mix(in srgb,var(--color-primary) 85%,#fff),transparent 70%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity .5s var(--dc-ease);pointer-events:none}
.landing .lp-card:hover::before{opacity:1}
.landing .lp-card:hover{transform:translateY(-8px);box-shadow:0 26px 50px -22px color-mix(in srgb,var(--color-primary) 45%,rgba(15,23,42,.4))}
.landing .lp-faq details{border:1px solid color-mix(in srgb,var(--color-text-muted) 28%,transparent);border-radius:16px;padding:0 22px;margin-bottom:12px;background:var(--color-surface-card);transition:border-color .4s var(--dc-ease),box-shadow .4s var(--dc-ease)}
.landing .lp-faq details[open]{border-color:var(--color-primary);box-shadow:0 12px 28px -16px color-mix(in srgb,var(--color-primary) 50%,transparent)}
.landing .lp-faq summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 0;min-height:48px}
.landing .lp-faq summary::-webkit-details-marker{display:none}
.landing .lp-faq summary::after{content:"+";font-size:26px;line-height:1;color:var(--color-primary);transition:transform .4s var(--dc-ease)}
.landing .lp-faq details[open] summary::after{transform:rotate(45deg)}
@supports (interpolate-size:allow-keywords){html:not(.is-static) .landing .lp-faq details{interpolate-size:allow-keywords}
html:not(.is-static) .landing .lp-faq details::details-content{block-size:0;overflow:clip;transition:block-size .45s var(--dc-ease),content-visibility .45s allow-discrete}
html:not(.is-static) .landing .lp-faq details[open]::details-content{block-size:auto}}
.landing .lp-faq details p{padding:0 0 20px}
.dc-timeline{list-style:none;display:grid;gap:14px}
.dc-timeline li{display:grid;grid-template-columns:96px 1fr;gap:20px;padding:20px 24px;border-radius:16px;background:var(--color-surface-card);border-left:4px solid var(--color-primary)}
.dc-timeline time{font:700 20px var(--font-heading);color:var(--color-text-primary)}
.dc-timeline h3{font-size:19px}
@media(max-width:680px){.dc-timeline li{grid-template-columns:1fr;gap:6px}}
/* Drawer de ação/inscrição */
.dc-drawer{position:fixed;inset:0;z-index:40;display:flex;justify-content:flex-end}
.dc-drawer[hidden]{display:none}
.dc-backdrop{position:absolute;inset:0;background:rgba(8,12,24,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:0;transition:opacity .4s var(--dc-ease)}
.dc-panel{position:relative;width:min(440px,100%);height:100%;overflow:auto;background:var(--color-background-main);color:var(--color-text-primary);padding:56px 32px 32px;display:flex;flex-direction:column;gap:18px;transform:translateX(100%);transition:transform .55s var(--dc-ease);box-shadow:-30px 0 60px -20px rgba(0,0,0,.4)}
.dc-drawer.is-open .dc-backdrop{opacity:1}.dc-drawer.is-open .dc-panel{transform:none}
.dc-panel h2{font-size:clamp(26px,4vw,34px)}
.dc-panel label{display:grid;gap:6px;font-weight:600;font-size:14px}
.dc-panel input{font:inherit;font-weight:400;padding:14px 16px;border-radius:12px;border:1px solid var(--color-text-muted);background:var(--color-surface-card);color:var(--color-text-primary)}
.dc-close{position:absolute;top:14px;right:16px;width:44px;height:44px;border-radius:50%;border:0;background:var(--color-surface-card);color:var(--color-text-primary);font-size:26px;cursor:pointer}
.dc-submit{border:0;cursor:pointer;font-size:17px;padding:16px 28px;text-align:center}
.dc-note{font-size:13px;color:var(--color-text-muted);min-height:1.2em}
@media(max-width:680px){.landing .lp-header{padding:10px 0}.dc-panel{padding-inline:22px}.landing h1{font-size:clamp(34px,10.5vw,52px)}}
/* Modo estático (Auditor), sem JS ou reduced-motion: tudo visível, sem animação */
html.is-static .dc-progress{display:none}
html.is-static .landing *{animation:none!important;transition:none!important}
html.is-static .landing .lp-hero-copy>*,html.is-static .landing .lp-hero .lp-media,html.is-static [data-reveal]{opacity:1!important;filter:none!important;transform:none!important}
html.is-static .dc-panel,html.is-static .dc-backdrop{transition:none}
@media (prefers-reduced-motion:reduce){.landing .lp-header,.dc-panel,.dc-backdrop{transition:none}}`;

export const CONSTITUTION_JS = `(() => {
  const root = document.documentElement;
  const forced = new URLSearchParams(location.search).get('static') === 'true' /* ?static=true */ || root.hasAttribute('data-static');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const drawer = document.getElementById('dc-drawer');
  let lastFocus = null;
  const closeDrawer = () => {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('is-open');
    setTimeout(() => { drawer.hidden = true; }, forced || reduced ? 0 : 400);
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  };
  const openDrawer = (from) => {
    if (!drawer) return;
    lastFocus = from;
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    const first = drawer.querySelector('input');
    if (first) first.focus();
  };
  if (drawer) {
    // CTAs seguem como âncora (#contato) sem JS; com JS abrem o drawer.
    document.querySelectorAll('.landing a.cta, .landing a.lp-cta-btn').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); openDrawer(a); });
    });
    drawer.querySelectorAll('[data-dc-close]').forEach((el) => el.addEventListener('click', closeDrawer));
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
      if (e.key === 'Tab' && !drawer.hidden) {
        const f = [...drawer.querySelectorAll('button,input')];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    const form = drawer.querySelector('form');
    const note = drawer.querySelector('.dc-note');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = form.nome.value.trim(), fone = form.whatsapp.value.trim();
      if (!nome || !fone) { note.textContent = 'Preencha nome e WhatsApp.'; return; }
      const wa = drawer.dataset.wa;
      if (!wa) { note.textContent = 'Demonstração: o envio ainda não está conectado a nenhum canal real.'; return; }
      const msg = encodeURIComponent('Olá! Sou ' + nome + ' (' + fone + ') e quero saber mais.');
      window.open('https://wa.me/' + wa + '?text=' + msg, '_blank', 'noopener');
      note.textContent = 'Abrimos o WhatsApp com sua mensagem — confirme o envio por lá.';
    });
  }
  if (forced || !('IntersectionObserver' in window)) { root.classList.add('is-static'); return; }
  root.classList.add('dc-js');
  if (reduced) { root.classList.add('is-static'); }
  const header = document.querySelector('.lp-header');
  const bar = document.querySelector('.dc-progress');
  const layers = document.querySelectorAll('[data-parallax]');
  let queued = false;
  const frame = () => {
    queued = false;
    const y = Math.max(window.scrollY, 0);
    const max = document.documentElement.scrollHeight - innerHeight;
    if (header) header.classList.toggle('is-scrolled', y > 24);
    if (bar) bar.style.setProperty('--dc-scroll', max > 0 ? Math.min(y / max, 1).toFixed(4) : 0);
    if (!reduced) layers.forEach((l) => l.style.setProperty('--parallax', Math.min(y * 0.12, 36) + 'px'));
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(frame); } }, { passive: true });
  addEventListener('resize', frame);
  frame();
  if (reduced) return;
  document.querySelectorAll('.lp-card').forEach((c) => c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));
  document.querySelectorAll('.lp-quotes blockquote,.lp-faq details,.dc-timeline li,.lp-metrics>div').forEach((el, i) => {
    if (!el.hasAttribute('data-reveal')) { el.setAttribute('data-reveal', ''); el.style.setProperty('--i', (i % 4) + 1); }
  });
  root.classList.add('js-motion');
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) { if (!en.isIntersecting) continue; en.target.classList.add('is-in'); io.unobserve(en.target); }
  }, { threshold: 0, rootMargin: '0px 0px -18px 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
})();`;
