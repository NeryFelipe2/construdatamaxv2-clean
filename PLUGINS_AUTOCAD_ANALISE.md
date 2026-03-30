# 🎯 PLUGIN AUTOCAD - CONSTRUDATA SABESP

**Inspirado nos plugins:** SOLIDOS, QuuxPipeElevationEditor, C3DMEMO

---

## 📦 ESTRUTURA DO PLUGIN

```
ConstruData.bundle/
├── PackageContents.xml          ← Manifesto do plugin (igual SOLIDOS)
├── Contents/
│   ├── dotnet_4/                ← Civil 3D 2020-2024 (.NET 4.8)
│   │   ├── ConstruData_2020.dll
│   │   ├── ConstruData_2021.dll
│   │   ├── models.dll
│   │   └── database.dll
│   ├── dotnet_8/                ← Civil 3D 2025+ (.NET 8)
│   │   ├── ConstruData_2025.dll
│   │   ├── models.dll
│   │   └── database.dll
│   ├── Resources/
│   │   ├── construdata.ico      ← Ícone
│   │   ├── ConstruData.cuix     ← Ribbon UI
│   │   ├── construdata.mnr      ← Menu images
│   │   └── images/
│   │       ├── icon_large.png
│   │       └── icon_small.png
│   ├── Support/
│   │   ├── templates/
│   │   │   ├── OSE-Modelo_1.xlsx
│   │   │   └── ns_template.html
│   │   ├── catalogs/
│   │   │   ├── tubos_pvc.csv
│   │   │   └── pv_concreto.csv
│   │   └── lisp/
│   │       ├── construdata.lsp
│   │       └── utilities.lsp
│   ├── Dynamo/
│   │   ├── ConstruData/
│   │   │   ├── pkg.json
│   │   │   ├── bin/
│   │   │   └── dyf/
│   │   └── scripts/
│   │       ├── gerar_rede.dyn
│   │       └── exportar_ifc.dyn
│   ├── help_PT.html
│   └── help_EN.html
```

---

## 📄 PACKAGECONTENTS.XML

### Estrutura (igual SOLIDOS):

```xml
<ApplicationPackage 
    SchemaVersion="1.0" 
    AutodeskProduct="AutoCAD" 
    Name="ConstruData SABESP" 
    AppVersion="5.1.0" 
    ProductCode="{GUID}" 
    UpgradeCode="{GUID}">
    
  <CompanyDetails 
      Name="DGS Engenharia" 
      Email="felipe@dgsengenharia.com.br" 
      Url="https://github.com/NeryFelipe2" />
  
  <!-- Civil 3D 2020-2024 -->
  <Components Description="Civil 3D 2020-2024">
    <RuntimeRequirements OS="Win64" Platform="Civil3D" SeriesMin="R23.0" SeriesMax="R24.3" />
    <ComponentEntry 
        AppName="ConstruData" 
        ModuleName="./Contents/dotnet_4/ConstruData_2020.dll" 
        LoadOnAutoCADStartup="True">
      <Commands>
        <Command Global="CONSTRUDATA" />
        <Command Global="CONSTRUDATA_BATCH" />
      </Commands>
    </ComponentEntry>
  </Components>
  
  <!-- Civil 3D 2025+ -->
  <Components Description="Civil 3D 2025+">
    <RuntimeRequirements OS="Win64" Platform="Civil3D" SeriesMin="R25.0" SeriesMax="R26.0" />
    <ComponentEntry 
        AppName="ConstruData" 
        ModuleName="./Contents/dotnet_8/ConstruData_2025.dll" 
        LoadOnAutoCADStartup="True">
      <Commands>
        <Command Global="CONSTRUDATA" />
      </Commands>
    </ComponentEntry>
  </Components>
</ApplicationPackage>
```

---

## 🔧 COMANDOS DO PLUGIN

