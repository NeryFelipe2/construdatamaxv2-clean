"""XGBoost operacional por responsavel usando RDOs ja importados."""
from __future__ import annotations

import json
import re
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from xgboost import XGBRegressor

from core.database import get_session
from core.models import MLExecucao, RDO

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "RELATORIO_XGBOOST_ICARO_IGOR_20260426.json"
OUT_MD = ROOT / "GUIA_FLUXO_OPERACIONAL_XGBOOST_20260426.md"
OUT_PDF = ROOT / "GUIA_FLUXO_OPERACIONAL_XGBOOST_20260426.pdf"

RESPONSAVEIS = {
    "ICARO": {
        "label": "Icaro - Tatui / Cesario Lange / Porangaba / Sao Roque",
        "nucleos": ["CESARIO_LANGE", "PORANGABA", "SAO_ROQUE"],
    },
    "IGOR": {
        "label": "Igor - Morro do Teteu / RK_SUB",
        "nucleos": ["RK_SUB"],
    },
}

FEATURES = [
    "rdo_count",
    "equipe_qtd",
    "custo_total",
    "bloqueio_score",
    "atividade_score",
    "dn_media",
    "dia_semana",
    "dia_mes",
    "mes",
    "prev1",
    "rolling3",
    "rolling7",
]

BLOQUEIOS = (
    "nao teve", "não teve", "falta", "paralis", "chuva", "problema", "aguard",
    "documentacao", "documentação", "seguranca", "segurança", "sem atividade",
)
ATIVIDADE = (
    "inicio", "início", "execucao", "execução", "assentamento", "escavacao",
    "escavação", "reaterro", "caixa", "pv", "ramal", "ligacao", "ligação",
)


def _float(value: Any) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _text_metros(text: str) -> float:
    total = 0.0
    for m in re.finditer(r"(?<!dn)\b(\d+(?:[,.]\d+)?)\s*m\b(?!m)", text, re.I):
        around = text[max(0, m.start() - 16):m.end() + 16].lower()
        if " x " in around or "dimens" in around:
            continue
        val = _float(m.group(1).replace(",", "."))
        if 0 < val < 1000:
            total += val
    return total


def _dn_media(text: str) -> float:
    vals = [_float(x) for x in re.findall(r"\bdn\s*(\d{2,4})", text, re.I)]
    return round(sum(vals) / len(vals), 2) if vals else 0.0


def _score(text: str, termos: tuple[str, ...]) -> int:
    n = text.lower()
    return sum(1 for termo in termos if termo in n)


def _dataset(nucleos: list[str]) -> pd.DataFrame:
    rows: dict[date, dict[str, Any]] = {}
    with get_session() as session:
        rdos = session.execute(
            select(RDO)
            .options(selectinload(RDO.apontamentos), selectinload(RDO.equipe), selectinload(RDO.ocorrencias))
            .where(RDO.nucleo.in_(nucleos))
            .order_by(RDO.data)
        ).scalars().all()
        for rdo in rdos:
            row = rows.setdefault(rdo.data, {
                "data": rdo.data,
                "rdo_count": 0,
                "producao_m": 0.0,
                "producao_un": 0.0,
                "producao_etapa": 0.0,
                "producao_texto_m": 0.0,
                "equipe_qtd": 0,
                "custo_total": 0.0,
                "bloqueio_score": 0,
                "atividade_score": 0,
                "dn_vals": [],
                "nucleos": set(),
            })
            row["rdo_count"] += 1
            row["nucleos"].add(rdo.nucleo)
            row["custo_total"] += _float(rdo.total_custo)
            texto = " ".join(
                [rdo.observacoes or ""]
                + [a.servico or "" for a in (rdo.apontamentos or [])]
                + [o.descricao or "" for o in (rdo.ocorrencias or [])]
            )
            row["producao_texto_m"] += _text_metros(texto)
            row["bloqueio_score"] += _score(texto, BLOQUEIOS)
            row["atividade_score"] += _score(texto, ATIVIDADE)
            dn = _dn_media(texto)
            if dn:
                row["dn_vals"].append(dn)
            for e in rdo.equipe or []:
                row["equipe_qtd"] += int(e.quantidade or 0)
            for a in rdo.apontamentos or []:
                unidade = str(a.unidade or "").lower()
                qtd = _float(a.quantidade)
                if unidade in {"m", "metro", "metros"}:
                    row["producao_m"] += qtd
                elif unidade in {"un", "und", "unid"}:
                    row["producao_un"] += qtd
                elif unidade in {"etapa", "atividade"}:
                    row["producao_etapa"] += qtd
                row["custo_total"] += _float(a.custo_total)
                if a.dn_mm:
                    row["dn_vals"].append(_float(a.dn_mm))
    if not rows:
        return pd.DataFrame()
    data = []
    for row in sorted(rows.values(), key=lambda x: x["data"]):
        m = row["producao_m"] if row["producao_m"] else row["producao_texto_m"]
        data.append({
            "data": row["data"],
            "nucleos": ", ".join(sorted(row["nucleos"])),
            "rdo_count": row["rdo_count"],
            "producao_m": round(m, 3),
            "producao_un": round(row["producao_un"], 3),
            "producao_etapa": round(row["producao_etapa"], 3),
            "producao_equiv": round(m + row["producao_un"] + row["producao_etapa"], 3),
            "equipe_qtd": row["equipe_qtd"],
            "custo_total": round(row["custo_total"], 2),
            "bloqueio_score": row["bloqueio_score"],
            "atividade_score": row["atividade_score"],
            "dn_media": round(sum(row["dn_vals"]) / len(row["dn_vals"]), 2) if row["dn_vals"] else 0.0,
        })
    df = pd.DataFrame(data)
    df["dia_semana"] = pd.to_datetime(df["data"]).dt.weekday
    df["dia_mes"] = pd.to_datetime(df["data"]).dt.day
    df["mes"] = pd.to_datetime(df["data"]).dt.month
    df["prev1"] = df["producao_equiv"].shift(1).fillna(0)
    df["rolling3"] = df["producao_equiv"].rolling(3, min_periods=1).mean().shift(1).fillna(0)
    df["rolling7"] = df["producao_equiv"].rolling(7, min_periods=1).mean().shift(1).fillna(0)
    return df


