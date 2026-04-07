#!/usr/bin/env python3
"""
gerar_cronograma_ns.py — Cronograma por Nota de Serviço
ConstruData SABESP v5.0 — Contrato 11481051

Cada trecho (NS) = 1 tarefa no cronograma.
Gera: HTML Gantt interativo + MS Project XML + JSON dados.

Uso:
    from gerar_cronograma_ns import gerar_cronograma_ns
    gerar_cronograma_ns(pvs, trechos, nucleo, pasta_saida, equipes=4, data_inicio="2026-04-01")
"""

import json
import math
import os
from datetime import datetime, timedelta
from pathlib import Path


def _dias_uteis(data_ini, n_dias):
    """Avança n dias úteis a partir de data_ini."""
    d = data_ini
    count = 0
    while count < n_dias:
        d += timedelta(days=1)
        if d.weekday() < 5:  # seg-sex
            count += 1
    return d


def gerar_cronograma_ns(pvs, trechos, nucleo, pasta_saida,
                         equipes=4, data_inicio="2026-04-01",
                         prod_m_dia=6.0):
    """
    Gera cronograma onde cada NS (trecho) é uma tarefa.

    Args:
        pvs: dict de PVs
        trechos: lista de trechos enriquecidos
        nucleo: nome do núcleo
        pasta_saida: pasta de saída
        equipes: número de equipes simultâneas
        data_inicio: data de início (YYYY-MM-DD)
        prod_m_dia: produtividade em metros/dia/equipe

    Returns:
        dict com dados do cronograma
    """
    pasta = Path(pasta_saida)
    pasta.mkdir(parents=True, exist_ok=True)

    dt_ini = datetime.strptime(data_inicio, "%Y-%m-%d")

    # ── Calcular duração de cada NS ────────────────────────────────
    tarefas = []
    for i, tr in enumerate(trechos):
        ns_id = i + 1
        ext = tr.get("ext_m", 0) or 0
        dn = tr.get("dn_mm", 200)
        pv_ini = tr.get("pv_ini", "?")
        pv_fim = tr.get("pv_fim", "?")
        rua = tr.get("rua", "Sem Rua")
        material = tr.get("material", "PVC")

        # Duração: extensão / produtividade (min 1 dia)
        dias = max(1, math.ceil(ext / prod_m_dia))

        # Custo estimado
        custo = round(ext * 910, 2)

        tarefas.append({
            "ns_id": ns_id,
            "nome": f"NS_{ns_id:03d}",
            "pv_ini": pv_ini,
            "pv_fim": pv_fim,
            "rua": rua,
            "ext_m": round(ext, 1),
            "dn_mm": dn,
            "material": material,
            "dias": dias,
            "custo": custo,
            "inicio": None,
            "fim": None,
            "equipe": None,
        })

    # ── Alocar tarefas em equipes (round-robin) ───────────────────
    equipe_livre = [dt_ini] * equipes  # data em que cada equipe fica livre

    for t in tarefas:
        # Pegar equipe que fica livre primeiro
        eq_idx = equipe_livre.index(min(equipe_livre))
        t["equipe"] = eq_idx + 1
        t["inicio"] = equipe_livre[eq_idx]
        t["fim"] = _dias_uteis(t["inicio"], t["dias"])
        equipe_livre[eq_idx] = t["fim"]

    # ── Estatísticas ──────────────────────────────────────────────
    if tarefas:
        data_fim_geral = max(t["fim"] for t in tarefas)
        dias_total = (data_fim_geral - dt_ini).days
        custo_total = sum(t["custo"] for t in tarefas)
        ext_total = sum(t["ext_m"] for t in tarefas)
    else:
        data_fim_geral = dt_ini
        dias_total = 0
        custo_total = 0
        ext_total = 0

    stats = {
        "nucleo": nucleo,
        "total_ns": len(tarefas),
        "equipes": equipes,
        "prod_m_dia": prod_m_dia,
        "data_inicio": data_inicio,
        "data_fim": data_fim_geral.strftime("%Y-%m-%d"),
        "dias_totais": dias_total,
        "meses": round(dias_total / 30, 1),
        "ext_total_m": round(ext_total, 1),
        "custo_total": round(custo_total, 2),
    }

    # ── Gerar HTML Gantt ──────────────────────────────────────────
    _gerar_gantt_html(tarefas, stats, pasta / "CRONOGRAMA_NS.html")

    # ── Gerar JSON ────────────────────────────────────────────────
    dados_json = {
        "stats": stats,
        "tarefas": [{
            **t,
            "inicio": t["inicio"].strftime("%Y-%m-%d"),
            "fim": t["fim"].strftime("%Y-%m-%d"),
        } for t in tarefas],
    }
    json_path = pasta / "CRONOGRAMA_NS.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(dados_json, f, indent=2, ensure_ascii=False)

    # ── Gerar MS Project XML ──────────────────────────────────────
    _gerar_project_xml(tarefas, stats, pasta / "CRONOGRAMA_NS.xml")

    print(f"[CRONO] {len(tarefas)} NS | {equipes} equipes | "
          f"{dias_total} dias ({stats['meses']}m) | R$ {custo_total:,.0f}")
    print(f"[CRONO] HTML: CRONOGRAMA_NS.html | XML: CRONOGRAMA_NS.xml")

    return dados_json


