#!/usr/bin/env python3
"""
LER_DXF_PROSANEAMENTO.PY — Leitor de DXF do ProSaneamento
ConstruData SABESP v9.0 — Contrato 11481051 — SLNR Santos
FCN Construções e Saneamento

Extrai PVs, trechos e ruas de DXF gerados pelo ProSaneamento,
usando as layers padronizadas PS_*.

Layers reconhecidas:
  - TUBO_PVC: linhas/polylines dos tubos de esgoto
  - PS_PONTOS_IDENTIFICACAO_TXT: textos P.V./P.I., C.T., C.F.
  - PS_IND_DIAMETRO: textos D=xxxmm
  - PS_IND_COMPRIMENTO: textos nn.nnm (extensão)
  - PS_IND_FLUXO: setas de fluxo
  - COTAS: circles (PVs em planta)
  - ZZ-Carimbo Texto: nomes de ruas

Autor: Felipe Nery — FCN / DGS Engenharia
"""

import math
import re
from pathlib import Path
from collections import defaultdict

try:
    import ezdxf
    _HAS_EZDXF = True
except ImportError:
    _HAS_EZDXF = False

try:
    import numpy as np
    _HAS_NP = True
except ImportError:
    _HAS_NP = False


def _log(msg, level="INFO"):
    """Log simples."""
    print(f"[ProSane] [{level:4s}] {msg}")


def detectar_prosaneamento(path):
    """
    Verifica se um DXF é do ProSaneamento (tem layers PS_*).
    Retorna True se pelo menos 3 layers PS_ forem encontradas.
    """
    if not _HAS_EZDXF:
        return False
    try:
        doc = ezdxf.readfile(str(path))
        layers = [l.dxf.name for l in doc.layers]
        ps_layers = [l for l in layers if l.startswith("PS_")]
        return len(ps_layers) >= 3
    except Exception:
        return False


