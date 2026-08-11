# 🚀 TAREFA: CRIAR PLUGIN AUTOCAD PARA CONSTRUDATA SABESP

**Projeto:** ConstruData SABESP v5.1.0  
**Objetivo:** Criar plugin AutoCAD/Civil 3D que integra com Python existente  
**Prioridade:** ALTA  
**Tempo estimado:** 4-6 horas

---

## 📋 CONTEXTO DO PROJETO

### O que é o ConstruData:
- Pipeline Python para geração de Notas de Serviço (NS) SABESP
- Extrai PVs e tubos de DXF do ProSaneamento (Civil 3D)
- Calcula hidráulica (Manning), custos SINAPI, valida rede
- Gera: PDF (A4/A3), Excel (OSE), JSON, HTML (Leaflet), IFC

### O que já está PRONTO (NÃO MEXER):
```
✅ models.py          → Classes PV, Trecho, Rede (dataclasses)
✅ database.py        → Banco SQLite (salvar/carregar)
✅ construdata_sabesp_v5_FINAL.py → Script principal (4500 linhas)
✅ PackageContents.xml → Manifesto do plugin já criado
✅ Testes passando    → test_novas_classes.py OK
```

**Localização:** `C:\Users\felip\Downloads\NOVA NS Versao 5\`

---

## 🎯 O QUE PRECISA SER FEITO

### TAREFA 1: Criar DLL C# com pythonnet (2-3 horas)

**Objetivo:** Criar DLL que chama Python do C#

**Passos:**

1. **Criar projeto C# (.NET 8 para Civil 3D 2025+)**
   ```bash
   # Usar Visual Studio 2022 ou dotnet CLI
   dotnet new classlib -n ConstruData -f net8.0-windows
   ```

2. **Instalar NuGet packages:**
   ```xml
   <PackageReference Include="pythonnet" Version="3.0.3" />
   <PackageReference Include="Autodesk.AutoCAD.Runtime" Version="25.0.0" />
   <PackageReference Include="Autodesk.AutoCAD.ApplicationServices" Version="25.0.0" />
   ```

3. **Criar classe Commands.cs:**
   ```csharp
   using Autodesk.AutoCAD.Runtime;
   using Autodesk.AutoCAD.ApplicationServices;
   using Autodesk.AutoCAD.EditorInput;
   using Python.Runtime;

   namespace ConstruData
   {
       public class Commands
       {
           [CommandMethod("CONSTRUDATA")]
           public void ConstrudataMain()
           {
               try
               {
                   // Inicializar Python
                   PythonEngine.Initialize();
                   
                   using (Py.GIL())
                   {
                       // Adicionar path do projeto
                       dynamic sys = Py.Import("sys");
                       sys.path.append(@"C:\Users\felip\Downloads\NOVA NS Versao 5");
                       
                       // Importar e executar script principal
                       dynamic construdata = Py.Import("construdata_sabesp_v5_FINAL");
                       
                       // Chamar função de teste ou abrir form
                       Editor ed = Application.DocumentManager.MdiActiveDocument.Editor;
                       ed.WriteMessage("\nConstruData carregado com sucesso!");
                   }
                   
                   PythonEngine.Shutdown();
               }
               catch (Exception ex)
               {
                   Editor ed = Application.DocumentManager.MdiActiveDocument.Editor;
                   ed.WriteMessage($"\nERRO: {ex.Message}");
               }
           }
           
           [CommandMethod("CONSTRUDATA_BATCH")]
           public void ConstrudataBatch()
           {
               // Similar ao acima, chama processar_batch()
           }
           
           [CommandMethod("CONSTRUDATA_QA")]
           public void ConstrudataQA()
           {
               // Abre dashboard de qualidade
           }
       }
   }
   ```

4. **Criar classe PythonBridge.cs (opcional, mas recomendado):**
   ```csharp
   using Python.Runtime;

   namespace ConstruData
   {
       public static class PythonBridge
       {
           public static void Initialize()
           {
               PythonEngine.Initialize();
           }
           
           public static void Shutdown()
           {
               PythonEngine.Shutdown();
           }
           
           public static dynamic RunScript(string scriptPath, string functionName, params object[] args)
           {
               using (Py.GIL())
               {
                   dynamic sys = Py.Import("sys");
                   sys.path.append(@"C:\Users\felip\Downloads\NOVA NS Versao 5");
                   
                   string moduleName = System.IO.Path.GetFileNameWithoutExtension(scriptPath);
                   dynamic module = Py.Import(moduleName);
                   
                   dynamic func = module.GetAttr(functionName);
                   return func.Invoke(args);
               }
           }
           
           public static T CreateObject<T>(string className, params object[] args)
           {
               using (Py.GIL())
               {
                   dynamic models = Py.Import("models");
                   dynamic classType = models.GetAttr(className);
                   return classType.Invoke(args).As<T>();
               }
           }
       }
   }
   ```

5. **Compilar DLL:**
   ```bash
   dotnet build -c Release
   ```

6. **Output esperado:**
   - `bin/Release/net8.0-windows/ConstruData.dll`
   - Copiar para `ConstruData.bundle/Contents/dotnet_8/`

---

### TAREFA 2: Criar Ribbon UI (CUIX) (1-2 horas)

**Objetivo:** Criar ribbon com botões para comandos

**Passos:**

1. **Abrir CuixEditor no AutoCAD:**
   ```
   Comando: CUI
   ```

2. **Criar novo CUIX:**
   - Nome: `ConstruData.cuix`
   - Criar Ribbon Tab: "ConstruData SABESP"
   - Criar 3 Panels:
     - **Início:** Botão "Gerar NS", "Batch", "Quick"
     - **Qualidade:** Botão "Dashboard", "Mapa", "Gráficos"
     - **Dados:** Botão "SQLite", "Exportar", "Importar"

3. **Associar comandos:**
   - Botão "Gerar NS" → `CONSTRUDATA`
   - Botão "Batch" → `CONSTRUDATA_BATCH`
   - Botão "Dashboard" → `CONSTRUDATA_QA`

4. **Salvar CUIX:**
   - Salvar em: `ConstruData.bundle/Contents/Resources/ConstruData.cuix`

5. **Criar arquivo de imagens (opcional):**
   - `ConstruData.mnr` (menu images)
   - Ícones 16x16 e 32x32 para cada botão

---

### TAREFA 3: Atualizar PackageContents.xml (30 minutos)

**Objetivo:** Apontar para DLL correta

**Arquivo:** `ConstruData.bundle/PackageContents.xml`

**O que mudar:**

```xml
<!-- Adicionar ComponentEntry para DLL -->
<Components Description="Civil 3D 2025+">
  <RuntimeRequirements OS="Win64" Platform="Civil3D" SeriesMin="R25.0" SeriesMax="R26.0" />
  
  <!-- DLL principal -->
  <ComponentEntry 
      AppName="ConstruData" 
      Version="5.1.0" 
      ModuleName="./Contents/dotnet_8/ConstruData.dll" 
      LoadOnAutoCADStartup="True">
    <Commands>
      <Command Global="CONSTRUDATA" />
      <Command Global="CONSTRUDATA_BATCH" />
      <Command Global="CONSTRUDATA_QA" />
    </Commands>
  </ComponentEntry>
  
  <!-- CUIX -->
  <ComponentEntry 
      AppName="ConstruData" 
      Version="5.1.0" 
      ModuleName="./Contents/Resources/ConstruData.cuix" 
      LoadOnAutoCADStartup="True" />
