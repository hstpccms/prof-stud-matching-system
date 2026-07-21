"""
Data Router — /api/data
Upload Excel, preview data, validate
"""
import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
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
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(400, "กรุณาอัปโหลดไฟล์ .xlsx เท่านั้น")

    dest = os.path.join(UPLOADS_DIR, file.filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    session_id, error = import_excel(dest, file.filename, db)
    if error:
        raise HTTPException(422, detail=error)

    session = db.query(models.ImportSession).filter_by(id=session_id).first()
    return session


@router.get("/sessions", response_model=List[schemas.ImportSessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    return db.query(models.ImportSession).order_by(models.ImportSession.uploaded_at.desc()).all()


@router.get("/sessions/{session_id}/groups", response_model=List[schemas.GroupOut])
def get_groups(
    session_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    return db.query(models.Group).filter_by(session_id=session_id).all()


@router.get("/sessions/{session_id}/professors", response_model=List[schemas.ProfessorOut])
def get_professors(
    session_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    return db.query(models.Professor).filter_by(session_id=session_id).all()


@router.get("/sessions/{session_id}/rankings", response_model=List[schemas.StudentRankingOut])
def get_rankings(
    session_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    return db.query(models.StudentRanking).filter_by(session_id=session_id).all()


@router.get("/sessions/{session_id}/scores", response_model=List[schemas.ProfessorScoreOut])
def get_scores(
    session_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    return db.query(models.ProfessorScore).filter_by(session_id=session_id).all()


@router.post("/sessions/{session_id}/validate")
def validate(
    session_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    session = db.query(models.ImportSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(404, "ไม่พบ Session")
    result = validate_session(session_id, db)
    # Update session status
    session.status = "validated" if result["passed"] else "imported"
    db.commit()
    return result


@router.get("/sessions/latest/dashboard")
def dashboard_stats(
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
            "latest_run": None,
        }

    sid = latest_session.id
    val = validate_session(sid, db)
    summary = val["summary"]

    latest_run = (
        db.query(models.MatchingRun)
        .filter_by(session_id=sid)
        .order_by(models.MatchingRun.run_at.desc())
        .first()
    )

    return {
        "latest_session": {
            "id": latest_session.id,
            "uploaded_at": latest_session.uploaded_at,
            "filename": latest_session.filename,
            "status": latest_session.status,
        },
        "num_groups": summary["num_groups"],
        "num_professors": summary["num_professors"],
        "total_quota": summary["total_quota"],
        "quota_sufficient": summary["quota_sufficient"],
        "pct_groups_ranked": summary["pct_groups_ranked"],
        "pct_profs_scored": summary["pct_profs_scored"],
        "latest_run": {
            "id": latest_run.id,
            "run_at": latest_run.run_at,
            "seed": latest_run.seed,
            "status": latest_run.status,
            "num_matched": latest_run.num_matched,
            "num_unmatched": latest_run.num_unmatched,
            "num_ties": latest_run.num_ties,
            "output_file_path": latest_run.output_file_path,
            "log": latest_run.log,
            "session_id": latest_run.session_id,
        } if latest_run else None,
    }
