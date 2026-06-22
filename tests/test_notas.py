from planejamento.notas import gerar_ns
from planejamento.modelo import TipoServico, StatusNS


def test_gera_ns_com_atividades():
    trechos = [{"ext_m": 40.0}, {"ext_m": 30.0}]
    pvs = {"PV_1": {"_generico": True}, "PV_2": {"_generico": True}, "PV_3": {"_generico": True}}
    ns = gerar_ns(trechos, pvs, nucleo="BOI MALHADO", ns_id="NS001", tipo="esgoto")

    assert ns.ns_id == "NS001" and ns.nucleo == "BOI MALHADO"
    assert ns.status == StatusNS.PLANEJADO

    tubo = [a for a in ns.atividades if a.tipo == TipoServico.ASSENTAMENTO_TUBO][0]
    assert tubo.qtd_material == 70.0 and tubo.unidade == "m"
    caixa = [a for a in ns.atividades if a.tipo == TipoServico.CAIXA][0]
    assert caixa.qtd_material == 3.0
    assert "BOI MALHADO" in ns.titulo()


def test_titulo_usa_pvs_reais():
    trechos = [{"ext_m": 10.0}]
    pvs = {"PI22": {}, "PV11": {}}                          # reais (sem _generico)
    ns = gerar_ns(trechos, pvs, nucleo="SAO MANOEL", ns_id="NS011", tipo="esgoto")
    assert "PI22" in ns.descricao and "PV11" in ns.descricao


def test_gerar_notas_continuidade():
    from datetime import date, timedelta
    from planejamento.notas import gerar_notas_continuidade
    seg = date(2026, 6, 1)
    while seg.weekday() != 0:                       # acha uma segunda
        seg += timedelta(days=1)
    trechos = [{"ext_m": 50.0, "rua": "Rua 2"}, {"ext_m": 25.0}]
    ns, prox = gerar_notas_continuidade(trechos, "ESGOTO", "Robert", seg,
                                        produt_min_md=25.0, nucleo="BOI MALHADO", n0=1)
    assert [x["ns"] for x in ns] == ["NS001", "NS002"]
    assert ns[0]["inicio"] == seg and ns[0]["rua"] == "Rua 2"  # 50/25 = 2 dias
    assert ns[0]["fim"] == seg + timedelta(days=1)
    assert ns[1]["inicio"] == seg + timedelta(days=2)          # continua
    assert prox == 3                                           # próximo número
