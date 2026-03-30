# Motor TETÉU ESGOTO v5 — Nova NS

## Visão Geral

Motor robusto para extração de redes de esgoto/água de arquivos DXF, com foco em **NÃO INVENTAR ELEMENTOS INEXISTENTES**.

## Princípios Fundamentais

### 1. NUNCA INVENTAR TUBOS
- Só são lidos tubos de layers **inequívocas** (`TUBO_PVC`, `PROLONG`, `CONDUTO`, `PIPE`)
- Layers com "ESGOTO" ou "AGUA" sozinhos **não** são considerados (podem ser pontos, texto, etc.)
- Layers de **PERFIL**, **DETALHE**, **CORTE** são ignoradas (são desenhos 2D, não tubos reais)
- Layers de **PONTOS**, **CAIXAS**, **IDENTIFICAÇÃO** são ignoradas (são labels, não tubos)

### 2. TUBOS REAIS → ENDPOINTS REAIS → PVs REAIS
```
Fluxo:
1. Ler tubos de layers válidas → geometria REAL do DXF
2. Extrair endpoints de cada tubo → posições REAIS dos PVs
3. Clusterizar endpoints (tolerância 3m) = PVs físicos
4. Associar textos de PV aos clusters → nomes dos PVs
5. Cada tubo liga 2 clusters → topologia EXATA
```

### 3. PVs SEM TEXTO = PVs GENÉRICOS
Se um cluster de endpoints não tem texto de PV próximo:
- Criar PV genérico: `PV_G{cluster_id}`
- Mantém a topologia real da rede
- Permite identificar onde faltam labels no DXF

## Como Usar

### Uso Básico

```python
from motor_teteu_esgoto import ler_dxf_teteu

# Ler DXF
pvs, trechos, ruas, meta = ler_dxf_teteu(
    r"C:\caminho\para\arquivo.dxf",
    modo="hibrido"  # ou "conservador"
)

# Acessar resultados
print(f"PVs: {len(pvs)}")
print(f"Trechos: {len(trechos)}")
print(f"Extensão: {meta['ext_total']:.0f}m")

# Exemplo de PV
pv = pvs["PV_1136"]
print(f"Coordenadas: ({pv['x']:.1f}, {pv['y']:.1f})")
print(f"CT: {pv.get('ct')}, CF: {pv.get('cf')}")

# Exemplo de trecho
t = trechos[0]
print(f"{t['pv_ini']} → {t['pv_fim']}: DN{t['dn_mm']}, {t['ext_m']:.1f}m")
```

### Modo de Operação

| Modo | Descrição |
|------|-----------|
| `"hibrido"` (padrão) | Tenta associar textos aos clusters, depois cria PVs genéricos para clusters restantes |
| `"conservador"` | Só usa PVs com textos associados, ignora clusters sem texto |

### Script de Linha de Comando

```bash
# Usar caminho padrão do TETÉU
python motor_teteu_esgoto.py

# Ou especificar arquivo
python motor_teteu_esgoto.py "C:\caminho\arquivo.dxf"
```

## Estrutura de Saída

### PVs (dicionário)
```python
{
    "PV_1136": {
        "x": 361260.9,
        "y": 7351678.8,
        "ct": 2.58,      # Cota de terreno (se disponível)
        "cf": 1.97,      # Cota de fundo
        "prof": 0.61,    # Profundidade
        "_generico": False  # True se foi criado automaticamente
    },
    "PV_G44": {
        "x": 361273.6,
        "y": 7351637.5,
        "ct": None,
        "cf": None,
        "prof": None,
        "_generico": True
    }
}
```

### Trechos (lista)
```python
[
    {
        "pv_ini": "PV_1136",
        "pv_fim": "PV_1126",
        "dn_mm": 150,
        "ext_m": 43.97,
        "decl_mm": 0.00159,
        "decl_pct": 0.159,
        "material": "PVC",
        "rua": "Sem Rua",
        "layer": "TUBO_PVC",
        "is_agua": False,
        "ct_ini": 2.58,
        "ct_fim": 2.10,
        "cf_ini": 1.97,
        "cf_fim": 1.55,
        "prof_ini": 0.61,
        "prof_fim": 0.55
    }
]
```

### Meta (dicionário)
```python
{
    "arquivo": "TETÉU_ESGOTO22.dxf",
    "tipo_rede": "ESGOTO",
    "n_pvs": 57,
    "n_trechos": 50,
    "ext_total": 708.0,
    "motor": "TETÉU_ESGOTO v5 (conservador)",
    "obs": "Clusters=57, Textos PV=61"
}
```

## Validação de Qualidade

O motor inclui validações para garantir que não está inventando elementos:

### 1. Validação de Coordenadas
- Rejeita coordenadas < 100km (são locais/perfil, não planta)

### 2. Validação de Tubos
- Rejeita tubos < 2m (são detalhes, não rede)
- Rejeita layers ambíguas

### 3. Validação de Topologia
- Verifica consistência: distância PV-PV ≈ extensão do tubo
- Reporta mismatches geométricos

### 4. Validação de PVs
- PVs genéricos são marcados com `_generico: True`
- Permite identificar onde faltam labels no DXF original

## Comparação: Versão Anterior vs Nova

| Métrica | Versão Anterior | Nova v5 |
|---------|----------------|---------|
| Tubos lidos | 108 (incluía perfis) | 64 (só TUBO_PVC) |
| PVs | 51 (perdia 6) | 57 (todos) |
| Trechos | 39 | 50 |
| Extensão | 611m | 708m |
| Ligações sem PV | 11 | 0 |
| Invenção de tubos | Risco alto | **ZERO** |

## Camadas Suportadas

### Layers de Tubos (inclusão)
- `TUBO_PVC`, `TUBO_PEAD`, `TUBO_FF`
- `PROLONG`, `PROLONGAMENTO`
- `CONDUTO`, `CONDUTO_FORCADO`
- `PIPE`, `PIPE_NETWORK`
- `COLETORA`, `RECALQUE`

### Layers de Pontos/Texto (exclusão)
- `PONTOS-*`, `CAIXAS-*`
- `PS_PONTOS_*`, `PS_IND_*`
- `PERFIL_*`, `DETALHE_*`, `CORTE_*`
- `TEXTO`, `COTA`, `DIMENSÃO`
- `QUADRAS`, `RUAS`, `HACHURA`

## Solução de Problemas

### "Nenhum tubo encontrado"
- Verifique se o DXF tem layer com nome claro de tubulação
- DXFs genéricos podem precisar de ajuste nos critérios

### "Muitos PVs genéricos"
- Os textos de PV podem estar em layer não padrão
- Aumente `TOL_LABEL_PV` no código (atual: 15m)

### "Trechos com DN=None"
- Textos de DN podem estar em layer diferente
- Verifique layers `PS_IND_DIAMETRO` ou similares

## Arquivos de Saída

O motor salva automaticamente:
- `{nome_arquivo}_RESULTADO.json` — Dados completos da rede

## Integração com Nova NS

Este motor é compatível com a plataforma Nova NS v5 e pode ser usado como:
- Leitor primário para DXFs ProSaneamento
- Fallback para DXFs genéricos
- Validador de qualidade de importação

## Autor e Licença

**Nova NS Versão 5** — 2026-03-29  
Desenvolvido para processamento robusto de projetos de água e esgoto.
