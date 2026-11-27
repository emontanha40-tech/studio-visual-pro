const $ = (id) => document.getElementById(id);
let extracaoAtual = null;

async function lerJsonSeguro(res) {
  try { return await res.json(); } catch { return null; }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo local.'));
    reader.readAsDataURL(file);
  });
}

// Alternância de abas (URL / Imagem / Vídeo)
document.querySelectorAll('.lab-tabs [data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.lab-tabs [data-tab]').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    ['url', 'image', 'video'].forEach((id) => {
      const p = $(`panel-${id}`);
      if (p) p.hidden = id !== tab;
    });
  });
});

function renderPreview(result) {
  extracaoAtual = result;
  $('lab-preview').hidden = false;
  $('sl-go-kit').hidden = true;
  $('sl-save-status').textContent = '';
  $('sl-preset-name').value = result.suggested_name || 'Estilo Extraído';

  const warnBox = $('sl-warnings');
  if (Array.isArray(result.warnings) && result.warnings.length) {
    warnBox.hidden = false;
    warnBox.textContent = result.warnings.join(' ');
  } else {
    warnBox.hidden = true;
    warnBox.textContent = '';
  }

  const swatches = $('sl-swatches');
  swatches.textContent = '';
  const colors = result.brand_kit?.colors || {};
  for (const [role, hex] of Object.entries(colors)) {
    const item = document.createElement('div');
    item.className = 'lab-swatch';
    const dot = document.createElement('span');
    dot.style.background = hex;
    const label = document.createElement('small');
    label.textContent = `${role} ${hex}`;
    item.append(dot, label);
    swatches.append(item);
  }

  const metrics = $('sl-metrics');
  metrics.textContent = '';
  const kit = result.brand_kit || {};
  const dna = result.dna || {};
  const cards = [
    ['Origem', result.origem || dna.source_type || '—'],
    ['Fonte Display', (kit.typography?.display || 'Inter').split(',')[0]],
    ['Border Radius', kit.spacing?.cardRadius || '18px'],
    ['Espaçamento', kit.spacing?.sectionY || '84px'],
    ['Curva CSS', kit.motion?.easing || 'cubic-bezier(0.16, 1, 0.3, 1)'],
  ];
  if (dna.teaser) {
    cards.push(['Ritmo de Cortes', `${dna.teaser.avg_scene_seconds}s / cena (${dna.teaser.cut_count} cortes)`]);
    cards.push(['Ritmo Teaser 60s', dna.teaser.pace]);
  }
  if (dna.art_direction?.style) {
    cards.push(['Direção de Arte', dna.art_direction.style]);
  }
  for (const [k, v] of cards) {
    const c = document.createElement('div');
    c.className = 'lab-metric';
    const strong = document.createElement('strong');
    strong.textContent = k;
    const span = document.createElement('span');
    span.textContent = String(v);
    c.append(strong, span);
    metrics.append(c);
  }

  const kfBox = $('sl-keyframes');
  kfBox.textContent = '';
  if (Array.isArray(dna.keyframes_preview) && dna.keyframes_preview.length) {
    kfBox.hidden = false;
    for (const kf of dna.keyframes_preview) {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = kf.data_url;
      img.alt = `Keyframe em ${kf.time_s}s`;
      const cap = document.createElement('figcaption');
      cap.textContent = `Keyframe · ${kf.time_s}s`;
      fig.append(img, cap);
      kfBox.append(fig);
    }
  } else {
    kfBox.hidden = true;
  }

  const cleanDna = { ...dna };
  delete cleanDna.keyframes_preview;
  $('sl-json').textContent = JSON.stringify({ brand_kit: kit, dna: cleanDna }, null, 2);
}

$('sl-btn-url').addEventListener('click', async () => {
  const url = $('sl-url').value.trim();
  const st = $('sl-status-url');
  const btn = $('sl-btn-url');
  if (!url) { st.textContent = 'Informe a URL de um site.'; return; }
  btn.disabled = true;
  st.textContent = 'Analisando DOM e Computed Styles via Playwright…';
  try {
    const res = await fetch('/api/style-lab/extract/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await lerJsonSeguro(res);
    if (!res.ok || !data?.ok) { st.textContent = data?.erro || `Erro HTTP ${res.status}`; return; }
    st.textContent = 'DNA extraído com sucesso.';
    renderPreview(data);
  } catch {
    st.textContent = 'Erro de rede ao extrair DNA da URL.';
  } finally {
    btn.disabled = false;
  }
});

$('sl-btn-image').addEventListener('click', async () => {
  const file = $('sl-image').files?.[0];
  const st = $('sl-status-image');
  const btn = $('sl-btn-image');
  if (!file) { st.textContent = 'Selecione uma imagem PNG, JPG ou WebP.'; return; }
  btn.disabled = true;
  st.textContent = 'Extraindo direção de arte e paleta…';
  try {
    const imageBase64 = await fileToBase64(file);
    const res = await fetch('/api/style-lab/extract/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType: file.type || 'image/png', filename: file.name }),
    });
    const data = await lerJsonSeguro(res);
    if (!res.ok || !data?.ok) { st.textContent = data?.erro || `Erro HTTP ${res.status}`; return; }
    st.textContent = 'DNA da imagem extraído.';
    renderPreview(data);
  } catch {
    st.textContent = 'Erro ao enviar imagem.';
  } finally {
    btn.disabled = false;
  }
});

