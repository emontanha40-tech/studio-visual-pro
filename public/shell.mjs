// Shell único do SVP: mesma sidebar em /, /website, /showcase e /kit.
const ITENS = [
  ['01', 'Briefing', '/#brief', 'brief'],
  ['02', 'Direção criativa', '/#directions', 'directions'],
  ['03', 'Aprovações', '/#approval', 'approval'],
  ['04', 'Produção', '/#delivery', 'delivery'],
  ['05', 'Acervo', '/#acervo', 'acervo'],
  ['06', 'Criador de Sites', '/website', 'website'],
  ['07', 'Kit em Lote', '/kit', 'kit'],
];
const path = location.pathname.replace(/\/$/, '') || '/';
const rota = { '/website': 'website', '/kit': 'kit', '/showcase': 'showcase' }[path] || 'home';

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...kids);
  return n;
}

document.querySelectorAll('body > aside').forEach((a) => a.remove());
const nav = el('nav', { 'aria-label': 'Menu principal', id: 'svp-nav' });
const links = ITENS.map(([n, label, href, key]) => {
  const a = el('a', { href }, el('b', {}, n), label);
  nav.append(a);
  return { a, key };
});
const brand = el('a', { class: 'brand', href: '/' }, 'SV', el('span', {}, 'P'), el('small', {}, 'STUDIO VISUAL PRO'));
const toggle = el('button', { type: 'button', class: 'svp-toggle', 'aria-expanded': 'false', 'aria-controls': 'svp-nav', 'aria-label': 'Abrir menu' }, '☰');
const aside = el('aside', { class: 'svp-shell' }, brand, toggle,
  el('p', { class: 'aside-label' }, 'SEU ESTÚDIO, ORGANIZADO'), nav,
  el('p', { class: 'aside-footer' }, 'Studio Visual Pro', el('br'), 'Motor de produção ativo'));
document.body.prepend(aside);
document.body.classList.add('has-shell');

function ativar(key) {
  for (const l of links) {
    const on = l.key === key;
    l.a.classList.toggle('active', on);
    if (on) l.a.setAttribute('aria-current', 'page'); else l.a.removeAttribute('aria-current');
  }
}
if (rota === 'home') {
  const ids = ['brief', 'directions', 'approval', 'delivery', 'acervo'];
  const doHash = () => ativar(ids.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'brief');
  doHash();
  addEventListener('hashchange', doHash);
  const obs = new IntersectionObserver((es) => {
    const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (v) ativar(v.target.id);
  }, { rootMargin: '-10% 0px -70% 0px' });
  ids.forEach((id) => { const s = document.getElementById(id); if (s) obs.observe(s); });
} else {
  ativar(rota);
}

function fechar() { aside.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Abrir menu'); }
toggle.addEventListener('click', () => {
  const open = aside.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
});
nav.addEventListener('click', (e) => { if (e.target.closest('a')) fechar(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
