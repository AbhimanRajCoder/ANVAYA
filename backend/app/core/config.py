import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "ANAVYA Backend"
    API_V1_STR: str = "/api/v1"
    
    # CORS Origins: Comma-separated list or JSON array of origins
    BACKEND_CORS_ORIGINS: Union[str, List[str]] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("BACKEND_CORS_ORIGINS")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return []

    # Supabase Credentials
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # Cloudflare R2 Credentials
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""

    @property
    def R2_ENDPOINT_URL(self) -> str:
        if self.R2_ACCOUNT_ID:
            return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        return ""

    # ML Checkpoints
    MODEL1_CHECKPOINT: str = os.getenv(
        "MODEL1_CHECKPOINT",
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "MODEL",
            "urban_building_deeplabv3_best.pth"
        )
    )
    MODEL1_R2_KEY: str = "checkpoints/urban_building_deeplabv3_best.pth"

    # Inference settings
    TILE_SIZE: int = 512
    OVERLAP: int = 32

    # Storage paths
    BASE_STORAGE_DIR: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "storage"
    )

    @property
    def UPLOADS_DIR(self) -> str:
        return os.path.join(self.BASE_STORAGE_DIR, "uploads")

    @property
    def TILES_DIR(self) -> str:
        return os.path.join(self.BASE_STORAGE_DIR, "tiles")

    @property
    def PREDICTIONS_DIR(self) -> str:
        return os.path.join(self.BASE_STORAGE_DIR, "predictions")

    @property
    def EXPORTS_DIR(self) -> str:
        return os.path.join(self.BASE_STORAGE_DIR, "exports")

    class Config:
        env_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            ".env"
        )
        case_sensitive = True


settings = Settings()

# Ensure directories exist
for directory in [
    settings.BASE_STORAGE_DIR,
    settings.UPLOADS_DIR,
    settings.TILES_DIR,
    settings.PREDICTIONS_DIR,
    settings.EXPORTS_DIR
]:
    os.makedirs(directory, exist_ok=True)
