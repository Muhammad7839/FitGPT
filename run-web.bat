@echo off
title FitGPT Web App

echo ========================================
echo    Starting FitGPT Web App
echo ========================================
echo.

:: Start the backend server
echo [1/2] Starting backend server on http://localhost:8000 ...
start "FitGPT Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --reload --port 8000"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

:: Start the frontend dev server
echo [2/2] Starting frontend on http://localhost:3000 ...
start "FitGPT Frontend" cmd /k "cd /d %~dp0web && npm install && npm start"

echo.
echo ========================================
echo    Both servers are starting!
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:8000
echo    API Docs: http://localhost:8000/docs
echo ========================================
echo.
echo Close the other two windows to stop the servers.
pause
