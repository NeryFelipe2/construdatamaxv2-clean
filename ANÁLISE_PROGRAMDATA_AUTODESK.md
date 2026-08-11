# 🔍 ANÁLISE FINAL: C:\ProgramData\Autodesk

**Data:** 20/03/2026  
**Foco:** Plugin C3DRENESG4 (Drenagem e Esgoto)

---

## 📊 DESCOBERTA PRINCIPAL

### **C3DRENESG4.bundle** — Plugin TBN2NET para Civil 3D

**Local:** `C:\ProgramData\Autodesk\ApplicationPlugins\C3DRENESG4.bundle\`

**Descrição:** Plugin para dimensionamento de redes de drenagem e esgoto urbanos

**Autor:** Neyton Luiz Dalle Molle (TBN2NET) — MESMO do SOLIDOS!

---

## 🏗️ ESTRUTURA DO C3DRENESG4

```
C3DRENESG4.bundle/
├── PackageContents.xml
├── Contents/
│   ├── C3DRENESG4.exe          ← Executável principal
│   ├── C3DRENESG4_2014.dll     ← DLL Civil 3D 2014-2017
│   ├── C3DRENESG4_2018.dll     ← DLL Civil 3D 2018-2022
│   ├── C3DRENESG.cuix          ← Ribbon UI
│   ├── C3DRENESG.chm           ← Help compilado
│   ├── help.html               ← Help HTML
│   ├── tbn2net.exe             ← TBN2NET launcher
│   ├── tbn2net.ini             ← Config TBN2NET
│   ├── EQUACOES DE CHUVA.INI   ← Equações de chuva (Brasil)
│   ├── SECOES DE SARJETAS.INI  ← Seções de sarjetas
│   ├── dwg/                    ← DWGs de exemplo
│   ├── pipes catalog/          ← Catálogo de tubos e estruturas
│   │   ├── metric pipes/       ← Tubos (PVC, PEAD, Concreto)
│   │   ├── metric structures/  ← Estruturas (PVs, Caixas)
│   │   └── Aecc Shared Content/← Catálogo compartilhado
│   └── Resources/
│       ├── C3drenrsg.ico       ← Ícone
│       └── *.png               ← Ícones de comandos
```

---

## 📄 PACKAGECONTENTS.XML

### **Estrutura (LIÇÃO IMPORTANTE):**

```xml
<ApplicationPackage 
    SchemaVersion="1.0" 
    Name="C3DRENESG" 
    Description="Urban Drain and Sewer Calculation"
    ProductCode="{GUID}"
    UpgradeCode="{GUID}"
    Author="Neyton Luiz Dalle Molle"
    AppVersion="9125.0.0">
    
  <CompanyDetails 
      Name="TBN2NET" 
      Email="neyton@tbn2net.com" 
      Url="https://tbn2net.com/C3DRENESG4" 
      Phone="+55 98 99995 3538" />
  
  <!-- 1. Múltiplas versões do Civil 3D -->
  <Components Description="Civil 3D 2014 to 2017">
    <RuntimeRequirements OS="Win32|Win64" Platform="Civil3D" 
                         SeriesMin="R19.1" SeriesMax="R21.0" />
    <ComponentEntry 
        AppName="C3DRENESG4" 
        ModuleName="./Contents/C3DRENESG4_2014.DLL" 
        LoadOnAutoCADStartup="True">
      <Commands>
        <Command Global="C3DCalc" />
        <Command Global="CALIN" />
        <!-- 14 comandos registrados -->
      </Commands>
    </ComponentEntry>
  </Components>
  
  <!-- 2. Versões mais recentes -->
  <Components Description="Civil 3D 2018 to 2022">
    <RuntimeRequirements OS="Win32|Win64" Platform="Civil3D" 
                         SeriesMin="R22.0" SeriesMax="R24.1" />
    <ComponentEntry 
        ModuleName="./Contents/C3DRENESG4_2018.DLL" 
        LoadOnAutoCADStartup="True">
      <Commands>
        <Command Global="C3DCalc" />
        <!-- 17 comandos registrados -->
      </Commands>
    </ComponentEntry>
  </Components>
  
  <!-- 3. Ribbon CUIX separado -->
  <Components Description="Ribbon CUIx">
    <RuntimeRequirements OS="Win32|Win64" Platform="Civil3D" 
                         SeriesMin="R18.2" SeriesMax="R24.1" />
    <ComponentEntry 
        ModuleName="./Contents/C3DRENESG.cuix" 
        LoadOnAppearance="False" 
        LoadOnAutoCADStartup="True" />
  </Components>
