# 📋 PLANEJAMENTO: LEITURA DE DWG BIM SEM AUTO CAD

**Data:** 25/03/2026  
**Problema:** Ler dados de DWG do Civil 3D Pipe Network **SEM USAR AUTO CAD**

---

## 1️⃣ ENTENDIMENTO DO PROBLEMA

### **O QUE TEMOS:**

| Arquivo | Tipo | Origem | Dados |
|---------|------|--------|-------|
| `ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA.dwg` | **DWG BIM** | Civil 3D Pipe Network | AeccDbPipe, AeccDbStructure |
| DXFs do ProSaneamento | DXF 2D | ProSaneamento | XDATA PH_DATCNX, PS_PONTOS |

### **O QUE NÃO FUNCIONA:**

| Método | Funciona? | Por quê? |
|--------|-----------|----------|
| `PS_PONTOS_IDENTIFICACAO_TXT` | ❌ | Só existe em DXF do ProSaneamento |
| XDATA `PH_DATCNX` / `PH_DATTUB` | ❌ | Só existe em DXF do ProSaneamento |
| ezdxf lendo DWG | ❌ | ezdxf só lê DXF |
| libredwg | ⚠️ | Só Linux, não lê objetos AEC |
| ODA File Converter | ⚠️ | Converte DWG→DXF, mas perde dados BIM |

### **O QUE FUNCIONA (MAS NÃO QUEREMOS USAR):**

| Método | Funciona? | Problema |
|--------|-----------|----------|
| Civil 3D COM API | ✅ | **Abre o Civil 3D** (você não quer) |
| accoreconsole | ✅ | **Abre o Civil 3D em background** (você não quer) |

---

## 2️⃣ REALIDADE DURA

### **VERDADE SOBRE DWG BIM:**

> **DWG com Civil 3D Pipe Network é um formato FECHADO da Autodesk**

Os dados BIM estão em **objetos AEC (AeccDbPipe, AeccDbStructure)** que:

1. **Não são texto** no DWG
2. **Não são XDATA** (isso é ProSaneamento)
3. **São objetos inteligentes** da API do Civil 3D
4. **Só a Autodesk tem acesso** à estrutura interna

### **OPÇÕES REAIS (SEM AUTO CAD):**

| Opção | Funciona? | Dados BIM? |
|-------|-----------|------------|
| ODA File Converter | ⚠️ Converte DWG→DXF | ❌ Perde objetos AEC |
| libredwg | ❌ Não lê AEC | ❌ |
| PythonOCC | ❌ Lê STEP/IGES | ❌ |
| Teigha | ⚠️ Paga (USD $2000+) | ✅ |

---

## 3️⃣ SOLUÇÕES POSSÍVEIS (PLANEJAMENTO)

### **OPÇÃO A: ODA File Converter + Parseamento Manual**

**Fluxo:**
```
DWG BIM → ODA → DXF → ezdxf → Parsear textos/polylines
```

**Prós:**
- ✅ Não abre Auto CAD
- ✅ Gratuito
- ✅ Automatizável

**Contras:**
- ⚠️ Perde dados BIM (objetos AEC viram texto simples)
- ⚠️ Precisa parsear textos manualmente
- ⚠️ Formato dos textos pode variar

**O que esperar do DXF convertido:**
- Textos: `PV 10`, `CT 15.5`, `CF 14.2` (não formatado como ProSaneamento)
- Polylines: Tubos como linhas 2D (sem DN, material, declividade)
- **Dados BIM originais são PERDIDOS**

---

### **OPÇÃO B: Extrair Dados de Outra Fonte**

**Pergunta chave:** 

> **Você tem os dados deste projeto BIM em outro formato?**

Opções:
1. **CSV/Excel** do projetista?
2. **Relatório** do Civil 3D?
3. **Exportação** do Civil 3D para outro formato?
4. **Dynamo script** que extraiu dados?

Se tiver **QUALQUER** fonte alternativa (CSV, XLSX, JSON), podemos usar.

---

### **OPÇÃO C: Usar Civil 3D API (Mesmo Não Querendo)**

**Fluxo:**
```
Python + win32com → Civil 3D → Extrai dados → JSON
```

**Prós:**
- ✅ **ÚNICA forma de extrair dados BIM COMPLETOS**
- ✅ Mantém CT, CF, DN, material, declividade

