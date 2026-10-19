# ความคืบหน้าการพัฒนา — Prof-Student Matching System

ไฟล์นี้บันทึกความคืบหน้าของงานพัฒนาแต่ละรอบ

---

## รอบ 1 — เปลี่ยนจาก MS Forms/Webhook → ฟอร์มในเว็บแบบ Role-based + ปรับ Tie-break ✅ เสร็จ

**สรุป:** ตัด integration ภายนอก (MS Forms/Power Automate/Webhook) ทิ้ง เปลี่ยนเป็นกรอกฟอร์มในเว็บโดยตรง เก็บลง SQLite เดิม พร้อมระบบล็อกอินแบบ role

- [x] ตาราง `User(role)` + FK `Group.representative_user_id`, `Professor.user_id` (`models.py`)
- [x] Auth แบบ role: `require_admin/student/professor`, JWT ฝัง role (`auth.py`, `routers/auth.py`)
- [x] Router ใหม่: `round.py` (เปิดรอบ/generate-codes/status), `student.py` (Form 1+3), `professor.py` (Form 2+4), `admin_users.py` (จัดการบัญชี)
- [x] ลบ `webhook.py`, `excel_import.py`, Excel upload, `test-forms.html`
- [x] Tie-break: ตัด main-score ออก ใช้ sub-score decimal เป็นหลัก (`materials/05_matching_algorithm.py`)
- [x] Frontend: role routing + guard, `StudentPortal`/`ProfessorPortal`/`AdminUsers`, Layout ตาม role, Dashboard (webhook→round), DataManagement (ลบ upload)
- [x] seed + migration (`seed.py`, `fix_db.py`)
- [x] ทดสอบ: backend smoke test ครบ flow, role isolation 403, `tsc`+`vite build` ผ่าน

**บัญชี demo:** admin/admin1234 · student1-3 /pass1234 · prof1-3 /pass1234

---

## รอบ 2 — Prefill ฟอร์มเดิม + Lock หลังบันทึก + ตรวจรายชื่อตาม roster ✅ เสร็จ

**นโยบายที่ยืนยัน:** แก้ฟอร์มได้จนกว่าระบบจะล็อก (Form 1/2 ล็อกเมื่อ Generate Codes, Form 3/4 ล็อกเมื่อเริ่ม matching) · สมาชิกที่ไม่ใช่ตัวแทนเห็นกลุ่ม read-only

### Backend
- [x] `services/rounds.py`: helper `matching_started(db, session_id)`
- [x] `routers/student.py`: `_resolve_group` (รองรับสมาชิกที่ไม่ใช่ตัวแทน), `GET /student/roster`, `me` เติม topics/current_rankings/is_representative/representative_name/matching_started, guard form1 (non-rep 403, member∈roster, กันซ้ำ), lock form3 (matching_started)
- [x] `routers/professor.py`: `me` เติม current_scores/matching_started, lock form4
- [x] `routers/round.py`: `GET /round/roster-check`
- [x] `schemas.py`: ขยาย StudentMeOut/ProfessorMeOut, เพิ่ม RosterOut/RosterCheckOut
- [x] `seed.py`: เพิ่มเป็น 9 นักศึกษา demo (จัด 3 กลุ่มได้)

### Frontend
- [x] `StudentPortal.tsx`: prefill Form 1/3, สมาชิกเลือกจาก roster, non-rep read-only, lock Form 3
- [x] `ProfessorPortal.tsx`: prefill Form 4, lock Form 4
- [x] `DataManagement.tsx`: การ์ดตรวจรายชื่อนักศึกษา (roster-check)
- [x] `api/client.ts`: `getStudentRoster`, `getRosterCheck`

### Verify
- [x] smoke test ครอบ prefill/edit/lock/non-rep/roster-check — ผ่านทั้งหมด (`scratchpad/smoke2.py`)
- [x] `tsc -b` ผ่าน
- [ ] ทดสอบ flow จริงบนเบราว์เซอร์ (รอผู้ใช้ลอง)

**บัญชี demo รอบนี้:** student1-9 /pass1234 (รหัส 6500001-6500009), prof1-3 /pass1234, admin/admin1234 — ทั้งหมดหลักสูตร "รังสีเทคนิค"

---

## รอบ 3 — จัดระเบียบ Dashboard/DataManagement + เตือนเหตุผล validate ไม่ผ่าน ✅ เสร็จ

**แนวคิด:** Dashboard = หน้าติดตามภาพรวม (นับ/สถานะฟอร์มรายคน + count-check + ควบคุมรอบ), DataManagement = ดูข้อมูลละเอียด + ค้นหา

### Backend
- [x] `schemas.py`: StudentTrackingOut += `form1_submitted`/`form3_submitted`; RosterCheckOut += `prof_expected_count`/`prof_form2_count`/`prof_form4_count`
- [x] `routers/round.py` `round_status`: `students` และ `submitted_professors` เป็น **roster-based** (เห็นคนที่ยังไม่ส่งด้วย) พร้อมสถานะฟอร์มรายคน
- [x] `routers/round.py` `roster_check`: เพิ่มฝั่งอาจารย์

### Frontend
- [x] `Dashboard.tsx`: ตาราง นศ. เพิ่ม Form 1/3; ตาราง อ. ลบความเชี่ยวชาญ (คง Form 2/4); ลบช่องค้นหาทั้งคู่; ลบ section MS Forms → **แถบควบคุมรอบ** (เปิดรอบ Popconfirm + generate codes) + **การ์ด count-check** (นศ.+อ.)
- [x] `DataManagement.tsx`: ย้ายการ์ด roster-check ออก + เพิ่ม**ช่องค้นหา**กรองตาราง
- [x] `RunMatching.tsx`: validate ไม่ผ่าน → แสดงรายการเงื่อนไขที่ไม่ผ่านครบทุกข้อ

