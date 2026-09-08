import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from app.core.config import settings
from app.core.logging import logger
import os

class StorageService:
    def __init__(self):
        self.bucket_name = settings.R2_BUCKET_NAME
        self.endpoint_url = settings.R2_ENDPOINT_URL
        
        # Initialize boto3 client for Cloudflare R2
        if self.bucket_name and self.endpoint_url:
            self.s3_client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                config=Config(signature_version='s3v4'),
                region_name='auto'
            )
        else:
            self.s3_client = None
            logger.warning("R2 storage not configured properly. Missing bucket or credentials.")

    def is_configured(self):
        return self.s3_client is not None

    def upload_file(self, local_filepath: str, object_key: str) -> bool:
        """Upload a file to R2 bucket"""
        if not self.is_configured():
            logger.warning("Cannot upload to R2, service not configured.")
            return False
            
        try:
            self.s3_client.upload_file(local_filepath, self.bucket_name, object_key)
            logger.info(f"Successfully uploaded {local_filepath} to R2 as {object_key}")
            return True
        except ClientError as e:
            logger.error(f"Failed to upload {local_filepath} to R2: {e}")
            return False

    def download_file(self, object_key: str, local_filepath: str) -> bool:
        """Download a file from R2 bucket to local filesystem"""
        if not self.is_configured():
            logger.warning("Cannot download from R2, service not configured.")
            return False
            
        try:
            os.makedirs(os.path.dirname(local_filepath), exist_ok=True)
            self.s3_client.download_file(self.bucket_name, object_key, local_filepath)
            logger.info(f"Successfully downloaded {object_key} from R2 to {local_filepath}")
            return True
        except ClientError as e:
            logger.error(f"Failed to download {object_key} from R2: {e}")
            return False

    def generate_presigned_url(self, object_key: str, expiration_seconds: int = 3600) -> str:
        """Generate a presigned URL to share an R2 object"""
        if not self.is_configured():
            return ""
            
        try:
            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_key},
                ExpiresIn=expiration_seconds
            )
            return response
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL for {object_key}: {e}")
            return ""

    def ensure_local_file(self, r2_uri: str, local_cache_dir: str) -> str:
        """
        Takes an R2 URI (e.g. r2://uploads/uuid.tif) and ensures it exists locally.
        Returns the local filepath. If it's already a local path, returns it directly.
        """
        if not r2_uri.startswith("r2://"):
            return r2_uri
            
        object_key = r2_uri[5:] # Strip r2://
        filename = os.path.basename(object_key)
        local_filepath = os.path.join(local_cache_dir, filename)
        
        if not os.path.exists(local_filepath):
            success = self.download_file(object_key, local_filepath)
            if not success:
                raise FileNotFoundError(f"Failed to download {object_key} from R2 to local cache")
                
        return local_filepath

storage_service = StorageService()
