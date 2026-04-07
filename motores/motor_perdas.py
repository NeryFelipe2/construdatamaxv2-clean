#!/usr/bin/env python3
"""
MOTOR_PERDAS.PY — Gestão de Perdas de Água
ConstruData - HydroNetwork · FCN Construções e Saneamento

"Perdas de água não são só um problema técnico.
 São um problema de gestão, de cultura organizacional,
 de prioridade política, de capacidade institucional." — Piero Ereno

INTEGRAÇÃO COM O CADASTRO ConstruData:
  A rede que construímos (SE LIGA NA REDE) já nasce com dados 6D.
  Material, DN, coordenadas, vida útil, custo — tudo no mesmo grafo.
  O motor de perdas usa esses dados desde o dia 1 da operação.

METODOLOGIA IWA (International Water Association):
  1. Balanço Hídrico — componentes de perda
  2. UARL (Unavoidable Annual Real Losses) — mínimo técnico
  3. ILI (Infrastructure Leakage Index) — eficiência da gestão
  4. NRW (Non-Revenue Water) — água sem receita
  5. DMAs (District Metered Areas) — setorização
  6. Curva de degradação por material — risco de ruptura
  7. Análise econômica — custo de perder vs custo de consertar

DOIS TIPOS DE PERDA:
  PERDAS REAIS (físicas): água que foge pelo solo
    → Vazamentos visíveis, invisíveis, extravasamentos
    → Depende de: pressão, material, idade, solo, qualidade execução
  
  PERDAS APARENTES (não físicas): água que chega mas não é cobrada
    → Submedição hidrômetro, fraude, erro cadastral
    → Trocar hidrômetro aumenta receita mas NÃO salva água
"""

import json, math, os
from datetime import datetime, timedelta
from collections import defaultdict


# ══════════════════════════════════════════════════════════
# CONSTANTES IWA
# ══════════════════════════════════════════════════════════

# UARL components (L/ligação/dia/m de pressão)
# Fórmula UARL = (18×Lm + 0.8×Nc + 25×Lp) × P
# Lm = km de rede / Nc = nº conexões / Lp = km de ramal / P = pressão média (m.c.a.)
UARL_COEF = {
    "rede_km": 18.0,        # L/km/dia/m.c.a
    "conexao": 0.80,         # L/conexão/dia/m.c.a  
    "ramal_km": 25.0,        # L/km ramal/dia/m.c.a
}

# Vida útil e taxa de falha por material (falhas/km/ano)
TAXA_FALHA = {
    "PVC": {
        "nova": 0.05,        # 0-10 anos
        "madura": 0.12,      # 10-30 anos
        "velha": 0.35,       # 30-50 anos
        "critica": 0.80,     # >50 anos
    },
    "PEAD": {
        "nova": 0.02,
        "madura": 0.05,
        "velha": 0.10,
        "critica": 0.25,
    },
    "Ferro Fundido": {
        "nova": 0.15,
        "madura": 0.40,
        "velha": 1.20,
        "critica": 3.00,
    },
    "Cimento Amianto": {
        "nova": 0.30,
        "madura": 0.80,
        "velha": 2.50,
        "critica": 5.00,
    },
    "CONCRETO": {
        "nova": 0.08,
        "madura": 0.20,
        "velha": 0.50,
        "critica": 1.20,
    },
}

# Custo médio da água (R$/m³) — Santos/SP
CUSTO_AGUA = {
    "producao_m3": 2.80,     # custo de tratar 1m³
    "distribuicao_m3": 1.50,  # custo de bombear/distribuir
    "tarifa_media_m3": 8.50,  # receita perdida
    "energia_kwh_m3": 0.45,  # kWh por m³ bombeado
    "custo_kwh": 0.85,       # R$/kWh
}

# Pressão típica por tipo de terreno
PRESSAO_TIPICA = {
    "planicie": 25.0,    # m.c.a.
    "encosta": 35.0,
    "morro": 45.0,
    "mangue": 15.0,
    "viela": 30.0,
}

