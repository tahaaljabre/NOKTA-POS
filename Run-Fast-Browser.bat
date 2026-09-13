@echo off
title NOKTA POS - Browser Runner
cd /d "%~dp0"
color 0B

echo ===================================================
echo       NOKTA POS - Fast Browser Mode
echo ===================================================
echo.
echo [*] Checking local server...
powershell -NoProfile -Command "$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($listener) { exit 0 }; exit 1" >nul 2>&1
if not errorlevel 1 (
  echo [*] Server is already running. Opening browser to http://localhost:3000 ...
  start http://localhost:3000
  goto :end
)

echo [*] Starting local server...
start http://localhost:3000
call node server.js

:end
pause
