import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_settings_requires_secret_key(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_requires_database_url(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_reads_values_from_env(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "s3cret")
    monkeypatch.setenv("DATABASE_URL", "mysql+asyncmy://u:p@db:3306/d")

    settings = Settings(_env_file=None)

    assert settings.secret_key == "s3cret"
    assert settings.database_url == "mysql+asyncmy://u:p@db:3306/d"
