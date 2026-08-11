#!/usr/bin/env python3
"""Gera exemplo de 1 NS completa com nomenclatura correta."""
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from ler_dxf_gdal import ler_dxf_gdal
from gerar_ns import enriquecer_trechos, gerar_ns_a4, gerar_html
from gerar_ose import gerar_ose

BASE = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF"
pvs, trechos, ruas, meta = ler_dxf_gdal(
    r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018"
    r"\MAPAS ÁGUA E ESGOTO PARA DXF\PANTANAL BAIXO\PANTANAL_ESGOTO.dxf")
trechos = enriquecer_trechos(trechos, pvs)

t = trechos[59]
ns_id = 60
pvi = t["pv_ini"]; pvf = t["pv_fim"]
p0 = pvs[pvi]; p1 = pvs[pvf]
ext = t["ext_m"]
dn = t.get("dn_mm") or 200
mat = t.get("material", "PVC")
rua = t.get("rua", "Sem Rua")
decl_pct = (t.get("decl_mm") or 0) / 10
ct0 = p0.get("ct") or 0; cf0 = p0.get("cf") or 0
ct1 = p1.get("ct") or 0; cf1 = p1.get("cf") or 0
prof0 = round(abs(ct0 - cf0), 2) if ct0 and cf0 else 0
prof1 = round(abs(ct1 - cf1), 2) if ct1 and cf1 else 0
v = t.get("v_ms") or 0; tau = t.get("tau_pa") or 0; q = t.get("q_ls") or 0

n_barras = math.ceil(ext / 6)
vol_escav = round(ext * ((prof0 + prof1) / 2) * 0.8, 3)
vol_aterro = round(vol_escav * 0.18, 3)
pavim = round(ext * 0.72, 2)

out_base = Path(r"C:\Users\felip\Downloads\NOVA NS Versao 5\EXEMPLO_COMPLETO")
ns_nome = f"NS_{ns_id:03d}_{pvi}_AO_{pvf}"
ns_dir = out_base / ns_nome
ns_dir.mkdir(parents=True, exist_ok=True)

print(f"Trecho: {pvi} -> {pvf} DN{dn} {ext}m")
print(f"Pasta: {ns_dir}")

# ══════════════════════════════════════════
# 1. DESENHO (layout Vila Criadores)
# ══════════════════════════════════════════
fig = plt.figure(figsize=(16.54, 11.69), facecolor="white")
gs = fig.add_gridspec(3, 2, height_ratios=[1.3, 1.0, 0.5],
                       width_ratios=[1.1, 0.9],
                       hspace=0.25, wspace=0.15,
                       left=0.04, right=0.96, top=0.95, bottom=0.03)

# Q1: PLANTA UTM
ax1 = fig.add_subplot(gs[0, 0])
ax1.plot([p0["x"], p1["x"]], [p0["y"], p1["y"]], "b-", linewidth=3, zorder=5)
for nome, pv in [(pvi, p0), (pvf, p1)]:
    ax1.plot(pv["x"], pv["y"], "s", color="#1f4e79", markersize=10, zorder=6)
    ax1.annotate(f'{nome}\nCT={pv.get("ct",0):.3f}\nCF={pv.get("cf",0):.3f}',
                (pv["x"], pv["y"]), fontsize=7, ha="center", va="bottom",
                xytext=(0, 12), textcoords="offset points",
                bbox=dict(boxstyle="round,pad=0.3", facecolor="white", edgecolor="gray", alpha=0.9))

xm = (p0["x"] + p1["x"]) / 2; ym = (p0["y"] + p1["y"]) / 2
ax1.annotate(f"DN {dn}mm/{mat}/L={ext:.2f}m", (xm, ym), fontsize=8,
            color="#1f4e79", fontweight="bold", ha="center",
            bbox=dict(facecolor="lightyellow", edgecolor="blue", alpha=0.8))

ax1.annotate("N", xy=(0.92, 0.92), xycoords="axes fraction", fontsize=14, fontweight="bold")
ax1.annotate("", xy=(0.92, 0.95), xytext=(0.92, 0.82), xycoords="axes fraction",
            arrowprops=dict(arrowstyle="->", color="black", lw=2))

margin = max(abs(p1["x"]-p0["x"]), abs(p1["y"]-p0["y"]), 50) * 0.8
ax1.set_xlim(min(p0["x"],p1["x"])-margin, max(p0["x"],p1["x"])+margin)
ax1.set_ylim(min(p0["y"],p1["y"])-margin, max(p0["y"],p1["y"])+margin)
ax1.set_xlabel("Este (m UTM)", fontsize=8)
ax1.set_ylabel("Norte (m UTM)", fontsize=8)
ax1.ticklabel_format(useOffset=True)
ax1.set_title(f"PLANTA NS {ns_id:03d} | {pvi} -> {pvf} | {rua}", fontsize=11, fontweight="bold")
ax1.grid(True, alpha=0.2)
ax1.set_aspect("equal")

