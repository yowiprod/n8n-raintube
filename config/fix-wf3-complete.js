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
  console.log('=== Complete Fix WF3 ===');
  const wf = await getWorkflow('wKDVc7J0marBZPw6');

  // Set unlimited timeout
  if (!wf.settings) wf.settings = {};
  wf.settings.executionTimeout = -1;

  // 1. Add "Recibir Datos Pipeline" node after Trigger Manual
  const triggerNode = wf.nodes.find(n => n.name === 'Trigger Manual');
  const triggerPos = triggerNode.position;

  // Create new node: Recibir Datos Pipeline
  const recibirNode = {
    id: 'recibir-datos-wf3',
    name: 'Recibir Datos Pipeline',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [triggerPos[0] + 200, triggerPos[1]],
    parameters: {
      jsCode: `const fs = require('fs');

// Read pipeline data from WF1
const pipelinePath = 'E:\\\\RainTube\\\\config\\\\pipeline_output.json';
let data;
try {
  data = JSON.parse(fs.readFileSync(pipelinePath, 'utf8'));
} catch(e) {
  throw new Error('No se encontraron datos del pipeline. Ejecuta WF1 primero. Error: ' + e.message);
}

// Find the final video from WF2 output
const outputDir = 'E:\\\\RainTube\\\\output';
const files = fs.readdirSync(outputDir).filter(f => f.endsWith('_final.mp4')).sort().reverse();
if (files.length === 0) {
  throw new Error('No se encontro video final en E:\\\\RainTube\\\\output. Ejecuta WF2 primero.');
}
const videoFinal = outputDir + '/' + files[0];
console.log('Video final:', videoFinal);
console.log('Tema:', data.tema?.tema);
console.log('Timestamp:', data.timestamp);

return [{ json: {
  tema: data.tema,
  timestamp: data.timestamp,
  video_final: videoFinal,
  duracion_horas: data.tema?.duracion_horas || 4,
  archivos_audio: data.archivos_audio,
  archivos_video: data.archivos_video
} }];`
    }
  };
  wf.nodes.push(recibirNode);
  console.log('  Added: Recibir Datos Pipeline node');

  // 2. Shift OpenRouter and all subsequent nodes to the right
  const openRouterNode = wf.nodes.find(n => n.name === 'OpenRouter - Generar Metadata SEO');
  if (openRouterNode) {
    openRouterNode.position = [triggerPos[0] + 400, triggerPos[1]];
    // Fix: OpenRouter reads from Recibir Datos Pipeline now (same $json references work)
  }

  // 3. Fix Parsear Metadata - backtick regex
  const parsearNode = wf.nodes.find(n => n.name === 'Parsear Metadata');
  if (parsearNode) {
    parsearNode.position = [triggerPos[0] + 600, triggerPos[1]];
    parsearNode.parameters.jsCode = `const raw = $input.first().json.choices[0].message.content;
let cleaned = raw || '';
const fence = String.fromCharCode(96, 96, 96);
while (cleaned.indexOf(fence + 'json') !== -1) {
  cleaned = cleaned.replace(fence + 'json', '');
}
while (cleaned.indexOf(fence) !== -1) {
  cleaned = cleaned.replace(fence, '');
}
cleaned = cleaned.trim();
const response = JSON.parse(cleaned);
const prevData = $('Recibir Datos Pipeline').first().json;
return [{ json: { ...prevData, metadata: response } }];`;
    console.log('  Fixed: Parsear Metadata (backtick regex + reads from Recibir Datos)');
  }

  // 4. Fix FFmpeg - Extraer Frame (async spawn)
  const extraerNode = wf.nodes.find(n => n.name === 'FFmpeg - Extraer Frame');
  if (extraerNode) {
    extraerNode.position = [triggerPos[0] + 800, triggerPos[1]];
    extraerNode.parameters.jsCode = `${FFMPEG_HELPER}

const fs = require('fs');
const ffmpeg = '${FFMPEG}';
const videoFinal = $input.first().json.video_final.replace(/\\\\/g, '/');
const timestamp = $input.first().json.timestamp;
const thumbDir = 'E:/RainTube/thumbnails';

if (!fs.existsSync(thumbDir)) {
  fs.mkdirSync(thumbDir, { recursive: true });
}

const thumbnailPath = thumbDir + '/' + timestamp + '_thumb.jpg';

console.log('Video:', videoFinal);
console.log('Thumbnail:', thumbnailPath);

const args = [
  '-y', '-ss', '30',
  '-i', videoFinal,
  '-vframes', '1',
  '-vf', 'scale=1280:720',
  '-q:v', '2',
  thumbnailPath
];

console.log('Extracting frame at 30s...');
await runFFmpeg(ffmpeg, args);
console.log('Success!');
return [{ json: { ...$input.first().json, thumbnail_base: thumbnailPath } }];`;
    console.log('  Fixed: FFmpeg - Extraer Frame (async)');
  }

  // 5. Fix FFmpeg - Añadir Texto Thumbnail (async spawn)
  const textoNode = wf.nodes.find(n => n.name === 'FFmpeg - Añadir Texto Thumbnail');
  if (textoNode) {
    textoNode.position = [triggerPos[0] + 1000, triggerPos[1]];
    textoNode.parameters.jsCode = `${FFMPEG_HELPER}

const fs = require('fs');
const ffmpeg = '${FFMPEG}';
const timestamp = $input.first().json.timestamp;
const thumbBase = ('E:/RainTube/thumbnails/' + timestamp + '_thumb.jpg');
const thumbFinal = ('E:/RainTube/thumbnails/' + timestamp + '_thumbnail.jpg');
const titulo = ($input.first().json.metadata.titulo || 'Rain Relax').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 30);

console.log('Input:', thumbBase);
console.log('Output:', thumbFinal);
console.log('Titulo:', titulo);

const args = [
  '-y', '-i', thumbBase,
  '-vf', "eq=brightness=-0.15:saturation=1.3,drawtext=text='" + titulo + "':fontsize=56:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:font=Arial",
  '-q:v', '2',
  thumbFinal
];

console.log('Adding text overlay...');
await runFFmpeg(ffmpeg, args);
console.log('Success!');
return [{ json: { ...$input.first().json, thumbnail_final: thumbFinal } }];`;
    console.log('  Fixed: FFmpeg - Añadir Texto Thumbnail (async)');
  }

  // 6. Fix Output node position and data source
  const outputNode = wf.nodes.find(n => n.name === 'Output Listo Para Subir');
  if (outputNode) {
    outputNode.position = [triggerPos[0] + 1200, triggerPos[1]];
    outputNode.parameters.jsCode = `const data = $input.first().json;
const timestamp = data.timestamp;

// Save pipeline output for WF4
const fs = require('fs');
const outputData = {
  video_final: data.video_final,
  thumbnail: 'E:\\\\RainTube\\\\thumbnails\\\\' + timestamp + '_thumbnail.jpg',
  metadata: data.metadata,
  tema: data.tema,
  timestamp: timestamp,
  duracion_horas: data.duracion_horas || 4
};

const pipelinePath = 'E:\\\\RainTube\\\\config\\\\pipeline_wf3_output.json';
fs.writeFileSync(pipelinePath, JSON.stringify(outputData, null, 2));
console.log('Pipeline WF3 output saved to:', pipelinePath);
console.log('Video:', outputData.video_final);
console.log('Thumbnail:', outputData.thumbnail);
console.log('Titulo:', outputData.metadata.titulo);

return [{ json: outputData }];`;
    console.log('  Fixed: Output Listo Para Subir (saves pipeline for WF4)');
  }

  // 7. Update connections: Trigger → Recibir Datos → OpenRouter → Parsear → ...
  wf.connections = {
    'Trigger Manual': {
      main: [[{ node: 'Recibir Datos Pipeline', type: 'main', index: 0 }]]
    },
    'Recibir Datos Pipeline': {
      main: [[{ node: 'OpenRouter - Generar Metadata SEO', type: 'main', index: 0 }]]
    },
    'OpenRouter - Generar Metadata SEO': {
      main: [[{ node: 'Parsear Metadata', type: 'main', index: 0 }]]
    },
    'Parsear Metadata': {
      main: [[{ node: 'FFmpeg - Extraer Frame', type: 'main', index: 0 }]]
    },
    'FFmpeg - Extraer Frame': {
      main: [[{ node: 'FFmpeg - Añadir Texto Thumbnail', type: 'main', index: 0 }]]
    },
    'FFmpeg - Añadir Texto Thumbnail': {
      main: [[{ node: 'Output Listo Para Subir', type: 'main', index: 0 }]]
    }
  };
  console.log('  Updated: connections chain');

  await putWorkflow('wKDVc7J0marBZPw6', wf);
  console.log('Done!');
})();
