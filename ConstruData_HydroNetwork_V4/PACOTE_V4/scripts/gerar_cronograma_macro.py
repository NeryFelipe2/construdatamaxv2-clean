#!/usr/bin/env python3
"""
GERAR_CRONOGRAMA_MACRO.PY — Cronograma multinúcleo + Export Primavera P6 + OpenProject
ConstruData - HydroNetwork · CT 11481051 · FCN Construções e Saneamento

WBS:
  Contrato SLNR Santos
    ├── N01 Verde e Teteu (180 NS, 2621m)
    │     ├── Fase 1: Escavação
    │     ├── Fase 2: Assentamento
    │     ├── ...
    │     └── NS_001, NS_002, ...
    ├── N02 Pantanal Baixo
    ├── N03 São Manoel
    └── ...

Exports:
  1. MS Project XML (já existia — agora multinúcleo)
  2. Primavera P6 XER (novo)
  3. OpenProject CSV (novo)
"""

import json, math, os, csv
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom


# ══════════════════════════════════════════════════════════
# FASES PADRÃO POR NÚCLEO
# ══════════════════════════════════════════════════════════

FASES = [
    {"id": "TOP", "nome": "Topografia + Cadastro", "pct_ext": 1.0, "dias_fixo": 15, "predecessora": None},
    {"id": "PRJ", "nome": "Projeto + Planejamento", "pct_ext": 1.0, "dias_fixo": 10, "predecessora": "TOP"},
    {"id": "ESC", "nome": "Escavação",              "pct_ext": 1.0, "dias_por_100m": 4, "predecessora": "PRJ"},
    {"id": "ASS", "nome": "Assentamento Tubulação",  "pct_ext": 1.0, "dias_por_100m": 3, "predecessora": "ESC"},
    {"id": "PVS", "nome": "Montagem PVs/PIs",       "pct_ext": 0.3, "dias_por_100m": 2, "predecessora": "ASS"},
    {"id": "REA", "nome": "Reaterro + Compactação",  "pct_ext": 1.0, "dias_por_100m": 2, "predecessora": "PVS"},
    {"id": "TST", "nome": "Teste Estanqueidade",     "pct_ext": 1.0, "dias_fixo": 5,  "predecessora": "REA"},
    {"id": "LAV", "nome": "Lavagem + Coliformes",    "pct_ext": 1.0, "dias_fixo": 7,  "predecessora": "TST"},
    {"id": "PAV", "nome": "Pavimentação CBUQ",       "pct_ext": 1.0, "dias_por_100m": 2, "predecessora": "REA"},
    {"id": "CAD", "nome": "Cadastro NTS 292",        "pct_ext": 1.0, "dias_fixo": 10, "predecessora": "TST"},
    {"id": "LIG", "nome": "Ligações Prediais",       "pct_ext": 1.0, "dias_por_100m": 3, "predecessora": "LAV"},
    {"id": "MED", "nome": "Medição + BM",            "pct_ext": 1.0, "dias_fixo": 5,  "predecessora": "CAD"},
]


def _dias_uteis(data_inicio, n_dias):
    """Calcula data fim pulando fins de semana."""
    dt = data_inicio
    dias = 0
    while dias < n_dias:
        dt += timedelta(days=1)
        if dt.weekday() < 5:
            dias += 1
    return dt


def gerar_cronograma_nucleo(nucleo_nome, extensao_m, n_trechos, data_inicio, equipes=2):
    """Gera cronograma de 1 núcleo com todas as fases."""
    tarefas = []
    dt_atual = data_inicio
    fase_datas = {}
    
    for fase in FASES:
        # Duração
        if "dias_fixo" in fase:
            duracao = fase["dias_fixo"]
        else:
            duracao = max(1, int(math.ceil(extensao_m / 100 * fase["dias_por_100m"] / equipes)))
        
        # Início: depende da predecessora
        pred = fase["predecessora"]
        if pred and pred in fase_datas:
            inicio = fase_datas[pred]["fim"]
        else:
            inicio = dt_atual
        
        fim = _dias_uteis(inicio, duracao)
        fase_datas[fase["id"]] = {"inicio": inicio, "fim": fim}
        
        tarefas.append({
            "id": fase["id"],
            "nome": fase["nome"],
            "inicio": inicio.strftime("%Y-%m-%d"),
            "fim": fim.strftime("%Y-%m-%d"),
            "duracao_dias": duracao,
            "predecessora": pred,
            "nucleo": nucleo_nome,
        })
    
    return tarefas


