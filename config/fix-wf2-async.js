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

// Helper function for async ffmpeg execution (non-blocking, allows heartbeats)
const FFMPEG_HELPER = `
function runFFmpeg(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); if (stderr.length > 10000) stderr = stderr.substring(stderr.length - 5000); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error('FFmpeg exit code ' + code + ':\\n' + (stderr.length > 2000 ? stderr.substring(stderr.length - 2000) : stderr)));
    });
    proc.on('error', (e) => reject(new Error('FFmpeg spawn error: ' + e.message)));
  });
}`;

(async () => {
  console.log('=== Fixing WF2: Async FFmpeg (non-blocking) ===');
  const wf = await getWorkflow('jMnHqAiHWbOFu2mg');

  // Ensure settings
  if (!wf.settings) wf.settings = {};
  wf.settings.executionTimeout = -1;

  // 1. FFmpeg - Concatenar Clips (async spawn)
  const concatNode = wf.nodes.find(n => n.name === 'FFmpeg - Concatenar Clips');
  if (concatNode) {
    concatNode.parameters.jsCode = `${FFMPEG_HELPER}

const fs = require('fs');
const ffmpeg = '${FFMPEG}';
const listPath = $input.first().json.list_path.replace(/\\\\/g, '/');
const outputPath = ($input.first().json.processing_dir + '\\\\clips_concatenados.mp4').replace(/\\\\/g, '/');

console.log('Input list:', listPath);
console.log('Output:', outputPath);

const args = [
  '-y', '-f', 'concat', '-safe', '0',
  '-i', listPath,
  '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
  '-an', '-r', '30',
  outputPath
];

console.log('Running ffmpeg concat (async, ultrafast)...');
await runFFmpeg(ffmpeg, args);
const stats = fs.statSync(outputPath);
console.log('Success! Output size:', (stats.size / 1024 / 1024).toFixed(1), 'MB');
return [{ json: { ...$input.first().json, clips_concatenados: outputPath } }];`;
    console.log('  Updated: FFmpeg - Concatenar Clips');
  }

  // 2. FFmpeg - Loop Video (async spawn)
  const loopVideoNode = wf.nodes.find(n => n.name === 'FFmpeg - Loop Video');
  if (loopVideoNode) {
    loopVideoNode.parameters.jsCode = `${FFMPEG_HELPER}

const fs = require('fs');
const ffmpeg = '${FFMPEG}';
const input = $input.first().json.clips_concatenados.replace(/\\\\/g, '/');
const output = ($input.first().json.processing_dir + '\\\\video_loop.mp4').replace(/\\\\/g, '/');
const duracion = $input.first().json.duracion_segundos;
const fadeOut = duracion - 5;

console.log('Input:', input);
console.log('Output:', output);
console.log('Duracion:', duracion, 'seg (' + (duracion/3600).toFixed(1) + ' horas)');

const args = [
  '-y', '-stream_loop', '-1',
  '-i', input,
  '-t', String(duracion),
  '-vf', 'fade=t=in:st=0:d=3,fade=t=out:st=' + fadeOut + ':d=5',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
  '-an', '-r', '30',
  output
];

console.log('Running ffmpeg loop video (async, ultrafast)...');
await runFFmpeg(ffmpeg, args);
const stats = fs.statSync(output);
console.log('Success! Output size:', (stats.size / 1024 / 1024 / 1024).toFixed(2), 'GB');
return [{ json: { ...$input.first().json, video_loop: output } }];`;
    console.log('  Updated: FFmpeg - Loop Video');
  }

  // 3. FFmpeg - Loop Audio (async spawn)
  const loopAudioNode = wf.nodes.find(n => n.name === 'FFmpeg - Loop Audio');
  if (loopAudioNode) {
    loopAudioNode.parameters.jsCode = `${FFMPEG_HELPER}

const fs = require('fs');
const ffmpeg = '${FFMPEG}';
const prepData = $('Preparar Lista Concatenacion').first().json;
const audioFiles = prepData.archivos_audio;
const audioInput = audioFiles[0].path.replace(/\\\\/g, '/');
const output = (prepData.processing_dir + '\\\\audio_loop.mp3').replace(/\\\\/g, '/');
const duracion = $input.first().json.duracion_segundos;
const fadeOut = duracion - 10;

console.log('Audio input:', audioInput);
console.log('Output:', output);
console.log('Duracion:', duracion, 'seg');

const args = [
  '-y', '-stream_loop', '-1',
  '-i', audioInput,
  '-t', String(duracion),
  '-af', 'afade=t=in:st=0:d=5,afade=t=out:st=' + fadeOut + ':d=10,loudnorm',
  '-c:a', 'aac', '-b:a', '320k',
  output
];

console.log('Running ffmpeg loop audio (async)...');
await runFFmpeg(ffmpeg, args);
const stats = fs.statSync(output);
console.log('Success! Output size:', (stats.size / 1024 / 1024).toFixed(1), 'MB');
return [{ json: { ...$input.first().json, audio_loop: output } }];`;
    console.log('  Updated: FFmpeg - Loop Audio');
  }

  // 4. FFmpeg - Render Final (async spawn)
  const renderNode = wf.nodes.find(n => n.name === 'FFmpeg - Render Final');
  if (renderNode) {
    renderNode.parameters.jsCode = `${FFMPEG_HELPER}

const fs = require('fs');
const ffmpeg = '${FFMPEG}';
const calcData = $('Calcular Duracion Loop').first().json;
const processingDir = calcData.processing_dir.replace(/\\\\/g, '/');
const video = processingDir + '/video_loop.mp4';
const audio = processingDir + '/audio_loop.mp3';
const timestamp = calcData.timestamp;
const output = 'E:/RainTube/output/' + timestamp + '_final.mp4';

if (!fs.existsSync('E:/RainTube/output')) {
  fs.mkdirSync('E:/RainTube/output', { recursive: true });
}

console.log('Video:', video);
console.log('Audio:', audio);
console.log('Output:', output);

const args = [
  '-y',
  '-i', video,
  '-i', audio,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-b:v', '10M', '-maxrate', '12M', '-bufsize', '24M',
  '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
  '-shortest', '-movflags', '+faststart',
  output
];

console.log('Running ffmpeg render final (async, slow preset)...');
await runFFmpeg(ffmpeg, args);
const stats = fs.statSync(output);
console.log('Success! Output size:', (stats.size / 1024 / 1024 / 1024).toFixed(2), 'GB');
return [{ json: { ...calcData, output_path: output, video_final: output } }];`;
    console.log('  Updated: FFmpeg - Render Final');
  }

  await putWorkflow('jMnHqAiHWbOFu2mg', wf);
  console.log('Done!');
})();
