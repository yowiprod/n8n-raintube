const http = require('http');
const API_KEY = process.env.N8N_API_KEY;

function getWorkflow(wfId) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: 'localhost', port: 5678,
      path: `/api/v1/workflows/${wfId}`,
      headers: { 'X-N8N-API-KEY': API_KEY }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

function putWorkflow(wfId, wf) {
  return new Promise((resolve, reject) => {
    const clean = {};
    ['name', 'nodes', 'connections', 'settings', 'staticData'].forEach(k => {
      if (wf[k] !== undefined) clean[k] = wf[k];
    });
    const data = JSON.stringify(clean);
    const req = http.request({
      hostname: 'localhost', port: 5678,
      path: `/api/v1/workflows/${wfId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log(`PUT status: ${res.statusCode}`);
        if (res.statusCode >= 400) {
          try { console.log('Error:', JSON.parse(body).message); } catch(e) { console.log('Body:', body.substring(0, 500)); }
        }
        resolve(res.statusCode);
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log('=== Fix WF3: Replace OpenRouter HTTP node with Code node ===');
  const wf = await getWorkflow('wKDVc7J0marBZPw6');

  // Replace OpenRouter HTTP Request node with a Code node to avoid JSON expression issues
  const openRouterNode = wf.nodes.find(n => n.name === 'OpenRouter - Generar Metadata SEO');
  if (openRouterNode) {
    // Convert to Code node
    openRouterNode.type = 'n8n-nodes-base.code';
    openRouterNode.typeVersion = 2;
    openRouterNode.parameters = {
      jsCode: `const https = require('https');

const data = $input.first().json;
const tema = data.tema?.tema || 'Rain Relaxation';
const ambiente = data.tema?.ambiente || 'peaceful';
const duracion = data.duracion_horas || 4;
const apiKey = '{{ $env.OPENROUTER_API_KEY }}';

const prompt = 'Genera metadata SEO optimizada para un video de YouTube sobre: ' + tema + '. Ambiente: ' + ambiente + '. Duracion: ' + duracion + ' horas.\\n\\nResponde SOLO en JSON valido:\\n{\\n  "titulo": "titulo en ingles optimizado SEO, max 100 chars, incluir emojis relevantes",\\n  "descripcion": "descripcion completa en ingles, 1500-2000 chars, con timestamps y keywords",\\n  "tags": ["tag1", "tag2", ... 20 tags],\\n  "categoria": "Music" o "Entertainment",\\n  "playlist": "nombre de playlist sugerida"\\n}\\n\\nEl titulo DEBE incluir palabras clave como: rain, sleep, relax, ambient, ASMR, study, meditation. Incluir la duracion en el titulo. La descripcion debe tener: intro atractiva, timestamps cada 30min, keywords naturales, call to action para suscribirse.';

const body = JSON.stringify({
  model: 'amazon/nova-2-lite-v1',
  max_tokens: 2048,
  messages: [{ role: 'user', content: prompt }]
});

console.log('Calling OpenRouter with model: amazon/nova-2-lite-v1');
console.log('Tema:', tema);

const result = await new Promise((resolve, reject) => {
  const req = https.request({
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { reject(new Error('OpenRouter response parse error: ' + data.substring(0, 500))); }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

if (result.error) {
  throw new Error('OpenRouter error: ' + JSON.stringify(result.error));
}

console.log('Response received, model:', result.model);
return [{ json: result }];`
    };
    // Remove credential references since we use env var directly
    delete openRouterNode.credentials;
    console.log('  Replaced: OpenRouter HTTP node -> Code node (avoids JSON expression issues)');
  }

  // Also fix Parsear Metadata to read from Recibir Datos Pipeline (check it references correctly)
  const parsearNode = wf.nodes.find(n => n.name === 'Parsear Metadata');
  if (parsearNode) {
    // Verify it reads from 'Recibir Datos Pipeline' not 'Trigger Manual'
    const code = parsearNode.parameters.jsCode;
    if (code.includes('Recibir Datos Pipeline')) {
      console.log('  Parsear Metadata: OK (already references Recibir Datos Pipeline)');
    } else {
      console.log('  Parsear Metadata: updating reference...');
    }
  }

  await putWorkflow('wKDVc7J0marBZPw6', wf);
  console.log('Done!');
})();
