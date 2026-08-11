#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gerar_civil3d.py — Gerador de Pipe Network Civil 3D + Cadastro NTS0292
ConstruData - HydroNetwork · SE LIGA NA REDE · Contrato 11481051

A partir dos dados do ler_dxf_gdal (PVs + trechos), gera:
  1. LandXML     → importa no Civil 3D como Pipe Network completo
  2. Cadastro    → DXF + PDF folha A4 padrão NTS0292 SABESP
  3. Dynamo .py  → script Python para criar Pipe Network via API Civil 3D
  4. AutoCAD .scr→ script de desenho para quem não tem Civil 3D

Uso:
  python gerar_civil3d.py <arquivo.dxf> [pasta_saida]
"""
import sys, os, math, json, re
from pathlib import Path
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring
import xml.dom.minidom as minidom
from collections import defaultdict

# ── Dependências ──
import ezdxf
from ezdxf.enums import TextEntityAlignment

from ler_dxf_gdal import ler_dxf_gdal

# ═══════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════
CONTRATO    = "11481051"
NUCLEO      = "Pantanal Baixo"
CRS_EPSG    = "EPSG:31983"
N_MANNING   = 0.013
PV_DIAM     = 1.200   # diâmetro do PV padrão (m)
EMPRESA     = "FCN Construções e Saneamento"
ENGENHEIRO  = "Felipe Nery"


def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


# ═══════════════════════════════════════════════════════════════
# 1. LANDXML — Pipe Network para Civil 3D
# ═══════════════════════════════════════════════════════════════

def gerar_landxml(pvs, trechos, nucleo, out_path):
    """Gera LandXML 1.2 com PipeNetwork completo.
    
    Civil 3D: File → Import → Import LandXML
    Cria Pipe Network com structures (PVs) e pipes (tubos).
    """
    log("Gerando LandXML para Civil 3D...")

    root = Element("LandXML", {
        "xmlns": "http://www.landxml.org/schema/LandXML-1.2",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xsi:schemaLocation": "http://www.landxml.org/schema/LandXML-1.2 http://www.landxml.org/schema/LandXML-1.2/LandXML-1.2.xsd",
        "version": "1.2",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "time": datetime.now().strftime("%H:%M:%S"),
    })

    # Project
    proj = SubElement(root, "Project", name=f"SLNR_{nucleo.upper().replace(' ','_')}")
    SubElement(proj, "Feature", name="ConstruData", code="v6")

    # Units
    units = SubElement(root, "Units")
    SubElement(units, "Metric", {
        "linearUnit": "meter",
        "areaUnit": "squareMeter",
        "volumeUnit": "cubicMeter",
        "angularUnit": "decimal degrees",
        "directionUnit": "decimal degrees",
    })

    # CoordinateSystem
    SubElement(root, "CoordinateSystem", {
        "datum": "SIRGAS2000",
        "horizontalDatum": "SIRGAS2000",
        "verticalDatum": "Imbituba",
        "projectedCoordinateSystemName": "SIRGAS_2000_UTM_Zone_23S",
        "desc": CRS_EPSG,
    })

    # PipeNetworks
    networks = SubElement(root, "PipeNetworks")
    net = SubElement(networks, "PipeNetwork", {
        "name": f"ESGOTO_{nucleo.upper().replace(' ','_')}",
        "pipeNetType": "sanitary",
    })

    # ── Structures (PVs/PIs) ──
    structs = SubElement(net, "Structs")
    for nome, pv in pvs.items():
        ct = pv.get("ct", 0) or 0
        cf = pv.get("cf", 0) or 0
        prof = pv.get("prof", 0) or 0

        # elevSump = fundo do PV (CF mais baixa de todas as conexões)
        # elevRim = tampa do PV (CT)
        struct = SubElement(structs, "Struct", {
            "name": nome,
            "elevSump": f"{cf:.4f}",
            "elevRim": f"{ct:.4f}",
        })

        # Centro em E, N (UTM)
        center = SubElement(struct, "Center")
        center.text = f"{pv['y']:.6f} {pv['x']:.6f}"
        # LandXML usa N E (northing easting) — Civil 3D interpreta assim

        # Estrutura circular (PV DN1200)
        is_pv = "PV" in nome.upper()
        diam = PV_DIAM if is_pv else 0.600  # PI menor
        SubElement(struct, "CircStruct", {
            "diameter": f"{diam:.3f}",
            "desc": "Poco de Visita" if is_pv else "Poco de Inspecao",
        })

        # Inversões (cotas de entrada/saída de cada tubo)
        # Civil 3D usa InvertElev para definir as conexões dos tubos
        inverts = []
        for t in trechos:
            if t["pv_ini"] == nome:
                inverts.append(("Out", t.get("cf_ini") or cf))
            elif t["pv_fim"] == nome:
                inverts.append(("In", t.get("cf_fim") or cf))
        
        for flow_dir, elev in inverts:
            SubElement(struct, "Invert", {
                "elev": f"{elev:.4f}",
                "flowDir": flow_dir,
            })

        # Feature com dados extras (Custom Properties no Civil 3D)
        feat = SubElement(struct, "Feature", name="ConstruData")
        SubElement(feat, "Property", label="Profundidade", value=f"{prof:.3f}")
        SubElement(feat, "Property", label="Tipo", value="PV" if is_pv else "PI")
        SubElement(feat, "Property", label="Nucleo", value=nucleo)

    # ── Pipes (Tubos) ──
    pipes = SubElement(net, "Pipes")
    for i, t in enumerate(trechos):
        dn_m = (t.get("dn_mm") or 63) / 1000  # mm → m, default 63mm para água
        
        # Slope: positivo = descendo de refStart para refEnd
        slope = t.get("decl_mm", 0) or 0  # m/m
        if t.get("cf_ini") and t.get("cf_fim") and t["ext_m"] > 0:
            slope = (t["cf_ini"] - t["cf_fim"]) / t["ext_m"]

        pipe = SubElement(pipes, "Pipe", {
            "name": f"T-{i+1:03d}",
            "refStart": t["pv_ini"],
            "refEnd": t["pv_fim"],
            "length": f"{t['ext_m']:.3f}",
            "slope": f"{slope:.6f}",
            "desc": f"DN{t.get('dn_mm') or '?'} {t.get('material','') or 'PE 80'}",
        })

        # Tubo circular
        SubElement(pipe, "CircPipe", {
            "diameter": f"{dn_m:.3f}",
            "material": t.get("material") or "PE 80",
            "thickness": "0.006",  # parede PVC típica
        })

        # Flow
        SubElement(pipe, "PipeFlow", {
            "flowDir": "BothFlow",
            "desc": f"Manning n={N_MANNING}",
        })

        # Feature com dados extras
        feat = SubElement(pipe, "Feature", name="ConstruData")
        SubElement(feat, "Property", label="Rua", value=t.get("rua", ""))
        SubElement(feat, "Property", label="Declividade_permil",
                   value=f"{(t.get('decl_pct') or (slope*100)):.4f}")

    # ── Serializar ──
    rough = tostring(root, encoding="unicode")
    dom = minidom.parseString(rough)
    xml_str = dom.toprettyxml(indent="  ", encoding=None)
    lines = xml_str.split("\n")
    if lines and lines[0].startswith("<?xml"):
        lines[0] = '<?xml version="1.0" encoding="UTF-8"?>'
    xml_str = "\n".join(lines)

    with open(str(out_path), "w", encoding="utf-8") as f:
        f.write(xml_str)

    log(f"  LandXML: {out_path}")
    log(f"  {len(pvs)} structures + {len(trechos)} pipes")
    log(f"  → Civil 3D: File > Import > Import LandXML")
    return str(out_path)


# ═══════════════════════════════════════════════════════════════
# 2. CADASTRO DXF — Folha A4 padrão NTS0292 SABESP
# ═══════════════════════════════════════════════════════════════

# Constantes folha A4 paisagem
FOLHA_W, FOLHA_H = 297, 210  # mm
MARGEM = 7
AREA_W = FOLHA_W - 2 * MARGEM
AREA_H = FOLHA_H - 2 * MARGEM
CARIMBO_H = 32
DESENHO_Y = MARGEM + CARIMBO_H + 2
DESENHO_H = AREA_H - CARIMBO_H - 2


def _setup_layers(doc):
    """Cria layers conforme NTS0292."""
    layers = {
        "Margem":          7,
        "Campos":          7,
        "Texto_legenda":   7,
        "Logo_Sabesp":     7,
        "Quadra":         250,
        "Rede_executada":   1,   # vermelho
        "Rede_existente":   7,
        "Texto":            7,
        "Amarracao":      251,
        "Pecas":            1,   # vermelho
        "Simbolos":         7,
        "Perfil_CT":        3,   # verde
        "Perfil_CF":        1,   # vermelho
        "Perfil_PV":        7,
        "Perfil_Tabela":    8,
    }
    for name, color in layers.items():
        if name not in doc.layers:
            doc.layers.add(name, color=color)


def _draw_carimbo(msp, info, x0, y0, w, h):
    """Desenha carimbo NTS0292 simplificado."""
    # Contorno
    msp.add_lwpolyline(
        [(x0,y0),(x0+w,y0),(x0+w,y0+h),(x0,y0+h),(x0,y0)],
        dxfattribs={"layer": "Campos"})

    # 4 faixas horizontais
    for dy in [8, 16, 24]:
        msp.add_line((x0,y0+dy),(x0+w,y0+dy), dxfattribs={"layer":"Campos"})

    # Logo
    logo_x = x0 + w - 32
    msp.add_line((logo_x,y0),(logo_x,y0+h), dxfattribs={"layer":"Campos"})

    th = 1.3
    def txt(text, px, py, **kw):
        msp.add_text(text, height=kw.get("h",th),
                     dxfattribs={"layer":"Texto_legenda","style":"Arial"}
                     ).set_placement((x0+px, y0+py),
                                     align=TextEntityAlignment.BOTTOM_LEFT)

    # Faixa 4 (topo)
    txt("Extensao Executada(m)", 1, 30)
    txt("No Folha", 73, 30)
    txt("Municipio", 116, 30)
    txt("CADASTRO ESGOTO", 203, 30)

    # Faixa 3
    txt("Datum Sirgas2000 UTM 23S", 39, 22)
    txt("Contratada", 161, 22)
    txt(f"Contrato: {info.get('contrato','')}", 221, 22)

    # Faixa 2
    txt("Observacoes", 1, 14)
    txt(f"Data: {info.get('data','')}", 86, 14)
    txt(f"Local: {info.get('rua','')}", 161, 14)

    # Faixa 1
    txt(f"Eng: {info.get('engenheiro','')}", 1, 4)

    # Variaveis
    txt(info.get("ext_exec",""), 1, 26, h=1.8)
    txt(info.get("n_folha","001"), 73, 26, h=1.8)
    txt("SANTOS", 116, 26, h=1.8)
    txt("Sabesp", logo_x+5, 10, h=5)


def _draw_rede_planta(msp, pvs_trecho, trechos_trecho, area_bounds):
    """Desenha rede na planta (PVs + tubos) com escala automática."""
    ax, ay, aw, ah = area_bounds

    # Coletar todos os pontos
    xs = [pvs_trecho[nome]["x"] for nome in pvs_trecho if pvs_trecho[nome].get("x")]
    ys = [pvs_trecho[nome]["y"] for nome in pvs_trecho if pvs_trecho[nome].get("y")]
    if not xs:
        return

    min_e, max_e = min(xs), max(xs)
    min_n, max_n = min(ys), max(ys)
    dx = max_e - min_e or 1
    dy = max_n - min_n or 1

    margin_pct = 0.15
    scale_x = aw * (1 - 2*margin_pct) / dx
    scale_y = ah * (1 - 2*margin_pct) / dy
    scale = min(scale_x, scale_y)

    ox = ax + (aw - dx*scale)/2 - min_e*scale
    oy = ay + (ah - dy*scale)/2 - min_n*scale

    def to_paper(e, n):
        return (float(e)*scale + ox, float(n)*scale + oy)

    # Tubos (vermelho)
    for t in trechos_trecho:
        p0 = pvs_trecho.get(t["pv_ini"], {})
        p1 = pvs_trecho.get(t["pv_fim"], {})
        if p0.get("x") and p1.get("x"):
            x1, y1 = to_paper(p0["x"], p0["y"])
            x2, y2 = to_paper(p1["x"], p1["y"])
            msp.add_line((x1,y1),(x2,y2), dxfattribs={"layer":"Rede_executada"})

            # Comprimento + DN no meio
            mx, my = (x1+x2)/2, (y1+y2)/2
            ang = math.degrees(math.atan2(y2-y1, x2-x1))
            comp = t["ext_m"]
            msp.add_text(f"{comp:.2f}", height=1.5,
                         dxfattribs={"layer":"Texto","style":"Arial","rotation":ang}
                         ).set_placement((mx, my+1.5), align=TextEntityAlignment.BOTTOM_CENTER)
            msp.add_text(f"O/{t['dn_mm']}/PVC", height=1.2,
                         dxfattribs={"layer":"Texto","style":"Arial","rotation":ang}
                         ).set_placement((mx, my-1), align=TextEntityAlignment.TOP_CENTER)

            # Inclinação
            decl = t.get("decl_mm", 0)
            if decl:
                msp.add_text(f"i:{decl:.4f}", height=1.0,
                             dxfattribs={"layer":"Texto","style":"Arial","rotation":ang}
                             ).set_placement((mx, my-2.5), align=TextEntityAlignment.TOP_CENTER)

    # PVs (símbolo + anotação)
    r = 1.5
    for nome, pv in pvs_trecho.items():
        if not pv.get("x"):
            continue
        px, py = to_paper(pv["x"], pv["y"])
        ct, cf = pv.get("ct",0), pv.get("cf",0)

        msp.add_circle((px,py), r, dxfattribs={"layer":"Pecas"})
        msp.add_line((px-r*0.7,py-r*0.7),(px+r*0.7,py+r*0.7), dxfattribs={"layer":"Pecas"})
        msp.add_line((px-r*0.7,py+r*0.7),(px+r*0.7,py-r*0.7), dxfattribs={"layer":"Pecas"})

        # Anotação (N, E, CT, CF)
        off = 4
        msp.add_text(nome, height=1.4,
                     dxfattribs={"layer":"Texto","style":"Arial"}
                     ).set_placement((px+off, py+off+5), align=TextEntityAlignment.BOTTOM_LEFT)
        msp.add_text(f"N:{pv['y']:.3f}", height=1.0,
                     dxfattribs={"layer":"Texto","style":"Arial"}
                     ).set_placement((px+off, py+off+3.5), align=TextEntityAlignment.BOTTOM_LEFT)
        msp.add_text(f"E:{pv['x']:.3f}", height=1.0,
                     dxfattribs={"layer":"Texto","style":"Arial"}
                     ).set_placement((px+off, py+off+2), align=TextEntityAlignment.BOTTOM_LEFT)
        if ct:
            msp.add_text(f"CT:{ct:.3f}", height=1.0,
                         dxfattribs={"layer":"Texto","style":"Arial"}
                         ).set_placement((px+off, py+off+0.5), align=TextEntityAlignment.BOTTOM_LEFT)
        if cf:
            msp.add_text(f"CF:{cf:.3f}", height=1.0,
                         dxfattribs={"layer":"Texto","style":"Arial"}
                         ).set_placement((px+off, py+off-1), align=TextEntityAlignment.BOTTOM_LEFT)

        # Linha de chamada
        msp.add_line((px+r*0.7, py+r*0.7), (px+off-1, py+off-1),
                     dxfattribs={"layer":"Amarracao"})


def gerar_cadastro_dxf(pvs, trechos, nucleo, out_dir):
    """Gera folhas de cadastro DXF (A4 paisagem) por rua — padrão NTS0292."""
    log("Gerando Cadastro DXF (NTS0292)...")

    out = Path(out_dir) / "06_CADASTRO_DXF"
    out.mkdir(parents=True, exist_ok=True)

    # Agrupar por rua
    por_rua = defaultdict(list)
    for t in trechos:
        rua = t.get("rua", "Sem Rua") or "Sem Rua"
        por_rua[rua].append(t)

    n_folhas = 0
    for rua_idx, (rua, trechos_rua) in enumerate(sorted(por_rua.items())):
        # PVs desta rua
        pvs_rua = {}
        for t in trechos_rua:
            for nome in [t["pv_ini"], t["pv_fim"]]:
                if nome in pvs and nome not in pvs_rua:
                    pvs_rua[nome] = pvs[nome]

        # Extensão
        ext = sum(t["ext_m"] for t in trechos_rua)

        doc = ezdxf.new("R2010")
        doc.styles.add("Arial", font="arial.ttf")
        _setup_layers(doc)
        msp = doc.modelspace()

        # Margens
        msp.add_lwpolyline(
            [(0,0),(FOLHA_W,0),(FOLHA_W,FOLHA_H),(0,FOLHA_H),(0,0)],
            dxfattribs={"layer":"Margem"})
        msp.add_lwpolyline(
            [(MARGEM,MARGEM),(FOLHA_W-MARGEM,MARGEM),
             (FOLHA_W-MARGEM,FOLHA_H-MARGEM),
             (MARGEM,FOLHA_H-MARGEM),(MARGEM,MARGEM)],
            dxfattribs={"layer":"Margem"})

        # Título
        msp.add_text("FOLHA DE CADASTRO", height=5,
                     dxfattribs={"layer":"Texto_legenda","style":"Arial"}
                     ).set_placement((FOLHA_W/2, FOLHA_H-MARGEM-5),
                                     align=TextEntityAlignment.TOP_CENTER)

        # Carimbo
        info = {
            "contrato": CONTRATO,
            "engenheiro": ENGENHEIRO,
            "rua": rua,
            "data": datetime.now().strftime("%d/%m/%Y"),
            "ext_exec": f"{ext:.2f}m",
            "n_folha": f"{rua_idx+1:03d}",
        }
        _draw_carimbo(msp, info, MARGEM, MARGEM, AREA_W, CARIMBO_H)

        # Norte
        nx, ny = MARGEM+15, FOLHA_H-MARGEM-20
        msp.add_circle((nx,ny), 5, dxfattribs={"layer":"Simbolos"})
        msp.add_line((nx,ny-5),(nx,ny+8), dxfattribs={"layer":"Simbolos"})
        msp.add_text("N", height=3.5,
                     dxfattribs={"layer":"Simbolos","style":"Arial"}
                     ).set_placement((nx, ny+9), align=TextEntityAlignment.BOTTOM_CENTER)

        # Rede na planta
        area = (MARGEM, DESENHO_Y, AREA_W, DESENHO_H)
        _draw_rede_planta(msp, pvs_rua, trechos_rua, area)

        # Salvar
        nome_arq = re.sub(r'[<>:"/\\|?*]', '_', f"CAD_{rua_idx+1:03d}_{rua[:30]}.dxf")
        doc.saveas(str(out / nome_arq))
        n_folhas += 1

    log(f"  {n_folhas} folhas DXF em {out}")
    return str(out)


# ═══════════════════════════════════════════════════════════════
# 3. DYNAMO SCRIPT — Cria Pipe Network via API Civil 3D
# ═══════════════════════════════════════════════════════════════

def gerar_dynamo_script(pvs, trechos, nucleo, out_path):
    """Gera script Python para Dynamo/Civil 3D que cria o Pipe Network."""
    log("Gerando Dynamo Python Script...")

    # Serializar dados para JSON embutido no script
    pvs_json = json.dumps({
        nome: {"x": pv["x"], "y": pv["y"],
               "ct": pv.get("ct",0), "cf": pv.get("cf",0),
               "prof": pv.get("prof",0)}
        for nome, pv in pvs.items()
    }, indent=2)

    trechos_json = json.dumps([
        {"pv_ini": t["pv_ini"], "pv_fim": t["pv_fim"],
         "dn_mm": t["dn_mm"], "ext_m": t["ext_m"],
         "material": t.get("material","PVC"),
         "rua": t.get("rua",""),
         "cf_ini": t.get("cf_ini",0), "cf_fim": t.get("cf_fim",0)}
        for t in trechos
    ], indent=2)

    script = f'''# -*- coding: utf-8 -*-
"""
Dynamo Script — Criar Pipe Network no Civil 3D
ConstruData - HydroNetwork · {nucleo}
Gerado em {datetime.now().strftime("%d/%m/%Y %H:%M")}

