# PROMPT — Atualizar gerar_ns.py para gerar NS com 2 estilos de desenho
## ConstruData HydroNetwork · FCN Construções e Saneamento

---

## OBJETIVO

Atualizar `gerar_ns.py` para que cada NS gere **3 PDFs** (não apenas 1):

1. **NS_{id}.pdf** — PDF A4 texto (já existe, manter)
2. **NS_{id}_DESENHO.pdf** — PDF A3 COMPLETO (planta + materiais + perfil + tabela + custo)
3. **NS_{id}_SAT.pdf** — PDF A3 com SATÉLITE + perfil longitudinal limpo

Mais: manter os outputs existentes (JSON, HTML Leaflet, GeoJSON).

---

## REFERÊNCIA VISUAL — O QUE CADA PDF TEM QUE TER

### PDF 2: NS_DESENHO.pdf (estilo NS_PI_22_AO_PI_26)

Layout A3 paisagem dividido em 4 quadrantes:

```
┌──────────────────────────────┬─────────────────────────────┐
│                              │    RESUMO DE MATERIAIS      │
│     PLANTA                   │                             │
│     (matplotlib, UTM,        │  Material      Un    Qtd    │
│      PVs com labels,         │  Tubo PVC DN200 barra  4   │
│      tubo vermelho,          │  Luva correr    pc     3   │
│      DN + i% + L)            │  Anel borracha  pc     5   │
│                              │  Pasta lubr.    kg     0.15│
│                              │  Areia lastro   m3     1.76│
│                              │  Areia envolt.  m3     5.27│
│                              │  Brita dreno    m3     3.51│
│                              │  PV concreto    pc     1   │
│                              │  Ramal esgoto   pc     1   │
│                              │  Caixa insp.    pc     1   │
│                              │  Junção Y       pc     1   │
│                              │  PV Montante: nome         │
│                              │  PV Jusante: nome          │
├──────────────────────────────┴─────────────────────────────┤
│                                                            │
│     PERFIL LONGITUDINAL                                    │
│     (matplotlib, CT verde, CF azul/vermelho,               │
│      PV labels com CT/CF/H, DN I=X% L=Xm)                │
│                                                            │
├────────────────────────────────────────────┬────────────────┤
│  TABELA                                    │   NS{id}       │
│  Estaca  CT(m)  CF(m) Prof(m) Dist DN/Mat │   Rua: X       │
│  PV_XX  105.37 104.77 0.600               │   PV_X ao PV_Y │
│  PV_YY  121.39 120.79 0.600  21.9 DN200  │   DN200 PVC     │
│                                            │   Decl: X%     │
│                                            │   V=X Tau=X    │
│  V=X | Tau=X | Qp=X | STATUS | R$ X      │   Custo: R$ X  │
│                                            │   SE LIGA REDE │
│                                            │   data         │
└────────────────────────────────────────────┴────────────────┘
```

### PDF 3: NS_SAT.pdf (estilo NS_134_Pantanal)

Layout A3 paisagem dividido em 2 metades:

