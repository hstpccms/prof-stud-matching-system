"""
Pydantic Schemas for request/response validation
"""
from datetime import datetime
from typing import Optional, List, Union, Any
from pydantic import BaseModel, field_validator, Field


# ── Auth ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Optional[str] = None


# ── User management (admin creates student/professor accounts) ─────────────────
class UserCreate(BaseModel):
    username: str
    password: str
    role: str  # "student" | "professor" (admin สร้างผ่าน seed/CLI)
    full_name: Optional[str] = None
    student_id: Optional[str] = None  # เฉพาะ student
    program: Optional[str] = None


class UserBulkCreate(BaseModel):
    users: List[UserCreate]


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    full_name: Optional[str] = None
    student_id: Optional[str] = None
    program: Optional[str] = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class ResetPasswordRequest(BaseModel):
    new_password: str


# ── Import Session ─────────────────────────────────────────────────────────────
class ImportSessionOut(BaseModel):
    id: int
    uploaded_at: datetime
    filename: Optional[str]
    status: str
    is_active: Optional[bool] = False
    source: Optional[str] = "excel"
    program: Optional[str] = None
    expected_student_count: Optional[int] = None
    expected_prof_count: Optional[int] = None
    codes_generated: Optional[bool] = False
    is_closed: Optional[bool] = False

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
    seed: int = Field(default=2026, ge=0, le=2_147_483_647)
    program: str


class MatchingRunOut(BaseModel):
    id: int
    session_id: int
    program: Optional[str] = None
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
    session_id: Optional[int] = None
    program: Optional[str] = None
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


# ── Student Tracking ─────────────────────────────────────────────────────────
class StudentTrackingOut(BaseModel):
    id: Optional[int] = None
    student_id: str
    full_name: Optional[str] = "—"
    group_id: Optional[str] = "—"
    form_submitted: bool = True
    status: str = "ส่งแล้ว"
    form1_submitted: bool = False   # อยู่ในกลุ่มที่ส่ง Form 1 แล้ว
    form3_submitted: bool = False   # กลุ่มของตนจัดอันดับ (Form 3) แล้ว

    model_config = {"from_attributes": True}


# ── Submitted Entities ────────────────────────────────────────────────────────
class SubmittedGroupOut(BaseModel):
    group_id: Any
    anonymous_code: Optional[str] = None
    representative: Optional[str] = None
    member_count: int = 0
    members: List[StudentMemberOut] = []

    model_config = {"from_attributes": True}


class SubmittedProfOut(BaseModel):
    prof_id: Optional[str] = None
    anonymous_code: Optional[str] = None
    full_name: str
    expertise: Optional[str] = None
    quota: int = 0
    form2_submitted: bool = True
    form4_submitted: bool = False
    scores_count: int = 0
    total_groups_to_score: int = 0

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
    data_stale: bool = False
    latest_run: Optional[MatchingRunOut]
    groups: List[SubmittedGroupOut] = []
    professors: List[SubmittedProfOut] = []
    students: List[StudentTrackingOut] = []


# ── Round management (admin) ──────────────────────────────────────────────────
class OpenRoundRequest(BaseModel):
    """Request body for POST /api/round/open — เปิดรอบของหลักสูตรที่ระบุ"""
    program: str
    expected_counts: dict = {}  # {"รังสีเทคนิค": {"students": 30, "profs": 10}, ...} (optional)


class ProgramActionRequest(BaseModel):
    """Request body สำหรับ generate-codes / close / reopen — ระบุหลักสูตร"""
    program: str


# ── Form 1: ข้อมูลกลุ่มนักศึกษา ────────────────────────────────────────────────────────────
class StudentMemberIn(BaseModel):
    student_id: str
    full_name: str


class StudentForm1In(BaseModel):
    """Request body for POST /api/student/form1 (Form 1) — program มาจากบัญชีที่ล็อกอิน"""
    members: List[StudentMemberIn] = Field(min_length=2, max_length=4)   # สมาชิกกลุ่ม (กติกากลุ่มละ 2–4 คน)
    topic1_title: str = Field(max_length=150)
    topic1_detail: Optional[str] = Field(default=None, max_length=300)
    topic2_title: str = Field(max_length=150)
    topic2_detail: Optional[str] = Field(default=None, max_length=300)
    topic3_title: str = Field(max_length=150)
    topic3_detail: Optional[str] = Field(default=None, max_length=300)


# ── Form 2: ข้อมูลอาจารย์ — full_name/program มาจากบัญชีที่ล็อกอิน ──────────────────────────
class ProfessorForm2In(BaseModel):
    """Request body for POST /api/professor/form2 (Form 2)"""
    expertise: str = Field(max_length=200)
    quota: int = Field(ge=1, le=50)


