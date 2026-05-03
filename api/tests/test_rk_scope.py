from fastapi import HTTPException

from api.routes_pmbok import post_engineer_daily_charge, post_analyze_deviation
from api.routes_whatsapp import _dedupe_numeros, enviar_mensagem, registrar_numero
from api.supabase_client import (
    EXCLUDED_AGENT_PROJECT_IDS,
    RK_PROJECT_IDS,
    filter_rk_rows,
    is_rk_project,
    rk_project_ids,
)


TATUI = "c2bf8fda-b2e0-4bc1-9535-4891d596ea10"
TATUI_ALIAS = "c2bf8fda-1111-4444-8888-aaaaaaaaaaaa"
SLNR = "abe7f66c-004b-4bb5-a245-6be67debd9f7"
OSASCO = "f3c6645b-347f-4382-b9c5-d103c27ec511"


def test_rk_allowlist_excludes_agent_forbidden_projects():
    assert set(RK_PROJECT_IDS) == {
        TATUI,
        OSASCO,
        "d4e5f6a7-b8c9-4d0e-a1f2-b3c4d5e6f7a8",
    }
    assert is_rk_project(TATUI_ALIAS) is True
    assert all(not is_rk_project(project_id) for project_id in EXCLUDED_AGENT_PROJECT_IDS)
    assert SLNR not in rk_project_ids(include_aliases=True)


def test_filter_rk_rows_keeps_only_rk_projects():
    rows = [
        {"projeto_id": TATUI, "nome": "Tatui"},
        {"projeto_id": SLNR, "nome": "Santos"},
        {"project_id": OSASCO, "nome": "Osasco"},
        {"nome": "sem projeto"},
    ]

    assert [row["nome"] for row in filter_rk_rows(rows)] == ["Tatui", "Osasco"]


def test_whatsapp_number_dedupe_drops_non_rk_and_missing_project():
    rows = [
        {"telefone": "55 11 99999-0000", "nome": "RK", "projeto_id": TATUI, "funcao": "Engenheiro"},
        {"telefone": "55 13 99999-0000", "nome": "SLNR", "projeto_id": SLNR, "funcao": "Engenheiro"},
        {"telefone": "55 61 99999-0000", "nome": "Sem projeto", "funcao": "Diretor"},
    ]

    result = _dedupe_numeros(rows)

    assert len(result) == 1
    assert result[0]["nome"] == "RK"
    assert result[0]["projeto_id"] == TATUI


def test_whatsapp_send_blocks_non_rk_project_before_delivery():
    result = enviar_mensagem({"telefone": "5500000000000", "mensagem": "teste", "projeto_id": SLNR})

    assert result["delivery"] == "blocked_non_rk"


def test_whatsapp_register_number_requires_rk_project():
    try:
        registrar_numero(
            {
                "ns_id": 1,
                "telefone": "5500000000000",
                "nome": "Teste",
                "funcao": "Engenheiro",
                "projeto_id": SLNR,
            }
        )
    except HTTPException:
        pass
    else:
        raise AssertionError("Cadastro aceitou numero fora do escopo RK")


def test_pmbok_routes_reject_non_rk_and_filter_engineers():
    try:
        post_analyze_deviation({"projeto_id": SLNR, "tipo": "prazo", "planejado": 100, "realizado": 50})
    except HTTPException:
        pass
    else:
        raise AssertionError("PMBOK aceitou projeto fora do escopo RK")

    result = post_engineer_daily_charge(
        {
            "engenheiros": [
                {"nome": "RK", "projeto_id": TATUI, "rdo_entregue": False},
                {"nome": "SLNR", "projeto_id": SLNR, "rdo_entregue": False},
            ]
        }
    )

    assert result["resumo"]["total_engenheiros"] == 1
    assert result["items"][0]["projeto_id"] == TATUI
