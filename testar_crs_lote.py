#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TESTE EM LOTE — DETECTAR CRS INCOMPATIVEL
Testa multiplos DXFs para encontrar um com CRS incompativel
"""

import sys
sys.path.insert(0, r"c:\Users\felip\Downloads\NOVA NS Versao 5")

import ezdxf
from pathlib import Path

# DXFs para testar
DXFS_TESTE = [
    r"C:\Users\felip\Downloads\cadastro-bim-sabesp\dados\Projeto Criadores- ESGOTOrev12elevatoria.dxf",
    r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\JOÃO CARLOS\JOÃO_CARLOS_ESGOTO.dxf",
    r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\PANTANAL BAIXO\PANTANAL_ESGOTO.dxf",
    r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\VILA ISRAEL\ISRAEL_ESGOTO.dxf",
    r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\SÃO MANOEL\SÃO_MANOEL_ESGOTO.dxf",
]

def verificar_crs_lote(dxf_path):
    """
    Verifica CRS de um DXF.
    Retorna (compativel, pv_x, tubo_x, mensagem)
    """
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        
        # Procurar PVs no PS_PONTOS
        pv_x = None
        for e in msp:
            if e.dxftype() == "TEXT":
                layer = e.dxf.layer
                if "PS_PONTOS" in layer.upper():
                    try:
                        pv_x = e.dxf.insert.x
                        break
                    except:
                        pass
        
        # Procurar tubos no TUBO_PVC
        tubo_x = None
        for e in msp:
            if e.dxftype() == "LWPOLYLINE":
                layer = e.dxf.layer
                if "TUBO_PVC" in layer.upper():
                    try:
                        pts = list(e.get_points())
                        if pts:
                            tubo_x = pts[0][0]
                            break
                    except:
                        pass
        
        if pv_x is None and tubo_x is None:
            return None, None, None, "Sem PVs e sem tubos encontrados"
        
        if pv_x is None:
            return None, tubo_x, None, "Sem PVs no PS_PONTOS"
        
        if tubo_x is None:
            return None, pv_x, None, "Sem tubos no TUBO_PVC"
        
        # Verificar compatibilidade
        diff = abs(pv_x - tubo_x)
        compativel = diff < 1000
        
        if compativel:
            msg = f"✅ CRS COMPATIVEL (diff={diff:,.0f})"
        elif diff < 100000:
            msg = f"⚠️ PARCIAL (diff={diff:,.0f})"
        else:
            msg = f"❌ INCOMPATIVEL (diff={diff:,.0f})"
        
        return compativel, pv_x, tubo_x, msg
        
    except Exception as e:
        return None, None, None, f"ERRO: {e}"


if __name__ == "__main__":
    print("=" * 80)
    print("TESTE DE CRS EM LOTE — DETECTAR INCOMPATIBILIDADE")
    print("=" * 80)
    print()
    
    resultados = []
    
    for dxf in DXFS_TESTE:
        if not Path(dxf).exists():
            print(f"❌ Arquivo não encontrado: {Path(dxf).name}")
            continue
        
        compativel, pv_x, tubo_x, msg = verificar_crs_lote(dxf)
        
        if compativel is None:
            print(f"⚠️ {Path(dxf).name}: {msg}")
        else:
            status = "✅" if compativel else "❌"
            print(f"{status} {Path(dxf).name}")
            print(f"   PV X={pv_x:,.0f}, Tubo X={tubo_x:,.0f} → {msg}")
            
            resultados.append({
                "dxf": dxf,
                "compativel": compativel,
                "pv_x": pv_x,
                "tubo_x": tubo_x,
            })
        
        print()
    
    # Resumo
    print("=" * 80)
    print("RESUMO")
    print("=" * 80)
    
    compativeis = [r for r in resultados if r.get("compativel")]
    incompativeis = [r for r in resultados if not r.get("compativel")]
    
    print(f"Total testados: {len(resultados)}")
    print(f"✅ Compatíveis: {len(compativeis)}")
    print(f"❌ Incompatíveis: {len(incompativeis)}")
    
    if incompativeis:
        print()
        print("DXFs COM CRS INCOMPATIVEL (ótimos para teste):")
        for r in incompativeis:
            print(f"  - {Path(r['dxf']).name}")
            print(f"    PV X={r['pv_x']:,.0f}, Tubo X={r['tubo_x']:,.0f}")
            print(f"    Diferença: {abs(r['pv_x'] - r['tubo_x']):,.0f}")
            print()
    else:
        print()
        print("⚠️ Nenhum DXF com CRS incompatível encontrado!")
        print("   Todos os DXFs testados têm PVs e tubos no mesmo CRS.")
    
    print()
