@echo off
setlocal
set "SCRIPT=%~dp0windows_autopilot.py"
where py >nul 2>nul
if errorlevel 1 (
    python "%SCRIPT%" %*
) else (
    py -3 "%SCRIPT%" %*
)
exit /b %errorlevel%
