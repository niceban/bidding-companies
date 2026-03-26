const API_BASE = '/api';

export interface Task {
  id: string;
  province: string;
  city: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
  progress: number;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  amount: number | null;
  winner: string;
  date: string;
  province: string;
  city: string;
  district: string | null;
  buyer_name: string | null;
}

export interface Company {
  id: string;
  name: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  enriched: boolean;
}

export interface Stats {
  total_projects: number;
  total_companies: number;
  enriched_companies: number;
  provinces: number;
}

export async function createTask(province: string, city: string): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ province, city }),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

export async function getTasks(page = 1): Promise<{ tasks: Task[]; total: number }> {
  const res = await fetch(`${API_BASE}/tasks?page=${page}&page_size=20`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function getTask(id: string): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`);
  if (!res.ok) throw new Error('Failed to fetch task');
  return res.json();
}

export async function getProjects(province?: string, city?: string, page = 1) {
  const params = new URLSearchParams({ page: String(page) });
  if (province) params.set('province', province);
  if (city) params.set('city', city);
  const res = await fetch(`${API_BASE}/data/projects?${params}`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function getCompanies(enriched?: boolean, page = 1) {
  const params = new URLSearchParams({ page: String(page) });
  if (enriched !== undefined) params.set('enriched', String(enriched));
  const res = await fetch(`${API_BASE}/data/companies?${params}`);
  if (!res.ok) throw new Error('Failed to fetch companies');
  return res.json();
}

export async function getStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/data/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export function createTaskWS(taskId: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${protocol}//${window.location.host}/ws/tasks/${taskId}`);
}
