import os
import json, urllib.request

API_KEY = os.environ.get('N8N_API_KEY', '')

# --- Main workflow ---
req = urllib.request.Request(
    'http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi',
    headers={'X-N8N-API-KEY': API_KEY}
)
resp = urllib.request.urlopen(req)
wf = json.loads(resp.read())

for node in wf['nodes']:
    if node['name'] == 'Seleccionar Episodio':
        code = node['parameters']['jsCode']

        ep9_block = """  9: {
    audio_url:  'https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/62df0f84a553700013325064/media.mp3',
    audio_path: 'E:\\\\RainTube\\\\ep9_lluvia_tormenta.mp3',
    video_path: 'E:\\\\RainTube\\\\output\\\\RainTube-Lluvia-Tormenta-Alpes-8h.mp4',
    seo_path:   'E:\\\\RainTube\\\\config\\\\seo-ep9-lluvia-tormenta.json',
    keyword:    'rain and thunder sounds sleep 8 hours',
    privacy:    'unlisted'
  }"""

        # Find EP8's closing and add EP9 after it
        old = "    keyword:    'white noise baby sleep 8 hours',\n    privacy:    'unlisted'\n  }\n};"
        new = "    keyword:    'white noise baby sleep 8 hours',\n    privacy:    'unlisted'\n  },\n" + ep9_block + "\n};"
        code = code.replace(old, new)
        code = code.replace('i <= 8', 'i <= 9')
        code = code.replace('Todos los episodios (1-8)', 'Todos los episodios (1-9)')
        node['parameters']['jsCode'] = code

        if '62df0f84a553700013325064' in code and 'i <= 9' in code:
            print('EP9 added to main workflow OK')
        else:
            print('ERROR: EP9 not found in code!')
            print('Has acast ID:', '62df0f84a553700013325064' in code)
            print('Has i<=9:', 'i <= 9' in code)

# Save main workflow
payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': 'v1'}
}
data = json.dumps(payload).encode('utf-8')
req2 = urllib.request.Request(
    'http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi',
    data=data, method='PUT',
    headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY}
)
resp2 = urllib.request.urlopen(req2)
print('Main workflow updated:', json.loads(resp2.read()).get('updatedAt'))

# --- Shorts workflow ---
req3 = urllib.request.Request(
    'http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV',
    headers={'X-N8N-API-KEY': API_KEY}
)
resp3 = urllib.request.urlopen(req3)
wf_shorts = json.loads(resp3.read())

for node in wf_shorts['nodes']:
    if node['name'] == 'Configurar Shorts':
        code = node['parameters']['jsCode']
        code = code.replace(
            "keyword_en: 'baby white noise' }\n};",
            "keyword_en: 'baby white noise' },\n  9: { audio_path: 'E:\\\\RainTube\\\\ep9_lluvia_tormenta.mp3', keyword_es: 'lluvia y tormenta para dormir', keyword_en: 'rain and thunder sleep' }\n};"
        )
        node['parameters']['jsCode'] = code
        print('EP9 added to shorts workflow')

payload2 = {
    'name': wf_shorts['name'],
    'nodes': wf_shorts['nodes'],
    'connections': wf_shorts['connections'],
    'settings': {'executionOrder': 'v1'}
}
data2 = json.dumps(payload2).encode('utf-8')
req4 = urllib.request.Request(
    'http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV',
    data2, method='PUT',
    headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY}
)
resp4 = urllib.request.urlopen(req4)
print('Shorts workflow updated:', json.loads(resp4.read()).get('updatedAt'))
