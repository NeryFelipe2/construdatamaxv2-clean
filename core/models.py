# core/models.py
"""
Modelos SQLAlchemy 2.0 — ConstruData HydroNetwork v10+
Banco: SQLite (padrão) | PostgreSQL (opcional via DATABASE_URL)

Tabelas:
  ns, pv, trecho, rdo, rdo_apontamento, rdo_equipe,
  rdo_ocorrencia, rdo_foto, checklist_ns
"""
from __future__ import annotations

import enum
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    __allow_unmapped__ = True


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class StatusNS(str, enum.Enum):
    PLANEJADA     = "PLANEJADA"
    EM_EXECUCAO   = "EM_EXECUCAO"
    CONCLUIDA     = "CONCLUIDA"
    MEDIDA        = "MEDIDA"
    BLOQUEADA     = "BLOQUEADA"


class StatusRDO(str, enum.Enum):
    ABERTO   = "ABERTO"
    FECHADO  = "FECHADO"
    ASSINADO = "ASSINADO"


class StatusRevisaoRDO(str, enum.Enum):
    RASCUNHO   = "rascunho"
    EXTRAIDO   = "extraido"
    EM_REVISAO = "em_revisao"
    FINALIZADO = "finalizado"
    REJEITADO  = "rejeitado"


class TipoOcorrencia(str, enum.Enum):
    PARADA   = "parada"
    CHUVA    = "chuva"
    ACIDENTE = "acidente"
    MATERIAL = "material"
    OUTRO    = "outro"


# ---------------------------------------------------------------------------
# NS — Nota de Serviço
# ---------------------------------------------------------------------------

