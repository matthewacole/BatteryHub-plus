const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const APP_ROOT = process.env.APP_ROOT || path.join(__dirname, '..');
const DATA_DIR = path.join(APP_ROOT, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'classroom-battery.db');
let db;

function getDb() {
  if (!db) {
    const opts = {};
    if (process.env.NATIVE_BINDING) {
      const { createRequire } = require('module');
      const customRequire = createRequire(process.execPath);
      opts.nativeBinding = customRequire(process.env.NATIVE_BINDING);
    }
    db = new Database(DB_PATH, opts);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    migrateSchema();
    seedRooms();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      room_id     TEXT PRIMARY KEY,
      building    TEXT NOT NULL,
      room_number TEXT NOT NULL,
      room_type   TEXT NOT NULL DEFAULT 'small',
      battery_req INTEGER NOT NULL DEFAULT 4,
      managed     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS imports (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      uploaded_at     TEXT NOT NULL DEFAULT (datetime('now')),
      source_filename TEXT NOT NULL,
      week_start      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      import_id     INTEGER NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
      building      TEXT NOT NULL,
      room          TEXT NOT NULL,
      class_name    TEXT NOT NULL,
      date          TEXT NOT NULL,
      start_time    TEXT NOT NULL,
      end_time      TEXT NOT NULL,
      duration_hours REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS battery_checks (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      building  TEXT NOT NULL,
      room      TEXT NOT NULL,
      date      TEXT NOT NULL,
      reason    TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      UNIQUE(building, room, date, reason)
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_import ON schedules(import_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_room_date ON schedules(building, room, date);
    CREATE INDEX IF NOT EXISTS idx_battery_checks_date ON battery_checks(date);
  `);
}

function migrateSchema() {
  try { db.exec(`ALTER TABLE rooms ADD COLUMN managed INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
}

const { ROOMS } = require('./room-listing');

const OLD_MANAGED_IDS = new Set([
  'IKB 0002','IKB 1001','IKB 1002','IKB 1003','IKB 1006',
  'IKB 2001','IKB 2002','IKB 2003','IKB 2010','IKB 1005',
  'R S137','R S201','R S202','R S203','R S205','HNE 038',
]);

function seedRooms() {
  const insert = db.prepare(`INSERT OR IGNORE INTO rooms (room_id, building, room_number, room_type, battery_req) VALUES (?, ?, ?, ?, ?)`);
  for (const r of ROOMS) {
    insert.run(r.room_id, r.building, r.room_number, r.room_type, r.battery_req);
  }
  const setManaged = db.prepare(`UPDATE rooms SET managed = 1 WHERE room_id = ?`);
  for (const id of OLD_MANAGED_IDS) {
    setManaged.run(id);
  }
}

function insertImport(filename, weekStart) {
  const stmt = db.prepare(`INSERT INTO imports (source_filename, week_start) VALUES (?, ?)`);
  return stmt.run(filename, weekStart).lastInsertRowid;
}

function insertSchedule(importId, entry) {
  const stmt = db.prepare(`INSERT INTO schedules (import_id, building, room, class_name, date, start_time, end_time, duration_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(importId, entry.building, entry.room, entry.className, entry.date, entry.startTime, entry.endTime, entry.durationHours);
}

function insertBatteryCheck(building, room, date, reason) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO battery_checks (building, room, date, reason) VALUES (?, ?, ?, ?)`);
  return stmt.run(building, room, date, reason);
}

function normalizeParams(params) {
  if (!params || Array.isArray(params)) return params;
  const keys = Object.keys(params);
  if (keys.length === 0) return params;
  if (keys.every(k => String(Number(k)) === k)) {
    return keys.sort((a, b) => Number(a) - Number(b)).map(k => params[k]);
  }
  return params;
}

function run(sql, params = {}) {
  const stmt = getDb().prepare(sql);
  const vals = normalizeParams(params);
  const isQuery = sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH');
  return isQuery ? stmt.all(vals) : stmt.run(vals);
}

function get(sql, params = {}) {
  return getDb().prepare(sql).get(normalizeParams(params));
}

function transaction(fn) {
  return getDb().transaction(fn);
}

function upsertRoom(roomId, building, roomNumber) {
  run(`INSERT OR IGNORE INTO rooms (room_id, building, room_number) VALUES (?, ?, ?)`, { 1: roomId, 2: building, 3: roomNumber });
}

function getManagedRoomIds() {
  const rows = run(`SELECT room_id FROM rooms WHERE managed = 1`);
  return new Set(rows.map(r => r.room_id));
}

function getManagedBuildings() {
  const rows = run(`SELECT DISTINCT building FROM rooms WHERE managed = 1 ORDER BY building`);
  return rows.map(r => r.building);
}

function getManagedRooms() {
  return run(`SELECT * FROM rooms WHERE managed = 1 ORDER BY building, room_number`);
}

function updateRoomManaged(roomId, managed) {
  run(`UPDATE rooms SET managed = ? WHERE room_id = ?`, { 1: managed ? 1 : 0, 2: roomId });
}

function updateRoomConfig(roomId, roomType) {
  const req = roomType === 'large' ? 6 : 4;
  run(`UPDATE rooms SET room_type = ?, battery_req = ? WHERE room_id = ?`, { 1: roomType, 2: req, 3: roomId });
}

module.exports = { getDb, insertImport, insertSchedule, insertBatteryCheck, upsertRoom, run, get, transaction, getManagedRoomIds, getManagedBuildings, getManagedRooms, updateRoomManaged, updateRoomConfig };
