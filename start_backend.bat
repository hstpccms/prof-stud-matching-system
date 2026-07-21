@echo off
echo Starting Prof-Student Matching System Backend...
echo.
echo Backend: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
cd /d "%~dp0backend"
python -m uvicorn main:app --reload --port 8000
