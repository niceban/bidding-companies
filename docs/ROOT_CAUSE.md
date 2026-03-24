# Root Cause Analysis: 基于 claude-node 的工作流架构设计

## 问题定义

用户核心诉求：
1. **删除所有 Python 文件**
2. **以 claude-node 为核心设计完整 workflow**
3. **实现定时任务一键启动**

---

## 关键发现：全国平台层级结构

### 平台覆盖率

| 平台类型 | 数量 | 独立域名比例 | 采集方式 |
|---------|------|-------------|---------|
| 省级 | 31个 | ~95% | 直接访问 |
| 市级 | 333个 | ~30% | 省级导航发现 |
| 区县级 | ~2800个 | ~10% | 市级导航发现 |

### 核心结论
**大多数省市县共用一个省级平台**，通过导航菜单区分层级：
- 山东省：`ggzyjy.shandong.gov.cn` 统一入口
- 江苏省：`jsggzy.jszwfw.gov.cn` 统一入口

### 采集策略：先省级导航，再层层深入

```
省级平台
  ├── 提取所有地市链接 → 17个
  │     └── 每个地市提取所有区县链接 → 平均80个/市
  │           └── 采集中标数据
  └── 补充：直接探测独立域名的地市平台
```

---

## 关键发现：claude-node 源码分析

### claude-node 环境变量机制（已验证）

**核心代码** (`controller.py:235`)：
```python
env={**os.environ, "TERM": "dumb"}
```

**结论**：claude-node 会自动继承父进程**所有**环境变量，包括 MINIMAX_API_KEY。

**解决方案**：
```python
import os
os.environ["MINIMAX_API_KEY"] = os.environ.get("MINIMAX_API_KEY")  # 从 Claude Code 环境继承
# 或直接在 shell 中设置
# export MINIMAX_API_KEY=your_key
# python3 src/claude_workflow.py full
```

### claude-node 仓库位置

本地克隆：`/Users/c/claw-army/claude-node`

```
claude_node/
├── __init__.py       # 公开 exports
├── controller.py     # ClaudeController, ClaudeMessage
├── router.py         # AgentNode, MultiAgentRouter
├── runtime.py        # Binary 发现和版本检查
└── exceptions.py     # 类型化异常层次
```

### 核心类详解

#### ClaudeController（controller.py）

```python
class ClaudeController:
    def __init__(
        self,
        system_prompt: str = "",
        append_system_prompt: str = "",
        tools: list[str] = None,
        allowed_tools: list[str] = None,
        disallowed_tools: list[str] = None,
        permission_mode: str = None,
        skip_permissions: bool = False,
        bare: bool = False,
        resume: str = None,
        continue_session: bool = False,
        model: str = None,
        cwd: str = None,
        add_dirs: list[str] = None,
        on_message: Callable[["ClaudeMessage"], None] = None,
        transcript_path: str = None,
    ):
```

**关键方法**：
- `start(wait_init_timeout)` — 启动 Claude CLI 进程
- `stop(timeout)` — 终止进程
- `send(text, timeout)` — 发送消息，阻塞直到 `type=result`
- `send_nowait(text)` — 非阻塞发送
- `wait_for_result(timeout)` — 等待结果（配合 send_nowait）
- `fork()` — 创建从当前会话分支的新 Controller
- `get_messages()` — 获取所有解析后的消息
- `get_tool_errors(start_index)` — 获取工具执行失败列表
- `send_checked(text, timeout)` — 同时返回 (result, tool_errors)

**属性**：
- `alive` — 进程是否存活
- `session_id` — 当前会话 ID
- `pid` — 进程 ID

#### ClaudeMessage（controller.py）

```python
@dataclass
class ClaudeMessage:
    type: str
    subtype: str = ""
    raw: dict = field(default_factory=dict)
```

