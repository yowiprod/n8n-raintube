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

const FFMPEG = 'C:\\\\Users\\\\Jowy\\\\AppData\\\\Local\\\\Microsoft\\\\WinGet\\\\Packages\\\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\\\ffmpeg-8.0.1-full_build\\\\bin\\\\ffmpeg.exe';

// New Code node implementations to replace executeCommand nodes
const newNodes = {
  'FFmpeg - Concatenar Clips': {
    type: 'n8n-nodes-base.code',
    parameters: {
      jsCode: `const { execSync } = require('child_process');
const ffmpeg = '${FFMPEG}';
const listPath = $input.first().json.list_path.replace(/\\\\/g, '/');
const outputPath = ($input.first().json.processing_dir + '\\\\clips_concatenados.mp4').replace(/\\\\/g, '/');
const cmd = \`"\${ffmpeg}" -y -f concat -safe 0 -i "\${listPath}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset medium -crf 20 -an -r 30 "\${outputPath}"\`;
console.log('Running:', cmd);
try {
  const result = execSync(cmd, { timeout: 600000, maxBuffer: 50 * 1024 * 1024 });
  return [{ json: { ...$input.first().json, stdout: result.toString().substring(0, 500), clips_concatenados: outputPath } }];
} catch(e) {
  throw new Error('FFmpeg concat failed: ' + e.stderr?.toString()?.substring(0, 500));
}`
    }
  },
  'FFmpeg - Loop Video': {
    type: 'n8n-nodes-base.code',
    parameters: {
      jsCode: `const { execSync } = require('child_process');
const ffmpeg = '${FFMPEG}';
const input = $input.first().json.clips_concatenados.replace(/\\\\/g, '/');
const output = ($input.first().json.processing_dir + '\\\\video_loop.mp4').replace(/\\\\/g, '/');
const duracion = $input.first().json.duracion_segundos;
const fadeOut = duracion - 5;
const cmd = \`"\${ffmpeg}" -y -stream_loop -1 -i "\${input}" -t \${duracion} -vf "fade=t=in:st=0:d=3,fade=t=out:st=\${fadeOut}:d=5" -c:v libx264 -preset medium -crf 20 -an -r 30 "\${output}"\`;
console.log('Running:', cmd);
try {
  const result = execSync(cmd, { timeout: 86400000, maxBuffer: 50 * 1024 * 1024 });
  return [{ json: { ...$input.first().json, video_loop: output, stdout: result.toString().substring(0, 500) } }];
} catch(e) {
  throw new Error('FFmpeg loop video failed: ' + e.stderr?.toString()?.substring(0, 500));
}`
    }
  },
  'FFmpeg - Loop Audio': {
    type: 'n8n-nodes-base.code',
    parameters: {
      jsCode: `const { execSync } = require('child_process');
const ffmpeg = '${FFMPEG}';
const prepData = $('Preparar Lista Concatenacion').first().json;
const audioFiles = prepData.archivos_audio;
const audioInput = audioFiles[0].path.replace(/\\\\/g, '/');
const output = (prepData.processing_dir + '\\\\audio_loop.mp3').replace(/\\\\/g, '/');
const duracion = $input.first().json.duracion_segundos;
const fadeOut = duracion - 10;
const cmd = \`"\${ffmpeg}" -y -stream_loop -1 -i "\${audioInput}" -t \${duracion} -af "afade=t=in:st=0:d=5,afade=t=out:st=\${fadeOut}:d=10,loudnorm" -c:a aac -b:a 320k "\${output}"\`;
console.log('Running:', cmd);
try {
  const result = execSync(cmd, { timeout: 86400000, maxBuffer: 50 * 1024 * 1024 });
  return [{ json: { ...$input.first().json, audio_loop: output, stdout: result.toString().substring(0, 500) } }];
} catch(e) {
  throw new Error('FFmpeg loop audio failed: ' + e.stderr?.toString()?.substring(0, 500));
}`
    }
  },
  'FFmpeg - Render Final': {
    type: 'n8n-nodes-base.code',
    parameters: {
      jsCode: `const { execSync } = require('child_process');
const ffmpeg = '${FFMPEG}';
const calcData = $('Calcular Duracion Loop').first().json;
const processingDir = calcData.processing_dir.replace(/\\\\/g, '/');
const video = processingDir + '/video_loop.mp4';
const audio = processingDir + '/audio_loop.mp3';
const timestamp = calcData.timestamp;
const output = 'E:/RainTube/output/' + timestamp + '_final.mp4';
const cmd = \`"\${ffmpeg}" -y -i "\${video}" -i "\${audio}" -c:v libx264 -preset slow -crf 18 -b:v 10M -maxrate 12M -bufsize 24M -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "\${output}"\`;
console.log('Running:', cmd);
try {
  const result = execSync(cmd, { timeout: 86400000, maxBuffer: 50 * 1024 * 1024 });
  return [{ json: { ...calcData, output_path: output, stdout: result.toString().substring(0, 500) } }];
} catch(e) {
  throw new Error('FFmpeg render failed: ' + e.stderr?.toString()?.substring(0, 500));
}`
    }
  }
};

(async () => {
  console.log('=== Fixing WF2 ===');
  const wf = await getWorkflow('jMnHqAiHWbOFu2mg');

  // Replace executeCommand nodes with Code nodes
  let replaced = 0;
  wf.nodes = wf.nodes.map(n => {
    if (newNodes[n.name]) {
      console.log(`  Replacing: ${n.name} (${n.type} -> n8n-nodes-base.code)`);
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

  // Fix parallel connections: Loop Audio -> Render Final should be index 1
  if (wf.connections['FFmpeg - Loop Audio']) {
    const audioConn = wf.connections['FFmpeg - Loop Audio'];
    if (audioConn.main && audioConn.main[0]) {
      audioConn.main[0].forEach(conn => {
        if (conn.node === 'FFmpeg - Render Final' && conn.index === 0) {
          console.log('  Fixing: FFmpeg - Loop Audio -> Render Final (index 0 -> 1)');
          conn.index = 1;
        }
      });
    }
  }

  await putWorkflow('jMnHqAiHWbOFu2mg', wf);
  console.log('Done!');
})();
