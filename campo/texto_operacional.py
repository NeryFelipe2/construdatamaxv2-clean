"""Parser unico para texto colado de RDO, planejamento, custos e desvios."""
from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any

from api.operational import calcular_metricas_desvio, classificar_severidade, gerar_desvios_rdo, log_operational_event, tentar_xgboost
from campo.rdo_engine import RDOEngine
from core.construdata_offline import create_entity, get_project
from core.database import get_session
from core.models import DesvioPlanejamento, PlanejamentoItem, PlanejamentoSemanal, RDO, StatusPlanejamento

NI = "Nao informado"


def _norm(text: str) -> str:
    table = str.maketrans("áàãâéêíóôõúçÁÀÃÂÉÊÍÓÔÕÚÇ", "aaaaeeioooucAAAAEEIOOOUC")
    return text.translate(table).lower()


def _float(value: Any) -> float:
    try:
        if isinstance(value, (int, float)):
            return float(value)
        s = re.sub(r"[^\d,.\-]", "", str(value or ""))
        if "," in s:
            s = s.replace(".", "").replace(",", ".")
        return float(s) if s not in {"", "-", "."} else 0.0
    except Exception:
        return 0.0


def _data(value: str | None) -> date:
    text = str(value or "").strip()
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        return date.fromisoformat(m.group(0))
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", text)
    if m:
        year = int(m.group(3))
        if year < 100:
            year += 2000
        return date(year, int(m.group(2)), int(m.group(1)))
    return date.today()


def _kv(lines: list[str], keys: list[str]) -> str:
    wanted = [_norm(k) for k in keys]
    for line in lines:
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        if _norm(k).strip() in wanted:
            return v.strip()
    return ""


def _nucleo_do_texto(project: Any, text: str) -> str:
    n = _norm(text)
    if "cesario" in n or "cesario lange" in n:
        return "CESARIO_LANGE"
    if "porangaba" in n:
        return "PORANGABA"
    if "sao roque" in n or "sao-roque" in n:
        return "SAO_ROQUE"
    if "morro do teteu" in n or "teteu" in n or "rk_sub" in n or "subempreita" in n:
        return "RK_SUB"
    return getattr(project, "nucleo", "") or "REDE"


def _linhas_secao(lines: list[str], nomes: tuple[str, ...]) -> list[str]:
    out: list[str] = []
    ativo = False
    starts = tuple(_norm(x) for x in nomes)
    stop = ("rdo", "producao", "produção", "mao de obra", "mão de obra", "equipe", "equipamentos", "custos", "planejamento", "desvios", "ocorrencias", "ocorrências", "paralisacoes", "paralisações")
    for line in lines:
        key = _norm(line.split(":", 1)[0].strip())
        is_current = any(key.startswith(s) for s in starts)
        is_header = any(key.startswith(s) for s in stop)
        if ativo and is_header and not is_current:
            break
        if is_current:
            ativo = True
            val = line.split(":", 1)[1].strip() if ":" in line else ""
            if val:
                out.append(val)
            continue
        if ativo and line.strip():
            out.append(line.strip("- ").strip())
    return out


def _itens_quantidade(lines: list[str], default_desc: str = "Producao executada") -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for line in lines:
        raw = line.strip("- ").strip()
        if not raw:
            continue
        m = re.search(r"(\d+(?:[.,]\d+)?)\s*(m2|m²|m|un|und|unid|h|hr|vb|kg|sc)\b", raw, re.I)
        qtd = _float(m.group(1)) if m else 1.0
        unidade = (m.group(2).lower().replace("und", "un").replace("unid", "un") if m else "un")
        desc = re.sub(r"^\d+(?:[.,]\d+)?\s*(m2|m²|m|un|und|unid|h|hr|vb|kg|sc)\s+", "", raw, flags=re.I).strip()
        if not desc:
            desc = default_desc
        dn = 0
        dn_m = re.search(r"dn\s*([0-9]+)|([0-9]+)\s*mm", raw, re.I)
        if dn_m:
            dn = int(dn_m.group(1) or dn_m.group(2))
        items.append({"servico": desc, "quantidade": qtd, "unidade": unidade, "dn_mm": dn})
    return items


