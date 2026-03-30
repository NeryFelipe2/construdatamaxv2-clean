#!/usr/bin/env python3
"""Debug extração COM"""

import sys
sys.path.insert(0, '.')

from ler_dwg_aec import _extrair_via_com
import json

DWG = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA2.dwg"

print("=" * 60)
print("DEBUG EXTRAÇÃO COM")
print("=" * 60)

pvs, trechos = _extrair_via_com(DWG)

print(f"\nPVs extraídos: {len(pvs)}")
print(f"Trechos extraídos: {len(trechos)}")

# Verificar trechos sem PV
sem_pv = [t for t in trechos if not t.get("pv_ini") or not t.get("pv_fim")]
print(f"Trechos SEM PV: {len(sem_pv)}")

trechos_ok = [t for t in trechos if t.get("pv_ini") and t.get("pv_fim")]
print(f"Trechos COM PV: {len(trechos_ok)}")

# DN dos trechos
from collections import Counter
dns = Counter(t.get("dn_mm") for t in trechos_ok)
print(f"DNs: {dict(sorted(dns.items()))}")

# Salvar
with open("_debug_trechos.json", "w", encoding="utf-8") as f:
    json.dump(trechos, f, indent=2, ensure_ascii=False, default=str)
print("\nTrechos salvos em _debug_trechos.json")

# Mostrar PVs
print(f"\nPVs (primeiros 20):")
for i, (nome, pv) in enumerate(list(pvs.items())[:20]):
    ct = pv.get("ct", 0)
    cf = pv.get("cf", 0)
    print(f"  {nome}: CT={ct:.3f} CF={cf:.3f}")
