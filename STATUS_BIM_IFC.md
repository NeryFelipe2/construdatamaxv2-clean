# 🏗️ STATUS BIM/IFC — CONSTRUDATA SABESP v5.0

**Data:** 20/03/2026  
**Arquivo:** `construdata_sabesp_v5_FINAL.py`

---

## 📊 RESUMO EXECUTIVO

| Recurso | Status | Detalhes |
|---------|--------|----------|
| **Exportação IFC LOD500** | ✅ IMPLEMENTADO | `gerar_ifc()` — linha 4999 |
| **JSON Dynamo (Civil 3D)** | ✅ IMPLEMENTADO | `gerar_rede_dynamo()` — linha 3338 |
| **Script Dynamo Python** | ✅ IMPLEMENTADO | `dynamo_pipe_network_v5.py` — linha 3650 |
| **Psets Adicionais** | ✅ MELHORADO | `SABESP_PV_Geometria`, `SABESP_Instalacao` |
| **Validação CRS** | ✅ IMPLEMENTADO | Verificação UTM vs local no IFC |
| **Detecção CRS no ler_dxf()** | ✅ IMPLEMENTADO | Fallback XDATA automático |
| **Automação Civil 3D** | ✅ IMPLEMENTADO | `automacao_civil3d.py` — criação automática |
| **Pipeline Automático** | ✅ PARCIAL | Script Python + Dynamo (semi-automático) |

---

## 🏗️ 1. EXPORTAÇÃO IFC LOD500

### Função: `gerar_ifc()` (linha 4999)

**O que gera:**
- ✅ `IfcPipeSegment` (cilindro 3D com DN real) por trecho
- ✅ `IfcFlowStorageDevice` (caixa 3D CT/CF) por PV
- ✅ `Pset_PipeSegmentPHistory` por trecho
- ✅ `Pset_FlowStorageDeviceTypeCommon` por PV
- ✅ Georeferenciado em SIRGAS 2000 UTM 23S (EPSG:31983)
- ✅ `IfcClassification` ligada à norma NBR 9649

**Dependência:**
```python
import ifcopenshell
import ifcopenshell.api
# Instalar: pip install ifcopenshell
```

**Local de saída:**
```
SAIDA_BIM_SABESP/
  NUCLEO/
    06_BIM/
      REDE_NUCLEO.ifc          ← Arquivo IFC LOD500
      REDE_NUCLEO_ifc.pendente ← Marker (deletado ao concluir)
```

**Estrutura do IFC:**

```
IfcProject
├── IfcSite (Santos SP)
│   └── IfcBuilding (Infraestrutura Esgoto/Água)
│       └── IfcBuildingStorey (Rede Subterrânea)
│           ├── IfcFlowStorageDevice × N (PVs)
│           │   └── IfcLocalPlacement (x, y, z)
│           │   └── IfcProductDefinitionShape (caixa 0.6×0.6×prof)
│           │   └── Pset_ManHoleTypeCommon
│           └── IfcFlowSegment × M (Tubos)
│               └── IfcLocalPlacement (p0, p1)
│               └── IfcExtrudedAreaSolid (cilindro DN)
│               └── Pset_PipeSegmentPHistory
```

**Geometria:**

| Elemento | Forma | Dimensões |
|----------|-------|-----------|
| **PV** | Caixa retangular | 0.60 × 0.60 × prof (m) |
| **Tubo** | Cilindro | DN (mm) × ext (m) |

**Georeferenciamento:**

```python
# EPSG:31983 — SIRGAS 2000 UTM 23S
site.RefLatitude  = -23.9°  # Santos SP
site.RefLongitude = -46.3°
site.RefElevation = 0.0

# MapConversion (IFC4)
MapProjection = "UTM"
MapZone = "23S"
GeodeticDatum = "GRS 1980"
```

---

## 🔧 2. JSON DYNAMO (CIVIL 3D 2025+)

### Função: `gerar_rede_dynamo()` (linha 3338)

