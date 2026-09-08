from typing import Dict, Any, Optional
from pydantic import BaseModel


class BuildingReviewUpdate(BaseModel):
    review_status: str  # "AI_DETECTED" | "NEEDS_REVIEW" | "APPROVED" | "EDITED" | "REJECTED"
    modified_geometry: Optional[Dict[str, Any]] = None
    reviewed_by: Optional[str] = None
    review_comment: Optional[str] = None


class BuildingResponse(BaseModel):
    building_id: str
    area: float
    confidence: float
    geometry: Dict[str, Any]  # GeoJSON geometry representation
    review_status: Optional[str] = "AI_DETECTED"
    modified_geometry: Optional[Dict[str, Any]] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    review_comment: Optional[str] = None

    class Config:
        from_attributes = True

