const http = require('http');
const API_KEY = process.env.N8N_API_KEY;
const NEW_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';

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
    delete wf.id; delete wf.createdAt; delete wf.updatedAt; delete wf.tags;
    const data = JSON.stringify(wf);
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
          try { console.log('  Error:', JSON.parse(body).message); } catch(e) { console.log('  Body:', body.substring(0, 200)); }
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
  // === WF1 ===
  console.log('=== WF1: Obtener Material ===');
  const wf1 = await getWorkflow('xW6WxDB6zbbWK1N3');

  wf1.nodes.forEach(n => {
    // Fix OpenRouter node
    if (n.parameters && n.parameters.jsonBody && typeof n.parameters.jsonBody === 'string') {
      // Replace any free model with nemotron
      let val = n.parameters.jsonBody;
      val = val.replace(/"model"\s*:\s*"[^"]+:free"/g, `"model":"${NEW_MODEL}"`);
      // Fix typo max_tokhens -> max_tokens
      val = val.replace(/max_tokhens/g, 'max_tokens');
      if (val !== n.parameters.jsonBody) {
        console.log(`  Fixed node: ${n.name}`);
        n.parameters.jsonBody = val;
      }
    }
    if (n.parameters && n.parameters.body && typeof n.parameters.body === 'string') {
      let val = n.parameters.body;
      val = val.replace(/"model"\s*:\s*"[^"]+:free"/g, `"model":"${NEW_MODEL}"`);
      val = val.replace(/max_tokhens/g, 'max_tokens');
      if (val !== n.parameters.body) {
        console.log(`  Fixed node: ${n.name}`);
        n.parameters.body = val;
      }
    }
  });

  await putWorkflow('xW6WxDB6zbbWK1N3', wf1);

  // === WF3 ===
  console.log('\n=== WF3: Metadata SEO ===');
  const wf3 = await getWorkflow('wKDVc7J0marBZPw6');

  wf3.nodes.forEach(n => {
    if (n.parameters && n.parameters.jsonBody) {
      const jb = n.parameters.jsonBody;
      if (typeof jb === 'string') {
        let val = jb;
        val = val.replace(/"model"\s*:\s*"[^"]+:free"/g, `"model":"${NEW_MODEL}"`);
        val = val.replace(/max_tokhens/g, 'max_tokens');
        if (val !== jb) {
          console.log(`  Fixed node: ${n.name}`);
          n.parameters.jsonBody = val;
        }
      } else if (typeof jb === 'object' && jb.value) {
        let val = jb.value;
        val = val.replace(/"model"\s*:\s*"[^"]+:free"/g, `"model":"${NEW_MODEL}"`);
        val = val.replace(/max_tokhens/g, 'max_tokens');
        if (val !== jb.value) {
          console.log(`  Fixed node: ${n.name}`);
          jb.value = val;
        }
      }
    }
    if (n.parameters && n.parameters.body && typeof n.parameters.body === 'string') {
      let val = n.parameters.body;
      val = val.replace(/"model"\s*:\s*"[^"]+:free"/g, `"model":"${NEW_MODEL}"`);
      val = val.replace(/max_tokhens/g, 'max_tokens');
      if (val !== n.parameters.body) {
        console.log(`  Fixed node: ${n.name}`);
        n.parameters.body = val;
      }
    }
  });

  await putWorkflow('wKDVc7J0marBZPw6', wf3);

  console.log('\nDone!');
})();
