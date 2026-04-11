const fs = require('fs');
let code = fs.readFileSync('test_node.js', 'utf8');

// We have to use the fixed JS code to avoid syntax errors
code = fs.readFileSync('test_node_fixed.js', 'utf8');

let wrapper = `
(async function() {
    let $input = {
        first: () => ({ json: { body: { 
            event: 'messages.upsert', 
            data: { 
                key: { remoteJid: '5561981846325@s.whatsapp.net', fromMe: false }, 
                message: { conversation: 'menu' }, 
                pushName: 'Felipe' 
            } 
        } } })
    };
    
    let responderCalled = false;
    let thisCtx = {
        helpers: {
            httpRequest: async (opts) => {
                console.log("MOCK HTTP REQUEST", opts);
                return {ok: true};
            }
        }
    };
    
    try {
        let result = await (async function() {
            ${code.replace(/return \[{ json: /g, 'return { json: ').replace(/return;/g, 'return {};')}
        }).call(thisCtx);
        console.log("EXECUTION COMPLETE. Result:", result);
    } catch(e) {
        console.error("EXECUTION ERROR:", e);
    }
})();
`;

fs.writeFileSync('test_wrapper_felipe.js', wrapper, 'utf8');
