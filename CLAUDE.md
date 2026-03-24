# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**名称**：全国工程中标数据采集系统
**目录**：`/Users/c/bidding-companies`

## 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Python 工作流引擎                           │
│  BidWorkflow: Python 大循环控制 → claude-node 逐个执行        │
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

## 数据模型（四层嵌套）

```
Province → City → District → Project → Company
```

| 节点 | 说明 |
|------|------|
| Province | 省份 |
| City | 城市 |
| District | 区县 |
| Project | 中标项目（带金额、日期、省-市-区县） |
| Company | 中标公司（电话、邮箱、地址待补全） |

**注意**：使用 `MERGE` 避免重复创建节点

## 工作流命令

```bash
# 启动工作流（自动加载 MiniMax API Key）
./run_workflow.sh <command>

# 命令列表
setup                    # 初始化 Neo4j Schema
collect <省>            # 采集省级数据
collect-city <省> <市>  # 采集城市
cities <省>             # Python 循环采集所有城市（17个地市）
districts <省> <市>     # Python 循环采集所有区县
enrich                   # 企业信息补全（ENScan_GO）
analyze                  # 数据分析
full                     # 完整工作流
resume                   # 断点续传
status                   # 查看状态
```

## MCP 配置

```bash
# Playwright - 浏览器自动化
claude mcp add playwright npx "@playwright/mcp@latest"

# Neo4j - 图数据库
claude mcp add neo4j /opt/anaconda3/bin/mcp-neo4j-cypher

# ENScan_GO - 企业信息补全（需要先配置爱企查 Cookie）
./enscan -mcp  # 启动 MCP 服务器
claude mcp add enscan http://localhost:8080
```

## Neo4j 连接

```bash
cypher-shell -u neo4j -p password

# 常用查询
MATCH (p:Project) RETURN p.name, p.amount, p.city LIMIT 20
MATCH (p:Province)-[:HAS_CITY]->(c:City) RETURN p.name, collect(c.name)
```

## 定时任务

```bash
# crontab -e - 每天凌晨 2:00 执行
0 2 * * * cd /Users/c/bidding-companies && ./run_workflow.sh cities 山东省 >> logs/cron.log 2>&1
```

## 环境变量

MiniMax API Key 由 `run_workflow.sh` 自动从 `~/.claude/api-profiles/minimax.json` 加载

## 目录结构

```
/Users/c/bidding-companies/
├── src/claude_workflow.py    # Python 工作流引擎（claude-node 封装）
├── prompts/                   # Prompt 模板（支持 {PROVINCE}、{CITY} 变量替换）
├── workflow/                 # Shell 脚本
├── logs/                     # 日志
└── docs/                     # 架构文档
```