def gerar_cronograma_macro(nucleos, data_inicio_str="2026-04-01"):
    """
    Gera cronograma macro de TODOS os núcleos.
    
    Args:
        nucleos: [{nome, extensao_m, n_trechos, equipes}]
        data_inicio_str: data início do contrato
    
    Returns:
        WBS completo com todas as tarefas
    """
    data_base = datetime.strptime(data_inicio_str, "%Y-%m-%d")
    wbs = {
        "projeto": "SLNR Santos — CT 11481051",
        "empresa": "FCN Construções e Saneamento",
        "data_inicio": data_inicio_str,
        "nucleos": [],
        "total_tarefas": 0,
    }
    
    dt_atual = data_base
    task_id = 1
    
    for nuc in nucleos:
        nome = nuc["nome"]
        ext = nuc.get("extensao_m", 0)
        n_tr = nuc.get("n_trechos", 0)
        eq = nuc.get("equipes", 2)
        
        tarefas = gerar_cronograma_nucleo(nome, ext, n_tr, dt_atual, eq)
        
        # Calcular datas do núcleo
        inicio_nuc = min(t["inicio"] for t in tarefas)
        fim_nuc = max(t["fim"] for t in tarefas)
        duracao_nuc = (datetime.strptime(fim_nuc, "%Y-%m-%d") - datetime.strptime(inicio_nuc, "%Y-%m-%d")).days
        
        nucleo_wbs = {
            "nome": nome,
            "extensao_m": ext,
            "n_trechos": n_tr,
            "equipes": eq,
            "inicio": inicio_nuc,
            "fim": fim_nuc,
            "duracao_dias": duracao_nuc,
            "fases": tarefas,
        }
        
        wbs["nucleos"].append(nucleo_wbs)
        wbs["total_tarefas"] += len(tarefas)
        
        # Próximo núcleo começa 2 semanas depois (overlap parcial)
        dt_atual = _dias_uteis(datetime.strptime(inicio_nuc, "%Y-%m-%d"), 10)
    
    # Datas globais
    if wbs["nucleos"]:
        wbs["data_fim"] = max(n["fim"] for n in wbs["nucleos"])
        wbs["duracao_total_dias"] = (datetime.strptime(wbs["data_fim"], "%Y-%m-%d") - data_base).days
    
    return wbs


# ══════════════════════════════════════════════════════════
# EXPORT MS PROJECT XML
# ══════════════════════════════════════════════════════════

def exportar_project_xml(wbs, path):
    """Exporta cronograma macro para MS Project XML."""
    NS = "http://schemas.microsoft.com/project"
    
    proj = Element("Project", xmlns=NS)
    SubElement(proj, "Name").text = wbs["projeto"]
    SubElement(proj, "StartDate").text = wbs["data_inicio"] + "T08:00:00"
    SubElement(proj, "CalendarUID").text = "1"
    
    # Calendar
    cals = SubElement(proj, "Calendars")
    cal = SubElement(cals, "Calendar")
    SubElement(cal, "UID").text = "1"
    SubElement(cal, "Name").text = "Padrão"
    SubElement(cal, "IsBaseCalendar").text = "1"
    
    tasks = SubElement(proj, "Tasks")
    uid = 0
    
    # Task 0: projeto
    t0 = SubElement(tasks, "Task")
    SubElement(t0, "UID").text = str(uid)
    SubElement(t0, "ID").text = str(uid)
    SubElement(t0, "Name").text = wbs["projeto"]
    SubElement(t0, "OutlineLevel").text = "0"
    SubElement(t0, "Start").text = wbs["data_inicio"] + "T08:00:00"
    SubElement(t0, "Summary").text = "1"
    uid += 1
    
    for nuc in wbs["nucleos"]:
        # Núcleo (nível 1)
        tn = SubElement(tasks, "Task")
        SubElement(tn, "UID").text = str(uid)
        SubElement(tn, "ID").text = str(uid)
        SubElement(tn, "Name").text = f"{nuc['nome']} ({nuc['extensao_m']:.0f}m)"
        SubElement(tn, "OutlineLevel").text = "1"
        SubElement(tn, "Start").text = nuc["inicio"] + "T08:00:00"
        SubElement(tn, "Finish").text = nuc["fim"] + "T17:00:00"
        SubElement(tn, "Summary").text = "1"
        nuc_uid = uid
        uid += 1
        
        pred_map = {}
        for fase in nuc["fases"]:
            tf = SubElement(tasks, "Task")
            SubElement(tf, "UID").text = str(uid)
            SubElement(tf, "ID").text = str(uid)
            SubElement(tf, "Name").text = fase["nome"]
            SubElement(tf, "OutlineLevel").text = "2"
            SubElement(tf, "Start").text = fase["inicio"] + "T08:00:00"
            SubElement(tf, "Finish").text = fase["fim"] + "T17:00:00"
            dur_hours = fase["duracao_dias"] * 8
            SubElement(tf, "Duration").text = f"PT{dur_hours}H0M0S"
            SubElement(tf, "Summary").text = "0"
            
            if fase["predecessora"] and fase["predecessora"] in pred_map:
                pl = SubElement(tf, "PredecessorLink")
                SubElement(pl, "PredecessorUID").text = str(pred_map[fase["predecessora"]])
                SubElement(pl, "Type").text = "1"
            
            pred_map[fase["id"]] = uid
            uid += 1
    
    xml_str = minidom.parseString(tostring(proj, encoding="unicode")).toprettyxml(indent="  ")
    with open(path, "w", encoding="utf-8") as f:
        f.write(xml_str)
    
    return path


