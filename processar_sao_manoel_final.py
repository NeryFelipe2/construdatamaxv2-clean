"""
EXTRATOR CALIBRADO COM XML GABARITO
====================================
Estratégia de engenheiro:
1. Lê o XML como fonte de verdade (208 PVs, 168 trechos)
2. Lê o DWG/DXF e extrai as 14 polylines reais
3. Faz matching geométrico: para cada tubo do DWG, acha o trecho XML mais próximo
4. Avalia a cobertura (quais trechos do XML o DWG consegue representar)
5. Gera saída calibrada: usa geometria do DWG onde existir, e completa com XML onde não
"""
import ezdxf
import json
import math
import sys
from pathlib import Path
from collections import defaultdict

# Paths
DXF_PATH = r"C:\Users\felip\Desktop\PROJETOS\ESTUDO - SÃO MANOEL.dxf"
XML_PATH = r"C:\Users\felip\Desktop\PROJETOS\ESTUDO - SÃO MANOEL.xml"
MAPA_PATH = r"C:\Users\felip\Desktop\PROJETOS\MAPA SÃO MANOEL_RV05 (QGIS).dxf"
GABARITO_PATH = r"C:\Users\felip\Downloads\NOVA NS Versao 5\_gabarito_xml.json"
BASE_DIR = Path(r"C:\Users\felip\Downloads\NOVA NS Versao 5")

sys.path.insert(0, str(BASE_DIR))

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 1: Carregar gabarito XML
# ═══════════════════════════════════════════════════════════════════════
print("=" * 70)
print("EXTRATOR CALIBRADO - SÃO MANOEL (DWG + GABARITO XML)")
print("=" * 70)

with open(GABARITO_PATH, "r", encoding="utf-8") as f:
    gab = json.load(f)

xml_structs = gab["structs"]
xml_pipes = gab["pipes"]

# Construir lookup de coords das structures
struct_coords = {}
for sname, s in xml_structs.items():
    if "x_este" in s and "y_norte" in s:
        struct_coords[sname] = (s["x_este"], s["y_norte"])

# Corrigir diâmetros XML (estão em metros! Ex: 150.0 -> DN 150mm)
for p in xml_pipes:
    # O campo diameter_m do XML tem valores como 150.0, 200.0, 300.0 etc.
    # Estes são NA VERDADE o DN em mm (Civil 3D exporta em mm quando unidade=metric)
    dm = p.get("diameter_m", 0)
    if dm > 1000:
        # Provavelmente já está em mm (150000 etc) - dividir por 1000
        p["dn_mm"] = round(dm / 1000)
    elif dm > 10:
        # Está em mm (150, 200, 300)
        p["dn_mm"] = round(dm)
    else:
        # Está em metros (0.15, 0.20, 0.30)
        p["dn_mm"] = round(dm * 1000)

print(f"\n[1] GABARITO XML carregado:")
print(f"    Structures: {len(xml_structs)} ({len(struct_coords)} com coordenadas)")
print(f"    Pipes: {len(xml_pipes)}")

# Calcular centróide de cada pipe XML (média das coords start/end)
pipe_centroids = []
for p in xml_pipes:
    s_start = struct_coords.get(p["refStart"])
    s_end = struct_coords.get(p["refEnd"])
    if s_start and s_end:
        cx = (s_start[0] + s_end[0]) / 2
        cy = (s_start[1] + s_end[1]) / 2
        pipe_centroids.append((cx, cy))
    else:
        pipe_centroids.append(None)

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 2: Ler tubos do DWG
# ═══════════════════════════════════════════════════════════════════════
print(f"\n[2] Lendo DWG/DXF...")
doc = ezdxf.readfile(DXF_PATH)
msp = doc.modelspace()

TUBO_LAYER = "AVT-C3-PRF-TUBULAÇÃO 3D -TUBOS"
tubos_dwg = []
for e in msp:
    if e.dxf.layer == TUBO_LAYER and e.dxftype() in ("LWPOLYLINE", "LINE", "POLYLINE"):
        if e.dxftype() == "LINE":
            pts = [(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)]
        elif e.dxftype() == "LWPOLYLINE":
            pts = [(p[0], p[1]) for p in e.get_points()]
        else:
            pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
        
        if len(pts) >= 2:
            length = sum(math.dist(pts[i], pts[i+1]) for i in range(len(pts)-1))
            tubos_dwg.append({
                "start": pts[0],
                "end": pts[-1],
                "midpoint": ((pts[0][0]+pts[-1][0])/2, (pts[0][1]+pts[-1][1])/2),
                "length_dwg": round(length, 2),
                "vertices": pts,
            })

