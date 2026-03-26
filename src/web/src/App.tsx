import { Routes, Route, Link, useLocation } from 'react-router-dom'
import TaskCreate from './pages/TaskCreate'
import TaskMonitor from './pages/TaskMonitor'
import DataView from './pages/DataView'

function NavBar() {
  const location = useLocation()
  const links = [
    { to: '/', label: '任务创建' },
    { to: '/tasks', label: '任务监控' },
    { to: '/data', label: '数据查看' },
  ]
  return (
    <nav className="bg-blue-600 text-white px-6 py-4 flex items-center gap-8">
      <h1 className="text-xl font-bold">中标采集系统</h1>
      <div className="flex gap-4">
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={`px-3 py-1 rounded transition-colors ${
              location.pathname === l.to ? 'bg-white text-blue-600' : 'hover:bg-blue-500'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="p-6">
        <Routes>
          <Route path="/" element={<TaskCreate />} />
          <Route path="/tasks" element={<TaskMonitor />} />
          <Route path="/data" element={<DataView />} />
        </Routes>
      </main>
    </div>
  )
}
