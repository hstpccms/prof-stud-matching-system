"""
Seed script — สร้าง Admin account ครั้งแรก
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

DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin1234"


def seed():
    # Create tables
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(models.Admin).filter(models.Admin.username == DEFAULT_USERNAME).first()
        if existing:
            print(f"[seed] Admin '{DEFAULT_USERNAME}' มีอยู่แล้ว — ไม่ต้องสร้างใหม่")
            return
        admin = models.Admin(
            username=DEFAULT_USERNAME,
            hashed_password=hash_password(DEFAULT_PASSWORD),
        )
        db.add(admin)
        db.commit()
        print(f"[seed] สร้าง Admin account สำเร็จ")
        print(f"       Username: {DEFAULT_USERNAME}")
        print(f"       Password: {DEFAULT_PASSWORD}")
        print(f"       (กรุณาเปลี่ยนรหัสผ่านหลังจาก Login ครั้งแรก)")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
