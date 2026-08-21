"""
Data Router — /api/data
Upload Excel, preview data, validate
"""
import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Query
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_admin
import models
import schemas
from services.excel_import import import_excel
from services.validation import validate_session

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads")

router = APIRouter(prefix="/api/data", tags=["data"])


@router.post("/upload", response_model=schemas.ImportSessionOut)
async def upload_file(
    file: UploadFile = File(...),
    program: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(400, "กรุณาอัปโหลดไฟล์ .xlsx เท่านั้น")

    dest = os.path.join(UPLOADS_DIR, file.filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    session_id, error = import_excel(dest, file.filename, db, program)
    if error:
        raise HTTPException(422, detail=error)

    session = db.query(models.ImportSession).filter_by(id=session_id).first()
    return session


@router.get("/sessions", response_model=List[schemas.ImportSessionOut])
def list_sessions(
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    query = db.query(models.ImportSession)
    if program:
        query = query.filter(
            (models.ImportSession.groups.any(models.Group.program == program)) |
            (models.ImportSession.professors.any(models.Professor.program == program)) |
            (models.ImportSession.student_members.any(models.StudentMember.program == program)) |
            (models.ImportSession.matching_runs.any(models.MatchingRun.program == program))
        )
    return query.order_by(models.ImportSession.uploaded_at.desc()).all()


@router.get("/sessions/{session_id}/groups", response_model=List[schemas.GroupOut])
def get_groups(
    session_id: int,
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    query = db.query(models.Group).filter_by(session_id=session_id)
    if program:
        has_prog = db.query(models.Group).filter(models.Group.session_id == session_id, models.Group.program != None).count() > 0
        if has_prog:
            query = query.filter_by(program=program)
    return query.all()


@router.get("/sessions/{session_id}/professors", response_model=List[schemas.ProfessorOut])
def get_professors(
    session_id: int,
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    query = db.query(models.Professor).filter_by(session_id=session_id)
    if program:
        has_prog = db.query(models.Professor).filter(models.Professor.session_id == session_id, models.Professor.program != None).count() > 0
        if has_prog:
            query = query.filter_by(program=program)
    return query.all()


@router.get("/sessions/{session_id}/rankings", response_model=List[schemas.StudentRankingOut])
def get_rankings(
    session_id: int,
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    query = db.query(models.StudentRanking).filter_by(session_id=session_id)
    if program:
        has_prog = db.query(models.StudentRanking).filter(models.StudentRanking.session_id == session_id, models.StudentRanking.program != None).count() > 0
        if has_prog:
            query = query.filter_by(program=program)
    return query.all()


@router.get("/sessions/{session_id}/scores", response_model=List[schemas.ProfessorScoreOut])
def get_scores(
    session_id: int,
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    query = db.query(models.ProfessorScore).filter_by(session_id=session_id)
    if program:
        has_prog = db.query(models.ProfessorScore).filter(models.ProfessorScore.session_id == session_id, models.ProfessorScore.program != None).count() > 0
        if has_prog:
            query = query.filter_by(program=program)
    return query.all()


@router.post("/sessions/{session_id}/validate")
def validate(
    session_id: int,
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    session = db.query(models.ImportSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(404, "ไม่พบ Session")
    result = validate_session(session_id, db, program)
    # Update session status
    session.status = "validated" if result["passed"] else "imported"
    db.commit()
    return result


@router.get("/sessions/latest/dashboard")
def dashboard_stats(
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    """Stats for the Dashboard page using the latest import session."""
    latest_session = (
        db.query(models.ImportSession)
        .order_by(models.ImportSession.uploaded_at.desc())
        .first()
    )
    if not latest_session:
        return {
            "latest_session": None,
            "num_groups": 0,
            "num_professors": 0,
            "total_quota": 0,
            "quota_sufficient": False,
            "pct_groups_ranked": 0.0,
            "pct_profs_scored": 0.0,
            "incomplete_groups": [],
            "incomplete_profs": [],
            "data_stale": False,
            "latest_run": None,
        }

    sid = latest_session.id
    val = validate_session(sid, db, program)
    summary = val["summary"]

    # ── Compute incomplete lists ─────────────────────────────────────────────
    q_groups = db.query(models.Group).filter_by(session_id=sid)
    q_profs = db.query(models.Professor).filter_by(session_id=sid)
    q_rank = db.query(models.StudentRanking).filter_by(session_id=sid)
    q_score = db.query(models.ProfessorScore).filter_by(session_id=sid)
    
    if program:
        has_prog = db.query(models.Group).filter(models.Group.session_id == sid, models.Group.program != None).count() > 0
        if has_prog:
            q_groups = q_groups.filter_by(program=program)
            q_profs = q_profs.filter_by(program=program)
            q_rank = q_rank.filter_by(program=program)
            q_score = q_score.filter_by(program=program)

    groups = q_groups.all()
    professors = q_profs.all()
    rankings = q_rank.all()
    scores = q_score.all()

    group_codes = [g.anonymous_code for g in groups if g.anonymous_code]
    prof_codes = [p.anonymous_code for p in professors if p.anonymous_code]

    # Groups that have not fully ranked all professors
    rankings_by_group: dict = {}
    for r in rankings:
        if r.group_code not in rankings_by_group:
            rankings_by_group[r.group_code] = set()
        rankings_by_group[r.group_code].add(r.prof_code)

    incomplete_groups = [
        g for g in group_codes
        if len(rankings_by_group.get(g, set())) < len(prof_codes)
    ]

    # Profs that have not scored all groups
    scores_by_prof: dict = {}
    for s in scores:
        if s.prof_code not in scores_by_prof:
            scores_by_prof[s.prof_code] = set()
        scores_by_prof[s.prof_code].add(s.group_code)

    incomplete_profs = [
        p for p in prof_codes
        if len(scores_by_prof.get(p, set())) < len(group_codes)
    ]

    # ── Latest run ───────────────────────────────────────────────────────────
    q_run = db.query(models.MatchingRun).filter_by(session_id=sid)
    if program:
        q_run = q_run.filter_by(program=program)
    latest_run = (
        q_run
        .order_by(models.MatchingRun.run_at.desc())
        .first()
    )

    # Data staleness: session uploaded AFTER the latest run
    data_stale = bool(
        latest_run and latest_session.uploaded_at > latest_run.run_at
    )

    # ── Groups summary ───────────────────────────────────────────────────────
    group_map = {g.id: (g.group_id or g.anonymous_code or f"กลุ่ม #{i+1}") for i, g in enumerate(groups)}
    submitted_groups = [
        {
            "group_id": g.group_id or g.anonymous_code or f"G{i+1:03d}",
            "anonymous_code": g.anonymous_code,
            "representative": g.representative,
            "member_count": g.member_count or (len(g.members) if g.members else 0),
            "members": [{"student_id": m.student_id, "full_name": m.full_name} for m in g.members] if g.members else []
        }
        for i, g in enumerate(groups)
    ]

    # ── Student tracking list ──────────────────────────────────────────────────
    q_members = db.query(models.StudentMember).filter_by(session_id=sid)
    if program:
        q_members = q_members.filter_by(program=program)
    student_members = q_members.all()

    students_tracking = []
    if student_members:
        for m in student_members:
            students_tracking.append({
                "id": m.id,
                "student_id": m.student_id,
                "full_name": m.full_name or "—",
                "group_id": group_map.get(m.group_id, "—") if m.group_id else "—",
                "form_submitted": True,
                "status": "ส่งแล้ว",
            })
    else:
        for i, g in enumerate(groups, start=1):
            if g.representative:
                students_tracking.append({
                    "id": g.id,
                    "student_id": g.group_id or g.anonymous_code or f"STD-{g.id}",
                    "full_name": g.representative,
                    "group_id": g.group_id or g.anonymous_code or f"กลุ่ม #{i}",
                    "form_submitted": True,
                    "status": "ส่งแล้ว",
                })

    # ── Professors with Form 2 & Form 4 status ────────────────────────────────
    submitted_professors = []
    for i, p in enumerate(professors, start=1):
        p_code = p.anonymous_code or p.prof_id or ""
        scored_count = len(scores_by_prof.get(p_code, set())) if p_code else 0
        total_groups_to_score = len(group_codes)
        form4_done = total_groups_to_score > 0 and scored_count >= total_groups_to_score
        submitted_professors.append({
            "prof_id": p.prof_id or p.anonymous_code or f"P{i:03d}",
            "anonymous_code": p.anonymous_code,
            "full_name": p.full_name or "—",
            "expertise": p.expertise or "—",
            "quota": p.quota or 0,
            "form2_submitted": True,
            "form4_submitted": form4_done,
            "scores_count": scored_count,
            "total_groups_to_score": total_groups_to_score,
        })

    return {
        "latest_session": {
            "id": latest_session.id,
            "uploaded_at": latest_session.uploaded_at,
            "filename": latest_session.filename,
            "status": latest_session.status,
        },
        # ── ใช้จำนวนจริงจาก DB ทั้งหมด (ไม่จำกัดแค่ที่มี anonymous_code) ──────
        "num_groups": len(groups),
        "num_professors": len(professors),
        "total_quota": sum(p.quota or 0 for p in professors),
        "quota_sufficient": sum(p.quota or 0 for p in professors) >= len(groups) if len(groups) > 0 else True,
        # ── Ranking/Score stats ยังคงใช้ anonymous_code (เพราะ Form 3/4 อ้างอิง code) ──
        "pct_groups_ranked": summary["pct_groups_ranked"],
        "pct_profs_scored": summary["pct_profs_scored"],
        "incomplete_groups": incomplete_groups,
        "incomplete_profs": incomplete_profs,
        "data_stale": data_stale,
        "latest_run": {
            "id": latest_run.id,
            "run_at": latest_run.run_at,
            "seed": latest_run.seed,
            "mode": latest_run.mode or "both",
            "status": latest_run.status,
            "num_matched": latest_run.num_matched,
            "num_unmatched": latest_run.num_unmatched,
            "num_ties": latest_run.num_ties,
            "num_matched_student": latest_run.num_matched_student,
            "num_unmatched_student": latest_run.num_unmatched_student,
            "num_matched_professor": latest_run.num_matched_professor,
            "num_unmatched_professor": latest_run.num_unmatched_professor,
            "output_file_path": latest_run.output_file_path,
            "log": latest_run.log,
            "session_id": latest_run.session_id,
        } if latest_run else None,
        "groups": submitted_groups,
        "professors": submitted_professors,
        "students": students_tracking,
    }
