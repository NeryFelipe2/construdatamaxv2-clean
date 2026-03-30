# 📊 SLNR MESTRE UNIFICADO — INTEGRADO NA PLATAFORMA CONSTRUDATA

## Contrato 11481051 · DGS Engenharia · SLNR Santos

---

## ✅ INTEGRAÇÃO CONCLUÍDA!

O **SLNR Mestre Unificado** agora está integrado na plataforma **ConstruData HydroNetwork v7.0**!

---

## 🚀 COMO USAR NA PLATAFORMA

### 1. Abra a Plataforma ConstruData
```bash
cd "C:\Users\felip\Downloads\NOVA NS Versao 5"
python construdata_gui.py
```

### 2. Vá na Aba "IA"
Clique na aba **IA** no topo da interface.

### 3. Use a Seção "SLNR MESTRE UNIFICADO"

Você verá 3 botões:

| Botão | Função |
|-------|--------|
| **📊 GERAR SLNR ML** | Executa o pipeline completo |
| **📄 ABRIR PLANILHA** | Abre a planilha gerada |
| **📂 ABRIR PASTA** | Abre a pasta de saída |

---

## 📋 O QUE É GERADO:

### Planilha: `SLNR_MESTRE_UNIFICADO_ML.xlsx`

**50+ abas incluindo:**

#### 12 Abas de Núcleos (com fórmulas):
- N07_NOROESTE
- N08_V_PROGRESSO
- N09_Z_LESTE
- N10_CONJUNTO
- N11_ALAGADO
- N12_MONTANHOSO
- SD_JOAO_CARLOS
- SD_SAO_MANOEL
- SD_VILA_ISRAEL
- SD_MORRO_TETEU
- SD_VILA_CRIADORES
- SD_PANTANAL_BAIXO

**Cada aba contém:**
- Título com resumo do núcleo
- Tabela de trechos com LA, LE, LIG, EQ, PROD
- **Fórmulas Excel:**
  - `=D3+E3` (LIG = LA + LE)
  - `=SUM(I3:R3)` (EXEC = Soma meses)
  - `=MAX(0,F3-S3)` (RESTANTE)
  - `=T3*2.2*910` (CUSTO)
  - `=T3/(G3*H3*22)` (PREVISAO)
- Seção de materiais com fatores
- Totais com SOMA

#### Abas de ML:
- **ML_RESULTADOS**: Métricas do modelo XGBoost
- **TENDENCIAS**: 5 cenários de aceleração
- **METODO_ML**: Descrição do método
- **DASHBOARD**: KPIs principais

#### Abas Gerais:
- DADOS, PROJETO, CUSTOS, CURVA_S, MEDICAO_MENSAL, etc.

---

## 🤖 MACHINE LEARNING:

### Modelo Treinado:
- **Algoritmo**: XGBoost Regressor
- **GridSearchCV**: 54 combinações × 3 folds = 162 modelos
- **Features**: 11 variáveis (rolling, dia, núcleo, etc.)
- **R² Test**: ~0.1861
- **MAE**: ~3.134 ligações/dia

### 5 Cenários Gerados:
| Cenário | Produção Mensal | Conclusão | Custo Extra |
|---------|-----------------|-----------|-------------|
| Baseline | 58 lig/mês | 31/12/2050 | R$ 0 |
| +10% | 63 lig/mês | 29/09/2048 | R$ 5.000/mês |
| +20% | 69 lig/mês | 13/11/2046 | R$ 10.000/mês |
| +30% | 75 lig/mês | 12/04/2045 | R$ 15.000/mês |
| Meta | 194 lig/mês | 03/08/2033 | R$ 118.000/mês |

---

## 📁 ESTRUTURA DE ARQUIVOS:

```
NOVA NS Versao 5/
├── construdata_gui.py          # Interface principal
├── slnr_mestre_ml.py           # Módulo SLNR Mestre (NOVO!)
├── dados_contrato/
│   ├── EXECUCAO_DIARIA.json    # Dados históricos
│   ├── ML_DATA.json
│   └── SLNR_MESTRE_MODELO.xlsx # Planilha modelo (NOVA!)
└── saida_hydronetwork/
    └── slnr_mestre/            # Saída do SLNR Mestre (NOVA!)
        ├── SLNR_MESTRE_UNIFICADO_ML.xlsx
        ├── SLNR_ML_RESULTADOS.json
        └── graficos_ml/
            ├── 01_feature_importance.png
            ├── 02_cenarios.png
            └── 03_heatmap_nucleos.png
```