</ApplicationPackage>
```

---

## 🎯 COMANDOS REGISTRADOS

### **Principais comandos:**

| Comando | Descrição | Similar no ConstruData |
|---------|-----------|------------------------|
| `C3DCalc` | Calcular rede | `CONSTRUDATA_CALC` |
| `CALIN` | Inicializar cálculo | `CONSTRUDATA_INIT` |
| `CAPAGASARJ` | Pagar sarjeta | - |
| `CAREA` | Calcular área | - |
| `CdrawParts` | Desenhar peças | `CONSTRUDATA_DRAW` |
| `Clist` | Listar elementos | `CONSTRUDATA_LIST` |
| `Cnum` | Numerar PVs | `CONSTRUDATA_NUM` |
| `Coffset` | Offset de tubos | - |
| `Crecon` | Reconectar | `CONSTRUDATA_RECONNECT` |
| `Creset` | Resetar | - |
| `Cresumo` | Resumo | `CONSTRUDATA_SUMMARY` |
| `CEditRules` | Editar regras | `CONSTRUDATA_RULES` |
| `CEditSecaoSarj` | Editar seção sarjeta | - |

---

## 📦 CATÁLOGO DE PEÇAS (PIPE CATALOG)

### **Estrutura do catálogo:**

```
pipes catalog/
├── metric pipes/              ← Tubos
│   ├── PVC/                   ← Tubo PVC
│   │   ├── PVC.dwg            ← Bloco CAD
│   │   ├── PVC.xml            ← Definições
│   │   └── PVC.bmp            ← Ícone
│   ├── PEAD/                  ← Tubo PEAD
│   ├── ADS/                   ← Tubo corrugado
│   ├── Galeria_Circular/      ← Galeria circular
│   └── Galeria_Retangular/    ← Galeria retangular
│
└── metric structures/         ← Estruturas (PVs)
    ├── PV_Redondo/            ← PV circular
    ├── PV_Retangular/         ← PV retangular
    ├── Caixa_de_Inspecao/     ← Caixa de inspeção
    ├── Caixa_de_passagem/     ← Caixa de passagem
    ├── Terminal_de_inspecao/  ← Terminal
    └── Alas DER 1989/         ← Alas (DER 1989)
```

### **Arquivo XML de definição (exemplo):**

```xml
<!-- PVC.xml -->
<PartDefinition>
  <Name>PVC</Name>
  <Description>Tubo PVC para esgoto</Description>
  <Material>PVC</Material>
  <Roughness>0.013</Roughness>  <!-- Manning n -->
  <Diameters>
    <Diameter>100</Diameter>
    <Diameter>150</Diameter>
    <Diameter>200</Diameter>
    <Diameter>250</Diameter>
    <Diameter>300</Diameter>
  </Diameters>
  <Pressure>6.0</Pressure>  <!-- kPa -->
</PartDefinition>
```

---

## 📐 ARQUIVOS DE CONFIGURAÇÃO

### **EQUACOES DE CHUVA.INI:**

```ini
[Equacoes]
; Equações de chuva para Brasil
; Formato: a, b, c, d (coeficientes)

[SaoPaulo]
a=1234.5
b=0.5
c=10
d=0.7

