#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════╗
║         CONSTRUDATA ENGENHARIA - SUPER PLANEJADOR SLNR               ║
║         Versão 1.0 | GeoPackage → Saldo → Excel → Dashboard          ║
║                                                                      ║
║  Pipeline:                                                           ║
║    1. Lê GeoPackage (redes / pvs / registros)                        ║
║    2. Corrige CRS se necessário (EPSG:4326 label → EPSG:31983)       ║
║    3. Calcula quantitativos por status e por núcleo                  ║
║    4. Cruza com Planilha Mestre (planejado SLNR)                     ║
║    5. Calcula Saldo (Planejado − Executado)                           ║
║    6. Gera Lista de Compras + catálogo de fornecedores               ║
║    7. Exporta Excel multi-aba com formatação CONSTRUDATA             ║
║    8. Gera dashboard HTML embutido (construplan_brutal.html)         ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import sys
import os
import warnings
warnings.filterwarnings('ignore')

import geopandas as gpd
import pandas as pd
import numpy as np
import fiona
from pathlib import Path
from datetime import datetime

# ─────────────────────────────────────────────────────────────────────
# CONFIGURAÇÕES GLOBAIS — ajuste conforme seu projeto
# ─────────────────────────────────────────────────────────────────────
CONFIG = {
    # ── Arquivos de entrada ──────────────────────────────────────────
    "gpkg_path"   : "tudo_feito_ate_março.gpkg",   # altere aqui
    "mestre_path" : "MESTRE_SLNR_FINAL4.xlsx",      # altere aqui

    # ── Mapeamento de layers no GeoPackage ───────────────────────────
    "layer_redes"     : "redes_esgoto_agua",   # ou "redes", "esgoto", etc.
    "layer_pvs"       : "pvs",
    "layer_registros" : "registros",

    # ── Colunas esperadas nos layers ─────────────────────────────────
    "col_nucleo"     : "nucleo",
    "col_status"     : "status",        # EXECUTADO / EM ANDAMENTO / A EXECUTAR
    "col_material"   : "material",
    "col_diametro"   : "diametro",
    "col_comprimento": "comprimento",   # metros, em redes
    "col_tipo_pv"    : "tipo",
    "col_tipo_reg"   : "tipo",
    "col_preco_unit" : "preco_unit_m",  # preço/m nas redes

    # ── CRS fix ──────────────────────────────────────────────────────
    # Se o .gpkg tiver label EPSG:4326 mas dados em UTM 23S (EPSG:31983)
    # defina force_crs=True
    "force_crs"  : False,
    "crs_real"   : "EPSG:31983",

    # ── Status válidos ────────────────────────────────────────────────
    "status_exec"  : "EXECUTADO",
    "status_and"   : "EM ANDAMENTO",
    "status_plan"  : "A EXECUTAR",

    # ── Saídas ───────────────────────────────────────────────────────
    "excel_out"     : "CONSTRUDATA_PLANEJADOR.xlsx",
    "dashboard_out" : "construplan_brutal.html",

    # ── Projeto ──────────────────────────────────────────────────────
    "projeto"     : "SE LIGA NA REDE - SANTOS",
    "contrato"    : "Consórcio SLNR Santos",
    "empresa"     : "CONSTRUDATA ENGENHARIA",
    "responsavel" : "Felipe Nery",
}

