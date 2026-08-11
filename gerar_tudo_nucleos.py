#!/usr/bin/env python3
"""Gera TUDO para todos os nucleos: 7 outputs/NS + 14 extras/nucleo."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pathlib import Path
from ler_dxf_gdal import ler_dxf_gdal
from ler_landxml import ler_landxml
from gerar_ns import enriquecer_trechos, gerar_ns_a4, gerar_ns_desenho, gerar_ns_sat, gerar_html, gerar_geojson, log
from gerar_ose import gerar_ose
from gerar_civil3d import gerar_landxml, gerar_cadastro_dxf, gerar_dynamo_script, gerar_autocad_scr, gerar_json_dados
from gerar_cadastro_nts292 import gerar_cadastro_nts292
from gerar_ifc_lod500 import gerar_ifc_lod500
from gerar_xlsx import gerar_xlsx_custos, gerar_xlsx_hidraulica, gerar_xlsx_curva_s, gerar_xlsx_lean, gerar_xlsx_microplan, gerar_xlsx_perdas
from motor_lean_lps import gerar_relatorio_lean_lps
from motor_microplanejamento import micro_planejar_nucleo
from motor_perdas import gerar_relatorio_perdas
from gerar_pdf_perdas import gerar_pdf_perdas

BASE = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF"
OUT = os.path.join(BASE, "novas notas de servico 23-03-2026")

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

print("=" * 70)
print("CONSTRUDATA HYDRONETWORK — GERACAO COMPLETA")
print("7 outputs/NS + 14 extras/nucleo")
print("FCN Construcoes e Saneamento · 24/03/2026")
print("=" * 70)

total_ns = 0; total_ose = 0; total_extras = 0; erros = []

for tipo, path, nucleo in NUCLEOS:
    if not os.path.exists(path):
        print(f"\nSKIP: {nucleo}"); continue

    print(f"\n{'=' * 70}")
    print(f">>> {nucleo} ({tipo.upper()})")

    if tipo == "dxf":
        pvs, trechos, ruas, meta = ler_dxf_gdal(path)
    else:
        pvs, trechos, ruas, meta = ler_landxml(path)

    if not trechos:
        print("  SEM TRECHOS!"); continue

    trechos = enriquecer_trechos(trechos, pvs)
    print(f"  Rede: {len(pvs)} PVs, {len(trechos)} trechos")

    slug = nucleo.upper().replace(" ", "_")
    nuc_dir = Path(OUT) / slug
    ns_dir = nuc_dir / "01_NS_CAMPO"
    des_dir = nuc_dir / "03_DESENHOS"
    htm_dir = nuc_dir / "04_HTML"
    gis_dir = nuc_dir / "05_GIS"
    ose_dir = nuc_dir / "06_OSE"
    xlsx_dir = nuc_dir / "07_XLSX"
    c3d_dir = nuc_dir / "08_CIVIL3D"

    for d in [ns_dir, des_dir, htm_dir, gis_dir, ose_dir, xlsx_dir, c3d_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # ── NS por trecho (7 outputs) ──
    n_ok = 0
    for i, t in enumerate(trechos):
        ns_id = i + 1
        pvi = t["pv_ini"]; pvf = t["pv_fim"]
        ns_slug = f"NS_{ns_id:03d}_{pvi}_AO_{pvf}".replace(" ", "_")
        trecho_dir = ns_dir / ns_slug
        trecho_dir.mkdir(parents=True, exist_ok=True)

        try:
            gerar_ns_a4(ns_id, t, pvs, nucleo, trecho_dir / f"NS_{ns_id:03d}_A4.pdf")
            with open(trecho_dir / f"NS_{ns_id:03d}_DADOS.json", "w", encoding="utf-8") as f:
                json.dump({"ns_id": ns_id, "nucleo": nucleo, "trecho": {k: v for k, v in t.items()},
                           "pv_montante": pvs.get(pvi, {}), "pv_jusante": pvs.get(pvf, {})},
                          f, indent=2, ensure_ascii=False)
            gerar_ns_desenho(ns_id, t, pvs, trechos, nucleo, des_dir / f"NS_{ns_id:03d}_DESENHO.pdf")
            try:
                gerar_ns_sat(ns_id, t, pvs, nucleo, des_dir / f"NS_{ns_id:03d}_SAT.pdf")
            except Exception:
                pass
            gerar_html(ns_id, t, pvs, trechos, nucleo, htm_dir / f"NS_{ns_id:03d}.html")
            gerar_ose(ns_id, t, pvs, nucleo, ose_dir / f"NS_{ns_id:03d}_OSE.xlsx")
            n_ok += 1; total_ose += 1
            if ns_id <= 3 or ns_id % 25 == 0:
                print(f"  NS {ns_id:03d}: {pvi}->{pvf} DN{t.get('dn_mm')} {t['ext_m']}m")
        except Exception as e:
            erros.append(f"{nucleo} NS{ns_id}: {e}")

    total_ns += n_ok
    print(f"  NS: {n_ok}/{len(trechos)}")

    try:
        gerar_html(0, trechos[0], pvs, trechos, nucleo, htm_dir / "REDE_GERAL.html")
        gerar_geojson(trechos, pvs, gis_dir / "rede_definida.geojson")
    except Exception:
        pass

    # ── Extras por nucleo ──
    try:
        gerar_landxml(pvs, trechos, nucleo, c3d_dir / f"REDE_{slug}.xml")
        gerar_cadastro_dxf(pvs, trechos, nucleo, str(c3d_dir))
        gerar_dynamo_script(pvs, trechos, nucleo, c3d_dir / f"dynamo_{slug}.py")
        gerar_autocad_scr(pvs, trechos, nucleo, c3d_dir / f"desenhar_{slug}.scr")
        gerar_json_dados(pvs, trechos, nucleo, c3d_dir / f"dados_{slug}.json")
        total_extras += 5; print(f"  Civil3D: 5 OK")
    except Exception as e:
        erros.append(f"{nucleo} Civil3D: {e}")

    try:
        gerar_cadastro_nts292(pvs, trechos, nucleo, str(nuc_dir))
        total_extras += 1; print(f"  NTS292: OK")
    except Exception as e:
        erros.append(f"{nucleo} NTS292: {e}")

    try:
        gerar_ifc_lod500(pvs, trechos, nucleo, str(nuc_dir))
        total_extras += 1; print(f"  IFC: OK")
    except Exception as e:
        erros.append(f"{nucleo} IFC: {e}")

    rp = None
    try:
        gerar_xlsx_custos(pvs, trechos, nucleo, xlsx_dir / f"CUSTOS_{slug}.xlsx")
        gerar_xlsx_hidraulica(trechos, pvs, nucleo, xlsx_dir / f"HIDRAULICA_{slug}.xlsx")
        gerar_xlsx_curva_s(trechos, nucleo, xlsx_dir / f"CURVA_S_{slug}.xlsx")
        rel = gerar_relatorio_lean_lps(pvs, trechos, nucleo=nucleo)
        gerar_xlsx_lean(rel, pvs, trechos, nucleo, xlsx_dir / f"LEAN_LPS_{slug}.xlsx")
        mp = micro_planejar_nucleo(pvs, trechos, nucleo, 4)
        gerar_xlsx_microplan(mp, pvs, trechos, nucleo, xlsx_dir / f"MICROPLAN_{slug}.xlsx")
        rp = gerar_relatorio_perdas(pvs, trechos, nucleo, pressao_media=25)
        gerar_xlsx_perdas(rp, nucleo, xlsx_dir / f"PERDAS_{slug}.xlsx")
        total_extras += 6; print(f"  XLSX (6): OK")
    except Exception as e:
        erros.append(f"{nucleo} XLSX: {e}")

    try:
        if rp:
            gerar_pdf_perdas(rp, str(nuc_dir / f"RELATORIO_PERDAS_{slug}.pdf"), nucleo)
            total_extras += 1; print(f"  PDF Perdas: OK")
    except Exception as e:
        erros.append(f"{nucleo} PDF: {e}")

print(f"\n{'=' * 70}")
print(f"RESULTADO FINAL")
print(f"{'=' * 70}")
print(f"  NS geradas:     {total_ns}")
print(f"  OSE geradas:    {total_ose}")
print(f"  Extras nucleo:  {total_extras}")
print(f"  Erros:          {len(erros)}")
if erros:
    for e in erros[:10]:
        print(f"    {e}")
print(f"  Pasta: {OUT}")
print(f"{'=' * 70}")
