#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DIAGNOSTICO SNAP DE TUBOS — TAREFA LLM-1
Testa por que tubos não estão fazendo snap com PVs
"""

import sys
import math
from pathlib import Path

# Adicionar pasta do projeto
sys.path.insert(0, r"c:\Users\felip\Downloads\NOVA NS Versao 5")

# Importar funcoes do script principal
from construdata_sabesp_v5_FINAL import (
    ler_dxf, _pv_mais_proximo, _dist, CFG, log, _LOG_ENTRIES
)

def diagnosticar_snap(dxf_path, nucleo):
    """
    Diagnostica snap de tubos → PVs.
    """
    print("=" * 70)
    print(f"DIAGNOSTICO SNAP — {nucleo.upper()}")
    print("=" * 70)
    print()
    
    # Ler DXF com ezdxf primeiro para ver layers
    import ezdxf
    doc = ezdxf.readfile(dxf_path)
    layers = [l.dxf.name for l in doc.layers]
    
    # Layers de tubo
    layers_tubo = [l for l in layers if 'TUBO' in l.upper() and not l.upper().startswith('PS_')]
    
    print(f"Arquivo: {Path(dxf_path).name}")
    print(f"Total layers: {len(layers)}")
    print(f"Layers de TUBO: {layers_tubo}")
    print()
    
    # Contar entidades por layer
    msp = doc.modelspace()
    counts = {}
    for e in msp:
        layer = e.dxf.layer
        counts[layer] = counts.get(layer, 0) + 1
    
    print("Layers com mais de 50 entidades:")
    for layer, count in sorted(counts.items(), key=lambda x: -x[1]):
        if count > 50:
            print(f"  {layer}: {count} entidades")
    print()
    
    # Ler DXF com script principal
    pvs, trechos, ruas, meta = ler_dxf(dxf_path)
    
    print(f"Resultado:")
    print(f"  PVs extraidos: {len(pvs)}")
    print(f"  Trechos gerados: {len(trechos)}")
    print(f"  Ruas: {len(ruas)}")
    print()
    
    # Estatisticas do snap
    print("Parametros de snap:")
    print(f"  tol_pv_tubo = {CFG['tol_pv_tubo']}m")
    print(f"  _snap_sint = 2.0m (nos sinteticos)")
    print()
    
    # Analisar trechos
    print("Analise dos trechos:")
    
    # Contar por faixa de extensao
    faixas = {"< 5m": 0, "5-10m": 0, "10-20m": 0, "20-50m": 0, "50m+": 0}
    for t in trechos:
        ext = t.get("ext_m", 0) or 0
        if ext < 5:
            faixas["< 5m"] += 1
        elif ext < 10:
            faixas["5-10m"] += 1
        elif ext < 20:
            faixas["10-20m"] += 1
        elif ext < 50:
            faixas["20-50m"] += 1
        else:
            faixas["50m+"] += 1
    
    for faixa, qtd in faixas.items():
        print(f"  {faixa}: {qtd} trechos")
    
    print()
    
    # Contar por DN
    dn_counts = {}
    for t in trechos:
        dn = t.get("dn_mm")
        if dn:
            dn_counts[dn] = dn_counts.get(dn, 0) + 1
    
    print("DNs encontrados:")
    for dn in sorted(dn_counts.keys()):
        print(f"  DN{dn}: {dn_counts[dn]} trechos")
    
    print()
    
    # Analisar PVs
    print("Analise dos PVs:")
    pv_tipos = {"PV": 0, "PI": 0, "ND": 0, "RG": 0}
    for pv in pvs.values():
        tipo = pv.get("tipo", "PV")
        pv_tipos[tipo] = pv_tipos.get(tipo, 0) + 1
    
    for tipo, qtd in pv_tipos.items():
        print(f"  {tipo}: {qtd}")
    
    # PVs com CT/CF
    pvs_com_ct = sum(1 for pv in pvs.values() if pv.get("ct") is not None)
    pvs_com_cf = sum(1 for pv in pvs.values() if pv.get("cf") is not None)
    pvs_com_prof = sum(1 for pv in pvs.values() if pv.get("prof") is not None)
    
    print(f"  Com CT: {pvs_com_ct}")
    print(f"  Com CF: {pvs_com_cf}")
    print(f"  Com prof: {pvs_com_prof}")
    
    print()
    
    # Sinteticos
    pvs_sint = sum(1 for pv in pvs.values() if pv.get("sintetico"))
    print(f"  Nos sinteticos: {pvs_sint}")
    
    print()
    print("=" * 70)
    
    return {
        "nucleo": nucleo,
        "pvs": len(pvs),
        "trechos": len(trechos),
        "faixas": faixas,
        "dns": dn_counts,
        "pv_tipos": pv_tipos,
        "pvs_com_ct": pvs_com_ct,
        "pvs_com_cf": pvs_com_cf,
        "pvs_sint": pvs_sint,
    }


if __name__ == "__main__":
    # DXFs de teste (caminhos corretos)
    testes = [
        # Pior caso (8%)
        (r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\VILA DOS CRIADORES\CRIADORES_ESGOTO.dxf",
         "Vila Criadores"),
        
        # Referencia (50%)
        (r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\MORRO DO TETÉU\TETÉU_ESGOTO.dxf",
         "Morro do Tetéu"),
        
        # Outros
        (r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\PANTANAL BAIXO\PANTANAL_ESGOTO.dxf",
         "Pantanal Baixo"),
        
        # Joao Carlos
        (r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\JOÃO CARLOS\JOÃO_CARLOS_ESGOTO.dxf",
         "João Carlos"),
    ]
    
    resultados = []
    for dxf, nucleo in testes:
        if Path(dxf).exists():
            try:
                r = diagnosticar_snap(dxf, nucleo)
                resultados.append(r)
                print()
            except Exception as e:
                print(f"ERRO em {nucleo}: {e}")
                print()
        else:
            print(f"Arquivo nao encontrado: {dxf}")
            print()
    
    # Resumo comparativo
    print("=" * 70)
    print("RESUMO COMPARATIVO")
    print("=" * 70)
    print(f"{'Nucleo':<20} {'PVs':>6} {'Trechos':>10} {'Sinteticos':>12}")
    print("-" * 70)
    for r in resultados:
        print(f"{r['nucleo']:<20} {r['pvs']:>6} {r['trechos']:>10} {r['pvs_sint']:>12}")
    print()
