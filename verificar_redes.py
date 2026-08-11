#!/usr/bin/env python3
"""Verificar redes no DWG"""

import win32com.client
import time

DWG = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA2.dwg"

print("=" * 60)
print("VERIFICANDO REDES NO DWG")
print("=" * 60)

acad = win32com.client.Dispatch("AutoCAD.Application")
acad.Visible = False

doc = acad.Documents.Open(DWG, False, True)
time.sleep(3)

msp = doc.ModelSpace

# Contar tubos por tipo
gravity_pipes = 0
pressure_pipes = 0

for i in range(msp.Count):
    try:
        obj = msp.Item(i)
        tn = str(obj.ObjectName)
        if tn == "AeccDbPipe":
            gravity_pipes += 1
        elif tn == "AeccDbPressurePipe":
            pressure_pipes += 1
    except:
        pass

print(f"\nAeccDbPipe (gravidade): {gravity_pipes}")
print(f"AeccDbPressurePipe (pressão): {pressure_pipes}")
print(f"Total: {gravity_pipes + pressure_pipes}")

# Verificar Pipe Networks
print("\n" + "=" * 60)
print("PIPE NETWORKS")
print("=" * 60)

try:
    from Autodesk.Civil.ApplicationServices import CivilApplication
    doc_civil = CivilApplication.ActiveDocument
    
    networks = list(doc_civil.GetPipeNetworks())
    print(f"Pipe Networks encontradas: {len(networks)}")
    
    for i, net in enumerate(networks):
        print(f"\n{i+1}. {net.Name}")
        print(f"   Structures: {net.Structures.Count}")
        print(f"   Pipes: {net.Pipes.Count}")
        print(f"   Type: {net.NetworkType}")
        
        # Listar tubos por DN
        from collections import Counter
        dns = []
        for pipe in net.Pipes:
            dn = int(pipe.InnerDiameterOrWidth * 1000)
            dns.append(dn)
        if dns:
            print(f"   DNs: {dict(sorted(Counter(dns).items()))}")
except Exception as e:
    print(f"Erro: {e}")

doc.Close(False)
acad.Application.Quit()

print("\n" + "=" * 60)
