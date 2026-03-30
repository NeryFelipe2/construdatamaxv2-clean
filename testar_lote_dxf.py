#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
testar_lote_dxf.py — Testa motor v5 com múltiplos DXFs do ProSaneamento

Uso:
  python testar_lote_dxf.py <pasta_com_dxfs> [--resumo]

Exemplo:
  python testar_lote_dxf.py "C:\DXFs\MORRO DO TETEU"
  python testar_lote_dxf.py "C:\DXFs" --resumo
"""

import sys
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Adicionar path atual
sys.path.insert(0, str(Path(__file__).parent))

from ler_dxf_gdal import ler_dxf_gdal


def testar_dxf(dxf_path):
    """Testa um único DXF e retorna resultados."""
    resultado = {
        "arquivo": dxf_path.name,
        "sucesso": False,
        "erro": None,
        "n_pvs": 0,
        "n_trechos": 0,
        "ext_total": 0,
        "n_pvs_genericos": 0,
        "dns": [],
        "tempo": None,
    }
    
    try:
        inicio = datetime.now()
        pvs, trechos, ruas, meta = ler_dxf_gdal(str(dxf_path))
        fim = datetime.now()
        
        resultado["sucesso"] = True
        resultado["n_pvs"] = meta.get("n_pvs", len(pvs))
        resultado["n_trechos"] = meta.get("n_trechos", len(trechos))
        resultado["ext_total"] = meta.get("ext_total", sum(t['ext_m'] for t in trechos))
        resultado["n_pvs_genericos"] = meta.get("n_pvs_genericos", 0)
        resultado["tempo"] = (fim - inicio).total_seconds()
        
        # Coletar DN
        dns = [t['dn_mm'] for t in trechos if t.get('dn_mm')]
        resultado["dns"] = list(set(dns))
        
    except Exception as e:
        resultado["erro"] = str(e)
    
    return resultado


def testar_pasta(pasta_path, resumo=False):
    """Testa todos os DXFs de uma pasta."""
    pasta = Path(pasta_path)
    
    if not pasta.exists():
        print(f"❌ Pasta não encontrada: {pasta}")
        return None
    
    # Encontrar DXFs
    dxfs = list(pasta.glob("*.dxf")) + list(pasta.glob("*.DXF"))
    
    if not dxfs:
        print(f"❌ Nenhum DXF encontrado em {pasta}")
        return None
    
    print("=" * 80)
    print(f"TESTE EM LOTE — MOTOR v5 (UNIVERSAL)")
    print(f"Pasta: {pasta}")
    print(f"DXFs encontrados: {len(dxfs)}")
    print("=" * 80)
    
    resultados = []
    stats = {
        "total": len(dxfs),
        "sucesso": 0,
        "falha": 0,
        "total_pvs": 0,
        "total_trechos": 0,
        "total_extensao": 0,
        "total_genericos": 0,
        "dns_coletados": defaultdict(int),
    }
    
    for i, dxf in enumerate(sorted(dxfs), 1):
        print(f"\n[{i}/{stats['total']}] {dxf.name}")
        
        resultado = testar_dxf(dxf)
        resultados.append(resultado)
        
        if resultado["sucesso"]:
            stats["sucesso"] += 1
            stats["total_pvs"] += resultado["n_pvs"]
            stats["total_trechos"] += resultado["n_trechos"]
            stats["total_extensao"] += resultado["ext_total"]
            stats["total_genericos"] += resultado["n_pvs_genericos"]
            
            for dn in resultado["dns"]:
                stats["dns_coletados"][dn] += 1
            
            if not resumo:
                print(f"  ✅ SUCESSO")
                print(f"     PVs: {resultado['n_pvs']} ({resultado['n_pvs_genericos']} genéricos)")
                print(f"     Trechos: {resultado['n_trechos']}")
                print(f"     Extensão: {resultado['ext_total']:.0f}m")
                print(f"     DN: {', '.join(f'DN{dn}' for dn in sorted(resultado['dns']))}")
                print(f"     Tempo: {resultado['tempo']:.1f}s")
        else:
            stats["falha"] += 1
            print(f"  ❌ ERRO: {resultado['erro'][:100]}")
    
    # Resumo final
    print("\n" + "=" * 80)
    print("RESUMO FINAL")
    print("=" * 80)
    print(f"  Total DXFs:        {stats['total']}")
    print(f"  Sucesso:           {stats['sucesso']} ({stats['sucesso']/stats['total']*100:.1f}%)")
    print(f"  Falha:             {stats['falha']} ({stats['falha']/stats['total']*100:.1f}%)")
    print(f"  Total PVs:         {stats['total_pvs']}")
    print(f"  Total Trechos:     {stats['total_trechos']}")
    print(f"  Total Extensão:    {stats['total_extensao']:.0f}m")
    print(f"  PVs Genéricos:     {stats['total_genericos']}")
    
    if stats["dns_coletados"]:
        print(f"\n  Diâmetros encontrados:")
        for dn, qtd in sorted(stats["dns_coletados"].items()):
            print(f"    DN{dn}: {qtd} arquivos")
    
    # Salvar resultados JSON
    saida_json = pasta / "RESULTADOS_TESTE_V5.json"
    with open(saida_json, 'w', encoding='utf-8') as f:
        json.dump({
            "data": datetime.now().isoformat(),
            "pasta": str(pasta.absolute()),
            "estatisticas": stats,
            "resultados": resultados,
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n  📄 Resultados salvos: {saida_json}")
    print("=" * 80)
    
    return stats


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nExemplos:")
        print('  python testar_lote_dxf.py "C:\\DXFs\\TETEU"')
        print('  python testar_lote_dxf.py "C:\\DXFs" --resumo')
        sys.exit(1)
    
    pasta_path = Path(sys.argv[1])
    resumo = "--resumo" in sys.argv
    
    stats = testar_pasta(pasta_path, resumo)
    
    if stats and stats["falha"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
