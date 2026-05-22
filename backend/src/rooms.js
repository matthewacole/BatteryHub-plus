const { ROOMS } = require('./room-listing');

const BUILDINGS = [...new Set(ROOMS.map(r => r.building))].sort();
const BUILDING_SET = new Set(BUILDINGS);

function normalizeRoomCode(raw) {
  const s = raw.trim().replace(/\s+/g, ' ');
  const m = s.match(/^([A-Za-z]+)\s+(.+)$/);
  if (!m) return null;
  const building = m[1].toUpperCase();
  if (!BUILDING_SET.has(building)) return null;
  const roomNumber = m[2].trim();
  return { building, room: `${building} ${roomNumber}`, roomNumber };
}

function isSupportedBuilding(raw) {
  const s = raw.trim();
  const m = s.match(/^([A-Za-z]+)/);
  if (!m) return false;
  return BUILDING_SET.has(m[1].toUpperCase());
}

function getBuildingRooms(building) {
  return ROOMS.filter(r => r.building === building);
}

module.exports = { BUILDINGS, normalizeRoomCode, isSupportedBuilding, getBuildingRooms };
