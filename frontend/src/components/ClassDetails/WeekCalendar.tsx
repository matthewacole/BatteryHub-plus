import type { ScheduleEntry } from '../../types'
import { to12Hour } from '../../utils'

const HOUR_HEIGHT = 48
const START_HOUR = 7
const END_HOUR = 22

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function timeToPx(t: string) {
  const [h, m] = t.split(':').map(Number)
  return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT
}

export default function WeekCalendar({
  schedules,
  weekDates,
  onPrevWeek,
  onNextWeek,
  onToday,
}: {
  schedules: ScheduleEntry[]
  weekDates: string[]
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
}) {
  const byDayIdx: Record<number, ScheduleEntry[]> = {}
  for (const s of schedules) {
    const idx = weekDates.indexOf(s.date)
    if (idx === -1) continue
    if (!byDayIdx[idx]) byDayIdx[idx] = []
    byDayIdx[idx].push(s)
  }

  const hours: number[] = []
  for (let h = START_HOUR; h <= END_HOUR; h++) hours.push(h)

  const weekStart = new Date(weekDates[0] + 'T12:00:00')
  const weekEnd = new Date(weekDates[6] + 'T12:00:00')
  const label =
    weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' }) +
    ' – ' +
    weekEnd.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onPrevWeek} className="px-3 py-1.5 rounded-lg border border-neutral-200 text-sm text-neutral-500 hover:bg-neutral-100">&larr;</button>
        <span className="text-sm font-medium text-neutral-700 min-w-[200px] text-center">{label}</span>
        <button onClick={onNextWeek} className="px-3 py-1.5 rounded-lg border border-neutral-200 text-sm text-neutral-500 hover:bg-neutral-100">&rarr;</button>
        <button onClick={onToday} className="px-3 py-1.5 rounded-lg border border-blue-200 text-sm text-blue-600 hover:bg-blue-50 ml-2">Today</button>
      </div>

      <div className="overflow-auto">
        <div className="grid grid-cols-[50px_repeat(7,1fr)] min-w-[800px]">
          <div className="sticky top-0 z-10 bg-surface-secondary border-b border-border-light py-2 text-xs font-medium text-neutral-400 text-center">Time</div>
          {weekDates.map((d, i) => {
            const dt = new Date(d + 'T12:00:00')
            const isWeekend = i >= 5
            return (
              <div
                key={d}
                className={`sticky top-0 z-10 border-b border-border-light py-2 text-xs font-medium text-center ${isWeekend ? 'bg-surface-tertiary text-neutral-400' : 'bg-surface-secondary text-neutral-600'}`}
              >
                {DAY_NAMES[i]} {dt.getDate()}
              </div>
            )
          })}

          <div className="relative">
            {hours.map(h => (
              <div key={h} className="h-12 border-b border-border-light pr-1 text-right text-[10px] text-neutral-400 leading-none pt-0.5">
                {h > 0 && to12Hour(`${h}:00`)}
              </div>
            ))}
          </div>

          {[0, 1, 2, 3, 4, 5, 6].map(dayIdx => {
            const classes = byDayIdx[dayIdx] || []
            const isWeekend = dayIdx >= 5
            return (
              <div key={dayIdx} className={`relative border-l border-border-light ${isWeekend ? 'bg-neutral-50/50' : ''}`}>
                {hours.map(h => (
                  <div key={h} className={`h-12 border-b ${h < END_HOUR ? 'border-border-light' : ''}`} />
                ))}
                {classes.map(c => {
                  const top = timeToPx(c.start_time)
                  const height = Math.max(c.duration_hours * HOUR_HEIGHT, HOUR_HEIGHT * 0.5)
                  return (
                    <div
                      key={c.id}
                      className="absolute left-0.5 right-0.5 rounded-lg bg-ai-blue/10 border border-ai-blue/20 px-1.5 py-0.5 overflow-hidden cursor-default hover:bg-ai-blue/20 transition-colors"
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="text-[10px] font-semibold text-text-primary leading-tight truncate">{c.class_name}</div>
                      <div className="text-[9px] text-ai-blue leading-tight">{to12Hour(c.start_time)}–{to12Hour(c.end_time)}</div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
