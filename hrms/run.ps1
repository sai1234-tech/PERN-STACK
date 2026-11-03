Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  HRMS Unified Docker Stack (One Folder: hrms)" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Launching frontend, backend, database under 'hrms' stack..." -ForegroundColor Yellow

docker-compose up -d --build

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  HRMS Services Online:" -ForegroundColor Green
Write-Host "  - Frontend:  http://localhost:5173 or http://localhost:80" -ForegroundColor White
Write-Host "  - Backend:   http://localhost:5005" -ForegroundColor White
Write-Host "  - Database:  localhost:5432" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Cyan

