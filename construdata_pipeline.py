#!/usr/bin/env python3
"""
CONSTRUDATA_PIPELINE.PY - Pipeline completo da plataforma.

Fluxo principal:
  DXF/DWG/LandXML -> leitura
    -> pacote completo de NS (CAMPO/PLANEJAMENTO)
    -> XLSX automaticas de planejamento/medicao/custos/hidraulica
    -> Civil 3D
    -> Cadastro NTS 292
    -> BIM LOD 500
    -> Cronograma MS Project
"""

import argparse
import json
import math
import sys
from datetime import datetime
from pathlib import Path


SCRIPT_DIR = Path(__file__).parent / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))


def _nucleo_upper(nucleo):
    return str(nucleo).upper().replace(" ", "_")


def _nucleo_slug(nucleo):
    return str(nucleo).lower().replace(" ", "_")


def _dump_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    return str(path)


def _count_files(base_dir, pattern):
    base_dir = Path(base_dir)
    if not base_dir.exists():
        return 0
    return sum(1 for _ in base_dir.rglob(pattern))


def _normalize_microplan_for_xlsx(resultado, trechos):
    equipes_base = max(1, int(resultado.get("resumo", {}).get("equipes_max", 1) or 1))
    detalhados = resultado.get("trechos", [])
    agrupados = {}

    for item in detalhados:
        agrupados.setdefault(item.get("morfologia", "planicie"), []).append(item)

    por_morfologia = {}
    for morf, dados in resultado.get("por_morfologia", {}).items():
        itens = agrupados.get(morf, [])
        pct_total = float(dados.get("pct_total", 0) or 0)
        equipes_rec = max(1, round(equipes_base * pct_total / 100)) if pct_total else 1
        fator_custo = round(
            sum(float(item.get("fator_custo", 1.0) or 1.0) for item in itens) / max(len(itens), 1),
            2,
        )
        dias_total = int(round(dados.get("dias_total", 0) or 0))
        dias_estimados = max(1, math.ceil(dias_total / max(equipes_rec, 1))) if dias_total else 0

        por_morfologia[morf] = {
            **dados,
            "pct_extensao": pct_total,
            "prod_media_m_dia": dados.get("prod_media_dia", 0),
            "fator_custo": fator_custo,
            "equipes_recomendadas": equipes_rec,
            "dias_estimados": dias_estimados,
        }

    trechos_norm = []
    for idx, item in enumerate(detalhados):
        base = trechos[idx] if idx < len(trechos) else {}
        trechos_norm.append(
            {
                **item,
                "pv_ini": base.get("pv_ini", ""),
                "pv_fim": base.get("pv_fim", ""),
                "material": base.get("material", "PVC"),
                "custo_frente": item.get("custo_frente_total", item.get("custo_frente", 0)),
            }
        )

    return {
        **resultado,
        "por_morfologia": por_morfologia,
        "trechos": trechos_norm,
    }


def _gerar_pacote_ns_completo(pvs, trechos, nucleo, out_dir):
    from gerar_ns import processar_nucleo_from_data

    n_ok, n_err = processar_nucleo_from_data(pvs, trechos, nucleo, str(out_dir))

    nucleo_dir = Path(out_dir) / _nucleo_upper(nucleo)
    campo_dir = nucleo_dir / "CAMPO"
    plan_dir = nucleo_dir / "PLANEJAMENTO"

    return {
        "n_ok": n_ok,
        "n_err": n_err,
        "nucleo_dir": str(nucleo_dir),
        "campo_dir": str(campo_dir),
        "planejamento_dir": str(plan_dir),
        "stats": {
            "pastas_ns": sum(1 for p in campo_dir.iterdir() if p.is_dir()) if campo_dir.exists() else 0,
            "pdf_a4": _count_files(campo_dir, "*_A4.pdf"),
            "pdf_desenho": _count_files(campo_dir, "*_DESENHO.pdf"),
            "pdf_satelite": _count_files(campo_dir, "*_SAT.pdf"),
            "html": _count_files(campo_dir, "*.html"),
            "json": _count_files(campo_dir, "*_DADOS.json"),
            "ose_xlsx": _count_files(plan_dir / "OSE", "*.xlsx"),
        },
    }


