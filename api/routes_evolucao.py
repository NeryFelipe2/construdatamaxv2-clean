"""Rotas Evolucao 360: consolidacao tipo Palantir da operacao."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from campo.evolucao_platform import executar_ciclo_evolucao, resumo_evolucao

router = APIRouter(tags=["evolucao360"])


@router.get("/api/evolucao")
def api_evolucao_resumo(nucleo: str = Query(default="")):
    return resumo_evolucao(nucleo=nucleo)


@router.get("/api/evolucao/predicao")
def api_evolucao_predicao(nucleo: str = Query(default="")):
    resumo = resumo_evolucao(nucleo=nucleo)
    return {"ok": True, "nucleo": resumo["nucleo"], "predicao": resumo["predicao"], "decisao_recomendada": resumo["decisao_recomendada"]}


@router.get("/api/evolucao/ontologia")
def api_evolucao_ontologia(nucleo: str = Query(default="")):
    resumo = resumo_evolucao(nucleo=nucleo)
    return {"ok": True, "nucleo": resumo["nucleo"], "ontologia": resumo["ontologia"]}


@router.post("/api/evolucao/{nucleo}/executar-ciclo")
def api_evolucao_executar_ciclo(nucleo: str):
    resultado = executar_ciclo_evolucao(nucleo)
    if not resultado.get("ok"):
        raise HTTPException(status_code=400, detail=resultado.get("erro") or "Falha ao executar ciclo")
    return resultado
