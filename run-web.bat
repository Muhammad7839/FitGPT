@echo off
title FitGPT Web App
color 0A

echo ========================================
echo    FitGPT Web App Launcher
echo ========================================
echo.

:: -------------------------------------------
:: Check for Python
:: -------------------------------------------
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo         Download it from https://www.python.org/downloads/
    pause
    exit /b 1
)

:: -------------------------------------------
:: Check for Node.js / npm
:: -------------------------------------------
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js / npm is not installed or not in PATH.
    echo         Download it from https://nodejs.org/
    pause
    exit /b 1
)

:: -------------------------------------------
:: Check that backend folder exists
:: -------------------------------------------
if not exist "%~dp0backend\app\main.py" (
    echo [ERROR] Backend not found at %~dp0backend\app\main.py
    echo         Make sure the backend folder is in the project root.
    pause
    exit /b 1
)

:: -------------------------------------------
:: Check that web folder exists
:: -------------------------------------------
if not exist "%~dp0web\package.json" (
    echo [ERROR] Frontend not found at %~dp0web\package.json
    echo         Make sure the web folder is in the project root.
    pause
    exit /b 1
)

:: -------------------------------------------
:: Install Python dependencies if missing
:: -------------------------------------------
echo [1/4] Checking Python dependencies...
pip show fastapi uvicorn sqlalchemy passlib python-jose pydantic python-dotenv requests >nul 2>&1
if %errorlevel% neq 0 (
    echo       Installing Python dependencies...
    pip install fastapi uvicorn sqlalchemy "passlib[bcrypt]" "python-jose[cryptography]" "pydantic[email]" python-dotenv python-multipart requests
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Python dependencies.
        pause
        exit /b 1
    )
)
echo       Python dependencies OK.

:: -------------------------------------------
:: Install Node dependencies if missing
:: -------------------------------------------
echo [2/4] Checking Node dependencies...
if not exist "%~dp0web\node_modules" (
    echo       Installing Node dependencies (this may take a minute)...
    cd /d "%~dp0web" && npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Node dependencies.
        pause
        exit /b 1
    )
)
echo       Node dependencies OK.

:: -------------------------------------------
:: Kill any existing processes on ports 8000 and 3000
:: -------------------------------------------
echo [3/4] Clearing ports...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

:: -------------------------------------------
:: Start servers
:: -------------------------------------------
echo [4/4] Starting servers...
echo.

start "FitGPT Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

start "FitGPT Frontend" cmd /k "cd /d %~dp0web && npm start"

echo.
echo ========================================
echo    Both servers are starting!
echo.
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:8000
echo    API Docs: http://localhost:8000/docs
echo ========================================
echo.
echo Close the other two terminal windows to
echo stop the servers.
echo.
pause
