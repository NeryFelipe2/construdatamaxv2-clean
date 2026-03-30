#!/usr/bin/env python3
"""
MOTOR_LEAN_LPS.PY — Lean Construction + Last Planner System
ConstruData - HydroNetwork · CT 11481051 · FCN Construções e Saneamento

LEAN CONSTRUCTION:
- Fluxo contínuo por NS (cada NS = 1 tarefa no fluxo)
- Takt time: ritmo de produção por equipe
- Mapeamento de desperdícios (muda): espera, transporte, retrabalho
- KPIs: lead time, cycle time, throughput

LAST PLANNER SYSTEM (LPS):
- PPC (Percent Plan Complete): NS planejadas vs executadas por semana
- Restrições: o que trava cada NS (material, equipe, clima, SABESP, projeto)
- Make-ready: destravamento 3 semanas antes
- Lookahead: planejamento 6 semanas à frente
- Weekly Work Plan: NS que serão executadas na semana
- Razões de não-conclusão: análise Pareto dos motivos de atraso

BIM 6D INTEGRADO:
- Vida útil por material (PVC=50a, PEAD=100a, Concreto=80a)
- Custo de manutenção ao longo da vida útil
- Data prevista de substituição
- Sustentabilidade: CO2 por metro de rede
"""

import json, math, os
from datetime import datetime, timedelta
from collections import defaultdict, Counter


# ══════════════════════════════════════════════════════════
# BIM 6D — CICLO DE VIDA
# ══════════════════════════════════════════════════════════

VIDA_UTIL = {
    "PVC":      {"anos": 50,  "manutencao_anual_pct": 0.5,  "co2_kg_m": 3.2,  "reciclavel": True},
    "PEAD":     {"anos": 100, "manutencao_anual_pct": 0.3,  "co2_kg_m": 2.8,  "reciclavel": True},
    "PE 80":    {"anos": 100, "manutencao_anual_pct": 0.3,  "co2_kg_m": 2.8,  "reciclavel": True},
    "PE 100":   {"anos": 100, "manutencao_anual_pct": 0.2,  "co2_kg_m": 2.5,  "reciclavel": True},
    "CONCRETO": {"anos": 80,  "manutencao_anual_pct": 1.0,  "co2_kg_m": 12.5, "reciclavel": False},
    "FFD":      {"anos": 100, "manutencao_anual_pct": 0.8,  "co2_kg_m": 18.0, "reciclavel": True},
}

PV_VIDA_UTIL = {
    "CONCRETO": {"anos": 80, "manutencao_anual_pct": 1.5, "co2_kg_un": 450},
    "PEAD":     {"anos": 100,"manutencao_anual_pct": 0.5, "co2_kg_un": 85},
    "FFD":      {"anos": 100,"manutencao_anual_pct": 1.0, "co2_kg_un": 320},
}


def calcular_6d_trecho(tr, pvs, custo_implantacao=0, data_exec=None):
    """Calcula dados 6D (ciclo de vida) de um trecho."""
    material = tr.get("material", "PVC")
    dn = tr.get("dn_mm") or 200
    ext = tr.get("ext_m") or 0
    vida = VIDA_UTIL.get(material, VIDA_UTIL["PVC"])
    
    custo_impl = custo_implantacao or (ext * 910)
    manut_anual = custo_impl * vida["manutencao_anual_pct"] / 100
    custo_ciclo_vida = custo_impl + manut_anual * vida["anos"]
    co2_total = vida["co2_kg_m"] * ext
    
    data_base = datetime.strptime(data_exec, "%Y-%m-%d") if data_exec else datetime.now()
    data_substituicao = data_base + timedelta(days=vida["anos"] * 365)
    
    return {
        "material": material,
        "vida_util_anos": vida["anos"],
        "custo_implantacao": round(custo_impl, 2),
        "manutencao_anual": round(manut_anual, 2),
        "custo_ciclo_vida": round(custo_ciclo_vida, 2),
        "custo_por_ano": round(custo_ciclo_vida / vida["anos"], 2),
        "co2_implantacao_kg": round(co2_total, 1),
        "reciclavel": vida["reciclavel"],
        "data_implantacao": data_base.strftime("%Y-%m-%d"),
        "data_substituicao": data_substituicao.strftime("%Y-%m-%d"),
        "anos_restantes": vida["anos"],
    }


