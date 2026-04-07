#!/usr/bin/env python3
"""Verificar origem dos tubos"""

import win32com.client
import time
from collections import Counter

DWG = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA2.dwg"

acad = win32com.client.Dispatch("AutoCAD.Application")
acad.Visible = False
doc = acad.Documents.Open(DWG, False, True)
time.sleep(3)

msp = doc.ModelSpace

print("Analisando tubos AeccDbPipe...")

tubos_info = []

for i in range(msp.Count):
    try:
        obj = msp.Item(i)
        tn = str(obj.ObjectName)
        
        if tn == "AeccDbPipe":
            dn = getattr(obj, "InnerDiameterOrWidth", 0) * 1000
            slope = getattr(obj, "Slope", -1)
            
            # Verificar estrutura de inicio
            start_struct = None
            end_struct = None
            start_type = "?"
            end_type = "?"
            
            try:
                if obj.StartStructure:
                    start_struct = obj.StartStructure.Name
                    start_type = str(obj.StartStructure.ObjectName)
            except: pass
            
            try:
                if obj.EndStructure:
                    end_struct = obj.EndStructure.Name
                    end_type = str(obj.EndStructure.ObjectName)
            except: pass
            
            tubos_info.append({
                "name": obj.Name,
                "dn": int(dn),
                "slope": slope,
                "start": start_struct,
                "end": end_struct,
                "start_type": start_type,
                "end_type": end_type,
            })
    except:
        pass

print(f"Total AeccDbPipe: {len(tubos_info)}")

# Agrupar por DN
dns = Counter(t["dn"] for t in tubos_info)
print(f"\nPor DN: {dict(sorted(dns.items()))}")

# Verificar estruturas conectadas
start_types = Counter(t["start_type"] for t in tubos_info)
end_types = Counter(t["end_type"] for t in tubos_info)
print(f"\nStart types: {dict(start_types)}")
print(f"End types: {dict(end_types)}")

# Tubos sem estrutura
sem_struct = [t for t in tubos_info if not t["start"] or not t["end"]]
print(f"\nTubos SEM estrutura: {len(sem_struct)}")
if sem_struct:
    print("  DNs: " + str(Counter(t["dn"] for t in sem_struct)))

# Tubos COM estrutura
com_struct = [t for t in tubos_info if t["start"] and t["end"]]
print(f"\nTubos COM estrutura: {len(com_struct)}")
if com_struct:
    dns_com = Counter(t["dn"] for t in com_struct)
    print(f"  DNs: {dict(sorted(dns_com.items()))}")

doc.Close(False)
acad.Application.Quit()
