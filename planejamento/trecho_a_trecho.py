"""Aba 'TRECHO A TRECHO' da planilha-mestre de planejamento (PLANEJAMENTO_*_MASTER).

Cada trecho vira uma linha agendada (sequencial por equipe), com datas reais.
Mapa de colunas = colunas reais da planilha-mestre da WCR.
"""
import math
from datetime import timedelta

# Mapa de colunas da aba TRECHO A TRECHO (extraído da planilha-mestre da WCR).
COLUNAS_TRECHO = [
    {"campo": "trecho", "titulo": "Trecho"},
    {"campo": "equipe", "titulo": "Equipe (enc.)"},
    {"campo": "lideranca", "titulo": "Liderança"},
    {"campo": "sistema", "titulo": "Sistema"},
    {"campo": "comp", "titulo": "Comp (m)"},
    {"campo": "prof", "titulo": "Prof. méd."},
    {"campo": "vala", "titulo": "Vala"},
    {"campo": "escoram", "titulo": "Escoram."},
    {"campo": "produt_min", "titulo": "Produt. mín."},
    {"campo": "inicio", "titulo": "Início"},
    {"campo": "fim", "titulo": "Fim"},
    {"campo": "cx_uma", "titulo": "Cx U.M.A"},
    {"campo": "ligacoes", "titulo": "Ligações"},
    {"campo": "cx_insp", "titulo": "Cx insp."},
]


def _proximo_util(d):
    while d.weekday() >= 5:          # 5=sáb, 6=dom
        d += timedelta(days=1)
    return d


def _fim_util(inicio, dur):
    """Data do dur-ésimo dia útil a partir de `inicio` (inclusive)."""
    d = inicio
    restantes = dur - 1
    while restantes > 0:
        d += timedelta(days=1)
        if d.weekday() < 5:
            restantes -= 1
    return d


def agendar_trechos(trechos, sistema, equipe, data_inicio, produt_min_md,
                    lideranca=None, prof_med=1.5, vala="VCA", escoram="SIM",
                    pular_fds=True):
    """Agenda os trechos em sequência (1 equipe por vez), a partir de `data_inicio`.

    produt_min_md = m/dia (pode vir por trecho em t['produt_min_md']).
    dur = ceil(comp / produt_min); datas reais. pular_fds: pula sáb/dom.
    """
    linhas = []
    dia = _proximo_util(data_inicio) if pular_fds else data_inicio
    for i, t in enumerate(trechos, 1):
        comp = round(float(t.get("ext_m") or 0.0), 1)
        pmd = t.get("produt_min_md") or produt_min_md
        dur = max(1, int(math.ceil(comp / pmd))) if pmd else 1
        ini = dia
        fim = _fim_util(ini, dur) if pular_fds else ini + timedelta(days=dur - 1)
        dia = (_proximo_util(fim + timedelta(days=1)) if pular_fds
               else fim + timedelta(days=1))
        linhas.append({
            "trecho": i, "equipe": equipe, "lideranca": lideranca or equipe,
            "sistema": sistema.upper(), "comp": comp, "prof": prof_med,
            "vala": vala, "escoram": escoram, "produt_min": "%g m/dia" % pmd,
            "inicio": ini, "fim": fim,
            "cx_uma": t.get("cx_uma", 0), "ligacoes": t.get("ligacoes", 0),
            "cx_insp": t.get("cx_insp", 0),
        })
    return linhas


def total_dias(linhas):
    if not linhas:
        return 0
    ini = min(l["inicio"] for l in linhas)
    fim = max(l["fim"] for l in linhas)
    return (fim - ini).days + 1
