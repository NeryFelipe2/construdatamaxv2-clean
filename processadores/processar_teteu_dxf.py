"""
EXTRATOR PROSANEAMENTO DXF/DWG - TETÉU ESGOTO 22
=================================================
Baseado nas layers padrão do ProSaneamento:
  - TUBO_PVC: linhas/polylines dos tubos
  - PS_PONTOS_IDENTIFICACAO_TXT: textos P.V./P.I., C.T., C.F., profundidade
  - PS_PONTOS_IDENTIFICACAO_LIN: linhas de indicação dos PVs  
  - PS_IND_DIAMETRO: textos D=xxxmm
  - PS_IND_COMPRIMENTO: textos nn.nnm (extensão)
  - PS_IND_FLUXO: setas de fluxo
  - COTAS: circles (PVs em planta)
  - ZZ-Carimbo Texto: nomes de ruas
"""
import ezdxf
import json
import math
import re
import sys
from pathlib import Path
from collections import defaultdict
import numpy as np

BASE_DIR = Path(r"C:\Users\felip\Downloads\NOVA NS Versao 5")
sys.path.insert(0, str(BASE_DIR))

DXF_PATH = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\MORRO DO TETÉU\TETÉU_ESGOTO22.dxf"
GPKG_PATH = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\MAPA TETEU-VALE VERDE_R04 (QGIS).gpkg"
OUT_DIR = Path(r"C:\Users\felip\Downloads\NOVA NS Versao 5\SAIDA_TETEU_DXF_CALIBRADO")

print("=" * 70)
print("EXTRATOR PROSANEAMENTO - TETÉU ESGOTO 22 (DXF)")
print("=" * 70)

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 1: Ler todos os dados do DXF
# ═══════════════════════════════════════════════════════════════════════
print("\n[1] Lendo DXF ProSaneamento...")
doc = ezdxf.readfile(DXF_PATH)
msp = doc.modelspace()

# Coletar TODOS os textos
all_texts = []
for e in msp:
    if e.dxftype() in ("TEXT", "MTEXT"):
        txt = e.dxf.text if e.dxftype() == "TEXT" else e.text
        if txt:
            pos = e.dxf.insert if hasattr(e.dxf, 'insert') else None
            x = pos.x if pos else 0
            y = pos.y if pos else 0
            all_texts.append({"text": txt.strip(), "layer": e.dxf.layer, "x": x, "y": y})

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 2: Extrair PVs da layer PS_PONTOS_IDENTIFICACAO_TXT
# O padrão do ProSaneamento é:
#   P.V. NN ou P.I. NN
#   EST.
#   C.T. xx.xxx
#   C.F. xx.xxx
#   (profundidade)
# Os textos estão empilhados verticalmente na mesma coordenada X
# ═══════════════════════════════════════════════════════════════════════
print("\n[2] Extraindo PVs do ProSaneamento...")

# Filtrar textos da layer PS_PONTOS_IDENTIFICACAO_TXT com coordenadas na faixa da planta
# (excluindo perfis que estão em coordenadas baixas X < 1000)
ps_texts = [t for t in all_texts if "PS_PONTOS" in t["layer"] and t["x"] > 1000]

# Agrupar textos por proximidade X (mesmo PV = mesmo X)
# Ordenar por X, depois Y decrescente (P.V. no topo, profundidade embaixo)
ps_texts.sort(key=lambda t: (round(t["x"], 0), -t["y"]))

# Agrupar por X (tolerância de 2m)
pv_groups = []
current_group = []
current_x = None

for t in ps_texts:
    if current_x is None or abs(t["x"] - current_x) > 3.0:
        if current_group:
            pv_groups.append(current_group)
        current_group = [t]
        current_x = t["x"]
    else:
        current_group.append(t)

if current_group:
    pv_groups.append(current_group)

# Parsear cada grupo para extrair PV
pvs = {}
for group in pv_groups:
    pv_name = None
    ct = None
    cf = None
    prof = None
    x = group[0]["x"]
    y = None
    
    for t in group:
        txt = t["text"]
        
        # Nome do PV
        m = re.match(r'^P\.\s*(V|I)\.\s*(\d+)', txt)
        if m:
            tipo = "PV" if m.group(1) == "V" else "PI"
            num = m.group(2)
            pv_name = f"{tipo}-{num}"
            y = t["y"]  # usar Y do texto P.V.
            continue
        
        # Cota Terreno
        m = re.match(r'^C\.T\.\s*([-\d.]+)', txt)
        if m:
            ct = float(m.group(1))
            continue
        
        # Cota Fundo
        m = re.match(r'^C\.F\.\s*([-\d.]+)', txt)
        if m:
            cf = float(m.group(1))
            continue
        
        # Profundidade (número solto no final)
        m = re.match(r'^(\d+\.\d+)$', txt)
        if m and pv_name:
            prof = float(m.group(1))
    
    if pv_name and ct is not None:
        pvs[pv_name] = {
            "nome": pv_name,
            "x": round(x, 3),
            "y": round(y, 3) if y else 0,
            "ct": round(ct, 3),
            "cf": round(cf, 3) if cf is not None else round(ct - (prof or 1.5), 3),
            "prof": round(prof or (ct - cf if cf else 1.5), 3),
            "fonte": "ProSaneamento_DXF",
        }

