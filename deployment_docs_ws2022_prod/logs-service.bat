@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0\.."
set "OUT_LOG=%cd%\logs\backend-service-out.log"
set "ERR_LOG=%cd%\logs\backend-service-error.log"

echo.
echo ========================================
echo Backend Service Logs
echo ========================================
echo.
echo OUT: %OUT_LOG%
echo ERR: %ERR_LOG%
echo.

powershell -NoProfile -Command "if (Test-Path '%OUT_LOG%') { Write-Host '--- LAST 100 OUT LINES ---'; Get-Content '%OUT_LOG%' -Tail 100 }; if (Test-Path '%ERR_LOG%') { Write-Host '--- LAST 100 ERR LINES ---'; Get-Content '%ERR_LOG%' -Tail 100 }"
exit /b 0
