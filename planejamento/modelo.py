"""Modelo de dados da tabela única de planejamento.

Hierarquia: Setor (Bacia) -> Coletor -> Trecho -> Nota de Serviço.
Independente do CAD: dataclasses puras, sem dependência de GDAL/ezdxf.
Setor segue o conceito BACIAS do QEsg; defaults vêm de TBCP_ESG.DAT do pro_sane.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class TipoServico(Enum):
    ASSENTAMENTO_TUBO = "assentamento_tubo"
    CAIXA = "caixa"
    CAIXA_INSPECAO = "caixa_inspecao"
    INTERLIGACAO = "interligacao"
    PAVIMENTACAO = "pavimentacao"


class StatusNS(Enum):
    PLANEJADO = "planejado"
    EM_EXECUCAO = "em_execucao"
    EXECUTADO = "executado"
    BLOQUEADO = "bloqueado"


@dataclass
class Setor:
    """Bacia/setor de esgotamento (setorização — conceito BACIAS do QEsg)."""
    id: str
    pop_ini: int = 0
    pop_fim: int = 0
    percapta: float = 150.0     # L/hab.dia (default TBCP_ESG.DAT residencial popular)
    k1_dia: float = 1.2
    k2_hora: float = 1.5
    coef_ret: float = 0.8
    coef_inf: float = 0.0002    # L/s.m


@dataclass
class Atividade:
    """Uma atividade de uma NS, feita por uma equipe especializada."""
    tipo: TipoServico
    equipe_tipo: str                        # "rede", "caixa", "inspecao", "interligacao"
    qtd_material: float = 0.0
    unidade: str = "m"
    produtiv_prev: Optional[float] = None    # avanço/dia previsto (vem do ML, Fase 3)
    produtiv_min: Optional[float] = None     # piso/meta para a equipe
    duracao_prev_dias: Optional[float] = None
    avanco_real: float = 0.0                 # preenchido pelo RDO (Fase 4)

    def calc_duracao(self) -> Optional[float]:
        if self.produtiv_prev and self.produtiv_prev > 0:
            self.duracao_prev_dias = self.qtd_material / self.produtiv_prev
        return self.duracao_prev_dias


@dataclass
class NotaServico:
    """Pacote de trabalho. Título no padrão NUM_OSE.DEF do pro_sane:
    'NS011 TUBO DE QUEDA PI22 ATÉ PV11 SÃO MANOEL'."""
    ns_id: str
    descricao: str
    nucleo: str = ""
    setor: Optional[str] = None             # id do Setor/bacia
    coletor: Optional[str] = None
    trecho_ids: List[int] = field(default_factory=list)
    atividades: List[Atividade] = field(default_factory=list)
    status: StatusNS = StatusNS.PLANEJADO

    def titulo(self) -> str:
        return " ".join(p for p in (self.ns_id, self.descricao, self.nucleo) if p)

    def duracao_total_dias(self) -> float:
        return sum((a.calc_duracao() or 0.0) for a in self.atividades)
