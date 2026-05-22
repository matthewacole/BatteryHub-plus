const express = require('express');
const router = express.Router();
const { ask, configure, getConfig, listModels } = require('../ai');
const { run } = require('../db');

function buildContext({ tab, building, date, importId }) {
  const ctx = {};
  const conds = [];
  const params = {};

  // All managed rooms
  ctx.rooms = run(`SELECT * FROM rooms ORDER BY building, room_number`);

  // Daily usage: total hours per room per day (compact)
  let usageSQL = `SELECT building, room, date, SUM(duration_hours) AS total_hours, COUNT(*) AS class_count, MIN(start_time) AS first_class FROM schedules`;
  if (importId) { conds.push('import_id = @importId'); params.importId = importId; }
  if (building) { conds.push('building = @building'); params.building = building; }
  if (date) { conds.push('date = @date'); params.date = date; }
  if (conds.length) usageSQL += ` WHERE ${conds.join(' AND ')}`;
  usageSQL += ` GROUP BY building, room, date ORDER BY date, building, room LIMIT 20`;
  ctx.dailyUsage = run(usageSQL, params);

  // Pending battery checks
  const bcConds = ['completed = 0'];
  const bcParams = {};
  if (building) { bcConds.push('building = @building'); bcParams.building = building; }
  ctx.pendingChecks = run(`SELECT * FROM battery_checks WHERE ${bcConds.join(' AND ')} ORDER BY date`, bcParams);

  // Rooms exceeding 6h today (if date known) or across all dates
  if (date) {
    ctx.overSix = run(`
      SELECT building, room, date, SUM(duration_hours) AS total_hours
      FROM schedules WHERE date = @date ${building ? 'AND building = @building' : ''}
      GROUP BY building, room HAVING total_hours > 6
    `, building ? { date, building } : { date });
  }

  // Early morning classes (start <= 08:30)
  const emConds = [];
  const emParams = {};
  if (building) { emConds.push('building = @building'); emParams.building = building; }
  if (date) { emConds.push('date = @date'); emParams.date = date; }
  ctx.earlyClasses = run(
    `SELECT DISTINCT building, room, date, start_time, class_name FROM schedules WHERE start_time <= '08:30'${emConds.length ? ' AND ' + emConds.join(' AND ') : ''} ORDER BY date, start_time LIMIT 10`,
    emParams
  );

  // Inventory: count rooms by type
  ctx.inventory = run(`SELECT room_type, COUNT(*) AS count, battery_req FROM rooms GROUP BY room_type`);

  return ctx;
}

router.post('/ask', async (req, res) => {
  try {
    const { query, importId, date, tab, building } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    const context = buildContext({ tab, building, date, importId });
    const answer = await ask(query, context);
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/config', (req, res) => {
  res.json(getConfig());
});

router.post('/config', (req, res) => {
  const { apiUrl, model, apiKey } = req.body;
  configure(apiUrl, model, apiKey);
  res.json(getConfig());
});

router.get('/models', async (req, res) => {
  try {
    const models = await listModels();
    res.json(models);
  } catch (err) {
    res.json([]);
  }
});

module.exports = router;
