# 🎓 LIÇÕES DA AUTODESK — APLICÁVEIS AO CONSTRUDATA

**Data:** 20/03/2026  
**Fontes analisadas:**
- Bentley SewerCAD
- SOLIDOS (TBN2NET)
- QuuxPipeElevationEditor
- C3DMEMO
- Civil 3D Drainage Analysis Plugin
- Kobi Toolkit for Civil 3D
- Autodesk Vehicle Tracking

---

## 📊 RESUMO EXECUTIVO

### **O que podemos aprender:**

| Categoria | Lição | Aplicação no ConstruData |
|-----------|-------|--------------------------|
| **Arquitetura** | Modular (.bundle) | ✅ Já implementado |
| **Plugin AutoCAD** | PackageContents.xml | ✅ Criado |
| **Classes** | PV, Trecho, Rede | ✅ Implementado |
| **Banco de dados** | SQLite persistente | ✅ Implementado |
| **Dynamo** | Nodes reutilizáveis | ⏳ Pendente |
| **UI** | Ribbon (CUIX) | ⏳ Pendente |
| **Comandos** | CONSTRUDATA, BATCH | ⏳ Pendente |
| **Help** | PT/EN | ⏳ Pendente |

---

## 1️⃣ ARQUITETURA MODULAR (Bentley SewerCAD)

### **O que aprendemos:**

```
SewerCAD/
├── Haestad.Calculations.SewerCAD.dll      ← Motor hidráulico
├── Haestad.Calculations.SewerCAD.Domain   ← Domínio (classes)
├── Haestad.Calculations.SewerCAD.OutputReader ← Leitura resultados
├── Haestad.ModelBuilder.dll               ← Importador DXF/GIS
├── Haestad.LoadBuilder.*                  ← Criador de elementos
└── Samples/*.stsw.sqlite                  ← Banco SQLite
```

### **Como aplicamos:**

```
construdata/
├── models.py                    ← Classes PV, Trecho, Rede ✅
├── database.py                  ← SQLite ✅
├── core/                        ← (futuro)
│   ├── extractor.py             ← Importador DXF
│   ├── hydraulics.py            ← Motor Manning
│   └── validator.py             ← Validação
└── io/                          ← (futuro)
    ├── dxf_reader.py
    ├── excel_writer.py
    └── html_generator.py
```

---

## 2️⃣ PLUGIN AUTOCAD (SOLIDOS, QuuxPipe)

### **Estrutura do .bundle:**

```
ConstruData.bundle/
├── PackageContents.xml          ✅ Criado
├── Contents/
│   ├── dotnet_4/                ⏳ DLLs 2020-2024
│   ├── dotnet_8/                ⏳ DLLs 2025+
│   ├── Resources/               ⏳ CUIX, ícones
│   ├── Support/                 ✅ Templates
│   └── Dynamo/                  ⏳ Nodes
└── help_PT.html                 ⏳ Ajuda
```

### **PackageContents.xml (aprendizado):**

```xml
<!-- 1. Suportar múltiplas versões -->
<Components Description="Civil 3D 2020-2024">
  <RuntimeRequirements OS="Win64" Platform="Civil3D" 
                       SeriesMin="R23.0" SeriesMax="R24.3" />
  <ComponentEntry ModuleName="./Contents/dotnet_4/ConstruData_2020.dll" />
</Components>

<Components Description="Civil 3D 2025+">
  <RuntimeRequirements OS="Win64" Platform="Civil3D" 
                       SeriesMin="R25.0" SeriesMax="R26.0" />
  <ComponentEntry ModuleName="./Contents/dotnet_8/ConstruData_2025.dll" />
</Components>

<!-- 2. Comandos registrados -->
<Commands>
  <Command Global="CONSTRUDATA" />
  <Command Global="CONSTRUDATA_BATCH" />
  <Command Global="CONSTRUDATA_QA" />
</Commands>

<!-- 3. LoadOnAutoCADStartup=True -->
<ComponentEntry LoadOnAutoCADStartup="True" />
```

---

## 3️⃣ COMANDOS (SOLIDOS)

### **Comandos que teremos:**

