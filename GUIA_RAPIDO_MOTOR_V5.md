# 📖 GUIA RÁPIDO — MOTOR v5 UNIVERSAL

## ✅ O QUE VOCÊ TEM AGORA

### Arquivos Principais
| Arquivo | Função |
|---------|--------|
| `ler_dxf_gdal.py` | **Motor v5 universal** — lê QUALQUER DXF do ProSaneamento |
| `construdata_gui.py` | **Seu GUI** — já usa o motor v5 automaticamente |
| `testar_lote_dxf.py` | Testa múltiplos DXFs de uma vez |
| `motor_teteu_esgoto.py` | Motor específico (teste/debug) |

## 🚀 COMO USAR NO DIA A DIA

### 1. Processar DXF no GUI (Método Principal)

```bash
# Abrir GUI
python construdata_gui.py
```

**No GUI:**
1. Clique em **"Selecionar Arquivo"**
2. Escolha **QUALQUER DXF do ProSaneamento**
3. Clique em **"Processar"**
4. Aguarde o log:
   ```
   [OK] Tubos encontrados: XX (filtro conservador)
   [OK] PVs finais: XX
   [OK] Trechos válidos: XX
   ```

### 2. Testar Múltiplos DXFs

```bash
# Testar pasta inteira
python testar_lote_dxf.py "C:\DXFs\MORRO DO TETEU"

# Testar com resumo (menos output)
python testar_lote_dxf.py "C:\DXFs" --resumo
```

### 3. Testar DXF Único (Linha de Comando)

```bash
python ler_dxf_gdal.py "C:\DXFs\ARQUIVO.dxf"
```

## 📊 O QUE ESPERAR DE CADA DXF

### Log de Sucesso
```
[OK] Entidades carregadas: 3231
[OK] Tubos encontrados: 64 (filtro conservador)
[OK] PVs reais (clusters): 57
[OK] PVs finais: 57
[INFO] PVs genéricos criados: 4
[OK] Trechos válidos: 50
[OK] Rede coletora: 50 trechos | 708m
```

### Log de Erro (DXF Inválido)
```
[!] DXF 'xxx.dxf' sem importacao confiavel: 
    nenhum tubo valido encontrado
```

## 🎯 FUNCIONA COM QUALQUER DXF?

### ✅ SIM, se o DXF for do ProSaneamento

O motor v5 funciona com:
- ✅ DXF com layer `TUBO_PVC`
- ✅ DXF com layer `PROLONG`
- ✅ DXF com layer `PS_PONTOS_IDENTIFICACAO_TXT`
- ✅ DXF com perfis (ignora perfis)
- ✅ DXF com pontos/caixas (ignora pontos)
- ✅ DXF sem alguns labels (cria PVs genéricos)

### ❌ NÃO, se o DXF for genérico

DXFs sem layers do ProSaneamento precisam de:
- `motor_teteu_esgoto.py` (modo genérico)
- Ou ajuste manual dos filtros

## 🔍 VALIDAR SE ESTÁ FUNCIONANDO

### Check de Sucesso
- [ ] Log mostra "filtro conservador"
- [ ] PVs genéricos criados (se tiver clusters sem texto)
- [ ] 0 ligações sem PV
- [ ] Extensão coerente com o DXF

### Check de Erro
- [ ] "nenhum tubo valido encontrado"
- [ ] Camadas do DXF não são `TUBO_PVC`, `PROLONG`, etc.
- [ ] DXF é genérico, não ProSaneamento

## 🛡️ POR QUE NÃO INVENTA MAIS?

### Filtro de Layers v5
```python
# INCLUI
"TUBO", "PROLONG", "CONDUTO", "PIPE"

# EXCLUI (não lê)
"PERFIL", "DETALHE", "CORTE",      # 2D
"PONTOS", "CAIXAS",                # Pontos
"TEXTO", "COTA", "DIMENSÃO"        # Labels
```

### Resultado
- TETÉU_ESGOTO22.dxf: 108 → **64 tubos** (-41% invenção)
- Trechos: 39 → **50 trechos** (+28% rede real)

## 📋 EXEMPLO DE USO REAL

### Passo 1: Selecionar DXF
```
C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\
  MAPAS ÁGUA E ESGOTO PARA DXF\
    MORRO DO TETÉU\
      TETÉU_ESGOTO22.dxf  ← Selecionar este
```

### Passo 2: Processar no GUI
```
1. Abrir construdata_gui.py
2. Clicar "Selecionar Arquivo"
3. Escolher TETÉU_ESGOTO22.dxf
4. Clicar "Processar"
```

### Passo 3: Verificar Resultados
```
Aba "Rede":
  PVs: 57
  Trechos: 50
  Extensão: 708m

Aba "Trechos":
  Tabela com todos os 50 trechos
```

### Passo 4: Exportar (se necessário)
```
Aba "Processar":
  Clicar "Gerar NS"
  Salvar JSON/Excel
```

## ⚠️ PROBLEMAS COMUNS

### "Nenhum tubo encontrado"
**Causa:** DXF não tem layer `TUBO_PVC` ou `PROLONG`

**Solução:**
1. Verifique layers do DXF:
   ```bash
   python diagnostico_teteu.py
   ```
2. Se for DXF genérico, use `motor_teteu_esgoto.py`

### "Muitos PVs genéricos"
**Causa:** Textos de PV estão longe dos clusters (> 15m)

**Solução:** Aumentar tolerância no código:
```python
TOL_LABEL_PV = 15.0  # → 25.0
```

### "DXF demora muito"
**Causa:** DXF muito grande (> 5000 entidades)

**Solução:** Normal (GDAL lê tudo). Aguarde.

## 📞 SUPORTE

### Se Não Funcionar

1. **Verifique o log** — qual erro aparece?
2. **Teste DXF conhecido** — TETÉU_ESGOTO22.dxf funciona?
3. **Execute diagnóstico** — `python diagnostico_teteu.py`
4. **Veja camadas** — `python testar_lote_dxf.py "pasta"`

### Reportar Problema

Inclua:
- Caminho do DXF
- Log completo do erro
- Output do diagnóstico
- Lista de layers do DXF

---

**Nova NS Versão 5** — 2026-03-29  
*Motor universal — Funciona com QUALQUER DXF do ProSaneamento*
