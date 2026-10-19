"""
Download Router — /api/download
Serve uploaded files and result Excel files
"""
import os
import tempfile
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_admin
import models
from services.excel_display import export_rawdata_display, export_result_display
from services.announcement_pdf import build_announcement_pdf

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
    program: Optional[str] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    session = db.query(models.ImportSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(404, "ไม่พบข้อมูล session")

    # ข้อมูลทั้งหมดมาจากฟอร์มในเว็บ — สร้าง Excel สำหรับ "ดาวน์โหลด" (แยกจากไฟล์ที่ feed matching)
    fd, tmp_path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    export_rawdata_display(session_id, program, db, tmp_path)
    base_name = f"round_{program}_session_{session_id}" if program else f"round_session_{session_id}"
    base_name = base_name + ".xlsx"
    background_tasks.add_task(cleanup_temp_file, tmp_path)
    return FileResponse(
        tmp_path,
        filename=base_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.get("/result/{run_id}")
def download_result(
    run_id: int,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    run = db.query(models.MatchingRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "ไม่พบ Run")
    if run.status != "success":
        raise HTTPException(404, "ไม่พบไฟล์ผลลัพธ์ (อาจยังรันไม่เสร็จ)")

    # สร้างไฟล์ผลลัพธ์ "สำหรับดาวน์โหลด" ใหม่จาก DB (+ Tie-Break จากไฟล์ native)
    # — ไม่กระทบไฟล์ native ที่ _import_results ใช้
    fd, tmp_path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    try:
        export_result_display(run_id, db, tmp_path)
    except Exception as e:
        cleanup_temp_file(tmp_path)
        raise HTTPException(500, f"สร้างไฟล์ผลลัพธ์ไม่สำเร็จ: {e}")
    background_tasks.add_task(cleanup_temp_file, tmp_path)
    return FileResponse(
        tmp_path,
        filename=f"result_run{run_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.get("/result/{run_id}/pdf")
def download_result_pdf(
    run_id: int,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    """สร้าง PDF ประกาศผล (อาจารย์ ↔ กลุ่ม + รายชื่อสมาชิก, ไม่มีคะแนน) แล้วส่งให้ดาวน์โหลด"""
    run = db.query(models.MatchingRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "ไม่พบ Run")

    fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    try:
        build_announcement_pdf(run_id, db, tmp_path)
    except Exception as e:
        cleanup_temp_file(tmp_path)
        raise HTTPException(500, f"สร้าง PDF ไม่สำเร็จ: {e}")
    background_tasks.add_task(cleanup_temp_file, tmp_path)
    return FileResponse(
        tmp_path,
        filename=f"announcement_run{run_id}.pdf",
        media_type="application/pdf",
    )
