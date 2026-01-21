@echo off
setlocal enabledelayedexpansion
title DLSU Gate System - Windows Server Deployment

:: Change to project root directory
cd /d "%~dp0\.."

echo.
echo ========================================
echo   DLSU Gate System Backend Deployment
echo ========================================
echo.

:: Step 1: Check Prerequisites
echo [1/10] Checking Prerequisites...
echo.

set MISSING_PREREQS=0

:: Check Node.js
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js v18+ from: https://nodejs.org/
    echo After installation, restart this script.
    set /a MISSING_PREREQS+=1
) else (
    for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VERSION=%%i
    echo [OK] Node.js installed: !NODE_VERSION!
)

:: Check npm
where npm >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] npm is not installed!
    set /a MISSING_PREREQS+=1
) else (
    for /f "tokens=*" %%i in ('npm --version 2^>nul') do set NPM_VERSION=%%i
    echo [OK] npm installed: !NPM_VERSION!
)

:: Check PostgreSQL
where psql >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] PostgreSQL not found in PATH
    echo PostgreSQL should be installed and running
    set PG_INSTALLED=0
) else (
    echo [OK] PostgreSQL found
    set PG_INSTALLED=1
)

if !MISSING_PREREQS! gtr 0 (
    echo.
    echo [ERROR] Missing required prerequisites!
    echo Please install missing prerequisites and run this script again.
    pause
    exit /b 1
)

:: Step 2: Setup Environment
echo.
echo [2/10] Setting up environment...

if not exist .env (
    echo Creating .env file from template...
    (
        echo # Database Configuration
        echo DB_HOST=localhost
        echo DB_PORT=5432
        echo DB_USERNAME=postgres
        echo DB_PASSWORD=postgres
        echo DB_NAME=dlsu_portal
        echo.
        echo # Redis Configuration
        echo REDIS_HOST=localhost
        echo REDIS_PORT=6379
        echo.
        echo # Application Configuration
        echo NODE_ENV=production
        echo PORT=10580
        echo.
        echo # JWT Configuration
        echo JWT_SECRET=your-secret-key-change-this-in-production
        echo JWT_EXPIRES_IN=2d
    ) > .env
    echo [OK] .env file created. Please edit it with your actual credentials.
    echo Press any key to continue after editing .env...
    pause >nul
) else (
    echo [OK] .env file exists
)

:: Create required directories
if not exist logs mkdir logs
if not exist persistent_uploads mkdir persistent_uploads

:: Step 3: Install PM2
echo.
echo [3/10] Installing PM2 globally...

where pm2 >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing PM2...
    call npm install -g pm2 --loglevel=error
    if %errorLevel% neq 0 (
        echo [ERROR] Failed to install PM2
        echo Try running as Administrator or install manually: npm install -g pm2
        pause
        exit /b 1
    )
    echo [OK] PM2 installed
) else (
    echo [OK] PM2 already installed
)

:: Step 4: Install Dependencies
echo.
echo [4/10] Installing project dependencies...
call npm install --loglevel=error
if %errorLevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed

:: Step 5: Build Application
echo.
echo [5/10] Building application...
call npm run build
if %errorLevel% neq 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo [OK] Application built successfully

:: Step 6: Database Setup
echo.
echo [6/10] Setting up database...

if !PG_INSTALLED! equ 1 (
    echo Checking database connection...
    
    :: Try to connect to PostgreSQL
    echo SELECT 1; | psql -U postgres -d postgres >nul 2>&1
    if %errorLevel% neq 0 (
        echo [WARNING] Could not connect to PostgreSQL automatically
        echo You may need to set PGPASSWORD environment variable
        echo Or create database manually: CREATE DATABASE dlsu_portal;
        echo.
        set /p DB_PASSWORD="Enter PostgreSQL password (or press Enter to skip): "
        if not "!DB_PASSWORD!"=="" (
            set PGPASSWORD=!DB_PASSWORD!
        )
    )
    
    :: Check if database exists
    echo SELECT 1 FROM pg_database WHERE datname='dlsu_portal'; | psql -U postgres -d postgres -t >nul 2>&1
    if %errorLevel% equ 0 (
        echo [OK] Database exists
    ) else (
        echo Creating database...
        echo CREATE DATABASE dlsu_portal; | psql -U postgres -d postgres >nul 2>&1
        if %errorLevel% equ 0 (
            echo [OK] Database created
        ) else (
            echo [WARNING] Could not create database automatically
            echo Please create it manually: CREATE DATABASE dlsu_portal;
        )
    )
) else (
    echo [WARNING] PostgreSQL not detected. Skipping database setup.
    echo Please set up PostgreSQL manually and run migrations later.
)

:: Step 7: Run Migrations
echo.
echo [7/10] Running database migrations...
call npm run migration:run
if %errorLevel% neq 0 (
    echo [WARNING] Migration failed or no migrations to run
    echo This is OK if database is already set up
) else (
    echo [OK] Migrations completed
)

