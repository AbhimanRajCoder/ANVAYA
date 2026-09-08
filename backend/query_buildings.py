from app.database import supabase

res = supabase.table("projects").select("id").order("created_at", desc=True).limit(1).execute()
if res.data:
    pid = res.data[0]['id']
    print(f"Project ID: {pid}")
    b_res = supabase.table("buildings").select("*").eq("project_id", pid).limit(2).execute()
    print("Buildings:")
    print(b_res.data)
else:
    print("No projects")
