"""Agregações para as demais abas da planilha-mestre:
POR RUA, MATERIAIS por equipe (cols por equipe + TOTAL), ACOMPANHAMENTO, CRONOGRAMA por equipe.
"""
from collections import defaultdict
from .materiais import _material_de

COLUNAS_POR_RUA = [
    {"campo": "rua", "titulo": "Rua"},
    {"campo": "n_trechos", "titulo": "Trechos"},
    {"campo": "comp_m", "titulo": "Comp (m)"},
]

COLUNAS_ACOMP = [
    {"campo": "trecho", "titulo": "Trecho"},
    {"campo": "sistema", "titulo": "Sistema"},
    {"campo": "equipe", "titulo": "Equipe"},
    {"campo": "comp", "titulo": "Comp plan (m)"},
    {"campo": "real", "titulo": "Comp exec (m)"},
    {"campo": "pct", "titulo": "%"},
    {"campo": "status", "titulo": "Status"},
]

COLUNAS_EQUIPE = [
    {"campo": "equipe", "titulo": "Equipe"},
    {"campo": "sistema", "titulo": "Sistema"},
    {"campo": "trechos", "titulo": "Trechos"},
    {"campo": "comp", "titulo": "Comp (m)"},
    {"campo": "inicio", "titulo": "Início"},
    {"campo": "fim", "titulo": "Fim"},
    {"campo": "dias", "titulo": "Dias"},
]


def por_rua(trechos):
    agg = defaultdict(lambda: [0, 0.0])
    for t in trechos:
        r = t.get("rua") or "(sem rua)"
        agg[r][0] += 1
        agg[r][1] += float(t.get("ext_m") or 0.0)
    return [{"rua": r, "n_trechos": n, "comp_m": round(c, 1)}
            for r, (n, c) in sorted(agg.items())]


def material_por_equipe(blocos, material_default="PVC"):
    """blocos = [{equipe, trechos}]. Retorna (colunas, linhas) com 1 coluna por
    equipe + TOTAL, no formato da aba MATERIAIS da master (Material | eq.. | TOTAL)."""
    equipes = [b["equipe"] for b in blocos]
    qtd = defaultdict(lambda: defaultdict(float))     # descricao -> {equipe: qtd}
    ordem = []
    for b in blocos:
        for t in b["trechos"]:
            dn = t.get("dn_mm")
            mat = _material_de(t, material_default)
            dim = "DN%s" % dn if dn else "s/DN"
            desc = "Tubo %s %s (m)" % (mat, dim)
            if desc not in qtd:
                ordem.append(desc)
            qtd[desc][b["equipe"]] += float(t.get("ext_m") or 0.0)

    colunas = ([{"campo": "material", "titulo": "Material"}]
               + [{"campo": e, "titulo": e} for e in equipes]
               + [{"campo": "total", "titulo": "TOTAL"}])
    linhas = []
    for desc in ordem:
        row = {"material": desc}
        tot = 0.0
        for e in equipes:
            v = round(qtd[desc].get(e, 0.0), 2)
            row[e] = v
            tot += v
        row["total"] = round(tot, 2)
        linhas.append(row)
    return colunas, linhas


def acompanhamento(linhas_trecho, avancos=None):
    """Template de acompanhamento a partir das linhas de trecho. avancos =
    {trecho: comp_executado}; sem avanço -> linha em branco p/ preencher."""
    avancos = avancos or {}
    out = []
    for l in linhas_trecho:
        real = avancos.get(l["trecho"])
        pct = round(100.0 * real / l["comp"], 1) if (real is not None and l["comp"]) else None
        if real is None:
            status = ""
        elif real >= l["comp"]:
            status = "CONCLUÍDO"
        else:
            status = "EM ANDAMENTO"
        out.append({"trecho": l["trecho"], "sistema": l["sistema"], "equipe": l["equipe"],
                    "comp": l["comp"], "real": real, "pct": pct, "status": status})
    return out


def resumo_equipes(linhas_trecho):
    agg = defaultdict(lambda: {"n": 0, "comp": 0.0, "ini": None, "fim": None, "sistema": None})
    for l in linhas_trecho:
        a = agg[l["equipe"]]
        a["n"] += 1
        a["comp"] += l["comp"]
        a["sistema"] = l["sistema"]
        a["ini"] = l["inicio"] if a["ini"] is None else min(a["ini"], l["inicio"])
        a["fim"] = l["fim"] if a["fim"] is None else max(a["fim"], l["fim"])
    out = []
    for eq, a in agg.items():
        dias = (a["fim"] - a["ini"]).days + 1 if a["ini"] else 0
        out.append({"equipe": eq, "sistema": a["sistema"], "trechos": a["n"],
                    "comp": round(a["comp"], 1), "inicio": a["ini"], "fim": a["fim"], "dias": dias})
    return out
