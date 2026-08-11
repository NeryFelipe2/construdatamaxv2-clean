# 🚀 GUIA RÁPIDO — BIM/IFC E AUTOMACAO CIVIL 3D

**ConstruData SABESP v5.0** — Atualizado em 20/03/2026

---

## 📋 1. FLUXO COMPLETO

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DXF ProSaneamento (Civil 3D + XDATA)                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ConstruData v5.0                                         │
│    python construdata_sabesp_v5_FINAL.py TETEU.dxf          │
│    --nucleo "Morro do Tetéu"                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
         ┌────────────────┴────────────────┐
         ↓                                 ↓
┌──────────────────┐            ┌──────────────────┐
│ 3A. IFC LOD500   │            │ 3B. JSON Dynamo  │
│    06_BIM/       │            │    05_GIS/       │
│    REDE.ifc      │            │    rede_dynamo.json │
└──────────────────┘            └──────────────────┘
         ↓                                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Civil 3D 2025+                                           │
│    A) Importar IFC → visualização 3D                        │
│    B) python automacao_civil3d.py rede_dynamo.json          │
│       → Pipe Network real no Civil 3D                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 2. COMANDOS RÁPIDOS

### 2.1 Gerar IFC + JSON

```bash
# Único núcleo
python construdata_sabesp_v5_FINAL.py TETEU_ESGOTO.dxf --nucleo "Morro do Tetéu"

# Batch (todos os núcleos)
python construdata_sabesp_v5_FINAL.py --batch
```

**Saída:**
```
SAIDA_BIM_SABESP/
  MORRO_DO_TETEU/
    05_GIS/
      ├── rede_definida.json
      └── rede_dynamo.json         ← Para Civil 3D
    06_BIM/
      └── REDE_MORRO_DO_TETEU.ifc  ← Para Solibri/Navisworks
```

---

### 2.2 Visualizar IFC

**Opção A: Solibri Model Viewer (gratuito)**
```bash
# 1. Baixar: https://www.solibri.com/solibri-model-viewer
# 2. Abrir: SAIDA_BIM_SABESP/MORRO_DO_TETEU/06_BIM/REDE_MORRO_DO_TETEU.ifc
# 3. Visualizar em 3D
```

**Opção B: BIMvision (gratuito)**
```bash
# 1. Baixar: https://bimvision.com/en/bimvision-viewers/
# 2. Abrir arquivo .ifc
```

**Opção C: Autodesk Navisworks (pago)**
```bash
# 1. Abrir Navisworks
# 2. Append: REDE_MORRO_DO_TETEU.ifc
```

---

### 2.3 Criar Pipe Network no Civil 3D

**Método Automático (RECOMENDADO):**

```bash
# 1. Abrir Civil 3D 2025+
# 2. Carregar DXF: TETEU_ESGOTO.dxf
# 3. Executar automação:
python automacao_civil3d.py "SAIDA_BIM_SABESP\MORRO_DO_TETEU\05_GIS\rede_dynamo.json"
```

**Método Manual (se automação falhar):**

```bash
# 1. Civil 3D 2025+ aberto
# 2. Manage → Dynamo
# 3. File → New
# 4. Adicionar Python Script (biblioteca → Design)
# 5. Double-click no Python Script
# 6. Copiar código de: 07_LOG/dynamo_pipe_network_v5.py
# 7. Colar no Python Script
# 8. Adicionar entrada IN[0] = caminho do rede_dynamo.json
# 9. Run → Executar
```

---

## ⚙️ 3. CONFIGURAÇÃO DO AMBIENTE

### 3.1 Instalação Básica

```bash
# Python 3.10+
pip install ezdxf openpyxl matplotlib networkx

# Opcional (GIS)
pip install geopandas pyogrio pyproj

# Opcional (IFC)
pip install ifcopenshell

# Opcional (Automação)
pip install pyautogui pygetwindow clipboard
```

### 3.2 Instalação Civil 3D

