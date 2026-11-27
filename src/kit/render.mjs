import { escapeXML } from '../engine.mjs';
import { CONSTITUTION_CSS, CONSTITUTION_JS, constitutionShell } from '../engine/design-constitution.mjs';

const px = (n) => Math.round(n * 100) / 100;

function wrap(text, maxChars, maxLines) {
  const lines = [''];
  for (const w of String(text).split(/\s+/).filter(Boolean)) {
    const i = lines.length - 1;
    if (lines[i] && (lines[i] + ' ' + w).length > maxChars) lines.push(w);
    else lines[i] = (lines[i] + ' ' + w).trim();
  }
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,1}$/, '…'); }
  return lines;
}
const par = (y) => (y < 0.33 ? 'xMidYMin slice' : y > 0.66 ? 'xMidYMax slice' : 'xMidYMid slice');
const photoUri = (photo) => (photo ? `data:${photo.mime};base64,${photo.bytes.toString('base64')}` : null);

/** Peça estática em SVG, determinística: todo texto vem do briefing, nunca de imagem gerada. */
export function renderPieceSVG(piece, identity, photo = null) {
  const { width: W, height: H } = piece;
  const c = identity.kit.colors;
  const font = identity.kit.typography.display;
  const s = piece.safe || { t: 0.05, r: 0.05, b: 0.05, l: 0.05 };
  const x0 = W * s.l, x1 = W * (1 - s.r), y0 = H * s.t, y1 = H * (1 - s.b);
  const cw = x1 - x0;
  const uri = photoUri(photo);
  const bg = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.bg}"/><stop offset="1" stop-color="${c.surface}"/></linearGradient>