def ler_dxf_prosaneamento(path):
    """
    Lê um DXF do ProSaneamento e retorna (pvs, trechos, ruas, meta).
    
    Retorno compatível com ler_dxf_gdal e ler_landxml:
      pvs: dict { "PV-NN": {nome, x, y, ct, cf, prof, ...} }
      trechos: list [ {pv_ini, pv_fim, dn_mm, ext_m, decl_mm, material, rua, ...} ]
      ruas: list [ "Rua X", "Beco Y", ... ]
      meta: dict { motor, n_pvs, n_trechos, ... }
    """
    if not _HAS_EZDXF:
        raise ImportError("ezdxf não disponível")
    
    _log(f">>> Lendo DXF ProSaneamento: {Path(path).name}")
    
    doc = ezdxf.readfile(str(path))
    msp = doc.modelspace()
    
    # ═══════════════════════════════════════════════════════════════
    # 1. Coletar TODOS os textos
    # ═══════════════════════════════════════════════════════════════
    all_texts = []
    for e in msp:
        if e.dxftype() in ("TEXT", "MTEXT"):
            txt = e.dxf.text if e.dxftype() == "TEXT" else e.text
            if txt:
                pos = e.dxf.insert if hasattr(e.dxf, 'insert') else None
                x = pos.x if pos else 0
                y = pos.y if pos else 0
                all_texts.append({
                    "text": txt.strip(),
                    "layer": e.dxf.layer,
                    "x": float(x),
                    "y": float(y),
                })
    
    _log(f"Textos totais: {len(all_texts)}")
    
    # ═══════════════════════════════════════════════════════════════
    # 2. Extrair PVs (PS_PONTOS_IDENTIFICACAO_TXT)
    # Padrão: P.V. NN / P.I. NN / C.T. xx.xxx / C.F. xx.xxx / prof
    # Os textos estão empilhados verticalmente no mesmo X
    # Filtrar apenas coordenadas >1000 (excluir perfis)
    # ═══════════════════════════════════════════════════════════════
    ps_texts = [t for t in all_texts
                if "PS_PONTOS" in t["layer"] and t["x"] > 1000]
    
    # Ordenar por X, depois por Y desc
    ps_texts.sort(key=lambda t: (round(t["x"], 0), -t["y"]))
    
    # Agrupar por proximidade X (mesmo PV = mesmo X, tolerância 3m)
    pv_groups = []
    current_group = []
    current_x = None
    
    for t in ps_texts:
        if current_x is None or abs(t["x"] - current_x) > 3.0:
            if current_group:
                pv_groups.append(current_group)
            current_group = [t]
            current_x = t["x"]
        else:
            current_group.append(t)
    if current_group:
        pv_groups.append(current_group)
    
    # Parsear cada grupo
    pvs = {}
    for group in pv_groups:
        pv_name = None
        ct = None
        cf = None
        prof = None
        x = group[0]["x"]
        y = None
        
        for t in group:
            txt = t["text"]
            
            # Nome do PV
            m = re.match(r'^P\.\s*(V|I)\.\s*(\d+)', txt)
            if m:
                tipo = "PV" if m.group(1) == "V" else "PI"
                num = m.group(2)
                pv_name = f"{tipo}-{num}"
                y = t["y"]
                continue
            
            # Cota Terreno
            m = re.match(r'^C\.T\.\s*([-\d.]+)', txt)
            if m:
                ct = float(m.group(1))
                continue
            
            # Cota Fundo
            m = re.match(r'^C\.F\.\s*([-\d.]+)', txt)
            if m:
                cf = float(m.group(1))
                continue
            
            # Profundidade Furo (P.F.)
            m = re.match(r'^P\.F\.\s*([-\d.]+)', txt)
            if m:
                continue  # Apenas texto, não usamos diretamente
            
            # Profundidade/EST
            if txt.upper().startswith("EST"):
                continue
            
            # Número solto (profundidade)
            m = re.match(r'^(\d+\.\d+)$', txt)
            if m and pv_name:
                prof = float(m.group(1))
        
        if pv_name and ct is not None:
            if cf is None:
                cf = ct - (prof or 1.5)
            if prof is None:
                prof = ct - cf if cf < ct else 1.5
            
            pvs[pv_name] = {
                "nome": pv_name,
                "x": round(x, 3),
                "y": round(y, 3) if y else 0,
                "ct": round(ct, 3),
                "cf": round(cf, 3),
                "prof": round(abs(prof), 3),
                "fonte": "ProSaneamento",
            }
    
    _log(f"PVs extraídos: {len(pvs)}")
    
    # ═══════════════════════════════════════════════════════════════
    # 3. Extrair Tubos (TUBO_PVC)
    # ═══════════════════════════════════════════════════════════════
    tubos = []
    for e in msp:
        if e.dxf.layer == "TUBO_PVC":
            if e.dxftype() == "LINE":
                s = (float(e.dxf.start.x), float(e.dxf.start.y))
                en = (float(e.dxf.end.x), float(e.dxf.end.y))
                length = math.dist(s, en)
                if length > 1.0:
                    tubos.append({"start": s, "end": en, "length": round(length, 2)})
            elif e.dxftype() in ("LWPOLYLINE", "POLYLINE"):
                try:
                    if e.dxftype() == "LWPOLYLINE":
                        pts = [(float(p[0]), float(p[1])) for p in e.get_points()]
                    else:
                        pts = [(float(v.dxf.location.x), float(v.dxf.location.y))
                               for v in e.vertices]
                    if len(pts) >= 2:
                        length = sum(math.dist(pts[i], pts[i+1]) for i in range(len(pts)-1))
                        if length > 1.0:
                            tubos.append({"start": pts[0], "end": pts[-1],
                                          "length": round(length, 2)})
                except Exception:
                    pass
    
    _log(f"Tubos (TUBO_PVC): {len(tubos)}, ext={sum(t['length'] for t in tubos):.1f}m")
    
    # ═══════════════════════════════════════════════════════════════
    # 4. Associar DNs (PS_IND_DIAMETRO)
    # ═══════════════════════════════════════════════════════════════
    dn_texts = [t for t in all_texts
                if t["layer"] == "PS_IND_DIAMETRO" and t["x"] > 1000]
    
    for tubo in tubos:
        mid = ((tubo["start"][0]+tubo["end"][0])/2,
               (tubo["start"][1]+tubo["end"][1])/2)
        best_dist = float("inf")
        best_dn = 200  # default
        for dt in dn_texts:
            d = math.dist(mid, (dt["x"], dt["y"]))
            if d < best_dist:
                best_dist = d
                m = re.search(r'(\d+)\s*mm', dt["text"])
                if m:
                    best_dn = int(m.group(1))
        tubo["dn_mm"] = best_dn
    
    dns = defaultdict(int)
    for t in tubos:
        dns[t["dn_mm"]] += 1
    _log(f"DNs: {dict(sorted(dns.items()))}")
    
    # ═══════════════════════════════════════════════════════════════
    # 5. Construir trechos (associar tubos aos PVs mais próximos)
    # ═══════════════════════════════════════════════════════════════
    if pvs and _HAS_NP:
        pv_coords = np.array([[v["x"], v["y"]] for v in pvs.values()])
        pv_names = list(pvs.keys())
        
        trechos = []
        seen = set()
        
        for tubo in tubos:
            dists_s = np.hypot(pv_coords[:, 0] - tubo["start"][0],
                               pv_coords[:, 1] - tubo["start"][1])
            idx_s = int(np.argmin(dists_s))
            
            dists_e = np.hypot(pv_coords[:, 0] - tubo["end"][0],
                               pv_coords[:, 1] - tubo["end"][1])
            idx_e = int(np.argmin(dists_e))
            
            pv_ini = pv_names[idx_s]
            pv_fim = pv_names[idx_e]
            
            if pv_ini == pv_fim:
                continue
            
            key = (pv_ini, pv_fim)
            rev_key = (pv_fim, pv_ini)
            if key in seen or rev_key in seen:
                continue
            seen.add(key)
            
            cf_i = pvs[pv_ini].get("cf", 0)
            cf_f = pvs[pv_fim].get("cf", 0)
            ext = tubo["length"]
            decl = abs(cf_i - cf_f) / ext if ext > 0 else 0
            
            trechos.append({
                "pv_ini": pv_ini,
                "pv_fim": pv_fim,
                "dn_mm": tubo["dn_mm"],
                "ext_m": round(ext, 2),
                "decl_mm": round(decl, 6),
                "material": "PVC",
                "fonte": "ProSaneamento",
            })
    else:
        trechos = []
    
    _log(f"Trechos: {len(trechos)}")
    
    # ═══════════════════════════════════════════════════════════════
    # 6. Extrair ruas (ZZ-Carimbo Texto)
    # ═══════════════════════════════════════════════════════════════
    pre = ('RUA', 'BECO', 'TRAV', 'AV', 'ESTRADA', 'VIELA',
           'CAMINHO', 'ESCADARIA', 'ALAMEDA', 'ACESSO')
    rua_texts = [t for t in all_texts
                 if "ZZ" in t["layer"] and t["x"] > 1000
                 and t["text"].upper().startswith(pre)]
    
    ruas = list(set(t["text"] for t in rua_texts))
    _log(f"Ruas (ZZ-Carimbo): {len(ruas)}")
    
    # Associar ruas aos trechos por proximidade
    if rua_texts and trechos and _HAS_NP:
        rua_xy = np.array([[r["x"], r["y"]] for r in rua_texts])
        rua_txts = [r["text"] for r in rua_texts]
        
        for t in trechos:
            p0 = pvs.get(t["pv_ini"], {})
            p1 = pvs.get(t["pv_fim"], {})
            if p0.get("x") and p1.get("x"):
                mx = (p0["x"] + p1["x"]) / 2
                my = (p0["y"] + p1["y"]) / 2
                dists = np.hypot(rua_xy[:, 0] - mx, rua_xy[:, 1] - my)
                idx = int(np.argmin(dists))
                if dists[idx] <= 80.0:
                    t["rua"] = rua_txts[idx]
    
    ext_total = sum(t["ext_m"] for t in trechos)
    _log(f"[OK] ProSaneamento: {len(pvs)} PVs, {len(trechos)} trechos, "
         f"{ext_total:.1f}m, DNs: {dict(sorted(dns.items()))}")
    
    meta = {
        "motor": "ProSaneamento_DXF",
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "extensao_total": ext_total,
        "dns": dict(dns),
        "n_ruas": len(ruas),
        "arquivo": Path(path).name,
    }
    
    return pvs, trechos, ruas, meta
