#!/usr/bin/env python3
"""Gera NS COMPLETA (6 arquivos) para TODOS os nucleos + prolongamentos.
Nomenclatura: NS XXX PV_ini ATE PV_fim
6 arquivos por pasta: Desenho, Cartografia, A4, JSON, OSE, Mapa HTML
"""
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from ler_dxf_gdal import ler_dxf_gdal
from ler_landxml import ler_landxml
from gerar_ns import enriquecer_trechos, gerar_ns_a4, gerar_html, gerar_geojson
from gerar_ns import adicionar_base_cartografica, gerar_ns_desenho, gerar_ns_sat
from gerar_ose import gerar_ose

BASE = os.path.join(os.environ.get("USERPROFILE", "C:\\Users\\felip"),
    "Downloads", "PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018",
    "MAPAS ÁGUA E ESGOTO PARA DXF")
OUT = os.path.join(BASE, "NOTAS DE SERVICO COMPLETAS 24-03-2026")

NUCLEOS = [
    ("dxf", os.path.join(BASE, "MORRO DO TETÉU", "TETÉU_ESGOTO.dxf"), "Morro do Teteu"),
    ("dxf", os.path.join(BASE, "PANTANAL BAIXO", "PANTANAL_ESGOTO.dxf"), "Pantanal Baixo"),
    ("dxf", os.path.join(BASE, "SÃO MANOEL", "SÃO_MANOEL_ESGOTO.dxf"), "Sao Manoel"),
    ("dxf", os.path.join(BASE, "VILA DOS CRIADORES", "CRIADORES_ESGOTO.dxf"), "Vila Criadores"),
    ("dxf", os.path.join(BASE, "VILA ISRAEL", "ISRAEL_ESGOTO.dxf"), "Vila Israel"),
    ("dxf", os.path.join(BASE, "JOÃO CARLOS", "JOÃO_CARLOS_ESGOTO.dxf"), "Joao Carlos"),
    ("xml", os.path.join(BASE, "..", "PROLONGAMENTO TETEU ALT-01.xml"), "Prol Teteu Alt-01"),
    ("xml", os.path.join(BASE, "..", "PROLONGAMENTO TETEU.xml"), "Prol Teteu"),
    ("xml", os.path.join(BASE, "..", "PROLONGAMENTO PANTANAL BAIXO.xml"), "Prol Pantanal Baixo"),
    ("xml", os.path.join(BASE, "..", "PROLONGAMENTO CRIADORES.xml"), "Prol Criadores"),
    ("xml", os.path.join(BASE, "..", "PROLONGAMENTO SÃO MANOEL.xml"), "Prol Sao Manoel"),
]


