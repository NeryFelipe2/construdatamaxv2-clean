"""
routes_analytics.py — Endpoints de analytics, ML e IA avançada.
Integra construdata_analytics, slnr_mestre_ml, motor_gemini, motor_llm.
"""
from __future__ import annotations

import sys
import traceback
from pathlib import Path

from fastapi import APIRouter, Form, File, UploadFile
from fastapi.responses import JSONResponse

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

router = APIRouter(prefix="/api/analytics", tags=["Analytics & ML"])


@router.get("/dashboard")
def analytics_dashboard():
    """Retorna dados consolidados para o dashboard analytics."""
    try:
        from motores.construdata_analytics import gerar_dashboard_data
        dados = gerar_dashboard_data()
        return JSONResponse(content={"status": "ok", "dashboard": dados})
    except ImportError:
        return JSONResponse(content={
            "status": "ok",
            "dashboard": {
                "motores_disponiveis": _contar_motores(),
                "geradores_disponiveis": _contar_geradores(),
                "msg": "Analytics engine disponível mas precisa de dados processados."
            }
        })
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


@router.post("/classificar-rede")
async def classificar_rede(arquivo_json: UploadFile = File(...)):
    """Classifica tipo de rede usando ML."""
    try:
        import json
        from motores.ml_classificador import classificar
        
        content = await arquivo_json.read()
        dados = json.loads(content)
        resultado = classificar(dados)
        return JSONResponse(content={"status": "ok", "classificacao": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"ML classificador não disponível: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)


@router.post("/gemini/analisar")
async def gemini_analisar(
    prompt: str = Form(...),
    contexto: str = Form(""),
):
    """Análise via Gemini AI com contexto de obra."""
    try:
        from motores.motor_gemini import analisar_com_gemini
        resultado = analisar_com_gemini(prompt=prompt, contexto=contexto)
        return JSONResponse(content={"status": "ok", "resposta": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Motor Gemini não disponível: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


@router.post("/llm/multi-provider")
async def llm_multi_provider(
    prompt: str = Form(...),
    provider: str = Form("gemini"),
    contexto: str = Form(""),
):
    """Análise via LLM multi-provider (Gemini, Groq, Mistral, Cohere)."""
    try:
        from motores.motor_llm import analisar
        resultado = analisar(prompt=prompt, provider=provider, contexto=contexto)
        return JSONResponse(content={"status": "ok", "provider": provider, "resposta": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Motor LLM não disponível: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


@router.post("/perdas/calcular")
async def calcular_perdas(
    nucleo: str = Form("SLNR Santos"),
    arquivo_json: UploadFile = File(None),
):
    """Calcula perdas de rede usando motor_perdas."""
    try:
        from motores.motor_perdas import calcular_perdas as calc
        
        dados = {}
        if arquivo_json:
            import json
            content = await arquivo_json.read()
            dados = json.loads(content)
        
        resultado = calc(nucleo=nucleo, dados=dados)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Motor perdas não disponível: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


@router.post("/medicao/calcular")
async def calcular_medicao(
    nucleo: str = Form("SLNR Santos"),
    mes: str = Form(""),
):
    """Calcula medição mensal usando motor_medicao."""
    try:
        from motores.motor_medicao import calcular_medicao as calc
        resultado = calc(nucleo=nucleo, mes=mes)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Motor medição não disponível: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


@router.post("/lean-lps/simular")
async def simular_lean_lps(
    nucleo: str = Form("SLNR Santos"),
    semana: int = Form(1),
):
    """Simula Last Planner System."""
    try:
        from motores.motor_lean_lps import simular_lps
        resultado = simular_lps(nucleo=nucleo, semana=semana)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Motor Lean/LPS não disponível: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


@router.post("/microplanejamento")
async def microplanejamento(
    nucleo: str = Form("SLNR Santos"),
    dias: int = Form(7),
):
    """Gera microplanejamento semanal."""
    try:
        from motores.motor_microplanejamento import gerar_microplan
        resultado = gerar_microplan(nucleo=nucleo, dias=dias)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Motor microplanejamento não disponível: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


@router.post("/auditoria")
async def auditoria(
    nucleo: str = Form("SLNR Santos"),
    arquivo_json: UploadFile = File(None),
):
    """Executa auditoria V4 em dados de NS."""
    try:
        from motores.motor_auditoria_v4 import auditar
        
        dados = {}
        if arquivo_json:
            import json
            content = await arquivo_json.read()
            dados = json.loads(content)
        
        resultado = auditar(nucleo=nucleo, dados=dados)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Motor auditoria não disponível: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


@router.post("/custos/estimar")
async def estimar_custos(
    nucleo: str = Form("SLNR Santos"),
):
    """Estima custos usando motor_custo."""
    try:
        from motores.motor_custo import estimar
        resultado = estimar(nucleo=nucleo)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Motor custo não disponível: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


@router.get("/contratos")
def listar_contratos():
    """Lista contratos gerenciados pelo motor_contratos."""
    try:
        from motores.motor_contratos import listar
        resultado = listar()
        return JSONResponse(content={"status": "ok", "contratos": resultado})
    except ImportError:
        # Fallback: listar dados do diretório dados_contrato
        dados_path = REPO / "dados_contrato"
        if dados_path.exists():
            arquivos = [f.name for f in dados_path.iterdir() if f.is_file()]
            return JSONResponse(content={"status": "ok", "contratos": arquivos})
        return JSONResponse(content={"status": "ok", "contratos": []})
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _contar_motores() -> int:
    p = REPO / "motores"
    return len(list(p.glob("*.py"))) - 1 if p.exists() else 0  # -1 for __init__

def _contar_geradores() -> int:
    p = REPO / "geradores"
    return len(list(p.glob("gerar_*.py"))) if p.exists() else 0
