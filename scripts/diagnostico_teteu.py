#!/usr/bin/env python3
"""Diagnóstico do DXF TETÉU_ESGOTO22.dxf"""

import geopandas as gpd
from pathlib import Path
from collections import Counter

dxf_path = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\MORRO DO TETÉU\TETÉU_ESGOTO22.dxf"

print("=" * 70)
print("DIAGNÓSTICO DXF - TETÉU_ESGOTO22.dxf")
print("=" * 70)

gdf = gpd.read_file(dxf_path, layer="entities")
print(f"\nTotal entidades: {len(gdf)}")

# Layers disponíveis
layers = gdf['Layer'].unique()
print(f"\nLayers ({len(layers)}):")
for l in sorted(layers):
    count = len(gdf[gdf['Layer'] == l])
    print(f"  {l}: {count} entidades")

# Contar tipos de geometria
geom_types = Counter(gdf.geometry.geom_type)
print(f"\nTipos de geometria:")
for gt, count in geom_types.items():
    print(f"  {gt}: {count}")

# Textos com "PV" ou "PI"
textos_pv = gdf[
    (gdf['Text'].notna()) & 
    (gdf.geometry.geom_type == 'Point') &
    (gdf['Text'].str.contains(r'PV|PI|P\.V\.|P\.I\.', case=False, regex=True))
]
print(f"\nTextos PV/PI: {len(textos_pv)}")

# Layers de tubo
tubo_layers = [l for l in layers if 'TUBO' in str(l).upper() or 'PROLONG' in str(l).upper()]
print(f"\nLayers de tubo: {tubo_layers}")

if tubo_layers:
    tubos = gdf[gdf['Layer'].isin(tubo_layers)]
    print(f"  Entidades nesses layers: {len(tubos)}")
    
    # Geometrias
    tubos_linha = tubos[tubos.geometry.geom_type.isin(['LineString', 'MultiLineString'])]
    print(f"  Linhas/Polilinhas: {len(tubos_linha)}")

# Buscar PVs específicos sem trecho
pvs_problema = ['PV_43', 'PV_44', 'PV_49', 'PV_47', 'PI_91']
print(f"\nBuscando PVs problema no DXF:")
for nome in pvs_problema:
    match = gdf[
        (gdf['Text'].notna()) &
        (gdf['Text'].str.contains(nome, case=False, regex=False))
    ]
    if len(match) > 0:
        for _, row in match.iterrows():
            print(f"  {nome}: layer={row['Layer']}, xy=({row.geometry.x:.1f}, {row.geometry.y:.1f})")
    else:
        print(f"  {nome}: NÃO ENCONTRADO")

print("\n" + "=" * 70)
