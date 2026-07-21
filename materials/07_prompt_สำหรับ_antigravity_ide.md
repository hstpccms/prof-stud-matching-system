# Prompt สำหรับ Antigravity IDE — สร้างเว็บไซต์ระบบจับคู่อาจารย์ที่ปรึกษา (Admin Dashboard)

> คัดลอกเนื้อหาด้านล่างทั้งหมดวางใน Antigravity IDE ได้เลย ปรับแก้ส่วน [ ] ตามบริบทจริงก่อนใช้งาน

---

## บทบาทของคุณ

คุณคือ Full-stack Developer ช่วยสร้างเว็บแอปพลิเคชัน **Professor-Student Matching System** สำหรับมหาวิทยาลัย โดยมี **แอดมิน 1 คนเป็นผู้ใช้งานหลักเพียงฝั่งเดียว** (นักศึกษาและอาจารย์กรอกข้อมูลผ่าน MS Forms ภายนอกระบบ ไม่ได้ Login เข้าเว็บนี้)

## ภาพรวมของระบบ (Context)

ระบบนี้แทนที่กระบวนการจับคู่อาจารย์ที่ปรึกษากับกลุ่มนักศึกษาแบบ Manual เดิม ด้วย Pipeline ดังนี้:

```
MS Forms (นักศึกษา/อาจารย์กรอกข้อมูล + จัดอันดับ/ให้คะแนน)
        ↓ (Export เป็น MS Excel)
[เว็บนี้] แอดมิน Upload ไฟล์ Excel เข้าระบบ
        ↓
[เว็บนี้] ระบบตรวจสอบความครบถ้วน (Validation)
        ↓
[เว็บนี้] แอดมินสั่งรัน Matching Algorithm (Python, Student-Proposing HRT)
        ↓
[เว็บนี้] แอดมินดู Dashboard ผลลัพธ์ + ดาวน์โหลดไฟล์สรุป
```

**หน้าที่หลักของเว็บนี้คือ 2 อย่าง: (1) ติดตาม Progress ของแต่ละขั้นตอน และ (2) เป็นศูนย์กลางดาวน์โหลดเอกสาร/ผลลัพธ์ทั้งหมดให้แอดมิน**

---

## Tech Stack ที่ต้องการ

- **Backend**: Python
- **Database**: SQLite
- **Auth**: ระบบ Login อย่างง่าย (Username/Password เดียวสำหรับแอดมิน ไม่ต้องมี Role หลายระดับ ไม่ต้องมี Register หน้าเว็บ — สร้าง Account แรกผ่าน Seed Script/Migration)
- **Matching Engine**: Python script ที่มีอยู่แล้ว (materials\05_matching_algorithm.py) — ให้ Integrate เป็น Backend Job ที่ Trigger ได้จากเว็บ ไม่ต้องเขียน Algorithm ใหม่
- **Frontend**: Ant design
- **File Storage**: เก็บไฟล์ Excel ที่ Upload/Export ไว้ในโฟลเดอร์ของ Server

---

## Data Model (อ้างอิงจากไฟล์ Excel ที่ระบบใช้จริง)

โครงสร้างข้อมูลอ้างอิงจากไฟล์ `04_ข้อมูลดิบหลังเก็บแบบฟอร์ม.xlsx` ซึ่งมี 4 ชีต:

1. **Group_Info**: GroupID, AnonymousCode (เช่น G1-G15), ตัวแทนกลุ่ม, จำนวนสมาชิก, หัวข้อสนใจ 3 อันดับ
2. **Professor_Info**: ProfID, AnonymousCode (เช่น A-J), ชื่อ-นามสกุล, ขอบเขตความเชี่ยวชาญ, **Quota** (จำนวนกลุ่มที่รับได้)
3. **Student_Rankings**: Matrix กลุ่ม × อาจารย์ — แต่ละกลุ่ม Rank อาจารย์ทุกท่านแบบ Strict (1 = ต้องการมากที่สุด, ห้ามเว้น/ซ้ำ)
4. **Professor_Scores**: ProfCode, GroupCode, Score_TopicFit_A (1-100), Score_Clarity_B (1-100), SubScore_Decimal (=0.5A+0.5B), MainScore_1to100 (ปัดเศษจาก SubScore)

