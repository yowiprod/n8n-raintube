const http = require('http');
const API_KEY = process.env.N8N_API_KEY;

function getWorkflow(wfId) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 5678, path: `/api/v1/workflows/${wfId}`, headers: { 'X-N8N-API-KEY': API_KEY } }, (res) => {
      let body = ''; res.on('data', d => body += d); res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

function putWorkflow(wfId, wf) {
  return new Promise((resolve, reject) => {
    const clean = {}; ['name', 'nodes', 'connections', 'settings', 'staticData'].forEach(k => { if (wf[k] !== undefined) clean[k] = wf[k]; });
    const data = JSON.stringify(clean);
    const req = http.request({ hostname: 'localhost', port: 5678, path: `/api/v1/workflows/${wfId}`, method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY, 'Content-Length': Buffer.byteLength(data) }
    }, (res) => { let body = ''; res.on('data', d => body += d); res.on('end', () => { console.log(`PUT status: ${res.statusCode}`); resolve(res.statusCode); }); });
    req.on('error', reject); req.write(data); req.end();
  });
}

(async () => {
  console.log('=== Fix WF4: URL parse ===');
  const wf = await getWorkflow('nz4c5vp2jLPPgUZS');

  const uploadNode = wf.nodes.find(n => n.name === 'YouTube - Subir Video');
  if (uploadNode) {
    uploadNode.parameters.jsCode = `const fs = require('fs');
const https = require('https');
const urlModule = require('url');

const pipelineData = $('Recibir Datos WF3').first().json;
const videoPath = pipelineData.video_final;

const prevResponse = $input.first().json;
const uploadUrl = prevResponse.headers?.location || prevResponse.headers?.Location || prevResponse.location || prevResponse.Location;

if (!uploadUrl) {
  throw new Error('No se obtuvo URL de upload. Keys: ' + Object.keys(prevResponse).join(', '));
}

const stats = fs.statSync(videoPath);
const fileSize = stats.size;
console.log('Uploading:', videoPath);
console.log('Size:', (fileSize / 1024 / 1024 / 1024).toFixed(2), 'GB');

const parsed = urlModule.parse(uploadUrl);

const result = await new Promise((resolve, reject) => {
  const fileStream = fs.createReadStream(videoPath);
  const req = https.request({
    hostname: parsed.hostname,
    path: parsed.path,
    method: 'PUT',
    headers: { 'Content-Length': fileSize, 'Content-Type': 'video/mp4' }
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log('YouTube status:', res.statusCode);
      try { resolve(JSON.parse(body)); }
      catch(e) { reject(new Error('Parse error (status ' + res.statusCode + '): ' + body.substring(0, 500))); }
    });
  });
  req.on('error', reject);
  fileStream.pipe(req);
});

console.log('Done! Video ID:', result.id);
return [{ json: {
  video_id: result.id,
  video_url: 'https://www.youtube.com/watch?v=' + result.id,
  titulo: result.snippet?.title,
  status: result.status?.uploadStatus
} }];`;
    console.log('  Fixed: using require("url").parse()');
  }

  await putWorkflow('nz4c5vp2jLPPgUZS', wf);
  console.log('Done!');
})();
