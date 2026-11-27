// Fatia 11 (Bloco 2/3) — Templates WEB expandidos do Kit em Lote:
// 1. Página de Bio / Linktree Pro (mobile-first, Constituição Visual & Motion)
// 2. Hotsite de Evento / Programação Completa (abas + acordeão + localização, Constituição Visual & Motion)
// 3. Assinatura de E-mail HTML + Cabeçalho de Newsletter (pronto para copiar/usar)
import { escapeXML } from '../engine.mjs';
import { CONSTITUTION_CSS, CONSTITUTION_JS, constitutionShell } from '../engine/design-constitution.mjs';

function kitRootVars(identity) {
  const c = identity.kit.colors;
  const t = identity.kit.typography;
  return `:root{
  --color-background-main:${c.bg};
  --color-surface-card:${c.surface};
  --color-primary:${c.primary};
  --color-accent:${c.accent};
  --color-text-primary:${c.text};
  --color-text-muted:${c.muted};
  --color-cta-bg:${c.primary};
  --color-cta-text:${c.onPrimary};
  --font-heading:${t.display};
  --font-body:${t.body};
  --radius-card:${identity.kit.spacing?.cardRadius || '18px'};
}`;
}

function waUrl(whatsapp) {
  const digits = String(whatsapp || '').replace(/\D/g, '');
  return /^\d{10,15}$/.test(digits) ? `https://wa.me/${digits}` : '#contato';
}