# ══════════════════════════════════════════════════════════
# EXPORT PRIMAVERA P6 XER
# ══════════════════════════════════════════════════════════

def exportar_primavera_xer(wbs, path):
    """
    Exporta cronograma para formato Primavera P6 XER.
    XER é um formato tabular (tipo CSV com tabs) usado pelo Oracle Primavera.
    """
    lines = []
    lines.append("ERMHDR\t13.0")
    lines.append(f"--- Generated by ConstruData - HydroNetwork | {datetime.now().isoformat()}")
    
    # PROJECT table
    lines.append("%T\tPROJECT")
    lines.append("%F\tproj_id\tproj_short_name\tplan_start_date\tplan_end_date")
    lines.append(f"%R\t1\tSLNR\t{wbs['data_inicio']}\t{wbs.get('data_fim', wbs['data_inicio'])}")
    
    # CALENDAR table
    lines.append("%T\tCALENDAR")
    lines.append("%F\tclndr_id\tclndr_name\tdefault_flag")
    lines.append("%R\t1\tPadrão 5d/sem\tY")
    
    # WBS table
    lines.append("%T\tPROJWBS")
    lines.append("%F\twbs_id\twbs_short_name\twbs_name\tparent_wbs_id\tproj_id")
    lines.append(f"%R\t1\tSLNR\t{wbs['projeto']}\t\t1")
    
    wbs_id = 2
    wbs_map = {}
    for nuc in wbs["nucleos"]:
        lines.append(f"%R\t{wbs_id}\t{nuc['nome'][:10]}\t{nuc['nome']}\t1\t1")
        wbs_map[nuc["nome"]] = wbs_id
        wbs_id += 1
    
    # TASK (ACTIVITY) table
    lines.append("%T\tTASK")
    lines.append("%F\ttask_id\ttask_code\ttask_name\twbs_id\tproj_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type")
    
    task_id = 1
    for nuc in wbs["nucleos"]:
        nuc_wbs = wbs_map.get(nuc["nome"], 1)
        for fase in nuc["fases"]:
            code = f"{nuc['nome'][:3].upper()}_{fase['id']}"
            dur_h = fase["duracao_dias"] * 8
            lines.append(f"%R\t{task_id}\t{code}\t{fase['nome']}\t{nuc_wbs}\t1\t{fase['inicio']}\t{fase['fim']}\t{dur_h}\tTT_Task")
            task_id += 1
    
    # TASKPRED table
    lines.append("%T\tTASKPRED")
    lines.append("%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type")
    
    pred_id = 1
    task_id_map = {}
    tid = 1
    for nuc in wbs["nucleos"]:
        for fase in nuc["fases"]:
            code = f"{nuc['nome'][:3].upper()}_{fase['id']}"
            task_id_map[f"{nuc['nome']}_{fase['id']}"] = tid
            
            if fase["predecessora"]:
                pred_key = f"{nuc['nome']}_{fase['predecessora']}"
                if pred_key in task_id_map:
                    lines.append(f"%R\t{pred_id}\t{tid}\t{task_id_map[pred_key]}\tPR_FS")
                    pred_id += 1
            tid += 1
    
    lines.append("%E")
    
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    
    return path


