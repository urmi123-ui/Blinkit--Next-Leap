import os
import csv
import urllib.request
import urllib.error
import hashlib
import datetime
from dotenv import load_dotenv

import database

load_dotenv()

def run_sync(spreadsheet_id: str = None) -> dict:
    if not spreadsheet_id:
        spreadsheet_id = os.getenv("SPREADSHEET_ID")
        
    if not spreadsheet_id:
        raise ValueError("SPREADSHEET_ID environment variable is missing or empty. Please set SPREADSHEET_ID in your environment variables.")
        
    # Extract spreadsheet ID if a full URL was provided
    spreadsheet_id = spreadsheet_id.strip("'\" \t\r\n")
    if "/d/" in spreadsheet_id:
        spreadsheet_id = spreadsheet_id.split("/d/")[1].split("/")[0]

    print(f"Starting sync for Google Sheet ID: {spreadsheet_id}")
    
    # Export CSV URL
    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv"
    
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            csv_content = response.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        if e.code in (403, 401, 302):
            raise RuntimeError("Google Sheet permission denied. Please click Share in Google Sheets and set General access to 'Anyone with the link' -> 'Viewer'.")
        raise RuntimeError(f"Failed to fetch Google Sheet (HTTP {e.code}): {e.reason}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Failed to connect to Google Sheets: {e.reason}")
    except Exception as e:
        raise RuntimeError(f"Unexpected error when downloading sheet: {str(e)}")

    # Initialize SQLite database
    database.init_db()
    
    # Parse CSV content
    reader = csv.DictReader(csv_content.splitlines())
    
    # Verify required headers exist
    headers = reader.fieldnames if reader.fieldnames else []
    required_cols = ["review", "problem"]
    missing = [col for col in required_cols if col not in headers]
    if missing:
        raise ValueError(f"Google Sheet is missing required columns: {', '.join(missing)}")
        
    conn = database.get_connection()
    cursor = conn.cursor()
    
    # Ensure content_hash column exists (idempotent migration)
    try:
        cursor.execute("ALTER TABLE reviews ADD COLUMN content_hash TEXT")
        conn.commit()
    except Exception:
        pass  # Column already exists
    
    synced_count = 0
    skipped_count = 0
    unchanged_count = 0
    deleted_count = 0
    synced_time = datetime.datetime.utcnow().isoformat() + "Z"
    
    sheet_review_ids = set()
    
    for row_idx, row in enumerate(reader):
        review_text = row.get("review", "").strip()
        problem_text = row.get("problem", "").strip()
        
        # Skip empty reviews
        if not review_text:
            skipped_count += 1
            continue
            
        # Determine review_id
        review_id = row.get("review_id", "").strip()
        if not review_id:
            # Fallback: create content hash
            hasher = hashlib.md5()
            hasher.update(review_text.encode('utf-8'))
            review_id = f"gen-{hasher.hexdigest()[:12]}"
            
        # Resolve duplicate review_ids within the Google Sheet
        if review_id in sheet_review_ids:
            original_review_id = review_id
            suffix_counter = 2
            while f"{original_review_id}_{suffix_counter}" in sheet_review_ids:
                suffix_counter += 1
            review_id = f"{original_review_id}_{suffix_counter}"
            print(f"Warning: duplicate review_id detected in Google Sheet. Suffixed as {review_id}")
            
        sheet_review_ids.add(review_id)
        
        # Normalize and map other fields
        pain_point = row.get("pain_point", "").strip() or None
        product_area = row.get("product_area", "").strip() or None
        shopping_goal = row.get("shopping_goal", "").strip() or None
        barrier = row.get("barrier_to_new_category", "").strip() or None
        persona = row.get("user_persona", "").strip() or None
        emotion = row.get("emotion", "").strip() or None
        frequency = row.get("frequency", "").strip() or None
        priority = row.get("priority", "").strip() or None
        recommended_action = row.get("recommended_action", "").strip() or None

        # Compute a stable content hash over all meaningful fields
        hash_input = "|".join([
            review_text,
            problem_text,
            pain_point or "",
            product_area or "",
            shopping_goal or "",
            barrier or "",
            persona or "",
            emotion or "",
            frequency or "",
            priority or "",
            recommended_action or "",
        ])
        content_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()[:24]

        # Incremental upsert: skip rows whose content hasn't changed
        cursor.execute(
            "SELECT content_hash FROM reviews WHERE review_id = ?", (review_id,)
        )
        existing = cursor.fetchone()
        if existing and existing[0] == content_hash:
            unchanged_count += 1
            continue
        
        # Upsert record
        cursor.execute("""
            INSERT OR REPLACE INTO reviews (
                review_id, review, problem, pain_point, product_area, 
                shopping_goal, barrier_to_new_category, user_persona, 
                emotion, frequency, priority, recommended_action,
                content_hash, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            review_id, review_text, problem_text, pain_point, product_area,
            shopping_goal, barrier, persona, emotion, frequency, priority,
            recommended_action, content_hash, synced_time
        ))
        
        synced_count += 1

    # Reconcile deletions: remove any reviews from SQLite that are no longer in the sheet
    cursor.execute("SELECT review_id FROM reviews")
    db_ids = {r[0] for r in cursor.fetchall()}
    orphans = db_ids - sheet_review_ids
    if orphans:
        print(f"Deleting {len(orphans)} orphaned reviews from SQLite database...")
        orphans_list = list(orphans)
        for i in range(0, len(orphans_list), 900):
            batch = orphans_list[i:i+900]
            placeholders = ",".join(["?"] * len(batch))
            cursor.execute(f"DELETE FROM reviews WHERE review_id IN ({placeholders})", batch)
        deleted_count = len(orphans)

    # Update Sync Metadata
    cursor.execute("INSERT OR REPLACE INTO sync_meta (key, val) VALUES ('last_sync_at', ?)", (synced_time,))
    cursor.execute("INSERT OR REPLACE INTO sync_meta (key, val) VALUES ('row_count', ?)", (str(synced_count + unchanged_count),))
    
    conn.commit()
    conn.close()
    
    # Trigger vector index sync (only if rows changed or rows deleted)
    if synced_count > 0 or deleted_count > 0:
        try:
            import indexer
            indexer.index_delta_reviews()
        except Exception as e:
            print(f"Warning: Vector index sync failed: {str(e)}")
    else:
        print("No changed/deleted rows detected — skipping vector re-index.")
        
    print(f"Sync complete. Synced: {synced_count}, Unchanged: {unchanged_count}, Deleted: {deleted_count}, Skipped empty: {skipped_count}.")
    return {
        "ok": True,
        "row_count": synced_count + unchanged_count,
        "synced_count": synced_count,
        "unchanged_count": unchanged_count,
        "deleted_count": deleted_count,
        "skipped_count": skipped_count,
        "last_sync_at": synced_time
    }

if __name__ == "__main__":
    try:
        res = run_sync()
        print("Success:", res)
    except Exception as e:
        print("Error during CLI sync execution:", str(e))
