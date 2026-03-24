#!/bin/bash
#==============================================================================
# 企业信息补全工作流
# 通过搜索补全公司联系方式
#==============================================================================

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/enrich_${TIMESTAMP}.log"

echo "=========================================="
echo "企业信息补全"
echo "=========================================="

# 从 Neo4j 获取未补全的公司列表
echo "获取待补全公司列表..."

COMPANIES=$(cypher-shell -u neo4j -p password "
MATCH (c:Company)
WHERE c.enriched IS NULL OR c.enriched = false
RETURN c.name as name
LIMIT 20
" 2>/dev/null | tail -n +3 | head -10 | tr '\n' ' ')

if [ -z "$COMPANIES" ]; then
    echo "没有需要补全的公司，或获取公司列表失败"
    COMPANIES="示例公司1 示例公司2"
fi

echo "待补全公司: $COMPANIES"

# 执行补全 Prompt
claude -p "
## 任务
补全以下公司的联系方式：

$COMPANIES

## 步骤
1. 使用百度搜索每家公司的联系方式
2. 提取：电话、邮箱、地址、官网
3. 使用 Neo4j MCP 更新 Company 节点：
\`\`\`cypher
MATCH (c:Company {name: '公司名'})
SET c.phone = '电话',
    c.email = '邮箱',
    c.address = '地址',
    c.website = '官网',
    c.enriched = true,
    c.enriched_at = datetime()
\`\`\`

## 返回
每家公司的补全结果
" --dangerously-skip-permissions --bare 2>&1 | tee "$LOG_FILE"

echo ""
echo "补全完成，日志保存到: $LOG_FILE"