# Custo de reparo por tipo
CUSTO_REPARO = {
    "vazamento_rede": 2500.0,     # R$/reparo
    "vazamento_ramal": 800.0,
    "troca_ramal": 3500.0,
    "troca_rede_metro": 910.0,    # R$/m (nosso custo do contrato!)
    "cavalete_hidrom": 490.0,
}


def _idade_categoria(material, anos):
    """Classifica a idade do tubo em categoria de degradação."""
    vida = {"PVC": 50, "PEAD": 100, "Ferro Fundido": 60, "Cimento Amianto": 30, "CONCRETO": 80}
    v = vida.get(material, 50)
    pct = anos / v
    if pct < 0.2: return "nova"
    elif pct < 0.6: return "madura"
    elif pct < 1.0: return "velha"
    else: return "critica"


# ══════════════════════════════════════════════════════════
# BALANÇO HÍDRICO IWA
# ══════════════════════════════════════════════════════════

def balanco_hidrico(vol_produzido_m3, vol_macromedido_m3, vol_micromedido_m3,
                    vol_operacional_m3=0, vol_exportado_m3=0,
                    n_fraudes_est=0, vol_fraude_media_m3=15):
    """
    Calcula balanço hídrico segundo metodologia IWA.
    
    Volumes em m³/mês.
    """
    # Água faturada
    faturado_medido = vol_micromedido_m3
    faturado_nao_medido = vol_operacional_m3  # uso operacional faturado
    agua_faturada = faturado_medido + faturado_nao_medido
    
    # Perdas aparentes
    submedição = vol_macromedido_m3 * 0.05  # estimativa 5% submedição
    fraude = n_fraudes_est * vol_fraude_media_m3
    perdas_aparentes = submedição + fraude
    
    # Perdas reais
    vol_entrada = vol_produzido_m3 - vol_exportado_m3
    agua_nao_faturada = vol_entrada - agua_faturada
    perdas_reais = agua_nao_faturada - perdas_aparentes - vol_operacional_m3
    if perdas_reais < 0:
        perdas_reais = 0
    
    # NRW
    nrw = agua_nao_faturada
    nrw_pct = (nrw / vol_entrada * 100) if vol_entrada > 0 else 0
    
    # Índice de perdas
    ipl = (perdas_reais / vol_entrada * 100) if vol_entrada > 0 else 0
    ipa = (perdas_aparentes / vol_entrada * 100) if vol_entrada > 0 else 0
    
    return {
        "vol_entrada_m3": round(vol_entrada, 0),
        "agua_faturada_m3": round(agua_faturada, 0),
        "agua_nao_faturada_m3": round(nrw, 0),
        "nrw_pct": round(nrw_pct, 1),
        "perdas_reais_m3": round(perdas_reais, 0),
        "perdas_reais_pct": round(ipl, 1),
        "perdas_aparentes_m3": round(perdas_aparentes, 0),
        "perdas_aparentes_pct": round(ipa, 1),
        "submedição_est_m3": round(submedição, 0),
        "fraude_est_m3": round(fraude, 0),
        "custo_perdas_reais_rs": round(perdas_reais * (CUSTO_AGUA["producao_m3"] + CUSTO_AGUA["distribuicao_m3"]), 0),
        "receita_perdida_rs": round(nrw * CUSTO_AGUA["tarifa_media_m3"], 0),
    }


# ══════════════════════════════════════════════════════════
# UARL + ILI
# ══════════════════════════════════════════════════════════

