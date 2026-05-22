import { useState, useEffect } from 'react'
import type { ScheduleEntry } from '../../types'
import { api } from '../../api'
import { to12Hour } from '../../utils'

interface Props {
  room: string
  building: string
  date: string
  checkId: number
  checkReason: string
  onComplete: (id: number) => void
  onClose: () => void
}

const REASON_META: Record<string, { icon: string; action: string }> = {
  high_usage: { icon: '⚡', action: 'Check batteries' },
  early_morning: { icon: '🌅', action: 'Replace batteries' },
}

function minToTime(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${min.toString().padStart(2, '0')} ${period}`
}

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function RoomScheduleModal({ room, building, date, checkId, checkReason, onComplete, onClose }: Props) {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.schedules.list(building, date).then(all => {
      setSchedules(all.filter(s => s.room === room))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [room, building, date])

  const sorted = [...schedules].sort((a, b) => a.start_time.localeCompare(b.start_time))

  const DAY_START = '07:00'
  const DAY_END = '22:00'
  const dayStartMin = timeToMin(DAY_START)
  const dayEndMin = timeToMin(DAY_END)

  const gaps: { start: string; end: string; duration: string }[] = []
  let cursor = dayStartMin
  for (const s of sorted) {
    const classStart = timeToMin(s.start_time)
    const classEnd = timeToMin(s.end_time)
    if (classStart > cursor) {
      const gapMin = classStart - cursor
      gaps.push({ start: minToTime(cursor), end: minToTime(classStart), duration: `${(gapMin / 60).toFixed(1)}h` })
    }
    cursor = Math.max(cursor, classEnd)
  }
  if (cursor < dayEndMin) {
    const gapMin = dayEndMin - cursor
    gaps.push({ start: minToTime(cursor), end: minToTime(dayEndMin), duration: `${(gapMin / 60).toFixed(1)}h` })
  }

  const meta = REASON_META[checkReason] || { icon: '•', action: checkReason }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-surface rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-text-primary">{room}</h3>
            <p className="text-xs text-neutral-400">{building} — {new Date(date + 'T12:00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </div>
          <span className="text-lg">{meta.icon}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="text-sm text-neutral-400 py-4 text-center">Loading schedule...</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-neutral-500 py-4 text-center">
              <div className="text-2xl mb-2">🆓</div>
              <p>No classes scheduled — room is free all day.</p>
              <p className="text-xs text-neutral-400 mt-1">Any time works for {meta.action.toLowerCase()}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map(s => (
                <div key={s.id} className="bg-ai-blue/5 border border-ai-blue/20 rounded-lg px-3 py-2">
                  <div className="text-xs font-medium text-text-primary">{s.class_name}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">{to12Hour(s.start_time)}–{to12Hour(s.end_time)} ({s.duration_hours}h)</div>
                </div>
              ))}
              {gaps.length > 0 && (
                <div className="pt-2 border-t border-border-light">
                  <div className="text-xs font-medium text-neutral-500 mb-2">Room available:</div>
                  {gaps.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-ai-green/5 border border-ai-green/20 mb-1.5">
                      <span className="text-xs text-ai-green font-medium">✓</span>
                      <span className="text-xs text-text-primary">{g.start} – {g.end}</span>
                      <span className="text-[10px] text-neutral-400 ml-auto">{g.duration}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border-light flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-500 hover:text-text-primary transition-colors">Close</button>
          <button onClick={() => { onComplete(checkId); onClose() }} className="px-4 py-2 rounded-lg text-sm text-white bg-ai-blue hover:bg-ai-blue/90 transition-colors">
            {meta.action}
          </button>
        </div>
      </div>
    </div>
  )
}
