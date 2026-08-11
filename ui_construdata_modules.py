"""Shell ConstruData offline para o NOVA NS V5.

Aba unica estilo frontend: sidebar, projeto ativo, cards e modulos operaveis.
A plataforma nasce de projeto e banco local, nao de Nota de Servico.
"""

from __future__ import annotations

from datetime import date, timedelta
import io
import math
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk
from typing import Any

from core.construdata_offline import (
    build_project_report,
    create_contact,
    create_entity,
    create_project,
    dashboard_counts,
    export_project_report,
    get_project,
    list_contacts,
    list_entity,
    list_projects,
    offline_health,
    project_snapshot,
    set_entity_status,
)

NAV_SECTIONS = [
    ("Gestao", [("Gestao 360", "gestao_360"), ("Evolucao 360", "evolucao_360"), ("Torre Controle", "torre"), ("Projetos", "projetos")]),
    ("Engenharia", [("Motor NS V5", "ns_v5"), ("Mapa / GIS", "mapa_gis"), ("BIM 3D/4D/5D", "bim"), ("Rede 360", "rede_360"), ("Pre-Construcao", "pre_construcao")]),
    ("Planejamento", [("Planejamento", "planejamento"), ("Plan. Mestre", "planejamento_mestre"), ("Agenda", "agenda"), ("LPS / Lean", "lps"), ("EVM / Curva S", "evm")]),
    ("Financeiro", [("DRE & Resultado", "dre")]),
    ("Operacao de Campo", [("RDO", "rdo"), ("RDOs WhatsApp", "rdo_whatsapp_live"), ("Relatorio 360", "relatorio_360"), ("Punch List", "punch_list")]),
    ("Recursos", [("Suprimentos", "suprimentos"), ("Mao de Obra", "mao_obra"), ("Equipamentos", "equipamentos"), ("Quantitativos", "quantitativos")]),
    ("IA & Inteligencia", [("Engine V5", "engine_v5"), ("IA & Analytics", "ia_analytics"), ("Agente Chat", "agent_chat"), ("Leitor PDF", "leitor_pdf")]),
    ("Comunicacao", [("Contatos", "contatos"), ("Fluxo Oper.", "fluxo_operacional"), ("WhatsApp RDO", "whatsapp_rdo")]),
]

ENTITY_PAGES = {
    "tarefas": {"title": "Tarefas", "entity": "tarefas", "columns": ("ID", "Status", "Prioridade", "Responsavel", "Titulo", "Prazo"), "fields": [("titulo", "Titulo", "Nova tarefa"), ("responsavel", "Responsavel", "Felipe Nery"), ("prioridade", "Prioridade", "NORMAL"), ("setor", "Setor", "Planejamento"), ("prazo", "Prazo", date.today().isoformat())], "done": "CONCLUIDA"},
    "lps": {"title": "LPS / Restricoes", "entity": "lps", "columns": ("ID", "Status", "Prioridade", "Responsavel", "Titulo", "Data Alvo"), "fields": [("titulo", "Restricao", "Liberacao de frente"), ("responsavel", "Responsavel", "Planejamento"), ("prioridade", "Prioridade", "NORMAL"), ("data_alvo", "Data alvo", date.today().isoformat())], "done": "RESOLVIDA"},
    "suprimentos": {"title": "Suprimentos", "entity": "suprimentos", "columns": ("ID", "Status", "Item", "Qtd", "Un", "Fornecedor", "Custo"), "fields": [("item", "Item", "Tubo PEAD"), ("categoria", "Categoria", "Material"), ("quantidade", "Qtd", "1"), ("unidade", "Un", "un"), ("fornecedor", "Fornecedor", ""), ("custo_previsto", "Custo", "0")], "done": "COMPRADO"},
    "mao_obra": {"title": "Mao de Obra", "entity": "mao_obra", "columns": ("ID", "Status", "Nome", "Funcao", "Qtd", "Custo Dia"), "fields": [("nome", "Nome/Equipe", "Equipe campo"), ("funcao", "Funcao", "Ajudante"), ("quantidade", "Qtd", "1"), ("custo_dia", "Custo dia", "0")], "done": "INATIVO"},
    "equipamentos": {"title": "Equipamentos", "entity": "equipamentos", "columns": ("ID", "Status", "Nome", "Tipo", "Locadora", "Custo Dia"), "fields": [("nome", "Nome", "Retroescavadeira"), ("tipo", "Tipo", "Maquina"), ("locadora", "Locadora", ""), ("custo_dia", "Custo dia", "0")], "done": "DEVOLVIDO"},
    "custos": {"title": "Custos / DRE", "entity": "custos", "columns": ("ID", "Data", "Categoria", "Descricao", "Valor", "Origem"), "fields": [("data", "Data", date.today().isoformat()), ("categoria", "Categoria", "Direto"), ("descricao", "Descricao", "Custo do dia"), ("valor", "Valor", "0")], "done": "LANCADO"},
    "agenda": {"title": "Agenda", "entity": "agenda", "columns": ("ID", "Data", "Status", "Responsavel", "Titulo"), "fields": [("data", "Data", date.today().isoformat()), ("titulo", "Titulo", "Reuniao de obra"), ("responsavel", "Responsavel", "Felipe Nery")], "done": "CONCLUIDO"},
    "punch": {"title": "Punch List", "entity": "punch", "columns": ("ID", "Status", "Prioridade", "Responsavel", "Titulo"), "fields": [("titulo", "Pendencia", "Corrigir item"), ("responsavel", "Responsavel", "Campo"), ("prioridade", "Prioridade", "NORMAL")], "done": "FECHADO"},
    "whatsapp": {"title": "WhatsApp Logs", "entity": "whatsapp", "columns": ("ID", "Criado", "Direcao", "Telefone", "Status", "Mensagem"), "fields": [("telefone", "Telefone", ""), ("direcao", "Direcao", "out"), ("mensagem", "Mensagem", "Mensagem registrada offline"), ("status", "Status", "REGISTRADO")], "done": "ENVIADO"},
}
KEY_TO_ENTITY = {"planejamento_mestre": "tarefas", "agenda": "agenda", "lps": "lps", "suprimentos": "suprimentos", "mao_obra": "mao_obra", "equipamentos": "equipamentos", "dre": "custos", "punch_list": "punch", "whatsapp_rdo": "whatsapp", "rdo_whatsapp_live": "whatsapp", "fluxo_operacional": "tarefas"}
RAIL_ACTIONS = [("◆", "gestao_360"), ("☰", "torre"), ("⚙", "engine_v5"), ("⌂", "projetos"), ("◉", "mapa_gis"), ("⇄", "evolucao_360"), ("?", "relatorio_360")]
PROJECT_COORDS = {
    "RK_SUB": (-23.9608, -46.3336),
    "SLNR": (-23.9608, -46.3336),
    "OSASCO": (-23.5329, -46.7918),
    "TATUI": (-23.3550, -47.8560),
    "PARDINHO": (-23.0800, -48.3730),
    "BRASILIA": (-15.7939, -47.8828),
}


def _colors() -> dict[str, str]:
    return {"root": "#05080b", "sidebar": "#0d284f", "sidebar2": "#0f315f", "panel": "#05080b", "card": "#353535", "ink": "#f7fbff", "muted": "#8b94a6", "line": "#50545c", "blue": "#006dff", "accent": "#00c26f", "warn": "#ff6b00", "danger": "#e51b2b", "white": "#ffffff", "soft": "#142f58", "nav": "#071426"}


def _enum(value: Any) -> Any: return getattr(value, "value", value)


def _week_defaults() -> tuple[str, str]:
    today = date.today(); start = today - timedelta(days=today.weekday())
    return start.isoformat(), (start + timedelta(days=6)).isoformat()


def _to_float(value, default=0.0):
    try: return float(str(value or "").replace(",", "."))
    except Exception: return default


def _to_int(value, default=0):
    try: return int(float(str(value or "").replace(",", ".")))
    except Exception: return default


def _split_items(value: str) -> list[str]:
    text = str(value or "").replace("\n", ";")
    return [part.strip() for part in text.split(";") if part.strip()]


def _qty_and_label(value: str) -> tuple[int, str]:
    text = str(value or "").strip()
    if not text:
        return 0, ""
    parts = text.split(maxsplit=1)
    if parts and parts[0].replace(",", ".").replace(".", "", 1).isdigit():
        return max(_to_int(parts[0], 1), 1), parts[1] if len(parts) > 1 else "Equipe"
    return 1, text


def _allocated(total: float, count: int) -> float:
    return round((total or 0) / count, 2) if count else 0.0