/** 1. Página de Bio / Linktree Pro (mobile-first com botões animados e identidade da campanha). */
export function renderLinktreeHTML(identity, { photo = null, photoFile = null, whatsapp = '' } = {}) {
  const e = escapeXML;
  const c = identity.kit.colors;
  const href = waUrl(whatsapp);
  const ev = [identity.evento.data, identity.evento.local].filter(Boolean).join(' • ');
  const links = [
    { label: identity.headlines.cta_principal || 'Falar agora', desc: 'Atendimento direto da campanha', href, primary: true },
    ...identity.beneficios.map((b, i) => ({
      label: b,
      desc: i === 0 ? 'Conheça os detalhes principais' : i === 1 ? 'Veja como participar' : 'Tire suas dúvidas com a equipe',
      href: '#contato',
      primary: false,
    })),
    ...(identity.evento.local ? [{
      label: 'Como chegar ao local',
      desc: identity.evento.local,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(identity.evento.local)}`,
      external: true,
    }] : []),
  ];

  const avatar = photoFile
    ? `<div class="bio-avatar"><img src="${e(photoFile)}" alt="${e(identity.marca)}" style="object-position:50% ${Math.round((identity.focal?.founder?.y ?? 0.2) * 100)}%"></div>`
    : `<div class="bio-logo">${identity.logo_svg}</div>`;

  const buttons = links.map((item, i) => {
    const cls = item.primary ? 'bio-link is-primary cta' : 'bio-link lp-card';
    const target = item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a class="${cls}" href="${e(item.href)}"${target} data-reveal style="--i:${i + 1}">
      <span class="bio-link-copy"><strong>${e(item.label)}</strong><small>${e(item.desc)}</small></span>
      <span class="bio-arrow" aria-hidden="true">→</span>
    </a>`;
  }).join('\n');

  const credit = photo?.credit ? `<p class="bio-credit">Foto: ${e(photo.credit)}</p>` : '';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(identity.marca)} — Links Oficiais</title>
<style>
${kitRootVars(identity)}
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:var(--color-background-main);color:var(--color-text-primary);font-family:var(--font-body);line-height:1.5;overflow-x:hidden}
h1,h2,h3,strong{font-family:var(--font-heading)}
.landing.bio-page{min-height:100vh;padding:28px 18px 56px;display:flex;justify-content:center;position:relative;isolation:isolate;background:radial-gradient(ellipse at 50% 0%,color-mix(in srgb,var(--color-primary) 24%,transparent),transparent 58%),var(--color-background-main)}
.bio-wrap{width:100%;max-width:460px;display:flex;flex-direction:column;gap:20px;align-items:center}
.bio-head{text-align:center;display:grid;gap:12px;justify-items:center;padding-top:16px}
.bio-avatar{width:96px;height:96px;border-radius:50%;overflow:hidden;border:3px solid var(--color-primary);box-shadow:0 16px 36px -12px color-mix(in srgb,var(--color-primary) 55%,transparent)}
.bio-avatar img{width:100%;height:100%;object-fit:cover}
.bio-logo{max-width:210px}
.bio-logo svg{width:100%;height:auto;display:block}
.bio-badge{display:inline-block;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:color-mix(in srgb,var(--color-primary) 16%,var(--color-surface-card));color:var(--color-accent)}
.landing.bio-page h1{font-size:clamp(26px,7vw,34px);line-height:1.12;letter-spacing:-.02em}
.bio-sub{color:var(--color-text-muted);font-size:15px;max-width:36ch}
.bio-event{font-size:13px;font-weight:700;color:var(--color-text-primary);padding:8px 14px;border-radius:999px;background:var(--color-surface-card);border:1px solid color-mix(in srgb,var(--color-primary) 30%,transparent)}
.bio-links{width:100%;display:grid;gap:12px;margin-top:6px}
.bio-link{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 20px;border-radius:var(--radius-card);text-decoration:none;background:var(--color-surface-card);color:var(--color-text-primary);border:1px solid color-mix(in srgb,var(--color-text-muted) 22%,transparent);transition:transform .4s var(--dc-ease),box-shadow .4s var(--dc-ease),border-color .4s var(--dc-ease)}
.bio-link.is-primary{background:var(--color-cta-bg);color:var(--color-cta-text);border-color:transparent;box-shadow:0 14px 32px -12px color-mix(in srgb,var(--color-primary) 60%,transparent)}
.bio-link.is-primary small{color:color-mix(in srgb,var(--color-cta-text) 82%,transparent)}
.bio-link-copy{display:grid;gap:2px;text-align:left}
.bio-link-copy strong{font-size:16px;line-height:1.25}
.bio-link-copy small{font-size:13px;color:var(--color-text-muted)}
.bio-arrow{font-size:20px;font-weight:700;transition:transform .35s var(--dc-ease);flex:none}
.bio-link:hover .bio-arrow{transform:translateX(4px)}
.bio-foot{margin-top:16px;text-align:center;font-size:12px;color:var(--color-text-muted);display:grid;gap:6px}
.bio-credit{font-size:11px;opacity:.8}
${CONSTITUTION_CSS}
.landing.bio-page{padding-top:28px}
</style></head><body>
${constitutionShell({ cta: identity.headlines.cta_principal, whatsapp })}
<main class="landing bio-page">
  <div class="bio-wrap">
    <header class="bio-head lp-hero-copy">
      ${avatar}
      <span class="bio-badge">${e(identity.marca)}</span>
      <h1>${e(identity.headlines.hero)}</h1>
      <p class="bio-sub">${e(identity.headlines.subtitulo)}</p>
      ${ev ? `<p class="bio-event">${e(ev)}</p>` : ''}
    </header>
    <nav class="bio-links" aria-label="Links principais">
      ${buttons}
    </nav>
    <footer class="bio-foot" id="contato">
      <span>© ${e(identity.marca)} · ${e(identity.kit.nome || 'Identidade Oficial')}</span>
      ${credit}
    </footer>
  </div>
