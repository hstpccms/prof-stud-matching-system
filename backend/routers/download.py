"""
Download Router — /api/download
Serve uploaded files and result Excel files
"""
import os
import tempfile
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_admin
import models
from services.matching_job import _export_input_excel

router = APIRouter(prefix="/api/download", tags=["download"])


def cleanup_temp_file(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


@router.get("/upload/{session_id}")
def download_upload(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    session = db.query(models.ImportSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(404, "ไม่พบข้อมูล session")

    # สำหรับ session ที่มาจาก forms (Webhook) ไม่มีไฟล์ต้นฉบับในระบบ
    # สร้าง Excel on the fly จากข้อมูลในฐานข้อมูลให้เลย
    if session.source == "forms":
        fd, tmp_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(fd)
        _export_input_excel(session_id, db, tmp_path)
        background_tasks.add_task(cleanup_temp_file, tmp_path)
        return FileResponse(
            tmp_path,
            filename=session.filename or f"forms_session_{session_id}.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    if not session.file_path:
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
