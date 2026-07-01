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

const FFMPEG = 'C:\\\\Users\\\\Jowy\\\\AppData\\\\Local\\\\Microsoft\\\\WinGet\\\\Packages\\\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\\\ffmpeg-8.0.1-full_build\\\\bin\\\\ffmpeg.exe';

const newNodes = {
  'FFmpeg - Extraer Frame': {
    type: 'n8n-nodes-base.code',
    parameters: {
      jsCode: `const { execSync } = require('child_process');
const ffmpeg = '${FFMPEG}';
const videoFinal = $input.first().json.video_final.replace(/\\\\/g, '/');
const timestamp = $input.first().json.timestamp;
const thumbnailPath = 'E:/RainTube/thumbnails/' + timestamp + '_thumb.jpg';
const cmd = \`"\${ffmpeg}" -y -ss 30 -i "\${videoFinal}" -vframes 1 -vf "scale=1280:720" -q:v 2 "\${thumbnailPath}"\`;
console.log('Running:', cmd);
try {
  execSync(cmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
  return [{ json: { ...$input.first().json, thumbnail_base: thumbnailPath } }];
} catch(e) {
  throw new Error('FFmpeg extract frame failed: ' + e.stderr?.toString()?.substring(0, 500));
}`
    }
  },
  'FFmpeg - Añadir Texto Thumbnail': {
    type: 'n8n-nodes-base.code',
    parameters: {
      jsCode: `const { execSync } = require('child_process');
const ffmpeg = '${FFMPEG}';
const timestamp = $input.first().json.timestamp;
const thumbBase = 'E:/RainTube/thumbnails/' + timestamp + '_thumb.jpg';
const thumbFinal = 'E:/RainTube/thumbnails/' + timestamp + '_thumbnail.jpg';
const titulo = ($input.first().json.metadata.titulo || 'Rain Relax').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 30);
const cmd = \`"\${ffmpeg}" -y -i "\${thumbBase}" -vf "eq=brightness=-0.15:saturation=1.3,drawtext=text='\${titulo}':fontsize=56:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:font=Arial" -q:v 2 "\${thumbFinal}"\`;
console.log('Running:', cmd);
try {
  execSync(cmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
  return [{ json: { ...$input.first().json, thumbnail_final: thumbFinal } }];
} catch(e) {
  throw new Error('FFmpeg thumbnail text failed: ' + e.stderr?.toString()?.substring(0, 500));
}`
    }
  }
};

(async () => {
  console.log('=== Fixing WF3 ===');
  const wf = await getWorkflow('wKDVc7J0marBZPw6');

  let replaced = 0;
  wf.nodes = wf.nodes.map(n => {
    if (newNodes[n.name]) {
      console.log(`  Replacing: ${n.name}`);
      replaced++;
      return {
        ...n,
        type: newNodes[n.name].type,
        typeVersion: 2,
        parameters: newNodes[n.name].parameters
      };
    }
    return n;
  });
  console.log(`  Total replaced: ${replaced}`);

  await putWorkflow('wKDVc7J0marBZPw6', wf);
  console.log('Done!');
})();