INSTRUCOES:
  1. Abrir Civil 3D com o desenho da rede
  2. Abrir Dynamo (Manage > Dynamo)
  3. Inserir nó "Python Script" 
  4. Colar este código inteiro
  5. Executar

ALTERNATIVA (sem Dynamo):
  1. Usar File > Import > Import LandXML
  2. Selecionar o arquivo .xml gerado
"""
import clr
import json
import sys

# Civil 3D API
clr.AddReference("AcMgd")
clr.AddReference("AcDbMgd")
clr.AddReference("AcCoreMgd")
clr.AddReference("AeccDbMgd")  # Civil 3D

from Autodesk.AutoCAD.ApplicationServices import Application
from Autodesk.AutoCAD.DatabaseServices import Transaction, OpenMode
from Autodesk.AutoCAD.Geometry import Point3d
from Autodesk.Civil.DatabaseServices import PipeNetwork, Network, Structure, Pipe

# ═══════════════════════════════════════════════════════════
# DADOS DA REDE (gerados pelo ConstruData)
# ═══════════════════════════════════════════════════════════

PVS = {pvs_json}

TRECHOS = {trechos_json}

# ═══════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ═══════════════════════════════════════════════════════════

NETWORK_NAME = "ESGOTO_{nucleo.upper().replace(' ','_')}"
PARTS_LIST   = "SABESP Esgoto"  # Nome do Parts List no Civil 3D
STRUCT_SIZE   = "Concrete - Cylindrical - 1200mm Diameter"
PIPE_SIZE     = "PVC Pipe - {{0}}mm"  # {{0}} = DN

# ═══════════════════════════════════════════════════════════
# CRIAR PIPE NETWORK
# ═══════════════════════════════════════════════════════════

doc = Application.DocumentManager.MdiActiveDocument
db = doc.Database
ed = doc.Editor

with doc.LockDocument():
    with db.TransactionManager.StartTransaction() as tr:
        try:
            # Obter Parts List
            parts_list_id = None
            for oid in CivilDocument.GetCivilDocument(db).GetPartListIds():
                pl = tr.GetObject(oid, OpenMode.ForRead)
                if pl.Name == PARTS_LIST:
                    parts_list_id = oid
                    break
            
            if parts_list_id is None:
                ed.WriteMessage("\\nERRO: Parts List '{{0}}' nao encontrado!".format(PARTS_LIST))
                ed.WriteMessage("\\nCrie primeiro: Pipe Networks > Parts List > Create Parts List")
            else:
                # Criar Pipe Network
                net_id = PipeNetwork.Create(db, NETWORK_NAME, parts_list_id)
                net = tr.GetObject(net_id, OpenMode.ForWrite)
                
                ed.WriteMessage("\\nCriando Pipe Network: " + NETWORK_NAME)
                
                # Criar Structures (PVs)
                struct_ids = {{}}
                for nome, pv in PVS.items():
                    pt = Point3d(pv["x"], pv["y"], pv["ct"])
                    struct_id = net.AddStructure(
                        STRUCT_SIZE, 
                        pt,
                        0.0,  # rotation
                        True  # apply rules
                    )
                    struct = tr.GetObject(struct_id, OpenMode.ForWrite)
                    struct.Name = nome
                    struct.SumpElevation = pv["cf"]
                    struct.RimElevation = pv["ct"]
                    struct_ids[nome] = struct_id
                    
                ed.WriteMessage("\\n  {{0}} structures criadas".format(len(struct_ids)))
                
                # Criar Pipes (Tubos)
                n_pipes = 0
                for i, t in enumerate(TRECHOS):
                    pv_ini = t["pv_ini"]
                    pv_fim = t["pv_fim"]
                    
                    if pv_ini not in struct_ids or pv_fim not in struct_ids:
                        ed.WriteMessage("\\n  AVISO: PV nao encontrado: {{0}} ou {{1}}".format(pv_ini, pv_fim))
                        continue
                    
                    pipe_size = PIPE_SIZE.format(t["dn_mm"])
                    pipe_id = net.AddLineBetweenStructs(
                        struct_ids[pv_ini],
                        struct_ids[pv_fim],
                        pipe_size,
                        True  # apply rules
                    )
                    
                    pipe = tr.GetObject(pipe_id, OpenMode.ForWrite)
                    pipe.Name = "T-{{0:03d}}".format(i+1)
                    pipe.Description = t.get("rua", "")
                    
                    # Ajustar cotas de inversão
                    pipe.StartPoint = Point3d(
                        PVS[pv_ini]["x"], PVS[pv_ini]["y"], t["cf_ini"])
                    pipe.EndPoint = Point3d(
                        PVS[pv_fim]["x"], PVS[pv_fim]["y"], t["cf_fim"])
                    
                    n_pipes += 1
                
                ed.WriteMessage("\\n  {{0}} pipes criados".format(n_pipes))
                ed.WriteMessage("\\n\\nPipe Network '{{0}}' criado com sucesso!".format(NETWORK_NAME))
                
            tr.Commit()
            
        except Exception as e:
            ed.WriteMessage("\\nERRO: " + str(e))
            tr.Abort()

# Resultado para Dynamo
OUT = "Pipe Network criado: {{0}} structures + {{1}} pipes".format(
    len(PVS), len(TRECHOS))
'''

    with open(str(out_path), "w", encoding="utf-8") as f:
        f.write(script)

    log(f"  Dynamo: {out_path}")
    return str(out_path)


# ═══════════════════════════════════════════════════════════════
# 4. AutoCAD .SCR — Script simples de desenho
# ═══════════════════════════════════════════════════════════════

def gerar_autocad_scr(pvs, trechos, nucleo, out_path):
    """Gera .scr (AutoCAD Script) que desenha a rede como polylines + circles."""
    log("Gerando AutoCAD Script (.scr)...")

    lines = []
    lines.append(f"; ConstruData - HydroNetwork — {nucleo}")
    lines.append(f"; {len(pvs)} PVs + {len(trechos)} tubos")
    lines.append(f"; Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    lines.append("")

    # Layer da rede
    lines.append("-LAYER N REDE_ESGOTO C 1 REDE_ESGOTO S REDE_ESGOTO ")
    lines.append("")

    # Tubos como LINES
    for t in trechos:
        p0 = pvs.get(t["pv_ini"], {})
        p1 = pvs.get(t["pv_fim"], {})
        if p0.get("x") and p1.get("x"):
            lines.append(f"LINE {p0['x']:.6f},{p0['y']:.6f} {p1['x']:.6f},{p1['y']:.6f} ")

    # Layer PVs
    lines.append("")
    lines.append("-LAYER N PVS C 5 PVS S PVS ")
    lines.append("")

    # PVs como CIRCLES
    for nome, pv in pvs.items():
        if pv.get("x"):
            r = 0.6 if "PV" in nome.upper() else 0.3
            lines.append(f"CIRCLE {pv['x']:.6f},{pv['y']:.6f} {r} ")

    # Layer textos
    lines.append("")
    lines.append("-LAYER N TEXTO_PV C 7 TEXTO_PV S TEXTO_PV ")
    lines.append("")

    # Textos dos PVs
    for nome, pv in pvs.items():
        if pv.get("x"):
            ct, cf = pv.get("ct",0), pv.get("cf",0)
            tx, ty = pv["x"] + 1.5, pv["y"] + 1.5
            lines.append(f"TEXT {tx:.6f},{ty:.6f} 0.8 0 {nome} ")
            if ct:
                lines.append(f"TEXT {tx:.6f},{ty-1.2:.6f} 0.6 0 CT={ct:.3f} ")
            if cf:
                lines.append(f"TEXT {tx:.6f},{ty-2.2:.6f} 0.6 0 CF={cf:.3f} ")

    lines.append("")
    lines.append("ZOOM E ")
    lines.append("; FIM DO SCRIPT")

    with open(str(out_path), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    log(f"  AutoCAD .scr: {out_path}")
    return str(out_path)


# ═══════════════════════════════════════════════════════════════
# 5. JSON DADOS — Para qualquer integração futura
# ═══════════════════════════════════════════════════════════════

def gerar_json_dados(pvs, trechos, nucleo, out_path):
    """Exporta dados completos em JSON estruturado."""
    log("Gerando JSON de dados...")

    data = {
        "meta": {
            "projeto": "SE LIGA NA REDE",
            "contrato": CONTRATO,
            "nucleo": nucleo,
            "crs": CRS_EPSG,
            "n_pvs": len(pvs),
            "n_trechos": len(trechos),
            "ext_total_m": round(sum(t["ext_m"] for t in trechos), 1),
            "gerado_em": datetime.now().isoformat(),
            "motor": "GDAL/OGR+Cluster",
        },
        "pvs": {nome: {
            "x": pv["x"], "y": pv["y"],
            "ct": pv.get("ct",0), "cf": pv.get("cf",0),
            "prof": pv.get("prof",0),
        } for nome, pv in pvs.items()},
        "trechos": [{
            "id": f"T-{i+1:03d}",
            "pv_ini": t["pv_ini"], "pv_fim": t["pv_fim"],
            "dn_mm": t["dn_mm"], "ext_m": t["ext_m"],
            "material": t.get("material","PVC"),
            "rua": t.get("rua",""),
            "decl_mm": t.get("decl_mm",0),
            "ct_ini": t.get("ct_ini",0), "ct_fim": t.get("ct_fim",0),
            "cf_ini": t.get("cf_ini",0), "cf_fim": t.get("cf_fim",0),
            "prof_ini": t.get("prof_ini",0), "prof_fim": t.get("prof_fim",0),
        } for i, t in enumerate(trechos)],
    }

    with open(str(out_path), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    log(f"  JSON: {out_path}")
    return str(out_path)


# ═══════════════════════════════════════════════════════════════
# PIPELINE PRINCIPAL
# ═══════════════════════════════════════════════════════════════

def processar(dxf_path, nucleo, out_base):
    """Pipeline completo: DXF → LandXML + Cadastro + Dynamo + SCR."""
    log(f"{'='*60}")
    log(f"ConstruData - HydroNetwork — Civil 3D + Cadastro")
    log(f"Núcleo: {nucleo}")
    log(f"{'='*60}")

    # 1. Leitura
    pvs, trechos, ruas, meta = ler_dxf_gdal(dxf_path)
    if not trechos:
        log("ERRO: Sem trechos!")
        return

    log(f"Rede: {meta['n_pvs']} PVs, {meta['n_trechos']} trechos, {sum(t['ext_m'] for t in trechos):.1f}m")

    # 2. Pastas
    out = Path(out_base) / nucleo.upper().replace(" ", "_")
    out.mkdir(parents=True, exist_ok=True)

    # 3. Gerar tudo
    gerar_landxml(pvs, trechos, nucleo,
                  out / f"ESGOTO_{nucleo.upper().replace(' ','_')}.xml")

    gerar_cadastro_dxf(pvs, trechos, nucleo, str(out))

    gerar_dynamo_script(pvs, trechos, nucleo,
                        out / f"criar_pipe_network_{nucleo.lower().replace(' ','_')}.py")

    gerar_autocad_scr(pvs, trechos, nucleo,
                      out / f"desenhar_rede_{nucleo.lower().replace(' ','_')}.scr")

    gerar_json_dados(pvs, trechos, nucleo,
                     out / f"dados_{nucleo.lower().replace(' ','_')}.json")

    log(f"\n{'='*60}")
    log(f"CONCLUÍDO! Saídas em {out}")
    log(f"")
    log(f"COMO USAR NO CIVIL 3D:")
    log(f"  1. File > Import > Import LandXML")
    log(f"     → Selecionar ESGOTO_*.xml")
    log(f"     → Cria Pipe Network completo automaticamente")
    log(f"")
    log(f"  2. OU: Manage > Dynamo")
    log(f"     → Python Script > colar criar_pipe_network_*.py")
    log(f"     → Cria via API com nomes/cotas exatos")
    log(f"")
    log(f"  3. OU: AutoCAD puro (sem Civil 3D):")
    log(f"     → Tools > Run Script > desenhar_rede_*.scr")
    log(f"     → Desenha linhas + circulos + textos")
    log(f"{'='*60}")


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python gerar_civil3d.py <arquivo.dxf> [pasta_saida]")
        sys.exit(1)

    dxf = sys.argv[1]
    nucleo = Path(dxf).stem.replace("_ESGOTO", "").replace("_", " ").title()
    out = sys.argv[2] if len(sys.argv) >= 3 else str(Path(dxf).parent / "SAIDA_CIVIL3D")
    processar(dxf, nucleo, out)
