# 根因分析：架构一致性验证

## 问题
当前架构是否使用 claude-node (Python 库) 而非 Claude CLI？

## 结论（Cycle 1）

**架构正确** - 使用 claude_node Python 库

### 证据

| 文件:行号 | 内容 |
|-----------|------|
| `src/claude_workflow.py:16` | `from claude_node import ClaudeController` ✅ |
| `src/claude_workflow.py:119-121` | `resume=self.state.session_id or None` ✅ |
| `run_workflow.sh:27` | `python3 src/claude_workflow.py "$@"` ✅ |
| claude_node 内部 | `subprocess.run(["claude", "--input-format", "stream-json", ...])` ✅ |

### 调用链

```
run_workflow.sh
    ↓
python3 src/claude_workflow.py
    ↓
from claude_node import ClaudeController
    ↓
claude_node 内部调用 claude CLI (subprocess)
```

### 潜在风险

**版本不一致**：
- pip 安装位置：`/opt/anaconda3/lib/python3.12/site-packages`
- 本地克隆位置：`/Users/c/claw-army/claude-node/`

### 待研究问题

1. claude_node 版本兼容性
2. session_id 瞬时错误原因
3. 如何确保版本一致性
