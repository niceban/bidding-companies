from fastapi import APIRouter, HTTPException
from ..models import TaskCreate, TaskResponse, TaskListResponse, TaskStatus
from ..store import TaskStore
from ..worker import get_worker

router = APIRouter()


@router.post("", response_model=TaskResponse)
async def create_task(body: TaskCreate):
    """创建采集任务"""
    task = TaskStore.create(body.province, body.city)
    # 启动 worker
    get_worker().start()
    return task


@router.get("", response_model=TaskListResponse)
async def list_tasks(page: int = 1, page_size: int = 20):
    """任务列表"""
    tasks, total = TaskStore.list_all(page=page, page_size=page_size)
    return TaskListResponse(tasks=tasks, total=total, page=page, page_size=page_size)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """任务详情"""
    task = TaskStore.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}")
async def cancel_task(task_id: str):
    """取消任务"""
    task = TaskStore.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status == TaskStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Cannot cancel running task")
    TaskStore.update(task_id, status=TaskStatus.CANCELLED.value, message="Cancelled by user")
    return {"ok": True}