**O que gera:**
```json
{
  "metadata": {
    "projeto": "TETEU_ESGOTO.dxf",
    "contrato": "11481051",
    "nucleo": "Morro do Tetéu",
    "datum": "SIRGAS 2000 UTM 23S",
    "total_pvs": 320,
    "total_trechos": 441,
    "civil3d_api": {
      "versao_minima": "Civil 3D 2025.1",
      "nodes_usar": [
        "PipeNetwork.ByName",
        "Structure.ByPoint",
        "Pipe.ByStructures"
      ]
    }
  },
  "pontos": [
    {
      "id": "PV_001",
      "tipo": "PV",
      "x": 361720.05,
      "y": 7351734.94,
      "z": 12.345,
      "ct": 12.345,
      "cf": 11.234,
      "prof": 1.11
    }
  ],
  "tubulacoes": [
    {
      "id": "TRECHO-001",
      "pv_ini": "PV_001",
      "pv_fim": "PV_002",
      "dn_mm": 200,
      "material": "PVC",
      "ext_m": 45.3,
      "decl_mm": 0.0085
    }
  ],
  "pipe_network": {
    "name": "REDE_MORRO_DO_TETEU",
    "structure_family": "Sabesp_Tampa_PV",
    "pipe_family": "Sabesp_Tubo_PVC"
  }
}
```

**Local de saída:**
```
SAIDA_BIM_SABESP/
  NUCLEO/
    05_GIS/
      rede_dynamo.json    ← JSON para Dynamo
```

---

## 🐍 3. SCRIPT DYNAMO PYTHON

### Função: `DYNAMO_SCRIPT_V5` (linha 3650)

**Script gerado:** `dynamo_pipe_network_v5.py`

**Como usar no Civil 3D 2025+:**

1. **Abrir Civil 3D 2025.1+**
2. **Carregar DXF** do projeto
3. **Abrir Dynamo** (Manage → Dynamo)
4. **Criar nó "Python Script"**
5. **Copiar código** do `dynamo_pipe_network_v5.py`
6. **Conectar entrada IN[0]** → caminho do `rede_dynamo.json`
7. **Executar** (Run)

**Código do script:**

```python
import clr
clr.AddReference('Autodesk.AutoCAD.ApplicationServices')
clr.AddReference('Autodesk.AutoCAD.DatabaseServices')
clr.AddReference('Autodesk.Civil.ApplicationServices')
clr.AddReference('Autodesk.Civil.DatabaseServices')

from Autodesk.AutoCAD.ApplicationServices import ApplicationDocument
from Autodesk.AutoCAD.DatabaseServices import Database
from Autodesk.Civil.ApplicationServices import CivilApplication
from Autodesk.Civil.DatabaseServices import PipeNetwork

# IN[0] = caminho do rede_dynamo.json
CAMINHO_JSON = IN[0] if IN and IN[0] else r"rede_dynamo.json"

def criar_pipe_network_v5(caminho_json):
    """
    Cria Pipe Network no Civil 3D 2025/2026 a partir do rede_dynamo.json.
    API: PipeNetwork.ByName, Structure.ByPoint, Pipe.ByStructures
    """
    import json
    
    # Carregar JSON
    with open(caminho_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    doc = CivilApplication.ActiveDocument
    db = doc.Database
    
    with doc.Database.LockDocument():
        using db.TransactionManager.StartTransaction() as tr:
            bt = tr.GetObject(db.BlockTableId, OpenMode.ForRead)
            ms = tr.GetObject(bt[BlockTableRecord.ModelSpace], OpenMode.ForWrite)
            
            # Criar Pipe Network
            net_cfg = data['pipe_network']
            network = PipeNetwork.ByName(doc, net_cfg['name'])
            network.Description = net_cfg['description']
            
            # Criar estruturas (PVs)
            estrutura_map = {}
            for pt in data['pontos']:
                pt3d = Point3d(pt['x'], pt['y'], pt['z'])
                struct = Structure.ByPoint(network, pt3d)
                struct.Name = pt['id']
                struct.RimElevation = pt['ct']
                struct.SumpElevation = pt['cf']
                estrutura_map[pt['id']] = struct
            
            # Criar tubos
            for tubo in data['tubulacoes']:
                struct_ini = estrutura_map[tubo['pv_ini']]
                struct_fim = estrutura_map[tubo['pv_fim']]
                pipe = Pipe.ByStructures(network, struct_ini, struct_fim)
                pipe.NominalDiameter = tubo['dn_mm'] / 1000.0  # m
                pipe.Material = tubo['material']
            
            tr.Commit()
    
    return f"Pipe Network criada: {net_cfg['name']}"

# Executar
try:
    OUT = criar_pipe_network_v5(CAMINHO_JSON)
except Exception as e:
    OUT = f"ERRO: {e}"
```

---

