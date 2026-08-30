@echo off
REM ====================================================================
REM  DEPLOY WCR — ConstruData
REM  Roda: preview primeiro (teste), depois produção
REM  Rode NESTA PASTA: C:\Users\felip\Desktop\_ORGANIZADO\21-CONSTRUDATA\construdatamaxv2-clean-estabiliza\
REM ====================================================================

setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo === [1/5] Conferindo Vercel CLI ===
vercel --version || (echo CLI nao instalado. Instale: npm i -g vercel && exit /b 1)

echo.
echo === [2/5] Login no Vercel (abre navegador) ===
vercel login
if errorlevel 1 (
    echo LOGIN FALHOU. Refaca manualmente e rode este script de novo.
    exit /b 1
)

echo.
echo === [3/5] Linkando ao projeto construdatamaxv2-clean ===
vercel link --yes
if errorlevel 1 (
    echo LINK FALHOU. Verifique team_id/project_id no HANDOFF e tente de novo.
    exit /b 1
)

echo.
echo === [4/5] Deploy PREVIEW (URL temporaria de teste) ===
vercel deploy --yes
if errorlevel 1 (
    echo DEPLOY PREVIEW FALHOU. Veja o erro acima. NAO prossegue pra prod.
    exit /b 1
)

echo.
echo === Conferir preview no navegador ANTES de subir pra producao ===
echo    - Projetos visiveis: Boi Malhado / Sakura / Retorno (SEM Santos)
echo    - Mapa mostra rede real do Boi Malhado (Sao Paulo Zona Norte)
echo.
set /p CONFIRMO="Preview OK? (s/N): "
if /I not "%CONFIRMO%"=="s" (
    echo Deploy cancelado pelo usuario. Preview continua no ar pra testes.
    exit /b 0
)

echo.
echo === [5/5] Deploy PRODUCAO (troca o site live) ===
vercel deploy --prod --yes
if errorlevel 1 (
    echo DEPLOY PROD FALHOU. Veja o erro acima.
    exit /b 1
)

echo.
echo === DEPLOY CONCLUIDO ===
echo URL: https://construdatamaxv2-clean.vercel.app
echo.
echo PROXIMOS PASSOS MANUAIS (UI do navegador):
echo   - Login no Supabase (dashboard.supabase.com)
echo   - Se projeto pausado: clicar Restore project
echo   - SQL Editor: rodar frontend\supabase-schema.sql  (se tabelas nao existirem)
echo   - SQL Editor: rodar frontend\wcr_supabase.sql     (dados reais 11-21/06)
echo.
echo SEGURANCA (docs/DEPLOY_HANDOFF.md):
echo   - Rotacionar: GitHub PAT, OpenAI key, Gemini key, senha DATABASE_URL
echo.

endlocal
</content>
</invoke>