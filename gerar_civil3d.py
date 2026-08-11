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


def gerar_cadastro_dxf(pvs, trechos, nucleo, out_dir, cartografia=None):
    """
    Gera Cadastro DXF + PDF em folha A4 SABESP NTS0292 completa.
    Usa cadastro.folha_a4 que implementa o layout correto:
    - Margem externa + interna
    - Carimbo completo com todas as faixas/divisões
    - Checkbox AGUA/ESGOTO
    - Logo Sabesp
    - Formato ABNT-ISO A4 = 297 x 210
    - Símbolo de Norte
    - Simbologia PV/PI com linhas de chamada inteligentes
    - Detalhes ampliados para trechos curtos
    """
    log("Gerando Cadastro DXF+PDF (NTS0292 - folha A4 completa)...")
    out = Path(out_dir) / "06_CADASTRO_DXF"
    out.mkdir(parents=True, exist_ok=True)

    try:
        from cadastro.folha_a4 import generate_batch, generate_dxf, generate_pdf
    except ImportError:
        log("  [ERRO] Modulo cadastro.folha_a4 não encontrado!")
        log("  Tentando importação direta...")
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                "folha_a4",
                str(Path(__file__).parent / "cadastro" / "folha_a4.py")
            )
            folha_a4_mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(folha_a4_mod)
            generate_batch = folha_a4_mod.generate_batch
            generate_dxf = folha_a4_mod.generate_dxf
            generate_pdf = folha_a4_mod.generate_pdf
        except Exception as e2:
            log(f"  [ERRO] Falha ao importar folha_a4: {e2}")
            return

    # Agrupar trechos por rua
    por_rua = defaultdict(list)
    for t in trechos:
        por_rua[t.get("rua", "Sem Rua") or "Sem Rua"].append(t)

    # Converter PVs para formato esperado pela folha_a4
    def _conv_pv(nome, pv_data):
        return {
            "nome": nome,
            "este": pv_data.get("x", 0),
            "norte": pv_data.get("y", 0),
            "cota_tampa": pv_data.get("ct", 0) or 0,
            "cota_fundo": pv_data.get("cf", 0) or 0,
            "prof": pv_data.get("prof", 0) or 0,
            "tipo": "PV" if "PV" in nome.upper() else "PI",
        }

    # Gerar folhas agrupadas por rua (trechos contíguos na mesma folha)
    folhas = []
    rua_labels = []
    for rua, tr_rua in sorted(por_rua.items()):
        # Coletar PVs da rua em sequência
        pvs_lista = []
        nomes_vistos = set()
        for t in tr_rua:
            for nm in [t["pv_ini"], t["pv_fim"]]:
                if nm not in nomes_vistos and nm in pvs:
                    nomes_vistos.add(nm)
                    pvs_lista.append(_conv_pv(nm, pvs[nm]))

        if len(pvs_lista) >= 2:
            # Se muitos PVs, dividir em folhas de até 8 PVs
            MAX_PVS_POR_FOLHA = 8
            for i in range(0, len(pvs_lista), MAX_PVS_POR_FOLHA - 1):
                chunk = pvs_lista[i:i + MAX_PVS_POR_FOLHA]
                if len(chunk) >= 2:
                    folhas.append(chunk)
                    rua_labels.append(rua)

    if not folhas:
        log("  Sem folhas para gerar!")
        return

    # Info do carimbo padrão SABESP
    info_base = {
        "tipo": "ESGOTO",
        "contrato": CONTRATO,
        "contratada": EMPRESA,
        "municipio": "Santos - 3548500",
        "local_tipo": f"SE LIGA NA REDE - {nucleo}",
        "met_construtivo": "VCA",
        "data_obra": datetime.now().strftime("%m/%Y"),
        "data_desenho": datetime.now().strftime("%d/%m/%Y"),
        "desenhista": ENGENHEIRO,
    }

    # Redes info
    dn_mm = ""
    material = ""
    for t in trechos:
        if t.get("dn_mm"):
            dn_mm = str(t["dn_mm"])
            break
    for t in trechos:
        if t.get("material"):
            material = t["material"]
            break

    redes_info = {
        "diametro": dn_mm or "200",
        "material": material or "PVC",
        "met_construtivo": "VCA",
    }

    base_name = f"CADASTRO A4 - {nucleo.upper().replace(' ', '_')}"

    # Formatar cartografia se estiver no formato do extract (dict de layers)
    cartografia_formatada = None
    if cartografia and "layers" in cartografia:
        cartografia_formatada = []
        for layer_name, geom_list in cartografia["layers"].items():
            for geom in geom_list:
                if "pontos" in geom:
                    cartografia_formatada.append(geom)

    # Gerar usando generate_batch (produz DXF + PDF corretos)
    try:
        paths = generate_batch(
            folhas, str(out), base_name,
            info=info_base, redes_info=redes_info,
            cartografia=cartografia_formatada
        )
        log(f"  {len(paths)} folhas A4 (DXF+PDF) geradas em {out}")
    except Exception as e:
        log(f"  [ERRO] Falha na geração batch: {e}")
        # Fallback: gerar individualmente
        n = 0
        for i, folha_pvs in enumerate(folhas, 1):
            info = dict(info_base)
            info["n_folha"] = f"{i:03d}"
            if i <= len(rua_labels):
                info["observacoes"] = rua_labels[i - 1][:40]
            try:
                import unicodedata
                rua_safe = ""
                if i <= len(rua_labels):
                    rua_nfkd = unicodedata.normalize('NFKD', rua_labels[i-1][:30])
                    rua_safe = ''.join(c for c in rua_nfkd if c.isascii() and c.isprintable())
                    rua_safe = re.sub(r'[<>:"/\\|?*]', '_', rua_safe).strip().rstrip('.')
                if not rua_safe:
                    rua_safe = f"FOLHA_{i:03d}"

                dxf_path = str(out / f"{base_name} - {i:03d}.dxf")
                pdf_path = str(out / f"{base_name} - {i:03d}.pdf")
                generate_dxf(folha_pvs, dxf_path, info, redes_info, cartografia=cartografia_formatada)
                generate_pdf(folha_pvs, pdf_path, info, redes_info, cartografia=cartografia_formatada)
                n += 1
            except Exception as e2:
                log(f"  [WARN] Folha {i}: {e2}")
        log(f"  {n} folhas geradas (fallback individual)")