**Requisitos:**
- Windows 10/11 64-bit
- Civil 3D 2025.1+ (obrigatório para API PipeNetwork.ByName)
- 16GB RAM mínimo
- 10GB espaço livre

**Verificar versão:**
```
Civil 3D → Help → About
Versão deve ser: 2025.1 ou superior
```

---

## 🔍 4. VALIDAÇÃO CRS

### 4.1 Verificar se CRS está correto

**No output do ConstruData:**
```
[19:30:42]   ⚠️ CRS incompativel: PVs X=361,720, Tubos X=1,234
[19:30:42]      Diferenca > 100km — impossivel fazer snap
[19:30:42]   CRS incompativel — fallback para XDATA
```

**Se aparecer este aviso:**
- ✅ Script automaticamente usou fallback para XDATA
- ✅ PVs e tubos agora estão no mesmo CRS
- ✅ Snap deve funcionar corretamente

**Se não aparecer aviso:**
```
[19:30:45]   ✅ CRS: 320 PVs em UTM (EPSG:31983)
```
- ✅ Todos os PVs em UTM
- ✅ IFC georeferenciado corretamente

---

### 4.2 Validar IFC

**Checklist:**
- [ ] Arquivo .ifc gerado em `06_BIM/`
- [ ] Tamanho > 100KB
- [ ] Abre em visualizador IFC
- [ ] PVs aparecem como caixas 3D
- [ ] Tubos aparecem como cilindros
- [ ] Georeferenciamento correto

**Comando:**
```bash
# Verificar tamanho
dir SAIDA_BIM_SABESP\MORRO_DO_TETEU\06_BIM\*.ifc

# Deve ser > 100KB
```

---

## 🤖 5. AUTOMACAO CIVIL 3D — DETALHES

### 5.1 Métodos Disponíveis

| Método | Tempo | Automático | Requer |
|--------|-------|------------|--------|
| **.NET direto** | 15s | ✅ 100% | Python no Civil 3D |
| **Dynamo + pyautogui** | 2min | ⚠️ 80% | Civil 3D aberto |
| **Manual** | 10min | ❌ 0% | Civil 3D + Dynamo |

### 5.2 Quando Usar Cada Método

**Método .NET (RECOMENDADO):**
- ✅ Civil 3D 2025.1+ instalado
- ✅ Python instalado dentro do Civil 3D
- ✅ Quer automação 100%
- ✅ Vai processar muitos núcleos

**Método Dynamo:**
- ✅ Civil 3D 2025+ instalado
- ❌ Python não está no Civil 3D
- ✅ Aceita intervenção parcial
- ✅ Processa poucos núcleos

**Método Manual:**
- ❌ Automação falhou
- ✅ Quer controle total
- ✅ Processa 1-2 núcleos apenas

---

## 📊 6. EXEMPLO REAL — MORRO DO TETÉU

### 6.1 Gerar Dados

```bash
cd "C:\Users\felip\Downloads\NOVA NS Versao 5"
python construdata_sabesp_v5_FINAL.py "C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\MORRO DO TETÉU\TETÉU_ESGOTO.dxf" --nucleo "Morro do Tetéu"
```

**Output:**
```
[19:30:40] >>>  Lendo DXF: TETÉU_ESGOTO.dxf
[19:30:42]   ⚠️ CRS incompativel: PVs X=361,720, Tubos X=1,234
[19:30:42]   CRS incompativel — fallback para XDATA
[19:30:43]   PVs (XDATA fallback): 320
[19:30:45]   Gerando IFC LOD500: REDE_MORRO_DO_TETEU.ifc
[19:30:45]   ✅ CRS: 320 PVs em UTM (EPSG:31983)
[19:30:45]   IFC LOD500: REDE_MORRO_DO_TETEU.ifc (456KB) | 441 pipes | 320 structures
[19:30:45]   Gerando GIS (GeoJSON + rede_dynamo.json)...
[19:30:45]   rede_dynamo.json: rede_dynamo.json
```

