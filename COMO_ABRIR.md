# 🚀 COMO ABRIR A PLATAFORMA CONSTRUDATA

## Contrato 11481051 · FCN Construções · SLNR Santos

---

## ✅ MÉTODO 1: CLIQUE DUPLO (Mais Fácil)

### **Passo 1:** Abra a pasta
```
C:\Users\felip\Downloads\NOVA NS Versao 5
```

### **Passo 2:** Dê clique duplo em:
```
📄 ABRIR_CONSTRUDATA.bat
```

### **Passo 3:** Aguarde a interface abrir!

---

## ✅ MÉTODO 2: LINHA DE COMANDO

### **Passo 1:** Abra o Prompt de Comando
Pressione `Win + R`, digite `cmd` e pressione Enter

### **Passo 2:** Navegue até a pasta
```cmd
cd "C:\Users\felip\Downloads\NOVA NS Versao 5"
```

### **Passo 3:** Execute a plataforma
```cmd
python construdata_gui.py
```

---

## 📋 O QUE VOCÊ VERÁ:

### **Interface Principal:**

```
┌────────────────────────────────────────────────────────────┐
│  CONSTRUDATA          HydroNetwork v7.0                    │
│  FCN Construções e Saneamento · Contrato 11481051          │
├────────────────────────────────────────────────────────────┤
│  [Processar] [Mapa] [Rede] [Hidráulica] [Trechos]         │
│  [Custos] [BIM] [Lean] [Perdas] [IA] ← VAQUI!             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ASSISTENTE IA — 4 LLMs Gratuitos + Analytics ML           │
│                                                             │
│  ┌─ SEÇÃO ANALYTICS ML ──────────────────────────────┐    │
│  │ Analytics: OK                                      │    │
│  │ 🚀 EXECUTAR ANALYTICS  📊 VER GRÁFICOS            │    │
│  │ 📈 CENÁRIOS  📄 EXPORTAR XLSX  📂 ABRIR PASTA     │    │
│  │ R² Test: 0.1861 | MAE: 3.134 | Algoritmo: XGBoost │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─ SEÇÃO SLNR MESTRE UNIFICADO ─────────────────────┐    │
│  │ SLNR Mestre: OK                                    │    │
│  │ 📊 GERAR SLNR ML  📄 ABRIR PLANILHA  📂 ABRIR PASTA│    │
│  │ Núcleos: 12 | Fórmulas: 115+ | Cenários: 5        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 COMO USAR CADA SEÇÃO:

### **1. ANALYTICS ML (XGBoost + GridSearchCV)**

**Para que serve:**
- Prever produção de ligações (LA + LE)
- Gerar cenários de aceleração (+10%, +20%, +30%)
- Feature importance (quais variáveis mais impactam)

**Como usar:**
1. Clique em **🚀 EXECUTAR ANALYTICS**
2. Aguarde o treinamento do modelo (~2-3 minutos)
3. Veja os resultados nos labels:
   - **R² Test**: Qualidade do modelo (0.1861)
   - **MAE**: Erro médio (3.134 ligações/dia)
4. Use os botões:
   - **📊 VER GRÁFICOS**: Abre pasta com 4 gráficos PNG
   - **📈 CENÁRIOS**: Mostra tabela com 5 cenários
   - **📄 EXPORTAR XLSX**: Abre Excel com relatório completo
   - **📂 ABRIR PASTA**: Abre pasta de saída

---

### **2. SLNR MESTRE UNIFICADO (12 Núcleos + Fórmulas)**

**Para que serve:**
- Gerar planilha completa com 12 núcleos
- Cada núcleo tem 115+ fórmulas Excel
- Formato idêntico ao modelo SLNR_MESTRE_UNIFICADO_1.xlsx

**Como usar:**
1. Clique em **📊 GERAR SLNR ML**
2. Aguarde o processamento (~3-5 minutos)
3. O sistema vai:
   - Treinar ML (XGBoost)
   - Atualizar 12 abas de núcleos com fórmulas
   - Gerar 5 cenários
   - Criar 3 gráficos Seaborn
4. Use os botões:
   - **📄 ABRIR PLANILHA**: Abre Excel gerado
   - **📂 ABRIR PASTA**: Abre pasta de saída

**Abas geradas:**
- N07_NOROESTE, N08_V_PROGRESSO, N09_Z_LESTE
- N10_CONJUNTO, N11_ALAGADO, N12_MONTANHOSO
- SD_JOAO_CARLOS, SD_SAO_MANOEL, SD_VILA_ISRAEL
- SD_MORRO_TETEU, SD_VILA_CRIADORES, SD_PANTANAL_BAIXO
- ML_RESULTADOS, TENDENCIAS, DASHBOARD, etc.

---

## 📁 ARQUIVOS NA PASTA:

```
NOVA NS Versao 5/
├── 📄 ABRIR_CONSTRUDATA.bat      ← CLIQUE AQUI PARA INICIAR
├── 📄 ABRIR_SLNR_PLANILHA.bat    ← Abre planilha SLNR
├── 📄 construdata_gui.py         # Programa principal
├── 📄 slnr_mestre_ml.py          # Módulo SLNR
├── 📄 construdata_analytics.py   # Módulo Analytics
├── dados_contrato/
│   ├── EXECUCAO_DIARIA.json      # Dados históricos
│   └── SLNR_MESTRE_MODELO.xlsx   # Modelo
└── saida_hydronetwork/
    └── slnr_mestre/              # Planilhas geradas
        ├── SLNR_MESTRE_UNIFICADO_ML.xlsx
        └── graficos_ml/
