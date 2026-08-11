# PROMPT URGENTE — Corrigir TODOS os outputs da plataforma
## ConstruData HydroNetwork · FCN Construções e Saneamento
## PRIORIDADE MÁXIMA — Ler tudo antes de começar

---

> **PROBLEMA:** A plataforma está emitindo tudo em JSON/CSV fraco.
> O engenheiro precisa de XLSX profissional com gráficos, formatação e cálculos.
> O LLM integrado precisa analisar resultados de verdade, não conversar fiado.

---

## LISTA DE ERROS A CORRIGIR

| # | Problema | Status Atual | O que precisa |
|---|---------|-------------|---------------|
| 1 | LPS sai em JSON | `lookahead_6sem.json` | **XLSX com Gantt, cores, fórmulas** |
| 2 | Lean sai em JSON | `lean_report.json` | **XLSX com gráficos VSM, Takt, PPC** |
| 3 | Curva S sai em JSON | `curva_s.json` | **XLSX com gráfico previsto×real** |
| 4 | Microplanejamento em JSON | `microplan.json` | **XLSX com tabela equipes, materiais, Gantt** |
| 5 | HTML das redes não aparece | Sumiu | **Restaurar mapa Leaflet geral** |
| 6 | NS completa não emite | Só PDF A4 | **Emitir A4 + DESENHO + SAT + HTML + JSON** |
| 7 | Planilhas saem em CSV | `dados.csv` | **XLSX formatado com cabeçalho e cores** |
| 8 | LLM só conversa | Chat genérico | **Análise inteligente dos resultados** |

---

## REGRA GERAL DE OUTPUT

A partir de agora, **TODOS os módulos** que geram dados devem gerar:

```
1. JSON (dados brutos — para integração e debug)
2. XLSX (profissional — para o engenheiro/gerente usar)
3. HTML (quando aplicável — mapas, dashboards)
```

**O JSON é o formato de máquina. O XLSX é o formato de gente.**

---

## CORREÇÃO 1: motor_lean_lps.py → XLSX profissional

O `gerar_relatorio_lean_lps()` precisa retornar JSON (já faz) E gerar XLSX.

### Nova função: `gerar_xlsx_lean_lps()`

