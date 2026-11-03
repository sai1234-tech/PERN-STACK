# 🐳 Docker Deployment & Single-Source Execution Guide

Run the entire **PERN HRMS** enterprise stack (PostgreSQL + Node.js Express + React Vite + Nginx) with **a single command**.

---

## ⚡ Quick Start: Single-Command Execution

### 1. Ensure Docker Desktop is Running
Open Docker Desktop from the Windows Start menu or taskbar.

### 2. Launch the Entire Full-Stack Application
From the project root directory (`PERNHrms`), run:

```bash
docker-compose up --build
```
*(Or in background mode: `docker-compose up --build -d`)*

Docker will automatically:
1. 🗄️ Start **PostgreSQL 16** and mount persistent database storage (`postgres_data`).
2. 🔄 Auto-execute all 24 migration scripts in `Back-End/migrations/` on first startup.
3. ⚙️ Build and boot the **Node.js Express Backend API** on port `5005`.
4. 💻 Compile the **React Vite Frontend** and serve via **Nginx** on port `5173` (and port `80`).
5. 🌐 Connect all services seamlessly via the isolated bridge network `pern_hrms_net`.

---

## 🌐 Application Access Endpoints

| Service | Container Name | Host URL | Description |
|---|---|---|---|
| **Frontend** | `pern_hrms_frontend` | [http://localhost:5173](http://localhost:5173) *(or [http://localhost](http://localhost))* | Full HRMS Single Page App (Nginx reverse-proxy) |
| **Backend API** | `pern_hrms_backend` | [http://localhost:5005/api/health](http://localhost:5005/api/health) | Node.js Express REST API |
| **SSE Sync** | `pern_hrms_backend` | [http://localhost:5005/api/sync/stream](http://localhost:5005/api/sync/stream) | Real-time Server-Sent Events stream |
| **Database** | `pern_hrms_postgres` | `localhost:5432` | PostgreSQL 16 (User: `postgres`, DB: `hrms_db`) |

---

## 🛠️ Modes of Operation

### Mode A: Production Mode (Recommended)
Builds production-minified assets and serves via Nginx reverse proxy:
```bash
docker-compose up --build
```

### Mode B: Development Mode (Hot-Reloading)
Mounts source folders directly into containers so code edits update instantly:
```bash
docker-compose -f docker-compose.dev.yml up --build
```

---

## 📋 Useful Docker Commands

```bash
# View live streaming logs across all containers
docker-compose logs -f

# View logs for a specific service (e.g. backend)
docker-compose logs -f backend

# Check status of running containers
docker-compose ps

# Stop all containers (preserves database data volume)
docker-compose down

# Stop and wipe database data volume (clean slate reset)
docker-compose down -v

# Run the realistic data seeder inside the running backend container
docker exec -it pern_hrms_backend node scripts/seed_comp_perf_ops.js
```

---

## 🏗️ Architecture & File Structure

```
PERNHrms/
├── docker-compose.yml           # Main production orchestrator (single command)
├── docker-compose.dev.yml       # Development orchestrator (hot-reloading)
├── .env.docker.example          # Environment variables reference
├── DOCKER_GUIDE.md              # This documentation
├── Back-End/
│   ├── Dockerfile               # Node.js 20 LTS Alpine image definition
│   └── .dockerignore            # Excludes node_modules, tests, logs from build
└── Front-End/
    ├── Dockerfile               # Multi-stage build (Vite compiler -> Nginx server)
    ├── nginx.conf               # Nginx reverse-proxy configuration & SPA routing
    └── .dockerignore            # Excludes node_modules and local build files
```