class NS(Base):
    __tablename__ = "ns"

    id:               Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    seq:              Mapped[int]            = mapped_column(Integer, default=0, index=True)
    nucleo:           Mapped[str]            = mapped_column(String(100), index=True)
    pv_ini:           Mapped[str]            = mapped_column(String(50))
    pv_fim:           Mapped[str]            = mapped_column(String(50))
    ext_m:            Mapped[Optional[float]]= mapped_column(Float)
    dn_mm:            Mapped[Optional[int]]  = mapped_column(Integer)
    material:         Mapped[Optional[str]]  = mapped_column(String(50))
    rua:              Mapped[Optional[str]]  = mapped_column(String(200))
    status:           Mapped[StatusNS]       = mapped_column(Enum(StatusNS), default=StatusNS.PLANEJADA)

    data_inicio:      Mapped[Optional[date]] = mapped_column(Date)
    data_fim:         Mapped[Optional[date]] = mapped_column(Date)
    custo_previsto:   Mapped[Optional[float]]= mapped_column(Float, default=0.0)
    custo_realizado:  Mapped[Optional[float]]= mapped_column(Float, default=0.0)

    # Dados de campo reais
    ct_ini_real:      Mapped[Optional[float]]= mapped_column(Float)
    cf_ini_real:      Mapped[Optional[float]]= mapped_column(Float)
    ct_fim_real:      Mapped[Optional[float]]= mapped_column(Float)
    cf_fim_real:      Mapped[Optional[float]]= mapped_column(Float)
    cadastro_ok:      Mapped[bool]           = mapped_column(Boolean, default=False)
    cadastro_dxf:     Mapped[Optional[str]]  = mapped_column(String(500))
    bm_numero:        Mapped[Optional[int]]  = mapped_column(Integer)
    bm_valor:         Mapped[Optional[float]]= mapped_column(Float, default=0.0)

    # WhatsApp
    wa_ultima_msg:    Mapped[Optional[str]]  = mapped_column(Text)
    wa_timestamp:     Mapped[Optional[datetime]] = mapped_column(DateTime)
    caminho_json:     Mapped[Optional[str]]  = mapped_column(String(500))
    nome_arquivo:     Mapped[Optional[str]]  = mapped_column(String(200))
    origem_dados:     Mapped[Optional[str]]  = mapped_column(String(100))

    # Relacionamentos
    pvs: Mapped[list["PV"]] = relationship("PV", back_populates="ns", cascade="all, delete-orphan")
    trechos: Mapped[list["Trecho"]] = relationship("Trecho", back_populates="ns", cascade="all, delete-orphan")
    apontamentos: Mapped[list["RDOApontamento"]] = relationship("RDOApontamento", back_populates="ns")
    fotos: Mapped[list["RDOFoto"]] = relationship("RDOFoto", back_populates="ns")
    checklist: Mapped[list["ChecklistNS"]] = relationship("ChecklistNS", back_populates="ns", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id":             self.id,
            "seq":            self.seq,
            "nucleo":         self.nucleo,
            "pv_ini":         self.pv_ini,
            "pv_fim":         self.pv_fim,
            "ext_m":          self.ext_m,
            "dn_mm":          self.dn_mm,
            "material":       self.material,
            "rua":            self.rua,
            "status":         self.status.value if self.status else "PLANEJADA",
            "data_inicio":    str(self.data_inicio) if self.data_inicio else None,
            "data_fim":       str(self.data_fim) if self.data_fim else None,
            "custo_previsto": self.custo_previsto,
            "custo_realizado":self.custo_realizado,
            "cadastro_ok":    self.cadastro_ok,
            "bm_numero":      self.bm_numero,
            "bm_valor":       self.bm_valor,
            "codigo":         f"NS_{self.seq:03d}" if self.seq else None,
            "caminho_json":   self.caminho_json,
            "nome_arquivo":   self.nome_arquivo,
            "origem_dados":   self.origem_dados,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "NS":
        status_map = {
            "PLANEJADO":    StatusNS.PLANEJADA,
            "PLANEJADA":    StatusNS.PLANEJADA,
            "EM_EXECUCAO":  StatusNS.EM_EXECUCAO,
            "EXECUTADO":    StatusNS.EM_EXECUCAO,
            "CONCLUIDA":    StatusNS.CONCLUIDA,
            "CADASTRADO":   StatusNS.CONCLUIDA,
            "MEDIDO":       StatusNS.MEDIDA,
            "MEDIDA":       StatusNS.MEDIDA,
            "BLOQUEADO":    StatusNS.BLOQUEADA,
            "BLOQUEADA":    StatusNS.BLOQUEADA,
        }
        st_raw = str(d.get("status", "PLANEJADA")).upper()
        return cls(
            seq=d.get("ns_id") or d.get("seq") or 0,
            nucleo=d.get("nucleo", ""),
            pv_ini=d.get("pv_ini", ""),
            pv_fim=d.get("pv_fim", ""),
            ext_m=d.get("ext_m"),
            dn_mm=d.get("dn_mm"),
            material=d.get("material"),
            rua=d.get("rua"),
            status=status_map.get(st_raw, StatusNS.PLANEJADA),
            custo_previsto=d.get("custo", d.get("custo_previsto", 0.0)),
        )


# ---------------------------------------------------------------------------
# PV — Poço de Visita / Ponto de Inspeção
# ---------------------------------------------------------------------------

class PV(Base):
    __tablename__ = "pv"

    id:    Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome:  Mapped[str]             = mapped_column(String(50), index=True)
    ns_id: Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("ns.id"))
    x:     Mapped[Optional[float]] = mapped_column(Float)
    y:     Mapped[Optional[float]] = mapped_column(Float)
    lat:   Mapped[Optional[float]] = mapped_column(Float)
    lon:   Mapped[Optional[float]] = mapped_column(Float)
    ct:    Mapped[Optional[float]] = mapped_column(Float)
    cf:    Mapped[Optional[float]] = mapped_column(Float)
    prof:  Mapped[Optional[float]] = mapped_column(Float)
    tipo:  Mapped[Optional[str]]   = mapped_column(String(20))  # PV / PI / TI
    material: Mapped[Optional[str]] = mapped_column(String(50))
    is_agua: Mapped[bool] = mapped_column(Boolean, default=False)

    ns: Mapped["NS"] = relationship("NS", back_populates="pvs")

    def to_dict(self) -> dict:
        return {k: getattr(self, k) for k in
                ("id", "nome", "ns_id", "x", "y", "lat", "lon", "ct", "cf", "prof", "tipo", "material", "is_agua")}


# ---------------------------------------------------------------------------
# Trecho
# ---------------------------------------------------------------------------

class Trecho(Base):
    __tablename__ = "trecho"

    id:       Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    ns_id:    Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("ns.id"))
    pv_ini:   Mapped[str]             = mapped_column(String(50))
    pv_fim:   Mapped[str]             = mapped_column(String(50))
    ext_m:    Mapped[Optional[float]] = mapped_column(Float)
    dn_mm:    Mapped[Optional[int]]   = mapped_column(Integer)
    material: Mapped[Optional[str]]   = mapped_column(String(50))
    decl_mm:  Mapped[Optional[float]] = mapped_column(Float)
    ct_ini:   Mapped[Optional[float]] = mapped_column(Float)
    cf_ini:   Mapped[Optional[float]] = mapped_column(Float)
    ct_fim:   Mapped[Optional[float]] = mapped_column(Float)
    cf_fim:   Mapped[Optional[float]] = mapped_column(Float)

    ns: Mapped["NS"] = relationship("NS", back_populates="trechos")


# ---------------------------------------------------------------------------
# RDO — Relatório Diário de Obra
# ---------------------------------------------------------------------------

