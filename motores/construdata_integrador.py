#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔═══════════════════════════════════════════════════════════════════╗
║   CONSTRUDATA ENGENHARIA — INTEGRADOR NS ↔ PLANEJADOR            ║
║   Versão 1.0                                                      ║
║                                                                   ║
║   PAPEL DESTA PONTE:                                              ║
║   Após gerar as Notas de Serviço (NS), o usuário importa          ║
║   um GeoPackage/SHP com os itens executados. Este módulo:         ║
║                                                                   ║
║   1. Lê o GeoPackage/SHP de executados (vindo do NS/CADASTRO)     ║
║   2. Permite selecionar quais itens marcar como EXECUTADO          ║
║   3. Cruza com o GeoPackage de projeto (todos os itens)           ║
║   4. Atualiza status e salva novo .gpkg atualizado                 ║
║   5. Chama o Planejador para gerar Excel + Dashboard              ║
║                                                                   ║
║   Fluxo:                                                          ║
║   NS/CADASTRO → export .gpkg/.shp → Integrador → Planejador      ║
╚═══════════════════════════════════════════════════════════════════╝
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
# CONSTANTES
# ─────────────────────────────────────────────────────────────────────
STATUS_EXECUTADO    = "EXECUTADO"
STATUS_EM_ANDAMENTO = "EM ANDAMENTO"
STATUS_A_EXECUTAR   = "A EXECUTAR"
CRS_PROJETO         = "EPSG:31983"   # SIRGAS 2000 UTM 23S

