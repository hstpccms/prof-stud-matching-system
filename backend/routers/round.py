"""
Round Router — /api/round  (admin เท่านั้น)
จัดการรอบรับฟอร์ม (open / generate-codes / status)
แทนที่ webhook/activate + generate-codes + status เดิม
"""
import json
import random
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import require_admin
from database import get_db
from services.rounds import (
    get_active_round, get_active_round_optional, gen_code,
    get_program_round, program_matching_started,
)
import models
import schemas

router = APIRouter(prefix="/api/round", tags=["round"])


def _clear_program_data(db: Session, sid: int, program: str):
    """ล้างข้อมูลของหลักสูตรนั้นใน session (ใช้ตอนเปิดรอบใหม่) — ไม่แตะหลักสูตรอื่น"""
    db.query(models.StudentMember).filter_by(session_id=sid, program=program).delete()
    db.query(models.Group).filter_by(session_id=sid, program=program).delete()
    db.query(models.Professor).filter_by(session_id=sid, program=program).delete()
    db.query(models.StudentRanking).filter_by(session_id=sid, program=program).delete()
    db.query(models.ProfessorScore).filter_by(session_id=sid, program=program).delete()
    for r in db.query(models.MatchingRun).filter_by(session_id=sid, program=program).all():
        db.delete(r)  # cascade ลบ MatchingResult


