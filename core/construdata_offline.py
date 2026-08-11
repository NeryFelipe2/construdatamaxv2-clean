"""Backbone offline do ConstruData para o NOVA NS V5.

Entidades locais que nao dependem de Nota de Servico: projetos, contatos,
tarefas, LPS, suprimentos, mao de obra, equipamentos, custos, agenda, punch
list e logs WhatsApp.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, select
from sqlalchemy.orm import Mapped, mapped_column

from core.config import DATABASE_URL, PROJECT_ROOT
from core.models import Base

PROJECT_NUCLEO_GROUPS = {
    "TATUI": ["TATUI", "CESARIO_LANGE", "PORANGABA", "SAO_ROQUE"],
    "RK_SUB": ["RK_SUB"],
}

OFFICIAL_PROJECTS = [
    {"id": "c2bf8fda-b2e0-4bc1-9535-4891d596ea10", "nome": "Tatui - RK", "nucleo": "TATUI", "cidade": "Tatui / Cesario Lange / Porangaba / Sao Roque", "tipo": "Obra RK", "contrato": "RK-TATUI", "responsavel": "Icaro / Felipe Nery", "diretoria": "Felipe Nery, Luiz Fernando, Renato RK", "status": "ATIVO"},
    {"id": "f3c6645b-347f-4382-b9c5-d103c27ec511", "nome": "Osasco", "nucleo": "OSASCO", "cidade": "Osasco / SP", "tipo": "Obra RK", "contrato": "CT-CLU-OSC-2026", "responsavel": "Mateus Santos", "diretoria": "Felipe Nery, Luiz Fernando, Renato RK", "status": "ATIVO"},
    {"id": "abe7f66c-004b-4bb5-a245-6be67debd9f7", "nome": "Consorcio / SLNR Santos", "nucleo": "SLNR", "cidade": "Santos / SP", "tipo": "Sala Tecnica / Consorcio", "contrato": "CT-11481051", "responsavel": "Felipe Nery / Sala Tecnica", "diretoria": "Gerencia de sala tecnica", "status": "ATIVO"},
    {"id": "ec112c9a-1669-4287-8079-526d6940ce82", "nome": "Pardinho", "nucleo": "PARDINHO", "cidade": "Pardinho / SP", "tipo": "Obra RK", "contrato": "CT-PARDINHO-2026", "responsavel": "Icaro / Felipe Nery", "diretoria": "Felipe Nery, Luiz Fernando, Renato RK", "status": "ATIVO"},
    {"id": "2a28beec-b1f8-4b0c-8416-d0710bb35d9d", "nome": "Brasilia", "nucleo": "BRASILIA", "cidade": "Brasilia / DF", "tipo": "ConstruData", "contrato": "CDM-BSB", "responsavel": "Joao", "diretoria": "ConstruData", "status": "ATIVO"},
    {"id": "d4e5f6a7-b8c9-4d0e-a1f2-b3c4d5e6f7a8", "nome": "Morro do Teteu / Subempreita", "nucleo": "RK_SUB", "cidade": "Morro do Teteu", "tipo": "Subempreita", "contrato": "RK-SUB", "responsavel": "Igor", "diretoria": "Felipe Nery, Luiz Fernando, Renato RK", "status": "ATIVO"},
]

OFFICIAL_CONTACTS = [
    ("Felipe Nery", "", "Diretor", "Diretoria", "Diretoria", "Tatui, Osasco, Pardinho, RK Sub"),
    ("Luiz Fernando", "", "Diretor", "Diretoria", "Diretoria", "RK"),
    ("Renato RK", "", "Diretor", "Diretoria", "Diretoria", "RK"),
    ("Icaro", "", "Engenheiro", "Campo", "Producao", "Tatui, Cesario Lange, Porangaba, Sao Roque, Pardinho"),
    ("Mateus", "", "Engenheiro", "Campo", "Producao", "Osasco"),
    ("Igor", "", "Engenheiro", "Campo", "Producao", "RK Santos empreita"),
    ("Fabrizzio", "", "Gerente/Diretor", "SLNR", "Gerencia", "Consorcio / SLNR"),
    ("Gabriel", "", "Sala Tecnica", "SLNR", "Sala Tecnica", "Consorcio / SLNR"),
    ("Vinicius", "", "Sala Tecnica", "SLNR", "Sala Tecnica", "Consorcio / SLNR"),
    ("Junior", "", "Planejamento", "SLNR", "Planejamento", "Consorcio / SLNR"),
    ("Valdeans", "", "Planejamento", "SLNR", "Planejamento", "Consorcio / SLNR"),
    ("Veronica", "", "Planejamento", "SLNR", "Planejamento", "Consorcio / SLNR"),
    ("Jose Marcio", "", "Gerente Producao", "SLNR", "Producao", "Consorcio / SLNR"),
]


class CDMProjeto(Base):
    __tablename__ = "cdm_projeto"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    nome: Mapped[str] = mapped_column(String(200), index=True)
    nucleo: Mapped[str] = mapped_column(String(100), index=True)
    cidade: Mapped[str | None] = mapped_column(String(160))
    tipo: Mapped[str | None] = mapped_column(String(120))
    contrato: Mapped[str | None] = mapped_column(String(120))
    responsavel: Mapped[str | None] = mapped_column(String(200))
    diretoria: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="ATIVO")
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    def to_row(self): return (self.id, self.nome, self.tipo or "", self.cidade or "", self.nucleo, self.responsavel or "")


class CDMContato(Base):
    __tablename__ = "cdm_contato"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(200), index=True)
    telefone: Mapped[str | None] = mapped_column(String(80))
    papel: Mapped[str | None] = mapped_column(String(120))
    alcada: Mapped[str | None] = mapped_column(String(120))
    setor: Mapped[str | None] = mapped_column(String(120))
    projetos: Mapped[str | None] = mapped_column(Text)
    projeto_id: Mapped[str | None] = mapped_column(String(80), ForeignKey("cdm_projeto.id"))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    def to_row(self): return (self.id, self.nome, self.telefone or "", self.papel or "", self.alcada or "", self.setor or "")


def nucleos_do_projeto(project_or_nucleo: Any) -> list[str]:
    nucleo = getattr(project_or_nucleo, "nucleo", project_or_nucleo) or ""
    return PROJECT_NUCLEO_GROUPS.get(str(nucleo), [str(nucleo)])


class CDMTarefa(Base):
    __tablename__ = "cdm_tarefa"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    projeto_id: Mapped[str] = mapped_column(String(80), ForeignKey("cdm_projeto.id"), index=True)
    titulo: Mapped[str] = mapped_column(Text)
    responsavel: Mapped[str | None] = mapped_column(String(200))
    delegante: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(40), default="PENDENTE")
    prioridade: Mapped[str] = mapped_column(String(40), default="NORMAL")
    setor: Mapped[str | None] = mapped_column(String(120))
    origem: Mapped[str] = mapped_column(String(80), default="offline")
    prazo: Mapped[date | None] = mapped_column(Date)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    def to_row(self): return (self.id, self.status, self.prioridade, self.responsavel or "", self.titulo, self.prazo or "")


class CDMLpsRestricao(Base):
    __tablename__ = "cdm_lps_restricao"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    projeto_id: Mapped[str] = mapped_column(String(80), ForeignKey("cdm_projeto.id"), index=True)
    titulo: Mapped[str] = mapped_column(Text)
    responsavel: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(40), default="ABERTA")
    prioridade: Mapped[str] = mapped_column(String(40), default="NORMAL")
    data_alvo: Mapped[date | None] = mapped_column(Date)
    origem: Mapped[str] = mapped_column(String(80), default="offline")
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    def to_row(self): return (self.id, self.status, self.prioridade, self.responsavel or "", self.titulo, self.data_alvo or "")


class CDMSuprimento(Base):
    __tablename__ = "cdm_suprimento"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    projeto_id: Mapped[str] = mapped_column(String(80), ForeignKey("cdm_projeto.id"), index=True)
    item: Mapped[str] = mapped_column(String(240))
    categoria: Mapped[str | None] = mapped_column(String(120))
    quantidade: Mapped[float] = mapped_column(Float, default=0.0)
    unidade: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(60), default="NECESSARIO")
    fornecedor: Mapped[str | None] = mapped_column(String(200))
    custo_previsto: Mapped[float] = mapped_column(Float, default=0.0)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    def to_row(self): return (self.id, self.status, self.item, self.quantidade, self.unidade or "", self.fornecedor or "", self.custo_previsto)


class CDMMaoObra(Base):
    __tablename__ = "cdm_mao_obra"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    projeto_id: Mapped[str] = mapped_column(String(80), ForeignKey("cdm_projeto.id"), index=True)
    nome: Mapped[str] = mapped_column(String(200))
    funcao: Mapped[str | None] = mapped_column(String(120))
    quantidade: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(60), default="ATIVO")
    custo_dia: Mapped[float] = mapped_column(Float, default=0.0)
    origem: Mapped[str] = mapped_column(String(80), default="offline")
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    def to_row(self): return (self.id, self.status, self.nome, self.funcao or "", self.quantidade, self.custo_dia)


class CDMEquipamento(Base):
    __tablename__ = "cdm_equipamento"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    projeto_id: Mapped[str] = mapped_column(String(80), ForeignKey("cdm_projeto.id"), index=True)
    nome: Mapped[str] = mapped_column(String(200))
    tipo: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(60), default="DISPONIVEL")
    locadora: Mapped[str | None] = mapped_column(String(200))
    custo_dia: Mapped[float] = mapped_column(Float, default=0.0)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    def to_row(self): return (self.id, self.status, self.nome, self.tipo or "", self.locadora or "", self.custo_dia)


class CDMCusto(Base):
    __tablename__ = "cdm_custo"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    projeto_id: Mapped[str] = mapped_column(String(80), ForeignKey("cdm_projeto.id"), index=True)
    data: Mapped[date] = mapped_column(Date, default=date.today)
    categoria: Mapped[str] = mapped_column(String(120))
    descricao: Mapped[str] = mapped_column(Text)
    valor: Mapped[float] = mapped_column(Float, default=0.0)
    origem: Mapped[str] = mapped_column(String(80), default="offline")
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    def to_row(self): return (self.id, self.data, self.categoria, self.descricao, self.valor, self.origem)


class CDMAgenda(Base):
    __tablename__ = "cdm_agenda"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    projeto_id: Mapped[str] = mapped_column(String(80), ForeignKey("cdm_projeto.id"), index=True)
    data: Mapped[date] = mapped_column(Date, default=date.today)
    titulo: Mapped[str] = mapped_column(Text)
    responsavel: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(60), default="PENDENTE")
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    def to_row(self): return (self.id, self.data, self.status, self.responsavel or "", self.titulo)


class CDMPunchItem(Base):
    __tablename__ = "cdm_punch_item"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    projeto_id: Mapped[str] = mapped_column(String(80), ForeignKey("cdm_projeto.id"), index=True)
    titulo: Mapped[str] = mapped_column(Text)
    responsavel: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(60), default="ABERTO")
    prioridade: Mapped[str] = mapped_column(String(40), default="NORMAL")
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    def to_row(self): return (self.id, self.status, self.prioridade, self.responsavel or "", self.titulo)


class CDMWhatsAppLog(Base):
    __tablename__ = "cdm_whatsapp_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    projeto_id: Mapped[str | None] = mapped_column(String(80), ForeignKey("cdm_projeto.id"))
    telefone: Mapped[str | None] = mapped_column(String(80))
    direcao: Mapped[str] = mapped_column(String(30), default="out")
    mensagem: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(60), default="REGISTRADO")
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    def to_row(self): return (self.id, self.criado_em, self.direcao, self.telefone or "", self.status, self.mensagem[:120])


ENTITY_MODELS = {
    "tarefas": CDMTarefa, "lps": CDMLpsRestricao, "suprimentos": CDMSuprimento,
    "mao_obra": CDMMaoObra, "equipamentos": CDMEquipamento, "custos": CDMCusto,
    "agenda": CDMAgenda, "punch": CDMPunchItem, "whatsapp": CDMWhatsAppLog,
}

ENTITY_REPORT_TITLES = {
    "tarefas": "Tarefas",
    "lps": "LPS / Restricoes",
    "suprimentos": "Suprimentos",
    "mao_obra": "Mao de Obra",
    "equipamentos": "Equipamentos",
    "custos": "Custos / DRE",
    "agenda": "Agenda",
    "punch": "Punch List",
    "whatsapp": "WhatsApp Logs",
}


def _public_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _to_public_dict(row: Any) -> dict[str, Any]:
    return {col.name: _public_value(getattr(row, col.name)) for col in row.__table__.columns}


def _parse_date(value: Any) -> date | None:
    if not value: return None
    if isinstance(value, date): return value
    try: return date.fromisoformat(str(value)[:10])
    except Exception: return None


def _float(value: Any) -> float:
    try: return float(str(value or 0).replace(",", "."))
    except Exception: return 0.0


def _int(value: Any) -> int:
    try: return int(float(str(value or 0).replace(",", ".")))
    except Exception: return 0


def seed_offline_core() -> None:
    from core.database import criar_banco, get_session
    criar_banco()
    with get_session() as session:
        for data in OFFICIAL_PROJECTS:
            obj = session.get(CDMProjeto, data["id"])
            if not obj:
                obj = CDMProjeto(id=data["id"], nome=data["nome"], nucleo=data["nucleo"])
                session.add(obj)
            for key, value in data.items():
                setattr(obj, key, value)
        for nome, telefone, papel, alcada, setor, projetos in OFFICIAL_CONTACTS:
            exists = session.execute(select(CDMContato).where(CDMContato.nome == nome)).scalar_one_or_none()
            if not exists:
                session.add(CDMContato(nome=nome, telefone=telefone, papel=papel, alcada=alcada, setor=setor, projetos=projetos))


def list_projects() -> list[CDMProjeto]:
    from core.database import get_session
    seed_offline_core()
    with get_session() as session:
        rows = session.execute(select(CDMProjeto).order_by(CDMProjeto.nome)).scalars().all()
        for row in rows: session.expunge(row)
        return list(rows)


def get_project(project_id: str | None = None, name: str | None = None) -> CDMProjeto:
    from core.database import get_session
    seed_offline_core()
    with get_session() as session:
        obj = session.get(CDMProjeto, project_id) if project_id else None
        if not obj and name:
            obj = session.execute(select(CDMProjeto).where(CDMProjeto.nome == name)).scalar_one_or_none()
        if not obj:
            obj = session.execute(select(CDMProjeto).order_by(CDMProjeto.nome)).scalars().first()
        if not obj: raise ValueError("Nenhum projeto offline cadastrado")
        session.expunge(obj)
        return obj


def create_project(data: dict[str, Any]) -> str:
    from core.database import get_session
    seed_offline_core()
    project_id = data.get("id") or f"offline-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    with get_session() as session:
        obj = session.get(CDMProjeto, project_id)
        if not obj:
            obj = CDMProjeto(id=project_id, nome=data.get("nome") or "Novo Projeto", nucleo=data.get("nucleo") or "NOVO")
            session.add(obj)
        obj.nome = data.get("nome") or obj.nome
        obj.nucleo = data.get("nucleo") or obj.nucleo
        obj.cidade = data.get("cidade") or obj.cidade
        obj.tipo = data.get("tipo") or obj.tipo or "Obra"
        obj.contrato = data.get("contrato") or obj.contrato
        obj.responsavel = data.get("responsavel") or obj.responsavel
        obj.diretoria = data.get("diretoria") or obj.diretoria
        obj.status = data.get("status") or obj.status or "ATIVO"
        session.flush()
        return obj.id


def create_contact(data: dict[str, Any]) -> int:
    from core.database import get_session
    seed_offline_core()
    with get_session() as session:
        obj = CDMContato(
            nome=data.get("nome") or "Novo Contato",
            telefone=data.get("telefone") or "",
            papel=data.get("papel") or "",
            alcada=data.get("alcada") or "",
            setor=data.get("setor") or "",
            projetos=data.get("projetos") or "",
            projeto_id=data.get("projeto_id") or None,
            ativo=bool(data.get("ativo", True)),
        )
        session.add(obj)
        session.flush()
        return int(obj.id)


def list_contacts() -> list[CDMContato]:
    from core.database import get_session
    seed_offline_core()
    with get_session() as session:
        rows = session.execute(select(CDMContato).order_by(CDMContato.nome)).scalars().all()
        for row in rows: session.expunge(row)
        return list(rows)


def list_entity(entity: str, project_id: str | None = None) -> list[Any]:
    from core.database import get_session
    seed_offline_core()
    model = ENTITY_MODELS[entity]
    with get_session() as session:
        stmt = select(model)
        if project_id and hasattr(model, "projeto_id"):
            stmt = stmt.where(model.projeto_id == project_id)
        stmt = stmt.order_by(model.id.desc())
        rows = session.execute(stmt).scalars().all()
        for row in rows: session.expunge(row)
        return list(rows)


def create_entity(entity: str, project_id: str, data: dict[str, Any]) -> int:
    from core.database import get_session
    seed_offline_core()
    model = ENTITY_MODELS[entity]
    payload = dict(data)
    if hasattr(model, "projeto_id"): payload["projeto_id"] = project_id
    for key in ("prazo", "data", "data_alvo"):
        if key in payload: payload[key] = _parse_date(payload[key])
    for key in ("valor", "custo_dia", "custo_previsto"):
        if key in payload: payload[key] = _float(payload[key])
    if "quantidade" in payload:
        payload["quantidade"] = _int(payload["quantidade"]) if entity == "mao_obra" else _float(payload["quantidade"])
    with get_session() as session:
        obj = model(**payload)
        session.add(obj)
        session.flush()
        return int(obj.id)


def set_entity_status(entity: str, row_id: int, status: str) -> None:
    from core.database import get_session
    seed_offline_core()
    model = ENTITY_MODELS[entity]
    with get_session() as session:
        obj = session.get(model, row_id)
        if not obj: raise ValueError(f"Registro {row_id} nao encontrado")
        if hasattr(obj, "status"): obj.status = status


def dashboard_counts(project_id: str) -> dict[str, Any]:
    seed_offline_core()
    result = {}
    for entity in ENTITY_MODELS:
        try: result[entity] = len(list_entity(entity, project_id))
        except Exception: result[entity] = 0
    result["contatos"] = len(list_contacts())
    return result


def offline_health() -> dict[str, Any]:
    projects = list_projects()
    return {
        "ok": True,
        "mode": "offline",
        "database": "sqlite" if DATABASE_URL.startswith("sqlite") else "external",
        "projects": len(projects),
        "contacts": len(list_contacts()),
        "generated_at": datetime.now().isoformat(timespec="seconds"),
    }


def project_snapshot(project_id: str) -> dict[str, Any]:
    project = get_project(project_id=project_id)
    counts = dashboard_counts(project.id)
    entities = {name: [_to_public_dict(row) for row in list_entity(name, project.id)] for name in ENTITY_MODELS}
    total_custos = sum((row.get("valor") or 0) for row in entities["custos"])
    total_mao_obra = sum((row.get("quantidade") or 0) * (row.get("custo_dia") or 0) for row in entities["mao_obra"])
    total_equipamentos = sum((row.get("custo_dia") or 0) for row in entities["equipamentos"])
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "health": offline_health(),
        "project": _to_public_dict(project),
        "counts": counts,
        "totals": {
            "custos_lancados": round(total_custos, 2),
            "mao_obra_dia": round(total_mao_obra, 2),
            "equipamentos_dia": round(total_equipamentos, 2),
            "custo_dia_estimado": round(total_mao_obra + total_equipamentos, 2),
        },
        "entities": entities,
        "contacts": [_to_public_dict(row) for row in list_contacts()],
    }


def build_project_report(project_id: str) -> str:
    snapshot = project_snapshot(project_id)
    project = snapshot["project"]
    counts = snapshot["counts"]
    totals = snapshot["totals"]
    lines = [
        f"# Relatorio 360 Offline - {project['nome']}",
        "",
        f"- Gerado em: {snapshot['generated_at']}",
        f"- Projeto ID: `{project['id']}`",
        f"- Nucleo: `{project['nucleo']}`",
        f"- Cidade: {project.get('cidade') or '-'}",
        f"- Tipo: {project.get('tipo') or '-'}",
        f"- Contrato: {project.get('contrato') or '-'}",
        f"- Responsavel: {project.get('responsavel') or '-'}",
        f"- Diretoria/alcada: {project.get('diretoria') or '-'}",
        "",
        "## Indicadores",
        "",
    ]
    for key, value in counts.items():
        lines.append(f"- {key}: {value}")
    lines.extend([
        "",
        "## Totais",
        "",
        f"- Custos lancados: R$ {totals['custos_lancados']}",
        f"- Mao de obra/dia: R$ {totals['mao_obra_dia']}",
        f"- Equipamentos/dia: R$ {totals['equipamentos_dia']}",
        f"- Custo diario estimado: R$ {totals['custo_dia_estimado']}",
    ])
    for entity, title in ENTITY_REPORT_TITLES.items():
        rows = snapshot["entities"][entity]
        lines.extend(["", f"## {title}", ""])
        if not rows:
            lines.append("- Sem registros offline.")
            continue
        for row in rows[:30]:
            status = row.get("status") or row.get("direcao") or row.get("categoria") or "-"
            desc = row.get("titulo") or row.get("item") or row.get("nome") or row.get("descricao") or row.get("mensagem") or "-"
            owner = row.get("responsavel") or row.get("fornecedor") or row.get("locadora") or row.get("telefone") or "-"
            lines.append(f"- #{row.get('id')} [{status}] {desc} | Ref: {owner}")
    lines.extend(["", "## Contatos / Alcadas", ""])
    for row in snapshot["contacts"][:50]:
        lines.append(f"- {row.get('nome')} | {row.get('papel') or '-'} | {row.get('alcada') or '-'} | {row.get('telefone') or '-'}")
    lines.extend(["", "## Observacao"])
    lines.append("Relatorio gerado localmente pelo ConstruData Offline dentro do NOVA NS V5.")
    return "\n".join(lines) + "\n"


def export_project_report(project_id: str, out_dir: str | Path | None = None) -> str:
    project = get_project(project_id=project_id)
    target_dir = Path(out_dir) if out_dir else PROJECT_ROOT / "SAIDA_CONSTRUDATA_OFFLINE"
    target_dir.mkdir(parents=True, exist_ok=True)
    safe_name = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in project.nome)
    path = target_dir / f"RELATORIO_360_{safe_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    path.write_text(build_project_report(project.id), encoding="utf-8")
    return str(path)
