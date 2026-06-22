"""Pré-medição: quantitativos do que foi EXECUTADO, por trecho/sistema/equipe.

Calcula, a partir do comprimento real de cada trecho executado, os volumes de
serviço (tubo, escavação, reaterro, lastro, brita, pavimentação) pelas regras
do pro_sane (largura de vala, lastro/brita 0,15 m). É a base de medição/BM.
"""
from collections import defaultdict

LARGURA_VALA = 0.60   # m (LST_VALA.DEF)
LASTRO = 0.15         # m
BRITA = 0.15          # m
PROF_PADRAO = {"ESGOTO": 1.5, "AGUA": 0.8}

COLUNAS_MEDICAO = [
    {"campo": "trecho", "titulo": "Trecho"},
    {"campo": "sistema", "titulo": "Sistema"},
    {"campo": "equipe", "titulo": "Equipe"},
    {"campo": "comp_m", "titulo": "Comp (m)"},
    {"campo": "tubo_m", "titulo": "Tubo (m)"},
    {"campo": "escav_m3", "titulo": "Escavação (m³)"},
    {"campo": "reaterro_m3", "titulo": "Reaterro (m³)"},
    {"campo": "lastro_m3", "titulo": "Lastro (m³)"},
    {"campo": "brita_m3", "titulo": "Brita (m³)"},
    {"campo": "pav_m2", "titulo": "Pavimentação (m²)"},
]

_TOTAIS = ["comp_m", "tubo_m", "escav_m3", "reaterro_m3", "lastro_m3", "brita_m3", "pav_m2"]


def medir_trecho(comp_m, prof_med=1.5, largura=LARGURA_VALA, dn_mm=None):
    if dn_mm:
        largura = max(largura, dn_mm / 1000.0 + 0.50)
    escav = comp_m * largura * prof_med
    lastro = comp_m * largura * LASTRO
    brita = comp_m * largura * BRITA
    pav = comp_m * largura
    reaterro = max(0.0, escav - lastro - brita)            # escavação menos lastro/berço
    return {"comp_m": round(comp_m, 2), "tubo_m": round(comp_m, 2),
            "escav_m3": round(escav, 2), "reaterro_m3": round(reaterro, 2),
            "lastro_m3": round(lastro, 2), "brita_m3": round(brita, 2),
            "pav_m2": round(pav, 2)}


def pre_medicao(trechos):
    """trechos = [{ext_m, sistema?, equipe?, prof_med?, dn_mm?}] -> linhas de medição."""
    linhas = []
    for i, t in enumerate(trechos, 1):
        sistema = (t.get("sistema") or "").upper()
        prof = t.get("prof_med") or PROF_PADRAO.get(sistema, 1.5)
        q = medir_trecho(float(t.get("ext_m") or 0.0), prof_med=prof, dn_mm=t.get("dn_mm"))
        linhas.append({"trecho": i, "sistema": sistema,
                       "equipe": t.get("equipe") or "", **q})
    return linhas


def resumo_medicao(linhas):
    tot = defaultdict(float)
    for l in linhas:
        for k in _TOTAIS:
            tot[k] += l[k]
    return {k: round(v, 2) for k, v in tot.items()}


# Mapa: chave do resumo do apontamento -> (rótulo de medição, unidade)
_MAP_SERVICOS = [
    ("agua_la", "Ligações de água (LA)", "un"),
    ("agua_ra", "Ramais de água (RA)", "un"),
    ("agua_caixa_uma", "Caixas U.M.A", "un"),
    ("agua_hm", "Hidrômetros (HM)", "un"),
    ("agua_interligacao", "Interligações de água", "un"),
    ("agua_solda", "Solda eletrofusão", "un"),
    ("esgoto_le", "Ligações de esgoto (LE)", "un"),
    ("esgoto_caixa_insp", "Caixas de inspeção", "un"),
    ("esgoto_pv", "Poços de visita (PV)", "un"),
    ("esgoto_pi", "Poços de inspeção (PI)", "un"),
]


def servicos_de_apontamento(resumo_apont):
    """Converte o resumo do apontamento (ligações, ramais, caixas, PV — que o
    GeoPackage não tem) em linhas de medição {item, qtd, und}."""
    return [{"item": rot, "qtd": resumo_apont[k], "und": u}
            for k, rot, u in _MAP_SERVICOS if resumo_apont.get(k)]


def resumo_por_equipe(linhas):
    agg = defaultdict(lambda: defaultdict(float))
    for l in linhas:
        chave = (l["sistema"], l["equipe"])
        for k in _TOTAIS:
            agg[chave][k] += l[k]
    out = []
    for (sis, eq), v in agg.items():
        row = {"trecho": "", "sistema": sis, "equipe": eq}
        row.update({k: round(v[k], 2) for k in _TOTAIS})
        out.append(row)
    return out
