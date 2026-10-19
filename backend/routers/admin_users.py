"""
Admin Users Router — /api/admin/users  (admin เท่านั้น)
แอดมินสร้าง/จัดการบัญชี student & professor ล่วงหน้า
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import require_admin, hash_password
from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])

ALLOWED_ROLES = {"student", "professor"}


def _create_one(body: schemas.UserCreate, db: Session) -> models.User:
    if body.role not in ALLOWED_ROLES:
        raise HTTPException(400, detail=f"role ต้องเป็น student หรือ professor (ได้รับ '{body.role}')")
    if db.query(models.User).filter_by(username=body.username).first():
        raise HTTPException(409, detail=f"username '{body.username}' มีอยู่แล้ว")
    user = models.User(
        username=body.username.strip(),
        hashed_password=hash_password(body.password),
        role=body.role,
        full_name=(body.full_name or "").strip() or None,
        student_id=(body.student_id or "").strip() or None,
        program=body.program,
        is_active=True,
    )
    db.add(user)
    return user


@router.post("", response_model=schemas.UserOut)
def create_user(
    body: schemas.UserCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    user = _create_one(body, db)
    db.commit()
    db.refresh(user)
    return user


@router.post("/bulk")
def create_users_bulk(
    body: schemas.UserBulkCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """สร้างหลายบัญชีทีเดียว — ข้ามรายการที่ซ้ำ/ผิดพลาด แล้วรายงานผล"""
    created, skipped = [], []
    for u in body.users:
        try:
            user = _create_one(u, db)
            db.flush()
            created.append(user.username)
        except HTTPException as e:
            db.rollback()
            skipped.append({"username": u.username, "reason": e.detail})
    db.commit()
    return {"created": created, "skipped": skipped, "num_created": len(created)}


@router.get("", response_model=List[schemas.UserOut])
def list_users(
    role: Optional[str] = Query(None),
    program: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    q = db.query(models.User).filter(models.User.role != "admin")
    if role:
        q = q.filter_by(role=role)
    if program:
        q = q.filter_by(program=program)
    return q.order_by(models.User.role, models.User.username).all()


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    body: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user or user.role == "admin":
        raise HTTPException(404, detail="ไม่พบผู้ใช้")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"status": "ok", "username": user.username}


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user or user.role == "admin":
        raise HTTPException(404, detail="ไม่พบผู้ใช้")
    db.delete(user)
    db.commit()
    return {"status": "deleted", "id": user_id}
