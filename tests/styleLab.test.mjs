import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { dnaToBrandKit, slugifyPresetId, contrastRatio } from '../src/style-lab/dna.mjs';
import { openStyleStore } from '../src/style-lab/store.mjs';
import { validateReferenceUrl, buildUrlDnaFromSnapshot, extractStyleFromUrl } from '../src/style-lab/urlExtractor.mjs';
import { parseImageDnaJson, samplePaletteWithFfmpeg, extractStyleFromImage } from '../src/style-lab/imageExtractor.mjs';
import { parseSceneTimestamps, computeVideoPace, extractStyleFromVideo } from '../src/style-lab/videoExtractor.mjs';
import { createServer } from '../server.mjs';

function req(server, path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, 'http://127.0.0.1');
    const reqHeaders = { ...headers };
    let payload = null;
    if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) {
      payload = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    } else if (Buffer.isBuffer(body)) {
      payload = body;
      reqHeaders['Content-Length'] = body.length;
    }
    const r = http.request({
      hostname: '127.0.0.1',
      port: server.address().port,
      path: u.pathname + u.search,
      method,
      headers: reqHeaders,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(raw.toString('utf8')); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, raw, json });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

test('Fatia 12 — DNA Normalizer garante contraste WCAG AA, tipografia e motion', () => {
  const kit = dnaToBrandKit({
    name: 'Estilo Teste & Luxo',
    dna: {
      palette: {
        bg: '#05070f',
        primary: '#3366ff',
        text: '#000000', // Contraste propositalmente baixo sobre #05070f para testar auto-correção
      },
      typography: {
        display: 'Custom Display Font, sans-serif',
        weightDisplay: 900,
        tracking: '-0.04em',
      },
      spacing: { sectionY: '90px', cardRadius: '24px' },
      motion: { easing: 'cubic-bezier(0.16, 1, 0.3, 1)', durationMs: 400 },
      teaser: { avg_scene_seconds: 4.5, pace: 'fast', cut_count: 8 },
    },
  });

  assert.equal(kit.id, 'custom-estilo-teste-luxo');
  assert.equal(kit.nome, 'Estilo Teste & Luxo');
  assert.equal(kit.custom, true);
  assert.ok(contrastRatio(kit.colors.text, kit.colors.bg) >= 4.5, 'Texto deve respeitar contraste WCAG AA >= 4.5:1');
  assert.ok(contrastRatio(kit.colors.primary, kit.colors.bg) >= 3.0, 'Primary deve ter contraste visual');
  assert.equal(kit.typography.weightDisplay, 900);
  assert.equal(kit.spacing.cardRadius, '24px');
  assert.equal(kit.motion.durationMs, 400);
  assert.equal(kit.teaser.pace, 'fast');
  assert.equal(kit.teaser.avg_scene_seconds, 4.5);
});

test('Fatia 12 — Store SQLite (styleStore): salva, lista, recupera e remove presets', () => {
  const store = openStyleStore(':memory:');
  try {
    const saved = store.savePreset({
      name: 'Modern Neo-Brutalist',
      source_type: 'url',
      source_ref: 'https://linear.app',
      dna: {
        palette: { bg: '#0b0c10', primary: '#5e6ad2' },
        spacing: { cardRadius: '8px' },
      },
    });

    assert.ok(saved.id.startsWith('custom-modern-neo-brutalist'));
    assert.equal(saved.source_type, 'url');
    assert.equal(saved.source_ref, 'https://linear.app');
    assert.ok(saved.brand_kit);

    const list = store.listPresets();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, saved.id);

    const one = store.getPreset(saved.id);
    assert.equal(one?.name, 'Modern Neo-Brutalist');

    const deleted = store.deletePreset(saved.id);
    assert.equal(deleted, true);
    assert.equal(store.listPresets().length, 0);
    assert.equal(store.getPreset(saved.id), null);
  } finally {
    store.close();
  }
});

