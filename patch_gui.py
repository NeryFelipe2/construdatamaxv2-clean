import re

with open(r"C:\Users\felip\Downloads\NOVA NS Versao 5\construdata_gui.py", "r", encoding="utf-8") as f:
    code = f.read()

# Substituir cores fixas por vázios onde são nomeadas bg/fg para widgets do tk
patterns = [
    r",\s*bg=([A-Z0-9_]+|'[#\w]+')",
    r",\s*fg=([A-Z0-9_]+|'[#\w]+')",
    r",\s*bg=([A-Z0-9_]+|\"[#\w]+\")",
    r",\s*fg=([A-Z0-9_]+|\"[#\w]+\")",
    r",\s*relief=tk\.FLAT",
    r"bg=([A-Z0-9_]+|'[#\w]+'),\s*",
    r"fg=([A-Z0-9_]+|'[#\w]+'),\s*"
]
for p in patterns:
    code = re.sub(p, "", code)

# Adicionar tema do Sun Valley
code = code.replace("import tkinter as tk", "import tkinter as tk\nimport sv_ttk")
code = code.replace('root.title(f"ConstruData - HydroNetwork', 'sv_ttk.set_theme("dark")\n        root.title(f"ConstruData - HydroNetwork')

with open(r"C:\Users\felip\Downloads\NOVA NS Versao 5\construdata_gui_premium.py", "w", encoding="utf-8") as f:
    f.write(code)

print("Patch concluído.")
