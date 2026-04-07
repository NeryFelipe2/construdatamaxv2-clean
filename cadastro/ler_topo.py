"""
Leitor de levantamento de campo do topografo.
Suporta:
  - ASCII CSV (.txt/.csv): id,N,E,Z,codigo,descricao
  - Leica GSI 8 (.gsi):    *11=ponto, *81=E, *82=N, *83=Z
"""
from pathlib import Path


# Mapa de codigos descoberto cruzando LEV.txt (Sao Manoel) x GSI (Pantanal Baixo).
# WI 41 do GSI carrega o mesmo numero da coluna codigo do LEV.txt.
_CODIGO_TIPO = {
    "86": "PV",         # PVE - poco de visita esgoto
    "48": "GERATRIZ",   # geratriz inferior (fundo do tubo)
    "49": "GERATRIZ",   # geratriz superior
    "91": "RAMAL",      # registro de agua
    "37": "CART",       # divisa de terreno
    "38": "CART",       # pavimento/calcada
    "79": "CART",       # poste
    "80": "CART",       # poste ferro
}

# Marcadores estruturais da poligonal (WI 41 alfa)
_MARCADORES_POLIGONAL = {"OCUPAR", "RE", "V", "VANTE"}


def _classifica(codigo: str, desc: str) -> str:
    cod = (codigo or "").strip().upper()
    if cod in _MARCADORES_POLIGONAL:
        return "POLIGONAL"
    if cod in _CODIGO_TIPO:
        return _CODIGO_TIPO[cod]
    s = f"{cod} {desc}".upper()
    if any(k in s for k in ("PVE", "POCO", "POÇO", " PV", "PV ", "MH", "MANHOLE")):
        return "PV"
    if any(k in s for k in ("GERAT", "FUNDO", "INVERT")):
        return "GERATRIZ"
    if any(k in s for k in ("RG", "REG", "RAMAL", "LIG", "CX ", "CAIXA")):
        return "RAMAL"
    return "CART"


def _ler_csv(path: Path) -> list:
    pts = []
    with open(path, "r", encoding="latin-1", errors="replace") as f:
        for ln in f:
            ln = ln.strip()
            if not ln or ln.startswith("#"):
                continue
            parts = [p.strip() for p in ln.replace(";", ",").split(",")]
            if len(parts) < 4:
                continue
            try:
                pid = parts[0]
                n = float(parts[1])
                e = float(parts[2])
                z = float(parts[3])
            except ValueError:
                continue
            cod = parts[4] if len(parts) > 4 else ""
            desc = parts[5] if len(parts) > 5 else ""
            pts.append({
                "id": pid, "n": n, "e": e, "z": z,
                "codigo": cod, "desc": desc, "tipo": _classifica(cod, desc),
            })
    return pts


def _gsi_word(token: str) -> tuple:
    # GSI: WIaaaa[+/-]VVVVVVVVVVVVVVVV  (apenas o 1o token de cada linha leva '*')
    if not token:
        return None, None
    if token.startswith("*"):
        token = token[1:]
    # acha posicao do sinal apos o cabecalho de 6 chars (WI + 4 info)
    if len(token) < 8:
        return None, None
    head = token[:6]
    rest = token[6:]
    if rest and rest[0] in "+-":
        sign = 1 if rest[0] == "+" else -1
        val = rest[1:]
    else:
        return None, None
    try:
        wi = int(head[:2])
    except ValueError:
        return None, None
    try:
        v = sign * int(val.lstrip("0") or "0")
    except ValueError:
        v = val.lstrip("0") or val  # WI 11 (id) pode ser alfanumerico
    return wi, v


def _ler_gsi(path: Path) -> list:
    """
    Le GSI 8/16. Codigo (WI 41/42) costuma vir em LINHA SEPARADA antes
    da linha com coordenadas (WI 11/81/82/83). Mantemos um codigo 'pendente'
    entre linhas e atribuimos ao proximo ponto medido.
    """
    pts = []
    pend_cod = ""
    pend_sub = ""
    with open(path, "r", encoding="latin-1", errors="replace") as f:
        for ln in f:
            tokens = ln.strip().split()
            if not tokens:
                continue
            rec = {}
            for tk in tokens:
                wi, v = _gsi_word(tk)
                if wi is None:
                    continue
                rec[wi] = v
            if 41 in rec:
                pend_cod = str(rec[41])
            if 42 in rec:
                pend_sub = str(rec[42])
            if 11 not in rec:
                continue
            scale = 1e-3  # GSI: distancias em mm
            e = rec.get(81, 0) * scale
            n = rec.get(82, 0) * scale
            z = rec.get(83, 0) * scale
            cod = pend_cod or str(rec.get(71, ""))
            pts.append({
                "id": str(rec[11]), "n": n, "e": e, "z": z,
                "codigo": cod, "desc": pend_sub,
                "tipo": _classifica(cod, pend_sub),
            })
            pend_cod = ""
            pend_sub = ""
    return pts


def ler_topo(path: str) -> list:
    """Le levantamento de campo. Retorna lista de dicts {id,n,e,z,codigo,desc,tipo}."""
    p = Path(path)
    if not p.exists():
        return []
    name = p.name.lower()
    if ".gsi" in name or p.suffix.lower() == ".gsi":
        return _ler_gsi(p)
    # sniff conteudo: GSI comeca com '*' e tem padrao WI++/--
    try:
        with open(p, "r", encoding="latin-1", errors="replace") as f:
            head = f.readline()
        if head.startswith("*") and ("+0000" in head or "-0000" in head):
            return _ler_gsi(p)
    except Exception:
        pass
    return _ler_csv(p)
