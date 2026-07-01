import os
import json, urllib.request

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
                "jsCode": "const fs = require('fs');\nconst body = $input.first().json?.body || $input.first().json || {};\nlet EP = parseInt(body.episodio);\n\nif (!EP || isNaN(EP)) throw new Error('Falta episodio. Envia {\"episodio\": 6}');\n\nconst episodios = {\n  1: { audio_path: 'E:\\\\RainTube\\\\ep1_tormenta_oceano.mp3', keyword_es: 'tormenta y oceano', keyword_en: 'ocean storm' },\n  2: { audio_path: 'E:\\\\RainTube\\\\ep2_gran_tormenta.mp3', keyword_es: 'gran tormenta de lluvia', keyword_en: 'heavy rain thunderstorm' },\n  3: { audio_path: 'E:\\\\RainTube\\\\ep3_islas_griegas.mp3', keyword_es: 'agua de islas griegas', keyword_en: 'greek island water' },\n  4: { audio_path: 'E:\\\\RainTube\\\\ep4_ruido_blanco_bebe.mp3', keyword_es: 'ruido blanco para bebe', keyword_en: 'white noise baby' },\n  5: { audio_path: 'E:\\\\RainTube\\\\ep5_ruido_blanco_agua.mp3', keyword_es: 'ruido blanco de agua', keyword_en: 'water white noise' },\n  6: { audio_path: 'E:\\\\RainTube\\\\ep6_ventilador_gigante.mp3', keyword_es: 'ventilador gigante', keyword_en: 'giant fan white noise' }\n};\n\nconst ep = episodios[EP];\nif (!ep) throw new Error('Episodio ' + EP + ' no definido.');\nif (!fs.existsSync(ep.audio_path)) throw new Error('Audio no existe: ' + ep.audio_path);\n\nconst shorts = [\n  {\n    nombre: 'short1',\n    ss: 1800,\n    titulo: 'No puedes dormir? Prueba este sonido de ' + ep.keyword_es + ' #shorts',\n    descripcion: 'Sonido relajante de ' + ep.keyword_es + ' para dormir rapido. 3 minutos de puro relax.\\n\\nSuscribete para mas sonidos relajantes.\\n#shorts #sonidosparadormir #ruidoblanco #' + ep.keyword_en.replace(/ /g, ''),\n    tags: ep.keyword_es + ',shorts,dormir,relax,ruido blanco,' + ep.keyword_en + ',sleep,white noise'\n  },\n  {\n    nombre: 'short2',\n    ss: 14400,\n    titulo: 'Sonido de ' + ep.keyword_es + ' para concentrarte al maximo #shorts',\n    descripcion: '3 minutos de ' + ep.keyword_es + ' para estudiar o trabajar con concentracion total.\\n\\nSuscribete para mas sonidos de concentracion.\\n#shorts #estudiar #concentracion #' + ep.keyword_en.replace(/ /g, ''),\n    tags: ep.keyword_es + ',shorts,estudiar,concentracion,focus,' + ep.keyword_en + ',study,work'\n  }\n];\n\nconst results = [];\nfor (const s of shorts) {\n  results.push({\n    json: {\n      episodio: EP,\n      audio_path: ep.audio_path,\n      ss: s.ss,\n      short_name: s.nombre,\n      video_path: 'E:\\\\RainTube\\\\output\\\\short-ep' + EP + '-' + s.nombre + '.mp4',\n      titulo: s.titulo,\n      descripcion: s.descripcion,\n      tags: s.tags,\n      privacy: 'unlisted'\n    }\n  });\n}\n\nreturn results;"
            },
            "id": "short-config",
            "name": "Configurar Shorts",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [640, 500]
        },
        {
            "parameters": {
                "jsCode": "const { spawn } = require('child_process');\nconst fs = require('fs');\nconst datos = $input.first().json;\n\nif (fs.existsSync(datos.video_path)) {\n  const size = fs.statSync(datos.video_path).size;\n  if (size > 100000) {\n    console.log('Short ya existe: ' + datos.video_path + ' (' + Math.round(size/1024/1024) + ' MB)');\n    return [{ json: datos }];\n  }\n  fs.unlinkSync(datos.video_path);\n}\n\nconsole.log('Creando short EP' + datos.episodio + ' ' + datos.short_name);\nconsole.log('Audio: ' + datos.audio_path + ' desde segundo ' + datos.ss);\nconsole.log('Salida: ' + datos.video_path);\n\nconst FFMPEG = 'C:\\\\Users\\\\Jowy\\\\AppData\\\\Local\\\\Microsoft\\\\WinGet\\\\Packages\\\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\\\ffmpeg-8.0.1-full_build\\\\bin\\\\ffmpeg.exe';\n\nawait new Promise((resolve, reject) => {\n  const proc = spawn(FFMPEG, [\n    '-y',\n    '-ss', String(datos.ss + 86),\n    '-t', '180',\n    '-i', datos.audio_path,\n    '-f', 'lavfi', '-i', 'color=c=black:s=1080x1920:r=24',\n    '-map', '1:v',\n    '-map', '0:a',\n    '-af', 'afade=t=in:d=0.3,afade=t=out:st=179.7:d=0.3',\n    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',\n    '-c:a', 'aac', '-b:a', '128k',\n    '-shortest',\n    datos.video_path\n  ]);\n\n  let stderr = '';\n  proc.stderr.on('data', d => {\n    stderr += d.toString();\n    if (stderr.length > 5000) stderr = stderr.substring(stderr.length - 3000);\n  });\n  proc.on('close', code => {\n    if (code === 0) resolve();\n    else reject(new Error('FFmpeg code ' + code + ': ' + stderr.slice(-300)));\n  });\n  proc.on('error', e => reject(e));\n});\n\nconst sizeMB = Math.round(fs.statSync(datos.video_path).size / 1024 / 1024);\nconsole.log('Short creado: ' + sizeMB + ' MB');\n\nreturn [{ json: datos }];"
            },
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
            "parameters": {
                "jsCode": "const fs = require('fs');\nconst https = require('https');\n\nconst datos = $('Configurar Shorts').first().json;\nconst response = $input.first().json;\nconst uploadUrl = response.headers?.location || response.headers?.Location;\n\nif (!uploadUrl) throw new Error('YouTube no devolvio URL de upload. Response: ' + JSON.stringify(response).slice(0, 500));\n\nconst videoPath = datos.video_path;\nconst fileSize = fs.statSync(videoPath).size;\nconsole.log('Subiendo short: ' + videoPath + ' (' + Math.round(fileSize/1024/1024) + ' MB)');\n\nconst result = await new Promise((resolve, reject) => {\n  const fileStream = fs.createReadStream(videoPath);\n  const req = https.request(uploadUrl, {\n    method: 'PUT',\n    headers: { 'Content-Length': fileSize, 'Content-Type': 'video/mp4' }\n  }, (res) => {\n    let body = '';\n    res.on('data', chunk => body += chunk);\n    res.on('end', () => {\n      try { resolve(JSON.parse(body)); }\n      catch(e) { reject(new Error('Respuesta invalida: ' + body)); }\n    });\n  });\n  req.on('error', reject);\n  fileStream.pipe(req);\n});\n\nif (!result.id) throw new Error('YouTube no devolvio video ID: ' + JSON.stringify(result));\n\nreturn [{ json: {\n  video_id: result.id,\n  url: 'https://www.youtube.com/shorts/' + result.id,\n  titulo: result.snippet?.title || datos.titulo,\n  status: result.status?.uploadStatus,\n  episodio: datos.episodio,\n  short_name: datos.short_name\n} }];"
            },
            "id": "short-yt-upload",
            "name": "YouTube - Subir Short",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1360, 500]
        },
        {
            "parameters": {
                "jsCode": "const fs = require('fs');\nconst upload = $input.first().json;\n\nconst log = {\n  fecha: new Date().toISOString(),\n  episodio: upload.episodio,\n  short_name: upload.short_name,\n  video_id: upload.video_id,\n  url: upload.url,\n  titulo: upload.titulo,\n  status: upload.status\n};\n\nconst logPath = 'E:\\\\RainTube\\\\logs\\\\shorts_publicados.json';\nlet logs = [];\ntry { logs = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch(e) {}\nlogs.push(log);\nfs.writeFileSync(logPath, JSON.stringify(logs, null, 2));\nconsole.log('Short publicado: ' + upload.url);\n\nreturn [{ json: {\n  mensaje: 'Short EP' + upload.episodio + ' ' + upload.short_name + ' publicado',\n  url: upload.url,\n  titulo: upload.titulo\n} }];"
            },
            "id": "short-log",
            "name": "Guardar Log Short",
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
        "Configurar Shorts": {"main": [[{"node": "FFmpeg - Crear Short", "type": "main", "index": 0}]]},
        "FFmpeg - Crear Short": {"main": [[{"node": "YouTube - Iniciar Upload Short", "type": "main", "index": 0}]]},
        "YouTube - Iniciar Upload Short": {"main": [[{"node": "YouTube - Subir Short", "type": "main", "index": 0}]]},
        "YouTube - Subir Short": {"main": [[{"node": "Guardar Log Short", "type": "main", "index": 0}]]},
        "Guardar Log Short": {"main": [[{"node": "Respuesta Webhook", "type": "main", "index": 0}]]}
    },
    "settings": {"executionOrder": "v1"}
}

data = json.dumps(workflow).encode('utf-8')
req = urllib.request.Request(
    'http://localhost:5678/api/v1/workflows',
    data=data,
    method='POST',
    headers={
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': os.environ.get('N8N_API_KEY', '')
    }
)

resp = urllib.request.urlopen(req)
result = json.loads(resp.read())
print('Workflow creado:', result.get('name'))
print('ID:', result.get('id'))
