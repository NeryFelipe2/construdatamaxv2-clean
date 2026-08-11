#!/usr/bin/env python3
"""
CONSTRUDATA_PIPELINE.PY — Pipeline Completo NS → Cadastro → BIM → Project
ConstruData - HydroNetwork Platform v6
Contrato 11481051 — SLNR Santos — SABESP

Pipeline:
  DXF/DWG/LandXML → ler_dxf_gdal / ler_landxml
    → gerar_ns.py          (NS campo + PDF + HTML + GeoJSON)
    → gerar_civil3d.py     (LandXML + Cadastro DXF + Dynamo + .scr)
    → gerar_cadastro_nts292.py  (DXF as-built NTS 292)
    → gerar_ifc_lod500.py  (IFC Navisworks + CSV LOD 500)
    → gerar_project_xml.py (Cronograma MS Project)

USO:
  python construdata_pipeline.py <arquivo.dxf> [--nucleo NOME] [--saida DIR]
  
  Ou via GUI:
  python construdata_pipeline.py --gui

Autor: Felipe Nery
"""

import sys, os, json, shutil, argparse
from pathlib import Path
from datetime import datetime

# Adicionar diretório de scripts ao path
SCRIPT_DIR = Path(__file__).parent / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))


def run_pipeline(input_path, nucleo=None, out_dir=None, data_inicio=None):
    """
    Executa pipeline completo.
    
    Args:
        input_path: caminho para DXF, DWG ou LandXML
        nucleo: nome do núcleo (auto-detectado se None)
        out_dir: diretório de saída (auto se None)
        data_inicio: data início da obra
    
    Returns:
        dict com todos os caminhos gerados
    """
    input_path = Path(input_path)
    
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")
    
    # Auto-detectar núcleo
    if nucleo is None:
        nucleo = input_path.stem.replace("_", " ").replace("-", " ").title()
    
    if out_dir is None:
        out_dir = Path(f"./SAIDA_{nucleo.upper().replace(' ','_')}")
    else:
        out_dir = Path(out_dir)
    
    out_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*70}")
    print(f"  ConstruData - HydroNetwork — Pipeline Completo")
    print(f"  Contrato 11481051 — SLNR Santos — SABESP")
    print(f"{'='*70}")
    print(f"  Entrada:  {input_path}")
    print(f"  Núcleo:   {nucleo}")
    print(f"  Saída:    {out_dir}")
    print(f"{'='*70}\n")
    
    results = {"nucleo": nucleo, "input": str(input_path), "output_dir": str(out_dir)}
    
    # ── ETAPA 1: Leitura ─────────────────────────────────────
    print("▶ ETAPA 1/6 — Leitura do arquivo")
    ext = input_path.suffix.lower()
    
    if ext == ".xml":
        from ler_landxml import ler_landxml
        pvs, trechos, ruas, meta = ler_landxml(str(input_path))
    elif ext in (".dxf", ".dwg"):
        from ler_dxf_gdal import ler_dxf_gdal
        pvs, trechos, ruas, meta = ler_dxf_gdal(str(input_path))
    else:
        raise ValueError(f"Formato não suportado: {ext}")
    
    ext_total = sum(t.get("ext_m", 0) for t in trechos)
    print(f"  ✓ {len(pvs)} PVs | {len(trechos)} trechos | {ext_total:.0f}m")
    results["pvs"] = len(pvs)
    results["trechos"] = len(trechos)
    results["extensao_m"] = round(ext_total, 1)
    
    # ── ETAPA 2: NS de Campo ─────────────────────────────────
    print("\n▶ ETAPA 2/6 — Notas de Serviço")
    try:
        from gerar_ns import gerar_ns
        ns_dir = out_dir / "01_NS"
        ns_paths = gerar_ns(pvs, trechos, nucleo, str(ns_dir))
        results["ns"] = ns_paths
        print(f"  ✓ {len(trechos)} NS geradas")
    except ImportError:
        print("  ⚠ gerar_ns.py não encontrado — pulando")
        results["ns"] = []
    
    # ── ETAPA 3: Civil 3D ────────────────────────────────────
    print("\n▶ ETAPA 3/6 — Saídas Civil 3D")
    try:
        from gerar_civil3d import gerar_landxml, gerar_cadastro_dxf, gerar_dynamo, gerar_scr
        c3d_dir = out_dir / "02_CIVIL3D"
        c3d_dir.mkdir(parents=True, exist_ok=True)
        
        xml_path = str(c3d_dir / f"ESGOTO_{nucleo.upper().replace(' ','_')}.xml")
        gerar_landxml(pvs, trechos, nucleo, xml_path)
        
        dxf_dir = str(c3d_dir / "CADASTRO_DXF")
        gerar_cadastro_dxf(pvs, trechos, ruas, nucleo, dxf_dir)
        
        dynamo_path = str(c3d_dir / f"criar_pipe_network_{nucleo.lower().replace(' ','_')}.py")
        gerar_dynamo(pvs, trechos, nucleo, dynamo_path)
        
        scr_path = str(c3d_dir / f"desenhar_rede_{nucleo.lower().replace(' ','_')}.scr")
        gerar_scr(pvs, trechos, nucleo, scr_path)
        
        results["civil3d"] = [xml_path, dxf_dir, dynamo_path, scr_path]
        print(f"  ✓ LandXML + Cadastro DXF + Dynamo + .scr")
    except ImportError:
        print("  ⚠ gerar_civil3d.py não encontrado — pulando")
        results["civil3d"] = []
    
    # ── ETAPA 4: Cadastro NTS 292 ────────────────────────────
    print("\n▶ ETAPA 4/6 — Cadastro As-Built NTS 292")
    from gerar_cadastro_nts292 import gerar_cadastro_nts292
    nts_dir = out_dir / "03_CADASTRO_NTS292"
    nts_paths = gerar_cadastro_nts292(pvs, trechos, nucleo, str(nts_dir))
    results["cadastro_nts292"] = nts_paths
    
    # ── ETAPA 5: IFC LOD 500 / Navisworks ────────────────────
    print("\n▶ ETAPA 5/6 — BIM LOD 500 / Navisworks")
    from gerar_ifc_lod500 import gerar_ifc_lod500
    bim_dir = out_dir / "04_BIM_LOD500"
    bim_paths = gerar_ifc_lod500(pvs, trechos, nucleo, str(bim_dir))
    results["bim_lod500"] = bim_paths
    
    # ── ETAPA 6: Cronograma MS Project ───────────────────────
    print("\n▶ ETAPA 6/6 — Cronograma MS Project")
    from gerar_project_xml import gerar_project_xml
    proj_dir = out_dir / "05_CRONOGRAMA"
    proj_paths = gerar_project_xml(pvs, trechos, nucleo, str(proj_dir),
                                   data_inicio=data_inicio)
    results["cronograma"] = proj_paths
    
    # ── RESUMO FINAL ─────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"  ✅ PIPELINE COMPLETO — {nucleo}")
    print(f"{'='*70}")
    print(f"  Rede: {len(pvs)} PVs | {len(trechos)} trechos | {ext_total:.0f}m")
    print(f"  Saída: {out_dir}/")
    print(f"    01_NS/           — {len(trechos)} Notas de Serviço (JSON+PDF+HTML)")
    print(f"    02_CIVIL3D/      — LandXML + Cadastro DXF + Dynamo + .scr")
    print(f"    03_CADASTRO/     — DXF As-Built NTS 292 + Meta JSON")
    print(f"    04_BIM_LOD500/   — IFC 2x3 + CSV LOD 500 + BIM JSON")
    print(f"    05_CRONOGRAMA/   — MS Project XML + Resumo JSON")
    print(f"{'='*70}\n")
    
    # Salvar resultado
    results["timestamp"] = datetime.now().isoformat()
    results_path = out_dir / "PIPELINE_RESULTADO.json"
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    return results


def main():
    parser = argparse.ArgumentParser(
        description="ConstruData - HydroNetwork — Pipeline Completo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXEMPLOS:
  python construdata_pipeline.py PANTANAL_ESGOTO.dxf
  python construdata_pipeline.py rede.xml --nucleo "Verde e Teteu" --saida ./SAIDA
  python construdata_pipeline.py --gui
        """
    )
    parser.add_argument("arquivo", nargs="?", help="DXF, DWG ou LandXML")
    parser.add_argument("--nucleo", "-n", help="Nome do núcleo")
    parser.add_argument("--saida", "-o", help="Diretório de saída")
    parser.add_argument("--gui", action="store_true", help="Abrir interface gráfica")
    
    args = parser.parse_args()
    
    if args.gui:
        print("GUI: abra construdata_gui.html no navegador")
        return
    
    if not args.arquivo:
        parser.print_help()
        return
    
    run_pipeline(args.arquivo, nucleo=args.nucleo, out_dir=args.saida)


if __name__ == "__main__":
    main()
