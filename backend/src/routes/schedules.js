const express = require('express');
const router = express.Router();
const { run } = require('../db');

router.get('/', (req, res) => {
  const { building, date } = req.query;
  let sql = `SELECT s.*, r.room_type, r.battery_req FROM schedules s JOIN rooms r ON s.room = r.room_id`;
  const params = {};
  const conds = [];
  if (building) { conds.push(`s.building = @building`); params.building = building; }
  if (date) { conds.push(`s.date = @date`); params.date = date; }
  if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
  sql += ` ORDER BY s.date, s.building, s.start_time`;
  res.json(run(sql, params));
});

router.get('/dates', (req, res) => {
  const rows = run(`SELECT DISTINCT date FROM schedules ORDER BY date`);
  res.json(rows.map(r => r.date));
});

router.get('/week', (req, res) => {
  const { building, room, date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });
  const d = new Date(date + 'T12:00:00');
  const day = d.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + monOffset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const weekStart = mon.toISOString().slice(0, 10);
  const weekEnd = sun.toISOString().slice(0, 10);

  let sql = `SELECT s.*, r.room_type, r.battery_req FROM schedules s JOIN rooms r ON s.room = r.room_id WHERE s.date >= @weekStart AND s.date <= @weekEnd`;
  const params = { weekStart, weekEnd };
  if (building) { sql += ` AND s.building = @building`; params.building = building; }
  if (room) { sql += ` AND s.room = @room`; params.room = room; }
  sql += ` ORDER BY s.date, s.start_time`;
  res.json(run(sql, params));
});

module.exports = router;
