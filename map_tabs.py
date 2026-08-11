import re
with open(r'C:\Users\felip\Downloads\NOVA NS Versao 5\construdata_gui.py', 'r', encoding='utf-8') as f:
    content = f.read()
tabs = re.findall(r'def (_tab_\w+)\(self', content)
adds = re.findall(r'self\.nb\.add\(tab,\s*text="([^"]+)"', content)
print('TABS metodos:', tabs)
print('TABS nomes:', adds)
print('Total linhas:', content.count('\n'))
