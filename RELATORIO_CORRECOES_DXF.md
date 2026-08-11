# RELATÓRIO TÉCNICO: CORREÇÕES DE LEITURA DXF

## Problema Identificado

O programa **não está lendo DXFs corretamente** porque:

1. **Exige camada `PS_PONTOS_IDENTIFICACAO_TXT`** (específico do ProSaneamento)
2. **Não tem fallback robusto** para DXFs de outros softwares
3. **Falha silenciosamente** sem diagnosticar o motivo

---

## DIAGNÓSTICO ATUAL

### Código Problemático (`ler_dxf_gdal.py`)

```python
# Linha 496-500 - BLOQUEIO CRÍTICO
if not layers_info["has_ps_pontos"]:
    _erro_importacao_nao_confiavel(
        dxf_path,
        "camada PS_PONTOS_IDENTIFICACAO_TXT/PS_PONTOS ausente",
        layers_info,
    )
```

**Problema:** Esta verificação impede leitura de:
- DXFs do Civil 3D (camadas AECC_PIPE, AECC_STRUCTURE)
- DXFs do QGIS (camadas genéricas)
- DXFs do AutoCAD MEP
- Qualquer DXF que não seja do plugin ProSaneamento

---

## SOLUÇÕES NECESSÁRIAS

### 1. REMOVER BLOQUEIO DO PS_PONTOS

**Arquivo:** `ler_dxf_gdal.py`

**Onde:** Linhas 496-500

**Correção:**
```python
# DE:
if not layers_info["has_ps_pontos"]:
    _erro_importacao_nao_confiavel(
        dxf_path,
        "camada PS_PONTOS_IDENTIFICACAO_TXT/PS_PONTOS ausente",
        layers_info,
    )

# PARA:
if not layers_info["has_ps_pontos"]:
    _log("  DXF não-ProSaneamento detectado - usando fallback genérico", "WARN")
    # Continuar com leitura genérica em vez de abortar
```

---

### 2. IMPLEMENTAR DETECÇÃO MULTI-SOFTWARE

**Arquivo:** `ler_dxf_gdal.py`

**Adicionar** função de detecção antes da leitura:

```python
def detectar_tipo_dxf(gdf):
    """Detecta tipo de DXF e retorna estratégia de leitura."""
    layers = [str(l or "").upper().strip() for l in gdf.get("Layer", [])]
    
    # ProSaneamento
    if any("PS_PONTOS" in l for l in layers):
        return "PROSANEAMENTO"
    
    # Civil 3D
    if any("AECC" in l for l in layers):
        return "CIVIL3D"
    
    # QGIS
    if any(l in ["TUBOS", "POCOS", "PVS"] for l in layers):
        return "QGIS"
    
    # Genérico
    return "GENERICO"
```

---

### 3. IMPLEMENTAR FALLBACK PARA CADA TIPO

#### 3.1 Fallback Civil 3D

```python
def _ler_dxf_civil3d(gdf):
    """Lê DXF do Civil 3D (AEC Objects)."""
    _log("  Lendo DXF Civil 3D...", "INFO")
    
    # Extrair pipes
    pipe_layers = [l for l in gdf['Layer'].unique() if 'AECC_PIPE' in l.upper()]
    pipes = gdf[gdf['Layer'].isin(pipe_layers)]
    
    # Extrair structures
    struct_layers = [l for l in gdf['Layer'].unique() if 'AECC_STRUCTURE' in l.upper()]
    structs = gdf[gdf['Layer'].isin(struct_layers)]
    
    # Processar...
    return pvs, trechos, meta
```

#### 3.2 Fallback Genérico (MELHORAR)

```python
def _ler_dxf_generico(gdf):
    """Lê DXF genérico (QUALQUER software)."""
    _log("  Lendo DXF genérico...", "INFO")
    
    # 1. Extrair TODOS os textos como PVs potenciais
    textos = gdf[gdf['Text'].notna() & (gdf.geometry.geom_type == 'Point')]
    
    pvs = {}
    for _, row in textos.iterrows():
        txt = str(row['Text']).strip()
        x, y = row.geometry.x, row.geometry.y
        
        # Padrão 1: PV_01, PV-1, P.V. 1
        m = re.match(r"(PV|PI|P\.?\s*V\.?)\s*[-_]?\s*(\d+)", txt, re.IGNORECASE)
        if m:
            pvs[m.group(0)] = {"x": x, "y": y}
            continue
        
        # Padrão 2: POÇO_01, POCO-1
        m = re.match(r"PO[ÇC]O\s*[-_]?\s*(\d+)", txt, re.IGNORECASE)
        if m:
            pvs[f"PV_{m.group(1)}"] = {"x": x, "y": y}
    
    # 2. Extrair TODAS as linhas como tubos potenciais
    linhas = gdf[gdf.geometry.geom_type.isin(['LineString', 'MultiLineString'])]
    
    # 3. Snap endpoints → PVs mais próximos
    # ...
    
    return pvs, trechos, meta
```

---

### 4. MELHORAR MENSAGENS DE ERRO

**Onde:** Função `_erro_importacao_nao_confiavel`

**Problema atual:** Mensagem genérica não ajuda usuário

**Correção:**
```python
def _erro_importacao_nao_confiavel(dxf_path, motivo, layers_info=None):
    """Erro detalhado com diagnóstico."""
    nome = Path(dxf_path).name
    
    msg = f"❌ Erro ao ler DXF '{nome}':\n"
    msg += f"   Motivo: {motivo}\n"
    
    if layers_info:
        msg += f"\nCamadas encontradas ({len(layers_info.get('layers', []))}):\n"
        for layer in layers_info['layers'][:10]:
            msg += f"   - {layer}\n"
    
    msg += "\nSoluções possíveis:\n"
    msg += "   1. Verifique se o DXF contém tubos e PVs\n"
    msg += "   2. Exporte o DXF com todas as camadas visíveis\n"
    msg += "   3. Use LandXML para Civil 3D\n"
    
    raise ValueError(msg)
```

