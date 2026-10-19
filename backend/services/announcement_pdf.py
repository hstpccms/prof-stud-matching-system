"""
สร้างไฟล์ PDF ประกาศผลการจับคู่ (อาจารย์ที่ปรึกษา ↔ กลุ่มนักศึกษา)
จุดประสงค์: แอดมินดาวน์โหลดเพื่อนำไปประกาศ — แสดงว่าอาจารย์แต่ละท่านได้กลุ่มใด
สมาชิกเป็นใครบ้าง โดย **ไม่แสดงคะแนน** ใด ๆ

เรนเดอร์ด้วย PyMuPDF (HTML + CSS) ซึ่งทำ text-shaping ภาษาไทยด้วย HarfBuzz
วรรณยุกต์/สระซ้อนกันจึงวางตำแหน่งถูกต้อง (reportlab เดิมทำ shaping ไม่ได้)
"""
import os
from html import escape

import pymupdf
from sqlalchemy.orm import Session

import models

_FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "fonts")

_TH_MONTHS = [
    "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]

_CSS = """
@font-face { font-family: Sarabun; src: url(Sarabun-Regular.ttf); }
@font-face { font-family: Sarabun; font-weight: bold; src: url(Sarabun-Bold.ttf); }
* { font-family: Sarabun; }
body { font-size: 16px; color: #1f2937; }
h1 { font-size: 24px; color: #1f4e79; text-align: center; margin: 0 0 2px 0; }
.sub { font-size: 14px; color: #666666; text-align: center; margin-bottom: 16px; }
h2 { font-size: 17px; color: #1f4e79; margin: 16px 0 5px 0; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #c2c9d1; padding: 5px 8px; vertical-align: top;
         font-size: 16px; text-align: left; }
th { background-color: #1f4e79; color: #ffffff; font-weight: bold; }
td.c, th.c { text-align: center; }
.rep { font-weight: bold; color: #1f4e79; }
.empty { color: #999999; }
"""


def _thai_date(dt) -> str:
    if not dt:
        return "—"
    return f"{dt.day} {_TH_MONTHS[dt.month]} {dt.year + 543}"


def _members_html(group: models.Group) -> str:
    lines = []
    for m in (group.members or []):
        name = (m.full_name or "").strip()
        label = escape(f"{m.student_id or ''} {name}".strip())
        if group.representative and name and name == group.representative.strip():
            label += ' <span class="rep">(ตัวแทนกลุ่ม)</span>'
        lines.append(label or "—")
    return "<br/>".join(lines) if lines else "—"


def _group_table_html(group_codes, code_to_group) -> str:
    rows = [
        "<tr><th class='c'>ลำดับ</th><th class='c'>กลุ่ม</th>"
        "<th>รายชื่อสมาชิกในกลุ่ม</th></tr>"
    ]
    for i, gc in enumerate(sorted(group_codes, key=_natkey), start=1):
        g = code_to_group.get(gc)
        members = _members_html(g) if g else "—"
        rows.append(
            f"<tr><td class='c'>{i}</td><td class='c'>{escape(str(gc))}</td>"
            f"<td>{members}</td></tr>"
        )
    return f"<table>{''.join(rows)}</table>"


def _natkey(code):
    import re
    s = str(code or "")
    m = re.findall(r"\d+", s)
    return (int(m[0]) if m else 0, s)


def build_announcement_pdf(run_id: int, db: Session, out_path: str) -> str:
    """สร้าง PDF ประกาศผลจาก MatchingRun แล้วเขียนลง out_path"""
    run = db.query(models.MatchingRun).filter_by(id=run_id).first()
    if not run:
        raise ValueError("ไม่พบ run")
    session_id = run.session_id
    program = run.program

    q_prof = db.query(models.Professor).filter_by(session_id=session_id)
    q_group = db.query(models.Group).filter_by(session_id=session_id)
    if program:
        q_prof = q_prof.filter_by(program=program)
        q_group = q_group.filter_by(program=program)
    code_to_prof = {p.anonymous_code: p for p in q_prof.all() if p.anonymous_code}
    code_to_group = {g.anonymous_code: g for g in q_group.all() if g.anonymous_code}

    results = db.query(models.MatchingResult).filter_by(run_id=run_id, mode="student").all()
    if not results:
        results = db.query(models.MatchingResult).filter_by(run_id=run_id).all()

    assignments: dict = {}
    matched_groups = set()
    for r in results:
        if r.assigned_prof and r.assigned_prof != "UNMATCHED":
            assignments.setdefault(r.assigned_prof, []).append(r.group_code)
            matched_groups.add(r.group_code)
    unmatched_groups = [gc for gc in code_to_group if gc not in matched_groups]

    # ── ประกอบเป็น "บล็อก" (แต่ละบล็อกห้ามถูกตัดกลาง) ──
    prog_txt = f"หลักสูตร{program}" if program else "ผลการจับคู่"
    blocks = [
        "<h1>ประกาศผลการจับคู่อาจารย์ที่ปรึกษา</h1>"
        f"<div class='sub'>{escape(prog_txt)} · ณ วันที่ {_thai_date(run.run_at)}</div>"
    ]

    profs_with_groups = [(code, code_to_prof.get(code)) for code in assignments]
    profs_with_groups.sort(key=lambda x: (x[1].full_name if x[1] and x[1].full_name else x[0]))

    if not profs_with_groups:
        blocks.append("<div class='empty'>— ยังไม่มีผลการจับคู่ —</div>")
    for code, prof in profs_with_groups:
        name = (prof.full_name if prof and prof.full_name else code) or code
        blocks.append(
            f"<h2>อาจารย์ที่ปรึกษา: {escape(str(name))}</h2>"
            + _group_table_html(assignments[code], code_to_group)
        )

    if unmatched_groups:
        blocks.append(
            "<h2>กลุ่มที่ยังไม่ได้จับคู่</h2>"
            + _group_table_html(unmatched_groups, code_to_group)
        )

    _render_blocks(blocks, out_path)
    return out_path


def _render_blocks(blocks, out_path: str):
    """เรนเดอร์ทีละบล็อก + แบ่งหน้าเอง เพื่อไม่ให้บล็อก (หัวอาจารย์+ตาราง) ถูกตัดกลางหน้า"""
    arch = pymupdf.Archive(_FONT_DIR)
    mediabox = pymupdf.paper_rect("A4")
    M = 45  # margin
    left, top = M, M
    right, bottom = mediabox.width - M, mediabox.height - M
    content_w = right - left
    GAP = 10

    def measure(html):
        s = pymupdf.Story(html=html, user_css=_CSS, archive=arch)
        _, fr = s.place(pymupdf.Rect(0, 0, content_w, 100000))
        return pymupdf.Rect(fr).height

    writer = pymupdf.DocumentWriter(out_path)
    dev = writer.begin_page(mediabox)
    cur_y = top

    for html in blocks:
        h = measure(html)
        # ไม่พอในหน้านี้ (และไม่ได้อยู่ต้นหน้า) → ขึ้นหน้าใหม่ทั้งบล็อก
        if cur_y + h > bottom and cur_y > top:
            writer.end_page()
            dev = writer.begin_page(mediabox)
            cur_y = top
        s = pymupdf.Story(html=html, user_css=_CSS, archive=arch)
        more, fr = s.place(pymupdf.Rect(left, cur_y, right, bottom))
        s.draw(dev)
        # เผื่อบล็อกสูงเกิน 1 หน้า (อาจารย์กลุ่มเยอะมาก) — ไหลต่อหน้าถัดไป
        while more:
            writer.end_page()
            dev = writer.begin_page(mediabox)
            more, fr = s.place(pymupdf.Rect(left, top, right, bottom))
            s.draw(dev)
        cur_y = pymupdf.Rect(fr).y1 + GAP

    writer.end_page()
    writer.close()
