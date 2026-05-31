.PHONY: help build dev seed up down logs clean reset verify nuke seed-es

# Project container names (must match docker-compose.yml)
CONTAINERS := quorafaq-mongodb quorafaq-redis quorafaq-elasticsearch quorafaq-backend quorafaq-frontend quorafaq-nginx
PORTS := 27017 6379 9200 5000 3000

# Auto-detect container runtime
ENGINE := docker
ifneq ($(shell command -v podman 2>/dev/null),)
    ENGINE := podman
endif

# Auto-detect compose command
COMPOSE := $(ENGINE) compose
ifeq ($(ENGINE),podman)
    ifneq ($(shell command -v podman-compose 2>/dev/null),)
        COMPOSE := podman-compose
    endif
endif

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Install dependencies locally (needs Node.js 20.18.0, MongoDB, Redis)
	cd backend && npm ci
	cd frontend && npm ci

dev: ## Run locally with hot-reload (needs Node.js 20.18.0, MongoDB, Redis)
	@echo "Starting backend (port 5000) and frontend (port 3000)..."
	cd backend && npm run dev & cd frontend && npm run dev & wait

seed: ## Seed database inside the backend container
	@$(ENGINE) exec quorafaq-backend npm run seed

seed-es: ## Force re-sync MongoDB data into Elasticsearch
	@$(ENGINE) exec quorafaq-backend node -e " \
		const { initIndices, syncToElasticsearch } = require('./services/searchService'); \
		const mongoose = require('mongoose'); \
		const config = require('./config'); \
		mongoose.connect(config.mongodb.uri).then(async () => { \
			await initIndices(); \
			await syncToElasticsearch(); \
			process.exit(0); \
		}).catch(e => { console.error(e); process.exit(1); }); \
	"

up: _check-ports _clean-stale ## Build and start all services with $(ENGINE)
	$(COMPOSE) up -d --build

down: ## Stop all services
	$(COMPOSE) down

logs: ## View logs from all services
	$(COMPOSE) logs -f

clean: ## Stop and remove all project containers
	@$(COMPOSE) down 2>/dev/null || true
	@for c in $(CONTAINERS); do $(ENGINE) rm -f $$c 2>/dev/null || true; done

nuke: ## Full nuke — remove all project containers, pods, and volumes
	@$(COMPOSE) down -v 2>/dev/null || true
	@for c in $(CONTAINERS); do $(ENGINE) rm -f $$c 2>/dev/null || true; done
	@$(ENGINE) pod rm -af 2>/dev/null || true
	@echo "All project containers, pods, and volumes removed."

reset: nuke ## Full reset — wipes everything and rebuilds from scratch
	$(COMPOSE) build --no-cache 2>/dev/null || true
	$(COMPOSE) up -d

check-integ: ## Verify integrity of seed data
	@sha256sum -c .integrity

verify: check-integ ## Verify reproducibility — checks node version, lockfiles, image tags
	@echo "=== Reproducibility Check ==="
	@echo -n "Node.js version: "; node --version 2>/dev/null || echo "not found"
	@echo -n ".nvmrc: "; cat .nvmrc
	@echo "--- Checking lockfiles ---"
	@test -f backend/package-lock.json && echo "  backend lockfile: OK" || echo "  backend lockfile: MISSING"
	@test -f frontend/package-lock.json && echo "  frontend lockfile: OK" || echo "  frontend lockfile: MISSING"
	@echo "--- Checking pinned images ---"
	@grep -n 'image:' docker-compose.yml | head -20
	@echo "--- Checking npm ci usage ---"
	@grep -rn 'npm ci\|npm install' backend/Dockerfile backend/Dockerfile.dev frontend/Dockerfile frontend/Dockerfile.dev 2>/dev/null
	@echo "=== Check complete ==="

prod-up: _check-ports _clean-stale ## Build and start production services with $(ENGINE) (from podman/)
	$(COMPOSE) -f podman/docker-compose.yml up -d --build

prod-down: ## Stop production services
	$(COMPOSE) -f podman/docker-compose.yml down

prod-logs: ## View production logs
	$(COMPOSE) -f podman/docker-compose.yml logs -f

# ── Internal targets ──────────────────────────────────────────────────

# Remove any stale project containers and orphaned pods before starting
_clean-stale:
	@echo "Cleaning stale containers..."
	@$(COMPOSE) down 2>/dev/null || true
	@for c in $(CONTAINERS); do $(ENGINE) rm -f $$c 2>/dev/null || true; done
	@$(ENGINE) pod rm -af 2>/dev/null || true

# Warn (and attempt to free) if required ports are already occupied
_check-ports:
	@BLOCKED=""; \
	for port in $(PORTS); do \
		pid=$$(ss -tlnp 2>/dev/null | grep ":$$port " | grep -oP 'pid=\K[0-9]+' | head -1); \
		if [ -n "$$pid" ]; then \
			name=$$(ps -p $$pid -o comm= 2>/dev/null || echo "unknown"); \
			echo "⚠  Port $$port is in use by $$name (pid $$pid) — attempting to free..."; \
			kill $$pid 2>/dev/null && sleep 1 && echo "   ✓ Freed port $$port" \
				|| { echo "   ✗ Could not kill pid $$pid — try: sudo kill $$pid"; BLOCKED="$$BLOCKED $$port"; }; \
		fi; \
	done; \
	if [ -n "$$BLOCKED" ]; then \
		echo ""; \
		echo "ERROR: Could not free port(s):$$BLOCKED"; \
		echo "Stop the conflicting services manually and retry."; \
		exit 1; \
	fi
