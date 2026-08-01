import sys
import sqlite3
import os

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(CURRENT_DIR)
import database

conn = database.get_connection()
cursor = conn.cursor()

# 1. Print full text for review 1079 and 814 (Brand Handled)
print("=== Return/Refund Friction Handled by Brand vs. Blinkit (Specific Reviews) ===")
cursor.execute("SELECT review_id, review, problem, barrier_to_new_category FROM reviews WHERE review_id IN ('1079', '814')")
for r in cursor.fetchall():
    print(f"ID: {r[0]}")
    print(f"Review: {r[1]}")
    print(f"Problem: {r[2]}")
    print(f"Barrier: {r[3]}")
    print("-" * 50)

# 2. Detailed search for reviews/ratings issues (Absence of reviews/ratings on the app)
print("\n=== Absence of Genuine Reviews / Lack of Ratings ===")
keywords_reviews = ["no review", "no rating", "fake review", "cannot see review", "cannot see rating", "show reviews", "see ratings", "trust reviews", "product reviews"]
where_clauses = []
params = []
for kw in keywords_reviews:
    where_clauses.append("LOWER(review) LIKE ?")
    params.append(f"%{kw}%")

cursor.execute(f"SELECT COUNT(*) FROM reviews WHERE {' OR '.join(where_clauses)}", params)
print(f"Total reviews complaining about ratings/reviews: {cursor.fetchone()[0]}")
cursor.execute(f"SELECT review_id, review FROM reviews WHERE {' OR '.join(where_clauses)} LIMIT 3", params)
for r in cursor.fetchall():
    print(f"- ID: {r[0]}: \"{r[1][:180]}...\"")

# 3. Detailed search for weak discovery/recommendation/search issues
print("\n=== Weak Discovery, Search or Recommendation Issues ===")
keywords_discovery = ["search is bad", "cannot find", "can't find", "hard to find", "search doesn't", "search does not", "search issue", "recommendation", "category", "navigation", "layout"]
where_clauses = []
params = []
for kw in keywords_discovery:
    where_clauses.append("LOWER(review) LIKE ? OR LOWER(problem) LIKE ?")
    params.extend([f"%{kw}%", f"%{kw}%"])

cursor.execute(f"SELECT COUNT(*) FROM reviews WHERE {' OR '.join(where_clauses)}", params)
print(f"Total reviews complaining about search/discovery/categories: {cursor.fetchone()[0]}")
cursor.execute(f"SELECT review_id, review, problem FROM reviews WHERE {' OR '.join(where_clauses)} LIMIT 4", params)
for r in cursor.fetchall():
    print(f"- ID: {r[0]} | Problem: {r[2]}")
    print(f"  Review: \"{r[1][:180]}...\"")
