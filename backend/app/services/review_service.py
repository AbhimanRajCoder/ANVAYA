import sqlite3
import json
import os
import datetime
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.logging import logger

DB_PATH = os.path.join(settings.BASE_STORAGE_DIR, "local_reviews.db")

def init_sqlite():
    """Ensure the local reviews SQLite database and tables exist."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS building_reviews (
                building_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                review_status TEXT NOT NULL,
                modified_geometry TEXT,
                reviewed_by TEXT,
                reviewed_at TEXT,
                review_comment TEXT
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_project_id ON building_reviews(project_id)")
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to initialize SQLite local review database: {e}")


def save_local_review(project_id: str, building_id: str, review_data: dict) -> None:
    """Save or update a QA review decision for a building in the local SQLite database."""
    init_sqlite()
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        
        modified_geometry_str = None
        if review_data.get("modified_geometry"):
            modified_geometry_str = json.dumps(review_data["modified_geometry"])
            
        reviewed_at_str = review_data.get("reviewed_at") or datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        cur.execute("""
            INSERT INTO building_reviews (building_id, project_id, review_status, modified_geometry, reviewed_by, reviewed_at, review_comment)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(building_id) DO UPDATE SET
                review_status=excluded.review_status,
                modified_geometry=excluded.modified_geometry,
                reviewed_by=excluded.reviewed_by,
                reviewed_at=excluded.reviewed_at,
                review_comment=excluded.review_comment
        """, (
            building_id,
            project_id,
            review_data["review_status"],
            modified_geometry_str,
            review_data.get("reviewed_by"),
            reviewed_at_str,
            review_data.get("review_comment")
        ))
        conn.commit()
        conn.close()
        logger.info(f"Saved review for building {building_id} in local SQLite.")
    except Exception as e:
        logger.error(f"Failed to save local review in SQLite: {e}")
        raise e


def get_local_reviews(project_id: str) -> Dict[str, Dict[str, Any]]:
    """Retrieve all local review overrides for a project as a dictionary keyed by building_id."""
    if not os.path.exists(DB_PATH):
        return {}
        
    init_sqlite()
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            SELECT building_id, review_status, modified_geometry, reviewed_by, reviewed_at, review_comment 
            FROM building_reviews 
            WHERE project_id = ?
        """, (project_id,))
        rows = cur.fetchall()
        conn.close()
        
        reviews = {}
        for r in rows:
            b_id, status, geom_str, by, at, comment = r
            geom = None
            if geom_str:
                try:
                    geom = json.loads(geom_str)
                except Exception:
                    pass
            reviews[b_id] = {
                "review_status": status,
                "modified_geometry": geom,
                "reviewed_by": by,
                "reviewed_at": at,
                "review_comment": comment
            }
        return reviews
    except Exception as e:
        logger.error(f"Failed to retrieve local reviews from SQLite: {e}")
        return {}


def delete_local_review(building_id: str) -> None:
    """Delete a local review override from SQLite database."""
    init_sqlite()
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM building_reviews WHERE building_id = ?", (building_id,))
        conn.commit()
        conn.close()
        logger.info(f"Deleted local review for building {building_id} in local SQLite.")
    except Exception as e:
        logger.error(f"Failed to delete local review from SQLite: {e}")
        raise e

