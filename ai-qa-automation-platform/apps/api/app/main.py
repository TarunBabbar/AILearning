"""FastAPI application entrypoint.

- Loads settings from apps/api/.env at import time (see app/config.py)
- Creates tables via Base.metadata in dev (prod uses Alembic migrations)
- Registers all v1 routers
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1 import auth as auth_api
from .api.v1 import connections as connections_api
from .api.v1 import requirements as requirements_api
from .api.v1 import runs as runs_api
from .api.v1 import testcases as testcases_api
from .api.v1 import webhooks as webhooks_api
from .api.v1 import workspaces as workspaces_api
from .config import settings
from .db.base import Base
from .db.session import engine

app = FastAPI(
    title="AI QA Automation Platform API",
    version="0.1.0",
    description="Workspace-scoped backend for the QA automation platform",
)

# CORS — local dev: web runs on :3000. Lock down in prod (see infra/).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers — all under /api/v1
app.include_router(auth_api.router, prefix="/api/v1")
app.include_router(workspaces_api.router, prefix="/api/v1")
app.include_router(connections_api.router, prefix="/api/v1")
app.include_router(requirements_api.router, prefix="/api/v1")
app.include_router(testcases_api.router, prefix="/api/v1")
app.include_router(runs_api.router, prefix="/api/v1")
app.include_router(webhooks_api.router, prefix="/api/v1")

if settings.env == "local":
    # Dev convenience only — production migrations are Alembic-managed.
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "env": settings.env}
