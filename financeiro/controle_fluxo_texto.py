"""Preencher com Texto para controle de obra e fluxo projetado."""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import date
from typing import Any

from campo.texto_operacional import _data, _float, _kv, _nucleo_do_texto
from core.construdata_offline import create_entity, get_project, list_entity

ORIGEM = "texto_controle_fluxo"

MESES = {
    "jan": 1, "janeiro": 1, "fev": 2, "fevereiro": 2, "mar": 3, "marco": 3,
    "abr": 4, "abril": 4, "mai": 5, "maio": 5, "jun": 6, "junho": 6,
    "jul": 7, "julho": 7, "ago": 8, "agosto": 8, "set": 9, "setembro": 9,
    "out": 10, "outubro": 10, "nov": 11, "novembro": 11, "dez": 12, "dezembro": 12,
}

SECOES = {
    "controle": ("controle de obra", "controle", "pendencias", "tarefas"),
    "fixos": ("custos fixos", "custo fixo", "fixos"),
    "diretos": ("custos diretos", "custo direto", "diretos"),
    "indiretos": ("custos indiretos", "custo indireto", "indiretos"),
    "variaveis": ("custos variaveis", "custo variavel", "variaveis", "custos variáveis"),
    "medicao": ("medicao prevista", "medicao", "medicoes", "faturamento", "medição prevista"),
    "recebimento": ("recebimento previsto", "recebimento", "recebimentos"),
    "desvios": ("desvios", "desvio", "riscos", "risco"),
    "observacoes": ("observacoes", "observacao", "obs", "observações"),
}


def _norm(text: str) -> str:
    table = str.maketrans("áàãâéêíóôõúçÁÀÃÂÉÊÍÓÔÕÚÇ", "aaaaeeioooucAAAAEEIOOOUC")
    return text.translate(table).lower().strip()


def _linhas(texto: str) -> list[str]:
    return [l.strip() for l in texto.replace("\r", "\n").split("\n") if l.strip()]


def _linhas_secao(lines: list[str], key: str) -> list[str]:
    out: list[str] = []
    ativo = False
    starts = tuple(_norm(x) for x in SECOES[key])
    stops = tuple(_norm(x) for vals in SECOES.values() for x in vals)
    for line in lines:
        cab = _norm(line.split(":", 1)[0].strip(" -"))
        atual = any(cab.startswith(s) for s in starts)
        header = any(cab.startswith(s) for s in stops)
        if ativo and header and not atual:
            break
        if atual:
            ativo = True
            val = line.split(":", 1)[1].strip() if ":" in line else ""
            if val:
                out.append(val)
            continue
        if ativo:
            out.append(line.strip("- ").strip())
    return [x for x in out if x]


def _valor_linha(line: str) -> float:
    m = re.search(r"r\$\s*(-?\d[\d.]*,\d{1,2}|-?\d+(?:[.,]\d+)?)", line, re.I)
    if m:
        return _float(m.group(1))
    nums = re.findall(r"-?\d+(?:[.,]\d+)?", re.sub(r"\d{1,2}/\d{1,2}/\d{2,4}", "", line))
    return _float(nums[-1]) if nums else 0.0


def _data_linha(line: str, default: date) -> date:
    m = re.search(r"\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4}", line)
    if m:
        return _data(m.group(0))
    m = re.search(r"\b([a-zç]{3,9})\s*/\s*(20\d{2})\b", _norm(line))
    if m and m.group(1) in MESES:
        return date(int(m.group(2)), MESES[m.group(1)], 1)
    return default


def _prazo_linha(line: str) -> str | None:
    m = re.search(r"\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4}", line)
    return _data(m.group(0)).isoformat() if m else None


def _limpa(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip("- ")).strip()


def _prioridade(line: str) -> str:
    n = _norm(line)
    if any(x in n for x in ("critico", "urgente", "atraso", "bloqueio", "risco alto")):
        return "ALTA"
    if any(x in n for x in ("medio", "media", "atenção", "atencao")):
        return "MEDIA"
    return "NORMAL"


def _lancamentos(lines: list[str], categoria: str, sinal: int, data_ref: date) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in lines:
        valor = _valor_linha(line)
        if not valor:
            continue
        rows.append({
            "data": _data_linha(line, data_ref).isoformat(),
            "categoria": categoria,
            "descricao": _limpa(line),
            "valor": abs(valor) * sinal,
            "origem": ORIGEM,
        })
    return rows


