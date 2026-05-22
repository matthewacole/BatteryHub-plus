const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');

const xmlPath = process.env.USERPROFILE + '/Downloads/SpListingExcel (3).xml';
const xml = fs.readFileSync(xmlPath, 'utf8');
const parser = new XMLParser({ ignoreAttributes: false });
const doc = parser.parse(xml);
const sheets = doc.Workbook?.Worksheet;
const sheetList = Array.isArray(sheets) ? sheets : [sheets];

const mainSheet = sheetList[1];
const rows = Array.isArray(mainSheet.Table.Row) ? mainSheet.Table.Row : [mainSheet.Table.Row];

const catSheet = sheetList[4];
const catRows = Array.isArray(catSheet.Table.Row) ? catSheet.Table.Row : [catSheet.Table.Row];

const catHeaders = (Array.isArray(catRows[0].Cell) ? catRows[0].Cell : [catRows[0].Cell])
  .map(c => { const d = c.Data; return d ? (d['#text'] || '') : ''; });

const roomCategories = {};
for (let i = 1; i < catRows.length; i++) {
  const cells = Array.isArray(catRows[i].Cell) ? catRows[i].Cell : [catRows[i].Cell];
  const locName = cells[0]?.Data?.['#text'] || '';
  if (!locName) continue;
  if (!roomCategories[locName]) roomCategories[locName] = [];
  for (let j = 2; j < Math.min(cells.length, catHeaders.length); j++) {
    if (cells[j]?.Data?.['#text'] === 'X') {
      roomCategories[locName].push(catHeaders[j]);
    }
  }
}

function getBuildingCode(locName) {
  const m = locName.match(/^([A-Za-z]+)/);
  return m ? m[1] : 'OTHER';
}

function determineRoomType(categories) {
  const largeTypes = ['Lecture Hall', 'Auditorium', 'Theatre'];
  for (const cat of categories) {
    if (largeTypes.includes(cat)) return 'large';
  }
  return 'small';
}

const dataStart = 1;
const rooms = [];
for (let i = dataStart; i < rows.length; i++) {
  const cells = Array.isArray(rows[i].Cell) ? rows[i].Cell : [rows[i].Cell];
  const locName = (cells[0]?.Data?.['#text'] || '').trim();
  if (!locName) continue;

  const categories = roomCategories[locName] || [];
  const roomType = determineRoomType(categories);
  const building = getBuildingCode(locName);
  const roomNumber = locName.substring(building.length).trim();

  rooms.push({
    room_id: locName,
    building,
    room_number: roomNumber,
    room_type: roomType,
    battery_req: roomType === 'large' ? 6 : 4,
  });
}

rooms.sort((a, b) => {
  if (a.building !== b.building) return a.building.localeCompare(b.building);
  return a.room_number.localeCompare(b.room_number, undefined, { numeric: true });
});

const outPath = __dirname + '/../src/room-listing.js';
const lines = rooms.map(r => {
  const rid = r.room_id.replace(/'/g, "\\'");
  const rnum = r.room_number.replace(/'/g, "\\'");
  return `  { room_id: '${rid}', building: '${r.building}', room_number: '${rnum}', room_type: '${r.room_type}', battery_req: ${r.battery_req} }`;
});

const content = `// Auto-generated from SpListingExcel (3).xml — ${rooms.length} rooms
// Do not edit directly. To regenerate, run: node tools/parse-rooms.js

const ROOMS = [
${lines.join(',\n')}
];

module.exports = { ROOMS };
`;

fs.writeFileSync(outPath, content);
console.log(`Wrote ${rooms.length} rooms to ${outPath}`);
