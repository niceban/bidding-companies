# 全国工程中标数据采集系统

基于 Claude CLI + MCP 的全自动化数据采集工作流。

## 核心架构

```
┌─────────────────────────────────────────────┐
│          Claude CLI (核心运行时)              │
└─────────────────┬─────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│Playwright│   │  Neo4j  │   │ ENScan  │
│   MCP   │   │   MCP   │   │   MCP   │
└─────────┘   └─────────┘   └─────────┘
```

## 快速开始

### 1. 初始化系统

```bash
./workflow/setup.sh
```

### 2. 采集中标数据

```bash
# 采集单个省份
./workflow/collect.sh 山东省

# 采集多个省份（编辑 collect.sh 修改列表）
./workflow/collect.sh
```

### 3. 补全企业信息

```bash
./workflow/enrich.sh
```

### 4. 数据分析

```bash
./workflow/analyze.sh
```

## 工作流目录

```
workflow/
├── setup.sh      # 系统初始化
├── workflow.sh   # 主入口菜单
├── collect.sh    # 采集工作流
├── enrich.sh     # 补全工作流
└── analyze.sh    # 分析工作流

prompts/
├── collect.md    # 采集 Prompt 模板
├── enrich.md    # 补全 Prompt 模板
└── analyze.md   # 分析 Prompt 模板
```

## MCP 服务器配置

```bash
# Playwright - 浏览器自动化
claude mcp add playwright npx "@playwright/mcp@latest"

# Neo4j - 图数据库
claude mcp add neo4j /opt/anaconda3/bin/mcp-neo4j-cypher
```

## 数据模型

| 节点 | 说明 |
|------|------|
| Province | 省份 |
| Company | 中标公司 |
| Project | 中标项目 |
| Buyer | 采购单位 |

| 关系 | 说明 |
|------|------|
| WIN_BID | 中标关系 |
| BY | 采购关系 |

## 技术栈

- **核心运行时**: Claude CLI
- **浏览器自动化**: Playwright MCP
- **图数据库**: Neo4j MCP
- **企业信息补全**: 搜索 + ENScan MCP
