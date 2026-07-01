const http = require('http');
const API_KEY = process.env.N8N_API_KEY;
const NEW_MODEL = 'amazon/nova-2-lite-v1';

// Only these keys are allowed by n8n PUT API
const ALLOWED_KEYS = ['name', 'nodes', 'connections', 'settings', 'staticData'];

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
    // Strip to only allowed keys
    const clean = {};
    ALLOWED_KEYS.forEach(k => { if (wf[k] !== undefined) clean[k] = wf[k]; });

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
          try { console.log('  Error:', JSON.parse(body).message); } catch(e) { console.log('  Body:', body.substring(0, 300)); }
        }
        resolve(res.statusCode);
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function fixModel(node) {
  let changed = false;
  if (node.parameters) {
    ['jsonBody', 'body'].forEach(field => {
      if (node.parameters[field]) {
        let val = typeof node.parameters[field] === 'object' ? node.parameters[field].value : node.parameters[field];
        if (typeof val === 'string') {
          let newVal = val.replace(/"model"\s*:\s*"[^"]+:free"/g, `"model":"${NEW_MODEL}"`);
          newVal = newVal.replace(/max_tokhens/g, 'max_tokens');
          if (newVal !== val) {
            if (typeof node.parameters[field] === 'object') {
              node.parameters[field].value = newVal;
            } else {
              node.parameters[field] = newVal;
            }
            changed = true;
          }
        }
      }
    });
  }
  return changed;
}

(async () => {
  for (const [wfId, wfLabel] of [['xW6WxDB6zbbWK1N3', 'WF1'], ['wKDVc7J0marBZPw6', 'WF3']]) {
    console.log(`=== ${wfLabel} ===`);
    const wf = await getWorkflow(wfId);
    wf.nodes.forEach(n => {
      if (fixModel(n)) console.log(`  Fixed: ${n.name}`);
    });
    await putWorkflow(wfId, wf);
  }
  console.log('\nDone!');
})();
