"""Bot conversacional de campo via WhatsApp/Evolution API."""
from __future__ import annotations

import base64
import json
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select

from campo.rdo_engine import RDOEngine
from core.config import FOTOS_DIR
from core.database import get_session
from core.models import NS, StatusNS, WhatsAppSession
from motor_gemini import analisar_foto_para_rdo

try:  # pragma: no cover - dependencia opcional
    import evolutionapi as _evolutionapi  # type: ignore
except Exception:  # pragma: no cover - dependencia opcional
    _evolutionapi = None

NUCLEOS_PADRAO = [
    "Verde e Teteu",
    "Pantanal",
    "Criadores",
    "Sao Manoel",
    "Israel",
]
NUCLEO_ALIASES = {
    "verde e teteu": ["Morro do Teteu", "Prol Teteu", "Prol Teteu Alt-01"],
    "pantanal": ["Pantanal Baixo", "Prol Pantanal Baixo"],
    "criadores": ["Vila Criadores", "Prol Criadores"],
    "sao manoel": ["Sao Manoel", "Prol Sao Manoel"],
    "israel": ["Vila Israel"],
}
SERVICOS_PADRAO = [
    "Escavacao",
    "Assentamento tubo",
    "Reaterro",
    "Recomposicao pavimento",
    "Ligacao predial",
    "Montagem PV",
    "Teste estanqueidade",
]
DNS_PADRAO = ["DN100", "DN150", "DN200", "DN300", "DN400"]
ESTADOS_EQUIPE = ("EQUIPE_ENCANADORES", "EQUIPE_AJUDANTES", "EQUIPE_OPERADORES")


def _slug(text: str) -> str:
    texto = unicodedata.normalize("NFKD", str(text or ""))
    return texto.encode("ascii", "ignore").decode("ascii").lower().strip()


