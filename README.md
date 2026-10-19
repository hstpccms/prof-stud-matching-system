# ระบบจับคู่อาจารย์ที่ปรึกษา ↔ กลุ่มนักศึกษา (Prof-Student Matching System)

ระบบเว็บสำหรับจับคู่ **กลุ่มนักศึกษา** กับ **อาจารย์ที่ปรึกษาโครงงาน** โดยใช้อัลกอริทึม
**Deferred Acceptance (Gale-Shapley)** เปรียบเทียบผลลัพธ์ทั้งแบบ **Student-Proposing (SP)** และ **Professor-Proposing (PP)**
พร้อมกลไก **Tie-Break** ตามเกณฑ์คะแนนและนโยบาย รองรับการกรอกฟอร์มผ่านเว็บแบบแยกสิทธิ์ตามบทบาท (แอดมิน, นักศึกษา, อาจารย์)
และแยกการดำเนินงานอิสระตามหลักสูตร

> โปรเจกต์นี้ออกแบบมาเพื่อรันและ **demo บน localhost** — ใช้งานได้ทั้ง **macOS / Windows / Linux**

---

## สารบัญ
- [คุณสมบัติหลัก](#คุณสมบัติหลัก)
- [เทคโนโลยีที่ใช้](#เทคโนโลยีที่ใช้)
- [สิ่งที่ต้องติดตั้งก่อน](#สิ่งที่ต้องติดตั้งก่อน)
- [เริ่มใช้งานแบบเร็ว (แนะนำ)](#เริ่มใช้งานแบบเร็ว-แนะนำ)
- [ติดตั้ง/รันแบบแมนนวล](#ติดตั้งรันแบบแมนนวล)
- [บัญชีสำหรับทดสอบ](#บัญชีสำหรับทดสอบ)
- [ลำดับการใช้งาน (Workflow)](#ลำดับการใช้งาน-workflow)
- [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
- [ไฟล์ดาวน์โหลด/ผลลัพธ์](#ไฟล์ดาวน์โหลดผลลัพธ์)
- [แก้ปัญหาที่พบบ่อย](#แก้ปัญหาที่พบบ่อย)

---

## คุณสมบัติหลัก

- **ฟอร์มในเว็บแบบแยกสิทธิ์ตามบทบาท (Role-based Access Control)**
  - **แอดมิน (Admin)**: หน้า Dashboard ควบคุมรอบการดำเนินงาน, จัดการข้อมูล Roster/ฟอร์ม, จัดการบัญชีผู้ใช้งาน (เพิ่ม/แก้ไข/ลบ/รีเซ็ตรหัส), สั่งรัน Matching, ตรวจสอบและเปรียบเทียบผลลัพธ์, ส่งออกรายงาน Excel และ PDF
  - **นักศึกษา (Student Portal)**: กรอกฟอร์ม 1 (ตั้งชื่อหัวข้อโครงงาน, รายละเอียด, เลือกสมาชิกกลุ่ม 2–4 คน) และฟอร์ม 3 (จัดอันดับอาจารย์ที่ปรึกษาที่ต้องการ)
  - **อาจารย์ (Professor Portal)**: กรอกฟอร์ม 2 (ความเชี่ยวชาญ, หัวข้อที่สนใจ, กำหนดโควตารับกลุ่มขั้นต่ำ ≥ 1) และฟอร์ม 4 (ประเมินคะแนนกลุ่มนักศึกษา)
- **แยกการดำเนินงานตามหลักสูตร (Multi-Program Support)**
  - รองรับ 3 หลักสูตร: **รังสีเทคนิค (RT)**, **วิทยาศาสตร์การเคลื่อนไหวและสุขภาพ (HK)**, และ **ฉุกเฉินการแพทย์ (PMD)**
  - จัดการรอบ สถานะข้อมูล และการรัน Matching แยกจากกันอย่างอิสระ ไม่ปะปนกัน
- **การประเมินแบบไม่เปิดเผยตัวตน (Anonymous Evaluation)**
  - แอดมินสร้าง Anonymous Code ให้กับกลุ่มนักศึกษาแบบสุ่มก่อนเปิดให้อาจารย์ประเมิน
  - อาจารย์จะเห็นเฉพาะ Anonymous Code และรายละเอียดหัวข้อ เพื่อความโปร่งใสและเป็นกลาง (Blind Evaluation)
- **อัลกอริทึม Deferred Acceptance พร้อม Tie-Break**
  - ประมวลผลและเปรียบเทียบทั้งแบบ Student-Proposing (นศ. ได้ประโยชน์สูงสุด) และ Professor-Proposing (อาจารย์ได้ประโยชน์สูงสุด)
  - ระบบแก้ปัญหาคะแนนเท่ากัน (Tie-Break) ตามเกณฑ์ Rubric และ Random Seed ที่กำหนดได้เพื่อให้ผลลัพธ์สุ่มซ้ำได้เดิม (Deterministic)
- **ระบบตรวจสอบความถูกต้องของข้อมูล (Validation & Integrity)**
  - ตรวจนับจำนวนคนตาม Roster (Count-check), ตรวจสอบขนาดกลุ่ม (2–4 คน), ตรวจสอบโควตาอาจารย์, และตรวจการส่งคะแนนครบ 100% ก่อนอนุญาตให้รัน Matching
  - ฐานข้อมูล SQLite รองรับ WAL Mode และ `busy_timeout` ป้องกันปัญหา concurrency ระหว่างประมวลผล
- **ระบบส่งออกรายงานและประกาศผล (Excel & PDF)**
  - ส่งออกผลลัพธ์เป็น Excel หลายชีต (Matching SP/PP, Professor Summary, Comparison, Tie-Break Log)
  - ส่งออกข้อมูลดิบทั้งหมดเป็น Excel แยกตามชีตข้อมูล
  - สร้างประกาศผลทางการรูปแบบ PDF ภาษาไทยสวยงาม (ใช้ PyMuPDF จัดแบ่งหน้าอัตโนมัติ ไม่ตัดกลางตาราง พร้อมฟอนต์ TH Sarabun New)

---

## เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี | รายละเอียด |
|------|-----------|------------|
| **Backend** | Python 3.11+ · FastAPI | RESTful API ประสิทธิภาพสูง พร้อม Swagger Docs (`/docs`) |
| **Database** | SQLite + SQLAlchemy 2.0 | โหมด WAL + busy_timeout เพื่อความเสถียรและรวดเร็ว |
| **Algorithms** | Python (Deferred Acceptance) | แกนอัลกอริทึม Gale-Shapley พร้อม Tie-Break Mechanism |
| **Document Export** | PyMuPDF · openpyxl | สร้าง PDF ภาษาไทย (Sarabun font) และ Excel หลายชีต |
| **Authentication** | JWT · Bcrypt | Stateless Token Authentication ผ่าน HTTP Bearer Token |
| **Frontend** | React 19 · TypeScript · Vite | Single Page Application ประสิทธิภาพสูง |
| **UI & Styling** | Ant Design · Tailwind CSS 4 | คอมโพเนนต์ UI สำเร็จรูปและดีไซน์ที่ทันสมัย Responsive |
| **Package Managers** | uv (Python) · bun (Frontend) | เครื่องมือจัดการแพ็กเกจและรันสคริปต์ที่รวดเร็ว |

---

## สิ่งที่ต้องติดตั้งก่อน

| เครื่องมือ | เวอร์ชันแนะนำ | คำสั่งติดตั้ง |
|-----------|---------------|--------------|
| **Python** | 3.11 ขึ้นไป | macOS: `brew install python` · Windows: [python.org](https://www.python.org/downloads/) |
| **Node.js** | 20 ขึ้นไป (แนะนำ 20.19+ หรือ 22+) | macOS: `brew install node` · Windows: [nodejs.org](https://nodejs.org/) |
| **uv** | ล่าสุด | macOS/Linux: `curl -LsSf https://astral.sh/uv/install.sh \| sh`<br>Windows: `winget install astral-sh.uv` หรือ `powershell -c "irm https://astral.sh/uv/install.ps1 \| iex"` |
| **bun** | ล่าสุด | macOS/Linux: `curl -fsSL https://bun.sh/install \| bash`<br>Windows: `powershell -c "irm bun.sh/install.ps1 \| iex"` |

> บน Windows ขณะติดตั้ง Python อย่าลืมทำเครื่องหมายที่ **"Add Python to PATH"**

---

## เริ่มใช้งานแบบเร็ว (แนะนำ)

มีสคริปต์ `dev.py` จัดเตรียมไว้เพื่อช่วยติดตั้งและรันคำสั่งได้แบบข้ามแพลตฟอร์ม (macOS / Windows / Linux):

```bash
# 1) ติดตั้ง dependencies (ทำครั้งแรกครั้งเดียว หรือเวลาย้ายเครื่อง)
uv run dev.py setup

# 2) สตาร์ต Backend (:8000) และ Frontend (:5173) พร้อมกัน
uv run dev.py
```

> หากไม่ได้ใช้ `uv` สามารถรันผ่าน Python ปกติได้เช่นกัน: `python dev.py setup` และ `python dev.py`

จากนั้นเปิดเว็บเบราว์เซอร์ไปที่ **http://localhost:5173** แล้วเข้าสู่ระบบด้วยบัญชีทดสอบ

**สรุปคำสั่งของ `dev.py`:**

| คำสั่ง (ด้วย uv) | คำสั่งทางเลือก | การทำงาน |
|-----------------|----------------|----------|
| `uv run dev.py setup` | `python dev.py setup` | สร้าง virtualenv ใน `backend/venv` ติดตั้งแพ็กเกจ Python และติดตั้ง frontend dependencies ผ่าน `bun` |
| `uv run dev.py` | `python dev.py` | รันทั้ง Backend และ Frontend พร้อมกัน (กด `Ctrl+C` เพื่อหยุดทั้งคู่) |
| `uv run dev.py backend` | `python dev.py backend` | รันเฉพาะ Backend API Server (`http://localhost:8000`) |
| `uv run dev.py frontend` | `python dev.py frontend` | รันเฉพาะ Frontend Vite Dev Server (`http://localhost:5173`) |

> **ย้ายโปรเจกต์ข้าม OS** (เช่น Windows ↔ macOS): แค่รัน `uv run dev.py setup` อีกครั้ง สคริปต์จะล้าง `node_modules` เดิมและติดตั้ง native binary ให้ตรงกับระบบปฏิบัติการใหม่โดยอัตโนมัติ

---

## ติดตั้ง/รันแบบแมนนวล

หากต้องการแยกติดตั้งหรือรันทีละส่วนด้วยตนเอง:

### 1. Backend
```bash
cd backend

# สร้างและเปิดใช้งาน virtualenv
uv venv venv --python 3.11
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# ติดตั้ง dependencies
uv pip install -r requirements.txt
# หรือ: pip install -r requirements.txt

# สร้างบัญชีเริ่มต้น (หากสร้าง DB ใหม่)
python seed.py

# เริ่มทำงาน backend server
uvicorn main:app --reload --port 8000
```
> ตารางฐานข้อมูล SQLite และโฟลเดอร์ `backend/data/` จะถูกสร้างโดยอัตโนมัติเมื่อ backend เริ่มทำงาน

### 2. Frontend
```bash
cd frontend

# ติดตั้ง dependencies
bun install
# หรือ: npm install

# เริ่มทำงาน dev server
bun run dev
# หรือ: npm run dev
```
> Frontend จะพร็อกซีคำขอ `/api/*` ทั้งหมดไปยัง `http://localhost:8000` ตามที่กำหนดไว้ใน `vite.config.ts`

---

## บัญชีสำหรับทดสอบ

ฐานข้อมูลตัวอย่าง (`matching.db`) มีข้อมูลจำลองครบทั้ง 3 หลักสูตร พร้อมรหัสผ่านเริ่มต้น:

### บัญชีผู้ดูแลระบบ (Admin)
- **ชื่อผู้ใช้:** `admin`
- **รหัสผ่าน:** `admin1234`

### บัญชีทดสอบแยกตามหลักสูตร (รหัสผ่านทุกคน: `pass1234`)

| หลักสูตร | นักศึกษา (Username = รหัสนักศึกษา) | อาจารย์ (Username) | หมายเหตุ |
|----------|-----------------------------------|-------------------|----------|
| **รังสีเทคนิค (RT)** | `6510001` – `6510057` (57 คน) | `rt01` – `rt11` (11 ท่าน) | 19 กลุ่ม (กลุ่มละ 3 คน), สมาชิกคนแรกของกลุ่มเป็นตัวแทนกรอกฟอร์ม |
| **วิทยาศาสตร์การเคลื่อนไหวและสุขภาพ (HK)** | `6520001` – `6520042` (42 คน) | `hk01` – `hk10` (10 ท่าน) | 15 กลุ่ม (กลุ่มละ 2–3 คน) |
| **ฉุกเฉินการแพทย์ (PMD)** | `6530001` – `6530029` (29 คน) | `pmd01` – `pmd07` (7 ท่าน) | 10 กลุ่ม (กลุ่มละ 2–4 คน) |

> หากเริ่มต้นสร้างฐานข้อมูลใหม่จาก `seed.py` จะมีบัญชี `admin` / `admin1234`, นักศึกษา `student1`–`student9` และอาจารย์ `prof1`–`prof3`

---

## ลำดับการใช้งาน (Workflow)

```
[1. แอดมิน เปิดรอบ] ──> [2. นักศึกษา กรอกฟอร์ม 1 (หัวข้อ+สมาชิก 2-4 คน)]
                    ──> [3. อาจารย์ กรอกฟอร์ม 2 (ความเชี่ยวชาญ+โควตา ≥ 1)]
                                │
[4. แอดมิน ตรวจสอบความครบถ้วน ──> กด "สร้าง Anonymous Code"]
                                │
                    ──> [5. นักศึกษา กรอกฟอร์ม 3 (จัดอันดับอาจารย์)]
                    ──> [6. อาจารย์ กรอกฟอร์ม 4 (ประเมินคะแนนนิรนาม)]
                                │
[7. แอดมิน กด "รัน Matching"] ──> [8. ตรวจสอบผลลัพธ์ SP vs PP & ดาวน์โหลด Excel / PDF]
```

1. **แอดมิน** — เข้าสู่หน้า **Dashboard** เลือกหลักสูตรที่ต้องการ แล้วกด **เปิดรอบ** เพื่อเริ่มการรับสมัครโครงงาน
2. **นักศึกษา (ตัวแทนกลุ่ม)** — เข้าสู่ระบบผ่าน **Student Portal** กรอก **ฟอร์ม 1**: ระบุชื่อหัวข้อโครงงาน รายละเอียด และเลือกสมาชิกในกลุ่ม (2–4 คน)
3. **อาจารย์ที่ปรึกษา** — เข้าสู่ระบบผ่าน **Professor Portal** กรอก **ฟอร์ม 2**: ระบุความเชี่ยวชาญ หัวข้อที่เปิดรับ และกำหนดโควตารับกลุ่มโครงงาน (ขั้นต่ำ ≥ 1)
4. **แอดมิน** — ตรวจสอบสถานะการส่งฟอร์ม 1 และ 2 ให้ครบถ้วน (สถานะผ่านเกณฑ์ Roster Check) จากนั้นกด **สร้าง Anonymous Code** เพื่อสุ่มรหัสนิรนามกลุ่มสำหรับหลักสูตรนั้น และเปิดรอบสำหรับฟอร์ม 3 และ 4
5. **นักศึกษา (ตัวแทนกลุ่ม)** — กรอก **ฟอร์ม 3**: จัดอันดับอาจารย์ที่ปรึกษาที่ต้องการร่วมงานด้วยตามลำดับความพึงพอใจ
6. **อาจารย์ที่ปรึกษา** — กรอก **ฟอร์ม 4**: ประเมินคะแนนกลุ่มนักศึกษาตามเกณฑ์ Rubric โดยระบบจะแสดงเฉพาะ Anonymous Code และข้อมูลหัวข้อ เพื่อความยุติธรรมและเป็นกลาง
7. **แอดมิน** — เข้าเมนู **Run Matching**: กำหนด Random Seed (ค่าเริ่มต้น `2026`) และกด **รัน Matching** ระบบจะประมวลผลอัลกอริทึม Deferred Acceptance ทั้งสองฝั่งพร้อมบันทึก Tie-break
8. **ตรวจสอบผลและออกเอกสาร** —
   - หน้า **Results**: ดูตารางเปรียบเทียบผลลัพธ์ SP vs PP, อันดับเฉลี่ย, คะแนนเฉลี่ย และ Tie-Break Log
   - หน้า **Downloads**: ดาวน์โหลดรายงาน **Excel ข้อมูลดิบ**, **Excel ผลลัพธ์**, และ **PDF ประกาศผล** ที่จัดรูปแบบทางการพร้อมใช้งาน

---

## โครงสร้างโปรเจกต์

```
prof-stud-matching-system/
├── dev.py                      # สคริปต์ setup/run ข้ามแพลตฟอร์ม (macOS / Windows / Linux)
├── pyproject.toml              # การกำหนดค่า dependencies ของโปรเจกต์ (uv / Python)
├── README.md                   # เอกสารประกอบโปรเจกต์และคู่มือการใช้งาน
├── PROGRESS.md                 # บันทึกความคืบหน้าการพัฒนาและบันทึกการแก้ไข
│
├── backend/                    # FastAPI Backend Application
│   ├── main.py                 # FastAPI Application Entry Point และ Router Mounting
│   ├── database.py             # ตั้งค่า SQLAlchemy + SQLite (เปิดใช้โหมด WAL และ busy_timeout)
│   ├── models.py               # ORM Models (User, Group, Form, RoundSession, MatchingRun)
│   ├── schemas.py              # Pydantic Schemas พร้อม Input Validation (โควตา, คะแนน, ขนาดกลุ่ม)
│   ├── auth.py                 # ตรรกะระบบความปลอดภัย JWT Token และการเข้ารหัสรหัสผ่าน Bcrypt
│   ├── seed.py                 # สคริปต์สร้างบัญชี admin และ demo เริ่มต้น
│   ├── fix_db.py               # สคริปต์ Migration สำหรับปรับปรุงโครงสร้างตารางฐานข้อมูลเดิม
│   ├── requirements.txt        # รายการ Python dependencies สำหรับ backend
│   ├── assets/fonts/           # ฟอนต์ TH Sarabun New สำหรับสร้างไฟล์ PDF ภาษาไทย
│   ├── data/                   # โฟลเดอร์เก็บฐานข้อมูล matching.db และ uploads/results
│   ├── routers/                # API Endpoints แยกตามโมดูล
│   │   ├── auth.py             # ระบบ Authentication และดึงข้อมูลผู้ใช้งานปัจจุบัน
│   │   ├── round.py            # ควบคุมรอบ (เปิด/ปิด/Reopen/สร้าง Anonymous Code)
│   │   ├── student.py          # แบบฟอร์ม 1 และแบบฟอร์ม 3 สำหรับนักศึกษา
│   │   ├── professor.py        # แบบฟอร์ม 2 และแบบฟอร์ม 4 สำหรับอาจารย์
│   │   ├── admin_users.py      # จัดการบัญชีผู้ใช้งานสำหรับ Admin (CRUD / Reset Password)
│   │   ├── data.py             # จัดการข้อมูล Roster รายชื่อนักศึกษาและอาจารย์
│   │   ├── matching.py         # สั่งรัน Matching และดึงผลลัพธ์การจับคู่
│   │   └── download.py         # บริการดาวน์โหลดไฟล์ Excel และ PDF ประกาศผล
│   └── services/               # Business Logic และ Algorithms
│       ├── matching_job.py     # ตัวจัดการเบื้องหลังการรันอัลกอริทึมจับคู่
│       ├── rounds.py           # การตรวจสอบสถานะและขั้นตอนความพร้อมของแต่ละรอบ
│       ├── validation.py       # ตรวจสอบความถูกต้องและครบถ้วนของข้อมูลก่อนรัน Matching
│       ├── announcement_pdf.py # ตัวสร้างไฟล์ PDF ประกาศผลภาษาไทย (PyMuPDF Block Pagination)
│       └── excel_display.py    # ตัวสร้างไฟล์ Excel ผลลัพธ์และข้อมูลดิบ
│
├── frontend/                   # React + TypeScript + Vite Application
│   ├── vite.config.ts          # ตั้งค่า Vite dev server และ Proxy /api ไปยัง Backend (:8000)
│   ├── package.json / bun.lock # Frontend dependencies และ Lockfile
│   └── src/
│       ├── api/client.ts       # Axios Client พร้อม Interceptor และจัดการ Token
│       ├── ProgramContext.tsx  # React Context จัดการหลักสูตรปัจจุบันที่เลือกใช้งาน
│       ├── constants.ts        # ค่าคงที่ของระบบ (รายชื่อหลักสูตร RT, HK, PMD)
│       ├── pages/              # หน้าจอการทำงานหลัก
│       │   ├── Login.tsx           # หน้าเข้าสู่ระบบ
│       │   ├── Dashboard.tsx       # แดชบอร์ดภาพรวม, Pipeline สถานะ, ควบคุมรอบ, ตรวจ Roster
│       │   ├── StudentPortal.tsx   # พอร์ทัลนักศึกษา (ส่งฟอร์ม 1 และฟอร์ม 3)
│       │   ├── ProfessorPortal.tsx # พอร์ทัลอาจารย์ (ส่งฟอร์ม 2 และฟอร์ม 4)
│       │   ├── AdminUsers.tsx      # หน้าระบบจัดการบัญชีผู้ใช้งาน
│       │   ├── DataManagement.tsx  # หน้าจัดการข้อมูล Roster และแบบฟอร์ม
│       │   ├── RunMatching.tsx     # หน้าสั่งรัน Matching และระบุ Seed
│       │   ├── Results.tsx         # หน้าแสดงผลลัพธ์การจับคู่ เปรียบเทียบ SP vs PP
│       │   ├── History.tsx         # หน้าประวัติการรัน Matching รอบก่อนหน้า
│       │   └── Downloads.tsx       # หน้าดาวน์โหลดไฟล์ Excel และ PDF
│       └── components/Layout.tsx   # คอมโพเนนต์ Layout และแถบเมนูนำทาง
│
├── materials/                  # ไฟล์อ้างอิงและเอกสารทางวิชาการ
│   ├── 05_matching_algorithm.py# สคริปต์ต้นฉบับอัลกอริทึม Deferred Acceptance
│   └── rubric_score_และ_tie_break_policy.md # เอกสารเกณฑ์คะแนนและนโยบาย Tie-Break
└── data/results/               # ไดเรกทอรีจัดเก็บไฟล์ผลลัพธ์ Excel ที่ถูกสร้างจากการรัน
```

---

## ไฟล์ดาวน์โหลด/ผลลัพธ์

ในหน้า **Downloads** มีไฟล์ให้ดาวน์โหลด 3 รูปแบบ (สร้างใหม่ทุกครั้งตามผลล่าสุด):

1. **ข้อมูลดิบ (Excel - Raw Data)**:
   - `Group_Info`: รายชื่อกลุ่ม, หัวข้อโครงงาน, และสมาชิกทั้งหมด
   - `Professor_Info`: รายชื่ออาจารย์, ความเชี่ยวชาญ, และโควตารับกลุ่ม
   - `Student_Rankings`: ลำดับความต้องการอาจารย์ของแต่ละกลุ่ม
   - `Professor_Scores`: คะแนนประเมินที่อาจารย์แต่ละท่านให้กับกลุ่มนักศึกษา
2. **ผลลัพธ์การจับคู่ (Excel - Matching Results)**:
   - `Matching_Results`: ผลการจับคู่เปรียบเทียบทั้งแบบ Student-Proposing และ Professor-Proposing
   - `Professor_Summary`: สรุปจำนวนกลุ่มและโควตาของอาจารย์แต่ละท่าน
   - `Comparison`: ตารางเปรียบเทียบตัวชี้วัด (อันดับเฉลี่ย, คะแนนเฉลี่ย, จำนวนคู่ที่ต่างกัน)
   - `Tie_Break_Log`: บันทึกลำดับเหตุการณ์ Tie-Break และ Random Seed ที่ใช้
3. **เอกสารประกาศผล (PDF Announcement)**:
   - ออกแบบเอกสารทางการภาษาไทย จัดกลุ่มตามอาจารย์ที่ปรึกษา พร้อมรายชื่อสมาชิกในกลุ่ม
   - ซ่อนคะแนนและอันดับความพึงพอใจ เหมาะสำหรับการนำไปปิดประกาศอย่างเป็นทางการ

---

## แก้ปัญหาที่พบบ่อย

| ปัญหาที่พบ | แนวทางแก้ไข |
|-----------|-------------|
| แจ้งเตือนว่ายังไม่ได้ตั้งค่าโปรเจกต์ | รัน `uv run dev.py setup` (หรือ `python dev.py setup`) เพื่อติดตั้ง dependencies ให้ครบถ้วน |
| พอร์ต 8000 หรือ 5173 ชนกัน | ตรวจสอบและปิด terminal หรือโปรเซสเดิมที่กำลังใช้งานพอร์ตดังกล่าวอยู่ |
| ย้ายข้ามระบบปฏิบัติการแล้ว Frontend รันไม่ขึ้น | รัน `uv run dev.py setup` ใหม่ สคริปต์จะลบ `node_modules` เก่าและติดตั้ง native binary ให้ตรงกับเครื่องใหม่โดยอัตโนมัติ |
| Windows PowerShell บล็อกการรันสคริปต์ | สามารถรันผ่านคำสั่ง `python dev.py ...` หรือ `uv run dev.py ...` ได้โดยตรงโดยไม่ต้องปลด ExecutionPolicy |
| เข้าสู่ระบบไม่ได้ / ต้องการรีเซ็ตบัญชีเริ่มต้น | รัน `python seed.py` ในไดเรกทอรี `backend/` ภายใต้ virtualenv เพื่อสร้างบัญชีเริ่มต้นใหม่ |
| อัปเดตโค้ดแล้วพบข้อผิดพลาดเรื่องคอลัมน์ของฐานข้อมูล | รัน `python fix_db.py` ในไดเรกทอรี `backend/` เพื่อ migrate โครงสร้างตารางให้เป็นปัจจุบัน |
| ไม่พบคำสั่ง `uv` ในเครื่อง | ติดตั้ง `uv` ด้วย `curl -LsSf https://astral.sh/uv/install.sh \| sh` (macOS/Linux) หรือดูใน [docs.astral.sh/uv](https://docs.astral.sh/uv/) แล้วรีสตาร์ท terminal |
| ไม่พบคำสั่ง `bun` ในเครื่อง | ติดตั้ง `bun` ด้วย `curl -fsSL https://bun.sh/install \| bash` (macOS/Linux) หรือดูใน [bun.sh](https://bun.sh/) แล้วรีสตาร์ท terminal |
