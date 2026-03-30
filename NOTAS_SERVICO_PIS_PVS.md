# 📄 NOTAS DE SERVIÇO DIVIDIDAS POR PIs e PVs

## Contrato 11481051 · DGS Engenharia · SLNR Santos

---

## ✅ NOVO FORMATO IMPLEMENTADO!

As **Notas de Serviço (NS)** agora são divididas por **PIs (Pontos Iniciais)** e **PVs (Pontos de Vértice)**!

---

## 📋 FORMATO DAS NOTAS DE SERVIÇO:

### **Padrão de Nomenclatura:**

```
NS_XXX_PI_YY_AO_PV_ZZ

Onde:
  XXX = Número da NS (001-999)
  YY  = PI inicial (00-99)
  ZZ  = PV final (01-999)
```

### **Exemplos:**

| Nota de Serviço | Significado |
|-----------------|-------------|
| `NS_001_PI_00_AO_PV_1` | NS 001: Do PI 00 ao PV 1 |
| `NS_017_PI_05_AO_PV_62` | NS 017: Do PI 05 ao PV 62 |
| `NS_023_PI_12_AO_PV_3` | NS 023: Do PI 12 ao PV 3 |

---

## 📊 ESTRUTURA DA ABA `NOTAS_SERVICO_PIS_PVS`:

### **Colunas:**

| Coluna | Campo | Descrição | Exemplo |
|--------|-------|-----------|---------|
| A | **NS** | Nome da Nota de Serviço | `NS_001_PI_00_AO_PV_1` |
| B | **Trecho** | Núcleo/Região | `N07_NOROESTE` |
| C | **PI Inicial** | Ponto Inicial (interseção) | `PI_00` |
| D | **PV Final** | Ponto de Vértice final | `PV_1` |
| E | **Extensão (m)** | Metros de rede | `150` |
| F | **DN Água** | Diâmetro nominal água | `100 mm` |
| G | **DN Esgoto** | Diâmetro nominal esgoto | `75 mm` |
| H | **LA** | Ligações de Água | `20` |
| I | **LE** | Ligações de Esgoto | `15` |
| J | **Total Lig.** | Total de ligações | `35` |
| K | **Equipes** | Número de equipes | `2` |
| L | **Dias** | Dias para executar | `=E2/(2*6)` |
| M | **Status** | Situação da NS | `✅ Concluído` |

---

## 🏗️ NOTAS DE SERVIÇO POR NÚCLEO:

### **N07_NOROESTE (5 NSs):**
- `NS_001_PI_00_AO_PV_1` — 150m, 35 ligações
- `NS_002_PI_01_AO_PV_2` — 180m, 43 ligações
- `NS_003_PI_02_AO_PV_3` — 200m, 48 ligações
- `NS_004_PI_03_AO_PV_4` — 170m, 38 ligações
- `NS_005_PI_04_AO_PV_5` — 160m, 35 ligações

### **N08_V_PROGRESSO (3 NSs):**
- `NS_006_PI_00_AO_PV_1` — 220m, 63 ligações
- `NS_007_PI_05_AO_PV_2` — 190m, 54 ligações
- `NS_008_PI_06_AO_PV_3` — 210m, 59 ligações

### **N09_Z_LESTE (2 NSs):**
- `NS_009_PI_00_AO_PV_1` — 250m, 72 ligações
- `NS_010_PI_07_AO_PV_2` — 230m, 65 ligações

### **N10_CONJUNTO (2 NSs):**
- `NS_011_PI_00_AO_PV_1` — 180m, 50 ligações
- `NS_012_PI_08_AO_PV_2` — 200m, 57 ligações

### **N11_ALAGADO (2 NSs):**
- `NS_013_PI_00_AO_PV_1` — 160m, 45 ligações
- `NS_014_PI_09_AO_PV_2` — 175m, 49 ligações

### **N12_MONTANHOSO (2 NSs):**
- `NS_015_PI_00_AO_PV_1` — 190m, 54 ligações
- `NS_016_PI_10_AO_PV_2` — 210m, 60 ligações

### **SD_JOAO_CARLOS (2 NSs):**
- `NS_017_PI_00_AO_PV_1` — 240m, 68 ligações
- `NS_018_PI_11_AO_PV_2` — 220m, 63 ligações

