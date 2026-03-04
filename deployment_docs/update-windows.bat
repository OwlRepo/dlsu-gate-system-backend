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

:: Detect Bun vs npm
set USE_BUN=0
where bun >nul 2>&1
if !errorLevel! equ 0 set USE_BUN=1

:: Install dependencies
echo Installing dependencies...
if !USE_BUN! equ 1 (
    echo [INFO] Using Bun...
    call bun install --ignore-scripts
) else (
    echo [INFO] Using npm...
    call npm install --loglevel=error
)
if !errorLevel! neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

if exist "%~dp0\..\patches\*" (
    echo [INFO] Applying patch-package patches...
    if !USE_BUN! equ 1 (
        call bunx patch-package
    ) else (
        call npx patch-package
    )
    if !errorLevel! neq 0 (
        echo [WARNING] patch-package had issues - continuing
    )
)

:: Build application
echo Building application...
if !USE_BUN! equ 1 (
    call bun run build
) else (
    call npm run build
)
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
set PM2=npx --yes pm2
echo Restarting application...
set ECOSYSTEM=deployment_docs\ecosystem.windows.config.js
%PM2% describe dlsu-portal-be >nul 2>&1
if !errorLevel! equ 0 (
    %PM2% restart dlsu-portal-be
    if !errorLevel! neq 0 (
        echo [WARNING] PM2 restart failed - app may have stopped
    )
) else (
    echo [INFO] App not in PM2. Starting from ecosystem...
    %PM2% start "%ECOSYSTEM%" --env production
    if !errorLevel! neq 0 (
        echo [ERROR] Failed to start application
        pause
        exit /b 1
    )
)
%PM2% save >nul 2>&1

echo.
echo ========================================
echo   Update Completed!
echo ========================================
echo.
%PM2% status
echo.
pause

