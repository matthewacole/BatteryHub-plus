import { useState, useEffect } from 'react'
import type { ScheduleEntry, DailySummary } from '../../types'
import { api } from '../../api'
import BuildingFilter from '../shared/BuildingFilter'

export default function Dashboard({ buildingFilter, onBuildingFilter, buildings }: { buildingFilter: string; onBuildingFilter: (b: string) => void; buildings: string[] }) {
  const [dates, setDates] = useState<string[]>([])
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([])
  const [summaries, setSummaries] = useState<DailySummary[]>([])
  const [managedRooms, setManagedRooms] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.schedules.dates().then(setDates).catch(() => {})
    api.battery.managedRooms().then(ids => setManagedRooms(new Set(ids))).catch(() => {})
  }, [])

  useEffect(() => {
    if (dates.length === 0) return
    setLoading(true)
    const b = buildingFilter === 'ALL' ? undefined : buildingFilter
    Promise.all([
      api.schedules.list(b),
      ...dates.map(d => api.battery.summary(d)),
    ]).then(([sched, ...summs]) => {
      setSchedules(sched)
      setSummaries(summs.flat())
    }).catch(() => {}).finally(() => setLoading(false))
  }, [dates, buildingFilter])

  const rooms = [...new Set(schedules.map(s => s.room))].sort()
  const days = dates

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">Dashboard</h2>
      </div>
      <BuildingFilter active={buildingFilter} onChange={onBuildingFilter} buildings={buildings} />
      {loading ? (
        <div className="text-neutral-400 text-sm py-8 text-center">Loading schedules...</div>
      ) : schedules.length === 0 ? (
        <div className="text-neutral-400 text-sm py-8 text-center">
          <div className="text-lg mb-2">⚡BatteryHub+</div>
          <p>No schedules found yet. Import a weekly Excel file in Settings.</p>
        </div>
      ) : (
        <div className="overflow-auto max-h-[calc(100vh-220px)]">
          <table className="w-full text-xs md:text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-secondary">
              <tr>
                <th className="text-left py-2 pr-2 md:pr-4 text-neutral-400 font-medium sticky left-0 bg-surface-secondary z-20">Room</th>
                {days.map(d => (
                  <th key={d} className="py-2 px-2 md:px-3 text-neutral-400 font-medium text-center min-w-[90px] md:min-w-[120px] bg-surface-secondary">
                    <span className="hidden md:inline">{new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="md:hidden">{new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric' })}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => {
                const isManaged = managedRooms.has(room)
                return (
                  <tr key={room} className="border-t border-neutral-100">
                     <td className={`py-2 pr-2 md:pr-4 sticky left-0 bg-surface-secondary ${isManaged ? 'font-bold text-text-primary' : 'font-medium text-neutral-600'}`}>{room}</td>
                    {days.map(day => {
                      const summary = summaries.find(s => s.room === room && s.date === day)
                      const daySched = schedules.filter(s => s.room === room && s.date === day)
                      const hours = summary?.total_hours ?? 0
                      const isHigh = hours > 6
                      const isEarly = daySched.some(s => s.start_time <= '08:30')
                      return (
                        <td key={day} className="py-1.5 px-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            {daySched.length > 0 ? (
                              <>
                                <span className={`text-xs font-mono ${isHigh && isManaged ? 'text-amber-600 font-bold' : 'text-neutral-600'}`}>
                                  {hours.toFixed(1)}h
                                </span>
                                <span className="text-xs text-neutral-400">{daySched.length} class{daySched.length > 1 ? 'es' : ''}</span>
                                {isManaged && (
                                  <div className="flex gap-1 mt-0.5">
                                    {isHigh && <span className="text-xs px-1.5 py-0.5 rounded bg-ai-orange/10 text-ai-orange" title="Exceeds 6h">⚠</span>}
                                    {isEarly && <span className="text-xs px-1.5 py-0.5 rounded bg-ai-blue/10 text-ai-blue" title="Early class ≤8:30">🌅</span>}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
