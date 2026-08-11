# -*- coding: utf-8 -*-
"""Gerador de MS Project (MSPDI XML) encadeado — consolida o encoding que vivia
solto nos scripts build_project_*.py (C:\\tmp). Encoding copiado da tarefa que
FUNCIONA no MS Project: Milestone=0 + Start/Finish + ManualDuration + predecessor
FS; sem isso o Project colapsa tudo na data inicial. Calendário 6 dias/sem.

Contrato de entrada (`grupos`): OrderedDict equipe_label -> {
    "recurso": str,                # nome do recurso (equipe) no Project
    "trechos": [ {                 # já ordenados e datados
        "rotulo": str,             # nome da tarefa (ex "1º · NS ESGOTO 01 · 82 m · 2d")
        "s": datetime, "f": datetime, "dur_h": float,
        "notas": str|None,         # Anotações (composição da equipe)
    }, ... ] }
Use junto do pipeline; datas/duração saem do agendador (horas úteis).
"""
from collections import OrderedDict
from xml.sax.saxutils import escape
import xml.etree.ElementTree as ET


def _fdt(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def _cal_6dias():
    dia = lambda dt: (f'<WeekDay><DayType>{dt}</DayType><DayWorking>1</DayWorking><WorkingTimes>'
                      f'<WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime>'
                      f'<WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime>'
                      f'</WorkingTimes></WeekDay>')
    return ('<Calendars><Calendar><UID>1</UID><Name>WCR 6 dias</Name><IsBaseCalendar>1</IsBaseCalendar>'
            '<BaseCalendarUID>-1</BaseCalendarUID><WeekDays>'
            '<WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>'
            + "".join(dia(d) for d in range(2, 8)) + '</WeekDays></Calendar></Calendars>')


def gerar(caminho, nome, grupos, ini, fim):
    """Escreve o MSPDI em `caminho`. `ini`/`fim` = datetimes do projeto."""
    uid = [0]
    def U():
        uid[0] += 1
        return uid[0]

    def leaf(rotulo, s, f, dur_h, pred, notas):
        u = U()
        m = max(1, round(dur_h * 60)); H, M = m // 60, m % 60
        x = (f'<Task><UID>{u}</UID><ID>{u}</ID><Name>{escape(rotulo)}</Name>'
             f'<OutlineLevel>2</OutlineLevel><Type>1</Type><Manual>0</Manual><Milestone>0</Milestone>'
             f'<Start>{_fdt(s)}</Start><Finish>{_fdt(f)}</Finish>'
             f'<ManualStart>{_fdt(s)}</ManualStart><ManualFinish>{_fdt(f)}</ManualFinish>'
             f'<Duration>PT{H}H{M}M0S</Duration><ManualDuration>PT{H}H{M}M0S</ManualDuration><DurationFormat>7</DurationFormat>')
        if pred:
            x += f'<PredecessorLink><PredecessorUID>{pred}</PredecessorUID><Type>1</Type></PredecessorLink>'
        if notas:
            x += f'<Notes>{escape(notas)}</Notes>'
        return x + '</Task>', u

    def summ(rotulo, s, f):
        u = U()
        return (f'<Task><UID>{u}</UID><ID>{u}</ID><Name>{escape(rotulo)}</Name><OutlineLevel>1</OutlineLevel>'
                f'<Type>1</Type><Manual>0</Manual><Summary>1</Summary>'
                f'<Start>{_fdt(s)}</Start><Finish>{_fdt(f)}</Finish></Task>'), u

    recursos = OrderedDict()
    for label, g in grupos.items():
        recursos.setdefault(g.get("recurso", label), len(recursos) + 1)

    T = []
    asg = []
    for label, g in grupos.items():
        trs = g["trechos"]
        if not trs:
            continue
        smin = min(t["s"] for t in trs); smax = max(t["f"] for t in trs)
        br = lambda d: d.strftime("%d/%m")
        sx, _ = summ(f"{label.upper()} ({len(trs)} trechos · {br(smin)}→{br(smax)})", smin, smax)
        T.append(sx)
        prev = None
        ru = recursos[g.get("recurso", label)]
        for t in trs:
            tx, u = leaf(t["rotulo"], t["s"], t["f"], t["dur_h"], prev, t.get("notas"))
            T.append(tx); prev = u; asg.append((u, ru))

    resx = ("<Resources>" + "".join(
        f'<Resource><UID>{u}</UID><ID>{u}</ID><Name>{escape(nm)}</Name><Type>1</Type><IsNull>0</IsNull></Resource>'
        for nm, u in recursos.items()) + "</Resources>")
    asgx = ("<Assignments>" + "".join(
        f'<Assignment><UID>{j}</UID><TaskUID>{tu}</TaskUID><ResourceUID>{ru}</ResourceUID><Units>1</Units></Assignment>'
        for j, (tu, ru) in enumerate(asg, 1)) + "</Assignments>")

    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<Project xmlns="http://schemas.microsoft.com/project">\n'
           f'<Name>{escape(nome)}</Name>\n'
           f'<StartDate>{_fdt(ini)}</StartDate>\n<FinishDate>{_fdt(fim)}</FinishDate>\n<ScheduleFromStart>1</ScheduleFromStart>\n'
           '<CalendarUID>1</CalendarUID>\n<MinutesPerDay>480</MinutesPerDay>\n<MinutesPerWeek>2880</MinutesPerWeek>\n'
           + _cal_6dias() + '\n<Tasks>\n' + '\n'.join(T) + '\n</Tasks>\n' + resx + '\n' + asgx + '\n</Project>\n')
    ET.fromstring(xml)  # valida
    with open(caminho, "w", encoding="utf-8") as fh:
        fh.write(xml)
    return {"saida": caminho, "tarefas": uid[0], "recursos": list(recursos)}