class RDO(Base):
    __tablename__ = "rdo"

    id:          Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    data:        Mapped[date]            = mapped_column(Date, index=True)
    numero:      Mapped[Optional[int]]   = mapped_column(Integer)
    nucleo:      Mapped[str]             = mapped_column(String(100), index=True)
    responsavel: Mapped[Optional[str]]   = mapped_column(String(200))
    contrato:    Mapped[Optional[str]]   = mapped_column(String(100), default="11481051")
    organization_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    project_id:  Mapped[Optional[str]]   = mapped_column(String(100), index=True)
    ordem_servico: Mapped[Optional[str]] = mapped_column(String(100))
    local:       Mapped[Optional[str]]   = mapped_column(String(255))
    empreiteira: Mapped[Optional[str]]   = mapped_column(String(200))
    encarregado: Mapped[Optional[str]]   = mapped_column(String(200))
    origem:      Mapped[Optional[str]]   = mapped_column(String(50), default="digital")
    status_revisao: Mapped[StatusRevisaoRDO] = mapped_column(
        Enum(StatusRevisaoRDO, values_callable=lambda values: [item.value for item in values]),
        default=StatusRevisaoRDO.RASCUNHO,
    )
    assinatura_presente: Mapped[bool]    = mapped_column(Boolean, default=False)
    clima_manha: Mapped[Optional[str]]   = mapped_column(String(50))
    clima_tarde: Mapped[Optional[str]]   = mapped_column(String(50))
    observacoes: Mapped[Optional[str]]   = mapped_column(Text)
    status:      Mapped[StatusRDO]       = mapped_column(Enum(StatusRDO), default=StatusRDO.ABERTO)
    total_custo: Mapped[float]           = mapped_column(Float, default=0.0)
    pdf_path:    Mapped[Optional[str]]   = mapped_column(String(500))
    criado_em:   Mapped[datetime]        = mapped_column(DateTime, default=datetime.now)
    fechado_em:  Mapped[Optional[datetime]] = mapped_column(DateTime)
    deleted_at:  Mapped[Optional[datetime]] = mapped_column(DateTime)

    apontamentos: Mapped[list["RDOApontamento"]] = relationship("RDOApontamento", back_populates="rdo", cascade="all, delete-orphan")
    equipe: Mapped[list["RDOEquipe"]] = relationship("RDOEquipe", back_populates="rdo", cascade="all, delete-orphan")
    ocorrencias: Mapped[list["RDOOcorrencia"]] = relationship("RDOOcorrencia", back_populates="rdo", cascade="all, delete-orphan")
    fotos: Mapped[list["RDOFoto"]] = relationship("RDOFoto", back_populates="rdo", cascade="all, delete-orphan")
    evidencias: Mapped[list["RDOEvidencia"]] = relationship("RDOEvidencia", back_populates="rdo", cascade="all, delete-orphan")
    extracoes: Mapped[list["RDOExtracao"]] = relationship("RDOExtracao", back_populates="rdo", cascade="all, delete-orphan")
    medicao_fontes: Mapped[list["RDOMedicaoFonte"]] = relationship("RDOMedicaoFonte", back_populates="rdo", cascade="all, delete-orphan")
    qualidade_sinais: Mapped[list["RDOQualidadeSinal"]] = relationship("RDOQualidadeSinal", back_populates="rdo", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        def _lista(valor):
            if not valor:
                return []
            if isinstance(valor, list):
                return valor
            return [valor]

        return {
            "id":          self.id,
            "data":        str(self.data),
            "numero":      self.numero,
            "nucleo":      self.nucleo,
            "responsavel": self.responsavel,
            "contrato":    self.contrato,
            "organization_id": self.organization_id,
            "project_id":  self.project_id,
            "ordem_servico": self.ordem_servico,
            "local":       self.local,
            "empreiteira": self.empreiteira,
            "encarregado": self.encarregado,
            "origem":      self.origem,
            "status_revisao": self.status_revisao.value if self.status_revisao else "rascunho",
            "assinatura_presente": self.assinatura_presente,
            "clima_manha": self.clima_manha,
            "clima_tarde": self.clima_tarde,
            "observacoes": self.observacoes,
            "status":      self.status.value if self.status else "ABERTO",
            "total_custo": self.total_custo,
            "pdf_path":    self.pdf_path,
            "criado_em":    self.criado_em.isoformat() if self.criado_em else None,
            "fechado_em":   self.fechado_em.isoformat() if self.fechado_em else None,
            "deleted_at":   self.deleted_at.isoformat() if self.deleted_at else None,
            "apontamentos": [a.to_dict() for a in _lista(self.apontamentos)],
            "equipe":       [e.to_dict() for e in _lista(self.equipe)],
            "ocorrencias":  [o.to_dict() for o in _lista(self.ocorrencias)],
            "fotos":        [f.to_dict() for f in _lista(self.fotos)],
            "evidencias":   [e.to_dict() for e in _lista(self.evidencias)],
        }


# ---------------------------------------------------------------------------
# RDO Apontamento
# ---------------------------------------------------------------------------

class RDOApontamento(Base):
    __tablename__ = "rdo_apontamento"

    id:          Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    rdo_id:      Mapped[int]             = mapped_column(Integer, ForeignKey("rdo.id"), index=True)
    ns_id:       Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("ns.id"))
    servico:     Mapped[str]             = mapped_column(String(200))
    quantidade:  Mapped[Optional[float]] = mapped_column(Float)
    unidade:     Mapped[Optional[str]]   = mapped_column(String(20), default="m")
    dn_mm:       Mapped[Optional[int]]   = mapped_column(Integer)
    custo_unit:  Mapped[Optional[float]] = mapped_column(Float)
    custo_total: Mapped[Optional[float]] = mapped_column(Float)
    hora_inicio: Mapped[Optional[time]]  = mapped_column(Time)
    hora_fim:    Mapped[Optional[time]]  = mapped_column(Time)

    rdo: Mapped["RDO"] = relationship("RDO", back_populates="apontamentos")
    ns: Mapped[Optional["NS"]] = relationship("NS", back_populates="apontamentos")

    def to_dict(self) -> dict:
        return {k: getattr(self, k) for k in
                ("id", "rdo_id", "ns_id", "servico", "quantidade",
                 "unidade", "dn_mm", "custo_unit", "custo_total")}