```python
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, Reference, LineChart, PieChart
from openpyxl.utils import get_column_letter

# Cores padrão ConstruData
HEADER_FILL = PatternFill(start_color="003366", end_color="003366", fill_type="solid")
HEADER_FONT = Font(name="Arial", size=10, bold=True, color="FFFFFF")
DATA_FONT = Font(name="Arial", size=10)
ACC_FONT = Font(name="Arial", size=10, color="008844")
WARN_FONT = Font(name="Arial", size=10, color="CC0033")
TITLE_FONT = Font(name="Arial", size=14, bold=True, color="003366")
BORDER = Border(
    left=Side(style='thin', color='CCCCCC'),
    right=Side(style='thin', color='CCCCCC'),
    top=Side(style='thin', color='CCCCCC'),
    bottom=Side(style='thin', color='CCCCCC')
)
BG_GREEN = PatternFill(start_color="E8FFE8", end_color="E8FFE8", fill_type="solid")
BG_RED = PatternFill(start_color="FFE8E8", end_color="FFE8E8", fill_type="solid")
BG_YELLOW = PatternFill(start_color="FFFFF0", end_color="FFFFF0", fill_type="solid")
BG_BLUE = PatternFill(start_color="E8F4FF", end_color="E8F4FF", fill_type="solid")


def _style_header(ws, row, n_cols):
    """Aplica estilo profissional ao cabeçalho."""
    for col in range(1, n_cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = BORDER


def _style_data(ws, start_row, end_row, n_cols):
    """Aplica estilo a todas as células de dados."""
    for row in range(start_row, end_row + 1):
        for col in range(1, n_cols + 1):
            cell = ws.cell(row=row, column=col)
            cell.font = DATA_FONT
            cell.border = BORDER
            cell.alignment = Alignment(horizontal='center', vertical='center')


def _auto_width(ws, n_cols):
    """Ajusta largura das colunas automaticamente."""
    for col in range(1, n_cols + 1):
        max_len = 0
        for row in ws.iter_rows(min_col=col, max_col=col):
            for cell in row:
                if cell.value:
                    max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[get_column_letter(col)].width = min(max_len + 4, 30)


def gerar_xlsx_lean_lps(relatorio, pvs, trechos, nucleo, out_path):
    """
    Gera XLSX profissional de Lean + LPS + BIM 6D.
    
    ABAS:
    1. RESUMO — KPIs principais
    2. TAKT TIME — cálculos de produção
    3. LPS — Weekly Work Plan
    4. LOOKAHEAD — 6 semanas com restrições
    5. PPC — histórico Percent Plan Complete
    6. BIM 6D — ciclo de vida + CO2
    7. VSM — Value Stream Mapping
    """
    wb = openpyxl.Workbook()
    
    lean = relatorio.get("lean", {})
    lps = relatorio.get("lps", {})
    d6 = relatorio.get("bim_6d", {})
    
    # ── ABA 1: RESUMO ──
    ws = wb.active
    ws.title = "RESUMO"
    ws.sheet_properties.tabColor = "003366"
    
    ws.merge_cells('A1:F1')
    ws['A1'] = f"LEAN + LPS + BIM 6D — {nucleo}"
    ws['A1'].font = TITLE_FONT
    
    ws.merge_cells('A2:F2')
    ws['A2'] = "FCN Construções e Saneamento · ConstruData HydroNetwork"
    ws['A2'].font = Font(name="Arial", size=10, color="666666")
    
    # KPIs
    kpis = [
        ("Indicador", "Valor", "Unidade", "Meta", "Status"),
    ]
    
    takt = lean.get("takt_time", {})
    kpis.append(("Takt Time", takt.get("takt_m_dia_equipe", 0), "m/dia/equipe", "30", ""))
    kpis.append(("Cycle Time", takt.get("cycle_time_dias", 0), "dias/NS", "5", ""))
    kpis.append(("Throughput", takt.get("throughput_ns_semana", 0), "NS/semana", "10", ""))
    kpis.append(("PPC Atual", lps.get("ppc_atual", {}).get("ppc_pct", 0), "%", "80%", ""))
    
    co2 = d6.get("co2_total_ton", 0)
    cv = d6.get("custo_ciclo_vida_total", 0)
    kpis.append(("CO2 Total", co2, "ton", "", ""))
    kpis.append(("Custo Ciclo 50a", cv, "R$", "", ""))
    kpis.append(("Manutenção/ano", d6.get("manutencao_anual", 0), "R$/ano", "", ""))
    
    for r, row_data in enumerate(kpis, start=4):
        for c, val in enumerate(row_data, start=1):
            ws.cell(row=r, column=c, value=val)
    _style_header(ws, 4, 5)
    _style_data(ws, 5, 4 + len(kpis), 5)
    
    # Status automático
    for r in range(5, 5 + len(kpis) - 1):
        val = ws.cell(row=r, column=2).value
        meta = ws.cell(row=r, column=4).value
        try:
            if meta and float(str(meta).replace("%", "")) > 0:
                status = "✅ OK" if float(val) >= float(str(meta).replace("%", "")) else "⚠️ ABAIXO"
                ws.cell(row=r, column=5, value=status)
                if "ABAIXO" in status:
                    ws.cell(row=r, column=5).font = WARN_FONT
                else:
                    ws.cell(row=r, column=5).font = ACC_FONT
        except:
            pass
    
    _auto_width(ws, 5)
    
    # Gráfico KPI
    chart = BarChart()
    chart.title = "Indicadores Lean"
    chart.style = 10
    chart.y_axis.title = "Valor"
    data = Reference(ws, min_col=2, min_row=4, max_row=8, max_col=2)
    cats = Reference(ws, min_col=1, min_row=5, max_row=8)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.shape = 4
    ws.add_chart(chart, "G4")
    
    # ── ABA 2: TAKT TIME ──
    ws2 = wb.create_sheet("TAKT TIME")
    ws2.sheet_properties.tabColor = "008844"
    
    ws2.merge_cells('A1:E1')
    ws2['A1'] = "CÁLCULO DE TAKT TIME"
    ws2['A1'].font = TITLE_FONT
    
    headers = ["Parâmetro", "Valor", "Unidade", "Fórmula", "Observação"]
    for c, h in enumerate(headers, 1):
        ws2.cell(row=3, column=c, value=h)
    _style_header(ws2, 3, 5)
    
    ext = sum(t.get("ext_m", 0) for t in trechos)
    n_tr = len(trechos)
    equipes = takt.get("equipes", 6)
    
    dados_takt = [
        ("Extensão total", f"{ext:.0f}", "m", "", ""),
        ("Nº trechos", n_tr, "un", "", ""),
        ("Nº equipes", equipes, "un", "", "Equipes simultâneas"),
        ("Dias úteis/mês", 22, "dias", "", ""),
        ("Takt (m/dia/equipe)", f"=B4/{equipes}/22", "m/dia/eq", "Ext/Equipes/Dias", "Meta: 30"),
        ("Takt (m/dia total)", f"=B4/22", "m/dia", "Ext/Dias", ""),
        ("Cycle Time", f"=B5/B6*22", "dias/NS", "Trechos/Equipes×Dias", "Meta: 5"),
        ("Throughput", f"=B6*5", "NS/semana", "Equipes×5 dias", ""),
        ("Lead Time estimado", f"=B5/B11", "semanas", "Trechos/Throughput", ""),
    ]
    
    for r, row_data in enumerate(dados_takt, start=4):
        for c, val in enumerate(row_data, start=1):
            ws2.cell(row=r, column=c, value=val)
    _style_data(ws2, 4, 4 + len(dados_takt), 5)
    _auto_width(ws2, 5)
    
    # ── ABA 3: WEEKLY WORK PLAN (LPS) ──
    ws3 = wb.create_sheet("LPS - PLANO SEMANAL")
    ws3.sheet_properties.tabColor = "CC8800"
    
    ws3.merge_cells('A1:I1')
    ws3['A1'] = "WEEKLY WORK PLAN — Last Planner System"
    ws3['A1'].font = TITLE_FONT
    
    headers_lps = ["NS", "PV Ini", "PV Fim", "DN", "Ext (m)", "Equipe", "Dia", "Restrições", "Status"]
    for c, h in enumerate(headers_lps, 1):
        ws3.cell(row=3, column=c, value=h)
    _style_header(ws3, 3, 9)
    
    wwp = lps.get("weekly_work_plan", {}).get("ns_planejadas", [])
    for r, ns in enumerate(wwp[:50], start=4):
        ws3.cell(row=r, column=1, value=ns.get("ns_id", f"NS_{r-3}"))
        ws3.cell(row=r, column=2, value=ns.get("pv_ini", ""))
        ws3.cell(row=r, column=3, value=ns.get("pv_fim", ""))
        ws3.cell(row=r, column=4, value=ns.get("dn_mm", 200))
        ws3.cell(row=r, column=5, value=ns.get("ext_m", 0))
        ws3.cell(row=r, column=6, value=ns.get("equipe", ""))
        ws3.cell(row=r, column=7, value=ns.get("dia", ""))
        ws3.cell(row=r, column=8, value=", ".join(ns.get("restricoes", [])) or "Nenhuma")
        ws3.cell(row=r, column=9, value="PLANEJADA")
        
        # Cor por status de restrição
        if ns.get("restricoes"):
            ws3.cell(row=r, column=8).fill = BG_RED
            ws3.cell(row=r, column=9).value = "RESTRITA"
            ws3.cell(row=r, column=9).fill = BG_RED
        else:
            ws3.cell(row=r, column=8).fill = BG_GREEN
            ws3.cell(row=r, column=9).fill = BG_GREEN
    
    _style_data(ws3, 4, 4 + min(len(wwp), 50), 9)
    _auto_width(ws3, 9)
    
    # ── ABA 4: LOOKAHEAD 6 SEMANAS ──
    ws4 = wb.create_sheet("LOOKAHEAD 6 SEM")
    ws4.sheet_properties.tabColor = "0066CC"
    
    ws4.merge_cells('A1:H1')
    ws4['A1'] = "LOOKAHEAD 6 SEMANAS"
    ws4['A1'].font = TITLE_FONT
    
    headers_look = ["Semana", "NS Planejadas", "Restrições", "Make-Ready", "Status", "NS Executadas", "PPC %", "Obs"]
    for c, h in enumerate(headers_look, 1):
        ws4.cell(row=3, column=c, value=h)
    _style_header(ws4, 3, 8)
    
    lookahead = lps.get("lookahead", [])
    for r, sem in enumerate(lookahead[:6], start=4):
        ws4.cell(row=r, column=1, value=sem.get("semana", f"W{r-3}"))
        ws4.cell(row=r, column=2, value=sem.get("n_planejadas", 0))
        ws4.cell(row=r, column=3, value=sem.get("n_restricoes", 0))
        ws4.cell(row=r, column=4, value=sem.get("make_ready", ""))
        ws4.cell(row=r, column=5, value="LIVRE" if sem.get("n_restricoes", 0) == 0 else "RESTRITA")
        ws4.cell(row=r, column=6, value=sem.get("n_executadas", 0))
        ppc = sem.get("ppc", 0)
        ws4.cell(row=r, column=7, value=f"{ppc:.0f}%")
        ws4.cell(row=r, column=7).fill = BG_GREEN if ppc >= 80 else (BG_YELLOW if ppc >= 60 else BG_RED)
    
    _style_data(ws4, 4, 9, 8)
    _auto_width(ws4, 8)
    
    # ── ABA 5: BIM 6D ──
    ws5 = wb.create_sheet("BIM 6D - CICLO VIDA")
    ws5.sheet_properties.tabColor = "CC0033"
    
    ws5.merge_cells('A1:G1')
    ws5['A1'] = "BIM 6D — ANÁLISE DE CICLO DE VIDA (50 ANOS)"
    ws5['A1'].font = TITLE_FONT
    
    headers_6d = ["Material", "Extensão (m)", "Vida Útil (anos)", "CO2 (kg)", "Custo Impl. (R$)", "Manutenção 50a (R$)", "Custo Total 50a (R$)"]
    for c, h in enumerate(headers_6d, 1):
        ws5.cell(row=3, column=c, value=h)
    _style_header(ws5, 3, 7)
    
    # Agrupar por material
    por_mat = {}
    for t in trechos:
        mat = t.get("material", "PVC")
        if mat not in por_mat:
            por_mat[mat] = {"ext": 0, "custo": 0}
        por_mat[mat]["ext"] += t.get("ext_m", 0)
        por_mat[mat]["custo"] += t.get("ext_m", 0) * 910
    
    vida_util = {"PVC": 50, "PEAD": 100, "CONCRETO": 80, "PE 80": 100, "PE 100": 100}
    co2_kg_m = {"PVC": 3.2, "PEAD": 2.8, "CONCRETO": 12.5, "PE 80": 2.8, "PE 100": 2.8}
    manut_pct = {"PVC": 0.005, "PEAD": 0.003, "CONCRETO": 0.01, "PE 80": 0.003, "PE 100": 0.003}
    
    row = 4
    for mat, d in por_mat.items():
        vu = vida_util.get(mat, 50)
        co2 = d["ext"] * co2_kg_m.get(mat, 3.2)
        manut = d["custo"] * manut_pct.get(mat, 0.005) * 50
        total = d["custo"] + manut
        ws5.cell(row=row, column=1, value=mat)
        ws5.cell(row=row, column=2, value=round(d["ext"], 1))
        ws5.cell(row=row, column=3, value=vu)
        ws5.cell(row=row, column=4, value=round(co2, 1))
        ws5.cell(row=row, column=5, value=round(d["custo"], 0))
        ws5.cell(row=row, column=6, value=round(manut, 0))
        ws5.cell(row=row, column=7, value=round(total, 0))
        # Formato moeda
        for c in [5, 6, 7]:
            ws5.cell(row=row, column=c).number_format = '#,##0'
        row += 1
    
    # Linha total
    ws5.cell(row=row, column=1, value="TOTAL")
    ws5.cell(row=row, column=1).font = Font(name="Arial", bold=True)
    for c in range(2, 8):
        ws5.cell(row=row, column=c, value=f"=SUM({get_column_letter(c)}4:{get_column_letter(c)}{row-1})")
        ws5.cell(row=row, column=c).font = Font(name="Arial", bold=True)
        if c >= 5:
            ws5.cell(row=row, column=c).number_format = '#,##0'
    
    _style_data(ws5, 4, row, 7)
    _auto_width(ws5, 7)
    
    # Gráfico CO2 por material
    chart = PieChart()
    chart.title = "CO2 por Material"
    data = Reference(ws5, min_col=4, min_row=3, max_row=row-1)
    cats = Reference(ws5, min_col=1, min_row=4, max_row=row-1)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    ws5.add_chart(chart, "I3")
    
    # ── SALVAR ──
    wb.save(out_path)
    return out_path
```

