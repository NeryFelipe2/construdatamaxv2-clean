"""Trava a correção (B): _extrair_tubos_brutal deve excluir o MESMO lixo que o
conservador (PONTOS/CAIXAS/QUADRA/IDENTIFICACAO), não só molduras.
Antes da correção, esses layers passavam no brutal e viravam tubos fantasmas."""
import pytest


def test_brutal_exclui_pontos_caixas_quadra():
    gpd = pytest.importorskip("geopandas")
    shapely = pytest.importorskip("shapely")
    from shapely.geometry import LineString
    try:
        import ler_dxf_gdal as L
    except Exception as e:
        pytest.skip("dependências do leitor ausentes: %s" % e)

    rows = [
        {"Layer": "0", "geometry": LineString([(0, 0), (50, 0)])},                       # rede -> mantém
        {"Layer": "PS_PONTOS_IDENTIFICACAO_LIN", "geometry": LineString([(0, 5), (50, 5)])},   # exclui
        {"Layer": "PONTOS-Caixas - Esgoto_U", "geometry": LineString([(0, 8), (50, 8)])},      # exclui
        {"Layer": "QUADRA -D", "geometry": LineString([(0, 11), (50, 11)])},             # exclui
    ]
    gdf = gpd.GeoDataFrame(rows, geometry="geometry")

    tubos = L._extrair_tubos_brutal(gdf)
    layers = {str(x).upper() for x in tubos["Layer"]}

    assert "0" in layers                                   # a rede no '0' é mantida
    assert not any("PONTOS" in s for s in layers)          # pontos/caixas barrados
    assert not any("QUADRA" in s for s in layers)          # cadastro barrado
