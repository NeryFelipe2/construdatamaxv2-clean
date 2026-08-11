#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
processar_prolongamentos.py — Gera NS dos Prolongamentos via LandXML
ConstruData SABESP v6

Os XMLs já foram exportados do Civil 3D e estão na pasta de projetos.
Rodar: python processar_prolongamentos.py
"""
import sys, os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ler_landxml import ler_landxml
from gerar_ns import processar_nucleo_from_data

# ── XMLs dos prolongamentos ─────────────────────────────────
XML_DIR = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018"

PROLONGAMENTOS = [
    {"xml": f"{XML_DIR}\\PROLONGAMENTO TETEU ALT-01.xml",
     "nucleo": "Prolongamento Teteu Alt-01"},
    {"xml": f"{XML_DIR}\\PROLONGAMENTO TETEU.xml",
     "nucleo": "Prolongamento Teteu"},
    {"xml": f"{XML_DIR}\\PROLONGAMENTO PANTANAL BAIXO.xml",
     "nucleo": "Prolongamento Pantanal Baixo"},
    {"xml": f"{XML_DIR}\\PROLONGAMENTO CRIADORES.xml",
     "nucleo": "Prolongamento Criadores"},
    {"xml": f"{XML_DIR}\\PROLONGAMENTO SÃO MANOEL.xml",
     "nucleo": "Prolongamento Sao Manoel"},
]

OUT_DIR = str(Path(__file__).parent / "SAIDA_BIM_SABESP")


def main():
    print("=" * 60)
    print("ConstruData SABESP v6 — Prolongamentos via LandXML")
    print(f"  {len(PROLONGAMENTOS)} prolongamentos")
    print("=" * 60)

    total_ok, total_err = 0, 0

    for item in PROLONGAMENTOS:
        xml_path = item["xml"]
        nucleo = item["nucleo"]

        if not os.path.exists(xml_path):
            print(f"\n[!] XML nao encontrado: {xml_path}")
            continue

        print(f"\n>>> {nucleo}")
        pvs, trechos, ruas, meta = ler_landxml(xml_path)

        if not trechos:
            print(f"    ERRO: Nenhum trecho no XML!")
            continue

        n_ok, n_err = processar_nucleo_from_data(pvs, trechos, nucleo, OUT_DIR)
        total_ok += n_ok
        total_err += n_err

    print(f"\n{'=' * 60}")
    print(f"TOTAL: {total_ok} NS geradas, {total_err} erros")
    print(f"Pasta: {OUT_DIR}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