---

## 🎯 FLUXO DE TRABALHO:

```
1. Usuário clica em "📊 GERAR SLNR ML" na GUI
   ↓
2. Python executa slnr_mestre_ml.py
   ↓
3. Carrega dados históricos (521 dias × 6 núcleos)
   ↓
4. Treina XGBoost + GridSearchCV (162 modelos)
   ↓
5. Gera 5 cenários de aceleração
   ↓
6. Atualiza 12 abas de núcleos com FÓRMULAS Excel
   ↓
7. Gera 3 gráficos com Seaborn
   ↓
8. Exporta JSON com resultados
   ↓
9. GUI mostra: "✅ SLNR Mestre ML concluído!"
   ↓
10. Usuário clica em "📄 ABRIR PLANILHA"
```

---

## 📊 FÓRMULAS IMPLEMENTADAS:

### Em cada aba de núcleo:

**Linhas de Trechos (3-12):**
```excel
F3: =D3+E3              → LIG = LA + LE
S3: =SUM(I3:R3)         → EXEC = Soma dos meses
T3: =MAX(0,F3-S3)       → RESTANTE = LIG - EXEC
U3: =T3*2.2*910         → CUSTO = Restante × 2.2 × 910
V3: =T3/(G3*H3*22)      → PREVISAO = Restante / (EQ × PROD × 22)
```

**Linha de Total (13):**
```excel
D13: =SUM(D3:D12)       → Soma LA
E13: =SUM(E3:E12)       → Soma LE
F13: =SUM(F3:F12)       → Soma LIG
G13: =SUM(G3:G12)       → Soma EQ
I13: =SUM(I3:I12)       → Soma EXEC
...
```

**Seção Materiais (16-21):**
```excel
C16: =F13*B16           → Material = Total LIG × Fator
D16: =I13*B16           → Material Mês 1 = Mês 1 × Fator
...
```

**Total: 115+ fórmulas por aba de núcleo!**

---

## 🔗 INTEGRAÇÃO COM OUTROS MÓDULOS:

O SLNR Mestre se integra com:

| Módulo | Integração |
|--------|------------|
| **Analytics ML** | Mesmo motor XGBoost |
| **Motor de Custos** | Custo por ligação (R$ 910/m) |
| **Motor de Cronograma** | Datas de conclusão |
| **Motor Lean/LPS** | Takt time por núcleo |
| **Motor de Perdas** | UARL por DMA |

---

## 💡 DICAS DE USO:

1. **Execute semanalmente** para atualizar previsões
2. **Compare cenários** para tomar decisões
3. **Use o DASHBOARD** em reuniões executivas
4. **Heatmaps** ajudam a priorizar núcleos
5. **Fórmulas Excel** recalculam automaticamente

---

## 📞 SUPORTE:

Em caso de dúvidas:

1. Verifique se `slnr_mestre_ml.py` existe na pasta
2. Confira se `dados_contrato/EXECUCAO_DIARIA.json` existe
3. Execute `python -m py_compile slnr_mestre_ml.py` para validar
4. Veja a aba **IA** → **SLNR MESTRE UNIFICADO** na GUI

---

## 📌 DADOS TÉCNICOS:

- **Contrato**: 11481051
- **Empresa**: DGS Engenharia
- **Projeto**: SLNR Santos
- **Meta Total**: 25.383 ligações
- **Meta Mensal**: 366 ligações
- **Custo Unitário**: R$ 910/m (× BDI 1.25 = R$ 1.137,50/m)
- **Equipes**: 39 (28 ativas + 8 reforço + 3 prospecção)
- **Trabalhadores**: 350

---

## ✅ CHECKLIST DE INSTALAÇÃO:

- [x] `slnr_mestre_ml.py` copiado para `NOVA NS Versao 5/`
- [x] `SLNR_MESTRE_UNIFICADO_1.xlsx` copiado para `dados_contrato/`
- [x] Import adicionado em `construdata_gui.py`: `_slnr = _try_import("SLNR_Mestre", ...)`
- [x] Seção SLNR Mestre adicionada na aba **IA**
- [x] 3 botões: GERAR, ABRIR, PASTA
- [x] 4 labels: Núcleos, Fórmulas, Cenários, R² ML
- [x] Funções `_cmd_slnr_ml`, `_cmd_abrir_slnr`, `_cmd_abrir_pasta_slnr`
- [x] Sintaxe validada com `python -m py_compile`

---

**ConstruData HydroNetwork v7.0**  
*Março 2026*