def calcular_uarl(rede_km, n_conexoes, ramal_km, pressao_media_mca):
    """
    Calcula UARL (Unavoidable Annual Real Losses).
    Mínimo técnico de perda para a infraestrutura existente.
    
    UARL = (18×Lm + 0.8×Nc + 25×Lp) × P  [L/dia]
    """
    uarl_dia = (UARL_COEF["rede_km"] * rede_km +
                UARL_COEF["conexao"] * n_conexoes +
                UARL_COEF["ramal_km"] * ramal_km) * pressao_media_mca
    
    uarl_ano_m3 = uarl_dia * 365 / 1000
    uarl_mes_m3 = uarl_dia * 30 / 1000
    
    return {
        "uarl_litros_dia": round(uarl_dia, 0),
        "uarl_m3_mes": round(uarl_mes_m3, 0),
        "uarl_m3_ano": round(uarl_ano_m3, 0),
        "componentes": {
            "rede": round(UARL_COEF["rede_km"] * rede_km * pressao_media_mca, 0),
            "conexoes": round(UARL_COEF["conexao"] * n_conexoes * pressao_media_mca, 0),
            "ramais": round(UARL_COEF["ramal_km"] * ramal_km * pressao_media_mca, 0),
        }
    }


def calcular_ili(perdas_reais_m3_ano, uarl_m3_ano):
    """
    Calcula ILI (Infrastructure Leakage Index).
    ILI = Perdas Reais / UARL
    
    Classificação (World Bank):
    - ILI < 2: Excelente (países desenvolvidos, manutenção ativa)
    - ILI 2-4: Bom (gestão eficiente)
    - ILI 4-8: Regular (há espaço para melhoria)
    - ILI 8-16: Ruim (perdas significativas, investir urgente)
    - ILI > 16: Crítico (infraestrutura degradada)
    
    Brasil médio: ILI ≈ 5-12
    Santos/SABESP: ILI ≈ 3-6 (melhor que média BR)
    """
    if uarl_m3_ano <= 0:
        return {"ili": 0, "classificacao": "SEM DADOS"}
    
    ili = perdas_reais_m3_ano / uarl_m3_ano
    
    if ili < 2: classif = "EXCELENTE"
    elif ili < 4: classif = "BOM"
    elif ili < 8: classif = "REGULAR"
    elif ili < 16: classif = "RUIM"
    else: classif = "CRÍTICO"
    
    return {
        "ili": round(ili, 2),
        "classificacao": classif,
        "perdas_reais_m3_ano": round(perdas_reais_m3_ano, 0),
        "uarl_m3_ano": round(uarl_m3_ano, 0),
        "potencial_reducao_pct": round(max(0, (1 - 2/ili) * 100), 0) if ili > 2 else 0,
        "meta_ili_2": round(uarl_m3_ano * 2, 0),  # volume de perda com ILI=2
    }


# ══════════════════════════════════════════════════════════
# RISCO DE RUPTURA (usa dados do nosso cadastro 6D)
# ══════════════════════════════════════════════════════════