def gerar_6d_nucleo(pvs, trechos, nucleo=""):
    """Gera resumo 6D de um núcleo inteiro."""
    total_co2 = 0
    total_ciclo_vida = 0
    total_manut_anual = 0
    por_material = defaultdict(lambda: {"ext": 0, "co2": 0, "custo_cv": 0})
    
    for tr in trechos:
        d6 = calcular_6d_trecho(tr, pvs)
        mat = d6["material"]
        por_material[mat]["ext"] += tr.get("ext_m", 0)
        por_material[mat]["co2"] += d6["co2_implantacao_kg"]
        por_material[mat]["custo_cv"] += d6["custo_ciclo_vida"]
        total_co2 += d6["co2_implantacao_kg"]
        total_ciclo_vida += d6["custo_ciclo_vida"]
        total_manut_anual += d6["manutencao_anual"]
    
    return {
        "nucleo": nucleo,
        "co2_total_kg": round(total_co2, 0),
        "co2_total_ton": round(total_co2 / 1000, 2),
        "custo_ciclo_vida_total": round(total_ciclo_vida, 0),
        "manutencao_anual_total": round(total_manut_anual, 0),
        "por_material": dict(por_material),
    }


# ══════════════════════════════════════════════════════════
# LEAN CONSTRUCTION
# ══════════════════════════════════════════════════════════

# Categorias de desperdício (muda)
TIPOS_DESPERDICIO = [
    "espera_material", "espera_equipe", "espera_liberacao",
    "retrabalho", "transporte", "movimentacao",
    "superprodução", "defeito", "estoque",
]

# Etapas do fluxo por NS
FLUXO_NS = [
    {"etapa": "PROJETO",      "responsavel": "Engenharia",  "dias_padrao": 2},
    {"etapa": "PLANEJAMENTO", "responsavel": "Engenharia",  "dias_padrao": 1},
    {"etapa": "ESCAVAÇÃO",    "responsavel": "Campo",       "dias_padrao": 1},
    {"etapa": "ASSENTAMENTO", "responsavel": "Campo",       "dias_padrao": 1},
    {"etapa": "REATERRO",     "responsavel": "Campo",       "dias_padrao": 0.5},
    {"etapa": "TESTE",        "responsavel": "Campo",       "dias_padrao": 0.5},
    {"etapa": "PAVIMENTAÇÃO", "responsavel": "Pavimentação","dias_padrao": 1},
    {"etapa": "CADASTRO",     "responsavel": "Topografia",  "dias_padrao": 1},
    {"etapa": "MEDIÇÃO",      "responsavel": "Engenharia",  "dias_padrao": 1},
]


def calcular_takt_time(trechos, equipes=6, dias_uteis_mes=22):
    """
    Calcula Takt Time: ritmo de produção necessário.
    Takt = tempo disponível / demanda
    """
    ext_total = sum(t.get("ext_m", 0) for t in trechos)
    n_trechos = len(trechos)
    ext_media = ext_total / n_trechos if n_trechos else 0
    
    # Takt por equipe
    trechos_por_equipe_dia = n_trechos / (equipes * dias_uteis_mes * 12)  # 12 meses
    
    return {
        "n_trechos": n_trechos,
        "ext_total": round(ext_total, 0),
        "ext_media_trecho": round(ext_media, 1),
        "equipes": equipes,
        "takt_trechos_dia": round(n_trechos / (equipes * dias_uteis_mes * 6), 2),  # 6 meses
        "takt_metros_dia": round(ext_total / (equipes * dias_uteis_mes * 6), 1),
        "cycle_time_dias": sum(e["dias_padrao"] for e in FLUXO_NS),
        "lead_time_dias": sum(e["dias_padrao"] for e in FLUXO_NS) + 5,  # +5 dias buffer
        "throughput_ns_semana": round(equipes * 5 / sum(e["dias_padrao"] for e in FLUXO_NS), 1),
    }


