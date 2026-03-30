#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LER_DWG_DIRETO.py — Lê DWG SEM ABRIR CIVIL 3D

MÉTODOS:
1. ODA File Converter (gratuito) - DWG → DXF
2. libredwg - Lê DWG diretamente (Linux/WSL)
3. ezdxf + ODA - Lê entidades AEC do DXF convertido

USO:
  python LER_DWG_DIRETO.py "CAMINHO\ARQUIVO.dwg"
"""

import sys
import os
import subprocess
import tempfile
import json
from pathlib import Path
import re

# ===================== CONFIGURAÇÃO =====================

DWG_PATH = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA.dwg"

if len(sys.argv) > 1:
    DWG_PATH = sys.argv[1]

# Caminhos do ODA File Converter
ODA_PATHS = [
    r"C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe",
    r"C:\Program Files (x86)\ODA\ODAFileConverter\ODAFileConverter.exe",
]

# ===================== MÉTODO 1: ODA FILE CONVERTER =====================

def encontrar_oda():
    """Encontra ODA File Converter instalado."""
    for path in ODA_PATHS:
        if os.path.exists(path):
            return path
    return None

def converter_dwg_dxf_oda(dwg_path):
    """
    Converte DWG → DXF usando ODA File Converter (SEM ABRIR CIVIL 3D).
    
    ODA File Converter é gratuito e lê DWG nativamente.
    Download: https://www.opendesign.com/guestfiles/oda_file_converter
    """
    oda_exe = encontrar_oda()
    
    if not oda_exe:
        print("❌ ODA File Converter não encontrado")
        print("   Download: https://www.opendesign.com/guestfiles/oda_file_converter")
        return None
    
    print(f"✅ ODA encontrado: {oda_exe}")
    
    # Criar pasta temporária
    tmp_dir = tempfile.mkdtemp()
    dwg_name = Path(dwg_path).stem
    
    print(f"\n🔄 Convertendo DWG → DXF...")
    print(f"   Entrada: {dwg_path}")
    print(f"   Saída: {tmp_dir}\\{dwg_name}.dxf")
    
    # Comando ODA
    # ODAFileConverter.exe <input> <output> <version> <audit> <purge> <explode>
    cmd = [
        oda_exe,
        str(Path(dwg_path).parent),  # Input folder
        tmp_dir,                      # Output folder
        "ACAD2018",                  # Version
        "0",                         # Audit (0=No, 1=Yes)
        "0",                         # Purge (0=No, 1=Yes)
        "1",                         # Explode AEC (1=Yes!) ← IMPORTANTE!
    ]
    
    print(f"   Comando: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        print(f"   Exit code: {result.returncode}")
        
        if result.returncode == 0:
            dxf_saida = Path(tmp_dir) / f"{dwg_name}.dxf"
            if dxf_saida.exists():
                print(f"✅ DXF criado: {dxf_saida}")
                print(f"   Tamanho: {dxf_saida.stat().st_size / 1024:.0f} KB")
                return str(dxf_saida)
        
        print("❌ Falha na conversão")
        if result.stderr:
            print(f"   Erro: {result.stderr.decode()}")
        return None
        
    except subprocess.TimeoutExpired:
        print("❌ Timeout na conversão (120s)")
        return None
    except Exception as e:
        print(f"❌ Erro: {e}")
        return None

# ===================== MÉTODO 2: LEITURA DO DXF =====================

def ler_dxf_completo(dxf_path):
    """
    Lê DXF e extrai TODAS as informações disponíveis.
    """
    try:
        import ezdxf
    except ImportError:
        print("❌ ezdxf não instalado: pip install ezdxf")
        return None, None
    
    print(f"\n📖 Lendo DXF: {Path(dxf_path).name}")
    
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    
    # Contar entidades
    counts = {}
    for e in msp:
        t = e.dxftype()
        counts[t] = counts.get(t, 0) + 1
    
    print(f"\n📊 ENTIDADES NO DXF:")
    for t, c in sorted(counts.items(), key=lambda x: -x[1])[:20]:
        print(f"   {t:20s}: {c}")
    
    # Extrair TEXTOS
    print(f"\n📝 EXTRAINDO TEXTOS...")
    textos = []
    for e in msp:
        if e.dxftype() in ('TEXT', 'MTEXT'):
            try:
                txt = e.dxf.text if e.dxftype() == 'TEXT' else e.plain_mtext()
                textos.append({
                    'layer': e.dxf.layer,
                    'text': txt,
                    'x': e.dxf.insert.x,
                    'y': e.dxf.insert.y,
                })
            except:
                pass
    
    print(f"   Textos encontrados: {len(textos)}")
    
    # Agrupar por layer
    por_layer = {}
    for t in textos:
        layer = t['layer']
        if layer not in por_layer:
            por_layer[layer] = []
        por_layer[layer].append(t)
    
    print(f"\n   TEXTOS POR LAYER:")
    for layer, lista in sorted(por_layer.items()):
        print(f"   {layer:40s}: {len(lista)} textos")
    
    # Mostrar amostra de cada layer importante
    print(f"\n   AMOSTRA DE TEXTOS (por layer):")
    layers_importante = [l for l in por_layer.keys() if 'PONTOS' in l.upper() or 'PV' in l.upper() or 'TEXTO' in l.upper()][:10]
    
    for layer in layers_importante:
        lista = por_layer[layer]
        print(f"\n   ── {layer} ({len(lista)} textos) ──")
        for i, t in enumerate(lista[:5]):
            txt = t['text'].replace('\n', '\\n')[:80]
            print(f"     {i+1}. {txt} @({t['x']:.1f},{t['y']:.1f})")
        if len(lista) > 5:
            print(f"     ... e mais {len(lista)-5}")
    
    # Extrair POLYLINES (tubos)
    print(f"\n🔗 EXTRAINDO POLYLINES (tubos)...")
    tubos = []
    for e in msp:
        if e.dxftype() == 'LWPOLYLINE':
            pts = list(e.get_points())
            if len(pts) >= 2:
                p0 = (pts[0][0], pts[0][1])
                p1 = (pts[-1][0], pts[-1][1])
                ext = ((p1[0]-p0[0])**2 + **(p1[1]-p0[1])2)**0.5
                
                # Filtrar tubos reais (> 2m)
                if ext > 2.0:
                    tubos.append({
                        'layer': e.dxf.layer,
                        'pt_ini': p0,
                        'pt_fim': p1,
                        'ext_m': round(ext, 2),
                        'coords': pts,
                    })
    
    print(f"   Polylines >2m: {len(tubos)}")
    
    # Filtrar por layer de tubo
    layers_tubo = [l for l in set(t['layer'] for t in tubos) if 'TUBO' in l.upper()]
    print(f"\n   LAYERS DE TUBO: {layers_tubo}")
    
    tubos_filtrados = [t for t in tubos if t['layer'] in layers_tubo]
    print(f"   Tubos nestes layers: {len(tubos_filtrados)}")
    
    # Extrair INSERTS (blocos)
    print(f"\n📦 EXTRAINDO INSERTS (blocos)...")
    inserts = []
    for e in msp:
        if e.dxftype() == 'INSERT':
            inserts.append({
                'nome': e.dxf.name,
                'x': e.dxf.insert.x,
                'y': e.dxf.insert.y,
                'layer': e.dxf.layer,
            })
    
    print(f"   Inserts encontrados: {len(inserts)}")
    
    # Agrupar por nome de bloco
    por_bloco = {}
    for i in inserts:
        nome = i['nome']
        if nome not in por_bloco:
            por_bloco[nome] = []
        por_bloco[nome].append(i)
    
    print(f"\n   BLOCOS POR NOME:")
    for nome, lista in sorted(por_bloco.items(), key=lambda x: -len(x[1]))[:15]:
        print(f"   {nome:40s}: {len(lista)}")
    
    # Verificar XDATA
    print(f"\n🔍 VERIFICANDO XDATA...")
    tem_xdata = False
    for e in msp:
        if e.dxftype() in ('INSERT', 'LWPOLYLINE'):
            try:
                if hasattr(e, 'xdata') and e.xdata:
                    for xd in e.xdata:
                        if 'PH_DAT' in str(xd) or 'PS_DAT' in str(xd):
                            tem_xdata = True
                            print(f"   ✅ XDATA ProSaneamento encontrado: {xd}")
                            break
            except:
                pass
    
    if not tem_xdata:
        print(f"   ⚠️ Nenhum XDATA ProSaneamento encontrado")
    
    return textos, tubos, inserts

# ===================== MÉTODO 3: EXTRAIR PVs E TUBOS =====================

def extrair_pvs_tubos(textos, tubos):
    """
    Extrai PVs e tubos dos dados brutos.
    """
    print(f"\n🎯 EXTRAINDO PVs E TUBOS...")
    
    pvs = {}
    
    # Padrões para PVs
    padroes_pv = [
        r'^(PV|PI)\s*(\d+)',           # PV 10, PI 05
        r'^(PV|PI)-(\d+)',             # PV-10, PI-05
        r'^(PV|PI)_?(\d+)',            # PV_10, PV10
        r'^P\.?V\.?\s*(\d+)',          # P.V. 10, P.V.10
        r'^P\.?I\.?\s*(\d+)',          # P.I. 10
    ]
    
    # Padrões para cotas
    padroes_ct = [r'C\.?T\.?\s*([-+]?\d+\.?\d*)', r'^CT\s*([-+]?\d+\.?\d*)']
    padroes_cf = [r'C\.?F\.?\s*([-+]?\d+\.?\d*)', r'^CF\s*([-+]?\d+\.?\d*)']
    padroes_prof = [r'P\.?F\.?\s*([-+]?\d+\.?\d*)', r'^PROF\s*([-+]?\d+\.?\d*)']
    
    # Primeiro passo: identificar PVs
    print(f"\n   1. Identificando PVs nos textos...")
    pv_candidates = {}
    
    for t in textos:
        txt = t['text'].strip()
        
        for padrao in padroes_pv:
            match = re.match(padrao, txt, re.IGNORECASE)
            if match:
                tipo = match.group(1).replace('.', '')
                num = match.group(2)
                nome = f"{tipo}_{num.zfill(3)}"
                
                if nome not in pv_candidates:
                    pv_candidates[nome] = {
                        'x': t['x'],
                        'y': t['y'],
                        'textos_relacionados': [],
                    }
                
                pv_candidates[nome]['textos_relacionados'].append(t)
                break
    
    print(f"   PVs candidatos: {len(pv_candidates)}")
    
    # Segundo passo: extrair cotas de cada PV
    print(f"\n   2. Extraindo cotas dos PVs...")
    
    for nome, pv in pv_candidates.items():
        relacionados = pv['textos_relacionados']
        
        # Procurar cotas nos textos relacionados (mesma posição ou próximos)
        for t in relacionados:
            txt = t['text'].strip().upper()
            
            # CT
            for padrao in padroes_ct:
                match = re.search(padrao, txt)
                if match:
                    pv['ct'] = float(match.group(1))
                    break
            
            # CF
            for padrao in padroes_cf:
                match = re.search(padrao, txt)
                if match:
                    pv['cf'] = float(match.group(1))
                    break
            
            # PROF
            for padrao in padroes_prof:
                match = re.search(padrao, txt)
                if match:
                    pv['prof'] = float(match.group(1))
                    break
        
        # Calcular cotas faltantes
        if 'ct' in pv and 'prof' in pv and 'cf' not in pv:
            pv['cf'] = pv['ct'] - pv['prof']
        elif 'ct' in pv and 'cf' in pv and 'prof' not in pv:
            pv['prof'] = pv['ct'] - pv['cf']
        elif 'cf' in pv and 'prof' in pv and 'ct' not in pv:
            pv['ct'] = pv['cf'] + pv['prof']
        
        # Adicionar ao resultado final
        pvs[nome] = {
            'x': pv['x'],
            'y': pv['y'],
            'ct': pv.get('ct', 0),
            'cf': pv.get('cf', 0),
            'prof': pv.get('prof', 0),
        }
    
    # Mostrar PVs encontrados
    print(f"\n   PVs encontrados: {len(pvs)}")
    print(f"\n   AMOSTRA DE PVs:")
    for i, (nome, dados) in enumerate(list(pvs.items())[:10]):
        print(f"     {nome}: CT={dados['ct']:.3f}, CF={dados['cf']:.3f}, Prof={dados['prof']:.3f} @({dados['x']:.1f},{dados['y']:.1f})")
    
    # Terceiro passo: conectar tubos
    print(f"\n   3. Conectando tubos aos PVs...")
    
    trechos = []
    for tubo in tubos:
        # Encontrar PVs próximos dos endpoints
        pvi = None
        pvf = None
        min_dist = 10.0  # 10m tolerância
        
        for nome, pv in pvs.items():
            d_ini = ((pv['x'] - tubo['pt_ini'][0])**2 + **(pv['y'] - tubo['pt_ini'][1])2)**0.5
            d_fim = ((pv['x'] - tubo['pt_fim'][0])**2 + **(pv['y'] - tubo['pt_fim'][1])2)**0.5
            
            if d_ini < min_dist:
                pvi = nome
                min_dist = d_ini
            if d_fim < min_dist:
                pvf = nome
        
        if pvi and pvf and pvi != pvf:
            trechos.append({
                'pv_ini': pvi,
                'pv_fim': pvf,
                'ext_m': tubo['ext_m'],
                'layer': tubo['layer'],
            })
    
    print(f"   Trechos conectados: {len(trechos)}")
    
    return pvs, trechos

# ===================== MAIN =====================

def main():
    print("="*70)
    print("LER DWG DIRETO - SEM ABRIR CIVIL 3D")
    print("="*70)
    
    dwg_path = DWG_PATH
    
    # Verificar se arquivo existe
    if not os.path.exists(dwg_path):
        print(f"\n❌ Arquivo não encontrado: {dwg_path}")
        return 1
    
    print(f"\n📁 Arquivo: {Path(dwg_path).name}")
    print(f"   Tamanho: {os.path.getsize(dwg_path) / 1024 / 1024:.2f} MB")
    print(f"   Existe: {os.path.exists(dwg_path)}")
    
    # Método 1: ODA File Converter
    print("\n" + "="*70)
    print("MÉTODO 1: ODA FILE CONVERTER")
    print("="*70)
    
    dxf_path = converter_dwg_dxf_oda(dwg_path)
    
    if not dxf_path:
        print("\n❌ Não foi possível converter o DWG")
        print("\nTentativas:")
        print("1. Instalar ODA File Converter:")
        print("   https://www.opendesign.com/guestfiles/oda_file_converter")
        print("\n2. Ou usar método alternativo (libredwg)")
        return 1
    
    # Método 2: Ler DXF
    print("\n" + "="*70)
    print("MÉTODO 2: LEITURA DO DXF")
    print("="*70)
    
    textos, tubos, inserts = ler_dxf_completo(dxf_path)
    
    if not textos:
        print("\n❌ Nenhum texto encontrado no DXF")
        return 1
    
    # Método 3: Extrair PVs e Tubos
    print("\n" + "="*70)
    print("MÉTODO 3: EXTRAIR PVs E TUBOS")
    print("="*70)
    
    pvs, trechos = extrair_pvs_tubos(textos, tubos)
    
    # Salvar resultado
    print("\n" + "="*70)
    print("SALVANDO RESULTADO")
    print("="*70)
    
    resultado = {
        'arquivo': str(dwg_path),
        'dxf_convertido': str(dxf_path) if dxf_path else None,
        'pvs': pvs,
        'trechos': trechos,
        'estatisticas': {
            'total_pvs': len(pvs),
            'total_trechos': len(trechos),
            'pvs_com_ct': len([p for p in pvs.values() if p.get('ct', 0) > 0]),
            'pvs_com_cf': len([p for p in pvs.values() if p.get('cf', 0) > 0]),
        }
    }
    
    saida = Path(dwg_path).parent / f"{Path(dwg_path).stem}_EXTRAIDO.json"
    with open(saida, 'w', encoding='utf-8') as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Dados salvos em: {saida}")
    print(f"\n📊 RESUMO FINAL:")
    print(f"   PVs: {len(pvs)} ({resultado['estatisticas']['pvs_com_ct']} com CT, {resultado['estatisticas']['pvs_com_cf']} com CF)")
    print(f"   Trechos: {len(trechos)}")
    
    print("\n" + "="*70)
    print("CONCLUÍDO!")
    print("="*70)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
