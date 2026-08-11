#!/usr/bin/env python3
"""Investigar tubos sem PV"""

import geopandas as gpd
import numpy as np
from scipy.cluster.hierarchy import fclusterdata

dxf_path = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\MORRO DO TETÉU\TETÉU_ESGOTO22.dxf"

gdf = gpd.read_file(dxf_path, layer="entities")

# Extrair apenas TUBO_PVC
tubos = gdf[
    (gdf['Layer'] == 'TUBO_PVC') &
    (gdf.geometry.geom_type.isin(['LineString', 'MultiLineString']))
].copy()
tubos['ext_m'] = tubos.geometry.length
tubos = tubos[tubos['ext_m'] > 2.0]

print(f"Tubos TUBO_PVC > 2m: {len(tubos)}")

# Extrair endpoints
all_endpoints = []
tubo_data = []
for _, t in tubos.iterrows():
    coords = list(t.geometry.coords)
    if len(coords) < 2:
        continue
    p0, p1 = coords[0][:2], coords[-1][:2]
    all_endpoints.append(p0)
    all_endpoints.append(p1)
    tubo_data.append({"p0": np.array(p0), "p1": np.array(p1), "ext": t['ext_m']})

ep_arr = np.array(all_endpoints)

# Clusterizar
clusters = fclusterdata(ep_arr, t=3.0, criterion='distance')
cluster_centers = {}
for c in set(clusters):
    mask = clusters == c
    cluster_centers[c] = ep_arr[mask].mean(axis=0)

print(f"Clusters: {len(cluster_centers)}")

# Extrair textos PV
pv_texts = gdf[
    (gdf['Layer'] == 'PS_PONTOS_IDENTIFICACAO_TXT') &
    (gdf['Text'].notna()) &
    (gdf.geometry.geom_type == 'Point')
]

print(f"Textos PV: {len(pv_texts)}")

# Para cada tubo, verificar se endpoints estão em clusters com PV
txt_dict = {}
for _, row in pv_texts.iterrows():
    txt = str(row['Text']).strip()
    # Extrair número do PV
    import re
    m = re.match(r"(?:P\.?\s*[VI]\.?\s*[-_]?\s*)(\d+)", txt, re.IGNORECASE)
    if m:
        num = m.group(1)
        txt_dict[f"PV_{num}"] = (row.geometry.x, row.geometry.y)
    elif re.match(r"^\d{3,4}$", txt):
        txt_dict[f"PV_{txt}"] = (row.geometry.x, row.geometry.y)

print(f"Textos PV válidos: {len(txt_dict)}")

# Associar clusters a textos
from scipy.spatial.distance import cdist

txt_names = list(txt_dict.keys())
txt_xy = np.array([txt_dict[n] for n in txt_names])

cluster_to_txt = {}
used_txts = set()

for cid, center in cluster_centers.items():
    dists = np.sqrt(((txt_xy - center) ** 2).sum(axis=1))
    for idx in np.argsort(dists):
        if dists[idx] > 15:
            break
        nome = txt_names[idx]
        if nome not in used_txts:
            used_txts.add(nome)
            cluster_to_txt[cid] = nome
            break

print(f"Clusters com PV nomeado: {len(cluster_to_txt)}")

# Contar tubos com ambos endpoints nomeados
tubos_completos = 0
tubos_sem_pv = []

for i, td in enumerate(tubo_data):
    c0 = clusters[2*i]
    c1 = clusters[2*i+1]
    
    pvi = cluster_to_txt.get(c0)
    pvf = cluster_to_txt.get(c1)
    
    if pvi and pvf:
        tubos_completos += 1
    else:
        tubos_sem_pv.append({
            "idx": i,
            "c0": c0,
            "c1": c1,
            "pvi": pvi,
            "pvf": pvf,
            "ext": td["ext"]
        })

print(f"\nTubos completos: {tubos_completos}")
print(f"Tubos sem PV: {len(tubos_sem_pv)}")

# Mostrar detalhes dos tubos sem PV
print("\nTubos sem PV (primeiros 15):")
for t in tubos_sem_pv[:15]:
    c0_has = "SIM" if cluster_to_txt.get(t["c0"]) else "NÃO"
    c1_has = "SIM" if cluster_to_txt.get(t["c1"]) else "NÃO"
    print(f"  Tubo {t['idx']}: c{t['c0']}({c0_has}) -> c{t['c1']}({c1_has}), ext={t['ext']:.1f}m")

# Mostrar clusters sem PV
clusters_sem_pv = set(cluster_centers.keys()) - set(cluster_to_txt.keys())
print(f"\nClusters sem PV: {len(clusters_sem_pv)}")
for cid in sorted(clusters_sem_pv)[:10]:
    center = cluster_centers[cid]
    print(f"  Cluster {cid}: ({center[0]:.1f}, {center[1]:.1f})")