def _equipe(lines: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in lines:
        raw = line.strip()
        if ":" in raw:
            funcao, qtd_raw = raw.split(":", 1)
            qtd = int(_float(qtd_raw))
        else:
            m = re.search(r"(\d+)\s+(.+)|(.+?)\s+(\d+)$", raw, re.I)
            if not m:
                continue
            qtd = int(_float(m.group(1) or m.group(4)))
            funcao = m.group(2) or m.group(3) or ""
        funcao = str(funcao).strip(" -:")
        if qtd > 0 and funcao:
            rows.append({"funcao": funcao, "qtd": qtd})
    return rows


def _custos(lines: list[str]) -> dict[str, float]:
    labels = {
        "mao_obra": ("mao de obra", "mão de obra", "mo"),
        "equipamentos": ("equipamento", "maquina", "máquina"),
        "materiais": ("material", "materiais"),
        "direto": ("direto", "custos diretos"),
        "indireto": ("indireto", "custos indiretos"),
        "total": ("total", "total dia", "custo total"),
    }
    out = {k: 0.0 for k in labels}
    for line in lines:
        n = _norm(line)
        valor = _float(line)
        if not valor:
            continue
        for key, names in labels.items():
            if any(name in n for name in names):
                out[key] += valor
                break
    if not out["total"]:
        out["total"] = sum(v for k, v in out.items() if k != "total")
    return out


def _desvios(lines: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in lines:
        n = _norm(line)
        meta = _float(re.search(r"meta[:\s]+([\d.,]+)", n).group(1)) if re.search(r"meta[:\s]+([\d.,]+)", n) else 0.0
        real = _float(re.search(r"(realizado|feito|executado)[:\s]+([\d.,]+)", n).group(2)) if re.search(r"(realizado|feito|executado)[:\s]+([\d.,]+)", n) else 0.0
        if not meta and not real:
            nums = re.findall(r"\d+(?:[.,]\d+)?", line)
            if len(nums) >= 2:
                meta, real = _float(nums[0]), _float(nums[1])
        if meta or real:
            atividade = re.split(r"meta|realizado|feito|executado", line, flags=re.I)[0].strip(" :-") or "Desvio informado por texto"
            rows.append({"atividade": atividade, "meta": meta, "realizado": real, "descricao": line})
    return rows


def parse_texto_operacional(texto: str, project: Any | None = None) -> dict[str, Any]:
    lines = [l.strip() for l in texto.replace("\r", "\n").split("\n") if l.strip()]
    project = project or type("P", (), {"nucleo": "REDE"})()
    data_ref = _data(_kv(lines, ["data", "dia"]))
    producao = _itens_quantidade(_linhas_secao(lines, ("producao", "produção", "atividades", "servicos", "serviços")))
    materiais = _itens_quantidade(_linhas_secao(lines, ("material", "materiais")), "Material aplicado")
    planejamento = _itens_quantidade(_linhas_secao(lines, ("planejamento", "plano semanal", "planejamento semanal")), "Atividade planejada")
    equipe = _equipe(_linhas_secao(lines, ("mao de obra", "mão de obra", "equipe", "pessoal")))
    equipamentos = _itens_quantidade(_linhas_secao(lines, ("equipamentos", "maquinas", "máquinas")), "Equipamento")
    custos = _custos(_linhas_secao(lines, ("custos", "custo")))
    desvios = _desvios(_linhas_secao(lines, ("desvios", "desvio")))
    ocorrencias = _linhas_secao(lines, ("ocorrencias", "ocorrências"))
    paralisacoes = _linhas_secao(lines, ("paralisacoes", "paralisações", "paradas"))
    responsavel = _kv(lines, ["responsavel", "responsável", "engenheiro", "lider", "líder", "apontador"]) or getattr(project, "responsavel", "") or "Campo"
    clima = _kv(lines, ["clima", "tempo"]) or "Bom"
    if not producao and materiais:
        producao = materiais
    return {
        "data": data_ref.isoformat(),
        "nucleo": _nucleo_do_texto(project, texto),
        "responsavel": responsavel,
        "clima": clima,
        "equipe": equipe,
        "producao": producao,
        "materiais": materiais,
        "equipamentos": equipamentos,
        "custos": custos,
        "planejamento": planejamento,
        "desvios": desvios,
        "ocorrencias": ocorrencias,
        "paralisacoes": paralisacoes,
        "observacoes": texto[:3000],
    }


def payload_frontend_para_operacional(project: Any, payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data") or payload.get("date") or date.today().isoformat()
    raw = payload.get("payload_original") if isinstance(payload.get("payload_original"), dict) else payload
    services = raw.get("services") or []
    materiais = payload.get("materiais") or []
    producao = []
    for item in [*services, *materiais]:
        if not isinstance(item, dict):
            continue
        producao.append({
            "servico": item.get("description") or item.get("descricao") or item.get("servico") or "Producao executada",
            "quantidade": item.get("quantity") or item.get("quantidade") or 0,
            "unidade": item.get("unit") or item.get("unidade") or "m",
            "custo_total": item.get("custo_total") or 0,
        })
    if payload.get("producao_m") and not producao:
        producao.append({"servico": payload.get("producao") or "Producao executada", "quantidade": payload.get("producao_m"), "unidade": "m"})
    equipe = []
    for item in payload.get("mao_obra") or []:
        if isinstance(item, dict):
            equipe.append({"funcao": item.get("funcao") or item.get("tipo") or "Mao de obra", "qtd": item.get("qtd") or item.get("quantidade") or 0})
    manpower = raw.get("manpower") or {}
    for key, label in [("foremanCount", "Encarregado"), ("officialCount", "Oficial"), ("helperCount", "Ajudante"), ("operatorCount", "Operador")]:
        if manpower.get(key):
            equipe.append({"funcao": label, "qtd": manpower[key]})
    custos = {
        "mao_obra": _float(payload.get("custo_mao_obra")),
        "equipamentos": _float(payload.get("custo_equipamentos") or raw.get("equipmentCostBRL") or raw.get("machineCostBRL")),
        "materiais": _float(payload.get("custo_materiais")),
        "direto": _float(payload.get("custo_direto") or raw.get("directCostBRL")),
        "indireto": _float(payload.get("custo_indireto") or raw.get("indirectCostBRL")),
        "total": _float(payload.get("custo_total_dia") or raw.get("dailyCostBRL")),
    }
    if not custos["total"]:
        custos["total"] = sum(v for k, v in custos.items() if k != "total")
    return {
        "data": data,
        "nucleo": payload.get("nucleo") or project.nucleo,
        "responsavel": payload.get("apontador") or payload.get("engenheiro") or raw.get("responsible") or project.responsavel or "Campo",
        "clima": payload.get("clima") or "Bom",
        "equipe": equipe,
        "producao": producao,
        "materiais": materiais,
        "equipamentos": payload.get("equipamentos") or payload.get("maquinas") or raw.get("equipment") or [],
        "custos": custos,
        "planejamento": payload.get("planejamento") or [],
        "desvios": payload.get("desvios") or [],
        "ocorrencias": [payload.get("ocorrencias") or raw.get("incidents") or ""],
        "paralisacoes": [payload.get("paralisacoes") or raw.get("stoppageNotes") or ""],
        "observacoes": payload.get("observacoes") or raw.get("observations") or "",
    }


def _criar_plano_e_desvios(project: Any, parsed: dict[str, Any], rdo_id: int) -> tuple[int | None, list[dict[str, Any]]]:
    data_ref = _data(parsed["data"])
    semana_inicio = data_ref - timedelta(days=data_ref.weekday())
    semana_fim = semana_inicio + timedelta(days=6)
    created: list[dict[str, Any]] = []
    plan_id: int | None = None
    with get_session() as session:
        plano = None
        if parsed.get("planejamento") or parsed.get("desvios"):
            plano = PlanejamentoSemanal(
                nucleo=parsed["nucleo"],
                semana_inicio=semana_inicio,
                semana_fim=semana_fim,
                engenheiro=parsed["responsavel"],
                responsavel=parsed["responsavel"],
                status=StatusPlanejamento.ATIVO,
                observacao="Criado automaticamente por Preencher com Texto",
            )
            session.add(plano)
            session.flush()
            plan_id = plano.id
            for item in parsed.get("planejamento") or [{"servico": d.get("atividade", "Planejamento por desvio"), "quantidade": d.get("meta") or 0, "unidade": "m"} for d in parsed.get("desvios", [])]:
                session.add(PlanejamentoItem(
                    planejamento_id=plano.id,
                    atividade=item.get("servico") or item.get("atividade") or "Atividade planejada",
                    meta_quantidade=_float(item.get("quantidade") or item.get("meta")),
                    unidade=item.get("unidade") or "m",
                    equipe_prevista=0,
                    custo_previsto=_float(item.get("custo_total")),
                    data_inicio=semana_inicio,
                    data_fim=semana_fim,
                    restricoes="[]",
                ))
            session.flush()
        for d in parsed.get("desvios") or []:
            meta = _float(d.get("meta"))
            realizado = _float(d.get("realizado"))
            met = calcular_metricas_desvio(meta, realizado)
            desvio = DesvioPlanejamento(
                planejamento_id=plan_id or plano.id,
                rdo_id=rdo_id,
                atividade=d.get("atividade") or "Desvio informado por texto",
                meta=meta,
                realizado=realizado,
                desvio_quantidade=met["desvio_quantidade"],
                desvio_percentual=met["desvio_percentual"],
                desvio_custo=met["desvio_custo"],
                severidade=classificar_severidade(met["desvio_percentual"]),
                spi=met["spi"],
                cpi=met["cpi"],
                ppc=met["ppc"],
                acao_recomendada=d.get("descricao") or "Replanejar atividade e validar causa com engenheiro.",
            )
            session.add(desvio)
            session.flush()
            created.append(desvio.to_dict())
        if plan_id:
            created.extend(gerar_desvios_rdo(session, rdo_id, parsed["nucleo"], data_ref))
            log_operational_event(session, "texto_operacional", "texto_operacional_processado", nucleo=parsed["nucleo"], project_id=project.id, payload={"rdo_id": rdo_id, "planejamento_id": plan_id, "desvios": len(created)})
    return plan_id, created


def aplicar_operacional(project_id: str, parsed: dict[str, Any]) -> dict[str, Any]:
    project = get_project(project_id=project_id)
    servicos = parsed.get("producao") or parsed.get("materiais") or []
    payload = {
        "data": parsed["data"],
        "nucleo": parsed["nucleo"],
        "responsavel": parsed["responsavel"],
        "clima": parsed["clima"],
        "observacoes": parsed.get("observacoes") or "Criado por texto operacional",
        "equipe": parsed.get("equipe") or [],
        "ocorrencias": [{"tipo": "outro", "descricao": x} for x in parsed.get("ocorrencias", []) if x],
        "paralisacoes": [{"tipo": "parada", "descricao": x} for x in parsed.get("paralisacoes", []) if x],
        "servicos": {"texto": servicos},
    }
    rdo = RDOEngine().criar_rdo_completo(payload)
    rdo_id = int(rdo["id"])
    custos = parsed.get("custos") or {}
    total = _float(custos.get("total"))
    if total:
        with get_session() as session:
            row = session.get(RDO, rdo_id)
            if row:
                row.total_custo = total
    for item in parsed.get("equipe") or []:
        create_entity("mao_obra", project.id, {"nome": f"RDO #{rdo_id} - {item.get('funcao')}", "funcao": item.get("funcao"), "quantidade": item.get("qtd") or 0, "custo_dia": 0})
    for item in parsed.get("equipamentos") or []:
        create_entity("equipamentos", project.id, {"nome": item.get("servico") or item.get("name") or "Equipamento", "tipo": "Equipamento", "custo_dia": item.get("custoBRL") or item.get("custo_total") or 0})
    for item in servicos:
        create_entity("suprimentos", project.id, {"item": item.get("servico") or "Material/producao", "categoria": "Texto RDO", "quantidade": item.get("quantidade") or 0, "unidade": item.get("unidade") or "un", "custo_previsto": item.get("custo_total") or 0})
    for key, label in [("mao_obra", "Mao de obra"), ("equipamentos", "Equipamentos"), ("materiais", "Materiais"), ("direto", "Direto"), ("indireto", "Indireto"), ("total", "Total RDO")]:
        if _float(custos.get(key)):
            create_entity("custos", project.id, {"data": parsed["data"], "categoria": label, "descricao": f"RDO #{rdo_id} - {label}", "valor": _float(custos[key]), "origem": "texto_operacional"})
    plan_id, desvios = _criar_plano_e_desvios(project, parsed, rdo_id)
    if not plan_id:
        with get_session() as session:
            desvios.extend(gerar_desvios_rdo(session, rdo_id, parsed["nucleo"], _data(parsed["data"])))
    ml = None
    if desvios:
        with get_session() as session:
            ml = tentar_xgboost(session, parsed["nucleo"])
    return {"ok": True, "rdo": RDOEngine().obter_rdo(rdo_id), "parsed": parsed, "planejamento_id": plan_id, "desvios": desvios, "ml": ml}


def aplicar_texto_operacional(project_id: str, texto: str) -> dict[str, Any]:
    project = get_project(project_id=project_id)
    return aplicar_operacional(project_id, parse_texto_operacional(texto, project))
