# PROMPT DEFINITIVO — Claude Code
# ConstruData HydroNetwork V4 · FCN Construções e Saneamento
# LEIA TUDO ANTES DE TOCAR EM QUALQUER ARQUIVO

---

> ⛔ NUNCA "FCN Construções e Saneamento" — sempre **FCN Construções e Saneamento**
> ⛔ NUNCA output só JSON — sempre **JSON + XLSX profissional**
> ⛔ NUNCA LLM genérica — sempre **prompt especializado com dados reais**

---

## CONTEXTO

Você está trabalhando na plataforma ConstruData HydroNetwork.
São 22 scripts Python + 7 HTML + 1 GUI desktop + 6 prompts .md.
Total: ~14.000 linhas de código.

A plataforma lê projetos de saneamento (DXF/DWG/XML/JSON/PDF),
converte em formato interno (pvs + trechos), e gera todos os
entregáveis: NS, Civil 3D, IFC, cronograma, medição, custos, etc.

**Localização dos arquivos:**
```
C:\Users\felip\Downloads\NOVA NS Versao 5\PACOTE_V4\
  scripts/    ← 22 .py
  html/       ← 7 .html
  gui/        ← construdata_gui.py
```

---

## O QUE VOCÊ PRECISA FAZER (8 tarefas)

### TAREFA 1: Integrar gerar_xlsx.py em TODOS os módulos

O script `gerar_xlsx.py` já existe e gera XLSX profissional.
Agora cada motor que antes gerava só JSON precisa TAMBÉM gerar XLSX.

**Atualizar cada motor para chamar gerar_xlsx no final:**

```python
# motor_lean_lps.py → no final de gerar_relatorio_lean_lps():
def gerar_relatorio_lean_lps(pvs, trechos, dados_exec=None, nucleo=""):
    rel = { ... }  # cálculo existente (NÃO MEXER)
    
    # ADICIONAR no final:
    try:
        from gerar_xlsx import gerar_xlsx_lean
        xlsx_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                  f"LEAN_LPS_{nucleo.replace(' ','_')}.xlsx")
        gerar_xlsx_lean(rel, pvs, trechos, nucleo, xlsx_path)
        rel["xlsx_path"] = xlsx_path
    except Exception as e:
        rel["xlsx_error"] = str(e)
    
    return rel
```

**Fazer o mesmo em:**

| Motor | Função a atualizar | XLSX a chamar |
|-------|-------------------|---------------|
| `motor_lean_lps.py` | `gerar_relatorio_lean_lps()` | `gerar_xlsx_lean()` |
| `motor_medicao.py` | `gerar_curva_s()` | `gerar_xlsx_curva_s()` |
| `motor_microplanejamento.py` | `micro_planejar_nucleo()` | `gerar_xlsx_microplan()` |
| `motor_custo.py` | `custo_nucleo()` | `gerar_xlsx_custos()` |
| `motor_perdas.py` | `gerar_relatorio_perdas()` | `gerar_xlsx_perdas()` |

O `gerar_xlsx.py` já tem todas essas funções implementadas e testadas.
Só precisa importar e chamar no final de cada motor.

---

### TAREFA 2: Atualizar gerar_ns.py para 5 outputs por trecho

Atualmente gera só PDF A4. Precisa gerar 5 arquivos por trecho:

```python
# Em processar_nucleo() ou onde o loop de trechos roda:
for i, tr in enumerate(trechos_enr):
    ns_id = i + 1
    base = os.path.join(ns_dir, f"NS_{ns_id:03d}")
    
    # 1. PDF A4 texto (JÁ EXISTE — manter)
    gerar_ns_a4(ns_id, tr, pvs, nucleo, f"{base}.pdf")
    
    # 2. PDF A3 DESENHO (planta + materiais + perfil + tabela + custo)
    gerar_ns_desenho(ns_id, tr, pvs, nucleo, f"{base}_DESENHO.pdf")
    
    # 3. PDF A3 SAT (satélite contextily + perfil limpo)
    gerar_ns_sat(ns_id, tr, pvs, nucleo, f"{base}_SAT.pdf")
    
    # 4. HTML Leaflet (JÁ EXISTE — verificar que está sendo chamado)
    gerar_html(ns_id, tr, pvs, trechos_enr, nucleo, f"{base}.html")
    
    # 5. JSON dados (JÁ EXISTE — verificar)
    with open(f"{base}.json", 'w') as f:
        json.dump({...}, f)

# NO FINAL: Mapa geral da rede (RESTAURAR — sumiu)
gerar_html_rede_geral(trechos_enr, pvs, nucleo, 
                       os.path.join(ns_dir, "REDE_GERAL.html"))
gerar_geojson(trechos_enr, pvs, os.path.join(ns_dir, "rede.geojson"))
```

