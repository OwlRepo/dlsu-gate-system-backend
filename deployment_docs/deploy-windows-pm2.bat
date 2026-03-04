@echo off
setlocal enabledelayedexpansion

::: When double-clicked (no args), re-run in a persistent window so output is visible
if "%~1"=="" (
    cmd /k "%~f0" _deploy
    exit /b
)

title DLSU Gate System - PM2 Deploy (Windows)

::: Change to project root directory
cd /d "%~dp0\.."
set PROJECT_ROOT=%cd%

echo.
echo ========================================
echo   DLSU Gate System - PM2 Deploy
echo ========================================
echo.

::: ========== STEP 1: Preflight Checks ==========
echo [1/8] Checking prerequisites...
echo.

::: Check Node.js (required for PM2 and runtime)
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js v18+ from: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VERSION=%%i
echo [OK] Node.js: !NODE_VERSION!

::: Check Bun (optional - fallback to npm)
set USE_BUN=0
where bun >nul 2>&1
if !errorLevel! equ 0 (
    set USE_BUN=1
    for /f "tokens=*" %%i in ('bun --version 2^>nul') do set BUN_VERSION=%%i
    echo [OK] Bun: !BUN_VERSION!
) else (
    echo [OK] Bun not found - will use npm
)

::: Check PM2 (install if missing via npm)
where pm2 >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing PM2 globally...
    call npm install -g pm2 --loglevel=error
    if %errorLevel% neq 0 (
        echo [ERROR] Failed to install PM2. Try running as Administrator.
        pause
        exit /b 1
    )
    echo [OK] PM2 installed
) else (
    echo [OK] PM2 already installed
)

::: Verify project files
if not exist "%PROJECT_ROOT%\package.json" (
    echo [ERROR] package.json not found. Run this script from the project directory.
    pause
    exit /b 1
)
echo [OK] package.json found

if exist "%PROJECT_ROOT%\deployment_docs\ecosystem.windows.config.js" (
    set ECOSYSTEM=deployment_docs\ecosystem.windows.config.js
) else (
    if exist "%PROJECT_ROOT%\ecosystem.config.js" (
        set ECOSYSTEM=ecosystem.config.js
    ) else (
        echo [ERROR] No ecosystem config found.
        echo Looked for:
        echo   - %PROJECT_ROOT%\deployment_docs\ecosystem.windows.config.js
        echo   - %PROJECT_ROOT%\ecosystem.config.js
        pause
        exit /b 1
    )
)
echo [OK] Using ecosystem: !ECOSYSTEM!

::: Ensure logs directory exists
if not exist "%PROJECT_ROOT%\logs" mkdir "%PROJECT_ROOT%\logs"
echo [OK] Logs directory ready
echo.

::: ========== STEP 2: Install Dependencies ==========
echo [2/8] Installing dependencies...
if !USE_BUN! equ 1 (
    echo [INFO] Using Bun (--ignore-scripts to avoid postinstall PATH issues)...
    call bun install --ignore-scripts
    if !errorLevel! neq 0 (
        echo [WARNING] bun install had issues, retrying...
        call bun install --ignore-scripts
        if !errorLevel! neq 0 (
            echo [ERROR] bun install failed. Check the output above.
            pause
            exit /b 1
        )
    )
    if exist "%PROJECT_ROOT%\patches\*" (
        echo [INFO] Applying patch-package patches...
        call bunx patch-package
        if !errorLevel! neq 0 (
            echo [ERROR] Failed to apply patch-package patches.
            echo Run manually: bunx patch-package
            pause
            exit /b 1
        )
    )
) else (
    echo [INFO] Using npm...
    call npm install --loglevel=error
    if !errorLevel! neq 0 (
        echo [ERROR] npm install failed. Check the output above.
        pause
        exit /b 1
    )
    if exist "%PROJECT_ROOT%\patches\*" (
        echo [INFO] Applying patch-package patches...
        call npx patch-package
        if !errorLevel! neq 0 (
            echo [ERROR] Failed to apply patch-package patches.
            echo Run manually: npx patch-package
            pause
            exit /b 1
        )
    )
)

echo [OK] Dependencies installed
echo.

::: ========== STEP 3: Build Application ==========
echo [3/8] Building application...
if !USE_BUN! equ 1 (
    call bun run build
) else (
    call npm run build
)
if %errorLevel% neq 0 (
    echo [ERROR] Build failed. Check the output above.
    pause
    exit /b 1
)
echo [OK] Build successful
echo.