def _tarefas(lines: list[str], responsavel: str, setor: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in lines:
        titulo = _limpa(line)
        if not titulo:
            continue
        rows.append({
            "titulo": titulo,
            "responsavel": responsavel,
            "status": "PENDENTE",
            "prioridade": _prioridade(line),
            "setor": setor,
            "origem": ORIGEM,
            "prazo": _prazo_linha(line),
        })
    return rows


def parse_texto_controle_fluxo(texto: str, project: Any | None = None) -> dict[str, Any]:
    lines = _linhas(texto)
    project = project or type("P", (), {"nucleo": "REDE", "responsavel": "Campo"})()
    data_ref = _data(_kv(lines, ["data", "data base", "dia"]) or date.today().isoformat())
    responsavel = _kv(lines, ["responsavel", "engenheiro", "gestor"]) or getattr(project, "responsavel", "") or "Campo"
    lancamentos: list[dict[str, Any]] = []
    lancamentos += _lancamentos(_linhas_secao(lines, "fixos"), "Custo fixo projetado", -1, data_ref)
    lancamentos += _lancamentos(_linhas_secao(lines, "diretos"), "Custo direto projetado", -1, data_ref)
    lancamentos += _lancamentos(_linhas_secao(lines, "indiretos"), "Custo indireto projetado", -1, data_ref)
    lancamentos += _lancamentos(_linhas_secao(lines, "variaveis"), "Custo variavel projetado", -1, data_ref)
    lancamentos += _lancamentos(_linhas_secao(lines, "medicao"), "Medicao prevista", 1, data_ref)
    lancamentos += _lancamentos(_linhas_secao(lines, "recebimento"), "Recebimento previsto", 1, data_ref)
    tarefas = _tarefas(_linhas_secao(lines, "controle"), responsavel, "Controle de obra")
    riscos = _tarefas(_linhas_secao(lines, "desvios"), responsavel, "Desvios / riscos")
    return {
        "data": data_ref.isoformat(),
        "nucleo": _nucleo_do_texto(project, texto),
        "responsavel": responsavel,
        "lancamentos": lancamentos,
        "tarefas": tarefas,
        "riscos": riscos,
        "observacoes": "\n".join(_linhas_secao(lines, "observacoes")) or texto[:3000],
    }


def _row_dict(row: Any) -> dict[str, Any]:
    return {col.name: getattr(row, col.name) for col in row.__table__.columns}


def fluxo_projetado(project_id: str) -> dict[str, Any]:
    meses: dict[str, dict[str, Any]] = defaultdict(lambda: {"receitas": 0.0, "custos": 0.0, "saldo": 0.0, "itens": 0})
    por_categoria: dict[str, float] = defaultdict(float)
    rows = []
    for row in list_entity("custos", project_id):
        item = _row_dict(row)
        if item.get("origem") != ORIGEM:
            continue
        valor = float(item.get("valor") or 0)
        data = item.get("data") or date.today()
        mes = data.strftime("%Y-%m") if hasattr(data, "strftime") else str(data)[:7]
        bucket = meses[mes]
        bucket["receitas"] += max(valor, 0)
        bucket["custos"] += abs(min(valor, 0))
        bucket["saldo"] += valor
        bucket["itens"] += 1
        por_categoria[str(item.get("categoria") or "Sem categoria")] += valor
        rows.append(item)
    meses_out = [{"mes": k, **v} for k, v in sorted(meses.items())]
    total_receitas = round(sum(m["receitas"] for m in meses_out), 2)
    total_custos = round(sum(m["custos"] for m in meses_out), 2)
    return {
        "origem": ORIGEM,
        "lancamentos": rows,
        "meses": meses_out,
        "por_categoria": [{"categoria": k, "valor": round(v, 2)} for k, v in sorted(por_categoria.items())],
        "resumo": {
            "receitas_previstas": total_receitas,
            "custos_projetados": total_custos,
            "saldo_projetado": round(total_receitas - total_custos, 2),
            "lancamentos": len(rows),
        },
    }


def aplicar_texto_controle_fluxo(project_id: str, texto: str) -> dict[str, Any]:
    project = get_project(project_id=project_id)
    parsed = parse_texto_controle_fluxo(texto, project)
    created: dict[str, list[int]] = {"custos": [], "tarefas": [], "agenda": [], "lps": []}
    for item in parsed["lancamentos"]:
        cid = create_entity("custos", project.id, item)
        created["custos"].append(cid)
        if item["categoria"] in {"Medicao prevista", "Recebimento previsto"}:
            aid = create_entity("agenda", project.id, {
                "data": item["data"],
                "titulo": f"{item['categoria']}: {item['descricao']}",
                "responsavel": parsed["responsavel"],
                "status": "PENDENTE",
            })
            created["agenda"].append(aid)
    for item in parsed["tarefas"]:
        created["tarefas"].append(create_entity("tarefas", project.id, item))
    for item in parsed["riscos"]:
        created["tarefas"].append(create_entity("tarefas", project.id, item))
        created["lps"].append(create_entity("lps", project.id, {
            "titulo": item["titulo"],
            "responsavel": item["responsavel"],
            "status": "ABERTA",
            "prioridade": item["prioridade"],
            "data_alvo": item.get("prazo"),
            "origem": ORIGEM,
        }))
    return {"ok": True, "parsed": parsed, "created": created, "fluxo": fluxo_projetado(project.id)}
