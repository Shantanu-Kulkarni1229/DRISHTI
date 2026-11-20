from sqlalchemy import text
from app.core.config import get_settings
from app.db.session import engine
from app.core.logging import get_logger

logger = get_logger(__name__)


def init_extensions() -> None:
    """Ensures required PostgreSQL extensions (postgis, vector, pgcrypto) exist."""
    settings = get_settings()
    if "sqlite" in settings.DATABASE_URL or settings.APP_ENV in ("testing", "test"):
        return

    try:
        with engine.begin() as conn:
            if conn.dialect.name == "postgresql":
                logger.info("Initializing PostgreSQL extensions: postgis, vector, pgcrypto")
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto;"))
                logger.info("Database extensions verified.")
            else:
                logger.info("Non-PostgreSQL dialect detected (%s); skipping extension init.", conn.dialect.name)
    except Exception as e:
        logger.warning("Could not initialize extensions directly: %s", str(e))
