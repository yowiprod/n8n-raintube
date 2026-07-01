import os
import json, urllib.request

API_KEY = os.environ.get('N8N_API_KEY', '')

# First deactivate
req_d = urllib.request.Request('http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV/deactivate', method='POST', headers={'X-N8N-API-KEY': API_KEY})
try:
    urllib.request.urlopen(req_d)
    print('Desactivado')
except Exception as e:
    print('deactivate:', e)

# Get workflow
req = urllib.request.Request('http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV', headers={'X-N8N-API-KEY': API_KEY})
wf = json.loads(urllib.request.urlopen(req).read())

for n in wf['nodes']:
    if 'webhook' in n['type'].lower():
        n['webhookId'] = 'raintube-shorts-wh'
        print('webhookId asignado:', n['webhookId'])

payload = {'name': wf['name'], 'nodes': wf['nodes'], 'connections': wf['connections'], 'settings': wf.get('settings', {'executionOrder': 'v1'})}
req2 = urllib.request.Request('http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV', json.dumps(payload).encode('utf-8'), method='PUT', headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY})
r = json.loads(urllib.request.urlopen(req2).read())
print('Guardado:', r.get('updatedAt'))

# Verify webhookId persisted
for n in r['nodes']:
    if 'webhook' in n['type'].lower():
        print('webhookId tras guardar:', n.get('webhookId'))

# Reactivate
req_a = urllib.request.Request('http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV/activate', method='POST', headers={'X-N8N-API-KEY': API_KEY})
ra = json.loads(urllib.request.urlopen(req_a).read())
print('Reactivado, active:', ra.get('active'))
