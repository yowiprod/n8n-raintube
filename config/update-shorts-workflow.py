import os
import json, urllib.request

API_KEY = os.environ.get('N8N_API_KEY', '')
WF_ID = '0cXOVkPTk4oQDIsV'

# Single code node that creates BOTH shorts with FFmpeg
crear_shorts_code = r"""
const { spawn } = require('child_process');
const fs = require('fs');
const datos = $input.first().json;

const FFMPEG = 'C:\\Users\\Jowy\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0.1-full_build\\bin\\ffmpeg.exe';

const results = [];

for (const s of datos.shorts) {
  const videoPath = s.video_path;

  // Skip if already exists and is valid
  if (fs.existsSync(videoPath)) {
    const size = fs.statSync(videoPath).size;
    if (size > 100000) {
      console.log('Short ya existe: ' + videoPath + ' (' + Math.round(size/1024/1024) + ' MB)');
      results.push({ ...s, size_mb: Math.round(size/1024/1024) });
      continue;
    }
    fs.unlinkSync(videoPath);
  }

  console.log('Creando ' + s.short_name + ' desde segundo ' + s.ss + '...');

  await new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, [
      '-y',
      '-ss', String(s.ss + 86),
      '-t', '180',
      '-i', datos.audio_path,
      '-f', 'lavfi', '-i', 'color=c=black:s=1080x1920:r=24',
      '-map', '1:v', '-map', '0:a',
      '-af', 'afade=t=in:d=0.3,afade=t=out:st=179.7:d=0.3',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-c:a', 'aac', '-b:a', '128k',
      '-shortest',
      videoPath
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

  const sizeMB = Math.round(fs.statSync(videoPath).size / 1024 / 1024);
  console.log(s.short_name + ' creado: ' + sizeMB + ' MB');
  results.push({ ...s, size_mb: sizeMB });
}

return [{ json: { ...datos, shorts: results } }];
"""

# Single code node that uploads BOTH shorts to YouTube
subir_shorts_code = r"""
const fs = require('fs');
const https = require('https');
const datos = $input.first().json;

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body && typeof body === 'string') { req.write(body); req.end(); }
    else if (body && body.pipe) { body.pipe(req); }
    else { req.end(); }
  });
}

const credential = $('YouTube - Get Token').first().json;
const accessToken = credential.access_token || credential.oauthTokenData?.access_token;
if (!accessToken) throw new Error('No access token available');

const results = [];

for (const s of datos.shorts) {
  console.log('Subiendo ' + s.short_name + ': ' + s.titulo);

  const fileSize = fs.statSync(s.video_path).size;

  // Step 1: Get resumable upload URL
  const metadata = JSON.stringify({
    snippet: {
      title: s.titulo,
      description: s.descripcion,
      categoryId: '22',
      defaultLanguage: 'es',
      defaultAudioLanguage: 'es'
    },
    status: {
      privacyStatus: 'unlisted',
      selfDeclaredMadeForKids: false,
      license: 'creativeCommon'
    }
  });

  const initResp = await httpsRequest({
    hostname: 'www.googleapis.com',
    path: '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': fileSize
    }
  }, metadata);

  const uploadUrl = initResp.headers.location;
  if (!uploadUrl) throw new Error(s.short_name + ': No upload URL. Status: ' + initResp.statusCode + ' Body: ' + initResp.body.slice(0, 300));

  // Step 2: Upload file
  const uploadResp = await new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(s.video_path);
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

  if (!uploadResp.id) throw new Error(s.short_name + ': No video ID: ' + JSON.stringify(uploadResp).slice(0, 300));

  console.log(s.short_name + ' subido: https://www.youtube.com/shorts/' + uploadResp.id);
  results.push({
    short_name: s.short_name,
    video_id: uploadResp.id,
    url: 'https://www.youtube.com/shorts/' + uploadResp.id,
    titulo: uploadResp.snippet?.title || s.titulo,
    status: uploadResp.status?.uploadStatus
  });
}

return [{ json: { episodio: datos.episodio, shorts: results } }];
"""

# Log node
log_code = r"""
const fs = require('fs');
const datos = $input.first().json;

const logPath = 'E:\\RainTube\\logs\\shorts_publicados.json';
let logs = [];
try { logs = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch(e) {}

for (const s of datos.shorts) {
  logs.push({
    fecha: new Date().toISOString(),
    episodio: datos.episodio,
    short_name: s.short_name,
    video_id: s.video_id,
    url: s.url,
    titulo: s.titulo,
    status: s.status
  });
}

fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));

const msg = datos.shorts.map(s => s.short_name + ': ' + s.url).join('\n');
return [{ json: { mensaje: 'EP' + datos.episodio + ' - ' + datos.shorts.length + ' shorts subidos', shorts: datos.shorts } }];
"""

