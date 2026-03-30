@echo off
REM ═══════════════════════════════════════════════════════════
REM  EXPORTAR_PIPE_NETWORKS.bat
REM  Duplo-clique e vai embora — exporta LandXML dos DWGs
REM  automaticamente via Civil 3D sem clicar em nada.
REM ═══════════════════════════════════════════════════════════

echo.
echo  ██████╗  ██████╗ ███╗   ██╗███████╗████████╗██████╗ ██╗   ██╗
echo ██╔════╝ ██╔═══██╗████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██║   ██║
echo ██║      ██║   ██║██╔██╗ ██║███████╗   ██║   ██████╔╝██║   ██║
echo ██║      ██║   ██║██║╚██╗██║╚════██║   ██║   ██╔══██╗██║   ██║
echo ╚██████╗ ╚██████╔╝██║ ╚████║███████║   ██║   ██║  ██║╚██████╔╝
echo  ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝
echo.
echo  Exportador de Pipe Networks — ConstruData SABESP v6
echo  Vai abrir o Civil 3D, exportar os XMLs e fechar sozinho.
echo.

REM ─── Configuração ───────────────────────────────────────
SET PASTA=%~dp0
SET DWG1=%PASTA%PROLONGAMENTO_TETEU_ALT-01.dwg
SET DWG2=%PASTA%PROLONGAMENTO_PANTANAL_BAIXO.dwg

REM Detectar Civil 3D (tenta 2025, 2024, 2023, 2022)
SET C3D=
FOR %%V IN (2025 2024 2023 2022 2021 2020 2019 2018) DO (
    IF EXIST "C:\Program Files\Autodesk\AutoCAD %%V\acad.exe" (
        SET C3D=C:\Program Files\Autodesk\AutoCAD %%V\acad.exe
        echo  Civil 3D encontrado: %%V
        GOTO :FOUND
    )
)
echo  ERRO: Civil 3D nao encontrado!
echo  Verifique se esta instalado em C:\Program Files\Autodesk\
pause
exit /b 1

:FOUND
echo.

REM ─── Criar script SCR para cada DWG ────────────────────
REM O .scr roda automaticamente dentro do Civil 3D

REM --- Script 1: Teteu ---
echo _LANDXMLOUT > "%PASTA%_export_teteu.scr"
echo "%PASTA%PROLONGAMENTO_TETEU_ALT-01_REDE.xml" >> "%PASTA%_export_teteu.scr"
echo. >> "%PASTA%_export_teteu.scr"
echo _QUIT >> "%PASTA%_export_teteu.scr"
echo Y >> "%PASTA%_export_teteu.scr"

REM --- Script 2: Pantanal ---
echo _LANDXMLOUT > "%PASTA%_export_pantanal.scr"
echo "%PASTA%PROLONGAMENTO_PANTANAL_BAIXO_REDE.xml" >> "%PASTA%_export_pantanal.scr"
echo. >> "%PASTA%_export_pantanal.scr"
echo _QUIT >> "%PASTA%_export_pantanal.scr"
echo Y >> "%PASTA%_export_pantanal.scr"

REM ─── Executar ──────────────────────────────────────────

IF EXIST "%DWG1%" (
    echo  [1/2] Exportando Teteu...
    echo        Abrindo Civil 3D — AGUARDE, nao mexa no mouse.
    start /wait "" "%C3D%" "%DWG1%" /b "%PASTA%_export_teteu.scr"
    IF EXIST "%PASTA%PROLONGAMENTO_TETEU_ALT-01_REDE.xml" (
        echo        OK! XML exportado.
    ) ELSE (
        echo        AVISO: XML nao gerado. Tente manualmente:
        echo        Output ^> Export to LandXML
    )
) ELSE (
    echo  [1/2] PULANDO — DWG nao encontrado: %DWG1%
)

echo.

IF EXIST "%DWG2%" (
    echo  [2/2] Exportando Pantanal Prolongamento...
    echo        Abrindo Civil 3D — AGUARDE.
    start /wait "" "%C3D%" "%DWG2%" /b "%PASTA%_export_pantanal.scr"
    IF EXIST "%PASTA%PROLONGAMENTO_PANTANAL_BAIXO_REDE.xml" (
        echo        OK! XML exportado.
    ) ELSE (
        echo        AVISO: XML nao gerado. Tente manualmente:
        echo        Output ^> Export to LandXML
    )
) ELSE (
    echo  [2/2] PULANDO — DWG nao encontrado: %DWG2%
)

REM ─── Limpar scripts temporários ────────────────────────
DEL /Q "%PASTA%_export_teteu.scr" 2>nul
DEL /Q "%PASTA%_export_pantanal.scr" 2>nul

REM ─── Verificar resultados ──────────────────────────────
echo.
echo  ═══════════════════════════════════════════════════════
echo   RESULTADO:
echo  ═══════════════════════════════════════════════════════

SET COUNT=0
IF EXIST "%PASTA%PROLONGAMENTO_TETEU_ALT-01_REDE.xml" (
    SET /A COUNT+=1
    echo   [OK] PROLONGAMENTO_TETEU_ALT-01_REDE.xml
) ELSE (
    echo   [!!] Teteu: XML NAO gerado
)
IF EXIST "%PASTA%PROLONGAMENTO_PANTANAL_BAIXO_REDE.xml" (
    SET /A COUNT+=1
    echo   [OK] PROLONGAMENTO_PANTANAL_BAIXO_REDE.xml
) ELSE (
    echo   [!!] Pantanal: XML NAO gerado
)

echo.
IF %COUNT% GTR 0 (
    echo   Agora manda os XMLs pro Claude!
    echo   Ou roda: python gerar_ns.py ^<arquivo.xml^>
) ELSE (
    echo   NENHUM XML foi gerado.
    echo   Abre cada DWG manualmente no Civil 3D e faz:
    echo     Output ^> Export to LandXML ^> marca Pipe Network ^> OK
)
echo.
echo  ═══════════════════════════════════════════════════════
pause
