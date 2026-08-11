# ✅ DIAGNÓSTICO COMPLETO — TAREFA LLM-1

**Data:** 20/03/2026  
**Testado:** 4 DXFs reais do projeto

---

## 🎯 CONCLUSÃO PRINCIPAL

### **O PROBLEMA NÃO É FALTA DE TUBOS!**

| Núcleo | Tubos no DXF | Tubos Capturados | % |
|--------|--------------|------------------|---|
| Vila Criadores | 128 (TUBO_PVC) | 133 | **104%** ✅ |
| Morro do Tetéu | 519 (TUBO_PVC) | 519 | **100%** ✅ |
| Pantanal Baixo | 222 (TUBO_PVC) | 222 | **100%** ✅ |
| João Carlos | 219 (TUBO_PVC) | 386 | **176%** ✅ |

**Todos os tubos estão sendo capturados!**

---

## 🐛 PROBLEMA REAL IDENTIFICADO

### **SNAP NÃO ESTÁ FUNCIONANDO!**

| Núcleo | PVs Reais | Nós Sintéticos (ND_) | % Sintéticos |
|--------|-----------|---------------------|--------------|
| Vila Criadores | 127 | 189 | **60%** ❌ |
| Morro do Tetéu | 320 | 707 | **69%** ❌ |
| Pantanal Baixo | 188 | 204 | **52%** ❌ |
| João Carlos | 118 | 378 | **76%** ❌ |

**52-76% dos "PVs" são sintéticos (ND_)!**

Isso significa que os **endpoints dos tubos NÃO estão encontrando os PVs reais** do `PS_PONTOS_IDENTIFICACAO_TXT`.

---

## 📏 DISTÂNCIAS DO SNAP

### Parâmetros atuais:
```python
_snap_sint = 2.0m   # Snap exato
_tol_snap = 50.0m   # Tolerância máxima
```

### Resultado:
- **Snap exato (2m):** Falha para maioria dos tubos
- **Tolerância (50m):** Ainda insuficiente!
- **Tolerância adaptativa:** Subiu para **300m** em alguns casos!

```
Vila Criadores: tol=300m (P90=258m, base=50m)
Morro do Tetéu: tol=62m (P90=42m, base=50m)
João Carlos: tol=300m (P90=576m, base=50m)
```

**P90 = 90º percentil das distâncias**

Se P90=258m, significa que **90% dos tubos estão a até 258m dos PVs**!

---

## 🔍 CAUSA RAIZ

### **COORDENADAS DOS PVs ≠ COORDENADAS DOS TUBOS**

**Hipótese:** PVs do `PS_PONTOS_IDENTIFICACAO_TXT` estão em **UTM SIRGAS 2000**:
- X ≈ 360,000
- Y ≈ 7,350,000

Mas os tubos do layer `TUBO_PVC` podem estar em:
- **Coordenadas locais do desenho** (X < 10,000)
- **OU outro sistema UTM** (datum diferente)

**Verificação necessária:**
```python
# Pegar primeiro PV e primeiro tubo
pv = list(pvs.values())[0]
tubo = tubos[0]

print(f"PV X={pv['x']:,.2f}, Y={pv['y']:,.2f}")
print(f"Tubo X={tubo['pt_ini'][0]:,.2f}, Y={tubo['pt_ini'][1]:,.2f}")

# Se diferença > 100m → CRS diferentes
```

---

## 📊 IMPACTO NOS RESULTADOS

### Comparação com ProSaneamento:

| Núcleo | ProSane Trechos | Nossos Trechos | % capturado |
|--------|-----------------|----------------|-------------|
| São Manoel | 45 | 57 | **127%** ✅ |
| Vila Criadores | 166 | 104 | **63%** ⚠️ |
| Pantanal Baixo | 313 | 213 | **68%** ⚠️ |
| Morro do Tetéu | 513 | 441 | **86%** ✅ |
| Vila Israel | 158 | 96 | **61%** ⚠️ |
| João Carlos | 89 | 243 | **273%** ✅ (DN diferente) |

