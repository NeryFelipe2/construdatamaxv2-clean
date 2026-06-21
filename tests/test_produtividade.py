from planejamento.produtividade import prever_produtividade


def test_base_vazia_cai_no_padrao():
    r = prever_produtividade({"tipo_servico": "assentamento_tubo", "dn": 150}, base=[])
    assert r["fonte"] == "padrao" and r["produtividade"] == 20.0
    assert r["confirmar"] is True


def test_analogia_escolhe_o_mais_parecido():
    base = [
        {"tipo_servico": "assentamento_tubo", "dn": 150, "cidade": "TATUI", "produtividade": 18.0},
        {"tipo_servico": "assentamento_tubo", "dn": 400, "cidade": "OUTRA", "produtividade": 9.0},
        {"tipo_servico": "caixa", "dn": None, "produtividade": 3.0},
    ]
    r = prever_produtividade({"tipo_servico": "assentamento_tubo", "dn": 160, "cidade": "TATUI"}, base)
    assert r["fonte"] == "analogia"
    assert r["produtividade"] == 18.0          # DN160 ~ DN150 + mesma cidade
    assert r["referencia"]["dn"] == 150
    assert r["confirmar"] is True
