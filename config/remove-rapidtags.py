import os
import json, urllib.request

API_KEY = os.environ.get('N8N_API_KEY', '')

req = urllib.request.Request('http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi', headers={'X-N8N-API-KEY': API_KEY})
wf = json.loads(urllib.request.urlopen(req).read())

# 1. Remove nodes
remove = {'RapidTags - Generar Tags', 'Preparar Body Tags'}
wf['nodes'] = [n for n in wf['nodes'] if n['name'] not in remove]

# 2. Rewire connections
conns = wf['connections']
for name in remove:
    conns.pop(name, None)
conns['YouTube - Subir Video'] = {'main': [[{'node': 'Guardar Log + Resultado', 'type': 'main', 'index': 0}]]}

# 3. Update Guardar Log
new_code = """const fs     = require('fs');
const upload = $('YouTube - Subir Video').first().json;

const log = {
  fecha:    new Date().toISOString(),
  episodio: upload.episodio,
  video_id: upload.video_id,
  url:      upload.url,
  titulo:   upload.titulo,
  status:   upload.status
};

const logPath = 'E:/RainTube/logs/videos_publicados.json';
let logs = [];
try { logs = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch(e) {}
logs.push(log);
fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));

return [{ json: {
  mensaje:  'Episodio ' + upload.episodio + ' publicado en YouTube',
  url:      upload.url,
  titulo:   upload.titulo,
  video_id: upload.video_id
} }];"""

for n in wf['nodes']:
    if n['name'] == 'Guardar Log + Resultado':
        n['parameters']['jsCode'] = new_code
        print('Guardar Log actualizado')

payload = {'name': wf['name'], 'nodes': wf['nodes'], 'connections': wf['connections'], 'settings': {'executionOrder': 'v1'}}
req2 = urllib.request.Request('http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi', json.dumps(payload).encode('utf-8'), method='PUT', headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY})
result = json.loads(urllib.request.urlopen(req2).read())
print('Updated:', result.get('updatedAt'))
print()
print('Nodos restantes:')
for n in result['nodes']:
    print('  -', n['name'])
print('Conexion YouTube Subir Video ->', result['connections'].get('YouTube - Subir Video'))
