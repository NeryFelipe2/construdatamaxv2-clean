"""Teste v2: listar TODOS os ObjectName dos AeccDb e tentar propriedades."""
import sys
print("=== TESTE COM v2 ===")

import win32com.client
acad = win32com.client.Dispatch("AutoCAD.Application")
acad.Visible = False
print(f"App: {acad.Name}")

dwg = r"c:\Users\felip\Downloads\NOVA NS Versao 5\_tmp_dwg\ESTUDO___CT_SAO_MANOEL_E_CT_JO.dwg"
doc = acad.Documents.Open(dwg, False, True)
print(f"DWG: {doc.Name} | {doc.ModelSpace.Count} entidades")

msp = doc.ModelSpace
aecc_types = {}

# Primeiro: contar todos os tipos AeccDb
for i in range(msp.Count):
    try:
        obj = msp.Item(i)
        tname = str(obj.ObjectName)
        if "Aecc" in tname:
            aecc_types[tname] = aecc_types.get(tname, 0) + 1
    except:
        pass

print(f"\n=== TIPOS AeccDb ENCONTRADOS ===")
for tname, count in sorted(aecc_types.items()):
    print(f"  {tname}: {count}")

# Segundo: para cada tipo relevante, tentar ler propriedades
props_to_try = ["Name", "RimElevation", "SumpElevation", "InnerDiameterOrWidth",
                 "Diameter", "Length", "Slope", "Position", "Location", "Origin",
                 "StartStructure", "EndStructure", "StartPoint", "EndPoint",
                 "Description", "PartDescription", "PartSizeName"]

print(f"\n=== TESTANDO PROPRIEDADES (primeiro objeto de cada tipo) ===")
seen_types = set()
for i in range(msp.Count):
    try:
        obj = msp.Item(i)
        tname = str(obj.ObjectName)
        if "Aecc" in tname and tname not in seen_types:
            seen_types.add(tname)
            print(f"\n--- {tname} ---")
            for prop in props_to_try:
                try:
                    val = getattr(obj, prop)
                    if val is not None:
                        if hasattr(val, "Name"):
                            print(f"  OK  {prop} = {val.Name}")
                        elif isinstance(val, tuple):
                            print(f"  OK  {prop} = {val[:3]}")
                        else:
                            vstr = str(val)[:60]
                            print(f"  OK  {prop} = {vstr}")
                except AttributeError:
                    pass  # Propriedade nao existe neste tipo
                except Exception as e:
                    estr = str(e)[:50]
                    print(f"  ERR {prop}: {estr}")
    except:
        pass

doc.Close(False)
try: acad.Application.Quit()
except: pass
print("\n=== TESTE CONCLUIDO ===")
