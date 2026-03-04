@echo off
setlocal enabledelayedexpansion
title DLSU Gate BE - Install Windows Service

cd /d "%~dp0\.."
set "PROJECT_ROOT=%cd%"
set "SERVICE_NAME=DLSUGateSystemBackend"
set "DISPLAY_NAME=DLSU Gate System Backend"
set "APP_PORT=10580"

echo.
echo ========================================
echo   Install Backend Windows Service
echo ========================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Run this script as Administrator.
    pause
    exit /b 1
)

where nssm >nul 2>&1
if %errorLevel% neq 0 (
    if exist "%~dp0nssm.exe" (
        set "NSSM=%~dp0nssm.exe"
    ) else (
        echo [ERROR] NSSM not found. Install NSSM or place nssm.exe in this folder.
        pause
        exit /b 1
    )
) else (
    for /f "delims=" %%i in ('where nssm') do set "NSSM=%%i" & goto :nssm_found
)
:nssm_found

for /f "delims=" %%i in ('where node') do set "NODE_PATH=%%i" & goto :node_found
:node_found
if not defined NODE_PATH (
    echo [ERROR] Node.js not found in PATH.
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%\dist\main.js" (
    echo [ERROR] dist\main.js not found. Run deploy-service.bat first.
    pause
    exit /b 1
)
if not exist "%PROJECT_ROOT%\logs" mkdir "%PROJECT_ROOT%\logs"

echo [INFO] Reinstalling service %SERVICE_NAME%...
"%NSSM%" stop "%SERVICE_NAME%" >nul 2>&1
"%NSSM%" remove "%SERVICE_NAME%" confirm >nul 2>&1

"%NSSM%" install "%SERVICE_NAME%" "%NODE_PATH%" "dist\main.js"
if %errorLevel% neq 0 (
    echo [ERROR] Failed to install service.
    pause
    exit /b 1
)

"%NSSM%" set "%SERVICE_NAME%" AppDirectory "%PROJECT_ROOT%"
"%NSSM%" set "%SERVICE_NAME%" DisplayName "%DISPLAY_NAME%"
"%NSSM%" set "%SERVICE_NAME%" Start SERVICE_AUTO_START
"%NSSM%" set "%SERVICE_NAME%" AppEnvironmentExtra "NODE_ENV=production^&PORT=%APP_PORT%"
"%NSSM%" set "%SERVICE_NAME%" AppStdout "%PROJECT_ROOT%\logs\backend-service-out.log"
"%NSSM%" set "%SERVICE_NAME%" AppStderr "%PROJECT_ROOT%\logs\backend-service-error.log"
"%NSSM%" set "%SERVICE_NAME%" AppExit Default Restart
"%NSSM%" set "%SERVICE_NAME%" AppRestartDelay 10000

sc failure "%SERVICE_NAME%" reset= 86400 actions= restart/10000/restart/10000/restart/10000 >nul 2>&1
sc failureflag "%SERVICE_NAME%" 1 >nul 2>&1

net start "%SERVICE_NAME%" >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Service installed but failed to start. Check logs\backend-service-error.log
    pause
    exit /b 1
)

echo [OK] Service installed and started.
sc query "%SERVICE_NAME%"
exit /b 0
