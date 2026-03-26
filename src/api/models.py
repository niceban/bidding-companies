from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskCreate(BaseModel):
    province: str
    city: str


class TaskResponse(BaseModel):
    id: str
    province: str
    city: str
    status: TaskStatus
    progress: float = 0.0
    message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TaskListResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int
    page: int
    page_size: int


class ProjectResponse(BaseModel):
    id: str
    name: str
    amount: Optional[float]
    winner: str
    date: str
    province: str
    city: str
    district: Optional[str]
    buyer_name: Optional[str]


class CompanyResponse(BaseModel):
    id: str
    name: str
    phone: Optional[str]
    mobile: Optional[str]
    email: Optional[str]
    address: Optional[str]
    enriched: bool


class StatsResponse(BaseModel):
    total_projects: int
    total_companies: int
    enriched_companies: int
    provinces: int


class SkillInvokeRequest(BaseModel):
    skill: str  # "collect", "enrich"
    params: dict


class SkillInvokeResponse(BaseModel):
    task_id: str
    status: str
