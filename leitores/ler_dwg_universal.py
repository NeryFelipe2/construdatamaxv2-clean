#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LER_DWG_UNIVERSAL.py — Leitor DWG Multi-Método (INDEPENDENTE)

NÃO MEXE nos botões DWG existentes da GUI!
Este é um script independente para leitura de DWGs de QUALQUER software.

MÉTODOS (em ordem de tentativa):
1. ODA File Converter (Windows) - DWG → DXF + leitura
2. libredwg (Linux/WSL) - Leitura direta DWG
3. ezdxf + conversão manual - Fallback universal
4. GDAL/OGR - Leitura direta se disponível

SUPORTA:
- DWG do Civil 3D (AEC Objects)
- DWG do AutoCAD MEP
- DWG genérico (AutoCAD puro)
- DWG do MicroStation (via conversão)

USO:
  python ler_dwg_universal.py "C:\\CAMINHO\\ARQUIVO.dwg"

OU VIA PYTHON:
  from ler_dwg_universal import ler_dwg_universal
  pvs, trechos, meta = ler_dwg_universal("ARQUIVO.dwg")

Autor: Felipe Nery
Data: 2026-03-27
"""

import os
import sys
import re
import json
import subprocess
import tempfile
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURAÇÕES
# ═══════════════════════════════════════════════════════════════════════════

# Caminhos do ODA File Converter (Windows)
ODA_PATHS = [
    r"C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe",
    r"C:\Program Files (x86)\ODA\ODAFileConverter\ODAFileConverter.exe",
    r"C:\Program Files\Autodesk\DWG TrueView\ODAFileConverter.exe",
]

# libredwg (Linux/WSL)
LIBREDWG_PATHS = [
    "/usr/bin/dwg2dxf",
    "/usr/local/bin/dwg2dxf",
    "/tmp/libredwg/programs/dwg2dxf",
]

# Tolerâncias
TOL_SNAP = 3.0  # metros para snap de PVs (reduzido de 15 para evitar invenção de tubos)
MIN_EXT_TUBO = 2.0  # metros

# ═══════════════════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════════════════

def _log(msg, nivel="INFO", indent=0):
    """Log formatado."""
    prefixos = {
        "OK": "✓",
        "WARN": "!",
        "ERRO": "✗",
        "INFO": " ",
        "STEP": "▶",
    }
    prefixo = prefixos.get(nivel, " ")
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {'  ' * indent}[{prefixo}] {msg}")


# ═══════════════════════════════════════════════════════════════════════════
# MÉTODO 1: ODA FILE CONVERTER
# ═══════════════════════════════════════════════════════════════════════════

def _encontrar_oda():
    """Encontra ODA File Converter instalado."""
    for path in ODA_PATHS:
        if os.path.exists(path):
            return path
    return None


def _converter_dwg_dxf_oda(dwg_path):
    """
    Converte DWG → DXF usando ODA File Converter.
    
    Retorna caminho do DXF ou None se falhar.
    """
    oda_exe = _encontrar_oda()
    
    if not oda_exe:
        _log("ODA File Converter não encontrado", "WARN")
        return None
    
    _log(f"ODA encontrado: {oda_exe}", "OK")
    
    # Criar pasta temporária
    tmp_dir = tempfile.mkdtemp()
    
    _log(f"Convertendo DWG → DXF...", "STEP")
    _log(f"  Entrada: {Path(dwg_path).name}", indent=1)
    _log(f"  Saída: {tmp_dir}", indent=1)
    
    # Comando ODA
    cmd = [
        oda_exe,
        str(Path(dwg_path).parent),  # Input folder
        tmp_dir,                      # Output folder
        "ACAD2018",                  # Version
        "0",                         # Audit
        "0",                         # Purge
        "1",                         # Explode AEC (IMPORTANTE!)
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        
        if result.returncode == 0:
            dxf_saida = Path(tmp_dir) / f"{Path(dwg_path).stem}.dxf"
            if dxf_saida.exists() and dxf_saida.stat().st_size > 100:
                _log(f"DXF criado: {dxf_saida.stat().st_size / 1024:.0f} KB", "OK")
                return str(dxf_saida)
        
        _log(f"Falha na conversão (exit={result.returncode})", "ERRO")
        if result.stderr:
            _log(result.stderr.decode()[:200], "WARN", indent=1)
        return None
        
    except subprocess.TimeoutExpired:
        _log("Timeout na conversão (120s)", "ERRO")
        return None
    except Exception as e:
        _log(f"Erro: {e}", "ERRO")
        return None


# ═══════════════════════════════════════════════════════════════════════════
# MÉTODO 2: LIBREDWG
# ═══════════════════════════════════════════════════════════════════════════

def _encontrar_libredwg():
    """Encontra libredwg instalado."""
    for path in LIBREDWG_PATHS:
        if os.path.exists(path):
            return path
    return None


def _converter_dwg_dxf_libredwg(dwg_path):
    """
    Converte DWG → DXF usando libredwg.
    """
    libredwg_exe = _encontrar_libredwg()
    
    if not libredwg_exe:
        _log("libredwg não encontrado", "WARN")
        return None
    
    _log(f"libredwg encontrado: {libredwg_exe}", "OK")
    
    tmp_dxf = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False).name
    
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = str(Path(libredwg_exe).parent.parent / "src" / ".libs")
    
    cmd = [libredwg_exe, "-o", tmp_dxf, dwg_path]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=120)
        
        if os.path.exists(tmp_dxf) and os.path.getsize(tmp_dxf) > 100:
            _log(f"DXF criado: {os.path.getsize(tmp_dxf) / 1024:.0f} KB", "OK")
            return tmp_dxf
        
        _log(f"Falha na conversão", "ERRO")
        if result.stderr:
            _log(result.stderr[:200], "WARN", indent=1)
        
        # Cleanup
        if os.path.exists(tmp_dxf):
            os.unlink(tmp_dxf)
        return None
        
    except Exception as e:
        _log(f"Erro: {e}", "ERRO")
        if os.path.exists(tmp_dxf):
            os.unlink(tmp_dxf)
        return None


# ═══════════════════════════════════════════════════════════════════════════
# LEITURA DO DXF (COMUM A TODOS OS MÉTODOS)
# ═══════════════════════════════════════════════════════════════════════════

def _ler_dxf_completo(dxf_path):
    """
    Lê DXF e extrai TODAS as informações disponíveis.
    """
    _log(f"Lendo DXF: {Path(dxf_path).name}", "STEP")
    
    try:
        import ezdxf
    except ImportError:
        _log("ezdxf não instalado: pip install ezdxf", "ERRO")
        return None, None, None
    
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
    except Exception as e:
        _log(f"Erro ao ler DXF: {e}", "ERRO")
        return None, None, None
    
    # Contar entidades
    counts = defaultdict(int)
    for e in msp:
        counts[e.dxftype()] += 1
    
    _log(f"Entidades: {sum(counts.values())}", "OK")
    for t, c in sorted(counts.items(), key=lambda x: -x[1])[:10]:
        _log(f"  {t}: {c}", indent=1)
    
    # Extrair TEXTOS
    _log("Extraindo textos...", "INFO")
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
    
    _log(f"Textos: {len(textos)}", "OK")
    
    # Extrair POLYLINES (tubos)
    _log("Extraindo polylines...", "INFO")
    tubos = []
    for e in msp:
        if e.dxftype() == 'LWPOLYLINE':
            # Ignorar camadas clássicas de sujeira/topografia que causam tubos inventados
            layer_upper = e.dxf.layer.upper()
            if any(bad in layer_upper for bad in ["TEXT", "CURVA", "CONTORNO", "CONTOUR", "LOTE", "TERRENO", "QUADRA", "LIMITE", "DETALHE", "COTAS", "HATCH"]):
                continue
                
            pts = list(e.get_points())
            if len(pts) >= 2:
                p0 = (pts[0][0], pts[0][1])
                p1 = (pts[-1][0], pts[-1][1])
                ext = ((p1[0]-p0[0])**2 + (p1[1]-p0[1])**2)**0.5
                
                if ext > MIN_EXT_TUBO:
                    tubos.append({
                        'layer': e.dxf.layer,
                        'pt_ini': p0,
                        'pt_fim': p1,
                        'ext_m': round(ext, 2),
                        'coords': pts,
                    })
    
    _log(f"Polylines >{MIN_EXT_TUBO}m: {len(tubos)}", "OK")
    
    # Extrair INSERTS (blocos)
    _log("Extraindo inserts...", "INFO")
    inserts = []
    for e in msp:
        if e.dxftype() == 'INSERT':
            inserts.append({
                'nome': e.dxf.name,
                'x': e.dxf.insert.x,
                'y': e.dxf.insert.y,
                'layer': e.dxf.layer,
            })
    
    _log(f"Inserts: {len(inserts)}", "OK")
    
    return textos, tubos, inserts


def _extrair_pvs_tubos(textos, tubos):
    """
    Extrai PVs e tubos dos dados brutos.
    """
    _log("Extraindo PVs e tubos...", "STEP")
    
    pvs = {}
    
    # Padrões para PVs
    padroes_pv = [
        (r'^(PV|PI)\s*(\d+)', lambda m: f"{m.group(1)}_{m.group(2).zfill(3)}"),
        (r'^(PV|PI)-(\d+)', lambda m: f"{m.group(1)}_{m.group(2).zfill(3)}"),
        (r'^(PV|PI)_?(\d+)', lambda m: f"{m.group(1)}_{m.group(2).zfill(3)}"),
        (r'^P\.?V\.?\s*(\d+)', lambda m: f"PV_{m.group(1).zfill(3)}"),
        (r'^P\.?I\.?\s*(\d+)', lambda m: f"PI_{m.group(1).zfill(3)}"),
        (r'^PO[CC]O\s*[-_]?\s*(\d+)', lambda m: f"PV_{m.group(1).zfill(3)}"),
        (r'^(STRUCT|STRUCTURE)\s*[-_]?\s*(\d+)', lambda m: f"PV_{m.group(2).zfill(3)}"),
    ]
    
    # Padrões para cotas
    padroes_ct = [r'C\.?T\.?\s*([-+]?\d+[,.]?\d*)', r'^CT\s*([-+]?\d+[,.]?\d*)']
    padroes_cf = [r'C\.?F\.?\s*([-+]?\d+[,.]?\d*)', r'^CF\s*([-+]?\d+[,.]?\d*)']
    padroes_prof = [r'P\.?F\.?\s*([-+]?\d+[,.]?\d*)', r'^PROF\s*([-+]?\d+[,.]?\d*)']
    
    # Identificar PVs
    _log("  Identificando PVs...", indent=1)
    pv_candidates = {}
    
    for t in textos:
        txt = t['text'].strip()
        
        for padrao, formatter in padroes_pv:
            match = re.match(padrao, txt, re.IGNORECASE)
            if match:
                nome = formatter(match)
                
                if nome not in pv_candidates:
                    pv_candidates[nome] = {
                        'x': t['x'],
                        'y': t['y'],
                        'textos_relacionados': [],
                    }
                
                pv_candidates[nome]['textos_relacionados'].append(t)
                break
    
    _log(f"  PVs candidatos: {len(pv_candidates)}", "OK", indent=1)
    
    # Extrair cotas
    _log("  Extraindo cotas...", indent=1)
    
    for nome, pv in pv_candidates.items():
        relacionados = pv['textos_relacionados']
        
        for t in relacionados:
            txt = t['text'].strip().upper()
            
            # CT
            for padrao in padroes_ct:
                match = re.search(padrao, txt)
                if match:
                    pv['ct'] = float(match.group(1).replace(",", "."))
                    break
            
            # CF
            for padrao in padroes_cf:
                match = re.search(padrao, txt)
                if match:
                    pv['cf'] = float(match.group(1).replace(",", "."))
                    break
            
            # PROF
            for padrao in padroes_prof:
                match = re.search(padrao, txt)
                if match:
                    pv['prof'] = float(match.group(1).replace(",", "."))
                    break
        
        # Calcular cotas faltantes
        if 'ct' in pv and 'prof' in pv and 'cf' not in pv:
            pv['cf'] = pv['ct'] - pv['prof']
        elif 'ct' in pv and 'cf' in pv and 'prof' not in pv:
            pv['prof'] = pv['ct'] - pv['cf']
        elif 'cf' in pv and 'prof' in pv and 'ct' not in pv:
            pv['ct'] = pv['cf'] + pv['prof']
        
        # Adicionar ao resultado
        pvs[nome] = {
            'x': round(pv['x'], 3),
            'y': round(pv['y'], 3),
            'ct': pv.get('ct', 0),
            'cf': pv.get('cf', 0),
            'prof': pv.get('prof', 0),
        }
    
    _log(f"  PVs finais: {len(pvs)}", "OK", indent=1)
    
    # Conectar tubos
    _log("  Conectando tubos...", indent=1)
    
    trechos = []
    for tubo in tubos:
        pvi = None
        pvf = None
        min_dist = TOL_SNAP

        for nome, pv in pvs.items():
            d_ini = ((pv['x'] - tubo['pt_ini'][0])**2 + (pv['y'] - tubo['pt_ini'][1])**2)**0.5
            d_fim = ((pv['x'] - tubo['pt_fim'][0])**2 + (pv['y'] - tubo['pt_fim'][1])**2)**0.5

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
                'dn_mm': None,
                'decl_mm': None,
                'material': None,
            })
    
    _log(f"  Trechos conectados: {len(trechos)}", "OK", indent=1)
    
    return pvs, trechos


# ═══════════════════════════════════════════════════════════════════════════
# GERAR RELATÓRIOS
# ═══════════════════════════════════════════════════════════════════════════

def gerar_relatorios(pvs, trechos, meta, dwg_path, saida_dir=None):
    """
    Gera relatórios completos da leitura DWG.
    
    Args:
        pvs: dict de PVs
        trechos: lista de trechos
        meta: metadados
        dwg_path: caminho do DWG original
        saida_dir: diretório de saída (opcional)
    """
    from datetime import datetime
    
    dwg_path = Path(dwg_path)
    
    if saida_dir is None:
        saida_dir = dwg_path.parent / f"SAIDA_{dwg_path.stem}"
    else:
        saida_dir = Path(saida_dir)
    
    saida_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    _log(f"Gerando relatórios em: {saida_dir}", "STEP")
    
    # 1. Relatório JSON Completo
    resultado_json = {
        "metadata": {
            "arquivo_original": str(dwg_path),
            "timestamp": timestamp,
            "motor": meta.get("motor", "DWG_Universal"),
        },
        "estatisticas": {
            "total_pvs": len(pvs),
            "total_trechos": len(trechos),
            "extensao_total_m": round(sum(t.get('ext_m', 0) for t in trechos), 2),
            "pvs_com_ct": len([p for p in pvs.values() if p.get('ct', 0) > 0]),
            "pvs_com_cf": len([p for p in pvs.values() if p.get('cf', 0) > 0]),
            "trechos_com_dn": len([t for t in trechos if t.get('dn_mm')]),
        },
        "pvs": pvs,
        "trechos": trechos,
        "meta": meta,
    }
    
    json_path = saida_dir / f"RESULTADO_{timestamp}.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(resultado_json, f, indent=2, ensure_ascii=False)
    _log(f"  JSON: {json_path.name}", "OK")
    
    # 2. Relatório TXT Formatado
    txt_path = saida_dir / f"RELATORIO_{timestamp}.txt"
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write("="*70 + "\n")
        f.write("RELATÓRIO DE LEITURA DWG UNIVERSAL\n")
        f.write("="*70 + "\n\n")
        f.write(f"Arquivo: {dwg_path.name}\n")
        f.write(f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n")
        f.write(f"Motor: {meta.get('motor', 'DWG_Universal')}\n\n")
        
        f.write("-"*70 + "\n")
        f.write("ESTATÍSTICAS\n")
        f.write("-"*70 + "\n")
        f.write(f"  PVs: {len(pvs)}\n")
        f.write(f"  Trechos: {len(trechos)}\n")
        f.write(f"  Extensão Total: {resultado_json['estatisticas']['extensao_total_m']:,.2f}m\n")
        f.write(f"  PVs com CT: {resultado_json['estatisticas']['pvs_com_ct']}\n")
        f.write(f"  PVs com CF: {resultado_json['estatisticas']['pvs_com_cf']}\n\n")
        
        f.write("-"*70 + "\n")
        f.write("PVs ENCONTRADOS\n")
        f.write("-"*70 + "\n")
        for i, (nome, pv) in enumerate(sorted(pvs.items()), 1):
            f.write(f"{i:3d}. {nome:15s} | X={pv.get('x',0):>12.3f} | Y={pv.get('y',0):>12.3f}")
            if pv.get('ct', 0) > 0:
                f.write(f" | CT={pv['ct']:.3f}")
            if pv.get('cf', 0) > 0:
                f.write(f" | CF={pv['cf']:.3f}")
            if pv.get('prof', 0) > 0:
                f.write(f" | Prof={pv['prof']:.3f}")
            f.write("\n")
        
        f.write("\n" + "-"*70 + "\n")
        f.write("TRECHOS\n")
        f.write("-"*70 + "\n")
        for i, t in enumerate(trechos[:50], 1):  # Primeiros 50
            f.write(f"{i:3d}. {t['pv_ini']:15s} → {t['pv_fim']:15s} | ")
            f.write(f"L={t.get('ext_m',0):>8.2f}m")
            if t.get('dn_mm'):
                f.write(f" | DN={t['dn_mm']}mm")
            if t.get('layer'):
                f.write(f" | Layer={t['layer'][:20]}")
            f.write("\n")
        
        if len(trechos) > 50:
            f.write(f"\n  ... e mais {len(trechos) - 50} trechos\n")
        
        f.write("\n" + "="*70 + "\n")
        f.write("FIM DO RELATÓRIO\n")
        f.write("="*70 + "\n")
    _log(f"  TXT: {txt_path.name}", "OK")
    
    # 3. CSV de PVs
    csv_pvs_path = saida_dir / f"PVs_{timestamp}.csv"
    with open(csv_pvs_path, 'w', encoding='utf-8') as f:
        f.write("Nome,X,Y,CT,CF,Profundidade\n")
        for nome, pv in sorted(pvs.items()):
            f.write(f"{nome},{pv.get('x','')},{pv.get('y','')},{pv.get('ct','')},{pv.get('cf','')},{pv.get('prof','')}\n")
    _log(f"  CSV PVs: {csv_pvs_path.name}", "OK")
    
    # 4. CSV de Trechos
    csv_trechos_path = saida_dir / f"TRECHOS_{timestamp}.csv"
    with open(csv_trechos_path, 'w', encoding='utf-8') as f:
        f.write("PV_Ini,PV_Fim,Extensao_m,DN_mm,Declividade,Layer,Material\n")
        for t in trechos:
            f.write(f"{t['pv_ini']},{t['pv_fim']},{t.get('ext_m','')},{t.get('dn_mm','')},{t.get('decl_mm','')},{t.get('layer','')},{t.get('material','')}\n")
    _log(f"  CSV Trechos: {csv_trechos_path.name}", "OK")
    
    # 5. Resumo para impressão
    resumo_path = saida_dir / f"RESUMO_{timestamp}.txt"
    with open(resumo_path, 'w', encoding='utf-8') as f:
        f.write("="*70 + "\n")
        f.write(f"RESUMO - {dwg_path.name}\n")
        f.write("="*70 + "\n\n")
        f.write(f"PVs: {len(pvs)}\n")
        f.write(f"Trechos: {len(trechos)}\n")
        f.write(f"Extensão: {resultado_json['estatisticas']['extensao_total_m']:,.0f}m\n\n")
        f.write("Camadas encontradas:\n")
        layers = set(t.get('layer', '') for t in trechos if t.get('layer'))
        for layer in sorted(layers):
            f.write(f"  - {layer}\n")
    _log(f"  Resumo: {resumo_path.name}", "OK")
    
    return {
        "json": str(json_path),
        "txt": str(txt_path),
        "csv_pvs": str(csv_pvs_path),
        "csv_trechos": str(csv_trechos_path),
        "resumo": str(resumo_path),
        "saida_dir": str(saida_dir),
    }


# ═══════════════════════════════════════════════════════════════════════════
# FUNÇÃO PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════

def ler_dwg_universal(dwg_path, metodo_preferido=None):
    """
    Lê DWG usando múltiplos métodos (universal).
    
    Args:
        dwg_path: caminho do arquivo DWG
        metodo_preferido: 'oda', 'libredwg', ou None (auto)
    
    Returns:
        pvs: dict nome → {x, y, ct, cf, prof}
        trechos: list of {pv_ini, pv_fim, ext_m, ...}
        meta: dict com metadados
    """
    _log("="*70, "INFO")
    _log(f"LER DWG UNIVERSAL - {Path(dwg_path).name}", "STEP")
    _log("="*70, "INFO")
    
    dwg_path = str(dwg_path)
    
    if not os.path.exists(dwg_path):
        _log(f"Arquivo não encontrado: {dwg_path}", "ERRO")
        return {}, [], {"erro": "arquivo_nao_encontrado"}
    
    _log(f"Tamanho: {os.path.getsize(dwg_path) / 1024 / 1024:.2f} MB", "INFO")
    
    dxf_path = None
    
    # Tentar métodos em ordem
    if metodo_preferido == 'oda':
        dxf_path = _converter_dwg_dxf_oda(dwg_path)
    elif metodo_preferido == 'libredwg':
        dxf_path = _converter_dwg_dxf_libredwg(dwg_path)
    else:
        # Ordem de tentativa
        _log("Tentando ODA File Converter...", "STEP")
        dxf_path = _converter_dwg_dxf_oda(dwg_path)
        
        if not dxf_path:
            _log("Tentando libredwg...", "STEP")
            dxf_path = _converter_dwg_dxf_libredwg(dwg_path)
        
        if not dxf_path:
            # Fallback: tentar DXF com mesmo nome
            _log("Tentando DXF com mesmo nome...", "STEP")
            dxf_fallback = str(Path(dwg_path).with_suffix('.dxf'))
            if os.path.exists(dxf_fallback):
                dxf_path = dxf_fallback
                _log(f"DXF encontrado: {dxf_path}", "OK")
    
    if not dxf_path:
        _log("Nenhum método de conversão ODA/LibreDWG funcionou. TENTANDO FALLBACK AEC...", "WARN")
        try:
            from ler_dwg_aec import ler_dwg_aec
            _log("Acionando leitor AEC/COM nativo (Construdatamax Fallback)", "STEP")
            pvs, trechos, meta_aec = ler_dwg_aec(dwg_path)
            if pvs or trechos:
                _log("Fallback AEC concluído com sucesso!", "OK")
                # Adjust meta details for the universal return format
                meta_aec["motor"] = "AEC_Fallback_Universal"
                return pvs, trechos, meta_aec
        except Exception as e:
            _log(f"Fallback AEC também falhou: {e}", "ERRO")
            
        return {}, [], {
            "erro": "conversao_falhou",
            "obs": "Instale ODA File Converter ou AutoCAD/Civil 3D (COM)."
        }
    
    # Ler DXF
    textos, tubos, inserts = _ler_dxf_completo(dxf_path)
    
    if not textos:
        _log("Nenhum texto encontrado", "WARN")
        return {}, [], {
            "erro": "sem_dados",
            "obs": "DXF sem textos ou entidades legíveis"
        }
    
    # Extrair PVs e tubos
    pvs, trechos = _extrair_pvs_tubos(textos, tubos)

    # Cleanup
    if dxf_path and 'tmp' in dxf_path and os.path.exists(dxf_path):
        try:
            os.unlink(dxf_path)
        except:
            pass

    # Metadados
    ext_total = sum(t.get('ext_m', 0) for t in trechos)

    meta = {
        "motor": "DWG_Universal",
        "arquivo": Path(dwg_path).name,
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "extensao_m": round(ext_total, 1),
        "dxf_temp": dxf_path if dxf_path else None,
        "obs": "DWG convertido via ODA/libredwg + leitura ezdxf",
    }

    _log("="*70, "INFO")
    _log(f"RESULTADO: {len(pvs)} PVs, {len(trechos)} trechos, {ext_total:.0f}m", "OK")
    _log("="*70, "INFO")

    return pvs, trechos, meta


# ═══════════════════════════════════════════════════════════════════════════
# FUNÇÃO COM RELATÓRIOS
# ═══════════════════════════════════════════════════════════════════════════

def ler_dwg_universal_com_relatorios(dwg_path, metodo_preferido=None, saida_dir=None, gerar_rel=True):
    """
    Lê DWG e gera relatórios completos automaticamente.
    
    Args:
        dwg_path: caminho do arquivo DWG
        metodo_preferido: 'oda', 'libredwg', ou None (auto)
        saida_dir: diretório de saída para relatórios
        gerar_rel: se True, gera relatórios completos
    
    Returns:
        pvs, trechos, meta, relatorios (dict com caminhos dos arquivos)
    """
    # Ler DWG
    pvs, trechos, meta = ler_dwg_universal(dwg_path, metodo_preferido)
    
    if meta.get('erro'):
        return pvs, trechos, meta, None
    
    # Gerar relatórios
    relatorios = None
    if gerar_rel and pvs and trechos:
        relatorios = gerar_relatorios(pvs, trechos, meta, dwg_path, saida_dir)
        meta['relatorios'] = relatorios
    
    return pvs, trechos, meta, relatorios


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Ler DWG universal - múltiplos métodos"
    )
    parser.add_argument("arquivo", help="Arquivo DWG para ler")
    parser.add_argument("--metodo", "-m", choices=['oda', 'libredwg', 'auto'],
                       default='auto', help="Método de conversão")
    parser.add_argument("--saida", "-s", help="Salvar resultado em JSON")
    parser.add_argument("--relatorios", "-r", action="store_true",
                       help="Gerar relatórios completos (JSON, TXT, CSV)")
    parser.add_argument("--pasta-saida", help="Pasta para salvar relatórios")

    args = parser.parse_args()

    # Usar função com relatórios se solicitado
    if args.relatorios or args.pasta_saida:
        pvs, trechos, meta, rels = ler_dwg_universal_com_relatorios(
            args.arquivo,
            metodo_preferido=args.metodo if args.metodo != 'auto' else None,
            saida_dir=args.pasta_saida,
            gerar_rel=True
        )
    else:
        pvs, trechos, meta, rels = ler_dwg_universal(
            args.arquivo,
            metodo_preferido=args.metodo if args.metodo != 'auto' else None
        ), None, None

    if meta.get('erro'):
        print(f"\n❌ Erro: {meta['erro']}")
        if meta.get('obs'):
            print(f"   Obs: {meta['obs']}")
        sys.exit(1)

    print(f"\n📊 RESULTADO:")
    print(f"   PVs: {len(pvs)}")
    print(f"   Trechos: {len(trechos)}")
    print(f"   Extensão: {meta['extensao_m']:.1f}m")

    # Mostrar amostra de PVs
    if pvs:
        print(f"\n📍 AMOSTRA DE PVs:")
        for i, (nome, pv) in enumerate(list(pvs.items())[:5]):
            ct_str = f" CT={pv['ct']:.3f}" if pv['ct'] > 0 else ""
            cf_str = f" CF={pv['cf']:.3f}" if pv['cf'] > 0 else ""
            print(f"   {nome}: ({pv['x']:.1f},{pv['y']:.1f}){ct_str}{cf_str}")

    # Mostrar relatórios gerados
    if rels:
        print(f"\n📄 RELATÓRIOS GERADOS:")
        print(f"   📁 Pasta: {rels['saida_dir']}")
        print(f"   📄 JSON: {Path(rels['json']).name}")
        print(f"   📄 TXT: {Path(rels['txt']).name}")
        print(f"   📊 CSV PVs: {Path(rels['csv_pvs']).name}")
        print(f"   📊 CSV Trechos: {Path(rels['csv_trechos']).name}")
        print(f"   📋 Resumo: {Path(rels['resumo']).name}")

    # Salvar JSON (se --saida especificado)
    if args.saida and not rels:
        resultado = {
            'arquivo': str(args.arquivo),
            'pvs': pvs,
            'trechos': trechos,
            'meta': meta,
        }

        saida_path = Path(args.saida)
        with open(saida_path, 'w', encoding='utf-8') as f:
            json.dump(resultado, f, indent=2, ensure_ascii=False)

        print(f"\n✅ Dados salvos em: {saida_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
