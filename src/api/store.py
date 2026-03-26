import json
import uuid
import os
from datetime import datetime
from pathlib import Path
from typing import Optional
from .models import TaskStatus, TaskCreate, TaskResponse

TASKS_DIR = Path(".workflow/tasks")
TASKS_DIR.mkdir(parents=True, exist_ok=True)


class TaskStore:
    """基于文件的简单任务存储（可切换 Redis）"""

    @staticmethod
    def _task_file(task_id: str) -> Path:
        return TASKS_DIR / f"{task_id}.json"

    @staticmethod
    def create(province: str, city: str) -> TaskResponse:
        task_id = str(uuid.uuid4())[:8]
        now = datetime.now().isoformat()
        task = {
            "id": task_id,
            "province": province,
            "city": city,
            "status": TaskStatus.PENDING.value,
            "progress": 0.0,
            "message": "Task queued",
            "created_at": now,
            "updated_at": now,
        }
        with open(TaskStore._task_file(task_id), "w") as f:
            json.dump(task, f, indent=2)
        return TaskResponse(**task)

    @staticmethod
    def get(task_id: str) -> Optional[TaskResponse]:
        path = TaskStore._task_file(task_id)
        if not path.exists():
            return None
        with open(path) as f:
            return TaskResponse(**json.load(f))

    @staticmethod
    def update(task_id: str, **kwargs) -> Optional[TaskResponse]:
        path = TaskStore._task_file(task_id)
        if not path.exists():
            return None
        with open(path) as f:
            task = json.load(f)
        task.update(kwargs)
        task["updated_at"] = datetime.now().isoformat()
        with open(path, "w") as f:
            json.dump(task, f, indent=2)
        return TaskResponse(**task)

    @staticmethod
    def list_all(page: int = 1, page_size: int = 20) -> tuple[list[TaskResponse], int]:
        tasks = []
        for f in TASKS_DIR.glob("*.json"):
            with open(f) as fp:
                tasks.append(TaskResponse(**json.load(fp)))
        tasks.sort(key=lambda t: t.created_at, reverse=True)
        total = len(tasks)
        start = (page - 1) * page_size
        return tasks[start:start + page_size], total

    @staticmethod
    def delete(task_id: str) -> bool:
        path = TaskStore._task_file(task_id)
        if path.exists():
            path.unlink()
            return True
        return False
