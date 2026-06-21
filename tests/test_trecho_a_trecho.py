from datetime import date, timedelta
from planejamento.trecho_a_trecho import agendar_trechos, total_dias


def _proxima(dia_semana, base=date(2026, 6, 1)):
    d = base
    while d.weekday() != dia_semana:
        d += timedelta(days=1)
    return d


def test_agenda_sequencial_em_dias_uteis():
    seg = _proxima(0)                                   # uma segunda-feira
    trechos = [{"ext_m": 92.0}, {"ext_m": 46.0}]
    L = agendar_trechos(trechos, "AGUA", "Jesse", seg, produt_min_md=92.0)
    assert L[0]["inicio"] == seg and L[0]["fim"] == seg          # 92/92 = 1 dia
    assert L[0]["comp"] == 92.0 and L[0]["sistema"] == "AGUA" and L[0]["equipe"] == "Jesse"
    assert L[0]["produt_min"] == "92 m/dia"
    assert L[1]["inicio"] == seg + timedelta(days=1)            # terça (próximo útil)
    assert total_dias(L) == 2


def test_pula_fim_de_semana():
    sexta = _proxima(4)                                 # uma sexta-feira
    trechos = [{"ext_m": 40.0}]                         # 40/20 = 2 dias úteis
    L = agendar_trechos(trechos, "ESGOTO", "Robert", sexta, produt_min_md=20.0)
    assert L[0]["inicio"] == sexta
    assert L[0]["fim"] == sexta + timedelta(days=3)     # sexta -> segunda (pula sáb/dom)


def test_produt_min_por_trecho_sobrepoe_default():
    seg = _proxima(0)
    trechos = [{"ext_m": 100.0, "produt_min_md": 50.0}]
    L = agendar_trechos(trechos, "ESGOTO", "Robert", seg, produt_min_md=20.0)
    assert L[0]["fim"] == seg + timedelta(days=1)       # 100/50 = 2 dias úteis (seg, ter)
    assert L[0]["produt_min"] == "50 m/dia"
