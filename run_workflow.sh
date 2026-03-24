#!/bin/bash
# 自动加载 MiniMax API key 并运行工作流

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 从 Claude Code 配置加载 MiniMax API key
load_minimax_key() {
    local profile_file="$HOME/.claude/api-profiles/minimax.json"
    if [ -f "$profile_file" ]; then
        export MINIMAX_API_KEY=$(cat "$profile_file" | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])")
        echo "已加载 MiniMax API key"
    else
        echo "警告: 未找到 MiniMax API 配置文件"
    fi
}

# 加载 key
load_minimax_key

# 创建日志目录
mkdir -p "$SCRIPT_DIR/logs"

# 运行工作流
cd "$SCRIPT_DIR"
python3 src/claude_workflow.py "$@"
