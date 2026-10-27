"""
Student Portal Router — /api/student  (role student)
Form 1 (ข้อมูลกลุ่ม) + Form 3 (จัดอันดับอาจารย์แบบนิรนาม)
"""
import json
from typing import List, Tuple, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import require_student
from database import get_db
from services.rounds import (
    get_active_round, get_active_round_optional,
    get_program_round, program_matching_started,
)
import models
import schemas

router = APIRouter(prefix="/api/student", tags=["student"])


def _resolve_group(db: Session, sid: int, user: models.User) -> Tuple[Optional[models.Group], bool]:
    """
    หา group ของนักศึกษาคนนี้ในรอบ sid
    คืน (group, is_representative):
      - เป็นตัวแทน  → group ที่ representative_user_id == user.id
      - เป็นสมาชิก  → group ที่มี StudentMember.student_id == user.student_id
      - ไม่มี       → (None, False)
    """
    rep_group = (
        db.query(models.Group)
        .filter_by(session_id=sid, representative_user_id=user.id)
        .first()
    )
    if rep_group:
        return rep_group, True

    if user.student_id:
        member = (
            db.query(models.StudentMember)
            .filter_by(session_id=sid, student_id=user.student_id)
            .first()
        )
        if member and member.group_id:
            grp = db.query(models.Group).filter_by(id=member.group_id).first()
            if grp:
                return grp, False
    return None, False


def _group_out(group: models.Group) -> schemas.SubmittedGroupOut:
    return schemas.SubmittedGroupOut(
        group_id=group.group_id or group.anonymous_code or group.id,
        anonymous_code=group.anonymous_code,
        representative=group.representative,
        member_count=group.member_count or (len(group.members) if group.members else 0),
        members=[schemas.StudentMemberOut.model_validate(m) for m in group.members],
    )


@router.get("/roster", response_model=List[schemas.RosterOut])
def student_roster(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_student),
):
    """รายชื่อบัญชีนักศึกษาในหลักสูตรเดียวกัน ไว้ให้ตัวแทนเลือกสมาชิกกลุ่ม"""
    q = db.query(models.User).filter_by(role="student")
    if user.program:
        q = q.filter_by(program=user.program)
    out = []
    for u in q.all():
        if u.student_id:
            out.append(schemas.RosterOut(student_id=u.student_id, full_name=u.full_name))
    out.sort(key=lambda r: r.student_id)
    return out


@router.get("/me", response_model=schemas.StudentMeOut)
def student_me(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_student),
):
    session = get_active_round_optional(db, program=user.program)
    pr = get_program_round(db, session, user.program) if session else None
    if not session or pr is None or not pr.is_open:
        return schemas.StudentMeOut(
            round_open=False, codes_generated=False, has_group=False, is_representative=False,
        )

    group, is_rep = _resolve_group(db, session.id, user)

    topics = []
    current_rankings = []
    ranking_submitted = False
    group_out = None
    if group:
        try:
            topics = json.loads(group.topic_interest) if group.topic_interest else []
        except Exception:
            topics = []
        if group.anonymous_code:
            rows = (
                db.query(models.StudentRanking)
                .filter_by(session_id=session.id, group_code=group.anonymous_code)
                .all()
            )
            ranking_submitted = len(rows) > 0
            current_rankings = [
                schemas.ProfRankEntryIn(prof_anonymous_code=r.prof_code, rank=r.rank) for r in rows
            ]
        group_out = _group_out(group)

    return schemas.StudentMeOut(
        round_open=True,
        codes_generated=bool(pr.codes_generated),
        has_group=group is not None,
        is_representative=is_rep,
        group_anonymous_code=group.anonymous_code if group else None,
        ranking_submitted=ranking_submitted,
        matching_started=program_matching_started(db, session.id, user.program),
        is_closed=bool(pr.is_closed),
        representative_name=group.representative if group else None,
        topics=topics,
        current_rankings=current_rankings,
        group=group_out,
    )


