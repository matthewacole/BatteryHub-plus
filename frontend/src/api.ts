import type { ScheduleEntry, BatteryCheck, ImportResult, Inventory, DailySummary } from './types'
import type { Room } from './types'

import {
  getSchedules,
  getScheduleDates,
  getWeekSchedules,
  getBuildings,
  getManagedBuildings,
  getManagedRoomsGrouped,
  getRoomsByBuilding,
  getBatteryChecks,
  completeCheck,
  calcMinimumInventory,
  calcRecommendedInventory,
  getDailySummary,
  getManagedRoomIdsList,
  getImports,
  getImport,
  insertImport,
  deleteImport,
  classifyRoom,
  updateRoomManaged,
  updateRoomConfig,
} from './db'
import { processWeek } from './process-week'

export const api = {
  schedules: {
    list: (building?: string, date?: string): Promise<ScheduleEntry[]> =>
      Promise.resolve(getSchedules(building, date)),
    buildings: (): Promise<string[]> =>
      Promise.resolve(getBuildings()),
    dates: (): Promise<string[]> =>
      Promise.resolve(getScheduleDates()),
    week: (opts: { building?: string; room?: string; date: string }): Promise<ScheduleEntry[]> =>
      Promise.resolve(getWeekSchedules(opts)),
  },
  rooms: {
    list: (building?: string): Promise<Room[]> =>
      Promise.resolve(getRoomsByBuilding(building)),
    classification: (roomId: string): Promise<{ roomType: string; batteryReq: number }> =>
      Promise.resolve(classifyRoom(roomId)),
    managed: {
      list: () => Promise.resolve(getManagedRoomsGrouped()),
      buildings: () => Promise.resolve(getManagedBuildings()),
      update: (updates: { roomId: string; managed?: boolean; roomType?: string }[]) => {
        for (const u of updates) {
          if (u.managed !== undefined) updateRoomManaged(u.roomId, u.managed)
          if (u.roomType) updateRoomConfig(u.roomId, u.roomType)
        }
        return Promise.resolve({ ok: true } as const)
      },
    },
    buildings: (): Promise<string[]> =>
      Promise.resolve(getBuildings()),
  },

  imports: {
    upload: async (file: File): Promise<ImportResult> => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let result: { entries: any[]; weekStart: string | null }
      if (ext === 'xml') {
        const text = await file.text()
        const { parseXmlReservations } = await import('./parse-xml')
        result = parseXmlReservations(text)
      } else {
        const { parseWorkbook } = await import('./parse-workbook')
        result = await parseWorkbook(file)
      }
      if (result.entries.length === 0) {
        throw new Error('No supported room entries found in file')
      }
      const entries = result.entries.map(e => ({
        date: e.date,
        className: e.className || e.class_name,
        building: e.building,
        room: e.room,
        roomNumber: e.roomNumber,
        startTime: e.startTime,
        endTime: e.endTime,
        durationHours: e.durationHours,
      }))
      const impResult = insertImport(file.name, result.weekStart || '', entries)
      // Run battery check generation
      processWeek(impResult.importId)
      return impResult
    },
    list: () => Promise.resolve(getImports()),
    get: (id: number) => Promise.resolve(getImport(id)),
    delete: (id: number) => {
      deleteImport(id)
      return Promise.resolve({ ok: true } as const)
    },
  },
  ai: undefined as never,
  battery: {
    checks: (params?: { building?: string; date?: string; completed?: number }): Promise<BatteryCheck[]> =>
      Promise.resolve(getBatteryChecks(params)),
    completeCheck: (id: number) => {
      completeCheck(id)
      return Promise.resolve({ ok: true } as const)
    },
    inventory: (): Promise<Inventory> =>
      Promise.resolve({ minimum: calcMinimumInventory(), recommended: calcRecommendedInventory() }),
    summary: (date: string): Promise<DailySummary[]> =>
      Promise.resolve(getDailySummary(date)),
    managedRooms: (): Promise<string[]> =>
      Promise.resolve(getManagedRoomIdsList()),
  },
}

export interface ImportType {
  id: number
  uploaded_at: string
  source_filename: string
  week_start: string
}
