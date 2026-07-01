import os
import json, urllib.request

API_KEY = os.environ.get('N8N_API_KEY', '')

# --- Main workflow ---
req = urllib.request.Request(
    'http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi',
    headers={'X-N8N-API-KEY': API_KEY}
)
wf = json.loads(urllib.request.urlopen(req).read())

for node in wf['nodes']:
    if node['name'] == 'Seleccionar Episodio':
        code = node['parameters']['jsCode']

        ep10_block = """  10: {
    audio_url:  'https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/62df101dae16790012a8601f/media.mp3',
    audio_path: 'E:\\\\RainTube\\\\ep10_lluvia_borneo.mp3',
    video_path: 'E:\\\\RainTube\\\\output\\\\RainTube-Lluvia-Borneo-8h.mp4',
    seo_path:   'E:\\\\RainTube\\\\config\\\\seo-ep10-lluvia-borneo.json',
    keyword:    'tropical rain jungle sleep 8 hours',
    privacy:    'unlisted'
  }"""

        old = "    keyword:    'rain and thunder sounds sleep 8 hours',\n    privacy:    'unlisted'\n  }\n};"
        new = "    keyword:    'rain and thunder sounds sleep 8 hours',\n    privacy:    'unlisted'\n  },\n" + ep10_block + "\n};"
        code = code.replace(old, new)
        code = code.replace('i <= 9', 'i <= 10')
        code = code.replace('Todos los episodios (1-9)', 'Todos los episodios (1-10)')
        node['parameters']['jsCode'] = code

        print('Has EP10 block:', '62df101dae16790012a8601f' in code)
        print('Has i<=10:', 'i <= 10' in code)

payload = {'name': wf['name'], 'nodes': wf['nodes'], 'connections': wf['connections'], 'settings': {'executionOrder': 'v1'}}
req2 = urllib.request.Request(
    'http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi',
    data=json.dumps(payload).encode('utf-8'), method='PUT',
    headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY}
)
print('Main updated:', json.loads(urllib.request.urlopen(req2).read()).get('updatedAt'))

# --- Shorts workflow ---
req3 = urllib.request.Request(
    'http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV',
    headers={'X-N8N-API-KEY': API_KEY}
)
wf_s = json.loads(urllib.request.urlopen(req3).read())

for node in wf_s['nodes']:
    if node['name'] == 'Configurar Shorts':
        code = node['parameters']['jsCode']
        code = code.replace(
            "keyword_en: 'rain and thunder sleep' }\n};",
            "keyword_en: 'rain and thunder sleep' },\n  10: { audio_path: 'E:\\\\RainTube\\\\ep10_lluvia_borneo.mp3', keyword_es: 'lluvia tropical para dormir', keyword_en: 'tropical rain sleep' }\n};"
        )
        node['parameters']['jsCode'] = code

payload2 = {'name': wf_s['name'], 'nodes': wf_s['nodes'], 'connections': wf_s['connections'], 'settings': {'executionOrder': 'v1'}}
req4 = urllib.request.Request(
    'http://localhost:5678/api/v1/workflows/0cXOVkPTk4oQDIsV',
    data=json.dumps(payload2).encode('utf-8'), method='PUT',
    headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY}
)
print('Shorts updated:', json.loads(urllib.request.urlopen(req4).read()).get('updatedAt'))
