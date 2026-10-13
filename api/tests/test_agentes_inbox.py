from api.agents_operacional import InboxPayload, classificar_texto_operacional, processar_inbox_operacional


TATUI = "c2bf8fda-b2e0-4bc1-9535-4891d596ea10"
SLNR = "abe7f66c-004b-4bb5-a245-6be67debd9f7"


def _fake_log(**kwargs):
    return {"ok": True, "row": {"subsystem": kwargs["subsystem"], "payload": kwargs.get("payload", {})}}


def test_classifica_rdo_e_extrai_producao(monkeypatch):
    monkeypatch.setattr("api.agents_operacional.log_operational_event", _fake_log)

    result = processar_inbox_operacional(
        InboxPayload(
            texto="Hoje executamos 18m de rede DN200 na Rua Cuiaba, equipe com 5 homens e retro. Sem bloqueio.",
            origem="whatsapp",
            projeto_id=TATUI,
            responsavel="Mateus",
            dominio="rk",
        )
    )

    assert result["ok"] is True
    assert result["tipo_detectado"] == "rdo"
    assert result["extracao"]["producao"][0]["quantidade"] == 18
    assert result["extracao"]["equipe"][0]["quantidade"] == 5
    assert "RDO" in result["resposta_whatsapp"]


def test_classifica_custo(monkeypatch):
    monkeypatch.setattr("api.agents_operacional.log_operational_event", _fake_log)

    result = processar_inbox_operacional(
        {
            "texto": "NF de diesel e aluguel da retro: custo total R$ 1.250,50.",
            "origem": "manual",
            "projeto_id": TATUI,
            "dominio": "rk",
        }
    )

    assert result["tipo_detectado"] == "custo"
    assert sum(item["valor"] for item in result["extracao"]["custos"]) >= 1250
    assert any(acao["agente"] == "financeiro_fluxo_caixa" for acao in result["acoes"])


def test_desvio_aciona_pmbok(monkeypatch):
    monkeypatch.setattr("api.agents_operacional.log_operational_event", _fake_log)

    result = processar_inbox_operacional(
        InboxPayload(
            texto="Atraso de 4 dias por falta de material. Planejado: 100m. Realizado: 60m.",
            origem="whatsapp",
            projeto_id=TATUI,
            responsavel="Icaro",
            dominio="rk",
            metadata={"planejado": 100, "realizado": 60, "prazo_planejado_dias": 10},
        )
    )

    assert result["tipo_detectado"] == "desvio"
    assert result["pmbok"] is not None
    assert result["pmbok"]["governanca"]["aprovar_diretor"] is True
    assert any(acao["agente"] == "pmbok_diretor" for acao in result["acoes"])


def test_sem_projeto_fica_pendente_sem_quebrar(monkeypatch):
    monkeypatch.setattr("api.agents_operacional.log_operational_event", _fake_log)

    result = processar_inbox_operacional(
        InboxPayload(texto="Hoje executamos 12m de rede com equipe de 4 homens.", origem="manual")
    )

    assert result["ok"] is True
    assert "projeto_id" in result["extracao"]["pendencias"]
    assert "Falta informar" in result["resposta_whatsapp"]


def test_projeto_fora_rk_nao_aciona_pmbok_rk(monkeypatch):
    monkeypatch.setattr("api.agents_operacional.log_operational_event", _fake_log)

    result = processar_inbox_operacional(
        InboxPayload(
            texto="Atraso por bloqueio de frente.",
            origem="manual",
            projeto_id=SLNR,
            dominio="rk",
        )
    )

    assert result["tipo_detectado"] == "desvio"
    assert result["pmbok"] is None
    assert result["warnings"]


def test_metadata_sensivel_nao_vaza_no_log(monkeypatch):
    monkeypatch.setattr("api.agents_operacional.log_operational_event", _fake_log)

    result = processar_inbox_operacional(
        InboxPayload(
            texto="Custo de material R$ 100,00.",
            projeto_id=TATUI,
            dominio="rk",
            metadata={"api_key": "SEGREDO", "token": "OUTRO", "planejado": 10},
        )
    )

    payload = result["persistencia"][0]["row"]["payload"]
    assert "SEGREDO" not in str(result)
    assert payload["metadata"]["api_key"] == "[redacted]"
    assert payload["metadata"]["token"] == "[redacted]"


def test_classificacao_outro_para_texto_generico():
    result = classificar_texto_operacional("bom dia, depois eu vejo isso")

    assert result["tipo"] == "outro"