def _mirror_rdo_details(project, rdo_id: int, payload: dict[str, str]) -> None:
    data_ref = payload.get("data") or date.today().isoformat()
    mao_obra = _split_items(payload.get("mao_obra"))
    maquinas = _split_items(payload.get("maquinas"))
    equipamentos = _split_items(payload.get("equipamentos"))
    locacoes = _split_items(payload.get("locacoes"))
    materiais = _split_items(payload.get("materiais"))
    ocorrencias = _split_items(payload.get("ocorrencias"))
    paralisacoes = _split_items(payload.get("paralisacoes"))
    custo_mo = _to_float(payload.get("custo_mao_obra"))
    custo_eq = _to_float(payload.get("custo_equipamentos"))
    custo_loc = _to_float(payload.get("custo_locacoes"))
    custo_mat = _to_float(payload.get("custo_materiais"))
    custo_dir = _to_float(payload.get("custos_diretos"))
    custo_ind = _to_float(payload.get("custos_indiretos"))
    custo_total = _to_float(payload.get("custo_total")) or sum([custo_mo, custo_eq, custo_loc, custo_mat, custo_dir, custo_ind])

    for item in mao_obra:
        qtd, funcao = _qty_and_label(item)
        create_entity("mao_obra", project.id, {"nome": f"RDO #{rdo_id} - {funcao}", "funcao": funcao, "quantidade": qtd, "custo_dia": _allocated(custo_mo, len(mao_obra))})
    for item in maquinas:
        create_entity("equipamentos", project.id, {"nome": item, "tipo": "Maquina", "locadora": "", "custo_dia": _allocated(custo_eq, len(maquinas))})
    for item in equipamentos:
        create_entity("equipamentos", project.id, {"nome": item, "tipo": "Equipamento", "locadora": "", "custo_dia": _allocated(custo_eq, len(equipamentos))})
    for item in locacoes:
        create_entity("equipamentos", project.id, {"nome": item, "tipo": "Locacao", "locadora": item, "custo_dia": _allocated(custo_loc, len(locacoes))})
    for item in materiais:
        create_entity("suprimentos", project.id, {"item": item, "categoria": "Material RDO", "quantidade": 1, "unidade": "un", "fornecedor": "", "custo_previsto": _allocated(custo_mat, len(materiais))})
    for category, value in [("Mao de obra", custo_mo), ("Equipamentos", custo_eq), ("Locacoes", custo_loc), ("Materiais", custo_mat), ("Direto", custo_dir), ("Indireto", custo_ind), ("Total RDO", custo_total)]:
        if value:
            create_entity("custos", project.id, {"data": data_ref, "categoria": category, "descricao": f"RDO #{rdo_id} - {category}", "valor": value})
    for item in ocorrencias:
        create_entity("lps", project.id, {"titulo": f"Ocorrencia RDO #{rdo_id}: {item}", "responsavel": payload.get("responsavel") or project.responsavel, "prioridade": "NORMAL", "data_alvo": data_ref})
    for item in paralisacoes:
        create_entity("lps", project.id, {"titulo": f"Paralisacao RDO #{rdo_id}: {item}", "responsavel": payload.get("responsavel") or project.responsavel, "prioridade": "ALTA", "data_alvo": data_ref})
    local = ", ".join(part for part in [payload.get("lat"), payload.get("lon")] if part)
    create_entity("whatsapp", project.id, {
        "telefone": "",
        "direcao": "in",
        "mensagem": f"RDO #{rdo_id} registrado offline. Foto: {payload.get('foto') or '-'} | Local: {local or '-'}",
        "status": "RECEBIDO",
    })


def _legacy_snapshot(project) -> dict[str, Any]:
    from core.construdata_offline import nucleos_do_projeto
    from core.database import criar_banco, get_session
    from core.models import DesvioPlanejamento, MLExecucao, NS, OperationalLog, PlanejamentoSemanal, RDO, Replanejamento
    from sqlalchemy.orm import selectinload
    criar_banco()
    with get_session() as session:
        nucleos = nucleos_do_projeto(project)
        ns = session.query(NS).filter(NS.nucleo.in_(nucleos)).order_by(NS.id.desc()).limit(80).all()
        rdos = session.query(RDO).options(selectinload(RDO.equipe), selectinload(RDO.ocorrencias), selectinload(RDO.fotos), selectinload(RDO.apontamentos)).filter(RDO.nucleo.in_(nucleos)).order_by(RDO.data.desc(), RDO.id.desc()).limit(80).all()
        planos = session.query(PlanejamentoSemanal).options(selectinload(PlanejamentoSemanal.itens)).filter(PlanejamentoSemanal.nucleo.in_(nucleos)).order_by(PlanejamentoSemanal.criado_em.desc()).limit(30).all()
        desvios = session.query(DesvioPlanejamento).join(PlanejamentoSemanal).filter(PlanejamentoSemanal.nucleo.in_(nucleos)).order_by(DesvioPlanejamento.criado_em.desc()).limit(40).all()
        replans = session.query(Replanejamento).filter(Replanejamento.nucleo.in_(nucleos)).order_by(Replanejamento.criado_em.desc()).limit(20).all()
        logs = session.query(OperationalLog).filter(OperationalLog.nucleo.in_(nucleos)).order_by(OperationalLog.criado_em.desc()).limit(30).all()
        ml = session.query(MLExecucao).filter(MLExecucao.nucleo.in_(nucleos)).order_by(MLExecucao.criado_em.desc()).limit(10).all()
        ppc_vals = [d.ppc for d in desvios if d.ppc is not None]
        return {"ns": ns, "rdos": rdos, "planos": planos, "desvios": desvios, "replans": replans, "logs": logs, "ml": ml, "ppc": round(sum(ppc_vals) / len(ppc_vals), 1) if ppc_vals else 0, "custo_rdo": round(sum((r.total_custo or 0) for r in rdos), 2)}


def _create_weekly_plan(project, payload: dict[str, str]) -> int:
    from core.database import criar_banco, get_session
    from core.models import PlanejamentoItem, PlanejamentoSemanal, StatusPlanejamento
    criar_banco()
    with get_session() as session:
        plan = PlanejamentoSemanal(nucleo=project.nucleo, semana_inicio=date.fromisoformat(payload["semana_inicio"]), semana_fim=date.fromisoformat(payload["semana_fim"]), engenheiro=payload.get("engenheiro") or project.responsavel, responsavel=payload.get("responsavel") or payload.get("engenheiro") or project.responsavel, status=StatusPlanejamento.RASCUNHO, observacao=payload.get("observacao") or "Criado no GUI offline")
        session.add(plan); session.flush()
        session.add(PlanejamentoItem(planejamento_id=plan.id, atividade=payload.get("atividade") or "Atividade planejada", meta_quantidade=_to_float(payload.get("meta_quantidade")), unidade=payload.get("unidade") or "m", equipe_prevista=_to_int(payload.get("equipe_prevista")), custo_previsto=_to_float(payload.get("custo_previsto")), data_inicio=date.fromisoformat(payload["semana_inicio"]), data_fim=date.fromisoformat(payload["semana_fim"]), restricoes=payload.get("restricoes") or "[]"))
        session.flush(); return int(plan.id)


def _validate_latest_plan(project, diretor: str, aprovado: bool = True) -> int:
    from core.database import criar_banco, get_session
    from core.models import PlanejamentoSemanal, PlanejamentoValidacao, StatusPlanejamento
    criar_banco()
    with get_session() as session:
        plan = session.query(PlanejamentoSemanal).filter(PlanejamentoSemanal.nucleo == project.nucleo).order_by(PlanejamentoSemanal.criado_em.desc()).first()
        if not plan: raise ValueError("Nenhum planejamento encontrado")
        session.add(PlanejamentoValidacao(planejamento_id=plan.id, aprovado=aprovado, diretor=diretor or "Diretoria", observacao="Validado no GUI offline" if aprovado else "Rejeitado no GUI offline"))
        if aprovado:
            for old in session.query(PlanejamentoSemanal).filter(PlanejamentoSemanal.nucleo == project.nucleo, PlanejamentoSemanal.status == StatusPlanejamento.ATIVO, PlanejamentoSemanal.id != plan.id).all(): old.status = StatusPlanejamento.SUBSTITUIDO
            plan.status = StatusPlanejamento.ATIVO
        else: plan.status = StatusPlanejamento.ENCERRADO
        session.flush(); return int(plan.id)