### 1. **CONSTRUDATA** (Principal)
```
Comando: CONSTRUDATA
Alias: CD
Menu: Plugins > ConstruData > Gerar NS

Função: Abre interface principal do ConstruData
- Selecionar DXF
- Selecionar GPKG (opcional)
- Selecionar núcleo
- Gerar NS completas
```

### 2. **CONSTRUDATA_BATCH**
```
Comando: CONSTRUDATA_BATCH
Alias: CDB
Menu: Plugins > ConstruData > Batch

Função: Processa todos os núcleos em lote
- Selecionar pasta com DXFs
- Processar automaticamente
- Gerar relatório consolidado
```

### 3. **CONSTRUDATA_QA**
```
Comando: CONSTRUDATA_QA
Alias: CDQA
Menu: Plugins > ConstruData > Qualidade

Função: Abre dashboard de qualidade
- Visualizar rede no mapa
- Gráficos de hidráulica
- Tabela de trechos
```

### 4. **CONSTRUDATA_SQLITE**
```
Comando: CONSTRUDATA_SQLITE
Alias: CDSQL

Função: Gerenciar banco SQLite
- Abrir banco existente
- Criar novo banco
- Exportar relatório
```

---

## 🎨 RIBBON UI (ConstruData.cuix)

### Layout (inspirado no SOLIDOS):

```
┌────────────────────────────────────────────────────────────┐
│  CONSTRUDATA SABESP v5.1                                   │
├────────────────────────────────────────────────────────────┤
│  [🏠] [📁] [⚙️] [📊] [❓]                                  │
│  Início  Arquivo  Config  Qualidade  Ajuda                 │
└────────────────────────────────────────────────────────────┘

Painel Início:
┌──────────────────────────────────────────┐
│  [📄]        [📂]        [⚡]            │
│  Gerar NS    Batch       Quick           │
└──────────────────────────────────────────┘

Painel Arquivo:
┌──────────────────────────────────────────┐
│  [📥]        [📤]        [💾]            │
│  Importar    Exportar    SQLite          │
└──────────────────────────────────────────┘

Painel Qualidade:
┌──────────────────────────────────────────┐
│  [📊]        [🗺️]        [📈]            │
│  Dashboard   Mapa        Gráficos        │
└──────────────────────────────────────────┘
```

---

## 💻 CÓDIGO DO PLUGIN (C#)

### ConstruData_2025.dll (.NET 8):

```csharp
using Autodesk.AutoCAD.Runtime;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.EditorInput;

namespace ConstruData
{
    public class Commands
    {
        [CommandMethod("CONSTRUDATA")]
        public void ConstrudataMain()
        {
            // Abrir interface principal
            var form = new MainForm();
            form.Show();
        }
        
        [CommandMethod("CONSTRUDATA_BATCH")]
        public void ConstrudataBatch()
        {
            // Processar em lote
            var batchForm = new BatchForm();
            batchForm.Show();
        }
        
        [CommandMethod("CONSTRUDATA_QA")]
        public void ConstrudataQA()
        {
            // Dashboard de qualidade
            var qaForm = new QAForm();
            qaForm.Show();
        }
    }
    
    // Integração com Python
    public class PythonEngine
    {
        public static dynamic RunPythonScript(string scriptPath)
        {
            // Usar pythonnet para rodar scripts Python
            PythonEngine.Initialize();
            using (Py.GIL())
            {
                dynamic sys = Py.Import("sys");
                sys.path.append(@"C:\Users\felip\Downloads\NOVA NS Versao 5");
                
                dynamic construdata = Py.Import("construdata");
                return construdata;
            }
        }
    }
}
```

---

## 🔗 INTEGRAÇÃO PYTHON ↔ C#

### Opção 1: **pythonnet** (Recomendado)

```csharp
// NuGet: pythonnet
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
            dynamic Trecho = models.Trecho;
            dynamic Rede = models.Rede;
            
            // Criar objetos Python
            dynamic pv = PV(id: "PV_001", x: 360000, y: 7350000, ct: 15.5, cf: 13.0);
            Console.WriteLine($"PV criado: {pv.id}");
            Console.WriteLine($"Profundidade: {pv.profundidade_real}");
        }
    }
}
```

