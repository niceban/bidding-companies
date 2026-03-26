import os
import sys
import time
import threading
import importlib
from pathlib import Path
from .store import TaskStore
from .models import TaskStatus

# 确保项目根目录在 Python 路径
_PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(_PROJECT_ROOT))


class TaskWorker:
    """后台任务执行器"""

    def __init__(self):
        self.running = False

    def start(self):
        """启动 worker（在独立线程中）"""
        if self.running:
            return
        self.running = True
        t = threading.Thread(target=self._run, daemon=True)
        t.start()

    def _run(self):
        """监听任务队列并执行"""
        from .store import TaskStore
        from .models import TaskStatus

        while self.running:
            tasks, _ = TaskStore.list_all(page=1, page_size=100)
            for task in tasks:
                if task.status != TaskStatus.PENDING:
                    continue

                task_id = task.id
                province = task.province
                city = task.city

                # 更新状态为 running
                TaskStore.update(task_id, status=TaskStatus.RUNNING.value, progress=0.1, message="Starting workflow...")

                try:
                    result = self._execute_workflow(province, city)
                    if result["success"]:
                        TaskStore.update(task_id, status=TaskStatus.DONE.value, progress=1.0, message=result.get("message", "Completed"))
                    else:
                        TaskStore.update(task_id, status=TaskStatus.FAILED.value, message=result.get("error", "Failed"))
                except Exception as e:
                    TaskStore.update(task_id, status=TaskStatus.FAILED.value, message=str(e))

            time.sleep(5)

    def _execute_workflow(self, province: str, city: str) -> dict:
        """执行 BidWorkflow"""
        try:
            # 切换到项目根目录（ClaudeController 需要）
            os.chdir(str(_PROJECT_ROOT))

            # 加载 MiniMax API key
            _load_minimax_key()

            # 动态导入避免循环引用
            from src.claude_workflow import BidWorkflow

            workflow = BidWorkflow()
            success = workflow.collect_enrich_city(province, city)
            if success:
                return {"success": True, "message": f"Completed {province}/{city}"}
            else:
                return {"success": False, "error": "Workflow returned False"}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}


def _load_minimax_key():
    """加载 MiniMax API key"""
    profile_file = Path.home() / ".claude" / "api-profiles" / "minimax.json"
    if profile_file.exists():
        import json
        with open(profile_file) as f:
            data = json.load(f)
        os.environ["MINIMAX_API_KEY"] = data.get("api_key", "")


# 全局 worker 实例
_worker = None

def get_worker():
    global _worker
    if _worker is None:
        _worker = TaskWorker()
    return _worker
