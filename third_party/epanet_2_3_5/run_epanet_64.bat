@echo off
setlocal

set "BASE_DIR=%~dp0"
set "EPANET_EXE=%BASE_DIR%win_release\64bit\runepanet.exe"
set "DEFAULT_INP=%BASE_DIR%source\example-networks\Net1.inp"

if not exist "%EPANET_EXE%" (
  echo EPANET nao encontrado em:
  echo   %EPANET_EXE%
  exit /b 1
)

if "%~1"=="" (
  echo Uso:
  echo   %~nx0 arquivo.inp [arquivo.rpt] [arquivo.bin]
  echo.
  echo Exemplo automatico com Net1:
  echo   %~nx0 "%DEFAULT_INP%"
  echo.
  echo Rodando o exemplo padrao Net1...
  "%EPANET_EXE%" "%DEFAULT_INP%" "%BASE_DIR%Net1.rpt" "%BASE_DIR%Net1.bin"
  exit /b %errorlevel%
)

set "INP=%~1"
set "RPT=%~2"
set "BIN=%~3"

if "%RPT%"=="" set "RPT=%~dpn1.rpt"

if "%BIN%"=="" (
  "%EPANET_EXE%" "%INP%" "%RPT%"
) else (
  "%EPANET_EXE%" "%INP%" "%RPT%" "%BIN%"
)

exit /b %errorlevel%