---

## CORREÇÃO 2: motor_medicao.py → XLSX Curva S com gráfico

```python
def gerar_xlsx_curva_s(trechos, dados_exec, nucleo, out_path, custo_metro=910):
    """XLSX com Curva S: previsto × realizado + gráfico de linhas."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "CURVA S"
    ws.sheet_properties.tabColor = "008844"
    
    ws.merge_cells('A1:G1')
    ws['A1'] = f"CURVA S — {nucleo}"
    ws['A1'].font = TITLE_FONT
    
    ws.merge_cells('A2:G2')
    ws['A2'] = "FCN Construções e Saneamento · ConstruData HydroNetwork"
    ws['A2'].font = Font(name="Arial", size=10, color="666666")
    
    headers = ["Mês", "Previsto (m)", "Previsto Acum (m)", "Previsto Acum (%)", 
               "Realizado (m)", "Realizado Acum (m)", "Realizado Acum (%)", "Custo Acum (R$)"]
    for c, h in enumerate(headers, 1):
        ws.cell(row=4, column=c, value=h)
    _style_header(ws, 4, 8)
    
    ext_total = sum(t.get("ext_m", 0) for t in trechos)
    meses_previstos = max(1, int(ext_total / (30 * 22)))  # 30m/dia × 22 dias
    prev_mensal = ext_total / meses_previstos
    
    for r in range(meses_previstos):
        row = r + 5
        ws.cell(row=row, column=1, value=f"Mês {r+1}")
        ws.cell(row=row, column=2, value=round(prev_mensal, 0))
        ws.cell(row=row, column=3, value=f"=SUM(B5:B{row})")
        ws.cell(row=row, column=4, value=f"=C{row}/{ext_total}*100")
        ws.cell(row=row, column=4).number_format = '0.0"%"'
        # Realizado: preencher com dados reais se tiver
        ws.cell(row=row, column=5, value=0)  # engenheiro preenche
        ws.cell(row=row, column=6, value=f"=SUM(E5:E{row})")
        ws.cell(row=row, column=7, value=f"=F{row}/{ext_total}*100")
        ws.cell(row=row, column=7).number_format = '0.0"%"'
        ws.cell(row=row, column=8, value=f"=F{row}*{custo_metro}")
        ws.cell(row=row, column=8).number_format = '#,##0'
    
    end_row = 4 + meses_previstos
    _style_data(ws, 5, end_row, 8)
    _auto_width(ws, 8)
    
    # Gráfico Curva S (previsto vs realizado)
    chart = LineChart()
    chart.title = "Curva S — Previsto × Realizado"
    chart.style = 10
    chart.y_axis.title = "% Acumulado"
    chart.x_axis.title = "Mês"
    chart.height = 15
    chart.width = 25
    
    prev = Reference(ws, min_col=4, min_row=4, max_row=end_row)
    real = Reference(ws, min_col=7, min_row=4, max_row=end_row)
    cats = Reference(ws, min_col=1, min_row=5, max_row=end_row)
    
    chart.add_data(prev, titles_from_data=True)
    chart.add_data(real, titles_from_data=True)
    chart.set_categories(cats)
    
    chart.series[0].graphicalProperties.line.solidFill = "008844"  # verde
    chart.series[0].graphicalProperties.line.width = 25000
    if len(chart.series) > 1:
        chart.series[1].graphicalProperties.line.solidFill = "FFD000"  # amarelo
        chart.series[1].graphicalProperties.line.width = 25000
    
    ws.add_chart(chart, "A" + str(end_row + 3))
    
    wb.save(out_path)
    return out_path
```

