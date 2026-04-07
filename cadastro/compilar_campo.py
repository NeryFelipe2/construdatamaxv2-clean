"""
Compila pontos do topografo com PVs/trechos do projeto.
Substitui coordenadas e cotas (CT/CF) pelos valores reais e gera divergencias.
"""
import math


def _dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def compilar_campo(pvs: dict, trechos: list, topo_pts: list, raio_match: float = 8.0):
    """
    Retorna (pvs_real, trechos_real, divergencias).
    pvs: {nome: {x,y,ct,cf,prof,...}}
    topo_pts: [{n,e,z,tipo,...}]
    Se o topo estiver em frame local (poligonal livre), aciona georef RANSAC
    contra os PVs do projeto antes de fazer o merge.
    """
    pvs_real = {k: dict(v) for k, v in pvs.items()}
    divergencias = []

    # Georef poligonal local -> UTM, se necessario
    try:
        from .poligonal import georreferenciar
        topo_pts, info_georef = georreferenciar(topo_pts, pvs_real)
        if info_georef.get("georref"):
            print(f"  [POLIGONAL] georef OK: {info_georef['inliers']} inliers / {info_georef['n_topo_pv']} PVs topo")
        else:
            print(f"  [POLIGONAL] georef NAO aplicado: {info_georef.get('motivo')}")
    except Exception as e:
        print(f"  [POLIGONAL] erro: {e}")

    topo_pv = [p for p in topo_pts if p["tipo"] == "PV"]
    topo_gr = [p for p in topo_pts if p["tipo"] == "GERATRIZ"]

    for nome, pv in pvs_real.items():
        x, y = pv.get("x"), pv.get("y")
        if not x:
            continue
        # PV mais proximo no levantamento
        cand = [(p, _dist((x, y), (p["e"], p["n"]))) for p in topo_pv]
        cand = [c for c in cand if c[1] <= raio_match]
        if not cand:
            continue
        match, d = min(cand, key=lambda c: c[1])

        ct_proj = pv.get("ct", 0) or 0
        cf_proj = pv.get("cf", 0) or 0

        # geratriz (fundo) mais proxima do PV no campo
        gr_cand = [(g, _dist((match["e"], match["n"]), (g["e"], g["n"]))) for g in topo_gr]
        gr_cand = [c for c in gr_cand if c[1] <= raio_match]
        cf_real = min(gr_cand, key=lambda c: c[1])[0]["z"] if gr_cand else cf_proj

        # substitui
        pv["x"] = match["e"]
        pv["y"] = match["n"]
        pv["ct"] = match["z"]
        pv["cf"] = cf_real
        pv["prof"] = round(match["z"] - cf_real, 3)
        pv["fonte"] = "CAMPO"

        # divergencias (mesmo schema do _gerar_divergencias_xlsx)
        if ct_proj:
            diff = round(match["z"] - ct_proj, 3)
            if abs(diff) > 0.05:
                divergencias.append({
                    "ns_key": "", "pv": nome, "campo": "CT",
                    "projeto": ct_proj, "campo_real": match["z"], "diferenca_m": diff,
                })
        if cf_proj and gr_cand:
            diff = round(cf_real - cf_proj, 3)
            if abs(diff) > 0.05:
                divergencias.append({
                    "ns_key": "", "pv": nome, "campo": "CF",
                    "projeto": cf_proj, "campo_real": cf_real, "diferenca_m": diff,
                })

    # recalcula extensao dos trechos com coords novas
    trechos_real = []
    for tr in trechos:
        t = dict(tr)
        a = pvs_real.get(t.get("pv_ini"), {})
        b = pvs_real.get(t.get("pv_fim"), {})
        if a.get("x") and b.get("x"):
            t["ext_m"] = round(_dist((a["x"], a["y"]), (b["x"], b["y"])), 3)
        trechos_real.append(t)

    return pvs_real, trechos_real, divergencias
