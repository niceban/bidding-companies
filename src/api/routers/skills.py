from fastapi import APIRouter, HTTPException
from ..models import SkillInvokeRequest, SkillInvokeResponse
from ..store import TaskStore
from ..worker import get_worker

router = APIRouter()


@router.post("/invoke", response_model=SkillInvokeResponse)
async def skill_invoke(body: SkillInvokeRequest):
    """
    Skill 接口 - 让其他 Agent 可以调用爬虫服务

    Body:
    {
        "skill": "collect",  # "collect" | "enrich"
        "params": {"province": "山东省", "city": "济南市"}
    }
    """
    if body.skill not in ("collect", "enrich"):
        raise HTTPException(status_code=400, detail=f"Unknown skill: {body.skill}")

    province = body.params.get("province")
    city = body.params.get("city")

    if not province or not city:
        raise HTTPException(status_code=400, detail="province and city are required")

    # 创建任务
    task = TaskStore.create(province, city)
    get_worker().start()

    return SkillInvokeResponse(task_id=task.id, status="queued")
