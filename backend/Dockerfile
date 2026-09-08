# Production Dockerfile for ANAVYA FastAPI ML Backend
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL1_CHECKPOINT=/app/MODEL/urban_building_deeplabv3_best.pth \
    PORT=8000 \
    WEB_CONCURRENCY=1

# Install system dependencies (GDAL, PROJ, PostgreSQL libs, curl for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gdal-bin \
    libgdal-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy python dependency manifest
COPY requirements.txt /app/

# Install CPU-optimized PyTorch & torchvision to minimize container footprint (~200MB vs ~2GB)
RUN grep -v "torch" requirements.txt > req_no_torch.txt && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r req_no_torch.txt

# Copy application source code and model weights
COPY . /app/

# Create required storage directories and non-root user
RUN mkdir -p /app/storage/uploads /app/storage/tiles /app/storage/predictions /app/storage/exports && \
    useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose HTTP port
EXPOSE 8000

# Container healthcheck using FastAPI health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production entrypoint using gunicorn with uvicorn workers
CMD ["gunicorn", "app.main:app", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--timeout", "300"]
