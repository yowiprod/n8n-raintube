import json, urllib.request

SHOW = '62d96ab962e8610013dee16e'
req = urllib.request.Request(f'https://feeder.acast.com/api/v1/shows/{SHOW}', headers={'User-Agent': 'Mozilla/5.0'})
data = json.loads(urllib.request.urlopen(req).read())
eps = data.get('episodes', [])

used = set(json.load(open('E:/RainTube/config/_used_ids.json')))

def classify(title):
    t = title.lower()
    # Exclude non rain/water content
    if any(x in t for x in ['ventilador', 'secador', 'aspiradora', 'cuencos', 'bebe', 'beb\u00e9', 'perro', 'motor', 'avi\u00f3n', 'tren']):
        return None
    if 'cascada' in t or 'waterfall' in t:
        return 'waterfall'
    if any(x in t for x in ['ola', 'mar ', 'oc\u00e9ano', 'oceano', 'costa', 'playa']):
        return 'ocean'
    if 'tormenta' in t or 'trueno' in t or 'thunder' in t:
        return 'storm'
    if 'lluvia' in t or 'rain' in t:
        return 'rain'
    if 'agua' in t or 'arroyo' in t or 'fuente' in t or 'r\u00edo' in t or 'water' in t:
        return 'water'
    return None

catalog = []
for e in eps:
    eid = e.get('id', '')
    title = e.get('title', '')
    kind = classify(title)
    if not eid or kind is None:
        continue
    catalog.append({
        'acast_id': eid,
        'sound_type': kind,   # rain / water / storm / ocean / waterfall
        'orig_title': title[:80],
        'used': eid in used
    })

# Stats
from collections import Counter
types = Counter(c['sound_type'] for c in catalog)
avail = [c for c in catalog if not c['used']]
with open('E:/RainTube/config/audio-catalog.json', 'w', encoding='utf-8') as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

n_used = sum(1 for c in catalog if c['used'])
print(f'Catalogo: {len(catalog)} audios de lluvia/agua')
print(f'  Por tipo: {dict(types)}')
print(f'  Usados: {n_used} | Disponibles: {len(avail)}')
print('  Guardado en audio-catalog.json')
