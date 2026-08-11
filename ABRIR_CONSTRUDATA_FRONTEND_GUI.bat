@echo off
title ConstruData Frontend Real
cd /d "%~dp0"
python abrir_construdata_frontend_gui.py
if errorlevel 1 pause
