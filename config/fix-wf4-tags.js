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
  console.log('=== Fix WF4: Sanitize YouTube tags ===');
  const wf = await getWorkflow('nz4c5vp2jLPPgUZS');

  const prepNode = wf.nodes.find(n => n.name === 'Preparar YouTube Body');
  if (prepNode) {
    prepNode.parameters.jsCode = `const data = $input.first().json;
const metadata = data.metadata;

// Sanitize tags for YouTube:
// - Remove special chars like < >
// - Max 30 chars per tag
// - Max 500 total chars across all tags
// - Max 15 tags
let rawTags = metadata.tags || ['rain', 'sleep', 'relax'];
if (typeof rawTags === 'string') rawTags = rawTags.split(',');

const cleanTags = rawTags
  .map(t => String(t).replace(/[<>"\\\\]/g, '').trim())
  .filter(t => t.length > 0 && t.length <= 30)
  .slice(0, 15);

// Ensure total chars under 500
let totalChars = 0;
const finalTags = [];
for (const tag of cleanTags) {
  if (totalChars + tag.length > 480) break;
  finalTags.push(tag);
  totalChars += tag.length;
}

// Sanitize title - remove emojis that might cause issues, limit to 100 chars
const title = (metadata.titulo || 'Rain Relaxation Video').substring(0, 100);

// Sanitize description - limit to 5000 chars
const desc = (metadata.descripcion || 'Relaxing rain sounds.').substring(0, 5000);

const body = {
  snippet: {
    title: title,
    description: desc,
    tags: finalTags,
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

console.log('Title:', title);
console.log('Tags (' + finalTags.length + '):', finalTags.join(', '));
console.log('Description length:', desc.length);

return [{ json: { ...data, youtube_body: JSON.stringify(body) } }];`;
    console.log('  Fixed: Preparar YouTube Body (sanitized tags, title, description)');
  }

  await putWorkflow('nz4c5vp2jLPPgUZS', wf);
  console.log('Done!');
})();
