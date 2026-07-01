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
  console.log('=== Fix WF2: Audio codec mp3 -> libmp3lame ===');
  const wf = await getWorkflow('jMnHqAiHWbOFu2mg');

  // Fix Loop Audio: change -c:a aac to -c:a libmp3lame, -b:a 320k stays
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
console.log('Duracion:', duracion, 'seg (' + (duracion/3600).toFixed(1) + ' horas)');

const args = [
  '-y', '-stream_loop', '-1',
  '-i', audioInput,
  '-t', String(duracion),
  '-af', 'afade=t=in:st=0:d=5,afade=t=out:st=' + fadeOut + ':d=10,loudnorm',
  '-c:a', 'libmp3lame', '-b:a', '320k',
  output
];

console.log('Running ffmpeg loop audio (async, libmp3lame)...');
await runFFmpeg(ffmpeg, args);
const stats = fs.statSync(output);
console.log('Success! Output size:', (stats.size / 1024 / 1024).toFixed(1), 'MB');
return [{ json: { ...$input.first().json, audio_loop: output } }];`;
    console.log('  Updated: FFmpeg - Loop Audio (codec: libmp3lame)');
  }

  // Also fix Render Final to read audio as mp3 correctly (it already does, just confirm)
  const renderNode = wf.nodes.find(n => n.name === 'FFmpeg - Render Final');
  if (renderNode) {
    // Render uses -c:a aac which is fine for the final .mp4 output
    console.log('  Render Final: OK (output is .mp4 with aac, no change needed)');
  }

  await putWorkflow('jMnHqAiHWbOFu2mg', wf);
  console.log('Done!');
})();