def mapear_fluxo_valor(trechos, dados_exec=None):
    """
    Value Stream Mapping simplificado por NS.
    Identifica tempo de valor agregado vs desperdício.
    """
    cycle = sum(e["dias_padrao"] for e in FLUXO_NS)  # 9 dias
    
    # Tempo que agrega valor (mãos na obra)
    valor_agregado = sum(e["dias_padrao"] for e in FLUXO_NS 
                        if e["etapa"] in ("ESCAVAÇÃO","ASSENTAMENTO","REATERRO"))  # 2.5 dias
    
    # Tempo de espera estimado (dados reais quando disponível)
    espera = cycle - valor_agregado
    
    eficiencia = (valor_agregado / cycle * 100) if cycle else 0
    
    return {
        "cycle_time": cycle,
        "valor_agregado_dias": valor_agregado,
        "espera_dias": espera,
        "eficiencia_fluxo_pct": round(eficiencia, 1),
        "etapas": FLUXO_NS,
        "meta_eficiencia": 50.0,  # meta lean: 50%+ do tempo é VA
        "gap_pct": round(50 - eficiencia, 1),
    }


# ══════════════════════════════════════════════════════════
# LAST PLANNER SYSTEM (LPS)
# ══════════════════════════════════════════════════════════

CATEGORIAS_RESTRICAO = [
    "material",      # falta de material
    "equipe",        # falta de equipe/operador
    "projeto",       # projeto não aprovado/incompleto
    "clima",         # chuva / temporal
    "sabesp",        # aguardando liberação SABESP
    "acesso",        # acesso ao local bloqueado
    "interferencia", # interferência com outra rede
    "equipamento",   # equipamento quebrado/indisponível
    "documentacao",  # ART, alvará, licença
    "topografia",    # levantamento topo pendente
]


def criar_weekly_work_plan(ns_list, semana, equipes_disponiveis):
    """
    Cria o plano semanal de trabalho (Weekly Work Plan do LPS).
    
    Args:
        ns_list: lista de NS candidatas [{id, pv_ini, pv_fim, ext_m, restricoes, prioridade}]
        semana: "2026-W13"
        equipes_disponiveis: int
    
    Returns:
        Plano com NS alocadas por dia e equipe
    """
    # Filtrar NS sem restrições (ready to execute)
    ns_ready = [ns for ns in ns_list if not ns.get("restricoes")]
    ns_blocked = [ns for ns in ns_list if ns.get("restricoes")]
    
    # Capacidade: 5 dias × N equipes × 1 trecho/equipe/dia
    capacidade = equipes_disponiveis * 5
    
    # Selecionar por prioridade
    ns_planejadas = sorted(ns_ready, key=lambda x: x.get("prioridade", 99))[:capacidade]
    
    # Distribuir por dia
    dias = ["segunda", "terça", "quarta", "quinta", "sexta"]
    plano = {dia: [] for dia in dias}
    
    for i, ns in enumerate(ns_planejadas):
        dia_idx = i % 5
        equipe_idx = i // 5
        if equipe_idx < equipes_disponiveis:
            plano[dias[dia_idx]].append({
                "ns": ns.get("id", f"NS_{i+1}"),
                "trecho": f"{ns.get('pv_ini','?')}→{ns.get('pv_fim','?')}",
                "ext_m": ns.get("ext_m", 0),
                "equipe": equipe_idx + 1,
            })
    
    return {
        "semana": semana,
        "equipes": equipes_disponiveis,
        "capacidade_ns": capacidade,
        "ns_planejadas": len(ns_planejadas),
        "ns_bloqueadas": len(ns_blocked),
        "restricoes_ativas": Counter(r for ns in ns_blocked for r in ns.get("restricoes", [])),
        "plano_diario": plano,
        "ext_planejada": round(sum(ns.get("ext_m", 0) for ns in ns_planejadas), 0),
    }


