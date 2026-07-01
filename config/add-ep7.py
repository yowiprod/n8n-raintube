import os
import json, urllib.request

API_KEY = os.environ.get('N8N_API_KEY', '')
WF_ID = 'ogsBUiQWQ6uqiwRi'

# Get current workflow
req = urllib.request.Request(
    f'http://localhost:5678/api/v1/workflows/{WF_ID}',
    headers={'X-N8N-API-KEY': API_KEY}
)
resp = urllib.request.urlopen(req)
wf = json.loads(resp.read())

# Find "Seleccionar Episodio" node and update its code
for node in wf['nodes']:
    if node['name'] == 'Seleccionar Episodio':
        code = node['parameters']['jsCode']

        # Add EP7
        ep7_block = """  7: {
    audio_url:  'https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/62df101dae16790012a8601f/media.mp3',
    audio_path: 'E:\\\\RainTube\\\\ep7_lluvia_agua.mp3',
    video_path: 'E:\\\\RainTube\\\\output\\\\RainTube-Lluvia-Agua-8h.mp4',
    seo_path:   'E:\\\\RainTube\\\\config\\\\seo-ep7-lluvia-agua.json',
    keyword:    'rain water sounds sleep 8 hours',
    privacy:    'unlisted'
  }"""

        # Insert EP7 after EP6's closing brace
        # Find the pattern for EP6's end and add EP7
        code = code.replace(
            "privacy:    'unlisted'\n  }\n};",
            "privacy:    'unlisted'\n  },\n" + ep7_block + "\n};"
        )

        # Update auto-detect loop from 6 to 7
        code = code.replace('i <= 6', 'i <= 7')

        node['parameters']['jsCode'] = code
        print('EP7 added to Seleccionar Episodio')
        # Verify
        if '62df101dae16790012a8601f' in code:
            print('EP7 audio URL confirmed')
        if 'i <= 7' in code:
            print('Loop updated to 7')

# Also update shorts workflow
SHORTS_WF_ID = '0cXOVkPTk4oQDIsV'
req2 = urllib.request.Request(
    f'http://localhost:5678/api/v1/workflows/{SHORTS_WF_ID}',
    headers={'X-N8N-API-KEY': API_KEY}
)
resp2 = urllib.request.urlopen(req2)
wf_shorts = json.loads(resp2.read())

for node in wf_shorts['nodes']:
    if node['name'] == 'Configurar Shorts':
        code = node['parameters']['jsCode']
        ep7_short = "  7: { audio_path: 'E:\\\\RainTube\\\\ep7_lluvia_agua.mp3', keyword_es: 'lluvia y agua', keyword_en: 'rain and water sounds' }"

        # Add EP7 after EP6
        code = code.replace(
            "keyword_en: 'giant fan white noise' }\n};",
            "keyword_en: 'giant fan white noise' },\n" + ep7_short + "\n};"
        )
        node['parameters']['jsCode'] = code
        print('EP7 added to Shorts workflow')

# Update main workflow
payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': 'v1'}
}
data = json.dumps(payload).encode('utf-8')
req3 = urllib.request.Request(
    f'http://localhost:5678/api/v1/workflows/{WF_ID}',
    data=data, method='PUT',
    headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY}
)
resp3 = urllib.request.urlopen(req3)
print('Main workflow updated:', json.loads(resp3.read()).get('updatedAt'))

# Update shorts workflow
payload2 = {
    'name': wf_shorts['name'],
    'nodes': wf_shorts['nodes'],
    'connections': wf_shorts['connections'],
    'settings': {'executionOrder': 'v1'}
}
data2 = json.dumps(payload2).encode('utf-8')
req4 = urllib.request.Request(
    f'http://localhost:5678/api/v1/workflows/{SHORTS_WF_ID}',
    data=data2, method='PUT',
    headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY}
)
resp4 = urllib.request.urlopen(req4)
print('Shorts workflow updated:', json.loads(resp4.read()).get('updatedAt'))