ให้ออกแบบ SQLite Schema ที่ Mirror โครงสร้างนี้ (ตาราง Groups, Professors, StudentRankings, ProfessorScores) พร้อม Import Function ที่อ่านไฟล์ Excel รูปแบบนี้เข้าฐานข้อมูลได้ตรงๆ

**เงื่อนไขที่ต้อง Validate ก่อนอนุญาตให้รัน Matching ได้:**
- ผลรวม Quota ของอาจารย์ทั้งหมด ≥ จำนวนกลุ่มนักศึกษาทั้งหมด
- ทุกกลุ่มต้อง Rank อาจารย์ครบทุกท่าน แบบไม่ซ้ำอันดับ (Complete Strict Preference List)
- ทุกอาจารย์ต้องให้คะแนน (A, B) ครบทุกกลุ่ม

---

## Matching Algorithm (มีโค้ดอยู่แล้ว — ให้ Integrate ไม่ใช่เขียนใหม่)

แนบไฟล์ `05_matching_algorithm.py` มาด้วย — เป็น Python script ที่ implement:
- **Student-Proposing Deferred Acceptance** (Gale-Shapley ต่อยอดเป็น Hospital-Residents with Ties, รองรับ Quota หลายที่นั่งต่ออาจารย์)
- **Tie-break policy 3 ชั้น**: Main Score → SubScore decimal → อันดับที่กลุ่มนั้น Rank อาจารย์ท่านนี้ → Seeded Random (ต้องบันทึก Seed ที่ใช้ทุกครั้งเพื่อ Audit ย้อนหลังได้)
- Input: ไฟล์ Excel รูปแบบ Data Model ข้างต้น
- Output: ไฟล์ Excel 4 ชีต — Final_Matching, Professor_Summary, Stats, TieBreak_Log

ให้ Wrap สคริปต์นี้เป็น Backend Endpoint/Job ที่:
1. รับ Seed (ตัวเลข, มี Default ให้) เป็น Input จากแอดมินก่อนรัน
2. รันแล้วเก็บผลลัพธ์ลง Database + เก็บไฟล์ Excel Output ไว้ให้ดาวน์โหลด
3. เก็บ History ของการรันแต่ละครั้งไว้ (Timestamp, Seed, จำนวนกลุ่มที่ Matched/Unmatched, จำนวน Tie ที่เกิด) เผื่อแอดมินต้องเปรียบเทียบหลายรอบหรือ Roll back ไปดูรอบก่อนหน้า

---

## หน้าเว็บที่ต้องมี (Pages/Screens)

### 1. หน้า Login
Username/Password เดียวสำหรับแอดมิน

### 2. หน้า Dashboard (หน้าแรกหลัง Login)
แสดง **Progress ของแต่ละขั้นตอน** แบบเห็นภาพรวมทันที (เช่น Progress Bar หรือ Checklist):
- [ ] จำนวนกลุ่มนักศึกษาที่ลงทะเบียนแล้ว (X / เป้าหมาย)
- [ ] จำนวนอาจารย์ที่ลงทะเบียนแล้ว + Quota รวม (แจ้งเตือนสีแดงถ้า Quota รวม < จำนวนกลุ่ม)
- [ ] % กลุ่มที่ส่ง Ranking ครบแล้ว
- [ ] % อาจารย์ที่ให้คะแนนครบทุกกลุ่มแล้ว
- [ ] สถานะการรัน Matching ล่าสุด (ยังไม่รัน / รันแล้วเมื่อ [วันที่] / จำนวนกลุ่มที่ Matched)

### 3. หน้า Data Management
- Upload ไฟล์ Excel (Group_Info, Professor_Info, Student_Rankings, Professor_Scores) — แยก Upload ทีละไฟล์หรือไฟล์เดียวรวม 4 ชีตก็ได้
- แสดงตารางข้อมูลที่ Import เข้ามาแล้ว (Preview/Edit ได้เล็กน้อยถ้าจำเป็น)
- ปุ่ม "ตรวจสอบความครบถ้วน" (Validation) พร้อมแสดง Error ชัดเจนถ้าไม่ผ่าน (เช่น "อาจารย์ B ยังไม่ได้ให้คะแนนกลุ่ม G7")

### 4. หน้า Run Matching
- ปุ่ม "รัน Matching" (Disable ถ้า Validation ยังไม่ผ่าน)
- ช่องกรอก Seed (มีค่า Default)
- แสดงผล Log การรันแบบ Real-time หรือ Spinner ระหว่างรอ