@router.post("/form1")
def submit_form1(
    body: schemas.StudentForm1In,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_student),
):
    """สร้าง/แก้ข้อมูลกลุ่ม (Form 1) — เฉพาะตัวแทน, ล็อกเมื่อ generate codes แล้ว"""
    session = get_active_round(db, program=user.program)
    pr = get_program_round(db, session, user.program)
    if pr is None or not pr.is_open:
        raise HTTPException(400, detail="ยังไม่เปิดรอบของหลักสูตรนี้")
    if pr.is_closed:
        raise HTTPException(400, detail="รอบนี้ปิดรับแล้ว ไม่สามารถส่ง/แก้ไขฟอร์มได้")
    if pr.codes_generated:
        raise HTTPException(400, detail="รอบนี้สร้างรหัสนิรนามแล้ว ไม่สามารถแก้ไขข้อมูลกลุ่มได้")

    sid = session.id
    group, is_rep = _resolve_group(db, sid, user)
    if group is not None and not is_rep:
        raise HTTPException(
            403,
            detail=f"คุณเป็นสมาชิกของกลุ่ม {group.anonymous_code or group.group_id or group.id} "
                   f"(ตัวแทน: {group.representative or '—'}) — เฉพาะตัวแทนเท่านั้นที่แก้ไขได้",
        )

    if not body.members:
        raise HTTPException(400, detail="ต้องมีสมาชิกกลุ่มอย่างน้อย 1 คน")

    # auto-include ตัวเอง (ตัวแทน) เป็นสมาชิก ถ้ายังไม่อยู่ในรายการ
    members = list(body.members)
    if user.student_id and not any(m.student_id.strip() == user.student_id for m in members):
        members.insert(0, schemas.StudentMemberIn(student_id=user.student_id, full_name=user.full_name or user.student_id))

    # ── ตรวจว่าทุก member อยู่ใน roster ของหลักสูตร (กัน typo / บัญชีไม่มีจริง) ──
    roster_q = db.query(models.User).filter_by(role="student")
    if user.program:
        roster_q = roster_q.filter_by(program=user.program)
    roster_ids = {u.student_id for u in roster_q.all() if u.student_id}
    bad = [m.student_id for m in members if m.student_id.strip() not in roster_ids]
    if bad:
        raise HTTPException(400, detail=f"รหัสนักศึกษาต่อไปนี้ไม่อยู่ในระบบ/หลักสูตร: {', '.join(bad)}")

    # ── กันสมาชิกซ้ำกับกลุ่มอื่นในรอบเดียวกัน ──
    my_group_id = group.id if group else None
    taken = (
        db.query(models.StudentMember)
        .filter(models.StudentMember.session_id == sid)
        .filter(models.StudentMember.student_id.in_([m.student_id.strip() for m in members]))
    )
    for mem in taken.all():
        if mem.group_id and mem.group_id != my_group_id:
            raise HTTPException(400, detail=f"รหัส {mem.student_id} อยู่ในกลุ่มอื่นแล้ว")

    topics = []
    for title, detail in [
        (body.topic1_title, body.topic1_detail),
        (body.topic2_title, body.topic2_detail),
        (body.topic3_title, body.topic3_detail),
    ]:
        entry = {"title": (title or "").strip()}
        if detail:
            entry["detail"] = detail.strip()
        topics.append(entry)

    member_count = len(members)
    representative = user.full_name or (members[0].full_name.strip() if members else None)

    if group:  # ตัวแทนแก้ไขกลุ่มเดิม
        group.member_count = member_count
        group.representative = representative
        group.topic_interest = json.dumps(topics, ensure_ascii=False)
        group.program = user.program
        db.query(models.StudentMember).filter_by(session_id=sid, group_id=group.id).delete()
        group_id = group.id
    else:
        group = models.Group(
            session_id=sid, group_id=None, anonymous_code=None, program=user.program,
            representative=representative, member_count=member_count,
            topic_interest=json.dumps(topics, ensure_ascii=False),
            representative_user_id=user.id,
        )
        db.add(group)
        db.flush()
        group_id = group.id

    for m in members:
        db.add(models.StudentMember(
            session_id=sid, group_id=group_id, program=user.program,
            student_id=m.student_id.strip(), full_name=m.full_name.strip(),
        ))

    db.commit()
    return {"status": "ok", "group_db_id": group_id, "member_count": member_count}


@router.get("/form3/professors", response_model=List[schemas.AnonProfOut])
def list_professors_for_ranking(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_student),
):
    """รายชื่ออาจารย์แบบนิรนาม (P001..) สำหรับจัดอันดับ — เฉพาะหลัง generate codes"""
    session = get_active_round(db, program=user.program)
    pr = get_program_round(db, session, user.program)
    if pr is None or not pr.codes_generated:
        raise HTTPException(400, detail="ยังไม่เปิดให้จัดอันดับ (แอดมินยังไม่ได้สร้างรหัสนิรนาม)")
    q = db.query(models.Professor).filter_by(session_id=session.id)
    if user.program:
        has_prog = db.query(models.Professor).filter(
            models.Professor.session_id == session.id, models.Professor.program != None
        ).count() > 0
        if has_prog:
            q = q.filter_by(program=user.program)
    profs = [p for p in q.all() if p.anonymous_code]
    profs.sort(key=lambda p: p.anonymous_code)
    return [schemas.AnonProfOut(anonymous_code=p.anonymous_code, expertise=p.expertise) for p in profs]


@router.post("/form3")
def submit_form3(
    body: schemas.StudentForm3In,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_student),
):
    """ส่งการจัดอันดับอาจารย์ (Form 3) — เฉพาะตัวแทน, ล็อกเมื่อเริ่ม matching"""
    session = get_active_round(db, program=user.program)
    pr = get_program_round(db, session, user.program)
    if pr is None or not pr.codes_generated:
        raise HTTPException(400, detail="ยังไม่เปิดให้จัดอันดับ (แอดมินยังไม่ได้สร้างรหัสนิรนาม)")
    if program_matching_started(db, session.id, user.program):
        raise HTTPException(400, detail="ปิดรับการแก้ไขแล้ว เพราะระบบเริ่มรัน Matching ไปแล้ว")
    if pr.is_closed:
        raise HTTPException(400, detail="รอบนี้ปิดรับแล้ว ไม่สามารถส่ง/แก้ไขฟอร์มได้")

    group, is_rep = _resolve_group(db, session.id, user)
    if not group or not group.anonymous_code:
        raise HTTPException(404, detail="ไม่พบกลุ่มของคุณในรอบนี้ หรือยังไม่ได้รับรหัสนิรนาม")
    if not is_rep:
        raise HTTPException(403, detail="เฉพาะตัวแทนกลุ่มเท่านั้นที่จัดอันดับได้")

    gcode = group.anonymous_code
    db.query(models.StudentRanking).filter_by(session_id=session.id, group_code=gcode).delete()
    for entry in body.rankings:
        db.add(models.StudentRanking(
            session_id=session.id, program=group.program,
            group_code=gcode, prof_code=entry.prof_anonymous_code, rank=entry.rank,
        ))
    db.commit()
    return {"status": "ok", "group_anonymous_code": gcode, "rankings_saved": len(body.rankings)}
