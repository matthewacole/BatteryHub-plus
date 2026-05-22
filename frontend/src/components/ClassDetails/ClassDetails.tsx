import { useState, useEffect } from 'react'
import type { Room, ScheduleEntry } from '../../types'
import { api } from '../../api'
import BuildingFilter from '../shared/BuildingFilter'
import { to12Hour } from '../../utils'
import WeekCalendar from './WeekCalendar'

function computeWeekDates(dateStr: string): string[] {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const dd = new Date(mon)
    dd.setDate(mon.getDate() + i)
    dates.push(dd.toISOString().slice(0, 10))
  }
  return dates
}

export default function ClassDetails({ buildingFilter, onBuildingFilter, buildings }: { buildingFilter: string; onBuildingFilter: (b: string) => void; buildings: string[] }) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string>('')
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [weekDate, setWeekDate] = useState(new Date().toISOString().slice(0, 10))
  const [weekSchedules, setWeekSchedules] = useState<ScheduleEntry[]>([])
  const [weekLoading, setWeekLoading] = useState(false)

  useEffect(() => {
    const b = buildingFilter === 'ALL' ? undefined : buildingFilter
    api.rooms.list(b).then(r => {
      setRooms(r)
      if (r.length > 0 && (!selectedRoom || !r.some(rm => rm.room_id === selectedRoom))) {
        setSelectedRoom(r[0].room_id)
      }
    }).catch(() => {})
  }, [buildingFilter])

  useEffect(() => {
    if (!selectedRoom) return
    setLoading(true)
    api.schedules.list(undefined, undefined).then(all => {
      setSchedules(all.filter(s => s.room === selectedRoom))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [selectedRoom])

  useEffect(() => {
    if (!selectedRoom || viewMode !== 'calendar') return
    setWeekLoading(true)
    const b = buildingFilter === 'ALL' ? undefined : buildingFilter
    api.schedules.week({ room: selectedRoom, building: b, date: weekDate })
      .then(setWeekSchedules)
      .catch(() => {})
      .finally(() => setWeekLoading(false))
  }, [selectedRoom, weekDate, viewMode, buildingFilter])

  const goPrevWeek = () => {
    const d = new Date(weekDate + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    setWeekDate(d.toISOString().slice(0, 10))
  }

  const goNextWeek = () => {
    const d = new Date(weekDate + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    setWeekDate(d.toISOString().slice(0, 10))
  }

  const goToday = () => {
    setWeekDate(new Date().toISOString().slice(0, 10))
  }

  const weekDates = computeWeekDates(weekDate)

  const roomMeta = rooms.find(r => r.room_id === selectedRoom)
  const groupedByDay: Record<string, ScheduleEntry[]> = {}
  for (const s of schedules) {
    if (!groupedByDay[s.date]) groupedByDay[s.date] = []
    groupedByDay[s.date].push(s)
  }
  const totalHours = schedules.reduce((sum, s) => sum + s.duration_hours, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">Class Details</h2>
      </div>
      <BuildingFilter active={buildingFilter} onChange={onBuildingFilter} buildings={buildings} />
      <div className="mb-4 flex items-center gap-3">
        <select
          value={selectedRoom}
          onChange={e => setSelectedRoom(e.target.value)}
          className="max-w-md px-4 py-2 rounded-xl border border-border-light bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ai-blue/30"
        >
          {rooms.map(r => (
            <option key={r.room_id} value={r.room_id}>{r.room_id} ({r.room_type})</option>
          ))}
        </select>
        <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${viewMode === 'list' ? 'bg-surface text-text-primary shadow-sm' : 'text-neutral-500 hover:text-text-primary'}`}
          >
            List
          </button>
          <button
            onClick={() => { setViewMode('calendar'); setWeekLoading(true) }}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-surface text-text-primary shadow-sm' : 'text-neutral-500 hover:text-text-primary'}`}
          >
            Calendar
          </button>
        </div>
      </div>
      {roomMeta && viewMode === 'list' && (
        <div className="flex gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border-light px-5 py-3 shadow-sm">
            <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Type</div>
            <div className="font-semibold text-text-primary">{roomMeta.room_type}</div>
          </div>
          <div className="bg-white rounded-xl border border-border-light px-5 py-3 shadow-sm">
            <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Battery Requirement</div>
            <div className="font-semibold text-text-primary">{roomMeta.battery_req} batteries</div>
          </div>
          <div className="bg-white rounded-xl border border-border-light px-5 py-3 shadow-sm">
            <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Total Week Hours</div>
            <div className="font-semibold text-text-primary">{totalHours.toFixed(1)}h</div>
          </div>
        </div>
      )}
      {viewMode === 'list' ? (
        loading ? (
          <div className="text-neutral-400 text-sm py-8 text-center">Loading schedules...</div>
        ) : Object.keys(groupedByDay).length === 0 ? (
          <div className="text-neutral-400 text-sm py-8 text-center">Select a room to view its schedule.</div>
        ) : (
          Object.entries(groupedByDay).sort().map(([date, entries]) => {
            const dayHours = entries.reduce((s, e) => s + e.duration_hours, 0)
            return (
              <div key={date} className="mb-4 bg-white rounded-xl border border-border-light overflow-hidden">
                <div className="px-4 py-2 bg-surface-secondary border-b border-border-light flex items-center justify-between">
                  <span className="font-medium text-sm text-text-primary">
                    {new Date(date + 'T12:00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-xs text-neutral-400">{dayHours.toFixed(1)}h total</span>
                </div>
                {entries.map(e => (
                  <div key={e.id} className="px-4 py-2 border-b border-surface-tertiary last:border-0 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-mono text-neutral-600">{to12Hour(e.start_time)}–{to12Hour(e.end_time)}</span>
                      <span className="text-neutral-400 mx-2">|</span>
                      <span className="text-neutral-700">{e.class_name}</span>
                    </div>
                    <span className="text-xs text-neutral-400">{e.duration_hours}h</span>
                  </div>
                ))}
              </div>
            )
          })
        )
      ) : (
        weekLoading ? (
          <div className="text-neutral-400 text-sm py-8 text-center">Loading calendar...</div>
        ) : (
          <WeekCalendar
            schedules={weekSchedules}
            weekDates={weekDates}
            onPrevWeek={goPrevWeek}
            onNextWeek={goNextWeek}
            onToday={goToday}
          />
        )
      )}
    </div>
  )
}