---

## CORREÇÃO 3: motor_microplanejamento.py → XLSX profissional

```python
def gerar_xlsx_microplanejamento(resultado, nucleo, out_path):
    """
    XLSX com 4 abas:
    1. RESUMO POR MORFOLOGIA — tipo, extensão, equipes, custo, produtividade
    2. TRECHOS DETALHADO — cada trecho com morfologia, equipe, equipamento, dias
    3. MATERIAL JIT — consolidado de material por frente de serviço
    4. RECOMENDAÇÕES — alocação de equipes + alertas
    """
    wb = openpyxl.Workbook()
    
    # ── ABA 1: RESUMO MORFOLOGIA ──
    ws = wb.active
    ws.title = "RESUMO MORFOLOGIA"
    ws.sheet_properties.tabColor = "CC8800"
    
    ws.merge_cells('A1:H1')
    ws['A1'] = f"MICRO-PLANEJAMENTO POR MORFOLOGIA — {nucleo}"
    ws['A1'].font = TITLE_FONT
    
    headers = ["Morfologia", "Trechos", "Extensão (m)", "% do Total", 
               "Prod. (m/dia)", "Fator Custo", "Equipes", "Dias Estimados"]
    for c, h in enumerate(headers, 1):
        ws.cell(row=3, column=c, value=h)
    _style_header(ws, 3, 8)
    
    morf = resultado.get("por_morfologia", {})
    row = 4
    cores_morf = {
        "planicie": BG_GREEN, "encosta": BG_YELLOW,
        "morro": BG_RED, "mangue": PatternFill(start_color="E8E8FF", fill_type="solid"),
        "viela": BG_YELLOW,
    }
    
    for tipo, dados in morf.items():
        ws.cell(row=row, column=1, value=tipo.upper())
        ws.cell(row=row, column=2, value=dados.get("n_trechos", 0))
        ws.cell(row=row, column=3, value=round(dados.get("extensao_m", 0), 0))
        ws.cell(row=row, column=4, value=f"{dados.get('pct_extensao', 0):.1f}%")
        ws.cell(row=row, column=5, value=dados.get("prod_media_m_dia", 0))
        ws.cell(row=row, column=6, value=dados.get("fator_custo", 1.0))
        ws.cell(row=row, column=7, value=dados.get("equipes_recomendadas", 1))
        ws.cell(row=row, column=8, value=dados.get("dias_estimados", 0))
        
        fill = cores_morf.get(tipo.lower(), None)
        if fill:
            for c in range(1, 9):
                ws.cell(row=row, column=c).fill = fill
        row += 1
    
    _style_data(ws, 4, row - 1, 8)
    _auto_width(ws, 8)
    
    # Gráfico pizza por morfologia
    chart = PieChart()
    chart.title = "Extensão por Morfologia"
    data = Reference(ws, min_col=3, min_row=3, max_row=row-1)
    cats = Reference(ws, min_col=1, min_row=4, max_row=row-1)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    ws.add_chart(chart, "J3")
    
    # ── ABA 2: MATERIAL JIT ──
    ws2 = wb.create_sheet("MATERIAL JIT")
    ws2.sheet_properties.tabColor = "0066CC"
    
    ws2.merge_cells('A1:E1')
    ws2['A1'] = "MATERIAL JUST-IN-TIME — Consolidado por Frente"
    ws2['A1'].font = TITLE_FONT
    
    headers_mat = ["Material", "Unidade", "Quantidade", "Frente", "Observação"]
    for c, h in enumerate(headers_mat, 1):
        ws2.cell(row=3, column=c, value=h)
    _style_header(ws2, 3, 5)
    
    materiais = resultado.get("material_consolidado", {})
    row = 4
    for mat, dados in materiais.items():
        ws2.cell(row=row, column=1, value=mat)
        ws2.cell(row=row, column=2, value=dados.get("un", ""))
        ws2.cell(row=row, column=3, value=round(dados.get("qtd", 0), 2))
        ws2.cell(row=row, column=4, value=dados.get("frente", ""))
        row += 1
    
    _style_data(ws2, 4, row - 1, 5)
    _auto_width(ws2, 5)
    
    wb.save(out_path)
    return out_path
```