**Criar as funções gerar_ns_desenho() e gerar_ns_sat():**

#### gerar_ns_desenho() — Estilo NS_PI_22 (A3 completo)

```python
def gerar_ns_desenho(ns_id, trecho, pvs, nucleo, out_path):
    """PDF A3: planta + materiais + perfil + tabela + custo."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    
    fig = plt.figure(figsize=(16.54, 11.69))  # A3 paisagem
    gs = fig.add_gridspec(3, 2, height_ratios=[1.2, 1, 0.6], hspace=0.3, wspace=0.3)
    
    p0 = pvs[trecho["pv_ini"]]
    p1 = pvs[trecho["pv_fim"]]
    ext = trecho["ext_m"]
    dn = trecho["dn_mm"]
    mat = trecho.get("material", "PVC")
    decl_pct = trecho.get("decl_mm", 0) / 10
    v = trecho.get("v_ms", 0)
    tau = trecho.get("tau_pa", 0)
    q = trecho.get("q_ls", 0)
    custo = ext * 910
    status = "APROVADO" if (0.6 <= v <= 5 and tau >= 1) else "VERIFICAR"
    
    # ── QUADRANTE 1: PLANTA ──
    ax1 = fig.add_subplot(gs[0, 0])
    ax1.plot([p0["x"], p1["x"]], [p0["y"], p1["y"]], 'r-', linewidth=3)
    for nome, pv in [(trecho["pv_ini"], p0), (trecho["pv_fim"], p1)]:
        ax1.plot(pv["x"], pv["y"], 'bo', markersize=8)
        ax1.annotate(f'{nome}\nCT={pv.get("ct",0):.2f}\nCF={pv.get("cf",0):.2f}',
                    (pv["x"], pv["y"]), fontsize=7, ha='center',
                    bbox=dict(boxstyle='round', facecolor='lightyellow'))
    xm = (p0["x"]+p1["x"])/2; ym = (p0["y"]+p1["y"])/2
    ax1.text(xm, ym, f'DN{dn} Tubo {mat}\nL={ext:.1f}m\ni={decl_pct:.2f}%',
            ha='center', fontsize=8, color='red', fontweight='bold',
            bbox=dict(facecolor='white', alpha=0.8))
    ax1.set_title(f"PLANTA - {trecho.get('rua', 'Sem Rua')}", fontweight='bold')
    ax1.ticklabel_format(useOffset=True)
    ax1.set_aspect('equal')
    ax1.grid(True, alpha=0.3)
    
    # ── QUADRANTE 2: MATERIAIS ──
    ax2 = fig.add_subplot(gs[0, 1])
    ax2.axis('off')
    ax2.set_title("RESUMO DE MATERIAIS", fontweight='bold')
    
    import math
    n_barras = math.ceil(ext / 6)
    materiais = [
        (f"Tubo PVC DN{dn}mm", "barra", n_barras),
        (f"Luva correr PVC DN{dn}mm", "pç", max(1, n_barras - 1)),
        (f"Anel borracha DN{dn}mm", "pç", n_barras + 1),
        ("Pasta lubrificante", "kg", round(n_barras * 0.04, 2)),
        ("Areia lastro", "m³", round(ext * 0.08, 2)),
        ("Areia envoltória", "m³", round(ext * 0.24, 2)),
        ("Brita dreno", "m³", round(ext * 0.16, 2)),
        ("PV concreto DN1200", "pç", 1),
        ("Ramal esgoto DN100", "pç", 1),
        ("Caixa inspeção", "pç", 1),
        (f"Junção Y PVC DN{dn}x100mm", "pç", 1),
    ]
    
    table_data = [["Material", "Un", "Qtd"]] + [[m, u, str(q)] for m, u, q in materiais]
    table_data.append([f"PV Montante: {trecho['pv_ini']}", "", ""])
    table_data.append([f"PV Jusante: {trecho['pv_fim']}", "", ""])
    
    table = ax2.table(cellText=table_data, loc='center', cellLoc='left')
    table.auto_set_font_size(False)
    table.set_fontsize(7)
    table.scale(1, 1.3)
    # Header azul
    for j in range(3):
        table[0, j].set_facecolor('#003366')
        table[0, j].set_text_props(color='white', fontweight='bold')
    
    # ── PERFIL LONGITUDINAL ──
    ax3 = fig.add_subplot(gs[1, :])
    ct0, cf0 = p0.get("ct", 0), p0.get("cf", 0)
    ct1, cf1 = p1.get("ct", 0), p1.get("cf", 0)
    
    ax3.fill_between([0, ext], [ct0, ct1], alpha=0.1, color='green')
    ax3.plot([0, ext], [ct0, ct1], 'g-', linewidth=2, label="CT Terreno")
    ax3.plot([0, ext], [cf0, cf1], 'r-', linewidth=2.5, label="CF Geratriz Inf.")
    
    for x, nome, ct, cf in [(0, trecho["pv_ini"], ct0, cf0), (ext, trecho["pv_fim"], ct1, cf1)]:
        prof = ct - cf
        ax3.plot([x, x], [cf, ct], 'b-', linewidth=1.5)
        ax3.plot(x, ct, 'go', markersize=6)
        ax3.plot(x, cf, 'ro', markersize=6)
        ax3.annotate(f'{nome}\nCT={ct:.2f}\nCF={cf:.2f}\nH={prof:.2f}',
                    xy=(x, ct), fontsize=7, ha='center', va='bottom',
                    bbox=dict(boxstyle='round', facecolor='white', alpha=0.9))
    
    xm = ext / 2; ym = (cf0 + cf1) / 2
    ax3.annotate(f'DN{dn} I={decl_pct:.2f}%\nL={ext:.1f}m', xy=(xm, ym),
                fontsize=9, ha='center', color='blue', fontweight='bold',
                arrowprops=dict(arrowstyle='->', color='blue'))
    
    ax3.set_xlabel("Distância (m)")
    ax3.set_ylabel("Cota (m)")
    ax3.set_title(f"{trecho['pv_ini']} → {trecho['pv_fim']} | L={ext:.1f}m | DN{dn} Tubo {mat}")
    ax3.legend(fontsize=7)
    ax3.grid(True, alpha=0.3)
    
    # ── TABELA ESTACAS ──
    ax4 = fig.add_subplot(gs[2, 0])
    ax4.axis('off')
    prof0 = ct0 - cf0; prof1 = ct1 - cf1
    tab_data = [
        ["Estaca", "CT(m)", "CF(m)", "Prof(m)", "Dist(m)", "DN/Mat", "Decl(%)"],
        [trecho["pv_ini"], f"{ct0:.3f}", f"{cf0:.3f}", f"{prof0:.3f}", "", "", ""],
        [trecho["pv_fim"], f"{ct1:.3f}", f"{cf1:.3f}", f"{prof1:.3f}", f"{ext:.2f}", f"DN{dn} Tubo {mat}", f"{decl_pct:.2f}%"],
    ]
    t4 = ax4.table(cellText=tab_data, loc='center', cellLoc='center')
    t4.auto_set_font_size(False); t4.set_fontsize(8); t4.scale(1, 1.5)
    for j in range(7):
        t4[0, j].set_facecolor('#003366')
        t4[0, j].set_text_props(color='white', fontweight='bold')
    
    # ── INFO BOX ──
    ax5 = fig.add_subplot(gs[2, 1])
    ax5.axis('off')
    rua = trecho.get("rua", "Sem Rua")
    info = (f"NS{ns_id:03d}\n\n"
            f"Rua: {rua}\n"
            f"{trecho['pv_ini']} ao {trecho['pv_fim']}\n"
            f"DN{dn} Tubo {mat} | {ext:.1f}m\n"
            f"Decl: {decl_pct:.3f}%\n"
            f"V={v:.2f}m/s | Tau={tau:.1f}Pa\n\n"
            f"Custo: R$ {custo:,.2f}\n\n"
            f"SE LIGA NA REDE\n"
            f"{datetime.now().strftime('%d/%m/%Y')}")
    ax5.text(0.5, 0.5, info, ha='center', va='center', fontsize=9,
            fontfamily='monospace', bbox=dict(boxstyle='round', facecolor='lightyellow'),
            transform=ax5.transAxes)
    
    # Footer
    fig.text(0.5, 0.01,
             f"V={v:.3f}m/s | Tau={tau:.2f}Pa | Qp={q:.3f}L/s | {status} | R$ {custo:,.2f}",
             ha='center', fontsize=10, fontweight='bold',
             color='blue' if status == "APROVADO" else 'red')
    
    fig.savefig(out_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
```

