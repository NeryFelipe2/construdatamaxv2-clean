#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TESTE_DWG_SAJO_MANOEL.py - Testa conversão DWG e geração de NS
"""

import sys
import os
from pathlib import Path

# Adicionar pasta ao path
sys.path.insert(0, r"c:\Users\felip\Downloads\NOVA NS Versao 5")

from ler_dwg_aec import ler_dwg_aec

# Caminho do arquivo DWG
DWG_PATH = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA.dwg"

print("="*60)
print("TESTE DE CONVERSÃO DWG - SÃO MANOEL / JOÃO CARLOS")
print("="*60)

# Verificar se arquivo existe
if not os.path.exists(DWG_PATH):
    print(f"\nERRO: Arquivo não encontrado: {DWG_PATH}")
    sys.exit(1)

print(f"\n✅ Arquivo encontrado: {Path(DWG_PATH).name}")
print(f"   Tamanho: {os.path.getsize(DWG_PATH) / 1024 / 1024:.2f} MB")

# Tentar converter
print("\n🔄 Convertendo DWG para DXF...")
try:
    pvs, trechos, meta = ler_dwg_aec(DWG_PATH)
    
    print("\n" + "="*60)
    print("✅ CONVERSÃO CONCLUÍDA!")
    print("="*60)
    
    print(f"\n📊 RESULTADOS:")
    print(f"   • PVs encontrados: {len(pvs)}")
    print(f"   • Trechos encontrados: {len(trechos)}")
    
    if meta:
        print(f"   • Meta: {meta}")
    
    # Mostrar detalhes dos PVs
    if pvs:
        print(f"\n📍 PRIMEIROS 5 PVs:")
        for i, (nome, dados) in enumerate(list(pvs.items())[:5]):
            print(f"   {nome}: CT={dados.get('ct', 'N/A')}, CF={dados.get('cf', 'N/A')}")
    
    # Mostrar detalhes dos trechos
    if trechos:
        print(f"\n🔗 PRIMEIROS 5 TRECHOS:")
        for i, t in enumerate(trechos[:5]):
            print(f"   {i+1}. {t.get('pv_ini', 'N/A')} → {t.get('pv_fim', 'N/A')} | DN={t.get('dn_mm', 'N/A')}mm | Ext={t.get('ext_m', 0):.2f}m")
    
    # Calcular extensão total
    ext_total = sum(t.get('ext_m', 0) for t in trechos)
    print(f"\n📏 Extensão total: {ext_total:.2f}m")
    
    # Salvar resultado
    output_dir = r"c:\Users\felip\Downloads\NOVA NS Versao 5\SAIDA_DWG_TESTE"
    os.makedirs(output_dir, exist_ok=True)
    
    import json
    resultado = {
        "arquivo": Path(DWG_PATH).name,
        "pvs": {k: {kk: vv for kk, vv in v.items() if isinstance(vv, (str, int, float, type(None)))} 
                for k, v in pvs.items()},
        "trechos": trechos,
        "meta": meta,
        "estatisticas": {
            "total_pvs": len(pvs),
            "total_trechos": len(trechos),
            "extensao_total_m": ext_total,
        }
    }
    
    output_json = Path(output_dir) / "resultado.json"
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Resultado salvo em: {output_json}")
    
    # Agora gerar as Notas de Serviço
    print("\n" + "="*60)
    print("GERANDO NOTAS DE SERVIÇO...")
    print("="*60)
    
    # Extrair nome do núcleo do arquivo
    nucleo = "São Manoel e João Carlos"
    
    # Importar gerador de NS
    try:
        from gerar_ns import processar_nucleo_from_data
        
        print(f"\n📄 Processando núcleo: {nucleo}")
        print(f"📁 Saída: {output_dir}")
        
        n_ok, n_err = processar_nucleo_from_data(pvs, trechos, nucleo, output_dir)
        
        print(f"\n✅ NOTAS DE SERVIÇO GERADAS!")
        print(f"   • NS geradas com sucesso: {n_ok}")
        print(f"   • NS com erro: {n_err}")
        print(f"\n📂 Pasta de saída: {output_dir}")
        
    except ImportError as e:
        print(f"\n⚠️ Erro ao importar gerar_ns: {e}")
        print("   Tentando com construdata_sabesp_v5_FINAL...")
        
        try:
            import construdata_sabesp_v5_FINAL as v5
            
            # Criar estrutura esperada
            rede = {
                "pvs": pvs,
                "trechos": trechos,
                "meta": meta or {"tipo_rede": "ESGOTO", "nucleo": nucleo}
            }
            
            print(f"\n🔄 Usando motor v5...")
            # Salvar JSON primeiro
            json_path = Path(output_dir) / "rede.json"
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(rede, f, indent=2, ensure_ascii=False)
            
            print(f"   JSON salvo: {json_path}")
            
        except Exception as e2:
            print(f"   Erro: {e2}")
    
except Exception as e:
    print(f"\n❌ ERRO NA CONVERSÃO:")
    print(f"   {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "="*60)
print("TESTE CONCLUÍDO!")
print("="*60)