# ─────────────────────────────────────────────────────────────────────
# CATÁLOGO DE FORNECEDORES
# (adaptável - pode virar tabela Excel/DB separado)
# ─────────────────────────────────────────────────────────────────────
CATALOGO_FORNECEDORES = {
    # Chave: (material, diâmetro) ou apenas (tipo,)
    # Valor: {fornecedor, contato, prazo_entrega_dias, observacao}

    # TUBOS PVC
    ("PVC", "DN100"): {"fornecedor": "Tigre S.A.",           "contato": "0800 726 8836", "prazo_dias": 5,  "obs": "Bar 6m, SN8, NBR 7362"},
    ("PVC", "DN150"): {"fornecedor": "Tigre S.A.",           "contato": "0800 726 8836", "prazo_dias": 5,  "obs": "Bar 6m, SN8, NBR 7362"},
    ("PVC", "DN200"): {"fornecedor": "Amanco Wavin",         "contato": "(11) 2111-4000","prazo_dias": 7,  "obs": "Bar 6m, SN8, NBR 7362"},
    ("PVC", "DN250"): {"fornecedor": "Amanco Wavin",         "contato": "(11) 2111-4000","prazo_dias": 10, "obs": "Bar 6m, SN4, NBR 7362"},

    # TUBOS PEAD
    ("PEAD","DN100"): {"fornecedor": "Plastubos",            "contato": "(13) 3219-0000","prazo_dias": 7,  "obs": "Rolo 100m, PE100, PN10"},
    ("PEAD","DN150"): {"fornecedor": "Plastubos",            "contato": "(13) 3219-0000","prazo_dias": 7,  "obs": "Barra 12m, PE100"},
    ("PEAD","DN200"): {"fornecedor": "Fortlev",              "contato": "(11) 4063-9600","prazo_dias": 10, "obs": "Barra 12m, PE100"},
    ("PEAD","DN300"): {"fornecedor": "Fortlev",              "contato": "(11) 4063-9600","prazo_dias": 14, "obs": "Barra 12m, PE100"},

    # TUBOS GRÉS
    ("GRÉS","DN100"): {"fornecedor": "São Simão Cerâmica",   "contato": "(19) 3835-0000","prazo_dias": 10, "obs": "Bar 1m, NBR 8094"},
    ("GRÉS","DN150"): {"fornecedor": "São Simão Cerâmica",   "contato": "(19) 3835-0000","prazo_dias": 10, "obs": "Bar 1m, NBR 8094"},

    # TUBOS CONCRETO
    ("CONCRETO","DN300"): {"fornecedor": "Premold Santos",   "contato": "(13) 3222-0000","prazo_dias": 5,  "obs": "Macho-fêmea, NBR 8890"},
    ("CONCRETO","DN400"): {"fornecedor": "Premold Santos",   "contato": "(13) 3222-0000","prazo_dias": 5,  "obs": "Macho-fêmea, NBR 8890"},

    # PVS
    ("PV PADRÃO SABESP",): {"fornecedor": "Prémoldado Santos","contato": "(13) 3225-0000","prazo_dias": 7,  "obs": "Anéis 0,60m diam, NBR 9794"},
    ("PV ESPECIAL",):      {"fornecedor": "Prémoldado Santos","contato": "(13) 3225-0000","prazo_dias": 14, "obs": "Conforme projeto"},
    ("CX INSPECAO",):      {"fornecedor": "Romatel",          "contato": "(11) 5012-0000","prazo_dias": 5,  "obs": "PP injetado"},
    ("TIL",):              {"fornecedor": "Romatel",          "contato": "(11) 5012-0000","prazo_dias": 5,  "obs": "TIL 150mm padrão"},

    # REGISTROS
    ("REG GAVETA DN50",):        {"fornecedor": "Rexnord Elster","contato":"(11)3305-0000","prazo_dias":5, "obs":"PN16, bronze"},
    ("REG GAVETA DN75",):        {"fornecedor": "Rexnord Elster","contato":"(11)3305-0000","prazo_dias":5, "obs":"PN16, bronze"},
    ("REG GAVETA DN100",):       {"fornecedor": "Rexnord Elster","contato":"(11)3305-0000","prazo_dias":7, "obs":"PN16, FoFo"},
    ("REG BORBOLETA DN100",):    {"fornecedor": "Inoval",        "contato":"(11)4063-0000","prazo_dias":7, "obs":"PN16, FoFo"},
    ("REG BORBOLETA DN150",):    {"fornecedor": "Inoval",        "contato":"(11)4063-0000","prazo_dias":10,"obs":"PN16, FoFo"},
    ("REG BORBOLETA DN200",):    {"fornecedor": "Inoval",        "contato":"(11)4063-0000","prazo_dias":14,"obs":"PN16, FoFo"},
    ("HIDRANTE DN75",):          {"fornecedor": "Durall",        "contato":"(11)2996-0000","prazo_dias":10,"obs":"Coluna, NBR 14880"},
    ("VALVULA DE RETENCAO DN50",):{"fornecedor":"Rexnord Elster","contato":"(11)3305-0000","prazo_dias":5, "obs":"PN10, bronze"},
    ("VALVULA DE RETENCAO DN75",):{"fornecedor":"Rexnord Elster","contato":"(11)3305-0000","prazo_dias":7, "obs":"PN10, FoFo"},
    ("CAP TERMINAL DN100",):     {"fornecedor": "Tigre S.A.",    "contato":"0800 726 8836","prazo_dias":3, "obs":"Cap PVC soldável"},
}

# ─────────────────────────────────────────────────────────────────────
# FUNÇÕES AUXILIARES
# ─────────────────────────────────────────────────────────────────────

