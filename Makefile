.PHONY: setup up down migrate seed test lint format logs shell clean

setup:
	@echo "Setting up environment..."
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example"; fi
	@mkdir -p data/imagery data/tiles data/thumbnails data/models data/exports data/local_basemaps

up:
	docker compose up -d --build

down:
	docker compose down

migrate:
	docker compose exec api alembic upgrade head

seed:
	docker compose exec api python scripts/seed_development_data.py

test:
	docker compose exec api pytest -v

lint:
	docker compose exec api ruff check .

format:
	docker compose exec api ruff format .

logs:
	docker compose logs -f api worker