**类型判断属性**：
| 属性 | 含义 |
|------|------|
| `is_init` | system/init 消息 |
| `is_result` | result 消息 |
| `is_result_ok` | result + subtype=success |
| `is_result_error` | result + subtype=error |
| `is_api_error` | result_text 包含 API 错误前缀 |
| `truly_succeeded` | result ok 且无 API 错误 |
| `is_assistant` | assistant 消息 |
| `is_tool_result` | user/tool_result 消息 |

**内容提取属性**：
| 属性 | 含义 |
|------|------|
| `result_text` | 本轮最终回复文本 |
| `session_id` | 会话 ID |
| `assistant_texts` | assistant 消息中的所有 text block |
| `tool_calls` | assistant 消息中的所有 tool_use block |
| `tool_results` | user 消息中的所有 tool_result block |
| `cost_usd` | 本轮费用 |
| `num_turns` | 本轮 LLM 调用次数 |

#### AgentNode（router.py）

```python
class AgentNode:
    def __init__(
        self,
        name: str,
        system_prompt: str = "",
        append_system_prompt: str = "",
        tools: list[str] = None,
        allowed_tools: list[str] = None,
        disallowed_tools: list[str] = None,
        skip_permissions: bool = True,
        bare: bool = False,
        cwd: str = None,
        on_message: Callable[[ClaudeMessage], None] = None,
    ):
```

**关键方法**：
- `start()` — 启动 agent（创建并启动 ClaudeController）
- `stop()` — 停止 agent
- `send(text, timeout)` — 发送消息，返回 result_text
- `alive` — agent 是否存活

#### MultiAgentRouter（router.py）

```python
class MultiAgentRouter:
    def add(self, node: AgentNode) -> "MultiAgentRouter":  # 链式调用
    def start_all(self, parallel: bool = True):  # 并行或串行启动
    def stop_all():  # 停止所有 agent
    def send(self, agent_name: str, message: str, timeout: float = 60) -> Optional[str]
    def route(self, message: str, to: str, wrap: str = "{message}", timeout: float = 60) -> Optional[str]
    def parallel_send(self, message: str, agent_names: list[str], timeout: float = 90) -> dict[str, str]
    def get_ctrl(self, agent_name: str) -> ClaudeController  # 获取底层 controller
```

**A2A 路由示例**：
```python
with MultiAgentRouter() as router:
    router.add(AgentNode("PM", system_prompt="你是产品经理"))
    router.add(AgentNode("DEV", system_prompt="你是工程师"))
    router.start_all()

    pm_reply = router.send("PM", "设计一个功能")
    dev_reply = router.route(
        pm_reply or "",
        to="DEV",
        wrap="PM proposal:\n{message}\n\nPlease review technical feasibility.",
    )
```

### stream-json 协议详解

**启动命令**：
```bash
claude --input-format stream-json --output-format stream-json --verbose
```

**输入格式**：
```json
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"your message"}]}}
```

**输出消息序列**：
```
system/init        → 启动元数据，包含 session_id 和可用工具
assistant          → 可能包含 thinking、text、tool_use blocks
user/tool_result   → CLI 自动生成的工具执行结果
result             → 本轮完成 — 主要同步信号
```

**同步规则（核心）**：
> **必须等待 `type=result` 后才能发送下一条用户消息**

违反此规则会导致上下文混乱或 CLI 错误。

### 会话管理机制

| 方法 | 说明 |
|------|------|
| 新会话 | 默认行为 |
| `resume=<session_id>` | 恢复指定会话 |
| `continue_session=True` | 继续最近会话（不推荐多会话环境） |
| `controller.fork()` | 创建新 Controller，恢复当前会话（继承对话历史） |

**fork() 示例**：
```python
# 原始 controller
ctrl = ClaudeController(system_prompt="你是一个助手")
ctrl.start()
result1 = ctrl.send("记住数字 42")

# Fork 新会话（继承历史）
forked = ctrl.fork()
forked.start()
result2 = forked.send("我刚才记的数字是多少？")  # 应该回答 42
```

---

## claude-node 能做什么