workflow = {
    "name": "RainTube - Crear y Subir Shorts",
    "nodes": [
        {
            "parameters": {
                "httpMethod": "POST",
                "path": "raintube-shorts",
                "responseMode": "responseNode",
                "options": {}
            },
            "id": "short-webhook",
            "name": "Webhook Shorts",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [400, 500]
        },
        {
            "parameters": {
                "jsCode": "const fs = require('fs');\nconst body = $input.first().json?.body || $input.first().json || {};\nlet EP = parseInt(body.episodio);\n\nif (!EP || isNaN(EP)) throw new Error('Falta episodio. Envia {\"episodio\": 6}');\n\nconst episodios = {\n  1: { audio_path: 'E:\\\\RainTube\\\\ep1_tormenta_oceano.mp3', keyword_es: 'tormenta y oceano', keyword_en: 'ocean storm' },\n  2: { audio_path: 'E:\\\\RainTube\\\\ep2_gran_tormenta.mp3', keyword_es: 'gran tormenta de lluvia', keyword_en: 'heavy rain thunderstorm' },\n  3: { audio_path: 'E:\\\\RainTube\\\\ep3_islas_griegas.mp3', keyword_es: 'agua de islas griegas', keyword_en: 'greek island water' },\n  4: { audio_path: 'E:\\\\RainTube\\\\ep4_ruido_blanco_bebe.mp3', keyword_es: 'ruido blanco para bebe', keyword_en: 'white noise baby' },\n  5: { audio_path: 'E:\\\\RainTube\\\\ep5_ruido_blanco_agua.mp3', keyword_es: 'ruido blanco de agua', keyword_en: 'water white noise' },\n  6: { audio_path: 'E:\\\\RainTube\\\\ep6_ventilador_gigante.mp3', keyword_es: 'ventilador gigante', keyword_en: 'giant fan white noise' }\n};\n\nconst ep = episodios[EP];\nif (!ep) throw new Error('Episodio ' + EP + ' no definido.');\nif (!fs.existsSync(ep.audio_path)) throw new Error('Audio no existe: ' + ep.audio_path);\n\nconst shorts = [\n  {\n    short_name: 'short1',\n    ss: 1800,\n    video_path: 'E:\\\\RainTube\\\\output\\\\short-ep' + EP + '-short1.mp4',\n    titulo: 'No puedes dormir? Prueba este sonido de ' + ep.keyword_es + ' #shorts',\n    descripcion: 'Sonido relajante de ' + ep.keyword_es + ' para dormir rapido. 3 minutos de puro relax.\\n\\nSuscribete para mas sonidos relajantes.\\n#shorts #sonidosparadormir #ruidoblanco #' + ep.keyword_en.replace(/ /g, ''),\n    tags: ep.keyword_es + ',shorts,dormir,relax,ruido blanco,' + ep.keyword_en + ',sleep,white noise'\n  },\n  {\n    short_name: 'short2',\n    ss: 14400,\n    video_path: 'E:\\\\RainTube\\\\output\\\\short-ep' + EP + '-short2.mp4',\n    titulo: 'Sonido de ' + ep.keyword_es + ' para concentrarte al maximo #shorts',\n    descripcion: '3 minutos de ' + ep.keyword_es + ' para estudiar o trabajar con concentracion total.\\n\\nSuscribete para mas sonidos de concentracion.\\n#shorts #estudiar #concentracion #' + ep.keyword_en.replace(/ /g, ''),\n    tags: ep.keyword_es + ',shorts,estudiar,concentracion,focus,' + ep.keyword_en + ',study,work'\n  }\n];\n\nreturn [{ json: { episodio: EP, audio_path: ep.audio_path, shorts: shorts } }];"
            },
            "id": "short-config",
            "name": "Configurar Shorts",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [640, 500]
        },
        {
            "parameters": {
                "jsCode": crear_shorts_code
            },
            "id": "short-ffmpeg",
            "name": "FFmpeg - Crear Shorts",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [880, 500]
        },
        {
            "parameters": {
                "method": "POST",
                "url": "https://www.googleapis.com/oauth2/v4/token",
                "authentication": "predefinedCredentialType",
                "nodeCredentialType": "youTubeOAuth2Api",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={}",
                "options": {
                    "response": {
                        "response": {
                            "fullResponse": True,
                            "neverError": True
                        }
                    }
                }
            },
            "id": "short-yt-token",
            "name": "YouTube - Get Token",
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
            "parameters": {
                "jsCode": subir_shorts_code
            },
            "id": "short-yt-upload",
            "name": "YouTube - Subir Shorts",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1360, 500]
        },
        {
            "parameters": {
                "jsCode": log_code
            },
            "id": "short-log",
            "name": "Guardar Log Shorts",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1600, 500]
        },
        {
            "parameters": {
                "respondWith": "json",
                "responseBody": "={{ $json }}"
            },
            "id": "short-response",
            "name": "Respuesta Webhook",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1.1,
            "position": [1840, 500]
        }
    ],
    "connections": {
        "Webhook Shorts": {"main": [[{"node": "Configurar Shorts", "type": "main", "index": 0}]]},
        "Configurar Shorts": {"main": [[{"node": "FFmpeg - Crear Shorts", "type": "main", "index": 0}]]},
        "FFmpeg - Crear Shorts": {"main": [[{"node": "YouTube - Get Token", "type": "main", "index": 0}]]},
        "YouTube - Get Token": {"main": [[{"node": "YouTube - Subir Shorts", "type": "main", "index": 0}]]},
        "YouTube - Subir Shorts": {"main": [[{"node": "Guardar Log Shorts", "type": "main", "index": 0}]]},
        "Guardar Log Shorts": {"main": [[{"node": "Respuesta Webhook", "type": "main", "index": 0}]]}
    },
    "settings": {"executionOrder": "v1"}
}

data = json.dumps(workflow).encode('utf-8')
req2 = urllib.request.Request(
    'http://localhost:5678/api/v1/workflows/' + WF_ID,
    data=data, method='PUT',
    headers={
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': API_KEY
    }
)
resp2 = urllib.request.urlopen(req2)
result = json.loads(resp2.read())
print('Workflow actualizado:', result.get('name'))
print('Updated:', result.get('updatedAt'))
