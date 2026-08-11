# GUIA DE USO: LEITURA DE DXFs MULTI-SOFTWARE

## ✅ O QUE MUDOU

Agora o programa lê DXFs de **QUALQUER software**, não apenas ProSaneamento:

### Softwares Suportados

| Software | Camadas Típicas | Status |
|----------|----------------|--------|
| **ProSaneamento** (SABESP) | `PS_PONTOS_IDENTIFICACAO_TXT`, `TUBO_PVC`, `PS_IND_DIAMETRO` | ✅ Nativo |
| **Civil 3D** | `AECC_PIPE`, `AECC_STRUCTURE`, `PIPE` | ✅ Suportado |
| **QGIS** | `TUBOS`, `POCOS`, `PVS` | ✅ Suportado |
| **AutoCAD MEP** | `PIPE`, `FITTING`, `STRUCTURE` | ✅ Suportado |
| **Genérico** | Qualquer camada com `TUBO`, `CONDUTO`, `PIPE` | ✅ Suportado |

---

## 🚀 COMO USAR

### Método 1: Pipeline Completo

```bash
python construdata_pipeline.py SEU_ARQUIVO.dxf
```

Exemplos:
```bash
# ProSaneamento
python construdata_pipeline.py PANTANAL_ESGOTO.dxf

# Civil 3D
python construdata_pipeline.py REDE_CIVIL3D.dxf

# QGIS
python construdata_pipeline.py rede_esgoto_qgis.dxf

# Genérico
python construdata_pipeline.py meu_dxf_qualquer.dxf
```

### Método 2: GUI

```bash
python construdata_gui.py
```

1. Clique em "Selecionar arquivo"
2. Escolha seu DXF
3. O sistema detecta automaticamente o tipo
4. Clique em "Processar"

### Método 3: Leitura Direta

```python
from ler_dxf_gdal import ler_dxf_gdal

pvs, trechos, ruas, meta = ler_dxf_gdal("SEU_ARQUIVO.dxf")

print(f"PVs: {len(pvs)}")
print(f"Trechos: {len(trechos)}")
print(f"Software detectado: {meta.get('motor', 'Desconhecido')}")
```

---

## 🛠️ FERRAMENTAS DE DIAGNÓSTICO

### 1. Diagnóstico Completo

Analisa o DXF em detalhe e gera relatório:

```bash
python diagnostico_dxf_completo.py SEU_ARQUIVO.dxf
```

**Saída:**
- `DIAGNOSTICO_nome_YYYYMMDD_HHMMSS.json` - Relatório JSON
- `DIAGNOSTICO_nome_YYYYMMDD_HHMMSS.md` - Relatório Markdown

**O que é analisado:**
- ✅ Software de origem detectado
- ✅ Sistema de coordenadas
- ✅ Camadas encontradas
- ✅ Entidades (tubos, textos, blocos)
- ✅ Padrões de PV, DN, inclinação
- ✅ Problemas potenciais

### 2. Monitor em Tempo Real

Logga cada etapa da leitura:

```bash
python monitor_leitura_dxf.py --arquivo SEU_ARQUIVO.dxf
```

**Saída:**
- `MONITOR_LEITURA.log` - Log detalhado
- `MONITOR_nome_YYYYMMDD_HHMMSS.json` - Métricas de performance

### 3. Lote de DXFs

```bash
python monitor_leitura_dxf.py --lote --pasta ./MEUS_DXFS
```

---

## 📋 PADRÕES DE PV SUPORTADOS

O sistema reconhece múltiplos formatos de identificação de PVs:

| Formato | Exemplos | Software |
|---------|----------|----------|
| `PV_01`, `PV-1` | `PV_01`, `PV-23` | Genérico |
| `P.V. 1`, `P.V._1` | `P.V. 24`, `P.V._10` | ProSaneamento |
| `PI_01`, `PI-1` | `PI_05` | Genérico |
| `P.I. 1` | `P.I. 3` | ProSaneamento |
| `STRUCT_1` | `STRUCT_42` | Civil 3D |
| `POCO_1`, `POÇO-1` | `POCO_15` | QGIS |
| `1`, `2`, `3` | `123` | Numérico simples |