print(f"    PVs extraídos: {len(pvs)}")
for k, v in list(pvs.items())[:5]:
    print(f"      {k}: CT={v['ct']} CF={v['cf']} Prof={v['prof']}m @ ({v['x']:.0f}, {v['y']:.0f})")

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 3: Extrair Tubos da layer TUBO_PVC
# ═══════════════════════════════════════════════════════════════════════
print("\n[3] Extraindo tubos (TUBO_PVC)...")

tubos = []
for e in msp:
    if e.dxf.layer == "TUBO_PVC":
        if e.dxftype() == "LINE":
            s = (e.dxf.start.x, e.dxf.start.y)
            en = (e.dxf.end.x, e.dxf.end.y)
            length = math.dist(s, en)
            if length > 1.0:
                tubos.append({"start": s, "end": en, "length": round(length, 2)})
        elif e.dxftype() in ("LWPOLYLINE", "POLYLINE"):
            try:
                pts = [(p[0], p[1]) for p in e.get_points()] if e.dxftype() == "LWPOLYLINE" else [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
                if len(pts) >= 2:
                    length = sum(math.dist(pts[i], pts[i+1]) for i in range(len(pts)-1))
                    if length > 1.0:
                        tubos.append({"start": pts[0], "end": pts[-1], "length": round(length, 2)})
            except Exception:
                pass

print(f"    Tubos: {len(tubos)} (extensão: {sum(t['length'] for t in tubos):.1f}m)")

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 4: Associar DNs aos tubos (PS_IND_DIAMETRO)
# ═══════════════════════════════════════════════════════════════════════
print("\n[4] Associando diâmetros (PS_IND_DIAMETRO)...")

dn_texts = [t for t in all_texts if t["layer"] == "PS_IND_DIAMETRO" and t["x"] > 1000]
print(f"    DNs na planta: {len(dn_texts)}")

# Para cada tubo, encontrar o texto DN mais próximo
for tubo in tubos:
    mid = ((tubo["start"][0]+tubo["end"][0])/2, (tubo["start"][1]+tubo["end"][1])/2)
    best_dist = float("inf")
    best_dn = 200  # default
    for dt in dn_texts:
        d = math.dist(mid, (dt["x"], dt["y"]))
        if d < best_dist:
            best_dist = d
            m = re.search(r'(\d+)\s*mm', dt["text"])
            if m:
                best_dn = int(m.group(1))
    tubo["dn_mm"] = best_dn
    tubo["dn_dist"] = round(best_dist, 1)

dns = defaultdict(int)
for t in tubos:
    dns[t["dn_mm"]] += 1
for d, c in sorted(dns.items()):
    print(f"      DN {d}mm: {c} tubos")

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 5: Construir trechos (associar tubos aos PVs mais próximos)
# ═══════════════════════════════════════════════════════════════════════
print("\n[5] Construindo trechos PV→PV...")

pv_coords = np.array([[v["x"], v["y"]] for v in pvs.values()])
pv_names = list(pvs.keys())

trechos = []
for tubo in tubos:
    # Encontrar PV mais próximo do início
    dists_s = np.hypot(pv_coords[:, 0] - tubo["start"][0], pv_coords[:, 1] - tubo["start"][1])
    idx_s = int(np.argmin(dists_s))
    
    # Encontrar PV mais próximo do fim
    dists_e = np.hypot(pv_coords[:, 0] - tubo["end"][0], pv_coords[:, 1] - tubo["end"][1])
    idx_e = int(np.argmin(dists_e))
    
    pv_ini = pv_names[idx_s]
    pv_fim = pv_names[idx_e]
    
    # Evitar trecho que vai para o mesmo PV
    if pv_ini == pv_fim:
        continue
    
    # Calcular declividade
    ct_i = pvs[pv_ini].get("cf", 0)
    ct_f = pvs[pv_fim].get("cf", 0)
    ext = tubo["length"]
    decl = abs(ct_i - ct_f) / ext if ext > 0 else 0
    
    trechos.append({
        "pv_ini": pv_ini,
        "pv_fim": pv_fim,
        "dn_mm": tubo["dn_mm"],
        "ext_m": round(ext, 2),
        "decl_mm": round(decl, 6),
        "material": "PVC",
        "fonte": "ProSaneamento_DXF",
    })

print(f"    Trechos construídos: {len(trechos)}")
ext_total = sum(t["ext_m"] for t in trechos)
print(f"    Extensão total: {ext_total:.1f}m")
for t in trechos[:5]:
    print(f"      {t['pv_ini']}→{t['pv_fim']} DN{t['dn_mm']} L={t['ext_m']:.1f}m")

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 6: Cruzar ruas do GPKG
# ═══════════════════════════════════════════════════════════════════════
print("\n[6] Cruzando com cartografia GPKG...")

try:
    import geopandas as gpd
    gdf = gpd.read_file(GPKG_PATH)
    
    # Encontrar coluna de texto
    rua_col = None
    for col in gdf.columns:
        c = col.upper()
        if any(k in c for k in ["RUA", "LOGRADOURO", "NOME", "NAME", "DESCRICAO", "LABEL", "TEXT"]):
            rua_col = col
            break
    
    if rua_col:
        ruas_gdf = gdf[gdf[rua_col].notna() & (gdf[rua_col] != "")]
        centroids = ruas_gdf.geometry.centroid
        rua_xy = np.array([[c.x, c.y] for c in centroids])
        rua_names = ruas_gdf[rua_col].values
        
        n_ruas = 0
        for t in trechos:
            p0 = pvs.get(t["pv_ini"], {})
            p1 = pvs.get(t["pv_fim"], {})
            if p0.get("x") and p1.get("x"):
                mx = (p0["x"] + p1["x"]) / 2
                my = (p0["y"] + p1["y"]) / 2
                dists = np.hypot(rua_xy[:, 0] - mx, rua_xy[:, 1] - my)
                idx = int(np.argmin(dists))
                if dists[idx] <= 100.0:
                    t["rua"] = str(rua_names[idx]).strip()
                    n_ruas += 1
        print(f"    Ruas GPKG: {n_ruas}/{len(trechos)} trechos")
    else:
        print("    Coluna de rua não encontrada no GPKG")
except Exception as e:
    print(f"    Erro GPKG: {e}")

# Fallback: ruas do DXF (ZZ-Carimbo Texto)
zz_texts = [t for t in all_texts if "ZZ" in t["layer"] and t["x"] > 1000]
pre = ('RUA', 'BECO', 'TRAV', 'AV', 'ESTRADA', 'VIELA', 'CAMINHO', 'ESCADARIA')
rua_zz = [t for t in zz_texts if t["text"].upper().startswith(pre)]

for t in trechos:
    if t.get("rua") and t["rua"] != "Sem Rua":
        continue
    p0 = pvs.get(t["pv_ini"], {})
    p1 = pvs.get(t["pv_fim"], {})
    if p0.get("x") and p1.get("x"):
        mx = (p0["x"] + p1["x"]) / 2
        my = (p0["y"] + p1["y"]) / 2
        best_d = float("inf")
        best_rua = "Sem Rua"
        for r in rua_zz:
            d = math.dist((mx, my), (r["x"], r["y"]))
            if d < best_d:
                best_d = d
                best_rua = r["text"]
        if best_d <= 80:
            t["rua"] = best_rua

n_ruas_total = sum(1 for t in trechos if t.get("rua") and t["rua"] != "Sem Rua")
print(f"    Ruas totais (GPKG+DXF): {n_ruas_total}/{len(trechos)} trechos")

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 7: Gerar saída completa
# ═══════════════════════════════════════════════════════════════════════
print(f"\n[7] Gerando saída completa (01-12)...")

import shutil
shutil.rmtree(OUT_DIR, ignore_errors=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

from gerar_ns import enriquecer_trechos, processar_nucleo_from_data

n_ok, n_err = processar_nucleo_from_data(
    pvs, trechos, "Morro do Tetéu (DXF ProSane)", str(OUT_DIR)
)

# Gerar pastas extras 01-12
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
slug = "Teteu_DXF"
pasta_out = OUT_DIR / "MORRO_DO_TETÉU_(DXF_CALIBRADO)"
pastas = {}
for nome in ["01_NS_CAMPO", "02_DESENHOS", "03_HTML", "04_GIS",
              "05_PLANILHAS", "06_CUSTOS", "07_BIM_IFC", "08_LEAN_LPS",
              "09_MICROPLAN", "10_CRONOGRAMA", "11_POR_RUA", "12_LOG"]:
    p = pasta_out / nome
    p.mkdir(parents=True, exist_ok=True)
    pastas[nome] = p

try:
    _gerar_planilha_trechos_completa(trechos_enr, pvs, "Morro do Teteu", "ESGOTO",
                                     pastas["05_PLANILHAS"] / f"TODOS_TRECHOS_{slug}.xlsx")
    print("    ✓ Planilha MESTRE")
except Exception as e: print(f"    Erro planilha: {e}")

try:
    gerar_xlsx_custos(pvs, trechos_enr, "Morro do Teteu", str(pastas["06_CUSTOS"] / f"CUSTOS_{slug}.xlsx"))
    print("    ✓ CUSTOS")
except Exception as e: print(f"    Erro custos: {e}")

try:
    gerar_xlsx_hidraulica(trechos_enr, pvs, "Morro do Teteu", str(pastas["05_PLANILHAS"] / f"HIDRAULICA_{slug}.xlsx"))
    print("    ✓ HIDRÁULICA")
except Exception as e: print(f"    Erro hidr: {e}")

try:
    gerar_xlsx_curva_s(trechos_enr, "Morro do Teteu", str(pastas["05_PLANILHAS"] / f"CURVA_S_{slug}.xlsx"))
    print("    ✓ CURVA S")
except Exception as e: print(f"    Erro curva: {e}")

try:
    arqs = gerar_ifc_lod500(pvs, trechos_enr, "Morro do Teteu", str(pastas["07_BIM_IFC"]))
    print(f"    ✓ BIM IFC: {len(arqs)} arquivos")
except Exception as e: print(f"    BIM: {e}")

try:
    rel = gerar_relatorio_lean_lps(pvs, trechos_enr, nucleo="Morro do Teteu")
    gerar_xlsx_lean_lps(rel, pvs, trechos_enr, "Morro do Teteu", str(pastas["08_LEAN_LPS"] / f"LEAN_LPS_{slug}.xlsx"))
    gerar_xlsx_lean(rel, pvs, trechos_enr, "Morro do Teteu", str(pastas["08_LEAN_LPS"] / f"LEAN_COMPLETO_{slug}.xlsx"))
    print("    ✓ Lean/LPS")
except Exception as e: print(f"    Lean: {e}")

try:
    res = micro_planejar_nucleo(pvs, trechos_enr, "Morro do Teteu", equipes_max=6)
    gerar_xlsx_microplan(res, pvs, trechos_enr, "Morro do Teteu", str(pastas["09_MICROPLAN"] / f"MICROPLAN_{slug}.xlsx"))
    print("    ✓ Microplanejamento")
except Exception as e: print(f"    Micro: {e}")

try:
    ns_lista = [{"ordem": i+1, "trecho_idx": i, "pv_ini": t.get("pv_ini",""), "pv_fim": t.get("pv_fim",""),
                 "ext_m": t.get("ext_m",0), "rua": t.get("rua","")} for i, t in enumerate(trechos_enr)]
    res_c = gerar_cronograma_por_ns(ns_lista, data_inicio_str=datetime.now().strftime("%Y-%m-%d"),
                                     equipes=4, prod_m_dia=6.0, nucleo="Morro do Teteu", out_dir=str(pastas["10_CRONOGRAMA"]))
    print(f"    ✓ Cronograma: {res_c['data_inicio']} → {res_c['data_fim']}")
except Exception as e: print(f"    Crono: {e}")

# Por rua
trechos_por_rua = defaultdict(list)
for t in trechos_enr:
    rua = str(t.get("rua") or "Sem Rua").strip()
    trechos_por_rua[rua].append(t)
for rua, lista in trechos_por_rua.items():
    rua_slug = _slug(rua)
    pr = pastas["11_POR_RUA"] / rua_slug
    pr.mkdir(parents=True, exist_ok=True)
    try: _gerar_planilha_trechos_completa(lista, pvs, "Morro do Teteu", "ESGOTO", pr / f"Trechos_{rua_slug}.xlsx")
    except: pass
print(f"    ✓ {len(trechos_por_rua)} ruas")

# Log
log = {
    "projeto": "Tetéu Esgoto 22", "fonte": "ProSaneamento DXF",
    "dxf": DXF_PATH, "gpkg": GPKG_PATH,
    "n_pvs": len(pvs), "n_trechos": len(trechos),
    "ext_total_m": round(ext_total, 1),
    "ns_geradas": n_ok, "ns_erros": n_err,
    "ruas": len(trechos_por_rua),
    "gerado_em": datetime.now().isoformat(),
}
with open(pastas["12_LOG"] / "log_processamento.json", "w", encoding="utf-8") as f:
    json.dump(log, f, indent=2, ensure_ascii=False)

print(f"\n{'='*70}")
print(f"PROCESSAMENTO CONCLUÍDO!")
print(f"{'='*70}")
print(f"  PVs: {len(pvs)}")
print(f"  Trechos: {len(trechos)}")
print(f"  NS: {n_ok} ok, {n_err} erros")
print(f"  Pasta: {OUT_DIR}")
