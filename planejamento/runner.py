# -*- coding: utf-8 -*-
"""Roda o motor único para 1 núcleo: `python -m planejamento.runner <chave>`.
Lista os núcleos disponíveis se chamado sem chave."""
import sys
from .nucleos import NUCLEOS
from .pipeline import pipeline_nucleo


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    if not argv or argv[0] not in NUCLEOS:
        print("Núcleos disponíveis:")
        for k, c in NUCLEOS.items():
            print("  - %-22s %s / %s" % (k, c["nucleo"], c["sistema"]))
        return
    res = pipeline_nucleo(dict(NUCLEOS[argv[0]]))
    print("\nOK —", res["nucleo"], res["sistema"], "|", res["trechos"], "trechos |", res["inicio"], "->", res["fim"])
    print("  equipes:", res["equipes"])
    for k in ("project", "planilha", "ns_pdf", "gpkg", "nota"):
        print("  %-9s %s" % (k + ":", res.get(k)))


if __name__ == "__main__":
    main()