def _create_rdo_from_gui(project, payload: dict[str, str]) -> tuple[int, int]:
    from api.operational import gerar_desvios_rdo
    from campo.rdo_engine import RDOEngine
    from core.database import criar_banco, get_session
    criar_banco()
    engine = RDOEngine()
    equipe = []
    for item in _split_items(payload.get("mao_obra")):
        qtd, funcao = _qty_and_label(item)
        if qtd and funcao:
            equipe.append({"funcao": funcao, "qtd": qtd})
    ocorrencias = [{"tipo": "outro", "descricao": item} for item in _split_items(payload.get("ocorrencias"))]
    paralisacoes = [{"tipo": "paralisacao", "descricao": item} for item in _split_items(payload.get("paralisacoes"))]
    foto_path = payload.get("foto") or ""
    fotos = []
    if foto_path:
        fotos.append({"caminho": foto_path, "legenda": payload.get("foto_legenda") or "Foto RDO", "lat": payload.get("lat") or 0, "lon": payload.get("lon") or 0})
    custo_total = _to_float(payload.get("custo_total")) or sum(_to_float(payload.get(key)) for key in ("custo_mao_obra", "custo_equipamentos", "custo_locacoes", "custo_materiais", "custos_diretos", "custos_indiretos"))
    obs = "\n".join(part for part in [
        payload.get("observacoes") or "RDO criado no GUI offline",
        f"Maquinas: {payload.get('maquinas') or '-'}",
        f"Equipamentos: {payload.get('equipamentos') or '-'}",
        f"Locacoes: {payload.get('locacoes') or '-'}",
        f"Materiais: {payload.get('materiais') or '-'}",
        f"Localizacao: {payload.get('lat') or '-'}, {payload.get('lon') or '-'}",
    ] if part)
    rdo = engine.criar_rdo_completo({
        "data": payload.get("data") or date.today().isoformat(),
        "nucleo": project.nucleo,
        "responsavel": payload.get("responsavel") or project.responsavel or "Campo",
        "clima": {"manha": payload.get("clima") or "Bom", "tarde": payload.get("clima") or "Bom"},
        "observacoes": obs,
        "equipe": equipe,
        "ocorrencias": ocorrencias,
        "paralisacoes": paralisacoes,
        "fotos": fotos,
        "servicos": {"manual": [{
            "ns_id": "manual",
            "servico": payload.get("servico") or "Atividade executada",
            "quantidade": _to_float(payload.get("quantidade")),
            "unidade": payload.get("unidade") or "m",
            "dn_mm": _to_int(payload.get("dn_mm")),
            "custo_total": custo_total,
        }]},
    })
    rdo_id = int(rdo["id"])
    _mirror_rdo_details(project, rdo_id, payload)
    with get_session() as session:
        desvios = gerar_desvios_rdo(session, rdo_id, project.nucleo, date.fromisoformat(payload.get("data") or date.today().isoformat()))
        return rdo_id, len(desvios)


def _run_ml_for_project(project) -> dict[str, Any]:
    from api.operational import tentar_xgboost
    from core.database import criar_banco, get_session
    criar_banco()
    with get_session() as session:
        result = tentar_xgboost(session, project.nucleo); session.commit(); return result