def _treinar(df: pd.DataFrame) -> dict[str, Any]:
    if df.empty:
        return {"ok": False, "erro": "Sem RDOs importados."}
    y = df["producao_equiv"].astype(float)
    X = df[FEATURES].astype(float).fillna(0)
    n = len(df)
    if n < 8 or y.nunique() <= 1:
        pred = float(y.tail(7).mean() if len(y) else 0)
        return {
            "ok": True,
            "algoritmo": "media_movel_sem_amostras_suficientes",
            "amostras": n,
            "mae": None,
            "r2": None,
            "previsao_proximo_dia": round(pred, 2),
            "confianca": round(min(n / 30, 1.0) * (0.4 if y.nunique() <= 1 else 0.6), 2),
            "importancias": [],
        }
    split = max(1, int(n * 0.75))
    if split >= n:
        split = n - 1
    model = XGBRegressor(
        n_estimators=160,
        max_depth=3,
        learning_rate=0.06,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
    )
    model.fit(X.iloc[:split], y.iloc[:split])
    pred_test = model.predict(X.iloc[split:])
    yt = y.iloc[split:].to_numpy()
    mae = float(np.mean(np.abs(pred_test - yt))) if len(yt) else 0.0
    r2 = None
    if len(yt) > 1 and float(np.var(yt)) > 0:
        r2 = float(1 - np.sum((yt - pred_test) ** 2) / np.sum((yt - yt.mean()) ** 2))
    last = X.iloc[[-1]].copy()
    next_day = pd.to_datetime(df["data"].max()) + pd.Timedelta(days=1)
    last["dia_semana"] = next_day.weekday()
    last["dia_mes"] = next_day.day
    last["mes"] = next_day.month
    last["prev1"] = float(y.iloc[-1])
    last["rolling3"] = float(y.tail(3).mean())
    last["rolling7"] = float(y.tail(7).mean())
    last["bloqueio_score"] = 0
    pred = max(0.0, float(model.predict(last)[0]))
    importancias = [
        {"feature": f, "peso": round(float(w), 4)}
        for f, w in sorted(zip(FEATURES, model.feature_importances_), key=lambda x: x[1], reverse=True)
        if float(w) > 0
    ][:8]
    variabilidade = min(float(y.std() / (y.mean() + 1e-6)), 1.0) if y.mean() else 0.5
    confianca = min(0.95, max(0.15, (min(n / 45, 1.0) * 0.65) + ((1 - min(mae / (y.mean() + 1e-6), 1)) * 0.25) + variabilidade * 0.1))
    return {
        "ok": True,
        "algoritmo": "XGBRegressor",
        "amostras": n,
        "mae": round(mae, 3),
        "r2": round(r2, 3) if r2 is not None else None,
        "previsao_proximo_dia": round(pred, 2),
        "previsao_7_dias": round(pred * 7, 2),
        "confianca": round(confianca, 2),
        "importancias": importancias,
    }


