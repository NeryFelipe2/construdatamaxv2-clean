"""Produtividade por ANALOGIA (Fase 3): acha a execução mais parecida numa base
(RDOs/consolidado) e sugere a produtividade — para o usuário CONFIRMAR.

Base vazia -> cai no padrão. Não é caixa-preta: devolve a referência usada e
pede confirmação. O ML "de verdade" é alimentar essa base com execução real
(ver rdo.registro_base) — o método de retrieval já é este.
"""
from .cronograma import PRODUTIVIDADE_PADRAO


def _distancia(contexto, registro):
    """Menor = mais parecido. DN por diferença relativa; cidade/solo dão bônus."""
    s = 0.0
    dn_c, dn_r = contexto.get("dn"), registro.get("dn")
    if dn_c and dn_r:
        s += abs(dn_c - dn_r) / max(dn_c, dn_r)
    else:
        s += 0.5
    if contexto.get("cidade") and registro.get("cidade") == contexto.get("cidade"):
        s -= 0.3
    if contexto.get("solo") and registro.get("solo") == contexto.get("solo"):
        s -= 0.2
    return s


def prever_produtividade(contexto, base):
    """Devolve {produtividade, fonte, referencia, confianca, confirmar}.

    contexto/registros: dicts com tipo_servico, dn, cidade, solo, produtividade.
    """
    ts = contexto.get("tipo_servico")
    cands = [r for r in (base or []) if r.get("tipo_servico") == ts and r.get("produtividade")]
    if not cands:
        return {"produtividade": PRODUTIVIDADE_PADRAO.get(ts), "fonte": "padrao",
                "referencia": None, "confianca": 0.0, "confirmar": True}

    melhor = min(cands, key=lambda r: _distancia(contexto, r))
    d = max(_distancia(contexto, melhor), 0.0)
    return {"produtividade": melhor["produtividade"], "fonte": "analogia",
            "referencia": melhor, "confianca": round(1.0 / (1.0 + d), 2),
            "confirmar": True}
