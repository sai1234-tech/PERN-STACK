<#
.SYNOPSIS
    PERN HRMS - Developer Automation Script for Windows PowerShell
.DESCRIPTION
    Senior full-stack engineer CLI automation for managing Docker environments.
#>

param (
    [Parameter(Position=0)]
    [ValidateSet("up", "dev", "down", "logs", "status", "ps", "seed", "reset", "test", "help")]
    [string]$Command = "help"
)

switch ($Command) {
    "up" {
        Write-Host ">>> Building and starting PERN HRMS production containers in background..." -ForegroundColor Cyan
        docker-compose up --build -d
        docker-compose ps
    }
    "dev" {
        Write-Host ">>> Starting PERN HRMS development containers with hot-reloading..." -ForegroundColor Cyan
        docker-compose -f docker-compose.dev.yml up --build
    }
    "down" {
        Write-Host ">>> Stopping PERN HRMS containers..." -ForegroundColor Yellow
        docker-compose down
    }
    "logs" {
        docker-compose logs -f
    }
    "status" {
        docker-compose ps
    }
    "ps" {
        docker-compose ps
    }
    "seed" {
        Write-Host ">>> Seeding realistic enterprise data into PostgreSQL container..." -ForegroundColor Green
        docker exec pern_hrms_backend node scripts/seed_all_missing_enterprise_data.js
        docker exec pern_hrms_backend node scripts/seed_comp_perf_ops.js
        Write-Host ">>> Seeding complete!" -ForegroundColor Green
    }
    "reset" {
        Write-Host ">>> Wiping Docker volumes and re-initializing..." -ForegroundColor Red
        docker-compose down -v
        docker-compose up --build -d
    }
    "test" {
        Write-Host ">>> Running test suite inside container..." -ForegroundColor Cyan
        docker exec pern_hrms_backend npm test
    }
    default {
        Write-Host "=============================================================================" -ForegroundColor White
        Write-Host "PERN HRMS - Developer CLI Automation Helper" -ForegroundColor Yellow
        Write-Host "=============================================================================" -ForegroundColor White
        Write-Host "Usage:" -ForegroundColor White
        Write-Host "  .\dev.ps1 up       - Build and start production containers (background)" -ForegroundColor Gray
        Write-Host "  .\dev.ps1 dev      - Start development mode with hot-reloading" -ForegroundColor Gray
        Write-Host "  .\dev.ps1 down     - Stop all containers cleanly" -ForegroundColor Gray
        Write-Host "  .\dev.ps1 logs     - Follow streaming logs from all services" -ForegroundColor Gray
        Write-Host "  .\dev.ps1 status   - Display container health and ports" -ForegroundColor Gray
        Write-Host "  .\dev.ps1 seed     - Seed authentic enterprise database records" -ForegroundColor Gray
        Write-Host "  .\dev.ps1 reset    - Clean slate volume wipe and restart" -ForegroundColor Gray
        Write-Host "  .\dev.ps1 test     - Execute test suite inside backend container" -ForegroundColor Gray
        Write-Host "=============================================================================" -ForegroundColor White
    }
}