def calcular_risco_trecho(tr, pvs, data_implantacao=None, pressao_mca=None):
    """
    Calcula risco de ruptura de um trecho usando dados do cadastro.
    
    Fatores de risco:
    - Material (PVC < PEAD < Concreto < FF < Amianto)
    - Idade (curva de degradação)
    - DN (menor DN = mais suscetível)
    - Profundidade (mais profundo = mais pressão de solo)
    - Tipo de solo/terreno
    - Pressão operacional
    """
    material = tr.get("material", "PVC")
    dn = tr.get("dn_mm") or 200
    ext = tr.get("ext_m") or 0
    
    # Idade
    if data_implantacao:
        idade_anos = (datetime.now() - datetime.strptime(data_implantacao, "%Y-%m-%d")).days / 365
    else:
        idade_anos = 0  # rede nova
    
    cat = _idade_categoria(material, idade_anos)
    taxa = TAXA_FALHA.get(material, TAXA_FALHA["PVC"]).get(cat, 0.1)
    
    # Pressão
    p = pressao_mca or 25
    fator_pressao = p / 25  # normalizado para 25 m.c.a.
    
    # DN: tubos menores são mais suscetíveis
    fator_dn = 1.0
    if dn <= 75: fator_dn = 1.3
    elif dn <= 150: fator_dn = 1.1
    elif dn >= 400: fator_dn = 0.8
    
    # Profundidade: mais profundo = mais carga
    prof = tr.get("prof_media", 1.5) or 1.5
    fator_prof = 1.0 + (prof - 1.5) * 0.1  # +10% por metro extra
    
    # Taxa de falha ajustada
    taxa_ajustada = taxa * fator_pressao * fator_dn * fator_prof
    
    # Probabilidade de ruptura em 1 ano
    falhas_esperadas = taxa_ajustada * (ext / 1000)  # ext em km
    prob_ruptura = 1 - math.exp(-falhas_esperadas)
    
    # Custo esperado
    custo_reparo = CUSTO_REPARO["vazamento_rede"]
    custo_esperado = prob_ruptura * custo_reparo
    
    # Volume perdido estimado (se romper): 
    # vazamento médio 2 L/s × tempo detecção 48h × 60% recuperável
    vol_perdido_ruptura = 2 * 3600 * 48 * 0.6 / 1000  # ~207 m³ por ruptura
    custo_agua_perdida = vol_perdido_ruptura * CUSTO_AGUA["tarifa_media_m3"]
    
    # Risco total
    risco_total = custo_esperado + prob_ruptura * custo_agua_perdida
    
    # Classificação
    if prob_ruptura > 0.5: nivel = "CRÍTICO"
    elif prob_ruptura > 0.2: nivel = "ALTO"
    elif prob_ruptura > 0.05: nivel = "MÉDIO"
    else: nivel = "BAIXO"
    
    return {
        "ns": f"{tr.get('pv_ini','?')}→{tr.get('pv_fim','?')}",
        "material": material,
        "dn_mm": dn,
        "ext_m": ext,
        "idade_anos": round(idade_anos, 1),
        "categoria_idade": cat,
        "taxa_falha_km_ano": round(taxa_ajustada, 3),
        "prob_ruptura_ano": round(prob_ruptura, 4),
        "nivel_risco": nivel,
        "custo_reparo_esperado": round(custo_esperado, 0),
        "vol_perdido_ruptura_m3": round(vol_perdido_ruptura, 0),
        "custo_total_risco": round(risco_total, 0),
        "fatores": {
            "pressao": round(fator_pressao, 2),
            "dn": round(fator_dn, 2),
            "profundidade": round(fator_prof, 2),
        },
    }


def mapa_risco_nucleo(pvs, trechos, nucleo="", data_impl=None, pressao=None):
    """Gera mapa de risco de ruptura de todo o núcleo."""
    riscos = []
    por_nivel = defaultdict(lambda: {"n": 0, "ext": 0, "custo": 0})
    
    for tr in trechos:
        r = calcular_risco_trecho(tr, pvs, data_impl, pressao)
        riscos.append(r)
        nv = r["nivel_risco"]
        por_nivel[nv]["n"] += 1
        por_nivel[nv]["ext"] += r["ext_m"]
        por_nivel[nv]["custo"] += r["custo_total_risco"]
    
    ext_total = sum(t.get("ext_m", 0) for t in trechos)
    custo_risco_total = sum(r["custo_total_risco"] for r in riscos)
    
    return {
        "nucleo": nucleo,
        "n_trechos": len(trechos),
        "extensao_total": round(ext_total, 0),
        "custo_risco_total_ano": round(custo_risco_total, 0),
        "por_nivel": dict(por_nivel),
        "top10_risco": sorted(riscos, key=lambda r: -r["custo_total_risco"])[:10],
        "trechos": riscos,
    }


# ══════════════════════════════════════════════════════════
# ANÁLISE ECONÔMICA: TROCAR vs CONTINUAR PERDENDO
# ══════════════════════════════════════════════════════════

