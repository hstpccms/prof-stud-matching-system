"""
Validation Service
ตรวจสอบความครบถ้วนของข้อมูลก่อนอนุญาตให้รัน Matching
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
import models


def validate_session(session_id: int, db: Session) -> Dict[str, Any]:
    """
    Validate data in a given import session.
    Returns dict: { passed, errors, summary }
    """
    errors = []

    groups = db.query(models.Group).filter_by(session_id=session_id).all()
    professors = db.query(models.Professor).filter_by(session_id=session_id).all()
    rankings = db.query(models.StudentRanking).filter_by(session_id=session_id).all()
    scores = db.query(models.ProfessorScore).filter_by(session_id=session_id).all()

    group_codes = [g.anonymous_code for g in groups if g.anonymous_code]
    prof_codes = [p.anonymous_code for p in professors if p.anonymous_code]
    total_quota = sum(p.quota or 0 for p in professors)

    # ── Check 1: Quota ──────────────────────────────────────────────────────
    if total_quota < len(group_codes):
        errors.append({
            "code": "QUOTA_INSUFFICIENT",
            "message": (
                f"Quota รวมของอาจารย์ทั้งหมด ({total_quota}) "
                f"น้อยกว่าจำนวนกลุ่มนักศึกษา ({len(group_codes)}) "
                f"— กรุณาเพิ่ม Quota ให้อาจารย์ก่อนรัน Matching"
            ),
        })

    # ── Check 2: Student Rankings ───────────────────────────────────────────
    rankings_by_group: Dict[str, Dict[str, int]] = {}
    for r in rankings:
        if r.group_code not in rankings_by_group:
            rankings_by_group[r.group_code] = {}
        rankings_by_group[r.group_code][r.prof_code] = r.rank

    for gcode in group_codes:
        ranked = rankings_by_group.get(gcode, {})

        # Missing profs
        missing_profs = [p for p in prof_codes if p not in ranked]
        if missing_profs:
            errors.append({
                "code": "RANKING_INCOMPLETE",
                "message": (
                    f"กลุ่ม {gcode} ยังไม่ได้จัดอันดับอาจารย์: "
                    f"{', '.join(missing_profs)}"
                ),
            })
            continue

        # Duplicate ranks
        rank_values = list(ranked.values())
        seen = set()
        duplicates = []
        for pcode, rv in ranked.items():
            if rv in seen:
                duplicates.append(f"อาจารย์ {pcode} (อันดับ {rv})")
            seen.add(rv)
        if duplicates:
            errors.append({
                "code": "RANKING_DUPLICATE",
                "message": (
                    f"กลุ่ม {gcode} มีอันดับซ้ำ: {', '.join(duplicates)}"
                ),
            })

    # ── Check 3: Professor Scores ────────────────────────────────────────────
    scores_by_prof: Dict[str, set] = {}
    for s in scores:
        if s.prof_code not in scores_by_prof:
            scores_by_prof[s.prof_code] = set()
        scores_by_prof[s.prof_code].add(s.group_code)

    for pcode in prof_codes:
        scored_groups = scores_by_prof.get(pcode, set())
        missing_groups = [g for g in group_codes if g not in scored_groups]
        if missing_groups:
            errors.append({
                "code": "SCORE_INCOMPLETE",
                "message": (
                    f"อาจารย์ {pcode} ยังไม่ได้ให้คะแนนกลุ่ม: "
                    f"{', '.join(missing_groups)}"
                ),
            })

    passed = len(errors) == 0

    # Compute completeness percentages
    groups_ranked_complete = sum(
        1 for g in group_codes
        if len(rankings_by_group.get(g, {})) == len(prof_codes)
        and len(set(rankings_by_group.get(g, {}).values())) == len(prof_codes)
    )
    pct_groups_ranked = (groups_ranked_complete / len(group_codes) * 100) if group_codes else 0.0

    profs_scored_complete = sum(
        1 for p in prof_codes
        if len(scores_by_prof.get(p, set())) == len(group_codes)
    )
    pct_profs_scored = (profs_scored_complete / len(prof_codes) * 100) if prof_codes else 0.0

    summary = {
        "num_groups": len(group_codes),
        "num_professors": len(prof_codes),
        "total_quota": total_quota,
        "quota_sufficient": total_quota >= len(group_codes),
        "pct_groups_ranked": round(pct_groups_ranked, 1),
        "pct_profs_scored": round(pct_profs_scored, 1),
        "num_errors": len(errors),
    }

    return {"passed": passed, "errors": errors, "summary": summary}
