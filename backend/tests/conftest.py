import os
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

os.environ["APP_ENV"] = "testing"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.core.config import get_settings
get_settings.cache_clear()

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.change import ChangeCandidate, ChangeJob
from app.models.cluster import Cluster
from app.models.grid_cell import GridCell
from app.models.model_registry import ModelRegistry
from app.models.organisation import Organisation
from app.models.scene import Scene
from app.models.tile import Tile
from app.models.user import User

# In-memory test engine for isolated unit & API test execution
TEST_DB_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def test_org(db_session: Session) -> Organisation:
    org = Organisation(
        id=uuid.uuid4(),
        name="Test Strategic Directorate",
        slug="test-org",
    )
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


@pytest.fixture
def other_org(db_session: Session) -> Organisation:
    org = Organisation(
        id=uuid.uuid4(),
        name="Other Directorate",
        slug="other-org",
    )
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


# Precompute test hash once for blazing fast test fixture execution
PRECOMPUTED_TEST_HASH = "$2b$12$.G4eHAwqRip7ryjlXdlylu5PKI2/.9CwV1k.29l.ivWLWiJ6ya1Lq"


@pytest.fixture
def test_user(db_session: Session, test_org: Organisation) -> User:
    user = User(
        id=uuid.uuid4(),
        organisation_id=test_org.id,
        email="analyst@test.local",
        password_hash=PRECOMPUTED_TEST_HASH,
        display_name="Analyst Rao",
        role="analyst",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def client(db_session: Session, test_user: User) -> Generator[TestClient, None, None]:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def synthetic_raster(tmp_path: Path) -> Path:
    """Creates a temporary synthetic raster fixture for testing."""
    raster_file = tmp_path / "synthetic_s2_scene.tif"
    # Minimal synthetic binary header representing a raster chip
    content = b"II*\x00" + b"\x00" * 1024
    with open(raster_file, "wb") as f:
        f.write(content)
    return raster_file