#### gerar_ns_sat() — Estilo NS_134 (satélite + perfil)

```python
def gerar_ns_sat(ns_id, trecho, pvs, nucleo, out_path):
    """PDF A3: satélite contextily + perfil longitudinal limpo."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16.54, 11.69))
    
    p0 = pvs[trecho["pv_ini"]]
    p1 = pvs[trecho["pv_fim"]]
    ext = trecho["ext_m"]
    dn = trecho["dn_mm"]
    mat = trecho.get("material", "PVC")
    
    # ── ESQUERDA: PLANTA COM SATÉLITE ──
    ax1.plot([p0["x"], p1["x"]], [p0["y"], p1["y"]], 'r-', linewidth=3, zorder=5)
    for nome, pv in [(trecho["pv_ini"], p0), (trecho["pv_fim"], p1)]:
        ax1.plot(pv["x"], pv["y"], 'ro', markersize=10, zorder=6)
        ax1.annotate(nome, (pv["x"], pv["y"]), fontsize=9, color='red',
                    fontweight='bold', ha='center', va='bottom',
                    xytext=(0, 12), textcoords='offset points', zorder=7,
                    bbox=dict(facecolor='white', alpha=0.8))
    
    dx = abs(p1["x"] - p0["x"]); dy = abs(p1["y"] - p0["y"])
    margin = max(dx, dy, 50) * 0.6
    ax1.set_xlim(min(p0["x"], p1["x"]) - margin, max(p0["x"], p1["x"]) + margin)
    ax1.set_ylim(min(p0["y"], p1["y"]) - margin, max(p0["y"], p1["y"]) + margin)
    
    try:
        import contextily as cx
        cx.add_basemap(ax1, crs="EPSG:31983", source=cx.providers.Esri.WorldImagery, zoom=18)
    except:
        ax1.set_facecolor('#f0f0f0')
    
    ax1.set_title(f"PLANTA - NS {ns_id} - {nucleo} - Esgoto", fontweight='bold')
    
    # ── DIREITA: PERFIL LONGITUDINAL LIMPO ──
    ct0, cf0 = p0.get("ct", 0), p0.get("cf", 0)
    ct1, cf1 = p1.get("ct", 0), p1.get("cf", 0)
    
    # Terreno (preenchido bege)
    ax2.fill_between([0, ext], [ct0, ct1], y2=max(ct0, ct1) + 0.5,
                     color='#DEC4A0', alpha=0.4, label="Terreno")
    ax2.plot([0, ext], [ct0, ct1], 'k-', linewidth=1.5)
    
    # Geratriz inferior (azul)
    ax2.plot([0, ext], [cf0, cf1], 'b-', linewidth=2.5, label="Geratriz inferior")
    
    # Labels PV
    ax2.annotate(f'{trecho["pv_ini"]}\nCT={ct0:.3f}', xy=(0, ct0),
                fontsize=8, fontweight='bold', va='bottom')
    ax2.annotate(f'CF={cf0:.3f}', xy=(0, cf0), fontsize=7, color='blue', va='top')
    
    ax2.annotate(f'{trecho["pv_fim"]}\nCT={ct1:.3f}', xy=(ext, ct1),
                fontsize=8, fontweight='bold', va='bottom', ha='right')
    ax2.annotate(f'CF={cf1:.3f}', xy=(ext, cf1), fontsize=7, color='blue', va='top', ha='right')
    
    # DN no meio
    xm = ext / 2; ym = (cf0 + cf1) / 2
    ax2.text(xm, ym + 0.2, f'DN{dn} {mat} - {ext:.1f}m',
            fontsize=10, color='blue', fontweight='bold', ha='center')
    
    ax2.set_xlabel("Distância (m)")
    ax2.set_ylabel("Cota (m)")
    ax2.set_title(f"PERFIL LONGITUDINAL - NS {ns_id}", fontweight='bold')
    ax2.legend(fontsize=8)
    ax2.grid(True, alpha=0.3)
    
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
```

