const express = require('express');
const router = express.Router();
const { run, getManagedRoomIds } = require('../db');
const { calcMinimumInventory, calcRecommendedInventory, getDailySummary } = require('../battery');

router.get('/checks', (req, res) => {
  const { building, date, completed } = req.query;
  let sql = `
    SELECT bc.*, r.room_type, r.battery_req,
      CASE
        WHEN bc.reason = 'high_usage' THEN (
          SELECT GROUP_CONCAT(s.class_name, ', ')
          FROM schedules s
          WHERE s.room = bc.room AND s.building = bc.building AND s.date = bc.date
        )
        WHEN bc.reason = 'early_morning' THEN (
          SELECT GROUP_CONCAT(s.class_name, ', ')
          FROM schedules s
          WHERE s.room = bc.room AND s.building = bc.building
            AND s.start_time <= '08:30'
            AND s.date = (
              SELECT MIN(s2.date) FROM schedules s2
              WHERE s2.room = bc.room AND s2.building = bc.building
                AND s2.date >= bc.date
                AND s2.start_time <= '08:30'
            )
        )
      END as class_names
    FROM battery_checks bc
    JOIN rooms r ON bc.room = r.room_id
  `;
  const params = {};
  const conds = [];
  if (building) { conds.push('bc.building = @building'); params.building = building; }
  if (date) { conds.push('bc.date = @date'); params.date = date; }
  if (completed !== undefined) { conds.push('bc.completed = @completed'); params.completed = Number(completed); }
  if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
  sql += ` ORDER BY bc.date, bc.building, bc.room`;
  res.json(run(sql, params));
});

router.post('/checks/:id/complete', (req, res) => {
  run(`UPDATE battery_checks SET completed = 1 WHERE id = ?`, { 1: req.params.id });
  res.json({ ok: true });
});

router.get('/inventory', (req, res) => {
  const min = calcMinimumInventory();
  const rec = calcRecommendedInventory(min);
  res.json({ minimum: min, recommended: rec });
});

router.get('/managed-rooms', (req, res) => {
  res.json(Array.from(getManagedRoomIds()));
});

router.get('/summary', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });
  res.json(getDailySummary(date));
});

module.exports = router;
