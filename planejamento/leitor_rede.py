"""Terceiro motor de leitura de rede — limpo, com seleção de layer e SEM brutal.

Diferença vs ler_dxf_gdal: este NUNCA cai em modo brutal. Se não reconhecer a
rede, ERRA (RedeNaoEncontrada) listando os layers de linha disponíveis — e essa
lista vira o override: você chama ler_rede(dxf, layers_rede=['0']) para ler a
rede que está num layer fora do padrão (estilo QEsg: nó = ponta da linha).

Reusa os parsers/clustering testados de ler_dxf_gdal SEM modificá-lo.
"""
import math


class RedeNaoEncontrada(Exception):
    """Nenhuma rede confiável nos layers esperados (sem cair em brutal)."""
    def __init__(self, motivo, layers_disponiveis):
        self.layers_disponiveis = list(layers_disponiveis)
        amostra = ", ".join(self.layers_disponiveis[:15])
        super().__init__(f"{motivo}. Layers de linha disponíveis "
                         f"(use layers_rede=[...]): {amostra}")


def _layers_de_linha(gdf):
    lines = gdf[gdf.geometry.geom_type.isin(["LineString", "MultiLineString"])].copy()
    if len(lines) == 0:
        return []
    lines["_L"] = lines.geometry.length
    g = lines.groupby("Layer")["_L"].sum().sort_values(ascending=False)
    return [str(i) for i in g.index]


def ler_rede(dxf_path, layers_rede=None):
    """Lê a rede do DXF e devolve (pvs, trechos, ruas, meta), NUNCA em brutal.

    - layers_rede=None: delega ao ler_dxf_gdal conservador; se ele cair em
      brutal, RECUSA com RedeNaoEncontrada (listando os layers).
    - layers_rede=['0', ...]: lê só esses layers, montando a topologia por
      pontas de linha (clusterização) e associando DN por texto próximo.
    """
    import ler_dxf_gdal as L
    dxf_path = str(dxf_path)

    # ── Caminho conservador: reusa 100% o pipeline testado ───────────────────
    if not layers_rede:
        pvs, trechos, ruas, meta = L.ler_dxf_gdal(dxf_path, brutal=False)
        if "BRUTAL" in str(meta.get("motor", "")):
            import geopandas as gpd
            gdf = gpd.read_file(dxf_path, layer="entities")
            raise RedeNaoEncontrada(
                "Nenhum layer de rede reconhecido (cairia em modo brutal)",
                _layers_de_linha(gdf))
        return pvs, trechos, ruas, meta

    # ── Caminho com seleção explícita de layers (override) ───────────────────
    import geopandas as gpd
    import numpy as np
    from scipy.cluster.hierarchy import fclusterdata

    gdf = gpd.read_file(dxf_path, layer="entities")
    alvo = {str(x).upper() for x in layers_rede}
    tubos = gdf[
        gdf["Layer"].astype(str).str.upper().isin(alvo)
        & gdf.geometry.geom_type.isin(["LineString", "MultiLineString"])
    ].copy()
    if len(tubos):
        tubos["ext_m"] = tubos.geometry.length
        tubos = tubos[tubos["ext_m"] > L.MIN_EXT_TUBO]
    if len(tubos) == 0:
        raise RedeNaoEncontrada(
            f"Nenhuma linha > {L.MIN_EXT_TUBO}m nos layers {list(layers_rede)}",
            _layers_de_linha(gdf))

    # Explode polylines em segmentos (mesma lógica do ler_dxf_gdal)
    all_ep, tubo_data = [], []
    for _, t in tubos.iterrows():
        coords = L._coords_geom(t.geometry)
        for i in range(len(coords) - 1):
            p0, p1 = coords[i][:2], coords[i + 1][:2]
            ext = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
            if ext < L.MIN_EXT_TUBO:
                continue
            all_ep.append(p0)
            all_ep.append(p1)
            tubo_data.append((p0, p1, round(ext, 2), str(t.get("Layer", ""))))

    if len(all_ep) < 4:
        raise RedeNaoEncontrada("Endpoints insuficientes para formar rede",
                                _layers_de_linha(gdf))

    ep = np.array(all_ep)
    clusters = fclusterdata(ep, t=L.TOL_CLUSTER, criterion="distance")
    centros = {c: ep[clusters == c].mean(axis=0) for c in set(clusters)}
    cid_nome = {c: "PV_%d" % i for i, c in enumerate(sorted(centros), 1)}
    pvs = {cid_nome[c]: {"x": float(centros[c][0]), "y": float(centros[c][1]),
                         "_generico": True} for c in centros}

    # DN por texto de layers DIAM/DN (reusa _nearest_text + _parse_dn)
    dn_xy, dn_txt = [], []
    for dl in [l for l in gdf["Layer"].unique()
               if "DIAM" in str(l).upper() or "DN" in str(l).upper()]:
        m = ((gdf["Layer"] == dl) & (gdf["Text"].notna())
             & (gdf.geometry.geom_type == "Point"))
        for _, r in gdf[m].iterrows():
            dn_xy.append((r.geometry.x, r.geometry.y))
            dn_txt.append(str(r["Text"]))
    dn_xy = np.array(dn_xy) if dn_xy else np.empty((0, 2))
    dn_txt = np.array(dn_txt) if len(dn_txt) else np.array([])

    trechos = []
    for k, (p0, p1, ext, layer) in enumerate(tubo_data):
        c0, c1 = clusters[2 * k], clusters[2 * k + 1]
        if c0 == c1:
            continue
        dn = None
        if len(dn_xy):
            mx = (centros[c0][0] + centros[c1][0]) / 2.0
            my = (centros[c0][1] + centros[c1][1]) / 2.0
            txt = L._nearest_text(mx, my, dn_xy, dn_txt, max_d=L.TOL_TEXTO_TUBO)
            dn = L._parse_dn(txt) if txt else None
        if dn is None:
            dn = L._parse_dn(layer)
        trechos.append({"pv_ini": cid_nome[c0], "pv_fim": cid_nome[c1],
                        "ext_m": ext, "dn_mm": dn, "layer": layer})

    trechos = L._dedup_trechos(trechos)
    meta = {
        "arquivo": dxf_path.replace("\\", "/").split("/")[-1],
        "n_pvs": len(pvs), "n_trechos": len(trechos),
        "ext_total": round(sum(t["ext_m"] for t in trechos), 2),
        "motor": "leitor_rede v1 (layers=%s, sem brutal)" % (list(layers_rede),),
        "n_pvs_genericos": len(pvs),
    }
    return pvs, trechos, [], meta