```

---

## ⚙️ PRÉ-REQUISITOS:

### **Python 3.8+ instalado**
Verifique:
```cmd
python --version
```

### **Dependências instaladas:**
```cmd
pip install pandas numpy scikit-learn xgboost matplotlib seaborn openpyxl
```

### **Testar instalação:**
```cmd
cd "C:\Users\felip\Downloads\NOVA NS Versao 5"
python -c "import pandas, numpy, sklearn, xgboost, matplotlib, seaborn, openpyxl; print('OK - Tudo instalado!')"
```

---

## ❓ PROBLEMAS COMUNS:

### **"python não é reconhecido"**
- Instale Python em https://python.org
- Marque "Add Python to PATH" na instalação

### **"ModuleNotFoundError: No module named 'pandas'"**
```cmd
pip install pandas numpy scikit-learn xgboost matplotlib seaborn openpyxl
```

### **"Planilha não encontrada"**
- Execute **📊 GERAR SLNR ML** primeiro na plataforma

### **"Erro ao abrir GUI"**
- Verifique se tkinter está instalado:
```cmd
python -c "import tkinter; print('tkinter OK')"
```

---

## 🎯 FLUXO RECOMENDADO:

```
1. Clique em ABRIR_CONSTRUDATA.bat
   ↓
2. Interface abre
   ↓
3. Vá na aba "IA"
   ↓
4. Execute "📊 GERAR SLNR ML"
   ↓
5. Aguarde (~3-5 min)
   ↓
6. Clique em "📄 ABRIR PLANILHA"
   ↓
7. Veja as 50+ abas com fórmulas!
```

---

## 📞 SUPORTE:

Se tiver problemas:

1. **Verifique Python:**
   ```cmd
   python --version
   ```

2. **Teste dependências:**
   ```cmd
   python -c "import pandas; print('OK')"
   ```

3. **Valide sintaxe:**
   ```cmd
   cd "C:\Users\felip\Downloads\NOVA NS Versao 5"
   python -m py_compile construdata_gui.py
   ```

4. **Veja logs:**
   - A própria GUI mostra mensagens de erro
   - Console mostra detalhes

---

## ✅ CHECKLIST DE ABERTURA:

- [ ] Python 3.8+ instalado
- [ ] Dependências instaladas (pandas, numpy, etc.)
- [ ] Pasta `NOVA NS Versao 5` existe
- [ ] Arquivo `construdata_gui.py` existe
- [ ] Arquivo `ABRIR_CONSTRUDATA.bat` existe
- [ ] Clique duplo em `ABRIR_CONSTRUDATA.bat`
- [ ] Interface abre com abas
- [ ] Aba "IA" está visível
- [ ] Seções "ANALYTICS ML" e "SLNR MESTRE" aparecem

---

**ConstruData HydroNetwork v7.0**  
*Março 2026*