def analise_troca_vs_perda(ext_m, material_atual, idade_anos, pressao_mca=25,
                           material_novo="PEAD", custo_troca_metro=910):
    """
    Análise econômica: vale a pena trocar o tubo agora?
    
    Compara:
    - Custo de NÃO trocar: reparos + água perdida ao longo dos anos
    - Custo de trocar: investimento único + vida útil nova (50-100 anos)
    """
    cat = _idade_categoria(material_atual, idade_anos)
    taxa = TAXA_FALHA.get(material_atual, TAXA_FALHA["PVC"]).get(cat, 0.1)
    
    ext_km = ext_m / 1000
    
    # Cenário 1: NÃO trocar (próximos 10 anos)
    custo_nao_trocar = 0
    for ano in range(10):
        idade_futura = idade_anos + ano
        cat_fut = _idade_categoria(material_atual, idade_futura)
        taxa_fut = TAXA_FALHA.get(material_atual, TAXA_FALHA["PVC"]).get(cat_fut, 0.1)
        taxa_ajustada = taxa_fut * (pressao_mca / 25)
        
        falhas_ano = taxa_ajustada * ext_km
        custo_reparos = falhas_ano * CUSTO_REPARO["vazamento_rede"]
        custo_agua = falhas_ano * 207 * CUSTO_AGUA["tarifa_media_m3"]  # 207m³ por ruptura
        custo_nao_trocar += custo_reparos + custo_agua
    
    # Cenário 2: TROCAR agora
    custo_troca = ext_m * custo_troca_metro
    vida_nova = {"PVC": 50, "PEAD": 100, "PE 80": 100, "PE 100": 100}.get(material_novo, 50)
    custo_manut_10anos = custo_troca * 0.003 * 10  # 0.3%/ano × 10 anos
    custo_trocar = custo_troca + custo_manut_10anos
    
    economia = custo_nao_trocar - custo_trocar
    payback = custo_troca / (custo_nao_trocar / 10) if custo_nao_trocar > 0 else 999
    
    recomendacao = "TROCAR" if economia > 0 else "MANTER"
    if idade_anos > {"PVC": 40, "PEAD": 80, "Ferro Fundido": 50, "Cimento Amianto": 25}.get(material_atual, 40):
        recomendacao = "TROCAR (fim de vida útil)"
    
    return {
        "extensao_m": ext_m,
        "material_atual": material_atual,
        "idade_anos": idade_anos,
        "material_novo": material_novo,
        "cenario_nao_trocar": {
            "custo_10_anos": round(custo_nao_trocar, 0),
            "custo_por_ano": round(custo_nao_trocar / 10, 0),
            "falhas_estimadas_10a": round(taxa * ext_km * 10, 1),
        },
        "cenario_trocar": {
            "investimento": round(custo_troca, 0),
            "custo_10_anos": round(custo_trocar, 0),
            "vida_util_nova": vida_nova,
        },
        "economia_10_anos": round(economia, 0),
        "payback_anos": round(payback, 1),
        "recomendacao": recomendacao,
    }


# ══════════════════════════════════════════════════════════
# DMA (District Metered Area) — Setorização
# ══════════════════════════════════════════════════════════

def criar_dma(pvs, trechos, n_setores=4):
    """
    Divide a rede em DMAs baseado em proximidade geográfica.
    Cada DMA terá monitoramento de vazão entrada/saída.
    """
    # Clustering simples por coordenada Y (norte-sul)
    pvs_com_coord = [(nome, pv) for nome, pv in pvs.items() if pv.get("y")]
    if not pvs_com_coord:
        return {"dmas": [], "erro": "Sem coordenadas"}
    
    ys = sorted(set(pv["y"] for _, pv in pvs_com_coord))
    step = len(ys) // n_setores
    limites = [ys[min(i * step, len(ys)-1)] for i in range(n_setores)] + [ys[-1] + 1]
    
    dmas = []
    for i in range(n_setores):
        y_min, y_max = limites[i], limites[i+1]
        pvs_dma = {n: p for n, p in pvs.items() if p.get("y") and y_min <= p["y"] < y_max}
        trechos_dma = [t for t in trechos if t.get("pv_ini") in pvs_dma or t.get("pv_fim") in pvs_dma]
        ext = sum(t.get("ext_m", 0) for t in trechos_dma)
        
        dmas.append({
            "dma_id": f"DMA_{i+1:02d}",
            "n_pvs": len(pvs_dma),
            "n_trechos": len(trechos_dma),
            "extensao_m": round(ext, 0),
            "n_ligacoes_est": len(pvs_dma) * 3,  # ~3 ligações por PV
            "y_range": (round(y_min, 0), round(y_max, 0)),
            "monitoramento": {
                "macro_medidor": f"MM_{i+1:02d}",
                "sensor_pressao": f"SP_{i+1:02d}",
                "telemetria": True,
            },
        })
    
    return {"n_dmas": len(dmas), "dmas": dmas}


