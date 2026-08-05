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

    add_column_if_not_exists("matching_runs", "num_matched_student", "INTEGER DEFAULT 0")
    add_column_if_not_exists("matching_runs", "num_unmatched_student", "INTEGER DEFAULT 0")
    add_column_if_not_exists("matching_runs", "num_matched_professor", "INTEGER DEFAULT 0")
    add_column_if_not_exists("matching_runs", "num_unmatched_professor", "INTEGER DEFAULT 0")
    add_column_if_not_exists("matching_results", "mode", "VARCHAR DEFAULT 'student'")
    add_column_if_not_exists("matching_runs", "mode", "TEXT DEFAULT 'both'")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    run_fix()
