const fs = require('fs');
let code = fs.readFileSync('test_node.js', 'utf8');

let wrapper = `
(async function() {
    let $input = {
        first: () => ({ json: { body: { ignorar: 'example', phone: '+33123456789', targetWebhook: 'example', text: 'example message' } } })
    };
    
    let responderCalled = false;
    let thisCtx = {
        helpers: {
            httpRequest: async (opts) => {
                return {ok: true};
            }
        }
    };
    
    try {
        let result = await (async function() {
            ${code.replace(/return \[{ json: /g, 'return { json: ').replace(/return;/g, 'return {};')}
        }).call(thisCtx);
        console.log("EXECUTION COMPLETE", result);
    } catch(e) {
        console.error("EXECUTION ERROR:", e);
    }
})();
`;

fs.writeFileSync('test_wrapper.js', wrapper, 'utf8');