def _gerar_gantt_html(tarefas, stats, out_path):
    """Gera Gantt HTML interativo."""
    if not tarefas:
        return

    dt_min = min(t["inicio"] for t in tarefas)
    dt_max = max(t["fim"] for t in tarefas)
    span_days = max(1, (dt_max - dt_min).days)

    cores_equipe = ["#1F4E79", "#2E7D32", "#F57F17", "#C62828",
                    "#4A148C", "#00695C", "#E65100", "#1565C0",
                    "#AD1457", "#33691E"]

    rows_html = ""
    for t in tarefas:
        offset_pct = (t["inicio"] - dt_min).days / span_days * 100
        width_pct = max(0.5, t["dias"] / span_days * 100)
        cor = cores_equipe[(t["equipe"] - 1) % len(cores_equipe)]

        rows_html += f"""
        <tr>
          <td style="white-space:nowrap;font-weight:600">{t['nome']}</td>
          <td style="font-size:11px">{t['pv_ini']} → {t['pv_fim']}</td>
          <td class="r">{t['ext_m']:.0f}m</td>
          <td class="r">DN{t['dn_mm']}</td>
          <td class="r">Eq.{t['equipe']}</td>
          <td class="r">{t['dias']}d</td>
          <td class="r" style="font-size:11px">{t['inicio'].strftime('%d/%m')}</td>
          <td class="r" style="font-size:11px">{t['fim'].strftime('%d/%m')}</td>
          <td style="position:relative;min-width:300px">
            <div style="position:absolute;left:{offset_pct:.1f}%;width:{width_pct:.1f}%;
                         top:4px;height:20px;background:{cor};border-radius:4px;opacity:0.85"
                 title="{t['nome']}: {t['pv_ini']}→{t['pv_fim']} | {t['ext_m']:.0f}m | {t['dias']}d | Eq.{t['equipe']}">
            </div>
          </td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Cronograma por NS — {stats['nucleo']}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:Arial,sans-serif;background:#f5f5f5;padding:16px}}
.hdr{{background:linear-gradient(135deg,#1F4E79,#2E75B6);color:#fff;padding:20px;border-radius:12px;margin-bottom:16px}}
.hdr h1{{font-size:20px}}.hdr p{{opacity:.85;font-size:13px;margin-top:4px}}
.kpis{{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:16px}}
.kpi{{background:#fff;border-radius:10px;padding:12px;text-align:center}}
.kpi .l{{font-size:11px;color:#666;font-weight:600}}.kpi .v{{font-size:18px;font-weight:700;color:#1F4E79}}
.kpi .s{{font-size:10px;color:#999}}
table{{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border-radius:10px;overflow:hidden}}
thead tr{{background:#1F4E79;color:#fff}}
th,td{{padding:6px 8px;border-bottom:1px solid #f0f0f0}}
th{{text-align:left;font-size:11px}}.r{{text-align:right}}
tr:hover{{background:#f0f8ff}}
.leg{{margin-top:12px;display:flex;gap:12px;flex-wrap:wrap;font-size:11px}}
.leg span{{display:flex;align-items:center;gap:4px}}
.leg .dot{{width:12px;height:12px;border-radius:3px}}
</style></head><body>
<div class="hdr">
<h1>Cronograma por Nota de Serviço — {stats['nucleo']}</h1>
<p>FCN Construções e Saneamento · Contrato 11481051 · {stats['total_ns']} NS · {stats['equipes']} equipes · {stats['data_inicio']} a {stats['data_fim']}</p>
</div>
<div class="kpis">
<div class="kpi"><div class="l">Total NS</div><div class="v">{stats['total_ns']}</div><div class="s">trechos</div></div>
<div class="kpi"><div class="l">Equipes</div><div class="v">{stats['equipes']}</div><div class="s">simultâneas</div></div>
<div class="kpi"><div class="l">Extensão</div><div class="v">{stats['ext_total_m']:,.0f}m</div><div class="s">total</div></div>
<div class="kpi"><div class="l">Prazo</div><div class="v">{stats['dias_totais']} dias</div><div class="s">{stats['meses']} meses</div></div>
<div class="kpi"><div class="l">Custo</div><div class="v">R$ {stats['custo_total']:,.0f}</div><div class="s">BDI 25%</div></div>
<div class="kpi"><div class="l">Produtividade</div><div class="v">{stats['prod_m_dia']} m/dia</div><div class="s">por equipe</div></div>
</div>
<table>
<thead><tr><th>NS</th><th>Trecho</th><th class="r">Ext</th><th class="r">DN</th><th class="r">Eq</th><th class="r">Dias</th><th class="r">Início</th><th class="r">Fim</th><th>Gantt</th></tr></thead>
<tbody>{rows_html}</tbody>
</table>
<div class="leg">
{' '.join(f'<span><div class="dot" style="background:{cores_equipe[i%len(cores_equipe)]}"></div>Equipe {i+1}</span>' for i in range(stats['equipes']))}
</div>
<div style="margin-top:16px;font-size:11px;color:#999;text-align:center">
Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')} · ConstruData SABESP v5.0 · FCN Construções e Saneamento
</div>
</body></html>"""

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)


