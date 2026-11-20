import pytest
from app.core.config import Settings, get_settings


def test_default_settings_instantiation():
    settings = get_settings()
    assert settings.APP_NAME == "DRISHTI"
    assert settings.API_V1_PREFIX == "/api"
    assert settings.OFFLINE_MODE is True
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES > 0
    assert settings.SECRET_KEY is not None


def test_cors_origins_parsing():
    settings = Settings(CORS_ORIGINS="http://localhost:3000, http://127.0.0.1:3000")
    assert isinstance(settings.CORS_ORIGINS, list)
    assert len(settings.CORS_ORIGINS) == 2
    assert "http://localhost:3000" in settings.CORS_ORIGINS
    assert "http://127.0.0.1:3000" in settings.CORS_ORIGINS


def test_empty_secret_key_fails_validation():
    with pytest.raises(ValueError):
        Settings(SECRET_KEY="")
