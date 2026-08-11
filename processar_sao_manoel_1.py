#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Processar DWG São Manoel (1) - Pipeline Completo
"""

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

DWG_PATH = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA (1).dwg"
SAIDA_DIR = Path(r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\SÃO MANOEL (1) 26-03-2026")

def main():
    print("=" * 70)
    print("PROCESSAMENTO DWG - SÃO MANOEL / JOÃO CARLOS DA SILVA (1)")
    print("=" * 70)
    
    print(f"\n[1/1] RODANDO PIPELINE COMPLETO")
    print(f"Entrada: {Path(DWG_PATH).name}")
    print(f"Saída:   {SAIDA_DIR}")
    print("-" * 50)
    
    try:
        from construdata_pipeline import run_pipeline
        run_pipeline(DWG_PATH, nucleo="Estudo - Ct Sao Manoel E Ct Joao (1)", out_dir=str(SAIDA_DIR))
        
        print(f"\n  Pasta criada: {SAIDA_DIR.exists()}")
        
        if SAIDA_DIR.exists():
            arquivos = []
            for f in SAIDA_DIR.rglob("*"):
                if f.is_file():
                    arquivos.append(f.relative_to(SAIDA_DIR))
            
            print(f"  Arquivos gerados: {len(arquivos)}")
            for f in sorted(arquivos)[:20]:
                print(f"    - {f}")
            if len(arquivos) > 20:
                print(f"    ... e mais {len(arquivos) - 20} arquivos")
        
    except Exception as e:
        print(f"ERRO no pipeline: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 70)
    print("PROCESSAMENTO CONCLUÍDO COM SUCESSO!")
    print("=" * 70)
    print(f"\nSaída: {SAIDA_DIR}")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
