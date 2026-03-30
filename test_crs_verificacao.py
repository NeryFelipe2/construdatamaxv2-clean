#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VERIFICACAO DE CRS — TAREFA LLM-1
Detecta se PVs e tubos estao no mesmo sistema de coordenadas
"""

import sys
sys.path.insert(0, r"c:\Users\felip\Downloads\NOVA NS Versao 5")

from construdata_sabesp_v5_FINAL import ler_dxf, _HAS_EZDXF
import ezdxf

def verificar_crs(dxf_path, nucleo):
    """
    Verifica CRS de PVs e tubos.
    """
    print("=" * 70)
    print(f"VERIFICACAO CRS — {nucleo.upper()}")
    print("=" * 70)
    print()
    
    # Ler DXF com ezdxf para verificar coords dos tubos
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    
    # Pegar primeiros PVs do PS_PONTOS
    textos_pvs = []
    for e in msp:
        if e.dxftype() == "TEXT":
            layer = e.dxf.layer
            if "PS_PONTOS" in layer.upper():
                try:
                    textos_pvs.append({
                        "layer": layer,
                        "x": e.dxf.insert.x,
                        "y": e.dxf.insert.y,
                        "text": e.dxf.text.strip()
                    })
                except:
                    pass
    
    # Pegar primeiros tubos do TUBO_PVC
    tubos_pvc = []
    for e in msp:
        if e.dxftype() == "LWPOLYLINE":
            layer = e.dxf.layer
            if "TUBO_PVC" in layer.upper():
                try:
                    pts = list(e.get_points())
                    if len(pts) >= 2:
                        tubos_pvc.append({
                            "layer": layer,
                            "x": pts[0][0],
                            "y": pts[0][1],
                            "ext": sum(pts[i].distance_to(pts[i+1]) for i in range(len(pts)-1))
                        })
                except:
                    pass
    
    print(f"Arquivo: {dxf_path.split('\\')[-1]}")
    print()
    
    # Analisar PVs
    print("PVs (PS_PONTOS_IDENTIFICACAO_TXT):")
    if textos_pvs:
        pv_x = textos_pvs[0]["x"]
        pv_y = textos_pvs[0]["y"]
        print(f"  Primeiro PV: X={pv_x:,.2f}, Y={pv_y:,.2f}")
        
        if pv_x > 700000:
            print(f"  ✅ CRS: UTM SIRGAS 2000 (X > 700,000)")
        elif pv_x > 100000:
            print(f"  ⚠️ CRS: UTM provavel (X > 100,000)")
        else:
            print(f"  ❌ CRS: Coordenadas locais (X < 100,000)")
    else:
        print(f"  ⚠️ Sem PVs no layer PS_PONTOS")
    
    print()
    
    # Analisar tubos
    print("Tubos (TUBO_PVC):")
    if tubos_pvc:
        tubo_x = tubos_pvc[0]["x"]
        tubo_y = tubos_pvc[0]["y"]
        print(f"  Primeiro tubo: X={tubo_x:,.2f}, Y={tubo_y:,.2f}")
        
        if tubo_x > 700000:
            print(f"  ✅ CRS: UTM SIRGAS 2000 (X > 700,000)")
        elif tubo_x > 100000:
            print(f"  ⚠️ CRS: UTM provavel (X > 100,000)")
        else:
            print(f"  ❌ CRS: Coordenadas locais (X < 100,000)")
    else:
        print(f"  ⚠️ Sem tubos no layer TUBO_PVC")
    
    print()
    
    # Comparar CRS
    if textos_pvs and tubos_pvc:
        pv_x = textos_pvs[0]["x"]
        tubo_x = tubos_pvc[0]["x"]
        
        diff = abs(pv_x - tubo_x)
        
        print("COMPARACAO:")
        print(f"  Diferenca X: {diff:,.2f}")
        
        if diff < 1000:
            print(f"  ✅ CRS COMPATIVEL — PVs e tubos no mesmo sistema")
            print(f"     Snap deve funcionar perfeitamente!")
        elif diff < 100000:
            print(f"  ⚠️ CRS PARCIALMENTE COMPATIVEL — diferenca de {diff:,.0f}")
            print(f"     Snap pode funcionar com tolerancia maior")
        else:
            print(f"  ❌ CRS INCOMPATIVEL — diferenca de {diff:,.0f}")
            print(f"     Snap NAO VAI FUNCIONAR sem transformacao")
            print()
            print(f"     SOLUCAO RECOMENDADA:")
            print(f"     1. Usar XDATA raw (ambos em coords locais)")
            print(f"     2. OU transformar tubos para UTM")
    
    print()
    print("=" * 70)
    print()
    
    return {
        "nucleo": nucleo,
        "pv_x": textos_pvs[0]["x"] if textos_pvs else None,
        "tubo_x": tubos_pvc[0]["x"] if tubos_pvc else None,
        "compativel": abs(textos_pvs[0]["x"] - tubos_pvc[0]["x"]) < 1000 if (textos_pvs and tubos_pvc) else None
    }


if __name__ == "__main__":
    # DXFs de teste
    testes = [
        (r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\VILA DOS CRIADORES\CRIADORES_ESGOTO.dxf",
         "Vila Criadores"),
        
        (r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\MORRO DO TETÉU\TETÉU_ESGOTO.dxf",
         "Morro do Tetéu"),
        
        (r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\PANTANAL BAIXO\PANTANAL_ESGOTO.dxf",
         "Pantanal Baixo"),
        
        (r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\JOÃO CARLOS\JOÃO_CARLOS_ESGOTO.dxf",
         "João Carlos"),
        
        (r"C:\Users\felip\Downloads\cadastro-bim-sabesp\dados\Projeto Criadores- ESGOTOrev12elevatoria.dxf",
         "Criadores Elevatoria"),
    ]
    
    resultados = []
    for dxf, nucleo in testes:
        try:
            r = verificar_crs(dxf, nucleo)
            resultados.append(r)
        except Exception as e:
            print(f"ERRO em {nucleo}: {e}")
            print()
    
    # Resumo
    print("=" * 70)
    print("RESUMO GERAL")
    print("=" * 70)
    print(f"{'Nucleo':<25} {'PV X':>15} {'Tubo X':>15} {'Status':>10}")
    print("-" * 70)
    for r in resultados:
        pv_x = f"{r['pv_x']:,.0f}" if r['pv_x'] else "N/A"
        tubo_x = f"{r['tubo_x']:,.0f}" if r['tubo_x'] else "N/A"
        status = "✅" if r['compativel'] else ("❌" if r['compativel'] is False else "⚠️")
        print(f"{r['nucleo']:<25} {pv_x:>15} {tubo_x:>15} {status:>10}")
    print()
