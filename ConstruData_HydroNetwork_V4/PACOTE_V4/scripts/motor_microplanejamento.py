#!/usr/bin/env python3
"""
MOTOR_MICROPLANEJAMENTO.PY — Micro-Planejamento por Frente de Serviço
ConstruData - HydroNetwork · CT 11481051 · FCN Construções e Saneamento

Analisa ONDE jogar recursos (mão de obra, material, equipamento) baseado em:

1. MORFOLOGIA DO TERRENO
   - Morro (declividade >15%): escavação manual, escoramento pesado, equipe reforçada
   - Encosta (8-15%): misto mecânico/manual, escoramento leve
   - Planície (<8%): escavação mecânica, produtividade máxima
   - Mangue/brejo: rebaixamento lençol, estacas-prancha, equipamento especial
   - Favela/viela: sem acesso p/ máquina, 100% manual, mini-retro

2. TIPO DE FRENTE DE SERVIÇO
   - Rede coletora esgoto (tronco): DN200-400, profunda, mecânica
   - Rede distribuição água: DN63-160, rasa, rápida
   - Ligação predial: ramal curto, equipe leve
   - Prolongamento: extensão nova em via, pavimentação pesada

3. ALOCAÇÃO DE RECURSOS
   - MÃO DE OBRA: encanador, ajudante, operador, topógrafo, sinaleiro
   - EQUIPAMENTO: retroescavadeira, mini-retro, compactador, bomba
   - MATERIAL: tubo, PV, areia, brita, CBUQ (just-in-time por frente)

4. PRODUTIVIDADE POR TIPO DE TERRENO
   - Planície: 25-35 m/dia/equipe
   - Encosta: 15-25 m/dia/equipe
   - Morro: 8-15 m/dia/equipe
   - Mangue: 5-10 m/dia/equipe
   - Viela/favela: 10-18 m/dia/equipe
"""

import json, math, os
from datetime import datetime, timedelta
from collections import defaultdict


# ══════════════════════════════════════════════════════════
# MORFOLOGIA DO TERRENO
# ══════════════════════════════════════════════════════════

MORFOLOGIA = {
    "planicie": {
        "descricao": "Terreno plano (declividade < 8%)",
        "decl_max_pct": 8,
        "escavacao": "mecânica",
        "equipe_tipo": "padrão",
        "prod_m_dia": {"min": 25, "max": 35, "media": 30},
        "fator_custo": 1.0,
        "equipamentos": ["Retroescavadeira", "Compactador de solo", "Placa vibratória"],
        "equipe": {"encanador": 2, "ajudante": 4, "operador_retro": 1, "sinaleiro": 1},
        "riscos": ["interferência rede existente", "nível freático"],
        "escoramento": "pontalete leve ou dispensa",
    },
    "encosta": {
        "descricao": "Encosta moderada (8-15%)",
        "decl_min_pct": 8, "decl_max_pct": 15,
        "escavacao": "mista (mecânica + manual)",
        "equipe_tipo": "reforçada",
        "prod_m_dia": {"min": 15, "max": 25, "media": 20},
        "fator_custo": 1.25,
        "equipamentos": ["Mini-retroescavadeira", "Compactador", "Escoramento metálico"],
        "equipe": {"encanador": 2, "ajudante": 6, "operador_retro": 1, "sinaleiro": 1, "carpinteiro": 1},
        "riscos": ["deslizamento de talude", "drenagem pluvial", "acesso máquina limitado"],
        "escoramento": "metálico tipo hamburguesa ou pontalete",
    },
    "morro": {
        "descricao": "Morro/favela (declividade > 15%)",
        "decl_min_pct": 15,
        "escavacao": "manual predominante",
        "equipe_tipo": "especializada morro",
        "prod_m_dia": {"min": 8, "max": 15, "media": 12},
        "fator_custo": 1.65,
        "equipamentos": ["Mini-retro (onde acessa)", "Martelete", "Guincho/talha", "Bomba submersa"],
        "equipe": {"encanador": 3, "ajudante": 8, "operador_mini": 1, "sinaleiro": 2, "carpinteiro": 1},
        "riscos": ["desmoronamento", "alagamento vala", "acesso material manual", "segurança trabalhador"],
        "escoramento": "metálico pesado ou madeira reforçada — OBRIGATÓRIO",
    },
    "mangue": {
        "descricao": "Área alagada/mangue/brejo",
        "escavacao": "manual + rebaixamento",
        "equipe_tipo": "especializada alagado",
        "prod_m_dia": {"min": 5, "max": 10, "media": 7},
        "fator_custo": 2.10,
        "equipamentos": ["Bomba submersível", "Ponteira de rebaixamento", "Estaca-prancha", "Mini-retro anfíbia"],
        "equipe": {"encanador": 2, "ajudante": 6, "operador_bomba": 1, "sinaleiro": 1, "mergulhador": 0},
        "riscos": ["lençol freático alto", "contaminação solo", "instabilidade", "fauna protegida"],
        "escoramento": "estaca-prancha metálica — OBRIGATÓRIO + rebaixamento",
    },
    "viela": {
        "descricao": "Viela/beco sem acesso veicular",
        "escavacao": "100% manual",
        "equipe_tipo": "manual pura",
        "prod_m_dia": {"min": 10, "max": 18, "media": 14},
        "fator_custo": 1.45,
        "equipamentos": ["Martelete elétrico", "Compactador manual", "Carrinho de mão"],
        "equipe": {"encanador": 2, "ajudante": 6, "sinaleiro": 1},
        "riscos": ["acesso material por carrinho", "moradores", "sem espaço bota-fora", "fiação elétrica"],
        "escoramento": "pontalete madeira (espaço limitado)",
    },
}

