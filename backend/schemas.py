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

    model_config = {"from_attributes": True}


# ── Group ──────────────────────────────────────────────────────────────────────
class GroupOut(BaseModel):
    id: int
    group_id: Optional[str]
    anonymous_code: Optional[str]
    representative: Optional[str]
    member_count: Optional[int]
    topic_interest: Optional[str]

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


class MatchingRunOut(BaseModel):
    id: int
    session_id: int
    run_at: datetime
    seed: int
    status: str
    num_matched: int
    num_unmatched: int
    num_ties: int
    output_file_path: Optional[str]
    log: Optional[str]

    model_config = {"from_attributes": True}


class MatchingResultOut(BaseModel):
    group_code: str
    assigned_prof: Optional[str]
    rank_given: Optional[int]
    main_score: Optional[int]
    sub_score: Optional[float]

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
    latest_run: Optional[MatchingRunOut]
