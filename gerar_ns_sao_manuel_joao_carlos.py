#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GERAR NOTAS DE SERVIÇO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA
Arquivo DWG: ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA.dwg
Contrato 11481051 - SE LIGA NA REDE
"""
import sys
import os
import json
import math
from pathlib import Path
from datetime import datetime
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Adicionar scripts ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

from ler_dwg_aec import ler_dwg_aec
from gerar_ns import adicionar_base_cartografica, enriquecer_trechos, calc_manning, to_ll, gerar_geojson

# ═══════════════════════════════════════════════════════════════
# CONFIGURAÇÕES
# ═══════════════════════════════════════════════════════════════
# Arquivos DWG para processar
DWG_FILES = [
    (r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\SÃO MANOEL\SÃO_MANOEL_ESGOTO.dwg", "São Manoel"),
    (r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\JOÃO CARLOS\JOÃO_CARLOS_ESGOTO.dwg", "João Carlos"),
]

OUT_BASE = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\NOTAS DE SERVICO COMPLETAS 24-03-2026"

CONTRATO = "11481051"
N_MANNING = 0.013
CRS_EPSG = "EPSG:31983"


def gerar_ns_a4(ns_id, trecho, pvs, nucleo, out_path):
    """PDF A4 - Nota de Serviço de campo"""
    pvi_n, pvf_n = trecho["pv_ini"], trecho["pv_fim"]
    pvi, pvf = pvs.get(pvi_n, {}), pvs.get(pvf_n, {})
    dn = trecho.get("dn_mm", "?")
    ext = trecho.get("ext_m", 0)
    decl = trecho.get("decl_mm")
    rua = trecho.get("rua", "Sem Rua")
    hidr = calc_manning(trecho.get("dn_mm"), decl)

    fig, ax = plt.subplots(figsize=(11.69, 8.27))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 70)
    ax.axis("off")

    # Header
    ax.add_patch(
        FancyBboxPatch(
            (1, 60), 98, 9, boxstyle="round,pad=0.3", fc="#1a237e", ec="none"
        )
    )
    ax.text(
        50,
        65,
        f"NOTA DE SERVIÇO — NS {ns_id:03d}",
        ha="center",
        va="center",
        fontsize=18,
        fontweight="bold",
        color="white",
    )
    ax.text(
        50,
        61.5,
        f"SE LIGA NA REDE · {nucleo} · Contrato {CONTRATO}",
        ha="center",
        va="center",
        fontsize=9,
        color="#90caf9",
    )

    # Dados do trecho
    y = 57
    campos = [
        ("TRECHO", f"{pvi_n} → {pvf_n}"),
        ("LOGRADOURO", rua),
        ("DN", f"{dn} mm"),
        ("EXTENSÃO", f"{ext:.2f} m"),
        ("MATERIAL", trecho.get("material", "PVC")),
        ("DECLIVIDADE", f"{decl * 1000:.2f} ‰" if decl else "—"),
    ]
    for i, (label, valor) in enumerate(campos):
        col = 5 if i % 2 == 0 else 52
        row = y - (i // 2) * 5
        ax.text(col, row, label, fontsize=7, color="#666", fontweight="bold")
        ax.text(col, row - 2.2, valor, fontsize=11, color="#111")

    # Cotas
    y = 38
    ax.add_patch(
        FancyBboxPatch(
            (1, y - 1), 98, 7, boxstyle="round,pad=0.2", fc="#e3f2fd", ec="#90caf9", lw=0.5
        )
    )
    ax.text(5, y + 3.5, "PV MONTANTE", fontsize=7, color="#1565c0", fontweight="bold")
    ax.text(
        5,
        y + 1,
        f"CT = {pvi.get('ct', '—')}m   CF = {pvi.get('cf', '—')}m   Prof = {pvi.get('prof', '—')}m",
        fontsize=9,
    )
    ax.text(52, y + 3.5, "PV JUSANTE", fontsize=7, color="#1565c0", fontweight="bold")
    ax.text(
        52,
        y + 1,
        f"CT = {pvf.get('ct', '—')}m   CF = {pvf.get('cf', '—')}m   Prof = {pvf.get('prof', '—')}m",
        fontsize=9,
    )

    # Hidráulica
    y = 28
    ax.add_patch(
        FancyBboxPatch(
            (1, y - 1), 98, 7, boxstyle="round,pad=0.2", fc="#e8f5e9", ec="#81c784", lw=0.5
        )
    )
    ax.text(
        5, y + 3.5, "HIDRÁULICA (Manning)", fontsize=7, color="#2e7d32", fontweight="bold"
    )
    v_txt = f"{hidr['v_ms']:.3f} m/s" if hidr["v_ms"] else "—"
    q_txt = f"{hidr['q_ls']:.2f} l/s" if hidr["q_ls"] else "—"
    t_txt = f"{hidr['tau_pa']:.2f} Pa" if hidr["tau_pa"] else "—"
    ax.text(
        5, y + 1, f"V = {v_txt}   Q = {q_txt}   τ = {t_txt}   n = {N_MANNING}", fontsize=9
    )

    # Validação
    alertas = []
    if hidr["v_ms"] and hidr["v_ms"] < 0.6:
        alertas.append("V < 0.6 m/s")
    if hidr["tau_pa"] and hidr["tau_pa"] < 1.0:
        alertas.append("τ < 1.0 Pa")
    if pvi.get("prof") and pvi["prof"] < 0.60:
        alertas.append(f"Prof mont {pvi['prof']}m < 0.60m")
    if alertas:
        ax.text(
            5, y - 4, "⚠ " + " | ".join(alertas), fontsize=8, color="#c62828", fontweight="bold"
        )

    # Perfil
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

        ax.plot([15, 85], [cy(ct_i), cy(ct_f)], "k-", lw=1.5)
        ax.plot([15, 85], [cy(cf_i), cy(cf_f)], "b-", lw=2)
        ax.plot([15, 15], [cy(cf_i), cy(ct_i)], "k-", lw=1)
        ax.plot([85, 85], [cy(cf_f), cy(ct_f)], "k-", lw=1)
        ax.text(15, cy(ct_i) + 1, f"CT={ct_i:.3f}", fontsize=6, ha="center")
        ax.text(15, cy(cf_i) - 1.5, f"CF={cf_i:.3f}", fontsize=6, ha="center", color="blue")
        ax.text(85, cy(ct_f) + 1, f"CT={ct_f:.3f}", fontsize=6, ha="center")
        ax.text(85, cy(cf_f) - 1.5, f"CF={cf_f:.3f}", fontsize=6, ha="center", color="blue")
        ax.text(
            50,
            cy((cf_i + cf_f) / 2) - 2,
            f"DN{dn} · {ext:.1f}m",
            fontsize=8,
            ha="center",
            color="blue",
            fontweight="bold",
        )

    # Footer
    ax.text(
        50,
        2,
        f"Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')} · ConstruData - HydroNetwork",
        ha="center",
        fontsize=6,
        color="#999",
    )

    fig.savefig(str(out_path), dpi=150, bbox_inches="tight", pad_inches=0.3)
    plt.close(fig)


def gerar_ns_desenho(ns_id, trecho, pvs, all_trechos, nucleo, out_path):
    """PDF A3 - Planta com satélite + perfil"""
    pvi_n, pvf_n = trecho["pv_ini"], trecho["pv_fim"]
    pvi, pvf = pvs.get(pvi_n, {}), pvs.get(pvf_n, {})

    fig, (ax_planta, ax_perfil) = plt.subplots(1, 2, figsize=(16.54, 11.69))

    # PLANTA
    ax_planta.set_title(f"PLANTA — NS {ns_id:03d} · {nucleo}", fontsize=10, fontweight="bold")
    ax_planta.set_aspect("equal")

    if pvi.get("x") and pvf.get("x"):
        cx = (pvi["x"] + pvf["x"]) / 2
        cy = (pvi["y"] + pvf["y"]) / 2
        pad = max(math.hypot(pvf["x"] - pvi["x"], pvf["y"] - pvi["y"]) * 2, 80)
        ax_planta.set_xlim(cx - pad, cx + pad)
        ax_planta.set_ylim(cy - pad, cy + pad)

        # Cartografia
        try:
            import contextily as ctx

            for _zoom in [18, 17, 16]:
                try:
                    ctx.add_basemap(
                        ax_planta,
                        crs=CRS_EPSG,
                        source=ctx.providers.CartoDB.Positron,
                        zoom=_zoom,
                        attribution="",
                        attribution_size=4,
                    )
                    ax_planta.set_facecolor("black")
                    break
                except:
                    continue
        except:
            pass

    # Rede
    for t in all_trechos:
        p0, p1 = pvs.get(t["pv_ini"], {}), pvs.get(t["pv_fim"], {})
        if p0.get("x") and p1.get("x"):
            is_cur = t["pv_ini"] == trecho["pv_ini"] and t["pv_fim"] == trecho["pv_fim"]
            color = "red" if is_cur else "#cccccc"
            lw = 2.5 if is_cur else 0.5
            zorder = 10 if is_cur else 1
            ax_planta.plot(
                [p0["x"], p1["x"]], [p0["y"], p1["y"]], color=color, lw=lw, zorder=zorder
            )

    # PVs
    for nome, pv in pvs.items():
        if pv.get("x"):
            is_cur = nome in (pvi_n, pvf_n)
            color = "red" if is_cur else "#3388ff"
            size = 7 if is_cur else 2
            ax_planta.plot(pv["x"], pv["y"], "o", color=color, markersize=size, zorder=20)
            if is_cur:
                ax_planta.annotate(
                    nome,
                    (pv["x"], pv["y"]),
                    fontsize=6,
                    fontweight="bold",
                    color="white" if ax_planta.get_facecolor()[:3] == (0, 0, 0) else "red",
                    xytext=(5, 5),
                    textcoords="offset points",
                )

    ax_planta.set_xlabel("E (m)", fontsize=7)
    ax_planta.set_ylabel("N (m)", fontsize=7)
    ax_planta.tick_params(labelsize=6)

    # PERFIL
    ax_perfil.set_title(f"PERFIL LONGITUDINAL — NS {ns_id:03d}", fontsize=10, fontweight="bold")

    ct_i = pvi.get("ct", 0) or 0
    ct_f = pvf.get("ct", 0) or 0
    cf_i = pvi.get("cf", 0) or 0
    cf_f = pvf.get("cf", 0) or 0
    ext = trecho.get("ext_m", 1)

    if ct_i and ct_f:
        x = [0, ext]
        ax_perfil.fill_between(
            x, [ct_i, ct_f], [max(ct_i, ct_f) + 0.5] * 2, color="#d4a373", alpha=0.3, label="Terreno"
        )
        ax_perfil.plot(x, [ct_i, ct_f], "k-", lw=1.5)
        ax_perfil.plot(x, [cf_i, cf_f], "b-", lw=2.5, label="Geratriz inferior")

        for xp, ct, cf, nome in [
            (0, ct_i, cf_i, pvi_n),
            (ext, ct_f, cf_f, pvf_n),
        ]:
            ax_perfil.plot([xp, xp], [cf, ct], "k-", lw=2)
            ax_perfil.plot(xp, ct, "ks", markersize=6)
            ax_perfil.plot(xp, cf, "bs", markersize=6)
            ax_perfil.text(xp, ct + 0.1, f"CT={ct:.3f}", fontsize=7, ha="center")
            ax_perfil.text(xp, cf - 0.15, f"CF={cf:.3f}", fontsize=7, ha="center", color="blue")
            ax_perfil.text(xp, ct + 0.25, nome, fontsize=8, ha="center", fontweight="bold")

        ax_perfil.text(
            ext / 2,
            (cf_i + cf_f) / 2 - 0.1,
            f"DN{trecho.get('dn_mm', '?')} PVC · {ext:.1f}m",
            fontsize=9,
            ha="center",
            color="blue",
            fontweight="bold",
        )
        ax_perfil.legend(fontsize=7)

    ax_perfil.set_xlabel("Distância (m)", fontsize=8)
    ax_perfil.set_ylabel("Cota (m)", fontsize=8)
    ax_perfil.tick_params(labelsize=7)
    ax_perfil.grid(True, alpha=0.3)

    fig.tight_layout()
    fig.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close(fig)


def gerar_ns_satelite(ns_id, trecho, pvs, nucleo, out_path):
    """PDF cartografico + rede projetada + perfil"""
    pvi_n, pvf_n = trecho["pv_ini"], trecho["pv_fim"]
    pvi, pvf = pvs.get(pvi_n, {}), pvs.get(pvf_n, {})
    ext = trecho.get("ext_m", 1)
    dn = trecho.get("dn_mm") or 200

    fig, ax = plt.subplots(figsize=(16.54, 11.69))
    ax.set_aspect("equal")

    if pvi.get("x") and pvf.get("x"):
        cx = (pvi["x"] + pvf["x"]) / 2
        cy = (pvi["y"] + pvf["y"]) / 2
        pad = max(math.hypot(pvf["x"] - pvi["x"], pvf["y"] - pvi["y"]) * 2, 80)
        ax.set_xlim(cx - pad, cx + pad)
        ax.set_ylim(cy - pad, cy + pad)

        # Cartografia
        try:
            import contextily as ctx

            ctx.add_basemap(
                ax,
                crs=CRS_EPSG,
                source=ctx.providers.CartoDB.Positron,
                zoom=18,
                attribution="",
            )
        except:
            ax.set_facecolor("#f0f0f0")

        # Trecho
        ax.plot([pvi["x"], pvf["x"]], [pvi["y"], pvf["y"]], "r-", linewidth=3, zorder=10)
        ax.plot(pvi["x"], pvi["y"], "ro", markersize=10, zorder=11)
        ax.plot(pvf["x"], pvf["y"], "ro", markersize=10, zorder=11)
        ax.annotate(
            pvi_n, (pvi["x"], pvi["y"]), fontsize=9, color="red", fontweight="bold",
            xytext=(0, 12), textcoords="offset points",
            bbox=dict(facecolor="white", alpha=0.8),
        )
        ax.annotate(
            pvf_n, (pvf["x"], pvf["y"]), fontsize=9, color="red", fontweight="bold",
            xytext=(0, 12), textcoords="offset points",
            bbox=dict(facecolor="white", alpha=0.8),
        )

    ax.set_title(f"PLANTA CARTOGRAFICA - NS {ns_id:03d} · {nucleo}", fontsize=12, fontweight="bold")
    ax.axis("off")

    fig.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close(fig)


def gerar_html(ns_id, trecho, pvs, all_trechos, nucleo, out_path):
    """HTML Leaflet - Mapa interativo"""
    pvi_n, pvf_n = trecho["pv_ini"], trecho["pv_fim"]
    pvi, pvf = pvs.get(pvi_n, {}), pvs.get(pvf_n, {})
    hidr = calc_manning(trecho.get("dn_mm"), trecho.get("decl_mm"))

    lines_js, pvs_js = [], []
    for t in all_trechos:
        p0, p1 = pvs.get(t["pv_ini"], {}), pvs.get(t["pv_fim"], {})
        if p0.get("x") and p1.get("x"):
            ll0, ll1 = to_ll(p0["x"], p0["y"]), to_ll(p1["x"], p1["y"])
            is_cur = t["pv_ini"] == trecho["pv_ini"] and t["pv_fim"] == trecho["pv_fim"]
            color = "red" if is_cur else "#3388ff"
            weight = 4 if is_cur else 2
            popup = f'{t["pv_ini"]}→{t["pv_fim"]} DN{t.get("dn_mm", "?")} {t["ext_m"]}m'
            lines_js.append(
                f'L.polyline([[{ll0[0]},{ll0[1]}],[{ll1[0]},{ll1[1]}]],'
                f'{{color:"{color}",weight:{weight}}}).addTo(map)'
                f'.bindPopup("{popup}");'
            )

    for nome, pv in pvs.items():
        if pv.get("x"):
            ll = to_ll(pv["x"], pv["y"])
            is_cur = nome in (pvi_n, pvf_n)
            r, color = (6, "red") if is_cur else (3, "#3388ff")
            popup = f'{nome}<br>CT={pv.get("ct", "—")}<br>CF={pv.get("cf", "—")}'
            pvs_js.append(
                f'L.circleMarker([{ll[0]},{ll[1]}],{{radius:{r},color:"{color}",'
                f'fillOpacity:0.8}}).addTo(map).bindPopup("{popup}");'
            )

    center = to_ll((pvi.get("x", 0) + pvf.get("x", 0)) / 2, (pvi.get("y", 0) + pvf.get("y", 0)) / 2)
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
<b>TRECHO:</b> {pvi_n} → {pvf_n} | DN {trecho.get("dn_mm", "?")}mm |
{trecho["ext_m"]:.1f}m | {trecho.get("rua", "Sem Rua")}<br>
<b>DECLIVIDADE:</b> {(trecho.get("decl_mm", 0) or 0)*1000:.2f}‰ |
<b>V:</b> {hidr["v_ms"] or "—"} m/s |
<b>Q:</b> {hidr["q_ls"] or "—"} l/s |
<b>τ:</b> {hidr["tau_pa"] or "—"} Pa
</div>
<div class="card">
<b>{pvi_n}:</b> CT={pvi.get("ct", "—")} CF={pvi.get("cf", "—")} Prof={pvi.get("prof", "—")}m<br>
<b>{pvf_n}:</b> CT={pvf.get("ct", "—")} CF={pvf.get("cf", "—")} Prof={pvf.get("prof", "—")}m
</div>
</div>
<script>
var map=L.map('map').setView([{center[0]},{center[1]}],{17 if ns_id == 0 else 18});
L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png',
{{attribution:'OpenStreetMap',maxZoom:20}}).addTo(map);
{chr(10).join(lines_js)}
{chr(10).join(pvs_js)}
</script></body></html>"""

    with open(str(out_path), "w", encoding="utf-8") as f:
        f.write(html)