test('Fatia 12 — Extrator de URL: validação de segurança e conversão de Computed Styles', () => {
  assert.throws(() => validateReferenceUrl(''), /válida/);
  assert.throws(() => validateReferenceUrl('ftp://example.com'), /HTTP/);
  assert.throws(() => validateReferenceUrl('http://127.0.0.1:4173'), /privados/);
  assert.equal(validateReferenceUrl('https://example.com'), 'https://example.com/');
  assert.equal(validateReferenceUrl('http://localhost:3000', { allowPrivate: true }), 'http://localhost:3000/');

  const result = buildUrlDnaFromSnapshot({
    title: 'Stripe · Financial Infrastructure',
    bg: '#0a2540',
    surface: '#1a365d',
    text: '#ffffff',
    primary: '#635bff',
    h1Size: 56,
    h2Size: 36,
    bodySize: 18,
    cardRadius: '12px',
    sectionY: '96px',
    shadows: ['rgba(0, 0, 0, 0.1) 0px 4px 12px'],
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    durationMs: 350,
  }, 'https://stripe.com');

  assert.equal(result.origem, 'playwright-dom');
  assert.equal(result.suggested_name, 'Stripe');
  assert.equal(result.dna.palette.bg, '#0a2540');
  assert.equal(result.dna.typography.scale.ratio, 3.11);
  assert.equal(result.brand_kit.colors.bg, '#0a2540');
  assert.ok(contrastRatio(result.brand_kit.colors.text, result.brand_kit.colors.bg) >= 4.5);
});

test('Fatia 12 — Extrator de Imagem (Gemini Vision JSON parser & fallback)', () => {
  const jsonRaw = JSON.stringify({
    suggested_name: 'Editorial Cyberpunk',
    palette: { bg: '#080811', surface: '#111222', primary: '#ff0055', accent: '#00ffff', text: '#ffffff', muted: '#8899aa' },
    art_direction: { style: 'Futurista Neon', mood: 'Vibrante', composition: 'Central com grid assimétrico' },
    breathing_room: { level: 'balanced', sectionY: '88px', cardRadius: '16px' },
    contrast: { level: 'high', mode: 'dark' },
    photo_treatment: { grade: 'Alto contraste saturado', vignette: 'subtle', css_filter: 'contrast(1.1)' },
    hierarchy: { font_style: 'sans', display_weight: 800, tracking: '-0.03em', emphasis: 'Título forte' },
  });

  const parsed = parseImageDnaJson(jsonRaw);
  assert.equal(parsed.suggested_name, 'Editorial Cyberpunk');
  assert.equal(parsed.dna.palette.primary, '#ff0055');
  assert.equal(parsed.dna.breathing_room.level, 'balanced');
  assert.equal(parsed.dna.contrast.mode, 'dark');

  const kit = dnaToBrandKit({ name: parsed.suggested_name, dna: parsed.dna });
  assert.equal(kit.nome, 'Editorial Cyberpunk');
  assert.equal(kit.colors.primary, '#ff0055');
});

test('Fatia 12 — Extrator de Vídeo: cena, cortes e ritmo para o Teaser 60s', () => {
  const fakeStderr = `
[Parsed_showinfo_1 @ 0x5555] n:   12 pts:   3600 pts_time:1.200000 pos:  12040 fmt:rgb24 sar:1/1 s:640x360
[Parsed_showinfo_1 @ 0x5555] n:   45 pts:  10500 pts_time:3.500000 pos:  35000 fmt:rgb24 sar:1/1 s:640x360
[Parsed_showinfo_1 @ 0x5555] n:   98 pts:  21000 pts_time:7.000000 pos:  72000 fmt:rgb24 sar:1/1 s:640x360
`;
  const cuts = parseSceneTimestamps(fakeStderr);
  assert.deepEqual(cuts, [1.2, 3.5, 7]);

  const paceFast = computeVideoPace(8, cuts);
  assert.equal(paceFast.cut_count, 3);
  assert.equal(paceFast.avg_scene_seconds, 2);
  assert.equal(paceFast.pace, 'fast');
  assert.equal(paceFast.transition_frames, 6);

  const paceCinematic = computeVideoPace(30, [15]);
  assert.equal(paceCinematic.pace, 'cinematic');
  assert.equal(paceCinematic.transition_frames, 16);
});

