from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    source_file: str
    crs: Optional[str] = None
    bounds: Optional[List[float]] = None  # [minx, miny, maxx, maxy]


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    tiles_processed: Optional[int] = None
    total_tiles: Optional[int] = None


class ProjectResponse(ProjectBase):
    id: str
    status: str
    progress: int
    tiles_processed: int
    total_tiles: int
    created_at: datetime

    class Config:
        from_attributes = True
