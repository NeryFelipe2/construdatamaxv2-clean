import pytest
from planejamento.ingestao import ler_rede_confiavel, IngestaoNaoConfiavel


def _reader(pvs, trechos, meta):
    def _r(path):
        return pvs, trechos, [], meta
    return _r


def test_aceita_leitura_conservadora():
    pvs = {"PV1": {}, "PV2": {}}
    trechos = [{"pv_ini": "PV1", "pv_fim": "PV2", "ext_m": 40.0, "dn_mm": 150}]
    meta = {"motor": "GDAL/OGR v5 (conservador)"}
    r = ler_rede_confiavel("x.dxf", _reader=_reader(pvs, trechos, meta))
    assert r[0] == pvs and r[3] == meta


def test_recusa_modo_brutal():
    pvs = {"PV1": {}, "PV2": {}}
    trechos = [{"pv_ini": "PV1", "pv_fim": "PV2", "ext_m": 40.0, "dn_mm": 150}]
    meta = {"motor": "GDAL/OGR v5 (BRUTAL)"}
    with pytest.raises(IngestaoNaoConfiavel):
        ler_rede_confiavel("x.dxf", _reader=_reader(pvs, trechos, meta))


def test_recusa_rede_sem_dn():
    pvs = {f"PV{i}": {} for i in range(10)}
    trechos = [{"pv_ini": f"PV{i}", "pv_fim": f"PV{i+1}", "ext_m": 30.0, "dn_mm": None}
               for i in range(9)]
    meta = {"motor": "GDAL/OGR v5 (conservador)"}
    with pytest.raises(IngestaoNaoConfiavel) as exc:
        ler_rede_confiavel("x.dxf", _reader=_reader(pvs, trechos, meta))
    assert exc.value.avisos  # carrega os avisos
