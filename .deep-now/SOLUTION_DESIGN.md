# 完整方案设计：爬虫服务 Web 管理界面

## 需求梳理

**目标**：为爬虫服务构建 Web 管理界面，同时让爬虫服务可以被 Skill/Plugin 调用。

**核心功能**：
1. 采集任务管理（创建 / 监控 / 取消）
2. 数据查看（省份 / 城市 / 项目列表）
3. 企业补全状态
4. Skill 接口（让其他 Agent 可以调用爬虫服务）

---

## 方案选择

### 最终推荐：方案 A（FastAPI 中间层 + 渐进式改造）

**原因**：
- 不改动现有 `BidWorkflow` 逻辑，风险为零
- 前端和爬虫解耦，各自独立迭代
- 任务队列解决爬虫耗时长的问题（HTTP 请求不阻塞）
- Skill 接口可单独加，不影响现有架构

---

## 架构设计

```
┌──────────────────────────────────────────────────────────────┐
│                     Web 前端 (React)                          │
│  采集任务创建 │ 实时进度 │ 数据展示 │ 配置管理                  │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP / WebSocket
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  FastAPI 服务 (端口 8000)                       │
│                                                              │
│  POST /api/tasks              创建采集任务                     │
│  GET  /api/tasks/{id}         查询任务状态                    │
│  GET  /api/tasks              任务列表                        │
│  DELETE /api/tasks/{id}       取消任务                        │
│                                                              │
│  GET  /api/data/projects       项目数据 (分页)                 │
│  GET  /api/data/companies     企业数据                        │
│  GET  /api/stats              统计概览                        │
│                                                              │
│  WebSocket /ws/tasks/{id}     实时进度推送                    │
│                                                              │
│  POST /api/skills/invoke      ⭐ Skill 接口（Agent 调用）      │
└────────────────────────┬─────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌──────────┐   ┌──────────────┐  ┌──────────┐
   │  Redis   │   │ BidWorkflow  │  │  Neo4j   │
   │  任务队列 │   │  (Python)     │  │  (查询)  │
   └──────────┘   └──────┬───────┘  └──────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Claude Code  │
                  │     CLI      │
                  └──────────────┘
```

---

## 目录结构（新增）

```
/Users/c/bidding-companies/
├── src/
│   ├── api/                    # ⭐ 新增：FastAPI 服务
│   │   ├── main.py             # FastAPI 入口
│   │   ├── routers/
│   │   │   ├── tasks.py         # 任务管理接口
│   │   │   ├── data.py          # 数据查询接口
│   │   │   └── skills.py        # Skill 接口
│   │   ├── models.py            # Pydantic 模型
│   │   ├── worker.py            # 后台任务执行器
│   │   └── websocket.py          # WebSocket 进度推送
│   │
│   ├── web/                    # ⭐ 新增：React 前端
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── TaskCreate.tsx    # 任务创建
│   │   │   │   ├── TaskMonitor.tsx    # 任务监控
│   │   │   │   └── DataView.tsx       # 数据查看
│   │   │   ├── components/
│   │   │   │   ├── ProvinceTree.tsx   # 省市树
│   │   │   │   └── TaskProgress.tsx  # 进度条
│   │   │   └── api.ts           # API 客户端
│   │   └── package.json
│   │
│   └── claude_workflow.py       # 现有代码（不改动）
│
├── prompts/                     # 现有代码（不改动）
├── workflow/                    # 现有代码（不改动）
```

---

## 实施计划（3天）

| Day | 任务 | 交付物 |
|-----|------|--------|
| **Day 1** | FastAPI 核心 + 任务队列 | `src/api/main.py` + Redis 队列 |
| **Day 2** | React 前端（任务创建 + 监控） | `src/web/` 完整页面 |
| **Day 3** | 数据展示 + Skill 接口 + 联调 | 数据页面 + `/api/skills/invoke` |

---

## Day 1：FastAPI 核心

### 文件：`src/api/main.py`

