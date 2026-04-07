#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MODELOS DE DADOS — Classes PV, Trecho e Rede
Inspirado no Bentley SewerCAD (Structure, Pipe, Network)
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
from datetime import datetime


class TipoPV(Enum):
    """Tipos de Poço de Visita (similar a Structure no SewerCAD)."""
    PV = "PV"           # Poço de Visita
    PI = "PI"           # Poço de Inspeção
    PM = "PM"           # Poço de Mudança
    PT = "PT"           # Poço de Terminal
    QE = "QE"           # Queda
    DE = "DE"           # Degrau
    RG = "RG"           # Registro (água)
    TE = "TE"           # Te (água)
    C90 = "C90"         # Curva 90° (água)
    C45 = "C45"         # Curva 45° (água)
    CAP = "CAP"         # Cap (água)
    RED = "RED"         # Redução (água)
    CURVA = "CURVA"     # Curva genérica (água)
    ND = "ND"           # Nó sintético (sem dado)


class MaterialTubo(Enum):
    """Materiais de tubo (similar a Pipe Material no SewerCAD)."""
    PVC = "PVC"
    PEAD = "PEAD"
    PE80 = "PE80"
    PE100 = "PE100"
    CONCRETO = "CONCRETO"
    FERRO_FUNDIDO = "FF"
    GRIS = "GRIS"       # Ferro fundido dúctil
    HDPE = "HDPE"       # High Density Polyethylene


class StatusHidraulico(Enum):
    """Status hidráulico do trecho."""
    OK = "OK"
    VERIFICAR = "VERIFICAR"
    ERRO = "ERRO"
    SEM_DADOS = "SEM_DADOS"


@dataclass
class PV:
    """
    Poço de Visita (similar a Structure no SewerCAD).
    
    Atributos:
        id: Identificador único (ex: PV_001, PI_023, N_TE_001)
        tipo: Tipo de PV (PV, PI, RG, TE, etc.)
        x, y: Coordenadas (UTM ou locais)
        ct: Cota do terreno (m)
        cf: Cota de fundo (geratriz inferior) (m)
        prof: Profundidade (m)
        diametro_tampa: Diâmetro da tampa (m) - padrão 0.60m
        grau: Número de conexões (calculado automaticamente)
        nucleo: Nome do núcleo (ex: "Morro do Teteu")
        sintético: True se foi criado automaticamente (não tem dado de campo)
    """
    id: str
    tipo: TipoPV = TipoPV.PV
    x: Optional[float] = None
    y: Optional[float] = None
    ct: Optional[float] = None
    cf: Optional[float] = None
    prof: Optional[float] = None
    diametro_tampa: float = 0.60
    grau: int = 0
    nucleo: str = ""
    sintético: bool = False
    
    # Dados calculados
    ct_calculado: Optional[float] = None
    cf_calculado: Optional[float] = None
    
    def __post_init__(self):
        """Valida após inicialização."""
        if isinstance(self.tipo, str):
            self.tipo = TipoPV(self.tipo)
    
    @property
    def profundidade_real(self) -> Optional[float]:
        """Calcula profundidade real (CT - CF)."""
        if self.ct is not None and self.cf is not None:
            return round(self.ct - self.cf, 3)
        return self.prof
    
    @property
    def tem_coords(self) -> bool:
        """Verifica se tem coordenadas válidas."""
        return self.x is not None and self.y is not None
    
    @property
    def tem_cotas(self) -> bool:
        """Verifica se tem cotas (CT/CF)."""
        return self.ct is not None and self.cf is not None
    
    def validar(self) -> List[str]:
        """
        Valida PV.
        
        Retorna:
            Lista de strings com erros encontrados.
        """
        erros = []
        
        if not self.id:
            erros.append("ID vazio")
        
        if not self.tem_coords:
            erros.append("Sem coordenadas")
        
        prof = self.profundidade_real
        if prof is not None:
            if prof < 0.30:
                erros.append(f"Profundidade {prof:.2f}m < 0.30m (mínimo)")
            elif prof > 10.0:
                erros.append(f"Profundidade {prof:.2f}m > 10.0m (máximo)")
        
        if self.sintético:
            erros.append("PV sintético (sem dado de campo)")
        
        return erros
    
    def to_dict(self) -> dict:
        """Converte para dict (compatibilidade com código legado)."""
        return {
            "id": self.id,
            "tipo": self.tipo.value if isinstance(self.tipo, TipoPV) else self.tipo,
            "x": self.x,
            "y": self.y,
            "ct": self.ct,
            "cf": self.cf,
            "prof": self.prof,
            "diametro_tampa": self.diametro_tampa,
            "grau": self.grau,
            "nucleo": self.nucleo,
            "sintético": self.sintético,
            "profundidade_real": self.profundidade_real,
        }
    
    @classmethod
    def from_dict(cls, d: dict) -> "PV":
        """Cria PV a partir de dict (compatibilidade com código legado)."""
        return cls(
            id=d.get("id", d.get("nome", "PV_???")),
            tipo=d.get("tipo", "PV"),
            x=d.get("x"),
            y=d.get("y"),
            ct=d.get("ct"),
            cf=d.get("cf"),
            prof=d.get("prof"),
            nucleo=d.get("nucleo", ""),
            sintético=d.get("sintetico", d.get("sintético", False)),
        )


