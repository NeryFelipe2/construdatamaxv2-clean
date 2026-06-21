"""Cronograma da NS a partir das atividades e da produtividade.

Produtividade é MANUAL/editável por enquanto (tabela padrão abaixo); o ML da
Fase 3 vai apenas preencher esses valores sozinho (por analogia + confirmação).
duração(dias) = qtd_material / produtividade. Atividades em sequência simples
(precedência: tubo -> caixa -> interligação -> pavimentação).
"""
import math

# Produtividade padrão por tipo de serviço (m/dia ou un/dia). Edite à mão.
PRODUTIVIDADE_PADRAO = {
    "assentamento_tubo": 20.0,   # m/dia
    "caixa": 2.0,                # un/dia
    "caixa_inspecao": 3.0,       # un/dia
    "interligacao": 4.0,         # un/dia
    "pavimentacao": 30.0,        # m/dia
}

# Mapa de colunas do cronograma (template + mapa, estilo DATOSE).
COLUNAS_CRONOGRAMA = [
    {"campo": "ns", "titulo": "NS"},
    {"campo": "atividade", "titulo": "Atividade"},
    {"campo": "equipe", "titulo": "Equipe"},
    {"campo": "qtd", "titulo": "Quant."},
    {"campo": "und", "titulo": "Und."},
    {"campo": "produtiv", "titulo": "Produtiv./dia"},
    {"campo": "dur_dias", "titulo": "Dur. (dias)"},
    {"campo": "dia_ini", "titulo": "Início (dia)"},
    {"campo": "dia_fim", "titulo": "Fim (dia)"},
]


def cronograma_ns(ns, produtividade=None, dia_inicio=1):
    """Calcula o cronograma (linhas por atividade) de uma NotaServico."""
    prod = dict(PRODUTIVIDADE_PADRAO)
    if produtividade:
        prod.update(produtividade)

    linhas = []
    dia = dia_inicio
    for a in ns.atividades:
        p = prod.get(a.tipo.value)
        a.produtiv_prev = p
        a.produtiv_min = p
        dur = a.calc_duracao()                       # qtd / produtividade
        dur_int = max(1, int(math.ceil(dur))) if dur else None
        if dur_int:
            ini, fim = dia, dia + dur_int - 1
            dia = fim + 1                            # próxima atividade só começa depois (precedência)
        else:
            ini = fim = dia
        linhas.append({
            "ns": ns.ns_id, "atividade": a.tipo.value, "equipe": a.equipe_tipo,
            "qtd": a.qtd_material, "und": a.unidade, "produtiv": p,
            "dur_dias": dur_int, "dia_ini": ini, "dia_fim": fim,
        })
    return linhas


def duracao_total(linhas):
    """Duração total (dias) de um conjunto de linhas de cronograma."""
    fins = [l["dia_fim"] for l in linhas if l.get("dia_fim")]
    inis = [l["dia_ini"] for l in linhas if l.get("dia_ini")]
    return (max(fins) - min(inis) + 1) if fins else 0


def escrever_cronograma_xlsx(linhas, caminho, titulo="CRONOGRAMA"):
    from .planilha import escrever_planilha
    return escrever_planilha(linhas, COLUNAS_CRONOGRAMA, caminho, titulo)
