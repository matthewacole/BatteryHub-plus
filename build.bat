@echo off
title Building Battery Hub
cd /d "%~dp0"

echo ========================================
echo   Battery Hub - SEA Build
echo ========================================
echo.

rem Install build tools if not present
where esbuild >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing esbuild...
    call npm install -g esbuild
)
where postject >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing postject...
    call npm install -g postject
)

rem Run SEA build
echo Building...
cd /d "%~dp0backend"
call node build-sea.mjs
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Build complete!
echo.
echo Distribution files in: %~dp0dist
echo   ClassroomBatteryManager.exe  (standalone executable)
echo   better_sqlite3.node          (native database module)
echo   public/                      (frontend assets)
echo.
echo To run: double-click dist\ClassroomBatteryManager.exe
echo.
pause
