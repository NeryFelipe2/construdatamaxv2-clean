from api.pmbok_decision_engine import analyze_batch, analyze_deviation, build_engineer_daily_charge


def test_schedule_deviation_requires_director_approval():
    result = analyze_deviation(
        {
            "obra": "Osasco",
            "tipo": "prazo",
            "descricao": "Meta de assentamento nao atingida",
            "planejado": 100,
            "realizado": 60,
            "prazo_planejado_dias": 10,
            "atraso_dias": 4,
        }
    )

    assert result["pmbok_area"] == "schedule"
    assert result["severidade"] == "critica"
    assert result["governanca"]["aprovar_diretor"] is True
    assert result["governanca"]["replanejamento_rascunho"] is True
    assert "change_request" in result["artefatos_pmbok"] or "issue_log" in result["artefatos_pmbok"]


def test_scope_change_opens_integrated_change_control():
    result = analyze_deviation(
        {
            "obra": "Morro do Teteu",
            "tipo": "mudanca de escopo",
            "descricao": "Alteracao de baseline por nova frente",
            "planejado": 15,
            "realizado": 15,
        }
    )

    assert result["classe"] == "mudanca"
    assert result["governanca"]["controle_integrado_mudanca"] is True
    assert result["decisao_recomendada"]["pode_alterar_baseline"] is True
    assert "change_request" in result["artefatos_pmbok"]


def test_batch_summary_counts_critical_and_director_items():
    result = analyze_batch(
        [
            {"tipo": "prazo", "planejado": 100, "realizado": 100},
            {"tipo": "custo", "custo_planejado": 1000, "custo_real": 1400},
            {"tipo": "seguranca", "seguranca": True, "descricao": "Risco de acidente"},
        ]
    )

    assert result["resumo"]["total"] == 3
    assert result["resumo"]["criticas"] >= 1
    assert result["resumo"]["aprovacao_diretor"] >= 2


def test_engineer_daily_charge_generates_message_and_escalation():
    result = build_engineer_daily_charge(
        {
            "data": "2026-05-03",
            "engenheiros": [
                {
                    "nome": "Mateus",
                    "obra": "Osasco",
                    "rdo_entregue": False,
                    "planejamento_entregue": False,
                    "desvios_abertos": 2,
                    "plano_acao_desvios": False,
                    "reincidencias": 2,
                }
            ],
        }
    )

    item = result["items"][0]
    assert result["resumo"]["escalar"] == 1
    assert item["escalar_para_diretor"] is True
    assert "RDO diario nao entregue" in item["pendencias"]
    assert "Mateus" in item["mensagem_whatsapp"]
