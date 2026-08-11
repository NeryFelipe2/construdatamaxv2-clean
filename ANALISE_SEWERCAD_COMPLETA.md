# 🔍 ANÁLISE COMPLETA: BENTLEY SEWERCAD vs CONSTRUDATA

**Data:** 20/03/2026  
**Local:** C:\Program Files (x86)\Bentley\SewerCAD\  
**Objetivo:** Aprender com o SewerCAD para melhorar o ConstruData

---

## 📊 VISÃO GERAL DO SEWERCAD

### Arquitetura do Software:

```
SewerCAD (Haestad Methods)
├── Motor de Cálculo Hidráulico
│   ├── Haestad.Calculations.SewerCAD.dll
│   ├── Haestad.Calculations.SewerCAD.Domain.dll
│   ├── Haestad.Calculations.SewerCAD.OutputReader.dll
│   ├── Haestad.Calculations.GVFSolver.dll (Gradually Varied Flow)
│   ├── Haestad.Calculations.HHSolver.dll (Hydrology & Hydraulics)
│   └── Haestad.Calculations.SWMM5.dll (EPA SWMM5 engine)
│
├── Armazenamento de Dados
│   ├── SQLite (.stsw.sqlite)
│   ├── DWF (.dwh)
│   └── Banco de dados proprietário (.stsw)
│
├── Interface Gráfica
│   ├── DevExpress (UI components)
│   ├── Telerik.Windows.Controls
│   ├── Haestad.Drawing.* (renderização)
│   └── Haestad.Framework.Windows.Forms
│
├── Importação/Exportação
│   ├── Haestad.DgnDb.dll (Bentley DGN)
│   ├── Haestad.RealDWG.dll (AutoCAD DWG)
│   ├── Haestad.Support.LandXML.dll
│   └── Haestad.Shapefile.dll (GIS)
│
└── Model Builder
    ├── Haestad.ModelBuilder.dll
    ├── Haestad.LoadBuilder.* (carregamento de dados)
    └── Haestad.NetworkBuilder.dll (redes)
```

---

## 🏗️ ARQUITETURA DO CONSTRUDATA (ATUAL)

```
ConstruData SABESP v5.0
├── Pipeline Único
│   └── construdata_sabesp_v5_FINAL.py (4500+ linhas)
│
├── Bibliotecas Python
│   ├── ezdxf (leitura DXF)
│   ├── openpyxl (Excel OSE)
│   ├── matplotlib (gráficos)
│   ├── networkx (validação de rede)
│   └── pyproj (coordenadas UTM)
│
├── Saídas
│   ├── PDF (A4 campo, A3 prancha)
│   ├── Excel (OSE, custos)
│   ├── JSON (dados, Dynamo)
│   └── HTML (dashboard Leaflet)
│
└── Sem banco de dados
    └── Dados em memória (dict, list)
```

---

## 📚 LIÇÕES DO SEWERCAD

### 1️⃣ **ARQUITETURA MODULAR** ✅

**SewerCAD faz:**
- DLLs separadas por função (Cálculo, Domínio, Output, UI)
- Separação clara entre motor hidráulico e interface
- Múltiplos formatos de entrada/saída

**O que aprender:**
```python
# Dividir construdata_sabesp_v5_FINAL.py em módulos:
construdata/
├── core/
│   ├── extractor.py      # Extração DXF (atual: ler_dxf)
│   ├── snap.py           # Snap tubos-PVs (atual: _pv_mais_proximo)
│   ├── hydraulics.py     # Cálculos Manning (atual: calc_manning)
│   └── validator.py      # Validação rede (atual: validar_rede)
│
├── io/
│   ├── dxf_reader.py     # Leitura DXF
│   ├── excel_writer.py   # OSE, custos
│   ├── pdf_generator.py  # A4, A3
│   └── html_generator.py # Dashboard
│
├── models/
│   ├── pv.py             # Classe PV
│   ├── trecho.py         # Classe Trecho
│   └── rede.py           # Classe Rede
│
└── utils/
    ├── coords.py         # UTM, CRS
    ├── logging.py        # Logs
    └── config.py         # Configurações
```

**Vantagem:**
- Código mais manutenível
- Testes unitários por módulo
- Reutilização de código
- Mais fácil para outros LLMs entenderem

