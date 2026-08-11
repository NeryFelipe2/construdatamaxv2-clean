"""Teste minimo: abre DWG no AutoCAD COM e verifica se consegue ler AeccDb objects."""
import sys, time
print("=== TESTE COM MINIMAL ===")
print("Tentando abrir AutoCAD via COM...")

try:
    import win32com.client
    acad = win32com.client.Dispatch("AutoCAD.Application")
    acad.Visible = False
    print(f"AutoCAD aberto: {acad.Name}")
except Exception as e:
    print(f"ERRO ao abrir AutoCAD: {e}")
    sys.exit(1)

dwg = r"c:\Users\felip\Downloads\NOVA NS Versao 5\_tmp_dwg\ESTUDO___CT_SAO_MANOEL_E_CT_JO.dwg"
print(f"Abrindo DWG: {dwg}")

try:
    doc = acad.Documents.Open(dwg, False, True)
    print(f"DWG aberto: {doc.Name}")
except Exception as e:
    print(f"ERRO ao abrir DWG: {e}")
    try: acad.Quit()
    except: pass
    sys.exit(1)

msp = doc.ModelSpace
total = msp.Count
print(f"ModelSpace: {total} entidades")

structs = 0
pipes = 0
other_aecc = 0

for i in range(min(total, 500)):  # Limitar a 500 para nao demorar
    try:
        obj = msp.Item(i)
        tname = str(obj.ObjectName)
    except:
        continue

    if "Aecc" not in tname:
        continue

    if "Struct" in tname and "Label" not in tname and "Style" not in tname:
        structs += 1
        print(f"\n--- STRUCTURE #{structs}: {tname} ---")
        # Tentar CADA propriedade individualmente
        for prop in ["Name", "RimElevation", "SumpElevation", "SurfaceElevation",
                      "InvertElevation", "InnerDiameterOrWidth", "Position"]:
            try:
                val = getattr(obj, prop)
                print(f"  {prop} = {val}")
            except Exception as e:
                print(f"  {prop} = ERRO: {e}")

    elif "Pipe" in tname and "Network" not in tname and "Label" not in tname and "Style" not in tname:
        pipes += 1
        if pipes <= 3:  # Mostrar apenas 3 pipes
            print(f"\n--- PIPE #{pipes}: {tname} ---")
            for prop in ["Name", "InnerDiameterOrWidth", "Length", "Slope",
                          "StartStructure", "EndStructure"]:
                try:
                    val = getattr(obj, prop)
                    if hasattr(val, "Name"):
                        print(f"  {prop}.Name = {val.Name}")
                    else:
                        print(f"  {prop} = {val}")
                except Exception as e:
                    print(f"  {prop} = ERRO: {e}")

    elif "Aecc" in tname:
        other_aecc += 1

print(f"\n=== RESUMO ===")
print(f"Structures: {structs}")
print(f"Pipes: {pipes}")
print(f"Outros AeccDb: {other_aecc}")
print(f"Total iterado: {min(total, 500)}/{total}")

doc.Close(False)
acad.Quit()
print("AutoCAD fechado. TESTE CONCLUIDO.")