:: Step 8: Create PM2 Config
echo.
echo [8/10] Creating Windows PM2 configuration...

(
    echo module.exports = {
    echo   apps: [
    echo     {
    echo       name: 'dlsu-portal-be',
    echo       script: 'dist/main.js',
    echo       instances: 1,
    echo       exec_mode: 'fork',
    echo       autorestart: true,
    echo       max_memory_restart: '8G',
    echo       watch: false,
    echo       env: {
    echo         NODE_ENV: 'production',
    echo         PORT: 10580,
    echo         TYPEORM_CONNECTION_RETRIES: 5,
    echo         TYPEORM_MAX_QUERY_EXECUTION_TIME: 60000,
    echo         TYPEORM_ENTITIES_CACHE: true,
    echo         TYPEORM_POOL_SIZE: 30,
    echo         NODE_OPTIONS: '--max-old-space-size=8192 --expose-gc --max-http-header-size=16384',
    echo         KEEP_ALIVE_TIMEOUT: 65000,
    echo         HEADERS_TIMEOUT: 66000,
    echo       },
    echo       merge_logs: true,
    echo       log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    echo       out_file: 'logs/out.log',
    echo       error_file: 'logs/error.log',
    echo       kill_timeout: 30000,
    echo       wait_ready: true,
    echo       listen_timeout: 30000,
    echo       max_restarts: 5,
    echo       min_uptime: '30s',
    echo       restart_delay: 10000,
    echo       time: true,
    echo     },
    echo   ],
    echo };
) > deployment_docs\ecosystem.windows.config.js

echo [OK] PM2 configuration created

:: Step 9: Start Application
echo.
echo [9/10] Starting application with PM2...

:: Stop existing instance
pm2 delete dlsu-portal-be >nul 2>&1
timeout /t 1 >nul

:: Start application
pm2 start deployment_docs\ecosystem.windows.config.js --env production
if %errorLevel% neq 0 (
    echo [ERROR] Failed to start application
    echo Check logs with: pm2 logs
    pause
    exit /b 1
)

:: Save PM2 process list
pm2 save >nul 2>&1
echo [OK] PM2 process list saved

:: Step 10: Configure PM2 Auto-Start
echo.
echo [10/10] Configuring PM2 to start on Windows boot...

:: Check if running as Administrator
net session >nul 2>&1
set IS_ADMIN=%errorLevel%

if !IS_ADMIN! equ 0 (
    echo Running as Administrator - configuring startup automatically...
    
    :: Generate startup command
    for /f "tokens=*" %%i in ('pm2 startup 2^>^&1') do (
        set STARTUP_CMD=%%i
        echo %%i | findstr /C:"pm2" >nul
        if !errorLevel! equ 0 (
            echo Executing: %%i
            call %%i >nul 2>&1
            if !errorLevel! equ 0 (
                echo [OK] PM2 startup configured successfully
            ) else (
                echo [WARNING] Failed to configure startup automatically
                echo Please run the command manually: %%i
            )
        )
    )
) else (
    echo [INFO] Not running as Administrator
    echo.
    echo PM2 startup configuration requires Administrator privileges.
    echo Please run the following command as Administrator:
    echo.
    pm2 startup
    echo.
    echo Then execute the command shown above in an elevated command prompt.
    echo.
    echo After running the startup command, verify with: pm2 startup
)

:: Verify PM2 save was successful
if exist "%USERPROFILE%\.pm2\dump.pm2" (
    echo [OK] PM2 process list saved to: %USERPROFILE%\.pm2\dump.pm2
) else (
    echo [WARNING] PM2 dump file not found. Run 'pm2 save' manually.
)

echo.
echo ========================================
echo   Deployment Completed!
echo ========================================
echo.
echo Application Status:
pm2 status
echo.
echo Useful Commands:
echo   pm2 logs              - View logs
echo   pm2 restart dlsu-portal-be - Restart
echo   pm2 stop dlsu-portal-be    - Stop
echo.
echo Application URLs:
echo   http://localhost:10580
echo   http://localhost:10580/api/docs
echo   http://localhost:10580/health
echo.

:: Wait and check status
timeout /t 3 >nul
pm2 list | findstr "dlsu-portal-be" | findstr "online" >nul
if %errorLevel% equ 0 (
    echo [OK] Application is running!
) else (
    echo [WARNING] Application may not be running. Check logs: pm2 logs
)

echo.
if !IS_ADMIN! neq 0 (
    echo ========================================
    echo   IMPORTANT: PM2 Auto-Start Setup
    echo ========================================
    echo.
    echo To enable automatic startup on Windows boot:
    echo 1. Open Command Prompt as Administrator
    echo 2. Navigate to this directory
    echo 3. Run: pm2 startup
    echo 4. Execute the command shown by pm2 startup
    echo 5. Verify with: pm2 startup
    echo.
)

pause