---

### 2️⃣ **BANCO DE DADOS SQLITE** 💾

**SewerCAD faz:**
- Armazena projeto em `.stsw.sqlite`
- Tabelas separadas para: PVs, Tubos, Ruas, Sub-bacias, Resultados
- Consultas SQL para relatórios
- Histórico de cenários

**O que aprender:**
```python
# Adicionar SQLite ao ConstruData
import sqlite3

class BancoDeDados:
    def __init__(self, db_path):
        self.conn = sqlite3.connect(db_path)
        self._criar_tabelas()
    
    def _criar_tabelas(self):
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS pvs (
                id TEXT PRIMARY KEY,
                tipo TEXT,
                x REAL, y REAL,
                ct REAL, cf REAL, prof REAL,
                nucleo TEXT
            )
        ''')
        
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS trechos (
                id INTEGER PRIMARY KEY,
                pv_ini TEXT,
                pv_fim TEXT,
                dn_mm INTEGER,
                ext_m REAL,
                decl_pct REAL,
                material TEXT,
                rua TEXT,
                vel_ms REAL,
                tau_pa REAL,
                status TEXT,
                FOREIGN KEY (pv_ini) REFERENCES pvs(id),
                FOREIGN KEY (pv_fim) REFERENCES pvs(id)
            )
        ''')
        
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS resultados_hidraulicos (
                trecho_id INTEGER,
                vazao_ls REAL,
                lamina_m REAL,
                tensao_trativa_pa REAL,
                velocidade_ms REAL,
                status TEXT,
                FOREIGN KEY (trecho_id) REFERENCES trechos(id)
            )
        ''')
    
    def salvar_pvs(self, pvs):
        for id, pv in pvs.items():
            self.conn.execute(
                'INSERT OR REPLACE INTO pvs VALUES (?,?,?,?,?,?,?,?,?)',
                (id, pv['tipo'], pv['x'], pv['y'], 
                 pv.get('ct'), pv.get('cf'), pv.get('prof'),
                 pv.get('nucleo'))
            )
        self.conn.commit()
    
    def salvar_trechos(self, trechos):
        for t in trechos:
            self.conn.execute(
                'INSERT INTO trechos VALUES (NULL,?,?,?,?,?,?,?,?,?,?)',
                (t['pv_ini'], t['pv_fim'], t.get('dn_mm'), 
                 t.get('ext_m'), t.get('decl_pct'), t.get('material'),
                 t.get('rua'), t.get('vel_ms'), t.get('tau_pa'),
                 t.get('status'))
            )
        self.conn.commit()
    
    def gerar_relatorio(self):
        cursor = self.conn.execute('''
            SELECT 
                COUNT(*) as total_trechos,
                AVG(vel_ms) as vel_media,
                AVG(tau_pa) as tau_medio,
                SUM(CASE WHEN status='OK' THEN 1 ELSE 0 END) as ok_count
            FROM trechos
        ''')
        return cursor.fetchone()
```

**Vantagens:**
- Dados persistentes (não precisa reprocessar DXF)
- Consultas complexas (SQL)
- Histórico de versões
- Comparação entre cenários
- Integração com GIS (QGIS lê SQLite)

---

### 3️⃣ **MOTOR HIDRÁULICO SEPARADO** ⚙️

**SewerCAD faz:**
- Motor EPA SWMM5 embutido (`Haestad.Calculations.SWMM5.dll`)
- Solver GVF (Gradually Varied Flow) próprio
- Cálculo dinâmico (routing)
- Múltiplos métodos: Manning, Hazen-Williams, Darcy-Weisbach

