"""
Round service helpers — shared ระหว่าง round / student / professor routers
(ย้ายมาจาก logic เดิมใน webhook.py ที่ทดสอบแล้ว)
"""
import math
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

import models


def get_active_round(db: Session) -> models.ImportSession:
    """ดึงรอบที่กำลังเปิดรับฟอร์มอยู่ — raise 404 ถ้าไม่มี"""
    session = (
        db.query(models.ImportSession)
        .filter_by(is_active=True, source="web")
        .order_by(models.ImportSession.uploaded_at.desc())
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=404,
            detail="ยังไม่มีรอบที่เปิดรับฟอร์มอยู่ กรุณาให้แอดมินเปิดรอบใหม่ก่อน",
        )
    return session


def get_active_round_optional(db: Session) -> Optional[models.ImportSession]:
    """เหมือน get_active_round แต่คืน None แทนการ raise (ใช้กับหน้าสถานะ)"""
    return (
        db.query(models.ImportSession)
        .filter_by(is_active=True, source="web")
        .order_by(models.ImportSession.uploaded_at.desc())
        .first()
    )


def matching_started(db: Session, session_id: int) -> bool:
    """True ถ้ารอบนี้เริ่มรัน matching แล้ว (มี MatchingRun) — ใช้ล็อก Form 3/4"""
    return db.query(models.MatchingRun).filter_by(session_id=session_id).count() > 0


def round_is_closed(db: Session, session: models.ImportSession) -> bool:
    """True ถ้ารอบนี้ปิดรับฟอร์มแล้ว (ปิดเอง หรือเริ่มรัน matching ไปแล้ว)"""
    return bool(session.is_closed) or matching_started(db, session.id)


# ── Per-program round state (สถานะรอบแยกต่อหลักสูตร) ──────────────────────────
def get_program_round(db: Session, session: models.ImportSession, program: Optional[str],
                      create: bool = False) -> Optional[models.ProgramRound]:
    """ดึงสถานะรอบของหลักสูตรนั้นใน session — สร้างใหม่ถ้า create=True"""
    if session is None or not program:
        return None
    pr = (
        db.query(models.ProgramRound)
        .filter_by(session_id=session.id, program=program)
        .first()
    )
    if pr is None and create:
        pr = models.ProgramRound(
            session_id=session.id, program=program,
            is_open=True, is_closed=False, codes_generated=False,
        )
        db.add(pr)
        db.flush()
    return pr


def program_matching_started(db: Session, session_id: int, program: Optional[str]) -> bool:
    """True ถ้าหลักสูตรนี้เริ่มรัน matching แล้ว (มี MatchingRun ของหลักสูตรนั้น)"""
    q = db.query(models.MatchingRun).filter_by(session_id=session_id)
    if program:
        q = q.filter_by(program=program)
    return q.count() > 0


def compute_main_score(score_a: int, score_b: int):
    """คำนวณ sub_score (decimal) และ main_score (floor) จาก score_a, score_b"""
    sub_score = round((score_a + score_b) / 2, 2)
    main_score = math.floor(sub_score)
    return sub_score, main_score


def gen_code(prefix: str, index: int) -> str:
    """สร้าง anonymous_code เช่น G001, G002, P001, P002"""
    return f"{prefix}{index:03d}"