---

### TAREFA 3: Restaurar HTML REDE_GERAL

Verificar que `processar_nucleo()` chama no final:

```python
# Mapa geral com TODOS os trechos (Leaflet)
gerar_html_rede_geral(trechos_enr, pvs, nucleo, 
                       os.path.join(ns_dir, "REDE_GERAL.html"))
```

Se `gerar_html_rede_geral()` não existe, criar. É um HTML com Leaflet que:
- Mostra todos os PVs como markers
- Mostra todos os trechos como polylines
- Popup em cada PV com nome, CT, CF
- Popup em cada trecho com NS, DN, ext, Manning
- Tiles satélite + rua (layer control)
- Zoom automático na extensão da rede

---

### TAREFA 4: LLM inteligente — substituir prompts genéricos

No `motor_llm.py`, adicionar dicionário de prompts especializados:

```python
PROMPTS_ANALISE = {
    "lean_lps": """Você é consultor sênior em Lean Construction e Last Planner System.
Analise os dados e responda com AÇÕES CONCRETAS:
1. DIAGNÓSTICO: PPC está aceitável? Takt compatível com meta?
2. GARGALOS: Top 3 restrições mais frequentes.
3. AÇÕES IMEDIATAS: O que fazer AMANHÃ para melhorar fluxo?
4. PRÓXIMA SEMANA: Redistribuir equipes baseado no Lookahead?
5. ALERTA: Se PPC < 60%, risco de atraso acumulado.
Responda com NÚMEROS e DATAS. Não filosofe. Dados:""",

    "custo": """Você é analista de custos de saneamento.
1. COMPARAÇÃO: R$/m está acima ou abaixo do contrato (R$ 910/m)? Por quê?
2. DESVIO: Quais itens acima do previsto?
3. OTIMIZAÇÃO: Onde reduzir custo sem perder qualidade?
4. PROJEÇÃO: Custo final do contrato no ritmo atual?
5. BM: Algum trecho excluir do próximo Boletim?
Composição contrato: Escavação R$145, Tubo R$240, PV R$120, Reaterro R$80, Pavim R$45. Dados:""",

    "perdas": """Você é especialista IWA em perdas de água.
1. ILI: Faixa A/B/C/D? Compare com Brasil (5-12).
2. UARL: Componente dominante (rede/conexões/ramais)?
3. PRIORIDADE: Detecção de perdas reais OU troca de hidrômetro?
4. ECONOMIA: Se ILI→4, quanto economiza R$/ano?
5. DMAs: Quantos setores? Onde macromedidores primeiro?
"Trocar hidrômetro aumenta receita mas NÃO salva água." Dados:""",

    "ml": """Você é engenheiro de produção de obra.
Explique em LINGUAGEM DE CAMPO (sem jargão ML):
1. PRODUÇÃO ATUAL: lig/mês está bom vs meta?
2. TENDÊNCIA: Subindo ou caindo?
3. GARGALOS: Qual etapa trava? Quanto tempo cada?
4. CENÁRIO: Qual aceleração mais realista?
5. AÇÃO PRÁTICA: O que o encarregado faz AMANHÃ?
Dados:""",

    "micro": """Você é planejador de obras em áreas irregulares.
1. EQUIPES: Distribuição atual está certa? Realocar?
2. MORRO: Escoramento OK? Produtividade real vs planejada?
3. MATERIAL: JIT funcionando ou faltando na frente?
4. SEQUÊNCIA: Qual frente iniciar primeiro?
5. RISCO: Chuva, maré, solo — maior risco agora?
Dados:""",

    "hidraulica": """Você é projetista hidráulico (NBR 9649).
Para cada alerta, dê: Trecho, Problema, Causa, Ação, Urgência (1-5).
- V > 5.0: Erosão. Aumentar DN ou reduzir declividade.
- V < 0.6: Sedimentação. Rever declividade mínima.
- τ < 1.0: Fora NBR 9649. Aumentar i ou reduzir DN.
- Decl negativa: Erro de projeto. Verificar topografia.
- Prof > 5m: Custo elevado. Considerar elevatória.
Alertas:""",

    "resumo_exec": """Você é gerente de contrato na reunião semanal.
RESUMO EXECUTIVO de 200 palavras pra diretoria:
1. SITUAÇÃO: X metros de Y total (Z%). N núcleos ativos.
2. PRODUÇÃO: X lig/mês (meta: Y). Tendência.
3. CUSTOS: R$ X faturado de R$ Y. Desvio +/- Z%.
4. PROBLEMAS: Top 3 restrições.
5. PRÓXIMOS PASSOS: 3 ações concretas.
Texto corrido profissional. Diretor lê em 30 segundos. Dados:""",
}
```