@dataclass
class Trecho:
    """
    Trecho/Tubo (similar a Pipe no SewerCAD).
    
    Atributos:
        id: Identificador único (inteiro sequencial)
        pv_ini: ID do PV de montante (início)
        pv_fim: ID do PV de jusante (fim)
        material: Material do tubo (PVC, PEAD, etc.)
        dn_mm: Diâmetro nominal (mm)
        ext_m: Extensão (m)
        decl_pct: Declividade (%)
        rua: Nome da rua
        layer: Layer de origem no DXF
        is_agua: True se é rede de água
    """
    id: int
    pv_ini: str
    pv_fim: str
    material: MaterialTubo = MaterialTubo.PVC
    dn_mm: Optional[int] = None
    ext_m: Optional[float] = None
    decl_pct: Optional[float] = None
    rua: Optional[str] = None
    layer: Optional[str] = None
    is_agua: bool = False
    
    # Dados hidráulicos calculados
    velocidade_ms: Optional[float] = None
    vazao_ls: Optional[float] = None
    lamina_m: Optional[float] = None
    tensao_trativa_pa: Optional[float] = None
    status: StatusHidraulico = StatusHidraulico.SEM_DADOS
    
    # Cotas dos PVs (cópia para facilitar cálculos)
    ct_ini: Optional[float] = None
    ct_fim: Optional[float] = None
    cf_ini: Optional[float] = None
    cf_fim: Optional[float] = None
    prof_ini: Optional[float] = None
    prof_fim: Optional[float] = None
    
    # Custos (opcional)
    custos: Optional[dict] = None
    
    def __post_init__(self):
        """Valida após inicialização."""
        if isinstance(self.material, str):
            self.material = MaterialTubo(self.material)
        if isinstance(self.status, str):
            self.status = StatusHidraulico(self.status)
    
    @property
    def decl_mpm(self) -> Optional[float]:
        """Declividade em m/m (metros por metro)."""
        if self.decl_pct is not None:
            return self.decl_pct / 100.0
        return None
    
    @property
    def ext_m_valida(self) -> bool:
        """Verifica se extensão é válida (0.5m a 500m)."""
        if self.ext_m is None:
            return False
        return 0.5 <= self.ext_m <= 500.0
    
    @property
    def dn_valido(self) -> bool:
        """Verifica se DN é válido (50mm a 2000mm)."""
        if self.dn_mm is None:
            return False
        return 50 <= self.dn_mm <= 2000
    
    def validar(self) -> List[str]:
        """
        Valida trecho (similar a validation no SewerCAD).
        
        Retorna:
            Lista de strings com erros/avisos encontrados.
        """
        erros = []
        avisos = []
        
        # Validações geométricas
        if not self.ext_m_valida:
            erros.append(f"Extensão {self.ext_m}m fora do faixa (0.5-500m)")
        
        if not self.dn_valido:
            avisos.append(f"DN {self.dn_mm}mm fora do faixa usual (50-2000mm)")
        
        if self.decl_mpm is not None and self.decl_mpm < 0.002:
            avisos.append(f"Declividade {self.decl_pct:.3f}% < 0.2% (mínimo recomendado)")
        
        # Validações hidráulicas
        if self.velocidade_ms is not None:
            if self.velocidade_ms < 0.6:
                avisos.append(f"Velocidade {self.velocidade_ms:.2f} m/s < 0.6 m/s (autolimpeza)")
            elif self.velocidade_ms > 5.0:
                erros.append(f"Velocidade {self.velocidade_ms:.2f} m/s > 5.0 m/s (máximo)")
        
        if self.tensao_trativa_pa is not None and self.tensao_trativa_pa < 1.0:
            avisos.append(f"Tensão trativa {self.tensao_trativa_pa:.2f} Pa < 1.0 Pa (mínimo)")
        
        # Status
        if self.status == StatusHidraulico.ERRO:
            erros.append("Status hidráulico: ERRO")
        elif self.status == StatusHidraulico.VERIFICAR:
            avisos.append("Status hidráulico: VERIFICAR")
        
        return erros + avisos
    
    def to_dict(self) -> dict:
        """Converte para dict (compatibilidade com código legado)."""
        return {
            "id": self.id,
            "pv_ini": self.pv_ini,
            "pv_fim": self.pv_fim,
            "material": self.material.value if isinstance(self.material, MaterialTubo) else self.material,
            "dn_mm": self.dn_mm,
            "ext_m": self.ext_m,
            "decl_pct": self.decl_pct,
            "decl_mpm": self.decl_mpm,
            "rua": self.rua,
            "layer": self.layer,
            "is_agua": self.is_agua,
            "velocidade_ms": self.velocidade_ms,
            "vazao_ls": self.vazao_ls,
            "lamina_m": self.lamina_m,
            "tensao_trativa_pa": self.tensao_trativa_pa,
            "status": self.status.value if isinstance(self.status, StatusHidraulico) else self.status,
            "ct_ini": self.ct_ini,
            "ct_fim": self.ct_fim,
            "cf_ini": self.cf_ini,
            "cf_fim": self.cf_fim,
            "prof_ini": self.prof_ini,
            "prof_fim": self.prof_fim,
        }
    
    @classmethod
    def from_dict(cls, d: dict) -> "Trecho":
        """Cria Trecho a partir de dict (compatibilidade com código legado)."""
        return cls(
            id=d.get("id", d.get("ns_id", 0)),
            pv_ini=d.get("pv_ini", ""),
            pv_fim=d.get("pv_fim", ""),
            material=d.get("material", "PVC"),
            dn_mm=d.get("dn_mm"),
            ext_m=d.get("ext_m"),
            decl_pct=d.get("decl_pct"),
            rua=d.get("rua"),
            layer=d.get("layer"),
            is_agua=d.get("is_agua", False),
            velocidade_ms=d.get("velocidade_ms"),
            vazao_ls=d.get("vazao_ls"),
            tensao_trativa_pa=d.get("tensao_trativa_pa"),
            status=d.get("status", "SEM_DADOS"),
            ct_ini=d.get("ct_ini"),
            ct_fim=d.get("ct_fim"),
            cf_ini=d.get("cf_ini"),
            cf_fim=d.get("cf_fim"),
            prof_ini=d.get("prof_ini"),
            prof_fim=d.get("prof_fim"),
        )


