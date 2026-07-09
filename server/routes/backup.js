const express = require('express');
const multer = require('multer');
const db = require('../db');
const { backupRotate } = require('../lib/backupRotate');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/export', (req, res) => {
  const state = db.getState();
  const filename = `kept-things-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(state, null, 2));
});

router.post('/import', upload.single('file'), (req, res) => {
  let raw;
  if (req.file) {
    raw = req.file.buffer.toString('utf8');
  } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
    raw = JSON.stringify(req.body);
  } else {
    return res.status(400).json({ error: '没有收到要导入的文件' });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return res.status(400).json({ error: '这个文件不是有效的 JSON' });
  }
  if (!parsed || !Array.isArray(parsed.modules)) {
    return res.status(400).json({ error: '这个文件不是有效的备份格式' });
  }
  try {
    backupRotate();
    db.replaceState(parsed);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json({ ok: true, state: db.getState() });
});

module.exports = router;
