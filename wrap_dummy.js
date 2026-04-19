const fs = require('fs');
let code = fs.readFileSync('test_node_fixed.js', 'utf8');

let wrapper = `
(async function() {
    let $input = {
        first: () => ({ json: { body: { 
            "ignorar": "example",
            "phone": "+33123456789",
            "targetWebhook": "example",
            "text": "example message"
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
