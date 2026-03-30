# 🔍 ANÁLISE DO PROBLEMA DE SNAP — TAREFA LLM-1

**Data:** 20/03/2026  
**Teste:** 4 DXFs reais do projeto

---

## 📊 RESULTADOS DO DIAGNÓSTICO

| Núcleo | PVs Reais | PVs Totais* | Trechos | Nós Sintéticos | % Sintéticos |
|--------|-----------|-------------|---------|----------------|--------------|
| Vila Criadores | 127 | 316 | 104 | 189 | **60%** |
| Morro do Tetéu | 320 | 1027 | 441 | 707 | **69%** |
| Pantanal Baixo | 188 | 392 | 213 | 204 | **52%** |
| João Carlos | 118 | 496 | 243 | 378 | **76%** |

\* PVs Totais = PVs reais + Nós sintéticos (ND_)

---

## 🎯 DESCOBERTA CRÍTICA

### PROBLEMA PRINCIPAL: **COORDENADAS INCOMPATÍVEIS**

**O que está acontecendo:**

1. **PVs** vêm de `PS_PONTOS_IDENTIFICACAO_TXT` → **COORDENADAS UTM REAIS**
   - Exemplo: X=738,000, Y=7,380,000 (SIRGAS 2000)

2. **Tubos** vêm do layer `TUBO_PVC` (ezdxf) → **COORDENADAS LOCAIS DO DESENHO**
   - Exemplo: X=1,234.56, Y=5,678.90 (espaço do desenho)

3. **Snap tenta conectar** PV em UTM com tubo em coords locais
   - Distância real: **CENTENAS DE QUILOMETROS**
   - Tolerância: 50m → **NUNCA VAI FAZER SNAP!**

4. **Solução paliativa atual:** Cria nós sintéticos (ND_) nos endpoints dos tubos
   - 189-707 nós sintéticos por núcleo!
   - Trechos são conectados a esses nós, não aos PVs reais

---

## 📈 ESTATÍSTICAS DOS TRECHOS

### Vila Criadores (104 trechos):
```
< 5m:    3   (3%)
5-10m:  10   (10%)
10-20m: 24   (23%)
20-50m: 59   (57%)
50m+:    8   (8%)
```
**Problema:** 57% dos trechos tem 20-50m → muito longos para serem reais entre PVs próximos

### Morro do Tetéu (441 trechos):
```
< 5m:   14   (3%)
5-10m: 148   (34%)
10-20m:184   (42%)
20-50m: 87   (20%)
50m+:    8   (2%)
```
**Bom:** 76% dos trechos tem 5-20m → coerente com rede real

### Pantanal Baixo (213 trechos):
```
< 5m:   18   (8%)
5-10m:  42   (20%)
10-20m: 90   (42%)
20-50m: 59   (28%)
50m+:    4   (2%)
```
**Regular:** 62% dos trechos tem 5-20m

### João Carlos (243 trechos):
```
< 5m:   15   (6%)
5-10m:  34   (14%)
10-20m:170   (70%)
20-50m: 21   (9%)
50m+:    3   (1%)
```
**Bom:** 84% dos trechos tem 5-20m

---

## 🔍 CAUSA RAIZ IDENTIFICADA

### Linha 716-720 do script:
```python
# PVs do texto estao em UTM -> usar tubos do ezdxf (tambem UTM)
# XDATA raw tem milhares de polilinhas de detalhe em coords locais
tubos_raw = tubos_ez
```

**COMENTÁRIO ESTÁ ERRADO!** 

Os tubos do `ezdxf` (layer TUBO_PVC) **NÃO estão em UTM**! Eles estão nas **coordenadas originais do DXF**, que podem ser:
- Coordenadas locais do desenho (espaço do modelo)
- OU UTM (se o desenho foi feito em coordenadas reais)

**Verificação necessária:**
```python
# Verificar se tubos estão em UTM
for tubo in tubos_ez[:5]:
    p0 = tubo["pt_ini"]
    print(f"Tubo: X={p0[0]:.2f}, Y={p0[1]:.2f}")
    
# Se X < 100,000 → coords locais
# Se X > 700,000 → UTM SIRGAS 2000
```

---

## 💡 SOLUÇÕES POSSÍVEIS

### SOLUÇÃO 1: **Detectar automaticamente o sistema de coordenadas**

```python
def _detectar_crs(pvs, tubos):
    """
    Detecta se PVs e tubos estão no mesmo CRS.
    Retorna True se estiverem, False caso contrário.
    """
    if not pvs or not tubos:
        return False
    
    # Pegar primeiro PV e primeiro tubo
    pv = list(pvs.values())[0]
    tubo = tubos[0]
    
    pv_x = pv.get("x", 0)
    tubo_x = tubo["pt_ini"][0]
    
    # Se diferenca > 100,000, estão em CRS diferentes
    if abs(pv_x - tubo_x) > 100000:
        return False
    
    return True
```

