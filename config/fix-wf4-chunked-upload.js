const http = require('http');
const API_KEY = process.env.N8N_API_KEY;
function getWorkflow(wfId) { return new Promise((resolve, reject) => { http.get({ hostname: 'localhost', port: 5678, path: `/api/v1/workflows/${wfId}`, headers: { 'X-N8N-API-KEY': API_KEY } }, (res) => { let body = ''; res.on('data', d => body += d); res.on('end', () => resolve(JSON.parse(body))); }).on('error', reject); }); }
function putWorkflow(wfId, wf) { return new Promise((resolve, reject) => { const clean = {}; ['name','nodes','connections','settings','staticData'].forEach(k => { if (wf[k] !== undefined) clean[k] = wf[k]; }); const data = JSON.stringify(clean); const req = http.request({ hostname: 'localhost', port: 5678, path: `/api/v1/workflows/${wfId}`, method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY, 'Content-Length': Buffer.byteLength(data) } }, (res) => { let body = ''; res.on('data', d => body += d); res.on('end', () => { console.log('PUT status:', res.statusCode); resolve(res.statusCode); }); }); req.on('error', reject); req.write(data); req.end(); }); }

(async () => {
  console.log('=== Fix WF4: Chunked resumable upload with progress ===');
  const wf = await getWorkflow('nz4c5vp2jLPPgUZS');

  const node = wf.nodes.find(n => n.name === 'YouTube - Subir Video');
  node.parameters.jsCode = `const fs = require('fs');
const https = require('https');

const pipelineData = $('Recibir Datos WF3').first().json;
const videoPath = pipelineData.video_final;

const prevResponse = $input.first().json;
const uploadUrl = prevResponse.headers?.location || prevResponse.headers?.Location;

if (!uploadUrl) {
  throw new Error('No upload URL found. Keys: ' + Object.keys(prevResponse).join(', '));
}

const stats = fs.statSync(videoPath);
const fileSize = stats.size;
const fileSizeGB = (fileSize / 1024 / 1024 / 1024).toFixed(2);
console.log('Video:', videoPath);
console.log('Size:', fileSizeGB, 'GB (' + fileSize + ' bytes)');

// Parse upload URL manually
const withoutProto = uploadUrl.replace('https://', '');
const slashIdx = withoutProto.indexOf('/');
const hostname = withoutProto.substring(0, slashIdx);
const urlPath = withoutProto.substring(slashIdx);

// Chunked upload: 50 MB per chunk
const CHUNK_SIZE = 50 * 1024 * 1024;
const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
console.log('Chunks:', totalChunks, '(50 MB each)');
console.log('Estimated time at 10 Mbps:', Math.round(fileSize / (10 * 1024 * 1024 / 8) / 60), 'min');

function uploadChunk(start, end, chunkData) {
  return new Promise((resolve, reject) => {
    const contentRange = 'bytes ' + start + '-' + end + '/' + fileSize;
    const req = https.request({
      hostname: hostname,
      path: urlPath,
      method: 'PUT',
      headers: {
        'Content-Length': chunkData.length,
        'Content-Type': 'video/mp4',
        'Content-Range': contentRange
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: body });
      });
    });
    req.on('error', reject);
    req.write(chunkData);
    req.end();
  });
}

let offset = 0;
let chunkNum = 0;
let lastResult = null;
const fd = fs.openSync(videoPath, 'r');

try {
  while (offset < fileSize) {
    chunkNum++;
    const remaining = fileSize - offset;
    const thisChunkSize = Math.min(CHUNK_SIZE, remaining);
    const buffer = Buffer.alloc(thisChunkSize);
    fs.readSync(fd, buffer, 0, thisChunkSize, offset);

    const start = offset;
    const end = offset + thisChunkSize - 1;
    const pct = ((end + 1) / fileSize * 100).toFixed(1);

    console.log('Chunk ' + chunkNum + '/' + totalChunks + ': bytes ' + start + '-' + end + ' (' + pct + '%)');

    const result = await uploadChunk(start, end, buffer);

    if (result.statusCode === 200 || result.statusCode === 201) {
      // Upload complete!
      console.log('Upload COMPLETE! Status:', result.statusCode);
      try {
        lastResult = JSON.parse(result.body);
      } catch(e) {
        lastResult = { raw: result.body.substring(0, 1000) };
      }
      break;
    } else if (result.statusCode === 308) {
      // Resume incomplete - chunk accepted, continue
      const range = result.headers.range || '';
      console.log('  -> Accepted (308). Server range:', range);
      offset += thisChunkSize;
    } else {
      throw new Error('Chunk upload failed. Status: ' + result.statusCode + ' Body: ' + result.body.substring(0, 500));
    }
  }
} finally {
  fs.closeSync(fd);
}

if (!lastResult) {
  throw new Error('Upload finished but no final response received');
}

console.log('Video ID:', lastResult.id);
console.log('Title:', lastResult.snippet?.title);
console.log('Status:', lastResult.status?.uploadStatus);

return [{ json: {
  video_id: lastResult.id,
  video_url: 'https://www.youtube.com/watch?v=' + lastResult.id,
  titulo: lastResult.snippet?.title,
  status: lastResult.status?.uploadStatus
} }];`;

  console.log('  Updated: YouTube - Subir Video (chunked 50MB + progress logs)');
  await putWorkflow('nz4c5vp2jLPPgUZS', wf);
  console.log('Done!');
})();