| Comando | Alias | Função | Similar ao |
|---------|-------|--------|------------|
| `CONSTRUDATA` | `CD` | Interface principal | `SOLIDOS` |
| `CONSTRUDATA_BATCH` | `CDB` | Processar em lote | `SOLIDOS_BATCH` |
| `CONSTRUDATA_QA` | `CDQA` | Dashboard qualidade | `SOLIDOS_QA` |
| `CONSTRUDATA_SQLITE` | `CDSQL` | Gerenciar SQLite | Novo |
| `CONSTRUDATA_IFC` | `CDIFC` | Exportar IFC | `SOLIDOS_IFC` |

---

## 4️⃣ RIBBON UI (CUIX)

### **Layout (inspirado no SOLIDOS):**

```
┌─────────────────────────────────────────────────────────┐
│  CONSTRUDATA SABESP v5.1                                │
├─────────────────────────────────────────────────────────┤
│  [🏠] [📁] [⚙️] [📊] [🗺️] [❓]                         │
│  Início  Arquivo  Config  Qualidade  Mapa  Ajuda        │
└─────────────────────────────────────────────────────────┘

Painel Início:
┌──────────────────────────────────────────┐
│  [📄]        [📂]        [⚡]            │
│  Gerar NS    Batch       Quick Start     │
└──────────────────────────────────────────┘

Painel Qualidade:
┌──────────────────────────────────────────┐
│  [📊]        [🗺️]        [📈]            │
│  Dashboard   Mapa Leaflet Gráficos       │
└──────────────────────────────────────────┘

Painel Dados:
┌──────────────────────────────────────────┐
│  [💾]        [📤]        [📥]            │
│  SQLite      Exportar    Importar        │
└──────────────────────────────────────────┘
```

---

## 5️⃣ DYNAMO NODES (SOLIDOS)

### **Nodes que teremos:**

#### **Rede:**
- `CriarRedeEsgoto` (DXF → Rede)
- `CriarRedeAgua` (DXF → Rede)
- `ConectarTubosPVs` (Snap)
- `ValidarRede` (NetworkX)

#### **Hidráulica:**
- `CalcularManning` (Seção plena/parcial)
- `CalcularTensaoTrativa`
- `ValidarVelocidade`

#### **Exportação:**
- `ExportarGeoJSON`
- `ExportarIFC`
- `ExportarOSE`
- `ExportarDashboardHTML`

#### **Banco:**
- `SalvarSQLite`
- `CarregarSQLite`
- `ConsultarSQLite`

### **Estrutura do pkg.json:**

```json
{
  "license": "MIT",
  "name": "ConstruData",
  "version": "5.1.0",
  "description": "Nodes para redes SABESP",
  "author": "Felipe Nery",
  "contains_binaries": true,
  "node_libraries": [
    "ConstruData, Version=5.1.0.0"
  ]
}
```

---

## 6️⃣ BANCO DE DADOS (Bentley + SOLIDOS)

### **O que aprendemos:**

| Bentley SewerCAD | SOLIDOS | ConstruData |
|------------------|---------|-------------|
| `.stsw.sqlite` | `.db` | `resultado.sqlite` ✅ |
| Tabelas: Structures, Pipes | Tables: Devices, Pipes | Tables: pvs, trechos ✅ |
| Histórico de cenários | Múltiplas versões | Múltiplos processamentos ✅ |
| Consultas SQL | Relatórios | Relatórios JSON ✅ |

### **Tabelas que temos:**

```sql
-- Processamentos (histórico)
CREATE TABLE processamentos (
    id INTEGER PRIMARY KEY,
    nucleo TEXT,
    tipo_rede TEXT,
    data_processamento TEXT,
    total_pvs INTEGER,
    total_trechos INTEGER,
    extensao_total REAL,
    custo_total REAL,
    tempo_processamento REAL,
    status TEXT
);

-- PVs
CREATE TABLE pvs (
    id INTEGER PRIMARY KEY,
    processamento_id INTEGER,
    pv_id TEXT,
    tipo TEXT,
    x REAL, y REAL,
    ct REAL, cf REAL, prof REAL,
    grau INTEGER,
    sintético INTEGER
);

-- Trechos
CREATE TABLE trechos (
    id INTEGER PRIMARY KEY,
    processamento_id INTEGER,
    pv_ini TEXT, pv_fim TEXT,
    material TEXT, dn_mm INTEGER,
    ext_m REAL, decl_pct REAL,
    rua TEXT,
    velocidade_ms REAL,
    tensao_trativa_pa REAL,
    status TEXT
);

-- Erros
CREATE TABLE erros_validacao (
    id INTEGER PRIMARY KEY,
    processamento_id INTEGER,
    tipo TEXT,
    elemento_id TEXT,
    erro TEXT
);
```

