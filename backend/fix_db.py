import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, "data", "matching.db")


def run_fix():
    if not os.path.exists(db_path):
        return
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    def add_column_if_not_exists(table, column, definition):
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
            print(f"Added column {column} to {table}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Column {column} already exists in {table}")
            else:
                print(f"Error adding {column} to {table}: {e}")

    # ── MatchingRun columns (v2 algorithm) ────────────────────────────────────
    add_column_if_not_exists("matching_runs", "num_matched_student", "INTEGER DEFAULT 0")
    add_column_if_not_exists("matching_runs", "num_unmatched_student", "INTEGER DEFAULT 0")
    add_column_if_not_exists("matching_runs", "num_matched_professor", "INTEGER DEFAULT 0")
    add_column_if_not_exists("matching_runs", "num_unmatched_professor", "INTEGER DEFAULT 0")
    add_column_if_not_exists("matching_results", "mode", "VARCHAR DEFAULT 'student'")
    add_column_if_not_exists("matching_runs", "mode", "TEXT DEFAULT 'both'")

    # ── Webhook / MS Forms columns (v3 — import_sessions) ────────────────────
    add_column_if_not_exists("import_sessions", "is_active", "BOOLEAN DEFAULT 0")
    add_column_if_not_exists("import_sessions", "source", "VARCHAR DEFAULT 'excel'")
    add_column_if_not_exists("import_sessions", "expected_student_count", "INTEGER")
    add_column_if_not_exists("import_sessions", "expected_prof_count", "INTEGER")
    add_column_if_not_exists("import_sessions", "codes_generated", "BOOLEAN DEFAULT 0")

    # ── student_members table ─────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS student_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES import_sessions(id),
            group_id INTEGER REFERENCES groups(id),
            student_id VARCHAR NOT NULL,
            full_name VARCHAR,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Ensured student_members table exists")

    conn.commit()
    conn.close()
    print("Database migration complete.")


if __name__ == "__main__":
    run_fix()