| 能力 | 说明 |
|------|------|
| 进程控制 | 启动/停止 Claude CLI 持久进程 |
| 消息发送 | 通过 stdin 发送 JSON 格式消息 |
| 结果等待 | 等待 `type=result` 消息作为同步点 |
| 会话管理 | 支持 `resume`、`fork`（分支会话） |
| 多 Agent | `MultiAgentRouter` 管理多个并发 agent |
| 回调机制 | `on_message` 实时处理输出 |
| 工具结果 | 解析 `tool_use` 和 `tool_result` 块 |
| 错误检查 | `send_checked()` 同时返回 API 错误和工具错误 |
| Transcript | JSONL 格式记录完整会话 |

---

## 删除 Python 文件后的选择

**结论**：删除 Python 文件后，claude-node 无法以库形式使用，但其**概念模型**可以直接用 Claude CLI + Shell 脚本实现：

| claude-node 概念 | 纯 CLI 替代方案 |
|------------------|-----------------|
| `ClaudeController` | `claude --input-format stream-json` 进程 |
| `ClaudeMessage` | 解析 JSON 行 |
| `MultiAgentRouter` | Shell 脚本 + 进程管理 |
| 会话 `resume` | `claude --resume <session_id>` |
| `fork()` | `claude --resume <session_id>` (新进程) |
| 采集循环 | Shell `for` 循环 + CLI 调用 |
| 多步骤工作流 | YAML 配置 + Shell 编排 |
| A2A 路由 | Shell 函数封装消息传递 |

---

## 推荐的纯 MCP Workflow 架构

### 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Servers                             │
├─────────────────────────────────────────────────────────────┤
│  Playwright MCP    │  Neo4j MCP      │  ENScan_GO MCP      │
│  浏览器自动化       │  图数据库       │  企业信息补全        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Claude CLI (核心运行时)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Collector   │  │ Enricher   │  │ Analyzer    │         │
│  │ Agent       │  │ Agent       │  │ Agent       │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Shell 编排层                             │
│  workflow.sh (主入口)                                       │
│  ├── collect.sh     (采集工作流)                            │
│  ├── enrich.sh      (补全工作流)                            │
│  └── analyze.sh     (分析工作流)                            │
└─────────────────────────────────────────────────────────────┘
```

### MCP Server 配置

```bash
# Playwright - 浏览器自动化
claude mcp add playwright npx "@playwright/mcp@latest"

# Neo4j - 图数据库
claude mcp add neo4j /opt/anaconda3/bin/mcp-neo4j-cypher

# ENScan_GO - 企业信息补全（开源免费）
claude mcp add enscan npx @wgpsoc/enscan-gomcp
```

---

## 采集循环设计

### 方式 A：单 CLI 会话 + 循环（推荐）

```bash
#!/bin/bash
# collect.sh - 全国中标数据采集

PROVINCES=("山东省" "江苏省" "浙江省" "广东省" "四川省")
CITIES_SD=("济南" "青岛" "淄博" "枣庄" "东营" "烟台" "潍坊" "济宁" "泰安" "威海" "日照" "临沂" "德州" "聊城" "滨州" "菏泽")

# 初始化会话
SESSION_FILE=".claude_session"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 启动 Claude（持久会话）
claude --input-format stream-json \
       --output-format stream-json \
       --verbose \
       --dangerously-skip-permissions \
       > collection_log_${TIMESTAMP}.jsonl 2>&1 &
       
CLI_PID=$!

# 主采集循环
for province in "${PROVINCES[@]}"; do
    echo "采集 $province..."
    
    claude -p "
    使用 Playwright MCP 采集 $province 省政府采购中标数据：
    1. 访问对应省级公共资源交易平台
    2. 找到'中标公告'栏目
    3. 提取 10 条最新中标记录（项目名称、中标单位、中标金额、日期）
    4. 使用 Neo4j MCP 存入图数据库
    " --dangerously-skip-permissions --continue
    
    sleep 5
done

# 停止 Claude
kill $CLI_PID 2>/dev/null
```

### 方式 B：会话分支（FORK）

```bash
#!/bin/bash
# 并行采集多个省份