</Components>
```

---

### TAREFA 4: Testar instalação (30 minutos)

**Objetivo:** Verificar se plugin carrega no Civil 3D

**Passos:**

1. **Copiar bundle:**
   ```bash
   xcopy /E /I "ConstruData.bundle" "%APPDATA%\Autodesk\ApplicationPlugins\ConstruData.bundle"
   ```

2. **Abrir Civil 3D 2025/2026**

3. **Testar comandos:**
   ```
   Comando: CONSTRUDATA
   Deve aparecer: "ConstruData carregado com sucesso!"
   
   Comando: APPLOAD
   Deve aparecer: "ConstruData" na lista de aplicativos carregados
   ```

4. **Verificar Ribbon:**
   - Deve aparecer tab "ConstruData SABESP" no Ribbon

5. **Testar Python:**
   ```
   Comando: CONSTRUDATA
   Deve importar models.py sem erros
   ```

---

## 📁 ESTRUTURA DE PASTAS FINAL

```
ConstruData.bundle/
├── PackageContents.xml          ← Atualizado com DLL
├── Contents/
│   ├── dotnet_8/
│   │   ├── ConstruData.dll      ← GERADA NA TAREFA 1
│   │   ├── ConstruData.pdb
│   │   └── pythonnet_*.dll      ← Dependencies
│   ├── Resources/
│   │   ├── ConstruData.cuix     ← GERADA NA TAREFA 2
│   │   ├── ConstruData.mnr      ← Opcional
│   │   └── icon.ico             ← Opcional
│   └── Support/
│       └── (templates, etc.)    ← Já existe
└── help_PT.html                 ← Opcional (baixa prioridade)
```

---

## ✅ CRITÉRIOS DE SUCESSO

### Mínimo aceitável:
- [ ] DLL C# compila sem erros
- [ ] Comando `CONSTRUDATA` funciona no Civil 3D
- [ ] Python é carregado sem erros
- [ ] Plugin carrega automaticamente (LoadOnStartup=True)

### Ideal:
- [ ] Ribbon com botões funciona
- [ ] Todos 3 comandos (MAIN, BATCH, QA) funcionam
- [ ] Classes Python (PV, Trecho, Rede) acessíveis do C#
- [ ] SQLite acessível do C#

---

## 🚫 O QUE NÃO FAZER

- ❌ NÃO reescrever lógica Python em C#
- ❌ NÃO modificar `models.py`, `database.py`, `construdata_sabesp_v5_FINAL.py`
- ❌ NÃO criar UI complexa (WPF/WinForms) nesta fase
- ❌ NÃO implementar motor hidráulico em C# (usar Python)

---

## 🔧 FERRAMENTAS NECESSÁRIAS

1. **Visual Studio 2022** (ou VS Code + .NET SDK)
2. **.NET 8.0 SDK** (para Civil 3D 2025+)
3. **Civil 3D 2025/2026** (para testes)
4. **Python 3.14** (já instalado)
5. **pip install pythonnet** (já instalado?)

---

## 📚 REFERÊNCIAS

### Arquivos do projeto:
- `models.py` → Classes para usar do C#
- `database.py` → SQLite para usar do C#
- `test_novas_classes.py` → Exemplo de uso das classes
- `ConstruData.bundle/PackageContents.xml` → Manifesto já criado

### Documentação:
- `LIÇÕES_AUTODESK.md` → Tudo que aprendemos da Autodesk
- `PLUGINS_AUTOCAD_ANALISE.md` → Análise de plugins similares
- `MELHORIAS_SEWERCAD.md` → Classes e SQLite

### Exemplos externos:
- `C:\Program Files\Autodesk\ApplicationPlugins\SOLIDOS.bundle\` → Plugin similar
- `C:\Users\felip\AppData\Roaming\Autodesk\ApplicationPlugins\QuuxPipeElevationEditor.bundle\`

---

## 🆘 SUPORTE

**Dúvidas técnicas:**
- pythonnet: https://pythonnet.github.io/
- AutoCAD .NET: https://autodesk.typepad.com/files/autocad-2025-net-developer-guide.pdf
- PackageContents.xml: Ver exemplos em `C:\Program Files\Autodesk\ApplicationPlugins\`

**Caminhos importantes:**
- Projeto Python: `C:\Users\felip\Downloads\NOVA NS Versao 5\`
- Plugins AutoCAD: `%APPDATA%\Autodesk\ApplicationPlugins\`
- Civil 3D 2025: `C:\Program Files\Autodesk\AutoCAD 2025\`

---

## 📞 CONTATO

**Engenheiro responsável:** Felipe Nery  
**Projeto:** SE LIGA NA REDE — SABESP Santos  
**Contrato:** 11481051  

---

*Documento criado em 20/03/2026 para handoff para LLM de implementação*
