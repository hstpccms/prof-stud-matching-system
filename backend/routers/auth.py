"""
Auth Router — /api/auth
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from auth import verify_password, create_access_token, get_current_admin
import models
import schemas

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(models.Admin).filter(models.Admin.username == body.username).first()
    if not admin or not verify_password(body.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username หรือ Password ไม่ถูกต้อง",
        )
    token = create_access_token({"sub": admin.username})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def me(admin: models.Admin = Depends(get_current_admin)):
    return {"username": admin.username}
