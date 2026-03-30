@echo off
chcp 65001 >nul
REM ================================================================
REM EXECUTAR ANALYTICS - GERA XLSX + JSON + GRAFICOS
REM Contrato 11481051 · FCN Construções · SLNR Santos
REM ================================================================

echo.
echo ================================================================
echo  ANALYTICS ML — XGBoost + GridSearchCV
echo ================================================================
echo.

echo [1/3] Verificando se Excel esta aberto...
tasklist /FI "IMAGENAME eq EXCEL.EXE" 2>nul | find "EXCEL.EXE" >nul
if %ERRORLEVEL%==0 (
    echo  ATENCAO: Excel esta aberto!
    echo  FECHE O ARQUIVO ANALYTICS_SLNR.xlsx antes de continuar!
    echo.
    pause
) else (
    echo  OK - Excel nao esta aberto
)

echo.
echo [2/3] Deletando arquivos antigos...
if exist "analiticos\ANALYTICS_SLNR.xlsx" (
    del "analiticos\ANALYTICS_SLNR.xlsx" /Q
    echo  OK - XLSX antigo removido
)
if exist "analiticos\ANALYTICS_SLNR.json" (
    del "analiticos\ANALYTICS_SLNR.json" /Q
    echo  OK - JSON antigo removido
)

echo.
echo [3/3] Executando Analytics ML...
echo.

cd "C:\Users\felip\Downloads\NOVA NS Versao 5"
python construdata_analytics.py --output analiticos

echo.
echo ================================================================
echo  CONCLUIDO!
echo  Planilha: analiticos\ANALYTICS_SLNR.xlsx
echo  Graficos: analiticos\graficos\
echo ================================================================
echo.

REM Aguardar 2 segundos e abrir pasta
timeout /t 2 /nobreak >nul
if exist "analiticos\ANALYTICS_SLNR.xlsx" (
    echo Abrindo pasta de saida...
    explorer analiticos
)

echo.
pause
