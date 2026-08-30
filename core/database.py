"""Camada de persistencia SQLite/PostgreSQL da plataforma ConstruData."""
from __future__ import annotations

import json
import os
from collections import defaultdict
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Generator

from sqlalchemy import create_engine, func, inspect, select
from sqlalchemy.orm import Session, selectinload, sessionmaker

from core.config import CONSOLIDADO_NS_PATH, CRONOGRAMA_DIR, DATABASE_URL, PROJECT_ROOT, ensure_runtime_dirs
from core.models import (
    Base,
    CHECKLIST_PADRAO,
    ChecklistNS,
    NS,
    PV,
    RDO,
    RDOApontamento,
    RDOFoto,
    StatusNS,
    Trecho,
    WhatsAppSession,
)

ensure_runtime_dirs()

_engine = None
_SessionLocal = None
_bootstrapped = False


def _get_engine():
    global _engine
    if _engine is None:
        if DATABASE_URL.startswith("sqlite"):
            connect_args = {"check_same_thread": False}
        else:
            timeout_seconds = int(os.environ.get("DATABASE_CONNECT_TIMEOUT_SECONDS", "5"))
            connect_args = {"connect_timeout": timeout_seconds}
        _engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True, echo=False)
    return _engine


def _get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=_get_engine(), expire_on_commit=False, future=True)
    return _SessionLocal


def _ensure_sqlite_columns() -> None:
    """Aplica migracoes simples no SQLite sem depender de Alembic."""
    engine = _get_engine()
    if not DATABASE_URL.startswith("sqlite"):
        return
    inspector = inspect(engine)
    if not inspector.has_table("ns"):
        return

    desired_columns = {
        "ns": {
            "caminho_json": "TEXT",
            "nome_arquivo": "TEXT",
            "origem_dados": "TEXT",
        },
        "pv": {
            "material": "TEXT",
            "is_agua": "BOOLEAN DEFAULT 0",
        },
    }
    with engine.begin() as conn:
        for table_name, columns in desired_columns.items():
            existing = {col["name"] for col in inspector.get_columns(table_name)}
            for column_name, sql_type in columns.items():
                if column_name not in existing:
                    conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {sql_type}")


