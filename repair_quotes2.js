const fs = require('fs');
const file = 'workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts';
let code = fs.readFileSync(file, 'utf8');

const match = code.match(/jsCode: \`([\s\S]*?)\`,/);
if (!match) process.exit(1);

let js = match[1];

let newJs = js.replace(/'([^'\\]|\\.)*'/g, (m) => m.replace(/\n/g, '\\n').replace(/\r/g, ''));

code = code.replace(match[1], newJs);
fs.writeFileSync(file, code, 'utf8');
console.log('Fixed exactly using JS regex g flag');