def _gerar_xlsx_automaticos(pvs, trechos, nucleo, out_dir):
    nucleo_dir = Path(out_dir) / _nucleo_upper(nucleo)
    plan_dir = nucleo_dir / "PLANEJAMENTO"
    plan_dir.mkdir(parents=True, exist_ok=True)

    resultado = {
        "planejamento_dir": str(plan_dir),
        "files": {},
        "warnings": [],
    }

    trechos_enriquecidos = [dict(t) for t in trechos]
    try:
        from gerar_ns import enriquecer_trechos

        trechos_enriquecidos = enriquecer_trechos(trechos_enriquecidos, pvs)
    except Exception as exc:
        resultado["warnings"].append(f"enriquecer_trechos: {exc}")

    try:
        from motor_lean_lps import gerar_relatorio_lean_lps, gerar_xlsx_lean_lps

        relatorio_lean = gerar_relatorio_lean_lps(pvs, trechos_enriquecidos, nucleo=nucleo)
        lean_json = Path(_dump_json(plan_dir / "CRONOGRAMA" / "LEAN_LPS.json", relatorio_lean))
        lean_xlsx = plan_dir / "CRONOGRAMA" / "LEAN_LPS.xlsx"
        gerar_xlsx_lean_lps(relatorio_lean, pvs, trechos_enriquecidos, nucleo, str(lean_xlsx))
        resultado["files"]["lean_lps_json"] = str(lean_json)
        resultado["files"]["lean_lps_xlsx"] = str(lean_xlsx)
    except Exception as exc:
        resultado["warnings"].append(f"LEAN_LPS: {exc}")

    try:
        from motor_medicao import gerar_curva_s
        from gerar_xlsx import gerar_xlsx_curva_s

        curva_s = gerar_curva_s(trechos_enriquecidos)
        curva_json = Path(_dump_json(plan_dir / "MEDICAO" / "CURVA_S.json", curva_s))
        curva_xlsx = plan_dir / "MEDICAO" / "CURVA_S.xlsx"
        gerar_xlsx_curva_s(trechos_enriquecidos, nucleo, str(curva_xlsx))
        resultado["files"]["curva_s_json"] = str(curva_json)
        resultado["files"]["curva_s_xlsx"] = str(curva_xlsx)
    except Exception as exc:
        resultado["warnings"].append(f"CURVA_S: {exc}")

    try:
        from motor_microplanejamento import micro_planejar_nucleo
        from gerar_xlsx import gerar_xlsx_microplan

        microplan = micro_planejar_nucleo(pvs, trechos_enriquecidos, nucleo)
        micro_json = Path(_dump_json(plan_dir / "CRONOGRAMA" / "MICROPLANEJAMENTO.json", microplan))
        micro_xlsx = plan_dir / "CRONOGRAMA" / "MICROPLANEJAMENTO.xlsx"
        micro_xlsx_input = _normalize_microplan_for_xlsx(microplan, trechos_enriquecidos)
        gerar_xlsx_microplan(micro_xlsx_input, pvs, trechos_enriquecidos, nucleo, str(micro_xlsx))
        resultado["files"]["microplanejamento_json"] = str(micro_json)
        resultado["files"]["microplanejamento_xlsx"] = str(micro_xlsx)
    except Exception as exc:
        resultado["warnings"].append(f"MICROPLANEJAMENTO: {exc}")

    try:
        from gerar_xlsx import gerar_xlsx_custos

        custos_xlsx = plan_dir / "CUSTOS" / "CUSTOS_DETALHADOS.xlsx"
        gerar_xlsx_custos(pvs, trechos_enriquecidos, nucleo, str(custos_xlsx))
        resultado["files"]["custos_xlsx"] = str(custos_xlsx)
    except Exception as exc:
        resultado["warnings"].append(f"CUSTOS: {exc}")

    try:
        from gerar_xlsx import gerar_xlsx_hidraulica

        hidraulica_xlsx = plan_dir / "BIM" / "HIDRAULICA.xlsx"
        gerar_xlsx_hidraulica(trechos_enriquecidos, pvs, nucleo, str(hidraulica_xlsx))
        resultado["files"]["hidraulica_xlsx"] = str(hidraulica_xlsx)
    except Exception as exc:
        resultado["warnings"].append(f"HIDRAULICA: {exc}")

    manifest = {
        "nucleo": nucleo,
        "gerado_em": datetime.now().isoformat(),
        "arquivos": resultado["files"],
        "warnings": resultado["warnings"],
    }
    manifest_path = Path(_dump_json(plan_dir / "LOG" / "XLSX_AUTOMATICAS.json", manifest))
    resultado["manifest"] = str(manifest_path)
    return resultado


