@echo off
title ConstruData - HydroNetwork v9.0 | FCN Construcoes e Saneamento
color 0A
cd /d "%~dp0"
cls

echo.
echo  ================================================================
echo   ####   ###   #  #  ####  #####  ####  #   #  ####  #####  ####
echo   #      #  #  ## #  #       #    #  #  #   #  #  #    #    #
echo   ###    #  #  # ##  ###     #    ####  #   #  #  #    #    ###
echo   #      #  #  #  #  #       #    # #  #   #  #  #    #    #
echo   ####   ###   #  #  ####    #    #  #  ###   ####     #    ####
echo  ================================================================
echo   HydroNetwork v9.0  ^|  FCN Construcoes e Saneamento
echo   SE LIGA NA REDE    ^|  Contrato 11481051  ^|  Santos/SP
echo   NS v9  ^|  BIM LOD500  ^|  Civil 3D  ^|  EPANET  ^|  Gestao
echo  ================================================================
echo   Atualizado: 26/03/2026
echo   Formatos: DXF ^| LandXML ^| DWG (Civil 3D) ^| JSON ^| GPKG
echo   Saidas:   NS + OSE + IFC + Cronograma + Curva S + MEGA
echo  ================================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Python nao encontrado no PATH.
    echo         Baixe em: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo  Verificando dependencias...
echo.

echo  [1/7] Dependencias base...
python -c "import ezdxf, matplotlib, openpyxl, networkx, pyproj" >nul 2>&1
if errorlevel 1 (
    echo         Instalando...
    pip install ezdxf matplotlib openpyxl networkx pyproj -q
)
echo         OK

echo  [2/7] Motor GDAL (DXF/GIS)...
python -c "import geopandas, pyogrio" >nul 2>&1
if errorlevel 1 (
    echo         Instalando geopandas + pyogrio...
    pip install geopandas pyogrio shapely numpy scipy -q
)
echo         OK

echo  [3/7] GUI + Mapa satelite...
python -c "import tkintermapview" >nul 2>&1
if errorlevel 1 pip install tkintermapview -q >nul 2>&1
python -c "import contextily" >nul 2>&1
if errorlevel 1 pip install contextily -q >nul 2>&1
echo         OK

echo  [4/7] PDF + Relatorios...
python -c "import reportlab" >nul 2>&1
if errorlevel 1 pip install reportlab -q >nul 2>&1
echo         OK

echo  [5/7] BIM (IFC LOD500)...
python -c "import ifcopenshell" >nul 2>&1
if errorlevel 1 (
    echo         [!] ifcopenshell nao instalado - IFC desabilitado
) else (
    echo         OK
)

echo  [6/7] COM (Civil 3D / DWG)...
python -c "import win32com.client" >nul 2>&1
if errorlevel 1 (
    echo         [!] pywin32 nao instalado - DWG BIM desabilitado
) else (
    echo         OK
)

echo  [7/7] ML + Analytics...
python -c "import sklearn, xgboost" >nul 2>&1
if errorlevel 1 (
    echo         [!] scikit-learn/xgboost nao instalado - ML desabilitado
) else (
    echo         OK
)

echo.
echo  ================================================================
echo   Iniciando ConstruData - HydroNetwork v9.0...
echo  ================================================================
echo.

python construdata_gui.py

if errorlevel 1 (
    echo.
    echo  ================================================================
    echo   [ERRO] Falha ao iniciar a GUI.
    echo.
    echo   Tente manualmente:
    echo     python construdata_gui.py
    echo.
    echo   Suporte: Felipe Nery - DGS Engenharia / FCN
    echo  ================================================================
    echo.
    pause
)