class ConstruDataWorkspace:
    def __init__(self, app, tab: tk.Frame):
        self.app = app; self.tab = tab; self.c = _colors(); self.current_key = "gestao_360"; self.buttons = {}; self.content = None
        projects = list_projects(); self.project_names = [p.nome for p in projects]
        preferred = next((p.nome for p in projects if p.nucleo == "RK_SUB"), None) or next((p.nome for p in projects if p.nucleo == "TATUI"), None)
        self.project_var = tk.StringVar(value=preferred or (self.project_names[0] if self.project_names else "")); self.project_cb = None
        self._build(); self.render("gestao_360")

    def _build(self):
        self.tab.configure(bg=self.c["root"])
        try:
            style = ttk.Style()
            style.configure("Treeview", background=self.c["card"], fieldbackground=self.c["card"], foreground=self.c["ink"], rowheight=28, borderwidth=0)
            style.configure("Treeview.Heading", background=self.c["soft"], foreground=self.c["ink"], font=("Segoe UI", 9, "bold"))
        except Exception:
            pass
        rail = tk.Frame(self.tab, bg=self.c["sidebar"], width=48); rail.pack(side=tk.LEFT, fill=tk.Y); rail.pack_propagate(False)
        for icon, key in RAIL_ACTIONS:
            tk.Button(
                rail,
                text=icon,
                command=lambda k=key: self.render(k),
                bg=self.c["sidebar"],
                fg=self.c["white"],
                activebackground=self.c["blue"],
                activeforeground=self.c["white"],
                relief=tk.FLAT,
                bd=0,
                cursor="hand2",
                font=("Segoe UI", 14, "bold"),
            ).pack(fill=tk.X, pady=7)
        main = tk.Frame(self.tab, bg=self.c["panel"]); main.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        top = tk.Frame(main, bg=self.c["nav"], height=48); top.pack(fill=tk.X); top.pack_propagate(False)
        tk.Label(top, text="ConstruData", bg=self.c["nav"], fg=self.c["white"], font=("Segoe UI", 15, "bold")).pack(side=tk.LEFT, padx=(14, 18))
        for label, key in [("Branding", "gestao_360"), ("Campanhas", "planejamento"), ("Projetos", "projetos"), ("Tarefas", "torre"), ("RDO", "rdo"), ("Evolucao", "evolucao_360"), ("Data-Driven", "evm")]:
            tk.Button(top, text=label, command=lambda k=key: self.render(k), bg=self.c["nav"], fg=self.c["white"], activebackground=self.c["sidebar2"], activeforeground=self.c["white"], relief=tk.FLAT, bd=0, padx=10, font=("Segoe UI", 9)).pack(side=tk.LEFT, fill=tk.Y)
        tk.Button(top, text="+", command=lambda: self.render("rdo"), bg="#4b7cff", fg=self.c["white"], relief=tk.FLAT, width=3, font=("Segoe UI", 12, "bold")).pack(side=tk.RIGHT, padx=10, pady=8)
        filters = tk.Frame(main, bg=self.c["white"], height=42, highlightbackground=self.c["line"], highlightthickness=1); filters.pack(fill=tk.X); filters.pack_propagate(False)
        tk.Label(filters, text="▦", bg=self.c["white"], fg=self.c["blue"], font=("Segoe UI", 13, "bold")).pack(side=tk.LEFT, padx=(12, 4))
        cb = ttk.Combobox(filters, textvariable=self.project_var, values=self.project_names, state="readonly", width=28); cb.pack(side=tk.LEFT, padx=8, pady=7); cb.bind("<<ComboboxSelected>>", lambda _e: self.render(self.current_key)); self.project_cb = cb
        for text in ("Todos executores", "Todos relacionados", "Todos squads", "Todas etapas"):
            tk.Label(filters, text=text + "  ▾", bg=self.c["white"], fg=self.c["muted"], font=("Segoe UI", 8)).pack(side=tk.LEFT, padx=12)
        tk.Button(filters, text="Atualizar", command=lambda: self.render(self.current_key), bg=self.c["soft"], fg=self.c["blue"], relief=tk.FLAT, font=("Segoe UI", 8, "bold")).pack(side=tk.RIGHT, padx=12, pady=7)
        shell = tk.Frame(main, bg=self.c["panel"]); shell.pack(fill=tk.BOTH, expand=True)
        side = tk.Frame(shell, bg=self.c["sidebar2"], width=220); side.pack(side=tk.LEFT, fill=tk.Y); side.pack_propagate(False)
        tk.Label(side, text="Workspace", bg=self.c["sidebar2"], fg="#b9d5ff", font=("Segoe UI", 8, "bold")).pack(anchor=tk.W, padx=12, pady=(14, 0))
        tk.Label(side, text="ConstruData 360", bg=self.c["sidebar2"], fg=self.c["white"], font=("Segoe UI", 12, "bold")).pack(anchor=tk.W, padx=12, pady=(0, 10))
        nav = tk.Frame(side, bg=self.c["sidebar2"]); nav.pack(fill=tk.BOTH, expand=True, padx=8)
        for section, items in NAV_SECTIONS:
            tk.Label(nav, text=section.upper(), bg=self.c["sidebar2"], fg="#9bbef8", font=("Segoe UI", 7, "bold")).pack(anchor=tk.W, padx=8, pady=(8, 2))
            for label, key in items:
                btn = tk.Button(nav, text="  " + label, anchor=tk.W, relief=tk.FLAT, bd=0, padx=10, pady=5, bg=self.c["sidebar2"], fg="#eaf2ff", activebackground=self.c["blue"], activeforeground=self.c["white"], font=("Segoe UI", 8), command=lambda k=key: self.render(k)); btn.pack(fill=tk.X, pady=1); self.buttons[key] = btn
        self.content = tk.Frame(shell, bg=self.c["panel"]); self.content.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=18, pady=14)

    def _project(self): return get_project(name=self.project_var.get())
    def _clear(self):
        for child in self.content.winfo_children(): child.destroy()
        for key, btn in self.buttons.items(): btn.configure(bg=self.c["blue"] if key == self.current_key else self.c["sidebar2"], fg=self.c["white"] if key == self.current_key else "#eaf2ff")
    def _button(self, parent, text, command, color=None): return tk.Button(parent, text=text, command=command, bg=color or self.c["blue"], fg=self.c["white"], relief=tk.FLAT, padx=12, pady=6, font=("Segoe UI", 9, "bold"))
    def _entry(self, parent, label, default="", width=18):
        box = tk.Frame(parent, bg=self.c["card"]); box.pack(side=tk.LEFT, padx=5, pady=5); tk.Label(box, text=label, bg=self.c["card"], fg=self.c["muted"], font=("Segoe UI", 8, "bold")).pack(anchor=tk.W); var = tk.StringVar(value=str(default)); tk.Entry(box, textvariable=var, width=width, relief=tk.FLAT, highlightthickness=1, highlightbackground=self.c["line"]).pack(anchor=tk.W); return var
    def _card(self, parent, title, value, subtitle="", color=None):
        frame = tk.Frame(parent, bg=self.c["card"], highlightbackground=self.c["line"], highlightthickness=1, padx=16, pady=12); frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=6)
        tk.Label(frame, text=title.upper(), bg=self.c["card"], fg=self.c["muted"], font=("Segoe UI", 8, "bold")).pack(anchor=tk.W)
        tk.Label(frame, text=str(value), bg=self.c["card"], fg=color or self.c["ink"], font=("Segoe UI", 22, "bold")).pack(anchor=tk.W)
        tk.Label(frame, text=subtitle, bg=self.c["card"], fg=self.c["muted"], font=("Segoe UI", 8)).pack(anchor=tk.W)
        return frame
    def _table(self, parent, columns, rows, height=11):
        frame = tk.Frame(parent, bg=self.c["card"], highlightbackground=self.c["line"], highlightthickness=1); frame.pack(fill=tk.BOTH, expand=True, pady=(12, 0)); tree = ttk.Treeview(frame, columns=columns, show="headings", height=height)
        for col in columns: tree.heading(col, text=col); tree.column(col, width=max(90, int(900 / max(len(columns), 1))), anchor=tk.W)
        for row in rows: tree.insert("", tk.END, values=row)
        y = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=tree.yview); tree.configure(yscrollcommand=y.set); tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True); y.pack(side=tk.RIGHT, fill=tk.Y); return tree
    def _details(self, parent, text):
        box = scrolledtext.ScrolledText(parent, bg=self.c["card"], fg=self.c["ink"], insertbackground=self.c["ink"], font=("Consolas", 9), relief=tk.FLAT, wrap=tk.WORD, height=20); box.pack(fill=tk.BOTH, expand=True, pady=(12, 0)); box.insert(tk.END, text); return box

    def render(self, key):
        self.current_key = key; self._clear(); project = self._project(); legacy = _legacy_snapshot(project); counts = dashboard_counts(project.id)
        title = next((label for _s, items in NAV_SECTIONS for label, k in items if k == key), "ConstruData")
        head = tk.Frame(self.content, bg=self.c["panel"]); head.pack(fill=tk.X)
        tk.Label(head, text=title, bg=self.c["panel"], fg=self.c["ink"], font=("Segoe UI", 18, "bold")).pack(side=tk.LEFT)
        tk.Label(head, text="Atualizado agora ha pouco", bg=self.c["soft"], fg=self.c["blue"], font=("Segoe UI", 8, "bold"), padx=10, pady=4).pack(side=tk.LEFT, padx=12)
        tk.Label(self.content, text=f"{project.nome} | {project.tipo} | {project.cidade}", bg=self.c["panel"], fg=self.c["muted"], font=("Segoe UI", 9)).pack(anchor=tk.W, pady=(2, 12))
        if key == "torre":
            self._render_torre(project, legacy)
            return
        cards = tk.Frame(self.content, bg=self.c["panel"]); cards.pack(fill=tk.X)
        custo_extra = sum((r.valor or 0) for r in list_entity("custos", project.id))
        self._card(cards, "RDOs", len(legacy["rdos"]), "Campo", self.c["blue"]); self._card(cards, "Planos", len(legacy["planos"]), "Semanal", self.c["accent"]); self._card(cards, "Tarefas", counts.get("tarefas", 0), "Operacao", self.c["warn"]); self._card(cards, "Custo", f"R$ {round(legacy['custo_rdo'] + custo_extra, 2)}", "RDO + DRE", self.c["ink"])
        if key == "projetos": self._render_projects(project)
        elif key in ("planejamento",): self._render_planning(project)
        elif key == "rdo": self._render_rdo(project)
        elif key == "torre": self._render_torre(project, legacy)
        elif key == "gestao_360": self._render_gestao(project, legacy, counts)
        elif key == "evolucao_360": self._render_evolucao(project)
        elif key == "contatos": self._render_contacts(project)
        elif key == "relatorio_360": self._render_relatorio(project)
        elif key in KEY_TO_ENTITY: self._render_entity(project, ENTITY_PAGES[KEY_TO_ENTITY[key]])
        elif key == "evm": self._render_evm(legacy)
        else: self._render_engine_page(key, project, legacy)

    def _render_projects(self, project):
        form = tk.Frame(self.content, bg=self.c["card"], padx=12, pady=10, highlightbackground=self.c["line"], highlightthickness=1)
        form.pack(fill=tk.X, pady=(8, 0))
        fields = {
            "nome": self._entry(form, "Projeto", "Novo Projeto", 18),
            "nucleo": self._entry(form, "Nucleo", "NOVO", 9),
            "cidade": self._entry(form, "Cidade", "", 14),
            "tipo": self._entry(form, "Tipo", "Obra", 12),
            "responsavel": self._entry(form, "Responsavel", "Felipe Nery", 16),
        }
        actions = tk.Frame(self.content, bg=self.c["panel"])
        actions.pack(fill=tk.X, pady=10)
        def add_project():
            try:
                project_id = create_project({key: var.get() for key, var in fields.items()})
                self.project_names = [p.nome for p in list_projects()]
                if self.project_cb: self.project_cb.configure(values=self.project_names)
                selected = get_project(project_id=project_id)
                self.project_var.set(selected.nome)
                self.render("projetos")
            except Exception as exc:
                messagebox.showerror("Projetos", str(exc))
        self._button(actions, "Criar projeto offline", add_project, self.c["accent"]).pack(side=tk.LEFT)
        rows = [p.to_row() for p in list_projects()]
        tree = self._table(self.content, ("ID", "Projeto", "Tipo", "Cidade", "Nucleo", "Responsavel"), rows, 8)
        def select(_e=None):
            item = tree.focus(); values = tree.item(item, "values") if item else None
            if values: self.project_var.set(values[1]); self.render("gestao_360")
        tree.bind("<Double-1>", select); self._button(self.content, "Abrir projeto selecionado", select, self.c["accent"]).pack(anchor=tk.W, pady=10)

    def _render_entity(self, project, cfg):
        form = tk.Frame(self.content, bg=self.c["card"], padx=12, pady=10, highlightbackground=self.c["line"], highlightthickness=1); form.pack(fill=tk.X, pady=(8, 0)); vars = {}
        for key, label, default in cfg["fields"]: vars[key] = self._entry(form, label, default, 18)
        actions = tk.Frame(self.content, bg=self.c["panel"]); actions.pack(fill=tk.X, pady=10)
        def create():
            try: create_entity(cfg["entity"], project.id, {k: v.get() for k, v in vars.items()}); self.render(self.current_key)
            except Exception as exc: messagebox.showerror(cfg["title"], str(exc))
        self._button(actions, f"Adicionar {cfg['title']}", create, self.c["blue"]).pack(side=tk.LEFT, padx=(0, 6))
        rows = [row.to_row() for row in list_entity(cfg["entity"], project.id)]
        tree = self._table(self.content, cfg["columns"], rows, 12)
        def done():
            item = tree.focus(); values = tree.item(item, "values") if item else None
            if not values: return
            try: set_entity_status(cfg["entity"], int(values[0]), cfg.get("done", "CONCLUIDO")); self.render(self.current_key)
            except Exception as exc: messagebox.showerror(cfg["title"], str(exc))
        self._button(actions, "Marcar status final", done, self.c["accent"]).pack(side=tk.LEFT)

    def _render_planning(self, project):
        start, end = _week_defaults(); form = tk.Frame(self.content, bg=self.c["card"], padx=12, pady=10, highlightbackground=self.c["line"], highlightthickness=1); form.pack(fill=tk.X, pady=(8, 0))
        fields = {"semana_inicio": self._entry(form, "Inicio", start, 11), "semana_fim": self._entry(form, "Fim", end, 11), "engenheiro": self._entry(form, "Engenheiro", project.responsavel or "", 18), "atividade": self._entry(form, "Atividade", "Assentamento / producao", 26), "meta_quantidade": self._entry(form, "Meta", "10", 8), "unidade": self._entry(form, "Un", "m", 5), "equipe_prevista": self._entry(form, "Equipe", "4", 8), "custo_previsto": self._entry(form, "Custo", "1000", 10)}
        actions = tk.Frame(self.content, bg=self.c["panel"]); actions.pack(fill=tk.X, pady=10)
        def create():
            try: pid = _create_weekly_plan(project, {k: v.get() for k, v in fields.items()}); messagebox.showinfo("Planejamento", f"Plano #{pid} criado"); self.render(self.current_key)
            except Exception as exc: messagebox.showerror("Planejamento", str(exc))
        def approve():
            try: pid = _validate_latest_plan(project, "Felipe Nery", True); messagebox.showinfo("Planejamento", f"Plano #{pid} ativado"); self.render(self.current_key)
            except Exception as exc: messagebox.showerror("Planejamento", str(exc))
        self._button(actions, "Criar planejamento", create).pack(side=tk.LEFT, padx=(0, 6)); self._button(actions, "Diretor validar ultimo", approve, self.c["accent"]).pack(side=tk.LEFT)
        legacy = _legacy_snapshot(project); rows = [(p.id, _enum(p.status), p.semana_inicio, p.semana_fim, p.responsavel or "-", len(p.itens or [])) for p in legacy["planos"]]
        self._table(self.content, ("ID", "Status", "Inicio", "Fim", "Responsavel", "Itens"), rows, 10)

    def _render_rdo(self, project):
        form = tk.Frame(self.content, bg=self.c["card"], padx=12, pady=10, highlightbackground=self.c["line"], highlightthickness=1); form.pack(fill=tk.X, pady=(8, 0))
        fields = {
            "data": self._entry(form, "Data", date.today().isoformat(), 11),
            "responsavel": self._entry(form, "Responsavel", project.responsavel or "", 18),
            "servico": self._entry(form, "Producao/Servico", "Assentamento / producao", 24),
            "quantidade": self._entry(form, "Qtd", "4", 7),
            "unidade": self._entry(form, "Un", "m", 5),
            "clima": self._entry(form, "Clima", "Bom", 8),
        }
        form2 = tk.Frame(self.content, bg=self.c["card"], padx=12, pady=10, highlightbackground=self.c["line"], highlightthickness=1); form2.pack(fill=tk.X, pady=(8, 0))
        fields.update({
            "mao_obra": self._entry(form2, "Mao de obra (;)", "2 ajudantes;1 operador", 24),
            "maquinas": self._entry(form2, "Maquinas (;)", "Retroescavadeira", 20),
            "equipamentos": self._entry(form2, "Equipamentos (;)", "", 20),
            "locacoes": self._entry(form2, "Locacoes (;)", "", 18),
            "materiais": self._entry(form2, "Materiais (;)", "Tubo PEAD", 20),
        })
        form3 = tk.Frame(self.content, bg=self.c["card"], padx=12, pady=10, highlightbackground=self.c["line"], highlightthickness=1); form3.pack(fill=tk.X, pady=(8, 0))
        fields.update({
            "custo_mao_obra": self._entry(form3, "Custo MO", "0", 9),
            "custo_equipamentos": self._entry(form3, "Custo Equip", "0", 9),
            "custo_locacoes": self._entry(form3, "Custo Loc", "0", 9),
            "custo_materiais": self._entry(form3, "Custo Mat", "0", 9),
            "custos_diretos": self._entry(form3, "Diretos", "0", 9),
            "custos_indiretos": self._entry(form3, "Indiretos", "0", 9),
            "custo_total": self._entry(form3, "Total Dia", "0", 9),
        })
        form4 = tk.Frame(self.content, bg=self.c["card"], padx=12, pady=10, highlightbackground=self.c["line"], highlightthickness=1); form4.pack(fill=tk.X, pady=(8, 0))
        fields.update({
            "ocorrencias": self._entry(form4, "Ocorrencias (;)", "", 24),
            "paralisacoes": self._entry(form4, "Paralisacoes (;)", "", 24),
            "foto": self._entry(form4, "Foto/caminho", "", 24),
            "foto_legenda": self._entry(form4, "Legenda", "Foto RDO", 14),
            "lat": self._entry(form4, "Lat", "", 10),
            "lon": self._entry(form4, "Lon", "", 10),
            "observacoes": self._entry(form4, "Obs", "", 20),
        })
        def choose_photo():
            path = filedialog.askopenfilename(title="Selecionar foto RDO", filetypes=[("Imagens", "*.jpg *.jpeg *.png *.webp"), ("Todos", "*.*")])
            if path: fields["foto"].set(path)
        self._button(form4, "Escolher foto", choose_photo, self.c["blue"]).pack(side=tk.LEFT, padx=5, pady=18)
        actions = tk.Frame(self.content, bg=self.c["panel"]); actions.pack(fill=tk.X, pady=10)
        def create():
            try: rid, desvios = _create_rdo_from_gui(project, {k: v.get() for k, v in fields.items()}); messagebox.showinfo("RDO", f"RDO #{rid} criado. Desvios: {desvios}"); self.render(self.current_key)
            except Exception as exc: messagebox.showerror("RDO", str(exc))
        def ml():
            try: result = _run_ml_for_project(project); messagebox.showinfo("ML", f"ok={result.get('ok')} tipo={result.get('tipo')}"); self.render(self.current_key)
            except Exception as exc: messagebox.showerror("ML", str(exc))
        self._button(actions, "Criar RDO", create).pack(side=tk.LEFT, padx=(0, 6)); self._button(actions, "Recalcular ML", ml, self.c["accent"]).pack(side=tk.LEFT)
        legacy = _legacy_snapshot(project); rows = [(r.id, r.data, _enum(r.status), r.responsavel or "-", r.total_custo or 0, len(r.equipe or []), len(r.ocorrencias or []), len(r.fotos or [])) for r in legacy["rdos"]]
        tree = self._table(self.content, ("ID", "Data", "Status", "Responsavel", "Custo", "Equipe", "Ocorr.", "Fotos"), rows, 10)
        ops = tk.Frame(self.content, bg=self.c["panel"]); ops.pack(fill=tk.X, pady=8)
        detail_area = tk.Frame(self.content, bg=self.c["panel"]); detail_area.pack(fill=tk.BOTH, expand=True)
        def selected_rdo_id():
            item = tree.focus()
            values = tree.item(item, "values") if item else None
            if not values:
                messagebox.showwarning("RDO", "Selecione um RDO na tabela.")
                return None
            return int(values[0])
        def show_detail():
            try:
                from campo.rdo_engine import RDOEngine
                rdo_id = selected_rdo_id()
                if not rdo_id: return
                for child in detail_area.winfo_children(): child.destroy()
                self._details(detail_area, RDOEngine().detalhe_markdown(rdo_id))
            except Exception as exc: messagebox.showerror("RDO", str(exc))
        def export_md():
            try:
                from campo.rdo_engine import RDOEngine
                rdo_id = selected_rdo_id()
                if not rdo_id: return
                path = RDOEngine().exportar_markdown(rdo_id)
                messagebox.showinfo("RDO", f"Markdown gerado:\n{path}")
            except Exception as exc: messagebox.showerror("RDO", str(exc))
        def close_rdo():
            try:
                from campo.rdo_engine import RDOEngine
                rdo_id = selected_rdo_id()
                if not rdo_id: return
                result = RDOEngine().fechar_rdo(rdo_id)
                messagebox.showinfo("RDO", f"RDO fechado.\nPDF: {result.get('pdf_path') or 'indisponivel'}")
                self.render(self.current_key)
            except Exception as exc: messagebox.showerror("RDO", str(exc))
        self._button(ops, "Ver detalhe RDO", show_detail, self.c["blue"]).pack(side=tk.LEFT, padx=(0, 6))
        self._button(ops, "Exportar Markdown", export_md, self.c["accent"]).pack(side=tk.LEFT, padx=(0, 6))
        self._button(ops, "Fechar/Gerar PDF", close_rdo).pack(side=tk.LEFT)

    def _render_contacts(self, project):
        form = tk.Frame(self.content, bg=self.c["card"], padx=12, pady=10, highlightbackground=self.c["line"], highlightthickness=1)
        form.pack(fill=tk.X, pady=(8, 0))
        fields = {
            "nome": self._entry(form, "Nome", "Novo contato", 18),
            "telefone": self._entry(form, "Telefone", "", 14),
            "papel": self._entry(form, "Papel", "Campo", 12),
            "alcada": self._entry(form, "Alcada", "Operacao", 12),
            "setor": self._entry(form, "Setor", "Producao", 12),
        }
        actions = tk.Frame(self.content, bg=self.c["panel"])
        actions.pack(fill=tk.X, pady=10)
        def add_contact():
            try:
                payload = {key: var.get() for key, var in fields.items()}
                payload["projetos"] = project.nome
                payload["projeto_id"] = project.id
                create_contact(payload)
                self.render("contatos")
            except Exception as exc:
                messagebox.showerror("Contatos", str(exc))
        self._button(actions, "Adicionar contato", add_contact, self.c["accent"]).pack(side=tk.LEFT)
        self._table(self.content, ("ID", "Nome", "Telefone", "Papel", "Alcada", "Setor"), [c.to_row() for c in list_contacts()], 14)

    def _project_coord(self, project):
        return PROJECT_COORDS.get(str(project.nucleo or "").upper(), (-23.9608, -46.3336))

    def _draw_control_map(self, canvas, project, legacy):
        canvas.update_idletasks()
        w = max(canvas.winfo_width(), 760)
        h = max(canvas.winfo_height(), 420)
        canvas.delete("all")
        canvas.create_rectangle(0, 0, w, h, fill="#f5efe2", outline="")
        for i in range(-80, w + 120, 78):
            canvas.create_line(i, 0, i + 220, h, fill="#d7c5a8", width=3)
            canvas.create_line(i + 18, 0, i + 238, h, fill="#fff8ea", width=1)
        for y in range(35, h, 72):
            canvas.create_line(0, y, w, y + 25, fill="#d7c5a8", width=3)
            canvas.create_line(0, y + 14, w, y + 39, fill="#fff8ea", width=1)
        for x in range(30, w, 150):
            canvas.create_rectangle(x, 55, x + 70, 105, fill="#e8dcc8", outline="#d5c5ac")
            canvas.create_rectangle(x + 20, 185, x + 105, 245, fill="#e8dcc8", outline="#d5c5ac")
            canvas.create_rectangle(x - 12, 330, x + 58, 385, fill="#e8dcc8", outline="#d5c5ac")
        canvas.create_line(0, h * .22, w, h * .10, fill="#b9d4e5", width=18, smooth=True)
        canvas.create_line(0, h * .22, w, h * .10, fill="#8fc1df", width=9, smooth=True)
        canvas.create_line(w * .12, h * .78, w * .88, h * .34, fill="#ff7a1a", width=4, dash=(7, 6))
        cx, cy = int(w * .52), int(h * .55)
        canvas.create_oval(cx - 90, cy - 90, cx + 90, cy + 90, outline="#ff7a1a", width=2, dash=(5, 5))
        canvas.create_oval(cx - 20, cy - 20, cx + 20, cy + 20, fill="#ff7a1a", outline="#ffffff", width=3)
        canvas.create_text(cx, cy, text="⌂", fill="white", font=("Segoe UI", 18, "bold"))
        canvas.create_rectangle(cx - 70, cy + 30, cx + 95, cy + 54, fill="#111927", outline="#ff7a1a")
        canvas.create_text(cx + 12, cy + 42, text=f"{project.nome[:24]}", fill="#ffffff", font=("Segoe UI", 9, "bold"))
        for idx, rdo in enumerate(legacy["rdos"][:8]):
            px = 90 + (idx % 4) * 145
            py = 95 + (idx // 4) * 90
            color = "#00c26f" if idx < 3 else "#006dff"
            canvas.create_oval(px - 8, py - 8, px + 8, py + 8, fill=color, outline="#ffffff", width=2)
            canvas.create_text(px + 42, py - 12, text=f"RDO #{getattr(rdo, 'numero', rdo.id)}", fill="#102030", font=("Segoe UI", 8, "bold"))
        lat, lon = self._project_coord(project)
        canvas.create_text(12, h - 18, anchor=tk.W, text=f"Cartografia operacional | {project.cidade or '-'} | {lat:.5f}, {lon:.5f}", fill="#3b4b60", font=("Segoe UI", 8))

    def _render_torre(self, project, legacy):
        board = tk.Frame(self.content, bg=self.c["panel"]); board.pack(fill=tk.BOTH, expand=True, pady=(12, 0))
        left = tk.Frame(board, bg=self.c["panel"]); left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        right = tk.Frame(board, bg=self.c["card"], width=310, highlightbackground=self.c["line"], highlightthickness=1, padx=10, pady=10); right.pack(side=tk.RIGHT, fill=tk.Y, padx=(12, 0)); right.pack_propagate(False)

        metrics = tk.Frame(left, bg=self.c["panel"]); metrics.pack(fill=tk.X)
        tarefas = list_entity("tarefas", project.id)
        self._card(metrics, "RDOs", len(legacy["rdos"]), "Campo", self.c["blue"])
        self._card(metrics, "Frentes", len(legacy["ns"]), "NS / trechos", self.c["accent"])
        self._card(metrics, "Desvios", len([d for d in legacy["desvios"] if str(_enum(getattr(d, "severidade", ""))) in ("ALTA", "CRITICA")]), "ALTA/CRITICA", self.c["danger"])
        self._card(metrics, "Tarefas", len(tarefas), "Operacao", self.c["warn"])

        map_frame = tk.Frame(left, bg=self.c["card"], highlightbackground=self.c["line"], highlightthickness=1)
        map_frame.pack(fill=tk.BOTH, expand=True, pady=(12, 0))
        header = tk.Frame(map_frame, bg="#101a29", height=34); header.pack(fill=tk.X); header.pack_propagate(False)
        tk.Label(header, text="Mapa / Torre Controle", bg="#101a29", fg=self.c["ink"], font=("Segoe UI", 10, "bold")).pack(side=tk.LEFT, padx=10)
        tk.Label(header, text=project.nucleo, bg="#12375d", fg=self.c["white"], font=("Segoe UI", 8, "bold"), padx=8, pady=3).pack(side=tk.LEFT, padx=6, pady=6)
        map_canvas = tk.Canvas(map_frame, bg="#f5efe2", highlightthickness=0)
        map_canvas.pack(fill=tk.BOTH, expand=True)
        map_canvas.bind("<Configure>", lambda _e: self._draw_control_map(map_canvas, project, legacy))

        actions = tk.Frame(left, bg=self.c["panel"]); actions.pack(fill=tk.X, pady=8)
        self._button(actions, "Atualizar mapa", lambda: self._draw_control_map(map_canvas, project, legacy), self.c["blue"]).pack(side=tk.LEFT, padx=(0, 6))
        self._button(actions, "Abrir RDO", lambda: self.render("rdo"), self.c["accent"]).pack(side=tk.LEFT, padx=(0, 6))
        self._button(actions, "Ver Evolucao 360", lambda: self.render("evolucao_360"), self.c["warn"]).pack(side=tk.LEFT)

        tk.Label(right, text="Obra selecionada", bg=self.c["card"], fg=self.c["ink"], font=("Segoe UI", 11, "bold")).pack(anchor=tk.W)
        tk.Label(right, text=f"{project.nome}\n{project.cidade or '-'}\nGerente: {project.responsavel or '-'}", bg=self.c["card"], fg=self.c["muted"], font=("Segoe UI", 8), justify=tk.LEFT).pack(anchor=tk.W, pady=(3, 12))
        tk.Label(right, text="Notificacoes", bg=self.c["card"], fg=self.c["ink"], font=("Segoe UI", 11, "bold")).pack(anchor=tk.W)
        notices = []
        for r in legacy["rdos"][:8]:
            notices.append(f"RDO #{getattr(r, 'numero', r.id)} atualizado em {getattr(r, 'data', '')}")
        for d in legacy["desvios"][:5]:
            notices.append(f"Desvio {getattr(d, 'severidade', '')}: {getattr(d, 'atividade', '')[:42]}")
        if not notices:
            notices = ["Nenhum alerta pendente neste projeto."]
        for notice in notices[:10]:
            box = tk.Frame(right, bg="#fff7df", highlightbackground="#ffe29a", highlightthickness=1, padx=8, pady=6); box.pack(fill=tk.X, pady=5)
            tk.Label(box, text="⚠ " + notice, bg="#fff7df", fg="#735100", font=("Segoe UI", 8), wraplength=260, justify=tk.LEFT).pack(anchor=tk.W)

    def _tile_xy(self, lat: float, lon: float, zoom: int) -> tuple[float, float]:
        lat_rad = math.radians(lat)
        scale = 2 ** zoom
        x = (lon + 180.0) / 360.0 * scale
        y = (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * scale
        return x, y

    def _fetch_tile_image(self, zoom: int, x: int, y: int):
        cache = Path(__file__).resolve().parent / ".cache_osm" / str(zoom) / str(x)
        cache.mkdir(parents=True, exist_ok=True)
        path = cache / f"{y}.png"
        try:
            from PIL import Image
            if path.exists():
                return Image.open(path).convert("RGB")
            if not getattr(self, "_tile_online", True):
                return None
            import requests
            url = f"https://tile.openstreetmap.org/{zoom}/{x}/{y}.png"
            resp = requests.get(url, headers={"User-Agent": "ConstruData-NOVA-NS-V5/1.0"}, timeout=4)
            resp.raise_for_status()
            path.write_bytes(resp.content)
            return Image.open(io.BytesIO(resp.content)).convert("RGB")
        except Exception:
            self._tile_online = False
            return None

    def _draw_map_overlay(self, canvas, project, legacy, w: int, h: int):
        cx, cy = int(w * .52), int(h * .55)
        canvas.create_oval(cx - 135, cy - 135, cx + 135, cy + 135, outline="#ff6b00", width=2, dash=(6, 5))
        canvas.create_oval(cx - 23, cy - 23, cx + 23, cy + 23, fill="#ff6b00", outline="#ffffff", width=4)
        canvas.create_oval(cx - 10, cy - 10, cx + 10, cy + 10, fill="#ff9b45", outline="")
        canvas.create_rectangle(cx - 85, cy + 32, cx + 110, cy + 58, fill="#161616", outline="#ff6b00")
        canvas.create_text(cx + 12, cy + 45, text=project.nome[:26], fill="#ffffff", font=("Segoe UI", 9, "bold"))
        for idx, rdo in enumerate(legacy["rdos"][:12]):
            angle = math.radians(idx * 31)
            radius = 68 + (idx % 3) * 28
            px = cx + int(math.cos(angle) * radius)
            py = cy + int(math.sin(angle) * radius)
            canvas.create_oval(px - 7, py - 7, px + 7, py + 7, fill="#00c26f", outline="#ffffff", width=2)
            if idx < 5:
                canvas.create_text(px + 36, py - 10, text=f"RDO {getattr(rdo, 'numero', rdo.id)}", fill="#111927", font=("Segoe UI", 8, "bold"))
        lat, lon = self._project_coord(project)
        canvas.create_rectangle(10, h - 34, 342, h - 8, fill="#ffffff", outline="#c7c7c7")
        canvas.create_text(18, h - 21, anchor=tk.W, text=f"OpenStreetMap/cartografia | {lat:.5f}, {lon:.5f}", fill="#293241", font=("Segoe UI", 8))
        canvas.create_rectangle(w - 92, 12, w - 18, 74, fill="#333333", outline="#222222")
        canvas.create_text(w - 55, 33, text="Camadas", fill="#ffffff", font=("Segoe UI", 8, "bold"))
        canvas.create_text(w - 55, 56, text="OSM", fill="#b9d5ff", font=("Segoe UI", 8, "bold"))

    def _draw_fallback_map(self, canvas, project, legacy):
        w = max(canvas.winfo_width(), 760); h = max(canvas.winfo_height(), 420)
        canvas.delete("all")
        canvas.create_rectangle(0, 0, w, h, fill="#efe8d8", outline="")
        for i in range(-120, w + 160, 90):
            canvas.create_line(i, 0, i + 260, h, fill="#d7c5a8", width=5)
            canvas.create_line(i + 15, 0, i + 275, h, fill="#fff8ea", width=2)
        for y in range(45, h, 82):
            canvas.create_line(0, y, w, y + 28, fill="#d7c5a8", width=5)
            canvas.create_line(0, y + 13, w, y + 41, fill="#fff8ea", width=2)
        canvas.create_line(0, h * .22, w, h * .10, fill="#8fc1df", width=12, smooth=True)
        canvas.create_line(w * .08, h * .78, w * .92, h * .34, fill="#ff6b00", width=4, dash=(8, 6))
        self._draw_map_overlay(canvas, project, legacy, w, h)

    def _draw_control_map(self, canvas, project, legacy):
        canvas.update_idletasks()
        w = max(canvas.winfo_width(), 760); h = max(canvas.winfo_height(), 420)
        lat, lon = self._project_coord(project); zoom = 15
        try:
            from PIL import Image, ImageTk
            tile = 256
            cx, cy = self._tile_xy(lat, lon, zoom)
            center_px = cx * tile; center_py = cy * tile
            left = int(center_px - w / 2); top = int(center_py - h / 2)
            first_x = math.floor(left / tile); first_y = math.floor(top / tile)
            last_x = math.floor((left + w) / tile); last_y = math.floor((top + h) / tile)
            base = Image.new("RGB", (w, h), "#efe8d8")
            ok = False
            for tx in range(first_x, last_x + 1):
                for ty in range(first_y, last_y + 1):
                    img = self._fetch_tile_image(zoom, tx, ty)
                    if img is None:
                        continue
                    base.paste(img, (tx * tile - left, ty * tile - top)); ok = True
            if not ok:
                self._draw_fallback_map(canvas, project, legacy); return
            photo = ImageTk.PhotoImage(base)
            canvas.delete("all"); canvas._map_photo = photo
            canvas.create_image(0, 0, anchor=tk.NW, image=photo)
            self._draw_map_overlay(canvas, project, legacy, w, h)
        except Exception:
            self._draw_fallback_map(canvas, project, legacy)

    def _project_progress(self, project) -> int:
        counts = dashboard_counts(project.id)
        total = max(sum(counts.values()) or 1, 1)
        return min(99, max(1, int(total % 100)))

    def _project_list_item(self, parent, item, selected: bool):
        bg = "#4a3d34" if selected else "#303030"
        box = tk.Frame(parent, bg=bg, padx=12, pady=9, highlightbackground="#3f3f3f", highlightthickness=1)
        box.pack(fill=tk.X)
        box.bind("<Button-1>", lambda _e, name=item.nome: (self.project_var.set(name), self.render("torre")))
        top = tk.Frame(box, bg=bg); top.pack(fill=tk.X)
        tk.Label(top, text=str(item.nucleo or "-")[:16], bg=bg, fg="#8f8f8f", font=("Segoe UI", 7, "bold")).pack(side=tk.LEFT)
        tk.Label(top, text="ATIVA", bg="#145c31", fg="#20f077", font=("Segoe UI", 7, "bold"), padx=6, pady=1).pack(side=tk.RIGHT)
        tk.Label(box, text=item.nome, bg=bg, fg="#ffffff", font=("Segoe UI", 10, "bold")).pack(anchor=tk.W, pady=(4, 2))
        tk.Label(box, text=item.cidade or "-", bg=bg, fg="#9f9f9f", font=("Segoe UI", 8)).pack(anchor=tk.W)
        tk.Label(box, text=f"Gerente: {item.responsavel or '-'}", bg=bg, fg="#9f9f9f", font=("Segoe UI", 8)).pack(anchor=tk.W, pady=(3, 0))
        pct = self._project_progress(item)
        bar = tk.Canvas(box, height=5, bg=bg, highlightthickness=0); bar.pack(fill=tk.X, pady=(6, 0))
        bar.create_rectangle(0, 1, 210, 4, fill="#5b5b5b", outline="")
        bar.create_rectangle(0, 1, max(8, int(210 * pct / 100)), 4, fill="#ff6b00", outline="")

    def _render_torre(self, project, legacy):
        board = tk.Frame(self.content, bg="#050505")
        board.pack(fill=tk.BOTH, expand=True)
        left = tk.Frame(board, bg="#303030", width=320)
        left.pack(side=tk.LEFT, fill=tk.Y); left.pack_propagate(False)
        center = tk.Frame(board, bg="#101010")
        center.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        right = tk.Frame(board, bg="#303030", width=345, padx=16, pady=14)
        right.pack(side=tk.RIGHT, fill=tk.Y); right.pack_propagate(False)

        lh = tk.Frame(left, bg="#303030", padx=14, pady=10); lh.pack(fill=tk.X)
        tk.Label(lh, text=f"OBRAS ({len(self.project_names)})", bg="#303030", fg="#dcdcdc", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT)
        tk.Button(lh, text="+ Novo", command=lambda: self.render("projetos"), bg="#303030", fg="#ff6b00", relief=tk.FLAT, font=("Segoe UI", 8, "bold"), cursor="hand2").pack(side=tk.RIGHT)
        list_box = tk.Frame(left, bg="#303030"); list_box.pack(fill=tk.BOTH, expand=True)
        for item in list_projects():
            self._project_list_item(list_box, item, item.nome == project.nome)

        map_top = tk.Frame(center, bg="#0c0c0c", height=34)
        map_top.pack(fill=tk.X); map_top.pack_propagate(False)
        map_canvas = tk.Canvas(center, bg="#efe8d8", highlightthickness=0)
        tk.Button(map_top, text="Atualizar mapa", command=lambda: self._draw_control_map(map_canvas, project, legacy), bg="#303030", fg="#f8f8f8", relief=tk.FLAT, font=("Segoe UI", 8), cursor="hand2").pack(side=tk.LEFT, padx=8, pady=5)
        tk.Button(map_top, text="RDO", command=lambda: self.render("rdo"), bg="#ff6b00", fg="#ffffff", relief=tk.FLAT, font=("Segoe UI", 8, "bold"), cursor="hand2").pack(side=tk.RIGHT, padx=8, pady=5)
        map_canvas.pack(fill=tk.BOTH, expand=True)
        map_canvas.bind("<Configure>", lambda _e: self._draw_control_map(map_canvas, project, legacy))

        lat, lon = self._project_coord(project)
        tk.Label(right, text=str(project.nucleo or "-"), bg="#303030", fg="#777777", font=("Segoe UI", 8, "bold")).pack(anchor=tk.W)
        tk.Label(right, text=project.nome, bg="#303030", fg="#ffffff", font=("Segoe UI", 13, "bold")).pack(anchor=tk.W, pady=(4, 14))
        for section, rows in [
            ("LOCALIZACAO", [("Cidade", project.cidade or "-"), ("Coordenadas", f"{lat:.5f}, {lon:.5f}")]),
            ("RESPONSAVEIS", [("Empresa", "ConstruData"), ("Gerente", project.responsavel or "-"), ("Tipo", project.tipo or "-")]),
            ("OPERACAO", [("RDOs", str(len(legacy["rdos"]))), ("NS/Trechos", str(len(legacy["ns"]))), ("Desvios", str(len(legacy["desvios"])))]),
        ]:
            tk.Label(right, text=section, bg="#303030", fg="#7a7a7a", font=("Segoe UI", 8, "bold")).pack(anchor=tk.W, pady=(10, 5))
            for k, v in rows:
                row = tk.Frame(right, bg="#303030"); row.pack(fill=tk.X, pady=2)
                tk.Label(row, text=k, bg="#303030", fg="#8e8e8e", font=("Segoe UI", 8), width=13, anchor=tk.W).pack(side=tk.LEFT)
                tk.Label(row, text=v, bg="#303030", fg="#ffffff", font=("Segoe UI", 8, "bold"), anchor=tk.W).pack(side=tk.LEFT)
        card = tk.Frame(right, bg="#3b3b3b", padx=12, pady=10, highlightbackground="#555555", highlightthickness=1)
        card.pack(fill=tk.X, pady=(18, 0))
        tk.Label(card, text="Ciclo planejamento - RDO - ML", bg="#3b3b3b", fg="#ffffff", font=("Segoe UI", 10, "bold")).pack(anchor=tk.W)
        tk.Label(card, text="Planejado x realizado, desvios e replanejamento em rascunho.", bg="#3b3b3b", fg="#c9c9c9", font=("Segoe UI", 8), wraplength=285, justify=tk.LEFT).pack(anchor=tk.W, pady=(4, 8))
        stats = tk.Frame(card, bg="#3b3b3b"); stats.pack(fill=tk.X)
        for label, value, color in [("RDO", len(legacy["rdos"]), "#00c26f"), ("PPC", f"{legacy['ppc']}%", "#4b7cff"), ("DESVIOS", len(legacy["desvios"]), "#ff6b00")]:
            box = tk.Frame(stats, bg="#444444", padx=8, pady=6); box.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=3)
            tk.Label(box, text=label, bg="#444444", fg="#bababa", font=("Segoe UI", 7, "bold")).pack(anchor=tk.W)
            tk.Label(box, text=str(value), bg="#444444", fg=color, font=("Segoe UI", 14, "bold")).pack(anchor=tk.W)
        tk.Button(card, text="Executar Evolucao 360", command=lambda: self.render("evolucao_360"), bg="#ff6b00", fg="#ffffff", relief=tk.FLAT, font=("Segoe UI", 9, "bold"), cursor="hand2").pack(fill=tk.X, pady=(10, 0))

    def _render_gestao(self, project, legacy, counts):
        health = offline_health()
        snapshot = project_snapshot(project.id)
        actions = tk.Frame(self.content, bg=self.c["panel"])
        actions.pack(fill=tk.X, pady=(8, 0))
        def export():
            try:
                path = export_project_report(project.id)
                messagebox.showinfo("Relatorio 360", f"Relatorio gerado:\n{path}")
            except Exception as exc:
                messagebox.showerror("Relatorio 360", str(exc))
        self._button(actions, "Gerar Relatorio 360", export, self.c["accent"]).pack(side=tk.LEFT, padx=(0, 6))
        self._button(actions, "Atualizar snapshot", lambda: self.render("gestao_360"), self.c["blue"]).pack(side=tk.LEFT)
        rows = [("Projetos", 1), ("Tarefas", counts.get("tarefas", 0)), ("LPS", counts.get("lps", 0)), ("Suprimentos", counts.get("suprimentos", 0)), ("Mao de Obra", counts.get("mao_obra", 0)), ("Equipamentos", counts.get("equipamentos", 0)), ("Custos", counts.get("custos", 0)), ("RDOs", len(legacy["rdos"])), ("Desvios", len(legacy["desvios"]))]
        self._table(self.content, ("Modulo", "Total"), rows, 12)
        totals = snapshot["totals"]
        self._details(self.content, "\n".join([
            "SNAPSHOT LOCAL",
            f"Gerado em: {snapshot['generated_at']}",
            f"Health: {health['ok']} | Banco: {health['database']} | Projetos: {health['projects']} | Contatos: {health['contacts']}",
            "",
            f"Custos lancados: R$ {totals['custos_lancados']}",
            f"Mao de obra/dia: R$ {totals['mao_obra_dia']}",
            f"Equipamentos/dia: R$ {totals['equipamentos_dia']}",
            f"Custo diario estimado: R$ {totals['custo_dia_estimado']}",
        ]))

    def _render_evolucao(self, project):
        from campo.evolucao_platform import executar_ciclo_evolucao, resumo_evolucao

        try:
            resumo = resumo_evolucao(project.nucleo)
        except Exception as exc:
            self._details(self.content, f"Erro ao carregar Evolucao 360:\n{exc}")
            return

        actions = tk.Frame(self.content, bg=self.c["panel"])
        actions.pack(fill=tk.X, pady=(8, 0))

        def refresh():
            self.render("evolucao_360")

        def run_cycle():
            try:
                result = executar_ciclo_evolucao(project.nucleo)
                detail = result.get("resultado_ml", {})
                messagebox.showinfo("Evolucao 360", f"Ciclo executado para {project.nucleo}\nok={detail.get('ok')} tipo={detail.get('tipo', 'fallback')}")
                self.render("evolucao_360")
            except Exception as exc:
                messagebox.showerror("Evolucao 360", str(exc))

        self._button(actions, "Atualizar Evolucao 360", refresh, self.c["blue"]).pack(side=tk.LEFT, padx=(0, 6))
        self._button(actions, "Executar ML/fallback do nucleo", run_cycle, self.c["accent"]).pack(side=tk.LEFT, padx=(0, 6))

        pred = resumo.get("predicao") or {}
        cards = tk.Frame(self.content, bg=self.c["panel"])
        cards.pack(fill=tk.X, pady=(10, 0))
        self._card(cards, "Score Geral", resumo.get("score_geral", 0), resumo.get("status_geral", "-"), self.c["accent"] if resumo.get("score_geral", 0) >= 55 else self.c["warn"])
        self._card(cards, "Risco Previsto", f"{pred.get('risco_percentual', 0)}%", pred.get("tendencia", "-"), self.c["warn"])
        self._card(cards, "RDOs 30d", pred.get("rdos", 0), f"Prod/dia {pred.get('producao_media_dia', 0)}", self.c["blue"])
        self._card(cards, "Desvios Fortes", pred.get("desvios_alta_critica", 0), "ALTA/CRITICA", self.c["danger"])

        decision = tk.Frame(self.content, bg=self.c["card"], padx=12, pady=10, highlightbackground=self.c["line"], highlightthickness=1)
        decision.pack(fill=tk.X, pady=(12, 0))
        tk.Label(decision, text="DECISAO RECOMENDADA", bg=self.c["card"], fg=self.c["muted"], font=("Segoe UI", 8, "bold")).pack(anchor=tk.W)
        tk.Label(decision, text=resumo.get("decisao_recomendada") or "-", bg=self.c["card"], fg=self.c["ink"], font=("Segoe UI", 11, "bold"), wraplength=980, justify=tk.LEFT).pack(anchor=tk.W, pady=(5, 0))

        rows = []
        for item in resumo.get("modulos", []):
            rows.append((
                item.get("evolucao", "-"),
                item.get("status", "-"),
                item.get("score", 0),
                item.get("palantir_equivalente", "-"),
                item.get("memoria_calculo", "-"),
            ))
        self._table(self.content, ("Evolucao", "Status", "Score", "Palantir equivalente", "Memoria"), rows, 12)

        details = [
            "EVOLUCAO 360 - ONTOLOGIA / PREDICAO",
            "=" * 80,
            f"Projeto: {project.nome}",
            f"Nucleo: {project.nucleo}",
            f"Status geral: {resumo.get('status_geral')}",
            f"Score geral: {resumo.get('score_geral')}",
            "",
            "PREDICAO",
            "-" * 80,
            json.dumps(pred, ensure_ascii=False, indent=2),
            "",
            "ONTOLOGIA OPERACIONAL",
            "-" * 80,
            json.dumps(resumo.get("ontologia") or {}, ensure_ascii=False, indent=2),
        ]
        self._details(self.content, "\n".join(details))

    def _render_evm(self, legacy):
        rows = [(d.atividade, d.spi, d.cpi, d.ppc, d.severidade, d.acao_recomendada or "") for d in legacy["desvios"]]
        self._table(self.content, ("Atividade", "SPI", "CPI", "PPC", "Risco", "Acao"), rows, 14)

    def _render_relatorio(self, project):
        actions = tk.Frame(self.content, bg=self.c["panel"])
        actions.pack(fill=tk.X, pady=10)
        def export():
            try:
                path = export_project_report(project.id)
                messagebox.showinfo("Relatorio 360", f"Relatorio gerado:\n{path}")
                self.render("relatorio_360")
            except Exception as exc:
                messagebox.showerror("Relatorio 360", str(exc))
        self._button(actions, "Gerar relatorio 360 Markdown", export, self.c["accent"]).pack(side=tk.LEFT)
        self._details(self.content, build_project_report(project.id))

    def _render_engine_page(self, key, project, legacy):
        self._details(self.content, "\n".join([f"Modulo: {key}", f"Projeto: {project.nome}", "", "Modulo no contexto do projeto ativo.", f"NS/frentes: {len(legacy['ns'])}", f"RDOs: {len(legacy['rdos'])}", f"Planos: {len(legacy['planos'])}"]))


def build_construdata_workspace_tab(app, *, index: int = 15, title: str = "ConstruData", initial_key: str = "gestao_360"):
    tab = tk.Frame(app.nb)
    app.nb.add(tab, text=f"  [{index}] {title}  ")
    workspace = ConstruDataWorkspace(app, tab)
    workspace.render(initial_key)
    return workspace


def build_construdata_module_tabs(app, start_index: int = 15):
    modules = [
        ("Torre Controle", "torre"),
        ("Evolucao 360", "evolucao_360"),
        ("Planejamento", "planejamento"),
        ("Plan. Mestre", "planejamento_mestre"),
        ("RDO", "rdo"),
        ("RDOs WhatsApp", "rdo_whatsapp_live"),
        ("Projetos", "projetos"),
        ("Gestao 360", "gestao_360"),
        ("Suprimentos", "suprimentos"),
        ("Mao de Obra", "mao_obra"),
        ("Equipamentos", "equipamentos"),
        ("Contatos", "contatos"),
        ("DRE", "dre"),
        ("EVM", "evm"),
        ("WhatsApp RDO", "whatsapp_rdo"),
    ]
    return [
        build_construdata_workspace_tab(app, index=start_index + idx, title=title, initial_key=key)
        for idx, (title, key) in enumerate(modules)
    ]