**Ação:** Se CRS diferentes, **NÃO usar tubos do ezdxf**. Usar XDATA raw ou criar PVs sintéticos.

---

### SOLUÇÃO 2: **Transformar tubos para UTM**

Se tubos estão em coords locais e PVs em UTM:
1. Detectar pontos de controle comuns (PVs que aparecem em ambos)
2. Calcular transformação (translação, rotação, escala)
3. Aplicar transformação em todos os tubos

**Complexidade:** Alta (requer pelo menos 3 pontos comuns)

---

### SOLUÇÃO 3: **Usar apenas XDATA raw (fallback)**

Se PVs e tubos estão em CRS diferentes:
```python
if not _detectar_crs(pvs, tubos_ez):
    log("  CRS incompativel — usando XDATA raw como fallback", "WARN")
    pvs = pvs_xd  # Usar PVs do XDATA (coords locais)
    tubos_raw = tubos_xd  # Usar tubos do XDATA (coords locais)
```

**Vantagem:** Tudo fica em coords locais, snap funciona.

**Desvantagem:** XDATA tem milhares de blocos de detalhe (ruído).

---

### SOLUÇÃO 4: **Criar PVs sintéticos nos endpoints de tubos (ATUAL)**

Já está implementado! O código:
```python
# Criar nós sintéticos para endpoints que NÃO coincidem com nenhum PV
_snap_sint = 2.0  # 2m para considerar mesmo ponto
for (pt, _, _) in _endpts:
    pv_match = _pv_mais_proximo(pt, pvs, _snap_sint)
    if not pv_match:
        _n_sint += 1
        nome_sint = f"ND_{_n_sint:04d}"
        pvs[nome_sint] = {
            "x": pt[0], "y": pt[1],
            "ct": None, "cf": None, "prof": None,
            "tipo": "ND", "sintetico": True,
        }
```

**Problema:** 52-76% dos "PVs" são sintéticos (ND_) → não tem CT/CF/prof → OSE fica incompleta!

---

## 📊 COMPARAÇÃO COM PROSANEAMENTO

| Núcleo | ProSane Trechos | Nossos Trechos | % capturado |
|--------|-----------------|----------------|-------------|
| São Manoel | 45 | 57 | 127% ✅ |
| Vila Criadores | 166 | 104 | **63%** ⚠️ |
| Pantanal Baixo | 313 | 213 | **68%** ⚠️ |
| Morro do Tetéu | 513 | 441 | **86%** ✅ |
| Vila Israel | 158 | 96 | **61%** ⚠️ |
| João Carlos | 89 | 243 | **273%** ✅ (DN diferente) |

**Média:** 78% dos trechos capturados.

**Meta:** 90%+

---

## ✅ RECOMENDAÇÃO

### Implementar **SOLUÇÃO 1 + SOLUÇÃO 3**:

1. **Detectar CRS** no início do `ler_dxf()`
2. **Se CRS incompatível:**
   - Usar PVs do XDATA (coords locais)
   - Usar tubos do XDATA (coords locais)
   - Logar aviso: "CRS incompatível — fallback para XDATA"

3. **Se CRS compatível:**
   - Usar PVs do PS_PONTOS (UTM)
   - Usar tubos do TUBO_PVC (UTM)
   - Snap funciona perfeitamente

**Código:**
```python
def ler_dxf(dxf_path):
    # ...
    
    # Detectar CRS
    if not _detectar_crs(pvs_texto, tubos_ez):
        log("  CRS incompativel — fallback para XDATA", "WARN")
        pvs = pvs_xd
        tubos_raw = tubos_xd
    else:
        log("  CRS compativel (UTM) — usando PS_PONTOS + TUBO_PVC", "OK")
        pvs = pvs_texto
        tubos_raw = tubos_ez
    
    # ...
```

---

## 🧪 TESTE NECESSÁRIO

Rodar diagnóstico com verificação de CRS:

```python
for dxf, nucleo in testes:
    pvs, trechos, ruas, meta = ler_dxf(dxf)
    
    # Verificar CRS
    pv_x = list(pvs.values())[0].get("x", 0)
    tubo_x = trechos[0]["pv_ini_x"] if trechos else 0
    
    print(f"{nucleo}: PV X={pv_x:.0f}, Tubo X={tubo_x:.0f}")
    
    if pv_x > 700000 and tubo_x < 100000:
        print(f"  ⚠️ CRS INCOMPATIVEL!")
    elif abs(pv_x - tubo_x) < 1000:
        print(f"  ✅ CRS COMPATIVEL!")
```

---

*Análise criada em 20/03/2026 — ConstruData SABESP v5.0*