---

## 🔧 SOLUÇÃO DE PROBLEMAS

### Problema: "DXF sem camadas reconhecíveis"

**Causa:** DXF não tem camadas de tubo ou PV identificáveis

**Soluções:**
1. Verifique se o DXF contém linhas/polilinhas (tubos)
2. Verifique se há textos de identificação (PVs)
3. Execute o diagnóstico:
   ```bash
   python diagnostico_dxf_completo.py SEU_ARQUIVO.dxf
   ```

### Problema: "PVs insuficientes"

**Causa:** Menos de 2 PVs identificados

**Soluções:**
1. Verifique se os textos de PV seguem padrões reconhecíveis
2. Aumente a tolerância no código (atual: 20m)
3. Use fallback de PVs sintéticos (já implementado)

### Problema: "Tubos não encontrados"

**Causa:** Camadas de tubo não identificadas

**Soluções:**
1. Execute o diagnóstico para ver todas as camadas
2. Verifique se as camadas de tubo estão visíveis
3. Exporte o DXF com todas as camadas

---

## 📊 EXEMPLO DE DIAGNÓSTICO

```
======================================================================
  DIAGNÓSTICO COMPLETO DE DXF
  Suporte multi-software: ProSaneamento, Civil 3D, QGIS, etc.
======================================================================

[▶] Arquivo: _tmp_teteu_esgoto.dxf
[▶] Verificando dependências...
[✓] ezdxf: OK (Leitura nativa DXF)
[✓] geopandas: OK (Leitura via GDAL/OGR)
[✓] numpy: OK (Cálculos numéricos)
[✓] scipy: OK (Clustering de endpoints)
[▶] Lendo DXF via GDAL/OGR...
[✓] DXF carregado: 50239 entidades
  [▶] Analisando camadas...
    [ ] Total de camadas: 96
    [ ] TUBOS: 7 camadas
    [ ] TEXTOS: 18 camadas
  [▶] Detectando software de origem...
    [✓] Software detectado: ProSaneamento (score: 8)
  [▶] Analisando entidades...
    [ ] Point: 32523 (64.7%)
    [ ] LineString: 9601 (19.1%)
  [▶] Analisando tubos...
    [✓] Tubos válidos: 1925 | Extensão total: 32731.9m
  [▶] Analisando textos...
    [ ] Padrões encontrados:
      [ ]   PV: 502 ocorrências
      [ ]   DN: 336 ocorrências
      [ ]   INCL: 16 ocorrências
  [▶] Diagnosticando problemas...
    [✓] Nenhum problema crítico detectado
```

---

## 📝 ARQUIVOS GERADOS

Após processar um DXF, você encontra:

```
SAIDA_NOME_NUCLEO/
├── 01_NS/                    # Notas de Serviço
│   ├── NS_001.json
│   ├── NS_001.pdf
│   └── ...
├── 02_CIVIL3D/               # Saídas Civil 3D
│   ├── ESGOTO_NUCLEO.xml    (LandXML)
│   ├── CADASTRO_DXF/
│   ├── criar_pipe_network.py (Dynamo)
│   └── desenhar_rede.scr
├── 03_CADASTRO_NTS292/       # Cadastro NTS 292
│   └── CADASTRO_ASBUILT.dxf
├── 04_BIM_LOD500/            # BIM
│   └── MODELO.ifc
└── 05_CRONOGRAMA/            # MS Project
    └── CRONOGRAMA.xml
```

---

## 🎯 PRÓXIMOS PASSOS

1. **Teste com seus DXFs:**
   ```bash
   python diagnostico_dxf_completo.py SEU_DXF.dxf
   ```

2. **Processe a rede:**
   ```bash
   python construdata_pipeline.py SEU_DXF.dxf
   ```

3. **Verifique os resultados:**
   - Abra a pasta `SAIDA_NOME_NUCLEO/`
   - Confira `PIPELINE_RESULTADO.json`

4. **Reporte problemas:**
   - Envie o log `MONITOR_LEITURA.log`
   - Envie o diagnóstico `DIAGNOSTICO_*.json`

---

**Data:** 2026-03-27  
**Versão:** 5.0+  
**Autor:** Felipe Nery
