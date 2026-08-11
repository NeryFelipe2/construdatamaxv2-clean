#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ler_dxf_gdal.py v2 — Leitor de DXF via GDAL/OGR

MUDANÇA PRINCIPAL vs v1:
  Posição dos PVs vem dos ENDPOINTS DOS TUBOS (clusterizados),
  não dos textos PS_PONTOS (que são labels offset 5-15m).
  Conectividade vem da topologia real (qual endpoint pertence a qual cluster),
  não de snap por proximidade (que errava 33%).

Fluxo:
  1. GDAL lê TUBO_PVC → polylines com endpoints reais
  2. Endpoints clusterizados (t=3m) → posições reais dos PVs
  3. Textos PS_PONTOS matcheados aos clusters → nomes + CT/CF
  4. Cada tubo liga cluster_ini → cluster_fim (topologia exata)
  5. DN/inclinação do texto mais próximo do meio do tubo
"""

import re, math
import numpy as np
from pathlib import Path
from datetime import datetime
from collections import Counter, defaultdict

import geopandas as gpd
from scipy.cluster.hierarchy import fclusterdata

# ─── CONFIG ──────────────────────────────────────────────────────────────────
MIN_EXT_TUBO    = 2.0
MIN_COORD_UTM   = 100000
TOL_CLUSTER     = 2.0    # metros — endpoints dentro de 2m = mesmo PV
TOL_LABEL_PV    = 20.0   # max dist do label texto ao centro real do PV
TOL_TEXTO_TUBO  = 40.0   # max dist do midpoint ao texto DN/incl
TOL_GRUPO_X     = 3.0
TOL_GRUPO_Y     = 8.0


def _log(msg, nivel="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    prefix = {"OK": "[OK]  ", "WARN": "[!]   ", "STEP": ">>> ", "INFO": "      "}.get(nivel, "      ")
    print(f"[{ts}] {prefix}{msg}")


def _parse_dn(txt):
    m = re.search(r"(\d+)\s*mm|D\s*=?\s*(\d+)|DN\s*(\d+)", txt or "", re.IGNORECASE)
    if m:
        v = int(next(g for g in m.groups() if g))
        return v if 50 <= v <= 1200 else None
    return None


def _parse_incl(txt):
    m = re.search(r"([\d.,]+)\s*m/m", txt or "", re.IGNORECASE)
    if m: return float(m.group(1).replace(",", "."))
    m = re.search(r"([\d.,]+)\s*%", txt or "")
    if m: return float(m.group(1).replace(",", ".")) / 100
    return None


def _nearest_text(mx, my, xy_arr, txt_arr, max_d=40.0):
    if len(xy_arr) == 0: return None
    d = np.sqrt(((xy_arr - [mx, my]) ** 2).sum(axis=1))
    i = d.argmin()
    return txt_arr[i] if d[i] <= max_d else None


def _agrupar_textos_pv(pv_data):
    """Agrupa textos (PV, PF, CT, CF) em PVs."""
    if not pv_data: return {}
    data = sorted(pv_data, key=lambda r: (round(r[0] / TOL_GRUPO_X) * TOL_GRUPO_X, -r[1]))
    grupos, grupo = [], [data[0]]
    for r in data[1:]:
        last = grupo[-1]
        if abs(r[0] - last[0]) < TOL_GRUPO_X and abs(r[1] - last[1]) < TOL_GRUPO_Y:
            grupo.append(r)
        else:
            grupos.append(grupo); grupo = [r]
    grupos.append(grupo)

    pvs = {}
    for g in grupos:
        nome = ct = cf = prof = None
        x0, y0 = g[0][0], g[0][1]
        for (rx, ry, txt) in sorted(g, key=lambda r: -r[1]):
            txt = txt.strip()
            m = re.match(r"P\.?\s*[VI]\.?\s*[_\s]*(\d+)", txt, re.IGNORECASE)
            if m:
                tipo = "PI" if re.search(r"[Ii]", txt[1:3]) else "PV"
                nome = f"{tipo}_{m.group(1)}"; continue
            m = re.match(r"P\.?\s*F\.?\s*([+-]?[\d.,]+)", txt, re.IGNORECASE)
            if m:
                try: prof = float(m.group(1).replace(",", "."))
                except: pass; continue
            m = re.match(r"C\.?\s*T\.?\s*([+-]?[\d.,]+)", txt, re.IGNORECASE)
            if m:
                try: ct = float(m.group(1).replace(",", "."))
                except: pass; continue
            m = re.match(r"C\.?\s*F\.?\s*([+-]?[\d.,]+)", txt, re.IGNORECASE)
            if m:
                try: cf = float(m.group(1).replace(",", "."))
                except: pass
        if nome and nome not in pvs:
            if ct is not None and cf is not None and cf > ct: ct, cf = cf, ct
            if ct is not None and cf is not None and prof is None: prof = round(ct - cf, 4)
            pvs[nome] = {"x_txt": x0, "y_txt": y0, "ct": ct, "cf": cf, "prof": prof}
    return pvs


def ler_dxf_gdal(dxf_path):
    """
    Lê DXF via GDAL com topologia exata por clustering de endpoints.
    Retorna (pvs, trechos, ruas, meta).
    """
    dxf_path = str(dxf_path)
    _log(f"Lendo DXF via GDAL v2: {Path(dxf_path).name}", "STEP")

    gdf = gpd.read_file(dxf_path, layer="entities")
    _log(f"  GDAL: {len(gdf)} entidades", "OK")

    _dxf_name = Path(dxf_path).stem.upper()
    is_esgoto = "ESGOTO" in _dxf_name or "ESG" in _dxf_name
    is_agua = "AGUA" in _dxf_name or "ÁGUA" in _dxf_name

    # ── 1. TUBOS ─────────────────────────────────────────────────────────────
    layers_tubo = [l for l in gdf['Layer'].unique()
                   if ("TUBO" in l.upper() or "PROLONG" in l.upper())
                   and not l.upper().startswith("PS_")
                   and "DETALHE" not in l.upper()
                   and "PERFIL" not in l.upper()
                   and "BIFILAR" not in l.upper()]

    tubos_gdf = gdf[(gdf['Layer'].isin(layers_tubo)) &
                     (gdf.geometry.geom_type.isin(['LineString', 'MultiLineString']))].copy()
    tubos_gdf['ext_m'] = tubos_gdf.geometry.length
    tubos_gdf = tubos_gdf[tubos_gdf['ext_m'] > MIN_EXT_TUBO].copy()
    _log(f"  Tubos: {len(tubos_gdf)} (layers: {layers_tubo})", "OK")

    if len(tubos_gdf) == 0:
        _log("  Sem tubos!", "WARN")
        return {}, [], [], {"arquivo": Path(dxf_path).name, "n_pvs": 0, "n_trechos": 0}

    # ── 2. ENDPOINTS → CLUSTERS = PVs REAIS ──────────────────────────────────
    all_endpoints = []
    tubo_data = []
    for _, t in tubos_gdf.iterrows():
        coords = (list(t.geometry.coords) if t.geometry.geom_type == 'LineString'
                  else list(t.geometry.geoms[0].coords))
        p0, p1 = coords[0][:2], coords[-1][:2]
        all_endpoints.append(p0)
        all_endpoints.append(p1)
        tubo_data.append({"p0": np.array(p0), "p1": np.array(p1),
                          "ext": round(float(t['ext_m']), 2),
                          "layer": t.get('Layer', '')})

    ep_arr = np.array(all_endpoints)
    clusters = fclusterdata(ep_arr, t=TOL_CLUSTER, criterion='distance')

    # Centros dos clusters = posições reais dos PVs
    cluster_centers = {}
    for c in set(clusters):
        mask = clusters == c
        cluster_centers[c] = ep_arr[mask].mean(axis=0)

    _log(f"  Endpoint clusters: {len(cluster_centers)} PVs reais", "OK")

    # ── 3. TEXTOS PS_PONTOS → nomes + CT/CF ──────────────────────────────────
    pv_layer = next((l for l in gdf['Layer'].unique()
                     if 'PS_PONTOS_IDENTIFICACAO_TXT' in l.upper()), None)
    if not pv_layer:
        pv_layer = next((l for l in gdf['Layer'].unique()
                         if 'PS_PONTOS' in l.upper()), None)

    pvs_txt = {}
    if pv_layer:
        pv_mask = ((gdf['Layer'] == pv_layer) & (gdf['Text'].notna()) &
                   (gdf.geometry.geom_type == 'Point'))
        pv_all = gdf[pv_mask]
        pv_data = [(g.x, g.y, t) for g, t in zip(pv_all.geometry, pv_all['Text'])
                   if abs(g.x) > MIN_COORD_UTM]
        pvs_txt = _agrupar_textos_pv(pv_data)
        _log(f"  PV textos: {len(pvs_txt)}", "OK")

    # ── 4. MATCH: cluster → texto PV mais próximo ────────────────────────────
    pvs = {}
    if pvs_txt:
        txt_names = list(pvs_txt.keys())
        txt_xy = np.array([[pvs_txt[n]["x_txt"], pvs_txt[n]["y_txt"]] for n in txt_names])
        used_names = set()

        for cid, center in sorted(cluster_centers.items()):
            d = np.sqrt(((txt_xy - center) ** 2).sum(axis=1))
            for idx in np.argsort(d):
                if d[idx] > TOL_LABEL_PV:
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

        n_sem = len(cluster_centers) - len(pvs)
        _log(f"  Clusters sem PV (ligações/noise): {n_sem} → ignorados", "INFO")

    # ── 4b. AUTO-NOMEAR clusters órfãos conectados à rede ──────────────
    # Regra: nomear clusters sem texto QUE SÃO JUNCTIONS (grau ≥ 2)
    # Dead-ends (grau 1) sem texto = ligações prediais → descartar
    # Exceção: se 0 PVs nomeados (água) → nomear tudo
    named_clusters = {p["_cluster"] for p in pvs.values()}
    n_total_clusters = len(cluster_centers)
    n_unnamed = n_total_clusters - len(named_clusters)

    if n_unnamed > 0:
        # Calcular grau de cada cluster (quantos tubos conectam)
        cluster_degree = defaultdict(int)
        for i in range(len(tubo_data)):
            c0 = int(clusters[2 * i])
            c1 = int(clusters[2 * i + 1])
            if c0 != c1:
                cluster_degree[c0] += 1
                cluster_degree[c1] += 1

        has_any_named = len(named_clusters) > 0

        connected_unnamed = set()
        for cid in cluster_degree:
            if cid in named_clusters:
                continue
            # Sem nenhum PV nomeado (água): nomear todos
            if not has_any_named:
                connected_unnamed.add(cid)
            # Com PVs nomeados (esgoto): só junctions (grau ≥ 2)
            elif cluster_degree[cid] >= 2:
                connected_unnamed.add(cid)

        if connected_unnamed:
            seq = 1
            for cid in sorted(connected_unnamed):
                if cid not in named_clusters:
                    nome = f"N_{seq:03d}"
                    seq += 1
                    pvs[nome] = {
                        "ct": 0, "cf": 0, "prof": 0,
                        "x": float(cluster_centers[cid][0]),
                        "y": float(cluster_centers[cid][1]),
                        "_cluster": cid,
                    }
                    named_clusters.add(cid)
            _log(f"  Auto-nomeados: {seq-1} junctions órfãs (grau≥2)", "OK")

    _log(f"  PVs da rede coletora: {len(pvs)}", "OK")

    # Build reverse map: cluster_id → pv_name
    cid_to_name = {p["_cluster"]: n for n, p in pvs.items()}

    # ── 5. CONECTIVIDADE TOPOLÓGICA (sem snap) ───────────────────────────────
    # Cada tubo[i] tem endpoints all_endpoints[2*i] e all_endpoints[2*i+1]
    # Cada endpoint pertence a clusters[2*i] e clusters[2*i+1]

    dn_pts = gdf[(gdf['Layer'] == 'PS_IND_DIAMETRO') & (gdf['Text'].notna()) &
                 (gdf.geometry.geom_type == 'Point')]
    dn_xy = np.array([[g.x, g.y] for g in dn_pts.geometry]) if len(dn_pts) > 0 else np.empty((0, 2))
    dn_txts = dn_pts['Text'].values if len(dn_pts) > 0 else np.array([])

    incl_pts = gdf[(gdf['Layer'] == 'PS_IND_INCLINACAO') & (gdf['Text'].notna()) &
                   (gdf.geometry.geom_type == 'Point')]
    incl_xy = np.array([[g.x, g.y] for g in incl_pts.geometry]) if len(incl_pts) > 0 else np.empty((0, 2))
    incl_txts = incl_pts['Text'].values if len(incl_pts) > 0 else np.array([])

    _log(f"  Textos: {len(dn_txts)} DN, {len(incl_txts)} inclinação", "OK")

    # Ruas
    rua_layers = {'A_Alerta', 'TXT-LOGRAD', 'TEXTO', 'LT-TEXTO-RUA', 'TXT-PRACA'}
    PREF_RUA = ("RUA ", "BECO ", "TRAV", "AV ", "ESTRADA", "VIELA", "ALAMEDA", "ACESSO")
    ruas = []
    for ln in rua_layers:
        mask = (gdf['Layer'] == ln) & (gdf['Text'].notna()) & (gdf.geometry.geom_type == 'Point')
        for _, row in gdf[mask].iterrows():
            txt = row['Text'].strip()
            if len(txt) > 2 and any(txt.upper().startswith(p) for p in PREF_RUA):
                ruas.append({"x": row.geometry.x, "y": row.geometry.y, "text": txt})

    rua_xy = np.array([[r["x"], r["y"]] for r in ruas]) if ruas else np.empty((0, 2))
    rua_txts = np.array([r["text"] for r in ruas]) if ruas else np.array([])

    trechos = []
    sem_pv = 0
    for i, td in enumerate(tubo_data):
        c0 = int(clusters[2 * i])
        c1 = int(clusters[2 * i + 1])

        if c0 == c1:
            continue  # mesmo cluster = tubo circular / erro

        pvi = cid_to_name.get(c0)
        pvf = cid_to_name.get(c1)

        if not pvi or not pvf:
            sem_pv += 1; continue

        mid = (td["p0"] + td["p1"]) / 2
        dn = _parse_dn(_nearest_text(mid[0], mid[1], dn_xy, dn_txts, TOL_TEXTO_TUBO))
        decl = _parse_incl(_nearest_text(mid[0], mid[1], incl_xy, incl_txts, TOL_TEXTO_TUBO))
        rua_txt = _nearest_text(mid[0], mid[1], rua_xy, rua_txts, 300.0)

        # Material: detectar do nome da layer do tubo
        layer_up = td["layer"].upper()
        if "PE_80" in layer_up or "PEAD" in layer_up:
            material = "PE 80"
        elif "PE_100" in layer_up:
            material = "PE 100"
        elif "PVC" in layer_up:
            material = "PVC"
        elif "FFD" in layer_up or "FERRO" in layer_up:
            material = "Ferro Fundido"
        else:
            material = "PVC"

        pvi_d, pvf_d = pvs.get(pvi, {}), pvs.get(pvf, {})

        trechos.append({
            "pv_ini": pvi, "pv_fim": pvf,
            "dn_mm": dn, "ext_m": td["ext"],
            "decl_mm": decl,
            "decl_pct": round(decl * 100, 3) if decl else None,
            "material": material,
            "rua": rua_txt or "Sem Rua",
            "layer": td["layer"],
            "is_agua": is_agua and not is_esgoto,
            "ct_ini": pvi_d.get("ct"), "ct_fim": pvf_d.get("ct"),
            "cf_ini": pvi_d.get("cf"), "cf_fim": pvf_d.get("cf"),
            "prof_ini": pvi_d.get("prof"), "prof_fim": pvf_d.get("prof"),
        })

    # ── 6. DEDUP BIDIRECIONAL ────────────────────────────────────────────────
    por_par = {}
    for t in trechos:
        par = tuple(sorted([t["pv_ini"], t["pv_fim"]]))
        if par not in por_par or (t.get("dn_mm") or 0) > (por_par[par].get("dn_mm") or 0):
            por_par[par] = t

    trechos_ok = list(por_par.values())
    n_dedup = len(trechos) - len(trechos_ok)
    if n_dedup > 0:
        _log(f"  Dedup: {len(trechos)} → {len(trechos_ok)} (-{n_dedup})", "INFO")

    # Remove _cluster from pvs
    for p in pvs.values():
        p.pop("_cluster", None)
        p.pop("x_txt", None)
        p.pop("y_txt", None)

    _log(f"  Rede coletora: {len(trechos_ok)} trechos | "
         f"Ligações descartadas: {sem_pv} | "
         f"{'AGUA' if is_agua else 'ESGOTO'}", "OK")

    meta = {
        "arquivo": Path(dxf_path).name,
        "tipo_rede": "AGUA" if (is_agua and not is_esgoto) else "ESGOTO",
        "n_pvs": len(pvs),
        "n_trechos": len(trechos_ok),
        "motor": "GDAL/OGR+Cluster",
    }
    return pvs, trechos_ok, ruas, meta


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Uso: python ler_dxf_gdal.py <arquivo.dxf>")
        sys.exit(1)

    pvs, trechos, ruas, meta = ler_dxf_gdal(sys.argv[1])
    print(f"\nPVs: {meta['n_pvs']}")
    print(f"Trechos: {meta['n_trechos']}")
    print(f"Extensão: {sum(t['ext_m'] for t in trechos):.0f}m")
    n_dn = sum(1 for t in trechos if t.get('dn_mm'))
    print(f"Com DN: {n_dn}/{len(trechos)}")
    dns = Counter(t['dn_mm'] for t in trechos if t.get('dn_mm'))
    print(f"DNs: {dict(sorted(dns.items()))}")

    # Mismatch check
    import math
    mismatches = 0
    for t in trechos:
        p0, p1 = pvs[t['pv_ini']], pvs[t['pv_fim']]
        d = math.hypot(p1['x'] - p0['x'], p1['y'] - p0['y'])
        r = d / max(t['ext_m'], 0.1)
        if r < 0.5 or r > 2.0:
            mismatches += 1
    print(f"Mismatch: {mismatches}/{len(trechos)}")