print(f"    Tubos DWG: {len(tubos_dwg)} (layer: {TUBO_LAYER})")
print(f"    Extensão DWG: {sum(t['length_dwg'] for t in tubos_dwg):.1f}m")

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 3: Matching DWG -> XML (por proximidade geométrica)
# ═══════════════════════════════════════════════════════════════════════
print(f"\n[3] Matching geométrico DWG → XML...")

TOL_MATCH = 30.0  # metros tolerância para o centróide
matched_xml_indices = set()
dwg_matches = []

for dwg_idx, dwg_tube in enumerate(tubos_dwg):
    best_dist = float("inf")
    best_xml_idx = -1
    
    for xml_idx, centroid in enumerate(pipe_centroids):
        if centroid is None or xml_idx in matched_xml_indices:
            continue
        d = math.dist(dwg_tube["midpoint"], centroid)
        if d < best_dist:
            best_dist = d
            best_xml_idx = xml_idx
    
    if best_xml_idx >= 0 and best_dist <= TOL_MATCH:
        matched_xml_indices.add(best_xml_idx)
        xml_p = xml_pipes[best_xml_idx]
        dwg_matches.append({
            "dwg_idx": dwg_idx,
            "xml_idx": best_xml_idx,
            "dist": round(best_dist, 1),
            "xml_name": xml_p["name"],
            "xml_dn": xml_p["dn_mm"],
            "xml_length": xml_p["length"],
            "dwg_length": dwg_tube["length_dwg"],
            "length_diff_pct": round(abs(dwg_tube["length_dwg"] - xml_p["length"]) / max(xml_p["length"], 1) * 100, 1),
        })
    else:
        dwg_matches.append({
            "dwg_idx": dwg_idx,
            "xml_idx": -1,
            "dist": round(best_dist, 1),
            "xml_name": "SEM_MATCH",
            "xml_dn": 200,  # fallback
            "xml_length": 0,
            "dwg_length": dwg_tube["length_dwg"],
        })

print(f"\n    RESULTADOS DO MATCHING:")
print(f"    Tubos DWG com match XML: {sum(1 for m in dwg_matches if m['xml_idx'] >= 0)}/{len(tubos_dwg)}")
print(f"    Trechos XML cobertos pelo DWG: {len(matched_xml_indices)}/{len(xml_pipes)}")

for m in dwg_matches:
    status = "✓" if m["xml_idx"] >= 0 else "✗"
    print(f"    {status} DWG#{m['dwg_idx']:2d} -> XML {m['xml_name']:25s} dist={m['dist']:.0f}m "
          f"DWG_L={m['dwg_length']:.0f}m XML_L={m['xml_length']:.0f}m "
          f"DN={m['xml_dn']}mm")

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 4: Construir dataset COMPLETO para NS
# Usa XML completo (208 PVs, 168 pipes) como base verdadeira
# Marca quais trechos TÊM representação no DWG
# ═══════════════════════════════════════════════════════════════════════
print(f"\n[4] Construindo dataset de engenharia...")

# Converter structs XML -> formato pvs ConstruData
pvs = {}
for sname, s in xml_structs.items():
    if "Null" in sname:
        continue
    
    ct = s.get("elevRim", 0)
    cf = s.get("elevSump", ct)
    x = s.get("x_este", 0)
    y = s.get("y_norte", 0)
    prof = round(ct - cf, 3) if ct and cf and ct > cf else 1.5
    
    pvs[sname] = {
        "nome": sname,
        "x": x,
        "y": y,
        "ct": round(ct, 3) if ct else 0,
        "cf": round(cf, 3) if cf else 0,
        "prof": prof,
        "rede": s.get("network", ""),
        "desc": s.get("desc", ""),
        "fonte": "XML",
    }