# ---------------------------------------------------------------------------
# RDO Equipe
# ---------------------------------------------------------------------------

class RDOEquipe(Base):
    __tablename__ = "rdo_equipe"

    id:         Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    rdo_id:     Mapped[int]           = mapped_column(Integer, ForeignKey("rdo.id"), index=True)
    funcao:     Mapped[str]           = mapped_column(String(100))
    quantidade: Mapped[int]           = mapped_column(Integer, default=1)

    rdo: Mapped["RDO"] = relationship("RDO", back_populates="equipe")

    def to_dict(self) -> dict:
        return {"id": self.id, "rdo_id": self.rdo_id, "funcao": self.funcao, "quantidade": self.quantidade}


# ---------------------------------------------------------------------------
# RDO Ocorrência
# ---------------------------------------------------------------------------

class RDOOcorrencia(Base):
    __tablename__ = "rdo_ocorrencia"

    id:        Mapped[int]                    = mapped_column(Integer, primary_key=True, autoincrement=True)
    rdo_id:    Mapped[int]                    = mapped_column(Integer, ForeignKey("rdo.id"), index=True)
    hora:      Mapped[Optional[time]]         = mapped_column(Time)
    tipo:      Mapped[TipoOcorrencia]         = mapped_column(Enum(TipoOcorrencia), default=TipoOcorrencia.OUTRO)
    descricao: Mapped[Optional[str]]          = mapped_column(Text)
    ns_id:     Mapped[Optional[int]]          = mapped_column(Integer, ForeignKey("ns.id"))

    rdo: Mapped["RDO"] = relationship("RDO", back_populates="ocorrencias")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "rdo_id": self.rdo_id,
            "hora": str(self.hora) if self.hora else None,
            "tipo": self.tipo.value if self.tipo else "outro",
            "descricao": self.descricao, "ns_id": self.ns_id,
        }


# ---------------------------------------------------------------------------
# RDO Foto
# ---------------------------------------------------------------------------

class RDOFoto(Base):
    __tablename__ = "rdo_foto"

    id:        Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    rdo_id:    Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("rdo.id"))
    ns_id:     Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("ns.id"))
    caminho:   Mapped[str]             = mapped_column(String(500))
    legenda:   Mapped[Optional[str]]   = mapped_column(Text)
    lat:       Mapped[Optional[float]] = mapped_column(Float)
    lon:       Mapped[Optional[float]] = mapped_column(Float)
    data_hora: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.now)

    rdo: Mapped[Optional["RDO"]] = relationship("RDO", back_populates="fotos")
    ns: Mapped[Optional["NS"]] = relationship("NS", back_populates="fotos")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "rdo_id": self.rdo_id, "ns_id": self.ns_id,
            "caminho": self.caminho, "legenda": self.legenda,
            "lat": self.lat, "lon": self.lon,
            "data_hora": str(self.data_hora) if self.data_hora else None,
        }


# ---------------------------------------------------------------------------
# RDO Evidencia / Extracao / Integracoes
# ---------------------------------------------------------------------------

