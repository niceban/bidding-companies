#!/bin/bash
#==============================================================================
# 全国工程中标数据采集 - 主工作流入口
# 核心：Claude CLI + MCP Servers
#==============================================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 目录配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/../prompts"
WORKFLOW_DIR="$SCRIPT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="$SCRIPT_DIR/logs"
SESSION_FILE="$SCRIPT_DIR/.claude_session"

# 创建日志目录
mkdir -p "$LOG_DIR"

#------------------------------------------------------------------------------
# 工具函数
#------------------------------------------------------------------------------

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 MCP 服务器
check_mcp() {
    log_info "检查 MCP 服务器..."
    claude mcp list | grep -E "(playwright|neo4j)" || log_warn "部分 MCP 服务器未连接"
}

# 检查 Neo4j
check_neo4j() {
    log_info "检查 Neo4j..."
    if ! brew services list | grep -q "neo4j.*started"; then
        log_warn "Neo4j 未运行，正在启动..."
        brew services start neo4j
        sleep 3
    else
        log_info "Neo4j 已运行"
    fi
}

# 执行采集
do_collect() {
    local province="$1"
    log_info "采集 $province 省数据..."

    claude -p "$(cat "$PROMPTS_DIR/collect.md")" \
        --dangerously-skip-permissions \
        --bare \
        2>&1 | tee -a "$LOG_DIR/collect_${province}_${TIMESTAMP}.log"
}

# 执行补全
do_enrich() {
    log_info "补全企业信息..."

    claude -p "$(cat "$PROMPTS_DIR/enrich.md")" \
        --dangerously-skip-permissions \
        --bare \
        2>&1 | tee -a "$LOG_DIR/enrich_${TIMESTAMP}.log"
}

# 执行分析
do_analyze() {
    log_info "执行数据分析..."

    claude -p "$(cat "$PROMPTS_DIR/analyze.md")" \
        --dangerously-skip-permissions \
        --bare \
        2>&1 | tee -a "$LOG_DIR/analyze_${TIMESTAMP}.log"
}

#------------------------------------------------------------------------------
# 主菜单
#------------------------------------------------------------------------------

show_menu() {
    echo ""
    echo "=============================================================================="
    echo "           全国工程中标数据采集系统 - Claude Workflow"
    echo "=============================================================================="
    echo ""
    echo "  1. 初始化系统     - 配置 MCP 服务器、初始化 Neo4j Schema"
    echo "  2. 采集省份数据   - 采集指定省份的中标公告"
    echo "  3. 采集全部省份   - 采集全国 32 个省份数据"
    echo "  4. 补全企业信息  - 通过搜索补全联系方式"
    echo "  5. 数据分析       - 分析中标数据"
    echo "  6. 查看状态       - 查看 Neo4j 数据库状态"
    echo "  7. 退出"
    echo ""
}

#------------------------------------------------------------------------------
# 主入口
#------------------------------------------------------------------------------

main() {
    # 解析参数
    ACTION=${1:-menu}

    case $ACTION in
        1|init)
            check_mcp
            check_neo4j
            log_info "系统初始化完成"
            ;;
        2|collect)
            check_mcp
            check_neo4j
            read -p "请输入省份名称（如：山东省）：" PROVINCE
            do_collect "$PROVINCE"
            ;;
        3|collect-all)
            check_mcp
            check_neo4j
            log_info "开始全量采集..."
            for p in 山东省 江苏省 浙江省 广东省 四川省; do
                do_collect "$p"
                sleep 3
            done
            ;;
        4|enrich)
            check_mcp
            do_enrich
            ;;
        5|analyze)
            check_mcp
            do_analyze
            ;;
        6|status)
            check_neo4j
            cypher-shell -u neo4j -p password "MATCH (n) RETURN labels(n)[0] as 类型, count(n) as 数量" 2>/dev/null
            ;;
        7|exit|quit)
            log_info "退出"
            exit 0
            ;;
        menu|*)
            show_menu
            read -p "请输入选项 [1-7]: " choice
            $0 $choice
            ;;
    esac
}

main "$@"
