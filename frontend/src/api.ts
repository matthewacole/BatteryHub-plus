const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error) }
  return res.json()
}

async function post<T>(path: string, body?: FormData | object): Promise<T> {
  const isForm = body instanceof FormData
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: isForm ? {} : { 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error) }
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error) }
  return res.json()
}

import type { ScheduleEntry, BatteryCheck, ImportResult, Inventory, DailySummary } from './types'
import type { Room } from './types'

export const api = {
  schedules: {
    list: (building?: string, date?: string) =>
      get<ScheduleEntry[]>(`/schedules?${new URLSearchParams({ ...(building && { building }), ...(date && { date }) }).toString()}`),
    buildings: () => get<string[]>('/schedules/buildings'),
    dates: () => get<string[]>('/schedules/dates'),
    week: (opts: { building?: string; room?: string; date: string }) => {
      const q = new URLSearchParams({ date: opts.date })
      if (opts.building) q.set('building', opts.building)
      if (opts.room) q.set('room', opts.room)
      return get<ScheduleEntry[]>(`/schedules/week?${q}`)
    },
  },
  rooms: {
    list: (building?: string) => get<Room[]>(`/rooms${building ? `?building=${building}` : ''}`),
    classification: (roomId: string) => get<{ roomType: string; batteryReq: number }>(`/rooms/${roomId}/classification`),
    managed: {
      list: () => get<{ building: string; rooms: Room[] }[]>('/rooms/managed/list'),
      buildings: () => get<string[]>('/rooms/managed/buildings'),
      update: (updates: { roomId: string; managed?: boolean; roomType?: string }[]) => post<{ ok: boolean }>('/rooms/managed', { updates }),
    },
    buildings: () => get<string[]>('/rooms/buildings'),
  },

  imports: {
    upload: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return post<ImportResult>('/import', fd)
    },
    list: () => get<ImportType[]>('/import'),
    get: (id: number) => get<{ import: ImportType; entries: ScheduleEntry[] }>(`/import/${id}`),
    delete: (id: number) => del<{ ok: boolean }>(`/import/${id}`),
  },
  ai: {
    ask: (query: string, opts?: { importId?: number; date?: string; tab?: string; building?: string }) =>
      post<{ answer: string }>('/ai/ask', { query, ...opts }),
    config: () => get<{ apiUrl: string; model: string; apiKey: string }>('/ai/config'),
    updateConfig: (cfg: { apiUrl?: string; model?: string; apiKey?: string }) => post<{ apiUrl: string; model: string; apiKey: string }>('/ai/config', cfg),
    models: () => get<string[]>('/ai/models'),
  },
  battery: {
    checks: (params?: { building?: string; date?: string; completed?: number }) => {
      const q = new URLSearchParams()
      if (params?.building) q.set('building', params.building)
      if (params?.date) q.set('date', params.date)
      if (params?.completed !== undefined) q.set('completed', String(params.completed))
      return get<BatteryCheck[]>(`/battery/checks?${q}`)
    },
    completeCheck: (id: number) => post<{ ok: boolean }>(`/battery/checks/${id}/complete`),
    inventory: () => get<Inventory>(`/battery/inventory`),
    summary: (date: string) => get<DailySummary[]>(`/battery/summary?date=${date}`),
    managedRooms: () => get<string[]>('/battery/managed-rooms'),
  },
}

export interface ImportType {
  id: number
  uploaded_at: string
  source_filename: string
  week_start: string
}
