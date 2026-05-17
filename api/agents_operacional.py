from __future__ import annotations

import re
import unicodedata
from datetime import date
from typing import Any

from pydantic import BaseModel, Field

from api.operational import log_operational_event, safe_float
from api.pmbok_decision_engine import analyze_deviation
from api.supabase_client import canonical_project_id, is_rk_project


SENSITIVE_KEYS = {
    "api_key",
    "apikey",
    "authorization",
    "password",
    "secret",
    "service_role",
    "token",
    "supabase_key",
    "evolution_api_key",
}


class InboxPayload(BaseModel):
    texto: str = ""
    origem: str = "manual"
    telefone: str | None = None
    projeto_id: str | None = None
    responsavel: str | None = None
    data_ref: str | None = None
    dominio: str = "geral"
    metadata: dict[str, Any] = Field(default_factory=dict)
    enviar_whatsapp: bool = False


class InboxResult(BaseModel):
    ok: bool
    tipo_detectado: str
    confianca: float
    dominio: str
    extracao: dict[str, Any]
    acoes: list[dict[str, Any]]
    persistencia: list[dict[str, Any]]
    pmbok: dict[str, Any] | None = None
    ml: dict[str, Any] | None = None
    resposta_whatsapp: str
    warnings: list[str] = Field(default_factory=list)


KEYWORDS = {
    "desvio": [
        "atraso", "bloqueio", "bloqueado", "falta", "impedimento", "parado",
        "paralisacao", "problema", "risco", "seguranca", "chuva", "rompimento",
    ],
    "custo": [
        "aluguel", "comprei", "custo", "diesel", "gasto", "material",
        "medicao", "nf", "nota fiscal", "orcamento", "pagamento",
    ],
    "planejamento": [
        "amanha", "frente", "meta", "planejado", "planejamento",
        "programacao", "restricao", "semana",
    ],
    "rdo": [
        "equipe", "executado", "executamos", "foto", "hoje", "maquina",
        "producao", "rdo", "retro", "servico",
    ],
    "decisao": [
        "aditivo", "alterar", "aprovar", "baseline", "decidido",
        "decisao", "mudanca", "validar",
    ],
    "cadastro": [
        "cadastro", "civil", "dxf", "dwg", "gpkg", "layer", "ns",
        "nts", "ose", "qgis", "xdata",
    ],
}

ISSUE_NEGATIONS = (
    "sem atraso",
    "sem bloqueio",
    "sem desvio",
    "sem falta",
    "sem ocorrencia",
    "sem problema",
    "sem restricao",
)


def _dump_model(model: BaseModel) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _payload_dict(payload: InboxPayload | dict[str, Any]) -> dict[str, Any]:
    if isinstance(payload, InboxPayload):
        return _dump_model(payload)
    return dict(payload)


def _norm(value: Any) -> str:
    text = str(value or "")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.lower().split())


def _sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if _norm(key).replace("-", "_") in SENSITIVE_KEYS:
                cleaned[key] = "[redacted]"
            else:
                cleaned[key] = _sanitize(item)
        return cleaned
    if isinstance(value, list):
        return [_sanitize(item) for item in value]
    return value


def classificar_texto_operacional(texto: str) -> dict[str, Any]:
    norm = _norm(texto)
    scores = {tipo: 0 for tipo in KEYWORDS}
    has_issue_negation = any(term in norm for term in ISSUE_NEGATIONS)

    for tipo, keywords in KEYWORDS.items():
        for keyword in keywords:
            if keyword in norm:
                if tipo == "desvio" and has_issue_negation and keyword in {"atraso", "bloqueio", "falta", "problema"}:
                    continue
                scores[tipo] += 1

    if not any(scores.values()):
        return {"tipo": "outro", "confianca": 0.35, "scores": scores}

    priority = ["desvio", "decisao", "custo", "planejamento", "rdo", "cadastro"]
    tipo = max(priority, key=lambda item: (scores[item], -priority.index(item)))
    score = scores[tipo]
    confianca = min(0.95, round(0.40 + (score * 0.15), 2))
    return {"tipo": tipo, "confianca": confianca, "scores": scores}


def _find_kv(texto: str, keys: list[str]) -> str | None:
    wanted = {_norm(key) for key in keys}
    for line in str(texto or "").splitlines():
        raw = line.strip()
        if ":" not in raw and "=" not in raw:
            continue
        sep = ":" if ":" in raw else "="
        left, right = raw.split(sep, 1)
        if _norm(left) in wanted:
            return right.strip()
    return None


