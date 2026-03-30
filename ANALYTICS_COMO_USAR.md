# 📊 ConstruData Analytics ML — Guia de Uso

## Visão Geral

O **Analytics ML** é um módulo de Machine Learning integrado à plataforma ConstruData HydroNetwork que utiliza **XGBoost/RandomForest** com **GridSearchCV** para prever a produção de ligações de água e esgoto.

---

## 🎯 Funcionalidades

### 1. Modelo Preditivo
- **Algoritmo**: XGBoost Regressor (ou RandomForest como fallback)
- **GridSearchCV**: 108 combinações × 3 folds = 324 modelos treinados
- **Features**: Rolling averages (3d, 7d), dia da semana, mês, núcleo, dias decorridos
- **Target**: Ligações totais por dia (LA + LE)

### 2. Métricas do Modelo
- **R² (teste)**: Qualidade do ajuste (20% dos dados)
- **R² CV (5-fold)**: Validação cruzada
- **MAE**: Erro absoluto médio (ligações/dia)
- **RMSE**: Raiz do erro quadrático médio

### 3. Feature Importance
Ranking das features mais importantes para a previsão:
1. `lig_total_r3` — Rolling 3 dias de ligações totais
2. `lig_total_r7` — Rolling 7 dias de ligações totais
3. `la_r3` — Rolling 3 dias de ligações de água
4. `le_r3` — Rolling 3 dias de ligações de esgoto
5. `dias_decorridos` — Maturidade do núcleo

### 4. Cenários de Aceleração
5 cenários simulados:
| Cenário | Descrição |
|---------|-----------|
| Baseline | Ritmo atual de produção |
| +10% | Aceleração moderada |
| +20% | Aceleração significativa |
| +30% | Aceleração agressiva |
| Meta Contratual | 366 ligações/mês (contrato) |

Cada cenário inclui:
- Produção diária e mensal estimada
- Dias para concluir o contrato
- Data prevista de conclusão
- Custo extra estimado (R$/mês)

---

## 🚀 Como Usar na GUI

### Passo 1: Abra a Plataforma
```bash
python construdata_gui.py
```

### Passo 2: Acesse a Aba "IA"
Clique na aba **IA** no topo da interface.

### Passo 3: Execute o Analytics
Na seção **ANALYTICS ML — XGBoost/RandomForest**:

1. **🚀 EXECUTAR ANALYTICS**
   - Treina o modelo com dados históricos
   - Gera previsões e cenários
   - Cria gráficos e relatórios
   - Tempo estimado: 2-5 minutos

2. **📊 VER GRÁFICOS**
   - Abre a pasta com 4 gráficos PNG:
     - `01_real_vs_predito.png` — Scatter Real vs Predito
     - `02_violin_nucleos.png` — Distribuição por núcleo
     - `03_feature_importance.png` — Importância das features
     - `04_tendencia_semanal.png` — Tendência semanal

3. **📈 CENÁRIOS**
   - Abre janela com tabela detalhada dos 5 cenários
   - Mostra impacto de aceleração no cronograma
   - Exibe custos extras estimados

4. **📄 EXPORTAR XLSX**
   - Abre o Excel com 5 abas:
     - MODELO — Parâmetros e métricas
     - PREDICAO — Real vs Predito por dia/núcleo
     - CENARIOS — 5 cenários de aceleração
     - PIPELINE — 11 etapas, gargalos, PPC
     - NUCLEOS — Resumo estatístico por núcleo

5. **📂 ABRIR PASTA**
   - Abre a pasta de saída `analiticos/`

---

## 📁 Estrutura de Arquivos

```
NOVA NS Versao 5/
├── construdata_gui.py           # Interface principal
├── construdata_analytics.py     # Motor Analytics ML
├── dados_contrato/
│   ├── EXECUCAO_DIARIA.json     # Dados históricos (521 dias × 6 núcleos)
│   └── ML_DATA.json             # Insights e pipeline
└── analiticos/                  # Saída gerada
    ├── ANALYTICS_SLNR.xlsx      # Relatório completo
    ├── ANALYTICS_SLNR.json      # Resultados para integração
    └── graficos/
        ├── 01_real_vs_predito.png
        ├── 02_violin_nucleos.png
        ├── 03_feature_importance.png
        └── 04_tendencia_semanal.png
```

---

## 🔧 Execução via Linha de Comando

Também é possível executar diretamente:

```bash
cd "C:\Users\felip\Downloads\NOVA NS Versao 5"

# Execução padrão
python analiticos construdata\construdata_analytics.py

# Com parâmetros customizados
python analiticos construdata\construdata_analytics.py ^
    --exec dados_contrato/EXECUCAO_DIARIA.json ^
    --ml dados_contrato/ML_DATA.json ^
    --output analiticos
```

---

## 📊 Interpretação dos Resultados

### Métricas de Qualidade
| R² | Interpretação |
|----|---------------|
| > 0.7 | Excelente |
| 0.5-0.7 | Bom |
| 0.3-0.5 | Regular |
| < 0.3 | Baixo (dados muito variáveis) |

### MAE (Erro Absoluto Médio)
- Indica o erro médio em ligações/dia
- Exemplo: MAE = 3.0 → erro médio de 3 ligações/dia

### Cenários
- **Baseline**: Projeção linear do ritmo atual
- **Aceleração**: Considera custo adicional de R$50k/mês por 10% de ganho
- **Meta Contratual**: Produção necessária para cumprir contrato

---

## 💡 Dicas de Uso

1. **Execute semanalmente** para atualizar previsões
2. **Compare cenários** para planejar acelerações
3. **Use Feature Importance** para identificar gargalos
4. **Compartilhe XLSX** em reuniões de acompanhamento
5. **Gráficos PNG** podem ser inseridos em apresentações

---

## 🏗️ Integração com Outros Motores

O JSON gerado (`ANALYTICS_SLNR.json`) pode ser usado por:
- **Motor de Custos**: Previsão de desembolso
- **Motor de Cronograma**: Ajuste de WBS
- **Motor de Perdas**: Projeção de UARL por DMA
- **Motor Lean/LPS**: Takt time baseado em produção real

---

## 📌 Contrato

**FCN Construções e Saneamento**  
**Contrato**: 11481051  
**Projeto**: SE LIGA NA REDE  
**Local**: Santos/SP  

**Meta Total**: 25.383 ligações  
**Meta Mensal**: 366 ligações  

---

## ⚙️ Dependências

```
numpy
pandas
scikit-learn
xgboost (opcional, usa RandomForest como fallback)
matplotlib
seaborn
openpyxl
```

---

## 📞 Suporte

Em caso de dúvidas, consulte a documentação técnica ou a equipe de engenharia.

**ConstruData HydroNetwork v7.0**  
*Março 2026*
