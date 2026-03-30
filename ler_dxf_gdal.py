#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ler_dxf_gdal.py v5 — Leitor UNIVERSAL de DXF ProSaneamento

MUDANÇAS v5 vs v4:
  1. Filtro de layers CONSERVADOR — só TUBO_PVC, PROLONG, etc.
  2. Ignora PERFIL, DETALHE, PONTOS, CAIXAS (não são tubos reais)
  3. PVs genéricos para clusters sem texto — não perde tubos
  4. Validação reforçada — NUNCA inventa tubos inexistentes
  5. Funciona com QUALQUER DXF do ProSaneamento

Fluxo:
  1. GDAL lê TUBO_PVC → polylines com endpoints reais
  2. Endpoints clusterizados (t=3m) → posições reais dos PVs
  3. Textos PS_PONTOS matcheados aos clusters → nomes + CT/CF
  4. Clusters sem texto → PVs genéricos (PV_G{cluster_id})
  5. Cada tubo liga cluster_ini → cluster_fim (topologia exata)
  6. DN/inclinação do texto mais próximo do meio do tubo

Autor: Nova NS v5
Data: 2026-03-29
"""

import re, math
import numpy as np
from pathlib import Path
from datetime import datetime
from collections import Counter, defaultdict

import geopandas as gpd
from scipy.cluster.hierarchy import fclusterdata

# ─── CONFIG ──────────────────────────────────────────────────────────────────
MIN_EXT_TUBO    = 2.0       # metros — tubos < 2m são detalhes
MIN_COORD_UTM   = 100000    # metros — coordenadas < 100km são locais/perfil
TOL_CLUSTER     = 3.0       # metros — endpoints dentro de 3m = mesmo PV
TOL_LABEL_PV    = 15.0      # metros — distância máxima texto-PV
TOL_TEXTO_TUBO  = 30.0      # metros — distância máxima texto-tubo para DN/incl
TOL_GRUPO_X     = 3.0       # metros — agrupamento horizontal de textos
TOL_GRUPO_Y     = 8.0       # metros — agrupamento vertical de textos
TOL_SNAP_GENERICO = 10.0    # metros — snap para DXF genérico


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


def _layers_info(gdf):
    """Informações sobre layers do DXF."""
    layers = []
    seen = set()
    for raw in gdf.get("Layer", []):
        layer = str(raw or "").strip()
        if layer and layer not in seen:
            seen.add(layer)
            layers.append(layer)
    upper = [layer.upper() for layer in layers]
    return {
        "layers": layers,
        "upper": upper,
        "has_ps_pontos": any("PS_PONTOS_IDENTIFICACAO_TXT" in u or "PS_PONTOS" in u for u in upper),
        "tubo_layers": [layers[i] for i, u in enumerate(upper) if "TUBO" in u or "PROLONG" in u],
    }


def _erro_importacao_nao_confiavel(dxf_path, motivo, layers_info=None):
    """Gera erro quando DXF não pode ser lido com confiança."""
    nome = Path(dxf_path).name
    detalhes = []
    if layers_info:
        if layers_info.get("tubo_layers"):
            detalhes.append("layers_tubo=" + ", ".join(layers_info["tubo_layers"][:5]))
        elif layers_info.get("layers"):
            detalhes.append("layers=" + ", ".join(layers_info["layers"][:8]))
    sufixo = f" ({'; '.join(detalhes)})" if detalhes else ""
    raise ValueError(
        f"DXF '{nome}' sem importacao confiavel: {motivo}{sufixo}. "
        "Importacao cancelada para evitar tubos/PVs inventados. "
        "Se a origem for BIM/Civil 3D, use DWG semantico ou LandXML."
    )


def _agrupar_textos_pv(pv_data):
    """Agrupa textos (PV, PF, CT, CF) em PVs."""
    if not pv_data:
        return {}
    
    data = sorted(pv_data, key=lambda r: (round(r[0] / TOL_GRUPO_X) * TOL_GRUPO_X, -r[1]))
    grupos, grupo = [], [data[0]]
    
    for r in data[1:]:
        last = grupo[-1]
        if abs(r[0] - last[0]) < TOL_GRUPO_X and abs(r[1] - last[1]) < TOL_GRUPO_Y:
            grupo.append(r)
        else:
            grupos.append(grupo)
            grupo = [r]
    grupos.append(grupo)

    pvs = {}
    for g in grupos:
        nome = ct = cf = prof = None
        x0, y0 = g[0][0], g[0][1]
        
        for (rx, ry, txt) in sorted(g, key=lambda r: -r[1]):
            txt = txt.strip()
            
            # Padrão PV/PI: "PV 1", "P.V.1", "PI-100"
            m = re.match(r"P\.?\s*([VI])\.?\s*[_\s-]*(\d+)", txt, re.IGNORECASE)
            if m:
                tipo = "PI" if m.group(1).upper() == "I" else "PV"
                nome = f"{tipo}_{m.group(2)}"
                continue
            
            # Padrão apenas número: "1136"
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
                "text_points": [(float(rx), float(ry)) for (rx, ry, _) in g],
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


def _extrair_tubos_conservador(gdf):
    """
    Extrai tubos de layers que claramente representam tubulação.
    CRITÉRIO CONSERVADOR v5: só layers inequívocas.
    EXCLUI: PERFIL, DETALHE, PONTOS, CAIXAS, TEXTOS.
    """
    layers = gdf['Layer'].unique()
    layers_tubo = []

    for layer in layers:
        layer_upper = str(layer or "").upper().strip()
        if not layer_upper:
            continue

        # Critérios de inclusão (precisa ter pelo menos um)
        # TUBO, PROLONG, CONDUTO, PIPE = inequívocos
        inclui = any(p in layer_upper for p in [
            "TUBO", "PROLONG", "CONDUTO", "PIPE", "COLETORA", "RECALQUE"
        ])
        
        # "LINHA" só vale se vier com "TUBO" ou "CONDUTO"
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


def _associar_clusters_textos_v5(cluster_centers, pvs_txt, tol_label=TOL_LABEL_PV):
    """
    Associa clusters de endpoints a textos de PVs.
    Estratégia v5: associa textos próximos, depois cria genéricos.
    """
    pvs = {}
    
    if not pvs_txt:
        # Sem textos: usar centros de cluster como PVs genéricos
        for cid, center in cluster_centers.items():
            pvs[f"PV_G{cid}"] = {
                "x": float(center[0]),
                "y": float(center[1]),
                "ct": None,
                "cf": None,
                "prof": None,
                "_generico": True,
                "_cluster": cid,
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
    
    # Fase 2: Criar PVs genéricos para clusters sem texto
    clusters_sem_nome = set(cluster_centers.keys()) - {p["_cluster"] for p in pvs.values() if "_cluster" in p}
    
    if clusters_sem_nome:
        for cid in clusters_sem_nome:
            center = cluster_centers[cid]
            pvs[f"PV_G{cid}"] = {
                "x": float(center[0]),
                "y": float(center[1]),
                "ct": None,
                "cf": None,
                "prof": None,
                "_generico": True,
                "_cluster": cid,
            }
    
    return pvs


def _montar_trechos_v5(tubo_data, clusters, pvs, dn_xy, dn_txts, incl_xy, incl_txts, tipo_rede):
    """
    Monta trechos usando conectividade de clusters.
    """
    cid_to_name = {p["_cluster"]: n for n, p in pvs.items() if "_cluster" in p}
    
    trechos = []
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
    
    return trechos, sem_pv


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
    
    return "esgoto"  # Default para ProSaneamento


def ler_dxf_gdal(dxf_path):
    """
    Lê DXF via GDAL com topologia exata por clustering de endpoints.
    Versão v5: NUNCA INVENTA TUBOS, funciona com QUALQUER DXF do ProSaneamento.
    
    Retorna: (pvs, trechos, ruas, meta)
    """
    dxf_path = str(dxf_path)
    if not Path(dxf_path).exists():
        raise FileNotFoundError(f"DXF não encontrado: {dxf_path}")
    
    nome_arquivo = Path(dxf_path).name
    _log(f"Lendo DXF via GDAL v5: {nome_arquivo}", "STEP")
    
    # ── 1. CARREGAR DXF ──────────────────────────────────────────────────────
    try:
        gdf = gpd.read_file(dxf_path, layer="entities")
    except Exception as e:
        raise ValueError(f"Erro ao ler DXF: {e}")
    
    _log(f"  Entidades carregadas: {len(gdf)}", "OK")
    
    layers = gdf['Layer'].unique()
    tipo_rede = _detectar_tipo_rede(dxf_path, layers)
    _log(f"  Tipo de rede: {tipo_rede.upper()}", "INFO")
    
    # ── 2. EXTRAIR TUBOS (FILTRO CONSERVADOR v5) ─────────────────────────────
    tubos = _extrair_tubos_conservador(gdf)
    _log(f"  Tubos encontrados: {len(tubos)} (filtro conservador)", "OK")
    
    if len(tubos) == 0:
        layers_info = _layers_info(gdf)
        _erro_importacao_nao_confiavel(
            dxf_path,
            "nenhum tubo valido encontrado (layers filtradas: PERFIL, PONTOS, CAIXAS, etc.)",
            layers_info,
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
    pv_layers = [l for l in layers 
                 if 'PS_PONTOS_IDENTIFICACAO_TXT' in str(l).upper() 
                 or 'PS_PONTOS' in str(l).upper()]
    
    pvs_txt = {}
    
    for pv_layer in pv_layers:
        pv_mask = ((gdf['Layer'] == pv_layer) & (gdf['Text'].notna()) &
                   (gdf.geometry.geom_type == 'Point'))
        pv_all = gdf[pv_mask]
        
        if len(pv_all) > 0:
            pv_data = [(g.x, g.y, str(t)) for g, t in zip(pv_all.geometry, pv_all['Text'])
                       if abs(g.x) > MIN_COORD_UTM]
            pvs_txt = _agrupar_textos_pv(pv_data)
            
            if pvs_txt:
                _log(f"  PVs por texto ({pv_layer}): {len(pvs_txt)}", "OK")
                break
    
    # ── 6. ASSOCIAR CLUSTERS A TEXTOS (v5: + genéricos) ──────────────────────
    pvs = _associar_clusters_textos_v5(cluster_centers, pvs_txt)
    
    pv_generics = sum(1 for p in pvs.values() if p.get("_generico"))
    if pv_generics > 0:
        _log(f"  PVs genéricos criados: {pv_generics}", "INFO")
    
    _log(f"  PVs finais: {len(pvs)}", "OK")
    
    # ── 7. EXTRAIR TEXTOS DE DN E INCLINAÇÃO ─────────────────────────────────
    dn_layers = [l for l in layers if 'DIAM' in str(l).upper() or 'DN' in str(l).upper()]
    dn_pts = gdf.iloc[0:0]
    for dl in dn_layers:
        pts = gdf[(gdf['Layer'] == dl) & (gdf['Text'].notna()) & (gdf.geometry.geom_type == 'Point')]
        if len(pts) > 0:
            dn_pts = gpd.pd.concat([dn_pts, pts], ignore_index=True)
    
    dn_xy = np.array([[g.x, g.y] for g in dn_pts.geometry]) if len(dn_pts) > 0 else np.empty((0, 2))
    dn_txts = dn_pts['Text'].values if len(dn_pts) > 0 else np.array([])
    
    incl_layers = [l for l in layers if 'INCL' in str(l).upper()]
    incl_pts = gdf.iloc[0:0]
    for il in incl_layers:
        pts = gdf[(gdf['Layer'] == il) & (gdf['Text'].notna()) & (gdf.geometry.geom_type == 'Point')]
        if len(pts) > 0:
            incl_pts = gpd.pd.concat([incl_pts, pts], ignore_index=True)
    
    incl_xy = np.array([[g.x, g.y] for g in incl_pts.geometry]) if len(incl_pts) > 0 else np.empty((0, 2))
    incl_txts = incl_pts['Text'].values if len(incl_pts) > 0 else np.array([])
    
    _log(f"  Textos: {len(dn_txts)} DN, {len(incl_txts)} inclinação", "OK")
    
    # ── 8. EXTRAIR RUAS ──────────────────────────────────────────────────────
    rua_layers = {'A_Alerta', 'TXT-LOGRAD', 'TEXTO', 'LT-TEXTO-RUA', 'TXT-PRACA', 'PS_IND_TRECHO'}
    PREF_RUA = ("RUA ", "BECO ", "TRAV", "AV ", "ESTRADA", "VIELA", "ALAMEDA", "ACESSO")
    ruas = []
    
    for ln in rua_layers:
        mask = (gdf['Layer'] == ln) & (gdf['Text'].notna()) & (gdf.geometry.geom_type == 'Point')
        for _, row in gdf[mask].iterrows():
            txt = row['Text'].strip()
            if len(txt) > 2 and any(txt.upper().startswith(p) for p in PREF_RUA):
                ruas.append({"x": row.geometry.x, "y": row.geometry.y, "text": txt})
    
    # ── 9. MONTAR TRECHOS ────────────────────────────────────────────────────
    trechos, sem_pv = _montar_trechos_v5(
        tubo_data, clusters, pvs, dn_xy, dn_txts, incl_xy, incl_txts, tipo_rede
    )
    
    trechos_ok = _dedup_trechos(trechos)
    
    # Limpar campos temporários
    for p in pvs.values():
        p.pop("_cluster", None)
        p.pop("x_txt", None)
        p.pop("y_txt", None)
        p.pop("text_points", None)
    
    _log(f"  Trechos válidos: {len(trechos_ok)}", "OK")
    if sem_pv > 0:
        _log(f"  Ligações sem PV: {sem_pv}", "WARN")
    
    # ── 10. VALIDAÇÃO ────────────────────────────────────────────────────────
    if not trechos_ok:
        _erro_importacao_nao_confiavel(
            dxf_path,
            "rede topologica zerada apos associar PVs e tubos",
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
    
    # ── 11. METADADOS ────────────────────────────────────────────────────────
    meta = {
        "arquivo": nome_arquivo,
        "tipo_rede": "AGUA" if (tipo_rede == "agua") else "ESGOTO",
        "n_pvs": len(pvs),
        "n_trechos": len(trechos_ok),
        "ext_total": sum(t['ext_m'] for t in trechos_ok),
        "motor": "GDAL/OGR v5 (conservador)",
        "n_pvs_genericos": sum(1 for p in pvs.values() if p.get("_generico")),
    }
    
    _log(f"  Rede coletora: {len(trechos_ok)} trechos | {meta['ext_total']:.0f}m", "OK")
    
    return pvs, trechos_ok, ruas, meta


# ─── MAIN ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Uso: python ler_dxf_gdal.py <arquivo.dxf>")
        sys.exit(1)
    
    pvs, trechos, ruas, meta = ler_dxf_gdal(sys.argv[1])
    
    print("\n" + "=" * 70)
    print("RESULTADO")
    print("=" * 70)
    print(f"  PVs:        {meta['n_pvs']} ({meta['n_pvs_genericos']} genéricos)")
    print(f"  Trechos:    {meta['n_trechos']}")
    print(f"  Extensão:   {meta['ext_total']:.0f}m")
    print(f"  Tipo:       {meta['tipo_rede']}")
    print(f"  Motor:      {meta['motor']}")
    
    # Estatísticas de DN
    dns = [t['dn_mm'] for t in trechos if t.get('dn_mm')]
    if dns:
        dn_count = Counter(dns)
        print(f"\n  Diâmetros:")
        for dn, qtd in sorted(dn_count.items()):
            print(f"    DN{dn}: {qtd} trechos")
    
    print("\n✅ Leitura concluída com sucesso!")
