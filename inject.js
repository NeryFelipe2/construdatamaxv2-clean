const fs = require('fs');

let tsFile = fs.readFileSync('workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts', 'utf8');
let fixedJs = fs.readFileSync('test_node_fixed.js', 'utf8');

// Replace the old jsCode literal with the new fixed one inside the typescript file
tsFile = tsFile.replace(/name: 'Parse Evento Whatsapp',\s*type: 'n8n-nodes-base\.code',\s*version: 2,\s*position: \[[\d]+, [\d]+\],\s*\}\)\s*ParseEventoWhatsapp = \{\s*jsCode: `[\s\S]*?`,\s*options: \{\},/m, 
(match) => {
    // Reconstruct the exact structure but inject the new jsCode
    return match.replace(/jsCode: `[\s\S]*?`/, 'jsCode: `' + fixedJs + '`');
});

fs.writeFileSync('workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts', tsFile, 'utf8');
console.log("Successfully injected back into TS");
