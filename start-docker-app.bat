@echo off
cd /d %~dp0

REM Stop and remove existing containers
docker compose down

REM Remove old volumes if needed
docker compose down -v

REM Build and start services
docker compose up --build -d

REM Show logs
docker compose logs -f 