def gerar_desenho_completo(ns_id, t, pvs, ruas, nucleo, out_path):
    """PDF Desenho: planta UTM + quantitativo + perfil + tabela + carimbo SABESP."""
    p0 = pvs.get(t["pv_ini"], {}); p1 = pvs.get(t["pv_fim"], {})
    if not p0.get("x") or not p1.get("x"):
        return
    pvi = t["pv_ini"]; pvf = t["pv_fim"]; ext = t["ext_m"]
    dn = t.get("dn_mm") or 200; mat = t.get("material", "PVC")
    rua_nome = t.get("rua", "Sem Rua"); decl_pct = (t.get("decl_mm") or 0) / 10
    ct0 = p0.get("ct") or 0; cf0 = p0.get("cf") or 0
    ct1 = p1.get("ct") or 0; cf1 = p1.get("cf") or 0
    prof0 = round(abs(ct0 - cf0), 2) if ct0 and cf0 else 0
    prof1 = round(abs(ct1 - cf1), 2) if ct1 and cf1 else 0
    n_barras = math.ceil(ext / 6)
    vol_escav = round(ext * ((prof0 + prof1) / 2) * 0.8, 3)
    vol_aterro = round(vol_escav * 0.18, 3)
    pavim = round(ext * 0.72, 2)

    fig = plt.figure(figsize=(16.54, 11.69), facecolor="white")
    gs = fig.add_gridspec(3, 2, height_ratios=[1.3, 1.0, 0.5], width_ratios=[1.1, 0.9],
                           hspace=0.25, wspace=0.15, left=0.04, right=0.96, top=0.95, bottom=0.03)

    # PLANTA
    ax1 = fig.add_subplot(gs[0, 0])
    ax1.plot([p0["x"], p1["x"]], [p0["y"], p1["y"]], "b-", linewidth=3, zorder=5)
    for nm, pv in [(pvi, p0), (pvf, p1)]:
        ax1.plot(pv["x"], pv["y"], "s", color="#1f4e79", markersize=10, zorder=6)
        ax1.annotate(f"{nm}\nCT={pv.get('ct',0):.3f}\nCF={pv.get('cf',0):.3f}",
                    (pv["x"], pv["y"]), fontsize=7, ha="center", va="bottom",
                    xytext=(0, 12), textcoords="offset points",
                    bbox=dict(boxstyle="round,pad=0.3", facecolor="white", edgecolor="gray", alpha=0.9))
    xm = (p0["x"] + p1["x"]) / 2; ym = (p0["y"] + p1["y"]) / 2
    ax1.annotate(f"DN {dn}mm/{mat}/L={ext:.2f}m", (xm, ym), fontsize=8,
                color="#1f4e79", fontweight="bold", ha="center",
                bbox=dict(facecolor="lightyellow", edgecolor="blue", alpha=0.8))
    if ruas:
        for rd in ruas[:20]:
            rx = rd.get("x", 0); ry = rd.get("y", 0); rt = rd.get("text", "")
            if abs(rx - xm) < 200 and abs(ry - ym) < 200:
                ax1.text(rx, ry, rt, fontsize=6, color="gray", ha="center", style="italic")
    ax1.annotate("N", xy=(0.92, 0.92), xycoords="axes fraction", fontsize=14, fontweight="bold")
    ax1.annotate("", xy=(0.92, 0.95), xytext=(0.92, 0.82), xycoords="axes fraction",
                arrowprops=dict(arrowstyle="->", color="black", lw=2))
    margin = max(abs(p1["x"] - p0["x"]), abs(p1["y"] - p0["y"]), 50) * 0.8
    ax1.set_xlim(min(p0["x"], p1["x"]) - margin, max(p0["x"], p1["x"]) + margin)
    ax1.set_ylim(min(p0["y"], p1["y"]) - margin, max(p0["y"], p1["y"]) + margin)
    ax1.set_xlabel("Este (m UTM)", fontsize=8); ax1.set_ylabel("Norte (m UTM)", fontsize=8)
    ax1.ticklabel_format(useOffset=True)
    ax1.set_title(f"PLANTA NS {ns_id:03d} | {pvi} -> {pvf} | {rua_nome}", fontsize=11, fontweight="bold")
    ax1.grid(True, alpha=0.2); ax1.set_aspect("equal")

    # QUANTITATIVO
    ax2 = fig.add_subplot(gs[0, 1]); ax2.axis("off")
    qtxt = (f"Quantitativo:\n\nVolume de Escavacao = {vol_escav:.3f} m3\n\n"
            f"Volume de Aterro = {vol_aterro:.3f} m3\n\nPavimentacao = {pavim:.2f} m2\n\n"
            f"Extensao Total = {ext:.2f} m\n\n--- {mat} ---\n\n"
            f"{n_barras} barras  {dn}mm {mat}\n\n\nLEGENDA\n")
    ax2.text(0.05, 0.95, qtxt, fontsize=10, va="top", transform=ax2.transAxes)
    ax2.plot([0.05, 0.25], [0.12, 0.12], "b-", linewidth=3, transform=ax2.transAxes)
    ax2.text(0.28, 0.12, f"Tubo DN{dn}mm", fontsize=9, va="center", transform=ax2.transAxes)
    ax2.plot(0.12, 0.05, "s", color="#1f4e79", markersize=10, transform=ax2.transAxes)
    ax2.text(0.28, 0.05, "P.V. - Poco de Visita", fontsize=9, va="center", transform=ax2.transAxes)

    # PERFIL
    ax3 = fig.add_subplot(gs[1, :])
    ax3.fill_between([0, ext], [ct0, ct1], y2=max(ct0, ct1) + 0.3, color="#DEB887", alpha=0.4)
    ax3.plot([0, ext], [ct0, ct1], "-", color="#8B4513", linewidth=2, label="CT")
    ax3.plot([0, ext], [cf0, cf1], "b-", linewidth=2.5, label="CF")
    for x, nm, ct, cf in [(0, pvi, ct0, cf0), (ext, pvf, ct1, cf1)]:
        ha = "left" if x == 0 else "right"
        ax3.annotate(f"{nm}\nCT={ct:.3f}\nCF={cf:.3f}", xy=(x, ct), fontsize=7,
                    fontweight="bold", ha=ha, va="bottom",
                    bbox=dict(boxstyle="round", facecolor="white", edgecolor="gray", alpha=0.9))
        ax3.plot(x, ct, "v", color="#8B4513", markersize=8)
        ax3.plot(x, cf, "o", color="blue", markersize=6)
    ax3.text(ext / 2, (cf0 + cf1) / 2 + 0.15, f"DN {dn}mm i={decl_pct:.2f}%",
            fontsize=11, color="blue", fontweight="bold", ha="center")
    ax3.set_xlabel("Distancia (m)"); ax3.set_ylabel("Cota (m)")
    ax3.set_title("PERFIL LONGITUDINAL    Exag. vertical ~10x", fontsize=10, fontweight="bold")
    ax3.legend(fontsize=8); ax3.grid(True, alpha=0.3)

    # TABELA
    ax4 = fig.add_subplot(gs[2, 0]); ax4.axis("off")
    tab = [["Estaca", "CT (m)", "CF (m)", "Prof (m)", "Dist (m)", "DN (mm)", "Decl (%)"],
           [pvi, f"{ct0:.3f}", f"{cf0:.3f}", f"{prof0:.2f}", "0.00", str(dn), f"{decl_pct:.2f}"],
           [pvf, f"{ct1:.3f}", f"{cf1:.3f}", f"{prof1:.2f}", f"{ext:.2f}", str(dn), f"{decl_pct:.2f}"]]
    table = ax4.table(cellText=tab, loc="center", cellLoc="center")
    table.auto_set_font_size(False); table.set_fontsize(9); table.scale(1, 1.8)
    for j in range(7):
        table[0, j].set_facecolor("#1F4E79")
        table[0, j].set_text_props(color="white", fontweight="bold")

    # CARIMBO
    ax5 = fig.add_subplot(gs[2, 1]); ax5.axis("off")
    ax5.text(0.5, 0.5,
             f"SABESP\nSISTEMA DE ESGOTAMENTO\nSANITARIO SANTOS/SP\n\n"
             f"CONTRATO: 11481051\nNS No {ns_id:03d}\nNUCLEO: {nucleo}\n"
             f"ENG.: Felipe Nery\nConstruData HydroNetwork  Rev. 0",
             fontsize=9, ha="center", va="center", fontweight="bold",
             bbox=dict(boxstyle="round", facecolor="#F5F5F5", edgecolor="#1F4E79", linewidth=2),
             transform=ax5.transAxes)

    fig.savefig(str(out_path), dpi=150, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def gerar_satelite_completo(ns_id, t, pvs, nucleo, out_path):
    """PDF cartografico: mapa correspondente + rede projetada + perfil longitudinal."""
    p0 = pvs.get(t["pv_ini"], {}); p1 = pvs.get(t["pv_fim"], {})
    if not p0.get("x") or not p1.get("x"):
        return
    pvi = t["pv_ini"]; pvf = t["pv_fim"]; ext = t["ext_m"]
    dn = t.get("dn_mm") or 200; mat = t.get("material", "PVC")
    ct0 = p0.get("ct") or 0; cf0 = p0.get("cf") or 0
    ct1 = p1.get("ct") or 0; cf1 = p1.get("cf") or 0
    margin = max(abs(p1["x"] - p0["x"]), abs(p1["y"] - p0["y"]), 50) * 0.8

    fig, (ax_s, ax_p) = plt.subplots(1, 2, figsize=(16.54, 11.69))
    ax_s.set_xlim(min(p0["x"], p1["x"]) - margin, max(p0["x"], p1["x"]) + margin)
    ax_s.set_ylim(min(p0["y"], p1["y"]) - margin, max(p0["y"], p1["y"]) + margin)
    if not adicionar_base_cartografica(ax_s, zoom=18):
        ax_s.set_facecolor("#f0f0f0")
        ax_s.grid(True, alpha=0.35)
    ax_s.plot([p0["x"], p1["x"]], [p0["y"], p1["y"]],
              "r-", linewidth=3, zorder=10, label="Rede projetada")
    for nm, pv in [(pvi, p0), (pvf, p1)]:
        ax_s.plot(pv["x"], pv["y"], "ro", markersize=10, zorder=11)
        ax_s.annotate(nm, (pv["x"], pv["y"]), fontsize=9, color="red", fontweight="bold",
                     xytext=(0, 12), textcoords="offset points",
                     bbox=dict(facecolor="white", alpha=0.8), zorder=12)
    ax_s.set_title(f"PLANTA - NS {ns_id:03d} - {nucleo} - Esgoto", fontweight="bold")
    ax_s.legend(loc="lower right", fontsize=8)

    ax_p.fill_between([0, ext], [ct0, ct1], y2=max(ct0, ct1) + 0.3, color="#DEB887", alpha=0.4)
    ax_p.plot([0, ext], [ct0, ct1], "-", color="#8B4513", linewidth=2)
    ax_p.plot([0, ext], [cf0, cf1], "b-", linewidth=2.5)
    ax_p.annotate(f"{pvi}\nCT={ct0:.3f}", xy=(0, ct0), fontsize=8, fontweight="bold")
    ax_p.annotate(f"CF={cf0:.3f}", xy=(0, cf0), fontsize=7, color="blue", va="top")
    ax_p.annotate(f"{pvf}\nCT={ct1:.3f}", xy=(ext, ct1), fontsize=8, fontweight="bold", ha="right")
    ax_p.annotate(f"CF={cf1:.3f}", xy=(ext, cf1), fontsize=7, color="blue", va="top", ha="right")
    ax_p.text(ext / 2, (cf0 + cf1) / 2 + 0.15, f"DN{dn} {mat} - {ext:.1f}m",
             fontsize=10, color="blue", fontweight="bold", ha="center")
    ax_p.set_xlabel("Distancia (m)"); ax_p.set_ylabel("Cota (m)")
    ax_p.set_title(f"PERFIL LONGITUDINAL - NS {ns_id:03d}", fontweight="bold")
    ax_p.grid(True, alpha=0.3)

    fig.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close(fig)


# ══════════════════════════════════════════════════════════════
# MAIN — processar todos os nucleos
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 70)
    print("CONSTRUDATA HYDRONETWORK - NS COMPLETAS (6 arquivos cada)")
    print("FCN Construcoes e Saneamento - 24/03/2026")
    print("=" * 70)

    total_ns = 0
    total_err = 0

    for tipo, path, nucleo in NUCLEOS:
        if not os.path.exists(path):
            print(f"\nSKIP: {nucleo}")
            continue

        print(f"\n{'=' * 70}")
        print(f">>> {nucleo}")

        if tipo == "dxf":
            pvs, trechos, ruas, meta = ler_dxf_gdal(path)
        else:
            pvs, trechos, ruas, meta = ler_landxml(path)
            ruas = []

        if not trechos:
            print("  SEM TRECHOS!")
            continue

        trechos = enriquecer_trechos(trechos, pvs)
        slug = nucleo.upper().replace(" ", "_")
        nuc_dir = Path(OUT) / slug
        print(f"  {len(pvs)} PVs, {len(trechos)} trechos")

        n_ok = 0
        for i, t in enumerate(trechos):
            ns_id = i + 1
            pvi = t["pv_ini"]
            pvf = t["pv_fim"]
            ns_dir = nuc_dir / f"NS_{ns_id:03d}_{pvi}_AO_{pvf}"
            ns_dir.mkdir(parents=True, exist_ok=True)

            try:
                # 1. Desenho (layout Vila Criadores)
                gerar_desenho_completo(ns_id, t, pvs, ruas, nucleo,
                    ns_dir / f"Desenho NS {ns_id:03d} {pvi} ATE {pvf}.pdf")

                # 2. Cartografia (layout Israel)
                try:
                    gerar_satelite_completo(ns_id, t, pvs, nucleo,
                        ns_dir / f"Cartografia NS {ns_id:03d} {pvi} ATE {pvf}.pdf")
                except Exception:
                    pass

                # 3. A4 texto
                gerar_ns_a4(ns_id, t, pvs, nucleo,
                    str(ns_dir / f"NS {ns_id:03d} {pvi} ATE {pvf} A4.pdf"))

                # 4. JSON
                with open(ns_dir / f"NS {ns_id:03d} {pvi} ATE {pvf} DADOS.json", "w", encoding="utf-8") as f:
                    json.dump({"ns_id": ns_id, "nucleo": nucleo,
                               "trecho": {k: v for k, v in t.items()},
                               "pv_montante": pvs.get(pvi, {}),
                               "pv_jusante": pvs.get(pvf, {})},
                              f, indent=2, ensure_ascii=False)

                # 5. OSE SABESP
                gerar_ose(ns_id, t, pvs, nucleo,
                    str(ns_dir / f"OSE NS {ns_id:03d} {pvi} ATE {pvf}.xlsx"))

                # 6. Mapa HTML Leaflet
                gerar_html(ns_id, t, pvs, trechos, nucleo,
                    str(ns_dir / f"Mapa NS {ns_id:03d} {pvi} ATE {pvf}.html"))

                n_ok += 1
                if ns_id <= 3 or ns_id % 25 == 0:
                    print(f"  NS {ns_id:03d}: {pvi} -> {pvf} DN{t.get('dn_mm')} {t['ext_m']}m")

            except Exception as e:
                total_err += 1
                if ns_id <= 5:
                    print(f"  NS {ns_id:03d}: ERRO - {e}")

        total_ns += n_ok
        print(f"  {n_ok}/{len(trechos)} NS OK")

        # GeoJSON + REDE_GERAL
        try:
            gis = nuc_dir / "GIS"
            gis.mkdir(exist_ok=True)
            gerar_geojson(trechos, pvs, gis / "rede_definida.geojson")
            gerar_html(0, trechos[0], pvs, trechos, nucleo, str(nuc_dir / "REDE_GERAL.html"))
        except Exception:
            pass

    print(f"\n{'=' * 70}")
    print(f"TOTAL: {total_ns} NS completas, {total_err} erros")
    print(f"PASTA: {OUT}")
    print(f"{'=' * 70}")
