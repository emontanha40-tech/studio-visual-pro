const $ = (id) => document.getElementById(id);
let catalogo = null;
let identidadeValidada = null;

async function carregarModelosCustomizados() {
  const select = $('k-modelo');
  if (!select) return;
  try {
    const res = await fetch('/api/style-lab/presets');
    const data = await lerJsonSeguro(res);
    if (!res.ok || !data?.ok || !Array.isArray(data.customizados)) return;
    select.querySelectorAll('optgroup[data-custom="1"]').forEach((g) => g.remove());
    if (data.customizados.length) {
      const group = document.createElement('optgroup');
      group.label = 'Laboratório de Estilo (Extraídos)';
      group.dataset.custom = '1';
      for (const preset of data.customizados) {
        const opt = document.createElement('option');
        opt.value = preset.id;
        const tag = { url: 'URL', image: 'Arte', video: 'Vídeo' }[preset.source_type] || 'DNA';
        opt.textContent = `${preset.name} (${tag})`;
        group.append(opt);
      }
      select.append(group);
    }
    const qsModelo = new URLSearchParams(location.search).get('modelo');
    if (qsModelo && [...select.options].some((o) => o.value === qsModelo)) {
      select.value = qsModelo;
    }
  } catch {
    // mantém os modelos nativos se a API estiver indisponível
  }
}
void carregarModelosCustomizados();

function dados() {
  return {
    marca: $('k-marca').value, nicho: $('k-nicho').value, slogan: $('k-slogan').value,
    subtitulo: $('k-sub').value, data: $('k-data').value, local: $('k-local').value, modelo: $('k-modelo').value,
  };
}
async function post(url, body) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
async function lerJsonSeguro(res) {
  try { return await res.json(); } catch { return null; }
}
function invalidarIdentidade() {
  if (!identidadeValidada) return;
  identidadeValidada = null;
  $('etapa2').hidden = true;
  $('k-identidade').textContent = 'Campos alterados. Clique em "Validar identidade" novamente antes de gerar o lote.';
  $('k-status').textContent = '';
  $('k-teaser-result').hidden = true;
  $('k-teaser-video').pause();
  $('k-teaser-status').textContent = '';
}
document.querySelectorAll('#etapa1 input, #etapa1 select').forEach((el) => {
  el.addEventListener('input', invalidarIdentidade);
  el.addEventListener('change', invalidarIdentidade);
});
function marcar(ids) {
  document.querySelectorAll('#k-pecas input[type=checkbox]').forEach((c) => { c.checked = ids.includes(c.value); });
}
const ICONES = {
  web: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
  social: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  projecao: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  impressos: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><rect x="6" y="14" width="12" height="7"/>',
  video: '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 10l4-2v8l-4-2"/>',
};
function icone(cat) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONES[cat] || ICONES.web; // constante local, sem entrada do usuário
  return svg;
}
function montarPecas() {
  const root = $('k-pecas'); root.textContent = '';
  for (const cat of catalogo.categorias) {
    const h = document.createElement('h3'); h.className = 'cat-title'; h.textContent = cat.name; root.append(h);
    const grid = document.createElement('div'); grid.className = 'piece-grid';
    for (const p of catalogo.pecas.filter((x) => x.category === cat.id)) {
      const l = document.createElement('label'); l.className = 'piece';
      const c = document.createElement('input'); c.type = 'checkbox'; c.value = p.id;
      const txt = document.createElement('span');
      const n = document.createElement('span'); n.className = 'pn'; n.textContent = p.name;
      const d = document.createElement('span'); d.className = 'pd';
      const size = p.height ? `${p.width}×${p.height} ${p.unit || 'px'}` : `${p.width} px de largura`;
      const extra = p.print?.provisional ? ' · prova 1:10, gabarito a confirmar' : p.transparent ? ' · fundo transparente' : '';
      d.textContent = size + extra;
      txt.append(n, d); l.append(c, icone(cat.id), txt); grid.append(l);
    }
    root.append(grid);
  }
  const pr = $('k-presets'); pr.textContent = '';
  for (const preset of catalogo.presets) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-chip'; b.textContent = preset.name;
    b.addEventListener('click', () => marcar(preset.pieces)); pr.append(b);
  }
  marcar(catalogo.presets[0].pieces);
}