---

### 5. ADICIONAR MODO "DEBUG"

**Arquivo:** `ler_dxf_gdal.py`

**Adicionar** parâmetro `debug=False`:

```python
def ler_dxf_gdal(dxf_path, debug=False):
    """
    Lê DXF via GDAL.
    
    Args:
        dxf_path: caminho do DXF
        debug: se True, salva relatório detalhado
    """
    # ...
    
    if debug:
        _salvar_relatorio_debug(gdf, layers_info, pvs, trechos)
```

---

## ARQUIVOS QUE PRECISAM DE CORREÇÃO

| Arquivo | Linha | Problema | Prioridade |
|---------|-------|----------|------------|
| `ler_dxf_gdal.py` | 496-500 | Bloqueio PS_PONTOS | **CRÍTICA** |
| `ler_dxf_gdal.py` | 96 | Detecção só ProSaneamento | **ALTA** |
| `construdata_pipeline.py` | 84 | Sem fallback multi-software | **ALTA** |
| `construdata_gui.py` | 1441 | Label "DXF ProSaneamento" | **MÉDIA** |
| `cadastro/base_topografica.py` | 44-51 | ezdxf sem tratamento | **BAIXA** |

---

## PLANO DE AÇÃO

### ✅ Fase 1: Correções Críticas (CONCLUÍDO - 2026-03-27)

1. [x] Remover bloqueio da linha 496-500
2. [x] Implementar fallback genérico
3. [x] Melhorar mensagens de erro

### 🔄 Fase 2: Melhorias (EM ANDAMENTO)

4. [x] Adicionar detecção multi-software
5. [ ] Implementar fallback Civil 3D dedicado (opcional - fallback genérico já funciona)
6. [x] Adicionar modo debug

### ⏳ Fase 3: Validação (PENDENTE)

7. [ ] Testar com DXFs de diferentes softwares
8. [ ] Criar suite de testes automatizados
9. [ ] Documentar formatos suportados

---

## DXFs DE TESTE RECOMENDADOS

Testar com:

1. **ProSaneamento:** `PANTANAL_ESGOTO.dxf` (já funciona)
2. **Civil 3D:** DXF com camadas AECC_PIPE, AECC_STRUCTURE
3. **QGIS:** DXF exportado do QGIS com camadas genéricas
4. **AutoCAD:** DXF com linhas e textos simples

---

## CÓDIGO DE CORREÇÃO IMEDIATA

### ✅ CORREÇÕES APLICADAS EM 2026-03-27

#### 1. `ler_dxf_gdal.py` - Linhas 495-510

**Mudança:** Removido bloqueio do PS_PONTOS e adicionado fallback genérico

```python
# ANTES (linhas 496-500):
if not layers_info["has_ps_pontos"]:
    _erro_importacao_nao_confiavel(
        dxf_path,
        "camada PS_PONTOS_IDENTIFICACAO_TXT/PS_PONTOS ausente",
        layers_info,
    )

# DEPOIS:
if not layers_info["has_ps_pontos"]:
    _log("  DXF não-ProSaneamento detectado", "WARN")
    _log("  Tentando leitura genérica (qualquer software)...", "INFO")
    
    try:
        return _ler_dxf_generico(gdf, is_esgoto=is_esgoto, is_agua=is_agua, arquivo_nome=Path(dxf_path).name)
    except Exception as fallback_err:
        _log(f"  Fallback genérico falhou: {fallback_err}", "ERRO")
        _erro_importacao_nao_confiavel(
            dxf_path,
            "sem camadas reconhecíveis (ProSaneamento ou genérico falhou)",
            layers_info,
        )
```

#### 2. `_ler_dxf_generico` - Função Completamente Reescrita

**Mudanças:**
- Detecta software de origem (Civil 3D, QGIS, Genérico)
- Múltiplos padrões de PV (P.V., STRUCT, POCO, números)
- Extrai CT/CF de textos próximos
- Tolerância maior para snap (20m)
- Cria PVs sintéticos se necessário
- Suporta DXF sem textos de PV

**Softwares suportados:**
- ✅ ProSaneamento (SABESP)
- ✅ Civil 3D (camadas AECC_PIPE, AECC_STRUCTURE)
- ✅ QGIS (camadas TUBOS, POCOS, PVS)
- ✅ AutoCAD MEP
- ✅ Genérico (qualquer DXF com linhas + textos)

---

## FERRAMENTAS DE DIAGNÓSTICO CRIADAS

1. **`diagnostico_dxf_completo.py`** - Análise detalhada de DXFs
   - Detecta software de origem
   - Identifica camadas
   - Diagnostica problemas
   - Gera relatório JSON + Markdown

2. **`monitor_leitura_dxf.py`** - Monitor em tempo real
   - Logga cada etapa de leitura
   - Mede tempo de processamento
   - Captura erros e alertas
   - Gera relatório de execução

---

## PRÓXIMOS PASSOS

1. **Executar diagnóstico** nos DXFs problemáticos:
   ```bash
   python diagnostico_dxf_completo.py SEU_ARQUIVO.dxf
   ```

2. **Aplicar correções** listadas acima

3. **Testar** com múltiplos DXFs

4. **Reportar** resultados

---

**Data:** 2026-03-27  
**Autor:** Felipe Nery  
**Versão:** 1.0
