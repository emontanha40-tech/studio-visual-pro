let selectedTpl = 'tech-cinematografico';

document.querySelectorAll('.ws-tpl').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ws-tpl').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    selectedTpl = btn.dataset.t;
  });
});

document.querySelectorAll('.ws-chip').forEach((chip) => {
  chip.addEventListener('click', () => chip.classList.toggle('on'));
});

const frame = document.getElementById('ws-frame');
document.getElementById('ws-desk').addEventListener('click', () => frame.classList.remove('mobile'));
document.getElementById('ws-mob').addEventListener('click', () => frame.classList.add('mobile'));

document.getElementById('ws-build').addEventListener('click', async () => {
  const st = document.getElementById('ws-status');
  st.textContent = '⚙️ Gerando site no motor SVP + QA Visual...';
  const mods = [...document.querySelectorAll('.ws-chip.on')].map((c) => c.dataset.m);
  const payload = {
    slug: document.getElementById('ws-slug').value.trim() || 'connect-oficial',
    marca: document.getElementById('ws-marca').value.trim(),
    subtitulo_marca: document.getElementById('ws-submarca').value.trim(),
    slogan: document.getElementById('ws-slogan').value.trim(),
    subtitulo: document.getElementById('ws-sub').value.trim(),
    ritmo_scroll: document.getElementById('ws-ritmo').value,
    modelo: selectedTpl,
    modulos_ativos: mods,
    logo_path: '/home/ubuntu/workspaces/Projetos/connect-site-piloto/logo-connect.jpg',
    devices_image: '/home/ubuntu/workspaces/Projetos/connect-site-piloto/devices-real.jpg',
    telao_image: '/home/ubuntu/workspaces/Projetos/connect-site-piloto/telao-rua.jpg',
    founder_photo: '/home/ubuntu/workspaces/Projetos/connect-site-piloto/eduardo-criador.jpg',
  };
  try {
    const r = await fetch('/api/website/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (d.ok) {
      const url = `/api/website/preview/${d.slug}/index.html?t=${Date.now()}`;
      frame.src = url;
      document.getElementById('ws-open').href = url;
      st.textContent = `✅ Site "${d.slug}" gerado e auditado no modelo ${selectedTpl}!`;
    } else {
      st.textContent = `⚠️ Falha: ${d.erro || JSON.stringify(d)}`;
    }
  } catch (e) {
    st.textContent = `❌ Erro de conexão: ${e.message}`;
  }
});