### 5. หน้า ผลลัพธ์ (Results)
- ตาราง Final_Matching (กลุ่ม → อาจารย์ที่จับคู่ได้ + Rank ที่กลุ่มให้ + คะแนนที่อาจารย์ให้)
- ตาราง Professor_Summary (อาจารย์แต่ละท่าน → กลุ่มที่ได้ + Quota คงเหลือ)
- การ์ดสรุปสถิติ (Stats): Rank เฉลี่ย, % ได้อันดับ 1, % ได้ Top-3, จำนวน Unmatched
- ตาราง TieBreak_Log (สำหรับ Audit ว่ามีการ Random ตัดสิน Tie ที่ไหนบ้าง พร้อม Seed ที่ใช้)

### 6. ดาวน์โหลดเอกสาร (Download Center)
ต้องดาวน์โหลดได้ครบทุกไฟล์ต่อไปนี้จากที่เดียว:
- ไฟล์ข้อมูลดิบที่ Upload เข้ามา
- ไฟล์ผลลัพธ์ Matching (xlsx) ของแต่ละรอบที่เคยรัน (เก็บ History ไว้ให้เลือกดาวน์โหลดย้อนหลังได้)
- (ถ้าเป็นไปได้) ไฟล์สรุปรายอาจารย์/รายกลุ่มแยกไฟล์ สำหรับส่งต่อทางอีเมล

### 7. หน้า History / Audit Log
รายการการรัน Matching ทุกครั้งที่ผ่านมา พร้อม Seed, เวลา, ผู้รัน, สรุปผลย่อ — กดเข้าไปดูรายละเอียดหรือดาวน์โหลดไฟล์ของรอบนั้นได้

---

## Non-Functional Requirements

- ระบบต้องใช้งานง่าย แอดมินไม่ใช่โปรแกรมเมอร์ — UI ต้องชัดเจน มี Error Message ที่เข้าใจง่าย (ภาษาไทย)
- ทุกการรัน Matching ต้องเก็บ Seed และผลลัพธ์แบบ Immutable (แก้ไขย้อนหลังไม่ได้ ต้องรันใหม่เป็นรอบใหม่แทน) เพื่อให้ Audit ย้อนหลังได้เสมอ
- ไม่ต้องรองรับ Multi-user/Concurrent editing (ผู้ใช้งานหลักมีแค่แอดมินคนเดียว)
- ไม่ต้องเชื่อมต่อ MS Forms/MS Excel แบบ Real-time API ในเวอร์ชันนี้ (รับเป็นไฟล์ Upload พอ)

## ขอบเขตที่ไม่ต้องทำ (Out of Scope สำหรับเวอร์ชันแรก)

- ไม่ต้องสร้างระบบ Login ฝั่งนักศึกษา/อาจารย์
- ไม่ต้องสร้างระบบส่งอีเมลอัตโนมัติ (ดาวน์โหลดไฟล์ไปส่งเองได้พอ)
- ไม่ต้อง Implement Professor-Proposing เป็นทางเลือกในเวอร์ชันแรก (เป็น Enhancement ในอนาคต)

---

## สิ่งที่แนบมาให้ (ใส่ไฟล์จริงแนบเข้าไปใน Antigravity ก่อนเริ่ม)

1. `04_ข้อมูลดิบหลังเก็บแบบฟอร์ม.xlsx` — ตัวอย่างข้อมูล/โครงสร้างไฟล์ Input จริง
2. `05_matching_algorithm.py` — Matching Engine ที่ต้อง Integrate
3. `06_ผลลัพธ์การจับคู่.xlsx` — ตัวอย่างโครงสร้างไฟล์ Output ที่ต้องการ
4. `rubric_score_และ_tie_break_policy.md` — เอกสารอธิบาย Business Logic เบื้องหลัง Rubric และ Tie-break (ให้ Antigravity อ่านเพื่อเข้าใจ Context แต่ไม่ต้อง Implement ส่วน Rubric Form เอง เพราะกรอกผ่าน MS Forms ภายนอก)

กรุณาเริ่มจากการออกแบบ Database Schema และ Page Wireframe คร่าวๆ ให้ดูก่อน แล้วค่อยเริ่ม Implement ทีละหน้า โดยเริ่มจากหน้า Dashboard และ Data Management ก่อน เพราะเป็นหัวใจของการติดตาม Progress
