#!/usr/bin/env python3
"""
MOTOR_CUSTO.PY — Motor de Custos do Contrato SLNR Santos
ConstruData - HydroNetwork · CT 11481051 · FCN Construções e Saneamento

Preços REAIS do contrato (não SINAPI genérico).
Fonte: MESTRE_SLNR_FINALxxx1.xlsx → aba CUSTOS + FATORES

Composição R$/metro (R$ 910/m com BDI):
  Escavação mecânica     R$ 145/m
  Tubo ESG (DN200/300)   R$ 240/m
  Tubo AG (PEAD)         R$  95/m
  PV / Caixas / PIs      R$ 120/m
  Reaterro compactado    R$  80/m
  Ramal predial          R$  65/m
  Pavimentação CBUQ      R$  45/m
  Sinalização            R$  15/m
  BDI 25%                R$ 198/m
  TOTAL                  R$ 910/m (≈ R$805 + arredondamento)
"""

import json, math, os
from pathlib import Path

# ══════════════════════════════════════════════════════════
# PREÇOS DO CONTRATO (extraídos da planilha MESTRE_SLNR)
# ══════════════════════════════════════════════════════════

PRECOS_CONTRATO = {
    # Tubulação esgoto
    "Tubo PVC DN100":  {"tipo":"ESG","un":"m","preco":150.00},
    "Tubo PVC DN150":  {"tipo":"ESG","un":"m","preco":175.00},
    "Tubo PVC DN200":  {"tipo":"ESG","un":"m","preco":200.12},
    "Tubo PVC DN250":  {"tipo":"ESG","un":"m","preco":255.00},
    "Tubo PVC DN300":  {"tipo":"ESG","un":"m","preco":310.00},
    "Tubo PVC DN400":  {"tipo":"ESG","un":"m","preco":420.00},
    # Tubulação água
    "Tubo PEAD DN63":  {"tipo":"AG","un":"m","preco":85.00},
    "Tubo PEAD DN110": {"tipo":"AG","un":"m","preco":101.80},
    "PEAD PE80 DN63":  {"tipo":"AG","un":"m","preco":85.00},
    "PEAD PE80 DN160": {"tipo":"AG","un":"m","preco":145.00},
    "PEAD PE80 PN10":  {"tipo":"AG","un":"m","preco":95.00},
    "PVC JE PBA DN20": {"tipo":"AG","un":"m","preco":42.00},
    # Estruturas
    "PV concreto DN1200":{"tipo":"ESG","un":"un","preco":3686.00},
    "PI plástico DN600": {"tipo":"ESG","un":"un","preco":1412.00},
    "Caixa inspeção":    {"tipo":"ESG","un":"un","preco":1034.00},
    # Acessórios água
    "Sela eletrofusão":  {"tipo":"AG","un":"un","preco":660.00},
    "Cavalete/hidrom.":  {"tipo":"AG","un":"un","preco":490.00},
    "Conexões diversas": {"tipo":"AG","un":"vb","preco":120.00},
    # Insumos gerais
    "Areia":            {"tipo":"GERAL","un":"m³","preco":160.00},
    "Berço":            {"tipo":"GERAL","un":"m³","preco":160.00},
    "Brita base":       {"tipo":"GERAL","un":"m³","preco":210.00},
    "Concreto":         {"tipo":"GERAL","un":"m³","preco":720.00},
    "CBUQ provisório":  {"tipo":"GERAL","un":"m²","preco":55.00},
    "CBUQ definitivo":  {"tipo":"GERAL","un":"m²","preco":120.00},
}

# Composição por metro de rede (R$/m)
COMPOSICAO_METRO = {
    "escavacao":     145.0,
    "tubo_esg":      240.0,
    "tubo_ag":        95.0,
    "pv_caixas":     120.0,
    "reaterro":       80.0,
    "ramal":          65.0,
    "pavimentacao":   45.0,
    "sinalizacao":    15.0,
}
BDI = 0.25

# Fatores de material por metro
FATORES = {
    "Tubo PVC DN200":    0.60,  # m/m
    "Tubo PVC DN300":    0.40,
    "PV concreto DN1200":0.068, # un/m
    "PI plástico DN600": 0.022,
    "Caixa inspeção":    0.055,
    "Tubo PEAD DN63":    0.70,
    "Tubo PEAD DN110":   0.30,
    "Sela eletrofusão":  0.022,
    "Cavalete/hidrom.":  0.017,
    "Conexões diversas": 0.011,
    "Areia":             0.25,  # m³/m
    "Berço":             0.24,
    "Brita base":        0.22,
    "Concreto":          0.18,
    "CBUQ provisório":   0.88,  # m²/m
    "CBUQ definitivo":   0.88,
}

