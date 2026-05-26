import type { ScheduleEntry, BatteryCheck as BCType } from '../../types'
import { to12Hour } from '../../utils'

const HOUR_HEIGHT = 32
const START_HOUR = 8
const END_HOUR = 22

function timeToPx(t: string) {
  const [h, m] = t.split(':').map(Number)
  return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT
}

export default function BatteryCheckDayGrid({
  schedules,
  pendingChecks,
}: {
  schedules: ScheduleEntry[]
  pendingChecks: BCType[]
}) {
  const checkRooms = new Set(pendingChecks.map(c => c.room))
  const filtered = schedules.filter(s => checkRooms.has(s.room))
  if (filtered.length === 0) return null

  const byRoom: Record<string, ScheduleEntry[]> = {}
  for (const s of filtered) {
    if (!byRoom[s.room]) byRoom[s.room] = []
    byRoom[s.room].push(s)
  }

  const roomIds = Object.keys(byRoom).sort()
  const checkMap: Record<string, Set<string>> = {}
  for (const c of pendingChecks) {
    if (!checkMap[c.room]) checkMap[c.room] = new Set()
    checkMap[c.room].add(c.reason)
  }

  const hours: number[] = []
  for (let h = START_HOUR; h <= END_HOUR; h++) hours.push(h)

  return (
    <div className="overflow-x-auto rounded-xl border border-border-light bg-card">
      <div className="grid" style={{ gridTemplateColumns: `40px repeat(${roomIds.length}, minmax(120px, 1fr))` }}>
          <div className="sticky left-0 top-0 z-20 bg-surface-secondary border-b border-r border-border-light py-1.5 text-[10px] font-medium text-neutral-400 text-center">Time</div>
          {roomIds.map(room => {
            const reasons = checkMap[room]
            const badges = []
            if (reasons?.has('high_usage')) badges.push('⚡')
            if (reasons?.has('early_morning')) badges.push('🌅')
            return (
              <div key={room} className="sticky top-0 z-10 bg-surface-secondary border-b border-border-light py-1.5 text-xs font-medium text-text-primary text-center border-l border-border-light">
                <div>{room}</div>
                {badges.length > 0 && <div className="text-[9px] mt-px">{badges.join(' ')}</div>}
              </div>
            )
          })}

          <div className="sticky left-0 z-10 bg-card">
            {hours.map(h => (
              <div key={h} className="h-8 border-b border-r border-border-light pr-1 text-right text-[9px] text-neutral-400 leading-none pt-0.5">
                {h > 0 && to12Hour(`${h}:00`)}
              </div>
            ))}
          </div>

          {roomIds.map(room => {
            const classes = byRoom[room]
            const reasons = checkMap[room]
            const isHigh = reasons?.has('high_usage')
            const isEarlyClass = (t: string) => t <= '08:30' && reasons?.has('early_morning')
            return (
              <div key={room} className="relative border-l border-border-light">
                {hours.map(h => (
                  <div key={h} className="h-8 border-b border-border-light" />
                ))}
                {classes.map(c => {
                  const top = timeToPx(c.start_time)
                  const height = Math.max(c.duration_hours * HOUR_HEIGHT, HOUR_HEIGHT * 0.5)
                  const early = isEarlyClass(c.start_time)
                  const borderColor = early ? 'border-l-2 border-blue-400' : isHigh ? 'border-l-2 border-amber-400' : ''
                  const indicator = early ? '🌅' : isHigh ? '⚡' : ''
                  return (
                    <div
                      key={c.id}
                      className={`absolute left-0.5 right-0.5 rounded bg-ai-blue/5 border border-ai-blue/20 px-1 py-0.5 overflow-hidden cursor-default ${borderColor}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="text-[9px] font-medium text-ai-blue leading-tight truncate">{c.class_name}</div>
                      <div className="text-[8px] text-ai-blue/60 leading-tight flex items-center gap-0.5">
                        {to12Hour(c.start_time)}
                        {indicator && <span>{indicator}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
  )
}
