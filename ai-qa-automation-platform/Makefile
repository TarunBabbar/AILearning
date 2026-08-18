.PHONY: setup db-up db-down db-migrate api web test lint

setup:
	cd apps/web && npm install
	cd apps/api && python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt

db-up:
	docker compose up -d postgres redis temporal temporal-ui

db-down:
	docker compose down

db-migrate:
	cd apps/api && .venv/Scripts/alembic upgrade head

api:
	cd apps/api && .venv/Scripts/uvicorn app.main:app --reload --port 8000

web:
	cd apps/web && npm run dev

test:
	cd apps/api && .venv/Scripts/pytest -q
	cd apps/web && npm test

lint:
	cd apps/api && .venv/Scripts/ruff check .
	cd apps/web && npm run lint