::: ========== STEP 4: Gracefully Stop Existing PM2 App ==========
echo [4/8] Stopping existing PM2 process (if running)...
set PM2_STEP_OK=0
pm2 ping >nul 2>&1
if !errorLevel! neq 0 (
    echo [INFO] PM2 daemon not running - no process to stop
    set PM2_STEP_OK=1
) else (
    pm2 describe dlsu-portal-be >nul 2>&1
    if !errorLevel! equ 0 (
        echo   Stopping dlsu-portal-be...
        pm2 stop dlsu-portal-be
        timeout /t 2 /nobreak >nul
        echo   Removing dlsu-portal-be from PM2...
        pm2 delete dlsu-portal-be
        if !errorLevel! equ 0 (
            echo [OK] Previous instance stopped and removed
        ) else (
            echo [OK] Process removed or already gone - continuing
        )
        set PM2_STEP_OK=1
    ) else (
        echo [OK] No existing process to stop
        set PM2_STEP_OK=1
    )
)
if !PM2_STEP_OK! neq 1 (
    echo [WARNING] PM2 step had issues - attempting to continue
)
echo.

::: ========== STEP 5: Start Application with PM2 ==========
echo [5/8] Starting application with PM2...
pm2 start %ECOSYSTEM% --env production
if %errorLevel% neq 0 (
    echo [ERROR] Failed to start application with PM2
    echo Check logs: pm2 logs dlsu-portal-be
    pause
    exit /b 1
)

pm2 save >nul 2>&1
echo [OK] Application started
echo.

::: ========== STEP 6: Configure PM2 Startup on Boot ==========
echo [6/8] Configuring PM2 startup on Windows boot...

net session >nul 2>&1
set IS_ADMIN=%errorLevel%

if !IS_ADMIN! equ 0 (
    echo Running as Administrator - configuring startup...
    for /f "tokens=*" %%i in ('pm2 startup 2^>^&1') do (
        set STARTUP_LINE=%%i
        echo %%i | findstr /i "pm2" >nul
        if !errorLevel! equ 0 (
            echo Executing: %%i
            call %%i >nul 2>&1
            if !errorLevel! equ 0 (
                echo [OK] PM2 startup configured for boot
            ) else (
                echo [WARNING] Auto-config failed. Run manually as Admin: %%i
            )
        )
    )
) else (
    echo [INFO] Not running as Administrator
    echo.
    echo To enable auto-start on Windows boot:
    echo 1. Open Command Prompt as Administrator
    echo 2. Run: pm2 startup
    echo 3. Execute the command shown by pm2 startup
)

pm2 save >nul 2>&1
if exist "%USERPROFILE%\.pm2\dump.pm2" (
    echo [OK] PM2 process list saved
) else (
    echo [WARNING] PM2 dump not found. Run 'pm2 save' manually.
)
echo.

::: ========== STEP 7: Verify HTTP Readiness (Docs Endpoint) ==========
echo [7/8] Checking docs endpoint readiness...
set DOCS_URL=http://localhost:10580/api/docs
set MAX_ATTEMPTS=30
set ATTEMPT=0
set READY=0

:wait_loop
set /a ATTEMPT+=1
echo   Attempt !ATTEMPT!/!MAX_ATTEMPTS! - Checking %DOCS_URL%...

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '%DOCS_URL%' -UseBasicParsing -TimeoutSec 5; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorLevel% equ 0 (
    set READY=1
    goto :readiness_done
)

if !ATTEMPT! lss !MAX_ATTEMPTS! (
    timeout /t 2 /nobreak >nul
    goto :wait_loop
)

:readiness_done
if !READY! neq 1 (
    echo.
    echo [ERROR] Docs endpoint did not become ready after !MAX_ATTEMPTS! attempts.
    echo URL checked: %DOCS_URL%
    echo.
    echo Troubleshooting:
    echo   - pm2 logs dlsu-portal-be
    echo   - pm2 status
    echo   - Check database and Redis connectivity
    pm2 status
    pause
    exit /b 1
)

echo [OK] Docs endpoint is ready
echo.

::: ========== STEP 8: Success - Confirm and Open Docs ==========
echo [8/8] Deployment complete.
echo.
echo ========================================
echo   Deployment Successful!
echo ========================================
echo.
echo Application Status:
pm2 status
echo.
echo URLs:
echo   API:       http://localhost:10580
echo   Docs:      %DOCS_URL%
echo   Health:    http://localhost:10580/health
echo.
if !IS_ADMIN! neq 0 (
    echo NOTE: Run this script as Administrator to enable auto-start on boot.
    echo.
)
echo Opening documentation...
start "" "%DOCS_URL%"
echo.
echo Press any key to close...
pause >nul
exit /b 0
