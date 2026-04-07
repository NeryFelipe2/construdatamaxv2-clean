"""
routes_leitores.py — Endpoints para leitura de DXF, DWG, LandXML.
Expoe ler_dwg_universal, ler_dxf_gdal, ler_dxf_prosaneamento, ler_landxml.
"""
from __future__ import annotations

import sys
import tempfile
import traceback
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, Form
from fastapi.responses import JSONResponse

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

router = APIRouter(prefix="/api/leitores", tags=["Leitores DXF/DWG"])


@router.post("/ler-dxf")
async def ler_dxf(
    arquivo: UploadFile = File(...),
    motor: str = Form("gdal"),
):
    """Lê arquivo DXF usando motor selecionado (gdal ou prosaneamento)."""
    try:
        suffix = Path(arquivo.filename or "input.dxf").suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await arquivo.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        if motor == "prosaneamento":
            from leitores.ler_dxf_prosaneamento import extrair_rede
        else:
            from leitores.ler_dxf_gdal import extrair_rede
        
        resultado = extrair_rede(str(tmp_path))
        
        # Converter para serializable
        if hasattr(resultado, 'to_dict'):
            resultado = resultado.to_dict()
        
        return JSONResponse(content={
            "status": "ok",
            "motor": motor,
            "resultado": resultado if isinstance(resultado, (dict, list)) else {"raw": str(resultado)[:5000]},
        })
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Leitor não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)


@router.post("/ler-dwg")
async def ler_dwg(
    arquivo: UploadFile = File(...),
    modo: str = Form("universal"),
):
    """Lê arquivo DWG usando leitor universal, AEC ou BIM."""
    try:
        suffix = Path(arquivo.filename or "input.dwg").suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await arquivo.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        if modo == "aec":
            from leitores.ler_dwg_aec import extrair_rede
        elif modo == "bim":
            from leitores.LER_DWG_BIM import extrair_rede
        else:
            from leitores.ler_dwg_universal import extrair_rede
        
        resultado = extrair_rede(str(tmp_path))
        
        if hasattr(resultado, 'to_dict'):
            resultado = resultado.to_dict()
        
        return JSONResponse(content={
            "status": "ok",
            "modo": modo,
            "resultado": resultado if isinstance(resultado, (dict, list)) else {"raw": str(resultado)[:5000]},
        })
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Leitor não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)


@router.post("/ler-landxml")
async def ler_landxml(
    arquivo: UploadFile = File(...),
):
    """Lê arquivo LandXML."""
    try:
        suffix = Path(arquivo.filename or "input.xml").suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await arquivo.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        from leitores.ler_landxml import extrair_rede
        resultado = extrair_rede(str(tmp_path))
        
        if hasattr(resultado, 'to_dict'):
            resultado = resultado.to_dict()
        
        return JSONResponse(content={
            "status": "ok",
            "resultado": resultado if isinstance(resultado, (dict, list)) else {"raw": str(resultado)[:5000]},
        })
    except ImportError as e:
        return JSONResponse(content={"status": "error", "detail": f"Leitor não encontrado: {e}"}, status_code=404)
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status_code=500)
