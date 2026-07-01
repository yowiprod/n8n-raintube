import os
import json, urllib.request

API_KEY = os.environ.get('N8N_API_KEY', '')
WF_ID = '0cXOVkPTk4oQDIsV'

# Configurar Shorts - returns 2 items
config_code = """const fs = require('fs');
const body = $input.first().json?.body || $input.first().json || {};
let EP = parseInt(body.episodio);

if (!EP || isNaN(EP)) throw new Error('Falta episodio. Envia {"episodio": 6}');

const episodios = {
  1: { audio_path: 'E:\\\\RainTube\\\\ep1_tormenta_oceano.mp3', keyword_es: 'tormenta y oceano', keyword_en: 'ocean storm' },
  2: { audio_path: 'E:\\\\RainTube\\\\ep2_gran_tormenta.mp3', keyword_es: 'gran tormenta de lluvia', keyword_en: 'heavy rain thunderstorm' },
  3: { audio_path: 'E:\\\\RainTube\\\\ep3_islas_griegas.mp3', keyword_es: 'agua de islas griegas', keyword_en: 'greek island water' },
  4: { audio_path: 'E:\\\\RainTube\\\\ep4_ruido_blanco_bebe.mp3', keyword_es: 'ruido blanco para bebe', keyword_en: 'white noise baby' },
  5: { audio_path: 'E:\\\\RainTube\\\\ep5_ruido_blanco_agua.mp3', keyword_es: 'ruido blanco de agua', keyword_en: 'water white noise' },
  6: { audio_path: 'E:\\\\RainTube\\\\ep6_ventilador_gigante.mp3', keyword_es: 'ventilador gigante', keyword_en: 'giant fan white noise' }
};

const ep = episodios[EP];
if (!ep) throw new Error('Episodio ' + EP + ' no definido.');
if (!fs.existsSync(ep.audio_path)) throw new Error('Audio no existe: ' + ep.audio_path);

const shorts = [
  {
    episodio: EP, audio_path: ep.audio_path, short_name: 'short1', ss: 1800,
    video_path: 'E:\\\\RainTube\\\\output\\\\short-ep' + EP + '-short1.mp4',
    titulo: 'No puedes dormir? Prueba este sonido de ' + ep.keyword_es + ' #shorts',
    descripcion: 'Sonido relajante de ' + ep.keyword_es + ' para dormir rapido. 3 minutos de puro relax.\\n\\nSuscribete para mas sonidos relajantes.\\n#shorts #sonidosparadormir #ruidoblanco',
    tags: ep.keyword_es + ',shorts,dormir,relax,ruido blanco,' + ep.keyword_en + ',sleep,white noise',
    privacy: 'unlisted'
  },
  {
    episodio: EP, audio_path: ep.audio_path, short_name: 'short2', ss: 14400,
    video_path: 'E:\\\\RainTube\\\\output\\\\short-ep' + EP + '-short2.mp4',
    titulo: 'Sonido de ' + ep.keyword_es + ' para concentrarte al maximo #shorts',
    descripcion: '3 minutos de ' + ep.keyword_es + ' para estudiar o trabajar con concentracion total.\\n\\nSuscribete para mas sonidos de concentracion.\\n#shorts #estudiar #concentracion',
    tags: ep.keyword_es + ',shorts,estudiar,concentracion,focus,' + ep.keyword_en + ',study,work',
    privacy: 'unlisted'
  }
];

return shorts.map(s => ({ json: s }));"""

# FFmpeg - Crear Short (per item)
ffmpeg_code = """const { spawn } = require('child_process');
const fs = require('fs');
const datos = $input.first().json;

if (fs.existsSync(datos.video_path)) {
  const size = fs.statSync(datos.video_path).size;
  if (size > 100000) {
    console.log('Short ya existe: ' + datos.video_path + ' (' + Math.round(size/1024/1024) + ' MB)');
    return [{ json: datos }];
  }
  fs.unlinkSync(datos.video_path);
}

console.log('Creando ' + datos.short_name + ' desde segundo ' + datos.ss + '...');

const FFMPEG = 'C:\\\\Users\\\\Jowy\\\\AppData\\\\Local\\\\Microsoft\\\\WinGet\\\\Packages\\\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\\\ffmpeg-8.0.1-full_build\\\\bin\\\\ffmpeg.exe';

await new Promise((resolve, reject) => {
  const proc = spawn(FFMPEG, [
    '-y',
    '-ss', String(datos.ss + 86),
    '-t', '180',
    '-i', datos.audio_path,
    '-f', 'lavfi', '-i', 'color=c=black:s=1080x1920:r=24',
    '-map', '1:v', '-map', '0:a',
    '-af', 'afade=t=in:d=0.3,afade=t=out:st=179.7:d=0.3',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest',
    datos.video_path
  ]);

  let stderr = '';
  proc.stderr.on('data', d => {
    stderr += d.toString();
    if (stderr.length > 5000) stderr = stderr.substring(stderr.length - 3000);
  });
  proc.on('close', code => {
    if (code === 0) resolve();
    else reject(new Error('FFmpeg code ' + code + ': ' + stderr.slice(-300)));
  });
  proc.on('error', e => reject(e));
});

const sizeMB = Math.round(fs.statSync(datos.video_path).size / 1024 / 1024);
console.log(datos.short_name + ' creado: ' + sizeMB + ' MB');

return [{ json: datos }];"""

