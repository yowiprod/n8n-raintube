#!/bin/bash
API_KEY="$N8N_API_KEY"
BASE="http://localhost:5678"

# Episodes to make short1 of (EP11 already fired manually, so start from EP13)
EPS="13 15 16 17 19 20 22 25 26"

wait_idle() {
  for i in $(seq 1 60); do
    running=$(curl -s "$BASE/api/v1/executions?status=running&limit=5" -H "X-N8N-API-KEY: $API_KEY" 2>/dev/null | python -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null)
    if [ "$running" = "0" ]; then return 0; fi
    sleep 15
  done
  return 1
}

echo "Esperando a que EP11 short1 termine..."
wait_idle
echo "EP11 short1 listo."

n=2
for ep in $EPS; do
  echo "=== Short $n/10: EP$ep short1 ==="
  curl -s -o /dev/null -w "  webhook HTTP %{http_code}\n" -X POST "$BASE/webhook/raintube-shorts" -H "Content-Type: application/json" -d "{\"episodio\": $ep, \"short\": 1}"
  sleep 5
  wait_idle
  echo "  EP$ep short1 procesado."
  n=$((n+1))
done

echo "=== TODOS LOS 10 SHORTS DISPARADOS ==="
# Show last 10 short executions status
curl -s "$BASE/api/v1/executions?workflowId=0cXOVkPTk4oQDIsV&limit=10" -H "X-N8N-API-KEY: $API_KEY" 2>/dev/null | python -c "
import sys, json
d = json.load(sys.stdin)
for e in d['data']:
    print(f\"  id {e['id']} | {e['status']} | {e.get('startedAt','')}\")
"