$('k-ai').addEventListener('click', async () => {
  const btn = $('k-ai'); const st = $('k-ai-status');
  const briefing = $('k-ai-texto').value.trim();
  if (briefing.length < 10) { st.textContent = 'Descreva o negócio em pelo menos 10 caracteres.'; return; }
  btn.disabled = true; st.textContent = 'Preenchendo…';
  try {
    const r = await post('/api/kit/ai-fill', { briefing });
    const j = await lerJsonSeguro(r);
    if (!r.ok || !j?.ok) { st.textContent = j?.erro || `Falha ao preencher (HTTP ${r.status}).`; return; }
    const m = { marca: 'k-marca', nicho: 'k-nicho', slogan: 'k-slogan', subtitulo: 'k-sub', modelo: 'k-modelo' };
    for (const [campo, id] of Object.entries(m)) if (j.campos[campo]) $(id).value = j.campos[campo];
    invalidarIdentidade();
    st.textContent = (j.origem === 'deterministic' ? 'Preenchido por regras locais' : 'Preenchido por IA') + ' — revise e clique em "Validar identidade".';
  } catch {
    st.textContent = 'Erro de rede. Tente novamente.';
  } finally {
    btn.disabled = false;
  }
});

$('k-validar').addEventListener('click', async () => {
  const btn = $('k-validar');
  const out = $('k-identidade');
  const snapshot = dados();
  btn.disabled = true;
  identidadeValidada = null;
  $('etapa2').hidden = true;
  out.textContent = 'Validando…';
  try {
    const r = await post('/api/kit/identity', snapshot);
    const j = await lerJsonSeguro(r);
    if (!r.ok || !j?.ok) {
      out.textContent = j?.erro || `Falha ao validar identidade (HTTP ${r.status}).`;
      return;
    }
    if (!catalogo) {
      const catRes = await fetch('/api/kit/catalog');
      const catJson = await lerJsonSeguro(catRes);
      if (!catRes.ok || !catJson?.pecas) {
        out.textContent = catJson?.erro || `Falha ao carregar catálogo (HTTP ${catRes.status}).`;
        return;
      }
      catalogo = catJson;
    }
    if (JSON.stringify(dados()) !== JSON.stringify(snapshot)) {
      out.textContent = 'Campos alterados. Valide a identidade novamente.';
      return;
    }
    const id = j.identidade; out.textContent = '';
    const sw = document.createElement('div');
    for (const [k, v] of Object.entries(id.kit.colors)) { const i = document.createElement('i'); i.title = `${k} ${v}`; i.style.cssText = `display:inline-block;width:28px;height:28px;border-radius:50%;margin:2px;background:${v}`; sw.append(i); }
    const logo = document.createElement('img'); logo.alt = 'Logo paramétrico'; logo.height = 48;
    logo.src = `data:image/svg+xml;utf8,${encodeURIComponent(id.logo_svg)}`;
    const info = document.createElement('p');
    info.textContent = 'Contraste: ' + id.contraste.map((c) => `${c.papel} ${c.ratio}:1`).join(' · ') + (id.avisos.length ? ' | ' + id.avisos.join(' ') : '');
    out.append(logo, sw, info);
    identidadeValidada = snapshot;
    montarPecas(); $('etapa2').hidden = false;
  } catch {
    out.textContent = 'Erro de rede ao validar identidade. Tente novamente.';
  } finally {
    btn.disabled = false;
  }
});

$('k-gerar').addEventListener('click', async () => {
  const btn = $('k-gerar');
  const pieces = [...document.querySelectorAll('#k-pecas input:checked')].map((c) => c.value);
  const st = $('k-status');
  if (!identidadeValidada) { st.textContent = 'Valide a identidade antes de gerar o lote.'; return; }
  if (!pieces.length) { st.textContent = 'Marque ao menos uma peça.'; return; }
  btn.disabled = true;
  st.textContent = $('k-zip-teaser').checked ? 'Gerando peças e teaser (cerca de 30 s)…' : 'Gerando…';
  try {
    const r = await post('/api/kit/build', { ...identidadeValidada, pieces, ...($('k-zip-teaser').checked && { teaser: $('k-teaser-format').value }) });
    if (!r.ok) {
      const errJson = await lerJsonSeguro(r);
      st.textContent = errJson?.erro || `Falha ao gerar lote (HTTP ${r.status}).`;
      return;
    }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = url; a.download = 'kit-studio-visual-pro.zip'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const liveUrl = r.headers.get('X-Kit-Live-Url');
    st.textContent = `Pronto: ${r.headers.get('X-Kit-Pecas')} peças no ZIP.`;
    if (liveUrl) {
      const link = document.createElement('a');
      link.href = liveUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = ' Abrir Site ao Vivo';
      link.style.marginLeft = '8px';
      st.append(link);
    }
    void carregarHistorico();
  } catch {
    st.textContent = 'Erro de rede ao gerar o lote. Tente novamente.';
  } finally {
    btn.disabled = false;
  }
});


