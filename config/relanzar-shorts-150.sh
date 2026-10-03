#!/bin/bash
API_KEY="$N8N_API_KEY"
BASE="http://localhost:5678"

# EP11 already fired; do the rest
EPS="13 15 16 17 19 20 22 25 26"

wait_idle() {
  for i in $(seq 1 80); do
    running=$(curl -s "$BASE/api/v1/executions?status=running&limit=5" -H "X-N8N-API-KEY: $API_KEY" 2>/dev/null | python -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null)
    if [ "$running" = "0" ]; then return 0; fi
    sleep 15
  done
  return 1
}

echo "Esperando EP11 short1 (150s)..."
wait_idle
echo "EP11 listo."

n=2
for ep in $EPS; do
  echo "=== Short $n/10: EP$ep ==="
  curl -s -o /dev/null -w "  webhook HTTP %{http_code}\n" -X POST "$BASE/webhook/raintube-shorts" -H "Content-Type: application/json" -d "{\"episodio\": $ep, \"short\": 1}"
  sleep 5
  wait_idle
  echo "  EP$ep procesado."
  n=$((n+1))
done

echo "=== 10 SHORTS (150s) COMPLETADOS ==="
curl -s "$BASE/api/v1/executions?workflowId=0cXOVkPTk4oQDIsV&limit=10" -H "X-N8N-API-KEY: $API_KEY" 2>/dev/null | python -c "
import sys, json
for e in json.load(sys.stdin)['data']:
    print(f\"  id {e['id']} | {e['status']}\")
"
# Verify durations of regenerated files
echo "=== Duraciones reales ==="
FFPROBE="C:/Users/Jowy/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.0.1-full_build/bin/ffprobe.exe"
for ep in 11 13 15 16 17 19 20 22 25 26; do
  f="E:/RainTube/outputshort-ep${ep}-short1.mp4"
  if [ -f "$f" ]; then
    dur=$("$FFPROBE" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f" 2>/dev/null)
    echo "  ep${ep}: ${dur}s"
  fi
done
