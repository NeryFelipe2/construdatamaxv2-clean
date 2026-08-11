"""Estrutura RDOs textuais do Icaro em producao quantificavel."""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from sqlalchemy import select

from core.database import get_session
from core.models import RDO, RDOApontamento

MARKER = "AUTO_ESTRUTURADO_ICARO"
NUCLEOS_ICARO = ["CESARIO_LANGE", "PORANGABA", "SAO_ROQUE"]

STAGE_TERMS = (
    "inicio", "limpeza", "laje", "parede", "reboco", "armacao", "armação",
    "concretagem", "tampa", "finalizacao", "finalização", "dreno",
    "nivelamento", "acabamento", "construcao", "construção", "escavacao",
    "escavação", "fundo",
)

BLOCK_TERMS = (
    "nao teve atividades", "não teve atividades", "falta de hr", "paralis",
    "impedindo assim", "nao realizou", "não realizou", "problema apresentado",
)


def _norm(text: str) -> str:
    table = str.maketrans("áàãâéêíóôõúçÁÀÃÂÉÊÍÓÔÕÚÇ", "aaaaeeioooucAAAAEEIOOOUC")
    return text.translate(table).lower()


def _float(value: str) -> float:
    return float(value.replace(".", "").replace(",", ".") if "," in value else value)


def _has_block(text: str) -> bool:
    n = _norm(text)
    return any(t in n for t in BLOCK_TERMS)


def _meters(text: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for m in re.finditer(r"\b(\d+(?:[,.]\d+)?)\s*m\b(?!m)", text, re.I):
        around = text[max(0, m.start() - 16):m.end() + 16].lower()
        if " x " in around or "dimens" in around:
            continue
        val = _float(m.group(1))
        if not (0 < val <= 500):
            continue
        service = "Metro executado"
        prefix = text[max(0, m.start() - 55):m.end() + 55]
        if re.search(r"assent", prefix, re.I):
            service = "Assentamento de rede"
        elif re.search(r"escav", prefix, re.I):
            service = "Escavacao executada"
        dn = 0
        dn_match = re.search(r"\bDN\s*(\d{2,4})", prefix, re.I)
        if dn_match:
            dn = int(dn_match.group(1))
        rows.append({"servico": service, "quantidade": val, "unidade": "m", "dn_mm": dn})
    return rows


def _tubos(text: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for m in re.finditer(r"\b(\d+)\s+tubos?\s+(?:[A-Z]{1,3}\s+)?DN\s*(\d{2,4})", text, re.I):
        rows.append({
            "servico": "Tubo assentado",
            "quantidade": int(m.group(1)),
            "unidade": "un",
            "dn_mm": int(m.group(2)),
        })
    return rows


def _caixa_etapas(text: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not re.search(r"\b(caixa|abrigo|vrp)\b", text, re.I):
        return rows
    parts = re.split(r"(?=Equipe\s+\d+\s*:)", text, flags=re.I)
    if len(parts) == 1:
        parts = [text]
    for part in parts:
        if not re.search(r"\b(caixa|abrigo|vrp)\b", part, re.I):
            continue
        n = _norm(part)
        stages = sum(1 for term in STAGE_TERMS if term in n)
        if "100%" in n:
            stages = max(stages, 2)
        if "nao teve" in n or "não teve" in n:
            stages = 0
        if stages <= 0:
            continue
        equipe = re.search(r"Equipe\s+(\d+)", part, re.I)
        label = f"Caixa/abrigo - etapas equipe {equipe.group(1)}" if equipe else "Caixa/abrigo - etapas"
        rows.append({"servico": label, "quantidade": min(stages, 4), "unidade": "etapa", "dn_mm": 0})
    return rows


def extrair_producao_icaro(texto: str) -> list[dict[str, Any]]:
    rows = _meters(texto) + _tubos(texto) + _caixa_etapas(texto)
    if not rows and _has_block(texto):
        return []
    seen: set[tuple[str, float, str, int]] = set()
    out: list[dict[str, Any]] = []
    for row in rows:
        key = (row["servico"], float(row["quantidade"]), row["unidade"], int(row.get("dn_mm") or 0))
        if key not in seen:
            seen.add(key)
            out.append(row)
    return out


def enriquecer_rdos_icaro() -> dict[str, Any]:
    resumo: dict[str, Any] = {"removidos": 0, "criados": 0, "por_nucleo": defaultdict(lambda: {"m": 0.0, "un": 0.0, "etapa": 0.0, "rdos": 0})}
    with get_session() as session:
        antigos = session.execute(
            select(RDOApontamento).where(RDOApontamento.servico.like(f"{MARKER}%"))
        ).scalars().all()
        resumo["removidos"] = len(antigos)
        for row in antigos:
            session.delete(row)
        session.flush()

        rdos = session.execute(
            select(RDO).where(RDO.nucleo.in_(NUCLEOS_ICARO)).order_by(RDO.data, RDO.id)
        ).scalars().all()
        for rdo in rdos:
            textos = [rdo.observacoes or ""]
            textos += [a.servico or "" for a in (rdo.apontamentos or []) if not str(a.servico or "").startswith(MARKER)]
            texto = " ".join(textos)
            items = extrair_producao_icaro(texto)
            if items:
                resumo["por_nucleo"][rdo.nucleo]["rdos"] += 1
            for item in items:
                session.add(RDOApontamento(
                    rdo_id=rdo.id,
                    servico=f"{MARKER}: {item['servico']}",
                    quantidade=float(item["quantidade"]),
                    unidade=item["unidade"],
                    dn_mm=int(item.get("dn_mm") or 0) or None,
                    custo_unit=0,
                    custo_total=0,
                ))
                resumo["criados"] += 1
                resumo["por_nucleo"][rdo.nucleo][item["unidade"]] += float(item["quantidade"])
        session.flush()
    resumo["por_nucleo"] = {k: dict(v) for k, v in resumo["por_nucleo"].items()}
    return resumo


if __name__ == "__main__":
    print(enriquecer_rdos_icaro())
