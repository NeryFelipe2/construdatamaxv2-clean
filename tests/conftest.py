import os
import sys

# Permite importar os módulos da raiz do projeto (planejamento, models, ler_dxf_gdal)
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if RAIZ not in sys.path:
    sys.path.insert(0, RAIZ)
