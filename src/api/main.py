"""
中标数据采集系统 - FastAPI 服务
"""
import os
import sys
from pathlib import Path
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

# 确保项目根目录在路径中
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.api.routers import tasks, data, skills
from src.api.worker import get_worker

app = FastAPI(
    title="中标数据采集 API",
    description="全国工程中标数据采集系统 - Web管理接口",
    version="1.0.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境限制域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(tasks.router, prefix="/api/tasks", tags=["任务管理"])
app.include_router(data.router, prefix="/api/data", tags=["数据查询"])
app.include_router(skills.router, prefix="/api/skills", tags=["Skill接口"])

# 健康检查
@app.get("/health")
async def health():
    return {"status": "ok"}


# 首页重定向到 docs
@app.get("/")
async def root():
    return RedirectResponse(url="/docs")


# WebSocket 进度推送（简化版 - 轮询）
@app.websocket("/ws/tasks/{task_id}")
async def task_ws(websocket: WebSocket, task_id: str):
    """WebSocket 实时推送任务进度"""
    await websocket.accept()
    try:
        from src.api.store import TaskStore
        from src.api.models import TaskStatus

        while True:
            task = TaskStore.get(task_id)
            if not task:
                await websocket.send_json({"error": "Task not found"})
                break
            await websocket.send_json({
                "id": task.id,
                "status": task.status.value,
                "progress": task.progress,
                "message": task.message,
            })
            if task.status in (TaskStatus.DONE, TaskStatus.FAILED, TaskStatus.CANCELLED):
                break
            import asyncio
            await asyncio.sleep(2)
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
