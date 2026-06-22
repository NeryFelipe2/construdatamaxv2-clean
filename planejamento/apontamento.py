"""Parser do MODELO DE APONTAMENTO DIÁRIO (o template que os apontadores
preenchem no WhatsApp). Cada bloco começa em 'MODELO DE APONTAMENTO' e tem
campos rotulados (um por linha); '__' ou 'X' = vazio.

Campos:
  Núcleo, Produção - DATA, Equipe, Endereço
  — ESGOTO —  PRE (m), Prof, PV, PI, LE, Caixa de inspeção
  — ÁGUA —    PRA (m), LA, HM, Caixa U.M.A, Interligação, Corte ramal antigo,
              RA, Solda eletrofusão, Instalação de válvula
  Equipamentos utilizados, Ocorrências, Obs
"""
import re
from collections import defaultdict

CAMPOS = {
    "esgoto": [("pre_m", r"PRE\s*\(m\)"), ("prof", r"Prof"), ("pv", r"PV"),
               ("pi", r"PI"), ("le", r"LE"), ("caixa_insp", r"Caixa\s*de\s*inspe[cç][ãa]o")],
    "agua": [("pra_m", r"PRA\s*\(m\)"), ("la", r"LA"), ("hm", r"HM"),
             ("caixa_uma", r"Caixa\s*U\.?\s*M\.?\s*A"), ("interligacao", r"Interliga[çc][ãa]o"),
             ("corte_ramal", r"Corte\s*ramal\s*antigo"), ("ra", r"RA"),
             ("solda", r"Solda\s*eletrofus[ãa]o"), ("valvula", r"Instala[çc][ãa]o\s*de\s*v[áa]lvula")],
}


def _valor_linha(bloco, label_re):
    m = re.search(r"(?im)^\s*" + label_re + r"\s*[:\-]\s*(.*)$", bloco)
    return m.group(1).strip() if m else None


def _proxima_linha(bloco, label_re):
    m = re.search(r"(?im)^\s*" + label_re + r".*\r?\n+([^\n]+)", bloco)
    return m.group(1).strip() if m else None


def _num(v):
    if v is None:
        return None
    v = v.replace("_", " ").strip()
    if not v or v.upper() in ("X", "-", "—", "N/A", "NA"):
        return None
    m = re.search(r"(\d+(?:[.,]\d+)?)", v)
    return float(m.group(1).replace(",", ".")) if m else None


def parse_blocos(texto):
    """Quebra o texto em blocos de apontamento e extrai os campos do template."""
    partes = re.split(r"MODELO DE APONTAMENTO", texto, flags=re.IGNORECASE)
    blocos = []
    for p in partes[1:]:                                  # ignora o que vem antes do 1º MODELO
        data_raw = _valor_linha(p, r"(?:Produ[çc][ãa]o\s*-\s*)?DATA")
        data = None
        if data_raw:
            md = re.search(r"(\d{2})/(\d{2})/(\d{4})", data_raw)
            if md:
                data = "%s-%s-%s" % (md.group(3), md.group(2), md.group(1))
        equipe = _valor_linha(p, r"Equipe[^:]*")
        equip = _valor_linha(p, r"Equipamentos\s*utilizados")
        if not equip or set(equip) <= set("_ "):
            equip = _proxima_linha(p, r"Equipamentos\s*utilizados")
        b = {"data": data, "nucleo": _valor_linha(p, r"N[úu]cleo"),
             "equipe": equipe, "rua": _proxima_linha(p, r"Endere[çc]o"),
             "equipamentos": equip, "ocorrencias": _valor_linha(p, r"Ocorr[êe]ncias"),
             "obs": _valor_linha(p, r"Obs"), "esgoto": {}, "agua": {}}
        for sis, campos in CAMPOS.items():
            for chave, lab in campos:
                b[sis][chave] = _num(_valor_linha(p, lab))
        if data or equipe:                                # bloco minimamente válido
            blocos.append(b)
    return blocos


def resumo(blocos):
    """Soma os quantitativos executados de todos os blocos."""
    t = defaultdict(float)
    for b in blocos:
        for k, v in b["esgoto"].items():
            if v and k != "prof":
                t["esgoto_" + k] += v
        for k, v in b["agua"].items():
            if v:
                t["agua_" + k] += v
    return {k: round(v, 1) for k, v in t.items()}


def nucleo_norm(n):
    if not n:
        return "?"
    u = n.upper()
    if "BOI" in u:
        return "BOI MALHADO"
    if "CLETO" in u:
        return "SÃO CLETO"
    return n.strip()


def resumo_por_nucleo(blocos):
    """{nucleo: resumo(blocos do nucleo)}."""
    grupos = defaultdict(list)
    for b in blocos:
        grupos[nucleo_norm(b.get("nucleo"))].append(b)
    return {nuc: resumo(bs) for nuc, bs in grupos.items()}


def por_dia(blocos, nucleo=None):
    """Linhas de diário (1 por bloco): data, equipe, rua e quantidades-chave."""
    out = []
    for b in blocos:
        if nucleo and nucleo_norm(b.get("nucleo")) != nucleo:
            continue
        esg, ag = b["esgoto"], b["agua"]
        out.append({
            "data": b.get("data"), "nucleo": nucleo_norm(b.get("nucleo")),
            "equipe": b.get("equipe"), "rua": b.get("rua"),
            "pre_m": esg.get("pre_m"), "le": esg.get("le"),
            "cx_insp": esg.get("caixa_insp"), "pv": esg.get("pv"),
            "pra_m": ag.get("pra_m"), "la": ag.get("la"), "ra": ag.get("ra"),
            "cx_uma": ag.get("caixa_uma"), "hm": ag.get("hm"),
            "ocorrencias": b.get("ocorrencias"), "obs": b.get("obs"),
        })
    out.sort(key=lambda r: (r["data"] or "", r["equipe"] or ""))
    return out