```
┌──────────────────────────────┬──────────────────────────────┐
│                              │                              │
│     PLANTA COM SATÉLITE      │   PERFIL LONGITUDINAL        │
│     (contextily sat tile)    │                              │
│                              │   Terreno (preenchido bege)  │
│     PV labels em vermelho    │   Geratriz inferior (azul)   │
│     Tubo em vermelho         │                              │
│     Coordenadas UTM nos      │   PV labels com CT e CF      │
│     eixos                    │   DN + material + extensão   │
│                              │                              │
│     Título:                  │   Eixo X: Distância (m)      │
│     "PLANTA - NS {id} -     │   Eixo Y: Cota (m)           │
│      {nucleo} - Esgoto"     │                              │
│                              │   Título:                    │
│                              │   "PERFIL LONGITUDINAL -     │
│                              │    NS {id}"                  │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

---

## DADOS QUE JÁ EXISTEM NOS TRECHOS

Cada trecho enriquecido (`enriquecer_trechos()`) já tem:

```python
{
    "pv_ini": "PV_26",
    "pv_fim": "PV_27",
    "dn_mm": 300,
    "ext_m": 55.1,
    "decl_mm": 2.07,        # ‰ (converter pra % dividindo por 10)
    "material": "PVC",
    "tipo": "esgoto",
    "v_ms": 0.456,           # Manning
    "q_ls": 32.1,
    "tau_pa": 5.08,
    "rua": "Rua X",
    # PVs acessíveis via pvs[pv_ini] e pvs[pv_fim]:
    #   x, y (UTM), ct, cf
}
```

---

## CÁLCULO DO RESUMO DE MATERIAIS

Para cada trecho, calcular automaticamente:

```python
def calcular_materiais(tr, pvs):
    dn = tr["dn_mm"]
    ext = tr["ext_m"]
    
    # Tubo: barras de 6m
    n_barras = math.ceil(ext / 6)
    
    materiais = [
        (f"Tubo PVC DN{dn}mm", "barra", n_barras),
        (f"Luva correr PVC DN{dn}mm", "pç", n_barras - 1),
        (f"Anel borracha DN{dn}mm", "pç", n_barras + 1),
        ("Pasta lubrificante", "kg", round(n_barras * 0.04, 2)),
        ("Areia lastro", "m³", round(ext * 0.08, 2)),       # 0.08 m³/m
        ("Areia envoltória", "m³", round(ext * 0.24, 2)),    # 0.24 m³/m
        ("Brita dreno", "m³", round(ext * 0.16, 2)),         # 0.16 m³/m
        ("PV concreto DN1200", "pç", 1),                      # 1 por trecho (montante)
    ]
    
    # Ramal + caixa inspeção (se esgoto)
    if tr.get("tipo") == "esgoto":
        materiais.append(("Ramal esgoto DN100", "pç", 1))
        materiais.append(("Caixa inspeção", "pç", 1))
        materiais.append((f"Junção Y PVC DN{dn}x100mm", "pç", 1))
    
    return materiais
```

---

## PERFIL LONGITUDINAL — COMO DESENHAR

```python
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')

