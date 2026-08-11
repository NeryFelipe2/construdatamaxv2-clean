@echo off
chcp 65001 >nul
REM ================================================================
REM ABRIR SLNR MESTRE UNIFICADO
REM ================================================================

echo.
echo ================================================================
echo  SLNR MESTRE UNIFICADO — PLANILHA COMPLETA
echo  12 Núcleos + 115 Fórmulas + Machine Learning
echo ================================================================
echo.

if exist "saida_hydronetwork\slnr_mestre\SLNR_MESTRE_UNIFICADO_ML.xlsx" (
    echo Abrindo planilha gerada...
    start "" "saida_hydronetwork\slnr_mestre\SLNR_MESTRE_UNIFICADO_ML.xlsx"
    echo.
    echo ✅ Planilha aberta!
) else if exist "dados_contrato\SLNR_MESTRE_MODELO.xlsx" (
    echo Planilha gerada não encontrada.
    echo Abrindo modelo...
    start "" "dados_contrato\SLNR_MESTRE_MODELO.xlsx"
    echo.
    echo ℹ️ Para gerar a planilha completa:
    echo    1. Abra construdata_gui.py
    echo    2. Vá em IA → SLNR MESTRE
    echo    3. Clique em "📊 GERAR SLNR ML"
) else (
    echo ❌ Erro: Nenhuma planilha encontrada!
    echo.
    echo Execute primeiro a plataforma para gerar a planilha.
)

echo.
pause
