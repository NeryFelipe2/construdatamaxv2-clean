#!/usr/bin/env python3
"""
MOTOR_ML.PY — Motor de Machine Learning para Predição de Produção
ConstruData - HydroNetwork · CT 11481051 · FCN Construções e Saneamento

Baseado na análise XGBoost (R²=0.271, 124 amostras):
- Feature mais importante: lig_rolling_3 (produção últimos 3 dias) = 0.50
- Ciclo completo atual: 76 dias → meta 2X: 40 dias
- 366 lig/mês atual → meta 733 lig/mês (2X) → meta SABESP 1000+/mês
- 6.1m de rede por ligação (5.250m ÷ 855 lig)

Pipeline 11 Etapas (gargalos 🔴):
  4. Projeto (10d→5d) 🔴
  6. Execução Rede (15d→8d) 🔴
  7. Lavagem+Coliformes (7d→3d) 🔴
  8. Liberação SABESP (15d→7d) 🔴

Cenários:
  A: +2 eq rede + lab express → 500 lig/mês (R$95k/mês invest)
  B: Pipeline otimizado 2X    → 733 lig/mês (R$180k/mês)
  C: Full scale meta SABESP   → 1000 lig/mês (R$450k/mês)
  D: Só automação             → 450 lig/mês (R$25k/mês)
"""

import json, math, os
import numpy as np
import lightgbm as lgb
from datetime import datetime, timedelta
from collections import defaultdict


# ══════════════════════════════════════════════════════════
# CONSTANTES DO MODELO (calibradas com dados reais)
# ══════════════════════════════════════════════════════════

METROS_POR_LIGACAO = 6.1         # 5.250m ÷ 855 lig
CICLO_ATUAL_DIAS = 76            # cadastro → ligação concluída
CICLO_META_2X = 40
PRODUCAO_ATUAL_MES = 366         # lig/mês
META_2X = 733
META_SABESP = 1000
EQUIPES_ATIVAS = 6
PROD_MEDIA_EQUIPE_DIA = 3.2     # lig/equipe/dia (dados reais)

# Pipeline 11 etapas
PIPELINE = [
    {"etapa": "Cadastro Social",        "equipe": "Social",      "dias_atual": 5,  "dias_2x": 3,  "paralelo": True,  "gargalo": False},
    {"etapa": "Cartografia",            "equipe": "Topo",        "dias_atual": 3,  "dias_2x": 2,  "paralelo": True,  "gargalo": False},
    {"etapa": "Topografia",             "equipe": "Topo",        "dias_atual": 5,  "dias_2x": 3,  "paralelo": True,  "gargalo": False},
    {"etapa": "Projeto",                "equipe": "Engenharia",  "dias_atual": 10, "dias_2x": 5,  "paralelo": False, "gargalo": True},
    {"etapa": "Planejamento",           "equipe": "Engenharia",  "dias_atual": 3,  "dias_2x": 2,  "paralelo": True,  "gargalo": False},
    {"etapa": "Execução Rede",          "equipe": "Campo",       "dias_atual": 15, "dias_2x": 8,  "paralelo": False, "gargalo": True},
    {"etapa": "Lavagem + Coliformes",   "equipe": "Lab",         "dias_atual": 7,  "dias_2x": 3,  "paralelo": False, "gargalo": True},
    {"etapa": "Liberação SABESP",       "equipe": "SABESP",      "dias_atual": 15, "dias_2x": 7,  "paralelo": False, "gargalo": True},
    {"etapa": "Ligação Intradomiciliar","equipe": "Intra",       "dias_atual": 2,  "dias_2x": 1,  "paralelo": True,  "gargalo": False},
    {"etapa": "Gerar docs SABESP",      "equipe": "Admin",       "dias_atual": 10, "dias_2x": 5,  "paralelo": True,  "gargalo": False},
    {"etapa": "Ligação Concluída",      "equipe": "Final",       "dias_atual": 1,  "dias_2x": 1,  "paralelo": True,  "gargalo": False},
]

CENARIOS = [
    {"nome": "ATUAL (base)",           "invest_mes": 0,      "lig_mes": 366,  "custo_lig": 910,  "payback": "-",      "roi": "base"},
    {"nome": "+2 eq rede + lab",       "invest_mes": 95000,  "lig_mes": 500,  "custo_lig": 710,  "payback": "2 meses","roi": "Moderado"},
    {"nome": "Pipeline 2X",            "invest_mes": 180000, "lig_mes": 733,  "custo_lig": 490,  "payback": "1.5 mês","roi": "Alto"},
    {"nome": "Full scale SABESP",      "invest_mes": 450000, "lig_mes": 1000, "custo_lig": 710,  "payback": "3 meses","roi": "Máximo"},
    {"nome": "Só automação",           "invest_mes": 25000,  "lig_mes": 450,  "custo_lig": 298,  "payback": "1 mês",  "roi": "Excelente"},
]