[RioDeJaneiro]
a=987.6
b=0.4
c=15
d=0.6
```

### **SECOES DE SARJETAS.INI:**

```ini
[Sarjetas]
; Seções transversais de sarjetas

[Trapezoidal]
Base=0.30
Altura=0.15
Talude=1.5

[Retangular]
Base=0.40
Altura=0.20
```

---

## 🎨 RIBBON UI (C3DRENESG.cuix)

### **Layout:**

```
┌──────────────────────────────────────────────────────┐
│  C3DRENESG - Drenagem e Esgoto                       │
├──────────────────────────────────────────────────────┤
│  [💧] [📐] [📊] [⚙️] [❓]                            │
│  Calc  Desenhar  Relatórios  Config  Ajuda           │
└──────────────────────────────────────────────────────┘

Painel Calc:
┌──────────────────────────────────────────┐
│  [🧮]        [▶️]        [📋]            │
│  Calcular    Validar   Resumo           │
└──────────────────────────────────────────┘

Painel Desenhar:
┌──────────────────────────────────────────┐
│  [✏️]        [🔗]        [📍]            │
│  Desenhar    Conectar  Numerar          │
└──────────────────────────────────────────┘
```

---

## 💡 LIÇÕES APRENDIDAS

### **1. Múltiplas DLLs por versão:**

```
✅ C3DRENESG4_2014.dll  → Civil 3D 2014-2017
✅ C3DRENESG4_2018.dll  → Civil 3D 2018-2022

✅ Nosso ConstruData:
   ConstruData_2020.dll → Civil 3D 2020-2024
   ConstruData_2025.dll → Civil 3D 2025+
```

### **2. Catálogo de peças personalizável:**

```
✅ Tubos: PVC, PEAD, Concreto
✅ Estruturas: PVs, Caixas, Terminais
✅ Normas brasileiras: DER 1989, DNIT 2010

✅ Nosso ConstruData:
   Criar catálogo SABESP
   - Tubo PVC (DN 100-400)
   - PV de concreto (D=1.20m)
   - Normas SABESP
```

### **3. Arquivos INI para configurações:**

```
✅ EQUACOES DE CHUVA.INI
✅ SECOES DE SARJETAS.INI

✅ Nosso ConstruData:
   - PARAMETROS_PROSANE.INI
   - MANNING_COEFFICIENTS.INI
   - SINAPI_PRICES.INI
```

### **4. Comandos específicos:**

```
✅ 17 comandos registrados
✅ Cada comando faz UMA função específica
✅ Nomes curtos e descritivos

✅ Nosso ConstruData:
   CONSTRUDATA (principal)
   CONSTRUDATA_BATCH (lote)
   CONSTRUDATA_QA (qualidade)
   CONSTRUDATA_SQLITE (banco)
```

### **5. Help em HTML:**

```
✅ help.html (HTML simples)
✅ C3DRENESG.chm (Help compilado)

✅ Nosso ConstruData:
   help_PT.html
   help_EN.html (futuro)