### Verify
- [x] smoke test รอบ 3 (roster-based tracking + roster-check อาจารย์) ผ่าน (`scratchpad/smoke3.py`)
- [x] รัน smoke รอบ 2 ซ้ำ ไม่มี regression
- [x] `tsc -b` + `vite build` ผ่าน
- [ ] ทดสอบ UI จริง (รอผู้ใช้ลอง)

---

## รอบ 4 — ปรับ Dashboard: เงื่อนไข Generate Codes, ย้าย/แก้ pipeline + control + count-check ✅ เสร็จ

**ไฟล์:** `frontend/src/pages/Dashboard.tsx` อย่างเดียว (ไม่แตะ backend)

- [x] **(1)** ปุ่ม "สร้าง Anonymous Code" กดได้เมื่อ นักศึกษาส่งฟอร์ม 1 **ครบทุกคน** และอาจารย์ส่งฟอร์ม 2 **ครบทุกท่าน** (`canGenerateCodes` อิง rosterCheck) + ข้อความหมายเหตุใหม่
- [x] **(2.1)** ตารางอาจารย์: หัวคอลัมน์เป็น "ฟอร์ม 2" / "ฟอร์ม 4" (ตรงสไตล์ตารางนักศึกษา)
- [x] **(2.2)** count-check: ลบ Alert "นักศึกษายังไม่ถูกจัดกลุ่ม" ออก (คงสถิติ/progress + alert รหัสไม่รู้จัก)
- [x] **(2.3)** ย้าย "ควบคุมรอบ" + "ตรวจความครบ" ขึ้นบน: แถว 1 = Pipeline | ควบคุมรอบ, แถว 2 = count-check | การรันล่าสุด+ประวัติ; ลบ section ซ้ำล่างสุด
- [x] **(2.4)** `pipelineSteps` ใหม่ 6 ขั้น อิง roster (ฟอร์ม 1 → ฟอร์ม 2 → สร้างรหัส → ฟอร์ม 3 → ฟอร์ม 4 → รัน Matching) สถานะตรงจริง
- [x] `tsc -b` + `vite build` ผ่าน
- [ ] ทดสอบ UI จริง (รอผู้ใช้ลอง)

---

## รอบ 5 — Validate ครบทุกช่อง + แก้ฟอร์ม 3/4 + ซ่อน anonymous code บนป้ายสถานะ ✅ เสร็จ

**นโยบายที่ยืนยัน:** รายละเอียดหัวข้อ (ฟอร์ม 1) = **บังคับกรอก** · ชื่อคอลัมน์คะแนนฟอร์ม 4 ใช้ชื่อสั้น + tooltip อธิบาย
**ไฟล์:** `frontend/src/pages/StudentPortal.tsx`, `frontend/src/pages/ProfessorPortal.tsx`, `backend/schemas.py`

### ข้อ 1 — ปุ่มส่งฟอร์มกดได้เมื่อกรอกครบทุกช่อง (ทุกฟอร์ม)
- [x] ฟอร์ม 1: สมาชิกครบ + ชื่อหัวข้อ + รายละเอียด ครบทั้ง 3 (`Form.useWatch` → `form1Complete`) + ช่องรายละเอียดเป็น required
- [x] ฟอร์ม 2: ความเชี่ยวชาญ + โควตา (`Form.useWatch` → `form2Complete`)
- [x] ฟอร์ม 3: จัดอันดับครบทุกคน + ไม่ซ้ำ (`form3Complete`)
- [x] ฟอร์ม 4: ให้คะแนน A+B ครบทุกกลุ่ม (`form4Complete`)

### ข้อ 2 — ฟอร์ม 3
- [x] **2.1** อันดับซ้ำ → `hasDupRanks` disable ปุ่ม + Alert เตือนใต้ตาราง
- [x] **2.2** สมาชิกที่ไม่ใช่ตัวแทน เห็นตารางอันดับที่ตัวแทนจัดไว้ (read-only `readonlyRankColumns`) — backend ส่ง `current_rankings` ให้สมาชิกอยู่แล้ว

### ข้อ 3 — ฟอร์ม 4
- [x] **3.1** 🐛 แก้บั๊กส่งไม่ได้ (ทศนิยม → 422): ช่องคะแนน `precision={0}` + `field_validator` ใน `schemas.py` ปัดทศนิยมเป็น int
- [x] **3.2** ลบคอลัมน์ "จำนวนสมาชิก" + เพิ่มรายละเอียดหัวข้อ
- [x] **3.3** แสดงหัวข้อแบบอ่านง่าย (**หัวข้อ N:** ... — รายละเอียด: ...)
- [x] **3.4** เปลี่ยนชื่อคอลัมน์ A/B + Tooltip: "A · ความตรงกับความเชี่ยวชาญ" / "B · ความชัดเจนของหัวข้อ"

### ข้อ 4 — ซ่อน anonymous code บนป้ายสถานะมุมขวา
- [x] ฟอร์ม 1: `บันทึกแล้ว (G001)` → `บันทึกแล้ว`
- [x] ฟอร์ม 2: `ส่งแล้ว (P001)` → `ส่งแล้ว`

### Verify
- [x] `tsc -b` + `vite build` ผ่าน
- [x] smoke test ฟอร์ม 4 ส่งได้ รวมเคสทศนิยม (85.5/90.4 → 200 ปัดเป็น int)
- [x] รีเซ็ต DB เดโมให้สะอาด (0 รอบ, คงผู้ใช้ 13 บัญชี)
- [ ] ทดสอบ UI จริงบนเบราว์เซอร์ (รอผู้ใช้ลอง)