**O que aprender:**
```python
# Criar módulo hidráulico separado
# construdata/core/hydraulics.py

from dataclasses import dataclass
from enum import Enum
from typing import Optional

class MetodoHidraulico(Enum):
    MANNING = "manning"
    HAZEN_WILLIAMS = "hazen_williams"
    DARCY_WEISBACH = "darcy_weisbach"

@dataclass
class ResultadoCalculo:
    velocidade_ms: float
    vazao_ls: float
    lamina_m: float
    tensao_trativa_pa: float
    numero_froude: float
    status: str
    erros: list[str]

class MotorHidraulico:
    """Motor hidráulico unificado (similar ao SWMM5 do SewerCAD)."""
    
    def __init__(self, metodo: MetodoHidraulico = MetodoHidraulico.MANNING):
        self.metodo = metodo
    
    def calcular(self, trecho, pvs) -> ResultadoCalculo:
        """Calcula hidráulica para um trecho."""
        if self.metodo == MetodoHidraulico.MANNING:
            return self._manning_full(trecho, pvs)
        elif self.metodo == MetodoHidraulico.HAZEN_WILLIAMS:
            return self._hazen_williams(trecho, pvs)
        # ... outros métodos
    
    def _manning_full(self, trecho, pvs) -> ResultadoCalculo:
        """Cálculo completo Manning (seção plena + parcial)."""
        # Implementar:
        # 1. Seção plena
        # 2. Seção parcial (iterativo)
        # 3. Tensão trativa
        # 4. Número de Froude
        # 5. Validação (V min/max, tau min/max)
        pass
    
    def calcular_rede_completa(self, pvs, trechos) -> dict:
        """Calcula toda a rede (similar ao solver do SewerCAD)."""
        resultados = {}
        
        # Ordem de cálculo (jusante → montante)
        trechos_ordenados = self._ordenar_trechos_jusante(trechos)
        
        for trecho in trechos_ordenados:
            resultado = self.calcular(trecho, pvs)
            resultados[trecho['id']] = resultado
            
            # Atualizar profundidade do PV de jusante
            if resultado.lamina_m:
                pv_jusante = trecho['pv_fim']
                pvs[pv_jusante]['cf'] += resultado.lamina_m
        
        return resultados
    
    def _ordenar_trechos_jusante(self, trechos):
        """Ordena trechos de jusante para montante (topological sort)."""
        # Implementar ordenação topológica
        pass
```

**Vantagens:**
- Múltiplos métodos de cálculo
- Mais preciso (seção parcial, routing)
- Validado com EPA SWMM5
- Fácil de testar (unit tests)

---

### 4️⃣ **MODEL BUILDER (IMPORTAÇÃO AUTOMÁTICA)** 🏗️

**SewerCAD faz:**
- `Haestad.ModelBuilder.dll` importa automaticamente de:
  - DXF/DWG (AutoCAD, MicroStation)
  - Shapefile (GIS)
  - LandXML (terreno)
  - CSV/Excel (dados tabulares)
- Reconhece layers automaticamente
- Cria rede a partir de geometria

**O que aprender:**
```python
# construdata/io/model_builder.py

class ModelBuilder:
    """Importador automático similar ao SewerCAD Model Builder."""
    
    def __init__(self):
        self.importers = {
            'dxf': DXFImporter(),
            'dwg': DWGImporter(),
            'shp': ShapefileImporter(),
            'gpkg': GeoPackageImporter(),
            'csv': CSVImporter(),
            'landxml': LandXMLImporter(),
        }
    
    def importar(self, arquivo_entrada, tipo=None):
        """Importa automaticamente baseado no tipo de arquivo."""
        if tipo is None:
            tipo = self._detectar_tipo(arquivo_entrada)
        
        importer = self.importers.get(tipo)
        if not importer:
            raise ValueError(f"Tipo {tipo} não suportado")
        
        return importer.importar(arquivo_entrada)
    
    def _detectar_tipo(self, arquivo):
        """Detecta tipo de arquivo pela extensão."""
        ext = Path(arquivo).suffix.lower()
        mapeamento = {
            '.dxf': 'dxf',
            '.dwg': 'dwg',
            '.shp': 'shp',
            '.gpkg': 'gpkg',
            '.csv': 'csv',
            '.xml': 'landxml',
        }
        return mapeamento.get(ext)

class DXFImporter:
    """Importador DXF inteligente."""
    
    def __init__(self):
        self.layer_rules = {
            # Esgoto
            'TUBO_PVC': {'tipo': 'tubo', 'material': 'PVC'},
            'TUBO_PE_*': {'tipo': 'tubo', 'material': 'PEAD'},
            'PS_PONTOS_IDENTIFICACAO_TXT': {'tipo': 'pv_texto'},
            'PS_IND_FLUXO': {'tipo': 'fluxo'},
            'PS_IND_DIAMETRO': {'tipo': 'diametro'},
            
            # Água
            'LIN-AF': {'tipo': 'tubo_agua'},
            'TUBO_PE_80_*': {'tipo': 'tubo_agua'},
            
            # Terreno
            'CURVAS_DE_NIVEL': {'tipo': 'curva_nivel'},
            'PONTOS_COTADOS': {'tipo': 'ponto_cotado'},
            
            # Ruas
            'EIXO_VIARIO': {'tipo': 'rua_eixo'},
            'LOGRADOURO': {'tipo': 'rua_nome'},
        }
    
    def importar(self, dxf_path):
        """Importa DXF e retorna rede estruturada."""
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        
        rede = {
            'pvs': {},
            'tubos': [],
            'ruas': [],
            'terreno': [],
        }
        
        for entity in msp:
            layer = entity.dxf.layer
            regra = self._encontrar_regra(layer)
            
            if regra['tipo'] == 'pv_texto':
                pv = self._extrair_pv(entity)
                rede['pvs'][pv['id']] = pv
            
            elif regra['tipo'] == 'tubo':
                tubo = self._extrair_tubo(entity, regra)
                rede['tubos'].append(tubo)
            
            # ... outros tipos
        
        return rede
```

