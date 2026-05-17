from __future__ import annotations

import os
from pathlib import Path


def apply_operational_schema_migration() -> dict[str, object]:
    """Apply the operational planning schema once, using Render DATABASE_URL.

    The SQL is idempotent (`create table if not exists`, `create index if not exists`),
    so running it during startup is safe and removes the manual Supabase step.
    """
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        return {"ok": False, "skipped": True, "reason": "DATABASE_URL ausente"}

    sql_path = Path(__file__).resolve().parent.parent / "docs" / "supabase_log_planejamento_ml_20260425.sql"
    if not sql_path.exists():
        return {"ok": False, "skipped": True, "reason": f"Migration nao encontrada: {sql_path}"}

    try:
        import psycopg2
    except Exception as exc:
        return {"ok": False, "skipped": True, "reason": f"psycopg2 indisponivel: {exc}"}

    try:
        timeout_seconds = int(os.environ.get("DATABASE_CONNECT_TIMEOUT_SECONDS", "5"))
        conn = psycopg2.connect(database_url, connect_timeout=timeout_seconds)
        conn.autocommit = True
        with conn.cursor() as cur:
            statement_timeout_ms = int(os.environ.get("DATABASE_STARTUP_STATEMENT_TIMEOUT_MS", "5000"))
            cur.execute("SET statement_timeout = %s", (statement_timeout_ms,))
            cur.execute(sql_path.read_text(encoding="utf-8"))
        conn.close()
        return {"ok": True, "skipped": False, "migration": sql_path.name}
    except Exception as exc:
        return {"ok": False, "skipped": False, "reason": str(exc)}
