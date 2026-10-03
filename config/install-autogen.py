import os, json, urllib.request

API_KEY = os.environ.get('N8N_API_KEY')

# Read validated node code
with open('E:/RainTube/config/auto-generar-node.js', encoding='utf-8') as f:
    code = f.read()

req = urllib.request.Request('http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi', headers={'X-N8N-API-KEY': API_KEY})
wf = json.loads(urllib.request.urlopen(req).read())

# Remove existing Auto-Generar if present (idempotent)
wf['nodes'] = [n for n in wf['nodes'] if n['name'] != 'Auto-Generar Episodio']

# Add the node
wf['nodes'].append({
    'parameters': {'jsCode': code},
    'name': 'Auto-Generar Episodio',
    'type': 'n8n-nodes-base.code',
    'typeVersion': 2,
    'position': [2224, 1140]
})

# Rewire connections:
conns = wf['connections']
# 1. Schedule -> Auto-Generar (instead of -> Seleccionar Episodio)
conns['Cada Lunes 18h'] = {'main': [[{'node': 'Auto-Generar Episodio', 'type': 'main', 'index': 0}]]}
# 2. Auto-Generar -> Descargar Audio
conns['Auto-Generar Episodio'] = {'main': [[{'node': 'Descargar Audio', 'type': 'main', 'index': 0}]]}

payload = {'name': wf['name'], 'nodes': wf['nodes'], 'connections': conns, 'settings': {'executionOrder': 'v1'}}
req2 = urllib.request.Request('http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi', json.dumps(payload).encode('utf-8'), method='PUT', headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY})
r = json.loads(urllib.request.urlopen(req2).read())
print('Guardado:', r.get('updatedAt'))

# Verify
names = [n['name'] for n in r['nodes']]
print('Auto-Generar presente:', 'Auto-Generar Episodio' in names)
print('Schedule ->', r['connections'].get('Cada Lunes 18h'))
print('Auto-Generar ->', r['connections'].get('Auto-Generar Episodio'))