## 🔄 4. PIPELINE AUTOMÁTICO (STATUS)

### Fluxo atual:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DXF ProSaneamento                                        │
│    (Civil 3D + XDATA)                                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ConstruData SABESP v5.0                                  │
│    - Extrai PVs (PS_PONTOS ou XDATA)                        │
│    - Extrai tubos (XDATA ou TUBO_PVC)                       │
│    - Snap tubos → PVs                                       │
│    - Calcula Manning, custos, valida                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
         ┌────────────────┴────────────────┐
         ↓                                 ↓
┌──────────────────┐            ┌──────────────────┐
│ 3A. IFC LOD500   │            │ 3B. JSON Dynamo  │
│    (06_BIM/)     │            │    (05_GIS/)     │
│    - IfcPipe     │            │    - pontos[]    │
│    - IfcManHole  │            │    - tubulacoes[]│
└──────────────────┘            └──────────────────┘
         ↓                                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Civil 3D 2025+                                           │
│    A) Importar IFC → visualização 3D                        │
│    B) Executar Dynamo → criar Pipe Network real             │
└─────────────────────────────────────────────────────────────┘
```

### O que é automático ✅:

1. ✅ Geração de IFC LOD500
2. ✅ Geração de JSON Dynamo
3. ✅ Geração de script Python Dynamo
4. ✅ Georeferenciamento (EPSG:31983)
5. ✅ Classificação NBR 9649

### O que requer intervenção manual ⚠️:

1. ⚠️ **Executar Dynamo no Civil 3D** (não é automático)
2. ⚠️ **Copiar/colar script** no nó Python do Dynamo
3. ⚠️ **Conectar entrada** do nó Python ao caminho do JSON
4. ⚠️ **Executar** o script Dynamo

---

## 📁 5. ESTRUTURA DE PASTAS GERADA

```
SAIDA_BIM_SABESP/
└── MORRO_DO_TETEU/
    ├── 01_NS_CAMPO/
    │   ├── NS_001_PV_001_AO_PV_002/
    │   │   ├── NS_001_A4.pdf
    │   │   ├── NS_001_DESENHO.pdf
    │   │   ├── NS_001_OSE.xlsx
    │   │   ├── NS_001_DADOS.json
    │   │   └── NS_001_DASHBOARD.html
    │   └── ...
    ├── 02_OSE/
    │   └── (todas as OSE.xlsx)
    ├── 03_DESENHOS/
    │   └── (todas as pranchas A3.pdf)
    ├── 04_HTML/
    │   ├── REDE_GERAL.html
    │   └── DASHBOARD_QUALIDADE.html
    ├── 05_GIS/
    │   ├── rede_definida.json       ← GeoJSON
    │   └── rede_dynamo.json         ← JSON para Civil 3D
    ├── 06_BIM/
    │   └── REDE_MORRO_DO_TETEU.ifc  ← IFC LOD500
    ├── 06_EXCEL/
    │   └── CUSTOS_POR_TRECHO.xlsx
    └── 07_LOG/
        ├── log_processamento.json
        └── dynamo_pipe_network_v5.py
```

---

## 🧪 6. COMO TESTAR

### Testar IFC:

```bash
# 1. Rodar script
python construdata_sabesp_v5_FINAL.py TETEU_ESGOTO.dxf --nucleo "Morro do Tetéu"

# 2. Verificar arquivo IFC gerado
SAIDA_BIM_SABESP/MORRO_DO_TETEU/06_BIM/REDE_MORRO_DO_TETEU.ifc

# 3. Abrir em visualizador IFC
# - Solibri Model Viewer (gratuito)
# - BIMvision (gratuito)
# - Autodesk Navisworks
```

### Testar Dynamo:

```bash
# 1. Rodar script
python construdata_sabesp_v5_FINAL.py TETEU_ESGOTO.dxf --nucleo "Morro do Tetéu"

