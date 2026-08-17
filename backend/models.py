"""
SQLAlchemy ORM Models
"""
import json
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
)
from sqlalchemy.orm import relationship
from database import Base


class Admin(Base):
    __tablename__ = "admin"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)


class ImportSession(Base):
    __tablename__ = "import_sessions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    filename = Column(String)
    file_path = Column(String)
    status = Column(String, default="pending")  # pending|imported|validated|failed
    # ── Webhook / Forms fields ────────────────────────────────────────────────
    is_active              = Column(Boolean, default=False)   # True = กำลังรับข้อมูลจากฟอร์มอยู่
    source                 = Column(String, default="excel")  # "excel" | "forms"
    expected_counts        = Column(Text, default="{}")       # JSON string {"program": {"students": X, "profs": Y}}
    codes_generated        = Column(Boolean, default=False)   # สร้าง anonymous_code แล้วหรือยัง

    groups = relationship("Group", back_populates="session", cascade="all, delete-orphan")
    professors = relationship("Professor", back_populates="session", cascade="all, delete-orphan")
    student_rankings = relationship("StudentRanking", back_populates="session", cascade="all, delete-orphan")
    professor_scores = relationship("ProfessorScore", back_populates="session", cascade="all, delete-orphan")
    matching_runs = relationship("MatchingRun", back_populates="session")
    student_members = relationship("StudentMember", back_populates="session", cascade="all, delete-orphan")


class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("import_sessions.id"))
    group_id = Column(String)
    anonymous_code = Column(String)
    program = Column(String)
    representative = Column(String)
    member_count = Column(Integer)
    topic_interest = Column(Text)  # JSON string

    session = relationship("ImportSession", back_populates="groups")
    members = relationship("StudentMember", back_populates="group")

    def get_topics(self):
        if self.topic_interest:
            try:
                return json.loads(self.topic_interest)
            except Exception:
                return []
        return []


class Professor(Base):
    __tablename__ = "professors"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("import_sessions.id"))
    prof_id = Column(String)
    anonymous_code = Column(String)
    program = Column(String)
    full_name = Column(String)
    expertise = Column(String)
    quota = Column(Integer)

    session = relationship("ImportSession", back_populates="professors")


class StudentRanking(Base):
    __tablename__ = "student_rankings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("import_sessions.id"))
    program = Column(String)
    group_code = Column(String)
    prof_code = Column(String)
    rank = Column(Integer)

    session = relationship("ImportSession", back_populates="student_rankings")


class ProfessorScore(Base):
    __tablename__ = "professor_scores"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("import_sessions.id"))
    program = Column(String)
    prof_code = Column(String)
    group_code = Column(String)
    score_a = Column(Integer)
    score_b = Column(Integer)
    sub_score = Column(Float)
    main_score = Column(Integer)

    session = relationship("ImportSession", back_populates="professor_scores")


class MatchingRun(Base):
    __tablename__ = "matching_runs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("import_sessions.id"))
    program = Column(String)
    run_at = Column(DateTime, default=datetime.utcnow)
    seed = Column(Integer)
    mode = Column(String, default="both")  # student|professor|both
    status = Column(String, default="running")  # running|success|failed
    # Legacy aggregate (kept for backward compat) — stores student-proposing values
    num_matched = Column(Integer, default=0)
    num_unmatched = Column(Integer, default=0)
    num_ties = Column(Integer, default=0)
    # Per-mode stats (v4 algorithm)
    num_matched_student = Column(Integer, default=0)
    num_unmatched_student = Column(Integer, default=0)
    num_matched_professor = Column(Integer, default=0)
    num_unmatched_professor = Column(Integer, default=0)
    output_file_path = Column(String)
    log = Column(Text)

    session = relationship("ImportSession", back_populates="matching_runs")
    results = relationship("MatchingResult", back_populates="run", cascade="all, delete-orphan")


class MatchingResult(Base):
    __tablename__ = "matching_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("matching_runs.id"))
    group_code = Column(String)
    assigned_prof = Column(String)
    rank_given = Column(Integer)
    main_score = Column(Integer)
    sub_score = Column(Float)
    mode = Column(String, default="student")  # "student" | "professor"

    run = relationship("MatchingRun", back_populates="results")


class StudentMember(Base):
    """
    เก็บข้อมูลสมาชิกแต่ละคนที่ส่งมาจาก MS Form 1 (ก่อน Assign anonymous_code)
    """
    __tablename__ = "student_members"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("import_sessions.id"), nullable=False)
    program    = Column(String)
    group_id   = Column(Integer, ForeignKey("groups.id"), nullable=True)  # กำหนดหลัง generate codes
    student_id = Column(String, nullable=False)  # รหัสนักศึกษา
    full_name  = Column(String)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ImportSession", back_populates="student_members")
    group   = relationship("Group", back_populates="members")
