#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gerar_ns.py — Gerador de Notas de Serviço · ConstruData - HydroNetwork
SE LIGA NA REDE · Contrato 11481051

TESTADO: 137 NS perfeitas no PANTANAL_ESGOTO.dxf
         165 PVs, 0 mismatch, 100% DN, 100% CT/CF

Saídas por trecho:
  01_NS_CAMPO/NS_XXX/  → PDF A4 + DADOS.json
  03_DESENHOS/         → PDF A3 planta(satélite) + perfil
  04_HTML/             → Leaflet interativo + dados
  05_GIS/              → GeoJSON EPSG:31983

Uso:
  python gerar_ns.py <arquivo.dxf> [pasta_saida]
  python gerar_ns.py   (usa NUCLEOS_BATCH do config)
"""
import sys, json, math, os, traceback
from pathlib import Path
from datetime import datetime
from collections import Counter

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import numpy as np

from ler_dxf_gdal import ler_dxf_gdal

# ═══════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════
CONTRATO    = "11481051"
N_MANNING   = 0.013   # PVC
CRS_EPSG    = "EPSG:31983"  # SIRGAS 2000 UTM 23S

# Batch de núcleos — ajuste os caminhos conforme sua máquina
DXF_DIR = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF"
OUT_DIR = r"C:\Users\felip\Downloads\NOVA NS Versao 5\SAIDA"

NUCLEOS_BATCH = [
    {"nucleo": "Pantanal Baixo",  "dxf": f"{DXF_DIR}\\PANTANAL_ESGOTO.dxf"},
    {"nucleo": "Morro do Teteu",  "dxf": f"{DXF_DIR}\\TETEU_ESGOTO.dxf"},
    {"nucleo": "Criadores",       "dxf": f"{DXF_DIR}\\CRIADORES_ESGOTO.dxf"},
    {"nucleo": "Israel",          "dxf": f"{DXF_DIR}\\ISRAEL_ESGOTO.dxf"},
    {"nucleo": "João Carlos",     "dxf": f"{DXF_DIR}\\JOAO_CARLOS_ESGOTO.dxf"},
    {"nucleo": "São Manoel",      "dxf": f"{DXF_DIR}\\SAO_MANOEL_ESGOTO.dxf"},
]


def log(msg, nivel="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    prefix = {"OK": "[OK]  ", "WARN": "[!]   ", "STEP": ">>> ", "ERR": "[ERR] "}.get(nivel, "      ")
    print(f"[{ts}] {prefix}{msg}")


# ═══════════════════════════════════════════════════════════════
# HIDRÁULICA
# ═══════════════════════════════════════════════════════════════
def calc_manning(dn_mm, decl_mm):
    """Manning seção plena. decl_mm = m/m."""
    if not dn_mm or not decl_mm or decl_mm <= 0:
        return {"v_ms": None, "q_ls": None, "tau_pa": None}
    D  = dn_mm / 1000
    A  = math.pi * D**2 / 4
    Rh = D / 4
    I  = decl_mm  # m/m
    V  = (1 / N_MANNING) * Rh**(2/3) * I**0.5
    Q  = V * A * 1000  # l/s
    tau = 1000 * 9.81 * Rh * I  # Pa
    return {"v_ms": round(V, 3), "q_ls": round(Q, 3), "tau_pa": round(tau, 2)}


def enriquecer_trechos(trechos, pvs):
    """Adiciona hidráulica e cotas a cada trecho."""
    for t in trechos:
        pvi = pvs.get(t["pv_ini"], {})
        pvf = pvs.get(t["pv_fim"], {})
        t["ct_ini"]  = t.get("ct_ini")  or pvi.get("ct")
        t["ct_fim"]  = t.get("ct_fim")  or pvf.get("ct")
        t["cf_ini"]  = t.get("cf_ini")  or pvi.get("cf")
        t["cf_fim"]  = t.get("cf_fim")  or pvf.get("cf")
        t["prof_ini"] = t.get("prof_ini") or pvi.get("prof")
        t["prof_fim"] = t.get("prof_fim") or pvf.get("prof")
        hidr = calc_manning(t.get("dn_mm"), t.get("decl_mm"))
        t.update(hidr)
    return trechos


# ═══════════════════════════════════════════════════════════════
# COORDENADAS UTM → LAT/LON
# ═══════════════════════════════════════════════════════════════
_transformer = None
def _get_transformer():
    global _transformer
    if _transformer is None:
        try:
            from pyproj import Transformer
            _transformer = Transformer.from_crs(CRS_EPSG, "EPSG:4326", always_xy=True)
        except:
            _transformer = "FALLBACK"
    return _transformer

def to_ll(x, y):
    tr = _get_transformer()
    if tr != "FALLBACK":
        lon, lat = tr.transform(x, y)
        return lat, lon
    # Fallback aproximado para Santos
    return -23.96 + (y - 7352000) / 111000, -46.33 + (x - 362000) / 95000


# ═══════════════════════════════════════════════════════════════
# GERADOR: PDF A4 (Nota de Serviço de campo)
# ═══════════════════════════════════════════════════════════════
def gerar_ns_a4(ns_id, trecho, pvs, nucleo, out_path):
    pvi_n, pvf_n = trecho["pv_ini"], trecho["pv_fim"]
    pvi, pvf = pvs.get(pvi_n, {}), pvs.get(pvf_n, {})
    dn   = trecho.get("dn_mm", "?")
    ext  = trecho.get("ext_m", 0)
    decl = trecho.get("decl_mm")
    rua  = trecho.get("rua", "Sem Rua")
    hidr = calc_manning(trecho.get("dn_mm"), decl)

    fig, ax = plt.subplots(figsize=(11.69, 8.27))  # A4 landscape
    ax.set_xlim(0, 100); ax.set_ylim(0, 70); ax.axis('off')

    # ── Header ──
    ax.add_patch(FancyBboxPatch((1, 60), 98, 9, boxstyle="round,pad=0.3",
                                 fc="#1a237e", ec="none"))
    ax.text(50, 65, f"NOTA DE SERVIÇO — NS {ns_id:03d}", ha="center",
            va="center", fontsize=18, fontweight="bold", color="white")
    ax.text(50, 61.5, f"SE LIGA NA REDE · {nucleo} · Contrato {CONTRATO}",
            ha="center", va="center", fontsize=9, color="#90caf9")

    # ── Dados do trecho ──
    y = 57
    campos = [
        ("TRECHO",      f"{pvi_n} → {pvf_n}"),
        ("LOGRADOURO",  rua),
        ("DN",          f"{dn} mm"),
        ("EXTENSÃO",    f"{ext:.2f} m"),
        ("MATERIAL",    trecho.get("material", "PVC")),
        ("DECLIVIDADE", f"{decl*1000:.2f} ‰" if decl else "—"),
    ]
    for i, (label, valor) in enumerate(campos):
        col = 5 if i % 2 == 0 else 52
        row = y - (i // 2) * 5
        ax.text(col, row, label, fontsize=7, color="#666", fontweight="bold")
        ax.text(col, row - 2.2, valor, fontsize=11, color="#111")

    # ── Cotas ──
    y = 38
    ax.add_patch(FancyBboxPatch((1, y-1), 98, 7, boxstyle="round,pad=0.2",
                                 fc="#e3f2fd", ec="#90caf9", lw=0.5))
    ax.text(5,  y+3.5, "PV MONTANTE", fontsize=7, color="#1565c0", fontweight="bold")
    ax.text(5,  y+1,   f"CT = {pvi.get('ct','—')}m   CF = {pvi.get('cf','—')}m   "
                        f"Prof = {pvi.get('prof','—')}m", fontsize=9)
    ax.text(52, y+3.5, "PV JUSANTE", fontsize=7, color="#1565c0", fontweight="bold")
    ax.text(52, y+1,   f"CT = {pvf.get('ct','—')}m   CF = {pvf.get('cf','—')}m   "
                        f"Prof = {pvf.get('prof','—')}m", fontsize=9)

    # ── Hidráulica ──
    y = 28
    ax.add_patch(FancyBboxPatch((1, y-1), 98, 7, boxstyle="round,pad=0.2",
                                 fc="#e8f5e9", ec="#81c784", lw=0.5))
    ax.text(5, y+3.5, "HIDRÁULICA (Manning)", fontsize=7, color="#2e7d32", fontweight="bold")
    v_txt = f"{hidr['v_ms']:.3f} m/s" if hidr['v_ms'] else "—"
    q_txt = f"{hidr['q_ls']:.2f} l/s" if hidr['q_ls'] else "—"
    t_txt = f"{hidr['tau_pa']:.2f} Pa" if hidr['tau_pa'] else "—"
    ax.text(5, y+1, f"V = {v_txt}   Q = {q_txt}   τ = {t_txt}   n = {N_MANNING}", fontsize=9)

    # Validação rápida
    alertas = []
    if hidr['v_ms'] and hidr['v_ms'] < 0.6: alertas.append("V < 0.6 m/s")
    if hidr['tau_pa'] and hidr['tau_pa'] < 1.0: alertas.append("τ < 1.0 Pa")
    if pvi.get("prof") and pvi["prof"] < 0.60: alertas.append(f"Prof mont {pvi['prof']}m < 0.60m")
    if alertas:
        ax.text(5, y-4, "⚠ " + " | ".join(alertas), fontsize=8, color="#c62828", fontweight="bold")

    # ── Perfil simplificado ──
    ct_i = pvi.get("ct", 0) or 0
    ct_f = pvf.get("ct", 0) or 0
    cf_i = pvi.get("cf", 0) or 0
    cf_f = pvf.get("cf", 0) or 0

    if ct_i and ct_f:
        y_base = 10
        all_cotas = [c for c in [ct_i, ct_f, cf_i, cf_f] if c]
        c_min, c_max = min(all_cotas) - 0.5, max(all_cotas) + 0.5
        c_range = max(c_max - c_min, 1)
        cy = lambda cota: y_base + (cota - c_min) / c_range * 12

        ax.plot([15, 85], [cy(ct_i), cy(ct_f)], 'k-', lw=1.5)
        ax.plot([15, 85], [cy(cf_i), cy(cf_f)], 'b-', lw=2)
        ax.plot([15, 15], [cy(cf_i), cy(ct_i)], 'k-', lw=1)
        ax.plot([85, 85], [cy(cf_f), cy(ct_f)], 'k-', lw=1)
        ax.text(15, cy(ct_i)+1,   f"CT={ct_i:.3f}", fontsize=6, ha="center")
        ax.text(15, cy(cf_i)-1.5, f"CF={cf_i:.3f}", fontsize=6, ha="center", color="blue")
        ax.text(85, cy(ct_f)+1,   f"CT={ct_f:.3f}", fontsize=6, ha="center")
        ax.text(85, cy(cf_f)-1.5, f"CF={cf_f:.3f}", fontsize=6, ha="center", color="blue")
        ax.text(50, cy((cf_i+cf_f)/2)-2, f"DN{dn} · {ext:.1f}m",
                fontsize=8, ha="center", color="blue", fontweight="bold")

    # ── Footer ──
    ax.text(50, 2, f"Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')} · "
            f"ConstruData - HydroNetwork · Motor GDAL/OGR",
            ha="center", fontsize=6, color="#999")

    fig.savefig(str(out_path), dpi=150, bbox_inches="tight", pad_inches=0.3)
    plt.close(fig)


# ═══════════════════════════════════════════════════════════════
# GERADOR: PDF A3 (Desenho — planta com satélite + perfil)
# ═══════════════════════════════════════════════════════════════
def gerar_ns_desenho(ns_id, trecho, pvs, all_trechos, nucleo, out_path):
    pvi_n, pvf_n = trecho["pv_ini"], trecho["pv_fim"]
    pvi, pvf = pvs.get(pvi_n, {}), pvs.get(pvf_n, {})

    fig, (ax_planta, ax_perfil) = plt.subplots(1, 2, figsize=(16.54, 11.69))

    # ═══ PLANTA ═══
    ax_planta.set_title(f"PLANTA — NS {ns_id:03d} · {nucleo}", fontsize=10, fontweight="bold")
    ax_planta.set_aspect("equal")

    # Zoom no trecho ANTES de adicionar satélite
    if pvi.get("x") and pvf.get("x"):
        cx = (pvi["x"] + pvf["x"]) / 2
        cy = (pvi["y"] + pvf["y"]) / 2
        pad = max(math.hypot(pvf["x"]-pvi["x"], pvf["y"]-pvi["y"]) * 2, 80)
        ax_planta.set_xlim(cx - pad, cx + pad)
        ax_planta.set_ylim(cy - pad, cy + pad)

        # Satélite (contextily)
        try:
            import contextily as ctx
            for _zoom in [18, 17, 16]:
                try:
                    ctx.add_basemap(ax_planta, crs=CRS_EPSG,
                                    source=ctx.providers.Esri.WorldImagery,
                                    zoom=_zoom, attribution="", attribution_size=4)
                    ax_planta.set_facecolor("black")
                    break
                except:
                    continue
        except:
            pass

    # Rede inteira (cinza) + trecho atual (vermelho)
    for t in all_trechos:
        p0 = pvs.get(t["pv_ini"], {})
        p1 = pvs.get(t["pv_fim"], {})
        if p0.get("x") and p1.get("x"):
            is_cur = (t["pv_ini"] == trecho["pv_ini"] and t["pv_fim"] == trecho["pv_fim"])
            color  = "red" if is_cur else "#cccccc"
            lw     = 2.5 if is_cur else 0.5
            zorder = 10 if is_cur else 1
            ax_planta.plot([p0["x"], p1["x"]], [p0["y"], p1["y"]],
                          color=color, lw=lw, zorder=zorder)

    # PVs
    for nome, pv in pvs.items():
        if pv.get("x"):
            is_cur = nome in (pvi_n, pvf_n)
            color  = "red" if is_cur else "#3388ff"
            size   = 7 if is_cur else 2
            ax_planta.plot(pv["x"], pv["y"], "o", color=color, markersize=size, zorder=20)
            if is_cur:
                ax_planta.annotate(nome, (pv["x"], pv["y"]), fontsize=6,
                                   fontweight="bold", color="white" if ax_planta.get_facecolor()[:3] == (0,0,0) else "red",
                                   xytext=(5, 5), textcoords="offset points")

    ax_planta.set_xlabel("E (m)", fontsize=7)
    ax_planta.set_ylabel("N (m)", fontsize=7)
    ax_planta.tick_params(labelsize=6)

    # ═══ PERFIL ═══
    ax_perfil.set_title(f"PERFIL LONGITUDINAL — NS {ns_id:03d}", fontsize=10, fontweight="bold")

    ct_i = pvi.get("ct", 0) or 0
    ct_f = pvf.get("ct", 0) or 0
    cf_i = pvi.get("cf", 0) or 0
    cf_f = pvf.get("cf", 0) or 0
    ext  = trecho.get("ext_m", 1)

    if ct_i and ct_f:
        x = [0, ext]
        ax_perfil.fill_between(x, [ct_i, ct_f], [max(ct_i, ct_f)+0.5]*2,
                               color="#d4a373", alpha=0.3, label="Terreno")
        ax_perfil.plot(x, [ct_i, ct_f], "k-", lw=1.5)
        ax_perfil.plot(x, [cf_i, cf_f], "b-", lw=2.5, label="Geratriz inferior")

        for xp, ct, cf, nome in [(0, ct_i, cf_i, pvi_n), (ext, ct_f, cf_f, pvf_n)]:
            ax_perfil.plot([xp, xp], [cf, ct], "k-", lw=2)
            ax_perfil.plot(xp, ct, "ks", markersize=6)
            ax_perfil.plot(xp, cf, "bs", markersize=6)
            ax_perfil.text(xp, ct + 0.1, f"CT={ct:.3f}", fontsize=7, ha="center")
            ax_perfil.text(xp, cf - 0.15, f"CF={cf:.3f}", fontsize=7, ha="center", color="blue")
            ax_perfil.text(xp, ct + 0.25, nome, fontsize=8, ha="center", fontweight="bold")

        ax_perfil.text(ext/2, (cf_i+cf_f)/2 - 0.1,
                      f"DN{trecho.get('dn_mm','?')} PVC · {ext:.1f}m",
                      fontsize=9, ha="center", color="blue", fontweight="bold")
        ax_perfil.legend(fontsize=7)

    ax_perfil.set_xlabel("Distância (m)", fontsize=8)
    ax_perfil.set_ylabel("Cota (m)", fontsize=8)
    ax_perfil.tick_params(labelsize=7)
    ax_perfil.grid(True, alpha=0.3)

    fig.tight_layout()
    fig.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close(fig)


# ═══════════════════════════════════════════════════════════════
# GERADOR: HTML Leaflet (mapa satélite interativo + dados)
# ═══════════════════════════════════════════════════════════════
def gerar_html(ns_id, trecho, pvs, all_trechos, nucleo, out_path):
    pvi_n, pvf_n = trecho["pv_ini"], trecho["pv_fim"]
    pvi, pvf = pvs.get(pvi_n, {}), pvs.get(pvf_n, {})
    hidr = calc_manning(trecho.get("dn_mm"), trecho.get("decl_mm"))

    lines_js, pvs_js = [], []
    for t in all_trechos:
        p0, p1 = pvs.get(t["pv_ini"], {}), pvs.get(t["pv_fim"], {})
        if p0.get("x") and p1.get("x"):
            ll0, ll1 = to_ll(p0["x"], p0["y"]), to_ll(p1["x"], p1["y"])
            is_cur = (t["pv_ini"] == trecho["pv_ini"] and t["pv_fim"] == trecho["pv_fim"])
            color  = "red" if is_cur else "#3388ff"
            weight = 4 if is_cur else 2
            popup  = f'{t["pv_ini"]}→{t["pv_fim"]} DN{t.get("dn_mm","?")} {t["ext_m"]}m'
            lines_js.append(
                f'L.polyline([[{ll0[0]},{ll0[1]}],[{ll1[0]},{ll1[1]}]],'
                f'{{color:"{color}",weight:{weight}}}).addTo(map)'
                f'.bindPopup("{popup}");')

    for nome, pv in pvs.items():
        if pv.get("x"):
            ll = to_ll(pv["x"], pv["y"])
            is_cur = nome in (pvi_n, pvf_n)
            r, color = (6, "red") if is_cur else (3, "#3388ff")
            popup = f'{nome}<br>CT={pv.get("ct","—")}<br>CF={pv.get("cf","—")}'
            pvs_js.append(
                f'L.circleMarker([{ll[0]},{ll[1]}],{{radius:{r},color:"{color}",'
                f'fillOpacity:0.8}}).addTo(map).bindPopup("{popup}");')

    center = to_ll((pvi.get("x",0)+pvf.get("x",0))/2,
                   (pvi.get("y",0)+pvf.get("y",0))/2)

    titulo = f"NS {ns_id:03d} · {pvi_n} → {pvf_n}" if ns_id > 0 else f"REDE GERAL · {nucleo}"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{titulo}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9/dist/leaflet.js"></script>
<style>
body{{font-family:Arial;margin:0;background:#1a1a2e;color:#eee}}
#map{{height:55vh;width:100%}}
.info{{padding:15px;margin:10px}}
.card{{background:#16213e;border-radius:8px;padding:15px;margin:8px 0}}
h1{{color:#e94560;margin:10px 15px}}
</style></head><body>
<h1>{titulo}</h1>
<div id="map"></div>
<div class="info">
<div class="card">
<b>TRECHO:</b> {pvi_n} → {pvf_n} | DN {trecho.get("dn_mm","?")}mm |
{trecho["ext_m"]:.1f}m | {trecho.get("rua","Sem Rua")}<br>
<b>DECLIVIDADE:</b> {(trecho.get("decl_mm",0) or 0)*1000:.2f}‰ |
<b>V:</b> {hidr["v_ms"] or "—"} m/s |
<b>Q:</b> {hidr["q_ls"] or "—"} l/s |
<b>τ:</b> {hidr["tau_pa"] or "—"} Pa
</div>
<div class="card">
<b>{pvi_n}:</b> CT={pvi.get("ct","—")} CF={pvi.get("cf","—")} Prof={pvi.get("prof","—")}m<br>
<b>{pvf_n}:</b> CT={pvf.get("ct","—")} CF={pvf.get("cf","—")} Prof={pvf.get("prof","—")}m
</div>
</div>
<script>
var map=L.map('map').setView([{center[0]},{center[1]}],{17 if ns_id == 0 else 18});
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{{z}}/{{y}}/{{x}}',
{{attribution:'Esri',maxZoom:20}}).addTo(map);
{chr(10).join(lines_js)}
{chr(10).join(pvs_js)}
</script></body></html>"""

    with open(str(out_path), "w", encoding="utf-8") as f:
        f.write(html)


