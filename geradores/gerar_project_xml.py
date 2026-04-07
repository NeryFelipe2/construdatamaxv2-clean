#!/usr/bin/env python3
"""
GERAR_PROJECT_XML.PY — Gerador de Cronograma MS Project (.xml)
Contrato 11481051 — SLNR Santos — SABESP

Gera cronograma de obra compatível com Microsoft Project 2016+
Estrutura WBS:
  1. MOBILIZAÇÃO
  2. TOPOGRAFIA E CADASTRO
  3. ESCAVAÇÃO / ESCORAMENTO
  4. ASSENTAMENTO DE REDE
  5. EXECUÇÃO DE PVs/PIs
  6. REATERRO E COMPACTAÇÃO
  7. REPOSIÇÃO DE PAVIMENTO
  8. LIGAÇÕES PREDIAIS
  9. TESTES E COMISSIONAMENTO
  10. CADASTRO AS-BUILT (NTS 292)
  11. BIM LOD 500 / NAVISWORKS
  12. DESMOBILIZAÇÃO

Produtividades baseadas em SINAPI SP Jan/2025 + experiência SABESP.

Autor: ConstruData - HydroNetwork — FCN Construções e Saneamento
"""

import math, json
from pathlib import Path
from datetime import datetime, timedelta
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString

# ══════════════════════════════════════════════════════════════
# PRODUTIVIDADES (metros/dia por equipe)
# ══════════════════════════════════════════════════════════════
PRODUTIVIDADES = {
    "topografia_m_dia": 200,        # levantamento topo
    "escavacao_m_dia": 30,          # escavação vala (Prof 1.0-2.5m)
    "assentamento_m_dia": 40,       # assentamento tubo PVC
    "pv_un_dia": 0.5,              # 1 PV a cada 2 dias
    "reaterro_m_dia": 50,           # reaterro + compactação
    "pavimento_m_dia": 60,          # reposição CBUQ
    "ligacao_un_dia": 3,            # ligações prediais
    "teste_m_dia": 200,             # teste estanqueidade
    "cadastro_folha_dia": 2,        # folhas de cadastro/dia
    "bim_trecho_dia": 10,           # trechos modelados/dia
}

# Equipes simultâneas
N_EQUIPES = 2


def _add_task(parent, uid, name, start, duration_days, outline_level=1,
              predecessors=None, notes="", wbs="", resources=""):
    """Adiciona tarefa ao XML do MS Project."""
    task = SubElement(parent, "Task")
    SubElement(task, "UID").text = str(uid)
    SubElement(task, "ID").text = str(uid)
    SubElement(task, "Name").text = name
    SubElement(task, "Type").text = "0"  # Fixed Units
    SubElement(task, "IsNull").text = "0"
    SubElement(task, "CreateDate").text = start.strftime("%Y-%m-%dT08:00:00")
    SubElement(task, "WBS").text = wbs or str(uid)
    SubElement(task, "OutlineNumber").text = wbs or str(uid)
    SubElement(task, "OutlineLevel").text = str(outline_level)
    SubElement(task, "Start").text = start.strftime("%Y-%m-%dT08:00:00")
    
    # Duração em horas (8h/dia)
    hours = max(1, int(duration_days * 8))
    SubElement(task, "Duration").text = f"PT{hours}H0M0S"
    SubElement(task, "DurationFormat").text = "7"  # Days
    
    finish = start + timedelta(days=max(1, int(duration_days)))
    SubElement(task, "Finish").text = finish.strftime("%Y-%m-%dT17:00:00")
    
    SubElement(task, "ManualStart").text = start.strftime("%Y-%m-%dT08:00:00")
    SubElement(task, "ManualFinish").text = finish.strftime("%Y-%m-%dT17:00:00")
    SubElement(task, "IsManual").text = "0"
    
    if notes:
        SubElement(task, "Notes").text = notes
    
    if predecessors:
        for pred_uid in predecessors:
            pred = SubElement(task, "PredecessorLink")
            SubElement(pred, "PredecessorUID").text = str(pred_uid)
            SubElement(pred, "Type").text = "1"  # Finish-to-Start
    
    return task, finish


