const fs = require('fs');
const path = require('path');
const { DATA_FILE, BACKUPS_DIR } = require('../db');

const KEEP = 10;

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function backupRotate() {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  if (fs.existsSync(DATA_FILE)) {
    const dest = path.join(BACKUPS_DIR, `kept-things-${timestamp()}.json`);
    fs.copyFileSync(DATA_FILE, dest);
  }
  const files = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith('kept-things-') && f.endsWith('.json'))
    .sort();
  const excess = files.length - KEEP;
  for (let i = 0; i < excess; i++) {
    fs.unlinkSync(path.join(BACKUPS_DIR, files[i]));
  }
}

module.exports = { backupRotate };
