# PROMPT — Atualizar gerar_ns.py para NS Desenho Completa
## ConstruData HydroNetwork · FCN Construções e Saneamento
## Para Claude Code / VS Code

---

## OBJETIVO

Atualizar `gerar_ns.py` para que a NS de desenho (PDF A3/A4) combine os DOIS estilos:

**Estilo 1 (NS_PI_22_AO_PI_26):** Dados completos
- Tabela de materiais com quantidades (tubo, luva, anel, areia, brita, PV, ramal, caixa)
- Tabela de dados (Estaca, CT, CF, Prof, Dist, DN/Mat, Decl%)
- Box com info da NS (número, rua, PVs, DN, declividade, V, Tau, custo)
- Linha de resumo hidráulico (V, Tau, Qp, APROVADO/VERIFICAR, R$)

**Estilo 2 (NS_134_DESENHO):** Visual
- PLANTA com imagem de satélite de fundo (contextily/Google)
- PVs marcados com labels (nome, CT, CF)
- Tubo em vermelho sobre o satélite
- PERFIL LONGITUDINAL com preenchimento terreno (cor terra) e geratriz inferior (azul)

**O que quero: NS COMBINADA = Estilo 1 + Estilo 2 na mesma folha**

---

## LAYOUT DA NS COMBINADA (1 folha A3 paisagem)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐   │
│  │                          │  │  RESUMO DE MATERIAIS                 │   │
│  │   PLANTA COM SATÉLITE    │  │  ┌──────────┬────┬─────┐            │   │
│  │                          │  │  │ Material │ Un │ Qtd │            │   │
│  │   PV_26 ●────────● PV_27│  │  │ Tubo PVC │ br │  4  │            │   │
│  │   CT=-1.34       CT=-1.84│  │  │ Luva     │ pc │  3  │            │   │
│  │                          │  │  │ Anel     │ pc │  5  │            │   │
│  │   DN300 PVC              │  │  │ Areia    │ m³ │ 1.76│            │   │
│  │   L=55.1m               │  │  │ Brita    │ m³ │ 3.51│            │   │
│  │   i=0.21%               │  │  │ PV conc  │ pc │  1  │            │   │
│  │                          │  │  │ Ramal    │ pc │  1  │            │   │
│  │   (fundo: satélite real) │  │  │ Cx insp  │ pc │  1  │            │   │
│  │                          │  │  └──────────┴────┴─────┘            │   │
│  └──────────────────────────┘  │                                      │   │
│                                 │  PV Montante: PV_26                 │   │
│                                 │  PV Jusante: PV_27                  │   │
│                                 └──────────────────────────────────────┘   │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  PERFIL LONGITUDINAL                                                 │  │
│  │                                                                       │  │
│  │  ████████████████████████████████████████████ ← terreno (cor terra)  │  │
│  │  ████████CT=-1.34█████████████████CT=-1.84███                        │  │
│  │  ████████████████████████████████████████████                        │  │
│  │                                                                       │  │
│  │  ────────CF=-3.77───────────────────CF=-3.89── ← geratriz (azul)    │  │
│  │         DN300 PVC  i=0.21%  L=55.1m                                  │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Estaca │ CT(m)  │ CF(m)  │ Prof(m) │ Dist(m) │ DN/Mat        │Decl% │  │
│  │ PV_26  │ -1.337 │ -3.774 │  2.437  │         │               │      │  │
│  │ PV_27  │ -1.840 │ -3.888 │  2.048  │  55.10  │ DN300 PVC     │0.21% │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  V=0.XX m/s │ Tau=X.XX Pa │ Qp=XX.X L/s │ APROVADO │ R$ XX,XXX.XX       │
│                                                                            │
│  ┌─────────────────────┐                                                   │
│  │ NS 134              │  SE LIGA NA REDE                                  │
│  │ Rua: XXXX           │  FCN Construções e Saneamento                    │
│  │ PV_26 ao PV_27      │  CT 11481051 · SABESP                            │
│  │ DN300 PVC │ 55.1m   │  Data: DD/MM/AAAA                                │
│  │ V=X │ Tau=X │ R$ X  │                                                  │
│  └─────────────────────┘                                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## CÓDIGO DE REFERÊNCIA: O que já funciona no gerar_ns.py atual

