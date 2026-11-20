from functools import lru_cache
from pathlib import Path
from typing import List, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine DRISHTI workspace root (3 directories up from app/core/config.py: config.py -> core [0] -> app [1] -> backend [2] -> DRISHTI [3])
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            str(PROJECT_ROOT / ".env"),
            str(PROJECT_ROOT / "backend" / ".env"),
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    APP_NAME: str = "DRISHTI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api"

    # Security
    SECRET_KEY: str = Field(default="dev-insecure-secret-key-change-in-production-drishti-2026")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Database
    POSTGRES_DB: str = "drishti"
    POSTGRES_USER: str = "drishti"
    POSTGRES_PASSWORD: str = "drishti_dev_password"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = Field(
        default="postgresql+psycopg://drishti:drishti_dev_password@localhost:5432/drishti"
    )

    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Storage Paths (anchored cleanly within DRISHTI workspace)
    STORAGE_BACKEND: str = "local"
    DATA_ROOT: Path = Field(default=DEFAULT_DATA_DIR)
    IMAGERY_ROOT: Path = Field(default=DEFAULT_DATA_DIR / "imagery")
    TILE_ROOT: Path = Field(default=DEFAULT_DATA_DIR / "tiles")
    THUMBNAIL_ROOT: Path = Field(default=DEFAULT_DATA_DIR / "thumbnails")
    MODEL_ROOT: Path = Field(default=DEFAULT_DATA_DIR / "models")
    EXPORT_ROOT: Path = Field(default=DEFAULT_DATA_DIR / "exports")
    LOCAL_BASEMAP_ROOT: Path = Field(default=DEFAULT_DATA_DIR / "local_basemaps")

    # Vector Search & Embeddings
    VECTOR_BACKEND: str = "pgvector"
    EMBEDDING_DEVICE: str = "cpu"
    VECTOR_DIMENSION_CLIP: int = 768
    VECTOR_DIMENSION_DINO: int = 768

    REMOTECLIP_MODEL_PATH: Path = Field(default=DEFAULT_DATA_DIR / "models" / "remoteclip")
    DINOV2_MODEL_PATH: Path = Field(default=DEFAULT_DATA_DIR / "models" / "dinov2")
    CHANGE_MODEL_PATH: Path = Field(default=DEFAULT_DATA_DIR / "models" / "change_detection")

    # CORS
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    MAX_UPLOAD_SIZE_MB: int = 2048

    # Offline Guards
    OFFLINE_MODE: bool = True
    HF_HUB_OFFLINE: int = 1
    TRANSFORMERS_OFFLINE: int = 1

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        if not v or v.strip() == "":
            raise ValueError("SECRET_KEY cannot be empty.")
        return v

    def ensure_directories(self) -> None:
        """Ensure all runtime data directories exist."""
        for path in [
            self.DATA_ROOT,
            self.IMAGERY_ROOT,
            self.TILE_ROOT,
            self.THUMBNAIL_ROOT,
            self.MODEL_ROOT,
            self.EXPORT_ROOT,
            self.LOCAL_BASEMAP_ROOT,
        ]:
            try:
                path.mkdir(parents=True, exist_ok=True)
            except OSError:
                pass


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_directories()
    return settings