---

## 7️⃣ CLASSES (Bentley SewerCAD)

### **O que implementamos:**

| Bentley SewerCAD | ConstruData | Status |
|------------------|-------------|--------|
| `Structure` | `PV` | ✅ |
| `Pipe` | `Trecho` | ✅ |
| `Network` | `Rede` | ✅ |
| `Validation` | `validar()` | ✅ |
| `Export GeoJSON` | `exportar_geojson()` | ✅ |

### **Métodos das classes:**

```python
# PV
pv = PV(id="PV_001", tipo=TipoPV.PV, x=360000, y=7350000, ct=15.5, cf=13.0)
pv.profundidade_real      # Propriedade calculada
pv.tem_coords             # Boolean
pv.tem_cotas              # Boolean
pv.validar()              # Lista de erros
pv.to_dict()              # Dict (compatibilidade)

# Trecho
trecho = Trecho(id=1, pv_ini="PV_001", pv_fim="PV_002", dn_mm=200)
trecho.decl_mpm           # m/m
trecho.ext_m_valida       # Boolean
trecho.dn_valido          # Boolean
trecho.validar()          # Erros/avisos

# Rede
rede = Rede(nome="Teteu", nucleo="Morro do Teteu")
rede.adicionar_pv(pv)
rede.adicionar_trecho(trecho)
rede.total_pvs            # 61
rede.total_trechos        # 67
rede.extensao_total       # 1980.5
rede.custo_total          # 456789.00
rede.estatisticas()       # Dict completo
rede.validar()            # Validação completa
rede.exportar_geojson()   # GeoJSON
```

---

## 8️⃣ INTEGRAÇÃO PYTHON ↔ C# (pythonnet)

### **O que aprendemos:**

```csharp
// SOLIDOS usa: pythonnet (NuGet)
using Python.Runtime;

public class PythonBridge
{
    public void RunConstrudata()
    {
        PythonEngine.Initialize();
        using (Py.GIL())
        {
            // Importar módulo Python
            dynamic sys = Py.Import("sys");
            sys.path.append(@"C:\Users\felip\Downloads\NOVA NS Versao 5");
            
            // Importar classes
            dynamic models = Py.Import("models");
            dynamic PV = models.PV;
            
            // Criar objeto Python
            dynamic pv = PV(id: "PV_001", x: 360000, ct: 15.5);
            Console.WriteLine($"PV: {pv.id}, Prof: {pv.profundidade_real}");
        }
    }
}
```

### **Vantagens:**
- ✅ Reutiliza código Python existente
- ✅ Classes `models.py` funcionam em C#
- ✅ SQLite `database.py` acessível do C#
- ✅ Sem reescrever lógica

---

## 9️⃣ HELP / DOCUMENTAÇÃO (SOLIDOS, QuuxPipe)

### **Estrutura do help:**

```
Contents/
├── help_PT.html           ← Ajuda em português
├── help_EN.html           ← Ajuda em inglês
├── images/                ← Screenshots
│   ├── ribbon.png
│   ├── commands.png
│   └── examples.png
└── tutorials/             ← Tutoriais
    ├── tutorial_01.md
    └── tutorial_02.md
```

### **Template (inspirado no SOLIDOS):**