class RDOEvidencia(Base):
    __tablename__ = "rdo_evidencia"

    id:          Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    rdo_id:      Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("rdo.id"), index=True)
    organization_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    project_id:  Mapped[Optional[str]]   = mapped_column(String(100), index=True)
    tipo:        Mapped[str]             = mapped_column(String(50), default="foto")
    origem:      Mapped[str]             = mapped_column(String(50), default="upload")
    caminho:     Mapped[str]             = mapped_column(String(500))
    nome_arquivo: Mapped[Optional[str]]  = mapped_column(String(255))
    mime_type:   Mapped[Optional[str]]   = mapped_column(String(120))
    hash_sha256: Mapped[Optional[str]]   = mapped_column(String(80), index=True)
    tamanho_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    usuario:     Mapped[Optional[str]]   = mapped_column(String(200))
    assinatura_presente: Mapped[bool]    = mapped_column(Boolean, default=False)
    metadados_json: Mapped[Optional[str]]= mapped_column(Text)
    criado_em:   Mapped[datetime]        = mapped_column(DateTime, default=datetime.now)

    rdo: Mapped[Optional["RDO"]] = relationship("RDO", back_populates="evidencias")
    extracoes: Mapped[list["RDOExtracao"]] = relationship("RDOExtracao", back_populates="evidencia")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "rdo_id": self.rdo_id,
            "organization_id": self.organization_id, "project_id": self.project_id,
            "tipo": self.tipo, "origem": self.origem, "caminho": self.caminho,
            "nome_arquivo": self.nome_arquivo, "mime_type": self.mime_type,
            "hash_sha256": self.hash_sha256, "tamanho_bytes": self.tamanho_bytes,
            "usuario": self.usuario, "assinatura_presente": self.assinatura_presente,
            "metadados_json": self.metadados_json,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
        }


class RDOExtracao(Base):
    __tablename__ = "rdo_extracao"

    id:          Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    rdo_id:      Mapped[int]             = mapped_column(Integer, ForeignKey("rdo.id"), index=True)
    evidencia_id: Mapped[Optional[int]]  = mapped_column(Integer, ForeignKey("rdo_evidencia.id"), index=True)
    provider:    Mapped[str]             = mapped_column(String(80), default="deterministico")
    status:      Mapped[str]             = mapped_column(String(50), default="em_revisao")
    raw_json:    Mapped[Optional[str]]   = mapped_column(Text)
    campos_json: Mapped[Optional[str]]   = mapped_column(Text)
    confianca_json: Mapped[Optional[str]]= mapped_column(Text)
    pendencias_json: Mapped[Optional[str]]= mapped_column(Text)
    assinatura_presente: Mapped[bool]    = mapped_column(Boolean, default=False)
    criado_em:   Mapped[datetime]        = mapped_column(DateTime, default=datetime.now)
    atualizado_em: Mapped[datetime]      = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    rdo: Mapped["RDO"] = relationship("RDO", back_populates="extracoes")
    evidencia: Mapped[Optional["RDOEvidencia"]] = relationship("RDOEvidencia", back_populates="extracoes")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "rdo_id": self.rdo_id, "evidencia_id": self.evidencia_id,
            "provider": self.provider, "status": self.status, "raw_json": self.raw_json,
            "campos_json": self.campos_json, "confianca_json": self.confianca_json,
            "pendencias_json": self.pendencias_json,
            "assinatura_presente": self.assinatura_presente,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
            "atualizado_em": self.atualizado_em.isoformat() if self.atualizado_em else None,
        }


class RDOMedicaoFonte(Base):
    __tablename__ = "rdo_medicao_fonte"

    id:          Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    rdo_id:      Mapped[int]             = mapped_column(Integer, ForeignKey("rdo.id"), index=True)
    apontamento_id: Mapped[Optional[int]]= mapped_column(Integer, ForeignKey("rdo_apontamento.id"), index=True)
    organization_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    project_id:  Mapped[Optional[str]]   = mapped_column(String(100), index=True)
    nucleo:      Mapped[Optional[str]]   = mapped_column(String(100), index=True)
    trecho:      Mapped[Optional[str]]   = mapped_column(String(200))
    servico:     Mapped[Optional[str]]   = mapped_column(String(250))
    data:        Mapped[Optional[date]]  = mapped_column(Date, index=True)
    quantidade:  Mapped[Optional[float]] = mapped_column(Float)
    unidade:     Mapped[Optional[str]]   = mapped_column(String(30))
    responsavel: Mapped[Optional[str]]   = mapped_column(String(200))
    empreiteira: Mapped[Optional[str]]   = mapped_column(String(200))
    evidencia_id: Mapped[Optional[int]]  = mapped_column(Integer, ForeignKey("rdo_evidencia.id"))
    origem:      Mapped[str]             = mapped_column(String(50), default="rdo")
    status:      Mapped[str]             = mapped_column(String(50), default="pendente")
    criado_em:   Mapped[datetime]        = mapped_column(DateTime, default=datetime.now)

    rdo: Mapped["RDO"] = relationship("RDO", back_populates="medicao_fontes")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "rdo_id": self.rdo_id, "apontamento_id": self.apontamento_id,
            "organization_id": self.organization_id, "project_id": self.project_id,
            "nucleo": self.nucleo, "trecho": self.trecho, "servico": self.servico,
            "data": str(self.data) if self.data else None,
            "quantidade": self.quantidade, "unidade": self.unidade,
            "responsavel": self.responsavel, "empreiteira": self.empreiteira,
            "evidencia_id": self.evidencia_id, "origem": self.origem, "status": self.status,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
        }