**Contras:**
- ❌ Requer Civil 3D instalado
- ❌ Abre o Civil 3D (você não quer)

**MAS:** Pode ser executado **UMA VEZ** para extrair dados, depois salva em JSON e usa o JSON para sempre.

---

### **OPÇÃO D: Pedir ao Projetista**

**Solicitar:**
```
"Por favor, exporte os dados da Pipe Network para CSV/Excel:
- Lista de PVs (nome, CT, CF, X, Y)
- Lista de Tubos (PV_ini, PV_fim, DN, material, ext, decl)"
```

Civil 3D permite exportar para:
- CSV
- Excel
- LandXML
- SDF

---

## 4️⃣ MEU PLANEJAMENTO RECOMENDADO

### **FASE 1: Entender o Que Realmente Temos** (30 min)

1. [ ] **Você confirma:** Tem os dados em outra fonte? (CSV, Excel, etc.)
2. [ ] **Você confirma:** Pode pedir ao projetista?
3. [ ] **Você confirma:** Precisa MESMO ser sem Auto CAD?

### **FASE 2: Se NÃO tem outra fonte** (1 hora)

**Cenário A: Topa usar Civil 3D UMA VEZ**
```
1. Rodar LER_DWG_BIM.py (extrai dados COMPLETOS)
2. Salvar em JSON
3. Usar JSON para sempre (nunca mais abre DWG)
```

**Cenário B: NÃO quer usar Civil 3D de jeito nenhum**
```
1. Instalar ODA File Converter
2. Converter DWG → DXF
3. Analisar DXF manualmente (ver o que tem)
4. Criar parser específico para este DXF
5. ACEITAR que dados BIM serão perdidos
```

### **FASE 3: Integração no Pipeline** (1 hora)

Uma vez com os dados (JSON, CSV, ou parser funcionando):

```python
# No construdata_gui.py
elif ext == ".dwg":
    # Opção 1: JSON já extraído
    if Path(dwg).with_suffix('.json').exists():
        with open(json_path) as f:
            dados = json.load(f)
        pvs, trechos = dados['pvs'], dados['trechos']
    
    # Opção 2: ODA + parser
    else:
        dxf = converter_oda(dwg)
        pvs, trechos = parser_dwg_bim(dxf)
```

---

## 5️⃣ DECISÕES NECESSÁRIAS

### **PERGUNTA 1:** 
> **Você tem os dados deste projeto BIM em CSV/Excel/JSON?**

- [ ] Sim → Qual formato?
- [ ] Não

### **PERGUNTA 2:**
> **Pode pedir ao projetista para exportar os dados?**

- [ ] Sim → Já pediu?
- [ ] Não

### **PERGUNTA 3:**
> **Topa usar Civil 3D UMA VEZ para extrair dados e salvar em JSON?**

Depois nunca mais precisa abrir o Civil 3D para este arquivo.

- [ ] Sim → Rodar `LER_DWG_BIM.py` agora
- [ ] Não → Seguir com ODA File Converter

### **PERGUNTA 4:**
> **Aceita que dados BIM (DN, material, declividade) podem ser perdidos?**

- [ ] Sim → ODA File Converter é suficiente
- [ ] Não → **PRECISA** usar Civil 3D API (única forma de manter dados)

---

## 6️⃣ MINHA RECOMENDAÇÃO HONESTA

### **SE NÃO TEM OUTRA FONTE:**

**Use o Civil 3D UMA VEZ:**

```bash
# Extrai dados completos
python LER_DWG_BIM.py "ARQUIVO.dwg"

# Resultado: ARQUIVO_BIM.json com TODOS dados
# Depois usa JSON para sempre, nunca mais abre DWG
```

**Por quê:**
- É a **ÚNICA** forma de manter dados BIM completos
- Faz uma vez, usa para sempre
- 30 minutos de trabalho vs. horas tentando alternativas que não funcionam

---

## 7️⃣ PRÓXIMO PASSO

**Aguardo suas respostas para:**

1. Tem dados em outra fonte?
2. Pode pedir ao projetista?
3. Topa usar Civil 3D uma vez?
4. Aceita perder dados BIM?

**Com as respostas, executo o plano exato.**

---

**Planejamento criado:** 25/03/2026  
**Status:** Aguardando decisões do usuário