# 主会话采集山东省
claude -p "采集山东省中标数据" --dangerously-skip-permissions

# FORK 新会话采集江苏省（继承山东省会话上下文）
claude -p "采集江苏省中标数据" --dangerously-skip-permissions --resume <SD_SESSION_ID>

# FORK 新会话采集浙江省
claude -p "采集浙江省中标数据" --dangerously-skip-permissions --resume <SD_SESSION_ID>
```

---

## 会话管理设计

### 会话持久化

```bash
# 保存会话 ID
claude -p "记住：项目代号 ALPHA" --dangerously-skip-permissions 2>&1 | grep "session_id" > .session

# 恢复会话继续工作
SESSION_ID=$(cat .session)
claude -p "项目代号是什么？" --dangerously-skip-permissions --resume $SESSION_ID
```

### 多会话路由

```bash
#!/bin/bash
# router.sh - 多 Agent 路由

# 启动多个专用 Agent
claude --session-id collector --dangerously-skip-permissions &
claude --session-id enricher --dangerously-skip-permissions &
claude --session-id analyzer --dangerously-skip-permissions &

# 路由消息到指定 Agent
route_to() {
    local agent=$1
    local message=$2
    claude -p "$message" --dangerously-skip-permissions --resume ${agent}_session
}

# 采集 → 补全 → 分析 流水线
route_to "collector" "采集山东省 10 条中标数据"
route_to "enricher" "补全刚采集公司的联系方式"
route_to "analyzer" "分析中标金额分布"
```

---

## 多步骤工作流设计

### 工作流配置（YAML）

```yaml
# workflow.yaml
workflow:
  name: "全国中标数据采集分析"
  version: "1.0"

steps:
  - name: "采集省级数据"
    agent: "collector"
    action: "collect_province"
    targets:
      - "山东省"
      - "江苏省"
      - "浙江省"
      - "广东省"
    output: "province_results.json"

  - name: "采集地市数据"
    agent: "collector"
    action: "collect_city"
    targets:
      - "济南"
      - "青岛"
      - "杭州"
    depends_on: ["采集省级数据"]
    output: "city_results.json"

  - name: "补全企业信息"
    agent: "enricher"
    action: "enrich_company"
    depends_on: ["采集地市数据"]
    output: "enriched_companies.json"

  - name: "数据分析"
    agent: "analyzer"
    action: "analyze"
    depends_on: ["补全企业信息"]
    output: "analysis_report.md"
```

### 工作流执行器

```bash
#!/bin/bash
# workflow_executor.sh

YAML_FILE=${1:-workflow.yaml}

# 解析 YAML 并执行步骤
while IFS= read -r step; do
    name=$(echo "$step" | yq '.name')
    agent=$(echo "$step" | yq '.agent')
    action=$(echo "$step" | yq '.action')
    prompt=$(echo "$step" | yq '.prompt')
    
    echo "执行步骤: $name"
    claude -p "$prompt" --dangerously-skip-permissions --continue
    
    # 检查依赖是否满足
    depends_on=$(echo "$step" | yq '.depends_on[]')
    for dep in $depends_on; do
        if [ ! -f ".completed/$dep" ]; then
            echo "等待依赖: $dep"
            sleep 5
        fi
    done
    
    touch ".completed/$name"
    
done < <(yq '.workflow.steps[]' "$YAML_FILE")
```

---

## 定时任务方案

### 方案概述

```
┌─────────────────────────────────────────────────────────────┐
│                    Cron 调度器                                │
│  0 2 * * * /path/to/workflow.sh collect-all                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  状态持久化层                                 │
│  .last_run          - 上次运行时间                          │
│  .session_id         - 当前会话 ID                          │
│  .progress/<step>   - 各步骤完成状态                        │
│  .lock              - 运行锁（防止重复运行）                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  工作流执行层                                │
│  workflow.sh (主入口)                                        │
│  ├── check_lock()    - 检查是否运行中                       │
│  ├── save_state()   - 保存运行状态                         │
│  ├── run_step()     - 执行单个步骤                         │
│  ├── handle_error() - 错误处理和重试                       │
│  └── cleanup()      - 清理资源                             │
└─────────────────────────────────────────────────────────────┘
```

### 定时任务脚本

```bash
#!/bin/bash
# cron_workflow.sh - 定时任务入口