</main>
<script>${CONSTITUTION_JS}</script>
</body></html>\n`;
}

/** 2. Hotsite de Evento / Programação Completa (abas + acordeão + bloco de localização). */
export function renderHotsiteHTML(identity, { photo = null, photoFile = null, whatsapp = '', programacao = null } = {}) {
  const e = escapeXML;
  const href = waUrl(whatsapp);
  const dataLabel = identity.evento.data || 'Data a confirmar';
  const localLabel = identity.evento.local || 'Local a confirmar (informe no briefing)';
  const mapsHref = identity.evento.local
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(identity.evento.local)}`
    : '#contato';

  const defaultDays = [
    {
      id: 'dia-1',
      label: 'Abertura',
      sessions: [
        { time: '19:00', title: 'Credenciamento e Recepção', detail: 'Chegada, boas-vindas e acolhimento dos participantes.' },
        { time: '19:30', title: identity.headlines.hero, detail: identity.headlines.subtitulo },
        { time: '20:45', title: identity.beneficios[0], detail: 'Momento principal com conteúdo prático e direcionamento.' },
      ],
    },
    {
      id: 'dia-2',
      label: 'Programação Principal',
      sessions: [
        { time: '09:30', title: identity.beneficios[1], detail: 'Sessão dedicada com tempo para perguntas e aplicação.' },
        { time: '11:00', title: identity.beneficios[2], detail: 'Painel de encerramento e próximos passos da campanha.' },
        { time: '12:00', title: 'Confraternização e Atendimento', detail: 'Espaço aberto para conversar com a equipe.' },
      ],
    },
  ];
  const days = Array.isArray(programacao) && programacao.length ? programacao : defaultDays;

  const tabsNav = days.map((d, idx) =>
    `<button type="button" class="hs-tab${idx === 0 ? ' is-active' : ''}" role="tab" id="tab-${e(d.id)}" aria-selected="${idx === 0 ? 'true' : 'false'}" aria-controls="panel-${e(d.id)}" data-hs-tab="${e(d.id)}">${e(d.label)}</button>`
  ).join('');

  const tabPanels = days.map((d, idx) => `
    <div class="hs-panel" role="tabpanel" id="panel-${e(d.id)}" aria-labelledby="tab-${e(d.id)}"${idx === 0 ? '' : ' hidden'}>
      <div class="lp-faq">
        ${d.sessions.map((s) => `
          <details>
            <summary><span class="hs-time">${e(s.time)}</span><span class="hs-title">${e(s.title)}</span></summary>
            <p class="muted">${e(s.detail)}</p>
          </details>`).join('')}
      </div>
    </div>`).join('');

  const heroMedia = photoFile
    ? `<div class="lp-media lp-photo"><img data-parallax src="${e(photoFile)}" alt="${e(identity.marca)}" style="width:100%;height:100%;object-fit:cover;object-position:50% ${Math.round((identity.focal?.hero?.y ?? 0.45) * 100)}%">${photo?.credit ? `<small class="hs-credit">Foto: ${e(photo.credit)}</small>` : ''}</div>`
    : `<div class="lp-media hs-geo"><div class="hs-geo-box" data-parallax><span class="hs-eyebrow">${e(identity.marca)}</span><strong>${e(dataLabel)}</strong><p class="muted">${e(localLabel)}</p></div></div>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(identity.marca)} — Hotsite & Programação</title>
<style>
${kitRootVars(identity)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--color-background-main);color:var(--color-text-primary);font-family:var(--font-body);line-height:1.55;overflow-x:hidden}
h1,h2,h3{font-family:var(--font-heading)}
.muted{color:var(--color-text-muted)}
.lp-wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 24px}
.lp-nav{display:flex;align-items:center;justify-content:space-between;gap:16px}
.lp-logo{height:40px;display:flex;align-items:center}.lp-logo svg{height:100%;width:auto;display:block}
.lp-nav,.lp-foot-row{min-width:0;flex-wrap:nowrap}.lp-foot-row{flex-wrap:wrap}
.lp-logo{flex:1 1 auto;min-width:0}.lp-logo svg{max-width:100%}
.lp-nav .cta{flex:none;max-width:48%;text-align:center}
.cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--color-cta-bg);color:var(--color-cta-text);font-family:var(--font-heading);font-weight:700;padding:14px 26px;border-radius:999px;text-decoration:none}
.lp-hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center}
.hs-eyebrow{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--color-accent);margin-bottom:12px}
.lp-media{position:relative;min-height:340px;border-radius:var(--radius-card);overflow:hidden;background:var(--color-surface-card);display:flex;align-items:center;justify-content:center}
.hs-credit{position:absolute;right:12px;bottom:10px;font-size:11px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.7)}
.hs-geo{padding:32px;background:radial-gradient(circle at 80% 20%,color-mix(in srgb,var(--color-primary) 26%,transparent),transparent 60%),var(--color-surface-card)}
.hs-geo-box{padding:28px;border-radius:var(--radius-card);background:var(--color-background-main);border:1px solid color-mix(in srgb,var(--color-primary) 30%,transparent);display:grid;gap:8px;max-width:340px}
.hs-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding-block:24px 48px}
.hs-meta-item{background:var(--color-surface-card);border-radius:var(--radius-card);padding:20px 22px;border:1px solid color-mix(in srgb,var(--color-text-muted) 18%,transparent)}
.hs-meta-item small{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--color-accent);font-weight:700;margin-bottom:6px}
.hs-section{padding-block:var(--dc-section-y)}
.hs-tabs{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 24px}
.hs-tab{border:1px solid color-mix(in srgb,var(--color-text-muted) 30%,transparent);background:var(--color-surface-card);color:var(--color-text-primary);font:700 15px var(--font-heading);padding:12px 22px;border-radius:999px;cursor:pointer;transition:background .3s var(--dc-ease),color .3s var(--dc-ease),border-color .3s var(--dc-ease)}
.hs-tab.is-active,.hs-tab[aria-selected="true"]{background:var(--color-primary);color:var(--color-cta-text);border-color:var(--color-primary)}
.hs-time{display:inline-block;min-width:72px;font-family:var(--font-heading);font-weight:800;color:var(--color-primary)}
.hs-title{flex:1;font-weight:700}
.hs-loc-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:stretch}
.lp-card{background:var(--color-surface-card);border-radius:var(--radius-card);border:1px solid color-mix(in srgb,var(--color-text-muted) 20%,transparent)}
.hs-loc-card{display:grid;gap:14px;align-content:start}
.hs-list{list-style:none;display:grid;gap:10px;margin-top:8px}
.hs-list li{padding-left:18px;position:relative}
.hs-list li::before{content:"•";position:absolute;left:0;color:var(--color-primary);font-weight:800}
.lp-footer{border-top:1px solid color-mix(in srgb,var(--color-text-muted) 20%,transparent)}
.lp-foot-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
@media(max-width:860px){.lp-hero-grid,.hs-meta,.hs-loc-grid{grid-template-columns:1fr}}
@media(max-width:680px){.lp-logo{height:34px}.lp-nav{gap:10px}.lp-nav .cta{font-size:13px;line-height:1.2;padding:9px 14px;max-width:42%}.hs-page h1,.hs-page h2,.hs-page h3,.hs-page p,.hs-page .cta{overflow-wrap:anywhere}}
${CONSTITUTION_CSS}
</style></head><body>
${constitutionShell({ cta: identity.headlines.cta_principal, whatsapp })}
<div class="landing hs-page">
  <header class="lp-header"><div class="lp-wrap lp-nav"><div class="lp-logo">${identity.logo_svg}</div><a class="cta" href="${e(href)}">${e(identity.headlines.cta_principal)}</a></div></header>
  <section class="lp-hero"><div class="lp-wrap lp-hero-grid">
    <div class="lp-hero-copy">
      <span class="hs-eyebrow">Programação Oficial · ${e(identity.marca)}</span>
      <h1>${e(identity.headlines.hero)}</h1>
      <p class="muted lp-sub">${e(identity.headlines.subtitulo)}</p>
      <div><a class="cta" href="${e(href)}">${e(identity.headlines.cta_principal)}</a></div>
    </div>
    ${heroMedia}
  </div></section>
  <section class="lp-wrap hs-meta" aria-label="Resumo do evento">
    <div class="hs-meta-item" data-reveal style="--i:1"><small>Data & Horário</small><strong>${e(dataLabel)}</strong></div>
    <div class="hs-meta-item" data-reveal style="--i:2"><small>Local</small><strong>${e(localLabel)}</strong></div>
    <div class="hs-meta-item" data-reveal style="--i:3"><small>Organização</small><strong>${e(identity.marca)}</strong></div>
  </section>
  <section class="hs-section" id="programacao"><div class="lp-wrap">
    <h2 class="lp-sec-title" data-reveal>Programação Completa</h2>
    <div class="hs-tabs" role="tablist" aria-label="Dias da programação">${tabsNav}</div>
    ${tabPanels}
  </div></section>
  <section class="hs-section" id="localizacao"><div class="lp-wrap">
    <h2 class="lp-sec-title" data-reveal>Localização & Acesso</h2>
    <div class="hs-loc-grid">
      <article class="lp-card hs-loc-card" data-reveal style="--i:1">
        <h3>${e(localLabel)}</h3>
        <p class="muted">Data: ${e(dataLabel)}</p>
        <p class="muted">Confirme o endereço e orientações de chegada antes do evento pelos canais oficiais.</p>
        <div><a class="cta" href="${e(mapsHref)}"${identity.evento.local ? ' target="_blank" rel="noopener noreferrer"' : ''}>${identity.evento.local ? 'Abrir rota no Mapa' : 'Confirmar local com a equipe'}</a></div>
      </article>
      <article class="lp-card hs-loc-card" data-reveal style="--i:2">
        <h3>O que esperar</h3>
        <ul class="hs-list">${identity.beneficios.map((b) => `<li>${e(b)}</li>`).join('')}</ul>
      </article>
    </div>
  </div></section>
  <footer class="lp-footer" id="contato"><div class="lp-wrap lp-foot-row"><div class="lp-logo">${identity.logo_svg}</div><small class="muted">© ${e(identity.marca)} · Programação sujeita a atualização</small></div></footer>
</div>
<script>
(() => {
  const tabs = document.querySelectorAll('[data-hs-tab]');
  const panels = document.querySelectorAll('.hs-panel');
  tabs.forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.hsTab;
    tabs.forEach((b) => {
      const active = b.dataset.hsTab === id;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach((p) => { p.hidden = p.id !== 'panel-' + id; });
  }));
})();
${CONSTITUTION_JS}
</script>
</body></html>\n`;
}

