import os, json, urllib.request

API_KEY = os.environ.get('N8N_API_KEY')

SEO_PATH = 'E:/RainTube/config/seo-ep34-playa-de-copacabana.json'

# 1. Convert flat SEO -> es/en format expected by Seleccionar Episodio
flat = json.load(open(SEO_PATH, encoding='utf-8'))
converted = {
    'episode': 34,
    'es': {'title': flat['title'], 'description': flat['description'], 'tags': flat.get('tags', '')},
    'en': {'title': flat['title'], 'description': flat['description'], 'tags': flat.get('tags', '')}
}
json.dump(converted, open(SEO_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('SEO EP34 convertido a formato es/en')

# 2. Add EP34 to static map in Seleccionar Episodio
req = urllib.request.Request('http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi', headers={'X-N8N-API-KEY': API_KEY})
wf = json.loads(urllib.request.urlopen(req).read())
kw = flat.get('tags', 'copacabana').split(',')[0].strip()
for node in wf['nodes']:
    if node['name'] == 'Seleccionar Episodio':
        code = node['parameters']['jsCode']
        if '34:' not in code:
            ep34 = """  34: {
    audio_url:  'https://sphinx.acast.com/p/open/s/62d96ab962e8610013dee16e/e/%s/media.mp3',
    audio_path: 'E:/RainTube/ep34_playa-de-copacabana.mp3',
    video_path: 'E:/RainTube/output/RainTube-ep34-playa-de-copacabana-8h.mp4',
    seo_path:   'E:/RainTube/config/seo-ep34-playa-de-copacabana.json',
    keyword:    '%s',
    privacy:    'unlisted'
  }""" % (flat.get('acast_id',''), kw.replace("'", ""))
            # insert before closing of episodios map: find last "  }\n};"
            import re
            code = re.sub(r'\}\s*\n\};', '},\n' + ep34 + '\n};', code, count=1)
            code = re.sub(r'i <= \d+', 'i <= 34', code)
            node['parameters']['jsCode'] = code
            print('EP34 anadido al mapa:', '34:' in code)

payload = {'name': wf['name'], 'nodes': wf['nodes'], 'connections': wf['connections'], 'settings': {'executionOrder': 'v1'}}
urllib.request.urlopen(urllib.request.Request('http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi', json.dumps(payload).encode(), method='PUT', headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY}))
print('Guardado')

# 3. Reactivate so production webhook reloads (Webhook -> Seleccionar Episodio)
for a in ['deactivate', 'activate']:
    urllib.request.urlopen(urllib.request.Request(f'http://localhost:5678/api/v1/workflows/ogsBUiQWQ6uqiwRi/{a}', method='POST', headers={'X-N8N-API-KEY': API_KEY}))
print('Reactivado')
