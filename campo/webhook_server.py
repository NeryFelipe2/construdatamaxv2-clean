"""Helpers de webhook para o modulo de campo."""
from __future__ import annotations

from typing import Any

from campo.whatsapp_bot import WhatsAppBot


def processar_webhook_whatsapp(payload: dict[str, Any], bot: WhatsAppBot | None = None) -> dict[str, Any]:
    """Processa um payload de webhook e devolve a resposta do bot."""
    return (bot or WhatsAppBot()).process_webhook(payload)


__all__ = ["processar_webhook_whatsapp"]
