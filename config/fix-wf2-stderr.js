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

// Updated nodes with better error handling + file verification
const updatedNodes = {
  'Preparar Lista Concatenacion': {
    type: 'n8n-nodes-base.code',
    parameters: {
      jsCode: `const data = $input.first().json;
const fs = require('fs');
const path = require('path');

const timestamp = data.timestamp;
const processingDir = 'E:\\\\RainTube\\\\processing\\\\' + timestamp;

if (!fs.existsSync(processingDir)) {
  fs.mkdirSync(processingDir, { recursive: true });
}

// Verify video files exist
const archivosVideo = data.archivos_video.map(a => a.path);
const missing = archivosVideo.filter(f => !fs.existsSync(f));
if (missing.length > 0) {
  throw new Error('Faltan ' + missing.length + ' archivos de video. Re-ejecuta WF1. Ejemplo: ' + missing[0]);
}

// Create concat list for FFmpeg
const listContent = archivosVideo.map(f => "file '" + f.replace(/\\\\/g, '/') + "'").join('\\n');
const listPath = path.join(processingDir, 'videos_list.txt');
fs.writeFileSync(listPath, listContent);

console.log('Videos verificados:', archivosVideo.length);
console.log('Lista guardada:', listPath);

return [{ json: {
  ...data,
  processing_dir: processingDir,
  list_path: listPath,
  archivos_video_count: archivosVideo.length,
  duracion_segundos: data.tema.duracion_horas * 3600
} }];`
    }
  },
  'FFmpeg - Concatenar Clips': {
    type: 'n8n-nodes-base.code',
    parameters: {
      jsCode: `const { execSync } = require('child_process');
const ffmpeg = '${FFMPEG}';
const listPath = $input.first().json.list_path.replace(/\\\\/g, '/');
const outputPath = ($input.first().json.processing_dir + '\\\\clips_concatenados.mp4').replace(/\\\\/g, '/');
const cmd = '"' + ffmpeg + '" -y -f concat -safe 0 -i "' + listPath + '" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset medium -crf 20 -an -r 30 "' + outputPath + '"';
console.log('Running:', cmd);
try {
  execSync(cmd, { timeout: 600000, maxBuffer: 50 * 1024 * 1024 });
  const fs = require('fs');
  const stats = fs.statSync(outputPath);
  console.log('Output size:', (stats.size / 1024 / 1024).toFixed(1), 'MB');
  return [{ json: { ...$input.first().json, clips_concatenados: outputPath } }];
} catch(e) {
  const stderr = e.stderr ? e.stderr.toString() : '';
  const lastPart = stderr.length > 1000 ? stderr.substring(stderr.length - 1000) : stderr;
  throw new Error('FFmpeg concat failed. Last stderr:\\n' + lastPart);
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
const cmd = '"' + ffmpeg + '" -y -stream_loop -1 -i "' + input + '" -t ' + duracion + ' -vf "fade=t=in:st=0:d=3,fade=t=out:st=' + fadeOut + ':d=5" -c:v libx264 -preset medium -crf 20 -an -r 30 "' + output + '"';
console.log('Running:', cmd);
console.log('Duracion:', duracion, 'seg (' + (duracion/3600).toFixed(1) + ' horas)');
try {
  execSync(cmd, { timeout: 86400000, maxBuffer: 50 * 1024 * 1024 });
  const fs = require('fs');
  const stats = fs.statSync(output);
  console.log('Output size:', (stats.size / 1024 / 1024).toFixed(1), 'MB');
  return [{ json: { ...$input.first().json, video_loop: output } }];
} catch(e) {
  const stderr = e.stderr ? e.stderr.toString() : '';
  const lastPart = stderr.length > 1000 ? stderr.substring(stderr.length - 1000) : stderr;
  throw new Error('FFmpeg loop video failed. Last stderr:\\n' + lastPart);
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
const cmd = '"' + ffmpeg + '" -y -stream_loop -1 -i "' + audioInput + '" -t ' + duracion + ' -af "afade=t=in:st=0:d=5,afade=t=out:st=' + fadeOut + ':d=10,loudnorm" -c:a aac -b:a 320k "' + output + '"';
console.log('Running:', cmd);
console.log('Duracion:', duracion, 'seg (' + (duracion/3600).toFixed(1) + ' horas)');
try {
  execSync(cmd, { timeout: 86400000, maxBuffer: 50 * 1024 * 1024 });
  const fs = require('fs');
  const stats = fs.statSync(output);
  console.log('Output size:', (stats.size / 1024 / 1024).toFixed(1), 'MB');
  return [{ json: { ...$input.first().json, audio_loop: output } }];
} catch(e) {
  const stderr = e.stderr ? e.stderr.toString() : '';
  const lastPart = stderr.length > 1000 ? stderr.substring(stderr.length - 1000) : stderr;
  throw new Error('FFmpeg loop audio failed. Last stderr:\\n' + lastPart);
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

const fs = require('fs');
if (!fs.existsSync('E:/RainTube/output')) {
  fs.mkdirSync('E:/RainTube/output', { recursive: true });
}

const cmd = '"' + ffmpeg + '" -y -i "' + video + '" -i "' + audio + '" -c:v libx264 -preset slow -crf 18 -b:v 10M -maxrate 12M -bufsize 24M -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "' + output + '"';
console.log('Running:', cmd);
try {
  execSync(cmd, { timeout: 86400000, maxBuffer: 50 * 1024 * 1024 });
  const stats = fs.statSync(output);
  console.log('Output size:', (stats.size / 1024 / 1024 / 1024).toFixed(2), 'GB');
  return [{ json: { ...calcData, output_path: output, video_final: output } }];
} catch(e) {
  const stderr = e.stderr ? e.stderr.toString() : '';
  const lastPart = stderr.length > 1000 ? stderr.substring(stderr.length - 1000) : stderr;
  throw new Error('FFmpeg render failed. Last stderr:\\n' + lastPart);
}`
    }
  }
};

(async () => {
  console.log('=== Fixing WF2 FFmpeg error handling + file verification ===');
  const wf = await getWorkflow('jMnHqAiHWbOFu2mg');

  let replaced = 0;
  wf.nodes = wf.nodes.map(n => {
    if (updatedNodes[n.name]) {
      console.log(`  Updating: ${n.name}`);
      replaced++;
      return {
        ...n,
        type: updatedNodes[n.name].type,
        typeVersion: 2,
        parameters: updatedNodes[n.name].parameters
      };
    }
    return n;
  });
  console.log(`  Total updated: ${replaced}`);

  await putWorkflow('jMnHqAiHWbOFu2mg', wf);
  console.log('Done!');
})();