/** 3. Assinatura de E-mail HTML + Cabeçalho de Newsletter (tabelas inline compatíveis com Gmail/Outlook). */
export function renderEmailKitHTML(identity) {
  const e = escapeXML;
  const c = identity.kit.colors;
  const ev = [identity.evento.data, identity.evento.local].filter(Boolean).join(' · ');

  const signatureHtml = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;border-collapse:collapse;max-width:520px;background:${c.surface};border-radius:12px;overflow:hidden;border:1px solid ${c.primary}">
  <tr>
    <td style="width:6px;background:${c.primary}">&nbsp;</td>
    <td style="padding:16px 20px;color:${c.text}">
      <div style="font-size:17px;font-weight:800;letter-spacing:0.5px;color:${c.text}">${e(identity.marca)}</div>
      <div style="font-size:13px;color:${c.accent};margin-top:2px;font-weight:700">${e(identity.nicho || identity.headlines.hero)}</div>
      <div style="font-size:12px;color:${c.muted};margin-top:8px;line-height:1.45">${e(identity.headlines.subtitulo)}</div>
      ${ev ? `<div style="font-size:12px;color:${c.text};margin-top:6px;font-weight:700">${e(ev)}</div>` : ''}
    </td>
  </tr>
</table>`;

  const newsletterHeaderHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:${c.bg};border-radius:16px;overflow:hidden;border:1px solid ${c.surface}">
  <tr>
    <td style="height:5px;background:${c.primary};font-size:0;line-height:0">&nbsp;</td>
  </tr>
  <tr>
    <td style="padding:32px 28px;color:${c.text}">
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${c.accent};margin-bottom:10px">${e(identity.marca)}</div>
      <div style="font-size:26px;font-weight:800;line-height:1.18;color:${c.text};margin-bottom:10px">${e(identity.headlines.hero)}</div>
      <div style="font-size:15px;line-height:1.5;color:${c.muted};margin-bottom:18px">${e(identity.headlines.subtitulo)}</div>
      ${ev ? `<div style="display:inline-block;padding:8px 14px;border-radius:999px;background:${c.surface};color:${c.text};font-size:12px;font-weight:700">${e(ev)}</div>` : ''}
    </td>
  </tr>
</table>`;

  const previewHtml = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(identity.marca)} — Assinatura de E-mail & Cabeçalho de Newsletter</title>
