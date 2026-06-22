"""Geração de Notas de Serviço a partir da rede (tabela única).

NS no padrão NUM_OSE.DEF do pro_sane: número + serviço + (trecho) + núcleo.
Ex.: "NS011 REDE ESGOTO PI22 ATÉ PV11 SÃO MANOEL".
"""
from .modelo import NotaServico, Atividade, TipoServico


def _extremos(trechos, pvs):
    """Tenta nomear o trecho 'de X até Y' usando PVs com nome real (não genérico)."""
    reais = [k for k, p in pvs.items() if not p.get("_generico")]
    if len(reais) >= 2:
        return reais[0], reais[-1]
    return None, None


COLUNAS_NS = [
    {"campo": "ns", "titulo": "NS"},
    {"campo": "sistema", "titulo": "Sistema"},
    {"campo": "nucleo", "titulo": "Núcleo"},
    {"campo": "equipe", "titulo": "Equipe"},
    {"campo": "servico", "titulo": "Serviço"},
    {"campo": "rua", "titulo": "Rua"},
    {"campo": "comp", "titulo": "Comp (m)"},
    {"campo": "produt", "titulo": "Produt. mín."},
    {"campo": "inicio", "titulo": "Início"},
    {"campo": "fim", "titulo": "Fim"},
    {"campo": "status", "titulo": "Status"},
]


def gerar_notas_continuidade(trechos, sistema, equipe, data_inicio, produt_min_md,
                             nucleo="", n0=1, servico=None, feriados=None):
    """Gera Notas de Serviço de CONTINUIDADE (1 por trecho a fazer), numeradas
    (NS001, NS002…) e com datas sequenciais por equipe (pula fim de semana/feriado).
    Retorna (linhas_ns, proximo_numero) para encadear sistemas/equipes."""
    from .trecho_a_trecho import agendar_trechos
    if servico is None:
        servico = "Assentamento de rede de %s" % sistema.lower()
    agendadas = agendar_trechos(trechos, sistema, equipe, data_inicio, produt_min_md,
                                feriados=feriados)
    ns = []
    for i, l in enumerate(agendadas):
        rua = (trechos[i].get("rua") if i < len(trechos) else None) or ""
        ns.append({"ns": "NS%03d" % (n0 + i), "sistema": sistema.upper(), "nucleo": nucleo,
                   "equipe": equipe, "servico": servico, "rua": rua,
                   "comp": l["comp"], "produt": l["produt_min"],
                   "inicio": l["inicio"], "fim": l["fim"], "status": "PLANEJADO"})
    return ns, n0 + len(ns)


def gerar_ns(trechos, pvs, nucleo, ns_id, tipo="esgoto",
             setor=None, coletor=None, descricao=None):
    """Monta uma NotaServico com atividades (assentamento de tubo + caixas)."""
    ext_total = round(sum(float(t.get("ext_m") or 0.0) for t in trechos), 2)
    n_pv = len(pvs)

    if descricao is None:
        a, b = _extremos(trechos, pvs)
        trecho_txt = (" %s ATÉ %s" % (a, b)) if a and b else ""
        descricao = ("REDE %s%s" % (tipo.upper(), trecho_txt)).strip()

    ns = NotaServico(ns_id=ns_id, descricao=descricao, nucleo=nucleo,
                     setor=setor, coletor=coletor,
                     trecho_ids=list(range(len(trechos))))
    ns.atividades = [
        Atividade(TipoServico.ASSENTAMENTO_TUBO, "rede", ext_total, "m"),
        Atividade(TipoServico.CAIXA, "caixa", float(n_pv), "un"),
    ]
    return ns