### Opção 2: **Processo separado**

```csharp
public class PythonProcess
{
    public void RunScript(string scriptPath, string args)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "python",
            Arguments = $"\"{scriptPath}\" {args}",
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        
        using (var process = Process.Start(psi))
        {
            string output = process.StandardOutput.ReadToEnd();
            process.WaitForExit();
            
            // Processar resultado
            Console.WriteLine(output);
        }
    }
}
```

---

## 📊 DYNAMO NODES

### Estrutura (igual SOLIDOS):

```
ConstruData/
├── pkg.json
├── bin/
│   ├── ConstruData.dll
│   └── ConstruData.xml
└── dyf/
    ├── CriarRedeEsgoto.dyf
    ├── ExportarGeoJSON.dyf
    ├── GerarOSE.dyf
    └── CalcularManning.dyf
```

### pkg.json:

```json
{
  "license": "MIT",
  "file_hash": null,
  "name": "ConstruData",
  "version": "5.1.0",
  "description": "Nodes para geração de redes de esgoto SABESP",
  "author": "Felipe Nery",
  "contains_binaries": true,
  "node_libraries": [
    "ConstruData, Version=5.1.0.0, Culture=neutral, PublicKeyToken=null"
  ]
}
```

### Node: CriarRedeEsgoto.dyf

```python
# Inputs:
# - dxf_path: string
# - nucleo: string
# - gpkg_path: string (opcional)

# Outputs:
# - rede: Rede
# - pvs: list
# - trechos: list
# - erros: list

import sys
sys.path.append(r"C:\Users\felip\Downloads\NOVA NS Versao 5")

from models import Rede
from construdata_sabesp_v5_FINAL import ler_dxf, enriquecer_trechos

# Ler DXF
pvs, trechos, ruas, meta = ler_dxf(dxf_path)

# Enriquecer
trechos = enriquecer_trechos(trechos, pvs)

# Criar rede
rede = Rede(nome=f"Rede {nucleo}", nucleo=nucleo)
for t in trechos:
    rede.adicionar_trecho(Trecho.from_dict(t))

# Output
OUT = {
    "rede": rede,
    "pvs": list(pvs.values()),
    "trechos": trechos,
    "validacao": rede.validar()
}
```

---

## 🚀 INSTALAÇÃO

### Passo 1: Copiar bundle
```bash
# Copiar para pasta de plugins
xcopy /E /I "ConstruData.bundle" "%APPDATA%\Autodesk\ApplicationPlugins\ConstruData.bundle"
```

### Passo 2: Registrar (opcional)
```bash
# Ou usar comando AutoCAD
APPLOAD
# Selecionar PackageContents.xml
```

### Passo 3: Reiniciar AutoCAD
```
Comando: QUIT
```

---

## 📚 LIÇÕES DOS PLUGINS ANALISADOS

### SOLIDOS:
- ✅ Suporta múltiplas versões (2020-2025)
- ✅ Dynamo integrado
- ✅ Templates e catálogos
- ✅ Help em PT/EN

### QuuxPipeElevationEditor:
- ✅ Foco em uma função específica (editar cotas)
- ✅ Comandos simples (1 comando principal)
- ✅ Leve e rápido

### C3DMEMO:
- ✅ Geração de memoriais descritivos
- ✅ Templates personalizáveis (.ldc)
- ✅ Integração com Excel

### TBN2CAD:
- ✅ Veículos de projeto (.VCL)
- ✅ GPS e imagens
- ✅ LISP integrado

---

## 🎯 PRÓXIMOS PASSOS

1. **Criar DLL C#** que chama Python
2. **Criar CUIX** (Ribbon UI)
3. **Criar PackageContents.xml**
4. **Testar no Civil 3D 2025**
5. **Criar nodes Dynamo**
6. **Documentação (help_PT.html)**

---

*Documento criado em 20/03/2026 — ConstruData SABESP v5.1.0*