def _money(value: Any) -> float:
    raw = re.sub(r"[^\d,.\-]", "", str(value or ""))
    if "," in raw and "." in raw:
        raw = raw.replace(".", "").replace(",", ".")
    elif "," in raw:
        raw = raw.replace(",", ".")
    return safe_float(raw)


def _extract_money_values(texto: str) -> list[dict[str, Any]]:
    values: list[dict[str, Any]] = []
    pattern = r"(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:[,.]\d{1,2})?)"
    for match in re.finditer(pattern, texto, flags=re.I):
        start = max(0, match.start() - 18)
        context = _norm(texto[start: match.end() + 18])
        if any(term in context for term in ("r$", "custo", "gasto", "nf", "nota", "diesel", "aluguel", "pagamento")):
            values.append({"valor": _money(match.group(1)), "contexto": context[:120]})
    return [item for item in values if item["valor"] > 0]


def _extract_quantities(texto: str) -> list[dict[str, Any]]:
    quantities: list[dict[str, Any]] = []
    pattern = re.compile(
        r"(\d+(?:[,.]\d+)?)\s*(m|metro|metros|un|und|unid|unidade|unidades|h|hora|horas|dia|dias)\b",
        flags=re.I,
    )
    for match in pattern.finditer(texto):
        unidade = match.group(2).lower()
        if unidade in {"metro", "metros"}:
            unidade = "m"
        elif unidade in {"und", "unid", "unidade", "unidades"}:
            unidade = "un"
        elif unidade in {"hora", "horas"}:
            unidade = "h"
        elif unidade == "dias":
            unidade = "dia"
        quantities.append(
            {
                "quantidade": _money(match.group(1)),
                "unidade": unidade,
                "contexto": texto[max(0, match.start() - 35): match.end() + 35].strip(),
            }
        )
    return quantities


def _extract_people(texto: str) -> list[dict[str, Any]]:
    equipe: list[dict[str, Any]] = []
    pattern = re.compile(r"(\d+)\s*(homens|funcionarios|pessoas|colaboradores|ajudantes|oficiais)\b", flags=re.I)
    for match in pattern.finditer(texto):
        equipe.append({"quantidade": int(match.group(1)), "tipo": match.group(2).lower()})
    return equipe


def _extract_terms(texto_norm: str, terms: list[str]) -> list[str]:
    return [term for term in terms if term in texto_norm]


def extrair_contexto_operacional(payload: InboxPayload | dict[str, Any], tipo_detectado: str) -> dict[str, Any]:
    data = _payload_dict(payload)
    texto = str(data.get("texto") or "")
    norm = _norm(texto)
    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}

    quantities = _extract_quantities(texto)
    money_values = _extract_money_values(texto)
    production = [
        item for item in quantities
        if item["unidade"] in {"m", "un"}
        and "r$" not in _norm(item.get("contexto"))
        and not any(term in _norm(item.get("contexto")) for term in ("planejado", "previsto", "meta"))
    ]

    planejado = safe_float(metadata.get("planejado")) or _money(_find_kv(texto, ["planejado", "meta", "previsto"]) or "")
    realizado = safe_float(metadata.get("realizado")) or safe_float(production[0]["quantidade"] if production else 0)
    custo_planejado = safe_float(metadata.get("custo_planejado"))
    custo_real = safe_float(metadata.get("custo_real")) or sum(item["valor"] for item in money_values)
    atraso_dias = safe_float(metadata.get("atraso_dias"))
    prazo_planejado_dias = safe_float(metadata.get("prazo_planejado_dias"))

    if not atraso_dias:
        atraso_match = re.search(r"atraso(?:u|ado)?(?:\s+de)?\s+(\d+(?:[,.]\d+)?)\s*dias?", norm)
        atraso_dias = _money(atraso_match.group(1)) if atraso_match else 0.0

    local = (
        _find_kv(texto, ["obra", "local", "rua", "frente", "nucleo"])
        or metadata.get("obra")
        or metadata.get("local")
    )
    responsavel = data.get("responsavel") or _find_kv(texto, ["responsavel", "engenheiro", "encarregado"])

    desvios = _extract_terms(
        norm,
        ["atraso", "bloqueio", "falta", "parado", "paralisacao", "risco", "seguranca", "chuva", "problema"],
    )
    if any(term in norm for term in ISSUE_NEGATIONS):
        desvios = [item for item in desvios if f"sem {item}" not in norm]

    pendencias: list[str] = []
    if not data.get("projeto_id"):
        pendencias.append("projeto_id")
    if tipo_detectado == "rdo" and not production:
        pendencias.append("producao")
    if tipo_detectado in {"rdo", "planejamento"} and not responsavel:
        pendencias.append("responsavel")

    return {
        "obra": local,
        "projeto_id": canonical_project_id(data.get("projeto_id")),
        "responsavel": responsavel,
        "data_ref": data.get("data_ref") or metadata.get("data_ref") or date.today().isoformat(),
        "producao": production,
        "equipe": _extract_people(texto),
        "equipamentos": _extract_terms(norm, ["retro", "escavadeira", "caminhao", "compactador", "bomba", "munck"]),
        "materiais": _extract_terms(norm, ["tubo", "areia", "brita", "pvc", "pead", "cbuq", "cimento", "diesel"]),
        "custos": money_values,
        "desvios": desvios,
        "decisoes": _extract_terms(norm, ["aprovar", "aprovado", "decidido", "mudanca", "alterar", "baseline"]),
        "pendencias": pendencias,
        "metricas": {
            "planejado": planejado,
            "realizado": realizado,
            "custo_planejado": custo_planejado,
            "custo_real": custo_real,
            "atraso_dias": atraso_dias,
            "prazo_planejado_dias": prazo_planejado_dias,
        },
        "texto_resumo": texto[:900],
    }