def prever_producao(dados_exec, dias_futuro=30):
    """
    Prevê produção futura usando modelo regressivo real LightGBM (otimização aplicada).
    Treina dinamicamente com base no dataset histórico da obra.
    """
    # Juntar todas as execuções diárias
    diarios = defaultdict(lambda: {"lig_agua": 0, "lig_esg": 0})
    for nucleo, registros in dados_exec.items():
        for r in registros:
            dia = r.get("dia", "")[:10]
            if dia:
                diarios[dia]["lig_agua"] += r.get("lig_agua", 0)
                diarios[dia]["lig_esg"] += r.get("lig_esg", 0)
    
    # Ordenar por data
    dias_ord = sorted(diarios.keys())
    if len(dias_ord) < 7:
        return {"erro": "Dados insuficientes (mínimo 7 dias)"}
    
    lig_diario = [diarios[d]["lig_agua"] + diarios[d]["lig_esg"] for d in dias_ord]
    
    # Criar features para o LightGBM (rolling 3, rolling 7)
    X = []
    y = []
    for i in range(7, len(lig_diario)):
        r3 = sum(lig_diario[i-3:i]) / 3
        r7 = sum(lig_diario[i-7:i]) / 7
        trend = (r3 - r7) / (r7 + 1e-5)
        X.append([r3, r7, trend])
        y.append(lig_diario[i])
        
    X = np.array(X)
    y = np.array(y)
    
    r3_atual = sum(lig_diario[-3:]) / 3
    r7_atual = sum(lig_diario[-7:]) / 7
    trend_atual = (r3_atual - r7_atual) / (r7_atual + 1e-5)
    
    if len(X) > 2:
        model = lgb.LGBMRegressor(n_estimators=50, learning_rate=0.05, num_leaves=7, min_child_samples=2, verbosity=-1)
        model.fit(X, y)
        prod_dia_prevista = model.predict(np.array([[r3_atual, r7_atual, trend_atual]]))[0]
    else:
        prod_dia_prevista = r3_atual * (1 + trend_atual * 0.3)
        
    prod_dia_prevista = max(0.0, float(prod_dia_prevista))
    rolling_3 = r3_atual
    rolling_7 = r7_atual
    tendencia = trend_atual
    
    ultimos_30 = lig_diario[-30:] if len(lig_diario) >= 30 else lig_diario
    media_recente = sum(ultimos_30) / len(ultimos_30) if ultimos_30 else 0
    
    # Projeção
    prod_mes_prevista = prod_dia_prevista * 22  # 22 dias úteis
    metros_mes = prod_mes_prevista * METROS_POR_LIGACAO
    
    return {
        "dados": {
            "dias_com_dados": len(dias_ord),
            "periodo": f"{dias_ord[0]} a {dias_ord[-1]}",
            "total_ligacoes": sum(lig_diario),
            "media_dia": round(media_recente, 1),
        },
        "indicadores": {
            "rolling_3": round(rolling_3, 1),
            "rolling_7": round(rolling_7, 1),
            "tendencia_pct": round(tendencia * 100, 1),
        },
        "previsao": {
            "prod_dia": round(prod_dia_prevista, 1),
            "prod_mes": round(prod_mes_prevista, 0),
            "metros_mes": round(metros_mes, 0),
            "vs_meta_2x": round(prod_mes_prevista / META_2X * 100, 1),
            "vs_meta_sabesp": round(prod_mes_prevista / META_SABESP * 100, 1),
        },
        "projecao_90_dias": {
            "ligacoes": round(prod_dia_prevista * 66, 0),  # 66 dias úteis em 90
            "metros": round(prod_dia_prevista * 66 * METROS_POR_LIGACAO, 0),
            "custo_estimado": round(prod_dia_prevista * 66 * METROS_POR_LIGACAO * 910, 0),
        },
    }


