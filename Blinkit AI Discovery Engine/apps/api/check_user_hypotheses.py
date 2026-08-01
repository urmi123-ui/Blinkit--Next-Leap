import sys
import sqlite3
import os

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# Load database connection using the project path
sys.path.append(CURRENT_DIR)
import database

conn = database.get_connection()
cursor = conn.cursor()

def search_keywords(name, keywords):
    print("=" * 60)
    print(f"Hypothesis: {name}")
    print(f"Keywords: {keywords}")
    print("=" * 60)
    
    # Formulate query
    where_clauses = []
    params = []
    for kw in keywords:
        where_clauses.append("LOWER(review) LIKE ? OR LOWER(problem) LIKE ? OR LOWER(barrier_to_new_category) LIKE ?")
        params.extend([f"%{kw}%", f"%{kw}%", f"%{kw}%"])
    
    query = f"""
        SELECT review_id, review, problem, barrier_to_new_category 
        FROM reviews 
        WHERE {" OR ".join(where_clauses)}
        LIMIT 5
    """
    
    # Get total count
    count_query = f"""
        SELECT COUNT(*) 
        FROM reviews 
        WHERE {" OR ".join(where_clauses)}
    """
    
    cursor.execute(count_query, params)
    total_count = cursor.fetchone()[0]
    print(f"Total matching reviews in database: {total_count}")
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    if rows:
        print("\nExample reviews:")
        for r in rows:
            print(f"- ID: {r[0]}")
            print(f"  Review: \"{r[1][:140]}...\"")
            print(f"  Problem: \"{r[2]}\"")
            print(f"  Barrier: \"{r[3]}\"\n")
    else:
        print("No direct keyword matches found in this dataset.\n")

# 1. Brand & Product Authenticity Trust Gap
search_keywords(
    "1) Brand & Product Authenticity Trust Gap", 
    ["authent", "fake", "original", "duplicate", "genuine", "counterfeit", "real product", "expired"]
)

# 2. Absence of Genuine Reviews & Ratings
search_keywords(
    "2) Absence of Genuine Reviews & Ratings", 
    ["review", "rating", "star", "feedback", "recommendation"]
)

# 3. Return/Refund Friction Handled by Brand, Not Blinkit
search_keywords(
    "3) Return/Refund Friction Handled by Brand, Not Blinkit", 
    ["brand handles", "handled by brand", "contact brand", "contact manufacturer", "merchant return", "brand warranty", "warranty"]
)

# 4. Weak Discovery & Recommendation Surfacing
search_keywords(
    "4) Weak Discovery & Recommendation Surfacing", 
    ["discover", "recommend", "suggest", "find product", "search", "surface", "navigat", "layout", "category interface"]
)
