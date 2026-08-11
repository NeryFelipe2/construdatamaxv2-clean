# -*- coding: utf-8 -*-
"""Parser do MODELO DE APONTAMENTO DIÁRIO (WhatsApp) -> dicts estruturados.
Felipe cola um ou vários apontamentos; isto vira o RDO por equipe + a marcação
do executado (rede/caixa) com equipe na tabela de atributos.
"""
import re

_HEADER = re.compile(r"(?:MODELO DE )?APONTAMENTO DI[ÁA]RIO", re.IGNORECASE)
_FUNC = re.compile(r"^\s*(.+?)\s*[-–—]\s*([A-Za-zÀ-ú/ ]+?)\s*$")
_DATA = re.compile(r"DATA\s*:?\s*(\d{1,2}/\d{1,2}/\d{2,4})", re.IGNORECASE)


def parse_modelo(texto):
    """Quebra em blocos (1 por apontamento) e parseia cada um. Retorna lista."""
    partes = _HEADER.split(texto)
    blocos = [p for p in partes if p.strip() and len(p.strip()) > 40]
    return [_parse_um(b) for b in blocos]


def _num(bloco, label):
    """Extrai inteiro de 'label: n' ('__','x','' = None)."""
    m = re.search(re.escape(label) + r"\s*:?\s*([0-9]+)", bloco, re.IGNORECASE)
    return int(m.group(1)) if m else None


def _campo(bloco, label):
    m = re.search(re.escape(label) + r"\s*:?\s*(.+)", bloco, re.IGNORECASE)
    if not m:
        return ""
    v = m.group(1).strip()
    return "" if v in ("______", "__", "x", "X", "") else v


def _parse_um(bloco):
    linhas = [l.rstrip() for l in bloco.splitlines()]
    d = {"data": "", "equipe": "", "presenca": [], "rua": "", "casas": [],
         "esgoto": {}, "agua": {}, "equipamentos": "", "ocorrencias": "", "obs": ""}

    md = _DATA.search(bloco)
    if md:
        d["data"] = md.group(1)

    # equipe: "Equipe (toda c/ função): X" ou "Presença Equipe X"
    me = re.search(r"Equipe\s*\(toda.*?\)\s*:?\s*(.+)", bloco, re.IGNORECASE)
    if me and me.group(1).strip() not in ("______", ""):
        d["equipe"] = me.group(1).strip()
    mp = re.search(r"Presen[çc]a\s+Equipe\s+(.+)", bloco, re.IGNORECASE)
    if mp and not d["equipe"]:
        d["equipe"] = mp.group(1).strip()

    # presença: linhas "Nome - Função" (entre cabeçalho de equipe e 'Endereço')
    dentro = False
    for l in linhas:
        L = l.strip()
        if re.search(r"Equipe|Presen[çc]a", L, re.IGNORECASE):
            dentro = True; continue
        if re.search(r"Endere[çc]o", L, re.IGNORECASE):
            dentro = False
        m = _FUNC.match(L)
        if dentro and m and not re.search(r"DATA|Equipe|m\)", m.group(1)):
            nome, func = m.group(1).strip(), m.group(2).strip()
            if 2 < len(nome) < 40 and not nome.isupper():
                d["presenca"].append((nome, func))

    # endereço: rua + casas (após 'Endereço')
    try:
        i = next(k for k, l in enumerate(linhas) if re.search(r"Endere[çc]o", l, re.IGNORECASE))
    except StopIteration:
        i = -1
    if i >= 0:
        for l in linhas[i + 1:]:
            L = l.strip()
            if re.search(r"^—|ESGOTO|ÁGUA|AGUA", L):
                break
            if not L:
                continue
            mr = re.match(r"RUA\s*:?\s*(.+)", L, re.IGNORECASE)
            if mr and not d["rua"]:
                d["rua"] = mr.group(1).strip()
            elif re.search(r"[A-Za-zÀ-ú]{3}", L) and not d["rua"] and "casa" not in L.lower():
                d["rua"] = L
            else:
                for tok in re.findall(r"\d+\s*[A-Za-z]?", L):
                    if tok.strip():
                        d["casas"].append(tok.strip())

    # esgoto / água
    for k, lbl in [("PRE", "PRE"), ("PV", "PV"), ("PI", "PI"), ("LE", "LE"),
                   ("CX_INSP", "Caixa de inspeção")]:
        v = _num(bloco, lbl)
        if v:
            d["esgoto"][k] = v
    for k, lbl in [("PRA", "PRA"), ("LA", "LA"), ("HM", "HM"), ("UMA", "Caixa U.M.A"),
                   ("RA", "RA"), ("SOLDA", "Solda")]:
        v = _num(bloco, lbl)
        if v:
            d["agua"][k] = v

    d["equipamentos"] = _campo(bloco, "Equipamentos utilizados")
    d["ocorrencias"] = _campo(bloco, "Ocorrências")
    d["obs"] = _campo(bloco, "Obs")
    return d
