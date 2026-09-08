import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.database import init_db
from app.models import model_registry
from app.api import health, projects, uploads, processing, buildings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handle startup and shutdown lifecycles:
    1. Initialize the PostgreSQL + PostGIS database.
    2. Load Model 1 checkpoint once at application startup.
    Fails startup if the checkpoint is missing or corrupted.
    """
    logger.info("=== ANAVYA BACKEND STARTUP ===")
    
    # 1. Initialize Database
    try:
        init_db()
    except Exception as e:
        logger.critical(f"Startup aborted: Database bootstrapping failed: {e}")
        raise e

    # 2. Pre-load Model 1 Checkpoint (download from R2 if not on disk)
    checkpoint_path = settings.MODEL1_CHECKPOINT
    if not os.path.exists(checkpoint_path):
        logger.info(f"Checkpoint not found locally at {checkpoint_path}, downloading from R2...")
        try:
            from app.services.storage_service import storage_service
            os.makedirs(os.path.dirname(checkpoint_path), exist_ok=True)
            success = storage_service.download_file(
                settings.MODEL1_R2_KEY, checkpoint_path
            )
            if not success:
                raise RuntimeError(
                    f"Failed to download checkpoint from R2 key '{settings.MODEL1_R2_KEY}'"
                )
            logger.info(f"Checkpoint downloaded successfully to {checkpoint_path}")
        except Exception as e:
            logger.critical(f"Startup aborted: Could not download checkpoint from R2: {e}")
            raise RuntimeError(f"Failed to download Model 1 checkpoint from R2: {e}")

    try:
        model1 = model_registry.get_model("model1_building")
        model1.load_model(checkpoint_path)
    except Exception as e:
        logger.critical(f"Startup aborted: Model 1 checkpoint failed to load: {e}")
        raise RuntimeError(f"Failed to load Model 1 checkpoint at startup: {e}")

    logger.info("=== ANAVYA BACKEND INITIALIZATION COMPLETE ===")
    yield
    logger.info("=== ANAVYA BACKEND SHUTDOWN ===")


# Instantiate FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-based automated urban parcel mapping and building footprint extraction system backend.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
# Root level health check
app.include_router(health.router, tags=["Health"])

# Mounted V1 routers
app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects", tags=["Projects"])
app.include_router(uploads.router, prefix=f"{settings.API_V1_STR}/uploads", tags=["Uploads"])

# Mounting processing and buildings under projects prefix to match requested URLs:
# - POST /api/v1/projects/{id}/process
# - GET /api/v1/projects/{id}/status
app.include_router(processing.router, prefix=f"{settings.API_V1_STR}/projects", tags=["Pipeline"])

# - GET /api/v1/projects/{id}/buildings
app.include_router(buildings.router, prefix=f"{settings.API_V1_STR}/projects", tags=["Results"])