def rodar_xgboost_responsaveis() -> dict[str, Any]:
    resultados: dict[str, Any] = {}
    with get_session() as session:
        for chave, cfg in RESPONSAVEIS.items():
            df = _dataset(cfg["nucleos"])
            treino = _treinar(df)
            total_m = float(df["producao_m"].sum()) if not df.empty else 0.0
            total_un = float(df["producao_un"].sum()) if not df.empty else 0.0
            total_etapa = float(df["producao_etapa"].sum()) if not df.empty else 0.0
            resultado = {
                "responsavel": cfg["label"],
                "nucleos": cfg["nucleos"],
                "periodo": f"{df['data'].min()} a {df['data'].max()}" if not df.empty else None,
                "rdos": int(df["rdo_count"].sum()) if not df.empty else 0,
                "dias_com_rdo": len(df),
                "total_m": round(total_m, 2),
                "total_un": round(total_un, 2),
                "total_etapa": round(total_etapa, 2),
                "total_equiv": round(total_m + total_un + total_etapa, 2),
                "media_dia_equiv": round(float(df["producao_equiv"].mean()), 2) if not df.empty else 0.0,
                "bloqueios": int(df["bloqueio_score"].sum()) if not df.empty else 0,
                "atividade_score": int(df["atividade_score"].sum()) if not df.empty else 0,
                "modelo": treino,
                "observacao": "Icaro foi enriquecido a partir dos textos dos RDOs: metros, tubos e etapas de caixa/abrigo foram estruturados para o BI." if chave == "ICARO" else "Igor/RK_SUB tem base quantitativa mais forte com metros e unidades estruturadas.",
            }
            resultados[chave] = resultado
            ml = MLExecucao(
                nucleo=f"{chave}_{'_'.join(cfg['nucleos'])[:40]}",
                tipo="xgboost_producao",
                resultado_json=json.dumps(resultado, ensure_ascii=False, default=str),
                n_desvios=resultado["dias_com_rdo"],
                confianca=treino.get("confianca"),
            )
            session.add(ml)
        session.flush()
    payload = {"gerado_em": date.today().isoformat(), "resultados": resultados}
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    _gerar_markdown(payload)
    _gerar_pdf(payload)
    return payload


def _gerar_markdown(payload: dict[str, Any]) -> None:
    linhas = [
        "# Guia Operacional - RDO, Planejamento, Controle e XGBoost",
        "",
        "## Fluxo diario",
        "```mermaid",
        "flowchart LR",
        "A[Engenheiro cola texto] --> B[Preencher com Texto]",
        "B --> C[RDO estruturado]",
        "B --> D[Planejamento semanal]",
        "B --> E[Custos e desvios]",
        "E --> F[Controle de obra]",
        "F --> G[Fluxo trimestral projetado]",
        "C --> H[Base historica]",
        "D --> H",
        "E --> H",
        "G --> H",
        "H --> I[XGBoost por responsavel]",
        "I --> J[Previsao, risco e replanejamento]",
        "```",
        "",
        "## O que alimentar todo dia",
        "- RDO: data, obra, responsavel, producao do dia, equipe, equipamentos, ocorrencias e paralisacoes.",
        "- Planejamento: meta da semana por atividade, quantidade, prazo, equipe prevista e custo previsto.",
        "- Controle: pendencias, riscos, bloqueios, responsavel e prazo.",
        "- Fluxo trimestral: custos fixos, diretos, indiretos, variaveis, medicao prevista e recebimento previsto.",
        "- Desvios: meta x realizado, causa, impacto e acao.",
        "",
        "## Resultado XGBoost",
        "",
    ]
    for chave, r in payload["resultados"].items():
        m = r["modelo"]
        linhas += [
            f"### {r['responsavel']}",
            f"- Periodo: {r['periodo']}",
            f"- RDOs/dias: {r['rdos']} RDOs em {r['dias_com_rdo']} dias",
            f"- Total: {r['total_m']} m, {r['total_un']} un e {r.get('total_etapa', 0)} etapas",
            f"- Algoritmo: {m.get('algoritmo')}",
            f"- Previsao proximo dia: {m.get('previsao_proximo_dia')} unidade equivalente",
            f"- Previsao 7 dias: {m.get('previsao_7_dias')}",
            f"- MAE: {m.get('mae')} | R2: {m.get('r2')} | Confianca: {m.get('confianca')}",
            f"- Observacao: {r['observacao']}",
            "",
        ]
    OUT_MD.write_text("\n".join(linhas), encoding="utf-8")


