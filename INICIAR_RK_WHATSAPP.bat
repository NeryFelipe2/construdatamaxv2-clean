@echo off
echo ============================================
echo RK WHATSAPP ROUTER - INICIALIZACAO COMPLETA
echo Versao Lingma China v1.0
echo ============================================
echo.

echo [1/5] Verificando Docker...
docker --version
if errorlevel 1 (
    echo ERRO: Docker nao encontrado! Instale Docker Desktop primeiro.
    pause
    exit /b 1
)
echo OK: Docker encontrado
echo.

echo [2/5] Parando containers antigos...
docker-compose -f docker-compose-rk-whatsapp.yml down 2>nul
echo.

echo [3/5] Iniciando n8n + Evolution API + PostgreSQL + Redis...
docker-compose -f docker-compose-rk-whatsapp.yml up -d
echo.

echo [4/5] Aguardando servicos inicializarem (30 segundos)...
timeout /t 30 /nobreak >nul
echo.

echo [5/5] Verificando status dos containers...
docker ps --filter "name=rk-whatsapp"
echo.

echo ============================================
echo SERVICOS INICIADOS COM SUCESSO!
echo ============================================
echo.
echo Acesse:
echo   - n8n: http://localhost:5678
echo   - Evolution API: http://localhost:8080
echo.
pause