class WhatsAppBot:
    """State machine de apontamento de campo persistido em SQLite."""

    def __init__(self, engine: RDOEngine | None = None, evolution_client: Any = None):
        self.engine = engine or RDOEngine()
        self.evolution_client = evolution_client
        self.fotos_dir = Path(FOTOS_DIR)
        self.fotos_dir.mkdir(parents=True, exist_ok=True)

    def process_webhook(self, payload: dict[str, Any]) -> dict[str, Any]:
        mensagem = self._normalizar_payload(payload)
        return self.process_message(
            telefone=mensagem["telefone"],
            texto=mensagem.get("texto", ""),
            media_path=mensagem.get("media_path"),
            media_url=mensagem.get("media_url"),
            metadata={"payload": payload, "tipo": mensagem.get("tipo")},
        )

    def process_message(
        self,
        telefone: str,
        texto: str = "",
        media_path: str | None = None,
        media_url: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Processa uma mensagem normalizada e devolve a resposta."""
        telefone = str(telefone or "").strip()
        texto = (texto or "").strip()
        session_row = self._get_or_create_session(telefone)
        estado = session_row.estado or "IDLE"
        contexto = self._load_context(session_row)
        metadata = metadata or {}

        if media_url and not media_path:
            media_path = media_url

        if estado == "IDLE":
            resposta, proximo = self._estado_idle()
        elif estado == "SELECAO_NUCLEO":
            resposta, proximo = self._estado_selecao_nucleo(texto, contexto)
        elif estado == "SELECAO_NS":
            resposta, proximo = self._estado_selecao_ns(texto, contexto)
        elif estado == "SERVICO":
            resposta, proximo = self._estado_servico(texto, contexto)
        elif estado == "QUANTIDADE":
            resposta, proximo = self._estado_quantidade(texto, contexto)
        elif estado == "DN":
            resposta, proximo = self._estado_dn(texto, contexto)
        elif estado == "FOTO":
            resposta, proximo = self._estado_foto(media_path, contexto)
        elif estado == "MAIS_SERVICOS":
            resposta, proximo = self._estado_mais_servicos(texto)
        elif estado == "OUTRA_NS":
            resposta, proximo = self._estado_outra_ns(texto)
        elif estado in ESTADOS_EQUIPE:
            resposta, proximo = self._estado_equipe(estado, texto, contexto)
        elif estado == "OCORRENCIA":
            resposta, proximo = self._estado_ocorrencia(texto, contexto)
        elif estado == "OCORRENCIA_DESC":
            resposta, proximo = self._estado_ocorrencia_desc(texto, contexto)
        else:
            resposta, proximo = self._estado_idle()

        self._save_session(session_row, proximo, contexto, texto)
        return {
            "reply": resposta,
            "state": proximo,
            "telefone": telefone,
            "session": self._public_context(contexto),
            "metadata": metadata,
        }

    def _estado_idle(self) -> tuple[str, str]:
        return (
            "Bom dia! Qual nucleo?\n"
            + "\n".join(f"{i + 1}. {nucleo}" for i, nucleo in enumerate(NUCLEOS_PADRAO)),
            "SELECAO_NUCLEO",
        )

    def _estado_selecao_nucleo(self, texto: str, contexto: dict[str, Any]) -> tuple[str, str]:
        nucleo_alias = self._parse_nucleo(texto)
        if not nucleo_alias:
            return "Nucleo nao reconhecido. Escolha um dos nucleos listados.", "SELECAO_NUCLEO"

        nucleos_db = self._resolver_nucleos_db(nucleo_alias)
        lista_ns = self._listar_ns_disponiveis(nucleos_db)
        if not lista_ns:
            return f"Nao encontrei NS disponiveis para {nucleo_alias}.", "SELECAO_NUCLEO"

        nucleo_rdo = nucleos_db[0] if len(nucleos_db) == 1 else nucleo_alias
        rdo = self.engine.criar_rdo(str(date.today()), nucleo_rdo, responsavel=contexto.get("responsavel") or "Campo")

        contexto["nucleo"] = nucleo_rdo
        contexto["nucleo_alias"] = nucleo_alias
        contexto["nucleos_db"] = nucleos_db
        contexto["rdo_id"] = rdo["id"]
        contexto.setdefault("itens_dia", [])
        contexto.setdefault("equipe", {})
        contexto.setdefault("equipe_salva", False)
        contexto["ns_disponiveis"] = lista_ns

        opcoes = "\n".join(
            f"{i + 1}. {item['codigo']} | {item['nucleo']} | {item['pv_ini']} -> {item['pv_fim']}"
            for i, item in enumerate(lista_ns[:20])
        )
        return f"Qual NS?\n{opcoes}", "SELECAO_NS"

    def _estado_selecao_ns(self, texto: str, contexto: dict[str, Any]) -> tuple[str, str]:
        ns_obj = self._resolver_ns_da_lista(texto, contexto.get("ns_disponiveis", []))
        if not ns_obj:
            ns_obj = self._resolver_ns(texto, contexto.get("nucleos_db") or contexto.get("nucleo"))
        if not ns_obj:
            return "NS nao reconhecida. Informe no formato NS_001 ou 1.", "SELECAO_NS"
        contexto["ns_id"] = ns_obj.id
        contexto["ns_codigo"] = f"NS_{ns_obj.seq:03d}"
        contexto["ns_ref"] = ns_obj.to_dict()
        return f"Servico executado?\n{' | '.join(SERVICOS_PADRAO)}", "SERVICO"

    def _estado_servico(self, texto: str, contexto: dict[str, Any]) -> tuple[str, str]:
        servico = self._parse_servico(texto)
        if not servico:
            return "Servico nao reconhecido. Escolha um servico padrao.", "SERVICO"
        contexto["servico"] = servico
        unidade = "unidades" if any(token in _slug(servico) for token in ("montagem", "ligacao")) else "metros"
        return f"Quantos {unidade}?", "QUANTIDADE"

    def _estado_quantidade(self, texto: str, contexto: dict[str, Any]) -> tuple[str, str]:
        quantidade = self._parse_float(texto)
        if quantidade is None:
            return "Quantidade invalida. Informe um numero.", "QUANTIDADE"
        contexto["quantidade"] = quantidade
        return f"DN?\n{' | '.join(DNS_PADRAO)}", "DN"

    def _estado_dn(self, texto: str, contexto: dict[str, Any]) -> tuple[str, str]:
        dn = self._parse_dn(texto)
        if dn is None:
            return "DN invalido. Escolha entre DN100, DN150, DN200, DN300 ou DN400.", "DN"
        contexto["dn_mm"] = dn
        return "Mande uma foto do servico.", "FOTO"

    def _estado_foto(self, media_path: str | None, contexto: dict[str, Any]) -> tuple[str, str]:
        if not media_path:
            return "Foto nao recebida. Envie uma foto para continuar.", "FOTO"

        legenda = analisar_foto_para_rdo(media_path).get("legenda_rdo", "Foto de campo")
        apontamento = self.engine.adicionar_apontamento(
            rdo_id=int(contexto["rdo_id"]),
            ns_id=int(contexto["ns_id"]),
            servico=contexto["servico"],
            quantidade=float(contexto["quantidade"]),
            unidade="un" if any(token in _slug(contexto["servico"]) for token in ("montagem", "ligacao")) else "m",
            dn_mm=int(contexto["dn_mm"]),
        )
        self.engine.adicionar_foto(
            rdo_id=int(contexto["rdo_id"]),
            caminho=media_path,
            legenda=legenda,
            ns_id=int(contexto["ns_id"]),
        )
        contexto.setdefault("itens_dia", []).append(
            {
                "ns_codigo": contexto["ns_codigo"],
                "servico": contexto["servico"],
                "quantidade": contexto["quantidade"],
                "dn_mm": contexto["dn_mm"],
                "custo_total": apontamento.get("custo_total", 0),
                "legenda": legenda,
            }
        )
        return f"Foto recebida! Legenda: {legenda}\nMais servicos nesta NS? [Sim/Nao]", "MAIS_SERVICOS"

    def _estado_mais_servicos(self, texto: str) -> tuple[str, str]:
        if self._is_yes(texto):
            return "Servico executado?", "SERVICO"
        if self._is_no(texto):
            return "Outra NS? [Sim/Nao]", "OUTRA_NS"
        return "Responda Sim ou Nao.", "MAIS_SERVICOS"

    def _estado_outra_ns(self, texto: str) -> tuple[str, str]:
        if self._is_yes(texto):
            return "Qual NS?", "SELECAO_NS"
        if self._is_no(texto):
            return "Equipe hoje? Quantos encanadores?", "EQUIPE_ENCANADORES"
        return "Responda Sim ou Nao.", "OUTRA_NS"

    def _estado_equipe(self, estado: str, texto: str, contexto: dict[str, Any]) -> tuple[str, str]:
        quantidade = self._parse_int(texto)
        if quantidade is None:
            return "Informe um numero inteiro.", estado

        equipe = contexto.setdefault("equipe", {})
        if estado == "EQUIPE_ENCANADORES":
            equipe["Encanador"] = quantidade
            return "Ajudantes?", "EQUIPE_AJUDANTES"
        if estado == "EQUIPE_AJUDANTES":
            equipe["Ajudante"] = quantidade
            return "Operadores?", "EQUIPE_OPERADORES"

        equipe["Operador"] = quantidade
        if not contexto.get("equipe_salva"):
            for funcao, qtd in equipe.items():
                self.engine.adicionar_equipe(int(contexto["rdo_id"]), funcao, int(qtd))
            contexto["equipe_salva"] = True
        return "Alguma ocorrencia? [Nenhuma/Parada/Chuva/Acidente/Falta material]", "OCORRENCIA"

    def _estado_ocorrencia(self, texto: str, contexto: dict[str, Any]) -> tuple[str, str]:
        escolha = _slug(texto)
        if escolha in ("nenhuma", "nao"):
            return self._montar_resumo_final(contexto), "IDLE"

        tipo = {
            "parada": "parada",
            "chuva": "chuva",
            "acidente": "acidente",
            "falta material": "material",
            "material": "material",
        }.get(escolha)
        if not tipo:
            return "Ocorrencia nao reconhecida. Escolha Nenhuma, Parada, Chuva, Acidente ou Falta material.", "OCORRENCIA"
        contexto["ocorrencia_tipo"] = tipo
        return "Descreva a ocorrencia.", "OCORRENCIA_DESC"

    def _estado_ocorrencia_desc(self, texto: str, contexto: dict[str, Any]) -> tuple[str, str]:
        descricao = texto or "Ocorrencia informada pelo campo."
        self.engine.adicionar_ocorrencia(
            int(contexto["rdo_id"]),
            contexto.get("ocorrencia_tipo", "outro"),
            descricao,
            ns_id=int(contexto["ns_id"]) if contexto.get("ns_id") else None,
        )
        return self._montar_resumo_final(contexto, descricao), "IDLE"

    def _montar_resumo_final(self, contexto: dict[str, Any], descricao_ocorrencia: str | None = None) -> str:
        itens = contexto.get("itens_dia", [])
        linhas = []
        for item in itens:
            linhas.append(
                f"{item['ns_codigo']}: {item['servico']} DN{item['dn_mm']} - "
                f"{item['quantidade']} - R$ {item['custo_total']:,.2f}"
            )
        equipe = contexto.get("equipe", {})
        equipe_txt = (
            f"{equipe.get('Encanador', 0)} enc + {equipe.get('Ajudante', 0)} aj + {equipe.get('Operador', 0)} op"
        )
        rdo_id = int(contexto["rdo_id"])
        try:
            rdo_fechado = self.engine.fechar_rdo(rdo_id)
            total = rdo_fechado.get("total_custo", 0)
        except Exception:
            total = self.engine.calcular_custo_dia(rdo_id)
        if descricao_ocorrencia:
            linhas.append(f"Ocorrencia: {descricao_ocorrencia}")
        linhas.append(f"Equipe: {equipe_txt}")
        linhas.append(f"Total dia: R$ {total:,.2f}")
        contexto["ocorrencia_tipo"] = None
        return "RDO registrado! Resumo:\n" + "\n".join(linhas)

    def _get_or_create_session(self, telefone: str) -> WhatsAppSession:
        with get_session() as session:
            row = session.execute(
                select(WhatsAppSession).where(WhatsAppSession.telefone == telefone)
            ).scalar_one_or_none()
            if row is None:
                row = WhatsAppSession(telefone=telefone, estado="IDLE", contexto_json="{}")
                session.add(row)
                session.flush()
                row_id = row.id
            else:
                row_id = row.id
        with get_session() as session:
            return session.get(WhatsAppSession, row_id)

    def _load_context(self, session_row: WhatsAppSession) -> dict[str, Any]:
        try:
            return json.loads(session_row.contexto_json or "{}")
        except Exception:
            return {}

    def _save_session(
        self,
        session_row: WhatsAppSession,
        estado: str,
        contexto: dict[str, Any],
        ultima_mensagem: str,
    ) -> None:
        if estado == "IDLE":
            contexto.pop("servico", None)
            contexto.pop("quantidade", None)
            contexto.pop("dn_mm", None)
            contexto.pop("ocorrencia_tipo", None)
        with get_session() as session:
            row = session.get(WhatsAppSession, session_row.id)
            row.estado = estado
            row.nucleo = contexto.get("nucleo")
            row.rdo_id = contexto.get("rdo_id")
            row.ns_id = contexto.get("ns_id")
            row.contexto_json = json.dumps(contexto, ensure_ascii=False)
            row.ultima_mensagem = ultima_mensagem
            row.atualizado_em = datetime.now()

    def _public_context(self, contexto: dict[str, Any]) -> dict[str, Any]:
        return {
            "nucleo": contexto.get("nucleo"),
            "nucleo_alias": contexto.get("nucleo_alias"),
            "nucleos_db": contexto.get("nucleos_db", []),
            "rdo_id": contexto.get("rdo_id"),
            "ns_id": contexto.get("ns_id"),
            "ns_codigo": contexto.get("ns_codigo"),
            "itens_dia": contexto.get("itens_dia", []),
            "equipe": contexto.get("equipe", {}),
        }

    def _listar_ns_disponiveis(self, nucleo: str | list[str]) -> list[dict[str, Any]]:
        nucleos = [nucleo] if isinstance(nucleo, str) else [item for item in nucleo if item]
        if not nucleos:
            return []
        with get_session() as session:
            rows = session.execute(
                select(NS)
                .where(
                    NS.nucleo.in_(nucleos),
                    NS.status.in_([StatusNS.PLANEJADA, StatusNS.EM_EXECUCAO]),
                )
                .order_by(NS.nucleo, NS.seq)
            ).scalars().all()
            return [
                {
                    "id": row.id,
                    "codigo": f"NS_{row.seq:03d}",
                    "pv_ini": row.pv_ini,
                    "pv_fim": row.pv_fim,
                    "status": row.status.value,
                    "nucleo": row.nucleo,
                }
                for row in rows
            ]

    def _resolver_ns(self, texto: str, nucleo: str | list[str] | None) -> NS | None:
        digits = "".join(ch for ch in str(texto) if ch.isdigit())
        seq = self._parse_int(digits or texto)
        if seq is None:
            return None
        nucleos = [nucleo] if isinstance(nucleo, str) else [item for item in (nucleo or []) if item]
        with get_session() as session:
            stmt = select(NS).where(NS.seq == seq)
            if nucleos:
                stmt = stmt.where(NS.nucleo.in_(nucleos))
            return session.execute(stmt.order_by(NS.id)).scalars().first()

    def _resolver_ns_da_lista(self, texto: str, opcoes: list[dict[str, Any]]) -> NS | None:
        if not opcoes:
            return None

        idx = self._parse_int(texto)
        if idx is not None and 1 <= idx <= len(opcoes):
            ns_id = opcoes[idx - 1].get("id")
            if ns_id:
                with get_session() as session:
                    return session.get(NS, int(ns_id))

        digits = "".join(ch for ch in str(texto) if ch.isdigit())
        seq = self._parse_int(digits)
        if seq is None:
            return None

        codigo = f"NS_{seq:03d}"
        candidatos = [item for item in opcoes if item.get("codigo") == codigo]
        if not candidatos:
            return None
        with get_session() as session:
            return session.get(NS, int(candidatos[0]["id"]))

    def _resolver_nucleos_db(self, nucleo_alias: str) -> list[str]:
        alvo = _slug(nucleo_alias)
        with get_session() as session:
            disponiveis = session.execute(select(NS.nucleo).distinct().order_by(NS.nucleo)).scalars().all()
        disponiveis = [item for item in disponiveis if item]
        mapa = {_slug(nome): nome for nome in disponiveis}
        if alvo in mapa:
            return [mapa[alvo]]

        candidatos = [nome for nome in NUCLEO_ALIASES.get(alvo, []) if nome in disponiveis]
        if candidatos:
            return candidatos

        for nome in disponiveis:
            nome_slug = _slug(nome)
            if alvo in nome_slug or nome_slug in alvo:
                candidatos.append(nome)
        return candidatos or [nucleo_alias]

    def _parse_nucleo(self, texto: str) -> str | None:
        if not texto:
            return None
        texto_slug = _slug(texto)
        if texto_slug.isdigit():
            idx = int(texto_slug) - 1
            return NUCLEOS_PADRAO[idx] if 0 <= idx < len(NUCLEOS_PADRAO) else None
        for nucleo in NUCLEOS_PADRAO:
            nucleo_slug = _slug(nucleo)
            if texto_slug == nucleo_slug or texto_slug in nucleo_slug or nucleo_slug in texto_slug:
                return nucleo
        return None

    def _parse_servico(self, texto: str) -> str | None:
        texto_slug = _slug(texto)
        for servico in SERVICOS_PADRAO:
            servico_slug = _slug(servico)
            if texto_slug == servico_slug or texto_slug in servico_slug:
                return servico
        return None

    def _parse_dn(self, texto: str) -> int | None:
        digits = "".join(ch for ch in str(texto) if ch.isdigit())
        return self._parse_int(digits)

    def _parse_int(self, texto: Any) -> int | None:
        try:
            return int(float(str(texto).replace(",", ".")))
        except Exception:
            return None

    def _parse_float(self, texto: Any) -> float | None:
        try:
            return float(str(texto).replace(",", "."))
        except Exception:
            return None

    def _is_yes(self, texto: str) -> bool:
        return _slug(texto) in ("sim", "s", "yes", "y")

    def _is_no(self, texto: str) -> bool:
        return _slug(texto) in ("nao", "n")

    def _normalizar_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        message = data.get("message") if isinstance(data.get("message"), dict) else data
        telefone = (
            data.get("key", {}).get("remoteJid")
            or data.get("from")
            or data.get("sender")
            or payload.get("sender")
            or "desconhecido"
        )
        telefone = str(telefone).split("@")[0]

        texto = (
            data.get("text")
            or message.get("conversation")
            or message.get("text", {}).get("text")
            or message.get("extendedTextMessage", {}).get("text")
            or ""
        )
        media_path = None
        media_url = data.get("mediaUrl") or data.get("url")
        if data.get("mediaBase64"):
            media_path = self._salvar_media_base64(telefone, data["mediaBase64"], data.get("mimetype", "image/jpeg"))
        elif data.get("base64"):
            media_path = self._salvar_media_base64(telefone, data["base64"], data.get("mimetype", "image/jpeg"))

        tipo = data.get("messageType") or payload.get("event") or ("image" if media_url or media_path else "text")
        return {
            "telefone": telefone,
            "texto": texto,
            "media_path": media_path,
            "media_url": media_url,
            "tipo": tipo,
        }

    def _salvar_media_base64(self, telefone: str, media_base64: str, mime_type: str) -> str:
        if "," in media_base64 and media_base64.strip().startswith("data:"):
            media_base64 = media_base64.split(",", 1)[1]
        extensao = {
            "image/png": ".png",
            "image/webp": ".webp",
            "image/jpeg": ".jpg",
        }.get(mime_type, ".jpg")
        nome = f"{telefone}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{extensao}"
        caminho = self.fotos_dir / nome
        caminho.write_bytes(base64.b64decode(media_base64))
        return str(caminho)


__all__ = ["WhatsAppBot", "NUCLEOS_PADRAO", "SERVICOS_PADRAO", "_evolutionapi"]