def log(msg, nivel="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    icons = {"INFO":"ℹ️ ","OK":"✅","WARN":"⚠️ ","ERR":"❌","STEP":"▶ "}
    print(f"[{ts}] {icons.get(nivel,'  ')}{msg}")


# ═══════════════════════════════════════════════════════════════════
# MODO 1: IMPORTAR GPKG/SHP JÁ COM EXECUTADOS MARCADOS
# ═══════════════════════════════════════════════════════════════════
# Fluxo: NS exporta ou usuário exporta do CADASTRO um arquivo
# onde os itens executados já têm status="EXECUTADO" nas feições.
# Este modo apenas lê, valida e passa ao Planejador.

def modo_importar_geo(
    gpkg_executados: str,
    gpkg_projeto: str | None = None,
    layer: str = None,
) -> gpd.GeoDataFrame:
    """
    Importa um GeoPackage/SHP onde as feições executadas já
    estão marcadas (field status = EXECUTADO ou similar).

    Se gpkg_projeto for fornecido, faz merge com o projeto completo,
    garantindo que todas as feições apareçam no saldo (incluindo
    as não executadas).

    Retorna GeoDataFrame pronto para o Planejador.
    """
    log(f"MODO 1 — Importando GEO de executados: {gpkg_executados}", "STEP")

    ext = Path(gpkg_executados).suffix.lower()

    # ── Ler arquivo ───────────────────────────────────────────────
    if ext == ".gpkg":
        layers_disp = fiona.listlayers(gpkg_executados)
        layer_usar  = layer if layer and layer in layers_disp else layers_disp[0]
        gdf = gpd.read_file(gpkg_executados, layer=layer_usar)
    elif ext in [".shp", ".geojson", ".json"]:
        gdf = gpd.read_file(gpkg_executados)
    else:
        raise ValueError(f"Formato não suportado: {ext}. Use .gpkg, .shp ou .geojson")

    log(f"  Feições lidas: {len(gdf)}", "OK")

    # ── Corrigir CRS ──────────────────────────────────────────────
    gdf = _corrigir_crs(gdf)

    # ── Normalizar status ─────────────────────────────────────────
    gdf = _normalizar_status(gdf)

    # ── Verificar se existe coluna status ─────────────────────────
    if "status" not in gdf.columns:
        log("Coluna 'status' não encontrada → todas as feições marcadas como EXECUTADO", "WARN")
        gdf["status"] = STATUS_EXECUTADO

    # ── Se tiver projeto completo, fazer merge ────────────────────
    if gpkg_projeto and Path(gpkg_projeto).exists():
        gdf = _merge_com_projeto(gdf, gpkg_projeto, layer)

    _resumir(gdf)
    return gdf


# ═══════════════════════════════════════════════════════════════════
# MODO 2: SELECIONAR MANUALMENTE OS EXECUTADOS
# ═══════════════════════════════════════════════════════════════════
# Fluxo: usuário tem o GeoPackage de projeto completo e quer
# ESCOLHER quais feições marcar como executadas (via ID, núcleo,
# BM de referência etc.) sem precisar de um arquivo separado.

def modo_selecionar_executados(
    gpkg_projeto: str,
    layer: str = None,
    filtro_nucleo: list[str] | None = None,
    filtro_bm: str | None = None,
    filtro_ids: list[str] | None = None,
    percentual_execucao: float | None = None,
) -> gpd.GeoDataFrame:
    """
    Lê o GeoPackage de projeto completo e marca como EXECUTADO
    as feições que correspondem aos filtros fornecidos.

    Parâmetros
    ----------
    gpkg_projeto    : caminho do .gpkg com todo o projeto
    layer           : nome do layer (detectado automaticamente se None)
    filtro_nucleo   : lista de núcleos cujas feições viram EXECUTADO
    filtro_bm       : string de referência de BM  ex: "BM_01" ou "BM_01,BM_02"
    filtro_ids      : lista de IDs específicos a marcar como executado
    percentual_exec : marcar X% das feições de cada núcleo como executado
                      (modo de simulação/estimativa)

    Retorna GeoDataFrame com status atualizado, pronto para o Planejador.
    """
    log(f"MODO 2 — Selecionando executados em: {gpkg_projeto}", "STEP")

    ext = Path(gpkg_projeto).suffix.lower()
    layers_disp = fiona.listlayers(gpkg_projeto) if ext == ".gpkg" else [None]
    layer_usar  = layer if layer and layer in layers_disp else layers_disp[0]

    gdf = gpd.read_file(gpkg_projeto, layer=layer_usar)
    gdf = _corrigir_crs(gdf)
    gdf = _normalizar_status(gdf)

    # Garantir coluna status
    if "status" not in gdf.columns:
        gdf["status"] = STATUS_A_EXECUTAR

    # ── Aplicar filtros ───────────────────────────────────────────
    mask = pd.Series([False] * len(gdf), index=gdf.index)

    if filtro_nucleo:
        col_nucleo = _detectar_coluna(gdf, ["nucleo","nome_nucleo","nucleo_nome","area"])
        if col_nucleo:
            mask |= gdf[col_nucleo].str.upper().isin([n.upper() for n in filtro_nucleo])
            log(f"  Filtro núcleo: {filtro_nucleo} → {mask.sum()} feições")

    if filtro_bm:
        bms = [b.strip() for b in filtro_bm.replace(";",",").split(",")]
        col_bm = _detectar_coluna(gdf, ["bm","bm_ref","bm_referencia","boletim"])
        if col_bm:
            mask |= gdf[col_bm].str.upper().isin([b.upper() for b in bms])
            log(f"  Filtro BM: {bms} → {mask.sum()} feições")

    if filtro_ids:
        col_id = _detectar_coluna(gdf, ["id","fid","id_trecho","id_pv","id_reg","objectid"])
        if col_id:
            mask |= gdf[col_id].astype(str).isin([str(i) for i in filtro_ids])
            log(f"  Filtro IDs: {len(filtro_ids)} IDs → {mask.sum()} feições")

    if percentual_execucao is not None and 0 < percentual_execucao <= 100:
        col_nucleo = _detectar_coluna(gdf, ["nucleo","nome_nucleo","area"])
        if col_nucleo:
            np.random.seed(42)
            for nucleo, grp in gdf.groupby(col_nucleo):
                n_exec = int(len(grp) * percentual_execucao / 100)
                idx_exec = np.random.choice(grp.index, size=n_exec, replace=False)
                mask.loc[idx_exec] = True
            log(f"  Percentual {percentual_execucao}% → {mask.sum()} feições")

    # Se nenhum filtro foi aplicado → manter status original
    if not mask.any():
        log("Nenhum filtro aplicado — mantendo status original das feições", "WARN")
    else:
        gdf.loc[mask, "status"] = STATUS_EXECUTADO
        log(f"  Total marcado como EXECUTADO: {mask.sum()}", "OK")

    _resumir(gdf)
    return gdf


# ═══════════════════════════════════════════════════════════════════
# MODO 3: ATUALIZAR STATUS VIA TABELA (NS → planilha → GeoPackage)
# ═══════════════════════════════════════════════════════════════════
# Fluxo: o NS exporta uma planilha/CSV com os IDs executados.
# Este modo cruza essa tabela com o GeoPackage e atualiza os status.

def modo_atualizar_via_tabela(
    gpkg_projeto: str,
    tabela_ns: str,
    col_id_geo: str = "id_trecho",
    col_id_tab: str = "id_feicao",
    col_status_tab: str = "status_ns",
    layer: str = None,
) -> gpd.GeoDataFrame:
    """
    Atualiza o status do GeoPackage a partir de uma tabela exportada pelo NS.

    Parâmetros
    ----------
    gpkg_projeto   : GeoPackage com o cadastro completo do projeto
    tabela_ns      : CSV ou XLSX exportado pelo módulo NS com os executados
    col_id_geo     : nome da coluna ID no GeoPackage (default: "id_trecho")
    col_id_tab     : nome da coluna ID na tabela NS  (default: "id_feicao")
    col_status_tab : nome da coluna de status na tabela NS
    layer          : layer do GeoPackage (detectado se None)

    Retorna GeoDataFrame atualizado.
    """
    log(f"MODO 3 — Atualizando via tabela NS: {tabela_ns}", "STEP")

    # ── Ler GeoPackage ────────────────────────────────────────────
    ext_geo = Path(gpkg_projeto).suffix.lower()
    layers_disp = fiona.listlayers(gpkg_projeto) if ext_geo == ".gpkg" else [None]
    layer_usar  = layer if layer and layer in layers_disp else layers_disp[0]

    gdf = gpd.read_file(gpkg_projeto, layer=layer_usar)
    gdf = _corrigir_crs(gdf)
    gdf = _normalizar_status(gdf)
    if "status" not in gdf.columns:
        gdf["status"] = STATUS_A_EXECUTAR

    # ── Ler tabela NS ─────────────────────────────────────────────
    ext_tab = Path(tabela_ns).suffix.lower()
    if ext_tab == ".csv":
        df_ns = pd.read_csv(tabela_ns, encoding="utf-8-sig")
    elif ext_tab in [".xlsx", ".xls"]:
        df_ns = pd.read_excel(tabela_ns)
    else:
        raise ValueError(f"Tabela NS: formato {ext_tab} não suportado. Use .csv ou .xlsx")

    log(f"  Tabela NS: {len(df_ns)} registros")

    # ── Detectar colunas automaticamente ─────────────────────────
    col_id_geo  = _detectar_coluna(gdf, [col_id_geo, "id","fid","id_trecho","id_pv","objectid"])
    col_id_tab  = _detectar_coluna_df(df_ns, [col_id_tab,"id","id_feicao","fid","cod","codigo"])
    col_st_tab  = _detectar_coluna_df(df_ns, [col_status_tab,"status","situacao","execucao"])

    if not col_id_geo or not col_id_tab:
        log("Não foi possível detectar colunas de ID para cruzamento!", "ERR")
        return gdf

    log(f"  Cruzamento: GEO[{col_id_geo}] ↔ TAB[{col_id_tab}]")

    # ── Normalizar IDs para string ────────────────────────────────
    gdf["_id_str"] = gdf[col_id_geo].astype(str).str.strip()
    df_ns["_id_str"] = df_ns[col_id_tab].astype(str).str.strip()

    # ── Mapear status da tabela NS ────────────────────────────────
    if col_st_tab:
        df_ns_limpo = df_ns[[" _id_str", col_st_tab]].copy()
        df_ns_limpo.columns = ["_id_str", "_status_ns"]
        df_ns_limpo["_status_ns"] = _normalizar_status_series(df_ns_limpo["_status_ns"])
        gdf = gdf.merge(df_ns_limpo, on="_id_str", how="left")
        atualizados = gdf["_status_ns"].notna()
        gdf.loc[atualizados, "status"] = gdf.loc[atualizados, "_status_ns"]
        gdf = gdf.drop(columns=["_status_ns"])
        log(f"  Feições atualizadas: {atualizados.sum()}", "OK")
    else:
        # Se não tem coluna de status, assume que todos os IDs da tabela são EXECUTADO
        ids_exec = set(df_ns["_id_str"])
        mask = gdf["_id_str"].isin(ids_exec)
        gdf.loc[mask, "status"] = STATUS_EXECUTADO
        log(f"  Feições marcadas como EXECUTADO: {mask.sum()}", "OK")

    gdf = gdf.drop(columns=["_id_str"])
    _resumir(gdf)
    return gdf


# ═══════════════════════════════════════════════════════════════════
# SALVAR GPKG ATUALIZADO
# ═══════════════════════════════════════════════════════════════════

def salvar_gpkg_atualizado(
    gdf: gpd.GeoDataFrame,
    output_path: str,
    layer: str = "executados_atualizados",
    bm_ref: str = None,
) -> str:
    """
    Salva o GeoDataFrame atualizado como GeoPackage.
    Adiciona metadados de rastreabilidade (BM, data, hora).
    """
    gdf_salvar = gdf.copy()
    gdf_salvar["data_atualizacao"] = datetime.now().strftime("%d/%m/%Y %H:%M")
    if bm_ref:
        gdf_salvar["bm_referencia"] = bm_ref

    gdf_salvar.to_file(output_path, layer=layer, driver="GPKG")
    log(f"GeoPackage atualizado salvo: {output_path}", "OK")
    return output_path


# ═══════════════════════════════════════════════════════════════════
# CHAMAR O PLANEJADOR AUTOMATICAMENTE
# ═══════════════════════════════════════════════════════════════════

def executar_planejador(
    gpkg_atualizado: str,
    excel_output: str = "CONSTRUDATA_PLANEJADOR.xlsx",
    dashboard_output: str = "construplan_brutal.html",
):
    """
    Chama o motor do Planejador diretamente após a integração.
    Não precisa sair do Python — chama as funções internas.
    """
    log("Chamando Planejador...", "STEP")
    try:
        # Import dinâmico do planejador principal
        import importlib.util, sys
        planner_path = Path(__file__).parent / "construdata_planner.py"
        if not planner_path.exists():
            planner_path = Path("construdata_planner.py")

        spec = importlib.util.spec_from_file_location("planner", planner_path)
        planner = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(planner)

        # Executar
        planner.CONFIG["gpkg_path"]    = gpkg_atualizado
        planner.CONFIG["excel_out"]    = excel_output
        planner.CONFIG["dashboard_out"]= dashboard_output
        planner.main()

    except Exception as e:
        log(f"Erro ao chamar Planejador: {e}", "ERR")
        log("Execute manualmente: python construdata_planner.py <gpkg> <excel>", "WARN")


# ═══════════════════════════════════════════════════════════════════
# FUNÇÕES AUXILIARES
# ═══════════════════════════════════════════════════════════════════

def _corrigir_crs(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Detecta e corrige CRS mislabeled (EPSG:4326 com dados UTM)."""
    if gdf.crs is None:
        gdf = gdf.set_crs(CRS_PROJETO)
        log(f"CRS ausente → definido como {CRS_PROJETO}", "WARN")
    elif gdf.crs.to_epsg() == 4326:
        # Checar se coordenadas são grandes demais para lat/lon
        sample = gdf.geometry.iloc[0]
        coord = sample.centroid if hasattr(sample, 'centroid') else sample
        if abs(coord.x) > 180 or abs(coord.y) > 90:
            log(f"CRS mislabeled detectado (EPSG:4326 com UTM) → corrigindo para {CRS_PROJETO}", "WARN")
            gdf = gdf.set_crs(CRS_PROJETO, allow_override=True)
    elif gdf.crs.to_epsg() != 31983:
        log(f"CRS: {gdf.crs} → reprojetando para {CRS_PROJETO}")
        gdf = gdf.to_crs(CRS_PROJETO)
    return gdf


def _normalizar_status(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Padroniza variações de texto no campo status."""
    if "status" not in gdf.columns:
        return gdf
    gdf = gdf.copy()
    gdf["status"] = _normalizar_status_series(gdf["status"])
    return gdf


def _normalizar_status_series(s: pd.Series) -> pd.Series:
    mapa = {
        "executado"    : STATUS_EXECUTADO,
        "concluido"    : STATUS_EXECUTADO,
        "concluído"    : STATUS_EXECUTADO,
        "feito"        : STATUS_EXECUTADO,
        "ok"           : STATUS_EXECUTADO,
        "done"         : STATUS_EXECUTADO,
        "sim"          : STATUS_EXECUTADO,
        "s"            : STATUS_EXECUTADO,
        "1"            : STATUS_EXECUTADO,
        "em andamento" : STATUS_EM_ANDAMENTO,
        "em_andamento" : STATUS_EM_ANDAMENTO,
        "andamento"    : STATUS_EM_ANDAMENTO,
        "parcial"      : STATUS_EM_ANDAMENTO,
        "parcialmente" : STATUS_EM_ANDAMENTO,
        "a executar"   : STATUS_A_EXECUTAR,
        "a_executar"   : STATUS_A_EXECUTAR,
        "pendente"     : STATUS_A_EXECUTAR,
        "planejado"    : STATUS_A_EXECUTAR,
        "nao iniciado" : STATUS_A_EXECUTAR,
        "não iniciado" : STATUS_A_EXECUTAR,
        "0"            : STATUS_A_EXECUTAR,
        "nao"          : STATUS_A_EXECUTAR,
        "não"          : STATUS_A_EXECUTAR,
        "n"            : STATUS_A_EXECUTAR,
    }
    return s.astype(str).str.strip().str.lower().map(mapa).fillna(
        s.astype(str).str.strip().str.upper()
    )


def _detectar_coluna(gdf: gpd.GeoDataFrame, candidatas: list[str]) -> str | None:
    """Detecta a primeira coluna do GDF que bate com a lista de candidatos."""
    cols_lower = {c.lower(): c for c in gdf.columns}
    for cand in candidatas:
        if cand.lower() in cols_lower:
            return cols_lower[cand.lower()]
    return None


def _detectar_coluna_df(df: pd.DataFrame, candidatas: list[str]) -> str | None:
    cols_lower = {c.lower(): c for c in df.columns}
    for cand in candidatas:
        if cand.lower() in cols_lower:
            return cols_lower[cand.lower()]
    return None


def _merge_com_projeto(
    gdf_exec: gpd.GeoDataFrame,
    gpkg_projeto: str,
    layer: str = None,
) -> gpd.GeoDataFrame:
    """
    Faz merge do GeoDataFrame de executados com o cadastro completo do projeto.
    Garante que todas as feições apareçam no saldo, não só as executadas.
    """
    log(f"Merge com projeto completo: {gpkg_projeto}")
    layers = fiona.listlayers(gpkg_projeto)
    layer_usar = layer if layer and layer in layers else layers[0]
    gdf_proj = gpd.read_file(gpkg_projeto, layer=layer_usar)
    gdf_proj = _corrigir_crs(gdf_proj)
    if "status" not in gdf_proj.columns:
        gdf_proj["status"] = STATUS_A_EXECUTAR

    # Detectar coluna ID comum
    col_id_exec = _detectar_coluna(gdf_exec, ["id","fid","id_trecho","id_pv","objectid"])
    col_id_proj = _detectar_coluna(gdf_proj, ["id","fid","id_trecho","id_pv","objectid"])

    if col_id_exec and col_id_proj:
        ids_exec = set(gdf_exec[col_id_exec].astype(str))
        mask = gdf_proj[col_id_proj].astype(str).isin(ids_exec)
        gdf_proj.loc[mask, "status"] = STATUS_EXECUTADO
        log(f"  {mask.sum()} feições do projeto marcadas como EXECUTADO", "OK")
        return gdf_proj
    else:
        log("Não foi possível identificar coluna ID para merge — retornando executados apenas", "WARN")
        return gdf_exec


def _resumir(gdf: gpd.GeoDataFrame):
    """Exibe resumo rápido do GeoDataFrame após processamento."""
    print()
    print("  ┌─── RESUMO DO GEOPACKAGE PROCESSADO ───────────────────")
    print(f"  │  Total de feições : {len(gdf)}")
    if "status" in gdf.columns:
        for s in [STATUS_EXECUTADO, STATUS_EM_ANDAMENTO, STATUS_A_EXECUTAR]:
            n = (gdf["status"] == s).sum()
            pct = n/len(gdf)*100
            bar = "█" * int(pct/5)
            print(f"  │  {s:<20} : {n:>4} ({pct:>5.1f}%) {bar}")
    if "nucleo" in gdf.columns:
        print(f"  │  Núcleos presentes: {gdf['nucleo'].nunique()}")
    print(f"  │  CRS              : {gdf.crs}")
    print("  └────────────────────────────────────────────────────────")
    print()


# ═══════════════════════════════════════════════════════════════════
# MAIN — EXEMPLO DE USO
# ═══════════════════════════════════════════════════════════════════

def main():
    log("=" * 60)
    log("CONSTRUDATA — INTEGRADOR NS ↔ PLANEJADOR")
    log("=" * 60)

    # ─────────────────────────────────────────────────────────────
    # EXEMPLO 1: Importar GeoPackage exportado do CADASTRO/NS
    # (O GeoPackage já vem com as feições executadas marcadas)
    # ─────────────────────────────────────────────────────────────
    # gdf = modo_importar_geo(
    #     gpkg_executados = "tudo_feito_ate_marco.gpkg",
    #     gpkg_projeto    = "projeto_completo.gpkg",   # opcional
    #     layer           = "redes_esgoto_agua",
    # )

    # ─────────────────────────────────────────────────────────────
    # EXEMPLO 2: Selecionar executados por núcleo / BM
    # ─────────────────────────────────────────────────────────────
    # gdf = modo_selecionar_executados(
    #     gpkg_projeto    = "projeto_completo.gpkg",
    #     filtro_nucleo   = ["MORRO DO TETEU", "CRIADORES", "PANTANAL BAIXO"],
    #     filtro_bm       = "BM_01,BM_02",
    # )

    # ─────────────────────────────────────────────────────────────
    # EXEMPLO 3: Atualizar via tabela exportada do NS
    # ─────────────────────────────────────────────────────────────
    # gdf = modo_atualizar_via_tabela(
    #     gpkg_projeto    = "projeto_completo.gpkg",
    #     tabela_ns       = "ns_executados_fev2026.xlsx",
    #     col_id_geo      = "id_trecho",
    #     col_id_tab      = "id_feicao",
    #     col_status_tab  = "status",
    # )

    # ─────────────────────────────────────────────────────────────
    # DEMO com dados simulados
    # ─────────────────────────────────────────────────────────────
    if Path("slnr_simulado.gpkg").exists():
        log("Demo com slnr_simulado.gpkg", "STEP")
        gdf = modo_selecionar_executados(
            gpkg_projeto  = "slnr_simulado.gpkg",
            layer         = "redes_esgoto_agua",
            filtro_nucleo = ["MORRO DO TETEU", "CRIADORES", "PANTANAL BAIXO"],
        )
        gpkg_out = "slnr_atualizado.gpkg"
        salvar_gpkg_atualizado(gdf, gpkg_out, layer="redes_esgoto_agua", bm_ref="BM_02")
        executar_planejador(gpkg_out,
                            excel_output="CONSTRUDATA_PLANEJADOR_v2.xlsx",
                            dashboard_output="construplan_brutal_v2.html")
    else:
        log("Execute primeiro: python gerar_dados_simulados.py", "WARN")


if __name__ == "__main__":
    main()
