import {
  getSchedules,
  getManagedRoomIds,
  insertBatteryCheck,
  getHighUsageRooms,
  getEarlyMorningRooms,
} from './db'

function getScheduleDates(importId: number): string[] {
  const all = getSchedules()
  const dates = new Set(all.filter(s => s.import_id === importId).map(s => s.date))
  return [...dates].sort()
}

function getRoomHasEvents(room: string, dates: string[]): boolean {
  const schedules = getSchedules()
  for (const d of dates) {
    if (schedules.some(s => s.room === room && s.date === d)) return true
  }
  return false
}

export function processWeek(importId: number) {
  const allDates = getScheduleDates(importId)

  for (let i = 0; i < allDates.length; i++) {
    const today = allDates[i]
    const todayDOW = new Date(today + 'T12:00:00').getDay()

    if (todayDOW === 0 || todayDOW === 6) continue

    const highUsageRooms = getHighUsageRooms(today)
    const managedIds = getManagedRoomIds()
    for (const r of highUsageRooms) {
      if (managedIds.has(r.room)) {
        insertBatteryCheck(r.building, r.room, today, 'high_usage')
      }
    }

    let nextIdx = i + 1
    let nextDate: string | null = null
    while (nextIdx < allDates.length) {
      const nd = new Date(allDates[nextIdx] + 'T12:00:00').getDay()
      if (nd !== 0 && nd !== 6) { nextDate = allDates[nextIdx]; break }
      nextIdx++
    }
    if (!nextDate) continue

    const earlyRooms = getEarlyMorningRooms(nextDate)
    for (const r of earlyRooms) {
      if (!getManagedRoomIds().has(r.room)) continue

      if (todayDOW === 5) {
        const weekendDates = allDates.filter(d => {
          const dDOW = new Date(d + 'T12:00:00').getDay()
          return dDOW === 0 || dDOW === 6
        })
        const hasWeekendEvent = getRoomHasEvents(r.room, weekendDates)
        if (hasWeekendEvent) {
          insertBatteryCheck(r.building, r.room, nextDate, 'early_morning')
        } else {
          insertBatteryCheck(r.building, r.room, today, 'early_morning')
        }
      } else {
        insertBatteryCheck(r.building, r.room, today, 'early_morning')
      }
    }
  }
}
