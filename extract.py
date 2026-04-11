import codecs
import re
with codecs.open('workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts', 'r', 'utf-8') as f:
    text = f.read()

match = re.search(r"name: 'Parse Evento Whatsapp'.*?jsCode:\s*`([^`]+)`", text, re.DOTALL)
if match:
    code = match.group(1)
    with codecs.open('test_node.js', 'w', 'utf-8') as tf:
        tf.write(code)
    print('Code extracted.')
else:
    print('Not found')