# Núcleos SLNR Santos com morfologia conhecida
NUCLEOS_MORFOLOGIA = {
    "Verde e Teteu":    {"morfologia": "morro",    "obs": "Morro do Tetéu, cotas 0-124m, vielas estreitas"},
    "Pantanal Baixo":   {"morfologia": "mangue",   "obs": "Área alagadiça, lençol freático alto, solo mole"},
    "Vila Criadores":   {"morfologia": "encosta",  "obs": "Encosta moderada, acesso parcial máquina"},
    "São Manoel":       {"morfologia": "planicie", "obs": "Área plana, vias pavimentadas, acesso bom"},
    "Vila Israel":      {"morfologia": "encosta",  "obs": "Encosta + vielas na parte alta"},
    "João Carlos":      {"morfologia": "viela",    "obs": "Núcleo denso, becos sem acesso veicular"},
    "Noroeste":         {"morfologia": "planicie", "obs": "Área urbanizada plana"},
    "Vila Progresso":   {"morfologia": "encosta",  "obs": "Misto encosta/viela"},
}


# ══════════════════════════════════════════════════════════
# FRENTES DE SERVIÇO
# ══════════════════════════════════════════════════════════

FRENTES_SERVICO = {
    "rede_esg_tronco": {
        "descricao": "Rede coletora esgoto — tronco",
        "dns": [200, 300, 400],
        "prof_media": 2.5,
        "largura_vala": 0.80,
        "complexidade": "alta",
        "sequencia": ["escavação", "lastro", "assentamento", "junta", "teste", "reaterro", "compactação", "CBUQ"],
    },
    "rede_esg_ramal": {
        "descricao": "Ramal predial esgoto",
        "dns": [100, 150],
        "prof_media": 1.2,
        "largura_vala": 0.60,
        "complexidade": "baixa",
        "sequencia": ["escavação", "assentamento", "reaterro", "compactação"],
    },
    "rede_agua": {
        "descricao": "Rede distribuição água",
        "dns": [63, 110, 160],
        "prof_media": 1.0,
        "largura_vala": 0.60,
        "complexidade": "média",
        "sequencia": ["escavação", "lastro", "assentamento", "fusão/junta", "teste pressão", "reaterro", "CBUQ"],
    },
    "ligacao_predial": {
        "descricao": "Ligação predial (água ou esgoto)",
        "dns": [20, 32, 50],
        "prof_media": 0.8,
        "largura_vala": 0.40,
        "complexidade": "baixa",
        "sequencia": ["escavação", "assentamento", "conexão cavalete", "reaterro"],
    },
    "prolongamento": {
        "descricao": "Prolongamento de rede em via",
        "dns": [200, 300],
        "prof_media": 2.0,
        "largura_vala": 0.80,
        "complexidade": "alta",
        "sequencia": ["sinalização", "demolição", "escavação", "escoramento", "lastro", "assentamento", "PV", "teste", "reaterro", "compactação", "sub-base", "CBUQ"],
    },
}


# ══════════════════════════════════════════════════════════
# RECURSOS
# ══════════════════════════════════════════════════════════