set -e

WORKFLOW_DIR="/Users/c/bidding-companies/workflow"
STATE_DIR="$WORKFLOW_DIR/.state"
LOCK_FILE="$STATE_DIR/.lock"
LAST_RUN_FILE="$STATE_DIR/.last_run"
SESSION_FILE="$STATE_DIR/.session_id"
PROGRESS_DIR="$STATE_DIR/progress"
LOG_DIR="$WORKFLOW_DIR/logs"

# 创建必要目录
mkdir -p "$STATE_DIR" "$PROGRESS_DIR" "$LOG_DIR"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/cron_$(date '+%Y%m%d').log"
}

# 检查是否已运行
check_lock() {
    if [ -f "$LOCK_FILE" ]; then
        LOCK_PID=$(cat "$LOCK_FILE")
        if kill -0 "$LOCK_PID" 2>/dev/null; then
            log "检测到上一个任务仍在运行 (PID: $LOCK_PID)，退出"
            exit 0
        else
            log "发现陈旧锁文件，清理..."
            rm -f "$LOCK_FILE"
        fi
    fi
}

# 获取上次会话 ID（用于增量继续）
get_last_session() {
    if [ -f "$SESSION_FILE" ]; then
        cat "$SESSION_FILE"
    fi
}

# 保存会话 ID
save_session() {
    # 从 Claude 输出中提取 session_id
    # 格式: {"type":"system","subtype":"init","session_id":"xxx",...}
    local output="$1"
    echo "$output" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4 > "$SESSION_FILE"
}

# 保存进度
save_progress() {
    local step="$1"
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$PROGRESS_DIR/$step"
}

# 检查进度
check_progress() {
    local step="$1"
    [ -f "$PROGRESS_DIR/$step" ]
}