def calcular_ppc(ns_planejadas, ns_executadas):
    """
    Calcula PPC (Percent Plan Complete) da semana.
    PPC = NS executadas / NS planejadas × 100
    
    Benchmark LPS:
    - < 60%: crítico (muitas restrições não removidas)
    - 60-75%: aceitável (melhorando)
    - 75-85%: bom (sistema estável)
    - > 85%: excelente (fluxo confiável)
    """
    if not ns_planejadas:
        return {"ppc": 0, "classificacao": "SEM DADOS"}
    
    executadas = set(ns_executadas)
    planejadas = set(ns_planejadas)
    
    concluidas = planejadas & executadas
    nao_concluidas = planejadas - executadas
    extras = executadas - planejadas  # feitas sem estar no plano
    
    ppc = len(concluidas) / len(planejadas) * 100
    
    if ppc >= 85: classif = "EXCELENTE"
    elif ppc >= 75: classif = "BOM"
    elif ppc >= 60: classif = "ACEITÁVEL"
    else: classif = "CRÍTICO"
    
    return {
        "ppc": round(ppc, 1),
        "classificacao": classif,
        "planejadas": len(planejadas),
        "executadas_plan": len(concluidas),
        "nao_concluidas": len(nao_concluidas),
        "extras": len(extras),
        "lista_nao_concluidas": list(nao_concluidas),
    }


def analisar_razoes_nao_conclusao(historico_semanas):
    """
    Análise Pareto das razões de não-conclusão.
    Identifica as causas-raiz mais frequentes.
    
    Args:
        historico_semanas: [{semana, ns_nao_concluidas: [{ns, razao}]}]
    """
    razoes = Counter()
    total = 0
    
    for sem in historico_semanas:
        for item in sem.get("ns_nao_concluidas", []):
            razao = item.get("razao", "outro")
            razoes[razao] += 1
            total += 1
    
    # Pareto
    pareto = []
    acum = 0
    for razao, count in razoes.most_common():
        acum += count
        pareto.append({
            "razao": razao,
            "ocorrencias": count,
            "pct": round(count / total * 100, 1) if total else 0,
            "pct_acumulado": round(acum / total * 100, 1) if total else 0,
        })
    
    return {
        "total_nao_conclusoes": total,
        "n_semanas": len(historico_semanas),
        "pareto": pareto,
        "top3": pareto[:3],
        "acao_prioritaria": pareto[0]["razao"] if pareto else None,
    }


def gerar_lookahead(ns_list, semanas=6, equipes=6):
    """
    Gera Lookahead Planning (6 semanas à frente).
    Identifica restrições que precisam ser removidas.
    """
    hoje = datetime.now()
    lookahead = []
    
    ns_restantes = list(ns_list)
    capacidade_semana = equipes * 5  # 5 dias × equipes
    
    for sem in range(semanas):
        inicio = hoje + timedelta(weeks=sem)
        fim = inicio + timedelta(days=4)
        
        # NS para esta semana
        ns_semana = ns_restantes[:capacidade_semana]
        ns_restantes = ns_restantes[capacidade_semana:]
        
        # Contar restrições
        restricoes = Counter()
        ns_ready = 0
        ns_blocked = 0
        for ns in ns_semana:
            restr = ns.get("restricoes", [])
            if restr:
                ns_blocked += 1
                for r in restr:
                    restricoes[r] += 1
            else:
                ns_ready += 1
        
        lookahead.append({
            "semana": sem + 1,
            "periodo": f"{inicio.strftime('%d/%m')} - {fim.strftime('%d/%m')}",
            "ns_total": len(ns_semana),
            "ns_ready": ns_ready,
            "ns_blocked": ns_blocked,
            "restricoes": dict(restricoes),
            "ext_m": round(sum(ns.get("ext_m", 0) for ns in ns_semana), 0),
            "make_ready_urgente": sem <= 2,  # urgente se <= 2 semanas
        })
    
    return {
        "data_base": hoje.strftime("%Y-%m-%d"),
        "semanas": lookahead,
        "total_restricoes": sum(s["ns_blocked"] for s in lookahead),
        "alerta": "CRÍTICO" if lookahead[0]["ns_blocked"] > lookahead[0]["ns_ready"] else "OK",
    }


