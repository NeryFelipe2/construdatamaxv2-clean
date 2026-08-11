#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
integrador_nova_ns.py — Integrador do Motor TETÉU com Nova NS v5

Permite processar múltiplos DXFs de uma vez e exportar para formatos da Nova NS.

Uso:
  python integrador_nova_ns.py <pasta_com_dxfs> [--saida <pasta_saida>]
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Importar motor
from motor_teteu_esgoto import ler_dxf_teteu


def processar_dxf(dxf_path, saida_dir=None):
    """
    Processa um único DXF e salva resultados.
    
    Args:
        dxf_path: caminho para DXF
        saida_dir: pasta para salvar resultados (opcional)
    
    Returns:
        dict com resultados ou None se falhar
    """
    dxf_path = Path(dxf_path)
    if not dxf_path.exists():
        print(f"  [ERRO] Arquivo não encontrado: {dxf_path}")
        return None
    
    print(f"\n{'='*70}")
    print(f"PROCESSANDO: {dxf_path.name}")
    print(f"{'='*70}")
    
    try:
        pvs, trechos, ruas, meta = ler_dxf_teteu(str(dxf_path), modo="hibrido")
        
        # Adicionar timestamp
        meta["data_processamento"] = datetime.now().isoformat()
        meta["caminho_original"] = str(dxf_path.absolute())
        
        # Salvar JSON completo
        if saida_dir:
            saida_dir = Path(saida_dir)
            saida_dir.mkdir(parents=True, exist_ok=True)
            
            saida_json = saida_dir / f"{dxf_path.stem}_NS.json"
            resultado = {
                "meta": meta,
                "pvs": pvs,
                "trechos": trechos,
                "ruas": ruas,
            }
            
            with open(saida_json, 'w', encoding='utf-8') as f:
                json.dump(resultado, f, indent=2, ensure_ascii=False)
            
            print(f"\n  ✅ Resultados salvos em: {saida_json}")
        
        return {
            "meta": meta,
            "pvs": pvs,
            "trechos": trechos,
            "sucesso": True,
        }
        
    except Exception as e:
        print(f"  ❌ ERRO: {e}")
        return {
            "erro": str(e),
            "sucesso": False,
        }


def processar_pasta(pasta_dxfs, saida_dir=None):
    """
    Processa todos os DXFs de uma pasta.
    
    Args:
        pasta_dxfs: caminho para pasta com DXFs
        saida_dir: pasta para salvar resultados (opcional)
    
    Returns:
        dict com estatísticas do processamento
    """
    pasta = Path(pasta_dxfs)
    if not pasta.exists():
        raise FileNotFoundError(f"Pasta não encontrada: {pasta}")
    
    # Encontrar DXFs
    dxfs = list(pasta.glob("*.dxf")) + list(pasta.glob("*.DXF"))
    
    if not dxfs:
        print(f"  [AVISO] Nenhum DXF encontrado em {pasta}")
        return {"total": 0, "sucesso": 0, "falha": 0}
    
    print(f"\n{'='*70}")
    print(f"PROCESSAMENTO EM LOTE — {len(dxfs)} DXFs")
    print(f"Pasta: {pasta}")
    print(f"{'='*70}")
    
    resultados = []
    stats = {"total": len(dxfs), "sucesso": 0, "falha": 0, "total_pvs": 0, "total_trechos": 0}
    
    for i, dxf in enumerate(sorted(dxfs), 1):
        print(f"\n[{i}/{stats['total']}]")
        resultado = processar_dxf(dxf, saida_dir)
        
        if resultado and resultado.get("sucesso"):
            stats["sucesso"] += 1
            stats["total_pvs"] += len(resultado["pvs"])
            stats["total_trechos"] += len(resultado["trechos"])
            resultados.append({
                "arquivo": dxf.name,
                "meta": resultado["meta"],
            })
        else:
            stats["falha"] += 1
    
    # Resumo final
    print(f"\n{'='*70}")
    print(f"RESUMO DO PROCESSAMENTO")
    print(f"{'='*70}")
    print(f"  Total DXFs:     {stats['total']}")
    print(f"  Sucesso:        {stats['sucesso']}")
    print(f"  Falha:          {stats['falha']}")
    print(f"  Total PVs:      {stats['total_pvs']}")
    print(f"  Total Trechos:  {stats['total_trechos']}")
    
    # Salvar resumo consolidado
    if saida_dir and resultados:
        resumo_path = Path(saida_dir) / "RESUMO_CONSOLIDADO.json"
        with open(resumo_path, 'w', encoding='utf-8') as f:
            json.dump({
                "data_processamento": datetime.now().isoformat(),
                "pasta_origem": str(pasta.absolute()),
                "estatisticas": stats,
                "arquivos": resultados,
            }, f, indent=2, ensure_ascii=False)
        
        print(f"\n  📄 Resumo consolidado: {resumo_path}")
    
    return stats


def exportar_para_csv(trechos, saida_path):
    """
    Exporta trechos para CSV no formato Nova NS.
    
    Args:
        trechos: lista de trechos
        saida_path: caminho para arquivo CSV de saída
    """
    import csv
    
    if not trechos:
        return
    
    colunas = [
        "pv_ini", "pv_fim", "dn_mm", "ext_m", "decl_mm", "decl_pct",
        "material", "rua", "layer", "tipo_rede",
        "ct_ini", "ct_fim", "cf_ini", "cf_fim", "prof_ini", "prof_fim"
    ]
    
    with open(saida_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=colunas, extrasaction='ignore')
        writer.writeheader()
        
        for t in trechos:
            row = t.copy()
            row["tipo_rede"] = "ESGOTO" if not t.get("is_agua") else "AGUA"
            writer.writerow(row)
    
    print(f"  📊 Trechos exportados: {saida_path}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nExemplos:")
        print('  python integrador_nova_ns.py "C:\\DXFs\\TETEU"')
        print('  python integrador_nova_ns.py "C:\\DXFs" --saida "C:\\SAIDA_NS"')
        sys.exit(1)
    
    pasta_dxfs = Path(sys.argv[1])
    
    # Parsear argumento --saida
    saida_dir = None
    if "--saida" in sys.argv:
        idx = sys.argv.index("--saida")
        if idx + 1 < len(sys.argv):
            saida_dir = sys.argv[idx + 1]
    
    # Processar
    if pasta_dxfs.is_file():
        # Único arquivo
        resultado = processar_dxf(pasta_dxfs, saida_dir)
        if resultado and resultado.get("sucesso"):
            print(f"\n✅ Processamento concluído!")
            print(f"   PVs: {len(resultado['pvs'])}")
            print(f"   Trechos: {len(resultado['trechos'])}")
        else:
            print(f"\n❌ Falha no processamento")
            sys.exit(1)
    else:
        # Pasta
        stats = processar_pasta(pasta_dxfs, saida_dir)
        if stats["falha"] > 0:
            sys.exit(1)


if __name__ == "__main__":
    main()
