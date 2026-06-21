"""Gerador da planilha-mestre de planejamento (PLANEJAMENTO_*_MASTER.xlsx) a
partir dos motores. Abas: CAPA, PESSOAL, ALOCACAO, PREMISSAS (config) +
TRECHO A TRECHO (esgoto/água), CRONOGRAMA, MATERIAIS (por equipe), POR RUA,
ACOMPANHAMENTO. A planilha-mestre passa a ser SAÍDA dos motores.
"""
from datetime import date

from .trecho_a_trecho import COLUNAS_TRECHO, agendar_trechos
from .planilha import escrever_workbook
from .agregacoes import (por_rua, COLUNAS_POR_RUA, material_por_equipe,
                         acompanhamento, COLUNAS_ACOMP,
                         resumo_equipes, COLUNAS_EQUIPE)
from .config_abas import abas_config
from .produtividade import produtividade_por_trecho


def gerar_master(caminho, trechos_esgoto=None, trechos_agua=None,
                 pvs_esgoto=None, pvs_agua=None,
                 equipe_esgoto="Robert", equipe_agua="Jesse",
                 data_inicio=None, produt_esgoto=23.0, produt_agua=100.0,
                 avancos=None, base_produtividade=None, cidade=None, feriados=None):
    """Escreve a planilha-mestre. base_produtividade: lista de execuções passadas
    p/ prever a produt. mín. de cada trecho por analogia. feriados: datas não úteis."""
    data_inicio = data_inicio or date(2026, 6, 20)

    if base_produtividade:
        if trechos_esgoto:
            produtividade_por_trecho(trechos_esgoto, base_produtividade, cidade)
        if trechos_agua:
            produtividade_por_trecho(trechos_agua, base_produtividade, cidade)

    equipes = []
    premissas = {"Início": data_inicio, "Vala (cenário)": "VCA"}
    if trechos_esgoto:
        equipes.append({"equipe": equipe_esgoto, "sistema": "ESGOTO"})
        premissas["Produtividade esgoto (m/dia)"] = produt_esgoto
    if trechos_agua:
        equipes.append({"equipe": equipe_agua, "sistema": "AGUA"})
        premissas["Produtividade água (m/dia)"] = produt_agua

    abas = list(abas_config(nucleo=cidade or "", equipes=equipes, premissas=premissas))

    blocos_mat = []
    linhas_trecho = []
    if trechos_esgoto:
        le = agendar_trechos(trechos_esgoto, "ESGOTO", equipe_esgoto, data_inicio,
                             produt_esgoto, feriados=feriados)
        abas.append({"nome": "TRECHO A TRECHO ESGOTO", "colunas": COLUNAS_TRECHO,
                     "linhas": le, "titulo": "TRECHO A TRECHO — ESGOTO"})
        blocos_mat.append({"equipe": equipe_esgoto, "trechos": trechos_esgoto})
        linhas_trecho += le
    if trechos_agua:
        la = agendar_trechos(trechos_agua, "AGUA", equipe_agua, data_inicio,
                            produt_agua, feriados=feriados)
        abas.append({"nome": "TRECHO A TRECHO ÁGUA", "colunas": COLUNAS_TRECHO,
                     "linhas": la, "titulo": "TRECHO A TRECHO — ÁGUA"})
        blocos_mat.append({"equipe": equipe_agua, "trechos": trechos_agua})
        linhas_trecho += la

    if linhas_trecho:
        abas.append({"nome": "CRONOGRAMA", "colunas": COLUNAS_EQUIPE,
                     "linhas": resumo_equipes(linhas_trecho), "titulo": "CRONOGRAMA POR EQUIPE"})
    if blocos_mat:
        cols, lins = material_por_equipe(blocos_mat)
        abas.append({"nome": "MATERIAIS", "colunas": cols, "linhas": lins,
                     "titulo": "MATERIAIS PREVISTOS"})
    todos = (trechos_esgoto or []) + (trechos_agua or [])
    if todos:
        abas.append({"nome": "POR RUA", "colunas": COLUNAS_POR_RUA,
                     "linhas": por_rua(todos), "titulo": "POR RUA"})
    if linhas_trecho:
        abas.append({"nome": "ACOMPANHAMENTO", "colunas": COLUNAS_ACOMP,
                     "linhas": acompanhamento(linhas_trecho, avancos), "titulo": "ACOMPANHAMENTO"})

    escrever_workbook(abas, caminho)
    return {"abas": [a["nome"] for a in abas], "saida": str(caminho)}
