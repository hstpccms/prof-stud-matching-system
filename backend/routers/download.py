"""
Download Router — /api/download
Serve uploaded files and result Excel files
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_admin
import models

router = APIRouter(prefix="/api/download", tags=["download"])


@router.get("/upload/{session_id}")
def download_upload(
    session_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    session = db.query(models.ImportSession).filter_by(id=session_id).first()
    if not session or not session.file_path:
        raise HTTPException(404, "ไม่พบไฟล์")
    if not os.path.exists(session.file_path):
        raise HTTPException(404, "ไฟล์ถูกลบออกจากระบบแล้ว")
    return FileResponse(
        session.file_path,
        filename=session.filename or f"upload_{session_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.get("/result/{run_id}")
def download_result(
    run_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    run = db.query(models.MatchingRun).filter_by(id=run_id).first()
    if not run or not run.output_file_path:
        raise HTTPException(404, "ไม่พบไฟล์ผลลัพธ์ (อาจยังรันไม่เสร็จ)")
    if not os.path.exists(run.output_file_path):
        raise HTTPException(404, "ไฟล์ถูกลบออกจากระบบแล้ว")
    filename = os.path.basename(run.output_file_path)
    return FileResponse(
        run.output_file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
