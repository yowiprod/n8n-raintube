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
        console.log(`  PUT status: ${res.statusCode}`);
        if (res.statusCode >= 400) {
          try { console.log('  Error:', JSON.parse(body).message); } catch(e) {}
        }
        resolve(res.statusCode);
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// New parser code that avoids regex with backticks
const newParserCode = `const raw = $input.first().json.choices[0].message.content;
// Limpiar posible markdown (sin regex con backticks)
let cleaned = raw || '';
const fence = String.fromCharCode(96, 96, 96);
while (cleaned.indexOf(fence + 'json') !== -1) {
  cleaned = cleaned.replace(fence + 'json', '');
}
while (cleaned.indexOf(fence) !== -1) {
  cleaned = cleaned.replace(fence, '');
}
cleaned = cleaned.trim();
const response = JSON.parse(cleaned);
return [{ json: response }];`;

(async () => {
  console.log('=== Fixing WF1 Parsear Tema ===');
  const wf1 = await getWorkflow('xW6WxDB6zbbWK1N3');

  const parser = wf1.nodes.find(n => n.name === 'Parsear Tema');
  if (parser) {
    parser.parameters.jsCode = newParserCode;
    console.log('  Parser code updated');
  } else {
    console.log('  ERROR: Parsear Tema node not found!');
  }

  await putWorkflow('xW6WxDB6zbbWK1N3', wf1);
  console.log('Done!');
})();