---

## รอบ 6 — ปิดรอบ (Close Round) + แบนเนอร์แจ้งสถานะ ✅ เสร็จ

**นโยบายที่ยืนยัน:** แจ้งเตือน = in-app banner อย่างเดียว · เปิดรอบซ้ำได้ก่อนรัน Matching · ปิดอัตโนมัติเมื่อรัน Matching

### Backend
- [x] `models.py` + `fix_db.py`: คอลัมน์ `is_closed` (BOOLEAN default 0) ใน `import_sessions` + migration
- [x] `services/rounds.py`: helper `round_is_closed(db, session)` = `is_closed or matching_started`
- [x] `routers/round.py`: `POST /round/close`, `POST /round/reopen` (บล็อกถ้า matching รันแล้ว), `round_status` ส่ง `is_closed`
- [x] `routers/matching.py`: กดรัน Matching → `is_closed=True` อัตโนมัติ
- [x] `routers/student.py` + `professor.py`: guard ฟอร์ม 1–4 เมื่อ `is_closed` + `me` ส่ง `is_closed`
- [x] `schemas.py`: `is_closed` ใน `StudentMeOut`/`ProfessorMeOut`/`RoundStatusOut`/`ImportSessionOut`

### Frontend
- [x] `api/client.ts`: `closeRound()`, `reopenRound()`
- [x] `Dashboard.tsx`: ปุ่ม "ปิดรับฟอร์ม"/"เปิดรอบอีกครั้ง" (Popconfirm) + ป้ายสถานะรอบ (ยังไม่เปิด/เปิดรับ/ปิดรับ/ประมวลผลแล้ว)
- [x] `StudentPortal.tsx` + `ProfessorPortal.tsx`: แบนเนอร์สถานะด้านบน (🟢 เปิดรับ / 🔒 ปิดรับ/ประมวลผล) + ปิดฟอร์มเมื่อ `roundClosed`

### Verify
- [x] `tsc -b` + `vite build` ผ่าน
- [x] smoke test 13/13: close → ฟอร์ม 1–4 บล็อก 400 · reopen → ส่งได้ · auto-close เมื่อมี MatchingRun · reopen หลังรัน → บล็อก 400
- [x] รีเซ็ต DB เดโมให้สะอาด (0 รอบ, คงผู้ใช้ 13 บัญชี)
- [ ] ทดสอบ UI จริงบนเบราว์เซอร์ (รอผู้ใช้ลอง)

---

## รอบ 7 — ปรับหน้าดาวน์โหลด + PDF ประกาศผล ✅ เสร็จ

**นโยบายที่ยืนยัน:** ชื่อไฟล์ = `{ABBR}_{type}_{YYYYMMDD}.ext` (เติม `_HHMM` เมื่อซ้ำวัน) · PDF จัดกลุ่มตามอาจารย์ ไม่มีคะแนน · ใช้ผลโหมด student

### ข้อ 1 — การแสดงผล (`Downloads.tsx`)
- [x] **1.1** ตัด `({program})` จากหัวการ์ดทั้ง 2
- [x] **1.2** การ์ดผลลัพธ์: "{n} รอบ" → "{n} ไฟล์"
- [x] **1.3** ชื่อไฟล์ใหม่ (RT/HK/PMD + rawdata/result/announcement + วันที่ข้อมูล, เติม `_HHMM` เมื่อซ้ำวัน) + โชว์ชื่อไฟล์เป็น title ของแต่ละรายการ
- [x] **1.4** ตัด Tag "หลักสูตร: {program}" หลังหัวข้อ + แก้คำอธิบาย
- [x] **1.5** ปุ่มดาวน์โหลด Excel เหมือนกันทั้ง 2 section (primary + FileExcelOutlined + "ดาวน์โหลด Excel")
- [x] **1.6** ไอคอนตรงบริบท (ข้อมูลดิบ=FileExcel, ผลลัพธ์=FileDone, หัวเพจ=CloudDownload, PDF=FilePdf)
- [x] **1.7** ลบข้อความ "ไฟล์ผลลัพธ์มี 4 ชีต..."

### ข้อ 2.1 — PDF ประกาศผล
- [x] bundle ฟอนต์ Sarabun (OFL) `backend/assets/fonts/` + `reportlab==5.0.1` ใน requirements
- [x] `services/announcement_pdf.py`: PDF จัดกลุ่มตามอาจารย์ + รายชื่อสมาชิก (รหัส+ชื่อ+ป้ายตัวแทน, ไม่มีคะแนน) + ส่วนกลุ่มที่ยังไม่จับคู่ + หัวกระดาษระบุหลักสูตร/วันที่ (พ.ศ.)
- [x] `routers/download.py`: `GET /download/result/{run_id}/pdf`
- [x] `Downloads.tsx`: ปุ่ม "ดาวน์โหลด PDF (ประกาศผล)"

### Verify
- [x] `tsc -b` + `vite build` ผ่าน
- [x] เรนเดอร์ PDF ตรวจภาษาไทย — แสดงถูกต้องสมบูรณ์ (จัดกลุ่มตามอาจารย์/สมาชิก/ตัวแทน/กลุ่มยังไม่จับคู่)
- [x] smoke test endpoint `/download/result/{id}/pdf` → 200 application/pdf
- [x] รีเซ็ต DB เดโมให้สะอาด (0 รอบ, 0 run, คงผู้ใช้ 13 บัญชี)
- [ ] ทดสอบ UI จริงบนเบราว์เซอร์ (รอผู้ใช้ลอง)