---

## CORREÇÃO 4: LLM INTELIGENTE — Prompts de análise real

O problema: o LLM está com prompt genérico ("você é engenheiro") e responde conversa fiado.
A solução: **prompts especializados por módulo** que recebem os DADOS REAIS e fazem análise.

### Atualizar motor_llm.py — novos system prompts por módulo:

```python
PROMPTS_ANALISE = {
    "lean_lps": """Você é consultor sênior em Lean Construction e Last Planner System.
Analise os dados abaixo e responda com AÇÕES CONCRETAS:

1. DIAGNÓSTICO: O PPC está aceitável? O Takt está compatível com a meta?
2. GARGALOS: Quais restrições são mais frequentes? Cite as top 3.
3. AÇÕES IMEDIATAS: O que fazer AMANHÃ para melhorar o fluxo?
4. PRÓXIMA SEMANA: Como redistribuir equipes baseado no Lookahead?
5. ALERTA: Se PPC < 60%, explique o risco de atraso acumulado.

Responda com NÚMEROS e DATAS. Não filosofe. O engenheiro precisa decidir agora.
Dados do núcleo:""",

    "custo": """Você é analista de custos de obras de saneamento.
Analise os dados de custo abaixo e responda:

1. COMPARAÇÃO: O R$/m está acima ou abaixo do contrato (R$ 910/m)? Por quê?
2. DESVIO: Quais itens de composição estão acima do previsto?
3. OTIMIZAÇÃO: Onde pode reduzir custo sem comprometer qualidade?
4. PROJEÇÃO: Se manter este ritmo, qual o custo final do contrato?
5. BM: Algum trecho deve ser excluído do próximo Boletim de Medição?

Use os NÚMEROS REAIS. Compare com a composição do contrato:
Escavação R$145/m, Tubo ESG R$240/m, PV R$120/m, Reaterro R$80/m, Pavimentação R$45/m.
Dados:""",

    "perdas": """Você é especialista em perdas de água com certificação IWA.
Analise os indicadores e recomende:

1. ILI: Está em qual faixa (A/B/C/D)? Compare com média Brasil (5-12).
2. UARL: Qual componente domina (rede/conexões/ramais)? Quanto em %?
3. PRIORIDADE: Investir em detecção de perdas reais OU troca de hidrômetro?
4. ECONOMIA: Se reduzir ILI para 4.0, quanto economiza por ano em R$?
5. DMAs: Quantos setores e onde instalar macromedidores primeiro?

"Trocar hidrômetro aumenta receita mas NÃO salva água." — Piero Ereno
Dados:""",

    "ml": """Você é engenheiro de produção analisando dados de obra.
Explique os resultados do modelo de predição em LINGUAGEM DE CAMPO:

1. PRODUÇÃO ATUAL: X lig/mês está bom? Comparar com meta.
2. TENDÊNCIA: Está subindo ou caindo? O que indica?
3. GARGALOS: Qual etapa do pipeline está travando? Quanto tempo cada uma leva?
4. CENÁRIO RECOMENDADO: Qual dos cenários de aceleração é mais realista?
5. AÇÃO PRÁTICA: O que o encarregado pode fazer AMANHÃ com a equipe que tem?

Não use jargão de ML. O engenheiro não sabe o que é "rolling_3". Traduza.
Dados:""",

    "micro": """Você é planejador de obras de saneamento em áreas irregulares.
Analise o micro-planejamento por morfologia e recomende:

1. EQUIPES: A distribuição atual está certa? Realocar alguma equipe?
2. MORRO: As equipes de morro estão com escoramento? Produtividade real vs planejada?
3. MATERIAL: O JIT está funcionando ou está faltando material na frente?
4. SEQUÊNCIA: Qual frente iniciar primeiro para otimizar o fluxo?
5. RISCO: Chuva, maré, solo argiloso — qual o maior risco agora?

Pense como se VOCÊ fosse montar as equipes amanhã de manhã.
Dados:""",

    "hidraulica": """Você é projetista hidráulico especialista em NBR 9649 (esgoto).
Analise os alertas de Manning e recomende CORREÇÕES TÉCNICAS:

Para cada trecho com alerta:
- V > 5.0 m/s: PERIGO. Erosão da tubulação. Ação: aumentar DN ou reduzir declividade.
- V < 0.6 m/s: RISCO. Sedimentação. Ação: verificar autolimpeza, rever declividade mínima.
- τ < 1.0 Pa: FORA DA NORMA. NBR 9649 exige mínimo 1 Pa. Ação: aumentar i ou reduzir DN.
- Declividade negativa: ERRO DE PROJETO ou cota errada. Verificar topografia.
- Profundidade > 5m: CUSTO ELEVADO. Considerar estação elevatória.

Para cada alerta, dê: Trecho, Problema, Causa provável, Ação corretiva, Urgência (1-5).
Alertas:""",

    "resumo_exec": """Você é gerente de contrato de saneamento na reunião semanal.
Gere um RESUMO EXECUTIVO de 200 palavras para apresentar à diretoria:

ESTRUTURA OBRIGATÓRIA:
1. SITUAÇÃO: X metros executados de Y total (Z%). N núcleos ativos.
2. PRODUÇÃO: X lig/mês (meta: Y). Tendência: subindo/estável/caindo.
3. CUSTOS: R$ X faturado de R$ Y contrato. Desvio: +/- Z%.
4. PROBLEMAS: Top 3 restrições desta semana.
5. PRÓXIMOS PASSOS: 3 ações concretas para a próxima semana.

Formato: texto corrido profissional, parágrafo único, sem bullet points.
Tom: objetivo, direto, com números. O diretor lê em 30 segundos.
Dados:""",
}
```