class RDOQualidadeSinal(Base):
    __tablename__ = "rdo_qualidade_sinal"

    id:          Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    rdo_id:      Mapped[int]             = mapped_column(Integer, ForeignKey("rdo.id"), index=True)
    apontamento_id: Mapped[Optional[int]]= mapped_column(Integer, ForeignKey("rdo_apontamento.id"), index=True)
    organization_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    severidade:  Mapped[str]             = mapped_column(String(20), default="MEDIA")
    tipo:        Mapped[str]             = mapped_column(String(80), default="PENDENCIA_QUALIDADE")
    descricao:   Mapped[Optional[str]]   = mapped_column(Text)
    exige_fvs:   Mapped[bool]            = mapped_column(Boolean, default=False)
    evidencia_ok: Mapped[bool]           = mapped_column(Boolean, default=True)
    status:      Mapped[str]             = mapped_column(String(50), default="aberto")
    criado_em:   Mapped[datetime]        = mapped_column(DateTime, default=datetime.now)

    rdo: Mapped["RDO"] = relationship("RDO", back_populates="qualidade_sinais")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "rdo_id": self.rdo_id, "apontamento_id": self.apontamento_id,
            "organization_id": self.organization_id, "severidade": self.severidade,
            "tipo": self.tipo, "descricao": self.descricao, "exige_fvs": self.exige_fvs,
            "evidencia_ok": self.evidencia_ok, "status": self.status,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
        }


# ---------------------------------------------------------------------------
# Checklist NS
# ---------------------------------------------------------------------------

CHECKLIST_PADRAO = [
    "Escavação de vala",
    "Lastro/berço de areia",
    "Assentamento de tubulação",
    "Teste de estanqueidade",
    "Reaterro compactado",
    "Recomposição de pavimento",
    "Montagem de PV/PI",
    "Ligação predial",
]


class ChecklistNS(Base):
    __tablename__ = "checklist_ns"

    id:          Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    ns_id:       Mapped[int]             = mapped_column(Integer, ForeignKey("ns.id"), index=True)
    item:        Mapped[str]             = mapped_column(String(200))
    concluido:   Mapped[bool]            = mapped_column(Boolean, default=False)
    data:        Mapped[Optional[datetime]] = mapped_column(DateTime)
    foto_id:     Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("rdo_foto.id"))
    responsavel: Mapped[Optional[str]]   = mapped_column(String(200))

    ns: Mapped["NS"] = relationship("NS", back_populates="checklist")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "ns_id": self.ns_id,
            "item": self.item, "concluido": self.concluido,
            "data": str(self.data) if self.data else None,
            "responsavel": self.responsavel,
        }


class WhatsAppSession(Base):
    __tablename__ = "whatsapp_session"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telefone: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    estado: Mapped[str] = mapped_column(String(50), default="IDLE")
    nucleo: Mapped[Optional[str]] = mapped_column(String(100))
    rdo_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("rdo.id"))
    ns_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("ns.id"))
    contexto_json: Mapped[Optional[str]] = mapped_column(Text)
    ultima_mensagem: Mapped[Optional[str]] = mapped_column(Text)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "telefone": self.telefone,
            "estado": self.estado,
            "nucleo": self.nucleo,
            "rdo_id": self.rdo_id,
            "ns_id": self.ns_id,
            "contexto_json": self.contexto_json,
            "ultima_mensagem": self.ultima_mensagem,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
            "atualizado_em": self.atualizado_em.isoformat() if self.atualizado_em else None,
        }


# ---------------------------------------------------------------------------
# Enums — Ciclo Operacional
# ---------------------------------------------------------------------------

class SeveridadeDesvio(str, enum.Enum):
    BAIXA    = "BAIXA"
    MEDIA    = "MEDIA"
    ALTA     = "ALTA"
    CRITICA  = "CRITICA"


class StatusPlanejamento(str, enum.Enum):
    RASCUNHO    = "RASCUNHO"
    ATIVO       = "ATIVO"
    ENCERRADO   = "ENCERRADO"
    SUBSTITUIDO = "SUBSTITUIDO"


class StatusReplanejamento(str, enum.Enum):
    RASCUNHO  = "RASCUNHO"
    APROVADO  = "APROVADO"
    REJEITADO = "REJEITADO"
    APLICADO  = "APLICADO"


# ---------------------------------------------------------------------------
# Models — Ciclo Operacional
# ---------------------------------------------------------------------------

