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
  console.log('=== Fix WF4: Pipeline data from WF3 ===');
  const wf = await getWorkflow('nz4c5vp2jLPPgUZS');

  const triggerNode = wf.nodes.find(n => n.name === 'Trigger Manual');
  const triggerPos = triggerNode.position;

  // 1. Add Recibir Datos Pipeline node
  const recibirNode = {
    id: 'recibir-datos-wf4',
    name: 'Recibir Datos WF3',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [triggerPos[0] + 200, triggerPos[1]],
    parameters: {
      jsCode: `const fs = require('fs');

// Read pipeline data from WF3
const pipelinePath = 'E:\\\\RainTube\\\\config\\\\pipeline_wf3_output.json';
let data;
try {
  data = JSON.parse(fs.readFileSync(pipelinePath, 'utf8'));
} catch(e) {
  throw new Error('No se encontraron datos de WF3. Ejecuta WF3 primero. Error: ' + e.message);
}

console.log('Video:', data.video_final);
console.log('Thumbnail:', data.thumbnail);
console.log('Titulo:', data.metadata?.titulo);
console.log('Tags:', data.metadata?.tags?.length);

return [{ json: data }];`
    }
  };
  wf.nodes.push(recibirNode);
  console.log('  Added: Recibir Datos WF3');

  // 2. Fix YouTube - Subir Video to read from Recibir Datos WF3
  const subirVideoNode = wf.nodes.find(n => n.name === 'YouTube - Subir Video');
  if (subirVideoNode) {
    subirVideoNode.parameters.jsCode = `// Para videos grandes (10-50GB) usamos upload resumable
const fs = require('fs');
const https = require('https');

const data = $('Recibir Datos WF3').first().json;
const videoPath = data.video_final;
const uploadUrl = $input.first().json.headers?.location || $input.first().json.Location;

if (!uploadUrl) {
  throw new Error('No se obtuvo URL de upload. Verifica el token de YouTube.');
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
      try { resolve(JSON.parse(body)); }
      catch(e) { reject(new Error('YouTube response parse error: ' + body.substring(0, 500))); }
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
    console.log('  Fixed: YouTube - Subir Video (reads from Recibir Datos WF3)');
  }

  // 3. Fix Guardar Log to read from Recibir Datos WF3
  const logNode = wf.nodes.find(n => n.name === 'Guardar Log + Resultado');
  if (logNode) {
    logNode.parameters.jsCode = `const data = $('YouTube - Subir Video').first().json;
const pipelineData = $('Recibir Datos WF3').first().json;
const fs = require('fs');

// Guardar log de video publicado
const logEntry = {
  fecha: new Date().toISOString(),
  video_id: data.video_id,
  url: data.video_url,
  titulo: data.titulo,
  tema: pipelineData.tema,
  duracion_horas: pipelineData.duracion_horas,
  status: data.status
};

const logDir = 'E:\\\\RainTube\\\\logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logPath = logDir + '/videos_publicados.json';
let logs = [];
try {
  logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
} catch(e) {}
logs.push(logEntry);
fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
console.log('Log saved! Total videos published:', logs.length);

return [{ json: {
  mensaje: 'Video publicado exitosamente!',
  url: data.video_url,
  titulo: data.titulo,
  video_id: data.video_id
} }];`;
    console.log('  Fixed: Guardar Log (reads from Recibir Datos WF3)');
  }

  // 4. Update connections
  wf.connections = {
    'Trigger Manual': {
      main: [[{ node: 'Recibir Datos WF3', type: 'main', index: 0 }]]
    },
    'Recibir Datos WF3': {
      main: [[{ node: 'YouTube - Iniciar Upload', type: 'main', index: 0 }]]
    },
    'YouTube - Iniciar Upload': {
      main: [[{ node: 'YouTube - Subir Video', type: 'main', index: 0 }]]
    },
    'YouTube - Subir Video': {
      main: [[{ node: 'YouTube - Subir Thumbnail', type: 'main', index: 0 }]]
    },
    'YouTube - Subir Thumbnail': {
      main: [[{ node: 'Guardar Log + Resultado', type: 'main', index: 0 }]]
    }
  };
  console.log('  Updated: connections chain');

  await putWorkflow('nz4c5vp2jLPPgUZS', wf);
  console.log('Done!');
})();