def desenhar_perfil(ax, tr, pvs):
    p0 = pvs[tr["pv_ini"]]
    p1 = pvs[tr["pv_fim"]]
    ext = tr["ext_m"]
    
    # Terreno (verde)
    ax.plot([0, ext], [p0["ct"], p1["ct"]], 'g-', linewidth=2, label="CT Terreno")
    ax.fill_between([0, ext], [p0["ct"], p1["ct"]], alpha=0.1, color='green')
    
    # Geratriz inferior (azul ou vermelho)
    ax.plot([0, ext], [p0["cf"], p1["cf"]], 'b-', linewidth=2.5, label="CF Geratriz Inf.")
    
    # Labels PV
    for x, pv_nome, ct, cf in [(0, tr["pv_ini"], p0["ct"], p0["cf"]),
                                 (ext, tr["pv_fim"], p1["ct"], p1["cf"])]:
        prof = ct - cf
        ax.annotate(f"{pv_nome}\nCT={ct:.2f}\nCF={cf:.2f}\nH={prof:.2f}",
                    xy=(x, ct), fontsize=7, ha='center',
                    bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
        # Linha vertical PV
        ax.plot([x, x], [cf, ct], 'r-', linewidth=1.5)
        ax.plot(x, ct, 'go', markersize=6)  # ponto CT
        ax.plot(x, cf, 'ro', markersize=6)  # ponto CF
    
    # Texto DN no meio
    xm = ext / 2
    ym = (p0["cf"] + p1["cf"]) / 2
    decl_pct = tr.get("decl_mm", 0) / 10  # ‰ → %
    ax.text(xm, ym + 0.3, f"DN{tr['dn_mm']} I={decl_pct:.2f}%\nL={ext:.1f}m",
            ha='center', fontsize=8, color='blue', fontweight='bold')
    
    ax.set_xlabel("Distância (m)")
    ax.set_ylabel("Cota (m)")
    ax.legend(fontsize=7)
    ax.grid(True, alpha=0.3)
```

---

## PLANTA COM SATÉLITE (contextily)

```python
import contextily as cx

def desenhar_planta_sat(ax, tr, pvs, all_trechos=None):
    p0 = pvs[tr["pv_ini"]]
    p1 = pvs[tr["pv_fim"]]
    
    # Plot tubo em vermelho
    ax.plot([p0["x"], p1["x"]], [p0["y"], p1["y"]], 'r-', linewidth=3, zorder=5)
    
    # PVs em vermelho
    for pv_nome, pv in [(tr["pv_ini"], p0), (tr["pv_fim"], p1)]:
        ax.plot(pv["x"], pv["y"], 'ro', markersize=8, zorder=6)
        ax.annotate(pv_nome, (pv["x"], pv["y"]), fontsize=8, color='red',
                   fontweight='bold', ha='center', va='bottom',
                   xytext=(0, 10), textcoords='offset points', zorder=7)
    
    # Margem
    dx = abs(p1["x"] - p0["x"])
    dy = abs(p1["y"] - p0["y"])
    margin = max(dx, dy, 50) * 0.5
    ax.set_xlim(min(p0["x"], p1["x"]) - margin, max(p0["x"], p1["x"]) + margin)
    ax.set_ylim(min(p0["y"], p1["y"]) - margin, max(p0["y"], p1["y"]) + margin)
    
    # Satélite (EPSG:31983 → tiles)
    try:
        cx.add_basemap(ax, crs="EPSG:31983",
                      source=cx.providers.Esri.WorldImagery, zoom=18)
    except:
        pass  # sem internet, fica sem satélite
    
    ax.set_title(f"PLANTA - NS {tr.get('ns_id','')} - {tr.get('nucleo','')} - Esgoto",
                fontsize=10, fontweight='bold')
```

---

## FUNÇÃO PRINCIPAL A CRIAR/ATUALIZAR

```python
def gerar_ns_desenho(ns_id, trecho, pvs, nucleo, out_path):
    """
    Gera PDF A3 COMPLETO: planta + materiais + perfil + tabela + custo.
    Estilo: NS_PI_22_AO_PI_26_DESENHO.pdf
    """
    fig = plt.figure(figsize=(16.54, 11.69))  # A3 paisagem
    gs = fig.add_gridspec(3, 2, height_ratios=[1.2, 1, 0.6], hspace=0.3, wspace=0.3)
    
    # Quadrante 1: PLANTA (matplotlib sem satélite)
    ax_planta = fig.add_subplot(gs[0, 0])
    desenhar_planta_simples(ax_planta, trecho, pvs)
    
    # Quadrante 2: RESUMO DE MATERIAIS (tabela)
    ax_mat = fig.add_subplot(gs[0, 1])
    materiais = calcular_materiais(trecho, pvs)
    desenhar_tabela_materiais(ax_mat, materiais, trecho)
    
    # Linha inteira: PERFIL LONGITUDINAL
    ax_perfil = fig.add_subplot(gs[1, :])
    desenhar_perfil(ax_perfil, trecho, pvs)
    
    # Quadrante inferior esquerdo: TABELA ESTACAS
    ax_tab = fig.add_subplot(gs[2, 0])
    desenhar_tabela_estacas(ax_tab, trecho, pvs)
    
    # Quadrante inferior direito: INFO BOX
    ax_info = fig.add_subplot(gs[2, 1])
    desenhar_info_box(ax_info, ns_id, trecho, pvs, nucleo)
    
    # Footer
    v = trecho.get("v_ms", 0)
    tau = trecho.get("tau_pa", 0)
    q = trecho.get("q_ls", 0)
    custo = trecho.get("ext_m", 0) * 910
    status = "APROVADO" if (0.6 <= v <= 5 and tau >= 1) else "VERIFICAR"
    fig.text(0.5, 0.02,
             f"V={v:.3f}m/s | Tau={tau:.2f}Pa | Qp={q:.3f}L/s | {status} | R$ {custo:,.2f}",
             ha='center', fontsize=10, fontweight='bold',
             color='blue' if status == "APROVADO" else 'red')
    
    fig.savefig(out_path, dpi=150, bbox_inches='tight')
    plt.close(fig)


def gerar_ns_sat(ns_id, trecho, pvs, nucleo, out_path):
    """
    Gera PDF A3 com SATÉLITE + perfil limpo.
    Estilo: NS_134_DESENHO.pdf (Pantanal)
    """
    fig, (ax_planta, ax_perfil) = plt.subplots(1, 2, figsize=(16.54, 11.69))
    
    # Esquerda: PLANTA COM SATÉLITE
    desenhar_planta_sat(ax_planta, trecho, pvs)
    
    # Direita: PERFIL LONGITUDINAL (com fill)
    desenhar_perfil_limpo(ax_perfil, trecho, pvs)
    
    fig.savefig(out_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
```

---

## ATUALIZAR processar_nucleo() PARA GERAR OS 3 PDFs

```python
# No loop de geração por trecho:
for i, tr in enumerate(trechos_enr):
    ns_id = i + 1
    
    # PDF 1: texto A4 (já existe)
    gerar_ns_a4(ns_id, tr, pvs, nucleo, f"{ns_dir}/NS_{ns_id:03d}.pdf")
    
    # PDF 2: desenho completo A3 (NOVO)
    gerar_ns_desenho(ns_id, tr, pvs, nucleo, f"{ns_dir}/NS_{ns_id:03d}_DESENHO.pdf")
    
    # PDF 3: satélite + perfil A3 (NOVO)
    gerar_ns_sat(ns_id, tr, pvs, nucleo, f"{ns_dir}/NS_{ns_id:03d}_SAT.pdf")
    
    # JSON (já existe)
    # HTML (já existe)
```

---

## OBSERVAÇÕES IMPORTANTES

1. **Cotas negativas:** Santos tem CT abaixo do nível do mar (CT=-1.337). O perfil tem que funcionar com cotas negativas.
2. **Profundidade:** H = CT - CF. Mesmo com cotas negativas, H é sempre positivo.
3. **Declividade:** Na planilha está em ‰ (por mil). No PDF mostra em % (dividir por 10).
4. **Materiais:** Calcular automaticamente pela extensão do trecho + DN.
5. **Custo:** Usar R$ 910/m do contrato ou `motor_custo.custo_trecho()` se disponível.
6. **Satélite:** Usar contextily com `cx.providers.Esri.WorldImagery`. Se sem internet, planta fica sem fundo.
7. **Cores:** Terreno=verde, Geratriz=azul, Tubo na planta=vermelho, PV=círculo vermelho.
8. **NUNCA** "FCN Construções e Saneamento" — sempre **FCN Construções e Saneamento** no carimbo.

---

## DEPENDÊNCIAS ADICIONAIS

```bash
pip install contextily matplotlib
```

---

## SAÍDA ESPERADA POR TRECHO

```
NS_001.pdf           ← A4 texto (já existe)
NS_001.json          ← JSON dados (já existe)
NS_001.html          ← HTML Leaflet (já existe)
NS_001_DESENHO.pdf   ← A3 planta+materiais+perfil+tabela+custo (NOVO)
NS_001_SAT.pdf       ← A3 satélite+perfil limpo (NOVO)
```

5 arquivos por trecho. Para 180 trechos = 900 arquivos.