def log(msg, nivel="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    icons = {"INFO":"ℹ️ ","OK":"✅","WARN":"⚠️ ","ERR":"❌"}
    print(f"[{ts}] {icons.get(nivel,'  ')}{msg}")


def detectar_layers(gpkg_path):
    """Detecta automaticamente os layers do GeoPackage e tenta mapear."""
    layers = fiona.listlayers(gpkg_path)
    log(f"Layers encontrados: {layers}")

    mapeamento = {}
    kw_redes   = ["rede","trecho","tubo","esgoto","agua","coletor","adutora"]
    kw_pvs     = ["pv","poco","poco_visita","poco de visita","manhole","caixa"]
    kw_reg     = ["registro","valvula","valve","hidrante","equipamento","acessorio"]

    for l in layers:
        ll = l.lower()
        if any(k in ll for k in kw_redes) and "redes" not in mapeamento:
            mapeamento["redes"] = l
        elif any(k in ll for k in kw_pvs) and "pvs" not in mapeamento:
            mapeamento["pvs"] = l
        elif any(k in ll for k in kw_reg) and "registros" not in mapeamento:
            mapeamento["registros"] = l

    log(f"Mapeamento automático: {mapeamento}", "OK")
    return mapeamento, layers


def corrigir_crs(gdf, force_crs, crs_real):
    """Corrige o problema clássico: label EPSG:4326 mas dados UTM 23S."""
    if force_crs:
        log(f"Forçando CRS para {crs_real} (dados originais)", "WARN")
        gdf = gdf.set_crs(crs_real, allow_override=True)
    else:
        if gdf.crs and gdf.crs.to_epsg() == 4326:
            # Verificar se os valores de coordenada são grandes (UTM) não lat/lon
            if hasattr(gdf.geometry.iloc[0], 'x'):
                sample_x = gdf.geometry.iloc[0].x
            else:
                sample_x = gdf.geometry.iloc[0].centroid.x
            if abs(sample_x) > 180:
                log("CRS mislabeled detectado! EPSG:4326 → sobrescrevendo com EPSG:31983", "WARN")
                gdf = gdf.set_crs(crs_real, allow_override=True)
    return gdf


def calcular_comprimento_real(gdf):
    """Calcula comprimento real se a coluna não existir ou for zero."""
    col = CONFIG["col_comprimento"]
    if col not in gdf.columns or gdf[col].fillna(0).sum() == 0:
        log("Coluna de comprimento ausente/zerada → calculando da geometria", "WARN")
        gdf = gdf.copy()
        gdf[col] = gdf.geometry.length.round(2)
    return gdf


def ler_gpkg(gpkg_path):
    """Lê o GeoPackage e retorna as 3 camadas principais."""
    log(f"Abrindo GeoPackage: {gpkg_path}")
    mapeamento, layers_disponiveis = detectar_layers(gpkg_path)

    # Layer REDES
    layer_r = mapeamento.get("redes", CONFIG["layer_redes"])
    if layer_r not in layers_disponiveis:
        layer_r = layers_disponiveis[0]
        log(f"Layer redes não encontrado, usando: {layer_r}", "WARN")
    gdf_redes = gpd.read_file(gpkg_path, layer=layer_r)
    gdf_redes = corrigir_crs(gdf_redes, CONFIG["force_crs"], CONFIG["crs_real"])
    gdf_redes = calcular_comprimento_real(gdf_redes)
    log(f"Redes: {len(gdf_redes)} feições | CRS: {gdf_redes.crs}", "OK")

    # Layer PVS
    gdf_pvs = None
    layer_pv = mapeamento.get("pvs", CONFIG["layer_pvs"])
    if layer_pv in layers_disponiveis:
        gdf_pvs = gpd.read_file(gpkg_path, layer=layer_pv)
        gdf_pvs = corrigir_crs(gdf_pvs, CONFIG["force_crs"], CONFIG["crs_real"])
        log(f"PVs: {len(gdf_pvs)} feições", "OK")
    else:
        log("Layer PVs não encontrado", "WARN")

    # Layer REGISTROS
    gdf_reg = None
    layer_reg = mapeamento.get("registros", CONFIG["layer_registros"])
    if layer_reg in layers_disponiveis:
        gdf_reg = gpd.read_file(gpkg_path, layer=layer_reg)
        gdf_reg = corrigir_crs(gdf_reg, CONFIG["force_crs"], CONFIG["crs_real"])
        log(f"Registros: {len(gdf_reg)} feições", "OK")
    else:
        log("Layer Registros não encontrado", "WARN")

    return gdf_redes, gdf_pvs, gdf_reg


def normalizar_status(gdf):
    """Padroniza os status para os 3 padrões esperados."""
    mapa = {
        # Variações comuns
        "executado"    : CONFIG["status_exec"],
        "concluido"    : CONFIG["status_exec"],
        "concluído"    : CONFIG["status_exec"],
        "feito"        : CONFIG["status_exec"],
        "ok"           : CONFIG["status_exec"],
        "em andamento" : CONFIG["status_and"],
        "andamento"    : CONFIG["status_and"],
        "em_andamento" : CONFIG["status_and"],
        "parcial"      : CONFIG["status_and"],
        "a executar"   : CONFIG["status_plan"],
        "a_executar"   : CONFIG["status_plan"],
        "pendente"     : CONFIG["status_plan"],
        "planejado"    : CONFIG["status_plan"],
        "nao iniciado" : CONFIG["status_plan"],
        "não iniciado" : CONFIG["status_plan"],
    }
    col = CONFIG["col_status"]
    if col in gdf.columns:
        gdf = gdf.copy()
        gdf[col] = gdf[col].str.strip().str.upper()
        gdf[col] = gdf[col].str.lower().map(mapa).fillna(gdf[col])
    return gdf


# ─────────────────────────────────────────────────────────────────────
# ANÁLISES PRINCIPAIS
# ─────────────────────────────────────────────────────────────────────

def analisar_redes(gdf):
    """Retorna dicts com todos os cálculos de redes."""
    gdf = normalizar_status(gdf)
    col_n = CONFIG["col_nucleo"]
    col_s = CONFIG["col_status"]
    col_m = CONFIG["col_material"]
    col_d = CONFIG["col_diametro"]
    col_c = CONFIG["col_comprimento"]
    STATUS_EX = CONFIG["status_exec"]
    STATUS_AN = CONFIG["status_and"]
    STATUS_PL = CONFIG["status_plan"]
    PENDENTES  = [STATUS_AN, STATUS_PL]

    # ── Saldo por material + diâmetro ────────────────────────────────
    g = gdf.copy()

    def _sum_status(df, col_val, stat):
        mask = df[col_s] == stat
        return df.loc[mask, col_val].sum()

    saldo = g.groupby([col_m, col_d]).apply(
        lambda df: pd.Series({
            "planejado_m"    : df[col_c].sum(),
            "executado_m"    : df.loc[df[col_s]==STATUS_EX, col_c].sum(),
            "em_andamento_m" : df.loc[df[col_s]==STATUS_AN, col_c].sum(),
            "a_executar_m"   : df.loc[df[col_s]==STATUS_PL, col_c].sum(),
            "qtd_trechos"    : len(df),
        })
    ).reset_index()
    saldo["saldo_m"]   = saldo["a_executar_m"] + saldo["em_andamento_m"]
    saldo["pct_exec"]  = (saldo["executado_m"] / saldo["planejado_m"] * 100).round(1)

    # ── Por núcleo ────────────────────────────────────────────────────
    por_nucleo = g.groupby(col_n).apply(
        lambda df: pd.Series({
            "extensao_total_m" : df[col_c].sum(),
            "executado_m"      : df.loc[df[col_s]==STATUS_EX, col_c].sum(),
            "em_andamento_m"   : df.loc[df[col_s]==STATUS_AN, col_c].sum(),
            "a_executar_m"     : df.loc[df[col_s]==STATUS_PL, col_c].sum(),
            "n_trechos"        : len(df),
        })
    ).reset_index()
    por_nucleo["pct_exec"] = (por_nucleo["executado_m"] / por_nucleo["extensao_total_m"] * 100).round(1)
    por_nucleo = por_nucleo.sort_values("pct_exec", ascending=False).reset_index(drop=True)

    # ── Lista de compras (tubos) ──────────────────────────────────────
    pend = g[g[col_s].isin(PENDENTES)]
    compras_tubos = pend.groupby([col_m, col_d]).apply(
        lambda df: pd.Series({
            "extensao_necessaria_m" : round(df[col_c].sum(), 2),
            "barras_6m"             : int(np.ceil(df[col_c].sum() / 6)),
            "barras_12m"            : int(np.ceil(df[col_c].sum() / 12)),
        })
    ).reset_index()

    # Adicionar fornecedor do catálogo
    def get_fornecedor(row):
        key = (row[col_m], row[col_d])
        f = CATALOGO_FORNECEDORES.get(key, {})
        return pd.Series({
            "fornecedor"   : f.get("fornecedor", "—"),
            "contato"      : f.get("contato", "—"),
            "prazo_dias"   : f.get("prazo_dias", "—"),
            "especificacao": f.get("obs", "—"),
        })
    compras_tubos = pd.concat([compras_tubos, compras_tubos.apply(get_fornecedor, axis=1)], axis=1)

    return {
        "saldo"       : saldo,
        "por_nucleo"  : por_nucleo,
        "compras"     : compras_tubos,
        "total_plan"  : g[col_c].sum(),
        "total_exec"  : g.loc[g[col_s]==STATUS_EX, col_c].sum(),
        "total_pend"  : pend[col_c].sum(),
    }


def analisar_pvs(gdf):
    """Calcula saldo e lista de compras de PVs."""
    if gdf is None:
        return None
    gdf = normalizar_status(gdf)
    col_n = CONFIG["col_nucleo"]
    col_s = CONFIG["col_status"]
    col_t = CONFIG["col_tipo_pv"]
    STATUS_EX = CONFIG["status_exec"]
    STATUS_AN = CONFIG["status_and"]
    STATUS_PL = CONFIG["status_plan"]
    PENDENTES  = [STATUS_AN, STATUS_PL]

    saldo = gdf.groupby(col_t).apply(
        lambda df: pd.Series({
            "total"          : len(df),
            "executado"      : (df[col_s]==STATUS_EX).sum(),
            "em_andamento"   : (df[col_s]==STATUS_AN).sum(),
            "a_executar"     : (df[col_s]==STATUS_PL).sum(),
        })
    ).reset_index()
    saldo["pct_exec"] = (saldo["executado"] / saldo["total"] * 100).round(1)

    pend = gdf[gdf[col_s].isin(PENDENTES)]
    compras = pend.groupby(col_t).size().reset_index(name="quantidade_necessaria")

    def get_forn_pv(row):
        key = (row[col_t],)
        f = CATALOGO_FORNECEDORES.get(key, {})
        return pd.Series({
            "fornecedor" : f.get("fornecedor","—"),
            "contato"    : f.get("contato","—"),
            "prazo_dias" : f.get("prazo_dias","—"),
            "obs"        : f.get("obs","—"),
        })
    compras = pd.concat([compras, compras.apply(get_forn_pv, axis=1)], axis=1)

    por_nucleo = gdf.groupby(col_n).apply(
        lambda df: pd.Series({
            "total_pvs"  : len(df),
            "executado"  : (df[col_s]==STATUS_EX).sum(),
            "pendente"   : (df[col_s].isin(PENDENTES)).sum(),
        })
    ).reset_index()

    return {"saldo": saldo, "compras": compras, "por_nucleo": por_nucleo,
            "total": len(gdf), "total_exec": (gdf[col_s]==STATUS_EX).sum()}


def analisar_registros(gdf):
    """Calcula saldo e lista de compras de registros."""
    if gdf is None:
        return None
    gdf = normalizar_status(gdf)
    col_n = CONFIG["col_nucleo"]
    col_s = CONFIG["col_status"]
    col_t = CONFIG["col_tipo_reg"]
    STATUS_EX = CONFIG["status_exec"]
    STATUS_AN = CONFIG["status_and"]
    STATUS_PL = CONFIG["status_plan"]
    PENDENTES  = [STATUS_AN, STATUS_PL]

    saldo = gdf.groupby(col_t).apply(
        lambda df: pd.Series({
            "total"        : len(df),
            "executado"    : (df[col_s]==STATUS_EX).sum(),
            "em_andamento" : (df[col_s]==STATUS_AN).sum(),
            "a_executar"   : (df[col_s]==STATUS_PL).sum(),
        })
    ).reset_index()
    saldo["pct_exec"] = (saldo["executado"] / saldo["total"] * 100).round(1)

    pend = gdf[gdf[col_s].isin(PENDENTES)]
    compras = pend.groupby(col_t).size().reset_index(name="quantidade_necessaria")

    def get_forn_reg(row):
        key = (row[col_t],)
        f = CATALOGO_FORNECEDORES.get(key, {})
        return pd.Series({
            "fornecedor" : f.get("fornecedor","—"),
            "contato"    : f.get("contato","—"),
            "prazo_dias" : f.get("prazo_dias","—"),
            "obs"        : f.get("obs","—"),
        })
    compras = pd.concat([compras, compras.apply(get_forn_reg, axis=1)], axis=1)

    return {"saldo": saldo, "compras": compras,
            "total": len(gdf), "total_exec": (gdf[col_s]==STATUS_EX).sum()}


# ─────────────────────────────────────────────────────────────────────
# EXPORTAÇÃO EXCEL
# ─────────────────────────────────────────────────────────────────────

def exportar_excel(res_redes, res_pvs, res_reg, output_path):
    """Gera Excel multi-aba com formatação CONSTRUDATA."""
    log(f"Gerando Excel: {output_path}")

    with pd.ExcelWriter(output_path, engine="xlsxwriter") as writer:
        wb = writer.book

        # ── Formatos ─────────────────────────────────────────────────
        fmt_titulo = wb.add_format({
            "bold": True, "font_size": 14, "bg_color": "#0A2342",
            "font_color": "white", "align": "center", "valign": "vcenter",
            "border": 1
        })
        fmt_header = wb.add_format({
            "bold": True, "font_size": 10, "bg_color": "#1A6B3A",
            "font_color": "white", "align": "center", "valign": "vcenter",
            "border": 1, "text_wrap": True
        })
        fmt_header_orange = wb.add_format({
            "bold": True, "font_size": 10, "bg_color": "#C0392B",
            "font_color": "white", "align": "center", "valign": "vcenter",
            "border": 1, "text_wrap": True
        })
        fmt_data = wb.add_format({
            "font_size": 9, "border": 1, "align": "center"
        })
        fmt_data_left = wb.add_format({
            "font_size": 9, "border": 1, "align": "left"
        })
        fmt_num = wb.add_format({
            "font_size": 9, "border": 1, "num_format": "#,##0.00", "align": "right"
        })
        fmt_pct = wb.add_format({
            "font_size": 9, "border": 1, "num_format": "0.0\"%\"", "align": "center"
        })
        fmt_ok = wb.add_format({
            "font_size": 9, "border": 1, "bg_color": "#D5F5E3",
            "align": "center", "bold": True, "font_color": "#1A6B3A"
        })
        fmt_warn = wb.add_format({
            "font_size": 9, "border": 1, "bg_color": "#FDEBD0",
            "align": "center", "bold": True, "font_color": "#E67E22"
        })
        fmt_danger = wb.add_format({
            "font_size": 9, "border": 1, "bg_color": "#FADBD8",
            "align": "center", "bold": True, "font_color": "#C0392B"
        })

        def escrever_df(ws, df, row_start, col_start,
                        fmt_h=None, fmt_d=None, fmt_n=None, colunas_num=None):
            """Helper para escrever DataFrame no Excel com formatação."""
            if fmt_h is None: fmt_h = fmt_header
            if fmt_d is None: fmt_d = fmt_data
            if fmt_n is None: fmt_n = fmt_num
            if colunas_num is None: colunas_num = []

            for ci, col in enumerate(df.columns):
                ws.write(row_start, col_start + ci, col, fmt_h)
            for ri, row in enumerate(df.itertuples(index=False)):
                for ci, val in enumerate(row):
                    col_name = df.columns[ci]
                    fmt_use = fmt_n if col_name in colunas_num else fmt_d
                    ws.write(row_start + 1 + ri, col_start + ci, val, fmt_use)

        # ════════════════════════════════════════════════════════════
        # ABA 1: PAINEL GERAL
        # ════════════════════════════════════════════════════════════
        ws1 = wb.add_worksheet("📊 PAINEL GERAL")
        ws1.set_zoom(90)
        ws1.set_row(0, 40)
        ws1.merge_range("A1:L1",
            f"CONSTRUDATA ENGENHARIA | {CONFIG['projeto']} | {CONFIG['contrato']}", fmt_titulo)

        # KPIs principais
        info = wb.add_format({"bold":True,"font_size":11,"bg_color":"#ECF0F1","border":1,"align":"center"})
        val  = wb.add_format({"bold":True,"font_size":18,"bg_color":"#2C3E50","font_color":"#3498DB","border":2,"align":"center"})
        val_g= wb.add_format({"bold":True,"font_size":18,"bg_color":"#1A6B3A","font_color":"white","border":2,"align":"center"})
        val_r= wb.add_format({"bold":True,"font_size":18,"bg_color":"#C0392B","font_color":"white","border":2,"align":"center"})

        kpis = [
            ("Extensão Total",    f"{res_redes['total_plan']:,.0f} m",    val),
            ("Executada",         f"{res_redes['total_exec']:,.0f} m",    val_g),
            ("Saldo a Executar",  f"{res_redes['total_pend']:,.0f} m",    val_r),
            ("% Executado",       f"{res_redes['total_exec']/res_redes['total_plan']*100:.1f}%", val_g),
        ]
        if res_pvs:
            kpis += [
                ("Total PVs",     f"{res_pvs['total']}",              val),
                ("PVs Executados",f"{res_pvs['total_exec']}",         val_g),
            ]
        if res_reg:
            kpis += [
                ("Total Registros",   f"{res_reg['total']}",          val),
                ("Reg Executados",    f"{res_reg['total_exec']}",      val_g),
            ]

        ws1.set_row(2, 20); ws1.set_row(3, 50)
        for i, (lbl, v, fmt_v) in enumerate(kpis[:8]):
            col_e = i + 1
            ws1.set_column(col_e, col_e, 16)
            ws1.write(2, col_e, lbl, info)
            ws1.write(3, col_e, v, fmt_v)

        # Progresso por núcleo
        ws1.write(5, 0, "PROGRESSO POR NÚCLEO", fmt_header)
        pn = res_redes["por_nucleo"].copy()
        pn.columns = ["Núcleo","Ext. Total (m)","Executado (m)","Em Andamento (m)","A Executar (m)","Nº Trechos","% Exec"]
        headers_nucleo = list(pn.columns)
        for ci, h in enumerate(headers_nucleo):
            ws1.write(6, ci, h, fmt_header)
        for ri, row in enumerate(pn.itertuples(index=False)):
            for ci, val_cell in enumerate(row):
                pct = row[-1] if hasattr(row, '__len__') else None
                # Colorir % de execução
                if ci == len(headers_nucleo)-1:
                    pct_val = float(str(val_cell).replace('%',''))
                    f = fmt_ok if pct_val >= 60 else (fmt_warn if pct_val >= 20 else fmt_danger)
                    ws1.write(7+ri, ci, val_cell, f)
                elif ci in [1,2,3,4]:
                    ws1.write(7+ri, ci, val_cell, fmt_num)
                else:
                    ws1.write(7+ri, ci, val_cell, fmt_data)
        ws1.set_column("A:A", 25)
        ws1.set_column("B:G", 16)

        # ════════════════════════════════════════════════════════════
        # ABA 2: SALDO DE REDES
        # ════════════════════════════════════════════════════════════
        ws2 = wb.add_worksheet("🔵 SALDO REDES")
        ws2.merge_range("A1:H1", "SALDO DE REDES — PLANEJADO vs EXECUTADO", fmt_titulo)
        df_saldo = res_redes["saldo"].copy()
        df_saldo.columns = ["Material","Diâmetro","Planejado (m)","Executado (m)",
                            "Em Andamento (m)","A Executar (m)","Qtd Trechos","Saldo (m)","% Exec"]
        escrever_df(ws2, df_saldo, 2, 0,
                    colunas_num=["Planejado (m)","Executado (m)","Em Andamento (m)","A Executar (m)","Saldo (m)"])
        # Colorir % exec
        for ri, row in enumerate(df_saldo.itertuples(index=False)):
            pct = float(str(row[-1]).replace('%',''))
            f = fmt_ok if pct>=60 else (fmt_warn if pct>=20 else fmt_danger)
            ws2.write(3+ri, len(df_saldo.columns)-1, row[-1], f)
        [ws2.set_column(i, i, 16) for i in range(len(df_saldo.columns))]

        # ════════════════════════════════════════════════════════════
        # ABA 3: LISTA DE COMPRAS — TUBOS
        # ════════════════════════════════════════════════════════════
        ws3 = wb.add_worksheet("🛒 COMPRAS TUBOS")
        ws3.merge_range("A1:I1",
            f"LISTA DE COMPRAS — TUBULAÇÕES | Gerado em {datetime.now():%d/%m/%Y %H:%M}", fmt_titulo)
        df_comp = res_redes["compras"].copy()
        escrever_df(ws3, df_comp, 2, 0, fmt_h=fmt_header_orange,
                    colunas_num=["extensao_necessaria_m"])
        [ws3.set_column(i, i, 20) for i in range(len(df_comp.columns))]

        # ════════════════════════════════════════════════════════════
        # ABA 4: PVS
        # ════════════════════════════════════════════════════════════
        if res_pvs:
            ws4 = wb.add_worksheet("🔵 PVS")
            ws4.merge_range("A1:G1", "POÇOS DE VISITA — SALDO E COMPRAS", fmt_titulo)
            escrever_df(ws4, res_pvs["saldo"], 2, 0)
            escrever_df(ws4, res_pvs["compras"], 2, len(res_pvs["saldo"].columns)+1,
                        fmt_h=fmt_header_orange)

        # ════════════════════════════════════════════════════════════
        # ABA 5: REGISTROS E VÁLVULAS
        # ════════════════════════════════════════════════════════════
        if res_reg:
            ws5 = wb.add_worksheet("🔴 REGISTROS")
            ws5.merge_range("A1:G1", "REGISTROS E VÁLVULAS — SALDO E COMPRAS", fmt_titulo)
            escrever_df(ws5, res_reg["saldo"], 2, 0)
            escrever_df(ws5, res_reg["compras"], 2, len(res_reg["saldo"].columns)+1,
                        fmt_h=fmt_header_orange)

        # ════════════════════════════════════════════════════════════
        # ABA 6: CATÁLOGO DE FORNECEDORES
        # ════════════════════════════════════════════════════════════
        ws6 = wb.add_worksheet("📋 FORNECEDORES")
        ws6.merge_range("A1:F1", "CATÁLOGO DE FORNECEDORES — CONSTRUDATA ENGENHARIA", fmt_titulo)
        cat_rows = []
        for key, v in CATALOGO_FORNECEDORES.items():
            cat_rows.append({
                "Item"        : " / ".join(key),
                "Fornecedor"  : v["fornecedor"],
                "Contato"     : v["contato"],
                "Prazo (dias)": v["prazo_dias"],
                "Especificação": v["obs"],
            })
        df_cat = pd.DataFrame(cat_rows)
        escrever_df(ws6, df_cat, 2, 0)
        ws6.set_column("A:A", 30)
        ws6.set_column("B:B", 25)
        ws6.set_column("C:C", 18)
        ws6.set_column("D:D", 14)
        ws6.set_column("E:E", 35)

    log(f"Excel gerado: {output_path}", "OK")


# ─────────────────────────────────────────────────────────────────────
# DASHBOARD HTML
# ─────────────────────────────────────────────────────────────────────

def gerar_dashboard(res_redes, res_pvs, res_reg, output_path):
    """Gera dashboard HTML com Chart.js e visual CONSTRUDATA."""
    log(f"Gerando dashboard: {output_path}")

    pn = res_redes["por_nucleo"]
    nucleos    = list(pn["nucleo"].values)
    pct_exec   = list(pn["pct_exec"].values)
    ext_total  = list(pn["extensao_total_m"].round(0).values)
    ext_exec   = list(pn["executado_m"].round(0).values)

    # Dados para gráfico de pizza geral
    tot_plan = res_redes["total_plan"]
    tot_exec = res_redes["total_exec"]
    tot_and  = sum(pn["em_andamento_m"].values)
    tot_falt = tot_plan - tot_exec - tot_and

    pv_exec  = res_pvs["total_exec"] if res_pvs else 0
    pv_tot   = res_pvs["total"]      if res_pvs else 0
    reg_exec = res_reg["total_exec"] if res_reg else 0
    reg_tot  = res_reg["total"]      if res_reg else 0

    agora = datetime.now().strftime("%d/%m/%Y às %H:%M")

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CONSTRUDATA | Super Planejador SLNR Santos</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
<style>
  :root {{
    --bg: #0A0E1A; --card: #111827; --accent: #3B82F6; --green: #10B981;
    --orange: #F59E0B; --red: #EF4444; --text: #E5E7EB; --sub: #9CA3AF;
    --border: #1F2937;
  }}
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ background:var(--bg); color:var(--text); font-family:'Segoe UI',sans-serif; padding:20px; }}
  h1 {{ font-size:1.6rem; color:var(--accent); border-bottom:2px solid var(--accent);
        padding-bottom:10px; margin-bottom:20px; letter-spacing:1px; }}
  .sub {{ color:var(--sub); font-size:.85rem; margin-top:4px; }}
  .grid-kpi {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; margin-bottom:24px; }}
  .kpi {{ background:var(--card); border:1px solid var(--border); border-radius:12px;
          padding:18px; text-align:center; transition:.2s; }}
  .kpi:hover {{ border-color:var(--accent); transform:translateY(-2px); }}
  .kpi .lbl {{ font-size:.78rem; color:var(--sub); text-transform:uppercase; letter-spacing:.5px; }}
  .kpi .val {{ font-size:2rem; font-weight:700; margin:8px 0 4px; }}
  .kpi .val.green {{ color:var(--green); }}
  .kpi .val.blue  {{ color:var(--accent); }}
  .kpi .val.red   {{ color:var(--red); }}
  .kpi .val.orange{{ color:var(--orange); }}
  .grid-chart {{ display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px; }}
  .card {{ background:var(--card); border:1px solid var(--border); border-radius:12px; padding:18px; }}
  .card h3 {{ font-size:.9rem; color:var(--sub); margin-bottom:14px; text-transform:uppercase; letter-spacing:.5px; }}
  .full {{ grid-column: 1 / -1; }}
  .progress-bar-wrap {{ margin:4px 0; }}
  .progress-bar-label {{ display:flex; justify-content:space-between; font-size:.8rem; color:var(--sub); margin-bottom:3px; }}
  .progress-bar {{ background:#1F2937; border-radius:6px; height:12px; overflow:hidden; }}
  .progress-bar-fill {{ height:100%; border-radius:6px; background:linear-gradient(90deg,var(--green),var(--accent)); }}
  .table-wrap {{ overflow-x:auto; }}
  table {{ width:100%; border-collapse:collapse; font-size:.82rem; }}
  th {{ background:#1F2937; color:var(--sub); padding:8px 10px; text-align:center; font-weight:600; }}
  td {{ padding:7px 10px; border-bottom:1px solid var(--border); text-align:center; }}
  tr:hover td {{ background:#1a2234; }}
  .badge {{ display:inline-block; padding:2px 8px; border-radius:20px; font-size:.74rem; font-weight:600; }}
  .badge.g {{ background:#064e3b; color:#6ee7b7; }}
  .badge.o {{ background:#78350f; color:#fcd34d; }}
  .badge.r {{ background:#7f1d1d; color:#fca5a5; }}
  footer {{ text-align:center; color:var(--sub); font-size:.75rem; margin-top:28px; padding-top:14px; border-top:1px solid var(--border); }}
  @media(max-width:768px) {{ .grid-chart {{ grid-template-columns:1fr; }} }}
</style>
</head>
<body>
<h1>⚡ CONSTRUDATA | Super Planejador SLNR Santos</h1>
<p class="sub">{CONFIG['contrato']} · {CONFIG['responsavel']} · Atualizado em {agora}</p>

<div class="grid-kpi" style="margin-top:18px">
  <div class="kpi"><div class="lbl">Extensão Planejada</div>
    <div class="val blue">{tot_plan:,.0f}<span style="font-size:1rem"> m</span></div></div>
  <div class="kpi"><div class="lbl">Executado</div>
    <div class="val green">{tot_exec:,.0f}<span style="font-size:1rem"> m</span></div></div>
  <div class="kpi"><div class="lbl">% Executado</div>
    <div class="val green">{tot_exec/tot_plan*100:.1f}<span style="font-size:1rem">%</span></div></div>
  <div class="kpi"><div class="lbl">Saldo a Executar</div>
    <div class="val red">{tot_falt+tot_and:,.0f}<span style="font-size:1rem"> m</span></div></div>
  <div class="kpi"><div class="lbl">PVs Executados</div>
    <div class="val orange">{pv_exec}<span style="font-size:1rem"> / {pv_tot}</span></div></div>
  <div class="kpi"><div class="lbl">Registros Exec.</div>
    <div class="val orange">{reg_exec}<span style="font-size:1rem"> / {reg_tot}</span></div></div>
</div>

<div class="grid-chart">
  <div class="card">
    <h3>📊 Status Geral — Extensão (m)</h3>
    <canvas id="pie1" height="220"></canvas>
  </div>
  <div class="card">
    <h3>📊 Top 10 Núcleos — % Execução</h3>
    <canvas id="bar1" height="220"></canvas>
  </div>
  <div class="card full">
    <h3>📈 Extensão por Núcleo (Executado vs Total)</h3>
    <canvas id="bar2" height="160"></canvas>
  </div>
</div>

<div class="card" style="margin-bottom:16px">
  <h3>🔥 Progresso Detalhado por Núcleo</h3>
  <div class="table-wrap">
  <table>
    <tr>
      <th>#</th><th>Núcleo</th><th>Total (m)</th><th>Executado (m)</th>
      <th>Em Andamento (m)</th><th>A Executar (m)</th><th>% Exec</th>
    </tr>
    {''.join(
        f"""<tr>
          <td>{i+1}</td>
          <td style="text-align:left;font-weight:600">{row['nucleo']}</td>
          <td>{row['extensao_total_m']:,.1f}</td>
          <td style="color:#10B981;font-weight:600">{row['executado_m']:,.1f}</td>
          <td style="color:#F59E0B">{row['em_andamento_m']:,.1f}</td>
          <td style="color:#EF4444">{row['a_executar_m']:,.1f}</td>
          <td><span class="badge {'g' if row['pct_exec']>=60 else ('o' if row['pct_exec']>=20 else 'r')}">{row['pct_exec']:.1f}%</span></td>
        </tr>"""
        for i, row in pn.iterrows()
    )}
  </table>
  </div>
</div>

<footer>CONSTRUDATA ENGENHARIA · Super Planejador SLNR Santos · {agora}</footer>

<script>
const nucleos = {nucleos};
const pct     = {pct_exec};
const extTot  = {ext_total};
const extExec = {ext_exec};

// PIE - Status geral
new Chart(document.getElementById('pie1'), {{
  type: 'doughnut',
  data: {{
    labels: ['Executado','Em Andamento','A Executar'],
    datasets: [{{ data: [{tot_exec:.0f},{tot_and:.0f},{tot_falt:.0f}],
      backgroundColor: ['#10B981','#F59E0B','#EF4444'],
      borderWidth: 2, borderColor: '#111827' }}]
  }},
  options: {{ plugins: {{ legend: {{ labels: {{ color:'#E5E7EB', font:{{size:11}} }} }} }},
    cutout: '55%' }}
}});

// BAR - top 10 % exec
const top10idx = pct.map((v,i)=>{{return{{v,i}}}}).sort((a,b)=>b.v-a.v).slice(0,10);
new Chart(document.getElementById('bar1'), {{
  type: 'bar',
  data: {{
    labels: top10idx.map(x=>nucleos[x.i].split(' ').slice(0,2).join(' ')),
    datasets: [{{ label:'% Executado', data: top10idx.map(x=>x.v),
      backgroundColor: top10idx.map(x=> x.v>=60?'#10B981': x.v>=20?'#F59E0B':'#EF4444'),
      borderRadius: 5 }}]
  }},
  options: {{
    plugins: {{ legend:{{ display:false }} }},
    scales: {{
      x: {{ ticks:{{color:'#9CA3AF',font:{{size:9}}}}, grid:{{color:'#1F2937'}} }},
      y: {{ ticks:{{color:'#9CA3AF'}}, grid:{{color:'#1F2937'}}, max:100 }}
    }}
  }}
}});

// BAR - extensão por núcleo
new Chart(document.getElementById('bar2'), {{
  type: 'bar',
  data: {{
    labels: nucleos.map(n=>n.split(' ').slice(0,2).join(' ')),
    datasets: [
      {{ label:'Total (m)', data:extTot, backgroundColor:'#1F2937', borderRadius:3 }},
      {{ label:'Executado (m)', data:extExec, backgroundColor:'#3B82F6', borderRadius:3 }}
    ]
  }},
  options: {{
    plugins: {{ legend: {{ labels:{{color:'#E5E7EB'}} }} }},
    scales: {{
      x: {{ stacked:false, ticks:{{color:'#9CA3AF',font:{{size:8}}}}, grid:{{color:'#1F2937'}} }},
      y: {{ ticks:{{color:'#9CA3AF'}}, grid:{{color:'#1F2937'}} }}
    }}
  }}
}});
</script>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    log(f"Dashboard gerado: {output_path}", "OK")


# ─────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────

def main():
    log("=" * 60)
    log("CONSTRUDATA ENGENHARIA — SUPER PLANEJADOR SLNR")
    log("=" * 60)

    gpkg_path    = CONFIG["gpkg_path"]
    excel_output = CONFIG["excel_out"]
    dash_output  = CONFIG["dashboard_out"]

    # Aceita args da linha de comando
    if len(sys.argv) >= 2: gpkg_path    = sys.argv[1]
    if len(sys.argv) >= 3: excel_output = sys.argv[2]

    if not Path(gpkg_path).exists():
        log(f"GEOPACKAGE NÃO ENCONTRADO: {gpkg_path}", "ERR")
        log("Uso: python construdata_planner.py <arquivo.gpkg> [saida.xlsx]")
        sys.exit(1)

    # 1. Ler dados GIS
    gdf_redes, gdf_pvs, gdf_reg = ler_gpkg(gpkg_path)

    # 2. Analisar
    res_redes = analisar_redes(gdf_redes)
    res_pvs   = analisar_pvs(gdf_pvs)
    res_reg   = analisar_registros(gdf_reg)

    # 3. Exportar Excel
    exportar_excel(res_redes, res_pvs, res_reg, excel_output)

    # 4. Gerar dashboard
    gerar_dashboard(res_redes, res_pvs, res_reg, dash_output)

    log("=" * 60)
    log(f"✅ CONCLUÍDO!")
    log(f"   Excel     → {excel_output}")
    log(f"   Dashboard → {dash_output}")
    log("=" * 60)


if __name__ == "__main__":
    main()
