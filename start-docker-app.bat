@echo off
cd /d %~dp0

REM Check if script is already running
tasklist /FI "WINDOWTITLE eq Docker-App-Startup" 2>NUL | find /I /N "cmd.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Script is already running in another window.
    exit /b 1
)

title Docker-App-Startup

REM Check if containers exist and are running
docker compose ps -q >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Containers are already running
    goto show_logs
)

REM Check if containers exist but are stopped
docker compose ps -a -q >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Starting existing containers...
    docker compose start
    goto show_logs
)

REM If no containers exist, build and start new ones
echo No existing containers found. Building and starting new containers...
docker compose up --build -d

:show_logs
REM Show logs
echo Showing container logs...
docker compose logs -f 