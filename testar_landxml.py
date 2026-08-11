#!/usr/bin/env python3
"""Testar LandXML"""

import sys
sys.path.insert(0, '.')

from ler_dwg_aec import _extrair_via_landxml

DWG = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA2.dwg"

print("=" * 60)
print("TESTANDO LANDXML")
print("=" * 60)

pvs, trechos, ruas, meta = _extrair_via_landxml(DWG)

if pvs:
    print(f"\n✅ LandXML funcionou!")
    print(f"  PVs: {len(pvs)}")
    print(f"  Trechos: {len(trechos)}")
    
    from collections import Counter
    dns = Counter(t.get("dn_mm") for t in trechos if t.get("dn_mm"))
    print(f"  DNs: {dict(sorted(dns.items()))}")
else:
    print("\n❌ LandXML falhou ou retornou vazio")
