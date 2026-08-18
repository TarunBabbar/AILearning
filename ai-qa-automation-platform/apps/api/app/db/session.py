"""DB engine + session factory."""
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ..config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    """FastAPI dependency — yields a scoped session."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