### Como usar na GUI Tab IA:

```python
def _ia_analise_lean(self):
    """Botão 'Analisar Lean' na Tab IA."""
    from motor_lean_lps import gerar_relatorio_lean_lps
    
    # 1. Calcular (determinístico)
    rel = gerar_relatorio_lean_lps(ST.pvs, ST.trechos, nucleo=ST.nucleo)
    
    # 2. Montar contexto com NÚMEROS REAIS
    contexto = json.dumps({
        "takt": rel["lean"]["takt_time"],
        "ppc": rel["lps"].get("ppc_atual"),
        "lookahead": rel["lps"].get("lookahead", [])[:3],
        "6d": rel["bim_6d"],
    }, indent=2, ensure_ascii=False)
    
    # 3. Chamar LLM com prompt ESPECIALIZADO (não genérico)
    from motor_llm import chamar, PROMPTS_ANALISE
    prompt = PROMPTS_ANALISE["lean_lps"] + "\n" + contexto
    resposta = chamar("consulta", prompt)
    
    self.text_ia.insert(tk.END, f"\n{'═'*60}\n📊 ANÁLISE LEAN/LPS:\n{resposta}\n")
```

---

## CORREÇÃO 5: HTML das redes — restaurar mapa geral

O `gerar_ns.py` tem `gerar_html()` e `gerar_geojson()` mas o processamento não está chamando
a geração do mapa geral. Garantir que `processar_nucleo()` gere:

