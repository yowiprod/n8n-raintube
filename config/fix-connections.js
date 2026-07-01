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
          try { console.log('Error:', JSON.parse(body).message); } catch(e) { console.log('Body:', body.substring(0, 300)); }
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
  const wf = await getWorkflow('xW6WxDB6zbbWK1N3');

  // Fix: Change Pixabay -> Combinar connection to input index 1
  console.log('Before fix:');
  console.log('Pixabay connections:', JSON.stringify(wf.connections['Pixabay - Buscar Videos']));

  // Pixabay should connect to Combinar at index 1 (not 0)
  wf.connections['Pixabay - Buscar Videos'] = {
    main: [
      [
        {
          node: 'Combinar Resultados Videos',
          type: 'main',
          index: 1
        }
      ]
    ]
  };

  console.log('After fix:');
  console.log('Pixabay connections:', JSON.stringify(wf.connections['Pixabay - Buscar Videos']));

  await putWorkflow('xW6WxDB6zbbWK1N3', wf);
  console.log('Done!');
})();
