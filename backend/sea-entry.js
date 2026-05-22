const path = require('path');
const fs = require('fs');

const EXE_DIR = path.dirname(process.execPath);
process.env.APP_ROOT = EXE_DIR;
process.env.NATIVE_BINDING = './better_sqlite3.node';

const dataDir = path.join(EXE_DIR, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('./src/index');