class OperationalLog(Base):
    """Log centralizado de eventos operacionais."""
    __tablename__ = "operational_log"

    id:            Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    subsystem:     Mapped[str]             = mapped_column(String(100), index=True)
    severity:      Mapped[str]             = mapped_column(String(20), default="INFO")
    event_type:    Mapped[str]             = mapped_column(String(100), index=True)
    status:        Mapped[str]             = mapped_column(String(50), default="OK")
    error_message: Mapped[Optional[str]]   = mapped_column(Text)
    payload:       Mapped[Optional[str]]   = mapped_column(Text)
    project_id:    Mapped[Optional[str]]   = mapped_column(String(100))
    telefone:      Mapped[Optional[str]]   = mapped_column(String(50))
    nucleo:        Mapped[Optional[str]]   = mapped_column(String(100), index=True)
    criado_em:     Mapped[datetime]        = mapped_column(DateTime, default=datetime.now)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "subsystem": self.subsystem, "severity": self.severity,
            "event_type": self.event_type, "status": self.status,
            "error_message": self.error_message, "payload": self.payload,
            "project_id": self.project_id, "telefone": self.telefone,
            "nucleo": self.nucleo,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
        }


class PlanejamentoSemanal(Base):
    """Plano semanal do engenheiro para um nucleo."""
    __tablename__ = "planejamento_semanal"

    id:            Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    nucleo:        Mapped[str]             = mapped_column(String(100), index=True)
    semana_inicio: Mapped[date]            = mapped_column(Date)
    semana_fim:    Mapped[date]            = mapped_column(Date)
    engenheiro:    Mapped[Optional[str]]   = mapped_column(String(200))
    responsavel:   Mapped[Optional[str]]   = mapped_column(String(200))
    status:        Mapped[str]             = mapped_column(Enum(StatusPlanejamento), default=StatusPlanejamento.RASCUNHO)
    observacao:    Mapped[Optional[str]]   = mapped_column(Text)
    criado_em:     Mapped[datetime]        = mapped_column(DateTime, default=datetime.now)
    atualizado_em: Mapped[datetime]        = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    itens:      Mapped[list["PlanejamentoItem"]]     = relationship("PlanejamentoItem", back_populates="planejamento", cascade="all, delete-orphan")
    validacoes: Mapped[list["PlanejamentoValidacao"]] = relationship("PlanejamentoValidacao", back_populates="planejamento", cascade="all, delete-orphan")
    desvios:    Mapped[list["DesvioPlanejamento"]]    = relationship("DesvioPlanejamento", back_populates="planejamento", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "nucleo": self.nucleo,
            "semana_inicio": str(self.semana_inicio), "semana_fim": str(self.semana_fim),
            "engenheiro": self.engenheiro, "responsavel": self.responsavel,
            "status": self.status.value if isinstance(self.status, StatusPlanejamento) else self.status,
            "observacao": self.observacao,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
            "atualizado_em": self.atualizado_em.isoformat() if self.atualizado_em else None,
            "itens": [i.to_dict() for i in self.itens] if self.itens else [],
            "validacoes": [v.to_dict() for v in self.validacoes] if self.validacoes else [],
        }


class PlanejamentoItem(Base):
    """Item/atividade dentro de um planejamento semanal."""
    __tablename__ = "planejamento_item"

    id:              Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    planejamento_id: Mapped[int]             = mapped_column(Integer, ForeignKey("planejamento_semanal.id"), index=True)
    atividade:       Mapped[str]             = mapped_column(String(300))
    meta_quantidade: Mapped[Optional[float]] = mapped_column(Float)
    unidade:         Mapped[Optional[str]]   = mapped_column(String(50))
    equipe_prevista: Mapped[Optional[int]]   = mapped_column(Integer)
    custo_previsto:  Mapped[Optional[float]] = mapped_column(Float)
    data_inicio:     Mapped[Optional[date]]  = mapped_column(Date)
    data_fim:        Mapped[Optional[date]]  = mapped_column(Date)
    restricoes:      Mapped[Optional[str]]   = mapped_column(Text)

    planejamento: Mapped["PlanejamentoSemanal"] = relationship("PlanejamentoSemanal", back_populates="itens")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "planejamento_id": self.planejamento_id,
            "atividade": self.atividade, "meta_quantidade": self.meta_quantidade,
            "unidade": self.unidade, "equipe_prevista": self.equipe_prevista,
            "custo_previsto": self.custo_previsto,
            "data_inicio": str(self.data_inicio) if self.data_inicio else None,
            "data_fim": str(self.data_fim) if self.data_fim else None,
            "restricoes": self.restricoes,
        }