$('sl-btn-video').addEventListener('click', async () => {
  const file = $('sl-video').files?.[0];
  const st = $('sl-status-video');
  const btn = $('sl-btn-video');
  if (!file) { st.textContent = 'Selecione um vídeo MP4.'; return; }
  btn.disabled = true;
  st.textContent = 'Detectando cortes de cena e keyframes com FFmpeg…';
  try {
    const res = await fetch(`/api/style-lab/extract/video?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4' },
      body: file,
    });
    const data = await lerJsonSeguro(res);
    if (!res.ok || !data?.ok) { st.textContent = data?.erro || `Erro HTTP ${res.status}`; return; }
    st.textContent = 'Ritmo de vídeo e DNA extraídos.';
    renderPreview(data);
  } catch {
    st.textContent = 'Erro ao analisar vídeo.';
  } finally {
    btn.disabled = false;
  }
});

$('sl-save').addEventListener('click', async () => {
  if (!extracaoAtual) return;
  const name = $('sl-preset-name').value.trim();
  const st = $('sl-save-status');
  const btn = $('sl-save');
  if (!name) { st.textContent = 'Informe um nome para o preset.'; return; }
  btn.disabled = true;
  st.textContent = 'Salvando no SQLite…';
  try {
    const dnaToSave = { ...(extracaoAtual.dna || {}) };
    delete dnaToSave.keyframes_preview;
    const res = await fetch('/api/style-lab/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        source_type: dnaToSave.source_type || 'url',
        source_ref: dnaToSave.source_ref || '',
        dna: dnaToSave,
      }),
    });
    const data = await lerJsonSeguro(res);
    if (!res.ok || !data?.ok) { st.textContent = data?.erro || `Erro HTTP ${res.status}`; return; }
    st.textContent = `Salvo como "${data.preset.name}"! Já disponível em Modelo Visual.`;
    const go = $('sl-go-kit');
    go.href = `/kit?modelo=${encodeURIComponent(data.preset.id)}`;
    go.hidden = false;
    await carregarPresetsSalvos();
  } catch {
    st.textContent = 'Erro de rede ao salvar preset.';
  } finally {
    btn.disabled = false;
  }
});

async function carregarPresetsSalvos() {
  const list = $('sl-list');
  list.textContent = 'Carregando presets…';
  try {
    const res = await fetch('/api/style-lab/presets');
    const data = await lerJsonSeguro(res);
    if (!res.ok || !data?.ok) { list.textContent = 'Falha ao carregar presets.'; return; }
    list.textContent = '';
    if (!data.customizados.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'Nenhum preset extraído ainda. Use uma URL, imagem ou vídeo MP4 acima para criar o primeiro.';
      list.append(p);
      return;
    }
    for (const preset of data.customizados) {
      const card = document.createElement('article');
      card.className = 'lab-preset-card';
      const head = document.createElement('div');
      head.className = 'lab-preset-head';
      const h3 = document.createElement('h3');
      h3.textContent = preset.name;
      const badge = document.createElement('span');
      badge.className = 'acervo-badge';
      badge.textContent = { url: 'URL', image: 'Imagem', video: 'Vídeo MP4' }[preset.source_type] || preset.source_type;
      head.append(h3, badge);

      const sw = document.createElement('div');
      sw.className = 'lab-mini-swatches';
      const cols = preset.brand_kit?.colors || {};
      for (const k of ['bg', 'surface', 'primary', 'accent', 'text']) {
        if (!cols[k]) continue;
        const i = document.createElement('i');
        i.style.background = cols[k];
        i.title = `${k}: ${cols[k]}`;
        sw.append(i);
      }

      const meta = document.createElement('p');
      meta.className = 'muted';
      const teaserInfo = preset.brand_kit?.teaser ? ` · Ritmo ${preset.brand_kit.teaser.avg_scene_seconds}s/cena` : '';
      meta.textContent = (preset.source_ref || preset.id) + teaserInfo;

      const actions = document.createElement('div');
      actions.className = 'row';
      const useLink = document.createElement('a');
      useLink.className = 'btn btn-secondary';
      useLink.href = `/kit?modelo=${encodeURIComponent(preset.id)}`;
      useLink.textContent = 'Usar no Kit';
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-chip';
      delBtn.textContent = 'Remover';
      delBtn.addEventListener('click', async () => {
        delBtn.disabled = true;
        await fetch(`/api/style-lab/presets/${encodeURIComponent(preset.id)}`, { method: 'DELETE' });
        await carregarPresetsSalvos();
      });
      actions.append(useLink, delBtn);

      card.append(head, sw, meta, actions);
      list.append(card);
    }
  } catch {
    list.textContent = 'Erro ao carregar presets.';
  }
}

void carregarPresetsSalvos();
