const http = require('http');
const API_KEY = process.env.N8N_API_KEY;
function getWorkflow(wfId) { return new Promise((resolve, reject) => { http.get({ hostname: 'localhost', port: 5678, path: `/api/v1/workflows/${wfId}`, headers: { 'X-N8N-API-KEY': API_KEY } }, (res) => { let body = ''; res.on('data', d => body += d); res.on('end', () => resolve(JSON.parse(body))); }).on('error', reject); }); }
function putWorkflow(wfId, wf) { return new Promise((resolve, reject) => { const clean = {}; ['name','nodes','connections','settings','staticData'].forEach(k => { if (wf[k] !== undefined) clean[k] = wf[k]; }); const data = JSON.stringify(clean); const req = http.request({ hostname: 'localhost', port: 5678, path: `/api/v1/workflows/${wfId}`, method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY, 'Content-Length': Buffer.byteLength(data) } }, (res) => { let body = ''; res.on('data', d => body += d); res.on('end', () => { console.log('PUT status:', res.statusCode); if (res.statusCode >= 400) try { console.log('Error:', JSON.parse(body).message); } catch(e) {} resolve(res.statusCode); }); }); req.on('error', reject); req.write(data); req.end(); }); }

(async () => {
  console.log('=== Add EP6 + Privacy settings ===');
  const wf = await getWorkflow('ogsBUiQWQ6uqiwRi');

  // 1. Update "Seleccionar Episodio" - add EP6, loop to 6, add privacy field
  const selNode = wf.nodes.find(n => n.name === 'Seleccionar Episodio');
  if (selNode) {
    selNode.parameters.jsCode = `const fs = require('fs');

// ── Leer episodio del webhook o auto-detectar ──
const body = $input.first().json?.body || $input.first().json || {};
let EPISODIO = parseInt(body.episodio);

if (!EPISODIO || isNaN(EPISODIO)) {
  const logPath = 'E:\\\\RainTube\\\\logs\\\\videos_publicados.json';
  let publicados = [];
  try { publicados = JSON.parse(fs.readFileSync(logPath, 'utf8')).map(e => e.episodio); }
  catch(e) { publicados = []; }
  for (let i = 1; i <= 6; i++) {
    if (!publicados.includes(i)) { EPISODIO = i; break; }
  }
  if (!EPISODIO) throw new Error('Todos los episodios (1-6) ya han sido publicados.');
  console.log('Auto-detectado: EP' + EPISODIO);
} else {
  console.log('Episodio solicitado: EP' + EPISODIO);
}

const episodios = {
  1: {
    audio_url:  'https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/62df1cbee520ee0013d47a1b/media.mp3',
    audio_path: 'E:\\\\RainTube\\\\ep1_tormenta_oceano.mp3',
    video_path: 'E:\\\\RainTube\\\\output\\\\RainTube-Tormenta-Oceano-8h.mp4',
    seo_path:   'E:\\\\RainTube\\\\config\\\\seo-ep1-tormenta-oceano.json',
    keyword:    'rain ocean waves sleep 8 hours',
    privacy:    'unlisted'
  },
  2: {
    audio_url:  'https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/62df1c32a553700013328d7c/media.mp3',
    audio_path: 'E:\\\\RainTube\\\\ep2_gran_tormenta.mp3',
    video_path: 'E:\\\\RainTube\\\\output\\\\RainTube-Gran-Tormenta-8h.mp4',
    seo_path:   'E:\\\\RainTube\\\\config\\\\seo-ep2-gran-tormenta.json',
    keyword:    'heavy thunderstorm rain sleep 8 hours',
    privacy:    'public'
  },
  3: {
    audio_url:  'https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/62db0f6c2b96360012fd2512/media.mp3',
    audio_path: 'E:\\\\RainTube\\\\ep3_islas_griegas.mp3',
    video_path: 'E:\\\\RainTube\\\\output\\\\RainTube-Islas-Griegas-8h.mp4',
    seo_path:   'E:\\\\RainTube\\\\config\\\\seo-ep3-islas-griegas.json',
    keyword:    'greek island water sounds sleep 8 hours',
    privacy:    'unlisted'
  },
  4: {
    audio_url:  'https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/62df2a1e4d31eb0012ec117d/media.mp3',
    audio_path: 'E:\\\\RainTube\\\\ep4_ruido_blanco_bebe.mp3',
    video_path: 'E:\\\\RainTube\\\\output\\\\RainTube-Ruido-Blanco-Bebe-8h.mp4',
    seo_path:   'E:\\\\RainTube\\\\config\\\\seo-ep4-ruido-blanco-bebe.json',
    keyword:    'white noise baby sleep 8 hours',
    privacy:    'unlisted'
  },
  5: {
    audio_url:  'https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/62db0df003b8d30012f3140d/media.mp3',
    audio_path: 'E:\\\\RainTube\\\\ep5_ruido_blanco_agua.mp3',
    video_path: 'E:\\\\RainTube\\\\output\\\\RainTube-Ruido-Blanco-Agua-8h.mp4',
    seo_path:   'E:\\\\RainTube\\\\config\\\\seo-ep5-ruido-blanco-agua.json',
    keyword:    'water sounds white noise sleep 8 hours',
    privacy:    'unlisted'
  },
  6: {
    audio_url:  'https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/62db2f6103b8d30012f3aabf/media.mp3',
    audio_path: 'E:\\\\RainTube\\\\ep6_ventilador_gigante.mp3',
    video_path: 'E:\\\\RainTube\\\\output\\\\RainTube-Ventilador-Gigante-8h.mp4',
    seo_path:   'E:\\\\RainTube\\\\config\\\\seo-ep6-ventilador-gigante.json',
    keyword:    'giant fan white noise sleep study 8 hours',
    privacy:    'unlisted'
  }
};

const ep = episodios[EPISODIO];
if (!ep) throw new Error('Episodio ' + EPISODIO + ' no definido');
if (!fs.existsSync(ep.seo_path)) throw new Error('SEO no encontrado: ' + ep.seo_path);

const seo = JSON.parse(fs.readFileSync(ep.seo_path, 'utf8'));
const descripcion = seo.es.description + '\\n\\n---\\n\\n' + seo.en.description;

console.log('EP' + EPISODIO + ': ' + seo.es.title);
console.log('Privacy:', ep.privacy);
console.log('Video:', ep.video_path);

return [{ json: {
  episodio: EPISODIO,
  audio_url:  ep.audio_url,
  audio_path: ep.audio_path,
  video_path: ep.video_path,
  seo_path:   ep.seo_path,
  titulo:     seo.es.title,
  descripcion,
  keyword:    ep.keyword,
  privacy:    ep.privacy
} }];`;
    console.log('  Updated: Seleccionar Episodio (EP1-6, privacy per episode)');
  }

  // 2. Update "YouTube - Iniciar Upload" to use dynamic privacy
  const uploadNode = wf.nodes.find(n => n.name === 'YouTube - Iniciar Upload');
  if (uploadNode) {
    // Change jsonBody to use $json.privacy
    uploadNode.parameters.jsonBody = "={{ ({ snippet: { title: $json.titulo, description: $json.descripcion, categoryId: '22', defaultLanguage: 'es', defaultAudioLanguage: 'es' }, status: { privacyStatus: $json.privacy || 'unlisted', selfDeclaredMadeForKids: false, license: 'creativeCommon' } }) }}";
    console.log('  Updated: YouTube - Iniciar Upload (dynamic privacy from episode)');
  }

  await putWorkflow('ogsBUiQWQ6uqiwRi', wf);
  console.log('Done!');
})();
