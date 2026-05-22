const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseWorkbook } = require('../parser');
const { parseXmlReservations } = require('../parse-xml');
const { insertImport, insertSchedule, upsertRoom, run, transaction } = require('../db');
const { processWeek } = require('../battery');

const APP_ROOT = process.env.APP_ROOT || path.join(__dirname, '..', '..');
const UPLOAD_DIR = path.join(APP_ROOT, 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const result = ext === '.xml'
      ? parseXmlReservations(fs.readFileSync(req.file.path, 'utf8'))
      : await parseWorkbook(req.file.path);
    if (result.entries.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'No supported room entries found in file' });
    }
    const importId = insertImport(req.file.originalname, result.weekStart || '');
    const insertMany = transaction((entries) => {
      const seen = new Set();
      for (const e of entries) {
        if (!seen.has(e.room)) {
          upsertRoom(e.room, e.building, e.roomNumber);
          seen.add(e.room);
        }
        insertSchedule(importId, e);
      }
    });
    insertMany(result.entries);
    processWeek(importId);
    fs.unlinkSync(req.file.path);
    res.json({
      importId,
      weekStart: result.weekStart,
      entriesImported: result.entries.length,
      message: `Imported ${result.entries.length} schedule entries`,
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  const imports = run(`SELECT * FROM imports ORDER BY uploaded_at DESC`);
  res.json(imports);
});

router.get('/:id', (req, res) => {
  const imp = run(`SELECT * FROM imports WHERE id = ?`, { 1: req.params.id });
  if (!imp.length) return res.status(404).json({ error: 'Import not found' });
  const entries = run(`SELECT * FROM schedules WHERE import_id = ? ORDER BY date, start_time`, { 1: req.params.id });
  res.json({ import: imp[0], entries });
});

router.delete('/:id', (req, res) => {
  run(`DELETE FROM battery_checks WHERE (building, room, date) IN (SELECT DISTINCT building, room, date FROM schedules WHERE import_id = ?)`, { 1: req.params.id });
  run(`DELETE FROM schedules WHERE import_id = ?`, { 1: req.params.id });
  run(`DELETE FROM imports WHERE id = ?`, { 1: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