@dataclass
class Rede:
    """
    Rede completa (similar a Network no SewerCAD).
    
    Atributos:
        nome: Nome da rede (ex: "Morro do Teteu - Esgoto")
        nucleo: Nome do núcleo
        tipo_rede: "ESGOTO" ou "AGUA"
        data_processamento: Data/hora do processamento
        pvs: Dicionário de PVs (chave = id)
        trechos: Lista de trechos
    """
    nome: str
    nucleo: str
    tipo_rede: str = "ESGOTO"
    data_processamento: datetime = field(default_factory=datetime.now)
    pvs: Dict[str, PV] = field(default_factory=dict)
    trechos: List[Trecho] = field(default_factory=list)
    
    @property
    def total_pvs(self) -> int:
        """Total de PVs."""
        return len(self.pvs)
    
    @property
    def total_trechos(self) -> int:
        """Total de trechos."""
        return len(self.trechos)
    
    @property
    def extensao_total(self) -> float:
        """Extensão total da rede (m)."""
        return sum(t.ext_m or 0 for t in self.trechos)
    
    @property
    def custo_total(self) -> float:
        """Custo total estimado (R$)."""
        return sum((t.custos or {}).get("total_R", 0) for t in self.trechos)
    
    def adicionar_pv(self, pv: PV):
        """Adiciona PV à rede."""
        self.pvs[pv.id] = pv
    
    def adicionar_trecho(self, trecho: Trecho):
        """Adiciona trecho à rede e atualiza grau dos PVs."""
        self.trechos.append(trecho)
        
        # Atualizar grau dos PVs conectados
        if trecho.pv_ini in self.pvs:
            self.pvs[trecho.pv_ini].grau += 1
        if trecho.pv_fim in self.pvs:
            self.pvs[trecho.pv_fim].grau += 1
    
    def get_pv(self, pv_id: str) -> Optional[PV]:
        """Obtém PV por ID."""
        return self.pvs.get(pv_id)
    
    def get_trechos_por_pv(self, pv_id: str) -> List[Trecho]:
        """Obtém todos os trechos conectados a um PV."""
        return [t for t in self.trechos if t.pv_ini == pv_id or t.pv_fim == pv_id]
    
    def validar(self) -> dict:
        """
        Valida toda a rede (similar a validation no SewerCAD).
        
        Retorna:
            Dicionário com resultados da validação.
        """
        resultados = {
            "total_pvs": self.total_pvs,
            "total_trechos": self.total_trechos,
            "extensao_total": self.extensao_total,
            "erros_pvs": [],
            "erros_trechos": [],
            "erros_rede": [],
            "avisos": [],
        }
        
        # Validar PVs
        pvs_sinteticos = 0
        for pv_id, pv in self.pvs.items():
            erros = pv.validar()
            if erros:
                if "sintético" in str(erros):
                    pvs_sinteticos += 1
                resultados["erros_pvs"].append({
                    "pv": pv_id,
                    "erros": erros
                })
        
        resultados["pvs_sinteticos"] = pvs_sinteticos
        resultados["pvs_reais"] = self.total_pvs - pvs_sinteticos
        
        # Validar trechos
        for trecho in self.trechos:
            erros = trecho.validar()
            if erros:
                resultados["erros_trechos"].append({
                    "trecho": f"{trecho.pv_ini}->{trecho.pv_fim}",
                    "erros": erros
                })
        
        # Validar rede (ciclos, desconexões)
        self._validar_conectividade(resultados)
        self._validar_ciclos(resultados)
        
        return resultados
    
    def _validar_conectividade(self, resultados: dict):
        """Valida se todos PVs estão conectados."""
        try:
            import networkx as nx
            
            G = nx.Graph()
            for t in self.trechos:
                G.add_edge(t.pv_ini, t.pv_fim)
            
            n_componentes = nx.number_connected_components(G)
            if n_componentes > 1:
                resultados["erros_rede"].append(
                    f"Rede desconectada: {n_componentes} componentes"
                )
                
                # Listar componentes
                componentes = sorted(nx.connected_components(G), key=len, reverse=True)
                for i, comp in enumerate(componentes[:5], 1):
                    resultados["erros_rede"].append(
                        f"  Componente {i}: {len(comp)} PVs"
                    )
        except ImportError:
            pass  # networkx não disponível
    
    def _validar_ciclos(self, resultados: dict):
        """Detecta ciclos na rede (só para esgoto)."""
        if self.tipo_rede == "AGUA":
            return  # Água pode ter ciclos (malhados)
        
        try:
            import networkx as nx
            
            G = nx.DiGraph()
            for t in self.trechos:
                G.add_edge(t.pv_ini, t.pv_fim)
            
            ciclos = list(nx.simple_cycles(G))
            if ciclos:
                resultados["erros_rede"].append(f"Ciclos detectados: {len(ciclos)}")
                for ciclo in ciclos[:3]:
                    resultados["erros_rede"].append(
                        f"  Ciclo: {' -> '.join(ciclo[:5])}"
                    )
        except ImportError:
            pass  # networkx não disponível
    
    def estatisticas(self) -> dict:
        """
        Calcula estatísticas da rede.
        
        Retorna:
            Dicionário com estatísticas.
        """
        # DN
        dns = [t.dn_mm for t in self.trechos if t.dn_mm]
        dn_counts = {}
        for dn in dns:
            dn_counts[dn] = dn_counts.get(dn, 0) + 1
        
        # Status hidráulico
        status_counts = {}
        for t in self.trechos:
            status = t.status.value if isinstance(t.status, StatusHidraulico) else t.status
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Velocidades
        velocidades = [t.velocidade_ms for t in self.trechos if t.velocidade_ms]
        vel_media = sum(velocidades) / len(velocidades) if velocidades else None
        vel_max = max(velocidades) if velocidades else None
        vel_min = min(velocidades) if velocidades else None
        
        # Profundidades
        profs = [pv.profundidade_real for pv in self.pvs.values() if pv.profundidade_real]
        prof_media = sum(profs) / len(profs) if profs else None
        prof_max = max(profs) if profs else None
        prof_min = min(profs) if profs else None
        
        return {
            "total_pvs": self.total_pvs,
            "total_trechos": self.total_trechos,
            "extensao_total": self.extensao_total,
            "dn_counts": dn_counts,
            "dn_medio": sum(dns) / len(dns) if dns else None,
            "status_counts": status_counts,
            "velocidade_media": vel_media,
            "velocidade_max": vel_max,
            "velocidade_min": vel_min,
            "profundidade_media": prof_media,
            "profundidade_max": prof_max,
            "profundidade_min": prof_min,
            "pvs_sinteticos": sum(1 for pv in self.pvs.values() if pv.sintético),
        }
    
    def to_dict(self) -> dict:
        """Converte para dict."""
        return {
            "nome": self.nome,
            "nucleo": self.nucleo,
            "tipo_rede": self.tipo_rede,
            "data_processamento": self.data_processamento.isoformat(),
            "pvs": {k: v.to_dict() for k, v in self.pvs.items()},
            "trechos": [t.to_dict() for t in self.trechos],
            "estatisticas": self.estatisticas(),
        }
    
    @classmethod
    def from_dict(cls, d: dict) -> "Rede":
        """Cria Rede a partir de dict."""
        rede = cls(
            nome=d.get("nome", "Rede"),
            nucleo=d.get("nucleo", ""),
            tipo_rede=d.get("tipo_rede", "ESGOTO"),
        )
        
        # Carregar PVs
        for pv_id, pv_dict in d.get("pvs", {}).items():
            rede.pvs[pv_id] = PV.from_dict(pv_dict)
        
        # Carregar trechos
        for t_dict in d.get("trechos", []):
            rede.trechos.append(Trecho.from_dict(t_dict))
        
        return rede
    
    def exportar_geojson(self) -> dict:
        """Exporta rede como GeoJSON."""
        features = []
        
        for trecho in self.trechos:
            pv_ini = self.pvs.get(trecho.pv_ini)
            pv_fim = self.pvs.get(trecho.pv_fim)
            
            if pv_ini and pv_fim and pv_ini.tem_coords and pv_fim.tem_coords:
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [pv_ini.x, pv_ini.y],
                            [pv_fim.x, pv_fim.y]
                        ]
                    },
                    "properties": trecho.to_dict()
                })
        
        return {
            "type": "FeatureCollection",
            "crs": {
                "type": "name",
                "properties": {"name": "urn:ogc:def:crs:EPSG::31983"}
            },
            "features": features
        }