**Vantagens:**
- Suporta múltiplos formatos
- Regras de mapeamento configuráveis
- Fácil adicionar novos formatos (IFC, CityGML)

---

### 5️⃣ **LOAD BUILDER (ELEMENTOS DE REDE)** 📦

**SewerCAD faz:**
- `Haestad.LoadBuilder.*` cria elementos de rede automaticamente
- PVs, tubos, válvulas, bombas, reservatórios
- Conecta baseado em geometria e regras

**O que aprender:**
```python
# construdata/models/rede.py

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum

class TipoPV(Enum):
    PV = "PV"              # Poço de Visita
    PI = "PI"              # Poço de Inspeção
    PM = "PM"              # Poço de Mudança
    PT = "PT"              # Poço de Terminal
    QE = "QE"              # Queda
    DE = "DE"              # Degrau
    RG = "RG"              # Registro (água)
    TE = "TE"              # Te (água)
    CURVA = "CURVA"        # Curva (água)
    CAP = "CAP"            # Cap (água)

class MaterialTubo(Enum):
    PVC = "PVC"
    PEAD = "PEAD"
    PE80 = "PE80"
    PE100 = "PE100"
    CONCRETO = "CONCRETO"
    FERRO_FUNDIDO = "FF"

@dataclass
class PV:
    """Poço de Visita (similar a Structure no SewerCAD)."""
    id: str
    tipo: TipoPV
    x: float
    y: float
    ct: Optional[float] = None      # Cota do terreno
    cf: Optional[float] = None      # Cota de fundo
    prof: Optional[float] = None    # Profundidade
    diametro_tampa: float = 0.60    # metros
    grau: int = 0                   # número de conexões
    
    # Dados calculados
    ct_calculado: Optional[float] = None
    cf_calculado: Optional[float] = None
    
    def profundidade_real(self) -> Optional[float]:
        """Calcula profundidade real."""
        if self.ct and self.cf:
            return self.ct - self.cf
        return self.prof

@dataclass
class Trecho:
    """Tubo/Trecho (similar a Pipe no SewerCAD)."""
    id: int
    pv_ini: str
    pv_fim: str
    material: MaterialTubo
    dn_mm: int
    ext_m: float
    decl_pct: float
    
    # Hidráulica
    velocidade_ms: Optional[float] = None
    vazao_ls: Optional[float] = None
    lamina_m: Optional[float] = None
    tensao_trativa_pa: Optional[float] = None
    status: str = "SEM_DADOS"
    
    # Geometria
    rua: Optional[str] = None
    layer: Optional[str] = None
    
    def validar(self) -> List[str]:
        """Valida trecho (similar a validation no SewerCAD)."""
        erros = []
        
        if self.dn_mm < 100:
            erros.append(f"DN {self.dn_mm}mm < 100mm (mínimo)")
        
        if self.decl_pct and self.decl_pct < 0.2:
            erros.append(f"Declividade {self.decl_pct}% < 0.2% (mínimo)")
        
        if self.velocidade_ms:
            if self.velocidade_ms < 0.6:
                erros.append(f"Velocidade {self.velocidade_ms} m/s < 0.6 m/s (autolimpeza)")
            elif self.velocidade_ms > 5.0:
                erros.append(f"Velocidade {self.velocidade_ms} m/s > 5.0 m/s (máximo)")
        
        if self.tensao_trativa_pa and self.tensao_trativa_pa < 1.0:
            erros.append(f"Tensão trativa {self.tensao_trativa_pa} Pa < 1.0 Pa (mínimo)")
        
        return erros

@dataclass
class Rede:
    """Rede completa (similar a Network no SewerCAD)."""
    nome: str
    nucleo: str
    pvs: Dict[str, PV] = field(default_factory=dict)
    trechos: List[Trecho] = field(default_factory=list)
    
    def adicionar_pv(self, pv: PV):
        """Adiciona PV à rede."""
        self.pvs[pv.id] = pv
    
    def adicionar_trecho(self, trecho: Trecho):
        """Adiciona trecho à rede."""
        self.trechos.append(trecho)
        
        # Atualizar grau dos PVs
        if trecho.pv_ini in self.pvs:
            self.pvs[trecho.pv_ini].grau += 1
        if trecho.pv_fim in self.pvs:
            self.pvs[trecho.pv_fim].grau += 1
    
    def validar(self) -> Dict:
        """Valida toda a rede."""
        resultados = {
            'total_pvs': len(self.pvs),
            'total_trechos': len(self.trechos),
            'erros_pvs': [],
            'erros_trechos': [],
            'erros_rede': [],
        }
        
        # Validar trechos
        for trecho in self.trechos:
            erros = trecho.validar()
            if erros:
                resultados['erros_trechos'].append({
                    'trecho': f"{trecho.pv_ini}->{trecho.pv_fim}",
                    'erros': erros
                })
        
        # Validar rede (ciclos, desconexões)
        self._validar_conectividade(resultados)
        self._validar_ciclos(resultados)
        
        return resultados
    
    def _validar_conectividade(self, resultados):
        """Valida se todos PVs estão conectados."""
        # Implementar com networkx
        pass
    
    def _validar_ciclos(self, resultados):
        """Detecta ciclos na rede."""
        # Implementar com networkx
        pass
    
    def exportar_geosjon(self) -> dict:
        """Exporta rede como GeoJSON."""
        features = []
        
        for trecho in self.trechos:
            pv_ini = self.pvs.get(trecho.pv_ini)
            pv_fim = self.pvs.get(trecho.pv_fim)
            
            if pv_ini and pv_fim:
                features.append({
                    'type': 'Feature',
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': [[pv_ini.x, pv_ini.y], [pv_fim.x, pv_fim.y]]
                    },
                    'properties': {
                        'id': trecho.id,
                        'pv_ini': trecho.pv_ini,
                        'pv_fim': trecho.pv_fim,
                        'dn_mm': trecho.dn_mm,
                        'material': trecho.material.value,
                        'status': trecho.status,
                    }
                })
        
        return {
            'type': 'FeatureCollection',
            'features': features
        }
```

