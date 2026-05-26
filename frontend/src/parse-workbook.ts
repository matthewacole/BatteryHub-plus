import * as XLSX from 'xlsx'

const BUILDING_SET = new Set([
  'ACE', 'ACW', 'BC', 'BSB', 'CB', 'CC', 'CFA', 'CLH', 'DB', 'FC',
  'HNE', 'IKB', 'LAS', 'LSB', 'MC', 'Nourish', 'PSE', 'R', 'SAY',
  'SC', 'SLH', 'SSB', 'VC', 'VH', 'WC',
])

const TIME_RE = /^(\d{1,2}):(\d{2})\s*(am|pm)\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i

function parseTimeString(str: string): { start: number; end: number; startStr: string; endStr: string } | null {
  const m = String(str).trim().match(TIME_RE)
  if (!m) return null
  const toMins = (h: number, mn: number, mer: string) => {
    let hr = h
    if (mer.toLowerCase() === 'pm' && hr !== 12) hr += 12
    if (mer.toLowerCase() === 'am' && hr === 12) hr = 0
    return hr * 60 + mn
  }
  const start = toMins(Number(m[1]), Number(m[2]), m[3])
  const end = toMins(Number(m[4]), Number(m[5]), m[6])
  return {
    start, end,
    startStr: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`,
    endStr: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`,
  }
}

function isTimeCell(val: string): boolean {
  return TIME_RE.test(String(val).trim())
}

function isSupportedBuilding(raw: string): boolean {
  const s = raw.trim()
  const m = s.match(/^([A-Za-z]+)/)
  if (!m) return false
  return BUILDING_SET.has(m[1].toUpperCase())
}

function normalizeRoomCode(raw: string): { building: string; room: string; roomNumber: string } | null {
  const s = raw.trim().replace(/\s+/g, ' ')
  const m = s.match(/^([A-Za-z]+)\s+(.+)$/)
  if (!m) return null
  const building = m[1].toUpperCase()
  if (!BUILDING_SET.has(building)) return null
  const roomNumber = m[2].trim()
  return { building, room: `${building} ${roomNumber}`, roomNumber }
}

interface RawEntry {
  date: string
  className: string
  roomCode: string
  startTime: string
  endTime: string
  durationHours: number
}

export interface ParsedEntry {
  date: string
  className: string
  building: string
  room: string
  roomNumber: string
  startTime: string
  endTime: string
  durationHours: number
}

export function parseWorkbook(file: File): Promise<{ entries: ParsedEntry[]; weekStart: string | null }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        if (!ws) throw new Error('No worksheet found')
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
        if (rows.length < 2) throw new Error('File is empty')

        const dayColumns: { col: number; date: string }[] = []
        const row2 = rows[1] || []
        for (let col = 0; col < row2.length; col++) {
          const cell = row2[col]
          if (cell instanceof Date || (typeof cell === 'number' && cell > 40000)) {
            let d: Date
            if (cell instanceof Date) {
              d = cell
            } else {
              d = new Date((cell - 25569) * 86400 * 1000)
            }
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            dayColumns.push({ col, date: dateStr })
          }
        }

        if (dayColumns.length === 0) {
          throw new Error('Could not find day columns in header row 2')
        }

        const entries: RawEntry[] = []

        for (const dc of dayColumns) {
          const cells: string[] = []
          for (let row = 2; row < rows.length; row++) {
            const val = String(rows[row]?.[dc.col] || '').trim()
            if (val) cells.push(val)
          }

          let i = 0
          while (i < cells.length) {
            if (!isTimeCell(cells[i])) { i++; continue }
            const timeStr = cells[i]
            const parsed = parseTimeString(timeStr)
            if (!parsed) { i++; continue }
            i++
            let className: string | null = null
            let roomCode: string | null = null
            while (i < cells.length && !isTimeCell(cells[i])) {
              const cell = cells[i]
              if (!className && !isSupportedBuilding(cell)) {
                className = cell
              } else if (!roomCode && isSupportedBuilding(cell)) {
                roomCode = cell
                i++
                break
              }
              i++
            }
            if (className && roomCode) {
              const dur = (parsed.end - parsed.start) / 60
              entries.push({
                date: dc.date,
                className,
                roomCode: roomCode,
                startTime: parsed.startStr,
                endTime: parsed.endStr,
                durationHours: Math.round(dur * 100) / 100,
              })
            }
          }
        }

        const filtered: ParsedEntry[] = entries
          .map(e => {
            const norm = normalizeRoomCode(e.roomCode)
            if (!norm) return null
            return {
              date: e.date,
              className: e.className,
              building: norm.building,
              room: norm.room,
              roomNumber: norm.roomNumber,
              startTime: e.startTime,
              endTime: e.endTime,
              durationHours: e.durationHours,
            }
          })
          .filter((e): e is ParsedEntry => e !== null)

        const weekStart = dayColumns.length > 0 ? dayColumns[0].date : null
        resolve({ entries: filtered, weekStart })
      } catch (err: any) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}