def gerar_ose(ns_id, trecho, pvs, nucleo, out_path):
    """Excel OSE - Ordem de Serviço de Esgoto"""
    try:
        import pandas as pd

        pvi_n, pvf_n = trecho["pv_ini"], trecho["pv_fim"]
        pvi, pvf = pvs.get(pvi_n, {}), pvs.get(pvf_n, {})

        dados = {
            "NS": [f"{ns_id:03d}"],
            "Trecho": [f"{pvi_n} → {pvf_n}"],
            "Rua": [trecho.get("rua", "Sem Rua")],
            "Núcleo": [nucleo],
            "DN (mm)": [trecho.get("dn_mm", "?")],
            "Extensão (m)": [round(trecho.get("ext_m", 0), 2)],
            "Declividade (‰)": [round((trecho.get("decl_mm") or 0) * 1000, 2)],
            "Material": [trecho.get("material", "PVC")],
            "CT Montante": [pvi.get("ct", "—")],
            "CF Montante": [pvi.get("cf", "—")],
            "Prof Montante": [pvi.get("prof", "—")],
            "CT Jusante": [pvf.get("ct", "—")],
            "CF Jusante": [pvf.get("cf", "—")],
            "Prof Jusante": [pvf.get("prof", "—")],
        }

        df = pd.DataFrame(dados)
        df.to_excel(out_path, index=False, sheet_name="OSE")
    except Exception as e:
        print(f"  Erro ao gerar OSE: {e}")


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
def processar_arquivo(dwg_path, nucleo):
    """Processa um arquivo DWG e gera as NS."""
    print("=" * 70)
    print(f"PROCESSANDO: {nucleo}")
    print("=" * 70)

    if not os.path.exists(dwg_path):
        print(f"❌ Arquivo não encontrado: {dwg_path}")
        return 0, 0

    print(f"\n📄 Arquivo: {dwg_path}")
    print(f"📁 Saída: {OUT_BASE}\n")

    # Ler DWG
    print("📖 Lendo arquivo DWG...")
    try:
        pvs, trechos, meta = ler_dwg_aec(dwg_path)
    except Exception as e:
        print(f"❌ Erro ao ler arquivo: {e}")
        return 0, 0

    if not trechos:
        print("❌ Nenhum trecho encontrado!")
        return 0, 0

    print(f"✅ {meta['n_pvs']} PVs, {meta['n_trechos']} trechos")

    # Enriquecer trechos
    print("\n🔧 Enriquecendo dados dos trechos...")
    trechos = enriquecer_trechos(trechos, pvs)

    # Criar pasta de saída
    slug = nucleo.upper().replace(" ", "_").replace("Ã", "A").replace("Ç", "C").replace("Õ", "O")
    nuc_dir = Path(OUT_BASE) / slug
    nuc_dir.mkdir(parents=True, exist_ok=True)

    # Gerar NS
    print(f"\n📝 Gerando Notas de Serviço...\n")

    n_ok = 0
    n_err = 0

    for i, t in enumerate(trechos):
        ns_id = i + 1
        pvi = t["pv_ini"]
        pvf = t["pv_fim"]
        ns_dir = nuc_dir / f"NS_{ns_id:03d}_{pvi}_AO_{pvf}"
        ns_dir.mkdir(parents=True, exist_ok=True)

        try:
            # 1. A4
            gerar_ns_a4(
                ns_id, t, pvs, nucleo, ns_dir / f"NS {ns_id:03d} {pvi} ATE {pvf} A4.pdf"
            )

            # 2. Desenho (planta + perfil)
            gerar_ns_desenho(
                ns_id,
                t,
                pvs,
                trechos,
                nucleo,
                ns_dir / f"Desenho NS {ns_id:03d} {pvi} ATE {pvf}.pdf",
            )

            # 3. Cartografia
            gerar_ns_satelite(
                ns_id, t, pvs, nucleo, ns_dir / f"Cartografia NS {ns_id:03d} {pvi} ATE {pvf}.pdf"
            )

            # 4. JSON
            dados_json = {
                "ns_id": ns_id,
                "nucleo": nucleo,
                "contrato": CONTRATO,
                "trecho": {k: v for k, v in t.items()},
                "pv_montante": pvs.get(pvi, {}),
                "pv_jusante": pvs.get(pvf, {}),
                "gerado_em": datetime.now().isoformat(),
            }
            with open(
                ns_dir / f"NS {ns_id:03d} {pvi} ATE {pvf} DADOS.json", "w", encoding="utf-8"
            ) as f:
                json.dump(dados_json, f, indent=2, ensure_ascii=False)

            # 5. OSE
            gerar_ose(
                ns_id, t, pvs, nucleo, ns_dir / f"OSE NS {ns_id:03d} {pvi} ATE {pvf}.xlsx"
            )

            # 6. HTML
            gerar_html(
                ns_id, t, pvs, trechos, nucleo, ns_dir / f"Mapa NS {ns_id:03d} {pvi} ATE {pvf}.html"
            )

            n_ok += 1

            if ns_id <= 5 or ns_id % 20 == 0:
                dn = t.get("dn_mm", "?")
                ext = t["ext_m"]
                print(f"  NS {ns_id:03d}: {pvi} → {pvf} DN{dn} {ext:.1f}m ✓")

        except Exception as e:
            n_err += 1
            if ns_id <= 5:
                print(f"  NS {ns_id:03d}: ❌ ERRO - {e}")

    # GeoJSON + REDE_GERAL
    print("\n📍 Gerando GeoJSON e Rede Geral...")
    try:
        gis = nuc_dir / "GIS"
        gis.mkdir(exist_ok=True)
        gerar_geojson(trechos, pvs, gis / "rede_definida.geojson")
        gerar_html(0, trechos[0], pvs, trechos, nucleo, str(nuc_dir / "REDE_GERAL.html"))
        print("  ✅ GeoJSON e Rede Geral gerados")
    except Exception as e:
        print(f"  ❌ Erro: {e}")

    return n_ok, n_err


def main():
    print("=" * 70)
    print("GERAR NOTAS DE SERVIÇO - CT SÃO MANOEL E CT JOÃO CARLOS")
    print("Contrato 11481051 - SE LIGA NA REDE")
    print("=" * 70)

    total_ok = 0
    total_err = 0

    for dwg_path, nucleo in DWG_FILES:
        n_ok, n_err = processar_arquivo(dwg_path, nucleo)
        total_ok += n_ok
        total_err += n_err

    # Resumo final
    print(f"\n{'=' * 70}")
    print(f"✅ CONCLUÍDO: {total_ok} NS geradas, {total_err} erros")
    print(f"📁 Pasta: {OUT_BASE}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
