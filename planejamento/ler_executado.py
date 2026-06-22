"""Leitor dos GeoPackages de executado / a fazer (QGIS) para o formato dos motores.

Cada feição de linha vira um trecho {ext_m, sistema, equipe, prof_med, ramais, ...}.
Quando a coluna 'comprimento' está vazia (esquema só com geometria), usa o
comprimento real da geometria.
"""


def _num(v):
    try:
        f = float(v)
        return f if f == f else None        # filtra NaN
    except (TypeError, ValueError):
        return None


def rua_mais_proxima(geometrias, rotulos_xy, rotulos_txt, tol_m=120.0):
    """Vínculo espacial trecho↔rua: para cada geometria (linha), devolve o
    rótulo de rua mais próximo do ponto médio dentro de tol_m (senão None).
    rotulos_xy = lista de (x, y) dos textos de rua (mesmo CRS das geometrias)."""
    import numpy as np
    if not rotulos_xy:
        return [None] * len(list(geometrias))
    rx = np.array([p[0] for p in rotulos_xy])
    ry = np.array([p[1] for p in rotulos_xy])
    out = []
    for geom in geometrias:
        if geom is None:
            out.append(None)
            continue
        c = geom.interpolate(0.5, normalized=True)
        d = np.hypot(rx - c.x, ry - c.y)
        j = int(d.argmin())
        out.append(rotulos_txt[j] if d[j] <= tol_m else None)
    return out


def ler_gpkg(caminho, layer=None, sistema=None):
    """Lê uma camada de linhas de um .gpkg -> lista de trechos no formato dos motores."""
    import geopandas as gpd
    import fiona
    if layer is None:
        layer = fiona.listlayers(caminho)[0]
    g = gpd.read_file(caminho, layer=layer)

    def col(row, *nomes):
        for n in nomes:
            if n in row and row[n] is not None:
                return row[n]
        return None

    trechos = []
    for _, row in g.iterrows():
        comp = _num(col(row, "comprimento", "COMPRIMENTO"))
        if comp is None and row.geometry is not None:
            comp = float(row.geometry.length)
        trechos.append({
            "ext_m": comp or 0.0,
            "sistema": sistema or "",
            "equipe": col(row, "Equipe"),
            "prof_med": _num(col(row, "Prof_med", "Prof_med")),
            "ramais": _num(col(row, "Ramais")),
            "vala": col(row, "TIpo de vala", "Tipo de vala"),
            "data_ini": col(row, "data de inicio", "data inicio"),
            "data_fim": col(row, "data fim"),
            "encarregado": col(row, "Encarreg"),
        })
    return trechos
