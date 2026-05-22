const { XMLParser } = require('fast-xml-parser');

const BUILDING_PATTERNS = [
  { re: /^Health, Nursing & Environmental Studies Building\s+([A-Za-z0-9]+)/, code: 'HNE' },
  { re: /^Ignat Kaneff Building\s+([A-Za-z0-9]+)/, code: 'IKB' },
  { re: /^Ross Building\s+([A-Za-z0-9]+)/, code: 'R' },
];

const SHORT_PATTERNS = [
  { re: /^(IKB)\s+(\S+)/i, code: 'IKB' },
  { re: /^(HNE)\s+(\S+)/i, code: 'HNE' },
  { re: /^(R)\s+(\S+)/i, code: 'R' },
];

function extractLocation(raw) {
  const s = raw.trim();

  for (const { re, code } of BUILDING_PATTERNS) {
    const m = s.match(re);
    if (m) {
      return { building: code, room: `${code} ${m[1]}`, roomNumber: m[1] };
    }
  }

  for (const { re, code } of SHORT_PATTERNS) {
    const m = s.match(re);
    if (m) {
      const num = m[2].replace(/[^A-Za-z0-9].*$/, '');
      return { building: code, room: `${code} ${num}`, roomNumber: num };
    }
  }

  const idx = s.indexOf(' ');
  if (idx > 0) {
    const building = s.substring(0, idx).trim();
    return { building, room: s, roomNumber: s.substring(idx + 1).trim() };
  }

  return { building: s, room: s, roomNumber: '' };
}

function cellText(cell) {
  if (!cell || !cell.Data) return '';
  return cell.Data['#text'] || '';
}

function parseXmlReservations(xmlContent) {
  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xmlContent);

  const sheets = doc.Workbook?.Worksheet;
  if (!sheets) return { entries: [], weekStart: null };

  const sheetList = Array.isArray(sheets) ? sheets : [sheets];
  let rawRows = [];

  for (const sheet of sheetList) {
    const rows = sheet.Table?.Row;
    if (Array.isArray(rows) && rows.length > rawRows.length) {
      rawRows = rows;
    }
  }
  if (!rawRows || !Array.isArray(rawRows)) return { entries: [], weekStart: null };

  const entries = [];
  let weekStart = null;

  for (const row of rawRows) {
    const cells = Array.isArray(row.Cell) ? row.Cell : (row.Cell ? [row.Cell] : []);
    const dateStr = cellText(cells[1]);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    const eventName = cellText(cells[0]);
    const startISO = cellText(cells[4]);
    const endISO = cellText(cells[5]);
    const location = cellText(cells[9]);

    if (!eventName || !startISO || !endISO || !location) continue;

    const loc = extractLocation(location);
    const startTime = startISO.length >= 16 ? startISO.substring(11, 16) : startISO;
    const endTime = endISO.length >= 16 ? endISO.substring(11, 16) : endISO;

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const durationHours = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 100) / 100;

    if (!weekStart || dateStr < weekStart) weekStart = dateStr;

    entries.push({
      date: dateStr,
      className: eventName,
      building: loc.building,
      room: loc.room,
      roomNumber: loc.roomNumber,
      startTime,
      endTime,
      durationHours: Math.max(durationHours, 0),
    });
  }

  return { entries, weekStart };
}

module.exports = { parseXmlReservations };