# ══════════════════════════════════════════════════════════
# RELATÓRIO COMPLETO DE PERDAS
# ══════════════════════════════════════════════════════════

def gerar_relatorio_perdas(pvs, trechos, nucleo="",
                           vol_produzido=None, vol_micromedido=None,
                           pressao_media=25, data_implantacao=None):
    """
    Gera relatório completo de gestão de perdas.
    
    Se não tem dados de volume (rede nova), faz análise preventiva:
    - Risco de ruptura por trecho
    - UARL esperado quando operar
    - DMAs recomendados
    - Custo projetado de perdas
    """
    ext_total = sum(t.get("ext_m", 0) for t in trechos)
    ext_km = ext_total / 1000
    n_conexoes = len(pvs) * 3  # estimativa
    ramal_km = n_conexoes * 6 / 1000  # 6m por ramal médio
    
    # UARL
    uarl = calcular_uarl(ext_km, n_conexoes, ramal_km, pressao_media)
    
    # Balanço hídrico (se tem dados)
    balanco = None
    ili = None
    if vol_produzido and vol_micromedido:
        balanco = balanco_hidrico(vol_produzido, vol_produzido * 0.95, vol_micromedido)
        ili = calcular_ili(balanco["perdas_reais_m3"] * 12, uarl["uarl_m3_ano"])
    
    # Mapa de risco
    risco = mapa_risco_nucleo(pvs, trechos, nucleo, data_implantacao, pressao_media)
    
    # DMAs
    dmas = criar_dma(pvs, trechos)
    
    # Projeção de perdas (rede nova: projetar para quando operar)
    custo_perdas_ano_est = uarl["uarl_m3_ano"] * CUSTO_AGUA["tarifa_media_m3"] * 3  # ILI=3 estimado
    energia_perdida_kwh = uarl["uarl_m3_ano"] * 3 * CUSTO_AGUA["energia_kwh_m3"]
    custo_energia_perdida = energia_perdida_kwh * CUSTO_AGUA["custo_kwh"]
    
    return {
        "meta": {
            "plataforma": "ConstruData - HydroNetwork",
            "modulo": "Gestão de Perdas de Água",
            "metodologia": "IWA — Balanço Hídrico + UARL + ILI",
            "nucleo": nucleo,
            "data": datetime.now().isoformat(),
            "empresa": "FCN Construções e Saneamento",
        },
        "infraestrutura": {
            "extensao_km": round(ext_km, 2),
            "n_pvs": len(pvs),
            "n_trechos": len(trechos),
            "n_conexoes_est": n_conexoes,
            "ramal_km_est": round(ramal_km, 2),
            "pressao_media_mca": pressao_media,
        },
        "uarl": uarl,
        "balanco_hidrico": balanco,
        "ili": ili,
        "risco": {
            "resumo": {
                "custo_risco_total_ano": risco["custo_risco_total_ano"],
                "por_nivel": risco["por_nivel"],
            },
            "top10": risco["top10_risco"],
        },
        "dmas": dmas,
        "projecao_economica": {
            "custo_perdas_ano_estimado": round(custo_perdas_ano_est, 0),
            "energia_perdida_kwh_ano": round(energia_perdida_kwh, 0),
            "custo_energia_perdida_ano": round(custo_energia_perdida, 0),
            "custo_total_ineficiencia_ano": round(custo_perdas_ano_est + custo_energia_perdida, 0),
            "obs": "Estimativa com ILI=3 (bom para rede nova). Valores reais dependem de macromedição.",
        },
        "recomendacoes": [
            "Instalar macromedidores nas entradas de cada DMA desde o comissionamento",
            "Implementar telemetria de pressão nos pontos críticos (morro, extremidades)",
            "Manter cadastro 6D atualizado (data instalação, material, DN) para rastreabilidade",
            "Primeira campanha de detecção acústica após 2 anos de operação",
            "PPC semanal do LPS deve incluir verificação de vazamentos visíveis",
            "Criar rotina de verificação de consumo mínimo noturno por DMA (indica vazamento base)",
        ],
    }