CUSTO_RECURSO_DIA = {
    # Mão de obra
    "encanador":        {"tipo": "MO", "custo_dia": 280, "disponivel": 12},
    "ajudante":         {"tipo": "MO", "custo_dia": 160, "disponivel": 30},
    "operador_retro":   {"tipo": "MO", "custo_dia": 320, "disponivel": 4},
    "operador_mini":    {"tipo": "MO", "custo_dia": 300, "disponivel": 2},
    "operador_bomba":   {"tipo": "MO", "custo_dia": 250, "disponivel": 2},
    "sinaleiro":        {"tipo": "MO", "custo_dia": 150, "disponivel": 8},
    "carpinteiro":      {"tipo": "MO", "custo_dia": 250, "disponivel": 3},
    "topografo":        {"tipo": "MO", "custo_dia": 400, "disponivel": 2},
    # Equipamento
    "Retroescavadeira": {"tipo": "EQ", "custo_dia": 850, "disponivel": 3},
    "Mini-retroescavadeira":{"tipo":"EQ","custo_dia": 550, "disponivel": 2},
    "Compactador de solo":  {"tipo":"EQ","custo_dia": 180, "disponivel": 4},
    "Placa vibratória":     {"tipo":"EQ","custo_dia": 120, "disponivel": 4},
    "Martelete":            {"tipo":"EQ","custo_dia": 150, "disponivel": 3},
    "Bomba submersível":    {"tipo":"EQ","custo_dia": 200, "disponivel": 2},
    "Compactador manual":   {"tipo":"EQ","custo_dia": 80,  "disponivel": 5},
}


def classificar_morfologia_trecho(tr, pvs):
    """Classifica a morfologia do terreno de um trecho baseado nas cotas."""
    p0 = pvs.get(tr.get("pv_ini"), {})
    p1 = pvs.get(tr.get("pv_fim"), {})
    
    ct0 = p0.get("ct") or 0
    ct1 = p1.get("ct") or 0
    ext = tr.get("ext_m") or 1
    
    if ct0 == 0 and ct1 == 0:
        return "planicie"  # sem dados, assume plano
    
    desnivel = abs(ct0 - ct1)
    decl_pct = (desnivel / ext) * 100 if ext > 0 else 0
    
    if decl_pct > 15:
        return "morro"
    elif decl_pct > 8:
        return "encosta"
    else:
        return "planicie"


def classificar_frente(tr):
    """Classifica o tipo de frente de serviço."""
    dn = tr.get("dn_mm") or 200
    tipo = tr.get("tipo", "esgoto")
    
    if tipo == "agua":
        if dn <= 50: return "ligacao_predial"
        return "rede_agua"
    else:
        if dn <= 150: return "rede_esg_ramal"
        if dn >= 300: return "prolongamento"
        return "rede_esg_tronco"


def micro_planejar_trecho(tr, pvs):
    """
    Micro-planejamento completo de 1 trecho:
    - Morfologia → equipe + equipamento + produtividade
    - Frente → sequência de serviço
    - Custo detalhado da frente
    - Duração estimada
    """
    morfologia = classificar_morfologia_trecho(tr, pvs)
    frente = classificar_frente(tr)
    
    morf_data = MORFOLOGIA[morfologia]
    frente_data = FRENTES_SERVICO[frente]
    ext = tr.get("ext_m") or 0
    
    # Produtividade
    prod_dia = morf_data["prod_m_dia"]["media"]
    duracao_dias = math.ceil(ext / prod_dia) if prod_dia > 0 else 1
    if duracao_dias < 1: duracao_dias = 1
    
    # Equipe necessária
    equipe = dict(morf_data["equipe"])
    
    # Custo MO + EQ por dia
    custo_mo_dia = sum(CUSTO_RECURSO_DIA.get(func, {}).get("custo_dia", 0) * qtd 
                       for func, qtd in equipe.items())
    custo_eq_dia = sum(CUSTO_RECURSO_DIA.get(eq, {}).get("custo_dia", 0) 
                       for eq in morf_data["equipamentos"] 
                       if eq in CUSTO_RECURSO_DIA)
    
    custo_frente_total = (custo_mo_dia + custo_eq_dia) * duracao_dias
    
    # Material just-in-time
    dn = tr.get("dn_mm") or 200
    material_necessario = {
        f"Tubo {tr.get('material','PVC')} DN{dn}": {"qtd": ext, "un": "m"},
        "Areia fundação": {"qtd": round(ext * 0.25, 1), "un": "m³"},
        "Brita": {"qtd": round(ext * 0.22, 1), "un": "m³"},
        "CBUQ": {"qtd": round(ext * 0.88, 1), "un": "m²"},
    }
    if frente in ("rede_esg_tronco", "prolongamento"):
        n_pvs = max(1, int(ext / 50))  # ~1 PV a cada 50m
        material_necessario["PV concreto DN1200"] = {"qtd": n_pvs, "un": "un"}
    
    return {
        "ns": f"{tr.get('pv_ini','?')}→{tr.get('pv_fim','?')}",
        "ext_m": ext,
        "dn_mm": dn,
        "tipo": tr.get("tipo", "esgoto"),
        "morfologia": morfologia,
        "morfologia_desc": morf_data["descricao"],
        "frente": frente,
        "frente_desc": frente_data["descricao"],
        "escavacao": morf_data["escavacao"],
        "escoramento": morf_data["escoramento"],
        "prod_m_dia": prod_dia,
        "duracao_dias": duracao_dias,
        "fator_custo": morf_data["fator_custo"],
        "equipe": equipe,
        "equipamentos": morf_data["equipamentos"],
        "sequencia_servico": frente_data["sequencia"],
        "riscos": morf_data["riscos"],
        "custo_mo_dia": custo_mo_dia,
        "custo_eq_dia": custo_eq_dia,
        "custo_frente_total": round(custo_frente_total, 0),
        "material_necessario": material_necessario,
    }


