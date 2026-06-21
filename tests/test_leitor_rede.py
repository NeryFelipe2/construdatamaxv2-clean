import os
import pytest

AQUI = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(AQUI, "fixtures", "boi_esgoto.dxf")


def _deps_ok():
    try:
        import geopandas  # noqa
        import scipy       # noqa
        import ler_dxf_gdal  # noqa
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not os.path.exists(FIX) or not _deps_ok(),
    reason="fixture boi_esgoto.dxf ou dependências (GDAL/scipy) ausentes")


def test_conservador_le_boi_esgoto():
    from planejamento.leitor_rede import ler_rede
    pvs, trechos, ruas, meta = ler_rede(FIX)
    assert len(pvs) > 0 and len(trechos) > 0
    assert "BRUTAL" not in meta["motor"]       # nunca cai em brutal


def test_layer_inexistente_recusa_e_lista_layers():
    from planejamento.leitor_rede import ler_rede, RedeNaoEncontrada
    with pytest.raises(RedeNaoEncontrada) as exc:
        ler_rede(FIX, layers_rede=["LAYER_QUE_NAO_EXISTE_XYZ"])
    assert exc.value.layers_disponiveis        # devolve os layers reais p/ override