# 清除进度（用于重新运行）
clear_progress() {
    rm -rf "$PROGRESS_DIR"/*
}

# 错误处理
handle_error() {
    local step="$1"
    local error_msg="$2"
    log "步骤 $step 执行失败: $error_msg"
    
    # 记录失败状态
    echo "FAILED: $error_msg" > "$PROGRESS_DIR/$step.error"
    
    # 发送告警（可选）
    # curl -X POST "https://notify.example.com" -d "text=Workflow failed: $step"
}

# 重试逻辑
retry_step() {
    local step="$1"
    local max_attempts="${2:-3}"
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "尝试执行 $step (第 $attempt/$max_attempts 次)"
        
        if run_step "$step"; then
            log "$step 执行成功"
            return 0
        else
            log "$step 执行失败"
            attempt=$((attempt + 1))
            [ $attempt -le $max_attempts ] && sleep 30
        fi
    done
    
    handle_error "$step" "超过最大重试次数"
    return 1
}

# 执行单个步骤
run_step() {
    local step="$1"
    local prompt_file="$WORKFLOW_DIR/prompts/${step}.md"
    
    if [ ! -f "$prompt_file" ]; then
        log "找不到 prompt 文件: $prompt_file"
        return 1
    fi
    
    local session_opt=""
    local last_session=$(get_last_session)
    [ -n "$last_session" ] && session_opt="--resume $last_session"
    
    # 执行并捕获输出
    local output
    output=$(claude -p "$(cat "$prompt_file")" \
        --dangerously-skip-permissions \
        --bare \
        $session_opt \
        2>&1) || return 1
    
    # 保存会话 ID
    save_session "$output"
    
    return 0
}

# 主要工作流
run_workflow() {
    local action="${1:-collect-all}"
    
    log "开始执行工作流: $action"
    echo $$ > "$LOCK_FILE"  # 写入当前 PID
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LAST_RUN_FILE"
    
    # 清理旧进度（如果需要重新运行）
    # clear_progress
    
    case "$action" in
        collect-all)
            for province in 山东省 江苏省 浙江省 广东省 四川省; do
                step="collect_$province"
                retry_step "$step" 3 || continue
                save_progress "$step"
            done
            ;;
        enrich)
            retry_step "enrich" 3
            ;;
        analyze)
            retry_step "analyze" 3
            ;;
        full)
            # 完整流水线
            retry_step "collect" 3 || { log "采集失败，跳过后续步骤"; return 1; }
            save_progress "collect"
            retry_step "enrich" 3 || { log "补全失败，继续分析"; }
            save_progress "enrich"
            retry_step "analyze" 3
            save_progress "analyze"
            ;;
        *)
            log "未知动作: $action"
            ;;
    esac
    
    # 清理锁
    rm -f "$LOCK_FILE"
    log "工作流执行完成"
}

# 入口
check_lock
run_workflow "$@"
```

### Crontab 配置

```bash
# 每天凌晨 2 点执行全量采集
0 2 * * * /Users/c/bidding-companies/workflow/cron_workflow.sh full >> /Users/c/bidding-companies/workflow/logs/cron.log 2>&1

# 每小时执行增量采集
0 * * * * /Users/c/bidding-companies/workflow/cron_workflow.sh collect-all >> /Users/c/bidding-companies/workflow/logs/cron.log 2>&1

# 每天下午 6 点执行补全和分析
0 18 * * * /Users/c/bidding-companies/workflow/cron_workflow.sh enrich && /Users/c/bidding-companies/workflow/cron_workflow.sh analyze >> /Users/c/bidding-companies/workflow/logs/cron.log 2>&1
```

### 状态持久化文件结构

```
workflow/.state/
├── .lock              # 运行锁 (PID)
├── .session_id        # 当前会话 ID
├── .last_run          # 上次运行时间 (ISO 8601)
└── progress/
    ├── collect_山东省   # 采集进度时间戳
    ├── collect_江苏省
    ├── enrich
    ├── enrich.error    # 失败信息
    └── analyze
```

### 错误恢复机制

```bash
# 检查失败步骤并重试
check_and_retry() {
    local state_dir="/Users/c/bidding-companies/workflow/.state/progress"
    
    for step_file in "$state_dir"/*.error; do
        [ -e "$step_file" ] || continue
        step=$(basename "$step_file" .error)
        error_msg=$(cat "$step_file")
        
        log "检测到失败步骤: $step - $error_msg"
        
        # 清除错误文件并重试
        rm "$step_file"
        retry_step "$step" 2
    done
}
```

---

## 核心 Claude CLI 命令参考

| 场景 | 命令 |
|------|------|
| 单次 Prompt | `claude -p "任务描述" --dangerously-skip-permissions` |
| 持久会话 | `claude --input-format stream-json --output-format stream-json --verbose` |
| 恢复会话 | `claude -p "继续" --resume <session_id>` |
| 继续最近会话 | `claude -p "任务" --continue` |
| 系统提示词 | `claude -p "任务" --system-prompt "你是采集专家"` |
| 追加系统提示 | `claude -p "任务" --append-system-prompt "额外上下文"` |
| 指定工具 | `claude -p "任务" --tools mcp__playwright__navigate,mcp__neo4j__cypher` |
| 允许工具 | `claude -p "任务" --allowedTools Read,Write` |
| 禁止工具 | `claude -p "任务" --disallowedTools Bash` |
| 裸模式 | `claude -p "任务" --bare` |
| 添加目录 | `claude -p "任务" --add-dir ../shared` |
| 模型选择 | `claude -p "任务" --model opus` |
| 超时控制 | `claude -p "任务" --dangerously-skip-permissions` (内部超时处理) |

---

## MCP 工具使用示例

### Playwright MCP

```bash
claude -p "
使用 Playwright MCP 完成：
1. 访问 https://ggzyjy.shandong.gov.cn
2. 点击'中标公告'栏目
3. 提取表格中的前 10 条记录
4. 返回 JSON 格式数据
" --dangerously-skip-permissions
```

### Neo4j MCP

```bash
claude -p "
使用 Neo4j MCP 执行：
1. 创建 Company 节点：山东路桥集团
2. 创建 Project 节点：济南地铁项目  
3. 创建 WIN_BID 关系（金额：5000万）
4. 查询验证
" --dangerously-skip-permissions
```

### ENScan_GO MCP

```bash
claude -p "
使用 ENScan_GO MCP 补全以下公司信息：
- 山东路桥集团
- 济南城建集团

返回：电话、邮箱、地址、法定代表人
" --dangerously-skip-permissions
```

---

## 文件结构（重构后）

```
bidding-companies/
├── .claude/              # Claude Code 配置
│   ├── settings.json
│   └── mcp.json          # MCP 服务器配置
├── workflow/             # 工作流编排
│   ├── README.md
│   ├── workflow.sh       # 主入口
│   ├── collect.sh        # 采集工作流
│   ├── enrich.sh         # 补全工作流
│   ├── analyze.sh        # 分析工作流
│   ├── cron_workflow.sh  # 定时任务入口
│   ├── workflow.yaml     # 工作流配置
│   └── .state/           # 状态持久化
│       ├── .lock
│       ├── .session_id
│       └── progress/
├── scripts/              # 工具脚本
│   ├── init_db.sh        # 初始化 Neo4j
│   ├── check_status.sh   # 检查系统状态
│   └── export_data.sh    # 导出数据
├── prompts/              # Prompt 模板
│   ├── collect.md
│   ├── enrich.md
│   └── analyze.md
├── docs/
│   ├── ROOT_CAUSE.md     # 本文档
│   └── ARCHITECTURE.md   # 详细架构文档
└── run.sh                # 运行入口
```

---

## 下一步行动

### Phase 1：清理 Python 文件
1. 删除 `src/` 下所有 `.py` 文件
2. 删除 `__pycache__` 目录
3. 删除 `.env.example`（迁移到环境变量）

### Phase 2：创建 Shell 工作流
1. 创建 `workflow/collect.sh`
2. 创建 `workflow/enrich.sh`
3. 创建 `workflow/analyze.sh`
4. 创建 `workflow.yaml` 配置
5. 创建 `workflow/cron_workflow.sh` 定时任务脚本

### Phase 3：配置 MCP 服务器
1. 配置 Playwright MCP
2. 配置 Neo4j MCP
3. 配置 ENScan_GO MCP

### Phase 4：状态持久化实现
1. 创建 `workflow/.state/` 目录结构
2. 实现 `check_lock()` 防止重复运行
3. 实现 `save_session()` 和 `get_last_session()`
4. 实现进度跟踪机制

### Phase 5：定时任务配置
1. 配置 crontab 定时任务
2. 配置日志轮转
3. 配置告警机制（可选）

### Phase 6：测试验证
1. 单省份采集测试
2. 多省份并行采集测试
3. 企业信息补全测试
4. 全流程集成测试
5. 定时任务触发测试

---

## 精确搜索目标

### claude-node 源码分析结果

| 目标 | 位置 |
|------|------|
| MultiAgentRouter A2A 路由 | `/Users/c/claw-army/claude-node/claude_node/router.py` |
| AgentNode 配置 | `/Users/c/claw-army/claude-node/claude_node/router.py:12-58` |
| ClaudeController fork() | `/Users/c/claw-army/claude-node/claude_node/controller.py:476-493` |
| stream-json 协议 | `/Users/c/claw-army/claude-node/docs/04-protocol.md` |
| 架构设计 | `/Users/c/claw-army/claude-node/docs/02-architecture.md` |

### 待验证项

- cron 定时任务与 Claude CLI 的兼容性
- 长时间运行会话的稳定性
- 多进程并发访问 Neo4j 的安全性

