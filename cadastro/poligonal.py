"""
Georreferenciamento de poligonal topografica livre (frame local) para UTM.
Usa RANSAC sobre pares de PVs do levantamento e do projeto:
para cada par (a,b) do topo cuja distancia bate com um par (A,B) do projeto,
ajusta uma transformacao rigida (rotacao + translacao, escala 1) e conta
quantos outros PVs do topo caem dentro da tolerancia de algum PV do projeto.
A transformacao com mais inliers vence.
"""
import math


def _eh_local(pts, limite=100000):
    """Heuristica: coords absolutas pequenas indicam frame local."""
    for p in pts:
        if abs(p.get("e", 0)) > limite or abs(p.get("n", 0)) > limite:
            return False
    return True


def _aplicar(t, x, y):
    cs, sn, tx, ty = t
    return cs * x - sn * y + tx, sn * x + cs * y + ty


def _transf_de_par(a, b, A, B):
    """Rotacao+translacao que leva (a->A, b->B). Retorna (cos, sin, tx, ty)."""
    dx_l, dy_l = b[0] - a[0], b[1] - a[1]
    dx_u, dy_u = B[0] - A[0], B[1] - A[1]
    ang_l = math.atan2(dy_l, dx_l)
    ang_u = math.atan2(dy_u, dx_u)
    th = ang_u - ang_l
    cs, sn = math.cos(th), math.sin(th)
    tx = A[0] - (cs * a[0] - sn * a[1])
    ty = A[1] - (sn * a[0] + cs * a[1])
    return (cs, sn, tx, ty)


def georreferenciar(topo_pts, pvs_projeto, tol_dist=1.5, tol_match=5.0):
    """
    Devolve (topo_utm, info). topo_utm = mesma lista de pontos com e/n
    transformados para UTM. info = dict com diagnostico.

    pvs_projeto: dict {nome: {x,y,...}}
    tol_dist : tolerancia ao casar distancias entre pares (m)
    tol_match: tolerancia ao contar inliers (PV topo perto de PV projeto, m)
    """
    if not _eh_local(topo_pts):
        return topo_pts, {"georref": False, "motivo": "ja parece UTM"}

    topo_pv = [(p, p["e"], p["n"]) for p in topo_pts if p["tipo"] == "PV"]
    proj_pv = [(nm, pv["x"], pv["y"]) for nm, pv in pvs_projeto.items() if pv.get("x")]
    if len(topo_pv) < 2 or len(proj_pv) < 2:
        return topo_pts, {"georref": False, "motivo": "PVs insuficientes"}

    # Pre-calcula distancias dos pares do projeto
    proj_pares = []
    for i in range(len(proj_pv)):
        for j in range(i + 1, len(proj_pv)):
            A = proj_pv[i]; B = proj_pv[j]
            d = math.hypot(A[1] - B[1], A[2] - B[2])
            if 5 < d < 300:  # ignora coincidentes e longos demais
                proj_pares.append((A, B, d))

    melhor = None  # (n_inliers, transf)

    for i in range(len(topo_pv)):
        for j in range(i + 1, len(topo_pv)):
            a = (topo_pv[i][1], topo_pv[i][2])
            b = (topo_pv[j][1], topo_pv[j][2])
            d_l = math.hypot(a[0] - b[0], a[1] - b[1])
            if d_l < 5:
                continue
            for A_, B_, d_p in proj_pares:
                if abs(d_p - d_l) > tol_dist:
                    continue
                # tenta orientacoes A->a,B->b e A->b,B->a
                for ax, bx in (((A_[1], A_[2]), (B_[1], B_[2])),
                               ((B_[1], B_[2]), (A_[1], A_[2]))):
                    t = _transf_de_par(a, b, ax, bx)
                    usados = set()  # PVs do projeto ja consumidos
                    n_in = 0
                    for _, ex, ny in topo_pv:
                        ux, uy = _aplicar(t, ex, ny)
                        melhor_pv, melhor_d2 = None, tol_match * tol_match
                        for k, (_, px, py) in enumerate(proj_pv):
                            if k in usados:
                                continue
                            d2 = (ux - px) ** 2 + (uy - py) ** 2
                            if d2 <= melhor_d2:
                                melhor_d2 = d2
                                melhor_pv = k
                        if melhor_pv is not None:
                            usados.add(melhor_pv)
                            n_in += 1
                    if melhor is None or n_in > melhor[0]:
                        melhor = (n_in, t)

    if not melhor or melhor[0] < 2:
        return topo_pts, {"georref": False, "motivo": "sem casamento"}

    n_in, t = melhor
    topo_utm = []
    for p in topo_pts:
        ux, uy = _aplicar(t, p["e"], p["n"])
        q = dict(p)
        q["e"] = ux
        q["n"] = uy
        topo_utm.append(q)

    return topo_utm, {"georref": True, "inliers": n_in, "n_topo_pv": len(topo_pv)}
