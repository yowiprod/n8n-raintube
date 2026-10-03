#!/bin/bash
API_KEY="$N8N_API_KEY"
BASE="http://localhost:5678"

wait_idle() {
  for i in $(seq 1 100); do
    n=$(curl -s "$BASE/api/v1/executions?status=running&limit=5" -H "X-N8N-API-KEY: $API_KEY" 2>/dev/null | python -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null)
    if [ "$n" = "0" ]; then return 0; fi
    sleep 20
  done
}

for ep in 1 2 3; do
  echo "=== Episodio $ep/3 del lote ==="
  curl -s -o /dev/null -w "  disparo HTTP %{http_code}\n" -X POST "$BASE/webhook/raintube" -H "Content-Type: application/json" -d '{}'
  sleep 15
  wait_idle
  # Report last result
  curl -s "$BASE/api/v1/executions?workflowId=ogsBUiQWQ6uqiwRi&limit=1&includeData=true" -H "X-N8N-API-KEY: $API_KEY" 2>/dev/null | python -c "
import sys, json
d = json.load(sys.stdin)['data'][0]
rd = d.get('data',{}).get('resultData',{}).get('runData',{})
ag = rd.get('Auto-Generar Episodio', [])
tit = ''
if ag:
    o = ag[0].get('data',{}).get('main',[[]])[0]
    if o: tit = o[0].get('json',{}).get('titulo','')
yt = rd.get('YouTube - Subir Video', [])
url = ''
if yt:
    o = yt[0].get('data',{}).get('main',[[]])[0]
    if o: url = o[0].get('json',{}).get('url','')
print(f'  {d[\"status\"]} | {tit}')
if url: print(f'  {url}')
if d['status']=='error':
    err=d.get('data',{}).get('resultData',{}).get('error',{})
    print('  ERROR:', err.get('message','')[:150])
"
  echo ""
done

# Restore webhook -> Seleccionar Episodio
python -c "
import json, urllib.request
K='$API_KEY'
r=urllib.request.Request('$BASE/api/v1/workflows/ogsBUiQWQ6uqiwRi', headers={'X-N8N-API-KEY':K})
wf=json.loads(urllib.request.urlopen(r).read())
wf['connections']['Webhook RainTube']={'main':[[{'node':'Seleccionar Episodio','type':'main','index':0}]]}
p={'name':wf['name'],'nodes':wf['nodes'],'connections':wf['connections'],'settings':{'executionOrder':'v1'}}
urllib.request.urlopen(urllib.request.Request('$BASE/api/v1/workflows/ogsBUiQWQ6uqiwRi', json.dumps(p).encode(), method='PUT', headers={'Content-Type':'application/json','X-N8N-API-KEY':K}))
print('=== LOTE COMPLETO. Webhook restaurado -> Seleccionar Episodio ===')
"