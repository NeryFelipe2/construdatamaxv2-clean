"""Pipeline plugavel para RDO automatico por foto/PDF/texto."""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import Any

from campo.rdo_engine import DEFAULT_ORGANIZATION_ID, RDOEngine
from campo.texto_operacional import parse_texto_operacional
from core.construdata_offline import get_project


class RDOExtractionProvider:
    provider_name = "base"

    def extract(self, path: str, metadata: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError


class DeterministicRDOExtractionProvider(RDOExtractionProvider):
    provider_name = "deterministico_v1"

    def extract(self, path: str, metadata: dict[str, Any]) -> dict[str, Any]:
        texto = (metadata.get("texto") or "").strip()
        campos: dict[str, Any] = {}
        confianca: dict[str, float] = {}

        if texto:
            project = None
            try:
                if metadata.get("project_id"):
                    project = get_project(project_id=metadata["project_id"])
            except Exception:
                project = None
            parsed = parse_texto_operacional(texto, project=project)
            campos.update({
                "data": parsed.get("data"),
                "nucleo": metadata.get("nucleo") or parsed.get("nucleo"),
                "responsavel": metadata.get("responsavel") or parsed.get("responsavel"),
                "observacoes": parsed.get("observacoes"),
                "servicos": parsed.get("producao") or parsed.get("materiais") or [],
                "equipe": parsed.get("equipe") or [],
                "ocorrencias": [{"tipo": "outro", "descricao": item} for item in parsed.get("ocorrencias") or []],
            })
            confianca.update({key: 0.82 for key in campos if campos.get(key)})

        filename = Path(path).stem
        if not campos.get("data"):
            m = re.search(r"(20\d{2})[-_]?(\d{2})[-_]?(\d{2})", filename)
            campos["data"] = f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else (metadata.get("data") or date.today().isoformat())
            confianca["data"] = 0.55 if m else 0.3

        for key in ("nucleo", "responsavel", "local", "empreiteira", "encarregado", "ordem_servico"):
            if metadata.get(key) and not campos.get(key):
                campos[key] = metadata[key]
                confianca[key] = 0.9

        assinatura_presente = bool(metadata.get("assinatura_presente")) or "assin" in (texto + " " + filename).lower()
        pendencias = [
            key for key in ("data", "nucleo", "responsavel")
            if not campos.get(key) or confianca.get(key, 0) < 0.5
        ]
        if not campos.get("servicos"):
            pendencias.append("servicos_quantidades")
        if not assinatura_presente:
            pendencias.append("assinatura")

        return {
            "provider": self.provider_name,
            "campos": campos,
            "confianca": confianca,
            "assinatura_presente": assinatura_presente,
            "pendencias": pendencias,
            "raw_text": texto[:5000],
        }


def criar_rdo_automatico(
    caminho: str,
    metadata: dict[str, Any],
    provider: RDOExtractionProvider | None = None,
    engine: RDOEngine | None = None,
) -> dict[str, Any]:
    engine = engine or RDOEngine()
    provider = provider or DeterministicRDOExtractionProvider()
    resultado = provider.extract(caminho, metadata)
    campos = resultado.get("campos") or {}

    rdo = engine.criar_rdo(
        campos.get("data") or metadata.get("data") or date.today().isoformat(),
        campos.get("nucleo") or metadata.get("nucleo") or "REDE",
        campos.get("responsavel") or metadata.get("responsavel") or "Campo",
        metadata.get("clima_manha") or metadata.get("clima") or "",
        metadata.get("clima_tarde") or metadata.get("clima") or "",
        organization_id=metadata.get("organization_id") or DEFAULT_ORGANIZATION_ID,
        project_id=metadata.get("project_id") or "",
        ordem_servico=campos.get("ordem_servico") or metadata.get("ordem_servico") or "",
        local=campos.get("local") or metadata.get("local") or "",
        empreiteira=campos.get("empreiteira") or metadata.get("empreiteira") or "",
        encarregado=campos.get("encarregado") or metadata.get("encarregado") or "",
        origem="automatico",
        status_revisao="em_revisao" if resultado.get("pendencias") else "extraido",
        assinatura_presente=bool(resultado.get("assinatura_presente")),
        observacoes=campos.get("observacoes") or "RDO automatico aguardando revisao.",
        force_new=True,
    )
    rdo_id = int(rdo["id"])

    evidencia = engine.registrar_evidencia(
        rdo_id=rdo_id,
        caminho=caminho,
        tipo=metadata.get("tipo") or "documento_original",
        origem="rdo_automatico",
        nome_arquivo=metadata.get("nome_arquivo") or Path(caminho).name,
        mime_type=metadata.get("mime_type") or "",
        usuario=metadata.get("usuario") or metadata.get("responsavel") or "",
        assinatura_presente=bool(resultado.get("assinatura_presente")),
        metadados=metadata,
    )
    extracao = engine.registrar_extracao(rdo_id, int(evidencia["id"]), provider.provider_name, resultado)

    payload_revisao = {
        "status_revisao": "em_revisao" if resultado.get("pendencias") else "extraido",
        "servicos": campos.get("servicos") or [],
        "equipe": campos.get("equipe") or [],
        "ocorrencias": campos.get("ocorrencias") or [],
    }
    if payload_revisao["servicos"] or payload_revisao["equipe"] or payload_revisao["ocorrencias"]:
        engine.revisar_rdo(rdo_id, payload_revisao)

    return {
        "rdo": engine.obter_rdo(rdo_id),
        "evidencia": evidencia,
        "extracao": extracao,
        "resultado_extracao": resultado,
    }
