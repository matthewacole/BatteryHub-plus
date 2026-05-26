import type { ScheduleEntry, BatteryCheck, Room } from './types'
import { ROOMS } from './rooms'

const STORAGE_KEY = 'battery-hub'

interface ImportRecord {
  id: number
  uploaded_at: string
  source_filename: string
  week_start: string
}

interface Store {
  schedules: ScheduleEntry[]
  batteryChecks: BatteryCheck[]
  imports: ImportRecord[]
  nextIds: { schedule: number; batteryCheck: number; import: number }
}

function defaultStore(): Store {
  return {
    schedules: [],
    batteryChecks: [],
    imports: [],
    nextIds: { schedule: 1, batteryCheck: 1, import: 1 },
  }
}

let cache: Store | null = null

function load(): Store {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      cache = JSON.parse(raw)
      return cache!
    }
  } catch {}
  cache = defaultStore()
  return cache
}

function save() {
  if (cache) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  }
}

export function getRooms(): Room[] {
  return ROOMS
}

export function getRoomsByBuilding(building?: string): Room[] {
  if (!building) return ROOMS
  return ROOMS.filter(r => r.building === building)
}

export function getBuildings(): string[] {
  const set = new Set(ROOMS.map(r => r.building))
  return [...set].sort()
}

export function getManagedBuildings(): string[] {
  const set = new Set(ROOMS.filter(r => r.managed).map(r => r.building))
  return [...set].sort()
}

export function getManagedRoomIds(): Set<string> {
  return new Set(ROOMS.filter(r => r.managed).map(r => r.room_id))
}

export function getManagedRooms(): Room[] {
  return ROOMS.filter(r => r.managed)
}

export function getManagedRoomsGrouped(): { building: string; rooms: Room[] }[] {
  const managed = ROOMS.filter(r => r.managed)
  const buildings = [...new Set(managed.map(r => r.building))].sort()
  return buildings.map(b => ({
    building: b,
    rooms: ROOMS.filter(r => r.building === b),
  }))
}

export function updateRoomManaged(roomId: string, managed: boolean) {
  const room = ROOMS.find(r => r.room_id === roomId)
  if (room) room.managed = managed ? 1 : 0
}

export function updateRoomConfig(roomId: string, roomType: string) {
  const room = ROOMS.find(r => r.room_id === roomId)
  if (room) {
    room.room_type = roomType as 'small' | 'large'
    room.battery_req = roomType === 'large' ? 6 : 4
  }
}

export function classifyRoom(roomId: string): { roomType: string; batteryReq: number } {
  const r = ROOMS.find(r => r.room_id === roomId)
  if (!r) return { roomType: 'small', batteryReq: 4 }
  return { roomType: r.room_type, batteryReq: r.battery_req }
}

// Schedule queries
export function getSchedules(building?: string, date?: string): ScheduleEntry[] {
  const store = load()
  let result = store.schedules
  if (building) result = result.filter(s => s.building === building)
  if (date) result = result.filter(s => s.date === date)
  return result
}

export function getScheduleDates(): string[] {
  const store = load()
  const set = new Set(store.schedules.map(s => s.date))
  return [...set].sort()
}

export function getWeekSchedules(opts: { building?: string; room?: string; date: string }): ScheduleEntry[] {
  const d = new Date(opts.date + 'T12:00:00')
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const weekStart = mon.toISOString().slice(0, 10)
  const weekEnd = sun.toISOString().slice(0, 10)

  let result = load().schedules.filter(s => s.date >= weekStart && s.date <= weekEnd)
  if (opts.building) result = result.filter(s => s.building === opts.building!)
  if (opts.room) result = result.filter(s => s.room === opts.room!)
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
}

// Battery check queries
export function getBatteryChecks(params?: { building?: string; date?: string; completed?: number }): BatteryCheck[] {
  const store = load()
  let result = store.batteryChecks
  if (params?.building) result = result.filter(c => c.building === params.building)
  if (params?.date) result = result.filter(c => c.date === params.date)
  if (params?.completed !== undefined) result = result.filter(c => c.completed === params.completed)

  return result.map(c => {
    const room = ROOMS.find(r => r.room_id === c.room)
    const item: BatteryCheck = { ...c, room_type: room?.room_type || 'small', battery_req: room?.battery_req || 4 }
    if (c.reason === 'high_usage') {
      const names = store.schedules
        .filter(s => s.room === c.room && s.building === c.building && s.date === c.date)
        .map(s => s.class_name)
        .join(', ')
      if (names) item.class_names = names
    } else if (c.reason === 'early_morning') {
      const names = store.schedules
        .filter(s => s.room === c.room && s.building === c.building && s.start_time <= '08:30')
        .map(s => s.class_name)
        .join(', ')
      if (names) item.class_names = names
    }
    return item
  })
}

export function completeCheck(id: number) {
  const store = load()
  const check = store.batteryChecks.find(c => c.id === id)
  if (check) check.completed = 1
  save()
}

export function insertBatteryCheck(building: string, room: string, date: string, reason: string) {
  const store = load()
  const exists = store.batteryChecks.some(c => c.building === building && c.room === room && c.date === date && c.reason === reason)
  if (exists) return
  store.batteryChecks.push({
    id: store.nextIds.batteryCheck++,
    building,
    room,
    date,
    reason,
    completed: 0,
    room_type: '',
    battery_req: 0,
  })
  save()
}

// Inventory
export function calcMinimumInventory(): number {
  return ROOMS.filter(r => r.managed).reduce((sum, r) => sum + r.battery_req, 0)
}

export function calcRecommendedInventory(): number {
  const min = calcMinimumInventory()
  const count = ROOMS.filter(r => r.managed).length
  return min + count * 2
}

