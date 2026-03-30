#!/usr/bin/env python3
"""
GERAR_PDF_PERDAS.PY — Relatório PDF de Gestão de Perdas
ConstruData - HydroNetwork · FCN Construções e Saneamento
"""
import json, math, os, sys
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

W, H = A4

def _cor(hex_str):
    h = hex_str.lstrip('#')
    return colors.Color(int(h[0:2],16)/255, int(h[2:4],16)/255, int(h[4:6],16)/255)

AZUL = _cor('#003366')
AGUA = _cor('#0088cc')
VERM = _cor('#cc0033')
VERDE = _cor('#008844')
CINZA = _cor('#666666')
BG_AZUL = _cor('#e8f4ff')
BG_VERM = _cor('#fff0f0')


def gerar_pdf_perdas(relatorio, out_path="RELATORIO_PERDAS.pdf", nucleo=""):
    """Gera PDF profissional do relatório de perdas."""
    
    doc = SimpleDocTemplate(out_path, pagesize=A4,
        topMargin=20*mm, bottomMargin=20*mm, leftMargin=18*mm, rightMargin=18*mm)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle('Titulo', parent=styles['Title'], fontSize=18, textColor=AZUL, spaceAfter=4))
    styles.add(ParagraphStyle('Sub', parent=styles['Normal'], fontSize=10, textColor=CINZA, spaceAfter=12))
    styles.add(ParagraphStyle('H2', parent=styles['Heading2'], fontSize=13, textColor=AGUA, spaceBefore=14, spaceAfter=8, borderWidth=0))
    styles.add(ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, leading=14, spaceAfter=6))
    styles.add(ParagraphStyle('Small', parent=styles['Normal'], fontSize=8, textColor=CINZA, leading=10))
    styles.add(ParagraphStyle('Center', parent=styles['Normal'], alignment=TA_CENTER, fontSize=10))
    styles.add(ParagraphStyle('BigNum', parent=styles['Normal'], alignment=TA_CENTER, fontSize=28, textColor=AGUA, leading=32))
    styles.add(ParagraphStyle('BigRed', parent=styles['Normal'], alignment=TA_CENTER, fontSize=28, textColor=VERM, leading=32))
    
    story = []
    
    # ── CAPA ──
    story.append(Spacer(1, 30*mm))
    story.append(Paragraph("RELATÓRIO DE GESTÃO DE PERDAS DE ÁGUA", styles['Titulo']))
    story.append(Paragraph("Metodologia IWA — Balanço Hídrico + UARL + ILI", styles['Sub']))
    story.append(Spacer(1, 6*mm))
    
    info = [
        ["Contrato:", "CT 11481051 — SLNR Santos — SABESP"],
        ["Empresa:", "FCN Construções e Saneamento"],
        ["Plataforma:", "ConstruData - HydroNetwork"],
        ["Núcleo:", nucleo or relatorio.get("meta",{}).get("nucleo","—")],
        ["Data:", datetime.now().strftime("%d/%m/%Y")],
    ]
    t = Table(info, colWidths=[35*mm, 120*mm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,0), (0,-1), AZUL),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t)
    story.append(PageBreak())
    
    # ── 1. INFRAESTRUTURA ──
    infra = relatorio.get("infraestrutura", {})
    story.append(Paragraph("1. INFRAESTRUTURA DA REDE", styles['H2']))
    
    dados_infra = [
        ["Parâmetro", "Valor"],
        ["Extensão da rede", f"{infra.get('extensao_km',0):.2f} km"],
        ["Nº de PVs", str(infra.get("n_pvs", 0))],
        ["Nº de trechos", str(infra.get("n_trechos", 0))],
        ["Conexões estimadas", str(infra.get("n_conexoes_est", 0))],
        ["Extensão ramais", f"{infra.get('ramal_km_est',0):.2f} km"],
        ["Pressão média", f"{infra.get('pressao_media_mca',25)} m.c.a."],
    ]
    t = Table(dados_infra, colWidths=[80*mm, 80*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), AZUL),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_AZUL]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 6*mm))
    
    # ── 2. UARL ──
    uarl = relatorio.get("uarl", {})
    story.append(Paragraph("2. UARL — PERDAS REAIS INEVITÁVEIS", styles['H2']))
    story.append(Paragraph("UARL = (18 x Lm + 0.8 x Nc + 25 x Lp) x P", styles['Small']))
    story.append(Paragraph(
        f"O mínimo técnico de perda para esta infraestrutura é "
        f"<b>{uarl.get('uarl_litros_dia',0):,.0f} L/dia</b> = "
        f"<b>{uarl.get('uarl_m3_ano',0):,.0f} m3/ano</b>.", styles['Body']))
    
    comp = uarl.get("componentes", {})
    uarl_data = [
        ["Componente", "Valor (L/dia)", "% do UARL"],
        ["Rede (18 x km)", f"{comp.get('rede',0):,.0f}", 
         f"{comp.get('rede',0)/(uarl.get('uarl_litros_dia',1))*100:.1f}%"],
        ["Conexões (0.8 x N)", f"{comp.get('conexoes',0):,.0f}",
         f"{comp.get('conexoes',0)/(uarl.get('uarl_litros_dia',1))*100:.1f}%"],
        ["Ramais (25 x km)", f"{comp.get('ramais',0):,.0f}",
         f"{comp.get('ramais',0)/(uarl.get('uarl_litros_dia',1))*100:.1f}%"],
        ["TOTAL", f"{uarl.get('uarl_litros_dia',0):,.0f}", "100%"],
    ]
    t = Table(uarl_data, colWidths=[60*mm, 50*mm, 40*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), AGUA),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 6*mm))
    
    # ── 3. BALANÇO HÍDRICO ──
    balanco = relatorio.get("balanco_hidrico")
    ili_data = relatorio.get("ili")
    
    if balanco:
        story.append(Paragraph("3. BALANÇO HÍDRICO — Metodologia IWA", styles['H2']))
        
        bh_data = [
            ["Componente", "Volume (m3/mês)", "%", "Custo (R$/mês)"],
            ["Volume de Entrada", f"{balanco['vol_entrada_m3']:,.0f}", "100%", "—"],
            ["Água Faturada", f"{balanco['agua_faturada_m3']:,.0f}",
             f"{balanco['agua_faturada_m3']/balanco['vol_entrada_m3']*100:.1f}%", "—"],
            ["NRW (Não Faturada)", f"{balanco['agua_nao_faturada_m3']:,.0f}",
             f"{balanco['nrw_pct']:.1f}%", f"R$ {balanco['receita_perdida_rs']:,.0f}"],
            ["  Perdas Reais", f"{balanco['perdas_reais_m3']:,.0f}",
             f"{balanco['perdas_reais_pct']:.1f}%", f"R$ {balanco['custo_perdas_reais_rs']:,.0f}"],
            ["  Perdas Aparentes", f"{balanco['perdas_aparentes_m3']:,.0f}",
             f"{balanco['perdas_aparentes_pct']:.1f}%", "—"],
            ["    Submedição", f"{balanco['submedição_est_m3']:,.0f}", "—", "—"],
            ["    Fraude", f"{balanco['fraude_est_m3']:,.0f}", "—", "—"],
        ]
        t = Table(bh_data, colWidths=[50*mm, 40*mm, 25*mm, 40*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), AZUL),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('BACKGROUND', (0,3), (-1,3), BG_VERM),
            ('BACKGROUND', (0,4), (-1,4), BG_VERM),
            ('FONTNAME', (0,3), (-1,4), 'Helvetica-Bold'),
            ('TEXTCOLOR', (0,4), (0,4), VERM),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(t)
        story.append(Spacer(1, 8*mm))
        
        # ILI
        if ili_data:
            story.append(Paragraph("4. ILI — Infrastructure Leakage Index", styles['H2']))
            ili_val = ili_data.get("ili", 0)
            ili_cls = ili_data.get("classificacao", "—")
            cor_ili = VERDE if ili_val < 4 else (colors.orange if ili_val < 8 else VERM)
            
            story.append(Paragraph(f"ILI = Perdas Reais / UARL = {ili_val:.2f}", styles['Center']))
            story.append(Spacer(1, 3*mm))
            
            ili_class_style = ParagraphStyle('ILICls', parent=styles['Normal'], 
                alignment=TA_CENTER, fontSize=20, textColor=cor_ili, leading=24)
            story.append(Paragraph(f"<b>{ili_cls}</b>", ili_class_style))
            story.append(Spacer(1, 4*mm))
            
            story.append(Paragraph(
                "Escala: &lt;2 Excelente | 2-4 Bom | 4-8 Regular | 8-16 Ruim | &gt;16 Critico. "
                f"Brasil medio: 5-12. Potencial de reducao: {ili_data.get('potencial_reducao_pct',0)}%.",
                styles['Small']))
    else:
        story.append(Paragraph("3. ANÁLISE PREVENTIVA (Rede Nova)", styles['H2']))
        story.append(Paragraph(
            "Sem dados de macromedição. O UARL calculado serve para dimensionar DMAs "
            "e planejar a instalação de instrumentação desde o comissionamento.", styles['Body']))
    
    story.append(PageBreak())
    
    # ── RISCO ──
    risco = relatorio.get("risco", {})
    resumo_risco = risco.get("resumo", {})
    
    sec = 5 if balanco else 3
    story.append(Paragraph(f"{sec}. MAPA DE RISCO DE RUPTURA", styles['H2']))
    
    por_nivel = resumo_risco.get("por_nivel", {})
    risco_data = [["Nível", "Trechos", "Extensão (m)", "Custo Risco (R$/ano)"]]
    for nivel in ["BAIXO", "MÉDIO", "ALTO", "CRÍTICO"]:
        d = por_nivel.get(nivel, {"n":0, "ext":0, "custo":0})
        if d["n"] > 0:
            risco_data.append([nivel, str(d["n"]), f"{d['ext']:,.0f}", f"R$ {d['custo']:,.0f}"])
    risco_data.append(["TOTAL", "", "", f"R$ {resumo_risco.get('custo_risco_total_ano',0):,.0f}"])
    
    t = Table(risco_data, colWidths=[35*mm, 30*mm, 40*mm, 50*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), AZUL),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 6*mm))
    
    # Top 10
    top10 = risco.get("top10", [])
    if top10:
        story.append(Paragraph("Top 10 Trechos com Maior Risco", styles['Body']))
        top_data = [["NS", "Material", "DN", "Ext (m)", "Prob. Ruptura", "Nível"]]
        for r in top10[:10]:
            top_data.append([
                r.get("ns",""), r.get("material",""), str(r.get("dn_mm","")),
                f"{r.get('ext_m',0):.1f}", f"{r.get('prob_ruptura_ano',0)*100:.2f}%",
                r.get("nivel_risco","")
            ])
        t = Table(top_data, colWidths=[40*mm, 25*mm, 18*mm, 22*mm, 28*mm, 22*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), AGUA),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(t)
    
    story.append(Spacer(1, 8*mm))
    
    # ── DMAs ──
    dmas = relatorio.get("dmas", {})
    sec += 1
    story.append(Paragraph(f"{sec}. DMAs RECOMENDADOS", styles['H2']))
    
    dma_list = dmas.get("dmas", [])
    if dma_list:
        dma_data = [["DMA", "PVs", "Extensão", "Ligações", "Macromedidor"]]
        for d in dma_list:
            dma_data.append([d["dma_id"], str(d["n_pvs"]), f"{d['extensao_m']}m",
                           f"~{d['n_ligacoes_est']}", d["monitoramento"]["macro_medidor"]])
        t = Table(dma_data, colWidths=[30*mm, 20*mm, 30*mm, 28*mm, 35*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), AGUA),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(t)
    
    story.append(Spacer(1, 8*mm))
    
    # ── RECOMENDAÇÕES ──
    sec += 1
    story.append(Paragraph(f"{sec}. RECOMENDAÇÕES", styles['H2']))
    recs = relatorio.get("recomendacoes", [])
    for i, r in enumerate(recs):
        story.append(Paragraph(f"<b>{i+1}.</b> {r}", styles['Body']))
    
    # ── ASSINATURAS ──
    story.append(Spacer(1, 20*mm))
    sig = Table([["_"*40, "_"*40]], colWidths=[80*mm, 80*mm])
    sig.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('TOPPADDING', (0,0), (-1,-1), 20),
    ]))
    story.append(sig)
    sig2 = Table([["Responsável Técnico", "Gerência de Perdas"]], colWidths=[80*mm, 80*mm])
    sig2.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('TEXTCOLOR', (0,0), (-1,-1), CINZA),
    ]))
    story.append(sig2)
    
    doc.build(story)
    return out_path


if __name__ == "__main__":
    sys.path.insert(0, "/mnt/user-data/outputs")
    sys.path.insert(0, "CONSTRUDATA_BIM_V6/scripts")
    
    from ler_dxf_gdal import ler_dxf_gdal
    from motor_perdas import gerar_relatorio_perdas
    
    pvs, trechos, _, _ = ler_dxf_gdal("/home/claude/VERDE_TETEU.dxf")
    
    rel = gerar_relatorio_perdas(pvs, trechos, "Verde e Teteu",
        vol_produzido=45000, vol_micromedido=28000, pressao_media=35)
    
    out = "/mnt/user-data/outputs/RELATORIO_PERDAS_VERDE_TETEU.pdf"
    gerar_pdf_perdas(rel, out, "Verde e Teteu")
    print(f"PDF gerado: {out} ({os.path.getsize(out)/1024:.0f} KB)")