```

---

## 📊 COMPARAÇÃO: C3DRENESG4 vs CONSTRUDATA

| Recurso | C3DRENESG4 | ConstruData |
|---------|------------|-------------|
| **Plugin AutoCAD** | ✅ DLL nativa | ⏳ Em desenvolvimento |
| **Comandos** | 17 comandos | 3 planejados |
| **Catálogo peças** | ✅ PVC, PEAD, Concreto | ⏳ Planejado |
| **Equações chuva** | ✅ INI | ❌ Não tem |
| **Ribbon UI** | ✅ CUIX | ⏳ Planejado |
| **Help** | ✅ HTML + CHM | ❌ Não tem |
| **Python** | ❌ Não usa | ✅ Python puro |
| **SQLite** | ❌ Não tem | ✅ Implementado |
| **Dashboard HTML** | ❌ Não tem | ✅ Leaflet |
| **Batch** | ❌ Não tem | ✅ Implementado |

---

## 🎯 O QUE ADOTAR PARA O CONSTRUDATA

### **PRIORIDADE ALTA:**

1. **Criar catálogo de peças SABESP**
   ```
   ConstruData.bundle/Contents/pipes catalog/
   ├── metric pipes/
   │   ├── PVC_SABESP/
   │   ├── PEAD_SABESP/
   │   └── CONCRETO_SABESP/
   └── metric structures/
       ├── PV_Redondo_SABESP/
       ├── PV_Retangular_SABESP/
       └── Caixa_Inspecao_SABESP/
   ```

2. **Arquivos de configuração INI**
   ```
   PARAMETROS_PROSANE.INI
   MANNING_COEFFICIENTS.INI
   SINAPI_PRICES.INI
   ```

3. **Comandos específicos**
   ```
   CONSTRUDATA_CALC     → Calcular hidráulica
   CONSTRUDATA_DRAW     → Desenhar rede
   CONSTRUDATA_LIST     → Listar elementos
   CONSTRUDATA_NUM      → Numerar PVs
   CONSTRUDATA_RULES    → Regras de validação
   ```

### **PRIORIDADE MÉDIA:**

4. **Ribbon UI mais elaborada**
   - Mais painéis
   - Mais ícones
   - Separar por função

5. **Help compilado (CHM)**
   - Usar HTML Help Workshop
   - Criar índice remissivo

### **PRIORIDADE BAIXA:**

6. **Equações de chuva**
   - Já temos parâmetros no código
   - Pode ser futuro

---

## 📁 ESTRUTURA FINAL RECOMENDADA

```
ConstruData.bundle/
├── PackageContents.xml          ← Atualizado
├── Contents/
│   ├── dotnet_8/
│   │   └── ConstruData.dll      ← DLL C#
│   ├── Resources/
│   │   ├── ConstruData.cuix     ← Ribbon
│   │   └── *.ico, *.png         ← Ícones
│   ├── pipes catalog/           ← NOVO!
│   │   ├── metric pipes/
│   │   │   ├── PVC_SABESP/
│   │   │   └── PEAD_SABESP/
│   │   └── metric structures/
│   │       └── PV_SABESP/
│   ├── config/                  ← NOVO!
│   │   ├── PARAMETROS.INI
│   │   ├── MANNING.INI
│   │   └── SINAPI.INI
│   ├── Support/
│   │   └── templates/
│   └── help_PT.html
└── help_EN.html
```

---

## ✅ CHECKLIST ATUALIZADO

### **O que já temos:**
- [x] Classes Python (PV, Trecho, Rede)
- [x] Banco SQLite
- [x] PackageContents.xml
- [x] Testes passando

### **O que adicionar (inspirado no C3DRENESG4):**
- [ ] Catálogo de peças SABESP
- [ ] Arquivos INI de configuração
- [ ] Mais comandos (CALC, DRAW, LIST, NUM, RULES)
- [ ] Ribbon UI mais elaborada
- [ ] Help HTML + CHM

### **O que já é melhor que C3DRENESG4:**
- [x] Python (mais flexível que C# puro)
- [x] SQLite (C3DRENESG4 não tem)
- [x] Dashboard HTML Leaflet
- [x] Batch processing
- [x] Validação NetworkX

---

## 🎓 CONCLUSÃO

**C3DRENESG4 é um plugin MADURO:**
- ✅ 17 comandos específicos
- ✅ Catálogo de peças completo
- ✅ Configurações em INI
- ✅ Ribbon UI elaborada
- ✅ Help compilado

**ConstruData pode ser MELHOR:**
- ✅ Python + C# (híbrido)
- ✅ SQLite embutido
- ✅ Dashboard HTML
- ✅ Batch processing
- ✅ Validação automática

**Próximos passos:**
1. Criar catálogo SABESP
2. Criar arquivos INI
3. Adicionar mais comandos
4. Melhorar Ribbon UI
5. Criar help HTML

---

*Documento criado em 20/03/2026 — ConstruData SABESP v5.1.0*
