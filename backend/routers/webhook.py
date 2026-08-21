"""
Webhook Router — /api/webhook
รับข้อมูลจาก MS Forms ผ่าน Power Automate (4 ฟอร์ม)
และจัดการ Active Session lifecycle
"""
import json
import math
import os
import random
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_admin
from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/webhook", tags=["webhook"])

# ── Webhook Secret ────────────────────────────────────────────────────────────
# ตั้งค่าใน .env หรือ environment variable ชื่อ WEBHOOK_SECRET
# Power Automate จะต้องส่ง Header: X-Webhook-Secret: <ค่านี้>
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "changeme-set-in-env")


def _verify_secret(x_webhook_secret: str = Header(None)):
    """Dependency: ตรวจสอบ Webhook Secret Token"""
    if x_webhook_secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")


def _get_active_session(db: Session) -> models.ImportSession:
    """Helper: ดึง Active Session — raise 404 ถ้าไม่มี"""
    session = (
        db.query(models.ImportSession)
        .filter_by(is_active=True, source="forms")
        .order_by(models.ImportSession.uploaded_at.desc())
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=404,
            detail="ไม่มี Active Session ที่กำลังรับฟอร์มอยู่ กรุณาให้แอดมินเปิดรอบรับฟอร์มใหม่ก่อน",
        )
    return session


def _compute_main_score(score_a: int, score_b: int):
    """คำนวณ sub_score และ main_score จาก score_a, score_b"""
    sub_score = round((score_a + score_b) / 2, 2)
    main_score = math.floor(sub_score)
    return sub_score, main_score


def _gen_code(prefix: str, index: int) -> str:
    """สร้าง anonymous_code เช่น G001, G002, P001, P002"""
    return f"{prefix}{index:03d}"


# ── GET /api/webhook/status ───────────────────────────────────────────────────