# ═══════════════════════════════════════════════════════════════
# GERADOR: GeoJSON
# ═══════════════════════════════════════════════════════════════
def gerar_geojson(trechos, pvs, out_path):
    features = []
    for t in trechos:
        p0, p1 = pvs.get(t["pv_ini"], {}), pvs.get(t["pv_fim"], {})
        if p0.get("x") and p1.get("x"):
            props = {k: v for k, v in t.items() if k != "layer"}
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString",
                             "coordinates": [[p0["x"], p0["y"]], [p1["x"], p1["y"]]]},
                "properties": props
            })
    geojson = {"type": "FeatureCollection", "features": features,
               "crs": {"type": "name", "properties": {"name": CRS_EPSG}}}
    with open(str(out_path), "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2, ensure_ascii=False)
    return len(features)


# ═══════════════════════════════════════════════════════════════
# PIPELINE PRINCIPAL
# ═══════════════════════════════════════════════════════════════
def processar_nucleo(dxf_path, nucleo, out_base):
    """Processa um DXF/DWG e gera todas as NS."""
    log(f"NÚCLEO: {nucleo}", "STEP")

    # Fallback DWG -> DXF: GDAL não lê DWG binário.
    # Se recebermos .dwg, procura .dxf no mesmo diretório.
    dxf_path = str(dxf_path)
    if dxf_path.lower().endswith(".dwg"):
        dxf_candidato = dxf_path[:-4] + ".dxf"
        if os.path.exists(dxf_candidato):
            log(f"  DWG detectado -> usando DXF correspondente: {os.path.basename(dxf_candidato)}", "WARN")
            dxf_path = dxf_candidato
        else:
            log(f"  DWG sem DXF par na mesma pasta: {dxf_path}", "ERR")
            log(f"  Exporte o DWG para DXF no AutoCAD/QGIS e tente novamente.", "ERR")
            return 0, 0

    log(f"  DXF: {dxf_path}", "INFO")

    if not os.path.exists(dxf_path):
        log(f"  DXF não encontrado: {dxf_path}", "ERR")
        return 0, 0

    # ── 1. Leitura ──
    pvs, trechos, ruas, meta = ler_dxf_gdal(dxf_path)
    if not trechos:
        log("  Sem trechos!", "ERR")
        return 0, 0

    trechos = enriquecer_trechos(trechos, pvs)
    log(f"  Rede: {meta['n_pvs']} PVs, {meta['n_trechos']} trechos", "OK")

    # ── 2. Pastas ──
    out = Path(out_base) / nucleo.upper().replace(" ", "_")
    (out / "01_NS_CAMPO").mkdir(parents=True, exist_ok=True)
    (out / "03_DESENHOS").mkdir(parents=True, exist_ok=True)
    (out / "04_HTML").mkdir(parents=True, exist_ok=True)
    (out / "05_GIS").mkdir(parents=True, exist_ok=True)
    (out / "07_LOG").mkdir(parents=True, exist_ok=True)

    # ── 3. Gerar NS ──
    n_ok, n_err = 0, 0
    import concurrent.futures

    def _trabalhar_ns(ns_id, t):
        ns_name = f"NS_{ns_id:03d}_{t['pv_ini']}_AO_{t['pv_fim']}"
        ns_dir = out / "01_NS_CAMPO" / ns_name
        ns_dir.mkdir(parents=True, exist_ok=True)
        try:
            gerar_ns_a4(ns_id, t, pvs, nucleo, ns_dir / f"NS_{ns_id:03d}_A4.pdf")
            dados = {
                "ns_id": ns_id, "nucleo": nucleo, "contrato": CONTRATO,
                "trecho": {k: v for k, v in t.items()},
                "pv_montante": pvs.get(t["pv_ini"], {}),
                "pv_jusante":  pvs.get(t["pv_fim"], {}),
                "hidraulica": calc_manning(t.get("dn_mm"), t.get("decl_mm")),
                "gerado_em": datetime.now().isoformat(),
            }
            with open(ns_dir / f"NS_{ns_id:03d}_DADOS.json", "w", encoding="utf-8") as f:
                json.dump(dados, f, indent=2, ensure_ascii=False)
            gerar_ns_desenho(ns_id, t, pvs, trechos, nucleo,
                             out / "03_DESENHOS" / f"NS_{ns_id:03d}_DESENHO.pdf")
            gerar_html(ns_id, t, pvs, trechos, nucleo,
                       out / "04_HTML" / f"NS_{ns_id:03d}.html")
            return (ns_id, True, t, "")
        except Exception as e:
            return (ns_id, False, t, traceback.format_exc())

    with concurrent.futures.ThreadPoolExecutor() as executor:
        futs = [executor.submit(_trabalhar_ns, i+1, t) for i, t in enumerate(trechos)]
        for f in concurrent.futures.as_completed(futs):
            ns_id, sucesso, t, erro = f.result()
            if sucesso:
                n_ok += 1
                if ns_id <= 3 or ns_id % 25 == 0:
                    log(f"  NS {ns_id:03d}: {t['pv_ini']}→{t['pv_fim']} "
                        f"DN{t.get('dn_mm')} {t['ext_m']}m ✓", "OK")
            else:
                n_err += 1
                log(f"  NS {ns_id:03d}: ERRO \n{erro}", "ERR")

    # ── 4. REDE_GERAL.html ──
    gerar_html(0, trechos[0], pvs, trechos, nucleo,
               out / "04_HTML" / "REDE_GERAL.html")

    # ── 5. GeoJSON ──
    n_feat = gerar_geojson(trechos, pvs, out / "05_GIS" / "rede_definida.geojson")
    log(f"  GeoJSON: {n_feat} features", "OK")

    # ── 6. Log JSON ──
    log_data = {
        "nucleo": nucleo, "dxf": str(dxf_path),
        "n_pvs": meta["n_pvs"], "n_trechos": meta["n_trechos"],
        "n_ns_geradas": n_ok, "n_ns_erros": n_err,
        "motor": meta.get("motor", "GDAL/OGR+Cluster"),
        "extensao_m": round(sum(t["ext_m"] for t in trechos), 1),
        "dns": dict(Counter(t.get("dn_mm") for t in trechos if t.get("dn_mm"))),
        "gerado_em": datetime.now().isoformat(),
    }
    with open(out / "07_LOG" / "log_processamento.json", "w", encoding="utf-8") as f:
        json.dump(log_data, f, indent=2, ensure_ascii=False)

    log(f"  RESULTADO: {n_ok} NS geradas, {n_err} erros", "OK")
    return n_ok, n_err


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print("ConstruData - HydroNetwork — Gerador de Notas de Serviço")
    print("SE LIGA NA REDE · Contrato 11481051")
    print("Motor: GDAL/OGR + Cluster de endpoints")
    print("=" * 60)

    if len(sys.argv) >= 2:
        # Modo: DXF individual
        dxf = sys.argv[1]
        nucleo = Path(dxf).stem.replace("_ESGOTO", "").replace("_", " ").title()
        out = sys.argv[2] if len(sys.argv) >= 3 else str(Path(dxf).parent / "SAIDA_NS")
        n_ok, n_err = processar_nucleo(dxf, nucleo, out)
    else:
        # Modo: batch
        total_ok, total_err = 0, 0
        for item in NUCLEOS_BATCH:
            if os.path.exists(item["dxf"]):
                n_ok, n_err = processar_nucleo(item["dxf"], item["nucleo"], OUT_DIR)
                total_ok += n_ok; total_err += n_err
            else:
                log(f"DXF não encontrado: {item['dxf']}", "WARN")

        print(f"\n{'='*60}")
        print(f"TOTAL: {total_ok} NS geradas, {total_err} erros")
        print(f"Pasta: {OUT_DIR}")
        print(f"{'='*60}")