def criar_banco() -> None:
    """Cria tabelas e aplica migracoes simples."""
    Base.metadata.create_all(bind=_get_engine())
    _ensure_sqlite_columns()


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Context manager de sessao SQLAlchemy."""
    session = _get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _coerce_float(value: Any) -> float | None:
    if value in (None, "", "-"):
        return None
    try:
        return float(str(value).replace(",", "."))
    except Exception:
        return None


def _coerce_int(value: Any) -> int | None:
    if value in (None, "", "-"):
        return None
    try:
        return int(float(str(value).replace(",", ".")))
    except Exception:
        return None


def _status_from_legacy(value: str | None) -> StatusNS:
    raw = str(value or "PLANEJADA").strip().upper()
    mapping = {
        "PLANEJADO": StatusNS.PLANEJADA,
        "PLANEJADA": StatusNS.PLANEJADA,
        "EXECUTADO": StatusNS.EM_EXECUCAO,
        "EM_EXECUCAO": StatusNS.EM_EXECUCAO,
        "CONCLUIDA": StatusNS.CONCLUIDA,
        "CADASTRADO": StatusNS.CONCLUIDA,
        "MEDIDO": StatusNS.MEDIDA,
        "MEDIDA": StatusNS.MEDIDA,
        "BLOQUEADO": StatusNS.BLOQUEADA,
        "BLOQUEADA": StatusNS.BLOQUEADA,
    }
    return mapping.get(raw, StatusNS.PLANEJADA)


def _deduzir_tipo_agua(material: str | None, is_agua: Any = None) -> bool:
    if is_agua is not None:
        return bool(is_agua)
    material_upper = (material or "").upper()
    return any(token in material_upper for token in ("PEAD", "PPR", "FFD", "FOFO", "AGUA"))


def _normalizar_nucleo(value: str | None, fallback: str = "REDE") -> str:
    raw = (value or fallback or "REDE").strip()
    return raw if raw else fallback


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _ensure_checklist(session: Session, ns_obj: NS) -> None:
    if ns_obj.checklist:
        return
    for item in CHECKLIST_PADRAO:
        session.add(ChecklistNS(ns_id=ns_obj.id, item=item, concluido=False))


def _buscar_ns_existente(session: Session, nucleo: str, seq: int | None, pv_ini: str, pv_fim: str) -> NS | None:
    if seq:
        existente = session.execute(select(NS).where(NS.nucleo == nucleo, NS.seq == seq)).scalar_one_or_none()
        if existente:
            return existente
    return session.execute(
        select(NS).where(NS.nucleo == nucleo, NS.pv_ini == pv_ini, NS.pv_fim == pv_fim)
    ).scalar_one_or_none()


def _atualizar_ns_do_payload(ns_obj: NS, payload: dict[str, Any]) -> None:
    ns_obj.seq = payload.get("seq") or ns_obj.seq
    ns_obj.nucleo = payload.get("nucleo") or ns_obj.nucleo
    ns_obj.pv_ini = payload.get("pv_ini") or ns_obj.pv_ini
    ns_obj.pv_fim = payload.get("pv_fim") or ns_obj.pv_fim
    ns_obj.ext_m = payload.get("ext_m") if payload.get("ext_m") is not None else ns_obj.ext_m
    ns_obj.dn_mm = payload.get("dn_mm") if payload.get("dn_mm") is not None else ns_obj.dn_mm
    ns_obj.material = payload.get("material") or ns_obj.material
    ns_obj.rua = payload.get("rua") or ns_obj.rua
    ns_obj.status = payload.get("status") or ns_obj.status
    ns_obj.data_inicio = payload.get("data_inicio") or ns_obj.data_inicio
    ns_obj.data_fim = payload.get("data_fim") or ns_obj.data_fim
    ns_obj.custo_previsto = payload.get("custo_previsto") if payload.get("custo_previsto") is not None else ns_obj.custo_previsto
    ns_obj.custo_realizado = payload.get("custo_realizado") if payload.get("custo_realizado") is not None else ns_obj.custo_realizado
    ns_obj.ct_ini_real = payload.get("ct_ini_real") if payload.get("ct_ini_real") is not None else ns_obj.ct_ini_real
    ns_obj.cf_ini_real = payload.get("cf_ini_real") if payload.get("cf_ini_real") is not None else ns_obj.cf_ini_real
    ns_obj.ct_fim_real = payload.get("ct_fim_real") if payload.get("ct_fim_real") is not None else ns_obj.ct_fim_real
    ns_obj.cf_fim_real = payload.get("cf_fim_real") if payload.get("cf_fim_real") is not None else ns_obj.cf_fim_real
    ns_obj.cadastro_ok = payload.get("cadastro_ok", ns_obj.cadastro_ok)
    ns_obj.caminho_json = payload.get("caminho_json") or ns_obj.caminho_json
    ns_obj.nome_arquivo = payload.get("nome_arquivo") or ns_obj.nome_arquivo
    ns_obj.origem_dados = payload.get("origem_dados") or ns_obj.origem_dados


def upsert_ns_com_relacoes(
    session: Session,
    ns_payload: dict[str, Any],
    pv_montante: dict[str, Any] | None = None,
    pv_jusante: dict[str, Any] | None = None,
    trecho_payload: dict[str, Any] | None = None,
) -> NS:
    """Insere/atualiza NS, PVs e trecho associado."""
    nucleo = _normalizar_nucleo(ns_payload.get("nucleo"))
    seq = _coerce_int(ns_payload.get("seq"))
    pv_ini = str(ns_payload.get("pv_ini") or "")
    pv_fim = str(ns_payload.get("pv_fim") or "")
    existente = _buscar_ns_existente(session, nucleo, seq, pv_ini, pv_fim)

    if existente is None:
        existente = NS(
            seq=seq or 0,
            nucleo=nucleo,
            pv_ini=pv_ini,
            pv_fim=pv_fim,
            status=ns_payload.get("status") or StatusNS.PLANEJADA,
        )
        session.add(existente)
        session.flush()

    _atualizar_ns_do_payload(existente, ns_payload)

    if trecho_payload:
        trecho = session.execute(select(Trecho).where(Trecho.ns_id == existente.id)).scalar_one_or_none()
        if trecho is None:
            trecho = Trecho(ns_id=existente.id, pv_ini=pv_ini, pv_fim=pv_fim)
            session.add(trecho)
        trecho.pv_ini = trecho_payload.get("pv_ini") or pv_ini
        trecho.pv_fim = trecho_payload.get("pv_fim") or pv_fim
        trecho.ext_m = _coerce_float(trecho_payload.get("ext_m"))
        trecho.dn_mm = _coerce_int(trecho_payload.get("dn_mm"))
        trecho.material = trecho_payload.get("material")
        trecho.decl_mm = _coerce_float(trecho_payload.get("decl_mm"))
        trecho.ct_ini = _coerce_float(trecho_payload.get("ct_ini"))
        trecho.cf_ini = _coerce_float(trecho_payload.get("cf_ini"))
        trecho.ct_fim = _coerce_float(trecho_payload.get("ct_fim"))
        trecho.cf_fim = _coerce_float(trecho_payload.get("cf_fim"))

    for nome, dados in ((pv_ini, pv_montante or {}), (pv_fim, pv_jusante or {})):
        if not nome:
            continue
        pv = session.execute(select(PV).where(PV.ns_id == existente.id, PV.nome == nome)).scalar_one_or_none()
        if pv is None:
            pv = PV(ns_id=existente.id, nome=nome)
            session.add(pv)
        pv.x = _coerce_float(dados.get("x"))
        pv.y = _coerce_float(dados.get("y"))
        pv.lat = _coerce_float(dados.get("lat"))
        pv.lon = _coerce_float(dados.get("lon"))
        pv.ct = _coerce_float(dados.get("ct"))
        pv.cf = _coerce_float(dados.get("cf"))
        pv.prof = _coerce_float(dados.get("prof"))
        pv.tipo = dados.get("tipo") or ("PI" if nome.upper().startswith("PI") else "PV")
        pv.material = dados.get("material") or (trecho_payload.get("material") if trecho_payload else None)
        pv.is_agua = _deduzir_tipo_agua(pv.material, dados.get("is_agua"))

    session.flush()
    _ensure_checklist(session, existente)
    return existente


def importar_ns_json_arquivo(path: str | Path, nucleo_fallback: str = "") -> int:
    """Importa um arquivo ``*DADOS.json`` no formato da NS legacy."""
    json_path = Path(path)
    if not json_path.exists():
        return 0
    try:
        payload = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return 0

    trecho = payload.get("trecho", {})
    ns_payload = {
        "seq": _coerce_int(payload.get("ns_id")),
        "nucleo": _normalizar_nucleo(payload.get("nucleo"), nucleo_fallback or json_path.parent.parent.name),
        "pv_ini": trecho.get("pv_ini") or payload.get("pv_ini"),
        "pv_fim": trecho.get("pv_fim") or payload.get("pv_fim"),
        "ext_m": _coerce_float(trecho.get("ext_m")),
        "dn_mm": _coerce_int(trecho.get("dn_mm")),
        "material": trecho.get("material"),
        "rua": trecho.get("rua"),
        "status": StatusNS.PLANEJADA,
        "custo_previsto": _coerce_float(trecho.get("c")) or _coerce_float(payload.get("custo_previsto")),
        "caminho_json": str(json_path),
        "nome_arquivo": json_path.name,
        "origem_dados": "DADOS_JSON",
    }
    pv_montante = payload.get("pv_montante") or {}
    pv_jusante = payload.get("pv_jusante") or {}

    with get_session() as session:
        upsert_ns_com_relacoes(session, ns_payload, pv_montante, pv_jusante, trecho)
    return 1


def importar_status_ns_json(path_ou_dict: str | Path | dict[str, Any], nucleo: str = "") -> int:
    """Migra ``STATUS_NS.json`` legado para o banco."""
    criar_banco()
    if isinstance(path_ou_dict, (str, Path)):
        data = json.loads(Path(path_ou_dict).read_text(encoding="utf-8"))
    else:
        data = dict(path_ou_dict)

    notas = data.get("notas", {})
    importadas = 0
    with get_session() as session:
        for _, nota in notas.items():
            ns_payload = {
                "seq": _coerce_int(nota.get("ns_id")),
                "nucleo": _normalizar_nucleo(data.get("nucleo"), nucleo),
                "pv_ini": nota.get("pv_ini"),
                "pv_fim": nota.get("pv_fim"),
                "ext_m": _coerce_float(nota.get("ext_m")),
                "dn_mm": _coerce_int(nota.get("dn_mm")),
                "material": nota.get("material"),
                "rua": nota.get("rua"),
                "status": _status_from_legacy(nota.get("status")),
                "data_inicio": _parse_date(nota.get("execucao", {}).get("data_inicio")),
                "data_fim": _parse_date(nota.get("execucao", {}).get("data_fim")),
                "custo_realizado": _coerce_float(nota.get("medicao", {}).get("valor_liberado")),
                "ct_ini_real": _coerce_float(nota.get("campo_real", {}).get("ct_ini_real")),
                "cf_ini_real": _coerce_float(nota.get("campo_real", {}).get("cf_ini_real")),
                "ct_fim_real": _coerce_float(nota.get("campo_real", {}).get("ct_fim_real")),
                "cf_fim_real": _coerce_float(nota.get("campo_real", {}).get("cf_fim_real")),
                "cadastro_ok": bool(nota.get("cadastro", {}).get("ok")),
                "origem_dados": "STATUS_NS",
            }
            upsert_ns_com_relacoes(session, ns_payload)
            importadas += 1
    return importadas


def _resolver_json_da_ns(item: dict[str, Any]) -> Path | None:
    caminho_completo = item.get("caminho_completo")
    if caminho_completo:
        try:
            pasta = Path(caminho_completo)
            if pasta.exists():
                for nome in item.get("arquivos", []):
                    if str(nome).lower().endswith(".json"):
                        json_path = pasta / nome
                        if json_path.exists():
                            return json_path
                encontrados = sorted(pasta.glob("*.json"))
                if encontrados:
                    return encontrados[0]
        except (OSError, ValueError):
            pass
    return None


def importar_consolidado_notas_servico(path: str | Path = CONSOLIDADO_NS_PATH) -> int:
    """Migra o consolidado de NS usando os ``DADOS.json`` reais."""
    try:
        consolidado_path = Path(path)
        if not consolidado_path.exists():
            return 0
    except (OSError, ValueError):
        return 0

    try:
        data = json.loads(consolidado_path.read_text(encoding="utf-8"))
    except Exception:
        return 0
    total = 0
    for item in data.get("notas_servico", []):
        try:
            json_path = _resolver_json_da_ns(item)
            nucleo_fallback = item.get("bairro") or "REDE"
            if json_path:
                total += importar_ns_json_arquivo(json_path, nucleo_fallback=nucleo_fallback)
        except (OSError, ValueError):
            continue
    return total


def importar_pvs_trechos(pvs: dict[str, Any], trechos: list[dict[str, Any]], nucleo: str) -> int:
    """Importa a estrutura interna ``pvs``/``trechos`` no banco."""
    criar_banco()
    total = 0
    with get_session() as session:
        for idx, trecho in enumerate(trechos, start=1):
            pv_ini = str(trecho.get("pv_ini") or trecho.get("no_ini") or "")
            pv_fim = str(trecho.get("pv_fim") or trecho.get("no_fim") or "")
            if not pv_ini or not pv_fim:
                continue
            ns_payload = {
                "seq": idx,
                "nucleo": nucleo,
                "pv_ini": pv_ini,
                "pv_fim": pv_fim,
                "ext_m": _coerce_float(trecho.get("ext_m") or trecho.get("extensao")),
                "dn_mm": _coerce_int(trecho.get("dn_mm") or trecho.get("dn")),
                "material": trecho.get("material"),
                "rua": trecho.get("rua") or trecho.get("logradouro"),
                "status": StatusNS.PLANEJADA,
                "custo_previsto": _coerce_float(trecho.get("custo")),
                "origem_dados": "PVS_TRECHOS",
            }
            pv_montante = pvs.get(pv_ini) or {}
            pv_jusante = pvs.get(pv_fim) or {}
            upsert_ns_com_relacoes(session, ns_payload, pv_montante, pv_jusante, trecho)
            total += 1
    return total


def bootstrap_database(force_import: bool = False) -> dict[str, Any]:
    """Cria o schema e tenta importar a base legacy se o banco estiver vazio."""
    global _bootstrapped
    criar_banco()
    if _bootstrapped and not force_import:
        return {"ok": True, "imported": 0, "reason": "cached"}

    imported = 0
    with get_session() as session:
        count_ns = session.execute(select(func.count(NS.id))).scalar_one()
    if count_ns == 0 or force_import:
        imported += importar_consolidado_notas_servico()
        if imported == 0:
            fallback_dirs = [
                PROJECT_ROOT / "EXEMPLO_COMPLETO",
                PROJECT_ROOT / "SAIDA_BIM_SABESP",
                PROJECT_ROOT / "SAIDA_HYDRONETWORK",
            ]
            for base_dir in fallback_dirs:
                if not base_dir.exists():
                    continue
                for json_path in base_dir.rglob("*DADOS.json"):
                    imported += importar_ns_json_arquivo(json_path)
    _bootstrapped = True
    return {"ok": True, "imported": imported}


def listar_nucleos() -> list[str]:
    with get_session() as session:
        rows = session.execute(select(NS.nucleo).distinct().order_by(NS.nucleo)).scalars().all()
    return [row for row in rows if row]


def listar_ns(nucleo: str = "", status: str = "") -> list[dict[str, Any]]:
    with get_session() as session:
        stmt = select(NS).order_by(NS.nucleo, NS.seq)
        if nucleo:
            stmt = stmt.where(NS.nucleo == nucleo)
        if status:
            stmt = stmt.where(NS.status == _status_from_legacy(status))
        rows = session.execute(stmt).scalars().all()
        return [row.to_dict() for row in rows]


def get_ns_por_id(ns_id: int) -> dict[str, Any] | None:
    with get_session() as session:
        ns_obj = session.get(NS, ns_id)
        return ns_obj.to_dict() if ns_obj else None


def detalhe_ns(ns_id: int) -> dict[str, Any] | None:
    with get_session() as session:
        stmt = (
            select(NS)
            .where(NS.id == ns_id)
            .options(
                selectinload(NS.pvs),
                selectinload(NS.trechos),
                selectinload(NS.checklist),
                selectinload(NS.fotos),
                selectinload(NS.apontamentos),
            )
        )
        ns_obj = session.execute(stmt).scalar_one_or_none()
        if ns_obj is None:
            return None
        data = ns_obj.to_dict()
        data["pvs"] = [pv.to_dict() for pv in ns_obj.pvs]
        data["trechos"] = [
            {
                "id": t.id,
                "ns_id": t.ns_id,
                "pv_ini": t.pv_ini,
                "pv_fim": t.pv_fim,
                "ext_m": t.ext_m,
                "dn_mm": t.dn_mm,
                "material": t.material,
                "decl_mm": t.decl_mm,
                "ct_ini": t.ct_ini,
                "cf_ini": t.cf_ini,
                "ct_fim": t.ct_fim,
                "cf_fim": t.cf_fim,
            }
            for t in ns_obj.trechos
        ]
        data["checklist"] = [item.to_dict() for item in ns_obj.checklist]
        data["fotos"] = [foto.to_dict() for foto in ns_obj.fotos]
        data["apontamentos"] = [ap.to_dict() for ap in ns_obj.apontamentos]
        return data


def resolver_ns_por_codigo(codigo: str | int, nucleo: str = "") -> NS | None:
    if codigo in (None, ""):
        return None
    texto = str(codigo).strip().upper()
    seq = None
    if texto.startswith("NS_") or texto.startswith("NS-") or texto.startswith("NS"):
        digits = "".join(ch for ch in texto if ch.isdigit())
        seq = _coerce_int(digits)
    else:
        seq = _coerce_int(texto)
    with get_session() as session:
        stmt = select(NS)
        if nucleo:
            stmt = stmt.where(NS.nucleo == nucleo)
        if seq:
            stmt = stmt.where(NS.seq == seq)
        else:
            return None
        return session.execute(stmt.order_by(NS.id)).scalar_one_or_none()


def atualizar_status_ns(ns_id: int, status: str, data_referencia: str | None = None) -> dict[str, Any] | None:
    with get_session() as session:
        ns_obj = session.get(NS, ns_id)
        if ns_obj is None:
            return None
        novo_status = _status_from_legacy(status)
        ns_obj.status = novo_status
        data_ref = _parse_date(data_referencia) or date.today()
        if novo_status == StatusNS.EM_EXECUCAO and not ns_obj.data_inicio:
            ns_obj.data_inicio = data_ref
        if novo_status in (StatusNS.CONCLUIDA, StatusNS.MEDIDA):
            ns_obj.data_fim = data_ref
        session.flush()
        return ns_obj.to_dict()


def listar_fotos_ns(ns_id: int) -> list[dict[str, Any]]:
    with get_session() as session:
        rows = session.execute(
            select(RDOFoto).where(RDOFoto.ns_id == ns_id).order_by(RDOFoto.data_hora.desc())
        ).scalars().all()
        return [row.to_dict() for row in rows]


def geojson_rede(nucleo: str = "") -> dict[str, Any]:
    with get_session() as session:
        stmt = select(NS).options(selectinload(NS.pvs), selectinload(NS.trechos))
        if nucleo:
            stmt = stmt.where(NS.nucleo == nucleo)
        ns_rows = session.execute(stmt).scalars().all()

    features: list[dict[str, Any]] = []
    for ns_obj in ns_rows:
        pvs_index = {pv.nome: pv for pv in ns_obj.pvs}
        for trecho in ns_obj.trechos:
            p0 = pvs_index.get(trecho.pv_ini)
            p1 = pvs_index.get(trecho.pv_fim)
            if p0 and p1 and p0.x is not None and p0.y is not None and p1.x is not None and p1.y is not None:
                features.append(
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[p0.x, p0.y], [p1.x, p1.y]],
                        },
                        "properties": {
                            "feature_type": "trecho",
                            "ns_id": ns_obj.id,
                            "codigo": f"NS_{ns_obj.seq:03d}" if ns_obj.seq else None,
                            "nucleo": ns_obj.nucleo,
                            "pv_ini": trecho.pv_ini,
                            "pv_fim": trecho.pv_fim,
                            "ext_m": trecho.ext_m,
                            "dn_mm": trecho.dn_mm,
                            "material": trecho.material,
                            "status": ns_obj.status.value,
                        },
                    }
                )
        for pv in ns_obj.pvs:
            if pv.x is None or pv.y is None:
                continue
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [pv.x, pv.y]},
                    "properties": {
                        "feature_type": "pv",
                        "ns_id": ns_obj.id,
                        "codigo": f"NS_{ns_obj.seq:03d}" if ns_obj.seq else None,
                        "nucleo": ns_obj.nucleo,
                        "nome": pv.nome,
                        "tipo": pv.tipo,
                        "ct": pv.ct,
                        "cf": pv.cf,
                        "prof": pv.prof,
                        "is_agua": pv.is_agua,
                    },
                }
            )
    return {"type": "FeatureCollection", "features": features}


def kpis_nucleo(nucleo: str) -> dict[str, Any]:
    with get_session() as session:
        rows = session.execute(select(NS).where(NS.nucleo == nucleo)).scalars().all()
    if not rows:
        return {
            "nucleo": nucleo,
            "n_total": 0,
            "pct_fisico": 0.0,
            "pct_financeiro": 0.0,
            "extensao_total_m": 0.0,
            "extensao_exec_m": 0.0,
            "valor_liberado": 0.0,
        }
    total = len(rows)
    ext_total = sum(row.ext_m or 0 for row in rows)
    ext_exec = sum(row.ext_m or 0 for row in rows if row.status != StatusNS.PLANEJADA)
    medidas = [row for row in rows if row.status == StatusNS.MEDIDA]
    return {
        "nucleo": nucleo,
        "n_total": total,
        "n_planejadas": sum(1 for row in rows if row.status == StatusNS.PLANEJADA),
        "n_execucao": sum(1 for row in rows if row.status == StatusNS.EM_EXECUCAO),
        "n_concluidas": sum(1 for row in rows if row.status == StatusNS.CONCLUIDA),
        "n_medidas": len(medidas),
        "pct_fisico": round(ext_exec / ext_total * 100, 1) if ext_total else 0.0,
        "pct_financeiro": round(sum(row.bm_valor or 0 for row in medidas) / max(sum(row.custo_previsto or 0 for row in rows), 1) * 100, 1),
        "extensao_total_m": round(ext_total, 1),
        "extensao_exec_m": round(ext_exec, 1),
        "valor_liberado": round(sum(row.bm_valor or 0 for row in medidas), 2),
    }


def dashboard_metricas(nucleo: str = "") -> dict[str, Any]:
    if nucleo:
        base = kpis_nucleo(nucleo)
        with get_session() as session:
            rdos = session.execute(select(RDO).where(RDO.nucleo == nucleo)).scalars().all()
    else:
        nucleos = listar_nucleos()
        base = {
            "nucleo": "TODOS",
            "n_total": 0,
            "n_planejadas": 0,
            "n_execucao": 0,
            "n_concluidas": 0,
            "n_medidas": 0,
            "pct_fisico": 0.0,
            "pct_financeiro": 0.0,
            "extensao_total_m": 0.0,
            "extensao_exec_m": 0.0,
            "valor_liberado": 0.0,
        }
        for item in nucleos:
            kpi = kpis_nucleo(item)
            for key in ("n_total", "n_planejadas", "n_execucao", "n_concluidas", "n_medidas", "extensao_total_m", "extensao_exec_m", "valor_liberado"):
                base[key] += kpi.get(key, 0) or 0
        base["pct_fisico"] = round(base["extensao_exec_m"] / base["extensao_total_m"] * 100, 1) if base["extensao_total_m"] else 0.0
        with get_session() as session:
            previsto_total = session.execute(select(func.sum(NS.custo_previsto))).scalar() or 0.0
        base["pct_financeiro"] = round(base["valor_liberado"] / previsto_total * 100, 1) if previsto_total else 0.0
        with get_session() as session:
            rdos = session.execute(select(RDO)).scalars().all()

    dias = {str(rdo.data): 0.0 for rdo in rdos}
    for rdo in rdos:
        dias[str(rdo.data)] += rdo.total_custo or 0.0
    base["rdos"] = len(rdos)
    base["custo_rdo_total"] = round(sum(rdo.total_custo or 0 for rdo in rdos), 2)
    base["m_por_dia"] = round(base["extensao_exec_m"] / max(len(dias), 1), 2) if dias else 0.0
    base["dias_medidos"] = len(dias)
    return base


def curva_s_dados(nucleo: str = "") -> dict[str, Any]:
    with get_session() as session:
        stmt = select(NS).order_by(NS.seq)
        if nucleo:
            stmt = stmt.where(NS.nucleo == nucleo)
        rows = session.execute(stmt).scalars().all()

    if not rows:
        return {"previsto": [], "realizado": [], "n_total": 0}

    total_ext = sum(row.ext_m or 0 for row in rows) or float(len(rows))
    previsto = []
    acumulado_prev = 0.0
    for index, row in enumerate(rows, start=1):
        acumulado_prev += row.ext_m or 1.0
        previsto.append(
            {
                "mes": index,
                "mes_label": f"M{index:02d}",
                "pct_acum": round(acumulado_prev / total_ext * 100, 1),
                "acum_pct": round(acumulado_prev / total_ext * 100, 1),
                "ext_acum": round(acumulado_prev, 2),
                "custo_acum": round(sum((item.custo_previsto or 0) for item in rows[:index]), 2),
            }
        )

    agrupado: dict[str, dict[str, float]] = defaultdict(lambda: {"ext": 0.0, "custo": 0.0})
    for row in rows:
        data_ref = row.data_fim or row.data_inicio
        if data_ref and row.status != StatusNS.PLANEJADA:
            key = str(data_ref)
            agrupado[key]["ext"] += row.ext_m or 0.0
            agrupado[key]["custo"] += row.custo_realizado or row.custo_previsto or 0.0

    realizado = []
    acum_ext = 0.0
    acum_custo = 0.0
    for key in sorted(agrupado.keys()):
        acum_ext += agrupado[key]["ext"]
        acum_custo += agrupado[key]["custo"]
        realizado.append(
            {
                "data": key,
                "mes_label": key[:7],
                "pct_acum": round(acum_ext / total_ext * 100, 1),
                "acum_pct": round(acum_ext / total_ext * 100, 1),
                "ext_acum": round(acum_ext, 2),
                "custo_acum": round(acum_custo, 2),
            }
        )

    return {
        "previsto": previsto,
        "realizado": realizado,
        "n_total": len(rows),
        "ext_total": round(total_ext, 2),
        "custo_total": round(sum(row.custo_previsto or 0 for row in rows), 2),
    }


def cronograma_dados(nucleo: str = "") -> dict[str, Any]:
    cronograma_path = CRONOGRAMA_DIR / "CRONOGRAMA_MACRO_SLNR.json"
    if cronograma_path.exists():
        try:
            data = json.loads(cronograma_path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    rows = listar_ns(nucleo=nucleo)
    itens = []
    for item in rows:
        itens.append(
            {
                "id": item["id"],
                "codigo": item.get("codigo"),
                "nucleo": item.get("nucleo"),
                "inicio": item.get("data_inicio"),
                "fim": item.get("data_fim"),
                "status": item.get("status"),
                "ext_m": item.get("ext_m"),
                "rua": item.get("rua"),
            }
        )
    return {"tarefas": itens, "n_total": len(itens)}


def listar_rdos_com_apontamentos(nucleo: str = "") -> list[dict[str, Any]]:
    with get_session() as session:
        stmt = select(RDO).options(
            selectinload(RDO.apontamentos),
            selectinload(RDO.equipe),
            selectinload(RDO.ocorrencias),
            selectinload(RDO.fotos),
        ).order_by(RDO.data.desc())
        if nucleo:
            stmt = stmt.where(RDO.nucleo == nucleo)
        rows = session.execute(stmt).scalars().all()
        return [row.to_dict() for row in rows]


def obter_sessao_whatsapp(telefone: str) -> dict[str, Any] | None:
    with get_session() as session:
        row = session.execute(select(WhatsAppSession).where(WhatsAppSession.telefone == telefone)).scalar_one_or_none()
        return row.to_dict() if row else None


if __name__ == "__main__":
    result = bootstrap_database(force_import=False)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(json.dumps(dashboard_metricas(), indent=2, ensure_ascii=False))