def gerar_project_xml(pvs, trechos, nucleo, out_dir, data_inicio=None, info=None):
    """
    Gera cronograma MS Project XML.
    
    Args:
        pvs, trechos: dados da rede
        nucleo: nome do núcleo
        out_dir: diretório de saída
        data_inicio: datetime do início (default: hoje + 7 dias)
        info: dict com dados adicionais
    
    Returns:
        path do XML gerado
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    
    if data_inicio is None:
        data_inicio = datetime.now() + timedelta(days=7)
    
    ext_total = sum(t.get("ext_m", 0) for t in trechos)
    n_pvs = len(pvs)
    n_trechos = len(trechos)
    n_ligacoes = n_pvs  # estimativa: 1 ligação por PV (mínimo)
    n_folhas_cadastro = max(1, n_trechos // 5)
    
    # Calcular durações (dias úteis, com N_EQUIPES)
    dur = {
        "mobilizacao": 5,
        "topografia": math.ceil(ext_total / PRODUTIVIDADES["topografia_m_dia"] / N_EQUIPES),
        "escavacao": math.ceil(ext_total / PRODUTIVIDADES["escavacao_m_dia"] / N_EQUIPES),
        "assentamento": math.ceil(ext_total / PRODUTIVIDADES["assentamento_m_dia"] / N_EQUIPES),
        "pvs": math.ceil(n_pvs / PRODUTIVIDADES["pv_un_dia"] / N_EQUIPES),
        "reaterro": math.ceil(ext_total / PRODUTIVIDADES["reaterro_m_dia"] / N_EQUIPES),
        "pavimento": math.ceil(ext_total / PRODUTIVIDADES["pavimento_m_dia"] / N_EQUIPES),
        "ligacoes": math.ceil(n_ligacoes / PRODUTIVIDADES["ligacao_un_dia"] / N_EQUIPES),
        "testes": math.ceil(ext_total / PRODUTIVIDADES["teste_m_dia"]),
        "cadastro": math.ceil(n_folhas_cadastro / PRODUTIVIDADES["cadastro_folha_dia"]),
        "bim": math.ceil(n_trechos / PRODUTIVIDADES["bim_trecho_dia"]),
        "desmobilizacao": 3,
    }
    
    dur_total = sum(dur.values())
    
    # ── Construir XML ───────────────────────────────────────
    root = Element("Project")
    root.set("xmlns", "http://schemas.microsoft.com/project")
    
    SubElement(root, "Name").text = f"SLNR_Santos_{nucleo}"
    SubElement(root, "Title").text = f"SE LIGA NA REDE — {nucleo} — Santos/SP"
    SubElement(root, "Subject").text = "Cronograma de Obra — Contrato 11481051"
    SubElement(root, "Author").text = "ConstruData - HydroNetwork — FCN Construções e Saneamento"
    SubElement(root, "CreationDate").text = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    SubElement(root, "StartDate").text = data_inicio.strftime("%Y-%m-%dT08:00:00")
    SubElement(root, "FinishDate").text = (data_inicio + timedelta(days=dur_total)).strftime("%Y-%m-%dT17:00:00")
    SubElement(root, "CalendarUID").text = "1"
    SubElement(root, "MinutesPerDay").text = "480"
    SubElement(root, "MinutesPerWeek").text = "2400"
    SubElement(root, "DaysPerMonth").text = "22"
    
    # Calendar
    cals = SubElement(root, "Calendars")
    cal = SubElement(cals, "Calendar")
    SubElement(cal, "UID").text = "1"
    SubElement(cal, "Name").text = "Padrão"
    SubElement(cal, "IsBaseCalendar").text = "1"
    
    # Resources
    resources_el = SubElement(root, "Resources")
    res_names = [
        "Topógrafo", "Encanador", "Pedreiro PV", "Operador Escavadeira",
        "Motorista Caminhão", "Servente", "Engenheiro Civil", "Desenhista CAD",
        "Técnico BIM", "Fiscal SABESP"
    ]
    for i, rn in enumerate(res_names, 1):
        res = SubElement(resources_el, "Resource")
        SubElement(res, "UID").text = str(i)
        SubElement(res, "ID").text = str(i)
        SubElement(res, "Name").text = rn
        SubElement(res, "Type").text = "1"  # Work
    
    # Tasks
    tasks = SubElement(root, "Tasks")
    uid = 0
    current_date = data_inicio
    
    # Task 0: Project summary
    _add_task(tasks, uid, f"OBRA — {nucleo} — SLNR Santos",
              data_inicio, dur_total, outline_level=0,
              wbs="0",
              notes=f"Extensão: {ext_total:.0f}m | PVs: {n_pvs} | Trechos: {n_trechos}")
    uid += 1
    
    # Phases
    phases = [
        ("1. MOBILIZAÇÃO", dur["mobilizacao"], None,
         f"Canteiro, sinalização, licenças. {N_EQUIPES} equipes."),
        ("2. TOPOGRAFIA E CADASTRO PRÉVIO", dur["topografia"], [1],
         f"Levantamento topográfico georref. {ext_total:.0f}m. SIRGAS 2000 UTM 23S."),
        ("3. ESCAVAÇÃO E ESCORAMENTO", dur["escavacao"], [2],
         f"Vala aberta. {ext_total:.0f}m × prof média 1.5m. Solo tipo 1ª/2ª cat."),
        ("4. ASSENTAMENTO DE REDE", dur["assentamento"], [3],
         f"{n_trechos} trechos, {ext_total:.0f}m. DN 200-400 PVC NBR 7362."),
        ("5. EXECUÇÃO PVs / PIs", dur["pvs"], [3],
         f"{n_pvs} unidades. Concreto pré-moldado. NTS 044."),
        ("6. REATERRO E COMPACTAÇÃO", dur["reaterro"], [4, 5],
         f"{ext_total:.0f}m. Controle GC ≥ 95% Proctor Normal."),
        ("7. REPOSIÇÃO DE PAVIMENTO", dur["pavimento"], [6],
         f"CBUQ / Concreto / Bloquete. Conforme município Santos."),
        ("8. LIGAÇÕES PREDIAIS", dur["ligacoes"], [4],
         f"~{n_ligacoes} ligações. Selim PVC. NTS 217."),
        ("9. TESTES E COMISSIONAMENTO", dur["testes"], [6, 8],
         f"Estanqueidade, CFTV. {ext_total:.0f}m."),
        ("10. CADASTRO AS-BUILT (NTS 292)", dur["cadastro"], [9],
         f"{n_folhas_cadastro} folhas. DWG georref + PDF assinado. SIGNOS/VisualBIM."),
        ("11. BIM LOD 500 / NAVISWORKS", dur["bim"], [10],
         f"IFC 2x3. {n_trechos} pipes + {n_pvs} structures. Civil 3D + Navisworks."),
        ("12. DESMOBILIZAÇÃO", dur["desmobilizacao"], [11],
         "Limpeza, remoção canteiro, entrega definitiva."),
    ]
    
    prev_finish = data_inicio
    for name, duration, preds, notes in phases:
        pred_uids = preds if preds else ([uid - 1] if uid > 1 else None)
        _, finish = _add_task(tasks, uid, name, prev_finish, duration,
                              outline_level=1, predecessors=pred_uids, notes=notes,
                              wbs=name.split(".")[0].strip() if "." in name else str(uid))
        prev_finish = finish
        uid += 1
    
    # Subtarefas para Assentamento (por trecho, max 20 linhas)
    step = max(1, len(trechos) // 20)
    assentamento_uid = 4  # UID da tarefa "ASSENTAMENTO"
    sub_date = data_inicio + timedelta(days=dur["mobilizacao"] + dur["topografia"] + dur["escavacao"])
    
    for j in range(0, min(len(trechos), 20 * step), step):
        batch = trechos[j:j+step]
        ext_batch = sum(t.get("ext_m", 0) for t in batch)
        dur_batch = math.ceil(ext_batch / PRODUTIVIDADES["assentamento_m_dia"])
        
        pv_list = f"{batch[0]['pv_ini']}-{batch[-1]['pv_fim']}"
        _add_task(tasks, uid, f"Trecho {j+1}-{j+len(batch)}: {pv_list}",
                  sub_date, dur_batch, outline_level=2,
                  predecessors=[uid-1] if j > 0 else [assentamento_uid],
                  notes=f"{len(batch)} trechos, {ext_batch:.0f}m")
        sub_date += timedelta(days=dur_batch)
        uid += 1
    
    # Serializar
    xml_str = parseString(tostring(root, encoding="unicode")).toprettyxml(indent="  ")
    # Fix: remove extra declaration
    xml_str = xml_str.replace('<?xml version="1.0" ?>', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
    
    xml_path = out / f"CRONOGRAMA_{nucleo.upper().replace(' ','_')}.xml"
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(xml_str)
    
    # Resumo JSON
    resumo = {
        "nucleo": nucleo,
        "inicio": data_inicio.strftime("%Y-%m-%d"),
        "fim": prev_finish.strftime("%Y-%m-%d"),
        "duracao_dias_uteis": dur_total,
        "duracao_meses": round(dur_total / 22, 1),
        "extensao_m": round(ext_total, 1),
        "n_pvs": n_pvs,
        "n_trechos": n_trechos,
        "equipes": N_EQUIPES,
        "duracoes_por_fase": dur,
        "produtividades": PRODUTIVIDADES,
    }
    
    resumo_path = out / f"RESUMO_CRONOGRAMA_{nucleo.upper().replace(' ','_')}.json"
    with open(resumo_path, "w", encoding="utf-8") as f:
        json.dump(resumo, f, indent=2, ensure_ascii=False)
    
    print(f"[PROJECT] Cronograma: {xml_path}")
    print(f"          Duração: {dur_total} dias úteis ({dur_total/22:.1f} meses)")
    print(f"          Inicio: {data_inicio.strftime('%d/%m/%Y')} - Fim: {prev_finish.strftime('%d/%m/%Y')}")
    
    return [str(xml_path), str(resumo_path)]


if __name__ == "__main__":
    print("USO: from gerar_project_xml import gerar_project_xml")
    print("     gerar_project_xml(pvs, trechos, 'NUCLEO', './saida')")
