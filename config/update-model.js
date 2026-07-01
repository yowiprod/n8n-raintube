const http = require('http');
const API_KEY = process.env.N8N_API_KEY;
const OLD_MODEL = 'google/gemma-3-27b-it:free';
const NEW_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';

async function updateWorkflow(wfId, wfName) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: 'localhost', port: 5678,
      path: `/api/v1/workflows/${wfId}`,
      headers: { 'X-N8N-API-KEY': API_KEY }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const wf = JSON.parse(body);
        let changed = 0;

        wf.nodes.forEach(n => {
          // Check body field
          if (n.parameters && n.parameters.body) {
            const old = n.parameters.body;
            n.parameters.body = old.replace(new RegExp(OLD_MODEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), NEW_MODEL);
            if (n.parameters.body !== old) changed++;
          }
          // Check jsonBody field
          if (n.parameters && n.parameters.jsonBody) {
            const v = n.parameters.jsonBody;
            if (typeof v === 'object' && v.value) {
              const old = v.value;
              v.value = old.replace(new RegExp(OLD_MODEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), NEW_MODEL);
              if (v.value !== old) changed++;
            } else if (typeof v === 'string') {
              const old = v;
              n.parameters.jsonBody = old.replace(new RegExp(OLD_MODEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), NEW_MODEL);
              if (n.parameters.jsonBody !== old) changed++;
            }
          }
        });

        console.log(`${wfName}: ${changed} field(s) changed`);

        // Remove read-only fields
        delete wf.id;
        delete wf.createdAt;
        delete wf.updatedAt;
        delete wf.tags;

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
        }, (res2) => {
          let body2 = '';
          res2.on('data', d => body2 += d);
          res2.on('end', () => {
            console.log(`${wfName}: update status ${res2.statusCode}`);
            resolve();
          });
        });
        req.write(data);
        req.end();
      });
    });
  });
}

(async () => {
  await updateWorkflow('xW6WxDB6zbbWK1N3', 'WF1');
  await updateWorkflow('wKDVc7J0marBZPw6', 'WF3');
  console.log('Done!');
})();