# ══════════════════════════════════════════════════════════
# PROPRIEDADES IFC PARA GESTÃO DE PERDAS (6D+)
# ══════════════════════════════════════════════════════════

def get_perdas_properties(material, dn_mm, ext_m, idade_anos=0, pressao_mca=25):
    """Retorna PropertySet de perdas para inserir no IFC."""
    cat = _idade_categoria(material, idade_anos)
    taxa = TAXA_FALHA.get(material, TAXA_FALHA["PVC"]).get(cat, 0.1)
    
    return {
        "Risco_Ruptura_Categoria": cat,
        "Taxa_Falha_km_ano": round(taxa, 3),
        "Prob_Ruptura_Ano": round(1 - math.exp(-taxa * ext_m / 1000), 4),
        "Custo_Reparo_Esperado_RS": round((1 - math.exp(-taxa * ext_m / 1000)) * 2500, 0),
        "Vol_Perda_Ruptura_m3": 207,
        "UARL_Contribuicao_Ld": round(UARL_COEF["rede_km"] * ext_m / 1000 * pressao_mca, 1),
    }


if __name__ == "__main__":
    import sys
    sys.path.insert(0, "/mnt/user-data/outputs")
    sys.path.insert(0, "CONSTRUDATA_BIM_V6/scripts")
    
    from ler_dxf_gdal import ler_dxf_gdal
    pvs, trechos, _, _ = ler_dxf_gdal("/home/claude/VERDE_TETEU.dxf")
    
    rel = gerar_relatorio_perdas(pvs, trechos, "Verde e Teteu", pressao_media=35)
    
    print("═" * 60)
    print("  GESTÃO DE PERDAS — Verde e Teteu")
    print("═" * 60)
    
    infra = rel["infraestrutura"]
    print(f"\n  Infraestrutura: {infra['extensao_km']:.2f}km | {infra['n_conexoes_est']} conexões | P={infra['pressao_media_mca']}m.c.a.")
    
    u = rel["uarl"]
    print(f"\n  UARL (mínimo técnico): {u['uarl_litros_dia']:.0f} L/dia = {u['uarl_m3_ano']:.0f} m³/ano")
    print(f"    Rede: {u['componentes']['rede']:.0f} L/d | Conexões: {u['componentes']['conexoes']:.0f} L/d | Ramais: {u['componentes']['ramais']:.0f} L/d")
    
    r = rel["risco"]["resumo"]
    print(f"\n  Risco de ruptura: R$ {r['custo_risco_total_ano']:,.0f}/ano")
    for nivel, d in r["por_nivel"].items():
        print(f"    {nivel:8s}: {d['n']:3d} trechos | {d['ext']:.0f}m | R$ {d['custo']:,.0f}")
    
    d = rel["dmas"]
    print(f"\n  DMAs recomendados: {d['n_dmas']}")
    for dma in d["dmas"]:
        print(f"    {dma['dma_id']}: {dma['n_pvs']} PVs | {dma['extensao_m']:.0f}m | ~{dma['n_ligacoes_est']} lig")
    
    p = rel["projecao_economica"]
    print(f"\n  Projeção econômica (ILI=3):")
    print(f"    Custo perdas: R$ {p['custo_perdas_ano_estimado']:,.0f}/ano")
    print(f"    Energia perdida: {p['energia_perdida_kwh_ano']:,.0f} kWh/ano (R$ {p['custo_energia_perdida_ano']:,.0f})")
    print(f"    TOTAL ineficiência: R$ {p['custo_total_ineficiencia_ano']:,.0f}/ano")
    
    print(f"\n  ✅ Motor de Perdas integrado com cadastro ConstruData")