```python
# A função gerar_ns_desenho() já existe e gera o Estilo 2 (satélite + perfil)
# Ela usa matplotlib para:
# 1. Subplot esquerdo: planta com contextily (satélite)
# 2. Subplot direito: perfil longitudinal com fill_between
#
# O que precisa ADICIONAR:
# 3. Tabela de materiais (canto superior direito)
# 4. Tabela de dados (Estaca/CT/CF/Prof/Dist/DN/Decl)
# 5. Box info NS (canto inferior direito)
# 6. Linha resumo hidráulico (rodapé)

# Funções existentes que já calculam tudo:
from gerar_ns import calc_manning, enriquecer_trechos, to_ll
```

---

## TABELA DE MATERIAIS — COMO CALCULAR

A tabela de materiais é calculada automaticamente pelo trecho:

```python
def calcular_materiais(trecho, pvs):
    """Calcula lista de materiais para 1 trecho."""
    dn = trecho.get("dn_mm", 200)
    ext = trecho.get("ext_m", 0)
    material = trecho.get("material", "PVC")
    
    # Tubo: barras de 6m
    n_barras = math.ceil(ext / 6)
    n_luvas = n_barras - 1
    n_aneis = n_barras + 1
    
    # Largura vala = 0.60m (DN≤200) ou 0.80m (DN>200)
    largura = 0.60 if dn <= 200 else 0.80
    
    # Profundidade média
    p0 = pvs.get(trecho.get("pv_ini"), {})
    p1 = pvs.get(trecho.get("pv_fim"), {})
    ct0 = p0.get("ct") or 0
    cf0 = p0.get("cf") or 0
    ct1 = p1.get("ct") or 0
    cf1 = p1.get("cf") or 0
    prof0 = abs(ct0 - cf0) if ct0 and cf0 else 1.5
    prof1 = abs(ct1 - cf1) if ct1 and cf1 else 1.5
    prof_med = (prof0 + prof1) / 2
    
    # Volumes
    vol_lastro = ext * largura * 0.10       # 10cm de areia
    vol_envoltorio = ext * largura * 0.30   # 30cm envolvendo tubo
    vol_brita = ext * largura * 0.20        # 20cm dreno
    
    materiais = [
        {"material": f"Tubo {material} DN{dn}mm", "un": "barra", "qtd": n_barras},
        {"material": f"Luva correr {material} DN{dn}mm", "un": "pc", "qtd": n_luvas},
        {"material": f"Anel borracha DN{dn}mm", "un": "pc", "qtd": n_aneis},
        {"material": "Pasta lubrificante", "un": "kg", "qtd": round(n_aneis * 0.03, 2)},
        {"material": "Areia lastro", "un": "m3", "qtd": round(vol_lastro, 2)},
        {"material": "Areia envoltorio", "un": "m3", "qtd": round(vol_envoltorio, 2)},
        {"material": "Brita dreno", "un": "m3", "qtd": round(vol_brita, 2)},
    ]
    
    # PV: 1 por trecho (montante)
    pv_ini_nome = trecho.get("pv_ini", "")
    if pv_ini_nome.upper().startswith(("PV", "P.V.")):
        materiais.append({"material": "PV concreto DN1200", "un": "pc", "qtd": 1})
    else:
        materiais.append({"material": "Caixa inspecao", "un": "pc", "qtd": 1})
    
    # Ramal + Caixa inspeção (1 por trecho)
    materiais.append({"material": f"Ramal esgoto DN100", "un": "pc", "qtd": 1})
    materiais.append({"material": "Caixa inspecao", "un": "pc", "qtd": 1})
    
    # Junção
    materiais.append({"material": f"Juncao Y {material} DN{dn}x100mm", "un": "pc", "qtd": 1})
    
    return materiais
```

---

## PERFIL LONGITUDINAL — COMO DESENHAR

O perfil do Estilo 2 (NS_134) já existe. Precisa adicionar:

```python
# No matplotlib, o perfil usa fill_between para terreno:
ax_perfil.fill_between(
    [0, dist],           # X: distância
    [ct_ini, ct_fim],    # Y superior: cota terreno
    y2=max(ct_ini, ct_fim) + 1,  # Teto
    color='#DEB887',     # Cor terra
    alpha=0.4,
    label='Terreno'
)

# Geratriz inferior (tubo):
ax_perfil.plot([0, dist], [cf_ini, cf_fim], 'b-', linewidth=2, label='Geratriz inferior')

# Labels nos PVs:
ax_perfil.annotate(f'{pv_ini}\nCT={ct_ini:.3f}\nCF={cf_ini:.3f}\nH={prof_ini:.2f}',
    xy=(0, ct_ini), fontsize=7, ha='center')
```

