"""
Matching Router — /api/matching
Run matching job, view history, get results
"""
import threading
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from auth import get_current_admin
import models
import schemas
from services.matching_job import run_matching
from services.validation import validate_session

router = APIRouter(prefix="/api/matching", tags=["matching"])


def _run_in_background(run_id: int, session_id: int, seed: int, program: str):
    """Run matching job in a background thread with its own DB session."""
    db = SessionLocal()
    try:
        run_matching(run_id, session_id, seed, program, db)
    finally:
        db.close()


@router.post("/run", response_model=schemas.MatchingRunOut)
def start_run(
    body: schemas.RunMatchingRequest,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    session = db.query(models.ImportSession).filter_by(id=body.session_id).first()
    if not session:
        raise HTTPException(404, "ไม่พบ Session")

    # Must pass validation
    val = validate_session(body.session_id, db, body.program)
    if not val["passed"]:
        errors = "; ".join(e["message"] for e in val["errors"][:3])
        raise HTTPException(422, f"ข้อมูลยังไม่ผ่านการตรวจสอบ: {errors}")

    # Create run record
    run = models.MatchingRun(
        session_id=body.session_id,
        program=body.program,
        seed=body.seed,
        status="running",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Launch background thread
    thread = threading.Thread(
        target=_run_in_background,
        args=(run.id, body.session_id, body.seed, body.program),
        daemon=True,
    )
    thread.start()

    return run


@router.get("/runs", response_model=List[schemas.MatchingRunOut])
def list_runs(
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    query = db.query(models.MatchingRun)
    if program:
        query = query.filter_by(program=program)
    return query.order_by(models.MatchingRun.run_at.desc()).all()


@router.get("/runs/recent")
def recent_runs(
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    """Return the 3 most recent matching runs with group totals for ratio display."""
    query = db.query(models.MatchingRun)
    if program:
        query = query.filter_by(program=program)
    runs = (
        query
        .order_by(models.MatchingRun.run_at.desc())
        .limit(3)
        .all()
    )
    result = []
    for run in runs:
        q_g = db.query(models.Group).filter_by(session_id=run.session_id)
        if run.program:
            q_g = q_g.filter_by(program=run.program)
        num_groups = q_g.count()
        result.append({
            "id": run.id,
            "run_at": run.run_at,
            "seed": run.seed,
            "mode": run.mode or "both",
            "status": run.status,
            "num_matched": run.num_matched,
            "num_unmatched": run.num_unmatched,
            "num_groups": num_groups,
            "program": run.program,
        })
    return result


@router.get("/runs/{run_id}", response_model=schemas.MatchingRunOut)
def get_run(
    run_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    run = db.query(models.MatchingRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "ไม่พบ Run")
    return run


@router.get("/runs/{run_id}/results", response_model=List[schemas.MatchingResultOut])
def get_results(
    run_id: int,
    mode: Optional[str] = Query(None, description="Filter by mode: 'student' or 'professor'"),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    query = db.query(models.MatchingResult).filter_by(run_id=run_id)
    if mode in ("student", "professor"):
        query = query.filter(models.MatchingResult.mode == mode)
    return query.all()


@router.get("/runs/{run_id}/professor-summary")
def get_professor_summary(
    run_id: int,
    mode: Optional[str] = Query("student", description="Mode: 'student' or 'professor'"),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    """Build professor summary from matching results for a given mode."""
    run = db.query(models.MatchingRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "ไม่พบ Run")

    q_prof = db.query(models.Professor).filter_by(session_id=run.session_id)
    if run.program:
        q_prof = q_prof.filter_by(program=run.program)
    professors = q_prof.all()
    results_query = db.query(models.MatchingResult).filter_by(run_id=run_id)
    if mode in ("student", "professor"):
        results_query = results_query.filter(models.MatchingResult.mode == mode)
    results = results_query.all()

    # Build assignment map
    assignments: dict = {p.anonymous_code: [] for p in professors}
    for r in results:
        if r.assigned_prof and r.assigned_prof != "UNMATCHED":
            if r.assigned_prof in assignments:
                assignments[r.assigned_prof].append(r.group_code)

    summary = []
    for p in professors:
        code = p.anonymous_code
        assigned = assignments.get(code, [])
        summary.append({
            "prof_code": code,
            "full_name": p.full_name,
            "quota": p.quota,
            "groups_assigned": assigned,
            "num_assigned": len(assigned),
            "quota_remaining": (p.quota or 0) - len(assigned),
        })
    return summary


@router.get("/runs/{run_id}/stats")
def get_stats(
    run_id: int,
    mode: Optional[str] = Query(None, description="Mode: 'student' or 'professor' — returns that mode's stats only"),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    run = db.query(models.MatchingRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "ไม่พบ Run")

    results_query = db.query(models.MatchingResult).filter_by(run_id=run_id)
    if mode in ("student", "professor"):
        results_query = results_query.filter(models.MatchingResult.mode == mode)
    results = results_query.all()

    matched = [r for r in results if r.assigned_prof and r.assigned_prof != "UNMATCHED"]
    ranks = [r.rank_given for r in matched if r.rank_given is not None]
    main_scores = [r.main_score for r in matched if r.main_score is not None]
    n = len(results)

    avg_rank = round(sum(ranks) / len(ranks), 2) if ranks else None
    pct_rank1 = round(100 * sum(1 for r in ranks if r == 1) / n, 1) if n else 0
    pct_top3 = round(100 * sum(1 for r in ranks if r <= 3) / n, 1) if n else 0
    avg_main_score = round(sum(main_scores) / len(main_scores), 2) if main_scores else None

    # Resolve num_unmatched from per-mode field if available
    if mode == "student":
        num_unmatched = run.num_unmatched_student
    elif mode == "professor":
        num_unmatched = run.num_unmatched_professor
    else:
        num_unmatched = run.num_unmatched

    return {
        "num_groups": n,
        "num_matched": len(matched),
        "num_unmatched": num_unmatched,
        "avg_rank": avg_rank,
        "pct_rank1": pct_rank1,
        "pct_top3": pct_top3,
        "avg_main_score": avg_main_score,
        "seed": run.seed,
        "num_ties": run.num_ties,
        # Full per-mode breakdown (always returned)
        "student": {
            "num_matched": run.num_matched_student,
            "num_unmatched": run.num_unmatched_student,
        },
        "professor": {
            "num_matched": run.num_matched_professor,
            "num_unmatched": run.num_unmatched_professor,
        },
    }
