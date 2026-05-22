const ExcelJS = require('exceljs');
const { normalizeRoomCode, isSupportedBuilding } = require('./rooms');

const TIME_RE = /^(\d{1,2}):(\d{2})\s*(am|pm)\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i;

function parseTimeString(str) {
  const m = String(str).trim().match(TIME_RE);
  if (!m) return null;
  const toMins = (h, mn, mer) => {
    let hr = Number(h);
    if (mer.toLowerCase() === 'pm' && hr !== 12) hr += 12;
    if (mer.toLowerCase() === 'am' && hr === 12) hr = 0;
    return hr * 60 + Number(mn);
  };
  const start = toMins(m[1], m[2], m[3]);
  const end = toMins(m[4], m[5], m[6]);
  return { start, end, startStr: `${String(Math.floor(start/60)).padStart(2,'0')}:${String(start%60).padStart(2,'0')}`, endStr: `${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}` };
}

function isTimeCell(val) {
  return TIME_RE.test(String(val).trim());
}

async function parseWorkbook(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet(1);

  if (!ws) throw new Error('No worksheet found');

  const colCount = ws.columnCount;
  const rowCount = ws.rowCount;

  const dayColumns = [];
  for (let col = 1; col <= colCount; col++) {
    const cell = ws.getCell(2, col);
    if (cell.value instanceof Date) {
      const d = cell.value;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      dayColumns.push({ col, date: dateStr });
    }
  }

  if (dayColumns.length === 0) {
    throw new Error('Could not find day columns in header row 2');
  }

  const entries = [];

  for (const dc of dayColumns) {
    const cells = [];
    for (let row = 3; row <= rowCount; row++) {
      const cell = ws.getCell(row, dc.col);
      const val = String(cell.value || '').trim();
      if (val) cells.push(val);
    }

    let i = 0;
    while (i < cells.length) {
      if (!isTimeCell(cells[i])) { i++; continue; }
      const timeStr = cells[i];
      const parsed = parseTimeString(timeStr);
      if (!parsed) { i++; continue; }
      i++;
      let className = null;
      let roomCode = null;
      while (i < cells.length && !isTimeCell(cells[i])) {
        const cell = cells[i];
        if (!className && !isSupportedBuilding(cell)) {
          className = cell;
        } else if (!roomCode && isSupportedBuilding(cell)) {
          roomCode = cell;
          i++;
          break;
        }
        i++;
      }
      if (className && roomCode) {
        const dur = (parsed.end - parsed.start) / 60;
        entries.push({
          date: dc.date,
          className,
          roomCode,
          startTime: parsed.startStr,
          endTime: parsed.endStr,
          durationHours: Math.round(dur * 100) / 100,
        });
      }
    }
  }

  const filtered = entries
    .map(e => {
      const norm = normalizeRoomCode(e.roomCode);
      if (!norm) return null;
      return {
        date: e.date,
        className: e.className,
        building: norm.building,
        room: norm.room,
        roomNumber: norm.roomNumber,
        startTime: e.startTime,
        endTime: e.endTime,
        durationHours: e.durationHours,
      };
    })
    .filter(Boolean);

  const weekStart = dayColumns.length > 0 ? dayColumns[0].date : null;

  return { entries: filtered, weekStart };
}

module.exports = { parseWorkbook };
