#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CORRETOR DE REDE DE ESGOTO — ConstruData SABESP v5.1

PROBLEMA IDENTIFICADO:
  - PVs do PS_PONTOS_IDENTIFICACAO_TXT estão em UTM (X~360k, Y~7.35M)
  - Tubos do TUBO_PVC estão em coordenadas locais (X<100k)
  - Snap falha → gera nós sintéticos (ND_) em excesso (52-76%)

SOLUÇÃO:
  1. Detectar CRS de cada layer (UTM vs Local)
  2. Calcular ponto de inserção do DXF (base point)
  3. Transformar tubos para UTM (ou PVs para local)
  4. Re-fazer snap com coordenadas corrigidas

USO:
  python corrigir_rede_esgoto.py TETEU_ESGOTO.dxf
  python corrigir_rede_esgoto.py --batch
"""

import sys
import os
import math
import re
import json
import time
from pathlib import Path
from collections import defaultdict
from datetime import datetime

try:
    import ezdxf
    _HAS_EZDXF = True
except ImportError:
    _HAS_EZDXF = False
    print("ERRO: ezdxf não instalado. Execute: pip install ezdxf")

# ==============================================================================
# CONFIGURAÇÃO
# ==============================================================================

CFG = {
    "tol_pv_tubo": 25.0,       # Tolerância para snap PV-tubo
    "utm_min_x": 200_000,      # Mínimo X para considerar UTM
    "utm_min_y": 1_000_000,    # Mínimo Y para considerar UTM
    "local_max": 100_000,      # Máximo para coordenada local
}

# ==============================================================================
# FUNÇÕES AUXILIARES
# ==============================================================================

def log(msg, nivel="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    icons = {"INFO": "  ", "OK": "[OK] ", "WARN": "[!] ", "ERR": "[X] ", "STEP": ">>> "}
    print(f"[{ts}] {icons.get(nivel, '  ')} {msg}")


def dist(p1, p2):
    """Distância entre dois pontos."""
    return math.hypot(p2[0] - p1[0], p2[1] - p1[1])


def detectar_crs(pontos):
    """
    Detecta se pontos estão em UTM ou coordenadas locais.
    
    Retorna: 'UTM' ou 'LOCAL'
    """
    if not pontos:
        return 'DESCONHECIDO'
    
    xs = [abs(p[0]) for p in pontos]
    ys = [abs(p[1]) for p in pontos]
    
    med_x = sorted(xs)[len(xs)//2] if xs else 0
    med_y = sorted(ys)[len(ys)//2] if ys else 0
    
    if med_x > CFG["utm_min_x"] and med_y > CFG["utm_min_y"]:
        return 'UTM'
    elif med_x < CFG["local_max"] and med_y < CFG["local_max"]:
        return 'LOCAL'
    else:
        return 'MISTO'


def calcular_deslocamento(pontos_utm, pontos_local):
    """
    Calcula o deslocamento (dx, dy) para alinhar coordenadas locais às UTM.
    
    Usa o centróide dos pontos para calcular a translação.
    """
    if not pontos_utm or not pontos_local:
        return 0, 0
    
    # Centróide UTM
    cx_utm = sum(p[0] for p in pontos_utm) / len(pontos_utm)
    cy_utm = sum(p[1] for p in pontos_utm) / len(pontos_utm)
    
    # Centróide Local
    cx_local = sum(p[0] for p in pontos_local) / len(pontos_local)
    cy_local = sum(p[1] for p in pontos_local) / len(pontos_local)
    
    dx = cx_utm - cx_local
    dy = cy_utm - cy_local
    
    return dx, dy


def aplicar_deslocamento(pontos, dx, dy):
    """Aplica deslocamento a uma lista de pontos."""
    return [(p[0] + dx, p[1] + dy) for p in pontos]


# ==============================================================================
# LEITURA DXF COM VERIFICAÇÃO CRS
# ==============================================================================

def ler_dxf_verificado(dxf_path):
    """
    Lê DXF e verifica CRS de cada layer.
    
    Retorna:
      - pvs: dict com PVs (coordenadas originais)
      - tubos: lista de tubos (coordenadas originais)
      - crs_info: dict com informações de CRS
    """
    log(f"Lendo DXF: {Path(dxf_path).name}", "STEP")
    
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    
    # Coletar entidades por layer
    layers_data = defaultdict(lambda: {"points": [], "entities": []})
    
    for e in msp:
        layer = e.dxf.layer
        
        if e.dxftype() == "LWPOLYLINE":
            pts = list(e.get_points())
            if len(pts) >= 2:
                p0 = (pts[0][0], pts[0][1])
                p1 = (pts[-1][0], pts[-1][1])
                layers_data[layer]["points"].extend([p0, p1])
                layers_data[layer]["entities"].append(e)
        
        elif e.dxftype() in ("TEXT", "MTEXT"):
            try:
                txt = e.dxf.text if e.dxftype() == "TEXT" else e.plain_mtext()
                x = e.dxf.insert.x
                y = e.dxf.insert.y
                layers_data[layer]["points"].append((x, y))
                layers_data[layer]["entities"].append({
                    "text": txt.strip(),
                    "x": x,
                    "y": y
                })
            except Exception:
                pass
    
    # Analisar CRS por layer
    crs_info = {}
    for layer, data in layers_data.items():
        pontos = data["points"]
        if pontos:
            crs = detectar_crs(pontos)
            crs_info[layer] = {
                "crs": crs,
                "count": len(pontos),
                "min_x": min(p[0] for p in pontos),
                "max_x": max(p[0] for p in pontos),
                "min_y": min(p[1] for p in pontos),
                "max_y": max(p[1] for p in pontos),
            }
    
    # Identificar layers de PVs e tubos
    layer_pv = None
    layers_tubo = []
    
    for layer in crs_info:
        if "PS_PONTOS" in layer.upper():
            layer_pv = layer
        if ("TUBO" in layer.upper() or "PROLONG" in layer.upper()) and "TXT" not in layer.upper():
            layers_tubo.append(layer)
    
    # Extrair PVs do PS_PONTOS_IDENTIFICACAO_TXT
    pvs = {}
    if layer_pv and layer_pv in layers_data:
        textos = layers_data[layer_pv]["entities"]
        pvs = _agrupar_textos_pvs(textos)
        log(f"  PS_PONTOS: {len(pvs)} PVs encontrados", "OK")
    
    # Extrair tubos
    tubos = []
    for layer in layers_tubo:
        if layer not in layers_data:
            continue
        
        for e in layers_data[layer]["entities"]:
            pts = list(e.get_points())
            if len(pts) >= 2:
                p0 = (pts[0][0], pts[0][1])
                p1 = (pts[-1][0], pts[-1][1])
                tubos.append({
                    "pt_ini": p0,
                    "pt_fim": p1,
                    "mid": ((p0[0]+p1[0])/2, (p0[1]+p1[1])/2),
                    "ext_m": dist(p0, p1),
                    "layer": layer,
                })
    
    log(f"  Tubos: {len(tubos)} encontrados", "OK")
    
    # Relatório CRS
    log("\n=== DIAGNÓSTICO CRS ===", "STEP")
    for layer, info in sorted(crs_info.items()):
        log(f"  {layer}: {info['crs']} ({info['count']} pts) | "
            f"X[{info['min_x']:.0f}..{info['max_x']:.0f}] "
            f"Y[{info['min_y']:.0f}..{info['max_y']:.0f}]")
    
    # Verificar incompatibilidade
    pvs_pontos = [(pv.get("x", 0), pv.get("y", 0)) for pv in pvs.values() if pv.get("x") is not None and pv.get("y") is not None]
    crs_pvs = detectar_crs(pvs_pontos) if pvs_pontos else "DESCONHECIDO"
    crs_tubos = detectar_crs([t["pt_ini"] for t in tubos]) if tubos else "DESCONHECIDO"
    
    log(f"\n  CRS PVs:   {crs_pvs}", "INFO")
    log(f"  CRS Tubos: {crs_tubos}", "INFO")
    
    incompativel = (crs_pvs == "UTM" and crs_tubos == "LOCAL")
    
    if incompativel:
        log("\n[!] CRS INCOMPATIVEL DETECTADO!", "WARN")
        log("  PVs em UTM, tubos em coordenadas locais", "WARN")
        
        # Calcular deslocamento
        pontos_pv = [(pv["x"], pv["y"]) for pv in pvs.values() if pv.get("x") and pv.get("y")]
        pontos_tubo = [t["pt_ini"] for t in tubos] + [t["pt_fim"] for t in tubos]
        
        dx, dy = calcular_deslocamento(pontos_pv, pontos_tubo)
        
        log(f"  Deslocamento calculado: dx={dx:+.2f}, dy={dy:+.2f}", "INFO")
        
        # Aplicar correção aos tubos
        log("  Aplicando correção aos tubos...", "STEP")
        for t in tubos:
            t["pt_ini"] = (t["pt_ini"][0] + dx, t["pt_ini"][1] + dy)
            t["pt_fim"] = (t["pt_fim"][0] + dx, t["pt_fim"][1] + dy)
            t["mid"] = ((t["pt_ini"][0] + t["pt_fim"][0])/2, 
                       (t["pt_ini"][1] + t["pt_fim"][1])/2)
        
        log(f"  Tubos corrigidos para UTM", "OK")
        
        crs_tubos_corrigido = detectar_crs([t["pt_ini"] for t in tubos])
        log(f"  CRS Tubos (corrigido): {crs_tubos_corrigido}", "OK")
    
    return pvs, tubos, crs_info


def _agrupar_textos_pvs(textos):
    """
    Agrupa textos de PVs (P.V., C.T., C.F.) por proximidade.
    
    Retorna dict: {"PV_001": {"x": x, "y": y, "ct": ct, "cf": cf, "prof": prof}}
    """
    if not textos:
        return {}
    
    # Separar por tipo
    pvs_candidatos = []
    
    for txt in textos:
        texto = txt.get("text", "").upper().strip()
        x, y = txt.get("x", 0), txt.get("y", 0)
        
        # Detectar tipo de texto
        if texto.startswith("P.V.") or texto.startswith("PV ") or texto.startswith("PI ") or re.match(r"^(PV|PI|N)_\d+", texto, re.IGNORECASE):
            pvs_candidatos.append({"tipo": "nome", "texto": texto, "x": x, "y": y})
        elif texto.startswith("C.T."):
            pvs_candidatos.append({"tipo": "ct", "texto": texto, "x": x, "y": y})
        elif texto.startswith("C.F.") or texto.startswith("P.F."):
            pvs_candidatos.append({"tipo": "cf", "texto": texto, "x": x, "y": y})
        elif texto.startswith("PROF"):
            pvs_candidatos.append({"tipo": "prof", "texto": texto, "x": x, "y": y})
    
    # Agrupar por proximidade (tolerância 5m)
    tol = 5.0
    grupos = defaultdict(list)
    
    for i, cand in enumerate(pvs_candidatos):
        if cand["tipo"] == "nome":
            # Extrair número do PV
            match = re.search(r"(\d+)", cand["texto"])
            num_pv = match.group(1) if match else str(i)
            chave = f"PV_{num_pv.zfill(3)}"
            
            # Encontrar textos próximos
            for j, outro in enumerate(pvs_candidatos):
                if i == j:
                    continue
                d = dist((cand["x"], cand["y"]), (outro["x"], outro["y"]))
                if d < tol:
                    grupos[chave].append(outro)
            
            grupos[chave].append(cand)
    
    # Processar grupos
    pvs = {}
    for nome_pv, membros in grupos.items():
        pv_data = {"id": nome_pv}
        
        for m in membros:
            if m["tipo"] == "nome":
                pv_data["x"] = m["x"]
                pv_data["y"] = m["y"]
                # Extrair número do nome
                match = re.search(r"(\d+)", m["texto"])
                if match:
                    pv_data["numero"] = match.group(1)
            elif m["tipo"] == "ct":
                match = re.search(r"[-+]?\d*\.?\d+", m["texto"])
                if match:
                    pv_data["ct"] = float(match.group())
            elif m["tipo"] in ("cf", "prof"):
                match = re.search(r"[-+]?\d*\.?\d+", m["texto"])
                if match:
                    valor = float(match.group())
                    if m["tipo"] == "cf":
                        pv_data["cf"] = valor
                    else:
                        pv_data["prof"] = valor
        
        # Calcular valores faltantes
        if "ct" in pv_data and "prof" in pv_data and "cf" not in pv_data:
            pv_data["cf"] = pv_data["ct"] - pv_data["prof"]
        elif "ct" in pv_data and "cf" in pv_data and "prof" not in pv_data:
            pv_data["prof"] = pv_data["ct"] - pv_data["cf"]
        
        if "x" in pv_data and "y" in pv_data:
            pvs[nome_pv] = pv_data
    
    return pvs


def _pv_mais_proximo(ponto, pvs, max_dist=15.0):
    """Encontra o PV mais próximo de um ponto."""
    if not pvs:
        return None
    
    melhor_nome = None
    melhor_dist = max_dist
    
    for nome, pv in pvs.items():
        if "x" not in pv or "y" not in pv:
            continue
        
        d = dist(ponto, (pv["x"], pv["y"]))
        if d < melhor_dist:
            melhor_dist = d
            melhor_nome = nome
    
    return melhor_nome


# ==============================================================================
# SNAP CORRIGIDO
# ==============================================================================

def fazer_snap_corrigido(pvs, tubos, tol_snap=25.0):
    """
    Faz snap dos tubos aos PVs com coordenadas corrigidas.
    
    Retorna lista de trechos.
    """
    log(f"\n=== SNAP CORRIGIDO (tol={tol_snap}m) ===", "STEP")
    
    trechos = []
    sem_match = 0
    
    for tb in tubos:
        pvi_nome = _pv_mais_proximo(tb["pt_ini"], pvs, tol_snap)
        pvf_nome = _pv_mais_proximo(tb["pt_fim"], pvs, tol_snap)
        
        if not pvi_nome or not pvf_nome or pvi_nome == pvf_nome:
            sem_match += 1
            continue
        
        pvi = pvs[pvi_nome]
        pvf = pvs[pvf_nome]
        
        # Validar distância PV-PV vs extensão do tubo
        d_pvs = dist((pvi["x"], pvi["y"]), (pvf["x"], pvf["y"]))
        ext_tubo = tb["ext_m"]
        
        if d_pvs > ext_tubo * 3.0:  # PVs muito distantes
            sem_match += 1
            continue
        
        trechos.append({
            "pv_ini": pvi_nome,
            "pv_fim": pvf_nome,
            "ext_m": round(ext_tubo, 2),
            "dn_mm": tb.get("dn_mm"),
            "material": tb.get("material", "PVC"),
            "layer": tb.get("layer", ""),
        })
    
    log(f"  Trechos: {len(trechos)} (sem match: {sem_match})", "OK")
    
    # Estatísticas de nós
    nos_usados = set()
    for t in trechos:
        nos_usados.add(t["pv_ini"])
        nos_usados.add(t["pv_fim"])
    
    nos_sinteticos = [n for n in nos_usados if n.startswith("ND_")]
    
    log(f"  Nós usados: {len(nos_usados)} ({len(nos_sinteticos)} sintéticos = {100*len(nos_sinteticos)/max(1,len(nos_usados)):.1f}%)", "INFO")
    
    return trechos


# ==============================================================================
# PRINCIPAL
# ==============================================================================

def processar_dxf(dxf_path, tol_snap=25.0):
    """Processa um DXF com correção CRS."""
    
    log(f"\n{'='*60}", "STEP")
    log(f"PROCESSANDO: {Path(dxf_path).name}", "STEP")
    log(f"{'='*60}", "STEP")
    
    # Ler DXF com verificação CRS
    pvs, tubos, crs_info = ler_dxf_verificado(dxf_path)
    
    if not pvs:
        log("  NENHUM PV ENCONTRADO!", "ERR")
        return None
    
    if not tubos:
        log("  NENHUM TUBO ENCONTRADO!", "ERR")
        return None
    
    # Fazer snap corrigido
    trechos = fazer_snap_corrigido(pvs, tubos, tol_snap)
    
    # Relatório final
    log(f"\n=== RELATÓRIO FINAL ===", "STEP")
    log(f"  PVs:     {len(pvs)}", "INFO")
    log(f"  Tubos:   {len(tubos)}", "INFO")
    log(f"  Trechos: {len(trechos)}", "INFO")
    
    # Calcular % de sucesso
    taxa_snap = 100 * len(trechos) / max(1, len(tubos))
    log(f"  Taxa de snap: {taxa_snap:.1f}%", "INFO")
    
    # Salvar resultados
    resultado = {
        "arquivo": Path(dxf_path).name,
        "data": datetime.now().isoformat(),
        "pvs": pvs,
        "trechos": trechos,
        "estatisticas": {
            "total_pvs": len(pvs),
            "total_tubos": len(tubos),
            "total_trechos": len(trechos),
            "taxa_snap": taxa_snap,
        }
    }
    
    # Salvar JSON
    output_json = Path(dxf_path).parent / f"{Path(dxf_path).stem}_CORRIGIDO.json"
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)
    
    log(f"\n  Resultado salvo em: {output_json}", "OK")
    
    return resultado


def main():
    if not _HAS_EZDXF:
        print("ERRO: ezdxf não instalado")
        return 1
    
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nUSO:")
        print("  python corrigir_rede_esgoto.py <arquivo.dxf>")
        print("  python corrigir_rede_esgoto.py --batch")
        return 1
    
    if sys.argv[1] == "--batch":
        # Processar todos DXFs na pasta atual
        dxf_files = list(Path(".").glob("*ESGOTO*.dxf"))
        
        if not dxf_files:
            log("Nenhum DXF de esgoto encontrado", "WARN")
            return 1
        
        log(f"Processando {len(dxf_files)} arquivos em batch", "STEP")
        
        resultados = []
        for dxf in dxf_files:
            resultado = processar_dxf(dxf)
            if resultado:
                resultados.append(resultado)
        
        log(f"\n{'='*60}", "STEP")
        log(f"BATCH CONCLUÍDO: {len(resultados)}/{len(dxf_files)} arquivos", "OK")
        
    else:
        dxf_path = sys.argv[1]
        
        if not Path(dxf_path).exists():
            log(f"Arquivo não encontrado: {dxf_path}", "ERR")
            return 1
        
        # Tolerância de snap configurável
        tol_snap = 25.0
        if "--tol" in sys.argv:
            idx = sys.argv.index("--tol")
            if idx + 1 < len(sys.argv):
                try:
                    tol_snap = float(sys.argv[idx + 1])
                except ValueError:
                    pass
        
        resultado = processar_dxf(dxf_path, tol_snap)
        
        if not resultado:
            log("Processamento falhou", "ERR")
            return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
