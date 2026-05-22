const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = process.env.PORT || 3001;
const APP_DIR = path.dirname(process.execPath);
const SERVER_SCRIPT = path.join(APP_DIR, 'src', 'index.js');

const server = require(SERVER_SCRIPT);
