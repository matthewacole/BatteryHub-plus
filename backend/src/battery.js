const { run, get, insertBatteryCheck, getManagedRoomIds } = require('./db');

function classifyRoom(roomId) {
  const r = get(`SELECT room_type, battery_req FROM rooms WHERE room_id = ?`, { 1: roomId });
  if (!r) return { roomType: 'small', batteryReq: 4 };
  return { roomType: r.room_type, batteryReq: r.battery_req };
}

function calcDailyUsage(building, room, date) {
  const rows = run(`SELECT SUM(duration_hours) as total FROM schedules WHERE building = ? AND room = ? AND date = ?`, {
    1: building, 2: room, 3: date
  });
  return rows[0]?.total || 0;
}

function getHighUsageRooms(date) {
  return run(`SELECT building, room, ROUND(SUM(duration_hours), 1) as total_hours FROM schedules WHERE date = ? GROUP BY building, room HAVING total_hours >= 6`, { 1: date });
}

function getEarlyMorningRooms(date) {
  return run(`SELECT DISTINCT s.building, s.room, MIN(s.start_time) as first_start FROM schedules s WHERE s.date = ? AND s.start_time <= '08:30' GROUP BY s.building, s.room`, { 1: date });
}

function processWeek(importId) {
  const dateRows = run(`SELECT DISTINCT date FROM schedules WHERE import_id = ? ORDER BY date`, { 1: importId });
  const allDates = dateRows.map(r => r.date);

  for (let i = 0; i < allDates.length; i++) {
    const today = allDates[i];
    const todayDOW = new Date(today + 'T12:00:00').getDay();

    // Skip weekends — batteries can't be changed Sat/Sun
    if (todayDOW === 0 || todayDOW === 6) continue;

    // 1. High usage — same day
    const highUsageRooms = getHighUsageRooms(today);
    const managedIds = getManagedRoomIds();
    for (const r of highUsageRooms) {
      if (managedIds.has(r.room)) {
        insertBatteryCheck(r.building, r.room, today, 'high_usage');
      }
    }

    // 2. Find next weekday (skip Sat/Sun)
    let nextIdx = i + 1;
    let nextDate = null;
    while (nextIdx < allDates.length) {
      const nd = new Date(allDates[nextIdx] + 'T12:00:00').getDay();
      if (nd !== 0 && nd !== 6) { nextDate = allDates[nextIdx]; break; }
      nextIdx++;
    }
    if (!nextDate) continue;

    // 3. Early morning — check next weekday's ≤8:30am classes
    const earlyRooms = getEarlyMorningRooms(nextDate);
    for (const r of earlyRooms) {
      if (!getManagedRoomIds().has(r.room)) continue;

      if (todayDOW === 5) {
        // Friday → Monday: check if room has weekend events
        const weekendDates = allDates.filter(d => {
          const dDOW = new Date(d + 'T12:00:00').getDay();
          return dDOW === 0 || dDOW === 6;
        });
        let hasWeekendEvent = false;
        for (const wd of weekendDates) {
          const cnt = run(`SELECT COUNT(*) as cnt FROM schedules WHERE date = ? AND room = ?`, { 1: wd, 2: r.room });
          if (cnt[0]?.cnt > 0) { hasWeekendEvent = true; break; }
        }
        if (hasWeekendEvent) {
          // Room used over weekend → remind Monday morning
          insertBatteryCheck(r.building, r.room, nextDate, 'early_morning');
        } else {
          // Weekend quiet → pre-warn Friday
          insertBatteryCheck(r.building, r.room, today, 'early_morning');
        }
      } else {
        // Mon–Thu → next weekday: check tonight
        insertBatteryCheck(r.building, r.room, today, 'early_morning');
      }
    }
  }
}

function calcMinimumInventory() {
  const rows = run(`SELECT battery_req FROM rooms WHERE managed = 1`);
  return rows.reduce((sum, r) => sum + r.battery_req, 0);
}

function calcRecommendedInventory(minimum) {
  const count = getManagedRoomIds().size;
  return minimum + count * 2;
}

function getDailySummary(date) {
  const rows = run(`
    SELECT s.building, s.room, s.date,
           SUM(s.duration_hours) as total_hours,
           COUNT(s.id) as class_count,
           MIN(s.start_time) as first_class,
           r.room_type,
           r.battery_req
    FROM schedules s
    JOIN rooms r ON s.room = r.room_id
    WHERE s.date = ?
    GROUP BY s.building, s.room
    ORDER BY s.building, s.room
  `, { 1: date });
  return rows;
}

module.exports = {
  classifyRoom, calcDailyUsage, getHighUsageRooms, getEarlyMorningRooms,
  processWeek, calcMinimumInventory, calcRecommendedInventory, getDailySummary,
};
