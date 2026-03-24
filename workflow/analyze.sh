#!/bin/bash
#==============================================================================
# 数据分析工作流
# 从 Neo4j 查询并分析中标数据
#==============================================================================

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/analyze_${TIMESTAMP}.log"

echo "=========================================="
echo "中标数据分析"
echo "=========================================="

# 执行分析 Prompt
claude -p "
## 任务
从 Neo4j 查询中标数据，进行统计分析和洞察提炼。

## 查询

### 1. 基础统计
\`\`\`cypher
MATCH (c:Company)-[r:WIN_BID]->(p:Project)
RETURN count(*) as 总中标数,
       sum(r.amount) as 总金额,
       avg(r.amount) as 平均金额
\`\`\`

### 2. 中标金额TOP10
\`\`\`cypher
MATCH (c:Company)-[r:WIN_BID]->(p:Project)
RETURN c.name as 公司, p.name as 项目, r.amount as 金额
ORDER BY r.amount DESC
LIMIT 10
\`\`\`

### 3. 公司中标次数TOP10
\`\`\`cypher
MATCH (c:Company)-[r:WIN_BID]->(p:Project)
RETURN c.name as 公司, count(r) as 中标次数, sum(r.amount) as 总金额
ORDER BY 中标次数 DESC
LIMIT 10
\`\`\`

### 4. 补全率
\`\`\`cypher
MATCH (c:Company)
WITH count(c) as 总数
MATCH (c:Company)
WHERE c.phone IS NOT NULL
RETURN 总数, count(c) as 已补全,
       (toFloat(count(c)) / 总数 * 100) as 补全率
\`\`\`

## 返回
1. 数据概览（ASCII表格）
2. 关键发现
3. 建议
" --dangerously-skip-permissions --bare 2>&1 | tee "$LOG_FILE"

echo ""
echo "分析完成，日志保存到: $LOG_FILE"
