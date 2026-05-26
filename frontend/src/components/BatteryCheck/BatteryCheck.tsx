import { useState, useEffect } from 'react'
import type { BatteryCheck as BCType, Inventory, ScheduleEntry } from '../../types'
import { api } from '../../api'
import { to12Hour } from '../../utils'
import BuildingFilter from '../shared/BuildingFilter'
import BatteryCheckDayGrid from './BatteryCheckDayGrid'
import RoomScheduleModal from './RoomScheduleModal'

const REASON_LABELS: Record<string, { icon: string; action: string }> = {
  high_usage: { icon: '⚡', action: 'Check batteries' },
  early_morning: { icon: '🌅', action: 'Replace batteries' },
}

export default function BatteryCheck({ buildingFilter, onBuildingFilter, buildings }: { buildingFilter: string; onBuildingFilter: (b: string) => void; buildings: string[] }) {
  const [weekDates, setWeekDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [todaysChecks, setTodaysChecks] = useState<BCType[]>([])
  const [yesterdaysChecks, setYesterdaysChecks] = useState<BCType[]>([])
  const [todaySchedules, setTodaySchedules] = useState<ScheduleEntry[]>([])
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCheck, setSelectedCheck] = useState<BCType | null>(null)

  useEffect(() => {
    api.schedules.dates().then(dates => {
      setWeekDates(dates)
      if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0])
    }).catch(() => {})
    api.battery.inventory().then(setInventory).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    const b = buildingFilter === 'ALL' ? undefined : buildingFilter
    const idx = weekDates.indexOf(selectedDate)
    const prevDate = idx > 0 ? weekDates[idx - 1] : null

    const params: { building?: string; date: string } = { date: selectedDate }
    if (b) params.building = b

    const prevParams: { building?: string; date: string } | null = prevDate ? { date: prevDate } : null
    if (b && prevParams) prevParams.building = b

    const todayReq = api.battery.checks(params)
    const prevReq = prevParams ? api.battery.checks(prevParams) : Promise.resolve([])
    const todaySchedReq = api.schedules.list(b, selectedDate)

    Promise.all([todayReq, prevReq, todaySchedReq]).then(([today, prev, sched]) => {
      setTodaysChecks(today)
      setYesterdaysChecks(prev)
      setTodaySchedules(sched)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [selectedDate, buildingFilter])

  const refreshDay = () => {
    if (!selectedDate) return
    const b = buildingFilter === 'ALL' ? undefined : buildingFilter
    const idx = weekDates.indexOf(selectedDate)
    const prevDate = idx > 0 ? weekDates[idx - 1] : null
    const params: { building?: string; date: string } = { date: selectedDate }
    if (b) params.building = b
    const prevParams: { building?: string; date: string } | null = prevDate ? { date: prevDate } : null
    if (b && prevParams) prevParams.building = b
    const todayReq = api.battery.checks(params)
    const prevReq = prevParams ? api.battery.checks(prevParams) : Promise.resolve([])
    const todaySchedReq = api.schedules.list(b, selectedDate)
    Promise.all([todayReq, prevReq, todaySchedReq]).then(([today, prev, sched]) => {
      setTodaysChecks(today)
      setYesterdaysChecks(prev)
      setTodaySchedules(sched)
    })
  }

  const handleComplete = async (id: number) => {
    await api.battery.completeCheck(id)
    refreshDay()
  }

  const printPdf = async () => {
    const allChecks = await api.battery.checks({ completed: 0 })
    const inv = await api.battery.inventory()
    const byDate: Record<string, BCType[]> = {}
    for (const c of allChecks) {
      if (!byDate[c.date]) byDate[c.date] = []
      byDate[c.date].push(c)
    }
    const dates = Object.keys(byDate).sort()
    const schedResults = await Promise.all(dates.map(d => api.schedules.list(undefined, d)))
    const trunc = (s: string, max: number) => s.length > max ? s.slice(0, max) + '…' : s
    const HOUR_HEIGHT = 32
    const START_HOUR = 8
    const END_HOUR = 22
    const timeToPx = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT
    }
    const hours: number[] = []
    for (let h = START_HOUR; h <= END_HOUR; h++) hours.push(h)
    let html = `<html><head><style>
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; margin: 0; }
      h1 { font-size: 16px; margin-bottom: 4px; }
      h2 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th, td { text-align: left; padding: 3px 5px; border-bottom: 1px solid #eee; font-size: 10px; }
      th { background: #f5f5f5; font-weight: 600; }
      .inv { margin-top: 16px; font-size: 12px; }
      input[type=checkbox] { width: 14px; height: 14px; }
      .grid-wrap { overflow-x: auto; border: 1px solid #e5e5ea; border-radius: 8px; margin-bottom: 16px; }
      .g { display: grid; }
      .gh { background: #f2f2f7; border-bottom: 1px solid #e5e5ea; padding: 4px; text-align: center; font-size: 10px; font-weight: 500; }
      .gr { border-bottom: 1px solid #e5e5ea; height: 32px; }
      .gt { text-align: right; padding-right: 4px; font-size: 9px; color: #999; line-height: 32px; }
      .gc { border-left: 1px solid #e5e5ea; position: relative; }
      .cb { position: absolute; left: 2px; right: 2px; border-radius: 4px; background: rgba(0,122,255,0.05); border: 1px solid rgba(0,122,255,0.2); padding: 2px 4px; overflow: hidden; }
      .cn { font-size: 9px; font-weight: 500; color: #1C1C1E; line-height: 1.2; }
      .ct { font-size: 8px; color: #007AFF; }
      .bdg { font-size: 9px; }
      @media print {
        .day { page-break-after: always; }
        .day:last-child { page-break-after: auto; }
        .grid-wrap { overflow: visible !important; }
      }
</style></head><body>
      <h1>Battery Check Report</h1>
      <p style="color:#666;margin:0 0 12px;">Generated ${new Date().toLocaleDateString()}</p>`
    for (let di = 0; di < dates.length; di++) {
      const d = dates[di]
      const checks = byDate[d]
      const allSched = schedResults[di]
      const checkRooms = new Set(checks.map(c => c.room))
      const filtered = allSched.filter(s => checkRooms.has(s.room))
      const byRoom: Record<string, typeof filtered> = {}
      for (const s of filtered) {
        if (!byRoom[s.room]) byRoom[s.room] = []
        byRoom[s.room].push(s)
      }
      const roomIds = Object.keys(byRoom).sort()
      const checkMap: Record<string, Set<string>> = {}
      for (const c of checks) {
        if (!checkMap[c.room]) checkMap[c.room] = new Set()
        checkMap[c.room].add(c.reason)
      }
      html += `<div class="day"><h2>${new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>`
      if (roomIds.length > 0 && filtered.length > 0) {
        const totalWidth = 40 + roomIds.length * 120
        html += `<div class="grid-wrap"><div class="g" style="grid-template-columns:40px repeat(${roomIds.length},120px);width:${totalWidth}px">
          <div class="gh">Time</div>`
        for (const room of roomIds) {
          const reasons = checkMap[room]
          const badges: string[] = []
          if (reasons?.has('high_usage')) badges.push('⚡')
          if (reasons?.has('early_morning')) badges.push('🌅')
          html += `<div class="gh">${room}${badges.length ? '<div class="bdg">'+badges.join(' ')+'</div>' : ''}</div>`
        }
        html += `<div style="position:relative">`
        for (const h of hours) html += `<div class="gr gt">${h > 0 ? to12Hour(h + ':00') : ''}</div>`
        html += `</div>`
        for (const room of roomIds) {
          const classes = byRoom[room]
          const reasons = checkMap[room]
          const isHigh = reasons?.has('high_usage')
          const e = (t: string) => t <= '08:30' && reasons?.has('early_morning')
          html += `<div class="gc">`
          for (const _ of hours) html += `<div class="gr"></div>`
          for (const c of classes) {
            const top = timeToPx(c.start_time)
            const height = Math.max(c.duration_hours * HOUR_HEIGHT, HOUR_HEIGHT * 0.5)
            const early = e(c.start_time)
            const bl = early ? '2px solid #007AFF' : isHigh ? '2px solid #FF9F0A' : ''
            const ind = early ? ' 🌅' : isHigh ? ' ⚡' : ''
            html += `<div class="cb" style="top:${top}px;height:${height}px${bl ? ';border-left:'+bl : ''}">
              <div class="cn">${c.class_name}</div>
              <div class="ct">${to12Hour(c.start_time)}${ind}</div></div>`
          }
          html += `</div>`
        }
        html += `</div></div>`
      }
      const rooms: Record<string, { building: string; reasons: string[]; room_type: string; classes: Set<string> }> = {}
      for (const c of checks) {
        if (!rooms[c.room]) rooms[c.room] = { building: c.building, reasons: [], room_type: c.room_type, classes: new Set() }
        rooms[c.room].reasons.push(c.reason === 'high_usage' ? '⚡ High usage' : '🌅 Early morning')
        if (c.class_names) c.class_names.split(', ').forEach(n => rooms[c.room].classes.add(n))
      }
      html += `<table><tr><th>Room</th><th>Building</th><th>Reason</th><th>Size</th><th>Class</th><th>Done</th></tr>`
      for (const [room, r] of Object.entries(rooms)) {
        html += `<tr><td>${room}</td><td>${r.building}</td><td>${r.reasons.join(', ')}</td><td>${r.room_type === 'large' ? 'Large (6 bat)' : 'Small (4 bat)'}</td><td>${trunc([...r.classes].join(', '), 40)}</td><td><input type="checkbox"></td></tr>`
      }
      html += `</table></div>`
    }
    html += `<div class="inv">Minimum batteries: ${inv.minimum} &nbsp;|&nbsp; Recommended: ${inv.recommended}</div></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500) }
  }

  const todayTasks = todaysChecks.filter(c => c.completed === 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">Battery Check</h2>
        <button onClick={printPdf} className="text-xs px-3 py-1.5 rounded-full bg-white border border-border-light text-neutral-500 hover:bg-surface-tertiary transition-colors">
          Print PDF
        </button>
      </div>
      <BuildingFilter active={buildingFilter} onChange={onBuildingFilter} buildings={buildings} />

      {inventory && (
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="bg-white rounded-xl border border-border-light px-5 py-3 flex-1 shadow-sm">
            <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Minimum Batteries</div>
            <div className="text-2xl font-semibold text-text-primary">{inventory.minimum}</div>
          </div>
          <div className="bg-white rounded-xl border border-border-light px-5 py-3 flex-1 shadow-sm">
            <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Recommended Stock</div>
            <div className="text-2xl font-semibold text-ai-orange">{inventory.recommended}</div>
          </div>
        </div>
      )}

      {weekDates.length > 0 && (
        <div className="flex gap-2 mb-4">
          {weekDates.map(d => {
            const label = new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric' })
            const isSelected = d === selectedDate
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isSelected ? 'bg-ai-blue text-white' : 'bg-white border border-border-light text-neutral-500 hover:border-ai-blue/30'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="text-neutral-400 text-sm py-8 text-center">Loading checks...</div>
      ) : !selectedDate ? (
        <div className="text-neutral-400 text-sm py-8 text-center">Import a schedule first.</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {todayTasks.length > 0 && (
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-neutral-500 mb-3">📅 Today's Schedule — Battery Check Rooms</h3>
              <div className="max-h-[50vh] md:max-h-none overflow-y-auto">
                <BatteryCheckDayGrid schedules={todaySchedules} pendingChecks={todayTasks} />
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-6">
            <section>
              <h3 className="text-sm font-medium text-neutral-500 mb-3">🔍 Tonight's Tasks</h3>
              {todayTasks.length === 0 ? (
                <p className="text-sm text-neutral-400 py-3">No tasks for tonight.</p>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map(c => {
                    const meta = REASON_LABELS[c.reason] || { icon: '•', action: c.reason }
                    return (
                      <div key={c.id} className={`bg-white rounded-xl border px-4 py-3 flex items-center justify-between shadow-sm ${c.completed ? 'border-ai-green/30 bg-ai-green/5' : 'border-border-light'}`}>
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedCheck(c)}>
                          <span className="text-lg">{meta.icon}</span>
                          <div>
                            <div className={`font-medium ${c.completed ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}>{meta.action} in {c.room}</div>
                            <div className="text-xs text-neutral-400">{c.building}</div>
                            {c.class_names && <div className="text-xs text-neutral-500 mt-0.5">{c.class_names}</div>}
                          </div>
                        </div>
                        {c.completed ? (
                          <span className="text-xs text-green-600 font-medium">Done</span>
                        ) : (
                          <button onClick={() => handleComplete(c.id)} className="text-xs px-3 py-1.5 rounded-full bg-surface-tertiary text-neutral-500 hover:bg-ai-green/10 hover:text-ai-green transition-colors">
                            Mark Complete
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {yesterdaysChecks.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-neutral-500 mb-3">🔍 This Morning's Follow-up</h3>
                <div className="space-y-2">
                  {yesterdaysChecks.map(c => {
                    const meta = REASON_LABELS[c.reason] || { icon: '•', action: c.reason }
                    return (
                      <div key={c.id} className={`bg-white rounded-xl border px-4 py-3 flex items-center justify-between shadow-sm ${c.completed ? 'border-ai-green/30 bg-ai-green/5' : 'border-ai-pink/30 bg-ai-pink/5'}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{c.completed ? '✅' : '❌'}</span>
                          <div>
                            <div className={`font-medium ${c.completed ? 'text-green-700' : 'text-red-700'}`}>
                              {c.completed ? `${meta.action} in ${c.room} — done` : `${meta.action} in ${c.room} — was due!`}
                            </div>
                            <div className="text-xs text-neutral-400">{c.building} — was due {c.date}</div>
                            {c.class_names && <div className="text-xs text-neutral-500 mt-0.5">{c.class_names}</div>}
                          </div>
                        </div>
                        {!c.completed && (
                          <button onClick={() => handleComplete(c.id)} className="text-xs px-3 py-1.5 rounded-full bg-ai-pink/10 text-ai-pink hover:bg-ai-green/10 hover:text-ai-green transition-colors">
                            Mark Complete
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {todayTasks.length === 0 && yesterdaysChecks.length === 0 && (
              <div className="text-neutral-400 text-sm py-4 text-center">All caught up for this day.</div>
            )}
          </div>
        </div>
      )}
      {selectedCheck && (
        <RoomScheduleModal
          room={selectedCheck.room}
          building={selectedCheck.building}
          date={selectedCheck.date}
          checkId={selectedCheck.id}
          checkReason={selectedCheck.reason}
          onComplete={handleComplete}
          onClose={() => setSelectedCheck(null)}
        />
      )}
    </div>
  )
}
