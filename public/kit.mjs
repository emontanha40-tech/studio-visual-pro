const $ = (id) => document.getElementById(id);
let catalogo = null;
let identidadeValidada = null;

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
function montarPecas() {
  const root = $('k-pecas'); root.textContent = '';
  for (const cat of catalogo.categorias) {
    const h = document.createElement('h3'); h.textContent = cat.name; root.append(h);
    for (const p of catalogo.pecas.filter((x) => x.category === cat.id)) {
      const l = document.createElement('label'); l.style.display = 'block';
      const c = document.createElement('input'); c.type = 'checkbox'; c.value = p.id; c.style.width = 'auto'; c.style.marginRight = '8px';
      const size = p.height ? ` (${p.width}×${p.height} ${p.unit || 'px'})` : '';
      const proof = p.print?.provisional ? ' · prova 1:10, gabarito a confirmar' : '';
      l.append(c, p.name + size + proof); root.append(l);
    }
  }
  const pr = $('k-presets'); pr.textContent = '';
  for (const preset of catalogo.presets) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = preset.name;
    b.addEventListener('click', () => marcar(preset.pieces)); pr.append(b, ' ');
  }
  marcar(catalogo.presets[0].pieces);
}

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
    st.textContent = `Pronto: ${r.headers.get('X-Kit-Pecas')} peças no ZIP.`;
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