$('k-teaser').addEventListener('click', async () => {
  const snapshot = identidadeValidada;
  if (!snapshot) return;
  const button = $('k-teaser');
  const status = $('k-teaser-status');
  const result = $('k-teaser-result');
  const video = $('k-teaser-video');
  button.disabled = true;
  result.hidden = true;
  video.removeAttribute('src');
  video.load();
  status.textContent = 'Enviando teaser para a fila…';
  try {
    const response = await post('/api/kit/teasers', { ...snapshot, formato: $('k-teaser-format').value });
    const submitted = await lerJsonSeguro(response);
    if (!response.ok || !submitted?.id) throw new Error(submitted?.erro || 'Falha ao solicitar o teaser.');
    const jobUrl = '/api/kit/teasers/' + encodeURIComponent(submitted.id);
    for (let attempt = 0; attempt < 180; attempt++) {
      if (snapshot !== identidadeValidada) return;
      const res = await fetch(jobUrl);
      const job = await lerJsonSeguro(res);
      if (snapshot !== identidadeValidada) return;
      if (!res.ok || !job || job.status === 'failed') throw new Error(job?.erro || 'Falha ao consultar o teaser.');
      if (job.status === 'ready') {
        video.src = job.videoUrl;
        $('k-teaser-download').href = job.videoUrl + '?download=1';
        status.textContent = 'Teaser pronto.';
        result.hidden = false;
        return;
      }
      status.textContent = job.status === 'queued' ? 'Aguardando na fila…' : 'Renderizando o vídeo…';
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('O teaser excedeu o tempo de espera.');
  } catch (error) {
    if (snapshot === identidadeValidada) status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

function formatarDataLote(ms) {
  try {
    return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

async function duplicarBriefing(lote) {
  await carregarModelosCustomizados();
  const b = lote.briefing || {};
  $('k-marca').value = b.marca || lote.marca || '';
  $('k-nicho').value = b.nicho || '';
  $('k-slogan').value = b.slogan || lote.titulo || '';
  $('k-sub').value = b.subtitulo || '';
  $('k-data').value = b.data || '';
  $('k-local').value = b.local || '';
  const select = $('k-modelo');
  const modelo = b.modelo || lote.modelo || 'tech-cinematografico';
  let avisoModelo = '';
  if ([...select.options].some((o) => o.value === modelo)) {
    select.value = modelo;
  } else {
    select.value = 'tech-cinematografico';
    avisoModelo = ' (preset visual original não encontrado; selecionado Tech Cinema)';
  }
  invalidarIdentidade();
  $('k-identidade').textContent = `Briefing de "${lote.marca}" duplicado${avisoModelo}. Ajuste os campos desejados e clique em "Validar identidade".`;
  $('etapa1').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('k-marca').focus();
}

async function carregarHistorico() {
  const root = $('k-historico');
  if (!root) return;
  try {
    const res = await fetch('/api/kit/history');
    const data = await lerJsonSeguro(res);
    if (!res.ok || !data?.ok || !Array.isArray(data.lotes)) {
      root.textContent = '';
      const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Histórico indisponível no momento.';
      root.append(p);
      return;
    }
    root.textContent = '';
    if (!data.lotes.length) {
      const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Nenhuma campanha gerada ainda. Gere seu primeiro lote acima para salvar automaticamente aqui.';
      root.append(p);
      return;
    }
    for (const lote of data.lotes) {
      const card = document.createElement('article');
      card.className = 'kit-history-card';
      card.dataset.batchId = lote.id;

      const head = document.createElement('div');
      head.className = 'kit-history-head';
      const title = document.createElement('h3');
      title.textContent = lote.marca;
      const date = document.createElement('span');
      date.className = 'kit-history-date';
      date.textContent = formatarDataLote(lote.created_at);
      head.append(title, date);

      const slogan = document.createElement('p');
      slogan.className = 'kit-history-title';
      slogan.textContent = lote.titulo;

      const meta = document.createElement('div');
      meta.className = 'kit-history-meta';
      const b1 = document.createElement('span'); b1.className = 'acervo-badge'; b1.textContent = `${lote.pieces_count} peça(s)`;
      const b2 = document.createElement('span'); b2.className = 'acervo-badge'; b2.textContent = lote.modelo;
      meta.append(b1, b2);

      const actions = document.createElement('div');
      actions.className = 'row kit-history-actions';
      if (lote.live_url && lote.live_available) {
        const live = document.createElement('a');
        live.className = 'btn btn-secondary';
        live.href = lote.live_url;
        live.target = '_blank';
        live.rel = 'noopener';
        live.textContent = 'Site ao Vivo';
        actions.append(live);
      }
      const dup = document.createElement('button');
      dup.type = 'button';
      dup.className = 'btn btn-primary';
      dup.dataset.duplicar = lote.id;
      dup.textContent = 'Duplicar Briefing';
      dup.addEventListener('click', () => { void duplicarBriefing(lote); });
      actions.append(dup);

      card.append(head, slogan, meta, actions);
      root.append(card);
    }
  } catch {
    root.textContent = '';
    const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Não foi possível carregar as campanhas recentes.';
    root.append(p);
  }
}
void carregarHistorico();
