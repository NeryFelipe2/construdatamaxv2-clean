#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ANALISAR_DWG.py - Analisa DWG e mostra TODOS os textos disponíveis
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, r"c:\Users\felip\Downloads\NOVA NS Versao 5")

from ler_dwg_aec import _converter_dwg_via_accoreconsole
import ezdxf
import re

DWG_PATH = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA.dwg"

print("="*70)
print("ANÁLISE DO ARQUIVO DWG - TEXTOS DISPONÍVEIS")
print("="*70)

# Converter DWG
print("\n1. Convertendo DWG para DXF...")
dxf_path = _converter_dwg_via_accoreconsole(DWG_PATH)

if not dxf_path:
    print("ERRO: Não foi possível converter o DWG!")
    sys.exit(1)

print(f"   DXF convertido: {dxf_path}")
print(f"   Tamanho: {Path(dxf_path).stat().st_size / 1024:.0f} KB")

# Manter uma cópia
import shutil
saida_dxf = Path(r"c:\Users\felip\Downloads\NOVA NS Versao 5\SAIDA_DWG_TESTE\CONVERTIDO.dxf")
shutil.copy2(dxf_path, saida_dxf)
print(f"   Cópia salva: {saida_dxf}")

# Analisar DXF
print("\n2. Analisando entidades do DXF...")
doc = ezdxf.readfile(dxf_path)
msp = doc.modelspace()

# Contar por tipo
counts = {}
for e in msp:
    t = e.dxftype()
    counts[t] = counts.get(t, 0) + 1

print("\n   ENTIDADES:")
for t, c in sorted(counts.items()):
    print(f"     {t:20s}: {c}")

# Listar layers
layers = set(e.dxf.layer for e in msp)
print(f"\n   LAYERS ({len(layers)}):")
for l in sorted(layers)[:20]:
    print(f"     {l}")
if len(layers) > 20:
    print(f"     ... e mais {len(layers)-20} layers")

# Extrair TODOS os textos
print("\n3. TEXTOS DISPONÍVEIS (todos):")
textos = []
for e in msp:
    if e.dxftype() in ('TEXT', 'MTEXT'):
        try:
            txt = e.dxf.text if e.dxftype() == 'TEXT' else e.plain_mtext()
            textos.append({
                'layer': e.dxf.layer,
                'text': txt,
                'x': e.dxf.insert.x,
                'y': e.dxf.insert.y
            })
        except:
            pass

print(f"\n   Total de textos: {len(textos)}")

# Agrupar por layer
por_layer = {}
for t in textos:
    layer = t['layer']
    if layer not in por_layer:
        por_layer[layer] = []
    por_layer[layer].append(t)

print(f"\n   TEXTOS POR LAYER:")
for layer, lista in sorted(por_layer.items()):
    print(f"\n   ── {layer} ({len(lista)} textos) ──")
    for i, t in enumerate(lista[:10]):  # Mostrar primeiros 10 de cada layer
        txt = t['text'].replace('\n', '\\n')[:70]
        print(f"     {i+1}. {txt}  @({t['x']:.1f}, {t['y']:.1f})")
    if len(lista) > 10:
        print(f"     ... e mais {len(lista)-10} textos")

# Mostrar padrões de texto encontrados
print("\n4. PADRÕES ENCONTRADOS:")
padroes = {
    'PV': r'PV\d+',
    'PI': r'PI\d+',
    'CT': r'C\.?T\.?\s*[-.]?\d+',
    'CF': r'C\.?F\.?\s*[-.]?\d+',
    'CTF': r'CTF\s*=\s*[-.]?\d+',
    'PROF': r'P\.?F\.?\s*[-.]?\d+|PROF\s*[-.]?\d+',
}

for nome, padrao in padroes.items():
    encontrados = [t for t in textos if re.search(padrao, t['text'], re.IGNORECASE)]
    if encontrados:
        print(f"\n   {nome}: {len(encontrados)} ocorrências")
        for t in encontrados[:5]:
            print(f"     • {t['text'][:50]}")

print("\n" + "="*70)
print(f"ANÁLISE CONCLUÍDA!")
print(f"DXF convertido salvo em: {saida_dxf}")
print("="*70)
