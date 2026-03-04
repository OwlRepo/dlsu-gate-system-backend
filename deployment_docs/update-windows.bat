@echo off
setlocal enabledelayedexpansion
title DLSU Gate System - Update

:: Change to project root directory
cd /d "%~dp0\.."

echo.
echo ========================================
echo   DLSU Gate System - Updating
echo ========================================
echo.

:: Pull latest changes
echo Pulling latest changes...
git pull origin main
if %errorLevel% neq 0 (
    echo [WARNING] Failed to pull changes or not a git repository
    echo Continuing with update...
)

:: Install dependencies
echo Installing dependencies...
call npm install --loglevel=error
if %errorLevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

:: Build application
echo Building application...
call npm run build
if %errorLevel% neq 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

:: Run migrations
echo Running migrations...
call npm run migration:run
if %errorLevel% neq 0 (
    echo [WARNING] Migration failed or no migrations to run
    echo This is OK if database is already up to date
)

:: Restart PM2
echo Restarting application...
set ECOSYSTEM=deployment_docs\ecosystem.windows.config.js
pm2 describe dlsu-portal-be >nul 2>&1
if !errorLevel! equ 0 (
    pm2 restart dlsu-portal-be
    if !errorLevel! neq 0 (
        echo [WARNING] PM2 restart failed - app may have stopped
    )
) else (
    echo [INFO] App not in PM2. Starting from ecosystem...
    pm2 start "%ECOSYSTEM%" --env production
    if !errorLevel! neq 0 (
        echo [ERROR] Failed to start application
        pause
        exit /b 1
    )
)
pm2 save >nul 2>&1

echo.
echo ========================================
echo   Update Completed!
echo ========================================
echo.
pm2 status
echo.
pause

