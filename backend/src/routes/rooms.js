const express = require('express');
const router = express.Router();
const { run, getManagedRoomIds, getManagedBuildings, getManagedRooms, updateRoomManaged, updateRoomConfig } = require('../db');
const { classifyRoom } = require('../battery');

router.get('/', (req, res) => {
  const { building } = req.query;
  let sql = `SELECT * FROM rooms`;
  const params = {};
  if (building) { sql += ` WHERE building = @building`; params.building = building; }
  sql += ` ORDER BY building, room_number`;
  res.json(run(sql, params));
});

router.get('/buildings', (req, res) => {
  res.json(run(`SELECT DISTINCT building FROM rooms ORDER BY building`).map(r => r.building));
});

router.get('/managed/list', (req, res) => {
  const rows = run(`SELECT * FROM rooms ORDER BY building, room_number`);
  const buildings = [...new Set(rows.map(r => r.building))].sort();
  const grouped = buildings.map(b => ({
    building: b,
    rooms: rows.filter(r => r.building === b),
  }));
  res.json(grouped);
});

router.get('/managed/buildings', (req, res) => {
  res.json(getManagedBuildings());
});

router.post('/managed', (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates array required' });
  for (const u of updates) {
    if (u.managed !== undefined) updateRoomManaged(u.roomId, u.managed);
    if (u.roomType) updateRoomConfig(u.roomId, u.roomType);
  }
  res.json({ ok: true });
});

router.get('/:roomId', (req, res) => {
  const room = run(`SELECT * FROM rooms WHERE room_id = ?`, { 1: req.params.roomId });
  if (!room.length) return res.status(404).json({ error: 'Room not found' });
  res.json(room[0]);
});

router.get('/:roomId/classification', (req, res) => {
  res.json(classifyRoom(req.params.roomId));
});

module.exports = router;