@router.get("/status", response_model=schemas.WebhookStatusOut)
def webhook_status(
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    """ดึงสถานะ Active Session สำหรับแสดงบน Dashboard (กรองตามหลักสูตรได้)"""
    session = (
        db.query(models.ImportSession)
        .filter_by(is_active=True, source="forms")
        .order_by(models.ImportSession.uploaded_at.desc())
        .first()
    )

    if not session:
        return schemas.WebhookStatusOut(
            session_id=None,
            is_active=False,
            source="forms",
            codes_generated=False,
            expected_student_count=None,
            received_student_count=0,
            received_group_count=0,
            form1_ready=False,
            expected_prof_count=None,
            received_prof_count=0,
            form2_ready=False,
            ranked_group_count=0,
            scored_prof_count=0,
            pct_groups_ranked=0.0,
            pct_profs_scored=0.0,
            group_codes=[],
            prof_codes=[],
        )

    sid = session.id

    # กรองข้อมูลตามโปรแกรม
    query_student = db.query(models.StudentMember.student_id).filter_by(session_id=sid)
    query_group = db.query(models.Group).filter_by(session_id=sid)
    query_prof = db.query(models.Professor).filter_by(session_id=sid)
    
    if program:
        query_student = query_student.filter_by(program=program)
        query_group = query_group.filter_by(program=program)
        query_prof = query_prof.filter_by(program=program)

    unique_student_count = query_student.distinct().count()
    groups = query_group.all()
    professors = query_prof.all()

    received_group = len(groups)
    received_prof = len(professors)

    # อ่านค่า expected_counts ที่เก็บเป็น JSON
    exp_counts_data = {}
    try:
        exp_counts_data = json.loads(session.expected_counts or "{}")
    except:
        pass

    if program:
        exp_s = exp_counts_data.get(program, {}).get("students", 0)
        exp_p = exp_counts_data.get(program, {}).get("profs", 0)
    else:
        exp_s = sum(p.get("students", 0) for p in exp_counts_data.values())
        exp_p = sum(p.get("profs", 0) for p in exp_counts_data.values())

    form1_ready = exp_s > 0 and unique_student_count >= exp_s
    form2_ready = exp_p > 0 and received_prof >= exp_p

    # ── Form 3 & 4 stats ──────────────────────────────────────────────────────
    group_codes_list = [g.anonymous_code for g in groups if g.anonymous_code]
    prof_codes_list = [p.anonymous_code for p in professors if p.anonymous_code]

    query_ranking = db.query(models.StudentRanking).filter_by(session_id=sid)
    query_score = db.query(models.ProfessorScore).filter_by(session_id=sid)
    if program:
        query_ranking = query_ranking.filter_by(program=program)
        query_score = query_score.filter_by(program=program)

    rankings = query_ranking.all()
    scores = query_score.all()

    rankings_by_group: dict = {}
    for r in rankings:
        rankings_by_group.setdefault(r.group_code, set()).add(r.prof_code)

    scores_by_prof: dict = {}
    for s in scores:
        scores_by_prof.setdefault(s.prof_code, set()).add(s.group_code)

    ranked_complete = sum(
        1 for gc in group_codes_list
        if len(rankings_by_group.get(gc, set())) == len(prof_codes_list)
    )
    scored_complete = sum(
        1 for pc in prof_codes_list
        if len(scores_by_prof.get(pc, set())) == len(group_codes_list)
    )
    pct_ranked = round(ranked_complete / len(group_codes_list) * 100, 1) if group_codes_list else 0.0
    pct_scored = round(scored_complete / len(prof_codes_list) * 100, 1) if prof_codes_list else 0.0

    # ── Code tables ───────────────────────────────────────────────────────────
    group_codes_out = [
        schemas.GroupAnonymousCodeOut(
            group_id=g.id,
            anonymous_code=g.anonymous_code or "—",
            member_count=g.member_count or 0,
            representative=g.representative,
            members=[schemas.StudentMemberOut.model_validate(m) for m in g.members]
        )
        for g in groups if g.anonymous_code
    ]
    prof_codes_out = [
        schemas.ProfAnonymousCodeOut(
            prof_id=p.id,
            anonymous_code=p.anonymous_code or "—",
            full_name=p.full_name or "—",
        )
        for p in professors if p.anonymous_code
    ]

    submitted_groups = [
        schemas.SubmittedGroupOut(
            group_id=g.group_id or g.anonymous_code or g.id,
            anonymous_code=g.anonymous_code,
            representative=g.representative,
            member_count=g.member_count or (len(g.members) if g.members else 0),
            members=[schemas.StudentMemberOut.model_validate(m) for m in g.members]
        )
        for g in groups
    ]

    # ── Student tracking list ──────────────────────────────────────────────────
    query_members = db.query(models.StudentMember).filter_by(session_id=sid)
    if program:
        query_members = query_members.filter_by(program=program)
    student_members = query_members.all()

    group_map = {g.id: (g.group_id or g.anonymous_code or f"กลุ่ม #{i+1}") for i, g in enumerate(groups)}

    students_tracking = []
    if student_members:
        for m in student_members:
            students_tracking.append(
                schemas.StudentTrackingOut(
                    id=m.id,
                    student_id=m.student_id,
                    full_name=m.full_name or "—",
                    group_id=group_map.get(m.group_id, "—") if m.group_id else "—",
                    form_submitted=True,
                    status="ส่งแล้ว",
                )
            )
    else:
        for i, g in enumerate(groups, start=1):
            if g.representative:
                students_tracking.append(
                    schemas.StudentTrackingOut(
                        id=g.id,
                        student_id=g.group_id or g.anonymous_code or f"STD-{g.id}",
                        full_name=g.representative,
                        group_id=g.group_id or g.anonymous_code or f"กลุ่ม #{i}",
                        form_submitted=True,
                        status="ส่งแล้ว",
                    )
                )

    # ── Submitted professors with Form 2 & Form 4 status ──────────────────────
    submitted_professors = []
    for i, p in enumerate(professors, start=1):
        p_code = p.anonymous_code or p.prof_id or ""
        scored_count = len(scores_by_prof.get(p_code, set())) if p_code else 0
        total_groups = len(group_codes_list)
        form4_done = total_groups > 0 and scored_count >= total_groups
        submitted_professors.append(
            schemas.SubmittedProfOut(
                prof_id=p.prof_id or p.anonymous_code or f"P{i:03d}",
                anonymous_code=p.anonymous_code,
                full_name=p.full_name or "—",
                expertise=p.expertise or "—",
                quota=p.quota or 0,
                form2_submitted=True,
                form4_submitted=form4_done,
                scores_count=scored_count,
                total_groups_to_score=total_groups,
            )
        )

    return schemas.WebhookStatusOut(
        session_id=sid,
        is_active=session.is_active,
        source=session.source,
        codes_generated=session.codes_generated or False,
        expected_student_count=exp_s,
        received_student_count=unique_student_count,
        received_group_count=received_group,
        form1_ready=form1_ready,
        expected_prof_count=exp_p,
        received_prof_count=received_prof,
        form2_ready=form2_ready,
        ranked_group_count=ranked_complete,
        scored_prof_count=scored_complete,
        pct_groups_ranked=pct_ranked,
        pct_profs_scored=pct_scored,
        group_codes=group_codes_out,
        prof_codes=prof_codes_out,
        submitted_groups=submitted_groups,
        submitted_professors=submitted_professors,
        students=students_tracking,
    )


# ── POST /api/webhook/activate ────────────────────────────────────────────────

@router.post("/activate", response_model=schemas.ImportSessionOut)
def activate_session(
    body: schemas.ActivateSessionRequest,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    """
    แอดมินเปิดรอบรับฟอร์มใหม่
    - ปิด Active Session เดิมก่อน (ถ้ามี)
    - สร้าง ImportSession ใหม่ source="forms", is_active=True
    """
    # ปิด session เดิมที่ยัง active อยู่
    old_sessions = db.query(models.ImportSession).filter_by(is_active=True).all()
    for s in old_sessions:
        s.is_active = False

    session = models.ImportSession(
        filename="forms_session",
        source="forms",
        is_active=True,
        status="pending",
        expected_counts=json.dumps(body.expected_counts, ensure_ascii=False),
        codes_generated=False,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# ── POST /api/webhook/generate-codes ─────────────────────────────────────────

@router.post("/generate-codes")
def generate_codes(
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    """
    แอดมินกดสร้าง Anonymous Code
    - Shuffle กลุ่มและอาจารย์แบบสุ่ม แล้ว assign G001, G002... / P001, P002...
    - ตั้ง codes_generated = True
    """
    session = _get_active_session(db)

    if session.codes_generated:
        raise HTTPException(400, detail="สร้าง Anonymous Code ไปแล้วในรอบนี้")

    groups = db.query(models.Group).filter_by(session_id=session.id).all()
    professors = db.query(models.Professor).filter_by(session_id=session.id).all()

    if not groups:
        raise HTTPException(400, detail="ยังไม่มีข้อมูลกลุ่ม กรุณารอให้นักศึกษาส่ง Form 1 ก่อน")
    if not professors:
        raise HTTPException(400, detail="ยังไม่มีข้อมูลอาจารย์ กรุณารอให้อาจารย์ส่ง Form 2 ก่อน")

    # Shuffle เพื่อให้ anonymous code ไม่เรียงตามลำดับการส่ง
    random.shuffle(groups)
    random.shuffle(professors)

    for i, group in enumerate(groups, start=1):
        group.anonymous_code = _gen_code("G", i)
        group.group_id = _gen_code("G", i)

    for i, prof in enumerate(professors, start=1):
        prof.anonymous_code = _gen_code("P", i)
        prof.prof_id = _gen_code("P", i)

    session.codes_generated = True
    db.commit()

    groups_out = [
        {"group_id": g.id, "anonymous_code": g.anonymous_code, "member_count": g.member_count}
        for g in groups
    ]
    profs_out = [
        {"prof_id": p.id, "anonymous_code": p.anonymous_code, "full_name": p.full_name}
        for p in professors
    ]
    return {
        "status": "codes_generated",
        "session_id": session.id,
        "groups": groups_out,
        "professors": profs_out,
    }


# ── POST /api/webhook/group-info (Form 1) ─────────────────────────────────────

@router.post("/group-info")
def receive_group_info(
    body: schemas.FormGroupInfoIn,
    db: Session = Depends(get_db),
    _secret=Depends(_verify_secret),
):
    """
    รับข้อมูลกลุ่มนักศึกษา (Form 1) จาก Power Automate
    - สร้าง Group ใหม่ (anonymous_code ว่างก่อน จนกว่าแอดมินจะ generate)
    - บันทึก StudentMember ทุกคนในกลุ่ม
    - ป้องกัน duplicate: ถ้า student_id คนแรกซ้ำ → update กลุ่มนั้น
    """
    session = _get_active_session(db)
    sid = session.id

    # ตรวจ duplicate ด้วย student_id คนแรก
    first_student_id = body.members[0].student_id.strip() if body.members else None
    existing_group_id = None
    if first_student_id:
        existing_member = (
            db.query(models.StudentMember)
            .filter_by(session_id=sid, student_id=first_student_id)
            .first()
        )
        if existing_member:
            existing_group_id = existing_member.group_id

    # สร้าง topics list
    topics = []
    for title, detail in [
        (body.topic1_title, body.topic1_detail),
        (body.topic2_title, body.topic2_detail),
        (body.topic3_title, body.topic3_detail),
    ]:
        entry = {"title": title.strip()}
        if detail:
            entry["detail"] = detail.strip()
        topics.append(entry)

    member_count = len(body.members)
    representative = body.members[0].full_name.strip() if body.members else None

    if existing_group_id:
        # Update Group เดิม
        group = db.query(models.Group).filter_by(id=existing_group_id).first()
        if group:
            group.member_count = member_count
            group.representative = representative
            group.topic_interest = json.dumps(topics, ensure_ascii=False)
            group.program = body.program
        # ลบ members เดิมแล้วเพิ่มใหม่
        db.query(models.StudentMember).filter_by(
            session_id=sid, group_id=existing_group_id
        ).delete()
        group_id = existing_group_id
    else:
        # สร้าง Group ใหม่
        group = models.Group(
            session_id=sid,
            group_id=None,
            anonymous_code=None,
            program=body.program,
            representative=representative,
            member_count=member_count,
            topic_interest=json.dumps(topics, ensure_ascii=False),
        )
        db.add(group)
        db.flush()
        group_id = group.id

    # บันทึก StudentMember
    for m in body.members:
        member = models.StudentMember(
            session_id=sid,
            group_id=group_id,
            program=body.program,
            student_id=m.student_id.strip(),
            full_name=m.full_name.strip(),
        )
        db.add(member)

    db.commit()

    unique_students = (
        db.query(models.StudentMember.student_id)
        .filter_by(session_id=sid)
        .distinct()
        .count()
    )

    return {
        "status": "ok",
        "group_db_id": group_id,
        "member_count": member_count,
        "total_unique_students_received": unique_students,
    }


# ── POST /api/webhook/prof-info (Form 2) ──────────────────────────────────────

@router.post("/prof-info")
def receive_prof_info(
    body: schemas.FormProfInfoIn,
    db: Session = Depends(get_db),
    _secret=Depends(_verify_secret),
):
    """
    รับข้อมูลอาจารย์ (Form 2) จาก Power Automate
    - ป้องกัน duplicate ด้วย full_name (update ถ้ามีแล้ว)
    """
    session = _get_active_session(db)
    sid = session.id

    existing = (
        db.query(models.Professor)
        .filter_by(session_id=sid, full_name=body.full_name.strip())
        .first()
    )
    if existing:
        existing.expertise = body.expertise.strip()
        existing.quota = body.quota
        existing.program = body.program
        db.commit()
        received_count = db.query(models.Professor).filter_by(session_id=sid).count()
        return {
            "status": "updated",
            "prof_db_id": existing.id,
            "full_name": existing.full_name,
            "total_profs_received": received_count,
        }

    prof = models.Professor(
        session_id=sid,
        prof_id=None,
        anonymous_code=None,
        program=body.program,
        full_name=body.full_name.strip(),
        expertise=body.expertise.strip(),
        quota=body.quota,
    )
    db.add(prof)
    db.commit()
    db.refresh(prof)

    received_count = db.query(models.Professor).filter_by(session_id=sid).count()

    return {
        "status": "ok",
        "prof_db_id": prof.id,
        "full_name": prof.full_name,
        "total_profs_received": received_count,
        "expected_prof_count": session.expected_prof_count,
    }


# ── POST /api/webhook/student-ranking (Form 3) ────────────────────────────────

@router.post("/student-ranking")
def receive_student_ranking(
    body: schemas.FormStudentRankingIn,
    db: Session = Depends(get_db),
    _secret=Depends(_verify_secret),
):
    """
    รับการจัดอันดับอาจารย์จากนักศึกษา (Form 3)
    - ต้องรัน generate-codes ก่อน
    - ลบอันดับเดิมของกลุ่มนี้ แล้วบันทึกใหม่
    """
    session = _get_active_session(db)
    if not session.codes_generated:
        raise HTTPException(
            400,
            detail="ยังไม่ได้สร้าง Anonymous Code กรุณาให้แอดมินกด Generate Codes ก่อน",
        )
    sid = session.id

    group = (
        db.query(models.Group)
        .filter_by(session_id=sid, anonymous_code=body.group_anonymous_code)
        .first()
    )
    if not group:
        raise HTTPException(
            404,
            detail=f"ไม่พบกลุ่ม anonymous_code='{body.group_anonymous_code}' ในรอบนี้",
        )

    # ลบอันดับเดิม แล้วเพิ่มใหม่
    db.query(models.StudentRanking).filter_by(
        session_id=sid, group_code=body.group_anonymous_code
    ).delete()

    for entry in body.rankings:
        db.add(models.StudentRanking(
            session_id=sid,
            program=group.program,
            group_code=body.group_anonymous_code,
            prof_code=entry.prof_anonymous_code,
            rank=entry.rank,
        ))

    db.commit()
    return {
        "status": "ok",
        "group_anonymous_code": body.group_anonymous_code,
        "rankings_saved": len(body.rankings),
    }


# ── POST /api/webhook/prof-score (Form 4) ─────────────────────────────────────

@router.post("/prof-score")
def receive_prof_score(
    body: schemas.FormProfScoreIn,
    db: Session = Depends(get_db),
    _secret=Depends(_verify_secret),
):
    """
    รับคะแนนจากอาจารย์ (Form 4)
    - ต้องรัน generate-codes ก่อน
    - คำนวณ sub_score, main_score อัตโนมัติ
    - ลบคะแนนเดิมของอาจารย์นี้ แล้วบันทึกใหม่
    """
    session = _get_active_session(db)
    if not session.codes_generated:
        raise HTTPException(
            400,
            detail="ยังไม่ได้สร้าง Anonymous Code กรุณาให้แอดมินกด Generate Codes ก่อน",
        )
    sid = session.id

    prof = (
        db.query(models.Professor)
        .filter_by(session_id=sid, anonymous_code=body.prof_anonymous_code)
        .first()
    )
    if not prof:
        raise HTTPException(
            404,
            detail=f"ไม่พบอาจารย์ anonymous_code='{body.prof_anonymous_code}' ในรอบนี้",
        )

    # ลบคะแนนเดิม แล้วเพิ่มใหม่พร้อมคำนวณ sub/main score
    db.query(models.ProfessorScore).filter_by(
        session_id=sid, prof_code=body.prof_anonymous_code
    ).delete()

    for entry in body.scores:
        sub_score, main_score = _compute_main_score(entry.score_a, entry.score_b)
        db.add(models.ProfessorScore(
            session_id=sid,
            program=prof.program,
            prof_code=body.prof_anonymous_code,
            group_code=entry.group_anonymous_code,
            score_a=entry.score_a,
            score_b=entry.score_b,
            sub_score=sub_score,
            main_score=main_score,
        ))

    db.commit()
    return {
        "status": "ok",
        "prof_anonymous_code": body.prof_anonymous_code,
        "scores_saved": len(body.scores),
    }
