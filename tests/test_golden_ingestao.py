import json
import os
import pytest

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
# DXF confiável (conservador, 100% DN). 9 MB -> não vai pro git (tests/fixtures/.gitignore).
# Override com a variável de ambiente NS_GOLDEN_DXF.
DXF = os.environ.get("NS_GOLDEN_DXF", os.path.join(AQUI, "fixtures", "boi_esgoto.dxf"))
GOLDEN = os.path.join(AQUI, "golden", "boi_esgoto.json")


def test_ingestao_boi_esgoto_bate_golden():
    if not os.path.exists(GOLDEN):
        pytest.skip("baseline golden ausente")
    if not os.path.exists(DXF):
        pytest.skip(f"fixture ausente: {DXF} (defina NS_GOLDEN_DXF)")
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
