from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from supabase import Client, create_client


TABLES_CANONICAS = [
    "projetos",
    "frentes",
    "contatos",
    "tarefas",
    "rdos",
    "rdo_equipes",
    "rdo_atividades",
    "rdo_materiais",
    "rdo_equipamentos",
    "rdo_mao_obra",
    "rdo_ocorrencias",
    "punch_list_items",
    "lps_restricoes",
    "whatsapp_logs",
    "workflow_events",
]

PROJECT_ID_ALIASES: dict[str, str] = {
    "c2bf8fda-1111-4444-8888-aaaaaaaaaaaa": "c2bf8fda-b2e0-4bc1-9535-4891d596ea10",
    "d4e5f6a7-1111-2222-3333-bbbbbbbbbbbb": "d4e5f6a7-b8c9-4d0e-a1f2-b3c4d5e6f7a8",
}

CANONICAL_PROJECT_IDS = [
    "c2bf8fda-b2e0-4bc1-9535-4891d596ea10",
    "f3c6645b-347f-4382-b9c5-d103c27ec511",
    "abe7f66c-004b-4bb5-a245-6be67debd9f7",
    "ec112c9a-1669-4287-8079-526d6940ce82",
    "2a28beec-b1f8-4b0c-8416-d0710bb35d9d",
    "d4e5f6a7-b8c9-4d0e-a1f2-b3c4d5e6f7a8",
]


PROJETOS_OFICIAIS: list[dict[str, Any]] = [
    {
        "id": "c2bf8fda-b2e0-4bc1-9535-4891d596ea10",
        "nome": "Tatui - RK",
        "contrato": "CT-TATUI-2026",
        "cidade": "Tatui",
        "cliente": "RK",
        "tipo": "esgoto",
        "status": "ativo",
        "responsavel_nome": "Felipe Nery",
        "responsavel_telefone": "5561981846325",
    },
    {
        "id": "f3c6645b-347f-4382-b9c5-d103c27ec511",
        "nome": "Osasco - Rua Cuiaba",
        "contrato": "CT-CLU-OSC-2026",
        "cidade": "Osasco",
        "cliente": "RK",
        "tipo": "esgoto",
        "status": "ativo",
        "responsavel_nome": "Mateus Santos",
        "responsavel_telefone": "5561991015639",
    },
    {
        "id": "abe7f66c-004b-4bb5-a245-6be67debd9f7",
        "nome": "Consorcio Se Liga na Rede - SLNR Santos",
        "contrato": "CT-11481051",
        "cidade": "Santos",
        "cliente": "Consorcio",
        "tipo": "esgoto",
        "status": "ativo",
        "responsavel_nome": "Felipe Nery",
        "responsavel_telefone": "5561981846325",
    },
    {
        "id": "ec112c9a-1669-4287-8079-526d6940ce82",
        "nome": "Pardinho - Consorcio Itapetininga",
        "contrato": "PARD-2026",
        "cidade": "Pardinho",
        "cliente": "Consorcio Itapetininga",
        "tipo": "esgoto",
        "status": "ativo",
        "responsavel_nome": "Fabio",
        "responsavel_telefone": "5537999000001",
    },
    {
        "id": "2a28beec-b1f8-4b0c-8416-d0710bb35d9d",
        "nome": "ConstruData Brasilia",
        "contrato": "CD-BSB-2026",
        "cidade": "Brasilia",
        "cliente": "ConstruData",
        "tipo": "esgoto",
        "status": "ativo",
        "responsavel_nome": "Joao",
        "responsavel_telefone": "5561999996252",
    },
    {
        "id": "d4e5f6a7-b8c9-4d0e-a1f2-b3c4d5e6f7a8",
        "nome": "RK SUB Empreita",
        "contrato": "RK-SUB-2026",
        "cidade": "Santos",
        "cliente": "RK",
        "tipo": "esgoto",
        "status": "ativo",
        "responsavel_nome": "Felipe Nery",
        "responsavel_telefone": "5561981846325",
    },
]


def _env_key() -> str:
    return (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("VITE_SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_KEY")
        or ""
    )


def supabase_config() -> dict[str, bool]:
    return {
        "url": bool(os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")),
        "key": bool(_env_key()),
    }


@lru_cache(maxsize=1)
def get_supabase() -> Client | None:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or ""
    key = _env_key()
    if not url or not key:
        return None
    return create_client(url, key)


def table_status(client: Client | None, table: str) -> dict[str, Any]:
    if client is None:
        return {"ok": False, "error": "Supabase nao configurado"}
    try:
        client.table(table).select("*", count="exact").limit(1).execute()
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
