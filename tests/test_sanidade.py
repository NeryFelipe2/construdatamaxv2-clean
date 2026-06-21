from planejamento.sanidade import checar_sanidade


def _rede_ok():
    pvs = {"PV1": {}, "PV2": {}, "PV3": {}}
    trechos = [
        {"pv_ini": "PV1", "pv_fim": "PV2", "ext_m": 40.0, "dn_mm": 150},
        {"pv_ini": "PV2", "pv_fim": "PV3", "ext_m": 35.0, "dn_mm": 150},
    ]
    return pvs, trechos


def test_rede_sadia_sem_avisos():
    pvs, trechos = _rede_ok()
    assert checar_sanidade(pvs, trechos) == []


def test_trecho_com_pv_inexistente_e_flagado():
    pvs, trechos = _rede_ok()
    trechos.append({"pv_ini": "PV2", "pv_fim": "FANTASMA", "ext_m": 20.0, "dn_mm": 150})
    avisos = checar_sanidade(pvs, trechos)
    assert any("FANTASMA" in a for a in avisos)


def test_excesso_de_trechos_por_pv_e_flagado():
    # 3 PVs mas 30 trechos => provável invenção de rede
    pvs = {f"PV{i}": {} for i in range(3)}
    trechos = [{"pv_ini": "PV0", "pv_fim": "PV1", "ext_m": 10.0, "dn_mm": 150}
               for _ in range(30)]
    avisos = checar_sanidade(pvs, trechos)
    assert any("trecho" in a.lower() and "pv" in a.lower() for a in avisos)


def test_extensao_absurda_e_flagada():
    pvs, trechos = _rede_ok()
    trechos.append({"pv_ini": "PV1", "pv_fim": "PV3", "ext_m": 5000.0, "dn_mm": 150})
    avisos = checar_sanidade(pvs, trechos)
    assert any("extens" in a.lower() for a in avisos)


def test_maioria_sem_dn_e_flagada():
    # rede lida em modo brutal: muitos trechos, nenhum DN
    pvs = {f"PV{i}": {} for i in range(10)}
    trechos = [{"pv_ini": f"PV{i}", "pv_fim": f"PV{i+1}", "ext_m": 30.0, "dn_mm": None}
               for i in range(9)]
    avisos = checar_sanidade(pvs, trechos)
    assert any("brutal" in a.lower() or "dn" in a.lower() for a in avisos)


def test_modo_brutal_pelo_meta_e_flagado():
    pvs, trechos = _rede_ok()
    meta = {"motor": "GDAL/OGR v5 (BRUTAL)"}
    avisos = checar_sanidade(pvs, trechos, meta)
    assert any("brutal" in a.lower() for a in avisos)


def test_meta_conservador_nao_flaga():
    pvs, trechos = _rede_ok()
    meta = {"motor": "GDAL/OGR v5 (conservador)"}
    assert checar_sanidade(pvs, trechos, meta) == []
