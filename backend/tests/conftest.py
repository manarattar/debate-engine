"""Shared test fixtures: single in-memory SQLite DB for all endpoint tests."""
import os
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(bind=_engine)
Base.metadata.create_all(bind=_engine)


def _override_get_db():
    db = _TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture
def db_session():
    db = _TestingSessionLocal()
    yield db
    db.close()


@pytest.fixture(autouse=True)
def clear_tables(db_session):
    """Wipe all rows before each test for isolation."""
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()
