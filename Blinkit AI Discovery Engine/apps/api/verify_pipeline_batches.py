#!/usr/bin/env python3
"""
verify_pipeline_batches.py
Phase 6: CLI Utility to verify the RAG validation pipeline.
Allows manual testing of questions in batches and inspects the resulting query logs.
Queries the running FastAPI server if available, falling back to local import.
"""
import os
import sys
import json
import time
import urllib.request
import urllib.error

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(CURRENT_DIR)

# Smoke test questions from implementation plan & edge cases
TEST_QUESTIONS = [
    "Why don't users explore new categories?",
    "What shopping habits appear repeatedly?",
    "Which personas are most likely to experiment?",
    "Which barriers occur most frequently?",
    "What unmet needs appear consistently across reviews?"
]

API_URL = "http://localhost:8000/query"
HEALTH_URL = "http://localhost:8000/health"

def check_api_online():
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=2) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                return True, data.get("meta", {}).get("row_count", 0)
    except Exception:
        pass
    return False, 0

def execute_query(q, use_api=True):
    if use_api:
        try:
            req_data = json.dumps({"question": q}).encode("utf-8")
            req = urllib.request.Request(
                API_URL, 
                data=req_data, 
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=60) as response:
                return json.loads(response.read().decode("utf-8")), "API Server (port 8000)"
        except Exception as e:
            print(f"[*] API request failed: {e}. Falling back to local execution...")
    
    # Local fallback
    from schemas import QueryRequest
    import rag_engine
    req_obj = QueryRequest(question=q)
    res_obj = rag_engine.query_rag(req_obj)
    return res_obj.model_dump(), "Local Python Import"

def main():
    print("=" * 70)
    print("      BLINKIT DISCOVERY ENGINE - BATCH VALIDATION PIPELINE VERIFICATION")
    print("=" * 70)
    
    # 1. Check API status
    api_online, api_row_count = check_api_online()
    use_api = api_online
    
    if api_online:
        print(f"[*] Connected to active API Server on port 8000 (Database has {api_row_count} reviews).")
    else:
        print("[*] API Server not detected on port 8000. Operating in offline local import mode.")
        # Database check for local execution
        try:
            import database
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM reviews")
            total_reviews = cursor.fetchone()[0]
            conn.close()
            print(f"[*] Local database connection OK. Contains {total_reviews} reviews.")
        except Exception as e:
            print(f"[!] Database connection failed: {e}")
            sys.exit(1)
            
    print(f"[*] Found {len(TEST_QUESTIONS)} pre-defined smoke queries for testing.")
    print("Options:")
    print("  1. Run all queries sequentially (with 1s delay)")
    print("  2. Run queries in batches of 2")
    print("  3. Run a custom query")
    print("  4. View recent query logs (data/query_log.jsonl)")
    print("  5. Exit")
    
    choice = input("\nEnter option (1-5): ").strip()
    
    if choice == '1':
        run_batch(TEST_QUESTIONS, use_api)
    elif choice == '2':
        batch_size = 2
        for i in range(0, len(TEST_QUESTIONS), batch_size):
            batch = TEST_QUESTIONS[i:i+batch_size]
            print(f"\n--- Running Batch {i // batch_size + 1} of {(len(TEST_QUESTIONS)-1)//batch_size + 1} ---")
            run_batch(batch, use_api)
            if i + batch_size < len(TEST_QUESTIONS):
                input("\nPress Enter to run the next batch...")
    elif choice == '3':
        custom_q = input("\nEnter your custom research query: ").strip()
        if custom_q:
            run_batch([custom_q], use_api)
    elif choice == '4':
        view_logs()
    else:
        print("Exiting.")
        sys.exit(0)

def run_batch(questions, use_api):
    log_path = os.path.join(CURRENT_DIR, "data", "query_log.jsonl")
    initial_log_lines = 0
    if os.path.exists(log_path):
        with open(log_path, "r", encoding="utf-8") as f:
            initial_log_lines = len(f.readlines())

    for idx, q in enumerate(questions):
        print("\n" + "-" * 60)
        print(f"[{idx+1}/{len(questions)}] Query: '{q}'")
        print("-" * 60)
        print("Executing RAG Pipeline (including batched citation validation)...")
        
        start_time = time.time()
        try:
            res_dict, mode = execute_query(q, use_api)
            elapsed = time.time() - start_time
            
            print(f"[*] Executed via: {mode}")
            print(f"[*] Response generated in {elapsed:.2f} seconds.")
            print(f"[*] Evidence Quality: {str(res_dict.get('evidence_quality', 'unknown')).upper()}")
            
            print("\n--- Answer Summary ---")
            print(res_dict.get('answer_summary', 'No summary generated.'))
            
            report = res_dict.get('validation_report')
            if report:
                print("\n--- Validation Quality Report ---")
                accuracy = report.get('citation_accuracy_score', 0)
                print(f"  Citation Accuracy Score : {accuracy * 100:.1f}%")
                print(f"  Citations Checked       : {report.get('total_citations_checked', 0)}")
                print(f"  Citations Failed        : {report.get('total_citations_failed', 0)}")
                print(f"  Average Match Distance  : {report.get('average_retrieval_distance', 0.0):.3f}")
                
                warnings = report.get('warnings', [])
                if warnings:
                    print("  Warnings/Info:")
                    for w in warnings:
                        print(f"    - {w}")
            
            # Print citation IDs
            citations = res_dict.get('citations', [])
            citation_ids = [c.get('review_id') for c in citations if isinstance(c, dict)]
            print(f"\n[*] Validated Citations: {citation_ids if citation_ids else 'None'}")
            
        except Exception as e:
            print(f"[!] Error executing query: {e}")
            
        # Add a tiny delay between queries to respect Groq rate limits
        time.sleep(1)

    print("\n" + "=" * 60)
    print("Batch processing completed.")
    print("=" * 60)
    
    # Verify logging occurred
    if os.path.exists(log_path):
        with open(log_path, "r", encoding="utf-8") as f:
            final_log_lines = len(f.readlines())
        new_logs = final_log_lines - initial_log_lines
        print(f"[*] Query Logger Verification: Logged {new_logs} new entries to {log_path}.")
        view_logs(limit=max(new_logs, 3))
    else:
        print("[!] Warning: Query log file not found at " + log_path)

def view_logs(limit=5):
    log_path = os.path.join(CURRENT_DIR, "data", "query_log.jsonl")
    if not os.path.exists(log_path):
        print(f"[!] No query logs found at {log_path}")
        return
        
    print(f"\n--- Displaying Last {limit} Log Entries from query_log.jsonl ---")
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        recent = lines[-limit:]
        for line in reversed(recent):
            if not line.strip():
                continue
            data = json.loads(line.strip())
            print(f"Timestamp: {data.get('ts')}")
            print(f"  Question: '{data.get('question')}'")
            print(f"  Model   : {data.get('model_name')}")
            print(f"  Evidence: {data.get('evidence_quality')}")
            acc = data.get('citation_accuracy')
            print(f"  Accuracy: {acc * 100 if acc is not None else 'N/A'}%")
            print(f"  Distance: {data.get('avg_distance')}")
            print(f"  Citations: {data.get('retrieved_ids')}")
            print("-" * 40)
    except Exception as e:
        print(f"[!] Error reading logs: {e}")

if __name__ == "__main__":
    main()
