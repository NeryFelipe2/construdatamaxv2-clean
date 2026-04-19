const fs = require('fs');
let code = fs.readFileSync('test_node_fixed.js', 'utf8');

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
    
    let thisCtx = {
        helpers: {
            httpRequest: async (opts) => {
                console.log("MOCK HTTP REQUEST", opts);
                return {ok: true};
            }
        }
    };
    
    try {
        let func = async function() {
            ${code}
        };
        let result = await func.call(thisCtx);
        console.log("EXECUTION COMPLETE. Result:", JSON.stringify(result));
    } catch(e) {
        console.error("EXECUTION ERROR:", e);
    }
})();
`;

fs.writeFileSync('test_wrapper_exact.js', wrapper, 'utf8');
