@echo off
echo ========================================================
echo   PIPELINE COMPLETO FINANCAS RK - CONSTRUDATAMAX 360
echo ========================================================
echo.
echo [1/3] Sincronizando com Supabase e WhatsApp (n8n)...
python sync_bidirecional.py full

echo.
echo [2/3] Rodando Motor Excel Consolidado (Gera o XLSX)...
python MOTOR_EXCEL_CONSOLIDADO_RK.py

echo.
echo [3/3] Rodando Dashboard Executivo...
python MOTOR_EXCEL_DASHBOARD_RK.py

echo.
echo ========================================================
echo   PIPELINE CONCLUIDO COM SUCESSO!
echo   Arquivo Final Gerado: CONTROLE_CONSOLIDADO_RK.xlsx
echo ========================================================
pause
