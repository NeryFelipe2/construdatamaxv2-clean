"""Diário de Obra (RDO) a partir do apontamento estruturado por dia.

Entrada: lista de dias [{data, servicos:[{servico,sistema,local,quantidade,equipe}],
equipes, equipamentos, ocorrencias}]. Produz as linhas do diário e um RESUMO de
quantidades executadas (parse das siglas do campo: LE, LA, RA, PV, caixas U.M.A,
caixas de inspeção, metros de rede de água/esgoto).
"""
import re
from collections import defaultdict

COLUNAS_DIARIO = [
    {"campo": "data", "titulo": "Data"},
    {"campo": "sistema", "titulo": "Sistema"},
    {"campo": "servico", "titulo": "Serviço"},
    {"campo": "local", "titulo": "Local"},
    {"campo": "quantidade", "titulo": "Quantidade"},
    {"campo": "equipe", "titulo": "Equipe"},
]

COLUNAS_RESUMO = [
    {"campo": "item", "titulo": "Item executado"},
    {"campo": "qtd", "titulo": "Quantidade"},
    {"campo": "und", "titulo": "Und."},
]

# (chave, regex, rótulo, unidade). Metros só contam com palavra de rede.
_LABELS = [
    ("LE", r"\bLE\b\s*[:\-]?\s*(\d+)|(\d+)\s*LE\b", "Ligações de esgoto", "un"),
    ("LA", r"\bLA\b\s*[:\-]?\s*(\d+)|(\d+)\s*liga[cç][õo]es?\s*de\s*[áa]gua", "Ligações de água", "un"),
    ("RA", r"\bRA\b\s*[:\-]?\s*(\d+)", "Ramais de água (RA)", "un"),
    ("PV", r"\bPV\b\s*[:\-]?\s*(\d+)", "Poços de visita (PV)", "un"),
    ("CXUMA", r"caixa[s]?\s*u\.?\s*m\.?\s*a\.?\s*[:\-]?\s*(\d+)|(\d+)\s*caixa[s]?\s*u\.?\s*m\.?\s*a", "Caixas U.M.A", "un"),
    ("CXINSP", r"caixa[s]?\s*de\s*inspe[cç][ãa]o\s*[:\-]?\s*(\d+)|(\d+)\s*caixa[s]?\s*de\s*inspe", "Caixas de inspeção", "un"),
    ("REDE_AGUA", r"\bPRA\b\s*[:\-]?\s*(\d+)|(\d+)\s*m(?:trs|ts|etros)?\s*(?:de\s*)?(?:pad|pead|rede\s*de\s*[áa]gua|rede\s*[áa]gua)", "Rede de água", "m"),
    ("REDE_ESG", r"\bPRE\b\s*[:\-]?\s*(\d+)|(\d+)\s*m(?:trs|ts|etros)?\s*(?:de\s*)?(?:rede\s*de\s*esgoto|remanejamento)", "Rede de esgoto", "m"),
]


def linhas_diario(dias):
    out = []
    for d in dias:
        for s in d.get("servicos", []):
            out.append({"data": d.get("data"), "sistema": s.get("sistema", ""),
                        "servico": s.get("servico", ""), "local": s.get("local", ""),
                        "quantidade": s.get("quantidade", ""), "equipe": s.get("equipe", "")})
    return out


def _soma_label(texto, regex):
    total = 0
    achou = False
    for m in re.finditer(regex, texto, flags=re.IGNORECASE):
        g = next((x for x in m.groups() if x), None)
        if g:
            total += int(g)
            achou = True
    return total if achou else None


def resumo_quantidades(dias):
    tot = defaultdict(float)
    rotulos, unidades = {}, {}
    for d in dias:
        for s in d.get("servicos", []):
            texto = " ".join(str(s.get(k, "")) for k in ("servico", "quantidade", "local"))
            for chave, regex, rotulo, und in _LABELS:
                v = _soma_label(texto, regex)
                if v:
                    tot[chave] += v
                    rotulos[chave] = rotulo
                    unidades[chave] = und
    return [{"item": rotulos[k], "qtd": round(tot[k], 1), "und": unidades[k]}
            for k, _r, _l, _u in _LABELS if k in tot]


def gerar_diario(dias, caminho, titulo="DIÁRIO DE OBRA"):
    """Escreve o RDO em .xlsx: abas DIÁRIO (serviços) e RESUMO (quantidades)."""
    from .planilha import escrever_workbook
    abas = [
        {"nome": "DIÁRIO", "colunas": COLUNAS_DIARIO, "linhas": linhas_diario(dias), "titulo": titulo},
        {"nome": "RESUMO", "colunas": COLUNAS_RESUMO, "linhas": resumo_quantidades(dias),
         "titulo": "RESUMO DE QUANTIDADES EXECUTADAS"},
    ]
    escrever_workbook(abas, caminho)
    return {"abas": [a["nome"] for a in abas], "saida": str(caminho),
            "dias": len(dias), "servicos": sum(len(d.get("servicos", [])) for d in dias)}