**Atualizar as funções de alto nível em motor_llm.py:**

```python
def resumo_executivo(contexto_dados):
    prompt = PROMPTS_ANALISE["resumo_exec"] + "\n" + contexto_dados
    return chamar("resumo", prompt, system=SYSTEM_ENGENHEIRO)

def recomendar_lps(ns_planejadas, ns_executadas, restricoes):
    ppc = len(ns_executadas) / max(1, len(ns_planejadas)) * 100
    dados = f"PPC: {ppc:.0f}% | Plan: {len(ns_planejadas)} | Exec: {len(ns_executadas)} | Restrições: {json.dumps(restricoes)}"
    prompt = PROMPTS_ANALISE["lean_lps"] + "\n" + dados
    return chamar("lps", prompt, system=SYSTEM_ENGENHEIRO)

def analisar_perdas_texto(dados_perdas):
    prompt = PROMPTS_ANALISE["perdas"] + "\n" + json.dumps(dados_perdas, indent=2, ensure_ascii=False)[:3000]
    return chamar("perdas", prompt, system=SYSTEM_ENGENHEIRO)

def validar_hidraulica(trechos_alertas):
    resumo = []
    for t in trechos_alertas[:20]:
        if isinstance(t, tuple): idx, t = t
        resumo.append(f"{t.get('pv_ini','')}→{t.get('pv_fim','')} DN{t.get('dn_mm',0)} V={t.get('v_ms',0):.2f} τ={t.get('tau_pa',0):.1f}")
    prompt = PROMPTS_ANALISE["hidraulica"] + "\n" + "\n".join(resumo)
    return chamar("hidraulica", prompt, system=SYSTEM_ENGENHEIRO)

def explicar_ml(dados_ml):
    prompt = PROMPTS_ANALISE["ml"] + "\n" + json.dumps(dados_ml, indent=2, ensure_ascii=False)[:2000]
    return chamar("ml_explicacao", prompt, system=SYSTEM_ENGENHEIRO)
```