# ── POST /api/round/open ──────────────────────────────────────────────────────
@router.post("/open", response_model=schemas.ImportSessionOut)
def open_round(
    body: schemas.OpenRoundRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """เปิดรอบรับฟอร์มของ 'หลักสูตรที่ระบุ' (เริ่มใหม่ — ล้างข้อมูลเฉพาะหลักสูตรนั้น ไม่กระทบหลักสูตรอื่น)"""
    program = body.program
    # ใช้ session ที่เปิดอยู่เป็นภาชนะรวม ถ้ายังไม่มีให้สร้าง
    session = get_active_round_optional(db)
    # กันเผลอเปิดรอบใหม่ทับหลักสูตรที่รัน Matching ไปแล้ว (จะล้างผล/ข้อมูลทิ้ง)
    if session is not None and program_matching_started(db, session.id, program):
        raise HTTPException(
            400,
            detail="หลักสูตรนี้รัน Matching ไปแล้ว ไม่สามารถเปิดรอบใหม่ (ซึ่งจะล้างข้อมูลและผล) ได้",
        )
    if session is None:
        session = models.ImportSession(
            filename="web_round", source="web", is_active=True, status="pending",
            expected_counts="{}", codes_generated=False, is_closed=False,
        )
        db.add(session)
        db.flush()

    # ล้างข้อมูลหลักสูตรนี้ (ถ้ามีรอบเดิม) แล้วเริ่มใหม่
    _clear_program_data(db, session.id, program)

    # อัปเดต expected_counts เฉพาะหลักสูตรนี้
    try:
        ec = json.loads(session.expected_counts or "{}")
    except Exception:
        ec = {}
    if body.expected_counts:
        ec.update(body.expected_counts)
    session.expected_counts = json.dumps(ec, ensure_ascii=False)

    pr = get_program_round(db, session, program, create=True)
    pr.is_open = True
    pr.is_closed = False
    pr.codes_generated = False

    db.commit()
    db.refresh(session)
    return session


# ── POST /api/round/generate-codes ────────────────────────────────────────────
@router.post("/generate-codes")
def generate_codes(
    body: schemas.ProgramActionRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """สุ่ม shuffle กลุ่ม/อาจารย์ของ 'หลักสูตรที่ระบุ' แล้ว assign G001.., P001.. (เฉพาะหลักสูตรนั้น)"""
    program = body.program
    session = get_active_round(db)
    pr = get_program_round(db, session, program)
    if pr is None or not pr.is_open:
        raise HTTPException(400, detail="ยังไม่เปิดรอบของหลักสูตรนี้")
    if pr.is_closed:
        raise HTTPException(400, detail="รอบของหลักสูตรนี้ปิดรับอยู่ กรุณาเปิดรับก่อน")
    if pr.codes_generated:
        raise HTTPException(400, detail="สร้าง Anonymous Code ของหลักสูตรนี้ไปแล้ว")

    groups = db.query(models.Group).filter_by(session_id=session.id, program=program).all()
    professors = db.query(models.Professor).filter_by(session_id=session.id, program=program).all()
    if not groups:
        raise HTTPException(400, detail="ยังไม่มีข้อมูลกลุ่ม กรุณารอให้นักศึกษาส่ง Form 1 ก่อน")
    if not professors:
        raise HTTPException(400, detail="ยังไม่มีข้อมูลอาจารย์ กรุณารอให้อาจารย์ส่ง Form 2 ก่อน")

    random.shuffle(groups)
    random.shuffle(professors)
    for i, group in enumerate(groups, start=1):
        group.anonymous_code = gen_code("G", i)
        group.group_id = gen_code("G", i)
    for i, prof in enumerate(professors, start=1):
        prof.anonymous_code = gen_code("P", i)
        prof.prof_id = gen_code("P", i)

    pr.codes_generated = True
    db.commit()
    return {
        "status": "codes_generated",
        "session_id": session.id,
        "program": program,
        "groups": [{"group_id": g.id, "anonymous_code": g.anonymous_code, "member_count": g.member_count} for g in groups],
        "professors": [{"prof_id": p.id, "anonymous_code": p.anonymous_code, "full_name": p.full_name} for p in professors],
    }


# ── POST /api/round/close ─────────────────────────────────────────────────────
@router.post("/close")
def close_round(
    body: schemas.ProgramActionRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """ปิดรับฟอร์มของหลักสูตรที่ระบุ — หลักสูตรอื่นไม่กระทบ"""
    session = get_active_round(db)
    pr = get_program_round(db, session, body.program, create=True)
    pr.is_closed = True
    db.commit()
    return {"status": "closed", "program": body.program, "is_closed": True}


# ── POST /api/round/reopen ────────────────────────────────────────────────────
@router.post("/reopen")
def reopen_round(
    body: schemas.ProgramActionRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """เปิดรับฟอร์มของหลักสูตรที่ระบุอีกครั้ง — ทำได้เฉพาะก่อนรัน Matching ของหลักสูตรนั้น"""
    session = get_active_round(db)
    if program_matching_started(db, session.id, body.program):
        raise HTTPException(400, detail="หลักสูตรนี้เริ่มรัน Matching ไปแล้ว ไม่สามารถเปิดรับฟอร์มซ้ำได้")
    pr = get_program_round(db, session, body.program, create=True)
    pr.is_closed = False
    db.commit()
    return {"status": "reopened", "program": body.program, "is_closed": False}


# ── GET /api/round/roster-check ───────────────────────────────────────────────
@router.get("/roster-check", response_model=schemas.RosterCheckOut)
def roster_check(
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """เทียบรายชื่อบัญชีนักศึกษา (roster) กับรายชื่อที่ถูกกรอกผ่าน Form 1 จริงในรอบนี้"""
    session = get_active_round_optional(db)

    roster_q = db.query(models.User).filter_by(role="student")
    if program:
        roster_q = roster_q.filter_by(program=program)
    roster = roster_q.all()

    expected = [u for u in roster if u.student_id]
    no_student_id = [u.username for u in roster if not u.student_id]
    expected_ids = {u.student_id for u in expected}

    submitted_ids = set()
    num_groups = 0
    if session:
        gq = db.query(models.Group).filter_by(session_id=session.id)
        if program:
            gq = gq.filter_by(program=program)
        num_groups = gq.count()
        mq = db.query(models.StudentMember).filter_by(session_id=session.id)
        if program:
            mq = mq.filter_by(program=program)
        submitted_ids = {m.student_id for m in mq.all() if m.student_id}

    missing = [
        schemas.RosterMissingOut(student_id=u.student_id, full_name=u.full_name, username=u.username)
        for u in expected if u.student_id not in submitted_ids
    ]
    unknown_ids = sorted(submitted_ids - expected_ids)
    covered_count = len(expected_ids & submitted_ids)

    # ── ฝั่งอาจารย์ ──
    prof_roster_q = db.query(models.User).filter_by(role="professor")
    if program:
        prof_roster_q = prof_roster_q.filter_by(program=program)
    prof_expected_count = prof_roster_q.count()

    prof_form2_count = 0
    prof_form4_count = 0
    if session:
        pq = db.query(models.Professor).filter_by(session_id=session.id)
        if program:
            pq = pq.filter_by(program=program)
        profs = pq.all()
        prof_form2_count = len(profs)
        if num_groups > 0:
            scores_by_prof: dict = {}
            scq = db.query(models.ProfessorScore).filter_by(session_id=session.id)
            if program:
                scq = scq.filter_by(program=program)
            for s in scq.all():
                scores_by_prof.setdefault(s.prof_code, set()).add(s.group_code)
            prof_form4_count = sum(
                1 for p in profs
                if p.anonymous_code and len(scores_by_prof.get(p.anonymous_code, set())) >= num_groups
            )

    return schemas.RosterCheckOut(
        expected_count=len(expected),
        covered_count=covered_count,
        num_groups=num_groups,
        missing=missing,
        unknown_ids=unknown_ids,
        no_student_id=no_student_id,
        prof_expected_count=prof_expected_count,
        prof_form2_count=prof_form2_count,
        prof_form4_count=prof_form4_count,
    )


# ── GET /api/round/status ─────────────────────────────────────────────────────
@router.get("/status", response_model=schemas.RoundStatusOut)
def round_status(
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """สถานะการรับฟอร์มทั้งหมดสำหรับ Dashboard (กรองตามหลักสูตรได้)"""
    session = get_active_round_optional(db)

    if not session:
        return schemas.RoundStatusOut(
            session_id=None, is_active=False, source="web", codes_generated=False, is_closed=False,
            expected_student_count=None, received_student_count=0, received_group_count=0,
            form1_ready=False, expected_prof_count=None, received_prof_count=0, form2_ready=False,
            ranked_group_count=0, scored_prof_count=0, pct_groups_ranked=0.0, pct_profs_scored=0.0,
            group_codes=[], prof_codes=[],
        )

    sid = session.id
    pr = get_program_round(db, session, program)
    prog_is_open = bool(pr.is_open) if pr else False
    prog_is_closed = bool(pr.is_closed) if pr else False
    prog_codes_generated = bool(pr.codes_generated) if pr else False

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

    try:
        exp_counts_data = json.loads(session.expected_counts or "{}")
    except Exception:
        exp_counts_data = {}

    if program:
        exp_s = exp_counts_data.get(program, {}).get("students", 0)
        exp_p = exp_counts_data.get(program, {}).get("profs", 0)
    else:
        exp_s = sum(p.get("students", 0) for p in exp_counts_data.values())
        exp_p = sum(p.get("profs", 0) for p in exp_counts_data.values())

    form1_ready = (exp_s > 0 and unique_student_count >= exp_s) or (exp_s == 0 and received_group > 0)
    form2_ready = (exp_p > 0 and received_prof >= exp_p) or (exp_p == 0 and received_prof > 0)

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

    ranked_complete = sum(1 for gc in group_codes_list if len(rankings_by_group.get(gc, set())) == len(prof_codes_list))
    scored_complete = sum(1 for pc in prof_codes_list if len(scores_by_prof.get(pc, set())) == len(group_codes_list))
    pct_ranked = round(ranked_complete / len(group_codes_list) * 100, 1) if group_codes_list else 0.0
    pct_scored = round(scored_complete / len(prof_codes_list) * 100, 1) if prof_codes_list else 0.0

    group_codes_out = [
        schemas.GroupAnonymousCodeOut(
            group_id=g.id, anonymous_code=g.anonymous_code or "—",
            member_count=g.member_count or 0, representative=g.representative,
            members=[schemas.StudentMemberOut.model_validate(m) for m in g.members],
        )
        for g in groups if g.anonymous_code
    ]
    prof_codes_out = [
        schemas.ProfAnonymousCodeOut(prof_id=p.id, anonymous_code=p.anonymous_code or "—", full_name=p.full_name or "—")
        for p in professors if p.anonymous_code
    ]

    submitted_groups = [
        schemas.SubmittedGroupOut(
            group_id=g.group_id or g.anonymous_code or g.id, anonymous_code=g.anonymous_code,
            representative=g.representative, member_count=g.member_count or (len(g.members) if g.members else 0),
            members=[schemas.StudentMemberOut.model_validate(m) for m in g.members],
        )
        for g in groups
    ]

    # ── Student tracking (roster-based: เห็นทุกบัญชี รวมคนที่ยังไม่ส่ง) ───────────
    query_members = db.query(models.StudentMember).filter_by(session_id=sid)
    if program:
        query_members = query_members.filter_by(program=program)
    student_members = query_members.all()

    group_by_id = {g.id: g for g in groups}
    sid_to_group = {}
    for m in student_members:
        if m.group_id in group_by_id and m.student_id:
            sid_to_group[m.student_id] = group_by_id[m.group_id]

    roster_q = db.query(models.User).filter_by(role="student")
    if program:
        roster_q = roster_q.filter_by(program=program)
    roster_students = [u for u in roster_q.all() if u.student_id]

    students_tracking = []
    if roster_students:
        for u in sorted(roster_students, key=lambda x: x.student_id or ""):
            grp = sid_to_group.get(u.student_id)
            gcode = (grp.anonymous_code or grp.group_id) if grp else None
            f1 = grp is not None
            f3 = bool(gcode and len(rankings_by_group.get(gcode, set())) > 0)
            students_tracking.append(schemas.StudentTrackingOut(
                id=u.id, student_id=u.student_id, full_name=u.full_name or "—",
                group_id=gcode or "—", form_submitted=f1,
                status="ส่งแล้ว" if f1 else "ยังไม่ส่ง",
                form1_submitted=f1, form3_submitted=f3,
            ))
    else:
        # fallback (ไม่มีบัญชีนักศึกษา) — อิงสมาชิกที่ส่งมา
        group_map = {g.id: (g.group_id or g.anonymous_code or f"กลุ่ม #{i+1}") for i, g in enumerate(groups)}
        for m in student_members:
            gcode = group_map.get(m.group_id, "—") if m.group_id else "—"
            f3 = bool(gcode != "—" and len(rankings_by_group.get(gcode, set())) > 0)
            students_tracking.append(schemas.StudentTrackingOut(
                id=m.id, student_id=m.student_id, full_name=m.full_name or "—",
                group_id=gcode, form_submitted=True, status="ส่งแล้ว",
                form1_submitted=True, form3_submitted=f3,
            ))

    # ── Professor tracking (roster-based) ───────────────────────────────────────
    prof_roster_q = db.query(models.User).filter_by(role="professor")
    if program:
        prof_roster_q = prof_roster_q.filter_by(program=program)
    prof_roster = prof_roster_q.all()
    prof_row_by_user = {p.user_id: p for p in professors if p.user_id}
    total_groups = len(group_codes_list)

    submitted_professors = []
    if prof_roster:
        for i, u in enumerate(sorted(prof_roster, key=lambda x: x.full_name or x.username), start=1):
            p = prof_row_by_user.get(u.id)
            if p:
                p_code = p.anonymous_code or p.prof_id or ""
                scored_count = len(scores_by_prof.get(p_code, set())) if p_code else 0
                form4_done = total_groups > 0 and scored_count >= total_groups
                submitted_professors.append(schemas.SubmittedProfOut(
                    prof_id=p.prof_id or p.anonymous_code or f"P{i:03d}", anonymous_code=p.anonymous_code,
                    full_name=u.full_name or p.full_name or "—", expertise=p.expertise or "—", quota=p.quota or 0,
                    form2_submitted=True, form4_submitted=form4_done,
                    scores_count=scored_count, total_groups_to_score=total_groups,
                ))
            else:
                submitted_professors.append(schemas.SubmittedProfOut(
                    prof_id=u.username, anonymous_code=None,
                    full_name=u.full_name or u.username, expertise="—", quota=0,
                    form2_submitted=False, form4_submitted=False,
                    scores_count=0, total_groups_to_score=total_groups,
                ))
    else:
        for i, p in enumerate(professors, start=1):
            p_code = p.anonymous_code or p.prof_id or ""
            scored_count = len(scores_by_prof.get(p_code, set())) if p_code else 0
            form4_done = total_groups > 0 and scored_count >= total_groups
            submitted_professors.append(schemas.SubmittedProfOut(
                prof_id=p.prof_id or p.anonymous_code or f"P{i:03d}", anonymous_code=p.anonymous_code,
                full_name=p.full_name or "—", expertise=p.expertise or "—", quota=p.quota or 0,
                form2_submitted=True, form4_submitted=form4_done,
                scores_count=scored_count, total_groups_to_score=total_groups,
            ))

    return schemas.RoundStatusOut(
        session_id=sid, is_active=prog_is_open, source=session.source,
        codes_generated=prog_codes_generated,
        is_closed=prog_is_closed,
        expected_student_count=exp_s, received_student_count=unique_student_count,
        received_group_count=received_group, form1_ready=form1_ready,
        expected_prof_count=exp_p, received_prof_count=received_prof, form2_ready=form2_ready,
        ranked_group_count=ranked_complete, scored_prof_count=scored_complete,
        pct_groups_ranked=pct_ranked, pct_profs_scored=pct_scored,
        group_codes=group_codes_out, prof_codes=prof_codes_out,
        submitted_groups=submitted_groups, submitted_professors=submitted_professors,
        students=students_tracking,
    )
