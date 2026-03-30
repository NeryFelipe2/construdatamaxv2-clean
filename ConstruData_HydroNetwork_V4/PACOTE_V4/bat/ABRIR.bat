@echo off
chcp 65001 >nul
title ConstruData BIM v6 — SLNR Santos — SABESP CT 11481051

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║  ConstruData BIM v6 — Pipeline Completo             ║
echo ║  SE LIGA NA REDE — Santos/SP                        ║
echo ║  Contrato 11481051 — SABESP                         ║
echo ╚══════════════════════════════════════════════════════╝
echo.

REM Verificar Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado. Instale Python 3.10+
    pause
    exit /b 1
)

REM Instalar dependencias
echo Verificando dependencias...
pip install ezdxf geopandas scipy pyproj --quiet 2>nul

echo.
echo Escolha uma opcao:
echo.
echo   [1] Pipeline completo (DXF/XML -^> NS + Cadastro + BIM + Project)
echo   [2] Abrir GUI no navegador
echo   [3] Processar todos DXFs da pasta PROJETOS
echo   [4] Sair
echo.

set /p opcao="> "

if "%opcao%"=="1" (
    echo.
    set /p arquivo="Caminho do DXF/XML: "
    set /p nucleo="Nome do nucleo: "
    python construdata_pipeline.py "%arquivo%" --nucleo "%nucleo%"
    pause
)

if "%opcao%"=="2" (
    start construdata_gui.html
)

if "%opcao%"=="3" (
    echo.
    echo Processando todos os DXFs...
    for %%f in (PROJETOS\*.dxf) do (
        echo.
        echo === Processando %%f ===
        python construdata_pipeline.py "%%f"
    )
    for %%f in (PROJETOS\*.xml) do (
        echo.
        echo === Processando %%f ===
        python construdata_pipeline.py "%%f"
    )
    echo.
    echo Pronto! Verifique as pastas SAIDA_*
    pause
)

if "%opcao%"=="4" exit /b 0
