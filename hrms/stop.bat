@echo off
title Stop HRMS
echo Stopping all HRMS services...
docker-compose down
echo.
echo HRMS services have stopped cleanly.
pause