test('Fatia 12 — Rotas HTTP /api/style-lab e integração transparente com /kit e SQLite', async () => {
  const styleStore = openStyleStore(':memory:');
  const app = createServer({ styleStore });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));

  try {
    // 1. GET inicial de presets
    const listRes = await req(app, '/api/style-lab/presets');
    assert.equal(listRes.status, 200);
    assert.equal(listRes.json.ok, true);
    assert.ok(Array.isArray(listRes.json.nativos));
    assert.equal(listRes.json.customizados.length, 0);

    // 2. POST salva um preset customizado no SQLite
    const saveRes = await req(app, '/api/style-lab/presets', 'POST', {
      name: 'Luxo Esmeralda',
      source_type: 'image',
      source_ref: 'referencia.png',
      dna: {
        palette: {
          bg: '#04100c',
          surface: '#0a221b',
          primary: '#10b981',
          accent: '#34d399',
          text: '#f0fdf4',
        },
        typography: { display: 'Georgia, serif', weightDisplay: 700 },
        spacing: { cardRadius: '14px', sectionY: '90px' },
      },
    });

    assert.equal(saveRes.status, 201);
    assert.equal(saveRes.json.ok, true);
    const presetId = saveRes.json.preset.id;
    assert.ok(presetId.startsWith('custom-luxo-esmeralda'));

    // 3. GET agora lista o preset customizado
    const listAfter = await req(app, '/api/style-lab/presets');
    assert.equal(listAfter.json.customizados.length, 1);
    assert.equal(listAfter.json.customizados[0].id, presetId);

    // 4. /api/kit/identity reconhece automaticamente o preset salvo no SQLite
    const identRes = await req(app, '/api/kit/identity', 'POST', {
      marca: 'Esmeralda Joias',
      nicho: 'joalheria',
      slogan: 'Elegância que transcende o tempo',
      subtitulo: 'Coleções exclusivas com design refinado',
      modelo: presetId,
    });

    assert.equal(identRes.status, 200);
    assert.equal(identRes.json.ok, true);
    assert.equal(identRes.json.identidade.kit.colors.primary, '#10b981');
    assert.equal(identRes.json.identidade.kit.colors.bg, '#04100c');

    // 5. DELETE preset
    const delRes = await req(app, `/api/style-lab/presets/${presetId}`, 'DELETE');
    assert.equal(delRes.status, 200);
    assert.equal(delRes.json.ok, true);

    const listEmpty = await req(app, '/api/style-lab/presets');
    assert.equal(listEmpty.json.customizados.length, 0);

    // 6. Rota estática do Laboratório de Estilo (/estilo e /estilo.mjs)
    const pageRes = await req(app, '/estilo');
    assert.equal(pageRes.status, 200);
    assert.ok(pageRes.raw.toString('utf8').includes('Laboratório de Estilo'));

    const jsRes = await req(app, '/estilo.mjs');
    assert.equal(jsRes.status, 200);
    assert.ok(jsRes.raw.toString('utf8').includes('carregarPresetsSalvos'));
  } finally {
    styleStore.close();
    await new Promise((r) => app.close(r));
  }
});

test('Gemini Vision usa chave no cabeçalho, saída JSON limitada e tempo máximo', async () => {
  const image = Buffer.from('89504e470d0a1a0a0000000000000000', 'hex');
  const result = await extractStyleFromImage(image, {
    apiKey: 'chave-de-teste',
    fetchImpl: async (url, options) => {
      assert.equal(new URL(url).search, '');
      assert.equal(options.headers['x-goog-api-key'], 'chave-de-teste');
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(JSON.parse(options.body).generationConfig.responseMimeType, 'application/json');
      return Response.json({ candidates: [{ content: { parts: [
        { text: JSON.stringify({ palette: { bg: '#234567' }, art_direction: { mood: 'Editorial' } }) },
      ] } }] });
    },
  });
  assert.equal(result.origem, 'gemini-vision');
  assert.equal(result.dna.palette.bg, '#234567');
  assert.equal(result.dna.art_direction.mood, 'Editorial');
});

test('SQLite reconstrói o preset a partir dos dados, ignorando CSS e kit arbitrários', () => {
  const store = openStyleStore(':memory:');
  try {
    const saved = store.savePreset({
      id: 'editorial-clean',
      name: 'Referência editorial',
      dna: {
        typography: { display: 'url(https://example.com/font)' },
        spacing: { cardRadius: '100000rem' },
      },
      brand_kit: { colors: { bg: 'inválido' } },
    });
    assert.equal(saved.id, 'custom-referencia-editorial');
    assert.equal(saved.brand_kit.colors.bg, '#090e1d');
    assert.equal(saved.brand_kit.spacing.cardRadius, '18px');
    assert.match(saved.brand_kit.typography.display, /^Inter/);
  } finally {
    store.close();
  }
});