<linearGradient id="ov" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.bg}" stop-opacity=".35"/><stop offset=".55" stop-color="${c.bg}" stop-opacity=".78"/><stop offset="1" stop-color="${c.bg}" stop-opacity=".94"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<circle cx="${px(W * 0.85)}" cy="${px(H * 0.12)}" r="${px(Math.min(W, H) * 0.42)}" fill="${c.primary}" opacity=".16"/>
<circle cx="${px(W * 0.1)}" cy="${px(H * 0.95)}" r="${px(Math.min(W, H) * 0.3)}" fill="${c.accent}" opacity=".1"/>
${uri ? `<image href="${uri}" width="${W}" height="${H}" preserveAspectRatio="${par(identity.focal.hero.y)}"/><rect width="${W}" height="${H}" fill="url(#ov)"/>` : ''}`;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escapeXML(piece.name + ' — ' + identity.marca)}">`;

  if (piece.id === 'slide-fundo') return `${head}${bg}</svg>\n`; // fundo limpo, sem texto

  if (piece.id === 'lower-third') {
    const barX = Math.round(W * s.l);
    const barW = Math.round(W * 0.48);
    const barH = 164;
    const barY = Math.round(H * (1 - s.b) - barH);
    const ev = [identity.evento.data, identity.evento.local].filter(Boolean).join('  •  ');
    const titleText = wrap(identity.headlines.hero, 32, 1)[0];
    const subText = wrap(ev || identity.headlines.subtitulo, 46, 1)[0];
    return `${head}<defs><linearGradient id="ltbg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.bg}" stop-opacity=".95"/><stop offset="1" stop-color="${c.surface}" stop-opacity=".9"/></linearGradient></defs>
<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="18" fill="url(#ltbg)" stroke="${c.primary}" stroke-opacity=".45" stroke-width="2"/>
<rect x="${barX}" y="${barY}" width="14" height="${barH}" rx="7" fill="${c.primary}"/>
<rect x="${barX + 40}" y="${barY + 24}" width="180" height="28" rx="14" fill="${c.primary}"/>
<text x="${barX + 130}" y="${barY + 43}" text-anchor="middle" font-family="${escapeXML(font)}" font-weight="800" font-size="16" letter-spacing="2" fill="${c.onPrimary}">${escapeXML(identity.marca.toUpperCase().slice(0, 14))}</text>
<text x="${barX + 40}" y="${barY + 100}" font-family="${escapeXML(font)}" font-weight="${identity.kit.typography.weightDisplay}" font-size="40" fill="${c.text}">${escapeXML(titleText)}</text>
<text x="${barX + 40}" y="${barY + 138}" font-family="${escapeXML(font)}" font-weight="600" font-size="24" fill="${c.muted}">${escapeXML(subText)}</text>
</svg>\n`;
  }

  if (piece.id === 'welcome-countdown') {
    const cx = Math.round(W / 2);
    const ev = [identity.evento.data, identity.evento.local].filter(Boolean).join('  •  ');
    const titleLines = wrap(identity.headlines.hero, 28, 2);
    const titleSvg = titleLines.map((l, i) => `<text x="${cx}" y="${Math.round(y0 + 185 + i * 74)}" text-anchor="middle" font-family="${escapeXML(font)}" font-weight="${identity.kit.typography.weightDisplay}" font-size="64" fill="${c.text}">${escapeXML(l)}</text>`).join('');
    const boxW = 460, boxH = 190, boxX = cx - boxW / 2, boxY = Math.round(y0 + 340);
    return `${head}${bg}
<rect x="${cx - 190}" y="${Math.round(y0 + 24)}" width="380" height="44" rx="22" fill="${c.surface}" stroke="${c.primary}" stroke-width="2"/>
<text x="${cx}" y="${Math.round(y0 + 53)}" text-anchor="middle" font-family="${escapeXML(font)}" font-weight="800" font-size="22" letter-spacing="4" fill="${c.accent}">SEJA BEM-VINDO · ${escapeXML(identity.marca.toUpperCase().slice(0, 16))}</text>
${titleSvg}
<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="28" fill="${c.surface}" fill-opacity=".92" stroke="${c.primary}" stroke-width="3"/>
<text x="${cx}" y="${boxY + 52}" text-anchor="middle" font-family="${escapeXML(font)}" font-weight="700" font-size="20" letter-spacing="4" fill="${c.accent}">COMEÇAMOS EM BREVE</text>
<text x="${cx}" y="${boxY + 148}" text-anchor="middle" font-family="${escapeXML(font)}" font-weight="800" font-size="96" letter-spacing="6" fill="${c.text}">05:00</text>
<text x="${cx}" y="${Math.round(y1 - 36)}" text-anchor="middle" font-family="${escapeXML(font)}" font-weight="600" font-size="28" fill="${c.muted}">${escapeXML((ev || identity.headlines.subtitulo).slice(0, 64))}</text>
</svg>\n`;
  }

  const wide = W / H > 1.3;
  const size = Math.round(Math.min(cw / (wide ? 14 : 9.5), H / (wide ? 9 : 14)));
  const maxChars = Math.max(10, Math.floor(cw / (size * 0.56)));
  const lines = wrap(identity.headlines.hero, maxChars, 5);
  const lh = size * 1.15;
  const blockH = lines.length * lh;
  const ty = piece.id === 'story' ? y0 + (y1 - y0) * 0.38 : y0 + (y1 - y0 - blockH) / 2;
  const subSize = Math.round(size * 0.38);
  const subLines = piece.id === 'slide-capa' ? [] : wrap(identity.headlines.subtitulo, Math.floor(cw / (subSize * 0.56)), 3);
  const sub = subLines.map((l, i) => `<text x="${px(x0)}" y="${px(ty + blockH + subSize * 1.4 + i * subSize * 1.35)}" font-family="${escapeXML(font)}" font-size="${subSize}" fill="${c.muted}">${escapeXML(l)}</text>`).join('');
  const title = lines.map((l, i) => `<text x="${px(x0)}" y="${px(ty + size + i * lh)}" font-family="${escapeXML(font)}" font-weight="${identity.kit.typography.weightDisplay}" font-size="${size}" fill="${c.text}">${escapeXML(l)}</text>`).join('');
  const rule = `<rect x="${px(x0)}" y="${px(ty - size * 0.5)}" width="${px(size * 1.6)}" height="${Math.max(4, Math.round(size * 0.08))}" fill="${c.accent}"/>`;
  const marca = `<text x="${px(x0)}" y="${px(y0 + size * 0.3)}" font-family="${escapeXML(font)}" font-weight="800" font-size="${Math.round(size * 0.32)}" letter-spacing="4" fill="${c.accent}">${escapeXML(identity.marca.toUpperCase().slice(0, 24))}</text>`;
  const ev = [identity.evento.data, identity.evento.local].filter(Boolean).join('  •  ');
  const evSize = Math.round(size * 0.34);
  const evento = ev ? `<text x="${px(x0)}" y="${px(y1 - evSize * 0.2)}" font-family="${escapeXML(font)}" font-weight="700" font-size="${evSize}" fill="${c.text}">${escapeXML(ev.slice(0, Math.floor(cw / (evSize * 0.55))))}</text>` : '';
  const cta = piece.id === 'banner' || piece.id === 'whatsapp' || piece.id === 'feed'
    ? (() => { const bw = Math.min(cw, size * 9), bh = size * 0.9, by = y1 - bh - (ev ? evSize * 1.8 : 0);
      return `<rect x="${px(x0)}" y="${px(by)}" width="${px(bw)}" height="${px(bh)}" rx="${px(bh / 2)}" fill="${c.primary}"/><text x="${px(x0 + bw / 2)}" y="${px(by + bh * 0.65)}" text-anchor="middle" font-family="${escapeXML(font)}" font-weight="800" font-size="${Math.round(size * 0.36)}" fill="${c.onPrimary}">${escapeXML(identity.headlines.cta_principal)}</text>`; })()
    : '';
  return `${head}${bg}${marca}${rule}${title}${sub}${cta}${evento}</svg>\n`;
}

