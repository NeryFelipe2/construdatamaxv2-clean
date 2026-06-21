from planejamento.modelo import NotaServico, Atividade, TipoServico
from planejamento.cronograma_geral import cronograma_geral, duracao_total_geral, curva_s


def _ns(nsid, atividades):
    ns = NotaServico(ns_id=nsid, descricao="R", nucleo="N")
    ns.atividades = atividades
    return ns


def test_equipes_serializam_entre_ns():
    ns1 = _ns("NS1", [Atividade(TipoServico.ASSENTAMENTO_TUBO, "rede", 20.0, "m"),
                      Atividade(TipoServico.CAIXA, "caixa", 2.0, "un")])
    ns2 = _ns("NS2", [Atividade(TipoServico.ASSENTAMENTO_TUBO, "rede", 40.0, "m"),
                      Atividade(TipoServico.CAIXA, "caixa", 2.0, "un")])
    L = cronograma_geral([ns1, ns2])
    by = {(l["ns"], l["atividade"]): l for l in L}

    assert by[("NS1", "assentamento_tubo")]["dia_ini"] == 1
    assert by[("NS1", "caixa")]["dia_ini"] == 2                 # após o tubo da NS1
    # a equipe 'rede' serializa: NS2 tubo só começa após NS1 tubo
    assert by[("NS2", "assentamento_tubo")]["dia_ini"] == 2
    assert by[("NS2", "assentamento_tubo")]["dia_fim"] == 3     # 40/20 = 2 dias
    assert by[("NS2", "caixa")]["dia_ini"] == 4
    assert duracao_total_geral(L) == 4


def test_curva_s_chega_a_100():
    ns1 = _ns("NS1", [Atividade(TipoServico.ASSENTAMENTO_TUBO, "rede", 20.0, "m")])
    pts = curva_s(cronograma_geral([ns1]))
    assert pts[-1]["pct"] == 100.0
