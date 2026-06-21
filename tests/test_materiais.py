from planejamento.materiais import lista_material


def test_agrega_por_dn_e_conta_pvs():
    trechos = [
        {"pv_ini": "A", "pv_fim": "B", "dn_mm": 150, "ext_m": 40.0, "layer": "REDE"},
        {"pv_ini": "B", "pv_fim": "C", "dn_mm": 150, "ext_m": 30.0, "layer": "REDE"},
        {"pv_ini": "C", "pv_fim": "D", "dn_mm": 200, "ext_m": 25.0, "layer": "REDE"},
    ]
    pvs = {"A": {}, "B": {}, "C": {}, "D": {}}
    linhas = lista_material(trechos, pvs)

    tubos = [l for l in linhas if l["und"] == "m"]
    assert len(tubos) == 2                                  # DN150 e DN200
    dn150 = [l for l in tubos if l["dimensao"] == "DN150"][0]
    assert dn150["quant"] == 70.0                           # 40 + 30
    assert dn150["descricao"] == "Tubo PVC DN150"

    pv = [l for l in linhas if l["und"] == "un"][0]
    assert pv["quant"] == 4


def test_infere_material_pead_pelo_layer():
    trechos = [{"pv_ini": "A", "pv_fim": "B", "dn_mm": 63, "ext_m": 10.0, "layer": "TUBO_PE80"}]
    linhas = lista_material(trechos, {"A": {}, "B": {}})
    assert linhas[0]["descricao"].startswith("Tubo PEAD")
