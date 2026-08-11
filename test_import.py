import sys
from pathlib import Path

BASE_DIR = Path(r"C:\Users\felip\Downloads\NOVA NS Versao 5")
sys.path.insert(0, str(BASE_DIR))

import gerar_ns
print(gerar_ns.__file__)

import construdata_pipeline
print(construdata_pipeline.__file__)
