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
    add_column_if_not_exists("import_sessions", "is_closed", "BOOLEAN DEFAULT 0")
    add_column_if_not_exists("import_sessions", "program", "VARCHAR")

    add_column_if_not_exists("import_sessions", "expected_counts", "TEXT DEFAULT '{}'")

    # ── student_members table ─────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS student_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES import_sessions(id),
            group_id INTEGER REFERENCES groups(id),
            program VARCHAR,
            student_id VARCHAR NOT NULL,
            full_name VARCHAR,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Ensured student_members table exists")
    add_column_if_not_exists("student_members", "program", "VARCHAR")

    # ── Role-based accounts (v5) ──────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR NOT NULL UNIQUE,
            hashed_password VARCHAR NOT NULL,
            role VARCHAR NOT NULL DEFAULT 'student',
            full_name VARCHAR,
            student_id VARCHAR,
            program VARCHAR,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Ensured users table exists")
    add_column_if_not_exists("groups", "representative_user_id", "INTEGER REFERENCES users(id)")
    add_column_if_not_exists("professors", "user_id", "INTEGER REFERENCES users(id)")

    # ── program_rounds: สถานะรอบแยกต่อหลักสูตร ────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS program_rounds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES import_sessions(id),
            program VARCHAR NOT NULL,
            is_open BOOLEAN DEFAULT 1,
            is_closed BOOLEAN DEFAULT 0,
            codes_generated BOOLEAN DEFAULT 0
        )
    """)
    print("Ensured program_rounds table exists")

    # Backfill: ให้ทุก session ที่ active + มีข้อมูล ได้ ProgramRound ต่อหลักสูตร
    cursor.execute("SELECT id, is_closed FROM import_sessions WHERE is_active=1")
    for sid, sclosed in cursor.fetchall():
        cursor.execute(
            "SELECT DISTINCT program FROM groups WHERE session_id=? AND program IS NOT NULL "
            "UNION SELECT DISTINCT program FROM professors WHERE session_id=? AND program IS NOT NULL",
            (sid, sid),
        )
        for (prog,) in cursor.fetchall():
            cursor.execute("SELECT COUNT(*) FROM program_rounds WHERE session_id=? AND program=?", (sid, prog))
            if cursor.fetchone()[0] == 0:
                cursor.execute(
                    "SELECT COUNT(*) FROM groups WHERE session_id=? AND program=? AND anonymous_code IS NOT NULL",
                    (sid, prog),
                )
                cg = 1 if cursor.fetchone()[0] > 0 else 0
                cursor.execute(
                    "INSERT INTO program_rounds (session_id, program, is_open, is_closed, codes_generated) "
                    "VALUES (?,?,1,?,?)",
                    (sid, prog, 1 if sclosed else 0, cg),
                )
                print(f"  backfilled program_round: session {sid} / {prog} (codes={cg})")

    conn.commit()
    conn.close()
    print("Database migration complete.")


if __name__ == "__main__":
    run_fix()
