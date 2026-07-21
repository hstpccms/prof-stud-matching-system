@echo off
echo Starting Prof-Student Matching System Frontend...
echo.
echo Frontend: http://localhost:5173
echo.
cd /d "%~dp0frontend"
powershell -ExecutionPolicy Bypass -Command "npm run dev"