# Mapa DN → material padrão
DN_MATERIAL = {
    100:"Tubo PVC DN100", 150:"Tubo PVC DN150", 200:"Tubo PVC DN200",
    250:"Tubo PVC DN250", 300:"Tubo PVC DN300", 400:"Tubo PVC DN400",
    63:"Tubo PEAD DN63", 110:"Tubo PEAD DN110", 160:"PEAD PE80 DN160",
    75:"Tubo PEAD DN63", 32:"PVC JE PBA DN20", 50:"PVC JE PBA DN20",
    315:"Tubo PVC DN300",
}


def custo_trecho(tr, pvs, tabela=None):
    """
    Calcula custo detalhado de um trecho usando preços do contrato.
    
    Returns dict com todos os itens de custo.
    """
    precos = tabela or PRECOS_CONTRATO
    
    dn = tr.get("dn_mm") or 200
    ext = tr.get("ext_m") or 0
    tipo = tr.get("tipo", "esgoto")
    material = tr.get("material", "PVC")
    
    p0 = pvs.get(tr.get("pv_ini"), {})
    p1 = pvs.get(tr.get("pv_fim"), {})
    ct_i = p0.get("ct") or 0
    cf_i = p0.get("cf") or 0
    ct_f = p1.get("ct") or 0
    cf_f = p1.get("cf") or 0
    prof_med = ((ct_i-cf_i)+(ct_f-cf_f))/2 if (ct_i and cf_i) else 1.5
    if prof_med <= 0: prof_med = 1.5
    
    largura_vala = 0.80
    
    # ── Quantitativos ──
    vol_escav = ext * prof_med * largura_vala
    vol_reat = vol_escav * 0.85
    vol_areia = ext * FATORES.get("Areia", 0.25)
    vol_berco = ext * FATORES.get("Berço", 0.24)
    vol_brita = ext * FATORES.get("Brita base", 0.22)
    vol_concreto = ext * FATORES.get("Concreto", 0.18)
    area_cbuq_prov = ext * FATORES.get("CBUQ provisório", 0.88)
    area_cbuq_def = ext * FATORES.get("CBUQ definitivo", 0.88)
    
    # ── Preço do tubo ──
    mat_key = DN_MATERIAL.get(dn, f"Tubo PVC DN{dn}")
    preco_tubo = precos.get(mat_key, {}).get("preco", 200.0)
    
    # ── Itens de custo ──
    itens = [
        {"codigo": "ESC-001", "servico": "Escavação mecânica", "un": "m³",
         "qtd": round(vol_escav, 2), "preco_unit": COMPOSICAO_METRO["escavacao"]/prof_med/largura_vala,
         "valor": round(ext * COMPOSICAO_METRO["escavacao"], 2)},
        
        {"codigo": f"TUB-{dn}", "servico": f"Tubo {material} DN{dn}", "un": "m",
         "qtd": round(ext, 2), "preco_unit": preco_tubo,
         "valor": round(ext * preco_tubo, 2)},
        
        {"codigo": "PV-001", "servico": "PV/PI/Caixa (rateio)", "un": "un",
         "qtd": 1, "preco_unit": round(ext * COMPOSICAO_METRO["pv_caixas"], 2),
         "valor": round(ext * COMPOSICAO_METRO["pv_caixas"], 2)},
        
        {"codigo": "REA-001", "servico": "Reaterro compactado", "un": "m³",
         "qtd": round(vol_reat, 2), "preco_unit": COMPOSICAO_METRO["reaterro"]/prof_med/largura_vala/0.85,
         "valor": round(ext * COMPOSICAO_METRO["reaterro"], 2)},
        
        {"codigo": "PAV-001", "servico": "CBUQ provisório", "un": "m²",
         "qtd": round(area_cbuq_prov, 2), "preco_unit": 55.0,
         "valor": round(area_cbuq_prov * 55.0, 2)},
        
        {"codigo": "PAV-002", "servico": "CBUQ definitivo", "un": "m²",
         "qtd": round(area_cbuq_def, 2), "preco_unit": 120.0,
         "valor": round(area_cbuq_def * 120.0, 2)},
        
        {"codigo": "RAM-001", "servico": "Ramal predial", "un": "m",
         "qtd": round(ext, 2), "preco_unit": COMPOSICAO_METRO["ramal"],
         "valor": round(ext * COMPOSICAO_METRO["ramal"], 2)},
        
        {"codigo": "SIN-001", "servico": "Sinalização + segurança", "un": "m",
         "qtd": round(ext, 2), "preco_unit": COMPOSICAO_METRO["sinalizacao"],
         "valor": round(ext * COMPOSICAO_METRO["sinalizacao"], 2)},
    ]
    
    subtotal = sum(it["valor"] for it in itens)
    bdi_valor = subtotal * BDI
    total = subtotal + bdi_valor
    
    return {
        "ns": tr.get("pv_ini", "?") + "→" + tr.get("pv_fim", "?"),
        "dn_mm": dn, "ext_m": ext, "tipo": tipo,
        "prof_media_m": round(prof_med, 2),
        "itens": itens,
        "subtotal": round(subtotal, 2),
        "bdi_pct": BDI,
        "bdi_valor": round(bdi_valor, 2),
        "total": round(total, 2),
        "custo_por_metro": round(total / ext, 2) if ext > 0 else 0,
    }


