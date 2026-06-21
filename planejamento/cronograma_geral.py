"""Cronograma GERAL: consolida várias NS alocando equipes especializadas como
recurso compartilhado (uma equipe faz uma atividade por vez) + curva S.

Precedência dentro da NS: atividades em sequência. Entre NS: cada equipe
(rede, caixa, inspeção, interligação…) serializa o seu trabalho.
"""
import math
from .cronograma import PRODUTIVIDADE_PADRAO

COLUNAS_GERAL = [
    {"campo": "ns", "titulo": "NS"},
    {"campo": "atividade", "titulo": "Atividade"},
    {"campo": "equipe", "titulo": "Equipe"},
    {"campo": "qtd", "titulo": "Quant."},
    {"campo": "und", "titulo": "Und."},
    {"campo": "dur_dias", "titulo": "Dur. (dias)"},
    {"campo": "dia_ini", "titulo": "Início (dia)"},
    {"campo": "dia_fim", "titulo": "Fim (dia)"},
]


def cronograma_geral(ns_list, produtividade=None):
    """Aloca as atividades de todas as NS respeitando precedência (dentro da NS)
    e capacidade das equipes (uma atividade por equipe por vez)."""
    prod = dict(PRODUTIVIDADE_PADRAO)
    if produtividade:
        prod.update(produtividade)

    equipe_livre = {}          # equipe -> próximo dia livre
    linhas = []
    for ns in ns_list:
        dia_prec = 1           # precedência dentro da NS
        for a in ns.atividades:
            p = prod.get(a.tipo.value)
            dur = max(1, int(math.ceil(a.qtd_material / p))) if p else 1
            inicio = max(dia_prec, equipe_livre.get(a.equipe_tipo, 1))
            fim = inicio + dur - 1
            equipe_livre[a.equipe_tipo] = fim + 1
            dia_prec = fim + 1
            linhas.append({"ns": ns.ns_id, "atividade": a.tipo.value,
                           "equipe": a.equipe_tipo, "qtd": a.qtd_material,
                           "und": a.unidade, "dur_dias": dur,
                           "dia_ini": inicio, "dia_fim": fim})
    return linhas


def duracao_total_geral(linhas):
    return max((l["dia_fim"] for l in linhas), default=0)


def curva_s(linhas, peso="dur_dias"):
    """Percentual acumulado de trabalho por dia (crédito no fim de cada atividade)."""
    total = sum(l[peso] for l in linhas) or 1
    dia_max = max((l["dia_fim"] for l in linhas), default=0)
    por_dia = {}
    for l in linhas:
        por_dia[l["dia_fim"]] = por_dia.get(l["dia_fim"], 0) + l[peso]
    acum, pts = 0, []
    for d in range(1, dia_max + 1):
        acum += por_dia.get(d, 0)
        pts.append({"dia": d, "pct": round(100 * acum / total, 1)})
    return pts


def escrever_geral_xlsx(linhas, caminho, titulo="CRONOGRAMA GERAL"):
    from .planilha import escrever_planilha
    return escrever_planilha(linhas, COLUNAS_GERAL, caminho, titulo)