def gerar_relatorio_lean_lps(pvs, trechos, dados_exec=None, nucleo=""):
    """Gera relatório completo Lean + LPS + 6D."""
    
    # 6D
    d6 = gerar_6d_nucleo(pvs, trechos, nucleo)
    
    # Lean
    takt = calcular_takt_time(trechos)
    vsm = mapear_fluxo_valor(trechos, dados_exec)
    
    # LPS (com dados simulados se não tiver histórico)
    ns_list = [{"id": f"NS_{i+1:03d}", "pv_ini": t.get("pv_ini",""),
                "pv_fim": t.get("pv_fim",""), "ext_m": t.get("ext_m",0),
                "restricoes": [], "prioridade": i}
               for i, t in enumerate(trechos)]
    
    wwp = criar_weekly_work_plan(ns_list, datetime.now().strftime("%Y-W%V"), equipes_disponiveis=6)
    lookahead = gerar_lookahead(ns_list)
    
    return {
        "meta": {
            "plataforma": "ConstruData - HydroNetwork",
            "modulo": "Lean + LPS + BIM 6D",
            "nucleo": nucleo,
            "data": datetime.now().isoformat(),
            "empresa": "FCN Construções e Saneamento",
        },
        "bim_6d": d6,
        "lean": {"takt_time": takt, "value_stream": vsm},
        "lps": {
            "weekly_work_plan": wwp,
            "lookahead_6sem": lookahead,
            "categorias_restricao": CATEGORIAS_RESTRICAO,
            "fluxo_ns": FLUXO_NS,
        },
    }


# ══════════════════════════════════════════════════════════
# IFC 6D PROPERTIES (para adicionar ao gerar_ifc_lod500.py)
# ══════════════════════════════════════════════════════════

def get_6d_properties(material, ext_m, custo_impl=0):
    """Retorna dict de propriedades 6D para inserir no IFC PropertySet."""
    vida = VIDA_UTIL.get(material, VIDA_UTIL["PVC"])
    custo = custo_impl or (ext_m * 910)
    
    return {
        "Vida_Util_Anos": float(vida["anos"]),
        "Manutencao_Anual_Pct": float(vida["manutencao_anual_pct"]),
        "Custo_Ciclo_Vida_RS": round(custo * (1 + vida["manutencao_anual_pct"]/100 * vida["anos"]), 2),
        "CO2_Implantacao_kg": round(vida["co2_kg_m"] * ext_m, 1),
        "Reciclavel": vida["reciclavel"],
        "Data_Substituicao_Est": (datetime.now() + timedelta(days=vida["anos"]*365)).strftime("%Y-%m-%d"),
    }


if __name__ == "__main__":
    import sys
    sys.path.insert(0, "/mnt/user-data/outputs")
    sys.path.insert(0, "CONSTRUDATA_BIM_V6/scripts")
    
    try:
        from ler_dxf_gdal import ler_dxf_gdal
        pvs, trechos, _, _ = ler_dxf_gdal("/home/claude/VERDE_TETEU.dxf")
        
        rel = gerar_relatorio_lean_lps(pvs, trechos, nucleo="Verde e Teteu")
        
        print("═" * 60)
        print("  LEAN + LPS + BIM 6D — Verde e Teteu")
        print("═" * 60)
        
        d6 = rel["bim_6d"]
        print(f"\n  BIM 6D:")
        print(f"    CO2 total: {d6['co2_total_ton']:.1f} ton")
        print(f"    Custo ciclo vida: R$ {d6['custo_ciclo_vida_total']:,.0f}")
        print(f"    Manutenção anual: R$ {d6['manutencao_anual_total']:,.0f}")
        
        lean = rel["lean"]
        print(f"\n  LEAN:")
        print(f"    Takt: {lean['takt_time']['takt_metros_dia']:.1f} m/dia/equipe")
        print(f"    Cycle time: {lean['takt_time']['cycle_time_dias']} dias/NS")
        print(f"    Throughput: {lean['takt_time']['throughput_ns_semana']:.0f} NS/semana")
        print(f"    Eficiência fluxo: {lean['value_stream']['eficiencia_fluxo_pct']:.0f}%")
        
        lps = rel["lps"]
        print(f"\n  LPS:")
        print(f"    Weekly Plan: {lps['weekly_work_plan']['ns_planejadas']} NS planejadas")
        print(f"    Ext planejada: {lps['weekly_work_plan']['ext_planejada']}m")
        print(f"    Lookahead: {lps['lookahead_6sem']['total_restricoes']} restrições em 6 sem")
        
        print(f"\n  ✅ Lean + LPS + 6D integrados")
    except Exception as e:
        print(f"Erro: {e}")
        import traceback; traceback.print_exc()