---

### TAREFA 5: GUI Tab IA — botões chamam análise real

No `construdata_gui.py`, Tab IA, cada botão deve:
1. Rodar o motor determinístico (cálculo)
2. Pegar os NÚMEROS REAIS
3. Chamar o LLM com prompt ESPECIALIZADO + dados reais

```python
# Exemplo: botão "Analisar Lean"
def _ia_analise_lean(self):
    from motor_lean_lps import gerar_relatorio_lean_lps
    rel = gerar_relatorio_lean_lps(ST.pvs, ST.trechos, nucleo=ST.nucleo)
    
    contexto = json.dumps({
        "takt": rel["lean"]["takt_time"],
        "ppc": rel["lps"].get("ppc_atual"),
        "lookahead": rel["lps"].get("lookahead", [])[:3],
        "co2": rel["bim_6d"].get("co2_total_ton"),
    }, indent=2, ensure_ascii=False)
    
    from motor_llm import chamar, PROMPTS_ANALISE
    prompt = PROMPTS_ANALISE["lean_lps"] + "\n" + contexto
    resposta = chamar("consulta", prompt)
    self.text_ia.insert(tk.END, f"\n{'═'*60}\n📊 ANÁLISE LEAN/LPS:\n{resposta}\n")
```

---

### TAREFA 6: construdata_pipeline.py — chamar XLSX + NS completa