def _table(data: list[list[Any]], widths: list[float]) -> Table:
    t = Table(data, colWidths=widths)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#123a75")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#c8d2e0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f7fb")]),
    ]))
    return t


def _gerar_pdf(payload: dict[str, Any]) -> None:
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(OUT_PDF), pagesize=A4, rightMargin=1.4*cm, leftMargin=1.4*cm, topMargin=1.1*cm, bottomMargin=1.1*cm)
    story: list[Any] = []
    story.append(Paragraph("Guia Operacional ConstruData - RDO, Planejamento, Controle, Fluxo e XGBoost", styles["Title"]))
    story.append(Paragraph(f"Gerado em {payload['gerado_em']}", styles["Normal"]))
    story.append(Spacer(1, 0.35*cm))
    story.append(Paragraph("Fluxo de uso", styles["Heading2"]))
    fluxo = [
        ["Etapa", "Entrada", "Saida na plataforma"],
        ["1", "Engenheiro cola texto padrao", "Parser identifica obra, data, responsavel e secoes"],
        ["2", "RDO diario", "Producao, equipe, equipamento, custo, ocorrencia e paralisacao"],
        ["3", "Planejamento semanal", "Metas por atividade, prazo, equipe e custo previsto"],
        ["4", "Desvios diarios", "Meta x realizado, severidade, SPI, CPI, PPC e acao"],
        ["5", "Controle/fluxo", "Custos fixos/diretos/indiretos/variaveis, medicao e recebimento"],
        ["6", "XGBoost", "Previsao por responsavel, risco e base para replanejamento"],
    ]
    story.append(_table(fluxo, [1.2*cm, 6.4*cm, 9.0*cm]))
    story.append(Spacer(1, 0.35*cm))
    story.append(Paragraph("Como alimentar o XGBoost", styles["Heading2"]))
    story.append(Paragraph("Todo dia: RDO com producao real, equipe, custo e desvios. Toda semana: planejamento com metas. Todo fechamento: controle financeiro com custos projetados, medicao e recebimento. O modelo usa historico por responsavel para prever producao equivalente e apontar risco de baixa producao.", styles["Normal"]))
    story.append(Spacer(1, 0.35*cm))
    story.append(Paragraph("Resultados Icaro e Igor", styles["Heading2"]))
    rows = [["Responsavel", "RDOs", "Periodo", "Total", "Modelo", "Prev. prox. dia", "Conf."]]
    for r in payload["resultados"].values():
        m = r["modelo"]
        total = f"{r['total_m']} m / {r['total_un']} un / {r.get('total_etapa', 0)} etapas"
        rows.append([r["responsavel"], r["rdos"], r["periodo"], total, m.get("algoritmo"), m.get("previsao_proximo_dia"), m.get("confianca")])
    story.append(_table(rows, [3.8*cm, 1.2*cm, 3.1*cm, 2.4*cm, 3.0*cm, 1.8*cm, 1.2*cm]))
    story.append(Spacer(1, 0.35*cm))
    story.append(Paragraph("Leitura dos modelos", styles["Heading2"]))
    for r in payload["resultados"].values():
        m = r["modelo"]
        story.append(Paragraph(f"<b>{r['responsavel']}</b>: {r['observacao']}", styles["Normal"]))
        if m.get("mae") is not None:
            story.append(Paragraph(f"MAE {m.get('mae')} | R2 {m.get('r2')} | previsao 7 dias {m.get('previsao_7_dias')}.", styles["Normal"]))
        imps = m.get("importancias") or []
        if imps:
            imp_txt = ", ".join(f"{x['feature']}={x['peso']}" for x in imps[:5])
            story.append(Paragraph(f"Principais variaveis: {imp_txt}.", styles["Normal"]))
        story.append(Spacer(1, 0.18*cm))
    doc.build(story)


if __name__ == "__main__":
    print(json.dumps(rodar_xgboost_responsaveis(), ensure_ascii=False, indent=2, default=str))
