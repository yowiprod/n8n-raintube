// NODO: "Auto-Generar Episodio"
// Elige un audio no usado del catalogo + genera SEO con IA (OpenRouter).
// Produce los mismos campos que "Seleccionar Episodio" para alimentar el pipeline.
const fs = require('fs');
const https = require('https');

const CATALOG = 'E:/RainTube/config/audio-catalog.json';
const PLACES  = 'E:/RainTube/config/used-places.json';
const LOG     = 'E:/RainTube/logs/videos_publicados.json';

// 1. Elegir el siguiente audio no usado
const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const audio = catalog.find(a => !a.used);
if (!audio) throw new Error('No quedan audios sin usar en el catalogo.');

// 2. Lugares ya usados (para no repetir)
let usedPlaces = [];
try { usedPlaces = JSON.parse(fs.readFileSync(PLACES, 'utf8')); } catch (e) { usedPlaces = []; }

// 3. Numero de episodio = max del log + 1
let episodio = 31;
try {
  const logs = JSON.parse(fs.readFileSync(LOG, 'utf8'));
  const maxEp = Math.max(0, ...logs.map(l => l.episodio || 0));
  episodio = maxEp + 1;
} catch (e) {}

// 4. Prompt para el LLM segun el tipo de sonido
const typeLabel = {
  rain: 'lluvia', water: 'agua / arroyo', ocean: 'olas del mar',
  storm: 'lluvia y truenos', waterfall: 'cascada'
}[audio.sound_type] || 'lluvia';

const prompt = `Eres un experto en SEO de YouTube para un canal de videos ambientales relajantes de 8 horas con pantalla negra.
Genera el SEO para un nuevo video cuyo audio es: ${typeLabel}.
REGLAS DEL TITULO (estrictas):
- En ESPAÑOL.
- Formato: "<Lluvia|Sonido de Agua|Olas del Mar|Lluvia y Tormenta|Sonido de Cascadas> <preposicion natural: en/sobre/de/del/de las> <LUGAR EXOTICO REAL> 8 Horas <un emoji> Dormir, Estudiar y Relajarse". Elige TU la preposicion que suene natural; NUNCA escribas "en/sobre" literal.
- El lugar debe ser REAL, evocador y exotico (montañas, selvas, islas, templos, lagos, ciudades, costas...).
- SOLO temas de lluvia o agua. NUNCA ventilador, ruido blanco, bebe, perro.
- NO reutilices ninguno de estos lugares ya usados: ${JSON.stringify(usedPlaces)}
Devuelve SOLO un objeto JSON compacto, sin markdown, con las claves:
{"place":"...","emoji":"...","title":"...","description":"<3-4 parrafos cortos en ESPAÑOL: 8 horas de sonido, perfecto para dormir/estudiar/relajarse, llamada a suscribirse, y varios hashtags>","tags":"12 etiquetas en español separadas por comas"}`;

// 5. Llamar OpenRouter
const apiKey = $env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error('Falta OPENROUTER_API_KEY en el entorno.');

const body = JSON.stringify({
  model: 'openai/gpt-4o-mini',
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.9,
  max_tokens: 900
});

const llmRaw = await new Promise((resolve, reject) => {
  const req = https.request('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      if (res.statusCode !== 200) { reject(new Error('OpenRouter HTTP ' + res.statusCode + ': ' + d.slice(0, 200))); return; }
      try { resolve(JSON.parse(d).choices[0].message.content); }
      catch (e) { reject(new Error('Respuesta LLM invalida: ' + d.slice(0, 200))); }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

// 6. Parsear el JSON del LLM (quitar posibles ```json fences)
let seo;
try {
  const clean = llmRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
  seo = JSON.parse(clean);
} catch (e) {
  throw new Error('No se pudo parsear el SEO del LLM: ' + llmRaw.slice(0, 200));
}
if (!seo.title || !seo.place) throw new Error('SEO incompleto del LLM: ' + JSON.stringify(seo).slice(0, 150));

// 7. Construir paths (slug del lugar)
const slug = seo.place.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const audio_path = `E:/RainTube/ep${episodio}_${slug}.mp3`;
const video_path = `E:/RainTube/output/RainTube-ep${episodio}-${slug}-8h.mp4`;
const audio_url  = `https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/${audio.acast_id}/media.mp3`;

// 8. Guardar estado: marcar audio usado + registrar lugar + guardar SEO
audio.used = true;
fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2));
usedPlaces.push(seo.place);
fs.writeFileSync(PLACES, JSON.stringify(usedPlaces, null, 2));
const seoPath = `E:/RainTube/config/seo-ep${episodio}-${slug}.json`;
fs.writeFileSync(seoPath, JSON.stringify({ episode: episodio, place: seo.place, title: seo.title, description: seo.description, tags: seo.tags, sound_type: audio.sound_type, acast_id: audio.acast_id }, null, 2));

console.log(`Auto-generado EP${episodio}: ${seo.title}`);

// 9. Devolver en el formato que espera el pipeline
return [{ json: {
  episodio,
  audio_url,
  audio_path,
  video_path,
  seo_path: seoPath,
  titulo: seo.title,
  descripcion: seo.description,
  keyword: (seo.tags || '').split(',')[0].trim(),
  privacy: 'unlisted'
} }];
