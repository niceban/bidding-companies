#!/bin/bash
# 启动 Web 管理系统
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "启动 FastAPI 后端..."
cd "$SCRIPT_DIR"
nohup python3 -c "
import uvicorn, sys
sys.path.insert(0, '.')
from src.api.main import app
uvicorn.run(app, host='0.0.0.0', port=8000)
" > logs/fastapi.log 2>&1 &

echo "等待后端启动..."
sleep 3

if ! curl -s http://localhost:8000/health > /dev/null; then
    echo "ERROR: FastAPI 后端启动失败"
    cat logs/fastapi.log
    exit 1
fi
echo "FastAPI 后端已启动 (http://localhost:8000)"

echo "启动 React 前端..."
cd "$SCRIPT_DIR/src/web"
nohup npm run dev > ../../logs/web.log 2>&1 &
echo "React 前端已启动 (http://localhost:3000)"

echo ""
echo "✓ 服务已启动"
echo "  - API 文档: http://localhost:8000/docs"
echo "  - Web 界面: http://localhost:3000"
echo ""
echo "停止服务: lsof -ti:8000 | xargs kill; lsof -ti:3000 | xargs kill"