def analisar_gargalos(dados_exec=None):
    """Analisa gargalos do pipeline baseado nos dados."""
    caminho_critico = sum(e["dias_atual"] for e in PIPELINE if not e["paralelo"])
    caminho_2x = sum(e["dias_2x"] for e in PIPELINE if not e["paralelo"])
    
    resultado = {
        "pipeline": PIPELINE,
        "ciclo_atual": CICLO_ATUAL_DIAS,
        "caminho_critico": caminho_critico,
        "ciclo_meta_2x": CICLO_META_2X,
        "caminho_critico_2x": caminho_2x,
        "gargalos": [e for e in PIPELINE if e["gargalo"]],
        "reducao_pct": round((1 - caminho_2x / caminho_critico) * 100, 0),
    }
    
    # Se tem dados reais, comparar produção real vs capacidade
    if dados_exec:
        resumo = {}
        for nucleo, registros in dados_exec.items():
            lig_total = sum(r.get("lig_agua", 0) + r.get("lig_esg", 0) for r in registros)
            dias = len(registros)
            resumo[nucleo] = {
                "lig_total": lig_total,
                "dias": dias,
                "prod_dia": round(lig_total / dias, 1) if dias else 0,
            }
        resultado["producao_real"] = resumo
    
    return resultado


def simular_cenario(cenario_idx, saldo_total_m, custo_metro=910):
    """Simula um cenário de aceleração."""
    c = CENARIOS[cenario_idx]
    lig_mes = c["lig_mes"]
    metros_mes = lig_mes * METROS_POR_LIGACAO
    meses_restantes = math.ceil(saldo_total_m / metros_mes) if metros_mes > 0 else 999
    custo_total = saldo_total_m * custo_metro
    invest_total = c["invest_mes"] * meses_restantes
    
    return {
        "cenario": c["nome"],
        "invest_mensal": c["invest_mes"],
        "lig_mes": lig_mes,
        "metros_mes": round(metros_mes, 0),
        "meses_para_concluir": meses_restantes,
        "data_conclusao_est": (datetime.now() + timedelta(days=meses_restantes * 30)).strftime("%b/%Y"),
        "custo_obra_total": round(custo_total, 0),
        "investimento_total": round(invest_total, 0),
        "custo_por_ligacao": c["custo_lig"],
    }


def gerar_relatorio_ml(dados_exec, saldo_total_m=25730):
    """Gera relatório completo de ML + predição + cenários."""
    previsao = prever_producao(dados_exec)
    gargalos = analisar_gargalos(dados_exec)
    
    cenarios_sim = []
    for i in range(len(CENARIOS)):
        cenarios_sim.append(simular_cenario(i, saldo_total_m))
    
    return {
        "meta": {
            "plataforma": "ConstruData - HydroNetwork",
            "modulo": "ML — Predição de Produção",
            "modelo": "Rolling Average (baseado em XGBoost R²=0.271)",
            "data": datetime.now().isoformat(),
            "empresa": "FCN Construções e Saneamento",
        },
        "estado_atual": {
            "saldo_metros": saldo_total_m,
            "ligacoes_restantes": round(saldo_total_m / METROS_POR_LIGACAO, 0),
            "metros_por_ligacao": METROS_POR_LIGACAO,
            "custo_total_estimado": round(saldo_total_m * 910, 0),
        },
        "previsao": previsao,
        "gargalos": gargalos,
        "cenarios": cenarios_sim,
    }


if __name__ == "__main__":
    # Teste com dados reais
    if os.path.exists("/home/claude/EXECUCAO_DIARIA.json"):
        with open("/home/claude/EXECUCAO_DIARIA.json") as f:
            dados = json.load(f)
        
        relatorio = gerar_relatorio_ml(dados)
        
        print("═" * 60)
        print("  ML — PREDIÇÃO DE PRODUÇÃO")
        print("═" * 60)
        
        p = relatorio["previsao"]
        if "erro" not in p:
            print(f"\n  Dados: {p['dados']['dias_com_dados']} dias ({p['dados']['periodo']})")
            print(f"  Total ligações: {p['dados']['total_ligacoes']:.0f}")
            print(f"  Rolling 3d: {p['indicadores']['rolling_3']:.1f} lig/dia")
            print(f"  Rolling 7d: {p['indicadores']['rolling_7']:.1f} lig/dia")
            print(f"  Tendência: {p['indicadores']['tendencia_pct']:+.1f}%")
            print(f"\n  Previsão: {p['previsao']['prod_mes']:.0f} lig/mês")
            print(f"  vs Meta 2X: {p['previsao']['vs_meta_2x']:.0f}%")
            print(f"  vs SABESP:  {p['previsao']['vs_meta_sabesp']:.0f}%")
        
        print(f"\n  CENÁRIOS:")
        for c in relatorio["cenarios"]:
            print(f"    {c['cenario']:30s} | {c['lig_mes']:5d} lig/mês | {c['meses_para_concluir']:3d} meses | Conclusão: {c['data_conclusao_est']}")
