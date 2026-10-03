import os, json, urllib.request

API_KEY = os.environ.get('N8N_API_KEY')

req = urllib.request.Request('http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV', headers={'X-N8N-API-KEY': API_KEY})
wf = json.loads(urllib.request.urlopen(req).read())

for n in wf['nodes']:
    if n['name'] == 'FFmpeg - Crear Short':
        code = n['parameters']['jsCode']
        # Reduce duration 180 -> 174 (safe margin under 180s Shorts limit)
        code = code.replace("'-t', '180',", "'-t', '174',")
        # Adjust fade-out to match new duration (174 - 0.3 = 173.7)
        code = code.replace('afade=t=out:st=179.7:d=0.3', 'afade=t=out:st=173.7:d=0.3')
        n['parameters']['jsCode'] = code
        ok = "'-t', '174'," in code and 'st=173.7' in code
        print('FFmpeg short actualizado a 174s:', ok)

payload = {'name': wf['name'], 'nodes': wf['nodes'], 'connections': wf['connections'], 'settings': wf.get('settings', {'executionOrder': 'v1'})}
req2 = urllib.request.Request('http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV', json.dumps(payload).encode('utf-8'), method='PUT', headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY})
print('Guardado:', json.loads(urllib.request.urlopen(req2).read()).get('updatedAt'))
