"""
Seed script — สร้างบัญชี admin + บัญชี demo (student/professor) ครั้งแรก
รัน: python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

from database import engine, SessionLocal
import models
from auth import hash_password

DEFAULT_ADMIN = {"username": "admin", "password": "admin1234"}

# บัญชี demo ไว้ทดสอบ flow (ลบออกได้ในโปรดักชัน)
DEMO_PROGRAM = "รังสีเทคนิค"
# 9 นักศึกษา (ไว้จัด 3 กลุ่มๆ ละ 3 คน เพื่อทดสอบการตรวจรายชื่อครบตาม roster)
_TH_NUM = ["หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]
DEMO_STUDENTS = [
    {"username": f"student{i}", "password": "pass1234",
     "full_name": f"นักศึกษา {_TH_NUM[i-1]}", "student_id": f"650000{i}"}
    for i in range(1, 10)
]
DEMO_PROFESSORS = [
    {"username": "prof1", "password": "pass1234", "full_name": "อาจารย์ เอ"},
    {"username": "prof2", "password": "pass1234", "full_name": "อาจารย์ บี"},
    {"username": "prof3", "password": "pass1234", "full_name": "อาจารย์ ซี"},
]


def _ensure_user(db, username, password, role, full_name=None, student_id=None, program=None):
    existing = db.query(models.User).filter_by(username=username).first()
    if existing:
        print(f"[seed] user '{username}' มีอยู่แล้ว — ข้าม")
        return
    db.add(models.User(
        username=username,
        hashed_password=hash_password(password),
        role=role,
        full_name=full_name,
        student_id=student_id,
        program=program,
        is_active=True,
    ))
    print(f"[seed] สร้าง {role} '{username}' (password: {password})")


def seed():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _ensure_user(db, DEFAULT_ADMIN["username"], DEFAULT_ADMIN["password"], "admin", full_name="Administrator")
        for s in DEMO_STUDENTS:
            _ensure_user(db, s["username"], s["password"], "student",
                         full_name=s["full_name"], student_id=s["student_id"], program=DEMO_PROGRAM)
        for p in DEMO_PROFESSORS:
            _ensure_user(db, p["username"], p["password"], "professor",
                         full_name=p["full_name"], program=DEMO_PROGRAM)
        db.commit()
        print("\n[seed] เสร็จสิ้น — Admin: admin / admin1234")
        print("       (กรุณาเปลี่ยนรหัสผ่านหลัง Login ครั้งแรก)")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
