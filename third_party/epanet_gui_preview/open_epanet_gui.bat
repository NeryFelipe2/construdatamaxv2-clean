@echo off
setlocal

set "BASE_DIR=%~dp0app"
set "EPANET_GUI=%BASE_DIR%\Epanet2w.exe"

if not exist "%EPANET_GUI%" (
  echo GUI do EPANET nao encontrada em:
  echo   %EPANET_GUI%
  exit /b 1
)

if "%~1"=="" (
  start "" "%EPANET_GUI%"
  exit /b 0
)

start "" "%EPANET_GUI%" "%~1"
exit /b 0
