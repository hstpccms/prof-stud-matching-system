"""
Matching Job Service
Wraps 05_matching_algorithm.py as a backend job
"""
import os
import sys
import json
import re
import tempfile
from datetime import datetime
from sqlalchemy.orm import Session
import openpyxl
import models

# Path to the matching algorithm script
ALGORITHM_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "materials", "05_matching_algorithm.py"
)
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "results")


def _export_input_excel(session_id: int, db: Session, tmp_path: str):
    """Export DB data to Excel format that the algorithm expects."""
    groups = db.query(models.Group).filter_by(session_id=session_id).all()
    professors = db.query(models.Professor).filter_by(session_id=session_id).all()
    rankings = db.query(models.StudentRanking).filter_by(session_id=session_id).all()
    scores = db.query(models.ProfessorScore).filter_by(session_id=session_id).all()

    wb = openpyxl.Workbook()

    # ── Group_Info ──────────────────────────────────────────────────────────
    ws = wb.active
    ws.title = "Group_Info"
    ws.append(["GroupID", "AnonymousCode", "Representative", "MemberCount", "Topic1", "Topic2", "Topic3"])
    for g in groups:
        topics = []
        try:
            topics = json.loads(g.topic_interest) if g.topic_interest else []
        except Exception:
            pass
        while len(topics) < 3:
            topics.append("")
        # แปลง topic dict → string สำหรับเขียนลง Excel
        topic_strs = []
        for t in topics[:3]:
            if isinstance(t, dict):
                title = t.get("title", "")
                detail = t.get("detail", "")
                topic_strs.append(f"{title} — {detail}".strip(" —") if detail else title)
            else:
                topic_strs.append(str(t) if t else "")
        while len(topic_strs) < 3:
            topic_strs.append("")
        ws.append([g.group_id, g.anonymous_code, g.representative, g.member_count] + topic_strs)

    # ── Professor_Info ──────────────────────────────────────────────────────
    ws2 = wb.create_sheet("Professor_Info")
    ws2.append(["ProfID", "AnonymousCode", "FullName", "Expertise", "Quota"])
    for p in professors:
        ws2.append([p.prof_id, p.anonymous_code, p.full_name, p.expertise, p.quota])

    # ── Student_Rankings ────────────────────────────────────────────────────
    ws3 = wb.create_sheet("Student_Rankings")
    prof_codes = [p.anonymous_code for p in professors]
    ws3.append(["GroupCode"] + prof_codes)
    # Build lookup
    rank_lookup = {}
    for r in rankings:
        rank_lookup[(r.group_code, r.prof_code)] = r.rank
    for g in groups:
        gcode = g.anonymous_code
        row = [gcode] + [rank_lookup.get((gcode, pc)) for pc in prof_codes]
        ws3.append(row)

    # ── Professor_Scores ────────────────────────────────────────────────────
    ws4 = wb.create_sheet("Professor_Scores")
    ws4.append(["ProfCode", "GroupCode", "Score_TopicFit_A", "Score_Clarity_B", "SubScore_Decimal", "MainScore_1to100"])
    for s in scores:
        ws4.append([s.prof_code, s.group_code, s.score_a, s.score_b, s.sub_score, s.main_score])

    wb.save(tmp_path)


