# 全国工程中标数据采集系统 - 架构设计文档

> 创建日期：2026-03-24
> 最后更新：2026-03-24

---

## 一、项目目标

### 核心目标
采集全国省-市-区县**政府采购/公共资源交易平台**的中标数据，建立企业联系方式数据库。

### 关键诉求
1. **全层级覆盖**：省 → 市 → 区县，层层遍历，无遗漏
2. **定时任务**：每日自动执行，一键启动
3. **MCP 集成**：Playwright（爬取）+ Neo4j（存储）+ ENScan_GO（补全）
4. **状态持久化**：断点续传，失败重试

---

## 二、技术架构

### 2.1 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude CLI (核心运行时)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Collector  │  │  Enricher   │  │  Analyzer   │       │
│  │  Agent      │  │  Agent      │  │  Agent      │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Playwright │       │   Neo4j    │       │ ENScan_GO  │
│    MCP      │       │    MCP     │       │    MCP     │
│  浏览器爬取  │       │  图数据库   │       │ 企业信息补全 │
└─────────────┘       └─────────────┘       └─────────────┘
```

### 2.2 数据模型（四层嵌套）

```cypher
// 节点类型
Province { name, url }
City { name, province, url }
District { name, city, province, url }
Project { name, amount, date, url, category, province, city, district, collected_at }
Company { name, phone, email, address, website, enriched }
Buyer { name, contact, phone }

// 关系
(Province)-[:HAS_CITY]->(City)
(City)-[:HAS_DISTRICT]->(District)
(District)-[:HAS_PROJECT]->(Project)
(Company)-[:WIN_BID]->(Project)  // 中标关系（带金额、日期）
(Project)-[:BY]->(Buyer)          // 采购单位关系
```

### 2.3 平台层级结构

| 平台类型 | 数量 | 独立域名比例 | 采集方式 |
|---------|------|-------------|---------|
| 省级 | 31个 | ~95% | 直接访问 |
| 市级 | 333个 | ~30% | 省级导航发现 |
| 区县级 | ~2800个 | ~10% | 市级导航发现 |

**关键发现**：大多数省市县**共用一个省级平台**，通过导航菜单区分层级。

示例：
- 山东省：`ggzyjy.shandong.gov.cn` 统一入口
- 江苏省：`jsggzy.jszwfw.gov.cn` 统一入口

---

## 三、工作流设计

### 3.1 Python + claude-node 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Python 工作流引擎                          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  BidWorkflow                                         │  │
│  │  ├── _load_state()        # 加载状态                 │  │
│  │  ├── _save_state()        # 保存状态                 │  │
│  │  ├── run_step()           # 执行单个步骤             │  │
│  │  ├── run_province_cities() # Python大循环            │  │
│  │  └── resume()              # 断点续传                │  │
│  └─────────────────────────────────────────────────────┘  │
│                              │                             │
│                              ▼                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  claude-node (ClaudeController)                       │  │
│  │  ├── 保持会话状态                                     │  │
│  │  ├── MiniMax API key 继承                             │  │
│  │  └── 600秒超时控制                                    │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 命令行接口

```bash
# 基础命令
./run_workflow.sh setup                    # 初始化系统
./run_workflow.sh collect 山东省          # 采集省份数据
./run_workflow.sh collect-city 山东省 济南市  # 采集城市
./run_workflow.sh collect-district 山东省 济南市 历下区  # 采集区县
./run_workflow.sh cities 山东省          # Python循环采集所有城市
./run_workflow.sh districts 山东省 济南市  # Python循环采集所有区县
./run_workflow.sh enrich                 # 企业信息补全
./run_workflow.sh analyze                # 数据分析
./run_workflow.sh full                   # 完整工作流
./run_workflow.sh resume                 # 断点续传
./run_workflow.sh status                 # 查看状态
```

### 3.3 定时任务

```bash
# crontab -e
# 每天凌晨2点执行
0 2 * * * cd /Users/c/bidding-companies && ./run_workflow.sh cities 山东省 >> logs/cron.log 2>&1
```

---

## 四、企业信息 Enrichment 策略

### 4.1 三层 Enrichment 架构

| 层级 | 方法 | 成功率 | 成本 |
|------|------|--------|------|
| 第一层 | 政府公示公告 | ~10% | 免费 |
| 第二层 | 百度/Google 搜索 | ~30-50% | 免费 |
| 第三层 | ENScan_GO（爱企查+天眼查） | ~90% | Cookie认证 |

### 4.2 ENScan_GO 集成

**项目地址**：https://github.com/wgpsec/ENScan_GO

| 特性 | 说明 |
|-----|------|
| 数据源 | 爱企查(aqc)、天眼查(tyc)、快查(kc) |
| 支持字段 | 电话、邮箱、地址、法人、联系人、ICP备案、APP、公众号 |
| MCP 支持 | ✅ `http://localhost:8080` |
| 认证方式 | 爱企查 Cookie（免费账号） |

