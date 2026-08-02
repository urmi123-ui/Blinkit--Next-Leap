import sqlite3
import os
from dotenv import load_dotenv

# Find project root (three levels up from database.py if database.py is in apps/api/)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment configurations
load_dotenv(dotenv_path=os.path.join(os.path.dirname(CURRENT_DIR), ".env")) # apps/.env if exists
load_dotenv(dotenv_path=os.path.join(CURRENT_DIR, ".env")) # apps/api/.env

raw_db_path = os.getenv("SQLITE_DB_PATH", "./data/discovery.db")
if os.path.isabs(raw_db_path):
    DB_PATH = raw_db_path
else:
    DB_PATH = os.path.abspath(os.path.join(CURRENT_DIR, raw_db_path))

def init_db():
    # Ensure directory exists
    dir_name = os.path.dirname(DB_PATH)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name)
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create reviews table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            review_id TEXT PRIMARY KEY,
            review TEXT NOT NULL,
            problem TEXT NOT NULL,
            pain_point TEXT,
            product_area TEXT,
            shopping_goal TEXT,
            barrier_to_new_category TEXT,
            user_persona TEXT,
            emotion TEXT,
            frequency TEXT,
            priority TEXT,
            recommended_action TEXT,
            synced_at TEXT
        )
    """)
    
    # Create sync metadata table to store last sync details
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_meta (
            key TEXT PRIMARY KEY,
            val TEXT
        )
    """)
    
    conn.commit()
    conn.close()

def get_connection():
    return sqlite3.connect(DB_PATH)

def get_unique_filters():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT DISTINCT user_persona FROM reviews WHERE user_persona IS NOT NULL AND user_persona != '' AND LOWER(user_persona) NOT LIKE 'none%'")
    personas = [r[0] for r in cursor.fetchall()]
    
    cursor.execute("SELECT DISTINCT barrier_to_new_category FROM reviews WHERE barrier_to_new_category IS NOT NULL AND barrier_to_new_category != '' AND LOWER(barrier_to_new_category) NOT LIKE 'none%'")
    barriers = [r[0] for r in cursor.fetchall()]

    cursor.execute("SELECT DISTINCT product_area FROM reviews WHERE product_area IS NOT NULL AND product_area != '' AND LOWER(product_area) NOT LIKE 'none%'")
    product_areas = [r[0] for r in cursor.fetchall()]

    cursor.execute("SELECT DISTINCT priority FROM reviews WHERE priority IS NOT NULL AND priority != '' AND LOWER(priority) NOT LIKE 'none%'")
    priorities = [r[0] for r in cursor.fetchall()]

    cursor.execute("SELECT DISTINCT emotion FROM reviews WHERE emotion IS NOT NULL AND emotion != '' AND LOWER(emotion) NOT LIKE 'none%'")
    emotions = [r[0] for r in cursor.fetchall()]
    
    conn.close()
    return {
        "personas": sorted(personas),
        "barriers": sorted(barriers),
        "product_areas": sorted(product_areas),
        "priorities": sorted(priorities),
        "emotions": sorted(emotions)
    }

def get_database_stats():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Personas distribution
    cursor.execute("""
        SELECT user_persona, COUNT(*) as c 
        FROM reviews 
        WHERE user_persona IS NOT NULL 
          AND user_persona != '' 
          AND LOWER(user_persona) NOT LIKE 'none%' 
        GROUP BY user_persona 
        ORDER BY c DESC
    """)
    personas = [{"name": r[0], "count": r[1]} for r in cursor.fetchall()]
    
    # Barriers distribution
    cursor.execute("""
        SELECT barrier_to_new_category, COUNT(*) as c 
        FROM reviews 
        WHERE barrier_to_new_category IS NOT NULL 
          AND barrier_to_new_category != '' 
          AND LOWER(barrier_to_new_category) NOT LIKE 'none%' 
        GROUP BY barrier_to_new_category 
        ORDER BY c DESC
    """)
    barriers = [{"name": r[0], "count": r[1]} for r in cursor.fetchall()]
    
    # Product areas distribution
    cursor.execute("""
        SELECT product_area, COUNT(*) as c 
        FROM reviews 
        WHERE product_area IS NOT NULL 
          AND product_area != '' 
          AND LOWER(product_area) NOT LIKE 'none%' 
        GROUP BY product_area 
        ORDER BY c DESC
    """)
    product_areas = [{"name": r[0], "count": r[1]} for r in cursor.fetchall()]
    
    # Priorities distribution
    cursor.execute("""
        SELECT priority, COUNT(*) as c 
        FROM reviews 
        WHERE priority IS NOT NULL 
          AND priority != '' 
          AND LOWER(priority) NOT LIKE 'none%' 
        GROUP BY priority 
        ORDER BY c DESC
    """)
    priorities = [{"name": r[0], "count": r[1]} for r in cursor.fetchall()]
    
    # Emotions distribution
    cursor.execute("""
        SELECT emotion, COUNT(*) as c 
        FROM reviews 
        WHERE emotion IS NOT NULL 
          AND emotion != '' 
          AND LOWER(emotion) NOT LIKE 'none%' 
        GROUP BY emotion 
        ORDER BY c DESC
    """)
    emotions = [{"name": r[0], "count": r[1]} for r in cursor.fetchall()]
    
    # Top 5 Stated Problems
    cursor.execute("""
        SELECT problem, COUNT(*) as c 
        FROM reviews 
        WHERE problem IS NOT NULL 
          AND problem != '' 
          AND LOWER(problem) NOT LIKE 'none%' 
        GROUP BY problem 
        ORDER BY c DESC 
        LIMIT 5
    """)
    problems = [{"problem": r[0], "count": r[1]} for r in cursor.fetchall()]
    
    # Total row count
    cursor.execute("SELECT COUNT(*) FROM reviews")
    total_reviews = cursor.fetchone()[0]
    
    conn.close()
    return {
        "total_reviews": total_reviews,
        "personas": personas,
        "barriers": barriers,
        "product_areas": product_areas,
        "priorities": priorities,
        "emotions": emotions,
        "problems": problems
    }