# Q2: QUANTITATIVO
ax2 = fig.add_subplot(gs[0, 1])
ax2.axis("off")
quant = (f"Quantitativo:\n\n"
         f"Volume de Escavacao = {vol_escav:.3f} m3\n\n"
         f"Volume de Aterro = {vol_aterro:.3f} m3\n\n"
         f"Pavimentacao = {pavim:.2f} m2\n\n"
         f"Extensao Total = {ext:.2f} m\n\n"
         f"--- {mat} ---\n\n"
         f"{n_barras} barras  {dn}mm {mat}\n\n\n"
         f"LEGENDA\n")
ax2.text(0.05, 0.95, quant, fontsize=10, va="top", transform=ax2.transAxes)
ax2.plot([0.05, 0.25], [0.12, 0.12], "b-", linewidth=3, transform=ax2.transAxes)
ax2.text(0.28, 0.12, f"Tubo DN{dn}mm", fontsize=9, va="center", transform=ax2.transAxes)
ax2.plot(0.12, 0.05, "s", color="#1f4e79", markersize=10, transform=ax2.transAxes)
ax2.text(0.28, 0.05, "P.V. - Poco de Visita", fontsize=9, va="center", transform=ax2.transAxes)

# Q3: PERFIL
ax3 = fig.add_subplot(gs[1, :])
ax3.fill_between([0, ext], [ct0, ct1], y2=max(ct0, ct1)+0.3, color="#DEB887", alpha=0.4)
ax3.plot([0, ext], [ct0, ct1], "-", color="#8B4513", linewidth=2, label="CT")
ax3.plot([0, ext], [cf0, cf1], "b-", linewidth=2.5, label="CF")

for x, nome, ct, cf in [(0, pvi, ct0, cf0), (ext, pvf, ct1, cf1)]:
    ha = "left" if x == 0 else "right"
    ax3.annotate(f"{nome}\nCT={ct:.3f}\nCF={cf:.3f}",
                xy=(x, ct), fontsize=7, fontweight="bold", ha=ha, va="bottom",
                bbox=dict(boxstyle="round", facecolor="white", edgecolor="gray", alpha=0.9))
    ax3.plot(x, ct, "v", color="#8B4513", markersize=8)
    ax3.plot(x, cf, "o", color="blue", markersize=6)

ax3.text(ext/2, (cf0+cf1)/2+0.15, f"DN {dn}mm i={decl_pct:.2f}%",
        fontsize=11, color="blue", fontweight="bold", ha="center")
ax3.set_xlabel("Distancia (m)"); ax3.set_ylabel("Cota (m)")
ax3.set_title("PERFIL LONGITUDINAL    Exag. vertical ~10x", fontsize=10, fontweight="bold")
ax3.legend(fontsize=8); ax3.grid(True, alpha=0.3)

# Q4: TABELA + CARIMBO
ax4 = fig.add_subplot(gs[2, 0])
ax4.axis("off")
tab = [["Estaca", "CT (m)", "CF (m)", "Prof (m)", "Dist (m)", "DN (mm)", "Decl (%)"],
       [pvi, f"{ct0:.3f}", f"{cf0:.3f}", f"{prof0:.2f}", "0.00", str(dn), f"{decl_pct:.2f}"],
       [pvf, f"{ct1:.3f}", f"{cf1:.3f}", f"{prof1:.2f}", f"{ext:.2f}", str(dn), f"{decl_pct:.2f}"]]
table = ax4.table(cellText=tab, loc="center", cellLoc="center")
table.auto_set_font_size(False); table.set_fontsize(9); table.scale(1, 1.8)
for j in range(7):
    table[0, j].set_facecolor("#1F4E79")
    table[0, j].set_text_props(color="white", fontweight="bold")

ax5 = fig.add_subplot(gs[2, 1])
ax5.axis("off")
carimbo = (f"SABESP\nSISTEMA DE ESGOTAMENTO\nSANITARIO SANTOS/SP\n\n"
           f"CONTRATO: 11481051\nNS No {ns_id:03d}\nNUCLEO: Pantanal Baixo\n"
           f"ENG.: Felipe Nery\nConstruData HydroNetwork  Rev. 0")
ax5.text(0.5, 0.5, carimbo, fontsize=9, ha="center", va="center",
        fontweight="bold", bbox=dict(boxstyle="round", facecolor="#F5F5F5",
        edgecolor="#1F4E79", linewidth=2), transform=ax5.transAxes)

path1 = ns_dir / f"Desenho NS {ns_id:03d} {pvi} ATE {pvf}.pdf"
fig.savefig(str(path1), dpi=150, bbox_inches="tight", facecolor="white")
plt.close(fig)
print(f"OK: {path1.name}")