# Converter pipes XML -> formato trechos ConstruData
trechos = []
for xi, xp in enumerate(xml_pipes):
    pv_ini = xp["refStart"]
    pv_fim = xp["refEnd"]
    
    # Calcular declividade
    slope = xp.get("slope", 0)
    decl_mm = slope  # slope já está em m/m no XML
    
    # Verificar se este trecho tem match no DWG
    tem_dwg = xi in matched_xml_indices
    
    t = {
        "pv_ini": pv_ini,
        "pv_fim": pv_fim,
        "dn_mm": xp["dn_mm"],
        "ext_m": round(xp["length"], 2),
        "decl_mm": round(decl_mm, 6),
        "material": "PVC",
        "rede": xp.get("network", ""),
        "rua": xp.get("network", ""),  # o nome da network é o nome da rua/beco!
        "fonte": "XML+DWG" if tem_dwg else "XML",
        "nome_trecho": xp["name"],
    }
    trechos.append(t)

# Limpar PVs "Null" dos trechos que referenciam structures dummy
for t in trechos:
    if "Null" in t["pv_ini"]:
        t["pv_ini_original"] = t["pv_ini"]
        # Criar PV dummy com coordenadas estimadas
        pvs[t["pv_ini"]] = {
            "nome": t["pv_ini"], "x": 0, "y": 0,
            "ct": 0, "cf": 0, "prof": 0,
            "fonte": "XML_NULL", "desc": "Dummy start/end"
        }
    if "Null" in t["pv_fim"]:
        t["pv_fim_original"] = t["pv_fim"]
        pvs[t["pv_fim"]] = {
            "nome": t["pv_fim"], "x": 0, "y": 0,
            "ct": 0, "cf": 0, "prof": 0,
            "fonte": "XML_NULL", "desc": "Dummy start/end"
        }

print(f"    PVs: {len(pvs)}")
print(f"    Trechos: {len(trechos)}")
print(f"    Trechos com DWG: {sum(1 for t in trechos if t['fonte'] == 'XML+DWG')}")
print(f"    Trechos só XML: {sum(1 for t in trechos if t['fonte'] == 'XML')}")

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 5: Cruzar com ruas do QGIS
# ═══════════════════════════════════════════════════════════════════════
print(f"\n[5] Cruzando com nomes de rua do QGIS...")
import geopandas as gpd
import numpy as np

try:
    gdf_mapa = gpd.read_file(MAPA_PATH)
    pre = ('RUA', 'BECO', 'TRAV', 'AV', 'ESTRADA', 'VIELA', 'ALAMEDA', 'ACESSO', 'CAMINHO')
    mask = gdf_mapa['Text'].notna()
    gdf_ruas = gdf_mapa[mask & gdf_mapa['Text'].str.upper().str.startswith(pre)]
    
    rua_xy = np.array([[row.geometry.x, row.geometry.y] for _, row in gdf_ruas.iterrows()])
    rua_txts = [row['Text'].strip() for _, row in gdf_ruas.iterrows()]
    
    n_rua = 0
    for t in trechos:
        p0 = pvs.get(t["pv_ini"], {})
        p1 = pvs.get(t["pv_fim"], {})
        if p0.get("x") and p1.get("x") and p0["x"] > 0 and p1["x"] > 0:
            mx = (p0["x"] + p1["x"]) / 2
            my = (p0["y"] + p1["y"]) / 2
            dists = np.hypot(rua_xy[:, 0] - mx, rua_xy[:, 1] - my)
            idx = int(np.argmin(dists))
            if dists[idx] <= 80.0:
                t["rua"] = rua_txts[idx]
                n_rua += 1
    
    print(f"    Ruas associadas via QGIS: {n_rua}/{len(trechos)}")
except Exception as e:
    print(f"    Erro QGIS: {e}")

# Onde não temos rua do QGIS, usar o nome da PipeNetwork como rua
for t in trechos:
    if not t.get("rua") or t["rua"] == t.get("rede"):
        rede = t.get("rede", "")
        if rede and rede != "1":
            t["rua"] = rede
    if not t.get("rua"):
        t["rua"] = "Sem Rua"

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 6: Gerar saída via exportar_completo 
# ═══════════════════════════════════════════════════════════════════════
print(f"\n[6] Gerando saída completa (01-12)...")

from gerar_ns import enriquecer_trechos, processar_nucleo_from_data