def _deve_acionar_pmbok(tipo: str, extracao: dict[str, Any]) -> bool:
    metrics = extracao.get("metricas", {})
    return bool(
        tipo in {"desvio", "decisao"}
        or extracao.get("desvios")
        or extracao.get("decisoes")
        or (safe_float(metrics.get("custo_real")) > 0 and tipo == "custo")
    )


def _pmbok_payload(data: dict[str, Any], tipo: str, extracao: dict[str, Any]) -> dict[str, Any]:
    metrics = extracao.get("metricas", {})
    if tipo == "custo":
        pmbok_tipo = "custo"
    elif "seguranca" in extracao.get("desvios", []):
        pmbok_tipo = "seguranca"
    elif "mudanca" in extracao.get("decisoes", []):
        pmbok_tipo = "mudanca de escopo"
    else:
        pmbok_tipo = "prazo" if any(term in extracao.get("desvios", []) for term in ("atraso", "parado", "paralisacao")) else "risco"

    return {
        "projeto_id": extracao.get("projeto_id"),
        "obra": extracao.get("obra"),
        "responsavel": extracao.get("responsavel"),
        "origem": data.get("origem", "agentes_inbox"),
        "tipo": pmbok_tipo,
        "descricao": extracao.get("texto_resumo"),
        "planejado": metrics.get("planejado"),
        "realizado": metrics.get("realizado"),
        "custo_planejado": metrics.get("custo_planejado"),
        "custo_real": metrics.get("custo_real"),
        "atraso_dias": metrics.get("atraso_dias"),
        "prazo_planejado_dias": metrics.get("prazo_planejado_dias"),
        "bloqueio": any(term in extracao.get("desvios", []) for term in ("bloqueio", "falta", "parado", "paralisacao")),
        "seguranca": "seguranca" in extracao.get("desvios", []),
        "data": extracao.get("data_ref"),
    }


def _acoes_por_tipo(tipo: str, extracao: dict[str, Any], pmbok: dict[str, Any] | None) -> list[dict[str, Any]]:
    acoes = [{"agente": "capturador_diario", "acao": "classificar_e_extrair", "status": "ok"}]
    if tipo == "rdo":
        acoes.append({"agente": "rdo_operacional", "acao": "preparar_registro_rdo", "status": "rascunho"})
    if tipo == "planejamento":
        acoes.append({"agente": "planejamento_vs_realizado", "acao": "preparar_planejamento", "status": "rascunho"})
    if tipo == "custo":
        acoes.append({"agente": "financeiro_fluxo_caixa", "acao": "extrair_custos", "status": "rascunho"})
    if tipo == "cadastro":
        acoes.append({"agente": "cad_gis_ns", "acao": "triagem_tecnica", "status": "rascunho"})
    if pmbok:
        acoes.append(
            {
                "agente": "pmbok_diretor",
                "acao": pmbok.get("governanca", {}).get("gate", "analisar"),
                "status": "aberto",
                "severidade": pmbok.get("severidade"),
            }
        )
    if extracao.get("pendencias"):
        acoes.append({"agente": "cobranca_engenheiros", "acao": "solicitar_campos_pendentes", "status": "pendente"})
    return acoes