### 6.2 Visualizar IFC

```bash
# Abrir Solibri Model Viewer
# File → Open → REDE_MORRO_DO_TETEU.ifc
# Visualizar em 3D
```

### 6.3 Criar Pipe Network

```bash
# Abrir Civil 3D 2025+
# Carregar DXF: TETÉU_ESGOTO.dxf

# Executar automação
python automacao_civil3d.py "SAIDA_BIM_SABESP\MORRO_DO_TETEU\05_GIS\rede_dynamo.json"
```

**Output:**
```
======================================================================
CRIACAO DIRETA DE PIPE NETWORK
======================================================================
✅ Civil 3D API carregada
✅ Documento ativo: TETEU_ESGOTO.dxf
✅ Pipe Network criada: REDE_MORRO_DO_TETEU
📋 Criando 320 estruturas (PVs)...
✅ 320 estruturas criadas
📋 Criando 441 tubos...
✅ 441 tubos criados
======================================================================
PIPE NETWORK CRIADA COM SUCESSO!
  Estruturas: 320
  Tubos: 441
======================================================================
```

### 6.4 Verificar no Civil 3D

```
1. Toolspace → Prospector
2. Expandir "Pipe Networks"
3. Deve aparecer: "REDE_MORRO_DO_TETEU"
4. Right-click → Edit Pipe Network
5. Visualizar PVs e tubos em 3D
```

---

## ⚠️ 7. TROUBLESHOOTING

### Problema 1: CRS Incompatível

**Sintoma:**
```
⚠️ CRS incompativel: PVs X=361,720, Tubos X=1,234
```

**Solução:**
- ✅ Script já faz fallback automático para XDATA
- ✅ Não precisa fazer nada
- ✅ Snap vai funcionar com XDATA

---

### Problema 2: ifcopenshell não instalado

**Sintoma:**
```
ifcopenshell não instalado — pip install ifcopenshell
```

**Solução:**
```bash
pip install ifcopenshell
# Ou baixar wheel: https://github.com/IfcOpenShell/IfcOpenShell/releases
```

---

### Problema 3: Civil 3D não encontrado

**Sintoma:**
```
❌ Civil 3D não encontrado
   Abra o Civil 3D 2025+ e tente novamente
```

**Solução:**
1. Abrir Civil 3D 2025+
2. Carregar DXF
3. Manter Civil 3D aberto
4. Executar automação novamente

---

### Problema 4: Pipe Network já existe

**Sintoma:**
```
⚠️ Pipe Network já existe: REDE_MORRO_DO_TETEU
```

**Solução:**
```python
# No Civil 3D:
# 1. Toolspace → Prospector → Pipe Networks
# 2. Right-click em REDE_MORRO_DO_TETEU
# 3. Delete
# 4. Executar automação novamente
```

---

### Problema 5: Dynamo não abre

**Sintoma:**
```
⚠️ Dynamo não respondeu
```

**Solução:**
```bash
# Fechar Civil 3D
# Reiniciar Civil 3D
# Manage → Dynamo novamente
# Se persistir: reinstall Dynamo
```

---

## 📞 8. SUPORTE

### Documentação Completa

| Arquivo | Descrição |
|---------|-----------|
| `STATUS_BIM_IFC.md` | Status completo do BIM/IFC |
| `MELHORIAS_BIM_IFC_AUTOMACAO.md` | Detalhe das melhorias |
| `ANALISE_SNAP_LLM1.md` | Problema do CRS e snap |
| `TAREFA_LLM3_CONCLUIDA.md` | Dashboards HTML |

### Comandos Úteis

```bash
# Ajuda do script
python construdata_sabesp_v5_FINAL.py --help

# Testar CRS
python test_crs_verificacao.py

# Diagnosticar snap
python test_snap_diagnostico.py
```

---

*Guia criado em 20/03/2026 — ConstruData SABESP v5.0*
