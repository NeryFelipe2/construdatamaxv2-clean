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

from scipy.cluster.hierarchy import fclusterdata

try:
    import geopandas as gpd
except Exception:
    gpd = None

# ─── CONFIG ──────────────────────────────────────────────────────────────────
MIN_EXT_TUBO    = 2.0       # metros — tubos < 2m são detalhes
MIN_COORD_UTM   = 100000    # metros — coordenadas < 100km são locais/perfil
TOL_CLUSTER     = 3.0       # metros — endpoints dentro de 3m = mesmo PV
TOL_LABEL_PV    = 15.0      # metros — distância máxima texto-PV
TOL_TEXTO_TUBO  = 30.0      # metros — distância máxima texto-tubo para DN/incl
TOL_GRUPO_X     = 3.0       # metros — agrupamento horizontal de textos
TOL_GRUPO_Y     = 8.0       # metros — agrupamento vertical de textos
TOL_SNAP_GENERICO = 10.0    # metros — snap para DXF genérico
MODO_BRUTAL     = False     # Se True, aceita QUALQUER layer que tenha linhas > 2m


def _log(msg, nivel="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    prefix = {"OK": "[OK]  ", "WARN": "[!]   ", "STEP": ">>> ", "INFO": "      "}.get(nivel, "      ")
    print(f"[{ts}] {prefix}{msg}")


# Regex compiladas globais para performance
_RE_DN = re.compile(r"(\d+)\s*mm|D\s*=?\s*(\d+)|DN\s*(\d+)", re.IGNORECASE)
_RE_INCL_MM = re.compile(r"([\d.,]+)\s*m/m", re.IGNORECASE)
_RE_INCL_PCT = re.compile(r"([\d.,]+)\s*%")
_RE_COTA = re.compile(r"(?:CT|CF|C\.?\s*T\.?|C\.?\s*F\.?)?\s*([+-]?\d+[.,]\d+)", re.IGNORECASE)
_RE_PV = re.compile(r"P\.?\s*([VI])\.?\s*[_\s-]*(\d+)", re.IGNORECASE)
_RE_DIGITS = re.compile(r"^\d+$")
_RE_CT = re.compile(r"C\.?\s*T\.?\s*([+-]?[\d.,]+)", re.IGNORECASE)
_RE_CF = re.compile(r"C\.?\s*F\.?\s*([+-]?[\d.,]+)", re.IGNORECASE)

def _parse_dn(txt):
    """Extrai DN de texto como '150mm', 'D=150', 'DN 150'."""
    if not txt:
        return None
    m = _RE_DN.search(str(txt))
    if m:
        v = int(next(g for g in m.groups() if g))
        return v if 50 <= v <= 1200 else None
    return None

def _parse_incl(txt):
    """Extrai inclinação como '0.005 m/m' ou '0.5%'."""
    if not txt:
        return None
    m = _RE_INCL_MM.search(str(txt))
    if m:
        return float(m.group(1).replace(",", "."))
    m = _RE_INCL_PCT.search(str(txt))
    if m:
        return float(m.group(1).replace(",", ".")) / 100
    return None

def _parse_cota(txt):
    """Extrai cota como '100.50', 'CT 100.50', 'CF=99.80'."""
    if not txt:
        return None
    m = _RE_COTA.search(str(txt))
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
            m = _RE_PV.match(txt)
            if m:
                tipo = "PI" if m.group(1).upper() == "I" else "PV"
                nome = f"{tipo}_{m.group(2)}"
                continue
            
            # Padrão apenas número: "1136"
            if nome is None and _RE_DIGITS.match(txt):
                nome = f"PV_{txt}"
                continue
            
            # Cota de terreno (CT)
            m = _RE_CT.match(txt)
            if m:
                try:
                    ct = float(m.group(1).replace(",", "."))
                except:
                    pass
                continue
            
            # Cota de fundo (CF)
            m = _RE_CF.match(txt)
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


    return tubos


def _layer_tubo_valido(layer, brutal=False):
    """Filtro unico de layers de tubo; evita topografia/perfil virarem rede."""
    layer_upper = str(layer or "").upper().strip()
    if not layer_upper:
        return False

    ruins = [
        "PERFIL", "DETALHE", "CORTE", "BIFILAR", "TXT", "TEXTO",
        "COTA", "DIMENS", "HACHURA", "MOBILI", "RUAS", "QUADRAS",
        "PONTOS", "CAIXAS", "IDENTIFICACAO", "IND_", "INDICACAO",
        "MOLDURA", "CARIMBO", "LEGENDA", "FORMATO", "QUADRA",
        "TERRENO", "CONTOUR", "CONTORNO", "CURVA", "LAYER1",
    ]
    if any(p in layer_upper for p in ruins):
        return False

    if brutal:
        return True

    bons = [
        "TUBO", "PROLONG", "CONDUTO", "PIPE", "COLETORA", "COLETOR",
        "RECALQUE", "REDE", "ESGOTO", "EMISSARIO", "EMISS?RIO",
        "INTERCEPTOR", "RAMAL", "AGUA_REDE", "?GUA_REDE",
    ]
    return any(p in layer_upper for p in bons)


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
            "TUBO", "PROLONG", "CONDUTO", "PIPE", "COLETORA", "COLETOR",
            "RECALQUE", "REDE", "ESGOTO", "EMISSARIO", "EMISSÁRIO",
            "INTERCEPTOR", "RAMAL", "AGUA_REDE", "ÁGUA_REDE",
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

        if _layer_tubo_valido(layer):
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


def _extrair_tubos_brutal(gdf):
    """
    MODO BRUTAL: Aceita QUALQUER LineString ou MultiLineString que tenha comprimento > MIN_EXT_TUBO.
    Ignora filtros de nomes de camadas. Útil para DXFs de 'Estudo' sem padrão.
    Exclui apenas o que é comprovadamente texto/legenda se possível.
    """
    _log("MODO BRUTAL ATIVADO: Aceitando qualquer linha > 2m como tubo.", "WARN")
    
    # Filtra apenas por tipo de geometria e comprimento
    tubos = gdf[
        (gdf.geometry.geom_type.isin(['LineString', 'MultiLineString']))
    ].copy()
    
    if len(tubos) == 0:
        return tubos

    tubos['ext_m'] = tubos.geometry.length
    
    # Filtro de comprimento mínimo para evitar pegar pedaços de símbolos/detalhes
    tubos = tubos[tubos['ext_m'] > MIN_EXT_TUBO].copy()
    
    # Excluir layers que sabemos que NUNCA são tubos (ex: Molduras)
    layers_nuncas = ["MOLDURA", "LEGENDA", "CARIMBO", "LINHA_CHAMADA",
                     "CURVA", "CONTORNO", "CONTOUR", "LOTE", "TERRENO",
                     "QUADRA", "LIMITE", "HATCH", "VIA", "RUA", "CALC"]
    mask_bad = tubos['Layer'].astype(str).str.upper().apply(
        lambda s: any(b in s for b in layers_nuncas)
    )
    tubos = tubos[~mask_bad].copy()

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


def _dxf_float(v):
    try:
        return float(str(v).replace(",", "."))
    except Exception:
        return None


def _ler_entidades_dxf_puro(dxf_path):
    """Parser DXF ASCII minimo: ENTITIES, layer/texto/coordenadas."""
    raw = Path(dxf_path).read_text(encoding="latin-1", errors="ignore").splitlines()
    pares = []
    for i in range(0, len(raw) - 1, 2):
        try:
            pares.append((int(raw[i].strip()), raw[i + 1].strip()))
        except Exception:
            continue

    entidades, atual, in_entities = [], None, False
    for code, val in pares:
        if code == 2 and val == "ENTITIES":
            in_entities = True
            continue
        if in_entities and code == 0 and val == "ENDSEC":
            if atual:
                entidades.append(atual)
            break
        if not in_entities:
            continue
        if code == 0:
            if atual:
                entidades.append(atual)
            atual = {"type": val, "tags": []}
        elif atual is not None:
            atual["tags"].append((code, val))
    return entidades


def _tag_primeiro(tags, code, default=None):
    for c, v in tags:
        if c == code:
            return v
    return default


def _dxf_layer(ent):
    return _tag_primeiro(ent.get("tags", []), 8, "")


def _dxf_texto(ent):
    txt = " ".join(v for c, v in ent.get("tags", []) if c in (1, 3))
    return txt.replace("\\P", " ").strip()


def _dxf_ponto(tags, x_code=10, y_code=20):
    x = _dxf_float(_tag_primeiro(tags, x_code))
    y = _dxf_float(_tag_primeiro(tags, y_code))
    if x is None or y is None:
        return None
    return (x, y)


def _dxf_lwpoints(tags):
    pts, x = [], None
    for c, v in tags:
        if c == 10:
            x = _dxf_float(v)
        elif c == 20 and x is not None:
            y = _dxf_float(v)
            if y is not None:
                pts.append((x, y))
            x = None
    return pts


def _dist2d(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _media2d(a, b):
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)


def _segmentos_centro_tubo(coords):
    """
    Normaliza geometrias CAD de tubo.
    - linha simples: mantem.
    - retangulo estreito fechado: vira eixo central.
    - polyline aberta: explode por segmento real.
    """
    if len(coords) < 2:
        return []

    segs = []
    for i in range(len(coords) - 1):
        p0, p1 = coords[i], coords[i + 1]
        ext = _dist2d(p0, p1)
        if ext >= MIN_EXT_TUBO:
            segs.append((p0, p1, ext))

    if not segs:
        return []

    fechado_estreito = len(coords) >= 5 and _dist2d(coords[0], coords[-1]) <= 1.0
    if fechado_estreito and len(segs) >= 2:
        longos = sorted(segs, key=lambda s: s[2], reverse=True)[:2]
        a0, a1, la = longos[0]
        b0, b1, lb = longos[1]
        if min(la, lb) / max(la, lb) >= 0.75:
            direto = _dist2d(a0, b0) + _dist2d(a1, b1)
            cruzado = _dist2d(a0, b1) + _dist2d(a1, b0)
            if min(direto, cruzado) <= 4.0:
                if direto <= cruzado:
                    c0, c1 = _media2d(a0, b0), _media2d(a1, b1)
                else:
                    c0, c1 = _media2d(a0, b1), _media2d(a1, b0)
                ext = _dist2d(c0, c1)
                if ext >= MIN_EXT_TUBO:
                    return [(c0, c1, round(ext, 2))]

    return [(p0, p1, round(ext, 2)) for p0, p1, ext in segs]


def _extrair_geometrias_dxf_puro(entidades, brutal=False):
    tubos, textos, layers = [], [], []
    seen_layers = set()

    def add_layer(layer):
        if layer and layer not in seen_layers:
            seen_layers.add(layer)
            layers.append(layer)

    i = 0
    while i < len(entidades):
        ent = entidades[i]
        tipo = ent.get("type")
        layer = _dxf_layer(ent)
        add_layer(layer)

        if tipo in ("TEXT", "MTEXT"):
            pt = _dxf_ponto(ent.get("tags", []))
            txt = _dxf_texto(ent)
            if pt and txt:
                textos.append({"layer": layer, "text": txt, "x": pt[0], "y": pt[1]})

        if _layer_tubo_valido(layer, brutal=brutal):
            coords = []
            if tipo == "LINE":
                p0 = _dxf_ponto(ent.get("tags", []), 10, 20)
                p1 = _dxf_ponto(ent.get("tags", []), 11, 21)
                coords = [p0, p1] if p0 and p1 else []
            elif tipo == "LWPOLYLINE":
                coords = _dxf_lwpoints(ent.get("tags", []))
            elif tipo == "POLYLINE":
                j = i + 1
                while j < len(entidades) and entidades[j].get("type") != "SEQEND":
                    if entidades[j].get("type") == "VERTEX":
                        pt = _dxf_ponto(entidades[j].get("tags", []))
                        if pt:
                            coords.append(pt)
                    j += 1
                i = j

            for p0, p1, ext in _segmentos_centro_tubo(coords):
                if abs(p0[0]) < MIN_COORD_UTM or abs(p1[0]) < MIN_COORD_UTM:
                    continue
                tubos.append({
                    "p0": np.array(p0),
                    "p1": np.array(p1),
                    "ext": ext,
                    "layer": layer,
                })
        i += 1

    return layers, textos, tubos


def _texts_to_arrays(textos, pred_layer):
    pts = [t for t in textos if pred_layer(str(t.get("layer", "")).upper())]
    pts = [t for t in pts if abs(float(t["x"])) >= MIN_COORD_UTM]
    if not pts:
        return np.empty((0, 2)), np.array([])
    return np.array([[t["x"], t["y"]] for t in pts]), np.array([t["text"] for t in pts])


def _ler_dxf_puro(dxf_path, brutal=False):
    """Fallback sem GeoPandas/GDAL para DXF ASCII do ProSaneamento."""
    nome_arquivo = Path(dxf_path).name
    _log(f"Lendo DXF via parser puro: {nome_arquivo}", "STEP")

    entidades = _ler_entidades_dxf_puro(dxf_path)
    layers, textos, tubo_data = _extrair_geometrias_dxf_puro(entidades, brutal=brutal)
    tipo_rede = _detectar_tipo_rede(dxf_path, layers)

    _log(f"  Entidades DXF: {len(entidades)}", "OK")
    _log(f"  Tipo de rede: {tipo_rede.upper()}", "INFO")
    _log(f"  Tubos normalizados: {len(tubo_data)}", "OK")

    if not tubo_data:
        _erro_importacao_nao_confiavel(dxf_path, "nenhum tubo valido no parser puro")

    all_endpoints = []
    for td in tubo_data:
        all_endpoints.extend([td["p0"], td["p1"]])
    ep_arr = np.array(all_endpoints)

    try:
        clusters = fclusterdata(ep_arr, t=TOL_CLUSTER, criterion="distance")
    except Exception as e:
        raise ValueError(f"Clustering falhou: {e}")

    cluster_centers = {}
    for c in set(clusters):
        mask = clusters == c
        cluster_centers[c] = ep_arr[mask].mean(axis=0)

    _log(f"  PVs reais (clusters): {len(cluster_centers)}", "OK")

    centers_arr = np.array(list(cluster_centers.values()))
    pv_data = []
    for t in textos:
        layer_u = str(t.get("layer", "")).upper()
        if "PS_PONTOS" not in layer_u:
            continue
        xy = np.array([t["x"], t["y"]])
        if abs(xy[0]) < MIN_COORD_UTM:
            continue
        if len(centers_arr):
            d_orig = _dist_min(centers_arr, xy)
            xy_half = xy / 2.0
            d_half = _dist_min(centers_arr, xy_half)
            if d_orig > 80.0 and d_half <= 80.0:
                xy = xy_half
            elif d_orig > 80.0:
                continue
        pv_data.append((float(xy[0]), float(xy[1]), str(t["text"])))

    pvs_txt = _agrupar_textos_pv(pv_data)
    if pvs_txt:
        _log(f"  PVs por texto: {len(pvs_txt)}", "OK")

    pvs = _associar_clusters_textos_v5(cluster_centers, pvs_txt)
    pv_generics = sum(1 for p in pvs.values() if p.get("_generico"))
    if pv_generics:
        _log(f"  PVs genericos criados: {pv_generics}", "INFO")
    _log(f"  PVs finais: {len(pvs)}", "OK")

    dn_xy, dn_txts = _texts_to_arrays(textos, lambda l: "DIAM" in l or "DN" in l)
    incl_xy, incl_txts = _texts_to_arrays(textos, lambda l: "INCL" in l)
    _log(f"  Textos: {len(dn_txts)} DN, {len(incl_txts)} inclinacao", "OK")

    ruas = []
    pref_rua = ("RUA ", "BECO ", "TRAV", "AV ", "ESTRADA", "VIELA", "ALAMEDA", "ACESSO")
    for t in textos:
        txt = str(t["text"]).strip()
        if len(txt) > 2 and any(txt.upper().startswith(p) for p in pref_rua):
            ruas.append({"x": t["x"], "y": t["y"], "text": txt})

    trechos, sem_pv = _montar_trechos_v5(
        tubo_data, clusters, pvs, dn_xy, dn_txts, incl_xy, incl_txts, tipo_rede
    )
    trechos_ok = _dedup_trechos(trechos)

    for p in pvs.values():
        p.pop("_cluster", None)
        p.pop("x_txt", None)
        p.pop("y_txt", None)
        p.pop("text_points", None)

    if not trechos_ok:
        _erro_importacao_nao_confiavel(dxf_path, "rede topologica zerada no parser puro")

    if sem_pv:
        _log(f"  Ligacoes sem PV: {sem_pv}", "WARN")

    meta = {
        "arquivo": nome_arquivo,
        "tipo_rede": "AGUA" if (tipo_rede == "agua") else "ESGOTO",
        "n_pvs": len(pvs),
        "n_trechos": len(trechos_ok),
        "ext_total": sum(t["ext_m"] for t in trechos_ok),
        "motor": "DXF puro v5.2",
        "n_pvs_genericos": sum(1 for p in pvs.values() if p.get("_generico")),
    }
    _log(f"  Rede coletora: {len(trechos_ok)} trechos | {meta['ext_total']:.0f}m", "OK")
    return pvs, trechos_ok, ruas, meta


def ler_dxf_gdal(dxf_path, brutal=None):
    """
    Lê DXF via GDAL com topologia exata por clustering de endpoints.
    Versão v5: NUNCA INVENTA TUBOS, funciona com QUALQUER DXF do ProSaneamento.
    
    Retorna: (pvs, trechos, ruas, meta)
    """
    # Preferência: parâmetro explícito > variável de ambiente > constante global
    import os
    if brutal is None:
        brutal = os.environ.get("CONSTRUDATA_BRUTAL", "0") == "1" or MODO_BRUTAL
    dxf_path = str(dxf_path)
    if not Path(dxf_path).exists():
        raise FileNotFoundError(f"DXF não encontrado: {dxf_path}")
    
    if gpd is None:
        return _ler_dxf_puro(dxf_path, brutal=brutal)

    nome_arquivo = Path(dxf_path).name
    _log(f"Lendo DXF via GDAL v5: {nome_arquivo}", "STEP")
    
    # ── 1. CARREGAR DXF ──────────────────────────────────────────────────────
    try:
        gdf = gpd.read_file(dxf_path, layer="entities")
    except Exception as e:
        _log(f"GDAL falhou ({e}); tentando parser puro", "WARN")
        return _ler_dxf_puro(dxf_path, brutal=brutal)
    
    _log(f"  Entidades carregadas: {len(gdf)}", "OK")
    
    layers = gdf['Layer'].unique()
    tipo_rede = _detectar_tipo_rede(dxf_path, layers)
    _log(f"  Tipo de rede: {tipo_rede.upper()}", "INFO")
    
    # ── 2. EXTRAIR TUBOS ─────────────────────────────────────────────────────
    if not brutal:
        tubos = _extrair_tubos_conservador(gdf)
        _log(f"  Tubos encontrados: {len(tubos)} (filtro conservador)", "OK")
    else:
        tubos = _extrair_tubos_brutal(gdf)
        _log(f"  Tubos encontrados: {len(tubos)} (MODO BRUTAL)", "WARN")
    
    if len(tubos) == 0 and not brutal:
        _log("  Nenhum tubo no modo conservador. Tentando MODO BRUTAL...", "WARN")
        tubos = _extrair_tubos_brutal(gdf)
        if len(tubos) > 0:
            brutal = True
            _log(f"  Tubos encontrados via recovery BRUTAL: {len(tubos)}", "OK")

    if len(tubos) == 0:
        layers_info = _layers_info(gdf)
        _erro_importacao_nao_confiavel(
            dxf_path,
            "nenhum tubo valido encontrado (mesmo no modo BRUTAL)",
            layers_info,
        )
    
    # ── 3. EXTRAIR ENDPOINTS DOS TUBOS (v5.1: EXPLODIR POLYLINES EM SEGMENTOS) ─
    # BUGFIX: antes pegava só p0=coords[0] e p1=coords[-1], criando uma reta
    # direta que CRUZAVA os quarteirões. Agora cada par de vértices consecutivos
    # vira um segmento independente — a rede segue a topologia real do CAD.
    all_endpoints = []
    tubo_data = []
    
    # Detectar se coordenadas são LOCAL (< MIN_COORD_UTM) e calcular offset UTM
    _pts_locais, _pts_utms = [], []
    for _, t in tubos.iterrows():
        coords = _coords_geom(t.geometry)
        for c in coords:
            if abs(c[0]) < MIN_COORD_UTM:
                _pts_locais.append(c[:2])
            else:
                _pts_utms.append(c[:2])
    _offset_dx, _offset_dy = 0.0, 0.0
    _modo_crs = "UTM"
    if len(_pts_locais) > len(_pts_utms) * 0.3:  # > 30% locais → offset necessário
        _modo_crs = "LOCAL"
        if _pts_utms:  # usa PVs de texto como referência de destino
            _cx_utm = sum(p[0] for p in _pts_utms) / len(_pts_utms)
            _cy_utm = sum(p[1] for p in _pts_utms) / len(_pts_utms)
            _cx_loc = sum(p[0] for p in _pts_locais) / len(_pts_locais)
            _cy_loc = sum(p[1] for p in _pts_locais) / len(_pts_locais)
            _offset_dx = _cx_utm - _cx_loc
            _offset_dy = _cy_utm - _cy_loc
            _log(f"  CRS misto detectado: offset dx={_offset_dx:.1f} dy={_offset_dy:.1f}", "WARN")
    
    def _aplicar_offset(p):
        if _modo_crs == "LOCAL" and abs(p[0]) < MIN_COORD_UTM:
            return (p[0] + _offset_dx, p[1] + _offset_dy)
        return p
    
    for _, t in tubos.iterrows():
        coords = _coords_geom(t.geometry)
        if len(coords) < 2:
            continue
        
        layer = t.get('Layer', '')
        
        # EXPLOSÃO: iterar em cada segmento consecutivo da polyline
        for i in range(len(coords) - 1):
            p0 = _aplicar_offset(coords[i][:2])
            p1 = _aplicar_offset(coords[i + 1][:2])
            
            # Validar coordenadas UTM após offset
            if abs(p0[0]) < MIN_COORD_UTM or abs(p1[0]) < MIN_COORD_UTM:
                continue
            
            # Descartar segmentos degenerados (< MIN_EXT_TUBO)
            ext_seg = math.sqrt((p1[0]-p0[0])**2 + (p1[1]-p0[1])**2)
            if ext_seg < MIN_EXT_TUBO:
                continue
            
            all_endpoints.append(p0)
            all_endpoints.append(p1)
            tubo_data.append({
                "p0": np.array(p0),
                "p1": np.array(p1),
                "ext": round(ext_seg, 2),
                "layer": layer
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
        "motor": f"GDAL/OGR v5 ({'BRUTAL' if brutal else 'conservador'})",
        "n_pvs_genericos": sum(1 for p in pvs.values() if p.get("_generico")),
    }
    
    _log(f"  Rede coletora: {len(trechos_ok)} trechos | {meta['ext_total']:.0f}m", "OK")

    # ── 12. ASSOCIAR RUAS AOS TRECHOS ────────────────────────────────────────
    if ruas:
        rua_xy = np.array([[r["x"], r["y"]] for r in ruas])
        rua_txts = [r["text"] for r in ruas]
        TOL_RUA = 50.0  # metros
        n_rua = 0
        for t in trechos_ok:
            p0 = pvs.get(t["pv_ini"], {})
            p1 = pvs.get(t["pv_fim"], {})
            if not p0 or not p1:
                continue
            mx = (p0["x"] + p1["x"]) / 2
            my = (p0["y"] + p1["y"]) / 2
            dists = np.hypot(rua_xy[:, 0] - mx, rua_xy[:, 1] - my)
            idx = int(np.argmin(dists))
            if dists[idx] <= TOL_RUA:
                t["rua"] = rua_txts[idx]
                n_rua += 1
        _log(f"  Ruas associadas: {n_rua}/{len(trechos_ok)}", "OK")

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
