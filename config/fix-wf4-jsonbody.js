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
  console.log('=== Fix WF4: YouTube JSON body ===');
  const wf = await getWorkflow('nz4c5vp2jLPPgUZS');

  // Add a "Preparar YouTube Body" Code node between Recibir Datos and YouTube - Iniciar Upload
  const recibirNode = wf.nodes.find(n => n.name === 'Recibir Datos WF3');
  const youtubeNode = wf.nodes.find(n => n.name === 'YouTube - Iniciar Upload');

  // Create Preparar Body node
  const prepBodyNode = {
    id: 'preparar-yt-body',
    name: 'Preparar YouTube Body',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [recibirNode.position[0] + 200, recibirNode.position[1]],
    parameters: {
      jsCode: `const data = $input.first().json;
const metadata = data.metadata;

const body = {
  snippet: {
    title: metadata.titulo || 'Rain Relaxation Video',
    description: metadata.descripcion || 'Relaxing rain sounds for sleep and study.',
    tags: metadata.tags || ['rain', 'sleep', 'relax'],
    categoryId: '10',
    defaultLanguage: 'en',
    defaultAudioLanguage: 'en'
  },
  status: {
    privacyStatus: 'public',
    selfDeclaredMadeForKids: false,
    license: 'creativeCommon'
  }
};

console.log('Title:', body.snippet.title);
console.log('Tags:', body.snippet.tags.length);
console.log('Description length:', body.snippet.description.length);

return [{ json: { ...data, youtube_body: JSON.stringify(body) } }];`
    }
  };
  wf.nodes.push(prepBodyNode);
  console.log('  Added: Preparar YouTube Body node');

  // Shift YouTube node position
  if (youtubeNode) {
    youtubeNode.position = [recibirNode.position[0] + 400, recibirNode.position[1]];
    // Change jsonBody to use the pre-built JSON string
    youtubeNode.parameters.jsonBody = '={{ $json.youtube_body }}';
    console.log('  Fixed: YouTube - Iniciar Upload jsonBody');
  }

  // Update connections
  wf.connections = {
    'Trigger Manual': {
      main: [[{ node: 'Recibir Datos WF3', type: 'main', index: 0 }]]
    },
    'Recibir Datos WF3': {
      main: [[{ node: 'Preparar YouTube Body', type: 'main', index: 0 }]]
    },
    'Preparar YouTube Body': {
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
  console.log('  Updated: connections');

  await putWorkflow('nz4c5vp2jLPPgUZS', wf);
  console.log('Done!');
})();
