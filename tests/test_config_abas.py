from planejamento.config_abas import abas_config


def test_abas_config_gera_quatro_abas():
    abas = abas_config(nucleo="BOI MALHADO",
                       equipes=[{"equipe": "Robert", "sistema": "ESGOTO"}],
                       premissas={"Produtividade esgoto (m/dia)": 23.0})
    assert [a["nome"] for a in abas] == ["CAPA", "PESSOAL", "ALOCACAO", "PREMISSAS"]

    capa = [a for a in abas if a["nome"] == "CAPA"][0]
    assert any(l.get("v") == "BOI MALHADO" for l in capa["linhas"])

    pes = [a for a in abas if a["nome"] == "PESSOAL"][0]
    assert pes["linhas"][0]["equipe"] == "Robert"

    pre = [a for a in abas if a["nome"] == "PREMISSAS"][0]
    assert any(l["k"] == "Produtividade esgoto (m/dia)" and l["v"] == 23.0
               for l in pre["linhas"])
