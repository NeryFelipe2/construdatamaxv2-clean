@echo off
setlocal
title ConstruData v10 - GUI Atualizada
color 0A
cd /d "%~dp0"
set PYTHONUTF8=1
cls

echo.
echo  ================================================================
echo   ConstruData v10 - GUI Atualizada
echo   FCN Construcoes e Saneamento - Contrato 11481051
echo   NS + RDO + API local + Campo + Cadastro
echo  ================================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Python nao encontrado no PATH.
    echo.
    pause
    exit /b 1
)

echo  [1/5] Preparando diretorios de runtime...
python -X utf8 -c "from core.config import ensure_runtime_dirs; ensure_runtime_dirs()" >nul 2>&1
if errorlevel 1 (
    echo        [ERRO] Falha ao carregar a configuracao do projeto.
    echo        Tente manualmente: python -X utf8 construdata_gui.py
    echo.
    pause
    exit /b 1
)
echo        OK

echo  [2/5] Stack GUI + API...
python -X utf8 -c "import fastapi, uvicorn, sqlalchemy, reportlab" >nul 2>&1
if errorlevel 1 (
    echo        Instalando fastapi uvicorn sqlalchemy reportlab...
    python -m pip install fastapi uvicorn sqlalchemy reportlab
)
echo        OK

echo  [3/5] Dependencias base...
python -X utf8 -c "import ezdxf, matplotlib, openpyxl, networkx, pyproj" >nul 2>&1
if errorlevel 1 (
    echo        Instalando ezdxf matplotlib openpyxl networkx pyproj...
    python -m pip install ezdxf matplotlib openpyxl networkx pyproj
)
echo        OK

echo  [4/5] GIS + mapa...
python -X utf8 -c "import geopandas, pyogrio, tkintermapview, contextily" >nul 2>&1
if errorlevel 1 (
    echo        Instalando geopandas pyogrio shapely numpy scipy tkintermapview contextily...
    python -m pip install geopandas pyogrio shapely numpy scipy tkintermapview contextily
)
echo        OK

echo  [5/5] Abrindo GUI...
echo        A API local sera iniciada sob demanda em http://127.0.0.1:8787
echo.

python -X utf8 construdata_gui.py

if errorlevel 1 (
    echo.
    echo  [ERRO] Falha ao abrir a GUI atualizada.
    echo  Tente manualmente: python -X utf8 construdata_gui.py
    echo.
    pause
    exit /b 1
)

endlocal
