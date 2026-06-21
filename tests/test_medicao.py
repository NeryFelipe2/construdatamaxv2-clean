from planejamento.medicao import (medir_trecho, pre_medicao,
                                  resumo_medicao, resumo_por_equipe)


def test_medir_trecho_quantitativos():
    q = medir_trecho(100.0, prof_med=1.5)          # largura 0.60
    assert q["comp_m"] == 100.0 and q["tubo_m"] == 100.0
    assert q["escav_m3"] == 90.0                    # 100*0.6*1.5
    assert q["lastro_m3"] == 9.0                    # 100*0.6*0.15
    assert q["brita_m3"] == 9.0
    assert q["pav_m2"] == 60.0                      # 100*0.6
    assert q["reaterro_m3"] == 72.0                 # 90-9-9


def test_pre_medicao_e_resumos():
    trechos = [{"ext_m": 100.0, "sistema": "ESGOTO", "equipe": "Robert"},
               {"ext_m": 50.0, "sistema": "ESGOTO", "equipe": "Robert"}]
    L = pre_medicao(trechos)
    assert len(L) == 2 and L[0]["sistema"] == "ESGOTO"
    r = resumo_medicao(L)
    assert r["comp_m"] == 150.0
    pe = resumo_por_equipe(L)
    assert len(pe) == 1 and pe[0]["equipe"] == "Robert" and pe[0]["comp_m"] == 150.0


def test_prof_padrao_por_sistema():
    L = pre_medicao([{"ext_m": 100.0, "sistema": "AGUA"}])   # água -> prof 0.8
    assert L[0]["escav_m3"] == 48.0                          # 100*0.6*0.8
