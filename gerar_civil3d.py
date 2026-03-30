#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gerar_civil3d.py — Gerador de Pipe Network Civil 3D + Cadastro NTS0292
ConstruData SABESP v6 · SE LIGA NA REDE · Contrato 11481051

Gera: LandXML, Cadastro DXF, Dynamo .py, AutoCAD .scr, JSON dados

Uso:
  python gerar_civil3d.py <arquivo.dxf> [pasta_saida]
"""
import sys, os, math, json, re
from pathlib import Path
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring
import xml.dom.minidom as minidom
from collections import defaultdict

import ezdxf
from ezdxf.enums import TextEntityAlignment

from ler_dxf_gdal import ler_dxf_gdal

CONTRATO    = "11481051"
CRS_EPSG    = "EPSG:31983"
N_MANNING   = 0.013
PV_DIAM     = 1.200
EMPRESA     = "ConstruData"
ENGENHEIRO  = "Felipe Nery"

FOLHA_W, FOLHA_H = 297, 210
MARGEM = 7
AREA_W = FOLHA_W - 2 * MARGEM
AREA_H = FOLHA_H - 2 * MARGEM
CARIMBO_H = 32
DESENHO_Y = MARGEM + CARIMBO_H + 2
DESENHO_H = AREA_H - CARIMBO_H - 2


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def gerar_landxml(pvs, trechos, nucleo, out_path):
    log("Gerando LandXML...")
    root = Element("LandXML", {
        "xmlns": "http://www.landxml.org/schema/LandXML-1.2",
        "version": "1.2",
        "date": datetime.now().strftime("%Y-%m-%d"),
    })
    SubElement(root, "Units").append(Element("Metric", linearUnit="meter"))
    SubElement(root, "CoordinateSystem", datum="SIRGAS2000", desc=CRS_EPSG)

    networks = SubElement(root, "PipeNetworks")
    net = SubElement(networks, "PipeNetwork", name=f"REDE_{nucleo.upper().replace(' ','_')}", pipeNetType="sanitary")

    structs = SubElement(net, "Structs")
    for nome, pv in pvs.items():
        ct, cf = pv.get("ct", 0) or 0, pv.get("cf", 0) or 0
        s = SubElement(structs, "Struct", name=nome, elevSump=f"{cf:.4f}", elevRim=f"{ct:.4f}")
        center = SubElement(s, "Center")
        center.text = f"{pv['y']:.6f} {pv['x']:.6f}"
        is_pv = "PV" in nome.upper()
        SubElement(s, "CircStruct", diameter=f"{PV_DIAM if is_pv else 0.6:.3f}")
        for t in trechos:
            if t["pv_ini"] == nome:
                _elev = t.get('cf_ini') or cf or 0
                SubElement(s, "Invert", elev=f"{_elev:.4f}", flowDir="Out")
            elif t["pv_fim"] == nome:
                _elev = t.get('cf_fim') or cf or 0
                SubElement(s, "Invert", elev=f"{_elev:.4f}", flowDir="In")

    pipes = SubElement(net, "Pipes")
    for i, t in enumerate(trechos):
        dn_m = (t.get("dn_mm") or 200) / 1000
        slope = 0
        if t.get("cf_ini") and t.get("cf_fim") and t["ext_m"] > 0:
            slope = (t["cf_ini"] - t["cf_fim"]) / t["ext_m"]
        p = SubElement(pipes, "Pipe", name=f"T-{i+1:03d}", refStart=t["pv_ini"],
                       refEnd=t["pv_fim"], length=f"{t['ext_m']:.3f}", slope=f"{slope:.6f}")
        SubElement(p, "CircPipe", diameter=f"{dn_m:.3f}", material=t.get("material", "PVC"))

    rough = tostring(root, encoding="unicode")
    xml_str = minidom.parseString(rough).toprettyxml(indent="  ")
    lines = xml_str.split("\n")
    if lines[0].startswith("<?xml"):
        lines[0] = '<?xml version="1.0" encoding="UTF-8"?>'

    with open(str(out_path), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    log(f"  LandXML: {len(pvs)} structures + {len(trechos)} pipes -> {out_path}")


def _setup_layers(doc):
    for name, color in {"Margem": 7, "Campos": 7, "Texto_legenda": 7, "Rede_executada": 1,
                         "Texto": 7, "Amarracao": 251, "Pecas": 1, "Simbolos": 7}.items():
        if name not in doc.layers:
            doc.layers.add(name, color=color)


def _draw_carimbo(msp, info, x0, y0, w, h):
    msp.add_lwpolyline([(x0,y0),(x0+w,y0),(x0+w,y0+h),(x0,y0+h),(x0,y0)], dxfattribs={"layer":"Campos"})
    for dy in [8, 16, 24]:
        msp.add_line((x0,y0+dy),(x0+w,y0+dy), dxfattribs={"layer":"Campos"})
    th = 1.3
    def txt(text, px, py):
        msp.add_text(text, height=th, dxfattribs={"layer":"Texto_legenda","style":"Arial"}
                     ).set_placement((x0+px, y0+py), align=TextEntityAlignment.BOTTOM_LEFT)
    txt(f"Contrato: {info.get('contrato','')}", 1, 26)
    txt(f"Data: {info.get('data','')}", 80, 26)
    txt(f"Local: {info.get('rua','')}", 1, 18)
    txt(f"Eng: {info.get('engenheiro','')}", 1, 10)
    txt(f"Ext: {info.get('ext_exec','')}", 1, 2)
    txt(f"Folha {info.get('n_folha','001')}", 200, 26)
    txt("CADASTRO ESGOTO - SABESP", 200, 18)


def _draw_rede_planta(msp, pvs_rua, trechos_rua, area):
    ax, ay, aw, ah = area
    xs = [p["x"] for p in pvs_rua.values() if p.get("x")]
    ys = [p["y"] for p in pvs_rua.values() if p.get("y")]
    if not xs: return
    min_e, max_e, min_n, max_n = min(xs), max(xs), min(ys), max(ys)
    dx, dy = max(max_e-min_e, 1), max(max_n-min_n, 1)
    scale = min(aw*0.7/dx, ah*0.7/dy)
    ox = ax + (aw - dx*scale)/2 - min_e*scale
    oy = ay + (ah - dy*scale)/2 - min_n*scale
    def tp(e, n): return (float(e)*scale+ox, float(n)*scale+oy)

    for t in trechos_rua:
        p0, p1 = pvs_rua.get(t["pv_ini"],{}), pvs_rua.get(t["pv_fim"],{})
        if p0.get("x") and p1.get("x"):
            x1,y1 = tp(p0["x"],p0["y"]); x2,y2 = tp(p1["x"],p1["y"])
            msp.add_line((x1,y1),(x2,y2), dxfattribs={"layer":"Rede_executada"})
            mx,my = (x1+x2)/2, (y1+y2)/2
            ang = math.degrees(math.atan2(y2-y1, x2-x1))
            msp.add_text(f"{t['ext_m']:.2f}m DN{t.get('dn_mm','?')}", height=1.2,
                         dxfattribs={"layer":"Texto","style":"Arial","rotation":ang}
                         ).set_placement((mx,my+1), align=TextEntityAlignment.BOTTOM_CENTER)

    for nome, pv in pvs_rua.items():
        if not pv.get("x"): continue
        px,py = tp(pv["x"],pv["y"])
        r = 1.5
        msp.add_circle((px,py), r, dxfattribs={"layer":"Pecas"})
        msp.add_line((px-r*.7,py-r*.7),(px+r*.7,py+r*.7), dxfattribs={"layer":"Pecas"})
        msp.add_line((px-r*.7,py+r*.7),(px+r*.7,py-r*.7), dxfattribs={"layer":"Pecas"})
        off = 3
        for i, txt in enumerate([nome, f"CT:{pv.get('ct','-')}", f"CF:{pv.get('cf','-')}"]):
            msp.add_text(txt, height=1.0, dxfattribs={"layer":"Texto","style":"Arial"}
                         ).set_placement((px+off, py+off+3-i*1.3), align=TextEntityAlignment.BOTTOM_LEFT)


def gerar_cadastro_dxf(pvs, trechos, nucleo, out_dir):
    log("Gerando Cadastro DXF (NTS0292)...")
    out = Path(out_dir) / "06_CADASTRO_DXF"
    out.mkdir(parents=True, exist_ok=True)

    por_rua = defaultdict(list)
    for t in trechos:
        por_rua[t.get("rua","Sem Rua") or "Sem Rua"].append(t)

    n = 0
    for idx, (rua, tr_rua) in enumerate(sorted(por_rua.items())):
        pvs_rua = {}
        for t in tr_rua:
            for nm in [t["pv_ini"], t["pv_fim"]]:
                if nm in pvs: pvs_rua[nm] = pvs[nm]
        ext = sum(t["ext_m"] for t in tr_rua)

        doc = ezdxf.new("R2010")
        doc.styles.add("Arial", font="arial.ttf")
        _setup_layers(doc)
        msp = doc.modelspace()
        msp.add_lwpolyline([(MARGEM,MARGEM),(FOLHA_W-MARGEM,MARGEM),
                             (FOLHA_W-MARGEM,FOLHA_H-MARGEM),(MARGEM,FOLHA_H-MARGEM),
                             (MARGEM,MARGEM)], dxfattribs={"layer":"Margem"})

        _draw_carimbo(msp, {"contrato": CONTRATO, "engenheiro": ENGENHEIRO,
                            "rua": rua, "data": datetime.now().strftime("%d/%m/%Y"),
                            "ext_exec": f"{ext:.2f}m", "n_folha": f"{idx+1:03d}"},
                      MARGEM, MARGEM, AREA_W, CARIMBO_H)

        _draw_rede_planta(msp, pvs_rua, tr_rua, (MARGEM, DESENHO_Y, AREA_W, DESENHO_H))
        import unicodedata
        rua_nfkd = unicodedata.normalize('NFKD', rua[:30])
        rua_safe = ''.join(c for c in rua_nfkd if c.isascii() and c.isprintable())
        rua_safe = re.sub(r'[<>:"/\\|?*]', '_', rua_safe).strip().rstrip('.')
        if not rua_safe:
            rua_safe = f"RUA_{idx+1}"
        nome_arq = f"CAD_{idx+1:03d}_{rua_safe}.dxf"
        doc.saveas(str(out / nome_arq))
        n += 1
    log(f"  {n} folhas DXF em {out}")


def gerar_dynamo_script(pvs, trechos, nucleo, out_path):
    log("Gerando Dynamo Script...")
    pvs_j = json.dumps({n: {"x":p["x"],"y":p["y"],"ct":p.get("ct",0),"cf":p.get("cf",0)} for n,p in pvs.items()})
    tr_j = json.dumps([{"pv_ini":t["pv_ini"],"pv_fim":t["pv_fim"],"dn_mm":t.get("dn_mm",200),
                         "cf_ini":t.get("cf_ini",0),"cf_fim":t.get("cf_fim",0)} for t in trechos])
    net_name = f"REDE_{nucleo.upper().replace(' ','_')}"

    script = f'''# Dynamo Script — ConstruData SABESP v6 — {nucleo}
# Gerado em {datetime.now().strftime("%d/%m/%Y %H:%M")}
# Cola no Dynamo (Python Script node) e executa

import clr, json
clr.AddReference("AcMgd"); clr.AddReference("AcDbMgd"); clr.AddReference("AeccDbMgd")
from Autodesk.AutoCAD.ApplicationServices import Application
from Autodesk.AutoCAD.DatabaseServices import *
from Autodesk.AutoCAD.Geometry import Point3d
from Autodesk.Civil.DatabaseServices import *

PVS = json.loads("""{pvs_j}""")
TRECHOS = json.loads("""{tr_j}""")

doc = Application.DocumentManager.MdiActiveDocument
db = doc.Database
with doc.LockDocument():
    with Transaction(db.TransactionManager.StartTransaction()) as tr:
        net_id = PipeNetwork.Create(db, "{net_name}")
        net = tr.GetObject(net_id, OpenMode.ForWrite)
        sids = {{}}
        for n, p in PVS.items():
            sid = net.AddStructure(Point3d(p["x"],p["y"],p["ct"]), 0, True)
            s = tr.GetObject(sid, OpenMode.ForWrite)
            s.Name = n; s.SumpElevation = p["cf"]; s.RimElevation = p["ct"]
            sids[n] = sid
        for t in TRECHOS:
            if t["pv_ini"] in sids and t["pv_fim"] in sids:
                net.AddLineBetweenStructs(sids[t["pv_ini"]], sids[t["pv_fim"]])
        tr.Commit()
OUT = f"{{len(PVS)}} structures + {{len(TRECHOS)}} pipes"
'''
    with open(str(out_path), "w", encoding="utf-8") as f:
        f.write(script)
    log(f"  Dynamo: {out_path}")


def gerar_autocad_scr(pvs, trechos, nucleo, out_path):
    log("Gerando AutoCAD .scr...")
    lines = [f"; ConstruData v6 — {nucleo}", f"; {len(pvs)} PVs + {len(trechos)} tubos", "",
             "-LAYER N REDE_ESGOTO C 1 REDE_ESGOTO S REDE_ESGOTO ", ""]
    for t in trechos:
        p0, p1 = pvs.get(t["pv_ini"],{}), pvs.get(t["pv_fim"],{})
        if p0.get("x") and p1.get("x"):
            lines.append(f"LINE {p0['x']:.6f},{p0['y']:.6f} {p1['x']:.6f},{p1['y']:.6f} ")
    lines += ["", "-LAYER N PVS C 5 PVS S PVS ", ""]
    for n, p in pvs.items():
        if p.get("x"):
            lines.append(f"CIRCLE {p['x']:.6f},{p['y']:.6f} 0.6 ")
    lines += ["", "-LAYER N TEXTO C 7 TEXTO S TEXTO ", ""]
    for n, p in pvs.items():
        if p.get("x"):
            lines.append(f"TEXT {p['x']+1.5:.6f},{p['y']+1.5:.6f} 0.8 0 {n} ")
    lines += ["", "ZOOM E ", "; FIM"]
    with open(str(out_path), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    log(f"  SCR: {out_path}")


def gerar_json_dados(pvs, trechos, nucleo, out_path):
    data = {
        "meta": {"nucleo": nucleo, "contrato": CONTRATO, "crs": CRS_EPSG,
                 "n_pvs": len(pvs), "n_trechos": len(trechos),
                 "gerado_em": datetime.now().isoformat()},
        "pvs": {n: {"x":p["x"],"y":p["y"],"ct":p.get("ct"),"cf":p.get("cf"),"prof":p.get("prof")}
                for n,p in pvs.items()},
        "trechos": [{"id":f"T-{i+1:03d}","pv_ini":t["pv_ini"],"pv_fim":t["pv_fim"],
                      "dn_mm":t.get("dn_mm"),"ext_m":t["ext_m"],"material":t.get("material","PVC"),
                      "rua":t.get("rua",""),"decl_mm":t.get("decl_mm"),
                      "cf_ini":t.get("cf_ini"),"cf_fim":t.get("cf_fim")} for i,t in enumerate(trechos)],
    }
    with open(str(out_path), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    log(f"  JSON: {out_path}")


# Aliases para compatibilidade com pipeline
gerar_dynamo = gerar_dynamo_script
gerar_scr = gerar_autocad_scr


def processar(dxf_path, nucleo, out_base):
    log(f"{'='*60}")
    log(f"ConstruData v6 — Civil 3D + Cadastro: {nucleo}")
    log(f"{'='*60}")

    pvs, trechos, ruas, meta = ler_dxf_gdal(dxf_path)
    if not trechos:
        log("Sem trechos!"); return

    log(f"Rede: {meta['n_pvs']} PVs, {meta['n_trechos']} trechos")

    out = Path(out_base) / nucleo.upper().replace(" ", "_")
    out.mkdir(parents=True, exist_ok=True)

    slug = nucleo.lower().replace(" ", "_")
    gerar_landxml(pvs, trechos, nucleo, out / f"REDE_{slug.upper()}.xml")
    gerar_cadastro_dxf(pvs, trechos, nucleo, str(out))
    gerar_dynamo_script(pvs, trechos, nucleo, out / f"criar_pipe_network_{slug}.py")
    gerar_autocad_scr(pvs, trechos, nucleo, out / f"desenhar_rede_{slug}.scr")
    gerar_json_dados(pvs, trechos, nucleo, out / f"dados_{slug}.json")

    log(f"\nCONCLUIDO! Saida: {out}")
    log(f"Civil 3D: File > Import > Import LandXML > REDE_*.xml")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python gerar_civil3d.py <arquivo.dxf> [pasta_saida]")
        sys.exit(1)
    dxf = sys.argv[1]
    nucleo = Path(dxf).stem.replace("_ESGOTO","").replace("_AGUA","").replace("_"," ").title()
    out = sys.argv[2] if len(sys.argv) >= 3 else str(Path(dxf).parent / "SAIDA_CIVIL3D")
    processar(dxf, nucleo, out)
