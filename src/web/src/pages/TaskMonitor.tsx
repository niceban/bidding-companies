import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getTasks, createTaskWS, Task } from '../api'

const STATUS_CONFIG = {
  pending: {
    label: '排队中',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: '⏳',
    progress: 0,
  },
  running: {
    label: '采集中',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: '🔄',
    progress: null, // dynamic
  },
  done: {
    label: '已完成',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: '✅',
    progress: 100,
  },
  failed: {
    label: '失败',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: '❌',
    progress: 0,
  },
  cancelled: {
    label: '已取消',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: '🚫',
    progress: 0,
  },
} as const

function TaskCard({ task }: { task: Task }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const highlight = searchParams.get('highlight')
  const isHighlighted = highlight === task.id
  const config = STATUS_CONFIG[task.status]

  // WebSocket 实时进度
  useEffect(() => {
    if (task.status !== 'running') return
    const ws = createTaskWS(task.id)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.progress !== task.progress) {
          // 需要重新获取最新数据
        }
      } catch {}
    }
    return () => ws.close()
  }, [task.id, task.status])

  const progress = task.progress * 100

  return (
    <div
      className={`bg-white rounded-2xl border p-5 transition-all ${
        isHighlighted ? 'ring-2 ring-blue-500 shadow-lg' : 'border-gray-100 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">
            {task.province} · {task.city}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(task.created_at).toLocaleString('zh-CN')}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
          <span>{config.icon}</span>
          <span>{config.label}</span>
        </span>
      </div>

      {/* 进度条 */}
      {(task.status === 'running' || task.status === 'done') && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>采集进度</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                task.status === 'done' ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 消息 */}
      {task.message && (
        <p className="text-sm text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
          {task.message}
        </p>
      )}

      {/* 操作 */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <span className="text-xs text-gray-400">
          任务ID: {task.id}
        </span>
        <div className="flex gap-2">
          {task.status === 'done' && (
            <button
              onClick={() => navigate(`/data?province=${encodeURIComponent(task.province)}&city=${encodeURIComponent(task.city)}`)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              查看数据 →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TaskMonitor() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
    refetchInterval: 3000,
  })

  const stats = data?.tasks ? {
    total: data.tasks.length,
    running: data.tasks.filter(t => t.status === 'running').length,
    done: data.tasks.filter(t => t.status === 'done').length,
    pending: data.tasks.filter(t => t.status === 'pending').length,
    failed: data.tasks.filter(t => t.status === 'failed').length,
  } : null

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">任务监控</h1>
          <p className="text-gray-500 mt-1">实时监控采集中标数据的任务进度</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <span className={isFetching ? 'animate-spin' : ''}>🔄</span>
          刷新
        </button>
      </div>

      {/* 统计卡片 */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: '总数', value: stats.total, color: 'gray' },
            { label: '采集中', value: stats.running, color: 'blue' },
            { label: '已完成', value: stats.done, color: 'emerald' },
            { label: '排队中', value: stats.pending, color: 'amber' },
            { label: '失败', value: stats.failed, color: 'red' },
          ].map(s => (
            <div key={s.label} className={`bg-${s.color}-50 rounded-xl p-4 border border-${s.color}-100`}>
              <div className={`text-2xl font-bold text-${s.color}-700`}>{s.value}</div>
              <div className={`text-xs text-${s.color}-500 font-medium`}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 任务列表 */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">
          <span className="text-4xl">⏳</span>
          <p className="mt-3">加载中...</p>
        </div>
      ) : !data?.tasks.length ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <span className="text-5xl">📭</span>
          <p className="mt-4 text-lg font-medium text-gray-500">暂无任务</p>
          <p className="text-sm text-gray-400 mt-1">去「任务创建」页面开始采集数据</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {data?.tasks.map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      )}
    </div>
  )
}
