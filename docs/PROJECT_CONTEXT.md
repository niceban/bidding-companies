# 项目上下文记忆

> 本文件记录项目的关键决策和上下文，供后续会话参考

## 项目概述

**名称**：全国工程中标数据采集系统
**目标**：采集全国省-市-区县政府采购平台的中标数据，建立企业联系方式库
**核心场景**：为销售团队提供企业联系信息

## 关键决策（2026-03-24）

### 1. 技术栈决策
- **核心运行时**：Claude CLI + claude-node（Python 库）
- **数据采集**：Playwright MCP（浏览器自动化）
- **数据存储**：Neo4j MCP（图数据库）
- **企业补全**：ENScan_GO（爱企查 + 天眼查）

### 2. 数据模型
```
Province → City → District → Project → Company
```
- 四层嵌套结构
- 必须用 MERGE 避免重复

### 3. Enrichment 策略
1. 政府公示（~10% 公开率）
2. ENScan_GO 爱企查（~90%，需要 Cookie）
3. 百度搜索（降级方案）

### 4. 执行架构
- **Python 大循环**：控制 17 地市的遍历
- **claude-node**：逐个执行，保持会话
- **断点续传**：状态持久化到 .workflow/state.json

### 5. 定时任务
- 每天凌晨 2:00 执行
- 命令：`./run_workflow.sh cities 山东省`

## 技术细节

### MiniMax API Key 加载
```bash
# run_workflow.sh 自动从 ~/.claude/api-profiles/minimax.json 读取
export MINIMAX_API_KEY=$(cat ~/.claude/api-profiles/minimax.json | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])")
```

### ENScan_GO MCP 接入
```bash
./enscan -mcp  # 启动 MCP 服务器
claude mcp add enscan http://localhost:8080
```

## 待办事项
- [ ] 配置 ENScan_GO 爱企查 Cookie
- [ ] 验证 ENScan_GO MCP 接入
- [ ] 优化 Prompt 提高采集完整度
- [ ] 清理 Neo4j 重复数据
- [ ] 扩展到其他省份
