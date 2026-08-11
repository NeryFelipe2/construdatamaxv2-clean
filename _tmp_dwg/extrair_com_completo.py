#!/usr/bin/env python3
"""
Extrator COM completo: lê TODOS os PVs e Trechos de DWG Civil 3D via COM.
Salva JSON compatível com o pipeline ConstruData.
"""
import json, sys, os, time
from pathlib import Path

DWG_PATH = r"c:\Users\felip\Downloads\NOVA NS Versao 5\_tmp_dwg\ESTUDO___CT_SAO_MANOEL_E_CT_JO.dwg"
OUTPUT_JSON = r"c:\Users\felip\Downloads\NOVA NS Versao 5\_tmp_dwg\REDE_EXTRAIDA_BIM.json"

if len(sys.argv) > 1:
    DWG_PATH = sys.argv[1]

print("=" * 60)
print("EXTRATOR COM — Civil 3D Pipe Network")
print("=" * 60)

import win32com.client
acad = win32com.client.Dispatch("AutoCAD.Application")
acad.Visible = False
print(f"App: {acad.Name}")

acad.Documents.Open(DWG_PATH, False, True)
time.sleep(3)  # Esperar DWG carregar
doc = acad.ActiveDocument
msp = doc.ModelSpace
total = msp.Count
print(f"DWG: {doc.Name} | {total} entidades")

# ── Extrair Structures (PVs) ─────────────────────────────────
pvs = {}
for i in range(total):
    try:
        obj = msp.Item(i)
        if str(obj.ObjectName) != "AeccDbStructure":
            continue

        nome = obj.Name
        ct = obj.RimElevation
        cf = obj.SumpElevation
        prof = round(ct - cf, 4) if ct and cf else 0

        # Coordenadas via Position (retorna COM object com X,Y,Z)
        x = y = 0
        try:
            pos = obj.Position
            x = pos.X if hasattr(pos, 'X') else 0
            y = pos.Y if hasattr(pos, 'Y') else 0
        except:
            try:
                loc = obj.Location
                x = loc.X if hasattr(loc, 'X') else 0
                y = loc.Y if hasattr(loc, 'Y') else 0
            except:
                pass

        # Fallback: Easting/Northing
        if x == 0 and y == 0:
            try: x = obj.Easting
            except: pass
            try: y = obj.Northing
            except: pass

        # PartSizeName para tipo/diâmetro
        part = ""
        try: part = obj.PartSizeName
        except: pass

        pvs[nome] = {
            "x": round(x, 3),
            "y": round(y, 3),
            "ct": round(ct, 4),
            "cf": round(cf, 4),
            "prof": round(prof, 3),
            "tipo": part,
        }
    except Exception as e:
        pass

print(f"\nPVs extraidos: {len(pvs)}")
n_ct = sum(1 for p in pvs.values() if p["ct"] != 0)
print(f"  Com CT: {n_ct}/{len(pvs)}")

# Mostrar primeiros 10
for i, (nome, pv) in enumerate(sorted(pvs.items())[:10]):
    print(f"  {nome:15s} CT={pv['ct']:8.3f} CF={pv['cf']:8.3f} Prof={pv['prof']:.2f} ({pv['x']:.0f},{pv['y']:.0f})")
if len(pvs) > 10:
    print(f"  ... e mais {len(pvs)-10} PVs")

# ── Extrair Pipes (Trechos) ──────────────────────────────────
trechos = []
for i in range(total):
    try:
        obj = msp.Item(i)
        if str(obj.ObjectName) != "AeccDbPipe":
            continue

        nome = obj.Name
        dn = obj.InnerDiameterOrWidth * 1000  # m -> mm
        slope = obj.Slope

        # PVs de início e fim (retorna COM object, pegar .Name)
        pv_ini = ""
        pv_fim = ""
        try: pv_ini = obj.StartStructure.Name if obj.StartStructure else ""
        except:
            try: pv_ini = str(obj.StartStructure)
            except: pass
        try: pv_fim = obj.EndStructure.Name if obj.EndStructure else ""
        except:
            try: pv_fim = str(obj.EndStructure)
            except: pass

        # Extensão
        ext = 0
        try: ext = obj.Length2DCenterToCenter
        except:
            try: ext = obj.Length2D
            except:
                try: ext = obj.Length
                except: pass

        # Material/tipo
        part = ""
        try: part = obj.PartSizeName
        except: pass

        trechos.append({
            "nome": nome,
            "pv_ini": pv_ini,
            "pv_fim": pv_fim,
            "dn_mm": int(round(dn)),
            "ext_m": round(ext, 2),
            "decl_mm": round(slope * 1000, 3) if slope else 0,
            "material": part or "PVC",
        })
    except Exception as e:
        pass

print(f"\nTrechos extraidos: {len(trechos)}")
for i, t in enumerate(trechos[:5]):
    print(f"  {t['pv_ini']:15s} -> {t['pv_fim']:15s} DN{t['dn_mm']} L={t['ext_m']:.1f}m I={t['decl_mm']:.2f}mm/m")
if len(trechos) > 5:
    print(f"  ... e mais {len(trechos)-5} trechos")

# ── Extrair PressurePipes (Agua) ─────────────────────────────
agua_pipes = []
for i in range(total):
    try:
        obj = msp.Item(i)
        if str(obj.ObjectName) != "AeccDbPressurePipe":
            continue
        nome = obj.Name
        desc = ""
        try: desc = obj.Description
        except: pass
        agua_pipes.append({"nome": nome, "desc": desc})
    except:
        pass

print(f"\nTubos de agua: {len(agua_pipes)}")

# ── Extrair Networks ─────────────────────────────────────────
networks = []
for i in range(total):
    try:
        obj = msp.Item(i)
        oname = str(obj.ObjectName)
        if oname in ("AeccDbNetwork", "AeccDbPressurePipeNetwork"):
            nome = obj.Name
            desc = ""
            try: desc = obj.Description
            except: pass
            networks.append({"nome": nome, "tipo": oname, "desc": desc})
    except:
        pass

print(f"Networks: {len(networks)}")
for n in networks:
    print(f"  {n['nome']:20s} ({n['tipo']})")

# ── Salvar JSON ──────────────────────────────────────────────
resultado = {
    "arquivo": Path(DWG_PATH).name,
    "pvs": pvs,
    "trechos": trechos,
    "agua_pipes": agua_pipes,
    "networks": networks,
    "estatisticas": {
        "total_pvs": len(pvs),
        "total_trechos": len(trechos),
        "total_agua": len(agua_pipes),
        "pvs_com_ct": n_ct,
        "total_networks": len(networks),
    }
}

with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(resultado, f, indent=2, ensure_ascii=False)
print(f"\nJSON salvo: {OUTPUT_JSON}")

# ── Fechar ───────────────────────────────────────────────────
doc.Close(False)
try: acad.Application.Quit()
except:
    try: acad.Quit()
    except: pass

print("\n" + "=" * 60)
print(f"EXTRACAO COMPLETA: {len(pvs)} PVs + {len(trechos)} trechos")
print("=" * 60)