class PlanejamentoValidacao(Base):
    """Aprovacao/rejeicao de um planejamento pelo diretor."""
    __tablename__ = "planejamento_validacao"

    id:              Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    planejamento_id: Mapped[int]             = mapped_column(Integer, ForeignKey("planejamento_semanal.id"), index=True)
    aprovado:        Mapped[bool]            = mapped_column(Boolean, default=False)
    diretor:         Mapped[Optional[str]]   = mapped_column(String(200))
    observacao:      Mapped[Optional[str]]   = mapped_column(Text)
    criado_em:       Mapped[datetime]        = mapped_column(DateTime, default=datetime.now)

    planejamento: Mapped["PlanejamentoSemanal"] = relationship("PlanejamentoSemanal", back_populates="validacoes")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "planejamento_id": self.planejamento_id,
            "aprovado": self.aprovado, "diretor": self.diretor,
            "observacao": self.observacao,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
        }


class DesvioPlanejamento(Base):
    """Desvio detectado entre planejado (item) e realizado (RDO)."""
    __tablename__ = "desvio_planejamento"

    id:                Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    planejamento_id:   Mapped[int]             = mapped_column(Integer, ForeignKey("planejamento_semanal.id"), index=True)
    rdo_id:            Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("rdo.id"))
    item_id:           Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("planejamento_item.id"))
    atividade:         Mapped[str]             = mapped_column(String(300))
    meta:              Mapped[Optional[float]] = mapped_column(Float)
    realizado:         Mapped[Optional[float]] = mapped_column(Float)
    desvio_quantidade: Mapped[Optional[float]] = mapped_column(Float)
    desvio_percentual: Mapped[Optional[float]] = mapped_column(Float)
    desvio_custo:      Mapped[Optional[float]] = mapped_column(Float)
    severidade:        Mapped[str]             = mapped_column(Enum(SeveridadeDesvio), default=SeveridadeDesvio.BAIXA)
    spi:               Mapped[Optional[float]] = mapped_column(Float)
    cpi:               Mapped[Optional[float]] = mapped_column(Float)
    ppc:               Mapped[Optional[float]] = mapped_column(Float)
    acao_recomendada:  Mapped[Optional[str]]   = mapped_column(Text)
    criado_em:         Mapped[datetime]        = mapped_column(DateTime, default=datetime.now)

    planejamento: Mapped["PlanejamentoSemanal"] = relationship("PlanejamentoSemanal", back_populates="desvios")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "planejamento_id": self.planejamento_id,
            "rdo_id": self.rdo_id, "item_id": self.item_id,
            "atividade": self.atividade, "meta": self.meta,
            "realizado": self.realizado, "desvio_quantidade": self.desvio_quantidade,
            "desvio_percentual": self.desvio_percentual, "desvio_custo": self.desvio_custo,
            "severidade": self.severidade.value if isinstance(self.severidade, SeveridadeDesvio) else self.severidade,
            "spi": self.spi, "cpi": self.cpi, "ppc": self.ppc,
            "acao_recomendada": self.acao_recomendada,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
        }


class MLExecucao(Base):
    """Registro de execucao ML (XGBoost ou fallback deterministico)."""
    __tablename__ = "ml_execucao"

    id:              Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    nucleo:          Mapped[str]             = mapped_column(String(100), index=True)
    tipo:            Mapped[str]             = mapped_column(String(50))
    resultado_json:  Mapped[Optional[str]]   = mapped_column(Text)
    n_desvios:       Mapped[Optional[int]]   = mapped_column(Integer)
    confianca:       Mapped[Optional[float]] = mapped_column(Float)
    criado_em:       Mapped[datetime]        = mapped_column(DateTime, default=datetime.now)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "nucleo": self.nucleo, "tipo": self.tipo,
            "resultado_json": self.resultado_json,
            "n_desvios": self.n_desvios, "confianca": self.confianca,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
        }


class Replanejamento(Base):
    """Replanejamento gerado por ML/fallback, pendente de aprovacao do diretor."""
    __tablename__ = "replanejamento"

    id:              Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    nucleo:          Mapped[str]             = mapped_column(String(100), index=True)
    ml_execucao_id:  Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("ml_execucao.id"))
    status:          Mapped[str]             = mapped_column(Enum(StatusReplanejamento), default=StatusReplanejamento.RASCUNHO)
    sugestoes_json:  Mapped[Optional[str]]   = mapped_column(Text)
    diretor:         Mapped[Optional[str]]   = mapped_column(String(200))
    observacao:      Mapped[Optional[str]]   = mapped_column(Text)
    criado_em:       Mapped[datetime]        = mapped_column(DateTime, default=datetime.now)
    atualizado_em:   Mapped[datetime]        = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "nucleo": self.nucleo,
            "ml_execucao_id": self.ml_execucao_id,
            "status": self.status.value if isinstance(self.status, StatusReplanejamento) else self.status,
            "sugestoes_json": self.sugestoes_json,
            "diretor": self.diretor, "observacao": self.observacao,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
            "atualizado_em": self.atualizado_em.isoformat() if self.atualizado_em else None,
        }