Atualizar o pipeline para gerar todos os outputs:

```python
def run_pipeline(input_path, nucleo, out_dir, data_inicio=None):
    # ... leitura existente ...
    
    # ETAPA 2: NS (5 arquivos por trecho + REDE_GERAL.html)
    ns_dir = os.path.join(out_dir, "01_NS")
    trechos_enr = enriquecer_trechos(trechos, pvs)
    for i, tr in enumerate(trechos_enr):
        base = os.path.join(ns_dir, f"NS_{i+1:03d}")
        gerar_ns_a4(i+1, tr, pvs, nucleo, f"{base}.pdf")
        gerar_ns_desenho(i+1, tr, pvs, nucleo, f"{base}_DESENHO.pdf")
        gerar_ns_sat(i+1, tr, pvs, nucleo, f"{base}_SAT.pdf")
        gerar_html(i+1, tr, pvs, trechos_enr, nucleo, f"{base}.html")
    gerar_html_rede_geral(trechos_enr, pvs, nucleo, os.path.join(ns_dir, "REDE_GERAL.html"))
    gerar_geojson(trechos_enr, pvs, os.path.join(ns_dir, "rede.geojson"))
    
    # ETAPA NOVA: XLSX profissionais
    xlsx_dir = os.path.join(out_dir, "06_XLSX")
    os.makedirs(xlsx_dir, exist_ok=True)
    from gerar_xlsx import *
    gerar_xlsx_custos(pvs, trechos_enr, nucleo, os.path.join(xlsx_dir, f"CUSTOS_{nucleo}.xlsx"))
    gerar_xlsx_hidraulica(trechos_enr, pvs, nucleo, os.path.join(xlsx_dir, f"HIDRAULICA_{nucleo}.xlsx"))
    gerar_xlsx_curva_s(trechos_enr, nucleo, os.path.join(xlsx_dir, f"CURVA_S_{nucleo}.xlsx"))
    
    from motor_lean_lps import gerar_relatorio_lean_lps
    rel_lean = gerar_relatorio_lean_lps(pvs, trechos_enr, nucleo=nucleo)
    gerar_xlsx_lean(rel_lean, pvs, trechos_enr, nucleo, os.path.join(xlsx_dir, f"LEAN_LPS_{nucleo}.xlsx"))
    
    from motor_microplanejamento import micro_planejar_nucleo
    mp = micro_planejar_nucleo(pvs, trechos_enr, nucleo, 4)
    gerar_xlsx_microplan(mp, pvs, trechos_enr, nucleo, os.path.join(xlsx_dir, f"MICROPLAN_{nucleo}.xlsx"))
    
    from motor_perdas import gerar_relatorio_perdas
    rel_perdas = gerar_relatorio_perdas(pvs, trechos_enr, nucleo, pressao_media=25)
    gerar_xlsx_perdas(rel_perdas, nucleo, os.path.join(xlsx_dir, f"PERDAS_{nucleo}.xlsx"))
```

