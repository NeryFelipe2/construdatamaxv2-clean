const fs = require('fs');

const file = 'workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /if \(\!p\) return '🤖 ConstruDataMax\\\\n\\\\nNão consegui identificar seu projeto\. Telefone detectado: \*' \+ phoneDetectado \+ '\*\\\\nFala com o admin para te cadastrar\.';/;

const replacement = `if (!p) return ['🤖 ConstruDataMax', '', 'Não consegui identificar seu projeto. Telefone detectado: *' + phoneDetectado + '*', 'Fala com o admin para te cadastrar.'].join('\\n');`;

if (code.match(regex)) {
   code = code.replace(regex, replacement);
   fs.writeFileSync(file, code, 'utf8');
   console.log("REPLACED!");
} else {
   console.log("Not found.");
}
