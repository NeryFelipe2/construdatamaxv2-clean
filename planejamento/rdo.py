"""RDO / ciclo diário (Fase 4): registra o avanço executado, compara com o
planejado (planejado⟷realizado) e gera o registro de produtividade REAL que
realimenta a base do produtividade.prever_produtividade.
"""


def aplicar_rdo(ns, avancos):
    """avancos: {tipo_servico: avanço_acumulado}. Grava em atividade.avanco_real."""
    for a in ns.atividades:
        if a.tipo.value in avancos:
            a.avanco_real = float(avancos[a.tipo.value])


def comparar_ns(ns, dia_corrente):
    """Planejado-até-o-dia (produtiv_prev × dia, limitado à qtd) × realizado."""
    linhas = []
    for a in ns.atividades:
        p = a.produtiv_prev or 0.0
        planejado = min(a.qtd_material, p * dia_corrente) if p else 0.0
        real = a.avanco_real
        desvio = real - planejado
        pct = round(100.0 * real / a.qtd_material, 1) if a.qtd_material else 0.0
        if desvio < -1e-9:
            status = "ATRASADO"
        elif desvio > 1e-9:
            status = "ADIANTADO"
        else:
            status = "NO PRAZO"
        linhas.append({"atividade": a.tipo.value, "equipe": a.equipe_tipo,
                       "planejado": round(planejado, 2), "realizado": round(real, 2),
                       "desvio": round(desvio, 2), "pct": pct, "status": status})
    return linhas


def produtividade_realizada(avanco, dias):
    return round(avanco / dias, 2) if dias and dias > 0 else None


def registro_base(ns, atividade, dias, dn=None, cidade=None, solo=None):
    """Constrói um registro p/ a base de produtividade (realimenta a Fase 3)."""
    return {"tipo_servico": atividade.tipo.value, "dn": dn,
            "cidade": cidade or ns.nucleo, "solo": solo,
            "produtividade": produtividade_realizada(atividade.avanco_real, dias)}
