import os, json, urllib.request

API_KEY = os.environ.get('N8N_API_KEY')

# --- Main workflow ---
req = urllib.request.Request('http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi', headers={'X-N8N-API-KEY': API_KEY})
wf = json.loads(urllib.request.urlopen(req).read())

for node in wf['nodes']:
    if node['name'] == 'Seleccionar Episodio':
        code = node['parameters']['jsCode']
        ep29 = """  29: {
    audio_url:  'https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/62db2ca54f4d8b00124a3d27/media.mp3',
    audio_path: 'E:/RainTube/ep29_rain_tokyo.mp3',
    video_path: 'E:/RainTube/output/RainTube-Rain-Tokyo-Street-8h.mp4',
    seo_path:   'E:/RainTube/config/seo-ep29-rain-tokyo.json',
    keyword:    'tokyo city rain night 8 hours sleep',
    privacy:    'unlisted'
  }"""
        code = code.replace(
            "keyword:    'redwood forest rain california 8 hours sleep',\n    privacy:    'unlisted'\n  }\n};",
            "keyword:    'redwood forest rain california 8 hours sleep',\n    privacy:    'unlisted'\n  },\n" + ep29 + "\n};"
        )
        code = code.replace('i <= 28', 'i <= 29').replace('Todos los episodios (1-28)', 'Todos los episodios (1-29)')
        node['parameters']['jsCode'] = code
        print('Main | has EP29:', '62db2ca54f4d8b00124a3d27' in code, '| i<=29:', 'i <= 29' in code)

payload = {'name': wf['name'], 'nodes': wf['nodes'], 'connections': wf['connections'], 'settings': {'executionOrder': 'v1'}}
req2 = urllib.request.Request('http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi', json.dumps(payload).encode('utf-8'), method='PUT', headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY})
print('Main updated:', json.loads(urllib.request.urlopen(req2).read()).get('updatedAt'))

# --- Shorts workflow ---
req3 = urllib.request.Request('http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV', headers={'X-N8N-API-KEY': API_KEY})
wf_s = json.loads(urllib.request.urlopen(req3).read())

for node in wf_s['nodes']:
    if node['name'] == 'Configurar Shorts':
        code = node['parameters']['jsCode']
        ep29_s = """  29: {
    audio_path: 'E:/RainTube/ep29_rain_tokyo.mp3',
    short1_title: 'Rain in a Tokyo Street for Deep Sleep #shorts',
    short2_title: 'Tokyo City Rain for Study and Focus #shorts',
    tags: 'tokyo rain,city rain,night rain,japan,sleep,study'
  }"""
        # insert before final };  (after last entry)
        import re
        code = re.sub(r'\}\s*\n\};\s*$', '},\n' + ep29_s + '\n};', code)
        node['parameters']['jsCode'] = code
        print('Shorts | has EP29:', 'tokyo' in code.lower())

payload2 = {'name': wf_s['name'], 'nodes': wf_s['nodes'], 'connections': wf_s['connections'], 'settings': {'executionOrder': 'v1'}}
req4 = urllib.request.Request('http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV', json.dumps(payload2).encode('utf-8'), method='PUT', headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY})
print('Shorts updated:', json.loads(urllib.request.urlopen(req4).read()).get('updatedAt'))
