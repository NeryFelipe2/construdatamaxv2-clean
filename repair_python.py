import codecs
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = 'workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts'
with codecs.open(file_path, 'r', 'utf-8') as f:
    text = f.read()

# find jsCode section
match = re.search(r'jsCode: `([\s\S]*?)`,', text)
if not match:
    print("Not found")
    sys.exit(1)

js_content = match.group(1)

# we will replace everything inside single quotes
def replace_newlines_in_quotes(match_obj):
    # the entire single-quoted string
    s = match_obj.group(0)
    # replace \n with literal \n (escaped for JS string)
    s = s.replace('\n', '\\n').replace('\r', '')
    return s

# Pattern: match anything between single quotes, mindful of escapes
# This regex matches a single quote, then any number of (escaped anything OR non-quotes), then single quote.
new_js_content = re.sub(r"'([^'\\]|\\.)*'", replace_newlines_in_quotes, js_content)

new_text = text.replace(js_content, new_js_content)

with codecs.open(file_path, 'w', 'utf-8') as f:
    f.write(new_text)

print("Replaced successfully. Testing node wrapper...")
