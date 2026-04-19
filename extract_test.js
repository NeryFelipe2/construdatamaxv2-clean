const fs = require('fs');
let code = fs.readFileSync('workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts', 'utf8');

// match jsCode: `...`,
let match = code.match(/jsCode: \`([\s\S]*?)\`,/);
if (match) {
    fs.writeFileSync('test_node_final.js', '(async function(){\n' + match[1] + '\n})();', 'utf8');
    console.log('Saved to test_node_final.js');
} else {
    console.log('Not found');
    process.exit(1);
}
