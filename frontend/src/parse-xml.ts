import type { ParsedEntry } from './parse-workbook'

const BUILDING_PATTERNS = [
  { re: /^Health, Nursing & Environmental Studies Building\s+([A-Za-z0-9]+)/, code: 'HNE' },
  { re: /^Ignat Kaneff Building\s+([A-Za-z0-9]+)/, code: 'IKB' },
  { re: /^Ross Building\s+([A-Za-z0-9]+)/, code: 'R' },
]

const SHORT_PATTERNS = [
  { re: /^(IKB)\s+(\S+)/i, code: 'IKB' },
  { re: /^(HNE)\s+(\S+)/i, code: 'HNE' },
  { re: /^(R)\s+(\S+)/i, code: 'R' },
]

function extractLocation(raw: string): { building: string; room: string; roomNumber: string } {
  const s = raw.trim()

  for (const { re, code } of BUILDING_PATTERNS) {
    const m = s.match(re)
    if (m) {
      return { building: code, room: `${code} ${m[1]}`, roomNumber: m[1] }
    }
  }

  for (const { re, code } of SHORT_PATTERNS) {
    const m = s.match(re)
    if (m) {
      const num = m[2].replace(/[^A-Za-z0-9].*$/, '')
      return { building: code, room: `${code} ${num}`, roomNumber: num }
    }
  }

  const idx = s.indexOf(' ')
  if (idx > 0) {
    const building = s.substring(0, idx).trim()
    return { building, room: s, roomNumber: s.substring(idx + 1).trim() }
  }

  return { building: s, room: s, roomNumber: '' }
}

function cellText(cells: any[], idx: number): string {
  const cell = cells[idx]
  if (!cell || !cell.Data) return ''
  const data = cell.Data
  return data['#text'] || data || ''
}

function parseXml(xmlContent: string): any {
  // Simple recursive XML parser (no deps needed)
  const stack: any[] = []
  let current: any = null
  let inTag = false
  let tagName = ''
  let isClosing = false
  let isSelfClosing = false
  let textContent = ''
  let parsing = false

  const root: any = {}

  for (let i = 0; i < xmlContent.length; i++) {
    const ch = xmlContent[i]

    if (ch === '<') {
      if (textContent.trim() && current) {
        current['#text'] = textContent.trim()
      }
      textContent = ''
      inTag = true
      tagName = ''
      isClosing = false
      isSelfClosing = false
      parsing = true
      continue
    }

    if (ch === '>' && inTag) {
      inTag = false
      parsing = false

      if (isSelfClosing) {
        const parts = tagName.split(/\s+/)
        const name = parts[0]
        if (current) {
          if (!current[name]) current[name] = []
          current[name].push({})
        }
      } else if (isClosing) {
        stack.pop()
        current = stack[stack.length - 1] || root
      } else {
        const parts = tagName.split(/\s+/)
        const name = parts[0]
        const newNode: any = {}
        if (current) {
          if (!current[name]) current[name] = []
          current[name].push(newNode)
          stack.push(current)
          current = newNode
        } else {
          root[name] = [newNode]
          stack.push(current)
          current = newNode
        }
      }
      continue
    }

    if (ch === '/' && inTag && tagName === '') {
      isClosing = true
      continue
    }

    if (ch === '/' && inTag && xmlContent[i - 1] !== '/') {
      // Could be self-closing
      if (xmlContent[i + 1] === '>') {
        isSelfClosing = true
      }
      continue
    }

    if (inTag && parsing) {
      tagName += ch
    } else if (!inTag) {
      textContent += ch
    }
  }

  return root
}

export function parseXmlReservations(xmlContent: string): { entries: ParsedEntry[]; weekStart: string | null } {
  const doc = parseXml(xmlContent)

  const sheets = doc.Workbook?.Worksheet || doc.Worksheet
  if (!sheets) return { entries: [], weekStart: null }

  const sheetList = Array.isArray(sheets) ? sheets : [sheets]
  let rawRows: any[] = []

  for (const sheet of sheetList) {
    const rows = sheet.Table?.Row
    if (Array.isArray(rows) && rows.length > rawRows.length) {
      rawRows = rows
    }
  }

  if (!rawRows || !Array.isArray(rawRows)) return { entries: [], weekStart: null }

  const entries: ParsedEntry[] = []
  let weekStart: string | null = null

  for (const row of rawRows) {
    const cells = Array.isArray(row.Cell) ? row.Cell : (row.Cell ? [row.Cell] : [])

    const eventName = cellText(cells, 0)
    const dateStr = cellText(cells, 1)
    const startISO = cellText(cells, 4)
    const endISO = cellText(cells, 5)
    const location = cellText(cells, 9)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue
    if (!eventName || !startISO || !endISO || !location) continue

    const loc = extractLocation(location)
    const startTime = startISO.length >= 16 ? startISO.substring(11, 16) : startISO
    const endTime = endISO.length >= 16 ? endISO.substring(11, 16) : endISO

    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const durationHours = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 100) / 100

    if (!weekStart || dateStr < weekStart) weekStart = dateStr

    entries.push({
      date: dateStr,
      className: eventName,
      building: loc.building,
      room: loc.room,
      roomNumber: loc.roomNumber,
      startTime,
      endTime,
      durationHours: Math.max(durationHours, 0),
    })
  }

  return { entries, weekStart }
}
