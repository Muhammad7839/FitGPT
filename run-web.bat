@echo off
setlocal enabledelayedexpansion
title FitGPT Web App
color 0A

echo ========================================
echo    FitGPT Web App Launcher
echo ========================================
echo.

:: Check for Python (try python, py launcher, then known install path)
set PYTHON_CMD=
where python >nul 2>&1 && set PYTHON_CMD=python
if not defined PYTHON_CMD (
    where py >nul 2>&1 && set PYTHON_CMD=py
)
if not defined PYTHON_CMD (
    if exist "C:\Users\madee\AppData\Local\Programs\Python\Python312\python.exe" (
        set PYTHON_CMD=C:\Users\madee\AppData\Local\Programs\Python\Python312\python.exe
    )
)
if not defined PYTHON_CMD (
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
    %PYTHON_CMD% -m pip install -r "%~dp0backend\requirements.txt" --quiet >nul 2>&1
    if !errorlevel! neq 0 (
        echo       Installing Python dependencies...
        %PYTHON_CMD% -m pip install -r "%~dp0backend\requirements.txt"
    )
) else (
    %PYTHON_CMD% -m pip show fastapi uvicorn sqlalchemy passlib python-jose pydantic python-dotenv requests groq >nul 2>&1
    if !errorlevel! neq 0 (
        echo       Installing Python dependencies...
        %PYTHON_CMD% -m pip install fastapi uvicorn sqlalchemy passlib python-jose pydantic[email] python-dotenv python-multipart requests groq
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

set "BACKEND_DIR=%~dp0backend"
set "WEB_DIR=%~dp0web"
set "BACKEND_URL=http://localhost:8000"
set "LOCAL_DATABASE_URL=sqlite:///%BACKEND_DIR%\fitgpt.db"

:: Kill any existing processes on ports 8000 and 3000. Use PowerShell's
:: Get-NetTCPConnection so we also catch "Bound" state zombies that
:: netstat | findstr "LISTENING" misses — those are the processes that
:: silently squat on the port and make re-launch fail.
echo [3/4] Clearing ports...
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($port in 8000, 3000) { Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }" >nul 2>&1
:: Give the OS a moment to actually release the sockets before we rebind.
timeout /t 1 /nobreak >nul

:: Start servers
echo [4/4] Starting servers...
echo.

start "FitGPT Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && set ""DATABASE_URL=%LOCAL_DATABASE_URL%"" && ""%PYTHON_CMD%"" -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

echo       Waiting for backend health check...
set "BACKEND_READY="
for /l %%i in (1,1,30) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%BACKEND_URL%/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }" >nul 2>&1
    if !errorlevel! equ 0 (
        set "BACKEND_READY=1"
        goto :backend_ready
    )
    timeout /t 1 /nobreak >nul
)

:backend_ready
if not defined BACKEND_READY (
    echo [ERROR] Backend did not become ready at %BACKEND_URL%.
    echo         Check the "FitGPT Backend" window for the startup error.
    goto :fail
)
echo       Backend is ready.

start "FitGPT Frontend" cmd /k "cd /d ""%WEB_DIR%"" && set ""REACT_APP_API_BASE_URL=%BACKEND_URL%"" && npm start"

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
