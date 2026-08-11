# 🚀 COMO USAR — CONSTRUDATA APLICATIVO GENÉRICO

**Atualizado:** 20/03/2026 22:45

---

## ⚡ AGORA É UM APLICATIVO GENÉRICO!

**NÃO limitado a Vila Criadores!**  
Pode processar **QUALQUER DXF** do ProSaneamento.

---

## 🎯 FORMAS DE USAR:

### **Opção 1: Menu Principal (RECOMENDADO)**
```
Duplo clique em: CONSTRUDATA_MENU.bat
```
**Menu com 6 opções:**
1. **Selecionar da lista** → DXFs pré-configurados
2. **Selecionar da pasta** → Navega pelas pastas
3. **Batch** → Processa todos os núcleos
4. **DXF específico** → Digita caminho manual
5. **Testar** → Testa classes/SQLite
6. **Documentação** → Abre arquivos .md

---

### **Opção 2: Lista de DXFs Prontos**
```
Duplo clique em: PROCESSAR_DXF.bat
```
**DXFs disponíveis:**
1. CRIADORES_ESGOTO.dxf (Vila Criadores)
2. TETEU_ESGOTO.dxf (Morro do Teteu)
3. PANTANAL_ESGOTO.dxf (Pantanal Baixo)
4. JOAO_CARLOS_ESGOTO.dxf (João Carlos)
5. ISRAEL_ESGOTO.dxf (Vila Israel)
6. Projeto Criadores- ESGOTOrev12elevatoria.dxf
7. **Digitar caminho personalizado** ← QUALQUER DXF!

---

### **Opção 3: Navegar por Pastas**
```
Duplo clique em: SELECIONAR_DXF.bat
```
**Pastas disponíveis:**
1. VILA DOS CRIADORES
2. MORRO DO TETEU
3. PANTANAL BAIXO
4. JOAO CARLOS
5. VILA ISRAEL
6. SAO MANOEL
7. **Digitar caminho personalizado**

---

## 📋 TODOS ARQUIVOS .bat:

| Arquivo | O que faz |
|---------|-----------|
| **CONSTRUDATA_MENU.bat** | Menu principal com tudo |
| **PROCESSAR_DXF.bat** | Seleciona de lista pré-configurada |
| **SELECIONAR_DXF.bat** | Navega por pastas |
| **ABRIR_CRIADORES.bat** | Rápido para Vila Criadores |
| **ABRIR_BATCH.bat** | Processa todos núcleos |
| **ABRIR_DOCUMENTACAO.bat** | Abre todos .md |

---

## 🖱️ PASSO A PASSO (EXEMPLO):

### **Processar Morro do Teteu:**

**Método 1 (Fácil):**
```
1. CONSTRUDATA_MENU.bat
2. Digite: 1 (Processar DXF)
3. Digite: 2 (TETEU_ESGOTO.dxf)
4. Enter
5. Aguarde
```

**Método 2 (Navegar):**
```
1. CONSTRUDATA_MENU.bat
2. Digite: 2 (Selecionar da pasta)
3. Digite: 2 (MORRO DO TETEU)
4. Digite: 1 (TETEU_ESGOTO.dxf)
5. Enter
```

**Método 3 (Manual):**
```
1. CONSTRUDATA_MENU.bat
2. Digite: 4 (DXF específico)
3. Digite caminho: C:\...\TETEU_ESGOTO.dxf
4. Digite nucleo: Morro do Teteu
5. Enter
```

---

## 🎯 RECOMENDAÇÃO:

**Primeiro uso:**
```
1. CONSTRUDATA_MENU.bat
2. Opção 1 (Processar DXF da lista)
3. Escolha seu DXF (1-6)
4. Aguarde processamento
```

**Já conhece os DXFs:**
```
1. PROCESSAR_DXF.bat
2. Escolha DXF ou digite caminho (opção 7)
3. Aguarde
```

**Quer navegar:**
```
1. SELECIONAR_DXF.bat
2. Escolha pasta
3. Escolha DXF
4. Aguarde
```

---

## 📁 ONDE ESTÃO OS DXFs:

**Pasta padrão:**
```
C:\Users\felip\Downloads\PROJETOS DE AGUA E ESGOTO - DWG E DXF 2018\MAPAS AGUA E ESGOTO PARA DXF\
```

**Sub-pastas:**
```
├── VILA DOS CRIADORES/
│   ├── CRIADORES_ESGOTO.dxf
│   └── CRIADORES_AGUA.dxf
├── MORRO DO TETEU/
│   ├── TETEU_ESGOTO.dxf
│   └── TETEU_AGUA.dxf
├── PANTANAL BAIXO/
│   ├── PANTANAL_ESGOTO.dxf
│   └── PANTANAL_AGUA.dxf
├── JOAO CARLOS/
│   ├── JOAO_CARLOS_ESGOTO.dxf
│   └── JOAO_CARLOS_AGUA.dxf
├── VILA ISRAEL/
│   ├── ISRAEL_ESGOTO.dxf
│   └── ISRAEL_AGUA.dxf
└── SAO MANOEL/
    ├── SAO_MANOEL_ESGOTO.dxf
    └── SAO_MANOEL_AGUA.dxf
```

---

## 📊 RESULTADOS:

**Cada processamento gera:**
```
SAIDA_BIM_SABESP/<NUCLEO>/
├── 01_NS_CAMPO/
│   └── NS_XXX_PV_AO_PV/
│       ├── NS_XXX_A4.pdf
│       ├── NS_XXX_DESENHO.pdf
│       ├── NS_XXX_OSE.xlsx
│       ├── NS_XXX_DADOS.json
│       └── NS_XXX_DASHBOARD.html
├── 04_HTML/
│   ├── REDE_GERAL.html
│   └── DASHBOARD_QUALIDADE.html
├── 05_GIS/
│   ├── rede_definida.json
│   └── dynamo_civil3d.json
└── 06_EXCEL/
    └── CUSTOS_POR_TRECHO.xlsx
```

---

## ⚠️ PROBLEMAS COMUNS:

### **"Python não encontrado"**
```
Solução: python --version
Se erro: instale Python 3.14+
```

### **"DXF não encontrado"**
```
Solução: Verifique caminho
Use aspas se tiver espaços
```

### **"HTML não abre"**
```
Solução: Vá em SAIDA_BIM_SABESP\<NUCLEO>\04_HTML\
Duplo clique em REDE_GERAL.html
```

---

## 🎯 DICA RÁPIDA:

**Só quer processar um DXF rápido?**
```
1. PROCESSAR_DXF.bat
2. Escolha DXF (1-6) ou digite caminho (7)
3. Aguarde
4. HTML abre automaticamente
```

**Quer escolher com calma?**
```
1. CONSTRUDATA_MENU.bat
2. Opção 2 (Selecionar da pasta)
3. Navega até achar DXF
4. Processa
```

---

*Atualizado: 20/03/2026 22:45 — Agora é genérico!*