def run_pipeline(input_path, nucleo=None, out_dir=None, data_inicio=None, only_read=False):
    """
    Executa o pipeline completo.

    Args:
        input_path: caminho para DXF, DWG ou LandXML
        nucleo: nome do nucleo
        out_dir: diretorio base de saida
        data_inicio: data inicial da obra

    Returns:
        dict com o resumo das saidas geradas
    """
    input_path = Path(input_path)

    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo nao encontrado: {input_path}")

    if nucleo is None:
        nucleo = input_path.stem.replace("_", " ").replace("-", " ").title()

    if out_dir is None:
        out_dir = Path(f"./SAIDA_{_nucleo_upper(nucleo)}")
    else:
        out_dir = Path(out_dir)

    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'=' * 70}")
    print("  ConstruData - HydroNetwork - Pipeline Completo")
    print("  Contrato 11481051 - SLNR Santos - SABESP")
    print(f"{'=' * 70}")
    print(f"  Entrada:  {input_path}")
    print(f"  Nucleo:   {nucleo}")
    print(f"  Saida:    {out_dir}")
    print(f"{'=' * 70}\n")

    results = {
        "nucleo": nucleo,
        "input": str(input_path),
        "output_dir": str(out_dir),
    }

    print("▶ ETAPA 1/6 - Leitura do arquivo")
    ext = input_path.suffix.lower()

    if ext == ".xml":
        from ler_landxml import ler_landxml

        pvs, trechos, ruas, meta = ler_landxml(str(input_path))
    elif ext == ".dwg":
        from ler_dwg_aec import ler_dwg_aec

        pvs, trechos, meta = ler_dwg_aec(str(input_path))
        ruas = []
    elif ext == ".dxf":
        from ler_dxf_gdal import ler_dxf_gdal

        pvs, trechos, ruas, meta = ler_dxf_gdal(str(input_path))
    else:
        raise ValueError(f"Formato nao suportado: {ext}")

    ext_total = sum(t.get("ext_m", 0) for t in trechos)
    print(f"  ✓ {len(pvs)} PVs | {len(trechos)} trechos | {ext_total:.0f}m")
    results["n_pvs"] = len(pvs)
    results["n_trechos"] = len(trechos)
    results["pvs"] = pvs
    results["trechos"] = trechos
    results["extensao_total_m"] = round(ext_total, 1)
    
    if only_read:
        return results
    
    if only_read:
        return results
    results["meta_leitura"] = meta

    print("\n▶ ETAPA 2/6 - Pacote completo de NS + XLSX")
    try:
        ns_result = _gerar_pacote_ns_completo(pvs, trechos, nucleo, out_dir)
        xlsx_result = _gerar_xlsx_automaticos(pvs, trechos, nucleo, out_dir)
        results["ns"] = ns_result
        results["xlsx"] = xlsx_result
        print(
            "  ✓ "
            f"{ns_result['stats']['pastas_ns']} pastas NS | "
            f"A4={ns_result['stats']['pdf_a4']} | "
            f"DESENHO={ns_result['stats']['pdf_desenho']} | "
            f"SAT={ns_result['stats']['pdf_satelite']} | "
            f"JSON={ns_result['stats']['json']} | "
            f"OSE={ns_result['stats']['ose_xlsx']}"
        )
        print(f"  ✓ XLSX automaticas: {len(xlsx_result['files'])} arquivo(s)")
        if xlsx_result["warnings"]:
            print(f"  ⚠ XLSX com alerta: {len(xlsx_result['warnings'])}")
    except ImportError:
        print("  ⚠ gerar_ns.py nao encontrado - pulando pacote completo")
        results["ns"] = {}
        results["xlsx"] = {"files": {}, "warnings": ["gerar_ns.py ausente"]}

    print("\n▶ ETAPA 3/6 - Saidas Civil 3D")
    try:
        from gerar_civil3d import gerar_landxml, gerar_cadastro_dxf, gerar_dynamo, gerar_scr

        c3d_dir = out_dir / "02_CIVIL3D"
        c3d_dir.mkdir(parents=True, exist_ok=True)

        xml_path = c3d_dir / f"ESGOTO_{_nucleo_upper(nucleo)}.xml"
        gerar_landxml(pvs, trechos, nucleo, str(xml_path))

        dxf_dir = c3d_dir / "CADASTRO_DXF"
        gerar_cadastro_dxf(pvs, trechos, nucleo, str(dxf_dir))

        dynamo_path = c3d_dir / f"criar_pipe_network_{_nucleo_slug(nucleo)}.py"
        gerar_dynamo(pvs, trechos, nucleo, str(dynamo_path))

        scr_path = c3d_dir / f"desenhar_rede_{_nucleo_slug(nucleo)}.scr"
        gerar_scr(pvs, trechos, nucleo, str(scr_path))

        results["civil3d"] = [str(xml_path), str(dxf_dir), str(dynamo_path), str(scr_path)]
        print("  ✓ LandXML + Cadastro DXF + Dynamo + .scr")
    except ImportError:
        print("  ⚠ gerar_civil3d.py nao encontrado - pulando")
        results["civil3d"] = []

    print("\n▶ ETAPA 4/6 - Cadastro As-Built NTS 292")
    from gerar_cadastro_nts292 import gerar_cadastro_nts292

    nts_dir = out_dir / "03_CADASTRO_NTS292"
    nts_paths = gerar_cadastro_nts292(pvs, trechos, nucleo, str(nts_dir))
    results["cadastro_nts292"] = nts_paths

    print("\n▶ ETAPA 5/6 - BIM LOD 500 / Navisworks")
    from gerar_ifc_lod500 import gerar_ifc_lod500

    bim_dir = out_dir / "04_BIM_LOD500"
    bim_paths = gerar_ifc_lod500(pvs, trechos, nucleo, str(bim_dir))
    results["bim_lod500"] = bim_paths

    print("\n▶ ETAPA 6/6 - Cronograma MS Project")
    from gerar_project_xml import gerar_project_xml

    proj_dir = out_dir / "05_CRONOGRAMA"
    proj_paths = gerar_project_xml(pvs, trechos, nucleo, str(proj_dir), data_inicio=data_inicio)
    results["cronograma"] = proj_paths

    nucleo_dir = Path(out_dir) / _nucleo_upper(nucleo)
    ns_stats = results.get("ns", {}).get("stats", {})
    xlsx_files = results.get("xlsx", {}).get("files", {})

    print(f"\n{'=' * 70}")
    print(f"  ✅ PIPELINE COMPLETO - {nucleo}")
    print(f"{'=' * 70}")
    print(f"  Rede: {len(pvs)} PVs | {len(trechos)} trechos | {ext_total:.0f}m")
    print(f"  Saida: {out_dir}/")
    if ns_stats:
        print(
            f"    {_nucleo_upper(nucleo)}/CAMPO/      - "
            f"A4={ns_stats.get('pdf_a4', 0)} | "
            f"DESENHO={ns_stats.get('pdf_desenho', 0)} | "
            f"SAT={ns_stats.get('pdf_satelite', 0)} | "
            f"HTML={ns_stats.get('html', 0)} | "
            f"JSON={ns_stats.get('json', 0)}"
        )
        print(
            f"    {_nucleo_upper(nucleo)}/PLANEJAMENTO/ - "
            f"OSE={ns_stats.get('ose_xlsx', 0)} | "
            f"XLSX automaticas={len(xlsx_files)}"
        )
    print("    02_CIVIL3D/      - LandXML + Cadastro DXF + Dynamo + .scr")
    print("    03_CADASTRO/     - DXF As-Built NTS 292 + Meta JSON")
    print("    04_BIM_LOD500/   - IFC 2x3 + CSV LOD 500 + BIM JSON")
    print("    05_CRONOGRAMA/   - MS Project XML + Resumo JSON")
    print(f"{'=' * 70}\n")

    results["timestamp"] = datetime.now().isoformat()
    results_path = out_dir / "PIPELINE_RESULTADO.json"
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)

    return results


def main():
    parser = argparse.ArgumentParser(
        description="ConstruData - HydroNetwork - Pipeline Completo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXEMPLOS:
  python construdata_pipeline.py PANTANAL_ESGOTO.dxf
  python construdata_pipeline.py rede.xml --nucleo "Verde e Teteu" --saida ./SAIDA
  python construdata_pipeline.py --gui
        """,
    )
    parser.add_argument("arquivo", nargs="?", help="DXF, DWG ou LandXML")
    parser.add_argument("--nucleo", "-n", help="Nome do nucleo")
    parser.add_argument("--saida", "-o", help="Diretorio de saida")
    parser.add_argument("--gui", action="store_true", help="Abrir interface grafica")

    args = parser.parse_args()

    if args.gui:
        print("GUI: execute python construdata_gui.py")
        return

    if not args.arquivo:
        parser.print_help()
        return

    run_pipeline(args.arquivo, nucleo=args.nucleo, out_dir=args.saida)


if __name__ == "__main__":
    main()