---

## รอบ 8 — ปรับไฟล์ดาวน์โหลด (PDF shaping + Excel display) ✅ เสร็จ

**หลักความปลอดภัย:** ไฟล์ที่ feed matching (`_export_input_excel`) + `05_matching_algorithm.py` + `_import_results` **ไม่แตะเลย** · ไฟล์ดาวน์โหลดสร้างใหม่ตอนโหลด → run matching ไม่กระทบ (ทดสอบรันจริงแล้วผ่าน 3/3)
**ยืนยัน:** ชื่อชีท result เป็นภาษาอังกฤษ (อ่านง่าย)

### ข้อ 1 — PDF (`services/announcement_pdf.py` เขียนใหม่ด้วย PyMuPDF)
- [x] **1.1** เปลี่ยน engine → PyMuPDF (HarfBuzz shaping) แก้วรรณยุกต์/สระซ้อน (เรนเดอร์จริงถูกต้องสมบูรณ์)
- [x] **1.2** ลบบรรทัด "เอกสารนี้จัดทำโดยระบบ..."
- [x] **1.3** HTML+CSS: Sarabun, body 16px, สีอ่านง่าย (#1f2937/#1f4e79), รองรับหลายหน้า (Story API)
- [x] `pymupdf==1.28.2` ใน requirements

### ข้อ 2 — rawdata Excel (`services/excel_display.py` → `export_rawdata_display`)
- [x] **2.1** Group_Info: GroupID, จำนวนสมาชิก, รหัสนักศึกษา, ชื่อ-นามสกุล, หัวข้อที่สนใจ, รายละเอียดของหัวข้อ
- [x] **2.2** Professor_Info: ProfID, ชื่อ-นามสกุล, ความเชี่ยวชาญ, โควต้ากลุ่ม
- [x] **2.3** Student_Rankings: ใช้ชื่ออาจารย์เป็นหัวคอลัมน์แทนรหัส
- [x] **2.4** Professor_Scores: ชื่ออาจารย์แทน ProfID, ลบ MainScore, SubScore→Score

### ข้อ 3 — result Excel (`export_result_display`, สร้างจาก DB + TieBreak จากไฟล์ native)
- [x] **3.1** Matching sheets: ลบ MainScoreProfGaveGroup, SubScoreDecimal→ScoreProfGaveGroup
- [x] **3.2** ลบบล็อกคำอธิบายที่ประชุมใน Comparison
- [x] **3.3** ออกแบบ Comparison ใหม่ (title + header + 6 ตัวชี้วัด + seed, จัดสี/zebra/ขอบ)
- [x] **3.4** TieBreak: ลบหมายเหตุ, SubScore→Score
- [x] **3.5** ชื่อชีทอังกฤษ: Matching (Student-Proposing)/(Professor-Proposing), Professor Summary (Student)/(Professor), Comparison, Tie-Break Log

### ข้อ — download.py
- [x] `/upload` ใช้ `export_rawdata_display` · `/result` ใช้ `export_result_display` (สร้างใหม่ตอนโหลด, ไม่แตะไฟล์ native)

### Verify
- [x] รัน matching จริง (session 2 → run 2, matched 3/3 success) — **ยืนยันไม่พัง**
- [x] ดาวน์โหลด rawdata/result/PDF ตรวจครบ: sheet names + headers + ข้อมูล ถูกต้องตามสเปกทุกข้อ
- [x] เรนเดอร์ PDF — ภาษาไทย shaping ถูกต้องสมบูรณ์ (ไม่ซ้อน), footer หาย, 16px
- [~] คง DB ไว้ (session 2 + run 2 + ผลลัพธ์) ให้ผู้ใช้ทดสอบเมนูดาวน์โหลดได้ทันที (ไม่รีเซ็ต รอบนี้)

---

## รอบ 9 — จัดการข้อมูล (ลบปุ่มตรวจสอบ + ตารางสไตล์เดียว) + ไอคอนหัวข้อทุกหน้า ✅ เสร็จ

**คำแนะนำที่ยืนยัน:** ปุ่ม "ตรวจสอบ" ไม่จำเป็น — RunMatching validate อัตโนมัติ + backend re-validate ก่อนรัน · DataManagement เป็นหน้าดูข้อมูลอย่างเดียว

### หน้าจัดการข้อมูล (`DataManagement.tsx`)
- [x] ลบปุ่ม "ตรวจสอบ" + validation Alert + Tag สถานะ validate + state/handler/import ที่ไม่ใช้ + แก้คำอธิบาย
- [x] ตาราง 4 แท็บสไตล์เดียวกัน: cell 13px (`CELL`), เลิก Tag สี, เอาสี semantic เดิมออก (โควตาฟ้า/MainScore เขียว-เหลือง-แดง/อันดับ), pagination 20 เท่ากัน · (พลอยลบคอลัมน์ Main Score + Sub-score→Score ให้ตรงรอบ 8)
- [x] **(ปรับเพิ่ม)** เนื้อหาในตารางเป็น**ตัวบางทั้งหมด** (ยกเว้นหัวตาราง) · คงไฮไลต์สีเฉพาะ **GroupID = น้ำเงิน `#1677ff`** / **ProfID = ม่วง `#722ed1`** (`ID_GROUP`/`ID_PROF`) รวมถึงหัวคอลัมน์รหัสอาจารย์ในแท็บ Student Rankings
- [x] **(ปรับเพิ่ม)** แท็บ Student Rankings + Professor Scores แสดง**ชื่ออาจารย์แทนรหัส P001** (โหลด `getProfessors` → `profMap` code→name) เพื่อให้แอดมินอ่านง่าย (fallback เป็นรหัสถ้าไม่มีชื่อ)

---

## รอบ 10 — ปรับหน้าผลลัพธ์การจับคู่ (`Results.tsx`) ✅ เสร็จ

**ยืนยัน:** ลบปุ่มดาวน์โหลด Excel (ใช้เมนูดาวน์โหลดที่เดียว) · toggle 2 ปุ่มให้มีทั้ง 2 แท็บ

### ข้อ 1 — ลบปุ่มดาวน์โหลด Excel
- [x] ลบปุ่ม + `downloadingRun` + `triggerDownload` + `message`/`AntApp` + import ที่ไม่ใช้ (`DownloadOutlined`, `api`, `Button`)

### ข้อ 2 — 2 แท็บสไตล์เดียว + toggle 2 ปุ่มเหมือนกัน
- [x] แถบ toggle+legend ร่วม (`filterBar`) แสดงบนทั้ง Final Matching และ Professor Summary (state `showDiffOnly`/`sortByImpact` ใช้ร่วมกัน)
- [x] toggle ทำงานจริงบน Professor Summary (per-อาจารย์): `profDiffMap` = เทียบ set กลุ่มที่ได้รับ 2 โหมด → แสดงเฉพาะที่ต่างกัน / เรียงตาม impact (จำนวนกลุ่มที่เปลี่ยน), ตารางซ้าย-ขวาเรียง/กรองชุดเดียวกัน
- [x] ตารางสไตล์ตรงกัน (bordered, size small, pagination 20, scroll x)

### ข้อ 3 — แทน ProfID ด้วยชื่ออาจารย์ทั้งหน้า
- [x] `profNameMap` (prof_code→full_name) จาก Professor Summary
- [x] Final Matching: ช่องอาจารย์ทั้ง 2 โหมดแสดงชื่อ (คงสีโหมด/UNMATCHED)
- [x] Professor Summary: ลบคอลัมน์ "รหัส" → หัว "อาจารย์" ใช้ชื่อเป็นตัวระบุ
- [x] TieBreak Log: `replaceProfCodes` แทน P001 ด้วยชื่อในข้อความ log (คงรหัสกลุ่ม G001)

### Verify
- [x] `tsc -b` + `vite build` ผ่าน
- [ ] เช็ก UI จริงบนเบราว์เซอร์ด้วย run 2 (รอผู้ใช้ลอง) [รอบ 10]

---

## รอบ 11 — ปรับตารางหน้าผลลัพธ์ (ตัวบาง + ลบหัวตาราง/คงเหลือ/Unmatched) ✅ เสร็จ

**คำแนะนำที่ยืนยัน:** คอลัมน์ "คงเหลือ" = Quota − จำนวน (ซ้ำซ้อน) → เอาออก

### ข้อ 1 — เนื้อหาตารางตัวบางทั้งหมด (คงไฮไลต์สี)
- [x] Final Matching: ลบ `strong` (ช่องอาจารย์คงสีน้ำเงิน/ม่วง, อันดับคง rankColor) · คง Tag กลุ่ม/ต่าง
- [x] Professor Summary: ลบ `strong` (ชื่ออาจารย์, จำนวน) · คง Tag กลุ่มที่ได้รับ

### ข้อ 2 — ลบหัวตาราง Student/Professor-Proposing ใน Professor Summary
- [x] ลบ label 2 อัน (ยังแยกด้วยสี Tag กลุ่ม น้ำเงิน/ม่วง + legend ด้านบน)

### ข้อ 3 — ลบคอลัมน์ "คงเหลือ" (quota_remaining)
- [x] เอาออกจาก profCols

### ข้อ 4 — แท็บสถิติ ลบ "(Unmatched)"
- [x] ตัวชี้วัดที่ 2 → "จำนวนกลุ่มที่ไม่ได้จับคู่"

### Verify
- [x] `tsc -b` + `vite build` ผ่าน
- [ ] เช็ก UI จริงบนเบราว์เซอร์ด้วย run 2 (รอผู้ใช้ลอง)

### ไอคอนหน้าหัวข้อทุกหน้า (22px, #1677ff — เหมือนหน้าดาวน์โหลด)
- [x] Dashboard `DashboardOutlined` (3 จุด), DataManagement `DatabaseOutlined`, RunMatching `ThunderboltOutlined`, Results `PartitionOutlined` (2 จุด), History `HistoryOutlined`, AdminUsers `TeamOutlined`, StudentPortal `FormOutlined`, ProfessorPortal `SolutionOutlined`

### Verify
- [x] `tsc -b` + `vite build` ผ่าน
- [ ] เช็ก UI จริงบนเบราว์เซอร์ (รอผู้ใช้ลอง)

---

## รอบ 12 — ปรับ History เป็น Audit Log ล้วนๆ (`History.tsx`) ✅ เสร็จ

**คำแนะนำที่ยืนยัน:** เก็บหน้า History ไว้เป็นบันทึกตรวจสอบย้อนหลัง (ที่เดียวที่เห็นรอบ failed/running + Seed) แต่ลดความซ้ำ

- [x] ลบปุ่ม "ดาวน์โหลด" (ซ้ำกับเมนูดาวน์โหลด) + `triggerDownload` + `downloadingId` + import ที่ไม่ใช้ (`api`, `DownloadOutlined`, `message`/`AntApp`)
- [x] คงปุ่ม "ดูผล" (👁 → Results) ไว้ + คอลัมน์ audit ทั้งหมด (Seed/สถานะทุกแบบ/Tie/Session)
- [x] ปรับคำอธิบายใต้หัวข้อให้สื่อ "บันทึกตรวจสอบย้อนหลัง" ชัดขึ้น

### Verify
- [x] `tsc -b` + `vite build` ผ่าน
- [ ] เช็ก UI จริงบนเบราว์เซอร์ (รอผู้ใช้ลอง) [รอบ 12]

---

## รอบ 13 — จัดระเบียบ Dashboard (`Dashboard.tsx`) ✅ เสร็จ

**คำแนะนำที่ยืนยัน:** 4 การ์ด KPI คงไว้ (เสริม pipeline ไม่ซ้ำ)

### ข้อ 1 — ลบ section "ตรวจความครบของรายชื่อ"
- [x] ลบการ์ด roster-check (ซ้ำกับ pipeline ฟอร์ม 1/2) · ย้าย Alert unknown_ids ขึ้น banner (deps += rosterCheck) · ลบ import `Progress`

### ข้อ 2 — 4 การ์ด KPI → คงไว้ (ตามคำแนะนำ)

### ข้อ 3 — GroupID/ProfID ก่อนมี anonymous code = เลขเรียง 1,2,3
- [x] GroupID: `anonymous_code ? G001 : (i+1)` · ProfID: `anonymous_code ? P001 : (i+1)` · ลบคอลัมน์ "กลุ่มที่"/"คนที่" ที่ซ้ำ

### ข้อ 4 — ลบตัวเลขรวมจากหัวข้อ section
- [x] ลบ Badge count จากหัวข้อ "ส่วนกลุ่มนักศึกษา" + "ส่วนอาจารย์"

### ข้อ 5 — จัดเลย์เอาต์
- [x] รวมคอลัมน์ขวา (ควบคุมรอบ + การรันล่าสุด + ประวัติ 3 ครั้ง) เป็น Flex เดียวข้าง Pipeline · ตัดแถว roster ออก → ผัง: KPI → (Pipeline | ควบคุม+สถานะ) → ส่วนนักศึกษา → ส่วนอาจารย์

### Verify
- [x] `tsc -b` + `vite build` ผ่าน
- [ ] เช็ก UI จริงบนเบราว์เซอร์ (รอผู้ใช้ลอง) [รอบ 13]

---

## รอบ 14 — ใส่ลิมิตความยาวช่องกรอกหัวข้อ/รายละเอียด/ความเชี่ยวชาญ ✅ เสร็จ

**ค่าที่ยืนยัน:** หัวข้อ 150 · รายละเอียด 300 · ความเชี่ยวชาญ 200 ตัวอักษร

- [x] `StudentPortal` ฟอร์ม 1: หัวข้อ `maxLength=150 showCount`, รายละเอียด `maxLength=300 showCount`
- [x] `ProfessorPortal` ฟอร์ม 2: ความเชี่ยวชาญ `maxLength=200 showCount`
- [x] `schemas.py` (defense in depth): `Field(max_length=...)` ให้ StudentForm1In (150/300) + ProfessorForm2In (200)

### Verify
- [x] `tsc -b` + `vite build` ผ่าน
- [x] smoke test backend: expertise 201 → 422, 200 → ผ่าน · topic1_title 151 → 422
- [ ] เช็ก UI จริงบนเบราว์เซอร์ (ตัวนับ showCount) (รอผู้ใช้ลอง)

---

## รอบ 15 — ตัวนับลิมิตนอกกล่อง + ช่องขยายอัตโนมัติ ✅ เสร็จ

**ยืนยัน:** ตัวนับอยู่นอก input มุมขวาล่าง ตัวเล็กสีจาง (ไม่บังข้อความ) · กล่องขยายตามเนื้อหา

- [x] `StudentPortal` ฟอร์ม 1: หัวข้อ/รายละเอียดเป็น `Input.TextArea autoSize` (หัวข้อ 1–4 แถว, รายละเอียด 1–6 แถว) + ตัวนับ custom ใต้ช่อง (เลิก `showCount`, เลิก `Space.Compact` → ใช้ `Flex`)
- [x] `ProfessorPortal` ฟอร์ม 2: ความเชี่ยวชาญ `autoSize` (2–8 แถว) + ตัวนับ custom ใต้ช่อง (เลิก `showCount`)
- [x] ตัวนับ: ชิดขวา fontSize 11 สีเทา (`#999`), เป็นสีแดงเมื่อถึงลิมิต · อ่านค่าจาก `Form.useWatch`

### Verify
- [x] `tsc -b` + `vite build` ผ่าน
- [ ] เช็ก UI จริงบนเบราว์เซอร์ (รอผู้ใช้ลอง) [รอบ 15]

---

## รอบ 16 — จำลองข้อมูลทดสอบระบบเต็มรูปแบบ 3 หลักสูตร ✅ เสร็จ

**วิธี:** `scratchpad/seed_fulltest.py` เขียนลง DB ตรง (seed 2026) แล้วตรวจย้อนผ่าน API จริง · รีเซ็ต DB เดิม คง admin

### ผลลัพธ์ (รอบเปิดอยู่ · ยังไม่ generate code — พร้อมให้ทดสอบต่อ)
| หลักสูตร | นศ. | กลุ่ม | อาจารย์ | โควต้ารวม |
|---|---|---|---|---|
| รังสีเทคนิค (RT) | 57 | 19 | 11 | 19 (เท่าพอดี) |
| วิทยาศาสตร์การเคลื่อนไหวฯ (HK) | 42 | 15 | 10 | 17 (เกิน +2) |
| ฉุกเฉินการแพทย์ (PMD) | 29 | 10 | 7 | 11 (เกิน +1) |

- กลุ่มละ 2–4 คน · นศ.อยู่ 1 กลุ่ม · ไม่ข้ามหลักสูตร · อาจารย์โควต้า ≥1 · โควต้ารวม ≥ กลุ่ม
- ชื่อ-นามสกุลไทยสุ่มสมจริง · เนื้อหาฟอร์มยาวสั้นสลับ (หัวข้อ ~28–56, รายละเอียด ~26–141, ความเชี่ยวชาญ ~13–121 ตัว)
- ✅ ตรวจผ่าน API: roster-check ครบทุกหลักสูตร (unknown=0), form1_ready + form2_ready = True, login นศ./อาจารย์ ใช้งานได้

### บัญชีสำหรับทดสอบ (รหัสผ่านทุกคน: `pass1234`)
- **แอดมิน:** `admin` / `admin1234`
- **นักศึกษา:** username = รหัสนักศึกษา — RT `6510001`–`6510057`, HK `6520001`–`6520042`, PMD `6530001`–`6530029` (ตัวแทนกลุ่ม = สมาชิกคนแรกของกลุ่ม)
- **อาจารย์:** RT `rt01`–`rt11`, HK `hk01`–`hk10`, PMD `pmd01`–`pmd07`

### ขั้นต่อไป (ผู้ใช้ทดสอบเอง)
- Dashboard → สร้าง Anonymous Code → ฟอร์ม 3 (นศ.จัดอันดับ) → ฟอร์ม 4 (อาจารย์ให้คะแนน) → รัน Matching → ดาวน์โหลด/ประกาศผล

---

## รอบ 17 — แยกสถานะรอบ (เปิด/ปิด/สร้างรหัส) ตามหลักสูตร ✅ เสร็จ

**บั๊กที่แก้:** generate-codes ใส่รหัสทุกหลักสูตร + สถานะรอบเป็นของ session เดียวใช้ร่วมกัน → แยกต่อหลักสูตร

### Backend
- [x] `models.py` + `fix_db.py`: ตาราง `ProgramRound(session_id, program, is_open, is_closed, codes_generated)` + migration + backfill ข้อมูล seed
- [x] `services/rounds.py`: `get_program_round`, `program_matching_started`
- [x] `routers/round.py`: open/generate-codes/close/reopen/status รับ `program` + ทำงานเฉพาะหลักสูตรนั้น (generate ใส่รหัส G001../P001.. เฉพาะหลักสูตร นับแยก, open รีเซ็ต/ล้างเฉพาะหลักสูตร)
- [x] `routers/student.py` + `professor.py`: gating (round_open/codes_generated/is_closed/matching_started) อิง `ProgramRound` ของหลักสูตรผู้ใช้
- [x] `routers/matching.py`: auto-close เฉพาะหลักสูตรที่รัน
- [x] `schemas.py`: `OpenRoundRequest.program` + `ProgramActionRequest`

### Frontend
- [x] `api/client.ts` + `Dashboard.tsx`: ส่ง `program` ทุกปุ่ม (open/generate/close/reopen) + Popconfirm ระบุชื่อหลักสูตร

### Verify
- [x] migration + backfill สำเร็จ · tsc + vite build ผ่าน
- [x] smoke test: generate RT → **เฉพาะ RT ได้รหัส 19 กลุ่ม, HK/PMD codes=False** · อาจารย์ HK ไม่เห็นรหัส · close RT ไม่กระทบ HK · reopen RT ได้
- [x] รีเซ็ตโค้ดที่รั่วจากบั๊กเดิม (generate ทั้งระบบ) → สถานะสะอาด ทุกหลักสูตร open/ยังไม่ generate (ข้อมูล seed รอบ 16 ครบ)
- [ ] เช็ก UI จริงบนเบราว์เซอร์ (รอผู้ใช้ลอง) [รอบ 17]

---

## รอบ 18 — จำลองฟอร์ม 3/4 + ออกแบบผลลัพธ์ matching ✅ เสร็จ

**ยืนยัน:** รหัสนิรนามมีครบแล้ว (ผู้ใช้ generate เอง) · ออกแบบ PMD=เท่ากัน, RT/HK=ต่างกัน+tie-break

- [x] สร้างฟอร์ม 3 (429 rankings) + ฟอร์ม 4 (429 scores) ครบทุกกลุ่ม/อาจารย์ `scratchpad/seed_forms34_full.py` (seed 2026)
- [x] ออกแบบ: PMD aligned → stable เดียว · RT,HK ฝัง preference cycle (4/3 คู่) → ต่างกัน · block score เท่า (95) + rank เท่า → tie-break
- [x] Verify รัน DA จริงใน memory (import `05_matching_algorithm.py`):
  - RT: ต่างกัน 8 กลุ่ม · avg_rank SP 1.0 / PP 2.68 · avg_prof_score SP 88.05 / PP 95.0 · tie-break 2
  - HK: ต่างกัน 6 กลุ่ม · avg_rank SP 1.0 / PP 2.2 · prof 88.87 / 95.0 · tie-break 3
  - PMD: เท่ากัน (ทุกตัวชี้วัดเท่า) · tie-break 3
- [x] เขียนลง DB + ตรวจ API: ทุกหลักสูตร ranked 100% / scored 100% / **validate ผ่าน** → พร้อมรัน matching
- [ ] ผู้ใช้กด "รัน Matching" เองในระบบ (เปิดค้างไว้ให้)

---

## รอบ 19 — แก้ PDF ประกาศผล: ตารางถูกตัดกลางแถวเมื่อข้ามหน้า ✅ เสร็จ

**บั๊ก:** PyMuPDF Story แบ่งแถวตารางข้ามหน้าไม่สวย → แถวถูกตัดกลาง + แถบหัวตารางสีน้ำเงินทับข้อความ (เห็นในไฟล์หลายหน้า เช่น RT 19 กลุ่ม)

- [x] `services/announcement_pdf.py`: เปลี่ยนจาก Story เดียว auto-paginate → **แบ่งหน้าเองทีละบล็อก (หัวอาจารย์+ตาราง)** ด้วย `_render_blocks` — วัดความสูงแต่ละบล็อกก่อน (`Story.place` บน rect สูงมาก) ถ้าไม่พอในหน้าปัจจุบัน → ขึ้นหน้าใหม่ทั้งบล็อก (บล็อกสูงเกิน 1 หน้าค่อยไหลต่อ)
- [x] แก้ `place()` คืน tuple → ครอบ `pymupdf.Rect(...)` ก่อนใช้ `.height`/`.y1`
- [x] Verify: รัน matching RT (19 กลุ่ม/11 อาจารย์, 4 หน้า) → ดาวน์โหลด PDF อ่านกลับ: ทุกบล็อกอยู่ครบ ไม่มีแถวถูกตัด/แถบน้ำเงินทับ
- [x] เก็บกวาด: ลบ run ทดสอบที่สร้างชั่วคราว คงรันของผู้ใช้ (RT/HK/PMD) ไว้ครบ

---

## รอบ 20 — Demo hardening (แก้เฉพาะที่จำเป็นต่อการนำเสนอบนเครื่องนี้) ✅ เสร็จ

**บริบท:** เป็น demo รันบน localhost เครื่องนี้ก่อน — ตัดงาน security/deploy/prod (SECRET_KEY, demo accounts, CORS/reverse proxy, rate-limit, Postgres, Alembic ฯลฯ) ออก เลือกแก้เฉพาะที่อาจพัง/เพี้ยนสดตอน demo

- [x] **1. SQLite WAL + busy_timeout** (`database.py`) — event listener ตั้ง `journal_mode=WAL`, `busy_timeout=5000` · กัน "database is locked" ตอน matching(thread)+polling+ฟอร์มพร้อมกัน · verify: wal/5000
- [x] **2. กันรัน Matching ซ้ำ/พร้อมกัน** (`matching.py`) — เช็ก run `status="running"` ของหลักสูตรนั้น → 409 · verify ผ่าน
- [x] **3. กัน `open_round` ล้างผลที่รันแล้ว** (`round.py`) — บล็อก 400 ถ้า `program_matching_started` (เหมือน reopen) · verify ผ่าน
- [x] **4. 401 interceptor ไม่ redirect ตอน login ผิด** (`client.ts`) — ข้อความ error ไม่หาย
- [x] **5. subprocess `PYTHONUTF8=1`** (`matching_job.py`) — log ไทยไม่เพี้ยน
- [x] tsc + vite build ผ่าน · ข้อมูล/รันเดิม (RT/HK/PMD) ครบ

**ยังค้าง (ทำตอนขึ้น prod จริง):** SECRET_KEY→env, บัญชี/รหัสจาก env + ลบ demo, reverse proxy+serve dist+CORS env, input bounds (quota/score), rate-limit, Alembic, Postgres, exception ไม่หลุด, unique index (session,student), ลบ reportlab, validate program, gitignore data/results

---

## รอบ 21 — ใส่ input bounds (defense-in-depth) ✅ เสร็จ

**ค่าที่ยืนยัน:** quota `ge=1` (บังคับ ≥1 ตามนโยบาย)

- [x] `schemas.py`:
  - `ProfessorForm2In.quota` → `Field(ge=1, le=50)`
  - `GroupScoreEntryIn.score_a/score_b` → `Field(ge=0, le=100)` (คง validator ปัดทศนิยม mode="before")
  - `ProfRankEntryIn.rank` → `Field(ge=1)`
  - `StudentForm1In.members` → `Field(min_length=1, max_length=8)`
  - `StudentForm3In.rankings` / `ProfessorForm4In.scores` → `Field(max_length=200)`
  - `RunMatchingRequest.seed` → `Field(default=2026, ge=0, le=2_147_483_647)`
- [x] smoke test: quota 0/51 → 422 · score 101/-1 → 422 · rank 0 → 422 · members 9 → 422 · quota 3 → ผ่าน validation (ไม่ 422)
- หมายเหตุ: frontend คุมค่าปกติอยู่แล้ว — ชุดนี้เป็นเกราะกันเรียก API ตรง (422 ก่อนเข้า endpoint logic)

---

## รอบ 22 — ปรับ members max=4 + ปิด mismatch frontend/backend ✅ เสร็จ

- [x] สมาชิกกลุ่ม max 8 → **4** (`schemas.py` `members: min_length=1, max_length=4`) · verify ส่ง 5 คน → 422
- [x] โควตาหน้าเว็บ `min={0}` → **`min={1}`** (`ProfessorPortal.tsx`) ให้ตรง backend `ge=1` (กัน 422 งงๆ)
- [x] หน้าเว็บกันเพิ่มสมาชิกเกิน 4 (`StudentPortal.tsx` ซ่อนปุ่มเมื่อครบ 4 + หมายเหตุ "กลุ่มละ 2–4 คน")
- [x] tsc + vite build ผ่าน

### ตามต่อ — บังคับขั้นต่ำ 2 คน (min=2) ✅
- [x] `schemas.py` `members` min_length 1 → **2** (`min_length=2, max_length=4`)
- [x] `StudentPortal.tsx` `form1Complete` ต้องมีสมาชิก **≥2** (ปุ่มส่ง disable จนกว่าจะครบ) + guard submit "ต้องมีอย่างน้อย 2 คน"
- [x] verify: members 1 → 422 · 2/4 → ผ่าน validation · 5 → 422
