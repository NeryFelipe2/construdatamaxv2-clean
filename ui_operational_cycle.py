"""Aba nativa Tkinter para o ciclo operacional offline.

Sem HTML: este modulo pluga uma aba no Notebook do NOVA NS V5 e consome o
mesmo banco local usado pela API.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk


def _safe(value, default=""):
    return default if value is None else value


def _enum(value):
    return getattr(value, "value", value)


def _to_float(value, default=0.0):
    try:
        return float(str(value or "").replace(",", "."))
    except Exception:
        return default


def _to_int(value, default=0):
    try:
        return int(float(str(value or "").replace(",", ".")))
    except Exception:
        return default


def _week_defaults() -> tuple[str, str]:
    today = date.today()
    start = today - timedelta(days=today.weekday())
    return start.isoformat(), (start + timedelta(days=6)).isoformat()


def _current_nucleo(app) -> str:
    try:
        value = app.nucleo_var.get().strip()
    except Exception:
        value = ""
    return value or "SLNR"


def _append_line(lines: list[str], title: str, value) -> None:
    lines.append(f"{title}: {_safe(value, '-')}")


def _load_operational_summary(nucleo: str, severidade_filter: str = "", status_filter: str = "") -> str:
    from core.database import criar_banco, get_session
    from core.models import (
        DesvioPlanejamento,
        OperationalLog,
        PlanejamentoSemanal,
        Replanejamento,
        StatusPlanejamento,
        StatusReplanejamento,
    )

    criar_banco()
    with get_session() as session:
        planos = (
            session.query(PlanejamentoSemanal)
            .filter(PlanejamentoSemanal.nucleo == nucleo)
            .order_by(PlanejamentoSemanal.criado_em.desc())
            .limit(8)
            .all()
        )
        plano_ativo = (
            session.query(PlanejamentoSemanal)
            .filter(
                PlanejamentoSemanal.nucleo == nucleo,
                PlanejamentoSemanal.status == StatusPlanejamento.ATIVO,
            )
            .order_by(PlanejamentoSemanal.criado_em.desc())
            .first()
        )
        desvios = (
            session.query(DesvioPlanejamento)
            .join(PlanejamentoSemanal)
            .filter(PlanejamentoSemanal.nucleo == nucleo)
            .order_by(DesvioPlanejamento.criado_em.desc())
            .limit(10)
            .all()
        )
        replanejamentos = (
            session.query(Replanejamento)
            .filter(
                Replanejamento.nucleo == nucleo,
                Replanejamento.status == StatusReplanejamento.RASCUNHO,
            )
            .order_by(Replanejamento.criado_em.desc())
            .limit(5)
            .all()
        )
        logs = (
            session.query(OperationalLog)
            .filter(OperationalLog.nucleo == nucleo)
            .order_by(OperationalLog.criado_em.desc())
            .limit(8)
            .all()
        )

        ppc_vals = [d.ppc for d in desvios if d.ppc is not None]
        ppc_medio = round(sum(ppc_vals) / len(ppc_vals), 2) if ppc_vals else 0
        criticos = [
            d for d in desvios
            if str(_safe(d.severidade)).upper().endswith("CRITICA")
            or str(_safe(d.severidade)).upper() == "CRITICA"
        ]

        lines: list[str] = []
        lines.append("CICLO OPERACIONAL OFFLINE")
        lines.append("=" * 72)
        _append_line(lines, "Nucleo", nucleo)
        _append_line(lines, "Planejamento ativo", f"#{plano_ativo.id} {plano_ativo.semana_inicio} -> {plano_ativo.semana_fim}" if plano_ativo else "nenhum")
        _append_line(lines, "Planejamentos recentes", len(planos))
        _append_line(lines, "Desvios recentes", len(desvios))
        _append_line(lines, "PPC medio recente", f"{ppc_medio}%")
        _append_line(lines, "Desvios criticos recentes", len(criticos))
        _append_line(lines, "Replanejamentos em rascunho", len(replanejamentos))
        _append_line(lines, "Logs recentes", len(logs))

        lines.append("")
        lines.append("PLANEJAMENTOS")
        lines.append("-" * 72)
        if not planos:
            lines.append("Nenhum planejamento semanal cadastrado para este nucleo.")
        for p in planos:
            if status_filter and str(_enum(p.status)) != status_filter:
                continue
            lines.append(f"#{p.id} [{p.status}] {p.semana_inicio} -> {p.semana_fim} | resp: {_safe(p.responsavel, '-')}")

        lines.append("")
        lines.append("ULTIMOS DESVIOS")
        lines.append("-" * 72)
        if not desvios:
            lines.append("Nenhum desvio calculado ainda. Crie um RDO apos validar um planejamento ativo.")
        for d in desvios:
            if severidade_filter and str(_enum(d.severidade)) != severidade_filter:
                continue
            lines.append(
                f"#{d.id} [{d.severidade}] {d.atividade} | "
                f"meta={d.meta} realizado={d.realizado} ppc={d.ppc}% rdo=#{d.rdo_id or '-'}"
            )

        lines.append("")
        lines.append("REPLANEJAMENTOS EM RASCUNHO")
        lines.append("-" * 72)
        if not replanejamentos:
            lines.append("Nenhum replanejamento pendente.")
        for r in replanejamentos:
            lines.append(f"#{r.id} [{r.status}] criado em {r.criado_em}")

        lines.append("")
        lines.append("LOGS OPERACIONAIS")
        lines.append("-" * 72)
        if not logs:
            lines.append("Nenhum log operacional para este nucleo.")
        for log in logs:
            lines.append(f"#{log.id} [{log.severity}] {log.subsystem}/{log.event_type}: {_safe(log.error_message, '')}")

        return "\n".join(lines)


def _create_weekly_plan(nucleo: str, payload: dict[str, str]) -> int:
    from core.database import criar_banco, get_session
    from core.models import PlanejamentoItem, PlanejamentoSemanal, StatusPlanejamento

    criar_banco()
    with get_session() as session:
        plan = PlanejamentoSemanal(
            nucleo=nucleo,
            semana_inicio=date.fromisoformat(payload["semana_inicio"]),
            semana_fim=date.fromisoformat(payload["semana_fim"]),
            engenheiro=payload.get("engenheiro") or payload.get("responsavel") or "Engenharia",
            responsavel=payload.get("responsavel") or payload.get("engenheiro") or "Engenharia",
            status=StatusPlanejamento.RASCUNHO,
            observacao=payload.get("observacao") or "Criado no Ciclo Operacional offline",
        )
        session.add(plan)
        session.flush()
        session.add(PlanejamentoItem(
            planejamento_id=plan.id,
            atividade=payload.get("atividade") or "Atividade planejada",
            meta_quantidade=_to_float(payload.get("meta_quantidade")),
            unidade=payload.get("unidade") or "m",
            equipe_prevista=_to_int(payload.get("equipe_prevista")),
            custo_previsto=_to_float(payload.get("custo_previsto")),
            data_inicio=date.fromisoformat(payload["semana_inicio"]),
            data_fim=date.fromisoformat(payload["semana_fim"]),
            restricoes=json.dumps([payload.get("restricoes")], ensure_ascii=False) if payload.get("restricoes") else "[]",
        ))
        session.flush()
        return int(plan.id)


def _validate_latest_plan(nucleo: str, diretor: str, aprovado: bool) -> int:
    from core.database import criar_banco, get_session
    from core.models import PlanejamentoSemanal, PlanejamentoValidacao, StatusPlanejamento

    criar_banco()
    with get_session() as session:
        plan = (
            session.query(PlanejamentoSemanal)
            .filter(PlanejamentoSemanal.nucleo == nucleo)
            .order_by(PlanejamentoSemanal.criado_em.desc())
            .first()
        )
        if not plan:
            raise ValueError("Nenhum planejamento encontrado para validar.")
        session.add(PlanejamentoValidacao(
            planejamento_id=plan.id,
            aprovado=aprovado,
            diretor=diretor or "Diretoria",
            observacao="Validado no GUI offline" if aprovado else "Rejeitado no GUI offline",
        ))
        if aprovado:
            old_plans = session.query(PlanejamentoSemanal).filter(
                PlanejamentoSemanal.nucleo == nucleo,
                PlanejamentoSemanal.status == StatusPlanejamento.ATIVO,
                PlanejamentoSemanal.id != plan.id,
            ).all()
            for old in old_plans:
                old.status = StatusPlanejamento.SUBSTITUIDO
            plan.status = StatusPlanejamento.ATIVO
        else:
            plan.status = StatusPlanejamento.ENCERRADO
        session.flush()
        return int(plan.id)


def _latest_replan_action(nucleo: str, action: str, diretor: str) -> tuple[int, int | None]:
    from core.database import criar_banco, get_session
    from core.models import PlanejamentoItem, PlanejamentoSemanal, Replanejamento, StatusPlanejamento, StatusReplanejamento

    criar_banco()
    with get_session() as session:
        replan = (
            session.query(Replanejamento)
            .filter(Replanejamento.nucleo == nucleo)
            .order_by(Replanejamento.criado_em.desc())
            .first()
        )
        if not replan:
            raise ValueError("Nenhum replanejamento encontrado.")
        replan.diretor = diretor or "Diretoria"
        if action == "aprovar":
            replan.status = StatusReplanejamento.APROVADO
            replan.observacao = "Aprovado no GUI offline"
            session.flush()
            return int(replan.id), None
        if action == "rejeitar":
            replan.status = StatusReplanejamento.REJEITADO
            replan.observacao = "Rejeitado no GUI offline"
            session.flush()
            return int(replan.id), None
        if action != "aplicar":
            raise ValueError(f"Acao invalida: {action}")
        if replan.status != StatusReplanejamento.APROVADO:
            raise ValueError("Aprove o replanejamento antes de aplicar.")
        sugestoes = json.loads(replan.sugestoes_json) if replan.sugestoes_json else []
        today = date.today()
        new_plan = PlanejamentoSemanal(
            nucleo=nucleo,
            semana_inicio=today,
            semana_fim=today + timedelta(days=6),
            engenheiro="Gerado por ML/Replanejamento",
            responsavel="Diretoria",
            status=StatusPlanejamento.RASCUNHO,
            observacao=f"Gerado a partir do replanejamento #{replan.id}",
        )
        session.add(new_plan)
        session.flush()
        for item in sugestoes:
            session.add(PlanejamentoItem(
                planejamento_id=new_plan.id,
                atividade=item.get("atividade") or item.get("sugestao") or "Acao de replanejamento",
                meta_quantidade=item.get("meta_quantidade"),
                unidade=item.get("unidade"),
                equipe_prevista=item.get("equipe_prevista"),
                custo_previsto=item.get("custo_previsto"),
                data_inicio=today,
                data_fim=today + timedelta(days=6),
                restricoes=json.dumps(item, ensure_ascii=False, default=str),
            ))
        replan.status = StatusReplanejamento.APLICADO
        replan.observacao = "Aplicado no GUI offline"
        session.flush()
        return int(replan.id), int(new_plan.id)


def _run_ml(nucleo: str) -> dict:
    from api.operational import tentar_xgboost
    from core.database import criar_banco, get_session

    criar_banco()
    with get_session() as session:
        result = tentar_xgboost(session, nucleo)
        session.commit()
        return result


def build_operational_cycle_tab(app, *, title: str = "  [14] Ciclo Operacional  "):
    """Adiciona uma aba nativa ao app Tkinter existente."""

    bg = globals().get("BG", "#0b0f14")
    fg = globals().get("FG", "#e6edf3")
    accent = globals().get("ACCENT", "#00ff88")
    bg2 = globals().get("BG2", "#111827")

    tab = tk.Frame(app.nb, bg=bg)
    app.nb.add(tab, text=title)

    header = tk.Frame(tab, bg=bg)
    header.pack(fill=tk.X, padx=10, pady=(10, 6))

    tk.Label(
        header,
        text="Ciclo Operacional Offline",
        bg=bg,
        fg=accent,
        font=("Segoe UI", 13, "bold"),
    ).pack(side=tk.LEFT)

    nucleo_var = getattr(app, "nucleo_var", tk.StringVar(value="SLNR"))
    tk.Label(header, text="Nucleo:", bg=bg, fg=fg, font=("Segoe UI", 9)).pack(side=tk.LEFT, padx=(22, 4))
    ttk.Combobox(header, textvariable=nucleo_var, width=28).pack(side=tk.LEFT)

    severidade_var = tk.StringVar(value="")
    status_var = tk.StringVar(value="")
    tk.Label(header, text="Risco:", bg=bg, fg=fg, font=("Segoe UI", 9)).pack(side=tk.LEFT, padx=(14, 4))
    ttk.Combobox(header, textvariable=severidade_var, values=["", "BAIXA", "MEDIA", "ALTA", "CRITICA"], width=10, state="readonly").pack(side=tk.LEFT)
    tk.Label(header, text="Plano:", bg=bg, fg=fg, font=("Segoe UI", 9)).pack(side=tk.LEFT, padx=(10, 4))
    ttk.Combobox(header, textvariable=status_var, values=["", "RASCUNHO", "ATIVO", "ENCERRADO", "SUBSTITUIDO"], width=12, state="readonly").pack(side=tk.LEFT)

    form = tk.LabelFrame(tab, text="Planejamento semanal", bg=bg, fg=fg, padx=8, pady=8)
    form.pack(fill=tk.X, padx=10, pady=(0, 8))

    start, end = _week_defaults()

    def entry(label: str, default: str, width: int = 14):
        box = tk.Frame(form, bg=bg)
        box.pack(side=tk.LEFT, padx=4)
        tk.Label(box, text=label, bg=bg, fg=fg, font=("Segoe UI", 8)).pack(anchor=tk.W)
        var = tk.StringVar(value=default)
        tk.Entry(box, textvariable=var, width=width).pack(anchor=tk.W)
        return var

    fields = {
        "semana_inicio": entry("Inicio", start, 11),
        "semana_fim": entry("Fim", end, 11),
        "engenheiro": entry("Engenheiro", "Engenharia", 15),
        "responsavel": entry("Responsavel", "Engenharia", 15),
        "atividade": entry("Atividade", "Assentamento / producao", 24),
        "meta_quantidade": entry("Meta", "10", 7),
        "unidade": entry("Un", "m", 5),
        "equipe_prevista": entry("Equipe", "4", 7),
        "custo_previsto": entry("Custo", "1000", 9),
        "restricoes": entry("Restricao", "", 18),
    }

    director_var = tk.StringVar(value="Felipe Nery")

    output = scrolledtext.ScrolledText(
        tab,
        bg=bg2,
        fg=fg,
        insertbackground=fg,
        font=("Consolas", 9),
        wrap=tk.WORD,
    )
    output.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))

    def refresh():
        nucleo = _current_nucleo(app)
        try:
            text = _load_operational_summary(nucleo, severidade_var.get(), status_var.get())
        except Exception as exc:
            text = f"Erro ao carregar ciclo operacional do nucleo {nucleo}: {exc}"
        output.delete("1.0", tk.END)
        output.insert(tk.END, text)

    def create_plan():
        nucleo = _current_nucleo(app)
        try:
            plan_id = _create_weekly_plan(nucleo, {key: var.get() for key, var in fields.items()})
            refresh()
            messagebox.showinfo("Planejamento", f"Planejamento #{plan_id} criado em rascunho para {nucleo}.")
        except Exception as exc:
            messagebox.showerror("Planejamento", str(exc))

    def approve_plan(aprovado: bool):
        nucleo = _current_nucleo(app)
        try:
            plan_id = _validate_latest_plan(nucleo, director_var.get(), aprovado)
            refresh()
            messagebox.showinfo("Planejamento", f"Planejamento #{plan_id} {'aprovado/ativado' if aprovado else 'rejeitado/encerrado'}.")
        except Exception as exc:
            messagebox.showerror("Planejamento", str(exc))

    def recalc_ml():
        nucleo = _current_nucleo(app)
        try:
            result = _run_ml(nucleo)
            refresh()
            messagebox.showinfo("Ciclo Operacional", f"ML/regras executado para {nucleo}.\nResultado: {result.get('tipo', 'fallback')}")
        except Exception as exc:
            messagebox.showerror("Ciclo Operacional", f"Erro ao recalcular ML/regras: {exc}")

    def replan_action(action: str):
        nucleo = _current_nucleo(app)
        try:
            replan_id, new_plan_id = _latest_replan_action(nucleo, action, director_var.get())
            refresh()
            extra = f"\nNovo plano rascunho: #{new_plan_id}" if new_plan_id else ""
            messagebox.showinfo("Replanejamento", f"Replanejamento #{replan_id}: {action}.{extra}")
        except Exception as exc:
            messagebox.showerror("Replanejamento", str(exc))

    actions = tk.Frame(tab, bg=bg)
    actions.pack(fill=tk.X, padx=10, pady=(0, 10))

    tk.Label(actions, text="Diretor:", bg=bg, fg=fg, font=("Segoe UI", 9)).pack(side=tk.LEFT, padx=(0, 4))
    tk.Entry(actions, textvariable=director_var, width=16).pack(side=tk.LEFT, padx=(0, 8))
    tk.Button(actions, text="Atualizar", command=refresh, bg=accent, fg="#000", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=(0, 4))
    tk.Button(actions, text="Criar plano", command=create_plan, bg="#0ea5e9", fg="#fff", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=4)
    tk.Button(actions, text="Aprovar plano", command=lambda: approve_plan(True), bg="#16a34a", fg="#fff", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=4)
    tk.Button(actions, text="Rejeitar plano", command=lambda: approve_plan(False), bg="#b91c1c", fg="#fff", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=4)
    tk.Button(actions, text="ML/Regras", command=recalc_ml, bg="#2563eb", fg="#fff", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=4)
    tk.Button(actions, text="Aprovar replan", command=lambda: replan_action("aprovar"), bg="#7c3aed", fg="#fff", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=4)
    tk.Button(actions, text="Aplicar replan", command=lambda: replan_action("aplicar"), bg="#9333ea", fg="#fff", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=4)
    tk.Button(actions, text="Rejeitar replan", command=lambda: replan_action("rejeitar"), bg="#7f1d1d", fg="#fff", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=4)

    refresh()
    return tab