def _resposta_whatsapp(tipo: str, extracao: dict[str, Any], pmbok: dict[str, Any] | None) -> str:
    labels = {
        "rdo": "RDO",
        "planejamento": "planejamento",
        "custo": "custo/financeiro",
        "desvio": "desvio",
        "decisao": "decisao",
        "cadastro": "CAD/GIS/NS",
        "outro": "mensagem operacional",
    }
    partes = [f"Recebido. Classifiquei como {labels.get(tipo, tipo)}."]

    producao = extracao.get("producao") or []
    if producao:
        first = producao[0]
        partes.append(f"Identifiquei producao de {first['quantidade']:g} {first['unidade']}.")
    if extracao.get("custos"):
        total = sum(item["valor"] for item in extracao["custos"])
        partes.append(f"Identifiquei custo informado de R$ {total:,.2f}.")
    if extracao.get("desvios"):
        partes.append("Ha sinal de desvio/bloqueio para tratar.")
    if pmbok:
        severidade = pmbok.get("severidade")
        gate = pmbok.get("governanca", {}).get("gate")
        partes.append(f"PMBOK abriu gate {gate} com severidade {severidade}.")
    if extracao.get("pendencias"):
        campos = ", ".join(extracao["pendencias"])
        partes.append(f"Falta informar: {campos}.")
    else:
        partes.append("Registrei no log operacional para a plataforma.")
    return " ".join(partes)


def processar_inbox_operacional(payload: InboxPayload | dict[str, Any]) -> dict[str, Any]:
    data = _payload_dict(payload)
    data["projeto_id"] = canonical_project_id(data.get("projeto_id"))
    dominio = _norm(data.get("dominio") or "geral") or "geral"
    texto = str(data.get("texto") or "").strip()
    warnings: list[str] = []

    if not texto:
        empty = InboxResult(
            ok=False,
            tipo_detectado="outro",
            confianca=0.0,
            dominio=dominio,
            extracao={"pendencias": ["texto"]},
            acoes=[],
            persistencia=[],
            resposta_whatsapp="Mensagem vazia. Envie o texto do apontamento operacional.",
            warnings=["texto vazio"],
        )
        return _dump_model(empty)

    classification = classificar_texto_operacional(texto)
    tipo = classification["tipo"]
    extracao = extrair_contexto_operacional(data, tipo)

    pmbok: dict[str, Any] | None = None
    project_id = extracao.get("projeto_id")
    if dominio == "rk" and project_id and not is_rk_project(project_id):
        warnings.append("Projeto fora do escopo RK dos agentes; PMBOK RK nao acionado.")
    elif _deve_acionar_pmbok(tipo, extracao):
        pmbok = analyze_deviation(_pmbok_payload(data, tipo, extracao))

    acoes = _acoes_por_tipo(tipo, extracao, pmbok)
    log_payload = _sanitize(
        {
            "tipo_detectado": tipo,
            "confianca": classification["confianca"],
            "dominio": dominio,
            "extracao": extracao,
            "pmbok": pmbok,
            "metadata": data.get("metadata") if isinstance(data.get("metadata"), dict) else {},
        }
    )
    severity = "warning" if pmbok and pmbok.get("severidade") in {"media", "alta", "critica"} else "info"
    status = "open" if extracao.get("pendencias") or pmbok else "observed"
    persistencia = [
        log_operational_event(
            subsystem="agentes_inbox_operacional",
            severity=severity,
            status=status,
            project_id=project_id,
            telefone=data.get("telefone"),
            payload=log_payload,
            origem=data.get("origem") or "agentes_inbox",
        )
    ]

    result = InboxResult(
        ok=True,
        tipo_detectado=tipo,
        confianca=classification["confianca"],
        dominio=dominio,
        extracao=extracao,
        acoes=acoes,
        persistencia=persistencia,
        pmbok=pmbok,
        ml={"status": "nao_executado", "motivo": "ML roda em etapa de planejamento/replanejamento"},
        resposta_whatsapp=_resposta_whatsapp(tipo, extracao, pmbok),
        warnings=warnings,
    )
    return _dump_model(result)
