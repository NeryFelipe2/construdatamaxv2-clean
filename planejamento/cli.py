"""Entrada para gerar a planilha-mestre a partir de DXF reais (CLI / GUI / .bat).

Uso:
  python -m planejamento.cli --esgoto rede_esgoto.dxf --saida PLANEJAMENTO.xlsx
  python -m planejamento.cli --esgoto x.dxf --layers-esgoto 0 --saida out.xlsx
"""
import argparse

from .leitor_rede import ler_rede, RedeNaoEncontrada
from .master import gerar_master


def gerar_de_dxf(saida, dxf_esgoto=None, dxf_agua=None,
                 layers_esgoto=None, layers_agua=None, **kwargs):
    """Roda a leitura confiável (sem brutal) e gera a planilha-mestre.

    Levanta RedeNaoEncontrada (com a lista de layers) se a leitura não for
    confiável — aí basta repassar layers_esgoto/layers_agua.
    """
    te = ta = pe = pa = None
    if dxf_esgoto:
        pe, te, _ruas, _meta = ler_rede(dxf_esgoto, layers_rede=layers_esgoto)
    if dxf_agua:
        pa, ta, _ruas, _meta = ler_rede(dxf_agua, layers_rede=layers_agua)
    if not (te or ta):
        raise ValueError("Informe ao menos --esgoto ou --agua")
    return gerar_master(saida, trechos_esgoto=te, trechos_agua=ta,
                        pvs_esgoto=pe, pvs_agua=pa, **kwargs)


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Gera a planilha-mestre de planejamento a partir de DXF.")
    ap.add_argument("--esgoto", help="DXF da rede de esgoto")
    ap.add_argument("--agua", help="DXF da rede de água")
    ap.add_argument("--layers-esgoto", nargs="*", help="layers da rede de esgoto (override)")
    ap.add_argument("--layers-agua", nargs="*", help="layers da rede de água (override)")
    ap.add_argument("--saida", required=True, help="caminho do .xlsx de saída")
    a = ap.parse_args(argv)
    try:
        info = gerar_de_dxf(a.saida, dxf_esgoto=a.esgoto, dxf_agua=a.agua,
                            layers_esgoto=a.layers_esgoto, layers_agua=a.layers_agua)
        print("Gerado:", info["saida"], "| abas:", ", ".join(info["abas"]))
    except RedeNaoEncontrada as e:
        print("Leitura não confiável:", e)
        print("Repita passando --layers-esgoto/--layers-agua com o layer da rede.")
        raise SystemExit(2)


if __name__ == "__main__":
    main()
