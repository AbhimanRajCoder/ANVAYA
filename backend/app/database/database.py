from supabase import create_client, Client
from app.core.config import settings
from app.core.logging import logger

# Initialize Supabase client
if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
    logger.warning("SUPABASE_URL and SUPABASE_KEY are not set. Database operations will fail.")

# Expose a singleton client for the entire application
try:
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
except Exception as e:
    logger.critical(f"Failed to create Supabase client: {e}")
    supabase = None


def init_db():
    """
    Test connection to Supabase database.
    Ensures URL and Key are active and connection works.
    """
    if supabase is None:
        logger.warning("Supabase client is not initialized. Skipping startup DB test.")
        return
        
    try:
        # Perform a lightweight read query to verify API credentials
        supabase.table("projects").select("id").limit(1).execute()
        logger.info("Supabase API connection checked and verified.")
    except Exception as e:
        logger.warning(f"Supabase connection test failed: {e}")
