@echo off
title GIS-HMS Backend Server
echo Starting GIS-HMS Backend Server...
echo.

cd /d "%~dp0backend"

REM Start the backend server with the project environment when available
if exist "%~dp0..\.venv\Scripts\python.exe" (
	"%~dp0..\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
) else (
	py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
)

pause
