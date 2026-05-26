export interface ScheduleEntry {
  id: number
  import_id: number
  building: string
  room: string
  class_name: string
  date: string
  start_time: string
  end_time: string
  duration_hours: number
  room_type: string
  battery_req: number
}

export interface Room {
  room_id: string
  building: string
  room_number: string
  room_type: 'small' | 'large'
  battery_req: number
  managed?: number
}

export interface BatteryCheck {
  id: number
  building: string
  room: string
  date: string
  reason: string
  completed: number
  room_type: string
  battery_req: number
  class_names?: string
}

export interface ImportResult {
  importId: number
  weekStart: string
  entriesImported: number
  message: string
}

export interface Inventory {
  minimum: number
  recommended: number
}

export interface DailySummary {
  building: string
  room: string
  date: string
  total_hours: number
  class_count: number
  first_class: string
  room_type: string
  battery_req: number
}

export type Tab = 'dashboard' | 'battery' | 'details' | 'settings'
export type Building = string
export type ForceMode = 'auto' | 'desktop' | 'mobile'
export type DarkMode = 'light' | 'dark' | 'system'
