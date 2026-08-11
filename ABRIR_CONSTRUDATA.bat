@echo off
title ConstruData - HydroNetwork v8.0
color 0A
cd /d "%~dp0"

echo.
echo  ===========================================================
echo    ConstruData - HydroNetwork v8.0
echo    FCN Construcoes e Saneamento
echo    SE LIGA NA REDE - Contrato 11481051 - Santos/SP
echo  -----------------------------------------------------------
echo    Atualizado: 26/03/2026
echo    Aceita: DWG (Civil 3D) / DXF / LandXML / JSON
echo    Saida: NS + IFC + Cronograma + Compras + Medicao
echo  ===========================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Python nao encontrado no PATH.
    echo  Baixe em: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo  [1/6] Dependencias base...
python -c "import ezdxf, matplotlib, openpyxl, networkx, pyproj" >nul 2>&1
if errorlevel 1 (
    echo        Instalando...
    pip install ezdxf matplotlib openpyxl networkx pyproj
)
echo        OK

echo  [2/6] Motor GDAL (leitura DXF/GIS)...
python -c "import geopandas, pyogrio" >nul 2>&1
if errorlevel 1 (
    echo        Instalando geopandas + pyogrio...
    pip install geopandas pyogrio shapely numpy scipy
)
echo        OK

echo  [3/6] GUI + Mapa satelite...
python -c "import tkintermapview" >nul 2>&1
if errorlevel 1 pip install tkintermapview >nul 2>&1
python -c "import contextily" >nul 2>&1
if errorlevel 1 pip install contextily >nul 2>&1
echo        OK

echo  [4/6] PDF relatorios...
python -c "import reportlab" >nul 2>&1
if errorlevel 1 pip install reportlab >nul 2>&1
echo        OK

echo  [5/6] BIM (IFC)...
python -c "import ifcopenshell" >nul 2>&1
if errorlevel 1 (
    echo        [!] ifcopenshell nao instalado - IFC desabilitado
) else (
    echo        OK
)

echo  [6/6] COM (Civil 3D DWG)...
python -c "import win32com.client" >nul 2>&1
if errorlevel 1 (
    echo        [!] pywin32 nao instalado - DWG BIM desabilitado
) else (
    echo        OK
)

echo.
echo  ===========================================================
echo   Abrindo ConstruData v8.0...
echo  ===========================================================
echo.

python construdata_gui.py

if errorlevel 1 (
    echo.
    echo  [ERRO] Falha ao abrir a GUI.
    echo  Tente manualmente: python construdata_gui.py
    echo.
    pause
)
