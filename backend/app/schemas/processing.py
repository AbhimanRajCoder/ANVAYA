from typing import List, Optional
from pydantic import BaseModel


class ProcessingStartResponse(BaseModel):
    project_id: str
    status: str
    message: str


class ProcessingStatusResponse(BaseModel):
    status: str
    progress: int
    tiles_processed: int
    total_tiles: int
    message: Optional[str] = None
    logs: List[str] = []