# YouTube - Subir Short (Code node, per item, uses upload URL from HTTP Request)
upload_code = """const fs = require('fs');
const https = require('https');
const datos = $('FFmpeg - Crear Short').first().json;
const response = $input.first().json;
const uploadUrl = response.headers?.location || response.headers?.Location;

if (!uploadUrl) throw new Error('No upload URL. Status: ' + (response.statusCode || 'unknown') + ' Body: ' + JSON.stringify(response.body || response).slice(0, 500));

const fileSize = fs.statSync(datos.video_path).size;
console.log('Subiendo ' + datos.short_name + ': ' + Math.round(fileSize/1024/1024) + ' MB');

const result = await new Promise((resolve, reject) => {
  const fileStream = fs.createReadStream(datos.video_path);
  const req = https.request(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Length': fileSize, 'Content-Type': 'video/mp4' }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch(e) { reject(new Error('Respuesta invalida: ' + body)); }
    });
  });
  req.on('error', reject);
  fileStream.pipe(req);
});

if (!result.id) throw new Error('No video ID: ' + JSON.stringify(result).slice(0, 300));

console.log(datos.short_name + ' subido: https://www.youtube.com/shorts/' + result.id);

return [{ json: {
  video_id: result.id,
  url: 'https://www.youtube.com/shorts/' + result.id,
  titulo: result.snippet?.title || datos.titulo,
  status: result.status?.uploadStatus,
  episodio: datos.episodio,
  short_name: datos.short_name
} }];"""

# Guardar Log
log_code = """const fs = require('fs');
const upload = $input.first().json;

const log = {
  fecha: new Date().toISOString(),
  episodio: upload.episodio,
  short_name: upload.short_name,
  video_id: upload.video_id,
  url: upload.url,
  titulo: upload.titulo,
  status: upload.status
};

const logPath = 'E:\\\\RainTube\\\\logs\\\\shorts_publicados.json';
let logs = [];
try { logs = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch(e) {}
logs.push(log);
fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
console.log('Short guardado: ' + upload.url);

return [{ json: { mensaje: 'Short EP' + upload.episodio + ' ' + upload.short_name + ' publicado', url: upload.url, titulo: upload.titulo } }];"""

workflow = {
    "name": "RainTube - Crear y Subir Shorts",
    "nodes": [
        {
            "parameters": {
                "httpMethod": "POST",
                "path": "raintube-shorts",
                "options": {}
            },
            "id": "short-webhook",
            "name": "Webhook Shorts",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [400, 500]
        },
        {
            "parameters": {"jsCode": config_code},
            "id": "short-config",
            "name": "Configurar Shorts",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [640, 500]
        },
        {
            "parameters": {"jsCode": ffmpeg_code},
            "id": "short-ffmpeg",
            "name": "FFmpeg - Crear Short",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [880, 500]
        },
        {
            "parameters": {
                "method": "POST",
                "url": "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
                "authentication": "predefinedCredentialType",
                "nodeCredentialType": "youTubeOAuth2Api",
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [
                        {"name": "Content-Type", "value": "application/json"},
                        {"name": "X-Upload-Content-Type", "value": "video/mp4"}
                    ]
                },
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={{ ({ snippet: { title: $json.titulo, description: $json.descripcion, categoryId: '22', defaultLanguage: 'es', defaultAudioLanguage: 'es' }, status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false, license: 'creativeCommon' } }) }}",
                "options": {
                    "response": {
                        "response": {
                            "fullResponse": True,
                            "neverError": True
                        }
                    }
                }
            },
            "id": "short-yt-init",
            "name": "YouTube - Iniciar Upload Short",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [1120, 500],
            "credentials": {
                "youTubeOAuth2Api": {
                    "id": "7pPcu6xc0jmPO7pQ",
                    "name": "YouTube account"
                }
            }
        },
        {
            "parameters": {"jsCode": upload_code},
            "id": "short-yt-upload",
            "name": "YouTube - Subir Short",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1360, 500]
        },
        {
            "parameters": {"jsCode": log_code},
            "id": "short-log",
            "name": "Guardar Log Short",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1600, 500]
        }
    ],
    "connections": {
        "Webhook Shorts": {"main": [[{"node": "Configurar Shorts", "type": "main", "index": 0}]]},
        "Configurar Shorts": {"main": [[{"node": "FFmpeg - Crear Short", "type": "main", "index": 0}]]},
        "FFmpeg - Crear Short": {"main": [[{"node": "YouTube - Iniciar Upload Short", "type": "main", "index": 0}]]},
        "YouTube - Iniciar Upload Short": {"main": [[{"node": "YouTube - Subir Short", "type": "main", "index": 0}]]},
        "YouTube - Subir Short": {"main": [[{"node": "Guardar Log Short", "type": "main", "index": 0}]]},
    },
    "settings": {"executionOrder": "v1"}
}

data = json.dumps(workflow).encode('utf-8')
req = urllib.request.Request(
    'http://localhost:5678/api/v1/workflows/' + WF_ID,
    data=data, method='PUT',
    headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY}
)
resp = urllib.request.urlopen(req)
result = json.loads(resp.read())
print('Workflow actualizado:', result.get('name'))
print('ID:', result.get('id'))
print('Updated:', result.get('updatedAt'))