# ══════════════════════════════════════════
# 2. CARTOGRAFIA (layout Israel)
# ══════════════════════════════════════════
fig2, (ax_s, ax_p) = plt.subplots(1, 2, figsize=(16.54, 11.69))
ax_s.plot([p0["x"], p1["x"]], [p0["y"], p1["y"]], "r-", linewidth=3, zorder=5)
for nome, pv in [(pvi, p0), (pvf, p1)]:
    ax_s.plot(pv["x"], pv["y"], "ro", markersize=10, zorder=6)
    ax_s.annotate(nome, (pv["x"], pv["y"]), fontsize=9, color="red",
                 fontweight="bold", xytext=(0, 12), textcoords="offset points",
                 bbox=dict(facecolor="white", alpha=0.8))
ax_s.set_xlim(min(p0["x"],p1["x"])-margin, max(p0["x"],p1["x"])+margin)
ax_s.set_ylim(min(p0["y"],p1["y"])-margin, max(p0["y"],p1["y"])+margin)
try:
    import contextily as cx
    cx.add_basemap(ax_s, crs="EPSG:31983", source=cx.providers.CartoDB.Positron, zoom=18)
except Exception:
    ax_s.set_facecolor("#f0f0f0")
ax_s.plot([p0["x"], p1["x"]], [p0["y"], p1["y"]], "r-", linewidth=3, zorder=10)
ax_s.set_title(f"PLANTA - NS {ns_id:03d} - Pantanal Baixo - Esgoto", fontweight="bold")

ax_p.fill_between([0, ext], [ct0, ct1], y2=max(ct0,ct1)+0.3, color="#DEB887", alpha=0.4)
ax_p.plot([0, ext], [ct0, ct1], "-", color="#8B4513", linewidth=2)
ax_p.plot([0, ext], [cf0, cf1], "b-", linewidth=2.5)
ax_p.annotate(f"{pvi}\nCT={ct0:.3f}", xy=(0, ct0), fontsize=8, fontweight="bold")
ax_p.annotate(f"CF={cf0:.3f}", xy=(0, cf0), fontsize=7, color="blue", va="top")
ax_p.annotate(f"{pvf}\nCT={ct1:.3f}", xy=(ext, ct1), fontsize=8, fontweight="bold", ha="right")
ax_p.annotate(f"CF={cf1:.3f}", xy=(ext, cf1), fontsize=7, color="blue", va="top", ha="right")
ax_p.text(ext/2, (cf0+cf1)/2+0.15, f"DN{dn} {mat} - {ext:.1f}m",
         fontsize=10, color="blue", fontweight="bold", ha="center")
ax_p.set_xlabel("Distancia (m)"); ax_p.set_ylabel("Cota (m)")
ax_p.set_title(f"PERFIL LONGITUDINAL - NS {ns_id:03d}", fontweight="bold")
ax_p.grid(True, alpha=0.3)

path2 = ns_dir / f"Cartografia NS {ns_id:03d} {pvi} ATE {pvf}.pdf"
fig2.savefig(str(path2), dpi=150, bbox_inches="tight")
plt.close(fig2)
print(f"OK: {path2.name}")

# ══════════════════════════════════════════
# 3. A4 + JSON + OSE + HTML
# ══════════════════════════════════════════
path3 = ns_dir / f"NS {ns_id:03d} {pvi} ATE {pvf} A4.pdf"
gerar_ns_a4(ns_id, t, pvs, "Pantanal Baixo", str(path3))
print(f"OK: {path3.name}")

path4 = ns_dir / f"NS {ns_id:03d} {pvi} ATE {pvf} DADOS.json"
with open(path4, "w", encoding="utf-8") as f:
    json.dump({"ns_id": ns_id, "nucleo": "Pantanal Baixo",
               "trecho": {k: v for k, v in t.items()},
               "pv_montante": pvs.get(pvi, {}), "pv_jusante": pvs.get(pvf, {})},
              f, indent=2, ensure_ascii=False)
print(f"OK: {path4.name}")

path5 = ns_dir / f"OSE NS {ns_id:03d} {pvi} ATE {pvf}.xlsx"
gerar_ose(ns_id, t, pvs, "Pantanal Baixo", str(path5))
print(f"OK: {path5.name}")

path6 = ns_dir / f"Mapa NS {ns_id:03d} {pvi} ATE {pvf}.html"
gerar_html(ns_id, t, pvs, trechos, "Pantanal Baixo", str(path6))
print(f"OK: {path6.name}")

print(f"\n{'='*60}")
print(f"PASTA: {ns_dir}")
print(f"{'='*60}")
for f in sorted(ns_dir.iterdir()):
    print(f"  {f.name:55s} ({f.stat().st_size//1024}KB)")
