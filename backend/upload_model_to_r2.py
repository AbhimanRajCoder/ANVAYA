"""
One-time script to upload the Model 1 checkpoint to Cloudflare R2.
Run from the backend directory: python upload_model_to_r2.py
"""
import os
import boto3
from botocore.client import Config

# R2 credentials (from .env)
R2_ACCOUNT_ID = "3b8498174724586586afc41e5c352499"
R2_ACCESS_KEY_ID = "2e116d212e5ee5c4a43733cd6daa4f36"
R2_SECRET_ACCESS_KEY = "c5f8fdb727349b6132bfce947a19d15f9e9cb260da424758e638cbb68ff5df34"
R2_BUCKET_NAME = "anvaya-uploads"
R2_ENDPOINT_URL = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Local model file and R2 destination key
LOCAL_MODEL_PATH = os.path.join(os.path.dirname(__file__), "MODEL", "urban_building_deeplabv3_best.pth")
R2_OBJECT_KEY = "checkpoints/urban_building_deeplabv3_best.pth"


def main():
    if not os.path.exists(LOCAL_MODEL_PATH):
        print(f"ERROR: Model file not found at {LOCAL_MODEL_PATH}")
        return

    file_size_mb = os.path.getsize(LOCAL_MODEL_PATH) / (1024 * 1024)
    print(f"Uploading {LOCAL_MODEL_PATH} ({file_size_mb:.1f} MB) to R2...")
    print(f"  Bucket: {R2_BUCKET_NAME}")
    print(f"  Key:    {R2_OBJECT_KEY}")

    s3_client = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

    # Use multipart upload for large files
    from boto3.s3.transfer import TransferConfig
    transfer_config = TransferConfig(
        multipart_threshold=50 * 1024 * 1024,  # 50 MB
        multipart_chunksize=50 * 1024 * 1024,
        max_concurrency=4
    )

    s3_client.upload_file(
        LOCAL_MODEL_PATH,
        R2_BUCKET_NAME,
        R2_OBJECT_KEY,
        Config=transfer_config
    )

    print(f"\n✅ Upload complete! Model is now at: r2://{R2_BUCKET_NAME}/{R2_OBJECT_KEY}")
    print("You can now deploy to Railway — the backend will auto-download this on startup.")


if __name__ == "__main__":
    main()