**接入步骤**：
```bash
# 1. 下载 ENScan_GO
wget https://github.com/wgpsec/ENScan_GO/releases/latest/enscan-*-darwin-amd64.zip
unzip enscan-*-darwin-amd64.zip

# 2. 初始化配置
./enscan -v

# 3. 配置爱企查 Cookie
# 打开 https://aiqicha.baidu.com/ 登录，复制 Cookie 到 ~/.enscan/config.yaml

# 4. 启动 MCP Server
./enscan -mcp

# 5. Claude Code 配置
claude mcp add enscan http://localhost:8080
```

### 4.3 降级策略

```
ENScan_GO (MCP)
    ↓ 失败
百度搜索 (Playwright)
    ↓ 失败
记录为待补全（后续人工处理）
```

---

## 五、Prompt 模板

### 5.1 目录结构

```
prompts/
├── setup.md           # Neo4j Schema 初始化
├── collect.md         # 省级采集
├── collect_city.md     # 市级采集
├── collect_district.md # 区县级采集
├── enrich.md          # 企业信息补全
└── analyze.md        # 数据分析
```

### 5.2 模板变量

| 变量 | 示例 | 说明 |
|-----|------|------|
| `{PROVINCE}` | 山东省 | 省份名称 |
| `{CITY}` | 济南市 | 城市名称 |
| `{DISTRICT}` | 历下区 | 区县名称 |

### 5.3 Neo4j 存储规范

**必须使用 MERGE 避免重复**：
```cypher
MERGE (p:Province {name: '{PROVINCE}'})
MERGE (p)-[:HAS_CITY]->(c:City {name: '{CITY}'})
MERGE (c)-[:HAS_DISTRICT]->(d:District {name: '{DISTRICT}'})
MERGE (d)-[:HAS_PROJECT]->(pr:Project {name: '项目名'})
MERGE (co:Company {name: '公司名'})
MERGE (co)-[:WIN_BID {amount: 金额}]->(pr)
```

---

## 六、验证结果

### 6.1 工作流验证（2026-03-24）

| 测试项 | 结果 | 说明 |
|-------|------|------|
| MiniMax API Key 加载 | ✅ | run_workflow.sh 自动加载 |
| Python 大循环 | ✅ | 16/16 城市全部成功 |
| 会话状态保持 | ✅ | session_id 持久化 |
| 失败继续执行 | ✅ | 0 失败 |
| 断点续传 | ✅ | status 命令正常 |

### 6.2 数据质量

| 指标 | 数值 | 问题 |
|-----|------|------|
| 总项目数 | 66 | - |
| 有金额 | 8 (12%) | 需优化 Prompt |
| 有日期 | 13 (20%) | 需优化 Prompt |
| 城市重复 | 有 | 已修复 MERGE |

**修复措施**：Prompt 已改用 MERGE，避免重复创建节点。

---

## 七、共识与方向

### 7.1 已确认共识

1. **技术栈**：Claude CLI + claude-node + MCP (Playwright + Neo4j + ENScan_GO)
2. **数据模型**：省-市-区县-项目 四层嵌套
3. **Enrichment**：ENScan_GO（爱企查）为主，百度搜索为辅
4. **执行方式**：Python 大循环 + claude-node 逐个执行
5. **定时任务**：每日凌晨 2:00 自动执行

### 7.2 待办事项

| 优先级 | 任务 | 状态 |
|-------|------|------|
| P0 | 配置 ENScan_GO 爱企查 Cookie | 待办 |
| P0 | 验证 ENScan_GO MCP 接入 | 待办 |
| P1 | 优化 Prompt 提高金额/日期采集率 | 待办 |
| P1 | 清理现有重复数据 | 待办 |
| P2 | 扩展其他省份 | 规划中 |
| P2 | 区县级循环采集 | 待验证 |

### 7.3 扩展计划

**第一阶段（当前）**：山东省 17 地市
**第二阶段**：江苏省、浙江省、广东省
**第三阶段**：全国 31 省份

---

## 八、文件结构

```
bidding-companies/
├── src/
│   └── claude_workflow.py    # Python 工作流引擎
├── prompts/
│   ├── setup.md               # Schema 初始化
│   ├── collect.md             # 省级采集
│   ├── collect_city.md        # 市级采集
│   └── collect_district.md    # 区县级采集
├── workflow/
│   ├── setup.sh              # 系统初始化
│   ├── collect.sh            # 采集脚本
│   ├── enrich.sh              # 补全脚本
│   └── analyze.sh            # 分析脚本
├── logs/                      # 日志目录
├── docs/
│   ├── ARCHITECTURE.md        # 本文档
│   └── ROOT_CAUSE.md          # 根因分析
├── run_workflow.sh            # 启动脚本（加载 MiniMax Key）
└── README.md
```

---

## 九、参考项目

| 项目 | 用途 | 参考点 |
|-----|------|--------|
| wgpsec/ENScan_GO | 企业信息采集 | MCP 集成、数据源 |
| claw-army/claude-node | Claude CLI 控制 | Python 集成 |
| Playwright MCP | 浏览器自动化 | 网页爬取 |
| Neo4j MCP | 图数据库 | 数据存储 |
