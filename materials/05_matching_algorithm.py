"""
Professor-Student Matching System
Student-Proposing Hospital/Residents with Ties (HRT) — Deferred Acceptance
(v3 — Rubric: 2 เกณฑ์ A/B น้ำหนัก 50/50, สเกล 1-100)

อ่านข้อมูลดิบที่เก็บได้จาก MS Forms (ไฟล์ 04_raw_data_collected.xlsx) แล้วรัน
Gale-Shapley แบบ Student-Proposing โดยฝั่งอาจารย์รับได้หลายกลุ่มตาม Quota

ขั้นตอน tie-break ของฝั่งอาจารย์ (ตามนโยบายที่ตกลงกันไว้ล่าสุด) ใช้เพื่อแปลง
Main Score (1-100) ให้กลายเป็น "Strict Preference List" ก่อนป้อนเข้า Algorithm
มาตรฐาน — วิธีนี้ให้ผลลัพธ์เทียบเท่ากับการรัน Extended Gale-Shapley สำหรับ
One-sided Ties (Irving) และยัง Audit ได้ทุกขั้นตอน:

    1) Main Score (1-100, ปัดเศษจาก 0.5A+0.5B) — มากไปน้อย
    2) SubScore แบบ decimal (ไม่ปัดเศษ)         — มากไปน้อย
    3) อันดับที่กลุ่มนั้น Rank อาจารย์ท่านนี้ไว้   — น้อยไปมาก (rank 1 ดีที่สุด)
    4) Seeded Random (บันทึก seed ไว้ตรวจสอบย้อนหลังได้)

เงื่อนไขที่ต้อง Enforce ก่อนรัน (ตามที่ตกลงกันไว้):
    - ฝั่งนักศึกษาต้อง Rank ครบทุกคน (Complete Strict List) ห้ามเว้น/ซ้ำ
    - ผลรวม Quota ฝั่งอาจารย์ต้อง >= จำนวนกลุ่มนักศึกษาทั้งหมด

Usage:
    python 05_matching_algorithm.py --input 04_raw_data_collected.xlsx \
                                     --output 06_matching_result.xlsx \
                                     --seed 2026
"""

import argparse
import random
from collections import defaultdict

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

HEADER_FILL = PatternFill("solid", fgColor="D9E2F3")
OK_FILL = PatternFill("solid", fgColor="E2F0D9")
BOLD = Font(bold=True)
THIN = Side(style="thin", color="AAAAAA")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def style_header(ws, row, ncols):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.fill = HEADER_FILL
        cell.font = BOLD
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER


def autosize(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


# --------------------------------------------------------------------------
# 1) LOAD DATA
# --------------------------------------------------------------------------
def load_data(path):
    wb = openpyxl.load_workbook(path, data_only=True)

    # Professor_Info -> quotas
    ws = wb["Professor_Info"]
    quotas = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[1] is None or row[1] == "":
            continue
        code, quota = row[1], row[4]
        if code is None or quota is None:
            continue
        quotas[code] = int(quota)

    # Student_Rankings -> group -> {prof_code: rank}
    ws = wb["Student_Rankings"]
    prof_codes = [c.value for c in ws[1][1:]]
    student_pref = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        gcode = row[0]
        ranks = dict(zip(prof_codes, row[1:]))
        # sort professors by rank ascending (1 = most preferred) -> ordered list
        ordered = [p for p, _ in sorted(ranks.items(), key=lambda kv: kv[1])]
        student_pref[gcode] = {"order": ordered, "rank_of": ranks}

    # Professor_Scores -> (prof, group) -> dict of scores
    ws = wb["Professor_Scores"]
    prof_scores = defaultdict(dict)
    for row in ws.iter_rows(min_row=2, values_only=True):
        pcode, gcode, a, b, subscore, mainscore = row
        if pcode is None:
            continue
        prof_scores[pcode][gcode] = {
            "A": a, "B": b,
            "sub": float(subscore), "main": int(round(mainscore)),
        }

    groups = list(student_pref.keys())
    profs = list(quotas.keys())
    return groups, profs, quotas, student_pref, prof_scores


# --------------------------------------------------------------------------
# 2) BUILD STRICT PROFESSOR PREFERENCE LISTS (apply tie-break chain)
# --------------------------------------------------------------------------
def build_prof_preferences(profs, groups, prof_scores, student_pref, seed):
    rng = random.Random(seed)
    prof_pref = {}
    tie_log = []

    for p in profs:
        scored = []
        for g in groups:
            s = prof_scores[p][g]
            rank_by_group = student_pref[g]["rank_of"][p]  # lower = more preferred by group
            scored.append((g, s["main"], s["sub"], rank_by_group))

        # detect ties at (main, sub, rank_by_group) level -> need random tiebreak
        random_keys = {}
        seen_keys = defaultdict(list)
        for g, main, sub, rbg in scored:
            key = (main, round(sub, 6), rbg)
            seen_keys[key].append(g)
        for key, gs in seen_keys.items():
            if len(gs) > 1:
                shuffled = gs[:]
                rng.shuffle(shuffled)
                for i, g in enumerate(shuffled):
                    random_keys[g] = i
                tie_log.append({
                    "prof": p, "groups": ",".join(gs),
                    "main": key[0], "sub": key[1], "rank_by_group": key[2],
                    "resolved_order": ",".join(shuffled),
                })
            else:
                random_keys[gs[0]] = 0

        # Sort: main desc, sub desc, rank_by_group asc, then random_key asc
        scored.sort(key=lambda t: (-t[1], -t[2], t[3], random_keys[t[0]]))
        prof_pref[p] = [g for g, *_ in scored]

    return prof_pref, tie_log


# --------------------------------------------------------------------------
# 3) STUDENT-PROPOSING DEFERRED ACCEPTANCE (Gale-Shapley with quotas)
# --------------------------------------------------------------------------
def deferred_acceptance(groups, profs, quotas, student_pref, prof_pref):
    free_groups = list(groups)
    next_proposal_idx = {g: 0 for g in groups}
    prof_holds = {p: [] for p in profs}  # currently held groups, best-first
    prof_rank_index = {p: {g: i for i, g in enumerate(prof_pref[p])} for p in profs}

    while free_groups:
        g = free_groups.pop(0)
        order = student_pref[g]["order"]
        idx = next_proposal_idx[g]
        if idx >= len(order):
            continue  # exhausted list (should not happen if list is complete)
        p = order[idx]
        next_proposal_idx[g] = idx + 1

        held = prof_holds[p]
        held.append(g)
        # keep only top-`quota` by professor's strict preference; reject the rest
        held.sort(key=lambda x: prof_rank_index[p][x])
        quota = quotas[p]
        if len(held) > quota:
            rejected = held[quota:]
            prof_holds[p] = held[:quota]
            for rg in rejected:
                free_groups.append(rg)
        else:
            prof_holds[p] = held

    matching = {}
    for p, gs in prof_holds.items():
        for g in gs:
            matching[g] = p
    unmatched = [g for g in groups if g not in matching]
    return matching, unmatched, prof_holds


# --------------------------------------------------------------------------
# 4) WRITE OUTPUT
# --------------------------------------------------------------------------
def write_output(path, groups, profs, quotas, student_pref, prof_scores,
                  matching, unmatched, prof_holds, tie_log, seed):
    wb = openpyxl.Workbook()

    # ---- Sheet: Final_Matching ----
    ws = wb.active
    ws.title = "Final_Matching"
    headers = ["GroupCode", "AssignedProfessor", "RankGroupGaveProf(1=best)",
               "MainScoreProfGaveGroup", "SubScoreDecimal"]
    ws.append(headers)
    style_header(ws, 1, len(headers))
    for g in groups:
        p = matching.get(g)
        if p is None:
            ws.append([g, "UNMATCHED", None, None, None])
            continue
        rank_given = student_pref[g]["rank_of"][p]
        s = prof_scores[p][g]
        ws.append([g, p, rank_given, s["main"], round(s["sub"], 3)])
    autosize(ws, [12, 16, 22, 20, 16])
    ws.freeze_panes = "A2"

    # ---- Sheet: Professor_Summary ----
    ws = wb.create_sheet("Professor_Summary")
    headers = ["ProfCode", "Quota", "GroupsAssigned", "NumAssigned", "QuotaRemaining"]
    ws.append(headers)
    style_header(ws, 1, len(headers))
    for p in profs:
        assigned = prof_holds.get(p, [])
        ws.append([p, quotas[p], ", ".join(assigned) if assigned else "-",
                   len(assigned), quotas[p] - len(assigned)])
    autosize(ws, [10, 8, 40, 14, 16])

    # ---- Sheet: Stats ----
    ws = wb.create_sheet("Stats")
    n = len(groups)
    matched_ranks = [student_pref[g]["rank_of"][matching[g]] for g in groups if g in matching]
    ws.append(["ตัวชี้วัด", "ค่า"])
    style_header(ws, 1, 2)
    ws.append(["จำนวนกลุ่มทั้งหมด", n])
    ws.append(["จำนวนกลุ่มที่จับคู่สำเร็จ", len(matched_ranks)])
    ws.append(["จำนวนกลุ่มที่ไม่ได้จับคู่ (Unmatched)", len(unmatched)])
    if matched_ranks:
        ws.append(["Rank เฉลี่ยที่นักศึกษาได้รับ (ยิ่งน้อยยิ่งดี, 1=ดีที่สุด)",
                   round(sum(matched_ranks) / len(matched_ranks), 2)])
        ws.append(["% กลุ่มที่ได้อาจารย์อันดับ 1 ของตน",
                   f"{round(100 * sum(1 for r in matched_ranks if r == 1) / n, 1)}%"])
        ws.append(["% กลุ่มที่ได้อาจารย์อยู่ใน Top-3 ของตน",
                   f"{round(100 * sum(1 for r in matched_ranks if r <= 3) / n, 1)}%"])
    ws.append(["Random Seed ที่ใช้ตัดสิน Tie (สำหรับตรวจสอบย้อนหลัง)", seed])
    autosize(ws, [55, 20])

    # ---- Sheet: TieBreak_Log ----
    ws = wb.create_sheet("TieBreak_Log")
    headers = ["ProfCode", "GroupsTied", "MainScore", "SubScore", "RankByGroup", "ResolvedOrder(bestFirst)"]
    ws.append(headers)
    style_header(ws, 1, len(headers))
    for entry in tie_log:
        ws.append([entry["prof"], entry["groups"], entry["main"], entry["sub"],
                   entry["rank_by_group"], entry["resolved_order"]])
    autosize(ws, [10, 24, 12, 12, 14, 30])
    if not tie_log:
        ws.append(["-", "ไม่มี Tie ที่ต้องใช้ Seeded Random ในรอบนี้", "", "", "", ""])

    wb.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="04_raw_data_collected.xlsx")
    ap.add_argument("--output", default="06_matching_result.xlsx")
    ap.add_argument("--seed", type=int, default=2026,
                     help="Seed สำหรับ Tie-break ชั้นสุดท้าย (บันทึกไว้เพื่อ Audit)")
    args = ap.parse_args()

    groups, profs, quotas, student_pref, prof_scores = load_data(args.input)

    total_quota = sum(quotas.values())
    if total_quota < len(groups):
        raise SystemExit(
            f"[ERROR] ผลรวม Quota ({total_quota}) น้อยกว่าจำนวนกลุ่มนักศึกษา ({len(groups)}) "
            f"— ต้องเพิ่ม Quota ก่อนรัน Matching"
        )

    for g in groups:
        order = student_pref[g]["order"]
        if len(order) != len(profs) or len(set(order)) != len(profs):
            raise SystemExit(f"[ERROR] กลุ่ม {g} จัดอันดับอาจารย์ไม่ครบ/ไม่ถูกต้อง (ต้อง Rank ครบ {len(profs)} ท่าน แบบไม่ซ้ำ)")

    prof_pref, tie_log = build_prof_preferences(profs, groups, prof_scores, student_pref, args.seed)
    matching, unmatched, prof_holds = deferred_acceptance(groups, profs, quotas, student_pref, prof_pref)

    write_output(args.output, groups, profs, quotas, student_pref, prof_scores,
                 matching, unmatched, prof_holds, tie_log, args.seed)

    print(f"Matched: {len(matching)}/{len(groups)} groups | Unmatched: {unmatched}")
    print(f"Tie-break events resolved with seed={args.seed}: {len(tie_log)}")
    print(f"Output written to: {args.output}")


if __name__ == "__main__":
    main()
