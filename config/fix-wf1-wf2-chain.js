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
        console.log(`  PUT status: ${res.statusCode}`);
        if (res.statusCode >= 400) {
          try { console.log('  Error:', JSON.parse(body).message); } catch(e) {}
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
  // === STEP 1: Add save-to-file at end of WF1 ===
  console.log('=== Updating WF1: Add save output to file ===');
  const wf1 = await getWorkflow('xW6WxDB6zbbWK1N3');

  // Find the last node "Descargar Audio"
  const descargarAudio = wf1.nodes.find(n => n.name === 'Descargar Audio');
  if (!descargarAudio) {
    console.log('  ERROR: Descargar Audio not found');
    return;
  }

  // Modify Descargar Audio to also save output JSON
  const origCode = descargarAudio.parameters.jsCode;
  // Check if already modified
  if (!origCode.includes('pipeline_output.json')) {
    // Add saving logic at the end of the existing return statement
    // We need to wrap the existing code to also save the output
    descargarAudio.parameters.jsCode = origCode.replace(
      /return \[\{ json: (.*?) \}\];$/s,
      `const outputData = $1;
const fsSync = require('fs');
fsSync.writeFileSync('E:\\\\RainTube\\\\config\\\\pipeline_output.json', JSON.stringify(outputData, null, 2));
return [{ json: outputData }];`
    );
    console.log('  Modified Descargar Audio to save output');
  } else {
    console.log('  Already modified');
  }

  await putWorkflow('xW6WxDB6zbbWK1N3', wf1);

  // === STEP 2: Update WF2 "Recibir Datos Material" to read from file ===
  console.log('\n=== Updating WF2: Read material data from file ===');
  const wf2 = await getWorkflow('jMnHqAiHWbOFu2mg');

  const recibirDatos = wf2.nodes.find(n => n.name === 'Recibir Datos Material');
  if (recibirDatos) {
    recibirDatos.parameters.jsCode = `// Lee los datos del material del WF1
const fs = require('fs');
const dataPath = 'E:\\\\RainTube\\\\config\\\\pipeline_output.json';

let data;
try {
  const raw = fs.readFileSync(dataPath, 'utf8');
  data = JSON.parse(raw);
  console.log('Datos cargados desde pipeline_output.json');
  console.log('Tema:', data.tema?.tema);
  console.log('Videos:', data.archivos_video?.length);
  console.log('Audios:', data.archivos_audio?.length);
} catch(e) {
  throw new Error('No se encontraron datos del WF1. Ejecuta primero el Workflow 1. Error: ' + e.message);
}

return [{ json: data }];`;
    console.log('  Updated Recibir Datos Material');
  }

  await putWorkflow('jMnHqAiHWbOFu2mg', wf2);

  // === STEP 3: Also save WF1's last execution data now (for immediate testing) ===
  console.log('\n=== Saving last WF1 execution data to file ===');
  const fs = require('fs');

  // Get the last successful execution
  const execResp = await new Promise((resolve) => {
    http.get({
      hostname: 'localhost', port: 5678,
      path: '/api/v1/executions?workflowId=xW6WxDB6zbbWK1N3&limit=1&status=success',
      headers: { 'X-N8N-API-KEY': API_KEY }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(JSON.parse(body)));
    });
  });

  if (execResp.data && execResp.data.length > 0) {
    const execId = execResp.data[0].id;
    const execData = await new Promise((resolve) => {
      http.get({
        hostname: 'localhost', port: 5678,
        path: `/api/v1/executions/${execId}?includeData=true`,
        headers: { 'X-N8N-API-KEY': API_KEY }
      }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve(JSON.parse(body)));
      });
    });

    const rd = execData.data?.resultData?.runData;
    if (rd && rd['Descargar Audio'] && rd['Descargar Audio'][0]?.data?.main?.[0]?.[0]?.json) {
      const output = rd['Descargar Audio'][0].data.main[0][0].json;
      fs.writeFileSync('E:\\RainTube\\config\\pipeline_output.json', JSON.stringify(output, null, 2));
      console.log('  Saved pipeline_output.json with', Object.keys(output).length, 'keys');
      console.log('  Videos:', output.archivos_video?.length);
      console.log('  Audio:', output.archivos_audio?.length);
    }
  }

  console.log('\nDone!');
})();
