import json
from planejamento.exportar import exportar_geojson


def test_geojson_pvs_e_trechos(tmp_path):
    pvs = {"PV1": {"x": 10.0, "y": 20.0, "_generico": True},
           "PV2": {"x": 30.0, "y": 40.0}}
    trechos = [{"pv_ini": "PV1", "pv_fim": "PV2", "dn_mm": 150, "ext_m": 28.3}]
    out = tmp_path / "rede.geojson"
    n = exportar_geojson(pvs, trechos, str(out))
    assert n == 3                                   # 2 PV + 1 trecho
    fc = json.loads(out.read_text(encoding="utf-8"))
    assert fc["type"] == "FeatureCollection"
    geoms = [f["geometry"]["type"] for f in fc["features"]]
    assert geoms.count("Point") == 2 and geoms.count("LineString") == 1
    linha = [f for f in fc["features"] if f["geometry"]["type"] == "LineString"][0]
    assert linha["properties"]["dn_mm"] == 150
    assert linha["geometry"]["coordinates"] == [[10.0, 20.0], [30.0, 40.0]]


def test_geojson_ignora_trecho_sem_pv(tmp_path):
    pvs = {"PV1": {"x": 1.0, "y": 2.0}}
    trechos = [{"pv_ini": "PV1", "pv_fim": "FANTASMA", "dn_mm": None, "ext_m": 5}]
    out = tmp_path / "r.geojson"
    n = exportar_geojson(pvs, trechos, str(out))
    assert n == 1                                   # só o PV; trecho sem PV destino ignorado
