# 📊 ONDE AS PLANILHAS SÃO SALVAS?

## Contrato 11481051 · FCN Construções · SLNR Santos

---

## ✅ RESPOSTA RÁPIDA:

### **Analytics ML (XGBoost):**
```
C:\Users\felip\Downloads\NOVA NS Versao 5\analiticos\
├── ANALYTICS_SLNR.xlsx      ← PLANILHA AQUI!
├── ANALYTICS_SLNR.json
└── graficos\
    ├── 01_real_vs_predito.png
    ├── 02_violin_nucleos.png
    ├── 03_feature_importance.png
    └── 04_tendencia_semanal.png
```

### **SLNR Mestre Unificado:**
```
C:\Users\felip\Downloads\NOVA NS Versao 5\saida_hydronetwork\slnr_mestre\
├── SLNR_MESTRE_UNIFICADO_ML.xlsx   ← PLANILHA AQUI!
├── SLNR_ML_RESULTADOS.json
└── graficos_ml\
    ├── 01_feature_importance.png
    ├── 02_cenarios.png
    └── 03_heatmap_nucleos.png
```

---

## 🚀 COMO GERAR AS PLANILHAS:

### **Opção 1: Pela Interface Gráfica (GUI)**

1. **Abra a plataforma:**
   ```bash
   cd "C:\Users\felip\Downloads\NOVA NS Versao 5"
   python construdata_gui.py
   ```
   **OU** clique duplo em `ABRIR_CONSTRUDATA.bat`

2. **Para Analytics ML:**
   - Vá na aba **"IA"**
   - Seção **"ANALYTICS ML"**
   - Clique em **"🚀 EXECUTAR ANALYTICS"**
   - Aguarde (~2-3 minutos)
   - Clique em **"📄 EXPORTAR XLSX"** para abrir
   - Clique em **"📂 ABRIR PASTA"** para ver arquivos

3. **Para SLNR Mestre:**
   - Vá na aba **"IA"**
   - Seção **"SLNR MESTRE UNIFICADO"**
   - Clique em **"📊 GERAR SLNR ML"**
   - Aguarde (~3-5 minutos)
   - Clique em **"📄 ABRIR PLANILHA"** para abrir

---

### **Opção 2: Por Linha de Comando**

#### **Analytics ML:**
```bash
cd "C:\Users\felip\Downloads\NOVA NS Versao 5"
python construdata_analytics.py --output analiticos
```

**OU** clique duplo em:
```
EXECUTAR_ANALYTICS.bat
```

#### **SLNR Mestre:**
```bash
cd "C:\Users\felip\Downloads\NOVA NS Versao 5"
python slnr_mestre_ml.py
```

---

## 📁 ESTRUTURA COMPLETA DE ARQUIVOS:

```
NOVA NS Versao 5/
├── 📄 ABRIR_CONSTRUDATA.bat      ← Inicia plataforma
├── 📄 EXECUTAR_ANALYTICS.bat     ← Analytics ML direto
├── 📄 construdata_gui.py         # Interface gráfica
├── 📄 construdata_analytics.py   # Analytics ML
├── 📄 slnr_mestre_ml.py          # SLNR Mestre
│
├── 📂 dados_contrato/
│   ├── EXECUCAO_DIARIA.json      # Dados históricos
│   └── ML_DATA.json
│
├── 📂 analiticos/                 ← Analytics ML (XGBoost)
│   ├── ANALYTICS_SLNR.xlsx       ✅ PLANILHA
│   ├── ANALYTICS_SLNR.json
│   └── graficos/
│       ├── 01_real_vs_predito.png
│       ├── 02_violin_nucleos.png
│       ├── 03_feature_importance.png
│       └── 04_tendencia_semanal.png
│
├── 📂 saida_hydronetwork/
│   └── slnr_mestre/              ← SLNR Mestre Unificado
│       ├── SLNR_MESTRE_UNIFICADO_ML.xlsx  ✅ PLANILHA
│       ├── SLNR_ML_RESULTADOS.json
│       └── graficos_ml/
│           ├── 01_feature_importance.png
│           ├── 02_cenarios.png
│           └── 03_heatmap_nucleos.png
│
└── 📂 analiticos_teste/           ← Testes
    ├── ANALYTICS_SLNR.xlsx
    └── graficos/
```

---

## ❓ PROBLEMAS COMUNS:

### **"Não encontro a planilha!"**

**Solução 1:** Verifique se executou o módulo correto
- Analytics ML → pasta `analiticos/`
- SLNR Mestre → pasta `saida_hydronetwork/slnr_mestre/`