def run_matching(run_id: int, session_id: int, seed: int, db: Session):
    """
    Execute the matching algorithm as a subprocess.
    Updates the MatchingRun record with results.
    """
    import subprocess
    os.makedirs(RESULTS_DIR, exist_ok=True)

    run = db.query(models.MatchingRun).filter_by(id=run_id).first()
    if not run:
        return

    # Temp input file
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
        tmp_input = f.name

    # Output file path
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    output_filename = f"matching_result_{timestamp}_seed{seed}.xlsx"
    output_path = os.path.join(RESULTS_DIR, output_filename)

    try:
        _export_input_excel(session_id, db, tmp_input)

        # Run the algorithm script
        result = subprocess.run(
            [sys.executable, os.path.abspath(ALGORITHM_PATH),
             "--input", tmp_input,
             "--output", output_path,
             "--seed", str(seed)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )

        stdout = result.stdout if result.stdout is not None else ""
        stderr = result.stderr if result.stderr is not None else ""
        log_output = stdout + ("\nSTDERR:\n" + stderr if stderr else "")

        if result.returncode != 0:
            run.status = "failed"
            run.log = log_output
            db.commit()
            return

        # ── Parse results from stdout (v4 format) ──────────────────────────
        # Example lines:
        #   [Student-Proposing]   Matched: 10/15 | Unmatched: ['G001']
        #   [Professor-Proposing] Matched: 11/15 | Unmatched: []
        #   Tie-break events resolved with seed=2026: 3
        num_matched_student = 0
        num_unmatched_student = 0
        num_matched_professor = 0
        num_unmatched_professor = 0
        num_ties = 0

        for line in result.stdout.splitlines():
            # v4 format: [Student-Proposing]   Matched: X/Y | Unmatched: [...]
            m = re.match(r'\[Student-Proposing\].*Matched:\s*(\d+)/(\d+)', line)
            if m:
                num_matched_student = int(m.group(1))
                total = int(m.group(2))
                num_unmatched_student = total - num_matched_student
                continue

            m = re.match(r'\[Professor-Proposing\].*Matched:\s*(\d+)/(\d+)', line)
            if m:
                num_matched_professor = int(m.group(1))
                total = int(m.group(2))
                num_unmatched_professor = total - num_matched_professor
                continue

            if "Tie-break events" in line:
                parts = re.findall(r'\d+', line.split("seed=")[1] if "seed=" in line else line)
                # "Tie-break events resolved with seed=2026: 3"  → last number is count
                tie_parts = line.split(":")
                if len(tie_parts) >= 2:
                    try:
                        num_ties = int(tie_parts[-1].strip().split()[0])
                    except (ValueError, IndexError):
                        pass

        # Read output Excel and store results in DB (both modes)
        _import_results(run_id, output_path, db)

        # Use student-proposing as the primary "legacy" aggregate
        run.status = "success"
        run.num_matched = num_matched_student
        run.num_unmatched = num_unmatched_student
        run.num_ties = num_ties
        run.num_matched_student = num_matched_student
        run.num_unmatched_student = num_unmatched_student
        run.num_matched_professor = num_matched_professor
        run.num_unmatched_professor = num_unmatched_professor
        run.output_file_path = output_path
        run.log = log_output
        db.commit()

    except subprocess.TimeoutExpired:
        run.status = "failed"
        run.log = "Algorithm timed out after 120 seconds"
        db.commit()
    except Exception as e:
        run.status = "failed"
        run.log = str(e)
        db.commit()
    finally:
        if os.path.exists(tmp_input):
            os.unlink(tmp_input)


def _import_results(run_id: int, output_path: str, db: Session):
    """
    Read output Excel and store results in matching_results table.
    Supports both v4 (Final_Matching_Student / Final_Matching_Professor)
    and legacy v3 (Final_Matching) sheet naming.
    """
    wb = openpyxl.load_workbook(output_path, data_only=True)
    sheetnames = wb.sheetnames

    # v4: two mode sheets
    mode_map = {}
    if "Final_Matching_Student" in sheetnames:
        mode_map["student"] = wb["Final_Matching_Student"]
    if "Final_Matching_Professor" in sheetnames:
        mode_map["professor"] = wb["Final_Matching_Professor"]

    # Fallback to legacy v3 sheet name
    if not mode_map and "Final_Matching" in sheetnames:
        mode_map["student"] = wb["Final_Matching"]

    if not mode_map:
        return

    for mode, ws in mode_map.items():
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or row[0] is None:
                continue
            group_code, assigned_prof, rank_given, main_score, sub_score = row
            result = models.MatchingResult(
                run_id=run_id,
                group_code=str(group_code),
                assigned_prof=str(assigned_prof) if assigned_prof else None,
                rank_given=int(rank_given) if rank_given is not None else None,
                main_score=int(main_score) if main_score is not None else None,
                sub_score=float(sub_score) if sub_score is not None else None,
                mode=mode,
            )
            db.add(result)
