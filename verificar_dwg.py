#!/usr/bin/env python3
"""Verificar tubos no DWG original"""

import win32com.client
import time

DWG = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA2.dwg"

print("=" * 60)
print("VERIFICANDO DWG ORIGINAL")
print("=" * 60)

acad = win32com.client.Dispatch("AutoCAD.Application")
acad.Visible = False
print(f"Civil 3D: {acad.Name}")

print(f"\nAbrindo DWG...")
doc = acad.Documents.Open(DWG, False, True)
time.sleep(3)

msp = doc.ModelSpace
print(f"Total entidades: {msp.Count}")

# Contar por tipo
counts = {}
for i in range(msp.Count):
    try:
        obj = msp.Item(i)
        tn = str(obj.ObjectName)
        counts[tn] = counts.get(tn, 0) + 1
    except:
        pass

print("\nEntidades encontradas:")
for tn, c in sorted(counts.items(), key=lambda x: -x[1]):
    print(f"  {tn}: {c}")

# Detalhes dos tubos
print("\n" + "=" * 60)
print("DETALHES DOS TUBOS (AeccDbPipe)")
print("=" * 60)

tubos_info = []
for i in range(msp.Count):
    try:
        obj = msp.Item(i)
        if str(obj.ObjectName) == "AeccDbPipe":
            info = {
                "name": getattr(obj, "Name", "?"),
                "dn": getattr(obj, "InnerDiameterOrWidth", 0) * 1000,
                "slope": getattr(obj, "Slope", 0),
                "start": "",
                "end": "",
            }
            try:
                if obj.StartStructure:
                    info["start"] = obj.StartStructure.Name
            except: pass
            try:
                if obj.EndStructure:
                    info["end"] = obj.EndStructure.Name
            except: pass
            tubos_info.append(info)
    except:
        pass

print(f"Total tubos: {len(tubos_info)}")

# Agrupar por DN
from collections import Counter
dns = Counter(int(t["dn"]) for t in tubos_info)
print(f"\nPor DN: {dict(sorted(dns.items()))}")

# Mostrar primeiros 10
print("\nPrimeiros 10 tubos:")
for i, t in enumerate(tubos_info[:10]):
    print(f"  {i+1}. {t['name']}: DN{t['dn']:.0f} | {t['start']} -> {t['end']}")

# Verificar desconectados
desconectados = [t for t in tubos_info if not t["start"] or not t["end"]]
if desconectados:
    print(f"\n⚠️  Tubos SEM estrutura: {len(desconectados)}")
    for t in desconectados[:5]:
        print(f"  - {t['name']}: DN{t['dn']:.0f}")

doc.Close(False)
acad.Quit()

print("\n" + "=" * 60)
