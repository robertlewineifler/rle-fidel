@echo off
title RLE Fidel - Local Dev Server
echo ========================================
echo   RLE Fidel - Lokaler Dev Server
echo   http://localhost:3000
echo ========================================
echo.
cd /d "%~dp0"
call npm run dev
pause
