import json
import os
import pytest

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
DXF = os.path.join(RAIZ, "_tmp_dwg", "SAO_MANOEL_ESGOTO_COMPLETO_v3_.dxf")
GOLDEN = os.path.join(AQUI, "golden", "sao_manoel.json")


def test_ingestao_sao_manoel_bate_golden():
    if not os.path.exists(GOLDEN):
        pytest.skip("baseline golden não confirmado "
                    "(gere tests/golden/sao_manoel.json a partir de um DXF confiável)")
    if not os.path.exists(DXF):
        pytest.skip(f"fixture ausente: {DXF}")
    try:
        from ler_dxf_gdal import ler_dxf_gdal
    except Exception as e:               # GDAL/geopandas/ezdxf ausentes
        pytest.skip(f"dependências do leitor ausentes: {e}")
    from planejamento.resumo import resumo_rede

    pvs, trechos, _ruas, _meta = ler_dxf_gdal(DXF)
    atual = resumo_rede(pvs, trechos)

    with open(GOLDEN, encoding="utf-8") as f:
        esperado = json.load(f)
    assert atual["n_pvs"] == esperado["n_pvs"], "nº de PVs mudou (regressão de ingestão)"
    assert atual["n_trechos"] == esperado["n_trechos"], "nº de trechos mudou (possível invenção/perda)"
    assert atual["trechos"] == esperado["trechos"], "topologia/DN/extensão dos trechos mudou"
