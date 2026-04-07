"""
routes_engine_v5.py — Expoe o motor ConstruData SABESP V5 via API REST.
Permite processar DXF/DWG/LandXML e retornar NS completas via HTTP.
"""
from __future__ import annotations

import json
import sys
import tempfile
import traceback
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

router = APIRouter(prefix="/api/engine-v5", tags=["Engine V5"])


@router.post("/processar")
async def processar_arquivo(
    arquivo: UploadFile = File(...),
    nucleo: str = Form("SLNR Santos"),
    motor: str = Form("NOVA NS v5 (SABESP)"),
):
    """Processa um arquivo DXF/DWG/LandXML pelo motor ConstruData V5 FINAL."""
    try:
        # Salva upload em temp
        suffix = Path(arquivo.filename or "input.dxf").suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await arquivo.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        # Tenta importar o motor V5
        try:
            from motores.construdata_sabesp_v5_FINAL import processar_arquivo_completo
            resultado = processar_arquivo_completo(str(tmp_path), nucleo=nucleo)
        except ImportError:
            # Fallback: tenta importar do diretório raiz
            try:
                from motores.ConstruData_SABESP_v5 import processar_arquivo_completo
                resultado = processar_arquivo_completo(str(tmp_path), nucleo=nucleo)
            except ImportError:
                raise HTTPException(
                    status_code=500,
                    detail="Motor V5 não encontrado. Verifique se construdata_sabesp_v5_FINAL.py está em motores/"
                )

        return JSONResponse(content={
            "status": "ok",
            "nucleo": nucleo,
            "motor": motor,
            "resultado": resultado if isinstance(resultado, dict) else {"raw": str(resultado)},
        })

    except HTTPException:
        raise
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "detail": str(exc), "traceback": traceback.format_exc()},
        )


@router.get("/status")
def engine_status():
    """Verifica se os motores V5 estão disponíveis."""
    disponivel = {}
    
    motores_check = [
        ("construdata_sabesp_v5_FINAL", "Motor NS V5 Principal (272KB)"),
        ("motor_auditoria_v4", "Motor Auditoria V4"),
        ("motor_custo", "Motor Custos"),
        ("motor_gemini", "Motor Gemini AI"),
        ("motor_lean_lps", "Motor Lean/LPS"),
        ("motor_llm", "Motor LLM Multi-Provider"),
        ("motor_medicao", "Motor Medicao"),
        ("motor_microplanejamento", "Motor Microplanejamento"),
        ("motor_ml", "Motor Machine Learning"),
        ("motor_parametrico", "Motor Parametrico"),
        ("motor_perdas", "Motor Perdas"),
        ("motor_status_ns", "Motor Status NS"),
        ("motor_teteu_esgoto", "Motor Teteu Esgoto"),
        ("motor_contratos", "Motor Contratos"),
        ("construdata_analytics", "Analytics Completo"),
        ("construdata_planner", "Planejador ConstruData"),
        ("construdata_pipeline", "Pipeline ConstruData"),
        ("construdata_integrador", "Integrador ConstruData"),
        ("slnr_mestre_ml", "SLNR Mestre ML (69KB)"),
        ("ml_classificador", "ML Classificador"),
    ]
    
    for mod_name, desc in motores_check:
        try:
            # Check if file exists
            mod_path = REPO / "motores" / f"{mod_name}.py"
            disponivel[mod_name] = {
                "disponivel": mod_path.exists(),
                "descricao": desc,
                "tamanho_kb": round(mod_path.stat().st_size / 1024, 1) if mod_path.exists() else 0,
            }
        except Exception:
            disponivel[mod_name] = {"disponivel": False, "descricao": desc, "tamanho_kb": 0}
    
    # Check geradores
    geradores_path = REPO / "geradores"
    geradores_count = len(list(geradores_path.glob("gerar_*.py"))) if geradores_path.exists() else 0
    
    # Check leitores
    leitores_path = REPO / "leitores"
    leitores_count = len(list(leitores_path.glob("ler_*.py"))) if leitores_path.exists() else 0
    
    # Check processadores
    processadores_path = REPO / "processadores"
    processadores_count = len(list(processadores_path.glob("*.py"))) if processadores_path.exists() else 0
    
    return {
        "motores": disponivel,
        "geradores_count": geradores_count,
        "leitores_count": leitores_count,
        "processadores_count": processadores_count,
        "total_motores_disponiveis": sum(1 for v in disponivel.values() if v["disponivel"]),
        "total_motores": len(disponivel),
    }


@router.get("/listar-geradores")
def listar_geradores():
    """Lista todos os geradores disponíveis."""
    geradores_path = REPO / "geradores"
    if not geradores_path.exists():
        return {"geradores": []}
    
    result = []
    for f in sorted(geradores_path.glob("gerar_*.py")):
        result.append({
            "nome": f.stem,
            "arquivo": f.name,
            "tamanho_kb": round(f.stat().st_size / 1024, 1),
        })
    return {"geradores": result}


@router.get("/listar-leitores")
def listar_leitores():
    """Lista todos os leitores DXF/DWG/LandXML disponíveis."""
    leitores_path = REPO / "leitores"
    if not leitores_path.exists():
        return {"leitores": []}
    
    result = []
    for f in sorted(leitores_path.glob("*.py")):
        if f.name == "__init__.py":
            continue
        result.append({
            "nome": f.stem,
            "arquivo": f.name,
            "tamanho_kb": round(f.stat().st_size / 1024, 1),
        })
    return {"leitores": result}