def gerar_dynamo_script(pvs, trechos, nucleo, out_path):
    """
    Gera script Python Civil 3D .NET para importar LandXML como Pipe Network.
    Uso correto: LandXMLImport evita bater na PartsList catalog sem parametro.
    Cola em Dynamo > Python Script node ou executa em NETLOAD via _PYTHON.
    """
    log("Gerando Dynamo Script (LandXML import)...")
    net_name = f"REDE_{nucleo.upper().replace(' ','_')}"
    slug = nucleo.lower().replace(' ', '_')
    xml_fname = f"REDE_{slug.upper()}.xml"

    script = f'''# -*- coding: utf-8 -*-
# Dynamo / Civil 3D Python Script - ConstruData SABESP v6 - {nucleo}
# Gerado em {datetime.now().strftime("%d/%m/%Y %H:%M")}
# Rede: {len(pvs)} PVs | {len(trechos)} trechos
#
# USO:
#   1. Abra o Civil 3D com o DWG do projeto ativo.
#   2. Coloque o arquivo {xml_fname} na MESMA pasta deste script.
#   3. Execute via Dynamo (Python Script) ou AutoCAD NETLOAD.
#
# O script importa o LandXML como PipeNetwork, respeitando CT/CF de cada PV.

import os
import clr
clr.AddReference("AcMgd")
clr.AddReference("AcDbMgd")
clr.AddReference("AcCoreMgd")
clr.AddReference("AeccDbMgd")

from Autodesk.AutoCAD.ApplicationServices import Application
from Autodesk.Civil.ApplicationServices import CivilApplication

NET_NAME = "{net_name}"
XML_NAME = "{xml_fname}"

doc = Application.DocumentManager.MdiActiveDocument
db  = doc.Database
ed  = doc.Editor

# Resolve caminho do LandXML (mesma pasta do script ou do DWG)
def _resolve_xml():
    bases = []
    try:
        bases.append(os.path.dirname(__file__))
    except NameError:
        pass
    try:
        bases.append(os.path.dirname(doc.Name or ""))
    except Exception:
        pass
    for base in bases:
        if not base:
            continue
        cand = os.path.join(base, XML_NAME)
        if os.path.isfile(cand):
            return cand
    return XML_NAME

xml_path = _resolve_xml()
ed.WriteMessage("\\n[ConstruData] Importando LandXML: " + xml_path)

civdoc = CivilApplication.ActiveDocument

# Metodo simples e garantido (Civil 3D >= 2018): CivilDocument.ImportLandXML(xmlFilePath)
# Assina: void ImportLandXML(string xmlFilePath)
# Importa sites, alinhamentos, pipe networks etc conforme o conteudo do XML.
with doc.LockDocument():
    try:
        civdoc.ImportLandXML(xml_path)
        ed.WriteMessage("\\n[ConstruData] Rede " + NET_NAME + " importada com sucesso.")
    except Exception as ex:
        ed.WriteMessage("\\n[ConstruData] FALHA ImportLandXML: " + str(ex))
        raise

OUT = NET_NAME + " importada de " + XML_NAME
'''
    with open(str(out_path), "w", encoding="utf-8") as f:
        f.write(script)
    log(f"  Dynamo PY: {out_path}")


