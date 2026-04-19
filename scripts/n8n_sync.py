import os
import re
import sys

TS_FILE = 'workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts'
JS_FILE = 'src/n8n_whatsapp_router/router.js'

def extract():
    with open(TS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex to find jsCode
    match = re.search(r'jsCode:\s*`([\s\S]*?)`,\n', content)
    if not match:
        print("Could not find jsCode in", TS_FILE)
        return
        
    js_content = match.group(1)
    
    os.makedirs(os.path.dirname(JS_FILE), exist_ok=True)
    with open(JS_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"Extracted JS code to {JS_FILE}")

def inject():
    if not os.path.exists(JS_FILE):
        print(f"File {JS_FILE} does not exist.")
        return
        
    with open(JS_FILE, 'r', encoding='utf-8') as f:
        js_content = f.read()
        
    with open(TS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # Escape things if needed, but n8n puts template literals inside ` `.
    # Since we use ` ` to wrap, any internal ` or \${ must be escaped, but n8n jsCode usually doesn't need external string injection if it doesn't use those, or we escape backticks!
    js_escaped = js_content.replace("`", "\\`").replace("${", "\\${")

    # Replace the block
    new_content = re.sub(
        r'jsCode:\s*`[\s\S]*?`,\n',
        f'jsCode: `{js_escaped}`,\n',
        content,
        count=1
    )
    
    with open(TS_FILE, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Injected JS code back to {TS_FILE}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python n8n_sync.py [extract|inject]")
    elif sys.argv[1] == "extract":
        extract()
    elif sys.argv[1] == "inject":
        inject()
    else:
        print("Unknown command")
