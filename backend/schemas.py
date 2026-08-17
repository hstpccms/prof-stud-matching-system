"""
Pydantic Schemas for request/response validation
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


# ── Auth ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Import Session ─────────────────────────────────────────────────────────────
class ImportSessionOut(BaseModel):
    id: int
    uploaded_at: datetime
    filename: Optional[str]
    status: str
    is_active: Optional[bool] = False
    source: Optional[str] = "excel"
    expected_student_count: Optional[int] = None
    expected_prof_count: Optional[int] = None
    codes_generated: Optional[bool] = False

    model_config = {"from_attributes": True}


class StudentMemberOut(BaseModel):
    student_id: str
    full_name: Optional[str]

    model_config = {"from_attributes": True}


# ── Group ──────────────────────────────────────────────────────────────────────
class GroupOut(BaseModel):
    id: int
    group_id: Optional[str]
    anonymous_code: Optional[str]
    representative: Optional[str]
    member_count: Optional[int]
    topic_interest: Optional[str]
    members: List[StudentMemberOut] = []

    model_config = {"from_attributes": True}


# ── Professor ──────────────────────────────────────────────────────────────────
class ProfessorOut(BaseModel):
    id: int
    prof_id: Optional[str]
    anonymous_code: Optional[str]
    full_name: Optional[str]
    expertise: Optional[str]
    quota: Optional[int]

    model_config = {"from_attributes": True}


# ── Student Rankings ───────────────────────────────────────────────────────────
class StudentRankingOut(BaseModel):
    group_code: str
    prof_code: str
    rank: int

    model_config = {"from_attributes": True}


# ── Professor Scores ───────────────────────────────────────────────────────────
class ProfessorScoreOut(BaseModel):
    prof_code: str
    group_code: str
    score_a: Optional[int]
    score_b: Optional[int]
    sub_score: Optional[float]
    main_score: Optional[int]

    model_config = {"from_attributes": True}


# ── Validation ─────────────────────────────────────────────────────────────────
class ValidationError(BaseModel):
    code: str
    message: str


class ValidationResult(BaseModel):
    passed: bool
    errors: List[ValidationError]
    summary: dict


# ── Matching ───────────────────────────────────────────────────────────────────
class RunMatchingRequest(BaseModel):
    session_id: int
    seed: int = 2026
    program: str


class MatchingRunOut(BaseModel):
    id: int
    session_id: int
    run_at: datetime
    seed: int
    mode: Optional[str] = "both"
    status: str
    num_matched: int
    num_unmatched: int
    num_ties: int
    # Per-mode stats
    num_matched_student: int
    num_unmatched_student: int
    num_matched_professor: int
    num_unmatched_professor: int
    output_file_path: Optional[str]
    log: Optional[str]

    model_config = {"from_attributes": True}


class RecentRunSummary(BaseModel):
    id: int
    run_at: datetime
    mode: Optional[str] = "both"
    status: str
    num_matched: int
    num_unmatched: int
    num_groups: int  # total groups in that session

    model_config = {"from_attributes": True}


class MatchingResultOut(BaseModel):
    group_code: str
    assigned_prof: Optional[str]
    rank_given: Optional[int]
    main_score: Optional[int]
    sub_score: Optional[float]
    mode: Optional[str]

    model_config = {"from_attributes": True}


# ── Dashboard Stats ────────────────────────────────────────────────────────────
class DashboardStats(BaseModel):
    latest_session: Optional[ImportSessionOut]
    num_groups: int
    num_professors: int
    total_quota: int
    quota_sufficient: bool
    pct_groups_ranked: float
    pct_profs_scored: float
    incomplete_groups: List[str]  # anonymous_codes of groups not fully ranked
    incomplete_profs: List[str]   # anonymous_codes of profs not fully scored
    latest_run: Optional[MatchingRunOut]


# ── Webhook / MS Forms ────────────────────────────────────────────────────────────────

class ActivateSessionRequest(BaseModel):
    """Request body for POST /api/webhook/activate"""
    expected_counts: dict  # {"รังสีเทคนิค": {"students": 30, "profs": 10}, ...}


# ── Form 1: ข้อมูลกลุ่มนักศึกษา ────────────────────────────────────────────────────────────
class StudentMemberIn(BaseModel):
    student_id: str
    full_name: str


class FormGroupInfoIn(BaseModel):
    """Request body for POST /api/webhook/group-info (Form 1)"""
    program: str
    members: List[StudentMemberIn]      # รหัส + ชื่อ-นามสกุล สมาชิกทุกคน
    topic1_title: str
    topic1_detail: Optional[str] = None
    topic2_title: str
    topic2_detail: Optional[str] = None
    topic3_title: str
    topic3_detail: Optional[str] = None


# ── Form 2: ข้อมูลอาจารย์ ───────────────────────────────────────────────────────────────
class FormProfInfoIn(BaseModel):
    """Request body for POST /api/webhook/prof-info (Form 2)"""
    program: str
    full_name: str
    expertise: str
    quota: int


# ── Form 3: นักศึกษาจัดอันดับอาจารย์ (MS Forms Ranking) ────────────────────────────────────
class ProfRankEntryIn(BaseModel):
    prof_anonymous_code: str
    rank: int


class FormStudentRankingIn(BaseModel):
    """Request body for POST /api/webhook/student-ranking (Form 3)"""
    group_anonymous_code: str
    rankings: List[ProfRankEntryIn]


# ── Form 4: อาจารย์ให้คะแนนกลุ่ม ──────────────────────────────────────────────────────────────
class GroupScoreEntryIn(BaseModel):
    group_anonymous_code: str
    score_a: int
    score_b: int


class FormProfScoreIn(BaseModel):
    """Request body for POST /api/webhook/prof-score (Form 4)"""
    prof_anonymous_code: str
    scores: List[GroupScoreEntryIn]



class GroupAnonymousCodeOut(BaseModel):
    group_id: int
    anonymous_code: str
    member_count: int
    representative: Optional[str] = None
    members: List[StudentMemberOut] = []

    model_config = {"from_attributes": True}


class ProfAnonymousCodeOut(BaseModel):
    prof_id: int
    anonymous_code: str
    full_name: str

    model_config = {"from_attributes": True}


class SubmittedGroupOut(BaseModel):
    group_id: int
    anonymous_code: Optional[str]
    representative: Optional[str] = None
    member_count: int = 0
    members: List[StudentMemberOut] = []

    model_config = {"from_attributes": True}


class WebhookStatusOut(BaseModel):
    """สถานะการรับฟอร์มทั้งหมดสำหรับแสดงบน Dashboard"""
    session_id: Optional[int]
    is_active: bool
    source: str
    codes_generated: bool
    # ── Form 1 stats
    expected_student_count: Optional[int]
    received_student_count: int          # unique student_ids ที่ส่งมาแล้ว
    received_group_count: int            # จำนวนกลุ่มที่ส่ง Form 1 แล้ว
    form1_ready: bool                    # student count ครบตาม expected
    # ── Form 2 stats
    expected_prof_count: Optional[int]
    received_prof_count: int             # จำนวนอาจารย์ที่ส่ง Form 2 แล้ว
    form2_ready: bool                    # prof count ครบตาม expected
    # ── Form 3 & 4 stats (มีข้อมูลหลัง generate codes)
    ranked_group_count: int              # กลุ่มที่จัดอันดับแล้ว
    scored_prof_count: int               # อาจารย์ที่ให้คะแนนแล้ว
    pct_groups_ranked: float
    pct_profs_scored: float
    # ── Code tables (เพื่อแสดงตาราง mapping หลัง generate)
    group_codes: List[GroupAnonymousCodeOut]
    prof_codes: List[ProfAnonymousCodeOut]
    submitted_groups: List[SubmittedGroupOut] = []