export function getDailySummary(date: string) {
  const store = load()
  const result: { building: string; room: string; date: string; total_hours: number; class_count: number; first_class: string; room_type: string; battery_req: number }[] = []
  const grouped = new Map<string, ScheduleEntry[]>()
  for (const s of store.schedules.filter(s => s.date === date)) {
    const key = `${s.building}|${s.room}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(s)
  }
  for (const [key, entries] of grouped) {
    const [building, room] = key.split('|')
    const roomData = ROOMS.find(r => r.room_id === room)
    const total = entries.reduce((sum, e) => sum + e.duration_hours, 0)
    const first = entries.reduce((earliest, e) => e.start_time < earliest.start_time ? e : earliest, entries[0])
    result.push({
      building,
      room,
      date,
      total_hours: Math.round(total * 10) / 10,
      class_count: entries.length,
      first_class: first.start_time,
      room_type: roomData?.room_type || 'small',
      battery_req: roomData?.battery_req || 4,
    })
  }
  return result.sort((a, b) => a.building.localeCompare(b.building) || a.room.localeCompare(b.room))
}

// Import management
export function getImports(): ImportRecord[] {
  return load().imports
}

export function getImport(id: number): { import: ImportRecord; entries: ScheduleEntry[] } | null {
  const store = load()
  const imp = store.imports.find(i => i.id === id)
  if (!imp) return null
  return { import: imp, entries: store.schedules.filter(s => s.import_id === id) }
}

export function insertImport(filename: string, weekStart: string, entries: { date: string; className: string; building: string; room: string; roomNumber: string; startTime: string; endTime: string; durationHours: number }[]) {
  const store = load()
  const importId = store.nextIds.import++
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  store.imports.push({ id: importId, uploaded_at: timestamp, source_filename: filename, week_start: weekStart })

  for (const e of entries) {
    if (!ROOMS.some(r => r.room_id === e.room)) {
      ROOMS.push({
        room_id: e.room,
        building: e.building,
        room_number: e.roomNumber,
        room_type: 'small',
        battery_req: 4,
        managed: 0,
      })
    }
    const room = ROOMS.find(r => r.room_id === e.room)
    store.schedules.push({
      id: store.nextIds.schedule++,
      import_id: importId,
      building: e.building,
      room: e.room,
      class_name: e.className,
      date: e.date,
      start_time: e.startTime,
      end_time: e.endTime,
      duration_hours: e.durationHours,
      room_type: room?.room_type || 'small',
      battery_req: room?.battery_req || 4,
    })
    // upsert room
    if (!ROOMS.some(r => r.room_id === e.room)) {
      ROOMS.push({ room_id: e.room, building: e.building, room_number: e.roomNumber, room_type: 'small', battery_req: 4, managed: 0 })
    }
  }
  save()
  return { importId, weekStart, entriesImported: entries.length, message: `Imported ${entries.length} schedule entries` }
}

export function deleteImport(id: number) {
  const store = load()
  const deletedSchedules = store.schedules.filter(s => s.import_id === id)
  const deletedKeys = new Set(deletedSchedules.map(s => `${s.room}|${s.building}|${s.date}`))
  store.schedules = store.schedules.filter(s => s.import_id !== id)
  store.batteryChecks = store.batteryChecks.filter(c => !deletedKeys.has(`${c.room}|${c.building}|${c.date}`))
  store.imports = store.imports.filter(i => i.id !== id)
  save()
}

export function getHighUsageRooms(date: string): { building: string; room: string; total_hours: number }[] {
  const store = load()
  const grouped = new Map<string, { building: string; room: string; total: number }>()
  for (const s of store.schedules.filter(s => s.date === date)) {
    const key = `${s.building}|${s.room}`
    if (!grouped.has(key)) grouped.set(key, { building: s.building, room: s.room, total: 0 })
    grouped.get(key)!.total += s.duration_hours
  }
  return [...grouped.values()].filter(g => g.total >= 6).map(g => ({ ...g, total_hours: Math.round(g.total * 10) / 10 }))
}

export function getEarlyMorningRooms(date: string): { building: string; room: string; first_start: string }[] {
  const store = load()
  const grouped = new Map<string, { building: string; room: string; first_start: string }>()
  for (const s of store.schedules.filter(s => s.date === date && s.start_time <= '08:30')) {
    const key = `${s.building}|${s.room}`
    if (!grouped.has(key) || s.start_time < grouped.get(key)!.first_start) {
      grouped.set(key, { building: s.building, room: s.room, first_start: s.start_time })
    }
  }
  return [...grouped.values()]
}

// Data export/import
export function exportData() {
  const store = load()
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      ...store,
      rooms: ROOMS.map(r => ({ ...r })),
    },
  }
}

export function importData(json: any) {
  if (json.version !== 1) throw new Error('Unsupported export version')
  const data = json.data
  // Restore rooms (managed flags, room types)
  if (data.rooms && Array.isArray(data.rooms)) {
    for (const r of data.rooms) {
      const existing = ROOMS.find(rr => rr.room_id === r.room_id)
      if (existing) {
        existing.managed = r.managed ?? 0
        existing.room_type = r.room_type ?? 'small'
        existing.battery_req = r.battery_req ?? 4
      } else {
        ROOMS.push({ ...r })
      }
    }
  }
  cache = {
    schedules: data.schedules || [],
    batteryChecks: data.batteryChecks || [],
    imports: data.imports || [],
    nextIds: data.nextIds || { schedule: 1, batteryCheck: 1, import: 1 },
  }
  save()
}

export function clearAllData() {
  cache = defaultStore()
  save()
}

export function getManagedRoomIdsList(): string[] {
  return [...getManagedRoomIds()]
}
