import os
import sys
import glob
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_drive_service():
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # We assume credentials.json is in the current directory or parent directory
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    return build('drive', 'v3', credentials=creds)

def get_or_create_folder(service, folder_name):
    query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    results = service.files().list(q=query, fields="files(id, name)").execute()
    items = results.get('files', [])
    
    if items:
        return items[0]['id']
    
    # Folder doesn't exist, create it
    folder_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    folder = service.files().create(body=folder_metadata, fields='id').execute()
    print(f"Created Folder '{folder_name}' with ID: {folder.get('id')}")
    return folder.get('id')

def upload_file(service, file_path, folder_id):
    file_name = os.path.basename(file_path)
    
    # Check if file already exists in folder to update or create
    query = f"name = '{file_name}' and '{folder_id}' in parents and trashed = false"
    results = service.files().list(q=query, fields="files(id)").execute()
    items = results.get('files', [])
    
    file_metadata = {
        'name': file_name,
        'parents': [folder_id]
    }
    media = MediaFileUpload(file_path, resumable=True)
    
    if items:
        # Update existing file
        file_id = items[0]['id']
        print(f"Updating existing checkpoint {file_name} (ID: {file_id})...")
        updated_file = service.files().update(
            fileId=file_id,
            media_body=media
        ).execute()
        return updated_file.get('id')
    else:
        # Upload new file
        print(f"Uploading new checkpoint {file_name}...")
        new_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        return new_file.get('id')

def main():
    # Source path for checkpoints
    model_dir = "/Users/abhimanraj/ANAVYA-SIH/MODEL"
    if not os.path.exists(model_dir):
        print(f"Checkpoint directory {model_dir} does not exist.")
        sys.exit(1)
        
    # Gather checkpoint files (.pth, .pt, .ckpt)
    checkpoints = []
    for ext in ['*.pth', '*.pt', '*.ckpt', '*.h5']:
        checkpoints.extend(glob.glob(os.path.join(model_dir, ext)))
        
    if not checkpoints:
        print(f"No checkpoint files found in {model_dir}")
        sys.exit(0)
        
    print(f"Found {len(checkpoints)} checkpoints to upload.")
    
    # Check for credentials.json
    if not os.path.exists('credentials.json') and not os.path.exists('token.json'):
        print("Error: 'credentials.json' not found in current directory.")
        print("Please download credentials.json from Google Cloud Console (OAuth Desktop Client credentials) and place it here.")
        print("Alternative: Run inside a Google Colab notebook cell using standard drive mount.")
        sys.exit(1)
        
    try:
        service = get_drive_service()
        folder_id = get_or_create_folder(service, "ANAVYA Checkpoints")
        
        for cp_path in checkpoints:
            upload_file(service, cp_path, folder_id)
            
        print("All checkpoints uploaded successfully.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    main()