**Vantagens:**
- Código orientado a objetos
- Validação embutida nos objetos
- Fácil de testar
- Similar ao SewerCAD (fácil migração)

---

### 6️⃣ **PERFIS LONGITUDINAIS AUTOMÁTICOS** 📈

**SewerCAD faz:**
- Gera perfis longitudinais automaticamente
- Terreno + tubo + PVs
- Escalas H/V configuráveis
- Exporta PDF/DWG

**O que aprender:**
```python
# construdata/io/perfil_generator.py

class PerfilLongitudinal:
    """Gera perfis longitudinais (similar ao SewerCAD)."""
    
    def __init__(self, trecho, pvs, terreno_dtm=None):
        self.trecho = trecho
        self.pvs = pvs
        self.terreno_dtm = terreno_dtm  # Modelo digital de terreno
    
    def gerar(self, escala_h=200, escala_v=200, exagero=1.0):
        """Gera perfil longitudinal."""
        pv_ini = self.pvs[self.trecho.pv_ini]
        pv_fim = self.pvs[self.trecho.pv_fim]
        
        # Interpolar terreno ao longo do trecho
        distancias, cotas_terreno = self._interpolar_terreno(
            pv_ini, pv_fim, self.terreno_dtm
        )
        
        # Calcular cotas de fundo
        cotas_fundo = [pv_ini.cf, pv_fim.cf]
        
        # Calcular lâmina d'água (se disponível)
        cotas_agua = None
        if self.trecho.lamina_m:
            cotas_agua = [cf + self.trecho.lamina_m for cf in cotas_fundo]
        
        return {
            'distancias': distancias,
            'cotas_terreno': cotas_terreno,
            'cotas_fundo': cotas_fundo,
            'cotas_agua': cotas_agua,
            'pv_ini': pv_ini,
            'pv_fim': pv_fim,
            'trecho': self.trecho,
        }
    
    def _interpolar_terreno(self, pv_ini, pv_fim, dtm):
        """Interpola terreno ao longo do trecho."""
        # Implementar interpolação linear
        pass
    
    def plot(self, dados_perfil, output_path):
        """Plota perfil longitudinal."""
        fig, ax = plt.subplots(figsize=(12, 6))
        
        # Terreno
        ax.plot(dados_perfil['distancias'], 
                dados_perfil['cotas_terreno'], 
                'k-', label='Terreno')
        
        # Fundo da vala
        ax.plot(dados_perfil['distancias'], 
                dados_perfil['cotas_fundo'], 
                'b-', label='Fundo do tubo')
        
        # Linha d'água
        if dados_perfil['cotas_agua']:
            ax.plot(dados_perfil['distancias'], 
                    dados_perfil['cotas_agua'], 
                    'b--', label='Linha d\'água')
        
        # PVs
        ax.scatter([0, dados_perfil['distancias'][-1]], 
                   [dados_perfil['cotas_terreno'][0], 
                    dados_perfil['cotas_terreno'][-1]],
                   c='red', s=100, zorder=5)
        
        ax.set_xlabel('Distância (m)')
        ax.set_ylabel('Cota (m)')
        ax.legend()
        ax.grid(True)
        
        plt.savefig(output_path, dpi=150)
        plt.close()
```

