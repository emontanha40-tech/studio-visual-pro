function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export function renderShowcase(job) {
  const showcase = job?.showcase;
  if (!showcase) return;

  const { presentation, webPreviewSpec } = showcase;
  setText('campaign-title', presentation.campaignTitle);
  setText('hero-headline', webPreviewSpec.heroHeadline);
  setText('hero-subheadline', webPreviewSpec.heroSubheadline);

  const hero = document.getElementById('hero-section');
  if (hero) {
    hero.style.background = webPreviewSpec.backgroundColor;
    hero.style.borderLeft = `6px solid ${webPreviewSpec.accentColor}`;
  }

  const qaBadge = document.getElementById('qa-badge');
  if (qaBadge && job.qaReview) {
    qaBadge.textContent = job.qaReview.passed
      ? 'QA Visual: Aprovado (revisão humana pendente)'
      : `QA Visual: ${job.qaReview.issues.length} alerta(s)`;
  }

  const paletteBar = document.getElementById('palette-bar');
  if (paletteBar) {
    paletteBar.textContent = '';
    for (const color of presentation.palette) {
      const chip = document.createElement('div');
      chip.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;border:1px solid #334155;border-radius:8px;';
      const swatch = document.createElement('span');
      swatch.style.cssText = `width:18px;height:18px;border-radius:4px;background:${color.hex};display:inline-block;`;
      const label = document.createElement('span');
      label.textContent = `${color.name} (${color.hex})`;
      chip.append(swatch, label);
      paletteBar.appendChild(chip);
    }
  }

  const slidesGrid = document.getElementById('slides-grid');
  if (slidesGrid) {
    slidesGrid.textContent = '';
    for (const slide of presentation.slides) {
      const card = document.createElement('article');
      card.style.cssText = 'border:1px solid #334155;border-radius:12px;padding:16px;';
      const title = document.createElement('strong');
      title.textContent = `${slide.title} (${slide.assetFormat})`;
      const meta = document.createElement('p');
      meta.style.cssText = 'margin:8px 0 0;font-size:13px;opacity:0.8;';
      meta.textContent = `Tipo: ${slide.backgroundType} • Transição: ${slide.transition} • ${slide.durationMs}ms`;
      card.append(title, meta);
      slidesGrid.appendChild(card);
    }
  }

  const galleryGrid = document.getElementById('gallery-grid');
  if (galleryGrid) {
    galleryGrid.textContent = '';
    for (const asset of webPreviewSpec.galleryAssets) {
      const card = document.createElement('article');
      card.style.cssText = 'border:1px solid #334155;border-radius:12px;padding:14px;';
      const title = document.createElement('strong');
      title.textContent = asset.format;
      const model = document.createElement('p');
      model.style.cssText = 'margin:6px 0 0;font-size:12px;opacity:0.8;';
      model.textContent = `Motor: ${asset.modelId}${asset.upscaledUrl ? ' + Upscale 4x' : ''}${asset.videoUrl ? ' + Teaser Vídeo' : ''}`;
      card.append(title, model);
      galleryGrid.appendChild(card);
    }
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  const jobId = params.get('jobId');
  if (jobId) {
    fetch(`/api/campaigns/${encodeURIComponent(jobId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Campanha não encontrada'))))
      .then((job) => renderShowcase(job))
      .catch((err) => setText('hero-subheadline', err.message));
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const form = document.getElementById('campaign-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('campaign-submit');
    const brief = Object.fromEntries(
      [...new FormData(form)].filter(([, v]) => String(v).trim() !== ''),
    );
    button.disabled = true;
    setText('campaign-status', 'Produzindo campanha… pode levar alguns minutos.');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(brief),
      });
      const body = await res.json();
      if (!res.ok && !body.showcase) {
        throw new Error(body.erro || body.error || `Falha (${res.status})`);
      }
      history.replaceState(null, '', `?jobId=${encodeURIComponent(body.id)}`);
      setText('campaign-status', `Status: ${body.status}`);
      renderShowcase(body);
    } catch (err) {
      setText('campaign-status', err.message);
    } finally {
      button.disabled = false;
    }
  });
}
