#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
motor_teteu_esgoto.py — Motor robusto para TETÉU_ESGOTO22.dxf

Princípio: NUNCA INVENTAR TUBOS/PVs
  1. Extrair TUBOS reais de layers com "TUBO", "PROLONG", "PVC", "ESGOTO"
  2. Extrair ENDPOINTS dos tubos → posições reais dos PVs
  3. Extrair TEXTOS próximos aos endpoints → nomes dos PVs
  4. Conectividade vem da topologia REAL dos tubos

Autor: Nova NS Versão 5
Data: 2026-03-29
"""

import re
import math
from pathlib import Path
from datetime import datetime
from collections import defaultdict

import numpy as np
import geopandas as gpd
from scipy.cluster.hierarchy import fclusterdata

# ─── CONFIGURAÇÕES CONSERVADORAS ─────────────────────────────────────────────
MIN_EXT_TUBO = 2.0       # Tubo < 2m é detalhe, não rede
MIN_COORD_UTM = 100000   # Coordenada < 100km é local/profilo, não planta
TOL_CLUSTER = 3.0        # Endpoints dentro de 3m = mesmo PV
TOL_LABEL_PV = 15.0      # Distância máxima texto-PV
TOL_TEXTO_TUBO = 30.0    # Distância máxima texto-tubo para DN/incl


def _log(msg, nivel="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    prefix = {"OK": "[OK]  ", "WARN": "[!]   ", "STEP": ">>> ", "INFO": "      "}.get(nivel, "      ")
    print(f"[{ts}] {prefix}{msg}")


def _parse_dn(txt):
    """Extrai DN de texto como '150mm', 'D=150', 'DN 150'."""
    if not txt:
        return None
    m = re.search(r"(\d+)\s*mm|D\s*=?\s*(\d+)|DN\s*(\d+)", str(txt), re.IGNORECASE)
    if m:
        v = int(next(g for g in m.groups() if g))
        return v if 50 <= v <= 1200 else None
    return None


def _parse_incl(txt):
    """Extrai inclinação como '0.005 m/m' ou '0.5%'."""
    if not txt:
        return None
    m = re.search(r"([\d.,]+)\s*m/m", str(txt), re.IGNORECASE)
    if m:
        return float(m.group(1).replace(",", "."))
    m = re.search(r"([\d.,]+)\s*%", str(txt))
    if m:
        return float(m.group(1).replace(",", ".")) / 100
    return None


def _parse_cota(txt):
    """Extrai cota como '100.50', 'CT 100.50', 'CF=99.80'."""
    if not txt:
        return None
    # Padrão: número decimal isolado ou após CT/CF
    m = re.search(r"(?:CT|CF|C\.?\s*T\.?|C\.?\s*F\.?)?\s*([+-]?\d+[.,]\d+)", str(txt), re.IGNORECASE)
    if m:
        try:
            return float(m.group(1).replace(",", "."))
        except:
            pass
    return None


def _coords_geom(geom):
    """Extrai coordenadas de LineString ou MultiLineString."""
    if geom is None:
        return []
    if geom.geom_type == 'LineString':
        return list(geom.coords)
    if geom.geom_type == 'MultiLineString':
        coords = []
        for part in geom.geoms:
            coords.extend(list(part.coords))
        return coords
    return []


def _nearest_text(mx, my, xy_arr, txt_arr, max_d=30.0):
    """Encontra texto mais próximo de um ponto."""
    if len(xy_arr) == 0:
        return None
    d = np.sqrt(((xy_arr - [mx, my]) ** 2).sum(axis=1))
    i = d.argmin()
    return txt_arr[i] if d[i] <= max_d else None


def _dist_min(arr, xy):
    """Distância mínima de xy até qualquer ponto em arr."""
    if len(arr) == 0:
        return float("inf")
    d = np.sqrt(((arr - xy) ** 2).sum(axis=1))
    return float(d.min())


def _agrupar_textos_pv(pv_data, tol_x=5.0, tol_y=10.0):
    """
    Agrupa textos próximos como se fossem de um único PV.
    pv_data: lista de (x, y, texto)
    """
    if not pv_data:
        return {}
    
    # Ordenar por x (agrupamento horizontal)
    data = sorted(pv_data, key=lambda r: (round(r[0] / tol_x) * tol_x, -r[1]))
    
    grupos = []
    grupo = [data[0]]
    for r in data[1:]:
        last = grupo[-1]
        if abs(r[0] - last[0]) < tol_x and abs(r[1] - last[1]) < tol_y:
            grupo.append(r)
        else:
            grupos.append(grupo)
            grupo = [r]
    grupos.append(grupo)
    
    pvs = {}
    for g in grupos:
        nome = ct = cf = prof = None
        x0, y0 = g[0][0], g[0][1]
        
        # Processar textos do grupo (do maior y para menor = de cima para baixo)
        for (rx, ry, txt) in sorted(g, key=lambda r: -r[1]):
            txt = txt.strip()
            
            # Padrão PV/PI: "PV 1", "P.V.1", "PI-100"
            m = re.match(r"P\.?\s*([VI])\.?\s*[_\s-]*(\d+)", txt, re.IGNORECASE)
            if m:
                tipo = "PI" if m.group(1).upper() == "I" else "PV"
                nome = f"{tipo}_{m.group(2)}"
                continue
            
            # Padrão apenas número: "1136" (comum em DXF ProSaneamento)
            if nome is None and re.match(r"^\d+$", txt):
                nome = f"PV_{txt}"
                continue
            
            # Cota de terreno (CT)
            m = re.match(r"C\.?\s*T\.?\s*([+-]?[\d.,]+)", txt, re.IGNORECASE)
            if m:
                try:
                    ct = float(m.group(1).replace(",", "."))
                except:
                    pass
                continue
            
            # Cota de fundo (CF)
            m = re.match(r"C\.?\s*F\.?\s*([+-]?[\d.,]+)", txt, re.IGNORECASE)
            if m:
                try:
                    cf = float(m.group(1).replace(",", "."))
                except:
                    pass
        
        # Calcular profundidade se tiver CT e CF
        if ct is not None and cf is not None:
            if cf > ct:  # Inverter se CF > CT (erro comum)
                ct, cf = cf, ct
            prof = round(ct - cf, 4)
        
        if nome:
            # Evitar duplicatas
            key, suffix = nome, 2
            while key in pvs:
                key = f"{nome}_{suffix}"
                suffix += 1
            
            pvs[key] = {
                "x_txt": x0,
                "y_txt": y0,
                "ct": ct,
                "cf": cf,
                "prof": prof,
                "textos": [t[2].strip() for t in g],
            }
    
    return pvs


def _dedup_trechos(trechos):
    """Remove trechos duplicados (mesmo par PVs), mantendo maior DN."""
    por_par = {}
    for t in trechos:
        par = tuple(sorted([t["pv_ini"], t["pv_fim"]]))
        if par not in por_par or (t.get("dn_mm") or 0) > (por_par[par].get("dn_mm") or 0):
            por_par[par] = t
    return list(por_par.values())


def _detectar_tipo_rede(dxf_path, layers):
    """Detecta se é rede de esgoto ou água pelo nome do arquivo e layers."""
    nome = Path(dxf_path).stem.upper()
    layers_upper = " ".join(str(l or "").upper() for l in layers)
    
    if "ESGOTO" in nome or "ESG" in nome:
        return "esgoto"
    if "AGUA" in nome or "ÁGUA" in nome or "AGU" in nome:
        return "agua"
    if "ESGOTO" in layers_upper or "ESG" in layers_upper:
        return "esgoto"
    if "AGUA" in layers_upper or "AGU" in layers_upper:
        return "agua"
    
    return "desconhecido"


def _extrair_tubos(gdf):
    """
    Extrai tubos de layers que claramente representam tubulação.
    CRITÉRIO CONSERVADOR: só layers com nomes inequívocos.
    EXCLUI PERFIS E DETALHES (não são tubos da planta).
    """
    layers = gdf['Layer'].unique()
    layers_tubo = []

    for layer in layers:
        layer_upper = str(layer or "").upper().strip()
        if not layer_upper:
            continue

        # Critérios de inclusão (precisa ter pelo menos um)
        # TUBO, PROLONG, CONDUTO, PIPE = inequívocos
        # "ESGOTO" ou "AGUA" sozinhos não valem (pode ser layer de pontos, texto, etc.)
        inclui = any(p in layer_upper for p in [
            "TUBO", "PROLONG", "CONDUTO", "PIPE", "COLETORA", "RECALQUE"
        ])
        
        # "LINHA" ou "ESGOTO" só valem se vier com "TUBO" ou "CONDUTO"
        if not inclui:
            if "LINHA" in layer_upper and ("TUBO" in layer_upper or "CONDUTO" in layer_upper):
                inclui = True

        # Critérios de exclusão (não pode ter nenhum)
        # PERFIL, DETALHE, CORTE = desenhos 2D de seções, NÃO são tubos reais
        # PONTOS, CAIXAS, PV = layers de pontos, não linhas
        exclui = any(p in layer_upper for p in [
            "PERFIL", "DETALHE", "CORTE", "BIFILAR", "TXT", "TEXTO", 
            "COTA", "DIMENSÃO", "HACHURA", "MOBILIÁRIO", "RUAS", "QUADRAS",
            "PONTOS", "CAIXAS", "IDENTIFICACAO", "IND_", "INDICACAO"
        ])

        if inclui and not exclui:
            layers_tubo.append(layer)

    if not layers_tubo:
        return gdf.iloc[0:0]  # GeoDataFrame vazio

    tubos = gdf[
        (gdf['Layer'].isin(layers_tubo)) &
        (gdf.geometry.geom_type.isin(['LineString', 'MultiLineString']))
    ].copy()

    tubos['ext_m'] = tubos.geometry.length
    tubos = tubos[tubos['ext_m'] > MIN_EXT_TUBO].copy()

    return tubos


def _extrair_textos(gdf, layer_nome=None):
    """Extrai textos (pontos com atributo Text)."""
    if layer_nome:
        mask = (gdf['Layer'] == layer_nome) & (gdf['Text'].notna()) & (gdf.geometry.geom_type == 'Point')
    else:
        mask = (gdf['Text'].notna()) & (gdf.geometry.geom_type == 'Point')
    
    return gdf[mask].copy()


def _associar_clusters_textos(cluster_centers, pvs_txt, ep_arr, clusters, tubo_data, tol_label=TOL_LABEL_PV):
    """
    Associa clusters de endpoints a textos de PVs.
    Usa estratégia híbrida: cluster + snap direto dos endpoints.
    """
    pvs = {}
    
    if not pvs_txt:
        # Sem textos: usar centros de cluster como PVs sem nome
        for cid, center in cluster_centers.items():
            pvs[f"PV_{cid}"] = {
                "x": float(center[0]),
                "y": float(center[1]),
                "ct": None,
                "cf": None,
                "prof": None,
            }
        return pvs
    
    txt_names = list(pvs_txt.keys())
    txt_xy = np.array([[pvs_txt[n]["x_txt"], pvs_txt[n]["y_txt"]] for n in txt_names])
    used_names = set()
    
    # Fase 1: Associar clusters a textos próximos
    for cid, center in sorted(cluster_centers.items()):
        d = np.sqrt(((txt_xy - center) ** 2).sum(axis=1))
        
        for idx in np.argsort(d):
            if d[idx] > tol_label:
                break
            
            nome = txt_names[idx]
            if nome not in used_names:
                used_names.add(nome)
                p = pvs_txt[nome].copy()
                p["x"] = float(center[0])
                p["y"] = float(center[1])
                p["_cluster"] = cid
                pvs[nome] = p
                break
    
    # Fase 2: Para clusters sem nome, tentar snap direto dos endpoints
    clusters_sem_nome = set(cluster_centers.keys()) - {p["_cluster"] for p in pvs.values() if "_cluster" in p}
    
    if clusters_sem_nome:
        # Para cada cluster sem nome, achar texto mais próximo não usado
        for cid in clusters_sem_nome:
            center = cluster_centers[cid]
            d = np.sqrt(((txt_xy - center) ** 2).sum(axis=1))
            
            # Tolerância mais generosa para clusters sem nome
            for idx in np.argsort(d):
                if d[idx] > tol_label * 2:
                    break
                
                nome = txt_names[idx]
                if nome not in used_names:
                    used_names.add(nome)
                    p = pvs_txt[nome].copy()
                    p["x"] = float(center[0])
                    p["y"] = float(center[1])
                    p["_cluster"] = cid
                    pvs[nome] = p
                    break
    
    return pvs


def _montar_trechos_direto(tubo_data, pvs, pvs_txt, clusters, dn_xy, dn_txts, incl_xy, incl_txts, tipo_rede):
    """
    Monta trechos usando snap direto dos endpoints aos PVs existentes.
    Usado como fallback para recuperar tubos que não foram conectados.
    """
    if not pvs:
        return [], 0
    
    pv_names = list(pvs.keys())
    pv_xy = np.array([[pvs[n]["x"], pvs[n]["y"]] for n in pv_names])
    
    trechos = []
    conectados = 0
    
    for i, td in enumerate(tubo_data):
        p0, p1 = td["p0"], td["p1"]
        
        # Encontrar PVs mais próximos dos endpoints
        d0 = np.sqrt(((pv_xy - p0) ** 2).sum(axis=1))
        d1 = np.sqrt(((pv_xy - p1) ** 2).sum(axis=1))
        
        idx0, idx1 = d0.argmin(), d1.argmin()
        
        # Tolerância de snap: 5m
        if d0[idx0] > 5.0 or d1[idx1] > 5.0 or idx0 == idx1:
            continue
        
        pvi = pv_names[idx0]
        pvf = pv_names[idx1]
        
        conectados += 1
        
        mid = (p0 + p1) / 2
        dn = _parse_dn(_nearest_text(mid[0], mid[1], dn_xy, dn_txts, TOL_TEXTO_TUBO))
        decl = _parse_incl(_nearest_text(mid[0], mid[1], incl_xy, incl_txts, TOL_TEXTO_TUBO))
        
        pvi_d = pvs.get(pvi, {})
        pvf_d = pvs.get(pvf, {})
        
        trechos.append({
            "pv_ini": pvi,
            "pv_fim": pvf,
            "dn_mm": dn,
            "ext_m": td["ext"],
            "decl_mm": decl,
            "decl_pct": round(decl * 100, 3) if decl else None,
            "material": "PVC",
            "rua": "Sem Rua",
            "layer": td["layer"],
            "is_agua": tipo_rede == "agua",
            "ct_ini": pvi_d.get("ct"),
            "ct_fim": pvf_d.get("ct"),
            "cf_ini": pvi_d.get("cf"),
            "cf_fim": pvf_d.get("cf"),
            "prof_ini": pvi_d.get("prof"),
            "prof_fim": pvf_d.get("prof"),
        })
    
    return trechos, conectados


def ler_dxf_teteu(dxf_path, modo="hibrido"):
    """
    Lê DXF de esgoto/água com máxima segurança contra invenção de elementos.
    
    Args:
        dxf_path: caminho para o arquivo DXF
        modo: "conservador" (só clusters) ou "hibrido" (clusters + snap direto)
    
    Retorna: (pvs, trechos, ruas, meta)
    """
    dxf_path = str(dxf_path)
    if not Path(dxf_path).exists():
        raise FileNotFoundError(f"DXF não encontrado: {dxf_path}")
    
    nome_arquivo = Path(dxf_path).name
    _log(f"Lendo DXF: {nome_arquivo}", "STEP")
    
    # ── 1. CARREGAR DXF ──────────────────────────────────────────────────────
    try:
        gdf = gpd.read_file(dxf_path, layer="entities")
    except Exception as e:
        raise ValueError(f"Erro ao ler DXF: {e}")
    
    _log(f"  Entidades carregadas: {len(gdf)}", "OK")
    
    layers = gdf['Layer'].unique()
    tipo_rede = _detectar_tipo_rede(dxf_path, layers)
    _log(f"  Tipo de rede: {tipo_rede.upper()}", "INFO")
    
    # ── 2. EXTRAIR TUBOS (ELEMENTOS REAIS) ───────────────────────────────────
    tubos = _extrair_tubos(gdf)
    _log(f"  Tubos encontrados: {len(tubos)}", "OK")
    
    if len(tubos) == 0:
        raise ValueError(
            f"Nenhum tubo encontrado no DXF. "
            f"Layers disponíveis: {', '.join(str(l) for l in layers[:10])}..."
        )
    
    # ── 3. EXTRAIR ENDPOINTS DOS TUBOS ───────────────────────────────────────
    all_endpoints = []
    tubo_data = []
    
    for _, t in tubos.iterrows():
        coords = _coords_geom(t.geometry)
        if len(coords) < 2:
            continue
        
        p0, p1 = coords[0][:2], coords[-1][:2]
        
        # Validar coordenadas UTM
        if abs(p0[0]) < MIN_COORD_UTM or abs(p1[0]) < MIN_COORD_UTM:
            continue
        
        all_endpoints.append(p0)
        all_endpoints.append(p1)
        tubo_data.append({
            "p0": np.array(p0),
            "p1": np.array(p1),
            "ext": round(float(t['ext_m']), 2),
            "layer": t.get('Layer', '')
        })
    
    ep_arr = np.array(all_endpoints)
    _log(f"  Endpoints de tubos: {len(ep_arr)}", "OK")
    
    if len(ep_arr) < 4:
        raise ValueError("Endpoints insuficientes para formar rede")
    
    # ── 4. CLUSTERIZAR ENDPOINTS = PVs REAIS ─────────────────────────────────
    try:
        clusters = fclusterdata(ep_arr, t=TOL_CLUSTER, criterion='distance')
    except Exception as e:
        raise ValueError(f"Clustering falhou: {e}")
    
    cluster_centers = {}
    for c in set(clusters):
        mask = clusters == c
        cluster_centers[c] = ep_arr[mask].mean(axis=0)
    
    _log(f"  PVs reais (clusters): {len(cluster_centers)}", "OK")
    
    # ── 5. EXTRAIR TEXTOS DE PVs ─────────────────────────────────────────────
    # Tentar layers específicas de PV primeiro
    pv_layers = [l for l in layers if 'PV' in str(l).upper() or 'PONTOS' in str(l).upper() or 'IDENTIFICACAO' in str(l).upper()]
    
    pvs_txt = {}
    
    # Tentar extrair de layers específicas
    for pv_layer in pv_layers:
        textos_pv = _extrair_textos(gdf, pv_layer)
        if len(textos_pv) > 0:
            pv_data = [(g.x, g.y, str(t)) for g, t in zip(textos_pv.geometry, textos_pv['Text'])
                       if abs(g.x) > MIN_COORD_UTM]
            pvs_txt = _agrupar_textos_pv(pv_data)
            if pvs_txt:
                _log(f"  PVs por texto ({pv_layer}): {len(pvs_txt)}", "OK")
                break
    
    # Se não encontrou, tentar todos os textos
    if not pvs_txt:
        _log("  Buscando textos em todas as layers...", "INFO")
        todos_textos = _extrair_textos(gdf)
        
        # Filtrar apenas textos que parecem nomes de PV
        pv_data = []
        for _, row in todos_textos.iterrows():
            txt = str(row['Text']).strip()
            x, y = row.geometry.x, row.geometry.y
            
            if abs(x) < MIN_COORD_UTM:
                continue
            
            # Padrões de PV
            if re.match(r"P\.?\s*([VI])\.?\s*[_\s-]*(\d+)", txt, re.IGNORECASE):
                pv_data.append((x, y, txt))
            elif re.match(r"^\d{3,4}$", txt):  # Números de 3-4 dígitos
                pv_data.append((x, y, txt))
        
        if pv_data:
            pvs_txt = _agrupar_textos_pv(pv_data)
            _log(f"  PVs por texto (geral): {len(pvs_txt)}", "OK")
    
    # ── 6. ASSOCIAR CLUSTERS A TEXTOS DE PV ──────────────────────────────────
    pvs = _associar_clusters_textos(cluster_centers, pvs_txt, ep_arr, clusters, tubo_data)
    
    # Se modo híbrido, tentar recuperar PVs restantes por snap direto
    if modo == "hibrido" and len(pvs) < len(cluster_centers):
        clusters_sem_nome = set(cluster_centers.keys()) - {p["_cluster"] for p in pvs.values() if "_cluster" in p}
        
        if clusters_sem_nome:
            _log(f"  Modo híbrido: recuperando {len(clusters_sem_nome)} clusters...", "INFO")
            
            # Criar PVs para clusters restantes usando textos não usados
            txt_names = list(pvs_txt.keys())
            txt_xy = np.array([[pvs_txt[n]["x_txt"], pvs_txt[n]["y_txt"]] for n in txt_names])
            usados = set(pvs.keys())
            
            for cid in clusters_sem_nome:
                center = cluster_centers[cid]
                d = np.sqrt(((txt_xy - center) ** 2).sum(axis=1))
                
                # Encontrar texto mais próximo não usado
                for idx in np.argsort(d):
                    if d[idx] > TOL_LABEL_PV * 2:
                        break
                    
                    nome = txt_names[idx]
                    if nome not in usados:
                        usados.add(nome)
                        p = pvs_txt[nome].copy()
                        p["x"] = float(center[0])
                        p["y"] = float(center[1])
                        p["_cluster"] = cid
                        pvs[nome] = p
                        break
    
    # Criar PVs genéricos para clusters SEM texto (tubos reais sem label)
    clusters_sem_pv = set(cluster_centers.keys()) - {p["_cluster"] for p in pvs.values() if "_cluster" in p}
    if clusters_sem_pv:
        _log(f"  Criando {len(clusters_sem_pv)} PVs genéricos (clusters sem texto)...", "INFO")
        for cid in clusters_sem_pv:
            center = cluster_centers[cid]
            pvs[f"PV_G{cid}"] = {
                "x": float(center[0]),
                "y": float(center[1]),
                "ct": None,
                "cf": None,
                "prof": None,
                "_cluster": cid,
                "_generico": True,
            }
    
    _log(f"  PVs finais: {len(pvs)}", "OK")
    
    # ── 7. EXTRAIR TEXTOS DE DN E INCLINAÇÃO ─────────────────────────────────
    # DN
    dn_layers = [l for l in layers if 'DIAM' in str(l).upper() or 'DN' in str(l).upper()]
    dn_pts = gdf.iloc[0:0]
    for dl in dn_layers:
        pts = _extrair_textos(gdf, dl)
        if len(pts) > 0:
            dn_pts = gpd.pd.concat([dn_pts, pts], ignore_index=True)
    
    dn_xy = np.array([[g.x, g.y] for g in dn_pts.geometry]) if len(dn_pts) > 0 else np.empty((0, 2))
    dn_txts = dn_pts['Text'].values if len(dn_pts) > 0 else np.array([])
    
    # Inclinação
    incl_layers = [l for l in layers if 'INCL' in str(l).upper()]
    incl_pts = gdf.iloc[0:0]
    for il in incl_layers:
        pts = _extrair_textos(gdf, il)
        if len(pts) > 0:
            incl_pts = gpd.pd.concat([incl_pts, pts], ignore_index=True)
    
    incl_xy = np.array([[g.x, g.y] for g in incl_pts.geometry]) if len(incl_pts) > 0 else np.empty((0, 2))
    incl_txts = incl_pts['Text'].values if len(incl_pts) > 0 else np.array([])
    
    _log(f"  Textos: {len(dn_txts)} DN, {len(incl_txts)} inclinação", "OK")
    
    # ── 8. MONTAR TRECHOS ────────────────────────────────────────────────────
    # Fase 1: Usar conectividade por cluster (topologia real)
    cid_to_name = {p["_cluster"]: n for n, p in pvs.items() if "_cluster" in p}

    trechos_cluster = []
    sem_pv = 0

    for i, td in enumerate(tubo_data):
        c0 = int(clusters[2 * i])
        c1 = int(clusters[2 * i + 1])

        if c0 == c1:
            continue

        pvi = cid_to_name.get(c0)
        pvf = cid_to_name.get(c1)

        if not pvi or not pvf:
            sem_pv += 1
            continue

        mid = (td["p0"] + td["p1"]) / 2

        # Extrair DN e inclinação dos textos mais próximos
        dn = _parse_dn(_nearest_text(mid[0], mid[1], dn_xy, dn_txts, TOL_TEXTO_TUBO))
        decl = _parse_incl(_nearest_text(mid[0], mid[1], incl_xy, incl_txts, TOL_TEXTO_TUBO))

        pvi_d = pvs.get(pvi, {})
        pvf_d = pvs.get(pvf, {})

        trechos_cluster.append({
            "pv_ini": pvi,
            "pv_fim": pvf,
            "dn_mm": dn,
            "ext_m": td["ext"],
            "decl_mm": decl,
            "decl_pct": round(decl * 100, 3) if decl else None,
            "material": "PVC",
            "rua": "Sem Rua",
            "layer": td["layer"],
            "is_agua": tipo_rede == "agua",
            "ct_ini": pvi_d.get("ct"),
            "ct_fim": pvf_d.get("ct"),
            "cf_ini": pvi_d.get("cf"),
            "cf_fim": pvf_d.get("cf"),
            "prof_ini": pvi_d.get("prof"),
            "prof_fim": pvf_d.get("prof"),
        })
    
    _log(f"  Trechos por cluster: {len(trechos_cluster)}", "INFO")
    
    # Fase 2: Se houver tubos sem PV, usar snap direto como fallback
    trechos_fallback = []
    if sem_pv > 0:
        _log(f"  Snap direto: {sem_pv} tubos sem PV, tentando fallback...", "INFO")
        trechos_fallback, conectados = _montar_trechos_direto(
            tubo_data, pvs, pvs_txt, clusters, dn_xy, dn_txts, incl_xy, incl_txts, tipo_rede
        )
        _log(f"  Snap direto: {conectados} tubos conectados", "INFO")
    
    # Combinar trechos, evitando duplicatas
    trechos = list(trechos_cluster)
    usados_cluster = {(t["pv_ini"], t["pv_fim"]) for t in trechos}
    
    for t in trechos_fallback:
        par = (t["pv_ini"], t["pv_fim"])
        par_inv = (t["pv_fim"], t["pv_ini"])
        if par not in usados_cluster and par_inv not in usados_cluster:
            trechos.append(t)
            usados_cluster.add(par)
    
    trechos_ok = _dedup_trechos(trechos)
    
    # Limpar campos temporários
    for p in pvs.values():
        p.pop("_cluster", None)
        p.pop("x_txt", None)
        p.pop("y_txt", None)
        p.pop("textos", None)
    
    _log(f"  Trechos válidos: {len(trechos_ok)}", "OK")
    _log(f"  Ligações sem PV: {sem_pv}", "INFO")
    
    # ── 9. VALIDAÇÃO FINAL ───────────────────────────────────────────────────
    if not trechos_ok:
        raise ValueError(
            "Nenhum trecho válido após associar PVs. "
            "Verifique se os textos de PV estão próximos aos endpoints dos tubos."
        )
    
    # Validar consistência geométrica
    mismatches = 0
    for t in trechos_ok:
        p0, p1 = pvs[t['pv_ini']], pvs[t['pv_fim']]
        d = math.hypot(p1['x'] - p0['x'], p1['y'] - p0['y'])
        r = d / max(t['ext_m'], 0.1)
        if r < 0.5 or r > 2.0:
            mismatches += 1
    
    if mismatches > len(trechos_ok) * 0.3:
        _log(f"  {mismatches}/{len(trechos_ok)} trechos com inconsistência geométrica", "WARN")
    
    # ── 10. METADADOS ────────────────────────────────────────────────────────
    meta = {
        "arquivo": nome_arquivo,
        "tipo_rede": tipo_rede.upper(),
        "n_pvs": len(pvs),
        "n_trechos": len(trechos_ok),
        "ext_total": sum(t['ext_m'] for t in trechos_ok),
        "motor": "TETÉU_ESGOTO v5 (conservador)",
        "obs": f"Clusters={len(cluster_centers)}, Textos PV={len(pvs_txt)}",
    }
    
    _log(f"  Rede coletora: {len(trechos_ok)} trechos | {meta['ext_total']:.0f}m", "OK")
    
    return pvs, trechos_ok, [], meta


# ─── MAIN ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        # Usar caminho padrão do TETÉU
        dxf_path = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\MORRO DO TETÉU\TETÉU_ESGOTO22.dxf"
    else:
        dxf_path = sys.argv[1]
    
    print("=" * 70)
    print("MOTOR TETÉU ESGOTO v5 — Nova NS")
    print("=" * 70)
    
    try:
        pvs, trechos, ruas, meta = ler_dxf_teteu(dxf_path)
        
        print("\n" + "=" * 70)
        print("RESULTADO")
        print("=" * 70)
        print(f"  PVs:        {meta['n_pvs']}")
        print(f"  Trechos:    {meta['n_trechos']}")
        print(f"  Extensão:   {meta['ext_total']:.0f}m")
        print(f"  Tipo:       {meta['tipo_rede']}")
        print(f"  Motor:      {meta['motor']}")
        
        # Estatísticas de DN
        dns = [t['dn_mm'] for t in trechos if t.get('dn_mm')]
        if dns:
            from collections import Counter
            dn_count = Counter(dns)
            print(f"\n  Diâmetros:")
            for dn, qtd in sorted(dn_count.items()):
                print(f"    DN{dn}: {qtd} trechos")
        
        # Exibir primeiros PVs
        print(f"\n  Primeiros PVs:")
        for i, (nome, pv) in enumerate(list(pvs.items())[:10]):
            coords = f"({pv['x']:.1f}, {pv['y']:.1f})"
            info = []
            if pv.get('ct'):
                info.append(f"CT={pv['ct']:.2f}")
            if pv.get('cf'):
                info.append(f"CF={pv['cf']:.2f}")
            info_str = f" | {', '.join(info)}" if info else ""
            print(f"    {nome}: {coords}{info_str}")
        
        # Exibir primeiros trechos
        print(f"\n  Primeiros trechos:")
        for t in trechos[:5]:
            dn_str = f"DN{t['dn_mm']}" if t.get('dn_mm') else "DN?"
            decl_str = f"{t['decl_mm']*1000:.1f}‰" if t.get('decl_mm') else "decl?"
            print(f"    {t['pv_ini']} → {t['pv_fim']}: {dn_str}, {t['ext_m']:.1f}m, {decl_str}")
        
        # Salvar resultado
        import json
        saida = {
            "meta": meta,
            "pvs": pvs,
            "trechos": trechos,
        }
        
        saida_path = Path(dxf_path).parent / f"{Path(dxf_path).stem}_RESULTADO.json"
        with open(saida_path, 'w', encoding='utf-8') as f:
            json.dump(saida, f, indent=2, ensure_ascii=False)
        
        print(f"\n  ✅ Resultado salvo em: {saida_path}")
        
    except Exception as e:
        print(f"\n  ❌ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
