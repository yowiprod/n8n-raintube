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
          try { console.log('Error:', JSON.parse(body).message); } catch(e) {}
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
  console.log('=== Fix WF4: Include response headers for upload URL ===');
  const wf = await getWorkflow('nz4c5vp2jLPPgUZS');

  // 1. Enable fullResponse on YouTube - Iniciar Upload to get Location header
  const initNode = wf.nodes.find(n => n.name === 'YouTube - Iniciar Upload');
  if (initNode) {
    initNode.parameters.options = {
      response: {
        response: {
          fullResponse: true
        }
      }
    };
    console.log('  Enabled fullResponse on YouTube - Iniciar Upload');
    console.log('  Current params:', JSON.stringify(Object.keys(initNode.parameters)));
  }

  // 2. Fix YouTube - Subir Video to read upload URL from fullResponse format
  const uploadNode = wf.nodes.find(n => n.name === 'YouTube - Subir Video');
  if (uploadNode) {
    uploadNode.parameters.jsCode = `// Resumable upload - read video and upload to YouTube
const fs = require('fs');
const https = require('https');

const pipelineData = $('Recibir Datos WF3').first().json;
const videoPath = pipelineData.video_final;

// fullResponse format: { body: {}, headers: {}, statusCode: 200 }
const prevResponse = $input.first().json;
console.log('Previous node response keys:', Object.keys(prevResponse));
console.log('Headers keys:', prevResponse.headers ? Object.keys(prevResponse.headers) : 'no headers');

const uploadUrl = prevResponse.headers?.location || prevResponse.headers?.Location || prevResponse.location || prevResponse.Location;

if (!uploadUrl) {
  // Log full response for debugging
  console.log('Full response:', JSON.stringify(prevResponse).substring(0, 2000));
  throw new Error('No se obtuvo URL de upload. Response keys: ' + Object.keys(prevResponse).join(', '));
}

const stats = fs.statSync(videoPath);
const fileSize = stats.size;
console.log('Uploading video:', videoPath);
console.log('File size:', (fileSize / 1024 / 1024 / 1024).toFixed(2), 'GB');
console.log('Upload URL:', uploadUrl.substring(0, 100) + '...');

const result = await new Promise((resolve, reject) => {
  const parsed = new URL(uploadUrl);
  const fileStream = fs.createReadStream(videoPath);

  const options = {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'PUT',
    headers: {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log('YouTube response status:', res.statusCode);
      try { resolve(JSON.parse(body)); }
      catch(e) { reject(new Error('YouTube response parse error (status ' + res.statusCode + '): ' + body.substring(0, 500))); }
    });
  });

  req.on('error', reject);
  fileStream.pipe(req);
});

console.log('Upload complete! Video ID:', result.id);
return [{ json: {
  video_id: result.id,
  video_url: 'https://www.youtube.com/watch?v=' + result.id,
  titulo: result.snippet?.title,
  status: result.status?.uploadStatus
} }];`;
    console.log('  Fixed: YouTube - Subir Video (reads from fullResponse headers)');
  }

  await putWorkflow('nz4c5vp2jLPPgUZS', wf);
  console.log('Done!');
})();
