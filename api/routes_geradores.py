"""
routes_geradores.py — Endpoints para executar geradores de NS, cronograma, OSE, trechos, etc.
"""
from __future__ import annotations

import sys
import tempfile
import traceback
from pathlib import Path

from fastapi import APIRouter, HTTPException, Form, File, UploadFile
from fastapi.responses import FileResponse, JSONResponse

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

router = APIRouter(prefix="/api/geradores", tags=["Geradores"])


@router.post("/gerar-ns")
async def gerar_ns(
    nucleo: str = Form("SLNR Santos"),
    arquivo_json: UploadFile = File(None),
):
    """Gera Notas de Serviço a partir de dados processados."""
    try:
        from geradores.gerar_ns import gerar_notas_servico
        
        if arquivo_json:
            import json
            content = await arquivo_json.read()
            dados = json.loads(content)
        else:
            dados = {}
        
        resultado = gerar_notas_servico(nucleo=nucleo, dados=dados)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Gerador não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)


@router.post("/gerar-cronograma")
async def gerar_cronograma(
    nucleo: str = Form("SLNR Santos"),
    arquivo_json: UploadFile = File(None),
):
    """Gera cronograma CPM a partir de dados de trechos."""
    try:
        from geradores.gerar_cronograma import gerar_cronograma_completo
        
        if arquivo_json:
            import json
            content = await arquivo_json.read()
            dados = json.loads(content)
        else:
            dados = {}
        
        resultado = gerar_cronograma_completo(nucleo=nucleo, dados=dados)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Gerador não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)


@router.post("/gerar-medicao-curva-s")
async def gerar_medicao_curva_s(
    nucleo: str = Form("SLNR Santos"),
):
    """Gera medição e curva S."""
    try:
        from geradores.gerar_medicao_curva_s import gerar_medicao
        resultado = gerar_medicao(nucleo=nucleo)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Gerador não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)


@router.post("/gerar-ose")
async def gerar_ose(
    nucleo: str = Form("SLNR Santos"),
):
    """Gera Ordem de Serviço de Execução."""
    try:
        from geradores.gerar_ose import gerar_ose_completa
        resultado = gerar_ose_completa(nucleo=nucleo)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Gerador não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)


@router.post("/gerar-trechos")
async def gerar_trechos(
    nucleo: str = Form("SLNR Santos"),
    modo: str = Form("completo"),
):
    """Gera trechos de rede (completo, recortados, inferidos, mega)."""
    try:
        gerador_map = {
            "completo": "gerar_trechos_completo",
            "recortados": "gerar_trechos_recortados",
            "inferidos": "gerar_trechos_inferidos",
            "mega": "gerar_trechos_mega",
        }
        mod_name = gerador_map.get(modo, "gerar_trechos_completo")
        mod = __import__(f"geradores.{mod_name}", fromlist=["gerar"])
        resultado = mod.gerar(nucleo=nucleo)
        return JSONResponse(content={"status": "ok", "modo": modo, "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Gerador não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)


@router.post("/gerar-ifc")
async def gerar_ifc(
    nucleo: str = Form("SLNR Santos"),
):
    """Gera arquivo IFC LOD500 a partir de dados processados."""
    try:
        from geradores.gerar_ifc_lod500 import gerar_ifc
        resultado = gerar_ifc(nucleo=nucleo)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Gerador não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)


@router.post("/gerar-cadastro-nts292")
async def gerar_cadastro(nucleo: str = Form("SLNR Santos")):
    """Gera cadastro NTS 292 (padrão SABESP)."""
    try:
        from geradores.gerar_cadastro_nts292 import gerar_cadastro_completo
        resultado = gerar_cadastro_completo(nucleo=nucleo)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Gerador não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)


@router.post("/gerar-planilha-mega")
async def gerar_planilha_mega(nucleo: str = Form("SLNR Santos")):
    """Gera planilha MEGA consolidada."""
    try:
        from geradores.gerar_planilha_mega import gerar_mega
        resultado = gerar_mega(nucleo=nucleo)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Gerador não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)


@router.post("/gerar-compras")
async def gerar_compras(nucleo: str = Form("SLNR Santos")):
    """Gera lista de compras de materiais."""
    try:
        from geradores.gerar_compras import gerar_lista_compras
        resultado = gerar_lista_compras(nucleo=nucleo)
        return JSONResponse(content={"status": "ok", "resultado": resultado})
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Gerador não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)
