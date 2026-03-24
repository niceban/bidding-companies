#!/bin/bash
#==============================================================================
# 全国工程中标数据采集 - 一键启动
# 全流程：采集 → 补全 → 分析
# 使用 Claude CLI + MCP
#==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================="
echo "  全国工程中标数据采集系统"
echo "  一键启动 v1.0"
echo -e "==========================================${NC}"
echo ""

# 1. 加载 MiniMax API Key
echo -e "${YELLOW}[1/5] 加载 MiniMax API Key...${NC}"
source "$SCRIPT_DIR/run_workflow.sh"
echo ""

# 2. 检查 Neo4j
echo -e "${YELLOW}[2/5] 检查 Neo4j...${NC}"
if ! cypher-shell -u neo4j -p password "RETURN 1" 2>/dev/null; then
    echo -e "${RED}错误: Neo4j 未运行${NC}"
    echo "请运行: brew services start neo4j"
    exit 1
fi
echo -e "${GREEN}Neo4j 已运行${NC}"
echo ""

# 3. 采集山东省17地市
echo -e "${YELLOW}[3/5] 采集山东省17地市中标数据...${NC}"
"$SCRIPT_DIR/run_workflow.sh" cities 山东省
echo ""

# 4. 补全企业信息
echo -e "${YELLOW}[4/5] 补全企业信息...${NC}"
"$SCRIPT_DIR/run_workflow.sh" enrich
"$SCRIPT_DIR/run_workflow.sh" enrich-buyer
echo ""

# 5. 数据分析
echo -e "${YELLOW}[5/5] 数据分析...${NC}"
"$SCRIPT_DIR/run_workflow.sh" analyze
echo ""

echo -e "${GREEN}=========================================="
echo "  全流程执行完成！"
echo "==========================================${NC}"
echo ""
echo "查看数据:"
echo "  cypher-shell -u neo4j -p password \"MATCH (c:Company)-[:WIN_BID]->(p:Project)<-[:BY]-(b:Buyer) RETURN c.name, b.contact, b.phone LIMIT 20\""
