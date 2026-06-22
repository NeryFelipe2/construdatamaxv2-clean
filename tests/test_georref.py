import pytest


def test_rua_mais_proxima():
    pytest.importorskip("shapely")
    from shapely.geometry import LineString
    from planejamento.ler_executado import rua_mais_proxima

    geoms = [LineString([(0, 0), (10, 0)]), LineString([(100, 100), (110, 100)])]
    rotulos_xy = [(5, 2), (105, 98)]
    rotulos_txt = ["RUA A", "RUA B"]
    assert rua_mais_proxima(geoms, rotulos_xy, rotulos_txt, tol_m=20) == ["RUA A", "RUA B"]

    # rótulo longe (> tol) -> None
    longe = [LineString([(500, 500), (510, 500)])]
    assert rua_mais_proxima(longe, rotulos_xy, rotulos_txt, tol_m=20) == [None]


def test_sem_rotulos():
    pytest.importorskip("shapely")
    from shapely.geometry import LineString
    from planejamento.ler_executado import rua_mais_proxima
    assert rua_mais_proxima([LineString([(0, 0), (1, 0)])], [], []) == [None]