```html
<!DOCTYPE html>
<html>
<head>
    <title>ConstruData SABESP - Ajuda</title>
    <style>
        body { font-family: Segoe UI; }
        h1 { color: #1F4E79; }
        .command { background: #f0f0f0; padding: 10px; }
    </style>
</head>
<body>
    <h1>ConstruData SABESP v5.1</h1>
    
    <h2>Comandos</h2>
    <div class="command">
        <h3>CONSTRUDATA</h3>
        <p>Abre a interface principal do ConstruData.</p>
        <p><b>Uso:</b> Digite CONSTRUDATA na linha de comando.</p>
    </div>
    
    <h2>Tutoriais</h2>
    <ul>
        <li><a href="tutorial_01.html">Gerar primeira NS</a></li>
        <li><a href="tutorial_02.html">Processar em lote</a></li>
    </ul>
</body>
</html>
```

---

## 🔟 INSTALAÇÃO (Todos os plugins)

### **Processo padrão Autodesk:**

```bash
# 1. Copiar bundle para pasta de plugins
xcopy /E /I "ConstruData.bundle" "%APPDATA%\Autodesk\ApplicationPlugins\ConstruData.bundle"

# 2. Ou copiar para pasta global (todos os usuários)
xcopy /E /I "ConstruData.bundle" "C:\ProgramData\Autodesk\ApplicationPlugins\ConstruData.bundle"

# 3. Reiniciar AutoCAD/Civil 3D
QUIT

# 4. Verificar instalação
APPLOAD
# Deve aparecer "ConstruData" na lista
```

---

## 📋 CHECKLIST — O QUE JÁ TEMOS

| Item | Status | Arquivo |
|------|--------|---------|
| Classes PV, Trecho, Rede | ✅ | `models.py` |
| Banco SQLite | ✅ | `database.py` |
| PackageContents.xml | ✅ | `ConstruData.bundle/` |
| Estrutura modular | ✅ | `construdata/` |
| Validação embutida | ✅ | `models.py` |
| Export GeoJSON | ✅ | `models.py` |
| Testes passando | ✅ | `test_novas_classes.py` |

---

## ⏳ CHECKLIST — O QUE FALTA

| Item | Prioridade | Esforço |
|------|------------|---------|
| DLL C# (pythonnet) | Alta | 4-6 horas |
| Ribbon CUIX | Média | 2-3 horas |
| Comandos AutoCAD | Alta | 2-3 horas |
| Nodes Dynamo | Média | 4-6 horas |
| Help PT/EN | Baixa | 2-3 horas |
| Ícones/Resources | Baixa | 1-2 horas |

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

### **FAZER AGORA (Alta prioridade):**

1. **Criar DLL C# com pythonnet**
   - NuGet: `pythonnet`
   - Integrar com `models.py`
   - Testar no Civil 3D 2025

2. **Criar comandos básicos**
   - `CONSTRUDATA` → Abre form
   - `CONSTRUDATA_BATCH` → Processa lote
   - `CONSTRUDATA_QA` → Dashboard

3. **Testar instalação**
   - Copiar bundle
   - Carregar no Civil 3D
   - Executar comandos

### **FAZER DEPOIS (Média prioridade):**

4. **Criar Ribbon CUIX**
   - Usar CuixEditor
   - Adicionar botões
   - Testar UI

5. **Criar nodes Dynamo**
   - pkg.json
   - Nodes básicos (CriarRede, Exportar)
   - Testar no Dynamo

### **FAZER FUTURAMENTE (Baixa prioridade):**

6. **Documentação**
   - help_PT.html
   - Screenshots
   - Tutoriais

7. **Ícones e Resources**
   - Logo ConstruData
   - Ícones de comandos
   - Imagens de help

---

## 📚 REFERÊNCIAS

### **Plugins analisados:**
- `SOLIDOS.bundle` → Modelagem de dispositivos
- `QuuxPipeElevationEditor.bundle` → Editor de cotas
- `C3DMEMO.bundle` → Memoriais descritivos
- `Civil 3D Drainage Analysis.bundle` → Análise de drenagem
- `KobiToolkitForCivil3D.bundle` → Toolkit completo

### **Arquivos de aprendizado:**
- `ANALISE_SEWERCAD_COMPLETA.md` → Bentley SewerCAD
- `PLUGINS_AUTOCAD_ANALISE.md` → Plugins AutoCAD
- `MELHORIAS_SEWERCAD.md` → Classes e SQLite
- `LIÇÕES_AUTODESK.md` → Este arquivo

---

*Documento criado em 20/03/2026 — ConstruData SABESP v5.1.0*