---

## SATÉLITE DE FUNDO — COMO FUNCIONA

```python
import contextily as cx

# No eixo da planta:
fig, (ax_planta, ax_perfil) = plt.subplots(1, 2, figsize=(16.5, 11.7))  # A3 paisagem

# Plotar PVs e tubo em coordenadas UTM:
ax_planta.plot([x0, x1], [y0, y1], 'r-', linewidth=3)  # tubo vermelho
ax_planta.plot(x0, y0, 'ro', markersize=8)  # PV
ax_planta.plot(x1, y1, 'ro', markersize=8)

# Labels
ax_planta.annotate(f'{pv_ini}\nCT={ct0:.2f}\nCF={cf0:.2f}', xy=(x0, y0))

# Satélite:
try:
    cx.add_basemap(ax_planta, crs='EPSG:31983',
        source=cx.providers.Esri.WorldImagery,
        zoom=18, attribution='')
except:
    pass  # Se não tiver internet, fica sem satélite
```

---

## SAÍDAS MANTIDAS (não alterar)

O `gerar_ns.py` continua gerando TUDO que já gera:
1. `gerar_ns_a4()` → PDF A4 simples (nota de campo) — MANTER
2. `gerar_ns_desenho()` → PDF A3 com satélite+perfil — **ATUALIZAR (adicionar materiais+tabela+custo)**
3. `gerar_html()` → HTML Leaflet interativo — MANTER
4. `gerar_geojson()` → GeoJSON da rede — MANTER

A mudança é SÓ no `gerar_ns_desenho()`.

---

## RESUMO HIDRÁULICO (rodapé)

```
V=8.922m/s | Tau=358.21Pa | Qp=280.285L/s | APROVADO | R$ 14,919.08
```

Lógica de aprovação:
```python
status = "APROVADO"
alertas = []
if v < 0.6: alertas.append("V < 0.6 m/s")
if v > 5.0: alertas.append("V > 5.0 m/s")  
if tau < 1.0: alertas.append("τ < 1.0 Pa")
if decl_mm < 0: alertas.append("Decl negativa")
if alertas:
    status = "VERIFICAR: " + ", ".join(alertas)
```

---

## BOX INFO NS (canto inferior direito)

```
┌─────────────────────────┐
│ NS060                   │
│ Rua: Sem Rua            │
│ PI 22 ao PI 26          │
│ DN200 Tubo PVC | 21.9m  │
│ Decl: 73.029%           │
│ V=8.92m/s | Tau=358.2Pa │
│ Custo: R$ 14,919.08     │
│                         │
│ SE LIGA NA REDE         │
│ 18/03/2026              │
└─────────────────────────┘
```

---

## CUSTO — COMO CALCULAR

```python
from motor_custo import custo_trecho
c = custo_trecho(trecho, pvs)
custo_total = c["total"]  # R$ com BDI 25%
```

Ou simplificado: `custo = ext_m * 910`

---

## CONTRATO ATIVO

```python
from motor_contratos import get_contrato
contrato = get_contrato()
# contrato["nome"] → "SE LIGA NA REDE Santos"
# contrato["empresa"] → "FCN Construções e Saneamento"  
# contrato["numero"] → "11481051"
```

Se não tem contrato ativo, usar defaults:
- Empresa: FCN Construções e Saneamento
- Contrato: SE LIGA NA REDE

---

## CHECKLIST

```
[ ] gerar_ns_desenho() gera PDF A3 paisagem
[ ] Lado esquerdo: PLANTA com satélite (contextily) + PVs + tubo vermelho + labels
[ ] Lado direito superior: TABELA DE MATERIAIS (calculada por calcular_materiais())
[ ] Centro: PERFIL LONGITUDINAL com terreno preenchido + geratriz azul
[ ] Abaixo do perfil: TABELA DE DADOS (Estaca, CT, CF, Prof, Dist, DN/Mat, Decl%)
[ ] Rodapé: V | Tau | Qp | APROVADO/VERIFICAR | R$ custo
[ ] Box info NS no canto (número, rua, PVs, DN, V, Tau, custo, data)
[ ] Manter gerar_ns_a4() intacta (PDF simples de campo)
[ ] Manter gerar_html() intacta (Leaflet interativo)
[ ] Manter gerar_geojson() intacta
[ ] Manter formato pvs+trechos sem alteração
[ ] CT pode ser negativo (Santos — nível do mar)
[ ] Empresa: FCN Construções e Saneamento (NUNCA FCN)
```
