from planejamento.diario import linhas_diario, resumo_quantidades


def _dias():
    return [
        {"data": "2026-06-13", "servicos": [
            {"servico": "prolongamento PAD 63 e ligacoes", "sistema": "agua", "local": "Rua 2",
             "quantidade": "80 mtrs de PAD de 63; 10 ligacoes de agua", "equipe": "Renan"},
            {"servico": "caixas U.M.A", "sistema": "agua", "local": "rua 03",
             "quantidade": "Caixa U.M.A: 16", "equipe": "Mazinho"},
        ]},
        {"data": "2026-06-16", "servicos": [
            {"servico": "remanejamento rede esgoto, LE", "sistema": "esgoto", "local": "Rua 2",
             "quantidade": "LE: 10; 35 mts de remanejamento da rede de esgoto; 10 caixas de inspecao",
             "equipe": "Ze"},
            {"servico": "construcao PV", "sistema": "esgoto", "local": "SRS",
             "quantidade": "PV: 1", "equipe": "Leo"},
        ]},
    ]


def test_linhas_diario_flatten():
    L = linhas_diario(_dias())
    assert len(L) == 4
    assert L[0]["data"] == "2026-06-13" and L[0]["equipe"] == "Renan"


def test_resumo_quantidades():
    R = resumo_quantidades(_dias())
    d = {r["item"]: r["qtd"] for r in R}
    assert d.get("Rede de água") == 80.0
    assert d.get("Ligações de água") == 10.0
    assert d.get("Caixas U.M.A") == 16.0
    assert d.get("Ligações de esgoto") == 10.0
    assert d.get("Rede de esgoto") == 35.0
    assert d.get("Caixas de inspeção") == 10.0
    assert d.get("Poços de visita (PV)") == 1.0
