"""
Professor Portal Router — /api/professor  (role professor)
Form 2 (ข้อมูล + quota) + Form 4 (ให้คะแนนกลุ่มแบบนิรนาม)
"""
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import require_professor
from database import get_db
from services.rounds import (
    get_active_round, get_active_round_optional, compute_main_score,
    get_program_round, program_matching_started,
)
import models
import schemas

router = APIRouter(prefix="/api/professor", tags=["professor"])


def _my_record(db: Session, sid: int, user: models.User):
    """แถว Professor ของผู้ใช้คนนี้ในรอบนี้ — None ถ้ายังไม่ส่ง Form 2"""
    return (
        db.query(models.Professor)
        .filter_by(session_id=sid, user_id=user.id)
        .first()
    )


@router.get("/me", response_model=schemas.ProfessorMeOut)
def professor_me(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_professor),
):
    session = get_active_round_optional(db)
    pr = get_program_round(db, session, user.program) if session else None
    if not session or pr is None or not pr.is_open:
        return schemas.ProfessorMeOut(
            round_open=False, codes_generated=False, info_submitted=False,
        )

    prof = _my_record(db, session.id, user)
    total_groups = db.query(models.Group).filter_by(session_id=session.id, program=user.program).count()
    scored_count = 0
    current_scores = []
    if prof and prof.anonymous_code:
        rows = (
            db.query(models.ProfessorScore)
            .filter_by(session_id=session.id, prof_code=prof.anonymous_code)
            .all()
        )
        scored_count = len(rows)
        current_scores = [
            schemas.GroupScoreEntryIn(
                group_anonymous_code=r.group_code, score_a=r.score_a, score_b=r.score_b
            ) for r in rows
        ]

    return schemas.ProfessorMeOut(
        round_open=True,
        codes_generated=bool(pr.codes_generated),
        info_submitted=prof is not None,
        anonymous_code=prof.anonymous_code if prof else None,
        expertise=prof.expertise if prof else None,
        quota=prof.quota if prof else None,
        score_submitted=scored_count > 0,
        scored_count=scored_count,
        total_groups=total_groups,
        matching_started=program_matching_started(db, session.id, user.program),
        is_closed=bool(pr.is_closed),
        current_scores=current_scores,
    )


@router.post("/form2")
def submit_form2(
    body: schemas.ProfessorForm2In,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_professor),
):
    """ส่ง/แก้ข้อมูลอาจารย์ (Form 2) — ล็อกเมื่อ generate codes แล้ว"""
    session = get_active_round(db)
    pr = get_program_round(db, session, user.program)
    if pr is None or not pr.is_open:
        raise HTTPException(400, detail="ยังไม่เปิดรอบของหลักสูตรนี้")
    if pr.is_closed:
        raise HTTPException(400, detail="รอบนี้ปิดรับแล้ว ไม่สามารถส่ง/แก้ไขฟอร์มได้")
    if pr.codes_generated:
        raise HTTPException(400, detail="รอบนี้สร้างรหัสนิรนามแล้ว ไม่สามารถแก้ไขข้อมูลอาจารย์ได้")

    prof = _my_record(db, session.id, user)
    if prof:
        prof.expertise = body.expertise.strip()
        prof.quota = body.quota
        prof.program = user.program
        prof.full_name = user.full_name or prof.full_name
    else:
        prof = models.Professor(
            session_id=session.id, prof_id=None, anonymous_code=None, program=user.program,
            full_name=user.full_name or user.username, expertise=body.expertise.strip(),
            quota=body.quota, user_id=user.id,
        )
        db.add(prof)
    db.commit()
    return {"status": "ok", "expertise": body.expertise, "quota": body.quota}


@router.get("/form4/groups", response_model=List[schemas.AnonGroupOut])
def list_groups_for_scoring(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_professor),
):
    """รายชื่อกลุ่มแบบนิรนาม (G001..) สำหรับให้คะแนน — เฉพาะหลัง generate codes"""
    session = get_active_round(db)
    pr = get_program_round(db, session, user.program)
    if pr is None or not pr.codes_generated:
        raise HTTPException(400, detail="ยังไม่เปิดให้คะแนน (แอดมินยังไม่ได้สร้างรหัสนิรนาม)")
    q = db.query(models.Group).filter_by(session_id=session.id)
    if user.program:
        has_prog = db.query(models.Group).filter(
            models.Group.session_id == session.id, models.Group.program != None
        ).count() > 0
        if has_prog:
            q = q.filter_by(program=user.program)
    groups = [g for g in q.all() if g.anonymous_code]
    groups.sort(key=lambda g: g.anonymous_code)
    out = []
    for g in groups:
        try:
            topics = json.loads(g.topic_interest) if g.topic_interest else []
        except Exception:
            topics = []
        out.append(schemas.AnonGroupOut(
            anonymous_code=g.anonymous_code, member_count=g.member_count or 0, topics=topics,
        ))
    return out


@router.post("/form4")
def submit_form4(
    body: schemas.ProfessorForm4In,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_professor),
):
    """ส่งคะแนน (Form 4) — คำนวณ sub/main score อัตโนมัติ, resolve อาจารย์จากบัญชี"""
    session = get_active_round(db)
    pr = get_program_round(db, session, user.program)
    if pr is None or not pr.codes_generated:
        raise HTTPException(400, detail="ยังไม่เปิดให้คะแนน (แอดมินยังไม่ได้สร้างรหัสนิรนาม)")
    if program_matching_started(db, session.id, user.program):
        raise HTTPException(400, detail="ปิดรับการแก้ไขแล้ว เพราะระบบเริ่มรัน Matching ไปแล้ว")
    if pr.is_closed:
        raise HTTPException(400, detail="รอบนี้ปิดรับแล้ว ไม่สามารถส่ง/แก้ไขฟอร์มได้")

    prof = _my_record(db, session.id, user)
    if not prof or not prof.anonymous_code:
        raise HTTPException(404, detail="ไม่พบข้อมูลอาจารย์ของคุณในรอบนี้ หรือยังไม่ได้รับรหัสนิรนาม")

    pcode = prof.anonymous_code
    db.query(models.ProfessorScore).filter_by(session_id=session.id, prof_code=pcode).delete()
    for entry in body.scores:
        sub_score, main_score = compute_main_score(entry.score_a, entry.score_b)
        db.add(models.ProfessorScore(
            session_id=session.id, program=prof.program, prof_code=pcode,
            group_code=entry.group_anonymous_code, score_a=entry.score_a, score_b=entry.score_b,
            sub_score=sub_score, main_score=main_score,
        ))
    db.commit()
    return {"status": "ok", "prof_anonymous_code": pcode, "scores_saved": len(body.scores)}