def gerar_dynamo_dyn(pvs, trechos, nucleo, out_path, py_script_path=None):
    """
    Gera arquivo .dyn (Dynamo 2.x JSON) contendo:
    - File Path node apontando para o LandXML
    - Python Script node que executa a importacao
    Compatível com Dynamo for Civil 3D >= 2020.
    """
    log("Gerando Dynamo .dyn...")
    slug = nucleo.lower().replace(' ', '_')
    xml_fname = f"REDE_{slug.upper()}.xml"
    net_name = f"REDE_{nucleo.upper().replace(' ','_')}"

    py_code = (
        "# Auto-gerado ConstruData SABESP v6 - " + nucleo + "\n"
        "# IN[0] = caminho do LandXML\n"
        "import clr\n"
        "clr.AddReference('AcMgd')\n"
        "clr.AddReference('AcDbMgd')\n"
        "clr.AddReference('AeccDbMgd')\n"
        "from Autodesk.AutoCAD.ApplicationServices import Application\n"
        "from Autodesk.Civil.ApplicationServices import CivilApplication\n"
        "xml_path = IN[0]\n"
        "doc = Application.DocumentManager.MdiActiveDocument\n"
        "civdoc = CivilApplication.ActiveDocument\n"
        "with doc.LockDocument():\n"
        "    civdoc.ImportLandXML(xml_path)\n"
        "OUT = '" + net_name + " importada de ' + xml_path\n"
    )

    dyn = {
        "Uuid": "a6b1c0d0-0000-0000-0000-000000000001",
        "IsCustomNode": False,
        "Description": f"ConstruData SABESP - Importa {xml_fname} como PipeNetwork",
        "Name": f"criar_pipe_network_{slug}",
        "ElementResolver": {"ResolutionMap": {}},
        "Inputs": [],
        "Outputs": [],
        "Nodes": [
            {
                "ConcreteType": "CoreNodeModels.Input.Filename, CoreNodeModels",
                "NodeType": "ExtensionNode",
                "HintPath": xml_fname,
                "InputValue": xml_fname,
                "Id": "11111111111111111111111111111111",
                "Inputs": [],
                "Outputs": [{
                    "Id": "22222222222222222222222222222222",
                    "Name": "",
                    "Description": "File Path",
                    "UsingDefaultValue": False,
                    "Level": 2,
                    "UseLevels": False,
                    "KeepListStructure": False
                }],
                "Replication": "Disabled",
                "Description": "Caminho do LandXML gerado pelo ConstruData"
            },
            {
                "ConcreteType": "PythonNodeModels.PythonNode, PythonNodeModels",
                "NodeType": "PythonScriptNode",
                "Code": py_code,
                "Engine": "IronPython2",
                "VariableInputPorts": True,
                "Id": "33333333333333333333333333333333",
                "Inputs": [{
                    "Id": "44444444444444444444444444444444",
                    "Name": "IN[0]",
                    "Description": "xml_path",
                    "UsingDefaultValue": False,
                    "Level": 2,
                    "UseLevels": False,
                    "KeepListStructure": False
                }],
                "Outputs": [{
                    "Id": "55555555555555555555555555555555",
                    "Name": "",
                    "Description": "Resultado",
                    "UsingDefaultValue": False,
                    "Level": 2,
                    "UseLevels": False,
                    "KeepListStructure": False
                }],
                "Replication": "Disabled",
                "Description": "Importa LandXML como PipeNetwork Civil 3D"
            }
        ],
        "Connectors": [{
            "Start": "22222222222222222222222222222222",
            "End": "44444444444444444444444444444444",
            "Id": "66666666666666666666666666666666",
            "IsHidden": "False"
        }],
        "Dependencies": [],
        "NodeLibraryDependencies": [],
        "Thumbnail": "",
        "GraphDocumentationURL": None,
        "ExtensionWorkspaceData": [],
        "Author": "ConstruData SABESP v6",
        "Linting": {"activeLinter": "None", "activeLinterId": "7b75fb44-43fd-4631-a878-29f4d5d8399a", "warningCount": 0, "errorCount": 0},
        "Bindings": [],
        "View": {
            "Dynamo": {
                "ScaleFactor": 1.0,
                "HasRunWithoutCrash": True,
                "IsVisibleInDynamoLibrary": True,
                "Version": "2.17.0.3472",
                "RunType": "Manual",
                "RunPeriod": "1000"
            },
            "Camera": {"Name": "_Background Preview", "EyeX": -17.0, "EyeY": 24.0, "EyeZ": 50.0,
                        "LookX": 12.0, "LookY": -13.0, "LookZ": -58.0,
                        "UpX": 0.0, "UpY": 1.0, "UpZ": 0.0},
            "ConnectorPins": [],
            "NodeViews": [
                {"Id": "11111111111111111111111111111111", "Name": "File Path", "X": 40.0, "Y": 120.0,
                 "ShowGeometry": True, "Excluded": False, "IsSetAsInput": True, "IsSetAsOutput": False, "IsFrozen": False, "IsVisible": True, "IsPinned": False},
                {"Id": "33333333333333333333333333333333", "Name": "Python Script", "X": 400.0, "Y": 120.0,
                 "ShowGeometry": True, "Excluded": False, "IsSetAsInput": False, "IsSetAsOutput": True, "IsFrozen": False, "IsVisible": True, "IsPinned": False}
            ],
            "Annotations": [],
            "X": 0.0, "Y": 0.0, "Zoom": 1.0
        }
    }
    with open(str(out_path), "w", encoding="utf-8") as f:
        json.dump(dyn, f, indent=2, ensure_ascii=False)
    log(f"  Dynamo .dyn: {out_path}")


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


