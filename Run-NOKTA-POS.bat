@echo off
title NOKTA POS - Development Runner
cd /d "%~dp0"
color 0A

echo ===================================================
echo       NOKTA POS - Build, Test, and Run 
echo ===================================================
echo.

echo [*] Installing latest dependencies (pnpm install)...
call pnpm install
if %ERRORLEVEL% neq 0 goto error

echo.
echo [*] Running automated tests (pnpm test)...
call pnpm test
if %ERRORLEVEL% neq 0 goto error

echo.
echo [*] Running project checks (pnpm run check)...
call pnpm run check
if %ERRORLEVEL% neq 0 goto error

echo.
echo ===================================================
echo All tests passed successfully! Starting the App...
echo ===================================================
echo.
echo [*] Launching NOKTA POS (Desktop Mode)...
call pnpm run desktop
goto end

:error
color 0C
echo.
echo ===================================================
echo ERROR: An issue occurred during setup or testing.
echo Please review the errors above.
echo ===================================================
pause
exit /b 1

:end
exit /b 0