def custo_nucleo(pvs, trechos, nucleo="", tabela=None):
    """Calcula custo total de um núcleo inteiro."""
    resultado = {
        "nucleo": nucleo,
        "n_trechos": len(trechos),
        "extensao_total": round(sum(t.get("ext_m", 0) for t in trechos), 1),
        "trechos": [],
        "resumo_servicos": {},
        "subtotal": 0, "bdi": 0, "total": 0,
    }
    
    for tr in trechos:
        c = custo_trecho(tr, pvs, tabela)
        resultado["trechos"].append(c)
        resultado["subtotal"] += c["subtotal"]
        resultado["bdi"] += c["bdi_valor"]
        resultado["total"] += c["total"]
        
        for item in c["itens"]:
            key = item["codigo"]
            if key not in resultado["resumo_servicos"]:
                resultado["resumo_servicos"][key] = {
                    "servico": item["servico"], "un": item["un"],
                    "qtd_total": 0, "valor_total": 0
                }
            resultado["resumo_servicos"][key]["qtd_total"] += item["qtd"]
            resultado["resumo_servicos"][key]["valor_total"] += item["valor"]
    
    resultado["subtotal"] = round(resultado["subtotal"], 2)
    resultado["bdi"] = round(resultado["bdi"], 2)
    resultado["total"] = round(resultado["total"], 2)
    resultado["custo_medio_metro"] = round(resultado["total"] / resultado["extensao_total"], 2) if resultado["extensao_total"] > 0 else 0
    
    return resultado


def gerar_bm(trechos_executados, pvs, periodo="", bm_num=1, tabela=None):
    """Gera Boletim de Medição a partir de trechos executados."""
    itens_bm = []
    total_bm = 0
    
    for tr in trechos_executados:
        c = custo_trecho(tr, pvs, tabela)
        for item in c["itens"]:
            itens_bm.append({
                "ns": c["ns"], "codigo": item["codigo"],
                "servico": item["servico"], "un": item["un"],
                "qtd": item["qtd"], "preco_unit": item["preco_unit"],
                "valor": item["valor"],
            })
        total_bm += c["total"]
    
    return {
        "bm_numero": bm_num,
        "periodo": periodo,
        "empresa": "FCN Construções e Saneamento",
        "contrato": "CT 11481051 — SLNR Santos",
        "n_trechos": len(trechos_executados),
        "extensao": round(sum(t.get("ext_m", 0) for t in trechos_executados), 1),
        "itens": itens_bm,
        "subtotal": round(total_bm / (1 + BDI), 2),
        "bdi": round(total_bm - total_bm / (1 + BDI), 2),
        "total": round(total_bm, 2),
    }


def importar_tabela_precos(path):
    """Importa tabela de preços de CSV ou JSON."""
    tabela = {}
    if path.endswith('.json'):
        with open(path) as f:
            data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    tabela[item.get("material", item.get("servico", ""))] = {
                        "tipo": item.get("tipo", ""),
                        "un": item.get("unidade", item.get("un", "")),
                        "preco": float(item.get("preco", item.get("preco_unit", 0))),
                    }
            elif isinstance(data, dict):
                tabela = data
    elif path.endswith('.csv'):
        import csv
        with open(path, encoding="utf-8-sig") as f:
            sep = ';' if ';' in f.readline() else ','
            f.seek(0)
            reader = csv.DictReader(f, delimiter=sep)
            for row in reader:
                nome = row.get("material", row.get("servico", row.get("MATERIAL", "")))
                if nome:
                    tabela[nome] = {
                        "tipo": row.get("tipo", row.get("TIPO", "")),
                        "un": row.get("unidade", row.get("UN", "")),
                        "preco": float(str(row.get("preco", row.get("PREÇO UNIT. (R$)", "0"))).replace(",", ".")),
                    }
    return tabela


if __name__ == "__main__":
    print("Motor de Custos — Preços do Contrato SLNR Santos")
    print(f"Materiais: {len(PRECOS_CONTRATO)}")
    print(f"Composição: R$ {sum(v for v in COMPOSICAO_METRO.values()):.0f}/m (s/ BDI)")
    print(f"BDI: {BDI*100:.0f}%")
    print(f"Total: R$ {sum(v for v in COMPOSICAO_METRO.values())*(1+BDI):.0f}/m (c/ BDI)")