def gerar_dynamo_dyn_wrapper(pvs, trechos, nucleo, out_path):
    return gerar_dynamo_dyn(pvs, trechos, nucleo, out_path)


def processar(dxf_path, nucleo, out_base, topo_txt=None, carto_dxf=None):
    log(f"{'='*60}")
    log(f"ConstruData v6 — Civil 3D + Cadastro: {nucleo}")
    log(f"{'='*60}")

    pvs, trechos, ruas, meta = ler_dxf_gdal(dxf_path)
    if not trechos:
        log("Sem trechos!"); return

    log(f"Rede Teórica: {meta['n_pvs']} PVs, {meta['n_trechos']} trechos")

    # Motor AS-BUILT: Interpolação Topográfica (Snapping)
    if topo_txt and Path(topo_txt).exists():
        log(f"Processando As-Built via topografia: {Path(topo_txt).name}")
        try:
            from motor_asbuilt import parse_topografia_txt, interpolar_as_built
            pts_topo = parse_topografia_txt(topo_txt)
            log(f"  {len(pts_topo)} pontos lidos do arquivo topo.")
            pvs = interpolar_as_built(pvs, pts_topo, raio_busca=15.0)
        except Exception as e:
            log(f"  [ERRO] Falha no Motor As-Built: {e}")

    # Extração de Cartografia Base
    cartografia = None
    if carto_dxf and Path(carto_dxf).exists():
        if str(carto_dxf).lower().endswith(".dwg"):
            log("  [WARN] O motor de cartografia suporta nativamente ODA-DXF. Um DWG pode falhar se não houver conversor.")
        log(f"Lendo base cartográfica: {Path(carto_dxf).name}")
        try:
            from cadastro.base_topografica import extrair_base_topografica
            cartografia = extrair_base_topografica(dxf_path=carto_dxf)
            log(f"  Cartografia extraída com sucesso.")
        except Exception as e:
            log(f"  [ERRO] Falha ao extrair cartografia: {e}")

    out = Path(out_base) / nucleo.upper().replace(" ", "_")
    out.mkdir(parents=True, exist_ok=True)

    slug = nucleo.lower().replace(" ", "_")
    gerar_landxml(pvs, trechos, nucleo, out / f"REDE_{slug.upper()}.xml")
    gerar_cadastro_dxf(pvs, trechos, nucleo, str(out), cartografia=cartografia)
    gerar_dynamo_script(pvs, trechos, nucleo, out / f"criar_pipe_network_{slug}.py")
    gerar_autocad_scr(pvs, trechos, nucleo, out / f"desenhar_rede_{slug}.scr")
    gerar_json_dados(pvs, trechos, nucleo, out / f"dados_{slug}.json")

    log(f"\nCONCLUIDO! Saida: {out}")
    log(f"Civil 3D: File > Import > Import LandXML > REDE_*.xml")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Gerador de Cadastro ConstruDataMax v6")
    parser.add_argument("dxf", help="Arquivo DXF do projeto original contendo a rede teórica")
    parser.add_argument("out", nargs="?", default="", help="Pasta de saída principal")
    parser.add_argument("--topo", help="Arquivo TXT/GSI do levantamento topográfico real (para interpolação As-Built)")
    parser.add_argument("--carto", help="Arquivo DXF base contendo a cartografia de fundo (Ruas, Quadras, Lotes)")
    
    args = parser.parse_args()

    dxf = args.dxf
    nucleo = Path(dxf).stem.replace("_ESGOTO","").replace("_AGUA","").replace("_"," ").title()
    out = args.out if args.out else str(Path(dxf).parent / "SAIDA_CIVIL3D")
    
    processar(dxf, nucleo, out, topo_txt=args.topo, carto_dxf=args.carto)