```python
# No final de processar_nucleo():

# Mapa geral da rede (HTML Leaflet com TODOS os trechos)
gerar_html_rede_geral(trechos_enr, pvs, nucleo, os.path.join(ns_dir, "REDE_GERAL.html"))

# GeoJSON completo
gerar_geojson(trechos_enr, pvs, os.path.join(ns_dir, "rede.geojson"))

# HTML individual por trecho (já existe, verificar que está sendo chamado)
for i, tr in enumerate(trechos_enr):
    gerar_html(i+1, tr, pvs, trechos_enr, nucleo, os.path.join(ns_dir, f"NS_{i+1:03d}.html"))
```

---

## CORREÇÃO 6: NS completa — emitir os 5 formatos por trecho

```python
for i, tr in enumerate(trechos_enr):
    ns_id = i + 1
    base = os.path.join(ns_dir, f"NS_{ns_id:03d}")
    
    gerar_ns_a4(ns_id, tr, pvs, nucleo, f"{base}.pdf")              # A4 texto
    gerar_ns_desenho(ns_id, tr, pvs, nucleo, f"{base}_DESENHO.pdf") # A3 completo
    gerar_ns_sat(ns_id, tr, pvs, nucleo, f"{base}_SAT.pdf")         # A3 satélite
    gerar_html(ns_id, tr, pvs, trechos_enr, nucleo, f"{base}.html") # HTML Leaflet
    
    with open(f"{base}.json", 'w') as f:                             # JSON dados
        json.dump({"ns_id": ns_id, "trecho": tr, "pvs": {
            tr["pv_ini"]: pvs.get(tr["pv_ini"], {}),
            tr["pv_fim"]: pvs.get(tr["pv_fim"], {}),
        }}, f, indent=2, ensure_ascii=False)
```

