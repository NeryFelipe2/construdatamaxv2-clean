const fs = require('fs');
let file = 'workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts';
let code = fs.readFileSync(file, 'utf8');

let m = code.match(/jsCode: \`([\s\S]*?)\`,/);
if (!m) { console.log('not found'); process.exit(1); }

let js = m[1];

function fixQuotes(str) {
  let result = '';
  let inQuote = false;
  for (let i = 0; i < str.length; i++) {
    let char = str[i];
    if (char === '\\'' && (i === 0 || str[i-1] !== '\\\\')) {
      inQuote = !inQuote;
      result += char;
    } else if (char === '\\n' && inQuote) {
      result += '\\\\n';
    } else if (char === '\\r' && inQuote) {
      // ignore
    } else {
      result += char;
    }
  }
  return result;
}

let fixedJs = fixQuotes(js);
code = code.replace(m[1], fixedJs);
fs.writeFileSync(file, code, 'utf8');
console.log('Fixed newlines inside single quotes.');