# ── Form 3: นักศึกษาจัดอันดับอาจารย์ — group resolve จากบัญชีที่ล็อกอิน ─────────────────────
class ProfRankEntryIn(BaseModel):
    prof_anonymous_code: str
    rank: int = Field(ge=1)


class StudentForm3In(BaseModel):
    """Request body for POST /api/student/form3 (Form 3)"""
    rankings: List[ProfRankEntryIn] = Field(max_length=200)


# ── Form 4: อาจารย์ให้คะแนนกลุ่ม — prof resolve จากบัญชีที่ล็อกอิน ─────────────────────────
class GroupScoreEntryIn(BaseModel):
    group_anonymous_code: str
    score_a: int = Field(ge=0, le=100)
    score_b: int = Field(ge=0, le=100)

    @field_validator("score_a", "score_b", mode="before")
    @classmethod
    def _round_scores(cls, v):
        # กันเคสอาจารย์กรอกทศนิยม (เช่น 85.5) ที่เดิมทำให้ validation 422 → ปัดเป็นจำนวนเต็ม
        if isinstance(v, float):
            return round(v)
        return v


class ProfessorForm4In(BaseModel):
    """Request body for POST /api/professor/form4 (Form 4)"""
    scores: List[GroupScoreEntryIn] = Field(max_length=200)


# ── Portal "me" status (student / professor) ──────────────────────────────────
class AnonProfOut(BaseModel):
    """อาจารย์แบบนิรนามสำหรับ Form 3 (นักศึกษาเห็นแค่รหัส + ความเชี่ยวชาญ)"""
    anonymous_code: str
    expertise: Optional[str] = None


class AnonGroupOut(BaseModel):
    """กลุ่มแบบนิรนามสำหรับ Form 4 (อาจารย์เห็นแค่รหัส + หัวข้อ)"""
    anonymous_code: str
    member_count: int = 0
    topics: List[Any] = []


class StudentMeOut(BaseModel):
    round_open: bool
    codes_generated: bool
    has_group: bool
    is_representative: bool
    group_anonymous_code: Optional[str] = None
    ranking_submitted: bool = False
    matching_started: bool = False
    is_closed: bool = False
    representative_name: Optional[str] = None
    topics: List[Any] = []                       # prefill Form 1
    current_rankings: List[ProfRankEntryIn] = [] # prefill Form 3
    group: Optional[SubmittedGroupOut] = None


class ProfessorMeOut(BaseModel):
    round_open: bool
    codes_generated: bool
    info_submitted: bool
    anonymous_code: Optional[str] = None
    expertise: Optional[str] = None
    quota: Optional[int] = None
    score_submitted: bool = False
    scored_count: int = 0
    total_groups: int = 0
    matching_started: bool = False
    is_closed: bool = False
    current_scores: List[GroupScoreEntryIn] = []  # prefill Form 4


# ── Roster (admin creates all accounts; students pick members from it) ─────────
class RosterOut(BaseModel):
    student_id: str
    full_name: Optional[str] = None


class RosterMissingOut(BaseModel):
    student_id: Optional[str] = None
    full_name: Optional[str] = None
    username: str


class RosterCheckOut(BaseModel):
    expected_count: int
    covered_count: int
    num_groups: int
    missing: List[RosterMissingOut] = []      # บัญชีที่ยังไม่ถูกใส่ในกลุ่ม
    unknown_ids: List[str] = []               # รหัสที่กรอกมาแต่ไม่ตรง roster
    no_student_id: List[str] = []             # username ของบัญชีที่ยังไม่ตั้ง student_id
    # ── ฝั่งอาจารย์ ──
    prof_expected_count: int = 0              # บัญชีอาจารย์ในหลักสูตร
    prof_form2_count: int = 0                 # อาจารย์ที่ส่ง Form 2 แล้ว
    prof_form4_count: int = 0                 # อาจารย์ที่ให้คะแนนครบทุกกลุ่ม (Form 4)


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


class RoundStatusOut(BaseModel):
    """สถานะการรับฟอร์มทั้งหมดสำหรับแสดงบน Dashboard (admin)"""
    session_id: Optional[int]
    is_active: bool
    source: str
    codes_generated: bool
    is_closed: bool = False
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
    group_codes: List[GroupAnonymousCodeOut] = []
    prof_codes: List[ProfAnonymousCodeOut] = []
    submitted_groups: List[SubmittedGroupOut] = []
    submitted_professors: List[SubmittedProfOut] = []
    students: List[StudentTrackingOut] = []