---

## RESUMO: O QUE CADA MÓDULO DEVE GERAR

| Módulo | JSON | XLSX | HTML | PDF |
|--------|------|------|------|-----|
| motor_lean_lps | ✅ relatório | ✅ 5 abas (Resumo, Takt, LPS, Lookahead, 6D) | — | — |
| motor_medicao (Curva S) | ✅ dados | ✅ gráfico previsto×real | — | — |
| motor_microplanejamento | ✅ dados | ✅ 2 abas (Morfologia, Material JIT) | — | — |
| motor_custo | ✅ detalhamento | ✅ planilha BM | — | — |
| motor_perdas | ✅ relatório | ✅ balanço IWA + risco | — | ✅ PDF A4 |
| motor_ml | ✅ previsão | ✅ cenários + gráfico | — | — |
| gerar_ns | ✅ por trecho | — | ✅ Leaflet por NS + REDE_GERAL | ✅ A4 + DESENHO + SAT |
| motor_llm | — | — | — | — (texto de análise) |

---

## DEPENDÊNCIAS

```bash
pip install openpyxl matplotlib contextily
```

O openpyxl já está instalado (motor_medicao usa). Contextily é novo (satélite).

---

*ConstruData - HydroNetwork · FCN Construções e Saneamento*
*"JSON é pra máquina. XLSX é pra gente. A LLM analisa de verdade."*
