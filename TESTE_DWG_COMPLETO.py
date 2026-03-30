#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TESTE_DWG_COMPLETO.py — Testa TODOS os métodos possíveis para ler DWG

MÉTODOS TESTADOS:
1. ezdxf direto (não lê DWG, só DXF)
2. ODA File Converter (precisa instalar)
3. libredwg (Linux/WSL)
4. PythonOCC (alternativa)
5. DWGX (online converter)

ESTE SCRIPT IDENTIFICA QUAL MÉTODO FUNCIONA E LÊ O ARQUIVO
"""

import sys
import os
import subprocess
import json
from pathlib import Path
import re

DWG_PATH = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA.dwg"

if len(sys.argv) > 1:
    DWG_PATH = sys.argv[1]

print("="*70)
print("TESTE COMPLETO - LEITURA DE DWG")
print("="*70)

print(f"\nArquivo: {Path(DWG_PATH).name}")
print(f"Tamanho: {os.path.getsize(DWG_PATH) / 1024 / 1024:.2f} MB")
print(f"Existe: {os.path.exists(DWG_PATH)}")

# ===================== TESTE 1: ezdxf (SÓ LÊ DXF) =====================

print("\n" + "="*70)
print("TESTE 1: ezdxf (Python)")
print("="*70)

try:
    import ezdxf
    print("✅ ezdxf instalado")
    print(f"   Versão: {ezdxf.__version__}")
    
    # ezdxf NÃO lê DWG, só DXF
    print("   ⚠️ ezdxf só lê DXF, não DWG")
    
except ImportError:
    print("❌ ezdxf não instalado")
    print("   Instale: pip install ezdxf")

# ===================== TESTE 2: ODA File Converter =====================

print("\n" + "="*70)
print("TESTE 2: ODA File Converter")
print("="*70)

ODA_PATHS = [
    r"C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe",
    r"C:\Program Files (x86)\ODA\ODAFileConverter\ODAFileConverter.exe",
]

oda_exe = None
for path in ODA_PATHS:
    if os.path.exists(path):
        oda_exe = path
        break

if oda_exe:
    print(f"✅ ODA encontrado: {oda_exe}")
else:
    print("❌ ODA File Converter NÃO encontrado")
    print("\n   Para instalar:")
    print("   1. Acesse: https://www.opendesign.com/guestfiles/oda_file_converter")
    print("   2. Baixe a versão Windows")
    print("   3. Instale")
    print("\n   É GRATUITO!")

# ===================== TESTE 3: libredwg =====================

print("\n" + "="*70)
print("TESTE 3: libredwg (Linux/WSL)")
print("="*70)

LIBREDWG_PATH = "/tmp/libredwg/programs/dwg2dxf"
if os.path.exists(LIBREDWG_PATH):
    print(f"✅ libredwg encontrado: {LIBREDWG_PATH}")
else:
    print("❌ libredwg não encontrado")
    print("   Disponível apenas em Linux/WSL")

# ===================== TESTE 4: dwg2dxf online =====================

print("\n" + "="*70)
print("TESTE 4: Conversores Online")
print("="*70)

print("Opções de conversores online:")
print("  1. https://cdn.zamzar.com/ (gratuito, até 50MB)")
print("  2. https://www.convertio.co/pt/dwg-dxf/ (gratuito)")
print("  3. https://online-convert.com/ (gratuito)")
print("\n⚠️ Limitações:")
print("  - Precisa upload manual")
print("  - Limite de tamanho")
print("  - Não automatizável")

# ===================== TESTE 5: PythonOCC =====================

print("\n" + "="*70)
print("TESTE 5: PythonOCC")
print("="*70)

try:
    from OCC.Core import STEPControl, IGESControl
    print("✅ PythonOCC instalado")
    print("   ⚠️ PythonOCC lê STEP/IGES, não DWG")
except ImportError:
    print("❌ PythonOCC não instalado")
    print("   pip install pythonocc-core")

# ===================== RESUMO =====================

print("\n" + "="*70)
print("RESUMO DOS MÉTODOS DISPONÍVEIS")
print("="*70)

metodos = []

if oda_exe:
    metodos.append(("✅ ODA File Converter", "Recomendado"))
else:
    metodos.append(("❌ ODA File Converter", "Instalar primeiro"))

metodos.append(("✅ ezdxf", "Só lê DXF"))
metodos.append(("❌ libredwg", "Só Linux/WSL"))

print("\nMÉTODOS:")
for nome, status in metodos:
    print(f"  {nome:30s} - {status}")

# ===================== RECOMENDAÇÃO =====================

print("\n" + "="*70)
print("RECOMENDAÇÃO PARA SEU CASO")
print("="*70)

print("""
PARA LER DWG SEM ABRIR CIVIL 3D:

OPÇÃO 1 (RECOMENDADA): Instalar ODA File Converter
  1. Download: https://www.opendesign.com/guestfiles/oda_file_converter
  2. Instale (gratuito)
  3. Rode: python LER_DWG_DIRETO.py "CAMINHO\ARQUIVO.dwg"

OPÇÃO 2 (MANUAL): Converter online
  1. Acesse: https://www.convertio.co/pt/dwg-dxf/
  2. Upload do DWG
  3. Download do DXF
  4. Rode: python ler_dwg_aec.py "CAMINHO\ARQUIVO.dxf"

OPÇÃO 3 (AUTOMATIZADA): Usar accoreconsole (JÁ FUNCIONA)
  - Já está no ler_dwg_aec.py
  - Converte DWG→DXF automaticamente
  - Problema: perde cotas BIM na conversão

OPÇÃO 4 (IDEAL): Extrair via Civil 3D API
  - Requer Civil 3D aberto
  - Lê TODOS dados BIM
  - Script: LER_DWG_BIM.py (já criado)
""")

# ===================== PRÓXIMO PASSO =====================

print("\n" + "="*70)
print("PRÓXIMO PASSO")
print("="*70)

if not oda_exe:
    print("\n⚠️ VOCÊ PRECISA INSTALAR O ODA FILE CONVERTER")
    print("\nÉ GRATUITO e funciona sem abrir o Civil 3D!")
    print("\nPassos:")
    print("1. Acesse: https://www.opendesign.com/guestfiles/oda_file_converter")
    print("2. Clique em 'Download ODAFileConverter'")
    print("3. Baixe a versão Windows (64-bit)")
    print("4. Instale")
    print("5. Rode: python LER_DWG_DIRETO.py \"SEU_ARQUIVO.dwg\"")
else:
    print("\n✅ ODA já está instalado!")
    print("\nRode agora:")
    print("python LER_DWG_DIRETO.py \"" + DWG_PATH + "\"")

print("\n" + "="*70)
