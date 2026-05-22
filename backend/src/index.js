const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

const APP_ROOT = process.env.APP_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(APP_ROOT, 'public');

app.use(cors());
app.use(express.json());

getDb();

app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/battery', require('./routes/battery'));
app.use('/api/import', require('./routes/import'));
app.use('/api/ai', require('./routes/ai'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: path.join(APP_ROOT, 'data', 'classroom-battery.db') });
});

app.use(express.static(PUBLIC_DIR));

app.get('*', (req, res) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).json({ message: 'Battery Hub API', frontend: 'Run `cd frontend && npx vite` for dev mode, or `cd frontend && npx vite build` and restart backend for production mode.' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Battery Hub running on http://localhost:${PORT}`);
  const { execSync } = require('child_process');
  try {
    execSync(`start http://localhost:${PORT}`, { stdio: 'ignore', timeout: 3000 });
  } catch (_) {}
});
