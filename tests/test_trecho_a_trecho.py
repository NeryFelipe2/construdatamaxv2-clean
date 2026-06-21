from datetime import date
from planejamento.trecho_a_trecho import agendar_trechos, total_dias


def test_agenda_sequencial_com_datas():
    trechos = [{"ext_m": 92.0}, {"ext_m": 46.0}]
    L = agendar_trechos(trechos, "AGUA", "Jesse", date(2026, 6, 23), produt_min_md=92.0)
    assert L[0]["inicio"] == date(2026, 6, 23) and L[0]["fim"] == date(2026, 6, 23)  # 92/92=1
    assert L[0]["comp"] == 92.0 and L[0]["sistema"] == "AGUA" and L[0]["equipe"] == "Jesse"
    assert L[0]["produt_min"] == "92 m/dia"
    assert L[1]["inicio"] == date(2026, 6, 24)                # começa no dia seguinte
    assert total_dias(L) == 2


def test_produt_min_por_trecho_sobrepoe_default():
    trechos = [{"ext_m": 100.0, "produt_min_md": 50.0}]
    L = agendar_trechos(trechos, "ESGOTO", "Robert", date(2026, 6, 20), produt_min_md=20.0)
    assert L[0]["fim"] == date(2026, 6, 21)                   # 100/50 = 2 dias
    assert L[0]["produt_min"] == "50 m/dia"
