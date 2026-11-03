@echo off
title HRMS Docker Runner
echo ===================================================
echo   HRMS Unified Enterprise Stack
echo   Everything running in one folder: hrms
echo ===================================================
echo.
docker-compose up -d --build
echo.
echo ===================================================
echo   HRMS Services Online:
echo   - Frontend:  http://localhost:5173
echo   - Backend:   http://localhost:5005
echo   - Database:  localhost:5432
echo ===================================================
echo.
pause

