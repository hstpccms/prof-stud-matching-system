"""
Excel Import Service
อ่านไฟล์ Excel 4 ชีต → บันทึกลง Database
"""
import json
from typing import Tuple
import openpyxl
from sqlalchemy.orm import Session
import models


def import_excel(file_path: str, filename: str, db: Session) -> Tuple[int, str]:
    """
    Import Excel file with 4 sheets into DB.
    Returns (session_id, error_message_or_empty)
    """
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
    except Exception as e:
        return -1, f"ไม่สามารถเปิดไฟล์ Excel ได้: {str(e)}"

    required_sheets = {"Group_Info", "Professor_Info", "Student_Rankings", "Professor_Scores"}
    missing = required_sheets - set(wb.sheetnames)
    if missing:
        return -1, f"ไฟล์ขาดชีต: {', '.join(missing)}"

    # Create session
    session = models.ImportSession(filename=filename, file_path=file_path, status="pending")
    db.add(session)
    db.flush()
    sid = session.id

    try:
        _import_group_info(wb["Group_Info"], sid, db)
        _import_professor_info(wb["Professor_Info"], sid, db)
        _import_student_rankings(wb["Student_Rankings"], sid, db)
        _import_professor_scores(wb["Professor_Scores"], sid, db)
        session.status = "imported"
        db.commit()
        return sid, ""
    except Exception as e:
        db.rollback()
        return -1, f"เกิดข้อผิดพลาดระหว่าง Import: {str(e)}"


def _import_group_info(ws, session_id: int, db: Session):
    """
    ชีต Group_Info: GroupID | AnonymousCode | Representative | MemberCount | Topic1 | Topic2 | Topic3
    """
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] is None:
            continue
        # Collect topic columns (index 4 onwards)
        topics = [str(t).strip() for t in row[4:] if t is not None and str(t).strip()]
        group = models.Group(
            session_id=session_id,
            group_id=str(row[0]) if row[0] is not None else None,
            anonymous_code=str(row[1]) if row[1] is not None else None,
            representative=str(row[2]) if row[2] is not None else None,
            member_count=int(row[3]) if row[3] is not None else None,
            topic_interest=json.dumps(topics, ensure_ascii=False),
        )
        db.add(group)


def _import_professor_info(ws, session_id: int, db: Session):
    """
    ชีต Professor_Info: ProfID | AnonymousCode | FullName | Expertise | Quota
    """
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[1] is None:
            continue
        prof = models.Professor(
            session_id=session_id,
            prof_id=str(row[0]) if row[0] is not None else None,
            anonymous_code=str(row[1]),
            full_name=str(row[2]) if row[2] is not None else None,
            expertise=str(row[3]) if row[3] is not None else None,
            quota=int(row[4]) if row[4] is not None else None,
        )
        db.add(prof)


def _import_student_rankings(ws, session_id: int, db: Session):
    """
    ชีต Student_Rankings: GroupCode | ProfCode1 | ProfCode2 | ...
    Row 1 = header: GroupCode, then prof codes
    Row 2+ = group code, then ranks
    """
    prof_codes = [c.value for c in ws[1][1:] if c.value is not None]
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] is None:
            continue
        group_code = str(row[0])
        for i, pcode in enumerate(prof_codes):
            rank_val = row[i + 1]
            if rank_val is None:
                continue
            ranking = models.StudentRanking(
                session_id=session_id,
                group_code=group_code,
                prof_code=str(pcode),
                rank=int(rank_val),
            )
            db.add(ranking)


def _import_professor_scores(ws, session_id: int, db: Session):
    """
    ชีต Professor_Scores: ProfCode | GroupCode | Score_A | Score_B | SubScore | MainScore
    """
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] is None:
            continue
        pcode, gcode = str(row[0]), str(row[1])
        score_a = int(row[2]) if row[2] is not None else None
        score_b = int(row[3]) if row[3] is not None else None
        sub_score = float(row[4]) if row[4] is not None else None
        main_score = int(round(float(row[5]))) if row[5] is not None else None
        score = models.ProfessorScore(
            session_id=session_id,
            prof_code=pcode,
            group_code=gcode,
            score_a=score_a,
            score_b=score_b,
            sub_score=sub_score,
            main_score=main_score,
        )
        db.add(score)