const ICONS = [
  '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  '<path d="M4 18V9M10 18V5M16 18v-7M21 18H3"/>',
];
const icon = (i, color) => `<svg class="ic" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[i % ICONS.length]}</svg>`;

/** Landing Page: foto no hero (se houver), ícones SVG, CTA final e animações de scroll (?static=true as desliga). */
export function renderLandingHTML(identity, { photo = null, photoFile = null, whatsapp = '' } = {}) {
  const c = identity.kit.colors, t = identity.kit.typography, e = escapeXML;
  const wa = /^\d{10,15}$/.test(String(whatsapp)) ? `https://wa.me/${whatsapp}` : '#contato';
  const heroBg = photoFile
    ? `linear-gradient(180deg,${c.bg}99,${c.bg}f2),url('${photoFile}') center ${Math.round(identity.focal.hero.y * 100)}%/cover`
    : `linear-gradient(135deg,${c.bg},${c.surface})`;
  const cards = identity.beneficios.map((b, i) => `<article class="card rv lp-card" data-reveal>${icon(i, c.accent)}<h3>${e(b)}</h3></article>`).join('');
  const credit = photo?.credit ? `<p class="credit">Foto: ${e(photo.credit)}</p>` : '';
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(identity.marca)}</title>
<style>
:root{
  --bg:${c.bg};--surface:${c.surface};--primary:${c.primary};--accent:${c.accent};--text:${c.text};--muted:${c.muted};--onp:${c.onPrimary};
  --color-primary:${c.primary};--color-background-main:${c.bg};--color-text-primary:${c.text};--color-text-muted:${c.muted};
}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:${t.body};line-height:1.55}
h1,h2,h3{font-family:${t.display};font-weight:${t.weightDisplay};letter-spacing:${t.tracking};margin:0}
.wrap{max-width:${identity.kit.spacing.containerMax};margin:0 auto;padding:0 24px}
.hero{min-height:88vh;display:flex;align-items:center;background:${heroBg}}
.hero h1{font-size:clamp(2.2rem,6vw,4.4rem);line-height:1.05;max-width:16ch}.hero p{color:var(--muted);font-size:1.2rem;max-width:44ch}
.btn{display:inline-block;background:var(--primary);color:var(--onp);padding:16px 30px;border-radius:999px;font-weight:800;text-decoration:none}
section.s{padding:${identity.kit.spacing.sectionY} 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:32px}
.card{background:var(--surface);border-radius:${identity.kit.spacing.cardRadius};padding:28px}.card h3{font-size:1.1rem;margin-top:14px}
.cta{background:linear-gradient(135deg,var(--primary),var(--accent));color:var(--onp);text-align:center;padding:96px 24px}
.cta h2{font-size:clamp(1.8rem,4.5vw,3rem);max-width:20ch;margin:0 auto 28px}.cta .btn{background:var(--bg);color:var(--text)}
.credit{color:var(--muted);font-size:.75rem;text-align:center;padding:16px}
.anim .rv{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease}.anim .rv.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.anim .rv{opacity:1;transform:none;transition:none}}
${CONSTITUTION_CSS}
</style></head><body class="landing">
${constitutionShell({ cta: identity.headlines.cta_principal, whatsapp })}
<header class="lp-header">
  <div class="wrap" style="display:flex;justify-content:space-between;align-items:center">
    <div style="height:36px;display:flex;align-items:center">${identity.logo_svg}</div>
    <a class="btn" style="padding:10px 22px;font-size:.9rem" href="${wa}">${e(identity.headlines.cta_principal)}</a>
  </div>
</header>
<header class="hero"><div class="wrap rv lp-hero-copy"><div style="width:220px;margin-bottom:28px">${identity.logo_svg}</div>
<h1 data-reveal>${e(identity.headlines.hero)}</h1><p data-reveal>${e(identity.headlines.subtitulo)}</p><p data-reveal><a class="btn cta" href="${wa}">${e(identity.headlines.cta_principal)}</a></p></div></header>
<section class="s lp-features"><div class="wrap"><h2 class="rv" data-reveal>Por que escolher ${e(identity.marca)}</h2><div class="grid">${cards}</div></div></section>
<section class="cta lp-cta-band" id="contato"><h2 class="rv" data-reveal>Vamos conversar sobre o seu projeto?</h2><a class="btn rv cta" data-reveal href="${wa}">${e(identity.headlines.cta_principal)}</a></section>
${credit}
<script>
${CONSTITUTION_JS}
(function(){var q=new URLSearchParams(location.search);if(q.get('static')==='true')return;
var d=document.documentElement;d.classList.add('anim');
if(!('IntersectionObserver' in window)){d.classList.remove('anim');return}
var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.15});
document.querySelectorAll('.rv').forEach(function(n){io.observe(n)});})();
</script></body></html>
`;
}