def micro_planejar_nucleo(pvs, trechos, nucleo="", equipes_max=6):
    """
    Micro-planejamento completo de um núcleo.
    Agrupa trechos por morfologia, otimiza alocação de recursos.
    """
    # Classificar cada trecho
    planejamento = []
    por_morfologia = defaultdict(list)
    
    for i, tr in enumerate(trechos):
        mp = micro_planejar_trecho(tr, pvs)
        mp["ns_id"] = i + 1
        planejamento.append(mp)
        por_morfologia[mp["morfologia"]].append(mp)
    
    # Resumo por morfologia
    resumo_morf = {}
    for morf, trs in por_morfologia.items():
        ext = sum(t["ext_m"] for t in trs)
        dias = sum(t["duracao_dias"] for t in trs)
        custo = sum(t["custo_frente_total"] for t in trs)
        resumo_morf[morf] = {
            "descricao": MORFOLOGIA[morf]["descricao"],
            "n_trechos": len(trs),
            "extensao_m": round(ext, 0),
            "pct_total": round(ext / sum(t["ext_m"] for t in planejamento) * 100, 1) if planejamento else 0,
            "dias_total": dias,
            "custo_frente": round(custo, 0),
            "prod_media_dia": round(ext / dias, 1) if dias else 0,
            "equipe_recomendada": MORFOLOGIA[morf]["equipe"],
            "equipamentos": MORFOLOGIA[morf]["equipamentos"],
        }
    
    # Alocação ótima de equipes
    total_dias = sum(mp["duracao_dias"] for mp in planejamento)
    dias_paralelo = math.ceil(total_dias / equipes_max)
    
    # Material consolidado (just-in-time por semana)
    material_total = defaultdict(lambda: {"qtd": 0, "un": ""})
    for mp in planejamento:
        for mat, dados in mp["material_necessario"].items():
            material_total[mat]["qtd"] += dados["qtd"]
            material_total[mat]["un"] = dados["un"]
    
    # Custo total da frente
    custo_total_frente = sum(mp["custo_frente_total"] for mp in planejamento)
    ext_total = sum(mp["ext_m"] for mp in planejamento)
    
    return {
        "meta": {
            "plataforma": "ConstruData - HydroNetwork",
            "modulo": "Micro-Planejamento",
            "nucleo": nucleo,
            "data": datetime.now().isoformat(),
            "empresa": "FCN Construções e Saneamento",
        },
        "resumo": {
            "n_trechos": len(planejamento),
            "extensao_total": round(ext_total, 0),
            "dias_sequencial": total_dias,
            "dias_paralelo": dias_paralelo,
            "equipes_max": equipes_max,
            "custo_frente_total": round(custo_total_frente, 0),
            "custo_por_metro_frente": round(custo_total_frente / ext_total, 2) if ext_total else 0,
        },
        "por_morfologia": resumo_morf,
        "material_consolidado": dict(material_total),
        "trechos": planejamento,
        "recomendacoes": _gerar_recomendacoes(resumo_morf, equipes_max),
    }


