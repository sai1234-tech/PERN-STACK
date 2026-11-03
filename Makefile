# =============================================================================
# PERN HRMS - Developer Automation Makefile
# =============================================================================

.PHONY: help up dev down logs ps seed reset test

help:
	@echo "Available commands:"
	@echo "  make up      - Build & start all containers in background"
	@echo "  make dev     - Start development mode with hot-reloading"
	@echo "  make down    - Stop all containers cleanly"
	@echo "  make logs    - Follow live container logs"
	@echo "  make ps      - Display status of running containers"
	@echo "  make seed    - Seed realistic enterprise database records"
	@echo "  make reset   - Reset containers and wipe volumes"
	@echo "  make test    - Run backend unit and integration test suite"

up:
	docker-compose up --build -d

dev:
	docker-compose -f docker-compose.dev.yml up --build

down:
	docker-compose down

logs:
	docker-compose logs -f

ps:
	docker-compose ps

seed:
	docker exec pern_hrms_backend node scripts/seed_all_missing_enterprise_data.js
	docker exec pern_hrms_backend node scripts/seed_comp_perf_ops.js

reset:
	docker-compose down -v
	docker-compose up --build -d

test:
	docker exec pern_hrms_backend npm test

