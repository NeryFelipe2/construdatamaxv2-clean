#!/usr/bin/env python3
"""Debug tubos"""

import win32com.client
import time

DWG = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA2.dwg"

acad = win32com.client.Dispatch("AutoCAD.Application")
acad.Visible = False
doc = acad.Documents.Open(DWG, False, True)
time.sleep(3)

msp = doc.ModelSpace

print("Verificando tubos...")

gravity = []
pressure = []

for i in range(msp.Count):
    try:
        obj = msp.Item(i)
        tn = str(obj.ObjectName)
        
        if tn == "AeccDbPipe":
            slope = getattr(obj, "Slope", "N/A")
            gravity.append({"idx": i, "name": obj.Name, "slope": slope})
        elif tn == "AeccDbPressurePipe":
            pressure.append({"idx": i, "name": obj.Name})
    except:
        pass

print(f"\nAeccDbPipe (gravity): {len(gravity)}")
print(f"AeccDbPressurePipe: {len(pressure)}")

# Mostrar primeiros 10 gravity
print("\nPrimeiros 10 AeccDbPipe:")
for t in gravity[:10]:
    print(f"  {t['name']} - Slope: {t['slope']}")

# Verificar se tem slope = 0
zero_slope = [t for t in gravity if t['slope'] == 0]
print(f"\nTubos com Slope = 0: {len(zero_slope)}")

doc.Close(False)
acad.Application.Quit()
