DEV_COMPOSE := docker compose -f deploy/compose.dev.yaml

.PHONY: dev-up dev-down dev-logs dev-ps test-backend lint-backend check-backend test-frontend build-frontend check-frontend

dev-up:
	$(DEV_COMPOSE) up -d --build

dev-down:
	$(DEV_COMPOSE) down

dev-logs:
	$(DEV_COMPOSE) logs -f --tail=100

dev-ps:
	$(DEV_COMPOSE) ps

test-backend:
	cd backend && .venv/bin/python -m pytest -v

lint-backend:
	cd backend && .venv/bin/ruff check .

check-backend: lint-backend test-backend

test-frontend:
	docker run --rm -v $(PWD)/frontend:/app -w /app node:22-alpine npm test -- --run

build-frontend:
	docker run --rm -v $(PWD)/frontend:/app -w /app node:22-alpine npm run build

check-frontend:
	docker run --rm -v $(PWD)/frontend:/app -w /app node:22-alpine sh -c "npx tsc --noEmit && npm run lint && npm test -- --run"
