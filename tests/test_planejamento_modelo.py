from planejamento.modelo import (
    Setor, Atividade, NotaServico, TipoServico, StatusNS,
)


def test_setor_defaults_tbcp():
    s = Setor(id="BACIA_1", pop_ini=500, pop_fim=1200)
    assert s.percapta == 150.0      # L/hab.dia (default TBCP_ESG.DAT)
    assert s.k1_dia == 1.2 and s.k2_hora == 1.5 and s.coef_ret == 0.8


def test_atividade_calcula_duracao():
    a = Atividade(tipo=TipoServico.ASSENTAMENTO_TUBO, equipe_tipo="rede",
                  qtd_material=180.0, unidade="m", produtiv_prev=18.0)
    assert a.calc_duracao() == 10.0          # 180 m / 18 m/dia
    assert a.duracao_prev_dias == 10.0


def test_atividade_sem_produtividade_nao_quebra():
    a = Atividade(tipo=TipoServico.CAIXA, equipe_tipo="caixa", qtd_material=4)
    assert a.calc_duracao() is None


def test_ns_titulo_e_duracao_total():
    ns = NotaServico(ns_id="NS011", descricao="TUBO DE QUEDA PI22 ATÉ PV11",
                     nucleo="SÃO MANOEL")
    ns.atividades = [
        Atividade(TipoServico.ASSENTAMENTO_TUBO, "rede", 180.0, "m", 18.0),
        Atividade(TipoServico.CAIXA_INSPECAO, "inspecao", 2.0, "un", 4.0),
    ]
    assert ns.titulo() == "NS011 TUBO DE QUEDA PI22 ATÉ PV11 SÃO MANOEL"
    assert ns.duracao_total_dias() == 10.5     # 10.0 + 0.5
    assert ns.status == StatusNS.PLANEJADO
