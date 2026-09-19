from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "personal-stack"
    secret_key: str
    database_url: str
    cors_origins: str = "http://localhost:5173"
    max_upload_size_mb: int = 2048


settings = Settings()