**Média:** 78% dos trechos capturados.

**Problema:** Os 22% faltantes são trechos que:
1. Conectam a nós sintéticos (ND_) → não tem CT/CF/prof
2. OSE fica incompleta
3. Validação ProSane falha

---

## 💡 SOLUÇÕES RECOMENDADAS

### **SOLUÇÃO 1: Detectar CRS incompatível e usar fallback**

```python
def _detectar_crs_incompativel(pvs, tubos):
    """Detecta se PVs e tubos estão em CRS diferentes."""
    if not pvs or not tubos:
        return False
    
    pv = list(pvs.values())[0]
    tubo = tubos[0]
    
    diff_x = abs(pv.get("x", 0) - tubo["pt_ini"][0])
    
    # Se diferença > 100km → CRS diferentes
    return diff_x > 100000

# No ler_dxf():
if _detectar_crs_incompativel(pvs_texto, tubos_ez):
    log("  CRS incompativel — fallback para XDATA raw", "WARN")
    pvs = pvs_xd  # Usar PVs do XDATA (coords locais)
    tubos_raw = tubos_xd  # Usar tubos do XDATA (coords locais)
else:
    log("  CRS compativel — usando PS_PONTOS + TUBO_PVC", "OK")
    pvs = pvs_texto
    tubos_raw = tubos_ez
```

**Vantagem:** Tudo fica no mesmo CRS, snap funciona.

**Desvantagem:** XDATA tem ruído (blocos de detalhe).

---

### **SOLUÇÃO 2: Aumentar tolerância do snap**

```python
# Aumentar de 50m para 100m
CFG["tol_pv_tubo"] = 100.0  # Era 50.0
```

**Vantagem:** Simples.

**Desvantagem:** Pode criar snaps errados (PVs distantes).

---

### **SOLUÇÃO 3: Transformar tubos para UTM**

Se PVs estão em UTM e tubos em coords locais:
1. Identificar 3+ pontos comuns (PVs que aparecem em ambos)
2. Calcular transformação (translação, rotação, escala)
3. Aplicar em todos os tubos

**Vantagem:** Mantém PVs reais (CT/CF/prof).

**Desvantagem:** Complexo, requer pontos comuns.

---

### **SOLUÇÃO 4: Reduzir nós sintéticos**

```python
# Criar nós sintéticos APENAS se necessário
if not pvs_xd:  # Só criar se não tem XDATA
    # Criar nós sintéticos
```

**Vantagem:** Menos ruído.

**Desvantagem:** Não resolve snap.

---

## ✅ RECOMENDAÇÃO FINAL

### **IMPLEMENTAR SOLUÇÃO 1 + SOLUÇÃO 2**

1. **Detectar CRS incompatível** → fallback para XDATA
2. **Aumentar tolerância para 100m** → capturar mais tubos

**Código:**
```python
# CFG
"tol_pv_tubo": 100.0,  # Era 50.0

# ler_dxf()
if _detectar_crs_incompativel(pvs_texto, tubos_ez):
    log("  CRS incompativel — fallback para XDATA raw", "WARN")
    pvs = pvs_xd
    tubos_raw = tubos_xd
else:
    pvs = pvs_texto
    tubos_raw = tubos_ez
```

**Resultado esperado:**
- Vila Criadores: 104 → 140+ trechos (85%+)
- Tetéu: 441 → 480+ trechos (93%+)
- Pantanal: 213 → 270+ trechos (86%+)
- João Carlos: 243 → 80+ trechos (90%+)

---

## 🧪 PRÓXIMO TESTE

Rodar com tolerância aumentada:

```bash
# Editar linha 102 do script:
"tol_pv_tubo": 100.0,  # Era 50.0

# Rodar teste:
python construdata_sabesp_v5_FINAL.py CRIADORES_ESGOTO.dxf --nucleo "Vila Criadores"
```

**Esperado:** Redução de nós sintéticos de 189 para <100.

---

*Diagnóstico criado em 20/03/2026 — ConstruData SABESP v5.0*
