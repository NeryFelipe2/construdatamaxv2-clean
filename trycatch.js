const fs = require('fs');

let tsFile = fs.readFileSync('workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts', 'utf8');

tsFile = tsFile.replace(/jsCode: `([\s\S]*?)`/, (match, code) => {
    // Add try/catch block around the entire code so n8n outputs the actual JS error instead of 500!
    let safeCode = `
try {
${code}
} catch (err) {
  return [{ json: { error: err.message, stack: err.stack, ignorar: true } }];
}
`;
    return 'jsCode: `' + safeCode + '`';
});

fs.writeFileSync('workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts', tsFile, 'utf8');
console.log("Safe wrapper applied.");