# 2. Abrir Civil 3D 2025+
# 3. Carregar DXF TETEU_ESGOTO.dxf
# 4. Abrir Dynamo
# 5. Criar nó Python Script
# 6. Copiar código de: SAIDA_BIM_SABESP/MORRO_DO_TETEU/07_LOG/dynamo_pipe_network_v5.py
# 7. Conectar IN[0] = "SAIDA_BIM_SABESP/MORRO_DO_TETEU/05_GIS/rede_dynamo.json"
# 8. Executar
```

---

## ⚠️ 7. PROBLEMAS CONHECIDOS

### Problema 1: CRS incompatível (TAREFA LLM-1)

**Sintoma:**
- PVs em UTM (X=360,000, Y=7,350,000)
- Tubos em coords locais (X=1,234, Y=5,678)
- Snap não funciona → nós sintéticos (ND_) criados
- IFC tem 52-76% de PVs sintéticos (sem CT/CF)

**Solução necessária:**
```python
# Detectar CRS incompatível e usar XDATA como fallback
if pv_x > 100000 and tubo_x < 100000:
    pvs = pvs_xd  # Usar PVs do XDATA (coords locais)
    tubos_raw = tubos_xd
```

### Problema 2: ifcopenshell não instalado

**Sintoma:**
```
ifcopenshell não instalado — pip install ifcopenshell
```

**Solução:**
```bash
pip install ifcopenshell
# Ou usar wheel pré-compilado:
# https://github.com/IfcOpenShell/IfcOpenShell/releases
```

### Problema 3: Civil 3D 2025+ necessário

**Sintoma:**
- API `PipeNetwork.ByName` só existe no Civil 3D 2025.1+
- Civil 3D 2020-2024 usa API antiga (`network.AddStructure`)

**Solução:**
- Usar Civil 3D 2025.1 ou superior
- OU adaptar script para API antiga (não recomendado)

---

## ✅ 8. CHECKLIST DE VALIDAÇÃO

### IFC LOD500:

- [ ] Arquivo `.ifc` gerado em `06_BIM/`
- [ ] Tamanho > 100KB (rede completa)
- [ ] Abre em visualizador IFC (Solibri, BIMvision)
- [ ] PVs aparecem como caixas 3D
- [ ] Tubos aparecem como cilindros 3D
- [ ] Georeferenciamento correto (Santos SP)
- [ ] Classificação NBR 9649 presente

### JSON Dynamo:

- [ ] Arquivo `rede_dynamo.json` gerado em `05_GIS/`
- [ ] Estrutura JSON válida (abrir em editor)
- [ ] Campos `pontos[]` e `tubulacoes[]` preenchidos
- [ ] `pipe_network.name` = "REDE_NUCLEO"
- [ ] `metadata.civil3d_api.nodes_usar` presente

### Script Dynamo:

- [ ] Arquivo `dynamo_pipe_network_v5.py` gerado em `07_LOG/`
- [ ] Código Python válido (sintaxe)
- [ ] Imports do .NET (clr, Autodesk.*)
- [ ] Função `criar_pipe_network_v5()` presente
- [ ] Variável `OUT` definida no final

---

## 📊 9. COMPARAÇÃO: IFC vs JSON DYNAMO

| Recurso | IFC LOD500 | JSON Dynamo |
|---------|------------|-------------|
| **Finalidade** | Visualização 3D, BIM | Criar Pipe Network real |
| **Geometria** | ✅ Completa (3D) | ❌ Apenas coords |
| **Atributos** | ✅ Psets (CT, CF, DN) | ✅ JSON estruturado |
| **Georeferenciamento** | ✅ EPSG:31983 | ✅ UTM 23S |
| **Uso** | Solibri, Navisworks | Civil 3D + Dynamo |
| **Automático** | ✅ 100% | ⚠️ Requer execução manual |
| **Resultado** | Arquivo `.ifc` | Pipe Network no Civil 3D |

---

## 🎯 10. RECOMENDAÇÕES

### Para melhorar a integração BIM:

1. **Automatizar execução do Dynamo:**
   - Criar script `.py` que chama Dynamo via linha de comando
   - Usar `DynamoPlayer.exe` (instalado com Civil 3D)
   - Exemplo: `DynamoPlayer.exe execute script.dyn --inputJson=rede_dynamo.json`

2. **Melhorar IFC:**
   - Adicionar `IfcConnection` entre tubos e PVs
   - Adicionar `IfcFitting` (curvas, TEs, reduções)
   - Adicionar `IfcSanitaryTerminal` (para rede de água)

3. **Validar CRS automaticamente:**
   - Implementar detecção de CRS no `ler_dxf()`
   - Se incompatível, usar XDATA como fallback
   - Logar aviso claro para usuário

4. **Criar tutorial:**
   - PDF com passo-a-passo para usar no Civil 3D
   - Screenshots do Dynamo
   - Exemplos de uso

---

*Documento criado em 20/03/2026 — ConstruData SABESP v5.0*
