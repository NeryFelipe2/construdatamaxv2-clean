import re
import codecs
import sys

file_path = 'workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts'

with codecs.open(file_path, 'r', 'utf-8') as f:
    text = f.read()

# find jsCode section
match = re.search(r'jsCode: `([\s\S]*?)`,', text)
if not match:
    sys.exit(1)

js_content = match.group(1)

def quote_replacer(m):
    # This matches the full single-quoted string
    s = m.group(0)
    # We replace any single backslash followed by 'n' with TWO backslashes followed by 'n'
    # Wait, first we replace any literal newlines with \\n
    s = s.replace('\r', '')
    s = s.replace('\n', '\\\\n')
    # If the file currently has \n, we must ensure it's \\n
    # let's just make sure we replace ANY escaped \n that only has a single backslash:
    s = re.sub(r'(?<!\\)\\n', r'\\\\n', s)
    return s

new_js = re.sub(r"'([^'\\]|\\.)*'", quote_replacer, js_content)

text = text.replace(js_content, new_js)

with codecs.open(file_path, 'w', 'utf-8') as f:
    f.write(text)

print("Double escaped newlines!")