---

### TAREFA 7: Multi-contrato — preços do contrato ativo

O `motor_custo.py` deve buscar preços do contrato ativo:

```python
# No início de custo_trecho() e custo_nucleo():
try:
    from motor_contratos import get_contrato, get_precos
    contrato = get_contrato()
    if contrato:
        custo_metro = contrato.get("custo_medio_metro", 910)
        bdi = contrato.get("bdi_pct", 25) / 100
except:
    custo_metro = 910
    bdi = 0.25
```

---

### TAREFA 8: Verificar que tudo roda

Testar o pipeline completo:

```bash
cd C:\Users\felip\Downloads\NOVA NS Versao 5\PACOTE_V4\scripts

# Teste rápido
python construdata_pipeline.py ..\..\VERDE_TETEU.dxf --nucleo "Verde e Teteu" --saida ..\..\SAIDA

# Verificar outputs
dir ..\..\SAIDA\01_NS\     # PDF + DESENHO + SAT + HTML + JSON por trecho + REDE_GERAL.html
dir ..\..\SAIDA\06_XLSX\    # 6 planilhas profissionais

# GUI
python ..\gui\construdata_gui.py
```

---

## ESTRUTURA DE PASTAS APÓS CORREÇÕES

```
SAIDA_NUCLEO/
├── 01_NS/
│   ├── NS_001.pdf              ← A4 texto
│   ├── NS_001_DESENHO.pdf      ← A3 planta+materiais+perfil+tabela
│   ├── NS_001_SAT.pdf          ← A3 satélite+perfil
│   ├── NS_001.html             ← Leaflet individual
│   ├── NS_001.json             ← Dados
│   ├── NS_002.pdf
│   ├── NS_002_DESENHO.pdf
│   ├── NS_002_SAT.pdf
│   ├── ...
│   ├── REDE_GERAL.html         ← Mapa completo da rede
│   └── rede.geojson            ← GeoJSON completo
├── 02_CIVIL3D/
│   ├── *.xml (LandXML)
│   ├── *.dxf (Cadastro)
│   ├── *.py (Dynamo)
│   └── *.scr (AutoCAD)
├── 03_CADASTRO_NTS292/
│   ├── *.dxf (georref)
│   └── *.json (meta)
├── 04_BIM_LOD500/
│   ├── *.ifc (3D real)
│   ├── *.csv (LOD 500)
│   └── *.json (BIM 5D)
├── 05_CRONOGRAMA/
│   ├── *.xml (MS Project)
│   └── *.json (dados)
├── 06_XLSX/                     ← NOVO
│   ├── CUSTOS_Verde_e_Teteu.xlsx
│   ├── HIDRAULICA_Verde_e_Teteu.xlsx
│   ├── CURVA_S_Verde_e_Teteu.xlsx
│   ├── LEAN_LPS_Verde_e_Teteu.xlsx
│   ├── MICROPLAN_Verde_e_Teteu.xlsx
│   └── PERDAS_Verde_e_Teteu.xlsx
└── PIPELINE_RESULTADO.json
```

---

## DEPENDÊNCIAS

```bash
pip install openpyxl matplotlib contextily
pip install google-genai groq mistralai cohere  # LLMs (opcional)
```

---

## REGRAS

1. **NUNCA** "FCN Construções e Saneamento"
2. **NUNCA** output só JSON — sempre JSON + XLSX
3. **NUNCA** LLM genérica — sempre prompt especializado com dados reais
4. **SEMPRE** testar com dados reais (Verde e Teteu: 357 PVs, 180 trechos)
5. **SEMPRE** manter o formato pvs + trechos (sagrado)
6. **SEMPRE** gerar REDE_GERAL.html com Leaflet
7. Custos do **CONTRATO** (R$910/m), não SINAPI genérico
8. CT pode ser negativo (Santos abaixo do nível do mar)

---

*ConstruData - HydroNetwork · FCN Construções e Saneamento*
*"JSON é pra máquina. XLSX é pra gente. A LLM analisa de verdade."*
