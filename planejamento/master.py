"""Gerador da planilha-mestre de planejamento (PLANEJAMENTO_*_MASTER.xlsx) a
partir dos motores: trechos -> TRECHO A TRECHO (esgoto/água) + MATERIAIS.

A planilha-mestre passa a ser SAÍDA dos motores (template + mapa), e não um
arquivo solto editado à mão.
"""
from datetime import date

from .trecho_a_trecho import COLUNAS_TRECHO, agendar_trechos
from .materiais import lista_material
from .planilha import escrever_workbook, COLUNAS_MATERIAL


def gerar_master(caminho, trechos_esgoto=None, trechos_agua=None,
                 pvs_esgoto=None, pvs_agua=None,
                 equipe_esgoto="Equipe Esgoto", equipe_agua="Equipe Água",
                 data_inicio=None, produt_esgoto=23.0, produt_agua=100.0):
    """Escreve a planilha-mestre com as abas geradas pelos motores.

    Retorna {abas, saida}.
    """
    data_inicio = data_inicio or date(2026, 6, 20)
    abas = []

    if trechos_esgoto:
        le = agendar_trechos(trechos_esgoto, "ESGOTO", equipe_esgoto,
                             data_inicio, produt_esgoto)
        abas.append({"nome": "TRECHO A TRECHO ESGOTO", "colunas": COLUNAS_TRECHO,
                     "linhas": le, "titulo": "TRECHO A TRECHO — ESGOTO"})

    if trechos_agua:
        la = agendar_trechos(trechos_agua, "AGUA", equipe_agua,
                            data_inicio, produt_agua)
        abas.append({"nome": "TRECHO A TRECHO ÁGUA", "colunas": COLUNAS_TRECHO,
                     "linhas": la, "titulo": "TRECHO A TRECHO — ÁGUA"})

    todos = (trechos_esgoto or []) + (trechos_agua or [])
    pvs_all = {}
    for d in (pvs_esgoto, pvs_agua):
        if d:
            pvs_all.update(d)
    if todos:
        mat = lista_material(todos, pvs_all)
        abas.append({"nome": "MATERIAIS", "colunas": COLUNAS_MATERIAL,
                     "linhas": mat, "titulo": "MATERIAIS PREVISTOS"})

    escrever_workbook(abas, caminho)
    return {"abas": [a["nome"] for a in abas], "saida": str(caminho)}