**Solução 2:** Execute pelo GUI
- GUI mostra mensagens de erro se algo falhar
- GUI cria pastas automaticamente

**Solução 3:** Verifique permissões
- Pastas devem existir
- Deve ter permissão de escrita

---

### **"Só gera JSON, não gera XLSX!"**

**Possíveis causas:**

1. **openpyxl não instalado**
   ```bash
   pip install openpyxl
   ```

2. **Erro durante geração do XLSX**
   - Veja console/mensagens de erro
   - Execute pelo GUI para ver logs

3. **Caminho de saída incorreto**
   - Verifique `saida_var` no GUI
   - Use caminho absoluto

**Solução rápida:**
```bash
cd "C:\Users\felip\Downloads\NOVA NS Versao 5"
python construdata_analytics.py --output analiticos
```

Isso gera TUDO (XLSX + JSON + gráficos) na pasta `analiticos/`

---

## 🔍 COMO VERIFICAR SE FOI GERADO:

### **Windows Explorer:**

1. Abra:
   ```
   C:\Users\felip\Downloads\NOVA NS Versao 5
   ```

2. Procure por:
   - `analiticos\` (Analytics ML)
   - `saida_hydronetwork\slnr_mestre\` (SLNR Mestre)

3. Dentro das pastas, veja:
   - `ANALYTICS_SLNR.xlsx` (26 KB)
   - `SLNR_MESTRE_UNIFICADO_ML.xlsx` (1-2 MB)

### **Linha de Comando:**

```cmd
cd "C:\Users\felip\Downloads\NOVA NS Versao 5"
dir analiticos\*.xlsx
dir saida_hydronetwork\slnr_mestre\*.xlsx
```

---

## 📊 CONTEÚDO DAS PLANILHAS:

### **ANALYTICS_SLNR.xlsx:**

| Aba | Conteúdo |
|-----|----------|
| MODELO | Métricas XGBoost, Feature Importance |
| PREDICAO | Real vs Predito por dia/núcleo |
| CENARIOS | 5 cenários de aceleração |
| PIPELINE | 11 etapas, gargalos, PPC |
| NUCLEOS | Resumo estatístico por núcleo |

### **SLNR_MESTRE_UNIFICADO_ML.xlsx:**

| Aba | Conteúdo |
|-----|----------|
| N07_NOROESTE a SD_PANTANAL_BAIXO | 12 núcleos com fórmulas |
| NOTAS_SERVICO_PIS_PVS | 29 NSs (PIs + PVs) |
| ML_RESULTADOS | Métricas do modelo |
| TENDENCIAS | Cenários de aceleração |
| DADOS, CUSTOS, CURVA_S, etc. | Abas gerais |

---

## 💡 DICAS:

1. **Sempre execute pelo GUI** se tiver dúvidas
   - GUI mostra progresso
   - GUI mostra erros

2. **Use EXECUTAR_ANALYTICS.bat** para Analytics ML
   - Mais rápido
   - Gera tudo automaticamente

3. **Verifique console** se algo der errado
   - Mensagens de erro aparecem lá
   - Logs detalhados

4. **Não delete `dados_contrato/`**
   - São os dados históricos
   - Necessários para ML

---

## ✅ CHECKLIST DE GERAÇÃO:

### **Analytics ML:**
- [ ] `construdata_analytics.py` existe
- [ ] `dados_contrato/EXECUCAO_DIARIA.json` existe
- [ ] openpyxl instalado
- [ ] Executou script ou GUI
- [ ] Pasta `analiticos/` criada
- [ ] `ANALYTICS_SLNR.xlsx` gerado (~26 KB)

### **SLNR Mestre:**
- [ ] `slnr_mestre_ml.py` existe
- [ ] `dados_contrato/` existe
- [ ] openpyxl instalado
- [ ] Executou script ou GUI
- [ ] Pasta `saida_hydronetwork/slnr_mestre/` criada
- [ ] `SLNR_MESTRE_UNIFICADO_ML.xlsx` gerado (~1-2 MB)

---

## 📞 SUPORTE:

Se ainda tiver problemas:

1. **Verifique logs** no console
2. **Execute pelo GUI** para ver mensagens
3. **Teste com EXECUTAR_ANALYTICS.bat**
4. **Verifique se Python e dependências estão OK**

```bash
python -c "import pandas, numpy, sklearn, xgboost, openpyxl; print('OK')"
```

---

**As planilhas são salvas em `analiticos/` e `saida_hydronetwork/slnr_mestre/`!** 🎉
