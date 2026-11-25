@echo off
cd /d "%~dp0"
wscript.exe //B //NoLogo "%~dp0launch_gui.vbs" "%~dp0run_gui.pyw"
exit /b
