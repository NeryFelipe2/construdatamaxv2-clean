"""Gate de ingestão confiável.

Lê a rede do CAD e RECUSA leituras não confiáveis (modo brutal / sinais de
invenção) em vez de deixar o erro se propagar para o planejamento.
É a aplicação prática do princípio "não multiplicar erro" na fronteira de entrada.
"""
from .sanidade import checar_sanidade


class IngestaoNaoConfiavel(Exception):
    """Leitura recusada por sinais de invenção/rede não confiável."""
    def __init__(self, avisos):
        self.avisos = list(avisos)
        super().__init__("Ingestão não confiável: " + " | ".join(self.avisos))


def ler_rede_confiavel(dxf_path, _reader=None):
    """Devolve (pvs, trechos, ruas, meta) SÓ se a leitura for confiável.

    Caso contrário levanta IngestaoNaoConfiavel com os avisos da sanidade
    (modo brutal, PV inexistente, baixa cobertura de DN, etc.).
    `_reader` permite injetar um leitor (testes); por padrão usa ler_dxf_gdal.
    """
    if _reader is None:
        from ler_dxf_gdal import ler_dxf_gdal as _reader
    pvs, trechos, ruas, meta = _reader(dxf_path)
    avisos = checar_sanidade(pvs, trechos, meta)
    if avisos:
        raise IngestaoNaoConfiavel(avisos)
    return pvs, trechos, ruas, meta