# ══════════════════════════════════════════════════════════
# EXPORT OPENPROJECT CSV
# ══════════════════════════════════════════════════════════

def exportar_openproject_csv(wbs, path):
    """Exporta cronograma para OpenProject (CSV com WBS)."""
    rows = []
    
    # Header OpenProject
    rows.append({
        "Subject": wbs["projeto"],
        "Type": "Phase",
        "Status": "New",
        "Start date": wbs["data_inicio"],
        "Finish date": wbs.get("data_fim", ""),
        "Parent": "",
        "Estimated time": "",
    })
    
    for nuc in wbs["nucleos"]:
        # Núcleo como fase
        rows.append({
            "Subject": nuc["nome"],
            "Type": "Phase",
            "Status": "New",
            "Start date": nuc["inicio"],
            "Finish date": nuc["fim"],
            "Parent": wbs["projeto"],
            "Estimated time": f"{nuc['duracao_dias'] * 8}h",
        })
        
        for fase in nuc["fases"]:
            rows.append({
                "Subject": fase["nome"],
                "Type": "Task",
                "Status": "New",
                "Start date": fase["inicio"],
                "Finish date": fase["fim"],
                "Parent": nuc["nome"],
                "Estimated time": f"{fase['duracao_dias'] * 8}h",
            })
    
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
    
    return path


def gerar_tudo(nucleos, data_inicio="2026-04-01", out_dir="."):
    """Gera cronograma macro + exporta para os 3 formatos."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    
    wbs = gerar_cronograma_macro(nucleos, data_inicio)
    
    paths = []
    
    # MS Project
    p1 = str(out / "CRONOGRAMA_MACRO_SLNR.xml")
    exportar_project_xml(wbs, p1)
    paths.append(p1)
    
    # Primavera P6
    p2 = str(out / "CRONOGRAMA_MACRO_SLNR.xer")
    exportar_primavera_xer(wbs, p2)
    paths.append(p2)
    
    # OpenProject
    p3 = str(out / "CRONOGRAMA_MACRO_SLNR.csv")
    exportar_openproject_csv(wbs, p3)
    paths.append(p3)
    
    # JSON
    p4 = str(out / "CRONOGRAMA_MACRO_SLNR.json")
    with open(p4, "w", encoding="utf-8") as f:
        json.dump(wbs, f, indent=2, ensure_ascii=False)
    paths.append(p4)
    
    return wbs, paths


if __name__ == "__main__":
    # Dados reais dos núcleos SLNR Santos
    nucleos = [
        {"nome": "Verde e Teteu",   "extensao_m": 2621,  "n_trechos": 180, "equipes": 3},
        {"nome": "São Manoel",      "extensao_m": 1275,  "n_trechos": 16,  "equipes": 2},
        {"nome": "Vila Israel",     "extensao_m": 11509, "n_trechos": 861, "equipes": 3},
        {"nome": "Pantanal Baixo",  "extensao_m": 6720,  "n_trechos": 189, "equipes": 3},
        {"nome": "Vila Criadores",  "extensao_m": 4138,  "n_trechos": 130, "equipes": 2},
        {"nome": "João Carlos",     "extensao_m": 3000,  "n_trechos": 100, "equipes": 2},
    ]
    
    wbs, paths = gerar_tudo(nucleos, "2026-04-01", "/home/claude/CRONO_MACRO")
    
    print("═" * 60)
    print("  CRONOGRAMA MACRO — SLNR Santos")
    print("═" * 60)
    print(f"\n  {len(wbs['nucleos'])} núcleos | {wbs['total_tarefas']} tarefas")
    print(f"  Início: {wbs['data_inicio']} | Fim: {wbs.get('data_fim','?')} | {wbs.get('duracao_total_dias',0)} dias")
    
    for nuc in wbs["nucleos"]:
        print(f"\n  {nuc['nome']:20s} | {nuc['extensao_m']:>6.0f}m | {nuc['duracao_dias']:3d}d | {nuc['inicio']} → {nuc['fim']}")
    
    print(f"\n  Exportado:")
    for p in paths:
        print(f"    {os.path.basename(p)} ({os.path.getsize(p)/1024:.0f}KB)")
