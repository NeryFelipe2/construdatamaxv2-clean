import sys
import subprocess

try:
    import ftfy
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "ftfy"])
    import ftfy

file_path = "workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# Fix the mojibake
text = ftfy.fix_text(text)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Mojibake fixed in", file_path)
