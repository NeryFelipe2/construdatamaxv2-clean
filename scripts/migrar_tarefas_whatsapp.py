"""Migra tarefas historicas do WhatsApp para a tabela public.tarefas.

O script e idempotente: se encontrar a tarefa pelo par
(origem, responsavel, descricao), ele atualiza o telefone/metadados em vez de
inserir duplicado.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / "workflows" / "n8n_production_ae317_up_railway_app_felipe_n" / "personal" / "gestao-whatsapp-router.workflow.ts"


def load_supabase_config() -> tuple[str, str]:
    text = WORKFLOW.read_text(encoding="utf-8")
    url_match = re.search(r"SUPABASE_URL\s*=\s*'([^']+)'", text)
    key_match = re.search(r"SUPABASE_KEY\s*=\s*'([^']+)'", text)
    if not url_match or not key_match:
        raise RuntimeError(f"Nao encontrei SUPABASE_URL/SUPABASE_KEY em {WORKFLOW}")
    return url_match.group(1), key_match.group(1)


TASKS = [
    {
        "delegante": "Felipe Nery",
        "delegante_phone": "5561981846325",
        "responsavel": "Felipe",
        "responsavel_phone": "5561981846325",
        "descricao": "Soltar nota tecnica em todos os projetos de agua, PEAD 32 rede secundaria, comprar tubo preto",
    },
    {
        "delegante": "Felipe Nery",
        "delegante_phone": "5561981846325",
        "responsavel": "Joao",
        "responsavel_phone": "5561999996252",
        "descricao": "Marcar reuniao com Isaque para implantacao e pagamento",
    },
    {
        "delegante": "Felipe Nery",
        "delegante_phone": "5561981846325",
        "responsavel": "Felipe",
        "responsavel_phone": "5561981846325",
        "descricao": "Pedir planilha e juntar na mesma situacao das notas de servico",
    },
    {
        "delegante": "Felipe Nery",
        "delegante_phone": "5561981846325",
        "responsavel": "Junior",
        "responsavel_phone": "5511986012223",
        "descricao": "Pedir planilha e juntar na mesma situacao das notas de servico",
    },
    {
        "delegante": "Felipe Nery",
        "delegante_phone": "5561981846325",
        "responsavel": "Felipe",
        "responsavel_phone": "5561981846325",
        "descricao": "Pedir ao Cosme cartografia deles",
    },
    {
        "delegante": "Felipe Nery",
        "delegante_phone": "5561981846325",
        "responsavel": "Gabriel",
        "responsavel_phone": "5513991995918",
        "descricao": "Pedir planilha e juntar na mesma situacao das notas de servico",
    },
    {
        "delegante": "Felipe Nery",
        "delegante_phone": "5561981846325",
        "responsavel": "Vinicius",
        "responsavel_phone": "5513978216285",
        "descricao": "Terminar planilha Minhoratti e iniciar revisao dos projetos",
    },
    {
        "delegante": "Felipe Nery",
        "delegante_phone": "5561981846325",
        "responsavel": "Luiz Fernando",
        "responsavel_phone": "5537999425397",
        "descricao": "Cobrar Icaro e Mateus para enviarem RDO",
    },
]


def request_json(method: str, url: str, key: str, payload: dict | None = None) -> list[dict]:
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else []
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} falhou: {exc.code} {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"{method} {url} falhou: {exc}") from exc


def norm(value: str | None) -> str:
    text = value or ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.lower().split())


def main() -> int:
    url, key = load_supabase_config()
    inserted = 0
    updated = 0
    existing_rows = request_json(
        "GET",
        f"{url}/tarefas?origem=eq.whatsapp_migration&select=id,responsavel,descricao,responsavel_phone,metadata",
        key,
    )

    for task in TASKS:
        existing = next(
            (
                row
                for row in existing_rows
                if norm(row.get("responsavel")) == norm(task["responsavel"])
                and norm(row.get("descricao")) == norm(task["descricao"])
            ),
            None,
        )
        payload = {
            **task,
            "tipo": "operacional",
            "status": "pendente",
            "origem": "whatsapp_migration",
            "metadata": {
                "fonte": "STATUS_ATUALIZADO_16ABR.md",
                "migrado_por": "codex",
                "data_original": "2026-04-16",
            },
        }
        if existing:
            row_id = existing["id"]
            request_json(
                "PATCH",
                f"{url}/tarefas?id=eq.{row_id}",
                key,
                {
                    "delegante_phone": task["delegante_phone"],
                    "responsavel_phone": task["responsavel_phone"],
                    "metadata": payload["metadata"],
                },
            )
            updated += 1
            print(f"Atualizada: {task['responsavel']} - {task['descricao'][:55]}")
        else:
            request_json("POST", f"{url}/tarefas", key, payload)
            inserted += 1
            print(f"Inserida: {task['responsavel']} - {task['descricao'][:55]}")

    print(f"Concluido. Inseridas={inserted}, atualizadas={updated}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1)
