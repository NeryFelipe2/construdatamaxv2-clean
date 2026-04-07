#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EXECUTAR ANALYTICS COMPLETO - GERA XLSX + JSON + GRAFICOS
Contrato 11481051 · FCN Construções · SLNR Santos
"""

import sys
from pathlib import Path

# Adicionar pasta atual ao path
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

print("\n" + "="*70)
print(" ANALYTICS ML — XGBoost + GridSearchCV")
print(" Contrato 11481051 · FCN Construções · SLNR Santos")
print("="*70 + "\n")

# Importar analytics
try:
    import construdata_analytics as anyt
except ImportError as e:
    print(f"❌ ERRO: construdata_analytics.py não encontrado!")
    print(f"   Erro: {e}")
    sys.exit(1)

# Verificar dependencias
print("[1/4] Verificando dependências...")
if not anyt.OPENPYXL_OK:
    print("  ERRO: openpyxl nao instalado!")
    print("     Instale: pip install openpyxl")
    sys.exit(1)
print("  OK openpyxl")

if not anyt.MPL_OK:
    print("  AVISO: matplotlib nao disponivel (graficos desativados)")
else:
    print("  OK matplotlib")

# Caminhos
dados_dir = SCRIPT_DIR / "dados_contrato"
saida_dir = SCRIPT_DIR / "analiticos"

path_exec = dados_dir / "EXECUCAO_DIARIA.json"
path_ml = dados_dir / "ML_DATA.json"

print(f"\n[2/4] Verificando dados...")
print(f"  Dados: {path_exec}")
if not path_exec.exists():
    print(f"  ERRO: {path_exec} nao encontrado!")
    sys.exit(1)
print(f"  OK Dados OK")

print(f"  Saida: {saida_dir}")
saida_dir.mkdir(parents=True, exist_ok=True)
print(f"  OK Pasta de saida criada")

# Executar analytics
print(f"\n[3/4] Executando Analytics ML...")
resultado = anyt.main(
    path_exec=str(path_exec),
    path_ml=str(path_ml) if path_ml.exists() else None,
    output_dir=str(saida_dir)
)

# Verificar se XLSX foi gerado
print(f"\n[4/4] Verificando arquivos gerados...")
xlsx_path = saida_dir / "ANALYTICS_SLNR.xlsx"
json_path = saida_dir / "ANALYTICS_SLNR.json"
graficos_dir = saida_dir / "graficos"

if xlsx_path.exists():
    print(f"  OK XLSX gerado: {xlsx_path.name} ({xlsx_path.stat().st_size:,} bytes)")
else:
    print(f"  ERRO: XLSX nao foi gerado!")
    
if json_path.exists():
    print(f"  OK JSON gerado: {json_path.name}")
else:
    print(f"  AVISO JSON nao foi gerado")
    
if graficos_dir.exists():
    png_files = list(graficos_dir.glob("*.png"))
    print(f"  OK {len(png_files)} graficos gerados em {graficos_dir.name}/")
else:
    print(f"  AVISO Graficos nao foram gerados")

print("\n" + "="*70)
print(" CONCLUIDO!")
print(f" Planilha: {xlsx_path}")
print(f" Graficos: {graficos_dir}")
print("="*70 + "\n")

# Abrir pasta no Explorer
import os
os.startfile(saida_dir)

print("📂 Pasta aberta no Explorer!")
print("\nPressione Enter para sair...")
input()
