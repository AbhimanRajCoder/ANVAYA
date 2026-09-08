import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.database.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    source_file = Column(String(500), nullable=False)
    crs = Column(String(50), nullable=True)
    bounds = Column(JSON, nullable=True)  # [minx, miny, maxx, maxy]
    status = Column(String(50), default="UPLOADED", nullable=False)
    progress = Column(Integer, default=0, nullable=False)
    tiles_processed = Column(Integer, default=0, nullable=False)
    total_tiles = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    buildings = relationship("Building", back_populates="project", cascade="all, delete-orphan")


class Building(Base):
    __tablename__ = "buildings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    # Using srid=4326 (WGS84 EPSG:4326) for latitude/longitude coordinate storage
    geometry = Column(Geometry(geometry_type="POLYGON", srid=4326), nullable=False)
    area = Column(Float, nullable=False)  # area in square meters
    confidence = Column(Float, nullable=False)  # confidence score (0.0 to 1.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="buildings")
