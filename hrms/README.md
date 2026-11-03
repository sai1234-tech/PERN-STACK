# HRMS - Unified Docker Execution Hub

This folder (`hrms`) contains the single unified Docker orchestration for the entire HRMS application.

## Why this folder?
Instead of running separate components individually, everything is grouped together under the single **`hrms`** stack:
- **`hrms-frontend`**: React Vite application served via high-performance Nginx on ports `5173` & `80`.
- **`hrms-backend`**: Node.js Express API on port `5005` with automated database migrations and health checks.
- **`hrms-database`**: PostgreSQL 16 database with persistent storage on port `5432`.

In **Docker Desktop**, all 3 services are organized inside **one folder called `hrms`**.

---

## Quick Start (Single Command)

### Option 1: Using the Batch Runner (Windows)
Double-click `start.bat` or run:
```cmd
start.bat
```

### Option 2: Using Docker Compose
From inside this `hrms` folder:
```cmd
docker-compose up -d --build
```
Or from the root directory:
```cmd
docker-compose up -d --build
```

---

## Stopping the Application
```cmd
docker-compose down
```
Or double-click `stop.bat`.

