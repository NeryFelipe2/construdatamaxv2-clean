const fs = require('fs');

const file = 'workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts';
let tsString = fs.readFileSync(file, 'utf8');

// Match the jsCode payload
const match = tsString.match(/jsCode: \`([\s\S]*?)\`,/);
if (!match) {
    console.error("jsCode not found in the workflow.");
    process.exit(1);
}

let js = match[1];

let result = '';
let inSingleQuote = false;

for (let i = 0; i < js.length; i++) {
    const char = js[i];
    
    // Check if we are entering or leaving a single-quote string
    if (char === "'" && (i === 0 || js[i-1] !== '\\')) {
        inSingleQuote = !inSingleQuote;
        result += char;
    } else if (char === '\n' && inSingleQuote) {
        // Replace literal newline inside single quote with '\n'
        result += '\\n';
    } else if (char === '\r' && inSingleQuote) {
        // ignore carriage returns inside single quotes
    } else {
        result += char;
    }
}

// Write it back
tsString = tsString.replace(match[1], result);
fs.writeFileSync(file, tsString, 'utf8');
console.log("Fixed literal newlines in jsCode.");
