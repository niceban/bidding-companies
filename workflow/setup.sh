#!/bin/bash
#==============================================================================
# 系统初始化
# - 配置 MCP 服务器
# - 初始化 Neo4j Schema
# - 创建省份节点
#==============================================================================

set -e

echo "=========================================="
echo "系统初始化"
echo "=========================================="

# 1. 检查 MCP 服务器
echo ""
echo "[1/4] 检查 MCP 服务器..."
claude mcp list

# 2. 启动 Neo4j（如未运行）
echo ""
echo "[2/4] 检查 Neo4j..."
if ! brew services list | grep -q "neo4j.*started"; then
    echo "启动 Neo4j..."
    brew services start neo4j
    sleep 3
else
    echo "Neo4j 已运行"
fi

# 3. 初始化 Schema
echo ""
echo "[3/4] 初始化 Neo4j Schema..."

claude -p "
## 任务
使用 Neo4j MCP 创建全国中标数据采集的图数据库 Schema。

## Schema 创建

### 1. 节点类型
- Province (省份): name, code, level, url
- Company (公司): name, phone, email, address, website, enriched
- Project (项目): name, amount, date, url, province, category
- Buyer (采购单位): name, contact, phone
- Contact (联系人): name, phone, title

### 2. 关系类型
- (Company)-[:WIN_BID]->(Project)  中标关系（带 amount, date 属性）
- (Project)-[:BY]->(Buyer)  采购单位关系
- (Province)-[:HAS_CITY]->(City)  省-市关系

### 3. 约束和索引
- Company.name 唯一约束
- Project.name 唯一约束
- Province.name 索引

## 省份数据
创建 32 个省份节点：
北京市、天津市、上海市、重庆市、河北省、山西省、辽宁省、吉林省、黑龙江省、江苏省、浙江省、安徽省、福建省、江西省、山东省、河南省、湖北省、湖南省、广东省、海南省、四川省、贵州省、云南省、陕西省、甘肃省、青海省、内蒙古、广西、宁夏、新疆、西藏

## 返回
Schema 创建结果
" --dangerously-skip-permissions --bare

# 4. 验证
echo ""
echo "[4/4] 验证初始化..."
cypher-shell -u neo4j -p password "MATCH (n) RETURN labels(n)[0] as 类型, count(n) as 数量" 2>/dev/null

echo ""
echo "=========================================="
echo "初始化完成！"
echo "=========================================="
echo ""
echo "使用方式："
echo "  ./workflow/collect.sh 山东省    # 采集省份数据"
echo "  ./workflow/enrich.sh           # 补全企业信息"
echo "  ./workflow/analyze.sh          # 数据分析"
