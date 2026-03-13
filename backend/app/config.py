from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Thai Rice Price Dashboard API"
    app_env: str = "dev"
    dit_base_url: str = "https://dataapi.moc.go.th"
    dit_rice_product_id: str = "R11001"
    request_timeout_seconds: int = 30
    dit_default_from_date: str = "2025-01-01"
    dit_default_to_date: str = "2025-01-07"
    dit_max_range_days: int = 7
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