def _gerar_project_xml(tarefas, stats, out_path):
    """Gera MS Project XML com 1 tarefa por NS."""
    tasks_xml = ""
    uid = 1
    for t in tarefas:
        dur_h = t["dias"] * 8
        tasks_xml += f"""
    <Task>
      <UID>{uid}</UID>
      <ID>{uid}</ID>
      <Name>{t['nome']}: {t['pv_ini']} ao {t['pv_fim']} | DN{t['dn_mm']} | {t['ext_m']:.0f}m</Name>
      <Start>{t['inicio'].strftime('%Y-%m-%dT08:00:00')}</Start>
      <Finish>{t['fim'].strftime('%Y-%m-%dT17:00:00')}</Finish>
      <Duration>PT{dur_h}H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
      <OutlineLevel>1</OutlineLevel>
      <Priority>500</Priority>
      <Notes>Equipe {t['equipe']} | {t['material']} | R$ {t['custo']:,.2f} | {t['rua']}</Notes>
    </Task>"""
        uid += 1

    xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Cronograma NS — {stats['nucleo']}</Name>
  <Company>FCN Construções e Saneamento</Company>
  <Author>ConstruData SABESP v5.0</Author>
  <CreationDate>{datetime.now().isoformat()}</CreationDate>
  <StartDate>{stats['data_inicio']}T08:00:00</StartDate>
  <CalendarUID>1</CalendarUID>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Padrão</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <WeekDays>
        <WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>
        <WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay>
      </WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>0</UID><ID>0</ID><Name>{stats['nucleo']}</Name>
      <OutlineLevel>0</OutlineLevel><Summary>1</Summary>
    </Task>{tasks_xml}
  </Tasks>
</Project>"""

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(xml)


# ═══════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    # Teste rápido com JSON extraído
    json_path = sys.argv[1] if len(sys.argv) > 1 else "_tmp_dwg/REDE_EXTRAIDA_BIM.json"

    if not Path(json_path).exists():
        print(f"Uso: python gerar_cronograma_ns.py <rede.json>")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    pvs = data.get("pvs", {})
    trechos = data.get("trechos", [])
    nucleo = data.get("arquivo", "Teste")

    resultado = gerar_cronograma_ns(
        pvs, trechos, nucleo,
        pasta_saida="SAIDA_BIM_SABESP/CRONOGRAMA_NS",
        equipes=4,
    )
    print(f"\nResultado: {resultado['stats']}")
