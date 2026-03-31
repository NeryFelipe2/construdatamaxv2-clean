import os
import shutil

source_dir = r"C:\Users\felip\Downloads\NOVA NS Versao 5"
target_dir = r"C:\Users\felip\Downloads\construdatamaxv2-clean"

# Protect the main ecosystem from overwriting deployment specs and frontend layout
ignore_files = {"render.yaml", "vercel.json", "package.json", "package-lock.json", ".env"}
ignore_dirs = {".git", ".vscode", "frontend", "__pycache__", "node_modules", ".aider.tags.cache.v4", ".claude"}

def merge_folders():
    success_count = 0
    fail_count = 0
    
    for item in os.listdir(source_dir):
        if item in ignore_files or item in ignore_dirs:
            print(f"Skipping protected/ignored item: {item}")
            continue
            
        src_path = os.path.join(source_dir, item)
        dst_path = os.path.join(target_dir, item)
        
        try:
            if os.path.isdir(src_path):
                # Copy tree recursively, allowing it to overwrite matching files in existing dirs
                shutil.copytree(src_path, dst_path, dirs_exist_ok=True)
                print(f"[OK] Directory Merged: {item}")
            else:
                shutil.copy2(src_path, dst_path)
                print(f"[OK] File Copied: {item}")
            success_count += 1
        except Exception as e:
            print(f"[ERROR] Failed to copy {item}: {e}")
            fail_count += 1
            
    print(f"\nMigration completed with {success_count} successful items and {fail_count} failures.")

if __name__ == "__main__":
    print(f"Starting brutal migration of {source_dir} -> {target_dir}")
    merge_folders()