**Vantagens:**
- Perfis automáticos para cada trecho
- Visualização clara do projeto
- Detecta problemas (tubo acima do terreno)

---

### 7️⃣ **CENÁRIOS E COMPARAÇÃO** 🔄

**SewerCAD faz:**
- Múltiplos cenários (existing, proposed, future)
- Comparação lado a lado
- Merge de cenários

**O que aprender:**
```python
# construdata/models/cenario.py

@dataclass
class Cenario:
    """Cenário de projeto (similar ao SewerCAD scenarios)."""
    nome: str
    descricao: str
    data_criacao: datetime
    pvs: Dict[str, PV]
    trechos: List[Trecho]
    
    def comparar_com(self, outro: 'Cenario') -> Dict:
        """Compara dois cenários."""
        diff = {
            'pvs_adicionados': [],
            'pvs_removidos': [],
            'pvs_modificados': [],
            'trechos_adicionados': [],
            'trechos_removidos': [],
            'trechos_modificados': [],
        }
        
        # Comparar PVs
        ids_self = set(self.pvs.keys())
        ids_outro = set(outro.pvs.keys())
        
        diff['pvs_adicionados'] = list(ids_self - ids_outro)
        diff['pvs_removidos'] = list(ids_outro - ids_self)
        
        for pv_id in ids_self & ids_outro:
            pv_self = self.pvs[pv_id]
            pv_outro = outro.pvs[pv_id]
            
            if pv_self.ct != pv_outro.ct or pv_self.cf != pv_outro.cf:
                diff['pvs_modificados'].append(pv_id)
        
        # Comparar trechos (similar)
        
        return diff
    
    def exportar_comparacao_html(self, outro: 'Cenario', output_path):
        """Exporta comparação como HTML."""
        diff = self.comparar_com(outro)
        
        html = f"""
        <html>
        <head><title>Comparação de Cenários</title></head>
        <body>
            <h1>{self.nome} vs {outro.nome}</h1>
            
            <h2>PVs</h2>
            <ul>
                <li>Adicionados: {len(diff['pvs_adicionados'])}</li>
                <li>Removidos: {len(diff['pvs_removidos'])}</li>
                <li>Modificados: {len(diff['pvs_modificados'])}</li>
            </ul>
            
            <h2>Trechos</h2>
            <ul>
                <li>Adicionados: {len(diff['trechos_adicionados'])}</li>
                <li>Removidos: {len(diff['trechos_removidos'])}</li>
                <li>Modificados: {len(diff['trechos_modificados'])}</li>
            </ul>
        </body>
        </html>
        """
        
        with open(output_path, 'w') as f:
            f.write(html)
```

