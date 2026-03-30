from pathlib import Path

import geopandas as gpd
import numpy as np
import pytest
from shapely.geometry import LineString, Point

import ler_dxf_gdal as dxfmod


def _gdf(rows):
    return gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:31983")


def _touch_dxf(tmp_path, name):
    arquivo = tmp_path / name
    arquivo.write_text("0\nEOF\n", encoding="utf-8")
    return arquivo


def test_rejeita_dxf_sem_layer_confiavel(monkeypatch, tmp_path):
    gdf = _gdf(
        [
            {
                "Layer": "PS_PERFIL_TUBO",
                "Text": None,
                "geometry": LineString([(360000, 7350000), (360012, 7350000)]),
            }
        ]
    )
    monkeypatch.setattr(dxfmod.gpd, "read_file", lambda *args, **kwargs: gdf)

    arquivo = _touch_dxf(tmp_path, "bim_export.dxf")

    with pytest.raises(ValueError, match="evitar tubos/PVs inventados"):
        dxfmod.ler_dxf_gdal(str(arquivo))


def test_cria_pvs_genericos_quando_nao_ha_textos(monkeypatch, tmp_path):
    gdf = _gdf(
        [
            {
                "Layer": "TUBO_PVC",
                "Text": None,
                "geometry": LineString([(360000, 7350000), (360020, 7350000)]),
            },
            {
                "Layer": "TUBO_PVC",
                "Text": None,
                "geometry": LineString([(360020, 7350000), (360040, 7350010)]),
            },
        ]
    )
    monkeypatch.setattr(dxfmod.gpd, "read_file", lambda *args, **kwargs: gdf)

    arquivo = _touch_dxf(tmp_path, "rede_sem_textos.dxf")
    pvs, trechos, ruas, meta = dxfmod.ler_dxf_gdal(str(arquivo))

    assert len(trechos) == 2
    assert not ruas
    assert meta["n_pvs"] == 3
    assert meta["n_pvs_genericos"] == 3
    assert all(nome.startswith("PV_G") for nome in pvs)
    assert all(pv.get("_generico") for pv in pvs.values())


def test_ignora_ps_pontos_em_coordenada_local_e_mantem_rede(monkeypatch, tmp_path):
    gdf = _gdf(
        [
            {
                "Layer": "TUBO_PVC",
                "Text": None,
                "geometry": LineString([(360000, 7350000), (360020, 7350000)]),
            },
            {
                "Layer": "TUBO_PVC",
                "Text": None,
                "geometry": LineString([(360020, 7350000), (360040, 7350010)]),
            },
            {
                "Layer": "PS_PONTOS_IDENTIFICACAO_TXT",
                "Text": "P.I. 02",
                "geometry": Point(5.1, 78.0),
            },
            {
                "Layer": "PS_PONTOS_IDENTIFICACAO_TXT",
                "Text": "C.T. 11.295",
                "geometry": Point(5.1, 73.0),
            },
            {
                "Layer": "PS_PONTOS_IDENTIFICACAO_TXT",
                "Text": "C.F. 10.695",
                "geometry": Point(5.1, 68.0),
            },
        ]
    )
    monkeypatch.setattr(dxfmod.gpd, "read_file", lambda *args, **kwargs: gdf)

    arquivo = _touch_dxf(tmp_path, "prosane_perfil_local.dxf")
    pvs, trechos, ruas, meta = dxfmod.ler_dxf_gdal(str(arquivo))

    assert len(trechos) == 2
    assert not ruas
    assert meta["n_pvs_genericos"] == 3
    assert all(nome.startswith("PV_G") for nome in pvs)


def test_agrupar_textos_pv_monta_nome_e_cotas():
    pvs = dxfmod._agrupar_textos_pv(
        [
            (100.0, 110.0, "PV 12"),
            (100.0, 105.0, "C.T. 11.50"),
            (100.0, 100.0, "C.F. 10.20"),
        ]
    )

    assert set(pvs) == {"PV_12"}
    assert pvs["PV_12"]["ct"] == pytest.approx(11.5)
    assert pvs["PV_12"]["cf"] == pytest.approx(10.2)
    assert pvs["PV_12"]["prof"] == pytest.approx(1.3)


def test_associar_clusters_textos_v5_mescla_nomeado_e_generico():
    cluster_centers = {
        1: np.array([100.0, 100.0]),
        2: np.array([200.0, 200.0]),
    }
    pvs_txt = {
        "PV_01": {
            "x_txt": 100.4,
            "y_txt": 100.1,
            "ct": 10.0,
            "cf": 9.2,
            "prof": 0.8,
            "text_points": [(100.4, 100.1)],
        }
    }

    pvs = dxfmod._associar_clusters_textos_v5(cluster_centers, pvs_txt)

    assert "PV_01" in pvs
    assert pvs["PV_01"]["x"] == pytest.approx(100.0)
    assert pvs["PV_01"]["y"] == pytest.approx(100.0)
    genericos = [nome for nome in pvs if nome.startswith("PV_G")]
    assert len(genericos) == 1
    assert pvs[genericos[0]]["_generico"] is True


def test_parse_dn_e_inclinacao():
    assert dxfmod._parse_dn("DN 150") == 150
    assert dxfmod._parse_dn("D=200") == 200
    assert dxfmod._parse_incl("0.5%") == pytest.approx(0.005)
    assert dxfmod._parse_incl("0.003 m/m") == pytest.approx(0.003)