### **SD_SAO_MANOEL (2 NSs):**
- `NS_019_PI_00_AO_PV_1` — 260m, 75 ligações
- `NS_020_PI_12_AO_PV_2` — 235m, 67 ligações

### **SD_VILA_ISRAEL (2 NSs):**
- `NS_021_PI_00_AO_PV_1` — 200m, 58 ligações
- `NS_022_PI_13_AO_PV_2` — 185m, 53 ligações

### **SD_MORRO_TETEU (3 NSs):**
- `NS_023_PI_00_AO_PV_1` — 280m, 81 ligações
- `NS_024_PI_14_AO_PV_2` — 265m, 76 ligações
- `NS_025_PI_15_AO_PV_3` — 250m, 72 ligações

### **SD_VILA_CRIADORES (2 NSs):**
- `NS_026_PI_00_AO_PV_1` — 230m, 67 ligações
- `NS_027_PI_16_AO_PV_2` — 215m, 62 ligações

### **SD_PANTANAL_BAIXO (2 NSs):**
- `NS_028_PI_00_AO_PV_1` — 270m, 78 ligações
- `NS_029_PI_17_AO_PV_2` — 255m, 74 ligações

---

## 📈 TOTAL GERAL:

| Quantidade | Valor |
|------------|-------|
| **Total de NSs** | 29 |
| **Extensão Total** | ~6.000m |
| **Ligações Totais** | ~1.700 |
| **Núcleos Atendidos** | 12 |

---

## 🔢 FÓRMULAS UTILIZADAS:

### **Cálculo de Dias:**
```excel
Dias = Extensão / (Equipes × Produtividade)

Exemplo:
NS_001: 150m / (2 equipes × 6 m/eq/dia) = 12,5 dias
```

### **Cálculo de Ligações:**
```excel
Total Lig. = LA + LE

Exemplo:
NS_001: 20 (LA) + 15 (LE) = 35 ligações
```

### **Soma Total:**
```excel
=SOMA(E2:E30)   → Extensão total
=SOMA(J2:J30)   → Ligações totais
```

---

## 🎯 STATUS DAS NOTAS DE SERVIÇO:

| Status | Cor | Significado |
|--------|-----|-------------|
| ✅ **Concluído** | Verde | NS já executada |
| 🔄 **Em execução** | Amarelo | NS sendo executada |
| ⏳ **Pendente** | Vermelho | NS ainda não iniciada |

---

## 📄 COMO USAR NA PRÁTICA:

### **1. Gerar a planilha:**
```bash
# Na plataforma ConstruData
Aba IA → SLNR MESTRE → 📊 GERAR SLNR ML
```

### **2. Abrir a aba `NOTAS_SERVICO_PIS_PVS`:**
- Veja todas as 29 NSs organizadas
- Confira PIs e PVs de cada trecho
- Verifique extensão e ligações

### **3. Exportar para equipe de campo:**
- Imprima as NSs por núcleo
- Envie por e-mail para engenheiros
- Use como base para medição

### **4. Acompanhar execução:**
- Atualize status semanalmente
- Marque NSs concluídas
- Calcule dias restantes

---

## 🔗 INTEGRAÇÃO COM DXF/DWG:

**Em produção**, os PIs e PVs viriam diretamente do desenho:

```
DXF/DWG → Extrair PIs e PVs → Gerar NSs automaticamente
```

**Formato de saída:**
```
NS_017_PI_00_AO_PV_62.dxf  ← Arquivo DWG da NS 017
NS_017_PI_00_AO_PV_62.pdf  ← PDF para campo
```

---

## 💡 DICAS DE USO:

1. **Use a nomenclatura padrão** em todos os documentos
2. **Imprima as NSs** separadamente por núcleo
3. **Numere fisicamente** as estacas no campo (PI 00, PI 01, etc.)
4. **Atualize o status** diariamente na planilha
5. **Vincule as medições** às NSs correspondentes

---

## 📞 SUPORTE:

Em caso de dúvidas sobre as Notas de Serviço:

1. Verifique a aba `NOTAS_SERVICO_PIS_PVS`
2. Confira a legenda (linhas 3-10)
3. Veja o exemplo da NS_001
4. Use as fórmulas como modelo

---

**ConstruData HydroNetwork v7.0**  
*Março 2026*