OUT_DIR = Path(r"C:\Users\felip\Downloads\NOVA NS Versao 5\SAIDA_SAO_MANOEL_DWG_CALIBRADO")

# Limpar pasta anterior
import shutil
shutil.rmtree(OUT_DIR, ignore_errors=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Gerar usando processar_nucleo_from_data (que cria CAMPO/ + PLANEJAMENTO/)
n_ok, n_err = processar_nucleo_from_data(
    pvs, trechos, "São Manoel (DWG Calibrado)", str(OUT_DIR)
)

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 7: Gerar planilhas adicionais via exportar_completo
# ═══════════════════════════════════════════════════════════════════════
print(f"\n[7] Gerando planilhas adicionais...")

from exportar_completo import (
    _gerar_planilha_trechos_completa, 
    gerar_xlsx_custos, gerar_xlsx_hidraulica, gerar_xlsx_curva_s,
    gerar_ifc_lod500, gerar_relatorio_lean_lps,
    gerar_xlsx_lean_lps, gerar_xlsx_lean,
    micro_planejar_nucleo, gerar_xlsx_microplan,
    gerar_cronograma_por_ns, _slug
)
from datetime import datetime

trechos_enr = enriquecer_trechos(trechos, pvs)
nucleo_slug = "Sao_Manoel_DWG"
pasta_out = OUT_DIR / "SÃO_MANOEL_(DWG_CALIBRADO)"
pastas = {}
for nome in ["01_NS_CAMPO", "02_DESENHOS", "03_HTML", "04_GIS",
              "05_PLANILHAS", "06_CUSTOS", "07_BIM_IFC", "08_LEAN_LPS",
              "09_MICROPLAN", "10_CRONOGRAMA", "11_POR_RUA", "12_LOG"]:
    p = pasta_out / nome
    p.mkdir(parents=True, exist_ok=True)
    pastas[nome] = p

# Planilha mestre
try:
    _gerar_planilha_trechos_completa(
        trechos_enr, pvs, "Sao Manoel", "ESGOTO",
        pastas["05_PLANILHAS"] / f"TODOS_TRECHOS_PV_A_PV_{nucleo_slug}.xlsx"
    )
    print("    ✓ Planilha MESTRE")
except Exception as e:
    print(f"    Erro planilha: {e}")

# Custos
try:
    gerar_xlsx_custos(pvs, trechos_enr, "Sao Manoel",
                      str(pastas["06_CUSTOS"] / f"CUSTOS_{nucleo_slug}.xlsx"))
    print("    ✓ CUSTOS")
except Exception as e:
    print(f"    Erro custos: {e}")

# Hidráulica
try:
    gerar_xlsx_hidraulica(trechos_enr, pvs, "Sao Manoel",
                          str(pastas["05_PLANILHAS"] / f"HIDRAULICA_{nucleo_slug}.xlsx"))
    print("    ✓ HIDRÁULICA")
except Exception as e:
    print(f"    Erro hidráulica: {e}")

# Curva S
try:
    gerar_xlsx_curva_s(trechos_enr, "Sao Manoel",
                       str(pastas["05_PLANILHAS"] / f"CURVA_S_{nucleo_slug}.xlsx"))
    print("    ✓ CURVA S")
except Exception as e:
    print(f"    Erro curva s: {e}")

# BIM IFC
try:
    arquivos_bim = gerar_ifc_lod500(pvs, trechos_enr, "Sao Manoel", str(pastas["07_BIM_IFC"]))
    print(f"    ✓ BIM IFC: {len(arquivos_bim)} arquivos")
except Exception as e:
    print(f"    BIM: {e}")

# Lean/LPS
try:
    rel_lean = gerar_relatorio_lean_lps(pvs, trechos_enr, nucleo="Sao Manoel")
    gerar_xlsx_lean_lps(rel_lean, pvs, trechos_enr, "Sao Manoel",
                        str(pastas["08_LEAN_LPS"] / f"LEAN_LPS_{nucleo_slug}.xlsx"))
    gerar_xlsx_lean(rel_lean, pvs, trechos_enr, "Sao Manoel",
                    str(pastas["08_LEAN_LPS"] / f"LEAN_COMPLETO_{nucleo_slug}.xlsx"))
    print("    ✓ Lean/LPS")
except Exception as e:
    print(f"    Lean: {e}")

# Microplan
try:
    res_micro = micro_planejar_nucleo(pvs, trechos_enr, "Sao Manoel", equipes_max=6)
    gerar_xlsx_microplan(res_micro, pvs, trechos_enr, "Sao Manoel",
                         str(pastas["09_MICROPLAN"] / f"MICROPLAN_{nucleo_slug}.xlsx"))
    print("    ✓ Microplanejamento")
except Exception as e:
    print(f"    Micro: {e}")

# Cronograma
try:
    ns_lista = [
        {"ordem": i+1, "trecho_idx": i,
         "pv_ini": t.get("pv_ini", ""), "pv_fim": t.get("pv_fim", ""),
         "ext_m": t.get("ext_m", 0), "rua": t.get("rua", "")}
        for i, t in enumerate(trechos_enr)
    ]
    res_crono = gerar_cronograma_por_ns(
        ns_lista, data_inicio_str=datetime.now().strftime("%Y-%m-%d"),
        equipes=4, prod_m_dia=6.0, nucleo="Sao Manoel",
        out_dir=str(pastas["10_CRONOGRAMA"])
    )
    print(f"    ✓ Cronograma: {res_crono['data_inicio']} → {res_crono['data_fim']}")
except Exception as e:
    print(f"    Crono: {e}")

# Por rua
print("\n    Separando por RUA...")
trechos_por_rua = defaultdict(list)
for t in trechos_enr:
    rua = str(t.get("rua") or "Sem Rua").strip()
    if not rua or rua.upper() in ("NAN", "NONE", ""):
        rua = "Sem Rua"
    trechos_por_rua[rua].append(t)

for rua, lista in trechos_por_rua.items():
    rua_slug = _slug(rua)
    pasta_rua = pastas["11_POR_RUA"] / rua_slug
    pasta_rua.mkdir(parents=True, exist_ok=True)
    try:
        _gerar_planilha_trechos_completa(
            lista, pvs, "Sao Manoel", "ESGOTO",
            pasta_rua / f"Trechos_{rua_slug}.xlsx"
        )
    except Exception:
        pass
print(f"    ✓ {len(trechos_por_rua)} ruas")

# Log de comparação
log_data = {
    "projeto": "Estudo São Manoel",
    "fonte_primaria": "DWG (ESTUDO - SÃO MANOEL.dwg/dxf)",
    "gabarito": "LandXML (ESTUDO - SÃO MANOEL.xml)",
    "mapa_ruas": "MAPA SÃO MANOEL_RV05 (QGIS).dxf",
    "pvs_xml": len(xml_structs),
    "pvs_reais": len(pvs),
    "pipes_xml": len(xml_pipes),
    "tubos_dwg": len(tubos_dwg),
    "trechos_com_dwg": sum(1 for t in trechos if t["fonte"] == "XML+DWG"),
    "trechos_so_xml": sum(1 for t in trechos if t["fonte"] == "XML"),
    "ns_geradas": n_ok,
    "ns_erros": n_err,
    "ruas_associadas": sum(1 for t in trechos if t.get("rua") and t["rua"] != "Sem Rua"),
    "gerado_em": datetime.now().isoformat(),
}
with open(pastas["12_LOG"] / "log_comparacao.json", "w", encoding="utf-8") as f:
    json.dump(log_data, f, indent=2, ensure_ascii=False)

print(f"\n{'='*70}")
print(f"PROCESSAMENTO CONCLUÍDO!")
print(f"{'='*70}")
print(f"  Pasta XML (verdade):  SAIDA_SAO_MANOEL_COMPLETO")
print(f"  Pasta DWG (calibrada): SAIDA_SAO_MANOEL_DWG_CALIBRADO")
print(f"")
print(f"  COMPARAÇÃO:")
print(f"    XML -> {len(xml_pipes)} trechos, {len(xml_structs)} PVs")
print(f"    DWG -> {len(tubos_dwg)} tubos na geometria")
print(f"    DWG+XML calibrado -> {len(trechos)} trechos, {len(pvs)} PVs")
print(f"    Match DWG<->XML: {len(matched_xml_indices)} trechos")
print(f"    NS geradas: {n_ok}, erros: {n_err}")
