import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStats, getProjects, getCompanies, Project, Company } from '../api'

function StatsCards() {
  const { data } = useQuery({ queryKey: ['stats'], queryFn: getStats })
  if (!data) return null
  const cards = [
    { label: '总项目数', value: data.total_projects, color: 'bg-blue-50 border-blue-200' },
    { label: '企业总数', value: data.total_companies, color: 'bg-green-50 border-green-200' },
    { label: '已补全', value: data.enriched_companies, color: 'bg-purple-50 border-purple-200' },
    { label: '省份数', value: data.provinces, color: 'bg-orange-50 border-orange-200' },
  ]
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <div key={c.label} className={`${c.color} border rounded-lg p-4`}>
          <div className="text-2xl font-bold">{c.value.toLocaleString()}</div>
          <div className="text-sm text-gray-600">{c.label}</div>
        </div>
      ))}
    </div>
  )
}

function ProjectTable({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return <div className="text-center py-8 text-gray-500">暂无数据</div>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50">
          <th className="text-left p-2">项目名称</th>
          <th className="text-right p-2">金额(元)</th>
          <th className="text-left p-2">中标单位</th>
          <th className="text-left p-2">日期</th>
          <th className="text-left p-2">地区</th>
        </tr>
      </thead>
      <tbody>
        {projects.map(p => (
          <tr key={p.id} className="border-t hover:bg-gray-50">
            <td className="p-2">{p.name}</td>
            <td className="p-2 text-right">{p.amount?.toLocaleString() ?? '-'}</td>
            <td className="p-2">{p.winner}</td>
            <td className="p-2">{p.date}</td>
            <td className="p-2">{p.province} {p.city} {p.district ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CompanyModal({ company, onClose }: { company: Company; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">{company.name}</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex"><dt className="w-20 text-gray-500">电话:</dt><dd>{company.phone ?? '-'}</dd></div>
          <div className="flex"><dt className="w-20 text-gray-500">手机:</dt><dd>{company.mobile ?? '-'}</dd></div>
          <div className="flex"><dt className="w-20 text-gray-500">邮箱:</dt><dd>{company.email ?? '-'}</dd></div>
          <div className="flex"><dt className="w-20 text-gray-500">地址:</dt><dd>{company.address ?? '-'}</dd></div>
          <div className="flex"><dt className="w-20 text-gray-500">状态:</dt><dd>{company.enriched ? '已补全' : '未补全'}</dd></div>
        </dl>
        <button onClick={onClose} className="mt-4 w-full bg-gray-100 py-2 rounded hover:bg-gray-200">关闭</button>
      </div>
    </div>
  )
}

export default function DataView() {
  const [searchParams] = useSearchParams()
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [activeTab, setActiveTab] = useState<'projects' | 'companies'>('projects')

  const province = searchParams.get('province') || ''
  const city = searchParams.get('city') || ''

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', province, city],
    queryFn: () => getProjects(province || undefined, city || undefined),
  })

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => getCompanies(),
  })

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">数据查看</h2>
      <StatsCards />

      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-6 py-3 font-medium ${activeTab === 'projects' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            项目列表
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`px-6 py-3 font-medium ${activeTab === 'companies' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            企业列表
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'projects' ? (
            <ProjectTable projects={projects} />
          ) : (
            <div className="space-y-2">
              {companies.map((c: Company) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedCompany(c)}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className={`text-xs px-2 py-1 rounded ${c.enriched ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.enriched ? '已补全' : '未补全'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedCompany && <CompanyModal company={selectedCompany} onClose={() => setSelectedCompany(null)} />}
    </div>
  )
}