<style>
${kitRootVars(identity)}
*{box-sizing:border-box}body{margin:0;padding:32px 20px;background:var(--color-background-main);color:var(--color-text-primary);font-family:var(--font-body);line-height:1.5}
.wrap{max-width:740px;margin:0 auto;display:grid;gap:28px}
.box{background:var(--color-surface-card);border-radius:18px;padding:24px;border:1px solid color-mix(in srgb,var(--color-text-muted) 22%,transparent);display:grid;gap:16px}
h1,h2{font-family:var(--font-heading);margin:0}
.preview{padding:20px;border-radius:12px;background:#ffffff;overflow:auto}
.btn{justify-self:start;border:0;cursor:pointer;background:var(--color-primary);color:var(--color-cta-text);font:700 14px var(--font-heading);padding:12px 20px;border-radius:999px}
textarea{width:100%;min-height:110px;font:12px/1.4 monospace;padding:12px;border-radius:10px;border:1px solid color-mix(in srgb,var(--color-text-muted) 30%,transparent);background:var(--color-background-main);color:var(--color-text-primary)}
.st{font-size:13px;color:var(--color-accent);min-height:1.2em}
</style></head><body>
<main class="wrap">
  <header><h1>Kit de E-mail — ${e(identity.marca)}</h1><p>Copie o HTML pronto abaixo para colar no Gmail, Outlook, RD Station ou Mailchimp.</p></header>
  <section class="box">
    <h2>1. Assinatura de E-mail HTML</h2>
    <div class="preview">${signatureHtml}</div>
    <textarea id="code-sig" readonly>${e(signatureHtml)}</textarea>
    <button type="button" class="btn" data-copy="code-sig">Copiar HTML da Assinatura</button>
    <span class="st" id="st-code-sig" role="status"></span>
  </section>
  <section class="box">
    <h2>2. Cabeçalho de Newsletter (640px)</h2>
    <div class="preview">${newsletterHeaderHtml}</div>
    <textarea id="code-news" readonly>${e(newsletterHeaderHtml)}</textarea>
    <button type="button" class="btn" data-copy="code-news">Copiar HTML do Cabeçalho</button>
    <span class="st" id="st-code-news" role="status"></span>
  </section>
</main>
<script>
document.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
  const id = btn.dataset.copy;
  const el = document.getElementById(id);
  const st = document.getElementById('st-' + id);
  try { await navigator.clipboard.writeText(el.value); st.textContent = 'HTML copiado!'; }
  catch { el.select(); st.textContent = 'Selecione e copie o código acima.'; }
}));
</script>
</body></html>\n`;

  return { previewHtml, signatureHtml, newsletterHeaderHtml };
}