def _gerar_recomendacoes(resumo_morf, equipes):
    """Gera recomendações de alocação baseado na morfologia."""
    recs = []
    
    for morf, dados in resumo_morf.items():
        pct = dados["pct_total"]
        eq_rec = max(1, round(equipes * pct / 100))
        
        if morf == "morro":
            recs.append({
                "prioridade": "ALTA",
                "tipo": "EQUIPE MORRO",
                "acao": f"Alocar {eq_rec} equipe(s) especializada(s) em morro. "
                        f"Produtividade {dados['prod_media_dia']:.0f}m/dia. "
                        f"Escoramento OBRIGATÓRIO. Equipamento: mini-retro onde acessa + manual.",
                "equipes": eq_rec,
                "extensao": dados["extensao_m"],
                "dias_estimados": math.ceil(dados["dias_total"] / eq_rec),
            })
        elif morf == "mangue":
            recs.append({
                "prioridade": "ALTA",
                "tipo": "EQUIPE MANGUE",
                "acao": f"Alocar {eq_rec} equipe(s) c/ bomba submersível. "
                        f"Rebaixamento lençol freático ANTES de escavar. "
                        f"Estaca-prancha obrigatória. Produtividade {dados['prod_media_dia']:.0f}m/dia.",
                "equipes": eq_rec,
                "extensao": dados["extensao_m"],
                "dias_estimados": math.ceil(dados["dias_total"] / eq_rec),
            })
        elif morf == "viela":
            recs.append({
                "prioridade": "MÉDIA",
                "tipo": "EQUIPE VIELA",
                "acao": f"Alocar {eq_rec} equipe(s) manual(ais). "
                        f"Sem máquina — martelete + carrinho. "
                        f"Material entregue na boca da viela. Produtividade {dados['prod_media_dia']:.0f}m/dia.",
                "equipes": eq_rec,
                "extensao": dados["extensao_m"],
                "dias_estimados": math.ceil(dados["dias_total"] / eq_rec),
            })
        elif morf == "encosta":
            recs.append({
                "prioridade": "MÉDIA",
                "tipo": "EQUIPE ENCOSTA",
                "acao": f"Alocar {eq_rec} equipe(s) mista(s). "
                        f"Mini-retro onde acessa, manual no resto. "
                        f"Escoramento metálico. Produtividade {dados['prod_media_dia']:.0f}m/dia.",
                "equipes": eq_rec,
                "extensao": dados["extensao_m"],
                "dias_estimados": math.ceil(dados["dias_total"] / eq_rec),
            })
        else:  # planicie
            recs.append({
                "prioridade": "NORMAL",
                "tipo": "EQUIPE PADRÃO",
                "acao": f"Alocar {eq_rec} equipe(s) padrão c/ retroescavadeira. "
                        f"Produtividade máxima: {dados['prod_media_dia']:.0f}m/dia. Via normal.",
                "equipes": eq_rec,
                "extensao": dados["extensao_m"],
                "dias_estimados": math.ceil(dados["dias_total"] / eq_rec),
            })
    
    return sorted(recs, key=lambda r: {"ALTA": 0, "MÉDIA": 1, "NORMAL": 2}[r["prioridade"]])


if __name__ == "__main__":
    import sys
    sys.path.insert(0, "/mnt/user-data/outputs")
    sys.path.insert(0, "CONSTRUDATA_BIM_V6/scripts")
    
    from ler_dxf_gdal import ler_dxf_gdal
    pvs, trechos, _, _ = ler_dxf_gdal("/home/claude/VERDE_TETEU.dxf")
    
    resultado = micro_planejar_nucleo(pvs, trechos, "Verde e Teteu", equipes_max=4)
    
    print("═" * 70)
    print("  MICRO-PLANEJAMENTO — Verde e Teteu")
    print("═" * 70)
    
    r = resultado["resumo"]
    print(f"\n  {r['n_trechos']} trechos | {r['extensao_total']}m")
    print(f"  Dias sequencial: {r['dias_sequencial']} | Paralelo ({r['equipes_max']} eq): {r['dias_paralelo']}")
    print(f"  Custo frente: R$ {r['custo_frente_total']:,.0f} (R$ {r['custo_por_metro_frente']:.0f}/m)")
    
    print(f"\n  POR MORFOLOGIA:")
    for morf, d in resultado["por_morfologia"].items():
        print(f"    {morf:12s} | {d['n_trechos']:3d} tr | {d['extensao_m']:>6.0f}m ({d['pct_total']:>4.1f}%) | "
              f"{d['prod_media_dia']:>4.1f}m/d | {d['dias_total']:>4d}d | R$ {d['custo_frente']:>8,.0f}")
    
    print(f"\n  MATERIAL CONSOLIDADO:")
    for mat, d in resultado["material_consolidado"].items():
        print(f"    {mat:30s} | {d['qtd']:>8.1f} {d['un']}")
    
    print(f"\n  RECOMENDAÇÕES:")
    for rec in resultado["recomendacoes"]:
        print(f"    [{rec['prioridade']:6s}] {rec['tipo']}: {rec['equipes']} eq → {rec['extensao']:.0f}m em ~{rec['dias_estimados']}d")
        print(f"           {rec['acao'][:90]}")