```python
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from .routers import tasks, data, skills

app = FastAPI(title="中标数据采集 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境限制域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router, prefix="/api/tasks")
app.include_router(data.router, prefix="/api/data")
app.include_router(skills.router, prefix="/api/skills")

@app.get("/api/stats")
async def stats():
    # 从 Neo4j 读取统计
    return {"projects": count, "companies": count, ...}
```

### 文件：`src/api/worker.py`

```python
import asyncio
from RedisQueue import Queue
from src.claude_workflow import BidWorkflow

q = Queue("bidding_tasks")

def process_task(task_id, province, city):
    workflow = BidWorkflow()
    workflow.collect_enrich_city(province, city)

async def worker():
    while True:
        task = q.dequeue()
        if task:
            asyncio.create_task(process_task(**task))
        await asyncio.sleep(1)
```

### API 设计

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/tasks` | POST | 创建采集任务 `{province, city}` |
| `/api/tasks` | GET | 任务列表（分页） |
| `/api/tasks/{id}` | GET | 任务详情 + 状态 |
| `/api/tasks/{id}` | DELETE | 取消任务 |
| `/ws/tasks/{id}` | WS | 实时进度推送 |
| `/api/data/projects` | GET | 项目数据（分页 / 筛选） |
| `/api/data/companies` | GET | 企业数据 |
| `/api/stats` | GET | 统计概览 |
| `/api/skills/invoke` | POST | ⭐ Agent 调用接口 |

---

## Day 2：React 前端

### 页面清单

**1. 任务创建页** (`TaskCreate.tsx`)
- 省份下拉 → 城市多选
- 一键采集 / 分步采集
- 定时任务配置（可选）

**2. 任务监控页** (`TaskMonitor.tsx`)
- 任务列表（状态：pending / running / done / failed）
- 实时进度（WebSocket）
- 失败重试按钮

**3. 数据查看页** (`DataView.tsx`)
- 省 → 市 → 区 → 项目 层级导航
- 项目列表（金额 / 日期 / 中标单位）
- 企业详情弹窗（联系方式）

---

## Day 3：Skill 接口 + 联调

### Skill 接口设计（⭐ 让 Agent 可以调用）

```python
# POST /api/skills/invoke
# Body: {"skill": "collect", "params": {"province": "山东省", "city": "济南市"}}
# Response: {"task_id": "xxx", "status": "queued"}

@app.post("/api/skills/invoke")
async def skill_invoke(skill: str, params: dict):
    task_id = create_task(skill, params)
    return {"task_id": task_id, "status": "queued"}
```

**这个接口的意义**：
- 其他 Agent（如 `team-frontend`）可以通过 HTTP 调用爬虫
- 不再需要 SSH 到服务器跑 CLI
- 实现「前端 Skill」调用「爬虫 Skill」的解耦

---

## Skill 封装（可选，Day 3+）

用 `/skill-create` 从 `BidWorkflow` 提取模式，生成一个轻量 Skill：

```markdown
# bidding-workflow-skill

## 触发词
"采集 XX 省数据" / "补全企业信息"

## 执行
1. POST /api/skills/invoke
2. 轮询 /api/tasks/{id} 直到完成
3. 返回数据摘要

## 限制
- 需要 FastAPI 服务运行
- 需要 Neo4j 连接
```

---

## 技术选型说明

| 技术 | 选择 | 原因 |
|------|------|------|
| Web 框架 | FastAPI | Python 原生，轻量，自动化文档 |
| 任务队列 | Redis Queue | 简单，满足需求，无需额外服务 |
| 进度推送 | WebSocket | 实时性，SSE 备选 |
| 前端框架 | React (Vite) | 快速开发，组件复用 |
| 状态管理 | React Query | 简化数据获取和缓存 |

---

## 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Playwright MCP 无法独立运行 | 爬虫必须在 Claude Code 环境 | 保持 `BidWorkflow` 不改动，通过 CLI 调用 |
| MiniMax API 速率限制 | 大规模采集失败 | 任务队列 + 指数退避重试 |
| 爱企查反爬 | Cookie 失效 | 人工维护 + 监控告警 |
| Neo4j 连接 | 单点故障 | 连接池 + 熔断器 |
