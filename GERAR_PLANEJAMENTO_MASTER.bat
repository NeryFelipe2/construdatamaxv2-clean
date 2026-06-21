@echo off
REM Abre o botao standalone para gerar a planilha-mestre de planejamento.
cd /d "%~dp0"
python -m planejamento.gui_master
pause
