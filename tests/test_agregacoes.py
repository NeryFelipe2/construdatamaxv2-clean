from datetime import date
from planejamento.agregacoes import (por_rua, material_por_equipe,
                                     acompanhamento, resumo_equipes)


def test_por_rua_agrega_e_sem_rua():
    trechos = [{"ext_m": 40, "rua": "RUA A"}, {"ext_m": 30, "rua": "RUA A"},
               {"ext_m": 10, "rua": "RUA B"}, {"ext_m": 5}]
    L = por_rua(trechos)
    ra = [x for x in L if x["rua"] == "RUA A"][0]
    assert ra["n_trechos"] == 2 and ra["comp_m"] == 70.0
    assert any(x["rua"] == "(sem rua)" for x in L)


def test_material_por_equipe_colunas_e_total():
    blocos = [{"equipe": "Robert", "trechos": [{"dn_mm": 200, "ext_m": 100, "layer": "REDE"}]},
              {"equipe": "Jesse", "trechos": [{"dn_mm": 200, "ext_m": 40, "layer": "REDE"}]}]
    cols, lins = material_por_equipe(blocos)
    assert [c["titulo"] for c in cols] == ["Material", "Robert", "Jesse", "TOTAL"]
    row = [r for r in lins if "DN200" in r["material"]][0]
    assert row["Robert"] == 100.0 and row["Jesse"] == 40.0 and row["total"] == 140.0


def test_acompanhamento_template_e_com_avanco():
    linhas = [{"trecho": 1, "sistema": "ESGOTO", "equipe": "Robert", "comp": 100.0,
               "inicio": date(2026, 6, 22), "fim": date(2026, 6, 26)}]
    t = acompanhamento(linhas)
    assert t[0]["real"] is None and t[0]["status"] == ""
    t2 = acompanhamento(linhas, avancos={1: 100.0})
    assert t2[0]["pct"] == 100.0 and t2[0]["status"] == "CONCLUÍDO"


def test_resumo_equipes():
    linhas = [{"trecho": 1, "sistema": "ESGOTO", "equipe": "Robert", "comp": 40.0,
               "inicio": date(2026, 6, 22), "fim": date(2026, 6, 23)},
              {"trecho": 2, "sistema": "ESGOTO", "equipe": "Robert", "comp": 30.0,
               "inicio": date(2026, 6, 24), "fim": date(2026, 6, 24)}]
    L = resumo_equipes(linhas)
    assert L[0]["equipe"] == "Robert" and L[0]["trechos"] == 2 and L[0]["comp"] == 70.0
    assert L[0]["inicio"] == date(2026, 6, 22) and L[0]["fim"] == date(2026, 6, 24)
    assert L[0]["dias"] == 3