**Vantagens:**
- Controle de versões do projeto
- Auditoria de mudanças
- Aprovação de alternativas

---

## 📊 COMPARAÇÃO FINAL

| Recurso | SewerCAD | ConstruData Atual | O que Adotar |
|---------|----------|-------------------|--------------|
| Arquitetura | Modular (DLLs) | Monolítico (1 arquivo) | ✅ Modularizar |
| Banco de dados | SQLite | Memória (dict) | ✅ SQLite |
| Motor hidráulico | SWMM5 + GVF | Manning simples | ✅ Motor completo |
| Importação | Model Builder | DXF apenas | ✅ Multi-formato |
| Elementos | Classes (OOP) | Dicts | ✅ Classes |
| Perfis | Automáticos | matplotlib | ✅ Manter + melhorar |
| Cenários | Múltiplos | Único | ✅ Adicionar |
| UI | DevExpress | HTML/Leaflet | ✅ Manter HTML |
| Plataforma | Windows (.NET) | Python cross-platform | ✅ Manter Python |

---

## 🎯 RECOMENDAÇÕES PRIORIZADAS

### **FAZER AGORA (baixo esforço, alto impacto):**

1. **Criar classes PV e Trecho** (1-2 horas)
   - Substituir dicts por dataclasses
   - Adicionar métodos de validação
   - Código mais legível

2. **Adicionar SQLite** (2-3 horas)
   - Salvar resultados em banco
   - Consultas SQL para relatórios
   - Histórico de processamento

3. **Modularizar código** (4-6 horas)
   - Separar em pacotes (core, io, models, utils)
   - Manter API compatível
   - Mais fácil de testar

### **FAZER DEPOIS (médio esforço, médio impacto):**

4. **Motor hidráulico completo** (8-12 horas)
   - Manning seção plena + parcial
   - Tensão trativa
   - Número de Froude
   - Validação automática

5. **Model Builder multi-formato** (6-8 horas)
   - Suportar GPKG, Shapefile, CSV
   - Regras de mapeamento configuráveis
   - Auto-detect de layers

### **FAZER FUTURAMENTE (alto esforço, alto impacto):**

6. **Perfis longitudinais automáticos** (12-16 horas)
   - Integrar com DTM (modelo de terreno)
   - Gerar PDF por trecho
   - Exportar DWG

7. **Sistema de cenários** (8-12 horas)
   - Comparação entre versões
   - Merge de cenários
   - Histórico de mudanças

---

## 📚 REFERÊNCIAS DO SEWERCAD

### Arquivos para estudar:
```
C:\Program Files (x86)\Bentley\SewerCAD\
├── Haestad.Calculations.SewerCAD.Domain.dll  ← Motor hidráulico
├── Haestad.Domain.ModelingObjects.dll        ← Objetos de rede
├── Haestad.ModelBuilder.dll                  ← Importação
├── Haestad.LoadBuilder.*                     ← Elementos
├── Samples/Sample1.stsw.sqlite               ← Banco de dados
└── SewerCAD User's Guide.pdf                 ← Documentação
```

### Conceitos chave:
- **Structure** = PV (nossos PVs/PIs)
- **Pipe** = Trecho (nossos tubos)
- **Network** = Rede (grafo de PVs + tubos)
- **Scenario** = Cenário (versão do projeto)
- **Model Builder** = Importador DXF/GIS
- **Load Builder** = Criador de elementos
- **GVF Solver** = Solver de fluxo gradualmente variado

---

*Análise criada em 20/03/2026 — ConstruData SABESP v5.0*
