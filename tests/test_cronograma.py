from planejamento.modelo import NotaServico, Atividade, TipoServico
from planejamento.cronograma import cronograma_ns, duracao_total


def _ns(atividades):
    ns = NotaServico(ns_id="NS001", descricao="REDE", nucleo="NUC")
    ns.atividades = atividades
    return ns


def test_cronograma_sequencial_com_padrao():
    ns = _ns([
        Atividade(TipoServico.ASSENTAMENTO_TUBO, "rede", 160.0, "m"),   # 160/20 = 8 dias
        Atividade(TipoServico.CAIXA, "caixa", 24.0, "un"),             # 24/2  = 12 dias
    ])
    linhas = cronograma_ns(ns)
    assert linhas[0]["dur_dias"] == 8
    assert linhas[0]["dia_ini"] == 1 and linhas[0]["dia_fim"] == 8
    assert linhas[1]["dur_dias"] == 12
    assert linhas[1]["dia_ini"] == 9 and linhas[1]["dia_fim"] == 20   # começa após o tubo
    assert duracao_total(linhas) == 20


def test_produtividade_manual_sobrepoe_padrao():
    ns = _ns([Atividade(TipoServico.ASSENTAMENTO_TUBO, "rede", 100.0, "m")])
    linhas = cronograma_ns(ns, produtividade={"assentamento_tubo": 50.0})  # 100/50 = 2
    assert linhas[0]["dur_dias"] == 2
    assert ns.atividades[0].produtiv_prev == 50.0
    assert ns.atividades[0].produtiv_min == 50.0
