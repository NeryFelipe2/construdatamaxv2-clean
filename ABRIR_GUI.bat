@echo off
REM ===========================================================
REM  ABRIR_GUI.bat - CONSTRUDATA HYDRONETWORK V9
REM  Execucao direta na RAIZ do projeto
REM ===========================================================

title ConstruData HydroNetwork v9.0
setlocal enabledelayedexpansion

echo.
echo  Initializing ConstruData v9.0...
echo.

REM Forca o caminho para a raiz onde o .bat esta
cd /d "%~dp0"

REM Tenta encontrar o comando python (python ou python3)
set PY_CMD=none
where python >nul 2>nul && set PY_CMD=python
if "!PY_CMD!"=="none" (
    where python3 >nul 2>nul && set PY_CMD=python3
)

if "!PY_CMD!"=="none" (
    echo [ERRO] Python nao encontrado no PATH do Windows.
    echo Por favor, instale o Python e marque 'Add Python to PATH'.
    echo.
    pause
    exit /b 1
)

REM Define o script alvo e verifica existencia
set SCRIPT=construdata_gui.py
if not exist "%SCRIPT%" set SCRIPT=gui.py

if not exist "%SCRIPT%" (
    echo [ERRO] Script de interface nao encontrado na raiz: %CD%
    echo Esperado: construdata_gui.py ou gui.py
    pause
    exit /b 1
)

echo [OK] Iniciando !PY_CMD! com %SCRIPT%...
!PY_CMD! "%SCRIPT%"

if %ERRORLEVEL% neq 0 (
    echo [CRASH] O programa fechou com erro (codigo !ERRORLEVEL!).
    pause
)