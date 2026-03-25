@echo off
setlocal enabledelayedexpansion
title FitGPT Web App
color 0A

echo ========================================
echo    FitGPT Web App Launcher
echo ========================================
echo.

:: Check for Python
where python >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo         Download it from https://www.python.org/downloads/
    goto :fail
)

:: Check for Node.js / npm
where npm >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js / npm is not installed or not in PATH.
    echo         Download it from https://nodejs.org/
    goto :fail
)

:: Check that backend folder exists
if not exist "%~dp0backend\app\main.py" (
    echo [ERROR] Backend not found at %~dp0backend\app\main.py
    echo         Make sure the backend folder is in the project root.
    goto :fail
)

:: Check that web folder exists
if not exist "%~dp0web\package.json" (
    echo [ERROR] Frontend not found at %~dp0web\package.json
    echo         Make sure the web folder is in the project root.
    goto :fail
)

:: Install Python dependencies from requirements.txt
echo [1/4] Checking Python dependencies...
if exist "%~dp0backend\requirements.txt" (
    pip install -r "%~dp0backend\requirements.txt" --quiet >nul 2>&1
    if !errorlevel! neq 0 (
        echo       Installing Python dependencies...
        pip install -r "%~dp0backend\requirements.txt"
    )
) else (
    pip show fastapi uvicorn sqlalchemy passlib python-jose pydantic python-dotenv requests groq psycopg2-binary google-auth >nul 2>&1
    if !errorlevel! neq 0 (
        echo       Installing Python dependencies...
        pip install fastapi uvicorn[standard] sqlalchemy passlib[bcrypt] bcrypt==4.0.1 python-jose[cryptography] pydantic[email] python-dotenv python-multipart requests groq psycopg2-binary google-auth
    )
)
echo       Python dependencies OK.

:: Install Node dependencies if missing
echo [2/4] Checking Node dependencies...
if not exist "%~dp0web\node_modules\react-scripts" (
    echo       Installing Node dependencies...
    pushd "%~dp0web"
    call npm install
    popd
)
echo       Node dependencies OK.

:: Kill any existing processes on ports 8000 and 3000
echo [3/4] Clearing ports...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Start servers
echo [4/4] Starting servers...
echo.

start "FitGPT Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --reload --port 8000"

timeout /t 4 /nobreak >nul

start "FitGPT Frontend" cmd /k "cd /d "%~dp0web" && npm start"

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
goto :eof

:fail
echo.
pause
exit /b 1
