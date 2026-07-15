@echo off
title RLE Fidel - Stop All Instances
echo ========================================
echo   Beende alle RLE Fidel Instanzen...
echo ========================================
echo.
cd /d "%~dp0"

echo Suche Prozesse auf Port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Kille Prozess %%a auf Port 3000
    taskkill /F /PID %%a 2>nul
)

echo.
echo Alle Instanzen beendet.
pause
