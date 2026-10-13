from __future__ import annotations

import math
import uuid
from datetime import date, datetime, timedelta
from typing import Any

from api.supabase_client import get_supabase


def utc_now_iso() -> str:
    return datetime.utcnow().isoformat()


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return default
        number = float(value)
        return number if math.isfinite(number) else default
    except (TypeError, ValueError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    return int(round(safe_float(value, float(default))))


def parse_date(value: Any, fallback: date | None = None) -> date:
    if isinstance(value, date):
        return value
    text = str(value or "").strip()
    if text:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            pass
    return fallback or date.today()


def week_bounds(value: Any = None) -> tuple[str, str]:
    day = parse_date(value)
    start = day - timedelta(days=day.weekday())
    end = start + timedelta(days=6)
    return start.isoformat(), end.isoformat()


def normalize_text(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def log_operational_event(
    *,
    subsystem: str,
    severity: str = "info",
    status: str = "open",
    project_id: str | None = None,
    telefone: str | None = None,
    request_id: str | None = None,
    event_id: str | None = None,
    error_message: str | None = None,
    payload: dict[str, Any] | None = None,
    origem: str = "api",
) -> dict[str, Any]:
    """Best-effort operational log.

    Never raises: logging cannot break the operational path it is observing.
    """
    client = get_supabase()
    row = {
        "id": str(uuid.uuid4()),
        "projeto_id": project_id,
        "subsystem": subsystem,
        "severity": severity,
        "status": status,
        "telefone": telefone,
        "request_id": request_id,
        "event_id": event_id,
        "error_message": error_message,
        "payload": payload or {},
        "origem": origem,
        "created_at": utc_now_iso(),
    }
    if client is None:
        return {"ok": False, "fallback": "no_supabase", "row": row}
    try:
        result = client.table("operational_logs").insert(row).execute()
        data = getattr(result, "data", None)
        return {"ok": True, "row": data[0] if isinstance(data, list) and data else row}
    except Exception as exc:
        # Fallback into an existing table so early migrations still leave a trace.
        try:
            client.table("workflow_events").insert(
                {
                    "projeto_id": project_id,
                    "tipo": "operational_log_fallback",
                    "origem": origem,
                    "status": "warning",
                    "payload": {**row, "fallback_error": str(exc)},
                }
            ).execute()
        except Exception:
            pass
        return {"ok": False, "error": str(exc), "row": row}


def metric_severity(desvio_percentual: float, cpi: float, has_blocker: bool = False) -> str:
    abs_dev = abs(desvio_percentual)
    if has_blocker or abs_dev >= 35 or cpi < 0.75:
        return "critical"
    if abs_dev >= 20 or cpi < 0.9:
        return "high"
    if abs_dev >= 10 or cpi < 1:
        return "medium"
    return "low"


def action_for_deviation(desvio_percentual: float, cpi: float, has_blocker: bool = False) -> str:
    if has_blocker:
        return "Remover restricao antes de manter a atividade no plano semanal."
    if desvio_percentual <= -35:
        return "Replanejar sequencia, reforcar equipe/equipamento e validar frente com diretor."
    if desvio_percentual <= -20:
        return "Revisar produtividade, remover gargalo e cobrar plano de recuperacao."
    if cpi < 0.85:
        return "Revisar custo diario, locacoes, mao de obra e composicao da atividade."
    if desvio_percentual >= 20:
        return "Antecipar atividade sucessora e revisar restricoes futuras."
    return "Manter monitoramento e conferir aderencia no proximo RDO."
